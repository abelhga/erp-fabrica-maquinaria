-- "Márgenes" se separa de "Costos".
--
-- Compras necesita capturar costos (costos 2), y con eso veía también la utilidad de
-- cada artículo, la fórmula del precio y la pantalla Márgenes y precios: todo estaba en
-- el mismo módulo. Lo que cada quien necesita es distinto: compras e importaciones, el
-- costo y el precio de lista para negociar; la política de utilidad, los recargos y el
-- ISR, solo quien decide o analiza precios. Ahora:
--   costos 1/2  → ver / capturar costos (igual que antes)
--   margenes 1  → ver utilidad, política, fórmula del precio, Márgenes y precios
--   margenes 2  → fijar el margen propio o el precio fijo de un artículo
--   margenes 3  → cambiar políticas de precio y el ISR de compensación
-- Quien ve costo y precio de lista puede dividir uno entre otro; esto no lo impide, pero
-- deja de servir la utilidad, la política y el análisis de márgenes.

insert into public.permisos_rol (rol, modulo, nivel) values
  ('direccion', 'margenes', 3), ('finanzas', 'margenes', 1), ('administracion', 'margenes', 1), ('ingenieria', 'margenes', 1)
on conflict (rol, modulo) do update set nivel = excluded.nivel;

-- Políticas de precio: verlas es de márgenes; cambiarlas, de márgenes 3 (antes costos 3).
drop policy if exists ver on public.politicas_precio;
create policy ver on public.politicas_precio for select to authenticated using ((select puede('margenes', 1)));
drop policy if exists editar on public.politicas_precio;
create policy editar on public.politicas_precio for all to authenticated
  using ((select puede('margenes', 3))) with check ((select puede('margenes', 3)));

-- Margen propio y precio fijo viven en costos_articulo, que compras ve y edita para
-- capturar costos. La RLS no esconde columnas, así que se quitan esas dos de lo que la
-- API puede leer o escribir: quien las necesita pasa por funciones que revisan márgenes.
-- (Una columna nueva en esta tabla hay que darla de alta aquí, en el grant.)
revoke all on public.costos_articulo from anon, authenticated;
grant select (articulo_id, costo, moneda, proveedor_id, actualizado_en, actualizado_por) on public.costos_articulo to authenticated;
grant insert (articulo_id, costo, moneda, proveedor_id, actualizado_en, actualizado_por) on public.costos_articulo to authenticated;
grant update (costo, moneda, proveedor_id, actualizado_en, actualizado_por) on public.costos_articulo to authenticated;
grant delete on public.costos_articulo to authenticated;

-- Historial de costeo: el costo y el precio de lista siguen a la vista de costos; la
-- utilidad, el factor y la política de cada foto, no.
revoke all on public.historial_costeo from anon, authenticated;
grant select (id, articulo_id, en, costo_material, costo_mano_obra, costo_total, precio_lista, reconstruido)
  on public.historial_costeo to authenticated;

create or replace function public.fijar_margen_articulo(p_articulo uuid, p_margen numeric, p_precio_fijo numeric default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not puede('margenes', 2) then raise exception 'Fijar el margen o el precio de un artículo es de quien maneja márgenes' using errcode = '42501'; end if;
  if p_margen is not null and (p_margen < 0 or p_margen >= 1) then raise exception 'El margen va de 0 a 99 %%' using errcode = '22023'; end if;
  if p_precio_fijo is not null and p_precio_fijo <= 0 then raise exception 'El precio fijo tiene que ser mayor a cero' using errcode = '22023'; end if;
  update costos_articulo set margen = p_margen, precio_fijo = p_precio_fijo where articulo_id = p_articulo;
  if not found then raise exception 'Ese artículo no tiene costo capturado' using errcode = '22023'; end if;
  perform recalcular_costos(array[p_articulo]);
end $$;
revoke execute on function public.fijar_margen_articulo(uuid, numeric, numeric) from public, anon;
grant execute on function public.fijar_margen_articulo(uuid, numeric, numeric) to authenticated;

-- Lo que explica el precio (utilidad, recargos, ISR) y los simuladores: solo márgenes.
-- Se envuelven las de siempre (renombradas, sin acceso directo) para no copiar su cuerpo.
-- Las dos corren con permisos del dueño porque leen columnas que la API ya no da; por eso
-- la de afuera revisa márgenes antes que nada.
alter function public.desglose_precio(uuid) rename to desglose_precio_interno;
alter function public.desglose_precio_interno(uuid) security definer set search_path = public;
revoke execute on function public.desglose_precio_interno(uuid) from public, anon, authenticated;
create or replace function public.desglose_precio(p_articulo uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not puede('margenes', 1) then return null; end if;
  return desglose_precio_interno(p_articulo);
end $$;

alter function public.simular_precios(int, jsonb, numeric) rename to simular_precios_interno;
alter function public.simular_precios_interno(int, jsonb, numeric) security definer set search_path = public;
revoke execute on function public.simular_precios_interno(int, jsonb, numeric) from public, anon, authenticated;
create or replace function public.simular_precios(p_politica int, p_valores jsonb default '{}', p_isr numeric default null)
returns table (articulo_id uuid, clave text, nombre text, tipo public.tipo_articulo, politica text, costo numeric,
               precio_actual numeric, precio_simulado numeric)
language plpgsql stable security definer set search_path = public as $$
begin
  if not puede('margenes', 1) then raise exception 'Simular precios es de quien maneja márgenes' using errcode = '42501'; end if;
  return query select * from simular_precios_interno(p_politica, p_valores, p_isr);
end $$;

alter function public.simular_politica(int, numeric) rename to simular_politica_interno;
alter function public.simular_politica_interno(int, numeric) security definer set search_path = public;
revoke execute on function public.simular_politica_interno(int, numeric) from public, anon, authenticated;
create or replace function public.simular_politica(p_politica int, p_utilidad numeric)
returns table (articulo_id uuid, clave text, nombre text, costo numeric, precio_actual numeric, precio_simulado numeric)
language plpgsql stable security definer set search_path = public as $$
begin
  if not puede('margenes', 1) then raise exception 'Simular precios es de quien maneja márgenes' using errcode = '42501'; end if;
  return query select * from simular_politica_interno(p_politica, p_utilidad);
end $$;

-- El precio de lista que saldría de un costo: compras lo usa al contestar una solicitud de
-- precio. Lee el margen propio y la política, que ya no ve; da el precio, no el margen.
alter function public.precio_lista_estimado(uuid, numeric, public.moneda) security definer;

-- Costo y precio en el tiempo: el precio "con la utilidad de hoy" y la utilidad de cada
-- foto solo para márgenes (esa diferencia es justo cuánto cambió la utilidad).
drop function if exists public.serie_costeo(uuid);
create function public.serie_costeo(p_articulo uuid)
returns table (en timestamptz, costo numeric, precio_real numeric, precio_constante numeric, reconstruido boolean, utilidad numeric)
language plpgsql stable security definer set search_path = public as $$
declare v_margenes boolean := puede('margenes', 1);
begin
  if not puede('costos', 1) then raise exception 'Sin permiso de costos' using errcode = '42501'; end if;
  return query
  with hoy as (
    select case when cc.costo_total > 0 then precio_sin_redondeo(cc.costo_total, politica_de(a.id), c.margen, a.medida_especial) / cc.costo_total end f
    from articulos a join costos_calculados cc on cc.articulo_id = a.id left join costos_articulo c on c.articulo_id = a.id
    where a.id = p_articulo
  )
  select h.en, round(h.costo_total, 2), h.precio_lista,
    case when v_margenes then round(h.costo_total * hoy.f, 2) end, h.reconstruido,
    case when v_margenes then h.utilidad end
  from historial_costeo h left join hoy on true where h.articulo_id = p_articulo order by h.en;
end $$;
revoke execute on function public.serie_costeo(uuid) from public, anon;
grant execute on function public.serie_costeo(uuid) to authenticated;

-- El ISR de compensación: de márgenes 3 (antes costos 3). El resto, como en 081.
create or replace function public.fijar_isr_compensacion(p_valor numeric) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not puede('margenes', 3) then raise exception 'Solo quien administra márgenes cambia el ISR de compensación' using errcode = '42501'; end if;
  if p_valor is null or p_valor < 0 or p_valor >= 0.6 then
    raise exception 'El ISR de compensación debe estar entre 0 %% y 60 %%' using errcode = '22023';
  end if;
  update configuracion set valor = to_jsonb(p_valor), actualizado_en = now() where clave = 'isr_compensacion';
end $$;

-- La bitácora de las políticas de precio es de márgenes; la de costos, de costos (como en 050).
drop policy if exists bitacora_ver on public.bitacora;
create policy bitacora_ver on public.bitacora for select to authenticated using (
  ((select puede('admin', 1)) or (select tiene_rol('direccion')))
  and (tabla <> 'empleado_datos' or (select puede('rrhh', 3)))
  and (tabla not in ('empleados', 'incidencias') or (select puede('rrhh', 1)) or (select puede('produccion', 3)))
  and (tabla not in ('costos_articulo', 'historial_costos', 'costos_calculados', 'tarifas_mano_obra', 'historial_costeo')
       or (select puede('costos', 1)))
  and (tabla not in ('politicas_precio', 'costos_articulo', 'historial_costeo') or (select puede('margenes', 1)))
  and (tabla not in ('cobros', 'facturas', 'comision_ajustes', 'comision_pagos', 'vendedor_plan')
       or (select puede('finanzas', 1)) or (select puede('ventas', 3)))
);

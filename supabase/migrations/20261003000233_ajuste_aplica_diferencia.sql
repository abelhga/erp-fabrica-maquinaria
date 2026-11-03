-- =============================================================================
-- Un ajuste aplica la diferencia que se encontró; ya no «deja lo contado».
--
-- Por qué: al autorizar, el ERP dejaba la existencia en lo contado y calculaba el movimiento contra
-- la existencia de ese momento. Lo que salía entre el conteo y la autorización (chumaceras a una
-- orden, un envío de Mercado Libre que descuenta solo) se perdía: el sistema volvía a decir lo que se
-- contó antes de esas salidas. Con conteos que se autorizan uno o dos días después, en un almacén que
-- no se detiene, la existencia quedaba inflada justo después de corregirla (lo vimos al preparar el
-- conteo de lo que no cuadra con la hoja, 3 nov: 96 renglones, muchos de material que se surte a diario).
--
-- Ahora cada renglón del conteo guarda lo que decía el sistema al capturarlo (como congelar el libro
-- al contar), el ajuste se pide con ese número y al autorizarlo se aplica la diferencia
-- (contado − sistema) sobre la existencia de ese momento: lo que entró o salió después se respeta.
-- Si con la diferencia la existencia quedaría negativa, algo no cuadra (se contó antes de una salida
-- que ya había pasado, o una salida no fue real): no se autoriza y se vuelve a contar.
-- Los ajustes que ya esperaban autorización se pidieron con la existencia del momento en que se
-- pidieron, así que también aplican su diferencia.
-- =============================================================================

alter table public.conteo_lineas add column if not exists sistema_al_contar numeric(14,3);

-- Lo que decía el sistema lo pone la base al capturar (o al cambiar lo contado), igual que quién
-- contó y la hora: la pantalla no lo puede mandar, porque de ese número sale el ajuste.
create or replace function public.sellar_conteo_linea() returns trigger
language plpgsql as $$
begin
  new.contado_por := coalesce(auth.uid(), new.contado_por);
  new.en := now();
  if tg_op = 'INSERT' or new.cantidad_contada is distinct from old.cantidad_contada then
    new.sistema_al_contar := coalesce((select e.cantidad from public.existencias e join public.conteos c on c.almacen_id = e.almacen_id
                                        where c.id = new.conteo_id and e.articulo_id = new.articulo_id), 0);
  else
    new.sistema_al_contar := old.sistema_al_contar;
  end if;
  return new;
end $$;

-- Los renglones que ya estaban capturados en conteos abiertos: lo que decía el sistema a la hora en
-- que se capturaron, sumando los movimientos hasta esa hora. Sin el disparador, para no cambiar quién
-- contó ni la hora.
alter table public.conteo_lineas disable trigger sellar;
update public.conteo_lineas l
set sistema_al_contar = coalesce((select sum(m.cantidad) from public.movimientos_inventario m
                                  where m.articulo_id = l.articulo_id and m.almacen_id = c.almacen_id and m.en <= l.en), 0)
from public.conteos c
where c.id = l.conteo_id and c.estado = 'abierto' and l.sistema_al_contar is null;
alter table public.conteo_lineas enable trigger sellar;

-- La captura muestra, de lo ya contado, lo que decía el sistema al contarlo: la diferencia que se ve
-- es la que se va a pedir al cerrar, aunque después se mueva la existencia.
create or replace function public.conteo_captura(p_conteo uuid)
returns table (articulo_id uuid, clave text, nombre text, unidad text, sistema numeric, contada numeric, diferencia numeric,
               contado_por text, contado_en timestamptz, valor_diferencia numeric)
language sql stable security invoker as $$
  with c as (select * from public.conteos where id = p_conteo),
  arts as (
    select e.articulo_id from public.existencias e join c on e.almacen_id = c.almacen_id where e.cantidad <> 0
    union
    select l.articulo_id from public.conteo_lineas l where l.conteo_id = p_conteo
  )
  select a.id, a.clave, a.nombre, a.unidad, s.sistema, l.cantidad_contada,
    l.cantidad_contada - s.sistema, u.nombre, l.en,
    case when (select public.puede('costos', 1)) and l.cantidad_contada is not null
         then round((l.cantidad_contada - s.sistema) * ca.costo * public.tc(ca.moneda), 2) end
  from arts x
  join public.articulos a on a.id = x.articulo_id
  cross join c
  left join public.existencias e on e.articulo_id = a.id and e.almacen_id = c.almacen_id
  left join public.conteo_lineas l on l.conteo_id = p_conteo and l.articulo_id = a.id
  cross join lateral (select coalesce(l.sistema_al_contar, e.cantidad, 0) as sistema) s
  left join public.perfiles u on u.id = l.contado_por
  left join public.costos_articulo ca on ca.articulo_id = a.id
  order by a.nombre
$$;

-- Cerrar un conteo pide un ajuste por cada renglón que no coincidió con lo que decía el sistema al contarlo.
create or replace function public.cerrar_conteo(p_conteo uuid) returns int
language plpgsql security definer set search_path = public as $$
declare c conteos; v_n int;
begin
  if not puede('inventario', 2) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  select * into c from conteos where id = p_conteo for update;
  if c.estado <> 'abierto' then raise exception 'El conteo ya está cerrado'; end if;
  insert into ajustes_inventario (folio, articulo_id, almacen_id, cantidad_sistema, cantidad_fisica, motivo, conteo_id)
  select siguiente_folio('AJU'), l.articulo_id, c.almacen_id, s.sistema, l.cantidad_contada, 'Conteo físico: ' || c.nombre, c.id
  from conteo_lineas l
  left join existencias e on e.articulo_id = l.articulo_id and e.almacen_id = c.almacen_id
  cross join lateral (select coalesce(l.sistema_al_contar, e.cantidad, 0) as sistema) s
  where l.conteo_id = p_conteo and l.cantidad_contada <> s.sistema;
  get diagnostics v_n = row_count;
  update conteos set estado = 'cerrado', cerrado_en = now() where id = p_conteo;
  return v_n;
end $$;

-- Autorizar aplica la diferencia que se encontró sobre la existencia de hoy.
create or replace function public.resolver_ajuste(p_ajuste uuid, p_aprobar boolean, p_comentario text default null)
returns void language plpgsql security definer set search_path = public as $$
declare a ajustes_inventario; v_dif numeric; v_actual numeric;
begin
  if not (puede('inventario', 3) or tiene_rol('direccion') or tiene_rol('gerente_produccion')) then
    raise exception 'Solo la gerencia autoriza ajustes de inventario' using errcode = '42501';
  end if;
  select * into a from ajustes_inventario where id = p_ajuste for update;
  if a.estado <> 'pendiente' then raise exception 'Este ajuste ya fue resuelto'; end if;
  if a.solicitado_por = auth.uid() and not tiene_rol('direccion') then
    raise exception 'Un ajuste lo autoriza alguien distinto de quien lo pidió' using errcode = '42501';
  end if;
  if p_aprobar then
    v_dif := a.cantidad_fisica - a.cantidad_sistema;
    select coalesce(cantidad, 0) into v_actual from existencias where articulo_id = a.articulo_id and almacen_id = a.almacen_id;
    if coalesce(v_actual, 0) + v_dif < 0 then
      raise exception 'Con lo que salió después del conteo, la existencia quedaría en %: algo no cuadra. Recházalo y que se vuelva a contar',
        trim_scale(coalesce(v_actual, 0) + v_dif) using errcode = '23514';
    end if;
    if v_dif <> 0 then
      insert into movimientos_inventario (tipo, articulo_id, almacen_id, cantidad, ajuste_id, motivo, costo_unitario)
      values (case when v_dif > 0 then 'ajuste_entrada'::tipo_movimiento else 'ajuste_salida'::tipo_movimiento end,
              a.articulo_id, a.almacen_id, v_dif, a.id, a.motivo,
              (select costo * tc(moneda) from costos_articulo where articulo_id = a.articulo_id));
    end if;
  end if;
  update ajustes_inventario set estado = case when p_aprobar then 'aprobado' else 'rechazado' end,
    resuelto_por = auth.uid(), resuelto_en = now(), comentario = p_comentario
  where id = p_ajuste;
end $$;

-- =============================================================================
-- Resultados del periodo: cuánto genera de verdad lo que se vende.
--
-- Hasta hoy el ERP decía cuánto se vendió, pero no cuánto quedó. Esto arma el estado de
-- resultados de un periodo, sobre lo vendido (pedidos del periodo sin IVA y sin cancelados):
--   ventas por línea → costo de fabricación (material + mano de obra del taller + gastos de
--   fabricación) → gastos de operación (sueldos de oficina, comisiones, compras de gasto,
--   caja chica, lo que se queda Mercado Libre, guías de Envíos) → utilidad.
-- Lo que el ERP no sabe con exactitud se estima y se marca:
--   · material: de las partidas con costeo, el costo de hoy; de las de texto (casi todas las
--     de la hoja, 90 % de lo vendido en 2026), el peso del material en el precio de su línea:
--     de lo vendido con costeo en el último año si hay 10 partidas, si no del catálogo.
--   · sueldos: los de las semanas de nómina cerradas; las demás, sueldo semanal × días. Los
--     sueldos se cargaron en octubre de 2026: antes se toma el primero que se conoce (sin eso,
--     enero a septiembre salían en cero).
--   · comisiones: las que calcula la regla de cada mes (comisiones_mes).
-- Lo que se paga por fuera del ERP (renta, impuestos, IMSS que no se capture como compra) no
-- está: la pantalla lo dice.
-- Todo en pesos: un pedido en dólares se convierte con su tipo de cambio.
-- Las compras del libro se separan por categoría: el material ya va en el costo de lo vendido
-- (contarlo otra vez sería doble), el resto es gasto. Finanzas reclasifica una categoría.
-- Lo ve quien ve costos y finanzas o análisis: trae márgenes.
-- =============================================================================

create table if not exists public.compras_categorias (
  categoria text primary key,          -- como viene en el libro, en minúsculas y sin espacios de más
  tipo text not null check (tipo in ('material', 'fabricacion', 'operacion')),
  actualizado_por uuid default auth.uid() references public.perfiles(id),
  actualizado_en timestamptz not null default now()
);
comment on table public.compras_categorias is
  'Cómo cuenta cada categoría de compra en los resultados: material (ya va en el costo de lo vendido), gasto de fabricación o de operación.';
alter table public.compras_categorias enable row level security;
drop policy if exists ver on public.compras_categorias;
create policy ver on public.compras_categorias for select to authenticated
  using ((select puede('finanzas', 1)) or (select puede('analisis', 1)));
drop trigger if exists auditar on public.compras_categorias;
create trigger auditar after insert or update or delete on public.compras_categorias for each row execute function public.auditar();

-- Arranque por el nombre de la categoría; finanzas corrige lo que no cuadre. Lo de oficina y
-- limpieza va antes que «consumibles» para no caer en fabricación.
insert into public.compras_categorias (categoria, tipo)
select distinct lower(trim(m.categoria)),
  case
    when lower(m.categoria) ~ '(oficina|detergente|limpieza|papeler|cafeter)' then 'operacion'
    when lower(m.categoria) ~ '(consumible|gases|soldadura|seguridad|reparaci|herramient|epp|abrasiv)' then 'fabricacion'
    when lower(m.categoria) ~ '(banda|motor|componente|refacci|pintura|eje|material|l[aá]mina|placa|ptr|torniller|cinta|acero|balero|chumacera|polea|cadena|catarina|tubo|perfil|el[eé]ctric|cangil|reductor|rodillo|manguera|hule)' then 'material'
    else 'operacion'
  end
from public.movimientos_proveedor m
where m.categoria is not null and trim(m.categoria) <> ''
on conflict (categoria) do nothing;

create or replace function public.tipo_categoria_compra(p_categoria text) returns text
language sql stable security definer set search_path = public as $$
  select coalesce((select tipo from compras_categorias where categoria = lower(trim(p_categoria))), 'operacion')
$$;

create or replace function public.fijar_categoria_compra(p_categoria text, p_tipo text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not (puede('finanzas', 2) or puede('analisis', 3)) then
    raise exception 'Esto lo cambia finanzas' using errcode = '42501';
  end if;
  if p_tipo not in ('material', 'fabricacion', 'operacion') then raise exception 'Tipo de categoría desconocido'; end if;
  if coalesce(trim(p_categoria), '') = '' then raise exception 'Falta la categoría'; end if;
  insert into compras_categorias (categoria, tipo) values (lower(trim(p_categoria)), p_tipo)
  on conflict (categoria) do update set tipo = excluded.tipo, actualizado_por = auth.uid(), actualizado_en = now();
end $$;
revoke execute on function public.fijar_categoria_compra(text, text) from public, anon;
grant execute on function public.fijar_categoria_compra(text, text) to authenticated;

create or replace function public.resultados_periodo(p_desde date, p_hasta date)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_iva numeric := coalesce((select (valor #>> '{}')::numeric from configuracion where clave = 'iva'), 0.16);
  v_prod int := departamento_produccion();
  v_res jsonb;
  v_tot jsonb;
begin
  if not (puede('costos', 1) and (puede('finanzas', 1) or puede('analisis', 1))) then
    raise exception 'Los resultados son de dirección y finanzas' using errcode = '42501';
  end if;
  if p_hasta < p_desde then raise exception 'El periodo está al revés'; end if;

  with
  lineas as (
    select pl.linea::text linea, pl.importe * p.tipo_cambio importe, pl.cantidad * coalesce(c.costo_material, 0) material,
      coalesce(c.costo_total, 0) > 0 con_costo
    from pedido_lineas pl join pedidos p on p.id = pl.pedido_id
    left join costos_calculados c on c.articulo_id = pl.articulo_id
    where p.fecha between p_desde and p_hasta and p.estado <> 'cancelado' and pl.importe > 0
  ),
  -- Material/precio de lo vendido con costeo en el último año. El costeo es el de hoy, así que la
  -- muestra es la de hoy aunque el periodo sea viejo (casi todo lo de la hoja es texto).
  muestra as (
    select pl.linea::text linea, sum(pl.importe * p.tipo_cambio) importe, sum(pl.cantidad * c.costo_material) material, count(*) n
    from pedido_lineas pl join pedidos p on p.id = pl.pedido_id
    join costos_calculados c on c.articulo_id = pl.articulo_id and c.costo_total > 0
    where p.fecha > current_date - 365 and p.estado <> 'cancelado' and pl.importe > 0
    group by 1
  ),
  -- Con menos de 10 partidas vendidas la proporción de ventas es ruido: se usa la del catálogo
  -- (material ÷ precio de lista de los artículos de esa línea).
  catalogo as (
    select linea_de(c.articulo_id)::text linea, sum(c.costo_material) material, sum(pr.precio) importe
    from costos_calculados c join precios_lista pr on pr.articulo_id = c.articulo_id
    where c.costo_total > 0 and pr.precio > 0 and linea_de(c.articulo_id) is not null
    group by 1
  ),
  proporcion as (
    select coalesce(m.linea, k.linea) linea,
      case when coalesce(m.n, 0) >= 10 then m.material / nullif(m.importe, 0) else k.material / nullif(k.importe, 0) end r,
      case when coalesce(m.n, 0) >= 10 then 'ventas' else 'catalogo' end fuente,
      coalesce(m.n, 0) partidas
    from muestra m full join catalogo k on k.linea = m.linea
  ),
  global as (
    select coalesce((select sum(material) / nullif(sum(importe), 0) from muestra where n >= 10),
                    (select sum(material) / nullif(sum(importe), 0) from catalogo)) r
  ),
  material as (
    select coalesce(sum(l.material) filter (where l.con_costo), 0) exacto,
      coalesce(sum(l.importe * least(greatest(coalesce(p.r, g.r, 0.5), 0.05), 0.95)) filter (where not l.con_costo), 0) estimado,
      coalesce(sum(l.importe) filter (where l.con_costo), 0) ventas_con_costo
    from lineas l left join proporcion p on p.linea = l.linea cross join global g
  ),
  -- Sueldos: días del periodo cubiertos por una semana de nómina cerrada van con lo pagado; los
  -- demás, con el sueldo semanal de ese día ÷ 7. Antes de su primer sueldo registrado (los sueldos
  -- se cargaron en octubre de 2026) se toma ese primero: es lo más cercano que se sabe.
  dias as (select d::date dia from generate_series(p_desde, p_hasta, interval '1 day') d),
  cerradas as (select inicio from nomina_semanas where estado = 'cerrada' and inicio between p_desde - 6 and p_hasta),
  estimado as (
    select (e.departamento_id is not distinct from v_prod) taller, sum(s.sueldo_semanal / 7) importe
    from dias d
    join empleados e on e.fecha_ingreso <= d.dia and (e.activo or e.baja_en >= d.dia)
    join lateral (select x.sueldo_semanal from nomina_sueldos x where x.empleado_id = e.id
                  order by (x.desde <= d.dia) desc, case when x.desde <= d.dia then x.desde end desc, x.desde limit 1) s on true
    where not exists (select 1 from cerradas c where d.dia between c.inicio and c.inicio + 6)
    group by 1
  ),
  real as (
    select (e.departamento_id is not distinct from v_prod) taller,
      sum(n.total_percepciones * (least(c.inicio + 6, p_hasta) - greatest(c.inicio, p_desde) + 1) / 7.0) importe
    from cerradas c join nomina_renglones n on n.semana = c.inicio join empleados e on e.id = n.empleado_id
    group by 1
  ),
  compras as (
    select tipo_categoria_compra(m.categoria) tipo, coalesce(nullif(trim(m.categoria), ''), 'Sin categoría') categoria,
      sum(case when coalesce(m.cfdi_uuid, nullif(trim(m.factura), '')) is not null then m.monto / (1 + v_iva) else m.monto end) importe
    from movimientos_proveedor m
    where m.tipo = 'compra' and m.fecha between p_desde and p_hasta
    group by 1, 2
  ),
  comisiones as (
    select coalesce(sum(c.total), 0) importe
    from generate_series(date_trunc('month', p_desde), date_trunc('month', p_hasta), interval '1 month') g
    cross join lateral comisiones_mes(g::date) c
  )
  select jsonb_build_object(
    'periodo', jsonb_build_object('desde', p_desde, 'hasta', p_hasta),
    'ventas', (select coalesce(jsonb_agg(jsonb_build_object('linea', linea, 'importe', round(s, 2)) order by s desc), '[]')
               from (select linea, sum(importe) s from lineas group by linea) z),
    'ventas_total', (select round(coalesce(sum(importe), 0), 2) from lineas),
    'material', (select jsonb_build_object('exacto', round(exacto, 2), 'estimado', round(estimado, 2),
                  'cobertura', round(ventas_con_costo / nullif((select sum(importe) from lineas), 0), 4)) from material),
    'proporcion', (select coalesce(jsonb_object_agg(linea, jsonb_build_object('r', round(r, 4), 'fuente', fuente, 'partidas', partidas)), '{}')
                   from proporcion where r is not null and linea is not null),
    'proporcion_global', (select round(r, 4) from global),
    'mano_obra', jsonb_build_object('estimado', (select round(coalesce(sum(importe), 0), 2) from estimado where taller),
                                    'real', (select round(coalesce(sum(importe), 0), 2) from real where taller)),
    'sueldos_oficina', jsonb_build_object('estimado', (select round(coalesce(sum(importe), 0), 2) from estimado where not taller),
                                          'real', (select round(coalesce(sum(importe), 0), 2) from real where not taller)),
    'semanas_cerradas', (select count(*) from cerradas),
    'comisiones', (select round(importe, 2) from comisiones),
    -- comisiones_mes solo da las de todos a quien ve comisiones; a los demás, las suyas (cero).
    'comisiones_completas', puede('comisiones', 1) or puede('ventas', 3),
    'fabricacion', (select coalesce(jsonb_agg(jsonb_build_object('categoria', categoria, 'importe', round(importe, 2)) order by importe desc), '[]') from compras where tipo = 'fabricacion'),
    'operacion', (select coalesce(jsonb_agg(jsonb_build_object('categoria', categoria, 'importe', round(importe, 2)) order by importe desc), '[]') from compras where tipo = 'operacion'),
    'material_comprado', (select round(coalesce(sum(importe), 0), 2) from compras where tipo = 'material'),
    'caja_chica', (select round(coalesce(-sum(importe), 0), 2) from caja_chica where tipo = 'salida' and fecha between p_desde and p_hasta),
    -- Lo que Mercado Libre se queda de cada venta (comisión, envío que paga Hegamex, otros cargos).
    -- Las retenciones no: son impuestos a cuenta, no gasto.
    'mercado_libre', (select round(coalesce(sum(comision + envio + otros), 0), 2) from ml_pagos
                      where estado = 'approved' and (pagado_en at time zone 'America/Mexico_City')::date between p_desde and p_hasta),
    -- Las guías que pagamos (Envíos), por la fecha en que salió el paquete.
    'envios', (select round(coalesce(sum(costo_real), 0), 2) from envios
               where estado <> 'cancelado' and coalesce(enviado_en, guia_en, solicitado_en) is not null
                 and (coalesce(enviado_en, guia_en, solicitado_en) at time zone 'America/Mexico_City')::date between p_desde and p_hasta),
    'sin_clasificar', (select coalesce(jsonb_agg(distinct m.categoria), '[]') from movimientos_proveedor m
                       where m.tipo = 'compra' and m.fecha between p_desde and p_hasta and nullif(trim(m.categoria), '') is not null
                         and not exists (select 1 from compras_categorias k where k.categoria = lower(trim(m.categoria)))),
    -- Desde cuándo tiene datos cada fuente: un periodo anterior sale incompleto y la pantalla lo dice.
    'desde_compras', (select min(fecha) from movimientos_proveedor where tipo = 'compra' and nullif(trim(categoria), '') is not null),
    'desde_caja', (select min(fecha) from caja_chica),
    'desde_ventas', (select min(fecha) from pedidos),
    'sin_sueldo', (select count(*) from empleados e where e.activo and not exists (select 1 from nomina_sueldos s where s.empleado_id = e.id))
  ) into v_res;

  -- Los totales los da la base para que la pantalla no saque su propia utilidad. Mano de obra y
  -- sueldos de oficina: lo pagado de las semanas cerradas más lo estimado de las demás.
  select jsonb_build_object(
    'material', mat, 'mano_obra', mo, 'gastos_fabricacion', gf, 'costo_fabricacion', mat + mo + gf,
    'sueldos_oficina', so, 'compras_operacion', co,
    'gastos_operacion', so + com + co + caja + ml + env,
    'utilidad', ven - (mat + mo + gf) - (so + com + co + caja + ml + env))
  into v_tot
  from (select (v_res->>'ventas_total')::numeric ven,
          (v_res#>>'{material,exacto}')::numeric + (v_res#>>'{material,estimado}')::numeric mat,
          (v_res#>>'{mano_obra,estimado}')::numeric + (v_res#>>'{mano_obra,real}')::numeric mo,
          (select coalesce(sum((x->>'importe')::numeric), 0) from jsonb_array_elements(v_res->'fabricacion') x) gf,
          (v_res#>>'{sueldos_oficina,estimado}')::numeric + (v_res#>>'{sueldos_oficina,real}')::numeric so,
          (v_res->>'comisiones')::numeric com,
          (select coalesce(sum((x->>'importe')::numeric), 0) from jsonb_array_elements(v_res->'operacion') x) co,
          (v_res->>'caja_chica')::numeric caja, (v_res->>'mercado_libre')::numeric ml, (v_res->>'envios')::numeric env) z;
  return v_res || jsonb_build_object('totales', v_tot);
end $$;
revoke execute on function public.resultados_periodo(date, date) from public, anon;
grant execute on function public.resultados_periodo(date, date) to authenticated;

-- Las categorías con lo que sumaron en el periodo, para reclasificarlas en la pantalla.
create or replace function public.categorias_compra_periodo(p_desde date, p_hasta date)
returns table (categoria text, tipo text, clasificada boolean, compras int, importe numeric)
language plpgsql stable security definer set search_path = public as $$
begin
  if not (puede('costos', 1) and (puede('finanzas', 1) or puede('analisis', 1))) then
    raise exception 'Sin permiso' using errcode = '42501';
  end if;
  return query
  select lower(trim(m.categoria)), tipo_categoria_compra(m.categoria),
    exists (select 1 from compras_categorias k where k.categoria = lower(trim(m.categoria))), count(*)::int, round(sum(m.monto), 2)
  from movimientos_proveedor m
  where m.tipo = 'compra' and nullif(trim(m.categoria), '') is not null and m.fecha between p_desde and p_hasta
  group by 1, 2, 3
  order by 5 desc;
end $$;
revoke execute on function public.categorias_compra_periodo(date, date) from public, anon;
grant execute on function public.categorias_compra_periodo(date, date) to authenticated;

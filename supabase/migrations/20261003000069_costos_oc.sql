-- =============================================================================
-- Las órdenes de compra le enseñaban los costos a quien no debe verlos.
--
-- ordenes_compra, oc_lineas y pagos_proveedor se podían leer con compras nivel 1,
-- y ese nivel lo tienen almacén, gerencia de producción, sistemas e ingeniería
-- para saber qué viene en camino. La pantalla de compras ocultaba los importes,
-- pero la barrera es la RLS: con la API cualquiera de ellos leía costo_unitario.
--
-- Ahora:
--  - Las tablas solo las lee quien maneja dinero de compras: compras nivel 2,
--    finanzas o costos.
--  - v_ordenes_compra y v_oc_lineas (lo que usan las pantallas) dejan ver la orden
--    a quien la necesita para recibir o planear —compras 1, almacén y taller— y
--    ponen los importes en null si no maneja costos. Son vistas con los permisos
--    de su dueño (no de quien consulta) porque tienen que leer la tabla para
--    enmascararla; por eso repiten el filtro de filas aquí mismo.
-- =============================================================================

create or replace function public.ve_costos_compra() returns boolean
language sql stable security definer set search_path = public as $$
  select puede('compras', 2) or puede('finanzas', 1) or puede('costos', 1)
$$;

drop policy if exists ver on public.ordenes_compra;
create policy ver on public.ordenes_compra for select to authenticated using ((select ve_costos_compra()));
drop policy if exists ver on public.oc_lineas;
create policy ver on public.oc_lineas for select to authenticated using ((select ve_costos_compra()));
drop policy if exists ver on public.pagos_proveedor;
create policy ver on public.pagos_proveedor for select to authenticated
  using ((select puede('finanzas', 1)) or (select puede('compras', 2)));

drop view if exists public.v_ordenes_compra cascade;
drop view if exists public.v_oc_lineas cascade;
create view public.v_ordenes_compra with (security_invoker = false) as
with permiso as (select ve_costos_compra() dinero,
                        puede('compras', 1) or puede('finanzas', 1) or puede('inventario', 2) or puede('produccion', 2) fila)
select o.id, o.folio, o.proveedor_id, o.estado, o.fecha, o.fecha_entrega, o.moneda,
  case when permiso.dinero then o.tipo_cambio end as tipo_cambio,
  case when permiso.dinero then o.tasa_iva end as tasa_iva,
  o.condiciones, o.notas, o.factura_proveedor,
  case when permiso.dinero then o.subtotal end as subtotal,
  case when permiso.dinero then o.iva end as iva,
  case when permiso.dinero then o.total end as total,
  case when permiso.dinero then o.vence_pago end as vence_pago,
  o.creado_por, o.creado_en, o.actualizado_en,
  p.nombre as proveedor, p.es_importacion, u.nombre as creado_por_nombre,
  (select count(*) from public.oc_lineas l where l.orden_compra_id = o.id) as partidas,
  (select coalesce(sum(least(l.recibido, l.cantidad)) / nullif(sum(l.cantidad), 0), 0) from public.oc_lineas l where l.orden_compra_id = o.id) as avance_recibido,
  o.estado in ('enviada', 'parcial') and o.fecha_entrega < current_date as atrasada,
  case when o.estado in ('enviada', 'parcial') and o.fecha_entrega < current_date then current_date - o.fecha_entrega end as dias_atraso,
  case when permiso.dinero then (select coalesce(sum(x.monto), 0) from public.pagos_proveedor x where x.orden_compra_id = o.id) end as pagado
from public.ordenes_compra o
cross join permiso
join public.proveedores p on p.id = o.proveedor_id
left join public.perfiles u on u.id = o.creado_por
where permiso.fila;

create view public.v_oc_lineas with (security_invoker = false) as
with permiso as (select ve_costos_compra() dinero,
                        puede('compras', 1) or puede('finanzas', 1) or puede('inventario', 2) or puede('produccion', 2) fila)
select l.id, l.orden_compra_id, l.articulo_id, coalesce(a.nombre, l.descripcion) as nombre, l.descripcion, a.clave,
  coalesce(a.unidad, 'pieza') as unidad, a.empaque, a.almacen_preferido_id,
  l.cantidad,
  case when permiso.dinero then l.costo_unitario end as costo_unitario,
  case when permiso.dinero then l.importe end as importe,
  l.recibido, greatest(l.cantidad - l.recibido, 0) as pendiente,
  (select string_agg(distinct coalesce(op.folio, r.folio), ', ') from public.requisicion_lineas rl
   join public.requisiciones r on r.id = rl.requisicion_id left join public.ordenes_produccion op on op.id = rl.orden_produccion_id
   where rl.oc_linea_id = l.id) as para
from public.oc_lineas l
cross join permiso
left join public.articulos a on a.id = l.articulo_id
where permiso.fila;

-- La lista de requisiciones decía en qué orden de compra va cada partida; con las
-- tablas cerradas, almacén y el taller lo perdían. Se toma de las vistas.
create or replace view public.v_requisicion_lineas with (security_invoker = true) as
select rl.id, rl.requisicion_id, r.folio, r.origen, r.estado as estado_requisicion, r.necesaria_para, r.notas as notas_requisicion,
  r.creado_en, r.solicitante_id, s.nombre as solicitante,
  rl.articulo_id, a.clave, a.nombre, a.unidad, a.es_importado, rl.cantidad, rl.estado, rl.notas,
  rl.orden_produccion_id, op.folio as op_folio,
  coalesce(c.proveedor_id, a.proveedor_id) as proveedor_id, p.nombre as proveedor,
  c.costo, c.moneda,
  ol.orden_compra_id, oc.folio as oc_folio,
  (select sum(e.cantidad) from public.existencias e join public.almacenes al on al.id = e.almacen_id
   where e.articulo_id = rl.articulo_id and al.disponible_para_planta) as en_planta
from public.requisicion_lineas rl
join public.requisiciones r on r.id = rl.requisicion_id
join public.articulos a on a.id = rl.articulo_id
left join public.perfiles s on s.id = r.solicitante_id
left join public.ordenes_produccion op on op.id = rl.orden_produccion_id
left join public.costos_articulo c on c.articulo_id = rl.articulo_id
left join public.proveedores p on p.id = coalesce(c.proveedor_id, a.proveedor_id)
left join public.v_oc_lineas ol on ol.id = rl.oc_linea_id
left join public.v_ordenes_compra oc on oc.id = ol.orden_compra_id;

-- El kardex de almacén decía "OC <folio>" leyendo la tabla; ahora la lee de la vista.
create or replace view public.v_movimientos with (security_invoker = true) as
select m.id, m.en, m.tipo, m.articulo_id, a.clave, a.nombre, a.unidad, m.almacen_id, al.nombre as almacen,
  m.cantidad,
  -- La tabla la lee almacén para operar; el costo solo quien ve costos.
  case when (select public.puede('costos', 1)) then m.costo_unitario end as costo_unitario,
  m.motivo, m.fuera_de_lista, m.usuario_id, u.nombre as usuario,
  m.orden_compra_id, oc.folio as oc_folio, m.orden_produccion_id, op.folio as op_folio,
  m.pedido_id, pe.folio as pedido_folio, m.ajuste_id, aj.folio as ajuste_folio,
  m.traspaso_id, t.almacen as traspaso_almacen,
  coalesce('OC ' || oc.folio, op.folio || coalesce(' · ' || pe.folio, ''), pe.folio, aj.folio,
           case m.tipo when 'traspaso_salida' then 'a ' || t.almacen when 'traspaso_entrada' then 'de ' || t.almacen end) as referencia
from public.movimientos_inventario m
join public.articulos a on a.id = m.articulo_id
join public.almacenes al on al.id = m.almacen_id
left join public.perfiles u on u.id = m.usuario_id
left join public.v_ordenes_compra oc on oc.id = m.orden_compra_id
left join public.ordenes_produccion op on op.id = m.orden_produccion_id
left join public.pedidos pe on pe.id = m.pedido_id
left join public.ajustes_inventario aj on aj.id = m.ajuste_id
left join lateral (
  select al2.nombre as almacen from public.movimientos_inventario m2 join public.almacenes al2 on al2.id = m2.almacen_id
  where m.traspaso_id is not null and m2.traspaso_id = m.traspaso_id and m2.id <> m.id limit 1
) t on true;

grant select on public.v_ordenes_compra, public.v_oc_lineas to authenticated;
revoke all on public.v_ordenes_compra, public.v_oc_lineas from anon;

select public.optimizar_politicas();

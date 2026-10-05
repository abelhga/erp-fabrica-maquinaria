-- =============================================================================
-- El embarque sabe de qué proveedor es aunque todavía no tenga orden de compra.
--
-- Por qué: el proveedor de un embarque salía solo de sus órdenes de compra ligadas.
-- Los embarques que ya venían en camino al arrancar el ERP (y los que se dan de alta
-- con el BL antes de capturar la OC) no tienen orden, y en la lista salían como
-- "Sin orden de compra ligada": Alondra no sabría de quién es cada contenedor.
-- Si hay órdenes ligadas mandan ellas (un consolidado trae varios proveedores);
-- proveedor_id es el respaldo.
-- =============================================================================

alter table public.embarques add column if not exists proveedor_id uuid references public.proveedores(id) on delete set null;
create index if not exists embarques_proveedor on public.embarques (proveedor_id);

-- La vista lleva b.*: con la columna nueva hay que rehacerla (create or replace no
-- deja mover columnas). Nada depende de ella. Lo demás, igual que en 075.
drop view if exists public.v_embarques;
create view public.v_embarques with (security_invoker = true) as
select b.*, e.fase, e.etapa, e.etapa_nombre, e.fechas, e.arribo, e.despacho, e.en_planta, e.vacio,
  e.dias_en_puerto, e.dias_contenedor, e.llegada_planta_estimada, e.cambios_eta,
  coalesce(oc.proveedores, pv.nombre) as proveedores, coalesce(oc.ordenes, '[]'::jsonb) as ordenes,
  coalesce(d.pendientes, 0) as docs_pendientes, coalesce(d.pendientes_arribo, 0) as docs_pendientes_arribo,
  coalesce(d.total, 0) as docs_total, coalesce(d.faltan, '[]'::jsonb) as docs_faltan,
  s.paso as siguiente_paso, s.debe
from public.embarques b
join public.v_embarque_etapa e on e.embarque_id = b.id
left join public.proveedores pv on pv.id = b.proveedor_id
left join lateral (
  select string_agg(distinct o.proveedor, ', ') as proveedores,
    jsonb_agg(jsonb_build_object('id', o.id, 'folio', o.folio, 'proveedor', o.proveedor, 'proveedor_id', o.proveedor_id,
      'factura', x.factura, 'volumen_m3', x.volumen_m3, 'estado', o.estado, 'fecha', o.fecha, 'moneda', o.moneda) order by o.folio) as ordenes
  from public.embarque_oc x join public.v_ordenes_compra o on o.id = x.orden_compra_id
  where x.embarque_id = b.id
) oc on true
left join lateral (
  select count(*) filter (where dd.estado in ('pendiente', 'observado')) as pendientes,
    count(*) filter (where dd.estado in ('pendiente', 'observado') and c.antes_de_arribo) as pendientes_arribo,
    count(*) filter (where dd.estado <> 'no_aplica') as total,
    jsonb_agg(jsonb_build_object('id', dd.id, 'tipo', dd.tipo, 'nombre', c.nombre, 'debe', dd.debe, 'estado', dd.estado,
                                 'antes_de_arribo', c.antes_de_arribo) order by c.orden)
      filter (where dd.estado in ('pendiente', 'observado')) as faltan
  from public.embarque_documentos dd join public.documentos_importacion c on c.tipo = dd.tipo
  where dd.embarque_id = b.id
) d on true
left join lateral public.siguiente_paso_embarque(e.fase, e.fechas, b.modalidad,
  (select jsonb_agg(z) from jsonb_array_elements(d.faltan) z where (z->>'antes_de_arribo')::boolean), b.eta) s on true;

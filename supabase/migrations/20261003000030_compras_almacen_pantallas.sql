-- =============================================================================
-- Lo que necesitan las pantallas de compras y almacén.
--
-- Las tablas ya existían; faltaba poder leerlas como las lee la gente (con
-- nombres, folios y quién lo hizo) y algunas operaciones que hoy se hacen a
-- mano en las hojas:
--  * Kardex con saldo: el almacenista ve cómo llegó la existencia a su cifra
--    actual, sin poder tocar ninguna fila (en la hoja podía regresar a una fila
--    vieja y cambiarla sin que nadie se enterara).
--  * Requisiciones → órdenes de compra agrupadas por proveedor. Hoy compras lee
--    la hoja de validación de cada pedido y copia renglón por renglón a Órdenes.
--  * El reabasto puede volverse requisición (almacén) u orden de compra
--    (compras) sin recapturar, y ya no sugiere dos veces lo que ya está en una
--    orden en borrador.
--  * generar_oc_desde_reabasto dejaba órdenes vacías y metía costos en dólares
--    como si fueran pesos: se corrige aquí (ver más abajo).
--  * Índice de precios por proveedor: "¿quién nos sube más?", que hoy nadie
--    puede contestar sin una tarde de tablas dinámicas sobre ACTUALIZACIONES.
--
-- Todas las vistas son security_invoker: la RLS de cada tabla decide qué ve
-- quien pregunta. Donde aparece un costo, se muestra solo a quien tiene
-- "costos" (aunque la tabla de origen la lea también almacén).
-- =============================================================================

-- Índices para que el historial y el kardex no recorran toda la tabla
-- (movimientos crece ~1,500 filas al mes y ya trae 88 mil de historia).
create index if not exists movimientos_traspaso on public.movimientos_inventario (traspaso_id) where traspaso_id is not null;
create index if not exists movimientos_ajuste on public.movimientos_inventario (ajuste_id) where ajuste_id is not null;
create index if not exists movimientos_oc on public.movimientos_inventario (orden_compra_id) where orden_compra_id is not null;
create index if not exists movimientos_usuario on public.movimientos_inventario (usuario_id, en desc);
create index if not exists requisicion_lineas_pendientes on public.requisicion_lineas (articulo_id) where estado = 'pendiente';
create index if not exists requisicion_lineas_oc on public.requisicion_lineas (oc_linea_id) where oc_linea_id is not null;
create index if not exists historial_costos_proveedor on public.historial_costos (proveedor_id, en) where proveedor_id is not null;
create index if not exists historial_costos_en on public.historial_costos (en desc);

-- Los tiempos de entrega de la hoja son días HÁBILES ("Tiempo Estimado de
-- Entrega (días hábiles)"): 7 días hábiles son 9 naturales, no 7.
create or replace function public.sumar_dias_habiles(p_desde date, p_dias int) returns date
language sql immutable as $$
  select coalesce(max(d)::date, p_desde) from (
    select d from generate_series(p_desde + 1, p_desde + greatest(coalesce(p_dias, 0), 0) * 2 + 7, interval '1 day') d
    where extract(isodow from d) < 6
    order by d limit greatest(coalesce(p_dias, 0), 0)
  ) x
$$;

-- ----------------------------------------------------------------------------
-- Movimientos legibles y kardex
-- ----------------------------------------------------------------------------
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
left join public.ordenes_compra oc on oc.id = m.orden_compra_id
left join public.ordenes_produccion op on op.id = m.orden_produccion_id
left join public.pedidos pe on pe.id = m.pedido_id
left join public.ajustes_inventario aj on aj.id = m.ajuste_id
left join lateral (
  select al2.nombre as almacen from public.movimientos_inventario m2 join public.almacenes al2 on al2.id = m2.almacen_id
  where m.traspaso_id is not null and m2.traspaso_id = m.traspaso_id and m2.id <> m.id limit 1
) t on true;

-- Kardex de un artículo: cada movimiento con el saldo que dejó en su almacén.
-- El saldo se reconstruye hacia atrás desde la existencia de hoy, así que las
-- filas recientes siempre cuadran con lo que hay (aunque la historia importada
-- de las hojas traiga saldos iniciales que no salen de movimientos).
create or replace function public.kardex(p_articulo uuid, p_limite int default 300)
returns table (id bigint, en timestamptz, tipo public.tipo_movimiento, almacen_id int, almacen text, cantidad numeric,
               saldo_almacen numeric, usuario text, referencia text, motivo text, costo_unitario numeric, fuera_de_lista boolean)
language sql stable security invoker as $$
  select v.id, v.en, v.tipo, v.almacen_id, v.almacen, v.cantidad,
    coalesce(e.cantidad, 0) - coalesce(sum(v.cantidad) over (partition by v.almacen_id order by v.en desc, v.id desc
                                                         rows between unbounded preceding and 1 preceding), 0),
    v.usuario, v.referencia, v.motivo, v.costo_unitario, v.fuera_de_lista
  from public.v_movimientos v
  left join public.existencias e on e.articulo_id = v.articulo_id and e.almacen_id = v.almacen_id
  where v.articulo_id = p_articulo
  order by v.en desc, v.id desc
  limit p_limite
$$;

create or replace view public.v_reservas with (security_invoker = true) as
select r.id, r.articulo_id, a.clave, a.nombre, a.unidad, r.cantidad, r.surtido, r.cantidad - r.surtido as pendiente,
  r.orden_produccion_id, op.folio as op_folio, r.pedido_id, pe.folio as pedido_folio, r.motivo, r.estado,
  r.creado_por, u.nombre as creado_por_nombre, r.creado_en
from public.reservas r
join public.articulos a on a.id = r.articulo_id
left join public.ordenes_produccion op on op.id = r.orden_produccion_id
left join public.pedidos pe on pe.id = r.pedido_id
left join public.perfiles u on u.id = r.creado_por;

-- ----------------------------------------------------------------------------
-- Ajustes y conteos
-- ----------------------------------------------------------------------------
create or replace view public.v_ajustes with (security_invoker = true) as
select aj.id, aj.folio, aj.articulo_id, a.clave, a.nombre, a.unidad, aj.almacen_id, al.nombre as almacen,
  aj.cantidad_sistema, aj.cantidad_fisica, aj.diferencia, aj.motivo, aj.conteo_id, co.nombre as conteo, aj.estado,
  aj.solicitado_por, sp.nombre as solicitado_por_nombre, aj.solicitado_en,
  aj.resuelto_por, rp.nombre as resuelto_por_nombre, aj.resuelto_en, aj.comentario,
  e.cantidad as existencia_actual,
  -- Lo que de verdad movió la autorización: se aplica contra la existencia del
  -- momento, que pudo cambiar desde que se pidió.
  case when aj.estado = 'aprobado' then coalesce(ap.cantidad, 0) end as aplicado,
  case when (select public.puede('costos', 1)) then
    case aj.estado when 'aprobado' then round(coalesce(ap.valor, 0), 2)
                   else round(aj.diferencia * ca.costo * public.tc(ca.moneda), 2) end
  end as valor_diferencia
from public.ajustes_inventario aj
join public.articulos a on a.id = aj.articulo_id
join public.almacenes al on al.id = aj.almacen_id
left join public.conteos co on co.id = aj.conteo_id
left join public.perfiles sp on sp.id = aj.solicitado_por
left join public.perfiles rp on rp.id = aj.resuelto_por
left join public.existencias e on e.articulo_id = aj.articulo_id and e.almacen_id = aj.almacen_id
left join public.costos_articulo ca on ca.articulo_id = aj.articulo_id
left join lateral (select sum(m.cantidad) cantidad, sum(m.cantidad * m.costo_unitario) valor
                   from public.movimientos_inventario m where m.ajuste_id = aj.id) ap on true;

create or replace view public.v_conteos with (security_invoker = true) as
select c.id, c.nombre, c.almacen_id, al.nombre as almacen, c.estado, c.creado_por, u.nombre as creado_por_nombre,
  c.creado_en, c.cerrado_en,
  (select count(*) from public.conteo_lineas l where l.conteo_id = c.id) as capturados,
  (select count(*) from public.existencias e where e.almacen_id = c.almacen_id and e.cantidad <> 0) as en_sistema,
  (select count(*) from public.ajustes_inventario aj where aj.conteo_id = c.id) as ajustes,
  (select count(*) from public.ajustes_inventario aj where aj.conteo_id = c.id and aj.estado = 'pendiente') as ajustes_pendientes
from public.conteos c
join public.almacenes al on al.id = c.almacen_id
left join public.perfiles u on u.id = c.creado_por;

-- Hoja de captura de un conteo: lo que el sistema dice que hay en ese almacén
-- más lo que ya se contó (aunque el sistema no lo tuviera). La diferencia se ve
-- antes de cerrar, que es cuando se convierte en ajustes por autorizar.
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
  select a.id, a.clave, a.nombre, a.unidad, coalesce(e.cantidad, 0), l.cantidad_contada,
    l.cantidad_contada - coalesce(e.cantidad, 0), u.nombre, l.en,
    case when (select public.puede('costos', 1)) and l.cantidad_contada is not null
         then round((l.cantidad_contada - coalesce(e.cantidad, 0)) * ca.costo * public.tc(ca.moneda), 2) end
  from arts x
  join public.articulos a on a.id = x.articulo_id
  cross join c
  left join public.existencias e on e.articulo_id = a.id and e.almacen_id = c.almacen_id
  left join public.conteo_lineas l on l.conteo_id = p_conteo and l.articulo_id = a.id
  left join public.perfiles u on u.id = l.contado_por
  left join public.costos_articulo ca on ca.articulo_id = a.id
  order by a.nombre
$$;

-- Quién contó y cuándo lo pone la base, no la pantalla (igual que los movimientos).
create or replace function public.sellar_conteo_linea() returns trigger
language plpgsql as $$
begin
  new.contado_por := coalesce(auth.uid(), new.contado_por);
  new.en := now();
  return new;
end $$;
drop trigger if exists sellar on public.conteo_lineas;
create trigger sellar before insert or update on public.conteo_lineas for each row execute function public.sellar_conteo_linea();

-- ----------------------------------------------------------------------------
-- Precios de compra (reemplaza ACTUALIZACIONES)
-- ----------------------------------------------------------------------------
create or replace view public.v_precios_compra with (security_invoker = true) as
select a.id as articulo_id, a.clave, a.nombre, a.unidad, a.tipo, a.es_importado, a.empaque,
  coalesce(c.proveedor_id, a.proveedor_id) as proveedor_id, p.nombre as proveedor,
  a.proveedor_id as proveedor_habitual_id,
  c.costo, c.moneda, c.actualizado_en, u.nombre as actualizado_por,
  current_date - c.actualizado_en as dias_sin_actualizar,
  round(c.costo * public.tc(c.moneda), 4) as costo_mxn,
  h.costo_anterior, h.en as ultimo_cambio_en,
  (select count(*) from public.bom_lineas b where b.hijo_id = a.id) as usado_en
from public.articulos a
left join public.costos_articulo c on c.articulo_id = a.id
left join public.proveedores p on p.id = coalesce(c.proveedor_id, a.proveedor_id)
left join public.perfiles u on u.id = c.actualizado_por
left join lateral (select x.costo_anterior, x.en from public.historial_costos x where x.articulo_id = a.id
                   order by x.en desc, x.id desc limit 1) h on true
where a.activo and a.tipo in ('componente', 'materia_prima', 'servicio');

create or replace view public.v_historial_costos with (security_invoker = true) as
select h.id, h.en, h.articulo_id, a.clave, a.nombre, a.unidad, h.costo_anterior, h.costo_nuevo, h.moneda,
  case when h.costo_anterior > 0 then round(h.costo_nuevo / h.costo_anterior - 1, 4) end as cambio,
  h.origen, h.referencia, h.proveedor_id, p.nombre as proveedor, h.usuario_id, u.nombre as usuario
from public.historial_costos h
join public.articulos a on a.id = h.articulo_id
left join public.proveedores p on p.id = h.proveedor_id
left join public.perfiles u on u.id = h.usuario_id;

-- "Si cambio estos costos, ¿a cuántos equipos les muevo el precio?" Recorre la
-- lista de materiales hacia arriba en todos los niveles.
create or replace function public.impacto_costos(p_articulos uuid[]) returns jsonb
language sql stable security invoker as $$
  with u as (
    select distinct d.articulo_id from unnest(p_articulos) x(id) cross join lateral public.donde_se_usa(x.id) d
  ),
  f as (select a.id, a.clave, a.nombre, a.tipo, pl.precio from u join public.articulos a on a.id = u.articulo_id
        left join public.precios_lista pl on pl.articulo_id = a.id where a.activo)
  select jsonb_build_object(
    'equipos', (select count(*) from f where tipo = 'equipo'),
    'subensambles', (select count(*) from f where tipo = 'subensamble'),
    'ejemplos', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'clave', clave, 'nombre', nombre, 'precio', precio) order by nombre)
                          from (select * from f where tipo = 'equipo' order by nombre limit 8) e), '[]'::jsonb))
$$;

-- ----------------------------------------------------------------------------
-- Proveedores
-- ----------------------------------------------------------------------------
create or replace view public.v_proveedores with (security_invoker = true) as
with surte as (
  select x.proveedor_id, count(distinct x.articulo_id) n from (
    select a.proveedor_id, a.id as articulo_id from public.articulos a where a.activo and a.proveedor_id is not null
    union
    select c.proveedor_id, c.articulo_id from public.costos_articulo c join public.articulos a on a.id = c.articulo_id
    where a.activo and c.proveedor_id is not null
  ) x group by x.proveedor_id
),
compras as (
  select o.proveedor_id,
    count(*) filter (where o.estado in ('enviada', 'parcial')) as abiertas,
    count(*) filter (where o.estado in ('enviada', 'parcial') and o.fecha_entrega < current_date) as atrasadas,
    sum(o.total * o.tipo_cambio) filter (where o.estado <> 'cancelada' and o.fecha >= current_date - 365) as comprado_12m,
    max(o.fecha) filter (where o.estado <> 'cancelada') as ultima_compra
  from public.ordenes_compra o group by o.proveedor_id
)
select p.*, coalesce(s.n, 0) as articulos, coalesce(c.abiertas, 0) as oc_abiertas, coalesce(c.atrasadas, 0) as oc_atrasadas,
  c.comprado_12m, c.ultima_compra
from public.proveedores p
left join surte s on s.proveedor_id = p.id
left join compras c on c.proveedor_id = p.id;

-- Índice de precios de un proveedor (base 100 en el primer mes con datos).
-- Encadenado mes a mes: cada mes es la media geométrica de (costo de este mes ÷
-- costo del mes anterior) de TODOS sus artículos con precio, no solo de los que
-- cambiaron; si no, una sola alza de 30 % en una tuerca parecería que todo
-- subió 30 %. El costo de cada mes es el último registrado al cierre (los meses
-- sin cambio arrastran el anterior), en pesos al tipo de cambio de hoy para que
-- un artículo en dólares no "suba" solo porque se movió el dólar.
create or replace function public.indice_precios_proveedor(p_proveedor uuid, p_meses int default 36)
returns table (mes date, indice numeric, articulos int, cambios int)
language sql stable security invoker as $$
  with meses as (
    select g::date mes from generate_series(date_trunc('month', current_date) - make_interval(months => greatest(p_meses, 2) - 1),
                                            date_trunc('month', current_date), interval '1 month') g
  ),
  arts as (select distinct h.articulo_id from public.historial_costos h where h.proveedor_id = p_proveedor),
  precio as (
    select m.mes, x.articulo_id,
      (select h.costo_nuevo * public.tc(h.moneda) from public.historial_costos h
       where h.articulo_id = x.articulo_id and h.proveedor_id = p_proveedor and h.en < m.mes + interval '1 month'
       order by h.en desc, h.id desc limit 1) as costo
    from meses m cross join arts x
  ),
  rel as (
    select p.mes, p.articulo_id, p.costo, lag(p.costo) over (partition by p.articulo_id order by p.mes) as antes from precio p
  ),
  por_mes as (
    select r.mes, count(*) filter (where r.costo > 0) as articulos,
      count(*) filter (where r.antes > 0 and r.costo > 0 and r.costo <> r.antes) as cambios,
      coalesce(avg(ln(r.costo / r.antes)) filter (where r.antes > 0 and r.costo > 0), 0) as dlog
    from rel r group by r.mes
  ),
  idx as (select pm.*, 100 * exp(sum(pm.dlog) over (order by pm.mes)) as indice from por_mes pm)
  select idx.mes, round(idx.indice, 1), idx.articulos::int, idx.cambios::int from idx where idx.articulos > 0 order by idx.mes
$$;

-- ----------------------------------------------------------------------------
-- Órdenes de compra y requisiciones legibles
-- ----------------------------------------------------------------------------
create or replace view public.v_ordenes_compra with (security_invoker = true) as
select o.*, p.nombre as proveedor, p.es_importacion, u.nombre as creado_por_nombre,
  (select count(*) from public.oc_lineas l where l.orden_compra_id = o.id) as partidas,
  (select coalesce(sum(least(l.recibido, l.cantidad)) / nullif(sum(l.cantidad), 0), 0) from public.oc_lineas l where l.orden_compra_id = o.id) as avance_recibido,
  o.estado in ('enviada', 'parcial') and o.fecha_entrega < current_date as atrasada,
  case when o.estado in ('enviada', 'parcial') and o.fecha_entrega < current_date then current_date - o.fecha_entrega end as dias_atraso,
  (select coalesce(sum(x.monto), 0) from public.pagos_proveedor x where x.orden_compra_id = o.id) as pagado
from public.ordenes_compra o
join public.proveedores p on p.id = o.proveedor_id
left join public.perfiles u on u.id = o.creado_por;

create or replace view public.v_oc_lineas with (security_invoker = true) as
select l.id, l.orden_compra_id, l.articulo_id, coalesce(a.nombre, l.descripcion) as nombre, l.descripcion, a.clave,
  coalesce(a.unidad, 'pieza') as unidad, a.empaque, a.almacen_preferido_id,
  l.cantidad, l.costo_unitario, l.importe, l.recibido, greatest(l.cantidad - l.recibido, 0) as pendiente,
  (select string_agg(distinct coalesce(op.folio, r.folio), ', ') from public.requisicion_lineas rl
   join public.requisiciones r on r.id = rl.requisicion_id left join public.ordenes_produccion op on op.id = rl.orden_produccion_id
   where rl.oc_linea_id = l.id) as para
from public.oc_lineas l left join public.articulos a on a.id = l.articulo_id;

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
left join public.oc_lineas ol on ol.id = rl.oc_linea_id
left join public.ordenes_compra oc on oc.id = ol.orden_compra_id;

-- ----------------------------------------------------------------------------
-- Armar órdenes de compra en borrador, una por proveedor.
--
-- Recibe partidas [{articulo_id, cantidad, proveedor_id, requisicion_linea_id?}]
-- y las agrupa: un artículo pedido por dos requisiciones va en una sola partida.
-- El costo sugerido es el costo vigente convertido a la moneda del proveedor
-- (una refacción de 300 USD no puede entrar como $300 pesos). La fecha de
-- entrega sale del tiempo de entrega más largo de la orden, en días hábiles.
-- Es interna: la llaman ordenes_desde_requisiciones y ordenes_desde_reabasto.
-- ----------------------------------------------------------------------------
create or replace function public.armar_ordenes_compra(p_partidas jsonb, p_notas text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_prov proveedores; v_oc ordenes_compra; v_res jsonb := '[]'; v_dias int; l record; v_linea uuid; v_def int;
begin
  if not puede('compras', 2) then raise exception 'Solo compras arma órdenes de compra' using errcode = '42501'; end if;
  v_def := coalesce((select (valor->>'dias_entrega_default')::int from configuracion where clave = 'reabasto'), 7);

  for v_prov in select p.* from proveedores p
                where p.id in (select (x->>'proveedor_id')::uuid from jsonb_array_elements(p_partidas) x)
                order by p.nombre loop
    select max(coalesce(a.tiempo_entrega_dias, v_prov.dias_entrega, v_def)) into v_dias
    from jsonb_array_elements(p_partidas) x join articulos a on a.id = (x->>'articulo_id')::uuid
    where (x->>'proveedor_id')::uuid = v_prov.id;

    insert into ordenes_compra (proveedor_id, moneda, tipo_cambio, fecha_entrega, condiciones, notas)
    values (v_prov.id, v_prov.moneda, tc(v_prov.moneda), sumar_dias_habiles(current_date, coalesce(v_dias, v_def)),
            case when v_prov.dias_credito > 0 then 'Crédito a ' || v_prov.dias_credito || ' días' else 'Contado' end, p_notas)
    returning * into v_oc;

    for l in select (x->>'articulo_id')::uuid as articulo_id, sum((x->>'cantidad')::numeric) as cantidad,
                    array_agg((x->>'requisicion_linea_id')::uuid) filter (where x ? 'requisicion_linea_id') as reqs
             from jsonb_array_elements(p_partidas) x
             where (x->>'proveedor_id')::uuid = v_prov.id
             group by 1 order by 1 loop
      insert into oc_lineas (orden_compra_id, articulo_id, descripcion, cantidad, costo_unitario)
      select v_oc.id, a.id, a.nombre, l.cantidad,
        coalesce(case when c.moneda = v_oc.moneda then c.costo else round(c.costo * tc(c.moneda) / tc(v_oc.moneda), 4) end, 0)
      from articulos a left join costos_articulo c on c.articulo_id = a.id where a.id = l.articulo_id
      returning id into v_linea;
      if l.reqs is not null then
        update requisicion_lineas set estado = 'ordenada', oc_linea_id = v_linea where id = any(l.reqs);
      end if;
    end loop;

    select * into v_oc from ordenes_compra where id = v_oc.id;   -- con totales ya calculados
    v_res := v_res || jsonb_build_object('id', v_oc.id, 'folio', v_oc.folio, 'proveedor', v_prov.nombre, 'moneda', v_oc.moneda,
      'total', v_oc.total, 'partidas', (select count(*) from oc_lineas where orden_compra_id = v_oc.id));
  end loop;
  return v_res;
end $$;
-- Solo la usan las funciones de abajo (que corren como dueño): no se expone a la API.
revoke execute on function public.armar_ordenes_compra(jsonb, text) from public, anon, authenticated;

-- Requisiciones pendientes → órdenes en borrador por proveedor. Las partidas sin
-- proveedor (ni en su costo ni en el artículo) se quedan pendientes y se avisan,
-- salvo que se indique a quién comprárselas.
create or replace function public.ordenes_desde_requisiciones(p_lineas uuid[], p_proveedor uuid default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_part jsonb; v_sin jsonb; v_res jsonb; v_folios text;
begin
  if not puede('compras', 2) then raise exception 'Solo compras convierte requisiciones en órdenes de compra' using errcode = '42501'; end if;
  if coalesce(cardinality(p_lineas), 0) = 0 then raise exception 'Elige al menos una partida'; end if;
  perform 1 from requisicion_lineas where id = any(p_lineas) for update;
  if exists (select 1 from requisicion_lineas where id = any(p_lineas) and estado <> 'pendiente') then
    raise exception 'Alguna partida ya se convirtió en orden o se canceló. Recarga la lista.';
  end if;

  with l as (
    select rl.id, rl.articulo_id, rl.cantidad, a.clave, a.nombre, coalesce(c.proveedor_id, a.proveedor_id, p_proveedor) as prov
    from requisicion_lineas rl join articulos a on a.id = rl.articulo_id
    left join costos_articulo c on c.articulo_id = rl.articulo_id
    where rl.id = any(p_lineas)
  )
  select coalesce(jsonb_agg(jsonb_build_object('articulo_id', articulo_id, 'cantidad', cantidad, 'proveedor_id', prov,
                                                'requisicion_linea_id', id)) filter (where prov is not null), '[]'),
         coalesce(jsonb_agg(jsonb_build_object('id', id, 'clave', clave, 'nombre', nombre)) filter (where prov is null), '[]')
  into v_part, v_sin from l;

  select string_agg(distinct r.folio, ', ') into v_folios from requisiciones r
  where r.id in (select requisicion_id from requisicion_lineas where id = any(p_lineas));
  v_res := armar_ordenes_compra(v_part, 'Desde ' || v_folios);

  update requisiciones r set estado = 'en_compra'
  where r.id in (select requisicion_id from requisicion_lineas where id = any(p_lineas)) and r.estado = 'abierta'
    and not exists (select 1 from requisicion_lineas x where x.requisicion_id = r.id and x.estado = 'pendiente');
  return jsonb_build_object('ordenes', v_res, 'sin_proveedor', v_sin);
end $$;

-- Partidas del reabasto que todavía hay que pedir: lo sugerido menos lo que ya
-- está en una orden en borrador o en una requisición pendiente (si no, cada
-- clic en "generar" duplicaba la compra), redondeado al empaque.
create or replace function public.reabasto_por_pedir(p_articulos uuid[])
returns table (articulo_id uuid, clave text, nombre text, sugerido numeric, en_borrador numeric, en_requisicion numeric,
               por_pedir numeric, proveedor_id uuid)
language sql stable security invoker as $$
  select r.articulo_id, r.clave, r.nombre, r.sugerido, coalesce(b.cant, 0), coalesce(q.cant, 0),
    greatest(ceil((r.sugerido - coalesce(b.cant, 0) - coalesce(q.cant, 0)) / a.empaque) * a.empaque, 0),
    coalesce(c.proveedor_id, a.proveedor_id)
  from public.reabasto() r
  join public.articulos a on a.id = r.articulo_id
  left join public.costos_articulo c on c.articulo_id = r.articulo_id
  left join lateral (select sum(l.cantidad - l.recibido) cant from public.oc_lineas l join public.ordenes_compra o on o.id = l.orden_compra_id
                     where o.estado = 'borrador' and l.articulo_id = r.articulo_id) b on true
  left join lateral (select sum(x.cantidad) cant from public.requisicion_lineas x where x.estado = 'pendiente' and x.articulo_id = r.articulo_id) q on true
  where r.articulo_id = any(p_articulos)
$$;

create or replace function public.ordenes_desde_reabasto(p_articulos uuid[], p_proveedor uuid default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_part jsonb; v_sin jsonb; v_omit jsonb;
begin
  if not puede('compras', 2) then raise exception 'Solo compras genera órdenes de compra' using errcode = '42501'; end if;
  with p as (select x.*, coalesce(x.proveedor_id, p_proveedor) as prov from reabasto_por_pedir(p_articulos) x)
  select coalesce(jsonb_agg(jsonb_build_object('articulo_id', articulo_id, 'cantidad', por_pedir, 'proveedor_id', prov))
                    filter (where por_pedir > 0 and prov is not null), '[]'),
         coalesce(jsonb_agg(jsonb_build_object('id', articulo_id, 'clave', clave, 'nombre', nombre))
                    filter (where por_pedir > 0 and prov is null), '[]'),
         coalesce(jsonb_agg(jsonb_build_object('id', articulo_id, 'clave', clave, 'nombre', nombre,
                    'razon', case when sugerido = 0 then 'no hace falta pedir' else 'ya está pedido en una orden en borrador o requisición' end))
                    filter (where por_pedir <= 0), '[]')
  into v_part, v_sin, v_omit from p;
  return jsonb_build_object('ordenes', armar_ordenes_compra(v_part, 'Generada desde reabasto'), 'sin_proveedor', v_sin, 'omitidos', v_omit);
end $$;

-- CORRECCIÓN de 20261003000004: la versión original creaba una orden por cada
-- proveedor aunque ninguno de sus artículos tuviera sugerido (órdenes vacías),
-- copiaba el costo sin convertir moneda (un costo en dólares quedaba como pesos
-- en una orden en pesos) y no ponía fecha de entrega. Misma firma, mismo
-- resultado (cuántas órdenes creó), ahora sobre ordenes_desde_reabasto.
create or replace function public.generar_oc_desde_reabasto(p_articulos uuid[]) returns int
language plpgsql security definer set search_path = public as $$
begin
  return jsonb_array_length(ordenes_desde_reabasto(p_articulos)->'ordenes');
end $$;

-- Almacén no compra, pero sí puede pedirle a compras lo que el reabasto sugiere.
create or replace function public.requisicion_desde_reabasto(p_articulos uuid[], p_notas text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_req requisiciones; v_n int;
begin
  if not (puede('inventario', 2) or puede('compras', 2)) then
    raise exception 'Sin permiso para pedir material a compras' using errcode = '42501';
  end if;
  if not exists (select 1 from reabasto_por_pedir(p_articulos) where por_pedir > 0) then
    raise exception 'Nada que pedir: lo sugerido ya está en una requisición o en una orden en borrador';
  end if;
  insert into requisiciones (origen, notas) values ('reabasto', coalesce(nullif(trim(p_notas), ''), 'Sugerido por reabasto'))
  returning * into v_req;
  insert into requisicion_lineas (requisicion_id, articulo_id, cantidad)
  select v_req.id, articulo_id, por_pedir from reabasto_por_pedir(p_articulos) where por_pedir > 0;
  get diagnostics v_n = row_count;
  return jsonb_build_object('id', v_req.id, 'folio', v_req.folio, 'partidas', v_n);
end $$;

-- Reabasto con lo que la pantalla necesita además del cálculo: qué ya está en
-- camino de pedirse y cuánto costaría (solo para quien ve costos).
create or replace function public.reabasto_detalle()
returns table (articulo_id uuid, clave text, nombre text, unidad text, es_importado boolean, proveedor text,
  consumo_meses numeric[], meses_con_consumo int, demanda_mensual numeric, dias_entrega int, meses_cobertura numeric,
  stock_seguridad numeric, punto_reorden numeric, lote numeric, en_planta numeric, reservado numeric, en_transito numeric,
  disponible numeric, sugerido numeric, estado text,
  proveedor_id uuid, empaque numeric, cobertura_propia numeric, entrega_propia int,
  en_borrador numeric, borradores text, en_requisicion numeric, costo_mxn numeric)
language sql stable security invoker as $$
  select r.*, coalesce(c.proveedor_id, a.proveedor_id), a.empaque, a.meses_cobertura, a.tiempo_entrega_dias,
    coalesce(b.cant, 0), b.folios, coalesce(q.cant, 0),
    round(c.costo * public.tc(c.moneda), 4)
  from public.reabasto() r
  join public.articulos a on a.id = r.articulo_id
  left join public.costos_articulo c on c.articulo_id = r.articulo_id
  left join lateral (select sum(l.cantidad - l.recibido) cant, string_agg(distinct o.folio, ', ') folios
                     from public.oc_lineas l join public.ordenes_compra o on o.id = l.orden_compra_id
                     where o.estado = 'borrador' and l.articulo_id = r.articulo_id) b on true
  left join lateral (select sum(x.cantidad) cant from public.requisicion_lineas x
                     where x.estado = 'pendiente' and x.articulo_id = r.articulo_id) q on true
$$;

-- ----------------------------------------------------------------------------
-- Ciclo de la orden de compra
-- ----------------------------------------------------------------------------

-- Agregar una partida con el costo vigente como sugerencia (en la moneda de la
-- orden). Si el artículo ya está en la orden, suma la cantidad.
create or replace function public.agregar_partida_oc(p_oc uuid, p_articulo uuid, p_cantidad numeric default 1) returns uuid
language plpgsql security invoker as $$
declare o ordenes_compra; v_id uuid;
begin
  if not puede('compras', 2) then raise exception 'Solo compras edita órdenes de compra' using errcode = '42501'; end if;
  select * into o from ordenes_compra where id = p_oc;
  if o.id is null then raise exception 'No existe la orden'; end if;
  if o.estado <> 'borrador' then raise exception 'La orden % ya se envió: sus partidas no se cambian', o.folio; end if;
  if coalesce(p_cantidad, 0) <= 0 then raise exception 'La cantidad debe ser mayor a cero'; end if;
  update oc_lineas set cantidad = cantidad + p_cantidad where orden_compra_id = p_oc and articulo_id = p_articulo returning id into v_id;
  if v_id is null then
    insert into oc_lineas (orden_compra_id, articulo_id, descripcion, cantidad, costo_unitario)
    select p_oc, a.id, a.nombre, p_cantidad,
      coalesce(case when c.moneda = o.moneda then c.costo else round(c.costo * tc(c.moneda) / tc(o.moneda), 4) end, 0)
    from articulos a left join costos_articulo c on c.articulo_id = a.id where a.id = p_articulo
    returning id into v_id;
  end if;
  return v_id;
end $$;

create or replace function public.enviar_orden_compra(p_oc uuid) returns void
language plpgsql security invoker as $$
declare o ordenes_compra; v_dias int;
begin
  if not puede('compras', 2) then raise exception 'Solo compras envía órdenes de compra' using errcode = '42501'; end if;
  select * into o from ordenes_compra where id = p_oc for update;
  if o.id is null then raise exception 'No existe la orden'; end if;
  if o.estado <> 'borrador' then raise exception 'La orden % ya se envió', o.folio; end if;
  if not exists (select 1 from oc_lineas where orden_compra_id = p_oc) then raise exception 'La orden no tiene partidas'; end if;
  -- Una orden sin precio es una factura sorpresa: el precio se pacta antes de enviarla.
  if exists (select 1 from oc_lineas where orden_compra_id = p_oc and costo_unitario = 0) then
    raise exception 'Hay partidas sin costo: captura el precio que dio el proveedor antes de enviar';
  end if;
  select coalesce(dias_entrega, 7) into v_dias from proveedores where id = o.proveedor_id;
  update ordenes_compra set estado = 'enviada', fecha_entrega = coalesce(fecha_entrega, sumar_dias_habiles(current_date, v_dias))
  where id = p_oc;
end $$;

-- Cancelar regresa sus requisiciones a "pendiente": lo que se necesitaba se sigue necesitando.
create or replace function public.cancelar_orden_compra(p_oc uuid, p_motivo text) returns void
language plpgsql security invoker as $$
declare o ordenes_compra;
begin
  if not puede('compras', 2) then raise exception 'Solo compras cancela órdenes de compra' using errcode = '42501'; end if;
  select * into o from ordenes_compra where id = p_oc for update;
  if o.id is null then raise exception 'No existe la orden'; end if;
  if o.estado not in ('borrador', 'enviada') or exists (select 1 from oc_lineas where orden_compra_id = p_oc and recibido > 0) then
    raise exception 'Solo se cancela una orden que no ha recibido nada';
  end if;
  if coalesce(trim(p_motivo), '') = '' then raise exception 'Escribe por qué se cancela'; end if;
  update ordenes_compra set estado = 'cancelada', notas = concat_ws(E'\n', notas, 'Cancelada: ' || trim(p_motivo)) where id = p_oc;
  with liberadas as (
    update requisicion_lineas set estado = 'pendiente', oc_linea_id = null
    where oc_linea_id in (select id from oc_lineas where orden_compra_id = p_oc) and estado = 'ordenada'
    returning requisicion_id
  )
  update requisiciones set estado = 'abierta' where id in (select requisicion_id from liberadas) and estado = 'en_compra';
end $$;

-- Si se borra una partida (o la orden en borrador completa), lo que pedía la
-- requisición vuelve a quedar pendiente. Antes quedaba "ordenada" sin orden.
create or replace function public.liberar_requisicion() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  with liberadas as (
    update requisicion_lineas set estado = 'pendiente', oc_linea_id = null
    where oc_linea_id = old.id and estado = 'ordenada' returning requisicion_id
  )
  update requisiciones set estado = 'abierta' where id in (select requisicion_id from liberadas) and estado = 'en_compra';
  return old;
end $$;
drop trigger if exists liberar_requisicion on public.oc_lineas;
create trigger liberar_requisicion before delete on public.oc_lineas for each row execute function public.liberar_requisicion();

-- ----------------------------------------------------------------------------
-- CORRECCIÓN de 20261003000002 (registrar_historial_costo).
-- recibir_orden_compra marca el origen con set_config('erp.origen_costo', …, true).
-- Al terminar esa transacción la variable no vuelve a NULL sino a '' en esa
-- conexión, y la API reutiliza conexiones: el siguiente cambio manual de costo
-- en la misma conexión intentaba guardar origen = '' y la restricción del
-- historial lo rechazaba ("Algún dato no es válido"). Lo atrapó
-- 70_compras_almacen_pantallas.sql al correr después de 30_inventario.sql.
-- ----------------------------------------------------------------------------
create or replace function public.registrar_historial_costo() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' or new.costo is distinct from old.costo or new.moneda is distinct from old.moneda then
    insert into historial_costos (articulo_id, costo_anterior, costo_nuevo, moneda, proveedor_id, origen)
    values (new.articulo_id, case when tg_op = 'UPDATE' then old.costo end, new.costo, new.moneda, new.proveedor_id,
            coalesce(nullif(current_setting('erp.origen_costo', true), ''), 'manual'));
  end if;
  return new;
end $$;

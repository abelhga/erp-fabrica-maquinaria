-- =============================================================================
-- La planta ve la descripción de lo que se vendió (sin precios).
--
-- Luis abría un pedido en Producción → Pedidos y solo veía «Helicoidal de descarga de 8" x 6
-- metros»: las especificaciones que se le cotizaron al cliente (calibres, motor, acabado) se
-- quedaban en la cotización, que la planta no ve porque trae montos (147). Fabricar sin ellas
-- es fabricar de memoria. La descripción de la partida no es un monto: se le enseña a quien
-- ya ve el pedido, en Pedidos y en el detalle de cada orden.
-- =============================================================================

create or replace function public.pedido_lineas_descripcion()
returns table (id uuid, descripcion text)
language sql stable security definer set search_path = public as $$
  select pl.id, btrim(trim(pl.descripcion), '"') from pedido_lineas pl
  where pl.pedido_id in (select b.id from pedidos_basicos() b) and nullif(trim(pl.descripcion), '') is not null
$$;
revoke execute on function public.pedido_lineas_descripcion() from public, anon;
grant execute on function public.pedido_lineas_descripcion() to authenticated;

-- La misma vista de 156, con la descripción en cada partida.
create or replace view public.v_pedidos_produccion with (security_invoker = true) as
with lin as (select * from pedido_lineas_basicas()),
ords as (
  select o.id, o.folio, o.estado, o.numero_serie, o.pedido_id, o.pedido_linea_id,
    case when o.estado in ('terminada', 'entregada') then 100 else coalesce(t.avance, 0) end avance
  from ordenes_produccion o left join v_tablero_produccion t on t.id = o.id
  where o.pedido_id is not null and o.estado <> 'cancelada'
),
part as (
  select l.pedido_id,
    jsonb_agg(jsonb_build_object('linea_id', l.id, 'articulo_id', l.articulo_id, 'clave', a.clave, 'titulo', coalesce(l.titulo, a.nombre),
      'cantidad', l.cantidad, 'unidad', l.unidad, 'fabrica', coalesce(a.tipo in ('equipo', 'subensamble'), false),
      'tiene_lista', exists (select 1 from bom_lineas b where b.padre_id = a.id),
      'descripcion', ds.descripcion,
      'ordenes', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'folio', x.folio, 'estado', x.estado, 'serie', x.numero_serie, 'avance', x.avance)
                                            order by x.folio) from ords x where x.pedido_linea_id = l.id), '[]'::jsonb))
      order by l.orden) as partidas,
    count(*) filter (where a.tipo in ('equipo', 'subensamble'))::int as equipos,
    coalesce(sum(case when a.tipo in ('equipo', 'subensamble')
      then greatest(ceil(l.cantidad)::int - (select count(*) from ords x where x.pedido_linea_id = l.id)::int, 0) end), 0)::int as sin_orden
  from lin l left join articulos a on a.id = l.articulo_id
  left join pedido_lineas_descripcion() ds on ds.id = l.id
  group by l.pedido_id
),
-- Las órdenes que no cuelgan de una partida: las que se cargaron de la hoja de Luis, donde
-- la partida del pedido es un texto ("línea de envasado") y los equipos son las órdenes.
sueltas as (
  select x.pedido_id,
    jsonb_agg(jsonb_build_object('id', x.id, 'folio', x.folio, 'estado', x.estado, 'serie', x.numero_serie, 'avance', x.avance,
      'equipo', a.nombre, 'clave', a.clave) order by x.folio) as ordenes,
    count(*)::int as n
  from ords x join ordenes_produccion o on o.id = x.id join articulos a on a.id = o.articulo_id
  where x.pedido_linea_id is null or not exists (select 1 from lin l where l.id = x.pedido_linea_id)
  group by x.pedido_id
),
por_pedido as (
  select pedido_id, count(*)::int ordenes, count(*) filter (where estado in ('terminada', 'entregada'))::int terminadas, round(avg(avance))::int avance
  from ords group by pedido_id
)
select p.id, p.folio, p.cliente_id, c.nombre as cliente, p.vendedor_id, v.nombre as vendedor, p.canal, p.estado,
  p.fecha, p.fecha_compromiso, p.fecha_compromiso - hoy_planta() as dias_restantes, p.entregado_en, p.historico,
  coalesce(pt.partidas, '[]'::jsonb) as partidas, coalesce(pt.equipos, 0) + coalesce(su.n, 0) as equipos, coalesce(pt.sin_orden, 0) as sin_orden,
  coalesce(pp.ordenes, 0) as ordenes, coalesce(pp.terminadas, 0) as ordenes_terminadas, pp.avance,
  coalesce(su.ordenes, '[]'::jsonb) as ordenes_sueltas
from pedidos_basicos() p
left join clientes c on c.id = p.cliente_id
left join perfiles v on v.id = p.vendedor_id
left join part pt on pt.pedido_id = p.id
left join por_pedido pp on pp.pedido_id = p.id
left join sueltas su on su.pedido_id = p.id;

-- Lo que se le vendió al cliente para esta orden: su partida, o todas las del pedido si la orden
-- vino de la hoja sin partida. Solo para quien ve el pedido; sin precios.
create or replace function public.venta_de_orden(p_op uuid)
returns table (linea_id uuid, titulo text, descripcion text, cantidad numeric, unidad text, de_la_orden boolean)
language plpgsql stable security definer set search_path = public as $$
declare v_pedido uuid; v_linea uuid;
begin
  if not (puede('produccion', 1) or puede('procesos', 1)) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  select o.pedido_id, o.pedido_linea_id into v_pedido, v_linea from ordenes_produccion o where o.id = p_op;
  if v_pedido is null or v_pedido not in (select b.id from pedidos_basicos() b) then return; end if;
  return query
  select pl.id, pl.titulo, nullif(btrim(trim(pl.descripcion), '"'), ''), pl.cantidad, pl.unidad, coalesce(pl.id = v_linea, false)
  from pedido_lineas pl
  where pl.pedido_id = v_pedido and (v_linea is null or pl.id = v_linea)
  order by pl.orden;
end $$;
revoke execute on function public.venta_de_orden(uuid) from public, anon;
grant execute on function public.venta_de_orden(uuid) to authenticated;

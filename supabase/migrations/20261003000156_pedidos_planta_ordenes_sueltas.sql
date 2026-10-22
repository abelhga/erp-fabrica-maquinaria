-- Pedidos para la planta (151): lo que trae cada pedido aunque venga de la hoja.
--
-- En 15 de los 19 pedidos activos las órdenes se cargaron de la hoja de Luis sin partida
-- (la partida del pedido es un texto, "línea de envasado", y los equipos son las órdenes).
-- La vista solo mostraba órdenes colgadas de una partida con artículo: el pedido salía
-- vacío y decía "Solo componentes". Ahora trae las partidas de texto y, aparte, las órdenes
-- sueltas del pedido con su equipo.
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
      'ordenes', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'folio', x.folio, 'estado', x.estado, 'serie', x.numero_serie, 'avance', x.avance)
                                            order by x.folio) from ords x where x.pedido_linea_id = l.id), '[]'::jsonb))
      order by l.orden) as partidas,
    count(*) filter (where a.tipo in ('equipo', 'subensamble'))::int as equipos,
    coalesce(sum(case when a.tipo in ('equipo', 'subensamble')
      then greatest(ceil(l.cantidad)::int - (select count(*) from ords x where x.pedido_linea_id = l.id)::int, 0) end), 0)::int as sin_orden
  from lin l left join articulos a on a.id = l.articulo_id
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

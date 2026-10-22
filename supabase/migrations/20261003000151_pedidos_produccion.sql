-- =============================================================================
-- Los pedidos a la vista de la planta (sin montos) y equipos de stock que se venden.
--
-- 1. La gerencia de producción y la planta solo veían el pedido desde cada orden: no
--    sabían qué se vendió que nadie está fabricando todavía. v_pedidos_produccion (sobre
--    pedidos_basicos()) da cliente, vendedor, compromiso, estado, equipos y sus órdenes
--    con su avance, sin montos. El buscador de arriba también encuentra pedidos para la
--    planta y la lleva a esa pantalla.
-- 2. Una orden para stock es una orden sin pedido. Cuando ese equipo se vende, la gerencia
--    lo asigna a la partida (asignar_orden_stock) y el pedido ya no pide fabricar otro;
--    antes no había cómo y quedaba en un texto ("S091-P691"). ordenes_desde_pedido crea
--    solo las que faltan cuando una partida ya trae alguna de stock.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.buscar_global(q text)
 RETURNS TABLE(tipo text, id text, titulo text, subtitulo text, ruta text)
 LANGUAGE sql
 STABLE
AS $function$
  with t as (select sin_acentos(trim(q)) t)
  -- Ingeniería abre la ficha de costeo; quien vende (sin costeo), la del catálogo con su
  -- precio, y solo lo que se vende; los demás no reciben artículos.
  (select case a.tipo when 'equipo' then 'equipo' when 'subensamble' then 'subensamble' else 'componente' end,
          a.id::text, a.nombre, a.clave,
          case when (select puede('costeo', 1))
               then case when a.tipo in ('equipo', 'subensamble') then '/costeo/equipos/' else '/costeo/componentes/' end || a.id
               else '/catalogo?articulo=' || a.id end
   from articulos a, t where a.activo and sin_acentos(a.clave || ' ' || a.nombre) like '%' || replace(t.t, ' ', '%') || '%'
     and ((select puede('costeo', 1))
          or ((select ve_precios_venta()) and a.se_vende and a.tipo in ('equipo', 'componente')))
   order by similarity(sin_acentos(a.nombre), t.t) desc limit 8)
  union all
  (select 'cliente', c.id::text, c.nombre, coalesce(c.razon_social, c.ciudad), '/ventas/clientes/' || c.id
   from clientes c, t where sin_acentos(c.nombre || ' ' || coalesce(c.razon_social, '') || ' ' || coalesce(c.rfc, '')) like '%' || replace(t.t, ' ', '%') || '%'
   limit 6)
  union all
  (select 'cotizacion', c.id::text, c.folio || coalesce(' · ' || c.atencion, ''), to_char(c.total, 'FM$999,999,990.00'), '/ventas/cotizaciones/' || c.id
   from cotizaciones c, t where sin_acentos(c.folio || ' ' || coalesce(c.atencion, '') || ' ' || coalesce(c.empresa, '')) like '%' || replace(t.t, ' ', '%') || '%'
   order by c.fecha desc limit 5)
  union all
  -- Pedidos sin montos: la planta también los encuentra y cae en su pantalla de pedidos.
  (select 'pedido', p.id::text, p.folio, (select nombre from clientes where id = p.cliente_id),
          case when (select puede('ventas', 1)) then '/ventas/pedidos/' || p.id else '/produccion/pedidos?pedido=' || p.id end
   from pedidos_basicos() p cross join t
   where sin_acentos(p.folio || ' ' || coalesce(p.id_externo, '')) like '%' || t.t || '%'
   order by p.fecha desc limit 5)
  union all
  (select 'orden_produccion', o.id::text, o.folio || coalesce(' · ' || o.numero_serie, ''), (select nombre from articulos where id = o.articulo_id), '/produccion/ordenes/' || o.id
   from ordenes_produccion o, t where sin_acentos(o.folio || ' ' || coalesce(o.numero_serie, '')) like '%' || t.t || '%' limit 5)
  union all
  (select 'numero_serie', h.id::text, h.numero_serie, coalesce(h.cliente_nombre, '') || coalesce(' · ' || h.fecha_pedido::text, ''),
          '/produccion/seriales?serie=' || h.numero_serie
   from equipos_historicos h, t where sin_acentos(h.numero_serie) like '%' || t.t || '%' limit 5)
  union all
  (select 'proveedor', p.id::text, p.nombre, p.categoria, '/compras/proveedores/' || p.id
   from proveedores p, t where sin_acentos(p.nombre) like '%' || replace(t.t, ' ', '%') || '%' limit 5)
  union all
  (select 'orden_compra', o.id::text, o.folio, (select nombre from proveedores where id = o.proveedor_id), '/compras/ordenes/' || o.id
   from v_ordenes_compra o, t where sin_acentos(o.folio || ' ' || coalesce(o.factura_proveedor, '')) like '%' || t.t || '%' limit 5)
$function$;

-- -----------------------------------------------------------------------------
-- 1. Pedidos para la planta, sin montos
-- -----------------------------------------------------------------------------
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
      'cantidad', l.cantidad, 'unidad', l.unidad, 'fabrica', a.tipo in ('equipo', 'subensamble'),
      'tiene_lista', exists (select 1 from bom_lineas b where b.padre_id = a.id),
      'ordenes', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'folio', x.folio, 'estado', x.estado, 'serie', x.numero_serie, 'avance', x.avance)
                                            order by x.folio) from ords x where x.pedido_linea_id = l.id), '[]'::jsonb))
      order by l.orden) as partidas,
    count(*) filter (where a.tipo in ('equipo', 'subensamble'))::int as equipos,
    coalesce(sum(case when a.tipo in ('equipo', 'subensamble')
      then greatest(ceil(l.cantidad)::int - (select count(*) from ords x where x.pedido_linea_id = l.id)::int, 0) end), 0)::int as sin_orden
  from lin l join articulos a on a.id = l.articulo_id
  group by l.pedido_id
),
por_pedido as (
  select pedido_id, count(*)::int ordenes, count(*) filter (where estado in ('terminada', 'entregada'))::int terminadas, round(avg(avance))::int avance
  from ords group by pedido_id
)
select p.id, p.folio, p.cliente_id, c.nombre as cliente, p.vendedor_id, v.nombre as vendedor, p.canal, p.estado,
  p.fecha, p.fecha_compromiso, p.fecha_compromiso - hoy_planta() as dias_restantes, p.entregado_en, p.historico,
  coalesce(pt.partidas, '[]'::jsonb) as partidas, coalesce(pt.equipos, 0) as equipos, coalesce(pt.sin_orden, 0) as sin_orden,
  coalesce(pp.ordenes, 0) as ordenes, coalesce(pp.terminadas, 0) as ordenes_terminadas, pp.avance
from pedidos_basicos() p
left join clientes c on c.id = p.cliente_id
left join perfiles v on v.id = p.vendedor_id
left join part pt on pt.pedido_id = p.id
left join por_pedido pp on pp.pedido_id = p.id;

-- Si una partida ya tiene alguna orden (una que vino de stock), solo se crean las que faltan.
create or replace function public.ordenes_desde_pedido(p_pedido uuid) returns integer
language plpgsql security definer set search_path = public as $$
declare l record; v_n int := 0; v_hay int;
begin
  for l in select pl.* from pedido_lineas pl join articulos a on a.id = pl.articulo_id
           where pl.pedido_id = p_pedido and a.tipo in ('equipo', 'subensamble')
             and exists (select 1 from bom_lineas b where b.padre_id = a.id) loop
    select count(*) into v_hay from ordenes_produccion o where o.pedido_linea_id = l.id and o.estado <> 'cancelada';
    for i in 1 .. greatest(ceil(l.cantidad)::int - v_hay, 0) loop
      perform crear_orden_produccion(l.articulo_id, 1, l.id);
      v_n := v_n + 1;
    end loop;
  end loop;
  return v_n;
end $$;

-- -----------------------------------------------------------------------------
-- 2. Un equipo de stock que se vende
-- -----------------------------------------------------------------------------
create or replace function public.asignar_orden_stock(p_op uuid, p_linea uuid) returns void
language plpgsql security definer set search_path = public as $$
declare o ordenes_produccion; l pedido_lineas; v_ped pedidos; v_hay int;
begin
  if not puede('produccion', 3) then
    raise exception 'Asignar un equipo de stock a un pedido es de la gerencia de producción' using errcode = '42501';
  end if;
  select * into o from ordenes_produccion where id = p_op for update;
  select * into l from pedido_lineas where id = p_linea;
  if o.id is null or l.id is null then raise exception 'No existe la orden o la partida'; end if;
  select * into v_ped from pedidos where id = l.pedido_id for update;
  if o.pedido_id is not null then raise exception 'La orden % ya es de un pedido', o.folio; end if;
  if o.estado in ('entregada', 'cancelada') then raise exception 'La orden % ya está %', o.folio, o.estado; end if;
  if o.articulo_id <> l.articulo_id then raise exception 'La orden % es de otro equipo que la partida', o.folio; end if;
  if v_ped.estado in ('entregado', 'cancelado') then raise exception 'El pedido % ya está %', v_ped.folio, v_ped.estado; end if;
  select count(*) into v_hay from ordenes_produccion where pedido_linea_id = l.id and estado <> 'cancelada';
  if v_hay >= ceil(l.cantidad) then raise exception 'La partida ya tiene todas sus órdenes'; end if;

  update ordenes_produccion set pedido_id = v_ped.id, pedido_linea_id = l.id,
    fecha_compromiso = coalesce(v_ped.fecha_compromiso, fecha_compromiso) where id = o.id;
  insert into op_eventos (orden_id, tipo, nota) values (o.id, 'nota', format('Venía de stock: se asignó al pedido %s', v_ped.folio));
  -- El pedido queda en producción, o listo si con esto ya está todo terminado.
  update pedidos set estado = 'en_produccion' where id = v_ped.id and estado = 'confirmado';
  if not exists (select 1 from ordenes_produccion where pedido_id = v_ped.id and estado not in ('terminada', 'entregada', 'cancelada'))
     and not exists (select 1 from v_pedidos_produccion where id = v_ped.id and sin_orden > 0) then
    update pedidos set estado = 'listo' where id = v_ped.id and estado = 'en_produccion';
  end if;
end $$;
revoke execute on function public.asignar_orden_stock(uuid, uuid) from public, anon;
grant execute on function public.asignar_orden_stock(uuid, uuid) to authenticated;

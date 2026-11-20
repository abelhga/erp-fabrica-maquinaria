-- =============================================================================
-- «Crear órdenes desde pedido» avisa si ya hay equipos iguales para stock.
--
-- Por qué: el 20 de noviembre se vendieron los equipos de la Expo (PED-26-847), que ya estaban
-- fabricados como órdenes de stock (OP-11 a OP-16). Al mandar el pedido a producción se crearon
-- seis órdenes nuevas, con su serie y su lista de materiales, porque ordenes_desde_pedido no
-- miraba el stock: la única pista era el recuadro «De stock» del detalle del pedido en planta, y
-- quien entra por «Crear órdenes desde pedido» o por «Mandar a producción» nunca lo ve. Hubo que
-- regresar las nuevas a stock, cancelarlas a mano y devolver los consecutivos de serie.
--
-- Qué cambia:
--   · stock_para_pedido(pedido): las partidas a las que les falta orden y que tienen un equipo
--     igual para stock (sin pedido, sin entregar ni cancelar). Solo lee: cada quien ve lo que la
--     RLS le deja ver, y sin montos (sale de pedido_lineas_basicas, como la lista de la planta).
--   · ordenes_desde_pedido(pedido, fabricar_nuevos): si hay stock igual y nadie dijo «fabricar
--     nuevos», no crea nada y lo dice. La pantalla pregunta antes; el candado va aquí porque el
--     botón está en tres pantallas y una app instalada puede traer la versión vieja.
--     De paso revisa el permiso al entrar: antes lo revisaba crear_orden_produccion, ya adentro.
-- =============================================================================

create or replace function public.stock_para_pedido(p_pedido uuid) returns jsonb
language sql stable security invoker set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'linea_id', x.id, 'clave', x.clave, 'equipo', x.nombre, 'faltan', x.faltan, 'ordenes', x.ordenes) order by x.orden), '[]'::jsonb)
  from (
    select pl.id, pl.orden, a.clave, a.nombre,
      ceil(pl.cantidad)::int - (select count(*)::int from ordenes_produccion o
                                where o.pedido_linea_id = pl.id and o.estado <> 'cancelada') as faltan,
      (select jsonb_agg(jsonb_build_object('id', s.id, 'folio', s.folio, 'estado', s.estado, 'numero_serie', s.numero_serie) order by s.folio)
       from ordenes_produccion s
       where s.articulo_id = pl.articulo_id and s.pedido_id is null and s.estado not in ('entregada', 'cancelada')) as ordenes
    from pedido_lineas_basicas() pl
    join articulos a on a.id = pl.articulo_id
    where pl.pedido_id = p_pedido and a.tipo in ('equipo', 'subensamble')
      and exists (select 1 from bom_lineas b where b.padre_id = a.id)
  ) x
  where x.faltan > 0 and x.ordenes is not null
$$;
revoke execute on function public.stock_para_pedido(uuid) from public, anon;
grant execute on function public.stock_para_pedido(uuid) to authenticated;

-- Cambia la firma: se quita la de un argumento para que la API no tenga dos entre las que dudar.
-- Quien llama con solo el pedido (otras funciones, una pantalla vieja) cae en fabricar_nuevos = false.
drop function if exists public.ordenes_desde_pedido(uuid);

create or replace function public.ordenes_desde_pedido(p_pedido uuid, p_fabricar_nuevos boolean default false)
returns integer language plpgsql security definer set search_path = public as $$
declare l record; v_n int := 0; v_hay int; v_stock text;
begin
  if not puede('produccion', 2) then
    raise exception 'Sin permiso para crear órdenes de producción' using errcode = '42501';
  end if;
  if not coalesce(p_fabricar_nuevos, false) then
    select string_agg(format('%s (%s)', e->>'equipo',
             (select string_agg(o->>'folio', ', ') from jsonb_array_elements(e->'ordenes') o)), '; ')
      into v_stock
    from jsonb_array_elements(stock_para_pedido(p_pedido)) e;
    if v_stock is not null then
      raise exception 'Ya hay equipos iguales para stock: %. Asígnalos al pedido con «Usar» en Producción → Pedidos, o confirma que quieres fabricar nuevos.', v_stock;
    end if;
  end if;
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
revoke execute on function public.ordenes_desde_pedido(uuid, boolean) from public, anon;
grant execute on function public.ordenes_desde_pedido(uuid, boolean) to authenticated;

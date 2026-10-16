-- =============================================================================
-- Pedidos de la hoja que siguen en el taller.
--
-- Por qué: producción entra al ERP con lo que ya está fabricando. Esos pedidos se
-- cargan con sus órdenes de producción (estado, compromiso, serie y avance), pero
-- marcados como de la hoja (historico): el dinero sigue en el saldo de arranque del
-- cliente, así que no cuentan como venta nueva, no generan otra comisión y no
-- duplican la cobranza.
--
-- Un equipo con serie aparece dos veces si está en la hoja de seriales y ya tiene su
-- orden: la orden manda (trae el avance, la entrega y la garantía de verdad).
-- =============================================================================

create or replace view public.v_numeros_serie with (security_invoker = true) as
select 'erp'::text as origen, o.numero_serie, a.familia_serie as familia, o.id as orden_id, o.folio as orden_folio,
  a.nombre as equipo, p.cliente_id, c.nombre as cliente, p.id as pedido_id, p.folio as pedido, coalesce(p.fecha, o.creado_en::date) as fecha,
  case o.estado when 'planeada' then 'espera' when 'liberada' then 'espera' when 'en_proceso' then 'proceso'
    when 'terminada' then 'terminado' when 'entregada' then 'entregado' else 'cancelado' end as estado,
  (select string_agg(f.folio, ', ' order by f.fecha) from facturas f where f.pedido_id = p.id) as factura,
  (select v.nombre from perfiles v where v.id = p.vendedor_id) as vendedor,
  coalesce(o.entregada_en::date, o.fecha_compromiso) as entrega, null::text as ubicacion, null::text as contacto
from ordenes_produccion o
join articulos a on a.id = o.articulo_id
left join pedidos p on p.id = o.pedido_id
left join clientes c on c.id = p.cliente_id
where o.numero_serie is not null
union all
select 'hoja', h.numero_serie, h.familia, null, null, coalesce(h.descripcion, h.subcategoria, h.tipo_equipo), h.cliente_id,
  coalesce(c.nombre, h.cliente_nombre), null, h.pedido_hoja, h.fecha_pedido, h.estado, h.factura, h.vendedor,
  h.entrega_acordada, h.ubicacion, h.contacto
from equipos_historicos h
left join clientes c on c.id = h.cliente_id
where not exists (select 1 from ordenes_produccion o where o.numero_serie = h.numero_serie);

drop function if exists public.equipos_del_cliente(uuid);
create function public.equipos_del_cliente(p_cliente uuid)
returns table (orden_id uuid, folio text, numero_serie text, equipo text, pedido_id uuid, pedido_folio text,
               estado text, entregado date, garantia_vence date, historico boolean)
language sql stable security definer set search_path = public as $$
  select * from (
    select o.id, o.folio, o.numero_serie, a.nombre, o.pedido_id, p.folio, o.estado::text,
      coalesce(o.entregada_en, o.terminada_en)::date,
      (coalesce(o.entregada_en, o.terminada_en)::date
        + make_interval(months => coalesce((select (valor->>'meses_garantia')::int from configuracion where clave = 'servicio'), 12)))::date,
      false
    from ordenes_produccion o
    join pedidos p on p.id = o.pedido_id
    join articulos a on a.id = o.articulo_id
    where p.cliente_id = p_cliente and o.estado <> 'cancelada'
    union all
    select null, null, h.numero_serie, coalesce(h.descripcion, h.subcategoria, h.tipo_equipo, h.numero_serie), null, h.pedido_hoja, h.estado,
      coalesce(h.entrega_acordada, h.fecha_pedido), null, true
    from equipos_historicos h
    where h.cliente_id = p_cliente and coalesce(h.estado, '') <> 'cancelado'
      and not exists (select 1 from ordenes_produccion o where o.numero_serie = h.numero_serie)
  ) x
  where puede('servicio', 1) and (ve_todos_los_servicios() or cliente_visible(p_cliente))
  order by 8 desc nulls last   -- entregado
$$;
revoke execute on function public.equipos_del_cliente(uuid) from public, anon;
grant execute on function public.equipos_del_cliente(uuid) to authenticated;

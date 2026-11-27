-- =============================================================================
-- «Por atender» sin sesión ve las órdenes de compra en camino.
--
-- Por qué: el aviso de las 8:37 y la revisión nocturna corren sin nadie conectado. _pedidos_por_surtir
-- (321) leía lo que viene en camino de v_oc_lineas, que filtra por puede(): sin sesión no regresa
-- ningún renglón, así que todo lo ya pedido salía como «Comprar lo que falta». Con la sesión de
-- dirección el PED-26-803 (aerovibrador) y el PED-26-855 (envasadora) estaban bien, «ya pedido»; en
-- el aviso habrían salido como pendientes de compras. Lo en camino se lee de oc_lineas directo (la
-- función ya es security definer y no devuelve costos).
-- =============================================================================

do $$
declare v_def text := pg_get_functiondef('public._pedidos_por_surtir(boolean, uuid)'::regprocedure);
  v_ancla text := 'coalesce((select sum(ol.pendiente) from v_oc_lineas ol join ordenes_compra o on o.id = ol.orden_compra_id
                where ol.articulo_id = l.articulo_id and o.estado in (''enviada'', ''parcial'') and ol.pendiente > 0), 0) en_camino';
begin
  if v_def not like '%v_oc_lineas%' then return; end if;
  if position(v_ancla in v_def) = 0 then raise exception '_pedidos_por_surtir ya no es la que se conocía'; end if;
  execute replace(v_def, v_ancla,
    'coalesce((select sum(greatest(ol.cantidad - ol.recibido, 0)) from oc_lineas ol join ordenes_compra o on o.id = ol.orden_compra_id
                where ol.articulo_id = l.articulo_id and o.estado in (''enviada'', ''parcial'') and ol.cantidad > ol.recibido), 0) en_camino');
end $$;

-- =============================================================================
-- Regresar a stock una orden que ya es de un pedido.
--
-- «Usar OP-…» (asignar_orden_stock, 151) liga una orden de stock a un pedido con un clic, y no
-- había forma de soltarla: si la gerencia elegía la orden equivocada (en PED-26-810 hay dos THOR
-- que sirven) se quedaba así. Peor: cuando el cliente cancela, el pedido se cancela pero sus
-- órdenes siguen ligadas a él; el equipo, aunque esté casi terminado, deja de salir como stock y
-- nadie puede ofrecérselo a otro cliente. La única salida era cancelar la orden y perderla.
--
-- Regresar a stock suelta la orden: vuelve a «Para stock» con su avance, su serie y el material
-- que ya se le surtió, y la partida del pedido vuelve a «Sin orden». Es de la gerencia de
-- producción (como asignar), con motivo, y queda en la historia de la orden.
-- =============================================================================

create or replace function public.regresar_orden_a_stock(p_op uuid, p_motivo text) returns void
language plpgsql security definer set search_path = public as $$
declare o ordenes_produccion; v_ped pedidos;
begin
  if not puede('produccion', 3) then
    raise exception 'Regresar una orden a stock es de la gerencia de producción' using errcode = '42501';
  end if;
  select * into o from ordenes_produccion where id = p_op for update;
  if o.id is null then raise exception 'No existe la orden'; end if;
  if o.pedido_id is null then raise exception 'La orden % ya es para stock', o.folio; end if;
  if o.estado in ('entregada', 'cancelada') then raise exception 'La orden % ya está %', o.folio, o.estado; end if;
  if coalesce(length(trim(p_motivo)), 0) < 5 then raise exception 'Escribe por qué regresa a stock'; end if;
  select * into v_ped from pedidos where id = o.pedido_id for update;
  -- Un pedido entregado ya se llevó su equipo: soltar la orden dejaría la entrega sin equipo.
  if v_ped.estado = 'entregado' then raise exception 'El pedido % ya se entregó', v_ped.folio; end if;

  -- Sin fecha compromiso: era la del pedido y para stock no hay nada prometido (con ella, la
  -- orden saldría atrasada sin que nadie la espere).
  update ordenes_produccion set pedido_id = null, pedido_linea_id = null, fecha_compromiso = null where id = o.id;
  insert into op_eventos (orden_id, tipo, nota)
  values (o.id, 'nota', format('Regresó a stock (era del pedido %s): %s', v_ped.folio, trim(p_motivo)));
  -- Al pedido le vuelve a faltar ese equipo: si estaba listo para entregar, ya no lo está.
  update pedidos set estado = 'en_produccion' where id = v_ped.id and estado = 'listo';
end $$;
revoke execute on function public.regresar_orden_a_stock(uuid, text) from public, anon;
grant execute on function public.regresar_orden_a_stock(uuid, text) to authenticated;

-- El detalle de la orden avisa cuando su pedido se canceló, para regresarla a stock en lugar de
-- seguir fabricando para nadie. La planta no lee pedidos: el estado viaja aquí, sin montos, con la
-- misma regla que pedido_de_orden (que no se toca porque la usan las vistas del tablero).
create or replace function public.estado_pedido_de_orden(p_pedido uuid)
returns table (estado public.estado_pedido, motivo_cancelacion text)
language sql stable security definer set search_path = public as $$
  select p.estado, p.motivo_cancelacion from pedidos p
  where p.id = p_pedido and (puede('produccion', 1) or puede('inventario', 1))
    and exists (select 1 from ordenes_produccion o where o.pedido_id = p.id)
$$;
revoke execute on function public.estado_pedido_de_orden(uuid) from public, anon;
grant execute on function public.estado_pedido_de_orden(uuid) to authenticated;

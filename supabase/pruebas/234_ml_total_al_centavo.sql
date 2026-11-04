-- Ventas de ML: el total del pedido es lo cobrado al centavo (paquete o pieza), ligar con otras piezas no
-- cambia el dinero, un pedido normal sigue igual y un vendedor no puede poner el precio del canal.
do $$
declare v_ven uuid; v_cli uuid; v_ml uuid; v_norm uuid; v_art uuid; v_l1 uuid; v_l2 uuid; v_ok boolean; r pedidos;
begin
  v_ven := pg_temp.usuario('ven234@hegamex.com', '{ventas}');
  insert into articulos (clave, tipo, nombre) values ('T234-CAN', 'componente', 'T234 Cangilón') returning id into v_art;
  insert into clientes (nombre, vendedor_id) values ('Cliente 234', v_ven) returning id into v_cli;

  -- La conexión con ML (sin sesión) registra 2 paquetes de 24 a $7,250 y 1 pieza a $389.
  insert into pedidos (cliente_id, canal, vendedor_id) values (v_cli, 'mercadolibre', v_ven) returning id into v_ml;
  insert into pedido_lineas (pedido_id, orden, articulo_id, titulo, cantidad, precio_unitario, precio_con_iva, piezas_por_venta)
  values (v_ml, 1, v_art, 'Pack 24 cangilones', 48, round(7250 / 1.16 / 24, 2), 7250, 24) returning id into v_l1;
  insert into pedido_lineas (pedido_id, orden, titulo, cantidad, precio_unitario, precio_con_iva, piezas_por_venta)
  values (v_ml, 2, 'Polea', 1, round(389 / 1.16, 2), 389, 1) returning id into v_l2;
  select * into r from pedidos where id = v_ml;
  assert r.total = 14889, format('total %s, debía ser 14,889 (14,500 + 389)', r.total);
  assert r.subtotal + r.iva = r.total, 'subtotal + IVA no da el total';

  -- Ligarla con otras piezas (desligar el paquete: 48 → 2) no cambia ventas ni dinero.
  update pedido_lineas set cantidad = 2, precio_unitario = 6250 where id = v_l1;
  assert (select piezas_por_venta from pedido_lineas where id = v_l1) = 1, 'no ajustó las piezas por venta';
  assert (select total from pedidos where id = v_ml) = 14889, 'cambió el total al cambiar las piezas';

  -- Un pedido normal sigue con subtotal más IVA.
  insert into pedidos (cliente_id, canal, vendedor_id) values (v_cli, 'directo', v_ven) returning id into v_norm;
  insert into pedido_lineas (pedido_id, orden, titulo, cantidad, precio_unitario) values (v_norm, 1, 'Polea', 3, 33.33);
  assert (select total from pedidos where id = v_norm) = 115.99, format('pedido normal: %s', (select total from pedidos where id = v_norm));

  -- Un vendedor no puede poner ni cambiar el precio del canal (con eso movería el total).
  perform pg_temp.como(v_ven);
  begin
    insert into pedido_lineas (pedido_id, orden, titulo, cantidad, precio_unitario, precio_con_iva) values (v_norm, 2, 'X', 1, 100, 1);
    v_ok := true;
  exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'un vendedor puso el precio del canal';
  begin
    update pedido_lineas set precio_con_iva = 1 where id = v_l2; v_ok := found;
  exception when insufficient_privilege then v_ok := false; end;
  perform pg_temp.como_postgres();
  assert (select precio_con_iva from pedido_lineas where id = v_l2) = 389, 'un vendedor cambió el precio del canal';
end $$;

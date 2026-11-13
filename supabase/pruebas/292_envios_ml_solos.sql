-- Envíos de ML que avanzan con lo que reporta ML: dejado en paquetería → enviado con su salida de
-- inventario; entregado → entregado y el pedido entregado; venta cancelada → envío cancelado; y lo que
-- ya salió no se cancela ni regresa.
do $$
declare v_art uuid; v_pb int; v_cli uuid; p1 uuid; p2 uuid; e1 uuid; e2 uuid; l1 uuid; l2 uuid;
begin
  select id into v_pb from almacenes where nombre = 'Planta Baja';
  insert into articulos (clave, tipo, nombre, unidad) values ('C292', 'componente', 'Catarina 292', 'pieza') returning id into v_art;
  insert into movimientos_inventario (tipo, articulo_id, almacen_id, cantidad, motivo) values ('inicial', v_art, v_pb, 10, 'T292');
  insert into clientes (nombre) values ('Público ML 292') returning id into v_cli;
  insert into pedidos (cliente_id, canal, estado, fecha) values (v_cli, 'mercadolibre', 'confirmado', hoy_mx()) returning id into p1;
  insert into pedidos (cliente_id, canal, estado, fecha) values (v_cli, 'mercadolibre', 'confirmado', hoy_mx()) returning id into p2;
  insert into pedido_lineas (pedido_id, articulo_id, titulo, cantidad, precio_unitario) values (p1, v_art, 'Catarina', 2, 100) returning id into l1;
  insert into pedido_lineas (pedido_id, articulo_id, titulo, cantidad, precio_unitario) values (p2, v_art, 'Catarina', 1, 100) returning id into l2;
  insert into envios (pedido_id, tipo, estado, numero_guia) values (p1, 'paqueteria', 'guia_lista', 'MEL292A') returning id into e1;
  insert into envios (pedido_id, tipo, estado, numero_guia) values (p2, 'paqueteria', 'guia_lista', 'MEL292B') returning id into e2;
  insert into envio_lineas (envio_id, orden, pedido_linea_id, articulo_id, descripcion, cantidad, almacen_id) values (e1, 1, l1, v_art, 'Catarina', 2, v_pb);
  insert into envio_lineas (envio_id, orden, pedido_linea_id, articulo_id, descripcion, cantidad, almacen_id) values (e2, 1, l2, v_art, 'Catarina', 1, v_pb);
  update envios set estado = 'empacado', empacado_en = now() where id = e1;
  insert into ml_ventas (order_id, pedido_id, estado, envio_ml) values ('292-1', p1, 'paid', 'ready_to_ship'), ('292-2', p2, 'paid', 'ready_to_ship');
  assert (select estado from envios where id = e1) = 'empacado', 'se movió sin que ML dijera nada';

  -- ML: dejado en la paquetería → enviado, con salida de inventario.
  update ml_ventas set envio_sub = 'dropped_off' where order_id = '292-1';
  assert (select estado from envios where id = e1) = 'enviado', 'no quedó enviado';
  assert (select cantidad from existencias where articulo_id = v_art and almacen_id = v_pb) = 8, 'no descontó el inventario';
  assert exists (select 1 from eventos_envio where envio_id = e1 and tipo = 'enviado' and nota like 'Mercado Libre lo reporta dejado en la paquetería%'), 'la historia no dice que fue ML';

  -- ML: entregado → entregado y el pedido entregado. Otra actualización no vuelve a descontar.
  update ml_ventas set envio_ml = 'delivered', envio_sub = null where order_id = '292-1';
  assert (select estado from envios where id = e1) = 'entregado', 'no quedó entregado';
  assert (select estado from pedidos where id = p1) = 'entregado', 'el pedido no quedó entregado';
  update ml_ventas set nota = 'otra' , envio_sub = 'x' where order_id = '292-1';
  assert (select cantidad from existencias where articulo_id = v_art and almacen_id = v_pb) = 8, 'descontó dos veces';

  -- ML cancela la otra venta → su envío (que no salió) se cancela, sin tocar inventario.
  update ml_ventas set estado = 'cancelled', envio_ml = 'cancelled' where order_id = '292-2';
  assert (select estado from envios where id = e2) = 'cancelado', 'no se canceló el envío';
  assert (select guia_reembolsada from envios where id = e2), 'la guía no quedó como reembolsada';
  assert (select cantidad from existencias where articulo_id = v_art and almacen_id = v_pb) = 8, 'cancelar movió el inventario';
end $$;

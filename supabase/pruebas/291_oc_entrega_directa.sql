-- Entrega directa: compras liga la partida de la OC al pedido; «Recibir» ya no la mete al almacén;
-- «Entregado directo» recibe la OC y entrega el pedido en un paso, sin cambiar el inventario. Un
-- vendedor no marca ni registra entregas directas.
do $$
declare v_com uuid; v_ven uuid; v_cli uuid; v_prov uuid; v_art uuid; v_oc uuid; v_l uuid; v_ped uuid; v_pl uuid;
        v_antes numeric; v_ok boolean; v_msg text; v_pb int;
begin
  v_com := pg_temp.usuario('com291@hegamex.com', '{compras}');
  v_ven := pg_temp.usuario('ven291@hegamex.com', '{ventas}');
  select id into v_pb from almacenes where nombre = 'Planta Baja';
  insert into articulos (clave, tipo, nombre, unidad) values ('B291', 'componente', 'Banda 2 capas 8" 291', 'metro') returning id into v_art;
  insert into movimientos_inventario (tipo, articulo_id, almacen_id, cantidad, motivo) values ('inicial', v_art, v_pb, 3, 'T291');
  insert into proveedores (nombre, dias_entrega) values ('Transbelt 291', 3) returning id into v_prov;
  insert into clientes (nombre, vendedor_id) values ('Cliente 291', v_ven) returning id into v_cli;
  insert into pedidos (cliente_id, vendedor_id, canal, estado, fecha, fecha_compromiso)
  values (v_cli, v_ven, 'directo', 'confirmado', hoy_mx(), hoy_mx() + 3) returning id into v_ped;
  insert into pedido_lineas (pedido_id, articulo_id, titulo, cantidad, precio_unitario) values (v_ped, v_art, 'Banda 8"', 10, 300) returning id into v_pl;
  insert into ordenes_compra (proveedor_id, estado) values (v_prov, 'enviada') returning id into v_oc;
  insert into oc_lineas (orden_compra_id, articulo_id, cantidad, costo_unitario) values (v_oc, v_art, 10, 120) returning id into v_l;
  v_antes := (select sum(cantidad) from existencias where articulo_id = v_art);

  -- Un vendedor no la marca.
  perform pg_temp.como(v_ven);
  begin perform oc_linea_directa(v_l, v_pl); v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'un vendedor marcó entrega directa';

  -- Compras la liga al pedido; aparece en la partida de la OC.
  perform pg_temp.como(v_com);
  assert exists (select 1 from pedidos_para_directo(v_art) where pedido_linea_id = v_pl), 'no ofrece el pedido';
  perform oc_linea_directa(v_l, v_pl);
  assert (select directo_a like '% · Cliente 291' from v_oc_lineas where id = v_l), 'la partida no dice a quién va';

  -- «Recibir» no la mete al almacén.
  begin perform recibir_orden_compra(v_oc, jsonb_build_array(jsonb_build_object('linea_id', v_l, 'cantidad', 10, 'almacen_id', v_pb)));
        v_ok := true; exception when check_violation then v_ok := false; v_msg := sqlerrm; end;
  assert not v_ok and v_msg like '%Entregado directo%', 'recibió una partida directa al almacén';

  -- El vendedor no registra la entrega directa (no recibe compras).
  perform pg_temp.como(v_ven);
  begin perform entregado_directo(v_l, 10, 'Juan del cliente'); v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'el vendedor registró la entrega directa';

  -- Compras la registra: OC recibida, pedido entregado, inventario igual, costo ligado al pedido.
  perform pg_temp.como(v_com);
  begin perform entregado_directo(v_l, 11, 'Juan del cliente'); v_ok := true; exception when raise_exception then v_ok := false; end;
  assert not v_ok, 'entregó más de lo pedido';
  perform entregado_directo(v_l, 10, 'Juan del cliente', 'Guía Transbelt 123');
  perform pg_temp.como_postgres();
  assert (select estado from ordenes_compra where id = v_oc) = 'recibida', 'la OC no quedó recibida';
  assert (select estado from pedidos where id = v_ped) = 'entregado', 'el pedido no quedó entregado';
  assert (select sum(cantidad) from existencias where articulo_id = v_art) = v_antes, 'cambió el inventario';
  assert (select nota from pedido_salidas where pedido_id = v_ped) like 'Directo del proveedor (OC %) · Guía Transbelt 123', 'la entrega no dice que fue directa';
  assert (select costo_unitario from movimientos_inventario where pedido_id = v_ped and tipo = 'salida_venta') = 120, 'la salida no lleva el costo de la compra';
end $$;

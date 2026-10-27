-- Una orden asignada a un pedido (por error, o porque el cliente canceló) regresa a stock: la
-- gerencia la suelta con motivo, el pedido vuelve a pedirla y se le puede asignar a otro.
do $$
declare v_vend uuid; v_gp uuid; v_taller uuid; v_cli uuid; v_eq uuid; v_mp uuid; v_ped uuid; v_lin uuid; v_ped2 uuid; v_lin2 uuid;
  v_op uuid; v_entregada uuid; v_ok boolean; r record;
begin
  v_vend := pg_temp.usuario('vend178@hegamex.com', '{ventas}');
  v_gp := pg_temp.usuario('gp178@hegamex.com', '{gerente_produccion}');
  v_taller := pg_temp.usuario('taller178@hegamex.com', '{produccion}');
  insert into clientes (nombre, vendedor_id) values ('Cliente 178', v_vend) returning id into v_cli;
  insert into articulos (clave, tipo, nombre) values ('T178-THOR', 'equipo', 'Silo 178') returning id into v_eq;
  insert into articulos (clave, tipo, nombre) values ('T178-TUB', 'materia_prima', 'Tubo 178') returning id into v_mp;
  insert into bom_lineas (padre_id, hijo_id, cantidad) values (v_eq, v_mp, 3);
  insert into pedidos (cliente_id, vendedor_id, canal, fecha_compromiso) values (v_cli, v_vend, 'directo', '2026-12-07') returning id into v_ped;
  insert into pedido_lineas (pedido_id, articulo_id, titulo, cantidad, precio_unitario) values (v_ped, v_eq, 'Silo 178', 1, 1000) returning id into v_lin;

  -- Una orden de stock terminada se asigna: el pedido queda listo con fecha del pedido.
  perform pg_temp.como(v_gp);
  v_op := crear_orden_produccion(v_eq, 1);
  perform pg_temp.como_postgres();
  update ordenes_produccion set estado = 'terminada', terminada_en = now() where id = v_op;
  perform pg_temp.como(v_gp);
  perform asignar_orden_stock(v_op, v_lin);
  perform pg_temp.como_postgres();
  assert (select estado from pedidos where id = v_ped) = 'listo', 'el pedido no quedó listo con el equipo de stock';

  -- El taller, ventas y la gerencia sin motivo, no.
  perform pg_temp.como(v_taller);
  begin perform regresar_orden_a_stock(v_op, 'Me equivoqué de orden'); v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'el taller regresó una orden a stock';
  perform pg_temp.como(v_vend);
  begin perform regresar_orden_a_stock(v_op, 'Me equivoqué de orden'); v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'ventas regresó una orden a stock';
  perform pg_temp.como(v_gp);
  begin perform regresar_orden_a_stock(v_op, ' '); v_ok := true; exception when raise_exception then v_ok := false; end;
  assert not v_ok, 'regresó a stock sin motivo';

  -- La gerencia la regresa: sin pedido, sin la fecha del pedido, con su historia; el pedido ya no está listo.
  perform regresar_orden_a_stock(v_op, 'Se eligió el THOR equivocado');
  perform pg_temp.como_postgres();
  select * into r from ordenes_produccion where id = v_op;
  assert r.pedido_id is null and r.pedido_linea_id is null and r.fecha_compromiso is null and r.estado = 'terminada',
    format('la orden no quedó para stock: %s', row_to_json(r));
  assert exists (select 1 from op_eventos where orden_id = v_op and nota like 'Regresó a stock (era del pedido %): Se eligió el THOR equivocado'),
    'la historia no dice que regresó a stock';
  assert (select estado from pedidos where id = v_ped) = 'en_produccion', 'el pedido siguió listo sin su equipo';
  -- Ya para stock, no se regresa otra vez.
  perform pg_temp.como(v_gp);
  assert (select sin_orden from v_pedidos_produccion where id = v_ped) = 1, 'la partida no volvió a «sin orden»';
  begin perform regresar_orden_a_stock(v_op, 'Otra vez a stock'); v_ok := true; exception when raise_exception then v_ok := false; end;
  assert not v_ok, 'regresó a stock una orden que ya era de stock';

  -- El cliente cancela: la orden sigue ligada, el detalle lo sabe, y se regresa para venderla a otro.
  perform asignar_orden_stock(v_op, v_lin);
  perform pg_temp.como_postgres();
  update pedidos set estado = 'cancelado', motivo_cancelacion = 'El cliente ya no lo quiere' where id = v_ped;
  perform pg_temp.como(v_taller);
  select * into r from estado_pedido_de_orden(v_ped);
  assert r.estado = 'cancelado' and r.motivo_cancelacion = 'El cliente ya no lo quiere', 'la planta no se entera de que el pedido se canceló';
  perform pg_temp.como(v_gp);
  perform regresar_orden_a_stock(v_op, 'El cliente canceló el pedido');
  perform pg_temp.como_postgres();
  assert (select estado from pedidos where id = v_ped) = 'cancelado', 'regresar a stock movió un pedido cancelado';
  insert into pedidos (cliente_id, vendedor_id, canal) values (v_cli, v_vend, 'directo') returning id into v_ped2;
  insert into pedido_lineas (pedido_id, articulo_id, titulo, cantidad, precio_unitario) values (v_ped2, v_eq, 'Silo 178', 1, 1000) returning id into v_lin2;
  perform pg_temp.como(v_gp);
  perform asignar_orden_stock(v_op, v_lin2);
  perform pg_temp.como_postgres();
  assert (select pedido_id from ordenes_produccion where id = v_op) = v_ped2, 'no se pudo vender el equipo a otro cliente';

  -- Una orden entregada no regresa.
  perform pg_temp.como(v_gp);
  v_entregada := crear_orden_produccion(v_eq, 1, v_lin2);
  perform pg_temp.como_postgres();
  update ordenes_produccion set estado = 'entregada' where id = v_entregada;
  perform pg_temp.como(v_gp);
  begin perform regresar_orden_a_stock(v_entregada, 'Ya se entregó, pero a ver'); v_ok := true; exception when raise_exception then v_ok := false; end;
  assert not v_ok, 'regresó a stock una orden entregada';
  perform pg_temp.como_postgres();
end $$;

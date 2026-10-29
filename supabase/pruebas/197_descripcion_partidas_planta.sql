-- La planta ve la descripción de lo que se le vendió al cliente (sin precios): en Pedidos y en
-- el detalle de la orden. Quien no ve el pedido, tampoco su descripción.
do $$
declare v_vend uuid; v_otro_vend uuid; v_taller uuid; v_rh uuid; v_cli uuid; v_eq uuid; v_ped uuid; v_lin uuid; v_op uuid; v_ok boolean;
  v_desc text := E'• Fabricada en acero al carbón\n• 8" de diámetro\n• Motor de 11 kW a 220 volts';
begin
  v_vend := pg_temp.usuario('vend197@hegamex.com', '{ventas}');
  v_otro_vend := pg_temp.usuario('otro197@hegamex.com', '{ventas}');
  v_taller := pg_temp.usuario('taller197@hegamex.com', '{produccion}');
  v_rh := pg_temp.usuario('rh197@hegamex.com', '{rrhh}');
  insert into clientes (nombre, vendedor_id) values ('Cliente 197', v_vend) returning id into v_cli;
  insert into articulos (clave, tipo, nombre) values ('T197-HEL', 'equipo', 'Helicoidal 197') returning id into v_eq;
  perform pg_temp.como(v_vend);
  insert into pedidos (cliente_id, canal) values (v_cli, 'directo') returning id into v_ped;
  perform pg_temp.como_postgres();
  insert into pedido_lineas (pedido_id, articulo_id, titulo, descripcion, cantidad, precio_unitario)
  values (v_ped, v_eq, 'Helicoidal de descarga de 8" x 6 metros', v_desc, 1, 98765) returning id into v_lin;
  insert into ordenes_produccion (articulo_id, cantidad, estado, pedido_id, pedido_linea_id) values (v_eq, 1, 'liberada', v_ped, v_lin) returning id into v_op;

  -- 1. El taller la ve en Pedidos y en la orden, sin el precio.
  perform pg_temp.como(v_taller);
  assert (select p->>'descripcion' from v_pedidos_produccion v, jsonb_array_elements(v.partidas) p where v.id = v_ped) = v_desc,
    'la planta no ve la descripción en Pedidos';
  assert (select partidas::text not like '%98765%' from v_pedidos_produccion where id = v_ped), 'la planta vio el precio';
  assert (select descripcion = v_desc and de_la_orden from venta_de_orden(v_op)), 'la orden no trae lo que se vendió';

  -- 2. Una orden de la hoja, sin partida: trae todas las partidas de su pedido.
  perform pg_temp.como_postgres();
  insert into pedido_lineas (pedido_id, titulo, descripcion, cantidad, precio_unitario) values (v_ped, 'Línea de envasado', 'Incluye tolva y báscula', 1, 5000);
  update ordenes_produccion set pedido_linea_id = null where id = v_op;
  perform pg_temp.como(v_taller);
  assert (select count(*) from venta_de_orden(v_op)) = 2 and not (select bool_or(de_la_orden) from venta_de_orden(v_op)),
    'una orden sin partida no trae las del pedido';

  -- 3. Quien no ve el pedido no ve su descripción; RRHH ni siquiera pregunta.
  perform pg_temp.como(v_otro_vend);
  assert not exists (select 1 from venta_de_orden(v_op)), 'otro vendedor vio lo vendido en un pedido ajeno';
  perform pg_temp.como(v_rh);
  begin perform venta_de_orden(v_op); v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'RRHH vio lo vendido de una orden';
  perform pg_temp.como_postgres();
end $$;

-- Los servicios no van en la entrega: la hoja dice cuáles son, el pedido queda entregado cuando
-- sale lo físico (aunque el servicio sea una partida escrita a mano), un pedido que es solo
-- servicio se cierra sin firma, y una partida física escrita a mano sí detiene el «entregado».
do $$
declare v_alm uuid; v_ven uuid; v_otro uuid; v_cli uuid; v_art uuid; v_srv uuid;
  p uuid; l_eq uuid; l_ins uuid; l_txt uuid; p2 uuid; p3 uuid; l3 uuid; s uuid; h jsonb; v_ok boolean;
begin
  v_alm := pg_temp.usuario('alm311@hegamex.com', '{almacen}');
  v_ven := pg_temp.usuario('ven311@hegamex.com', '{ventas}');
  v_otro := pg_temp.usuario('otro311@hegamex.com', '{ventas}');
  insert into clientes (nombre, vendedor_id) values ('Cliente 311', v_ven) returning id into v_cli;
  insert into articulos (clave, tipo, nombre, unidad, controla_inventario) values ('T311-POL', 'componente', 'Polea 311', 'pieza', false) returning id into v_art;
  insert into articulos (clave, tipo, nombre, unidad) values ('T311-PAQ', 'servicio', 'Servicio de paquetería 311', 'servicio') returning id into v_srv;

  -- 1. Una polea, su paquetería (del catálogo), una instalación escrita a mano y una pieza escrita a mano.
  insert into pedidos (cliente_id, vendedor_id, estado) values (v_cli, v_ven, 'listo') returning id into p;
  insert into pedido_lineas (pedido_id, articulo_id, titulo, cantidad, precio_unitario, orden) values (p, v_art, 'Polea 311', 2, 500, 1) returning id into l_eq;
  insert into pedido_lineas (pedido_id, articulo_id, titulo, cantidad, precio_unitario, orden) values (p, v_srv, 'Servicio de paquetería 311', 1, 300, 2);
  insert into pedido_lineas (pedido_id, titulo, cantidad, precio_unitario, orden) values (p, 'SERVICIO DE INTALACION, PUESTA EN MARCHA', 1, 9000, 3) returning id into l_ins;
  insert into pedido_lineas (pedido_id, titulo, cantidad, precio_unitario, orden) values (p, 'Base especial para polea', 1, 800, 4) returning id into l_txt;

  perform pg_temp.como(v_alm);
  h := hoja_salida(p);
  assert not (h->>'solo_servicios')::boolean, 'dijo que el pedido es solo de servicios';
  assert (select array_agg((x->>'servicio')::boolean order by x->>'titulo') from jsonb_array_elements(h->'partidas') x) = array[false, false, true, true],
    format('qué partidas son servicio: %s', (select jsonb_agg(jsonb_build_array(x->>'titulo', x->>'servicio')) from jsonb_array_elements(h->'partidas') x));

  -- Sale la polea pero no la base: el pedido NO queda entregado (la base es física aunque no sea del catálogo).
  perform entregar_pedido(p, 'Juan Cliente', null, null, jsonb_build_array(jsonb_build_object('id', l_eq, 'cantidad', 2)));
  perform pg_temp.como_postgres();
  assert (select estado from pedidos where id = p) <> 'entregado', 'quedó entregado faltando una pieza física escrita a mano';
  -- Sale la base: ahora sí, y los servicios se dan por hechos sin que nadie los haya «entregado».
  perform pg_temp.como(v_alm);
  perform entregar_pedido(p, 'Juan Cliente', null, null, jsonb_build_array(jsonb_build_object('id', l_txt, 'cantidad', 1)));
  perform pg_temp.como_postgres();
  assert (select estado from pedidos where id = p) = 'entregado', 'no quedó entregado al salir lo físico';
  assert (select bool_and(cantidad_entregada = cantidad) from pedido_lineas where pedido_id = p), 'los servicios no quedaron por hechos';

  -- 2. Un pedido que es solo servicio: lo cierra el vendedor sin firma; otro vendedor no.
  insert into pedidos (cliente_id, vendedor_id, estado) values (v_cli, v_ven, 'confirmado') returning id into p2;
  insert into pedido_lineas (pedido_id, titulo, cantidad, precio_unitario) values (p2, 'Servicio de barrenación de rondana', 1, 1500);
  perform pg_temp.como(v_otro);
  begin perform entregar_pedido(p2); v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'otro vendedor cerró un servicio que no es suyo';
  perform pg_temp.como(v_ven);
  assert (hoja_salida(p2)->>'solo_servicios')::boolean, 'no reconoció un pedido solo de servicios';
  s := entregar_pedido(p2);
  perform pg_temp.como_postgres();
  assert (select estado from pedidos where id = p2) = 'entregado', 'el servicio no quedó cerrado';
  assert (select recibio from pedido_salidas where id = s) = 'Servicio realizado', 'no anotó que fue un servicio';

  -- 3. Lo físico sigue pidiendo quién recibió.
  insert into pedidos (cliente_id, vendedor_id, estado) values (v_cli, v_ven, 'listo') returning id into p3;
  insert into pedido_lineas (pedido_id, articulo_id, titulo, cantidad, precio_unitario) values (p3, v_art, 'Polea 311', 1, 500) returning id into l3;
  perform pg_temp.como(v_alm);
  begin perform entregar_pedido(p3); v_ok := true; exception when check_violation then v_ok := false; end;
  assert not v_ok, 'entregó algo físico sin decir quién recibió';
end $$;

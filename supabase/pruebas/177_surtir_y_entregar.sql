-- Almacén: surtir pide quién recibe; lo entregado con la hoja se registra sin descontar dos
-- veces; la cola de lo que hay que preparar; entregar un pedido por partes con su salida de
-- inventario, y deshacer la última entrega regresa todo.
do $$
declare v_alm uuid; v_ven uuid; v_gp uuid; v_pb int; v_tubo uuid; v_chum uuid; v_eq uuid; v_cli uuid; v_ped uuid;
  v_op uuid; v_op_nueva uuid; l_tubo uuid; l_chum uuid; l_eq uuid; s1 uuid; s2 uuid; v_op_eq uuid; h jsonb; v_ok boolean;
begin
  v_alm := pg_temp.usuario('alm177@hegamex.com', '{almacen}');
  v_ven := pg_temp.usuario('ven177@hegamex.com', '{ventas}');
  v_gp := pg_temp.usuario('gp177@hegamex.com', '{gerente_produccion}');
  select id into v_pb from almacenes where nombre = 'Planta Baja';
  insert into articulos (clave, tipo, nombre, unidad) values ('P177-TUBO', 'materia_prima', 'Tubo 177', 'metro') returning id into v_tubo;
  insert into articulos (clave, tipo, nombre, unidad) values ('P177-CHUM', 'componente', 'Chumacera 177', 'pieza') returning id into v_chum;
  insert into articulos (clave, tipo, nombre) values ('P177-EQ', 'equipo', 'Bazuca 177') returning id into v_eq;
  insert into movimientos_inventario (tipo, articulo_id, almacen_id, cantidad) values ('inicial', v_tubo, v_pb, 20), ('inicial', v_chum, v_pb, 2);

  -- Una orden de antes del corte (vino de la hoja) y una creada en el ERP.
  insert into ordenes_produccion (articulo_id, cantidad, estado, creado_en) values (v_eq, 1, 'liberada', '2026-10-16') returning id into v_op;
  insert into op_materiales (orden_id, articulo_id, requerido) values (v_op, v_tubo, 14), (v_op, v_chum, 4);
  insert into ordenes_produccion (articulo_id, cantidad, estado, creado_en) values (v_eq, 1, 'liberada', '2026-11-03') returning id into v_op_nueva;
  insert into op_materiales (orden_id, articulo_id, requerido) values (v_op_nueva, v_tubo, 5);

  -- 1. Surtir sin decir quién recibe no; diciéndolo, queda en el movimiento y en la historia.
  perform pg_temp.como(v_alm);
  begin perform surtir_material(v_op, jsonb_build_array(jsonb_build_object('articulo_id', v_tubo, 'cantidad', 4, 'almacen_id', v_pb))); v_ok := true;
  exception when check_violation then v_ok := false; end;
  assert not v_ok, 'surtió sin decir quién recibe';
  perform surtir_material(v_op, jsonb_build_array(jsonb_build_object('articulo_id', v_tubo, 'cantidad', 4, 'almacen_id', v_pb)), 'Juan Torres');
  perform pg_temp.como_postgres();
  assert (select recibio from movimientos_inventario where orden_produccion_id = v_op and tipo = 'salida_produccion') = 'Juan Torres', 'el movimiento no dice quién recibió';
  assert (select responsable from op_eventos where orden_id = v_op and tipo = 'surtido' and responsable is not null) = 'Juan Torres', 'la historia no dice quién recibió';
  assert (select cantidad from existencias where articulo_id = v_tubo and almacen_id = v_pb) = 16, 'no descontó lo surtido';

  -- Lo que ya se había entregado con la hoja: cuenta como surtido y no toca el inventario.
  perform pg_temp.como(v_alm);
  perform surtir_material(v_op, jsonb_build_array(jsonb_build_object('articulo_id', v_tubo, 'cantidad', 10), jsonb_build_object('articulo_id', v_chum, 'cantidad', 4)),
                          null, true);
  perform pg_temp.como_postgres();
  assert (select surtido from op_materiales where orden_id = v_op and articulo_id = v_tubo) = 14, 'no contó lo entregado antes';
  assert (select cantidad from existencias where articulo_id = v_tubo and almacen_id = v_pb) = 16, 'lo entregado antes descontó inventario';
  assert (select cantidad from existencias where articulo_id = v_chum and almacen_id = v_pb) = 2, 'lo entregado antes descontó chumaceras';
  -- Más de lo que falta, no; y una orden creada en el ERP no puede.
  perform pg_temp.como(v_alm);
  begin perform surtir_material(v_op_nueva, jsonb_build_array(jsonb_build_object('articulo_id', v_tubo, 'cantidad', 5)), null, true); v_ok := true;
  exception when raise_exception then v_ok := sqlerrm not like '%se creó en el ERP%'; end;
  assert not v_ok, 'una orden nueva registró material como entregado antes del ERP';

  -- 2. La cola: la orden nueva tiene material por surtir; la de la hoja ya no. Ventas no la ve.
  assert exists (select 1 from ordenes_por_surtir() where id = v_op_nueva and partidas = 1 and not previo), 'la cola no trae la orden nueva';
  assert not exists (select 1 from ordenes_por_surtir() where id = v_op), 'la cola trae una orden ya surtida';
  perform pg_temp.como(v_ven);
  begin perform ordenes_por_surtir(); v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'ventas vio la cola de almacén';

  -- 3. Un pedido con tubo, chumaceras (no alcanzan) y un equipo fabricado.
  perform pg_temp.como_postgres();
  insert into clientes (nombre, vendedor_id) values ('Cliente 177', v_ven) returning id into v_cli;
  insert into pedidos (cliente_id, vendedor_id, estado) values (v_cli, v_ven, 'listo') returning id into v_ped;
  insert into pedido_lineas (pedido_id, articulo_id, titulo, cantidad, precio_unitario) values (v_ped, v_tubo, 'Tubo 177', 6, 100) returning id into l_tubo;
  insert into pedido_lineas (pedido_id, articulo_id, titulo, cantidad, precio_unitario) values (v_ped, v_chum, 'Chumacera 177', 3, 100) returning id into l_chum;
  insert into pedido_lineas (pedido_id, articulo_id, titulo, cantidad, precio_unitario) values (v_ped, v_eq, 'Bazuca 177', 1, 1000) returning id into l_eq;
  insert into ordenes_produccion (articulo_id, cantidad, estado, pedido_id, pedido_linea_id) values (v_eq, 1, 'terminada', v_ped, l_eq) returning id into v_op_eq;
  -- Dos tubos ya habían salido a mano con este pedido: no se descuentan otra vez.
  insert into movimientos_inventario (tipo, articulo_id, almacen_id, cantidad, pedido_id, motivo) values ('salida_venta', v_tubo, v_pb, -2, v_ped, 'a mano');

  -- Primera entrega: 4 tubos. Más de lo que falta, no.
  perform pg_temp.como(v_alm);
  begin perform entregar_pedido(v_ped, 'Pedro Cliente', null, null, jsonb_build_array(jsonb_build_object('id', l_tubo, 'cantidad', 7))); v_ok := true;
  exception when raise_exception then v_ok := sqlerrm not like 'De "Tubo 177" faltan 6%'; end;
  assert not v_ok, 'entregó más de lo que falta';
  s1 := entregar_pedido(v_ped, 'Pedro Cliente', null, null, jsonb_build_array(jsonb_build_object('id', l_tubo, 'cantidad', 4)));
  perform pg_temp.como_postgres();
  assert (select cantidad_entregada from pedido_lineas where id = l_tubo) = 4, 'no marcó lo entregado';
  assert (select estado from pedidos where id = v_ped) = 'listo', 'una entrega parcial dejó el pedido entregado';
  -- 4 entregados − 2 que ya habían salido a mano = 2 que se descuentan ahora (16 − 2 a mano − 2).
  assert (select cantidad from existencias where articulo_id = v_tubo and almacen_id = v_pb) = 12, 'descontó de más o de menos';
  assert (select recibio from movimientos_inventario where id = (select movimientos[1] from pedido_salidas where id = s1)) = 'Pedro Cliente', 'la salida no dice quién recibió';

  -- Segunda entrega: sin decir partidas, todo lo que falta. Las chumaceras no alcanzan: sale igual y queda anotado.
  perform pg_temp.como(v_alm);
  s2 := entregar_pedido(v_ped, 'Pedro Cliente');
  perform pg_temp.como_postgres();
  assert (select estado from pedidos where id = v_ped) = 'entregado', 'no quedó entregado al completar';
  assert (select cantidad from existencias where articulo_id = v_tubo and almacen_id = v_pb) = 10, 'no descontó el resto de los tubos';
  assert (select cantidad from existencias where articulo_id = v_chum and almacen_id = v_pb) = 2, 'descontó chumaceras que no alcanzaban';
  assert (select sin_inventario->0->>'articulo' from pedido_salidas where id = s2) = 'Chumacera 177', 'no anotó lo que no pudo descontar';
  assert (select estado from ordenes_produccion where id = v_op_eq) = 'entregada', 'el equipo no quedó entregado';
  h := hoja_salida(v_ped);
  assert jsonb_array_length(h->'salidas') = 2, 'la hoja no trae las dos entregas';
  assert (h->'salidas'->1->'lineas'->0->>'cantidad')::numeric = 4, 'la hoja no trae lo de la primera entrega';

  -- Deshacer la última: regresa inventario, el equipo y el pedido; la primera se queda.
  perform pg_temp.como(v_alm);
  perform deshacer_entrega(v_ped);
  perform pg_temp.como_postgres();
  assert (select estado from pedidos where id = v_ped) = 'listo', 'el pedido no regresó';
  assert (select cantidad_entregada from pedido_lineas where id = l_tubo) = 4, 'no regresó lo de la segunda entrega';
  assert (select cantidad from existencias where articulo_id = v_tubo and almacen_id = v_pb) = 12, 'no regresó el inventario';
  assert (select estado from ordenes_produccion where id = v_op_eq) = 'terminada', 'el equipo no regresó a terminado';
  -- Y la parcial también se deshace (ya no solo la de un pedido entregado).
  perform pg_temp.como(v_alm);
  perform deshacer_entrega(v_ped);
  perform pg_temp.como_postgres();
  assert (select cantidad_entregada from pedido_lineas where id = l_tubo) = 0, 'no se deshizo la parcial';
  assert (select cantidad from existencias where articulo_id = v_tubo and almacen_id = v_pb) = 14, 'la parcial no regresó su inventario';
end $$;

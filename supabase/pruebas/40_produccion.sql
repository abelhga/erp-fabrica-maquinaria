-- Producción: el caso del pedido 786 (dos bazucas que piden 14 m de tubo cada
-- una con 18 m en existencia). En la hoja cada pestaña decía "faltante 0".
do $$
declare
  v_gp uuid; v_ing uuid; v_alm uuid; v_tv uuid; v_vend uuid;
  v_tubo uuid; v_chum uuid; v_tornillo uuid; v_bazuca uuid; v_pb int;
  v_cli uuid; v_ped uuid; v_op1 uuid; v_op2 uuid; v_req uuid; v_n int; v_num numeric; r record; v_oper uuid;
begin
  v_gp := pg_temp.usuario('gerprod@hegamex.com', '{gerente_produccion}');
  v_ing := pg_temp.usuario('ing@hegamex.com', '{ingenieria}');
  v_alm := pg_temp.usuario('almacen@hegamex.com', '{almacen}');
  v_tv := pg_temp.usuario('tv@hegamex.com', '{pantalla}');
  v_vend := pg_temp.usuario('vend@hegamex.com', '{ventas}');
  select id into v_pb from almacenes where nombre = 'Planta Baja';

  insert into articulos (clave, tipo, nombre, unidad) values ('T-C-TUBO', 'materia_prima', 'Tubo 2" ced. 40', 'metro') returning id into v_tubo;
  insert into articulos (clave, tipo, nombre, unidad) values ('T-C-CHUM', 'componente', 'Chumacera 1 1/2', 'pieza') returning id into v_chum;
  insert into articulos (clave, tipo, nombre, unidad) values ('T-C-TOR', 'componente', 'Tornillo 3/8', 'pieza') returning id into v_tornillo;
  insert into articulos (clave, tipo, nombre) values ('T-E-BAZ', 'equipo', 'Bazuca 10" x 12 m') returning id into v_bazuca;
  insert into bom_lineas (padre_id, hijo_id, cantidad) values (v_bazuca, v_tubo, 14), (v_bazuca, v_chum, 4);
  insert into bom_operaciones (articulo_id, etapa_id, horas) values
    (v_bazuca, (select id from etapas where nombre = 'Pailería'), 30),
    (v_bazuca, (select id from etapas where nombre = 'Pintura'), 6);
  insert into movimientos_inventario (tipo, articulo_id, almacen_id, cantidad) values
    ('inicial', v_tubo, v_pb, 18), ('inicial', v_chum, v_pb, 20), ('inicial', v_tornillo, v_pb, 100);

  insert into clientes (nombre) values ('Cliente P786') returning id into v_cli;
  insert into pedidos (cliente_id, fecha_compromiso) values (v_cli, current_date + 20) returning id into v_ped;
  insert into pedido_lineas (pedido_id, articulo_id, titulo, cantidad, precio_unitario) values (v_ped, v_bazuca, 'Bazuca', 2, 150000);

  -- El pedido de 2 bazucas genera 2 órdenes (una por unidad), con horas por etapa.
  perform pg_temp.como(v_gp);
  v_n := ordenes_desde_pedido(v_ped);
  assert v_n = 2, format('esperaba 2 órdenes, salieron %s', v_n);
  select id into v_op1 from ordenes_produccion where pedido_id = v_ped order by folio limit 1;
  select id into v_op2 from ordenes_produccion where pedido_id = v_ped order by folio desc limit 1;
  assert (select sum(horas_estimadas) from op_operaciones where orden_id = v_op1) = 36, 'horas por orden';
  assert (select estado::text from pedidos where id = v_ped) = 'en_produccion', 'pedido en producción';

  -- Apartar: la primera toma 14 m, la segunda solo encuentra 4 → faltan 10 (lo que la hoja escondía).
  perform apartar_material(v_op1);
  perform apartar_material(v_op2);
  select faltante into v_num from v_op_material where orden_id = v_op1 and articulo_id = v_tubo;
  assert v_num = 0, format('la primera orden no debería tener faltante de tubo (tiene %s)', v_num);
  select faltante into v_num from v_op_material where orden_id = v_op2 and articulo_id = v_tubo;
  assert v_num = 10, format('la segunda orden debe mostrar faltante de 10 m, muestra %s', v_num);
  -- Apartar otra vez no duplica.
  perform apartar_material(v_op2);
  assert (select sum(cantidad) from reservas where articulo_id = v_tubo and estado = 'activa') = 18, 'no se aparta de más';

  -- Faltantes → requisición a compras; pedirla dos veces no duplica.
  v_req := pedir_faltantes(v_op2);
  assert (select cantidad from requisicion_lineas where requisicion_id = v_req and articulo_id = v_tubo) = 10, 'requisición de 10 m';
  assert pedir_faltantes(v_op2) is null, 'la segunda vez no debe generar otra requisición';

  -- Liberar exige revisión de ingeniería.
  begin
    perform liberar_orden(v_op1);
    assert false, 'se liberó sin revisión de ingeniería';
  exception when others then
    if sqlerrm not like '%ingeniería%' then raise; end if;
  end;
  perform pg_temp.como(v_ing);
  perform revisar_orden(v_op1, 'ingenieria');
  perform pg_temp.como(v_gp);
  perform liberar_orden(v_op1);

  -- Surtido: 14 m de tubo y 3 de 4 chumaceras; tornillería fuera de lista exige motivo.
  perform pg_temp.como(v_alm);
  begin
    perform surtir_material(v_op1, jsonb_build_array(jsonb_build_object('articulo_id', v_tornillo, 'cantidad', 8, 'almacen_id', v_pb)));
    assert false, 'salió material fuera de lista sin motivo';
  exception when others then
    if sqlerrm not like '%no está en la lista%' then raise; end if;
  end;
  perform surtir_material(v_op1, jsonb_build_array(
    jsonb_build_object('articulo_id', v_tubo, 'cantidad', 14, 'almacen_id', v_pb),
    jsonb_build_object('articulo_id', v_chum, 'cantidad', 3, 'almacen_id', v_pb),
    jsonb_build_object('articulo_id', v_tornillo, 'cantidad', 8, 'almacen_id', v_pb, 'motivo', 'Fijación de guarda')));
  select * into r from v_op_material where orden_id = v_op1 and articulo_id = v_chum;
  assert r.surtido = 3 and r.faltante = 0 and r.apartado = 1, format('chumaceras: surtido %s, apartado %s', r.surtido, r.apartado);
  assert (select fuera_de_lista from movimientos_inventario where orden_produccion_id = v_op1 and articulo_id = v_tornillo), 'tornillo marcado fuera de lista';
  assert (select agregado from op_materiales where orden_id = v_op1 and articulo_id = v_tornillo), 'tornillo agregado a la orden';
  assert (select estado from reservas where orden_produccion_id = v_op1 and articulo_id = v_tubo) = 'surtida', 'reserva de tubo surtida';

  -- Terminal de piso: pailería y pintura. Al terminar la última, la orden se cierra.
  perform pg_temp.como(v_gp);
  for v_oper in select id from op_operaciones where orden_id = v_op1 loop
    perform avanzar_operacion(v_oper, 'inicio', null, 'Juan Soldador');
    perform avanzar_operacion(v_oper, 'fin');
  end loop;
  assert (select estado::text from ordenes_produccion where id = v_op1) = 'terminada', 'orden terminada';
  assert (select estado::text from pedidos where id = v_ped) = 'en_produccion', 'el pedido sigue en producción (falta la otra bazuca)';

  -- La TV ve el tablero pero no puede mover nada.
  perform pg_temp.como(v_tv);
  select count(*) into v_n from v_tablero_produccion where id in (v_op1, v_op2);
  assert v_n = 2, format('la pantalla debería ver las 2 órdenes en el tablero, ve %s', v_n);
  begin
    perform avanzar_operacion((select id from op_operaciones where orden_id = v_op2 limit 1), 'inicio');
    assert false, 'la pantalla pudo avanzar una operación';
  exception when insufficient_privilege then null;
  end;
  select count(*) into v_n from pedidos;
  assert v_n = 0, 'la pantalla no debe ver pedidos (montos)';

  -- El vendedor ve el avance de producción, pero no puede crear órdenes.
  perform pg_temp.como(v_vend);
  begin
    perform crear_orden_produccion(v_bazuca);
    assert false, 'un vendedor creó una orden de producción';
  exception when insufficient_privilege then null;
  end;

  -- Carga del taller: la segunda bazuca (planeada) no cuenta; la primera ya terminó → 0 pendientes.
  perform pg_temp.como(v_gp);
  -- Carga del taller: la primera bazuca ya terminó; la segunda (planeada, sin liberar) no cuenta.
  select coalesce(sum(x.horas_estimadas) filter (where x.estado <> 'terminada'), 0) into v_num
  from op_operaciones x join ordenes_produccion o on o.id = x.orden_id
  where x.orden_id in (v_op1, v_op2) and o.estado in ('liberada', 'en_proceso');
  assert v_num = 0, format('pailería sin horas pendientes de estas órdenes liberadas, tiene %s', v_num);
end $$;

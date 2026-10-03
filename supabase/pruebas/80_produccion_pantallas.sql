-- Pantallas de producción: lo que la gerencia, la terminal y la TV le piden a
-- la base, y las reglas que se corrigieron al construirlas.
do $$
declare
  v_gp uuid; v_ing uuid; v_alm uuid; v_tv uuid; v_vend uuid; v_taller uuid;
  v_tubo uuid; v_chum uuid; v_motor uuid; v_bazuca uuid; v_especial uuid; v_pb int; v_ml int;
  v_cli uuid; v_ped uuid; v_ped2 uuid; v_op1 uuid; v_op2 uuid; v_op3 uuid; v_n int; v_num numeric; v_txt text; v_j jsonb;
  r record; v_pail uuid; v_pint uuid; v_sol uuid; v_base record;
begin
  v_gp := pg_temp.usuario('gerprod@hegamex.com', '{gerente_produccion}');
  v_ing := pg_temp.usuario('ing@hegamex.com', '{ingenieria}');
  v_alm := pg_temp.usuario('almacen@hegamex.com', '{almacen}');
  v_tv := pg_temp.usuario('tv@hegamex.com', '{pantalla}');
  v_vend := pg_temp.usuario('vend@hegamex.com', '{ventas}');
  v_taller := pg_temp.usuario('taller@hegamex.com', '{produccion}');
  select id into v_pb from almacenes where nombre = 'Planta Baja';
  select id into v_ml from almacenes where not disponible_para_planta limit 1;
  -- La base es compartida (puede haber órdenes de demostración): la carga se compara contra lo que ya había.
  select horas_pendientes, horas_planeadas into v_base from v_carga_etapas where nombre = 'Pintura';

  insert into articulos (clave, tipo, nombre, unidad) values ('P80-TUBO', 'materia_prima', 'Tubo 2" ced. 40', 'metro') returning id into v_tubo;
  insert into articulos (clave, tipo, nombre, unidad) values ('P80-CHUM', 'componente', 'Chumacera 2"', 'pieza') returning id into v_chum;
  insert into articulos (clave, tipo, nombre, unidad) values ('P80-MOT', 'componente', 'Motorreductor 5 HP', 'pieza') returning id into v_motor;
  insert into articulos (clave, tipo, nombre) values ('P80-BAZ', 'equipo', 'Bazuca 10" x 12 m') returning id into v_bazuca;
  insert into articulos (clave, tipo, nombre) values ('P80-ESP', 'equipo', 'Tren de 4 tolvas (especial)') returning id into v_especial;
  insert into bom_lineas (padre_id, hijo_id, cantidad) values (v_bazuca, v_tubo, 14), (v_bazuca, v_chum, 4), (v_bazuca, v_motor, 1);
  insert into bom_operaciones (articulo_id, etapa_id, horas) values
    (v_bazuca, (select id from etapas where nombre = 'Pailería'), 30),
    (v_bazuca, (select id from etapas where nombre = 'Pintura'), 6);
  insert into movimientos_inventario (tipo, articulo_id, almacen_id, cantidad) values
    ('inicial', v_tubo, v_pb, 18), ('inicial', v_chum, v_pb, 20), ('inicial', v_motor, v_pb, 1), ('inicial', v_motor, v_ml, 3);

  insert into clientes (nombre) values ('Agro P80') returning id into v_cli;
  insert into pedidos (cliente_id, fecha_compromiso, vendedor_id) values (v_cli, current_date + 20, null) returning id into v_ped;
  insert into pedido_lineas (pedido_id, articulo_id, titulo, cantidad, precio_unitario) values
    (v_ped, v_bazuca, 'Bazuca', 2, 150000), (v_ped, v_especial, 'Tren de tolvas', 1, 400000);

  -- Pedidos por producir: el pedido aparece con 2 unidades fabricables y 1 partida sin lista de materiales.
  perform pg_temp.como(v_gp);
  select unidades, partidas_sin_lista into r from v_pedidos_por_producir where id = v_ped;
  assert r.unidades = 2 and r.partidas_sin_lista = 1, format('pedido por producir: %s unidades, %s sin lista', r.unidades, r.partidas_sin_lista);
  perform ordenes_desde_pedido(v_ped);
  select unidades into v_n from v_pedidos_por_producir where id = v_ped;
  assert coalesce(v_n, 0) = 0, 'después de crear las órdenes ya no quedan unidades fabricables';
  select id into v_op1 from ordenes_produccion where pedido_id = v_ped order by folio limit 1;
  select id into v_op2 from ordenes_produccion where pedido_id = v_ped order by folio desc limit 1;

  -- Crear la orden no cuenta como "cambio de material" (la lista entra antes del evento "creada").
  assert not exists (select 1 from op_eventos where orden_id = v_op1 and tipo = 'cambio_material'), 'la creación no es un cambio';

  -- Validación paso a paso, con quién y cuándo.
  v_j := validacion_orden(v_op1);
  assert v_j->0->>'estado' = 'pendiente' and v_j->1->>'estado' = 'pendiente', 'al crear, todo pendiente';
  perform apartar_material(v_op1);
  perform apartar_material(v_op2);
  v_j := validacion_orden(v_op1);
  assert v_j->1->>'estado' = 'hecho', format('op1 apartó todo: %s', v_j->1);
  assert v_j->1->>'por' is not null, 'apartado con nombre de quién';
  assert v_j->2->>'estado' = 'no_aplica', 'op1 no necesita pedir faltantes';
  v_j := validacion_orden(v_op2);
  assert v_j->1->>'estado' = 'parcial', 'op2 apartó con faltante (tubo y motor)';
  assert v_j->2->>'estado' = 'pendiente', 'op2 tiene faltantes sin pedir';
  assert (select faltantes_sin_pedir from v_tablero_produccion where id = v_op2) = 2, 'tablero: 2 partidas sin pedir';
  perform pedir_faltantes(v_op2);
  v_j := validacion_orden(v_op2);
  assert v_j->2->>'estado' = 'hecho' and v_j->2->>'detalle' like 'REQ-%', format('faltantes pedidos: %s', v_j->2);
  assert (select material_apartado from v_tablero_produccion where id = v_op2), 'tablero: material apartado';

  -- El motor que está en el Full de Mercado Libre no cuenta para planta ni se surte desde ahí.
  select disponible_planta into v_num from v_op_material where orden_id = v_op2 and articulo_id = v_motor;
  assert v_num = 0, format('motor disponible en planta: %s (el único lo apartó op1)', v_num);

  -- Liberar exige ingeniería y no se puede liberar dos veces.
  perform pg_temp.como(v_ing);
  perform revisar_orden(v_op1, 'ingenieria');
  perform pg_temp.como(v_gp);
  perform liberar_orden(v_op1);
  begin
    perform liberar_orden(v_op1);
    assert false, 'se liberó dos veces';
  exception when others then
    if sqlerrm not like '%ya estaba liberada%' then raise; end if;
  end;
  assert (select count(*) from op_eventos where orden_id = v_op1 and tipo = 'liberada') = 1, 'un solo evento de liberación';
  assert validacion_orden(v_op1)->4->>'estado' = 'hecho', 'paso liberada hecho';

  -- Surtido: almacén no puede sacarle a op2 el tubo que op1 tiene apartado (en la hoja cada pestaña veía todo el stock).
  perform pg_temp.como(v_alm);
  begin
    perform surtir_material(v_op2, jsonb_build_array(jsonb_build_object('articulo_id', v_tubo, 'cantidad', 10, 'almacen_id', v_pb)));
    assert false, 'se surtió material apartado para otra orden';
  exception when others then
    if sqlerrm not like '%apartado para OP-%' then raise; end if;
  end;
  -- Lo suyo (4 m) sí sale.
  perform surtir_material(v_op2, jsonb_build_array(jsonb_build_object('articulo_id', v_tubo, 'cantidad', 4, 'almacen_id', v_pb)));
  begin
    perform surtir_material(v_op1, jsonb_build_array(jsonb_build_object('articulo_id', v_motor, 'cantidad', 1, 'almacen_id', v_ml)));
    assert false, 'se surtió a planta desde Mercado Libre';
  exception when others then
    if sqlerrm not like '%no se surte a planta%' then raise; end if;
  end;
  perform surtir_material(v_op1, jsonb_build_array(jsonb_build_object('articulo_id', v_tubo, 'cantidad', 6, 'almacen_id', v_pb)));
  assert (select nota from op_eventos where orden_id = v_op1 and tipo = 'surtido' order by id desc limit 1) = '1 partida(s)', 'evento de surtido';

  -- Ingeniería corrige la lista de op1: el tubo baja de 14 a 10 m. Ya salieron 6 y había 8 apartados:
  -- 6 + 8 − 10 = 4 m vuelven a estar libres, y el cambio queda en la línea de tiempo.
  perform pg_temp.como(v_ing);
  update op_materiales set requerido = 10 where orden_id = v_op1 and articulo_id = v_tubo;
  select apartado, faltante into r from v_op_material where orden_id = v_op1 and articulo_id = v_tubo;
  assert r.apartado = 4 and r.faltante = 0, format('tubo op1 tras la corrección: apartado %s, faltante %s', r.apartado, r.faltante);
  select nota into v_txt from op_eventos where orden_id = v_op1 and tipo = 'cambio_material' order by id desc limit 1;
  assert v_txt like '%14 → 10 metro%', format('evento de cambio: %s', v_txt);
  -- El supervisor de taller no corrige listas (la RLS no lo deja; el update no toca nada).
  perform pg_temp.como(v_taller);
  update op_materiales set requerido = 1 where orden_id = v_op1 and articulo_id = v_tubo;
  perform pg_temp.como(v_ing);
  assert (select requerido from op_materiales where orden_id = v_op1 and articulo_id = v_tubo) = 10, 'el taller no cambió la lista';
  -- Al volver a apartar op2, encuentra los 4 m que se soltaron.
  perform pg_temp.como(v_gp);
  perform apartar_material(v_op2);
  select apartado into v_num from v_op_material where orden_id = v_op2 and articulo_id = v_tubo;
  assert v_num = 4, format('op2 apartó los 4 m liberados, tiene %s', v_num);

  -- Terminal de piso: no se pausa lo que no empezó, ni se reanuda lo que no está pausado.
  perform pg_temp.como(v_taller);
  select o.id into v_pail from op_operaciones o join etapas e on e.id = o.etapa_id where o.orden_id = v_op1 and e.nombre = 'Pailería';
  select o.id into v_pint from op_operaciones o join etapas e on e.id = o.etapa_id where o.orden_id = v_op1 and e.nombre = 'Pintura';
  begin
    perform avanzar_operacion(v_pail, 'pausa');
    assert false, 'se pausó una etapa que no había empezado';
  exception when others then
    if sqlerrm not like '%Solo se pausa%' then raise; end if;
  end;
  -- La pintura todavía no está "lista" para la terminal: falta pailería.
  select lista, espera_a into r from v_piso_operaciones where id = v_pint;
  assert not r.lista and r.espera_a = 'Pailería', format('pintura espera a %s', r.espera_a);
  assert (select lista from v_piso_operaciones where id = v_pail), 'pailería está lista';
  perform avanzar_operacion(v_pail, 'inicio', null, 'Juan Soldador');
  begin
    perform avanzar_operacion(v_pail, 'inicio', null, 'Pedro');
    assert false, 'se inició dos veces';
  exception when others then
    if sqlerrm not like '%ya estaba en proceso (Juan Soldador)%' then raise; end if;
  end;
  begin
    perform avanzar_operacion(v_pail, 'reanudar');
    assert false, 'se reanudó algo que no estaba pausado';
  exception when others then
    if sqlerrm not like '%no está pausada%' then raise; end if;
  end;
  begin
    perform avanzar_operacion(v_pail, 'problema', '  ');
    assert false, 'problema sin descripción';
  exception when others then
    if sqlerrm not like '%cuál es el problema%' then raise; end if;
  end;
  perform avanzar_operacion(v_pail, 'problema', 'Falta lámina calibre 10');
  perform avanzar_operacion(v_pail, 'pausa');
  select ultimo_problema into v_txt from v_piso_operaciones where id = v_pail;
  assert v_txt = 'Falta lámina calibre 10', 'la terminal ve el último problema';
  -- El evento guarda quién trabajaba, para la TV.
  select responsable, etapa into r from v_op_eventos where operacion_id = v_pail and tipo = 'pausa';
  assert r.responsable = 'Juan Soldador' and r.etapa = 'Pailería', format('evento con responsable: %s', r.responsable);
  assert (select etapas_activas->0->>'estado' from v_tablero_produccion where id = v_op1) = 'pausada', 'tablero con etapa pausada';
  perform avanzar_operacion(v_pail, 'reanudar', null, 'Pedro Pailero');
  perform avanzar_operacion(v_pail, 'fin');
  assert (select responsable from op_operaciones where id = v_pail) = 'Pedro Pailero', 'responsable actualizado al reanudar';
  assert (select siguiente_etapa from v_tablero_produccion where id = v_op1) = 'Pintura', 'sigue pintura';

  -- La carga del taller: op1 liberada cuenta en horas pendientes (pintura), op2 planeada en horas planeadas.
  select horas_pendientes, horas_planeadas into r from v_carga_etapas where nombre = 'Pintura';
  assert r.horas_pendientes - v_base.horas_pendientes = 6 and r.horas_planeadas - v_base.horas_planeadas = 6,
    format('pintura: %s pendientes, %s planeadas (había %s y %s)', r.horas_pendientes, r.horas_planeadas, v_base.horas_pendientes, v_base.horas_planeadas);

  -- Gerencia: reprogramar deja rastro; la serie no se repite.
  perform pg_temp.como(v_gp);
  perform editar_orden(v_op1, p_prioridad => 1, p_fecha_compromiso => current_date + 5, p_numero_serie => 'P80-S1');
  select nota into v_txt from op_eventos where orden_id = v_op1 and tipo = 'nota' order by id desc limit 1;
  assert v_txt like 'Prioridad: normal → urgente · Compromiso:%Serie: sin serie → P80-S1', format('evento de reprogramación: %s', v_txt);
  begin
    perform editar_orden(v_op2, p_numero_serie => 'P80-S1');
    assert false, 'serie repetida';
  exception when others then
    if sqlerrm not like '%ya es de la orden%' then raise; end if;
  end;
  -- Editar solo las notas (antes tronaba: el texto se concatenaba como si fuera arreglo) y luego borrarlas.
  perform editar_orden(v_op1, p_notas => 'Lleva juego extra de cribas');
  assert (select notas from ordenes_produccion where id = v_op1) = 'Lleva juego extra de cribas', 'notas guardadas';
  assert (select nota from op_eventos where orden_id = v_op1 order by id desc limit 1) = 'Notas: Lleva juego extra de cribas', 'evento de notas';
  perform editar_orden(v_op1, p_prioridad => 2, p_notas => '');
  assert (select notas from ordenes_produccion where id = v_op1) is null, 'notas borradas';
  assert (select nota from op_eventos where orden_id = v_op1 order by id desc limit 1) = 'Prioridad: urgente → normal · Notas: (borradas)', 'evento de prioridad y notas';
  -- Sin cambios no hay evento.
  select count(*) into v_n from op_eventos where orden_id = v_op1;
  perform editar_orden(v_op1, p_prioridad => 2);
  assert (select count(*) from op_eventos where orden_id = v_op1) = v_n, 'editar sin cambios no deja evento';
  -- Días al compromiso con la fecha de planta (Guadalajara), no la de UTC.
  assert (select dias_restantes from v_tablero_produccion where id = v_op1) = (current_date + 5) - hoy_planta(), 'días con fecha de planta';

  -- Solicitud de cambio a ingeniería desde el taller; la TV no puede.
  perform pg_temp.como(v_taller);
  v_sol := solicitar_cambio_bom(v_op1, v_chum, 'Son de 1 1/2", no de 2"');
  perform pg_temp.como(v_tv);
  begin
    perform solicitar_cambio_bom(v_op1, null, 'desde la tele');
    assert false, 'la pantalla pidió un cambio';
  exception when insufficient_privilege then null;
  end;
  perform pg_temp.como(v_taller);
  begin
    perform responder_solicitud_cambio(v_sol, 'aplicada');
    assert false, 'el taller resolvió un cambio de ingeniería';
  exception when insufficient_privilege then null;
  end;
  perform pg_temp.como(v_ing);
  perform responder_solicitud_cambio(v_sol, 'aplicada', 'Corregido en el costeo');
  assert (select estado from solicitudes_cambio_bom where id = v_sol) = 'aplicada', 'solicitud aplicada';
  assert (select nota from op_eventos where orden_id = v_op1 order by id desc limit 1) like 'Ingeniería aplicó%Corregido en el costeo', 'la orden se entera de la respuesta';

  -- La TV ve para quién es cada equipo, pero sigue sin ver pedidos (montos) ni poder mover nada.
  perform pg_temp.como(v_tv);
  select cliente, pedido_folio into r from v_tablero_produccion where id = v_op1;
  assert r.cliente = 'Agro P80' and r.pedido_folio is not null, format('la pantalla ve el cliente: %s', r.cliente);
  assert (select count(*) from pedidos) = 0, 'la pantalla no ve pedidos';
  assert (select count(*) from pedido_de_orden(v_ped)) = 1, 'la función solo da folio y cliente';
  assert exists (select 1 from v_piso_operaciones where orden_id = v_op1), 'la pantalla ve las etapas del piso';
  assert exists (select 1 from v_op_eventos where orden_id = v_op1 and tipo = 'fin'), 'la pantalla ve los eventos';
  begin
    perform editar_orden(v_op1, p_prioridad => 3);
    assert false, 'la pantalla reprogramó';
  exception when insufficient_privilege then null;
  end;
  -- Un pedido sin orden de producción no se asoma por la función.
  perform pg_temp.como_postgres();
  insert into pedidos (cliente_id) values (v_cli) returning id into v_ped2;
  perform pg_temp.como(v_tv);
  assert (select count(*) from pedido_de_orden(v_ped2)) = 0, 'pedido sin orden: nada';

  -- El vendedor ve el avance y el cliente, pero no reprograma ni cancela.
  perform pg_temp.como(v_vend);
  assert (select cliente from v_tablero_produccion where id = v_op1) = 'Agro P80', 'el vendedor ve el cliente de la orden';
  -- Y ve lo mismo que el gerente sobre lo pedido a compras (sin ver requisiciones).
  assert (select count(*) from requisiciones) = 0, 'el vendedor no ve requisiciones';
  assert (select faltantes_sin_pedir from v_tablero_produccion where id = v_op2) = 0, 'para el vendedor, lo pedido también cuenta como pedido';
  begin
    perform cancelar_orden(v_op2, 'no me gusta');
    assert false, 'un vendedor canceló una orden';
  exception when insufficient_privilege then null;
  end;

  -- Cancelar suelta lo apartado y cancela lo que se pidió a compras.
  perform pg_temp.como(v_gp);
  begin
    perform cancelar_orden(v_op2, 'no');
    assert false, 'canceló sin motivo';
  exception when others then
    if sqlerrm not like '%por qué%' then raise; end if;
  end;
  perform cancelar_orden(v_op2, 'El cliente pidió solo una bazuca');
  assert not exists (select 1 from reservas where orden_produccion_id = v_op2 and estado = 'activa'), 'reservas de op2 liberadas';
  assert not exists (select 1 from requisicion_lineas where orden_produccion_id = v_op2 and estado = 'pendiente'), 'requisición de op2 cancelada';
  assert (select nota from op_eventos where orden_id = v_op2 order by id desc limit 1) like '%devolución%', 'avisa que hay material surtido';
  assert not exists (select 1 from v_tablero_produccion where id = v_op2), 'la cancelada sale del tablero';

  -- Terminar suelta lo que quedó apartado; entregar solo lo terminado.
  begin
    perform entregar_orden(v_op1);
    assert false, 'entregó una orden sin terminar';
  exception when others then
    if sqlerrm not like '%terminada%' then raise; end if;
  end;
  perform pg_temp.como(v_taller);
  perform avanzar_operacion(v_pint, 'fin', null, 'Luis Pintor');
  assert (select estado::text from ordenes_produccion where id = v_op1) = 'terminada', 'op1 terminada';
  assert not exists (select 1 from reservas where orden_produccion_id = v_op1 and estado = 'activa'), 'reservas de op1 liberadas al terminar';
  assert (select tipo from op_eventos where orden_id = v_op1 order by id desc limit 1) = 'terminada', 'el último evento es "terminada", después del "fin"';
  -- Con la orden cerrada, la lista ya no se toca.
  perform pg_temp.como(v_ing);
  begin
    update op_materiales set requerido = 11 where orden_id = v_op1 and articulo_id = v_tubo;
    assert false, 'se cambió la lista de una orden cerrada';
  exception when others then
    if sqlerrm not like '%cerrada%' then raise; end if;
  end;
  perform pg_temp.como(v_alm);
  perform entregar_orden(v_op1);
  assert (select estado::text from ordenes_produccion where id = v_op1) = 'entregada', 'op1 entregada';

  -- Orden para stock: sin pedido, marcada como tal en el tablero.
  perform pg_temp.como(v_gp);
  v_op3 := crear_orden_produccion(v_bazuca, 1, null, current_date + 30, 2, 'P80-S3');
  assert (select para_stock and cliente is null from v_tablero_produccion where id = v_op3), 'orden para stock';
end $$;

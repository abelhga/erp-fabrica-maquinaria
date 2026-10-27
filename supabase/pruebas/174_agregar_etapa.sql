-- A una orden le falta una etapa (el equipo no la trae en el costeo): la gerencia de producción
-- se la agrega con sus horas y, si ya se había terminado, la orden y su pedido regresan.
do $$
declare v_sup uuid; v_gp uuid; v_vend uuid; v_eq uuid; v_cli uuid; v_ped uuid; v_op uuid; x1 uuid; xd uuid; v_ok boolean;
  v_detallado int := (select id from etapas where nombre = 'Detallado');
begin
  v_sup := pg_temp.usuario('sup174@hegamex.com', '{produccion}');
  v_gp := pg_temp.usuario('gp174@hegamex.com', '{gerente_produccion}');
  v_vend := pg_temp.usuario('vend174@hegamex.com', '{ventas}');
  insert into articulos (clave, tipo, nombre) values ('T174-EQ', 'equipo', 'Mezcladora 174') returning id into v_eq;
  insert into clientes (nombre) values ('Cliente 174') returning id into v_cli;
  insert into pedidos (cliente_id, estado) values (v_cli, 'en_produccion') returning id into v_ped;
  insert into ordenes_produccion (articulo_id, cantidad, estado, pedido_id) values (v_eq, 1, 'liberada', v_ped) returning id into v_op;
  insert into op_operaciones (orden_id, etapa_id, horas_estimadas) values (v_op, (select id from etapas where nombre = 'Pintura'), 5) returning id into x1;

  -- Pintura era la única etapa: al terminarla, la orden se cierra y el pedido queda listo.
  perform pg_temp.como(v_sup);
  perform avanzar_operacion(x1, 'inicio');
  perform avanzar_operacion(x1, 'fin');
  assert (select estado from ordenes_produccion where id = v_op) = 'terminada', 'la orden no terminó';
  assert (select estado from pedidos_basicos() where id = v_ped) = 'listo', 'el pedido no quedó listo';

  -- El supervisor y ventas no cambian el camino de la orden.
  begin perform agregar_etapa_orden(v_op, v_detallado, 15, 'Falta el detallado'); v_ok := true;
  exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'el supervisor agregó una etapa';
  perform pg_temp.como(v_vend);
  begin perform agregar_etapa_orden(v_op, v_detallado, 15, 'Falta el detallado'); v_ok := true;
  exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'ventas agregó una etapa';

  -- La gerencia: sin horas o sin motivo no; una etapa que ya tiene, tampoco.
  perform pg_temp.como(v_gp);
  begin perform agregar_etapa_orden(v_op, v_detallado, 0, 'Falta el detallado'); v_ok := true;
  exception when raise_exception then v_ok := sqlerrm not like 'Escribe cuántas horas%'; end;
  assert not v_ok, 'agregó una etapa sin horas';
  begin perform agregar_etapa_orden(v_op, v_detallado, 15, ''); v_ok := true;
  exception when raise_exception then v_ok := sqlerrm not like 'Escribe por qué%'; end;
  assert not v_ok, 'agregó una etapa sin motivo';
  begin perform agregar_etapa_orden(v_op, (select id from etapas where nombre = 'Pintura'), 5, 'Otra vez pintura'); v_ok := true;
  exception when raise_exception then v_ok := sqlerrm not like '%ya tiene Pintura'; end;
  assert not v_ok, 'agregó una etapa repetida';

  -- Con horas y motivo: la etapa queda pendiente, la orden regresa al taller y el pedido deja de estar listo.
  xd := agregar_etapa_orden(v_op, v_detallado, 15, 'El equipo no trae Detallado en el costeo');
  assert (select estado = 'pendiente' and horas_estimadas = 15 from op_operaciones where id = xd), 'la etapa no quedó pendiente con sus horas';
  assert (select estado = 'en_proceso' and terminada_en is null from ordenes_produccion where id = v_op), 'la orden siguió terminada';
  assert (select estado from pedidos_basicos() where id = v_ped) = 'en_produccion', 'el pedido siguió listo';
  assert (select nota from op_eventos where operacion_id = xd and tipo = 'etapa_agregada') = '15 h · El equipo no trae Detallado en el costeo',
    'sin evento en la historia';

  -- El taller la trabaja y la orden se vuelve a terminar sola.
  perform pg_temp.como(v_sup);
  perform avanzar_operacion(xd, 'inicio');
  perform avanzar_operacion(xd, 'fin');
  assert (select estado from ordenes_produccion where id = v_op) = 'terminada', 'la orden no se volvió a terminar';

  -- A una orden entregada ya no se le agrega nada.
  perform pg_temp.como_postgres();
  update ordenes_produccion set estado = 'entregada' where id = v_op;
  perform pg_temp.como(v_gp);
  begin perform agregar_etapa_orden(v_op, (select id from etapas where nombre = 'Pruebas'), 2, 'Faltaron pruebas'); v_ok := true;
  exception when raise_exception then v_ok := sqlerrm not like '%ya está entregada'; end;
  assert not v_ok, 'agregó una etapa a una orden entregada';
end $$;

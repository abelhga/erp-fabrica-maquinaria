-- Una orden en espera (cliente ausente) no hace fila en el taller, no sale atrasada, no se
-- trabaja en la terminal y solo la gerencia de producción la pone o la quita.
do $$
declare v_vend uuid; v_gp uuid; v_sup uuid; v_eq uuid; v_op uuid; v_x uuid; v_pail int; j jsonb; v_ok boolean;
begin
  v_vend := pg_temp.usuario('vend141@hegamex.com', '{ventas}');
  v_gp := pg_temp.usuario('gp141@hegamex.com', '{gerente_produccion}');
  v_sup := pg_temp.usuario('sup141@hegamex.com', '{produccion}');

  update etapas set activa = false;
  insert into etapas (nombre, orden, color, capacidad_horas_semana, activa) values ('Pailería 141', 1, '#888', 100, true) returning id into v_pail;
  delete from op_operaciones;
  insert into articulos (clave, tipo, nombre, dias_fabricacion) values ('T141-EQ', 'equipo', 'Cribadora de prueba', 5) returning id into v_eq;
  insert into bom_operaciones (articulo_id, etapa_id, horas) values (v_eq, v_pail, 100);
  -- 1,000 h en la fila, de una orden liberada que ya venció.
  insert into ordenes_produccion (articulo_id, cantidad, estado, fecha_compromiso) values (v_eq, 1, 'liberada', hoy_planta() - 30) returning id into v_op;
  insert into op_operaciones (orden_id, etapa_id, horas_estimadas, estado) values (v_op, v_pail, 1000, 'en_proceso') returning id into v_x;

  perform pg_temp.como(v_vend);
  assert (estimar_entrega(jsonb_build_array(jsonb_build_object('articulo_id', v_eq)))->>'semanas_cola')::numeric = 10, 'antes hace fila';

  -- Ni ventas ni el supervisor de piso la ponen en espera.
  begin perform poner_en_espera(v_op, 'Cliente ausente'); v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'ventas no pone en espera';
  perform pg_temp.como(v_sup);
  begin perform poner_en_espera(v_op, 'Cliente ausente'); v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'producción 2 no pone en espera';

  perform pg_temp.como(v_gp);
  begin perform poner_en_espera(v_op, '  '); v_ok := true; exception when raise_exception then v_ok := false; end;
  assert not v_ok, 'pide el motivo';
  perform poner_en_espera(v_op, 'Cliente ausente: dio anticipo');
  assert (select estado from op_operaciones where id = v_x) = 'pausada', 'lo que se trabajaba se pausa';
  assert (select en_espera_desde from ordenes_produccion where id = v_op) = hoy_planta(), 'desde hoy';

  -- Fuera de la fila, del tablero de piso y de las atrasadas.
  perform pg_temp.como(v_vend);
  j := estimar_entrega(jsonb_build_array(jsonb_build_object('articulo_id', v_eq)));
  assert (j->>'semanas_cola')::numeric = 0, format('en espera no hace fila: %s', j);
  perform pg_temp.como(v_sup);
  assert not exists (select 1 from v_piso_operaciones where orden_id = v_op), 'no sale en la terminal';
  assert (select horas_pendientes from v_carga_etapas where etapa_id = v_pail) = 0, 'no carga la etapa';
  assert (select not atrasada and en_espera_motivo like 'Cliente ausente%' from v_tablero_produccion where id = v_op), 'el tablero dice en espera, no atrasada';
  begin perform avanzar_operacion(v_x, 'reanudar'); v_ok := true; exception when raise_exception then v_ok := sqlerrm not like '%en espera%'; end;
  assert not v_ok, 'no se trabaja en la terminal';

  -- Reactivada vuelve a contar.
  perform pg_temp.como(v_sup);
  begin perform reactivar_orden(v_op); v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'producción 2 no reactiva';
  perform pg_temp.como(v_gp);
  perform reactivar_orden(v_op);
  assert exists (select 1 from op_eventos where orden_id = v_op and nota like 'Reactivada (estuvo en espera desde%'), 'queda en la línea de tiempo';
  perform pg_temp.como(v_vend);
  assert (estimar_entrega(jsonb_build_array(jsonb_build_object('articulo_id', v_eq)))->>'semanas_cola')::numeric = 10, 'reactivada hace fila';
  perform pg_temp.como(v_sup);
  perform avanzar_operacion(v_x, 'reanudar');
  assert (select estado from op_operaciones where id = v_x) = 'en_proceso', 'se puede reanudar';
end $$;

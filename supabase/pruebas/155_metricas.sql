-- Métricas de producción: las ven ingeniería de procesos, la gerencia de producción y
-- dirección; los costos solo quien tiene costos; ingeniería de procesos no ve precios ni márgenes.
do $$
declare v_ip uuid; v_gp uuid; v_sup uuid; v_vend uuid; v_eq uuid; v_op uuid; x1 uuid; x2 uuid; e1 uuid; e2 uuid; m jsonb; v_ok boolean;
begin
  v_ip := pg_temp.usuario('ip155@hegamex.com', '{ingenieria_procesos}');
  v_gp := pg_temp.usuario('gpm155@hegamex.com', '{gerente_produccion}');
  v_sup := pg_temp.usuario('supm155@hegamex.com', '{produccion}');
  v_vend := pg_temp.usuario('venm155@hegamex.com', '{ventas}');
  -- Horas de reloj, para no depender de la hora a la que corre la prueba (el horario lo prueba 163).
  update configuracion set valor = jsonb_set(valor, '{modo}', '"terminal"') where clave = 'horas_taller';
  insert into empleados (nombre, fecha_ingreso, departamento_id, etapa_id)
    values ('Uno 155m', current_date, departamento_produccion(), (select id from etapas where nombre = 'Pailería')) returning id into e1;
  insert into empleados (nombre, fecha_ingreso, departamento_id, etapa_id)
    values ('Dos 155m', current_date, departamento_produccion(), (select id from etapas where nombre = 'Pailería')) returning id into e2;
  insert into articulos (clave, tipo, nombre) values ('T155M-EQ', 'equipo', 'Banda métricas 155') returning id into v_eq;
  insert into ordenes_produccion (articulo_id, cantidad, estado, fecha_compromiso) values (v_eq, 1, 'liberada', current_date + 3) returning id into v_op;
  insert into op_operaciones (orden_id, etapa_id, horas_estimadas) values (v_op, (select id from etapas where nombre = 'Pailería'), 10) returning id into x1;
  insert into op_operaciones (orden_id, etapa_id, horas_estimadas) values (v_op, (select id from etapas where nombre = 'Pintura'), 2) returning id into x2;
  insert into op_eventos (orden_id, tipo, en) values (v_op, 'liberada', now() - interval '3 days');

  -- Dos personas 4 h en Pailería (8 horas hombre contra 10 estimadas); Pintura sin terminal.
  insert into op_tiempos (operacion_id, orden_id, empleado_id, inicio, fin) values
    (x1, v_op, e1, now() - interval '2 days', now() - interval '2 days' + interval '4 hours'),
    (x1, v_op, e2, now() - interval '2 days', now() - interval '2 days' + interval '4 hours');
  update op_operaciones set estado = 'terminada', inicio = now() - interval '2 days', fin = now() - interval '2 days' + interval '4 hours' where id = x1;
  update op_operaciones set estado = 'terminada', inicio = now() - interval '1 day', fin = now() - interval '1 day' where id = x2;
  update ordenes_produccion set estado = 'terminada', terminada_en = now() - interval '1 day' where id = v_op;
  insert into op_eventos (orden_id, operacion_id, tipo, nota) values (v_op, x1, 'problema', 'Falta lámina 155');

  perform pg_temp.como(v_ip);
  m := metricas_produccion(current_date - 30, current_date);
  assert (m->'resumen'->>'ordenes_terminadas')::int >= 1, 'no contó la orden terminada';
  assert (m->'resumen'->>'ordenes_a_tiempo')::int >= 1, 'la orden a tiempo no salió a tiempo';
  assert (select (e->>'horas_reales')::numeric = 8 and (e->>'horas_estimadas')::numeric = 10 and (e->>'con_terminal')::int = 1
          from jsonb_array_elements(m->'etapas') e where e->>'etapa' = 'Pailería'), 'horas de Pailería: ' || (m->'etapas')::text;
  assert (select (e->>'con_terminal')::int = 0 from jsonb_array_elements(m->'etapas') e where e->>'etapa' = 'Pintura'), 'Pintura sin terminal contó como marcada';
  assert exists (select 1 from jsonb_array_elements(m->'personas') p where p->>'nombre' = 'Uno 155m' and (p->>'horas')::numeric = 4), 'horas por persona';
  assert exists (select 1 from jsonb_array_elements(m->'problemas') p where p->>'nota' = 'Falta lámina 155'), 'no salió el problema';
  -- Con costos, sin márgenes ni precios de venta.
  assert (m->>'con_costos')::boolean, 'ingeniería de procesos sin costos';
  assert puede('costos', 1) and not puede('margenes', 1) and not ve_precios_venta(), 'permisos de ingeniería de procesos';

  -- La gerencia ve las métricas, sin costos.
  perform pg_temp.como(v_gp);
  m := metricas_produccion(current_date - 30, current_date);
  assert not (m->>'con_costos')::boolean, 'la gerencia de producción vio costos';
  assert (select e->'costo_real' = 'null'::jsonb from jsonb_array_elements(m->'etapas') e where e->>'etapa' = 'Pailería'), 'la gerencia vio el costo real';

  -- El supervisor y ventas no.
  perform pg_temp.como(v_sup);
  begin perform metricas_produccion(current_date - 30, current_date); v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'el supervisor vio las métricas';
  perform pg_temp.como(v_vend);
  begin perform metricas_produccion(current_date - 30, current_date); v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'ventas vio las métricas';
end $$;

-- Una orden cargada ya terminada (terminada antes de existir en el ERP) cuenta como
-- terminada, pero no mueve el lead time a negativo.
do $$
declare v_ip uuid; v_eq uuid; m jsonb;
begin
  perform pg_temp.como_postgres();
  v_ip := pg_temp.usuario('ip155b@hegamex.com', '{ingenieria_procesos}');
  insert into articulos (clave, tipo, nombre) values ('T155N-EQ', 'equipo', 'Tolva hoja 155') returning id into v_eq;
  insert into ordenes_produccion (articulo_id, cantidad, estado, terminada_en) values (v_eq, 1, 'terminada', now() - interval '3 days');
  perform pg_temp.como(v_ip);
  m := metricas_produccion(current_date - 30, current_date);
  assert coalesce((m->'resumen'->>'lead_time_dias')::numeric, 0) >= 0, 'lead time negativo: ' || (m->'resumen')::text;
  assert coalesce((m->'resumen'->>'eficiencia_flujo')::numeric, 0) >= 0, 'eficiencia negativa';
end $$;

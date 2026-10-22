-- Avance de una etapa en proceso: lo reporta el piso, cuenta en el avance de la orden, en lo
-- que le falta al área y en el plan; la cuadrilla sale aunque nadie haya abierto su tiempo.
do $$
declare v_sup uuid; v_ven uuid; v_eq uuid; o uuid; x1 uuid; x2 uuid; e1 uuid; e2 uuid; v_pai int; v_pin int; v_ok boolean;
begin
  v_sup := pg_temp.usuario('sup161@hegamex.com', '{produccion}');
  v_ven := pg_temp.usuario('ven161@hegamex.com', '{ventas}');
  select id into v_pai from etapas where nombre = 'Pailería';
  select id into v_pin from etapas where nombre = 'Pintura';
  insert into empleados (nombre, fecha_ingreso, etapa_id, departamento_id) values ('Genaro Prueba Ciento Uno', current_date, v_pai, departamento_produccion()) returning id into e1;
  insert into empleados (nombre, fecha_ingreso, etapa_id, departamento_id) values ('Isaias Prueba', current_date, v_pai, departamento_produccion()) returning id into e2;
  insert into articulos (clave, tipo, nombre) values ('T161-EQ', 'equipo', 'Tren 161') returning id into v_eq;
  insert into ordenes_produccion (articulo_id, cantidad, estado) values (v_eq, 1, 'en_proceso') returning id into o;
  insert into op_operaciones (orden_id, etapa_id, horas_estimadas, estado, inicio) values (o, v_pai, 400, 'en_proceso', now() - interval '20 days') returning id into x1;
  insert into op_operaciones (orden_id, etapa_id, horas_estimadas) values (o, v_pin, 100) returning id into x2;
  insert into op_asignaciones (operacion_id, empleado_id) values (x1, e1), (x1, e2);

  -- Sin tiempos abiertos, la cuadrilla planeada; «e» antes de I.
  assert cuadrilla_de(x1) = 'Genaro Prueba e Isaias', format('cuadrilla: %s', cuadrilla_de(x1));
  assert (select avance from v_tablero_produccion where id = o) = 0, 'sin reportar, avance 0';

  -- Ventas no reporta; el supervisor sí, y solo de lo empezado.
  perform pg_temp.como(v_ven);
  begin perform reportar_avance(x1, 0.75); v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'ventas reportó avance';
  perform pg_temp.como(v_sup);
  begin perform reportar_avance(x2, 0.5); v_ok := true; exception when raise_exception then v_ok := false; end;
  assert not v_ok, 'reportó avance de una etapa sin empezar';
  begin perform reportar_avance(x1, 1); v_ok := true; exception when check_violation then v_ok := false; end;
  assert not v_ok, 'reportó 100 % en lugar de terminar';
  perform reportar_avance(x1, 0.75);

  -- 300 de 500 h: 60 %; faltan 200 h; Pailería tiene 100 h por hacer; el plan cuenta 100 h.
  assert (select avance from v_tablero_produccion where id = o) = 60, format('avance %s', (select avance from v_tablero_produccion where id = o));
  assert (select horas_pendientes from v_tablero_produccion where id = o) = 200, 'horas pendientes';
  assert (select (etapas_activas->0->>'cuadrilla') from v_tablero_produccion where id = o) = 'Genaro Prueba e Isaias', 'el tablero no trae la cuadrilla';
  assert (select avance_etapa from v_piso_operaciones where id = x1) = 0.75, 'el piso no trae el avance';
  assert (select horas_restantes from plan_produccion() where operacion_id = x1) = 100, 'el plan no usó el avance';
  perform pg_temp.como_postgres();
  assert exists (select 1 from op_eventos where operacion_id = x1 and nota like 'Pailería lleva 75 %%'), 'no quedó en la historia';

  -- Con alguien trabajando de verdad, manda quien tiene su tiempo abierto.
  insert into op_tiempos (operacion_id, orden_id, empleado_id, inicio) values (x1, o, e2, now());
  assert cuadrilla_de(x1) = 'Isaias', format('cuadrilla con tiempo abierto: %s', cuadrilla_de(x1));
end $$;

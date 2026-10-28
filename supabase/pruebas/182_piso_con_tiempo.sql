-- La TV pinta de verde solo a quien tiene su tiempo corriendo: una etapa «en proceso» con su
-- cuadrilla planeada y nadie arrancado no cuenta como trabajando (Pailería de OP-2026-00023).
do $$
declare v_tv uuid; v_eq uuid; v_op uuid; v_x uuid; v_emp uuid; v_pai int; r record;
begin
  v_tv := pg_temp.usuario('tv182@hegamex.com', '{pantalla}');
  select id into v_pai from etapas where nombre = 'Pailería';
  insert into articulos (clave, tipo, nombre) values ('T182-EQ', 'equipo', 'Equipo 182') returning id into v_eq;
  insert into ordenes_produccion (articulo_id, cantidad, estado) values (v_eq, 1, 'en_proceso') returning id into v_op;
  insert into op_operaciones (orden_id, etapa_id, horas_estimadas, estado, inicio) values (v_op, v_pai, 10, 'en_proceso', now()) returning id into v_x;
  insert into empleados (nombre, fecha_ingreso, departamento_id, en_cuadrillas) values ('Genaro Prueba 182', current_date, departamento_produccion(), true) returning id into v_emp;
  insert into op_asignaciones (operacion_id, empleado_id) values (v_x, v_emp);

  -- Planeado y sin arrancar: la TV sabe quién es, pero no lo da por trabajando.
  perform pg_temp.como(v_tv);
  select cuadrilla, con_tiempo into r from v_piso_operaciones where id = v_x;
  assert r.cuadrilla = 'Genaro', format('la cuadrilla planeada no salió: %s', r.cuadrilla);
  assert not r.con_tiempo, 'una etapa sin nadie arrancado salió como trabajando';

  -- Con su tiempo abierto, sí.
  perform pg_temp.como_postgres();
  insert into op_tiempos (operacion_id, orden_id, empleado_id) values (v_x, v_op, v_emp);
  perform pg_temp.como(v_tv);
  assert (select con_tiempo from v_piso_operaciones where id = v_x), 'con su tiempo corriendo no salió como trabajando';

  -- Pausada (tiempo cerrado) ya no corre.
  perform pg_temp.como_postgres();
  update op_tiempos set fin = now() where operacion_id = v_x;
  update op_operaciones set estado = 'pausada' where id = v_x;
  perform pg_temp.como(v_tv);
  assert not (select con_tiempo from v_piso_operaciones where id = v_x), 'una etapa pausada salió como trabajando';
  perform pg_temp.como_postgres();
end $$;

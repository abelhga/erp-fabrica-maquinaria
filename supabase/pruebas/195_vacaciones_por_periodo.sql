-- Vacaciones por periodo con el adelanto marcado: cada vacación se carga al periodo más viejo
-- vigente; si no alcanza, como adelanto al siguiente, que no se perdona al cumplir año. Lo que
-- sobra de un periodo vence 18 meses después de su aniversario.
do $$
declare
  v_rrhh uuid; v_vend uuid; v_trab uuid; e1 uuid; e2 uuid; e3 uuid; e4 uuid; e5 uuid; r record; v_d numeric; v_inc uuid;
begin
  v_rrhh := pg_temp.usuario('rh193@hegamex.com', '{rrhh}');
  v_vend := pg_temp.usuario('ven193@hegamex.com', '{ventas}');
  v_trab := pg_temp.usuario('sold193@hegamex.com', '{produccion}');
  -- El ERP lleva las vacaciones desde hace 13 días.
  update configuracion set valor = to_jsonb((current_date - 13)::text) where clave = 'vacaciones_corte';

  perform pg_temp.como(v_rrhh);
  -- 1. Como Emmanuel: cumple 3 años en 4 días. La hoja ya le había adelantado 4 del periodo de 16
  --    que viene (le quedan 12). Hoy debe 4; al cumplir año no se le perdonan.
  insert into empleados (nombre, fecha_ingreso, departamento_id) values ('P193 Adelanto', (current_date - interval '3 years' + interval '4 days')::date, departamento_produccion())
    returning id into e1;
  insert into vacaciones_arranque (empleado_id, fecha, periodo, saldo, nota) values (e1, current_date - 13, 3, 12, 'proporcionales 2026');
  select * into r from v_vacaciones where empleado_id = e1;
  assert r.anios = 2 and r.disponible = 0 and r.adelantados = 4 and r.saldo = -4, format('adelanto en el arranque: %s', row_to_json(r));
  select * into r from vacaciones_periodos(e1) p where p.periodo = 3;
  assert r.estado = 'por_venir' and r.restan = 12 and r.adelantados = 4, format('periodo que viene: %s', row_to_json(r));

  --    El mismo caso dos días después del aniversario: le quedan 12, no 16 (la regla vieja le daba 16).
  insert into empleados (nombre, fecha_ingreso, departamento_id) values ('P193 Ya cumplió', (current_date - interval '3 years' - interval '2 days')::date, departamento_produccion())
    returning id into e2;
  insert into vacaciones_arranque (empleado_id, fecha, periodo, saldo) values (e2, current_date - 13, 3, 12);
  select * into r from v_vacaciones where empleado_id = e2;
  assert r.anios = 3 and r.dias_periodo = 16 and r.saldo = 12 and r.tomados = 4 and r.adelantados = 0, format('después del aniversario: %s', row_to_json(r));

  -- 2. Del periodo anterior le quedaban 3 (vigente 4 meses más). Una vacación de una semana usa
  --    primero esos 3 y el resto del periodo nuevo.
  insert into empleados (nombre, fecha_ingreso, usuario_id, departamento_id) values ('P193 Dos periodos', (current_date - interval '2 years 2 months')::date, v_trab, departamento_produccion())
    returning id into e3;
  insert into vacaciones_arranque (empleado_id, fecha, periodo, saldo) values (e3, current_date - 13, 1, 3);
  insert into incidencias (empleado_id, tipo, inicio, fin, estado, dias) values (e3, 'vacaciones', current_date - 10, current_date - 1, 'aprobada', 1)
    returning id, dias into v_inc, v_d;
  assert v_d > 3, format('la semana debía tener más de 3 días hábiles: %s', v_d);
  assert (select sum(c.dias) filter (where c.periodo = 1) = 3 and sum(c.dias) filter (where c.periodo = 2) = v_d - 3 and not bool_or(c.adelanto)
          and count(*) = 2 from vacaciones_cargos(e3) c), format('reparto: %s', (select json_agg(c) from vacaciones_cargos(e3) c));
  select * into r from v_vacaciones where empleado_id = e3;
  assert r.saldo = 14 - (v_d - 3) and r.dias_vence_primero = 14 - (v_d - 3), format('dos periodos: %s', row_to_json(r));
  --    Cancelarla regresa todo como estaba (nada queda guardado a mano).
  update incidencias set estado = 'rechazada' where id = v_inc;
  assert (select saldo from v_vacaciones where empleado_id = e3) = 17, 'rechazarla no regresó los días a sus periodos';
  assert (select dias_vence_primero from v_vacaciones where empleado_id = e3) = 3, 'lo que vence primero es lo del periodo anterior';
  update incidencias set estado = 'aprobada' where id = v_inc;

  -- 3. Antes del primer año todo es adelanto del periodo 1.
  insert into empleados (nombre, fecha_ingreso, departamento_id) values ('P193 Nuevo', (current_date - interval '6 months')::date, departamento_produccion())
    returning id into e4;
  insert into incidencias (empleado_id, tipo, inicio, fin, estado, dias) values (e4, 'vacaciones', current_date - 3, current_date - 1, 'aprobada', 1)
    returning dias into v_d;
  select * into r from v_vacaciones where empleado_id = e4;
  assert r.anios = 0 and r.adelantados = v_d and r.saldo = -v_d, format('primer año: %s', row_to_json(r));
  assert (select bool_and(c.adelanto) and min(c.periodo) = 1 from vacaciones_cargos(e4) c), 'no quedó como adelanto del periodo 1';

  -- 4. Lo que sobró de un periodo que ya venció (18 meses) se pierde.
  insert into empleados (nombre, fecha_ingreso, departamento_id) values ('P193 Vencido', (current_date - interval '2 years 8 months')::date, departamento_produccion())
    returning id into e5;
  insert into vacaciones_arranque (empleado_id, fecha, periodo, saldo) values (e5, current_date - 13, 1, 5);
  select * into r from vacaciones_periodos(e5) p where p.periodo = 1;
  assert r.estado = 'vencido' and r.restan = 5, format('periodo vencido: %s', row_to_json(r));
  assert (select saldo from v_vacaciones where empleado_id = e5) = 14, 'contó días de un periodo vencido';

  -- 5. Sin arranque: lo de antes del corte se da por usado (el ERP no sabe qué tomó).
  delete from vacaciones_arranque where empleado_id = e5;
  assert (select saldo from v_vacaciones where empleado_id = e5) = 14, 'sin arranque cambió el periodo que corre';
  --    Un arranque sin periodo es del que corría ese día.
  insert into vacaciones_arranque (empleado_id, fecha, saldo) values (e5, current_date - 13, 9);
  assert (select periodo from vacaciones_arranque where empleado_id = e5) = 2, 'no se le puso el periodo que corría';

  -- Quién ve qué: el empleado sus periodos; un vendedor, nada.
  perform pg_temp.como(v_trab);
  assert (select count(*) from vacaciones_periodos(e3)) >= 2, 'el empleado no ve sus periodos';
  assert not exists (select 1 from vacaciones_periodos(e1)), 'el empleado vio los periodos de otro';
  perform pg_temp.como(v_vend);
  assert not exists (select 1 from vacaciones_cargos(e3)) and not exists (select 1 from v_vacaciones where empleado_id = e3), 'un vendedor vio vacaciones';
  perform pg_temp.como_postgres();
end $$;

-- Expediente (sangre, Infonavit, contratos) y saldo de vacaciones con que arranca el ERP.
do $$
declare
  v_rrhh uuid; v_ger uuid; v_vend uuid; v_trab uuid; v_emp uuid; v_emp2 uuid; v_n int; v_d numeric; r record;
begin
  v_rrhh := pg_temp.usuario('rh107@hegamex.com', '{rrhh}');
  v_ger := pg_temp.usuario('gp107@hegamex.com', '{gerente_produccion}');
  v_vend := pg_temp.usuario('ven107@hegamex.com', '{ventas}');
  v_trab := pg_temp.usuario('sold107@hegamex.com', '{produccion}');

  perform pg_temp.como(v_rrhh);
  -- 3 años y 2 meses: le tocan 16 días en este periodo, que empezó hace 2 meses.
  insert into empleados (nombre, fecha_ingreso, usuario_id, departamento_id) values ('Prueba Arranque', (current_date - interval '3 years 2 months')::date, v_trab, departamento_produccion())
    returning id into v_emp;
  insert into empleados (nombre, fecha_ingreso, departamento_id) values ('Prueba Sin Saldo', (current_date - interval '3 years 2 months')::date, departamento_produccion())
    returning id into v_emp2;

  -- Expediente: solo valores conocidos.
  insert into empleado_datos (empleado_id, tipo_sangre, informacion_medica, infonavit_descuento, contrato_trabajo, contrato_adicional)
    values (v_emp, 'O+', 'Alergia a la penicilina', '$1,200 semanal', 'firmado', 'no_aplica');
  begin
    update empleado_datos set tipo_sangre = 'ORH+' where empleado_id = v_emp;
    assert false, 'aceptó un tipo de sangre que no existe';
  exception when check_violation then null;
  end;
  begin
    update empleado_datos set contrato_trabajo = 'no_aplica' where empleado_id = v_emp;
    assert false, 'el contrato de trabajo no puede ser "no aplica"';
  exception when check_violation then null;
  end;

  -- Sin saldo de arranque: como siempre, por ley.
  select * into r from v_vacaciones where empleado_id = v_emp;
  assert r.saldo = 16 and r.tomados = 0 and r.saldo_arranque is null, format('sin arranque: %s', row_to_json(r));

  -- La hoja decía que le quedan 5 (puede traer días de antes): eso manda.
  insert into vacaciones_arranque (empleado_id, fecha, saldo, nota) values (v_emp, current_date - 10, 5, 'Control de vacaciones');
  select * into r from v_vacaciones where empleado_id = v_emp;
  assert r.saldo = 5 and r.tomados = 11 and r.saldo_arranque = 5, format('con arranque: %s', row_to_json(r));

  -- Lo aprobado antes de la fecha de arranque ya venía descontado en la hoja; lo de después se resta.
  insert into incidencias (empleado_id, tipo, inicio, fin, estado, dias) values
    -- De dos días: uno solo cae en domingo según el día que se corra y se rechaza (sin días hábiles).
    (v_emp, 'vacaciones', current_date - 20, current_date - 19, 'aprobada', 2),
    (v_emp, 'vacaciones', current_date - 5, current_date - 4, 'aprobada', 2),
    (v_emp, 'vacaciones', current_date + 5, current_date + 6, 'solicitada', 2);
  -- Los días se cuentan en días hábiles: depende de qué día caiga hoy.
  select sum(dias) into v_d from incidencias where empleado_id = v_emp and estado = 'aprobada' and inicio >= current_date - 10;
  select * into r from v_vacaciones where empleado_id = v_emp;
  assert r.saldo = 5 - v_d and r.tomados = 11 + v_d and r.solicitados > 0, format('arranque menos lo tomado después (%s): %s', v_d, row_to_json(r));
  -- La otra persona no se ve afectada.
  assert (select saldo from v_vacaciones where empleado_id = v_emp2) = 16, 'el arranque es por persona';

  -- Un arranque del periodo anterior no se pierde al cumplir año (193): lo que quedaba de ese
  -- periodo se usa primero, hasta que vence, y el periodo nuevo llega completo.
  update vacaciones_arranque set fecha = current_date - interval '3 months', periodo = 2 where empleado_id = v_emp;
  select sum(dias) into v_d from incidencias where empleado_id = v_emp and estado = 'aprobada';
  select * into r from v_vacaciones where empleado_id = v_emp;
  assert r.saldo_arranque = 5 and r.saldo = 16 + 5 - v_d and r.dias_vence_primero = 5 - v_d, format('arranque del periodo anterior: %s', row_to_json(r));
  update vacaciones_arranque set fecha = current_date - 10, periodo = 3 where empleado_id = v_emp;
  select sum(dias) into v_d from incidencias where empleado_id = v_emp and estado = 'aprobada' and inicio >= current_date - 10;

  -- La gerencia de producción ve el saldo (rrhh 1) pero no lo corrige ni ve el expediente.
  perform pg_temp.como(v_ger);
  assert (select saldo from v_vacaciones where empleado_id = v_emp) = 5 - v_d, 'la gerencia ve el saldo con arranque';
  update vacaciones_arranque set saldo = 30 where empleado_id = v_emp;
  get diagnostics v_n = row_count;
  assert v_n = 0, 'la gerencia de producción corrigió un saldo';
  begin
    insert into vacaciones_arranque (empleado_id, fecha, saldo) values (v_emp2, current_date, 30);
    assert false, 'la gerencia de producción creó un saldo de arranque';
  exception when insufficient_privilege then null;
  end;
  assert not exists (select 1 from empleado_datos where empleado_id = v_emp), 'la gerencia vio el expediente';

  -- El propio empleado ve su saldo; un vendedor no ve el de nadie.
  perform pg_temp.como(v_trab);
  assert (select saldo from v_vacaciones where empleado_id = v_emp) = 5 - v_d, 'el empleado ve su saldo';
  assert exists (select 1 from vacaciones_arranque where empleado_id = v_emp), 'el empleado ve su arranque';
  assert not exists (select 1 from vacaciones_arranque where empleado_id = v_emp2), 'el empleado vio el arranque de otro';
  perform pg_temp.como(v_vend);
  assert not exists (select 1 from vacaciones_arranque), 'un vendedor vio saldos de arranque';
  assert not exists (select 1 from empleado_datos), 'un vendedor vio expedientes';

  -- RRHH lo corrige y queda en la bitácora.
  perform pg_temp.como(v_rrhh);
  insert into vacaciones_arranque (empleado_id, fecha, saldo, nota) values (v_emp, current_date, 4, 'Corrección')
    on conflict (empleado_id) do update set fecha = excluded.fecha, saldo = excluded.saldo, nota = excluded.nota;
  assert (select saldo from v_vacaciones where empleado_id = v_emp) = 4, 'saldo corregido';
  perform pg_temp.como_postgres();
  assert exists (select 1 from bitacora where tabla = 'vacaciones_arranque' and registro_id = v_emp::text), 'el cambio quedó en la bitácora';
end $$;

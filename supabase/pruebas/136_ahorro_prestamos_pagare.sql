-- Caja de ahorro (aportación que elige cada quien, saldo, retiro con anticipación y recibo),
-- abonos extra a préstamos, pagaré y descuento del saldo en el finiquito.
do $$
declare v_rh uuid; v_fin uuid; v_ven uuid; e_a uuid; e_b uuid; v_ok boolean; r record; v_id uuid; v_pres uuid; d jsonb;
  s1 date := '2025-02-07'; s2 date := '2025-02-14';
begin
  v_rh := pg_temp.usuario('rh136@hegamex.com', '{rrhh}');
  v_fin := pg_temp.usuario('fin136@hegamex.com', '{finanzas}');
  v_ven := pg_temp.usuario('ven136@hegamex.com', '{ventas}');
  perform pg_temp.como(v_rh);
  insert into empleados (nombre, fecha_ingreso) values ('Ahorradora Prueba136', '2023-01-02') returning id into e_a;
  insert into empleados (nombre, fecha_ingreso) values ('Deudor Prueba136', '2023-01-02') returning id into e_b;
  insert into nomina_sueldos (empleado_id, sueldo_semanal, desde, motivo) values (e_a, 3500, '2025-01-01', 'Prueba'), (e_b, 3500, '2025-01-01', 'Prueba');
  perform fijar_reglas_ahorro_prestamos(10, 0, 0);

  -- Ahorro: lo que eligió se descuenta solo cada semana.
  perform pg_temp.como(v_ven);
  begin perform fijar_ahorro_semanal(e_a, 200, s1, 'Lo pidió'); v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'ventas no captura ahorro';
  perform pg_temp.como(v_rh);
  perform fijar_ahorro_semanal(e_a, 200, s1, 'Lo pidió la colaboradora');
  select * into r from prenomina(s1) where empleado_id = e_a;
  assert r.deducciones = 200 and r.neto = 3300, format('descuenta el ahorro: %s', row_to_json(r));
  assert exists (select 1 from jsonb_array_elements(r.conceptos) c where c->>'clave' = 'ahorro' and (c->>'importe')::numeric = 200), 'el concepto sale en su renglón';

  -- Préstamo con folio; un abono en efectivo baja el saldo antes de cerrar.
  insert into nomina_prestamos (empleado_id, monto, descuento_semanal, primera_semana, motivo) values (e_b, 1000, 100, s1, 'Préstamo de prueba')
  returning id into v_pres;
  assert (select folio from nomina_prestamos where id = v_pres) like 'PR-%', 'el préstamo lleva folio';
  v_id := abonar_prestamo(v_pres, 300, s1 + 2, 'Abonó de su aguinaldo');
  assert (select saldo from prestamos_nomina() where id = v_pres) = 700 and (select pagado_aparte from prestamos_nomina() where id = v_pres) = 300, 'el abono baja el saldo';
  begin perform abonar_prestamo(v_pres, 701, s1 + 2); v_ok := true; exception when raise_exception then v_ok := false; end;
  assert not v_ok, 'no se abona más que el saldo';
  d := documento_nomina('abono', v_id);
  assert d->>'folio' like 'RC-%' and (d->>'saldo_despues')::numeric = 700 and d->'empleado'->>'nombre' = 'Deudor Prueba136', format('recibo del abono: %s', d);
  begin perform fijar_abono_semana(v_pres, s1, 800); v_ok := true; exception when raise_exception then v_ok := false; end;
  assert not v_ok, 'en la nómina tampoco se descuenta más que el saldo';
  perform fijar_abono_semana(v_pres, s1, 250);
  assert (select prestamos from prenomina(s1) where empleado_id = e_b) = 250, 'esta semana descuenta lo que fijó RRHH';

  -- Al cerrar: el ahorro pasa al saldo y el préstamo baja.
  perform cerrar_semana_nomina(s1);
  select * into r from ahorro_nomina() where empleado_id = e_a;
  assert r.aportado = 200 and r.saldo = 200 and r.ahorro_semanal = 200, format('saldo después de cerrar: %s', row_to_json(r));
  assert (select saldo from prestamos_nomina() where id = v_pres) = 450, 'el préstamo baja con lo descontado en nómina';

  -- Saldo con que arrancó, una sola vez.
  perform saldo_inicial_ahorro(e_a, 1000, s1, 'Control de Excel');
  begin perform saldo_inicial_ahorro(e_a, 50, s1); v_ok := true; exception when raise_exception then v_ok := false; end;
  assert not v_ok, 'el saldo inicial es uno solo';

  -- Retiro: con su anticipación, sin pasarse del saldo, con folio y recibo.
  begin perform retirar_ahorro(e_a, 5000, hoy_planta() - 20, hoy_planta() - 5); v_ok := true; exception when raise_exception then v_ok := false; end;
  assert not v_ok, 'no se retira más que el saldo';
  begin perform retirar_ahorro(e_a, 100, hoy_planta() - 3, hoy_planta()); v_ok := true; exception when raise_exception then v_ok := sqlerrm not like '%10 días%'; end;
  assert not v_ok, 'sin los 10 días de anticipación no se registra';
  v_id := retirar_ahorro(e_a, 500, hoy_planta() - 15, hoy_planta() - 5, 'Para útiles');
  d := documento_nomina('retiro', v_id);
  assert d->>'folio' like 'AH-%' and (d->>'saldo_despues')::numeric = 700 and (d->>'importe')::numeric = 500, format('recibo del retiro: %s', d);
  assert (select saldo from ahorro_nomina() where empleado_id = e_a) = 700, 'el retiro baja el saldo';

  -- La empresa pone un %, y el ahorro capturado a mano esa semana manda sobre el automático.
  perform fijar_reglas_ahorro_prestamos(10, 50, 0);
  insert into nomina_movimientos (semana, empleado_id, concepto, importe, nota) values (s2, e_a, 'ahorro', 50, 'Esta semana solo 50');
  select * into r from prenomina(s2) where empleado_id = e_a;
  assert r.deducciones = 50, format('lo capturado a mano reemplaza al automático: %s', r.deducciones);

  -- Finiquito: si se va debiendo, se descuenta el saldo completo; si tiene ahorro, se avisa.
  update empleados set activo = false, baja_en = s2 + 3, motivo_baja = 'Renuncia' where id in (e_a, e_b);
  select * into r from prenomina(s2) where empleado_id = e_b;
  assert r.prestamos = 450, format('el saldo completo al finiquito: %s', r.prestamos);
  assert exists (select 1 from unnest(r.avisos) a where a like '%finiquito%'), format('avisa del finiquito: %s', r.avisos);
  select * into r from prenomina(s2) where empleado_id = e_a;
  assert exists (select 1 from unnest(r.avisos) a where a like '%caja de ahorro%'), format('avisa del ahorro por entregar: %s', r.avisos);
  perform cerrar_semana_nomina(s2);
  select * into r from ahorro_nomina() where empleado_id = e_a;
  assert r.aportado = 250 and r.empresa = 25 and r.saldo = 775, format('la empresa puso el 50 %% de lo de esa semana: %s', row_to_json(r));
  assert (select saldo from prestamos_nomina() where id = v_pres) = 0, 'liquidado en el finiquito';

  -- Pagaré: se imprime sin interés y se anota la firma.
  d := documento_nomina('pagare', v_pres);
  assert (d->>'monto')::numeric = 1000 and (d->>'interes_moratorio_pct')::numeric = 0 and (d->>'semanas')::int = 10, format('pagaré: %s', d);
  perform marcar_pagare_firmado(v_pres, s1);
  assert (select pagare_firmado_el from nomina_prestamos where id = v_pres) = s1, 'firma anotada';

  -- Lo registrado no se cambia; finanzas ve pero no registra.
  perform pg_temp.como_postgres();
  begin update nomina_ahorro_movimientos set importe = 1 where empleado_id = e_a; v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'un movimiento de ahorro no se cambia';
  begin delete from nomina_prestamo_pagos where prestamo_id = v_pres; v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'un abono no se borra';
  perform pg_temp.como(v_fin);
  assert exists (select 1 from ahorro_nomina() where empleado_id = e_a), 'finanzas ve el ahorro';
  begin perform retirar_ahorro(e_a, 10, hoy_planta() - 15, hoy_planta()); v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'finanzas no registra retiros';
  assert (documento_nomina('pagare', v_pres)->'empleado'->>'domicilio') is null, 'el domicilio no sale para quien no ve datos sensibles';
  perform pg_temp.como(v_ven);
  begin perform ahorro_nomina(); v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'ventas no ve el ahorro de nadie';
end $$;

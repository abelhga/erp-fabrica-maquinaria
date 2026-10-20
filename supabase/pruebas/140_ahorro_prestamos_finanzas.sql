-- Los retiros de ahorro y los abonos en efectivo quedan en finanzas: de qué cuenta salió
-- o a cuál entró, en la cuenta de un acreedor de nómina que queda en cero, y en la caja
-- chica cuando el dinero fue de ahí. RRHH lo registra aunque no tenga permiso de finanzas.
do $$
declare v_rh uuid; v_fin uuid; e_a uuid; e_b uuid; v_ok boolean; v_id uuid; v_pres uuid; r record; v_caja numeric;
begin
  v_rh := pg_temp.usuario('rh140@hegamex.com', '{rrhh}');
  v_fin := pg_temp.usuario('fin140@hegamex.com', '{finanzas}');
  perform pg_temp.como(v_rh);
  assert not puede('finanzas', 2), 'RRHH no tiene finanzas: la prueba es que aun así queda registrado';
  insert into empleados (nombre, fecha_ingreso) values ('Ahorradora Prueba140', '2023-01-02') returning id into e_a;
  insert into empleados (nombre, fecha_ingreso) values ('Deudor Prueba140', '2023-01-02') returning id into e_b;
  perform fijar_reglas_ahorro_prestamos(10, 0, 0);
  perform saldo_inicial_ahorro(e_a, 2000, hoy_planta() - 60, 'Control de Excel');

  -- Sin cuenta, con nota de crédito o con fecha de entrega futura, no se registra.
  begin perform retirar_ahorro(e_a, 100, hoy_planta() - 15, hoy_planta(), null); v_ok := true; exception when sqlstate '22023' then v_ok := false; end;
  assert not v_ok, 'el retiro dice de qué cuenta salió';
  begin perform retirar_ahorro(e_a, 100, hoy_planta() - 15, hoy_planta(), 'nota_credito'); v_ok := true; exception when sqlstate '22023' then v_ok := false; end;
  assert not v_ok, 'una nota de crédito no es dinero';
  begin perform retirar_ahorro(e_a, 100, hoy_planta() - 5, hoy_planta() + 5, 'no_fiscal'); v_ok := true;
  exception when raise_exception then v_ok := sqlerrm not like '%día que se le entrega%'; end;
  assert not v_ok, 'se registra el día que se entrega, no antes';

  -- Retiro de una cuenta de banco: pago en "Pagos hechos", el acreedor queda en cero.
  v_id := retirar_ahorro(e_a, 500, hoy_planta() - 15, hoy_planta(), 'santander_fiscal', 'Para útiles');
  assert (select cuenta from nomina_ahorro_movimientos where id = v_id) = 'santander_fiscal', 'el retiro guarda la cuenta';

  -- Abono en efectivo a la caja chica: entra al libro de la caja.
  insert into nomina_prestamos (empleado_id, monto, descuento_semanal, primera_semana, motivo)
  values (e_b, 1000, 100, hoy_planta() - ((extract(isodow from hoy_planta())::int + 2) % 7) + 7, 'Préstamo de prueba') returning id into v_pres;
  perform pg_temp.como_postgres();
  v_caja := coalesce((select sum(importe) from caja_chica), 0);
  perform pg_temp.como(v_rh);
  v_id := abonar_prestamo(v_pres, 300, hoy_planta(), 'caja_chica', 'De su aguinaldo');
  assert (select cuenta from nomina_prestamo_pagos where id = v_id) = 'caja_chica', 'el abono guarda la cuenta';
  begin perform abonar_prestamo(v_pres, 50, hoy_planta(), null); v_ok := true; exception when sqlstate '22023' then v_ok := false; end;
  assert not v_ok, 'el abono dice a qué cuenta entró';

  -- Finanzas lo ve.
  perform pg_temp.como(v_fin);
  select * into r from v_pagos_hechos where proveedor = 'Caja de ahorro del personal' and referencia like 'AH-%' and descripcion like '%Prueba140%';
  assert r.monto = 500 and r.cuenta = 'santander_fiscal' and r.tipo_acreedor = 'nomina', format('el retiro sale en pagos hechos: %s', row_to_json(r));
  assert (select saldo from v_saldo_arranque_proveedores s join proveedores p on p.id = s.proveedor_id
          where p.nombre = 'Caja de ahorro del personal') = 0, 'la caja de ahorro no queda debiendo ni a favor';
  select * into r from movimientos_proveedor m join proveedores p on p.id = m.proveedor_id
  where p.nombre = 'Préstamos al personal' and m.tipo = 'reembolso_realizado' and m.descripcion like '%Prueba140%';
  assert r.monto = 300 and r.cuenta = 'caja_chica' and r.factura like 'RC-%', format('el abono entra a la cuenta: %s', row_to_json(r));
  assert (select saldo from v_saldo_arranque_proveedores s join proveedores p on p.id = s.proveedor_id
          where p.nombre = 'Préstamos al personal') = 0, 'préstamos al personal queda en cero';
  assert (select sum(importe) from caja_chica) = v_caja + 300, 'el abono entra a la caja chica';
  assert exists (select 1 from caja_chica where concepto like 'Abono a préstamo PR-%Prueba140' and tipo = 'entrada'), 'con su concepto';
  assert exists (select 1 from avisos where usuario_id = v_fin and tipo = 'ahorro_retiro'), 'a finanzas le llega el aviso del retiro';
  assert exists (select 1 from avisos where usuario_id = v_fin and tipo = 'prestamo_abono'), 'y el del abono';

  -- Finanzas sigue sin registrar retiros ni abonos (eso es de RRHH).
  begin perform abonar_prestamo(v_pres, 10, hoy_planta(), 'no_fiscal'); v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'finanzas no registra abonos';
  -- Las funciones de apoyo no se llaman desde fuera.
  begin perform acreedor_personal('Otro'); v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'acreedor_personal es interna';
end $$;

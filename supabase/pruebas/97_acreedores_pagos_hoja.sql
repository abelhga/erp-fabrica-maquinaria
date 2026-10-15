-- Socios y bancos aparte de proveedores, y pagos en el ERP a saldos de la hoja:
-- bajan el saldo, no dejan pagar de más, no se cuentan dos veces si la hoja ya
-- trae el mismo pago, y solo finanzas los registra y los ve.
do $$
declare v_fin uuid; v_com uuid; v_prov uuid; v_socio uuid; v_pago uuid; v_pago2 uuid; s record; t jsonb; v_antes jsonb; v_estado text;
begin
  v_fin := pg_temp.usuario('fin97@hegamex.com', '{finanzas}');
  v_com := pg_temp.usuario('com97@hegamex.com', '{compras}');
  insert into proveedores (nombre) values ('T97 Aduanal del Pacífico') returning id into v_prov;
  insert into proveedores (nombre, tipo_acreedor) values ('T97 Socio (préstamos)', 'socio') returning id into v_socio;
  -- El tablero de antes, para medir solo lo que agrega esta prueba (la base puede traer datos).
  perform pg_temp.como(v_fin);
  v_antes := tablero_direccion() -> 'por_pagar';
  perform pg_temp.como_postgres();
  insert into historial_compras_hoja (fecha, proveedor_id, proveedor_nombre, proveedor_llave, tipo, monto) values
    ('2026-09-01', v_prov, 'T97 Aduanal del Pacífico', 't97 aduanal', 'Compra', 10000),
    ('2026-09-01', v_socio, 'T97 Socio (préstamos)', 't97 socio', 'Compra', 50000);
  perform pg_temp.como(v_fin);

  -- El préstamo del socio no es deuda con proveedores: va en su renglón.
  t := tablero_direccion() -> 'por_pagar';
  assert (t ->> 'arranque')::numeric - (v_antes ->> 'arranque')::numeric = 10000, format('proveedores: %s vs %s', t, v_antes);
  assert (t ->> 'socios')::numeric - (v_antes ->> 'socios')::numeric = 50000, format('socios: %s vs %s', t, v_antes);
  assert (select tipo_acreedor from v_saldo_arranque_proveedores where proveedor_llave = 't97 socio') = 'socio', 'la vista no trae el tipo';

  -- Pagar baja el saldo en el ERP.
  v_pago := pagar_saldo_hoja('t97 aduanal', 3000, '2026-10-10', 'transferencia', 'SPEI 123');
  select * into s from v_saldo_arranque_proveedores where proveedor_llave = 't97 aduanal';
  assert s.saldo_hoja = 10000 and s.pagado_erp = 3000 and s.saldo = 7000 and s.ultimo_pago = '2026-10-10', format('después del pago: %s', row_to_json(s));
  assert (select registrado_por from pagos_saldo_hoja where id = v_pago) = v_fin, 'no quedó quién lo registró';

  -- No deja pagar de más ni montos en cero.
  begin
    perform pagar_saldo_hoja('t97 aduanal', 7001);
    v_estado := 'pagó de más';
  exception when invalid_parameter_value then v_estado := 'negado';
  end;
  assert v_estado = 'negado', 'dejó pagar más que el saldo';
  begin
    perform pagar_saldo_hoja('t97 aduanal', 0);
    v_estado := 'pagó cero';
  exception when invalid_parameter_value then v_estado := 'negado';
  end;
  assert v_estado = 'negado', 'dejó pagar cero';

  -- Si la hoja también trae ese pago (mismo monto, días después), no se descuenta dos veces.
  perform pg_temp.como_postgres();
  insert into historial_compras_hoja (fecha, proveedor_id, proveedor_nombre, proveedor_llave, tipo, monto)
  values ('2026-10-12', v_prov, 'T97 Aduanal del Pacífico', 't97 aduanal', 'Pago', 3000);
  perform pg_temp.como(v_fin);
  assert (select en_hoja from v_pagos_saldo_hoja where id = v_pago), 'no lo marcó como ya en la hoja';
  select * into s from v_saldo_arranque_proveedores where proveedor_llave = 't97 aduanal';
  assert s.saldo = 7000 and s.pagado_erp = 0, format('se contó dos veces: %s', row_to_json(s));

  -- Un pago mal capturado se borra (queda en la bitácora) y el saldo regresa.
  v_pago2 := pagar_saldo_hoja('t97 aduanal', 500);
  assert (select saldo from v_saldo_arranque_proveedores where proveedor_llave = 't97 aduanal') = 6500, 'el segundo pago no bajó el saldo';
  delete from pagos_saldo_hoja where id = v_pago2;
  assert (select saldo from v_saldo_arranque_proveedores where proveedor_llave = 't97 aduanal') = 7000, 'borrar el pago no regresó el saldo';

  -- Compras (finanzas 1) no paga, no ve los pagos ni los borra.
  perform pg_temp.como(v_com);
  begin
    perform pagar_saldo_hoja('t97 aduanal', 100);
    v_estado := 'pagó';
  exception when insufficient_privilege then v_estado := 'negado';
  end;
  assert v_estado = 'negado', 'compras registró un pago a un saldo de la hoja';
  assert not exists (select 1 from pagos_saldo_hoja where proveedor_llave like 't97%'), 'compras vio los pagos';
  delete from pagos_saldo_hoja where id = v_pago;
  perform pg_temp.como_postgres();
  assert exists (select 1 from pagos_saldo_hoja where id = v_pago), 'compras borró un pago';
  -- Y nadie inserta directo, saltándose la revisión del saldo.
  perform pg_temp.como(v_fin);
  begin
    insert into pagos_saldo_hoja (proveedor_llave, monto) values ('t97 aduanal', 999999);
    v_estado := 'insertó';
  exception when insufficient_privilege then v_estado := 'negado';
  end;
  assert v_estado = 'negado', 'finanzas insertó un pago sin pasar por pagar_saldo_hoja';
end $$;

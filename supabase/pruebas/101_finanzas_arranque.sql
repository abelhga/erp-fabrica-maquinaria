-- Finanzas en el ERP: compras y pagos sin orden de compra continúan el saldo de la
-- hoja, lo pagado se aplica a lo más viejo (vencido), un anticipo solo a propósito,
-- cobros a saldos de clientes de la hoja, caja chica con saldo y arqueo, y quién no
-- debe poder.
do $$
declare
  v_fin uuid; v_com uuid; v_ven uuid; v_prov uuid; v_nuevo uuid; v_cli uuid; v_m uuid; v_c uuid;
  s record; v_estado text; v_dif numeric; v_saldo numeric;
begin
  v_fin := pg_temp.usuario('fin101@hegamex.com', '{finanzas}');
  v_com := pg_temp.usuario('com101@hegamex.com', '{compras}');
  v_ven := pg_temp.usuario('ven101@hegamex.com', '{ventas}');
  insert into proveedores (nombre, categoria, dias_credito) values ('T101 Aceros', 'Aceros', 30) returning id into v_prov;
  insert into proveedores (nombre, categoria) values ('T101 CFE', 'Luz') returning id into v_nuevo;
  insert into clientes (nombre, vendedor_id) values ('T101 Concretos', v_ven) returning id into v_cli;
  -- Lo que viene de la hoja: le debemos 1,000 a Aceros; el cliente nos debe 5,000.
  insert into historial_compras_hoja (fecha, proveedor_id, proveedor_nombre, proveedor_llave, tipo, monto)
  values ('2026-09-01', v_prov, 'T101 Aceros', 't101 aceros', 'Compra', 1000);
  insert into historial_ventas_hoja (fecha, cliente_id, cliente_nombre, tipo, monto)
  values ('2026-09-01', v_cli, 'T101 Concretos', 'Venta', 5000);

  -- Un pago de la hoja que dice qué factura paga se aplica a esa, no a la más vieja.
  insert into historial_compras_hoja (fecha, proveedor_id, proveedor_nombre, proveedor_llave, tipo, monto, factura) values
    ('2026-01-10', v_nuevo, 'T101 CFE', 't101 cfe', 'Compra', 700, 'F-001'),
    ('2026-02-10', v_nuevo, 'T101 CFE', 't101 cfe', 'Compra', 400, 'F 002'),
    ('2026-02-20', v_nuevo, 'T101 CFE', 't101 cfe', 'Pago', 400, 'f002');

  perform pg_temp.como(v_fin);
  -- Una compra en el ERP se suma al saldo de la hoja, con vencimiento por días de crédito.
  v_m := registrar_movimiento_proveedor(v_prov, 'compra', 2000, hoy_planta() - 40, null, 'A-123', 'Lámina');
  assert (select vence_el = hoy_planta() - 10 and categoria = 'Aceros' and proveedor_llave = 't101 aceros'
          from movimientos_proveedor where id = v_m), 'la compra no tomó vencimiento, categoría o llave';
  v_m := registrar_movimiento_proveedor(v_prov, 'compra', 3000, hoy_planta(), null, 'A-124', 'Perfil');
  select * into s from v_saldo_arranque_proveedores where proveedor_llave = 't101 aceros';
  assert s.saldo_hoja = 1000 and s.comprado_erp = 5000 and s.saldo = 6000, format('saldo: %s', row_to_json(s));
  -- Vencido: la de la hoja (1 sep + 30 días de crédito) y la de 2,000 (venció hace 10 días);
  -- la de hoy vence en 30. Cada factura pendiente sale con su folio.
  assert s.vencido = 3000 and s.proximo_vence = hoy_planta() + 30, format('vencido: %s', row_to_json(s));
  assert (select count(*) from v_compras_proveedor_pendientes where proveedor_llave = 't101 aceros' and restante > 0) = 3, 'faltan facturas pendientes';
  -- El tablero de dirección suma lo vencido de las cuentas, no solo el de las órdenes de compra.
  assert (indicadores()->'por_pagar'->>'vencido')::numeric >= 3000, format('inicio: %s', indicadores()->'por_pagar');
  assert (tablero_direccion()->'por_pagar'->>'arranque_vencido')::numeric >= 3000, format('tablero: %s', tablero_direccion()->'por_pagar');
  -- La misma factura electrónica no entra dos veces.
  perform registrar_movimiento_proveedor(v_prov, 'compra', 10, null, null, 'A-200', null, null, null, false, 'aaaaaaaa-1111-2222-3333-bbbbbbbbbbbb', 'PPD');
  begin
    perform registrar_movimiento_proveedor(v_prov, 'compra', 10, null, null, 'A-200', null, null, null, false, 'AAAAAAAA-1111-2222-3333-BBBBBBBBBBBB', 'PPD');
    v_estado := 'repetida';
  exception when unique_violation then v_estado := 'negado';
  end;
  assert v_estado = 'negado', 'entró dos veces la misma factura electrónica';
  delete from movimientos_proveedor where cfdi_uuid = 'AAAAAAAA-1111-2222-3333-BBBBBBBBBBBB';

  -- Un pago de 2,500 cubre primero lo de la hoja (1,000) y luego 1,500 de la vencida.
  perform registrar_movimiento_proveedor(v_prov, 'pago', 2500, null, 'santander_fiscal', null, 'SPEI 1');
  select * into s from v_saldo_arranque_proveedores where proveedor_llave = 't101 aceros';
  assert s.saldo = 3500 and s.vencido = 500, format('después del pago: %s', row_to_json(s));

  -- Pagar de más: solo como anticipo, a propósito. Un pago necesita cuenta.
  begin
    perform registrar_movimiento_proveedor(v_prov, 'pago', 9000, null, 'santander_fiscal');
    v_estado := 'pagó de más';
  exception when invalid_parameter_value then v_estado := 'negado';
  end;
  assert v_estado = 'negado', 'dejó pagar de más sin marcar anticipo';
  begin
    perform registrar_movimiento_proveedor(v_prov, 'pago', 100);
    v_estado := 'sin cuenta';
  exception when invalid_parameter_value then v_estado := 'negado';
  end;
  assert v_estado = 'negado', 'dejó un pago sin cuenta de salida';
  perform registrar_movimiento_proveedor(v_prov, 'pago', 4000, null, 'santander_fiscal', null, 'Anticipo', null, null, true);
  assert (select saldo from v_saldo_arranque_proveedores where proveedor_llave = 't101 aceros') = -500, 'el anticipo no dejó saldo a favor';

  assert (select string_agg(factura || '=' || restante, ',' order by fecha) from v_compras_proveedor_pendientes
          where proveedor_llave = 't101 cfe' and restante > 0) = 'F-001=700.00', 'el pago no se aplicó a la factura que decía';
  -- Una compra del ERP se suma a la cuenta que ya traía de la hoja.
  perform registrar_movimiento_proveedor(v_nuevo, 'compra', 800, null, null, 'CFE-OCT');
  assert (select saldo = 1500 and nombre = 'T101 CFE' from v_saldo_arranque_proveedores where proveedor_id = v_nuevo), 'la compra no se sumó a su cuenta';
  -- Un pago sin factura del ERP va a lo que vence primero.
  perform registrar_movimiento_proveedor(v_nuevo, 'pago', 500, null, 'santander_fiscal');
  assert (select sum(restante) filter (where factura = 'F-001') = 200 and sum(restante) filter (where factura = 'CFE-OCT') = 800
          from v_compras_proveedor_pendientes where proveedor_llave = 't101 cfe'), 'el pago libre no fue a lo más viejo';

  -- Alta desde una factura: con el RFC repetido regresa el mismo proveedor.
  v_m := alta_proveedor_finanzas('T101 Fletes Rápidos', 'ftr010101aa1', 'Fletes');
  assert alta_proveedor_finanzas('Otro nombre', 'FTR010101AA1') = v_m, 'duplicó el proveedor con el mismo RFC';
  assert (select rfc = 'FTR010101AA1' and categoria = 'Fletes' from proveedores where id = v_m), 'el alta no guardó RFC o categoría';
  -- Los días de crédito mueven el vencimiento de lo que ya se debe (también lo de la hoja).
  perform fijar_credito_proveedor(v_prov, 60);
  assert (select vence_el from v_compras_proveedor_pendientes where proveedor_llave = 't101 aceros' and origen = 'hoja') = date '2026-09-01' + 60,
    'el crédito no movió el vencimiento de la hoja';
  perform fijar_credito_proveedor(v_prov, 30);

  -- En todos los proveedores, lo pendiente factura por factura suma su saldo (lo que se le
  -- debe), también con saldos a favor desde 2021 y pagos de más.
  perform pg_temp.como_postgres();
  insert into historial_compras_hoja (fecha, proveedor_id, proveedor_nombre, proveedor_llave, tipo, monto, factura) values
    ('2021-12-31', v_nuevo, 'T101 CFE', 't101 cfe', 'Adeudo 2021', -50, null);
  perform pg_temp.como(v_fin);
  assert not exists (select 1 from v_saldo_arranque_proveedores x
    left join (select proveedor_llave, sum(restante) r from v_compras_proveedor_pendientes group by 1) p using (proveedor_llave)
    where abs(greatest(x.saldo, 0) - coalesce(p.r, 0)) > 0.01), 'lo pendiente por factura no suma el saldo del proveedor';

  -- Cobro a un saldo de cliente de la hoja: baja el saldo, no deja cobrar de más.
  v_c := registrar_cobro_saldo_hoja(v_cli, 3000, 'santander_fiscal', null, 'Transferencia');
  select * into s from v_saldo_arranque_clientes where cliente_id = v_cli;
  assert s.saldo = 2000 and s.cobrado_erp = 3000, format('cobro: %s', row_to_json(s));
  begin
    perform registrar_cobro_saldo_hoja(v_cli, 2500, 'santander_fiscal');
    v_estado := 'cobró de más';
  exception when invalid_parameter_value then v_estado := 'negado';
  end;
  assert v_estado = 'negado', 'dejó cobrar más que el saldo';
  -- Si la hoja trae el mismo cobro, no se descuenta dos veces.
  perform pg_temp.como_postgres();
  insert into historial_ventas_hoja (fecha, cliente_id, cliente_nombre, tipo, monto) values (hoy_planta() - 2, v_cli, 'T101 Concretos', 'Pago', 3000);
  perform pg_temp.como(v_fin);
  assert (select saldo from v_saldo_arranque_clientes where cliente_id = v_cli) = 2000, 'el cobro se contó dos veces';

  -- Caja chica: saldo corrido, y el arqueo deja la diferencia como movimiento.
  perform registrar_caja_chica('entrada', 1000, 'Reposición');
  perform registrar_caja_chica('salida', 150, 'Garrafones de agua');
  select saldo into v_saldo from v_caja_chica order by fecha desc, id desc limit 1;
  assert v_saldo = 850 + coalesce((select sum(importe) from caja_chica where origen = 'hoja'), 0), format('saldo de caja: %s', v_saldo);
  v_dif := arqueo_caja_chica(v_saldo - 20, 'Conteo del viernes');
  assert v_dif = -20, format('arqueo: %s', v_dif);
  assert (select concepto from caja_chica order by id desc limit 1) = 'Arqueo: faltante', 'el arqueo no quedó registrado';
  begin
    perform registrar_caja_chica('salida', 50, '   ');
    v_estado := 'sin concepto';
  exception when invalid_parameter_value then v_estado := 'negado';
  end;
  assert v_estado = 'negado', 'caja chica sin concepto';

  -- Compras (finanzas 1) no registra ni ve la cuenta corriente ni la caja.
  perform pg_temp.como(v_com);
  begin
    perform registrar_movimiento_proveedor(v_prov, 'compra', 100);
    v_estado := 'registró';
  exception when insufficient_privilege then v_estado := 'negado';
  end;
  assert v_estado = 'negado', 'compras registró una compra en la cuenta corriente';
  assert not exists (select 1 from movimientos_proveedor where proveedor_id = v_prov), 'compras vio la cuenta corriente';
  assert not exists (select 1 from caja_chica), 'compras vio la caja chica';
  begin
    perform registrar_caja_chica('salida', 10, 'x');
    v_estado := 'registró';
  exception when insufficient_privilege then v_estado := 'negado';
  end;
  assert v_estado = 'negado', 'compras movió la caja chica';
  begin
    perform alta_proveedor_finanzas('T101 Colado', 'COL010101AA1');
    v_estado := 'dio de alta';
  exception when insufficient_privilege then v_estado := 'negado';
  end;
  assert v_estado = 'negado', 'compras usó el alta de finanzas';
  begin
    perform fijar_credito_proveedor(v_prov, 90);
    v_estado := 'cambió';
  exception when insufficient_privilege then v_estado := 'negado';
  end;
  assert v_estado = 'negado', 'compras cambió el crédito por la función de finanzas';
  -- Compras ve en Inicio lo que se debe por órdenes, pero no las cuentas (salen en cero, no se filtran).
  assert (indicadores()->'por_pagar'->>'total')::numeric = coalesce((select sum(saldo) from v_cuentas_por_pagar where saldo > 0 and moneda = 'MXN'), 0), 'compras vio la cuenta de proveedores en Inicio';

  -- El vendedor ve el cobro de su cliente (su saldo baja) pero no registra cobros.
  perform pg_temp.como(v_ven);
  assert exists (select 1 from cobros_saldo_hoja where id = v_c), 'el vendedor no ve el cobro de su cliente';
  begin
    perform registrar_cobro_saldo_hoja(v_cli, 10, 'santander_fiscal');
    v_estado := 'cobró';
  exception when insufficient_privilege then v_estado := 'negado';
  end;
  assert v_estado = 'negado', 'un vendedor registró un cobro';
end $$;

-- El dinero de un anticipo cubre las facturas de la hoja y las de contado, pero NO una factura a
-- crédito capturada en el ERP (PPD, o sin método con vencimiento posterior): esa sigue pendiente y
-- lo que sobra del anticipo queda a favor. Un pago sin factura que no es anticipo sí va a lo que
-- vence primero. Y una compra con otro folio no es «la de la hoja» aunque coincidan monto y semana.
do $$
declare v_fin uuid; v_ven uuid; v_prov uuid; v_id uuid; r record; v_ok boolean; v_n int;
  k constant text := 't303 aceros'; d constant date := hoy_planta();
begin
  v_fin := pg_temp.usuario('fin303@hegamex.com', '{finanzas}');
  v_ven := pg_temp.usuario('ven303@hegamex.com', '{ventas}');
  insert into proveedores (nombre, dias_credito) values ('T303 Aceros', 30) returning id into v_prov;
  -- Fechas contadas desde hoy, para que la prueba no dependa del día en que corre.
  update configuracion set valor = to_jsonb((d - 100)::text) where clave = 'fecha_arranque_finanzas';
  insert into configuracion (clave, valor) select 'fecha_arranque_finanzas', to_jsonb((d - 100)::text)
  where not exists (select 1 from configuracion where clave = 'fecha_arranque_finanzas');

  -- La hoja: un anticipo de 100,000 y una factura de contado de 60,000 que nadie pagó aparte.
  insert into historial_compras_hoja (fecha, proveedor_id, proveedor_nombre, proveedor_llave, tipo, monto, factura, descripcion, anticipo) values
    (d - 170, v_prov, 'T303 Aceros', k, 'Pago', 100000, 'A100', 'Anticipo', true),
    (d - 160, v_prov, 'T303 Aceros', k, 'Compra', 60000, 'H1', 'lámina', false);

  perform pg_temp.como(v_fin);
  -- En la hoja el anticipo sí cubre: no hay forma de saber qué se aplicó a qué.
  assert (select restante from v_compras_proveedor_pendientes where proveedor_llave = k and factura = 'H1') = 0, 'el anticipo no cubrió la factura de la hoja';
  select * into r from v_saldo_arranque_proveedores where proveedor_llave = k;
  assert r.saldo = -40000 and r.por_pagar = 0 and r.a_favor = 40000, format('cuenta solo con la hoja: %s / %s / %s', r.saldo, r.por_pagar, r.a_favor);

  -- 1. Una factura a crédito (PPD) del ERP: el anticipo NO la cubre.
  perform registrar_movimiento_proveedor(v_prov, 'compra', 30000, d - 40, null, 'F1', 'ángulo', null, 'Aceros', false, null, 'PPD');
  select * into r from v_compras_proveedor_pendientes where proveedor_llave = k and factura = 'F1';
  assert r.restante = 30000 and r.cubierto_anticipo = 0, format('la factura a crédito quedó cubierta con el anticipo: resta %s', r.restante);
  select * into r from v_saldo_arranque_proveedores where proveedor_llave = k;
  assert r.por_pagar = 30000 and r.a_favor = 40000 and r.saldo = -10000, format('por pagar %s, a favor %s, saldo %s', r.por_pagar, r.a_favor, r.saldo);
  assert r.vencido = 30000, format('la factura a crédito vencida no sale en vencido: %s', r.vencido);

  -- 2. Una de contado (PUE) del ERP: sí se descuenta del anticipo.
  perform registrar_movimiento_proveedor(v_prov, 'compra', 25000, d - 7, null, 'F2', 'placa', null, 'Aceros', false, null, 'PUE');
  select * into r from v_compras_proveedor_pendientes where proveedor_llave = k and factura = 'F2';
  assert r.restante = 0 and r.cubierto_anticipo = 25000, format('la de contado no se descontó del anticipo: resta %s', r.restante);

  -- 3. Capturadas a mano, sin método: a crédito si vence después de su fecha; de contado si no.
  perform registrar_movimiento_proveedor(v_prov, 'compra', 10000, d - 6, null, 'F3', 'malla', null, 'Aceros');
  perform registrar_movimiento_proveedor(v_prov, 'compra', 5000, d - 5, null, 'F4', 'solera', d - 5, 'Aceros');
  assert (select restante from v_compras_proveedor_pendientes where proveedor_llave = k and factura = 'F3') = 10000, 'la capturada a crédito quedó cubierta con el anticipo';
  assert (select restante from v_compras_proveedor_pendientes where proveedor_llave = k and factura = 'F4') = 0, 'la capturada de contado no se descontó del anticipo';
  select * into r from v_saldo_arranque_proveedores where proveedor_llave = k;
  assert r.por_pagar = 40000 and r.a_favor = 10000 and r.saldo = 30000, format('por pagar %s, a favor %s, saldo %s', r.por_pagar, r.a_favor, r.saldo);

  -- 4. Un pago sin factura que no es anticipo, mayor que el saldo (30,000) pero no que lo que hay
  --    por pagar (40,000): entra y va a lo que vence primero.
  perform registrar_movimiento_proveedor(v_prov, 'pago', 35000, d - 4, 'santander_fiscal');
  assert (select restante from v_compras_proveedor_pendientes where proveedor_llave = k and factura = 'F1') = 0, 'el pago no fue a la que vence primero';
  assert (select restante from v_compras_proveedor_pendientes where proveedor_llave = k and factura = 'F3') = 5000, 'el resto del pago no siguió con la siguiente';
  --    Más de lo que hay por pagar no entra si no es anticipo.
  begin perform registrar_movimiento_proveedor(v_prov, 'pago', 6000, d - 4, 'santander_fiscal'); v_ok := true;
  exception when invalid_parameter_value then v_ok := false; end;
  assert not v_ok, 'entró un pago mayor que lo que hay por pagar sin marcarlo como anticipo';

  -- 5. Un anticipo nuevo se guarda como anticipo y tampoco cubre la de crédito que queda.
  v_id := registrar_movimiento_proveedor(v_prov, 'pago', 50000, d - 3, 'santander_fiscal', null, 'Anticipo de noviembre', null, null, true);
  perform pg_temp.como_postgres();
  assert (select anticipo from movimientos_proveedor where id = v_id), 'el anticipo no quedó guardado como anticipo';
  perform pg_temp.como(v_fin);
  select * into r from v_saldo_arranque_proveedores where proveedor_llave = k;
  assert r.por_pagar = 5000 and r.a_favor = 60000, format('con el anticipo nuevo: por pagar %s, a favor %s', r.por_pagar, r.a_favor);
  --    Pagar una factura por su folio no es un anticipo, aunque la pantalla lo mande marcado.
  v_id := registrar_movimiento_proveedor(v_prov, 'pago', 5000, d - 2, 'santander_fiscal', 'F3', null, null, null, true);
  perform pg_temp.como_postgres();
  assert not (select anticipo from movimientos_proveedor where id = v_id), 'un pago a una factura quedó como anticipo';
  perform pg_temp.como(v_fin);
  assert (select por_pagar from v_saldo_arranque_proveedores where proveedor_llave = k) = 0, 'quedó algo por pagar';

  -- 6. «Ya está en la hoja»: mismo monto y misma semana que una compra de la hoja. Con otro folio
  --    cuenta; sin folio se toma por la de la hoja (y no se suma dos veces).
  perform pg_temp.como_postgres();
  insert into historial_compras_hoja (fecha, proveedor_id, proveedor_nombre, proveedor_llave, tipo, monto, factura) values
    (d - 35, v_prov, 'T303 Aceros', k, 'Compra', 1234.56, 'H9');
  perform pg_temp.como(v_fin);
  perform registrar_movimiento_proveedor(v_prov, 'compra', 1234.56, d - 31, null, 'H10', 'otra igual', null, 'Aceros', false, null, 'PUE');
  perform registrar_movimiento_proveedor(v_prov, 'compra', 1234.56, d - 31, null, null, 'sin folio', null, 'Aceros');
  assert not (select en_hoja from v_movimientos_proveedor where proveedor_llave = k and factura = 'H10'), 'una compra con otro folio se tomó por la de la hoja';
  assert (select en_hoja from v_movimientos_proveedor where proveedor_llave = k and descripcion = 'sin folio'), 'una compra igual y sin folio no se tomó por la de la hoja';

  -- 7. Ventas no ve cuentas de proveedores.
  perform pg_temp.como(v_ven);
  select count(*) into v_n from v_compras_proveedor_pendientes where proveedor_llave = k;
  assert v_n = 0, format('ventas ve %s facturas de un proveedor', v_n);
end $$;

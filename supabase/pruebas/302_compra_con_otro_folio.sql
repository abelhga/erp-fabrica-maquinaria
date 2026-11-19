-- Recibos mensuales iguales del mismo día (una póliza de seguro): el que falta en la hoja, con su
-- folio, se puede capturar; el mismo folio, no; sin folio tampoco (no hay cómo distinguirlo) y el
-- mensaje dice qué hacer; y un pago que ya está en la hoja sigue rechazándose.
do $$
declare v_fin uuid; v_prov uuid; v_t text;
begin
  v_fin := pg_temp.usuario('fin302@hegamex.com', '{finanzas}');
  insert into proveedores (nombre) values ('T302 Seguros') returning id into v_prov;
  update configuracion set valor = '"2026-10-17"' where clave = 'fecha_arranque_finanzas';
  insert into configuracion (clave, valor) select 'fecha_arranque_finanzas', '"2026-10-17"'
  where not exists (select 1 from configuracion where clave = 'fecha_arranque_finanzas');
  insert into historial_compras_hoja (fecha, proveedor_id, proveedor_nombre, proveedor_llave, tipo, monto, factura, cuenta) values
    ('2025-12-06', v_prov, 'T302 Seguros', 't302 seguros', 'Compra', 16490.72, 'REGT 16508636', null),
    ('2025-12-06', v_prov, 'T302 Seguros', 't302 seguros', 'Compra', 16490.72, 'REGT 16508637', null),
    ('2026-08-13', v_prov, 'T302 Seguros', 't302 seguros', 'Pago', 16490.72, 'RCPT 16508637', 'SANTANDER FISCAL');

  perform pg_temp.como(v_fin);
  -- El recibo que falta: mismo monto y mismo día, otro folio. Entra.
  perform registrar_movimiento_proveedor(v_prov, 'compra', 16490.72, '2025-12-06', null, 'REGT 16508638', 'Prima de seguro', '2026-09-13', 'Seguros');
  perform pg_temp.como_postgres();
  assert exists (select 1 from movimientos_proveedor where proveedor_id = v_prov and tipo = 'compra' and factura = 'REGT 16508638'), 'no entró el recibo con otro folio';

  -- El que ya está en la hoja, con su mismo folio (aunque se escriba distinto), no.
  perform pg_temp.como(v_fin);
  begin perform registrar_movimiento_proveedor(v_prov, 'compra', 16490.72, '2025-12-06', null, 'regt-16508637', 'Prima', null, 'Seguros'); v_t := 'guardado';
  exception when unique_violation then v_t := sqlerrm; end;
  assert v_t like '%ya está en la hoja%', format('debió rechazar la factura que ya está en la hoja: %s', v_t);

  -- Sin folio no hay cómo saber que es otra: se rechaza y dice qué hacer.
  begin perform registrar_movimiento_proveedor(v_prov, 'compra', 16490.72, '2025-12-06', null, null, 'Prima', null, 'Seguros'); v_t := 'guardado';
  exception when unique_violation then v_t := sqlerrm; end;
  assert v_t like '%escribe su folio%', format('sin folio debió pedirlo: %s', v_t);
  begin perform registrar_movimiento_proveedor(v_prov, 'compra', 16490.72, '2025-12-06', null, 'S/F', 'Prima', null, 'Seguros'); v_t := 'guardado';
  exception when unique_violation then v_t := sqlerrm; end;
  assert v_t like '%escribe su folio%', format('«S/F» no es un folio: %s', v_t);

  -- Los pagos no cambian: el que ya está en la hoja se rechaza aunque traiga otra referencia.
  begin perform registrar_movimiento_proveedor(v_prov, 'pago', 16490.72, '2026-08-13', 'santander_fiscal', 'REGT 16508637'); v_t := 'guardado';
  exception when unique_violation then v_t := sqlerrm; end;
  assert v_t like 'Ese pago ya está en la hoja%', format('debió rechazar el pago que ya está en la hoja: %s', v_t);

  -- Después del arranque el candado no aplica.
  perform registrar_movimiento_proveedor(v_prov, 'compra', 16490.72, '2026-10-20', null, null, 'Prima nueva', null, 'Seguros');
end $$;

-- Compras repetidas en la hoja: la copia infla el saldo hasta que finanzas la marca; marcarla
-- (y desmarcarla) mueve el saldo; un pago viejo que ya está en la hoja se rechaza en vez de
-- guardarse sin efecto. Y compras e importaciones ya no leen la cobranza ni los contactos de clientes.
do $$
declare v_fin uuid; v_ven uuid; v_comp uuid; v_imp uuid; v_prov uuid; v_copia bigint; v_sola bigint; v_ok boolean; v_t text;
begin
  v_fin := pg_temp.usuario('fin129@hegamex.com', '{finanzas}');
  v_ven := pg_temp.usuario('ven129@hegamex.com', '{ventas}');
  v_comp := pg_temp.usuario('comp129@hegamex.com', '{compras}');
  v_imp := pg_temp.usuario('imp129@hegamex.com', '{importaciones}');
  insert into proveedores (nombre) values ('T129 Rodamientos') returning id into v_prov;
  update configuracion set valor = '"2026-10-17"' where clave = 'fecha_arranque_finanzas';
  insert into configuracion (clave, valor) select 'fecha_arranque_finanzas', '"2026-10-17"'
  where not exists (select 1 from configuracion where clave = 'fecha_arranque_finanzas');

  -- La misma factura dos veces en la hoja; se pagó una.
  insert into historial_compras_hoja (fecha, proveedor_id, proveedor_nombre, proveedor_llave, tipo, monto, factura) values
    ('2026-04-08', v_prov, 'T129 Rodamientos', 't129', 'Compra', 2204, '5960');
  insert into historial_compras_hoja (fecha, proveedor_id, proveedor_nombre, proveedor_llave, tipo, monto, factura)
    values ('2026-04-08', v_prov, 'T129 Rodamientos', 't129', 'Compra', 2204, '5960') returning id into v_copia;
  insert into historial_compras_hoja (fecha, proveedor_id, proveedor_nombre, proveedor_llave, tipo, monto, factura, cuenta) values
    ('2026-05-08', v_prov, 'T129 Rodamientos', 't129', 'Pago', 2204, '5960', 'SANTANDER FISCAL');
  insert into historial_compras_hoja (fecha, proveedor_id, proveedor_nombre, proveedor_llave, tipo, monto, factura)
    values ('2026-06-01', v_prov, 'T129 Rodamientos', 't129', 'Compra', 999, '7000') returning id into v_sola;

  perform pg_temp.como(v_fin);
  assert (select saldo from v_saldo_arranque_proveedores where proveedor_llave = 't129') = 2204 + 999, 'el saldo debió incluir la copia';
  assert (select bool_or(posible_repetida) from v_compras_proveedor_pendientes where proveedor_llave = 't129' and factura = '5960'), 'no avisó de la posible repetida';
  assert not (select posible_repetida from v_compras_proveedor_pendientes where proveedor_llave = 't129' and factura = '7000'), 'avisó de una que no está repetida';

  -- Pagarla con la fecha del pago de la hoja ya no se puede: se explica.
  begin perform registrar_movimiento_proveedor(v_prov, 'pago', 2204, '2026-05-08', 'santander_fiscal', '5960'); v_t := 'guardado';
  exception when unique_violation then v_t := sqlerrm; end;
  assert v_t like 'Ese pago ya está en la hoja%', format('debió rechazar el pago que ya está en la hoja: %s', v_t);

  -- Ventas no corrige el libro; una compra sin gemela no se marca.
  perform pg_temp.como(v_ven);
  begin perform marcar_compra_repetida(v_copia, 'Repetida'); v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'ventas no debe marcar compras repetidas';
  perform pg_temp.como(v_fin);
  begin perform marcar_compra_repetida(v_sola, 'Repetida'); v_ok := true; exception when check_violation then v_ok := false; end;
  assert not v_ok, 'no debe marcarse una compra que no tiene gemela';

  -- Marcarla baja el saldo y la quita de por pagar; desmarcarla la regresa.
  perform marcar_compra_repetida(v_copia, 'Capturada dos veces');
  assert (select saldo from v_saldo_arranque_proveedores where proveedor_llave = 't129') = 999, 'marcarla no bajó el saldo';
  assert not exists (select 1 from v_compras_proveedor_pendientes where proveedor_llave = 't129' and factura = '5960' and restante > 0), 'sigue por pagar';
  assert (select count(*) from v_compras_hoja_ignoradas where id in (select id from historial_compras_hoja where proveedor_llave = 't129')) = 1, 'debe ignorarse una sola copia';
  begin perform marcar_compra_repetida(v_copia - 1, 'Otra vez'); v_ok := true; exception when check_violation then v_ok := false; end;
  assert not v_ok, 'la original ya no tiene gemela: no se puede marcar también';
  perform desmarcar_compra_repetida(v_copia);
  assert (select saldo from v_saldo_arranque_proveedores where proveedor_llave = 't129') = 2204 + 999, 'desmarcarla no la regresó';

  -- Compras e importaciones ya no leen cobranza, clientes ni el libro de ventas.
  perform pg_temp.como(v_comp);
  assert not puede('finanzas', 1), 'compras sigue con finanzas';
  -- (Los nombres de clientes los sigue viendo por producción: salen en las órdenes del taller.)
  assert not exists (select 1 from contactos), 'compras no debe leer los contactos de los clientes';
  assert not exists (select 1 from historial_ventas_hoja), 'compras no debe leer el libro de ventas';
  assert not (indicadores() ? 'cobranza'), 'compras no debe ver la cobranza';
  perform pg_temp.como(v_imp);
  assert not puede('finanzas', 1), 'importaciones sigue con finanzas';
  assert not exists (select 1 from clientes), 'importaciones no debe leer clientes';
  assert ve_dinero_importacion(), 'importaciones perdió el dinero de sus embarques';
end $$;

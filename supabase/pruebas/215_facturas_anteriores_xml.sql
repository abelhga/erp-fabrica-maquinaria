-- Facturas anteriores al ERP: los XML se guardan una vez, se amarran a la hoja (por folio o por
-- monto) y la categoría de lo comprado entra a Resultados; ventas no las carga ni las ve.
do $$
declare v_fin uuid; v_ven uuid; v_prov uuid; v_cli uuid; v_h1 bigint; v_h2 bigint; v_hv bigint; r jsonb; v_ok boolean;
  v_rfc text := (select valor->>'rfc' from configuracion where clave = 'empresa_fiscal');
begin
  v_fin := pg_temp.usuario('fin215@hegamex.com', '{finanzas}');
  v_ven := pg_temp.usuario('ven215@hegamex.com', '{ventas}');
  insert into proveedores (nombre, rfc) values ('Aceros Prueba 215', 'APR150101AB1') returning id into v_prov;
  insert into clientes (nombre, rfc) values ('Cliente Prueba 215', 'CPR150101AB2') returning id into v_cli;
  insert into historial_compras_hoja (fecha, proveedor_id, proveedor_nombre, proveedor_llave, tipo, monto, factura, orden)
  values ('2024-03-05', v_prov, 'Aceros Prueba 215', 'aceros prueba 215', 'Compra', 11344.80, 'A 26736', '2915') returning id into v_h1;
  insert into historial_compras_hoja (fecha, proveedor_nombre, proveedor_llave, tipo, monto, factura)
  values ('2024-03-20', 'Fletes Rapidos 215', 'fletes rapidos 215', 'Compra', 2320.00, null) returning id into v_h2;
  insert into historial_ventas_hoja (fecha, cliente_nombre, tipo, monto, factura) values ('2024-04-02', 'Cliente Prueba 215', 'Venta', 58000, 'A 3355') returning id into v_hv;

  -- Ventas no carga ni ve facturas anteriores.
  perform pg_temp.como(v_ven);
  begin perform cargar_cfdi_historico('[]'); v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'ventas cargó facturas anteriores';

  perform pg_temp.como(v_fin);
  r := cargar_cfdi_historico(jsonb_build_array(
    -- 1. Compra con folio: casa con su renglón de la hoja (y su orden 2915); la clave de flete dice «qué».
    jsonb_build_object('uuid', '65e80dc5-4218-4e5f-8a44-46a5ce000215', 'tipo', 'I', 'fecha', '2024-03-04', 'serie', 'A', 'folio', '0026736',
      'emisor_rfc', 'APR150101AB1', 'emisor_nombre', 'ACEROS PRUEBA 215', 'receptor_rfc', v_rfc, 'receptor_nombre', 'MAQUINAS Y HERRAMIENTAS GAMEX',
      'subtotal', 9780, 'total', 11344.80, 'conceptos', '[{"clave":"30102300","descripcion":"PTR 6x4","importe":9780}]'::jsonb, 'claves_sat', '["30102300"]'::jsonb,
      'carpeta', 'FACTURAS/2024/03 Marzo/Egresos/ACEROS PRUEBA'),
    -- 2. Sin folio en la hoja: casa por monto exacto y fecha cercana, aunque el proveedor no tenga RFC en el ERP (nombre parecido).
    jsonb_build_object('uuid', '11111111-2222-3333-4444-555555000215', 'tipo', 'I', 'fecha', '2024-03-18', 'folio', '881',
      'emisor_rfc', 'FRA150101XX1', 'emisor_nombre', 'FLETES RAPIDOS 215', 'receptor_rfc', v_rfc,
      'subtotal', 2000, 'total', 2320, 'conceptos', '[{"clave":"78101802","descripcion":"Flete","importe":2000}]'::jsonb, 'claves_sat', '["78101802"]'::jsonb),
    -- 3. Venta emitida: casa por serie y folio.
    jsonb_build_object('uuid', 'AAAAAAAA-BBBB-CCCC-DDDD-EEEEEE000215', 'tipo', 'I', 'fecha', '2024-04-01', 'serie', 'A', 'folio', '3355',
      'emisor_rfc', v_rfc, 'receptor_rfc', 'CPR150101AB2', 'receptor_nombre', 'CLIENTE PRUEBA 215', 'subtotal', 50000, 'total', 58000),
    -- 4. Ni emitida ni recibida por Hegamex: no se guarda.
    jsonb_build_object('uuid', '99999999-9999-9999-9999-999999000215', 'tipo', 'I', 'fecha', '2024-04-01', 'emisor_rfc', 'XAXX010101000',
      'receptor_rfc', 'XEXX010101000', 'total', 10),
    -- 5. Sin folio fiscal válido.
    jsonb_build_object('uuid', 'no-es-uuid', 'tipo', 'I', 'fecha', '2024-04-01', 'emisor_rfc', v_rfc, 'receptor_rfc', 'X', 'total', 1)));
  assert (r->>'nuevas')::int = 3 and (r->>'ajenas')::int = 1 and (r->>'invalidas')::int = 1 and (r->>'amarradas')::int = 3, 'carga: ' || r::text;

  assert (select hoja_compra_id = v_h1 and amarre = 'folio' and proveedor_id = v_prov from cfdi_historico where uuid = '65E80DC5-4218-4E5F-8A44-46A5CE000215'), 'no amarró por folio';
  assert (select hoja_compra_id = v_h2 and amarre = 'monto' from cfdi_historico where uuid = '11111111-2222-3333-4444-555555000215'), 'no amarró por monto';
  assert (select hoja_venta_id = v_hv and cliente_id = v_cli from cfdi_historico where uuid = 'AAAAAAAA-BBBB-CCCC-DDDD-EEEEEE000215'), 'no amarró la venta';
  --    La categoría del flete sale de su clave del SAT, y Resultados la usa en lugar de la del proveedor.
  assert (select categoria_origen = 'clave_sat' and categoria is not null from cfdi_historico where uuid = '11111111-2222-3333-4444-555555000215'), 'sin categoría por clave SAT';
  perform pg_temp.como_postgres();
  assert exists (select 1 from compras_hoja('2024-03-01', '2024-03-31') h
                 where h.categoria = (select categoria from cfdi_historico where uuid = '11111111-2222-3333-4444-555555000215')), 'Resultados no tomó la categoría del XML';
  perform pg_temp.como(v_fin);

  -- Volver a cargar lo mismo no duplica.
  r := cargar_cfdi_historico(jsonb_build_array(jsonb_build_object('uuid', '65e80dc5-4218-4e5f-8a44-46a5ce000215', 'tipo', 'I', 'fecha', '2024-03-04',
      'emisor_rfc', 'APR150101AB1', 'receptor_rfc', v_rfc, 'total', 11344.80)));
  assert (r->>'repetidas')::int = 1 and (r->>'nuevas')::int = 0, 'se duplicó: ' || r::text;

  -- El resumen dice cuánto quedó amarrado por año (y la orden de la hoja).
  r := resumen_cfdi_historico();
  assert exists (select 1 from jsonb_array_elements(r->'por_anio') a where (a->>'anio')::int = 2024
                 and (a->>'recibidas_amarradas')::int >= 2 and (a->>'con_orden')::int >= 1 and (a->>'emitidas_amarradas')::int >= 1), 'resumen: ' || (r->'por_anio')::text;

  perform pg_temp.como(v_ven);
  assert (select count(*) from cfdi_historico) = 0, 'ventas ve las facturas anteriores';
end $$;

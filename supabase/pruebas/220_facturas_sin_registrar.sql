-- Facturas sin registrar: sale lo que el SAT dice que nos facturaron y no está en la hoja, en las
-- compras del ERP ni en caja chica; lo que finanzas descarta sale aparte con su motivo.
do $$
declare v_fin uuid; v_ven uuid; v_prov uuid; v_ok boolean; v_n int;
  v_rfc text := (select valor->>'rfc' from configuracion where clave = 'empresa_fiscal');
begin
  v_fin := pg_temp.usuario('fin220@hegamex.com', '{finanzas}');
  v_ven := pg_temp.usuario('ven220@hegamex.com', '{ventas}');
  insert into proveedores (nombre, rfc) values ('Lámina 220', 'LAM150101AB2') returning id into v_prov;
  insert into cfdi_historico (uuid, rol, tipo, fecha, folio, emisor_rfc, emisor_nombre, receptor_rfc, total, metodo_pago, proveedor_id, carpeta) values
    ('22000000-0000-4000-8000-000000000001', 'recibida', 'I', '2031-10-01', '101', 'LAM150101AB2', 'LAMINA 220', v_rfc, 1160, 'PPD', v_prov, 'x'),  -- en el ERP por folio fiscal
    ('22000000-0000-4000-8000-000000000002', 'recibida', 'I', '2031-10-02', '102', 'LAM150101AB2', 'LAMINA 220', v_rfc, 2320, 'PPD', v_prov, 'x'),  -- en el ERP por folio
    ('22000000-0000-4000-8000-000000000003', 'recibida', 'I', '2031-10-03', '103', 'LAM150101AB2', 'LAMINA 220', v_rfc, 3480, 'PUE', v_prov, 'x'),  -- en caja chica
    ('22000000-0000-4000-8000-000000000004', 'recibida', 'I', '2031-10-04', '104', 'LAM150101AB2', 'LAMINA 220', v_rfc, 4640, 'PPD', v_prov, 'x'),  -- falta
    ('22000000-0000-4000-8000-000000000005', 'recibida', 'I', '2031-10-05', '105', 'NUE150101AB3', 'NUEVO 220', v_rfc, 5800, 'PUE', null, 'x'),     -- falta, sin proveedor
    ('22000000-0000-4000-8000-000000000006', 'recibida', 'I', '2031-10-06', '106', 'LAM150101AB2', 'LAMINA 220', v_rfc, 9999, 'PUE', v_prov, 'x/CANCELADAS'); -- cancelada
  insert into movimientos_proveedor (proveedor_id, proveedor_llave, tipo, fecha, monto, factura, cfdi_uuid)
  values (v_prov, 'lamina 220', 'compra', '2031-10-01', 1160, null, '22000000-0000-4000-8000-000000000001'),
         (v_prov, 'lamina 220', 'compra', '2031-10-02', 2320, 'A-102', null);
  insert into caja_chica (fecha, tipo, importe, concepto) values ('2031-10-04', 'salida', -3480, 'Lámina');

  perform pg_temp.como(v_fin);
  select count(*) into v_n from facturas_sin_registrar('2031-10-01') where uuid like '22000000%';
  assert v_n = 2, format('esperaba 2 sin registrar, salieron %s: %s', v_n,
    (select string_agg(folio, ',') from facturas_sin_registrar('2031-10-01') where uuid like '22000000%'));
  assert (select proveedor_id is null from facturas_sin_registrar('2031-10-01') where folio = '105'), 'el nuevo trae proveedor';
  assert (select proveedor = 'Lámina 220' from facturas_sin_registrar('2031-10-01') where folio = '104'), 'no trajo el proveedor del ERP';

  -- Descartar pide motivo; descartada sale aparte, y sin motivo regresa.
  begin perform descartar_factura_sin_registrar('22000000-0000-4000-8000-000000000005', 'x'); v_ok := true; exception when others then v_ok := false; end;
  assert not v_ok, 'descartó sin motivo';
  perform descartar_factura_sin_registrar('22000000-0000-4000-8000-000000000005', 'Lo domicilia el banco');
  assert not exists (select 1 from facturas_sin_registrar('2031-10-01') where folio = '105'), 'la descartada sigue en la lista';
  assert (select no_registrar = 'Lo domicilia el banco' and no_registrar_por is not null from facturas_sin_registrar('2031-10-01', true) where folio = '105'), 'no salió entre las descartadas';
  perform descartar_factura_sin_registrar('22000000-0000-4000-8000-000000000005', null);
  assert exists (select 1 from facturas_sin_registrar('2031-10-01') where folio = '105'), 'no regresó a la lista';

  -- Ventas no la ve ni descarta.
  perform pg_temp.como(v_ven);
  assert not exists (select 1 from facturas_sin_registrar('2031-10-01')), 'ventas vio facturas sin registrar';
  begin perform descartar_factura_sin_registrar('22000000-0000-4000-8000-000000000004', 'Se paga aparte'); v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'ventas descartó una factura';
end $$;

-- Lo cancelado no cuenta: lo que viene de la carpeta de canceladas no se amarra ni sale como
-- pendiente, y marcar una a mano le regresa su renglón de la hoja a la factura buena.
do $$
declare v_fin uuid; v_ven uuid; v_prov uuid; v_h bigint; v_h2 bigint; r jsonb; v_ok boolean;
  v_rfc text := (select valor->>'rfc' from configuracion where clave = 'empresa_fiscal');
begin
  v_fin := pg_temp.usuario('fin219@hegamex.com', '{finanzas}');
  v_ven := pg_temp.usuario('ven219@hegamex.com', '{ventas}');
  insert into proveedores (nombre, rfc) values ('Bandas 219', 'BAN150101AB9') returning id into v_prov;
  insert into historial_compras_hoja (fecha, proveedor_id, proveedor_nombre, proveedor_llave, tipo, monto, factura)
  values ('2031-11-28', v_prov, 'Bandas 219', 'bandas 219', 'Compra', 18125, '6653') returning id into v_h;
  insert into historial_compras_hoja (fecha, proveedor_id, proveedor_nombre, proveedor_llave, tipo, monto, factura)
  values ('2031-12-03', v_prov, 'Bandas 219', 'bandas 219', 'Compra', 4000, '7001') returning id into v_h2;

  perform pg_temp.como(v_fin);
  -- La mal timbrada (en CANCELADAS) llega primero y con el mismo monto que la buena: no se queda con el renglón.
  r := cargar_cfdi_historico(jsonb_build_array(
    jsonb_build_object('uuid', '21900000-0000-4000-8000-000000000001', 'tipo', 'I', 'fecha', '2031-11-28', 'folio', '6652',
      'emisor_rfc', 'BAN150101AB9', 'emisor_nombre', 'BANDAS 219', 'receptor_rfc', v_rfc, 'total', 18125,
      'carpeta', '2031/11 Noviembre/Egresos/BANDAS/CANCELADAS'),
    jsonb_build_object('uuid', '21900000-0000-4000-8000-000000000002', 'tipo', 'I', 'fecha', '2031-11-28', 'folio', '6653',
      'emisor_rfc', 'BAN150101AB9', 'emisor_nombre', 'BANDAS 219', 'receptor_rfc', v_rfc, 'total', 18125,
      'carpeta', '2031/11 Noviembre/Egresos/BANDAS'),
    jsonb_build_object('uuid', '21900000-0000-4000-8000-000000000003', 'tipo', 'I', 'fecha', '2031-12-03', 'folio', '7001',
      'emisor_rfc', 'BAN150101AB9', 'emisor_nombre', 'BANDAS 219', 'receptor_rfc', v_rfc, 'total', 4000,
      'carpeta', '2031/12 Diciembre/Egresos/BANDAS'),
    jsonb_build_object('uuid', '21900000-0000-4000-8000-000000000004', 'tipo', 'I', 'fecha', '2031-12-03', 'folio', '7002',
      'emisor_rfc', 'BAN150101AB9', 'emisor_nombre', 'BANDAS 219', 'receptor_rfc', v_rfc, 'total', 4000,
      'carpeta', '2031/12 Diciembre/Egresos/BANDAS')));
  assert (select cancelada and hoja_compra_id is null from cfdi_historico where uuid = '21900000-0000-4000-8000-000000000001'), 'la cancelada se amarró';
  assert (select not cancelada and hoja_compra_id = v_h from cfdi_historico where uuid = '21900000-0000-4000-8000-000000000002'), 'la buena no se quedó con su renglón';
  -- No sale entre lo pendiente por amarrar.
  r := resumen_cfdi_historico();
  assert not exists (select 1 from jsonb_array_elements(r->'sin_amarrar') s where s->>'rfc' = 'BAN150101AB9' and (s->>'n')::int > 1), 'la cancelada salió como pendiente: ' || (r->'sin_amarrar')::text;
  assert (r->>'canceladas')::int >= 1, 'el resumen no cuenta las canceladas';

  -- A mano: la 7001 resultó cancelada en el SAT; su renglón pasa a la 7002 que la reemplazó.
  assert (select hoja_compra_id = v_h2 from cfdi_historico where uuid = '21900000-0000-4000-8000-000000000003'), 'la 7001 no se amarró';
  perform marcar_cfdi_cancelada('21900000-0000-4000-8000-000000000003', true);
  assert (select cancelada and hoja_compra_id is null from cfdi_historico where uuid = '21900000-0000-4000-8000-000000000003'), 'no soltó el renglón';
  assert (select hoja_compra_id = v_h2 from cfdi_historico where uuid = '21900000-0000-4000-8000-000000000004'), 'la que la reemplazó no tomó el renglón';

  -- Ventas no marca nada.
  perform pg_temp.como(v_ven);
  begin perform marcar_cfdi_cancelada('21900000-0000-4000-8000-000000000004', true); v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'ventas marcó una factura cancelada';
end $$;

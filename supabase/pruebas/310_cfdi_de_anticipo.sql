-- El CFDI de un anticipo (clave del SAT 84111506) no entra como compra: va como pago de anticipo,
-- queda a favor y no tapa las facturas a crédito. Una factura normal que trae esa clave junto con
-- otras sí es compra. Y quien no es de finanzas no registra nada.
do $$
declare v_fin uuid; v_vend uuid; v_prov uuid; v_ok boolean; v_msj text; r record; v_credito uuid;
begin
  v_fin := pg_temp.usuario('fin310@hegamex.com', '{finanzas}');
  v_vend := pg_temp.usuario('vend310@hegamex.com', '{ventas}');
  insert into proveedores (nombre, categoria, dias_credito) values ('Aceros de prueba 310', 'Aceros', 30) returning id into v_prov;

  perform pg_temp.como(v_fin);
  -- Una factura a crédito de hace diez días: se debe.
  v_credito := registrar_movimiento_proveedor(p_proveedor => v_prov, p_tipo => 'compra', p_monto => 50000, p_fecha => hoy_planta() - 10,
    p_factura => 'A 310', p_metodo_pago => 'PPD', p_categoria => 'Aceros', p_claves_sat => array['30102200']);

  -- El CFDI del anticipo como compra: no pasa, y dice cómo va.
  begin
    perform registrar_movimiento_proveedor(p_proveedor => v_prov, p_tipo => 'compra', p_monto => 400000, p_fecha => hoy_planta() - 3,
      p_factura => 'ANT 310', p_metodo_pago => 'PUE', p_categoria => 'Servicios', p_claves_sat => array['84111506']);
    v_ok := true;
  exception when invalid_parameter_value then v_ok := false; get stacked diagnostics v_msj = message_text; end;
  assert not v_ok, 'un CFDI de anticipo entró como compra';
  assert v_msj like '%anticipo%' and v_msj like '%Es un anticipo%', format('el aviso no dice cómo registrarlo: %s', v_msj);

  -- Como pago de anticipo sí: queda a favor y la factura a crédito sigue debiéndose completa.
  perform registrar_movimiento_proveedor(p_proveedor => v_prov, p_tipo => 'pago', p_monto => 400000, p_fecha => hoy_planta() - 3,
    p_cuenta => (select clave from cuentas_dinero order by 1 limit 1), p_descripcion => 'Anticipo · CFDI ANT 310', p_anticipo => true, p_claves_sat => array['84111506']);
  select * into r from v_saldo_arranque_proveedores where proveedor_id = v_prov;
  assert r.por_pagar = 50000 and r.a_favor = 400000, format('por pagar %s, a favor %s', r.por_pagar, r.a_favor);
  assert (select restante from v_compras_proveedor_pendientes where id = v_credito::text) = 50000, 'el anticipo tapó la factura a crédito';

  -- Una factura de material que además trae un renglón con esa clave es una compra normal.
  perform registrar_movimiento_proveedor(p_proveedor => v_prov, p_tipo => 'compra', p_monto => 1200, p_fecha => hoy_planta() - 1,
    p_factura => 'B 310', p_metodo_pago => 'PUE', p_categoria => 'Aceros', p_claves_sat => array['30102200', '84111506']);

  -- Ventas no registra compras ni pagos.
  perform pg_temp.como(v_vend);
  begin perform registrar_movimiento_proveedor(p_proveedor => v_prov, p_tipo => 'pago', p_monto => 100, p_cuenta => 'x', p_anticipo => true); v_ok := true;
  exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'ventas registró un pago a proveedor';
end $$;

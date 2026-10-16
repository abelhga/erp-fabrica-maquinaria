-- Una compra guarda de dónde salió su factura (XML, PDF leído por Claude o captura), y el
-- folio fiscal repetido se rechaza igual venga de donde venga.
do $$
declare v_fin uuid; v_ven uuid; v_prov uuid; v_id uuid; v_uuid text := 'AAAABBBB-1111-2222-3333-444455556666';
begin
  v_fin := pg_temp.usuario('fin118@hegamex.com', '{ventas,administracion}');
  v_ven := pg_temp.usuario('ven118@hegamex.com', '{ventas}');
  insert into proveedores (nombre, rfc, dias_credito) values ('T118 Rodamientos', 'TRO010101AB1', 30) returning id into v_prov;

  perform pg_temp.como(v_fin);
  v_id := registrar_movimiento_proveedor(p_proveedor => v_prov, p_tipo => 'compra', p_monto => 1160, p_factura => 'A 1',
    p_cfdi_uuid => v_uuid, p_metodo_pago => 'PPD', p_leido_de => 'pdf');
  perform pg_temp.como_postgres();
  assert (select leido_de from movimientos_proveedor where id = v_id) = 'pdf', 'no guardó que vino de un PDF';

  -- La misma factura, ahora con su XML: ya estaba (el UUID manda, no el origen).
  perform pg_temp.como(v_fin);
  begin
    perform registrar_movimiento_proveedor(p_proveedor => v_prov, p_tipo => 'compra', p_monto => 1160,
      p_cfdi_uuid => lower(v_uuid), p_leido_de => 'xml');
    assert false, 'registró dos veces la misma factura';
  exception when unique_violation then null;
  end;
  -- Sin origen (llamadas de antes) sigue funcionando; un origen inventado no.
  v_id := registrar_movimiento_proveedor(p_proveedor => v_prov, p_tipo => 'compra', p_monto => 500, p_factura => 'A 2');
  begin
    perform registrar_movimiento_proveedor(p_proveedor => v_prov, p_tipo => 'compra', p_monto => 10, p_leido_de => 'fax');
    assert false, 'aceptó un origen desconocido';
  exception when invalid_parameter_value then null;
  end;

  perform pg_temp.como(v_ven);
  begin
    perform registrar_movimiento_proveedor(p_proveedor => v_prov, p_tipo => 'compra', p_monto => 10, p_leido_de => 'pdf');
    assert false, 'un vendedor registró una compra';
  exception when insufficient_privilege then null;
  end;
end $$;

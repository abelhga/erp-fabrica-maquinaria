-- Un renglón de la hoja se pasa a «Sin efectos» con motivo y Resultados lo respeta; una venta cuya
-- nota dice que sigue viva no se cierra como perdida; un cliente no entra con un teléfono o
-- «pendiente» por nombre, y la ciudad escrita en el estado se acomoda.
do $$
declare v_fin uuid; v_ven uuid; v_cli uuid; v_c uuid; v_op uuid; v_h bigint; v_ok boolean; v_msg text; v_hint text; r record;
begin
  v_fin := pg_temp.usuario('fin319@hegamex.com', '{finanzas}');
  v_ven := pg_temp.usuario('ven319@hegamex.com', '{ventas}');

  -- 1. La hoja: la compra de Manguitos contaba como Aceros.
  insert into compras_hoja_categoria (proveedor_llave, categoria) values ('aceros 319', 'Aceros') on conflict do nothing;
  insert into historial_compras_hoja (fecha, proveedor_nombre, proveedor_llave, tipo, monto, descripcion, factura)
  values ('2026-05-07', 'Aceros 319', 'aceros 319', 'Compra', 6544.70, 'vigas ipr - manguitos', '0171987') returning id into v_h;
  select * into r from compras_hoja('2026-05-01', '2026-05-31') where importe > 0 and categoria = 'Aceros' limit 1;
  assert found, 'antes del cambio debía contar como Aceros';

  perform pg_temp.como(v_ven);
  begin perform cambiar_categoria_compra_hoja(v_h, 'Sin efectos', 'no es de la empresa'); v_ok := true;
  exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'ventas cambió la categoría de una compra de la hoja';

  perform pg_temp.como(v_fin);
  begin perform cambiar_categoria_compra_hoja(v_h, 'Sin efectos', ''); v_ok := true;
  exception when invalid_parameter_value then v_ok := false; end;
  assert not v_ok, 'cambió sin motivo';
  perform cambiar_categoria_compra_hoja(v_h, 'Sin efectos', 'Manguitos: no es de Hegamex');
  assert (select antes from compras_hoja_categoria_renglon where hoja_id = v_h) = 'Aceros', 'no guardó cuál tenía';
  perform pg_temp.como_postgres();
  assert (select count(*) from compras_hoja('2026-05-07', '2026-05-07') where categoria = 'Sin efectos') = 1
     and (select count(*) from compras_hoja('2026-05-07', '2026-05-07') where categoria = 'Aceros') = 0,
    'Resultados siguió contando la compra de Manguitos como Aceros';

  -- 2. Una venta que sigue viva no se pierde.
  perform pg_temp.como(v_ven);
  insert into clientes (nombre, vendedor_id) values ('Agregados 319', v_ven) returning id into v_cli;
  v_c := nueva_cotizacion(v_cli, null);
  insert into cotizacion_lineas (cotizacion_id, titulo, precio_unitario) values (v_c, 'Cribadora 319', 10000);
  update cotizaciones set estado = 'enviada' where id = v_c;
  v_op := (select oportunidad_id from cotizaciones where id = v_c);
  begin
    perform registrar_seguimiento(v_op, 'perdida', 'Lo está revisando, él me avisa', 'llamada', null, 'Precio');
    v_ok := true;
  exception when check_violation then v_ok := false; get stacked diagnostics v_msg = message_text, v_hint = pg_exception_hint; end;
  assert not v_ok and v_hint = 'venta_viva' and v_msg like '%sigue decidiendo%', format('se perdió una venta viva: %s', v_msg);
  -- Por la tarjeta tampoco.
  begin update oportunidades set etapa = 'perdida', motivo_perdida = 'Aún no se decide' where id = v_op; v_ok := true;
  exception when check_violation then v_ok := false; end;
  assert not v_ok, 'se perdió por la tarjeta con «aún no se decide»';
  -- Con un motivo real, sí.
  perform registrar_seguimiento(v_op, 'perdida', 'Compró con otro proveedor más barato', 'llamada', null, 'Precio');
  assert (select etapa from oportunidades where id = v_op) = 'perdida', 'no se pudo perder con un motivo real';

  -- 3. Clientes.
  begin insert into clientes (nombre, vendedor_id) values ('33 3201 3993', v_ven); v_ok := true;
  exception when check_violation then v_ok := false; end;
  assert not v_ok, 'entró un teléfono como nombre';
  begin insert into clientes (nombre, vendedor_id) values ('pendiente', v_ven); v_ok := true;
  exception when check_violation then v_ok := false; end;
  assert not v_ok, 'entró «pendiente» como nombre';
  begin insert into clientes (nombre, vendedor_id) values ('Juan Manuel Sandoval Bautista Asignar esta conversación', v_ven); v_ok := true;
  exception when check_violation then v_ok := false; end;
  assert not v_ok, 'entró texto del chat en el nombre';
  insert into clientes (nombre, vendedor_id, estado) values ('Antonio Aguilar 319', v_ven, 'Toluca') returning id into v_cli;
  select ciudad, estado into r from clientes where id = v_cli;
  assert r.ciudad = 'Toluca' and r.estado = 'México', format('la ciudad en el estado no se acomodó: %s', to_jsonb(r));
  update clientes set estado = 'Jal' where id = v_cli;
  assert (select estado from clientes where id = v_cli) = 'Jalisco', 'el estado abreviado no se acomodó';
end $$;

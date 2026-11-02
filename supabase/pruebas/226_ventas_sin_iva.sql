-- Sin IVA: la cotización la cambia quien la edita (mientras se puede editar) y el precio sin IVA de
-- cada partida no cambia; el pedido hereda la tasa. El pedido lo cambia su vendedor, la gerencia o
-- finanzas (otro vendedor y producción no), nunca con una factura registrada, y el subtotal (lo que
-- cuenta para la comisión) se queda igual.
do $$
declare
  v_ven uuid; v_otro uuid; v_fin uuid; v_prod uuid; v_cli uuid;
  c1 uuid; c2 uuid; v_ped uuid; v_ped2 uuid; r record;
begin
  v_ven := pg_temp.usuario('ven226@hegamex.com', '{ventas}');
  v_otro := pg_temp.usuario('otro226@hegamex.com', '{ventas}');
  v_fin := pg_temp.usuario('fin226@hegamex.com', '{finanzas}');
  v_prod := pg_temp.usuario('prod226@hegamex.com', '{produccion}');
  insert into clientes (nombre, vendedor_id) values ('Granos 226', v_ven) returning id into v_cli;

  perform pg_temp.como(v_ven);
  -- 1. Cotización con precios más IVA: sin IVA, el total es el subtotal.
  c1 := nueva_cotizacion(v_cli);
  insert into cotizacion_lineas (cotizacion_id, titulo, precio_unitario) values (c1, 'Cribadora 226', 100000);
  perform cotizacion_sin_iva(c1, true);
  select * into r from cotizaciones where id = c1;
  assert (r.tasa_iva, r.subtotal, r.iva, r.total) = (0::numeric, 100000::numeric, 0::numeric, 100000::numeric),
    format('cotización sin IVA: %s %s %s %s', r.tasa_iva, r.subtotal, r.iva, r.total);
  -- De regreso toma la tasa de la configuración.
  perform cotizacion_sin_iva(c1, false);
  select * into r from cotizaciones where id = c1;
  assert (r.tasa_iva, r.total) = (tasa_iva_general(), round(100000 * (1 + tasa_iva_general()), 2)), format('de regreso: %s %s', r.tasa_iva, r.total);
  perform cotizacion_sin_iva(c1, true);

  -- 2. Con precios con IVA incluido, la partida se pasa a su precio sin IVA ($116,000 → $100,000).
  c2 := nueva_cotizacion(v_cli);
  update cotizaciones set precios_con_iva = true where id = c2;
  insert into cotizacion_lineas (cotizacion_id, titulo, precio_unitario) values (c2, 'Tolva 226', 116000);
  perform cotizacion_sin_iva(c2, true);
  assert (select precio_unitario from cotizacion_lineas where cotizacion_id = c2) = 100000, 'la partida no se pasó a precio sin IVA';
  assert (select (precios_con_iva, total) = (false, 100000::numeric) from cotizaciones where id = c2), 'total con IVA incluido';

  -- 3. Otro vendedor no la cambia (la RLS no lo deja ver ni editar).
  perform pg_temp.como(v_otro);
  begin
    perform cotizacion_sin_iva(c2, false);
    assert false, 'otro vendedor cambió el IVA de una cotización ajena';
  exception when raise_exception or insufficient_privilege then null;
  end;
  assert (select tasa_iva from cotizaciones where id = c2) is null or not exists (select 1 from cotizaciones where id = c2 and tasa_iva > 0),
    'la cotización ajena quedó con IVA';

  -- 4. Enviada ya no se cambia.
  perform pg_temp.como(v_ven);
  update cotizaciones set estado = 'enviada' where id = c1;
  begin
    perform cotizacion_sin_iva(c1, false);
    assert false, 'se cambió el IVA de una cotización enviada';
  exception when raise_exception then null;
  end;

  -- 5. El pedido hereda la tasa: sin IVA, total = subtotal.
  v_ped := convertir_a_pedido(c1);
  select * into r from pedidos where id = v_ped;
  assert (r.tasa_iva, r.subtotal, r.total) = (0::numeric, 100000::numeric, 100000::numeric), format('pedido heredado: %s %s %s', r.tasa_iva, r.subtotal, r.total);

  -- 6. El vendedor le regresa el IVA a su pedido y se lo vuelve a quitar; el subtotal no se mueve.
  perform pedido_sin_iva(v_ped, false);
  assert (select total from pedidos where id = v_ped) = round(100000 * (1 + tasa_iva_general()), 2), 'no recalculó el total con IVA';
  perform pedido_sin_iva(v_ped, true);
  select * into r from pedidos where id = v_ped;
  assert (r.subtotal, r.iva, r.total) = (100000::numeric, 0::numeric, 100000::numeric), format('pedido sin IVA: %s %s %s', r.subtotal, r.iva, r.total);

  -- 7. Otro vendedor y producción no cambian el IVA de un pedido.
  perform pg_temp.como(v_otro);
  begin
    perform pedido_sin_iva(v_ped, false);
    assert false, 'otro vendedor cambió el IVA de un pedido ajeno';
  exception when insufficient_privilege then null;
  end;
  perform pg_temp.como(v_prod);
  begin
    perform pedido_sin_iva(v_ped, false);
    assert false, 'producción cambió el IVA de un pedido';
  exception when insufficient_privilege then null;
  end;

  -- 8. Con factura registrada no queda sin IVA; finanzas sí puede regresarle el IVA.
  perform pg_temp.como_postgres();
  insert into pedidos (cliente_id, vendedor_id, canal) values (v_cli, v_ven, 'directo') returning id into v_ped2;
  insert into pedido_lineas (pedido_id, titulo, precio_unitario, cantidad) values (v_ped2, 'Polea 226', 1000, 1);
  insert into facturas (pedido_id, folio, fecha, total) values (v_ped2, 'T-226', current_date, 1160);
  perform pg_temp.como(v_fin);
  begin
    perform pedido_sin_iva(v_ped2, true);
    assert false, 'un pedido facturado quedó sin IVA';
  exception when check_violation then null;
  end;
  perform pedido_sin_iva(v_ped, false);
  assert (select tasa_iva from pedidos where id = v_ped) = tasa_iva_general(), 'finanzas no pudo regresar el IVA';

  perform pg_temp.como_postgres();
end $$;

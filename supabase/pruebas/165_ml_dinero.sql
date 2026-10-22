-- El dinero de Mercado Libre: la venta pagada entra con su cobro a Mercado Pago, lo que se
-- quedó ML lo ven ventas y finanzas (almacén no: la planta no ve montos), un reembolso entra en
-- negativo una sola vez, y el envío del ERP solo lo mueve la conexión con ML.
do $$
declare v_ven uuid; v_fin uuid; v_alm uuid; v_ped uuid; v_ok boolean; v_ord text := '9165000001';
  v_pago jsonb := '{"id": "P165", "estado": "approved", "pagado_en": "2026-10-16T10:00:00Z", "total": 1480, "comision": 177.6,
                    "envio": 84.5, "retencion_iva": 102.07, "retencion_isr": 31.9, "neto": 1083.93, "libera_en": "2026-10-30T10:00:00Z",
                    "completo": true, "cargos": []}';
begin
  v_ven := pg_temp.usuario('ven165@hegamex.com', '{ventas}');
  v_fin := pg_temp.usuario('fin165@hegamex.com', '{finanzas}');
  v_alm := pg_temp.usuario('alm165@hegamex.com', '{almacen}');
  update configuracion set valor = jsonb_set(coalesce(valor, '{}'), '{ventas_activas}', 'true') where clave = 'mercadolibre';

  v_ped := ml_registrar_orden(jsonb_build_object('id', v_ord, 'estado', 'paid', 'fecha', '2026-10-16T10:00:00Z', 'comprador', 'C165',
    'items', '[{"item_id": "MLM165", "titulo": "Polea 165", "cantidad": 1, "precio": 1480}]'::jsonb, 'pagos', jsonb_build_array(v_pago), 'envio_estado', 'ready_to_ship', 'envio_id', 'E165', 'guia', 'MEL165'));
  assert v_ped is not null, 'no se registró la venta';
  assert (select monto from cobros where pedido_id = v_ped and referencia = 'Mercado Pago P165') = 1480, 'no entró el cobro';
  assert (select metodo from cobros where pedido_id = v_ped) = 'mercadopago', 'el cobro no es por Mercado Pago';
  assert (select neto from v_ml_dinero where pago_id = 'P165') = 1083.93, 'no quedó lo que llega';

  -- Ventas y finanzas ven lo que se quedó ML; almacén no.
  perform pg_temp.como(v_ven);
  assert (select comision from ml_pagos where pago_id = 'P165') = 177.6, 'ventas no ve la comisión';
  perform pg_temp.como(v_fin);
  assert (select retencion_iva from v_ml_dinero where pago_id = 'P165') = 102.07, 'finanzas no ve las retenciones';
  perform pg_temp.como(v_alm);
  assert not exists (select 1 from ml_pagos where pago_id = 'P165'), 'almacén ve el dinero de ML';
  -- Con sesión nadie mueve el envío de ML a mano.
  begin perform ml_sincronizar_envio(jsonb_build_object('order_id', v_ord, 'estado', 'delivered')); v_ok := true;
  exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'alguien con sesión movió el envío de ML';
  perform pg_temp.como_postgres();

  -- ML le regresa el dinero al comprador: el reembolso entra en negativo, una sola vez.
  perform ml_registrar_orden(jsonb_build_object('id', v_ord, 'estado', 'cancelled',
    'pagos', jsonb_build_array(v_pago || '{"estado": "refunded", "reembolsado": 1480}'::jsonb)));
  perform ml_registrar_orden(jsonb_build_object('id', v_ord, 'estado', 'cancelled',
    'pagos', jsonb_build_array(v_pago || '{"estado": "refunded", "reembolsado": 1480}'::jsonb)));
  assert (select count(*) from cobros where pedido_id = v_ped) = 2, 'el reembolso no entró o entró dos veces';
  assert (select sum(monto) from cobros where pedido_id = v_ped) = 0, 'cobrado y reembolsado no dan cero';
  assert (select estado from pedidos where id = v_ped) = 'cancelado', 'la venta cancelada no canceló el pedido';
end $$;

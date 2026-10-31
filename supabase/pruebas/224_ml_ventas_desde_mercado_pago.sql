-- Las ventas de Mercado Libre sin pedido cuentan en Resultados por su pago (sin IVA, menos lo
-- reembolsado), desde el primer pago de ML los renglones de ML de la hoja ya no cuentan (serían las
-- mismas dos veces), y antes de esa fecha la hoja se queda. Una venta con pedido cuenta por su pedido.
-- Lo mismo en el tablero (ventas_entre) y en Análisis (ventas_detalle).
do $$
declare
  v_fin uuid; v_cli uuid; v_ped uuid;
  may0 jsonb; may1 jsonb; abr0 jsonb; abr1 jsonb;
  ve0 numeric; ve1 numeric; vd0 numeric; vd1 numeric;
begin
  v_fin := pg_temp.usuario('fin224@hegamex.com', '{finanzas,direccion}');
  perform pg_temp.como(v_fin);
  may0 := resultados_periodo('2016-05-01', '2016-05-31');
  abr0 := resultados_periodo('2016-04-01', '2016-04-30');
  ve0 := ventas_entre('2016-05-01', '2016-05-31');
  select coalesce(sum(monto), 0) into vd0 from ventas_detalle('2016-05-01', '2016-05-31');
  perform pg_temp.como_postgres();

  -- La hoja: una venta normal y dos de ML (ECOM), una antes y otra después del primer pago de ML.
  insert into historial_ventas_hoja (fecha, cliente_nombre, tipo, monto, factura, descripcion) values
    ('2016-05-03', 'Cliente 224', 'Venta', 11600, 'F-224', 'Polea de 6" 2 ranuras B'),
    ('2016-04-20', 'Público General (Mercadolibre)', 'Venta', 1160, 'ECOM 2000000000224001', 'Banda A-27'),
    ('2016-05-20', 'Público General (Mercadolibre)', 'Venta', 2320, 'ECOM 2000000000224002', 'Banda A-27');

  -- Mercado Libre: el primer pago es del 12 may. Una venta sin pedido con reembolso parcial, una
  -- reembolsada completa (no cuenta) y una con pedido (cuenta por el pedido, no por el pago).
  insert into clientes (nombre) values ('Cliente ML 224') returning id into v_cli;
  insert into pedidos (cliente_id, canal, fecha) values (v_cli, 'directo', '2031-05-15') returning id into v_ped;
  insert into ml_ventas (order_id, pedido_id, historial) values
    ('2000000000224002', null, true), ('2000000000224003', null, true), ('2000000000224004', v_ped, false);
  insert into ml_pagos (pago_id, order_id, estado, pagado_en, total, comision, envio, otros, reembolsado) values
    ('224002', '2000000000224002', 'approved', '2016-05-12 12:00-06', 2900, 400, 100, 0, 580),
    ('224003', '2000000000224003', 'refunded', '2016-05-13 12:00-06', 1160, 0, 0, 0, 1160),
    ('224004', '2000000000224004', 'approved', '2016-05-14 12:00-06', 5800, 700, 0, 0, 0);

  perform pg_temp.como(v_fin);
  may1 := resultados_periodo('2016-05-01', '2016-05-31');
  abr1 := resultados_periodo('2016-04-01', '2016-04-30');
  ve1 := ventas_entre('2016-05-01', '2016-05-31');
  select coalesce(sum(monto), 0) into vd1 from ventas_detalle('2016-05-01', '2016-05-31');

  -- 1. Mayo: la venta normal (11,600 / 1.16 = 10,000) y la de ML por su pago ((2,900 − 580) / 1.16 =
  --    2,000). El ECOM de la hoja del 20 may no cuenta (es la misma venta); la reembolsada tampoco; la
  --    que tiene pedido no se cuenta por su pago.
  assert (may1->>'ventas_total')::numeric - (may0->>'ventas_total')::numeric = 12000, format('ventas de mayo: %s', may1->'ventas');
  assert (may1->>'ventas_ml')::numeric - (may0->>'ventas_ml')::numeric = 2000, format('ventas de ML: %s', may1->'ventas_ml');
  assert (may1->>'ventas_hoja')::numeric - (may0->>'ventas_hoja')::numeric = 10000, format('hoja: %s', may1->'ventas_hoja');
  -- 2. Sus cargos se siguen restando (también los de la venta con pedido).
  assert (may1->>'mercado_libre')::numeric - (may0->>'mercado_libre')::numeric = 1200, format('cargos: %s', may1->'mercado_libre');
  -- 3. Abril es antes del primer pago de ML: el ECOM de la hoja sí cuenta (1,160 / 1.16 = 1,000).
  assert (abr1->>'ventas_total')::numeric - (abr0->>'ventas_total')::numeric = 1000, format('abril: %s', abr1->'ventas');
  assert (may1->>'ml_desde')::date = '2016-05-12', format('ml_desde: %s', may1->'ml_desde');
  -- 4. Tablero y Análisis, con IVA: 11,600 + 2,320.
  assert ve1 - ve0 = 13920, format('ventas_entre: %s', ve1 - ve0);
  assert vd1 - vd0 = 13920, format('ventas_detalle: %s', vd1 - vd0);

  perform pg_temp.como_postgres();
end $$;

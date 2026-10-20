-- Pagos hechos: los del ERP, los de la hoja y los de órdenes de compra en una lista, sin
-- contar dos veces un pago que está en la hoja y también se registró en el ERP. Lo ve
-- finanzas; compras solo los de órdenes de compra (la RLS de cada tabla).
do $$
declare v_fin uuid; v_comp uuid; v_prov uuid; v_oc uuid; v_n int; v_total numeric;
begin
  v_fin := pg_temp.usuario('fin125@hegamex.com', '{finanzas}');
  v_comp := pg_temp.usuario('comp125@hegamex.com', '{compras}');
  insert into proveedores (nombre) values ('T125 Aceros') returning id into v_prov;

  -- En la hoja: dos pagos. Uno de ellos (5,000 el 3 de septiembre) también se capturó en el ERP el día 5.
  insert into historial_compras_hoja (fecha, proveedor_id, proveedor_nombre, proveedor_llave, tipo, monto, cuenta) values
    ('2025-09-03', v_prov, 'T125 Aceros', 'PROV:T125', 'Pago', 5000, 'SANTANDER FISCAL'),
    ('2025-08-10', v_prov, 'T125 Aceros', 'PROV:T125', 'Pago', 1200, 'NO FISCAL'),
    ('2025-08-01', v_prov, 'T125 Aceros', 'PROV:T125', 'Compra', 9000, 'SANTANDER FISCAL');
  insert into movimientos_proveedor (proveedor_id, proveedor_llave, tipo, fecha, monto, cuenta)
  values (v_prov, 'PROV:T125', 'pago', '2025-09-05', 5000, 'santander_fiscal');
  -- Una orden de compra en dólares con un pago.
  insert into ordenes_compra (proveedor_id, moneda, tipo_cambio) values (v_prov, 'USD', 18.5) returning id into v_oc;
  -- (Sin sus partidas ni su recepción: aquí solo importa que el pago aparezca en la lista.)
  set local session_replication_role = replica;
  insert into pagos_proveedor (orden_compra_id, fecha, monto, metodo) values (v_oc, '2025-09-10', 100, 'transferencia');
  set local session_replication_role = origin;

  perform pg_temp.como(v_fin);
  select count(*), sum(monto_mxn) into v_n, v_total from v_pagos_hechos where proveedor = 'T125 Aceros';
  assert v_n = 3 and v_total = 5000 + 1200 + 1850, format('finanzas ve %s pagos por %s (se esperaban 3 por 8050)', v_n, v_total);
  assert (select cuenta_nombre from v_pagos_hechos where proveedor = 'T125 Aceros' and origen = 'hoja') = 'No fiscal', 'la cuenta de la hoja no se tradujo';
  assert not exists (select 1 from v_pagos_hechos where proveedor = 'T125 Aceros' and monto = 9000), 'una compra salió como pago';

  perform pg_temp.como(v_comp);
  select count(*) into v_n from v_pagos_hechos where proveedor = 'T125 Aceros';
  assert v_n = 1 and (select origen from v_pagos_hechos where proveedor = 'T125 Aceros') = 'orden', format('compras ve %s pagos (solo debería ver el de la orden)', v_n);
end $$;

-- Recién capturados: un pago con fecha de hace meses, capturado hoy, se encuentra por su
-- fecha de captura; los de la hoja no tienen.
do $$
declare v_fin uuid; v_prov uuid;
begin
  perform pg_temp.como_postgres();
  v_fin := pg_temp.usuario('fin125b@hegamex.com', '{finanzas}');
  insert into proveedores (nombre) values ('T125b Posadas') returning id into v_prov;
  insert into movimientos_proveedor (proveedor_id, proveedor_llave, tipo, fecha, monto, cuenta)
  values (v_prov, 'erp:t125b', 'pago', '2026-09-06', 23983.34, 'santander_fiscal');
  insert into historial_compras_hoja (fecha, proveedor_id, proveedor_nombre, proveedor_llave, tipo, monto, cuenta)
  values ('2026-09-06', v_prov, 'T125b Posadas', 'erp:t125b-hoja', 'Pago', 100, 'NO FISCAL');
  perform pg_temp.como(v_fin);
  assert exists (select 1 from v_pagos_hechos where proveedor = 'T125b Posadas' and origen = 'erp'
                 and fecha = '2026-09-06' and registrado_en > now() - interval '7 days'), 'el pago capturado hoy no trae su fecha de captura';
  assert (select registrado_en from v_pagos_hechos where proveedor = 'T125b Posadas' and origen = 'hoja') is null, 'la hoja no tiene fecha de captura';
end $$;

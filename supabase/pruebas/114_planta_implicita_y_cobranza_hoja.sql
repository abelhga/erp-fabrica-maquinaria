-- El vacío devuelto pone el embarque en planta, y "por cobrar" incluye lo que se
-- debía en la hoja, con su antigüedad, y solo lo de sus clientes para un vendedor.
do $$
declare
  v_emb uuid; v_fase text; v_ven uuid; v_otro uuid; v_fin uuid; v_c1 uuid; v_c2 uuid; j jsonb; v_hoy date := hoy_planta();
begin
  -- Embarque como EMB-2026-00001: despachado, vacío devuelto, sin el día de llegada a planta.
  insert into embarques (descripcion, modalidad) values ('Prueba 114', 'fcl') returning id into v_emb;
  insert into embarque_eventos (embarque_id, tipo, fecha) values
    (v_emb, 'arribo', v_hoy - 40), (v_emb, 'despacho', v_hoy - 20);
  select fase into v_fase from v_embarque_etapa where embarque_id = v_emb;
  assert v_fase = 'puerto', format('despachado sigue en puerto: %s', v_fase);
  insert into embarque_eventos (embarque_id, tipo, fecha) values (v_emb, 'vacio_devuelto', v_hoy - 18);
  select fase into v_fase from v_embarque_etapa where embarque_id = v_emb;
  assert v_fase = 'planta', format('con el vacío devuelto ya está en planta: %s', v_fase);
  assert (select en_planta from v_embarque_etapa where embarque_id = v_emb) is null, 'no se inventa el día de llegada';
  -- La cuenta de gastos sola también lo prueba; documentos al agente no mueve nada.
  delete from embarque_eventos where embarque_id = v_emb and tipo = 'vacio_devuelto';
  insert into embarque_eventos (embarque_id, tipo, fecha) values (v_emb, 'cuenta_gastos', v_hoy - 5);
  assert (select fase from v_embarque_etapa where embarque_id = v_emb) = 'planta', 'cuenta de gastos → planta';
  insert into embarques (descripcion, modalidad) values ('Prueba 114 b', 'lcl') returning id into v_emb;
  insert into embarque_eventos (embarque_id, tipo, fecha) values (v_emb, 'zarpe', v_hoy - 10), (v_emb, 'documentos_agente', v_hoy - 2);
  assert (select fase from v_embarque_etapa where embarque_id = v_emb) = 'transito', 'documentos al agente no mueve la fase';

  -- Saldo de la hoja: C1 compró 100 (hace 200 días) y 50 (hace 10), pagó 120 → debe 30, de hace 10 días.
  v_ven := pg_temp.usuario('ven114@hegamex.com', '{ventas}');
  v_otro := pg_temp.usuario('otro114@hegamex.com', '{ventas}');
  v_fin := pg_temp.usuario('fin114@hegamex.com', '{finanzas}');
  insert into clientes (nombre, vendedor_id) values ('T114 Uno', v_ven) returning id into v_c1;
  insert into clientes (nombre, vendedor_id) values ('T114 Dos', v_otro) returning id into v_c2;
  insert into historial_ventas_hoja (fecha, cliente_id, cliente_nombre, tipo, monto) values
    (v_hoy - 200, v_c1, 'T114 Uno', 'Venta', 100), (v_hoy - 10, v_c1, 'T114 Uno', 'Venta', 50), (v_hoy - 5, v_c1, 'T114 Uno', 'Pago', 120),
    -- C2 compró 80 y 70 hace 100 y 45 días, sin pagar: 70 en 31–60 y 80 en +90.
    (v_hoy - 100, v_c2, 'T114 Dos', 'Venta', 80), (v_hoy - 45, v_c2, 'T114 Dos', 'Venta', 70);

  perform pg_temp.como(v_ven);
  j := saldo_arranque_antiguedad();
  -- Lo suyo y los clientes libres (como en la ficha del cliente), nunca los de otro vendedor.
  assert (j->>'total')::numeric = (select sum(saldo) from v_saldo_arranque_clientes where saldo > 1)
     and (j #>> '{rangos,0-30}')::numeric >= 30, format('el vendedor ve su saldo con su antigüedad: %s', j);
  assert exists (select 1 from v_saldo_arranque_clientes where cliente_id = v_c1 and saldo = 30), 'debe 30 de la venta más reciente';
  assert not exists (select 1 from v_saldo_arranque_clientes where cliente_id = v_c2), 'vio el saldo del cliente de otro vendedor';

  perform pg_temp.como(v_fin);
  j := saldo_arranque_antiguedad();
  assert (j->>'total')::numeric >= 180 and (j #>> '{rangos,31-60}')::numeric >= 70 and (j #>> '{rangos,90+}')::numeric >= 80,
    format('finanzas ve todo: %s', j);
  assert (j #>> '{rangos,0-30}')::numeric + (j #>> '{rangos,31-60}')::numeric + (j #>> '{rangos,61-90}')::numeric
       + (j #>> '{rangos,90+}')::numeric = (j->>'total')::numeric, format('los rangos suman el total: %s', j);

  -- "Cobrado por mes" cuenta el pago de la hoja (hace 5 días) aunque no haya cobros de pedidos.
  assert (select sum(cobrado) from cobranza_por_mes(2)) >= 120, 'el pago de la hoja no salió en cobrado por mes';
end $$;

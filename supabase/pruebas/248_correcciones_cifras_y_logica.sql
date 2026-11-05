-- Las cifras que no cuadraban entre pantallas (248): cada caso fallaba con la versión anterior.
--   C2 lo vencido del tablero de dirección trae la hoja · C3 una cotización con varias versiones
--   cuenta una vez · C5 «Cobrado» de Tu semana cuenta como Cobranza · C7 el dinero de ML ya trae
--   descontado lo reembolsado y no cuenta intentos rechazados · L1 iniciar sin nombres no borra la
--   cuadrilla planeada · T4 lo nuevo nace con la tasa de IVA de Configuración.

-- C2. El saldo de la hoja con más de 90 días entra al «+90 d» del tablero (y a la gráfica).
do $$
declare v_fin uuid; v_ven uuid; v_cli uuid; j0 jsonb; j1 jsonb; v_hoy date := hoy_planta();
begin
  v_fin := pg_temp.usuario('fin248@hegamex.com', '{finanzas}');
  v_ven := pg_temp.usuario('ven248@hegamex.com', '{ventas}');
  perform pg_temp.como(v_fin);
  j0 := tablero_direccion()->'cobranza';
  perform pg_temp.como_postgres();
  -- Un cliente que compró en la hoja hace 120 días y no ha pagado: debe 1,000 a más de 90 días.
  insert into clientes (nombre) values ('T248 Hoja vieja') returning id into v_cli;
  insert into historial_ventas_hoja (fecha, cliente_id, cliente_nombre, tipo, monto) values (v_hoy - 120, v_cli, 'T248 Hoja vieja', 'Venta', 1000);

  perform pg_temp.como(v_fin);
  j1 := tablero_direccion()->'cobranza';
  assert (j1->>'arranque')::numeric - (j0->>'arranque')::numeric = 1000, format('el total de la hoja no subió: %s → %s', j0->>'arranque', j1->>'arranque');
  assert (j1 #>> '{antiguedad,d90}')::numeric - (j0 #>> '{antiguedad,d90}')::numeric = 1000,
    format('lo de la hoja a +90 días no entró al tablero: %s → %s', j0 #>> '{antiguedad,d90}', j1 #>> '{antiguedad,d90}');
  assert (j1 #>> '{antiguedad,d0_30}')::numeric = (j0 #>> '{antiguedad,d0_30}')::numeric, 'la venta vieja cayó en 0-30';
  -- Las barras cuentan lo mismo que Cobranza: pedidos del ERP más la hoja por fecha de venta.
  assert (j1 #>> '{antiguedad,d0_30}')::numeric + (j1 #>> '{antiguedad,d31_60}')::numeric + (j1 #>> '{antiguedad,d61_90}')::numeric
       + (j1 #>> '{antiguedad,d90}')::numeric
       = (select coalesce(sum(saldo), 0) from v_saldos_pedido where saldo > 0) + (saldo_arranque_antiguedad()->>'total')::numeric,
    format('las barras no suman lo que se debe: %s', j1->'antiguedad');
  -- Un vendedor no ve la cobranza del tablero.
  perform pg_temp.como(v_ven);
  assert not tablero_direccion() ? 'cobranza', 'un vendedor vio la cobranza del tablero';
  perform pg_temp.como_postgres();
end $$;

-- C3. Una cotización con dos versiones vivas cuenta una vez, con el monto de su última versión
-- enviada; la versión dada de baja por reemplazo no cuenta como cerrada.
do $$
declare v_ven uuid; v_dir uuid; v_cli uuid; c1 uuid; c2 uuid; c3 uuid; j jsonb; t0 jsonb; t1 jsonb;
begin
  v_ven := pg_temp.usuario('ven248c@hegamex.com', '{ventas}');
  v_dir := pg_temp.usuario('dir248c@hegamex.com', '{direccion}');
  insert into clientes (nombre, vendedor_id) values ('T248 Cotizaciones', v_ven) returning id into v_cli;
  perform pg_temp.como(v_dir);
  t0 := tablero_direccion()->'cotizaciones';

  perform pg_temp.como(v_ven);
  c1 := nueva_cotizacion(v_cli);
  insert into cotizacion_lineas (cotizacion_id, titulo, precio_unitario) values (c1, 'Cribadora 248', 100000);
  update cotizaciones set estado = 'enviada' where id = c1;
  -- v2 sin dar de baja la v1 (el cliente puede escoger cualquiera): sigue siendo una cotización.
  c2 := nueva_version_cotizacion(c1);
  j := indicadores(array['ventas'])->'cotizaciones';
  assert (j->>'abiertas')::int = 1, format('v1 enviada y v2 en borrador contaron %s', j->>'abiertas');
  assert (j->>'monto_abierto')::numeric = 100000, format('monto con la v2 sin enviar: %s', j->>'monto_abierto');
  -- Se manda también la v2, más cara: el monto es el de la última, no la suma de las dos.
  update cotizacion_lineas set precio_unitario = 150000 where cotizacion_id = c2;
  update cotizaciones set estado = 'enviada' where id = c2;
  j := indicadores(array['ventas'])->'cotizaciones';
  assert (j->>'abiertas')::int = 1, format('dos versiones enviadas contaron %s', j->>'abiertas');
  assert (j->>'monto_abierto')::numeric = 150000, format('el monto se sumó por versión: %s', j->>'monto_abierto');

  -- Otra cotización cuya v1 se da de baja al sacar la v2: no es venta perdida.
  c3 := nueva_cotizacion(v_cli);
  insert into cotizacion_lineas (cotizacion_id, titulo, precio_unitario) values (c3, 'Tolva 248', 50000);
  update cotizaciones set estado = 'enviada' where id = c3;
  perform nueva_version_cotizacion(c3, true);
  assert (select estado from cotizaciones where id = c3) = 'rechazada', 'la v1 no quedó dada de baja';
  j := indicadores(array['ventas'])->'cotizaciones';
  assert (j->>'cerradas_90d')::int = 0, format('la versión reemplazada contó como cerrada: %s', j->>'cerradas_90d');
  assert (j->>'abiertas')::int = 2, format('abiertas con dos cotizaciones: %s', j->>'abiertas');

  -- El tablero de dirección cuenta igual: una cotización más y el total de su última versión.
  perform pg_temp.como(v_dir);
  t1 := tablero_direccion()->'cotizaciones';
  assert (t1->>'abiertas')::int - (t0->>'abiertas')::int = 1, format('el tablero contó %s cotizaciones nuevas', (t1->>'abiertas')::int - (t0->>'abiertas')::int);
  assert (t1->>'monto_abierto')::numeric - (t0->>'monto_abierto')::numeric = (select total * tipo_cambio from cotizaciones where id = c2),
    format('el monto del tablero se sumó por versión: %s', (t1->>'monto_abierto')::numeric - (t0->>'monto_abierto')::numeric);

  -- Lo que no debe cambiar: un rechazo de verdad sí cuenta como cerrada, y una vez aunque el
  -- cliente rechace las dos versiones.
  perform pg_temp.como(v_ven);
  update cotizaciones set estado = 'rechazada', motivo_rechazo = 'Compró con otro' where id in (c1, c2);
  j := indicadores(array['ventas'])->'cotizaciones';
  assert (j->>'cerradas_90d')::int = 1, format('el rechazo de sus dos versiones contó %s cerradas', j->>'cerradas_90d');
  assert (j->>'ganadas_90d')::int = 0, 'una rechazada contó como ganada';
  perform pg_temp.como_postgres();
end $$;

-- C5. «Cobrado» de Tu semana cuenta lo cobrado a saldos de la hoja y los pagos de la hoja, como
-- «Cobrado por mes» en Cobranza, sin contar dos veces el cobro que la hoja ya trae.
-- Semana de 2031 (sin datos en la base): lo medido depende solo de la prueba.
do $$
declare v_dir uuid; v_ven uuid; v_cli uuid; v_lunes date := '2031-01-13'; j jsonb; v_cuenta text := (select clave from cuentas_dinero limit 1);
begin
  v_dir := pg_temp.usuario('dir248s@hegamex.com', '{direccion}');
  v_ven := pg_temp.usuario('ven248s@hegamex.com', '{ventas}');
  insert into clientes (nombre) values ('T248 Semana') returning id into v_cli;
  -- Semana pasada (6 al 12 ene): 700 cobrados aquí a su saldo de la hoja y un pago de 300 en la hoja,
  -- que también se registró aquí (ese no se cuenta dos veces). La anterior: 50 cobrados aquí.
  insert into cobros_saldo_hoja (cliente_id, fecha, monto, cuenta) values
    (v_cli, v_lunes - 3, 700, v_cuenta), (v_cli, v_lunes - 4, 300, v_cuenta), (v_cli, v_lunes - 10, 50, v_cuenta);
  insert into historial_ventas_hoja (fecha, cliente_id, cliente_nombre, tipo, monto) values (v_lunes - 4, v_cli, 'T248 Semana', 'Pago', 300);

  perform pg_temp.como(v_dir);
  j := semana_en_numeros(v_lunes)->'cobranza';
  assert (j->>'cobrado')::numeric = 1000, format('cobrado de la semana: %s', j->>'cobrado');
  assert (j->>'cobrado_anterior')::numeric = 50, format('cobrado de la semana anterior: %s', j->>'cobrado_anterior');
  perform pg_temp.como(v_ven);
  assert not semana_en_numeros(v_lunes) ? 'cobranza', 'un vendedor vio lo cobrado de la empresa';
  perform pg_temp.como_postgres();
end $$;

-- C7. Dinero de ML: un pago reembolsado deja lo que de verdad dejó y lo que ML devolvió de sus
-- cargos ya no cuenta como «se quedó»; un intento rechazado no aparece.
do $$
declare v_ven uuid; v_alm uuid; r record;
begin
  v_ven := pg_temp.usuario('ven248m@hegamex.com', '{ventas}');
  v_alm := pg_temp.usuario('alm248m@hegamex.com', '{almacen}');
  insert into ml_ventas (order_id) values ('9248000001'), ('9248000002'), ('9248000003'), ('9248000004');
  insert into ml_pagos (pago_id, order_id, estado, total, comision, envio, retencion_iva, retencion_isr, reembolsado, neto, completo, cargos) values
    -- Aprobado: se queda tal cual.
    ('P248A', '9248000001', 'approved', 1000, 120, 80, 50, 15, 0, 735, true,
     '[{"nombre":"meli_fee","tipo":"fee","monto":120,"reembolsado":0},{"nombre":"shp_cross_docking","tipo":"shipping","monto":80,"reembolsado":0},
       {"nombre":"tax_withholding-iva","tipo":"tax","monto":50,"reembolsado":0},{"nombre":"tax_withholding-isr","tipo":"tax","monto":15,"reembolsado":0}]'),
    -- Reembolsado completo con sus cargos devueltos (como en la nube): no llega nada ni se quedó ML nada.
    ('P248R', '9248000002', 'refunded', 1000, 120, 80, 50, 15, 1000, 735, true,
     '[{"nombre":"meli_fee","tipo":"fee","monto":120,"reembolsado":120},{"nombre":"shp_cross_docking","tipo":"shipping","monto":80,"reembolsado":80},
       {"nombre":"tax_withholding-iva","tipo":"tax","monto":50,"reembolsado":50},{"nombre":"tax_withholding-isr","tipo":"tax","monto":15,"reembolsado":15}]'),
    -- Reembolsado sin el detalle de Mercado Pago (cargos en null): lo que llega baja lo reembolsado.
    ('P248N', '9248000003', 'refunded', 1000, 120, 0, 0, 0, 1000, 880, false, 'null'::jsonb),
    -- Intento rechazado: el comprador no pagó.
    ('P248X', '9248000004', 'rejected', 1000, 0, 0, 0, 0, 0, 0, true, '[]');

  perform pg_temp.como(v_ven);
  select * into r from v_ml_dinero where pago_id = 'P248A';
  assert (r.neto, r.comision, r.envio, r.retencion_iva, r.retencion_isr) = (735::numeric, 120::numeric, 80::numeric, 50::numeric, 15::numeric),
    format('el pago aprobado cambió: %s', r);
  select * into r from v_ml_dinero where pago_id = 'P248R';
  assert r.neto = 0, format('el reembolsado sigue llegando a Mercado Pago: %s', r.neto);
  assert (r.comision, r.envio, r.retencion_iva, r.retencion_isr, r.otros) = (0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric),
    format('lo que ML devolvió sigue contando como que se lo quedó: %s', r);
  assert (select neto from v_ml_dinero where pago_id = 'P248N') = -120, 'sin detalle, el reembolso no bajó lo que llega';
  assert not exists (select 1 from v_ml_dinero where pago_id = 'P248X'), 'el intento rechazado contó como pagado';
  -- Almacén sigue sin ver el dinero de ML.
  perform pg_temp.como(v_alm);
  assert not exists (select 1 from v_ml_dinero where pago_id like 'P248%'), 'almacén vio el dinero de ML';
  perform pg_temp.como_postgres();
end $$;

-- L1. Iniciar o reanudar sin nombres (detalle de la orden) no borra la cuadrilla planeada; la
-- terminal, que sí dice quién arrancó, sigue mandando.
do $$
declare v_gp uuid; v_sup uuid; v_vend uuid; v_eq uuid; v_op uuid; x1 uuid; v_pedro uuid; v_ramiro uuid; v_ok boolean;
begin
  v_gp := pg_temp.usuario('gp248@hegamex.com', '{gerente_produccion}');
  v_sup := pg_temp.usuario('sup248@hegamex.com', '{produccion}');
  v_vend := pg_temp.usuario('vend248@hegamex.com', '{ventas}');
  insert into empleados (nombre, fecha_ingreso, departamento_id, en_cuadrillas) values ('Pedro 248', current_date, departamento_produccion(), true) returning id into v_pedro;
  insert into empleados (nombre, fecha_ingreso, departamento_id, en_cuadrillas) values ('Ramiro 248', current_date, departamento_produccion(), true) returning id into v_ramiro;
  insert into articulos (clave, tipo, nombre) values ('T248-EQ', 'equipo', 'Tolva 248') returning id into v_eq;
  insert into ordenes_produccion (articulo_id, cantidad, estado) values (v_eq, 1, 'liberada') returning id into v_op;
  insert into op_operaciones (orden_id, etapa_id, horas_estimadas) values (v_op, (select id from etapas where nombre = 'Pailería'), 10) returning id into x1;

  perform pg_temp.como(v_gp);
  perform asignar_a_etapa(x1, v_pedro);
  perform asignar_a_etapa(x1, v_ramiro);

  perform pg_temp.como(v_sup);
  perform avanzar_operacion(x1, 'inicio');
  assert (select estado from op_operaciones where id = x1) = 'en_proceso', 'no se inició';
  assert (select count(*) from op_asignaciones where operacion_id = x1) = 2, 'iniciar sin nombres borró la cuadrilla planeada';
  perform avanzar_operacion(x1, 'pausa');
  perform avanzar_operacion(x1, 'reanudar');
  assert (select count(*) from op_asignaciones where operacion_id = x1) = 2, 'reanudar sin nombres borró la cuadrilla';

  -- La terminal reanuda solo con Pedro: Ramiro deja la cuadrilla (lo que se hizo manda).
  perform avanzar_operacion(x1, 'pausa');
  perform avanzar_operacion(x1, 'reanudar', null, null, array[v_pedro], 0);
  assert (select array_agg(empleado_id) from op_asignaciones where operacion_id = x1) = array[v_pedro], 'la terminal ya no manda en la cuadrilla';

  -- Ventas no avanza etapas.
  perform pg_temp.como(v_vend);
  begin perform avanzar_operacion(x1, 'pausa'); v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'ventas pausó una etapa';
  perform pg_temp.como_postgres();
end $$;

-- T4. Lo nuevo nace con la tasa de IVA de Configuración; lo ya hecho no cambia.
do $$
declare v_ven uuid; v_cli uuid; c_antes uuid; c_nueva uuid; v_ped uuid;
begin
  v_ven := pg_temp.usuario('ven248i@hegamex.com', '{ventas}');
  insert into clientes (nombre, vendedor_id) values ('T248 Frontera', v_ven) returning id into v_cli;
  update configuracion set valor = '0.16' where clave = 'iva';
  perform pg_temp.como(v_ven);
  c_antes := nueva_cotizacion(v_cli);
  assert (select tasa_iva from cotizaciones where id = c_antes) = 0.16, 'la de antes no nació con 16 %';

  -- Sistemas pone 8 % (frontera).
  perform pg_temp.como_postgres();
  update configuracion set valor = '0.08' where clave = 'iva';
  perform pg_temp.como(v_ven);
  c_nueva := nueva_cotizacion(v_cli);
  assert (select tasa_iva from cotizaciones where id = c_nueva) = 0.08,
    format('la cotización nueva nació con %s', (select tasa_iva from cotizaciones where id = c_nueva));
  assert (select tasa_iva from cotizaciones where id = c_antes) = 0.16, 'cambió la tasa de una cotización ya hecha';
  perform pg_temp.como_postgres();
  insert into pedidos (folio, cliente_id, vendedor_id, total) values ('T248-IVA', v_cli, v_ven, 1080) returning id into v_ped;
  assert (select tasa_iva from pedidos where id = v_ped) = 0.08,
    format('el pedido sin cotización nació con %s', (select tasa_iva from pedidos where id = v_ped));
  perform pg_temp.como_postgres();
end $$;

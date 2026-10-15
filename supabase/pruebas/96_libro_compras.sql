-- Libro de compras de la hoja: el saldo por proveedor sale con los signos de la hoja,
-- llega al tablero y al asistente, y solo lo ve finanzas nivel 2 (trae nómina y préstamos;
-- compras e importaciones tienen finanzas 1 para ver pagos, y no deben verlo).
do $$
declare v_fin uuid; v_com uuid; v_ven uuid; v_prov uuid; s record; t jsonb; v_esperado numeric; v_estado text;
begin
  v_fin := pg_temp.usuario('fin96@hegamex.com', '{finanzas}');
  v_com := pg_temp.usuario('com96@hegamex.com', '{compras}');
  v_ven := pg_temp.usuario('ven96@hegamex.com', '{ventas}');
  insert into proveedores (nombre, categoria) values ('T96 Aceros del Bajío', 'Aceros') returning id into v_prov;

  -- Como lo carga el importador: el adeudo de 2021 es un movimiento más.
  insert into historial_compras_hoja (fecha, proveedor_id, proveedor_nombre, proveedor_llave, tipo, monto, factura) values
    ('2021-12-31', v_prov, 'T96 Aceros del Bajío', 't96 aceros del bajio', 'Adeudo 2021', 1000, null),
    ('2026-09-01', v_prov, 'T96 Aceros del Bajío', 't96 aceros del bajio', 'Compra', 5000, 'A 1'),
    ('2026-09-10', v_prov, 'T96 Aceros del Bajío', 't96 aceros del bajio', 'Pago', 3000, 'A 1'),
    ('2026-09-12', v_prov, 'T96 Aceros del Bajío', 't96 aceros del bajio', 'Reembolso Pend.', 200, null),
    ('2026-09-20', v_prov, 'T96 Aceros del Bajío', 't96 aceros del bajio', 'Reembolso Realizado', 100, null),
    -- Lo que no es proveedor del catálogo se queda solo con su nombre.
    ('2026-09-30', null, 'T96 Nómina planta', 't96 nomina planta', 'Compra', 800, null),
    ('2026-09-30', null, 'T96 Nómina planta', 't96 nomina planta', 'Pago', 800, null),
    -- Un anticipo a un proveedor de importación: saldo a nuestro favor.
    ('2026-08-15', null, 'T96 Hangzhou Machinery', 't96 hangzhou machinery', 'Pago', 7000, null);

  perform pg_temp.como(v_fin);
  select * into s from v_saldo_arranque_proveedores where proveedor_llave = 't96 aceros del bajio';
  -- 1000 + 5000 − 3000 − 200 + 100
  assert s.saldo = 2900 and s.proveedor_id = v_prov and s.nombre = 'T96 Aceros del Bajío' and s.categoria = 'Aceros',
    format('saldo del proveedor: %s', row_to_json(s));
  assert s.adeudo_2021 = 1000 and s.comprado = 5000 and s.pagado = 3000 and s.ultima_compra = '2026-09-01' and s.movimientos = 4,
    format('desglose: %s', row_to_json(s));
  assert (select saldo from v_saldo_arranque_proveedores where proveedor_llave = 't96 nomina planta') = 0, 'la nómina no quedó en cero';
  assert (select saldo from v_saldo_arranque_proveedores where proveedor_llave = 't96 hangzhou machinery') = -7000, 'el anticipo no quedó a favor';

  -- Tablero: lo que debemos y lo que nos deben van por separado, no neteados.
  t := tablero_direccion();
  select sum(saldo) filter (where saldo > 1) into v_esperado from v_saldo_arranque_proveedores;
  assert (t #>> '{por_pagar,arranque}')::numeric = v_esperado and v_esperado >= 2900, format('por pagar de la hoja: %s', t -> 'por_pagar');
  assert (t #>> '{por_pagar,arranque_a_favor}')::numeric >= 7000, format('a favor: %s', t -> 'por_pagar');
  assert exists (select 1 from hallazgos('finanzas') h where h.titulo like '%por pagar a % proveedores según la hoja%'),
    'el asistente no habla del saldo de la hoja';

  -- Nadie lo escribe desde la app: solo el importador (postgres).
  begin
    insert into historial_compras_hoja (fecha, proveedor_nombre, proveedor_llave, tipo, monto) values (current_date, 'x', 'x', 'Pago', 1);
    v_estado := 'insertó';
  exception when insufficient_privilege then v_estado := 'negado';
  end;
  assert v_estado = 'negado', 'finanzas escribió en el libro de la hoja';

  -- Compras y ventas no lo ven: trae nómina, préstamos de socios e impuestos.
  perform pg_temp.como(v_com);
  assert not exists (select 1 from historial_compras_hoja where proveedor_llave like 't96%'), 'compras vio el libro de la hoja';
  assert not exists (select 1 from v_saldo_arranque_proveedores where proveedor_llave like 't96%'), 'compras vio los saldos de la hoja';
  -- Ve lo que se debe por órdenes del ERP (finanzas 1), pero no la cifra de la hoja.
  t := tablero_direccion();
  assert coalesce((t #>> '{por_pagar,arranque}')::numeric, 0) = 0 and coalesce((t #>> '{por_pagar,arranque_a_favor}')::numeric, 0) = 0,
    format('compras vio el saldo de la hoja en el tablero: %s', t -> 'por_pagar');
  assert not exists (select 1 from hallazgos('compras') h where h.titulo like '%según la hoja%'), 'compras vio el hallazgo de la hoja';
  perform pg_temp.como(v_ven);
  assert not exists (select 1 from historial_compras_hoja where proveedor_llave like 't96%'), 'ventas vio el libro de la hoja';
  assert not exists (select 1 from hallazgos('direccion') h where h.titulo like '%según la hoja%'), 'ventas vio el hallazgo de la hoja';
end $$;

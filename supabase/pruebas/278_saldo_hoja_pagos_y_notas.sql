-- El saldo de la hoja de clientes: los pagos restan, la nota de crédito pendiente resta y el
-- reembolso ya hecho suma (deshace lo que el cliente tenía a favor). Lo que NO: un tipo escrito
-- distinto («pago») que el saldo no cuente.
do $$
declare v_dir uuid; a uuid; b uuid; c uuid; v_ok boolean;
begin
  v_dir := pg_temp.usuario('dir278@hegamex.com', '{direccion}');
  insert into clientes (nombre) values ('Cliente 278 anticipo devuelto') returning id into a;
  insert into clientes (nombre) values ('Cliente 278 con NC') returning id into b;
  insert into clientes (nombre) values ('Cliente 278 al corriente') returning id into c;
  insert into historial_ventas_hoja (fecha, cliente_id, cliente_nombre, tipo, monto) values
    -- Pagó un anticipo, se canceló y se le devolvió: debe 0.
    ('2026-05-22', a, 'A', 'Pago', 71456), ('2026-07-07', a, 'A', 'Reembolso/NC aplicado', 71456),
    -- Se le facturó, dio anticipo y una NC canceló el resto: debe 0; después una venta nueva sin pagar.
    ('2022-11-30', b, 'B', 'Venta', 331760), ('2022-11-30', b, 'B', 'Pago', 83000), ('2024-08-21', b, 'B', 'Reembolso/NC pend', 248760),
    ('2026-05-05', b, 'B', 'Venta', 14140.40),
    -- Pagó el anticipo y el resto: debe 0.
    ('2020-01-15', c, 'C', 'Venta', 96512), ('2020-01-15', c, 'C', 'Pago', 48256), ('2020-01-29', c, 'C', 'Pago', 48256);

  perform pg_temp.como(v_dir);
  assert (select saldo from v_saldo_arranque_clientes where cliente_id = a) = 0, 'el reembolso hecho no deshizo el anticipo';
  assert (select saldo from v_saldo_arranque_clientes where cliente_id = b) = 14140.40, 'la NC no canceló el resto de la factura';
  assert (select saldo from v_saldo_arranque_clientes where cliente_id = c) = 0, 'el cliente al corriente salió debiendo';

  -- Un «Saldo inicial» (la deuda de antes de la hoja) suma al saldo, pero no es venta.
  perform pg_temp.como_postgres();
  insert into historial_ventas_hoja (fecha, cliente_id, cliente_nombre, tipo, monto) values
    ('2017-12-31', a, 'A', 'Saldo inicial', 86000), ('2018-01-31', a, 'A', 'Pago', 86000);
  perform pg_temp.como(v_dir);
  assert (select saldo = 0 and vendido is null from v_saldo_arranque_clientes where cliente_id = a), 'el saldo inicial no se canceló o contó como venta';

  -- Lo que NO: otro tipo («pago» con minúscula) no entra.
  perform pg_temp.como_postgres();
  begin insert into historial_ventas_hoja (fecha, cliente_id, cliente_nombre, tipo, monto) values ('2020-01-15', c, 'C', 'pago', 1);
    v_ok := true; exception when check_violation then v_ok := false; end;
  assert not v_ok, 'entró un tipo que el saldo no cuenta';
end $$;

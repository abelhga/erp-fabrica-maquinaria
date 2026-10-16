-- Complementos de pago: cada pago va al pedido de su factura, lo desconocido se
-- reporta sin inventar, el mismo XML no se registra dos veces, y quién no debe poder.
do $$
declare v_fin uuid; v_ven uuid; v_cli uuid; v_p1 uuid; v_p2 uuid; v_r jsonb; v_estado text;
  v_pagos jsonb := jsonb_build_array(jsonb_build_object('fecha', '2026-10-10', 'metodo', 'transferencia', 'doctos', jsonb_build_array(
    jsonb_build_object('uuid', 'aaaaaaaa-1060-2222-3333-444444444444', 'pagado', 1000, 'parcialidad', 1, 'folio', '901'),
    jsonb_build_object('uuid', 'BBBBBBBB-1060-2222-3333-444444444444', 'pagado', 500, 'parcialidad', 2, 'folio', '902'),
    jsonb_build_object('uuid', 'CCCCCCCC-1060-2222-3333-444444444444', 'pagado', 700, 'folio', '777'))));
begin
  v_fin := pg_temp.usuario('fin106@hegamex.com', '{finanzas}');
  v_ven := pg_temp.usuario('ven106@hegamex.com', '{ventas}');
  insert into clientes (nombre, vendedor_id) values ('T106 Granos', v_ven) returning id into v_cli;
  insert into pedidos (cliente_id, vendedor_id, subtotal, iva, total) values (v_cli, v_ven, 1724.14, 275.86, 2000) returning id into v_p1;
  insert into pedidos (cliente_id, vendedor_id, subtotal, iva, total) values (v_cli, v_ven, 431.03, 68.97, 500) returning id into v_p2;
  insert into facturas (pedido_id, folio, uuid_sat, fecha, total) values
    (v_p1, 'A 901', 'AAAAAAAA-1060-2222-3333-444444444444', '2026-10-01', 2000),
    (v_p2, 'A 902', 'BBBBBBBB-1060-2222-3333-444444444444', '2026-10-01', 500);

  perform pg_temp.como(v_fin);
  v_r := registrar_complemento_pago('dddddddd-1060-2222-3333-444444444444', 'P 50', v_pagos);
  assert (select count(*) from jsonb_array_elements(v_r) x where x ->> 'estado' = 'registrado') = 2, format('registrados: %s', v_r);
  assert (select x ->> 'estado' from jsonb_array_elements(v_r) x where x ->> 'factura' = '777') = 'sin_factura', 'inventó la factura que no existe';
  assert (select sum(monto) from cobros where pedido_id = v_p1) = 1000 and (select sum(monto) from cobros where pedido_id = v_p2) = 500, 'los cobros no fueron a su pedido';
  assert (select fecha = '2026-10-10' and referencia = 'Complemento P 50' and notas like 'Factura A 901%' from cobros where pedido_id = v_p1), 'el cobro no trae fecha o referencia del complemento';

  -- El mismo XML otra vez: nada nuevo.
  v_r := registrar_complemento_pago('DDDDDDDD-1060-2222-3333-444444444444', 'P 50', v_pagos);
  assert (select count(*) from jsonb_array_elements(v_r) x where x ->> 'estado' = 'repetido') = 2 and (select count(*) from cobros where pedido_id in (v_p1, v_p2)) = 2,
    format('el complemento se registró dos veces: %s', v_r);

  -- Un pago que dejaría el pedido pagado de más se rechaza sin tumbar a los demás.
  v_r := registrar_complemento_pago('EEEEEEEE-1060-2222-3333-444444444444', 'P 51', jsonb_build_array(jsonb_build_object('fecha', '2026-10-12', 'doctos', jsonb_build_array(
    jsonb_build_object('uuid', 'BBBBBBBB-1060-2222-3333-444444444444', 'pagado', 900),
    jsonb_build_object('uuid', 'AAAAAAAA-1060-2222-3333-444444444444', 'pagado', 1000)))));
  assert (select x ->> 'estado' from jsonb_array_elements(v_r) x where x ->> 'factura' = 'A 902') = 'rechazado'
     and (select x ->> 'estado' from jsonb_array_elements(v_r) x where x ->> 'factura' = 'A 901') = 'registrado', format('pago de más: %s', v_r);
  assert (select sum(monto) from cobros where pedido_id = v_p1) = 2000 and (select sum(monto) from cobros where pedido_id = v_p2) = 500, 'quedó un pago de más';

  -- El vendedor ve los cobros de su pedido pero no registra complementos.
  perform pg_temp.como(v_ven);
  assert (select count(*) from cobros where pedido_id = v_p1) = 2, 'el vendedor no ve los cobros de su pedido';
  begin
    perform registrar_complemento_pago('FFFFFFFF-1060-2222-3333-444444444444', 'P 52', v_pagos);
    v_estado := 'registró';
  exception when insufficient_privilege then v_estado := 'negado';
  end;
  assert v_estado = 'negado', 'un vendedor registró un complemento';
end $$;

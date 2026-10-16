-- Comisiones como módulo propio: la gerencia administrativa (vendedora + finanzas
-- sin comisiones) cobra y paga como finanzas, pero solo ve su propia comisión, y
-- su lista de "A quién llamar hoy" es la de una vendedora.
do $$
declare
  v_isaac uuid; v_susana uuid; v_adriana uuid; v_gerente uuid; v_cli_isaac uuid; v_cli_susana uuid; v_cli_susana2 uuid; v_cli_libre uuid;
  v_ped uuid; v_n int; v_num numeric;
begin
  v_isaac := pg_temp.usuario('isaac111@hegamex.com', '{ventas}');
  v_susana := pg_temp.usuario('susana111@hegamex.com', '{ventas,administracion}');
  v_adriana := pg_temp.usuario('adriana111@hegamex.com', '{finanzas}');
  v_gerente := pg_temp.usuario('gv111@hegamex.com', '{gerente_ventas}');

  insert into clientes (nombre, vendedor_id) values ('T111 Granos de Isaac', v_isaac) returning id into v_cli_isaac;
  insert into clientes (nombre, vendedor_id) values ('T111 Forrajes de Susana', v_susana) returning id into v_cli_susana;
  insert into clientes (nombre, vendedor_id) values ('T111 Semillas de Susana', v_susana) returning id into v_cli_susana2;
  insert into clientes (nombre, vendedor_id) values ('T111 Molinos de Isaac', v_isaac);
  insert into clientes (nombre) values ('T111 Cliente sin vendedor') returning id into v_cli_libre;
  delete from vendedor_plan where vendedor_id in (v_isaac, v_susana);
  insert into vendedor_plan values (v_isaac, (select id from planes_comision where nombre like 'General%')),
                                   (v_susana, (select id from planes_comision where nombre = 'Susana'));

  -- Un pedido de cada uno en el mes (a otro cliente, para que los de la lista no hayan comprado hoy).
  insert into pedidos (cliente_id, vendedor_id, fecha) values ((select id from clientes where nombre = 'T111 Molinos de Isaac'), v_isaac, hoy_mx()) returning id into v_ped;
  insert into pedido_lineas (pedido_id, titulo, cantidad, precio_unitario) values (v_ped, 'Banda', 1, 100000);
  insert into pedidos (cliente_id, vendedor_id, fecha) values (v_cli_susana2, v_susana, hoy_mx()) returning id into v_ped;
  insert into pedido_lineas (pedido_id, titulo, cantidad, precio_unitario) values (v_ped, 'Cribadora', 1, 50000);

  -- Los tres clientes compraron dos veces hace un año: los tres son "reactivar".
  insert into historial_ventas_hoja (fecha, cliente_id, cliente_nombre, tipo, monto, descripcion)
  select hoy_mx() - d, c, 'x', 'Venta', 20000, 'Refacciones'
  from unnest(array[v_cli_isaac, v_cli_susana, v_cli_libre]) c, unnest(array[400, 300]) d;

  -- Susana: su comisión sí, la de Isaac no; tampoco el detalle de sus pedidos.
  perform pg_temp.como(v_susana);
  assert exists (select 1 from comisiones_mes(hoy_mx()) where vendedor_id = v_susana), 'Susana no ve su propia comisión';
  assert not exists (select 1 from comisiones_mes(hoy_mx()) where vendedor_id = v_isaac), 'Susana vio la comisión de Isaac';
  assert not exists (select 1 from pedidos_comision(v_isaac, hoy_mx())), 'Susana vio el detalle de comisión de Isaac';
  assert not exists (select 1 from comision_pagos where vendedor_id = v_isaac), 'Susana leyó pagos de comisión de Isaac';
  begin
    perform * from ventas_vendedor_mes(date_trunc('month', hoy_mx())::date);
    assert false, 'la venta por vendedor quedó abierta';
  exception when insufficient_privilege then null;
  end;
  begin
    perform pagar_comision(v_isaac, hoy_mx());
    assert false, 'Susana pagó una comisión';
  exception when insufficient_privilege then null;
  end;
  -- …pero cobra como finanzas: ve todos los pedidos (los de Isaac también) y la cobranza.
  assert exists (select 1 from pedidos where vendedor_id = v_isaac), 'Susana no ve los pedidos de Isaac para cobrar';
  assert exists (select 1 from v_cobranza where vendedor_id = v_isaac), 'Susana no ve la cobranza de Isaac';
  assert puede('finanzas', 2), 'Susana debe capturar en finanzas';
  -- "A quién llamar hoy": sus clientes y los libres, no los de Isaac.
  assert exists (select 1 from oportunidades_sugeridas(500) where cliente_id = v_cli_susana), 'falta su cliente en la lista';
  assert exists (select 1 from oportunidades_sugeridas(500) where cliente_id = v_cli_libre), 'falta el cliente libre en la lista';
  assert not exists (select 1 from oportunidades_sugeridas(500) where cliente_id = v_cli_isaac), 'Susana tiene en su lista un cliente de Isaac';

  -- Adriana (finanzas): ve las de todos y la paga.
  perform pg_temp.como(v_adriana);
  assert exists (select 1 from comisiones_mes(hoy_mx()) where vendedor_id = v_isaac), 'finanzas no ve la comisión de Isaac';
  assert exists (select 1 from pedidos_comision(v_isaac, hoy_mx())), 'finanzas no ve el detalle de Isaac';
  v_num := pagar_comision(v_isaac, hoy_mx());
  assert v_num > 0 and exists (select 1 from comision_pagos where vendedor_id = v_isaac), 'finanzas no pudo pagar';

  -- Ya pagada: Susana sigue sin ver el pago de Isaac; Isaac ve el suyo.
  perform pg_temp.como(v_susana);
  assert not exists (select 1 from comision_pagos where vendedor_id = v_isaac), 'Susana vio el pago de Isaac';
  perform pg_temp.como(v_isaac);
  assert exists (select 1 from comision_pagos where vendedor_id = v_isaac), 'Isaac no ve su pago';
  assert not exists (select 1 from comisiones_mes(hoy_mx()) where vendedor_id = v_susana), 'Isaac vio la comisión de Susana';
  assert not exists (select 1 from oportunidades_sugeridas(500) where cliente_id = v_cli_susana), 'Isaac tiene en su lista un cliente de Susana';

  -- La gerencia de ventas ve las comisiones de todos y la lista de todo el equipo, pero no paga.
  perform pg_temp.como(v_gerente);
  assert exists (select 1 from comisiones_mes(hoy_mx()) where vendedor_id = v_susana), 'la gerencia no ve la comisión de Susana';
  assert exists (select 1 from oportunidades_sugeridas(500) where cliente_id = v_cli_isaac), 'la gerencia no ve la lista de Isaac';
  begin
    perform pagar_comision(v_susana, hoy_mx());
    assert false, 'la gerencia de ventas pagó una comisión';
  exception when insufficient_privilege then null;
  end;

  -- Homologar después: con "Comisiones: ver" en su rol, Susana ve las de todos.
  perform pg_temp.como_postgres();
  insert into permisos_rol (rol, modulo, nivel) values ('administracion', 'comisiones', 1);
  perform pg_temp.como(v_susana);
  assert exists (select 1 from comisiones_mes(hoy_mx()) where vendedor_id = v_isaac), 'con el permiso, Susana debe ver la de Isaac';
end $$;

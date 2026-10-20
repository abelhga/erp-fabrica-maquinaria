-- Correcciones del libro de compras de la hoja: un proveedor nuevo se liga solo a sus
-- renglones sueltos, una cuenta suelta se liga a mano, y finanzas quita una compra o un
-- pago capturado de más, o una factura cancelada, sin tocar la hoja.
do $$
declare v_fin uuid; v_ven uuid; v_prov uuid; v_otro uuid; v_c bigint; v_p bigint; v_x bigint; v_ok boolean; v_n int;
begin
  v_fin := pg_temp.usuario('fin137@hegamex.com', '{finanzas}');
  v_ven := pg_temp.usuario('ven137@hegamex.com', '{ventas}');
  perform pg_temp.como_postgres();
  insert into historial_compras_hoja (fecha, proveedor_nombre, proveedor_llave, tipo, monto, factura)
  values ('2026-06-08', 'TORNILLOS CAÑÓN 137', 'tornillos canon 137', 'Compra', 2800, '2370') returning id into v_c;
  insert into historial_compras_hoja (fecha, proveedor_nombre, proveedor_llave, tipo, monto, factura)
  values ('2026-06-01', 'FERRE 137', 'ferre 137', 'Compra', 500, 'F1') returning id into v_x;

  -- Al dar de alta el proveedor (con acentos y mayúsculas) se liga solo.
  insert into proveedores (nombre) values ('Tornillos  Cañón 137') returning id into v_prov;
  assert (select proveedor_id from historial_compras_hoja where id = v_c) = v_prov, 'el proveedor nuevo se ligó a su compra de la hoja';

  -- Una cuenta con otro nombre se liga a mano; solo finanzas.
  insert into proveedores (nombre) values ('Ferretería Ejemplo 137 SA de CV') returning id into v_otro;
  perform pg_temp.como(v_ven);
  begin perform ligar_hoja_proveedor('ferre 137', v_otro); v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'ventas no liga cuentas';
  perform pg_temp.como(v_fin);
  v_n := ligar_hoja_proveedor('ferre 137', v_otro);
  assert v_n = 1, 'ligó la cuenta suelta';

  -- Una compra y un anticipo de más (la copia está en otra cuenta) dejan de contar.
  perform pg_temp.como_postgres();
  insert into historial_compras_hoja (fecha, proveedor_id, proveedor_nombre, proveedor_llave, tipo, monto, factura)
  values ('2025-10-30', v_prov, 'TORNILLOS CAÑÓN 137', 'tornillos canon 137', 'Compra', 27780, 'A1019') returning id into v_x;
  insert into historial_compras_hoja (fecha, proveedor_id, proveedor_nombre, proveedor_llave, tipo, monto, factura, descripcion)
  values ('2025-10-20', v_prov, 'TORNILLOS CAÑÓN 137', 'tornillos canon 137', 'Pago', 13890, 'A1019', 'Anticipo') returning id into v_p;
  perform pg_temp.como(v_fin);
  assert exists (select 1 from v_pagos_hechos where id = 'hoja:' || v_p), 'el anticipo sale en pagos hechos';
  begin perform ignorar_movimiento_hoja(v_p, 'cancelada', 'No aplica'); v_ok := true; exception when raise_exception then v_ok := false; end;
  assert not v_ok, 'un pago no se marca como factura cancelada';
  perform ignorar_movimiento_hoja(v_x, 'repetida', 'Ya está en la otra cuenta');
  perform ignorar_movimiento_hoja(v_p, 'repetida', 'El anticipo ya está en la otra cuenta');
  assert not exists (select 1 from v_pagos_hechos where id = 'hoja:' || v_p), 'el anticipo de más ya no sale en pagos hechos';
  assert not exists (select 1 from v_compras_proveedor_pendientes where id = 'hoja:' || v_x), 'la compra de más ya no está por pagar';
  assert (select saldo from v_saldo_arranque_proveedores where proveedor_llave = 'tornillos canon 137') = 2800, 'el saldo solo trae la 2370';
  begin perform ignorar_movimiento_hoja(v_p, 'repetida', 'Otra vez'); v_ok := true; exception when raise_exception then v_ok := false; end;
  assert not v_ok, 'no se marca dos veces';
  -- Se deshace y vuelve a contar.
  perform desmarcar_compra_repetida(v_p);
  assert exists (select 1 from v_pagos_hechos where id = 'hoja:' || v_p), 'deshecho, el anticipo vuelve';
  perform ignorar_movimiento_hoja(v_p, 'repetida', 'El anticipo ya está en la otra cuenta');

  -- Factura cancelada: el pago que la incluía queda a favor y abona a la siguiente.
  perform pg_temp.como_postgres();
  insert into historial_compras_hoja (fecha, proveedor_id, proveedor_nombre, proveedor_llave, tipo, monto, factura) values
    ('2026-01-07', v_prov, 'TORNILLOS CAÑÓN 137', 'tornillos canon 137', 'Compra', 1000, '419'),
    ('2026-01-17', v_prov, 'TORNILLOS CAÑÓN 137', 'tornillos canon 137', 'Compra', 1200, '423'),
    ('2026-01-27', v_prov, 'TORNILLOS CAÑÓN 137', 'tornillos canon 137', 'Pago', 1000, '419');
  perform pg_temp.como(v_fin);
  perform ignorar_movimiento_hoja((select id from historial_compras_hoja where proveedor_llave = 'tornillos canon 137' and factura = '419' and tipo = 'Compra'), 'cancelada', 'La 419 se canceló');
  assert (select razon from v_compras_hoja_ignoradas i join historial_compras_hoja h on h.id = i.id where h.proveedor_llave = 'tornillos canon 137' and h.factura = '419' and h.tipo = 'Compra') = 'cancelada', 'queda como cancelada';
  assert (select restante from v_compras_proveedor_pendientes where proveedor_llave = 'tornillos canon 137' and factura = '423') = 200, 'lo pagado de la cancelada abona a la siguiente';

  -- Centavos de diferencia: la base los lleva exactos (la lista de por pagar no los enseña).
  perform pg_temp.como_postgres();
  insert into historial_compras_hoja (fecha, proveedor_id, proveedor_nombre, proveedor_llave, tipo, monto, factura) values
    ('2026-08-03', v_otro, 'FERRE 137', 'ferre 137', 'Compra', 3466.99, '546'),
    ('2026-09-03', v_otro, 'FERRE 137', 'ferre 137', 'Pago', 3466.90, '546');
  perform pg_temp.como(v_fin);
  assert (select restante from v_compras_proveedor_pendientes where proveedor_llave = 'ferre 137' and factura = '546') = 0.09, 'la base sigue exacta: la lista es la que no enseña centavos';

  -- Solo finanzas quita renglones.
  perform pg_temp.como(v_ven);
  begin perform ignorar_movimiento_hoja(v_c, 'repetida', 'Prueba de ventas'); v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'ventas no corrige el libro de compras';
end $$;

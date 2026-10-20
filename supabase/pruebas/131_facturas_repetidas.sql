-- Facturas de proveedor repetidas: el mismo folio del mismo proveedor no entra dos veces
-- (ni si ya está en la hoja); sin folio o con otro proveedor sí. Las parecidas se avisan.
-- "Comprado en 12 meses" suma hoja, ERP y órdenes de compra, sin las repetidas.
do $$
declare v_fin uuid; v_comp uuid; v_ven uuid; v_prov uuid; v_otro uuid; v_t text; v_ok boolean; v_copia bigint; r record;
begin
  v_fin := pg_temp.usuario('fin131@hegamex.com', '{finanzas}');
  v_comp := pg_temp.usuario('comp131@hegamex.com', '{compras}');
  v_ven := pg_temp.usuario('ven131@hegamex.com', '{ventas}');
  insert into proveedores (nombre) values ('T131 Doris') returning id into v_prov;
  insert into proveedores (nombre) values ('T131 Otra') returning id into v_otro;
  insert into historial_compras_hoja (fecha, proveedor_id, proveedor_nombre, proveedor_llave, tipo, monto, factura) values
    (current_date - 30, v_prov, 'T131 Doris', 't131', 'Compra', 1000, 'H-500');
  insert into historial_compras_hoja (fecha, proveedor_id, proveedor_nombre, proveedor_llave, tipo, monto, factura)
    values (current_date - 30, v_prov, 'T131 Doris', 't131', 'Compra', 1000, 'H-500') returning id into v_copia;

  perform pg_temp.como(v_fin);
  -- La primera vez entra; la segunda (con el folio escrito distinto) se rechaza y dice cuándo.
  perform registrar_movimiento_proveedor(v_prov, 'compra', 5399.10, current_date - 10, null, 'A-0896');
  begin perform registrar_movimiento_proveedor(v_prov, 'compra', 5399.10, current_date - 7, null, 'A0896'); v_t := 'entró';
  exception when unique_violation then v_t := sqlerrm; end;
  assert v_t like 'La factura A0896 ya está registrada: compra del %', format('debió rechazar la repetida: %s', v_t);
  -- El pago de contado de esa factura sí entra.
  perform registrar_movimiento_proveedor(v_prov, 'pago', 5399.10, current_date - 10, 'santander_fiscal', 'A-0896');
  -- Mismo folio con otro proveedor, y "S/F" dos veces: entran.
  perform registrar_movimiento_proveedor(v_otro, 'compra', 200, current_date - 5, null, 'A-0896');
  perform registrar_movimiento_proveedor(v_prov, 'compra', 300, current_date - 5, null, 'S/F');
  perform registrar_movimiento_proveedor(v_prov, 'compra', 300, current_date - 4, null, 'S/F');

  -- Ya en la hoja: se rechaza; si la copia de la hoja se marca como repetida, la otra sigue ahí y se rechaza igual.
  begin perform registrar_movimiento_proveedor(v_prov, 'compra', 1000, current_date - 2, null, 'H500'); v_t := 'entró';
  exception when unique_violation then v_t := sqlerrm; end;
  assert v_t like 'La factura H500 ya está en la hoja%', format('debió rechazar la que está en la hoja: %s', v_t);

  -- Las parecidas: mismo monto a pocos días, sin folio.
  select count(*) into v_t from compras_parecidas(v_prov, 300, current_date - 3, null);
  assert v_t::int >= 1, 'no avisó de la compra parecida';
  select count(*) into v_t from compras_parecidas(v_prov, 777, current_date - 3, null);
  assert v_t::int = 0, 'avisó de algo que no se parece';

  -- Comprado en 12 meses: hoja 1000 + 1000 (la copia cuenta mientras no se marque) + ERP 5399.10 + 300 + 300.
  select * into r from compras_proveedores_12m(v_prov);
  assert r.comprado_12m = 2000 + 5399.10 + 600, format('comprado en 12 meses: %s', r.comprado_12m);
  perform marcar_compra_repetida(v_copia, 'Capturada dos veces');
  assert (select comprado_12m from compras_proveedores_12m(v_prov)) = 1000 + 5399.10 + 600, 'la repetida siguió contando';

  -- Compras ve el total (sin leer las facturas); ventas no recibe nada.
  perform pg_temp.como(v_comp);
  assert (select comprado_12m from compras_proveedores_12m(v_prov)) = 1000 + 5399.10 + 600, 'compras no ve lo comprado';
  assert not exists (select 1 from movimientos_proveedor where proveedor_id = v_prov), 'compras no debe leer las facturas de finanzas';
  perform pg_temp.como(v_ven);
  assert not exists (select 1 from compras_proveedores_12m(v_prov)), 'ventas no debe ver lo comprado';
end $$;

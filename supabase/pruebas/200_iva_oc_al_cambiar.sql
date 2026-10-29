-- Cambiar el IVA de una OC después de capturar sus partidas recalcula el IVA y el total.
do $$
declare v_prov uuid; v_art uuid; v_oc uuid; v_com uuid;
begin
  v_com := pg_temp.usuario('com200@hegamex.com', '{compras}');
  insert into proveedores (nombre) values ('Proveedor 200') returning id into v_prov;
  insert into articulos (clave, tipo, nombre) values ('T200-AV', 'componente', 'Aerovibrador 200') returning id into v_art;
  perform pg_temp.como(v_com);
  insert into ordenes_compra (proveedor_id) values (v_prov) returning id into v_oc;
  insert into oc_lineas (orden_compra_id, articulo_id, cantidad, costo_unitario) values (v_oc, v_art, 600, 4), (v_oc, v_art, 1, 1012);
  assert (select subtotal = 3412 and iva = 545.92 and total = 3957.92 from ordenes_compra where id = v_oc), 'totales con 16 %';
  -- Importación: 0 %.
  update ordenes_compra set tasa_iva = 0 where id = v_oc;
  assert (select iva = 0 and total = 3412 from ordenes_compra where id = v_oc),
    format('con 0 %% quedó iva %s total %s', (select iva from ordenes_compra where id = v_oc), (select total from ordenes_compra where id = v_oc));
  -- Y de regreso; las partidas siguen recalculando con la tasa nueva.
  update ordenes_compra set tasa_iva = 0.16 where id = v_oc;
  assert (select iva = 545.92 and total = 3957.92 from ordenes_compra where id = v_oc), 'no regresó al 16 %';
  update ordenes_compra set tasa_iva = 0 where id = v_oc;
  update oc_lineas set cantidad = 500 where orden_compra_id = v_oc and costo_unitario = 4;
  assert (select subtotal = 3012 and iva = 0 and total = 3012 from ordenes_compra where id = v_oc), 'al cambiar una partida perdió la tasa';
  perform pg_temp.como_postgres();
end $$;

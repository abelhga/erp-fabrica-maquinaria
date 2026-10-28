-- Cambiar una partida de una orden ya enviada: solo compras, con motivo, sin haber recibido nada
-- de ella; la orden conserva su folio, sube de revisión y guarda el antes y el después.
do $$
declare v_comp uuid; v_alm uuid; v_pb int; v_prov uuid; v_motor uuid; v_motor2 uuid; v_eq uuid; v_oc uuid; l_motor uuid; l_otro uuid;
  v_ok boolean; v_rev int; c record;
begin
  v_comp := pg_temp.usuario('comp187@hegamex.com', '{compras}');
  v_alm := pg_temp.usuario('alm187@hegamex.com', '{almacen}');
  select id into v_pb from almacenes where nombre = 'Planta Baja';
  insert into proveedores (nombre, dias_entrega) values ('Motores 187', 3) returning id into v_prov;
  insert into articulos (clave, tipo, nombre, unidad) values ('T187-M1', 'componente', 'Motorreductor 3HP 25:1', 'pieza') returning id into v_motor;
  insert into articulos (clave, tipo, nombre, unidad) values ('T187-M2', 'componente', 'Motorreductor 3HP 30:1', 'pieza') returning id into v_motor2;
  insert into articulos (clave, tipo, nombre) values ('T187-EQ', 'equipo', 'Equipo 187') returning id into v_eq;
  insert into ordenes_compra (proveedor_id, estado) values (v_prov, 'enviada') returning id into v_oc;
  insert into oc_lineas (orden_compra_id, articulo_id, descripcion, cantidad, costo_unitario) values (v_oc, v_motor, 'MOTORRED 3HP 25:1', 1, 15000) returning id into l_motor;
  insert into oc_lineas (orden_compra_id, articulo_id, cantidad, costo_unitario) values (v_oc, v_motor2, 2, 100) returning id into l_otro;
  assert (select revision from ordenes_compra where id = v_oc) = 1, 'una orden nueva no es revisión 1';

  -- Almacén no cambia órdenes; compras sin motivo, a un equipo o sin cambiar nada, tampoco.
  perform pg_temp.como(v_alm);
  begin perform cambiar_partida_oc(l_motor, v_motor2, 1, 16000, 'acordado'); v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'almacén cambió una orden de compra';
  perform pg_temp.como(v_comp);
  begin perform cambiar_partida_oc(l_motor, v_motor2, 1, 16000, '  '); v_ok := true; exception when raise_exception then v_ok := false; end;
  assert not v_ok, 'se cambió sin motivo';
  begin perform cambiar_partida_oc(l_motor, v_eq, 1, 16000, 'acordado'); v_ok := true; exception when raise_exception then v_ok := false; end;
  assert not v_ok, 'se cambió a un equipo';
  begin perform cambiar_partida_oc(l_motor, v_motor, 1, 15000, 'acordado'); v_ok := true; exception when raise_exception then v_ok := false; end;
  assert not v_ok, 'se registró un cambio sin cambio';

  -- El cambio: otro motor, otro costo. Mismo folio, revisión 2, historial y totales al día.
  v_rev := cambiar_partida_oc(l_motor, v_motor2, 1, 16000, 'Producción y el proveedor acordaron 30:1');
  perform pg_temp.como_postgres();
  assert v_rev = 2 and (select revision from ordenes_compra where id = v_oc) = 2, format('revisión %s', v_rev);
  assert (select articulo_id = v_motor2 and costo_unitario = 16000 and descripcion is null from oc_lineas where id = l_motor),
    'la partida no cambió (o se quedó con la descripción del motor anterior)';
  assert (select subtotal from ordenes_compra where id = v_oc) = 16200, 'los totales no se rehicieron';
  select * into c from oc_cambios where orden_compra_id = v_oc;
  assert c.revision = 2 and c.antes->>'clave' = 'T187-M1' and (c.antes->>'costo_unitario')::numeric = 15000
     and c.despues->>'clave' = 'T187-M2' and c.motivo like 'Producción%' and c.usuario_id = v_comp, format('historial: %s', row_to_json(c));
  perform pg_temp.como(v_alm);
  assert not exists (select 1 from oc_cambios where orden_compra_id = v_oc), 'almacén ve el historial con costos';
  assert (select revision from v_ordenes_compra where id = v_oc) = 2, 'almacén no ve la revisión';

  -- Recibida una parte de una partida, esa ya no se cambia; la otra sí.
  perform recibir_orden_compra(v_oc, jsonb_build_array(jsonb_build_object('linea_id', l_otro, 'cantidad', 1, 'almacen_id', v_pb)), 'F-187', false);
  perform pg_temp.como(v_comp);
  begin perform cambiar_partida_oc(l_otro, v_motor, 2, 100, 'acordado'); v_ok := true; exception when raise_exception then v_ok := false; end;
  assert not v_ok, 'se cambió una partida que ya se empezó a recibir';
  perform cambiar_partida_oc(l_motor, v_motor2, 2, 16000, 'Pidieron dos');
  perform pg_temp.como_postgres();
  assert (select revision from ordenes_compra where id = v_oc) = 3, 'el segundo cambio no subió la revisión';

  -- Lo pagado tiene que caber en el total nuevo.
  insert into pagos_proveedor (orden_compra_id, monto) values (v_oc, 30000);
  perform pg_temp.como(v_comp);
  begin perform cambiar_partida_oc(l_motor, v_motor2, 1, 100, 'Más barato'); v_ok := true; exception when raise_exception then v_ok := false; end;
  assert not v_ok, 'el total quedó abajo de lo ya pagado';
  perform pg_temp.como_postgres();
end $$;

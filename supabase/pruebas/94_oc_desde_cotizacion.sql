-- Orden de compra desde la cotización del proveedor: emparejar proveedor y
-- artículos, crear la orden, recordar las claves del proveedor y (solo con
-- permiso de costos) actualizar el costo con su historial.
do $$
declare
  v_com uuid; v_imp uuid; v_ven uuid; v_prov uuid; v_a1 uuid; v_a2 uuid; v_a3 uuid; v_oc uuid; j jsonb; v_estado text; o record;
  v_partidas jsonb;
begin
  v_com := pg_temp.usuario('com94@hegamex.com', '{compras}');
  v_imp := pg_temp.usuario('imp94@hegamex.com', '{importaciones}');
  v_ven := pg_temp.usuario('ven94@hegamex.com', '{ventas}');
  insert into proveedores (nombre, razon_social, rfc, moneda, dias_credito, dias_entrega)
  values ('T94 Rodamientos del Bajío', 'T94 Rodamientos del Bajío SA de CV', 'RDB940101AB1', 'MXN', 30, 5) returning id into v_prov;
  insert into articulos (clave, tipo, nombre, unidad) values ('T94-6205', 'componente', 'T94 Rodamiento 6205 2RS', 'pieza') returning id into v_a1;
  insert into articulos (clave, tipo, nombre, unidad) values ('T94-CHUM', 'componente', 'T94 Chumacera de piso UCP 205', 'pieza') returning id into v_a2;
  insert into articulos (clave, tipo, nombre, unidad) values ('T94-CON', 'componente', 'T94 Rodamiento cónico 30205', 'pieza') returning id into v_a3;

  -- Lo que leyó Claude: la primera trae nuestra clave, la segunda una del proveedor
  -- que no conocemos y un nombre parecido, la tercera nada que se parezca.
  v_partidas := '[{"descripcion": "Rodamiento rígido de bolas", "clave": "t94 6205"},
                   {"descripcion": "T94 Chumacera de piso UCP 205", "clave": "UCP205-RB"},
                   {"descripcion": "Flete a planta", "clave": null},
                   {"descripcion": "Cono y taza", "clave": "302-05"},
                   {"descripcion": "T94 Chumacera de piso UCP 206", "clave": null},
                   {"descripcion": "Envío a planta", "clave": "RODAMIENTO"}]';

  perform pg_temp.como(v_com);
  -- El proveedor sale por RFC aunque venga con guiones, y por nombre aunque no sea idéntico.
  j := preparar_cotizacion(v_partidas, null, 'Otro nombre', 'RDB-940101-AB1');
  assert (j #>> '{proveedor,id}')::uuid = v_prov, format('por RFC no salió el proveedor: %s', j -> 'proveedor');
  j := preparar_cotizacion(v_partidas, null, 'T94 Rodamientos del Bajio S.A.', null);
  assert (j #>> '{proveedor,id}')::uuid = v_prov, format('por nombre no salió el proveedor: %s', j -> 'proveedor');
  assert j #>> '{partidas,0,origen}' = 'clave' and (j #>> '{partidas,0,articulo,id}')::uuid = v_a1, format('partida 0: %s', j #> '{partidas,0}');
  assert j #>> '{partidas,1,origen}' = 'sugerido' and (j #>> '{partidas,1,articulo,id}')::uuid = v_a2, format('partida 1: %s', j #> '{partidas,1}');
  assert j #> '{partidas,2,articulo}' = 'null'::jsonb, format('partida 2 debía quedar sin artículo: %s', j #> '{partidas,2}');
  -- La clave del proveedor viene dentro del nombre del artículo.
  assert j #>> '{partidas,3,origen}' = 'clave' and (j #>> '{partidas,3,articulo,id}')::uuid = v_a3, format('partida 3: %s', j #> '{partidas,3}');
  -- Mismo nombre con otra medida (206 y no 205): no se sugiere.
  assert j #> '{partidas,4,articulo}' = 'null'::jsonb, format('partida 4 sugirió otra medida: %s', j #> '{partidas,4}');
  -- Una "clave" sin números no es número de parte: no se busca dentro de los nombres.
  assert j #> '{partidas,5,articulo}' = 'null'::jsonb, format('partida 5 emparejó una clave sin números: %s', j #> '{partidas,5}');

  -- Crear: dos con artículo y el flete como texto; recuerda la clave del proveedor.
  v_oc := crear_oc_desde_cotizacion(v_prov, jsonb_build_array(
      jsonb_build_object('articulo_id', v_a1, 'descripcion', 'Rodamiento rígido de bolas', 'clave', 't94 6205', 'cantidad', 10, 'costo_unitario', 85.5),
      jsonb_build_object('articulo_id', v_a2, 'descripcion', 'Chumacera UCP 205', 'clave', 'UCP205-RB', 'cantidad', 4, 'costo_unitario', 310),
      jsonb_build_object('descripcion', 'Flete a planta', 'cantidad', 1, 'costo_unitario', 450)),
    null, null, null, 'Cotización 1234 del 8 oct');
  select * into o from ordenes_compra where id = v_oc;
  assert o.estado = 'borrador' and o.moneda = 'MXN' and o.condiciones = 'Crédito a 30 días', format('orden: %s %s %s', o.estado, o.moneda, o.condiciones);
  assert o.subtotal = 10 * 85.5 + 4 * 310 + 450, format('subtotal %s', o.subtotal);
  assert (select count(*) from oc_lineas where orden_compra_id = v_oc and articulo_id is null and descripcion = 'Flete a planta') = 1, 'el flete no quedó como texto';
  assert exists (select 1 from claves_proveedor where proveedor_id = v_prov and clave = 'UCP205RB' and articulo_id = v_a2), 'no recordó la clave del proveedor';
  -- La siguiente cotización ya llega emparejada por la clave del proveedor.
  j := preparar_cotizacion('[{"descripcion": "Housing unit", "clave": "ucp 205 rb"}]', v_prov);
  assert j #>> '{partidas,0,origen}' = 'recordado' and (j #>> '{partidas,0,articulo,id}')::uuid = v_a2, format('no la recordó: %s', j #> '{partidas,0}');
  -- Sin pedirlo, el costo del artículo no cambia.
  assert not exists (select 1 from costos_articulo where articulo_id = v_a1), 'cambió el costo sin pedirlo';

  -- Con permiso de costos (compras lo tiene) y pidiéndolo: costo e historial con la orden.
  v_oc := crear_oc_desde_cotizacion(v_prov, jsonb_build_array(
      jsonb_build_object('articulo_id', v_a1, 'clave', '6205', 'cantidad', 5, 'costo_unitario', 88),
      jsonb_build_object('articulo_id', v_a1, 'clave', '6205', 'cantidad', 5, 'costo_unitario', 88)),
    'MXN', null, 10, null, false, true);
  assert (select costo from costos_articulo where articulo_id = v_a1) = 88, 'no actualizó el costo';
  assert exists (select 1 from historial_costos h join ordenes_compra x on x.folio = h.referencia
                 where h.articulo_id = v_a1 and h.origen = 'cotizacion_proveedor' and x.id = v_oc), 'el historial no dice que vino de la cotización';
  assert not exists (select 1 from claves_proveedor where proveedor_id = v_prov and clave = '6205'), 'recordó la clave sin pedirlo';

  -- Partidas incompletas: no se crea nada.
  begin
    perform crear_oc_desde_cotizacion(v_prov, '[{"descripcion": "Sin cantidad", "costo_unitario": 10}]');
    assert false, 'creó una orden con una partida sin cantidad';
  exception when invalid_parameter_value then null;
  end;

  -- Importaciones arma órdenes (compras 2) pero no toca costos.
  perform pg_temp.como(v_imp);
  begin
    perform crear_oc_desde_cotizacion(v_prov, jsonb_build_array(jsonb_build_object('articulo_id', v_a1, 'cantidad', 1, 'costo_unitario', 1)),
      null, null, null, null, true, true);
    v_estado := 'cambió el costo';
  exception when insufficient_privilege then v_estado := 'negado';
  end;
  assert v_estado = 'negado', 'importaciones actualizó costos desde una cotización';
  assert (select costo from costos_articulo where articulo_id = v_a1) = 88, 'el costo cambió';

  -- Ventas no prepara, no crea y no ve las claves de los proveedores.
  perform pg_temp.como(v_ven);
  begin
    perform preparar_cotizacion(v_partidas, v_prov);
    assert false, 'ventas preparó una cotización de proveedor';
  exception when insufficient_privilege then null;
  end;
  begin
    perform crear_oc_desde_cotizacion(v_prov, jsonb_build_array(jsonb_build_object('descripcion', 'x', 'cantidad', 1, 'costo_unitario', 1)));
    assert false, 'ventas creó una orden de compra';
  exception when insufficient_privilege then null;
  end;
  assert not exists (select 1 from claves_proveedor where proveedor_id = v_prov), 'ventas ve las claves de los proveedores';
end $$;

-- El resumen de movimientos de almacén que lee el asistente: cuenta entradas, salidas y ajustes del
-- periodo, no cuenta lo que se deshizo, no trae costos, y quien no ve los movimientos en pantalla
-- tampoco los ve por aquí. La base pone la hora de cada movimiento, así que se mide contra lo que
-- ya había hoy.
do $$
declare v_alm uuid; v_vend uuid; v_taller uuid; v_a uuid; v_b uuid; v_almacen int; v_mal bigint; v_ok boolean;
  v_d date := hoy_planta() - 1; v_h date := hoy_planta() + 1; r0 jsonb; r jsonb;
begin
  v_alm := pg_temp.usuario('alm306@hegamex.com', '{almacen}');
  v_vend := pg_temp.usuario('vend306@hegamex.com', '{ventas}');
  v_taller := pg_temp.usuario('taller306@hegamex.com', '{produccion}');
  select id into v_almacen from almacenes order by id limit 1;
  insert into articulos (clave, tipo, nombre, unidad) values ('T306-TOR', 'materia_prima', 'Tornillo 306', 'pieza') returning id into v_a;
  insert into articulos (clave, tipo, nombre, unidad) values ('T306-LAM', 'materia_prima', 'Lámina 306', 'kg') returning id into v_b;

  perform pg_temp.como(v_alm);
  r0 := movimientos_almacen(v_d, v_h);
  perform pg_temp.como_postgres();
  insert into movimientos_inventario (tipo, articulo_id, almacen_id, cantidad, costo_unitario, usuario_id) values
    ('entrada_compra', v_a, v_almacen, 5000, 7.77, v_alm),
    ('entrada_compra', v_b, v_almacen, 80, 33.33, v_alm),
    ('salida_consumo', v_a, v_almacen, -20, 7.77, v_alm),
    ('salida_consumo', v_a, v_almacen, -30, 7.77, v_alm),
    ('salida_consumo', v_b, v_almacen, -2, 33.33, v_alm),
    ('ajuste_salida', v_b, v_almacen, -5, 33.33, v_alm);
  -- Una salida capturada por error y deshecha: ninguna de las dos cuenta.
  insert into movimientos_inventario (tipo, articulo_id, almacen_id, cantidad, usuario_id)
    values ('salida_consumo', v_a, v_almacen, -400, v_alm) returning id into v_mal;
  insert into movimientos_inventario (tipo, articulo_id, almacen_id, cantidad, usuario_id, deshace_id)
    values ('devolucion', v_a, v_almacen, 400, v_alm, v_mal);

  perform pg_temp.como(v_alm);
  r := movimientos_almacen(v_d, v_h);
  assert (r->>'movimientos')::int - (r0->>'movimientos')::int = 6 and (r->>'deshechos')::int - (r0->>'deshechos')::int = 2,
    format('conteo: %s movimientos, %s deshechos (había %s y %s)', r->>'movimientos', r->>'deshechos', r0->>'movimientos', r0->>'deshechos');
  assert (select (x->>'movimientos')::int from jsonb_array_elements(r->'por_tipo') x where x->>'tipo' = 'Entrada por compra')
       - coalesce((select (x->>'movimientos')::int from jsonb_array_elements(r0->'por_tipo') x where x->>'tipo' = 'Entrada por compra'), 0) = 2, 'entradas por compra';
  assert (select (x->>'movimientos')::int from jsonb_array_elements(r->'por_tipo') x where x->>'tipo' = 'Salida a consumo interno')
       - coalesce((select (x->>'movimientos')::int from jsonb_array_elements(r0->'por_tipo') x where x->>'tipo' = 'Salida a consumo interno'), 0) = 3, 'salidas a consumo';
  assert (r->'ajustes'->>'que_bajan')::int - (r0->'ajustes'->>'que_bajan')::int = 1, 'ajustes que bajan';
  -- Las salidas se suman en positivo y lo deshecho (400) no entra.
  assert (select (x->>'cantidad')::numeric from jsonb_array_elements(r->'consumo_interno'->'lista') x where x->>'clave' = 'T306-TOR') = 50
      or (r->'consumo_interno'->>'movimientos')::int > 15, format('consumo del tornillo: %s', r->'consumo_interno');
  assert (select (x->>'cantidad')::numeric from jsonb_array_elements(r->'lo_que_mas_entro') x where x->>'clave' = 'T306-TOR') = 5000, 'la entrada grande no sale en lo que más entró';
  assert r::text !~* 'costo|7\.77|33\.33', 'el resumen trae costos';

  -- Periodos que no se contestan.
  begin perform movimientos_almacen(v_h, v_d); v_ok := true; exception when invalid_parameter_value then v_ok := false; end;
  assert not v_ok, 'aceptó un periodo al revés';
  begin perform movimientos_almacen(v_d - 300, v_h); v_ok := true; exception when invalid_parameter_value then v_ok := false; end;
  assert not v_ok, 'aceptó casi un año';

  -- Ventas y el taller no ven los movimientos en pantalla: aquí tampoco.
  perform pg_temp.como(v_vend);
  begin perform movimientos_almacen(v_d, v_h); v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'ventas vio los movimientos de almacén';
  perform pg_temp.como(v_taller);
  begin perform movimientos_almacen(v_d, v_h); v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'el taller vio los movimientos de almacén';
end $$;

-- Analítica de almacén y mantenimiento: cada artículo cae en su clase de salud y su celda ABC-XYZ,
-- el valor solo lo ve quien ve costos, ventas no ve nada; la carga de preventivo proyecta los planes.
do $$
declare v_alm uuid; v_dir uuid; v_ven uuid; v_mtto uuid; v_pb int; a_reg uuid; a_muerto uuid; a_err uuid; v_maq uuid;
  s jsonb; m jsonb; l jsonb; v_ok boolean; i int;
begin
  v_alm := pg_temp.usuario('alm247@hegamex.com', '{almacen}');
  v_dir := pg_temp.usuario('dir247@hegamex.com', '{direccion}');
  v_ven := pg_temp.usuario('ven247@hegamex.com', '{ventas}');
  v_mtto := pg_temp.usuario('mtto247@hegamex.com', '{mantenimiento}');
  select id into v_pb from almacenes where nombre = 'Planta Baja';

  -- Uno que sale parejo los 12 meses, uno que no se mueve y uno que sale de golpe dos veces.
  insert into articulos (clave, tipo, nombre, unidad) values ('T247-REG', 'componente', 'Regular 247', 'pieza') returning id into a_reg;
  insert into articulos (clave, tipo, nombre, unidad) values ('T247-MUE', 'componente', 'Muerto 247', 'pieza') returning id into a_muerto;
  insert into articulos (clave, tipo, nombre, unidad) values ('T247-ERR', 'componente', 'Errático 247', 'pieza') returning id into a_err;
  insert into costos_articulo (articulo_id, costo) values (a_reg, 100), (a_muerto, 1000), (a_err, 50)
    on conflict (articulo_id) do update set costo = excluded.costo;
  insert into movimientos_inventario (tipo, articulo_id, almacen_id, cantidad) values
    ('inicial', a_reg, v_pb, 15), ('inicial', a_muerto, v_pb, 4), ('inicial', a_err, v_pb, 3);
  for i in 1..12 loop
    insert into historial_movimientos_hoja (fecha, articulo_id, nombre_original, cantidad, tipo)
    values (date_trunc('month', current_date) - make_interval(months => i) + interval '10 days', a_reg, 'Regular 247', 10, 'SALIDA');
  end loop;
  insert into historial_movimientos_hoja (fecha, articulo_id, nombre_original, cantidad, tipo) values
    (date_trunc('month', current_date) - interval '2 months' + interval '5 days', a_err, 'Errático 247', 40, 'SALIDA'),
    (date_trunc('month', current_date) - interval '9 months' + interval '5 days', a_err, 'Errático 247', 2, 'SALIDA');

  -- 1. Ventas no ve la salud del inventario.
  perform pg_temp.como(v_ven);
  begin perform almacen_salud(); v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'ventas vio la salud del inventario';
  begin perform mantenimiento_analitica(current_date - 30, current_date); v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'ventas vio la analítica de mantenimiento';

  -- 2. Almacén: cada uno en su clase; sin costos, el ABC va por rotación y no llega ningún valor.
  perform pg_temp.como(v_alm);
  s := almacen_salud();
  assert s->>'abc_por' = 'rotacion' and s->'totales'->>'valor_stock' is null, format('sin costos: %s', s->'totales');
  l := almacen_salud_lista('salud', 'sin_movimiento');
  assert exists (select 1 from jsonb_array_elements(l) e where e->>'clave' = 'T247-MUE' and e->>'valor_stock' is null), 'el muerto no salió sin movimiento (o con valor)';
  l := almacen_salud_lista('matriz', 'AX');
  assert exists (select 1 from jsonb_array_elements(l) e where e->>'clave' = 'T247-REG'), format('el regular no es AX: %s', l);
  l := almacen_salud_lista('matriz', 'CZ');
  assert exists (select 1 from jsonb_array_elements(l) e where e->>'clave' = 'T247-ERR'), 'el errático no es CZ';
  assert (select e->>'salud' from jsonb_array_elements(almacen_salud_lista('matriz', 'AX')) e where e->>'clave' = 'T247-REG') in ('sano', 'exceso', 'bajo_reorden'),
    'el regular no tiene clase de salud con demanda';

  -- 3. Dirección sí ve el valor (4 × 1,000 del que no se mueve).
  perform pg_temp.como(v_dir);
  s := almacen_salud();
  assert s->>'abc_por' = 'valor' and (s->'totales'->>'valor_stock')::numeric >= 4000, format('con costos: %s', s->'totales');
  assert (select (e->>'valor_stock')::numeric from jsonb_array_elements(almacen_salud_lista('salud', 'sin_movimiento')) e where e->>'clave' = 'T247-MUE') = 4000,
    'valor del que no se mueve';

  -- 4. Mantenimiento: un plan cada 14 días proyecta 3 en 8 semanas, no solo la orden ya generada.
  perform pg_temp.como_postgres();
  insert into maquinas (numero, nombre, categoria, criticidad) values ('T247-01', 'Prensa 247', 'prensa', 'muy_alta') returning id into v_maq;
  insert into planes_preventivos (maquina_id, nombre, cada_dias, ultima_fecha) values (v_maq, 'Quincenal 247', 14, hoy_planta() - 3);
  perform pg_temp.como(v_mtto);
  m := mantenimiento_analitica(current_date - 30, current_date);
  assert (select sum((c->>'alta')::int) from jsonb_array_elements(m->'carga') c) >= 3, format('carga: %s', m->'carga');
  assert jsonb_array_length(m->'antiguedad') = 5 and jsonb_array_length(m->'semanas') >= 4, 'faltan semanas o antigüedad';
  perform pg_temp.como_postgres();
end $$;

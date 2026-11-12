-- «Consumo atípico» divide entre las semanas de historia que de verdad hay (no siempre 12) y no
-- repite un artículo que ya tiene su hallazgo abierto.
do $$
declare v_pb int; v_x uuid; v_y uuid;
begin
  select id into v_pb from almacenes where nombre = 'Planta Baja';
  insert into articulos (clave, tipo, nombre, unidad) values ('P284-X', 'componente', 'Disco 284 X', 'pieza') returning id into v_x;
  insert into articulos (clave, tipo, nombre, unidad) values ('P284-Y', 'componente', 'Guante 284 Y', 'pieza') returning id into v_y;
  insert into movimientos_inventario (tipo, articulo_id, almacen_id, cantidad) values ('inicial', v_x, v_pb, 500), ('inicial', v_y, v_pb, 500);
  -- Tres semanas de historia (el primer consumo de toda la base es de hace 28 días). El disparador
  -- que pone la hora se apaga para fecharlos en el pasado, como en 30_inventario.
  alter table movimientos_inventario disable trigger aplicar;
  insert into movimientos_inventario (tipo, articulo_id, almacen_id, cantidad, en) values
    ('salida_consumo', v_x, v_pb, -10, now() - interval '28 days'),
    ('salida_consumo', v_x, v_pb, -10, now() - interval '20 days'),
    ('salida_consumo', v_x, v_pb, -10, now() - interval '13 days'),
    ('salida_consumo', v_y, v_pb, -3, now() - interval '20 days'),
    -- Esta semana: X lleva lo de siempre ×2; Y, diez veces lo de siempre.
    ('salida_consumo', v_x, v_pb, -20, now() - interval '2 days'),
    ('salida_consumo', v_y, v_pb, -10, now() - interval '2 days');
  alter table movimientos_inventario enable trigger aplicar;
  -- Si la base ya tenía consumos más viejos, la historia sería más larga y la prueba no mediría esto.
  assert (select min(en) from movimientos_inventario where tipo = 'salida_consumo') >= now() - interval '28 days 1 minute',
    'hay consumos más viejos en la base: la prueba no aplica';

  -- X: 20 contra 10 por semana no es atípico (con ÷12 salía «2.5 de costumbre» y sí salía).
  assert not exists (select 1 from revision_r_salida_consumo_atipica() where registro_id = v_x::text), 'X salió atípico con su promedio real';
  -- Y: 10 contra 1 por semana sí.
  assert exists (select 1 from revision_r_salida_consumo_atipica() where registro_id = v_y::text and titulo like '%contra 1.0 de costumbre'),
    'Y no salió, o con otro promedio: ' || coalesce((select titulo from revision_r_salida_consumo_atipica() where registro_id = v_y::text), 'nada');

  -- Con su hallazgo abierto, no se repite.
  insert into revision_hallazgos (origen, regla, modulo, tabla, registro_id, titulo, detalle, para, huella)
  values ('regla', 'salida_consumo_atipica', 'inventario', 'articulos', v_y::text, 'Consumo de P284-Y', 'x', 'direccion', 'prueba284');
  assert not exists (select 1 from revision_r_salida_consumo_atipica() where registro_id = v_y::text), 'repitió un artículo con hallazgo abierto';
end $$;

-- Al contar un almacén, la captura dice en qué otros almacenes hay existencia del artículo (solo el
-- nombre, nunca cuánto: sigue siendo a ciegas), y contar en uno no toca la existencia del otro.
do $$
declare v_alm uuid; v_dir uuid; v_aj uuid; v_pb int; v_c2 int; a1 uuid; a2 uuid; v_c uuid; r record;
begin
  v_alm := pg_temp.usuario('alm271@hegamex.com', '{almacen}');
  v_dir := pg_temp.usuario('dir271@hegamex.com', '{direccion}');
  select id into v_pb from almacenes where nombre = 'Planta Baja';
  select id into v_c2 from almacenes where nombre = 'Contenedor 2';
  insert into articulos (clave, tipo, nombre) values ('T271-A', 'componente', 'T271 Catarina') returning id into a1;
  insert into articulos (clave, tipo, nombre) values ('T271-B', 'componente', 'T271 Polea') returning id into a2;
  insert into movimientos_inventario (tipo, articulo_id, almacen_id, cantidad, motivo) values
    ('inicial', a1, v_pb, 34, 'T271'), ('inicial', a1, v_c2, 103, 'T271'), ('inicial', a2, v_pb, 6, 'T271');

  perform pg_temp.como(v_alm);
  v_c := crear_conteo(v_pb, 'Tanda 271', 'claves', null, 'T271-A, T271-B', true);
  select * into r from conteo_captura(v_c) c where c.articulo_id = a1;
  assert r.otros_almacenes = array['Contenedor 2'], format('debía decir que también hay en Contenedor 2: %s', r.otros_almacenes);
  assert r.sistema is null, 'a ciegas no enseña el sistema';
  assert (select otros_almacenes from conteo_captura(v_c) c where c.articulo_id = a2) is null, 'la polea solo está aquí';

  -- Contar 5 en Planta Baja deja 5 en Planta Baja; el Contenedor 2 no se toca.
  insert into conteo_lineas (conteo_id, articulo_id, cantidad_contada) values (v_c, a1, 5);
  perform cerrar_conteo(v_c);
  select id into v_aj from ajustes_inventario where conteo_id = v_c and articulo_id = a1;
  assert (select almacen_id = v_pb and cantidad_sistema = 34 and cantidad_fisica = 5 from ajustes_inventario where id = v_aj),
    'el ajuste debía ser solo de Planta Baja (34 → 5)';
  perform pg_temp.como(v_dir);
  perform resolver_ajuste(v_aj, true, 'Visto');
  perform pg_temp.como_postgres();
  assert (select cantidad from existencias where articulo_id = a1 and almacen_id = v_pb) = 5, 'Planta Baja debía quedar en 5';
  assert (select cantidad from existencias where articulo_id = a1 and almacen_id = v_c2) = 103, 'el Contenedor 2 no se toca';
end $$;

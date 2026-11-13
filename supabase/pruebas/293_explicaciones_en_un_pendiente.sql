-- Las explicaciones que la gerencia le pide a una persona van en un solo pendiente que se va
-- vaciando: explicar en el ajuste o resolverlo lo quita de la lista; vacío, se cierra solo; cerrarlo
-- con nota la deja como explicación de los que faltan. Otra persona que pregunta abre el suyo.
do $$
declare v_alm uuid; v_ger uuid; v_dir uuid; v_pb int; a1 uuid; a2 uuid; a3 uuid; a4 uuid; v_p uuid; v_p2 uuid; i int; v_art uuid;
begin
  v_alm := pg_temp.usuario('alm293@hegamex.com', '{almacen}');
  v_ger := pg_temp.usuario('ger293@hegamex.com', '{gerente_produccion}');
  v_dir := pg_temp.usuario('dir293@hegamex.com', '{direccion}');
  select id into v_pb from almacenes where nombre = 'Planta Baja';
  for i in 1..4 loop
    insert into articulos (clave, tipo, nombre, unidad) values ('E293-' || i, 'componente', 'Pieza 293 ' || i, 'pieza') returning id into v_art;
    insert into movimientos_inventario (tipo, articulo_id, almacen_id, cantidad, motivo) values ('inicial', v_art, v_pb, 10, 'T293');
  end loop;
  perform pg_temp.como(v_alm);
  a1 := solicitar_ajuste((select id from articulos where clave = 'E293-1'), v_pb, 8, 'Conteo 293');
  a2 := solicitar_ajuste((select id from articulos where clave = 'E293-2'), v_pb, 8, 'Conteo 293');
  a3 := solicitar_ajuste((select id from articulos where clave = 'E293-3'), v_pb, 8, 'Conteo 293');
  a4 := solicitar_ajuste((select id from articulos where clave = 'E293-4'), v_pb, 8, 'Conteo 293');

  -- Tres preguntas de la gerencia: un solo pendiente.
  perform pg_temp.como(v_ger);
  v_p := pedir_explicacion_ajuste(a1);
  assert pedir_explicacion_ajuste(a2, null, '¿Se usaron en la OP?') = v_p, 'abrió otro pendiente';
  assert pedir_explicacion_ajuste(a3) = v_p, 'abrió otro pendiente';
  perform pg_temp.como_postgres();
  assert (select count(*) from pendientes where responsable_id = v_alm and estado = 'abierto') = 1, 'no quedó un solo pendiente';
  assert (select titulo from pendientes where id = v_p) = 'Explica 3 diferencias de ajustes de inventario', 'el título no dice 3';
  assert (select detalle like '%Pregunta: ¿Se usaron en la OP?%' from pendientes where id = v_p), 'la lista no trae la pregunta';

  -- Dirección pregunta otro: su propio pendiente.
  perform pg_temp.como(v_dir);
  v_p2 := pedir_explicacion_ajuste(a4);
  assert v_p2 <> v_p, 'juntó preguntas de dos personas';

  -- Explica uno en el ajuste: quedan 2. La gerencia rechaza otro: queda 1.
  perform pg_temp.como(v_alm);
  perform explicar_ajuste(a1, 'Se dañaron dos piezas al descargar');
  perform pg_temp.como_postgres();
  assert (select titulo from pendientes where id = v_p) = 'Explica 2 diferencias de ajustes de inventario', 'no bajó a 2';
  perform pg_temp.como(v_ger);
  perform resolver_ajuste(a2, false, 'Se recuenta');
  perform pg_temp.como_postgres();
  assert (select titulo from pendientes where id = v_p) = 'Explica la diferencia de 1 ajuste de inventario', 'no bajó a 1';

  -- Lo cierra desde Pendientes con su nota: queda como explicación del que faltaba.
  perform pg_temp.como(v_alm);
  update pendientes set estado = 'hecho', nota_cierre = 'AJU de la pieza 3: se usaron en la OP sin registrar' where id = v_p;
  perform pg_temp.como_postgres();
  assert exists (select 1 from ajuste_notas where ajuste_id = a3 and tipo = 'explicacion' and por = v_alm), 'la nota no quedó como explicación';

  -- El de dirección: al explicarlo en el ajuste se cierra solo.
  perform pg_temp.como(v_alm);
  perform explicar_ajuste(a4, 'Estaban en Mallado, ya se regresaron');
  perform pg_temp.como_postgres();
  assert (select estado from pendientes where id = v_p2) = 'hecho', 'no se cerró solo al quedar vacío';
end $$;

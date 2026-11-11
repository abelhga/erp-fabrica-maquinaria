-- Juntar un artículo repetido: todo lo del que sale pasa al que se queda y las existencias cuadran
-- con los movimientos. Lo que NO: almacén no junta; no se juntan un equipo con un componente, ni
-- uno que ya se juntó, ni dos subensambles que tienen cada uno su lista.
do $$
declare v_dir uuid; v_alm uuid; v_pb int; v_ma int; a uuid; b uuid; eq uuid; v_op uuid; v_c uuid; v_res uuid;
  r jsonb; v_ok boolean; v_msg text;
begin
  v_dir := pg_temp.usuario('dir274@hegamex.com', '{direccion}');
  v_alm := pg_temp.usuario('alm274@hegamex.com', '{almacen}');
  select id into v_pb from almacenes where nombre = 'Planta Baja';
  select id into v_ma from almacenes where nombre = 'Mallado';
  insert into articulos (clave, tipo, nombre) values ('T274-A', 'componente', 'T274 Rondana de presión 5/16"') returning id into a;
  insert into articulos (clave, tipo, nombre) values ('T274-B', 'componente', 'T274 Rondana presion 5/16') returning id into b;
  insert into articulos (clave, tipo, nombre) values ('T274-EQ', 'equipo', 'T274 Banda') returning id into eq;
  -- El de las listas no tiene existencia; el repetido sí, en dos almacenes.
  insert into movimientos_inventario (tipo, articulo_id, almacen_id, cantidad, motivo)
  values ('inicial', a, v_pb, 5, 'T274'), ('inicial', b, v_pb, 70, 'T274'), ('inicial', b, v_ma, 4, 'T274');
  insert into bom_lineas (padre_id, hijo_id, cantidad) values (eq, a, 2), (eq, b, 3);
  insert into ordenes_produccion (articulo_id, cantidad, estado) values (eq, 1, 'planeada') returning id into v_op;
  insert into op_materiales (orden_id, articulo_id, requerido, surtido) values (v_op, a, 4, 0), (v_op, b, 3, 1);
  insert into conteos (nombre, almacen_id) values ('Conteo 274', v_pb) returning id into v_c;
  insert into conteo_lineas (conteo_id, articulo_id, cantidad_contada) values (v_c, a, 5), (v_c, b, 68);
  insert into reservas (articulo_id, cantidad, motivo) values (b, 2, 'T274') returning id into v_res;
  insert into costos_articulo (articulo_id, costo) values (b, 1.5);

  -- 1. Lo que NO: almacén no junta.
  perform pg_temp.como(v_alm);
  begin perform juntar_articulos(a, b, 'Repetido'); v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'almacén pudo juntar artículos';

  -- 2. Dirección los junta.
  perform pg_temp.como(v_dir);
  begin perform juntar_articulos(a, eq, 'Prueba'); v_ok := true; exception when check_violation then v_ok := false; v_msg := sqlerrm; end;
  assert not v_ok and v_msg like 'No son del mismo tipo%', format('juntó un equipo con un componente: %s', v_msg);
  r := juntar_articulos(a, b, 'Es la misma rondana, dada de alta dos veces');
  assert (r->>'ok')::boolean, format('juntar: %s', r);

  perform pg_temp.como_postgres();
  -- Existencias: sumadas por almacén, y cuadran con los movimientos (que ahora son del que se queda).
  assert (select cantidad from existencias where articulo_id = a and almacen_id = v_pb) = 75, 'Planta Baja no sumó';
  assert (select cantidad from existencias where articulo_id = a and almacen_id = v_ma) = 4, 'Mallado no pasó';
  assert not exists (select 1 from existencias where articulo_id = b), 'el que sale conservó existencia';
  assert (select sum(cantidad) from movimientos_inventario where articulo_id = a) = 79, 'los movimientos no pasaron';
  assert not exists (select 1 from movimientos_inventario where articulo_id = b), 'quedaron movimientos en el que sale';
  -- Lista de materiales y orden: un renglón con la suma.
  assert (select count(*) = 1 and sum(cantidad) = 5 from bom_lineas where padre_id = eq), 'la lista no quedó en un renglón de 5';
  assert (select requerido = 7 and surtido = 1 from op_materiales where orden_id = v_op and articulo_id = a), 'la orden no sumó requerido y surtido';
  assert (select count(*) from op_materiales where orden_id = v_op) = 1, 'la orden quedó con dos renglones';
  -- Conteo: lo contado y lo que decía el sistema se suman.
  assert (select cantidad_contada = 73 and sistema_al_contar = 75 from conteo_lineas where conteo_id = v_c and articulo_id = a),
    format('el conteo no sumó: %s', (select row(cantidad_contada, sistema_al_contar) from conteo_lineas where conteo_id = v_c and articulo_id = a));
  -- Apartado y costo pasan; el que sale queda inactivo, con nota y constancia.
  assert (select articulo_id = a from reservas where id = v_res), 'el apartado no pasó';
  assert (select costo = 1.5 from costos_articulo where articulo_id = a), 'el costo no pasó';
  assert (select not activo and descripcion like 'Se juntó con T274-A%' from articulos where id = b), 'el que sale no quedó inactivo con nota';
  assert exists (select 1 from articulos_juntados where sale_id = b and queda_id = a and movido ? 'existencias'), 'no quedó constancia';
  assert current_setting('session_replication_role') = 'origin', 'los disparadores quedaron apagados';

  -- 3. Lo que NO: uno que ya se juntó no se vuelve a juntar.
  perform pg_temp.como(v_dir);
  begin perform juntar_articulos(a, b, 'Otra vez'); v_ok := true; exception when check_violation then v_ok := false; end;
  assert not v_ok, 'juntó otra vez uno inactivo';
end $$;

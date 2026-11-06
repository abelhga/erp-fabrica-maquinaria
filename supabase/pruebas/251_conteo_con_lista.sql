-- Conteo con lista y a ciegas (251): la captura trae solo la lista (más lo agregado al contar), lo
-- que dice el sistema no se ve hasta capturar, y al cerrar solo se ajusta lo contado.
do $$
declare v_alm uuid; v_ven uuid; v_pb int; a1 uuid; a2 uuid; a3 uuid; v_c uuid; v_todo uuid; v_ok boolean; r record; v_msg text;
begin
  v_alm := pg_temp.usuario('alm251@hegamex.com', '{almacen}');
  v_ven := pg_temp.usuario('ven251@hegamex.com', '{ventas}');
  select id into v_pb from almacenes where nombre = 'Planta Baja';
  insert into articulos (clave, tipo, nombre) values ('T251-A', 'componente', 'T251 Chumacera') returning id into a1;
  insert into articulos (clave, tipo, nombre) values ('T251-B', 'componente', 'T251 Tornillo') returning id into a2;
  insert into articulos (clave, tipo, nombre) values ('T251-C', 'componente', 'T251 Tuerca') returning id into a3;
  insert into movimientos_inventario (tipo, articulo_id, almacen_id, cantidad, motivo) values
    ('inicial', a1, v_pb, 10, 'T251'), ('inicial', a2, v_pb, 20, 'T251'), ('inicial', a3, v_pb, 30, 'T251');

  perform pg_temp.como(v_alm);
  -- Con claves pegadas (minúsculas, comas y renglones da igual): solo esas dos.
  v_c := crear_conteo(v_pb, 'Tanda 251', 'claves', null, E't251-a,\nT251-B', true);
  assert (select count(*) from conteo_captura(v_c)) = 2, 'la captura trajo más que la lista';
  assert (select en_sistema from v_conteos where id = v_c) = 2 and (select capturados from v_conteos where id = v_c) = 0, 'v_conteos no cuenta la lista';

  -- A ciegas: sin capturar no se ve lo que dice el sistema; ya capturado, sí (y la diferencia).
  select * into r from conteo_captura(v_c) c where c.articulo_id = a1;
  assert r.sistema is null and r.diferencia is null, format('a ciegas enseñó el sistema: %s', r.sistema);
  insert into conteo_lineas (conteo_id, articulo_id, cantidad_contada) values (v_c, a1, 7);
  select * into r from conteo_captura(v_c) c where c.articulo_id = a1;
  assert r.sistema = 10 and r.diferencia = -3, format('ya contado: %s / %s', r.sistema, r.diferencia);

  -- Lo que se encuentra fuera de la lista se agrega al contar y entra en la cuenta.
  insert into conteo_lineas (conteo_id, articulo_id, cantidad_contada) values (v_c, a3, 30);
  assert (select count(*) from conteo_captura(v_c)) = 3 and (select en_sistema from v_conteos where id = v_c) = 3, 'lo agregado no entró';

  -- Claves que no existen: se dice cuáles y no se abre nada.
  begin
    perform crear_conteo(v_pb, null, 'claves', null, 'T251-A NOEXISTE-1', true); v_ok := true;
  exception when invalid_parameter_value then v_ok := false; get stacked diagnostics v_msg = message_text;
  end;
  assert not v_ok and v_msg like '%NOEXISTE-1%', 'abrió un conteo con claves que no existen';

  -- Sin lista sigue siendo todo el almacén y no es a ciegas si así se pide.
  v_todo := crear_conteo(v_pb, null, 'todo', null, null, false);
  assert (select count(*) from conteo_captura(v_todo) c where c.articulo_id in (a1, a2, a3)) = 3, 'el conteo de todo el almacén no trajo todo';
  assert (select sistema from conteo_captura(v_todo) c where c.articulo_id = a2) = 20, 'sin ciegas no enseñó el sistema';
  assert not (select con_lista from conteos where id = v_todo), 'el de todo el almacén quedó con lista';

  -- Lo que salió en los últimos días.
  perform registrar_salida(a2, v_pb, 1, 'salida_consumo', 'Taller T251');
  v_todo := crear_conteo(v_pb, null, 'movidos', 7, null, true);
  assert exists (select 1 from conteo_articulos where conteo_id = v_todo and articulo_id = a2)
     and not exists (select 1 from conteo_articulos where conteo_id = v_todo and articulo_id = a3), 'movidos no trajo lo que salió';

  -- Cerrar ajusta solo lo contado: el tornillo de la lista sin contar no se toca.
  perform cerrar_conteo(v_c);
  assert (select count(*) from ajustes_inventario where conteo_id = v_c) = 1, 'cerrar ajustó algo que no se contó';

  -- Ventas no abre conteos ni toca listas.
  perform pg_temp.como(v_ven);
  begin perform crear_conteo(v_pb, null, 'claves', null, 'T251-A', true); v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'ventas abrió un conteo';
  perform pg_temp.como_postgres();
end $$;

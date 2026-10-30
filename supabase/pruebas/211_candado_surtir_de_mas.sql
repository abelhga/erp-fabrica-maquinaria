-- De una partida de la lista no se surte más de lo que falta (lo pidieron Luis, Miguel y Mimí para
-- que la lista de materiales se depure con el uso). En partes sí; lo que no está en la lista, con
-- motivo; y los consumibles del taller, sin tope.
do $$
declare v_alm uuid; v_pb int; v_chum uuid; v_disco uuid; v_extra uuid; v_eq uuid; v_op uuid; v_cat int; v_ok boolean; v_msg text;
begin
  v_alm := pg_temp.usuario('alm211@hegamex.com', '{almacen}');
  select id into v_pb from almacenes where nombre = 'Planta Baja';
  insert into categorias (nombre, consumible_taller) values ('P211 Discos', true) returning id into v_cat;
  perform set_config('request.jwt.claims', json_build_object('sub', (select usuario_id from usuario_roles where rol = 'direccion' limit 1))::text, true);
  perform fijar_consumibles_taller(true, array(select id from categorias where consumible_taller));
  perform pg_temp.como_postgres();
  insert into articulos (clave, tipo, nombre, unidad) values ('P211-CHUM', 'componente', 'Chumacera 211', 'pieza') returning id into v_chum;
  insert into articulos (clave, tipo, nombre, unidad, categoria_id) values ('P211-DISCO', 'componente', 'Disco 211', 'pieza', v_cat) returning id into v_disco;
  insert into articulos (clave, tipo, nombre, unidad) values ('P211-EXTRA', 'componente', 'Rondana 211', 'pieza') returning id into v_extra;
  insert into articulos (clave, tipo, nombre) values ('P211-EQ', 'equipo', 'Banda 211') returning id into v_eq;
  insert into movimientos_inventario (tipo, articulo_id, almacen_id, cantidad) values
    ('inicial', v_chum, v_pb, 10), ('inicial', v_disco, v_pb, 10), ('inicial', v_extra, v_pb, 10);
  insert into ordenes_produccion (articulo_id, cantidad, estado) values (v_eq, 1, 'liberada') returning id into v_op;
  insert into op_materiales (orden_id, articulo_id, requerido) values (v_op, v_chum, 2), (v_op, v_disco, 1);

  perform pg_temp.como(v_alm);
  -- 1. Requiere 2: sale 1 y luego 1; la tercera ya no.
  perform surtir_material(v_op, jsonb_build_array(jsonb_build_object('articulo_id', v_chum, 'cantidad', 1, 'almacen_id', v_pb)), 'Juan');
  perform surtir_material(v_op, jsonb_build_array(jsonb_build_object('articulo_id', v_chum, 'cantidad', 1, 'almacen_id', v_pb)), 'Juan');
  begin
    perform surtir_material(v_op, jsonb_build_array(jsonb_build_object('articulo_id', v_chum, 'cantidad', 1, 'almacen_id', v_pb)), 'Juan');
    v_ok := true;
  exception when check_violation then v_ok := false; v_msg := sqlerrm; end;
  assert not v_ok and v_msg like '%solo faltan 0 por surtir%cambio a ingeniería%', format('se surtió de más: %s', v_msg);
  --    Tampoco de golpe más de lo que pide la lista.
  perform pg_temp.como_postgres();
  update op_materiales set surtido = 0 where orden_id = v_op and articulo_id = v_chum;
  perform pg_temp.como(v_alm);
  begin
    perform surtir_material(v_op, jsonb_build_array(jsonb_build_object('articulo_id', v_chum, 'cantidad', 3, 'almacen_id', v_pb)), 'Juan');
    v_ok := true;
  exception when check_violation then v_ok := false; v_msg := sqlerrm; end;
  assert not v_ok and v_msg like '%solo faltan 2 por surtir%', format('salieron 3 de una partida que pide 2: %s', v_msg);

  -- 2. Un consumible del taller no tiene tope: sale a nombre de quien lo recibe.
  perform surtir_material(v_op, jsonb_build_array(jsonb_build_object('articulo_id', v_disco, 'cantidad', 5, 'almacen_id', v_pb)), 'Juan');

  -- 3. Lo que no está en la lista sale con su motivo, y se puede volver a sacar.
  perform surtir_material(v_op, jsonb_build_array(jsonb_build_object('articulo_id', v_extra, 'cantidad', 2, 'almacen_id', v_pb, 'motivo', 'se perdieron')), 'Juan');
  perform surtir_material(v_op, jsonb_build_array(jsonb_build_object('articulo_id', v_extra, 'cantidad', 1, 'almacen_id', v_pb, 'motivo', 'otra más')), 'Juan');
  perform pg_temp.como_postgres();
  assert (select surtido from op_materiales where orden_id = v_op and articulo_id = v_extra) = 3, 'no quedó lo de fuera de la lista';
  assert (select -sum(cantidad) from movimientos_inventario where articulo_id = v_disco and tipo = 'salida_consumo') = 5, 'el consumible no salió al taller';
end $$;

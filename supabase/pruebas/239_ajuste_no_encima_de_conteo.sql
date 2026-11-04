-- Un ajuste pedido antes de contar ese artículo ya no se autoriza (el conteo lo corrigió); se rechaza
-- y queda de constancia. Contar sigue igual, y un ajuste de otro almacén o pedido después no se toca.
do $$
declare v_alm uuid; v_ger uuid; v_art uuid; v_pb int; v_ma int; v_conteo uuid; a1 uuid; a2 uuid; a3 uuid; v_ok boolean;
begin
  v_alm := pg_temp.usuario('alm239@hegamex.com', '{almacen}');
  v_ger := pg_temp.usuario('ger239@hegamex.com', '{gerente_produccion}');
  select id into v_pb from almacenes where nombre = 'Planta Baja';
  select id into v_ma from almacenes where nombre = 'Mallado';
  insert into articulos (clave, tipo, nombre) values ('T239-CHU', 'componente', 'T239 Chumacera') returning id into v_art;
  insert into movimientos_inventario (tipo, articulo_id, almacen_id, cantidad, motivo) values ('inicial', v_art, v_pb, 10, 'T239'), ('inicial', v_art, v_ma, 5, 'T239');

  -- Ajustes pedidos ayer: uno en Planta Baja (−3) y otro en Mallado (+1).
  perform pg_temp.como(v_alm);
  a1 := solicitar_ajuste(v_art, v_pb, 7, 'Cambio de la hoja T239');
  a2 := solicitar_ajuste(v_art, v_ma, 6, 'Cambio de la hoja T239');
  perform pg_temp.como_postgres();
  update ajustes_inventario set solicitado_en = now() - interval '1 day' where id in (a1, a2);

  -- Hoy se cuenta Planta Baja: encuentra 7 y su ajuste del conteo deja 7.
  perform pg_temp.como(v_alm);
  insert into conteos (nombre, almacen_id) values ('Conteo 239', v_pb) returning id into v_conteo;
  insert into conteo_lineas (conteo_id, articulo_id, cantidad_contada) values (v_conteo, v_art, 7);
  perform cerrar_conteo(v_conteo);
  perform pg_temp.como(v_ger);
  perform resolver_ajuste((select id from ajustes_inventario where conteo_id = v_conteo), true, 'Conteo');
  assert (select cantidad from existencias where articulo_id = v_art and almacen_id = v_pb) = 7, 'el conteo no dejó 7';

  -- 1. El de ayer en Planta Baja ya no se autoriza (quedaría en 4); se rechaza y queda.
  begin perform resolver_ajuste(a1, true); v_ok := true; exception when check_violation then v_ok := false; end;
  assert not v_ok, 'autorizó un ajuste encima del conteo';
  perform resolver_ajuste(a1, false, 'Ya lo corrigió el conteo');
  assert (select estado from ajustes_inventario where id = a1) = 'rechazado', 'no quedó rechazado';
  assert (select cantidad from existencias where articulo_id = v_art and almacen_id = v_pb) = 7, 'rechazar movió la existencia';

  -- 2. El de Mallado (no se contó) se autoriza normal.
  perform resolver_ajuste(a2, true, 'Visto');
  assert (select cantidad from existencias where articulo_id = v_art and almacen_id = v_ma) = 6, 'el de otro almacén no se aplicó';

  -- 3. Uno pedido después del conteo también se autoriza normal.
  perform pg_temp.como(v_alm);
  a3 := solicitar_ajuste(v_art, v_pb, 8, 'Apareció una en el taller T239');
  perform pg_temp.como(v_ger);
  perform resolver_ajuste(a3, true, 'Visto');
  assert (select cantidad from existencias where articulo_id = v_art and almacen_id = v_pb) = 8, 'el ajuste posterior no se aplicó';
  perform pg_temp.como_postgres();
end $$;

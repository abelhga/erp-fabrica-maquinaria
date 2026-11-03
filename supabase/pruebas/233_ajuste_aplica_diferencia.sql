-- Un ajuste aplica la diferencia que se encontró: lo que sale entre el conteo y la autorización se
-- respeta. Cada renglón del conteo guarda lo que decía el sistema al capturarlo (la pantalla no lo
-- puede cambiar), y si con la diferencia la existencia quedaría negativa no se autoriza.
do $$
declare v_alm uuid; v_ger uuid; v_art uuid; v_pb int; v_conteo uuid; v_aj uuid; v_ok boolean; r record;
begin
  v_alm := pg_temp.usuario('alm233@hegamex.com', '{almacen}');
  v_ger := pg_temp.usuario('ger233@hegamex.com', '{gerente_produccion}');
  select id into v_pb from almacenes where nombre = 'Planta Baja';
  insert into articulos (clave, tipo, nombre) values ('T233-CHU', 'componente', 'T233 Chumacera') returning id into v_art;
  insert into movimientos_inventario (tipo, articulo_id, almacen_id, cantidad, motivo) values ('inicial', v_art, v_pb, 86, 'T233');

  -- 1. Se cuentan 11 cuando el sistema dice 86; después salen 2 al taller y luego se cierra el conteo.
  perform pg_temp.como(v_alm);
  insert into conteos (nombre, almacen_id) values ('Conteo 233', v_pb) returning id into v_conteo;
  insert into conteo_lineas (conteo_id, articulo_id, cantidad_contada) values (v_conteo, v_art, 11);
  assert (select sistema_al_contar from conteo_lineas where conteo_id = v_conteo) = 86, 'no guardó lo que decía el sistema al contar';
  perform registrar_salida(v_art, v_pb, 2, 'salida_consumo', 'Taller T233');
  select * into r from conteo_captura(v_conteo) c where c.articulo_id = v_art;
  assert r.sistema = 86 and r.diferencia = -75, format('la captura mide contra lo de ahora: %s / %s', r.sistema, r.diferencia);

  -- 2. Almacén no puede cambiar lo que decía el sistema (de ahí sale el ajuste).
  update conteo_lineas set sistema_al_contar = 11 where conteo_id = v_conteo;
  assert (select sistema_al_contar from conteo_lineas where conteo_id = v_conteo) = 86, 'almacén cambió lo que decía el sistema al contar';

  perform cerrar_conteo(v_conteo);
  select id into v_aj from ajustes_inventario where conteo_id = v_conteo;
  assert (select cantidad_sistema = 86 and diferencia = -75 from ajustes_inventario where id = v_aj), 'el ajuste no salió de lo que decía el sistema al contar';

  -- 3. Sale 1 más antes de autorizar: queda 86 − 2 − 1 − 75 = 8, no las 11 que se contaron antes de esas salidas.
  perform registrar_salida(v_art, v_pb, 1, 'salida_consumo', 'Taller T233');
  perform pg_temp.como(v_ger);
  perform resolver_ajuste(v_aj, true, 'Visto');
  assert (select cantidad from existencias where articulo_id = v_art and almacen_id = v_pb) = 8,
    format('quedó en %s', (select cantidad from existencias where articulo_id = v_art and almacen_id = v_pb));
  assert (select aplicado from v_ajustes where id = v_aj) = -75, 'no aplicó la diferencia encontrada';

  -- 4. Si con la diferencia quedaría negativa, no se autoriza (pero sí se rechaza).
  perform pg_temp.como(v_alm);
  v_aj := solicitar_ajuste(v_art, v_pb, 5, 'Conteo T233 otra vez');   -- sistema 8, diferencia −3
  perform registrar_salida(v_art, v_pb, 6, 'salida_consumo', 'Taller T233');   -- quedan 2
  perform pg_temp.como(v_ger);
  begin perform resolver_ajuste(v_aj, true); v_ok := true; exception when check_violation then v_ok := false; end;
  assert not v_ok, 'autorizó un ajuste que dejaba la existencia negativa';
  perform resolver_ajuste(v_aj, false, 'Que se vuelva a contar');
  assert (select cantidad from existencias where articulo_id = v_art and almacen_id = v_pb) = 2, 'rechazar movió la existencia';

  -- 5. Recontar un renglón vuelve a tomar lo que dice el sistema en ese momento.
  perform pg_temp.como(v_alm);
  insert into conteos (nombre, almacen_id) values ('Conteo 233 b', v_pb) returning id into v_conteo;
  insert into conteo_lineas (conteo_id, articulo_id, cantidad_contada) values (v_conteo, v_art, 1);
  perform pg_temp.como_postgres();
  insert into movimientos_inventario (tipo, articulo_id, almacen_id, cantidad, motivo) values ('inicial', v_art, v_pb, 3, 'T233 entrada');
  perform pg_temp.como(v_alm);
  update conteo_lineas set cantidad_contada = 5 where conteo_id = v_conteo;
  select * into r from conteo_captura(v_conteo) c where c.articulo_id = v_art;
  assert r.sistema = 5 and r.diferencia = 0, format('al recontar: %s / %s', r.sistema, r.diferencia);
  perform pg_temp.como_postgres();
end $$;

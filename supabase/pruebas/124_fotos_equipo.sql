-- Fotos de un equipo: la principal es la que se ve en todo el ERP y junto a la partida;
-- las demás viajan como copia a la cotización, y lo ya cotizado no cambia si después se
-- cambian las fotos del equipo. Las agrega quien mantiene el catálogo (costeo 2).
do $$
declare
  v_ing uuid; v_vend uuid; v_eq uuid; v_comp uuid; v_cli uuid; v_cot uuid; v_dup uuid;
  v_f1 uuid; v_f2 uuid; v_f3 uuid; r cotizacion_lineas;
begin
  v_ing := pg_temp.usuario('ing124@hegamex.com', '{ingenieria}');
  v_vend := pg_temp.usuario('vend124@hegamex.com', '{ventas}');
  insert into articulos (clave, tipo, nombre) values ('T124-EQ', 'equipo', 'Banda 124') returning id into v_eq;
  insert into articulos (clave, tipo, nombre) values ('T124-C', 'componente', 'Polea 124') returning id into v_comp;

  -- Ventas no le pone fotos al equipo; ingeniería sí.
  perform pg_temp.como(v_vend);
  begin
    insert into articulo_imagenes (articulo_id, url) values (v_eq, 'https://x/vend.jpg');
    assert false, 'ventas agregó una foto a un equipo';
  exception when insufficient_privilege then null;
  end;
  perform pg_temp.como(v_ing);
  insert into articulo_imagenes (articulo_id, url, orden) values (v_eq, 'https://x/1.jpg', 0) returning id into v_f1;
  insert into articulo_imagenes (articulo_id, url, orden) values (v_eq, 'https://x/2.jpg', 1) returning id into v_f2;
  insert into articulo_imagenes (articulo_id, url, orden) values (v_eq, 'https://drive.google.com/file/d/1nv7lnqpIfqJo0uUrvFRriTGuFDBSLyu0/view', 2) returning id into v_f3;
  assert (select imagen_url from articulos where id = v_eq) = 'https://x/1.jpg', 'la principal no pasó al equipo';
  assert (select url from articulo_imagenes where id = v_f3) = 'https://lh3.googleusercontent.com/d/1nv7lnqpIfqJo0uUrvFRriTGuFDBSLyu0=w1000', 'la liga de Drive no se convirtió';
  begin
    insert into articulo_imagenes (articulo_id, url) values (v_comp, 'https://x/c.jpg');
    assert false, 'se agregó una foto en lista a un componente';
  exception when others then if sqlerrm not like '%equipos y subensambles%' then raise; end if;
  end;

  -- La partida lleva la principal y, aparte, las demás en orden.
  perform pg_temp.como_postgres();
  insert into clientes (nombre, vendedor_id) values ('T124 Cliente', v_vend) returning id into v_cli;
  perform pg_temp.como(v_vend);
  insert into cotizaciones (cliente_id) values (v_cli) returning id into v_cot;
  r := agregar_partida(v_cot, v_eq, 1);
  assert r.imagen_url = 'https://x/1.jpg' and r.imagenes_extra = array['https://x/2.jpg', 'https://lh3.googleusercontent.com/d/1nv7lnqpIfqJo0uUrvFRriTGuFDBSLyu0=w1000'],
    format('fotos de la partida: %s / %s', r.imagen_url, r.imagenes_extra);

  -- Ingeniería cambia la principal y quita una: el equipo cambia, la partida ya hecha no.
  perform pg_temp.como(v_ing);
  update articulo_imagenes set orden = -1 where id = v_f2;
  assert (select imagen_url from articulos where id = v_eq) = 'https://x/2.jpg', 'hacerla principal no cambió la del equipo';
  delete from articulo_imagenes where id = v_f3;
  perform pg_temp.como(v_vend);
  select * into r from cotizacion_lineas where cotizacion_id = v_cot;
  assert r.imagen_url = 'https://x/1.jpg' and cardinality(r.imagenes_extra) = 2, 'la partida ya cotizada cambió de fotos';

  -- Duplicar y nueva versión se llevan las fotos de la partida.
  v_dup := duplicar_cotizacion(v_cot);
  assert (select imagenes_extra from cotizacion_lineas where cotizacion_id = v_dup) = r.imagenes_extra, 'duplicar perdió las fotos';
  v_dup := nueva_version_cotizacion(v_cot);
  assert (select imagenes_extra from cotizacion_lineas where cotizacion_id = v_dup) = r.imagenes_extra, 'la nueva versión perdió las fotos';

  -- Sin fotos, el equipo se queda sin imagen.
  perform pg_temp.como(v_ing);
  delete from articulo_imagenes where articulo_id = v_eq;
  assert (select imagen_url from articulos where id = v_eq) is null, 'el equipo conservó una foto que ya no existe';
end $$;

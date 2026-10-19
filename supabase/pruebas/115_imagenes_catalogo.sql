-- La liga de Drive se convierte en imagen al guardarla (ficha y cotización), y quién
-- puede subir fotos al catálogo.
do $$
declare v_art uuid; v_cot uuid; v_cli uuid; v_alm uuid; v_ven uuid; v_rh uuid; v_url text;
  v_id text := '1nv7lnqpIfqJo0uUrvFRriTGuFDBSLyu0';
  v_lh3 text := 'https://lh3.googleusercontent.com/d/1nv7lnqpIfqJo0uUrvFRriTGuFDBSLyu0=w1000';
begin
  assert liga_imagen('https://drive.google.com/file/d/' || v_id || '/view?usp=sharing') = v_lh3, 'liga /view';
  assert liga_imagen('https://drive.google.com/open?id=' || v_id) = v_lh3, 'liga open?id=';
  assert liga_imagen('https://drive.google.com/uc?export=view&id=' || v_id) = v_lh3, 'liga uc?id=';
  assert liga_imagen(v_lh3) = v_lh3, 'la de lh3 se queda igual';
  assert liga_imagen('https://static.wixstatic.com/media/abc.jpg') = 'https://static.wixstatic.com/media/abc.jpg', 'la de Wix no se toca';
  assert liga_imagen('   ') is null, 'vacía es null';

  insert into articulos (clave, tipo, nombre, imagen_url) values ('T115', 'componente', 'Polea 115', 'https://drive.google.com/file/d/' || v_id || '/view')
  returning id, imagen_url into v_art, v_url;
  assert v_url = v_lh3, format('al dar de alta: %s', v_url);
  update articulos set imagen_url = 'https://drive.google.com/open?id=' || v_id where id = v_art returning imagen_url into v_url;
  assert v_url = v_lh3, format('al cambiarla: %s', v_url);

  insert into clientes (nombre) values ('T115 Cliente') returning id into v_cli;
  v_ven := pg_temp.usuario('ven115@hegamex.com', '{ventas}');
  insert into cotizaciones (cliente_id, vendedor_id) values (v_cli, v_ven) returning id into v_cot;
  insert into cotizacion_lineas (cotizacion_id, titulo, precio_unitario, imagen_url)
  values (v_cot, 'Polea', 100, 'https://drive.google.com/file/d/' || v_id || '/view?usp=sharing') returning imagen_url into v_url;
  assert v_url = v_lh3, format('en la partida de la cotización: %s', v_url);

  -- Subir fotos: almacén a artículos; un vendedor solo a cotizaciones; RRHH a nada.
  v_alm := pg_temp.usuario('alm115@hegamex.com', '{almacen}');
  v_rh := pg_temp.usuario('rh115@hegamex.com', '{rrhh}');
  perform pg_temp.como(v_alm);
  insert into storage.objects (bucket_id, name) values ('catalogo', 'articulos/' || v_art || '/foto.jpg');
  perform pg_temp.como(v_ven);
  insert into storage.objects (bucket_id, name) values ('catalogo', 'cotizaciones/' || v_cot || '/foto.jpg');
  begin
    insert into storage.objects (bucket_id, name) values ('catalogo', 'articulos/' || v_art || '/del-vendedor.jpg');
    assert false, 'un vendedor subió la foto de un artículo del catálogo';
  exception when insufficient_privilege then null;
  end;
  perform pg_temp.como(v_rh);
  begin
    insert into storage.objects (bucket_id, name) values ('catalogo', 'cotizaciones/' || v_cot || '/rh.jpg');
    assert false, 'RRHH subió una foto al catálogo';
  exception when insufficient_privilege then null;
  end;
  perform pg_temp.como_postgres();
  assert (select public from storage.buckets where id = 'catalogo'), 'el bucket tiene que ser público para que la foto salga en el PDF';
end $$;

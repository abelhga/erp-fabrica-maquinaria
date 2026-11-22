-- Códigos de barras: el artículo se encuentra por su código o por su clave aunque el lector cambie
-- guiones o mayúsculas; un código es de un solo artículo y no puede ser la clave de otro; los pone
-- y los quita quien edita artículos; y el interruptor nace apagado y solo lo mueve quien debe.
do $$
declare v_alm uuid; v_jefe uuid; v_vend uuid; v_a uuid; v_b uuid; v_ok boolean; r record; v_n int;
begin
  v_alm := pg_temp.usuario('alm308@hegamex.com', '{almacen}');
  v_vend := pg_temp.usuario('vend308@hegamex.com', '{ventas}');
  insert into articulos (clave, tipo, nombre, unidad) values ('T308-BAL', 'componente', 'Balero 308', 'pieza') returning id into v_a;
  insert into articulos (clave, tipo, nombre, unidad) values ('T308-CHU', 'componente', 'Chumacera 308', 'pieza') returning id into v_b;

  assert (select valor from configuracion where clave = 'almacen_lector_codigos') = 'false'::jsonb, 'el lector no nace apagado';

  -- Sin dar de alta nada, la clave ya sirve de código: como venga del lector.
  perform pg_temp.como(v_alm);
  assert (select id from articulo_por_codigo('T308-BAL')) = v_a, 'no encontró por clave';
  assert (select id from articulo_por_codigo('t308''bal')) = v_a, 'no encontró la clave con el guion cambiado por el teclado';
  assert (select count(*) from articulo_por_codigo('T308')) = 0, 'encontró con media clave';
  assert (select count(*) from articulo_por_codigo('--')) = 0, 'encontró con un código vacío';

  -- Almacén le pone el código del fabricante; se encuentra por él, en el buscador sale primero.
  insert into articulo_codigos (articulo_id, codigo) values (v_a, ' 7501234567890 ');
  assert (select codigo from articulo_codigos where articulo_id = v_a) = '7501234567890', 'no quitó los espacios';
  assert (select id from articulo_por_codigo('7501234567890')) = v_a, 'no encontró por código';
  select * into r from buscar_articulos('7501234567890', null, 5) limit 1;
  assert r.id = v_a, 'el buscador no encuentra por código';
  assert (select count(*) from articulo_por_codigo('7501234567890', array['equipo']::tipo_articulo[])) = 0, 'no respetó el tipo';

  -- Un código es de un solo artículo, y no puede ser la clave de otro.
  begin insert into articulo_codigos (articulo_id, codigo) values (v_b, '7501-2345-67890'); v_ok := true; exception when unique_violation then v_ok := false; end;
  assert not v_ok, 'el mismo código quedó en dos artículos';
  begin insert into articulo_codigos (articulo_id, codigo) values (v_b, 't308 bal'); v_ok := true; exception when unique_violation then v_ok := false; end;
  assert not v_ok, 'aceptó como código la clave de otro artículo';
  begin insert into articulo_codigos (articulo_id, codigo) values (v_b, 'A1'); v_ok := true; exception when check_violation then v_ok := false; end;
  assert not v_ok, 'aceptó un código de dos letras';

  -- Ventas los ve (para buscar) pero no los pone ni los quita.
  perform pg_temp.como(v_vend);
  assert (select id from articulo_por_codigo('7501234567890')) = v_a, 'ventas no encuentra por código';
  begin insert into articulo_codigos (articulo_id, codigo) values (v_b, 'VENTAS308'); v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'ventas dio de alta un código';
  delete from articulo_codigos where articulo_id = v_a; get diagnostics v_n = row_count;
  assert v_n = 0, 'ventas quitó un código';
  begin perform fijar_lector_codigos(true); v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'ventas prendió el lector';

  -- Lo prende almacén (administrar) y queda prendido.
  perform pg_temp.como(v_alm);
  perform fijar_lector_codigos(true);
  assert (select valor from configuracion where clave = 'almacen_lector_codigos') = 'true'::jsonb, 'no se prendió';
  delete from articulo_codigos where articulo_id = v_a; get diagnostics v_n = row_count;
  assert v_n = 1, 'almacén no pudo quitar un código';
end $$;

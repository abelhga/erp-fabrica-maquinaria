-- La lista de ajustes dice «recontado» exactamente cuando resolver_ajuste ya no deja aprobar: el
-- artículo se volvió a contar en ese almacén después de pedir el ajuste. Otro almacén, o un conteo
-- anterior, no cuentan.
do $$
declare v_alm uuid; v_ger uuid; v_art uuid; v_c1 int; v_pb int; v_conteo uuid; a1 uuid; a2 uuid; r jsonb; v_ok boolean;
begin
  v_alm := pg_temp.usuario('alm289@hegamex.com', '{almacen}');
  v_ger := pg_temp.usuario('ger289@hegamex.com', '{gerente_produccion}');
  select id into v_c1 from almacenes where nombre = 'Contenedor 1';
  select id into v_pb from almacenes where nombre = 'Planta Baja';
  insert into articulos (clave, tipo, nombre, unidad) values ('M289', 'componente', 'Motorreductor 289', 'pieza') returning id into v_art;
  insert into movimientos_inventario (tipo, articulo_id, almacen_id, cantidad, motivo) values ('inicial', v_art, v_c1, 2, 'T289'), ('inicial', v_art, v_pb, 5, 'T289');

  perform pg_temp.como(v_alm);
  a1 := solicitar_ajuste(v_art, v_c1, 0, 'Conteo 289: no aparecieron');
  a2 := solicitar_ajuste(v_art, v_pb, 4, 'Conteo 289 Planta Baja');
  perform pg_temp.como_postgres();
  update ajustes_inventario set solicitado_en = now() - interval '1 day' where id in (a1, a2);
  assert (select recontado from v_ajustes where id = a1) is null, 'dice recontado sin reconteo';

  -- Se vuelven a contar en Contenedor 1: hay 2.
  perform pg_temp.como(v_alm);
  insert into conteos (nombre, almacen_id) values ('Reconteo 289', v_c1) returning id into v_conteo;
  insert into conteo_lineas (conteo_id, articulo_id, cantidad_contada) values (v_conteo, v_art, 2);
  perform cerrar_conteo(v_conteo);
  r := (select recontado from v_ajustes where id = a1);
  assert r is not null and (r->>'contado')::numeric = 2 and r->>'conteo' = 'Reconteo 289', 'no dice el reconteo: ' || coalesce(r::text, 'nada');
  assert (select recontado from v_ajustes where id = a2) is null, 'el de otro almacén dice recontado';

  -- Lo que dice la lista coincide con lo que hace la base: no se aprueba, se rechaza.
  perform pg_temp.como(v_ger);
  begin perform resolver_ajuste(a1, true); v_ok := true; exception when check_violation then v_ok := false; end;
  assert not v_ok, 'se aprobó un ajuste recontado';
  perform resolver_ajuste(a1, false, 'Recontado: había 2');
  assert (select cantidad from existencias where articulo_id = v_art and almacen_id = v_c1) = 2, 'rechazar movió la existencia';
  assert (select recontado from v_ajustes where id = a1) is null, 'un ajuste resuelto sigue diciendo recontado';
end $$;

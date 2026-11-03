-- «Solicitar cambio a ingeniería»: le crea un pendiente a ingeniería (a nombre de quien lo pidió, con
-- aviso), y al resolverlo se cierra solo y a quien lo pidió le llega «Listo». Si quien lo pide es de
-- ingeniería, no se lo pide a sí mismo.
do $$
declare v_ing uuid; v_alm uuid; v_art uuid; v_s uuid; v_s2 uuid; r record;
begin
  v_ing := pg_temp.usuario('ing232@hegamex.com', '{ingenieria}');
  v_alm := pg_temp.usuario('alm232@hegamex.com', '{almacen}');
  insert into articulos (clave, tipo, nombre) values ('T232-BAN', 'equipo', 'T232 Banda') returning id into v_art;

  -- 1. Almacén reporta un error en la lista: a ingeniería le llega su pendiente con aviso.
  perform pg_temp.como(v_alm);
  insert into solicitudes_cambio_bom (articulo_id, descripcion) values (v_art, 'No lleva tornillo de 3/8 x 1 1/2') returning id into v_s;
  perform pg_temp.como_postgres();
  select * into r from pendientes where tabla = 'solicitudes_cambio_bom' and registro_id = v_s::text and responsable_id = v_ing;
  assert r.id is not null, 'a ingeniería no le llegó el pendiente';
  assert r.creado_por = v_alm and r.estado = 'abierto' and r.vence > hoy_planta() and r.titulo like 'Corregir la lista de T232-BAN%'
     and r.detalle like 'No lleva tornillo%', format('pendiente: %s', row_to_json(r));
  assert exists (select 1 from avisos where usuario_id = v_ing and tipo = 'pendiente_nuevo' and registro_id = r.id::text), 'no le avisaron a ingeniería';

  -- 2. Ingeniería la aplica: su pendiente queda hecho con lo que se hizo y almacén recibe «Listo».
  perform pg_temp.como(v_ing);
  perform responder_solicitud_cambio(v_s, 'aplicada', 'Se quitó de la lista');
  perform pg_temp.como_postgres();
  select * into r from pendientes where id = r.id;
  assert r.estado = 'hecho' and r.nota_cierre = 'Aplicado: Se quitó de la lista' and r.cerrado_por = v_ing, format('al resolver: %s', row_to_json(r));
  assert not exists (select 1 from pendientes where tabla = 'solicitudes_cambio_bom' and registro_id = v_s::text and estado = 'abierto'),
    'quedó abierto el pendiente de otra persona de ingeniería';
  assert exists (select 1 from avisos where usuario_id = v_alm and tipo = 'pendiente_hecho'), 'a quien lo pidió no le llegó el «Listo»';

  -- 3. Ingeniería no se lo pide a sí misma.
  perform pg_temp.como(v_ing);
  insert into solicitudes_cambio_bom (articulo_id, descripcion) values (v_art, 'Revisar el motor') returning id into v_s2;
  perform pg_temp.como_postgres();
  assert not exists (select 1 from pendientes where tabla = 'solicitudes_cambio_bom' and registro_id = v_s2::text and responsable_id = v_ing),
    'ingeniería se pidió a sí misma un pendiente';
end $$;

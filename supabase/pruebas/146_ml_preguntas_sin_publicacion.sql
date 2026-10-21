-- Una pregunta de una publicación pausada o cerrada no sale por contestar (ML no deja);
-- si la publicación vuelve a activarse, regresa. Solo la conexión con ML la marca.
do $$
declare v_vend uuid; v_ok boolean;
begin
  v_vend := pg_temp.usuario('vend146@hegamex.com', '{ventas}');
  perform ml_registrar_pregunta('{"id": 9146001, "item_id": "MLM146", "titulo": "Polea", "texto": "¿Hay?", "estado": "UNANSWERED", "fecha": "2026-05-16T10:00:00Z", "item_activo": false}');
  assert (select estado from ml_preguntas where id = 9146001) = 'sin_publicacion', 'publicación pausada: fuera de pendientes';
  perform ml_registrar_pregunta('{"id": 9146001, "item_id": "MLM146", "estado": "UNANSWERED", "item_activo": true}');
  assert (select estado from ml_preguntas where id = 9146001) = 'pendiente', 'reactivada: vuelve a pendiente';
  perform ml_registrar_pregunta('{"id": 9146002, "item_id": "MLM146", "texto": "¿Precio?", "estado": "UNANSWERED"}');
  assert (select estado from ml_preguntas where id = 9146002) = 'pendiente', 'sin dato de la publicación sigue pendiente';
  perform ml_pregunta_sin_publicacion(9146002);
  assert (select estado from ml_preguntas where id = 9146002) = 'sin_publicacion', 'al fallar la respuesta se quita';
  perform pg_temp.como(v_vend);
  begin perform ml_pregunta_sin_publicacion(9146001); v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'ventas no la marca a mano';
end $$;

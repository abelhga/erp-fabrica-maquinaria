-- Preguntar en un pendiente: solo quien lo tiene y quien lo pidió escriben; la pregunta lo deja
-- «esperando respuesta» (no cuenta como retraso de quien lo tiene) hasta que contestan.
do $$
declare v_a uuid; v_b uuid; v_c uuid; v_rh uuid; v_p uuid; v_ok boolean; r record;
begin
  v_a := pg_temp.usuario('a185@hegamex.com', '{ventas}');
  v_b := pg_temp.usuario('b185@hegamex.com', '{compras}');
  v_c := pg_temp.usuario('c185@hegamex.com', '{almacen}');
  v_rh := pg_temp.usuario('rh185@hegamex.com', '{rrhh}');
  perform pg_temp.como(v_a);
  insert into pendientes (titulo, responsable_id, creado_por, vence) values ('Precio de la chumacera 185', v_b, v_a, hoy_mx() - 2) returning id into v_p;

  -- B pregunta: queda esperando respuesta de A, a A le avisan, y a B ya no le cuenta el retraso.
  perform pg_temp.como(v_b);
  select * into r from mi_cumplimiento_pendientes();
  assert r.vencidos = 1 and r.dias_retraso = 2, format('antes de preguntar: %s', row_to_json(r));
  perform comentar_pendiente(v_p, '¿De qué medida? ¿1" o 1 1/4"?');
  perform pg_temp.como_postgres();
  assert (select esperando_respuesta from pendientes where id = v_p), 'la pregunta no lo dejó esperando respuesta';
  assert exists (select 1 from avisos where usuario_id = v_a and tipo = 'pendiente_pregunta'), 'a quien lo pidió no le avisaron de la pregunta';
  perform pg_temp.como(v_b);
  select * into r from mi_cumplimiento_pendientes();
  assert r.vencidos = 0 and r.dias_retraso = 0, format('esperando respuesta siguió contando como retraso: %s', row_to_json(r));
  perform pg_temp.como(v_a);
  select * into r from mi_cumplimiento_pendientes();
  assert r.por_responder = 1, format('a quien lo pidió no le cuenta por responder: %s', row_to_json(r));

  -- B no se puede quitar el retraso a mano; C (ajeno) no escribe; RH lee la conversación.
  perform pg_temp.como(v_b);
  begin update pendientes set esperando_respuesta = true where id = v_p; v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  -- (ya estaba en true: probar el cambio contrario)
  begin update pendientes set esperando_respuesta = false where id = v_p; v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'se cambió «esperando respuesta» a mano';
  perform pg_temp.como(v_c);
  begin perform comentar_pendiente(v_p, 'Me meto'); v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'alguien ajeno escribió en el pendiente';
  perform pg_temp.como(v_rh);
  assert (select count(*) from pendiente_mensajes where pendiente_id = v_p) = 1, 'RH no ve la conversación';

  -- A contesta: deja de esperar, a B le avisan y el retraso vuelve a contar.
  perform pg_temp.como(v_a);
  perform comentar_pendiente(v_p, 'De 1 1/4"');
  perform pg_temp.como_postgres();
  assert not (select esperando_respuesta from pendientes where id = v_p), 'la respuesta no quitó la espera';
  assert exists (select 1 from avisos where usuario_id = v_b and tipo = 'pendiente_respuesta'), 'a quien lo tiene no le avisaron la respuesta';
  begin delete from pendiente_mensajes where pendiente_id = v_p; v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'se borró la conversación';

  -- Cerrado, ya no se escribe.
  perform pg_temp.como(v_b);
  update pendientes set estado = 'hecho' where id = v_p;
  begin perform comentar_pendiente(v_p, 'Una más'); v_ok := true; exception when raise_exception then v_ok := false; end;
  assert not v_ok, 'se escribió en un pendiente cerrado';
  perform pg_temp.como_postgres();
end $$;

-- Embarques: no se cierra con dinero por recuperar (lo dice cuánto y de quién), una etapa registrada
-- por error se quita con su motivo y queda la nota, y almacén no quita etapas.
do $$
declare v_imp uuid; v_alm uuid; v_emb uuid; v_ok boolean; v_msg text; v_hoy date := (now() at time zone 'America/Mexico_City')::date;
begin
  v_imp := pg_temp.usuario('imp242@hegamex.com', '{importaciones}');
  v_alm := pg_temp.usuario('alm242@hegamex.com', '{almacen}');
  perform pg_temp.como(v_imp);
  insert into embarques (descripcion, modalidad) values ('T242 colectores', 'fcl') returning id into v_emb;
  insert into embarque_saldos (embarque_id, tipo, deudor, monto, fecha_esperada) values (v_emb, 'saldo_agente', 'Careaga 242', 32269.68, v_hoy - 8);
  perform registrar_evento_importacion(v_emb, 'cuenta_gastos', v_hoy - 5);

  -- 1. Con el saldo pendiente no se cierra, y el aviso dice cuánto y de quién.
  begin perform registrar_evento_importacion(v_emb, 'cierre', v_hoy); v_ok := true;
  exception when check_violation then v_ok := false; v_msg := sqlerrm; end;
  assert not v_ok and v_msg like '%saldo a favor de MXN 32,269.68 (Careaga 242)%', format('cerró con saldo pendiente: %s', v_msg);
  --    Marcado como recuperado, sí.
  update embarque_saldos set recuperado_en = v_hoy where embarque_id = v_emb;
  perform registrar_evento_importacion(v_emb, 'cierre', v_hoy);

  -- 2. La cuenta de gastos no se quita mientras esté cerrado; «Cerrado» sí, con motivo, y queda la nota.
  begin perform quitar_evento_importacion(v_emb, 'cuenta_gastos', 'Error'); v_ok := true; exception when others then v_ok := false; end;
  assert not v_ok, 'quitó la cuenta de gastos de un embarque cerrado';
  begin perform quitar_evento_importacion(v_emb, 'cierre', ''); v_ok := true; exception when others then v_ok := false; end;
  assert not v_ok, 'quitó una etapa sin motivo';
  perform quitar_evento_importacion(v_emb, 'cierre', 'Me equivoqué de embarque');
  assert not exists (select 1 from embarque_eventos where embarque_id = v_emb and tipo = 'cierre'), 'no quitó el cierre';
  assert exists (select 1 from embarque_eventos where embarque_id = v_emb and tipo = 'nota' and detalle like 'Se quitó la etapa «Cerrado» (tenía fecha %): Me equivoqué de embarque'),
    format('nota: %s', (select string_agg(detalle, ' | ') from embarque_eventos where embarque_id = v_emb and tipo = 'nota'));

  -- 3. Almacén ve el embarque pero no quita etapas.
  perform pg_temp.como(v_alm);
  begin perform quitar_evento_importacion(v_emb, 'cuenta_gastos', 'No va'); v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'almacén quitó una etapa';
  perform pg_temp.como_postgres();
end $$;

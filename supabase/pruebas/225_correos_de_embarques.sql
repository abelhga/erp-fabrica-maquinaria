-- Correos de los embarques: los ve quien ve el dinero de importaciones (almacén y ventas no); la
-- propuesta de la IA solo se guarda y se aplica por importaciones; aplicar pasa por las reglas de
-- siempre (fechas reales, cambio de ETA anotado, documentos que no bajan de estado) y se aplica
-- una sola vez; si algo no pasa, no se aplica nada.
do $$
declare
  v_imp uuid; v_alm uuid; v_ven uuid; v_emb uuid; v_hilo uuid; v_p1 uuid; v_p2 uuid; r jsonb; n int;
begin
  v_imp := pg_temp.usuario('imp225@hegamex.com', '{importaciones}');
  v_alm := pg_temp.usuario('alm225@hegamex.com', '{almacen}');
  v_ven := pg_temp.usuario('ven225@hegamex.com', '{ventas}');

  insert into embarques (descripcion, modalidad, eta) values ('Prueba 225 cosedoras', 'fcl', '2031-03-20') returning id into v_emb;
  insert into embarque_hilos (embarque_id, usuario_id, cuenta, gmail_hilo, asunto, mensajes)
  values (v_emb, v_imp, 'alondra@hegamex.com', 'hilo-225', 'Booking MEHE 225', 2) returning id into v_hilo;
  insert into embarque_correos (hilo_id, gmail_id, enviado_en, de, asunto, texto) values
    (v_hilo, 'm1', now() - interval '3 days', 'forwarder@x.com', 'Booking MEHE 225', 'The vessel sailed on Oct 20. BL attached. Freight USD 1,850.'),
    (v_hilo, 'm2', now() - interval '1 day', 'agente@x.mx', 'RE: Booking MEHE 225', 'Recibimos BL. Favor de mandar carta 3.1.8.');

  -- 1. Quién ve los correos.
  perform pg_temp.como(v_imp);
  assert (select count(*) from embarque_correos c join embarque_hilos h on h.id = c.hilo_id where h.embarque_id = v_emb) = 2, 'importaciones no ve los correos';
  perform pg_temp.como(v_alm);
  assert (select count(*) from embarque_hilos where embarque_id = v_emb) = 0, 'almacén ve los hilos (traen montos)';
  assert (select count(*) from embarque_correos where hilo_id = v_hilo) = 0, 'almacén ve los correos';
  perform pg_temp.como(v_ven);
  assert (select count(*) from embarque_correos where hilo_id = v_hilo) = 0, 'ventas ve los correos';

  -- 2. Solo importaciones guarda una propuesta; la anterior sin resolver se descarta.
  perform pg_temp.como(v_alm);
  begin
    perform guardar_propuesta_embarque(v_emb, '{"resumen": "x"}', 2, now(), 'prueba');
    assert false, 'almacén guardó una propuesta';
  exception when insufficient_privilege then null;
  end;
  perform pg_temp.como(v_imp);
  v_p1 := guardar_propuesta_embarque(v_emb, '{"resumen": "primera"}', 2, now(), 'prueba');
  v_p2 := guardar_propuesta_embarque(v_emb, '{"resumen": "Zarpó el 20 de oct; llegó el BL."}', 2, now(), 'prueba');
  assert (select estado from embarque_propuestas where id = v_p1) = 'descartada', 'la propuesta vieja sigue vigente';

  -- 3. Si algo no pasa (una fecha futura de etapa), no se aplica nada.
  begin
    perform aplicar_propuesta_embarque(v_p2, jsonb_build_object('campos', jsonb_build_object('bl', 'MEHE225'),
      'eventos', jsonb_build_array(jsonb_build_object('tipo', 'arribo', 'fecha', current_date + 5))));
    assert false, 'se aplicó una etapa con fecha futura';
  exception when check_violation then null;
  end;
  assert (select bl from embarques where id = v_emb) is null, 'quedó aplicado a medias';
  assert (select estado from embarque_propuestas where id = v_p2) = 'nueva', 'la propuesta se resolvió sin aplicarse';
  begin
    perform aplicar_propuesta_embarque(v_p2, '{"campos": {"notas": "x"}}');
    assert false, 'se cambió un dato que no viene de los correos';
  exception when raise_exception then null;
  end;

  -- 4. Aplicar: etapa, datos y documento; el cambio de ETA queda anotado.
  r := aplicar_propuesta_embarque(v_p2, jsonb_build_object(
    'eventos', jsonb_build_array(jsonb_build_object('tipo', 'zarpe', 'fecha', current_date - 10, 'detalle', 'Según el correo del forwarder')),
    'campos', jsonb_build_object('bl', 'MEHE225', 'buque', 'COSCO SHIPPING', 'eta', '2031-03-27'),
    'documentos', jsonb_build_array(jsonb_build_object('tipo', 'bl', 'fecha', current_date - 1), jsonb_build_object('tipo', 'no_existe'))));
  assert r = '{"eventos": 1, "campos": 3, "documentos": 1}'::jsonb, format('aplicado: %s', r);
  assert (select bl || ' / ' || buque || ' / ' || eta from embarques where id = v_emb) = 'MEHE225 / COSCO SHIPPING / 2031-03-27', 'no cambió el embarque';
  assert exists (select 1 from embarque_eventos where embarque_id = v_emb and tipo = 'zarpe' and fecha = current_date - 10), 'no quedó la etapa';
  assert exists (select 1 from embarque_eventos where embarque_id = v_emb and tipo = 'cambio_eta'), 'el cambio de ETA no quedó anotado';
  assert (select estado || ' ' || recibido_en from embarque_documentos where embarque_id = v_emb and tipo = 'bl') = 'recibido ' || (current_date - 1), 'el BL no quedó recibido';
  assert (select estado from embarque_propuestas where id = v_p2) = 'aplicada', 'la propuesta no quedó aplicada';
  -- 5. Una sola vez.
  begin
    perform aplicar_propuesta_embarque(v_p2, '{"campos": {"bl": "OTRO"}}');
    assert false, 'se aplicó dos veces';
  exception when check_violation then null;
  end;

  -- 6. Quitar un hilo borra sus correos guardados; almacén no puede.
  perform pg_temp.como(v_alm);
  begin
    perform desligar_hilo_embarque(v_hilo);
    assert false, 'almacén quitó un hilo';
  exception when insufficient_privilege then null;
  end;
  perform pg_temp.como(v_imp);
  perform desligar_hilo_embarque(v_hilo);
  perform pg_temp.como_postgres();
  select count(*) into n from embarque_correos where hilo_id = v_hilo;
  assert n = 0, 'quedaron correos de un hilo quitado';
end $$;

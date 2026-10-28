-- Retirar una foto de evidencia no la borra: queda con su motivo, deja de contar, sale en la
-- historia, y una vez que la caja salió solo la gerencia puede retirarla (ENV-2026-00010).
do $$
declare v_cli uuid; v_ped uuid; v_alm uuid; v_vend uuid; v_dir uuid; v_env uuid; v_mala uuid; v_buena uuid; v_nueva uuid; v_ok boolean; r record;
begin
  v_alm := pg_temp.usuario('alm183@hegamex.com', '{almacen}');
  v_vend := pg_temp.usuario('vend183@hegamex.com', '{ventas}');
  v_dir := pg_temp.usuario('dir183@hegamex.com', '{direccion}');
  insert into clientes (nombre, vendedor_id) values ('Cliente 183', v_vend) returning id into v_cli;
  insert into pedidos (cliente_id, vendedor_id, canal) values (v_cli, v_vend, 'mercadolibre') returning id into v_ped;
  insert into envios (tipo, pedido_id) values ('paqueteria', v_ped) returning id into v_env;
  insert into evidencias_envio (envio_id, tipo, ruta) values (v_env, 'empaque', 'envios/' || v_env || '/mala.jpg') returning id into v_mala;
  insert into evidencias_envio (envio_id, tipo, ruta) values (v_env, 'empaque', 'envios/' || v_env || '/buena.jpg') returning id into v_buena;

  -- Ventas no retira fotos (no las toma); sin motivo, nadie.
  perform pg_temp.como(v_vend);
  begin perform retirar_evidencia(v_mala, 'Era de otro paquete'); v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'ventas retiró una foto de empaque';
  perform pg_temp.como(v_alm);
  begin perform retirar_evidencia(v_mala, 'no'); v_ok := true; exception when raise_exception then v_ok := false; end;
  assert not v_ok, 'se retiró una foto sin motivo';

  -- Almacén la retira: la foto sigue ahí, marcada, sin contar, y la historia lo dice.
  perform retirar_evidencia(v_mala, 'Era de otro paquete');
  select * into r from v_evidencias_envio where id = v_mala;
  assert r.retirada and r.motivo_retiro = 'Era de otro paquete' and r.ruta like '%mala.jpg', format('la foto no quedó retirada: %s', row_to_json(r));
  assert (select fotos from v_envios where id = v_env) = 1, 'la foto retirada siguió contando';
  assert exists (select 1 from v_eventos_envio where envio_id = v_env and tipo = 'foto_retirada' and nota like '%Era de otro paquete'),
    'la historia no dice que se retiró';
  begin perform retirar_evidencia(v_mala, 'Otra vez la misma'); v_ok := true; exception when raise_exception then v_ok := false; end;
  assert not v_ok, 'se retiró dos veces la misma foto';

  -- Lo retirado no se borra ni se deshace.
  perform pg_temp.como_postgres();
  begin delete from evidencias_retiradas where evidencia_id = v_mala; v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'se borró un retiro';
  begin delete from evidencias_envio where id = v_mala; v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'se borró la foto retirada';

  -- Ya empacado no se queda sin foto: primero la correcta (se puede subir mientras no salga).
  update envios set empacado_en = now(), empacado_por = v_alm, estado = 'empacado' where id = v_env;
  perform pg_temp.como(v_alm);
  begin perform retirar_evidencia(v_buena, 'Tampoco era esta'); v_ok := true; exception when raise_exception then v_ok := false; end;
  assert not v_ok, 'un envío empacado se quedó sin fotos de empaque';
  perform pg_temp.como_postgres();
  insert into storage.objects (bucket_id, name) values ('envios', 'envios/' || v_env || '/correcta.jpg');
  perform pg_temp.como(v_alm);
  v_nueva := agregar_archivo_envio('envios/' || v_env || '/correcta.jpg', 'empaque', v_env);
  assert exists (select 1 from v_eventos_envio where envio_id = v_env and tipo = 'foto_agregada'), 'no se anotó la foto agregada después de empacar';
  perform retirar_evidencia(v_buena, 'Tampoco era esta');
  assert (select fotos from v_envios where id = v_env) = 1, 'no quedó solo la foto correcta';

  -- Ya salió: almacén ya no retira ni agrega; la gerencia sí retira, con motivo.
  perform pg_temp.como_postgres();
  insert into evidencias_envio (envio_id, tipo, ruta) values (v_env, 'empaque', 'envios/' || v_env || '/extra.jpg') returning id into v_buena;
  update envios set enviado_en = now(), estado = 'enviado' where id = v_env;
  insert into storage.objects (bucket_id, name) values ('envios', 'envios/' || v_env || '/tarde.jpg');
  perform pg_temp.como(v_alm);
  begin perform retirar_evidencia(v_buena, 'La quito ya en camino'); v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'almacén retiró una foto de un envío que ya salió';
  begin perform agregar_archivo_envio('envios/' || v_env || '/tarde.jpg', 'empaque', v_env); v_ok := true; exception when raise_exception then v_ok := false; end;
  assert not v_ok, 'se agregó una foto de empaque a un envío que ya salió';
  perform pg_temp.como(v_dir);
  perform retirar_evidencia(v_buena, 'Duplicada por error');
  assert (select count(*) from evidencias_envio where envio_id = v_env) = 4, 'alguna foto se borró';
  perform pg_temp.como_postgres();
end $$;

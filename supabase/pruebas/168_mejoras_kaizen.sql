-- Mejoras (kaizen): el piso propone (también desde la terminal, con el nombre de quien tuvo la
-- idea), un problema del piso se vuelve una sola mejora, quien decide la pone en marcha con
-- responsable y fecha, el responsable la trabaja y la marca hecha, y quien la propuso se entera.
-- Ventas no ve ni propone; nadie escribe la tabla directo.
do $$
declare v_ger uuid; v_ing uuid; v_tab uuid; v_sup uuid; v_ven uuid; v_eq uuid; o uuid; x uuid; v_pai int; v_ev bigint;
  v_id uuid; v_id2 uuid; v_ok boolean; v_err text; v_maq uuid; v_falla uuid;
begin
  v_ger := pg_temp.usuario('ger168@hegamex.com', '{gerente_produccion}');
  v_ing := pg_temp.usuario('ing168@hegamex.com', '{ingenieria_procesos}');
  v_tab := pg_temp.usuario('tablet168@hegamex.com', '{produccion}');
  v_sup := pg_temp.usuario('sup168@hegamex.com', '{produccion}');
  v_ven := pg_temp.usuario('ven168@hegamex.com', '{ventas}');
  select id into v_pai from etapas where nombre = 'Pailería';
  insert into articulos (clave, tipo, nombre) values ('T168-EQ', 'equipo', 'Elevador 168') returning id into v_eq;
  insert into ordenes_produccion (articulo_id, cantidad, estado) values (v_eq, 1, 'en_proceso') returning id into o;
  insert into op_operaciones (orden_id, etapa_id, horas_estimadas, estado, inicio) values (o, v_pai, 40, 'en_proceso', now()) returning id into x;
  insert into op_eventos (orden_id, operacion_id, tipo, nota) values (o, x, 'problema', 'Falta la plantilla para barrenar la placa') returning id into v_ev;
  insert into maquinas (numero, nombre, categoria, etapa_id) values ('M-168', 'Plasma 168', 'Corte', v_pai) returning id into v_maq;
  insert into ordenes_mantenimiento (maquina_id, tipo, falla, detiene) values (v_maq, 'correctivo', 'Se cae la antorcha', true) returning id into v_falla;

  -- Ventas no ve ni propone.
  perform pg_temp.como(v_ven);
  begin perform proponer_mejora('Idea de ventas'); v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'ventas propuso una mejora';

  -- Desde la tablet del piso: la idea queda con el nombre de quien la tuvo, y le llega a quien decide.
  perform pg_temp.como(v_tab);
  v_id := proponer_mejora('Carrito para mover las placas', 'Se cargan a mano entre dos', p_etapa => v_pai, p_quien => 'Genaro');
  assert (select propuso from v_mejoras where id = v_id) = 'Genaro', 'no quedó quién la propuso';
  assert (select estado from mejoras where id = v_id) = 'propuesta', 'no quedó en propuesta';
  perform pg_temp.como_postgres();
  assert exists (select 1 from avisos where usuario_id = v_ger and tipo = 'mejora_nueva' and registro_id = v_id::text), 'la gerencia no se enteró de la idea';
  perform pg_temp.como(v_tab);
  -- Nadie escribe la tabla directo.
  begin insert into mejoras (titulo) values ('Por la puerta de atrás'); v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'se insertó una mejora sin la función';

  -- Lo del piso sin mejora: el problema y la falla de la máquina, hasta que se convierten.
  assert exists (select 1 from problemas_sin_mejora() where evento_id = v_ev), 'el problema no salió en la lista';
  assert exists (select 1 from problemas_sin_mejora() where mantenimiento_id = v_falla), 'la falla no salió en la lista';
  v_id2 := proponer_mejora('Plantilla de barrenado para la placa', p_evento => v_ev);
  assert (select etapa_id from mejoras where id = v_id2) = v_pai, 'no tomó el área de la etapa donde pasó';
  assert not exists (select 1 from problemas_sin_mejora() where evento_id = v_ev), 'el problema siguió en la lista';
  begin perform proponer_mejora('Otra vez lo mismo', p_evento => v_ev); v_ok := true; exception when raise_exception then v_ok := false; end;
  assert not v_ok, 'un problema dio dos mejoras';
  perform proponer_mejora('Revisar la antorcha cada semana', p_mantenimiento => v_falla);
  assert (select etapa_id from mejoras where mantenimiento_id = v_falla) = v_pai, 'no tomó el área de la máquina';

  -- Quien la propuso la corrige mientras está en propuesta, pero no le pone responsable.
  perform editar_mejora(v_id, '{"propuesta": "Un carrito con rodajas de 6 pulgadas", "desperdicio": "movimiento"}');
  assert (select desperdicio from mejoras where id = v_id) = 'movimiento', 'el autor no pudo corregir su idea';
  begin perform editar_mejora(v_id, jsonb_build_object('responsable_id', v_sup)); v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'el autor se asignó responsable';
  -- Otro supervisor no la toca ni la mueve.
  perform pg_temp.como(v_sup);
  begin perform editar_mejora(v_id, '{"titulo": "Cambiada por otro"}'); v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'otro supervisor editó la idea';
  begin perform mover_mejora(v_id, 'en_marcha'); v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'un supervisor puso en marcha una mejora';

  -- Ingeniería de procesos decide: sin responsable ni fecha no arranca.
  perform pg_temp.como(v_ing);
  begin perform mover_mejora(v_id, 'en_marcha'); v_ok := true; exception when raise_exception then v_ok := false; get stacked diagnostics v_err = message_text; end;
  assert not v_ok and v_err like '%quién la lleva%', 'arrancó sin responsable: ' || coalesce(v_err, '');
  begin perform editar_mejora(v_id, jsonb_build_object('responsable_id', v_ven)); v_ok := true; exception when raise_exception then v_ok := false; end;
  assert not v_ok, 'un vendedor quedó de responsable';
  perform editar_mejora(v_id, jsonb_build_object('responsable_id', v_sup, 'fecha_compromiso', current_date + 7, 'tipo', 'a3'));
  perform pg_temp.como_postgres();
  assert exists (select 1 from avisos where usuario_id = v_sup and tipo = 'mejora_responsable' and registro_id = v_id::text), 'el responsable no se enteró';
  perform pg_temp.como(v_ing);
  perform mover_mejora(v_id, 'en_marcha');
  perform pg_temp.como_postgres();
  assert exists (select 1 from avisos where usuario_id = v_tab and tipo = 'mejora_estado' and titulo like '%en marcha%'), 'quien la propuso no se enteró';

  -- El responsable llena el A3 y el resultado; sin resultado no se marca hecha.
  perform pg_temp.como(v_sup);
  begin perform mover_mejora(v_id, 'hecha'); v_ok := true; exception when raise_exception then v_ok := false; end;
  assert not v_ok, 'se marcó hecha sin resultado';
  perform editar_mejora(v_id, '{"causa_raiz": "No hay con qué mover la placa", "plan": "Comprar rodajas y soldar el carrito", "resultado": "Ahora la mueve uno solo", "ahorro_horas_mes": 6}');
  begin perform editar_mejora(v_id, jsonb_build_object('fecha_compromiso', current_date + 30)); v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'el responsable se movió la fecha';
  begin perform editar_mejora(v_id, '{"foto_despues": "otra-mejora/foto.jpg"}'); v_ok := true; exception when raise_exception then v_ok := false; end;
  assert not v_ok, 'aceptó una foto de otra carpeta';
  perform mover_mejora(v_id, 'hecha');
  assert (select estado = 'hecha' and hecha_en is not null from mejoras where id = v_id), 'no quedó hecha';
  perform pg_temp.como_postgres();
  assert exists (select 1 from avisos where usuario_id = v_tab and tipo = 'mejora_estado' and titulo like '%ya se hizo%'), 'no avisó que se hizo';

  -- Descartar pide motivo y se lo dice a quien la propuso.
  perform pg_temp.como(v_ger);
  begin perform mover_mejora(v_id2, 'descartada'); v_ok := true; exception when raise_exception then v_ok := false; end;
  assert not v_ok, 'se descartó sin motivo';
  perform mover_mejora(v_id2, 'descartada', 'Ya hay una plantilla en el almacén');
  assert (select motivo_descarte from mejoras where id = v_id2) = 'Ya hay una plantilla en el almacén', 'no guardó el motivo';

  -- Ventas no ve ninguna.
  perform pg_temp.como(v_ven);
  assert (select count(*) from v_mejoras where id in (v_id, v_id2)) = 0, 'ventas vio mejoras';

  -- Fotos: el piso sube a la carpeta de una mejora que existe; ventas no, y a una carpeta inventada tampoco.
  perform pg_temp.como(v_tab);
  insert into storage.objects (bucket_id, name) values ('mejoras', v_id || '/antes-1.jpg');
  begin insert into storage.objects (bucket_id, name) values ('mejoras', gen_random_uuid() || '/x.jpg'); v_ok := true;
  exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'subió una foto a una mejora que no existe';
  perform pg_temp.como(v_ven);
  begin insert into storage.objects (bucket_id, name) values ('mejoras', v_id || '/de-ventas.jpg'); v_ok := true;
  exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'ventas subió una foto de mejora';
  assert not exists (select 1 from storage.objects where bucket_id = 'mejoras' and name like v_id || '/%'), 'ventas vio las fotos';
  perform pg_temp.como_postgres();
end $$;

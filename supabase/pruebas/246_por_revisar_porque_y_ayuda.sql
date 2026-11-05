-- «Está bien así» exige porqué y, con el interruptor prendido, la IA lo cuestiona (3 preguntas a lo
-- más; luego se escala a dirección). La decisión de la IA solo la escribe la llave de servicio.
-- «Ayúdame a corregirlo» solo cambia campos de captura del registro del hallazgo y se aplica con
-- los permisos de quien acepta.
do $$
declare v_ven uuid; v_ven2 uuid; v_dir uuid; v_cli uuid; v_cot uuid; v_lin uuid; v_cot2 uuid; h1 uuid; h2 uuid; h3 uuid; h4 uuid;
  r jsonb; v_ok boolean; v_msg text; v_prop uuid; i int;
begin
  update configuracion set valor = valor || '{"cuestionar_bien_asi": true}' where clave = 'revision_nocturna';
  v_ven := pg_temp.usuario('ven246@hegamex.com', '{ventas}');
  v_ven2 := pg_temp.usuario('otro246@hegamex.com', '{ventas}');
  v_dir := pg_temp.usuario('dir246@hegamex.com', '{direccion}');

  insert into clientes (nombre, vendedor_id) values ('Cliente 246', v_ven) returning id into v_cli;
  insert into contactos (cliente_id, nombre) values (v_cli, 'Ana 246');
  insert into cotizaciones (cliente_id, vendedor_id, tiempo_entrega) values (v_cli, v_ven, 'x') returning id into v_cot;
  insert into cotizacion_lineas (cotizacion_id, titulo, cantidad, precio_unitario) values (v_cot, 'Polea 246', 1, 1000) returning id into v_lin;
  update cotizaciones set estado = 'enviada' where id = v_cot;
  update cotizaciones set tiempo_entrega = null where id = v_cot;   -- como las que se mandaron antes de que fuera obligatorio
  insert into cotizaciones (cliente_id, vendedor_id) values (v_cli, v_ven) returning id into v_cot2;

  insert into revision_hallazgos (origen, modulo, tabla, registro_id, titulo, detalle, para, responsables, huella)
  values ('claude', 'ventas', 'cotizaciones', v_cot::text, 'Cotización 246 enviada sin tiempo de entrega', 'No dice cuándo se entrega.',
          'responsable', array[v_ven], 'p246-1') returning id into h1;
  insert into revision_hallazgos (origen, modulo, tabla, registro_id, titulo, detalle, para, responsables, huella)
  values ('claude', 'ventas', 'clientes', v_cli::text, 'Cliente 246 parece repetido', 'Mismo nombre.', 'responsable', array[v_ven], 'p246-2')
  returning id into h2;
  insert into revision_hallazgos (origen, modulo, tabla, registro_id, titulo, detalle, para, responsables, huella)
  values ('claude', 'ventas', 'cotizaciones', v_cot::text, 'Otra de la 246', 'Algo.', 'responsable', array[v_ven], 'p246-3') returning id into h3;
  insert into revision_hallazgos (origen, modulo, tabla, registro_id, titulo, detalle, para, responsables, huella)
  values ('claude', 'ventas', 'cotizaciones', v_cot::text, 'Partida 246', 'La cantidad parece mal.', 'responsable', array[v_ven], 'p246-4')
  returning id into h4;

  -- 1. Sin porqué no se cierra; con el interruptor prendido, tampoco directo.
  perform pg_temp.como(v_ven);
  begin perform revision_bien_asi(h1, 'ok'); v_ok := true; exception when check_violation then v_ok := false; end;
  assert not v_ok, 'aceptó «Está bien así» sin porqué';
  begin perform revision_responder(h1, 'bien_asi', 'El cliente está decidiendo el equipo'); v_ok := true;
  exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'se saltó a la IA contestando directo';
  r := revision_bien_asi(h1, 'El cliente está decidiendo el equipo');
  assert r->>'estado' = 'revisar', format('bien_asi: %s', r);
  begin perform revision_bien_asi(h1, 'otra cosa más'); v_ok := true; exception when others then v_ok := false; end;
  assert not v_ok, 'escribió dos turnos sin que contestara la IA';
  assert revision_bien_asi(h1, '')->>'estado' = 'revisar', 'el reintento no regresó «revisar»';
  r := revision_dialogo_contexto(h1);
  assert r->'hallazgo'->>'titulo' like 'Cotización 246%' and (r->>'preguntas')::int = 0, format('contexto: %s', r);

  -- 2. La pantalla no puede escribir la decisión de la IA.
  begin perform revision_dialogo_ia(h1, v_ven, 'Va', 'acepta'); v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'la persona escribió el veredicto de la IA';
  perform pg_temp.como(v_ven2);
  begin perform revision_bien_asi(h1, 'Porque yo digo que sí'); v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'otro vendedor contestó un hallazgo ajeno';

  -- 3. Tres preguntas; la cuarta ya no se hace: se escala a dirección y se queda abierto.
  for i in 1..4 loop
    perform pg_temp.como_postgres();
    set local role service_role;
    r := revision_dialogo_ia(h1, v_ven, format('Pregunta %s', i), 'pregunta');
    reset role;
    if i < 4 then
      assert r->>'veredicto' = 'pregunta', format('vuelta %s: %s', i, r);
      perform pg_temp.como(v_ven);
      perform revision_bien_asi(h1, format('Respuesta %s', i));
    end if;
  end loop;
  assert r->>'veredicto' = 'no_convence', format('la cuarta pregunta no escaló: %s', r);
  assert (select estado = 'abierto' and escalado_en is not null from revision_hallazgos where id = h1), 'no quedó abierto y escalado';
  assert exists (select 1 from avisos where usuario_id = v_dir and registro_id = h1::text), 'a dirección no le llegó';
  perform pg_temp.como(v_ven);
  assert (select count(*) from revision_dialogos where hallazgo_id = h1) = 8, 'la persona no ve su conversación';
  begin perform revision_bien_asi(h1, 'Ahora sí te explico bien'); v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'siguió contestando algo que ya ve dirección';
  perform pg_temp.como(v_dir);
  assert (select count(*) from revision_dialogos where hallazgo_id = h1) = 8, 'dirección no ve la conversación';
  perform revision_responder(h1, 'bien_asi', 'Lo hablé con él: se queda así');
  assert (select estado from revision_hallazgos where id = h1) = 'bien_asi', 'dirección no pudo cerrarlo';

  -- 4. Si la IA acepta, se cierra a nombre de la persona con su porqué.
  perform pg_temp.como(v_ven);
  perform revision_bien_asi(h2, 'Son dos sucursales con distinto RFC');
  perform pg_temp.como_postgres();
  set local role service_role;
  r := revision_dialogo_ia(h2, v_ven, 'Tiene sentido', 'acepta');
  reset role;
  assert (select estado = 'bien_asi' and cerrado_por = v_ven and respuesta = 'Son dos sucursales con distinto RFC' from revision_hallazgos where id = h2),
    'no se cerró con el porqué de la persona';

  -- 5. Con el interruptor apagado, el porqué basta.
  update configuracion set valor = valor || '{"cuestionar_bien_asi": false}' where clave = 'revision_nocturna';
  perform pg_temp.como(v_ven);
  assert revision_bien_asi(h3, 'Ya lo platiqué con el cliente')->>'estado' = 'cerrado', 'apagado no cerró directo';

  -- 6. «Ayúdame a corregirlo»: el contexto trae solo campos de captura, leído con sus permisos.
  r := revision_ayuda_contexto(h4);
  assert r->'registro'->'valores' ? 'tiempo_entrega' and not (r->'registro'->'valores' ? 'total'), format('valores: %s', r->'registro');
  assert r->'partidas'->0->'filas'->0->>'titulo' = 'Polea 246', format('partidas: %s', r->'partidas');
  assert r->'opciones'->'contacto_id'->0->>'nombre' = 'Ana 246', format('opciones: %s', r->'opciones');
  perform pg_temp.como(v_ven2);
  begin perform revision_ayuda_contexto(h4); v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'otro vendedor pidió ayuda con un hallazgo ajeno';

  -- 7. De lo que proponga la IA solo queda lo permitido, del registro del hallazgo y con el tipo correcto.
  perform pg_temp.como_postgres();
  set local role service_role;
  r := revision_propuesta_guardar(h4, v_ven, jsonb_build_array(
    jsonb_build_object('tabla', 'cotizaciones', 'id', v_cot, 'campo', 'tiempo_entrega', 'valor', 'Se confirma al recibir el anticipo'),
    jsonb_build_object('tabla', 'cotizaciones', 'id', v_cot, 'campo', 'total', 'valor', '1'),
    jsonb_build_object('tabla', 'cotizaciones', 'id', v_cot2, 'campo', 'tiempo_entrega', 'valor', '3 días'),
    jsonb_build_object('tabla', 'cotizaciones', 'id', v_cot, 'campo', 'vigencia_dias', 'valor', 'treinta'),
    jsonb_build_object('tabla', 'cotizacion_lineas', 'id', v_lin, 'campo', 'cantidad', 'valor', '2'),
    jsonb_build_object('tabla', 'cotizacion_lineas', 'id', v_lin, 'campo', 'precio_unitario', 'valor', '1')), 'Falta el tiempo de entrega');
  reset role;
  v_prop := (r->>'id')::uuid;
  assert jsonb_array_length(r->'cambios') = 2, format('cambios permitidos: %s', r->'cambios');
  assert r->'cambios'->0->>'antes_texto' = '(vacío)', format('antes: %s', r->'cambios'->0);

  -- 8. Solo quien la pidió la aplica, y no se cierra sin aplicar. La partida de una cotización enviada
  --    no se edita a mano, así que tampoco así: no se aplica nada.
  perform pg_temp.como(v_ven2);
  begin perform revision_aplicar_propuesta(v_prop); v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'otro aplicó la propuesta';
  perform pg_temp.como(v_ven);
  begin perform revision_propuesta_cerrar(v_prop); v_ok := true; exception when others then v_ok := false; end;
  assert not v_ok, 'se marcó corregido sin aplicar';
  begin perform revision_aplicar_propuesta(v_prop); v_ok := true; exception when insufficient_privilege then v_ok := false; v_msg := sqlerrm; end;
  assert not v_ok and v_msg like '%Cantidad de la partida%', format('editó una partida de una cotización enviada: %s', v_msg);
  assert (select tiempo_entrega is null from cotizaciones where id = v_cot), 'aplicó la mitad';

  -- 9. Con solo el tiempo de entrega, se aplica a su nombre y queda en la bitácora.
  perform pg_temp.como_postgres();
  set local role service_role;
  r := revision_propuesta_guardar(h4, v_ven, jsonb_build_array(
    jsonb_build_object('tabla', 'cotizaciones', 'id', v_cot, 'campo', 'tiempo_entrega', 'valor', 'Se confirma al recibir el anticipo')), 'Falta');
  reset role;
  perform pg_temp.como(v_ven);
  v_msg := revision_aplicar_propuesta((r->>'id')::uuid);
  perform pg_temp.como_postgres();
  assert (select tiempo_entrega from cotizaciones where id = v_cot) = 'Se confirma al recibir el anticipo', 'no se aplicó';
  assert (select estado = 'corregido' and cerrado_por = v_ven and respuesta like 'Corregido con ayuda de la IA. Tiempo de entrega: (vacío) → Se confirma%'
          from revision_hallazgos where id = h4), 'no se cerró como corregido';
  assert exists (select 1 from bitacora where tabla = 'cotizaciones' and registro_id = v_cot::text and usuario_id = v_ven
                 and cambios ? 'tiempo_entrega'), 'la bitácora no lo anotó a su nombre';
end $$;

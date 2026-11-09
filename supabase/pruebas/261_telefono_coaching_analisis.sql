-- Teléfono, fase 3: el coaching y el análisis de cada llamada llegan en la foto y van a sus tablas,
-- cada una con quién la ve. Los «NO debe poder»: otro vendedor no ve el coaching ajeno; el dueño del
-- cliente ve la llamada pero no la calificación de quien la atendió; recepción solo lo suyo; almacén
-- nada; una sesión no escribe. Y: el coaching no queda en llamadas.datos, null borra, ausente no toca,
-- una foto de la historia no crea lead, actividad ni aviso, la corrección de ubicación no pisa lo que
-- cambió una persona, el indicador 75 mide bien, las dos reglas nocturnas sacan lo esperado y la
-- analítica responde a quien debe y niega a quien no.

create or replace function pg_temp.foto(p_sid text, p_llamada jsonb, p_extra jsonb default '{}', p_enviado timestamptz default now())
returns jsonb language sql as $$
  select public.telefono_registrar_evento(jsonb_build_object('version', 1, 'tipo', 'llamada', 'call_sid', p_sid,
    'enviado_en', p_enviado, 'llamada', p_llamada) || p_extra)
$$;

-- Un coaching como lo manda el conmutador: dos criterios, un fallo y una señal de tono.
create or replace function pg_temp.coach(p_cal numeric, p_tipo text default 'persona', p_nota_paso int default 4) returns jsonb
language sql as $$
  select jsonb_build_object(
    'rubrica', jsonb_build_object('clave', 'ventas-prueba', 'version', 3),
    'calificacion', p_cal, 'calificacion_sin_topes', least(10, p_cal + 0.7),
    'criterios', jsonb_build_array(
      jsonb_build_object('clave', 'siguiente_paso', 'nombre', 'Siguiente paso con fecha', 'peso', 20, 'nota', p_nota_paso,
                         'evidencia', '«Le marco el jueves»', 'segundo', 143),
      jsonb_build_object('clave', 'necesidad', 'nombre', 'Entender la necesidad', 'peso', 30, 'nota', 8, 'evidencia', '', 'segundo', null)),
    'topes', '[]'::jsonb,
    'fallos', jsonb_build_array(jsonb_build_object('clave', 'no-cerro-fecha', 'nombre', 'No cerró fecha', 'texto', 'Quedó en «luego le hablo».')),
    'tono', jsonb_build_array(jsonb_build_object('clave', 'sono-calido', 'nombre', 'Sonó cálido', 'signo', 1, 'texto', 'Saludó con calma.')),
    'lo_bueno', jsonb_build_array('Preguntó para qué material'), 'a_mejorar', jsonb_build_array('Cerrar con fecha'),
    'sugerencias', jsonb_build_array('Proponer día y hora'), 'resumen', 'Buena llamada, faltó cerrar.',
    'atendio_tipo', p_tipo, 'modelo', 'modelo-prueba', 'generado_en', now())
$$;

do $$
declare v_a uuid; v_b uuid; v_c uuid; v_d uuid; v_dir uuid; v_rec uuid; v_alm uuid; v_ger uuid;
  v_cli uuid; v_art uuid; v_an jsonb; r jsonb; m jsonb; v_ok boolean; v_n int; v_txt text; l leads; k llamada_coaching; an llamada_analisis;
  e1 uuid; e2 uuid; e3 uuid; e4 uuid; e5 uuid; e6 uuid; v_dirtel uuid; emp_a uuid; emp_b uuid; i int;
  t0 timestamptz := now() - interval '3 hours';
  v_mes date := date_trunc('month', (now() - interval '3 hours') at time zone 'America/Mexico_City')::date;
  at_a jsonb := jsonb_build_object('nombre', 'Vendedor A 261', 'telefono', '+523311112611');
  at_rec jsonb := jsonb_build_object('nombre', 'Recepción 261', 'telefono', '+523311112612');
begin
  v_a := pg_temp.usuario('vena261@hegamex.com', '{ventas}');
  v_b := pg_temp.usuario('venb261@hegamex.com', '{ventas}');
  v_c := pg_temp.usuario('venc261@hegamex.com', '{ventas}');
  v_d := pg_temp.usuario('vend261@hegamex.com', '{ventas}');
  v_dir := pg_temp.usuario('dir261@hegamex.com', '{direccion}');
  v_rec := pg_temp.usuario('rec261@hegamex.com', '{recepcion}');
  v_alm := pg_temp.usuario('alm261@hegamex.com', '{almacen}');
  v_ger := pg_temp.usuario('ger261@hegamex.com', '{gerente_ventas}');
  update perfiles set telefono = '33 1111 2611' where id = v_a;
  update perfiles set telefono = '33 1111 2612' where id = v_rec;
  update configuracion set valor = valor || '{"modo": "bandeja", "vendedores": []}' where clave = 'leads';
  insert into clientes (nombre, vendedor_id) values ('Agregados 261', v_b) returning id into v_cli;
  insert into contactos (cliente_id, nombre, telefono) values (v_cli, 'Juan 261', '818 000 2611');
  insert into articulos (clave, tipo, nombre) values ('T261-BT20', 'equipo', 'Banda 261 de 20 m') returning id into v_art;
  v_an := jsonb_build_object('intencion', 'cotizar', 'desenlace', 'transferida',
    'equipos', jsonb_build_array(jsonb_build_object('texto', 'banda transportadora', 'clave_catalogo', 'T261-BT20'),
                                 jsonb_build_object('texto', 'bandas transportadoras', 'clave_catalogo', 'NO-EXISTE')),
    'preguntas_sin_respuesta', jsonb_build_array('¿Manejan bandas de PVC grado alimenticio? Marque al 33 1234 5678'),
    'objeciones', jsonb_build_array(jsonb_build_object('categoria', 'precio', 'texto', 'Le pareció caro')),
    'stt_dudoso', false, 'fuente_transcripcion', 'scribe', 'modelo', 'modelo-prueba', 'generado_en', now());

  -- =========================================================================
  -- 1. Llamada del cliente de B que atendió A, con coaching y análisis
  -- =========================================================================
  r := pg_temp.foto('CA261-1', jsonb_build_object('telefono', '+528180002611', 'inicio', t0, 'duracion_seg', 300,
         'atendio', at_a, 'nadie_contesto', false, 'resumen', 'Busca una banda'),
       jsonb_build_object('coaching', pg_temp.coach(5.0), 'analisis', v_an));
  e1 := (r->>'llamada_id')::uuid;
  assert r->>'ok' = 'true' and (r->>'cliente_id')::uuid = v_cli, format('respuesta 1: %s', r);
  select * into k from llamada_coaching where llamada_id = e1;
  assert k.perfil_id = v_a and k.calificacion = 5.0 and k.atendio_tipo = 'persona' and k.rubrica_clave = 'ventas-prueba'
    and k.rubrica_version = 3 and jsonb_array_length(k.criterios) = 2 and k.lo_bueno = array['Preguntó para qué material'],
    format('el coaching no quedó a nombre de quien atendió: %s', to_jsonb(k));
  select * into an from llamada_analisis where llamada_id = e1;
  assert an.equipos->0->>'articulo_id' = v_art::text and an.equipos->1->>'articulo_id' is null,
    format('los equipos se ligan al catálogo por su clave, y solo si existe: %s', an.equipos);
  assert an.preguntas_sin_respuesta[1] not like '%1234%' and an.preguntas_sin_respuesta[1] like '%[teléfono]%',
    'un teléfono en la pregunta debía quitarse: ' || an.preguntas_sin_respuesta[1];
  -- Lo que no debe quedar en llamadas.datos: lo ve el dueño del cliente aunque haya atendido otro.
  assert not ((select datos from llamadas where id = e1) ?| array['coaching', 'analisis']), 'coaching o análisis quedaron en llamadas.datos';

  -- Quién ve qué -------------------------------------------------------------
  perform pg_temp.como(v_a);
  assert exists (select 1 from llamada_coaching where llamada_id = e1), 'A debe ver su coaching';
  assert exists (select 1 from llamada_analisis where llamada_id = e1), 'A debe ver el análisis de la llamada que atendió';
  perform pg_temp.como(v_b);
  assert exists (select 1 from llamadas where id = e1), 'B (dueño del cliente) ve la llamada';
  assert not exists (select 1 from llamada_coaching where llamada_id = e1), 'el dueño del cliente NO debe ver la calificación de quien atendió';
  assert exists (select 1 from llamada_analisis where llamada_id = e1), 'el dueño del cliente sí ve el análisis (ve la llamada)';
  perform pg_temp.como(v_c);
  assert not exists (select 1 from llamada_coaching where llamada_id = e1), 'otro vendedor NO debe ver el coaching ajeno';
  assert not exists (select 1 from llamada_analisis where llamada_id = e1), 'otro vendedor NO debe ver el análisis de una llamada ajena';
  perform pg_temp.como(v_alm);
  assert not exists (select 1 from llamada_coaching) and not exists (select 1 from llamada_analisis), 'almacén NO debe ver nada';
  perform pg_temp.como(v_ger);
  assert exists (select 1 from llamada_coaching where llamada_id = e1) and exists (select 1 from llamada_analisis where llamada_id = e1),
    'la gerencia de ventas ve todo';
  -- Una sesión no escribe: ni las tablas ni la función.
  perform pg_temp.como(v_a);
  v_ok := false;
  begin update llamada_coaching set calificacion = 10 where llamada_id = e1; v_ok := true; exception when insufficient_privilege then null; end;
  assert not v_ok, 'una sesión NO debe poder cambiar su calificación';
  v_ok := false;
  begin insert into llamada_analisis (llamada_id) values (e1); v_ok := true; exception when insufficient_privilege then null; end;
  assert not v_ok, 'una sesión NO debe poder escribir análisis';
  v_ok := false;
  begin perform telefono_registrar_evento(jsonb_build_object('version', 1, 'tipo', 'llamada', 'call_sid', 'CA261-x', 'llamada', '{}'::jsonb,
          'coaching', pg_temp.coach(10))); v_ok := true;
  exception when insufficient_privilege then null; end;
  assert not v_ok, 'una sesión NO debe poder mandar fotos';
  perform pg_temp.como_postgres();

  -- Recepción: ve su coaching, no el de A ---------------------------------------
  r := pg_temp.foto('CA261-2', jsonb_build_object('telefono', '+525550002612', 'inicio', t0, 'atendio', at_rec, 'nadie_contesto', false),
       jsonb_build_object('coaching', pg_temp.coach(8.0)));
  e2 := (r->>'llamada_id')::uuid;
  perform pg_temp.como(v_rec);
  assert exists (select 1 from llamada_coaching where llamada_id = e2), 'recepción debe ver su coaching';
  assert not exists (select 1 from llamada_coaching where llamada_id = e1), 'recepción NO debe ver el coaching de un vendedor';
  perform pg_temp.como_postgres();

  -- =========================================================================
  -- 2. Presencia: ausente no toca, objeto reemplaza completo, null borra
  -- =========================================================================
  r := pg_temp.foto('CA261-1', jsonb_build_object('telefono', '+528180002611', 'inicio', t0, 'atendio', at_a, 'nadie_contesto', false,
         'grabacion_url', 'https://voz.example/g.mp3'));
  assert (select calificacion from llamada_coaching where llamada_id = e1) = 5.0 and exists (select 1 from llamada_analisis where llamada_id = e1),
    'una foto sin las llaves no debe tocar coaching ni análisis';
  r := pg_temp.foto('CA261-1', jsonb_build_object('telefono', '+528180002611', 'inicio', t0, 'atendio', at_a, 'nadie_contesto', false),
       jsonb_build_object('coaching', pg_temp.coach(6.5) - 'fallos' - 'lo_bueno'));
  select * into k from llamada_coaching where llamada_id = e1;
  assert k.calificacion = 6.5 and k.fallos = '[]'::jsonb and k.lo_bueno = '{}', format('el rehecho debe reemplazar todo, sin etiquetas viejas: %s', to_jsonb(k));
  r := pg_temp.foto('CA261-1', jsonb_build_object('telefono', '+528180002611', 'inicio', t0, 'atendio', at_a, 'nadie_contesto', false),
       '{"coaching": null, "analisis": null}');
  assert not exists (select 1 from llamada_coaching where llamada_id = e1) and not exists (select 1 from llamada_analisis where llamada_id = e1),
    'null debe borrar coaching y análisis';
  -- Se vuelven a dejar para las mediciones de abajo.
  r := pg_temp.foto('CA261-1', jsonb_build_object('telefono', '+528180002611', 'inicio', t0, 'atendio', at_a, 'nadie_contesto', false),
       jsonb_build_object('coaching', pg_temp.coach(5.0), 'analisis', v_an));

  -- Una foto mal hecha es 22023 (400, no se reintenta igual) y no deja nada a medias.
  foreach v_txt in array array['{"calificacion": 11, "atendio_tipo": "persona"}', '{"calificacion": 0.5, "atendio_tipo": "persona"}',
                               '{"calificacion": "7", "atendio_tipo": "persona"}', '{"calificacion": 7}', '"siete"', '[]']
  loop
    v_ok := false;
    begin
      perform pg_temp.foto('CA261-1', jsonb_build_object('telefono', '+528180002611', 'inicio', t0, 'atendio', at_a, 'nadie_contesto', false),
        jsonb_build_object('coaching', v_txt::jsonb));
      v_ok := true;
    exception when sqlstate '22023' then null; end;
    assert not v_ok, 'un coaching mal hecho debía rechazarse con 22023: ' || v_txt;
  end loop;
  assert (select calificacion from llamada_coaching where llamada_id = e1) = 5.0, 'el rechazo no debe tocar lo que había';

  -- =========================================================================
  -- 3. Una foto de la historia: cliente sí; lead, actividad, aviso y «Regresar llamada» no
  -- =========================================================================
  select count(*) into v_n from avisos where usuario_id = v_b;
  r := pg_temp.foto('CA261-H1', jsonb_build_object('telefono', '+528180002611', 'inicio', t0 - interval '1 day', 'nadie_contesto', true,
         'historica', true),
       jsonb_build_object('lead', jsonb_build_object('nombre', 'Histórico 261', 'telefono', '+528180002611', 'interes', 'Banda de 12 m para grava'),
         'analisis', jsonb_build_object('intencion', 'cotizar', 'desenlace', 'abandonada', 'equipos', '[]'::jsonb)));
  e3 := (r->>'llamada_id')::uuid;
  assert (r->>'cliente_id')::uuid = v_cli and r->'lead_id' = 'null', format('la histórica se liga al cliente y no deja lead: %s', r);
  assert (select historica and avisado_en is null and actividad_id is null from llamadas where id = e3), 'la histórica no debe avisar ni dejar actividad';
  assert (select count(*) from avisos where usuario_id = v_b) = v_n, 'la histórica NO debe avisarle al dueño';
  assert not exists (select 1 from leads where llamada_id = e3), 'la histórica NO debe crear lead';
  assert exists (select 1 from llamada_analisis where llamada_id = e3), 'la histórica sí guarda su análisis';
  perform pg_temp.como(v_ger);
  assert not exists (select 1 from llamadas_por_regresar() where id = e3), 'la histórica NO debe salir en «Regresar llamada»';
  perform pg_temp.como_postgres();
  -- Atendida y de la historia: no da por regresadas las perdidas de hoy de ese número.
  r := pg_temp.foto('CA261-P', jsonb_build_object('telefono', '+525550002699', 'inicio', t0 - interval '2 hours', 'nadie_contesto', true));
  e4 := (r->>'llamada_id')::uuid;
  r := pg_temp.foto('CA261-H2', jsonb_build_object('telefono', '+525550002699', 'inicio', t0, 'atendio', at_a, 'nadie_contesto', false, 'historica', true),
       jsonb_build_object('lead', jsonb_build_object('nombre', 'Otro histórico', 'telefono', '+525550002699', 'interes', 'Tolva 10 t para cemento'),
         'coaching', pg_temp.coach(7.0)));
  assert (select regresada_en is null from llamadas where id = e4), 'una histórica NO debe dar por regresada una perdida';
  assert r->'lead_id' = 'null' and exists (select 1 from llamada_coaching where llamada_id = (r->>'llamada_id')::uuid and perfil_id = v_a),
    'la histórica guarda su coaching a nombre de quien atendió, sin lead';
  -- Una foto posterior que olvida la marca sigue siendo de la historia.
  r := pg_temp.foto('CA261-H2', jsonb_build_object('telefono', '+525550002699', 'inicio', t0, 'atendio', at_a, 'nadie_contesto', false),
       jsonb_build_object('lead', jsonb_build_object('nombre', 'Otro histórico', 'telefono', '+525550002699', 'interes', 'Tolva 10 t para cemento')));
  assert r->'lead_id' = 'null' and (select historica from llamadas where call_sid = 'CA261-H2'), 'una foto sin la marca no debe volverla de hoy';

  -- =========================================================================
  -- 4. Corrección de ubicación: entra si sigue lo que mandó el teléfono, no si lo cambió una persona
  -- =========================================================================
  r := pg_temp.foto('CA261-U', jsonb_build_object('telefono', '+525550002620', 'inicio', t0, 'nadie_contesto', false),
       '{"lead": {"nombre": "Ubica 261", "telefono": "+525550002620", "interes": "Cribadora 4x8 para arena", "ciudad": "Antequila", "estado": "Jalisco"}}');
  select * into l from leads where id = (r->>'lead_id')::uuid;
  assert l.ciudad = 'Antequila' and l.estado_mx = 'Jalisco', 'primera foto: ' || l.ciudad;
  -- Una foto sin ubicación en medio no hace perder qué había mandado el teléfono.
  r := pg_temp.foto('CA261-U', jsonb_build_object('telefono', '+525550002620', 'inicio', t0, 'nadie_contesto', false),
       '{"lead": {"nombre": "Ubica 261", "telefono": "+525550002620", "interes": "Cribadora 4x8 para arena"}}');
  r := pg_temp.foto('CA261-U', jsonb_build_object('telefono', '+525550002620', 'inicio', t0, 'nadie_contesto', false),
       '{"lead": {"nombre": "Ubica 261", "telefono": "+525550002620", "interes": "Cribadora 4x8 para arena", "ciudad": "Tequila", "estado": "jalisco"}}');
  select * into l from leads where id = l.id;
  assert l.ciudad = 'Tequila' and l.estado_mx = 'Jalisco', 'la corrección del teléfono debía entrar: ' || l.ciudad;
  -- Una persona la cambia: la siguiente corrección ya no la pisa.
  update leads set ciudad = 'Amatitán', estado_mx = 'Jalisco' where id = l.id;
  r := pg_temp.foto('CA261-U', jsonb_build_object('telefono', '+525550002620', 'inicio', t0, 'nadie_contesto', false),
       '{"lead": {"nombre": "Ubica 261", "telefono": "+525550002620", "interes": "Cribadora 4x8 para arena", "ciudad": "Tala", "estado": "Nayarit"}}');
  select * into l from leads where id = l.id;
  assert l.ciudad = 'Amatitán' and l.estado_mx = 'Jalisco', 'la corrección NO debe pisar lo que cambió una persona: ' || l.ciudad || ', ' || l.estado_mx;
  -- Vacío o en blanco se llena.
  update leads set ciudad = ' ', estado_mx = null where id = l.id;
  r := pg_temp.foto('CA261-U', jsonb_build_object('telefono', '+525550002620', 'inicio', t0, 'nadie_contesto', false),
       '{"lead": {"nombre": "Ubica 261", "telefono": "+525550002620", "interes": "Cribadora 4x8 para arena", "ciudad": "Tala", "estado": "Jalisco"}}');
  select * into l from leads where id = l.id;
  assert l.ciudad = 'Tala' and l.estado_mx = 'Jalisco', 'lo vacío se llena: ' || coalesce(l.ciudad, 'null');

  -- =========================================================================
  -- 5. Directorio: un nombre sin ligar, su coaching sin dueño; al ligarlo se le asigna. La IA, de nadie.
  -- =========================================================================
  r := pg_temp.foto('CA261-5', jsonb_build_object('telefono', '+525550002630', 'inicio', t0, 'nadie_contesto', false,
         'atendio', jsonb_build_object('nombre', 'Pedro Externo 261', 'telefono', null)),
       jsonb_build_object('coaching', pg_temp.coach(4.0)));
  e5 := (r->>'llamada_id')::uuid;
  r := pg_temp.foto('CA261-6', jsonb_build_object('telefono', '+525550002631', 'inicio', t0, 'nadie_contesto', false,
         'atendio', jsonb_build_object('nombre', 'Pedro Externo 261', 'telefono', null), 'atendio_ia', 'Sofía'),
       jsonb_build_object('coaching', pg_temp.coach(9.0, 'ia')));
  e6 := (r->>'llamada_id')::uuid;
  assert (select perfil_id is null from llamada_coaching where llamada_id = e5), 'sin ligar, el coaching no es de nadie';
  perform pg_temp.como(v_c);
  assert not exists (select 1 from llamada_coaching where llamada_id in (e5, e6)), 'sin ligar, C NO lo ve';
  perform pg_temp.como(v_ger);
  assert (select count(*) from llamada_coaching where llamada_id in (e5, e6)) = 2, 'sin ligar, lo ve la gerencia';
  perform pg_temp.como(v_dir);
  select id into v_dirtel from telefono_directorio where clave = 'nombre:pedro externo 261';
  perform fijar_directorio_telefono(v_dirtel, v_c);
  perform pg_temp.como(v_c);
  assert exists (select 1 from llamada_coaching where llamada_id = e5 and perfil_id = v_c), 'al ligarlo, su coaching es suyo';
  assert not exists (select 1 from llamada_coaching where llamada_id = e6), 'el coaching de la IA sigue sin ser de nadie';
  perform pg_temp.como_postgres();
  -- Coaching que llegó antes de saber quién atendió: la foto que lo dice se lo asigna.
  r := pg_temp.foto('CA261-7', jsonb_build_object('telefono', '+525550002632', 'inicio', t0, 'nadie_contesto', false),
       jsonb_build_object('coaching', pg_temp.coach(6.0)));
  assert (select perfil_id is null from llamada_coaching where llamada_id = (r->>'llamada_id')::uuid), 'sin atendio, sin dueño';
  r := pg_temp.foto('CA261-7', jsonb_build_object('telefono', '+525550002632', 'inicio', t0, 'nadie_contesto', false, 'atendio', at_a));
  assert (select perfil_id = v_a from llamada_coaching where llamada_id = (r->>'llamada_id')::uuid), 'la foto que dice quién atendió le asigna el coaching';

  -- =========================================================================
  -- 6. Indicador 75: promedio del mes de lo que atendió, con evidencia por llamada
  -- =========================================================================
  insert into empleados (nombre, fecha_ingreso, usuario_id) values ('P261 A', '2024-01-01', v_a) returning id into emp_a;
  insert into empleados (nombre, fecha_ingreso, usuario_id) values ('P261 B', '2024-01-01', v_b) returning id into emp_b;
  assert (select clave = 'calificacion_coaching' and fuente = 'automatica' and area = 'ventas' from objetivo_indicadores where id = 75), 'falta el indicador 75';
  -- A atendió CA261-1 (5.0), CA261-H2 (7.0) y CA261-7 (6.0): promedio 6.0, una incidencia (5.0 < 6).
  m := objetivo_medir('calificacion_coaching', null, emp_a, v_mes);
  assert (m->>'valor')::numeric = 6.0 and (m->>'posibles')::numeric = 10 and m->>'modo' = 'no' and jsonb_array_length(m->'evidencias') = 3,
    format('el indicador 75 no midió el promedio de A: %s', m);
  assert (m->'evidencias') @> jsonb_build_array(jsonb_build_object('tipo', 'llamada', 'referencia', e1::text, 'cuenta', true, 'cantidad', 5.0)),
    format('la llamada de 5.0 debía ser incidencia: %s', m->'evidencias');
  assert (m->'evidencias')::text not like '%8180002611%', 'la evidencia no lleva teléfonos';
  m := objetivo_medir('calificacion_coaching', null, emp_a, v_mes, '{"minima": 7}');
  assert (select count(*) from jsonb_array_elements(m->'evidencias') x where (x->>'cuenta')::boolean) = 2, 'con mínima 7 son dos incidencias';
  m := objetivo_medir('calificacion_coaching', null, emp_b, v_mes);
  assert (m->>'sin_dato')::boolean and m->>'nota' like 'No hubo llamadas%', format('B no atendió llamadas calificadas: %s', m);

  -- =========================================================================
  -- 7. Reglas nocturnas
  -- =========================================================================
  -- La misma pregunta con otras palabras en tres llamadas de la semana; otra solo una vez; una vieja no cuenta.
  for i in 1..3 loop
    perform pg_temp.foto('CA261-Q' || i, jsonb_build_object('telefono', '+52555000264' || i, 'inicio', t0 - (i || ' hours')::interval, 'nadie_contesto', false),
      jsonb_build_object('analisis', jsonb_build_object('intencion', 'cotizar', 'preguntas_sin_respuesta',
        jsonb_build_array(case i when 1 then '¿Manejan bandas de PVC grado alimenticio?' when 2 then '¿Tienen banda PVC grado alimenticio?'
                                 else 'banda pvc grado alimenticio' end, 'Pregunta 261 única ' || i))));
  end loop;
  perform pg_temp.foto('CA261-Qv', jsonb_build_object('telefono', '+525550002649', 'inicio', now() - interval '10 days', 'nadie_contesto', false),
    jsonb_build_object('analisis', jsonb_build_object('preguntas_sin_respuesta', jsonb_build_array('¿Hacen silos de 200 toneladas?'))));
  perform pg_temp.foto('CA261-Qw', jsonb_build_object('telefono', '+525550002648', 'inicio', now() - interval '9 days', 'nadie_contesto', false),
    jsonb_build_object('analisis', jsonb_build_object('preguntas_sin_respuesta', jsonb_build_array('¿Hacen silos de 200 toneladas?'))));
  -- CA261-1 ya traía la del PVC (con un teléfono): son 4.
  assert (select count(*) from revision_r_preguntas_sin_respuesta() h where h.titulo like '%PVC%' or h.titulo like '%pvc%') = 1,
    'la pregunta repetida debía salir una vez';
  select count(*) into v_n from revision_r_preguntas_sin_respuesta() h, jsonb_array_elements(h.evidencia) x
  where h.huella = 'preguntas_sin_respuesta:' || md5(llamada_texto_clave('banda pvc grado alimenticio'));
  assert v_n = 4, 'debía juntar las 4 llamadas con la pregunta del PVC: ' || v_n;
  assert (select h.gravedad = 'media' and h.responsables @> array[v_dir] and not h.responsables && array[v_a, v_b, v_rec, v_ger]
          and h.titulo not like '%1234%' and h.detalle not like '%1234%' and h.evidencia::text not like '%1234 5678%'
          from revision_r_preguntas_sin_respuesta() h where h.huella = 'preguntas_sin_respuesta:' || md5(llamada_texto_clave('banda pvc grado alimenticio'))),
    'le debe llegar a quien administra catálogo o costos, sin teléfonos';
  assert not exists (select 1 from revision_r_preguntas_sin_respuesta() h where h.titulo like '%única%' or h.titulo like '%silos%'),
    'una pregunta de una sola vez, o de hace más de 7 días, NO debe salir';

  -- D: 5 llamadas con promedio 4.6 → patrón para dirección. A (pocas) y la recepción (8.0) no.
  for i in 1..5 loop
    perform pg_temp.foto('CA261-D' || i, jsonb_build_object('telefono', '+52555000265' || i, 'inicio', t0 - (i || ' days')::interval, 'nadie_contesto', false,
      'atendio', jsonb_build_object('nombre', 'Vendedor D 261', 'telefono', '+523311112614')),
      jsonb_build_object('coaching', pg_temp.coach(case when i = 1 then 6.0 else 4.25 end, 'persona', 2)));
  end loop;
  update perfiles set telefono = '33 1111 2614' where id = v_d;
  perform pg_temp.como(v_dir);
  perform fijar_directorio_telefono((select id from telefono_directorio where clave = '3311112614'), v_d);
  perform pg_temp.como_postgres();
  select count(*) into v_n from revision_r_coaching_bajo_repetido() h where h.registro_id in (v_a::text, v_rec::text, v_b::text, v_c::text);
  assert v_n = 0, 'A, B, C y recepción NO deben salir (pocas llamadas o buena calificación)';
  select h.titulo || ' | ' || h.detalle into v_txt from revision_r_coaching_bajo_repetido() h where h.registro_id = v_d::text;
  assert v_txt like 'Coaching: un patrón de 5 llamadas%' and v_txt like '%promedian 4.6 de 10%' and v_txt like '%Siguiente paso con fecha%',
    'D debía salir como patrón con su promedio y lo que más baja: ' || coalesce(v_txt, 'nada');
  assert (select h.titulo not like '%' || revision_nombre(v_d) || '%' and h.titulo not like '%4.6%' and h.responsables = '{}'
          from revision_r_coaching_bajo_repetido() h where h.registro_id = v_d::text),
    'el título NO debe llevar nombre ni calificación (le llega a la IA) y no tiene responsables';
  assert (select para = 'direccion' and not se_resuelve_sola from revision_reglas where clave = 'coaching_bajo_repetido')
     and (select para = 'responsable' and se_resuelve_sola from revision_reglas where clave = 'preguntas_sin_respuesta'),
    'las reglas no quedaron registradas como se pidió';
  -- El corredor las corre sin tronar y el patrón no le llega a D.
  insert into revision_corridas default values returning id into i;
  perform revision_correr_reglas(i);
  assert (select nota is null or (nota not like '%preguntas_sin_respuesta%' and nota not like '%coaching_bajo%') from revision_corridas where id = i),
    'una regla nueva tronó en el corredor: ' || (select nota from revision_corridas where id = i);
  assert exists (select 1 from revision_hallazgos where regla = 'coaching_bajo_repetido' and registro_id = v_d::text and para = 'direccion' and responsables = '{}'),
    'el patrón debía quedar para dirección';
  perform pg_temp.como(v_d);
  assert not exists (select 1 from revision_hallazgos where regla = 'coaching_bajo_repetido'), 'el patrón NO le debe llegar a la persona';
  perform pg_temp.como_postgres();

  -- =========================================================================
  -- 8. Analítica
  -- =========================================================================
  perform pg_temp.como(v_a);
  m := coaching_resumen(v_mes - 31, current_date);
  assert (m->>'n')::int = 3 and jsonb_array_length(m->'personas') = 1 and (m->'personas'->0->>'perfil_id')::uuid = v_a,
    format('A debe ver solo lo suyo: %s', m);
  assert m->'criterios' @> '[{"clave": "siguiente_paso", "n": 3}]' and m->'fallos' @> '[{"clave": "no-cerro-fecha"}]'
     and (m->'peor'->>'calificacion')::numeric = 5.0 and (m->'mejor'->>'calificacion')::numeric = 7.0,
    format('criterios, fallos, mejor y peor: %s', m);
  assert m->'personas'->0->'fallo'->>'nombre' = 'No cerró fecha' and (m->'personas'->0->>'reciente')::numeric = (m->>'promedio')::numeric
     and m->'personas'->0->'anterior' = 'null'::jsonb and (m->>'reciente')::numeric = (m->>'promedio')::numeric,
    format('fallo más repetido y tendencia de A (todo es de las últimas 4 semanas): %s', m->'personas');
  -- La lista: A ve sus 3; el dueño del cliente (B), recepción y almacén NO ven la calificación de A.
  assert (select count(*) = 3 and bool_and(x.perfil_id = v_a) from coaching_llamadas(v_mes - 31, current_date) x),
    'A debe ver en la lista sus 3 llamadas calificadas y nada más';
  perform pg_temp.como(v_b);
  assert not exists (select 1 from coaching_llamadas(v_mes - 31, current_date) x where x.perfil_id is distinct from v_b),
    'el dueño del cliente NO debe ver en la lista la calificación de quien atendió';
  perform pg_temp.como(v_rec);
  assert (select count(*) > 0 and bool_and(x.perfil_id = v_rec) from coaching_llamadas(v_mes - 31, current_date) x),
    'recepción ve solo lo suyo en la lista';
  perform pg_temp.como(v_alm);
  assert not exists (select 1 from coaching_llamadas(v_mes - 31, current_date)), 'almacén NO debe ver ninguna calificación';
  perform pg_temp.como(v_a);
  v_ok := false;
  begin perform coaching_resumen(v_mes - 31, current_date, v_d); v_ok := true; exception when insufficient_privilege then null; end;
  assert not v_ok, 'un vendedor NO debe poder pedir el coaching de otro';
  perform pg_temp.como(v_ger);
  m := coaching_resumen(v_mes - 31, current_date);
  assert (select count(*) from jsonb_array_elements(m->'personas') x where x->>'perfil_id' in (v_a::text, v_d::text, v_rec::text, v_c::text)) = 4
     and m->'personas' @> '[{"tipo": "ia"}]', format('la gerencia ve a todos, incluida la IA: %s', m->'personas');
  m := coaching_resumen(v_mes - 31, current_date, v_d);
  assert (m->>'n')::int = 5 and (m->>'promedio')::numeric = 4.6, format('la gerencia filtra por persona: %s', m);
  assert m->'personas'->0->'fallo'->>'nombre' = 'No cerró fecha', format('el fallo más repetido de D: %s', m->'personas');
  assert (select count(*) >= 5 and bool_or(x.atendio_tipo = 'ia') and bool_or(x.perfil_id = v_d)
          from coaching_llamadas(v_mes - 31, current_date) x), 'la gerencia ve en la lista a todos, incluida la IA';
  -- Tendencia: las últimas 4 semanas contra las 4 de antes, aunque el periodo pedido sea de una semana.
  perform pg_temp.como_postgres();
  perform pg_temp.foto('CA261-D-vieja', jsonb_build_object('telefono', '+525550002660', 'inicio', t0 - interval '50 days', 'nadie_contesto', false,
    'atendio', jsonb_build_object('nombre', 'Vendedor D 261', 'telefono', '+523311112614')),
    jsonb_build_object('coaching', pg_temp.coach(8.0)));
  perform pg_temp.como(v_ger);
  m := coaching_resumen(current_date - 6, current_date, v_d);
  assert (m->'personas'->0->>'reciente')::numeric = 4.6 and (m->'personas'->0->>'anterior')::numeric = 8.0
     and (m->>'anterior')::numeric = 8.0, format('la tendencia de D debía ser 4.6 contra 8.0: %s', m);

  v_ok := false;
  perform pg_temp.como(v_a);
  begin perform llamadas_analitica(current_date - 30, current_date); v_ok := true; exception when insufficient_privilege then null; end;
  assert not v_ok, 'un vendedor NO debe ver la analítica de todas las llamadas';
  perform pg_temp.como(v_alm);
  v_ok := false;
  begin perform llamadas_analitica(current_date - 30, current_date); v_ok := true; exception when insufficient_privilege then null; end;
  assert not v_ok, 'almacén NO debe ver la analítica';
  perform pg_temp.como(v_ger);
  m := llamadas_analitica(current_date - 30, current_date);
  assert (select sum((x->>'n')::int) from jsonb_array_elements(m->'por_hora') x) = (m->>'llamadas')::int
     and (select sum((x->>'n')::int) from jsonb_array_elements(m->'por_dia') x) = (m->>'llamadas')::int,
    format('las horas y los días deben sumar las llamadas: %s', m);
  assert (m->>'nadie_contesto')::int >= 2, 'faltan las que nadie contestó';
  assert m->'equipos' @> jsonb_build_array(jsonb_build_object('articulo_id', v_art, 'nombre', 'Banda 261 de 20 m', 'n', 1)),
    format('el equipo ligado sale con su nombre del catálogo: %s', m->'equipos');
  assert m->'preguntas' @> jsonb_build_array(jsonb_build_object('clave', llamada_texto_clave('banda pvc grado alimenticio'), 'n', 4)),
    format('las preguntas parecidas se juntan: %s', m->'preguntas');
  assert m::text not like '%1234 5678%' and m::text not like '%8180002611%', 'la analítica NO debe llevar teléfonos';
  assert m->'objeciones' @> '[{"categoria": "precio"}]' and m->'intenciones' @> '[{"intencion": "cotizar"}]', 'objeciones e intenciones';
  perform pg_temp.como(v_dir);
  m := llamadas_analitica(current_date - 30, current_date);
  assert (m->>'llamadas')::int > 0, 'dirección ve la analítica';
  perform pg_temp.como_postgres();
end $$;

-- =========================================================================
-- 9. Lo que encontró la revisión adversarial (cada caso fallaba antes del arreglo)
-- =========================================================================
do $$
declare v_e uuid; v_f uuid; v_g uuid; v_h uuid; v_dir uuid; v_cmp uuid; r jsonb; e1 uuid; e2 uuid; v_d uuid; v_n int; i int; emp uuid;
  t0 timestamptz := now() - interval '3 hours';
  v_mes date := date_trunc('month', (now() - interval '3 hours') at time zone 'America/Mexico_City')::date;
begin
  v_e := pg_temp.usuario('vene261@hegamex.com', '{ventas}');
  v_f := pg_temp.usuario('venf261@hegamex.com', '{ventas}');
  v_g := pg_temp.usuario('veng261@hegamex.com', '{ventas}');
  v_dir := pg_temp.usuario('dir2261@hegamex.com', '{direccion}');
  v_h := pg_temp.usuario('venh261@hegamex.com', '{ventas}');
  update perfiles set telefono = '33 1111 2618' where id = v_h;

  -- a) Dirección liga un nombre a quien no era y lo corrige con «Sin persona»: esa persona deja de ver
  --    la calificación (y la llamada), y la siguiente foto no se la devuelve.
  r := pg_temp.foto('CA261-M1', jsonb_build_object('telefono', '+525550002671', 'inicio', t0, 'nadie_contesto', false,
         'atendio', jsonb_build_object('nombre', 'Persona Mal 261', 'telefono', null)), jsonb_build_object('coaching', pg_temp.coach(4.0)));
  e1 := (r->>'llamada_id')::uuid;
  select id into v_d from telefono_directorio where clave = 'nombre:persona mal 261';
  perform pg_temp.como(v_dir);
  perform fijar_directorio_telefono(v_d, v_f);
  perform fijar_directorio_telefono(v_d, null);
  perform pg_temp.como(v_f);
  assert not exists (select 1 from llamada_coaching where llamada_id = e1), 'al desligarlo, NO debe seguir viendo la calificación de otra persona';
  assert not exists (select 1 from llamadas where id = e1), 'al desligarlo, NO debe seguir viendo la llamada';
  perform pg_temp.como_postgres();
  r := pg_temp.foto('CA261-M1', jsonb_build_object('telefono', '+525550002671', 'inicio', t0, 'nadie_contesto', false,
         'atendio', jsonb_build_object('nombre', 'Persona Mal 261', 'telefono', null)), jsonb_build_object('coaching', pg_temp.coach(4.5)));
  assert (select perfil_id is null from llamada_coaching where llamada_id = e1), 'la foto siguiente NO debe devolverle el coaching';

  -- b) Se liga solo por teléfono cuando por fin lo ponen en su perfil: lo de antes también es suyo.
  r := pg_temp.foto('CA261-L1', jsonb_build_object('telefono', '+525550002672', 'inicio', t0 - interval '2 days', 'nadie_contesto', false,
         'atendio', jsonb_build_object('nombre', 'Vendedor E 261', 'telefono', '+523311112615')), jsonb_build_object('coaching', pg_temp.coach(7.0)));
  e2 := (r->>'llamada_id')::uuid;
  assert (select perfil_id is null from llamada_coaching where llamada_id = e2), 'sin teléfono en su perfil todavía no es de nadie';
  update perfiles set telefono = '33 1111 2615' where id = v_e;
  r := pg_temp.foto('CA261-L2', jsonb_build_object('telefono', '+525550002673', 'inicio', t0, 'nadie_contesto', false,
         'atendio', jsonb_build_object('nombre', 'Vendedor E 261', 'telefono', '+523311112615')), jsonb_build_object('coaching', pg_temp.coach(9.0)));
  perform pg_temp.como(v_e);
  assert (select count(*) from llamada_coaching where llamada_id in (e2, (r->>'llamada_id')::uuid)) = 2,
    'al ligarse solo, la calificación de antes también debe ser suya';
  assert exists (select 1 from llamadas where id = e2), 'y la llamada de antes también';
  perform pg_temp.como_postgres();

  -- c) La calificación sigue a la llamada: una foto sin coaching (se está rehaciendo) que corrige quién
  --    atendió se la pasa a esa persona, y el indicador 75 mide lo mismo que ella ve.
  update perfiles set telefono = '33 1111 2616' where id = v_g;
  r := pg_temp.foto('CA261-L2', jsonb_build_object('telefono', '+525550002673', 'inicio', t0, 'nadie_contesto', false,
         'atendio', jsonb_build_object('nombre', 'Vendedor G 261', 'telefono', '+523311112616')));
  assert (select perfil_id = v_g from llamada_coaching where llamada_id = (r->>'llamada_id')::uuid), 'la calificación debe seguir a quien atendió';
  insert into empleados (nombre, fecha_ingreso, usuario_id) values ('P261 E', '2024-01-01', v_e) returning id into emp;
  assert (jsonb_array_length(objetivo_medir('calificacion_coaching', null, emp, v_mes)->'evidencias')) = 1
     and (select count(*) from llamada_coaching where perfil_id = v_e) = 1, 'el indicador 75 debe medir lo mismo que la persona ve';

  -- d) Calificación baja sostenida: con uno abierto (de otro mes) NO sale otro de la misma persona.
  for i in 1..5 loop
    perform pg_temp.foto('CA261-F' || i, jsonb_build_object('telefono', '+52555000268' || i, 'inicio', t0 - (i || ' days')::interval, 'nadie_contesto', false,
      'atendio', jsonb_build_object('nombre', 'Vendedor F 261', 'telefono', '+523311112617')), jsonb_build_object('coaching', pg_temp.coach(3.0)));
  end loop;
  update perfiles set telefono = '33 1111 2617' where id = v_f;
  perform pg_temp.foto('CA261-F6', jsonb_build_object('telefono', '+525550002686', 'inicio', t0, 'nadie_contesto', false,
      'atendio', jsonb_build_object('nombre', 'Vendedor F 261', 'telefono', '+523311112617')), jsonb_build_object('coaching', pg_temp.coach(3.0)));
  insert into revision_corridas default values returning id into i;
  perform revision_correr_reglas(i);
  assert (select count(*) from revision_hallazgos where regla = 'coaching_bajo_repetido' and registro_id = v_f::text and estado = 'abierto') = 1,
    'F debía salir una vez';
  -- El de antes sigue abierto (así queda cuando dirección no alcanza a verlo y cambia la huella).
  update revision_hallazgos set huella = 'coaching_bajo_repetido:' || v_f || ':2000-01'
  where regla = 'coaching_bajo_repetido' and registro_id = v_f::text;
  perform revision_correr_reglas(i);
  assert (select count(*) from revision_hallazgos where regla = 'coaching_bajo_repetido' and registro_id = v_f::text and estado = 'abierto') = 1,
    'NO debe abrir otro de la misma persona mientras siga abierto el anterior';
  -- Ya atendido, en el mismo mes no vuelve.
  update revision_hallazgos set estado = 'corregido', cerrado_en = now(), huella = 'coaching_bajo_repetido:' || v_f || ':' || to_char(hoy_planta(), 'YYYY-MM')
  where regla = 'coaching_bajo_repetido' and registro_id = v_f::text;
  perform revision_correr_reglas(i);
  assert (select count(*) from revision_hallazgos where regla = 'coaching_bajo_repetido' and registro_id = v_f::text) = 1,
    'en el mismo mes NO debe volver a salir';

  -- Dos llamadas pésimas entre tres buenas bajan el promedio, pero no son un patrón.
  for i in 1..5 loop
    perform pg_temp.foto('CA261-G' || i, jsonb_build_object('telefono', '+52555000267' || i, 'inicio', t0 - (i || ' days')::interval, 'nadie_contesto', false,
      'atendio', jsonb_build_object('nombre', 'Vendedor H 261', 'telefono', '+523311112618')),
      jsonb_build_object('coaching', pg_temp.coach((array[9.0, 8.0, 7.0, 2.0, 1.5])[i])));
  end loop;
  assert (select count(*) = 5 and avg(calificacion) < 6 from llamada_coaching where perfil_id = v_h), 'el caso debía ser de H y promediar menos de 6';
  assert not exists (select 1 from revision_r_coaching_bajo_repetido() h where h.registro_id = v_h::text),
    'dos llamadas malas entre buenas NO deben salir como calificación baja sostenida';

  -- e) Preguntas: le llega a quien puede abrir a dónde lleva; «¿Cuánto cuesta?» a secas no es un hueco.
  insert into permisos_rol (rol, modulo, nivel) values ('compras', 'catalogo', 3)
  on conflict (rol, modulo) do update set nivel = 3;
  v_cmp := pg_temp.usuario('cmp261@hegamex.com', '{compras}');
  assert not exists (select 1 from revision_r_preguntas_sin_respuesta() h where v_cmp = any (h.responsables)),
    'quien administra el catálogo pero NO puede abrir «Lo que dicen las llamadas» NO debe recibir el hallazgo';
  assert exists (select 1 from revision_r_preguntas_sin_respuesta() h where v_dir = any (h.responsables)), 'dirección sí';
  for i in 1..3 loop
    perform pg_temp.foto('CA261-C' || i, jsonb_build_object('telefono', '+52555000269' || i, 'inicio', t0, 'nadie_contesto', false),
      jsonb_build_object('analisis', jsonb_build_object('preguntas_sin_respuesta', jsonb_build_array(case i when 1 then '¿Cuánto cuesta?' when 2 then '¿Cuál es el precio?' else '¿Me da precio?' end))));
  end loop;
  assert not exists (select 1 from revision_r_preguntas_sin_respuesta() h where h.huella = 'preguntas_sin_respuesta:' || md5('precio')),
    '«¿Cuánto cuesta?» a secas NO debe salir como hueco del catálogo';
  assert llamada_texto_clave('¿Me da precio de la banda?') = llamada_texto_clave('¿Cuánto cuesta la banda?'),
    'pedir precio con «me da» es la misma pregunta: ' || llamada_texto_clave('¿Me da precio de la banda?');
end $$;

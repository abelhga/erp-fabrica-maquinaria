-- Teléfono, fase 4: lo que el vendedor contesta por WhatsApp se aplica en el ERP como si él lo
-- hubiera capturado, con las mismas reglas, una sola vez por mensaje, y la sesión de quien llama
-- regresa intacta. Y los «NO debe poder»: un número no ligado no mueve nada (queda en «Quién
-- contesta»), un vendedor no toca el lead de otro, «no respondió» antes de tiempo no pasa, una
-- sesión no llama a telefono_accion ni a telefono_resumen, y almacén no pregunta por llamadas.

-- Esta prueba no es de partidas libres (256): una partida sin artículo pediría autorización.
update configuracion set valor = valor || '{"desde": "2999-01-01"}' where clave = 'partidas_libres';
update configuracion set valor = valor || '{"modo": "bandeja", "vendedores": []}' where clave = 'leads';

-- Un mensaje de WhatsApp como lo manda el conmutador (versión 1), llamado como la función de borde.
create function pg_temp.wa(p_id text, p_tel text, p_lead uuid, p_accion text, p_texto text default null,
  p_motivo text default null, p_cuando timestamptz default null, p_canal text default null, p_sid text default null)
returns jsonb language sql as $$
  select public.telefono_accion(jsonb_build_object('version', 1, 'tipo', 'accion', 'id', p_id,
    'quien', jsonb_build_object('telefono', p_tel, 'nombre', 'Vendedor de WhatsApp 262'),
    'lead', jsonb_build_object('erp_id', p_lead, 'call_sid', p_sid), 'accion', p_accion, 'texto', p_texto,
    'motivo', p_motivo, 'cuando', p_cuando, 'canal', p_canal))
$$;
-- Corre algo y regresa «sqlstate mensaje» si falló (lo de adentro se deshace), o null si pasó.
create function pg_temp.falla262(p_sql text) returns text
language plpgsql as $$
begin
  execute p_sql;
  return null;
exception when others then return sqlstate || ' ' || sqlerrm;
end $$;
grant execute on function pg_temp.wa(text, text, uuid, text, text, text, timestamptz, text, text), pg_temp.falla262(text) to public;

do $$
declare
  v_a uuid; v_b uuid; v_c uuid; v_dir uuid; v_rec uuid; v_alm uuid;
  l1 uuid; l2 uuid; l3 uuid; l4 uuid; l5 uuid; lb uuid; v_cli uuid; v_op uuid; v_cot uuid;
  r jsonb; r2 jsonb; v_err text; v_folio text; v_n int; v_int uuid; v_txt text; f record;
  tel_a text := '+52 33 1111 2621';      -- el de su perfil: se reconoce sin ligar nada
  tel_b text := '+52 1 33 2222 2622';    -- su WhatsApp, ligado en «Quién contesta»
  tel_x text := '+52 55 9999 2629';      -- nadie
  sid_ll text := 'CA262-' || gen_random_uuid();
  en_dos_dias timestamptz := (hoy_mx() + 2 + time '10:30') at time zone 'America/Mexico_City';
begin
  v_a := pg_temp.usuario('vena262@hegamex.com', '{ventas}');
  v_b := pg_temp.usuario('venb262@hegamex.com', '{ventas}');
  v_c := pg_temp.usuario('venc262@hegamex.com', '{ventas}');
  v_dir := pg_temp.usuario('dir262@hegamex.com', '{direccion}');
  v_rec := pg_temp.usuario('rec262@hegamex.com', '{recepcion}');
  v_alm := pg_temp.usuario('alm262@hegamex.com', '{almacen}');
  update perfiles set nombre = 'Ana Vendedora 262', telefono = '33 1111 2621' where id = v_a;
  update perfiles set nombre = 'Beto Vendedor 262' where id = v_b;
  update perfiles set telefono = '33 1111 2623' where id = v_c;
  update perfiles set telefono = '33 1111 2624' where id = v_dir;
  insert into telefono_directorio (clave, nombre, telefono, perfil_id, ligado_por, ligado_en)
  values ('3322222622', 'Beto WhatsApp', tel_b, v_b, v_dir, now());

  -- Leads: l1 y l4 de Ana, lb de Beto, l2 y l3 por tomar (bandeja).
  insert into leads (nombre, telefono, interes) values ('Rosa Lead 262', '5550002621', 'Tolva de 5 m3') returning id into l1;
  insert into leads (nombre, telefono, interes) values ('Pedro Bandeja 262', '5550002622', 'Banda 10 m') returning id into l2;
  insert into leads (nombre, telefono, interes) values ('Lupe Bandeja 262', '5550002623', 'Cribadora') returning id into l3;
  insert into leads (nombre, telefono, interes) values ('Mario Pierde 262', '5550002624', 'Elevador') returning id into l4;
  insert into leads (nombre, telefono, interes) values ('Lead De Beto 262', '5550002625', 'Silo') returning id into lb;
  update leads set estado = 'asignado', vendedor_id = v_a, como_se_asigno = 'gerente', asignado_en = now() where id in (l1, l4);
  update leads set estado = 'asignado', vendedor_id = v_b, como_se_asigno = 'gerente', asignado_en = now() where id = lb;

  -- =========================================================================
  -- 0. Solo la función de borde
  -- =========================================================================
  perform pg_temp.como(v_dir);
  v_err := pg_temp.falla262(format('select telefono_accion(%L::jsonb)', jsonb_build_object('version', 1)));
  assert v_err like '42501%', 'una sesión (aunque sea dirección) no debe poder llamar a telefono_accion: ' || coalesce(v_err, 'pasó');
  v_err := pg_temp.falla262(format('select telefono_resumen(%L)', tel_a));
  assert v_err like '42501%', 'una sesión no debe poder pedir el resumen de otro: ' || coalesce(v_err, 'pasó');
  v_err := pg_temp.falla262(format('select _telefono_aplicar(''nota'', %L, ''x'', null, null, null)', l1));
  assert v_err like '42501%', 'una sesión no debe poder aplicar acciones sin pasar por la puerta: ' || coalesce(v_err, 'pasó');
  v_err := pg_temp.falla262(format('select _telefono_perfil_de(%L)', tel_a));
  assert v_err like '42501%', 'una sesión no debe poder buscar perfiles por teléfono: ' || coalesce(v_err, 'pasó');

  -- =========================================================================
  -- 1. La forma del cuerpo es 22023 (la función de borde contesta 400)
  -- =========================================================================
  perform pg_temp.como_postgres();
  assert pg_temp.falla262($q$select telefono_accion('{"version":2,"tipo":"accion"}')$q$) like '22023 Versión%', 'aceptó otra versión';
  assert pg_temp.falla262($q$select telefono_accion('{"version":1,"tipo":"accion","quien":{"telefono":"3311112621"},"lead":{"erp_id":null,"call_sid":"CA1"},"accion":"tomar"}')$q$)
    like '22023 id%', 'aceptó sin id';
  assert pg_temp.falla262(format('select pg_temp.wa(''SM262-forma'', %L, %L, ''bailar'')', tel_a, l1)) like '22023 Acción no soportada%', 'aceptó una acción que no existe';
  assert pg_temp.falla262(format('select pg_temp.wa(''SM262-forma'', %L, null, ''nota'', ''x'')', tel_a)) like '22023 lead necesita%', 'aceptó sin lead';
  assert pg_temp.falla262(format('select pg_temp.wa(''SM262-forma'', ''123'', %L, ''nota'', ''x'')', l1)) like '22023 quien.telefono%', 'aceptó un teléfono corto';
  assert pg_temp.falla262(format('select pg_temp.wa(''SM262-forma'', %L, %L, ''nota'', ''x'', null, null, ''fax'')', tel_a, l1)) like '22023 canal%', 'aceptó canal fax';
  assert pg_temp.falla262(format($q$select telefono_accion(%L::jsonb)$q$, jsonb_build_object('version', 1, 'tipo', 'accion', 'id', 'SM262-forma',
    'quien', jsonb_build_object('telefono', tel_a), 'lead', jsonb_build_object('erp_id', l1), 'accion', 'recordar', 'cuando', 'el jueves')))
    like '22023 cuando%', 'aceptó una fecha que no es fecha';
  assert pg_temp.falla262(format($q$select telefono_accion(%L::jsonb)$q$, jsonb_build_object('version', 1, 'tipo', 'accion', 'id', 'SM262-forma',
    'quien', jsonb_build_object('telefono', tel_a), 'lead', jsonb_build_object('erp_id', 'no-es-uuid'), 'accion', 'nota')))
    like '22023 lead.erp_id%', 'aceptó un erp_id que no es uuid';
  assert not exists (select 1 from telefono_acciones where id = 'SM262-forma'), 'un cuerpo mal hecho no se guarda como respuesta';

  -- =========================================================================
  -- 2. «Contactado» como Ana: el intento a su nombre, y la sesión de quien llama regresa
  -- =========================================================================
  -- Quien llama trae su propia sesión (aquí, la de almacén): después de aplicar, sigue siendo esa.
  perform set_config('request.jwt.claims', json_build_object('sub', v_alm, 'role', 'authenticated')::text, true);

  -- Sin lo que dijo, no pasa: la misma regla que la pantalla.
  r := pg_temp.wa('SM262-1', tel_a, l1, 'contactado');
  assert r->>'aplicado' = 'false' and r->>'mensaje' like 'Escribe qué te dijo%', '«contactado» sin nota pasó: ' || r::text;
  assert auth.uid() = v_alm, 'después de un error la sesión no regresó: ' || coalesce(auth.uid()::text, 'nadie');
  assert not exists (select 1 from lead_intentos where lead_id = l1), 'quedó un intento sin nota';

  r := pg_temp.wa('SM262-2', tel_a, l1, 'contactado', 'Le interesa la de 20 m, quiere precio esta semana');
  assert r->>'aplicado' = 'true' and r->>'ok' = 'true' and r->>'mensaje' like 'Anotado: Rosa Lead 262 contestó%', '«contactado» no se aplicó: ' || r::text;
  assert r->'lead'->>'id' = l1::text and r->'lead'->>'estado' = 'asignado' and r->>'ruta' = '/ventas/leads?id=' || l1, 'la respuesta no trae el lead: ' || r::text;
  assert auth.uid() = v_alm, 'después de aplicar, la sesión no regresó: ' || coalesce(auth.uid()::text, 'nadie');
  assert coalesce(current_setting('hegamex.via', true), '') = '', 'la marca «por WhatsApp» se quedó puesta';
  select id into v_int from lead_intentos where lead_id = l1;
  assert (select usuario_id = v_a and canal = 'llamada' and resultado = 'contesto' and via = 'whatsapp'
          and nota = 'Le interesa la de 20 m, quiere precio esta semana' from lead_intentos where id = v_int),
    'el intento no quedó a nombre de Ana, por llamada y por WhatsApp';
  assert (select usuario_id from bitacora where tabla = 'lead_intentos' and registro_id = v_int::text and accion = 'alta') = v_a,
    'la bitácora no dice que fue Ana';

  -- El mismo mensaje otra vez (reintento del conmutador): la misma respuesta y un solo intento.
  r2 := pg_temp.wa('SM262-2', tel_a, l1, 'contactado', 'Le interesa la de 20 m, quiere precio esta semana');
  assert r2 = r, 'el reintento no regresó la misma respuesta';
  assert (select count(*) from lead_intentos where lead_id = l1) = 1, 'el reintento duplicó el intento';
  assert (select count(*) from telefono_acciones where id = 'SM262-2') = 1, 'el mensaje se guardó dos veces';

  -- En la pantalla (sin WhatsApp) el intento no dice «por WhatsApp».
  perform pg_temp.como(v_a);
  perform registrar_intento_lead(l4, 'llamada', 'no_contesto');
  assert (select via from lead_intentos where lead_id = l4) is null, 'un intento de la pantalla salió como de WhatsApp';
  perform pg_temp.como_postgres();
  perform set_config('request.jwt.claims', json_build_object('sub', v_alm, 'role', 'authenticated')::text, true);

  -- «No contestó» por WhatsApp es «Le escribí»; por llamada, «No contestó».
  r := pg_temp.wa('SM262-3', tel_a, l4, 'no_contesto', null, null, null, 'whatsapp');
  assert r->>'aplicado' = 'true' and r->>'mensaje' like 'Anotado: le escribiste%', 'no_contesto por WhatsApp: ' || r::text;
  r := pg_temp.wa('SM262-4', tel_a, l4, 'no_contesto');
  assert r->>'aplicado' = 'true' and r->>'mensaje' like '%no contestó%', 'no_contesto: ' || r::text;
  assert (select array_agg(resultado order by en) from lead_intentos where lead_id = l4) = array['no_contesto', 'enviado', 'no_contesto'],
    'los intentos de l4 no son los esperados';

  -- =========================================================================
  -- 3. Lo que NO debe pasar
  -- =========================================================================
  -- Un número que nadie ligó no mueve nada, se lo dice, y queda en «Quién contesta» sin persona.
  r := pg_temp.wa('SM262-5', tel_x, l1, 'perdido', 'Ya compró', 'Compró con otro');
  assert r->>'aplicado' = 'false' and r->'lead' = 'null'::jsonb
    and r->>'mensaje' = 'Tu número no está ligado en el ERP; pídele a dirección que lo ligue en Configuración → Integraciones → Teléfono',
    'un número no ligado: ' || r::text;
  assert (select estado from leads where id = l1) = 'asignado', 'un número no ligado movió el lead';
  assert exists (select 1 from telefono_directorio where clave = '5599992629' and perfil_id is null and nombre = 'Vendedor de WhatsApp 262'),
    'el número no ligado no quedó en el directorio';
  assert (select perfil_id from telefono_acciones where id = 'SM262-5') is null, 'se guardó un perfil para un número no ligado';

  -- Beto (ligado por su WhatsApp) no toca el lead de Ana, ni se entera de cómo se llama.
  r := pg_temp.wa('SM262-6', tel_b, l1, 'nota', 'Ya le hablé yo');
  assert r->>'aplicado' = 'false' and r->'lead' = 'null'::jsonb and r->>'mensaje' like 'Ese lead es de otro vendedor%', 'Beto tocó el lead de Ana: ' || r::text;
  assert r::text not like '%Rosa Lead%', 'a Beto le dijo el nombre del lead de Ana';
  r := pg_temp.wa('SM262-7', tel_b, l1, 'perdido', null, 'Precio');
  assert r->>'aplicado' = 'false' and (select estado from leads where id = l1) = 'asignado', 'Beto descartó el lead de Ana';
  assert (select count(*) from lead_intentos where lead_id = l1) = 1 and (select notas from leads where id = l1) is null, 'Beto dejó algo en el lead de Ana';

  -- Un perfil dado de baja no actúa aunque su número siga ligado.
  insert into telefono_directorio (clave, nombre, telefono, perfil_id) values ('3311112623', 'Carlos 262', '3311112623', v_c);
  perform set_config('request.jwt.claims', json_build_object('sub', v_dir, 'role', 'authenticated')::text, true);
  update perfiles set activo = false where id = v_c;
  perform set_config('request.jwt.claims', json_build_object('sub', v_alm, 'role', 'authenticated')::text, true);
  r := pg_temp.wa('SM262-8', '+52 33 1111 2623', l1, 'nota', 'Nota de alguien de baja');
  assert r->>'aplicado' = 'false' and r->>'mensaje' like '%dado de baja%', 'un perfil inactivo actuó: ' || r::text;

  -- Dirección viendo el ERP como otro rol: no se le suplanta a media simulación.
  insert into simulacion_rol (usuario_id, rol) values (v_dir, 'ventas');
  r := pg_temp.wa('SM262-9', '+52 33 1111 2624', l1, 'nota', 'Nota desde dirección');
  assert r->>'aplicado' = 'false' and r->>'mensaje' like '%Ver como%', 'se suplantó a dirección simulando: ' || r::text;
  delete from simulacion_rol where usuario_id = v_dir;

  -- Un lead que no existe.
  r := pg_temp.wa('SM262-10', tel_a, gen_random_uuid(), 'nota', 'Nota perdida');
  assert r->>'aplicado' = 'false' and r->>'mensaje' like 'No encontré ese lead%', 'un lead que no existe: ' || r::text;
  assert auth.uid() = v_alm, 'la sesión cambió en el camino';

  -- =========================================================================
  -- 4. Las demás acciones
  -- =========================================================================
  -- Nota: una línea con fecha, quién y «por WhatsApp» en las notas del lead.
  r := pg_temp.wa('SM262-11', tel_a, l1, 'nota', 'Pidió que le mande fotos de la tolva');
  assert r->>'aplicado' = 'true', 'la nota no se aplicó: ' || r::text;
  assert (select notas from leads where id = l1) like fecha_texto(hoy_mx()) || ' __:__ · Ana Vendedora 262, por WhatsApp: Pidió que le mande fotos de la tolva',
    'la nota no quedó con fecha, quién y por WhatsApp: ' || coalesce((select notas from leads where id = l1), 'nada');

  -- Recordar: un pendiente suyo para ese día, ligado al lead; sin fecha o con fecha pasada, no.
  r := pg_temp.wa('SM262-12', tel_a, l1, 'recordar', 'Mandarle la cotización');
  assert r->>'aplicado' = 'false' and r->>'mensaje' like '¿Para cuándo%', 'recordar sin fecha: ' || r::text;
  r := pg_temp.wa('SM262-13', tel_a, l1, 'recordar', 'Mandarle la cotización', null, now() - interval '3 days');
  assert r->>'aplicado' = 'false' and r->>'mensaje' like '%ya pasó%', 'recordar en el pasado: ' || r::text;
  r := pg_temp.wa('SM262-14', tel_a, l1, 'recordar', 'Mandarle la cotización', null, en_dos_dias);
  assert r->>'aplicado' = 'true' and r->>'mensaje' like '%' || fecha_texto(hoy_mx() + 2) || ' a las 10:30%', 'recordar: ' || r::text;
  assert (select count(*) from pendientes where responsable_id = v_a and creado_por = v_a and vence = hoy_mx() + 2 and tabla = 'leads'
          and registro_id = l1::text and ruta = '/ventas/leads?id=' || l1 and titulo = 'Rosa Lead 262: Mandarle la cotización'
          and detalle = 'Lo pediste por WhatsApp · a las 10:30') = 1, 'el pendiente no quedó para Ana, ese día y ligado al lead';

  -- Tomar (bandeja): Beto se queda con l2; otra vez, ya es suyo.
  r := pg_temp.wa('SM262-15', tel_b, l2, 'tomar');
  assert r->>'aplicado' = 'true', 'tomar: ' || r::text;
  assert (select estado = 'asignado' and vendedor_id = v_b and como_se_asigno = 'bandeja' and asignado_por = v_b from leads where id = l2), 'l2 no quedó de Beto';
  r := pg_temp.wa('SM262-16', tel_b, l2, 'tomar');
  assert r->>'aplicado' = 'false' and r->>'mensaje' like '%ya es tuyo%', 'tomar dos veces: ' || r::text;
  r := pg_temp.wa('SM262-17', tel_a, l2, 'tomar');
  assert r->>'aplicado' = 'false' and r->'lead' = 'null'::jsonb, 'Ana tomó el lead que ya era de Beto: ' || r::text;

  -- «Contactado» por un lead que nadie ha tomado (bandeja) lo toma y anota, todo junto.
  r := pg_temp.wa('SM262-18', tel_a, l3, 'contactado', 'Quiere una cribadora para arena, la necesita en diciembre');
  assert r->>'aplicado' = 'true' and r->>'mensaje' like 'Lo tomaste%', 'contactado en la bandeja: ' || r::text;
  assert (select estado = 'asignado' and vendedor_id = v_a from leads where id = l3) and exists (select 1 from lead_intentos where lead_id = l3 and usuario_id = v_a),
    'l3 no quedó de Ana con su intento';

  -- Cotizado, cerrado y soltar no se capturan por WhatsApp: dicen qué hacer y dónde.
  r := pg_temp.wa('SM262-19', tel_a, l1, 'cotizado');
  assert r->>'aplicado' = 'false' and r->>'ruta' = '/ventas/leads?id=' || l1 and r->>'mensaje' like 'Para cotizar, primero vuélvelo oportunidad%', 'cotizado: ' || r::text;
  r := pg_temp.wa('SM262-20', tel_a, l1, 'cerrado');
  assert r->>'aplicado' = 'false' and r->>'mensaje' like 'Los pedidos se capturan en el ERP%', 'cerrado: ' || r::text;
  r := pg_temp.wa('SM262-21', tel_a, l1, 'soltar');
  assert r->>'aplicado' = 'false' and r->>'mensaje' like '%pídele a la gerencia de ventas que lo reasigne%', 'soltar: ' || r::text;
  assert (select vendedor_id from leads where id = l1) = v_a, 'soltar movió el lead';

  -- Perdido de un lead: se descarta con su motivo (sin motivo ni texto, no).
  r := pg_temp.wa('SM262-22', tel_a, l4, 'perdido');
  assert r->>'aplicado' = 'false' and r->>'mensaje' like 'Anota por qué se descarta%', 'perdido sin motivo: ' || r::text;
  assert auth.uid() = v_alm, 'después de un error del descarte la sesión no regresó';
  r := pg_temp.wa('SM262-23', tel_a, l4, 'perdido', 'Ya lo compró en otro lado', 'Compró con la competencia');
  assert r->>'aplicado' = 'true' and r->'lead'->>'estado' = 'descartado', 'perdido: ' || r::text;
  assert (select motivo_descarte from leads where id = l4) = 'Compró con la competencia: Ya lo compró en otro lado', 'el motivo del descarte no quedó';

  -- =========================================================================
  -- 5. Ya oportunidad: el seguimiento, con «no respondió» y «decidir»
  -- =========================================================================
  perform pg_temp.como(v_a);
  v_op := convertir_lead(l1);
  select cliente_id into v_cli from leads where id = l1;
  v_cot := nueva_cotizacion(v_cli, v_op);
  insert into cotizacion_lineas (cotizacion_id, titulo, precio_unitario) values (v_cot, 'Tolva 262', 98765.43);
  update cotizaciones set estado = 'enviada' where id = v_cot;
  perform pg_temp.como_postgres();
  perform set_config('request.jwt.claims', json_build_object('sub', v_alm, 'role', 'authenticated')::text, true);

  -- La nota ya va a la bitácora comercial de la oportunidad.
  r := pg_temp.wa('SM262-24', tel_a, l1, 'nota', 'Va a revisar con su socio');
  assert r->>'aplicado' = 'true' and exists (select 1 from actividades where oportunidad_id = v_op and tipo = 'nota'
    and descripcion = 'Va a revisar con su socio (por WhatsApp)' and usuario_id = v_a), 'la nota no llegó a la oportunidad: ' || r::text;

  -- Recién enviada: «no respondió» no entra, y el mensaje es el de la regla (255).
  r := pg_temp.wa('SM262-25', tel_a, l1, 'perdido', 'No me contesta', 'No respondió');
  assert r->>'aplicado' = 'false' and r->>'mensaje' like 'Todavía no se puede dar por perdida porque no respondió%hacen falta 2 «No contestó»%'
    and r->>'mensaje' like '%Mándame «no contestó»%', '«no respondió» antes de tiempo: ' || r::text;
  assert (select etapa from oportunidades where id = v_op) <> 'perdida' and (select estado from cotizaciones where id = v_cot) = 'enviada',
    'la regla de «no respondió» no frenó por WhatsApp';

  -- Al tercero sin avance hay que decidir: por WhatsApp no se puede, dice qué hacer y dónde.
  update cotizaciones set enviada_en = now() - interval '20 days' where id = v_cot;
  insert into seguimientos_cotizacion (oportunidad_id, vendedor_id, vence, estado, resultado, que_paso, creado_en, cerrado_en) values
    (v_op, v_a, hoy_mx() - 2, 'hecho', 'sigue', 'Lo está viendo', now() - interval '3 days', now() - interval '2 days'),
    (v_op, v_a, hoy_mx() - 1, 'hecho', 'no_contesta', 'No contestó', now() - interval '2 days', now() - interval '1 day');
  r := pg_temp.wa('SM262-26', tel_a, l1, 'no_contesto');
  assert r->>'aplicado' = 'false' and r->>'mensaje' like 'Ya van 3 seguimientos seguidos sin avance%Eso se decide en el ERP:'
    and r->>'ruta' = '/ventas/leads?id=' || l1, 'decidir: ' || r::text;
  assert auth.uid() = v_alm, 'después de «decidir» la sesión no regresó';

  -- Ya con los días cumplidos, «no respondió» sí pasa y la venta queda perdida a nombre de Ana.
  r := pg_temp.wa('SM262-27', tel_a, l1, 'perdido', null, 'No respondió');
  assert r->>'aplicado' = 'true' and r->'lead'->>'etapa' = 'perdida', 'perdido con los días cumplidos: ' || r::text;
  assert (select etapa = 'perdida' and motivo_perdida = 'No respondió' from oportunidades where id = v_op), 'la oportunidad no quedó perdida';
  assert exists (select 1 from actividades where oportunidad_id = v_op and tipo = 'whatsapp' and usuario_id = v_a and descripcion like 'Se perdió (No respondió)%'),
    'la pérdida no quedó en la bitácora comercial a nombre de Ana por WhatsApp';

  -- =========================================================================
  -- 6. El lead por la llamada (call_sid) y el resumen de la mañana
  -- =========================================================================
  -- Una llamada que atendió Ana deja su lead; otra que nadie contestó, de otro lead suyo. Sin sesión,
  -- como las manda la función de borde.
  perform pg_temp.como_postgres();
  perform telefono_registrar_evento(jsonb_build_object('version', 1, 'tipo', 'llamada', 'call_sid', sid_ll,
    'llamada', jsonb_build_object('telefono', '+52 55 5000 2626', 'inicio', now() - interval '2 hours', 'nadie_contesto', false,
                                  'atendio', jsonb_build_object('nombre', 'Ana', 'telefono', tel_a)),
    'lead', jsonb_build_object('nombre', 'Lalo Llamada 262', 'interes', 'Banda con presupuesto de $45,000')));
  select id into l5 from leads where llamada_id = (select id from llamadas where call_sid = sid_ll);
  assert (select vendedor_id from leads where id = l5) = v_a, 'el lead de la llamada no quedó de Ana';
  perform telefono_registrar_evento(jsonb_build_object('version', 1, 'tipo', 'llamada', 'call_sid', sid_ll || '-b',
    'llamada', jsonb_build_object('telefono', '+52 55 7000 2627', 'inicio', now() - interval '30 minutes', 'nadie_contesto', true),
    'lead', jsonb_build_object('nombre', 'Nora Sin Contestar 262', 'interes', 'Silo', 'telefono', '+52 55 7000 2627')));
  update leads set estado = 'asignado', vendedor_id = v_a where nombre = 'Nora Sin Contestar 262';
  insert into pendientes (titulo, responsable_id, creado_por, vence) values ('Cobrarle $5,000 a Lalo', v_a, v_a, hoy_mx() - 1);
  -- Otra cotización enviada al mismo cliente, con su seguimiento vencido desde ayer.
  perform pg_temp.como(v_a);
  v_cot := nueva_cotizacion(v_cli, null);
  insert into cotizacion_lineas (cotizacion_id, titulo, precio_unitario) values (v_cot, 'Banda 262', 98765.43);
  update cotizaciones set estado = 'enviada' where id = v_cot;
  perform pg_temp.como_postgres();
  select folio into v_folio from cotizaciones where id = v_cot;
  update seguimientos_cotizacion set vence = hoy_mx() - 1 where cotizacion_id = v_cot and estado = 'pendiente';
  assert found, 'la cotización enviada no programó su seguimiento';
  perform set_config('request.jwt.claims', json_build_object('sub', v_alm, 'role', 'authenticated')::text, true);

  r := telefono_resumen(tel_a);
  v_txt := r->>'texto';
  assert r->>'vendedor' = 'Ana Vendedora 262' and r->>'ruta' = '/ventas/para-llamar', 'el resumen no es de Ana: ' || r::text;
  assert v_txt like 'Buenos días, Ana.%' and v_txt like '%*Leads sin contactar (2):* %Lalo Llamada 262%'
    and v_txt like '%*Regresar llamada (1):* Nora Sin Contestar 262 (hace 30 min)%'
    and v_txt like '%*Seguimiento de cotizaciones (1, 1 vencido):* Rosa Lead 262 ' || v_folio || ', venció ' || fecha_texto(hoy_mx() - 1) || '%'
    and v_txt not like '%Mandarle%', 'el resumen no trae lo de Ana: ' || v_txt;
  assert v_txt like '%*Pendientes (1):* Cobrarle $… a Lalo (era para el ' || fecha_texto(hoy_mx() - 1) || ')%', 'el pendiente vencido no salió (o salió con monto): ' || v_txt;
  assert v_txt not like '%Lead De Beto%' and v_txt not like '%Pedro Bandeja%', 'en el resumen de Ana salió lo de Beto: ' || v_txt;
  assert v_txt !~ '\$\s*[0-9]' and v_txt not like '%98765%' and v_txt not like '%45,000%' and length(v_txt) <= 1400, 'el resumen trae montos o es muy largo: ' || v_txt;
  r := telefono_resumen(tel_x);
  assert r = '{"ok": true, "texto": null, "vendedor": null}'::jsonb, 'un número no ligado tuvo resumen: ' || r::text;
  r := telefono_resumen('+52 55 0000 0000');
  assert r->>'texto' is null, 'un número de nadie tuvo resumen';

  -- Por el call_sid (sin erp_id) se encuentra el lead de la llamada.
  r := pg_temp.wa('SM262-28', tel_a, null, 'contactado', 'Sí le interesa, le mando fotos', null, null, null, sid_ll);
  assert r->>'aplicado' = 'true' and r->'lead'->>'id' = l5::text, 'por call_sid no encontró el lead: ' || r::text;
  r := telefono_resumen(tel_a);
  assert r->>'texto' like '%*Leads sin contactar (1):*%', 'el intento por WhatsApp no sacó al lead de «sin contactar»: ' || (r->>'texto');

  -- =========================================================================
  -- 7. «Ya entró por teléfono» al registrar un lead a mano
  -- =========================================================================
  perform pg_temp.como(v_rec);
  select * into f from llamada_reciente_de('55 5000 2626');
  assert f.lead_id = l5 and f.lead_nombre = 'Lalo Llamada 262' and f.vendedor = 'Ana Vendedora 262' and f.estado = 'asignado'
    and not f.nadie_contesto and f.cuando > now() - interval '3 hours' and not f.lo_ves, 'recepción no vio la llamada (o la puede abrir): ' || row_to_json(f)::text;
  assert not exists (select 1 from llamada_reciente_de('55 0000 0000')), 'un número que no llamó salió';
  assert not exists (select 1 from llamada_reciente_de('123')), 'un número corto salió';
  perform pg_temp.como(v_a);
  assert (select lo_ves from llamada_reciente_de('+52 55 5000 2626') limit 1), 'Ana no puede abrir su propio lead desde el aviso';
  perform pg_temp.como(v_alm);
  v_err := pg_temp.falla262('select * from llamada_reciente_de(''5550002626'')');
  assert v_err like '42501%', 'almacén no debe poder preguntar por llamadas: ' || coalesce(v_err, 'pasó');
  perform pg_temp.como_postgres();
end $$;

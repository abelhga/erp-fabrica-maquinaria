-- Teléfono, fase 1: cada foto de una llamada del conmutador entra una sola vez, se liga al cliente
-- por los últimos 10 dígitos, deja su lead y su actividad una vez, y lo que nadie contestó sale en
-- «Regresar llamada» para el dueño hasta que se regresa, se anota un intento o vuelve a llamar.
-- Y los «NO debe poder»: otro vendedor no ve llamadas ajenas, almacén no ve nada, una sesión no
-- registra eventos y solo dirección genera la llave.

-- Una foto como la manda el conmutador (versión 1). Se llama como postgres: en la nube la llama
-- la función de borde con la llave de servicio, sin usuario.
create or replace function pg_temp.foto(p_sid text, p_llamada jsonb, p_lead jsonb default null, p_enviado timestamptz default now())
returns jsonb language sql as $$
  select public.telefono_registrar_evento(jsonb_build_object('version', 1, 'tipo', 'llamada', 'call_sid', p_sid,
    'enviado_en', p_enviado, 'llamada', p_llamada, 'lead', p_lead))
$$;

do $$
declare v_adm uuid; v_a uuid; v_b uuid; v_c uuid; v_dir uuid; v_rec uuid; v_alm uuid; v_ger uuid;
  v_cli uuid; v_llave text; v_llave2 text; r jsonb; r2 jsonb; l record; v_ok boolean; v_n int; v_err text;
  e1 uuid; e2 uuid; e3 uuid; e4 uuid; e5 uuid; e7 uuid; e8 uuid; e9 uuid; v_l7 uuid; v_l8 uuid;
  t0 timestamptz := now() - interval '3 hours';
begin
  v_a := pg_temp.usuario('vena258@hegamex.com', '{ventas}');
  v_b := pg_temp.usuario('venb258@hegamex.com', '{ventas}');
  v_c := pg_temp.usuario('venc258@hegamex.com', '{ventas}');
  v_dir := pg_temp.usuario('dir258@hegamex.com', '{direccion}');
  v_rec := pg_temp.usuario('rec258@hegamex.com', '{recepcion}');
  v_alm := pg_temp.usuario('alm258@hegamex.com', '{almacen}');
  v_ger := pg_temp.usuario('ger258@hegamex.com', '{gerente_ventas}');
  update perfiles set telefono = '33 1111 2581' where id = v_a;   -- el conmutador lo manda con +52
  update configuracion set valor = valor || '{"modo": "bandeja", "vendedores": []}' where clave = 'leads';
  insert into clientes (nombre, vendedor_id) values ('Agregados 258', v_b) returning id into v_cli;
  insert into contactos (cliente_id, nombre, telefono) values (v_cli, 'Juan 258', '818 000 2582');

  -- =========================================================================
  -- 0. La llave y quién puede registrar
  -- =========================================================================
  perform pg_temp.como(v_a);
  v_ok := false;
  begin perform telefono_registrar_evento('{"version":1,"tipo":"llamada","call_sid":"CA258x","llamada":{}}'); v_ok := true;
  exception when insufficient_privilege then null; end;
  assert not v_ok, 'una sesión normal no debe poder registrar eventos del teléfono';
  v_ok := false;
  begin perform telefono_generar_llave(); v_ok := true; exception when insufficient_privilege then null; end;
  assert not v_ok, 'un vendedor no debe poder generar la llave';
  v_ok := false;
  begin perform estado_telefono(); v_ok := true; exception when insufficient_privilege then null; end;
  assert not v_ok, 'un vendedor no debe ver la conexión del teléfono';
  v_ok := false;
  begin perform telefono_llave_valida('x'); v_ok := true; exception when insufficient_privilege then null; end;
  assert not v_ok, 'una sesión no debe poder probar llaves';

  perform pg_temp.como(v_dir);
  v_llave := telefono_generar_llave();
  assert length(v_llave) >= 32, 'la llave debe tener 32 caracteres o más';
  assert (estado_telefono()->>'tiene_llave')::boolean, 'estado_telefono no ve la llave';
  assert estado_telefono()::text not like '%' || v_llave || '%', 'estado_telefono nunca regresa la llave';
  perform pg_temp.como_postgres();
  assert telefono_llave_valida(v_llave), 'la llave recién generada no sirve';
  assert not telefono_llave_valida(left(v_llave, 31)), 'una llave corta no debe servir';
  assert (select llave_huella from telefono_cuenta) <> v_llave, 'la llave no se guarda tal cual';
  perform pg_temp.como(v_dir);
  v_llave2 := telefono_generar_llave();
  perform pg_temp.como_postgres();
  assert not telefono_llave_valida(v_llave) and telefono_llave_valida(v_llave2), 'al cambiarla, la anterior debe dejar de servir';

  -- =========================================================================
  -- 1. Atendida por un vendedor, número que no es cliente, con lead
  -- =========================================================================
  r := pg_temp.foto('CA258-1', jsonb_build_object('telefono', '+528180002581', 'inicio', t0, 'fin', t0 + interval '4 minutes',
         'duracion_seg', 240, 'estado', 'completed', 'area', 'ventas', 'area_nombre', 'Ventas',
         'atendio', jsonb_build_object('nombre', 'Vendedor A', 'telefono', '+523311112581'), 'nadie_contesto', false,
         'resumen', 'Busca una banda de 20 m para grava', 'transcripcion', 'texto completo que no se guarda'),
       '{"id_voz": 1, "nombre": "Pedro 258", "empresa": "Gravas 258", "telefono": "+528180002581", "interes": "Banda transportadora 20 m", "detalle": "60 t/h"}',
       t0 + interval '5 minutes');
  e1 := (r->>'llamada_id')::uuid;
  assert r->>'ok' = 'true' and r->>'lead_id' is not null and r->'cliente_id' = 'null', format('respuesta 1: %s', r);
  -- La misma foto otra vez: nada nuevo.
  r2 := pg_temp.foto('CA258-1', jsonb_build_object('telefono', '+528180002581', 'inicio', t0, 'fin', t0 + interval '4 minutes',
         'duracion_seg', 240, 'estado', 'completed', 'area', 'ventas', 'area_nombre', 'Ventas',
         'atendio', jsonb_build_object('nombre', 'Vendedor A', 'telefono', '+523311112581'), 'nadie_contesto', false,
         'resumen', 'Busca una banda de 20 m para grava'),
       '{"id_voz": 1, "nombre": "Pedro 258", "empresa": "Gravas 258", "telefono": "+528180002581", "interes": "Banda transportadora 20 m", "detalle": "60 t/h"}',
       t0 + interval '5 minutes');
  assert r2 = r, format('la misma foto dos veces debe contestar lo mismo: %s / %s', r, r2);
  assert (select count(*) from llamadas where call_sid = 'CA258-1') = 1, 'la misma llamada quedó dos veces';
  assert (select count(*) from leads where llamada_id = e1) = 1, 'la misma llamada dejó dos leads';
  select * into l from leads where id = (r->>'lead_id')::uuid;
  assert l.vendedor_id = v_a and l.como_se_asigno = 'llamada' and l.estado = 'asignado', format('el lead debía ser de quien lo atendió: %s', row_to_json(l));
  assert l.capturado_por is null and l.fuente_id = (select id from fuentes_contacto where nombre = 'Llamada a recepción'), 'lo capturó la IA, por recepción';
  assert l.notas like 'Entró por el teléfono (IA).%60 t/h%', format('notas del lead: %s', l.notas);
  assert (select atendio_perfil from llamadas where id = e1) = v_a, 'quien atendió se liga por el teléfono de su perfil';
  assert (select perfil_id from telefono_directorio where clave = '3311112581') = v_a, 'el directorio se liga solo por teléfono';
  assert (select datos::text from llamadas where id = e1) not like '%texto completo%', 'la transcripción no se guarda';
  assert exists (select 1 from avisos where usuario_id = v_a and tipo = 'lead' and registro_id = l.id::text and cuerpo like 'Lo atendiste por teléfono.%'),
    'a quien lo atendió le llega su lead';
  -- Una foto vieja (reintento atrasado) no pisa lo nuevo.
  perform pg_temp.foto('CA258-1', jsonb_build_object('estado', 'in-progress', 'resumen', 'Viejo'), null, t0 + interval '1 minute');
  assert (select estado || '|' || resumen from llamadas where id = e1) = 'completed|Busca una banda de 20 m para grava', 'una foto vieja pisó la nueva';
  -- Una foto nueva con campos vacíos no borra. Lo que trae nuevo del lead corrige lo que dejó el teléfono
  -- mientras nadie lo haya tocado (277: «Sin nombre» a mitad de la llamada, el nombre al colgar).
  perform pg_temp.foto('CA258-1', jsonb_build_object('grabacion_url', 'https://voz/g/CA258-1.mp3', 'grabacion_vence', now() + interval '30 days'),
    '{"nombre": "Otro nombre", "interes": "Otra cosa", "correo": "pedro@gravas258.mx"}', t0 + interval '9 minutes');
  assert (select resumen from llamadas where id = e1) = 'Busca una banda de 20 m para grava'
     and (select grabacion_url from llamadas where id = e1) is not null, 'la foto con la grabación borró o no guardó';
  select * into l from leads where id = l.id;
  assert l.nombre = 'Otro nombre' and l.interes = 'Otra cosa' and l.correo = 'pedro@gravas258.mx' and l.notas like '%60 t/h%',
    format('la foto nueva corrige lo que dejó el teléfono sin borrar las notas: %s', row_to_json(l));

  -- =========================================================================
  -- 2. Cliente de B (con +52 contra 10 dígitos), atendida por A: manda el dueño; actividad una vez
  -- =========================================================================
  r := pg_temp.foto('CA258-2', jsonb_build_object('telefono', '+528180002582', 'inicio', t0 + interval '10 minutes', 'estado', 'completed',
         'area_nombre', 'Ventas', 'atendio', jsonb_build_object('nombre', 'Vendedor A', 'telefono', '+523311112581'), 'nadie_contesto', false),
       '{"nombre": "Juan 258", "telefono": "+528180002582", "interes": "Refacciones para cribadora"}');
  e2 := (r->>'llamada_id')::uuid;
  assert (r->>'cliente_id')::uuid = v_cli, 'debía ligarse al cliente por los últimos 10 dígitos';
  select * into l from leads where id = (r->>'lead_id')::uuid;
  assert l.vendedor_id = v_b and l.como_se_asigno = 'cliente', format('con dueño vigente manda el dueño: %s', row_to_json(l));
  perform pg_temp.foto('CA258-2', jsonb_build_object('resumen', 'Pide rodillos'), '{"nombre": "Juan 258"}');
  perform pg_temp.foto('CA258-2', jsonb_build_object('resumen', 'Pide rodillos'), '{"nombre": "Juan 258"}');
  assert (select count(*) from actividades where cliente_id = v_cli and tipo = 'llamada' and usuario_id = v_a) = 1,
    'la actividad «llamada» debía quedar una sola vez, a nombre de quien atendió';
  assert (select descripcion from actividades where id = (select actividad_id from llamadas where id = e2)) like '%Pide rodillos',
    'la actividad debía completarse con el resumen';
  assert (select count(*) from leads where llamada_id = e2) = 1, 'una llamada, un lead';

  -- =========================================================================
  -- 3. Modo «recepción elige», sin nadie que lo atendiera: no falla, queda por asignar
  -- =========================================================================
  update configuracion set valor = valor || '{"modo": "recepcion"}' where clave = 'leads';
  r := pg_temp.foto('CA258-3', jsonb_build_object('telefono', '+525550002583', 'inicio', t0 + interval '20 minutes', 'estado', 'no-answer',
         'nadie_contesto', true, 'atendio_ia', 'Sofía', 'resumen', 'Quiere informes de silos'),
       '{"nombre": "Ana 258", "telefono": "5550002583", "interes": "Silo para cemento"}');
  e3 := (r->>'llamada_id')::uuid;
  select * into l from leads where id = (r->>'lead_id')::uuid;
  assert l.estado = 'nuevo' and l.vendedor_id is null and l.como_se_asigno is null, format('en modo recepción, sin vendedor queda nuevo: %s', row_to_json(l));
  assert exists (select 1 from avisos where usuario_id = v_ger and registro_id = l.id::text and titulo like 'Lead por asignar%'),
    'la gerencia debía recibir el lead por asignar';
  -- Sin gerente de ventas activo (como en la nube) le llega a dirección, no a nadie.
  v_adm := pg_temp.usuario('adm258@hegamex.com', '{admin}');
  perform pg_temp.como(v_adm);
  update perfiles set activo = false where id in (select usuario_id from usuario_roles where rol = 'gerente_ventas');
  perform pg_temp.como_postgres();
  r2 := pg_temp.foto('CA258-3b', jsonb_build_object('telefono', '+525550002584', 'nadie_contesto', true),
        '{"nombre": "Eva 258", "telefono": "5550002584", "interes": "Colector de polvo"}');
  assert exists (select 1 from avisos where usuario_id = v_dir and registro_id = r2->>'lead_id' and titulo like 'Lead por asignar%'),
    'sin gerencia, el lead por asignar debía llegarle a dirección';
  assert not exists (select 1 from avisos where usuario_id in (v_a, v_rec) and registro_id = r2->>'lead_id'),
    'el lead por asignar NO le llega a vendedores ni a recepción';
  perform pg_temp.como(v_adm);
  update perfiles set activo = true where id = v_ger;
  perform pg_temp.como_postgres();
  -- Una captura a mano en modo recepción sigue pidiendo vendedor: el permiso del teléfono no se presta.
  perform pg_temp.como(v_rec);
  perform set_config('hegamex.lead_telefono', 'si', true);
  v_ok := false;
  begin insert into leads (nombre, telefono, interes) values ('Manual 258', '5550002589', 'Banda 258'); v_ok := true;
  exception when check_violation then null; end;
  assert not v_ok, 'una sesión no debe poder hacerse pasar por el teléfono';
  perform set_config('hegamex.lead_telefono', '', true);
  perform pg_temp.como_postgres();
  update configuracion set valor = valor || '{"modo": "bandeja"}' where clave = 'leads';

  -- =========================================================================
  -- 4. Quién ve qué
  -- =========================================================================
  perform pg_temp.como(v_a);
  assert (select array_agg(call_sid order by call_sid) from llamadas where call_sid like 'CA258-%') = '{CA258-1,CA258-2}',
    'A ve la que atendió y es suya, y la que atendió del cliente de B';
  perform pg_temp.como(v_b);
  assert (select array_agg(call_sid order by call_sid) from llamadas where call_sid like 'CA258-%') = '{CA258-2}',
    'B NO debe ver la llamada de A';
  perform pg_temp.como(v_c);
  assert not exists (select 1 from llamadas where call_sid like 'CA258-%'), 'otro vendedor NO debe ver llamadas ajenas ni las sin dueño';
  perform pg_temp.como(v_alm);
  assert not exists (select 1 from llamadas), 'almacén NO debe ver llamadas';
  assert not exists (select 1 from telefono_directorio), 'almacén NO debe ver el directorio';
  perform pg_temp.como(v_rec);
  assert (select array_agg(call_sid order by call_sid) from llamadas where call_sid like 'CA258-%') = '{CA258-3,CA258-3b}', 'recepción ve solo las que no son de nadie';
  perform pg_temp.como(v_ger);
  assert (select count(*) from llamadas where call_sid like 'CA258-%') = 4, 'la gerencia ve todas';
  perform pg_temp.como(v_a);
  v_ok := false;
  begin update llamadas set resumen = 'x' where id = e1; get diagnostics v_n = row_count; v_ok := v_n > 0;
  exception when insufficient_privilege then null; end;
  assert not v_ok, 'nadie escribe llamadas directo';

  -- =========================================================================
  -- 5. Regresar llamada
  -- =========================================================================
  -- 5a. El cliente de B llamó y nadie contestó: le sale a B (no a A), con aviso; «Ya le regresé» la quita.
  perform pg_temp.como_postgres();
  r := pg_temp.foto('CA258-4', jsonb_build_object('telefono', '8180002582', 'inicio', t0 + interval '30 minutes', 'nadie_contesto', true,
         'estado', 'no-answer', 'resumen', 'Dejó recado: llámenle'));
  e4 := (r->>'llamada_id')::uuid;
  assert exists (select 1 from avisos where usuario_id = v_b and tipo = 'llamada_perdida' and registro_id = e4::text), 'al dueño le llega el aviso';
  perform pg_temp.foto('CA258-4', jsonb_build_object('nadie_contesto', true));
  assert (select count(*) from avisos where tipo = 'llamada_perdida' and registro_id = e4::text) = 1, 'el aviso va una sola vez';
  perform pg_temp.como(v_b);
  assert exists (select 1 from llamadas_por_regresar() where id = e4 and cliente_nombre = 'Agregados 258'), 'B debía tenerla por regresar';
  perform pg_temp.como(v_a);
  assert not exists (select 1 from llamadas_por_regresar() where id = e4), 'A NO debe tener la llamada del cliente de B';
  v_ok := false;
  begin perform marcar_llamada_regresada(e4); v_ok := true; exception when insufficient_privilege then null; end;
  assert not v_ok, 'A NO debe poder marcar la llamada de B';
  perform pg_temp.como(v_b);
  perform marcar_llamada_regresada(e4, 'Pide cotización de rodillos');
  assert not exists (select 1 from llamadas_por_regresar() where id = e4), 'marcada, debía salir de la lista';
  assert exists (select 1 from actividades where cliente_id = v_cli and usuario_id = v_b and descripcion = 'Le regresé la llamada: Pide cotización de rodillos'),
    'regresarla queda en la actividad del cliente';
  v_ok := false;
  begin perform marcar_llamada_regresada(e4); v_ok := true; exception when others then v_err := sqlerrm; end;
  assert not v_ok and v_err like 'Esa llamada ya se regresó%', 'marcarla dos veces debía avisar';

  -- 5b. Vuelve a llamar y esta vez lo atienden: la perdida sale sola.
  perform pg_temp.como_postgres();
  r := pg_temp.foto('CA258-5', jsonb_build_object('telefono', '+52 818 000 2582', 'inicio', t0 + interval '40 minutes', 'nadie_contesto', true));
  e5 := (r->>'llamada_id')::uuid;
  perform pg_temp.como(v_b);
  assert exists (select 1 from llamadas_por_regresar() where id = e5), 'la segunda perdida debía salir';
  perform pg_temp.como_postgres();
  perform pg_temp.foto('CA258-6', jsonb_build_object('telefono', '8180002582', 'inicio', t0 + interval '50 minutes', 'nadie_contesto', false,
    'atendio', jsonb_build_object('nombre', 'Vendedor A', 'telefono', '3311112581')));
  perform pg_temp.como(v_b);
  assert not exists (select 1 from llamadas_por_regresar() where id = e5), 'si vuelve a llamar y lo atienden, ya no hay que regresarla';
  perform pg_temp.como_postgres();
  assert (select regresada_como from llamadas where id = e5) = 'volvio_a_llamar', 'debía decir que volvió a llamar';

  -- 5c. Perdida con lead sin dueño: es de recepción hasta que alguien toma el lead; entonces es suya,
  --     y «Ya le regresé · Contestó» la quita y deja el intento en el lead.
  r := pg_temp.foto('CA258-7', jsonb_build_object('telefono', '+525550002587', 'inicio', t0 + interval '60 minutes', 'nadie_contesto', true),
       '{"nombre": "Luis 258", "telefono": "5550002587", "interes": "Tolva de 5 m3"}');
  e7 := (r->>'llamada_id')::uuid; v_l7 := (r->>'lead_id')::uuid;
  perform pg_temp.como(v_rec);
  assert exists (select 1 from llamadas_por_regresar() where id = e7), 'sin dueño, la ve recepción';
  perform pg_temp.como(v_a);
  assert not exists (select 1 from llamadas_por_regresar() where id = e7), 'sin dueño, NO la ve un vendedor';
  perform tomar_lead(v_l7);
  assert exists (select 1 from llamadas_por_regresar() where id = e7 and puede_intento), 'al tomar el lead, la llamada es suya';
  perform pg_temp.como(v_rec);
  assert not exists (select 1 from llamadas_por_regresar() where id = e7), 'ya con dueño, recepción NO la ve';
  perform pg_temp.como(v_a);
  perform marcar_llamada_regresada(e7, 'Quiere la tolva para enero', true);
  assert not exists (select 1 from llamadas_por_regresar() where id = e7), 'regresada, sale de la lista';
  assert exists (select 1 from lead_intentos where lead_id = v_l7 and canal = 'llamada' and resultado = 'contesto' and nota = 'Quiere la tolva para enero'),
    'con «Contestó» queda el intento en su lead';

  -- 5d. Un intento anotado en el lead después de la llamada también la quita.
  perform pg_temp.como_postgres();
  r := pg_temp.foto('CA258-8', jsonb_build_object('telefono', '+525550002588', 'inicio', t0 + interval '70 minutes', 'nadie_contesto', true),
       '{"nombre": "Rita 258", "telefono": "5550002588", "interes": "Elevador de cangilones"}');
  e8 := (r->>'llamada_id')::uuid; v_l8 := (r->>'lead_id')::uuid;
  perform pg_temp.como(v_a);
  perform tomar_lead(v_l8);
  assert exists (select 1 from llamadas_por_regresar() where id = e8), 'la perdida del lead tomado debía salir';
  perform registrar_intento_lead(v_l8, 'whatsapp', 'enviado');
  assert not exists (select 1 from llamadas_por_regresar() where id = e8), 'un intento en su lead debía quitarla';

  -- =========================================================================
  -- 6. Directorio: un nombre sin teléfono lo liga dirección
  -- =========================================================================
  perform pg_temp.como_postgres();
  r := pg_temp.foto('CA258-9', jsonb_build_object('telefono', '+525550002590', 'nadie_contesto', false,
         'atendio', jsonb_build_object('nombre', 'Karen Pérez 258')));
  e9 := (r->>'llamada_id')::uuid;
  assert (select atendio_perfil from llamadas where id = e9) is null, 'sin teléfono no se adivina quién es';
  perform pg_temp.como(v_dir);
  assert (estado_telefono()->>'directorio_sin_persona')::int >= 1 and (estado_telefono()->>'llamadas_7d')::int >= 9, format('estado: %s', estado_telefono());
  perform pg_temp.como(v_a);
  v_ok := false;
  begin perform fijar_directorio_telefono((select atendio_directorio from llamadas where id = e2), v_a); v_ok := true;
  exception when insufficient_privilege then null; end;
  assert not v_ok, 'un vendedor NO debe ligar el directorio';
  perform pg_temp.como(v_dir);
  perform fijar_directorio_telefono((select id from telefono_directorio where clave = 'nombre:karen perez 258'), v_rec);
  perform pg_temp.como_postgres();
  assert (select atendio_perfil from llamadas where id = e9) = v_rec, 'al ligarlo, sus llamadas quedan a su nombre';

  -- =========================================================================
  -- 7. Cuerpos mal formados: 22xxx (la función de borde contesta 400)
  -- =========================================================================
  begin perform telefono_registrar_evento('{"version": 2, "tipo": "llamada", "call_sid": "CA258-x", "llamada": {}}'); v_err := 'pasó';
  exception when others then v_err := sqlstate; end;
  assert v_err = '22023', 'versión 2 debía rechazarse con 22023: ' || v_err;
  begin perform pg_temp.foto('', '{}'); v_err := 'pasó'; exception when others then v_err := sqlstate; end;
  assert v_err = '22023', 'sin call_sid debía rechazarse: ' || v_err;
  begin perform pg_temp.foto('CA258-y', '{"inicio": "ayer"}'); v_err := 'pasó'; exception when others then v_err := sqlstate; end;
  assert v_err like '22%', 'una fecha mal escrita debía salir como error de datos: ' || v_err;
end $$;

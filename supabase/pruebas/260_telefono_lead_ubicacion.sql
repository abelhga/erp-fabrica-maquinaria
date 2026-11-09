-- El lead que toma la IA del teléfono llega con dónde está: la ciudad tal cual (sin espacios de más)
-- y el estado como lo escribe el ERP (nombre corto del catálogo). Lo que no se reconoce queda vacío
-- para que la pantalla lo siga pidiendo, lo que ya tenía el lead no se pisa y la foto de antes (sin
-- estos campos) sigue entrando igual.

create or replace function pg_temp.foto(p_sid text, p_llamada jsonb, p_lead jsonb default null, p_enviado timestamptz default now())
returns jsonb language sql as $$
  select public.telefono_registrar_evento(jsonb_build_object('version', 1, 'tipo', 'llamada', 'call_sid', p_sid,
    'enviado_en', p_enviado, 'llamada', p_llamada, 'lead', p_lead))
$$;

do $$
declare r jsonb; l leads; v_esp text; v_got text; v_par text[];
  t0 timestamptz := now() - interval '2 hours';
begin
  update configuracion set valor = valor || '{"modo": "bandeja", "vendedores": []}' where clave = 'leads';

  -- =========================================================================
  -- 1. Cómo dice la gente cada estado → como lo escribe el ERP
  -- =========================================================================
  foreach v_par slice 1 in array array[
    ['Jalisco', 'Jalisco'], ['jalisco', 'Jalisco'], ['Edo. de México', 'Estado de México'], ['Estado de México', 'Estado de México'],
    ['Edomex', 'Estado de México'], ['Edo. Méx.', 'Estado de México'], ['CDMX', 'Ciudad de México'], ['DF', 'Ciudad de México'],
    ['D.F.', 'Ciudad de México'], ['Ciudad de México', 'Ciudad de México'], ['Mexico City', 'Ciudad de México'],
    ['Nuevo León', 'Nuevo León'], ['nuevo leon', 'Nuevo León'], ['N.L.', 'Nuevo León'], ['Nueo Leon', 'Nuevo León'],
    ['Michoacán', 'Michoacán'], ['michoacan de ocampo', 'Michoacán'], ['Querétaro', 'Querétaro'], ['Queretaro de Arteaga', 'Querétaro'],
    ['San Luis Potosí', 'San Luis Potosí'], ['SLP', 'San Luis Potosí'], ['Baja California', 'Baja California'],
    ['Baja California Sur', 'Baja California Sur'], ['BCS', 'Baja California Sur'], ['Coahuila de Zaragoza', 'Coahuila'],
    ['Veracruz de Ignacio de la Llave', 'Veracruz'], ['Yucatan', 'Yucatán'], ['Estado de Jalisco', 'Jalisco'],
    ['Edo. Jalisco', 'Jalisco'], ['Jalisco, México', 'Jalisco'], ['Puebla, Mexico', 'Puebla'], ['  Sonora. ', 'Sonora']]
  loop
    v_got := normalizar_estado_mx(v_par[1]);
    assert v_got is not distinct from v_par[2], format('«%s» debía quedar «%s» y quedó «%s»', v_par[1], v_par[2], v_got);
  end loop;
  -- Lo que no es un estado de la República, o no se sabe cuál: vacío.
  foreach v_esp in array array['Guadalajara', 'Monterrey', 'México', 'Mex.', 'Texas', 'Nuevo México', 'California', 'Baja', 'Sur', 'Narnia', '', '   ']
  loop
    v_got := normalizar_estado_mx(v_esp);
    assert v_got is null, format('«%s» no es un estado reconocible y quedó «%s»', v_esp, v_got);
  end loop;
  assert normalizar_estado_mx(null) is null, 'null debe quedar null';
  -- Lo que sale siempre es un nombre del catálogo, para que ubicar() lo reconozca al convertir.
  assert geo_estado_de(normalizar_estado_mx('Edo. de México')) = '15' and geo_estado_de(normalizar_estado_mx('CDMX')) = '09',
    'el estado normalizado debe reconocerlo ubicar()';

  -- =========================================================================
  -- 2. Llega con ciudad y estado: se llenan normalizados
  -- =========================================================================
  r := pg_temp.foto('CA260-1', jsonb_build_object('telefono', '+525550002601', 'inicio', t0, 'nadie_contesto', false),
       '{"nombre": "Ana 260", "telefono": "+525550002601", "interes": "Cribadora vibratoria 4x8", "ciudad": "  Ecatepec   de  Morelos ", "estado": "Edo. de México"}');
  select * into l from leads where id = (r->>'lead_id')::uuid;
  assert l.ciudad = 'Ecatepec de Morelos', 'la ciudad debía llegar sin espacios de más: ' || coalesce(l.ciudad, 'null');
  assert l.estado_mx = 'Estado de México', 'el estado debía llegar como lo escribe el ERP: ' || coalesce(l.estado_mx, 'null');
  assert not ('dónde está' = any(lead_faltan(l.cliente_id, l.empresa, l.ciudad, l.estado_mx, l.interes))),
    'con ciudad y estado ya no le debe faltar dónde está';
  assert (select datos->'lead'->>'estado' from llamadas where call_sid = 'CA260-1') = 'Edo. de México',
    'lo crudo queda en la llamada';

  -- Otra foto con otra ubicación y nadie la había tocado: desde 261 es una corrección del teléfono
  -- (volvió a oír la grabación) y sí entra. Lo que cambió una persona no (abajo y en 261).
  r := pg_temp.foto('CA260-1', jsonb_build_object('telefono', '+525550002601', 'inicio', t0, 'nadie_contesto', false),
       '{"nombre": "Ana 260", "telefono": "+525550002601", "interes": "Cribadora vibratoria 4x8", "ciudad": "Toluca", "estado": "CDMX"}');
  select * into l from leads where id = (r->>'lead_id')::uuid;
  assert l.ciudad = 'Toluca' and l.estado_mx = 'Ciudad de México', 'la corrección del teléfono debe entrar si nadie la tocó: ' || l.ciudad;

  -- Lo que una persona corrigió a mano tampoco.
  update leads set ciudad = 'Tlalnepantla', estado_mx = 'México' where id = l.id;
  r := pg_temp.foto('CA260-1', jsonb_build_object('telefono', '+525550002601', 'inicio', t0, 'nadie_contesto', false),
       '{"nombre": "Ana 260", "telefono": "+525550002601", "interes": "Cribadora vibratoria 4x8", "ciudad": "Ecatepec", "estado": "Edomex"}');
  select * into l from leads where id = l.id;
  assert l.ciudad = 'Tlalnepantla' and l.estado_mx = 'México', 'lo capturado por una persona no se pisa';

  -- =========================================================================
  -- 3. Estado que no se reconoce: vacío, la ciudad sí
  -- =========================================================================
  r := pg_temp.foto('CA260-2', jsonb_build_object('telefono', '+525550002602', 'inicio', t0, 'nadie_contesto', false),
       jsonb_build_object('nombre', 'Beto 260', 'telefono', '+525550002602', 'interes', 'Banda transportadora 12 m',
         'ciudad', repeat('Muy larga ', 20), 'estado', 'Narnia'));
  select * into l from leads where id = (r->>'lead_id')::uuid;
  assert l.estado_mx is null, 'un estado que no se reconoce debe quedar vacío: ' || coalesce(l.estado_mx, 'null');
  assert l.ciudad like 'Muy larga%' and length(l.ciudad) <= 80, 'la ciudad se recorta a 80: ' || length(l.ciudad);
  -- La siguiente foto trae un estado que sí se reconoce: ahora sí se llena.
  r := pg_temp.foto('CA260-2', jsonb_build_object('telefono', '+525550002602', 'inicio', t0, 'nadie_contesto', false),
       '{"nombre": "Beto 260", "telefono": "+525550002602", "interes": "Banda transportadora 12 m", "estado": "nuevo leon"}');
  select * into l from leads where id = (r->>'lead_id')::uuid;
  assert l.estado_mx = 'Nuevo León', 'con la foto siguiente el estado se llena: ' || coalesce(l.estado_mx, 'null');

  -- =========================================================================
  -- 4. La foto de antes (sin ciudad ni estado) sigue entrando; la siguiente los llena
  -- =========================================================================
  r := pg_temp.foto('CA260-3', jsonb_build_object('telefono', '+525550002603', 'inicio', t0, 'nadie_contesto', false),
       '{"id_voz": 3, "nombre": "Carla 260", "telefono": "+525550002603", "interes": "Tolva de 10 toneladas"}');
  assert r->>'ok' = 'true' and r->>'lead_id' is not null, format('la foto sin ubicación debía crear el lead: %s', r);
  select * into l from leads where id = (r->>'lead_id')::uuid;
  assert l.ciudad is null and l.estado_mx is null, 'sin los campos, la ubicación queda vacía';
  assert 'dónde está' = any(lead_faltan(l.cliente_id, l.empresa, l.ciudad, l.estado_mx, l.interes)), 'y le sigue faltando dónde está';
  -- En blanco cuenta como vacío.
  update leads set ciudad = '  ', estado_mx = '' where id = l.id;
  r := pg_temp.foto('CA260-3', jsonb_build_object('telefono', '+525550002603', 'inicio', t0, 'nadie_contesto', false),
       '{"id_voz": 3, "nombre": "Carla 260", "telefono": "+525550002603", "interes": "Tolva de 10 toneladas", "ciudad": "Morelia", "estado": "Michoacán"}');
  select * into l from leads where id = l.id;
  assert l.ciudad = 'Morelia' and l.estado_mx = 'Michoacán', format('lo vacío o en blanco se llena: %s, %s', l.ciudad, l.estado_mx);
  -- Y una foto que ya no los trae no borra nada.
  r := pg_temp.foto('CA260-3', jsonb_build_object('telefono', '+525550002603', 'inicio', t0, 'nadie_contesto', false),
       '{"id_voz": 3, "nombre": "Carla 260", "telefono": "+525550002603", "interes": "Tolva de 10 toneladas", "ciudad": null, "estado": ""}');
  select * into l from leads where id = l.id;
  assert l.ciudad = 'Morelia' and l.estado_mx = 'Michoacán', 'una foto sin ubicación no borra la que hay';
end $$;

-- Una llamada de la historia se liga al lead que ya existe de esa persona (mismo teléfono o mismo
-- cliente, el más cercano en fecha), sin tocar el lead. Los «NO debe»: no crea lead, ni actividad,
-- ni aviso; el lead queda igual; una llamada de hoy sigue su camino de siempre; una histórica de
-- alguien sin lead se queda sin lead; una que ya tiene lead no se cambia.

create or replace function pg_temp.foto(p_sid text, p_llamada jsonb, p_extra jsonb default '{}')
returns jsonb language sql as $$
  select public.telefono_registrar_evento(jsonb_build_object('version', 1, 'tipo', 'llamada', 'call_sid', p_sid,
    'enviado_en', now(), 'llamada', p_llamada) || p_extra)
$$;

do $$
declare
  v_a uuid; v_cli uuid; l_viejo uuid; l_cerca uuid; l_cli uuid; r jsonb; v_n int; v_av int; v_leads int; antes leads; despues leads;
  t0 timestamptz := now() - interval '20 days';
begin
  v_a := pg_temp.usuario('vena264@hegamex.com', '{ventas}');
  insert into clientes (nombre) values ('Cliente 264') returning id into v_cli;
  insert into contactos (cliente_id, nombre, telefono) values (v_cli, 'Contacto 264', '33 4444 2640');

  -- Dos leads del mismo teléfono: uno de hace 60 días y otro de 2 días después de la llamada.
  insert into leads (nombre, telefono, interes) values ('Viejo 264', '5550002641', 'Banda de 6 m') returning id into l_viejo;
  insert into leads (nombre, telefono, interes) values ('Cercano 264', '+52 55 5000 2641', 'Banda de 12 m') returning id into l_cerca;
  update leads set creado_en = t0 - interval '60 days' where id = l_viejo;
  update leads set creado_en = t0 + interval '2 days', estado = 'asignado', vendedor_id = v_a, como_se_asigno = 'gerente', asignado_en = now()
  where id = l_cerca;
  -- Un lead del cliente, con otro teléfono.
  insert into leads (nombre, telefono, interes, cliente_id) values ('Del cliente 264', '5550002649', 'Tolva', v_cli) returning id into l_cli;
  update leads set creado_en = t0 where id = l_cli;

  select * into antes from leads where id = l_cerca;
  select count(*) into v_av from avisos;
  select count(*) into v_leads from leads;

  -- 1. Histórica del mismo teléfono: se liga al lead más cercano en fecha, no al más viejo.
  r := pg_temp.foto('CA264-1', jsonb_build_object('telefono', '+525550002641', 'inicio', t0, 'nadie_contesto', false, 'historica', true),
       jsonb_build_object('lead', jsonb_build_object('nombre', 'Lo que dijo la IA', 'telefono', '+525550002641', 'interes', 'Banda')));
  assert (r->>'lead_id')::uuid = l_cerca, format('la histórica debía ligarse al lead más cercano: %s', r);
  assert (select lead_nombre from llamadas where call_sid = 'CA264-1') like 'Cercano 264%', 'el nombre del lead queda en la llamada';
  select * into despues from leads where id = l_cerca;
  assert despues.nombre = antes.nombre and despues.interes = antes.interes and despues.estado = antes.estado
     and despues.vendedor_id = antes.vendedor_id and despues.llamada_id is not distinct from antes.llamada_id
     and despues.notas is not distinct from antes.notas, 'el lead NO se toca';
  assert (select count(*) from leads) = v_leads, 'una histórica NO crea leads';
  assert (select count(*) from avisos) = v_av, 'ligar una histórica NO avisa a nadie';
  assert (select actividad_id is null from llamadas where call_sid = 'CA264-1'), 'una histórica NO deja actividad';

  -- 2. Histórica del teléfono del cliente: se liga a su cliente y al lead de ese cliente.
  r := pg_temp.foto('CA264-2', jsonb_build_object('telefono', '+523344442640', 'inicio', t0 + interval '1 day', 'nadie_contesto', false, 'historica', true));
  assert (r->>'cliente_id')::uuid = v_cli and (r->>'lead_id')::uuid = l_cli, format('por el cliente, al lead del cliente: %s', r);

  -- 3. Histórica de alguien sin lead: sin lead, como antes.
  r := pg_temp.foto('CA264-3', jsonb_build_object('telefono', '+525550002699', 'inicio', t0, 'nadie_contesto', false, 'historica', true));
  assert r->'lead_id' = 'null', format('sin lead de esa persona, no se liga a nada: %s', r);

  -- 4. Una foto posterior de la misma histórica no la cambia de lead.
  update leads set creado_en = t0 where id = l_viejo;   -- ahora el viejo sería el más cercano
  r := pg_temp.foto('CA264-1', jsonb_build_object('telefono', '+525550002641', 'inicio', t0, 'nadie_contesto', false, 'historica', true));
  assert (r->>'lead_id')::uuid = l_cerca, 'una foto nueva NO cambia el lead que ya tenía';

  -- 5. Una llamada de hoy sigue su camino: crea su lead nuevo (no la liga al que ya existía).
  select count(*) into v_n from leads;
  r := pg_temp.foto('CA264-5', jsonb_build_object('telefono', '+525550002641', 'inicio', now(), 'nadie_contesto', true),
       jsonb_build_object('lead', jsonb_build_object('nombre', 'Nuevo 264', 'telefono', '+525550002641', 'interes', 'Cribadora de 2 camas')));
  assert (select count(*) from leads) = v_n + 1 and (r->>'lead_id')::uuid not in (l_viejo, l_cerca, l_cli),
    format('la llamada de hoy hace su lead como siempre: %s', r);
end $$;

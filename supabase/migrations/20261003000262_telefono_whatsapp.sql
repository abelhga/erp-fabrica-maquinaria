-- =============================================================================
-- Teléfono, fase 4: lo que el vendedor contesta por WhatsApp queda en el ERP.
--
-- Por qué: el bot de WhatsApp del conmutador le avisa al vendedor de cada lead y él contesta
-- «contactado: le interesa la de 20 m», «no contestó», «perdido: precio»… Con «CRM externo» prendido
-- el bot solo le decía «el seguimiento ya vive en el ERP» y no anotaba nada; apagado, lo anotaba en
-- el mini-CRM del teléfono, que el ERP no ve. En los dos casos la respuesta no dejaba rastro aquí:
-- el lead seguía «sin contactar», la gerencia le volvía a avisar y el embudo no sabía qué pasó.
-- Además recepción volvía a capturar a mano leads que la IA ya había registrado por teléfono, y el
-- resumen de la mañana salía del mini-CRM y no de los pendientes reales del ERP.
--
-- Ahora (contrato en docs/integracion-telefono.md, «Fase 4»):
--   * telefono_accion: el conmutador manda cada respuesta (POST /accion de la función «telefono»).
--     El vendedor se reconoce por su WhatsApp en «Quién contesta» (o por el teléfono de su perfil) y
--     la acción se aplica COMO ÉL, con las mismas funciones que usa la pantalla: tomar, intento,
--     descartar, seguimiento. Las reglas no cambian por venir de WhatsApp: «contestó» pide qué te
--     dijo, «no respondió» solo después de insistir, decidir al tercer seguimiento, un lead de otro
--     vendedor no se toca. Lo que una regla frena regresa como aplicado:false con el mensaje del ERP,
--     que el bot le contesta tal cual. Cada mensaje se aplica una vez (por su message_sid).
--   * telefono_resumen: el resumen de la mañana de ese vendedor, sacado de sus pendientes del ERP.
--   * llamada_reciente_de: al registrar un lead a mano, recepción ve si ese número ya llamó y la IA
--     ya dejó su lead (y de quién es), para no capturarlo dos veces.
--
-- Por qué «como él» y no una función aparte con sus propias reglas: los candados de ventas viven en
-- esas funciones y en disparadores que se brincan cuando no hay sesión (perder sin respuesta, 255;
-- seguimientos, 172; clientes repetidos, 256). Sin la identidad del vendedor, WhatsApp sería la
-- puerta para saltárselos, y una copia de las reglas se quedaría atrás en la primera corrección.
-- =============================================================================

-- 0. Por dónde se capturó un intento ----------------------------------------------------------------
-- El canal del intento es por dónde fue el contacto con el cliente; esto es por dónde lo anotó el
-- vendedor. Lo pone telefono_accion con un ajuste de la transacción (hegamex.via), que una sesión de
-- la API no puede fijar.
alter table public.lead_intentos add column if not exists via text;
alter table public.lead_intentos drop constraint if exists lead_intentos_via;
alter table public.lead_intentos add constraint lead_intentos_via check (via is null or via = 'whatsapp');
alter table public.lead_intentos alter column via set default nullif(current_setting('hegamex.via', true), '');
comment on column public.lead_intentos.via is 'whatsapp = lo anotó el vendedor contestando el WhatsApp del conmutador (telefono_accion); null = en la pantalla.';

-- 1. Cada mensaje de WhatsApp, una vez ----------------------------------------------------------------
-- El conmutador reintenta si no le contestamos a tiempo: el mismo message_sid regresa la respuesta
-- guardada sin volver a aplicar nada. Nadie con sesión la lee (RLS sin políticas).
create table if not exists public.telefono_acciones (
  id text primary key check (length(id) between 1 and 100),   -- message_sid del WhatsApp
  telefono10 text,
  perfil_id uuid references public.perfiles(id) on delete set null,
  lead_id uuid references public.leads(id) on delete set null,
  accion text not null,
  aplicado boolean not null,
  respuesta jsonb not null,
  creado_en timestamptz not null default now()
);
create index if not exists telefono_acciones_perfil on public.telefono_acciones (perfil_id, creado_en desc);
alter table public.telefono_acciones enable row level security;
revoke all on public.telefono_acciones from anon, authenticated;

-- 2. Quién escribe ---------------------------------------------------------------------------------
-- Su WhatsApp ligado en «Quién contesta» (por los 10 dígitos); si no, el único perfil activo con ese
-- teléfono. Regresa el perfil aunque esté dado de baja: quien llama decide qué contestar.
create or replace function public._telefono_perfil_de(p_tel text) returns uuid
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select d.perfil_id from telefono_directorio d where d.clave = telefono10(p_tel) and d.perfil_id is not null),
    (select min(d.perfil_id::text)::uuid from telefono_directorio d
     where telefono10(d.telefono) = telefono10(p_tel) and d.perfil_id is not null having count(distinct d.perfil_id) = 1),
    (select min(p.id::text)::uuid from perfiles p where p.activo and telefono10(p.telefono) = telefono10(p_tel) having count(*) = 1))
$$;
revoke execute on function public._telefono_perfil_de(text) from public, anon, authenticated;

-- Lo que el bot puede decir de un lead: nombre y en qué va. Nada de montos.
create or replace function public._telefono_lead_json(p uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', l.id, 'nombre', l.nombre, 'estado', l.estado, 'etapa', l.etapa_oportunidad) from leads l where l.id = p
$$;
revoke execute on function public._telefono_lead_json(uuid) from public, anon, authenticated;

-- Un texto libre (interés, título de un pendiente) que viaja por WhatsApp no lleva cantidades de dinero.
create or replace function public._telefono_sin_montos(p text) returns text
language sql immutable set search_path = public as $$
  select regexp_replace(regexp_replace(p, '\$\s*[0-9][0-9.,]*(\s*(k|mil|mdp|m)\M)?', '$…', 'gi'),
                        '[0-9][0-9.,]*\s*(pesos|mxn|usd|d[oó]lares)\M', '…', 'gi')
$$;
revoke execute on function public._telefono_sin_montos(text) from public, anon, authenticated;

-- 3. Una nota en el lead ---------------------------------------------------------------------------
-- La misma regla que los intentos: el vendedor que lo tiene o la gerencia. Mientras es lead, la nota
-- se agrega (con fecha y quién) a sus notas, que se ven en el lead y pasan a la oportunidad al
-- convertirlo. Ya convertido, va a la bitácora comercial de la oportunidad, donde el vendedor la busca.
create or replace function public.anotar_lead(p_lead uuid, p_texto text) returns void
language plpgsql security definer set search_path = public as $$
declare l leads; v_texto text := nullif(trim(coalesce(p_texto, '')), ''); v_via boolean := coalesce(current_setting('hegamex.via', true), '') = 'whatsapp';
  v_quien text; v_linea text;
begin
  if en_vista_previa() then raise exception 'Estás viendo el ERP como otra persona: desde aquí no se cambia nada' using errcode = '42501'; end if;
  select * into l from leads where id = p_lead for update;
  if l.id is null then raise exception 'Ese lead no existe'; end if;
  if not ((l.vendedor_id = auth.uid() and puede('ventas', 2)) or (puede('leads', 3) and puede('ventas', 2))) then
    raise exception 'Solo el vendedor que lo tiene (o la gerencia) le anota notas' using errcode = '42501';
  end if;
  if coalesce(length(v_texto), 0) < 3 then raise exception 'Escribe la nota' using errcode = '23514'; end if;
  if length(v_texto) > 1000 then raise exception 'La nota es muy larga: hasta 1000 letras' using errcode = '23514'; end if;
  if l.estado = 'nuevo' then raise exception 'Este lead todavía no tiene vendedor: tómalo primero'; end if;
  if l.estado = 'descartado' then raise exception 'Este lead ya está descartado'; end if;
  select nombre into v_quien from perfiles where id = auth.uid();
  if l.estado = 'convertido' and l.oportunidad_id is not null then
    insert into actividades (cliente_id, oportunidad_id, tipo, descripcion, hecha)
    values (l.cliente_id, l.oportunidad_id, 'nota', v_texto || case when v_via then ' (por WhatsApp)' else '' end, true);
  elsif l.estado = 'convertido' then
    raise exception 'Este lead ya es cliente y su oportunidad no existe: anótalo en la ficha del cliente';
  else
    v_linea := fecha_texto(hoy_mx()) || ' ' || to_char(now() at time zone 'America/Mexico_City', 'HH24:MI')
      || ' · ' || coalesce(v_quien, 'alguien') || case when v_via then ', por WhatsApp' else '' end || ': ' || v_texto;
    update leads set notas = concat_ws(E'\n', nullif(notas, ''), v_linea) where id = l.id;
  end if;
end $$;
revoke execute on function public.anotar_lead(uuid, text) from public, anon;
grant execute on function public.anotar_lead(uuid, text) to authenticated;

-- 4. Aplicar una acción, ya como el vendedor ---------------------------------------------------------
-- La llama solo telefono_accion, con request.jwt.claims del vendedor puesto: todo lo de aquí (puede(),
-- ve_bandeja_leads(), las funciones de leads y sus disparadores) lo ve a él. Regresa
-- {aplicado, mensaje, ruta, visible}; una regla que lo frena sale como excepción y telefono_accion la
-- vuelve mensaje.
create or replace function public._telefono_aplicar(p_accion text, p_lead uuid, p_texto text, p_motivo text,
  p_canal text, p_cuando timestamptz) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  l leads; v_yo uuid := auth.uid(); v_ve boolean; v_ruta text := '/ventas/leads?id=' || p_lead;
  v_canal text; v_res text; v_pend uuid; v_vence date; v_tomo boolean := false; v_motivo text := nullif(trim(coalesce(p_motivo, '')), '');
  v_dia date; v_hora text; v_nombre text; v_msg text;
begin
  select * into l from leads where id = p_lead for update;
  v_nombre := l.nombre;
  -- La misma regla que la RLS de leads: lo que no ve en la pantalla, tampoco lo mueve por WhatsApp
  -- (ni se entera de cómo se llama).
  v_ve := puede('leads', 3) or (puede('leads', 1) and (l.capturado_por = v_yo or l.vendedor_id = v_yo
                                                     or (l.estado = 'nuevo' and ve_bandeja_leads())));
  if not coalesce(v_ve, false) then
    return jsonb_build_object('aplicado', false, 'visible', false, 'ruta', null, 'mensaje',
      case when l.estado = 'nuevo' then 'Ese lead todavía no tiene vendedor: la gerencia de ventas lo asigna. Pídeles que te lo pasen.'
           else 'Ese lead es de otro vendedor: desde aquí no lo puedes mover. Si debe ser tuyo, pídele a la gerencia de ventas que te lo pase.' end);
  end if;

  if p_accion = 'tomar' then
    if l.estado = 'asignado' and l.vendedor_id = v_yo then
      return jsonb_build_object('aplicado', false, 'ruta', v_ruta, 'mensaje', format('El lead de %s ya es tuyo.', v_nombre));
    end if;
    if l.estado = 'nuevo' and config_leads()->>'modo' <> 'bandeja' then
      return jsonb_build_object('aplicado', false, 'ruta', v_ruta,
        'mensaje', 'Aquí los leads nuevos los asigna la gerencia de ventas: pídeles que te lo pasen.');
    end if;
    perform tomar_lead(l.id);
    return jsonb_build_object('aplicado', true, 'ruta', v_ruta,
      'mensaje', format('Listo: el lead de %s es tuyo. Llámale y cuéntame qué te dijo («contactado: …»).', v_nombre));
  end if;

  if p_accion in ('contactado', 'no_contesto') then
    -- En bandeja, contestar «le llamé» por un lead que nadie ha tomado es tomarlo: el primero que lo
    -- atiende se lo queda, igual que con «Tomarlo». Si el intento no pasa, tampoco se queda con él.
    if l.estado = 'nuevo' and l.vendedor_id is null and ve_bandeja_leads() then
      perform tomar_lead(l.id);
      v_tomo := true;
      select * into l from leads where id = p_lead;
    end if;
    if l.estado = 'convertido' and l.oportunidad_id is not null then
      -- Ya es oportunidad: el seguimiento va ahí, con sus reglas (decidir al tercero sin avance).
      v_pend := registrar_seguimiento(l.oportunidad_id, case p_accion when 'contactado' then 'contactado' else 'no_contesta' end,
                                      p_texto, coalesce(p_canal, 'llamada'), null, null);
      select vence into v_vence from seguimientos_cotizacion where id = v_pend;
      return jsonb_build_object('aplicado', true, 'ruta', v_ruta, 'mensaje',
        case p_accion when 'contactado' then format('Anotado en la oportunidad de %s.', v_nombre)
                      else format('Anotado: %s no contestó.', v_nombre) end
        || coalesce(format(' El siguiente seguimiento es el %s.', fecha_texto(v_vence)), ''));
    end if;
    v_canal := coalesce(p_canal, 'llamada');
    -- Igual que en la pantalla: por escrito no se espera respuesta al momento, es «Le escribí».
    v_res := case when p_accion = 'contactado' then 'contesto' when v_canal in ('whatsapp', 'correo') then 'enviado' else 'no_contesto' end;
    perform registrar_intento_lead(l.id, v_canal, v_res, p_texto);
    v_msg := case v_res
      when 'contesto' then format('Anotado: %s contestó. Ya lo puedes volver oportunidad en el ERP.', v_nombre)
      when 'enviado' then format('Anotado: le escribiste a %s. Cuando te conteste, mándame «contactado» con lo que te dijo.', v_nombre)
      else format('Anotado: %s no contestó. Vuelve a intentarlo más tarde.', v_nombre) end;
    return jsonb_build_object('aplicado', true, 'ruta', v_ruta,
      'mensaje', case when v_tomo then 'Lo tomaste (ya es tuyo). ' else '' end || v_msg);
  end if;

  if p_accion = 'nota' then
    perform anotar_lead(l.id, p_texto);
    return jsonb_build_object('aplicado', true, 'ruta', v_ruta, 'mensaje',
      case when l.estado = 'convertido' then format('Nota guardada en la oportunidad de %s.', v_nombre)
           else format('Nota guardada en el lead de %s.', v_nombre) end);
  end if;

  if p_accion = 'recordar' then
    if p_cuando is null then
      return jsonb_build_object('aplicado', false, 'ruta', v_ruta, 'mensaje', '¿Para cuándo te lo recuerdo? Dime el día (y la hora, si quieres).');
    end if;
    v_dia := (p_cuando at time zone 'America/Mexico_City')::date;
    v_hora := to_char(p_cuando at time zone 'America/Mexico_City', 'HH24:MI');
    if v_hora = '00:00' then v_hora := null; end if;
    if v_dia < hoy_mx() then
      return jsonb_build_object('aplicado', false, 'ruta', v_ruta, 'mensaje', format('El %s ya pasó: dime otro día.', fecha_texto(v_dia)));
    end if;
    if v_dia > hoy_mx() + 366 then
      return jsonb_build_object('aplicado', false, 'ruta', v_ruta, 'mensaje', 'Te lo puedo recordar hasta dentro de un año: dime otro día.');
    end if;
    insert into pendientes (titulo, detalle, responsable_id, creado_por, vence, tabla, registro_id, ruta)
    values (left(v_nombre || coalesce(' (' || coalesce(l.cliente_nombre, l.empresa) || ')', '') || ': '
                 || coalesce(nullif(trim(p_texto), ''), 'darle seguimiento'), 200),
            concat_ws(' · ', 'Lo pediste por WhatsApp', 'a las ' || v_hora),
            v_yo, v_yo, v_dia, 'leads', l.id::text, v_ruta);
    return jsonb_build_object('aplicado', true, 'ruta', v_ruta, 'mensaje',
      format('Listo: queda en tus pendientes del ERP para el %s%s y sale en tu resumen de ese día.',
             fecha_texto(v_dia), coalesce(' a las ' || v_hora, '')));
  end if;

  if p_accion = 'cotizado' then
    if l.estado = 'convertido' and l.oportunidad_id is not null and puede('ventas', 2) then
      return jsonb_build_object('aplicado', false, 'ruta', '/ventas/cotizaciones/nueva?oportunidad=' || l.oportunidad_id,
        'mensaje', format('Las cotizaciones se hacen en el ERP, no por WhatsApp. Ábrela aquí y queda en la oportunidad de %s:', v_nombre));
    elsif l.estado = 'asignado' then
      return jsonb_build_object('aplicado', false, 'ruta', v_ruta, 'mensaje',
        'Para cotizar, primero vuélvelo oportunidad en el ERP: anota «contactado» con lo que te dijo y dale «Crear oportunidad». Aquí está el lead:');
    end if;
    return jsonb_build_object('aplicado', false, 'ruta', v_ruta, 'mensaje',
      case l.estado when 'nuevo' then 'Ese lead todavía no tiene vendedor: tómalo primero.' else 'Ese lead está descartado: ábrelo en el ERP.' end);
  end if;

  if p_accion = 'cerrado' then
    return jsonb_build_object('aplicado', false, 'ruta', v_ruta, 'mensaje',
      'Los pedidos se capturan en el ERP desde la cotización, no por WhatsApp. Aquí está el lead:');
  end if;

  if p_accion = 'soltar' then
    return jsonb_build_object('aplicado', false, 'ruta', v_ruta, 'mensaje',
      case when puede('leads', 3) then 'Para pasárselo a otro vendedor, ábrelo en el ERP y usa «Pasárselo a otro vendedor»:'
           else 'Un lead tomado no se suelta por WhatsApp: pídele a la gerencia de ventas que lo reasigne.' end);
  end if;

  if p_accion = 'perdido' then
    if l.estado in ('nuevo', 'asignado') then
      perform descartar_lead(l.id, concat_ws(': ', v_motivo, nullif(trim(coalesce(p_texto, '')), '')));
      return jsonb_build_object('aplicado', true, 'ruta', v_ruta,
        'mensaje', format('Listo: el lead de %s quedó descartado%s.', v_nombre, coalesce(' (' || v_motivo || ')', '')));
    elsif l.estado = 'convertido' and l.oportunidad_id is not null then
      -- Con la regla de «no respondió» (255): solo después de insistir. El canal por omisión es
      -- WhatsApp porque es por donde lo está diciendo; si dijo otro, ese.
      perform registrar_seguimiento(l.oportunidad_id, 'perdida', coalesce(nullif(trim(coalesce(p_texto, '')), ''), v_motivo),
                                    coalesce(p_canal, 'whatsapp'), null, v_motivo);
      return jsonb_build_object('aplicado', true, 'ruta', v_ruta,
        'mensaje', format('Listo: la oportunidad de %s quedó como perdida (%s).', v_nombre, v_motivo));
    end if;
    return jsonb_build_object('aplicado', false, 'ruta', v_ruta, 'mensaje',
      case l.estado when 'descartado' then format('El lead de %s ya estaba descartado.', v_nombre)
                    else 'Ese lead ya es cliente y su oportunidad no existe: ciérralo en la ficha del cliente.' end);
  end if;

  raise exception 'Acción desconocida: %', p_accion using errcode = '22023';
end $$;
revoke execute on function public._telefono_aplicar(text, uuid, text, text, text, timestamptz) from public, anon, authenticated;

-- 5. La puerta: una respuesta de WhatsApp ----------------------------------------------------------
-- Solo la función de borde (service_role). Un cuerpo mal hecho es 22023 (400: el conmutador no lo
-- reintenta igual); lo que frena una regla es aplicado:false (200); lo demás, error (500, reintenta).
create or replace function public.telefono_accion(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_id text; v_accion text; qn jsonb; ld jsonb;
  v_tel text; v_tel10 text; v_nombre text; v_texto text; v_motivo text; v_canal text; v_cuando timestamptz;
  v_erp uuid; v_sid text;
  v_prev telefono_acciones; v_perfil uuid; pf perfiles; v_lead uuid;
  v_claims text; v_sub text; v_via text;
  r jsonb; a jsonb; v_estado text; v_err text; v_hint text; v_ruta text;
begin
  if jsonb_typeof(p) is distinct from 'object' then raise exception 'El cuerpo debe ser un objeto' using errcode = '22023'; end if;
  if coalesce(p->>'version', '') <> '1' then raise exception 'Versión del contrato no soportada: %', coalesce(p->>'version', 'ninguna') using errcode = '22023'; end if;
  if coalesce(p->>'tipo', '') <> 'accion' then raise exception 'Tipo no soportado: % (se espera «accion»)', coalesce(p->>'tipo', 'ninguno') using errcode = '22023'; end if;
  v_id := nullif(trim(case when jsonb_typeof(p->'id') = 'string' then p->>'id' end), '');
  if v_id is null or length(v_id) > 100 then raise exception 'id debe ser el message_sid (1 a 100 caracteres)' using errcode = '22023'; end if;
  qn := p->'quien';
  if jsonb_typeof(qn) is distinct from 'object' or jsonb_typeof(qn->'telefono') is distinct from 'string' then
    raise exception 'Falta quien.telefono' using errcode = '22023';
  end if;
  v_tel := trim(qn->>'telefono'); v_tel10 := telefono10(v_tel);
  if v_tel10 is null then raise exception 'quien.telefono debe traer 10 dígitos o más' using errcode = '22023'; end if;
  v_nombre := nullif(trim(case when jsonb_typeof(qn->'nombre') = 'string' then qn->>'nombre' end), '');
  ld := p->'lead';
  if jsonb_typeof(ld) is distinct from 'object' then raise exception 'Falta «lead» (objeto con erp_id o call_sid)' using errcode = '22023'; end if;
  if jsonb_typeof(ld->'erp_id') = 'string' then
    if ld->>'erp_id' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      raise exception 'lead.erp_id debe ser un uuid' using errcode = '22023';
    end if;
    v_erp := (ld->>'erp_id')::uuid;
  elsif jsonb_typeof(ld->'erp_id') not in ('null') then raise exception 'lead.erp_id debe ser un uuid o null' using errcode = '22023';
  end if;
  if jsonb_typeof(ld->'call_sid') = 'string' then v_sid := nullif(trim(ld->>'call_sid'), '');
  elsif jsonb_typeof(ld->'call_sid') not in ('null') then raise exception 'lead.call_sid debe ser texto o null' using errcode = '22023';
  end if;
  if v_erp is null and v_sid is null then raise exception 'lead necesita erp_id o call_sid' using errcode = '22023'; end if;
  v_accion := p->>'accion';
  if v_accion is null or v_accion not in ('tomar', 'contactado', 'no_contesto', 'nota', 'cotizado', 'cerrado', 'perdido', 'recordar', 'soltar') then
    raise exception 'Acción no soportada: %', coalesce(v_accion, 'ninguna') using errcode = '22023';
  end if;
  if jsonb_typeof(p->'texto') not in ('string', 'null') or length(p->>'texto') > 1000 then raise exception 'texto debe ser texto de hasta 1000 caracteres o null' using errcode = '22023'; end if;
  if jsonb_typeof(p->'motivo') not in ('string', 'null') or length(p->>'motivo') > 300 then raise exception 'motivo debe ser texto de hasta 300 caracteres o null' using errcode = '22023'; end if;
  if jsonb_typeof(p->'canal') not in ('string', 'null') or (p->>'canal') not in ('llamada', 'whatsapp', 'correo', 'visita') then
    raise exception 'canal debe ser llamada, whatsapp, correo, visita o null' using errcode = '22023';
  end if;
  if jsonb_typeof(p->'cuando') not in ('string', 'null') then raise exception 'cuando debe ser una fecha ISO o null' using errcode = '22023'; end if;
  begin
    v_cuando := (nullif(trim(p->>'cuando'), ''))::timestamptz;
  exception when others then raise exception 'cuando no es una fecha: %', p->>'cuando' using errcode = '22023';
  end;
  v_texto := nullif(trim(coalesce(p->>'texto', '')), '');
  v_motivo := nullif(trim(coalesce(p->>'motivo', '')), '');
  v_canal := p->>'canal';

  -- El mismo mensaje dos veces (reintento del conmutador) se forma y regresa lo que ya se contestó.
  perform pg_advisory_xact_lock(hashtext('telefono_accion:' || v_id));
  select * into v_prev from telefono_acciones where id = v_id;
  if v_prev.id is not null then return v_prev.respuesta; end if;

  v_perfil := _telefono_perfil_de(v_tel);
  select * into pf from perfiles where id = v_perfil;
  if v_perfil is null then
    -- Queda en «Quién contesta» sin persona, para que dirección lo ligue una vez.
    insert into telefono_directorio (clave, nombre, telefono) values (v_tel10, coalesce(v_nombre, v_tel), v_tel)
    on conflict (clave) do update set visto_en = now(), telefono = coalesce(telefono_directorio.telefono, excluded.telefono);
    r := jsonb_build_object('ok', true, 'aplicado', false, 'lead', null, 'ruta', null,
      'mensaje', 'Tu número no está ligado en el ERP; pídele a dirección que lo ligue en Configuración → Integraciones → Teléfono');
  elsif not pf.activo then
    r := jsonb_build_object('ok', true, 'aplicado', false, 'lead', null, 'ruta', null,
      'mensaje', 'Tu usuario del ERP está dado de baja: desde aquí no se anota nada. Habla con dirección.');
  elsif exists (select 1 from simulacion_rol s join usuario_roles u on u.usuario_id = s.usuario_id and u.rol = 'direccion'
                where s.usuario_id = v_perfil) then
    -- Mientras dirección ve el ERP como otro rol, mis_roles() regresa el simulado: lo que se aplicara
    -- iría con permisos que no son los suyos. No se suplanta a nadie a media simulación.
    r := jsonb_build_object('ok', true, 'aplicado', false, 'lead', null, 'ruta', null,
      'mensaje', 'Estás viendo el ERP como otro rol («Ver como»). Regresa a tu vista en el ERP y vuelve a mandarlo.');
  else
    if v_erp is not null then select id into v_lead from leads where id = v_erp; end if;
    if v_lead is null and v_sid is not null then
      select ll.lead_id into v_lead from llamadas ll join leads l on l.id = ll.lead_id where ll.call_sid = v_sid;
    end if;
    if v_lead is null then
      r := jsonb_build_object('ok', true, 'aplicado', false, 'lead', null, 'ruta', '/ventas/leads',
        'mensaje', 'No encontré ese lead en el ERP. Contesta citando el aviso del lead, o búscalo en Leads:');
    else
      -- Como él: se guarda la sesión de quien llama (la función de borde) y se regresa al terminar,
      -- también si algo truena. Los set_config locales además se deshacen solos al salir del bloque
      -- con error y al salir de esta función (tiene «set search_path»), pero no se confía en eso.
      v_claims := current_setting('request.jwt.claims', true);
      v_sub := current_setting('request.jwt.claim.sub', true);
      v_via := current_setting('hegamex.via', true);
      begin
        perform set_config('request.jwt.claims', json_build_object('sub', v_perfil, 'role', 'authenticated')::text, true);
        perform set_config('request.jwt.claim.sub', '', true);   -- auth.uid() lo lee primero
        perform set_config('hegamex.via', 'whatsapp', true);
        a := _telefono_aplicar(v_accion, v_lead, v_texto, v_motivo, v_canal, v_cuando);
        perform set_config('request.jwt.claims', coalesce(v_claims, ''), true);
        perform set_config('request.jwt.claim.sub', coalesce(v_sub, ''), true);
        perform set_config('hegamex.via', coalesce(v_via, ''), true);
      exception when others then
        get stacked diagnostics v_estado = returned_sqlstate, v_err = message_text, v_hint = pg_exception_hint;
        perform set_config('request.jwt.claims', coalesce(v_claims, ''), true);
        perform set_config('request.jwt.claim.sub', coalesce(v_sub, ''), true);
        perform set_config('hegamex.via', coalesce(v_via, ''), true);
        -- Las reglas de negocio (raise de las funciones, permisos, checks, datos) se le contestan al
        -- vendedor. Un error del sistema no se guarda como respuesta: sube y el conmutador reintenta.
        if v_estado not in ('P0001', '42501') and left(v_estado, 2) not in ('22', '23') then raise; end if;
        v_ruta := '/ventas/leads?id=' || v_lead;
        a := jsonb_build_object('aplicado', false, 'ruta', v_ruta, 'mensaje',
          v_err || case coalesce(v_hint, '') when 'decidir' then ' Eso se decide en el ERP:'
                                             when 'sin_respuesta' then ' Mándame «no contestó» cada vez que le marques.'
                                             else '' end);
      end;
      r := jsonb_build_object('ok', true, 'aplicado', coalesce((a->>'aplicado')::boolean, false), 'mensaje', a->>'mensaje',
        'lead', case when coalesce((a->>'visible')::boolean, true) then _telefono_lead_json(v_lead) end,
        'ruta', a->>'ruta');
    end if;
  end if;

  insert into telefono_acciones (id, telefono10, perfil_id, lead_id, accion, aplicado, respuesta)
  values (v_id, v_tel10, case when pf.id is not null then pf.id end, v_lead, v_accion, (r->>'aplicado')::boolean, r);
  return r;
end $$;
revoke execute on function public.telefono_accion(jsonb) from public, anon, authenticated;
grant execute on function public.telefono_accion(jsonb) to service_role;

-- 6. El resumen de la mañana de un vendedor -----------------------------------------------------------
-- Lo pide el conmutador (GET /resumen) para mandarlo por WhatsApp. Es definer y sin sesión: aquí no
-- hay RLS que filtre, así que cada parte filtra a mano por ese vendedor, con las mismas reglas de las
-- pantallas («Sin contactar», «Regresar llamada» como mis_llamadas(), seguimientos y pendientes que
-- vencen hoy o ya vencieron). Sin montos. La liga a «A quién llamar hoy» la pone la función de borde,
-- que sabe la dirección del ERP.
create or replace function public.telefono_resumen(p_tel text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_perfil uuid := _telefono_perfil_de(p_tel); pf perfiles; v_reparte boolean; v_hoy date := hoy_mx();
  v_partes text[] := '{}'; v_n int; v_lista text; v_venc int;
begin
  if telefono10(p_tel) is null then raise exception 'Teléfono inválido' using errcode = '22023'; end if;
  select * into pf from perfiles where id = v_perfil and activo;
  if pf.id is null then return jsonb_build_object('ok', true, 'vendedor', null, 'texto', null); end if;
  -- Quien reparte leads (gerencia, dirección, recepción) también ve lo que no es de nadie. Con sus
  -- roles de verdad: el resumen no es una sesión y no simula nada.
  v_reparte := exists (select 1 from usuario_roles u join permisos_rol pr on pr.rol = u.rol
                       where u.usuario_id = pf.id and pr.modulo = 'leads' and pr.nivel >= 3)
            or exists (select 1 from usuario_roles u where u.usuario_id = pf.id and u.rol = 'recepcion');

  -- Leads sin contactar: asignados a él y sin ningún intento (lo mismo que «Sin contactar»).
  select count(*), string_agg(x.t, '; ') filter (where x.i <= 4) into v_n, v_lista
  from (select l.nombre || coalesce(' (' || coalesce(l.cliente_nombre, l.empresa) || ')', '') t,
               row_number() over (order by l.asignado_en) i
        from leads l
        where l.estado = 'asignado' and l.vendedor_id = pf.id
          and not exists (select 1 from lead_intentos x where x.lead_id = l.id)) x;
  if v_n > 0 then
    v_partes := v_partes || format('*Leads sin contactar (%s):* %s%s', v_n, v_lista, case when v_n > 4 then format('; y %s más', v_n - 4) else '' end);
  end if;

  -- Regresar llamada: nadie contestó, en 7 días, de su cliente o su lead (o de nadie, si reparte).
  select count(*), string_agg(x.t, '; ') filter (where x.i <= 4) into v_n, v_lista
  from (select coalesce(ll.lead_nombre, ll.cliente_nombre, ll.telefono, 'Sin número') || ' (' ||
               case when now() - coalesce(ll.inicio, ll.creado_en) < interval '1 hour' then 'hace ' || greatest(1, floor(extract(epoch from now() - coalesce(ll.inicio, ll.creado_en)) / 60))::int || ' min'
                    when now() - coalesce(ll.inicio, ll.creado_en) < interval '24 hours' then 'hace ' || floor(extract(epoch from now() - coalesce(ll.inicio, ll.creado_en)) / 3600)::int || ' h'
                    else fecha_texto((coalesce(ll.inicio, ll.creado_en) at time zone 'America/Mexico_City')::date) end || ')' t,
               row_number() over (order by coalesce(ll.inicio, ll.creado_en) desc) i
        from llamadas ll
        left join clientes c on c.id = ll.cliente_id
        left join leads l on l.id = ll.lead_id
        where ll.nadie_contesto and ll.regresada_en is null and not ll.historica
          and coalesce(ll.inicio, ll.creado_en) >= now() - interval '7 days'
          and (c.vendedor_id = pf.id or l.vendedor_id = pf.id
               or (v_reparte and c.vendedor_id is null and l.vendedor_id is null))) x;
  if v_n > 0 then
    v_partes := v_partes || format('*Regresar llamada (%s):* %s%s', v_n, v_lista, case when v_n > 4 then format('; y %s más', v_n - 4) else '' end);
  end if;

  -- Seguimientos de cotización de hoy y vencidos (el folio, nunca el importe).
  select count(*), count(*) filter (where x.vence < v_hoy), string_agg(x.t, '; ') filter (where x.i <= 4) into v_n, v_venc, v_lista
  from (select s.vence, coalesce(c.nombre, o.titulo, 'Oportunidad') || coalesce(' ' || cot.folio, '')
               || case when s.vence < v_hoy then ', venció ' || fecha_texto(s.vence) else '' end t,
               row_number() over (order by s.vence, c.nombre) i
        from seguimientos_cotizacion s
        join oportunidades o on o.id = s.oportunidad_id
        left join clientes c on c.id = o.cliente_id
        left join cotizaciones cot on cot.id = s.cotizacion_id
        where s.vendedor_id = pf.id and s.estado = 'pendiente' and s.vence <= v_hoy) x;
  if v_n > 0 then
    v_partes := v_partes || format('*Seguimiento de cotizaciones (%s%s):* %s%s', v_n,
      case when v_venc > 0 then format(', %s %s', v_venc, case when v_venc = 1 then 'vencido' else 'vencidos' end) else '' end,
      v_lista, case when v_n > 4 then format('; y %s más', v_n - 4) else '' end);
  end if;

  -- Pendientes suyos que vencen hoy o ya vencieron.
  select count(*), string_agg(x.t, '; ') filter (where x.i <= 4) into v_n, v_lista
  from (select left(_telefono_sin_montos(p.titulo), 90) || case when p.vence < v_hoy then ' (era para el ' || fecha_texto(p.vence) || ')' else '' end t,
               row_number() over (order by p.vence, p.creado_en) i
        from pendientes p
        where p.responsable_id = pf.id and p.estado = 'abierto' and p.vence <= v_hoy) x;
  if v_n > 0 then
    v_partes := v_partes || format('*Pendientes (%s):* %s%s', v_n, v_lista, case when v_n > 4 then format('; y %s más', v_n - 4) else '' end);
  end if;

  if cardinality(v_partes) = 0 then return jsonb_build_object('ok', true, 'vendedor', pf.nombre, 'texto', null); end if;
  return jsonb_build_object('ok', true, 'vendedor', pf.nombre, 'ruta', '/ventas/para-llamar',
    'texto', left(_telefono_sin_montos(format('Buenos días, %s. Lo tuyo de hoy en el ERP:', split_part(pf.nombre, ' ', 1))
                  || E'\n\n' || array_to_string(v_partes, E'\n\n')), 1300));
end $$;
revoke execute on function public.telefono_resumen(text) from public, anon, authenticated;
grant execute on function public.telefono_resumen(text) to service_role;

-- 7. «Ya entró por teléfono» -------------------------------------------------------------------------
-- Al registrar un lead a mano: si ese número llamó en los últimos 7 días, cuándo, si la IA dejó su
-- lead, de quién es y en qué va. Lo mínimo para no capturarlo dos veces (como buscar_cliente_lead:
-- nombres, sin ventas ni datos de contacto). «lo_ves» dice si quien pregunta puede abrir ese lead
-- (la misma regla de la RLS de leads): recepción no abre el lead de la IA, el vendedor el suyo sí.
create or replace function public.llamada_reciente_de(p_tel text)
returns table (cuando timestamptz, nadie_contesto boolean, lead_id uuid, lead_nombre text, vendedor text, estado text, lo_ves boolean)
language plpgsql stable security definer set search_path = public as $$
declare v_tel text := telefono10(p_tel); v_yo uuid := auth.uid(); v_ger boolean; v_bandeja boolean;
begin
  if not puede('leads', 2) then raise exception 'Sin permiso para registrar leads' using errcode = '42501'; end if;
  if v_tel is null then return; end if;
  v_ger := puede('leads', 3); v_bandeja := ve_bandeja_leads();
  return query
  select coalesce(ll.inicio, ll.creado_en), ll.nadie_contesto, l.id, l.nombre, pv.nombre, l.estado,
    coalesce(l.id is not null and (v_ger or l.capturado_por = v_yo or l.vendedor_id = v_yo or (l.estado = 'nuevo' and v_bandeja)), false)
  from llamadas ll
  left join leads l on l.id = ll.lead_id
  left join perfiles pv on pv.id = l.vendedor_id
  where ll.telefono10 = v_tel and coalesce(ll.inicio, ll.creado_en) >= now() - interval '7 days'
  order by (l.id is not null) desc, coalesce(ll.inicio, ll.creado_en) desc
  limit 3;
end $$;
revoke execute on function public.llamada_reciente_de(text) from public, anon;
grant execute on function public.llamada_reciente_de(text) to authenticated;

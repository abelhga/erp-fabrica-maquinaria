-- =============================================================================
-- Perder con más cuidado: «No respondió» solo después de insistir, decidir en vez de dar vueltas
-- y decir siempre por dónde fue el seguimiento.
--
-- Por qué, con lo que pasó en la nube del 6 oct al 6 nov de 2026:
-- (a) De 82 oportunidades perdidas, 63 fueron por «No respondió», ninguna con dos «No contestó»
--     antes (58 sin ninguno) y 37 a menos de 10 días hábiles del envío, por $22.1 M estimados.
--     Se daban por perdidas ventas a las que nadie les volvió a llamar: el embudo se vaciaba de
--     cosas vivas y no sabíamos por qué se pierde de verdad. Ahora «No respondió» (o un motivo
--     escrito que diga lo mismo) solo entra con 2 «No contestó» en días distintos o con 10 días
--     hábiles desde la última versión enviada. Vale por los tres caminos: «¿Qué pasó?», arrastrar
--     la tarjeta a Perdida y «Marcar rechazada…»; si solo se cerrara uno, la gente se iría por otro.
--     En días distintos porque tres «No contestó» se anotan en diez segundos.
-- (b) Hay 25 oportunidades abiertas con dos «Sigue en pie»/«No contestó» seguidos. Al tercero se
--     pide decidir: una fecha con su porqué, Negociación o perdida. Así ninguna venta da vueltas
--     cada dos o tres días sin que nadie decida nada.
-- (c) El 74 % de los seguimientos quedaban como «llamada» (el valor por omisión) y 1 de cada 5 de
--     esas notas dice que fue mensaje; en Leads, 247 de 247 intentos del mes quedaron como WhatsApp.
--     El canal ya no viene puesto: la base lo pide.
--
-- Los umbrales viven en configuracion (seguimiento_cotizaciones) para afinarlos sin desplegar.
-- Las cargas sin sesión (servicio, importación) no se frenan. La gerencia sí: la regla es de la
-- venta, no de quién la captura.
-- =============================================================================

-- 0. Configuración, columna e índice -------------------------------------------------------------

-- 172 con tres llaves más; el resto igual.
create or replace function public._config_seguimiento() returns jsonb
language sql stable set search_path = public as $$
  select '{"dias_habiles": 3, "dias_no_contesta": 2, "tope_vencidos": 10, "por_dia_al_arrancar": 8,
           "no_contesto_para_perder": 2, "dias_para_perder": 10, "racha_para_decidir": 3}'::jsonb
         || coalesce((select valor from configuracion where clave = 'seguimiento_cotizaciones'), '{}'::jsonb)
$$;

update public.configuracion
set valor = '{"no_contesto_para_perder": 2, "dias_para_perder": 10, "racha_para_decidir": 3}'::jsonb || valor,
    descripcion = 'Seguimiento de cotizaciones: días hábiles para preguntar qué pasó después de enviarla (y después de un «no contestó»), cuántos vencidos frenan el envío de cotizaciones nuevas y cuántos por día se repartieron al arrancar. Para perderla porque no respondió: cuántos «no contestó» en días distintos o cuántos días hábiles desde el último envío; y al cuántos «sigue en pie»/«no contestó» seguidos se pide decidir.'
where clave = 'seguimiento_cotizaciones';

-- Por qué se dio otra fecha cuando ya iban varios seguidos: para medir y para la revisión nocturna.
alter table public.seguimientos_cotizacion add column if not exists motivo_fecha text;
comment on column public.seguimientos_cotizacion.motivo_fecha is
  'Por qué esa fecha, cuando el seguimiento ya llevaba varios «sigue en pie»/«no contestó» seguidos (racha_para_decidir).';

-- Solo había índice de los pendientes; las reglas leen los hechos de cada oportunidad.
create index if not exists seguimientos_hechos_por_oportunidad on public.seguimientos_cotizacion (oportunidad_id, cerrado_en)
  where estado = 'hecho';

-- 1. ¿Este motivo es «no respondió»? -------------------------------------------------------------
-- Atrapa también el texto libre («U otro motivo»), no solo la sugerencia: si no, se escribe a mano.
create or replace function public.es_motivo_sin_respuesta(p_motivo text) returns boolean
language sql immutable set search_path = public as $$
  select sin_acentos(coalesce(p_motivo, '')) ~
    '(no (respond|contest|regres|dio respuesta|ha (respond|contest))|sin respuesta|dejo de (contestar|responder)|nunca (respond|contest|regres))'
$$;

-- 2. Cómo va la venta para las reglas (a) y (b): la única fuente, la usan la función, los
--    disparadores y la pantalla. Cuenta en el calendario de oficina (sumar_dias_laborables, el de
--    los 3 días del seguimiento), no en el del taller, que puede cambiar sin pensar en ventas.
--    «Desde el envío» es la ÚLTIMA versión enviada: con otra versión de hace 2 días el cliente no
--    ha tenido tiempo de responder. Sin envío, desde que se creó la oportunidad.
create or replace function public._estado_seguimiento(p_op uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  with cfg as (select _config_seguimiento() c),
  env as (select max(enviada_en) en from cotizaciones where oportunidad_id = p_op),
  base as (select coalesce((select en from env), (select creado_en from oportunidades where id = p_op)) desde),
  nc as (select count(distinct (cerrado_en at time zone 'America/Mexico_City')::date) n from seguimientos_cotizacion
         where oportunidad_id = p_op and estado = 'hecho' and resultado = 'no_contesta'),
  h as (select resultado, cerrado_en from seguimientos_cotizacion
        where oportunidad_id = p_op and estado = 'hecho' and cerrado_en > coalesce((select en from env), '-infinity')),
  racha as (select count(*) n from h where resultado in ('sigue', 'no_contesta')
            and cerrado_en > coalesce((select max(cerrado_en) from h where resultado not in ('sigue', 'no_contesta')), '-infinity')),
  lim as (select sumar_dias_laborables((desde at time zone 'America/Mexico_City')::date, (c->>'dias_para_perder')::int) f from base, cfg)
  select jsonb_build_object(
    'no_contesto', nc.n, 'no_contesto_pide', (c->>'no_contesto_para_perder')::int,
    'enviada', (base.desde at time zone 'America/Mexico_City')::date,
    'sin_respuesta_desde', lim.f, 'dias_pide', (c->>'dias_para_perder')::int,
    'dias_no_contesta', (c->>'dias_no_contesta')::int,
    'puede_sin_respuesta', nc.n >= (c->>'no_contesto_para_perder')::int or hoy_mx() >= lim.f,
    'racha', racha.n, 'decidir', racha.n + 1 >= (c->>'racha_para_decidir')::int)
  from cfg, base, nc, racha, lim
$$;
revoke execute on function public._estado_seguimiento(uuid) from public, anon, authenticated;

-- 3. El mismo texto por los tres caminos (diálogo, tablero, rechazo). Nunca nombra a nadie.
create or replace function public._mensaje_sin_respuesta(e jsonb) returns text
language sql immutable set search_path = public as $$
  select format('Todavía no se puede dar por perdida porque no respondió: hacen falta %s «No contestó» anotados en días distintos (esta venta lleva %s) o %s días hábiles desde que se envió la cotización (se cumplen el %s). Mientras, anota «No contestó» y se vuelve a intentar en %s días hábiles. Si el cliente te dijo que no, elige el motivo que te dio.',
    e->>'no_contesto_pide', e->>'no_contesto', e->>'dias_pide', fecha_texto((e->>'sin_respuesta_desde')::date), e->>'dias_no_contesta')
$$;
revoke execute on function public._mensaje_sin_respuesta(jsonb) from public, anon, authenticated;

-- 4. Para la pantalla: definer porque cuenta seguimientos y cotizaciones aunque la oportunidad se
--    haya reasignado; por eso revisa quién pregunta antes de nada.
create or replace function public.estado_seguimiento(p_oportunidad uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare o oportunidades;
begin
  select * into o from oportunidades where id = p_oportunidad;
  if not found then raise exception 'No encontré esa oportunidad'; end if;
  if not ((o.vendedor_id = auth.uid() and puede('ventas', 2)) or puede('ventas', 3)) then
    raise exception 'Solo el vendedor de la oportunidad o la gerencia de ventas' using errcode = '42501';
  end if;
  return _estado_seguimiento(o.id);
end $$;
revoke execute on function public.estado_seguimiento(uuid) from public, anon;
grant execute on function public.estado_seguimiento(uuid) to authenticated;

-- 5. registrar_seguimiento de 172 con el canal obligatorio y las reglas (a) y (b).
--    El canal ya no tiene valor por omisión: el que viajaba era el de la base, no el de la persona.
--    Cuando toca decidir (b), p_motivo lleva «por qué esa fecha»: así no cambia la firma ni nace
--    otra versión de la función con más parámetros.
create or replace function public.registrar_seguimiento(p_oportunidad uuid, p_resultado text, p_que_paso text default null,
  p_canal text default null, p_proxima date default null, p_motivo text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  o oportunidades;
  cfg jsonb := _config_seguimiento();
  v_texto text := nullif(trim(coalesce(p_que_paso, '')), '');
  v_desc text; v_act uuid; v_cot uuid; v_vence date; v_pend uuid;
  v_estado jsonb; v_decidir boolean;
begin
  select * into o from oportunidades where id = p_oportunidad;
  if not found then raise exception 'No encontré esa oportunidad'; end if;
  if not ((o.vendedor_id = auth.uid() and puede('ventas', 2)) or puede('ventas', 3)) then
    raise exception 'El seguimiento lo anota el vendedor de la oportunidad o la gerencia de ventas' using errcode = '42501';
  end if;
  if o.etapa in ('ganada', 'perdida') then raise exception 'Esa oportunidad ya está cerrada'; end if;
  if p_resultado is null or p_resultado not in ('sigue', 'no_contesta', 'contactado', 'negociacion', 'perdida') then
    raise exception 'Elige qué resultado tuvo';
  end if;
  if coalesce(p_canal, '') not in ('llamada', 'whatsapp', 'correo', 'visita', 'nota') then
    raise exception 'Elige por dónde fue: llamada, WhatsApp, correo o visita' using errcode = '23514';
  end if;
  if p_resultado = 'no_contesta' then v_texto := coalesce(v_texto, 'No contestó'); end if;
  if coalesce(length(v_texto), 0) < 3 then
    raise exception 'Anota qué pasó (lo que dijo el cliente, qué sigue): sin eso no se cierra el seguimiento' using errcode = '23514';
  end if;
  if p_resultado = 'perdida' and coalesce(length(trim(p_motivo)), 0) < 3 then
    raise exception 'Elige por qué se perdió: sin eso no sabemos qué corregir' using errcode = '23514';
  end if;
  if p_proxima is not null and (p_proxima < hoy_mx() or p_proxima > hoy_mx() + 120) then
    raise exception 'El siguiente seguimiento va de hoy a cuatro meses';
  end if;

  -- Antes de escribir nada: los disparadores lo vuelven a revisar, pero así no queda nada a medias.
  v_estado := _estado_seguimiento(o.id);
  v_decidir := p_resultado in ('sigue', 'no_contesta') and (v_estado->>'decidir')::boolean;
  if p_resultado = 'perdida' and es_motivo_sin_respuesta(p_motivo) and not (v_estado->>'puede_sin_respuesta')::boolean then
    raise exception '%', _mensaje_sin_respuesta(v_estado) using errcode = '23514', hint = 'sin_respuesta';
  end if;
  if v_decidir and (p_proxima is null or coalesce(length(trim(p_motivo)), 0) < 3) then
    raise exception 'Ya van % seguimientos seguidos sin avance («Sigue en pie» o «No contestó»). Decide qué sigue: pon la fecha en que le vuelves a buscar y por qué esa fecha, pásala a Negociación o dala por perdida.',
      (v_estado->>'racha')::int + 1 using errcode = '23514', hint = 'decidir';
  end if;

  -- La nota va a la bitácora comercial: es contacto de verdad (cuenta para la cartera y el bono).
  v_desc := case p_resultado
    when 'no_contesta' then case when v_texto = 'No contestó' then v_texto else 'No contestó: ' || v_texto end
    when 'contactado' then 'Contactado: ' || v_texto
    when 'negociacion' then 'Negociando: ' || v_texto
    when 'perdida' then 'Se perdió (' || trim(p_motivo) || '): ' || v_texto
    else v_texto end;
  if v_decidir then v_desc := v_desc || ' · Nueva fecha ' || fecha_texto(p_proxima) || ': ' || trim(p_motivo); end if;
  insert into actividades (cliente_id, oportunidad_id, tipo, descripcion) values (o.cliente_id, o.id, p_canal, v_desc)
  returning id into v_act;

  select cotizacion_id into v_cot from seguimientos_cotizacion where oportunidad_id = o.id and estado = 'pendiente';
  v_cot := coalesce(v_cot, (select c.id from cotizaciones c where c.oportunidad_id = o.id and c.estado = 'enviada'
                            order by c.enviada_en desc nulls last limit 1));
  update seguimientos_cotizacion set estado = 'hecho', resultado = p_resultado, que_paso = v_texto, actividad_id = v_act,
    cerrado_en = now(), cerrado_por = auth.uid(), motivo_fecha = case when v_decidir then trim(p_motivo) end
  where oportunidad_id = o.id and estado = 'pendiente';

  if p_resultado = 'perdida' then
    -- Los borradores se quedan como están: rechazarlos les gastaría un folio.
    update cotizaciones set estado = 'rechazada', motivo_rechazo = trim(p_motivo)
    where oportunidad_id = o.id and estado in ('por_autorizar', 'autorizada', 'enviada');
    update oportunidades set etapa = 'perdida', motivo_perdida = trim(p_motivo) where id = o.id;
    return null;
  end if;

  if p_resultado = 'negociacion' and o.etapa <> 'negociacion' then
    perform set_config('hegamex.que_paso', '1', true);
    update oportunidades set etapa = 'negociacion' where id = o.id;
    perform set_config('hegamex.que_paso', '0', true);
  elsif p_resultado = 'contactado' and o.etapa = 'prospecto' then
    update oportunidades set etapa = 'contactado' where id = o.id;
  end if;

  -- El siguiente: la fecha que dieron, o el plazo de siempre mientras siga viva la cotización.
  v_vence := coalesce(p_proxima, case
    when p_resultado = 'no_contesta' then sumar_dias_laborables(hoy_mx(), (cfg->>'dias_no_contesta')::int)
    when p_resultado in ('sigue', 'negociacion') or v_cot is not null then sumar_dias_laborables(hoy_mx(), (cfg->>'dias_habiles')::int)
  end);
  if v_vence is not null then
    v_pend := _programar_seguimiento(o.id, v_cot, coalesce(o.vendedor_id, auth.uid()), v_vence);
  end if;
  return v_pend;
end $$;
comment on function public.registrar_seguimiento(uuid, text, text, text, date, text) is
  'Cierra el seguimiento con qué pasó. p_canal es obligatorio. p_motivo: por qué se perdió (resultado perdida) o, cuando ya van racha_para_decidir «sigue»/«no_contesta» seguidos, por qué esa fecha (p_proxima también obligatoria).';
revoke execute on function public.registrar_seguimiento(uuid, text, text, text, date, text) from public, anon;
grant execute on function public.registrar_seguimiento(uuid, text, text, text, date, text) to authenticated;

-- 6. Las puertas de al lado: arrastrar la tarjeta a Perdida (update directo de oportunidades) y
--    «Marcar rechazada…» (rechazar_cotizacion, con o sin cerrar la oportunidad). Sin esto el
--    candado de «¿Qué pasó?» solo movería la pérdida a otra pantalla. Sin sesión no se frena.
create or replace function public.trg_perder_sin_respuesta() returns trigger
language plpgsql security definer set search_path = public as $$
declare e jsonb; v_op uuid; v_m text;
begin
  if auth.uid() is null then return new; end if;
  if tg_table_name = 'oportunidades' then
    if new.etapa <> 'perdida' or (old.etapa = 'perdida' and old.motivo_perdida is not distinct from new.motivo_perdida) then return new; end if;
    v_op := new.id; v_m := new.motivo_perdida;
  else
    if new.estado <> 'rechazada' or old.estado = 'rechazada' or new.oportunidad_id is null then return new; end if;
    v_op := new.oportunidad_id; v_m := new.motivo_rechazo;
  end if;
  if es_motivo_sin_respuesta(v_m) then
    e := _estado_seguimiento(v_op);
    if not (e->>'puede_sin_respuesta')::boolean then
      raise exception '%', _mensaje_sin_respuesta(e) using errcode = '23514', hint = 'sin_respuesta';
    end if;
  end if;
  return new;
end $$;
revoke execute on function public.trg_perder_sin_respuesta() from public, anon, authenticated;

drop trigger if exists perder_sin_respuesta on public.oportunidades;
create trigger perder_sin_respuesta before update of etapa, motivo_perdida on public.oportunidades
  for each row execute function public.trg_perder_sin_respuesta();
drop trigger if exists rechazar_sin_respuesta on public.cotizaciones;
create trigger rechazar_sin_respuesta before update of estado on public.cotizaciones
  for each row execute function public.trg_perder_sin_respuesta();

-- 7. registrar_intento_lead de 235 con el canal obligatorio: un canal nulo chocaba con el not null
--    de lead_intentos y el error salía en inglés.
create or replace function public.registrar_intento_lead(p_lead uuid, p_canal text, p_resultado text, p_nota text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare l leads; v uuid;
begin
  select * into l from leads where id = p_lead;
  if l.id is null then raise exception 'Ese lead no existe'; end if;
  if not ((l.vendedor_id = auth.uid() and puede('ventas', 2)) or (puede('leads', 3) and puede('ventas', 2))) then
    raise exception 'Solo el vendedor que lo tiene (o la gerencia) anota sus intentos' using errcode = '42501';
  end if;
  if l.estado <> 'asignado' then raise exception 'Este lead ya está %', case l.estado when 'nuevo' then 'sin vendedor: tómalo primero' else l.estado end; end if;
  if coalesce(p_canal, '') not in ('llamada', 'whatsapp', 'correo', 'visita') then
    raise exception 'Elige por dónde fue: llamada, WhatsApp, correo o visita' using errcode = '23514';
  end if;
  if p_resultado = 'contesto' and coalesce(length(trim(p_nota)), 0) < 5 then
    raise exception 'Escribe qué te dijo (qué busca, para cuándo): es lo que hace que ya sea oportunidad';
  end if;
  if p_resultado = 'enviado' and p_canal not in ('whatsapp', 'correo') then
    raise exception '«Le escribí» es para WhatsApp o correo; una llamada o visita sin respuesta es «no contestó»' using errcode = '23514';
  end if;
  insert into lead_intentos (lead_id, canal, resultado, nota) values (p_lead, p_canal, p_resultado, nullif(trim(p_nota), ''))
  returning id into v;
  return v;
end $$;

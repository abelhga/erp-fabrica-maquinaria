-- =============================================================================
-- Un lead se vuelve oportunidad cuando el cliente contestó, no para apartarlo.
--
-- «Crear oportunidad» no pedía nada: daba de alta al cliente a nombre del vendedor y con eso
-- sus próximos leads le llegaban directo. Del 22 al 30 de octubre se volvieron oportunidad 191
-- leads; 106 sin una sola cotización ni actividad después, hasta 15 en 12 minutos. Salieron 190
-- clientes nuevos en una semana (14 ya existían con el mismo teléfono; dos personas quedaron dos
-- veces, una de cada vendedor) y 160 oportunidades que nunca se movieron de «Prospecto».
--
-- Ahora:
-- * Cada intento se anota en el lead (llamada, WhatsApp, correo, visita) con su resultado.
--   «Contestó» pide qué dijo: es la prueba de que hubo plática.
-- * convertir_lead exige un «contestó». Mientras no contesten, el lead sigue siendo lead.
-- * Un cliente nuevo no se da de alta si su teléfono o correo ya es de otro cliente: el error dice
--   cuál y de quién, para elegirlo en vez de duplicarlo (antes solo se buscaba dentro del cliente
--   elegido).
-- * La revisión nocturna avisa a dirección, como patrón y por vendedor, de los leads tomados sin
--   ningún intento y de las oportunidades de lead que no se mueven.
-- =============================================================================

create table if not exists public.lead_intentos (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  usuario_id uuid not null default auth.uid() references public.perfiles(id),
  canal text not null check (canal in ('llamada', 'whatsapp', 'correo', 'visita')),
  resultado text not null check (resultado in ('contesto', 'no_contesto')),
  nota text,
  en timestamptz not null default clock_timestamp(),   -- dos intentos seguidos no empatan en el «último»
  check (resultado <> 'contesto' or length(trim(nota)) >= 5)
);
create index if not exists lead_intentos_lead on public.lead_intentos (lead_id, en desc);
alter table public.lead_intentos enable row level security;
-- Los ve quien ve el lead (la RLS de leads decide dentro del subselect, una vez por consulta).
drop policy if exists ver on public.lead_intentos;
create policy ver on public.lead_intentos for select to authenticated using (lead_id in (select id from public.leads));
grant select on public.lead_intentos to authenticated;
drop trigger if exists auditar on public.lead_intentos;
create trigger auditar after insert or delete or update on public.lead_intentos for each row execute function public.auditar();

-- Quién atiende un lead: el vendedor que lo tiene, o la gerencia (lo mismo que para convertirlo).
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
  if p_resultado = 'contesto' and coalesce(length(trim(p_nota)), 0) < 5 then
    raise exception 'Escribe qué te dijo (qué busca, para cuándo): es lo que hace que ya sea oportunidad';
  end if;
  insert into lead_intentos (lead_id, canal, resultado, nota) values (p_lead, p_canal, p_resultado, nullif(trim(p_nota), ''))
  returning id into v;
  return v;
end $$;
revoke execute on function public.registrar_intento_lead(uuid, text, text, text) from public, anon;
grant execute on function public.registrar_intento_lead(uuid, text, text, text) to authenticated;

-- El cliente que ya tiene ese teléfono (últimos 10 dígitos) o correo, para no darlo de alta otra vez.
create or replace function public.cliente_con_contacto(p_telefono text, p_correo text)
returns table (cliente_id uuid, nombre text, vendedor text, por text)
language sql stable security definer set search_path = public as $$
  with t as (select right(regexp_replace(coalesce(p_telefono, ''), '\D', '', 'g'), 10) tel, lower(trim(coalesce(p_correo, ''))) correo)
  select c.id, c.nombre, p.nombre,
    case when length(t.tel) = 10 and (right(regexp_replace(coalesce(ct.telefono, ''), '\D', '', 'g'), 10) = t.tel
                                      or right(regexp_replace(coalesce(ct.whatsapp, ''), '\D', '', 'g'), 10) = t.tel) then 'teléfono' else 'correo' end
  from t, contactos ct join clientes c on c.id = ct.cliente_id and c.activo
  left join perfiles p on p.id = c.vendedor_id
  where (length(t.tel) = 10 and (right(regexp_replace(coalesce(ct.telefono, ''), '\D', '', 'g'), 10) = t.tel
                                 or right(regexp_replace(coalesce(ct.whatsapp, ''), '\D', '', 'g'), 10) = t.tel))
     or (position('@' in t.correo) > 1 and lower(ct.correo) = t.correo)
  order by c.creado_en
  limit 1
$$;
revoke execute on function public.cliente_con_contacto(text, text) from public, anon, authenticated;

create or replace function public.convertir_lead(p_lead uuid, p_cliente uuid default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare l leads; v_cli uuid; v_con uuid; v_op uuid; v_ya record; v_dijo text;
begin
  select * into l from leads where id = p_lead for update;
  if l.id is null then raise exception 'Ese lead no existe'; end if;
  if not ((l.vendedor_id = auth.uid() and puede('ventas', 2)) or (puede('leads', 3) and puede('ventas', 2))) then
    raise exception 'Solo el vendedor que lo tiene (o la gerencia) lo atiende' using errcode = '42501';
  end if;
  if l.estado <> 'asignado' then raise exception 'Este lead ya está %', case l.estado when 'nuevo' then 'sin vendedor: tómalo o asígnalo primero' else l.estado end; end if;
  -- Primero que conteste: la oportunidad es de alguien que ya platicó con nosotros.
  select nota into v_dijo from lead_intentos where lead_id = p_lead and resultado = 'contesto' order by en desc limit 1;
  if v_dijo is null then
    raise exception 'Todavía no te contesta: anota el intento cuando hable contigo (o te pida cotización) y entonces vuélvelo oportunidad'
      using errcode = '23514';
  end if;

  v_cli := coalesce(p_cliente, l.cliente_id);
  if v_cli is null then
    select * into v_ya from cliente_con_contacto(l.telefono, l.correo);
    if v_ya.cliente_id is not null then
      raise exception 'Ese % ya es de «%»%: elígelo en «Cliente» para no darlo de alta dos veces',
        v_ya.por, v_ya.nombre, coalesce(' (de ' || v_ya.vendedor || ')', '') using errcode = '23505';
    end if;
    insert into clientes (nombre, ciudad, estado, fuente_id, vendedor_id, notas, creado_por)
    values (coalesce(l.empresa, l.nombre), l.ciudad, l.estado_mx, l.fuente_id, l.vendedor_id, 'Llegó como lead de recepción', auth.uid())
    returning id into v_cli;
  end if;
  -- El contacto que llamó, si el cliente no lo tiene ya (mismo teléfono o correo).
  select ct.id into v_con from contactos ct
  where ct.cliente_id = v_cli
    and ((l.telefono is not null and right(regexp_replace(coalesce(ct.telefono, ct.whatsapp, ''), '\D', '', 'g'), 10) = right(regexp_replace(l.telefono, '\D', '', 'g'), 10))
         or (l.correo is not null and lower(ct.correo) = l.correo))
  limit 1;
  if v_con is null and (l.telefono is not null or l.correo is not null) then
    insert into contactos (cliente_id, nombre, telefono, correo, principal)
    values (v_cli, l.nombre, l.telefono, l.correo, not exists (select 1 from contactos where cliente_id = v_cli))
    returning id into v_con;
  end if;

  insert into oportunidades (cliente_id, contacto_id, titulo, etapa, linea, vendedor_id, fuente_id, notas)
  values (v_cli, v_con, left(l.interes, 120), 'contactado', l.linea, l.vendedor_id, l.fuente_id,
          concat_ws(E'\n', l.notas, 'Lo que dijo: ' || v_dijo,
                    'Lead de recepción, capturado por ' || (select nombre from perfiles where id = l.capturado_por)
                    || ' el ' || to_char(l.creado_en at time zone 'America/Mexico_City', 'DD/MM/YYYY HH24:MI') || '.'))
  returning id into v_op;

  update leads set estado = 'convertido', cliente_id = v_cli, cliente_nombre = (select nombre from clientes where id = v_cli),
    oportunidad_id = v_op, etapa_oportunidad = 'contactado', atendido_en = now()
  where id = p_lead;
  return v_op;
end $$;

-- v_leads de 128 con los intentos al final.
create or replace view public.v_leads with (security_invoker = true) as
select l.*, pc.nombre as capturo, pv.nombre as vendedor, f.nombre as fuente,
  coalesce(i.n, 0) as intentos, coalesce(i.contesto, false) as contesto, i.ultimo as ultimo_intento, i.ultimo_resultado
from leads l
left join perfiles pc on pc.id = l.capturado_por
left join perfiles pv on pv.id = l.vendedor_id
left join fuentes_contacto f on f.id = l.fuente_id
left join lateral (select count(*)::int n, bool_or(x.resultado = 'contesto') contesto, max(x.en) ultimo,
                     (array_agg(x.resultado order by x.en desc))[1] ultimo_resultado
                   from lead_intentos x where x.lead_id = l.id) i on true;
grant select on public.v_leads to authenticated;

-- ---------------------------------------------------------------- revisión nocturna
insert into public.revision_reglas (clave, modulo, nombre, descripcion, para, se_resuelve_sola) values
  ('leads_sin_seguimiento', 'ventas', 'Leads apartados sin seguimiento',
   'Por vendedor: leads que tiene asignados hace 3 días hábiles o más sin ningún intento anotado, y oportunidades que salieron de un lead hace 5 días hábiles o más sin cotización ni actividad.',
   'direccion', false)
on conflict (clave) do nothing;

-- Desde cuándo se pueden anotar intentos: lo asignado antes no tenía cómo, así que la regla cuenta
-- sus días desde aquí (asignado_en se queda con la fecha de verdad).
update public.configuracion set valor = valor || jsonb_build_object('intentos_desde', now())
where clave = 'leads' and not valor ? 'intentos_desde';

-- Días hábiles del taller (dia_laborable, 212) desde una fecha hasta hoy, sin contarla.
create or replace function public.dias_habiles_desde(p_desde timestamptz) returns int
language sql stable security definer set search_path = public as $$
  select count(*)::int from generate_series((p_desde at time zone 'America/Mexico_City')::date + 1, hoy_planta(), interval '1 day') g
  where dia_laborable(g::date)
$$;
revoke execute on function public.dias_habiles_desde(timestamptz) from public, anon, authenticated;

create or replace function public.revision_r_leads_sin_seguimiento() returns setof public.revision_hallazgo_nuevo
language sql stable security definer set search_path = public, extensions as $$
  with desde as (select coalesce((config_leads()->>'intentos_desde')::timestamptz, '-infinity') f),
  tomados as (
    select l.vendedor_id, l.id, l.nombre, l.asignado_en
    from leads l
    where l.estado = 'asignado' and l.vendedor_id is not null and l.asignado_en is not null
      and not exists (select 1 from lead_intentos x where x.lead_id = l.id)
      and dias_habiles_desde(greatest(l.asignado_en, (select f from desde))) >= 3
  ),
  quietas as (
    select l.vendedor_id, l.id, l.nombre, l.atendido_en
    from leads l join oportunidades o on o.id = l.oportunidad_id
    where l.estado = 'convertido' and o.etapa in ('prospecto', 'contactado')
      and not exists (select 1 from cotizaciones c where c.oportunidad_id = o.id or c.cliente_id = l.cliente_id)
      and not exists (select 1 from actividades a where a.cliente_id = l.cliente_id and a.en > l.atendido_en)
      and dias_habiles_desde(greatest(l.atendido_en, (select f from desde))) >= 5
  ),
  por_vendedor as (
    select v.id vendedor_id,
      (select count(*) from tomados t where t.vendedor_id = v.id) n_tomados,
      (select count(*) from quietas q where q.vendedor_id = v.id) n_quietas,
      (select jsonb_agg(jsonb_build_object('tipo', 'lead', 'referencia', t.id, 'detalle', t.nombre || ' · sin intentos', 'fecha', t.asignado_en)
                        order by t.asignado_en) from tomados t where t.vendedor_id = v.id) ev_t,
      (select jsonb_agg(jsonb_build_object('tipo', 'lead', 'referencia', q.id, 'detalle', q.nombre || ' · oportunidad sin cotización', 'fecha', q.atendido_en)
                        order by q.atendido_en) from quietas q where q.vendedor_id = v.id) ev_q
    from perfiles v where v.id in (select vendedor_id from tomados union select vendedor_id from quietas)
  )
  select 'perfiles', p.vendedor_id::text, '/ventas/leads',
    format('%s: %s leads sin seguimiento', revision_nombre(p.vendedor_id), p.n_tomados + p.n_quietas),
    concat_ws(' ',
      case when p.n_tomados > 0 then format('%s leads asignados hace 3 días hábiles o más sin ningún intento anotado.', p.n_tomados) end,
      case when p.n_quietas > 0 then format('%s oportunidades que salieron de un lead hace 5 días hábiles o más siguen sin cotización ni actividad.', p.n_quietas) end,
      'Puede ser carga de trabajo o contacto por fuera del sistema; vale la pena verlo con el vendedor y, si no los va a atender, reasignarlos.'),
    coalesce(p.ev_t, '[]') || coalesce(p.ev_q, '[]'),
    '{}'::uuid[], case when p.n_tomados + p.n_quietas >= 20 then 'alta' else 'media' end, null::jsonb,
    'leads_sin_seguimiento:' || p.vendedor_id || ':' || to_char(current_date, 'IYYY-IW')
  from por_vendedor p
  where p.n_tomados + p.n_quietas >= 5
$$;
revoke execute on function public.revision_r_leads_sin_seguimiento() from public, anon, authenticated;

-- Guardar la configuración desde la pantalla reemplazaba todo el valor y se habría llevado
-- «intentos_desde»: ahora solo cambia lo que la pantalla edita.
create or replace function public.fijar_config_leads(p_modo text, p_horas_sin_tomar numeric, p_horas_sin_atender numeric, p_vendedores uuid[])
returns void language plpgsql security definer set search_path = public as $$
begin
  if not puede('leads', 3) then raise exception 'Solo la gerencia de ventas o dirección configuran los leads' using errcode = '42501'; end if;
  if p_modo not in ('bandeja', 'gerente', 'recepcion') then raise exception 'Modo desconocido: %', p_modo; end if;
  if p_horas_sin_tomar is null or p_horas_sin_tomar <= 0 or p_horas_sin_atender is null or p_horas_sin_atender <= 0 then
    raise exception 'Las horas tienen que ser mayores que cero';
  end if;
  perform 1 from configuracion where clave = 'leads' for update;
  insert into configuracion (clave, valor, descripcion) values ('leads', '{}', 'A quién le llegan los leads de recepción.')
  on conflict (clave) do nothing;
  update configuracion set valor = valor || jsonb_build_object('modo', p_modo, 'horas_sin_tomar', p_horas_sin_tomar,
      'horas_sin_atender', p_horas_sin_atender, 'vendedores', to_jsonb(coalesce(p_vendedores, '{}'))), actualizado_en = now()
  where clave = 'leads';
end $$;

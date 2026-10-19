-- =============================================================================
-- Recepción y leads.
--
-- Por qué: quien contesta el teléfono no tenía dónde dejar "llamó fulano, busca una
-- banda de 10 m". El recado se perdía en un papel o en un WhatsApp, nadie sabía si
-- algún vendedor lo atendió y el embudo empezaba hasta que un vendedor se acordaba.
--
-- Un lead NO es una oportunidad: puede ser alguien que no es cliente todavía (la
-- oportunidad necesita cliente) y lo captura quien no vende. Vive en su tabla hasta
-- que un vendedor lo atiende y lo vuelve oportunidad (convertir_lead) o lo descarta.
--
-- * Rol "recepcion": captura leads (leads 2) y ve el catálogo con precios de lista
--   (costeo 1, que no trae costos). No ve clientes, ventas ni pedidos: para saber si
--   quien llama ya es cliente usa buscar_cliente_lead, que solo dice el nombre, la
--   ciudad y de qué vendedor es.
-- * Módulo "leads": 1 ver los suyos · 2 capturar y tomar · 3 asignar, ver todos y
--   configurar. Lo tienen recepción y ventas (2), la gerencia de ventas y dirección (3).
-- * A quién le llega (configuracion.leads.modo, se cambia en Configuración):
--     bandeja   = cae en "por tomar", se avisa a los vendedores y el primero se lo queda;
--     gerente   = solo la gerencia lo ve y decide a quién;
--     recepcion = quien lo captura escoge al vendedor.
--   En los tres, si ya es cliente con dueño vigente (regla de cartera), le llega
--   directo a ese vendedor. Si nadie lo toma o nadie lo atiende a tiempo, se avisa a
--   la gerencia (avisos_leads, cada 15 minutos).
-- =============================================================================

insert into public.permisos_rol (rol, modulo, nivel) values
  ('direccion', 'leads', 3), ('gerente_ventas', 'leads', 3), ('ventas', 'leads', 2),
  ('recepcion', 'leads', 2), ('recepcion', 'costeo', 1)
on conflict do nothing;

insert into public.configuracion (clave, valor, descripcion) values
  ('leads', '{"modo":"bandeja","horas_sin_tomar":2,"horas_sin_atender":24,"vendedores":[]}',
   'A quién le llegan los leads de recepción (bandeja, gerente o recepcion), cuándo se avisa a la gerencia y qué vendedores los reciben (vacío = todos los de ventas).')
on conflict (clave) do nothing;

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  nombre text not null check (length(trim(nombre)) >= 2),     -- quien llamó
  empresa text,
  telefono text,
  correo text,
  ciudad text,
  estado_mx text,
  interes text not null check (length(trim(interes)) >= 3),  -- qué busca, con sus palabras
  linea public.linea_venta not null default 'maquinaria',
  fuente_id int references public.fuentes_contacto(id),   -- si no se dice, "Llamada a recepción"
  notas text,
  -- Si ya es cliente. El nombre se copia: recepción no puede leer clientes.
  cliente_id uuid references public.clientes(id) on delete set null,
  cliente_nombre text,
  estado text not null default 'nuevo' check (estado in ('nuevo', 'asignado', 'convertido', 'descartado')),
  vendedor_id uuid references public.perfiles(id),
  como_se_asigno text check (como_se_asigno in ('cliente', 'bandeja', 'gerente', 'recepcion')),
  asignado_en timestamptz,
  asignado_por uuid references public.perfiles(id),
  atendido_en timestamptz,
  oportunidad_id uuid references public.oportunidades(id) on delete set null,
  -- Copia de la etapa de la oportunidad, para que recepción vea en qué quedó sin leer el embudo.
  etapa_oportunidad public.etapa_oportunidad,
  motivo_descarte text,
  avisado_sin_tomar_en timestamptz,
  avisado_sin_atender_en timestamptz,
  capturado_por uuid references public.perfiles(id) default auth.uid(),
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  check (telefono is not null or correo is not null or cliente_id is not null)
);
create index leads_estado on public.leads (estado, creado_en desc);
create index leads_vendedor on public.leads (vendedor_id) where estado = 'asignado';
create index leads_capturo on public.leads (capturado_por, creado_en desc);

create trigger tocar before update on public.leads for each row execute function public.tocar_actualizado();
create trigger auditar after insert or update or delete on public.leads for each row execute function public.auditar();

-- Configuración, con valores por omisión si alguien borró una llave.
create or replace function public.config_leads() returns jsonb
language sql stable security definer set search_path = public as $$
  select '{"modo":"bandeja","horas_sin_tomar":2,"horas_sin_atender":24,"vendedores":[]}'::jsonb
         || coalesce((select valor from configuracion where clave = 'leads'), '{}'::jsonb)
$$;

-- Quiénes reciben leads: los elegidos en Configuración o, si no se eligió a nadie, todos
-- los que tienen el rol de ventas. Siempre activos.
create or replace function public.vendedores_leads() returns setof uuid
language sql stable security definer set search_path = public as $$
  with cfg as (select array(select jsonb_array_elements_text(config_leads()->'vendedores'))::uuid[] as v)
  select p.id from perfiles p, cfg
  where p.activo and case when cardinality(cfg.v) > 0 then p.id = any(cfg.v)
                          else exists (select 1 from usuario_roles r where r.usuario_id = p.id and r.rol = 'ventas') end
$$;

-- Para la lista de "a quién se lo paso" (recepción y gerencia): solo nombres.
create or replace function public.vendedores_para_leads() returns table (id uuid, nombre text)
language sql stable security definer set search_path = public as $$
  select p.id, p.nombre from perfiles p
  where (select puede('leads', 2)) and p.id in (select vendedores_leads())
  order by p.nombre
$$;

-- Para la configuración: a quién se le pueden mandar leads (quien puede capturar en ventas).
create or replace function public.candidatos_leads() returns table (id uuid, nombre text)
language sql stable security definer set search_path = public as $$
  select p.id, p.nombre from perfiles p
  where (select puede('leads', 3)) and p.id in (select usuarios_con_permiso('ventas', 2))
  order by p.nombre
$$;

-- ¿Ve la bandeja de "por tomar"? Solo en modo bandeja y si es de los que reciben leads.
-- Se evalúa una vez por consulta en la política: (select ve_bandeja_leads()).
create or replace function public.ve_bandeja_leads() returns boolean
language sql stable security definer set search_path = public as $$
  select config_leads()->>'modo' = 'bandeja' and auth.uid() in (select vendedores_leads())
$$;

create or replace function public.gerencia_leads() returns setof uuid
language sql stable security definer set search_path = public as $$
  select usuarios_con_rol('gerente_ventas')
$$;

alter table public.leads enable row level security;
create policy ver on public.leads for select to authenticated using (
  (select puede('leads', 3))
  or ((select puede('leads', 1)) and (capturado_por = (select auth.uid()) or vendedor_id = (select auth.uid())
                                      or (estado = 'nuevo' and (select ve_bandeja_leads())))));
-- Se captura directo; todo lo demás (tomar, asignar, convertir, descartar) va por funciones.
create policy alta on public.leads for insert to authenticated with check ((select puede('leads', 2)));
grant select, insert on public.leads to authenticated;

-- Al capturar: quién lo capturó, si ya es cliente de alguien y a quién le toca.
create or replace function public.trg_lead_alta() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_modo text := config_leads()->>'modo'; v_dueno uuid; v_vig boolean;
begin
  new.capturado_por := coalesce(auth.uid(), new.capturado_por);
  new.nombre := trim(new.nombre); new.interes := trim(new.interes);
  new.telefono := nullif(trim(new.telefono), ''); new.correo := nullif(lower(trim(new.correo)), '');
  new.empresa := nullif(trim(new.empresa), '');
  new.fuente_id := coalesce(new.fuente_id, (select id from fuentes_contacto where nombre = 'Llamada a recepción'));
  new.estado := 'nuevo'; new.oportunidad_id := null; new.etapa_oportunidad := null; new.atendido_en := null;
  new.como_se_asigno := null; new.asignado_en := null; new.asignado_por := null; new.cliente_nombre := null;

  if new.cliente_id is not null then
    select nombre into new.cliente_nombre from clientes where id = new.cliente_id;
    select v.vendedor_id, v.vigente into v_dueno, v_vig from vigencia_cliente(new.cliente_id) v;
    -- Ya es de alguien: le llega a su vendedor, se llame como se llame el modo.
    if v_dueno is not null and v_vig and exists (select 1 from perfiles where id = v_dueno and activo) then
      new.vendedor_id := v_dueno; new.como_se_asigno := 'cliente';
    end if;
  end if;

  if new.como_se_asigno is null then
    if v_modo = 'recepcion' then
      if new.vendedor_id is null then
        raise exception 'Escoge a qué vendedor se lo pasas' using errcode = '23514';
      end if;
      if new.vendedor_id not in (select vendedores_leads()) then
        raise exception 'Esa persona no recibe leads' using errcode = '23514';
      end if;
      new.como_se_asigno := 'recepcion';
    else
      new.vendedor_id := null;   -- en bandeja lo toma un vendedor; en modo gerente, lo asigna la gerencia
    end if;
  end if;

  if new.vendedor_id is not null then
    new.estado := 'asignado'; new.asignado_en := now(); new.asignado_por := auth.uid();
  end if;
  return new;
end $$;
create trigger alta before insert on public.leads for each row execute function public.trg_lead_alta();

create or replace function public.trg_lead_avisar() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_titulo text; v_cuerpo text; v_ruta text := '/ventas/leads?id=' || new.id;
begin
  v_cuerpo := new.interes || coalesce(' · ' || new.telefono, '') || coalesce(' · ' || new.ciudad, '');
  v_titulo := new.nombre || coalesce(' (' || coalesce(new.cliente_nombre, new.empresa) || ')', '');
  if new.estado = 'asignado' then
    perform avisar(array[new.vendedor_id], 'lead', 'Lead para ti: ' || v_titulo,
      case when new.como_se_asigno = 'cliente' then 'Es tu cliente. ' else '' end || v_cuerpo, v_ruta, 'leads', new.id::text);
  elsif config_leads()->>'modo' = 'bandeja' then
    perform avisar(array(select vendedores_leads()), 'lead', 'Lead por tomar: ' || v_titulo, v_cuerpo, v_ruta, 'leads', new.id::text);
  else
    perform avisar(array(select gerencia_leads()), 'lead', 'Lead por asignar: ' || v_titulo, v_cuerpo, v_ruta, 'leads', new.id::text);
  end if;
  return null;
end $$;
create trigger avisar after insert on public.leads for each row execute function public.trg_lead_avisar();

-- La etapa de la oportunidad viaja al lead: así recepción ve si se ganó o se perdió.
create or replace function public.trg_lead_etapa() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update leads set etapa_oportunidad = new.etapa where oportunidad_id = new.id and etapa_oportunidad is distinct from new.etapa;
  return null;
end $$;
create trigger lead_etapa after update of etapa on public.oportunidades for each row execute function public.trg_lead_etapa();

-- ¿Ya es cliente? Para quien contesta el teléfono: nombre, ciudad y de quién es. Nada de
-- ventas, saldos ni contactos. Busca por nombre, razón social, teléfono o correo.
create or replace function public.buscar_cliente_lead(p_texto text)
returns table (cliente_id uuid, nombre text, ciudad text, estado text, vendedor text, vigente boolean, coincide text)
language plpgsql stable security definer set search_path = public as $$
declare v_t text := sin_acentos(trim(coalesce(p_texto, ''))); v_tel text := right(regexp_replace(coalesce(p_texto, ''), '\D', '', 'g'), 10);
begin
  if not puede('leads', 2) then raise exception 'Sin permiso para registrar leads' using errcode = '42501'; end if;
  if length(v_t) < 3 and length(v_tel) < 7 then return; end if;
  return query
  with c as (
    select cl.id, 'nombre'::text as por from clientes cl
    where length(v_t) >= 3 and sin_acentos(cl.nombre || ' ' || coalesce(cl.razon_social, '')) like '%' || v_t || '%'
    union
    select ct.cliente_id, 'teléfono' from contactos ct
    where length(v_tel) >= 7 and (right(regexp_replace(coalesce(ct.telefono, ''), '\D', '', 'g'), 10) like '%' || v_tel
                                  or right(regexp_replace(coalesce(ct.whatsapp, ''), '\D', '', 'g'), 10) like '%' || v_tel)
    union
    select ct.cliente_id, 'correo' from contactos ct
    where position('@' in v_t) > 1 and lower(ct.correo) = v_t
  )
  select cl.id, cl.nombre, cl.ciudad, cl.estado, pv.nombre, coalesce(v.vigente, false), string_agg(distinct c.por, ', ')
  from c join clientes cl on cl.id = c.id and cl.activo
  left join lateral vigencia_cliente(cl.id) v on true
  left join perfiles pv on pv.id = v.vendedor_id
  group by cl.id, cl.nombre, cl.ciudad, cl.estado, pv.nombre, v.vigente
  order by min(case c.por when 'teléfono' then 1 when 'correo' then 2 else 3 end), cl.nombre
  limit 6;
end $$;

-- El primero que lo toma se lo queda (modo bandeja).
create or replace function public.tomar_lead(p_lead uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_quien text;
begin
  if not puede('leads', 2) or not ve_bandeja_leads() then
    raise exception 'Solo los vendedores que reciben leads pueden tomarlos' using errcode = '42501';
  end if;
  update leads set estado = 'asignado', vendedor_id = auth.uid(), como_se_asigno = 'bandeja', asignado_en = now(), asignado_por = auth.uid()
  where id = p_lead and estado = 'nuevo' and vendedor_id is null;
  if not found then
    select p.nombre into v_quien from leads l left join perfiles p on p.id = l.vendedor_id where l.id = p_lead;
    raise exception 'Ya lo tomó %', coalesce(v_quien, 'alguien más');
  end if;
end $$;

-- La gerencia asigna o reasigna (cualquier modo).
create or replace function public.asignar_lead(p_lead uuid, p_vendedor uuid) returns void
language plpgsql security definer set search_path = public as $$
declare l leads;
begin
  if not puede('leads', 3) then raise exception 'Solo la gerencia de ventas asigna leads' using errcode = '42501'; end if;
  if not exists (select 1 from perfiles where id = p_vendedor and activo) then raise exception 'Esa persona no está activa'; end if;
  update leads set estado = 'asignado', vendedor_id = p_vendedor, como_se_asigno = 'gerente', asignado_en = now(),
    asignado_por = auth.uid(), avisado_sin_atender_en = null
  where id = p_lead and estado in ('nuevo', 'asignado')
  returning * into l;
  if l.id is null then raise exception 'Ese lead ya se atendió'; end if;
  perform avisar(array[p_vendedor], 'lead', 'Te asignaron un lead: ' || l.nombre || coalesce(' (' || coalesce(l.cliente_nombre, l.empresa) || ')', ''),
    l.interes || coalesce(' · ' || l.telefono, ''), '/ventas/leads?id=' || l.id, 'leads', l.id::text);
end $$;

-- Atenderlo: se vuelve oportunidad. Si no era cliente, se da de alta con su contacto.
create or replace function public.convertir_lead(p_lead uuid, p_cliente uuid default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare l leads; v_cli uuid; v_con uuid; v_op uuid;
begin
  select * into l from leads where id = p_lead for update;
  if l.id is null then raise exception 'Ese lead no existe'; end if;
  if not ((l.vendedor_id = auth.uid() and puede('ventas', 2)) or (puede('leads', 3) and puede('ventas', 2))) then
    raise exception 'Solo el vendedor que lo tiene (o la gerencia) lo atiende' using errcode = '42501';
  end if;
  if l.estado <> 'asignado' then raise exception 'Este lead ya está %', case l.estado when 'nuevo' then 'sin vendedor: tómalo o asígnalo primero' else l.estado end; end if;

  v_cli := coalesce(p_cliente, l.cliente_id);
  if v_cli is null then
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
  values (v_cli, v_con, left(l.interes, 120), 'prospecto', l.linea, l.vendedor_id, l.fuente_id,
          concat_ws(E'\n', l.notas, 'Lead de recepción, capturado por ' || (select nombre from perfiles where id = l.capturado_por)
                    || ' el ' || to_char(l.creado_en at time zone 'America/Mexico_City', 'DD/MM/YYYY HH24:MI') || '.'))
  returning id into v_op;

  update leads set estado = 'convertido', cliente_id = v_cli, cliente_nombre = (select nombre from clientes where id = v_cli),
    oportunidad_id = v_op, etapa_oportunidad = 'prospecto', atendido_en = now()
  where id = p_lead;
  return v_op;
end $$;

-- Descartar: el vendedor que lo tiene o la gerencia; quien lo capturó, solo mientras nadie
-- lo ha tomado (para corregir un duplicado).
create or replace function public.descartar_lead(p_lead uuid, p_motivo text) returns void
language plpgsql security definer set search_path = public as $$
declare l leads;
begin
  select * into l from leads where id = p_lead for update;
  if l.id is null then raise exception 'Ese lead no existe'; end if;
  if coalesce(length(trim(p_motivo)), 0) < 3 then raise exception 'Anota por qué se descarta' using errcode = '23514'; end if;
  if not (puede('leads', 3) or (puede('leads', 2) and (l.vendedor_id = auth.uid() or (l.capturado_por = auth.uid() and l.estado = 'nuevo')))) then
    raise exception 'Solo quien lo tiene o la gerencia lo descarta' using errcode = '42501';
  end if;
  if l.estado not in ('nuevo', 'asignado') then raise exception 'Este lead ya está %', l.estado; end if;
  update leads set estado = 'descartado', motivo_descarte = trim(p_motivo), atendido_en = now() where id = p_lead;
end $$;

-- Configuración (gerencia de ventas o dirección). "for update": guardar dos veces seguido
-- no debe pisar lo primero mientras corre el recálculo que dispara cambiar la configuración.
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
  update configuracion set valor = jsonb_build_object('modo', p_modo, 'horas_sin_tomar', p_horas_sin_tomar,
      'horas_sin_atender', p_horas_sin_atender, 'vendedores', to_jsonb(coalesce(p_vendedores, '{}'))), actualizado_en = now()
  where clave = 'leads';
end $$;

-- Recordatorios: un lead sin tomar o sin atender se le avisa a la gerencia (una vez).
create or replace function public.avisos_leads(p_ahora timestamptz default now()) returns int
language plpgsql security definer set search_path = public as $$
declare c jsonb := config_leads(); r record; n int := 0;
begin
  for r in select * from leads where estado = 'nuevo' and avisado_sin_tomar_en is null
             and creado_en < p_ahora - make_interval(secs => (c->>'horas_sin_tomar')::numeric * 3600) loop
    n := n + avisar(array(select gerencia_leads()), 'lead_sin_tomar', 'Lead sin tomar: ' || r.nombre,
      r.interes || ' · lleva ' || floor(extract(epoch from p_ahora - r.creado_en) / 3600) || ' h esperando', '/ventas/leads?id=' || r.id, 'leads', r.id::text);
    update leads set avisado_sin_tomar_en = p_ahora where id = r.id;
  end loop;
  for r in select l.*, p.nombre as vendedor from leads l join perfiles p on p.id = l.vendedor_id
           where l.estado = 'asignado' and l.avisado_sin_atender_en is null
             and l.asignado_en < p_ahora - make_interval(secs => (c->>'horas_sin_atender')::numeric * 3600) loop
    n := n + avisar(array(select gerencia_leads() union select r.vendedor_id), 'lead_sin_atender',
      'Lead sin atender: ' || r.nombre || ' (' || r.vendedor || ')', r.interes, '/ventas/leads?id=' || r.id, 'leads', r.id::text);
    update leads set avisado_sin_atender_en = p_ahora where id = r.id;
  end loop;
  return n;
end $$;
revoke execute on function public.avisos_leads(timestamptz) from public, anon, authenticated;

do $$ begin
  perform cron.unschedule('avisos-leads') where exists (select 1 from cron.job where jobname = 'avisos-leads');
  perform cron.schedule('avisos-leads', '*/15 * * * *', 'select public.avisos_leads()');
exception when others then
  raise notice 'pg_cron no está disponible: los recordatorios de leads quedan apagados (%).', sqlerrm;
end $$;

-- La lista: con nombres, sin abrir clientes (recepción no los lee).
create or replace view public.v_leads with (security_invoker = true) as
select l.*, pc.nombre as capturo, pv.nombre as vendedor, f.nombre as fuente
from leads l
left join perfiles pc on pc.id = l.capturado_por
left join perfiles pv on pv.id = l.vendedor_id
left join fuentes_contacto f on f.id = l.fuente_id;
grant select on public.v_leads to authenticated;

-- Inicio: leads de hoy para recepción; por tomar y sin atender para ventas.
drop function if exists public.indicadores(text[]);
create or replace function public.indicadores(p_secciones text[] default null)
returns jsonb language plpgsql stable as $$
declare r jsonb := '{}'::jsonb; v_mes date := date_trunc('month', current_date);
begin
  if puede('ventas', 1) and (p_secciones is null or 'ventas' = any(p_secciones)) then
    r := r || jsonb_build_object('ventas', (
      select jsonb_build_object(
        'mes', coalesce(sum(p.subtotal * p.tipo_cambio) filter (where p.fecha >= v_mes), 0),
        -- El mismo tramo del mes pasado (del 1 al día de hoy): contra el mes completo,
        -- los primeros días siempre salían "77 % abajo".
        'mes_anterior', coalesce(sum(p.subtotal * p.tipo_cambio) filter (where p.fecha >= v_mes - interval '1 month'
                          and p.fecha <= (now() at time zone 'America/Mexico_City')::date - interval '1 month'), 0),
        'anio', coalesce(sum(p.subtotal * p.tipo_cambio) filter (where p.fecha >= date_trunc('year', current_date)), 0),
        'pedidos_mes', count(*) filter (where p.fecha >= v_mes))
      from pedidos p where p.estado <> 'cancelado'),
      'cotizaciones', (
      select jsonb_build_object(
        'abiertas', count(*) filter (where c.estado in ('borrador', 'por_autorizar', 'autorizada', 'enviada') and c.fecha + c.vigencia_dias >= current_date),
        'monto_abierto', coalesce(sum(c.subtotal * c.tipo_cambio) filter (where c.estado in ('enviada') and c.fecha + c.vigencia_dias >= current_date), 0),
        'por_autorizar', count(*) filter (where c.estado = 'por_autorizar'),
        'mes', count(*) filter (where c.fecha >= v_mes),
        'ganadas_90d', count(*) filter (where c.estado = 'aceptada' and c.fecha >= current_date - 90),
        'cerradas_90d', count(*) filter (where c.estado in ('aceptada', 'rechazada', 'vencida') and c.fecha >= current_date - 90))
      from cotizaciones c),
      'tareas_vencidas', (select count(*) from actividades a where not a.hecha and a.vence_en < current_date and a.usuario_id = auth.uid()));
  end if;
  if (puede('finanzas', 1) or puede('ventas', 3)) and (p_secciones is null or 'cobranza' = any(p_secciones)) then
    r := r || jsonb_build_object('cobranza', (
      select jsonb_build_object('por_cobrar', coalesce(sum(saldo * case when moneda = 'MXN' then 1 else tc(moneda) end) filter (where saldo > 0), 0),
                                'pedidos_con_saldo', count(*) filter (where saldo > 0))
      from v_saldos_pedido));
  end if;
  if puede('finanzas', 1) and (p_secciones is null or 'por_pagar' = any(p_secciones)) then
    -- Órdenes de compra más la cuenta de cada proveedor (hoja y compras sin orden), como en
    -- Pagos. La cuenta solo la ve finanzas 2: para compras esa parte suma cero (RLS).
    r := r || jsonb_build_object('por_pagar', (
      select jsonb_build_object('total', o.total + c.debe, 'vencido', o.vencido + c.vencido)
      from (select coalesce(sum(saldo * case when moneda = 'MXN' then 1 else tc(moneda) end), 0) as total,
                   coalesce(sum(saldo * case when moneda = 'MXN' then 1 else tc(moneda) end) filter (where vence_pago < current_date), 0) as vencido
            from v_cuentas_por_pagar where saldo > 0) o,
           (select coalesce(sum(saldo) filter (where saldo > 1), 0) as debe, coalesce(sum(vencido), 0) as vencido
            from v_saldo_arranque_proveedores where tipo_acreedor = 'proveedor') c));
  end if;
  if puede('inventario', 1) and (p_secciones is null or 'inventario' = any(p_secciones)) then
    r := r || jsonb_build_object('inventario', jsonb_build_object(
      'ajustes_pendientes', (select count(*) from ajustes_inventario where estado = 'pendiente'),
      'articulos_con_existencia', (select count(distinct articulo_id) from existencias where cantidad > 0)));
  end if;
  if puede('costos', 1) and (p_secciones is null or 'costos' = any(p_secciones)) then
    r := r || jsonb_build_object('valor_inventario', (
      select coalesce(sum(e.cantidad * cc.costo_total), 0) from existencias e join costos_calculados cc on cc.articulo_id = e.articulo_id where e.cantidad > 0),
      'costos_viejos', (select count(*) from costos_articulo where actualizado_en < current_date - 180));
  end if;
  if puede('compras', 1) and (p_secciones is null or 'compras' = any(p_secciones)) then
    r := r || jsonb_build_object('compras', jsonb_build_object(
      'oc_abiertas', (select count(*) from v_ordenes_compra where estado in ('enviada', 'parcial')),
      'oc_atrasadas', (select count(*) from v_ordenes_compra where estado in ('enviada', 'parcial') and fecha_entrega < current_date),
      'requisiciones_abiertas', (select count(*) from requisiciones where estado = 'abierta')));
  end if;
  if puede('produccion', 1) and (p_secciones is null or 'produccion' = any(p_secciones)) then
    r := r || jsonb_build_object('produccion', (
      select jsonb_build_object('abiertas', count(*), 'atrasadas', count(*) filter (where atrasada),
             'en_proceso', count(*) filter (where estado = 'en_proceso'),
             'con_faltantes', count(*) filter (where materiales_faltantes > 0),
             'terminadas_mes', (select count(*) from ordenes_produccion where terminada_en >= v_mes))
      from v_tablero_produccion));
  end if;
  if puede('rrhh', 1) and (p_secciones is null or 'rrhh' = any(p_secciones)) then
    r := r || jsonb_build_object('rrhh', jsonb_build_object(
      'empleados', (select count(*) from empleados where activo),
      'incidencias_pendientes', (select count(*) from incidencias where estado = 'solicitada'),
      'ausentes_hoy', (select count(distinct empleado_id) from incidencias where estado = 'aprobada'
                       and current_date between inicio and fin and tipo in ('vacaciones', 'incapacidad', 'permiso_con_goce', 'permiso_sin_goce', 'falta'))));
  end if;
  if puede('importaciones', 1) and (p_secciones is null or 'importaciones' = any(p_secciones)) then
    -- Lo de todos los días de importaciones: qué viene en el mar, qué llega esta semana
    -- y cuántos documentos faltan antes de que arribe (sin ellos el agente no despacha).
    r := r || jsonb_build_object('importaciones', (
      select jsonb_build_object(
        'activos', count(*) filter (where fase not in ('cerrado', 'cancelado')),
        'en_camino', count(*) filter (where fase in ('transito', 'puerto')),
        'llegan_semana', count(*) filter (where fase in ('transito', 'puerto') and en_planta is null
                                            and llegada_planta_estimada <= current_date + 7),
        'docs_pendientes', coalesce(sum(docs_pendientes_arribo) filter (where fase in ('cotizando', 'produccion', 'listo', 'transito')), 0))
      from v_embarques));
  end if;
  if puede('leads', 1) and (p_secciones is null or 'leads' = any(p_secciones)) then
    -- Lo que cada quien ve de leads (la RLS filtra): por tomar, míos sin atender y lo de hoy.
    r := r || jsonb_build_object('leads', (
      select jsonb_build_object(
        'por_tomar', count(*) filter (where estado = 'nuevo'),
        'mios_sin_atender', count(*) filter (where estado = 'asignado' and vendedor_id = auth.uid()),
        'sin_atender', count(*) filter (where estado = 'asignado'),
        'capturados_hoy', count(*) filter (where capturado_por = auth.uid()
                                              and (creado_en at time zone 'America/Mexico_City')::date = (now() at time zone 'America/Mexico_City')::date),
        'convertidos_mes', count(*) filter (where estado = 'convertido' and atendido_en >= v_mes))
      from leads));
  end if;
  return r;
end $$;
grant execute on function public.indicadores(text[]) to authenticated;

-- En vivo: la lista de leads se actualiza sola cuando alguien toma uno (la bandeja se vacía
-- en las pantallas de los demás vendedores).
do $$ begin
  alter publication supabase_realtime add table public.leads;
exception when duplicate_object then null; when undefined_object then null;
end $$;

-- =============================================================================
-- Teléfono, fase 1: lo que pasa en el conmutador con IA entra al ERP.
--
-- Por qué: el conmutador (otro sistema, en Railway) ya contesta, pasa la llamada a quien toca y
-- deja recados, pero nada de eso llegaba aquí. El vendedor no sabía que su cliente había llamado
-- y nadie le contestó; el lead que tomó la IA se quedaba en el panel del conmutador y recepción lo
-- volvía a capturar a mano (o no). El contrato completo está en docs/integracion-telefono.md.
--
-- Ahora el conmutador manda cada llamada (la foto completa, varias veces: al terminar y cuando
-- llega la grabación) a la función de borde «telefono», que revisa su llave y llama a
-- telefono_registrar_evento. Con cada foto:
--   * la llamada se guarda una sola vez por call_sid y se liga al cliente por su teléfono;
--   * quien la atendió se busca en el directorio del teléfono (dirección liga cada nombre a una
--     persona del ERP una vez) o por el teléfono de su perfil;
--   * si dejó lead, se crea una sola vez (fuente «Llamada a recepción»). Si lo atendió alguien
--     que recibe leads, es suyo; si el cliente ya tiene vendedor vigente, de su vendedor; si no,
--     se reparte como cualquier lead. En modo «recepción elige» no hay quién elija: se queda por
--     asignar para la gerencia (antes el alta habría fallado y se perdía la llamada);
--   * si hubo cliente y alguien la atendió, queda una actividad «llamada» a su nombre (una vez);
--   * si nadie contestó, sale en «A quién llamar hoy» como «Regresar llamada» para el dueño, hasta
--     que alguien diga «Ya le regresé», se anote un intento en su lead o el mismo número vuelva a
--     llamar y lo atiendan.
-- La transcripción no se guarda (es la plática completa de una persona); el resumen sí.
-- =============================================================================

-- 0. Leads: «llamada» como forma de asignación, y de qué llamada salió ----------------------------
alter table public.leads drop constraint if exists leads_como_se_asigno_check;
alter table public.leads add constraint leads_como_se_asigno_check
  check (como_se_asigno in ('cliente', 'bandeja', 'gerente', 'recepcion', 'llamada'));

-- 1. La cuenta: la llave con la que entra el conmutador -------------------------------------------
-- Se guarda solo su huella (sha256): la llave se enseña una vez al generarla y después ni la base
-- la puede repetir. Nadie con sesión lee esta tabla (RLS sin políticas).
create table if not exists public.telefono_cuenta (
  id int primary key default 1 check (id = 1),
  llave_huella text,
  generada_en timestamptz,
  generada_por uuid references public.perfiles(id),
  ultimo_evento_en timestamptz,
  ultimo_error text,
  ultimo_error_en timestamptz
);
alter table public.telefono_cuenta enable row level security;
revoke all on public.telefono_cuenta from anon, authenticated;
insert into public.telefono_cuenta (id) values (1) on conflict do nothing;

create or replace function public._telefono_huella(p text) returns text
language sql immutable set search_path = public, extensions as $$
  select encode(extensions.digest(p, 'sha256'), 'hex')
$$;
revoke execute on function public._telefono_huella(text) from public, anon, authenticated;

create or replace function public.telefono_llave_valida(p text) returns boolean
language sql stable security definer set search_path = public, extensions as $$
  select coalesce(length(p) >= 32 and exists (
    select 1 from telefono_cuenta where id = 1 and llave_huella = _telefono_huella(p)), false)
$$;
revoke execute on function public.telefono_llave_valida(text) from public, anon, authenticated;

-- Dirección genera (o cambia) la llave. La de antes deja de servir en ese momento.
create or replace function public.telefono_generar_llave() returns text
language plpgsql security definer set search_path = public, extensions as $$
declare v text := 'tel_' || encode(extensions.gen_random_bytes(24), 'hex');
begin
  if not tiene_rol('direccion') then raise exception 'La llave del teléfono la genera dirección' using errcode = '42501'; end if;
  if en_vista_previa() then raise exception 'Estás viendo el ERP como otra persona: desde aquí no se cambia nada' using errcode = '42501'; end if;
  update telefono_cuenta set llave_huella = _telefono_huella(v), generada_en = now(), generada_por = auth.uid(),
    ultimo_error = null, ultimo_error_en = null
  where id = 1;
  return v;
end $$;
revoke execute on function public.telefono_generar_llave() from public, anon;
grant execute on function public.telefono_generar_llave() to authenticated;

-- La función de borde anota aquí lo que no pudo guardar (lo ve dirección en Integraciones).
create or replace function public.telefono_anotar_error(p text) returns void
language sql security definer set search_path = public as $$
  update telefono_cuenta set ultimo_error = left(p, 500), ultimo_error_en = now() where id = 1
$$;
revoke execute on function public.telefono_anotar_error(text) from public, anon, authenticated;

-- 2. Directorio: los nombres que manda el conmutador, ligados a una persona del ERP ---------------
create table if not exists public.telefono_directorio (
  id uuid primary key default gen_random_uuid(),
  -- Los últimos 10 dígitos del teléfono o, si no trae teléfono, «nombre:» y el nombre sin acentos.
  clave text not null unique,
  nombre text not null,
  telefono text,
  perfil_id uuid references public.perfiles(id) on delete set null,
  ligado_por uuid references public.perfiles(id),   -- null con perfil = se ligó solo por su teléfono
  ligado_en timestamptz,
  visto_en timestamptz not null default now(),
  creado_en timestamptz not null default now()
);
alter table public.telefono_directorio enable row level security;
drop policy if exists ver on public.telefono_directorio;
create policy ver on public.telefono_directorio for select to authenticated using ((select puede('admin', 3)));
revoke insert, update, delete on public.telefono_directorio from anon, authenticated;
grant select on public.telefono_directorio to authenticated;
drop trigger if exists auditar on public.telefono_directorio;
create trigger auditar after insert or update or delete on public.telefono_directorio
  for each row execute function public.auditar();

create or replace function public._telefono_clave(p_nombre text, p_telefono text) returns text
language sql immutable set search_path = public as $$
  select coalesce(telefono10(p_telefono),
    'nombre:' || nullif(regexp_replace(lower(sin_acentos(trim(coalesce(p_nombre, '')))), '\s+', ' ', 'g'), ''))
$$;
revoke execute on function public._telefono_clave(text, text) from public, anon, authenticated;

-- 3. Llamadas ------------------------------------------------------------------------------------
create table if not exists public.llamadas (
  id uuid primary key default gen_random_uuid(),
  call_sid text not null unique check (length(call_sid) between 1 and 100),
  telefono text,
  telefono10 text,
  cliente_id uuid references public.clientes(id) on delete set null,
  -- Copias del nombre: recepción no lee clientes ni los leads que no registró.
  cliente_nombre text,
  lead_id uuid references public.leads(id) on delete set null,
  lead_nombre text,
  inicio timestamptz,
  fin timestamptz,
  duracion_seg int check (duracion_seg is null or duracion_seg >= 0),
  estado text,
  area text,
  area_nombre text,
  atendio_nombre text,
  atendio_telefono text,
  atendio_directorio uuid references public.telefono_directorio(id) on delete set null,
  atendio_perfil uuid references public.perfiles(id),
  atendio_ia text,
  nadie_contesto boolean not null default false,
  resumen text,
  grabacion_url text,
  grabacion_vence timestamptz,
  actividad_id uuid references public.actividades(id) on delete set null,
  -- Regresar llamada: quién y cómo se resolvió. «intento» = se anotó un intento en su lead;
  -- «volvio_a_llamar» = el mismo número volvió a llamar y alguien lo atendió.
  regresada_en timestamptz,
  regresada_por uuid references public.perfiles(id),
  regresada_como text check (regresada_como in ('regresada', 'intento', 'volvio_a_llamar')),
  regresada_nota text,
  avisado_en timestamptz,
  -- La hora de la foto más nueva que se aplicó: una foto vieja que llega tarde (reintento) no pisa.
  foto_en timestamptz,
  datos jsonb not null default '{}'::jsonb,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);
create index if not exists llamadas_tel10 on public.llamadas (telefono10, inicio desc);
create index if not exists llamadas_cliente on public.llamadas (cliente_id, inicio desc) where cliente_id is not null;
create index if not exists llamadas_lead on public.llamadas (lead_id) where lead_id is not null;
create index if not exists llamadas_por_regresar on public.llamadas (inicio desc) where nadie_contesto and regresada_en is null;
drop trigger if exists tocar on public.llamadas;
create trigger tocar before update on public.llamadas for each row execute function public.tocar_actualizado();

alter table public.leads add column if not exists llamada_id uuid references public.llamadas(id) on delete set null;
comment on column public.leads.llamada_id is 'La llamada del conmutador que dejó este lead (lo capturó la IA: capturado_por queda vacío).';

-- Las llamadas que son mías: de mi cliente o de mi lead; y, si no son de nadie, de quien reparte
-- leads (recepción y la gerencia). Los permisos se calculan una vez, no por llamada (ver 086).
create or replace function public.mis_llamadas() returns setof uuid
language sql stable security definer set search_path = public as $$
  with yo as materialized (select auth.uid() id, (puede('leads', 3) or tiene_rol('recepcion')) reparte)
  select ll.id from llamadas ll
  cross join yo
  left join clientes c on c.id = ll.cliente_id
  left join leads l on l.id = ll.lead_id
  where c.vendedor_id = yo.id or l.vendedor_id = yo.id
     or (yo.reparte and c.vendedor_id is null and l.vendedor_id is null)
$$;
revoke execute on function public.mis_llamadas() from public, anon;
grant execute on function public.mis_llamadas() to authenticated;

alter table public.llamadas enable row level security;
drop policy if exists ver on public.llamadas;
-- La gerencia de ventas y dirección, quien la atendió y el dueño. Nunca otro vendedor.
-- Nadie la escribe directo: solo telefono_registrar_evento y marcar_llamada_regresada.
create policy ver on public.llamadas for select to authenticated using (
  (select puede('ventas', 3)) or atendio_perfil = (select auth.uid()) or id in (select public.mis_llamadas()));
revoke insert, update, delete on public.llamadas from anon, authenticated;
grant select on public.llamadas to authenticated;

do $$ begin
  alter publication supabase_realtime add table public.llamadas;
exception when duplicate_object then null; when undefined_object then raise notice 'Sin publicación de tiempo real';
end $$;

-- 4. El alta del lead (trg_lead_alta de 128) sabe que viene del teléfono ------------------------
-- Lo marca telefono_registrar_evento con un ajuste de la transacción y sin sesión (la función de
-- borde no trae usuario): así un usuario no puede hacerse pasar por el teléfono.
create or replace function public.trg_lead_alta() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_modo text := config_leads()->>'modo'; v_dueno uuid; v_vig boolean;
  v_tel boolean := coalesce(current_setting('hegamex.lead_telefono', true), '') = 'si' and auth.uid() is null;
begin
  new.capturado_por := coalesce(auth.uid(), new.capturado_por);
  new.nombre := trim(new.nombre); new.interes := trim(new.interes);
  new.telefono := nullif(trim(new.telefono), ''); new.correo := nullif(lower(trim(new.correo)), '');
  new.empresa := nullif(trim(new.empresa), '');
  new.fuente_id := coalesce(new.fuente_id, (select id from fuentes_contacto where nombre = 'Llamada a recepción'));
  new.estado := 'nuevo'; new.oportunidad_id := null; new.etapa_oportunidad := null; new.atendido_en := null;
  new.como_se_asigno := null; new.asignado_en := null; new.asignado_por := null; new.cliente_nombre := null;
  if not v_tel then new.llamada_id := null; end if;

  if new.cliente_id is not null then
    select nombre into new.cliente_nombre from clientes where id = new.cliente_id;
    select v.vendedor_id, v.vigente into v_dueno, v_vig from vigencia_cliente(new.cliente_id) v;
    -- Ya es de alguien: le llega a su vendedor, se llame como se llame el modo.
    if v_dueno is not null and v_vig and exists (select 1 from perfiles where id = v_dueno and activo) then
      new.vendedor_id := v_dueno; new.como_se_asigno := 'cliente';
    end if;
  end if;

  if new.como_se_asigno is null then
    if v_tel then
      -- Lo atendió por teléfono alguien que recibe leads: es suyo. Si no, se queda por tomar o por
      -- asignar; en modo recepción tampoco falla (nadie escogió vendedor: lo asigna la gerencia).
      if new.vendedor_id is not null and new.vendedor_id in (select vendedores_leads()) then
        new.como_se_asigno := 'llamada';
      else
        new.vendedor_id := null;
      end if;
    elsif v_modo = 'recepcion' then
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

-- trg_lead_avisar de 128: el de la llamada dice que lo atendió él, y «por asignar» sin gerente de
-- ventas activo le llega a dirección (como «sin tomar» desde 257; antes no le llegaba a nadie).
create or replace function public.trg_lead_avisar() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_titulo text; v_cuerpo text; v_ruta text := '/ventas/leads?id=' || new.id; v_ger uuid[];
begin
  v_cuerpo := new.interes || coalesce(' · ' || new.telefono, '') || coalesce(' · ' || new.ciudad, '');
  v_titulo := new.nombre || coalesce(' (' || coalesce(new.cliente_nombre, new.empresa) || ')', '');
  if new.estado = 'asignado' then
    perform avisar(array[new.vendedor_id], 'lead', 'Lead para ti: ' || v_titulo,
      case new.como_se_asigno when 'cliente' then 'Es tu cliente. ' when 'llamada' then 'Lo atendiste por teléfono. ' else '' end || v_cuerpo,
      v_ruta, 'leads', new.id::text);
  elsif config_leads()->>'modo' = 'bandeja' then
    perform avisar(array(select vendedores_leads()), 'lead', 'Lead por tomar: ' || v_titulo, v_cuerpo, v_ruta, 'leads', new.id::text);
  else
    v_ger := array(select gerencia_leads());
    if cardinality(v_ger) = 0 then v_ger := array(select usuarios_con_rol('direccion')); end if;
    perform avisar(v_ger, 'lead', 'Lead por asignar: ' || v_titulo, v_cuerpo, v_ruta, 'leads', new.id::text);
  end if;
  return null;
end $$;

-- v_leads de 236 con la llamada al final. Columnas a mano: con l.* la nueva columna de leads
-- caería en medio y la vista no se puede reemplazar.
create or replace view public.v_leads with (security_invoker = true) as
select l.id, l.nombre, l.empresa, l.telefono, l.correo, l.ciudad, l.estado_mx, l.interes, l.linea, l.fuente_id, l.notas,
  l.cliente_id, l.cliente_nombre, l.estado, l.vendedor_id, l.como_se_asigno, l.asignado_en, l.asignado_por, l.atendido_en,
  l.oportunidad_id, l.etapa_oportunidad, l.motivo_descarte, l.avisado_sin_tomar_en, l.avisado_sin_atender_en,
  l.capturado_por, l.creado_en, l.actualizado_en,
  pc.nombre as capturo, pv.nombre as vendedor, f.nombre as fuente,
  coalesce(i.n, 0) as intentos, coalesce(i.contesto, false) as contesto, i.ultimo as ultimo_intento, i.ultimo_resultado,
  i.ultimo_canal, public.lead_faltan(l.cliente_id, l.empresa, l.ciudad, l.estado_mx, l.interes) as faltan,
  l.llamada_id
from leads l
left join perfiles pc on pc.id = l.capturado_por
left join perfiles pv on pv.id = l.vendedor_id
left join fuentes_contacto f on f.id = l.fuente_id
left join lateral (select count(*)::int n, bool_or(x.resultado = 'contesto') contesto, max(x.en) ultimo,
                     (array_agg(x.resultado order by x.en desc))[1] ultimo_resultado,
                     (array_agg(x.canal order by x.en desc))[1] ultimo_canal
                   from lead_intentos x where x.lead_id = l.id) i on true;
grant select on public.v_leads to authenticated;

-- Un intento anotado en el lead después de la llamada perdida ya es haberle regresado la llamada.
create or replace function public.trg_intento_regresa_llamada() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update llamadas set regresada_en = new.en, regresada_por = new.usuario_id, regresada_como = 'intento'
  where lead_id = new.lead_id and nadie_contesto and regresada_en is null and coalesce(inicio, creado_en) <= new.en;
  return null;
end $$;
drop trigger if exists regresa_llamada on public.lead_intentos;
create trigger regresa_llamada after insert on public.lead_intentos
  for each row execute function public.trg_intento_regresa_llamada();

-- 5. Cada foto de una llamada -------------------------------------------------------------------
-- Idempotente por call_sid: la misma foto dos veces deja lo mismo; un campo vacío no borra lo que
-- ya había (coalesce). Un error de datos (fecha o número mal escrito) sale con código 22xxx, que
-- la función de borde contesta como 400 para que el conmutador no lo reintente igual.
create or replace function public.telefono_registrar_evento(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_sid text := nullif(trim(p->>'call_sid'), '');
  ll jsonb := p->'llamada';
  ld jsonb := case when jsonb_typeof(p->'lead') = 'object' then p->'lead' end;
  at jsonb := case when jsonb_typeof(p->'llamada'->'atendio') = 'object' then p->'llamada'->'atendio' end;
  v_foto timestamptz := (p->>'enviado_en')::timestamptz;
  v_tel text := nullif(trim(ll->>'telefono'), '');
  v_at_nombre text := nullif(trim(at->>'nombre'), '');
  v_at_tel text := nullif(trim(at->>'telefono'), '');
  v_nadie boolean := (ll->>'nadie_contesto')::boolean;
  v_clave text; v_dir telefono_directorio; v_perfil uuid;
  v_prev llamadas; c llamadas; l leads; v_cli record; v_lead uuid; v_desc text; v_duenos uuid[];
  v_nombre text; v_interes text; v_ltel text; v_lcorreo text; v_notas text; v_act uuid;
begin
  if coalesce(p->>'version', '') <> '1' then raise exception 'Versión del contrato no soportada: %', coalesce(p->>'version', 'ninguna') using errcode = '22023'; end if;
  if coalesce(p->>'tipo', '') <> 'llamada' then raise exception 'Tipo de evento no soportado: %', coalesce(p->>'tipo', 'ninguno') using errcode = '22023'; end if;
  if v_sid is null then raise exception 'Falta call_sid' using errcode = '22023'; end if;
  if jsonb_typeof(ll) is distinct from 'object' then raise exception 'Falta «llamada»' using errcode = '22023'; end if;

  -- Dos fotos de la misma llamada al mismo tiempo (reintento y foto nueva) se forman.
  perform pg_advisory_xact_lock(hashtext('telefono:' || v_sid));
  select * into v_prev from llamadas where call_sid = v_sid;
  if v_prev.id is not null and v_foto is not null and v_prev.foto_en is not null and v_foto < v_prev.foto_en then
    -- Una foto más vieja que la que ya se aplicó: se contesta igual, sin tocar nada.
    return jsonb_build_object('ok', true, 'llamada_id', v_prev.id, 'lead_id', v_prev.lead_id, 'cliente_id', v_prev.cliente_id);
  end if;

  -- Quién la atendió: el directorio (lo llena solo) y, si no está ligado, el teléfono de su perfil.
  v_clave := _telefono_clave(v_at_nombre, v_at_tel);
  if v_clave is not null then
    insert into telefono_directorio (clave, nombre, telefono) values (v_clave, coalesce(v_at_nombre, v_at_tel), v_at_tel)
    on conflict (clave) do update set visto_en = now(),
      nombre = coalesce(excluded.nombre, telefono_directorio.nombre), telefono = coalesce(telefono_directorio.telefono, excluded.telefono)
    returning * into v_dir;
    if v_dir.perfil_id is null and telefono10(v_dir.telefono) is not null then
      select min(pf.id::text)::uuid into v_perfil from perfiles pf
      where pf.activo and telefono10(pf.telefono) = telefono10(v_dir.telefono)
      having count(*) = 1;
      if v_perfil is not null then
        update telefono_directorio set perfil_id = v_perfil, ligado_en = now() where id = v_dir.id returning * into v_dir;
      end if;
    end if;
    v_perfil := v_dir.perfil_id;
  end if;

  insert into llamadas as x (call_sid, telefono, telefono10, inicio, fin, duracion_seg, estado, area, area_nombre,
    atendio_nombre, atendio_telefono, atendio_directorio, atendio_perfil, atendio_ia, nadie_contesto, resumen,
    grabacion_url, grabacion_vence, foto_en, datos)
  values (v_sid, v_tel, telefono10(v_tel), (ll->>'inicio')::timestamptz, (ll->>'fin')::timestamptz, (ll->>'duracion_seg')::int,
    nullif(ll->>'estado', ''), nullif(ll->>'area', ''), nullif(ll->>'area_nombre', ''),
    v_at_nombre, v_at_tel, v_dir.id, v_perfil, nullif(trim(ll->>'atendio_ia'), ''), coalesce(v_nadie, false),
    nullif(trim(ll->>'resumen'), ''), nullif(ll->>'grabacion_url', ''), (ll->>'grabacion_vence')::timestamptz, v_foto,
    -- Lo crudo, sin transcripción aunque algún día venga: es la plática completa de una persona.
    jsonb_strip_nulls(p - 'transcripcion' - 'transcript' || jsonb_build_object('llamada', ll - 'transcripcion' - 'transcript')))
  on conflict (call_sid) do update set
    telefono = coalesce(excluded.telefono, x.telefono),
    telefono10 = coalesce(excluded.telefono10, x.telefono10),
    inicio = coalesce(excluded.inicio, x.inicio),
    fin = coalesce(excluded.fin, x.fin),
    duracion_seg = coalesce(excluded.duracion_seg, x.duracion_seg),
    estado = coalesce(excluded.estado, x.estado),
    area = coalesce(excluded.area, x.area),
    area_nombre = coalesce(excluded.area_nombre, x.area_nombre),
    atendio_nombre = coalesce(excluded.atendio_nombre, x.atendio_nombre),
    atendio_telefono = coalesce(excluded.atendio_telefono, x.atendio_telefono),
    atendio_directorio = coalesce(excluded.atendio_directorio, x.atendio_directorio),
    atendio_perfil = coalesce(excluded.atendio_perfil, x.atendio_perfil),
    atendio_ia = coalesce(excluded.atendio_ia, x.atendio_ia),
    nadie_contesto = case when v_nadie is null then x.nadie_contesto else v_nadie end,
    resumen = coalesce(excluded.resumen, x.resumen),
    grabacion_url = coalesce(excluded.grabacion_url, x.grabacion_url),
    grabacion_vence = coalesce(excluded.grabacion_vence, x.grabacion_vence),
    foto_en = coalesce(excluded.foto_en, x.foto_en),
    datos = x.datos || excluded.datos
  returning * into c;

  -- El cliente, por el teléfono de quien llamó (o el del lead) o su correo.
  if c.cliente_id is null then
    select * into v_cli from cliente_con_contacto(coalesce(c.telefono, ld->>'telefono'), ld->>'correo');
    if v_cli.cliente_id is null and ld is not null and telefono10(ld->>'telefono') is distinct from c.telefono10 then
      select * into v_cli from cliente_con_contacto(ld->>'telefono', null);
    end if;
    if v_cli.cliente_id is not null then
      update llamadas set cliente_id = v_cli.cliente_id, cliente_nombre = v_cli.nombre where id = c.id returning * into c;
    end if;
  end if;

  -- El lead: se crea la primera vez; después solo se llena lo que le falta.
  if ld is not null then
    v_nombre := coalesce(nullif(trim(ld->>'nombre'), ''), nullif(trim(ld->>'empresa'), ''), 'Sin nombre');
    v_interes := coalesce(nullif(trim(ld->>'interes'), ''), left(c.resumen, 300), 'Llamó al teléfono');
    v_ltel := coalesce(nullif(trim(ld->>'telefono'), ''), c.telefono);
    v_lcorreo := nullif(lower(trim(ld->>'correo')), '');
    v_notas := concat_ws(E'\n', 'Entró por el teléfono (IA).', nullif(trim(ld->>'detalle'), ''), nullif(trim(ld->>'notas'), ''));
    if c.lead_id is null then
      if length(v_nombre) >= 2 and length(v_interes) >= 3 and (v_ltel is not null or v_lcorreo is not null or c.cliente_id is not null) then
        perform set_config('hegamex.lead_telefono', 'si', true);
        insert into leads (nombre, empresa, telefono, correo, interes, notas, cliente_id, vendedor_id, llamada_id)
        values (v_nombre, nullif(trim(ld->>'empresa'), ''), v_ltel, v_lcorreo, v_interes, v_notas, c.cliente_id, v_perfil, c.id)
        returning id into v_lead;
        perform set_config('hegamex.lead_telefono', '', true);
        update llamadas set lead_id = v_lead, lead_nombre = v_nombre || coalesce(' (' || nullif(trim(ld->>'empresa'), '') || ')', '')
        where id = c.id returning * into c;
      end if;
    else
      select * into l from leads where id = c.lead_id for update;
      if l.id is not null then
        update leads set
          empresa = coalesce(empresa, nullif(trim(ld->>'empresa'), '')),
          telefono = coalesce(telefono, v_ltel),
          correo = coalesce(correo, v_lcorreo),
          interes = case when interes = 'Llamó al teléfono' and v_interes <> 'Llamó al teléfono' then v_interes else interes end,
          notas = case when notas is null or notas = 'Entró por el teléfono (IA).' then v_notas else notas end
        where id = l.id;
        -- Se creó antes de saber quién lo atendió y sigue sin vendedor: ahora sí es de quien lo atendió.
        if l.estado = 'nuevo' and l.vendedor_id is null and v_perfil is not null and v_perfil in (select vendedores_leads()) then
          update leads set estado = 'asignado', vendedor_id = v_perfil, como_se_asigno = 'llamada', asignado_en = now()
          where id = l.id;
          perform avisar(array[v_perfil], 'lead', 'Lead para ti: ' || l.nombre, 'Lo atendiste por teléfono. ' || l.interes,
            '/ventas/leads?id=' || l.id, 'leads', l.id::text);
        end if;
        if c.cliente_id is null and l.cliente_id is not null then
          update llamadas set cliente_id = l.cliente_id, cliente_nombre = l.cliente_nombre where id = c.id returning * into c;
        end if;
      end if;
    end if;
  end if;

  -- Hubo cliente y una persona la atendió: queda en su actividad (una vez por llamada).
  v_desc := 'Llamada entrante por el conmutador' || coalesce(' (' || c.area_nombre || ')', '') || coalesce(': ' || c.resumen, '');
  if c.cliente_id is not null and c.atendio_perfil is not null and not c.nadie_contesto then
    if c.actividad_id is null then
      insert into actividades (cliente_id, tipo, descripcion, hecha, usuario_id, en)
      values (c.cliente_id, 'llamada', v_desc, true, c.atendio_perfil, coalesce(c.inicio, now()))
      returning id into v_act;
      update llamadas set actividad_id = v_act where id = c.id;
    else
      -- El resumen llega en una foto posterior: se completa si nadie la ha editado.
      update actividades set descripcion = v_desc
      where id = c.actividad_id and descripcion like 'Llamada entrante por el conmutador%' and descripcion <> v_desc;
    end if;
  end if;

  if c.nadie_contesto then
    -- Llegó tarde y el mismo número ya volvió a llamar y lo atendieron.
    if c.regresada_en is null and c.telefono10 is not null and exists (
         select 1 from llamadas o where o.telefono10 = c.telefono10 and o.id <> c.id and not o.nadie_contesto
           and o.atendio_directorio is not null and o.inicio > coalesce(c.inicio, c.creado_en)) then
      update llamadas set regresada_en = now(), regresada_como = 'volvio_a_llamar' where id = c.id returning * into c;
    end if;
    -- Al dueño (vendedor del cliente o del lead), una vez. Sin dueño la ven recepción y la gerencia.
    if c.avisado_en is null and c.regresada_en is null then
      v_duenos := array_remove(array[(select vendedor_id from clientes where id = c.cliente_id),
                                     (select vendedor_id from leads where id = c.lead_id)], null);
      if cardinality(v_duenos) > 0 then
        perform avisar(v_duenos, 'llamada_perdida',
          'Te llamó ' || coalesce(c.lead_nombre, c.cliente_nombre, c.telefono, 'alguien') || ' y nadie contestó',
          coalesce(c.resumen, 'Regrésale la llamada.'), '/ventas/para-llamar', 'llamadas', c.id::text);
      end if;
      update llamadas set avisado_en = now() where id = c.id;
    end if;
  elsif c.atendio_directorio is not null and c.telefono10 is not null then
    -- La atendió una persona: las perdidas anteriores del mismo número ya no hay que regresarlas.
    update llamadas set regresada_en = coalesce(c.inicio, now()), regresada_por = c.atendio_perfil, regresada_como = 'volvio_a_llamar'
    where telefono10 = c.telefono10 and id <> c.id and nadie_contesto and regresada_en is null
      and coalesce(inicio, creado_en) < coalesce(c.inicio, c.creado_en);
  end if;

  update telefono_cuenta set ultimo_evento_en = now(), ultimo_error = null, ultimo_error_en = null where id = 1;
  return jsonb_build_object('ok', true, 'llamada_id', c.id, 'lead_id', c.lead_id, 'cliente_id', c.cliente_id);
end $$;
revoke execute on function public.telefono_registrar_evento(jsonb) from public, anon, authenticated;
grant execute on function public.telefono_registrar_evento(jsonb) to service_role;

-- 6. Regresar llamada ---------------------------------------------------------------------------
-- Lo que cada quien tiene que regresar (la RLS de llamadas decide de quién): de los últimos 7 días,
-- nadie contestó y nadie la ha regresado. Para «A quién llamar hoy» y la lista de recepción.
create or replace function public.llamadas_por_regresar()
returns table (id uuid, telefono text, inicio timestamptz, area_nombre text, resumen text, atendio_ia text,
               cliente_id uuid, cliente_nombre text, lead_id uuid, lead_nombre text, duenio text,
               grabacion_url text, puede_intento boolean)
language sql stable security invoker set search_path = public as $$
  select ll.id, ll.telefono, coalesce(ll.inicio, ll.creado_en), ll.area_nombre, ll.resumen, ll.atendio_ia,
    ll.cliente_id, ll.cliente_nombre, ll.lead_id, ll.lead_nombre, coalesce(pl.nombre, pc.nombre),
    case when ll.grabacion_vence is null or ll.grabacion_vence > now() then ll.grabacion_url end,
    -- «Contestó / No contestó» se anota también en su lead: solo si es tuyo (o eres la gerencia) y sigue abierto.
    coalesce(l.estado = 'asignado' and (select puede('ventas', 2))
             and (l.vendedor_id = (select auth.uid()) or (select puede('leads', 3))), false)
  from llamadas ll
  left join leads l on l.id = ll.lead_id
  left join perfiles pl on pl.id = l.vendedor_id
  left join clientes c on c.id = ll.cliente_id
  left join perfiles pc on pc.id = c.vendedor_id
  where ll.nadie_contesto and ll.regresada_en is null and coalesce(ll.inicio, ll.creado_en) >= now() - interval '7 days'
  order by coalesce(ll.inicio, ll.creado_en) desc
$$;
revoke execute on function public.llamadas_por_regresar() from public, anon;
grant execute on function public.llamadas_por_regresar() to authenticated;

-- «Ya le regresé»: quien la ve la puede marcar. Si su lead es tuyo y dices si contestó, queda también
-- como intento (canal llamada: «Contestó» con lo que dijo, o «No contestó»). Si es de un cliente,
-- queda en su actividad.
create or replace function public.marcar_llamada_regresada(p_id uuid, p_nota text default null, p_contesto boolean default null)
returns void language plpgsql security definer set search_path = public as $$
declare c llamadas; l leads; v_nota text := nullif(trim(coalesce(p_nota, '')), ''); v_quien text;
begin
  if en_vista_previa() then raise exception 'Estás viendo el ERP como otra persona: desde aquí no se cambia nada' using errcode = '42501'; end if;
  select * into c from llamadas where id = p_id for update;
  -- coalesce: sin quien la atendió, la comparación da null y el «not» dejaba pasar a cualquiera.
  if c.id is null or not (puede('ventas', 3) or coalesce(c.atendio_perfil = auth.uid(), false) or p_id in (select mis_llamadas())) then
    raise exception 'No encontramos esa llamada (o es de otro vendedor)' using errcode = '42501';
  end if;
  if c.regresada_en is not null then
    select nombre into v_quien from perfiles where id = c.regresada_por;
    raise exception 'Esa llamada ya se regresó%', coalesce(' (' || v_quien || ')', '');
  end if;
  update llamadas set regresada_en = now(), regresada_por = auth.uid(), regresada_como = 'regresada', regresada_nota = v_nota
  where id = p_id;
  if p_contesto is not null and c.lead_id is not null then
    select * into l from leads where id = c.lead_id;
    if l.estado = 'asignado' then
      perform registrar_intento_lead(l.id, 'llamada', case when p_contesto then 'contesto' else 'no_contesto' end, v_nota);
    end if;
  end if;
  if c.cliente_id is not null and puede('ventas', 2) then
    insert into actividades (cliente_id, tipo, descripcion, hecha, usuario_id)
    values (c.cliente_id, 'llamada', 'Le regresé la llamada' || case when p_contesto is false then ' (no contestó)' else '' end
            || coalesce(': ' || v_nota, ''), true, auth.uid());
  end if;
end $$;
revoke execute on function public.marcar_llamada_regresada(uuid, text, boolean) from public, anon;
grant execute on function public.marcar_llamada_regresada(uuid, text, boolean) to authenticated;

-- 7. Para Configuración → Integraciones ---------------------------------------------------------
create or replace function public.estado_telefono() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare t telefono_cuenta;
begin
  if not puede('admin', 3) then raise exception 'Solo sistemas y dirección ven la conexión del teléfono' using errcode = '42501'; end if;
  select * into t from telefono_cuenta where id = 1;
  return jsonb_build_object(
    'tiene_llave', t.llave_huella is not null,
    'generada_en', t.generada_en,
    'generada_por', (select nombre from perfiles where id = t.generada_por),
    'ultimo_evento_en', t.ultimo_evento_en,
    'ultimo_error', t.ultimo_error,
    'ultimo_error_en', t.ultimo_error_en,
    'llamadas_7d', (select count(*) from llamadas where coalesce(inicio, creado_en) >= now() - interval '7 days'),
    'nadie_contesto_7d', (select count(*) from llamadas where nadie_contesto and coalesce(inicio, creado_en) >= now() - interval '7 days'),
    'directorio_sin_persona', (select count(*) from telefono_directorio where perfil_id is null));
end $$;
revoke execute on function public.estado_telefono() from public, anon;
grant execute on function public.estado_telefono() to authenticated;

-- Dirección liga un nombre del conmutador a una persona del ERP (o lo desliga con null). Las
-- llamadas que ya había atendido quedan a su nombre (para que las vea); los leads y actividades ya
-- creados no se mueven.
create or replace function public.fijar_directorio_telefono(p_id uuid, p_perfil uuid) returns void
language plpgsql security definer set search_path = public as $$
declare d telefono_directorio;
begin
  if not tiene_rol('direccion') then raise exception 'El directorio del teléfono lo liga dirección' using errcode = '42501'; end if;
  if en_vista_previa() then raise exception 'Estás viendo el ERP como otra persona: desde aquí no se cambia nada' using errcode = '42501'; end if;
  if p_perfil is not null and not exists (select 1 from perfiles where id = p_perfil and activo) then
    raise exception 'Esa persona no está activa';
  end if;
  select * into d from telefono_directorio where id = p_id for update;
  if d.id is null then raise exception 'Ese nombre no está en el directorio'; end if;
  update telefono_directorio set perfil_id = p_perfil, ligado_por = auth.uid(), ligado_en = now() where id = p_id;
  update llamadas set atendio_perfil = p_perfil
  where atendio_directorio = p_id and (atendio_perfil is null or atendio_perfil = d.perfil_id) and p_perfil is not null;
end $$;
revoke execute on function public.fijar_directorio_telefono(uuid, uuid) from public, anon;
grant execute on function public.fijar_directorio_telefono(uuid, uuid) to authenticated;

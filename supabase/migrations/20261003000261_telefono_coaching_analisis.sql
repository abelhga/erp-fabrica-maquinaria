-- =============================================================================
-- Teléfono, fase 3: el coaching y lo que dicen las llamadas entran al ERP, cada uno con quién lo ve.
--
-- Por qué: el conmutador ya califica las llamadas (rúbrica con pesos y topes, evidencia por criterio)
-- y saca de cada una qué pidieron, qué no se supo contestar y qué objetó el cliente; todo eso se
-- quedaba en su panel. Ahora viaja en la misma foto de la llamada (258), en dos llaves nuevas,
-- `coaching` y `analisis` (docs/integracion-telefono.md, «Fase 3»).
--
-- La trampa que esto cierra: cualquier llave nueva de la foto caía completa en llamadas.datos, y esa
-- tabla la ve también el dueño del cliente aunque haya atendido otro vendedor. El coaching de Isaac lo
-- habría visto otro vendedor. Por eso el ERP sale primero que voz y cada cosa va a su tabla:
--   * llamada_coaching: solo quien atendió (perfil_id) y la gerencia de ventas/dirección (ventas 3),
--     el mismo patrón de comisiones. Nunca otro vendedor, ni el dueño del cliente si atendió otro.
--   * llamada_analisis: quien ve la llamada (la RLS de llamadas decide). Sin datos personales.
-- Solo telefono_registrar_evento las escribe. Llave ausente = no se toca; null = se borra (se rehízo y
-- falló, o se quitó); objeto = reemplaza todo (no se mezcla con lo de antes).
--
-- Además, con la misma foto:
--   * llamada.historica: la foto de una llamada anterior a la conexión, para llenar la historia. Se
--     guarda con su coaching y su análisis, se liga al cliente, pero no crea ni toca leads,
--     actividades, avisos ni «Regresar llamada» (sería avisar hoy de algo de hace meses).
--   * corrección de ubicación: cuando el conmutador vuelve a oír la grabación y corrige la ciudad o el
--     estado («Antequila» → «Tequila»), el lead se corrige si sigue con lo que mandó el teléfono la vez
--     anterior o vacío. Si una persona lo cambió, manda la persona.
--   * coaching_resumen, coaching_llamadas y llamadas_analitica para las pantallas; el indicador 75
--     para Objetivos; dos reglas nocturnas hechas solo en SQL (a la IA no le llega nada de esto).
-- =============================================================================

-- 0. Llamadas: si es de la historia, y un índice por fecha para la analítica -----------------------
alter table public.llamadas add column if not exists historica boolean not null default false;
comment on column public.llamadas.historica is
  'Llegó como foto de una llamada anterior a conectar el conmutador: no crea leads, actividades, avisos ni «Regresar llamada».';
create index if not exists llamadas_fecha on public.llamadas ((coalesce(inicio, creado_en)));

-- Si alguna foto vieja ya hubiera traído coaching o análisis (antes de esta migración caían en datos),
-- se quitan de ahí: los veía quien ve la llamada.
update public.llamadas set datos = datos - 'coaching' - 'analisis' - 'insights'
where datos ?| array['coaching', 'analisis', 'insights'];

-- 1. Tablas ----------------------------------------------------------------------------------------
create table if not exists public.llamada_coaching (
  llamada_id uuid primary key references public.llamadas(id) on delete cascade,
  -- Quien atendió (llamadas.atendio_perfil). Null: la calificó a la IA, o el nombre del conmutador
  -- todavía no está ligado a nadie del ERP (lo ve solo la gerencia; al ligarlo se le asigna).
  perfil_id uuid references public.perfiles(id) on delete set null,
  atendio_tipo text not null check (atendio_tipo in ('persona', 'ia')),
  -- La calcula el conmutador con los pesos y topes de su rúbrica; el ERP no la recalcula.
  calificacion numeric(3,1) not null check (calificacion between 1 and 10),
  calificacion_sin_topes numeric(3,1) check (calificacion_sin_topes is null or calificacion_sin_topes between 0 and 10),
  rubrica_clave text,
  rubrica_version int,
  criterios jsonb not null default '[]' check (jsonb_typeof(criterios) = 'array'),   -- [{clave, nombre, peso, nota, evidencia, segundo}]
  topes jsonb not null default '[]' check (jsonb_typeof(topes) = 'array'),           -- [{clave, nombre, maximo}]
  fallos jsonb not null default '[]' check (jsonb_typeof(fallos) = 'array'),         -- [{clave, nombre, texto}]
  tono jsonb not null default '[]' check (jsonb_typeof(tono) = 'array'),             -- [{clave, nombre, signo, texto}]
  lo_bueno text[] not null default '{}',
  a_mejorar text[] not null default '{}',
  sugerencias text[] not null default '{}',
  resumen text,
  modelo text,
  generado_en timestamptz,
  recibido_en timestamptz not null default now()
);
create index if not exists llamada_coaching_perfil on public.llamada_coaching (perfil_id) where perfil_id is not null;

create table if not exists public.llamada_analisis (
  llamada_id uuid primary key references public.llamadas(id) on delete cascade,
  intencion text,
  desenlace text,
  equipos jsonb not null default '[]' check (jsonb_typeof(equipos) = 'array'),       -- [{texto, clave_catalogo, articulo_id}]
  preguntas_sin_respuesta text[] not null default '{}',
  objeciones jsonb not null default '[]' check (jsonb_typeof(objeciones) = 'array'), -- [{categoria, texto}]
  stt_dudoso boolean not null default false,
  fuente_transcripcion text,
  modelo text,
  generado_en timestamptz,
  recibido_en timestamptz not null default now()
);

-- 2. Quién ve qué ----------------------------------------------------------------------------------
-- Nada por renglón (ver 086): puede() y auth.uid() una vez; el análisis sigue a la RLS de llamadas
-- con una subconsulta de conjunto (la de llamadas ya resuelve mis_llamadas() una sola vez).
alter table public.llamada_coaching enable row level security;
drop policy if exists ver on public.llamada_coaching;
create policy ver on public.llamada_coaching for select to authenticated using (
  perfil_id = (select auth.uid()) or (select puede('ventas', 3)));
revoke insert, update, delete on public.llamada_coaching from anon, authenticated;
grant select on public.llamada_coaching to authenticated;

alter table public.llamada_analisis enable row level security;
drop policy if exists ver on public.llamada_analisis;
create policy ver on public.llamada_analisis for select to authenticated using (
  (select puede('ventas', 3)) or llamada_id in (select ll.id from public.llamadas ll));
revoke insert, update, delete on public.llamada_analisis from anon, authenticated;
grant select on public.llamada_analisis to authenticated;

do $$ begin
  alter publication supabase_realtime add table public.llamada_coaching;
exception when duplicate_object then null; when undefined_object then raise notice 'Sin publicación de tiempo real';
end $$;
do $$ begin
  alter publication supabase_realtime add table public.llamada_analisis;
exception when duplicate_object then null; when undefined_object then raise notice 'Sin publicación de tiempo real';
end $$;

-- 3. Ayudas ----------------------------------------------------------------------------------------
-- La ciudad como la guarda el lead (260): sin espacios de más y con tope de 80 letras. Una sola regla
-- para guardar y para comparar con la foto anterior.
create or replace function public._telefono_ciudad(p text) returns text
language sql immutable parallel safe set search_path = public as $$
  select nullif(btrim(left(btrim(regexp_replace(coalesce(p, ''), '\s+', ' ', 'g')), 80)), '')
$$;
revoke execute on function public._telefono_ciudad(text) from public, anon, authenticated;

-- Respaldo del lado del ERP: el conmutador promete no mandar teléfonos ni correos en los textos del
-- análisis, pero estos textos se juntan y los ve más gente (y salen en la revisión nocturna). Siete
-- dígitos o más seguidos (con espacios, guiones o paréntesis) son un teléfono; «20 m» o «4x8» no.
create or replace function public.sin_datos_personales(p text) returns text
language sql immutable parallel safe set search_path = public as $$
  select nullif(btrim(regexp_replace(regexp_replace(regexp_replace(coalesce(p, ''),
    '[[:alnum:]._%+-]+@[[:alnum:].-]+\.[[:alpha:]]{2,}', '[correo]', 'g'),
    '\+?\d(?:[\s().-]*\d){6,}', '[teléfono]', 'g'),
    '\s+', ' ', 'g')), '')
$$;
revoke execute on function public.sin_datos_personales(text) from public, anon;
grant execute on function public.sin_datos_personales(text) to authenticated;

-- Para juntar lo que se dice distinto pero es lo mismo: «¿Manejan bandas de PVC grado alimenticio?»
-- y «¿tienen banda PVC grado alimenticio?» dan la misma clave. Sin acentos ni signos, sin las palabras
-- que no dicen qué se busca (artículos, «tienen», «manejan», la cortesía y lo que dejó el filtro de
-- datos personales), en singular y en orden. «Cuánto cuesta» y «precio» quedan como «precio»:
-- preguntar el precio de algo no es lo mismo que preguntar si existe.
create or replace function public.llamada_texto_clave(p text) returns text
language sql immutable parallel safe set search_path = public as $$
  select nullif(array_to_string(array(
    select distinct w from (
      select case when t in ('cuesta', 'cuestan', 'costo', 'costos', 'cuanto', 'cuantos', 'vale', 'valen', 'precios', 'cotizacion', 'cotizar') then 'precio'
                  when length(t) > 4 and t ~ '[^aeiou]es$' then left(t, -2)
                  when length(t) > 3 and t ~ '[aeiou]s$' then left(t, -1)
                  else t end w
      from regexp_split_to_table(regexp_replace(sin_acentos(regexp_replace(p, '\[(teléfono|correo)\]', ' ', 'g')), '[^a-z0-9]+', ' ', 'g'), ' ') t
      where t <> '' and not t = any (array[
        'a', 'al', 'algo', 'algun', 'alguna', 'alguno', 'algunos', 'ante', 'aqui', 'cada', 'como', 'con', 'cual', 'cuales',
        'cuando', 'de', 'del', 'donde', 'e', 'el', 'ella', 'en', 'es', 'esa', 'ese', 'eso', 'esta', 'este', 'esto', 'estan',
        'hay', 'la', 'las', 'le', 'les', 'lo', 'los', 'mas', 'me', 'mi', 'muy', 'no', 'nos', 'o', 'para', 'pero', 'por', 'que',
        'quiero', 'quisiera', 'saber', 'se', 'si', 'sin', 'sobre', 'son', 'su', 'sus', 'tambien', 'tiene', 'tienen', 'tener',
        'u', 'un', 'una', 'unas', 'uno', 'unos', 'usted', 'ustedes', 'y', 'ya', 'manejan', 'maneja', 'venden', 'vende',
        'hacen', 'hace', 'fabrican', 'fabrica', 'pueden', 'puede', 'podrian', 'cuenta', 'cuentan', 'disponible', 'existe',
        -- lo que acompaña a un dato de contacto (que ya se quitó) o a la cortesía
        'numero', 'telefono', 'correo', 'whatsapp', 'marque', 'marcar', 'marcame', 'llame', 'llamar', 'llamen', 'hablar', 'hableme',
        'favor', 'gracias', 'oiga', 'buenas', 'buenos', 'dias', 'tardes'])
    ) x where w <> '' order by w), ' '), '')
$$;
revoke execute on function public.llamada_texto_clave(text) from public, anon;
grant execute on function public.llamada_texto_clave(text) to authenticated;

-- Una lista de textos del contrato, en su orden, sin vacíos y con tope de largo y de cuántos.
create or replace function public._json_textos(p jsonb, p_largo int, p_max int) returns text[]
language sql immutable parallel safe set search_path = public as $$
  select coalesce(array(
    select left(btrim(t.v), p_largo) from jsonb_array_elements_text(case when jsonb_typeof(p) = 'array' then p else '[]' end) with ordinality t(v, i)
    where btrim(t.v) <> '' order by t.i limit p_max), '{}')
$$;
revoke execute on function public._json_textos(jsonb, int, int) from public, anon, authenticated;

-- 4. Cada foto de una llamada (260), ahora con coaching, análisis, historia y corrección de ubicación ---
-- Idempotente por call_sid: la misma foto dos veces deja lo mismo; un campo vacío no borra lo que
-- ya había (coalesce), salvo coaching y analisis, que siguen la regla de presencia. Un dato que no se
-- puede leer sale con código 22xxx, que la función de borde contesta como 400 (no se reintenta igual).
create or replace function public.telefono_registrar_evento(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_sid text := nullif(trim(p->>'call_sid'), '');
  ll jsonb := p->'llamada';
  ld jsonb := case when jsonb_typeof(p->'lead') = 'object' then p->'lead' end;
  at jsonb := case when jsonb_typeof(p->'llamada'->'atendio') = 'object' then p->'llamada'->'atendio' end;
  co jsonb := p->'coaching';
  an jsonb := p->'analisis';
  v_foto timestamptz := (p->>'enviado_en')::timestamptz;
  v_tel text := nullif(trim(ll->>'telefono'), '');
  v_at_nombre text := nullif(trim(at->>'nombre'), '');
  v_at_tel text := nullif(trim(at->>'telefono'), '');
  v_nadie boolean := (ll->>'nadie_contesto')::boolean;
  v_hist boolean := coalesce((ll->>'historica')::boolean, false);
  v_clave text; v_dir telefono_directorio; v_perfil uuid;
  v_prev llamadas; c llamadas; l leads; v_cli record; v_lead uuid; v_desc text; v_duenos uuid[];
  v_nombre text; v_interes text; v_ltel text; v_lcorreo text; v_notas text; v_act uuid;
  v_ciudad text; v_estado text; v_ciudad_antes text; v_estado_antes text; v_a_mano boolean;
  v_cal numeric; v_tipo text;
begin
  if coalesce(p->>'version', '') <> '1' then raise exception 'Versión del contrato no soportada: %', coalesce(p->>'version', 'ninguna') using errcode = '22023'; end if;
  if coalesce(p->>'tipo', '') <> 'llamada' then raise exception 'Tipo de evento no soportado: %', coalesce(p->>'tipo', 'ninguno') using errcode = '22023'; end if;
  if v_sid is null then raise exception 'Falta call_sid' using errcode = '22023'; end if;
  if jsonb_typeof(ll) is distinct from 'object' then raise exception 'Falta «llamada»' using errcode = '22023'; end if;
  -- Se revisan antes de tocar nada: un coaching mal hecho no debe dejar la llamada a medias. Una
  -- violación de un «check» sería 23514 (500, el conmutador reintentaría para siempre); esto es 400.
  if p ? 'coaching' and jsonb_typeof(co) not in ('object', 'null') then raise exception '«coaching» debe ser un objeto o null' using errcode = '22023'; end if;
  if p ? 'analisis' and jsonb_typeof(an) not in ('object', 'null') then raise exception '«analisis» debe ser un objeto o null' using errcode = '22023'; end if;
  if jsonb_typeof(co) = 'object' then
    v_cal := case when jsonb_typeof(co->'calificacion') = 'number' then round((co->>'calificacion')::numeric, 1) end;
    if v_cal is null or v_cal < 1 or v_cal > 10 then raise exception 'coaching.calificacion debe ser un número de 1 a 10' using errcode = '22023'; end if;
    if jsonb_typeof(co->'calificacion_sin_topes') = 'number' and (co->>'calificacion_sin_topes')::numeric not between 0 and 10 then
      raise exception 'coaching.calificacion_sin_topes debe ir de 0 a 10' using errcode = '22023';
    end if;
    v_tipo := co->>'atendio_tipo';
    if v_tipo is null or v_tipo not in ('persona', 'ia') then raise exception 'coaching.atendio_tipo debe ser "persona" o "ia"' using errcode = '22023'; end if;
  end if;

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
    grabacion_url, grabacion_vence, foto_en, historica, datos)
  values (v_sid, v_tel, telefono10(v_tel), (ll->>'inicio')::timestamptz, (ll->>'fin')::timestamptz, (ll->>'duracion_seg')::int,
    nullif(ll->>'estado', ''), nullif(ll->>'area', ''), nullif(ll->>'area_nombre', ''),
    v_at_nombre, v_at_tel, v_dir.id, v_perfil, nullif(trim(ll->>'atendio_ia'), ''), coalesce(v_nadie, false),
    nullif(trim(ll->>'resumen'), ''), nullif(ll->>'grabacion_url', ''), (ll->>'grabacion_vence')::timestamptz, v_foto, v_hist,
    -- Lo crudo, sin transcripción aunque algún día venga (es la plática completa de una persona) y sin
    -- coaching ni análisis: van a sus tablas, con su propia regla de quién los ve.
    jsonb_strip_nulls(p - 'transcripcion' - 'transcript' - 'coaching' - 'analisis'
                      || jsonb_build_object('llamada', ll - 'transcripcion' - 'transcript')))
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
    -- Una vez de la historia, de la historia: si una foto posterior olvida la marca, no debe crear hoy
    -- el lead ni el aviso de una llamada de hace meses.
    historica = x.historica or excluded.historica,
    -- El lead se junta campo por campo (el resto, llave por llave): así «lo último que mandó el
    -- teléfono» de cada dato sigue ahí aunque una foto no lo traiga, y la corrección de ubicación
    -- compara contra eso.
    datos = (x.datos - 'coaching' - 'analisis') || excluded.datos
            || case when jsonb_typeof(x.datos->'lead') = 'object' and jsonb_typeof(excluded.datos->'lead') = 'object'
                    then jsonb_build_object('lead', (x.datos->'lead') || (excluded.datos->'lead')) else '{}'::jsonb end
  returning * into c;

  -- El cliente, por el teléfono de quien llamó (o el del lead) o su correo. También en las históricas.
  if c.cliente_id is null then
    select * into v_cli from cliente_con_contacto(coalesce(c.telefono, ld->>'telefono'), ld->>'correo');
    if v_cli.cliente_id is null and ld is not null and telefono10(ld->>'telefono') is distinct from c.telefono10 then
      select * into v_cli from cliente_con_contacto(ld->>'telefono', null);
    end if;
    if v_cli.cliente_id is not null then
      update llamadas set cliente_id = v_cli.cliente_id, cliente_nombre = v_cli.nombre where id = c.id returning * into c;
    end if;
  end if;

  -- El lead: se crea la primera vez; después solo se llena lo que le falta (y se corrige la ubicación
  -- que mandó el teléfono). Una llamada de la historia no crea ni toca leads.
  if ld is not null and not c.historica then
    v_nombre := coalesce(nullif(trim(ld->>'nombre'), ''), nullif(trim(ld->>'empresa'), ''), 'Sin nombre');
    v_interes := coalesce(nullif(trim(ld->>'interes'), ''), left(c.resumen, 300), 'Llamó al teléfono');
    v_ltel := coalesce(nullif(trim(ld->>'telefono'), ''), c.telefono);
    v_lcorreo := nullif(lower(trim(ld->>'correo')), '');
    v_notas := concat_ws(E'\n', 'Entró por el teléfono (IA).', nullif(trim(ld->>'detalle'), ''), nullif(trim(ld->>'notas'), ''));
    v_ciudad := _telefono_ciudad(ld->>'ciudad');
    v_estado := normalizar_estado_mx(ld->>'estado');
    if c.lead_id is null then
      if length(v_nombre) >= 2 and length(v_interes) >= 3 and (v_ltel is not null or v_lcorreo is not null or c.cliente_id is not null) then
        perform set_config('hegamex.lead_telefono', 'si', true);
        insert into leads (nombre, empresa, telefono, correo, ciudad, estado_mx, interes, notas, cliente_id, vendedor_id, llamada_id)
        values (v_nombre, nullif(trim(ld->>'empresa'), ''), v_ltel, v_lcorreo, v_ciudad, v_estado, v_interes, v_notas, c.cliente_id, v_perfil, c.id)
        returning id into v_lead;
        perform set_config('hegamex.lead_telefono', '', true);
        update llamadas set lead_id = v_lead, lead_nombre = v_nombre || coalesce(' (' || nullif(trim(ld->>'empresa'), '') || ')', '')
        where id = c.id returning * into c;
      end if;
    else
      -- Lo que el teléfono había dejado en el lead, como lo guardó el ERP: si el lead sigue igual,
      -- nadie lo tocó a mano y la corrección (la grabación oída otra vez) sí entra.
      v_ciudad_antes := _telefono_ciudad(v_prev.datos->'lead'->>'ciudad');
      v_estado_antes := normalizar_estado_mx(v_prev.datos->'lead'->>'estado');
      select * into l from leads where id = c.lead_id for update;
      v_a_mano := (nullif(trim(l.ciudad), '') is not null and l.ciudad is distinct from v_ciudad_antes)
               or (nullif(trim(l.estado_mx), '') is not null and l.estado_mx is distinct from v_estado_antes);
      if l.id is not null then
        update leads set
          empresa = coalesce(empresa, nullif(trim(ld->>'empresa'), '')),
          telefono = coalesce(telefono, v_ltel),
          correo = coalesce(correo, v_lcorreo),
          -- En blanco cuenta como vacío: la pantalla también lo marca «Le falta dónde está». La
          -- ubicación es una sola cosa: si una persona cambió la ciudad o el estado, ya la revisó
          -- entera y el teléfono solo llena lo que siga vacío.
          ciudad = case when v_ciudad is not null and (nullif(trim(ciudad), '') is null or (v_a_mano is false and ciudad = v_ciudad_antes))
                        then v_ciudad else ciudad end,
          estado_mx = case when v_estado is not null and (nullif(trim(estado_mx), '') is null or (v_a_mano is false and estado_mx = v_estado_antes))
                           then v_estado else estado_mx end,
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

  if not c.historica then
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
  end if;

  -- El coaching: ausente no se toca, null se borra, objeto reemplaza todo. Califica a quien atendió
  -- según el directorio; si calificó a la IA, no es de nadie (lo ve la gerencia).
  if p ? 'coaching' then
    if jsonb_typeof(co) = 'null' then
      delete from llamada_coaching where llamada_id = c.id;
    else
      insert into llamada_coaching as k (llamada_id, perfil_id, atendio_tipo, calificacion, calificacion_sin_topes, rubrica_clave,
        rubrica_version, criterios, topes, fallos, tono, lo_bueno, a_mejorar, sugerencias, resumen, modelo, generado_en, recibido_en)
      values (c.id, case when v_tipo = 'persona' then c.atendio_perfil end, v_tipo, v_cal,
        case when jsonb_typeof(co->'calificacion_sin_topes') = 'number' then round((co->>'calificacion_sin_topes')::numeric, 1) end,
        nullif(trim(co->'rubrica'->>'clave'), ''), (co->'rubrica'->>'version')::int,
        case when jsonb_typeof(co->'criterios') = 'array' then co->'criterios' else '[]' end,
        case when jsonb_typeof(co->'topes') = 'array' then co->'topes' else '[]' end,
        case when jsonb_typeof(co->'fallos') = 'array' then co->'fallos' else '[]' end,
        case when jsonb_typeof(co->'tono') = 'array' then co->'tono' else '[]' end,
        _json_textos(co->'lo_bueno', 300, 3), _json_textos(co->'a_mejorar', 300, 3), _json_textos(co->'sugerencias', 300, 3),
        left(nullif(trim(co->>'resumen'), ''), 600), nullif(trim(co->>'modelo'), ''), (co->>'generado_en')::timestamptz, now())
      on conflict (llamada_id) do update set
        perfil_id = excluded.perfil_id, atendio_tipo = excluded.atendio_tipo, calificacion = excluded.calificacion,
        calificacion_sin_topes = excluded.calificacion_sin_topes, rubrica_clave = excluded.rubrica_clave,
        rubrica_version = excluded.rubrica_version, criterios = excluded.criterios, topes = excluded.topes,
        fallos = excluded.fallos, tono = excluded.tono, lo_bueno = excluded.lo_bueno, a_mejorar = excluded.a_mejorar,
        sugerencias = excluded.sugerencias, resumen = excluded.resumen, modelo = excluded.modelo,
        generado_en = excluded.generado_en, recibido_en = now();
    end if;
  elsif c.atendio_perfil is not null then
    -- Una foto sin coaching que por fin dice quién atendió: el coaching que ya había es suyo.
    update llamada_coaching set perfil_id = c.atendio_perfil
    where llamada_id = c.id and atendio_tipo = 'persona' and perfil_id is null;
  end if;

  -- El análisis, con la misma regla. Los equipos se ligan al catálogo por su clave si existe; los
  -- textos pasan por el filtro de datos personales (los junta la analítica y la revisión nocturna).
  if p ? 'analisis' then
    if jsonb_typeof(an) = 'null' then
      delete from llamada_analisis where llamada_id = c.id;
    else
      insert into llamada_analisis as a (llamada_id, intencion, desenlace, equipos, preguntas_sin_respuesta, objeciones,
        stt_dudoso, fuente_transcripcion, modelo, generado_en, recibido_en)
      values (c.id, left(nullif(lower(trim(an->>'intencion')), ''), 40), left(nullif(lower(trim(an->>'desenlace')), ''), 40),
        coalesce((select jsonb_agg(jsonb_build_object(
            'texto', left(sin_datos_personales(e.v->>'texto'), 120),
            'clave_catalogo', nullif(trim(e.v->>'clave_catalogo'), ''),
            'articulo_id', (select ar.id from articulos ar where ar.clave = nullif(trim(e.v->>'clave_catalogo'), '')))
            order by e.i)
          from jsonb_array_elements(case when jsonb_typeof(an->'equipos') = 'array' then an->'equipos' else '[]' end) with ordinality e(v, i)
          where jsonb_typeof(e.v) = 'object' and (sin_datos_personales(e.v->>'texto') is not null or nullif(trim(e.v->>'clave_catalogo'), '') is not null)), '[]'),
        coalesce(array(select x from unnest(_json_textos(an->'preguntas_sin_respuesta', 300, 5)) with ordinality q(t, i),
                         lateral sin_datos_personales(q.t) x where x is not null order by q.i), '{}'),
        coalesce((select jsonb_agg(jsonb_build_object('categoria', coalesce(left(nullif(lower(trim(o.v->>'categoria')), ''), 40), 'otro'),
                                                     'texto', left(sin_datos_personales(o.v->>'texto'), 300)) order by o.i)
          from jsonb_array_elements(case when jsonb_typeof(an->'objeciones') = 'array' then an->'objeciones' else '[]' end) with ordinality o(v, i)
          where jsonb_typeof(o.v) = 'object'), '[]'),
        coalesce((an->>'stt_dudoso')::boolean, false), left(nullif(trim(an->>'fuente_transcripcion'), ''), 40),
        nullif(trim(an->>'modelo'), ''), (an->>'generado_en')::timestamptz, now())
      on conflict (llamada_id) do update set
        intencion = excluded.intencion, desenlace = excluded.desenlace, equipos = excluded.equipos,
        preguntas_sin_respuesta = excluded.preguntas_sin_respuesta, objeciones = excluded.objeciones,
        stt_dudoso = excluded.stt_dudoso, fuente_transcripcion = excluded.fuente_transcripcion, modelo = excluded.modelo,
        generado_en = excluded.generado_en, recibido_en = now();
    end if;
  end if;

  update telefono_cuenta set ultimo_evento_en = now(), ultimo_error = null, ultimo_error_en = null where id = 1;
  return jsonb_build_object('ok', true, 'llamada_id', c.id, 'lead_id', c.lead_id, 'cliente_id', c.cliente_id);
end $$;
revoke execute on function public.telefono_registrar_evento(jsonb) from public, anon, authenticated;
grant execute on function public.telefono_registrar_evento(jsonb) to service_role;

-- 5. «Regresar llamada» (258) sin las de la historia -----------------------------------------------
-- Una llamada de hace dos días que llega con el relleno histórico no es un pendiente de hoy.
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
  where ll.nadie_contesto and ll.regresada_en is null and not ll.historica
    and coalesce(ll.inicio, ll.creado_en) >= now() - interval '7 days'
  order by coalesce(ll.inicio, ll.creado_en) desc
$$;
revoke execute on function public.llamadas_por_regresar() from public, anon;
grant execute on function public.llamadas_por_regresar() to authenticated;

-- 6. Ligar a alguien en el directorio (258): sus llamadas y ahora también sus coachings ------------
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
  -- El coaching de esas llamadas es de la misma persona (el de la IA sigue sin dueño).
  update llamada_coaching k set perfil_id = p_perfil
  from llamadas ll
  where ll.id = k.llamada_id and ll.atendio_directorio = p_id and k.atendio_tipo = 'persona' and p_perfil is not null
    and (k.perfil_id is null or k.perfil_id = d.perfil_id);
end $$;
revoke execute on function public.fijar_directorio_telefono(uuid, uuid) from public, anon;
grant execute on function public.fijar_directorio_telefono(uuid, uuid) to authenticated;

-- 7. Analítica para las pantallas ------------------------------------------------------------------
-- El coaching de un periodo (fechas de la planta, las dos incluidas). Cada quien el suyo; la
-- gerencia de ventas y dirección, el de todos o el de una persona (p_perfil). Es definer para no
-- depender de la RLS de llamadas al tomar la fecha: la regla de quién ve qué está aquí, igual a la
-- de llamada_coaching. Pedir el de otra persona sin ser gerencia es un error, no una lista vacía.
-- La tendencia de cada quien (las últimas 4 semanas hasta p_hasta contra las 4 de antes) no depende
-- del periodo elegido: con un periodo de 30 días también hay contra qué comparar.
create or replace function public.coaching_resumen(p_desde date, p_hasta date, p_perfil uuid default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  tz constant text := 'America/Mexico_City';
  v_yo uuid := auth.uid();
  v_todos boolean := puede('ventas', 3);
  v_t0 timestamptz := p_desde::timestamp at time zone 'America/Mexico_City';
  v_t1 timestamptz := (p_hasta + 1)::timestamp at time zone 'America/Mexico_City';
  v_h4 timestamptz := (p_hasta - 27)::timestamp at time zone 'America/Mexico_City';
  v_h8 timestamptz := (p_hasta - 55)::timestamp at time zone 'America/Mexico_City';
  v_r jsonb;
begin
  if v_yo is null then raise exception 'Necesitas entrar al ERP para ver el coaching' using errcode = '42501'; end if;
  if p_desde is null or p_hasta is null or p_hasta < p_desde then raise exception 'El periodo no es válido' using errcode = '22023'; end if;
  if p_hasta - p_desde > 400 then raise exception 'El periodo es muy largo: máximo 400 días' using errcode = '22023'; end if;
  if p_perfil is not null and p_perfil <> v_yo and not v_todos then
    raise exception 'El coaching de otra persona solo lo ve la gerencia de ventas y dirección' using errcode = '42501';
  end if;

  with k as materialized (
    select k.*, coalesce(ll.inicio, ll.creado_en) fecha, date_trunc('week', coalesce(ll.inicio, ll.creado_en) at time zone tz)::date semana,
      coalesce(k.perfil_id::text, k.atendio_tipo || ':' || coalesce(sin_acentos(ll.atendio_nombre), '')) quien,
      ll.atendio_nombre, ll.atendio_ia
    from llamada_coaching k join llamadas ll on ll.id = k.llamada_id
    where coalesce(ll.inicio, ll.creado_en) >= v_t0 and coalesce(ll.inicio, ll.creado_en) < v_t1
      and case when p_perfil is not null then k.perfil_id = p_perfil
               when v_todos then true
               else k.perfil_id = v_yo end
  ),
  crit as (
    select c.v->>'clave' clave, (array_agg(c.v->>'nombre' order by k.fecha desc))[1] nombre,
      round(avg((c.v->>'peso')::numeric), 1) peso, count(*) n, round(avg((c.v->>'nota')::numeric), 1) promedio
    from k, jsonb_array_elements(k.criterios) c(v)
    where jsonb_typeof(c.v) = 'object' and c.v->>'clave' is not null and jsonb_typeof(c.v->'nota') = 'number'
    group by 1
  ),
  fal as (
    select f.v->>'clave' clave, (array_agg(f.v->>'nombre' order by k.fecha desc))[1] nombre, count(distinct k.llamada_id) n
    from k, jsonb_array_elements(k.fallos) f(v)
    where jsonb_typeof(f.v) = 'object' and f.v->>'clave' is not null
    group by 1
  ),
  ton as (
    select t.v->>'clave' clave, (array_agg(t.v->>'nombre' order by k.fecha desc))[1] nombre,
      case when (t.v->>'signo') ~ '^-' then -1 else 1 end signo, count(distinct k.llamada_id) n
    from k, jsonb_array_elements(k.tono) t(v)
    where jsonb_typeof(t.v) = 'object' and t.v->>'clave' is not null
    group by 1, 3
  ),
  per as (
    select g.*, case when g.perfil_id is not null then revision_nombre(g.perfil_id)
                     when g.tipo = 'ia' then coalesce('La IA (' || g.ia || ')', 'La IA')
                     else coalesce(g.atendio, 'Sin nombre') || ' (sin ligar)' end nombre
    from (select k.quien, min(k.perfil_id::text)::uuid perfil_id, min(k.atendio_tipo) tipo, min(k.atendio_nombre) atendio,
            min(k.atendio_ia) ia, count(*) n, round(avg(k.calificacion), 1) promedio
          from k group by k.quien) g
  ),
  per_sem as (
    select k.quien, k.semana, count(*) n, round(avg(k.calificacion), 1) promedio from k group by 1, 2
  ),
  sem as (
    select k.semana, count(*) n, round(avg(k.calificacion), 1) promedio from k group by 1
  ),
  -- El fallo que más repite cada quien en el periodo (para la tabla del equipo).
  fal_per as (
    select distinct on (x.quien) x.quien, x.nombre, x.n from (
      select k.quien, f.v->>'clave' clave, (array_agg(f.v->>'nombre' order by k.fecha desc))[1] nombre, count(distinct k.llamada_id) n
      from k, jsonb_array_elements(k.fallos) f(v)
      where jsonb_typeof(f.v) = 'object' and f.v->>'clave' is not null
      group by 1, 2) x
    order by x.quien, x.n desc, x.clave
  ),
  t0 as materialized (
    select coalesce(k.perfil_id::text, k.atendio_tipo || ':' || coalesce(sin_acentos(ll.atendio_nombre), '')) quien,
      k.calificacion, coalesce(ll.inicio, ll.creado_en) >= v_h4 reciente
    from llamada_coaching k join llamadas ll on ll.id = k.llamada_id
    where coalesce(ll.inicio, ll.creado_en) >= v_h8 and coalesce(ll.inicio, ll.creado_en) < v_t1
      and case when p_perfil is not null then k.perfil_id = p_perfil
               when v_todos then true
               else k.perfil_id = v_yo end
  ),
  tend as (
    select quien, round(avg(calificacion) filter (where reciente), 1) reciente, round(avg(calificacion) filter (where not reciente), 1) anterior
    from t0 group by 1
  )
  select jsonb_build_object(
    'desde', p_desde, 'hasta', p_hasta, 'todos', v_todos and p_perfil is null,
    'n', (select count(*) from k),
    'promedio', (select round(avg(calificacion), 1) from k),
    'semanas', coalesce((select jsonb_agg(jsonb_build_object('semana', s.semana, 'n', s.n, 'promedio', s.promedio) order by s.semana) from sem s), '[]'),
    'reciente', (select round(avg(calificacion), 1) from t0 where reciente),
    'anterior', (select round(avg(calificacion), 1) from t0 where not reciente),
    'personas', coalesce((select jsonb_agg(jsonb_build_object('perfil_id', p.perfil_id, 'tipo', p.tipo, 'nombre', p.nombre, 'n', p.n, 'promedio', p.promedio,
        'reciente', (select t.reciente from tend t where t.quien = p.quien), 'anterior', (select t.anterior from tend t where t.quien = p.quien),
        'fallo', (select jsonb_build_object('nombre', f.nombre, 'n', f.n) from fal_per f where f.quien = p.quien),
        'semanas', (select jsonb_agg(jsonb_build_object('semana', s.semana, 'n', s.n, 'promedio', s.promedio) order by s.semana) from per_sem s where s.quien = p.quien),
        'mejor', (select jsonb_build_object('llamada_id', x.llamada_id, 'fecha', x.fecha, 'calificacion', x.calificacion)
                  from k x where x.quien = p.quien order by x.calificacion desc, x.fecha desc limit 1),
        'peor', (select jsonb_build_object('llamada_id', x.llamada_id, 'fecha', x.fecha, 'calificacion', x.calificacion)
                 from k x where x.quien = p.quien order by x.calificacion, x.fecha desc limit 1))
        order by p.promedio desc, p.n desc) from per p), '[]'),
    'criterios', coalesce((select jsonb_agg(jsonb_build_object('clave', c.clave, 'nombre', c.nombre, 'peso', c.peso, 'n', c.n, 'promedio', c.promedio)
        order by c.peso desc nulls last, c.clave) from crit c), '[]'),
    'fallos', coalesce((select jsonb_agg(jsonb_build_object('clave', f.clave, 'nombre', f.nombre, 'n', f.n) order by f.n desc, f.clave)
        from (select * from fal order by n desc, clave limit 10) f), '[]'),
    'tono', coalesce((select jsonb_agg(jsonb_build_object('clave', t.clave, 'nombre', t.nombre, 'signo', t.signo, 'n', t.n) order by t.signo desc, t.n desc, t.clave)
        from ton t), '[]'),
    'mejor', (select jsonb_build_object('llamada_id', x.llamada_id, 'fecha', x.fecha, 'calificacion', x.calificacion, 'perfil_id', x.perfil_id)
              from k x order by x.calificacion desc, x.fecha desc limit 1),
    'peor', (select jsonb_build_object('llamada_id', x.llamada_id, 'fecha', x.fecha, 'calificacion', x.calificacion, 'perfil_id', x.perfil_id)
             from k x order by x.calificacion, x.fecha desc limit 1))
  into v_r;
  return v_r;
end $$;
revoke execute on function public.coaching_resumen(date, date, uuid) from public, anon;
grant execute on function public.coaching_resumen(date, date, uuid) to authenticated;

-- Las llamadas calificadas del periodo, una por renglón, para la lista de «Coaching». Invoker: la
-- RLS de llamada_coaching decide (cada quien lo suyo; ventas 3, todo) y la de llamadas pone el nombre
-- de quien llamó solo a quien ya ve la llamada. Sin criterios ni evidencia: eso se pide al abrir una.
create or replace function public.coaching_llamadas(p_desde date, p_hasta date, p_perfil uuid default null)
returns table (llamada_id uuid, fecha timestamptz, perfil_id uuid, atendio_tipo text, atendio text, quien_llamo text,
  duracion_seg int, area_nombre text, calificacion numeric, calificacion_sin_topes numeric, topes int, fallos text[],
  grabacion_url text, grabacion_vence timestamptz)
language sql stable security invoker set search_path = public as $$
  select k.llamada_id, coalesce(ll.inicio, ll.creado_en), k.perfil_id, k.atendio_tipo,
    case when k.atendio_tipo = 'ia' then coalesce('La IA (' || ll.atendio_ia || ')', 'La IA')
         else coalesce(p.nombre, ll.atendio_nombre || ' (sin ligar)', 'Sin nombre') end,
    coalesce(ll.cliente_nombre, ll.lead_nombre), ll.duracion_seg, ll.area_nombre, k.calificacion, k.calificacion_sin_topes,
    jsonb_array_length(k.topes),
    array(select f.v->>'nombre' from jsonb_array_elements(k.fallos) f(v) where jsonb_typeof(f.v) = 'object' and f.v->>'nombre' is not null),
    ll.grabacion_url, ll.grabacion_vence
  from llamada_coaching k
  join llamadas ll on ll.id = k.llamada_id
  left join perfiles p on p.id = k.perfil_id
  where coalesce(ll.inicio, ll.creado_en) >= p_desde::timestamp at time zone 'America/Mexico_City'
    and coalesce(ll.inicio, ll.creado_en) < (p_hasta + 1)::timestamp at time zone 'America/Mexico_City'
    and (p_perfil is null or k.perfil_id = p_perfil)
  order by 2 desc
  limit 2000
$$;
revoke execute on function public.coaching_llamadas(date, date, uuid) from public, anon;
grant execute on function public.coaching_llamadas(date, date, uuid) to authenticated;

-- Lo que dicen las llamadas de un periodo: solo agregados, sin teléfonos ni nombres de quien llamó.
-- Para quien ve análisis o la gerencia de ventas. Definer: con la RLS de llamadas, alguien con
-- análisis pero sin ventas 3 vería un pedazo y lo creería el total.
create or replace function public.llamadas_analitica(p_desde date, p_hasta date) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  tz constant text := 'America/Mexico_City';
  v_t0 timestamptz := p_desde::timestamp at time zone 'America/Mexico_City';
  v_t1 timestamptz := (p_hasta + 1)::timestamp at time zone 'America/Mexico_City';
  v_r jsonb;
begin
  if not (puede('analisis', 1) or puede('ventas', 3)) then
    raise exception 'Lo que dicen las llamadas lo ve quien tiene Análisis o la gerencia de ventas' using errcode = '42501';
  end if;
  if p_desde is null or p_hasta is null or p_hasta < p_desde then raise exception 'El periodo no es válido' using errcode = '22023'; end if;
  if p_hasta - p_desde > 400 then raise exception 'El periodo es muy largo: máximo 400 días' using errcode = '22023'; end if;

  with ll as materialized (
    select l.id, coalesce(l.inicio, l.creado_en) at time zone tz local, l.nadie_contesto
    from llamadas l
    where coalesce(l.inicio, l.creado_en) >= v_t0 and coalesce(l.inicio, l.creado_en) < v_t1
  ),
  a as materialized (
    select x.*, ll.local, date_trunc('week', ll.local)::date semana from llamada_analisis x join ll on ll.id = x.llamada_id
  ),
  eq0 as materialized (
    select a.llamada_id, a.semana, (e.v->>'articulo_id')::uuid articulo_id, e.v->>'texto' texto, e.v->>'clave_catalogo' clave_catalogo
    from a, jsonb_array_elements(a.equipos) e(v)
    where jsonb_typeof(e.v) = 'object'
  ),
  -- La clave de cada texto se saca una vez por texto distinto, no por renglón (es lo caro).
  eq_clave as materialized (select t.texto, llamada_texto_clave(t.texto) clave from (select distinct texto from eq0) t),
  eq as materialized (
    select eq0.*, coalesce(eq0.articulo_id::text, 'texto:' || coalesce(k.clave, lower(eq0.clave_catalogo))) grupo
    from eq0 left join eq_clave k on k.texto = eq0.texto
  ),
  eq_top as (
    select grupo, min(articulo_id::text)::uuid articulo_id, count(distinct llamada_id) n,
      mode() within group (order by texto) texto, max(clave_catalogo) clave_catalogo
    from eq where grupo is not null group by grupo order by count(distinct llamada_id) desc, grupo limit 15
  ),
  pr0 as materialized (select a.llamada_id, a.local, q.t texto from a, unnest(a.preguntas_sin_respuesta) q(t)),
  pr_clave as materialized (select t.texto, llamada_texto_clave(t.texto) clave from (select distinct texto from pr0) t),
  pr as materialized (select pr0.*, k.clave from pr0 join pr_clave k on k.texto = pr0.texto),
  pr_top as (
    select clave, count(distinct llamada_id) n, (array_agg(texto order by local desc))[1] ejemplo, max(local) ultima
    from pr where clave is not null group by clave order by count(distinct llamada_id) desc, max(local) desc limit 20
  ),
  ob as (
    select o.v->>'categoria' categoria, o.v->>'texto' texto, a.local
    from a, jsonb_array_elements(a.objeciones) o(v) where jsonb_typeof(o.v) = 'object'
  )
  select jsonb_build_object(
    'desde', p_desde, 'hasta', p_hasta,
    'llamadas', (select count(*) from ll),
    'nadie_contesto', (select count(*) from ll where nadie_contesto),
    'con_analisis', (select count(*) from a),
    'stt_dudoso', (select count(*) from a where stt_dudoso),
    'pct_stt_dudoso', (select case when count(*) > 0 then round(100.0 * count(*) filter (where stt_dudoso) / count(*), 1) end from a),
    'semanas', coalesce((select jsonb_agg(jsonb_build_object('semana', s.semana, 'n', s.n, 'nadie_contesto', s.nadie) order by s.semana)
        from (select date_trunc('week', local)::date semana, count(*) n, count(*) filter (where nadie_contesto) nadie from ll group by 1) s), '[]'),
    'equipos', coalesce((select jsonb_agg(jsonb_build_object('grupo', t.grupo, 'articulo_id', t.articulo_id,
        'nombre', coalesce((select ar.nombre from articulos ar where ar.id = t.articulo_id), t.texto),
        'clave', coalesce((select ar.clave from articulos ar where ar.id = t.articulo_id), t.clave_catalogo),
        'texto', t.texto, 'n', t.n,
        'semanas', (select jsonb_agg(jsonb_build_object('semana', s.semana, 'n', s.n) order by s.semana)
                    from (select e.semana, count(distinct e.llamada_id) n from eq e where e.grupo = t.grupo group by 1) s))
        order by t.n desc, t.grupo) from eq_top t), '[]'),
    'preguntas', coalesce((select jsonb_agg(jsonb_build_object('clave', t.clave, 'ejemplo', t.ejemplo, 'n', t.n, 'ultima', t.ultima)
        order by t.n desc, t.ultima desc) from pr_top t), '[]'),
    'objeciones', coalesce((select jsonb_agg(jsonb_build_object('categoria', o.categoria, 'n', o.n, 'ejemplos', o.ejemplos) order by o.n desc, o.categoria)
        from (select categoria, count(*) n, (array_agg(texto order by local desc) filter (where texto is not null))[1:3] ejemplos
              from ob group by categoria) o), '[]'),
    'desenlaces', coalesce((select jsonb_agg(jsonb_build_object('desenlace', d.k, 'n', d.n) order by d.n desc, d.k)
        from (select coalesce(desenlace, 'sin dato') k, count(*) n from a group by 1) d), '[]'),
    'intenciones', coalesce((select jsonb_agg(jsonb_build_object('intencion', d.k, 'n', d.n) order by d.n desc, d.k)
        from (select coalesce(intencion, 'sin dato') k, count(*) n from a group by 1) d), '[]'),
    'por_hora', coalesce((select jsonb_agg(jsonb_build_object('hora', h.h, 'n', h.n, 'nadie_contesto', h.nadie) order by h.h)
        from (select extract(hour from local)::int h, count(*) n, count(*) filter (where nadie_contesto) nadie from ll group by 1) h), '[]'),
    -- 1 = lunes … 7 = domingo.
    'por_dia', coalesce((select jsonb_agg(jsonb_build_object('dia', d.d, 'n', d.n, 'nadie_contesto', d.nadie) order by d.d)
        from (select extract(isodow from local)::int d, count(*) n, count(*) filter (where nadie_contesto) nadie from ll group by 1) d), '[]'))
  into v_r;
  return v_r;
end $$;
revoke execute on function public.llamadas_analitica(date, date) from public, anon;
grant execute on function public.llamadas_analitica(date, date) to authenticated;

-- 8. Objetivos: indicador 75, la calificación de coaching del mes ----------------------------------
insert into public.objetivo_indicadores (id, clave, nombre, area, fuente, checklist, unidad, descripcion, dato_faltante, activo) values
  (75, 'calificacion_coaching', 'Calificación de coaching', 'ventas', 'automatica', null, 'puntos',
   'Promedio del mes de la calificación (de 1 a 10) de las llamadas que la persona atendió y que el conmutador calificó con su rúbrica. Cada llamada queda como evidencia con su calificación; las que salen por debajo de la mínima (6 si no se cambia) cuentan como incidencia. Sin llamadas calificadas en el mes no hay dato y lo califica el jefe.',
   null, true)
on conflict (id) do update set clave = excluded.clave, nombre = excluded.nombre, area = excluded.area, fuente = excluded.fuente,
  unidad = excluded.unidad, descripcion = excluded.descripcion, dato_faltante = excluded.dato_faltante;

-- La medición de 236 con calificacion_coaching (se copia completa: es un solo case).
create or replace function public.objetivo_medir(p_clave text, p_checklist text, p_empleado uuid, p_mes date,
  p_parametros jsonb default '{}'::jsonb) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  tz constant text := 'America/Mexico_City';
  v_ini date := date_trunc('month', p_mes)::date;
  v_fin date := (date_trunc('month', p_mes) + interval '1 month')::date;          -- exclusivo
  v_t0 timestamptz := date_trunc('month', p_mes)::timestamp at time zone 'America/Mexico_City';
  v_t1 timestamptz := (date_trunc('month', p_mes) + interval '1 month')::timestamp at time zone 'America/Mexico_City';
  v_hoy date := hoy_planta();
  v_corte date := least((date_trunc('month', p_mes) + interval '1 month')::date - 1, hoy_planta());
  v_usuario uuid;
  v_a numeric; v_b numeric; v_n int;
  v_areas int[] := coalesce(array(select jsonb_array_elements_text(coalesce(p_parametros->'areas', '[]'::jsonb))::int), '{}');
  v_almacenes int[] := coalesce(array(select jsonb_array_elements_text(coalesce(p_parametros->'almacenes', '[]'::jsonb))::int), '{}');
  v_r jsonb;
begin
  select usuario_id into v_usuario from empleados where id = p_empleado;

  -- Checklist: un día (o un día-área) con cualquier falla es un incumplimiento.
  if p_checklist is not null then
    with m as (
      select x.fecha, x.area_id, a.nombre area, bool_and(x.cumplio) cumplio,
        string_agg(case x.momento when 'entrada' then 'entrada' when 'break1' then 'break 1' when 'break2' then 'break 2'
                                  else 'revisión' end || coalesce(' (' || x.nota || ')', ''), ', ' order by x.momento)
          filter (where not x.cumplio) fallas,
        string_agg(distinct p.nombre, ', ') filter (where not x.cumplio) quien
      from objetivo_marcas x
      left join objetivo_areas a on a.id = x.area_id
      left join perfiles p on p.id = x.marcado_por
      where x.tipo = p_checklist and x.fecha >= v_ini and x.fecha < v_fin
        and case when cardinality(v_areas) > 0 then x.area_id = any(v_areas) else x.empleado_id = p_empleado end
      group by x.fecha, x.area_id, a.nombre
    )
    select case when count(*) = 0 then jsonb_build_object('sin_dato', true,
             'nota', 'Nadie marcó el checklist este mes: sin marcas no se sabe si cumplió. Márcalo en el checklist diario o califícalo a mano.')
           else jsonb_build_object('posibles', count(*), 'modo', 'resta',
             'nota', format('%s %s marcados en el mes, %s con falla. Un día sin marca no cuenta en contra.',
                            count(*), case when cardinality(v_areas) > 0 then 'días-área' else 'días' end, count(*) filter (where not m.cumplio)),
             'evidencias', coalesce(jsonb_agg(jsonb_build_object(
                'tipo', 'marca', 'referencia', m.fecha::text || coalesce(':' || m.area_id, ''),
                'folio', coalesce(m.area, case p_checklist when 'celular' then 'Celular' when 'epp' then 'EPP'
                                                           when 'vehiculo' then 'Vehículo' else 'Checklist' end),
                'detalle', 'No cumplió: ' || m.fallas || coalesce(' · marcó ' || m.quien, ''),
                'fecha', m.fecha, 'cuenta', true) order by m.fecha) filter (where not m.cumplio), '[]'::jsonb)) end
    into v_r from m;
    return v_r;
  end if;

  case p_clave
  when 'ventas_mes' then
    select jsonb_build_object('valor', coalesce(round(sum(p.subtotal * p.tipo_cambio), 2), 0), 'modo', 'no',
      'nota', 'Pedidos del mes sin IVA ni cancelados, en pesos al tipo de cambio del pedido.',
      'evidencias', coalesce(jsonb_agg(jsonb_build_object('tipo', 'pedido', 'referencia', p.id::text, 'folio', p.folio,
          'detalle', coalesce(c.nombre, 'Sin cliente') || ' · ' || p.canal::text, 'fecha', p.fecha,
          'cantidad', round(p.subtotal * p.tipo_cambio, 2), 'cuenta', false) order by p.subtotal * p.tipo_cambio desc), '[]'::jsonb))
    into v_r
    from pedidos p left join clientes c on c.id = p.cliente_id
    where p.estado <> 'cancelado' and p.fecha >= v_ini and p.fecha < v_fin;

  when 'crecimiento_ventas' then
    select coalesce(sum(subtotal * tipo_cambio) filter (where fecha >= v_ini), 0),
           coalesce(sum(subtotal * tipo_cambio) filter (where fecha < v_ini), 0)
    into v_a, v_b
    from pedidos where estado <> 'cancelado' and fecha >= (v_ini - interval '1 month')::date and fecha < v_fin;
    if v_b = 0 then
      v_r := jsonb_build_object('sin_dato', true, 'nota', 'El mes anterior no tuvo ventas: no hay contra qué comparar.');
    else
      v_r := jsonb_build_object('valor', round(100 * (v_a / v_b - 1), 2), 'modo', 'no',
        'nota', 'Ventas sin IVA del mes contra el mes anterior.',
        'evidencias', jsonb_build_array(
          jsonb_build_object('tipo', 'resumen', 'referencia', 'mes', 'folio', objetivo_nombre_mes(v_ini),
                             'detalle', 'Ventas del mes', 'cantidad', round(v_a, 2), 'cuenta', false),
          jsonb_build_object('tipo', 'resumen', 'referencia', 'anterior', 'folio', objetivo_nombre_mes((v_ini - interval '1 month')::date),
                             'detalle', 'Ventas del mes anterior', 'cantidad', round(v_b, 2), 'cuenta', false)));
    end if;

  when 'seguimiento_prospectos' then
    with o as (
      select o.id, o.titulo, o.creado_en, c.nombre cliente,
        (select count(*) from actividades a where a.oportunidad_id = o.id
           and a.en >= o.creado_en and a.en < o.creado_en + interval '7 days') seg
      from oportunidades o left join clientes c on c.id = o.cliente_id
      where o.creado_en >= v_t0 and o.creado_en < v_t1 and o.creado_en + interval '7 days' <= now()
    )
    select jsonb_build_object('posibles', count(*), 'modo', 'porcentaje',
      'nota', 'Oportunidades creadas en el mes (con sus 7 días ya cumplidos). Incidencia: menos de 2 actividades en esos 7 días.',
      'evidencias', coalesce(jsonb_agg(jsonb_build_object('tipo', 'oportunidad', 'referencia', o.id::text, 'folio', o.titulo,
          'detalle', coalesce(o.cliente || ' · ', '') || o.seg || ' seguimiento(s) en 7 días',
          'fecha', (o.creado_en at time zone tz)::date, 'cantidad', o.seg, 'cuenta', o.seg < 2) order by o.creado_en), '[]'::jsonb))
    into v_r from o;

  when 'conversiones_registradas' then
    select jsonb_build_object('posibles', count(*), 'modo', 'porcentaje',
      'nota', 'Pedidos del mes sin Mercado Libre, Amazon ni históricos. Incidencia: pedido sin cotización del ERP.',
      'evidencias', coalesce(jsonb_agg(jsonb_build_object('tipo', 'pedido', 'referencia', p.id::text, 'folio', p.folio,
          'detalle', coalesce(c.nombre, 'Sin cliente') || ' · sin cotización', 'fecha', p.fecha,
          'cantidad', round(p.subtotal * p.tipo_cambio, 2), 'cuenta', true) order by p.fecha) filter (where p.cotizacion_id is null), '[]'::jsonb))
    into v_r
    from pedidos p left join clientes c on c.id = p.cliente_id
    where p.estado <> 'cancelado' and not p.historico and p.fecha >= v_ini and p.fecha < v_fin
      and p.canal not in ('mercadolibre', 'amazon');

  when 'costos_vigentes' then
    with linea as (
      select a.id, a.clave, a.nombre from articulos a
      where a.activo and a.tipo in ('componente', 'materia_prima')
        and exists (select 1 from bom_lineas b join articulos p on p.id = b.padre_id where b.hijo_id = a.id and p.activo)
    ), fechas as (
      select l.*, greatest(
          (select max((h.en at time zone tz)::date) from historial_costos h where h.articulo_id = l.id and h.en < v_t1),
          (select c.actualizado_en from costos_articulo c where c.articulo_id = l.id and c.actualizado_en < v_fin)) ultima
      from linea l
    ), vencidos as (
      select f.*, row_number() over (order by f.ultima nulls first, f.clave) n
      from fechas f where f.ultima is null or f.ultima < (v_fin - interval '3 months')::date
    )
    select jsonb_build_object('posibles', (select count(*) from linea), 'valor', (select count(*) from vencidos), 'modo', 'no',
      'nota', format('%s de %s componentes de línea con costo de más de 3 meses (o sin costo) al cierre del mes.',
                     (select count(*) from vencidos), (select count(*) from linea)),
      'evidencias', coalesce((select jsonb_agg(jsonb_build_object('tipo', 'articulo', 'referencia', v.id::text, 'folio', v.clave,
            'detalle', v.nombre || ' · ' || coalesce('costo del ' || to_char(v.ultima, 'DD/MM/YYYY'), 'sin costo'),
            'fecha', v.ultima, 'cuenta', true) order by v.n) from vencidos v where v.n <= 100), '[]'::jsonb)
        || case when (select count(*) from vencidos) > 100 then jsonb_build_array(jsonb_build_object(
             'tipo', 'resumen', 'referencia', 'resto', 'folio', 'Y ' || ((select count(*) from vencidos) - 100) || ' artículos más',
             'detalle', 'Mismo motivo: costo de más de 3 meses o sin costo', 'cuenta', true,
             'unidades', (select count(*) from vencidos) - 100)) else '[]'::jsonb end)
    into v_r;

  when 'proveedores_nuevos' then
    select jsonb_build_object('valor', count(*), 'modo', 'no',
      'nota', 'Proveedores dados de alta en el mes con su primera orden de compra en el mes.',
      'evidencias', coalesce(jsonb_agg(jsonb_build_object('tipo', 'proveedor', 'referencia', p.id::text, 'folio', p.nombre,
          'detalle', coalesce(p.categoria || ' · ', '') || 'primera OC ' || o.folio, 'fecha', o.fecha, 'cuenta', false)), '[]'::jsonb))
    into v_r
    from proveedores p
    cross join lateral (select x.folio, x.fecha from ordenes_compra x where x.proveedor_id = p.id
                        and x.estado not in ('borrador', 'cancelada') order by x.fecha limit 1) o
    where p.creado_en >= v_t0 and p.creado_en < v_t1 and o.fecha >= v_ini and o.fecha < v_fin;

  when 'materiales_por_cliente' then
    with lib as (
      select distinct on (ev.orden_id) ev.orden_id, ev.en from op_eventos ev
      where ev.tipo = 'liberada' and ev.en >= v_t0 and ev.en < v_t1 order by ev.orden_id, ev.en
    ), x as (
      select o.id, o.folio, a.nombre equipo, l.en,
        not exists (select 1 from op_materiales m where m.orden_id = o.id) sin_material,
        (select count(*) from op_eventos c where c.orden_id = o.id and c.tipo = 'cambio_material' and c.en > l.en) cambios
      from lib l join ordenes_produccion o on o.id = l.orden_id join articulos a on a.id = o.articulo_id
    )
    select jsonb_build_object('posibles', count(*), 'modo', 'porcentaje',
      'nota', 'Órdenes liberadas en el mes. Incidencia: sin lista de material o con cambios de material después de liberarla.',
      'evidencias', coalesce(jsonb_agg(jsonb_build_object('tipo', 'orden_produccion', 'referencia', x.id::text, 'folio', x.folio,
          'detalle', x.equipo || ' · ' || case when x.sin_material then 'liberada sin lista de material'
                                              when x.cambios > 0 then x.cambios || ' cambio(s) de material después de liberarla'
                                              else 'material completo al liberar' end,
          'fecha', (x.en at time zone tz)::date, 'cantidad', x.cambios, 'cuenta', x.sin_material or x.cambios > 0) order by x.en), '[]'::jsonb))
    into v_r from x;

  when 'entregas_a_tiempo' then
    with x as (
      select o.id, o.folio, a.nombre equipo, o.fecha_compromiso, (o.terminada_en at time zone tz)::date terminada,
        o.pedido_id is null para_stock
      from ordenes_produccion o join articulos a on a.id = o.articulo_id
      where o.estado <> 'cancelada' and o.fecha_compromiso >= v_ini and o.fecha_compromiso < v_fin
        -- La que sigue abierta y todavía puede llegar a tiempo no se juzga aún.
        and (o.terminada_en is not null or o.fecha_compromiso < v_corte)
    ), y as (
      select x.*, coalesce(x.terminada, v_corte) - x.fecha_compromiso atraso from x
    )
    select jsonb_build_object('posibles', count(*), 'modo', 'porcentaje',
      'nota', 'Órdenes con fecha compromiso en el mes, incluidas las de stock. Incidencia: terminada después de su fecha o abierta al cierre.',
      'evidencias', coalesce(jsonb_agg(jsonb_build_object('tipo', 'orden_produccion', 'referencia', y.id::text, 'folio', y.folio,
          'detalle', y.equipo || case when y.para_stock then ' (stock)' else '' end || ' · ' ||
              case when y.terminada is null then 'sigue abierta, ' || y.atraso || ' días tarde'
                   when y.atraso > 0 then 'terminada ' || y.atraso || ' días tarde' else 'a tiempo' end,
          'fecha', y.fecha_compromiso, 'cantidad', greatest(y.atraso, 0), 'cuenta', y.atraso > 0) order by y.fecha_compromiso), '[]'::jsonb))
    into v_r from y;

  when 'inicio_sin_orden' then
    with ini as (
      select distinct on (ev.orden_id) ev.orden_id, ev.en from op_eventos ev where ev.tipo = 'inicio' order by ev.orden_id, ev.en
    ), x as (
      select o.id, o.folio, a.nombre equipo, i.en, o.revisado_ingenieria_en,
        o.revisado_ingenieria_en is null or o.revisado_ingenieria_en > i.en sin_revision
      from ini i join ordenes_produccion o on o.id = i.orden_id join articulos a on a.id = o.articulo_id
      where i.en >= v_t0 and i.en < v_t1
    )
    select jsonb_build_object('posibles', count(*), 'modo', 'porcentaje',
      'nota', 'Órdenes que empezaron en el mes. Incidencia: empezó antes de la revisión de ingeniería.',
      'evidencias', coalesce(jsonb_agg(jsonb_build_object('tipo', 'orden_produccion', 'referencia', x.id::text, 'folio', x.folio,
          'detalle', x.equipo || ' · ' || case when x.sin_revision then 'empezó sin revisión de ingeniería' else 'revisada antes de empezar' end,
          'fecha', (x.en at time zone tz)::date, 'cuenta', x.sin_revision) order by x.en), '[]'::jsonb))
    into v_r from x;

  when 'bitacora_incidencias' then
    if v_usuario is null then
      v_r := jsonb_build_object('sin_dato', true, 'nota', 'La persona no tiene usuario en el ERP: no se sabe qué registró. Califícalo a mano.');
    else
      select jsonb_build_object('valor', count(*), 'modo', 'no',
        'nota', 'Problemas que registró en las órdenes de producción en el mes.',
        'evidencias', coalesce(jsonb_agg(jsonb_build_object('tipo', 'evento', 'referencia', ev.id::text, 'folio', o.folio,
            'detalle', left(ev.nota, 160), 'fecha', (ev.en at time zone tz)::date, 'cuenta', false) order by ev.en), '[]'::jsonb))
      into v_r
      from op_eventos ev join ordenes_produccion o on o.id = ev.orden_id
      where ev.tipo = 'problema' and ev.usuario_id = v_usuario and ev.en >= v_t0 and ev.en < v_t1;
    end if;

  when 'exactitud_inventario' then
    select jsonb_build_object('valor', count(*), 'modo', 'no',
      'nota', 'Ajustes de inventario del mes con diferencia. Los rechazados no cuentan: el conteo estaba mal, no el inventario.',
      'evidencias', coalesce(jsonb_agg(jsonb_build_object('tipo', 'ajuste', 'referencia', j.id::text, 'folio', j.folio,
          'detalle', a.clave || ' · ' || a.nombre || ' · ' || al.nombre || ' · sistema ' || trim_scale(j.cantidad_sistema)
                     || ', físico ' || trim_scale(j.cantidad_fisica) || ' · ' || j.motivo,
          'fecha', (j.solicitado_en at time zone tz)::date, 'cantidad', j.diferencia, 'cuenta', true) order by j.solicitado_en), '[]'::jsonb))
    into v_r
    from ajustes_inventario j join articulos a on a.id = j.articulo_id join almacenes al on al.id = j.almacen_id
    where j.estado <> 'rechazado' and j.diferencia <> 0 and j.solicitado_en >= v_t0 and j.solicitado_en < v_t1
      and (cardinality(v_almacenes) = 0 or j.almacen_id = any(v_almacenes));

  when 'material_a_tiempo_almacen' then
    -- Foto: solo vale tomarla durante el mes o en los 5 días siguientes al cierre.
    if v_hoy < v_ini or v_hoy > v_fin + 5 then return jsonb_build_object('conservar', true); end if;
    select jsonb_build_object('valor', count(*), 'modo', 'no',
      'nota', format('Foto del %s: artículos bajo su punto de reorden sin requisición abierta ni compra en camino.', to_char(v_hoy, 'DD/MM/YYYY')),
      'evidencias', coalesce(jsonb_agg(jsonb_build_object('tipo', 'articulo', 'referencia', r.articulo_id::text, 'folio', r.clave,
          'detalle', r.nombre || ' · disponible ' || trim_scale(r.disponible) || ' de ' || trim_scale(r.punto_reorden) || ' ' || r.unidad,
          'fecha', v_hoy, 'cantidad', r.punto_reorden - r.disponible, 'cuenta', true) order by r.clave), '[]'::jsonb))
    into v_r
    from reabasto() r
    where r.estado = 'ordenar' and r.en_transito = 0
      and not exists (select 1 from requisicion_lineas l join requisiciones q on q.id = l.requisicion_id
                      where l.articulo_id = r.articulo_id and l.estado = 'pendiente' and q.estado in ('abierta', 'en_compra'));

  when 'material_pedido_de_mas' then
    with x as (
      select l.id, q.folio, q.creado_en, a.clave, a.nombre, a.unidad, l.cantidad,
        coalesce((select sum(m.cantidad) from movimientos_inventario m join almacenes al on al.id = m.almacen_id
                  where m.articulo_id = l.articulo_id and al.disponible_para_planta and m.en <= q.creado_en), 0) en_planta
      from requisicion_lineas l join requisiciones q on q.id = l.requisicion_id join articulos a on a.id = l.articulo_id
      where q.origen in ('manual', 'reabasto') and q.creado_en >= v_t0 and q.creado_en < v_t1
    )
    select jsonb_build_object('posibles', count(*), 'valor', count(*) filter (where x.en_planta >= x.cantidad), 'modo', 'no',
      'nota', 'Partidas de requisición del mes (manuales y de reabasto). Incidencia: en ese momento ya había en planta lo que se pidió.',
      'evidencias', coalesce(jsonb_agg(jsonb_build_object('tipo', 'requisicion', 'referencia', x.id::text, 'folio', x.folio,
          'detalle', x.clave || ' · ' || x.nombre || ' · pidió ' || trim_scale(x.cantidad) || ', había ' || trim_scale(x.en_planta) || ' ' || x.unidad,
          'fecha', (x.creado_en at time zone tz)::date, 'cantidad', x.cantidad, 'cuenta', true) order by x.creado_en)
          filter (where x.en_planta >= x.cantidad), '[]'::jsonb))
    into v_r from x;

  when 'desabasto' then
    if v_hoy < v_ini or v_hoy > v_fin + 5 then return jsonb_build_object('conservar', true); end if;
    select jsonb_build_object(
      'valor', case when count(*) > 0 then round(100.0 * count(*) filter (where r.en_planta < r.punto_reorden) / count(*), 2) else 0 end,
      'posibles', count(*), 'modo', 'no',
      'nota', format('Foto del %s: %s de %s artículos con punto de reorden están por debajo en planta.',
                     to_char(v_hoy, 'DD/MM/YYYY'), count(*) filter (where r.en_planta < r.punto_reorden), count(*)),
      'evidencias', coalesce(jsonb_agg(jsonb_build_object('tipo', 'articulo', 'referencia', r.articulo_id::text, 'folio', r.clave,
          'detalle', r.nombre || ' · en planta ' || trim_scale(r.en_planta) || ' de ' || trim_scale(r.punto_reorden) || ' ' || r.unidad,
          'fecha', v_hoy, 'cantidad', r.punto_reorden - r.en_planta, 'cuenta', false) order by r.clave)
          filter (where r.en_planta < r.punto_reorden), '[]'::jsonb))
    into v_r from reabasto() r where r.punto_reorden > 0;

  when 'inventario_herramientas' then
    select jsonb_build_object('valor', count(*), 'modo', 'no',
      'nota', 'Conteos cerrados en el mes con "herramienta" en el nombre.',
      'evidencias', coalesce(jsonb_agg(jsonb_build_object('tipo', 'conteo', 'referencia', c.id::text, 'folio', c.nombre,
          'detalle', al.nombre || ' · ' || (select count(*) from conteo_lineas l where l.conteo_id = c.id) || ' artículos contados',
          'fecha', (c.cerrado_en at time zone tz)::date, 'cuenta', false) order by c.cerrado_en), '[]'::jsonb))
    into v_r
    from conteos c join almacenes al on al.id = c.almacen_id
    where c.estado = 'cerrado' and c.cerrado_en >= v_t0 and c.cerrado_en < v_t1 and sin_acentos(c.nombre) like '%herramienta%';

  when 'surtido_produccion' then
    with x as (
      select o.id, o.folio, a.nombre equipo, (o.terminada_en at time zone tz)::date terminada,
        (select count(*) from op_materiales m where m.orden_id = o.id and m.requerido > 0 and m.surtido < m.requerido
           and not es_consumible_taller(m.articulo_id)) sin_surtir,
        (select count(*) from op_materiales m where m.orden_id = o.id and m.requerido > 0 and not es_consumible_taller(m.articulo_id)) renglones
      from ordenes_produccion o join articulos a on a.id = o.articulo_id
      where o.terminada_en >= v_t0 and o.terminada_en < v_t1
    )
    select jsonb_build_object('posibles', count(*), 'modo', 'porcentaje',
      'nota', 'Órdenes terminadas en el mes. Incidencia: terminó con material sin surtir completo.',
      'evidencias', coalesce(jsonb_agg(jsonb_build_object('tipo', 'orden_produccion', 'referencia', x.id::text, 'folio', x.folio,
          'detalle', x.equipo || ' · ' || case when x.sin_surtir > 0 then x.sin_surtir || ' de ' || x.renglones || ' renglones sin surtir completo'
                                               else 'material surtido completo' end,
          'fecha', x.terminada, 'cantidad', x.sin_surtir, 'cuenta', x.sin_surtir > 0) order by x.terminada), '[]'::jsonb))
    into v_r from x;

  when 'recepcion_oc' then
    with oc as (
      select distinct m.orden_compra_id id from movimientos_inventario m
      where m.tipo = 'entrada_compra' and m.orden_compra_id is not null and m.en >= v_t0 and m.en < v_t1
    ), x as (
      select o.id, o.folio, p.nombre proveedor, o.fecha_entrega,
        (select count(*) from oc_lineas l where l.orden_compra_id = o.id and l.recibido > l.cantidad) de_mas,
        o.estado = 'parcial' and o.fecha_entrega < v_corte incompleta
      from oc join ordenes_compra o on o.id = oc.id join proveedores p on p.id = o.proveedor_id
    )
    select jsonb_build_object('posibles', count(*), 'modo', 'porcentaje',
      'nota', 'Órdenes de compra con entradas en el mes. Incidencia: se recibió de más, o quedó incompleta con su fecha de entrega vencida.',
      'evidencias', coalesce(jsonb_agg(jsonb_build_object('tipo', 'orden_compra', 'referencia', x.id::text, 'folio', x.folio,
          'detalle', x.proveedor || ' · ' || case when x.de_mas > 0 then 'se recibió de más en ' || x.de_mas || ' partida(s)'
                                                  when x.incompleta then 'incompleta; debía llegar el ' || to_char(x.fecha_entrega, 'DD/MM/YYYY')
                                                  else 'recibida como se pidió' end,
          'fecha', x.fecha_entrega, 'cuenta', x.de_mas > 0 or x.incompleta) order by x.folio), '[]'::jsonb))
    into v_r from x;

  -- ---------------------------------------------------------------------------
  -- 208: lo que ya se puede medir con lo construido después (leads, seguimientos,
  -- Mercado Libre, mantenimiento, terminal de piso, pendientes, kaizen, envíos).
  -- ---------------------------------------------------------------------------

  -- Leads que llegan solos: se asignan pronto. Las listas que se cargan de golpe (una expo) no
  -- cuentan: llegaron todas a la vez y nadie las esperaba. Las horas son de horario: un lead de
  -- las 9 de la noche no cuenta en contra hasta que abre el taller.
  when 'asignacion_4h' then
    with x as (
      select l.id, coalesce(nullif(trim(l.empresa), ''), l.nombre) quien, f.nombre fuente, l.creado_en, l.asignado_en,
        horas_en_horario(l.creado_en, coalesce(l.asignado_en, least(now(), v_t1 + interval '7 days'))) horas
      from leads l left join fuentes_contacto f on f.id = l.fuente_id
      where l.creado_en >= v_t0 and l.creado_en < v_t1 and not coalesce(f.de_lista, false)
        and not (l.estado = 'descartado' and l.asignado_en is null)
    ), y as (
      select x.*, x.asignado_en is null or x.horas > coalesce((p_parametros->>'horas')::numeric, 4) tarde from x
      -- El que todavía puede asignarse a tiempo no se juzga aún.
      where x.asignado_en is not null or x.horas > coalesce((p_parametros->>'horas')::numeric, 4)
    )
    select jsonb_build_object('posibles', count(*), 'modo', 'porcentaje',
      'nota', format('Leads que llegaron solos en el mes (sin las listas cargadas de golpe). Incidencia: asignado a un vendedor después de %s horas de horario, o sin asignar.',
                     coalesce((p_parametros->>'horas')::numeric, 4)),
      'evidencias', coalesce(jsonb_agg(jsonb_build_object('tipo', 'lead', 'referencia', y.id::text, 'folio', y.quien,
          'detalle', coalesce(y.fuente || ' · ', '') || case when y.asignado_en is null then 'sin asignar' else 'asignado en ' || round(y.horas, 1) || ' h de horario' end,
          'fecha', (y.creado_en at time zone tz)::date, 'cantidad', round(y.horas, 1), 'cuenta', y.tarde) order by y.creado_en), '[]'::jsonb))
    into v_r from y;

  -- Primer contacto: el lead se atiende dentro de un día de trabajo. Si la persona tiene leads
  -- asignados en el mes, se miden los suyos; si no (recepción, la gerencia), los de todos.
  when 'primer_contacto' then
    with x as (
      select l.id, coalesce(nullif(trim(l.empresa), ''), l.nombre) quien, f.nombre fuente, l.creado_en, l.atendido_en, l.vendedor_id,
        horas_en_horario(l.creado_en, coalesce(l.atendido_en, least(now(), v_t1 + interval '7 days'))) horas
      from leads l left join fuentes_contacto f on f.id = l.fuente_id
      where l.creado_en >= v_t0 and l.creado_en < v_t1 and not coalesce(f.de_lista, false)
        and not (l.estado = 'descartado' and l.atendido_en is null)
    ), y as (
      select x.*, x.atendido_en is null or x.horas > coalesce((p_parametros->>'horas')::numeric, 8) tarde from x
      where (x.atendido_en is not null or x.horas > coalesce((p_parametros->>'horas')::numeric, 8))
        and case when exists (select 1 from x where x.vendedor_id = v_usuario) then x.vendedor_id = v_usuario else true end
    )
    select jsonb_build_object('posibles', count(*), 'modo', 'porcentaje',
      'nota', format('Leads que llegaron solos en el mes%s. Incidencia: atendido después de %s horas de horario (un día de trabajo), o sin atender.',
                     case when exists (select 1 from leads l where l.vendedor_id = v_usuario and l.creado_en >= v_t0 and l.creado_en < v_t1) then ', los suyos' else '' end,
                     coalesce((p_parametros->>'horas')::numeric, 8)),
      'evidencias', coalesce(jsonb_agg(jsonb_build_object('tipo', 'lead', 'referencia', y.id::text, 'folio', y.quien,
          'detalle', coalesce(y.fuente || ' · ', '') || case when y.atendido_en is null then 'sin atender' else 'atendido en ' || round(y.horas, 1) || ' h de horario' end,
          'fecha', (y.creado_en at time zone tz)::date, 'cantidad', round(y.horas, 1), 'cuenta', y.tarde) order by y.creado_en), '[]'::jsonb))
    into v_r from y;

  -- Llamadas que registró la persona: con cliente y con qué se habló.
  when 'llamadas_registradas' then
    if v_usuario is null then
      v_r := jsonb_build_object('sin_dato', true, 'nota', 'La persona no tiene usuario en el ERP: no se sabe qué llamadas registró. Califícalo a mano.');
    else
      select jsonb_build_object('posibles', count(*), 'modo', 'porcentaje',
        'nota', 'Llamadas que registró en el mes. Incidencia: sin cliente, o sin decir qué se habló.',
        'evidencias', coalesce(jsonb_agg(jsonb_build_object('tipo', 'actividad', 'referencia', a.id::text, 'folio', coalesce(c.nombre, 'Sin cliente'),
            'detalle', coalesce(nullif(left(trim(a.descripcion), 120), ''), 'sin descripción'),
            'fecha', (a.en at time zone tz)::date, 'cuenta', a.cliente_id is null or length(trim(coalesce(a.descripcion, ''))) < 10) order by a.en), '[]'::jsonb))
      into v_r
      from actividades a left join clientes c on c.id = a.cliente_id
      where a.tipo = 'llamada' and a.usuario_id = v_usuario and a.en >= v_t0 and a.en < v_t1;
    end if;

  -- Seguimientos de cotización que vencían en el mes. Uno cerrado porque la cotización se ganó o
  -- se perdió antes de su día ya no aplica; cerrado después, sí se le pasó.
  when 'seguimientos_cotizacion' then
    with x as (
      select s.id, s.vence, s.estado, s.cerrado_en, s.vendedor_id, coalesce(c.folio, 'Seguimiento') folio, cl.nombre cliente,
        (s.cerrado_en at time zone tz)::date hecho
      from seguimientos_cotizacion s left join cotizaciones c on c.id = s.cotizacion_id left join clientes cl on cl.id = c.cliente_id
      where s.vence >= v_ini and s.vence < v_fin
        and not (s.estado = 'cerrado' and (s.cerrado_en at time zone tz)::date <= s.vence)
        and (s.estado <> 'pendiente' or s.vence < v_hoy)
    ), y as (
      select x.*, case when x.estado = 'pendiente' then true else x.hecho > x.vence end tarde from x
      where case when exists (select 1 from x where x.vendedor_id = v_usuario) then x.vendedor_id = v_usuario else true end
    )
    select jsonb_build_object('posibles', count(*), 'modo', 'porcentaje',
      'nota', 'Seguimientos de cotización que vencían en el mes (los suyos, si es vendedor). Incidencia: se hizo después de su día o sigue pendiente.',
      'evidencias', coalesce(jsonb_agg(jsonb_build_object('tipo', 'seguimiento', 'referencia', y.id::text, 'folio', y.folio,
          'detalle', coalesce(y.cliente || ' · ', '') || case when y.estado = 'pendiente' then 'pendiente desde el ' || to_char(y.vence, 'DD/MM')
                                                             when y.tarde then 'hecho ' || (y.hecho - y.vence) || ' día(s) tarde' else 'a tiempo' end,
          'fecha', y.vence, 'cuenta', y.tarde) order by y.vence), '[]'::jsonb))
    into v_r from y;

  -- Preguntas de Mercado Libre contestadas en horas de horario (la de la noche no cuenta hasta que se abre).
  when 'preguntas_ml_2h' then
    with x as (
      select p.id, coalesce(p.titulo_publicacion, p.item_id) publicacion, p.recibida_en, p.contestada_en,
        horas_en_horario(p.recibida_en, coalesce(p.contestada_en, least(now(), v_t1 + interval '7 days'))) horas
      from ml_preguntas p
      where p.recibida_en >= v_t0 and p.recibida_en < v_t1 and p.estado <> 'borrada'
    ), y as (
      select x.*, x.contestada_en is null or x.horas > coalesce((p_parametros->>'horas')::numeric, 2) tarde from x
      where x.contestada_en is not null or x.horas > coalesce((p_parametros->>'horas')::numeric, 2)
    )
    select jsonb_build_object('posibles', count(*), 'modo', 'porcentaje',
      'nota', format('Preguntas de Mercado Libre del mes. Incidencia: contestada después de %s horas de horario, o sin contestar.', coalesce((p_parametros->>'horas')::numeric, 2)),
      'evidencias', coalesce(jsonb_agg(jsonb_build_object('tipo', 'pregunta_ml', 'referencia', y.id::text, 'folio', left(y.publicacion, 60),
          'detalle', case when y.contestada_en is null then 'sin contestar' else 'contestada en ' || round(y.horas, 1) || ' h de horario' end,
          'fecha', (y.recibida_en at time zone tz)::date, 'cantidad', round(y.horas, 1), 'cuenta', y.tarde) order by y.recibida_en), '[]'::jsonb))
    into v_r from y;

  -- Preventivos que vencían en el mes: hechos a más tardar en su fecha.
  when 'preventivos_a_tiempo' then
    with x as (
      select o.id, o.folio, m.nombre maquina, o.vence, o.estado, (o.cerrada_en at time zone tz)::date cerrada
      from ordenes_mantenimiento o left join maquinas m on m.id = o.maquina_id
      where o.tipo = 'preventivo' and o.estado <> 'cancelada' and o.vence >= v_ini and o.vence < v_fin
        and (o.cerrada_en is not null or o.vence < v_hoy)
    )
    select jsonb_build_object('posibles', count(*), 'modo', 'porcentaje',
      'nota', 'Preventivos que vencían en el mes. Incidencia: se cerró después de su fecha o sigue abierto.',
      'evidencias', coalesce(jsonb_agg(jsonb_build_object('tipo', 'mantenimiento', 'referencia', x.id::text, 'folio', x.folio,
          'detalle', coalesce(x.maquina, 'Sin máquina') || ' · ' || case when x.cerrada is null then 'sigue abierto' when x.cerrada > x.vence
                       then 'hecho ' || (x.cerrada - x.vence) || ' día(s) tarde' else 'a tiempo' end,
          'fecha', x.vence, 'cuenta', x.cerrada is null or x.cerrada > x.vence) order by x.vence), '[]'::jsonb))
    into v_r from x;

  -- Horas de horario con una máquina parada por falla (lo que cae dentro del mes).
  when 'horas_paro_falla' then
    with x as (
      select o.id, o.folio, m.nombre maquina, o.fuera_desde, o.fuera_hasta,
        horas_en_horario(greatest(o.fuera_desde, v_t0), least(coalesce(o.fuera_hasta, now()), v_t1)) horas
      from ordenes_mantenimiento o left join maquinas m on m.id = o.maquina_id
      where o.estado <> 'cancelada' and o.fuera_desde is not null
        and o.fuera_desde < v_t1 and coalesce(o.fuera_hasta, now()) > v_t0
    )
    select jsonb_build_object('valor', coalesce(round(sum(x.horas), 1), 0), 'modo', 'no',
      'nota', 'Horas de horario que las máquinas estuvieron paradas por falla en el mes (de que se reportó parada a que volvió a trabajar). Menos es mejor.',
      'evidencias', coalesce(jsonb_agg(jsonb_build_object('tipo', 'mantenimiento', 'referencia', x.id::text, 'folio', x.folio,
          'detalle', coalesce(x.maquina, 'Sin máquina') || ' · ' || round(x.horas, 1) || ' h parada' || case when x.fuera_hasta is null then ' (sigue parada)' else '' end,
          'fecha', (x.fuera_desde at time zone tz)::date, 'cantidad', round(x.horas, 1), 'cuenta', true) order by x.fuera_desde), '[]'::jsonb))
    into v_r from x where x.horas > 0;

  -- Fallas reportadas en el mes: se empiezan a atender pronto (horas de horario).
  when 'respuesta_fallas' then
    with x as (
      select o.id, o.folio, m.nombre maquina, o.reportado_en, o.inicio_en,
        horas_en_horario(o.reportado_en, coalesce(o.inicio_en, least(now(), v_t1 + interval '7 days'))) horas
      from ordenes_mantenimiento o left join maquinas m on m.id = o.maquina_id
      where o.tipo = 'correctivo' and o.estado <> 'cancelada' and o.reportado_en >= v_t0 and o.reportado_en < v_t1
    ), y as (
      select x.*, x.inicio_en is null or x.horas > coalesce((p_parametros->>'horas')::numeric, 4) tarde from x
      where x.inicio_en is not null or x.horas > coalesce((p_parametros->>'horas')::numeric, 4)
    )
    select jsonb_build_object('posibles', count(*), 'modo', 'porcentaje',
      'nota', format('Fallas reportadas en el mes. Incidencia: se empezó a atender después de %s horas de horario, o no se ha atendido.', coalesce((p_parametros->>'horas')::numeric, 4)),
      'evidencias', coalesce(jsonb_agg(jsonb_build_object('tipo', 'mantenimiento', 'referencia', y.id::text, 'folio', y.folio,
          'detalle', coalesce(y.maquina, 'Sin máquina') || ' · ' || case when y.inicio_en is null then 'sin atender' else 'atendida en ' || round(y.horas, 1) || ' h de horario' end,
          'fecha', (y.reportado_en at time zone tz)::date, 'cantidad', round(y.horas, 1), 'cuenta', y.tarde) order by y.reportado_en), '[]'::jsonb))
    into v_r from y;

  -- Etapas terminadas en el mes: alguien marcó en la terminal quién la trabajó. Sin eso, las horas
  -- hombre, la eficiencia y el costo real de esa etapa no existen.
  when 'etapas_marcadas' then
    with x as (
      select x.id, o.folio, e.nombre etapa, x.fin,
        exists (select 1 from op_tiempos t where t.operacion_id = x.id and t.empleado_id is not null) marcada
      from op_operaciones x join ordenes_produccion o on o.id = x.orden_id join etapas e on e.id = x.etapa_id
      where x.estado = 'terminada' and x.fin >= v_t0 and x.fin < v_t1 and o.estado <> 'cancelada'
    )
    select jsonb_build_object('posibles', count(*), 'modo', 'porcentaje',
      'nota', 'Etapas terminadas en el mes. Incidencia: nadie marcó en la terminal quién la trabajó.',
      'evidencias', coalesce(jsonb_agg(jsonb_build_object('tipo', 'operacion', 'referencia', x.id::text, 'folio', x.folio,
          'detalle', x.etapa || ' · ' || case when x.marcada then 'marcada en la terminal' else 'sin marcar quién la trabajó' end,
          'fecha', (x.fin at time zone tz)::date, 'cuenta', not x.marcada) order by x.fin), '[]'::jsonb))
    into v_r from x;

  -- Horas reales contra las del costeo, de las etapas terminadas en el mes que se marcaron.
  when 'horas_contra_costeo' then
    with x as (
      select x.id, o.folio, e.nombre etapa, x.fin, x.horas_estimadas est,
        (select sum(horas_trabajadas(t.inicio, coalesce(t.fin, x.fin)) * t.personas) from op_tiempos t where t.operacion_id = x.id) real
      from op_operaciones x join ordenes_produccion o on o.id = x.orden_id join etapas e on e.id = x.etapa_id
      where x.estado = 'terminada' and x.fin >= v_t0 and x.fin < v_t1 and o.estado <> 'cancelada' and x.horas_estimadas > 0
    ), y as (select * from x where x.real > 0)
    select case when count(*) = 0 then jsonb_build_object('sin_dato', true,
        'nota', 'Ninguna etapa terminada en el mes se marcó en la terminal: no hay horas reales con qué comparar.')
      else jsonb_build_object('valor', round(100 * sum(y.real) / sum(y.est), 1), 'modo', 'no',
        'nota', format('Horas reales de %s etapa(s) terminadas en el mes y marcadas en la terminal, contra las del costeo (100 %% = lo estimado; más es que se tardó más).', count(*)),
        'evidencias', jsonb_agg(jsonb_build_object('tipo', 'operacion', 'referencia', y.id::text, 'folio', y.folio,
            'detalle', y.etapa || ' · ' || round(y.real, 1) || ' h de ' || round(y.est, 1) || ' h estimadas',
            'fecha', (y.fin at time zone tz)::date, 'cantidad', round(100 * y.real / y.est, 1), 'cuenta', y.real > y.est) order by y.fin)) end
    into v_r from y;

  -- Etapas que se reabrieron en el mes (se dieron por terminadas antes de tiempo o hubo que rehacer).
  when 'etapas_reabiertas' then
    select jsonb_build_object('valor', count(*), 'modo', 'no',
      'nota', 'Etapas que se reabrieron en el mes: se habían dado por terminadas antes de tiempo o hubo que rehacer algo. Menos es mejor.',
      'evidencias', coalesce(jsonb_agg(jsonb_build_object('tipo', 'evento', 'referencia', ev.id::text, 'folio', o.folio,
          'detalle', coalesce(e.nombre || ' · ', '') || coalesce(left(ev.nota, 140), 'sin motivo'),
          'fecha', (ev.en at time zone tz)::date, 'cuenta', true) order by ev.en), '[]'::jsonb))
    into v_r
    from op_eventos ev join ordenes_produccion o on o.id = ev.orden_id
    left join op_operaciones x on x.id = ev.operacion_id left join etapas e on e.id = x.etapa_id
    where ev.tipo = 'reabierta' and ev.en >= v_t0 and ev.en < v_t1;

  -- Pendientes de la persona que vencían en el mes.
  when 'pendientes_a_tiempo' then
    if v_usuario is null then
      v_r := jsonb_build_object('sin_dato', true, 'nota', 'La persona no tiene usuario en el ERP: no tiene pendientes. Califícalo a mano.');
    else
      with x as (
        select p.id, p.titulo, p.vence, p.estado, (p.cerrado_en at time zone tz)::date cerrado
        from pendientes p
        where p.responsable_id = v_usuario and p.estado <> 'cancelado' and p.vence >= v_ini and p.vence < v_fin
          and (p.estado <> 'abierto' or p.vence < v_hoy)
      )
      select jsonb_build_object('posibles', count(*), 'modo', 'porcentaje',
        'nota', 'Sus pendientes que vencían en el mes. Incidencia: se cerró después de su fecha o sigue abierto.',
        'evidencias', coalesce(jsonb_agg(jsonb_build_object('tipo', 'pendiente', 'referencia', x.id::text, 'folio', left(x.titulo, 60),
            'detalle', case when x.estado = 'abierto' then 'sigue abierto' when x.cerrado > x.vence then 'cerrado ' || (x.cerrado - x.vence) || ' día(s) tarde' else 'a tiempo' end,
            'fecha', x.vence, 'cuenta', x.estado = 'abierto' or x.cerrado > x.vence) order by x.vence), '[]'::jsonb))
      into v_r from x;
    end if;

  -- Ideas de mejora que propuso la persona (en Mejoras o desde la terminal, con su nombre).
  when 'ideas_mejora' then
    select jsonb_build_object('valor', count(*), 'modo', 'no',
      'nota', 'Ideas de mejora (kaizen) que propuso en el mes. Las que sugiere el sistema no cuentan.',
      'evidencias', coalesce(jsonb_agg(jsonb_build_object('tipo', 'mejora', 'referencia', m.id::text, 'folio', left(m.titulo, 60),
          'detalle', m.estado, 'fecha', (m.propuesta_en at time zone tz)::date, 'cuenta', false) order by m.propuesta_en), '[]'::jsonb))
    into v_r
    from mejoras m
    where m.propuesta_en >= v_t0 and m.propuesta_en < v_t1 and coalesce(m.quien_propone, '') not ilike 'claude%'
      and ((m.propuesta_por = v_usuario and m.quien_propone is null)
           or lower(trim(m.quien_propone)) = (select lower(trim(nombre)) from empleados where id = p_empleado));

  -- Solicitudes de precio de ventas que vencían en el mes, contestadas a tiempo.
  when 'solicitudes_precio_a_tiempo' then
    with x as (
      select s.id, s.folio, coalesce(a.nombre, s.descripcion) que, s.vence_en, s.contestada_en
      from solicitudes_precio s left join articulos a on a.id = s.articulo_id
      where s.estado <> 'cancelada' and s.vence_en >= v_t0 and s.vence_en < v_t1
        and (s.contestada_en is not null or s.vence_en < now())
    )
    select jsonb_build_object('posibles', count(*), 'modo', 'porcentaje',
      'nota', 'Solicitudes de precio que vencían en el mes. Incidencia: se contestó después de su plazo o sigue sin contestar.',
      'evidencias', coalesce(jsonb_agg(jsonb_build_object('tipo', 'solicitud_precio', 'referencia', x.id::text, 'folio', x.folio,
          'detalle', left(x.que, 80) || ' · ' || case when x.contestada_en is null then 'sin contestar' when x.contestada_en > x.vence_en then 'contestada tarde' else 'a tiempo' end,
          'fecha', (x.vence_en at time zone tz)::date, 'cuenta', x.contestada_en is null or x.contestada_en > x.vence_en) order by x.vence_en), '[]'::jsonb))
    into v_r from x;

  -- Envíos pedidos en el mes: empacados a más tardar el siguiente día hábil.
  when 'empaque_a_tiempo' then
    with x as (
      select v.id, v.folio, coalesce(v.destinatario, v.destino) a_quien, (v.solicitado_en at time zone tz)::date pedido,
        sumar_dias_habiles((v.solicitado_en at time zone tz)::date, coalesce((p_parametros->>'dias')::int, 1)) limite,
        (coalesce(v.empacado_en, v.enviado_en) at time zone tz)::date empacado
      from envios v
      where v.estado <> 'cancelado' and v.solicitado_en >= v_t0 and v.solicitado_en < v_t1
    ), y as (select * from x where x.empacado is not null or x.limite < v_hoy)
    select jsonb_build_object('posibles', count(*), 'modo', 'porcentaje',
      'nota', format('Envíos pedidos en el mes. Incidencia: se empacó después de %s día(s) hábil(es), o sigue sin empacar pasado ese plazo.', coalesce((p_parametros->>'dias')::int, 1)),
      'evidencias', coalesce(jsonb_agg(jsonb_build_object('tipo', 'envio', 'referencia', y.id::text, 'folio', y.folio,
          'detalle', coalesce(y.a_quien || ' · ', '') || case when y.empacado is null then 'sin empacar' when y.empacado > y.limite then 'empacado el ' || to_char(y.empacado, 'DD/MM') || ', tarde' else 'a tiempo' end,
          'fecha', y.pedido, 'cuenta', y.empacado is null or y.empacado > y.limite) order by y.pedido), '[]'::jsonb))
    into v_r from y;

  -- 236: leads que la persona registró, con lo que el vendedor necesita para atenderlos. Se mide
  -- como están al revisar el mes: si los completa antes, ya no cuentan. Los descartados (número
  -- equivocado, duplicado) y las listas cargadas de golpe no se juzgan.
  when 'leads_completos' then
    if v_usuario is null then
      v_r := jsonb_build_object('sin_dato', true, 'nota', 'La persona no tiene usuario en el ERP: no se sabe qué leads registró. Califícalo a mano.');
    else
      with x as (
        select l.id, l.nombre, l.creado_en, lead_faltan(l.cliente_id, l.empresa, l.ciudad, l.estado_mx, l.interes) faltan
        from leads l left join fuentes_contacto f on f.id = l.fuente_id
        where l.capturado_por = v_usuario and l.creado_en >= v_t0 and l.creado_en < v_t1
          and l.estado <> 'descartado' and not coalesce(f.de_lista, false)
      )
      select jsonb_build_object('posibles', count(*), 'modo', 'porcentaje',
        'nota', 'Leads que registró en el mes. Incidencia: le falta dónde está (ciudad o estado), la empresa (o «Particular») o qué busca con modelo, medida o para qué.',
        'evidencias', coalesce(jsonb_agg(jsonb_build_object('tipo', 'lead', 'referencia', x.id::text, 'folio', x.nombre,
            'detalle', case when cardinality(x.faltan) = 0 then 'completo' else 'falta ' || array_to_string(x.faltan, ', ') end,
            'fecha', (x.creado_en at time zone tz)::date, 'cuenta', cardinality(x.faltan) > 0) order by x.creado_en), '[]'::jsonb))
      into v_r from x;
    end if;

  -- 261: la calificación de coaching de las llamadas que atendió (la pone el conmutador con su
  -- rúbrica, de 1 a 10). Solo las que calificaron a la persona, no a la IA. Cada llamada es una
  -- evidencia con su calificación; cuenta como incidencia la que queda por debajo de la mínima
  -- (parámetro «minima», 6 si no se dice), para quien quiera usar la regla de descuento.
  when 'calificacion_coaching' then
    if v_usuario is null then
      v_r := jsonb_build_object('sin_dato', true, 'nota', 'La persona no tiene usuario en el ERP: no se sabe qué llamadas atendió. Califícalo a mano.');
    else
      with x as (
        select k.llamada_id, k.calificacion, coalesce(ll.inicio, ll.creado_en) fecha,
          coalesce(ll.cliente_nombre, ll.lead_nombre, 'Llamada') quien, ll.area_nombre
        from llamada_coaching k join llamadas ll on ll.id = k.llamada_id
        where ll.atendio_perfil = v_usuario and k.atendio_tipo = 'persona'
          and coalesce(ll.inicio, ll.creado_en) >= v_t0 and coalesce(ll.inicio, ll.creado_en) < v_t1
      )
      select case when count(*) = 0 then jsonb_build_object('sin_dato', true,
          'nota', 'No hubo llamadas que atendiera y se calificaran en el mes (o el conmutador no está conectado). Califícalo a mano.')
        else jsonb_build_object('valor', round(avg(x.calificacion), 1), 'posibles', 10, 'modo', 'no',
          'nota', format('Promedio de %s llamada(s) que atendió en el mes y calificó el conmutador, de 1 a 10. Incidencia: una llamada con menos de %s.',
                         count(*), coalesce((p_parametros->>'minima')::numeric, 6)),
          'evidencias', jsonb_agg(jsonb_build_object('tipo', 'llamada', 'referencia', x.llamada_id::text, 'folio', left(x.quien, 60),
              'detalle', 'Calificación ' || x.calificacion || ' de 10' || coalesce(' · ' || x.area_nombre, ''),
              'fecha', (x.fecha at time zone tz)::date, 'cantidad', x.calificacion,
              'cuenta', x.calificacion < coalesce((p_parametros->>'minima')::numeric, 6)) order by x.fecha)) end
      into v_r from x;
    end if;

  else
    v_r := jsonb_build_object('sin_dato', true, 'nota', 'Este indicador todavía no se mide solo: califícalo a mano.');
  end case;
  return v_r;
end $$;

revoke execute on function public.objetivo_medir(text, text, uuid, date, jsonb) from public, anon, authenticated;

-- 9. Revisión nocturna -----------------------------------------------------------------------------
-- Preguntas que nadie supo contestar y se repiten: dos llamadas o más en 7 días con la misma pregunta
-- (dicha con otras palabras cuenta igual, llamada_texto_clave) es un hueco del catálogo, de una ficha
-- o de un precio. Le llega a quien administra el catálogo o los costos (catalogo 3 o costos 3: quien
-- puede dar de alta lo que falta o ponerle precio; si nadie más lo tiene, es dirección). Se cierra
-- sola cuando deja de repetirse. Solo SQL: las preguntas no llevan datos de quien llamó (y aun así
-- pasan por sin_datos_personales al entrar).
create or replace function public.revision_r_preguntas_sin_respuesta() returns setof public.revision_hallazgo_nuevo
language sql stable security definer set search_path = public, extensions as $$
  with pr0 as materialized (
    select a.llamada_id, coalesce(ll.inicio, ll.creado_en) fecha, q.t texto
    from llamadas ll join llamada_analisis a on a.llamada_id = ll.id, unnest(a.preguntas_sin_respuesta) q(t)
    where coalesce(ll.inicio, ll.creado_en) >= now() - interval '7 days'
  ),
  pr_clave as materialized (select t.texto, llamada_texto_clave(t.texto) clave from (select distinct texto from pr0) t),
  pr as (select pr0.*, k.clave from pr0 join pr_clave k on k.texto = pr0.texto),
  g as (
    select clave, count(distinct llamada_id) n, (array_agg(texto order by fecha desc))[1] ejemplo,
      jsonb_agg(jsonb_build_object('tipo', 'llamada', 'referencia', llamada_id, 'detalle', left(texto, 140), 'fecha', fecha) order by fecha desc) evidencia
    from pr where clave is not null group by clave having count(distinct llamada_id) >= 2
  ),
  quienes as (
    select array(select u from (select usuarios_con_permiso('catalogo', 3) u union select usuarios_con_permiso('costos', 3)) x order by u) r
  )
  select 'llamada_analisis', null::text, '/analisis/llamadas',
    format('%s llamadas en 7 días preguntaron: «%s»', g.n, left(g.ejemplo, 90)),
    format('En los últimos 7 días, %s llamadas hicieron esta pregunta (con estas u otras palabras) y no se les supo contestar. Puede faltar en el catálogo, en una ficha técnica o un precio; si se agrega, la próxima se contesta sola.', g.n),
    g.evidencia, (select r from quienes),
    case when g.n >= 5 then 'alta' when g.n >= 3 then 'media' else 'baja' end, null::jsonb,
    'preguntas_sin_respuesta:' || md5(g.clave)
  from g
$$;
revoke execute on function public.revision_r_preguntas_sin_respuesta() from public, anon, authenticated;

-- Calificación baja sostenida de una persona: 5 llamadas o más en 2 semanas con promedio menor a 6.
-- Para dirección, como patrón y sin acusar (puede ser la rúbrica, llamadas difíciles o carga). El
-- título no lleva nombre ni calificación: los títulos de los hallazgos le llegan a la IA nocturna
-- para no repetirse (ya_dicho, 209), y esto es una evaluación de una persona. El nombre va en el detalle.
create or replace function public.revision_r_coaching_bajo_repetido() returns setof public.revision_hallazgo_nuevo
language sql stable security definer set search_path = public, extensions as $$
  with k as (
    select k.perfil_id, k.llamada_id, k.calificacion, k.criterios, coalesce(ll.inicio, ll.creado_en) fecha
    from llamada_coaching k join llamadas ll on ll.id = k.llamada_id join perfiles p on p.id = k.perfil_id and p.activo
    where k.atendio_tipo = 'persona' and coalesce(ll.inicio, ll.creado_en) >= now() - interval '14 days'
  ),
  g as (
    select perfil_id, count(*) n, round(avg(calificacion), 1) promedio,
      jsonb_agg(jsonb_build_object('tipo', 'llamada', 'referencia', llamada_id, 'detalle', 'Calificación ' || calificacion || ' de 10',
                                   'fecha', fecha) order by fecha desc) evidencia
    from k group by perfil_id having count(*) >= 5 and avg(calificacion) < 6
  )
  select 'perfiles', g.perfil_id::text, '/ventas/coaching?perfil=' || g.perfil_id,
    format('Coaching: un patrón de %s llamadas con calificación baja', g.n),
    concat_ws(' ', format('Las %s llamadas que atendió %s en las últimas 2 semanas promedian %s de 10.', g.n, revision_nombre(g.perfil_id), g.promedio),
      (select 'Lo que más baja: ' || b.nombres || '.' from (
         select string_agg(y.nombre, ', ' order by y.prom) nombres from (
           select (array_agg(c.v->>'nombre'))[1] nombre, avg((c.v->>'nota')::numeric) prom
           from k, jsonb_array_elements(k.criterios) c(v)
           where k.perfil_id = g.perfil_id and jsonb_typeof(c.v) = 'object' and jsonb_typeof(c.v->'nota') = 'number'
           group by c.v->>'clave' order by 2 limit 2) y) b where b.nombres is not null),
      'Puede ser la rúbrica, llamadas difíciles o carga de trabajo; vale la pena escuchar un par juntos y ver qué le ayudaría.'),
    g.evidencia, '{}'::uuid[], case when g.promedio < 4 then 'alta' else 'media' end, null::jsonb,
    'coaching_bajo_repetido:' || g.perfil_id || ':' || to_char(current_date, 'IYYY-IW')
  from g
$$;
revoke execute on function public.revision_r_coaching_bajo_repetido() from public, anon, authenticated;

insert into public.revision_reglas (clave, modulo, nombre, descripcion, para, se_resuelve_sola) values
  ('preguntas_sin_respuesta', 'ventas', 'Preguntas de las llamadas que nadie supo contestar',
   'Preguntas que se repiten en 2 llamadas o más en 7 días (con estas u otras palabras) y no se les supo contestar. Le sale a quien administra el catálogo o los costos; se cierra sola cuando deja de repetirse.',
   'responsable', true),
  ('coaching_bajo_repetido', 'ventas', 'Calificación de coaching baja sostenida',
   'Por persona: 5 llamadas o más en las últimas 2 semanas con calificación promedio menor a 6. Solo para dirección, como patrón para platicarlo, no como falta.',
   'direccion', false)
on conflict (clave) do nothing;

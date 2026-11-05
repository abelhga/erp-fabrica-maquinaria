-- =============================================================================
-- Uso del ERP por persona (Sistema → Uso del ERP).
--
-- Por qué: dirección quiere saber quién usa el ERP, cuánto y en qué, para acompañar a quien se está
-- quedando en la hoja o en el papel. Hasta hoy solo se sabía el último inicio de sesión (y la sesión
-- dura semanas), los cambios de la bitácora y las consultas a la IA.
--
--   * uso_diario: por persona, día y pantalla, cuántas veces la abrió y cuántos minutos estuvo
--     activa en ella (un minuto cuenta si la pestaña estaba a la vista y la persona movió el mouse,
--     tecleó o tocó la pantalla en los últimos dos minutos). Un renglón por día y pantalla: no es un
--     registro de cada clic ni guarda qué datos vio.
--   * registrar_uso(): lo único que escribe ahí, siempre a nombre de quien tiene la sesión.
--     Con «ver como una persona» la sesión es de solo lectura y no se registra nada.
--   * uso_por_usuario() y uso_de_usuario(): las métricas, solo para dirección y sistemas (lo mismo
--     que la lista de usuarios). Juntan lo de aquí con lo que ya existía: último acceso, cambios en
--     la bitácora, consultas a la IA, pendientes y avisos sin leer.
-- =============================================================================

create table if not exists public.uso_diario (
  usuario_id uuid not null references public.perfiles(id) on delete cascade,
  dia date not null,
  ruta text not null,
  vistas int not null default 0,
  minutos int not null default 0,
  primera timestamptz not null default now(),
  ultima timestamptz not null default now(),
  primary key (usuario_id, dia, ruta)
);
create index if not exists uso_diario_dia on public.uso_diario (dia);
alter table public.uso_diario enable row level security;
drop policy if exists ver on public.uso_diario;
-- Cada quien ve lo suyo; dirección y sistemas, todo. Nadie escribe directo: solo registrar_uso().
create policy ver on public.uso_diario for select to authenticated
  using (usuario_id = (select auth.uid()) or (select puede('admin', 3)));
grant select on public.uso_diario to authenticated;

create or replace function public.registrar_uso(p_ruta text, p_vista boolean default false, p_minutos int default 0)
returns void language plpgsql security definer set search_path = public as $$
declare v_dia date := (now() at time zone 'America/Mexico_City')::date;
begin
  if auth.uid() is null or p_ruta is null or left(p_ruta, 1) <> '/' then return; end if;
  -- Un aviso por minuto como mucho: lo demás sería un error o alguien inflando su tiempo.
  insert into uso_diario (usuario_id, dia, ruta, vistas, minutos)
  values (auth.uid(), v_dia, left(p_ruta, 120), case when p_vista then 1 else 0 end, least(greatest(coalesce(p_minutos, 0), 0), 1))
  on conflict (usuario_id, dia, ruta) do update set
    vistas = uso_diario.vistas + excluded.vistas,
    minutos = uso_diario.minutos + excluded.minutos,
    ultima = now();
end $$;
revoke execute on function public.registrar_uso(text, boolean, int) from public, anon;
grant execute on function public.registrar_uso(text, boolean, int) to authenticated;

-- Una fila por usuario con lo de un periodo.
create or replace function public.uso_por_usuario(p_desde date, p_hasta date)
returns table (id uuid, nombre text, correo text, roles public.app_rol[], activo boolean,
               ultimo_acceso timestamptz, ultima_actividad timestamptz, dias_activos int, minutos int, vistas int,
               pantallas int, cambios int, consultas_ia int, pendientes_abiertos int, pendientes_vencidos int, avisos_sin_leer int)
language plpgsql stable security definer set search_path = public as $$
declare t0 timestamptz := p_desde::timestamp at time zone 'America/Mexico_City';
        t1 timestamptz := (p_hasta + 1)::timestamp at time zone 'America/Mexico_City';
begin
  if not puede('admin', 3) then
    raise exception 'Solo dirección o sistemas ven el uso del ERP' using errcode = '42501';
  end if;
  return query
  with u as (select x.usuario_id, sum(x.minutos)::int min, sum(x.vistas)::int vis, count(distinct x.ruta)::int pan, max(x.ultima) ult
             from uso_diario x where x.dia between p_desde and p_hasta group by 1),
       b as (select x.usuario_id, count(*)::int n, max(x.en) ult from bitacora x where x.en >= t0 and x.en < t1 group by 1),
       ia as (select x.usuario_id, count(*)::int n, max(x.en) ult from asistente_uso x where x.en >= t0 and x.en < t1 and x.error is null group by 1),
       dias as (select d.usuario_id, count(distinct d.dia)::int n from (
                  select x.usuario_id, x.dia from uso_diario x where x.dia between p_desde and p_hasta
                  union select x.usuario_id, (x.en at time zone 'America/Mexico_City')::date from bitacora x where x.en >= t0 and x.en < t1
                  union select x.usuario_id, (x.en at time zone 'America/Mexico_City')::date from asistente_uso x where x.en >= t0 and x.en < t1) d
                group by 1),
       pe as (select x.responsable_id usuario_id, count(*)::int abiertos,
                count(*) filter (where x.vence < (now() at time zone 'America/Mexico_City')::date)::int vencidos
              from pendientes x where x.estado = 'abierto' group by 1),
       av as (select x.usuario_id, count(*)::int n from avisos x where x.leido_en is null group by 1)
  select p.id, p.nombre, p.correo,
    coalesce((select array_agg(r.rol order by r.rol) from usuario_roles r where r.usuario_id = p.id), '{}'::app_rol[]),
    p.activo, au.last_sign_in_at,
    nullif(greatest(coalesce(u.ult, '-infinity'), coalesce(b.ult, '-infinity'), coalesce(ia.ult, '-infinity')), '-infinity'::timestamptz),
    coalesce(dias.n, 0), coalesce(u.min, 0), coalesce(u.vis, 0), coalesce(u.pan, 0), coalesce(b.n, 0), coalesce(ia.n, 0),
    coalesce(pe.abiertos, 0), coalesce(pe.vencidos, 0), coalesce(av.n, 0)
  from perfiles p
  left join auth.users au on au.id = p.id
  left join u on u.usuario_id = p.id left join b on b.usuario_id = p.id left join ia on ia.usuario_id = p.id
  left join dias on dias.usuario_id = p.id left join pe on pe.usuario_id = p.id left join av on av.usuario_id = p.id
  order by p.activo desc, coalesce(u.min, 0) desc, p.nombre;
end $$;
revoke execute on function public.uso_por_usuario(date, date) from public, anon;
grant execute on function public.uso_por_usuario(date, date) to authenticated;

-- El detalle de una persona: por día, por pantalla, en qué cambió cosas, qué le preguntó a la IA y a qué horas trabaja.
create or replace function public.uso_de_usuario(p_usuario uuid, p_desde date, p_hasta date)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare t0 timestamptz := p_desde::timestamp at time zone 'America/Mexico_City';
        t1 timestamptz := (p_hasta + 1)::timestamp at time zone 'America/Mexico_City';
begin
  if not puede('admin', 3) then
    raise exception 'Solo dirección o sistemas ven el uso del ERP' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'por_dia', (select coalesce(jsonb_agg(jsonb_build_object('dia', d.dia, 'minutos', d.minutos, 'vistas', d.vistas, 'cambios', d.cambios, 'ia', d.ia) order by d.dia), '[]')
      from (select g.dia::date dia,
              coalesce((select sum(x.minutos) from uso_diario x where x.usuario_id = p_usuario and x.dia = g.dia::date), 0) minutos,
              coalesce((select sum(x.vistas) from uso_diario x where x.usuario_id = p_usuario and x.dia = g.dia::date), 0) vistas,
              (select count(*) from bitacora x where x.usuario_id = p_usuario and (x.en at time zone 'America/Mexico_City')::date = g.dia::date) cambios,
              (select count(*) from asistente_uso x where x.usuario_id = p_usuario and (x.en at time zone 'America/Mexico_City')::date = g.dia::date and x.error is null) ia
            from generate_series(p_desde, p_hasta, interval '1 day') g(dia)) d),
    'pantallas', (select coalesce(jsonb_agg(jsonb_build_object('ruta', x.ruta, 'vistas', x.vistas, 'minutos', x.minutos, 'dias', x.dias, 'ultima', x.ultima) order by x.minutos desc, x.vistas desc), '[]')
      from (select ruta, sum(vistas)::int vistas, sum(minutos)::int minutos, count(*)::int dias, max(ultima) ultima
            from uso_diario where usuario_id = p_usuario and dia between p_desde and p_hasta group by ruta) x),
    'cambios', (select coalesce(jsonb_agg(jsonb_build_object('tabla', x.tabla, 'altas', x.altas, 'cambios', x.cambios, 'bajas', x.bajas) order by x.altas + x.cambios + x.bajas desc), '[]')
      from (select tabla, count(*) filter (where accion = 'alta')::int altas, count(*) filter (where accion = 'cambio')::int cambios,
              count(*) filter (where accion = 'baja')::int bajas
            from bitacora where usuario_id = p_usuario and en >= t0 and en < t1 group by tabla) x),
    'ia', (select coalesce(jsonb_agg(jsonb_build_object('modo', x.modo, 'n', x.n) order by x.n desc), '[]')
      from (select modo, count(*)::int n from asistente_uso where usuario_id = p_usuario and en >= t0 and en < t1 and error is null group by modo) x),
    -- A qué horas trabaja en el ERP: cambios de la bitácora y pantallas abiertas por hora del día.
    'horas', (select coalesce(jsonb_agg(jsonb_build_object('hora', h.hora, 'n', h.n) order by h.hora), '[]')
      from (select extract(hour from en at time zone 'America/Mexico_City')::int hora, count(*)::int n
            from (select en from bitacora where usuario_id = p_usuario and en >= t0 and en < t1
                  union all select ultima from uso_diario where usuario_id = p_usuario and dia between p_desde and p_hasta
                  union all select primera from uso_diario where usuario_id = p_usuario and dia between p_desde and p_hasta) e
            group by 1) h)
  );
end $$;
revoke execute on function public.uso_de_usuario(uuid, date, date) from public, anon;
grant execute on function public.uso_de_usuario(uuid, date, date) to authenticated;

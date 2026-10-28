-- =============================================================================
-- La ficha de un pendiente: preguntar lo que hace falta para terminarlo.
--
-- Quien recibe un pendiente a veces no lo puede cerrar sin un dato («¿de cuál proveedor?»,
-- «¿para qué pedido?») y lo preguntaba por chat, fuera del pendiente: quien lo pidió no lo veía
-- junto, y mientras esperaba la respuesta el pendiente se vencía a cuenta de quien lo tenía.
--
-- · pendiente_mensajes: la conversación de cada pendiente; solo se agrega (como la historia), la
--   ven quienes ven el pendiente y escriben solo quien lo tiene y quien lo pidió, mientras siga
--   abierto, con comentar_pendiente(), que le avisa al otro.
-- · Cuando quien lo tiene pregunta, el pendiente queda «esperando respuesta» de quien lo pidió
--   hasta que conteste. Mientras tanto no cuenta como vencido ni suma días de retraso a quien lo
--   tiene (no lo detiene él), y a quien lo pidió le cuenta como «por responder». Está a la vista
--   de todos los que ven el pendiente, así que no sirve para esconder un retraso.
-- =============================================================================

alter table public.pendientes add column if not exists esperando_respuesta boolean not null default false;

create table if not exists public.pendiente_mensajes (
  id bigserial primary key,
  pendiente_id uuid not null references public.pendientes(id) on delete cascade,
  autor_id uuid not null default auth.uid() references public.perfiles(id),
  texto text not null check (length(trim(texto)) > 0),
  en timestamptz not null default now()
);
create index if not exists pendiente_mensajes_pendiente on public.pendiente_mensajes (pendiente_id, en);
alter table public.pendiente_mensajes enable row level security;
-- La ve quien ve el pendiente (la RLS de pendientes filtra la subconsulta).
drop policy if exists ver on public.pendiente_mensajes;
create policy ver on public.pendiente_mensajes for select to authenticated using (pendiente_id in (select id from pendientes));
revoke insert, update, delete on public.pendiente_mensajes from anon, authenticated;
drop trigger if exists inalterable on public.pendiente_mensajes;
create trigger inalterable before update or delete on public.pendiente_mensajes for each row execute function public.evidencia_inalterable();
do $r$ begin
  alter publication supabase_realtime add table public.pendiente_mensajes;
exception when others then null;
end $r$;

-- Mismas reglas que en 184, más: «esperando respuesta» solo lo cambia comentar_pendiente().
create or replace function public.pendiente_reglas() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_yo uuid := auth.uid();
begin
  if v_yo is null then return new; end if;  -- funciones internas y migraciones
  if old.estado <> 'abierto' then raise exception 'Este pendiente ya se cerró' using errcode = '42501'; end if;
  if new.creado_por is distinct from old.creado_por then raise exception 'No se cambia quién pidió el pendiente' using errcode = '42501'; end if;
  if (new.grupo_id, new.modo) is distinct from (old.grupo_id, old.modo) then
    raise exception 'No se cambia a quiénes se pidió ni cómo se cierra' using errcode = '42501';
  end if;
  if v_yo <> old.creado_por and (new.titulo, new.detalle, new.responsable_id, new.vence, new.tabla, new.registro_id, new.ruta)
       is distinct from (old.titulo, old.detalle, old.responsable_id, old.vence, old.tabla, old.registro_id, old.ruta) then
    raise exception 'Solo quien pidió el pendiente lo puede cambiar' using errcode = '42501';
  end if;
  if new.estado = 'cancelado' and v_yo <> old.creado_por then
    raise exception 'Solo quien pidió el pendiente lo puede cancelar' using errcode = '42501';
  end if;
  if new.esperando_respuesta is distinct from old.esperando_respuesta and coalesce(current_setting('hegamex.pregunta', true), '') <> '1' then
    raise exception '«Esperando respuesta» lo pone el ERP al preguntar y lo quita al responder' using errcode = '42501';
  end if;
  if new.estado = 'cubierto' and coalesce(current_setting('hegamex.cubrir', true), '') <> '1' then
    raise exception '«Lo hizo otro» lo marca el ERP cuando alguien del grupo lo termina' using errcode = '42501';
  end if;
  if new.estado <> 'abierto' then new.cerrado_por := v_yo; new.cerrado_en := now(); end if;
  return new;
end $$;

create or replace function public.comentar_pendiente(p_pendiente uuid, p_texto text) returns void
language plpgsql security definer set search_path = public as $$
declare p pendientes; v_yo uuid := auth.uid(); v_nombre text; v_para uuid; v_texto text := trim(coalesce(p_texto, ''));
begin
  select * into p from pendientes where id = p_pendiente for update;
  if p.id is null or v_yo not in (p.responsable_id, p.creado_por) then
    raise exception 'Solo quien tiene el pendiente y quien lo pidió escriben en él' using errcode = '42501';
  end if;
  if p.estado <> 'abierto' then raise exception 'Este pendiente ya se cerró'; end if;
  if v_texto = '' then raise exception 'Escribe la pregunta o la respuesta'; end if;
  insert into pendiente_mensajes (pendiente_id, autor_id, texto) values (p.id, v_yo, left(v_texto, 2000));
  select nombre into v_nombre from perfiles where id = v_yo;
  -- Quien lo tiene pregunta: espera a quien lo pidió. Quien lo pidió contesta: ya no espera.
  -- (Si uno se lo pidió a sí mismo, solo es una nota.)
  if p.responsable_id <> p.creado_por then
    perform set_config('hegamex.pregunta', '1', true);
    update pendientes set esperando_respuesta = (v_yo = p.responsable_id) where id = p.id;
    perform set_config('hegamex.pregunta', '0', true);
    v_para := case when v_yo = p.responsable_id then p.creado_por else p.responsable_id end;
    perform avisar(array[v_para],
      case when v_yo = p.responsable_id then 'pendiente_pregunta' else 'pendiente_respuesta' end,
      case when v_yo = p.responsable_id then 'Te preguntan: ' else 'Te contestaron: ' end || p.titulo,
      format('%s: %s', coalesce(v_nombre, 'alguien'), left(v_texto, 180)),
      '/pendientes?pendiente=' || p.id, 'pendientes', p.id::text);
  end if;
end $$;
revoke execute on function public.comentar_pendiente(uuid, text) from public, anon;
grant execute on function public.comentar_pendiente(uuid, text) to authenticated;

-- El cumplimiento (184) sin contar lo que espera respuesta de quien lo pidió, y con
-- «por responder»: preguntas que esta persona tiene sin contestar en lo que pidió.
drop function if exists public.cumplimiento_pendientes(date);
drop function if exists public.mi_cumplimiento_pendientes(date);
drop function if exists public._cumplimiento_pendientes(date, uuid);
create or replace function public._cumplimiento_pendientes(p_desde date, p_persona uuid)
returns table (persona_id uuid, persona text, abiertos int, vencidos int, cerrados int, a_tiempo int, tarde int,
  sin_fecha int, dias_promedio numeric, esperan int, dias_retraso int, pidio int, pidio_abiertos int, por_responder int)
language sql stable security invoker set search_path = public as $$
  with cerr as (
    select p.*, (p.cerrado_en at time zone 'America/Mexico_City')::date as dia_cierre from pendientes p
    where p.estado = 'hecho' and (p.cerrado_en at time zone 'America/Mexico_City')::date >= p_desde
  ), gente as (
    select x.id from (
      select responsable_id as id from pendientes where estado = 'abierto' or (estado = 'hecho' and cerrado_en >= p_desde)
      union select creado_por from pendientes where creado_en >= p_desde or estado = 'abierto'
      union select p_persona) x
    where x.id is not null and (p_persona is null or x.id = p_persona)
  )
  select g.id, pf.nombre,
    (select count(*)::int from pendientes p where p.responsable_id = g.id and p.estado = 'abierto'),
    (select count(*)::int from pendientes p where p.responsable_id = g.id and p.estado = 'abierto' and p.vence < hoy_mx() and not p.esperando_respuesta),
    (select count(*)::int from cerr c where c.responsable_id = g.id),
    (select count(*)::int from cerr c where c.responsable_id = g.id and c.vence is not null and c.dia_cierre <= c.vence),
    (select count(*)::int from cerr c where c.responsable_id = g.id and c.vence is not null and c.dia_cierre > c.vence),
    (select count(*)::int from cerr c where c.responsable_id = g.id and c.vence is null),
    (select round(avg(extract(epoch from c.cerrado_en - c.creado_en) / 86400)::numeric, 1) from cerr c where c.responsable_id = g.id),
    (select count(distinct p.creado_por)::int from pendientes p where p.responsable_id = g.id and p.estado = 'abierto' and p.creado_por <> g.id),
    (select coalesce(sum(hoy_mx() - p.vence), 0)::int from pendientes p where p.responsable_id = g.id and p.estado = 'abierto' and p.vence < hoy_mx() and not p.esperando_respuesta),
    (select count(*)::int from pendientes p where p.creado_por = g.id and p.responsable_id <> g.id and p.creado_en >= p_desde),
    (select count(*)::int from pendientes p where p.creado_por = g.id and p.responsable_id <> g.id and p.estado = 'abierto'),
    (select count(*)::int from pendientes p where p.creado_por = g.id and p.estado = 'abierto' and p.esperando_respuesta)
  from gente g join perfiles pf on pf.id = g.id
  order by 4 desc, 11 desc, 3 desc, 2
$$;
revoke execute on function public._cumplimiento_pendientes(date, uuid) from public, anon;
grant execute on function public._cumplimiento_pendientes(date, uuid) to authenticated;

-- Todos, para dirección y Recursos Humanos (los demás no ven los pendientes de otros).
create or replace function public.cumplimiento_pendientes(p_desde date default null)
returns table (persona_id uuid, persona text, abiertos int, vencidos int, cerrados int, a_tiempo int, tarde int,
  sin_fecha int, dias_promedio numeric, esperan int, dias_retraso int, pidio int, pidio_abiertos int, por_responder int)
language plpgsql stable security invoker set search_path = public as $$
begin
  if not (tiene_rol('direccion') or puede('rrhh', 3)) then
    raise exception 'El cumplimiento de pendientes de todos es de dirección y Recursos Humanos' using errcode = '42501';
  end if;
  return query select * from _cumplimiento_pendientes(coalesce(p_desde, hoy_mx() - 30), null);
end $$;
revoke execute on function public.cumplimiento_pendientes(date) from public, anon;
grant execute on function public.cumplimiento_pendientes(date) to authenticated;

-- Lo mío: el mismo cálculo, solo para quien pregunta.
create or replace function public.mi_cumplimiento_pendientes(p_desde date default null)
returns table (persona_id uuid, persona text, abiertos int, vencidos int, cerrados int, a_tiempo int, tarde int,
  sin_fecha int, dias_promedio numeric, esperan int, dias_retraso int, pidio int, pidio_abiertos int, por_responder int)
language sql stable security invoker set search_path = public as $$
  select * from _cumplimiento_pendientes(coalesce(p_desde, hoy_mx() - 30), auth.uid())
$$;
revoke execute on function public.mi_cumplimiento_pendientes(date) from public, anon;
grant execute on function public.mi_cumplimiento_pendientes(date) to authenticated;

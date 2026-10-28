-- =============================================================================
-- Pendientes: dirección y Recursos Humanos ven el cumplimiento de cada quien, y un pendiente
-- puede ir a varias personas.
--
-- 1. Ver a todos. La base ya dejaba a dirección leer todos los pendientes (071), pero la pantalla
--    solo enseñaba los propios, y Recursos Humanos no veía ninguno. Para medir el compromiso de
--    cada quien, los ve también quien tiene Recursos Humanos nivel 3 (RH y dirección), con
--    cumplimiento_pendientes(): por persona, lo abierto, lo vencido, lo cerrado a tiempo y tarde.
--    Solo ven: cambiar sigue siendo de quien lo tiene y de quien lo pidió.
--
-- 2. Varias personas. Cada una recibe su propio pendiente (así el aviso, «Me tocan» y la medición
--    siguen siendo por persona) y comparten grupo_id y modo:
--      · «uno»: basta con que uno lo haga; al cerrarlo, a los demás se les cierra como «cubierto»
--        («lo hizo X»), que no cuenta ni a favor ni en contra de nadie.
--      · «todos»: cada quien lo tiene que hacer; a quien lo pidió le llega «2 de 3» y al final
--        «todos». El grupo está listo cuando nadie lo tiene abierto.
-- =============================================================================

alter table public.pendientes add column if not exists grupo_id uuid;
alter table public.pendientes add column if not exists modo text check (modo in ('uno', 'todos'));
create index if not exists pendientes_grupo on public.pendientes (grupo_id) where grupo_id is not null;
alter table public.pendientes drop constraint if exists pendientes_estado_check;
alter table public.pendientes add constraint pendientes_estado_check check (estado in ('abierto', 'hecho', 'cancelado', 'cubierto'));
-- Un grupo lleva su modo; uno suelto, no.
alter table public.pendientes drop constraint if exists pendientes_grupo_modo;
alter table public.pendientes add constraint pendientes_grupo_modo check ((grupo_id is null) = (modo is null));

drop policy if exists ver on public.pendientes;
create policy ver on public.pendientes for select to authenticated using (
  responsable_id = (select auth.uid()) or creado_por = (select auth.uid())
  or (select tiene_rol('direccion')) or (select puede('rrhh', 3)));

-- Mismas reglas que en 071, más: el grupo y su modo no cambian, y «cubierto» solo lo pone la base.
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
  if new.estado = 'cubierto' and coalesce(current_setting('hegamex.cubrir', true), '') <> '1' then
    raise exception '«Lo hizo otro» lo marca el ERP cuando alguien del grupo lo termina' using errcode = '42501';
  end if;
  if new.estado <> 'abierto' then new.cerrado_por := v_yo; new.cerrado_en := now(); end if;
  return new;
end $$;

-- «Basta con que uno»: al cerrarlo alguien, a los demás se les cierra y se les avisa quién fue.
create or replace function public.pendiente_grupo() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_quien text; v_otros uuid[];
begin
  if new.estado = 'hecho' and old.estado = 'abierto' and new.grupo_id is not null and new.modo = 'uno' then
    select nombre into v_quien from perfiles where id = new.cerrado_por;
    select array_agg(responsable_id) into v_otros from pendientes
    where grupo_id = new.grupo_id and id <> new.id and estado = 'abierto';
    if v_otros is not null then
      perform set_config('hegamex.cubrir', '1', true);
      update pendientes set estado = 'cubierto', nota_cierre = 'Lo hizo ' || coalesce(v_quien, 'otra persona')
      where grupo_id = new.grupo_id and id <> new.id and estado = 'abierto';
      perform set_config('hegamex.cubrir', '0', true);
      perform avisar(v_otros, 'pendiente_cubierto', 'Ya no te toca: ' || new.titulo,
        format('Lo hizo %s', coalesce(v_quien, 'otra persona')), coalesce(new.ruta, '/pendientes'), 'pendientes', new.id::text);
    end if;
  end if;
  return new;
end $$;
drop trigger if exists pendiente_grupo on public.pendientes;
create trigger pendiente_grupo after update of estado on public.pendientes
  for each row execute function public.pendiente_grupo();

-- Avisos (071), con el avance del grupo cuando cada quien lo tiene que hacer.
create or replace function public.aviso_pendiente() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_de text; v_hechos int; v_total int;
begin
  if tg_op = 'INSERT' or new.responsable_id is distinct from old.responsable_id then
    select nombre into v_de from perfiles where id = new.creado_por;
    perform avisar(array[new.responsable_id], 'pendiente_nuevo', new.titulo,
      format('De %s%s', coalesce(v_de, 'alguien'), coalesce(' · para el ' || to_char(new.vence, 'DD/MM'), '')),
      coalesce(new.ruta, '/pendientes'), 'pendientes', new.id::text);
  elsif new.estado <> old.estado and new.estado = 'hecho' then
    select nombre into v_de from perfiles where id = new.cerrado_por;
    if new.modo = 'todos' then
      select count(*) filter (where estado = 'hecho'), count(*) filter (where estado <> 'cancelado')
        into v_hechos, v_total from pendientes where grupo_id = new.grupo_id;
      perform avisar(array[new.creado_por], 'pendiente_hecho',
        case when v_hechos >= v_total then 'Listo, todos: ' else format('Listo %s de %s: ', v_hechos, v_total) end || new.titulo,
        format('%s%s', coalesce(v_de, ''), coalesce(' · ' || new.nota_cierre, '')),
        coalesce(new.ruta, '/pendientes'), 'pendientes', new.id::text);
    else
      perform avisar(array[new.creado_por], 'pendiente_hecho', 'Listo: ' || new.titulo,
        format('%s%s', coalesce(v_de, ''), coalesce(' · ' || new.nota_cierre, '')),
        coalesce(new.ruta, '/pendientes'), 'pendientes', new.id::text);
    end if;
  end if;
  return new;
end $$;

-- El compromiso de cada quien con sus pendientes. Lo cerrado cuenta en el periodo; lo abierto,
-- lo vencido y a cuántos detiene, hoy. «Cubierto» y cancelado no cuentan. Se calcula con lo que
-- quien pregunta puede ver: cada quien lo suyo (mi_cumplimiento_pendientes) y dirección y RH a
-- todos (cumplimiento_pendientes).
--   esperan: cuántas personas tienen algo pedido a esta persona que sigue abierto (a cuántos detiene).
--   dias_retraso: la suma de días que lleva vencido cada pendiente abierto (cuánto los detiene).
create or replace function public._cumplimiento_pendientes(p_desde date, p_persona uuid)
returns table (persona_id uuid, persona text, abiertos int, vencidos int, cerrados int, a_tiempo int, tarde int,
  sin_fecha int, dias_promedio numeric, esperan int, dias_retraso int, pidio int, pidio_abiertos int)
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
    (select count(*)::int from pendientes p where p.responsable_id = g.id and p.estado = 'abierto' and p.vence < hoy_mx()),
    (select count(*)::int from cerr c where c.responsable_id = g.id),
    (select count(*)::int from cerr c where c.responsable_id = g.id and c.vence is not null and c.dia_cierre <= c.vence),
    (select count(*)::int from cerr c where c.responsable_id = g.id and c.vence is not null and c.dia_cierre > c.vence),
    (select count(*)::int from cerr c where c.responsable_id = g.id and c.vence is null),
    (select round(avg(extract(epoch from c.cerrado_en - c.creado_en) / 86400)::numeric, 1) from cerr c where c.responsable_id = g.id),
    (select count(distinct p.creado_por)::int from pendientes p where p.responsable_id = g.id and p.estado = 'abierto' and p.creado_por <> g.id),
    (select coalesce(sum(hoy_mx() - p.vence), 0)::int from pendientes p where p.responsable_id = g.id and p.estado = 'abierto' and p.vence < hoy_mx()),
    (select count(*)::int from pendientes p where p.creado_por = g.id and p.responsable_id <> g.id and p.creado_en >= p_desde),
    (select count(*)::int from pendientes p where p.creado_por = g.id and p.responsable_id <> g.id and p.estado = 'abierto')
  from gente g join perfiles pf on pf.id = g.id
  order by 4 desc, 11 desc, 3 desc, 2
$$;
revoke execute on function public._cumplimiento_pendientes(date, uuid) from public, anon;
grant execute on function public._cumplimiento_pendientes(date, uuid) to authenticated;

-- Todos, para dirección y Recursos Humanos (los demás no ven los pendientes de otros).
create or replace function public.cumplimiento_pendientes(p_desde date default null)
returns table (persona_id uuid, persona text, abiertos int, vencidos int, cerrados int, a_tiempo int, tarde int,
  sin_fecha int, dias_promedio numeric, esperan int, dias_retraso int, pidio int, pidio_abiertos int)
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
  sin_fecha int, dias_promedio numeric, esperan int, dias_retraso int, pidio int, pidio_abiertos int)
language sql stable security invoker set search_path = public as $$
  select * from _cumplimiento_pendientes(coalesce(p_desde, hoy_mx() - 30), auth.uid())
$$;
revoke execute on function public.mi_cumplimiento_pendientes(date) from public, anon;
grant execute on function public.mi_cumplimiento_pendientes(date) to authenticated;

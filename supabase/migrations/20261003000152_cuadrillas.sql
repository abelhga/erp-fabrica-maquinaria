-- Tablero de cuadrillas: quién trabaja qué en cada etapa, y quién sigue.
--
-- Luis armaba el taller en un tablero por etapas con las personas dentro y lo movía
-- arrastrando. Si ese tablero es otra captura, a la semana dice algo distinto que la
-- terminal y nadie le cree a ninguno. Aquí son lo mismo:
--   - Mientras una etapa está en proceso, su cuadrilla es quien tiene su tiempo abierto
--     (op_tiempos, lo que marca la terminal). Mover a alguien en el tablero cierra su
--     tiempo donde estaba y lo abre donde llega: las horas hombre siguen siendo de verdad.
--   - Antes de empezar (o pausada), la cuadrilla es la planeada (op_asignaciones). La
--     terminal la trae marcada al iniciar; si se inicia con otra gente, manda lo que se hizo
--     y la planeada se vuelve esa.
--   - El turno ordena la cola de cada etapa; lo pone la gerencia arrastrando.
-- Un mismo nombre puede estar planeado en varias etapas (es su cola), pero trabajando solo
-- en una (lo cuida el índice único de op_tiempos).

create table if not exists public.op_asignaciones (
  operacion_id uuid not null references public.op_operaciones(id) on delete cascade,
  empleado_id uuid not null references public.empleados(id) on delete cascade,
  asignado_por uuid default auth.uid() references public.perfiles(id),
  asignado_en timestamptz not null default now(),
  primary key (operacion_id, empleado_id)
);
create index if not exists op_asignaciones_empleado on public.op_asignaciones (empleado_id);
alter table public.op_asignaciones enable row level security;
-- Se lee como los tiempos (producción 1); se escribe solo con las funciones de abajo.
drop policy if exists ver on public.op_asignaciones;
create policy ver on public.op_asignaciones for select to authenticated using ((select puede('produccion', 1)));
revoke insert, update, delete, truncate on public.op_asignaciones from anon, authenticated;
drop trigger if exists auditar on public.op_asignaciones;
create trigger auditar after insert or update or delete on public.op_asignaciones for each row execute function public.auditar();
do $$ begin
  alter publication supabase_realtime add table public.op_asignaciones;
exception when duplicate_object then null; when undefined_object then null;
end $$;

alter table public.op_operaciones add column if not exists turno int;

-- La terminal y el tablero escriben lo mismo: quien abre un tiempo en una etapa queda en su
-- cuadrilla; quien sale de una etapa que sigue en proceso deja de estarlo. Al pausar o
-- terminar se cierran todos los tiempos, pero la cuadrilla se queda: es la que reanuda.
create or replace function public.cuadrilla_sigue_tiempos() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.empleado_id is null then return new; end if;
  if tg_op = 'INSERT' then
    insert into op_asignaciones (operacion_id, empleado_id) values (new.operacion_id, new.empleado_id) on conflict do nothing;
  elsif old.fin is null and new.fin is not null
        and exists (select 1 from op_operaciones where id = new.operacion_id and estado = 'en_proceso') then
    delete from op_asignaciones where operacion_id = new.operacion_id and empleado_id = new.empleado_id;
  end if;
  return new;
end $$;
drop trigger if exists cuadrilla_sigue on public.op_tiempos;
create trigger cuadrilla_sigue after insert or update of fin on public.op_tiempos
  for each row execute function public.cuadrilla_sigue_tiempos();

-- La de 149, y al iniciar o reanudar la cuadrilla planeada se vuelve la que de verdad arrancó.
CREATE OR REPLACE FUNCTION public.avanzar_operacion(p_operacion uuid, p_accion text, p_nota text DEFAULT NULL::text, p_responsable text DEFAULT NULL::text, p_empleados uuid[] DEFAULT NULL::uuid[], p_sin_nombre integer DEFAULT 0)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare op op_operaciones; o ordenes_produccion; v_etapa text; v_resp text := nullif(trim(p_responsable), '');
  v_cuadrilla text;
  v_nota text := nullif(trim(p_nota), '');
begin
  if not puede('produccion', 2) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  select * into op from op_operaciones where id = p_operacion for update;
  if op.id is null then raise exception 'No existe esa etapa'; end if;
  select * into o from ordenes_produccion where id = op.orden_id for update;
  select nombre into v_etapa from etapas where id = op.etapa_id;
  if o.estado = 'planeada' then raise exception 'La orden % todavía no está liberada', o.folio; end if;
  if o.estado in ('terminada', 'entregada', 'cancelada') then raise exception 'La orden % ya está cerrada', o.folio; end if;
  if o.en_espera_motivo is not null then
    raise exception 'La orden % está en espera (%): la gerencia de producción la reactiva', o.folio, o.en_espera_motivo;
  end if;

  if p_accion in ('inicio', 'reanudar') then
    v_cuadrilla := nombres_cuadrilla(p_empleados, p_sin_nombre);
    v_resp := coalesce(v_cuadrilla, v_resp);
  end if;

  case p_accion
    when 'inicio' then
      if op.estado = 'terminada' then raise exception '% de % ya se terminó', v_etapa, o.folio; end if;
      if op.estado = 'en_proceso' then
        raise exception '% de % ya estaba en proceso%', v_etapa, o.folio, coalesce(' (' || op.responsable || ')', '');
      end if;
      update op_operaciones set estado = 'en_proceso', inicio = least(coalesce(inicio, now()), now()),
        responsable = coalesce(v_resp, responsable) where id = p_operacion;
      update ordenes_produccion set estado = 'en_proceso' where id = o.id and estado = 'liberada';
    when 'pausa' then
      if op.estado <> 'en_proceso' then raise exception 'Solo se pausa una etapa que está en proceso'; end if;
      update op_operaciones set estado = 'pausada', responsable = coalesce(v_resp, responsable) where id = p_operacion;
    when 'reanudar' then
      if op.estado <> 'pausada' then raise exception '% de % no está pausada', v_etapa, o.folio; end if;
      update op_operaciones set estado = 'en_proceso', responsable = coalesce(v_resp, responsable) where id = p_operacion;
    when 'fin' then
      if op.estado = 'terminada' then raise exception '% de % ya se terminó', v_etapa, o.folio; end if;
      update op_operaciones set estado = 'terminada', fin = now(), inicio = least(coalesce(inicio, now()), now()),
        responsable = coalesce(v_resp, responsable) where id = p_operacion;
      update ordenes_produccion set estado = 'en_proceso' where id = o.id and estado = 'liberada';
    when 'problema' then
      if v_nota is null then raise exception 'Escribe cuál es el problema'; end if;
    when 'nota' then
      if v_nota is null then raise exception 'La nota está vacía'; end if;
    else raise exception 'Acción desconocida: %', p_accion;
  end case;
  insert into op_eventos (orden_id, operacion_id, tipo, nota, responsable)
  values (o.id, p_operacion, p_accion, v_nota, coalesce(v_resp, op.responsable));

  -- Quien empieza o reanuda la etapa abre su tramo de tiempo (pausa y fin los cierra el disparador).
  if p_accion in ('inicio', 'reanudar') then
    perform abrir_tramos(p_operacion, p_empleados, p_sin_nombre);
    -- Lo que se hizo manda: quien estaba planeado y no arrancó deja la cuadrilla.
    delete from op_asignaciones where operacion_id = p_operacion and empleado_id <> all(coalesce(p_empleados, '{}'));
  end if;

  if p_accion = 'fin' and not exists (select 1 from op_operaciones where orden_id = o.id and estado <> 'terminada') then
    update ordenes_produccion set estado = 'terminada', terminada_en = now() where id = o.id;
    insert into op_eventos (orden_id, tipo) values (o.id, 'terminada');
    -- Si todas las órdenes del pedido terminaron, el pedido queda listo para entregar.
    if o.pedido_id is not null and not exists (select 1 from ordenes_produccion where pedido_id = o.pedido_id
                                               and estado not in ('terminada', 'entregada', 'cancelada')) then
      update pedidos set estado = 'listo' where id = o.pedido_id and estado = 'en_produccion';
    end if;
  end if;
end $function$;

-- Lo que se arrastra en el tablero. Solo la gerencia de producción (nivel 3): el
-- supervisor de piso marca lo que pasa en la terminal; mover gente es planear.
--   p_desde: la etapa de donde viene la persona si se arrastró desde otra tarjeta.
-- Si la etapa a donde llega está en proceso, la persona entra a trabajar desde ahora (se
-- abre su tiempo); si no, queda planeada para cuando arranque.
create or replace function public.asignar_a_etapa(p_operacion uuid, p_empleado uuid, p_desde uuid default null)
returns text language plpgsql security definer set search_path = public as $$
declare op op_operaciones; o ordenes_produccion; v_nombre text; v_etapa text; v_donde text; v_tramo uuid;
begin
  if not puede('produccion', 3) then raise exception 'Solo la gerencia de producción mueve gente en el tablero' using errcode = '42501'; end if;
  select * into op from op_operaciones where id = p_operacion for update;
  if op.id is null then raise exception 'No existe esa etapa'; end if;
  select * into o from ordenes_produccion where id = op.orden_id;
  select nombre into v_etapa from etapas where id = op.etapa_id;
  select nombre into v_nombre from empleados where id = p_empleado and activo;
  if v_nombre is null then raise exception 'Esa persona no está activa en Personal'; end if;
  if op.estado = 'terminada' then raise exception '% de % ya se terminó', v_etapa, o.folio; end if;
  if o.estado in ('terminada', 'entregada', 'cancelada') then raise exception 'La orden % ya está cerrada', o.folio; end if;
  if p_desde = p_operacion then return 'sin cambio'; end if;

  -- Sale de donde venía (si ahí estaba trabajando, su tiempo se cierra ahora).
  if p_desde is not null then perform quitar_de_etapa(p_desde, p_empleado); end if;

  if op.estado = 'en_proceso' then
    if o.en_espera_motivo is not null then raise exception 'La orden % está en espera', o.folio; end if;
    select t.id, et.nombre || ' de ' || oo.folio into v_tramo, v_donde
    from op_tiempos t join op_operaciones x on x.id = t.operacion_id join etapas et on et.id = x.etapa_id
    join ordenes_produccion oo on oo.id = t.orden_id
    where t.empleado_id = p_empleado and t.fin is null;
    if v_tramo is not null then
      raise exception '% está trabajando en %: arrástralo desde esa tarjeta para cambiarlo de lugar', v_nombre, v_donde;
    end if;
    perform abrir_tramos(p_operacion, array[p_empleado], 0);
    insert into op_eventos (orden_id, operacion_id, tipo, nota, responsable)
    values (o.id, p_operacion, 'nota', v_nombre || ' entró (tablero de cuadrillas)', v_nombre);
    return 'trabajando';
  end if;
  insert into op_asignaciones (operacion_id, empleado_id) values (p_operacion, p_empleado) on conflict do nothing;
  return 'planeado';
end $$;
revoke execute on function public.asignar_a_etapa(uuid, uuid, uuid) from public, anon;
grant execute on function public.asignar_a_etapa(uuid, uuid, uuid) to authenticated;

create or replace function public.quitar_de_etapa(p_operacion uuid, p_empleado uuid)
returns void language plpgsql security definer set search_path = public as $$
declare t op_tiempos; v_nombre text;
begin
  if not puede('produccion', 3) then raise exception 'Solo la gerencia de producción mueve gente en el tablero' using errcode = '42501'; end if;
  select * into t from op_tiempos where operacion_id = p_operacion and empleado_id = p_empleado and fin is null for update;
  if t.id is not null then
    update op_tiempos set fin = now() where id = t.id;
    select nombre into v_nombre from empleados where id = p_empleado;
    insert into op_eventos (orden_id, operacion_id, tipo, nota, responsable)
    values (t.orden_id, p_operacion, 'nota', v_nombre || ' salió (tablero de cuadrillas)', v_nombre);
  end if;
  delete from op_asignaciones where operacion_id = p_operacion and empleado_id = p_empleado;
end $$;
revoke execute on function public.quitar_de_etapa(uuid, uuid) from public, anon;
grant execute on function public.quitar_de_etapa(uuid, uuid) to authenticated;

-- La cola de una etapa en el orden en que quedó al soltar: 1, 2, 3…
create or replace function public.ordenar_cola(p_operaciones uuid[])
returns void language plpgsql security definer set search_path = public as $$
begin
  if not puede('produccion', 3) then raise exception 'Solo la gerencia de producción ordena la cola' using errcode = '42501'; end if;
  if (select count(distinct etapa_id) from op_operaciones where id = any(p_operaciones)) > 1 then
    raise exception 'La cola se ordena dentro de una sola etapa';
  end if;
  update op_operaciones x set turno = n.i from unnest(p_operaciones) with ordinality n(id, i) where x.id = n.id;
end $$;
revoke execute on function public.ordenar_cola(uuid[]) from public, anon;
grant execute on function public.ordenar_cola(uuid[]) to authenticated;

-- El piso con el turno y las horas que ya lleva cada etapa (para "faltan ≈" en el tablero).
-- Mismas columnas de antes y dos al final.
create or replace view public.v_piso_operaciones with (security_invoker = true) as
 SELECT x.id,
    x.orden_id,
    x.etapa_id,
    e.nombre AS etapa,
    e.color,
    e.orden AS etapa_orden,
    x.estado,
    x.horas_estimadas,
    x.inicio,
    x.fin,
    x.responsable,
    t.folio,
    t.numero_serie,
    t.clave,
    t.equipo,
    t.cliente,
    t.pedido_folio,
    t.prioridad,
    t.fecha_compromiso,
    t.dias_restantes,
    t.atrasada,
    t.avance,
    t.materiales_faltantes,
    t.estado AS orden_estado,
    ant.pendientes IS NULL AS lista,
    ant.pendientes AS espera_a,
    pr.nota AS ultimo_problema,
    pr.en AS ultimo_problema_en,
    x.turno,
    coalesce(hh.horas, 0)::numeric(10,2) AS horas_reales
   FROM op_operaciones x
     JOIN etapas e ON e.id = x.etapa_id
     JOIN v_tablero_produccion t ON t.id = x.orden_id
     LEFT JOIN LATERAL ( SELECT string_agg(ey.nombre, ', '::text ORDER BY ey.orden) AS pendientes
           FROM op_operaciones y
             JOIN etapas ey ON ey.id = y.etapa_id
          WHERE y.orden_id = x.orden_id AND ey.orden < e.orden AND y.estado <> 'terminada'::estado_operacion) ant ON true
     LEFT JOIN LATERAL ( SELECT ev.nota,
            ev.en
           FROM op_eventos ev
          WHERE ev.operacion_id = x.id AND ev.tipo = 'problema'::text
          ORDER BY ev.en DESC, ev.id DESC
         LIMIT 1) pr ON true
     LEFT JOIN LATERAL ( SELECT sum(extract(epoch from coalesce(ti.fin, now()) - ti.inicio) / 3600 * ti.personas) AS horas
           FROM op_tiempos ti
          WHERE ti.operacion_id = x.id) hh ON true
  WHERE (t.estado = ANY (ARRAY['liberada'::estado_op, 'en_proceso'::estado_op])) AND x.estado <> 'terminada'::estado_operacion AND NOT (EXISTS ( SELECT 1
           FROM ordenes_produccion oe
          WHERE oe.id = x.orden_id AND oe.en_espera_motivo IS NOT NULL));

-- Arranque: lo que ya marcó la terminal. En proceso, quien tiene su tiempo abierto; pausada,
-- quien estaba cuando se pausó (los tiempos que cerraron al final), que es quien la reanuda.
insert into public.op_asignaciones (operacion_id, empleado_id, asignado_por, asignado_en)
select distinct t.operacion_id, t.empleado_id, null::uuid, now()
from public.op_tiempos t join public.op_operaciones x on x.id = t.operacion_id
where t.empleado_id is not null and (
  (x.estado = 'en_proceso' and t.fin is null)
  or (x.estado = 'pausada' and t.fin = (select max(y.fin) from public.op_tiempos y where y.operacion_id = x.id)))
on conflict do nothing;

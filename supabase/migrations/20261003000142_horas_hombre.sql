-- Horas hombre de verdad: quién trabajó cada etapa y cuánto tiempo.
--
-- La terminal guardaba cuándo empezaba y terminaba una etapa y un nombre de texto, pero en
-- el taller una etapa la trabajan 2 o 3 personas y cambian a media etapa: el tiempo de la
-- etapa no dice las horas hombre, y sin ellas no se puede comparar contra lo que trae el
-- costeo (la hoja de Luis lo hacía a mano: número de operadores × horas). Ahora cada
-- persona tiene su tramo: entra al iniciar o reanudar la etapa, o se une después; sale
-- cuando se va o cuando la etapa se pausa o termina. Si el encargado no sabe quién es (un
-- ayudante de paso, alguien sin alta en Personal), agrega "personas sin nombre": cuentan
-- igual en las horas, y el reporte dice qué parte quedó sin nombre.
--   horas hombre = suma de (fin − inicio) × personas de cada tramo.
-- Una persona no puede estar en dos etapas a la vez (índice único sobre su tramo abierto).

create table if not exists public.op_tiempos (
  id uuid primary key default gen_random_uuid(),
  operacion_id uuid not null references public.op_operaciones(id) on delete cascade,
  orden_id uuid not null references public.ordenes_produccion(id) on delete cascade,
  empleado_id uuid references public.empleados(id),
  personas int not null default 1 check (personas between 1 and 10),
  inicio timestamptz not null default now(),
  fin timestamptz,
  registrado_por uuid default auth.uid() references public.perfiles(id),
  check (empleado_id is null or personas = 1),
  check (fin is null or fin >= inicio)
);
create index if not exists op_tiempos_operacion on public.op_tiempos (operacion_id);
create index if not exists op_tiempos_orden on public.op_tiempos (orden_id);
create unique index if not exists op_tiempos_persona_abierta on public.op_tiempos (empleado_id) where fin is null and empleado_id is not null;
alter table public.op_tiempos enable row level security;
-- Se lee con producción 1; se escribe solo con las funciones de la terminal.
drop policy if exists ver on public.op_tiempos;
create policy ver on public.op_tiempos for select to authenticated using ((select puede('produccion', 1)));
create trigger auditar after insert or update or delete on public.op_tiempos for each row execute function public.auditar();
do $$ begin
  alter publication supabase_realtime add table public.op_tiempos;
exception when duplicate_object then null; when undefined_object then null;
end $$;

-- Al pausar, terminar o poner en espera una etapa, se cierran todos sus tramos abiertos.
create or replace function public.cerrar_tramos_etapa() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.estado = 'en_proceso' and new.estado <> 'en_proceso' then
    update op_tiempos set fin = now() where operacion_id = new.id and fin is null;
  end if;
  return new;
end $$;
drop trigger if exists cerrar_tramos on public.op_operaciones;
create trigger cerrar_tramos after update of estado on public.op_operaciones
  for each row execute function public.cerrar_tramos_etapa();

-- "Juan, Pedro +1": lo que se guarda como responsable, para que el historial se lea igual que antes.
create or replace function public.nombres_cuadrilla(p_empleados uuid[], p_sin_nombre int) returns text
language sql stable security definer set search_path = public as $$
  select nullif(concat_ws(' ',
    (select string_agg(e.nombre, ', ' order by e.nombre) from empleados e where e.id = any(coalesce(p_empleados, '{}'))),
    case when coalesce(p_sin_nombre, 0) > 0 then '+' || p_sin_nombre end), '')
$$;
revoke execute on function public.nombres_cuadrilla(uuid[], int) from public, anon, authenticated;

-- Abre un tramo por persona (y uno por las personas sin nombre). Interna: la llaman
-- avanzar_operacion y unir_a_etapa, que ya revisaron permiso y estado.
create or replace function public.abrir_tramos(p_operacion uuid, p_empleados uuid[], p_sin_nombre int) returns int
language plpgsql security definer set search_path = public as $$
declare op op_operaciones; v_emp uuid; v_donde text; v_n int := 0; v_nombre text;
begin
  select * into op from op_operaciones where id = p_operacion;
  if coalesce(p_sin_nombre, 0) < 0 or coalesce(p_sin_nombre, 0) > 10 then raise exception 'Personas sin nombre: de 0 a 10'; end if;
  foreach v_emp in array coalesce(p_empleados, '{}') loop
    select nombre into v_nombre from empleados where id = v_emp and activo;
    if v_nombre is null then raise exception 'Esa persona no está activa en Personal'; end if;
    select et.nombre || ' de ' || o.folio into v_donde
    from op_tiempos t join op_operaciones x on x.id = t.operacion_id join etapas et on et.id = x.etapa_id
    join ordenes_produccion o on o.id = t.orden_id
    where t.empleado_id = v_emp and t.fin is null;
    if v_donde is not null then
      raise exception '% ya está trabajando en %: que salga de ahí primero', v_nombre, v_donde;
    end if;
    insert into op_tiempos (operacion_id, orden_id, empleado_id) values (p_operacion, op.orden_id, v_emp);
    v_n := v_n + 1;
  end loop;
  if coalesce(p_sin_nombre, 0) > 0 then
    insert into op_tiempos (operacion_id, orden_id, personas) values (p_operacion, op.orden_id, p_sin_nombre);
    v_n := v_n + p_sin_nombre;
  end if;
  return v_n;
end $$;
revoke execute on function public.abrir_tramos(uuid, uuid[], int) from public, anon, authenticated;

-- La terminal agrega personas: avanzar_operacion es la de 141 con la cuadrilla.
drop function if exists public.avanzar_operacion(uuid, text, text, text);
create or replace function public.avanzar_operacion(p_operacion uuid, p_accion text, p_nota text default null, p_responsable text default null,
  p_empleados uuid[] default null, p_sin_nombre int default 0)
returns void language plpgsql security definer set search_path = public as $$
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
      update op_operaciones set estado = 'en_proceso', inicio = coalesce(inicio, now()),
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
      update op_operaciones set estado = 'terminada', fin = now(), inicio = coalesce(inicio, now()),
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
end $$;
revoke execute on function public.avanzar_operacion(uuid, text, text, text, uuid[], int) from public, anon;
grant execute on function public.avanzar_operacion(uuid, text, text, text, uuid[], int) to authenticated;

-- Alguien se une a una etapa que ya está en proceso, o sale de ella, sin detenerla.
create or replace function public.unir_a_etapa(p_operacion uuid, p_empleado uuid default null, p_sin_nombre int default 0) returns void
language plpgsql security definer set search_path = public as $$
declare op op_operaciones; o ordenes_produccion; v_quien text;
begin
  if not puede('produccion', 2) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  select * into op from op_operaciones where id = p_operacion for update;
  if op.id is null then raise exception 'No existe esa etapa'; end if;
  select * into o from ordenes_produccion where id = op.orden_id;
  if op.estado <> 'en_proceso' then raise exception 'Solo se une gente a una etapa que está en proceso (iníciala o reanúdala)'; end if;
  if o.en_espera_motivo is not null then raise exception 'La orden % está en espera', o.folio; end if;
  if p_empleado is null and coalesce(p_sin_nombre, 0) < 1 then raise exception 'Di quién se une'; end if;
  perform abrir_tramos(p_operacion, case when p_empleado is null then null else array[p_empleado] end, case when p_empleado is null then p_sin_nombre else 0 end);
  v_quien := nombres_cuadrilla(case when p_empleado is null then null else array[p_empleado] end, case when p_empleado is null then p_sin_nombre else 0 end);
  insert into op_eventos (orden_id, operacion_id, tipo, nota, responsable) values (o.id, p_operacion, 'nota', v_quien || ' se unió', v_quien);
end $$;
revoke execute on function public.unir_a_etapa(uuid, uuid, int) from public, anon;
grant execute on function public.unir_a_etapa(uuid, uuid, int) to authenticated;

create or replace function public.salir_de_etapa(p_tiempo uuid) returns void
language plpgsql security definer set search_path = public as $$
declare t op_tiempos; v_quien text;
begin
  if not puede('produccion', 2) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  select * into t from op_tiempos where id = p_tiempo for update;
  if t.id is null or t.fin is not null then raise exception 'Ese tiempo ya está cerrado'; end if;
  update op_tiempos set fin = now() where id = p_tiempo;
  v_quien := coalesce((select nombre from empleados where id = t.empleado_id), t.personas || ' sin nombre');
  insert into op_eventos (orden_id, operacion_id, tipo, nota, responsable) values (t.orden_id, t.operacion_id, 'nota', v_quien || ' salió', v_quien);
end $$;
revoke execute on function public.salir_de_etapa(uuid) from public, anon;
grant execute on function public.salir_de_etapa(uuid) to authenticated;

-- El personal para elegir en la terminal: solo nombre, su etapa y dónde está ahorita.
-- (La terminal no debe ver la ficha completa: sueldos, teléfonos, domicilio.)
create or replace function public.personal_de_piso()
returns table (id uuid, nombre text, etapa_id int, trabajando_en text, tiempo_id uuid)
language plpgsql stable security definer set search_path = public as $$
begin
  if not puede('produccion', 2) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  return query
  select e.id, e.nombre, e.etapa_id, et.nombre || ' · ' || o.folio, t.id
  from empleados e
  left join op_tiempos t on t.empleado_id = e.id and t.fin is null
  left join op_operaciones x on x.id = t.operacion_id
  left join etapas et on et.id = x.etapa_id
  left join ordenes_produccion o on o.id = t.orden_id
  where e.activo
  order by e.nombre;
end $$;
revoke execute on function public.personal_de_piso() from public, anon;
grant execute on function public.personal_de_piso() to authenticated;

-- Horas hombre de una orden por etapa, con quién trabajó y cuánto (incluye lo abierto hasta ahora).
create or replace function public.horas_hombre_orden(p_orden uuid)
returns table (operacion_id uuid, etapa text, etapa_orden int, horas_estimadas numeric, horas_reales numeric, horas_sin_nombre numeric,
               personas jsonb)
language plpgsql stable security definer set search_path = public as $$
begin
  if not puede('produccion', 1) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  return query
  select x.id, et.nombre, et.orden, x.horas_estimadas,
    round(coalesce(sum(extract(epoch from coalesce(t.fin, now()) - t.inicio) / 3600 * t.personas), 0)::numeric, 2),
    round(coalesce(sum(extract(epoch from coalesce(t.fin, now()) - t.inicio) / 3600 * t.personas) filter (where t.empleado_id is null), 0)::numeric, 2),
    coalesce((select jsonb_agg(jsonb_build_object('tiempo_id', y.id, 'nombre', coalesce(e.nombre, y.personas || ' sin nombre'),
                                                  'horas', round((extract(epoch from coalesce(y.fin, now()) - y.inicio) / 3600 * y.personas)::numeric, 2),
                                                  'abierto', y.fin is null, 'inicio', y.inicio, 'fin', y.fin) order by y.inicio)
              from op_tiempos y left join empleados e on e.id = y.empleado_id where y.operacion_id = x.id), '[]'::jsonb)
  from op_operaciones x join etapas et on et.id = x.etapa_id
  left join op_tiempos t on t.operacion_id = x.id
  where x.orden_id = p_orden
  group by x.id, et.nombre, et.orden, x.horas_estimadas
  order by et.orden;
end $$;
revoke execute on function public.horas_hombre_orden(uuid) from public, anon;
grant execute on function public.horas_hombre_orden(uuid) to authenticated;

-- Quién está ahorita en cada etapa abierta (para las tarjetas de la terminal y la TV).
create or replace function public.cuadrillas_abiertas()
returns table (tiempo_id uuid, operacion_id uuid, empleado_id uuid, nombre text, personas int, inicio timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not puede('produccion', 1) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  return query
  select t.id, t.operacion_id, t.empleado_id, coalesce(e.nombre, t.personas || ' sin nombre'), t.personas, t.inicio
  from op_tiempos t left join empleados e on e.id = t.empleado_id
  where t.fin is null order by t.inicio;
end $$;
revoke execute on function public.cuadrillas_abiertas() from public, anon;
grant execute on function public.cuadrillas_abiertas() to authenticated;

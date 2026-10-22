-- =============================================================================
-- Personal de piso y métricas de producción (ingeniería de procesos).
--
-- 1. Quién entra a cuadrillas. La terminal y Cuadrillas ofrecían a las 49 personas
--    activas, incluidos vendedores, compras y administración. RH sigue siendo quien da de
--    alta, de baja y decide el departamento; de la gente de Producción, la gerencia de
--    producción ajusta su área de piso y si entra a cuadrillas (un coordinador o un
--    almacenista asignado a producción quizá no). Solo quien entra a cuadrillas se puede
--    anotar en una etapa, en la terminal o en el tablero.
--    De paso: la gerencia de producción leía la ficha de todo el personal (teléfono,
--    correo, contacto de emergencia) de cualquier departamento. Ahora solo la de Producción.
--
-- 2. Rol "ingenieria_procesos" y módulo "procesos": las métricas lean de la planta
--    (entregas a tiempo, lead time, eficiencia del flujo, horas reales contra estimadas,
--    trabajo en proceso, paros y retrabajo, mantenimiento). Ve producción como personal de
--    planta y los costos (para el costo del desperdicio), sin márgenes ni precios de venta.
--    Lo tienen además la gerencia de producción y dirección.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Personal de piso
-- -----------------------------------------------------------------------------
alter table public.empleados add column if not exists en_cuadrillas boolean not null default false;

create or replace function public.departamento_produccion() returns int
language sql stable security definer set search_path = public as $$
  select id from departamentos where nombre = 'Producción' limit 1
$$;

-- Fuera de Producción nadie entra a cuadrillas; quien entra a Producción con su área de
-- piso entra de una vez (RH lo puede quitar en su ficha y la gerencia en Cuadrillas).
create or replace function public.trg_empleado_cuadrillas() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.departamento_id is distinct from departamento_produccion() then
    new.en_cuadrillas := false;
  elsif tg_op = 'INSERT' and new.etapa_id is not null then
    new.en_cuadrillas := true;
  elsif tg_op = 'UPDATE' and old.departamento_id is distinct from new.departamento_id and new.etapa_id is not null then
    new.en_cuadrillas := true;
  end if;
  return new;
end $$;
drop trigger if exists cuadrillas on public.empleados;
create trigger cuadrillas before insert or update of departamento_id, etapa_id, en_cuadrillas on public.empleados
  for each row execute function public.trg_empleado_cuadrillas();

-- Arranque: de Producción, quien tiene área de piso y los ayudantes generales. El
-- coordinador y el auxiliar de supervisor quedan fuera; la gerencia los cambia si sí.
update public.empleados set en_cuadrillas = true
where departamento_id = public.departamento_produccion() and activo
  and (etapa_id is not null or puesto ilike 'ayudante%');

-- La gerencia de producción ve la ficha, las vacaciones y las incidencias de su gente, no
-- las de todo el personal. (Tiene «RH: ver» para las vacaciones de su gente; con eso leía
-- también a ventas y administración.) RH (2 o más) y dirección siguen viendo a todos.
drop policy if exists ver on public.empleados;
create policy ver on public.empleados for select to authenticated using (
  (select puede('rrhh', 2))
  or ((select puede('rrhh', 1)) and not (select puede('produccion', 3)))
  or ((select puede('produccion', 3)) and departamento_id = (select departamento_produccion()))
  or usuario_id = (select auth.uid()));
-- Lo demás del personal sigue a la ficha: quien no ve a la persona no ve sus vacaciones.
drop policy if exists ver on public.incidencias;
create policy ver on public.incidencias for select to authenticated using (
  (select puede('rrhh', 2))
  or (((select puede('rrhh', 1)) or (select puede('produccion', 3))) and empleado_id in (select id from public.empleados))
  or exists (select 1 from public.empleados e where e.id = incidencias.empleado_id and e.usuario_id = (select auth.uid())));
drop policy if exists ver on public.vacaciones_arranque;
create policy ver on public.vacaciones_arranque for select to authenticated using (
  (select puede('rrhh', 2))
  or (((select puede('rrhh', 1)) or (select puede('produccion', 3))) and empleado_id in (select id from public.empleados))
  or empleado_id in (select id from public.empleados where usuario_id = (select auth.uid())));

-- Solo quien entra a cuadrillas se anota en una etapa (la terminal y el tablero ya solo
-- lo ofrecen a ellos; esto es la barrera).
create or replace function public.trg_solo_cuadrillas() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_nombre text; v_ok boolean;
begin
  if new.empleado_id is null then return new; end if;
  select nombre, en_cuadrillas into v_nombre, v_ok from empleados where id = new.empleado_id;
  if not coalesce(v_ok, false) then
    raise exception '% no está marcado para cuadrillas: la gerencia de producción lo marca en Cuadrillas → Personal de piso', v_nombre;
  end if;
  return new;
end $$;
drop trigger if exists solo_cuadrillas on public.op_tiempos;
create trigger solo_cuadrillas before insert on public.op_tiempos for each row execute function public.trg_solo_cuadrillas();
drop trigger if exists solo_cuadrillas on public.op_asignaciones;
create trigger solo_cuadrillas before insert on public.op_asignaciones for each row execute function public.trg_solo_cuadrillas();

-- La de 142, con solo quien entra a cuadrillas (y quien ya está trabajando, para poder sacarlo).
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
  where e.activo and (e.en_cuadrillas or t.id is not null)
  order by e.nombre;
end $$;

-- La gente de Producción para que la gerencia acomode áreas y cuadrillas (sin datos personales).
create or replace function public.personal_produccion()
returns table (id uuid, nombre text, puesto text, etapa_id int, en_cuadrillas boolean, trabajando_en text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not (puede('produccion', 3) or puede('rrhh', 1)) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  return query
  select e.id, e.nombre, e.puesto, e.etapa_id, e.en_cuadrillas,
    (select et.nombre || ' · ' || o.folio from op_tiempos t join op_operaciones x on x.id = t.operacion_id
     join etapas et on et.id = x.etapa_id join ordenes_produccion o on o.id = t.orden_id
     where t.empleado_id = e.id and t.fin is null limit 1)
  from empleados e
  where e.activo and e.departamento_id = departamento_produccion()
  order by e.nombre;
end $$;
revoke execute on function public.personal_produccion() from public, anon;
grant execute on function public.personal_produccion() to authenticated;

create or replace function public.ajustar_personal_piso(p_empleado uuid, p_etapa int, p_en_cuadrillas boolean)
returns void language plpgsql security definer set search_path = public as $$
declare e empleados;
begin
  select * into e from empleados where id = p_empleado for update;
  if e.id is null then raise exception 'No existe esa persona'; end if;
  if not (puede('rrhh', 2) or (puede('produccion', 3) and e.departamento_id = departamento_produccion())) then
    raise exception 'La gerencia de producción solo acomoda a la gente de Producción; lo demás es de Recursos Humanos' using errcode = '42501';
  end if;
  if p_en_cuadrillas and e.departamento_id is distinct from departamento_produccion() then
    raise exception '% no es de Producción: Recursos Humanos le cambia el departamento primero', e.nombre;
  end if;
  update empleados set etapa_id = p_etapa, en_cuadrillas = p_en_cuadrillas where id = p_empleado;
end $$;
revoke execute on function public.ajustar_personal_piso(uuid, int, boolean) from public, anon;
grant execute on function public.ajustar_personal_piso(uuid, int, boolean) to authenticated;

-- -----------------------------------------------------------------------------
-- 2. Ingeniería de procesos y el módulo de métricas
-- -----------------------------------------------------------------------------
insert into public.permisos_rol (rol, modulo, nivel) values
  ('direccion', 'procesos', 3), ('gerente_produccion', 'procesos', 3),
  ('ingenieria_procesos', 'procesos', 3),
  -- Personal de planta: ve el taller, las cuadrillas y las horas (y podría marcar en la terminal).
  ('ingenieria_procesos', 'produccion', 2),
  -- Costos para medir el costo del desperdicio; costeo para ver listas, horas y tiempos de
  -- cada equipo. Sin márgenes, ventas ni catálogo: no ve utilidad ni precios de venta.
  ('ingenieria_procesos', 'costos', 1), ('ingenieria_procesos', 'costeo', 1),
  ('ingenieria_procesos', 'inventario', 1), ('ingenieria_procesos', 'mantenimiento', 1),
  ('ingenieria_procesos', 'asistente', 1)
on conflict do nothing;

-- Todas las métricas de la planta en un periodo. Las cifras salen de lo que se marca en la
-- terminal: por eso trae la "cobertura" (qué parte de las etapas terminadas se marcó con
-- quién la trabajó) para saber cuánto creerle a cada número.
create or replace function public.metricas_produccion(p_desde date, p_hasta date)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  d0 timestamptz := p_desde::timestamp at time zone 'America/Mexico_City';
  d1 timestamptz := (p_hasta + 1)::timestamp at time zone 'America/Mexico_City';
  v_costos boolean := puede('costos', 1);
  r jsonb;
begin
  if not puede('procesos', 1) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  if p_hasta < p_desde then raise exception 'El periodo está al revés'; end if;

  drop table if exists _ops, _etp;
  -- Las que se cargaron de la hoja ya terminadas traen su fecha de terminada antes de existir
  -- en el ERP: cuentan como terminadas, pero no para los tiempos (con_tiempos).
  create temp table _ops on commit drop as
  select z.*, z.terminada_en > z.liberada_en con_tiempos from (
  select o.id, o.folio, o.articulo_id, o.fecha_compromiso, o.terminada_en,
    coalesce((select min(e.en) from op_eventos e where e.orden_id = o.id and e.tipo = 'liberada'), o.creado_en) liberada_en,
    (o.terminada_en at time zone 'America/Mexico_City')::date <= o.fecha_compromiso a_tiempo
  from ordenes_produccion o
  where o.estado in ('terminada', 'entregada') and o.terminada_en >= d0 and o.terminada_en < d1) z;

  -- Etapas terminadas en el periodo, con sus horas hombre, sus horas de reloj con alguien
  -- trabajando (la unión de los tramos) y desde cuándo podían empezar.
  create temp table _etp on commit drop as
  select x.id, x.orden_id, x.etapa_id, x.horas_estimadas, x.inicio, x.fin,
    (select sum(extract(epoch from coalesce(t.fin, now()) - t.inicio) / 3600 * t.personas) from op_tiempos t where t.operacion_id = x.id) hh,
    (select sum(extract(epoch from upper(rr) - lower(rr)) / 3600)
       from unnest((select range_agg(tstzrange(t.inicio, coalesce(t.fin, now()))) from op_tiempos t where t.operacion_id = x.id)) rr) reloj,
    greatest(
      coalesce((select min(e.en) from op_eventos e where e.orden_id = x.orden_id and e.tipo = 'liberada'), o.creado_en),
      coalesce((select max(y.fin) from op_operaciones y join etapas ey on ey.id = y.etapa_id
                where y.orden_id = x.orden_id and ey.orden < et.orden), '-infinity'::timestamptz)) lista_en
  from op_operaciones x join ordenes_produccion o on o.id = x.orden_id join etapas et on et.id = x.etapa_id
  where x.estado = 'terminada' and x.fin >= d0 and x.fin < d1;

  select jsonb_build_object(
    'periodo', jsonb_build_object('desde', p_desde, 'hasta', p_hasta),
    'con_costos', v_costos,
    'resumen', (select jsonb_build_object(
        'ordenes_terminadas', (select count(*) from _ops),
        'ordenes_con_fecha', (select count(*) from _ops where fecha_compromiso is not null),
        'ordenes_a_tiempo', (select count(*) from _ops where a_tiempo),
        'pedidos_entregados', (select count(*) from pedidos where estado = 'entregado' and entregado_en >= d0 and entregado_en < d1 and fecha_compromiso is not null),
        'pedidos_a_tiempo', (select count(*) from pedidos where estado = 'entregado' and entregado_en >= d0 and entregado_en < d1
                               and (entregado_en at time zone 'America/Mexico_City')::date <= fecha_compromiso),
        'lead_time_dias', (select round(avg(extract(epoch from terminada_en - liberada_en) / 86400)::numeric, 1) from _ops where con_tiempos),
        'lead_time_mediana_dias', (select round((percentile_cont(0.5) within group (order by extract(epoch from terminada_en - liberada_en) / 86400))::numeric, 1) from _ops where con_tiempos),
        -- Eficiencia del flujo: de todo el tiempo que la orden estuvo en el taller, qué parte
        -- alguien la estaba trabajando. Solo de las órdenes que se marcaron en la terminal.
        'eficiencia_flujo', (select round((100 * sum(rl.horas) / nullif(sum(extract(epoch from p.terminada_en - p.liberada_en) / 3600), 0))::numeric, 1)
                             from (select * from _ops where con_tiempos) p join lateral (
                               select sum(extract(epoch from upper(rr) - lower(rr)) / 3600) horas
                               from unnest((select range_agg(tstzrange(t.inicio, coalesce(t.fin, now()))) from op_tiempos t where t.orden_id = p.id)) rr) rl on rl.horas > 0),
        'etapas_terminadas', (select count(*) from _etp),
        'etapas_con_terminal', (select count(*) from _etp where hh > 0),
        'horas_estimadas', (select round(sum(horas_estimadas)::numeric, 1) from _etp where hh > 0),
        'horas_reales', (select round(sum(hh)::numeric, 1) from _etp where hh > 0),
        'en_proceso', (select count(*) from op_operaciones x join ordenes_produccion o on o.id = x.orden_id
                       where x.estado = 'en_proceso' and o.estado in ('liberada', 'en_proceso')),
        'pausadas', (select count(*) from op_operaciones x join ordenes_produccion o on o.id = x.orden_id
                     where x.estado = 'pausada' and o.estado in ('liberada', 'en_proceso')),
        'ordenes_abiertas', (select count(*) from ordenes_produccion where estado in ('liberada', 'en_proceso') and en_espera_motivo is null),
        'pausas', (select count(*) from op_eventos where tipo = 'pausa' and en >= d0 and en < d1),
        'problemas', (select count(*) from op_eventos where tipo = 'problema' and en >= d0 and en < d1),
        'reabiertas', (select count(*) from op_eventos where tipo = 'reabierta' and en >= d0 and en < d1))),

    -- Equipos terminados por semana, a tiempo y tarde.
    'semanas', (select coalesce(jsonb_agg(jsonb_build_object('semana', s.semana, 'a_tiempo', s.a_tiempo, 'tarde', s.tarde, 'sin_fecha', s.sin_fecha) order by s.semana), '[]')
                from (select g::date semana,
                        (select count(*) from _ops where a_tiempo and (terminada_en at time zone 'America/Mexico_City')::date between g::date and g::date + 6) a_tiempo,
                        (select count(*) from _ops where not a_tiempo and (terminada_en at time zone 'America/Mexico_City')::date between g::date and g::date + 6) tarde,
                        (select count(*) from _ops where fecha_compromiso is null and (terminada_en at time zone 'America/Mexico_City')::date between g::date and g::date + 6) sin_fecha
                      from generate_series(date_trunc('week', p_desde::timestamp), p_hasta::timestamp, interval '7 days') g) s),

    'etapas', (select coalesce(jsonb_agg(jsonb_build_object(
        'etapa_id', et.id, 'etapa', et.nombre, 'color', et.color,
        'terminadas', coalesce(a.n, 0), 'con_terminal', coalesce(a.con_terminal, 0),
        'horas_estimadas', a.est, 'horas_reales', a.hh,
        'espera_h', a.espera, 'trabajo_h', a.trabajo,
        'en_proceso', (select count(*) from op_operaciones x join ordenes_produccion o on o.id = x.orden_id
                       where x.etapa_id = et.id and x.estado in ('en_proceso', 'pausada') and o.estado in ('liberada', 'en_proceso')),
        'pausas', (select count(*) from op_eventos e join op_operaciones x on x.id = e.operacion_id where x.etapa_id = et.id and e.tipo = 'pausa' and e.en >= d0 and e.en < d1),
        'problemas', (select count(*) from op_eventos e join op_operaciones x on x.id = e.operacion_id where x.etapa_id = et.id and e.tipo = 'problema' and e.en >= d0 and e.en < d1),
        'reabiertas', (select count(*) from op_eventos e join op_operaciones x on x.id = e.operacion_id where x.etapa_id = et.id and e.tipo = 'reabierta' and e.en >= d0 and e.en < d1),
        'costo_estimado', case when v_costos then round(a.est * tm.costo_hora, 2) end,
        'costo_real', case when v_costos then round(a.hh * tm.costo_hora, 2) end
      ) order by et.orden), '[]')
      from etapas et
      left join tarifas_mano_obra tm on tm.etapa_id = et.id
      left join lateral (
        select count(*) n, count(*) filter (where hh > 0) con_terminal,
          round(sum(horas_estimadas) filter (where hh > 0)::numeric, 1) est, round(sum(hh)::numeric, 1) hh,
          round(avg(greatest(extract(epoch from inicio - lista_en) / 3600, 0)) filter (where inicio is not null and lista_en > '-infinity')::numeric, 1) espera,
          round(avg(reloj) filter (where reloj > 0)::numeric, 1) trabajo
        from _etp where etapa_id = et.id) a on true
      where et.activa),

    -- Horas hombre por persona dentro del periodo (lo de un tramo que cae fuera no cuenta).
    'personas', (select coalesce(jsonb_agg(p order by (p->>'horas')::numeric desc), '[]') from (
        select jsonb_build_object('nombre', coalesce(e.nombre, 'Sin nombre'), 'area', ar.nombre,
          'horas', round(sum(extract(epoch from least(coalesce(t.fin, now()), d1) - greatest(t.inicio, d0)) / 3600 * t.personas)::numeric, 1),
          'etapas', count(distinct t.operacion_id), 'ordenes', count(distinct t.orden_id)) p
        from op_tiempos t left join empleados e on e.id = t.empleado_id left join etapas ar on ar.id = e.etapa_id
        where t.inicio < d1 and coalesce(t.fin, now()) > d0
        group by e.id, e.nombre, ar.nombre) q),

    -- Por equipo: horas por unidad contra lo estimado y cuánto tardó (solo lo marcado en la terminal).
    'equipos', (select coalesce(jsonb_agg(q order by q->>'equipo'), '[]') from (
        select jsonb_build_object('equipo', a.nombre, 'clave', a.clave, 'terminados', count(*),
          'horas_estimadas', round(avg(h.est)::numeric, 1), 'horas_reales', round(avg(h.hh) filter (where h.hh > 0)::numeric, 1),
          'lead_time_dias', round(avg(extract(epoch from p.terminada_en - p.liberada_en) / 86400) filter (where p.con_tiempos)::numeric, 1)) q
        from _ops p join articulos a on a.id = p.articulo_id
        join lateral (select sum(x.horas_estimadas) est,
                        (select sum(extract(epoch from coalesce(t.fin, now()) - t.inicio) / 3600 * t.personas) from op_tiempos t where t.orden_id = p.id) hh
                      from op_operaciones x where x.orden_id = p.id) h on true
        group by a.id, a.nombre, a.clave) z),

    'problemas', (select coalesce(jsonb_agg(jsonb_build_object('en', e.en, 'tipo', e.tipo, 'nota', e.nota, 'etapa', et.nombre, 'folio', o.folio) order by e.en desc), '[]')
      from (select * from op_eventos where tipo in ('problema', 'reabierta') and en >= d0 and en < d1 order by en desc limit 20) e
      join ordenes_produccion o on o.id = e.orden_id left join op_operaciones x on x.id = e.operacion_id left join etapas et on et.id = x.etapa_id),

    -- Máquinas: fallas, horas fuera de servicio dentro del periodo, tiempo promedio de
    -- reparación (de que se reporta a que se cierra) y preventivos.
    'mantenimiento', (select jsonb_build_object(
        'fallas', count(*) filter (where m.tipo = 'correctivo' and m.reportado_en >= d0 and m.reportado_en < d1),
        'fallas_que_paran', count(*) filter (where m.tipo = 'correctivo' and m.detiene and m.reportado_en >= d0 and m.reportado_en < d1),
        'horas_fuera', round(sum(greatest(extract(epoch from least(coalesce(m.fuera_hasta, now()), d1) - greatest(m.fuera_desde, d0)) / 3600, 0))
                             filter (where m.fuera_desde is not null and m.fuera_desde < d1)::numeric, 1),
        'mttr_h', round(avg(extract(epoch from m.cerrada_en - m.reportado_en) / 3600)
                        filter (where m.tipo = 'correctivo' and m.estado = 'cerrada' and m.cerrada_en >= d0 and m.cerrada_en < d1)::numeric, 1),
        'preventivos_hechos', count(*) filter (where m.tipo = 'preventivo' and m.estado = 'cerrada' and m.cerrada_en >= d0 and m.cerrada_en < d1),
        'preventivos_a_tiempo', count(*) filter (where m.tipo = 'preventivo' and m.estado = 'cerrada' and m.cerrada_en >= d0 and m.cerrada_en < d1
                                                 and (m.vence is null or (m.cerrada_en at time zone 'America/Mexico_City')::date <= m.vence)),
        'preventivos_vencidos', count(*) filter (where m.tipo = 'preventivo' and m.estado in ('pendiente', 'en_proceso') and m.vence < hoy_mx()))
      from ordenes_mantenimiento m where m.estado <> 'cancelada')
  ) into r;
  return r;
end $$;
revoke execute on function public.metricas_produccion(date, date) from public, anon;
grant execute on function public.metricas_produccion(date, date) to authenticated;

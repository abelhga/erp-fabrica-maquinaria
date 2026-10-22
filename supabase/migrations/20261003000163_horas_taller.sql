-- =============================================================================
-- Cómo se cuentan las horas de la terminal: solo el horario del taller, o lo que se marque.
--
-- Las horas hombre eran horas de reloj: una etapa que se quedaba en «Iniciar» toda la noche
-- sumaba la noche (y el fin de semana) como trabajo. Con eso el plan del Gantt daba por hecho
-- lo que no estaba hecho, y las métricas comparaban contra horas que nadie trabajó. Pedirle al
-- piso que pause en cada desayuno, comida y salida, con una sola tablet, no es realista.
--
-- Ahora es configuración de la gerencia de producción (horas_taller.modo):
--   «horario»  (hoy): solo cuenta el horario de la planta (horario_habil: L–V 8–18, sáb 8–14,
--              sin feriados ni descansos de la empresa) menos los descansos fijos: 15:00–15:20
--              para todos y 40 min de desayuno entre 10:00 y 11:00 (unos de 10:00 a 10:40, otros
--              de 10:20 a 11:00: se descuentan 40 de esos 60 min, en proporción a lo que el tramo
--              cubra). Nadie pausa para desayunar ni al irse.
--   «terminal» (cuando haya una terminal por área): cuenta tal cual lo marcado; pausan siempre.
-- horas_trabajadas() es la única que lo sabe; horas hombre, piso, plan y métricas la usan.
-- =============================================================================

insert into public.configuracion (clave, valor, descripcion) values
  ('horas_taller',
   '{"modo": "horario", "descansos": [{"de": "10:00", "a": "11:00", "minutos": 40}, {"de": "15:00", "a": "15:20"}]}',
   'Cómo se cuentan las horas de la terminal de piso. modo «horario»: solo el horario de la planta (horario_habil) menos los descansos (de–a; «minutos» si el descanso dura menos que la ventana porque va por turnos). modo «terminal»: tal cual se marca (el piso pausa en cada descanso y al irse). Lo cambia la gerencia de producción en Cuadrillas → Personal de piso.')
on conflict (clave) do nothing;

-- Horas de trabajo entre dos instantes, según el modo. Invoker: configuracion la lee cualquiera
-- con rol (la TV también, por v_piso_operaciones).
create or replace function public.horas_trabajadas(p_desde timestamptz, p_hasta timestamptz)
returns numeric language sql stable security invoker set search_path = public as $$
  with c as (select coalesce((select valor from configuracion where clave = 'horas_taller'), '{"modo": "horario"}'::jsonb) v)
  select case
    when p_desde is null or p_hasta is null or p_hasta <= p_desde then 0
    when (select v->>'modo' from c) = 'terminal' then round(extract(epoch from p_hasta - p_desde)::numeric / 3600, 4)
    else coalesce((
      select round(sum(
        greatest(extract(epoch from least(w.fin, p_hasta) - greatest(w.inicio, p_desde)), 0)
        - coalesce((
            select sum(greatest(extract(epoch from
                     least(w.fin, p_hasta, (g.d + (dsc->>'a')::time) at time zone 'America/Mexico_City')
                     - greatest(w.inicio, p_desde, (g.d + (dsc->>'de')::time) at time zone 'America/Mexico_City')), 0)
                   * coalesce((dsc->>'minutos')::numeric * 60 / nullif(extract(epoch from (dsc->>'a')::time - (dsc->>'de')::time), 0), 1))
            from c, jsonb_array_elements(coalesce(c.v->'descansos', '[]'::jsonb)) dsc), 0)
      )::numeric / 3600, 4)
      from generate_series((p_desde at time zone 'America/Mexico_City')::date,
                           (p_hasta at time zone 'America/Mexico_City')::date, interval '1 day') g(d)
      cross join lateral ventana_habil(g.d::date) w
      where w.fin > p_desde and w.inicio < p_hasta), 0)
  end
$$;
revoke execute on function public.horas_trabajadas(timestamptz, timestamptz) from public, anon;
grant execute on function public.horas_trabajadas(timestamptz, timestamptz) to authenticated;

-- La gerencia de producción elige el modo (configuracion solo la escribe sistemas).
create or replace function public.poner_modo_horas(p_modo text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not puede('produccion', 3) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  if p_modo not in ('horario', 'terminal') then raise exception 'Modo desconocido: %', p_modo; end if;
  update configuracion set valor = jsonb_set(valor, '{modo}', to_jsonb(p_modo)) where clave = 'horas_taller';
end $$;
revoke execute on function public.poner_modo_horas(text) from public, anon;
grant execute on function public.poner_modo_horas(text) to authenticated;

-- Horas hombre de una orden (mismo cuerpo que en 142).

-- Horas hombre de una orden por etapa, con quién trabajó y cuánto (incluye lo abierto hasta ahora).
create or replace function public.horas_hombre_orden(p_orden uuid)
returns table (operacion_id uuid, etapa text, etapa_orden int, horas_estimadas numeric, horas_reales numeric, horas_sin_nombre numeric,
               personas jsonb)
language plpgsql stable security definer set search_path = public as $$
begin
  if not puede('produccion', 1) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  return query
  select x.id, et.nombre, et.orden, x.horas_estimadas,
    round(coalesce(sum(horas_trabajadas(t.inicio, coalesce(t.fin, now())) * t.personas), 0)::numeric, 2),
    round(coalesce(sum(horas_trabajadas(t.inicio, coalesce(t.fin, now())) * t.personas) filter (where t.empleado_id is null), 0)::numeric, 2),
    coalesce((select jsonb_agg(jsonb_build_object('tiempo_id', y.id, 'nombre', coalesce(e.nombre, y.personas || ' sin nombre'),
                                                  'horas', round((horas_trabajadas(y.inicio, coalesce(y.fin, now())) * y.personas)::numeric, 2),
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
revoke execute on function public.horas_hombre_orden(uuid) from public, anon;
grant execute on function public.horas_hombre_orden(uuid) to authenticated;

-- El piso (mismo cuerpo que en 161): horas_reales con las horas trabajadas.
-- El piso (terminal y TV): la cuadrilla y lo que lleva la etapa, como columnas nuevas al final.
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
    coalesce(hh.horas, 0)::numeric(10,2) AS horas_reales,
    CASE WHEN x.estado = ANY (ARRAY['en_proceso'::estado_operacion, 'pausada'::estado_operacion]) THEN cuadrilla_de(x.id) END AS cuadrilla,
    x.avance AS avance_etapa
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
     LEFT JOIN LATERAL ( SELECT sum(horas_trabajadas(ti.inicio, coalesce(ti.fin, now())) * ti.personas) AS horas
           FROM op_tiempos ti
          WHERE ti.operacion_id = x.id) hh ON true
  WHERE (t.estado = ANY (ARRAY['liberada'::estado_op, 'en_proceso'::estado_op])) AND x.estado <> 'terminada'::estado_operacion AND NOT (EXISTS ( SELECT 1
           FROM ordenes_produccion oe
          WHERE oe.id = x.orden_id AND oe.en_espera_motivo IS NOT NULL));

-- Métricas (mismo cuerpo que en 155): horas hombre, horas con alguien trabajando y tiempo en el
-- taller, todas con las horas trabajadas para que la eficiencia compare lo mismo con lo mismo.
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
    (select sum(horas_trabajadas(t.inicio, coalesce(t.fin, now())) * t.personas) from op_tiempos t where t.operacion_id = x.id) hh,
    (select sum(horas_trabajadas(lower(rr), upper(rr)))
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
        'eficiencia_flujo', (select round((100 * sum(rl.horas) / nullif(sum(horas_trabajadas(p.liberada_en, p.terminada_en)), 0))::numeric, 1)
                             from (select * from _ops where con_tiempos) p join lateral (
                               select sum(horas_trabajadas(lower(rr), upper(rr))) horas
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
          'horas', round(sum(horas_trabajadas(greatest(t.inicio, d0), least(coalesce(t.fin, now()), d1)) * t.personas)::numeric, 1),
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
                        (select sum(horas_trabajadas(t.inicio, coalesce(t.fin, now())) * t.personas) from op_tiempos t where t.orden_id = p.id) hh
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

-- El plan del Gantt (mismo cuerpo que en 162): lo que falta descuenta las horas trabajadas.
create or replace function public.plan_produccion()
returns table (operacion_id uuid, orden_id uuid, etapa_id int, estado estado_operacion, horas_estimadas numeric,
               horas_restantes numeric, gente int, inicio_real timestamptz, fin_real timestamptz,
               inicio_plan date, fin_plan date, posicion int)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare
  v_hoy date := hoy_mx();
  v_dia date;
  -- Arreglos de las etapas por planear, en el orden en que el taller las toma.
  a_op uuid[]; a_et int[]; a_rem numeric[]; a_rate numeric[]; a_pred int[]; a_ini date[]; a_fin date[]; a_activa boolean[];
  e_id int[]; e_cap numeric[]; v_disp numeric[];
  n int; i int; k int; v_pend int; v_toma numeric; v_ei int; v_horas boolean;
begin
  -- Las fechas las ve quien ve producción (el vendedor, en su pedido); las horas, solo la planta.
  if not (puede('produccion', 1) or puede('procesos', 1)) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  v_horas := puede('produccion', 2) or puede('procesos', 1);

  select array_agg(id order by orden), array_agg(capacidad_horas_semana / 5.0 order by orden)
  into e_id, e_cap from etapas where activa and capacidad_horas_semana > 0;

  -- Lo pendiente de las órdenes abiertas, con lo que falta y la velocidad de su cuadrilla.
  drop table if exists _plan;
  create temp table _plan on commit drop as
  with ops as (
    select x.id, x.orden_id, x.etapa_id, et.orden etapa_orden, x.estado, x.horas_estimadas, x.turno, x.avance,
      o.prioridad, o.fecha_compromiso, o.folio,
      coalesce((select sum(horas_trabajadas(t.inicio, coalesce(t.fin, now())) * t.personas) from op_tiempos t where t.operacion_id = x.id), 0) hh,
      greatest((select count(*) from op_asignaciones a where a.operacion_id = x.id),
               (select coalesce(sum(t.personas), 0) from op_tiempos t where t.operacion_id = x.id and t.fin is null))::int gente
    from op_operaciones x join ordenes_produccion o on o.id = x.orden_id join etapas et on et.id = x.etapa_id
    where o.estado in ('planeada', 'liberada', 'en_proceso') and o.en_espera_motivo is null and x.estado <> 'terminada'
      and et.activa and et.capacidad_horas_semana > 0
  )
  select ops.*,
    -- Lo que falta: si el piso dijo cuánto lleva, eso manda; si no, lo estimado menos lo marcado.
    case when estado not in ('en_proceso', 'pausada') then horas_estimadas
         when avance is not null then greatest(horas_estimadas * (1 - avance), horas_estimadas * 0.05)
         else greatest(horas_estimadas - hh, horas_estimadas * 0.15) end rem,
    row_number() over (order by (estado in ('en_proceso', 'pausada')) desc, turno nulls last, prioridad, fecha_compromiso nulls last, folio, etapa_orden) n
  from ops;

  -- El renglón de cada orden: el turno de la etapa en la que va (la primera sin terminar).
  drop table if exists _pos;
  create temp table _pos on commit drop as
  select o.id orden_id, row_number() over (order by
      (select x.turno from op_operaciones x join etapas et on et.id = x.etapa_id
       where x.orden_id = o.id and x.estado <> 'terminada' order by et.orden limit 1) nulls last,
      o.prioridad, o.fecha_compromiso nulls last, o.folio)::int posicion
  from ordenes_produccion o
  where o.estado in ('planeada', 'liberada', 'en_proceso') and o.en_espera_motivo is null;

  select array_agg(id order by n), array_agg(etapa_id order by n), array_agg(rem order by n),
         array_agg(least(greatest(gente, 2) * 9.0, 1e9) order by n),
         array_agg(estado in ('en_proceso', 'pausada') order by n)
  into a_op, a_et, a_rem, a_rate, a_activa from _plan;
  n := coalesce(array_length(a_op, 1), 0);
  a_ini := array_fill(null::date, array[greatest(n, 1)]);
  a_fin := array_fill(null::date, array[greatest(n, 1)]);
  -- La etapa anterior pendiente de la misma orden (la cadena basta: esa a su vez espera la suya).
  a_pred := array_fill(0, array[greatest(n, 1)]);
  for i in 1..n loop
    select coalesce((select p2.n from _plan p1 join _plan p2 on p2.orden_id = p1.orden_id and p2.etapa_orden < p1.etapa_orden
                     where p1.id = a_op[i] order by p2.etapa_orden desc limit 1), 0)::int into k;
    -- p2.n es la posición en los arreglos (están en el mismo orden que n).
    a_pred[i] := k;
    -- Sin horas que hacer: queda lista en cuanto puede empezar.
    if a_rem[i] <= 0 then a_rem[i] := 0; end if;
  end loop;

  v_pend := n;
  v_dia := v_hoy;
  while v_pend > 0 and v_dia < v_hoy + 730 loop
    if extract(isodow from v_dia) <= 5 then
      v_disp := e_cap;
      for i in 1..n loop
        continue when a_fin[i] is not null;
        -- Puede trabajarse si ya está en proceso o si su etapa anterior terminó antes de hoy.
        continue when not a_activa[i] and a_pred[i] > 0 and (a_fin[a_pred[i]] is null or a_fin[a_pred[i]] >= v_dia);
        v_ei := array_position(e_id, a_et[i]);
        if a_rem[i] <= 0 then
          a_ini[i] := coalesce(a_ini[i], v_dia); a_fin[i] := v_dia; v_pend := v_pend - 1;
          continue;
        end if;
        continue when v_disp[v_ei] <= 0;
        v_toma := least(a_rem[i], a_rate[i], v_disp[v_ei]);
        a_rem[i] := a_rem[i] - v_toma;
        v_disp[v_ei] := v_disp[v_ei] - v_toma;
        a_ini[i] := coalesce(a_ini[i], v_dia);
        if a_rem[i] <= 0.0001 then a_fin[i] := v_dia; v_pend := v_pend - 1; end if;
      end loop;
    end if;
    v_dia := v_dia + 1;
  end loop;

  return query
  select z.operacion_id, z.orden_id, z.etapa_id, z.estado,
    case when v_horas then z.horas_estimadas end, case when v_horas then z.horas_restantes end, case when v_horas then z.gente end,
    z.inicio_real, z.fin_real, z.inicio_plan, z.fin_plan, z.posicion
  from (
  -- Lo planeado.
  select p.id, p.orden_id, p.etapa_id, p.estado, p.horas_estimadas, round(p.rem, 1), greatest(p.gente, 0),
    x.inicio, null::timestamptz, a_ini[p.n::int], a_fin[p.n::int], s.posicion
  from _plan p join op_operaciones x on x.id = p.id left join _pos s on s.orden_id = p.orden_id
  union all
  -- Lo ya terminado de las órdenes abiertas (para dibujar lo que ya pasó).
  select x.id, x.orden_id, x.etapa_id, x.estado, x.horas_estimadas, 0::numeric, 0, x.inicio, x.fin, null::date, null::date, s.posicion
  from op_operaciones x join ordenes_produccion o on o.id = x.orden_id left join _pos s on s.orden_id = o.id
  where o.estado in ('planeada', 'liberada', 'en_proceso') and x.estado = 'terminada'
  union all
  -- Las órdenes en espera: sus etapas, sin plan ni renglón (van al final).
  select x.id, x.orden_id, x.etapa_id, x.estado, x.horas_estimadas, x.horas_estimadas, 0, x.inicio, x.fin, null::date, null::date, null::int
  from op_operaciones x join ordenes_produccion o on o.id = x.orden_id
  where o.estado in ('planeada', 'liberada', 'en_proceso') and o.en_espera_motivo is not null and x.estado <> 'terminada'
  ) z (operacion_id, orden_id, etapa_id, estado, horas_estimadas, horas_restantes, gente, inicio_real, fin_real, inicio_plan, fin_plan, posicion);
end $$;
revoke execute on function public.plan_produccion() from public, anon;
grant execute on function public.plan_produccion() to authenticated;

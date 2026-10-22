-- =============================================================================
-- Métricas de mantenimiento.
--
-- Mantenimiento ya captura lo necesario (fallas, cuándo se paró y volvió cada máquina,
-- preventivos con su fecha, horas del técnico, costos), pero nada lo resumía: para saber
-- si el preventivo funciona o qué máquina conviene cambiar había que contar a mano.
--
-- Todo en horas de calendario (la máquina parada de viernes a lunes estuvo parada 72 h),
-- igual que se captura el tiempo fuera de servicio.
--   disponibilidad = 1 − horas fuera de servicio ÷ horas del periodo
--   MTBF           = horas operando ÷ fallas (correctivos reportados)
--   MTTR           = de que se reporta la falla a que se cierra la orden (promedio)
--   cumplimiento   = preventivos que vencían en el periodo y se hicieron a tiempo
--   reincidencia   = la misma máquina vuelve a fallar a menos de 30 días de una reparación
-- Los costos (refacciones, servicios externos) solo los ve quien tiene costos.
-- =============================================================================

create or replace function public.metricas_mantenimiento(p_desde date, p_hasta date)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  d0 timestamptz := p_desde::timestamp at time zone 'America/Mexico_City';
  d1 timestamptz := least((p_hasta + 1)::timestamp at time zone 'America/Mexico_City', now());
  v_horas numeric := greatest(extract(epoch from d1 - d0) / 3600, 1);
  v_costos boolean := puede('costos', 1);
  r jsonb;
begin
  if not (puede('mantenimiento', 1) or puede('procesos', 1)) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  if p_hasta < p_desde then raise exception 'El periodo está al revés'; end if;

  -- Por máquina: lo que falló y cuánto estuvo fuera dentro del periodo.
  drop table if exists _maq;
  create temp table _maq on commit drop as
  select m.id, m.numero, m.nombre, m.categoria, m.tipo, m.criticidad, m.critica, m.estado, et.nombre area,
    (select count(*) from ordenes_mantenimiento o where o.maquina_id = m.id and o.tipo = 'correctivo' and o.estado <> 'cancelada'
       and o.reportado_en >= d0 and o.reportado_en < d1)::int fallas,
    coalesce((select sum(greatest(extract(epoch from least(coalesce(o.fuera_hasta, now()), d1) - greatest(o.fuera_desde, d0)) / 3600, 0))
       from ordenes_mantenimiento o where o.maquina_id = m.id and o.estado <> 'cancelada' and o.fuera_desde is not null and o.fuera_desde < d1
         and coalesce(o.fuera_hasta, now()) > d0), 0) horas_fuera,
    (select avg(extract(epoch from o.cerrada_en - o.reportado_en) / 3600) from ordenes_mantenimiento o
       where o.maquina_id = m.id and o.tipo = 'correctivo' and o.estado = 'cerrada' and o.cerrada_en >= d0 and o.cerrada_en < d1) mttr,
    (select count(*) from ordenes_mantenimiento o where o.maquina_id = m.id and o.tipo = 'preventivo' and o.estado <> 'cancelada'
       and o.vence between p_desde and p_hasta)::int prev_programados,
    (select count(*) from ordenes_mantenimiento o where o.maquina_id = m.id and o.tipo = 'preventivo' and o.estado = 'cerrada'
       and o.vence between p_desde and p_hasta and (o.cerrada_en at time zone 'America/Mexico_City')::date <= o.vence)::int prev_a_tiempo
  from maquinas m left join etapas et on et.id = m.etapa_id
  -- Herramienta también: las soldadoras están dadas de alta como herramienta y son críticas.
  where m.estado <> 'baja';

  select jsonb_build_object(
    'periodo', jsonb_build_object('desde', p_desde, 'hasta', p_hasta, 'horas', round(v_horas, 1)),
    'con_costos', v_costos,
    'resumen', jsonb_build_object(
      'maquinas', (select count(*) from _maq),
      -- Paradas ahorita: con una orden abierta que la detiene (igual que el estado de Máquinas).
      'paradas_ahora', (select count(distinct o.maquina_id) from ordenes_mantenimiento o join _maq q on q.id = o.maquina_id
                        where o.estado in ('pendiente', 'en_proceso') and o.detiene),
      'disponibilidad', (select round(1 - sum(horas_fuera) / nullif(count(*) * v_horas, 0), 4) from _maq),
      'disponibilidad_criticas', (select round(1 - sum(horas_fuera) / nullif(count(*) * v_horas, 0), 4) from _maq
                                  where critica or criticidad in ('muy_alta', 'alta')),
      'fallas', (select sum(fallas) from _maq),
      'horas_fuera', (select round(sum(horas_fuera)::numeric, 1) from _maq),
      'mtbf_h', (select round(((count(*) * v_horas - sum(horas_fuera)) / nullif(sum(fallas), 0))::numeric, 0) from _maq),
      'mttr_h', (select round(avg(extract(epoch from o.cerrada_en - o.reportado_en) / 3600)::numeric, 1) from ordenes_mantenimiento o
                 where o.tipo = 'correctivo' and o.estado = 'cerrada' and o.cerrada_en >= d0 and o.cerrada_en < d1),
      'paro_por_falla_h', (select round(avg(extract(epoch from o.fuera_hasta - o.fuera_desde) / 3600)::numeric, 1) from ordenes_mantenimiento o
                           where o.tipo = 'correctivo' and o.fuera_hasta is not null and o.fuera_desde is not null
                             and o.fuera_hasta >= d0 and o.fuera_hasta < d1),
      'prev_programados', (select sum(prev_programados) from _maq),
      'prev_a_tiempo', (select sum(prev_a_tiempo) from _maq),
      'prev_tarde', (select count(*) from ordenes_mantenimiento o where o.tipo = 'preventivo' and o.estado = 'cerrada'
                     and o.vence between p_desde and p_hasta and (o.cerrada_en at time zone 'America/Mexico_City')::date > o.vence),
      'prev_vencidos', (select count(*) from ordenes_mantenimiento o where o.tipo = 'preventivo' and o.estado in ('pendiente', 'en_proceso')
                        and o.vence < hoy_mx()),
      'horas_preventivo', (select round(coalesce(sum(horas_trabajadas), 0)::numeric, 1) from ordenes_mantenimiento
                           where tipo = 'preventivo' and estado = 'cerrada' and cerrada_en >= d0 and cerrada_en < d1),
      'horas_correctivo', (select round(coalesce(sum(horas_trabajadas), 0)::numeric, 1) from ordenes_mantenimiento
                           where tipo = 'correctivo' and estado = 'cerrada' and cerrada_en >= d0 and cerrada_en < d1),
      'abiertas', (select count(*) from ordenes_mantenimiento where estado in ('pendiente', 'en_proceso')),
      'abiertas_dias', (select round(avg(extract(epoch from now() - reportado_en) / 86400)::numeric, 1) from ordenes_mantenimiento
                        where estado in ('pendiente', 'en_proceso') and tipo = 'correctivo'),
      'costo', case when v_costos then (select coalesce(sum(c.monto), 0) from costos_servicio c join ordenes_mantenimiento o on o.id = c.mantenimiento_id
                                         where c.en >= d0 and c.en < d1) end),

    -- Todas las máquinas con sus números (la tabla de la pantalla y el Pareto salen de aquí).
    'maquinas', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', id, 'numero', numero, 'nombre', nombre, 'categoria', categoria, 'area', area, 'criticidad', criticidad, 'critica', critica, 'estado', estado,
        'fallas', fallas, 'horas_fuera', round(horas_fuera::numeric, 1),
        'disponibilidad', round(1 - horas_fuera / v_horas, 4),
        'mtbf_h', case when fallas > 0 then round(((v_horas - horas_fuera) / fallas)::numeric, 0) end,
        'mttr_h', round(mttr::numeric, 1),
        'prev_programados', prev_programados, 'prev_a_tiempo', prev_a_tiempo,
        'costo', case when v_costos then (select coalesce(sum(c.monto), 0) from costos_servicio c join ordenes_mantenimiento o on o.id = c.mantenimiento_id
                                          where o.maquina_id = q.id and c.en >= d0 and c.en < d1) end
      ) order by horas_fuera desc, fallas desc, numero), '[]') from _maq q),

    -- Reincidencias: una falla a menos de 30 días de haber cerrado otra de la misma máquina.
    'reincidencias', (select coalesce(jsonb_agg(jsonb_build_object('folio', o.folio, 'maquina', m.numero || ' · ' || m.nombre, 'reportada', o.reportado_en,
        'falla', o.falla, 'dias', round((extract(epoch from o.reportado_en - p.cerrada_en) / 86400)::numeric, 0), 'anterior', p.folio, 'anterior_falla', p.falla)
        order by o.reportado_en desc), '[]')
      from ordenes_mantenimiento o join maquinas m on m.id = o.maquina_id
      join lateral (select x.* from ordenes_mantenimiento x where x.maquina_id = o.maquina_id and x.id <> o.id and x.tipo = 'correctivo'
                    and x.estado = 'cerrada' and x.cerrada_en <= o.reportado_en and x.cerrada_en > o.reportado_en - interval '30 days'
                    order by x.cerrada_en desc limit 1) p on true
      where o.tipo = 'correctivo' and o.estado <> 'cancelada' and o.reportado_en >= d0 and o.reportado_en < d1),

    -- Lo abierto, de lo más viejo a lo más nuevo.
    'pendientes', (select coalesce(jsonb_agg(jsonb_build_object('id', o.id, 'folio', o.folio, 'maquina', m.numero || ' · ' || m.nombre, 'tipo', o.tipo,
        'estado', o.estado, 'detiene', o.detiene, 'falla', o.falla, 'vence', o.vence,
        'dias', round((extract(epoch from now() - o.reportado_en) / 86400)::numeric, 0)) order by o.reportado_en), '[]')
      from (select * from ordenes_mantenimiento where estado in ('pendiente', 'en_proceso') order by reportado_en limit 30) o
      join maquinas m on m.id = o.maquina_id),

    -- Horas del técnico por persona (quién la atendió) y por tipo.
    'tecnicos', (select coalesce(jsonb_agg(t order by (t->>'horas')::numeric desc), '[]') from (
        select jsonb_build_object('quien', coalesce(nullif(trim(o.atendido_por), ''), 'Sin anotar'),
          'horas', round(coalesce(sum(o.horas_trabajadas), 0)::numeric, 1),
          'preventivas', count(*) filter (where o.tipo = 'preventivo'), 'correctivas', count(*) filter (where o.tipo = 'correctivo')) t
        from ordenes_mantenimiento o
        where o.estado = 'cerrada' and o.cerrada_en >= d0 and o.cerrada_en < d1
        group by coalesce(nullif(trim(o.atendido_por), ''), 'Sin anotar')) z),

    -- Fallas por semana (para ver si bajan).
    'semanas', (select coalesce(jsonb_agg(jsonb_build_object('semana', g::date,
        'correctivas', (select count(*) from ordenes_mantenimiento o where o.tipo = 'correctivo' and o.estado <> 'cancelada'
                        and (o.reportado_en at time zone 'America/Mexico_City')::date between g::date and g::date + 6),
        'preventivas', (select count(*) from ordenes_mantenimiento o where o.tipo = 'preventivo' and o.estado = 'cerrada'
                        and (o.cerrada_en at time zone 'America/Mexico_City')::date between g::date and g::date + 6)) order by g), '[]')
      from generate_series(date_trunc('week', p_desde::timestamp), p_hasta::timestamp, interval '7 days') g)
  ) into r;
  return r;
end $$;
revoke execute on function public.metricas_mantenimiento(date, date) from public, anon;
grant execute on function public.metricas_mantenimiento(date, date) to authenticated;

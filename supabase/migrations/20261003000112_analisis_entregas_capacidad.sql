-- =============================================================================
-- Análisis de dirección: cumplimiento de entregas y lo prometido contra lo que
-- cabe en el taller.
--
-- Por qué: el problema de Hegamex no es cuánto tarda un equipo, es que se promete
-- más de lo que el taller saca (al 16 de octubre de 2026 pailería traía unas 22
-- semanas de trabajo encima). Hasta hoy nadie veía, antes de que pasara, qué
-- pedido iba a llegar tarde, ni cuánto trabajo se había prometido para cada mes.
--
-- 1. analisis_promesas(): cada orden abierta con fecha compromiso, en la fila del
--    taller por orden de compromiso (y prioridad). Termina cuando su etapa más
--    cargada acaba lo que hay antes que ella más lo suyo. Si eso cae después del
--    compromiso, la promesa está en riesgo, con cuántos días. No usa
--    estimar_entrega (que pone el equipo al final y contaría dos veces sus horas).
-- 2. analisis_entregas(desde, hasta): a tiempo y días de atraso de los pedidos con
--    compromiso en el periodo, por mes y por vendedor, y de las órdenes del taller
--    por familia (la misma regla que el indicador "entregas a tiempo": una abierta
--    solo cuenta cuando ya venció).
-- 3. analisis_capacidad(meses): en semanas de la etapa cuello de botella, el
--    trabajo prometido para cada mes (por fecha compromiso) contra lo que cabe en
--    el mes, y lo que entra y sale del taller cada mes desde el arranque.
-- 4. hallazgos_entregas(): los avisos de "Lo que importa hoy".
-- Ventas (gerencia) entra al análisis: todo va en fechas, días y semanas, nunca
-- horas de un equipo ni costos.
-- =============================================================================

create or replace function public.analisis_promesas()
returns table (orden_id uuid, orden text, equipo text, pedido_id uuid, pedido text, cliente text, vendedor text,
               compromiso date, estimada date, dias int, estado text, cuello text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not (puede('analisis', 1) or puede('produccion', 3)) then
    raise exception 'El análisis de dirección no está en tu rol.' using errcode = '42501';
  end if;
  return query
  with abiertas as (
    select o.id, o.folio, o.fecha_compromiso, o.prioridad, o.pedido_id, o.articulo_id, o.estado
    from ordenes_produccion o where o.estado in ('planeada', 'liberada', 'en_proceso')
  ), ph as (
    select a.id, a.fecha_compromiso, a.prioridad, a.folio, x.etapa_id, sum(x.horas_estimadas) h
    from abiertas a join op_operaciones x on x.orden_id = a.id and x.estado <> 'terminada'
    group by 1, 2, 3, 4, 5
  ), acum as (
    -- Primero lo que se prometió antes; sin compromiso, al final.
    select ph.id, ph.etapa_id,
      sum(ph.h) over (partition by ph.etapa_id order by ph.fecha_compromiso nulls last, ph.prioridad, ph.folio rows unbounded preceding) cum
    from ph
  ), sem as (
    select acum.id, max(acum.cum / e.capacidad_horas_semana) semanas,
      (array_agg(e.nombre order by acum.cum / e.capacidad_horas_semana desc))[1] cuello
    from acum join etapas e on e.id = acum.etapa_id
    where e.activa and e.capacidad_horas_semana > 0
    group by 1
  ), est as (
    select a.*, s.cuello, sumar_dias_habiles(hoy_planta(), ceil(coalesce(s.semanas, 0) * 5)::int) estimada
    from abiertas a left join sem s on s.id = a.id
  )
  select est.id, est.folio, ar.nombre, est.pedido_id, coalesce(p.id_externo, p.folio), c.nombre, pf.nombre,
    est.fecha_compromiso, est.estimada, (est.estimada - est.fecha_compromiso)::int, est.estado::text, est.cuello
  from est
  join articulos ar on ar.id = est.articulo_id
  left join pedidos p on p.id = est.pedido_id
  left join clientes c on c.id = p.cliente_id
  left join perfiles pf on pf.id = p.vendedor_id
  where est.fecha_compromiso is not null
  order by (est.estimada - est.fecha_compromiso) desc, est.fecha_compromiso;
end $$;
revoke execute on function public.analisis_promesas() from public, anon;
grant execute on function public.analisis_promesas() to authenticated;

create or replace function public.analisis_entregas(p_desde date, p_hasta date)
returns jsonb language plpgsql stable security invoker set search_path = public as $$
declare v_hoy date := hoy_planta(); r jsonb;
begin
  perform exigir_analisis(1);
  with p as (
    -- Se juzga lo entregado y lo que ya venció sin entregarse; lo que todavía puede llegar a tiempo, no.
    select p.id, p.vendedor_id, p.fecha_compromiso f, (p.entregado_en at time zone 'America/Mexico_City')::date e
    from pedidos p
    where p.estado <> 'cancelado' and p.fecha_compromiso between p_desde and p_hasta
      and (p.entregado_en is not null or p.fecha_compromiso < v_hoy)
  ), y as (select p.*, coalesce(p.e, v_hoy) - p.f atraso from p),
  o as (
    select coalesce(fv.nombre, 'Sin familia') familia, o.fecha_compromiso f,
      coalesce((o.terminada_en at time zone 'America/Mexico_City')::date, v_hoy) - o.fecha_compromiso atraso
    from ordenes_produccion o
    join articulos a on a.id = o.articulo_id
    left join familia_categoria fc on fc.categoria_id = a.categoria_id
    left join familias_venta fv on fv.clave = fc.familia
    where o.estado <> 'cancelada' and o.fecha_compromiso between p_desde and p_hasta
      and (o.terminada_en is not null or o.fecha_compromiso < v_hoy)
  )
  select jsonb_build_object(
    'pedidos', (select jsonb_build_object(
        'juzgados', count(*), 'a_tiempo', count(*) filter (where y.e is not null and y.atraso <= 0),
        'tarde', count(*) filter (where y.atraso > 0), 'vencidos_abiertos', count(*) filter (where y.e is null),
        'dias_atraso', round(avg(y.atraso) filter (where y.atraso > 0), 1)) from y),
    'por_mes', coalesce((select jsonb_agg(x order by x.mes) from (
        select date_trunc('month', y.f)::date mes, count(*) juzgados, count(*) filter (where y.e is not null and y.atraso <= 0) a_tiempo,
          round(avg(y.atraso) filter (where y.atraso > 0), 1) dias_atraso
        from y group by 1) x), '[]'::jsonb),
    'por_vendedor', coalesce((select jsonb_agg(x order by x.juzgados desc) from (
        select coalesce(pf.nombre, 'Sin vendedor') vendedor, count(*) juzgados,
          count(*) filter (where y.e is not null and y.atraso <= 0) a_tiempo, round(avg(y.atraso) filter (where y.atraso > 0), 1) dias_atraso
        from y left join perfiles pf on pf.id = y.vendedor_id group by 1) x), '[]'::jsonb),
    'por_familia', coalesce((select jsonb_agg(x order by x.juzgadas desc) from (
        select o.familia, count(*) juzgadas, count(*) filter (where o.atraso <= 0) a_tiempo,
          round(avg(o.atraso) filter (where o.atraso > 0), 1) dias_atraso
        from o group by 1) x), '[]'::jsonb),
    'taller', (select jsonb_build_object('juzgadas', count(*), 'a_tiempo', count(*) filter (where o.atraso <= 0)) from o)
  ) into r;
  return r;
end $$;

create or replace function public.analisis_capacidad(p_meses int default 6)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_hoy date := hoy_planta(); v_mes date := date_trunc('month', hoy_planta())::date;
  v_arranque date := coalesce((select (valor #>> '{}')::date from configuracion where clave = 'fecha_arranque'), hoy_planta());
  v_etapa int; v_nombre text; v_cap numeric; r jsonb;
begin
  if not (puede('analisis', 1) or puede('produccion', 3)) then
    raise exception 'El análisis de dirección no está en tu rol.' using errcode = '42501';
  end if;
  -- La etapa que manda: la que más semanas de trabajo pendiente tiene.
  select e.id, e.nombre, e.capacidad_horas_semana into v_etapa, v_nombre, v_cap
  from etapas e
  join op_operaciones x on x.etapa_id = e.id and x.estado <> 'terminada'
  join ordenes_produccion o on o.id = x.orden_id and o.estado in ('planeada', 'liberada', 'en_proceso')
  where e.activa and e.capacidad_horas_semana > 0
  group by e.id order by sum(x.horas_estimadas) / e.capacidad_horas_semana desc limit 1;
  if v_etapa is null then
    return jsonb_build_object('cuello', null, 'meses', '[]'::jsonb, 'historia', '[]'::jsonb, 'semanas_cola', 0);
  end if;

  with pend as (
    select o.fecha_compromiso f, sum(x.horas_estimadas) / v_cap semanas
    from ordenes_produccion o join op_operaciones x on x.orden_id = o.id and x.etapa_id = v_etapa and x.estado <> 'terminada'
    where o.estado in ('planeada', 'liberada', 'en_proceso')
    group by o.id, o.fecha_compromiso
  ), meses as (
    select (v_mes + make_interval(months => g))::date mes from generate_series(0, greatest(p_meses, 1) - 1) g
  ), cap as (
    -- Lo que cabe en el mes: sus días hábiles (lunes a viernes) que quedan, en semanas.
    select m.mes, (select count(*) from generate_series(greatest(m.mes, v_hoy), (m.mes + interval '1 month - 1 day')::date, interval '1 day') d
                   where extract(isodow from d) < 6) / 5.0 semanas
    from meses m
  ), por_mes as (
    select c.mes, c.semanas capacidad,
      -- Lo que ya venció va aparte ("vencido"): en cada mes, solo lo que todavía no vence.
      coalesce((select sum(p.semanas) from pend p where date_trunc('month', p.f) = c.mes and p.f >= v_hoy), 0) prometido
    from cap c
  )
  select jsonb_build_object(
    'cuello', v_nombre,
    'semanas_cola', round((select sum(semanas) from pend), 1),
    'vencido', round(coalesce((select sum(semanas) from pend where f < v_hoy), 0), 1),
    'sin_fecha', round(coalesce((select sum(semanas) from pend where f is null), 0), 1),
    'despues', round(coalesce((select sum(semanas) from pend where f >= (v_mes + make_interval(months => greatest(p_meses, 1)))::date), 0), 1),
    -- Con lo que ya venció adelante, cuándo se pondría al día el taller si no entrara nada más.
    'al_dia', sumar_dias_habiles(v_hoy, ceil(coalesce((select sum(semanas) from pend), 0) * 5)::int),
    'meses', coalesce((select jsonb_agg(jsonb_build_object('mes', pm.mes, 'prometido', round(pm.prometido, 1),
        'capacidad', round(pm.capacidad, 1)) order by pm.mes) from por_mes pm), '[]'::jsonb),
    -- Lo que entra (órdenes nuevas) y sale (etapas terminadas) cada mes desde el arranque.
    -- Lo que se cargó de la hoja de producción al arrancar no "entró" ese mes: ya estaba.
    'historia', coalesce((select jsonb_agg(jsonb_build_object('mes', h.mes, 'entra', round(h.entra, 1), 'sale', round(h.sale, 1)) order by h.mes) from (
        select m.mes,
          coalesce((select sum(x.horas_estimadas) / v_cap from ordenes_produccion o join op_operaciones x on x.orden_id = o.id and x.etapa_id = v_etapa
                    where date_trunc('month', o.creado_en at time zone 'America/Mexico_City') = m.mes and o.estado <> 'cancelada'
                      and coalesce(o.notas, '') not like 'Cargada de «fabricación de equipos»%'), 0) entra,
          coalesce((select sum(x.horas_estimadas) / v_cap from op_operaciones x
                    where x.etapa_id = v_etapa and x.estado = 'terminada' and x.fin is not null
                      and date_trunc('month', x.fin at time zone 'America/Mexico_City') = m.mes
                      and not exists (select 1 from ordenes_produccion o where o.id = x.orden_id
                                      and coalesce(o.notas, '') like 'Cargada de «fabricación de equipos»%'
                                      and date_trunc('day', x.fin) = date_trunc('day', o.creado_en))), 0) sale
        from (select generate_series(date_trunc('month', v_arranque), v_mes, interval '1 month')::date mes) m) h), '[]'::jsonb)
  ) into r;
  return r;
end $$;
revoke execute on function public.analisis_capacidad(int) from public, anon;
grant execute on function public.analisis_capacidad(int) to authenticated;

create or replace function public.hallazgos_entregas(p_area text)
returns table (area text, tono text, titulo text, detalle text, ruta text, peso int)
language plpgsql stable security invoker set search_path = public as $$
declare v_n int; v_peor record; c jsonb; v_mes jsonb;
begin
  if not (puede('analisis', 1) or puede('produccion', 3)) or coalesce(p_area, 'direccion') not in ('direccion', 'produccion', 'ventas') then
    return;
  end if;
  select count(*) into v_n from analisis_promesas() x where x.dias > 0;
  if v_n > 0 then
    select * into v_peor from analisis_promesas() x where x.dias > 0 order by x.dias desc limit 1;
    -- Área producción: lo ven dirección (todo) y la gerencia de producción.
    return query select 'produccion'::text, case when v_n >= 5 then 'riesgo' else 'atencion' end,
      format('%s %s no %s a tiempo con la fila del taller', v_n, case when v_n = 1 then 'orden' else 'órdenes' end,
             case when v_n = 1 then 'sale' else 'salen' end),
      format('La más lejos: %s%s, prometida para el %s, sale hacia el %s. Hay que avisarle al cliente o mover prioridades.',
             v_peor.equipo, coalesce(' (' || v_peor.cliente || ')', ''), to_char(v_peor.compromiso, 'DD/MM'), to_char(v_peor.estimada, 'DD/MM')),
      '/analisis/entregas'::text, 25;
  end if;
  c := analisis_capacidad(3);
  v_mes := c #> '{meses,0}';
  if v_mes is not null and (v_mes->>'capacidad')::numeric > 0
     and (v_mes->>'prometido')::numeric + (c->>'vencido')::numeric > (v_mes->>'capacidad')::numeric * 1.2 then
    return query select 'produccion'::text, 'atencion'::text,
      format('%s tiene %s semanas prometidas para este mes y le caben %s', c->>'cuello',
             round((v_mes->>'prometido')::numeric + (c->>'vencido')::numeric, 1), v_mes->>'capacidad'),
      format('Incluye %s semanas de lo que ya venció. A este ritmo se pone al día hacia el %s si no entra nada más.',
             c->>'vencido', to_char((c->>'al_dia')::date, 'DD/MM/YYYY')),
      '/analisis/capacidad'::text, 40;
  end if;
end $$;

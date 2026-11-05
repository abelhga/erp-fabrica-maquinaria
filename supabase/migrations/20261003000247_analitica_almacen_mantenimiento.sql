-- Analítica de almacén y mantenimiento (nov 2026). Las métricas de las dos pantallas contaban
-- eventos del periodo (partidas por semana, fallas por semana) pero no contestaban lo que se decide:
-- qué inventario sobra o falta y por qué, qué artículos merecen control fino, qué máquinas paran
-- por crónicas y cuáles por agudas, y cuánta carga de preventivo viene. Todo se calcula aquí; la
-- pantalla solo dibuja.
--
-- Almacén (foto de hoy, no del periodo), sobre reabasto() (12 meses de consumo, hoja + ERP):
--   salud       quiebre (hay demanda y no hay disponible) · bajo el punto de reorden · sano ·
--               exceso (más de dos compras encima del punto de reorden) · esporádico (se mueve pero
--               no alcanza demanda) · sin movimiento (hay existencia y nada salió en 12 meses)
--   ABC         con costos: Pareto del valor consumido en 12 meses (80 % A, 15 % B, 5 % C);
--               sin costos: por rotación, meses con salida de 12 (6+ A, 3-5 B, 1-2 C)
--   XYZ         coeficiente de variación del consumo mensual: ≤ 0.5 X, ≤ 1 Y, > 1 Z
--   cobertura   meses que alcanza lo disponible ÷ la meta de cobertura del artículo
-- Mantenimiento:
--   semanas     disponibilidad (horas laborales), fallas y preventivos a tiempo / tarde por semana
--   carga       preventivos de las próximas 8 semanas, proyectados de cada plan (no solo las
--               órdenes ya generadas, que salen con días de anticipación), por criticidad
--   antigüedad  lo abierto por días desde que se reportó

-- ------------------------------------------------------------------------------------- almacén
create or replace function public.almacen_clasificacion()
returns table(articulo_id uuid, clave text, nombre text, unidad text, categoria text, es_importado boolean,
  en_planta numeric, disponible numeric, demanda_mensual numeric, punto_reorden numeric, lote numeric, meta_meses numeric,
  cobertura_meses numeric, consumo_12 numeric, meses_12 int, cv numeric, costo numeric, valor_12 numeric, valor_stock numeric,
  salud text, abc text, xyz text, consumo_meses numeric[])
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare v_costos boolean := puede('costos', 1);
begin
  if not puede('inventario', 2) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  return query
  with b as (
    select r.articulo_id, r.clave, r.nombre, r.unidad, coalesce(cat.nombre, 'Sin categoría') categoria, r.es_importado,
      r.en_planta, r.disponible, r.demanda_mensual, r.punto_reorden, r.lote, r.meses_cobertura meta, r.estado, r.consumo_meses,
      (select coalesce(sum(v), 0) from unnest(r.consumo_meses) v) c12,
      (select count(*) from unnest(r.consumo_meses) v where v > 0)::int m12,
      (select case when avg(v) > 0 then stddev_pop(v) / avg(v) end from unnest(r.consumo_meses) v) cv,
      -- El costo solo lo trae quien ve costos: sin él, el ABC va por rotación.
      case when v_costos then (select round(ca.costo * tc(ca.moneda), 4) from costos_articulo ca where ca.articulo_id = r.articulo_id) end cu
    from reabasto() r join articulos a on a.id = r.articulo_id left join categorias cat on cat.id = a.categoria_id
  ),
  c as (
    select b.*, b.c12 * coalesce(b.cu, 0) v12,
      case when b.demanda_mensual > 0 then round(greatest(b.disponible, 0) / b.demanda_mensual, 2) end cob,
      case
        when b.en_planta < 0 then 'negativo'
        when b.demanda_mensual > 0 and b.disponible <= 0 then 'quiebre'
        when b.estado = 'ordenar' then 'bajo_reorden'
        when b.demanda_mensual > 0 and b.disponible > b.punto_reorden + 2 * greatest(b.lote, 1) then 'exceso'
        when b.demanda_mensual > 0 then 'sano'
        when b.en_planta > 0 and b.c12 = 0 then 'sin_movimiento'
        when b.en_planta > 0 then 'esporadico'
      end sal
    from b
  ),
  d as (
    select c.*,
      sum(c.v12) over (order by c.v12 desc, c.articulo_id rows between unbounded preceding and current row) - c.v12 antes,
      sum(c.v12) over () total
    from c
  )
  select d.articulo_id, d.clave, d.nombre, d.unidad, d.categoria, d.es_importado, d.en_planta, d.disponible, d.demanda_mensual,
    d.punto_reorden, d.lote, d.meta, d.cob, d.c12, d.m12, round(d.cv, 2), d.cu,
    case when v_costos then round(d.v12, 2) end, case when v_costos then round(greatest(d.en_planta, 0) * coalesce(d.cu, 0), 2) end,
    d.sal,
    case when d.c12 <= 0 then null
         when v_costos and d.total > 0 then case when d.antes < 0.80 * d.total then 'A' when d.antes < 0.95 * d.total then 'B' else 'C' end
         else case when d.m12 >= 6 then 'A' when d.m12 >= 3 then 'B' else 'C' end end,
    case when d.c12 <= 0 then null when d.cv <= 0.5 then 'X' when d.cv <= 1 then 'Y' else 'Z' end,
    d.consumo_meses
  from d;
end $$;
revoke execute on function public.almacen_clasificacion() from public, anon, authenticated;

create or replace function public.almacen_salud() returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_costos boolean := puede('costos', 1); v_mes date := date_trunc('month', hoy_mx())::date; r jsonb;
begin
  if not puede('inventario', 2) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  drop table if exists _cl;
  create temp table _cl on commit drop as select * from almacen_clasificacion();

  select jsonb_build_object(
    'con_costos', v_costos,
    'abc_por', case when v_costos then 'valor' else 'rotacion' end,
    'totales', (select jsonb_build_object('articulos', count(*), 'con_existencia', count(*) filter (where en_planta > 0),
        'con_demanda', count(*) filter (where demanda_mensual > 0), 'con_consumo', count(*) filter (where consumo_12 > 0),
        'valor_stock', case when v_costos then sum(valor_stock) end) from _cl),
    'salud', (select coalesce(jsonb_agg(jsonb_build_object('clase', salud, 'articulos', n, 'valor', v)), '[]')
      from (select salud, count(*) n, case when v_costos then round(sum(valor_stock), 0) end v from _cl where salud is not null group by salud) x),
    'matriz', (select coalesce(jsonb_agg(jsonb_build_object('abc', abc, 'xyz', xyz, 'articulos', n, 'valor_12', v,
        'disponible_valor', s)), '[]')
      from (select abc, xyz, count(*) n, case when v_costos then round(sum(valor_12), 0) end v,
                   case when v_costos then round(sum(valor_stock), 0) end s
            from _cl where abc is not null group by abc, xyz) x),
    -- Meses que alcanza lo disponible contra la meta de cada artículo (1 nacional, 6 importado…).
    'cobertura', (select coalesce(jsonb_agg(jsonb_build_object('rango', rango, 'importado', es_importado, 'articulos', n)), '[]')
      from (select case when cobertura_meses <= 0 then 'sin'
                        when cobertura_meses / nullif(meta_meses, 0) < 0.5 then 'menos_mitad'
                        when cobertura_meses / nullif(meta_meses, 0) < 1 then 'debajo'
                        when cobertura_meses / nullif(meta_meses, 0) <= 2 then 'meta'
                        when cobertura_meses / nullif(meta_meses, 0) <= 4 then 'arriba'
                        else 'muy_arriba' end rango, es_importado, count(*) n
            from _cl where demanda_mensual > 0 group by 1, 2) x),
    -- Los últimos 12 meses cerrados: cuántos artículos tuvieron salida y, con costos, cuánto valor salió.
    'meses', (select jsonb_agg(jsonb_build_object('mes', (v_mes - make_interval(months => 13 - i))::date,
        'articulos', (select count(*) from _cl where consumo_meses[i] > 0),
        'valor', case when v_costos then (select round(sum(consumo_meses[i] * coalesce(costo, 0)), 0) from _cl) end) order by i)
      from generate_series(1, 12) i)
  ) into r;
  return r;
end $$;
revoke execute on function public.almacen_salud() from public, anon;
grant execute on function public.almacen_salud() to authenticated;

-- Los artículos de un pedazo de la gráfica (una clase de salud o una celda ABC-XYZ), para actuar.
create or replace function public.almacen_salud_lista(p_grupo text, p_valor text) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if not puede('inventario', 2) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  if p_grupo not in ('salud', 'matriz', 'cobertura') then raise exception 'Grupo no válido'; end if;
  return (select coalesce(jsonb_agg(to_jsonb(x) - 'costo' - 'consumo_meses' order by x.valor_stock desc nulls last, x.consumo_12 desc, x.clave), '[]') from (
    select * from almacen_clasificacion() c
    where (p_grupo = 'salud' and c.salud = p_valor)
       or (p_grupo = 'matriz' and c.abc || c.xyz = p_valor)
    order by c.valor_stock desc nulls last, c.consumo_12 desc limit 300) x);
end $$;
revoke execute on function public.almacen_salud_lista(text, text) from public, anon;
grant execute on function public.almacen_salud_lista(text, text) to authenticated;

-- -------------------------------------------------------------------------------- mantenimiento
create or replace function public.mantenimiento_analitica(p_desde date, p_hasta date) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  d0 timestamptz := p_desde::timestamp at time zone 'America/Mexico_City';
  d1 timestamptz := least((p_hasta + 1)::timestamp at time zone 'America/Mexico_City', now());
  v_hoy date := hoy_mx();
  v_lunes date := date_trunc('week', hoy_mx())::date;
  v_horas_prev numeric;
  -- Antes de la primera orden capturada no hay registro: esas semanas no son «100 % disponibles», son sin dato.
  v_inicio date := (select min(reportado_en at time zone 'America/Mexico_City')::date from ordenes_mantenimiento);
  p planes_preventivos; v_f date; v_abierta date; i int;
  r jsonb;
begin
  if not (puede('mantenimiento', 1) or puede('procesos', 1)) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  if p_hasta < p_desde then raise exception 'El periodo está al revés'; end if;

  -- Cuánto tarda un preventivo: lo que tardó ese plan antes, o el promedio de todos.
  select avg(horas_trabajadas) into v_horas_prev from ordenes_mantenimiento
  where tipo = 'preventivo' and estado = 'cerrada' and horas_trabajadas > 0;

  -- Proyección de cada plan activo hasta 8 semanas: la orden abierta (si hay) y las que siguen.
  drop table if exists _carga;
  create temp table _carga (maquina_id uuid, plan_id uuid, vence date, horas numeric) on commit drop;
  for p in select pp.* from planes_preventivos pp join maquinas m on m.id = pp.maquina_id
           where pp.activo and m.estado <> 'baja' and pp.modo in ('dias', 'mes_semana', 'mes_dia') loop
    select min(o.vence) into v_abierta from ordenes_mantenimiento o
    where o.plan_id = p.id and o.estado in ('pendiente', 'en_proceso');
    v_f := coalesce(v_abierta, preventivo_proxima(p));
    i := 0;
    while v_f is not null and v_f < v_lunes + 56 and i < 60 loop
      insert into _carga values (p.maquina_id, p.id, v_f, coalesce(
        (select avg(horas_trabajadas) from ordenes_mantenimiento where plan_id = p.id and estado = 'cerrada' and horas_trabajadas > 0), v_horas_prev, 1));
      v_f := preventivo_fecha(p.modo, v_f, p.cada_dias, p.cada_meses, p.semana_mes, p.dia_semana, p.dia_mes, p.solo_laborables, null);
      i := i + 1;
    end loop;
  end loop;

  select jsonb_build_object(
    'semanas', (select coalesce(jsonb_agg(jsonb_build_object('semana', g::date,
        'horas', round(h.horas, 1), 'fuera', round(h.fuera, 1), 'con_registro', g::date + 6 >= v_inicio,
        'disponibilidad', case when h.horas > 0 and g::date + 6 >= v_inicio then round(1 - h.fuera / h.horas, 4) end,
        'fallas', (select count(*) from ordenes_mantenimiento o where o.tipo = 'correctivo' and o.estado <> 'cancelada'
                   and o.reportado_en >= h.w0 and o.reportado_en < h.w1),
        'prev_a_tiempo', (select count(*) from ordenes_mantenimiento o where o.tipo = 'preventivo' and o.estado = 'cerrada'
                          and o.vence between g::date and least(g::date + 6, p_hasta) and (o.cerrada_en at time zone 'America/Mexico_City')::date <= o.vence),
        'prev_tarde', (select count(*) from ordenes_mantenimiento o where o.tipo = 'preventivo' and o.estado <> 'cancelada'
                       and o.vence between g::date and least(g::date + 6, p_hasta, v_hoy - 1)
                       and coalesce((o.cerrada_en at time zone 'America/Mexico_City')::date, v_hoy) > o.vence)
      ) order by g), '[]')
      from generate_series(date_trunc('week', p_desde::timestamp), p_hasta::timestamp, interval '7 days') g
      cross join lateral (
        select w.w0, w.w1,
          horas_en_horario(w.w0, w.w1) * (select count(*) from maquinas m where m.estado <> 'baja' or m.baja_en >= g::date) horas,
          coalesce((select sum(horas_en_horario(greatest(o.fuera_desde, w.w0), least(coalesce(o.fuera_hasta, now()), w.w1)))
                    from ordenes_mantenimiento o where o.estado <> 'cancelada' and o.fuera_desde is not null
                      and o.fuera_desde < w.w1 and coalesce(o.fuera_hasta, now()) > w.w0), 0) fuera
        from (select greatest(g::timestamp at time zone 'America/Mexico_City', d0) w0,
                     least((g + interval '7 days')::timestamp at time zone 'America/Mexico_City', d1) w1) w
        where w.w1 > w.w0) h),

    -- Las 8 semanas que vienen, y lo vencido al frente.
    'carga', (select coalesce(jsonb_agg(jsonb_build_object('semana', s.semana, 'alta', s.alta, 'media', s.media, 'baja', s.baja, 'horas', s.horas)
        order by s.semana nulls first), '[]')
      from (select case when c.vence < v_hoy then null else date_trunc('week', c.vence)::date end semana,
              count(*) filter (where m.critica or m.criticidad in ('muy_alta', 'alta')) alta,
              count(*) filter (where not m.critica and m.criticidad = 'media') media,
              count(*) filter (where not (m.critica or coalesce(m.criticidad, '') in ('muy_alta', 'alta', 'media'))) baja,
              round(sum(c.horas), 1) horas
            from _carga c join maquinas m on m.id = c.maquina_id group by 1) s),

    'antiguedad', (select coalesce(jsonb_agg(jsonb_build_object('rango', rango, 'preventivo', pv, 'falla', fa, 'falla_parada', fp) order by orden), '[]')
      from (select b.rango, b.orden,
              count(o.id) filter (where o.tipo = 'preventivo') pv,
              count(o.id) filter (where o.tipo = 'correctivo' and not o.detiene) fa,
              count(o.id) filter (where o.tipo = 'correctivo' and o.detiene) fp
            from (values ('0-2', 1, 0, 3), ('3-7', 2, 3, 8), ('8-14', 3, 8, 15), ('15-30', 4, 15, 31), ('31+', 5, 31, 100000)) b(rango, orden, de, a)
            left join ordenes_mantenimiento o on o.estado in ('pendiente', 'en_proceso')
              and extract(epoch from now() - o.reportado_en) / 86400 >= b.de and extract(epoch from now() - o.reportado_en) / 86400 < b.a
            group by b.rango, b.orden) x)
  ) into r;
  return r;
end $$;
revoke execute on function public.mantenimiento_analitica(date, date) from public, anon;
grant execute on function public.mantenimiento_analitica(date, date) to authenticated;

-- =============================================================================
-- El ritmo del almacén: qué días y a qué horas se mueve más, y cómo ha venido por mes.
--
-- Por qué: las métricas de almacén decían cómo está el inventario hoy y qué pasó en el periodo,
-- pero no cuándo se trabaja: qué día de la semana sale más material, a qué hora se junta la fila
-- en el mostrador, qué meses son los pesados. Con eso se decide cuándo contar, cuándo recibir
-- proveedores y cuándo hace falta una segunda persona.
--
-- De dónde sale: de los movimientos del ERP y, si la empresa cargó el historial de su sistema
-- anterior (historial_movimientos_hoja: en Hegamex, el Registro de la hoja de inventario desde
-- 2024), también de ahí. No es una regla de Hegamex: una empresa sin historial ve solo lo suyo y
-- la pantalla lo dice. Para no contar dos veces, el historial vale hasta la carga inicial de
-- existencias y el ERP desde entonces (los movimientos del ERP anteriores a esa carga son los
-- mismos renglones del sistema anterior).
--
-- Se cuentan renglones, no piezas: tornillos y láminas no se suman. Lo deshecho no cuenta. Los
-- renglones del historial que traen fecha sin hora (hora en punto, 0 min 0 s) no entran a las
-- horas. Sin costos. Lo ven quienes ven los movimientos (inventario 2 o costos 1).
-- =============================================================================

create index if not exists historial_movimientos_hoja_fecha on public.historial_movimientos_hoja (fecha);

create or replace function public.almacen_ritmo(p_desde date default null, p_hasta date default null) returns jsonb
language plpgsql stable security invoker set search_path = public as $$
declare v_corte timestamptz; v_ini timestamptz; v_fin timestamptz; r jsonb;
begin
  if not (puede('inventario', 2) or puede('costos', 1)) then
    raise exception 'El ritmo del almacén lo ven almacén, compras, producción y dirección' using errcode = '42501';
  end if;
  if p_desde is not null and p_hasta is not null and p_hasta < p_desde then
    raise exception 'El periodo va al revés: desde tiene que ser antes que hasta' using errcode = '22023';
  end if;
  select min(en) into v_corte from movimientos_inventario where tipo = 'inicial';
  v_ini := coalesce(p_desde, '2000-01-01')::timestamp at time zone 'America/Mexico_City';
  v_fin := (coalesce(p_hasta, hoy_planta()) + 1)::timestamp at time zone 'America/Mexico_City';

  with u as materialized (
    select h.fecha at time zone 'America/Mexico_City' as ts, 'historial'::text as origen,
      case h.tipo when 'SALIDA' then 'salida' when 'ENTRADA' then 'entrada' else 'ajuste' end as grupo,
      not (extract(minute from h.fecha) = 0 and extract(second from h.fecha) = 0) as con_hora
    from historial_movimientos_hoja h
    where h.tipo in ('SALIDA', 'ENTRADA', 'AJUSTE ENTRADA', 'AJUSTE SALIDA')
      and (v_corte is null or h.fecha < v_corte) and h.fecha >= v_ini and h.fecha < v_fin
    union all
    select m.en at time zone 'America/Mexico_City', 'erp',
      case when m.tipo in ('salida_produccion', 'salida_venta', 'salida_consumo') then 'salida'
           when m.tipo in ('entrada_compra', 'devolucion') then 'entrada' else 'ajuste' end,
      true
    from movimientos_inventario m
    where m.tipo <> 'inicial' and (v_corte is null or m.en >= v_corte) and m.en >= v_ini and m.en < v_fin
      and m.deshace_id is null and not exists (select 1 from movimientos_inventario d where d.deshace_id = m.id)
  )
  select jsonb_build_object(
    'resumen', (select jsonb_build_object(
        'movimientos', count(*), 'salidas', count(*) filter (where grupo = 'salida'), 'entradas', count(*) filter (where grupo = 'entrada'),
        'ajustes', count(*) filter (where grupo = 'ajuste'), 'dias_activos', count(distinct ts::date),
        'primer_dia', min(ts)::date, 'ultimo_dia', max(ts)::date,
        'del_historial', count(*) filter (where origen = 'historial'), 'del_erp', count(*) filter (where origen = 'erp'),
        'sin_hora', count(*) filter (where not con_hora), 'erp_desde', (v_corte at time zone 'America/Mexico_City')::date) from u),
    'por_dia_semana', (select coalesce(jsonb_agg(to_jsonb(x) order by x.dia), '[]'::jsonb) from (
      select extract(isodow from ts)::int as dia, count(distinct ts::date) as dias, count(*) filter (where grupo = 'salida') as salidas,
        count(*) filter (where grupo = 'entrada') as entradas, count(*) filter (where grupo = 'ajuste') as ajustes
      from u group by 1) x),
    'por_hora', (select coalesce(jsonb_agg(to_jsonb(x) order by x.hora), '[]'::jsonb) from (
      select extract(hour from ts)::int as hora, count(*) filter (where grupo = 'salida') as salidas,
        count(*) filter (where grupo = 'entrada') as entradas, count(*) filter (where grupo = 'ajuste') as ajustes
      from u where con_hora group by 1) x),
    'calor', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from (
      select extract(isodow from ts)::int as dia, extract(hour from ts)::int as hora, count(*) filter (where grupo = 'salida') as salidas,
        count(*) filter (where grupo = 'entrada') as entradas, count(*) filter (where grupo = 'ajuste') as ajustes
      from u where con_hora group by 1, 2) x),
    'por_mes', (select coalesce(jsonb_agg(to_jsonb(x) order by x.mes), '[]'::jsonb) from (
      select date_trunc('month', ts)::date as mes, count(distinct ts::date) as dias, count(*) filter (where grupo = 'salida') as salidas,
        count(*) filter (where grupo = 'entrada') as entradas, count(*) filter (where grupo = 'ajuste') as ajustes,
        case when bool_and(origen = 'erp') then 'erp' when bool_and(origen = 'historial') then 'historial' else 'ambos' end as origen
      from u group by 1) x),
    'dias_pico', (select coalesce(jsonb_agg(to_jsonb(x) order by x.movimientos desc), '[]'::jsonb) from (
      select ts::date as dia, count(*) as movimientos, count(*) filter (where grupo = 'salida') as salidas,
        count(*) filter (where grupo = 'entrada') as entradas, count(*) filter (where grupo = 'ajuste') as ajustes
      from u group by 1 order by count(*) desc limit 8) x)
  ) into r;
  return r;
end $$;
revoke execute on function public.almacen_ritmo(date, date) from public, anon;
grant execute on function public.almacen_ritmo(date, date) to authenticated;

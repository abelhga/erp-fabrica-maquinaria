-- =============================================================================
-- Recálculo incremental del costeo.
--
-- Con el catálogo real (≈5,600 artículos, 24 mil líneas) recalcular todo en cada
-- cambio tardaba ~2.5 s y, peor, reescribía miles de filas de costos y precios:
-- dos personas guardando a la vez se bloqueaban entre sí (lo vimos con cinco
-- sesiones trabajando en paralelo sobre la misma base). Ahora un cambio solo
-- recalcula lo afectado: el artículo y los fabricados que lo contienen, en orden
-- de abajo hacia arriba. Cambiar una chumacera toca sus N equipos, no 5,600.
-- Los cambios globales (políticas, tarifas, tipo de cambio) siguen recalculando
-- todo, pero solo escriben las filas que de verdad cambian.
-- =============================================================================

drop function if exists public.recalcular_costos();

create or replace function public.recalcular_costos(p_ids uuid[] default null) returns int
language plpgsql security definer set search_path = public as $$
declare v_nivel int; v_n int;
begin
  if to_regclass('pg_temp._niveles') is null then
    create temp table _niveles (id uuid primary key, nivel int) on commit drop;
    create temp table _afectados (id uuid primary key) on commit drop;
    create temp table _precios (articulo_id uuid primary key, precio numeric) on commit drop;
  end if;
  truncate _niveles; truncate _afectados; truncate _precios;

  if p_ids is null then
    -- Todo: nivel = camino más largo hacia abajo (los que no contienen fabricados son 0).
    insert into _niveles
    with recursive camino(id, prof) as (
      select a.id, 0 from articulos a where a.tipo in ('subensamble', 'equipo')
        and not exists (select 1 from bom_lineas b join articulos h on h.id = b.hijo_id
                        where b.padre_id = a.id and h.tipo in ('subensamble', 'equipo'))
      union
      select b.padre_id, c.prof + 1 from bom_lineas b join camino c on c.id = b.hijo_id where c.prof < 30
    )
    select id, max(prof) from camino group by id;
    insert into _afectados select id from articulos;
  else
    -- Solo lo afectado: los fabricados de la lista, los padres de los comprados de la
    -- lista, y todos sus ancestros. Nivel = distancia máxima desde el cambio, así un
    -- padre siempre se calcula después de cualquier hijo afectado.
    insert into _niveles
    with recursive arriba(id, d) as (
      select a.id, 0 from articulos a where a.id = any(p_ids) and a.tipo in ('subensamble', 'equipo')
      union
      select b.padre_id, 0 from bom_lineas b join articulos h on h.id = b.hijo_id
      where b.hijo_id = any(p_ids) and h.tipo not in ('subensamble', 'equipo')
      union
      select b.padre_id, arriba.d + 1 from bom_lineas b join arriba on b.hijo_id = arriba.id where arriba.d < 30
    )
    select id, max(d) from arriba group by id;
    insert into _afectados select unnest(p_ids) on conflict do nothing;
    insert into _afectados select id from _niveles on conflict do nothing;
  end if;

  -- Comprados: costo directo convertido a MXN (solo se escribe si cambió).
  insert into costos_calculados (articulo_id, costo_material, costo_mano_obra, costo_total, horas, sin_costo, costo_mas_viejo, calculado_en)
  select a.id, coalesce(c.costo * tc(c.moneda), 0), 0, coalesce(c.costo * tc(c.moneda), 0), 0,
         case when c.costo is null or c.costo = 0 then 1 else 0 end, c.actualizado_en, now()
  from articulos a join _afectados x on x.id = a.id left join costos_articulo c on c.articulo_id = a.id
  where a.tipo in ('componente', 'materia_prima', 'servicio')
  on conflict (articulo_id) do update set costo_material = excluded.costo_material, costo_mano_obra = 0,
    costo_total = excluded.costo_total, horas = 0, sin_costo = excluded.sin_costo,
    costo_mas_viejo = excluded.costo_mas_viejo, calculado_en = now()
  where (costos_calculados.costo_total, costos_calculados.sin_costo, costos_calculados.costo_mas_viejo)
    is distinct from (excluded.costo_total, excluded.sin_costo, excluded.costo_mas_viejo);

  -- Fabricados: nivel por nivel, cada uno suma lo de sus hijos ya calculados.
  for v_nivel in 0 .. coalesce((select max(nivel) from _niveles), -1) loop
    insert into costos_calculados (articulo_id, costo_material, costo_mano_obra, costo_total, horas, sin_costo, costo_mas_viejo, calculado_en)
    select n.id,
      coalesce(m.material, 0),
      coalesce(m.mano_obra_hijos, 0) + coalesce(o.costo, 0),
      coalesce(m.material, 0) + coalesce(m.mano_obra_hijos, 0) + coalesce(o.costo, 0),
      coalesce(m.horas_hijos, 0) + coalesce(o.horas, 0),
      coalesce(m.sin_costo, 0),
      m.mas_viejo,
      now()
    from _niveles n
    left join lateral (
      select sum(cantidad_linea(b) * cc.costo_material) material,
             sum(cantidad_linea(b) * cc.costo_mano_obra) mano_obra_hijos,
             sum(cantidad_linea(b) * cc.horas) horas_hijos,
             sum(cc.sin_costo)::int sin_costo,
             min(cc.costo_mas_viejo) mas_viejo
      from bom_lineas b join costos_calculados cc on cc.articulo_id = b.hijo_id
      where b.padre_id = n.id
    ) m on true
    left join lateral (
      select sum(horas_operacion(o)) horas, sum(horas_operacion(o) * coalesce(t.costo_hora, 0)) costo
      from bom_operaciones o left join tarifas_mano_obra t on t.etapa_id = o.etapa_id
      where o.articulo_id = n.id
    ) o on true
    where n.nivel = v_nivel
    on conflict (articulo_id) do update set costo_material = excluded.costo_material,
      costo_mano_obra = excluded.costo_mano_obra, costo_total = excluded.costo_total, horas = excluded.horas,
      sin_costo = excluded.sin_costo, costo_mas_viejo = excluded.costo_mas_viejo, calculado_en = now()
    where (costos_calculados.costo_total, costos_calculados.horas, costos_calculados.sin_costo, costos_calculados.costo_mas_viejo)
      is distinct from (excluded.costo_total, excluded.horas, excluded.sin_costo, excluded.costo_mas_viejo);
  end loop;

  -- Precios de lista de lo afectado: precio fijo si lo hay; si no, la fórmula de su política.
  insert into _precios
  select a.id, coalesce(c.precio_fijo, precio_desde_costo(cc.costo_total, politica_de(a.id), c.margen, a.medida_especial))
  from articulos a
  join _afectados x on x.id = a.id
  join costos_calculados cc on cc.articulo_id = a.id
  left join costos_articulo c on c.articulo_id = a.id
  where a.se_vende and a.activo;
  delete from _precios where precio is null;

  -- Foto de lo que cambió (costo o precio) respecto a la última registrada.
  insert into historial_costeo (articulo_id, costo_material, costo_mano_obra, costo_total, precio_lista, politica_id, utilidad, factor)
  select cc.articulo_id, cc.costo_material, cc.costo_mano_obra, cc.costo_total, n.precio, pol.id,
         coalesce(c.margen, pol.utilidad),
         case when cc.costo_total > 0 then precio_sin_redondeo(cc.costo_total, pol.id, c.margen, a.medida_especial) / cc.costo_total end
  from costos_calculados cc
  join _afectados x on x.id = cc.articulo_id
  join articulos a on a.id = cc.articulo_id
  left join _precios n on n.articulo_id = cc.articulo_id
  left join costos_articulo c on c.articulo_id = cc.articulo_id
  left join politicas_precio pol on pol.id = politica_de(cc.articulo_id)
  left join lateral (select h.costo_total, h.precio_lista from historial_costeo h
                     where h.articulo_id = cc.articulo_id order by h.en desc, h.id desc limit 1) u on true
  where (a.tipo in ('subensamble', 'equipo') or a.se_vende)
    and (u is null or u.costo_total is distinct from round(cc.costo_total, 4) or u.precio_lista is distinct from n.precio);

  insert into precios_lista (articulo_id, precio, moneda, calculado_en)
  select articulo_id, precio, 'MXN', now() from _precios
  on conflict (articulo_id) do update set precio = excluded.precio, calculado_en = now()
  where precios_lista.precio is distinct from excluded.precio;

  delete from precios_lista p using _afectados x
  where p.articulo_id = x.id and not exists (select 1 from _precios n where n.articulo_id = p.articulo_id);

  get diagnostics v_n = row_count;
  return v_n;
end $$;

-- Disparadores: juntan los ids que cambiaron (tablas de transición) y recalculan
-- solo eso. tg_argv[0] = columna con el id del artículo afectado.
create or replace function public.recalculo_incremental() returns trigger
language plpgsql security definer set search_path = public as $$
declare v uuid[];
begin
  if tg_op = 'INSERT' then
    execute format('select array_agg(distinct %I) from nuevos', tg_argv[0]) into v;
  elsif tg_op = 'DELETE' then
    execute format('select array_agg(distinct %I) from viejos', tg_argv[0]) into v;
  else
    execute format('select array_agg(distinct x) from (select %1$I x from nuevos union select %1$I from viejos) t', tg_argv[0]) into v;
  end if;
  if v is not null then perform recalcular_costos(v); end if;
  return null;
end $$;

-- Artículos: solo importan los cambios que mueven costo o precio (editar la
-- descripción no debe recalcular nada).
create or replace function public.recalculo_articulos() returns trigger
language plpgsql security definer set search_path = public as $$
declare v uuid[];
begin
  if tg_op = 'INSERT' then
    select array_agg(id) into v from nuevos;
  else
    select array_agg(n.id) into v from nuevos n join viejos o on o.id = n.id
    where (n.tipo, n.categoria_id, n.se_vende, n.activo, n.medida_especial) is distinct from
          (o.tipo, o.categoria_id, o.se_vende, o.activo, o.medida_especial);
  end if;
  if v is not null then perform recalcular_costos(v); end if;
  return null;
end $$;

do $$
declare t text; col text;
begin
  foreach t in array array['costos_articulo', 'bom_lineas', 'bom_operaciones', 'articulo_parametros'] loop
    col := case t when 'bom_lineas' then 'padre_id' else 'articulo_id' end;
    execute format('drop trigger if exists recalcular on public.%I', t);
    execute format('create trigger recalcular_alta after insert on public.%I referencing new table as nuevos for each statement execute function public.recalculo_incremental(%L)', t, col);
    execute format('create trigger recalcular_cambio after update on public.%I referencing new table as nuevos old table as viejos for each statement execute function public.recalculo_incremental(%L)', t, col);
    execute format('create trigger recalcular_baja after delete on public.%I referencing old table as viejos for each statement execute function public.recalculo_incremental(%L)', t, col);
  end loop;
end $$;

-- Un componente que se quita de una lista: el padre se recalcula por el disparador de
-- bom_lineas (padre_id). Si cambia el hijo de una línea, también cuenta el padre.
drop trigger if exists recalcular on public.articulos;
create trigger recalcular_alta after insert on public.articulos referencing new table as nuevos
  for each statement execute function public.recalculo_articulos();
create trigger recalcular_cambio after update on public.articulos referencing new table as nuevos old table as viejos
  for each statement execute function public.recalculo_articulos();

-- =============================================================================
-- La fecha de entrega ya no usa los «días de fabricación» capturados por equipo.
--
-- Por qué: ese número (40 a 65 días hábiles en 189 equipos) se cargó de la tabla «Tiempos de
-- entrega» de producción, que ya traía la espera del taller adentro, y el ERP le sumaba aparte la
-- fila del taller (las horas de la lista de materiales de cada equipo contra la capacidad de cada
-- etapa). Nadie sabía qué significaba ni quién lo debía mantener; en el ERP los equipos han
-- tardado de 4 a 27 días hábiles de la orden a terminarse. Dirección pidió quitarlo: la fecha que
-- ve ventas sale solo del cálculo del taller. La columna se queda (no se borra el dato), pero ya
-- no se usa ni se ve.
-- =============================================================================

do $$
declare v_def text := pg_get_functiondef('public.estimar_entrega(jsonb)'::regprocedure);
  v_ancla text := 'select count(*), max(a.dias_fabricacion), array_agg(a.nombre order by a.nombre) filter (where a.dias_fabricacion is null)';
begin
  if v_def like '%select count(*), null::int, null::text[]%' then return; end if;
  if position(v_ancla in v_def) = 0 then raise exception 'estimar_entrega ya no es la que se conocía'; end if;
  execute replace(v_def, v_ancla, 'select count(*), null::int, null::text[]');
end $$;

revoke execute on function public.fijar_dias_fabricacion(uuid, int) from authenticated;

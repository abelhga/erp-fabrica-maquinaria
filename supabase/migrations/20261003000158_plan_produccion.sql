-- =============================================================================
-- Plan del taller (para el Gantt de producción).
--
-- estimar_entrega (109) dice cuántas semanas de fila tiene cada área para prometer una
-- fecha, pero no cuándo empieza y termina cada etapa de cada orden. Para un Gantt hace
-- falta eso, y que salga de la misma base para que la pantalla, la TV y el calendario
-- digan lo mismo.
--
-- plan_produccion() simula el taller día por día, de lunes a viernes:
--   - cada área trabaja hasta su capacidad del día (capacidad semanal ÷ 5);
--   - cada etapa avanza a lo que da su cuadrilla: personas asignadas (las de Cuadrillas o
--     las que están trabajando) × 9 h; sin cuadrilla, 2 personas;
--   - una etapa no empieza hasta el día siguiente a que termine la anterior de la misma
--     orden; lo que ya está en proceso o pausado sigue desde hoy;
--   - el orden: lo que ya está en proceso, luego la cola de Cuadrillas (turno), luego la
--     prioridad de la orden y su fecha compromiso.
-- Lo que falta de una etapa en proceso son sus horas estimadas menos las horas hombre ya
-- marcadas en la terminal (al menos 15 %: si nadie marcó, no se sabe cuánto falta).
-- Las órdenes en espera no entran al plan.
--
-- ordenar_plan(órdenes): la gerencia arrastra una orden en el Gantt y ese orden pasa a
-- la cola de cada área (el mismo turno de Cuadrillas), así el tablero y el plan coinciden.
-- El renglón de cada orden en el Gantt (posicion) es el turno de la etapa en la que va.
-- Por eso ordenar_cola (Cuadrillas, una sola área) ya no numera 1, 2, 3: reparte los mismos
-- números que tenían esas etapas en el orden nuevo. Si numerara desde 1, acomodar la cola de
-- Pintura mandaba esas órdenes hasta arriba del Gantt aunque nadie las hubiera subido.
-- =============================================================================

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
  n int; i int; k int; v_pend int; v_toma numeric; v_ei int;
begin
  if not (puede('produccion', 2) or puede('procesos', 1)) then raise exception 'Sin permiso' using errcode = '42501'; end if;

  select array_agg(id order by orden), array_agg(capacidad_horas_semana / 5.0 order by orden)
  into e_id, e_cap from etapas where activa and capacidad_horas_semana > 0;

  -- Lo pendiente de las órdenes abiertas, con lo que falta y la velocidad de su cuadrilla.
  drop table if exists _plan;
  create temp table _plan on commit drop as
  with ops as (
    select x.id, x.orden_id, x.etapa_id, et.orden etapa_orden, x.estado, x.horas_estimadas, x.turno,
      o.prioridad, o.fecha_compromiso, o.folio,
      coalesce((select sum(extract(epoch from coalesce(t.fin, now()) - t.inicio) / 3600 * t.personas) from op_tiempos t where t.operacion_id = x.id), 0) hh,
      greatest((select count(*) from op_asignaciones a where a.operacion_id = x.id),
               (select coalesce(sum(t.personas), 0) from op_tiempos t where t.operacion_id = x.id and t.fin is null))::int gente
    from op_operaciones x join ordenes_produccion o on o.id = x.orden_id join etapas et on et.id = x.etapa_id
    where o.estado in ('planeada', 'liberada', 'en_proceso') and o.en_espera_motivo is null and x.estado <> 'terminada'
      and et.activa and et.capacidad_horas_semana > 0
  )
  select ops.*,
    case when estado in ('en_proceso', 'pausada') then greatest(horas_estimadas - hh, horas_estimadas * 0.15) else horas_estimadas end rem,
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
  where o.estado in ('planeada', 'liberada', 'en_proceso') and o.en_espera_motivo is not null and x.estado <> 'terminada';
end $$;
revoke execute on function public.plan_produccion() from public, anon;
grant execute on function public.plan_produccion() to authenticated;

-- La gerencia acomoda las órdenes en el Gantt: ese orden pasa a la cola de cada área.
create or replace function public.ordenar_plan(p_ordenes uuid[])
returns void language plpgsql security definer set search_path = public as $$
begin
  if not puede('produccion', 3) then raise exception 'Solo la gerencia de producción reordena el plan' using errcode = '42501'; end if;
  -- Todas sus etapas sin terminar: la que está en proceso también, porque de ella sale el renglón.
  update op_operaciones x set turno = n.i
  from unnest(p_ordenes) with ordinality n(orden_id, i)
  where x.orden_id = n.orden_id and x.estado <> 'terminada';
end $$;
revoke execute on function public.ordenar_plan(uuid[]) from public, anon;
grant execute on function public.ordenar_plan(uuid[]) to authenticated;

-- La cola de una sola área (Cuadrillas): los mismos números, en el orden nuevo.
create or replace function public.ordenar_cola(p_operaciones uuid[])
returns void language plpgsql security definer set search_path = public as $$
declare v_max int; v_turnos int[]; i int;
begin
  if not puede('produccion', 3) then raise exception 'Solo la gerencia de producción ordena la cola' using errcode = '42501'; end if;
  if (select count(distinct etapa_id) from op_operaciones where id = any(p_operaciones)) > 1 then
    raise exception 'La cola se ordena dentro de una sola etapa';
  end if;
  -- Los que no tenían turno toman los que siguen del mayor; sin ninguno, queda 1, 2, 3…
  select coalesce(max(turno), 0) into v_max from op_operaciones where id = any(p_operaciones);
  select array_agg(t order by t) into v_turnos from (
    select coalesce(turno, v_max + row_number() over (partition by turno is null order by id))::int t
    from op_operaciones where id = any(p_operaciones)) z;
  -- Dos con el mismo número no dirían quién va primero: se recorren.
  for i in 2..coalesce(array_length(v_turnos, 1), 0) loop
    v_turnos[i] := greatest(v_turnos[i], v_turnos[i - 1] + 1);
  end loop;
  update op_operaciones x set turno = v_turnos[n.i]
  from unnest(p_operaciones) with ordinality n(id, i) where x.id = n.id;
end $$;

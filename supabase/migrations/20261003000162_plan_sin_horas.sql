-- =============================================================================
-- El Gantt en la ficha del pedido y de la orden.
--
-- El plan del taller (plan_produccion) solo lo leía la planta. Para enseñarlo en el pedido, que
-- abre el vendedor, ahora lo lee quien ve producción, pero sin horas: el vendedor ve cuándo
-- empieza y termina cada etapa de sus equipos, no cuántas horas lleva cada una (eso sigue
-- siendo de la planta, como en el tablero).
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
      coalesce((select sum(extract(epoch from coalesce(t.fin, now()) - t.inicio) / 3600 * t.personas) from op_tiempos t where t.operacion_id = x.id), 0) hh,
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

-- =============================================================================
-- El horario del taller es de producción, no el de los plazos de compras.
--
-- 163 contaba las horas con horario_habil, que es con lo que se miden los plazos de las
-- solicitudes de precio (L–V 8–18, sáb 8–14). El taller entra a las 8:00, sale a las 17:30 y
-- no trabaja sábados: con aquel horario la terminal sumaba los sábados y la media hora de 17:30
-- a 18:00 que nadie trabajó, y el plan del Gantt daba 9 h por persona al día en vez de 8.5.
--
-- Ahora horas_taller trae su propio horario por día de la semana, los descansos y los días con
-- otro horario (tiempo extra, un sábado que sí se trabaja, un día que salen temprano). Lo edita
-- la gerencia de producción en Cuadrillas → Personal de piso. De ahí salen:
--   horas_trabajadas      horas hombre, piso y métricas (igual que en 163, con este horario);
--   horas_jornada(día)    lo que da un día: el plan avanza cada etapa gente × jornada, cada área
--                         hace su parte de la semana y los días de 0 h se los salta;
--   horario_taller_ahora  si el taller está en horario, para que la pantalla no diga «trabajando»
--                         a las 10 de la noche (el tiempo sigue abierto, pero no cuenta).
-- Las horas se calculan al momento: lo ya marcado se recalcula solo con el horario nuevo.
-- =============================================================================

update public.configuracion
set valor = jsonb_build_object(
      'horario', '{"1": ["08:00", "17:30"], "2": ["08:00", "17:30"], "3": ["08:00", "17:30"], "4": ["08:00", "17:30"], "5": ["08:00", "17:30"]}'::jsonb,
      'especiales', '{}'::jsonb) || valor,
    descripcion = 'Cómo se cuentan las horas de la terminal de piso y con qué horario. horario: entrada y salida por día de la semana (1 = lunes … 7 = domingo; el día que falta no se trabaja). descansos: de–a, con «minutos» si el descanso dura menos que la ventana porque va por turnos. especiales: días con otro horario («2026-10-24»: entrada y salida; null = no se trabaja); mandan sobre el horario y los feriados. modo «horario»: solo cuenta ese horario menos los descansos. modo «terminal»: tal cual se marca. Los feriados de ley y los descansos de calendario_laboral no se trabajan. Lo cambia la gerencia de producción en Cuadrillas → Personal de piso.'
where clave = 'horas_taller';

-- Guardar cualquier configuración recalculaba todo el costeo (2–3 s), y el horario del taller no
-- entra a ningún costo: la gerencia lo ajusta seguido (un sábado de tiempo extra). Solo se salta
-- esa clave; cualquier otra sigue recalculando como siempre. (Un disparador con lista de columnas
-- no puede ver los renglones, por eso ya no es «update of valor» y compara valor aquí.)
create or replace function public.disparar_recalculo_config() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from nuevos n join viejos v on v.clave = n.clave
             where n.valor is distinct from v.valor and n.clave <> 'horas_taller') then
    perform recalcular_costos();
  end if;
  return null;
end $$;
drop trigger if exists recalcular on public.configuracion;
create trigger recalcular after update on public.configuracion referencing old table as viejos new table as nuevos
  for each statement execute function public.disparar_recalculo_config();

-- La ventana de trabajo del taller en un día (ninguna si no se trabaja), en hora de la planta.
create or replace function public.ventana_taller(p_dia date)
returns table (inicio timestamptz, fin timestamptz)
language sql stable security invoker set search_path = public as $$
  with c as (select coalesce((select valor from configuracion where clave = 'horas_taller'), '{}'::jsonb) v),
  h as (
    select case
      -- Un día con otro horario manda, aunque sea feriado (si deciden trabajarlo).
      when c.v->'especiales' ? to_char(p_dia, 'YYYY-MM-DD') then c.v->'especiales'->to_char(p_dia, 'YYYY-MM-DD')
      when p_dia in (select festivos_lft(extract(year from p_dia)::int)) then null
      when coalesce((select valor->'descansos_empresa' from configuracion where clave = 'calendario_laboral'), '[]'::jsonb)
           @> to_jsonb(to_char(p_dia, 'YYYY-MM-DD')) then null
      else coalesce(c.v->'horario', '{"1": ["08:00", "17:30"], "2": ["08:00", "17:30"], "3": ["08:00", "17:30"], "4": ["08:00", "17:30"], "5": ["08:00", "17:30"]}'::jsonb)
           -> (extract(isodow from p_dia)::int)::text
    end t
    from c)
  select (p_dia + (h.t->>0)::time) at time zone 'America/Mexico_City',
         (p_dia + (h.t->>1)::time) at time zone 'America/Mexico_City'
  from h where jsonb_typeof(h.t) = 'array'
$$;
revoke execute on function public.ventana_taller(date) from public, anon;
grant execute on function public.ventana_taller(date) to authenticated;

-- Horas del horario del taller entre dos instantes, menos los descansos. No depende del modo:
-- es lo que da el taller (el plan lo usa también cuando el piso marca tal cual).
create or replace function public.horas_en_horario(p_desde timestamptz, p_hasta timestamptz)
returns numeric language sql stable security invoker set search_path = public as $$
  with c as (select coalesce((select valor from configuracion where clave = 'horas_taller'), '{}'::jsonb) v)
  select case when p_desde is null or p_hasta is null or p_hasta <= p_desde then 0 else coalesce((
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
    cross join lateral ventana_taller(g.d::date) w
    where w.fin > p_desde and w.inicio < p_hasta), 0) end
$$;
revoke execute on function public.horas_en_horario(timestamptz, timestamptz) from public, anon;
grant execute on function public.horas_en_horario(timestamptz, timestamptz) to authenticated;

-- Horas de trabajo entre dos instantes según el modo (la firma de 163: vistas y funciones la siguen).
create or replace function public.horas_trabajadas(p_desde timestamptz, p_hasta timestamptz)
returns numeric language sql stable security invoker set search_path = public as $$
  select case
    when p_desde is null or p_hasta is null or p_hasta <= p_desde then 0
    when (select valor->>'modo' from configuracion where clave = 'horas_taller') = 'terminal'
      then round(extract(epoch from p_hasta - p_desde)::numeric / 3600, 4)
    else horas_en_horario(p_desde, p_hasta)
  end
$$;

-- Lo que da un día en el taller por persona (0 si no se trabaja).
create or replace function public.horas_jornada(p_dia date)
returns numeric language sql stable security invoker set search_path = public as $$
  select horas_en_horario(p_dia::timestamp at time zone 'America/Mexico_City', (p_dia + 1)::timestamp at time zone 'America/Mexico_City')
$$;
revoke execute on function public.horas_jornada(date) from public, anon;
grant execute on function public.horas_jornada(date) to authenticated;

-- Cada día de la semana con el horario de siempre (sin feriados ni días especiales) y lo que da:
-- la base para repartir por día las horas por semana de cada área, y lo que ve la gerencia al editar.
create or replace function public.jornadas_taller()
returns table (dia int, entrada text, salida text, horas numeric)
language sql stable security invoker set search_path = public as $$
  with c as (select coalesce((select valor from configuracion where clave = 'horas_taller'), '{}'::jsonb) v)
  select h.key::int, h.value->>0, h.value->>1,
    round((extract(epoch from (h.value->>1)::time - (h.value->>0)::time)
      - coalesce((select sum(greatest(extract(epoch from least((h.value->>1)::time, (dsc->>'a')::time) - greatest((h.value->>0)::time, (dsc->>'de')::time)), 0)
                   * coalesce((dsc->>'minutos')::numeric * 60 / nullif(extract(epoch from (dsc->>'a')::time - (dsc->>'de')::time), 0), 1))
                  from jsonb_array_elements(coalesce(c.v->'descansos', '[]'::jsonb)) dsc), 0))::numeric / 3600, 2)
  from c, jsonb_each(coalesce(c.v->'horario', '{}'::jsonb)) h
  where jsonb_typeof(h.value) = 'array'
  order by 1
$$;
revoke execute on function public.jornadas_taller() from public, anon;
grant execute on function public.jornadas_taller() to authenticated;

create or replace function public.horas_semana_taller()
returns numeric language sql stable security invoker set search_path = public as $$
  select coalesce(sum(horas), 0) from jornadas_taller()
$$;
revoke execute on function public.horas_semana_taller() from public, anon;
grant execute on function public.horas_semana_taller() to authenticated;

-- ¿El taller está en horario ahorita? Y si no, cuándo vuelve a contar. Con eso la pantalla dice
-- «fuera de horario» en vez de «trabajando» cuando alguien dejó su tiempo abierto al irse.
create or replace function public.horario_taller_ahora()
returns jsonb language sql stable security invoker set search_path = public as $$
  with w as (
    select v.inicio, v.fin
    from generate_series(hoy_mx() - 1, hoy_mx() + 30, interval '1 day') g
    cross join lateral ventana_taller(g::date) v
  )
  select jsonb_build_object(
    'modo', coalesce((select valor->>'modo' from configuracion where clave = 'horas_taller'), 'horario'),
    'en_horario', exists (select 1 from w where now() >= w.inicio and now() < w.fin),
    'cierra', (select min(w.fin) from w where now() >= w.inicio and now() < w.fin),
    'abre', (select min(w.inicio) from w where w.inicio > now()))
$$;
revoke execute on function public.horario_taller_ahora() from public, anon;
grant execute on function public.horario_taller_ahora() to authenticated;

-- Una entrada y una salida que se entiendan, y la salida después de la entrada.
create or replace function public._revisar_tramo_horario(p jsonb, p_que text)
returns jsonb language plpgsql immutable set search_path = public as $$
declare v_de time; v_a time;
begin
  if jsonb_typeof(p) is distinct from 'array' or jsonb_array_length(p) <> 2 then
    raise exception 'Falta la entrada o la salida de %', p_que;
  end if;
  begin
    v_de := (p->>0)::time; v_a := (p->>1)::time;
  exception when others then
    raise exception 'La hora de % no se entiende (escríbela como 08:00 o 17:30)', p_que;
  end;
  if v_de is null or v_a is null then raise exception 'Falta la entrada o la salida de %', p_que; end if;
  if v_a <= v_de then
    raise exception 'En %, la salida (%) tiene que ser después de la entrada (%)', p_que, to_char(v_a, 'HH24:MI'), to_char(v_de, 'HH24:MI');
  end if;
  return jsonb_build_array(to_char(v_de, 'HH24:MI'), to_char(v_a, 'HH24:MI'));
end $$;
revoke execute on function public._revisar_tramo_horario(jsonb, text) from public, anon;

-- La gerencia de producción pone el horario, los descansos y los días con otro horario
-- (configuracion solo la escribe sistemas). Se guarda limpio: horas como «08:00».
create or replace function public.poner_horario_taller(p_horario jsonb, p_descansos jsonb, p_especiales jsonb default '{}')
returns void language plpgsql security definer set search_path = public as $$
declare
  r record; v_h jsonb := '{}'; v_d jsonb := '[]'; v_e jsonb := '{}'; v_t jsonb; v_min numeric; v_dia date;
  v_nombres text[] := array['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
begin
  if not puede('produccion', 3) then raise exception 'Sin permiso' using errcode = '42501'; end if;

  for r in select * from jsonb_each(coalesce(p_horario, '{}')) loop
    if r.key not in ('1', '2', '3', '4', '5', '6', '7') then raise exception 'Día de la semana desconocido: %', r.key; end if;
    continue when jsonb_typeof(r.value) = 'null';
    v_h := v_h || jsonb_build_object(r.key, _revisar_tramo_horario(r.value, 'el ' || v_nombres[r.key::int]));
  end loop;
  if v_h = '{}' then raise exception 'El taller tiene que trabajar al menos un día'; end if;

  for r in select value v, ordinality n from jsonb_array_elements(coalesce(p_descansos, '[]')) with ordinality loop
    v_t := _revisar_tramo_horario(jsonb_build_array(r.v->>'de', r.v->>'a'), 'el descanso ' || r.n);
    v_min := nullif(r.v->>'minutos', '')::numeric;
    if v_min is not null and (v_min <= 0 or v_min > extract(epoch from (v_t->>1)::time - (v_t->>0)::time) / 60) then
      raise exception 'El descanso de % a % no puede durar % min', v_t->>0, v_t->>1, v_min;
    end if;
    v_d := v_d || jsonb_build_array(jsonb_build_object('de', v_t->>0, 'a', v_t->>1)
                  || case when v_min is not null and v_min < extract(epoch from (v_t->>1)::time - (v_t->>0)::time) / 60
                          then jsonb_build_object('minutos', v_min) else '{}' end);
  end loop;

  for r in select * from jsonb_each(coalesce(p_especiales, '{}')) loop
    begin v_dia := r.key::date; exception when others then raise exception 'Fecha desconocida: %', r.key; end;
    v_e := v_e || jsonb_build_object(to_char(v_dia, 'YYYY-MM-DD'),
      case when jsonb_typeof(r.value) = 'null' then 'null'::jsonb else _revisar_tramo_horario(r.value, 'el ' || to_char(v_dia, 'DD/MM/YYYY')) end);
  end loop;

  update configuracion set valor = valor || jsonb_build_object('horario', v_h, 'descansos', v_d, 'especiales', v_e)
  where clave = 'horas_taller';
end $$;
revoke execute on function public.poner_horario_taller(jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.poner_horario_taller(jsonb, jsonb, jsonb) to authenticated;

-- El plan del Gantt (mismo cuerpo que en 163) con la jornada del horario del taller.
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
  v_jor numeric; v_sem numeric := horas_semana_taller();
begin
  -- Las fechas las ve quien ve producción (el vendedor, en su pedido); las horas, solo la planta.
  if not (puede('produccion', 1) or puede('procesos', 1)) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  v_horas := puede('produccion', 2) or puede('procesos', 1);

  -- Lo que da cada área en un día es su parte de la semana: con 42.5 h de taller a la semana,
  -- un día de 8.5 h da la quinta parte, y un sábado de tiempo extra de 6 h, lo suyo.
  select array_agg(id order by orden), array_agg(capacidad_horas_semana / nullif(v_sem, 0) order by orden)
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
         array_agg(greatest(gente, 2)::numeric order by n),
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
    -- Un día cuenta lo que dura su jornada en el horario del taller (0 si no se trabaja).
    v_jor := horas_jornada(v_dia);
    if v_jor > 0 then
      v_disp := array(select c * v_jor from unnest(e_cap) with ordinality u(c, pos) order by u.pos);
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
        v_toma := least(a_rem[i], a_rate[i] * v_jor, v_disp[v_ei]);
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

-- =============================================================================
-- Cuánto lleva una etapa en proceso, y quién la trabaja, a la vista.
--
-- Luis dijo que la Pailería de OP-2026-00023 va a 3/4 con Genaro y Juan Pablo; el ERP la
-- enseñaba en 0 % y sin nadie. Dos huecos:
--   * El avance de una orden solo contaba etapas TERMINADAS: una Pailería de 400 h a 3/4
--     pesaba 0. Y el plan del Gantt la daba completa por hacer (nadie había marcado horas).
--     Ahora el piso reporta cuánto lleva la etapa (¼, ½, ¾, casi) desde la terminal o la
--     orden: cuenta en el avance, en lo que le falta a cada área y en el plan.
--   * El tablero y la TV ponían a quien marcó en la terminal. Con las cuadrillas cargadas de la
--     hoja nadie ha marcado: ahora sale la cuadrilla (quien tiene su tiempo abierto o, si nadie,
--     la planeada).
-- =============================================================================

alter table public.op_operaciones add column if not exists avance numeric(4,3) check (avance >= 0 and avance < 1);
alter table public.op_operaciones add column if not exists avance_en timestamptz;
alter table public.op_operaciones add column if not exists avance_por uuid references public.perfiles(id);

-- Un nombre que se lea de lejos: el de pila (los dos si el nombre completo trae cuatro palabras:
-- «Juan Pablo», «Luis Fernando»).
create or replace function public.nombre_de_pila(p_nombre text) returns text
language sql immutable as $$
  select case when array_length(regexp_split_to_array(trim(p_nombre), '\s+'), 1) >= 4
              then array_to_string((regexp_split_to_array(trim(p_nombre), '\s+'))[1:2], ' ')
              else split_part(trim(p_nombre), ' ', 1) end
$$;

-- Quién trabaja una etapa: «Genaro y Juan Pablo», «Leonardo e Isaías». Primero quien tiene su
-- tiempo abierto; si nadie, la cuadrilla planeada. Definer porque el tablero y la TV no leen la
-- ficha de los empleados (solo salen nombres de pila).
create or replace function public.cuadrilla_de(p_operacion uuid) returns text
language plpgsql stable security definer set search_path = public as $$
declare v text[]; v_sin int; n int;
begin
  select array_agg(nombre_de_pila(e.nombre) order by e.nombre) filter (where e.id is not null),
         coalesce(sum(t.personas) filter (where t.empleado_id is null), 0)
  into v, v_sin
  from op_tiempos t left join empleados e on e.id = t.empleado_id
  where t.operacion_id = p_operacion and t.fin is null;
  if v is null and v_sin = 0 then
    select array_agg(nombre_de_pila(e.nombre) order by e.nombre) into v
    from op_asignaciones a join empleados e on e.id = a.empleado_id where a.operacion_id = p_operacion;
  end if;
  v := coalesce(v, '{}');
  if v_sin > 0 then v := v || (v_sin || ' sin nombre'); end if;
  n := coalesce(array_length(v, 1), 0);
  if n = 0 then return null; end if;
  if n = 1 then return v[1]; end if;
  -- «y» se vuelve «e» antes de i o hi (Leonardo e Isaías).
  return array_to_string(v[1:n - 1], ', ') || case when v[n] ~* '^h?[ií]' then ' e ' else ' y ' end || v[n];
end $$;
revoke execute on function public.cuadrilla_de(uuid) from public, anon;
grant execute on function public.cuadrilla_de(uuid) to authenticated;

-- El piso dice cuánto lleva (de 0 a menos de 1: acabar es «Terminar»).
create or replace function public.reportar_avance(p_operacion uuid, p_avance numeric)
returns void language plpgsql security definer set search_path = public as $$
declare x op_operaciones; v_etapa text;
begin
  if not puede('produccion', 2) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  select * into x from op_operaciones where id = p_operacion;
  if x.id is null then raise exception 'No existe esa etapa'; end if;
  if x.estado not in ('en_proceso', 'pausada') then raise exception 'Solo se reporta el avance de una etapa empezada'; end if;
  if p_avance is null or p_avance < 0 or p_avance >= 1 then
    raise exception 'El avance va de 0 a menos de 100 %%: para acabar, «Terminar»' using errcode = '23514';
  end if;
  select nombre into v_etapa from etapas where id = x.etapa_id;
  update op_operaciones set avance = round(p_avance, 3), avance_en = now(), avance_por = auth.uid() where id = p_operacion;
  insert into op_eventos (orden_id, operacion_id, tipo, nota, usuario_id)
  values (x.orden_id, x.id, 'nota', v_etapa || ' lleva ' || round(p_avance * 100) || ' %', auth.uid());
end $$;
revoke execute on function public.reportar_avance(uuid, numeric) from public, anon;
grant execute on function public.reportar_avance(uuid, numeric) to authenticated;

-- Lo que le falta a cada área ya descuenta lo que lleva lo que está en proceso.
create or replace view public.v_carga_etapas with (security_invoker = true) as
select e.id etapa_id, e.nombre, e.color, e.orden, e.capacidad_horas_semana,
  coalesce(t.horas_pendientes, 0) as horas_pendientes,
  coalesce(t.en_proceso, 0) as en_proceso,
  coalesce(t.pausadas, 0) as pausadas,
  coalesce(t.en_espera, 0) as en_espera,
  coalesce(pl.horas, 0) as horas_planeadas
from public.etapas e
left join lateral (
  select sum(x.horas_estimadas * (1 - coalesce(x.avance, 0))) filter (where x.estado <> 'terminada') horas_pendientes,
         count(*) filter (where x.estado = 'en_proceso') en_proceso,
         count(*) filter (where x.estado = 'pausada') pausadas,
         count(*) filter (where x.estado = 'pendiente') en_espera
  from public.op_operaciones x join public.ordenes_produccion o on o.id = x.orden_id
  where x.etapa_id = e.id and o.estado in ('liberada', 'en_proceso') and o.en_espera_motivo is null) t on true
left join lateral (
  select sum(x.horas_estimadas) horas
  from public.op_operaciones x join public.ordenes_produccion o on o.id = x.orden_id
  where x.etapa_id = e.id and o.estado = 'planeada' and o.en_espera_motivo is null) pl on true
where e.activa;

-- El tablero: el avance cuenta lo que lleva lo que está en proceso, y cada etapa activa trae su cuadrilla.
create or replace view public.v_tablero_produccion with (security_invoker = true) as
SELECT o.id,
    o.folio,
    o.numero_serie,
    o.estado,
    o.prioridad,
    o.fecha_compromiso,
    o.inicio_plan,
    o.cantidad,
    a.clave,
    a.nombre AS equipo,
    a.imagen_url,
    pb.folio AS pedido_folio,
    pb.cliente,
    h.horas_totales,
    h.horas_terminadas,
        CASE
            WHEN h.horas_totales = 0::numeric THEN 0::numeric
            ELSE round(100::numeric * (h.horas_terminadas + h.horas_avanzadas) / h.horas_totales)
        END AS avance,
    ( SELECT e.nombre
           FROM op_operaciones x
             JOIN etapas e ON e.id = x.etapa_id
          WHERE x.orden_id = o.id AND (x.estado = ANY (ARRAY['en_proceso'::estado_operacion, 'pausada'::estado_operacion]))
          ORDER BY e.orden
         LIMIT 1) AS etapa_actual,
    sig.nombre AS siguiente_etapa,
    h.pausada,
        CASE
            WHEN o.estado = ANY (ARRAY['terminada'::estado_op, 'entregada'::estado_op]) THEN 0::bigint
            ELSE COALESCE(fo.faltantes, 0::bigint)
        END AS materiales_faltantes,
    o.fecha_compromiso - hoy_planta() AS dias_restantes,
    o.fecha_compromiso < hoy_planta() AND (o.estado <> ALL (ARRAY['terminada'::estado_op, 'entregada'::estado_op])) AND o.en_espera_motivo IS NULL AS atrasada,
    o.revisado_ingenieria_en IS NOT NULL AS revisada_ingenieria,
    o.revisado_almacen_en IS NOT NULL AS revisada_almacen,
    ( SELECT max(ev.en) AS max
           FROM op_eventos ev
          WHERE ev.orden_id = o.id) AS ultimo_movimiento,
    o.pedido_id,
    o.pedido_id IS NULL AS para_stock,
    COALESCE(( SELECT jsonb_agg(jsonb_build_object('id', e.id, 'nombre', e.nombre, 'color', e.color, 'estado', x.estado, 'responsable', x.responsable, 'inicio', x.inicio,
               'cuadrilla', cuadrilla_de(x.id), 'avance', x.avance) ORDER BY e.orden) AS jsonb_agg
           FROM op_operaciones x
             JOIN etapas e ON e.id = x.etapa_id
          WHERE x.orden_id = o.id AND (x.estado = ANY (ARRAY['en_proceso'::estado_operacion, 'pausada'::estado_operacion]))), '[]'::jsonb) AS etapas_activas,
    sig.id AS siguiente_etapa_id,
    sig.color AS siguiente_etapa_color,
    h.horas_totales - h.horas_terminadas - h.horas_avanzadas AS horas_pendientes,
    o.material_apartado_en IS NOT NULL AS material_apartado,
        CASE
            WHEN o.estado = ANY (ARRAY['terminada'::estado_op, 'entregada'::estado_op]) THEN 0::bigint
            ELSE COALESCE(fo.sin_pedir, 0::bigint)
        END AS faltantes_sin_pedir,
    o.terminada_en,
    o.creado_en,
    o.notas,
    o.en_espera_motivo,
    o.en_espera_desde
   FROM ordenes_produccion o
     JOIN articulos a ON a.id = o.articulo_id
     LEFT JOIN LATERAL pedido_de_orden(o.pedido_id) pb(folio, cliente) ON true
     LEFT JOIN faltantes_de_ordenes() fo ON fo.orden_id = o.id
     LEFT JOIN LATERAL ( SELECT COALESCE(sum(x.horas_estimadas), 0::numeric) AS horas_totales,
            COALESCE(sum(x.horas_estimadas) FILTER (WHERE x.estado = 'terminada'::estado_operacion), 0::numeric) AS horas_terminadas,
            -- Lo que lleva lo que está en proceso, según reportó el piso (¼, ½, ¾…).
            COALESCE(sum(x.horas_estimadas * x.avance) FILTER (WHERE x.estado = ANY (ARRAY['en_proceso'::estado_operacion, 'pausada'::estado_operacion])), 0::numeric) AS horas_avanzadas,
            COALESCE(bool_or(x.estado = 'pausada'::estado_operacion), false) AS pausada
           FROM op_operaciones x
          WHERE x.orden_id = o.id) h ON true
     LEFT JOIN LATERAL ( SELECT e.id,
            e.nombre,
            e.color
           FROM op_operaciones x
             JOIN etapas e ON e.id = x.etapa_id
          WHERE x.orden_id = o.id AND x.estado = 'pendiente'::estado_operacion
          ORDER BY e.orden
         LIMIT 1) sig ON true
  WHERE o.estado <> ALL (ARRAY['entregada'::estado_op, 'cancelada'::estado_op]);

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
     LEFT JOIN LATERAL ( SELECT sum(extract(epoch from coalesce(ti.fin, now()) - ti.inicio) / 3600 * ti.personas) AS horas
           FROM op_tiempos ti
          WHERE ti.operacion_id = x.id) hh ON true
  WHERE (t.estado = ANY (ARRAY['liberada'::estado_op, 'en_proceso'::estado_op])) AND x.estado <> 'terminada'::estado_operacion AND NOT (EXISTS ( SELECT 1
           FROM ordenes_produccion oe
          WHERE oe.id = x.orden_id AND oe.en_espera_motivo IS NOT NULL));

-- El plan del Gantt: mismo cuerpo que en 158; cambia «lo que falta» de lo que está en proceso.
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

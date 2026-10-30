-- =============================================================================
-- Mantenimiento, primera entrega de la junta con Esteban (30 oct).
--
-- 1. Preventivos por mes. Esteban programa «el primer lunes de cada mes», y el plan solo sabía
--    «cada N días»: con cada 31 días la fecha se iba corriendo, caía en sábado o en feriado, y él
--    terminaba cancelando la orden y capturándola otra vez (36 canceladas por «ajustes en el
--    calendario» en dos semanas). Ahora un plan puede ser:
--      dias        cada N días desde el último (como antes);
--      mes_semana  el primer/segundo/tercer/cuarto/último <día de la semana> de cada N meses;
--      mes_dia     el día D de cada N meses (el 31 en un mes de 30 es el 30).
--    Y con solo_laborables (encendido para todos) la fecha nunca cae en día que el taller no
--    trabaja (fin de semana, feriado de ley, descanso de la empresa): pasa al siguiente día que sí,
--    y en los planes por mes, si ese ya es del mes que sigue, al anterior. Así el preventivo de
--    enero nunca se vuelve el de febrero ni el mes se salta.
--    Si cambian el calendario de un plan, la orden que ya salió y nadie ha tocado se mueve a la
--    fecha nueva (o se cancela si todavía no toca y se vuelve a generar a su tiempo): lo que
--    Esteban hacía a mano.
-- 3. Categorías libres y el tipo «Equipo de oficina» (la pantalla deja escribir una categoría).
-- 5. Dar de baja lo que ya no conviene reparar: con motivo y fecha, cierra lo que tenía abierto,
--    apaga sus planes y sale de la lista y de las métricas desde ese día. Se puede reactivar.
-- 10. MTBF, MTTR, disponibilidad y horas fuera en horas laborales del taller (horas_en_horario):
--    una máquina que se para el viernes a las 5 y se arregla el lunes a las 9 estuvo fuera una
--    hora de trabajo, no 64. Es lo que pidió Esteban y lo que ya usan los indicadores de bonos (208).
-- =============================================================================

-- ---------------------------------------------------------------- 1. planes por mes
alter table public.planes_preventivos
  add column if not exists modo text not null default 'dias',
  add column if not exists cada_meses int,
  add column if not exists semana_mes int,
  add column if not exists dia_semana int,
  add column if not exists dia_mes int,
  add column if not exists solo_laborables boolean not null default true;

alter table public.planes_preventivos drop constraint if exists planes_preventivos_check;
alter table public.planes_preventivos drop constraint if exists planes_preventivos_regla;
-- coalesce: un check con null pasa, y un plan por mes sin su día no debe pasar.
alter table public.planes_preventivos add constraint planes_preventivos_regla check (coalesce(
  case modo
    when 'dias' then (cada_dias is not null or cada_horas is not null)
    when 'mes_semana' then cada_meses between 1 and 24 and semana_mes between 1 and 5 and dia_semana between 1 and 7
    when 'mes_dia' then cada_meses between 1 and 24 and dia_mes between 1 and 31
    else false end, false));
comment on column public.planes_preventivos.semana_mes is '1 a 4 = primer a cuarto; 5 = el último del mes';
comment on column public.planes_preventivos.dia_semana is '1 = lunes … 7 = domingo';

-- Si el taller trabaja ese día: las mismas reglas que ventana_taller (166), en el mismo orden.
-- No la llama porque cada llamada a ventana_taller se vuelve a planear y, leída como la persona,
-- revisa sus roles: 3 ms por día, y la lista de máquinas pasó de 20 ms a 2 s. Así, con sus planes
-- guardados, es una fracción de milisegundo. 212_mantenimiento_mensual_y_baja.sql compara las dos
-- día por día, para que no se separen. Solo dice sí o no.
create or replace function public.dia_laborable(p_dia date) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare v jsonb; k text := to_char(p_dia, 'YYYY-MM-DD');
begin
  select valor into v from configuracion where clave = 'horas_taller';
  -- Un día con otro horario manda, aunque sea feriado (si deciden trabajarlo).
  if v->'especiales' ? k then return jsonb_typeof(v->'especiales'->k) = 'array'; end if;
  if p_dia in (select festivos_lft(extract(year from p_dia)::int)) then return false; end if;
  if coalesce((select valor->'descansos_empresa' from configuracion where clave = 'calendario_laboral'), '[]'::jsonb) @> to_jsonb(k) then
    return false;
  end if;
  return coalesce(jsonb_typeof(coalesce(v->'horario',
    '{"1": ["08:00", "17:30"], "2": ["08:00", "17:30"], "3": ["08:00", "17:30"], "4": ["08:00", "17:30"], "5": ["08:00", "17:30"]}'::jsonb)
    -> (extract(isodow from p_dia)::int)::text) = 'array', false);
end $$;
revoke execute on function public.dia_laborable(date) from public, anon;
grant execute on function public.dia_laborable(date) to authenticated;

-- La fecha que toca según la regla. p_plan, si viene, cuenta también la fecha de la última orden
-- cerrada de ese plan: si el preventivo de noviembre se hizo el 28 de octubre, el siguiente es el
-- de diciembre, no otra vez el de noviembre.
create or replace function public.preventivo_fecha(p_modo text, p_ultima date, p_cada_dias int, p_cada_meses int,
  p_semana_mes int, p_dia_semana int, p_dia_mes int, p_solo_laborables boolean, p_plan uuid default null)
returns date language plpgsql stable security invoker set search_path = public as $$
declare v_ancla date; v_mes date; v_fin date; v_d date; v_x date; i int;
begin
  if p_modo = 'dias' then
    if p_cada_dias is null or p_ultima is null then return null; end if;
    v_d := p_ultima + p_cada_dias;
    if p_solo_laborables then
      v_x := v_d; i := 0;
      while i < 31 and not dia_laborable(v_x) loop v_x := v_x + 1; i := i + 1; end loop;
      if i < 31 then v_d := v_x; end if;
    end if;
    return v_d;
  end if;
  if p_modo not in ('mes_semana', 'mes_dia') or p_ultima is null then return null; end if;

  select greatest(p_ultima, max(o.vence)) into v_ancla
  from ordenes_mantenimiento o where p_plan is not null and o.plan_id = p_plan and o.estado = 'cerrada';
  v_ancla := coalesce(v_ancla, p_ultima);
  -- El mes siguiente al último que se hizo (o a los N meses).
  v_mes := (date_trunc('month', v_ancla) + make_interval(months => coalesce(p_cada_meses, 1)))::date;
  v_fin := (v_mes + interval '1 month' - interval '1 day')::date;
  if p_modo = 'mes_dia' then
    v_d := v_mes + least(p_dia_mes, extract(day from v_fin)::int) - 1;
  elsif p_semana_mes = 5 then
    v_d := v_fin - ((extract(isodow from v_fin)::int - p_dia_semana + 7) % 7);
  else
    v_d := v_mes + ((p_dia_semana - extract(isodow from v_mes)::int + 7) % 7) + 7 * (p_semana_mes - 1);
  end if;

  if p_solo_laborables and not dia_laborable(v_d) then
    -- Al siguiente día que se trabaja; si ya es del otro mes, al anterior.
    v_x := v_d + 1;
    while v_x <= v_fin loop
      if dia_laborable(v_x) then return v_x; end if;
      v_x := v_x + 1;
    end loop;
    v_x := v_d - 1;
    while v_x >= v_mes loop
      if dia_laborable(v_x) then return v_x; end if;
      v_x := v_x - 1;
    end loop;
  end if;
  return v_d;
end $$;
revoke execute on function public.preventivo_fecha(text, date, int, int, int, int, int, boolean, uuid) from public, anon;
grant execute on function public.preventivo_fecha(text, date, int, int, int, int, int, boolean, uuid) to authenticated;

-- plpgsql y no sql: una función sql con search_path se vuelve a planear en cada renglón (1 ms por
-- plan en v_maquinas); plpgsql guarda su plan.
create or replace function public.preventivo_proxima(p public.planes_preventivos) returns date
language plpgsql stable security invoker set search_path = public as $$
begin
  return preventivo_fecha(p.modo, p.ultima_fecha, p.cada_dias, p.cada_meses, p.semana_mes, p.dia_semana, p.dia_mes,
                          p.solo_laborables, p.id);
end $$;
revoke execute on function public.preventivo_proxima(public.planes_preventivos) from public, anon;
grant execute on function public.preventivo_proxima(public.planes_preventivos) to authenticated;

-- La vista calcula la fecha una vez por plan y la usa para todo lo demás: el «offset 0» evita que
-- Postgres aplane el lateral y repita la función en cada columna que la usa (4 veces por plan).
-- Columnas nuevas al final: v_maquinas y las pantallas leen las de antes.
create or replace view public.v_planes_preventivos with (security_invoker = true) as
select p.id, p.maquina_id, m.numero, m.nombre as maquina, m.horas_uso as horas_actuales, p.nombre, p.tareas,
  p.cada_dias, p.cada_horas, p.ultima_fecha, p.ultima_horas, p.anticipacion_dias, p.activo,
  px.fecha as proxima_fecha,
  p.ultima_horas + p.cada_horas as proximas_horas,
  px.fecha - public.hoy_planta() as dias_restantes,
  p.ultima_horas + p.cada_horas - m.horas_uso as horas_restantes,
  case when px.fecha < public.hoy_planta()
         or (p.cada_horas is not null and m.horas_uso >= p.ultima_horas + p.cada_horas) then 'vencido'
       when px.fecha - p.anticipacion_dias <= public.hoy_planta()
         or (p.cada_horas is not null and m.horas_uso >= p.ultima_horas + p.cada_horas * 0.9) then 'por_vencer'
       else 'al_dia' end as situacion,
  o.id as orden_id, o.folio as orden_folio, o.estado as orden_estado,
  p.rutina_id, ru.nombre as rutina, jsonb_array_length(ru.puntos) as rutina_puntos,
  p.modo, p.cada_meses, p.semana_mes, p.dia_semana, p.dia_mes, p.solo_laborables
from public.planes_preventivos p
join public.maquinas m on m.id = p.maquina_id
cross join lateral (select public.preventivo_proxima(p) as fecha offset 0) px
left join public.ordenes_mantenimiento o on o.plan_id = p.id and o.estado in ('pendiente', 'en_proceso')
left join public.rutinas_mantenimiento ru on ru.id = p.rutina_id;

create or replace function public.generar_preventivos(p_maquina uuid default null) returns int
language plpgsql security definer set search_path = public as $$
declare v_n int;
begin
  -- Sin usuario = pg_cron o el sistema. Con usuario, cualquiera que vea mantenimiento (solo crea lo vencido).
  if auth.uid() is not null and not puede('mantenimiento', 1) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  insert into ordenes_mantenimiento (maquina_id, tipo, falla, plan_id, vence, vence_horas, reportado_por, reportado_por_nombre)
  select x.maquina_id, 'preventivo', x.nombre || coalesce(': ' || nullif(trim(x.tareas), ''), ''), x.id,
    x.proxima, x.ultima_horas + x.cada_horas, null, 'Plan preventivo'
  from (select p.*, preventivo_proxima(p) proxima, m.horas_uso
        from planes_preventivos p join maquinas m on m.id = p.maquina_id
        where p.activo and m.estado <> 'baja' and (p_maquina is null or p.maquina_id = p_maquina)
          and not exists (select 1 from ordenes_mantenimiento o where o.plan_id = p.id and o.estado in ('pendiente', 'en_proceso'))
        offset 0) x
  where (x.proxima is not null and x.proxima - x.anticipacion_dias <= hoy_planta())
     or (x.cada_horas is not null and x.horas_uso >= x.ultima_horas + x.cada_horas)
  on conflict do nothing;
  get diagnostics v_n = row_count;
  return v_n;
end $$;

-- Cambiaron el calendario de un plan: su orden pendiente (que nadie ha empezado ni tocado) sigue
-- al plan. Si con la regla nueva ya toca, cambia su fecha; si todavía no, se cancela y el plan la
-- vuelve a generar a su tiempo.
create or replace function public.plan_preventivo_reprogramar() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_prox date; v_horas numeric; o ordenes_mantenimiento;
begin
  if (new.modo, new.cada_dias, new.cada_meses, new.semana_mes, new.dia_semana, new.dia_mes, new.solo_laborables,
      new.ultima_fecha, new.anticipacion_dias, new.cada_horas, new.ultima_horas)
     is not distinct from
     (old.modo, old.cada_dias, old.cada_meses, old.semana_mes, old.dia_semana, old.dia_mes, old.solo_laborables,
      old.ultima_fecha, old.anticipacion_dias, old.cada_horas, old.ultima_horas) then
    return null;
  end if;
  select * into o from ordenes_mantenimiento where plan_id = new.id and estado = 'pendiente' for update;
  if o.id is null then return null; end if;
  v_prox := preventivo_proxima(new);
  select horas_uso into v_horas from maquinas where id = new.maquina_id;
  if (v_prox is not null and v_prox - new.anticipacion_dias <= hoy_planta())
     or (new.cada_horas is not null and v_horas >= new.ultima_horas + new.cada_horas)
     -- Si ya le capturaron algo (refacciones, checklist, fotos, diagnóstico), no se cancela: solo cambia la fecha.
     or o.inicio_en is not null or o.diagnostico is not null
     or exists (select 1 from servicio_materiales x where x.mantenimiento_id = o.id and x.estado <> 'cancelado')
     or exists (select 1 from orden_checklist c where c.orden_id = o.id and c.bien is not null)
     or exists (select 1 from servicio_evidencias x where x.mantenimiento_id = o.id) then
    update ordenes_mantenimiento set vence = v_prox, vence_horas = new.ultima_horas + new.cada_horas where id = o.id;
  else
    update ordenes_mantenimiento set estado = 'cancelada', motivo_cancelacion = 'Se cambió el calendario del plan; sale otra vez cuando toque'
    where id = o.id;
  end if;
  return null;
end $$;
drop trigger if exists reprogramar on public.planes_preventivos;
create trigger reprogramar after update on public.planes_preventivos
  for each row execute function public.plan_preventivo_reprogramar();

-- ---------------------------------------------------------------- 3. tipo «Equipo de oficina»
alter table public.maquinas drop constraint if exists maquinas_tipo_check;
alter table public.maquinas add constraint maquinas_tipo_check
  check (tipo in ('maquina', 'herramienta', 'vehiculo', 'instalacion', 'oficina'));

-- ---------------------------------------------------------------- 5. dar de baja
alter table public.maquinas
  add column if not exists baja_en date,
  add column if not exists motivo_baja text,
  add column if not exists baja_por uuid references public.perfiles(id);

create or replace function public.dar_de_baja_maquina(p_maquina uuid, p_motivo text) returns void
language plpgsql security definer set search_path = public as $$
declare m maquinas; v_quien text; v_motivo text := nullif(trim(p_motivo), '');
begin
  if not puede('mantenimiento', 3) then raise exception 'Solo mantenimiento o la gerencia dan de baja una máquina' using errcode = '42501'; end if;
  select * into m from maquinas where id = p_maquina for update;
  if m.id is null then raise exception 'No existe esa máquina'; end if;
  if m.estado = 'baja' then raise exception '% ya está dada de baja', m.nombre; end if;
  if coalesce(length(v_motivo), 0) < 5 then raise exception 'Escribe por qué se da de baja (por ejemplo: «ya no conviene repararla»)'; end if;
  select coalesce(e.nombre, r.persona) into v_quien from resguardos r left join empleados e on e.id = r.empleado_id
  where r.maquina_id = p_maquina and r.devuelto_en is null;
  if v_quien is not null then raise exception '% la tiene %: recíbela en Resguardos antes de darla de baja', m.nombre, v_quien; end if;

  -- Lo abierto ya no se va a hacer: se cancela con el mismo motivo, y si estaba parada, el paro termina hoy.
  update servicio_materiales set estado = 'cancelado'
  where estado = 'pendiente' and mantenimiento_id in (select id from ordenes_mantenimiento where maquina_id = p_maquina and estado in ('pendiente', 'en_proceso'));
  update ordenes_mantenimiento set estado = 'cancelada', motivo_cancelacion = 'Se dio de baja la máquina: ' || v_motivo,
    fuera_hasta = case when fuera_desde is not null and fuera_hasta is null then now() else fuera_hasta end
  where maquina_id = p_maquina and estado in ('pendiente', 'en_proceso');
  update planes_preventivos set activo = false where maquina_id = p_maquina and activo;
  update maquinas set estado = 'baja', baja_en = hoy_planta(), motivo_baja = v_motivo, baja_por = auth.uid(), asignada_a = null
  where id = p_maquina;
end $$;
revoke execute on function public.dar_de_baja_maquina(uuid, text) from public, anon;
grant execute on function public.dar_de_baja_maquina(uuid, text) to authenticated;

create or replace function public.reactivar_maquina(p_maquina uuid) returns void
language plpgsql security definer set search_path = public as $$
declare m maquinas;
begin
  if not puede('mantenimiento', 3) then raise exception 'Solo mantenimiento o la gerencia reactivan una máquina' using errcode = '42501'; end if;
  select * into m from maquinas where id = p_maquina for update;
  if m.id is null then raise exception 'No existe esa máquina'; end if;
  if m.estado <> 'baja' then raise exception '% no está dada de baja', m.nombre; end if;
  -- Los planes se quedan apagados: al volver, mantenimiento decide cuáles siguen.
  update maquinas set estado = 'operando', baja_en = null, motivo_baja = null, baja_por = null where id = p_maquina;
  perform recalcular_estado_maquina(p_maquina);
end $$;
revoke execute on function public.reactivar_maquina(uuid) from public, anon;
grant execute on function public.reactivar_maquina(uuid) to authenticated;

-- v_maquinas con la baja al final.
create or replace view public.v_maquinas with (security_invoker = true) as
with personal as (select * from public.personal_servicio())
select m.id, m.numero, m.nombre, m.tipo, m.categoria, m.marca, m.modelo, m.numero_serie, m.etapa_id, et.nombre as etapa,
  et.color as etapa_color, m.ubicacion, m.estado, m.critica, m.prestable, m.usa_horometro, m.horas_uso, m.horas_actualizado_en,
  m.foto_ruta, m.fecha_alta, m.notas,
  ab.id as orden_id, ab.folio as orden_folio, ab.tipo as orden_tipo, ab.estado as orden_estado, ab.falla as orden_falla,
  ab.reportado_en as orden_desde, ab.fuera_desde as parada_desde,
  (select count(*) from public.ordenes_mantenimiento o where o.maquina_id = m.id and o.estado in ('pendiente', 'en_proceso'))::int as ordenes_abiertas,
  (select count(*) from public.ordenes_mantenimiento o where o.maquina_id = m.id and o.tipo = 'correctivo' and o.estado <> 'cancelada'
     and o.reportado_en > now() - interval '12 months')::int as fallas_12m,
  coalesce((select round((sum(extract(epoch from coalesce(o.fuera_hasta, now()) - greatest(o.fuera_desde, now() - interval '12 months'))) / 3600.0)::numeric, 1)
            from public.ordenes_mantenimiento o where o.maquina_id = m.id and o.estado <> 'cancelada' and o.fuera_desde is not null
              and coalesce(o.fuera_hasta, now()) > now() - interval '12 months'), 0) as horas_paro_12m,
  (select max(o.reportado_en) from public.ordenes_mantenimiento o where o.maquina_id = m.id and o.tipo = 'correctivo' and o.estado <> 'cancelada') as ultima_falla,
  pv.proxima_fecha as preventivo_fecha, pv.proximas_horas as preventivo_horas, pv.nombre as preventivo, pv.situacion as preventivo_situacion,
  rg.id as resguardo_id, coalesce(pp.nombre, rg.persona) as prestada_a, rg.entregado_en as prestada_desde,
  m.criticidad, m.tipo_mantenimiento, m.especialidad, m.tipo_equipo, m.asignada_a, pa.nombre as asignada_nombre,
  m.baja_en, m.motivo_baja, pb.nombre as baja_por_nombre
from public.maquinas m
left join public.etapas et on et.id = m.etapa_id
left join lateral (select o.* from public.ordenes_mantenimiento o where o.maquina_id = m.id and o.estado in ('pendiente', 'en_proceso')
                   order by (o.fuera_desde is not null and o.fuera_hasta is null) desc, o.reportado_en limit 1) ab on true
left join lateral (select v.* from public.v_planes_preventivos v where v.maquina_id = m.id and v.activo
                   order by case v.situacion when 'vencido' then 0 when 'por_vencer' then 1 else 2 end, v.proxima_fecha nulls last limit 1) pv on true
left join public.resguardos rg on rg.maquina_id = m.id and rg.devuelto_en is null
left join personal pp on pp.id = rg.empleado_id
left join personal pa on pa.id = m.asignada_a
left join public.perfiles pb on pb.id = m.baja_por;

-- ---------------------------------------------------------------- 10. métricas en horas laborales
-- Igual que en 157, pero cada hora sale de horas_en_horario (horario del taller, sin noches, fines
-- de semana, feriados ni descansos) y una máquina dada de baja cuenta solo hasta su baja.
--   disponibilidad = 1 − horas laborales fuera de servicio ÷ horas laborales del periodo
--   MTBF           = horas laborales operando ÷ fallas
--   MTTR           = horas laborales de que se reporta la falla a que se cierra la orden (promedio)
create or replace function public.metricas_mantenimiento(p_desde date, p_hasta date)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  d0 timestamptz := p_desde::timestamp at time zone 'America/Mexico_City';
  d1 timestamptz := least((p_hasta + 1)::timestamp at time zone 'America/Mexico_City', now());
  v_horas numeric;
  v_costos boolean := puede('costos', 1);
  r jsonb;
begin
  if not (puede('mantenimiento', 1) or puede('procesos', 1)) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  if p_hasta < p_desde then raise exception 'El periodo está al revés'; end if;
  v_horas := horas_en_horario(d0, d1);

  -- Por máquina: hasta cuándo cuenta (su baja), lo que falló y cuánto estuvo fuera dentro del periodo.
  drop table if exists _maq;
  create temp table _maq on commit drop as
  select q.*, case when q.fin < d1 then horas_en_horario(d0, q.fin) else v_horas end horas,
    (select count(*) from ordenes_mantenimiento o where o.maquina_id = q.id and o.tipo = 'correctivo' and o.estado <> 'cancelada'
       and o.reportado_en >= d0 and o.reportado_en < q.fin)::int fallas,
    coalesce((select sum(horas_en_horario(greatest(o.fuera_desde, d0), least(coalesce(o.fuera_hasta, now()), q.fin)))
       from ordenes_mantenimiento o where o.maquina_id = q.id and o.estado <> 'cancelada' and o.fuera_desde is not null and o.fuera_desde < q.fin
         and coalesce(o.fuera_hasta, now()) > d0), 0) horas_fuera,
    (select avg(horas_en_horario(o.reportado_en, o.cerrada_en)) from ordenes_mantenimiento o
       where o.maquina_id = q.id and o.tipo = 'correctivo' and o.estado = 'cerrada' and o.cerrada_en >= d0 and o.cerrada_en < d1) mttr,
    (select count(*) from ordenes_mantenimiento o where o.maquina_id = q.id and o.tipo = 'preventivo' and o.estado <> 'cancelada'
       and o.vence between p_desde and p_hasta)::int prev_programados,
    (select count(*) from ordenes_mantenimiento o where o.maquina_id = q.id and o.tipo = 'preventivo' and o.estado = 'cerrada'
       and o.vence between p_desde and p_hasta and (o.cerrada_en at time zone 'America/Mexico_City')::date <= o.vence)::int prev_a_tiempo
  from (select m.id, m.numero, m.nombre, m.categoria, m.tipo, m.criticidad, m.critica, m.estado, et.nombre area,
          least(d1, coalesce((m.baja_en + 1)::timestamp at time zone 'America/Mexico_City', d1)) fin
        from maquinas m left join etapas et on et.id = m.etapa_id
        -- Herramienta también: las soldadoras están dadas de alta como herramienta y son críticas.
        -- Una baja de antes (sin fecha) o de antes del periodo ya no cuenta.
        where m.estado <> 'baja' or m.baja_en >= p_desde) q;

  select jsonb_build_object(
    'periodo', jsonb_build_object('desde', p_desde, 'hasta', p_hasta, 'horas', round(v_horas, 1)),
    'con_costos', v_costos,
    'resumen', jsonb_build_object(
      'maquinas', (select count(*) from _maq where estado <> 'baja'),
      -- Paradas ahorita: con una orden abierta que la detiene (igual que el estado de Máquinas).
      'paradas_ahora', (select count(distinct o.maquina_id) from ordenes_mantenimiento o join _maq q on q.id = o.maquina_id
                        where o.estado in ('pendiente', 'en_proceso') and o.detiene),
      'disponibilidad', (select round(1 - sum(horas_fuera) / nullif(sum(horas), 0), 4) from _maq),
      'disponibilidad_criticas', (select round(1 - sum(horas_fuera) / nullif(sum(horas), 0), 4) from _maq
                                  where critica or criticidad in ('muy_alta', 'alta')),
      'fallas', (select sum(fallas) from _maq),
      'horas_fuera', (select round(sum(horas_fuera)::numeric, 1) from _maq),
      'mtbf_h', (select round(((sum(horas) - sum(horas_fuera)) / nullif(sum(fallas), 0))::numeric, 0) from _maq),
      'mttr_h', (select round(avg(horas_en_horario(o.reportado_en, o.cerrada_en))::numeric, 1) from ordenes_mantenimiento o
                 where o.tipo = 'correctivo' and o.estado = 'cerrada' and o.cerrada_en >= d0 and o.cerrada_en < d1),
      'paro_por_falla_h', (select round(avg(horas_en_horario(o.fuera_desde, o.fuera_hasta))::numeric, 1) from ordenes_mantenimiento o
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
        'disponibilidad', round(1 - horas_fuera / nullif(horas, 0), 4),
        'mtbf_h', case when fallas > 0 then round(((horas - horas_fuera) / fallas)::numeric, 0) end,
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

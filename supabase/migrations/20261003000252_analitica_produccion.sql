-- Analítica de producción (nov 2026). Las métricas de producción contaban lo que se marcó, pero
-- varias cifras salían de un artefacto: 49 de las 54 órdenes se cargaron de la hoja el 16 oct y su
-- «liberada» caía en esa fecha (creado_en), así que el lead time, la eficiencia del flujo y la
-- espera por etapa medían la carga, no el taller. Y las horas reales contra el costeo sumaban
-- etapas de Pailería que empezaron en septiembre y se marcaron en la terminal solo el final:
-- salían ×0.44–0.84, que es falso. Aquí se corrige eso y se agregan los análisis que contestan lo
-- que se decide: cuánto creerle a cada número, si cumplimos las fechas y lo que viene, dónde se
-- atora el trabajo hoy, qué horas del costeo recalibrar y por qué se para el piso.
--
-- Reglas que usan todos los cálculos:
--   liberada vista  la orden tiene el evento «liberada» (el ERP la vio entrar al taller)
--   marcada         la etapa pasó por la terminal o por el detalle (tramo de tiempo, o evento de
--                   inicio o de fin); «sin marcar» es la que se cerró en bloque o venía de la hoja
--   con tiempo      horas hombre ≥ max(0.5 h, 10 % de lo estimado)
--   cubierta        el primer tramo de tiempo es de a lo más un día después del inicio de la
--                   etapa: la terminal la vio desde que empezó
--   lista confiable la etapa anterior que la habilitó fue marcada (su fin es real), o es la
--                   primera y la orden se liberó en el ERP
--
-- Captura nueva: motivo de la pausa (un toque en la terminal) y causa de la espera, para el
-- Pareto de horas detenidas. Solo las funciones escriben.

-- ------------------------------------------------------------------------------- 1. captura
alter table public.op_eventos add column if not exists motivo text;
alter table public.op_eventos drop constraint if exists op_eventos_motivo_check;
alter table public.op_eventos add constraint op_eventos_motivo_check
  check (motivo is null or motivo in ('material', 'etapa_anterior', 'maquina', 'ingenieria', 'calidad', 'prioridad', 'otro'));
-- El motivo es de una pausa: la política de alta deja insertar notas y problemas, y una nota con
-- motivo ensuciaría el Pareto.
alter table public.op_eventos drop constraint if exists op_eventos_motivo_solo_pausa;
alter table public.op_eventos add constraint op_eventos_motivo_solo_pausa check (motivo is null or tipo = 'pausa');
comment on column public.op_eventos.motivo is
  'Por qué se pausó la etapa (el piso lo elige con un toque en la terminal). «prioridad» no es pérdida: se movió a otra orden.';

alter table public.ordenes_produccion add column if not exists en_espera_causa text;
alter table public.ordenes_produccion drop constraint if exists ordenes_produccion_en_espera_causa_check;
alter table public.ordenes_produccion add constraint ordenes_produccion_en_espera_causa_check
  check (en_espera_causa is null or en_espera_causa in ('cliente', 'material', 'ingenieria', 'prioridad', 'otro'));
comment on column public.ordenes_produccion.en_espera_causa is 'Causa de lista de por qué la orden está en espera (además del texto libre).';

-- ------------------------------------------------------------- 2. avanzar_operacion con motivo
-- Mismo cuerpo que en 248, con p_motivo al final. Se borra la firma vieja: con dos sobrecargas
-- PostgREST no sabe cuál elegir cuando la pantalla no manda p_motivo.
drop function if exists public.avanzar_operacion(uuid, text, text, text, uuid[], int);
create or replace function public.avanzar_operacion(p_operacion uuid, p_accion text, p_nota text default null,
  p_responsable text default null, p_empleados uuid[] default null, p_sin_nombre int default 0, p_motivo text default null)
returns void language plpgsql security definer set search_path = public as $$
declare op op_operaciones; o ordenes_produccion; v_etapa text; v_resp text := nullif(trim(p_responsable), '');
  v_cuadrilla text;
  v_nota text := nullif(trim(p_nota), '');
begin
  if not puede('produccion', 2) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  -- El motivo dice por qué se dejó la etapa; en otra acción no significa nada.
  if p_motivo is not null and p_accion <> 'pausa' then raise exception 'El motivo es solo para pausar'; end if;
  select * into op from op_operaciones where id = p_operacion for update;
  if op.id is null then raise exception 'No existe esa etapa'; end if;
  select * into o from ordenes_produccion where id = op.orden_id for update;
  select nombre into v_etapa from etapas where id = op.etapa_id;
  if o.estado = 'planeada' then raise exception 'La orden % todavía no está liberada', o.folio; end if;
  if o.estado in ('terminada', 'entregada', 'cancelada') then raise exception 'La orden % ya está cerrada', o.folio; end if;
  if o.en_espera_motivo is not null then
    raise exception 'La orden % está en espera (%): la gerencia de producción la reactiva', o.folio, o.en_espera_motivo;
  end if;

  if p_accion in ('inicio', 'reanudar') then
    v_cuadrilla := nombres_cuadrilla(p_empleados, p_sin_nombre);
    v_resp := coalesce(v_cuadrilla, v_resp);
  end if;

  case p_accion
    when 'inicio' then
      if op.estado = 'terminada' then raise exception '% de % ya se terminó', v_etapa, o.folio; end if;
      if op.estado = 'en_proceso' then
        raise exception '% de % ya estaba en proceso%', v_etapa, o.folio, coalesce(' (' || op.responsable || ')', '');
      end if;
      update op_operaciones set estado = 'en_proceso', inicio = least(coalesce(inicio, now()), now()),
        responsable = coalesce(v_resp, responsable) where id = p_operacion;
      update ordenes_produccion set estado = 'en_proceso' where id = o.id and estado = 'liberada';
    when 'pausa' then
      if op.estado <> 'en_proceso' then raise exception 'Solo se pausa una etapa que está en proceso'; end if;
      update op_operaciones set estado = 'pausada', responsable = coalesce(v_resp, responsable) where id = p_operacion;
    when 'reanudar' then
      if op.estado <> 'pausada' then raise exception '% de % no está pausada', v_etapa, o.folio; end if;
      update op_operaciones set estado = 'en_proceso', responsable = coalesce(v_resp, responsable) where id = p_operacion;
    when 'fin' then
      if op.estado = 'terminada' then raise exception '% de % ya se terminó', v_etapa, o.folio; end if;
      update op_operaciones set estado = 'terminada', fin = now(), inicio = least(coalesce(inicio, now()), now()),
        responsable = coalesce(v_resp, responsable) where id = p_operacion;
      update ordenes_produccion set estado = 'en_proceso' where id = o.id and estado = 'liberada';
    when 'problema' then
      if v_nota is null then raise exception 'Escribe cuál es el problema'; end if;
    when 'nota' then
      if v_nota is null then raise exception 'La nota está vacía'; end if;
    else raise exception 'Acción desconocida: %', p_accion;
  end case;
  -- Un motivo que no es de la lista lo rechaza el check de op_eventos.
  insert into op_eventos (orden_id, operacion_id, tipo, nota, responsable, motivo)
  values (o.id, p_operacion, p_accion, v_nota, coalesce(v_resp, op.responsable), case when p_accion = 'pausa' then p_motivo end);

  -- Quien empieza o reanuda la etapa abre su tramo de tiempo (pausa y fin los cierra el disparador).
  if p_accion in ('inicio', 'reanudar') then
    perform abrir_tramos(p_operacion, p_empleados, p_sin_nombre);
    -- Lo que se hizo manda: quien estaba planeado y no arrancó deja la cuadrilla.
    -- (248) Solo si la llamada dice quién arrancó (la terminal). Iniciar o reanudar desde el
    -- detalle de la orden no manda nombres, y «<> all('{}')» es verdadero en cada renglón: se
    -- borraba toda la cuadrilla que planeó la gerencia, también la que se dejó a propósito al pausar.
    if p_empleados is not null or coalesce(p_sin_nombre, 0) > 0 then
      delete from op_asignaciones where operacion_id = p_operacion and empleado_id <> all(coalesce(p_empleados, '{}'));
    end if;
  end if;

  if p_accion = 'fin' and not exists (select 1 from op_operaciones where orden_id = o.id and estado <> 'terminada') then
    update ordenes_produccion set estado = 'terminada', terminada_en = now() where id = o.id;
    insert into op_eventos (orden_id, tipo) values (o.id, 'terminada');
    -- Si todas las órdenes del pedido terminaron, el pedido queda listo para entregar.
    if o.pedido_id is not null and not exists (select 1 from ordenes_produccion where pedido_id = o.pedido_id
                                               and estado not in ('terminada', 'entregada', 'cancelada')) then
      update pedidos set estado = 'listo' where id = o.pedido_id and estado = 'en_produccion';
    end if;
  end if;
end $$;
revoke execute on function public.avanzar_operacion(uuid, text, text, text, uuid[], int, text) from public, anon;
grant execute on function public.avanzar_operacion(uuid, text, text, text, uuid[], int, text) to authenticated;

-- ------------------------------------------------------------------ 3. espera con su causa
drop function if exists public.poner_en_espera(uuid, text);
create or replace function public.poner_en_espera(p_op uuid, p_motivo text, p_causa text default 'otro')
returns void language plpgsql security definer set search_path = public as $$
declare o ordenes_produccion; v_motivo text := nullif(trim(p_motivo), '');
begin
  if not puede('produccion', 3) then raise exception 'Solo la gerencia de producción pone órdenes en espera' using errcode = '42501'; end if;
  if v_motivo is null then raise exception 'Escribe por qué queda en espera (ej. cliente ausente)'; end if;
  select * into o from ordenes_produccion where id = p_op for update;
  if o.id is null then raise exception 'No existe la orden'; end if;
  if o.estado in ('terminada', 'entregada', 'cancelada') then raise exception 'La orden % ya está cerrada', o.folio; end if;
  -- Una causa que no es de la lista la rechaza el check.
  update ordenes_produccion set en_espera_motivo = v_motivo, en_espera_causa = coalesce(p_causa, 'otro'),
    en_espera_desde = hoy_planta(), en_espera_por = auth.uid() where id = p_op;
  -- Lo que se estaba trabajando se pausa: si no, seguiría contando tiempo.
  update op_operaciones set estado = 'pausada' where orden_id = p_op and estado = 'en_proceso';
  insert into op_eventos (orden_id, tipo, nota) values (p_op, 'nota', 'En espera: ' || v_motivo);
end $$;
revoke execute on function public.poner_en_espera(uuid, text, text) from public, anon;
grant execute on function public.poner_en_espera(uuid, text, text) to authenticated;

-- Mismo cuerpo que en 141; además limpia la causa.
create or replace function public.reactivar_orden(p_op uuid) returns void
language plpgsql security definer set search_path = public as $$
declare o ordenes_produccion;
begin
  if not puede('produccion', 3) then raise exception 'Solo la gerencia de producción reactiva órdenes' using errcode = '42501'; end if;
  select * into o from ordenes_produccion where id = p_op for update;
  if o.id is null then raise exception 'No existe la orden'; end if;
  if o.en_espera_motivo is null then raise exception 'La orden % no está en espera', o.folio; end if;
  update ordenes_produccion set en_espera_motivo = null, en_espera_causa = null, en_espera_desde = null, en_espera_por = null where id = p_op;
  insert into op_eventos (orden_id, tipo, nota)
  values (p_op, 'nota', format('Reactivada (estuvo en espera desde el %s: %s)', to_char(o.en_espera_desde, 'DD/MM/YYYY'), o.en_espera_motivo));
end $$;

-- -------------------------------------------------------------- 4. horas del taller, de una vez
-- horas_en_horario() arma las ventanas del taller día por día en cada llamada (con los festivos de
-- cada día): con tramos abiertos de semanas y etapas de 46 jornadas, la analítica tardaba 2.2 s en
-- la nube. Las ventanas se arman una vez y cada cuenta recorre solo sus segmentos (1.9 s → 0.44 s
-- con 90 días, sin contar el plan del taller). Mismo
-- resultado que horas_en_horario(): la jornada de cada día con sus descansos (un descanso «de 10 a
-- 11, 40 minutos» pesa 20 de 60 minutos trabajados).
create or replace function public.ventanas_taller(p_de date, p_a date,
  out ini timestamptz[], out fin timestamptz[], out peso numeric[])
language sql stable set search_path = public as $$
  -- Los descansos se cruzan con su ventana por llave (join), no con un subselect por renglón: con un
  -- año de días eran 400 mil comparaciones y casi un segundo en la nube.
  with c as (select coalesce((select valor from configuracion where clave = 'horas_taller'), '{}'::jsonb) v),
  w as (select g.d::date d, w.inicio, w.fin from generate_series(p_de, p_a, interval '1 day') g(d) cross join lateral ventana_taller(g.d::date) w),
  ds as (select w.d, w.inicio wi, w.fin wf, (w.d + (x->>'de')::time) at time zone 'America/Mexico_City' de, (w.d + (x->>'a')::time) at time zone 'America/Mexico_City' a,
           coalesce((x->>'minutos')::numeric * 60 / nullif(extract(epoch from (x->>'a')::time - (x->>'de')::time), 0), 1) fac
         from w, c, jsonb_array_elements(coalesce(c.v->'descansos', '[]'::jsonb)) x),
  pts as (select d, inicio wi, inicio p from w
          union select d, inicio, fin from w
          union select d, wi, greatest(least(de, wf), wi) from ds
          union select d, wi, greatest(least(a, wf), wi) from ds),
  seg as (select d, wi, p i, lead(p) over (partition by d, wi order by p) f from pts),
  sw as (select s.i, s.f, greatest(1 - coalesce(sum(ds.fac), 0), 0) w
         from seg s left join ds on ds.d = s.d and ds.wi = s.wi and ds.de <= s.i and ds.a >= s.f
         where s.f > s.i group by s.d, s.wi, s.i, s.f)
  select array_agg(i order by i), array_agg(f order by i), array_agg(w order by i) from sw
$$;
revoke execute on function public.ventanas_taller(date, date) from public, anon;

-- Los segmentos vienen ordenados: width_bucket() encuentra en dónde empieza y termina el tramo
-- (búsqueda binaria) y solo esos se recorren. Recorrer los cientos de segmentos de cada llamada
-- costaba 13 ms por tramo.
create or replace function public.horas_en_ventanas(p_desde timestamptz, p_hasta timestamptz, p_ini timestamptz[], p_fin timestamptz[], p_peso numeric[])
returns numeric language sql immutable set search_path = public as $$
  select coalesce(round(sum(greatest(extract(epoch from least(s.f, p_hasta) - greatest(s.i, p_desde)), 0) * s.w)::numeric / 3600, 4), 0)
  from (select greatest(width_bucket(p_desde, p_ini), 1) k1, width_bucket(p_hasta, p_ini) k2) k,
    unnest(p_ini[k.k1:k.k2], p_fin[k.k1:k.k2], p_peso[k.k1:k.k2]) s(i, f, w)
  where p_desde is not null and p_hasta is not null and p_hasta > p_desde and s.f > p_desde and s.i < p_hasta
$$;

-- Lo mismo que horas_trabajadas(): en modo «terminal» cuenta el reloj tal cual.
create or replace function public.horas_marcadas(p_desde timestamptz, p_hasta timestamptz, p_terminal boolean,
  p_ini timestamptz[], p_fin timestamptz[], p_peso numeric[])
returns numeric language sql immutable set search_path = public as $$
  select case when p_desde is null or p_hasta is null or p_hasta <= p_desde then 0
              when p_terminal then round(extract(epoch from p_hasta - p_desde)::numeric / 3600, 4)
              else horas_en_ventanas(p_desde, p_hasta, p_ini, p_fin, p_peso) end
$$;
grant execute on function public.ventanas_taller(date, date), public.horas_en_ventanas(timestamptz, timestamptz, timestamptz[], timestamptz[], numeric[]),
  public.horas_marcadas(timestamptz, timestamptz, boolean, timestamptz[], timestamptz[], numeric[]) to authenticated;

-- --------------------------------------------------------------- 5. metricas_produccion
-- Mismo cuerpo que en 181, con seis arreglos y las horas con ventanas_taller (2.6 s → 0.12 s en la nube):
--   · lead time y eficiencia del flujo solo de órdenes con liberación vista (antes medían la carga)
--   · espera por etapa solo si la etapa anterior se marcó (o es la primera y la orden se liberó aquí)
--   · horas reales / estimadas solo de etapas con tiempo y cubiertas
--   · entregas a tiempo cuenta las vencidas que siguen abiertas (como analisis_entregas)
--   · cuántos de los equipos terminados venían de la hoja
--   · por equipo, las horas reales solo de los equipos con todas sus etapas con tiempo y cubiertas
create or replace function public.metricas_produccion(p_desde date, p_hasta date)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  d0 timestamptz := p_desde::timestamp at time zone 'America/Mexico_City';
  d1 timestamptz := (p_hasta + 1)::timestamp at time zone 'America/Mexico_City';
  v_costos boolean := puede('costos', 1);
  -- Las horas con las ventanas del taller armadas una vez (ver ventanas_taller): horas_trabajadas()
  -- las arma en cada llamada y esto tardaba 2.6 s en la nube con 73 tiempos.
  v_term boolean := (select valor->>'modo' from configuracion where clave = 'horas_taller') = 'terminal';
  v_si timestamptz[]; v_sf timestamptz[]; v_sw numeric[];
  r jsonb;
begin
  if not puede('procesos', 1) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  if p_hasta < p_desde then raise exception 'El periodo está al revés'; end if;
  -- Lo que se mide: los tiempos de la terminal y, para la eficiencia del flujo, de la liberación al fin.
  select w.ini, w.fin, w.peso into v_si, v_sf, v_sw from ventanas_taller(
    coalesce((select (min(z.m) at time zone 'America/Mexico_City')::date - 1 from (
       select min(inicio) m from op_tiempos union all select min(en) from op_eventos where tipo = 'liberada') z), hoy_mx()),
    hoy_mx()) w;

  drop table if exists _ops, _etp;
  -- Solo las que el ERP vio liberarse tienen tiempos: las cargadas de la hoja traen como
  -- «liberada» la fecha de la carga (creado_en), y su lead time sería el de la carga.
  create temp table _ops on commit drop as
  select z.*, z.liberada_vista and z.terminada_en > z.liberada_en con_tiempos,
    not z.liberada_vista and z.terminada_en < z.creado_en de_la_hoja from (
  select o.id, o.folio, o.articulo_id, o.fecha_compromiso, o.terminada_en, o.creado_en,
    coalesce(l.en, o.creado_en) liberada_en, l.en is not null liberada_vista,
    (o.terminada_en at time zone 'America/Mexico_City')::date <= o.fecha_compromiso a_tiempo
  from ordenes_produccion o
  left join lateral (select min(e.en) en from op_eventos e where e.orden_id = o.id and e.tipo = 'liberada') l on true
  where o.estado in ('terminada', 'entregada') and o.terminada_en >= d0 and o.terminada_en < d1) z;

  -- Etapas terminadas en el periodo, con sus horas hombre, sus horas de reloj con alguien
  -- trabajando (la unión de los tramos), desde cuándo podían empezar (solo si se sabe) y si sus
  -- horas valen para comparar con el costeo (con tiempo y cubiertas).
  create temp table _etp on commit drop as
  select z.*, coalesce(z.hh >= greatest(0.5, 0.10 * z.horas_estimadas) and z.primer_tramo <= z.inicio + interval '1 day', false) valida
  from (
  select x.id, x.orden_id, x.etapa_id, x.horas_estimadas, x.inicio, x.fin,
    (select sum(horas_marcadas(t.inicio, coalesce(t.fin, now()), v_term, v_si, v_sf, v_sw) * t.personas) from op_tiempos t where t.operacion_id = x.id) hh,
    (select sum(horas_marcadas(lower(rr), upper(rr), v_term, v_si, v_sf, v_sw))
       from unnest((select range_agg(tstzrange(t.inicio, coalesce(t.fin, now()))) from op_tiempos t where t.operacion_id = x.id)) rr) reloj,
    (select min(t.inicio) from op_tiempos t where t.operacion_id = x.id) primer_tramo,
    case when p.n_ant = 0 then l.en
         when p.anterior_marcada then greatest(coalesce(l.en, '-infinity'::timestamptz), p.fin_anterior) end lista_en
  from op_operaciones x join etapas et on et.id = x.etapa_id
  left join lateral (select min(e.en) en from op_eventos e where e.orden_id = x.orden_id and e.tipo = 'liberada') l on true
  left join lateral (
    select count(*) n_ant, max(y.fin) fin_anterior,
      (array_agg(exists (select 1 from op_tiempos t where t.operacion_id = y.id)
                 or exists (select 1 from op_eventos e where e.operacion_id = y.id and e.tipo in ('inicio', 'fin'))
                 order by y.fin desc nulls last))[1] anterior_marcada
    from op_operaciones y join etapas ey on ey.id = y.etapa_id
    where y.orden_id = x.orden_id and ey.orden < et.orden and not et.en_paralelo) p on true
  where x.estado = 'terminada' and x.fin >= d0 and x.fin < d1) z;

  select jsonb_build_object(
    'periodo', jsonb_build_object('desde', p_desde, 'hasta', p_hasta),
    'con_costos', v_costos,
    'resumen', (select jsonb_build_object(
        'ordenes_terminadas', (select count(*) from _ops),
        'ordenes_de_la_hoja', (select count(*) from _ops where de_la_hoja),
        'ordenes_con_fecha', (select count(*) from _ops where fecha_compromiso is not null),
        'ordenes_a_tiempo', (select count(*) from _ops where a_tiempo),
        -- Las abiertas que ya pasaron su fecha también son entregas tarde (las en espera no cuentan).
        'ordenes_vencidas_abiertas', (select count(*) from ordenes_produccion where estado in ('planeada', 'liberada', 'en_proceso')
                                        and en_espera_motivo is null and fecha_compromiso < hoy_mx()),
        'pedidos_entregados', (select count(*) from pedidos where estado = 'entregado' and entregado_en >= d0 and entregado_en < d1 and fecha_compromiso is not null),
        'pedidos_a_tiempo', (select count(*) from pedidos where estado = 'entregado' and entregado_en >= d0 and entregado_en < d1
                               and (entregado_en at time zone 'America/Mexico_City')::date <= fecha_compromiso),
        'ordenes_con_tiempos', (select count(*) from _ops where con_tiempos),
        'lead_time_dias', (select round(avg(extract(epoch from terminada_en - liberada_en) / 86400)::numeric, 1) from _ops where con_tiempos),
        'lead_time_mediana_dias', (select round((percentile_cont(0.5) within group (order by extract(epoch from terminada_en - liberada_en) / 86400))::numeric, 1) from _ops where con_tiempos),
        -- Eficiencia del flujo: de todo el tiempo que la orden estuvo en el taller, qué parte
        -- alguien la estaba trabajando. Solo de las órdenes que se liberaron y marcaron aquí.
        'eficiencia_flujo', (select round((100 * sum(rl.horas) / nullif(sum(horas_marcadas(p.liberada_en, p.terminada_en, v_term, v_si, v_sf, v_sw)), 0))::numeric, 1)
                             from (select * from _ops where con_tiempos) p join lateral (
                               select sum(horas_marcadas(lower(rr), upper(rr), v_term, v_si, v_sf, v_sw)) horas
                               from unnest((select range_agg(tstzrange(t.inicio, coalesce(t.fin, now()))) from op_tiempos t where t.orden_id = p.id)) rr) rl on rl.horas > 0),
        'etapas_terminadas', (select count(*) from _etp),
        'etapas_con_terminal', (select count(*) from _etp where hh > 0),
        'etapas_validas', (select count(*) from _etp where valida),
        'horas_estimadas', (select round(sum(horas_estimadas)::numeric, 1) from _etp where valida),
        'horas_reales', (select round(sum(hh)::numeric, 1) from _etp where valida),
        'en_proceso', (select count(*) from op_operaciones x join ordenes_produccion o on o.id = x.orden_id
                       where x.estado = 'en_proceso' and o.estado in ('liberada', 'en_proceso')),
        'pausadas', (select count(*) from op_operaciones x join ordenes_produccion o on o.id = x.orden_id
                     where x.estado = 'pausada' and o.estado in ('liberada', 'en_proceso')),
        'ordenes_abiertas', (select count(*) from ordenes_produccion where estado in ('liberada', 'en_proceso') and en_espera_motivo is null),
        'pausas', (select count(*) from op_eventos where tipo = 'pausa' and en >= d0 and en < d1),
        'problemas', (select count(*) from op_eventos where tipo = 'problema' and en >= d0 and en < d1),
        'reabiertas', (select count(*) from op_eventos where tipo = 'reabierta' and en >= d0 and en < d1))),

    -- Equipos terminados por semana, a tiempo y tarde.
    'semanas', (select coalesce(jsonb_agg(jsonb_build_object('semana', s.semana, 'a_tiempo', s.a_tiempo, 'tarde', s.tarde, 'sin_fecha', s.sin_fecha) order by s.semana), '[]')
                from (select g::date semana,
                        (select count(*) from _ops where a_tiempo and (terminada_en at time zone 'America/Mexico_City')::date between g::date and g::date + 6) a_tiempo,
                        (select count(*) from _ops where not a_tiempo and (terminada_en at time zone 'America/Mexico_City')::date between g::date and g::date + 6) tarde,
                        (select count(*) from _ops where fecha_compromiso is null and (terminada_en at time zone 'America/Mexico_City')::date between g::date and g::date + 6) sin_fecha
                      from generate_series(date_trunc('week', p_desde::timestamp), p_hasta::timestamp, interval '7 days') g) s),

    'etapas', (select coalesce(jsonb_agg(jsonb_build_object(
        'etapa_id', et.id, 'etapa', et.nombre, 'color', et.color,
        'terminadas', coalesce(a.n, 0), 'con_terminal', coalesce(a.con_terminal, 0), 'validas', coalesce(a.validas, 0),
        'horas_estimadas', a.est, 'horas_reales', a.hh,
        'espera_h', a.espera, 'trabajo_h', a.trabajo,
        'en_proceso', (select count(*) from op_operaciones x join ordenes_produccion o on o.id = x.orden_id
                       where x.etapa_id = et.id and x.estado in ('en_proceso', 'pausada') and o.estado in ('liberada', 'en_proceso')),
        'pausas', (select count(*) from op_eventos e join op_operaciones x on x.id = e.operacion_id where x.etapa_id = et.id and e.tipo = 'pausa' and e.en >= d0 and e.en < d1),
        'problemas', (select count(*) from op_eventos e join op_operaciones x on x.id = e.operacion_id where x.etapa_id = et.id and e.tipo = 'problema' and e.en >= d0 and e.en < d1),
        'reabiertas', (select count(*) from op_eventos e join op_operaciones x on x.id = e.operacion_id where x.etapa_id = et.id and e.tipo = 'reabierta' and e.en >= d0 and e.en < d1),
        'costo_estimado', case when v_costos then round(a.est * tm.costo_hora, 2) end,
        'costo_real', case when v_costos then round(a.hh * tm.costo_hora, 2) end
      ) order by et.orden), '[]')
      from etapas et
      left join tarifas_mano_obra tm on tm.etapa_id = et.id
      left join lateral (
        select count(*) n, count(*) filter (where hh > 0) con_terminal, count(*) filter (where valida) validas,
          round(sum(horas_estimadas) filter (where valida)::numeric, 1) est, round(sum(hh) filter (where valida)::numeric, 1) hh,
          round(avg(greatest(extract(epoch from inicio - lista_en) / 3600, 0)) filter (where inicio is not null and lista_en > '-infinity')::numeric, 1) espera,
          round(avg(reloj) filter (where valida and reloj > 0)::numeric, 1) trabajo
        from _etp where etapa_id = et.id) a on true
      where et.activa),

    -- Horas hombre por persona dentro del periodo (lo de un tramo que cae fuera no cuenta).
    'personas', (select coalesce(jsonb_agg(p order by (p->>'horas')::numeric desc), '[]') from (
        select jsonb_build_object('nombre', coalesce(e.nombre, 'Sin nombre'), 'area', ar.nombre,
          'horas', round(sum(horas_marcadas(greatest(t.inicio, d0), least(coalesce(t.fin, now()), d1), v_term, v_si, v_sf, v_sw) * t.personas)::numeric, 1),
          'etapas', count(distinct t.operacion_id), 'ordenes', count(distinct t.orden_id)) p
        from op_tiempos t left join empleados e on e.id = t.empleado_id left join etapas ar on ar.id = e.etapa_id
        where t.inicio < d1 and coalesce(t.fin, now()) > d0
        group by e.id, e.nombre, ar.nombre) q),

    -- Por equipo: horas por unidad contra lo estimado y cuánto tardó. Las reales solo de los equipos
    -- con todas sus etapas con tiempo y cubiertas: uno con Pailería marcada a medias y el resto
    -- cerrado en bloque sumaba 104 h contra 309 estimadas (×0.34), que es falso.
    'equipos', (select coalesce(jsonb_agg(q order by q->>'equipo'), '[]') from (
        select jsonb_build_object('equipo', a.nombre, 'clave', a.clave, 'terminados', count(*),
          'horas_estimadas', round(avg(h.est)::numeric, 1), 'horas_reales', round(avg(h.hh) filter (where h.completa)::numeric, 1),
          'completos', count(*) filter (where h.completa),
          'lead_time_dias', round(avg(extract(epoch from p.terminada_en - p.liberada_en) / 86400) filter (where p.con_tiempos)::numeric, 1)) q
        from _ops p join articulos a on a.id = p.articulo_id
        join lateral (select sum(v.est) est, sum(v.hh) hh, coalesce(bool_and(v.valida) filter (where v.est > 0), false) completa
                      from (select x.horas_estimadas est, tt.hh,
                              coalesce(tt.hh >= greatest(0.5, 0.10 * x.horas_estimadas) and tt.primer <= x.inicio + interval '1 day', false) valida
                            from op_operaciones x left join lateral (
                              select sum(horas_marcadas(t.inicio, coalesce(t.fin, now()), v_term, v_si, v_sf, v_sw) * t.personas) hh, min(t.inicio) primer
                              from op_tiempos t where t.operacion_id = x.id) tt on true
                            where x.orden_id = p.id) v) h on true
        group by a.id, a.nombre, a.clave) z),

    'problemas', (select coalesce(jsonb_agg(jsonb_build_object('en', e.en, 'tipo', e.tipo, 'nota', e.nota, 'etapa', et.nombre, 'folio', o.folio) order by e.en desc), '[]')
      from (select * from op_eventos where tipo in ('problema', 'reabierta') and en >= d0 and en < d1 order by en desc limit 20) e
      join ordenes_produccion o on o.id = e.orden_id left join op_operaciones x on x.id = e.operacion_id left join etapas et on et.id = x.etapa_id),

    -- Máquinas: fallas, horas fuera de servicio dentro del periodo, tiempo promedio de
    -- reparación (de que se reporta a que se cierra) y preventivos.
    'mantenimiento', (select jsonb_build_object(
        'fallas', count(*) filter (where m.tipo = 'correctivo' and m.reportado_en >= d0 and m.reportado_en < d1),
        'fallas_que_paran', count(*) filter (where m.tipo = 'correctivo' and m.detiene and m.reportado_en >= d0 and m.reportado_en < d1),
        'horas_fuera', round(sum(greatest(extract(epoch from least(coalesce(m.fuera_hasta, now()), d1) - greatest(m.fuera_desde, d0)) / 3600, 0))
                             filter (where m.fuera_desde is not null and m.fuera_desde < d1)::numeric, 1),
        'mttr_h', round(avg(extract(epoch from m.cerrada_en - m.reportado_en) / 3600)
                        filter (where m.tipo = 'correctivo' and m.estado = 'cerrada' and m.cerrada_en >= d0 and m.cerrada_en < d1)::numeric, 1),
        'preventivos_hechos', count(*) filter (where m.tipo = 'preventivo' and m.estado = 'cerrada' and m.cerrada_en >= d0 and m.cerrada_en < d1),
        'preventivos_a_tiempo', count(*) filter (where m.tipo = 'preventivo' and m.estado = 'cerrada' and m.cerrada_en >= d0 and m.cerrada_en < d1
                                                 and (m.vence is null or (m.cerrada_en at time zone 'America/Mexico_City')::date <= m.vence)),
        'preventivos_vencidos', count(*) filter (where m.tipo = 'preventivo' and m.estado in ('pendiente', 'en_proceso') and m.vence < hoy_mx()))
      from ordenes_mantenimiento m where m.estado <> 'cancelada')
  ) into r;
  return r;
end $$;
revoke execute on function public.metricas_produccion(date, date) from public, anon;
grant execute on function public.metricas_produccion(date, date) to authenticated;

-- ---------------------------------------------------------------- 6. produccion_analitica
-- Invoker: todo lo que lee lo ven los roles de procesos por producción ≥ 1, y las tarifas solo
-- quien ve costos (la RLS de tarifas_mano_obra no da el renglón y además el desvío llega null).
-- No lee pedidos ni empleados: nada por persona. Se queda volatile porque plan_produccion() crea
-- tablas temporales.
create or replace function public.produccion_analitica(p_desde date, p_hasta date) returns jsonb
language plpgsql security invoker set search_path = public as $$
declare
  d0 timestamptz := p_desde::timestamp at time zone 'America/Mexico_City';
  d1 timestamptz := least((p_hasta + 1)::timestamp at time zone 'America/Mexico_City', now());
  v_hoy date := hoy_mx();
  v_jornada numeric := coalesce(nullif(horas_semana_taller(), 0), 42.5) / 5.0;
  v_costos boolean := puede('costos', 1);
  v_arranque timestamptz := greatest(d0, (select min(inicio) from op_tiempos));
  -- Los días se cuentan en hora de la planta: la sesión de la API está en UTC y una marca de las
  -- 7 de la noche ya es el día siguiente.
  v_arranque_dia date := (v_arranque at time zone 'America/Mexico_City')::date;
  -- Con más de 90 días hábiles el flujo acumulado va por semana (el viernes de cada una).
  v_semanal boolean;
  -- Las ventanas del taller desde lo más viejo que se va a medir hasta hoy: los tiempos, las
  -- pausas, las liberaciones y lo que sigue abierto (una etapa que viene de la hoja puede llevar
  -- semanas abierta). No desde el inicio del periodo ni desde las etapas que se cerraron en bloque
  -- al cargar la hoja (alguna «empezó» en febrero de 2025): eso eran 630 días de ventanas por llamada.
  v_term boolean := (select valor->>'modo' from configuracion where clave = 'horas_taller') = 'terminal';
  v_si timestamptz[]; v_sf timestamptz[]; v_sw numeric[];
  r jsonb;
begin
  -- La RLS (producción 1) filtra sola; el puede() es para dar un error claro.
  if not puede('procesos', 1) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  if p_hasta < p_desde then raise exception 'El periodo está al revés'; end if;
  select w.ini, w.fin, w.peso into v_si, v_sf, v_sw from ventanas_taller(
    coalesce((select (min(z.m) at time zone 'America/Mexico_City')::date - 1 from (
       select min(inicio) m from op_tiempos
       union all select min(en) from op_eventos where tipo in ('liberada', 'pausa', 'inicio', 'fin')
       union all select least(min(x.inicio), min(x.fin)) from op_operaciones x join ordenes_produccion o on o.id = x.orden_id
                 where o.estado in ('planeada', 'liberada', 'en_proceso')
       union all select min(creado_en) from ordenes_produccion where estado in ('planeada', 'liberada', 'en_proceso')) z), v_hoy),
    v_hoy) w;
  v_semanal := (select count(*) > 90 from generate_series(v_arranque_dia, p_hasta, interval '1 day') g where extract(isodow from g) < 6);

  with lib as (
    -- Liberación vista por el ERP. Las cargadas de la hoja el 16 oct no la tienen: su creado_en es la carga.
    select o.id orden_id, o.folio, o.articulo_id, o.estado, o.fecha_compromiso, o.terminada_en, o.en_espera_motivo, o.creado_en,
      (select min(e.en) from op_eventos e where e.orden_id = o.id and e.tipo = 'liberada') liberada_en
    from ordenes_produccion o where o.estado <> 'cancelada'),
  op as (
    select x.id, x.orden_id, x.etapa_id, et.nombre etapa, et.orden etapa_orden, et.en_paralelo, x.estado, x.horas_estimadas,
      x.inicio, x.fin, x.avance, l.folio, l.articulo_id, l.liberada_en, l.creado_en, l.estado op_estado, l.en_espera_motivo,
      coalesce((select sum(horas_marcadas(t.inicio, coalesce(t.fin, now()), v_term, v_si, v_sf, v_sw) * t.personas) from op_tiempos t where t.operacion_id = x.id), 0) hh,
      -- El reloj en horas del taller aunque el piso marque tal cual: el flujo lo suma con la espera y
      -- lo detenido, que se miden en el horario.
      coalesce((select sum(horas_en_ventanas(lower(rr), upper(rr), v_si, v_sf, v_sw))
         from unnest((select range_agg(tstzrange(t.inicio, coalesce(t.fin, now()))) from op_tiempos t where t.operacion_id = x.id)) rr), 0) reloj,
      (select min(t.inicio) from op_tiempos t where t.operacion_id = x.id) primer_tramo,
      exists (select 1 from op_tiempos t where t.operacion_id = x.id)
        or exists (select 1 from op_eventos e where e.operacion_id = x.id and e.tipo in ('inicio', 'fin')) marcada,
      greatest((select count(*) from op_asignaciones a where a.operacion_id = x.id),
               (select coalesce(sum(t.personas), 0) from op_tiempos t where t.operacion_id = x.id and t.fin is null), 1) gente,
      p.n_ant, p.fin_anterior, p.todas_terminadas, p.anterior_marcada
    from op_operaciones x join etapas et on et.id = x.etapa_id join lib l on l.orden_id = x.orden_id
    left join lateral (
      -- Las anteriores que la detienen (misma regla que metricas_produccion: Torno en paralelo no espera).
      select count(*) n_ant, max(y.fin) fin_anterior, coalesce(bool_and(y.estado = 'terminada'), true) todas_terminadas,
        (array_agg(exists (select 1 from op_tiempos t where t.operacion_id = y.id)
                   or exists (select 1 from op_eventos e where e.operacion_id = y.id and e.tipo in ('inicio', 'fin'))
                   order by y.fin desc nulls last))[1] anterior_marcada
      from op_operaciones y join etapas ey on ey.id = y.etapa_id
      where y.orden_id = x.orden_id and ey.orden < et.orden and not et.en_paralelo) p on true),
  opc as (
    select op.*,
      op.hh >= greatest(0.5, 0.10 * op.horas_estimadas) con_tiempo,
      -- Cubierta: la terminal la vio desde que empezó (no venía empezada de la hoja).
      op.primer_tramo is not null and (op.inicio is null or op.primer_tramo <= op.inicio + interval '1 day') cubierta,
      case when op.n_ant = 0 then op.liberada_en when op.todas_terminadas then op.fin_anterior end lista_en,
      case when op.n_ant = 0 then op.liberada_en is not null else coalesce(op.anterior_marcada, false) end lista_confiable,
      not op.todas_terminadas bloqueada
    from op),
  plan as (
    select orden_id, max(coalesce(fin_plan, (fin_real at time zone 'America/Mexico_City')::date)) fin
    from plan_produccion() group by 1),
  juz as (
    select l.orden_id, l.folio, (l.terminada_en at time zone 'America/Mexico_City')::date - l.fecha_compromiso dias, 'terminada' tipo
    from lib l where l.terminada_en >= d0 and l.terminada_en < d1 and l.fecha_compromiso is not null
    union all
    select l.orden_id, l.folio, v_hoy - l.fecha_compromiso, 'vencida' from lib l
    where l.estado in ('planeada', 'liberada', 'en_proceso') and l.en_espera_motivo is null and l.fecha_compromiso < v_hoy
    union all
    select l.orden_id, l.folio, pl.fin - l.fecha_compromiso, 'plan' from lib l join plan pl on pl.orden_id = l.orden_id
    where l.estado in ('planeada', 'liberada', 'en_proceso') and l.en_espera_motivo is null and l.fecha_compromiso >= v_hoy and pl.fin is not null),
  rangos(orden, rango, de, a) as (values (1, '15+ antes', -100000, -15), (2, '1 a 14 antes', -14, -1), (3, 'El día', 0, 0),
    (4, '1 a 7 tarde', 1, 7), (5, '8 a 14 tarde', 8, 14), (6, '15 a 30 tarde', 15, 30), (7, '31+ tarde', 31, 100000)),
  hrs as (
    select opc.*, case when estado = 'terminada' then hh else hh / avance end proy from opc
    where horas_estimadas > 0 and con_tiempo and cubierta
      and ((estado = 'terminada' and fin >= d0 and fin < d1) or (estado in ('en_proceso', 'pausada') and avance >= 0.10))),
  pau as (
    select coalesce(p.motivo, 'sin_motivo') motivo, horas_en_ventanas(p.en, coalesce(r.en, now()), v_si, v_sf, v_sw) h
    from op_eventos p join ordenes_produccion o on o.id = p.orden_id and o.estado <> 'cancelada'
    left join lateral (select min(e.en) en from op_eventos e
      where e.operacion_id = p.operacion_id and e.tipo in ('reanudar', 'fin') and e.en > p.en) r on true
    where p.tipo = 'pausa' and p.en >= d0 and p.en < d1)
  select jsonb_build_object(
    'con_costos', v_costos, 'jornada_h', v_jornada,

    -- A. Cuánto creerle: de lo terminado en el periodo, qué pasó por la terminal.
    'registro', (select coalesce(jsonb_agg(jsonb_build_object('etapa_id', etapa_id, 'etapa', etapa, 'terminadas', n,
          'con_tiempo', ct, 'sin_tiempo', st, 'sin_marcar', sm) order by orden), '[]') from (
        select etapa_id, etapa, min(etapa_orden) orden, count(*) n, count(*) filter (where con_tiempo) ct,
          count(*) filter (where not con_tiempo and marcada) st, count(*) filter (where not marcada) sm
        from opc where estado = 'terminada' and fin >= d0 and fin < d1 group by etapa_id, etapa) z),
    'registro_extra', jsonb_build_object(
        'tramos_largos', (select count(*) from op_tiempos where fin is null and horas_en_ventanas(inicio, now(), v_si, v_sf, v_sw) > 5 * v_jornada),
        'sin_iniciar', (select count(*) from op_eventos f where f.tipo = 'fin' and f.en >= d0 and f.en < d1
                        and not exists (select 1 from op_eventos i where i.operacion_id = f.operacion_id and i.tipo = 'inicio' and i.en <= f.en))),

    -- B. Cumplimiento: días contra la fecha compromiso de lo juzgado y de lo que viene según el plan.
    'cumplimiento', jsonb_build_object(
        'juzgadas', (select count(*) from juz where tipo <> 'plan'),
        'a_tiempo', (select count(*) from juz where tipo = 'terminada' and dias <= 0),
        'vencidas', (select count(*) from juz where tipo = 'vencida'),
        'atraso_mediana', (select percentile_cont(0.5) within group (order by dias) from juz where tipo <> 'plan' and dias > 0),
        'por_venir', (select count(*) from juz where tipo = 'plan'),
        'por_venir_tarde', (select count(*) from juz where tipo = 'plan' and dias > 0),
        'rangos', (select jsonb_agg(jsonb_build_object('rango', b.rango, 'a_tiempo', b.a <= 0,
              'terminadas', (select count(*) from juz j where j.tipo = 'terminada' and j.dias between b.de and b.a),
              'vencidas', (select count(*) from juz j where j.tipo = 'vencida' and j.dias between b.de and b.a),
              'plan', (select count(*) from juz j where j.tipo = 'plan' and j.dias between b.de and b.a),
              'folios', (select coalesce(jsonb_agg(j.folio order by j.dias), '[]') from juz j where j.tipo <> 'plan' and j.dias between b.de and b.a),
              'folios_plan', (select coalesce(jsonb_agg(j.folio order by j.dias), '[]') from juz j where j.tipo = 'plan' and j.dias between b.de and b.a))
              order by b.orden) from rangos b),
        -- Gráfica p por mes con límites 3σ, ya calculados; la pantalla la dibuja solo con 'meses_suficiente'.
        'meses', (with m as (select date_trunc('month', l.terminada_en at time zone 'America/Mexico_City')::date mes, count(*) n,
                    count(*) filter (where (l.terminada_en at time zone 'America/Mexico_City')::date <= l.fecha_compromiso) ok
                  from lib l where l.terminada_en >= d0 and l.terminada_en < d1 and l.fecha_compromiso is not null group by 1),
                  pb as (select sum(ok)::numeric / nullif(sum(n), 0) p from m)
                  select coalesce(jsonb_agg(jsonb_build_object('mes', m.mes, 'n', m.n, 'p', round(m.ok::numeric / m.n, 4), 'pbar', round(pb.p, 4),
                    'lcs', round(least(1, pb.p + 3 * sqrt(pb.p * (1 - pb.p) / m.n)), 4),
                    'lci', round(greatest(0, pb.p - 3 * sqrt(pb.p * (1 - pb.p) / m.n)), 4)) order by m.mes), '[]') from m, pb),
        'meses_suficiente', (select count(*) >= 6 from (select 1 from lib l where l.terminada_en >= d0 and l.terminada_en < d1
                  and l.fecha_compromiso is not null group by date_trunc('month', l.terminada_en at time zone 'America/Mexico_City') having count(*) >= 5) q)),

    -- C1. Edad de lo abierto hoy (no depende del periodo), en jornadas del taller.
    'edad', (select coalesce(jsonb_agg(jsonb_build_object('operacion_id', w.id, 'orden_id', w.orden_id, 'folio', w.folio, 'equipo', a.nombre,
          'etapa_id', w.etapa_id, 'etapa', w.etapa, 'estado', w.clase, 'dias', round(horas_en_ventanas(w.desde, now(), v_si, v_sf, v_sw) / v_jornada, 1),
          'esperado_dias', case when w.clase = 'en_proceso' and w.horas_estimadas > 0 then round(w.horas_estimadas / (w.gente * v_jornada), 1) end,
          'desde_conocido', w.conocido, 'avance', w.avance) order by w.etapa_orden, w.desde), '[]')
      from (select opc.*, case when estado = 'pendiente' then 'esperando' else estado::text end clase,
              case estado when 'pausada' then coalesce((select max(e.en) from op_eventos e where e.operacion_id = opc.id and e.tipo = 'pausa'), inicio)
                          when 'en_proceso' then inicio
                          else coalesce(lista_en, liberada_en, creado_en) end desde,
              estado <> 'pendiente' or (lista_en is not null and lista_confiable) conocido
            from opc where op_estado in ('liberada', 'en_proceso') and en_espera_motivo is null and estado <> 'terminada'
              and not (estado = 'pendiente' and bloqueada)) w join articulos a on a.id = w.articulo_id),

    -- C2. Promedios (no medianas) para que espera + trabajo + detenida sumen lo que tardó la etapa.
    'flujo', (select coalesce(jsonb_agg(jsonb_build_object('etapa_id', etapa_id, 'etapa', etapa, 'n', n, 'suficiente', n >= 5,
          'espera_d', e, 'trabajo_d', t, 'detenida_d', dt, 'total_mediana_d', med) order by orden), '[]') from (
        select etapa_id, etapa, min(etapa_orden) orden, count(*) n,
          round(avg(horas_en_ventanas(lista_en, inicio, v_si, v_sf, v_sw)) / v_jornada, 1) e,
          round(avg(reloj) / v_jornada, 1) t,
          round(avg(greatest(horas_en_ventanas(inicio, fin, v_si, v_sf, v_sw) - reloj, 0)) / v_jornada, 1) dt,
          round((percentile_cont(0.5) within group (order by horas_en_ventanas(lista_en, fin, v_si, v_sf, v_sw)))::numeric / v_jornada, 1) med
        from opc where estado = 'terminada' and fin >= d0 and fin < d1 and con_tiempo and cubierta
          and lista_confiable and lista_en is not null and inicio >= lista_en
        group by etapa_id, etapa) z),

    -- D. Horas reales (o proyectadas con el avance) contra las del costeo.
    'horas', (select coalesce(jsonb_agg(jsonb_build_object('operacion_id', h.id, 'orden_id', h.orden_id, 'folio', h.folio, 'equipo', a.nombre,
          'etapa_id', h.etapa_id, 'etapa', h.etapa, 'terminada', h.estado = 'terminada', 'avance', h.avance,
          'estimadas', h.horas_estimadas, 'reales', round(h.hh, 1), 'proyectadas', round(h.proy, 1), 'razon', round(h.proy / h.horas_estimadas, 3),
          'desvio_costo', case when v_costos then round((h.proy - h.horas_estimadas) * tm.costo_hora, 0) end)
          order by h.etapa_orden, h.proy / h.horas_estimadas), '[]')
      from hrs h join articulos a on a.id = h.articulo_id left join tarifas_mano_obra tm on tm.etapa_id = h.etapa_id),
    'horas_etapas', (select coalesce(jsonb_agg(jsonb_build_object('etapa_id', etapa_id, 'etapa', etapa, 'n', n, 'suficiente', n >= 5,
          'p25', round(q[1]::numeric, 3), 'mediana', round(q[2]::numeric, 3), 'p75', round(q[3]::numeric, 3)) order by orden), '[]') from (
        select etapa_id, etapa, min(etapa_orden) orden, count(*) n,
          percentile_cont(array[0.25, 0.5, 0.75]) within group (order by proy / horas_estimadas) q from hrs group by etapa_id, etapa) z),
    'sin_estimado', (select coalesce(jsonb_agg(jsonb_build_object('orden_id', orden_id, 'folio', folio, 'etapa', etapa, 'reales', round(hh, 1)) order by etapa_orden, folio), '[]')
      from opc where horas_estimadas = 0 and hh >= 0.5 and (estado <> 'terminada' or fin >= d0)),

    -- E. Pausas por motivo (Pareto) y órdenes en espera por causa.
    'pausas', jsonb_build_object(
        'motivos', (select coalesce(jsonb_agg(jsonb_build_object('motivo', motivo, 'pausas', n, 'horas', h) order by h desc), '[]')
                    from (select motivo, count(*) n, round(sum(h), 1) h from pau group by 1) z),
        'total', (select count(*) from pau),
        'con_motivo', (select count(*) from pau where motivo <> 'sin_motivo'),
        'suficiente', (select count(*) >= 20 from pau where motivo not in ('sin_motivo', 'prioridad')),
        'en_espera', (select coalesce(jsonb_agg(jsonb_build_object('causa', coalesce(en_espera_causa, 'otro'), 'ordenes', n, 'dias', d)), '[]')
                      from (select en_espera_causa, count(*) n, max(v_hoy - en_espera_desde) d from ordenes_produccion
                            where en_espera_motivo is not null and estado not in ('terminada', 'entregada', 'cancelada') group by 1) z)),

    -- F. Flujo acumulado por etapa, en horas estándar: terminado (acumulado), en proceso y en cola por día.
    'acumulado', (with dias as (select g::date dia from generate_series(v_arranque_dia, p_hasta, interval '1 day') g
                                where extract(isodow from g) < 6 and (not v_semanal or extract(isodow from g) = 5 or g::date = p_hasta)),
        -- Una orden planeada no ha entrado al taller: no está en la cola de nadie.
        base as (select opc.*, coalesce(lista_en, liberada_en, creado_en) llegada from opc
                 where horas_estimadas > 0 and en_espera_motivo is null and op_estado <> 'planeada' and not (estado = 'terminada' and not marcada)),
        c as (select b.etapa_id, b.etapa, b.etapa_orden, d.dia, (d.dia + 1)::timestamp at time zone 'America/Mexico_City' eod, b.horas_estimadas,
                b.fin, b.inicio, b.llegada, b.bloqueada from dias d cross join base b)
        select coalesce(jsonb_agg(jsonb_build_object('etapa_id', z.etapa_id, 'etapa', z.etapa, 'dia', z.dia,
            'terminado', z.term, 'en_proceso', z.proc, 'en_cola', z.cola) order by z.orden, z.dia), '[]')
        from (select etapa_id, etapa, min(etapa_orden) orden, dia,
                coalesce(round(sum(horas_estimadas) filter (where fin >= v_arranque and fin < eod)), 0) term,
                coalesce(round(sum(horas_estimadas) filter (where inicio < eod and (fin is null or fin >= eod))), 0) proc,
                coalesce(round(sum(horas_estimadas) filter (where not bloqueada and llegada < eod and (inicio is null or inicio >= eod))), 0) cola
              from c group by etapa_id, etapa, dia) z),
    'acumulado_dias', (select count(*) from generate_series(v_arranque_dia, p_hasta, interval '1 day') g where extract(isodow from g) < 6),
    'acumulado_semanal', v_semanal,
    'acumulado_suficiente', (select count(*) >= 40 from generate_series(v_arranque_dia, p_hasta, interval '1 day') g where extract(isodow from g) < 6)
  ) into r;
  return r;
end $$;
revoke execute on function public.produccion_analitica(date, date) from public, anon;
grant execute on function public.produccion_analitica(date, date) to authenticated;

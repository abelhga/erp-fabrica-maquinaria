-- =============================================================================
-- Las horas del taller se arman por rango, no día por día.
--
-- Por qué: después de la 295 la terminal de piso seguía en 0.8 s y el plan de cuadrillas en 0.7 s con
-- la base sola, y «¿está el taller en horario?» (la pregunta que cada pantalla de producción hace cada
-- minuto: 12,757 llamadas) en 0.1 s. Todo pasa por ventana_taller(día), que se llama una vez por día y
-- en cada llamada relee la configuración y los feriados: 0.8 ms por día. Un tiempo abierto hace 22
-- días son 22 llamadas (18 ms por tramo; hay 113 tramos y 21 abiertos), y el plan pide la jornada de
-- cada día hasta que acomoda todo (hasta 730).
--
-- Qué cambia: dias_taller(desde, hasta) da las ventanas de un rango en una consulta (configuración y
-- feriados una vez). De ahí salen, con el mismo resultado:
--   ventana_taller(día)        el rango de un día (una sola definición de qué días se trabajan);
--   horas_en_horario           una llamada por tramo en vez de una por día;
--   ventanas_taller            (la de la analítica, 252) ya no llama día por día;
--   horario_taller_ahora       sus 32 días en una llamada;
--   horas_jornadas(desde, hasta) nueva: la jornada de cada día del rango, para el plan;
--   plan_produccion            mismo cuerpo que en 207, con las jornadas en un arreglo.
-- Nadie cambia de números: la prueba 296 compara contra las definiciones anteriores.
-- =============================================================================

create or replace function public.dias_taller(p_desde date, p_hasta date)
returns table (dia date, inicio timestamptz, fin timestamptz)
language sql stable set search_path = public as $$
  with c as (
    select coalesce((select valor from configuracion where clave = 'horas_taller'), '{}'::jsonb) v,
           coalesce((select valor->'descansos_empresa' from configuracion where clave = 'calendario_laboral'), '[]'::jsonb) libres
  ), f as (
    select festivos_lft(a) d from generate_series(extract(year from p_desde)::int, extract(year from p_hasta)::int) a
  ), h as (
    select g.d::date d, case
      -- Un día con otro horario manda, aunque sea feriado (si deciden trabajarlo).
      when c.v->'especiales' ? to_char(g.d, 'YYYY-MM-DD') then c.v->'especiales'->to_char(g.d, 'YYYY-MM-DD')
      when g.d::date in (select f.d from f) then null
      when c.libres @> to_jsonb(to_char(g.d, 'YYYY-MM-DD')) then null
      else coalesce(c.v->'horario', '{"1": ["08:00", "17:30"], "2": ["08:00", "17:30"], "3": ["08:00", "17:30"], "4": ["08:00", "17:30"], "5": ["08:00", "17:30"]}'::jsonb)
           -> (extract(isodow from g.d)::int)::text
    end t
    from c, generate_series(p_desde::timestamp, p_hasta::timestamp, interval '1 day') g(d)
  )
  select h.d, (h.d + (h.t->>0)::time) at time zone 'America/Mexico_City',
         (h.d + (h.t->>1)::time) at time zone 'America/Mexico_City'
  from h where jsonb_typeof(h.t) = 'array'
$$;
revoke execute on function public.dias_taller(date, date) from public, anon;
grant execute on function public.dias_taller(date, date) to authenticated;

create or replace function public.ventana_taller(p_dia date)
returns table (inicio timestamptz, fin timestamptz)
language sql stable set search_path = public as $$
  select d.inicio, d.fin from dias_taller(p_dia, p_dia) d
$$;

create or replace function public.horas_en_horario(p_desde timestamptz, p_hasta timestamptz)
returns numeric language sql stable set search_path = public as $$
  with c as (select coalesce((select valor from configuracion where clave = 'horas_taller'), '{}'::jsonb) v)
  select case when p_desde is null or p_hasta is null or p_hasta <= p_desde then 0 else coalesce((
    select round(sum(
      greatest(extract(epoch from least(w.fin, p_hasta) - greatest(w.inicio, p_desde)), 0)
      - coalesce((
          select sum(greatest(extract(epoch from
                   least(w.fin, p_hasta, (w.dia + (dsc->>'a')::time) at time zone 'America/Mexico_City')
                   - greatest(w.inicio, p_desde, (w.dia + (dsc->>'de')::time) at time zone 'America/Mexico_City')), 0)
                 * coalesce((dsc->>'minutos')::numeric * 60 / nullif(extract(epoch from (dsc->>'a')::time - (dsc->>'de')::time), 0), 1))
          from c, jsonb_array_elements(coalesce(c.v->'descansos', '[]'::jsonb)) dsc), 0)
    )::numeric / 3600, 4)
    from dias_taller((p_desde at time zone 'America/Mexico_City')::date, (p_hasta at time zone 'America/Mexico_City')::date) w
    where w.fin > p_desde and w.inicio < p_hasta), 0) end
$$;

-- La jornada de cada día trabajado del rango (los días de 0 h no salen). Lo mismo que horas_jornada(día).
create or replace function public.horas_jornadas(p_desde date, p_hasta date)
returns table (dia date, horas numeric)
language sql stable set search_path = public as $$
  with c as (select coalesce((select valor from configuracion where clave = 'horas_taller'), '{}'::jsonb) v)
  select w.dia, round(sum(
      greatest(extract(epoch from w.fin - w.inicio), 0)
      - coalesce((
          select sum(greatest(extract(epoch from
                   least(w.fin, (w.dia + (dsc->>'a')::time) at time zone 'America/Mexico_City')
                   - greatest(w.inicio, (w.dia + (dsc->>'de')::time) at time zone 'America/Mexico_City')), 0)
                 * coalesce((dsc->>'minutos')::numeric * 60 / nullif(extract(epoch from (dsc->>'a')::time - (dsc->>'de')::time), 0), 1))
          from c, jsonb_array_elements(coalesce(c.v->'descansos', '[]'::jsonb)) dsc), 0)
    )::numeric / 3600, 4)
  from dias_taller(p_desde, p_hasta) w
  group by w.dia
$$;
revoke execute on function public.horas_jornadas(date, date) from public, anon;
grant execute on function public.horas_jornadas(date, date) to authenticated;

-- Mismo cuerpo que en 252; solo cambia de dónde salen las ventanas (w).
create or replace function public.ventanas_taller(p_de date, p_a date,
  out ini timestamptz[], out fin timestamptz[], out peso numeric[])
language sql stable set search_path = public as $$
  with c as (select coalesce((select valor from configuracion where clave = 'horas_taller'), '{}'::jsonb) v),
  w as (select t.dia d, t.inicio, t.fin from dias_taller(p_de, p_a) t),
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

create or replace function public.horario_taller_ahora()
returns jsonb language sql stable set search_path = public as $$
  with w as (select v.inicio, v.fin from dias_taller(hoy_mx() - 1, hoy_mx() + 30) v)
  select jsonb_build_object(
    'modo', coalesce((select valor->>'modo' from configuracion where clave = 'horas_taller'), 'horario'),
    'en_horario', exists (select 1 from w where now() >= w.inicio and now() < w.fin),
    'cierra', (select min(w.fin) from w where now() >= w.inicio and now() < w.fin),
    'abre', (select min(w.inicio) from w where w.inicio > now()))
$$;

-- plan_produccion: mismo cuerpo que en 207; solo cambia de dónde sale la jornada de cada día. Se
-- parcha el texto vigente (son tres renglones en 180) para no repetir aquí la función entera.
do $$
declare s text := pg_get_functiondef('public.plan_produccion()'::regprocedure); n int;
begin
  if position('a_jor' in s) > 0 then return; end if;   -- ya aplicada
  n := (length(s) - length(replace(s, 'v_jor := horas_jornada(v_dia);', ''))) / length('v_jor := horas_jornada(v_dia);');
  if n <> 1 or position('  v_jor numeric; v_sem numeric := horas_semana_taller();' in s) = 0
     or position(E'  v_pend := n;\n  v_dia := v_hoy;\n' in s) = 0 then
    raise exception 'plan_produccion ya no es la de 207: revisa este parche';
  end if;
  s := replace(s, '  v_jor numeric; v_sem numeric := horas_semana_taller();',
    E'  v_jor numeric; v_sem numeric := horas_semana_taller();\n'
    || E'  -- Lo que da cada día del horizonte, armado una vez: a_jor[1] es hoy.\n  a_jor numeric[];');
  s := replace(s, 'v_jor := horas_jornada(v_dia);', 'v_jor := a_jor[v_dia - v_hoy + 1];');
  s := replace(s, E'  v_pend := n;\n  v_dia := v_hoy;\n',
    E'  v_pend := n;\n  v_dia := v_hoy;\n'
    || E'  -- horas_jornada() día por día eran hasta 730 llamadas por plan; aquí es una sola consulta.\n'
    || E'  select array_agg(coalesce(j.horas, 0) order by g.i) into a_jor\n'
    || E'  from generate_series(0, 729) g(i) left join horas_jornadas(v_hoy, v_hoy + 729) j on j.dia = v_hoy + g.i;\n');
  execute s;
end $$;

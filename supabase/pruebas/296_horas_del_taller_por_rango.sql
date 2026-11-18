-- Las horas del taller armadas por rango dan lo mismo que las de antes (día por día): ventanas,
-- horas de un tramo, jornada de un día y las ventanas de la analítica; con sábado trabajado, descansos,
-- un feriado que sí se trabaja, un día de salida temprano y un descanso de la empresa.

-- Las definiciones anteriores (166), para comparar.
create function pg_temp.ventana_vieja(p_dia date)
returns table (inicio timestamptz, fin timestamptz) language sql stable set search_path = public as $$
  with c as (select coalesce((select valor from configuracion where clave = 'horas_taller'), '{}'::jsonb) v),
  h as (
    select case
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
create function pg_temp.horas_viejas(p_desde timestamptz, p_hasta timestamptz)
returns numeric language sql stable set search_path = public as $$
  with c as (select coalesce((select valor from configuracion where clave = 'horas_taller'), '{}'::jsonb) v)
  select case when p_desde is null or p_hasta is null or p_hasta <= p_desde then 0 else coalesce((
    select round(sum(
      greatest(extract(epoch from least(w.fin, p_hasta) - greatest(w.inicio, p_desde)), 0)
      - coalesce((
          select sum(greatest(extract(epoch from
                   least(w.fin, p_hasta, (g.d::date + (dsc->>'a')::time) at time zone 'America/Mexico_City')
                   - greatest(w.inicio, p_desde, (g.d::date + (dsc->>'de')::time) at time zone 'America/Mexico_City')), 0)
                 * coalesce((dsc->>'minutos')::numeric * 60 / nullif(extract(epoch from (dsc->>'a')::time - (dsc->>'de')::time), 0), 1))
          from c, jsonb_array_elements(coalesce(c.v->'descansos', '[]'::jsonb)) dsc), 0)
    )::numeric / 3600, 4)
    from generate_series((p_desde at time zone 'America/Mexico_City')::date::timestamp,
                         (p_hasta at time zone 'America/Mexico_City')::date::timestamp, interval '1 day') g(d)
    cross join lateral pg_temp.ventana_vieja(g.d::date) w
    where w.fin > p_desde and w.inicio < p_hasta), 0) end
$$;

do $$
declare v_n int; r record; v_si timestamptz[]; v_sf timestamptz[]; v_sw numeric[];
  d0 date := date '2025-12-20'; d1 date := date '2027-02-10';
begin
  -- Un horario con de todo: sábado medio día, dos descansos (uno pagado a medias), el 16 de
  -- septiembre trabajado, un viernes de salida temprano y un descanso de la empresa.
  update configuracion set valor = valor || jsonb_build_object(
    'modo', 'horario',
    'horario', '{"1": ["08:00", "17:30"], "2": ["08:00", "17:30"], "3": ["08:00", "17:30"], "4": ["08:00", "17:30"], "5": ["08:00", "17:30"], "6": ["08:00", "14:00"]}'::jsonb,
    'descansos', '[{"de": "10:00", "a": "11:00", "minutos": 40}, {"de": "15:00", "a": "15:20"}]'::jsonb,
    'especiales', '{"2026-09-16": ["08:00", "13:00"], "2026-07-10": ["08:00", "12:30"], "2026-08-02": ["09:00", "15:00"]}'::jsonb)
  where clave = 'horas_taller';
  insert into configuracion (clave, valor) values ('calendario_laboral', '{"descansos_empresa": ["2026-04-02", "2026-04-03"]}')
  on conflict (clave) do update set valor = configuracion.valor || '{"descansos_empresa": ["2026-04-02", "2026-04-03"]}'::jsonb;

  -- 1. Las ventanas de cada día: una por una y por rango.
  select count(*) into v_n from generate_series(d0::timestamp, d1::timestamp, interval '1 day') g(d)
  where (select array_agg((v.inicio, v.fin)::text) from ventana_taller(g.d::date) v)
        is distinct from (select array_agg((v.inicio, v.fin)::text) from pg_temp.ventana_vieja(g.d::date) v);
  assert v_n = 0, format('%s días con otra ventana (ventana_taller)', v_n);
  select count(*) into v_n from (
    (select g.d::date, v.inicio, v.fin from generate_series(d0::timestamp, d1::timestamp, interval '1 day') g(d), pg_temp.ventana_vieja(g.d::date) v
     except select * from dias_taller(d0, d1))
    union all
    (select * from dias_taller(d0, d1)
     except select g.d::date, v.inicio, v.fin from generate_series(d0::timestamp, d1::timestamp, interval '1 day') g(d), pg_temp.ventana_vieja(g.d::date) v)) z;
  assert v_n = 0, format('%s diferencias entre dias_taller y las ventanas día por día', v_n);
  -- Lo que se quiso configurar sí quedó: feriado trabajado, descanso de la empresa, sábado.
  assert exists (select 1 from dias_taller(date '2026-09-16', date '2026-09-16')), 'el 16 de septiembre con horario especial se trabaja';
  assert not exists (select 1 from dias_taller(date '2026-04-02', date '2026-04-03')), 'los descansos de la empresa no se trabajan';
  assert not exists (select 1 from dias_taller(date '2026-05-01', date '2026-05-01')), 'el 1 de mayo no se trabaja';
  assert (select count(*) from dias_taller(date '2026-06-01', date '2026-06-07')) = 6, 'una semana normal: lunes a sábado';

  -- 2. La jornada de cada día: la de antes, la de un día y la del rango.
  select count(*) into v_n from generate_series(d0::timestamp, d1::timestamp, interval '1 day') g(d)
  left join horas_jornadas(d0, d1) j on j.dia = g.d::date
  where coalesce(j.horas, 0) <> pg_temp.horas_viejas(g.d::date::timestamp at time zone 'America/Mexico_City', (g.d::date + 1)::timestamp at time zone 'America/Mexico_City')
     or horas_jornada(g.d::date) <> coalesce(j.horas, 0);
  assert v_n = 0, format('%s días con otra jornada', v_n);
  assert horas_jornada(date '2026-06-01') = 8.5, format('lunes normal: %s h', horas_jornada(date '2026-06-01'));
  assert horas_jornada(date '2026-06-06') = 5.3333, format('sábado de 8 a 14 menos los 40 min del descanso de las 10: %s h', horas_jornada(date '2026-06-06'));
  assert horas_jornada(date '2026-06-07') = 0, 'domingo';

  -- 3. Tramos de todo tamaño (minutos, días, semanas; que empiezan de noche, en descanso, en feriado).
  select v.ini, v.fin, v.peso into v_si, v_sf, v_sw from ventanas_taller(d0 - 1, d1 + 1) v;
  v_n := 0;
  for r in
    select ini, ini + dur fin from (
      select (d0::timestamp + make_interval(mins => (i * 7919) % 560000)) at time zone 'America/Mexico_City' ini,
             make_interval(mins => case i % 5 when 0 then 7 + i % 50 when 1 then 60 + i % 400 when 2 then 1440 + (i * 13) % 3000
                                               when 3 then (i * 101) % 40000 else 30 + (i * 37) % 900 end) dur
      from generate_series(1, 400) i) z
  loop
    if horas_en_horario(r.ini, r.fin) <> pg_temp.horas_viejas(r.ini, r.fin)
       or horas_marcadas(r.ini, r.fin, false, v_si, v_sf, v_sw) <> pg_temp.horas_viejas(r.ini, r.fin) then
      v_n := v_n + 1;
      raise notice 'tramo % → %: nueva %, analítica %, vieja %', r.ini, r.fin, horas_en_horario(r.ini, r.fin),
        horas_marcadas(r.ini, r.fin, false, v_si, v_sf, v_sw), pg_temp.horas_viejas(r.ini, r.fin);
    end if;
  end loop;
  assert v_n = 0, format('%s tramos con otras horas', v_n);
  assert horas_en_horario('2026-06-01 09:00-06', '2026-06-01 12:00-06') = 2.3333, 'de 9 a 12 con el descanso de las 10: 2 h 20 min';
  assert horas_en_horario(null, now()) = 0 and horas_en_horario(now(), now() - interval '1 hour') = 0, 'sin tramo: 0';

  -- 4. «¿Está en horario?» sigue contestando lo mismo que la ventana de hoy.
  assert (horario_taller_ahora()->>'en_horario')::boolean
         = exists (select 1 from pg_temp.ventana_vieja(hoy_mx()) v where now() >= v.inicio and now() < v.fin), 'en horario';
  assert (horario_taller_ahora()->>'abre')::timestamptz
         = (select min(v.inicio) from generate_series(0, 30) i, pg_temp.ventana_vieja(hoy_mx() + i) v where v.inicio > now()), 'cuándo abre';
end $$;

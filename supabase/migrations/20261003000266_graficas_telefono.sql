-- =============================================================================
-- Gráficas del teléfono: lo que necesitan el radar y los mapas de calor de Coaching, y la pestaña
-- «Teléfono» de Análisis.
--
-- Por qué: con el coaching por rúbrica y el análisis de cada llamada ya hay con qué contestar tres
-- preguntas que una tabla no contesta: en qué criterio flojea cada quien (y si va mejorando), si
-- las llamadas llegan a cotización y pedido, y si una llamada bien calificada vende más que una mal
-- calificada (si el coaching sirve).
--
-- coaching_graficas(desde, hasta, perfil, rubrica): con la MISMA regla de quién ve qué que
--   coaching_resumen (cada quien lo suyo; gerencia de ventas y dirección, todos):
--   * criterios_semana y fallos_semana de lo que se ve;
--   * radar_equipo: el promedio de cada criterio de TODAS las personas, solo si son 3 o más en esa
--     rúbrica y periodo. Con dos, el promedio del equipo menos el tuyo es el del otro, y nadie ve el
--     coaching de otro vendedor;
--   * equipo_criterios: persona × criterio, solo para la gerencia viendo a todo el equipo.
-- telefono_tablero(desde, hasta): para quien ve Análisis o la gerencia de ventas, solo conteos:
--   * embudo llamada → atendida por una persona → lead → cotización → pedido. La cotización cuenta
--     si es de la oportunidad del lead de la llamada o del mismo cliente y salió en los 14 días
--     siguientes; el pedido, si salió de esa cotización. Sin montos;
--   * regresar llamada: de las que nadie contestó, cuántas se regresaron y en cuánto tiempo;
--   * coaching_resultado (solo con permiso de ver el coaching de todos, ventas 3): de las llamadas
--     de venta calificadas, por banda (menos de 5, 5 a 7, 7 o más), cuántas llegaron a cotización.
--   Las llamadas históricas cuentan para todo menos «regresar»: ésas nunca fueron pendientes.
-- =============================================================================

create or replace function public.coaching_graficas(p_desde date, p_hasta date, p_perfil uuid default null, p_rubrica text default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  tz constant text := 'America/Mexico_City';
  v_yo uuid := auth.uid();
  v_todos boolean := puede('ventas', 3);
  v_t0 timestamptz := p_desde::timestamp at time zone 'America/Mexico_City';
  v_t1 timestamptz := (p_hasta + 1)::timestamp at time zone 'America/Mexico_City';
  v_r jsonb;
begin
  if v_yo is null then raise exception 'Necesitas entrar al ERP para ver el coaching' using errcode = '42501'; end if;
  if p_desde is null or p_hasta is null or p_hasta < p_desde then raise exception 'El periodo no es válido' using errcode = '22023'; end if;
  if p_hasta - p_desde > 400 then raise exception 'El periodo es muy largo: máximo 400 días' using errcode = '22023'; end if;
  if p_perfil is not null and p_perfil <> v_yo and not v_todos then
    raise exception 'El coaching de otra persona solo lo ve la gerencia de ventas y dirección' using errcode = '42501';
  end if;

  with todo as materialized (
    -- La rúbrica y el periodo, de TODOS: de aquí sale el promedio del equipo (con su candado de 3).
    select k.*, coalesce(ll.inicio, ll.creado_en) fecha, date_trunc('week', coalesce(ll.inicio, ll.creado_en) at time zone tz)::date semana
    from llamada_coaching k join llamadas ll on ll.id = k.llamada_id
    where coalesce(ll.inicio, ll.creado_en) >= v_t0 and coalesce(ll.inicio, ll.creado_en) < v_t1
      and (p_rubrica is null or _coaching_grupo(k.rubrica_clave) = p_rubrica)
  ),
  k as (
    -- Lo que esta persona puede ver: la misma regla que coaching_resumen.
    select * from todo
    where case when p_perfil is not null then perfil_id = p_perfil
               when v_todos then true
               else perfil_id = v_yo end
  ),
  crit_k as (
    select k.semana, c.v->>'clave' clave, c.v->>'nombre' nombre, (c.v->>'nota')::numeric nota, k.perfil_id, k.fecha
    from k, jsonb_array_elements(k.criterios) c(v)
    where jsonb_typeof(c.v) = 'object' and c.v->>'clave' is not null and jsonb_typeof(c.v->'nota') = 'number'
  ),
  crit_todo as (
    select t.perfil_id, c.v->>'clave' clave, c.v->>'nombre' nombre, (c.v->>'nota')::numeric nota, t.fecha
    from todo t, jsonb_array_elements(t.criterios) c(v)
    where t.atendio_tipo = 'persona' and t.perfil_id is not null
      and jsonb_typeof(c.v) = 'object' and c.v->>'clave' is not null and jsonb_typeof(c.v->'nota') = 'number'
  ),
  n_personas as (select count(distinct perfil_id) n from crit_todo)
  select jsonb_build_object(
    'criterios_semana', coalesce((select jsonb_agg(jsonb_build_object('semana', x.semana, 'clave', x.clave, 'nombre', x.nombre, 'n', x.n, 'promedio', x.promedio)
        order by x.clave, x.semana) from (
          select semana, clave, (array_agg(nombre order by fecha desc))[1] nombre, count(*) n, round(avg(nota), 1) promedio
          from crit_k group by 1, 2) x), '[]'),
    'fallos_semana', coalesce((select jsonb_agg(jsonb_build_object('semana', x.semana, 'clave', x.clave, 'nombre', x.nombre, 'n', x.n)
        order by x.clave, x.semana) from (
          select k.semana, f.v->>'clave' clave, (array_agg(f.v->>'nombre' order by k.fecha desc))[1] nombre, count(distinct k.llamada_id) n
          from k, jsonb_array_elements(k.fallos) f(v)
          where jsonb_typeof(f.v) = 'object' and f.v->>'clave' is not null
          group by 1, 2) x), '[]'),
    'llamadas_semana', coalesce((select jsonb_agg(jsonb_build_object('semana', s.semana, 'n', s.n) order by s.semana)
        from (select semana, count(*) n from k group by 1) s), '[]'),
    'personas_equipo', (select n from n_personas),
    'radar_equipo', case when (select n from n_personas) >= 3 then coalesce((select jsonb_agg(jsonb_build_object('clave', x.clave, 'nombre', x.nombre, 'promedio', x.promedio) order by x.clave)
        from (select clave, (array_agg(nombre order by fecha desc))[1] nombre, round(avg(nota), 1) promedio from crit_todo group by 1) x), '[]') end,
    'equipo_criterios', case when v_todos and p_perfil is null then coalesce((select jsonb_agg(jsonb_build_object('perfil_id', x.perfil_id,
          'nombre', revision_nombre(x.perfil_id), 'clave', x.clave, 'n', x.n, 'promedio', x.promedio) order by x.perfil_id, x.clave)
        from (select perfil_id, clave, count(*) n, round(avg(nota), 1) promedio from crit_todo group by 1, 2) x), '[]') end
  ) into v_r;
  return v_r;
end $$;
revoke execute on function public.coaching_graficas(date, date, uuid, text) from public, anon;
grant execute on function public.coaching_graficas(date, date, uuid, text) to authenticated;

create or replace function public.telefono_tablero(p_desde date, p_hasta date) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  tz constant text := 'America/Mexico_City';
  v_t0 timestamptz := p_desde::timestamp at time zone 'America/Mexico_City';
  v_t1 timestamptz := (p_hasta + 1)::timestamp at time zone 'America/Mexico_City';
  v_coaching boolean := puede('ventas', 3);
  v_r jsonb;
begin
  if not (puede('analisis', 1) or puede('ventas', 3)) then
    raise exception 'El tablero del teléfono lo ve quien tiene Análisis o la gerencia de ventas' using errcode = '42501';
  end if;
  if p_desde is null or p_hasta is null or p_hasta < p_desde then raise exception 'El periodo no es válido' using errcode = '22023'; end if;
  if p_hasta - p_desde > 400 then raise exception 'El periodo es muy largo: máximo 400 días' using errcode = '22023'; end if;

  with ll as materialized (
    select l.id, l.inicio, coalesce(l.inicio, l.creado_en) fecha, l.cliente_id, l.lead_id, l.nadie_contesto, l.historica,
      l.regresada_en, l.atendio_perfil is not null and not coalesce(l.nadie_contesto, false) atendida,
      date_trunc('week', coalesce(l.inicio, l.creado_en) at time zone tz)::date semana,
      ld.oportunidad_id
    from llamadas l left join leads ld on ld.id = l.lead_id
    where coalesce(l.inicio, l.creado_en) >= v_t0 and coalesce(l.inicio, l.creado_en) < v_t1
  ),
  cot as materialized (
    -- La cotización de cada llamada: la de la oportunidad de su lead, o una del mismo cliente en los
    -- 14 días siguientes. Una por llamada (la primera); un borrador no cuenta.
    select distinct on (ll.id) ll.id llamada_id, c.id cotizacion_id
    from ll join cotizaciones c on (c.oportunidad_id = ll.oportunidad_id
                                    or (ll.cliente_id is not null and c.cliente_id = ll.cliente_id))
    where c.creado_en >= ll.fecha and c.creado_en < ll.fecha + interval '14 days'
      and coalesce(c.folio, '') not like 'BORRADOR-%'
    order by ll.id, c.creado_en
  ),
  ped as (
    select distinct cot.llamada_id from cot join pedidos p on p.cotizacion_id = cot.cotizacion_id
  ),
  x as (
    select ll.*, cot.llamada_id is not null cotizo, ped.llamada_id is not null pidio
    from ll left join cot on cot.llamada_id = ll.id left join ped on ped.llamada_id = ll.id
  ),
  nadie as (
    select x.*, extract(epoch from (x.regresada_en - x.fecha)) / 3600.0 horas from x where x.nadie_contesto and not x.historica
  ),
  bandas as (
    select case when k.calificacion < 5 then 'baja' when k.calificacion < 7 then 'media' else 'alta' end banda,
      count(*) n, count(*) filter (where x.cotizo) cotizaron, count(*) filter (where x.pidio) pidieron
    from x join llamada_coaching k on k.llamada_id = x.id
    where k.atendio_tipo = 'persona' and _coaching_grupo(k.rubrica_clave) = 'ventas'
    group by 1
  )
  select jsonb_build_object(
    'desde', p_desde, 'hasta', p_hasta,
    'embudo', jsonb_build_object(
      'llamadas', (select count(*) from x),
      'atendidas', (select count(*) from x where atendida),
      'leads', (select count(*) from x where lead_id is not null),
      'cotizaciones', (select count(*) from x where cotizo),
      'pedidos', (select count(*) from x where pidio)),
    'semanas', coalesce((select jsonb_agg(jsonb_build_object('semana', s.semana, 'llamadas', s.n, 'leads', s.leads, 'cotizaciones', s.cot) order by s.semana)
        from (select semana, count(*) n, count(*) filter (where lead_id is not null) leads, count(*) filter (where cotizo) cot from x group by 1) s), '[]'),
    'regresar', jsonb_build_object(
      'nadie_contesto', (select count(*) from nadie),
      'regresadas', (select count(*) from nadie where regresada_en is not null),
      'en_2h', (select count(*) from nadie where horas is not null and horas <= 2),
      'mediana_horas', (select round((percentile_cont(0.5) within group (order by horas))::numeric, 1) from nadie where horas is not null),
      'semanas', coalesce((select jsonb_agg(jsonb_build_object('semana', s.semana, 'regresadas', s.r, 'sin_regresar', s.sr) order by s.semana)
        from (select semana, count(*) filter (where regresada_en is not null) r, count(*) filter (where regresada_en is null) sr from nadie group by 1) s), '[]')),
    'coaching_resultado', case when v_coaching then coalesce((select jsonb_agg(jsonb_build_object('banda', b.banda, 'n', b.n, 'cotizaron', b.cotizaron, 'pidieron', b.pidieron)
        order by case b.banda when 'baja' then 1 when 'media' then 2 else 3 end) from bandas b), '[]') end
  ) into v_r;
  return v_r;
end $$;
revoke execute on function public.telefono_tablero(date, date) from public, anon;
grant execute on function public.telefono_tablero(date, date) to authenticated;

-- =============================================================================
-- El coaching de VENTAS y el de ATENCIÓN, separados.
--
-- Por qué: el conmutador ya califica con dos rúbricas (voz #75): «ventas» para cotizar, comprar o dar
-- seguimiento, y «atencion» para lo demás (un proveedor, una factura, empleo, un trámite) y para
-- quien la tiene fija, como recepción general. Aquí se promediaban juntas: a un vendedor le movía
-- el promedio una llamada de proveedor, y los criterios que se llaman igual en las dos («saludo»,
-- «tono») se sumaban como si fueran el mismo.
--
-- Qué cambia:
--   * coaching_resumen y coaching_llamadas aceptan p_rubrica ('ventas' | 'atencion'; null = todo,
--     como antes). El resumen dice además cuántas hay de cada una en el periodo, para las pestañas.
--     Una clave que empieza con «atencion» es de atención; todo lo demás (también la de antes de que
--     hubiera clave) es de ventas (_coaching_grupo).
--   * Objetivos: el 75 queda como «Calificación de coaching (ventas)» y solo cuenta ventas; el 76,
--     nuevo, «Calificación de atención telefónica», cuenta atención. El 75 todavía no estaba en
--     ninguna plantilla.
-- Quién ve qué no cambia: la misma regla de siempre (cada quien lo suyo; gerencia de ventas y
-- dirección, todo).
-- =============================================================================

-- El grupo de una rúbrica. La clave la pone el conmutador y es libre («ventas», «ventas-2026-11»):
-- la que empieza con «atencion» es de atención y TODO lo demás es de ventas, incluida la de antes de
-- que hubiera clave. Así un conmutador que nombra sus versiones sigue cayendo en ventas.
create or replace function public._coaching_grupo(p_clave text) returns text
language sql immutable set search_path = public as $$
  select case when lower(coalesce(p_clave, '')) like 'atencion%' then 'atencion' else 'ventas' end
$$;

drop function if exists public.coaching_resumen(date, date, uuid);
drop function if exists public.coaching_llamadas(date, date, uuid);

create or replace function public.coaching_resumen(p_desde date, p_hasta date, p_perfil uuid default null, p_rubrica text default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  tz constant text := 'America/Mexico_City';
  v_yo uuid := auth.uid();
  v_todos boolean := puede('ventas', 3);
  v_t0 timestamptz := p_desde::timestamp at time zone 'America/Mexico_City';
  v_t1 timestamptz := (p_hasta + 1)::timestamp at time zone 'America/Mexico_City';
  v_h4 timestamptz := (p_hasta - 27)::timestamp at time zone 'America/Mexico_City';
  v_h8 timestamptz := (p_hasta - 55)::timestamp at time zone 'America/Mexico_City';
  v_r jsonb;
begin
  if v_yo is null then raise exception 'Necesitas entrar al ERP para ver el coaching' using errcode = '42501'; end if;
  if p_desde is null or p_hasta is null or p_hasta < p_desde then raise exception 'El periodo no es válido' using errcode = '22023'; end if;
  if p_hasta - p_desde > 400 then raise exception 'El periodo es muy largo: máximo 400 días' using errcode = '22023'; end if;
  if p_perfil is not null and p_perfil <> v_yo and not v_todos then
    raise exception 'El coaching de otra persona solo lo ve la gerencia de ventas y dirección' using errcode = '42501';
  end if;

  with k as materialized (
    select k.*, coalesce(ll.inicio, ll.creado_en) fecha, date_trunc('week', coalesce(ll.inicio, ll.creado_en) at time zone tz)::date semana,
      coalesce(k.perfil_id::text, k.atendio_tipo || ':' || coalesce(sin_acentos(ll.atendio_nombre), '')) quien,
      ll.atendio_nombre, ll.atendio_ia
    from llamada_coaching k join llamadas ll on ll.id = k.llamada_id
    where coalesce(ll.inicio, ll.creado_en) >= v_t0 and coalesce(ll.inicio, ll.creado_en) < v_t1
      and case when p_perfil is not null then k.perfil_id = p_perfil
               when v_todos then true
               else k.perfil_id = v_yo end
      and (p_rubrica is null or _coaching_grupo(k.rubrica_clave) = p_rubrica)
  ),
  crit as (
    select c.v->>'clave' clave, (array_agg(c.v->>'nombre' order by k.fecha desc))[1] nombre,
      round(avg((c.v->>'peso')::numeric), 1) peso, count(*) n, round(avg((c.v->>'nota')::numeric), 1) promedio
    from k, jsonb_array_elements(k.criterios) c(v)
    where jsonb_typeof(c.v) = 'object' and c.v->>'clave' is not null and jsonb_typeof(c.v->'nota') = 'number'
    group by 1
  ),
  fal as (
    select f.v->>'clave' clave, (array_agg(f.v->>'nombre' order by k.fecha desc))[1] nombre, count(distinct k.llamada_id) n
    from k, jsonb_array_elements(k.fallos) f(v)
    where jsonb_typeof(f.v) = 'object' and f.v->>'clave' is not null
    group by 1
  ),
  ton as (
    select t.v->>'clave' clave, (array_agg(t.v->>'nombre' order by k.fecha desc))[1] nombre,
      case when (t.v->>'signo') ~ '^-' then -1 else 1 end signo, count(distinct k.llamada_id) n
    from k, jsonb_array_elements(k.tono) t(v)
    where jsonb_typeof(t.v) = 'object' and t.v->>'clave' is not null
    group by 1, 3
  ),
  per as (
    select g.*, case when g.perfil_id is not null then revision_nombre(g.perfil_id)
                     when g.tipo = 'ia' then coalesce('La IA (' || g.ia || ')', 'La IA')
                     else coalesce(g.atendio, 'Sin nombre') || ' (sin ligar)' end nombre
    from (select k.quien, min(k.perfil_id::text)::uuid perfil_id, min(k.atendio_tipo) tipo, min(k.atendio_nombre) atendio,
            min(k.atendio_ia) ia, count(*) n, round(avg(k.calificacion), 1) promedio
          from k group by k.quien) g
  ),
  per_sem as (
    select k.quien, k.semana, count(*) n, round(avg(k.calificacion), 1) promedio from k group by 1, 2
  ),
  sem as (
    select k.semana, count(*) n, round(avg(k.calificacion), 1) promedio from k group by 1
  ),
  -- El fallo que más repite cada quien en el periodo (para la tabla del equipo).
  fal_per as (
    select distinct on (x.quien) x.quien, x.nombre, x.n from (
      select k.quien, f.v->>'clave' clave, (array_agg(f.v->>'nombre' order by k.fecha desc))[1] nombre, count(distinct k.llamada_id) n
      from k, jsonb_array_elements(k.fallos) f(v)
      where jsonb_typeof(f.v) = 'object' and f.v->>'clave' is not null
      group by 1, 2) x
    order by x.quien, x.n desc, x.clave
  ),
  t0 as materialized (
    select coalesce(k.perfil_id::text, k.atendio_tipo || ':' || coalesce(sin_acentos(ll.atendio_nombre), '')) quien,
      k.calificacion, coalesce(ll.inicio, ll.creado_en) >= v_h4 reciente
    from llamada_coaching k join llamadas ll on ll.id = k.llamada_id
    where coalesce(ll.inicio, ll.creado_en) >= v_h8 and coalesce(ll.inicio, ll.creado_en) < v_t1
      and case when p_perfil is not null then k.perfil_id = p_perfil
               when v_todos then true
               else k.perfil_id = v_yo end
      and (p_rubrica is null or _coaching_grupo(k.rubrica_clave) = p_rubrica)
  ),
  tend as (
    select quien, round(avg(calificacion) filter (where reciente), 1) reciente, round(avg(calificacion) filter (where not reciente), 1) anterior
    from t0 group by 1
  ),
  -- Cuántas de cada rúbrica en el periodo, SIN el filtro de rúbrica: las pestañas de la pantalla.
  rub as (
    select _coaching_grupo(k.rubrica_clave) clave, count(*) n
    from llamada_coaching k join llamadas ll on ll.id = k.llamada_id
    where coalesce(ll.inicio, ll.creado_en) >= v_t0 and coalesce(ll.inicio, ll.creado_en) < v_t1
      and case when p_perfil is not null then k.perfil_id = p_perfil
               when v_todos then true
               else k.perfil_id = v_yo end
    group by 1
  )
  select jsonb_build_object(
    'desde', p_desde, 'hasta', p_hasta, 'todos', v_todos and p_perfil is null, 'rubrica', p_rubrica,
    'rubricas', coalesce((select jsonb_agg(jsonb_build_object('clave', r.clave, 'n', r.n) order by r.n desc, r.clave) from rub r), '[]'),
    'n', (select count(*) from k),
    'promedio', (select round(avg(calificacion), 1) from k),
    'semanas', coalesce((select jsonb_agg(jsonb_build_object('semana', s.semana, 'n', s.n, 'promedio', s.promedio) order by s.semana) from sem s), '[]'),
    'reciente', (select round(avg(calificacion), 1) from t0 where reciente),
    'anterior', (select round(avg(calificacion), 1) from t0 where not reciente),
    'personas', coalesce((select jsonb_agg(jsonb_build_object('perfil_id', p.perfil_id, 'tipo', p.tipo, 'nombre', p.nombre, 'n', p.n, 'promedio', p.promedio,
        'reciente', (select t.reciente from tend t where t.quien = p.quien), 'anterior', (select t.anterior from tend t where t.quien = p.quien),
        'fallo', (select jsonb_build_object('nombre', f.nombre, 'n', f.n) from fal_per f where f.quien = p.quien),
        'semanas', (select jsonb_agg(jsonb_build_object('semana', s.semana, 'n', s.n, 'promedio', s.promedio) order by s.semana) from per_sem s where s.quien = p.quien),
        'mejor', (select jsonb_build_object('llamada_id', x.llamada_id, 'fecha', x.fecha, 'calificacion', x.calificacion)
                  from k x where x.quien = p.quien order by x.calificacion desc, x.fecha desc limit 1),
        'peor', (select jsonb_build_object('llamada_id', x.llamada_id, 'fecha', x.fecha, 'calificacion', x.calificacion)
                 from k x where x.quien = p.quien order by x.calificacion, x.fecha desc limit 1))
        order by p.promedio desc, p.n desc) from per p), '[]'),
    'criterios', coalesce((select jsonb_agg(jsonb_build_object('clave', c.clave, 'nombre', c.nombre, 'peso', c.peso, 'n', c.n, 'promedio', c.promedio)
        order by c.peso desc nulls last, c.clave) from crit c), '[]'),
    'fallos', coalesce((select jsonb_agg(jsonb_build_object('clave', f.clave, 'nombre', f.nombre, 'n', f.n) order by f.n desc, f.clave)
        from (select * from fal order by n desc, clave limit 10) f), '[]'),
    'tono', coalesce((select jsonb_agg(jsonb_build_object('clave', t.clave, 'nombre', t.nombre, 'signo', t.signo, 'n', t.n) order by t.signo desc, t.n desc, t.clave)
        from ton t), '[]'),
    'mejor', (select jsonb_build_object('llamada_id', x.llamada_id, 'fecha', x.fecha, 'calificacion', x.calificacion, 'perfil_id', x.perfil_id)
              from k x order by x.calificacion desc, x.fecha desc limit 1),
    'peor', (select jsonb_build_object('llamada_id', x.llamada_id, 'fecha', x.fecha, 'calificacion', x.calificacion, 'perfil_id', x.perfil_id)
             from k x order by x.calificacion, x.fecha desc limit 1))
  into v_r;
  return v_r;
end $$;
revoke execute on function public.coaching_resumen(date, date, uuid, text) from public, anon;
grant execute on function public.coaching_resumen(date, date, uuid, text) to authenticated;

create or replace function public.coaching_llamadas(p_desde date, p_hasta date, p_perfil uuid default null, p_rubrica text default null)
returns table (llamada_id uuid, fecha timestamptz, perfil_id uuid, atendio_tipo text, atendio text, quien_llamo text,
  duracion_seg int, area_nombre text, calificacion numeric, calificacion_sin_topes numeric, topes int, fallos text[],
  grabacion_url text, grabacion_vence timestamptz, rubrica text)
language sql stable security invoker set search_path = public as $$
  select k.llamada_id, coalesce(ll.inicio, ll.creado_en), k.perfil_id, k.atendio_tipo,
    case when k.atendio_tipo = 'ia' then coalesce('La IA (' || ll.atendio_ia || ')', 'La IA')
         else coalesce(p.nombre, ll.atendio_nombre || ' (sin ligar)', 'Sin nombre') end,
    coalesce(ll.cliente_nombre, ll.lead_nombre), ll.duracion_seg, ll.area_nombre, k.calificacion, k.calificacion_sin_topes,
    jsonb_array_length(k.topes),
    array(select f.v->>'nombre' from jsonb_array_elements(k.fallos) f(v) where jsonb_typeof(f.v) = 'object' and f.v->>'nombre' is not null),
    ll.grabacion_url, ll.grabacion_vence, _coaching_grupo(k.rubrica_clave)
  from llamada_coaching k
  join llamadas ll on ll.id = k.llamada_id
  left join perfiles p on p.id = k.perfil_id
  where coalesce(ll.inicio, ll.creado_en) >= p_desde::timestamp at time zone 'America/Mexico_City'
    and coalesce(ll.inicio, ll.creado_en) < (p_hasta + 1)::timestamp at time zone 'America/Mexico_City'
    and (p_perfil is null or k.perfil_id = p_perfil)
    and (p_rubrica is null or _coaching_grupo(k.rubrica_clave) = p_rubrica)
  order by 2 desc
  limit 2000
$$;
revoke execute on function public.coaching_llamadas(date, date, uuid, text) from public, anon;
grant execute on function public.coaching_llamadas(date, date, uuid, text) to authenticated;

-- Objetivos ---------------------------------------------------------------------------------------
update public.objetivo_indicadores set nombre = 'Calificación de coaching (ventas)',
  descripcion = 'Promedio del mes de la calificación (de 1 a 10) de las llamadas de VENTA que la persona atendió (cotizar, comprar o dar seguimiento), calificadas por el conmutador con su rúbrica de ventas. Lo que no es venta (un proveedor, una factura, un trámite) va en «Calificación de atención telefónica». Cada llamada queda como evidencia con su calificación; las que salen por debajo de la mínima (6 si no se cambia) cuentan como incidencia. Sin llamadas calificadas en el mes no hay dato y lo califica el jefe.'
where id = 75;

insert into public.objetivo_indicadores (id, clave, nombre, area, fuente, checklist, unidad, descripcion, dato_faltante, activo) values
  (76, 'calificacion_atencion', 'Calificación de atención telefónica', 'ventas', 'automatica', null, 'puntos',
   'Promedio del mes de la calificación (de 1 a 10) de las llamadas que la persona atendió y que NO eran venta (un proveedor, una factura, empleo, un trámite), o todas las suyas si en el conmutador tiene fija la rúbrica de atención (recepción general). Mide si quien llamó salió atendido: se entendió, se resolvió o se pasó con quien debía, y supo qué sigue. Cada llamada queda como evidencia; las que salen por debajo de la mínima (6 si no se cambia) cuentan como incidencia. Sin llamadas calificadas en el mes no hay dato y lo califica el jefe.',
   null, true)
on conflict (id) do update set clave = excluded.clave, nombre = excluded.nombre, area = excluded.area, fuente = excluded.fuente,
  unidad = excluded.unidad, descripcion = excluded.descripcion, dato_faltante = excluded.dato_faltante;

do $$
declare d text; n text; v_bloque text; v_nuevo text;
begin
  d := pg_get_functiondef('public.objetivo_medir(text, text, uuid, date, jsonb)'::regprocedure);
  -- 75: solo las de ventas (las de antes de la clave, también).
  n := replace(d, $a$        where k.perfil_id = v_usuario and k.atendio_tipo = 'persona'
          and coalesce(ll.inicio, ll.creado_en) >= v_t0 and coalesce(ll.inicio, ll.creado_en) < v_t1$a$,
    $a$        where k.perfil_id = v_usuario and k.atendio_tipo = 'persona'
          and _coaching_grupo(k.rubrica_clave) = case when p_clave = 'calificacion_atencion' then 'atencion' else 'ventas' end
          and coalesce(ll.inicio, ll.creado_en) >= v_t0 and coalesce(ll.inicio, ll.creado_en) < v_t1$a$);
  if n = d then raise exception 'objetivo_medir: no encontré el filtro de calificacion_coaching'; end if;
  d := n;
  -- 76: el mismo cálculo, con la otra rúbrica (el filtro de arriba ya distingue por p_clave).
  n := replace(d, $a$  when 'calificacion_coaching' then$a$, $a$  when 'calificacion_coaching', 'calificacion_atencion' then$a$);
  if n = d then raise exception 'objetivo_medir: no encontré el caso calificacion_coaching'; end if;
  d := n;
  n := replace(d, $a$          'nota', 'No hubo llamadas que atendiera y se calificaran en el mes (o el conmutador no está conectado). Califícalo a mano.')$a$,
    $a$          'nota', case when p_clave = 'calificacion_atencion'
            then 'No hubo llamadas de atención (lo que no es venta) que atendiera y se calificaran en el mes. Califícalo a mano.'
            else 'No hubo llamadas de venta que atendiera y se calificaran en el mes (o el conmutador no está conectado). Califícalo a mano.' end)$a$);
  if n = d then raise exception 'objetivo_medir: no encontré la nota sin dato de coaching'; end if;
  d := n;
  n := replace(d, $a$          'nota', format('Promedio de %s llamada(s) que atendió en el mes y calificó el conmutador, de 1 a 10. Incidencia: una llamada con menos de %s.',$a$,
    $a$          'nota', format('Promedio de %s llamada(s) de ' || case when p_clave = 'calificacion_atencion' then 'atención' else 'venta' end
                         || ' que atendió en el mes y calificó el conmutador, de 1 a 10. Incidencia: una llamada con menos de %s.',$a$);
  if n = d then raise exception 'objetivo_medir: no encontré la nota de coaching'; end if;
  execute n;
end $$;

-- =============================================================================
-- Uso del ERP: uso y costo de la IA, y los datos para comparar (tendencia contra el periodo
-- anterior, mapa de calor por persona y día, mezcla por sección).
--
-- Por qué: dirección pidió ver también cuánto se usa la IA y cuánto cuesta, y comparar en lugar de
-- ver barras sueltas. El costo se calcula con lo que ya se guardaba de cada consulta (tokens de
-- entrada, salida y lectura de caché) más la escritura de caché, que desde hoy también se guarda.
--   * precios_ia (Configuración): dólares por millón de tokens por modelo y el descuento de los lotes
--     (la revisión nocturna va por lotes). Son los precios publicados al 5 nov 2026; si cambian, se
--     cambian aquí y el costo de todo el periodo se recalcula.
--   * costo_ia_usd(): el costo de una consulta con esos precios.
--   * uso_tablero(): todo lo de la pantalla en una sola consulta, con el periodo anterior del mismo
--     largo para comparar. Solo dirección y sistemas.
-- Es un estimado: lo que factura el proveedor manda (impuestos y tipo de cambio aparte).
-- =============================================================================

alter table public.asistente_uso add column if not exists cache_escritura_tokens int;

insert into public.configuracion (clave, valor, descripcion) values ('precios_ia',
  '{"moneda": "USD", "por": "millón de tokens", "descuento_lotes": 0.5,
    "modelos": {"claude-opus-5-5": {"entrada": 4, "salida": 20, "cache_lectura": 0.2, "cache_escritura": 5}}}'::jsonb,
  'Precios de la IA para estimar su costo en Sistema → Uso del ERP: dólares por millón de tokens por modelo (entrada, salida, lectura y escritura de caché) y el descuento de los lotes de la revisión nocturna. Si el proveedor cambia precios o el modelo, se actualiza aquí.')
on conflict (clave) do nothing;

create or replace function public.costo_ia_usd(p_modelo text, p_entrada bigint, p_salida bigint, p_cache bigint, p_escritura bigint, p_lotes boolean default false)
returns numeric language sql stable set search_path = public as $$
  select case when p_modelo is null then 0 else coalesce(round((
      coalesce(p_entrada, 0) * coalesce((m->>'entrada')::numeric, 0)
    + coalesce(p_salida, 0) * coalesce((m->>'salida')::numeric, 0)
    + coalesce(p_cache, 0) * coalesce((m->>'cache_lectura')::numeric, 0)
    + coalesce(p_escritura, 0) * coalesce((m->>'cache_escritura')::numeric, 0)) / 1e6
    * case when p_lotes then 1 - coalesce((c.valor->>'descuento_lotes')::numeric, 0) else 1 end, 6), 0) end
  from (select valor, valor->'modelos'->p_modelo m from configuracion where clave = 'precios_ia') c
$$;

-- El detalle de una persona, ahora con lo que costó su IA por modo.
create or replace function public.uso_de_usuario(p_usuario uuid, p_desde date, p_hasta date)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare t0 timestamptz := p_desde::timestamp at time zone 'America/Mexico_City';
        t1 timestamptz := (p_hasta + 1)::timestamp at time zone 'America/Mexico_City';
begin
  if not puede('admin', 3) then
    raise exception 'Solo dirección o sistemas ven el uso del ERP' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'por_dia', (select coalesce(jsonb_agg(jsonb_build_object('dia', d.dia, 'minutos', d.minutos, 'vistas', d.vistas, 'cambios', d.cambios, 'ia', d.ia) order by d.dia), '[]')
      from (select g.dia::date dia,
              coalesce((select sum(x.minutos) from uso_diario x where x.usuario_id = p_usuario and x.dia = g.dia::date), 0) minutos,
              coalesce((select sum(x.vistas) from uso_diario x where x.usuario_id = p_usuario and x.dia = g.dia::date), 0) vistas,
              (select count(*) from bitacora x where x.usuario_id = p_usuario and (x.en at time zone 'America/Mexico_City')::date = g.dia::date) cambios,
              (select count(*) from asistente_uso x where x.usuario_id = p_usuario and (x.en at time zone 'America/Mexico_City')::date = g.dia::date and x.error is null) ia
            from generate_series(p_desde, p_hasta, interval '1 day') g(dia)) d),
    'pantallas', (select coalesce(jsonb_agg(jsonb_build_object('ruta', x.ruta, 'vistas', x.vistas, 'minutos', x.minutos, 'dias', x.dias, 'ultima', x.ultima) order by x.minutos desc, x.vistas desc), '[]')
      from (select ruta, sum(vistas)::int vistas, sum(minutos)::int minutos, count(*)::int dias, max(ultima) ultima
            from uso_diario where usuario_id = p_usuario and dia between p_desde and p_hasta group by ruta) x),
    'cambios', (select coalesce(jsonb_agg(jsonb_build_object('tabla', x.tabla, 'altas', x.altas, 'cambios', x.cambios, 'bajas', x.bajas) order by x.altas + x.cambios + x.bajas desc), '[]')
      from (select tabla, count(*) filter (where accion = 'alta')::int altas, count(*) filter (where accion = 'cambio')::int cambios,
              count(*) filter (where accion = 'baja')::int bajas
            from bitacora where usuario_id = p_usuario and en >= t0 and en < t1 group by tabla) x),
    'ia', (select coalesce(jsonb_agg(jsonb_build_object('modo', x.modo, 'n', x.n, 'costo_usd', x.costo) order by x.costo desc, x.n desc), '[]')
      from (select modo, count(*)::int n, round(sum(costo_ia_usd(modelo, entrada_tokens, salida_tokens, cache_tokens, cache_escritura_tokens)), 4) costo
            from asistente_uso where usuario_id = p_usuario and en >= t0 and en < t1 and error is null group by modo) x),
    'horas', (select coalesce(jsonb_agg(jsonb_build_object('hora', h.hora, 'n', h.n) order by h.hora), '[]')
      from (select extract(hour from en at time zone 'America/Mexico_City')::int hora, count(*)::int n
            from (select en from bitacora where usuario_id = p_usuario and en >= t0 and en < t1
                  union all select ultima from uso_diario where usuario_id = p_usuario and dia between p_desde and p_hasta
                  union all select primera from uso_diario where usuario_id = p_usuario and dia between p_desde and p_hasta) e
            group by 1) h)
  );
end $$;

create or replace function public.uso_tablero(p_desde date, p_hasta date)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_largo int := p_hasta - p_desde + 1;
  a_desde date := p_desde - (p_hasta - p_desde + 1);
  a_hasta date := p_desde - 1;
  tz constant text := 'America/Mexico_City';
  r jsonb;
begin
  if not puede('admin', 3) then
    raise exception 'Solo dirección o sistemas ven el uso del ERP' using errcode = '42501';
  end if;
  with
  -- Toda la actividad de los dos periodos, por persona y día.
  act as (
    select usuario_id u, dia, sum(minutos)::int minutos, sum(vistas)::int vistas, 0 cambios, 0 ia, 0::numeric costo
    from uso_diario where dia between a_desde and p_hasta group by 1, 2
    union all
    select usuario_id, (en at time zone tz)::date, 0, 0, count(*)::int, 0, 0
    from bitacora where usuario_id is not null and en >= a_desde::timestamp at time zone tz and en < (p_hasta + 1)::timestamp at time zone tz group by 1, 2
    union all
    select usuario_id, (en at time zone tz)::date, 0, 0, 0, count(*)::int, sum(costo_ia_usd(modelo, entrada_tokens, salida_tokens, cache_tokens, cache_escritura_tokens))
    from asistente_uso where error is null and en >= a_desde::timestamp at time zone tz and en < (p_hasta + 1)::timestamp at time zone tz group by 1, 2
  ),
  dia_u as (select u, dia, sum(minutos)::int minutos, sum(vistas)::int vistas, sum(cambios)::int cambios, sum(ia)::int ia, round(sum(costo), 4) costo
            from act group by 1, 2),
  per as (
    select u,
      count(*) filter (where dia >= p_desde)::int dias, coalesce(sum(minutos) filter (where dia >= p_desde), 0)::int minutos,
      coalesce(sum(vistas) filter (where dia >= p_desde), 0)::int vistas, coalesce(sum(cambios) filter (where dia >= p_desde), 0)::int cambios,
      coalesce(sum(ia) filter (where dia >= p_desde), 0)::int ia, coalesce(sum(costo) filter (where dia >= p_desde), 0) costo,
      count(*) filter (where dia < p_desde)::int dias_ant, coalesce(sum(minutos) filter (where dia < p_desde), 0)::int minutos_ant,
      coalesce(sum(cambios) filter (where dia < p_desde), 0)::int cambios_ant, coalesce(sum(ia) filter (where dia < p_desde), 0)::int ia_ant,
      coalesce(sum(costo) filter (where dia < p_desde), 0) costo_ant
    from dia_u group by u
  ),
  noc as (
    select (empezo_en at time zone tz)::date dia,
      round(sum(costo_ia_usd((select valor->>'modelo' from configuracion where clave = 'revision_nocturna'), entrada_tokens, salida_tokens, 0, 0, true)), 4) costo
    from revision_corridas where empezo_en >= a_desde::timestamp at time zone tz and empezo_en < (p_hasta + 1)::timestamp at time zone tz group by 1
  ),
  dias as (
    select g.dia::date dia, (g.dia::date - p_desde) n, g.dia::date >= p_desde actual
    from generate_series(a_desde, p_hasta, interval '1 day') g(dia)
  ),
  serie as (
    select d.dia, d.actual, case when d.actual then d.n else d.n + v_largo end n,
      (select count(*) from dia_u x where x.dia = d.dia and (x.minutos > 0 or x.vistas > 0 or x.cambios > 0 or x.ia > 0))::int personas,
      coalesce((select sum(minutos) from dia_u x where x.dia = d.dia), 0)::int minutos,
      coalesce((select sum(cambios) from dia_u x where x.dia = d.dia), 0)::int cambios,
      coalesce((select sum(ia) from dia_u x where x.dia = d.dia), 0)::int ia,
      coalesce((select sum(costo) from dia_u x where x.dia = d.dia), 0) + coalesce((select costo from noc where noc.dia = d.dia), 0) costo
    from dias d
  )
  select jsonb_build_object(
    'periodo', jsonb_build_object('desde', p_desde, 'hasta', p_hasta, 'ant_desde', a_desde, 'ant_hasta', a_hasta),
    'personas', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', p.id, 'nombre', p.nombre, 'correo', p.correo, 'activo', p.activo,
        'roles', coalesce((select jsonb_agg(ro.rol order by ro.rol) from usuario_roles ro where ro.usuario_id = p.id), '[]'),
        'ultimo_acceso', au.last_sign_in_at,
        'ultima_actividad', (select max(t) from (select max(ultima) t from uso_diario where usuario_id = p.id
                                                 union all select max(en) from bitacora where usuario_id = p.id
                                                 union all select max(en) from asistente_uso where usuario_id = p.id) z),
        'dias_activos', coalesce(pe.dias, 0), 'minutos', coalesce(pe.minutos, 0), 'vistas', coalesce(pe.vistas, 0),
        'pantallas', (select count(distinct ruta) from uso_diario where usuario_id = p.id and dia between p_desde and p_hasta),
        'cambios', coalesce(pe.cambios, 0), 'consultas_ia', coalesce(pe.ia, 0), 'costo_ia_usd', round(coalesce(pe.costo, 0), 4),
        'pendientes_abiertos', (select count(*) from pendientes x where x.responsable_id = p.id and x.estado = 'abierto'),
        'pendientes_vencidos', (select count(*) from pendientes x where x.responsable_id = p.id and x.estado = 'abierto' and x.vence < (now() at time zone tz)::date),
        'avisos_sin_leer', (select count(*) from avisos x where x.usuario_id = p.id and x.leido_en is null),
        'ant', jsonb_build_object('dias_activos', coalesce(pe.dias_ant, 0), 'minutos', coalesce(pe.minutos_ant, 0), 'cambios', coalesce(pe.cambios_ant, 0),
                                  'consultas_ia', coalesce(pe.ia_ant, 0), 'costo_ia_usd', round(coalesce(pe.costo_ant, 0), 4))
      ) order by p.activo desc, coalesce(pe.minutos, 0) desc, p.nombre), '[]')
      from perfiles p left join auth.users au on au.id = p.id left join per pe on pe.u = p.id),
    'por_dia', (select coalesce(jsonb_agg(jsonb_build_object('dia', dia, 'n', n, 'personas', personas, 'minutos', minutos, 'cambios', cambios, 'ia', ia, 'costo_usd', round(costo, 4)) order by dia), '[]')
      from serie where actual),
    'por_dia_ant', (select coalesce(jsonb_agg(jsonb_build_object('dia', dia, 'n', n, 'personas', personas, 'minutos', minutos, 'cambios', cambios, 'ia', ia, 'costo_usd', round(costo, 4)) order by dia), '[]')
      from serie where not actual),
    'calor', (select coalesce(jsonb_agg(jsonb_build_object('u', u, 'dia', dia, 'minutos', minutos, 'cambios', cambios, 'ia', ia)), '[]')
      from dia_u where dia >= p_desde),
    'secciones', (select coalesce(jsonb_agg(jsonb_build_object('u', usuario_id, 'seccion', s, 'minutos', m, 'vistas', v)), '[]')
      from (select usuario_id, split_part(ruta, '/', 2) s, sum(minutos)::int m, sum(vistas)::int v
            from uso_diario where dia between p_desde and p_hasta group by 1, 2) x),
    'ia', jsonb_build_object(
      'por_modo', (select coalesce(jsonb_agg(jsonb_build_object('modo', modo, 'consultas', n, 'costo_usd', costo) order by costo desc), '[]')
        from (select modo, count(*)::int n, round(sum(costo_ia_usd(modelo, entrada_tokens, salida_tokens, cache_tokens, cache_escritura_tokens)), 4) costo
              from asistente_uso where error is null and en >= p_desde::timestamp at time zone tz and en < (p_hasta + 1)::timestamp at time zone tz group by modo) x),
      'nocturna_usd', (select round(coalesce(sum(costo), 0), 4) from noc where dia >= p_desde),
      'nocturna_ant_usd', (select round(coalesce(sum(costo), 0), 4) from noc where dia < p_desde),
      'tc_usd', tc('USD'))
  ) into r;
  return r;
end $$;
revoke execute on function public.uso_tablero(date, date) from public, anon;
grant execute on function public.uso_tablero(date, date) to authenticated;

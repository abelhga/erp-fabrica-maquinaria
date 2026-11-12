-- =============================================================================
-- Freno de seguimiento: interruptor y «Liberar hasta…».
--
-- Por qué: los vendedores se fueron a la Expo Agroalimentaria de Guanajuato y el freno (más de 10
-- seguimientos vencidos = no se envían cotizaciones) no los dejaba cotizar. La única salida era
-- «Liberar por hoy», un vendedor a la vez y un día a la vez; para dos días y tres vendedores hubo que
-- meter las liberaciones por fuera de la pantalla. Abel pidió un interruptor.
--
-- Qué cambia:
--   * liberar_freno_hasta(vendedores, hasta, motivo): la gerencia libera a uno o a varios hasta una
--     fecha (máximo 31 días). Es la misma liberación por día de siempre, solo que de golpe: se quita
--     sola al pasar la fecha y a cada uno le llega el aviso con el día en que regresa el freno.
--   * En Configuración (dirección y sistemas), seguimiento_cotizaciones lleva «freno_activo» además del
--     tope: apagado, nadie se frena; los seguimientos se siguen contando igual.
--   * freno_seguimiento() y v_seguimientos_por_vendedor respetan el interruptor y dicen hasta cuándo
--     está liberado cada quien.
-- =============================================================================

create or replace function public._config_seguimiento() returns jsonb
language sql stable set search_path = public as $$
  select '{"dias_habiles": 3, "dias_no_contesta": 2, "tope_vencidos": 10, "por_dia_al_arrancar": 8,
           "no_contesto_para_perder": 2, "dias_para_perder": 10, "racha_para_decidir": 3, "freno_activo": true}'::jsonb
         || coalesce((select valor from configuracion where clave = 'seguimiento_cotizaciones'), '{}'::jsonb)
$$;

-- Hasta qué día está liberado alguien (el último día seguido desde hoy), o null.
create or replace function public.freno_liberado_hasta(p_vendedor uuid) returns date
language sql stable security definer set search_path = public as $$
  with recursive d(dia) as (
    select hoy_mx() where exists (select 1 from freno_liberado where vendedor_id = p_vendedor and dia = hoy_mx())
    union all
    select d.dia + 1 from d where exists (select 1 from freno_liberado where vendedor_id = p_vendedor and dia = d.dia + 1)
  )
  select max(dia) from d
$$;
revoke execute on function public.freno_liberado_hasta(uuid) from public, anon;
grant execute on function public.freno_liberado_hasta(uuid) to authenticated;

create or replace function public.freno_seguimiento(p_vendedor uuid default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v uuid := coalesce(p_vendedor, auth.uid()); v_n int; v_tope int; v_activo boolean; v_lib record;
begin
  if auth.uid() is not null and v is distinct from auth.uid() and not puede('ventas', 3) then v := auth.uid(); end if;
  v_tope := (_config_seguimiento()->>'tope_vencidos')::int;
  v_activo := coalesce((_config_seguimiento()->>'freno_activo')::boolean, true);
  select count(*) into v_n from seguimientos_cotizacion where vendedor_id = v and estado = 'pendiente' and vence < hoy_mx();
  select l.motivo, p.nombre as por into v_lib from freno_liberado l left join perfiles p on p.id = l.por
  where l.vendedor_id = v and l.dia = hoy_mx();
  return jsonb_build_object('vencidos', v_n, 'tope', v_tope, 'activo', v_activo, 'liberado', v_lib.motivo is not null,
    'liberado_por', v_lib.por, 'motivo', v_lib.motivo, 'liberado_hasta', freno_liberado_hasta(v),
    'frenado', v_activo and v_n > v_tope and v_lib.motivo is null);
end $$;

create or replace view public.v_seguimientos_por_vendedor with (security_invoker = true) as
 WITH s AS (
         SELECT seguimientos_cotizacion.vendedor_id,
            count(*) FILTER (WHERE (seguimientos_cotizacion.estado = 'pendiente'::text)) AS pendientes,
            count(*) FILTER (WHERE ((seguimientos_cotizacion.estado = 'pendiente'::text) AND (seguimientos_cotizacion.vence < hoy_mx()))) AS vencidos,
            count(*) FILTER (WHERE ((seguimientos_cotizacion.estado = 'pendiente'::text) AND (seguimientos_cotizacion.vence = hoy_mx()))) AS para_hoy,
            count(*) FILTER (WHERE ((seguimientos_cotizacion.estado = 'hecho'::text) AND (seguimientos_cotizacion.cerrado_en > (now() - '7 days'::interval)))) AS anotados_7d
           FROM seguimientos_cotizacion
          GROUP BY seguimientos_cotizacion.vendedor_id
        )
 SELECT s.vendedor_id,
    pf.nombre AS vendedor,
    s.pendientes,
    s.vencidos,
    s.para_hoy,
    s.anotados_7d,
    ( SELECT count(*) AS count
           FROM cotizaciones c
          WHERE ((c.vendedor_id = s.vendedor_id) AND (c.enviada_en > (now() - '7 days'::interval)))) AS enviadas_7d,
    (coalesce((_config_seguimiento() ->> 'freno_activo')::boolean, true)
      AND (s.vencidos > ((_config_seguimiento() ->> 'tope_vencidos'::text))::integer) AND (l.motivo IS NULL)) AS frenado,
    l.motivo AS liberado_motivo,
    CASE WHEN l.motivo IS NOT NULL THEN freno_liberado_hasta(s.vendedor_id) END AS liberado_hasta
   FROM ((s
     JOIN perfiles pf ON ((pf.id = s.vendedor_id)))
     LEFT JOIN freno_liberado l ON (((l.vendedor_id = s.vendedor_id) AND (l.dia = hoy_mx()))));

-- La gerencia libera a uno o a varios hasta una fecha. Regresa a cuántos liberó.
create or replace function public.liberar_freno_hasta(p_vendedores uuid[], p_hasta date, p_motivo text) returns int
language plpgsql security definer set search_path = public as $$
declare v_n int;
begin
  if not puede('ventas', 3) then raise exception 'Solo la gerencia de ventas quita el freno' using errcode = '42501'; end if;
  if coalesce(cardinality(p_vendedores), 0) = 0 then raise exception 'Elige a quién liberas'; end if;
  if coalesce(length(trim(p_motivo)), 0) < 3 then raise exception 'Escribe por qué lo liberas'; end if;
  if p_hasta is null or p_hasta < hoy_mx() then raise exception 'La fecha tiene que ser hoy o después'; end if;
  if p_hasta > hoy_mx() + 31 then raise exception 'Se libera por un mes como máximo: para más tiempo, apaga el freno en Configuración'; end if;

  insert into freno_liberado (vendedor_id, dia, motivo, por)
  select v, d::date, trim(p_motivo), auth.uid()
  from unnest(p_vendedores) v, generate_series(hoy_mx(), p_hasta, interval '1 day') d
  where exists (select 1 from perfiles where id = v and activo)
  on conflict (vendedor_id, dia) do update set motivo = excluded.motivo, por = excluded.por, en = now();

  select count(distinct v) into v_n from unnest(p_vendedores) v where exists (select 1 from perfiles where id = v and activo);
  perform avisar(array(select v from unnest(p_vendedores) v where exists (select 1 from perfiles where id = v and activo)),
    'freno_liberado',
    case when p_hasta = hoy_mx() then 'Puedes enviar cotizaciones hoy' else 'Puedes enviar cotizaciones hasta el ' || to_char(p_hasta, 'DD/MM') end,
    format('La gerencia te liberó (%s). El %s vuelve el freno si sigues con seguimientos vencidos: ponte al día antes.',
           trim(p_motivo), to_char(p_hasta + 1, 'DD/MM')),
    '/ventas/cotizaciones?estado=seguimiento', null, null, false);
  return v_n;
end $$;
revoke execute on function public.liberar_freno_hasta(uuid[], date, text) from public, anon;
grant execute on function public.liberar_freno_hasta(uuid[], date, text) to authenticated;

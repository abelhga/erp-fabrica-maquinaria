-- =============================================================================
-- «Consumo atípico» compara contra la costumbre de verdad.
--
-- Por qué: la regla dividía lo consumido en las 12 semanas anteriores entre 12, pero el ERP solo
-- tiene consumos desde el 13 de octubre (unas 3 semanas). La «costumbre» salía 3 o 4 veces más baja
-- de lo real y casi todo consumible parecía atípico: el 12 nov había 49 hallazgos abiertos, y con el
-- promedio bien hecho ese día salían 2 en vez de 8. Además, el mismo artículo volvía a salir cada
-- semana mientras el anterior seguía sin contestar.
--
-- Qué cambia: el promedio se divide entre las semanas que de verdad hay de historia (desde el primer
-- consumo registrado, con tope de 12 y mínimo 1), y un artículo que ya tiene un hallazgo de esta
-- regla abierto no saca otro.
-- =============================================================================

create or replace function public.revision_r_salida_consumo_atipica()
 returns setof revision_hallazgo_nuevo
 language sql stable security definer
 set search_path to 'public', 'extensions'
as $function$
  with historia as (
    -- Semanas de historia antes de la semana que se revisa: desde el primer consumo, máximo 12.
    select greatest(extract(epoch from (now() - interval '7 days')
                      - greatest(min(en), now() - interval '91 days')) / 604800.0, 1) semanas
    from movimientos_inventario where tipo = 'salida_consumo'
  ), semana as (
    select articulo_id, sum(-cantidad) cant, count(*) veces,
           jsonb_agg(distinct coalesce(revision_nombre(usuario_id), 'sin nombre')) quienes
    from movimientos_inventario
    where tipo = 'salida_consumo' and en > now() - interval '7 days'
    group by articulo_id
  ), antes as (
    select articulo_id, sum(-cantidad) / (select semanas from historia) promedio
    from movimientos_inventario
    where tipo = 'salida_consumo' and en between now() - interval '91 days' and now() - interval '7 days'
    group by articulo_id
  )
  select 'articulos', a.id::text, revision_ruta_articulo(a.tipo::text, a.id),
    format('Consumo de %s: %s en una semana, contra %s de costumbre', a.clave, round(s.cant, 1), round(an.promedio, 1)),
    format('En los últimos 7 días salieron %s %s de «%s» como consumo (%s salidas), y el promedio de las %s semanas anteriores era %s por semana. Puede ser un trabajo especial; vale la pena preguntar para qué fue.',
           round(s.cant, 1), coalesce(a.unidad, 'pzas'), a.nombre, s.veces, round((select semanas from historia)::numeric, 0), round(an.promedio, 1)),
    jsonb_build_array(jsonb_build_object('tipo', 'articulo', 'referencia', a.id, 'folio', a.clave, 'detalle', 'registraron: ' ||
                        (select string_agg(x, ', ') from jsonb_array_elements_text(s.quienes) x), 'cantidad', round(s.cant, 2))),
    '{}'::uuid[], 'media', null::jsonb,
    'salida_consumo_atipica:' || a.id || ':' || to_char(current_date, 'IYYY-IW')
  from semana s join antes an using (articulo_id) join articulos a on a.id = s.articulo_id
  where an.promedio > 0 and s.cant >= 5 and s.cant >= 3 * an.promedio
    -- Mientras el de una semana anterior siga sin contestar, no se repite.
    and not exists (select 1 from revision_hallazgos h
                    where h.regla = 'salida_consumo_atipica' and h.estado = 'abierto' and h.registro_id = a.id::text)
$function$;

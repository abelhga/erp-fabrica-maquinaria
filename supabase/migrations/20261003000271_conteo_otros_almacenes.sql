-- =============================================================================
-- Al contar, avisar si el artículo también está en otro almacén.
--
-- Por qué: un conteo es de un solo almacén. Lo que se captura reemplaza la existencia de ese
-- almacén y de ningún otro. Hegamex guarda en Revolución lo de más de un mes y surte la planta cada
-- mes; 28 de los 47 artículos de Revolución también están en otro almacén (catarinas en el
-- Contenedor 2, motovibradores en el Contenedor 1). Si en la planta alguien cuenta también lo que
-- sabe que hay en Revolución, el ERP inventa un sobrante, y a ciegas no hay cómo darse cuenta.
--
-- conteo_captura regresa otros_almacenes: los nombres de los demás almacenes donde ese artículo
-- tiene existencia (sin la cantidad, para no romper el conteo a ciegas). La pantalla lo usa para
-- avisar «cuenta solo lo de aquí». No hay ningún nombre de almacén fijo en el código.
-- =============================================================================

drop function if exists public.conteo_captura(uuid);
create or replace function public.conteo_captura(p_conteo uuid)
returns table (articulo_id uuid, clave text, nombre text, unidad text, sistema numeric, contada numeric, diferencia numeric,
               contado_por text, contado_en timestamptz, valor_diferencia numeric, nota text, otros_almacenes text[])
language sql stable security invoker as $$
  with c as (select * from public.conteos where id = p_conteo),
  arts as (
    select e.articulo_id from public.existencias e join c on e.almacen_id = c.almacen_id where e.cantidad <> 0 and not c.con_lista
    union
    select ca.articulo_id from public.conteo_articulos ca where ca.conteo_id = p_conteo
    union
    select l.articulo_id from public.conteo_lineas l where l.conteo_id = p_conteo
  )
  select a.id, a.clave, a.nombre, a.unidad,
    case when c.a_ciegas and l.cantidad_contada is null then null else s.sistema end,
    l.cantidad_contada, l.cantidad_contada - s.sistema, u.nombre, l.en,
    case when (select public.puede('costos', 1)) and l.cantidad_contada is not null
         then round((l.cantidad_contada - s.sistema) * ca.costo * public.tc(ca.moneda), 2) end,
    n.nota,
    -- Dónde más hay (solo el nombre, nunca cuánto: el conteo sigue siendo a ciegas).
    (select array_agg(al.nombre order by al.nombre) from public.existencias o join public.almacenes al on al.id = o.almacen_id
      where o.articulo_id = a.id and o.almacen_id <> c.almacen_id and o.cantidad <> 0)
  from arts x
  join public.articulos a on a.id = x.articulo_id
  cross join c
  left join public.existencias e on e.articulo_id = a.id and e.almacen_id = c.almacen_id
  left join public.conteo_lineas l on l.conteo_id = p_conteo and l.articulo_id = a.id
  left join public.conteo_articulos n on n.conteo_id = p_conteo and n.articulo_id = a.id
  cross join lateral (select coalesce(l.sistema_al_contar, e.cantidad, 0) as sistema) s
  left join public.perfiles u on u.id = l.contado_por
  left join public.costos_articulo ca on ca.articulo_id = a.id
  order by a.nombre
$$;
grant execute on function public.conteo_captura(uuid) to authenticated;

-- =============================================================================
-- El conteo de faltantes de las órdenes ya no revisa permisos renglón por renglón.
--
-- Por qué: el 17 nov, de 13:00 a 17:30, la base cortó 1,677 consultas por pasar de 8 s; casi todas
-- del tablero de producción, la terminal de piso y el plan de cuadrillas. A la gerencia de producción
-- la terminal le decía «Sin órdenes» en todas las etapas y Cuadrillas una barra roja (el corte).
-- Las tres pantallas pasan por faltantes_de_ordenes(), que contaba sobre v_op_material: esa vista
-- llama pedido_a_compras_op() por renglón (security definer, con dos puede() adentro) y calcula
-- existencias y disponible que aquí no se usan. Con 45 órdenes abiertas y 2,172 renglones eran ~4,000
-- revisiones de permiso por consulta: 1.2 s con la base sola, y 5–8 s en horas de trabajo, cuando
-- cada movimiento de piso recarga todas las pantallas a la vez.
--
-- Qué cambia: la misma cuenta, por conjuntos. El permiso se revisa una vez; lo apartado y lo pedido a
-- compras se suman una vez por (orden, artículo) y se unen. Medido en la nube con el usuario de la
-- gerencia de producción: la función 1,212 → 15 ms, el tablero 1,243 → 59 ms, la terminal 2,032 →
-- 809 ms; el resultado, idéntico en las 25 órdenes con material (except en los dos sentidos = 0).
-- v_op_material no cambia: el detalle de una orden sigue saliendo de ahí.
-- =============================================================================

create or replace function public.faltantes_de_ordenes()
returns table (orden_id uuid, faltantes bigint, sin_pedir bigint)
language sql stable security definer set search_path = public as $$
  with abiertas as (
    select o.id from ordenes_produccion o
    where o.estado not in ('terminada', 'entregada', 'cancelada')
      and ((select puede('produccion', 1)) or (select puede('inventario', 1)))
  ), res as (
    select r.orden_produccion_id, r.articulo_id, sum(r.cantidad - r.surtido) apartado
    from reservas r
    where r.estado = 'activa' and r.orden_produccion_id in (select id from abiertas)
    group by 1, 2
  ), req as (
    select l.orden_produccion_id, l.articulo_id, sum(l.cantidad) pedido
    from requisicion_lineas l
    where l.estado <> 'cancelada' and l.orden_produccion_id in (select id from abiertas)
    group by 1, 2
  ), mat as (
    select m.orden_id,
      -- Igual que v_op_material: lo que pone el taller (consumibles) nunca cuenta como faltante.
      case when coalesce(c.consumible_taller, false) and (select consumibles_del_taller()) then 0
           else greatest(m.requerido - m.surtido - coalesce(res.apartado, 0), 0) end faltante,
      coalesce(req.pedido, 0) pedido
    from op_materiales m
    join abiertas o on o.id = m.orden_id
    join articulos a on a.id = m.articulo_id
    left join categorias c on c.id = a.categoria_id
    left join res on res.orden_produccion_id = m.orden_id and res.articulo_id = m.articulo_id
    left join req on req.orden_produccion_id = m.orden_id and req.articulo_id = m.articulo_id
  )
  select mat.orden_id, count(*) filter (where mat.faltante > 0), count(*) filter (where mat.faltante - mat.pedido > 0)
  from mat group by mat.orden_id
$$;
revoke execute on function public.faltantes_de_ordenes() from public, anon;
grant execute on function public.faltantes_de_ordenes() to authenticated;

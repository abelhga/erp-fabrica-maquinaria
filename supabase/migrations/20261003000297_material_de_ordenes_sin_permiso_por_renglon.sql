-- =============================================================================
-- El material de las órdenes (v_op_material) ya no cuesta 1.5 ms por renglón.
--
-- Por qué: revisando qué más podía atorarse como el tablero (295), la vista completa tardaba 6.1 s en
-- la nube con 4,218 renglones, y el detalle de la orden más grande 0.3 s. De ella salen el material de
-- cada orden, validacion_orden (5,551 llamadas, 1.5 s en promedio en horas de trabajo) y lo que surte
-- almacén. Dos causas, medidas columna por columna:
--   * «reemplazado_por» buscaba en op_materiales por reemplaza_a sin índice: recorría toda la tabla
--     por cada renglón (2.9 s);
--   * «pedido_a_compras» llamaba pedido_a_compras_op() por renglón, security definer con dos puede()
--     adentro (2.3 s): lo que CLAUDE.md pide no hacer.
--
-- Qué cambia: el índice, y lo pedido a compras sale de pedido_a_compras_ops(), que revisa el permiso
-- una vez y regresa el conjunto (orden, artículo, pedido) para unirlo. Mismos números (en la nube,
-- 0 diferencias en los 4,218 renglones): la vista completa 6,142 → 95 ms, la orden más grande
-- 292 → 12 ms, validacion_orden 128 → 12 ms. pedido_a_compras_op() se queda para quien la llame suelta.
-- =============================================================================

create index if not exists op_materiales_reemplaza_a on public.op_materiales (reemplaza_a) where reemplaza_a is not null;

-- Lo pedido a compras para cada orden y artículo. Lo ve quien ve el avance o el inventario, igual que
-- pedido_a_compras_op(): la requisición puede ser de alguien más y no se lee completa.
create or replace function public.pedido_a_compras_ops()
returns table (orden_id uuid, articulo_id uuid, pedido numeric)
language sql stable security definer set search_path = public as $$
  select l.orden_produccion_id, l.articulo_id, sum(l.cantidad)
  from requisicion_lineas l
  where l.orden_produccion_id is not null and l.estado <> 'cancelada'
    and ((select puede('produccion', 1)) or (select puede('inventario', 1)))
  group by 1, 2
$$;
revoke execute on function public.pedido_a_compras_ops() from public, anon;
grant execute on function public.pedido_a_compras_ops() to authenticated;

-- Misma vista que en 238; solo cambia de dónde sale pedido_a_compras.
create or replace view public.v_op_material with (security_invoker = true) as
select m.id, m.orden_id, m.articulo_id, a.clave, a.nombre, a.unidad, m.requerido, m.surtido, m.ruta, m.agregado, m.notas,
  coalesce(r.apartado, 0) as apartado,
  case when t.del_taller then 0 else greatest(m.requerido - m.surtido - coalesce(r.apartado, 0), 0) end as faltante,
  coalesce(pc.pedido, 0) as pedido_a_compras,
  coalesce(e.en_planta, 0) as existencia_planta,
  case when t.del_taller then 0 else greatest(m.requerido - m.surtido, 0) end as por_surtir,
  greatest(coalesce(e.en_planta, 0) - coalesce((select sum(x.cantidad - x.surtido) from public.reservas x
                                                where x.articulo_id = m.articulo_id and x.estado = 'activa'), 0), 0) as disponible_planta,
  a.tipo,
  t.del_taller,
  c.nombre as categoria,
  m.quitado_en, m.motivo_quitado, pq.nombre as quitado_por, m.requerido_antes, m.reemplaza_a,
  (select a2.nombre from public.op_materiales m2 join public.articulos a2 on a2.id = m2.articulo_id where m2.id = m.reemplaza_a) as reemplaza_a_nombre,
  (select a3.nombre from public.op_materiales m3 join public.articulos a3 on a3.id = m3.articulo_id where m3.reemplaza_a = m.id limit 1) as reemplazado_por
from public.op_materiales m
left join public.perfiles pq on pq.id = m.quitado_por
join public.articulos a on a.id = m.articulo_id
left join public.categorias c on c.id = a.categoria_id
left join public.pedido_a_compras_ops() pc on pc.orden_id = m.orden_id and pc.articulo_id = m.articulo_id
cross join lateral (select coalesce(c.consumible_taller, false) and (select public.consumibles_del_taller()) as del_taller) t
left join lateral (select sum(cantidad - surtido) apartado from public.reservas
                   where orden_produccion_id = m.orden_id and articulo_id = m.articulo_id and estado = 'activa') r on true
left join lateral (select sum(x.cantidad) en_planta from public.existencias x join public.almacenes al on al.id = x.almacen_id
                   where x.articulo_id = m.articulo_id and al.disponible_para_planta) e on true;
grant select on public.v_op_material to authenticated;

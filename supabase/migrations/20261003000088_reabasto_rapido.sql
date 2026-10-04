-- =============================================================================
-- El reabasto no cargaba en la nube: "canceling statement due to statement timeout".
--
-- reabasto_detalle() buscaba lo que ya está en borradores de compra con un
-- "left join lateral" por artículo contra v_oc_lineas y v_ordenes_compra. Esas
-- vistas calculan los permisos (puede(), ve_costos_compra()) y sus subconsultas
-- cada vez que se leen, así que con 5,155 artículos se recalculaban 5,155 veces:
-- 4.4 s en el servidor de la nube, y la pantalla pide la lista en páginas de mil,
-- cada una volviendo a correr todo. Con el tope de 8 s del rol authenticated, la
-- pantalla se quedaba sin datos para todos los roles. En local no se notaba porque
-- la máquina es más rápida y no hay tope.
--
-- Lo mismo pasaba dentro de reabasto(): los 12 meses de consumo de cada artículo
-- salían de una subconsulta por artículo contra movimientos_inventario e
-- historial_movimientos_hoja, cada una con su RLS. Ahora se arman todos de una pasada.
--
-- Mismas columnas y mismos números: se comparó la salida completa antes y después
-- (5,155 artículos, cero diferencias) y lo cuidan 70_compras_almacen_pantallas.sql
-- y las demás pruebas de reabasto.
-- =============================================================================

-- reabasto(): igual que en 20261003000075, salvo cómo se arman los 12 meses.
create or replace function public.reabasto(p_al date default null)
returns table (
  articulo_id uuid, clave text, nombre text, unidad text, es_importado boolean, proveedor text,
  consumo_meses numeric[], meses_con_consumo int, demanda_mensual numeric, dias_entrega int, meses_cobertura numeric,
  stock_seguridad numeric, punto_reorden numeric, lote numeric, en_planta numeric, reservado numeric, en_transito numeric,
  disponible numeric, sugerido numeric, estado text
)
language sql stable security invoker as $$
  with cfg as (select valor c from configuracion where clave = 'reabasto'),
  hoy as (select date_trunc('month', coalesce(p_al, current_date))::date mes),
  salidas as (
    select m.articulo_id, m.en, -m.cantidad cantidad from movimientos_inventario m
    where m.tipo in ('salida_produccion', 'salida_venta', 'salida_consumo')
    union all
    select h.articulo_id, h.fecha, h.cantidad from historial_movimientos_hoja h
    where h.tipo = 'SALIDA' and h.articulo_id is not null
  ),
  consumo as materialized (
    select s.articulo_id,
      ((extract(year from hoy.mes) - extract(year from s.en)) * 12 + extract(month from hoy.mes) - extract(month from s.en))::int g,
      sum(s.cantidad) total
    from salidas s, hoy
    where s.en >= hoy.mes - interval '12 months' and s.en < hoy.mes
    group by 1, 2
  ),
  real as (select r.proveedor_id, r.dias_habiles from entrega_real_proveedores() r),
  -- Los 12 meses de todos los artículos de una pasada. Antes era una subconsulta por
  -- artículo, y cada una volvía a leer los movimientos con su RLS: 5 mil veces.
  meses as (
    select a.id articulo_id, array_agg(coalesce(c.total, 0) order by g.g desc) consumo_meses
    from articulos a cross join generate_series(1, 12) g(g)
    left join consumo c on c.articulo_id = a.id and c.g = g.g
    where a.activo and a.controla_inventario and a.tipo in ('componente', 'materia_prima')
    group by a.id
  ),
  base as (
    select a.id, a.clave, a.nombre, a.unidad, a.es_importado, p.nombre proveedor, a.empaque, a.stock_minimo_fijo,
      mm.consumo_meses,
      coalesce(re.dias_habiles, a.tiempo_entrega_dias, p.dias_entrega, ((select c from cfg)->>'dias_entrega_default')::int) dias,
      coalesce(a.meses_cobertura, case when a.es_importado then ((select c from cfg)->>'meses_cobertura_importado')::numeric
                                       else ((select c from cfg)->>'meses_cobertura_nacional')::numeric end) cobertura
    from articulos a left join proveedores p on p.id = a.proveedor_id
    left join real re on re.proveedor_id = a.proveedor_id
    join meses mm on mm.articulo_id = a.id
    where a.activo and a.controla_inventario and a.tipo in ('componente', 'materia_prima')
  ),
  calc as (
    select b.*, x.en_planta, x.reservado, x.en_transito, (select c from cfg) c,
      (select count(*) from unnest(b.consumo_meses[7:12]) v where v > 0)::int con_consumo
    from base b join v_existencias x on x.articulo_id = b.id
  ),
  demanda as (
    select calc.*,
      case
        when con_consumo >= (c->>'meses_con_consumo')::int then
          case when c->>'promedio' = 'todos' then (select avg(v) from unnest(consumo_meses[7:12]) v)
               else (select avg(v) from unnest(consumo_meses[7:12]) v where v > 0) end
        when es_importado and (select sum(v) from unnest(consumo_meses) v) > 0 then (select sum(v) from unnest(consumo_meses) v) / 12.0
        else 0 end as dm
    from calc
  ),
  final as (
    select d.*,
      ceil(d.dm / (c->>'dias_habiles_mes')::numeric * d.dias + coalesce(d.stock_minimo_fijo, 0)) as pr,
      ceil(d.dm * d.cobertura) as lt,
      d.en_planta - d.reservado + d.en_transito as disp
    from demanda d
  )
  select f.id, f.clave, f.nombre, f.unidad, f.es_importado, f.proveedor, f.consumo_meses, f.con_consumo,
    round(f.dm, 2), f.dias, f.cobertura, f.stock_minimo_fijo, f.pr, f.lt, f.en_planta, f.reservado, f.en_transito, f.disp,
    case when f.disp < f.pr then ceil((f.lt + f.pr - f.disp) / f.empaque) * f.empaque else 0 end,
    case when f.en_planta < 0 then 'negativo'
         when f.disp < f.pr then 'ordenar'
         when (select sum(v) from unnest(f.consumo_meses) v) = 0 and f.en_planta > 0 and f.stock_minimo_fijo is null then 'excedente'
         else 'ok' end
  from final f
$$;

create or replace function public.reabasto_detalle()
 returns table(articulo_id uuid, clave text, nombre text, unidad text, es_importado boolean, proveedor text, consumo_meses numeric[], meses_con_consumo integer, demanda_mensual numeric, dias_entrega integer, meses_cobertura numeric, stock_seguridad numeric, punto_reorden numeric, lote numeric, en_planta numeric, reservado numeric, en_transito numeric, disponible numeric, sugerido numeric, estado text, proveedor_id uuid, empaque numeric, cobertura_propia numeric, entrega_propia integer, en_borrador numeric, borradores text, en_requisicion numeric, costo_mxn numeric)
 language sql
 stable
as $function$
  with b as (select l.articulo_id, sum(l.cantidad - l.recibido) cant, string_agg(distinct o.folio, ', ') folios
             from public.v_oc_lineas l join public.v_ordenes_compra o on o.id = l.orden_compra_id
             where o.estado = 'borrador' and l.articulo_id is not null
             group by l.articulo_id),
       q as (select x.articulo_id, sum(x.cantidad) cant from public.requisicion_lineas x
             where x.estado = 'pendiente' group by x.articulo_id)
  select r.*, coalesce(c.proveedor_id, a.proveedor_id), a.empaque, a.meses_cobertura, a.tiempo_entrega_dias,
    coalesce(b.cant, 0), b.folios, coalesce(q.cant, 0),
    round(c.costo * public.tc(c.moneda), 4)
  from public.reabasto() r
  join public.articulos a on a.id = r.articulo_id
  left join public.costos_articulo c on c.articulo_id = r.articulo_id
  left join b on b.articulo_id = r.articulo_id
  left join q on q.articulo_id = r.articulo_id
$function$;

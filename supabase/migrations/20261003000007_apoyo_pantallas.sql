-- Funciones de apoyo a las pantallas. Todas son security invoker: la RLS de
-- cada tabla decide qué ve quien pregunta (un vendedor recibe precio pero no costo).

-- El buscador del cotizador: escribe "banda 18" y salen bandas de 18" con su
-- precio, existencia y foto, como el BUSCADOR de la hoja pero sin listas de 4,555 nombres.
create or replace function public.buscar_articulos(q text, p_tipos public.tipo_articulo[] default null, p_limite int default 25)
returns table (id uuid, clave text, nombre text, tipo public.tipo_articulo, unidad text, descripcion text, imagen_url text,
               precio numeric, existencia numeric, tiempo_entrega_dias int, es_importado boolean)
language sql stable security invoker as $$
  with t as (select sin_acentos(trim(coalesce(q, ''))) t)
  select a.id, a.clave, a.nombre, a.tipo, a.unidad, a.descripcion, a.imagen_url, pl.precio,
    (select sum(e.cantidad) from existencias e join almacenes al on al.id = e.almacen_id
     where e.articulo_id = a.id and al.disponible_para_planta),
    a.tiempo_entrega_dias, a.es_importado
  from articulos a cross join t
  left join precios_lista pl on pl.articulo_id = a.id
  where a.activo
    and (p_tipos is null or a.tipo = any(p_tipos))
    and (t.t = '' or sin_acentos(a.clave || ' ' || a.nombre) like '%' || replace(t.t, ' ', '%') || '%'
         or sin_acentos(a.nombre) % t.t)
  order by (sin_acentos(a.clave) = t.t) desc, similarity(sin_acentos(a.nombre), t.t) desc, a.nombre
  limit p_limite
$$;

create or replace function public.buscar_clientes(q text, p_limite int default 15)
returns table (id uuid, nombre text, razon_social text, ciudad text, vendedor text, vendedor_id uuid)
language sql stable security invoker as $$
  with t as (select sin_acentos(trim(coalesce(q, ''))) t)
  select c.id, c.nombre, c.razon_social, c.ciudad, p.nombre, c.vendedor_id
  from clientes c cross join t left join perfiles p on p.id = c.vendedor_id
  where c.activo and (t.t = '' or sin_acentos(c.nombre || ' ' || coalesce(c.razon_social, '') || ' ' || coalesce(c.rfc, ''))
        like '%' || replace(t.t, ' ', '%') || '%')
  order by similarity(sin_acentos(c.nombre), t.t) desc, c.nombre
  limit p_limite
$$;

-- Lo que el vendedor ve al elegir una partida (el panel del BUSCADOR):
-- precio, precio mínimo autorizado, stock, plazo, mensualidades y envío gratis.
create or replace function public.ficha_venta(p_articulo uuid) returns jsonb
language sql stable security invoker as $$
  select jsonb_build_object(
    'precio', pl.precio,
    'precio_minimo', round(pl.precio * (1 - coalesce(pp.descuento_maximo, 0.10)), 2),
    'descuento_maximo', coalesce(pp.descuento_maximo, 0.10),
    'existencia', (select sum(e.cantidad) from existencias e join almacenes al on al.id = e.almacen_id
                   where e.articulo_id = a.id and al.disponible_para_planta),
    'en_mercadolibre', (select sum(e.cantidad) from existencias e join almacenes al on al.id = e.almacen_id
                        where e.articulo_id = a.id and not al.disponible_para_planta),
    'tiempo_entrega_dias', coalesce(a.tiempo_entrega_dias, prov.dias_entrega),
    'envio_gratis', (pl.precio * 1.16 >= (cfg.valor->>'desde_neto')::numeric
                     and not exists (select 1 from jsonb_array_elements_text(cfg.valor->'excluir_palabras') w
                                     where sin_acentos(a.nombre) like '%' || sin_acentos(w) || '%')),
    'precio_ml', precio_canal(a.id, 'mercadolibre'),
    'precio_ml_con_envio', precio_canal(a.id, 'mercadolibre', true),
    'actualizado', pl.calculado_en
  )
  from articulos a
  left join precios_lista pl on pl.articulo_id = a.id
  left join politicas_precio pp on pp.id = politica_de(a.id)
  left join proveedores prov on prov.id = a.proveedor_id
  cross join (select valor from configuracion where clave = 'envio_gratis') cfg
  where a.id = p_articulo
$$;

-- Árbol completo de un fabricado, con cantidades acumuladas por nivel (para el
-- editor de listas de materiales y para que almacén vea "en qué va cada pieza").
create or replace function public.arbol_bom(p_articulo uuid)
returns table (linea_id uuid, padre_id uuid, articulo_id uuid, clave text, nombre text, tipo public.tipo_articulo,
               unidad text, cantidad numeric, cantidad_total numeric, nivel int, camino uuid[], grupo text, parametro text,
               por_parametro numeric, redondear_arriba boolean, merma numeric, notas text, orden int)
language sql stable security invoker as $$
  with recursive arbol as (
    select b.id, b.padre_id, b.hijo_id, cantidad_linea(b) cant, cantidad_linea(b) tot, 1 nivel, array[b.padre_id, b.hijo_id] camino,
           b.grupo, b.parametro, b.por_parametro, b.redondear_arriba, b.merma, b.notas, b.orden, b.cantidad
    from bom_lineas b where b.padre_id = p_articulo
    union all
    select b.id, b.padre_id, b.hijo_id, cantidad_linea(b), arbol.tot * cantidad_linea(b), arbol.nivel + 1, arbol.camino || b.hijo_id,
           b.grupo, b.parametro, b.por_parametro, b.redondear_arriba, b.merma, b.notas, b.orden, b.cantidad
    from arbol join bom_lineas b on b.padre_id = arbol.hijo_id
    where arbol.nivel < 10
  )
  select arbol.id, arbol.padre_id, arbol.hijo_id, a.clave, a.nombre, a.tipo, a.unidad, arbol.cantidad, round(arbol.tot, 4), arbol.nivel,
         arbol.camino, arbol.grupo, arbol.parametro, arbol.por_parametro, arbol.redondear_arriba, arbol.merma, arbol.notas, arbol.orden
  from arbol join articulos a on a.id = arbol.hijo_id
  order by arbol.camino
$$;

-- Serie histórica para la gráfica de costo / precio real / precio a utilidad constante.
-- "Constante" = costo de ese momento × factor de la política de HOY.
create or replace function public.serie_costeo(p_articulo uuid)
returns table (en timestamptz, costo numeric, precio_real numeric, precio_constante numeric, reconstruido boolean)
language sql stable security invoker as $$
  with hoy as (
    select case when cc.costo_total > 0 then precio_sin_redondeo(cc.costo_total, politica_de(a.id), c.margen, a.medida_especial) / cc.costo_total end f
    from articulos a join costos_calculados cc on cc.articulo_id = a.id left join costos_articulo c on c.articulo_id = a.id
    where a.id = p_articulo
  )
  select h.en, round(h.costo_total, 2), h.precio_lista, round(h.costo_total * hoy.f, 2), h.reconstruido
  from historial_costeo h, hoy where h.articulo_id = p_articulo order by h.en
$$;

-- Simulador del panel de márgenes: "si la utilidad de esta política fuera X,
-- ¿cuánto cambian los precios?" Sin guardar nada.
create or replace function public.simular_politica(p_politica int, p_utilidad numeric)
returns table (articulo_id uuid, clave text, nombre text, costo numeric, precio_actual numeric, precio_simulado numeric)
language sql stable security invoker as $$
  select a.id, a.clave, a.nombre, round(cc.costo_total, 2), pl.precio,
    redondear_precio(
      (cc.costo_total * (1 + coalesce((select sum((e->>'pct')::numeric) from jsonb_array_elements(pp.recargos_costo) e), 0))
        + case when a.medida_especial then cc.costo_total * pp.pct_medida_especial else 0 end)
      / (1 - case when pp.compensar_isr then p_utilidad / (1 - (select valor::text::numeric from configuracion where clave = 'isr_compensacion'))
                  else p_utilidad end
           - coalesce((select sum((e->>'pct')::numeric) from jsonb_array_elements(pp.recargos_precio) e), 0)),
      pp.redondeo)
  from articulos a join costos_calculados cc on cc.articulo_id = a.id
  join politicas_precio pp on pp.id = p_politica
  left join precios_lista pl on pl.articulo_id = a.id
  left join costos_articulo c on c.articulo_id = a.id
  where politica_de(a.id) = p_politica and c.margen is null and c.precio_fijo is null and cc.costo_total > 0 and a.activo
$$;

-- Catálogo con costo para quien puede verlo (la RLS de costos_calculados decide).
create or replace view public.v_catalogo with (security_invoker = true) as
select a.*, c.nombre as categoria, pv.nombre as proveedor, pl.precio, pl.calculado_en as precio_calculado_en,
  cc.costo_total, cc.costo_material, cc.costo_mano_obra, cc.horas, cc.sin_costo, cc.costo_mas_viejo,
  ca.costo as costo_capturado, ca.moneda as moneda_costo, ca.actualizado_en as costo_actualizado_en,
  (select sum(e.cantidad) from public.existencias e join public.almacenes al on al.id = e.almacen_id
   where e.articulo_id = a.id and al.disponible_para_planta) as existencia,
  (select count(*) from public.bom_lineas b where b.padre_id = a.id) as lineas_bom,
  (select count(*) from public.bom_lineas b where b.hijo_id = a.id) as usado_en
from public.articulos a
left join public.categorias c on c.id = a.categoria_id
left join public.proveedores pv on pv.id = a.proveedor_id
left join public.precios_lista pl on pl.articulo_id = a.id
left join public.costos_calculados cc on cc.articulo_id = a.id
left join public.costos_articulo ca on ca.articulo_id = a.id;

-- Actualización rápida de costos (pantalla "Actualizar precios" de compras): una
-- sola llamada por lote para que el recálculo corra una vez.
create or replace function public.actualizar_costos(p_cambios jsonb) returns int
language plpgsql security invoker as $$
declare v_n int;
begin
  if not puede('costos', 2) then raise exception 'Sin permiso para actualizar costos' using errcode = '42501'; end if;
  insert into costos_articulo (articulo_id, costo, moneda, proveedor_id, actualizado_en, actualizado_por)
  select (x->>'articulo_id')::uuid, (x->>'costo')::numeric, coalesce(x->>'moneda', 'MXN')::moneda,
         nullif(x->>'proveedor_id', '')::uuid, current_date, auth.uid()
  from jsonb_array_elements(p_cambios) x
  on conflict (articulo_id) do update set costo = excluded.costo, moneda = excluded.moneda,
    proveedor_id = coalesce(excluded.proveedor_id, costos_articulo.proveedor_id), actualizado_en = current_date,
    actualizado_por = auth.uid();
  get diagnostics v_n = row_count;
  return v_n;
end $$;

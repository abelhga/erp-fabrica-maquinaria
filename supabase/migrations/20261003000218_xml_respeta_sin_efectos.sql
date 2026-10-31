-- =============================================================================
-- El XML no saca de «fuera» lo que la hoja puso fuera a propósito.
--
-- En 215, la categoría de la clave del SAT pisaba siempre la del proveedor. Con los 7,749 XML
-- cargados, 4.9 millones de 2024 a 2026 de proveedores que la hoja tenía en «Sin efectos» (o en
-- otra categoría que no es gasto: activos, retiros) pasaron a contar como aceros, pintura o
-- publicidad. La factura dice qué se facturó, pero la hoja ya sabía que esas compras no van a la
-- utilidad (ANALISIS las excluía desde 2022). Así que el XML solo afina el «qué» cuando la
-- categoría del proveedor sí es gasto; si es «fuera», se queda la del proveedor.
--
-- El XML guarda su categoría igual (la pantalla de Facturas anteriores la sigue enseñando): lo
-- que cambia es solo qué cuenta en Resultados.
-- =============================================================================

create or replace function public.compras_hoja(p_desde date, p_hasta date)
returns table (fecha date, categoria text, importe numeric)
language sql stable security definer set search_path = public as $$
  with iva as (select coalesce((select (valor #>> '{}')::numeric from configuracion where clave = 'iva'), 0.16) t),
  h as (
    select h.fecha, h.proveedor_llave, h.proveedor_id, h.monto, h.factura,
      (select x.categoria from cfdi_historico x where x.hoja_compra_id = h.id and x.categoria_origen = 'clave_sat') cat_xml
    from historial_compras_hoja h
    where h.tipo = 'Compra' and h.fecha between p_desde and p_hasta
    union all
    select h.fecha, h.proveedor_llave, null, h.monto, h.factura,
      (select x.categoria from cfdi_historico x where x.hoja_compra_2018_id = h.id and x.categoria_origen = 'clave_sat')
    from historial_compras_2018_2021 h
    where h.fecha between p_desde and p_hasta
  ),
  c as (
    select h.*, coalesce(k.categoria, nullif(trim(pr.categoria), '')) cat_prov
    from h
    left join compras_hoja_categoria k on k.proveedor_llave = h.proveedor_llave
    left join proveedores pr on pr.id = h.proveedor_id
  )
  select c.fecha,
    case when c.cat_xml is not null
              and coalesce((select cc.tipo from compras_categorias cc where cc.categoria = lower(trim(c.cat_prov))), '') <> 'fuera'
         then c.cat_xml
         else coalesce(c.cat_prov, 'Sin categoría') end,
    case when lower(trim(coalesce(c.factura, ''))) not in ('', '-', 's/f', 'sf', 'n/a') then c.monto / (1 + iva.t) else c.monto end
  from c cross join iva
$$;

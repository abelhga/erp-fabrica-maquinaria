-- =============================================================================
-- El historial de almacén se puede buscar por el proveedor.
--
-- Por qué: administración busca las entradas por el nombre del proveedor («Delvia») y no
-- aparecían, porque la referencia de una entrada de compra solo decía «OC OC-26-4443». Ahora dice
-- «OC OC-26-4443 · Delvia Ortega Trujillo», y el buscador de la tabla lo encuentra. Es la misma
-- vista de 229; solo cambia el texto de la referencia.
-- =============================================================================

create or replace view public.v_movimientos with (security_invoker = true) as
SELECT m.id,
    m.en,
    m.tipo,
    m.articulo_id,
    a.clave,
    a.nombre,
    a.unidad,
    m.almacen_id,
    al.nombre AS almacen,
    m.cantidad,
    cm.costo_unitario,
    m.motivo,
    m.fuera_de_lista,
    m.usuario_id,
    u.nombre AS usuario,
    m.orden_compra_id,
    oc.folio AS oc_folio,
    m.orden_produccion_id,
    op.folio AS op_folio,
    m.pedido_id,
    pe.folio AS pedido_folio,
    m.ajuste_id,
    aj.folio AS ajuste_folio,
    m.traspaso_id,
    t.almacen AS traspaso_almacen,
    COALESCE('OC '::text || oc.folio || COALESCE(' · '::text || oc.proveedor, ''::text), op.folio || COALESCE(' · '::text || pe.folio, ''::text), pe.folio, aj.folio,
        CASE m.tipo
            WHEN 'traspaso_salida'::tipo_movimiento THEN 'a '::text || t.almacen
            WHEN 'traspaso_entrada'::tipo_movimiento THEN 'de '::text || t.almacen
            ELSE NULL::text
        END) AS referencia,
    m.recibio,
    m.deshace_id,
    ( SELECT d.id FROM movimientos_inventario d WHERE d.deshace_id = m.id) AS deshecho_por
   FROM movimientos_inventario m
     JOIN articulos a ON a.id = m.articulo_id
     JOIN almacenes al ON al.id = m.almacen_id
     LEFT JOIN perfiles u ON u.id = m.usuario_id
     LEFT JOIN v_ordenes_compra oc ON oc.id = m.orden_compra_id
     LEFT JOIN ordenes_produccion op ON op.id = m.orden_produccion_id
     LEFT JOIN pedidos_basicos() pe ON pe.id = m.pedido_id
     LEFT JOIN costos_movimientos() cm ON cm.movimiento_id = m.id
     LEFT JOIN ajustes_inventario aj ON aj.id = m.ajuste_id
     LEFT JOIN LATERAL ( SELECT al2.nombre AS almacen
           FROM movimientos_inventario m2
             JOIN almacenes al2 ON al2.id = m2.almacen_id
          WHERE m.traspaso_id IS NOT NULL AND m2.traspaso_id = m.traspaso_id AND m2.id <> m.id
         LIMIT 1) t ON true;


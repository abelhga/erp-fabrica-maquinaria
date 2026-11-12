-- =============================================================================
-- Ajustes: la tarjeta avisa antes de aprobar que el artículo ya se volvió a contar.
--
-- Por qué: Abel quiso aprobar AJU-2026-00190 (2 motorreductores que no aparecieron en el conteo del
-- 10 nov). Noemí los volvió a contar el 12 nov, encontró los 2 y lo explicó. La base no dejó aprobar
-- (bien: el reconteo ya dejó el sistema en lo que hay, y aprobar los habría bajado a 0), pero la
-- pantalla ofrecía «Aprobar» y solo al dar clic salía el error.
--
-- Qué cambia: v_ajustes trae «recontado» (cuándo, en qué conteo y cuánto se contó) cuando el artículo
-- se volvió a contar en ese almacén después de pedir el ajuste: la misma condición con la que
-- resolver_ajuste lo rechaza. La pantalla lo dice y solo ofrece rechazar.
-- =============================================================================

create or replace view public.v_ajustes with (security_invoker = true) as
 SELECT aj.id, aj.folio, aj.articulo_id, a.clave, a.nombre, a.unidad, aj.almacen_id, al.nombre AS almacen,
    aj.cantidad_sistema, aj.cantidad_fisica, aj.diferencia, aj.motivo, aj.conteo_id, co.nombre AS conteo,
    aj.estado, aj.solicitado_por, sp.nombre AS solicitado_por_nombre, aj.solicitado_en, aj.resuelto_por,
    rp.nombre AS resuelto_por_nombre, aj.resuelto_en, aj.comentario, e.cantidad AS existencia_actual,
    CASE WHEN aj.estado = 'aprobado'::text THEN COALESCE(ap.cantidad, 0::numeric) ELSE NULL::numeric END AS aplicado,
    CASE WHEN (SELECT puede('costos'::text, 1)) THEN
      CASE aj.estado WHEN 'aprobado'::text THEN round(COALESCE(va.valor, 0::numeric), 2)
        ELSE round(aj.diferencia * ca.costo * tc(ca.moneda), 2) END
    ELSE NULL::numeric END AS valor_diferencia,
    CASE WHEN aj.estado = 'pendiente' THEN ajuste_requiere_explicacion(aj.id) ELSE false END AS requiere_explicacion,
    COALESCE(n.notas, '[]'::jsonb) AS notas,
    rc.recontado
   FROM ajustes_inventario aj
     JOIN articulos a ON a.id = aj.articulo_id
     JOIN almacenes al ON al.id = aj.almacen_id
     LEFT JOIN conteos co ON co.id = aj.conteo_id
     LEFT JOIN perfiles sp ON sp.id = aj.solicitado_por
     LEFT JOIN perfiles rp ON rp.id = aj.resuelto_por
     LEFT JOIN existencias e ON e.articulo_id = aj.articulo_id AND e.almacen_id = aj.almacen_id
     LEFT JOIN costos_articulo ca ON ca.articulo_id = aj.articulo_id
     LEFT JOIN LATERAL (SELECT sum(m.cantidad) AS cantidad FROM movimientos_inventario m WHERE m.ajuste_id = aj.id) ap ON true
     LEFT JOIN valor_ajustes() va(ajuste_id, valor) ON va.ajuste_id = aj.id
     LEFT JOIN LATERAL (SELECT jsonb_agg(jsonb_build_object('tipo', x.tipo, 'texto', x.texto, 'en', x.en,
                 'por', (SELECT nombre FROM perfiles WHERE id = x.por), 'para', (SELECT nombre FROM perfiles WHERE id = x.para))
                 ORDER BY x.en) AS notas
               FROM ajuste_notas x WHERE x.ajuste_id = aj.id) n ON true
     -- El último conteo del artículo en ese almacén después de pedir el ajuste (el mismo cerrojo que
     -- resolver_ajuste): con él, el ajuste ya no se aprueba, solo se rechaza.
     LEFT JOIN LATERAL (SELECT jsonb_build_object('en', l.en, 'conteo', c.nombre, 'contado', l.cantidad_contada,
                 'sistema', l.sistema_al_contar) AS recontado
               FROM conteo_lineas l JOIN conteos c ON c.id = l.conteo_id
               WHERE aj.estado = 'pendiente' AND l.articulo_id = aj.articulo_id AND c.almacen_id = aj.almacen_id
                 AND l.en > aj.solicitado_en AND c.id IS DISTINCT FROM aj.conteo_id
               ORDER BY l.en DESC LIMIT 1) rc ON true;

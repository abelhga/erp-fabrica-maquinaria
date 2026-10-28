-- =============================================================================
-- La TV dice «trabajando» solo cuando alguien tiene su tiempo corriendo.
--
-- La cuadrilla de una etapa (cuadrilla_de) es quien tiene su tiempo abierto o, si nadie, la
-- planeada. La TV pintaba las dos igual («● Genaro, Juan Pablo» en azul), mientras el tablero de
-- cuadrillas pinta de verde solo a quien tiene su tiempo corriendo. El 28 oct dirección preguntó
-- por qué Genaro y Juan Pablo no salían en verde en el tablero: Pailería de OP-2026-00023 estaba
-- en proceso (así venía de la hoja de Luis) pero nadie les había arrancado el tiempo, y la TV lo
-- presumía como trabajo. con_tiempo le dice a la TV cuál de los dos casos es.
-- =============================================================================

-- Mismo cuerpo que en 181, con con_tiempo al final.
create or replace view public.v_piso_operaciones with (security_invoker = true) as
SELECT x.id,
    x.orden_id,
    x.etapa_id,
    e.nombre AS etapa,
    e.color,
    e.orden AS etapa_orden,
    x.estado,
    x.horas_estimadas,
    x.inicio,
    x.fin,
    x.responsable,
    t.folio,
    t.numero_serie,
    t.clave,
    t.equipo,
    t.cliente,
    t.pedido_folio,
    t.prioridad,
    t.fecha_compromiso,
    t.dias_restantes,
    t.atrasada,
    t.avance,
    t.materiales_faltantes,
    t.estado AS orden_estado,
    ant.pendientes IS NULL AS lista,
    ant.pendientes AS espera_a,
    pr.nota AS ultimo_problema,
    pr.en AS ultimo_problema_en,
    x.turno,
    COALESCE(hh.horas, 0::numeric)::numeric(10,2) AS horas_reales,
        CASE
            WHEN x.estado = ANY (ARRAY['en_proceso'::estado_operacion, 'pausada'::estado_operacion]) THEN cuadrilla_de(x.id)
            ELSE NULL::text
        END AS cuadrilla,
    x.avance AS avance_etapa,
    x.estado = 'en_proceso'::estado_operacion AND (EXISTS ( SELECT 1 FROM op_tiempos ta WHERE ta.operacion_id = x.id AND ta.fin IS NULL)) AS con_tiempo
   FROM op_operaciones x
     JOIN etapas e ON e.id = x.etapa_id
     JOIN v_tablero_produccion t ON t.id = x.orden_id
     LEFT JOIN LATERAL ( SELECT string_agg(ey.nombre, ', '::text ORDER BY ey.orden) AS pendientes
           FROM op_operaciones y
             JOIN etapas ey ON ey.id = y.etapa_id
          WHERE y.orden_id = x.orden_id AND ey.orden < e.orden AND NOT e.en_paralelo AND y.estado <> 'terminada'::estado_operacion) ant ON true
     LEFT JOIN LATERAL ( SELECT ev.nota,
            ev.en
           FROM op_eventos ev
          WHERE ev.operacion_id = x.id AND ev.tipo = 'problema'::text
          ORDER BY ev.en DESC, ev.id DESC
         LIMIT 1) pr ON true
     LEFT JOIN LATERAL ( SELECT sum(horas_trabajadas(ti.inicio, COALESCE(ti.fin, now())) * ti.personas::numeric) AS horas
           FROM op_tiempos ti
          WHERE ti.operacion_id = x.id) hh ON true
  WHERE (t.estado = ANY (ARRAY['liberada'::estado_op, 'en_proceso'::estado_op])) AND x.estado <> 'terminada'::estado_operacion AND NOT (EXISTS ( SELECT 1
           FROM ordenes_produccion oe
          WHERE oe.id = x.orden_id AND oe.en_espera_motivo IS NOT NULL));

-- =============================================================================
-- Ventas ve cómo van sus equipos, no cómo se fabrican; a cambio, sus fichas técnicas.
--
-- Los vendedores tienen "producción: ver" para seguir el avance de sus equipos, y con eso
-- (y con "inventario: ver") leían la lista de materiales de cada equipo, las horas por
-- etapa del costeo, los parámetros, los planos vigentes y el material congelado de cada
-- orden. Nada de eso les sirve para vender, y es cómo fabrica la empresa. Ahora lo ve
-- quien trabaja con ello: ingeniería (costeo), el personal de planta (producción 2) y
-- almacén (inventario 2); compras sigue viendo el material de las órdenes (lo compra).
-- Mantenimiento, la TV del taller, finanzas e importaciones tampoco lo necesitaban.
--
-- El avance no se pierde: el tablero sigue diciendo cuántas partidas faltan de cada
-- orden, por faltantes_de_ordenes() (solo el conteo, no la lista).
--
-- Lo que ventas sí necesita para el cliente son las fichas técnicas y las fotos
-- vigentes: esas siguen abiertas a ventas y al catálogo (recepción), ya no los planos.
--
-- La gerencia de ventas deja "Ingeniería" (costeo 1), como ya estaba ventas en la nube:
-- con el catálogo tiene precio, foto, descripción, existencia y ficha técnica.
-- =============================================================================

delete from public.permisos_rol where rol in ('ventas', 'gerente_ventas') and modulo = 'costeo';

alter policy ver on public.bom_lineas using (
  (select puede('costeo', 1)) or (select puede('produccion', 2)) or (select puede('inventario', 2)));
alter policy ver on public.bom_operaciones using ((select puede('costeo', 1)) or (select puede('produccion', 2)));
alter policy ver on public.articulo_parametros using ((select puede('costeo', 1)) or (select puede('produccion', 2)));
alter policy ver on public.solicitudes_cambio_bom using ((select puede('produccion', 2)) or (select puede('costeo', 1)));
alter policy ver on public.op_planos using ((select puede('produccion', 2)) or (select puede('costeo', 1)));
alter policy ver on public.op_materiales using (
  (select puede('produccion', 2)) or (select puede('inventario', 2)) or (select puede('costeo', 1)) or (select puede('compras', 1)));
alter policy ver on public.documentos_tecnicos using (
  (select puede('costeo', 2))
  or (estado = 'vigente' and ((select puede('costeo', 1)) or (select puede('produccion', 2))
      or (tipo in ('ficha', 'foto') and ((select puede('ventas', 1)) or (select puede('catalogo', 1)))))));

-- Cuántas partidas le faltan a cada orden abierta: el tablero lo muestra a quien ve el
-- avance (vendedores, la TV) sin darles la lista de materiales.
create or replace function public.faltantes_de_ordenes()
returns table (orden_id uuid, faltantes bigint, sin_pedir bigint)
language sql stable security definer set search_path = public as $$
  select m.orden_id, count(*) filter (where m.faltante > 0), count(*) filter (where m.faltante - m.pedido_a_compras > 0)
  from v_op_material m join ordenes_produccion o on o.id = m.orden_id
  where o.estado not in ('terminada', 'entregada', 'cancelada')
    and ((select puede('produccion', 1)) or (select puede('inventario', 1)))
  group by m.orden_id
$$;
revoke execute on function public.faltantes_de_ordenes() from public, anon;
grant execute on function public.faltantes_de_ordenes() to authenticated;

create or replace view public.v_tablero_produccion with (security_invoker = true) as
SELECT o.id,
    o.folio,
    o.numero_serie,
    o.estado,
    o.prioridad,
    o.fecha_compromiso,
    o.inicio_plan,
    o.cantidad,
    a.clave,
    a.nombre AS equipo,
    a.imagen_url,
    pb.folio AS pedido_folio,
    pb.cliente,
    h.horas_totales,
    h.horas_terminadas,
        CASE
            WHEN h.horas_totales = 0::numeric THEN 0::numeric
            ELSE round(100::numeric * h.horas_terminadas / h.horas_totales)
        END AS avance,
    ( SELECT e.nombre
           FROM op_operaciones x
             JOIN etapas e ON e.id = x.etapa_id
          WHERE x.orden_id = o.id AND (x.estado = ANY (ARRAY['en_proceso'::estado_operacion, 'pausada'::estado_operacion]))
          ORDER BY e.orden
         LIMIT 1) AS etapa_actual,
    sig.nombre AS siguiente_etapa,
    h.pausada,
        CASE
            WHEN o.estado = ANY (ARRAY['terminada'::estado_op, 'entregada'::estado_op]) THEN 0::bigint
            ELSE COALESCE(fo.faltantes, 0::bigint)
        END AS materiales_faltantes,
    o.fecha_compromiso - hoy_planta() AS dias_restantes,
    o.fecha_compromiso < hoy_planta() AND (o.estado <> ALL (ARRAY['terminada'::estado_op, 'entregada'::estado_op])) AND o.en_espera_motivo IS NULL AS atrasada,
    o.revisado_ingenieria_en IS NOT NULL AS revisada_ingenieria,
    o.revisado_almacen_en IS NOT NULL AS revisada_almacen,
    ( SELECT max(ev.en) AS max
           FROM op_eventos ev
          WHERE ev.orden_id = o.id) AS ultimo_movimiento,
    o.pedido_id,
    o.pedido_id IS NULL AS para_stock,
    COALESCE(( SELECT jsonb_agg(jsonb_build_object('id', e.id, 'nombre', e.nombre, 'color', e.color, 'estado', x.estado, 'responsable', x.responsable, 'inicio', x.inicio) ORDER BY e.orden) AS jsonb_agg
           FROM op_operaciones x
             JOIN etapas e ON e.id = x.etapa_id
          WHERE x.orden_id = o.id AND (x.estado = ANY (ARRAY['en_proceso'::estado_operacion, 'pausada'::estado_operacion]))), '[]'::jsonb) AS etapas_activas,
    sig.id AS siguiente_etapa_id,
    sig.color AS siguiente_etapa_color,
    h.horas_totales - h.horas_terminadas AS horas_pendientes,
    o.material_apartado_en IS NOT NULL AS material_apartado,
        CASE
            WHEN o.estado = ANY (ARRAY['terminada'::estado_op, 'entregada'::estado_op]) THEN 0::bigint
            ELSE COALESCE(fo.sin_pedir, 0::bigint)
        END AS faltantes_sin_pedir,
    o.terminada_en,
    o.creado_en,
    o.notas,
    o.en_espera_motivo,
    o.en_espera_desde
   FROM ordenes_produccion o
     JOIN articulos a ON a.id = o.articulo_id
     LEFT JOIN LATERAL pedido_de_orden(o.pedido_id) pb(folio, cliente) ON true
     LEFT JOIN faltantes_de_ordenes() fo ON fo.orden_id = o.id
     LEFT JOIN LATERAL ( SELECT COALESCE(sum(x.horas_estimadas), 0::numeric) AS horas_totales,
            COALESCE(sum(x.horas_estimadas) FILTER (WHERE x.estado = 'terminada'::estado_operacion), 0::numeric) AS horas_terminadas,
            COALESCE(bool_or(x.estado = 'pausada'::estado_operacion), false) AS pausada
           FROM op_operaciones x
          WHERE x.orden_id = o.id) h ON true
     LEFT JOIN LATERAL ( SELECT e.id,
            e.nombre,
            e.color
           FROM op_operaciones x
             JOIN etapas e ON e.id = x.etapa_id
          WHERE x.orden_id = o.id AND x.estado = 'pendiente'::estado_operacion
          ORDER BY e.orden
         LIMIT 1) sig ON true
  WHERE o.estado <> ALL (ARRAY['entregada'::estado_op, 'cancelada'::estado_op]);

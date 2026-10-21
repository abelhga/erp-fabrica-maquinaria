-- =============================================================================
-- Cada área ve lo que necesita para su trabajo, y el dinero se queda en ventas y finanzas.
--
-- 1. Producción y almacén veían todos los pedidos completos: producción 2 e inventario 2
--    entraban en ve_todos_los_pedidos() y con eso leían total, cobros, saldos, precios
--    de cada partida y facturas de todos los clientes. Para su trabajo les basta saber
--    qué pedido es, de qué cliente, qué equipos lleva y para cuándo. Ahora el pedido
--    completo (con montos) es de ventas 3 y finanzas; el resto lee pedidos_basicos(),
--    pedido_lineas_basicas() y facturas_basicas(), que traen lo mismo sin un solo monto.
--    Las vistas de planta (envíos, devoluciones, planos, movimientos, seriales, reservas,
--    pedidos por producir) se arman con esas funciones y siguen diciendo folio y cliente.
--    De paso producción 2 ya no puede editar pedidos directo: lo que la planta le cambia
--    a un pedido (listo, entregado) lo hacen las funciones de la terminal y de entrega.
-- 2. La gerencia de producción tenía ventas 1, que le abría Mercado Libre, planes de
--    comisión y las ventas de su indicador de Inicio. Sin ventas sigue viendo, en cada
--    orden, su pedido y su cliente (por producción).
-- 3. El costo de cada movimiento de inventario lo leía directo de la tabla quien tuviera
--    inventario 2 (almacén). La vista ya lo escondía; la tabla no. Ahora la columna no se
--    le da a nadie y el costo sale de costos_movimientos(), solo con "costos".
-- 4. Recepción tenía costeo 1 para ver precios, y con eso veía listas de materiales,
--    horas, planos y proveedores. Ahora tiene su propio módulo "catalogo": equipos y
--    componentes con descripción, foto, precio de lista y existencia, nada más.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Pedidos sin montos
-- -----------------------------------------------------------------------------
create or replace function public.ve_todos_los_pedidos() returns boolean
language sql stable security definer set search_path = public as $$
  select puede('ventas', 3) or puede('finanzas', 1)
$$;

-- Quién ve todos los pedidos aunque sea sin montos: lo de antes más la planta.
create or replace function public.ve_pedidos_sin_montos() returns boolean
language sql stable security definer set search_path = public as $$
  select puede('ventas', 3) or puede('finanzas', 1) or puede('produccion', 2) or puede('inventario', 2)
$$;

-- Lo que la planta necesita de un pedido. El vendedor sigue viendo solo los suyos.
create or replace function public.pedidos_basicos()
returns table (id uuid, folio text, cliente_id uuid, vendedor_id uuid, canal public.canal_venta, id_externo text,
               estado public.estado_pedido, fecha date, fecha_compromiso date, entregado_en timestamptz, historico boolean)
language sql stable security definer set search_path = public as $$
  select p.id, p.folio, p.cliente_id, p.vendedor_id, p.canal, p.id_externo, p.estado, p.fecha, p.fecha_compromiso,
         p.entregado_en, p.historico
  from pedidos p
  where (select ve_pedidos_sin_montos()) or p.vendedor_id = (select auth.uid()) or p.id in (select mis_pedidos_visibles())
$$;

create or replace function public.pedido_lineas_basicas()
returns table (id uuid, pedido_id uuid, orden int, articulo_id uuid, titulo text, unidad text, cantidad numeric, cantidad_entregada numeric)
language sql stable security definer set search_path = public as $$
  select pl.id, pl.pedido_id, pl.orden, pl.articulo_id, pl.titulo, pl.unidad, pl.cantidad, pl.cantidad_entregada
  from pedido_lineas pl
  where pl.pedido_id in (select b.id from pedidos_basicos() b)
$$;

-- El folio de la factura sirve para la garantía de un equipo; el importe no.
create or replace function public.facturas_basicas()
returns table (id uuid, pedido_id uuid, folio text, fecha date)
language sql stable security definer set search_path = public as $$
  select f.id, f.pedido_id, f.folio, f.fecha from facturas f
  where f.pedido_id in (select b.id from pedidos_basicos() b)
$$;

revoke execute on function public.ve_pedidos_sin_montos() from public, anon;
revoke execute on function public.pedidos_basicos() from public, anon;
revoke execute on function public.pedido_lineas_basicas() from public, anon;
revoke execute on function public.facturas_basicas() from public, anon;
grant execute on function public.ve_pedidos_sin_montos() to authenticated;
grant execute on function public.pedidos_basicos() to authenticated;
grant execute on function public.pedido_lineas_basicas() to authenticated;
grant execute on function public.facturas_basicas() to authenticated;

-- Producción 2 podía hacer un update a pedidos sin filtro (sin where no aplica la
-- política de lectura) y cambiarle el total a todos. Ningún update de la planta va directo.
alter policy cambio on public.pedidos using (
  (vendedor_id = (select auth.uid()) and (select puede('ventas', 2))) or (select puede('ventas', 3)) or (select puede('finanzas', 2)));

-- Almacén arma el envío con las partidas del pedido (cantidades, no precios).
create or replace function public.partidas_por_enviar(p_pedido uuid)
returns table(pedido_linea_id uuid, orden integer, articulo_id uuid, clave text, titulo text, articulo_tipo tipo_articulo, unidad text,
              cantidad numeric, en_envios numeric, pendiente numeric, paquete_kg numeric, paquete_largo_cm numeric,
              paquete_ancho_cm numeric, paquete_alto_cm numeric, paquete_piezas numeric)
language sql stable set search_path = public as $$
  select pl.id, pl.orden, pl.articulo_id, a.clave, pl.titulo, a.tipo, pl.unidad, pl.cantidad,
    coalesce(x.cant, 0), greatest(pl.cantidad - coalesce(x.cant, 0), 0),
    a.paquete_kg, a.paquete_largo_cm, a.paquete_ancho_cm, a.paquete_alto_cm, a.paquete_piezas
  from pedido_lineas_basicas() pl
  join articulos a on a.id = pl.articulo_id
  left join lateral (select sum(el.cantidad) cant from envio_lineas el join envios e on e.id = el.envio_id
                     where el.pedido_linea_id = pl.id and e.estado <> 'cancelado') x on true
  where pl.pedido_id = p_pedido and a.tipo <> 'servicio'
  order by pl.orden, pl.id
$$;

-- Antes de inhabilitar un artículo: en cuántos pedidos abiertos va (sin montos).
create or replace function public.articulo_uso_abierto(p_articulo uuid) returns jsonb
language sql stable set search_path = public as $$
  select jsonb_build_object(
    'equipos_activos', (select count(distinct b.padre_id) from bom_lineas b join articulos p on p.id = b.padre_id
                        where b.hijo_id = p_articulo and p.activo),
    'pedidos_abiertos', (select count(distinct l.pedido_id) from pedido_lineas_basicas() l join pedidos_basicos() p on p.id = l.pedido_id
                         where l.articulo_id = p_articulo and p.estado in ('confirmado', 'en_produccion', 'listo')),
    'cotizaciones_abiertas', (select count(distinct l.cotizacion_id) from cotizacion_lineas l join cotizaciones c on c.id = l.cotizacion_id
                              where l.articulo_id = p_articulo and c.estado in ('borrador', 'por_autorizar', 'autorizada', 'enviada')));
$$;

-- El costo de los movimientos (punto 3) se define aquí porque v_movimientos ya lo usa.
-- Una vista con security_invoker no puede ni nombrar una columna que no se le da a quien
-- consulta (aunque sea dentro de un CASE), así que el costo llega por estas funciones,
-- que no regresan nada sin "costos". Las funciones que registran movimientos (security
-- definer) siguen escribiéndolo igual.
create or replace function public.costos_movimientos() returns table (movimiento_id bigint, costo_unitario numeric)
language sql stable security definer set search_path = public as $$
  select m.id, m.costo_unitario from movimientos_inventario m where (select puede('costos', 1))
$$;

create or replace function public.valor_ajustes() returns table (ajuste_id uuid, valor numeric)
language sql stable security definer set search_path = public as $$
  select m.ajuste_id, sum(m.cantidad * m.costo_unitario) from movimientos_inventario m
  where m.ajuste_id is not null and (select puede('costos', 1))
  group by m.ajuste_id
$$;

revoke execute on function public.costos_movimientos() from public, anon;
revoke execute on function public.valor_ajustes() from public, anon;
grant execute on function public.costos_movimientos() to authenticated;
grant execute on function public.valor_ajustes() to authenticated;

-- Vistas de planta: el mismo folio y cliente, de las funciones sin montos.
create or replace view public.v_envios with (security_invoker = true) as
SELECT e.id,
    e.folio,
    e.pedido_id,
    p.folio AS pedido_folio,
    p.canal,
    p.id_externo,
    p.cliente_id,
    c.nombre AS cliente,
    p.vendedor_id,
    pv.nombre AS vendedor,
    e.tipo,
    nombre_tipo_envio(e.tipo) AS tipo_nombre,
    e.estado,
    e.paqueteria_id,
    q.nombre AS paqueteria,
    q.usa_saldo,
    e.servicio,
    e.contacto_id,
    e.destinatario,
    e.telefono,
    e.destino,
    e.fecha_recoleccion,
    e.notas,
    e.costo_cotizado,
    e.costo_real,
    e.numero_guia,
    e.solicitado_por,
    sp.nombre AS solicitado_por_nombre,
    e.solicitado_en,
    e.cotizado_por,
    cp.nombre AS cotizado_por_nombre,
    e.cotizado_en,
    e.guia_por,
    gp.nombre AS guia_por_nombre,
    e.guia_en,
    e.empacado_por,
    ep.nombre AS empacado_por_nombre,
    e.empacado_en,
    e.checklist,
    e.enviado_por,
    np.nombre AS enviado_por_nombre,
    e.enviado_en,
    e.entregado_por,
    dp.nombre AS entregado_por_nombre,
    e.entregado_en,
    e.recibio,
    e.cancelado_por,
    xp.nombre AS cancelado_por_nombre,
    e.cancelado_en,
    e.motivo_cancelacion,
    e.guia_reembolsada,
    e.inventario_descontado_en,
    b.bultos,
    b.peso_total,
    b.peso_volumetrico,
    b.sin_medidas,
    l.partidas,
    l.piezas,
    l.resumen,
    l.lleva_equipo,
    (( SELECT count(*) AS count
           FROM evidencias_envio v
          WHERE v.envio_id = e.id AND v.tipo = 'empaque'::text))::integer AS fotos,
    ( SELECT v.ruta
           FROM evidencias_envio v
          WHERE v.envio_id = e.id AND v.tipo = 'guia'::text
          ORDER BY v.en DESC
         LIMIT 1) AS guia_ruta,
    e.estado <> ALL (ARRAY['enviado'::text, 'entregado'::text, 'cancelado'::text]) AS abierto,
    e.tipo = ANY (ARRAY['paqueteria'::text, 'flete'::text, 'recoge'::text, 'a_full'::text]) AS lleva_empaque,
    (e.estado <> ALL (ARRAY['enviado'::text, 'entregado'::text, 'cancelado'::text])) AND (e.tipo = ANY (ARRAY['paqueteria'::text, 'flete'::text])) AND e.guia_en IS NULL AS falta_guia,
    (e.estado <> ALL (ARRAY['enviado'::text, 'entregado'::text, 'cancelado'::text])) AND (e.tipo = ANY (ARRAY['paqueteria'::text, 'flete'::text, 'recoge'::text, 'a_full'::text])) AND e.empacado_en IS NULL AS falta_empaque,
    (e.estado <> ALL (ARRAY['enviado'::text, 'entregado'::text, 'cancelado'::text])) AND (e.empacado_en IS NOT NULL OR (e.tipo = ANY (ARRAY['full'::text, 'proveedor'::text]))) AND NOT (e.tipo = 'paqueteria'::text AND e.numero_guia IS NULL) AS listo_para_salir,
    hoy_planta() - (e.solicitado_en AT TIME ZONE 'America/Mexico_City'::text)::date AS dias_desde_solicitud,
        CASE
            WHEN e.estado = 'enviado'::text THEN hoy_planta() - (e.enviado_en AT TIME ZONE 'America/Mexico_City'::text)::date
            ELSE NULL::integer
        END AS dias_en_camino,
    e.actualizado_en,
    e.dest_cp,
    e.dest_estado,
    e.dest_municipio,
    e.dest_colonia,
    e.dest_calle,
    e.dest_referencia,
    e.dest_empresa,
    e.dest_correo,
    e.skydropx_cotizacion_id,
    e.skydropx_envio_id,
    e.rastreo_url
   FROM envios e
     LEFT JOIN pedidos_basicos() p ON p.id = e.pedido_id
     LEFT JOIN clientes c ON c.id = p.cliente_id
     LEFT JOIN perfiles pv ON pv.id = p.vendedor_id
     LEFT JOIN paqueterias q ON q.id = e.paqueteria_id
     LEFT JOIN perfiles sp ON sp.id = e.solicitado_por
     LEFT JOIN perfiles cp ON cp.id = e.cotizado_por
     LEFT JOIN perfiles gp ON gp.id = e.guia_por
     LEFT JOIN perfiles ep ON ep.id = e.empacado_por
     LEFT JOIN perfiles np ON np.id = e.enviado_por
     LEFT JOIN perfiles dp ON dp.id = e.entregado_por
     LEFT JOIN perfiles xp ON xp.id = e.cancelado_por
     LEFT JOIN LATERAL ( SELECT count(*)::integer AS bultos,
            sum(x.peso_kg) AS peso_total,
            round(sum(x.largo_cm * x.ancho_cm * x.alto_cm / 5000.0), 2) AS peso_volumetrico,
            count(*) FILTER (WHERE x.peso_kg IS NULL OR x.largo_cm IS NULL OR x.ancho_cm IS NULL OR x.alto_cm IS NULL)::integer AS sin_medidas
           FROM envio_bultos x
          WHERE x.envio_id = e.id) b ON true
     LEFT JOIN LATERAL ( SELECT count(*)::integer AS partidas,
            sum(x.cantidad) AS piezas,
            string_agg(format('%s × %s'::text, x.cantidad::double precision, x.descripcion), '; '::text ORDER BY x.orden) AS resumen,
            COALESCE(bool_or(a.tipo = ANY (ARRAY['equipo'::tipo_articulo, 'subensamble'::tipo_articulo])), false) AS lleva_equipo
           FROM envio_lineas x
             LEFT JOIN articulos a ON a.id = x.articulo_id
          WHERE x.envio_id = e.id) l ON true;

create or replace view public.v_devoluciones with (security_invoker = true) as
SELECT d.id,
    d.folio,
    d.pedido_id,
    p.folio AS pedido_folio,
    p.canal,
    p.id_externo,
    p.cliente_id,
    c.nombre AS cliente,
    p.vendedor_id,
    pv.nombre AS vendedor,
    d.envio_id,
    e.folio AS envio_folio,
    e.numero_guia,
    q.nombre AS paqueteria,
    d.tipo,
    d.estado,
    d.codigo_autorizacion,
    d.motivo,
    d.fecha_esperada,
    d.fecha_limite,
    d.responsable_id,
    r.nombre AS responsable,
    d.respuesta,
    d.respondido_en,
    rp.nombre AS respondido_por_nombre,
    d.recibido_en,
    rc.nombre AS recibido_por_nombre,
    d.nota_recepcion,
    d.resultado,
    d.almacen_id,
    al.nombre AS almacen,
    d.reclamo_transportista,
    d.monto_reclamado,
    d.nota_resolucion,
    d.resuelto_en,
    rs.nombre AS resuelto_por_nombre,
    d.reingresado_en,
    d.cancelado_en,
    d.motivo_cancelacion,
    d.creado_por,
    cr.nombre AS creado_por_nombre,
    d.creado_en,
    ( SELECT string_agg(format('%s × %s'::text, x.cantidad::double precision, x.descripcion), '; '::text) AS string_agg
           FROM devolucion_lineas x
          WHERE x.devolucion_id = d.id) AS resumen,
    (( SELECT count(*) AS count
           FROM evidencias_envio v
          WHERE v.devolucion_id = d.id))::integer AS fotos,
    d.estado <> ALL (ARRAY['resuelta'::text, 'cancelada'::text]) AS abierta,
        CASE
            WHEN d.tipo = 'reclamo'::text AND d.estado = 'abierta'::text THEN d.fecha_limite
            WHEN d.tipo = 'devolucion'::text AND d.estado = 'abierta'::text AND d.fecha_esperada IS NOT NULL THEN ((d.fecha_esperada + '18:00:00'::time without time zone) AT TIME ZONE 'America/Mexico_City'::text)
            WHEN d.tipo = 'cancelacion'::text AND d.estado = 'abierta'::text THEN d.fecha_limite
            ELSE NULL::timestamp with time zone
        END AS vence,
    d.tipo = 'reclamo'::text AND d.estado = 'abierta'::text AND d.fecha_limite < now() OR d.tipo = 'devolucion'::text AND d.estado = 'abierta'::text AND d.fecha_esperada < hoy_planta() AS vencida,
    d.actualizado_en
   FROM devoluciones d
     JOIN pedidos_basicos() p ON p.id = d.pedido_id
     LEFT JOIN clientes c ON c.id = p.cliente_id
     LEFT JOIN perfiles pv ON pv.id = p.vendedor_id
     LEFT JOIN envios e ON e.id = d.envio_id
     LEFT JOIN paqueterias q ON q.id = e.paqueteria_id
     LEFT JOIN perfiles r ON r.id = d.responsable_id
     LEFT JOIN perfiles rp ON rp.id = d.respondido_por
     LEFT JOIN perfiles rc ON rc.id = d.recibido_por
     LEFT JOIN perfiles rs ON rs.id = d.resuelto_por
     LEFT JOIN perfiles cr ON cr.id = d.creado_por
     LEFT JOIN almacenes al ON al.id = d.almacen_id;

create or replace view public.v_documentos_tecnicos with (security_invoker = true) as
SELECT d.id,
    d.folio,
    d.revision,
    d.articulo_id,
    d.pedido_id,
    d.tipo,
    d.titulo,
    d.drive_url,
    d.estado,
    d.cambio,
    d.creado_por,
    d.creado_en,
    d.aprobado_por,
    d.aprobado_en,
    a.clave,
    a.nombre AS articulo,
    p.folio AS pedido_folio,
    c.nombre AS creado_por_nombre,
    ap.nombre AS aprobado_por_nombre,
    ( SELECT count(*) AS count
           FROM documentos_tecnicos x
          WHERE x.folio = d.folio) AS revisiones
   FROM documentos_tecnicos d
     LEFT JOIN articulos a ON a.id = d.articulo_id
     LEFT JOIN pedidos_basicos() p ON p.id = d.pedido_id
     LEFT JOIN perfiles c ON c.id = d.creado_por
     LEFT JOIN perfiles ap ON ap.id = d.aprobado_por;

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
    COALESCE('OC '::text || oc.folio, op.folio || COALESCE(' · '::text || pe.folio, ''::text), pe.folio, aj.folio,
        CASE m.tipo
            WHEN 'traspaso_salida'::tipo_movimiento THEN 'a '::text || t.almacen
            WHEN 'traspaso_entrada'::tipo_movimiento THEN 'de '::text || t.almacen
            ELSE NULL::text
        END) AS referencia
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

create or replace view public.v_numeros_serie with (security_invoker = true) as
SELECT 'erp'::text AS origen,
    o.numero_serie,
    a.familia_serie AS familia,
    o.id AS orden_id,
    o.folio AS orden_folio,
    a.nombre AS equipo,
    p.cliente_id,
    c.nombre AS cliente,
    p.id AS pedido_id,
    p.folio AS pedido,
    COALESCE(p.fecha, o.creado_en::date) AS fecha,
        CASE o.estado
            WHEN 'planeada'::estado_op THEN 'espera'::text
            WHEN 'liberada'::estado_op THEN 'espera'::text
            WHEN 'en_proceso'::estado_op THEN 'proceso'::text
            WHEN 'terminada'::estado_op THEN 'terminado'::text
            WHEN 'entregada'::estado_op THEN 'entregado'::text
            ELSE 'cancelado'::text
        END AS estado,
    fa.factura,
    ( SELECT v.nombre
           FROM perfiles v
          WHERE v.id = p.vendedor_id) AS vendedor,
    COALESCE(o.entregada_en::date, o.fecha_compromiso) AS entrega,
    NULL::text AS ubicacion,
    NULL::text AS contacto
   FROM ordenes_produccion o
     JOIN articulos a ON a.id = o.articulo_id
     LEFT JOIN pedidos_basicos() p ON p.id = o.pedido_id
     LEFT JOIN clientes c ON c.id = p.cliente_id
     LEFT JOIN ( SELECT f.pedido_id, string_agg(f.folio, ', '::text ORDER BY f.fecha) AS factura
           FROM facturas_basicas() f
          GROUP BY f.pedido_id) fa ON fa.pedido_id = p.id
  WHERE o.numero_serie IS NOT NULL
UNION ALL
 SELECT 'hoja'::text AS origen,
    h.numero_serie,
    h.familia,
    NULL::uuid AS orden_id,
    NULL::text AS orden_folio,
    COALESCE(h.descripcion, h.subcategoria, h.tipo_equipo) AS equipo,
    h.cliente_id,
    COALESCE(c.nombre, h.cliente_nombre) AS cliente,
    NULL::uuid AS pedido_id,
    h.pedido_hoja AS pedido,
    h.fecha_pedido AS fecha,
    h.estado,
    h.factura,
    h.vendedor,
    h.entrega_acordada AS entrega,
    h.ubicacion,
    h.contacto
   FROM equipos_historicos h
     LEFT JOIN clientes c ON c.id = h.cliente_id
  WHERE NOT (EXISTS ( SELECT 1
           FROM ordenes_produccion o
          WHERE o.numero_serie = h.numero_serie));

create or replace view public.v_pedidos_por_producir with (security_invoker = true) as
SELECT p.id,
    p.folio,
    p.fecha,
    p.fecha_compromiso,
    p.estado,
    c.nombre AS cliente,
    COALESCE(sum(ceil(pl.cantidad)) FILTER (WHERE b.tiene_lista), 0::numeric)::integer AS unidades,
    count(*) FILTER (WHERE NOT b.tiene_lista)::integer AS partidas_sin_lista,
    jsonb_agg(jsonb_build_object('linea_id', pl.id, 'articulo_id', a.id, 'clave', a.clave, 'equipo', a.nombre, 'cantidad', pl.cantidad, 'tiene_lista', b.tiene_lista) ORDER BY pl.orden) AS partidas,
    p.fecha_compromiso - hoy_planta() AS dias_restantes
   FROM pedidos_basicos() p
     JOIN clientes c ON c.id = p.cliente_id
     JOIN pedido_lineas_basicas() pl ON pl.pedido_id = p.id
     JOIN articulos a ON a.id = pl.articulo_id AND (a.tipo = ANY (ARRAY['equipo'::tipo_articulo, 'subensamble'::tipo_articulo]))
     CROSS JOIN LATERAL ( SELECT (EXISTS ( SELECT 1
                   FROM bom_lineas bl
                  WHERE bl.padre_id = a.id)) AS tiene_lista) b
  WHERE (p.estado = ANY (ARRAY['confirmado'::estado_pedido, 'en_produccion'::estado_pedido])) AND NOT (EXISTS ( SELECT 1
           FROM ordenes_produccion o
          WHERE o.pedido_linea_id = pl.id AND o.estado <> 'cancelada'::estado_op))
  GROUP BY p.id, p.folio, p.fecha, p.fecha_compromiso, p.estado, c.id;

create or replace view public.v_reservas with (security_invoker = true) as
SELECT r.id,
    r.articulo_id,
    a.clave,
    a.nombre,
    a.unidad,
    r.cantidad,
    r.surtido,
    r.cantidad - r.surtido AS pendiente,
    r.orden_produccion_id,
    op.folio AS op_folio,
    r.pedido_id,
    pe.folio AS pedido_folio,
    r.motivo,
    r.estado,
    r.creado_por,
    u.nombre AS creado_por_nombre,
    r.creado_en
   FROM reservas r
     JOIN articulos a ON a.id = r.articulo_id
     LEFT JOIN ordenes_produccion op ON op.id = r.orden_produccion_id
     LEFT JOIN pedidos_basicos() pe ON pe.id = r.pedido_id
     LEFT JOIN perfiles u ON u.id = r.creado_por;

-- Almacén: "pedidos entregados sin salida de inventario" (solo folios).
CREATE OR REPLACE FUNCTION public.hallazgos_envios(p_area text)
 RETURNS TABLE(area text, tono text, titulo text, detalle text, ruta text, peso integer)
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
declare v_hoy date := hoy_planta(); h jsonb := '[]'::jsonb; k int; k2 int; v_txt text; v_cfg jsonb; r record;
begin
  if not puede('envios', 1) or coalesce(p_area, 'direccion') not in ('direccion', 'almacen', 'ventas') then return; end if;
  select valor into v_cfg from configuracion where clave = 'envios';

  if coalesce(p_area, 'direccion') in ('direccion', 'almacen') and puede('inventario', 2) then
    -- Hoy salen o los recogen.
    select count(*), count(*) filter (where falta_empaque), string_agg(folio || coalesce(' (' || cliente || ')', ''), ', ')
      into k, k2, v_txt from v_envios where abierto and fecha_recoleccion <= v_hoy;
    if k > 0 then
      h := h || jsonb_build_object('area', 'almacen', 'tono', case when k2 > 0 then 'riesgo' else 'atencion' end,
        'titulo', format('%s %s hoy', k, case when k = 1 then 'envío sale o lo recogen' else 'envíos salen o los recogen' end),
        'detalle', left(v_txt, 220) || case when k2 > 0 then format('. %s sin empacar todavía.', k2) else '.' end,
        'ruta', '/almacen/envios?pestana=hoy', 'peso', 4);
    end if;
    -- Guía lista y sin empacar.
    select count(*) into k from v_envios where falta_empaque and guia_en is not null;
    if k > 0 then
      h := h || jsonb_build_object('area', 'almacen', 'tono', 'atencion',
        'titulo', format('%s %s con guía y sin empacar', k, case when k = 1 then 'envío' else 'envíos' end),
        'detalle', 'La guía ya se pagó: empácalos con fotos y check list para que salgan en la siguiente recolección.',
        'ruta', '/almacen/envios?pestana=empacar', 'peso', 12);
    end if;
    -- Devoluciones que debían llegar.
    select count(*), string_agg(folio || coalesce(' código ' || codigo_autorizacion, ''), ', ') into k, v_txt
    from devoluciones where tipo = 'devolucion' and estado = 'abierta' and fecha_esperada <= v_hoy;
    if k > 0 then
      h := h || jsonb_build_object('area', 'almacen', 'tono', 'atencion',
        'titulo', format('%s %s por recibir', k, case when k = 1 then 'devolución' else 'devoluciones' end),
        'detalle', left(v_txt, 200) || '. Al llegar: fotos de cómo viene antes de abrirla.',
        'ruta', '/ventas/devoluciones', 'peso', 14);
    end if;
    -- "Hizo falta darle salida a esta venta": pedidos entregados en 30 días sin
    -- salida de inventario de sus componentes (ni a mano ni con un envío).
    select count(*), string_agg(x.folio, ', ') into k, v_txt from (
      select distinct p.folio from pedidos_basicos() p
      join pedido_lineas_basicas() pl on pl.pedido_id = p.id join articulos a on a.id = pl.articulo_id
      where p.estado = 'entregado' and not coalesce(p.historico, false) and p.entregado_en >= now() - interval '30 days'
        and a.controla_inventario and a.tipo in ('componente', 'materia_prima')
        and not exists (select 1 from movimientos_inventario m where m.pedido_id = p.id and m.articulo_id = pl.articulo_id and m.tipo = 'salida_venta')
        and not exists (select 1 from envio_lineas el join envios e on e.id = el.envio_id
                        where el.pedido_linea_id = pl.id and e.inventario_descontado_en is not null)
      order by 1 limit 20) x;
    if k > 0 then
      h := h || jsonb_build_object('area', 'almacen', 'tono', 'riesgo',
        'titulo', format('%s %s sin salida de inventario', k, case when k = 1 then 'pedido entregado' else 'pedidos entregados' end),
        'detalle', format('%s. Se marcaron entregados sin envío ni salida de inventario: la existencia está inflada. Revisa con el vendedor qué salió y corrígelo con un ajuste; lo que sale con un envío ya no se olvida.', left(v_txt, 160)),
        'ruta', '/almacen/movimientos', 'peso', 6);
    end if;
  end if;

  if coalesce(p_area, 'direccion') in ('direccion', 'ventas') then
    -- Reclamos por vencer o vencidos (los de quien pregunta, por la RLS).
    select count(*), count(*) filter (where fecha_limite < now()),
           string_agg(folio || coalesce(' (' || cliente || ')', ''), ', ' order by fecha_limite)
      into k, k2, v_txt
    from v_devoluciones where tipo = 'reclamo' and estado = 'abierta'
      and fecha_limite < now() + make_interval(hours => coalesce((v_cfg->>'horas_aviso_reclamo')::int, 6) * 2);
    if k > 0 then
      h := h || jsonb_build_object('area', 'ventas', 'tono', 'riesgo',
        'titulo', case when k2 > 0 then format('%s %s sin respuesta y vencido', k2, case when k2 = 1 then 'reclamo' else 'reclamos' end)
                       else format('%s %s por vencer', k, case when k = 1 then 'reclamo' else 'reclamos' end) end,
        'detalle', left(v_txt, 200) || '. Un reclamo sin respuesta le baja la reputación a la cuenta de Mercado Libre.',
        'ruta', '/ventas/devoluciones', 'peso', 3);
    end if;
    -- Solicitudes sin cotizar.
    select count(*), string_agg(folio || coalesce(' (' || cliente || ')', ''), ', ') into k, v_txt from v_envios
    where estado = 'solicitado' and tipo in ('paqueteria', 'flete') and guia_en is null
      and solicitado_en < now() - make_interval(hours => coalesce((v_cfg->>'horas_para_cotizar')::int, 4));
    if k > 0 then
      h := h || jsonb_build_object('area', 'ventas', 'tono', 'atencion',
        'titulo', format('%s %s sin cotizar', k, case when k = 1 then 'envío' else 'envíos' end),
        'detalle', left(v_txt, 200) || '. Peso y medidas ya vienen del artículo: cotiza con eso.',
        'ruta', '/almacen/envios?pestana=cotizar', 'peso', 16);
    end if;
    -- En camino de más.
    select count(*), string_agg(folio || coalesce(' (' || cliente || ')', ''), ', ') into k, v_txt from v_envios
    where estado = 'enviado' and dias_en_camino > coalesce((v_cfg->>'dias_en_camino')::int, 5);
    if k > 0 then
      h := h || jsonb_build_object('area', 'ventas', 'tono', 'atencion',
        'titulo', format('%s %s en camino hace más de %s días', k, case when k = 1 then 'envío lleva' else 'envíos llevan' end,
                         coalesce((v_cfg->>'dias_en_camino')::int, 5)),
        'detalle', left(v_txt, 200) || '. Rastrea la guía o confirma con el cliente y márcalo entregado.',
        'ruta', '/almacen/envios?pestana=camino', 'peso', 22);
    end if;
    -- Saldo bajo.
    if puede('envios', 2) or puede('finanzas', 1) then
      select count(*), string_agg(format('%s (%s)', paqueteria, texto_dinero(saldo)), ', ') into k, v_txt from saldos_paqueteria() where bajo;
      if k > 0 then
        h := h || jsonb_build_object('area', 'ventas', 'tono', 'atencion',
          'titulo', format('Saldo bajo en %s', case when k = 1 then 'una paquetería' else format('%s paqueterías', k) end),
          'detalle', v_txt || '. Pide la recarga antes de que se atore una guía.',
          'ruta', '/almacen/envios?saldo=1', 'peso', 18);
      end if;
    end if;
  end if;

  return query select e->>'area', e->>'tono', e->>'titulo', e->>'detalle', e->>'ruta', (e->>'peso')::int
               from jsonb_array_elements(h) e;
end $function$;

-- -----------------------------------------------------------------------------
-- 2. La gerencia de producción sin ventas
-- -----------------------------------------------------------------------------
delete from public.permisos_rol where rol = 'gerente_produccion' and modulo = 'ventas';

-- -----------------------------------------------------------------------------
-- 3. El costo de los movimientos, solo con "costos"
-- -----------------------------------------------------------------------------
create or replace view public.v_ajustes with (security_invoker = true) as
SELECT aj.id,
    aj.folio,
    aj.articulo_id,
    a.clave,
    a.nombre,
    a.unidad,
    aj.almacen_id,
    al.nombre AS almacen,
    aj.cantidad_sistema,
    aj.cantidad_fisica,
    aj.diferencia,
    aj.motivo,
    aj.conteo_id,
    co.nombre AS conteo,
    aj.estado,
    aj.solicitado_por,
    sp.nombre AS solicitado_por_nombre,
    aj.solicitado_en,
    aj.resuelto_por,
    rp.nombre AS resuelto_por_nombre,
    aj.resuelto_en,
    aj.comentario,
    e.cantidad AS existencia_actual,
        CASE
            WHEN aj.estado = 'aprobado'::text THEN COALESCE(ap.cantidad, 0::numeric)
            ELSE NULL::numeric
        END AS aplicado,
        CASE
            WHEN ( SELECT puede('costos'::text, 1) AS puede) THEN
            CASE aj.estado
                WHEN 'aprobado'::text THEN round(COALESCE(va.valor, 0::numeric), 2)
                ELSE round(aj.diferencia * ca.costo * tc(ca.moneda), 2)
            END
            ELSE NULL::numeric
        END AS valor_diferencia
   FROM ajustes_inventario aj
     JOIN articulos a ON a.id = aj.articulo_id
     JOIN almacenes al ON al.id = aj.almacen_id
     LEFT JOIN conteos co ON co.id = aj.conteo_id
     LEFT JOIN perfiles sp ON sp.id = aj.solicitado_por
     LEFT JOIN perfiles rp ON rp.id = aj.resuelto_por
     LEFT JOIN existencias e ON e.articulo_id = aj.articulo_id AND e.almacen_id = aj.almacen_id
     LEFT JOIN costos_articulo ca ON ca.articulo_id = aj.articulo_id
     LEFT JOIN LATERAL ( SELECT sum(m.cantidad) AS cantidad
           FROM movimientos_inventario m
          WHERE m.ajuste_id = aj.id) ap ON true
     LEFT JOIN valor_ajustes() va ON va.ajuste_id = aj.id;

-- Las vistas ya no nombran la columna; ahora sí se puede quitar.
revoke select on public.movimientos_inventario from anon, authenticated;
grant select (id, tipo, articulo_id, almacen_id, cantidad, orden_compra_id, orden_produccion_id, pedido_id, ajuste_id,
              traspaso_id, motivo, fuera_de_lista, usuario_id, en) on public.movimientos_inventario to authenticated;

-- -----------------------------------------------------------------------------
-- 4. Recepción: catálogo con precio, sin costeo
-- -----------------------------------------------------------------------------
insert into public.permisos_rol (rol, modulo, nivel) values ('direccion', 'catalogo', 3), ('recepcion', 'catalogo', 1)
on conflict do nothing;
delete from public.permisos_rol where rol = 'recepcion' and modulo = 'costeo';

-- "¿Lo tienen?" es la segunda pregunta de quien llama: recepción ve la existencia.
alter policy ver on public.existencias using (
  (select puede('inventario', 1)) or (select puede('ventas', 1)) or (select puede('catalogo', 1)));

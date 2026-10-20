-- =============================================================================
-- Nómina e impuestos aparte de los proveedores.
--
-- Qué se rompía: en la hoja la nómina, el IMSS, la PTU, los aguinaldos y los impuestos se
-- capturaban como "compras" a un "proveedor". «Comprado en 12 meses» ponía a «NÓMINA
-- ATOTONILCO» como el proveedor más grande ($7.6 M), y compras los veía en su directorio.
-- Eso es de finanzas y RRHH, no de compras.
--
-- * tipo_acreedor gana 'nomina' (nómina y prestaciones: nómina, IMSS, PTU, aguinaldo, bonos,
--   finiquitos, primas, incentivos y personas pagadas por nómina) e 'impuestos'.
-- * Lo comprado (compras_proveedores_12m) solo cuenta proveedores.
-- * Lo que se debe sigue contando: Inicio, el tablero y los hallazgos ya no dicen "solo
--   proveedores" sino "todo menos préstamos de socios y créditos" (antes nómina e impuestos
--   eran 'proveedor' y contaban; así siguen contando).
-- * v_proveedores trae tipo_acreedor para que el directorio de compras los esconda.
-- =============================================================================

alter table public.proveedores drop constraint if exists proveedores_tipo_acreedor_check;
alter table public.proveedores add constraint proveedores_tipo_acreedor_check
  check (tipo_acreedor in ('proveedor', 'socio', 'financiamiento', 'nomina', 'impuestos'));

update public.proveedores set tipo_acreedor = 'nomina'
where tipo_acreedor = 'proveedor' and categoria in ('Nómina', 'IMSS', 'PTU');
update public.proveedores set tipo_acreedor = 'impuestos'
where tipo_acreedor = 'proveedor' and categoria = 'Impuestos';

create or replace view public.v_proveedores with (security_invoker = true) as
 WITH surte AS (
         SELECT x.proveedor_id,
            count(DISTINCT x.articulo_id) AS n
           FROM ( SELECT a.proveedor_id,
                    a.id AS articulo_id
                   FROM articulos a
                  WHERE a.activo AND a.proveedor_id IS NOT NULL
                UNION
                 SELECT c_1.proveedor_id,
                    c_1.articulo_id
                   FROM costos_articulo c_1
                     JOIN articulos a ON a.id = c_1.articulo_id
                  WHERE a.activo AND c_1.proveedor_id IS NOT NULL) x
          GROUP BY x.proveedor_id
        ), compras AS (
         SELECT o.proveedor_id,
            count(*) FILTER (WHERE o.estado = ANY (ARRAY['enviada'::text, 'parcial'::text])) AS abiertas,
            count(*) FILTER (WHERE (o.estado = ANY (ARRAY['enviada'::text, 'parcial'::text])) AND o.fecha_entrega < CURRENT_DATE) AS atrasadas,
            sum(o.total * o.tipo_cambio) FILTER (WHERE o.estado <> 'cancelada'::text AND o.fecha >= (CURRENT_DATE - 365)) AS comprado_12m,
            max(o.fecha) FILTER (WHERE o.estado <> 'cancelada'::text) AS ultima_compra
           FROM ordenes_compra o
          GROUP BY o.proveedor_id
        )
 SELECT p.id,
    p.nombre,
    p.razon_social,
    p.rfc,
    p.contacto,
    p.telefono,
    p.correo,
    p.sitio,
    p.categoria,
    p.pais,
    p.es_importacion,
    p.moneda,
    p.dias_credito,
    p.dias_entrega,
    p.datos_bancarios,
    p.notas,
    p.activo,
    p.legacy_id,
    p.creado_en,
    p.actualizado_en,
    COALESCE(s.n, 0::bigint) AS articulos,
    COALESCE(c.abiertas, 0::bigint) AS oc_abiertas,
    COALESCE(c.atrasadas, 0::bigint) AS oc_atrasadas,
    c.comprado_12m,
    c.ultima_compra,
    p.tipo_acreedor
   FROM proveedores p
     LEFT JOIN surte s ON s.proveedor_id = p.id
     LEFT JOIN compras c ON c.proveedor_id = p.id;

create or replace function public.tablero_direccion()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
AS $function$
declare
  r jsonb := '{}'::jsonb;
  v_hoy date := (now() at time zone 'America/Mexico_City')::date;
  v_mes date := date_trunc('month', v_hoy);
  v_anio date := date_trunc('year', v_hoy);
  v_dia_anio int := v_hoy - date_trunc('year', v_hoy)::date + 1;
begin
  if puede('ventas', 3) or puede('finanzas', 1) then
    r := r || jsonb_build_object('ventas', (
      -- Todo contra el mismo tramo del año pasado: comparar el mes en curso (3 días)
      -- contra el mes completo del año pasado siempre sale en rojo.
      with c as (select ventas_entre(v_anio, v_hoy) anio,
                        ventas_entre((v_anio - interval '1 year')::date, (v_hoy - interval '1 year')::date) misma_fecha,
                        ventas_entre((v_anio - interval '1 year')::date, (v_anio - interval '1 day')::date) anterior_total)
      select jsonb_build_object(
        'mes', ventas_entre(v_mes, v_hoy),
        'mes_anio_anterior', ventas_entre((v_mes - interval '1 year')::date, (v_hoy - interval '1 year')::date),
        'anio', c.anio,
        'anio_anterior_misma_fecha', c.misma_fecha,
        'anio_anterior_total', c.anterior_total,
        -- "A este ritmo" con la estacionalidad del año pasado: si vamos 22 % arriba a
        -- la misma fecha, cerramos 22 % arriba de lo que cerró. La lineal (× 365 / día)
        -- subestima cuando el último trimestre es fuerte, como en 2025.
        'proyeccion_anio', round(case when c.misma_fecha > 0 and c.anterior_total > 0
                                      then c.anterior_total * c.anio / c.misma_fecha
                                      else c.anio * 365.0 / v_dia_anio end),
        'serie_12', (select jsonb_agg(jsonb_build_object('mes', x.mes, 'monto', x.monto) order by x.mes)
                     from ventas_historicas_mes((v_mes - interval '11 months')::date) x)
      ) from c),
      'top_clientes', (
        select coalesce(jsonb_agg(t order by t.monto desc), '[]') from (
          select c.id, c.nombre, round(sum(x.monto)) monto from (
            select h.cliente_id, h.monto from historial_ventas_hoja h where h.tipo = 'Venta' and h.fecha >= v_anio
            union all
            select p.cliente_id, p.total * p.tipo_cambio from pedidos p where not p.historico and p.estado <> 'cancelado' and p.fecha >= v_anio
              and p.fecha >= coalesce((select (valor #>> '{}')::date from configuracion where clave = 'fecha_arranque'), current_date)
          ) x join clientes c on c.id = x.cliente_id group by c.id, c.nombre order by sum(x.monto) desc limit 8) t));
  end if;

  if puede('ventas', 3) then
    r := r || jsonb_build_object('embudo', (
      select coalesce(jsonb_agg(jsonb_build_object('etapa', e.etapa, 'n', coalesce(o.n, 0), 'monto', coalesce(o.monto, 0)) order by e.ord), '[]')
      from (values ('prospecto', 1), ('contactado', 2), ('cotizado', 3), ('negociacion', 4)) e(etapa, ord)
      left join (select etapa::text, count(*) n, sum(monto_estimado) monto from oportunidades where etapa not in ('ganada', 'perdida') group by etapa) o
        on o.etapa = e.etapa),
      'cotizaciones', (
        select jsonb_build_object(
          'abiertas', count(*) filter (where estado in ('enviada', 'autorizada') and fecha + vigencia_dias >= v_hoy),
          'monto_abierto', coalesce(sum(total * tipo_cambio) filter (where estado in ('enviada', 'autorizada') and fecha + vigencia_dias >= v_hoy), 0),
          'por_autorizar', count(*) filter (where estado = 'por_autorizar'),
          'cierre_90d', round(count(*) filter (where estado = 'aceptada' and fecha >= v_hoy - 90)::numeric
                         / nullif(count(*) filter (where estado in ('aceptada', 'rechazada', 'vencida') and fecha >= v_hoy - 90), 0), 3),
          'del_mes', count(*) filter (where fecha >= v_mes))
        from cotizaciones),
      'vendedores', (
        select coalesce(jsonb_agg(jsonb_build_object('nombre', c.vendedor, 'maquinaria', c.venta_maquinaria + c.venta_otros,
          'refacciones', c.venta_refacciones, 'siguiente_meta', c.siguiente_meta, 'comision', c.total) order by c.venta_maquinaria + c.venta_otros desc), '[]')
        from comisiones_mes(v_mes) c),
      'canales', (
        select coalesce(jsonb_agg(jsonb_build_object('canal', canal, 'monto', monto) order by monto desc), '[]') from (
          select p.canal::text canal, round(sum(p.subtotal * p.tipo_cambio)) monto from pedidos p
          where p.estado <> 'cancelado' and p.fecha >= v_anio group by 1) x));
  end if;

  if puede('produccion', 1) then
    r := r || jsonb_build_object('produccion', (
      select jsonb_build_object(
        'abiertas', count(*), 'atrasadas', count(*) filter (where atrasada), 'en_proceso', count(*) filter (where estado = 'en_proceso'),
        'con_faltantes', count(*) filter (where materiales_faltantes > 0),
        'a_tiempo_90d', (select round(count(*) filter (where terminada_en::date <= fecha_compromiso)::numeric / nullif(count(*), 0), 3)
                         from ordenes_produccion where terminada_en >= v_hoy - 90 and fecha_compromiso is not null),
        'terminadas_mes', (select count(*) from ordenes_produccion where terminada_en >= v_mes),
        'carga', (select coalesce(jsonb_agg(jsonb_build_object('etapa', nombre, 'color', color, 'horas', horas_pendientes,
                    'semanas', round(horas_pendientes / nullif(capacidad_horas_semana, 0), 1)) order by orden), '[]') from v_carga_etapas))
      from v_tablero_produccion));
  end if;

  if puede('inventario', 1) and puede('costos', 1) then
    r := r || jsonb_build_object('inventario', (
      with re as (select * from reabasto())
      select jsonb_build_object(
        'valor', (select round(sum(e.cantidad * cc.costo_total)) from existencias e join costos_calculados cc using (articulo_id) where e.cantidad > 0),
        'por_almacen', (select coalesce(jsonb_agg(jsonb_build_object('almacen', a.nombre, 'valor', x.v) order by x.v desc), '[]') from (
            select e.almacen_id, round(sum(e.cantidad * cc.costo_total)) v from existencias e join costos_calculados cc using (articulo_id)
            where e.cantidad > 0 group by 1) x join almacenes a on a.id = x.almacen_id),
        'excedentes_valor', (select round(sum(re.en_planta * cc.costo_total)) from re join costos_calculados cc on cc.articulo_id = re.articulo_id where re.estado = 'excedente'),
        'excedentes_n', (select count(*) from re where estado = 'excedente'),
        'a_ordenar_n', (select count(*) from re where estado = 'ordenar'),
        'inversion_sugerida', (select round(sum(re.sugerido * cc.costo_total)) from re join costos_calculados cc on cc.articulo_id = re.articulo_id where re.estado = 'ordenar'),
        'importados_en_riesgo_n', (select count(*) from re where es_importado and estado = 'ordenar'),
        'importados_en_riesgo', (select coalesce(jsonb_agg(jsonb_build_object('id', articulo_id, 'nombre', nombre, 'disponible', disponible,
                                   'reorden', punto_reorden, 'dias', dias_entrega) order by disponible - punto_reorden), '[]')
                                 from (select * from re where es_importado and estado = 'ordenar' order by disponible - punto_reorden limit 6) i),
        'ajustes_pendientes', (select count(*) from ajustes_inventario where estado = 'pendiente'))));
  end if;

  if puede('costos', 1) then
    r := r || jsonb_build_object('costos_al_alza', (
      select coalesce(jsonb_agg(t order by t.cambio desc), '[]') from (
        select a.id, a.nombre, h.costo_anterior, h.costo_nuevo, round(h.costo_nuevo / nullif(h.costo_anterior, 0) - 1, 4) cambio, h.en,
          (select count(*) from donde_se_usa(a.id)) equipos
        from historial_costos h join articulos a on a.id = h.articulo_id
        where h.en >= v_hoy - 30 and h.costo_anterior > 0 and h.costo_nuevo > h.costo_anterior * 1.03
        order by h.costo_nuevo / h.costo_anterior desc limit 6) t),
      'equipos_que_subieron', (
        select coalesce(jsonb_agg(t order by t.cambio desc), '[]') from (
          select a.id, a.clave, a.nombre, u.precio_lista precio, round(u.precio_lista / nullif(p.precio_lista, 0) - 1, 4) cambio
          from articulos a
          join lateral (select precio_lista from historial_costeo where articulo_id = a.id and precio_lista is not null order by en desc limit 1) u on true
          join lateral (select precio_lista from historial_costeo where articulo_id = a.id and precio_lista is not null and en < v_hoy - 30 order by en desc limit 1) p on true
          where a.tipo = 'equipo' and u.precio_lista <> p.precio_lista
          order by abs(u.precio_lista / nullif(p.precio_lista, 0) - 1) desc limit 6) t));
  end if;

  if puede('finanzas', 1) then
    r := r || jsonb_build_object('cobranza', (
      select jsonb_build_object(
        'erp', (select coalesce(sum(saldo), 0) from v_saldos_pedido where saldo > 0),
        'arranque', (select coalesce(sum(saldo), 0) from v_saldo_arranque_clientes where saldo > 1),
        'antiguedad', (select jsonb_build_object(
            'd0_30', coalesce(sum(saldo) filter (where v_hoy - fecha <= 30), 0),
            'd31_60', coalesce(sum(saldo) filter (where v_hoy - fecha between 31 and 60), 0),
            'd61_90', coalesce(sum(saldo) filter (where v_hoy - fecha between 61 and 90), 0),
            'd90', coalesce(sum(saldo) filter (where v_hoy - fecha > 90), 0))
          from v_saldos_pedido where saldo > 0),
        'cobrado_mes', (select coalesce(sum(monto), 0) from cobros where fecha >= v_mes)
          + (select coalesce(sum(monto), 0) from historial_ventas_hoja where tipo = 'Pago' and fecha >= v_mes))),
      'por_pagar', (select jsonb_build_object(
          'total', coalesce(sum(saldo * case when moneda = 'MXN' then 1 else tc(moneda) end), 0),
          'vencido', coalesce(sum(saldo * case when moneda = 'MXN' then 1 else tc(moneda) end) filter (where vence_pago < v_hoy), 0),
          -- Lo que la hoja dice que debemos (solo saldos a cargo) y lo que nos deben los
          -- proveedores (anticipos y reembolsos): no se netean, son cosas distintas.
          -- La cuenta de cada proveedor (lo de la hoja más lo registrado aquí sin orden de compra).
          'arranque', (select coalesce(sum(saldo), 0) from v_saldo_arranque_proveedores where saldo > 1 and tipo_acreedor not in ('socio', 'financiamiento')),
          'arranque_vencido', (select coalesce(sum(vencido), 0) from v_saldo_arranque_proveedores where tipo_acreedor not in ('socio', 'financiamiento')),
          'arranque_a_favor', (select coalesce(-sum(saldo), 0) from v_saldo_arranque_proveedores where saldo < -1 and tipo_acreedor not in ('socio', 'financiamiento')),
          -- Préstamos de socios y créditos de banco: deuda, pero no con proveedores.
          'socios', (select coalesce(sum(saldo), 0) from v_saldo_arranque_proveedores where saldo > 1 and tipo_acreedor = 'socio'),
          'financiamiento', (select coalesce(sum(saldo), 0) from v_saldo_arranque_proveedores where saldo > 1 and tipo_acreedor = 'financiamiento'))
        from v_cuentas_por_pagar where saldo > 0));
  end if;

  return r || jsonb_build_object('generado', now());
end $function$;

create or replace function public.hallazgos_compras_hoja(p_area text DEFAULT 'direccion'::text)
 RETURNS TABLE(area text, tono text, titulo text, detalle text, ruta text, peso integer)
 LANGUAGE plpgsql
 STABLE
AS $function$
declare v_debe numeric; v_venc numeric; v_n int; v_mayor text;
begin
  if not puede('finanzas', 2) then return; end if;
  select coalesce(sum(saldo) filter (where saldo > 1), 0), coalesce(sum(vencido), 0), count(*) filter (where saldo > 1)
  into v_debe, v_venc, v_n from v_saldo_arranque_proveedores where tipo_acreedor not in ('socio', 'financiamiento');
  if v_debe <= 0 then return; end if;
  select nombre into v_mayor from v_saldo_arranque_proveedores where saldo > 1 and tipo_acreedor not in ('socio', 'financiamiento') order by saldo desc limit 1;
  return query select 'finanzas'::text, case when v_venc > 0 then 'atencion' else 'info' end,
    format('%s por pagar a %s proveedores', texto_dinero(v_debe), v_n)
      || case when v_venc > 0 then format(' (%s vencido)', texto_dinero(v_venc)) else '' end,
    format('Lo que viene de la hoja más lo registrado en el ERP (el mayor: %s). Compras y pagos se registran en Pagos a proveedores; préstamos de socios y créditos van aparte.', v_mayor),
    '/finanzas/pagos'::text, case when v_venc > 0 then 30 else 72 end;
end $function$;

create or replace function public.indicadores(p_secciones text[] default null)
returns jsonb language plpgsql stable as $$
declare r jsonb := '{}'::jsonb; v_mes date := date_trunc('month', current_date);
begin
  if puede('ventas', 1) and (p_secciones is null or 'ventas' = any(p_secciones)) then
    r := r || jsonb_build_object('ventas', (
      select jsonb_build_object(
        'mes', coalesce(sum(p.subtotal * p.tipo_cambio) filter (where p.fecha >= v_mes), 0),
        -- El mismo tramo del mes pasado (del 1 al día de hoy): contra el mes completo,
        -- los primeros días siempre salían "77 % abajo".
        'mes_anterior', coalesce(sum(p.subtotal * p.tipo_cambio) filter (where p.fecha >= v_mes - interval '1 month'
                          and p.fecha <= (now() at time zone 'America/Mexico_City')::date - interval '1 month'), 0),
        'anio', coalesce(sum(p.subtotal * p.tipo_cambio) filter (where p.fecha >= date_trunc('year', current_date)), 0),
        'pedidos_mes', count(*) filter (where p.fecha >= v_mes))
      from pedidos p where p.estado <> 'cancelado'),
      'cotizaciones', (
      select jsonb_build_object(
        'abiertas', count(*) filter (where c.estado in ('borrador', 'por_autorizar', 'autorizada', 'enviada') and c.fecha + c.vigencia_dias >= current_date),
        'monto_abierto', coalesce(sum(c.subtotal * c.tipo_cambio) filter (where c.estado in ('enviada') and c.fecha + c.vigencia_dias >= current_date), 0),
        'por_autorizar', count(*) filter (where c.estado = 'por_autorizar'),
        'mes', count(*) filter (where c.fecha >= v_mes),
        'ganadas_90d', count(*) filter (where c.estado = 'aceptada' and c.fecha >= current_date - 90),
        'cerradas_90d', count(*) filter (where c.estado in ('aceptada', 'rechazada', 'vencida') and c.fecha >= current_date - 90))
      from cotizaciones c),
      'tareas_vencidas', (select count(*) from actividades a where not a.hecha and a.vence_en < current_date and a.usuario_id = auth.uid()));
  end if;
  if (puede('finanzas', 1) or puede('ventas', 3)) and (p_secciones is null or 'cobranza' = any(p_secciones)) then
    r := r || jsonb_build_object('cobranza', (
      select jsonb_build_object('por_cobrar', coalesce(sum(saldo * case when moneda = 'MXN' then 1 else tc(moneda) end) filter (where saldo > 0), 0),
                                'pedidos_con_saldo', count(*) filter (where saldo > 0))
      from v_saldos_pedido));
  end if;
  if puede('finanzas', 1) and (p_secciones is null or 'por_pagar' = any(p_secciones)) then
    -- Órdenes de compra más la cuenta de cada proveedor (hoja y compras sin orden), como en
    -- Pagos. La cuenta solo la ve finanzas 2: para compras esa parte suma cero (RLS).
    r := r || jsonb_build_object('por_pagar', (
      select jsonb_build_object('total', o.total + c.debe, 'vencido', o.vencido + c.vencido)
      from (select coalesce(sum(saldo * case when moneda = 'MXN' then 1 else tc(moneda) end), 0) as total,
                   coalesce(sum(saldo * case when moneda = 'MXN' then 1 else tc(moneda) end) filter (where vence_pago < current_date), 0) as vencido
            from v_cuentas_por_pagar where saldo > 0) o,
           (select coalesce(sum(saldo) filter (where saldo > 1), 0) as debe, coalesce(sum(vencido), 0) as vencido
            from v_saldo_arranque_proveedores where tipo_acreedor not in ('socio', 'financiamiento')) c));
  end if;
  if puede('inventario', 1) and (p_secciones is null or 'inventario' = any(p_secciones)) then
    r := r || jsonb_build_object('inventario', jsonb_build_object(
      'ajustes_pendientes', (select count(*) from ajustes_inventario where estado = 'pendiente'),
      'articulos_con_existencia', (select count(distinct articulo_id) from existencias where cantidad > 0)));
  end if;
  if puede('costos', 1) and (p_secciones is null or 'costos' = any(p_secciones)) then
    r := r || jsonb_build_object('valor_inventario', (
      select coalesce(sum(e.cantidad * cc.costo_total), 0) from existencias e join costos_calculados cc on cc.articulo_id = e.articulo_id where e.cantidad > 0),
      'costos_viejos', (select count(*) from costos_articulo where actualizado_en < current_date - 180));
  end if;
  if puede('compras', 1) and (p_secciones is null or 'compras' = any(p_secciones)) then
    r := r || jsonb_build_object('compras', jsonb_build_object(
      'oc_abiertas', (select count(*) from v_ordenes_compra where estado in ('enviada', 'parcial')),
      'oc_atrasadas', (select count(*) from v_ordenes_compra where estado in ('enviada', 'parcial') and fecha_entrega < current_date),
      'requisiciones_abiertas', (select count(*) from requisiciones where estado = 'abierta')));
  end if;
  if puede('produccion', 1) and (p_secciones is null or 'produccion' = any(p_secciones)) then
    r := r || jsonb_build_object('produccion', (
      select jsonb_build_object('abiertas', count(*), 'atrasadas', count(*) filter (where atrasada),
             'en_proceso', count(*) filter (where estado = 'en_proceso'),
             'con_faltantes', count(*) filter (where materiales_faltantes > 0),
             'terminadas_mes', (select count(*) from ordenes_produccion where terminada_en >= v_mes))
      from v_tablero_produccion));
  end if;
  if puede('rrhh', 1) and (p_secciones is null or 'rrhh' = any(p_secciones)) then
    r := r || jsonb_build_object('rrhh', jsonb_build_object(
      'empleados', (select count(*) from empleados where activo),
      'incidencias_pendientes', (select count(*) from incidencias where estado = 'solicitada'),
      'ausentes_hoy', (select count(distinct empleado_id) from incidencias where estado = 'aprobada'
                       and current_date between inicio and fin and tipo in ('vacaciones', 'incapacidad', 'permiso_con_goce', 'permiso_sin_goce', 'falta'))));
  end if;
  if puede('importaciones', 1) and (p_secciones is null or 'importaciones' = any(p_secciones)) then
    -- Lo de todos los días de importaciones: qué viene en el mar, qué llega esta semana
    -- y cuántos documentos faltan antes de que arribe (sin ellos el agente no despacha).
    r := r || jsonb_build_object('importaciones', (
      select jsonb_build_object(
        'activos', count(*) filter (where fase not in ('cerrado', 'cancelado')),
        'en_camino', count(*) filter (where fase in ('transito', 'puerto')),
        'llegan_semana', count(*) filter (where fase in ('transito', 'puerto') and en_planta is null
                                            and llegada_planta_estimada <= current_date + 7),
        'docs_pendientes', coalesce(sum(docs_pendientes_arribo) filter (where fase in ('cotizando', 'produccion', 'listo', 'transito')), 0))
      from v_embarques));
  end if;
  if puede('leads', 1) and (p_secciones is null or 'leads' = any(p_secciones)) then
    -- Lo que cada quien ve de leads (la RLS filtra): por tomar, míos sin atender y lo de hoy.
    r := r || jsonb_build_object('leads', (
      select jsonb_build_object(
        'por_tomar', count(*) filter (where estado = 'nuevo'),
        'mios_sin_atender', count(*) filter (where estado = 'asignado' and vendedor_id = auth.uid()),
        'sin_atender', count(*) filter (where estado = 'asignado'),
        'capturados_hoy', count(*) filter (where capturado_por = auth.uid()
                                              and (creado_en at time zone 'America/Mexico_City')::date = (now() at time zone 'America/Mexico_City')::date),
        'convertidos_mes', count(*) filter (where estado = 'convertido' and atendido_en >= v_mes))
      from leads));
  end if;
  return r;
end $$;
grant execute on function public.indicadores(text[]) to authenticated;

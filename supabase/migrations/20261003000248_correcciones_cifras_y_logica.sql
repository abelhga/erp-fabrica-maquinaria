-- =============================================================================
-- Cifras que no cuadraban entre pantallas y dos errores de lógica (revisión de nov 2026).
--
--   C2  Tablero de dirección: lo vencido de «Por cobrar» (chip «+90 d», tono del indicador y la
--       gráfica «Cobranza por antigüedad») solo contaba pedidos del ERP. El saldo de la hoja,
--       que es casi todo lo que se debe, ya se reparte por antigüedad en Cobranza
--       (saldo_arranque_antiguedad, 114); el tablero ahora lo suma igual.
--   C3  «Cotizaciones vivas» (indicadores) y «Cotizado vivo» (tablero) contaban cada versión
--       como una cotización y sumaban su monto otra vez; el cierre a 90 días tomaba la versión
--       reemplazada como venta perdida. Ahora, como lo_cotizado (199): una por raíz, con el
--       monto de su última versión.
--   C5  «Tu semana»: «Cobrado» solo contaba cobros de pedidos; Cobranza también cuenta los pagos
--       de la hoja y lo cobrado aquí a saldos de la hoja. Misma base que cobranza_por_mes.
--   C7  Dinero de Mercado Libre (v_ml_dinero): un pago reembolsado seguía mostrando lo que llega
--       a Mercado Pago y lo que «se quedó» ML como si no se hubiera devuelto nada, y los intentos
--       rechazados o cancelados contaban como pagados.
--   L1  Iniciar o reanudar una etapa desde el detalle de la orden (sin nombres) borraba la
--       cuadrilla que planeó la gerencia.
--   T4  La tasa de IVA de Configuración no se usaba al crear cotizaciones ni pedidos: nacían
--       siempre con 16 % por el default de la columna.
-- Cada función se copia de su versión vigente en la base (tablero_direccion de 169, indicadores
-- de 132, semana_en_numeros de 141, avanzar_operacion de 152, v_ml_dinero de 165) y solo cambia
-- lo marcado con «(248)».
-- =============================================================================

CREATE OR REPLACE FUNCTION public.tablero_direccion()
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
      -- (248) Cada cotización cuenta una vez con todas sus versiones (la raíz es origen_id) y con
      -- el monto de su última versión viva, como en lo_cotizado (199). Antes cada versión era un
      -- renglón: una v1 y una v2 vigentes contaban dos y su monto se sumaba dos veces, y la versión
      -- dada de baja con «Se reemplazó por la versión …» entraba al cierre como venta perdida.
      'cotizaciones', (
        select jsonb_build_object(
          'abiertas', count(distinct coalesce(origen_id, id)) filter (where estado in ('enviada', 'autorizada') and fecha + vigencia_dias >= v_hoy),
          'monto_abierto', (select coalesce(sum(u.total * u.tipo_cambio), 0) from (
              select distinct on (coalesce(origen_id, id)) total, tipo_cambio from cotizaciones
              where estado in ('enviada', 'autorizada') and fecha + vigencia_dias >= v_hoy
              order by coalesce(origen_id, id), version desc) u),
          'por_autorizar', count(*) filter (where estado = 'por_autorizar'),
          'cierre_90d', round(count(distinct coalesce(origen_id, id)) filter (where estado = 'aceptada' and fecha >= v_hoy - 90)::numeric
                         / nullif(count(distinct coalesce(origen_id, id)) filter (where estado in ('aceptada', 'rechazada', 'vencida') and fecha >= v_hoy - 90
                                    and coalesce(motivo_rechazo, '') not like 'Se reemplazó por la versión %'), 0), 3),
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
      -- El precio de lista solo para quien ve precios de venta (149): lo da historial_precios().
      -- El último precio y el de hace un mes, de un solo recorrido (antes, dos por equipo).
      'equipos_que_subieron', (
        with hp as (select h.articulo_id, h.en, h.precio_lista from historial_precios() h where h.precio_lista is not null),
        u as (select distinct on (articulo_id) articulo_id, precio_lista from hp order by articulo_id, en desc),
        p as (select distinct on (articulo_id) articulo_id, precio_lista from hp where en < v_hoy - 30 order by articulo_id, en desc)
        select coalesce(jsonb_agg(t order by t.cambio desc), '[]') from (
          select a.id, a.clave, a.nombre, u.precio_lista precio, round(u.precio_lista / nullif(p.precio_lista, 0) - 1, 4) cambio
          from articulos a
          join u on u.articulo_id = a.id
          join p on p.articulo_id = a.id
          where a.tipo = 'equipo' and u.precio_lista <> p.precio_lista
          order by abs(u.precio_lista / nullif(p.precio_lista, 0) - 1) desc limit 6) t));
  end if;

  if puede('finanzas', 1) then
    r := r || jsonb_build_object('cobranza', (
      select jsonb_build_object(
        'erp', (select coalesce(sum(saldo), 0) from v_saldos_pedido where saldo > 0),
        'arranque', (select coalesce(sum(saldo), 0) from v_saldo_arranque_clientes where saldo > 1),
        -- (248) Lo vencido también trae el saldo de la hoja, repartido por fecha de venta con
        -- saldo_arranque_antiguedad() (114), igual que Cobranza. Antes solo contaba pedidos del ERP:
        -- el total de «Por cobrar» sí traía la hoja, pero el chip «+90 d», el tono del indicador y
        -- la gráfica no veían los ~$2.7 M de la hoja con más de 90 días (5 nov 2026).
        'antiguedad', (select jsonb_build_object(
            'd0_30', p.d0_30 + coalesce((h.r->>'0-30')::numeric, 0),
            'd31_60', p.d31_60 + coalesce((h.r->>'31-60')::numeric, 0),
            'd61_90', p.d61_90 + coalesce((h.r->>'61-90')::numeric, 0),
            'd90', p.d90 + coalesce((h.r->>'90+')::numeric, 0))
          from (select coalesce(sum(saldo) filter (where v_hoy - fecha <= 30), 0) d0_30,
                       coalesce(sum(saldo) filter (where v_hoy - fecha between 31 and 60), 0) d31_60,
                       coalesce(sum(saldo) filter (where v_hoy - fecha between 61 and 90), 0) d61_90,
                       coalesce(sum(saldo) filter (where v_hoy - fecha > 90), 0) d90
                from v_saldos_pedido where saldo > 0) p,
               (select saldo_arranque_antiguedad()->'rangos' r) h),
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

CREATE OR REPLACE FUNCTION public.indicadores(p_secciones text[] DEFAULT NULL::text[])
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
AS $function$
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
      -- (248) «Cotizaciones vivas»: cada cotización cuenta una vez con todas sus versiones (la raíz
      -- es origen_id) y el monto es el de su última versión enviada, como en lo_cotizado (199).
      -- Antes cada versión era un renglón: una v1 enviada y una v2 en borrador contaban dos, y si
      -- las dos se enviaban el monto salía doble. La versión dada de baja con «Se reemplazó por la
      -- versión …» (240) tampoco cuenta como cerrada: no es una venta perdida.
      'cotizaciones', (
      select jsonb_build_object(
        'abiertas', count(distinct coalesce(c.origen_id, c.id)) filter (where c.estado in ('borrador', 'por_autorizar', 'autorizada', 'enviada') and c.fecha + c.vigencia_dias >= current_date),
        'monto_abierto', (select coalesce(sum(u.subtotal * u.tipo_cambio), 0) from (
            select distinct on (coalesce(origen_id, id)) subtotal, tipo_cambio from cotizaciones
            where estado = 'enviada' and fecha + vigencia_dias >= current_date
            order by coalesce(origen_id, id), version desc) u),
        'por_autorizar', count(*) filter (where c.estado = 'por_autorizar'),
        'mes', count(*) filter (where c.fecha >= v_mes),
        'ganadas_90d', count(distinct coalesce(c.origen_id, c.id)) filter (where c.estado = 'aceptada' and c.fecha >= current_date - 90),
        'cerradas_90d', count(distinct coalesce(c.origen_id, c.id)) filter (where c.estado in ('aceptada', 'rechazada', 'vencida') and c.fecha >= current_date - 90
                          and coalesce(c.motivo_rechazo, '') not like 'Se reemplazó por la versión %'))
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
end $function$;

CREATE OR REPLACE FUNCTION public.semana_en_numeros(p_lunes date DEFAULT NULL::date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
declare
  v_hoy date := hoy_planta();
  -- La semana que empieza: lunes de hoy (o de la fecha que se pida, aunque no sea lunes:
  -- el asistente también la llama). "Pasada" es la que acaba de terminar.
  v_lunes date := date_trunc('week', coalesce(p_lunes, v_hoy))::date;
  v_desde date := v_lunes - 7;
  v_hasta date := v_lunes - 1;
  v_ant_desde date := v_lunes - 14;
  v_ant_hasta date := v_lunes - 8;
  v_fin date := v_lunes + 6;
  r jsonb;
begin
  r := jsonb_build_object('semana', jsonb_build_object('lunes', v_lunes, 'pasada_desde', v_desde, 'pasada_hasta', v_hasta, 'hasta', v_fin));

  if puede('ventas', 1) then
    r := r || jsonb_build_object('ventas', jsonb_build_object(
      -- Un vendedor ve lo de sus clientes; decirlo evita que lo lea como el total de la empresa.
      'alcance', case when puede('ventas', 3) or puede('finanzas', 1) then 'empresa' else 'tuyas' end,
      'monto', ventas_entre(v_desde, v_hasta),
      'monto_anterior', ventas_entre(v_ant_desde, v_ant_hasta),
      'operaciones', operaciones_entre(v_desde, v_hasta),
      'operaciones_anterior', operaciones_entre(v_ant_desde, v_ant_hasta),
      'cotizaciones_enviadas', (select jsonb_build_object('n', count(*), 'monto', round(coalesce(sum(total * tipo_cambio), 0), 2))
        from cotizaciones where (enviada_en at time zone 'America/Mexico_City')::date between v_desde and v_hasta),
      'cotizaciones_ganadas', (select jsonb_build_object('n', count(*), 'monto', round(coalesce(sum(total * tipo_cambio), 0), 2))
        from cotizaciones where estado = 'aceptada' and (cerrada_en at time zone 'America/Mexico_City')::date between v_desde and v_hasta),
      'cotizaciones_perdidas', (select count(*) from cotizaciones
        where estado = 'rechazada' and (cerrada_en at time zone 'America/Mexico_City')::date between v_desde and v_hasta),
      -- Enviadas hace más de una semana y sin respuesta: el seguimiento que se cae.
      'cotizaciones_sin_respuesta', (select jsonb_build_object('n', count(*), 'monto', round(coalesce(sum(total * tipo_cambio), 0), 2))
        from cotizaciones where estado = 'enviada' and enviada_en < (v_lunes - 7)::timestamp at time zone 'America/Mexico_City'),
      'mejores_clientes', (select coalesce(jsonb_agg(x order by x.monto desc), '[]') from (
        select nombre, round(sum(monto), 2) monto from (
          select h.cliente_nombre nombre, h.monto from historial_ventas_hoja h
          where h.tipo = 'Venta' and h.fecha between v_desde and v_hasta
            and h.fecha < coalesce((select (valor #>> '{}')::date from configuracion where clave = 'fecha_arranque'), current_date)
          union all
          select c.nombre, p.total * p.tipo_cambio from pedidos p join clientes c on c.id = p.cliente_id
          where p.estado <> 'cancelado' and not p.historico and p.fecha between v_desde and v_hasta
            and p.fecha >= coalesce((select (valor #>> '{}')::date from configuracion where clave = 'fecha_arranque'), current_date)
        ) t where nombre is not null group by nombre order by sum(monto) desc limit 3) x),
      'entregas_comprometidas', (select coalesce(jsonb_agg(jsonb_build_object('folio', p.folio, 'cliente', c.nombre, 'fecha', p.fecha_compromiso,
          'estado', p.estado) order by p.fecha_compromiso), '[]')
        from pedidos p join clientes c on c.id = p.cliente_id
        where p.fecha_compromiso between v_lunes and v_fin and p.estado in ('confirmado', 'en_produccion', 'listo'))));
  end if;

  if puede('finanzas', 1) then
    -- (248) Lo cobrado con la misma base que «Cobrado por mes» de Cobranza (cobranza_por_mes, 114):
    -- cobros de pedidos, pagos de la hoja y lo que finanzas cobra aquí a los saldos de la hoja (sin
    -- los que la hoja ya trae). Antes solo contaba cobros de pedidos y la misma semana daba otra
    -- cifra que Cobranza; casi todo lo que entra hoy es de saldos de la hoja.
    r := r || jsonb_build_object('cobranza', (
      select jsonb_build_object(
        'cobrado', round(coalesce(sum(x.monto) filter (where x.fecha between v_desde and v_hasta), 0), 2),
        'cobrado_anterior', round(coalesce(sum(x.monto) filter (where x.fecha between v_ant_desde and v_ant_hasta), 0), 2))
      from (
        select co.fecha, co.monto * p.tipo_cambio as monto from cobros co join pedidos p on p.id = co.pedido_id
        union all select h.fecha, h.monto from historial_ventas_hoja h where h.tipo = 'Pago'
        union all select sh.fecha, sh.monto from v_cobros_saldo_hoja sh where not sh.en_hoja
      ) x where x.fecha between v_ant_desde and v_hasta));
  end if;

  -- Producción nivel 1 lo tienen los vendedores: ven el avance, y la RLS ya les deja ver las órdenes que les tocan.
  if puede('produccion', 1) then
    r := r || jsonb_build_object('produccion', jsonb_build_object(
      'terminadas', (select count(*) from ordenes_produccion where (terminada_en at time zone 'America/Mexico_City')::date between v_desde and v_hasta),
      'terminadas_anterior', (select count(*) from ordenes_produccion where (terminada_en at time zone 'America/Mexico_City')::date between v_ant_desde and v_ant_hasta),
      'atrasadas', (select count(*) from ordenes_produccion where fecha_compromiso < v_hoy and estado in ('planeada', 'liberada', 'en_proceso') and en_espera_motivo is null),
      'en_proceso', (select count(*) from ordenes_produccion where estado = 'en_proceso'),
      'comprometidas', (select coalesce(jsonb_agg(jsonb_build_object('folio', o.folio, 'equipo', a.nombre, 'fecha', o.fecha_compromiso, 'estado', o.estado)
          order by o.fecha_compromiso), '[]')
        from ordenes_produccion o join articulos a on a.id = o.articulo_id
        where o.fecha_compromiso between v_lunes and v_fin and o.estado in ('planeada', 'liberada', 'en_proceso') and o.en_espera_motivo is null)));
  end if;

  -- Compras y almacén: conteos de la vista sin costos (almacén ve qué llega, no cuánto costó).
  if puede('compras', 1) or puede('inventario', 2) then
    r := r || jsonb_build_object('compras', jsonb_build_object(
      'por_llegar', (select coalesce(jsonb_agg(jsonb_build_object('folio', o.folio, 'proveedor', o.proveedor, 'fecha', o.fecha_entrega) order by o.fecha_entrega), '[]')
        from v_ordenes_compra o where o.estado in ('enviada', 'parcial') and o.fecha_entrega between v_lunes and v_fin),
      'atrasadas', (select count(*) from v_ordenes_compra where estado in ('enviada', 'parcial') and fecha_entrega < v_hoy),
      'ajustes_pendientes', (select count(*) from ajustes_inventario where estado = 'pendiente'),
      'ajustes_semana', (select count(*) from ajustes_inventario where (solicitado_en at time zone 'America/Mexico_City')::date between v_desde and v_hasta)));
  end if;

  if puede('importaciones', 1) then
    r := r || jsonb_build_object('importaciones', jsonb_build_object(
      'llegan', (select coalesce(jsonb_agg(jsonb_build_object('folio', e.folio, 'descripcion', e.descripcion, 'eta', e.eta) order by e.eta), '[]')
        from embarques e where not e.cancelado and e.eta between v_lunes and v_fin)));
  end if;

  if puede('servicio', 1) then
    r := r || jsonb_build_object('servicio', jsonb_build_object(
      'cerrados', (select count(*) from servicios where (cerrado_en at time zone 'America/Mexico_City')::date between v_desde and v_hasta),
      'programados', (select coalesce(jsonb_agg(jsonb_build_object('folio', s.folio, 'tipo', s.tipo, 'equipo', s.equipo, 'lugar', s.lugar,
          'inicio', (s.inicio at time zone 'America/Mexico_City')::date) order by s.inicio), '[]')
        from servicios s where s.cancelado_en is null and (s.inicio at time zone 'America/Mexico_City')::date between v_lunes and v_fin)));
  end if;

  -- Pendientes propios: los que vencieron sin cerrar y los que vencen esta semana.
  r := r || jsonb_build_object('pendientes', jsonb_build_object(
    'vencidos', (select count(*) from pendientes where responsable_id = (select auth.uid()) and estado = 'abierto' and vence < v_hoy),
    'esta_semana', (select count(*) from pendientes where responsable_id = (select auth.uid()) and estado = 'abierto' and vence between v_hoy and v_fin),
    'cerrados', (select count(*) from pendientes where responsable_id = (select auth.uid()) and (cerrado_en at time zone 'America/Mexico_City')::date between v_desde and v_hasta)));

  return r;
end $function$;

CREATE OR REPLACE FUNCTION public.avanzar_operacion(p_operacion uuid, p_accion text, p_nota text DEFAULT NULL::text, p_responsable text DEFAULT NULL::text, p_empleados uuid[] DEFAULT NULL::uuid[], p_sin_nombre integer DEFAULT 0)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare op op_operaciones; o ordenes_produccion; v_etapa text; v_resp text := nullif(trim(p_responsable), '');
  v_cuadrilla text;
  v_nota text := nullif(trim(p_nota), '');
begin
  if not puede('produccion', 2) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  select * into op from op_operaciones where id = p_operacion for update;
  if op.id is null then raise exception 'No existe esa etapa'; end if;
  select * into o from ordenes_produccion where id = op.orden_id for update;
  select nombre into v_etapa from etapas where id = op.etapa_id;
  if o.estado = 'planeada' then raise exception 'La orden % todavía no está liberada', o.folio; end if;
  if o.estado in ('terminada', 'entregada', 'cancelada') then raise exception 'La orden % ya está cerrada', o.folio; end if;
  if o.en_espera_motivo is not null then
    raise exception 'La orden % está en espera (%): la gerencia de producción la reactiva', o.folio, o.en_espera_motivo;
  end if;

  if p_accion in ('inicio', 'reanudar') then
    v_cuadrilla := nombres_cuadrilla(p_empleados, p_sin_nombre);
    v_resp := coalesce(v_cuadrilla, v_resp);
  end if;

  case p_accion
    when 'inicio' then
      if op.estado = 'terminada' then raise exception '% de % ya se terminó', v_etapa, o.folio; end if;
      if op.estado = 'en_proceso' then
        raise exception '% de % ya estaba en proceso%', v_etapa, o.folio, coalesce(' (' || op.responsable || ')', '');
      end if;
      update op_operaciones set estado = 'en_proceso', inicio = least(coalesce(inicio, now()), now()),
        responsable = coalesce(v_resp, responsable) where id = p_operacion;
      update ordenes_produccion set estado = 'en_proceso' where id = o.id and estado = 'liberada';
    when 'pausa' then
      if op.estado <> 'en_proceso' then raise exception 'Solo se pausa una etapa que está en proceso'; end if;
      update op_operaciones set estado = 'pausada', responsable = coalesce(v_resp, responsable) where id = p_operacion;
    when 'reanudar' then
      if op.estado <> 'pausada' then raise exception '% de % no está pausada', v_etapa, o.folio; end if;
      update op_operaciones set estado = 'en_proceso', responsable = coalesce(v_resp, responsable) where id = p_operacion;
    when 'fin' then
      if op.estado = 'terminada' then raise exception '% de % ya se terminó', v_etapa, o.folio; end if;
      update op_operaciones set estado = 'terminada', fin = now(), inicio = least(coalesce(inicio, now()), now()),
        responsable = coalesce(v_resp, responsable) where id = p_operacion;
      update ordenes_produccion set estado = 'en_proceso' where id = o.id and estado = 'liberada';
    when 'problema' then
      if v_nota is null then raise exception 'Escribe cuál es el problema'; end if;
    when 'nota' then
      if v_nota is null then raise exception 'La nota está vacía'; end if;
    else raise exception 'Acción desconocida: %', p_accion;
  end case;
  insert into op_eventos (orden_id, operacion_id, tipo, nota, responsable)
  values (o.id, p_operacion, p_accion, v_nota, coalesce(v_resp, op.responsable));

  -- Quien empieza o reanuda la etapa abre su tramo de tiempo (pausa y fin los cierra el disparador).
  if p_accion in ('inicio', 'reanudar') then
    perform abrir_tramos(p_operacion, p_empleados, p_sin_nombre);
    -- Lo que se hizo manda: quien estaba planeado y no arrancó deja la cuadrilla.
    -- (248) Solo si la llamada dice quién arrancó (la terminal). Iniciar o reanudar desde el
    -- detalle de la orden no manda nombres, y «<> all('{}')» es verdadero en cada renglón: se
    -- borraba toda la cuadrilla que planeó la gerencia, también la que se dejó a propósito al pausar.
    if p_empleados is not null or coalesce(p_sin_nombre, 0) > 0 then
      delete from op_asignaciones where operacion_id = p_operacion and empleado_id <> all(coalesce(p_empleados, '{}'));
    end if;
  end if;

  if p_accion = 'fin' and not exists (select 1 from op_operaciones where orden_id = o.id and estado <> 'terminada') then
    update ordenes_produccion set estado = 'terminada', terminada_en = now() where id = o.id;
    insert into op_eventos (orden_id, tipo) values (o.id, 'terminada');
    -- Si todas las órdenes del pedido terminaron, el pedido queda listo para entregar.
    if o.pedido_id is not null and not exists (select 1 from ordenes_produccion where pedido_id = o.pedido_id
                                               and estado not in ('terminada', 'entregada', 'cancelada')) then
      update pedidos set estado = 'listo' where id = o.pedido_id and estado = 'en_produccion';
    end if;
  end if;
end $function$;

-- (248) C7. Lo que de verdad dejó cada pago de Mercado Libre, con lo reembolsado ya descontado.
-- Medido en la nube (5 nov 2026, 88 pagos «refunded»): Mercado Pago NO baja net_received_amount
-- al reembolsar, y lo que ML devuelve de sus cargos llega en «reembolsado» de cada cargo
-- (charges_details.amounts.refunded), que la función de borde guarda pero no restaba. Ejemplo:
-- pago de $21,750 reembolsado completo, neto guardado $16,591.50 y cargos devueltos $5,158.50:
-- llega 16,591.50 − 21,750 + 5,158.50 = $0. Si ML no devuelve sus cargos, el neto sale negativo:
-- es lo que se perdió. Además solo cuentan los pagos que el comprador sí hizo: un intento
-- rechazado o cancelado (35 y 9 en la nube) sumaba su total completo a «Pagaron los compradores»
-- y en la ficha del pedido salía como «Pagado». in_mediation es un reclamo: el comprador pagó.
-- Mismas columnas y tipos que en 165 (create or replace view no deja cambiar el tipo).
create or replace view public.v_ml_dinero with (security_invoker = true) as
select g.pago_id, g.order_id, v.pedido_id, pe.folio, v.comprador, v.full_ml, v.envio_ml, g.estado, g.pagado_en, g.metodo,
  g.total,
  (g.comision - d.comision)::numeric(14,2) as comision,
  (g.envio - d.envio)::numeric(14,2) as envio,
  (g.retencion_iva - d.retencion_iva)::numeric(14,2) as retencion_iva,
  (g.retencion_isr - d.retencion_isr)::numeric(14,2) as retencion_isr,
  (g.otros - d.otros)::numeric(14,2) as otros,
  g.reembolsado,
  (case when g.reembolsado > 0 then g.neto - g.reembolsado + d.total else g.neto end)::numeric(14,2) as neto,
  g.libera_en,
  (g.liberado or g.libera_en <= now()) as disponible, g.completo, g.cargos
from public.ml_pagos g
join public.ml_ventas v on v.order_id = g.order_id
left join public.pedidos pe on pe.id = v.pedido_id
-- La misma clasificación que normalizarPago (mercadolibre/nucleo.ts). Un pago sin el detalle de
-- Mercado Pago guarda cargos nulos (o el json null): no hay nada que descontar.
cross join lateral (
  select coalesce(sum(x.r) filter (where x.nombre = 'meli_fee'), 0) as comision,
    coalesce(sum(x.r) filter (where x.tipo = 'shipping'), 0) as envio,
    coalesce(sum(x.r) filter (where x.nombre = 'tax_withholding-iva'), 0) as retencion_iva,
    coalesce(sum(x.r) filter (where x.nombre = 'tax_withholding-isr'), 0) as retencion_isr,
    coalesce(sum(x.r) filter (where x.nombre not in ('meli_fee', 'tax_withholding-iva', 'tax_withholding-isr')
                                and x.tipo is distinct from 'shipping'), 0) as otros,
    coalesce(sum(x.r), 0) as total
  from (select coalesce(c->>'nombre', '') as nombre, c->>'tipo' as tipo, coalesce((c->>'reembolsado')::numeric, 0) as r
        from jsonb_array_elements(case when jsonb_typeof(g.cargos) = 'array' then g.cargos else '[]'::jsonb end) c) x
) d
where g.estado in ('approved', 'refunded', 'charged_back', 'in_mediation');

-- (248) T4. Cotizaciones y pedidos nacen con la tasa de IVA de Configuración. Ninguna alta pasa
-- tasa_iva (nueva_cotizacion, «Pedido sin cotización», Mercado Libre…), así que manda el default
-- de la columna, que era 0.16 fijo: con la tasa en 8 % (frontera) todo seguía naciendo con 16 %.
-- tasa_iva_general() (226) es security invoker y configuracion la puede leer cualquiera con rol.
-- Lo ya capturado no cambia: el default solo aplica al insertar.
alter table public.cotizaciones alter column tasa_iva set default public.tasa_iva_general();
alter table public.pedidos alter column tasa_iva set default public.tasa_iva_general();

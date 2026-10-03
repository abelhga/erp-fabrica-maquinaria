-- =============================================================================
-- Lo que almacén dejó de ver al cerrar los costos de compra (migración 069).
--
-- Desde la 069, ordenes_compra y oc_lineas solo las lee quien maneja dinero de
-- compras. Estas funciones las leían directo con los permisos de quien llama, así
-- que a almacén le respondían en cero: el reabasto decía que nada estaba en un
-- borrador de orden (y se volvía a pedir), el buscador no encontraba la orden de
-- compra por folio, la bitácora no ponía su nombre y el Inicio decía "0 compras en
-- camino". Ahora leen de v_ordenes_compra y v_oc_lineas, que dejan ver qué viene y
-- cuándo, sin importes. Mismo cuerpo que antes, solo cambia de dónde leen.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.reabasto_detalle()
 RETURNS TABLE(articulo_id uuid, clave text, nombre text, unidad text, es_importado boolean, proveedor text, consumo_meses numeric[], meses_con_consumo integer, demanda_mensual numeric, dias_entrega integer, meses_cobertura numeric, stock_seguridad numeric, punto_reorden numeric, lote numeric, en_planta numeric, reservado numeric, en_transito numeric, disponible numeric, sugerido numeric, estado text, proveedor_id uuid, empaque numeric, cobertura_propia numeric, entrega_propia integer, en_borrador numeric, borradores text, en_requisicion numeric, costo_mxn numeric)
 LANGUAGE sql
 STABLE
AS $function$
  select r.*, coalesce(c.proveedor_id, a.proveedor_id), a.empaque, a.meses_cobertura, a.tiempo_entrega_dias,
    coalesce(b.cant, 0), b.folios, coalesce(q.cant, 0),
    round(c.costo * public.tc(c.moneda), 4)
  from public.reabasto() r
  join public.articulos a on a.id = r.articulo_id
  left join public.costos_articulo c on c.articulo_id = r.articulo_id
  left join lateral (select sum(l.cantidad - l.recibido) cant, string_agg(distinct o.folio, ', ') folios
                     from public.v_oc_lineas l join public.v_ordenes_compra o on o.id = l.orden_compra_id
                     where o.estado = 'borrador' and l.articulo_id = r.articulo_id) b on true
  left join lateral (select sum(x.cantidad) cant from public.requisicion_lineas x
                     where x.estado = 'pendiente' and x.articulo_id = r.articulo_id) q on true
$function$;

CREATE OR REPLACE FUNCTION public.reabasto_por_pedir(p_articulos uuid[])
 RETURNS TABLE(articulo_id uuid, clave text, nombre text, sugerido numeric, en_borrador numeric, en_requisicion numeric, por_pedir numeric, proveedor_id uuid)
 LANGUAGE sql
 STABLE
AS $function$
  select r.articulo_id, r.clave, r.nombre, r.sugerido, coalesce(b.cant, 0), coalesce(q.cant, 0),
    greatest(ceil((r.sugerido - coalesce(b.cant, 0) - coalesce(q.cant, 0)) / a.empaque) * a.empaque, 0),
    coalesce(c.proveedor_id, a.proveedor_id)
  from public.reabasto() r
  join public.articulos a on a.id = r.articulo_id
  left join public.costos_articulo c on c.articulo_id = r.articulo_id
  left join lateral (select sum(l.cantidad - l.recibido) cant from public.v_oc_lineas l join public.v_ordenes_compra o on o.id = l.orden_compra_id
                     where o.estado = 'borrador' and l.articulo_id = r.articulo_id) b on true
  left join lateral (select sum(x.cantidad) cant from public.requisicion_lineas x where x.estado = 'pendiente' and x.articulo_id = r.articulo_id) q on true
  where r.articulo_id = any(p_articulos)
$function$;

CREATE OR REPLACE FUNCTION public.buscar_global(q text)
 RETURNS TABLE(tipo text, id text, titulo text, subtitulo text, ruta text)
 LANGUAGE sql
 STABLE
AS $function$
  with t as (select sin_acentos(trim(q)) t)
  (select case a.tipo when 'equipo' then 'equipo' when 'subensamble' then 'subensamble' else 'componente' end,
          a.id::text, a.nombre, a.clave, case when a.tipo in ('equipo', 'subensamble') then '/costeo/equipos/' else '/costeo/componentes/' end || a.id
   from articulos a, t where a.activo and sin_acentos(a.clave || ' ' || a.nombre) like '%' || replace(t.t, ' ', '%') || '%'
   order by similarity(sin_acentos(a.nombre), t.t) desc limit 8)
  union all
  (select 'cliente', c.id::text, c.nombre, coalesce(c.razon_social, c.ciudad), '/ventas/clientes/' || c.id
   from clientes c, t where sin_acentos(c.nombre || ' ' || coalesce(c.razon_social, '') || ' ' || coalesce(c.rfc, '')) like '%' || replace(t.t, ' ', '%') || '%'
   limit 6)
  union all
  (select 'cotizacion', c.id::text, c.folio || coalesce(' · ' || c.atencion, ''), to_char(c.total, 'FM$999,999,990.00'), '/ventas/cotizaciones/' || c.id
   from cotizaciones c, t where sin_acentos(c.folio || ' ' || coalesce(c.atencion, '') || ' ' || coalesce(c.empresa, '')) like '%' || replace(t.t, ' ', '%') || '%'
   order by c.fecha desc limit 5)
  union all
  (select 'pedido', p.id::text, p.folio, (select nombre from clientes where id = p.cliente_id), '/ventas/pedidos/' || p.id
   from pedidos p, t where sin_acentos(p.folio || ' ' || coalesce(p.id_externo, '')) like '%' || t.t || '%' order by p.fecha desc limit 5)
  union all
  (select 'orden_produccion', o.id::text, o.folio || coalesce(' · ' || o.numero_serie, ''), (select nombre from articulos where id = o.articulo_id), '/produccion/ordenes/' || o.id
   from ordenes_produccion o, t where sin_acentos(o.folio || ' ' || coalesce(o.numero_serie, '')) like '%' || t.t || '%' limit 5)
  union all
  (select 'proveedor', p.id::text, p.nombre, p.categoria, '/compras/proveedores/' || p.id
   from proveedores p, t where sin_acentos(p.nombre) like '%' || replace(t.t, ' ', '%') || '%' limit 5)
  union all
  (select 'orden_compra', o.id::text, o.folio, (select nombre from proveedores where id = o.proveedor_id), '/compras/ordenes/' || o.id
   from v_ordenes_compra o, t where sin_acentos(o.folio || ' ' || coalesce(o.factura_proveedor, '')) like '%' || t.t || '%' limit 5)
$function$;

CREATE OR REPLACE FUNCTION public.etiqueta_registro(p_tabla text, p_id text)
 RETURNS text
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
declare v_uuid uuid; v_int int; v_parte text := split_part(p_id, ':', 1);
begin
  if v_parte ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then v_uuid := v_parte::uuid; end if;
  if p_id ~ '^\d{1,9}$' then v_int := p_id::int; end if;
  return case p_tabla
    when 'empleados' then (select coalesce(numero || ' · ', '') || nombre from empleados where id = v_uuid)
    when 'empleado_datos' then (select nombre from empleados where id = v_uuid)
    when 'incidencias' then (select e.nombre from incidencias i join empleados e on e.id = i.empleado_id where i.id = v_uuid)
    when 'pedidos' then (select folio from pedidos where id = v_uuid)
    when 'cotizaciones' then (select folio from cotizaciones where id = v_uuid)
    when 'clientes' then (select nombre from clientes where id = v_uuid)
    when 'proveedores' then (select nombre from proveedores where id = v_uuid)
    when 'ordenes_compra' then (select folio from v_ordenes_compra where id = v_uuid)
    when 'ordenes_produccion' then (select folio from ordenes_produccion where id = v_uuid)
    when 'articulos' then (select clave || ' · ' || nombre from articulos where id = v_uuid)
    when 'perfiles' then (select nombre from perfiles where id = v_uuid)
    when 'usuario_roles' then (select nombre from perfiles where id = v_uuid)
    when 'cobros' then (select 'Cobro de ' || p.folio from cobros c join pedidos p on p.id = c.pedido_id where c.id = v_uuid)
    when 'facturas' then (select f.folio || ' · ' || p.folio from facturas f join pedidos p on p.id = f.pedido_id where f.id = v_uuid)
    when 'pagos_proveedor' then (select 'Pago de ' || o.folio from pagos_proveedor x join v_ordenes_compra o on o.id = x.orden_compra_id where x.id = v_uuid)
    when 'almacenes' then (select nombre from almacenes where id = v_int)
    when 'etapas' then (select nombre from etapas where id = v_int)
    when 'departamentos' then (select nombre from departamentos where id = v_int)
    when 'textos_comerciales' then (select left(texto, 60) from textos_comerciales where id = v_int)
    else null end;
end $function$;

CREATE OR REPLACE FUNCTION public.indicadores()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
AS $function$
declare r jsonb := '{}'::jsonb; v_mes date := date_trunc('month', current_date);
begin
  if puede('ventas', 1) then
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
  if puede('finanzas', 1) or puede('ventas', 3) then
    r := r || jsonb_build_object('cobranza', (
      select jsonb_build_object('por_cobrar', coalesce(sum(saldo * case when moneda = 'MXN' then 1 else tc(moneda) end) filter (where saldo > 0), 0),
                                'pedidos_con_saldo', count(*) filter (where saldo > 0))
      from v_saldos_pedido));
  end if;
  if puede('finanzas', 1) then
    r := r || jsonb_build_object('por_pagar', (
      select jsonb_build_object('total', coalesce(sum(saldo * case when moneda = 'MXN' then 1 else tc(moneda) end), 0),
                                'vencido', coalesce(sum(saldo * case when moneda = 'MXN' then 1 else tc(moneda) end) filter (where vence_pago < current_date), 0))
      from v_cuentas_por_pagar where saldo > 0));
  end if;
  if puede('inventario', 1) then
    r := r || jsonb_build_object('inventario', jsonb_build_object(
      'ajustes_pendientes', (select count(*) from ajustes_inventario where estado = 'pendiente'),
      'articulos_con_existencia', (select count(distinct articulo_id) from existencias where cantidad > 0)));
  end if;
  if puede('costos', 1) then
    r := r || jsonb_build_object('valor_inventario', (
      select coalesce(sum(e.cantidad * cc.costo_total), 0) from existencias e join costos_calculados cc on cc.articulo_id = e.articulo_id where e.cantidad > 0),
      'costos_viejos', (select count(*) from costos_articulo where actualizado_en < current_date - 180));
  end if;
  if puede('compras', 1) then
    r := r || jsonb_build_object('compras', jsonb_build_object(
      'oc_abiertas', (select count(*) from v_ordenes_compra where estado in ('enviada', 'parcial')),
      'oc_atrasadas', (select count(*) from v_ordenes_compra where estado in ('enviada', 'parcial') and fecha_entrega < current_date),
      'requisiciones_abiertas', (select count(*) from requisiciones where estado = 'abierta')));
  end if;
  if puede('produccion', 1) then
    r := r || jsonb_build_object('produccion', (
      select jsonb_build_object('abiertas', count(*), 'atrasadas', count(*) filter (where atrasada),
             'en_proceso', count(*) filter (where estado = 'en_proceso'),
             'con_faltantes', count(*) filter (where materiales_faltantes > 0),
             'terminadas_mes', (select count(*) from ordenes_produccion where terminada_en >= v_mes))
      from v_tablero_produccion));
  end if;
  if puede('rrhh', 1) then
    r := r || jsonb_build_object('rrhh', jsonb_build_object(
      'empleados', (select count(*) from empleados where activo),
      'incidencias_pendientes', (select count(*) from incidencias where estado = 'solicitada'),
      'ausentes_hoy', (select count(distinct empleado_id) from incidencias where estado = 'aprobada'
                       and current_date between inicio and fin and tipo in ('vacaciones', 'incapacidad', 'permiso_con_goce', 'permiso_sin_goce', 'falta'))));
  end if;
  return r;
end $function$;

-- Inicio con lo que le importa a cada puesto, no con todo lo que alcanza a leer.
--
-- Qué se rompía: indicadores() armaba cada tarjeta con solo que el rol PUDIERA leer
-- esos datos. Importaciones tiene "Finanzas: ver" (y compras también) y por eso a
-- Alondra le salía en Inicio el total por cobrar de todos los clientes; el gerente de
-- ventas veía lo que se debe a proveedores, y los vendedores "órdenes con material
-- faltante", que no les toca resolver. Poder leer algo no lo vuelve importante.
--
-- Ahora la pantalla dice qué secciones quiere según los roles de la persona y la base
-- calcula solo esas (también es más rápido: un vendedor ya no suma la cobranza ni el
-- inventario). Sin secciones (null) calcula todo lo que el rol puede ver, como antes.
-- Cada sección sigue condicionada a puede(): pedir "cobranza" sin el permiso no da nada.
-- Nueva sección "importaciones" para que importaciones tenga su propio resumen.

drop function if exists public.indicadores();

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
            from v_saldo_arranque_proveedores where tipo_acreedor = 'proveedor') c));
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
  return r;
end $$;

grant execute on function public.indicadores(text[]) to authenticated;

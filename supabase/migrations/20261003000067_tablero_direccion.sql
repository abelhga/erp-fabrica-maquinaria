-- =============================================================================
-- Tablero de dirección: todo lo que dirección necesita ver de un vistazo, en una
-- sola llamada, calculado en la base (no en el navegador) y respetando la RLS.
--
-- Ventas: el libro de la hoja (2018 → día de arranque) y los pedidos del ERP
-- después, en la misma unidad (importe con IVA, como el tablero de indicadores
-- de la hoja). Así la comparación contra el año anterior funciona desde el día 1.
-- =============================================================================

create or replace function public.ventas_historicas_mes(p_desde date default '2018-01-01')
returns table (mes date, monto numeric, operaciones int)
language sql stable security invoker as $$
  with arranque as (select coalesce((select (valor #>> '{}')::date from configuracion where clave = 'fecha_arranque'), current_date) f),
  v as (
    select date_trunc('month', h.fecha)::date mes, h.monto, 1 n
    from historial_ventas_hoja h, arranque where h.tipo = 'Venta' and h.fecha >= p_desde and h.fecha < arranque.f
    union all
    select date_trunc('month', p.fecha)::date, p.total * p.tipo_cambio, 1
    from pedidos p, arranque where p.estado <> 'cancelado' and not p.historico and p.fecha >= greatest(p_desde, arranque.f)
  )
  select mes, round(sum(monto), 2), sum(n)::int from v group by mes order by mes
$$;

-- Ventas entre dos fechas (inclusive), con la misma regla de corte que arriba.
create or replace function public.ventas_entre(p_desde date, p_hasta date) returns numeric
language sql stable security invoker as $$
  with arranque as (select coalesce((select (valor #>> '{}')::date from configuracion where clave = 'fecha_arranque'), current_date) f)
  select coalesce((select sum(h.monto) from historial_ventas_hoja h, arranque
                   where h.tipo = 'Venta' and h.fecha between p_desde and p_hasta and h.fecha < arranque.f), 0)
       + coalesce((select sum(p.total * p.tipo_cambio) from pedidos p, arranque
                   where p.estado <> 'cancelado' and not p.historico and p.fecha between p_desde and p_hasta and p.fecha >= arranque.f), 0)
$$;

create or replace function public.tablero_direccion() returns jsonb
language plpgsql stable security invoker as $$
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
      'por_pagar', (select jsonb_build_object('total', coalesce(sum(saldo), 0), 'vencido', coalesce(sum(saldo) filter (where vence_pago < v_hoy), 0))
                    from v_cuentas_por_pagar where saldo > 0));
  end if;

  return r || jsonb_build_object('generado', now());
end $$;

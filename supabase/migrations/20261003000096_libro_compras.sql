-- =============================================================================
-- Libro de compras y pagos de la hoja "BASE DE DATOS ACTUAL" (COMPRAS, 2022 → hoy).
--
-- Por qué: las cuentas por pagar del ERP solo salen de órdenes de compra recibidas,
-- y hasta hoy todo se ha comprado y pagado en la hoja. Finanzas veía "por pagar $0"
-- mientras la hoja dice que debemos $4.2 M. Igual que el libro de ventas
-- (historial_ventas_hoja), entra como archivo de solo lectura: de aquí sale el saldo
-- de arranque de cada proveedor, sin inventar órdenes ni pagos que el ERP no registró.
--
-- El saldo de la hoja es "Adeudo fin de año 2021" (directorio de proveedores) más
-- compras, menos pagos, menos reembolsos pendientes y más reembolsos cobrados desde
-- 2022 (signos de la pestaña Tipo). Con eso la suma da exactamente la "Cuentas por
-- pagar total a corto plazo" de la hoja. El adeudo de 2021 entra como un movimiento
-- más ("Adeudo 2021", al 31/12/2021) para que todo salga de una sola tabla.
--
-- El libro trae también nómina, IMSS, impuestos, préstamos de socios y créditos: no
-- son proveedores del catálogo, así que se guardan por nombre (proveedor_llave) y solo
-- se ligan a un proveedor cuando existe. Por eso solo lo ve finanzas nivel 2 (y
-- dirección): el nivel 1 lo tienen compras, importaciones y la gerencia de ventas.
-- =============================================================================

create table public.historial_compras_hoja (
  id bigserial primary key,
  fecha date not null,
  proveedor_id uuid references public.proveedores(id) on delete set null,
  proveedor_nombre text not null,
  proveedor_llave text not null,      -- nombre sin acentos ni mayúsculas: así se agrupa (la hoja liga por nombre)
  tipo text not null check (tipo in ('Adeudo 2021', 'Compra', 'Pago', 'Reembolso Pend.', 'Reembolso Realizado')),
  monto numeric(14,2) not null,       -- tal como la hoja: neto, con IVA cuando hubo factura
  cuenta text,
  descripcion text,
  factura text,
  orden text,
  fila_origen int
);
create index hist_compras_llave on public.historial_compras_hoja (proveedor_llave, fecha desc);
create index hist_compras_proveedor on public.historial_compras_hoja (proveedor_id) where proveedor_id is not null;

-- Signo de cada tipo, el de la pestaña Tipo de la hoja.
create or replace function public.signo_compra_hoja(p_tipo text) returns int
language sql immutable as $$
  select case p_tipo when 'Pago' then -1 when 'Reembolso Pend.' then -1 else 1 end
$$;

-- Saldo de arranque por proveedor: positivo = le debemos; negativo = anticipo o
-- reembolso a nuestro favor.
create or replace view public.v_saldo_arranque_proveedores with (security_invoker = true) as
select h.proveedor_llave,
  (array_agg(h.proveedor_id) filter (where h.proveedor_id is not null))[1] as proveedor_id,
  coalesce(max(p.nombre), max(h.proveedor_nombre)) as nombre,
  max(p.categoria) as categoria,
  sum(h.monto) filter (where h.tipo = 'Adeudo 2021') as adeudo_2021,
  sum(h.monto) filter (where h.tipo = 'Compra') as comprado,
  sum(h.monto) filter (where h.tipo = 'Pago') as pagado,
  sum(h.monto * signo_compra_hoja(h.tipo)) as saldo,
  max(h.fecha) filter (where h.tipo = 'Compra') as ultima_compra,
  max(h.fecha) filter (where h.tipo = 'Pago') as ultimo_pago,
  count(*) filter (where h.tipo <> 'Adeudo 2021') as movimientos
from public.historial_compras_hoja h left join public.proveedores p on p.id = h.proveedor_id
group by h.proveedor_llave;

alter table public.historial_compras_hoja enable row level security;
-- Trae nómina, préstamos de socios e impuestos: solo quien lleva finanzas (nivel 2;
-- dirección tiene 3 en todo). Finanzas 1 lo tienen compras e importaciones para ver pagos.
create policy ver on public.historial_compras_hoja for select to authenticated using ((select puede('finanzas', 2)));

-- Tablero: por pagar suma ahora el saldo de arranque de la hoja (aparte, como la cobranza)
-- y convierte a pesos las órdenes en dólares (antes sumaba USD como si fueran MXN).
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
      'por_pagar', (select jsonb_build_object(
          'total', coalesce(sum(saldo * case when moneda = 'MXN' then 1 else tc(moneda) end), 0),
          'vencido', coalesce(sum(saldo * case when moneda = 'MXN' then 1 else tc(moneda) end) filter (where vence_pago < v_hoy), 0),
          -- Lo que la hoja dice que debemos (solo saldos a cargo) y lo que nos deben los
          -- proveedores (anticipos y reembolsos): no se netean, son cosas distintas.
          'arranque', (select coalesce(sum(saldo), 0) from v_saldo_arranque_proveedores where saldo > 1),
          'arranque_a_favor', (select coalesce(-sum(saldo), 0) from v_saldo_arranque_proveedores where saldo < -1))
        from v_cuentas_por_pagar where saldo > 0));
  end if;

  return r || jsonb_build_object('generado', now());
end $$;

-- Hallazgo para el asistente y el resumen de la semana: sin esto decía "cuentas por
-- pagar en $0, seguro no se están capturando las facturas", cuando la deuda vive en
-- la hoja. Aparece solo en hallazgos() por llamarse hallazgos_<área>(p_area text).
create or replace function public.hallazgos_compras_hoja(p_area text default 'direccion')
returns table (area text, tono text, titulo text, detalle text, ruta text, peso int)
language plpgsql stable security invoker as $$
declare v_debe numeric; v_favor numeric; v_n int; v_mayor text;
begin
  if not puede('finanzas', 2) then return; end if;
  select coalesce(sum(saldo) filter (where saldo > 1), 0), coalesce(-sum(saldo) filter (where saldo < -1), 0), count(*) filter (where saldo > 1)
  into v_debe, v_favor, v_n from v_saldo_arranque_proveedores;
  if v_debe <= 0 then return; end if;
  select nombre into v_mayor from v_saldo_arranque_proveedores where saldo > 1 order by saldo desc limit 1;
  return query select 'finanzas'::text, 'info'::text,
    format('%s por pagar a %s proveedores según la hoja', texto_dinero(v_debe), v_n),
    format('Saldos del libro de compras de la hoja (el mayor: %s)%s. Las órdenes de compra del ERP van aparte; conforme se paguen, regístralo en el ERP.',
           v_mayor, case when v_favor > 0 then format('; además hay %s a nuestro favor en anticipos y reembolsos', texto_dinero(v_favor)) else '' end),
    '/finanzas/pagos'::text, 72;
end $$;

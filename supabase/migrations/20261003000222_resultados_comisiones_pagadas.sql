-- =============================================================================
-- Resultados cuenta las comisiones que se pagaron antes del arranque.
--
-- Antes del arranque, Resultados solo tomaba las comisiones del libro de compras de la hoja, y ahí
-- nunca se anotaron: se pagaban en efectivo. De febrero de 2025 a septiembre de 2026 hay 43
-- comisiones registradas como pagadas en el ERP (1.49 millones) que no se restaban, así que esos
-- meses salían con más utilidad de la real.
--
-- Ahora, antes del mes del arranque, cuenta lo registrado como pagado en el mes en que se ganó (los
-- planes las calculan sobre los pedidos del mes, y las ventas también cuentan por la fecha del
-- pedido): la comisión queda junto a la venta que la generó, no en el mes en que salió el efectivo.
-- En los meses con comisiones registradas, el libro de la hoja ya no se suma para no contarlas dos
-- veces; en los que no tienen, sigue contando el libro, como antes.
-- =============================================================================

create or replace function public.resultados_periodo(p_desde date, p_hasta date)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_iva numeric := coalesce((select (valor #>> '{}')::numeric from configuracion where clave = 'iva'), 0.16);
  v_prod int := departamento_produccion();
  v_arr date := coalesce((select (valor #>> '{}')::date from configuracion where clave = 'fecha_arranque'), current_date);
  v_mes_arr date;
  v_taller numeric;
  v_res jsonb;
  v_tot jsonb;
begin
  if not (puede('costos', 1) and (puede('finanzas', 1) or puede('analisis', 1))) then
    raise exception 'Los resultados son de dirección y finanzas' using errcode = '42501';
  end if;
  if p_hasta < p_desde then raise exception 'El periodo está al revés'; end if;
  v_mes_arr := date_trunc('month', v_arr)::date;
  -- La nómina de la hoja no separa taller y oficina: se reparte con la proporción de los sueldos de hoy.
  select coalesce(sum(s.sueldo_semanal) filter (where e.departamento_id is not distinct from v_prod) / nullif(sum(s.sueldo_semanal), 0), 0.7)
  into v_taller
  from empleados e
  join lateral (select x.sueldo_semanal from nomina_sueldos x where x.empleado_id = e.id order by x.desde desc limit 1) s on true
  where e.activo;

  with
  -- Ventas. Antes del arranque, las de la hoja (como Análisis), con su familia para la línea y sin IVA
  -- cuando hubo factura; desde el arranque, los pedidos del ERP.
  hoja_ventas as (
    select case when h.familia in ('dosificadoras', 'bandas', 'helicoidales', 'tolvas_silos', 'cribas', 'elevadores') then 'maquinaria'
                when h.familia in ('banda_hule', 'poleas', 'colectores', 'cosedoras') then 'refacciones' else 'otros' end linea,
      case when lower(trim(coalesce(h.factura, ''))) not in ('', '-', 's/f', 'sf', 'n/a') then h.monto / (1 + v_iva) else h.monto end importe
    from historial_ventas_hoja h
    where h.tipo = 'Venta' and h.fecha between p_desde and least(p_hasta, v_arr - 1)
  ),
  lineas as (
    select pl.linea::text linea, pl.importe * p.tipo_cambio importe, pl.cantidad * coalesce(c.costo_material, 0) material,
      coalesce(c.costo_total, 0) > 0 con_costo
    from pedido_lineas pl join pedidos p on p.id = pl.pedido_id
    left join costos_calculados c on c.articulo_id = pl.articulo_id
    where p.fecha between greatest(p_desde, v_arr) and p_hasta and p.estado <> 'cancelado' and not p.historico and pl.importe > 0
  ),
  ventas as (
    select linea, importe from hoja_ventas union all select linea, importe from lineas
  ),
  -- Material/precio de lo vendido con costeo en el último año. El costeo es el de hoy, así que la
  -- muestra es la de hoy aunque el periodo sea viejo.
  muestra as (
    select pl.linea::text linea, sum(pl.importe * p.tipo_cambio) importe, sum(pl.cantidad * c.costo_material) material, count(*) n
    from pedido_lineas pl join pedidos p on p.id = pl.pedido_id
    join costos_calculados c on c.articulo_id = pl.articulo_id and c.costo_total > 0
    where p.fecha > current_date - 365 and p.estado <> 'cancelado' and pl.importe > 0
    group by 1
  ),
  -- Con menos de 10 partidas vendidas la proporción de ventas es ruido: se usa la del catálogo.
  catalogo as (
    select linea_de(c.articulo_id)::text linea, sum(c.costo_material) material, sum(pr.precio) importe
    from costos_calculados c join precios_lista pr on pr.articulo_id = c.articulo_id
    where c.costo_total > 0 and pr.precio > 0 and linea_de(c.articulo_id) is not null
    group by 1
  ),
  proporcion as (
    select coalesce(m.linea, k.linea) linea,
      case when coalesce(m.n, 0) >= 10 then m.material / nullif(m.importe, 0) else k.material / nullif(k.importe, 0) end r,
      case when coalesce(m.n, 0) >= 10 then 'ventas' else 'catalogo' end fuente,
      coalesce(m.n, 0) partidas
    from muestra m full join catalogo k on k.linea = m.linea
  ),
  global as (
    select coalesce((select sum(material) / nullif(sum(importe), 0) from muestra where n >= 10),
                    (select sum(material) / nullif(sum(importe), 0) from catalogo)) r
  ),
  material as (
    select coalesce(sum(l.material) filter (where l.con_costo), 0) exacto,
      coalesce(sum(l.importe * least(greatest(coalesce(p.r, g.r, 0.5), 0.05), 0.95)) filter (where not l.con_costo), 0) estimado,
      coalesce(sum(l.importe) filter (where l.con_costo), 0) ventas_con_costo,
      coalesce(sum(l.importe), 0) ventas_erp
    from lineas l left join proporcion p on p.linea = l.linea cross join global g
  ),
  -- Compras: antes del arranque, el libro de la hoja; desde el arranque, el del ERP. Sin IVA si hubo factura.
  -- Meses de antes del arranque con comisiones registradas como pagadas (de cualquier vendedor): en
  -- esos meses manda lo registrado y el libro de la hoja no se suma, para no contarlas dos veces.
  meses_pagados as (select distinct mes from comision_pagos where pagado_en is not null and mes < v_mes_arr),
  compras_todas as (
    select 'hoja' fuente, h.fecha, h.categoria, h.importe from compras_hoja(p_desde, least(p_hasta, v_arr - 1)) h
    union all
    -- Las ligadas a su orden de compra, por partida con la categoría de su artículo (compras_erp).
    select 'erp', c.fecha, c.categoria, c.importe from compras_erp(greatest(p_desde, v_arr), p_hasta) c
  ),
  compras as (
    select tipo_categoria_compra(c.categoria) tipo, min(c.categoria) categoria, lower(trim(c.categoria)) llave,
      sum(c.importe) importe
    from compras_todas c
    -- Desde el mes del arranque la comisión la calcula la regla (comisiones_mes); antes, la que se pagó:
    -- la registrada en Comisiones y, en los meses que no tienen ninguna, la del libro de la hoja.
    where not (lower(trim(c.categoria)) = 'comisiones'
               and (c.fecha >= v_mes_arr or date_trunc('month', c.fecha)::date in (select mes from meses_pagados)))
      -- En el ERP los sueldos salen de nómina, no del libro de compras.
      and not (c.fuente = 'erp' and tipo_categoria_compra(c.categoria) = 'nomina')
    group by 1, 3
  ),
  -- Sueldos del ERP (desde el arranque): días de semanas cerradas con lo pagado; los demás, con el
  -- sueldo semanal ÷ 7 (antes de su primer sueldo registrado, ese primero).
  dias as (select d::date dia from generate_series(greatest(p_desde, v_arr), p_hasta, interval '1 day') d),
  cerradas as (select inicio from nomina_semanas where estado = 'cerrada' and inicio between greatest(p_desde, v_arr) - 6 and p_hasta),
  estimado as (
    select (e.departamento_id is not distinct from v_prod) taller, sum(s.sueldo_semanal / 7) importe
    from dias d
    join empleados e on e.fecha_ingreso <= d.dia and (e.activo or e.baja_en >= d.dia)
    join lateral (select x.sueldo_semanal from nomina_sueldos x where x.empleado_id = e.id
                  order by (x.desde <= d.dia) desc, case when x.desde <= d.dia then x.desde end desc, x.desde limit 1) s on true
    where not exists (select 1 from cerradas c where d.dia between c.inicio and c.inicio + 6)
    group by 1
  ),
  real as (
    select (e.departamento_id is not distinct from v_prod) taller,
      sum(n.total_percepciones * (least(c.inicio + 6, p_hasta) - greatest(c.inicio, p_desde, v_arr) + 1) / 7.0) importe
    from cerradas c join nomina_renglones n on n.semana = c.inicio join empleados e on e.id = n.empleado_id
    group by 1
  ),
  hoja_nomina as (select coalesce(sum(importe), 0) importe from compras where tipo = 'nomina'),
  comisiones as (
    select coalesce(sum(c.total), 0) importe
    from generate_series(greatest(date_trunc('month', p_desde)::date, v_mes_arr), date_trunc('month', p_hasta)::date, interval '1 month') g
    cross join lateral comisiones_mes(g::date) c
  ),
  -- Antes del arranque, lo que se pagó a cada vendedor en el mes en que lo ganó (sus pedidos de ese
  -- mes), aunque se haya pagado después y en efectivo: la comisión es gasto de la venta que la generó.
  -- Un mes empezado cuenta completo, como con la regla. Mismo filtro que comisiones_mes.
  pagadas as (
    select coalesce(sum(cp.total), 0) importe from comision_pagos cp
    where cp.pagado_en is not null and cp.mes < v_mes_arr
      and cp.mes between date_trunc('month', p_desde)::date and date_trunc('month', p_hasta)::date
      and (cp.vendedor_id = auth.uid() or puede('ventas', 3) or puede('comisiones', 1))
  ),
  hoja_comisiones as (select coalesce(sum(importe), 0) importe from compras where llave = 'comisiones')
  select jsonb_build_object(
    'periodo', jsonb_build_object('desde', p_desde, 'hasta', p_hasta),
    'arranque', v_arr,
    'usa_hoja', p_desde < v_arr,
    'ventas', (select coalesce(jsonb_agg(jsonb_build_object('linea', linea, 'importe', round(s, 2)) order by s desc), '[]')
               from (select linea, sum(importe) s from ventas group by linea) z),
    'ventas_total', (select round(coalesce(sum(importe), 0), 2) from ventas),
    'ventas_hoja', (select round(coalesce(sum(importe), 0), 2) from hoja_ventas),
    'material', (select jsonb_build_object('exacto', round(exacto, 2), 'estimado', round(estimado, 2),
                  'cobertura', round(ventas_con_costo / nullif(ventas_erp, 0), 4),
                  -- En la historia no hay costeo de lo vendido: el material es lo que se compró de material.
                  'comprado_hoja', (select round(coalesce(sum(importe), 0), 2) from compras_todas t
                                    where t.fuente = 'hoja' and tipo_categoria_compra(t.categoria) = 'material')) from material),
    'proporcion', (select coalesce(jsonb_object_agg(linea, jsonb_build_object('r', round(r, 4), 'fuente', fuente, 'partidas', partidas)), '{}')
                   from proporcion where r is not null and linea is not null),
    'proporcion_global', (select round(r, 4) from global),
    'proporcion_taller', round(v_taller, 4),
    'mano_obra', jsonb_build_object('estimado', (select round(coalesce(sum(importe), 0), 2) from estimado where taller),
                                    'real', (select round(coalesce(sum(importe), 0), 2) from real where taller),
                                    'hoja', (select round(importe * v_taller, 2) from hoja_nomina)),
    'sueldos_oficina', jsonb_build_object('estimado', (select round(coalesce(sum(importe), 0), 2) from estimado where not taller),
                                          'real', (select round(coalesce(sum(importe), 0), 2) from real where not taller),
                                          'hoja', (select round(importe * (1 - v_taller), 2) from hoja_nomina)),
    'semanas_cerradas', (select count(*) from cerradas),
    'comisiones', (select round(importe, 2) from comisiones) + (select round(importe, 2) from pagadas) + (select round(importe, 2) from hoja_comisiones),
    'comisiones_hoja', (select round(importe, 2) from hoja_comisiones),
    'comisiones_pagadas', (select round(importe, 2) from pagadas),
    -- comisiones_mes solo da las de todos a quien ve comisiones; a los demás, las suyas (cero).
    'comisiones_completas', puede('comisiones', 1) or puede('ventas', 3),
    'fabricacion', (select coalesce(jsonb_agg(jsonb_build_object('categoria', categoria, 'importe', round(importe, 2)) order by importe desc), '[]') from compras where tipo = 'fabricacion'),
    'operacion', (select coalesce(jsonb_agg(jsonb_build_object('categoria', categoria, 'importe', round(importe, 2)) order by importe desc), '[]') from compras where tipo = 'operacion' and llave <> 'comisiones'),
    'impuestos', (select coalesce(jsonb_agg(jsonb_build_object('categoria', categoria, 'importe', round(importe, 2)) order by importe desc), '[]') from compras where tipo in ('impuestos', 'financiero')),
    'fuera', (select coalesce(jsonb_agg(jsonb_build_object('categoria', categoria, 'importe', round(importe, 2)) order by importe desc), '[]') from compras where tipo = 'fuera'),
    'nomina_hoja', (select round(importe, 2) from hoja_nomina),
    'material_comprado', (select round(coalesce(sum(importe), 0), 2) from compras_todas t where t.fuente = 'erp' and tipo_categoria_compra(t.categoria) = 'material'),
    'compras_erp', (select jsonb_build_object('con_orden', round(coalesce(sum(c.importe) filter (where c.con_orden), 0), 2),
                      'sin_orden', round(coalesce(sum(c.importe) filter (where not c.con_orden), 0), 2),
                      'sin_articulo', round(coalesce(sum(c.importe) filter (where c.sin_articulo), 0), 2))
                    from compras_erp(greatest(p_desde, v_arr), p_hasta) c),
    'caja_chica', (select round(coalesce(-sum(importe), 0), 2) from caja_chica where tipo = 'salida' and fecha between p_desde and p_hasta),
    -- Lo que Mercado Libre se queda de cada venta (comisión, envío que paga Hegamex, otros cargos).
    -- Las retenciones no: son impuestos a cuenta, no gasto.
    'mercado_libre', (select round(coalesce(sum(comision + envio + otros), 0), 2) from ml_pagos
                      where estado = 'approved' and (pagado_en at time zone 'America/Mexico_City')::date between p_desde and p_hasta),
    -- Las guías que pagamos (Envíos), por la fecha en que salió el paquete.
    'envios', (select round(coalesce(sum(costo_real), 0), 2) from envios
               where estado <> 'cancelado' and coalesce(enviado_en, guia_en, solicitado_en) is not null
                 and (coalesce(enviado_en, guia_en, solicitado_en) at time zone 'America/Mexico_City')::date between p_desde and p_hasta),
    'sin_clasificar', (select coalesce(jsonb_agg(distinct t.categoria), '[]') from compras_todas t
                       where t.categoria <> 'Sin categoría'
                         and not exists (select 1 from compras_categorias k where k.categoria = lower(trim(t.categoria)))),
    'sin_categoria', (select round(coalesce(sum(importe), 0), 2) from compras_todas where categoria = 'Sin categoría'),
    -- Desde cuándo tiene datos cada fuente: un periodo anterior sale incompleto y la pantalla lo dice.
    'desde_compras', least((select min(fecha) from historial_compras_2018_2021), (select min(fecha) from historial_compras_hoja where tipo = 'Compra'),
                           (select min(fecha) from movimientos_proveedor where tipo = 'compra')),
    'desde_caja', (select min(fecha) from caja_chica),
    'desde_ventas', least((select min(fecha) from historial_ventas_hoja), (select min(fecha) from pedidos)),
    'sin_sueldo', (select count(*) from empleados e where e.activo and not exists (select 1 from nomina_sueldos s where s.empleado_id = e.id))
  ) into v_res;

  -- Los totales los da la base para que la pantalla no saque su propia utilidad.
  select jsonb_build_object(
    'material', mat, 'mano_obra', mo, 'gastos_fabricacion', gf, 'costo_fabricacion', mat + mo + gf,
    'sueldos_oficina', so, 'compras_operacion', co,
    'gastos_operacion', so + com + co + caja + ml + env,
    'utilidad_operacion', ven - (mat + mo + gf) - (so + com + co + caja + ml + env),
    'impuestos_financieros', imp,
    'utilidad', ven - (mat + mo + gf) - (so + com + co + caja + ml + env) - imp,
    'fuera', fue)
  into v_tot
  from (select (v_res->>'ventas_total')::numeric ven,
          (v_res#>>'{material,exacto}')::numeric + (v_res#>>'{material,estimado}')::numeric + (v_res#>>'{material,comprado_hoja}')::numeric mat,
          (v_res#>>'{mano_obra,estimado}')::numeric + (v_res#>>'{mano_obra,real}')::numeric + (v_res#>>'{mano_obra,hoja}')::numeric mo,
          (select coalesce(sum((x->>'importe')::numeric), 0) from jsonb_array_elements(v_res->'fabricacion') x) gf,
          (v_res#>>'{sueldos_oficina,estimado}')::numeric + (v_res#>>'{sueldos_oficina,real}')::numeric + (v_res#>>'{sueldos_oficina,hoja}')::numeric so,
          (v_res->>'comisiones')::numeric com,
          (select coalesce(sum((x->>'importe')::numeric), 0) from jsonb_array_elements(v_res->'operacion') x) co,
          (v_res->>'caja_chica')::numeric caja, (v_res->>'mercado_libre')::numeric ml, (v_res->>'envios')::numeric env,
          (select coalesce(sum((x->>'importe')::numeric), 0) from jsonb_array_elements(v_res->'impuestos') x) imp,
          (select coalesce(sum((x->>'importe')::numeric), 0) from jsonb_array_elements(v_res->'fuera') x) fue) z;
  return v_res || jsonb_build_object('totales', v_tot);
end $$;
revoke execute on function public.resultados_periodo(date, date) from public, anon;
grant execute on function public.resultados_periodo(date, date) to authenticated;

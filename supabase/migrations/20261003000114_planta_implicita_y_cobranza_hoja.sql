-- 1) Un embarque con el vacío devuelto o la cuenta de gastos ya está en planta.
--
-- La fase salía solo de los hitos, y "vacío devuelto" y "cuenta de gastos" no lo son
-- (no mueven la mercancía). Pero en FCL el vacío solo se devuelve después de descargar
-- en planta, y el agente manda la cuenta de gastos cuando ya despachó y entregó. Si
-- alguien anotó esos pasos y no el de "En planta" (como EMB-2026-00001, cargado de los
-- correos, que no traían ese día), el tablero lo dejaba en puerto pidiendo "Recibir en
-- planta" con el vacío ya devuelto. Ahora cuentan como prueba de que llegó; el día de
-- llegada se queda vacío hasta que alguien lo anote, porque no lo sabemos.
create or replace view public.v_embarque_etapa with (security_invoker = true) as
select b.id as embarque_id,
  case when b.cancelado then 'cancelado' else coalesce(et.fase, 'cotizando') end as fase,
  et.tipo as etapa, et.nombre as etapa_nombre,
  coalesce(ev.fechas, '{}'::jsonb) as fechas,
  f.arribo, f.despacho, f.en_planta, f.vacio,
  case when f.arribo is not null then coalesce(f.despacho, f.en_planta, (now() at time zone 'America/Mexico_City')::date) - f.arribo end as dias_en_puerto,
  case when f.arribo is not null and b.modalidad in ('fcl', 'consolidado')
       then coalesce(f.vacio, (now() at time zone 'America/Mexico_City')::date) - f.arribo end as dias_contenedor,
  case when f.en_planta is not null then f.en_planta
       when f.despacho is not null then f.despacho + 1
       when f.arribo is not null then greatest(f.arribo + public.dias_puerto_tipicos(), (now() at time zone 'America/Mexico_City')::date)
       when b.eta is not null then b.eta + public.dias_puerto_tipicos() end as llegada_planta_estimada,
  coalesce(ev.cambios_eta, 0) as cambios_eta
from public.embarques b
left join lateral (
  select jsonb_object_agg(e.tipo, e.fecha) filter (where x.tipo is not null) as fechas,
    max(case when x.hito then x.orden
             when x.fase = 'planta' then (select p.orden from public.etapas_importacion p where p.tipo = 'en_planta') end) as orden_hito,
    count(*) filter (where e.tipo = 'cambio_eta') as cambios_eta
  from public.embarque_eventos e left join public.etapas_importacion x on x.tipo = e.tipo
  where e.embarque_id = b.id
) ev on true
left join public.etapas_importacion et on et.orden = ev.orden_hito
cross join lateral (select (ev.fechas->>'arribo')::date as arribo, (ev.fechas->>'despacho')::date as despacho,
                           (ev.fechas->>'en_planta')::date as en_planta, (ev.fechas->>'vacio_devuelto')::date as vacio) f;

-- 2) "Por cobrar" con lo que los clientes ya debían en la hoja.
--
-- Todos los pedidos de hoy son de la hoja (historico) y su dinero vive en el saldo de
-- arranque, así que Inicio, Cobranza y la ficha del cliente decían "$0 por cobrar"
-- con más de 8 millones pendientes. Esto da el saldo de la hoja con su antigüedad para
-- sumarlo donde se muestra lo que nos deben. La antigüedad es de primeras entradas,
-- primeras salidas: los pagos liquidan las ventas más viejas, así que lo que se debe
-- son las ventas más recientes, y su fecha es desde cuándo se debe.
-- Con los permisos de quien pregunta: un vendedor ve solo lo de sus clientes.
create or replace function public.saldo_arranque_antiguedad() returns jsonb
language sql stable security invoker set search_path = public as $$
  with s as (select cliente_id, saldo from v_saldo_arranque_clientes where saldo > 1),
  v as (
    select h.cliente_id, h.fecha, h.monto, s.saldo,
      sum(h.monto) over (partition by h.cliente_id order by h.fecha desc, h.id desc) - h.monto as despues
    from historial_ventas_hoja h join s on s.cliente_id = h.cliente_id
    where h.tipo = 'Venta' and h.monto > 0),
  a as (select fecha, least(monto, saldo - despues) as debe from v where despues < saldo)
  select jsonb_build_object(
    'total', (select coalesce(sum(saldo), 0) from s),
    'clientes', (select count(*) from s),
    'rangos', jsonb_build_object(
      '0-30', coalesce(sum(debe) filter (where hoy_planta() - fecha <= 30), 0),
      '31-60', coalesce(sum(debe) filter (where hoy_planta() - fecha between 31 and 60), 0),
      '61-90', coalesce(sum(debe) filter (where hoy_planta() - fecha between 61 and 90), 0),
      '90+', coalesce(sum(debe) filter (where hoy_planta() - fecha > 90), 0)))
  from a
$$;
revoke execute on function public.saldo_arranque_antiguedad() from public, anon;
grant execute on function public.saldo_arranque_antiguedad() to authenticated;

-- 3) "Cobrado por mes" con los pagos de la hoja y los cobros a su saldo.
-- Solo contaba cobros de pedidos del ERP: con todos los pedidos de la hoja, la gráfica
-- salía en $0 todo el año aunque la hoja trae cada pago. Los cobros al saldo de la hoja
-- que también aparecen en la hoja (en_hoja) no se suman dos veces.
create or replace function public.cobranza_por_mes(p_meses int default 12)
returns table (mes date, cobrado numeric, facturado numeric, cobros bigint)
language sql stable security invoker set search_path = public as $$
  with m as (
    select g::date mes from generate_series(date_trunc('month', current_date) - make_interval(months => p_meses - 1),
                                            date_trunc('month', current_date), interval '1 month') g
  ),
  c as (
    select c.fecha, c.monto * p.tipo_cambio as monto from cobros c join pedidos p on p.id = c.pedido_id
    union all select h.fecha, h.monto from historial_ventas_hoja h where h.tipo = 'Pago'
    union all select s.fecha, s.monto from v_cobros_saldo_hoja s where not s.en_hoja
  ),
  f as (
    select f.fecha, f.total * p.tipo_cambio as monto from facturas f join pedidos p on p.id = f.pedido_id
    union all select h.fecha, h.monto from historial_ventas_hoja h where h.tipo = 'Venta'
  )
  select m.mes,
    coalesce((select sum(c.monto) from c where c.fecha >= m.mes and c.fecha < m.mes + interval '1 month'), 0),
    coalesce((select sum(f.monto) from f where f.fecha >= m.mes and f.fecha < m.mes + interval '1 month'), 0),
    (select count(*) from c where c.fecha >= m.mes and c.fecha < m.mes + interval '1 month')
  from m order by m.mes
$$;

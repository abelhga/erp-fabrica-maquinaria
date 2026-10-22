-- =============================================================================
-- Calendario: todo lo que tiene fecha en el ERP, para cada quien lo suyo.
--
-- Las fechas ya existían regadas por los módulos (la entrega del pedido, cuándo llega una
-- compra o un embarque, el preventivo de una máquina, un pago, unas vacaciones, un
-- pendiente) y cada quien las buscaba pantalla por pantalla. calendario() las junta en un
-- solo lugar. No guarda nada: lee de donde ya están.
--
-- Corre con los permisos de quien pregunta (security invoker): cada fuente pasa por su
-- propia RLS, así que un vendedor ve sus pedidos y no las compras, y nadie ve un pago sin
-- finanzas. Donde una tabla deja leer de más para un calendario (todos los pendientes a
-- dirección, todos los contactos a ventas), se recorta a lo de la persona.
--
-- Solo lo que sigue abierto: lo que ya se entregó, se recibió o se cerró no estorba. Lo
-- abierto con fecha pasada sale en rojo (tono «peligro»): es lo atrasado.
-- mio = está a tu nombre (tu pedido, tu pendiente, tu cuadrilla, tus vacaciones…).
-- =============================================================================

create or replace function public.calendario(p_desde date, p_hasta date)
returns table (clave text, tipo text, area text, fecha date, fecha_fin date, hora text, titulo text,
               detalle text, ruta text, tono text, mio boolean)
language plpgsql security invoker set search_path = public as $$
#variable_conflict use_column
declare
  v_yo uuid := auth.uid();
  v_hoy date := hoy_mx();
  v_ventas boolean := puede('ventas', 1);
  v_mi_etapa int := (select e.etapa_id from empleados e where e.usuario_id = auth.uid() and e.activo limit 1);
begin
  if p_desde is null or p_hasta is null or p_hasta < p_desde then raise exception 'El periodo está al revés'; end if;
  -- Un mes con sus orillas cabe de sobra; más que eso ya no es un calendario y el plan pesa.
  if p_hasta - p_desde > 124 then raise exception 'El calendario se pide de a lo más cuatro meses'; end if;

  -- Ventas -------------------------------------------------------------------------------
  return query
  select 'entrega:' || p.id, 'entrega', 'ventas', p.fecha_compromiso, null::date, null::text,
    'Entrega ' || p.folio || coalesce(' · ' || c.nombre, ''),
    case p.estado when 'listo' then 'Listo para entregar' when 'en_produccion' then 'En producción' else 'Confirmado' end,
    case when v_ventas then '/ventas/pedidos/' || p.id else '/produccion/pedidos' end,
    case when p.fecha_compromiso < v_hoy then 'peligro' when p.estado = 'listo' then 'ok' else 'neutro' end,
    p.vendedor_id = v_yo
  from pedidos p left join clientes c on c.id = p.cliente_id
  where p.estado in ('confirmado', 'en_produccion', 'listo') and not p.historico
    and p.fecha_compromiso between p_desde and p_hasta;

  return query
  select 'oportunidad:' || o.id, 'oportunidad', 'ventas', o.fecha_cierre_estimada, null::date, null::text,
    'Cierre esperado: ' || o.titulo, c.nombre, '/ventas/oportunidades'::text,
    case when o.fecha_cierre_estimada < v_hoy then 'aviso' else 'neutro' end, o.vendedor_id = v_yo
  from oportunidades o left join clientes c on c.id = o.cliente_id
  where o.cerrada_en is null and o.etapa not in ('ganada', 'perdida')
    and o.fecha_cierre_estimada between p_desde and p_hasta;

  return query
  select 'actividad:' || a.id, 'actividad', 'ventas', a.vence_en, null::date, null::text,
    initcap(a.tipo) || coalesce(' · ' || c.nombre, ''), a.descripcion,
    case when a.cliente_id is not null then '/ventas/clientes/' || a.cliente_id else '/ventas/oportunidades' end,
    case when a.vence_en < v_hoy then 'peligro' else 'neutro' end, a.usuario_id = v_yo
  from actividades a left join clientes c on c.id = a.cliente_id
  where not a.hecha and a.vence_en between p_desde and p_hasta
    -- La gerencia ve las de todos en Clientes; en su calendario, las suyas.
    and a.usuario_id = v_yo;

  -- «Volver a llamar»: solo cuenta lo último que se anotó de cada cliente (si se volvió a
  -- llamar después, la fecha vieja ya no aplica). Ventas puede leer los de todos; aquí, los tuyos.
  return query
  select 'llamar:' || r.cliente_id, 'llamar', 'ventas', r.volver_el, null::date, null::text,
    'Llamar a ' || coalesce(c.nombre, 'cliente'), r.razon, '/ventas/clientes/' || r.cliente_id,
    case when r.volver_el < v_hoy then 'aviso' else 'neutro' end, true
  from (select distinct on (x.cliente_id) x.* from resultados_contacto x where x.usuario_id = v_yo order by x.cliente_id, x.en desc) r
  left join clientes c on c.id = r.cliente_id
  where r.volver_el between p_desde and p_hasta;

  return query
  select 'devolucion:' || d.id, 'devolucion', 'ventas', d.fecha_esperada, null::date, null::text,
    'Llega ' || case d.tipo when 'reclamo' then 'reclamo ' when 'cancelacion' then 'cancelación ' else 'devolución ' end || d.folio,
    d.motivo, '/ventas/devoluciones'::text, case when d.fecha_esperada < v_hoy then 'aviso' else 'neutro' end, d.responsable_id = v_yo
  from devoluciones d
  where d.estado in ('abierta', 'respondida') and d.fecha_esperada between p_desde and p_hasta;

  -- Producción (la planta; el vendedor ya tiene la entrega de su pedido) ------------------
  if puede('produccion', 2) or puede('procesos', 1) then
    return query
    select 'compromiso:' || o.id, 'compromiso', 'produccion', o.fecha_compromiso, null::date, null::text,
      'Compromiso ' || regexp_replace(o.folio, '^([A-Z]+)-\d{4}-', '\1-') || ' · ' || a.nombre,
      coalesce((select p.folio from pedidos p where p.id = o.pedido_id), 'Para stock'),
      '/produccion/ordenes/' || o.id, case when o.fecha_compromiso < v_hoy then 'peligro' else 'neutro' end, false
    from ordenes_produccion o join articulos a on a.id = o.articulo_id
    where o.estado in ('planeada', 'liberada', 'en_proceso') and o.en_espera_motivo is null
      and o.fecha_compromiso between p_desde and p_hasta;

    -- Del plan del taller (el mismo del Gantt): cuándo termina cada orden y qué entra a cada área.
    drop table if exists _cal_plan;
    create temp table _cal_plan on commit drop as select * from plan_produccion();

    return query
    select 'fin_plan:' || o.id, 'fin_plan', 'produccion', z.fin, null::date, null::text,
      'Termina ' || regexp_replace(o.folio, '^([A-Z]+)-\d{4}-', '\1-') || ' (plan) · ' || a.nombre,
      case when o.fecha_compromiso is null then 'Sin fecha compromiso'
           when z.fin > o.fecha_compromiso then (z.fin - o.fecha_compromiso) || ' días después del compromiso (' || to_char(o.fecha_compromiso, 'DD/MM') || ')'
           else 'A tiempo para el compromiso (' || to_char(o.fecha_compromiso, 'DD/MM') || ')' end,
      '/produccion/ordenes/' || o.id,
      case when o.fecha_compromiso is not null and z.fin > o.fecha_compromiso then 'peligro' else 'ok' end, false
    from (select pl.orden_id, max(coalesce(pl.fin_plan, (pl.fin_real at time zone 'America/Mexico_City')::date)) fin
          from _cal_plan pl where pl.posicion is not null group by pl.orden_id
          having bool_and(pl.estado = 'terminada' or pl.fin_plan is not null)) z
    join ordenes_produccion o on o.id = z.orden_id join articulos a on a.id = o.articulo_id
    where z.fin between p_desde and p_hasta;

    return query
    select 'arranque:' || pl.etapa_id || ':' || pl.inicio_plan, 'arranque', 'produccion', pl.inicio_plan, null::date, null::text,
      'Entran a ' || et.nombre || ': ' || string_agg(regexp_replace(o.folio, '^([A-Z]+)-\d{4}-', '\1-'), ', ' order by pl.posicion),
      count(*) || case when count(*) = 1 then ' orden' else ' órdenes' end || ' según el plan',
      '/produccion/gantt'::text, 'neutro'::text, coalesce(pl.etapa_id = v_mi_etapa, false)
    from _cal_plan pl join etapas et on et.id = pl.etapa_id join ordenes_produccion o on o.id = pl.orden_id
    where pl.estado = 'pendiente' and pl.inicio_plan between p_desde and p_hasta
    group by pl.etapa_id, et.nombre, pl.inicio_plan;
  end if;

  -- Compras, almacén e importaciones -------------------------------------------------------
  return query
  select 'requisicion:' || r.id, 'requisicion', 'compras', r.necesaria_para, null::date, null::text,
    'Material para ' || r.folio, r.notas, '/compras/ordenes?vista=requisiciones'::text,
    case when r.necesaria_para < v_hoy then 'peligro' else 'neutro' end, r.solicitante_id = v_yo
  from requisiciones r
  where r.estado in ('abierta', 'en_compra') and r.necesaria_para between p_desde and p_hasta;

  return query
  select 'compra:' || oc.id, 'compra', 'compras', oc.fecha_entrega, null::date, null::text,
    'Llega ' || oc.folio || coalesce(' · ' || pr.nombre, ''),
    case oc.estado when 'parcial' then 'Llegó una parte' else 'Por recibir' end, '/compras/ordenes/' || oc.id,
    case when oc.fecha_entrega < v_hoy then 'peligro' else 'neutro' end, oc.creado_por = v_yo
  from ordenes_compra oc left join proveedores pr on pr.id = oc.proveedor_id
  where oc.estado in ('enviada', 'parcial') and oc.fecha_entrega between p_desde and p_hasta;

  return query
  select 'puerto:' || b.id, 'embarque', 'importaciones', b.eta, null::date, null::text,
    b.folio || ' llega a puerto', coalesce(b.descripcion, b.puerto_destino), '/importaciones/' || b.id,
    case when b.eta < v_hoy then 'aviso' else 'neutro' end, b.creado_por = v_yo
  from embarques b join v_embarque_etapa ve on ve.embarque_id = b.id
  where not b.cancelado and ve.arribo is null and b.eta between p_desde and p_hasta;

  return query
  select 'planta:' || b.id, 'embarque', 'importaciones', ve.llegada_planta_estimada, null::date, null::text,
    b.folio || ' llega a planta (estimado)', b.descripcion, '/importaciones/' || b.id, 'info'::text, b.creado_por = v_yo
  from embarques b join v_embarque_etapa ve on ve.embarque_id = b.id
  where not b.cancelado and ve.en_planta is null and ve.llegada_planta_estimada between p_desde and p_hasta;

  return query
  select 'recoleccion:' || e.id, 'recoleccion', 'compras', e.fecha_recoleccion, null::date, null::text,
    'Recolección ' || e.folio || coalesce(' · ' || coalesce(e.dest_empresa, e.destinatario), ''), e.destino, '/almacen/envios'::text,
    case when e.fecha_recoleccion < v_hoy then 'peligro' else 'neutro' end, e.solicitado_por = v_yo
  from envios e
  where e.estado in ('solicitado', 'cotizado', 'guia_lista', 'empacado') and e.fecha_recoleccion between p_desde and p_hasta;

  -- Servicio y mantenimiento ---------------------------------------------------------------
  return query
  select 'servicio:' || s.id, 'servicio', 'servicio', (s.inicio at time zone 'America/Mexico_City')::date,
    nullif((coalesce(s.fin, s.inicio) at time zone 'America/Mexico_City')::date, (s.inicio at time zone 'America/Mexico_City')::date),
    to_char(s.inicio at time zone 'America/Mexico_City', 'HH24:MI'),
    'Servicio ' || s.folio || coalesce(' · ' || s.equipo, ''), s.lugar, '/servicio/' || s.id,
    case when s.estado = 'en_curso' then 'marca' else 'neutro' end,
    s.programado_por = v_yo or exists (select 1 from servicio_cuadrilla q join empleados e on e.id = q.empleado_id
                                      where q.servicio_id = s.id and q.vigente and e.usuario_id = v_yo)
  from servicios s
  where s.estado in ('programada', 'en_curso') and s.inicio is not null
    and (s.inicio at time zone 'America/Mexico_City')::date <= p_hasta
    and (coalesce(s.fin, s.inicio) at time zone 'America/Mexico_City')::date >= p_desde;

  return query
  select 'servicio_pedido:' || s.id, 'servicio_pedido', 'servicio', s.fecha_deseada, null::date, null::text,
    'Servicio pedido ' || s.folio || coalesce(' · ' || s.equipo, ''), 'Falta programarlo', '/servicio/' || s.id,
    'aviso'::text, s.solicitado_por = v_yo
  from servicios s
  where s.estado = 'solicitada' and s.fecha_deseada between p_desde and p_hasta;

  return query
  select 'preventivo:' || om.id, 'preventivo', 'servicio', om.vence, null::date, null::text,
    'Preventivo ' || m.numero || ' · ' || m.nombre, om.folio, '/servicio/maquinas/' || m.id,
    case when om.vence < v_hoy then 'peligro' else 'neutro' end, m.asignada_a = v_yo
  from ordenes_mantenimiento om join maquinas m on m.id = om.maquina_id
  where om.tipo = 'preventivo' and om.estado in ('pendiente', 'en_proceso') and om.vence between p_desde and p_hasta;

  return query
  select 'resguardo:' || r.id, 'resguardo', 'servicio', r.devolver_en, null::date, null::text,
    'Devolver ' || m.nombre, coalesce(e.nombre, r.persona), '/servicio/resguardos'::text,
    case when r.devolver_en < v_hoy then 'peligro' else 'neutro' end, e.usuario_id = v_yo
  from resguardos r join maquinas m on m.id = r.maquina_id left join empleados e on e.id = r.empleado_id
  where r.devuelto_en is null and r.devolver_en between p_desde and p_hasta;

  -- Finanzas: lo que vence de pagar (no lo ve quien no tiene finanzas, aunque vea la orden).
  if puede('finanzas', 1) then
    return query
    select 'pago:' || pp.orden_compra_id, 'pago', 'finanzas', pp.vence_pago, null::date, null::text,
      'Pagar ' || pp.folio || coalesce(' · ' || pp.proveedor, ''),
      'Saldo $' || to_char(pp.saldo, 'FM999,999,999,990.00') || ' ' || pp.moneda, '/finanzas/pagos'::text,
      case when pp.vence_pago < v_hoy then 'peligro' when pp.vence_pago <= v_hoy + 3 then 'aviso' else 'neutro' end, false
    from v_por_pagar pp
    where pp.saldo > 0 and pp.vence_pago between p_desde and p_hasta;
  end if;

  -- Personas -------------------------------------------------------------------------------
  -- Ausencias: las ve RRHH, la gerencia de producción las de su gente y cada quien las suyas
  -- (lo decide la RLS de incidencias).
  return query
  select 'ausencia:' || i.id, 'ausencia', 'rrhh', i.inicio, nullif(coalesce(i.fin, i.inicio), i.inicio), null::text,
    split_part(e.nombre, ' ', 1) || coalesce(' ' || nullif(split_part(e.nombre, ' ', 2), ''), '') || ' · ' ||
      case i.tipo when 'vacaciones' then 'Vacaciones' when 'incapacidad' then 'Incapacidad' else 'Permiso' end,
    case when i.estado = 'solicitada' then 'Por autorizar' end, '/rrhh/incidencias'::text,
    case when i.estado = 'solicitada' then 'aviso' else 'info' end, e.usuario_id = v_yo
  from incidencias i join empleados e on e.id = i.empleado_id
  where i.tipo in ('vacaciones', 'permiso_con_goce', 'permiso_sin_goce', 'incapacidad') and i.estado <> 'rechazada'
    and i.inicio <= p_hasta and coalesce(i.fin, i.inicio) >= p_desde;

  -- Cumpleaños de la gente que ya puedes ver (un 29 de febrero se festeja el 28 si el año no es bisiesto).
  return query
  select 'cumple:' || e.id || ':' || d.dia, 'cumpleanos', 'rrhh', d.dia, null::date, null::text,
    'Cumpleaños de ' || split_part(e.nombre, ' ', 1) || coalesce(' ' || nullif(split_part(e.nombre, ' ', 2), ''), ''),
    null::text, case when puede('rrhh', 1) then '/rrhh/empleados' end, 'info'::text, e.usuario_id = v_yo
  from empleados e
  cross join lateral (
    select (make_date(y, extract(month from e.fecha_nacimiento)::int, 1)
            + (least(extract(day from e.fecha_nacimiento)::int,
                     extract(day from (make_date(y, extract(month from e.fecha_nacimiento)::int, 1) + interval '1 month - 1 day'))::int) - 1))::date dia
    from generate_series(extract(year from p_desde)::int, extract(year from p_hasta)::int) y
  ) d
  where e.activo and e.baja_en is null and e.fecha_nacimiento is not null and d.dia between p_desde and p_hasta;

  -- Pendientes: los que te tocan y los que pediste (dirección puede leerlos todos; en su
  -- calendario, solo los suyos).
  return query
  select 'pendiente:' || p.id, 'pendiente', 'personal', p.vence, null::date, null::text,
    p.titulo,
    case when p.responsable_id = v_yo then p.detalle else 'Le toca a ' || coalesce(pf.nombre, 'otra persona') end,
    coalesce(p.ruta, '/pendientes'), case when p.vence < v_hoy then 'peligro' else 'neutro' end, p.responsable_id = v_yo
  from pendientes p left join perfiles pf on pf.id = p.responsable_id
  where p.estado = 'abierto' and p.vence between p_desde and p_hasta
    and (p.responsable_id = v_yo or p.creado_por = v_yo);
end $$;
revoke execute on function public.calendario(date, date) from public, anon;
grant execute on function public.calendario(date, date) to authenticated;

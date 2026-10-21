-- Órdenes en espera: fuera de la carga del taller hasta que se reactiven.
--
-- Hay pedidos donde el cliente dejó anticipo y desapareció (S075-P652, S091-P691): no se
-- fabrican hasta que regrese, pero como "planeada" sumaban sus horas a la cola del taller,
-- alargaban los tiempos de entrega que se prometen a otros clientes y salían como atrasadas.
-- Cancelarlas tampoco: el cliente pagó y puede volver. Ahora la gerencia de producción las
-- pone en espera con un motivo y las reactiva cuando toca. Mientras tanto no cuentan en la
-- carga, la cola, la capacidad, las atrasadas ni la terminal, y nadie puede marcar sus etapas.

alter table public.ordenes_produccion
  add column if not exists en_espera_motivo text,
  add column if not exists en_espera_desde date,
  add column if not exists en_espera_por uuid references public.perfiles(id);

create or replace function public.poner_en_espera(p_op uuid, p_motivo text) returns void
language plpgsql security definer set search_path = public as $$
declare o ordenes_produccion; v_motivo text := nullif(trim(p_motivo), '');
begin
  if not puede('produccion', 3) then raise exception 'Solo la gerencia de producción pone órdenes en espera' using errcode = '42501'; end if;
  if v_motivo is null then raise exception 'Escribe por qué queda en espera (ej. cliente ausente)'; end if;
  select * into o from ordenes_produccion where id = p_op for update;
  if o.id is null then raise exception 'No existe la orden'; end if;
  if o.estado in ('terminada', 'entregada', 'cancelada') then raise exception 'La orden % ya está cerrada', o.folio; end if;
  update ordenes_produccion set en_espera_motivo = v_motivo, en_espera_desde = hoy_planta(), en_espera_por = auth.uid() where id = p_op;
  -- Lo que se estaba trabajando se pausa: si no, seguiría contando tiempo.
  update op_operaciones set estado = 'pausada' where orden_id = p_op and estado = 'en_proceso';
  insert into op_eventos (orden_id, tipo, nota) values (p_op, 'nota', 'En espera: ' || v_motivo);
end $$;
revoke execute on function public.poner_en_espera(uuid, text) from public, anon;
grant execute on function public.poner_en_espera(uuid, text) to authenticated;

create or replace function public.reactivar_orden(p_op uuid) returns void
language plpgsql security definer set search_path = public as $$
declare o ordenes_produccion;
begin
  if not puede('produccion', 3) then raise exception 'Solo la gerencia de producción reactiva órdenes' using errcode = '42501'; end if;
  select * into o from ordenes_produccion where id = p_op for update;
  if o.id is null then raise exception 'No existe la orden'; end if;
  if o.en_espera_motivo is null then raise exception 'La orden % no está en espera', o.folio; end if;
  update ordenes_produccion set en_espera_motivo = null, en_espera_desde = null, en_espera_por = null where id = p_op;
  insert into op_eventos (orden_id, tipo, nota)
  values (p_op, 'nota', format('Reactivada (estuvo en espera desde el %s: %s)', to_char(o.en_espera_desde, 'DD/MM/YYYY'), o.en_espera_motivo));
end $$;
revoke execute on function public.reactivar_orden(uuid) from public, anon;
grant execute on function public.reactivar_orden(uuid) to authenticated;

-- La terminal no marca etapas de una orden en espera (es la de 040 con esa revisión).
create or replace function public.avanzar_operacion(p_operacion uuid, p_accion text, p_nota text default null, p_responsable text default null)
returns void language plpgsql security definer set search_path = public as $$
declare op op_operaciones; o ordenes_produccion; v_etapa text; v_resp text := nullif(trim(p_responsable), '');
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

  case p_accion
    when 'inicio' then
      if op.estado = 'terminada' then raise exception '% de % ya se terminó', v_etapa, o.folio; end if;
      if op.estado = 'en_proceso' then
        raise exception '% de % ya estaba en proceso%', v_etapa, o.folio, coalesce(' (' || op.responsable || ')', '');
      end if;
      update op_operaciones set estado = 'en_proceso', inicio = coalesce(inicio, now()),
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
      update op_operaciones set estado = 'terminada', fin = now(), inicio = coalesce(inicio, now()),
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

  if p_accion = 'fin' and not exists (select 1 from op_operaciones where orden_id = o.id and estado <> 'terminada') then
    update ordenes_produccion set estado = 'terminada', terminada_en = now() where id = o.id;
    insert into op_eventos (orden_id, tipo) values (o.id, 'terminada');
    -- Si todas las órdenes del pedido terminaron, el pedido queda listo para entregar.
    if o.pedido_id is not null and not exists (select 1 from ordenes_produccion where pedido_id = o.pedido_id
                                               and estado not in ('terminada', 'entregada', 'cancelada')) then
      update pedidos set estado = 'listo' where id = o.pedido_id and estado = 'en_produccion';
    end if;
  end if;
end $$;


-- Todo lo que mide la carga del taller deja fuera las órdenes en espera. Son las mismas
-- definiciones de 040, 080, 085, 109 y 112 con "en_espera_motivo is null" en cada filtro
-- de órdenes abiertas.
create or replace view public.v_carga_etapas with (security_invoker = true) as
select e.id etapa_id, e.nombre, e.color, e.orden, e.capacidad_horas_semana,
  coalesce(t.horas_pendientes, 0) as horas_pendientes,
  coalesce(t.en_proceso, 0) as en_proceso,
  coalesce(t.pausadas, 0) as pausadas,
  coalesce(t.en_espera, 0) as en_espera,
  coalesce(pl.horas, 0) as horas_planeadas
from public.etapas e
left join lateral (
  select sum(x.horas_estimadas) filter (where x.estado <> 'terminada') horas_pendientes,
         count(*) filter (where x.estado = 'en_proceso') en_proceso,
         count(*) filter (where x.estado = 'pausada') pausadas,
         count(*) filter (where x.estado = 'pendiente') en_espera
  from public.op_operaciones x join public.ordenes_produccion o on o.id = x.orden_id
  where x.etapa_id = e.id and o.estado in ('liberada', 'en_proceso') and o.en_espera_motivo is null) t on true
left join lateral (
  select sum(x.horas_estimadas) horas
  from public.op_operaciones x join public.ordenes_produccion o on o.id = x.orden_id
  where x.etapa_id = e.id and o.estado = 'planeada' and o.en_espera_motivo is null) pl on true
where e.activa;

create or replace view public.v_piso_operaciones with (security_invoker = true) as
select x.id, x.orden_id, x.etapa_id, e.nombre as etapa, e.color, e.orden as etapa_orden, x.estado,
  x.horas_estimadas, x.inicio, x.fin, x.responsable,
  t.folio, t.numero_serie, t.clave, t.equipo, t.cliente, t.pedido_folio, t.prioridad, t.fecha_compromiso,
  t.dias_restantes, t.atrasada, t.avance, t.materiales_faltantes, t.estado as orden_estado,
  ant.pendientes is null as lista,
  ant.pendientes as espera_a,
  pr.nota as ultimo_problema, pr.en as ultimo_problema_en
from public.op_operaciones x
join public.etapas e on e.id = x.etapa_id
join public.v_tablero_produccion t on t.id = x.orden_id
left join lateral (
  select string_agg(ey.nombre, ', ' order by ey.orden) pendientes
  from public.op_operaciones y join public.etapas ey on ey.id = y.etapa_id
  where y.orden_id = x.orden_id and ey.orden < e.orden and y.estado <> 'terminada') ant on true
left join lateral (
  select ev.nota, ev.en from public.op_eventos ev
  where ev.operacion_id = x.id and ev.tipo = 'problema' order by ev.en desc, ev.id desc limit 1) pr on true
where t.estado in ('liberada', 'en_proceso') and x.estado <> 'terminada'
  and not exists (select 1 from public.ordenes_produccion oe where oe.id = x.orden_id and oe.en_espera_motivo is not null);

create or replace function public.carga_semanal(p_semanas int default 6, p_desde date default null)
returns table (semana date, etapa_id int, etapa text, color text, orden int, capacidad numeric, horas_servicio numeric,
               capacidad_disponible numeric, horas_produccion numeric, horas_planeadas numeric, carga numeric, saldo numeric,
               ocupacion numeric, servicios jsonb)
language sql stable security definer set search_path = public as $$
  with hoy as (select hoy_planta() d, date_trunc('week', hoy_planta())::date s0),
  sem as (
    select (date_trunc('week', coalesce(p_desde, (select d from hoy)))::date + 7 * g) as semana
    from generate_series(0, greatest(least(coalesce(p_semanas, 6), 26), 1) - 1) g
  ),
  op as (
    select x.etapa_id, x.horas_estimadas h, o.estado = 'planeada' as planeada,
      greatest(hoy.s0, date_trunc('week', coalesce(o.inicio_plan, hoy.d))::date) ini,
      greatest(hoy.s0, date_trunc('week', coalesce(o.fecha_compromiso, hoy.d))::date) fin
    from op_operaciones x join ordenes_produccion o on o.id = x.orden_id cross join hoy
    where o.estado in ('planeada', 'liberada', 'en_proceso') and o.en_espera_motivo is null and x.estado <> 'terminada' and x.horas_estimadas > 0
  ),
  op_sem as (
    select op.etapa_id, s.semana,
      sum(op.h / (((greatest(op.fin, op.ini) - op.ini) / 7) + 1)) filter (where not op.planeada) prod,
      sum(op.h / (((greatest(op.fin, op.ini) - op.ini) / 7) + 1)) filter (where op.planeada) plan
    from op join sem s on s.semana between op.ini and greatest(op.fin, op.ini)
    group by 1, 2
  ),
  srv as (
    select q.etapa_id, date_trunc('week', hl.dia)::date semana, s.id, s.folio, s.tipo,
      sum(hl.horas) h, count(distinct q.empleado_id) personas
    from servicios s join servicio_cuadrilla q on q.servicio_id = s.id and q.vigente
    cross join lateral horas_laborables(lower(q.periodo), upper(q.periodo)) hl
    where s.estado in ('programada', 'en_curso', 'cerrada') and q.etapa_id is not null
      and q.periodo && tstzrange(((select min(semana) from sem)::timestamp) at time zone 'America/Mexico_City',
                                 (((select max(semana) from sem) + 7)::timestamp) at time zone 'America/Mexico_City')
    group by 1, 2, 3, 4, 5
  ),
  srv_sem as (
    select etapa_id, semana, sum(h) h,
      jsonb_agg(jsonb_build_object('id', id, 'folio', folio, 'tipo', tipo, 'horas', round(h, 1), 'personas', personas) order by folio) servicios
    from srv group by 1, 2
  )
  select s.semana, e.id, e.nombre, e.color, e.orden, e.capacidad_horas_semana,
    round(coalesce(v.h, 0), 1), round(e.capacidad_horas_semana - coalesce(v.h, 0), 1),
    round(coalesce(p.prod, 0), 1), round(coalesce(p.plan, 0), 1),
    round(coalesce(p.prod, 0) + coalesce(v.h, 0), 1),
    round(e.capacidad_horas_semana - coalesce(v.h, 0) - coalesce(p.prod, 0), 1),
    case when e.capacidad_horas_semana > 0 then round((coalesce(p.prod, 0) + coalesce(v.h, 0)) / e.capacidad_horas_semana, 3) end,
    coalesce(v.servicios, '[]'::jsonb)
  from sem s cross join etapas e
  left join op_sem p on p.etapa_id = e.id and p.semana = s.semana
  left join srv_sem v on v.etapa_id = e.id and v.semana = s.semana
  where e.activa and (puede('produccion', 1) or puede('servicio', 1))
  order by s.semana, e.orden
$$;

create or replace function public.semana_en_numeros(p_lunes date default null) returns jsonb
language plpgsql stable security invoker set search_path = public as $$
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
    r := r || jsonb_build_object('cobranza', jsonb_build_object(
      'cobrado', (select round(coalesce(sum(co.monto * p.tipo_cambio), 0), 2) from cobros co join pedidos p on p.id = co.pedido_id where co.fecha between v_desde and v_hasta),
      'cobrado_anterior', (select round(coalesce(sum(co.monto * p.tipo_cambio), 0), 2) from cobros co join pedidos p on p.id = co.pedido_id where co.fecha between v_ant_desde and v_ant_hasta)));
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
end $$;

create or replace function public.estimar_entrega(p_lineas jsonb default '[]'::jsonb) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_hoy date := hoy_planta();
  v_estandar int; v_sin_dias text[]; v_equipos int;
  v_etapas jsonb; v_cuello text; v_sem numeric; v_sem_cola numeric; v_cuello_cola text;
  v_dias_carga int; v_dias int;
begin
  if not (puede('ventas', 1) or puede('produccion', 1)) then
    raise exception 'Sin permiso para ver los tiempos de entrega' using errcode = '42501';
  end if;

  select count(*), max(a.dias_fabricacion), array_agg(a.nombre order by a.nombre) filter (where a.dias_fabricacion is null)
  into v_equipos, v_estandar, v_sin_dias
  from lineas_estimacion(p_lineas) l join articulos a on a.id = l.art;

  with recursive arbol(id, cant) as (
    select art, cant from lineas_estimacion(p_lineas)
    union all
    select b.hijo_id, arbol.cant * cantidad_linea(b) from arbol join bom_lineas b on b.padre_id = arbol.id
  ), nuevas as (
    select o.etapa_id, sum(arbol.cant * horas_operacion(o)) horas from arbol join bom_operaciones o on o.articulo_id = arbol.id group by 1
  ), cola as (
    select x.etapa_id, sum(x.horas_estimadas) horas
    from op_operaciones x join ordenes_produccion o on o.id = x.orden_id
    where o.estado in ('planeada', 'liberada', 'en_proceso') and o.en_espera_motivo is null and x.estado <> 'terminada'
    group by 1
  ), e as (
    select et.nombre, et.orden, coalesce(c.horas, 0) / et.capacidad_horas_semana sem_cola,
      (coalesce(c.horas, 0) + coalesce(n.horas, 0)) / et.capacidad_horas_semana sem
    from etapas et left join cola c on c.etapa_id = et.id left join nuevas n on n.etapa_id = et.id
    where et.activa and et.capacidad_horas_semana > 0
  )
  select jsonb_agg(jsonb_build_object('etapa', nombre, 'semanas_cola', round(sem_cola, 1), 'semanas', round(sem, 1)) order by orden)
           filter (where sem > 0),
         (array_agg(nombre order by sem desc))[1], max(sem),
         (array_agg(nombre order by sem_cola desc))[1], max(sem_cola)
  into v_etapas, v_cuello, v_sem, v_cuello_cola, v_sem_cola
  from e;

  -- Semanas de lunes a viernes, igual que los "días hábiles" de las cotizaciones.
  v_dias_carga := case when v_equipos > 0 and v_sem > 0 then ceil(v_sem * 5)::int end;
  v_dias := nullif(greatest(coalesce(v_estandar, 0), coalesce(v_dias_carga, 0)), 0);

  return jsonb_build_object(
    'equipos', v_equipos,
    'dias_estandar', v_estandar,
    'fecha_estandar', case when v_estandar is not null then sumar_dias_habiles(v_hoy, v_estandar) end,
    'sin_dias', coalesce(to_jsonb(v_sin_dias), '[]'::jsonb),
    'dias_carga', v_dias_carga,
    'fecha_carga', case when v_dias_carga is not null then sumar_dias_habiles(v_hoy, v_dias_carga) end,
    'cuello', case when v_equipos > 0 then v_cuello else v_cuello_cola end,
    'semanas_cola', round(coalesce(v_sem_cola, 0), 1),
    'cuello_cola', v_cuello_cola,
    'dias_propuestos', v_dias,
    'fecha_propuesta', case when v_dias is not null then sumar_dias_habiles(v_hoy, v_dias) end,
    'etapas', coalesce(v_etapas, '[]'::jsonb));
end $$;

create or replace function public.analisis_promesas()
returns table (orden_id uuid, orden text, equipo text, pedido_id uuid, pedido text, cliente text, vendedor text,
               compromiso date, estimada date, dias int, estado text, cuello text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not (puede('analisis', 1) or puede('produccion', 3)) then
    raise exception 'El análisis de dirección no está en tu rol.' using errcode = '42501';
  end if;
  return query
  with abiertas as (
    select o.id, o.folio, o.fecha_compromiso, o.prioridad, o.pedido_id, o.articulo_id, o.estado
    from ordenes_produccion o where o.estado in ('planeada', 'liberada', 'en_proceso') and o.en_espera_motivo is null
  ), ph as (
    select a.id, a.fecha_compromiso, a.prioridad, a.folio, x.etapa_id, sum(x.horas_estimadas) h
    from abiertas a join op_operaciones x on x.orden_id = a.id and x.estado <> 'terminada'
    group by 1, 2, 3, 4, 5
  ), acum as (
    -- Primero lo que se prometió antes; sin compromiso, al final.
    select ph.id, ph.etapa_id,
      sum(ph.h) over (partition by ph.etapa_id order by ph.fecha_compromiso nulls last, ph.prioridad, ph.folio rows unbounded preceding) cum
    from ph
  ), sem as (
    select acum.id, max(acum.cum / e.capacidad_horas_semana) semanas,
      (array_agg(e.nombre order by acum.cum / e.capacidad_horas_semana desc))[1] cuello
    from acum join etapas e on e.id = acum.etapa_id
    where e.activa and e.capacidad_horas_semana > 0
    group by 1
  ), est as (
    select a.*, s.cuello, sumar_dias_habiles(hoy_planta(), ceil(coalesce(s.semanas, 0) * 5)::int) estimada
    from abiertas a left join sem s on s.id = a.id
  )
  select est.id, est.folio, ar.nombre, est.pedido_id, coalesce(p.id_externo, p.folio), c.nombre, pf.nombre,
    est.fecha_compromiso, est.estimada, (est.estimada - est.fecha_compromiso)::int, est.estado::text, est.cuello
  from est
  join articulos ar on ar.id = est.articulo_id
  left join pedidos p on p.id = est.pedido_id
  left join clientes c on c.id = p.cliente_id
  left join perfiles pf on pf.id = p.vendedor_id
  where est.fecha_compromiso is not null
  order by (est.estimada - est.fecha_compromiso) desc, est.fecha_compromiso;
end $$;

create or replace function public.analisis_capacidad(p_meses int default 6)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_hoy date := hoy_planta(); v_mes date := date_trunc('month', hoy_planta())::date;
  v_arranque date := coalesce((select (valor #>> '{}')::date from configuracion where clave = 'fecha_arranque'), hoy_planta());
  v_etapa int; v_nombre text; v_cap numeric; r jsonb;
begin
  if not (puede('analisis', 1) or puede('produccion', 3)) then
    raise exception 'El análisis de dirección no está en tu rol.' using errcode = '42501';
  end if;
  -- La etapa que manda: la que más semanas de trabajo pendiente tiene.
  select e.id, e.nombre, e.capacidad_horas_semana into v_etapa, v_nombre, v_cap
  from etapas e
  join op_operaciones x on x.etapa_id = e.id and x.estado <> 'terminada'
  join ordenes_produccion o on o.id = x.orden_id and o.estado in ('planeada', 'liberada', 'en_proceso') and o.en_espera_motivo is null
  where e.activa and e.capacidad_horas_semana > 0
  group by e.id order by sum(x.horas_estimadas) / e.capacidad_horas_semana desc limit 1;
  if v_etapa is null then
    return jsonb_build_object('cuello', null, 'meses', '[]'::jsonb, 'historia', '[]'::jsonb, 'semanas_cola', 0);
  end if;

  with pend as (
    select o.fecha_compromiso f, sum(x.horas_estimadas) / v_cap semanas
    from ordenes_produccion o join op_operaciones x on x.orden_id = o.id and x.etapa_id = v_etapa and x.estado <> 'terminada'
    where o.estado in ('planeada', 'liberada', 'en_proceso') and o.en_espera_motivo is null
    group by o.id, o.fecha_compromiso
  ), meses as (
    select (v_mes + make_interval(months => g))::date mes from generate_series(0, greatest(p_meses, 1) - 1) g
  ), cap as (
    -- Lo que cabe en el mes: sus días hábiles (lunes a viernes) que quedan, en semanas.
    select m.mes, (select count(*) from generate_series(greatest(m.mes, v_hoy), (m.mes + interval '1 month - 1 day')::date, interval '1 day') d
                   where extract(isodow from d) < 6) / 5.0 semanas
    from meses m
  ), por_mes as (
    select c.mes, c.semanas capacidad,
      -- Lo que ya venció va aparte ("vencido"): en cada mes, solo lo que todavía no vence.
      coalesce((select sum(p.semanas) from pend p where date_trunc('month', p.f) = c.mes and p.f >= v_hoy), 0) prometido
    from cap c
  )
  select jsonb_build_object(
    'cuello', v_nombre,
    'semanas_cola', round((select sum(semanas) from pend), 1),
    'vencido', round(coalesce((select sum(semanas) from pend where f < v_hoy), 0), 1),
    'sin_fecha', round(coalesce((select sum(semanas) from pend where f is null), 0), 1),
    'despues', round(coalesce((select sum(semanas) from pend where f >= (v_mes + make_interval(months => greatest(p_meses, 1)))::date), 0), 1),
    -- Con lo que ya venció adelante, cuándo se pondría al día el taller si no entrara nada más.
    'al_dia', sumar_dias_habiles(v_hoy, ceil(coalesce((select sum(semanas) from pend), 0) * 5)::int),
    'meses', coalesce((select jsonb_agg(jsonb_build_object('mes', pm.mes, 'prometido', round(pm.prometido, 1),
        'capacidad', round(pm.capacidad, 1)) order by pm.mes) from por_mes pm), '[]'::jsonb),
    -- Lo que entra (órdenes nuevas) y sale (etapas terminadas) cada mes desde el arranque.
    -- Lo que se cargó de la hoja de producción al arrancar no "entró" ese mes: ya estaba.
    'historia', coalesce((select jsonb_agg(jsonb_build_object('mes', h.mes, 'entra', round(h.entra, 1), 'sale', round(h.sale, 1)) order by h.mes) from (
        select m.mes,
          coalesce((select sum(x.horas_estimadas) / v_cap from ordenes_produccion o join op_operaciones x on x.orden_id = o.id and x.etapa_id = v_etapa
                    where date_trunc('month', o.creado_en at time zone 'America/Mexico_City') = m.mes and o.estado <> 'cancelada'
                      and coalesce(o.notas, '') not like 'Cargada de «fabricación de equipos»%'), 0) entra,
          coalesce((select sum(x.horas_estimadas) / v_cap from op_operaciones x
                    where x.etapa_id = v_etapa and x.estado = 'terminada' and x.fin is not null
                      and date_trunc('month', x.fin at time zone 'America/Mexico_City') = m.mes
                      and not exists (select 1 from ordenes_produccion o where o.id = x.orden_id
                                      and coalesce(o.notas, '') like 'Cargada de «fabricación de equipos»%'
                                      and date_trunc('day', x.fin) = date_trunc('day', o.creado_en))), 0) sale
        from (select generate_series(date_trunc('month', v_arranque), v_mes, interval '1 month')::date mes) m) h), '[]'::jsonb)
  ) into r;
  return r;
end $$;

-- El tablero dice si la orden está en espera (para la insignia) y una orden en espera no
-- sale atrasada: su fecha la mueve el cliente, no el taller.
create or replace view public.v_tablero_produccion with (security_invoker = true) as
select o.id, o.folio, o.numero_serie, o.estado, o.prioridad, o.fecha_compromiso, o.inicio_plan, o.cantidad,
  a.clave, a.nombre as equipo, a.imagen_url,
  pb.folio as pedido_folio, pb.cliente,
  h.horas_totales, h.horas_terminadas,
  case when h.horas_totales = 0 then 0 else round(100 * h.horas_terminadas / h.horas_totales) end as avance,
  (select e.nombre from public.op_operaciones x join public.etapas e on e.id = x.etapa_id
   where x.orden_id = o.id and x.estado in ('en_proceso', 'pausada') order by e.orden limit 1) as etapa_actual,
  sig.nombre as siguiente_etapa,
  h.pausada,
  -- Una orden terminada ya no espera material: lo que no se surtió se resolvió en el taller.
  case when o.estado in ('terminada', 'entregada') then 0::bigint
       else (select count(*) from public.v_op_material m where m.orden_id = o.id and m.faltante > 0) end as materiales_faltantes,
  o.fecha_compromiso - public.hoy_planta() as dias_restantes,
  (o.fecha_compromiso < public.hoy_planta() and o.estado not in ('terminada', 'entregada') and o.en_espera_motivo is null) as atrasada,
  o.revisado_ingenieria_en is not null as revisada_ingenieria,
  o.revisado_almacen_en is not null as revisada_almacen,
  (select max(en) from public.op_eventos ev where ev.orden_id = o.id) as ultimo_movimiento,
  -- Columnas nuevas
  o.pedido_id,
  o.pedido_id is null as para_stock,
  coalesce((select jsonb_agg(jsonb_build_object('id', e.id, 'nombre', e.nombre, 'color', e.color, 'estado', x.estado,
                                                'responsable', x.responsable, 'inicio', x.inicio) order by e.orden)
            from public.op_operaciones x join public.etapas e on e.id = x.etapa_id
            where x.orden_id = o.id and x.estado in ('en_proceso', 'pausada')), '[]'::jsonb) as etapas_activas,
  sig.id as siguiente_etapa_id,
  sig.color as siguiente_etapa_color,
  h.horas_totales - h.horas_terminadas as horas_pendientes,
  o.material_apartado_en is not null as material_apartado,
  case when o.estado in ('terminada', 'entregada') then 0::bigint
       else (select count(*) from public.v_op_material m where m.orden_id = o.id and m.faltante - m.pedido_a_compras > 0) end as faltantes_sin_pedir,
  o.terminada_en,
  o.creado_en,
  o.notas,
  o.en_espera_motivo,
  o.en_espera_desde
from public.ordenes_produccion o
join public.articulos a on a.id = o.articulo_id
left join lateral public.pedido_de_orden(o.pedido_id) pb on true
left join lateral (
  select coalesce(sum(x.horas_estimadas), 0) as horas_totales,
         coalesce(sum(x.horas_estimadas) filter (where x.estado = 'terminada'), 0) as horas_terminadas,
         coalesce(bool_or(x.estado = 'pausada'), false) as pausada
  from public.op_operaciones x where x.orden_id = o.id) h on true
left join lateral (
  select e.id, e.nombre, e.color from public.op_operaciones x join public.etapas e on e.id = x.etapa_id
  where x.orden_id = o.id and x.estado = 'pendiente' order by e.orden limit 1) sig on true
where o.estado not in ('entregada', 'cancelada');

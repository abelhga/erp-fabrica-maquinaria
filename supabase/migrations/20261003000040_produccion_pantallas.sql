-- =============================================================================
-- Pantallas de producción: lo que necesitan la gerencia, la terminal de piso y
-- la TV del taller, y las correcciones que salieron al construirlas.
--
-- Lo que se corrige de 20261003000005_produccion.sql (con create or replace,
-- sin tocar ese archivo):
--  * La TV no veía a qué cliente va cada equipo: el tablero unía con pedidos y
--    la RLS de pedidos (montos) se lo escondía. Ahora el nombre del cliente y
--    el folio del pedido salen por una función que no da nada más.
--  * "Días para el compromiso" se calculaba con la fecha UTC: de 6 pm en
--    adelante la TV contaba un día de menos.
--  * El surtido podía sacar material apartado para otra orden (lo mismo que
--    hoy pasa en la hoja: cada pestaña ve todo el stock como suyo).
--  * Las reservas se quedaban activas para siempre al terminar o cancelar la
--    orden, bloqueando material que ya nadie iba a usar.
--  * Pausar una etapa que nunca empezó o reanudar una que no estaba pausada
--    dejaba el tablero diciendo "pausada" de algo que nadie tocó.
--  * Liberar dos veces dejaba dos eventos "liberada".
--  * Apartar material y pedir faltantes no dejaban rastro de quién ni cuándo:
--    eran justo los pasos que en la hoja nunca se marcaban.
--  * Vendedores e ingeniería veían "faltante sin pedir" en lo ya pedido a
--    compras, porque no pueden leer requisiciones.
--  * Una orden terminada seguía contando como "con faltantes".
--
-- Lo nuevo: editar/cancelar/entregar órdenes con su evento, los pasos de la
-- validación con nombre y hora (validacion_orden), correcciones de ingeniería a
-- la lista de una orden que quedan en la línea de tiempo y sueltan lo apartado
-- de más, solicitudes de cambio al costeo desde la orden, y las vistas del piso
-- (v_piso_operaciones, v_op_eventos) y de pedidos por producir.
-- =============================================================================

-- La planta está en Guadalajara; la base corre en UTC.
create or replace function public.hoy_planta() returns date
language sql stable as $$ select (now() at time zone 'America/Mexico_City')::date $$;

alter table public.ordenes_produccion
  add column if not exists material_apartado_por uuid references public.perfiles(id),
  add column if not exists material_apartado_en timestamptz,
  add column if not exists faltantes_pedidos_por uuid references public.perfiles(id),
  add column if not exists faltantes_pedidos_en timestamptz,
  add column if not exists cancelada_en timestamptz,
  add column if not exists motivo_cancelacion text;

-- Quién trabajaba la etapa en ese momento (el nombre de piso, que puede no tener
-- usuario): la TV dice "Juan inició Pailería", no "la tablet de pintura".
alter table public.op_eventos add column if not exists responsable text;

-- Lo que contesta ingeniería a una solicitud de cambio.
alter table public.solicitudes_cambio_bom add column if not exists respuesta text;
-- Una versión de prueba de este archivo se llamaba igual que la de costeo
-- (resolver_solicitud_cambio) con un argumento más: la llamada de dos argumentos
-- quedaba ambigua. Esa firma ya no existe.
drop function if exists public.resolver_solicitud_cambio(uuid, text, text);

-- ----------------------------------------------------------------------------
-- Cliente y pedido de una orden, sin montos
-- ----------------------------------------------------------------------------
-- pedidos tiene RLS porque trae importes; la TV y los vendedores no los ven.
-- Pero el taller necesita saber para quién es cada equipo, y el nombre del
-- cliente ya lo ve cualquiera con producción (política de clientes). Esta
-- función da solo eso, y solo de pedidos que tienen orden de producción.
create or replace function public.pedido_de_orden(p_pedido uuid) returns table (folio text, cliente text)
language sql stable security definer set search_path = public as $$
  select p.folio, c.nombre from pedidos p join clientes c on c.id = p.cliente_id
  where p.id = p_pedido and (puede('produccion', 1) or puede('inventario', 1))
    and exists (select 1 from ordenes_produccion o where o.pedido_id = p.id)
$$;

-- Cuánto se pidió a compras para una partida de una orden. Las requisiciones solo
-- las ven compras, almacén y producción nivel 2; sin esto, un vendedor o ingeniería
-- veían "faltante sin pedir" en lo que ya estaba pedido. Es una cantidad, sin costos.
create or replace function public.pedido_a_compras_op(p_op uuid, p_articulo uuid) returns numeric
language sql stable security definer set search_path = public as $$
  select coalesce(sum(l.cantidad), 0) from requisicion_lineas l
  where l.orden_produccion_id = p_op and l.articulo_id = p_articulo and l.estado <> 'cancelada'
    and (puede('produccion', 1) or puede('inventario', 1))
$$;

-- ----------------------------------------------------------------------------
-- Material por orden: se agregan lo que falta por surtir y lo disponible
-- (existencia menos lo apartado para cualquier orden), que es lo que almacén
-- necesita para decidir de dónde sale cada cosa.
-- ----------------------------------------------------------------------------
create or replace view public.v_op_material with (security_invoker = true) as
select m.id, m.orden_id, m.articulo_id, a.clave, a.nombre, a.unidad, m.requerido, m.surtido, m.ruta, m.agregado, m.notas,
  coalesce(r.apartado, 0) as apartado,
  greatest(m.requerido - m.surtido - coalesce(r.apartado, 0), 0) as faltante,
  public.pedido_a_compras_op(m.orden_id, m.articulo_id) as pedido_a_compras,
  coalesce(e.en_planta, 0) as existencia_planta,
  greatest(m.requerido - m.surtido, 0) as por_surtir,
  greatest(coalesce(e.en_planta, 0) - coalesce((select sum(t.cantidad - t.surtido) from public.reservas t
                                                where t.articulo_id = m.articulo_id and t.estado = 'activa'), 0), 0) as disponible_planta,
  a.tipo
from public.op_materiales m
join public.articulos a on a.id = m.articulo_id
left join lateral (select sum(cantidad - surtido) apartado from public.reservas
                   where orden_produccion_id = m.orden_id and articulo_id = m.articulo_id and estado = 'activa') r on true
left join lateral (select sum(x.cantidad) en_planta from public.existencias x join public.almacenes al on al.id = x.almacen_id
                   where x.articulo_id = m.articulo_id and al.disponible_para_planta) e on true;

-- ----------------------------------------------------------------------------
-- Tablero: mismas columnas de antes (en el mismo orden) y al final lo que
-- necesitan el kanban y la TV.
-- ----------------------------------------------------------------------------
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
  (o.fecha_compromiso < public.hoy_planta() and o.estado not in ('terminada', 'entregada')) as atrasada,
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
  o.notas
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

-- Carga del taller: se agregan las horas de órdenes todavía planeadas, para que
-- el gerente vea lo que viene antes de liberarlo.
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
  where x.etapa_id = e.id and o.estado in ('liberada', 'en_proceso')) t on true
left join lateral (
  select sum(x.horas_estimadas) horas
  from public.op_operaciones x join public.ordenes_produccion o on o.id = x.orden_id
  where x.etapa_id = e.id and o.estado = 'planeada') pl on true
where e.activa;

-- ----------------------------------------------------------------------------
-- Piso: una fila por etapa abierta de órdenes liberadas o en proceso. La usan
-- la terminal (qué puedo empezar aquí) y la TV (qué se trabaja en cada etapa).
-- "lista" = las etapas anteriores ya terminaron; si no, "espera_a" dice cuáles.
-- ----------------------------------------------------------------------------
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
where t.estado in ('liberada', 'en_proceso') and x.estado <> 'terminada';

-- Eventos con lo necesario para contarlos en una línea ("Pailería · Juan terminó OP-…").
create or replace view public.v_op_eventos with (security_invoker = true) as
select ev.id, ev.orden_id, ev.operacion_id, ev.tipo, ev.nota, ev.en, ev.usuario_id,
  coalesce(ev.responsable, x.responsable) as responsable,
  o.folio, o.numero_serie, a.nombre as equipo,
  e.nombre as etapa, e.color as etapa_color, p.nombre as usuario
from public.op_eventos ev
join public.ordenes_produccion o on o.id = ev.orden_id
join public.articulos a on a.id = o.articulo_id
left join public.op_operaciones x on x.id = ev.operacion_id
left join public.etapas e on e.id = x.etapa_id
left join public.perfiles p on p.id = ev.usuario_id;

-- Pedidos con equipos que todavía no tienen orden (lo que mira ordenes_desde_pedido),
-- y los que no se pueden fabricar porque ingeniería no ha capturado la lista.
create or replace view public.v_pedidos_por_producir with (security_invoker = true) as
select p.id, p.folio, p.fecha, p.fecha_compromiso, p.estado, c.nombre as cliente,
  coalesce(sum(ceil(pl.cantidad)) filter (where b.tiene_lista), 0)::int as unidades,
  count(*) filter (where not b.tiene_lista)::int as partidas_sin_lista,
  jsonb_agg(jsonb_build_object('linea_id', pl.id, 'articulo_id', a.id, 'clave', a.clave, 'equipo', a.nombre,
                               'cantidad', pl.cantidad, 'tiene_lista', b.tiene_lista) order by pl.orden) as partidas,
  p.fecha_compromiso - public.hoy_planta() as dias_restantes
from public.pedidos p
join public.clientes c on c.id = p.cliente_id
join public.pedido_lineas pl on pl.pedido_id = p.id
join public.articulos a on a.id = pl.articulo_id and a.tipo in ('equipo', 'subensamble')
cross join lateral (select exists (select 1 from public.bom_lineas bl where bl.padre_id = a.id) as tiene_lista) b
where p.estado in ('confirmado', 'en_produccion')
  and not exists (select 1 from public.ordenes_produccion o where o.pedido_linea_id = pl.id and o.estado <> 'cancelada')
group by p.id, c.id;

-- Igual que antes; solo sin la variable "i" declarada de más (el FOR declara la
-- suya y el lint marcaba la sombra).
create or replace function public.ordenes_desde_pedido(p_pedido uuid) returns int
language plpgsql security definer set search_path = public as $$
declare l record; v_n int := 0;
begin
  for l in select pl.* from pedido_lineas pl join articulos a on a.id = pl.articulo_id
           where pl.pedido_id = p_pedido and a.tipo in ('equipo', 'subensamble')
             and exists (select 1 from bom_lineas b where b.padre_id = a.id)
             and not exists (select 1 from ordenes_produccion o where o.pedido_linea_id = pl.id and o.estado <> 'cancelada') loop
    for i in 1 .. ceil(l.cantidad)::int loop
      perform crear_orden_produccion(l.articulo_id, 1, l.id);
      v_n := v_n + 1;
    end loop;
  end loop;
  return v_n;
end $$;

-- ----------------------------------------------------------------------------
-- Validación: los mismos pasos, ahora dejando quién y cuándo
-- ----------------------------------------------------------------------------
create or replace function public.apartar_material(p_op uuid) returns table (articulo_id uuid, nombre text, faltante numeric)
language plpgsql security definer set search_path = public as $$
declare m record; v_libre numeric; v_tomar numeric; v_folio text; v_estado estado_op; v_total int; v_falt int;
begin
  if not (puede('produccion', 2) or puede('inventario', 2)) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  select o.folio, o.estado into v_folio, v_estado from ordenes_produccion o where o.id = p_op;
  if v_folio is null then raise exception 'No existe la orden'; end if;
  if v_estado in ('terminada', 'entregada', 'cancelada') then raise exception 'La orden % ya está cerrada', v_folio; end if;
  -- Bloquea las existencias de los artículos involucrados para que dos órdenes no aparten lo mismo a la vez.
  perform 1 from existencias where existencias.articulo_id in (select om.articulo_id from op_materiales om where om.orden_id = p_op) for update;

  for m in select * from v_op_material v where v.orden_id = p_op and v.faltante > 0 loop
    select coalesce(sum(x.cantidad), 0) - coalesce((select sum(r.cantidad - r.surtido) from reservas r
                                                     where r.articulo_id = m.articulo_id and r.estado = 'activa'), 0)
      into v_libre
    from existencias x join almacenes al on al.id = x.almacen_id
    where x.articulo_id = m.articulo_id and al.disponible_para_planta;
    v_tomar := least(m.faltante, greatest(v_libre, 0));
    if v_tomar > 0 then
      insert into reservas (articulo_id, cantidad, orden_produccion_id, motivo)
      values (m.articulo_id, v_tomar, p_op, 'OP ' || v_folio);
    end if;
  end loop;

  select count(*), count(*) filter (where v.faltante > 0) into v_total, v_falt from v_op_material v where v.orden_id = p_op;
  update ordenes_produccion set material_apartado_por = auth.uid(), material_apartado_en = now() where id = p_op;
  insert into op_eventos (orden_id, tipo, nota) values (p_op, 'nota',
    case when v_falt = 0 then format('Material apartado: las %s partidas completas', v_total)
         else format('Material apartado: %s de %s partidas completas, %s con faltante', v_total - v_falt, v_total, v_falt) end);

  return query select v.articulo_id, v.nombre, v.faltante from v_op_material v where v.orden_id = p_op and v.faltante > 0;
end $$;

create or replace function public.pedir_faltantes(p_op uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_req uuid; o ordenes_produccion; v_n int;
begin
  if not (puede('produccion', 2) or puede('inventario', 2)) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  select * into o from ordenes_produccion where id = p_op;
  if o.id is null then raise exception 'No existe la orden'; end if;
  if o.estado in ('terminada', 'entregada', 'cancelada') then raise exception 'La orden % ya está cerrada', o.folio; end if;
  if not exists (select 1 from v_op_material where orden_id = p_op and faltante - pedido_a_compras > 0) then return null; end if;
  insert into requisiciones (origen, necesaria_para, notas)
  values ('produccion', coalesce(o.inicio_plan, o.fecha_compromiso), 'Faltantes de ' || o.folio)
  returning id into v_req;
  insert into requisicion_lineas (requisicion_id, articulo_id, cantidad, orden_produccion_id)
  select v_req, articulo_id, faltante - pedido_a_compras, p_op from v_op_material
  where orden_id = p_op and faltante - pedido_a_compras > 0;
  get diagnostics v_n = row_count;
  update ordenes_produccion set faltantes_pedidos_por = auth.uid(), faltantes_pedidos_en = now() where id = p_op;
  insert into op_eventos (orden_id, tipo, nota)
  values (p_op, 'nota', format('Faltantes pedidos a compras: %s partida(s) en %s', v_n, (select folio from requisiciones where id = v_req)));
  return v_req;
end $$;

create or replace function public.revisar_orden(p_op uuid, p_paso text) returns void
language plpgsql security definer set search_path = public as $$
declare v_estado estado_op;
begin
  select estado into v_estado from ordenes_produccion where id = p_op;
  if v_estado is null then raise exception 'No existe la orden'; end if;
  if p_paso = 'ingenieria' then
    if not (puede('costeo', 2) or puede('produccion', 3)) then raise exception 'Sin permiso' using errcode = '42501'; end if;
    update ordenes_produccion set revisado_ingenieria_por = auth.uid(), revisado_ingenieria_en = now() where id = p_op;
    insert into op_eventos (orden_id, tipo, nota) values (p_op, 'nota', 'Ingeniería revisó materiales y cantidades');
  elsif p_paso = 'almacen' then
    if not puede('inventario', 2) then raise exception 'Sin permiso' using errcode = '42501'; end if;
    update ordenes_produccion set revisado_almacen_por = auth.uid(), revisado_almacen_en = now() where id = p_op;
    insert into op_eventos (orden_id, tipo, nota) values (p_op, 'nota', 'Almacén revisó el material físicamente');
  else
    raise exception 'Paso desconocido: %', p_paso;
  end if;
end $$;

create or replace function public.liberar_orden(p_op uuid) returns void
language plpgsql security definer set search_path = public as $$
declare o ordenes_produccion;
begin
  if not puede('produccion', 3) then raise exception 'Solo la gerencia de producción libera órdenes' using errcode = '42501'; end if;
  select * into o from ordenes_produccion where id = p_op for update;
  if o.id is null then raise exception 'No existe la orden'; end if;
  if o.revisado_ingenieria_en is null then
    raise exception 'Falta que ingeniería revise materiales y cantidades';
  end if;
  if o.estado <> 'planeada' then raise exception 'La orden % ya estaba liberada', o.folio; end if;
  update ordenes_produccion set estado = 'liberada', inicio_plan = coalesce(inicio_plan, hoy_planta()) where id = p_op;
  insert into op_eventos (orden_id, tipo) values (p_op, 'liberada');
end $$;

-- Pasos de la validación con quién y cuándo (la hoja tenía casillas sin nombre
-- ni fecha, y dos de las cuatro nunca se marcaron).
create or replace function public.validacion_orden(p_op uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare o ordenes_produccion; v_lineas int; v_falt int; v_sin_pedir int; v_res record; v_req record; v_lib record;
begin
  if not (puede('produccion', 1) or puede('inventario', 1)) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  select * into o from ordenes_produccion where id = p_op;
  if o.id is null then return null; end if;
  select count(*), count(*) filter (where faltante > 0), count(*) filter (where faltante - pedido_a_compras > 0)
    into v_lineas, v_falt, v_sin_pedir from v_op_material where orden_id = p_op;
  -- Órdenes apartadas antes de que existiera material_apartado_en: la primera reserva dice quién.
  select r.creado_en en, p.nombre por into v_res from reservas r left join perfiles p on p.id = r.creado_por
  where r.orden_produccion_id = p_op order by r.creado_en limit 1;
  select r.folio, r.creado_en en, p.nombre por into v_req
  from requisiciones r join requisicion_lineas l on l.requisicion_id = r.id left join perfiles p on p.id = r.solicitante_id
  where l.orden_produccion_id = p_op and l.estado <> 'cancelada' order by r.creado_en desc limit 1;
  select ev.en, p.nombre por into v_lib from op_eventos ev left join perfiles p on p.id = ev.usuario_id
  where ev.orden_id = p_op and ev.tipo = 'liberada' order by ev.en desc limit 1;

  return jsonb_build_array(
    jsonb_build_object('paso', 'ingenieria', 'titulo', 'Ingeniería revisó la lista',
      'estado', case when o.revisado_ingenieria_en is not null then 'hecho' else 'pendiente' end,
      'por', (select nombre from perfiles where id = o.revisado_ingenieria_por), 'en', o.revisado_ingenieria_en,
      'detalle', format('%s partida(s) en la lista', v_lineas)),
    jsonb_build_object('paso', 'apartado', 'titulo', 'Material apartado',
      'estado', case when coalesce(o.material_apartado_en, v_res.en) is null then 'pendiente'
                     when v_falt > 0 then 'parcial' else 'hecho' end,
      'por', coalesce((select nombre from perfiles where id = o.material_apartado_por), v_res.por),
      'en', coalesce(o.material_apartado_en, v_res.en),
      'detalle', case when v_falt = 0 then 'Nada falta' else format('%s partida(s) con faltante', v_falt) end),
    jsonb_build_object('paso', 'faltantes', 'titulo', 'Faltantes pedidos a compras',
      'estado', case when v_sin_pedir > 0 then 'pendiente'
                     when v_req.folio is not null then 'hecho' else 'no_aplica' end,
      'por', coalesce((select nombre from perfiles where id = o.faltantes_pedidos_por), v_req.por),
      'en', coalesce(o.faltantes_pedidos_en, v_req.en),
      'detalle', case when v_sin_pedir > 0 then format('%s partida(s) sin pedir', v_sin_pedir)
                      when v_req.folio is not null then v_req.folio else 'No hizo falta' end),
    jsonb_build_object('paso', 'almacen', 'titulo', 'Almacén revisó',
      'estado', case when o.revisado_almacen_en is not null then 'hecho' else 'pendiente' end,
      'por', (select nombre from perfiles where id = o.revisado_almacen_por), 'en', o.revisado_almacen_en,
      'detalle', 'Existencia física'),
    jsonb_build_object('paso', 'liberada', 'titulo', 'Liberada al taller',
      'estado', case when o.estado not in ('planeada', 'cancelada') then 'hecho' else 'pendiente' end,
      'por', v_lib.por, 'en', v_lib.en,
      'detalle', case o.estado when 'planeada' then 'Espera a la gerencia' when 'cancelada' then 'Cancelada'
                                 else 'En el taller' end)
  );
end $$;

-- ----------------------------------------------------------------------------
-- Surtido: ya no puede sacar lo que está apartado para otra orden, ni surtir
-- a planta desde el Full de Mercado Libre.
-- ----------------------------------------------------------------------------
create or replace function public.surtir_material(p_op uuid, p_lineas jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare l record; o ordenes_produccion; v_req numeric; v_res reservas; v_rest numeric; v_propio numeric; v_libre numeric;
  v_nombre text; v_n int := 0; v_fuera int := 0;
begin
  if not puede('inventario', 2) then raise exception 'Solo almacén surte material' using errcode = '42501'; end if;
  select * into o from ordenes_produccion where id = p_op;
  if o.id is null then raise exception 'No existe la orden'; end if;
  if o.estado in ('terminada', 'entregada', 'cancelada') then raise exception 'La orden ya está cerrada'; end if;

  for l in select (x->>'articulo_id')::uuid articulo_id, (x->>'cantidad')::numeric cantidad,
                  (x->>'almacen_id')::int almacen_id, x->>'motivo' motivo
           from jsonb_array_elements(p_lineas) x loop
    if coalesce(l.cantidad, 0) <= 0 then continue; end if;
    select nombre into v_nombre from articulos where id = l.articulo_id;
    if l.almacen_id is null then raise exception 'Falta elegir de qué almacén sale "%"', v_nombre; end if;
    if not coalesce((select disponible_para_planta from almacenes where id = l.almacen_id), false) then
      raise exception 'Del almacén % no se surte a planta', (select nombre from almacenes where id = l.almacen_id);
    end if;
    select requerido - surtido into v_req from op_materiales where orden_id = p_op and articulo_id = l.articulo_id;
    if v_req is null and coalesce(trim(l.motivo), '') = '' then
      raise exception '"%" no está en la lista de materiales de esta orden: escribe el motivo', v_nombre;
    end if;

    -- Lo que esta orden puede llevarse: su propia reserva más lo que nadie apartó.
    perform 1 from existencias where articulo_id = l.articulo_id for update;
    select coalesce(sum(cantidad - surtido), 0) into v_propio from reservas
    where orden_produccion_id = p_op and articulo_id = l.articulo_id and estado = 'activa';
    select coalesce(sum(x.cantidad), 0) - coalesce((select sum(r.cantidad - r.surtido) from reservas r
                                                     where r.articulo_id = l.articulo_id and r.estado = 'activa'), 0)
      into v_libre
    from existencias x join almacenes al on al.id = x.almacen_id
    where x.articulo_id = l.articulo_id and al.disponible_para_planta;
    if l.cantidad > v_propio + greatest(v_libre, 0) + 0.0005 then
      raise exception 'De "%" solo puedes surtir % a esta orden: lo demás está apartado para %',
        v_nombre, trim_scale(v_propio + greatest(v_libre, 0)),
        coalesce((select string_agg(distinct coalesce(o2.folio, 'un pedido'), ', ') from reservas r
                  left join ordenes_produccion o2 on o2.id = r.orden_produccion_id
                  where r.articulo_id = l.articulo_id and r.estado = 'activa' and r.orden_produccion_id is distinct from p_op),
                 'otras órdenes')
        using errcode = '23514';
    end if;

    insert into movimientos_inventario (tipo, articulo_id, almacen_id, cantidad, orden_produccion_id, pedido_id, motivo, fuera_de_lista, costo_unitario)
    values ('salida_produccion', l.articulo_id, l.almacen_id, -l.cantidad, p_op, o.pedido_id,
            coalesce(nullif(trim(l.motivo), ''), o.folio), v_req is null,
            (select costo * tc(moneda) from costos_articulo where articulo_id = l.articulo_id));

    if v_req is null then
      insert into op_materiales (orden_id, articulo_id, requerido, surtido, agregado, notas)
      values (p_op, l.articulo_id, 0, l.cantidad, true, l.motivo);
      v_fuera := v_fuera + 1;
    else
      update op_materiales set surtido = surtido + l.cantidad where orden_id = p_op and articulo_id = l.articulo_id;
    end if;

    -- Consume reservas de la orden (las más viejas primero).
    v_rest := l.cantidad;
    for v_res in select * from reservas where orden_produccion_id = p_op and articulo_id = l.articulo_id and estado = 'activa'
                 order by creado_en for update loop
      exit when v_rest <= 0;
      update reservas set surtido = surtido + least(v_rest, cantidad - surtido),
        estado = case when surtido + least(v_rest, cantidad - surtido) >= cantidad then 'surtida' else 'activa' end
      where id = v_res.id;
      v_rest := v_rest - least(v_rest, v_res.cantidad - v_res.surtido);
    end loop;
    v_n := v_n + 1;
  end loop;
  if v_n = 0 then raise exception 'No hay cantidades para surtir'; end if;
  insert into op_eventos (orden_id, tipo, nota)
  values (p_op, 'surtido', format('%s partida(s)%s', v_n, case when v_fuera > 0 then format(', %s fuera de lista', v_fuera) else '' end));
end $$;

-- ----------------------------------------------------------------------------
-- Terminal de piso
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- Gerencia: reprogramar, cancelar y entregar
-- ----------------------------------------------------------------------------
create or replace function public.editar_orden(p_op uuid, p_prioridad int default null, p_fecha_compromiso date default null,
  p_numero_serie text default null, p_notas text default null) returns void
language plpgsql security definer set search_path = public as $$
declare o ordenes_produccion; v_cambios text[] := array[]::text[]; v_serie text := nullif(trim(p_numero_serie), ''); v_otra text;
  v_prio text[] := array['urgente', 'normal', 'baja'];
begin
  if not puede('produccion', 3) then raise exception 'Solo la gerencia de producción reprograma órdenes' using errcode = '42501'; end if;
  select * into o from ordenes_produccion where id = p_op for update;
  if o.id is null then raise exception 'No existe la orden'; end if;
  if o.estado in ('entregada', 'cancelada') then raise exception 'La orden % ya está cerrada', o.folio; end if;
  if p_prioridad is not null and p_prioridad <> o.prioridad then
    if p_prioridad not between 1 and 3 then raise exception 'La prioridad va de 1 (urgente) a 3 (baja)'; end if;
    v_cambios := array_append(v_cambios, format('Prioridad: %s → %s', v_prio[o.prioridad], v_prio[p_prioridad]));
  end if;
  if p_fecha_compromiso is not null and p_fecha_compromiso is distinct from o.fecha_compromiso then
    v_cambios := array_append(v_cambios, format('Compromiso: %s → %s', coalesce(to_char(o.fecha_compromiso, 'DD/MM/YYYY'), 'sin fecha'),
                                                to_char(p_fecha_compromiso, 'DD/MM/YYYY')));
  end if;
  if p_numero_serie is not null and v_serie is distinct from o.numero_serie then
    select folio into v_otra from ordenes_produccion where numero_serie = v_serie and id <> p_op;
    if v_otra is not null then raise exception 'El número de serie % ya es de la orden %', v_serie, v_otra; end if;
    v_cambios := array_append(v_cambios, format('Serie: %s → %s', coalesce(o.numero_serie, 'sin serie'), coalesce(v_serie, 'sin serie')));
  end if;
  if p_notas is not null and nullif(trim(p_notas), '') is distinct from o.notas then
    -- array_append y no ||: con || el literal 'Notas: ' se toma como arreglo y truena.
    v_cambios := array_append(v_cambios, 'Notas: ' || coalesce(nullif(trim(p_notas), ''), '(borradas)'));
  end if;
  if cardinality(v_cambios) = 0 then return; end if;

  update ordenes_produccion set
    prioridad = coalesce(p_prioridad, prioridad),
    fecha_compromiso = coalesce(p_fecha_compromiso, fecha_compromiso),
    numero_serie = case when p_numero_serie is null then numero_serie else v_serie end,
    notas = case when p_notas is null then notas else nullif(trim(p_notas), '') end
  where id = p_op;
  insert into op_eventos (orden_id, tipo, nota) values (p_op, 'nota', array_to_string(v_cambios, ' · '));
end $$;

create or replace function public.cancelar_orden(p_op uuid, p_motivo text) returns void
language plpgsql security definer set search_path = public as $$
declare o ordenes_produccion; v_surtido boolean;
begin
  if not puede('produccion', 3) then raise exception 'Solo la gerencia de producción cancela órdenes' using errcode = '42501'; end if;
  if length(trim(coalesce(p_motivo, ''))) < 5 then raise exception 'Escribe por qué se cancela'; end if;
  select * into o from ordenes_produccion where id = p_op for update;
  if o.id is null then raise exception 'No existe la orden'; end if;
  if o.estado in ('terminada', 'entregada', 'cancelada') then raise exception 'La orden % ya está cerrada', o.folio; end if;
  v_surtido := exists (select 1 from op_materiales where orden_id = p_op and surtido > 0);
  update ordenes_produccion set estado = 'cancelada', cancelada_en = now(), motivo_cancelacion = trim(p_motivo) where id = p_op;
  -- Lo que se pidió a compras para esta orden ya no se necesita.
  update requisicion_lineas set estado = 'cancelada' where orden_produccion_id = p_op and estado = 'pendiente';
  insert into op_eventos (orden_id, tipo, nota) values (p_op, 'nota', 'Orden cancelada: ' || trim(p_motivo)
    || case when v_surtido then '. Ya se había surtido material: regrésalo al almacén con una devolución.' else '' end);
end $$;

create or replace function public.entregar_orden(p_op uuid) returns void
language plpgsql security definer set search_path = public as $$
declare o ordenes_produccion;
begin
  if not (puede('produccion', 3) or puede('inventario', 2)) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  select * into o from ordenes_produccion where id = p_op for update;
  if o.id is null then raise exception 'No existe la orden'; end if;
  if o.estado <> 'terminada' then raise exception 'Solo se entrega una orden terminada'; end if;
  update ordenes_produccion set estado = 'entregada', entregada_en = now() where id = p_op;
  insert into op_eventos (orden_id, tipo) values (p_op, 'entregada');
end $$;

-- Al cerrar una orden, lo que tenía apartado y no se surtió vuelve a estar libre.
create or replace function public.trg_op_cierre() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.estado in ('terminada', 'entregada', 'cancelada') and old.estado not in ('terminada', 'entregada', 'cancelada') then
    update reservas set estado = 'liberada' where orden_produccion_id = new.id and estado = 'activa';
  end if;
  return new;
end $$;
drop trigger if exists cierre on public.ordenes_produccion;
create trigger cierre after update of estado on public.ordenes_produccion for each row execute function public.trg_op_cierre();

-- ----------------------------------------------------------------------------
-- Correcciones de ingeniería a la lista de una orden
-- ----------------------------------------------------------------------------
-- Cambiar una cantidad queda en la línea de tiempo (no en una nota suelta), y
-- si baja, lo apartado de más se suelta para otras órdenes.
create or replace function public.trg_op_material_cambio() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_estado estado_op; v_exceso numeric; v_quita numeric; r reservas; v_nombre text; v_unidad text;
begin
  select estado into v_estado from ordenes_produccion where id = coalesce(new.orden_id, old.orden_id);
  -- Borrado en cascada de la orden completa: no hay a quién contarle el cambio.
  if v_estado is null then return coalesce(new, old); end if;
  -- La orden recién creada inserta su lista antes de su evento "creada": eso no es un cambio.
  if not exists (select 1 from op_eventos where orden_id = coalesce(new.orden_id, old.orden_id) and tipo = 'creada') then
    return coalesce(new, old);
  end if;
  if v_estado in ('terminada', 'entregada', 'cancelada') then
    raise exception 'La orden ya está cerrada: su lista de materiales no se cambia';
  end if;
  select nombre, unidad into v_nombre, v_unidad from articulos where id = coalesce(new.articulo_id, old.articulo_id);

  if tg_op = 'INSERT' then
    if new.requerido > 0 then
      insert into op_eventos (orden_id, tipo, nota)
      values (new.orden_id, 'cambio_material', format('Se agregó %s %s de %s', trim_scale(new.requerido), v_unidad, v_nombre)
                                               || coalesce(' (' || nullif(trim(new.notas), '') || ')', ''));
    end if;
    return new;
  elsif tg_op = 'DELETE' then
    if old.surtido > 0 then raise exception 'De "%" ya se surtió material: no se puede quitar de la lista', v_nombre; end if;
    update reservas set estado = 'liberada' where orden_produccion_id = old.orden_id and articulo_id = old.articulo_id and estado = 'activa';
    insert into op_eventos (orden_id, tipo, nota) values (old.orden_id, 'cambio_material', format('Se quitó %s de la lista', v_nombre));
    return old;
  end if;

  if new.requerido is distinct from old.requerido then
    insert into op_eventos (orden_id, tipo, nota)
    values (new.orden_id, 'cambio_material', format('%s: %s → %s %s', v_nombre, trim_scale(old.requerido), trim_scale(new.requerido), v_unidad));
    select new.surtido + coalesce(sum(cantidad - surtido), 0) - new.requerido into v_exceso
    from reservas where orden_produccion_id = new.orden_id and articulo_id = new.articulo_id and estado = 'activa';
    for r in select * from reservas where orden_produccion_id = new.orden_id and articulo_id = new.articulo_id and estado = 'activa'
             order by creado_en desc for update loop
      exit when v_exceso <= 0;
      v_quita := least(v_exceso, r.cantidad - r.surtido);
      if r.surtido = 0 and v_quita >= r.cantidad then
        update reservas set estado = 'liberada' where id = r.id;
      elsif r.cantidad - v_quita <= r.surtido then
        update reservas set cantidad = r.surtido, estado = 'surtida' where id = r.id;
      else
        update reservas set cantidad = r.cantidad - v_quita where id = r.id;
      end if;
      v_exceso := v_exceso - v_quita;
    end loop;
  end if;
  return new;
end $$;
drop trigger if exists cambio on public.op_materiales;
create trigger cambio after insert or update of requerido or delete on public.op_materiales
  for each row execute function public.trg_op_material_cambio();

-- Las correcciones que hoy mueren en notas ("Son de 14\"", "DEBE SER 4X3")
-- llegan a ingeniería como pendiente, y la orden lo registra.
create or replace function public.solicitar_cambio_bom(p_op uuid, p_articulo uuid, p_descripcion text) returns uuid
language plpgsql security definer set search_path = public as $$
declare o ordenes_produccion; v_id uuid; v_art uuid;
begin
  if not (puede('produccion', 2) or puede('inventario', 2) or puede('costeo', 1) or puede('ventas', 2)) then
    raise exception 'Sin permiso' using errcode = '42501';
  end if;
  if length(trim(coalesce(p_descripcion, ''))) < 3 then raise exception 'Escribe qué hay que cambiar'; end if;
  select * into o from ordenes_produccion where id = p_op;
  if o.id is null then raise exception 'No existe la orden'; end if;
  v_art := coalesce(p_articulo, o.articulo_id);
  insert into solicitudes_cambio_bom (orden_id, articulo_id, descripcion) values (p_op, v_art, trim(p_descripcion))
  returning id into v_id;
  insert into op_eventos (orden_id, tipo, nota)
  values (p_op, 'nota', format('Cambio pedido a ingeniería (%s): %s', (select nombre from articulos where id = v_art), trim(p_descripcion)));
  return v_id;
end $$;

-- Ingeniería contesta desde su pantalla (resolver_solicitud_cambio, de costeo) o
-- desde la orden (responder_solicitud_cambio, que además guarda la respuesta).
-- Por cualquiera de los dos caminos la orden se entera: lo pone el disparador.
create or replace function public.trg_solicitud_cambio_resuelta() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.orden_id is not null and new.estado <> old.estado and new.estado in ('aplicada', 'descartada') then
    insert into op_eventos (orden_id, tipo, nota)
    values (new.orden_id, 'nota', format('Ingeniería %s el cambio "%s"%s', case new.estado when 'aplicada' then 'aplicó' else 'descartó' end,
                                         new.descripcion, coalesce(': ' || new.respuesta, '')));
  end if;
  return new;
end $$;
drop trigger if exists resuelta on public.solicitudes_cambio_bom;
create trigger resuelta after update of estado on public.solicitudes_cambio_bom
  for each row execute function public.trg_solicitud_cambio_resuelta();

create or replace function public.responder_solicitud_cambio(p_id uuid, p_estado text, p_respuesta text default null) returns void
language plpgsql security definer set search_path = public as $$
declare s solicitudes_cambio_bom;
begin
  if not puede('costeo', 2) then raise exception 'Solo ingeniería resuelve cambios a la lista de materiales' using errcode = '42501'; end if;
  if p_estado not in ('aplicada', 'descartada') then raise exception 'Estado no válido: %', p_estado; end if;
  select * into s from solicitudes_cambio_bom where id = p_id for update;
  if s.id is null then raise exception 'No existe la solicitud'; end if;
  if s.estado <> 'pendiente' then raise exception 'Esa solicitud ya se resolvió'; end if;
  update solicitudes_cambio_bom set estado = p_estado, resuelto_por = auth.uid(), resuelto_en = now(),
    respuesta = nullif(trim(p_respuesta), '') where id = p_id;
end $$;

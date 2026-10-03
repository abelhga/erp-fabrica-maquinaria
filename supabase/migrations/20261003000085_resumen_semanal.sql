-- =============================================================================
-- Resumen semanal: lo que pasó la semana pasada (contra la anterior) y lo que
-- viene esta semana, con los permisos de quien lo pide.
--
-- Por qué: las juntas por área pasaron de semanales a mensuales (mar-2026) y la
-- foto de la semana se armaba preguntando en el chat. Los números salen de aquí,
-- sin IA; el asistente solo los narra y propone qué hacer (modo "semana").
-- security invoker: un vendedor ve lo de sus clientes; dirección ve todo.
-- =============================================================================

-- Operaciones de venta en un tramo, con la misma regla de arranque que ventas_entre:
-- antes de la fecha de arranque cuenta el historial de la hoja, después los pedidos.
create or replace function public.operaciones_entre(p_desde date, p_hasta date) returns int
language sql stable security invoker set search_path = public as $$
  with arranque as (select coalesce((select (valor #>> '{}')::date from configuracion where clave = 'fecha_arranque'), current_date) f)
  select coalesce((select count(distinct coalesce(nullif(h.factura, ''), nullif(h.pedido, ''), h.id::text))::int
                   from historial_ventas_hoja h, arranque
                   where h.tipo = 'Venta' and h.fecha between p_desde and p_hasta and h.fecha < arranque.f), 0)
       + coalesce((select count(*)::int from pedidos p, arranque
                   where p.estado <> 'cancelado' and not p.historico and p.fecha between p_desde and p_hasta and p.fecha >= arranque.f), 0)
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
      'atrasadas', (select count(*) from ordenes_produccion where fecha_compromiso < v_hoy and estado in ('planeada', 'liberada', 'en_proceso')),
      'en_proceso', (select count(*) from ordenes_produccion where estado = 'en_proceso'),
      'comprometidas', (select coalesce(jsonb_agg(jsonb_build_object('folio', o.folio, 'equipo', a.nombre, 'fecha', o.fecha_compromiso, 'estado', o.estado)
          order by o.fecha_compromiso), '[]')
        from ordenes_produccion o join articulos a on a.id = o.articulo_id
        where o.fecha_compromiso between v_lunes and v_fin and o.estado in ('planeada', 'liberada', 'en_proceso'))));
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

-- El lunes temprano, un aviso a quien usa el asistente con la liga a su semana. La
-- narración no se genera aquí: se arma cuando la persona la abre (con sus permisos),
-- así no se gasta en resúmenes que nadie lee.
create or replace function public.avisar_resumen_semanal() returns int
language plpgsql security definer set search_path = public as $$
declare v_lunes date := date_trunc('week', hoy_planta())::date;
begin
  return avisar(array(select usuarios_con_permiso('asistente', 1)), 'resumen_semanal',
    'Tu semana en Hegamex', format('Lo que pasó del %s al %s y lo que viene', to_char(v_lunes - 7, 'DD/MM'), to_char(v_lunes - 1, 'DD/MM')),
    '/semana', null, v_lunes::text, true);
end $$;
revoke execute on function public.avisar_resumen_semanal() from public, anon, authenticated;

do $$ begin
  perform cron.unschedule('resumen-semanal') where exists (select 1 from cron.job where jobname = 'resumen-semanal');
  -- Lunes 6:53 en la planta (12:53 UTC; México ya no cambia de horario).
  perform cron.schedule('resumen-semanal', '53 12 * * 1', 'select public.avisar_resumen_semanal()');
exception when others then
  raise notice 'pg_cron no está disponible: el aviso del resumen semanal queda apagado (%).', sqlerrm;
end $$;

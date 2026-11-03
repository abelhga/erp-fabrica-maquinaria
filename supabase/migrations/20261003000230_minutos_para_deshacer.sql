-- =============================================================================
-- Los minutos para deshacer se fijan en Configuración (0 = apagado).
--
-- Por qué: los 15 minutos para reabrir un pendiente o deshacer una salida (228, 229) eran fijos.
-- Dirección pidió poder bajarlos o apagarlos sin tocar código si ve que se usan de más. Se guardan
-- por área en configuracion.deshacer, lo cambian quienes ya cambian la configuración (sistemas y
-- dirección) y cada cambio queda en la bitácora. Fuera de 0 a 240 se recorta: un descuido no abre
-- la puerta a deshacer lo de ayer. Sin la clave, 15.
-- =============================================================================

insert into public.configuracion (clave, valor, descripcion)
values ('deshacer', '{"almacen": 15, "pendientes": 15}',
        'Minutos que tiene quien se equivocó para deshacer una salida o un traspaso de almacén, o reabrir un pendiente que cerró. 0 = apagado.')
on conflict (clave) do nothing;

create or replace function public.minutos_deshacer(p_area text) returns int
language sql stable security definer set search_path = public as $$
  select greatest(0, least(240, coalesce((select (valor->>p_area)::int from configuracion where clave = 'deshacer'), 15)))
$$;
revoke execute on function public.minutos_deshacer(text) from public, anon;
grant execute on function public.minutos_deshacer(text) to authenticated;

create or replace function public.reabrir_pendiente(p_pendiente uuid, p_motivo text default null) returns int
language plpgsql security definer set search_path = public as $$
declare
  p pendientes; n int; v_yo uuid := auth.uid(); v_quien text; v_cubiertos uuid[];
  v_motivo text := coalesce(nullif(trim(p_motivo), ''), 'lo había cerrado por error');
  v_min int := minutos_deshacer('pendientes');
begin
  select * into p from pendientes where id = p_pendiente for update;
  if p.id is null then raise exception 'No existe ese pendiente'; end if;
  if p.estado = 'abierto' then return 0; end if;
  if p.tabla = 'revision_hallazgos' then
    raise exception 'Este pendiente lo puso la revisión nocturna: contéstalo en «Por revisar»' using errcode = '42501';
  end if;
  if p.cerrado_por is distinct from v_yo then
    raise exception 'Solo quien lo cerró lo puede reabrir' using errcode = '42501';
  end if;
  if v_min = 0 then
    raise exception 'Reabrir pendientes está apagado en Configuración: pide un pendiente nuevo' using errcode = '23514';
  end if;
  if p.cerrado_en < now() - make_interval(mins => v_min) then
    raise exception 'Ya pasaron más de % minutos desde que se cerró: pide un pendiente nuevo', v_min using errcode = '23514';
  end if;
  select nombre into v_quien from perfiles where id = v_yo;
  -- Los del grupo que se cerraron en el mismo momento (al cancelar el pedido completo, o los que «lo
  -- hizo otra persona»): los cerró la misma persona hace menos de 15 minutos.
  select array_agg(responsable_id) into v_cubiertos from pendientes
  where p.grupo_id is not null and grupo_id = p.grupo_id and id <> p.id and estado = 'cubierto'
    and cerrado_por = v_yo and cerrado_en >= now() - make_interval(mins => v_min);
  perform set_config('hegamex.reabrir', '1', true);
  update pendientes set estado = 'abierto', cerrado_por = null, cerrado_en = null, nota_cierre = null
  where (id = p.id or (p.grupo_id is not null and grupo_id = p.grupo_id))
    and estado <> 'abierto' and cerrado_por = v_yo and cerrado_en >= now() - make_interval(mins => v_min);
  get diagnostics n = row_count;
  perform set_config('hegamex.reabrir', '0', true);

  insert into pendiente_mensajes (pendiente_id, autor_id, texto)
  values (p.id, v_yo, format('Lo reabrió %s (%s): %s.', coalesce(v_quien, 'alguien'),
                             case p.estado when 'hecho' then 'estaba hecho' else 'estaba cancelado' end, v_motivo));
  if p.estado = 'hecho' and p.creado_por is not null and p.creado_por <> v_yo then
    perform avisar(array[p.creado_por], 'pendiente_reabierto', 'Se reabrió: ' || p.titulo,
      format('%s: %s', coalesce(v_quien, 'alguien'), v_motivo), coalesce(p.ruta, '/pendientes'), 'pendientes', p.id::text);
  end if;
  if v_cubiertos is not null then
    perform avisar(v_cubiertos, 'pendiente_reabierto', 'Te vuelve a tocar: ' || p.titulo,
      format('%s lo reabrió: %s', coalesce(v_quien, 'alguien'), v_motivo), coalesce(p.ruta, '/pendientes'), 'pendientes', p.id::text);
  end if;
  return n;
end $$;

create or replace function public.deshacer_movimiento(p_movimiento bigint, p_motivo text) returns int
language plpgsql security definer set search_path = public as $$
declare
  m movimientos_inventario; o movimientos_inventario; s movimientos_inventario; e movimientos_inventario;
  f record; n int; v_t uuid; v_hora text; v_motivo text := trim(coalesce(p_motivo, ''));
  v_min int := minutos_deshacer('almacen');
begin
  if not puede('inventario', 2) then raise exception 'Solo almacén deshace movimientos' using errcode = '42501'; end if;
  if length(v_motivo) < 3 then raise exception 'Escribe por qué lo deshaces' using errcode = '23514'; end if;
  select * into m from movimientos_inventario where id = p_movimiento for update;
  if m.id is null then raise exception 'No existe ese movimiento'; end if;
  if m.deshace_id is not null then raise exception 'Ese movimiento ya es una corrección: no se deshace' using errcode = '23514'; end if;
  if exists (select 1 from movimientos_inventario where deshace_id = m.id)
     or (m.traspaso_id is not null and exists (select 1 from movimientos_inventario x join movimientos_inventario d on d.deshace_id = x.id
                                               where x.traspaso_id = m.traspaso_id)) then
    raise exception 'Ese movimiento ya se deshizo' using errcode = '23514';
  end if;
  if m.usuario_id is distinct from auth.uid() then
    raise exception 'Solo quien lo registró lo deshace. Si está mal, pide un ajuste' using errcode = '42501';
  end if;
  if v_min = 0 then
    raise exception 'Deshacer está apagado en Configuración: pide un ajuste y lo autoriza otra persona' using errcode = '23514';
  end if;
  if m.en < now() - make_interval(mins => v_min) then
    raise exception 'Pasaron más de % minutos: pide un ajuste y lo autoriza otra persona', v_min using errcode = '23514';
  end if;
  if m.tipo not in ('salida_venta', 'salida_consumo', 'traspaso_salida', 'traspaso_entrada') or m.orden_produccion_id is not null then
    raise exception 'Este movimiento no se deshace aquí: lo surtido a una orden, lo recibido de una compra y los ajustes se corrigen con un ajuste'
      using errcode = '23514';
  end if;
  -- Lo que registró otra pantalla (entregas, envíos, servicio) guarda el movimiento: se corrige desde ella.
  if exists (select 1 from pedido_salidas where m.id = any(movimientos)) then
    raise exception 'Es parte de una entrega de pedido: deshazla desde el pedido' using errcode = '23514';
  end if;
  for f in select cl.relname t, a.attname col from pg_constraint k join pg_class cl on cl.oid = k.conrelid
           join pg_attribute a on a.attrelid = k.conrelid and a.attnum = k.conkey[1]
           where k.confrelid = 'public.movimientos_inventario'::regclass and k.contype = 'f'
             and not (cl.relname = 'movimientos_inventario' and a.attname = 'deshace_id') loop
    execute format('select count(*) from public.%I where %I = $1', f.t, f.col) into n using m.id;
    if n > 0 then raise exception 'Lo registró otra pantalla (envío, servicio o mantenimiento): corrígelo desde ahí' using errcode = '23514'; end if;
  end loop;
  if m.traspaso_id is not null and exists (select 1 from envio_lineas where traspaso_id = m.traspaso_id) then
    raise exception 'Es parte de un envío a Full: corrígelo desde el envío' using errcode = '23514';
  end if;

  v_hora := to_char(m.en at time zone 'America/Mexico_City', 'HH24:MI');
  if m.tipo in ('salida_venta', 'salida_consumo') then
    insert into movimientos_inventario (tipo, articulo_id, almacen_id, cantidad, costo_unitario, pedido_id, recibio, motivo, deshace_id)
    values (m.tipo, m.articulo_id, m.almacen_id, -m.cantidad, m.costo_unitario, m.pedido_id, m.recibio,
            format('Se deshizo la salida de las %s: %s', v_hora, v_motivo), m.id);
    return 1;
  end if;

  -- Un traspaso: lo que llegó regresa a donde salió (si sigue ahí: el disparador revisa la existencia).
  select * into o from movimientos_inventario where traspaso_id = m.traspaso_id and id <> m.id;
  if o.id is null then raise exception 'No encuentro la otra mitad del traspaso: pide un ajuste'; end if;
  if m.tipo = 'traspaso_salida' then s := m; e := o; else s := o; e := m; end if;
  v_t := gen_random_uuid();
  insert into movimientos_inventario (tipo, articulo_id, almacen_id, cantidad, traspaso_id, motivo, deshace_id)
  values ('traspaso_salida', e.articulo_id, e.almacen_id, -e.cantidad, v_t, format('Se deshizo el traspaso de las %s: %s', v_hora, v_motivo), e.id);
  insert into movimientos_inventario (tipo, articulo_id, almacen_id, cantidad, traspaso_id, motivo, deshace_id)
  values ('traspaso_entrada', s.articulo_id, s.almacen_id, -s.cantidad, v_t, format('Se deshizo el traspaso de las %s: %s', v_hora, v_motivo), s.id);
  return 2;
end $$;

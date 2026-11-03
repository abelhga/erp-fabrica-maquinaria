-- =============================================================================
-- Deshacer una salida o un traspaso propio en los siguientes 15 minutos.
--
-- Por qué: el 30 oct Noemí le dio salida a un artículo que era de Mercado Libre. Un movimiento no se
-- edita ni se borra (así debe ser), y la única forma de corregirlo era pedir un ajuste y que otra
-- persona lo autorizara, para algo que ella misma vio al instante. Ahora, como en las entregas, quien
-- registró una salida o un traspaso lo deshace durante 15 minutos, con motivo. Después, ajuste.
--
-- Nada se borra: deshacer registra el movimiento contrario, ligado al original (deshace_id), con quién,
-- cuándo y por qué. Una salida se deshace con una salida del mismo tipo en positivo: así el consumo,
-- la demanda para el stock mínimo, las métricas de almacén y la revisión nocturna (que suman las
-- salidas con su signo) se compensan solas y no cuentan lo que no salió. Un traspaso se deshace con el
-- traspaso de regreso; si lo que llegó ya salió del destino, no se puede (la existencia no alcanza).
--
-- Lo que registró otra pantalla se corrige desde ella: entregas de pedidos (su propio «Deshacer»),
-- envíos, servicio y mantenimiento, el surtido a órdenes y la recepción de compras.
-- =============================================================================

alter table public.movimientos_inventario add column if not exists deshace_id bigint references public.movimientos_inventario(id);
create unique index if not exists movimientos_deshace on public.movimientos_inventario (deshace_id) where deshace_id is not null;
grant select (deshace_id) on public.movimientos_inventario to authenticated;

-- Una salida deshecha es la única que va en positivo, y solo ligada a la que deshace.
alter table public.movimientos_inventario drop constraint if exists movimientos_inventario_check;
alter table public.movimientos_inventario add constraint movimientos_inventario_check check (
  (tipo in ('inicial', 'entrada_compra', 'devolucion', 'traspaso_entrada', 'ajuste_entrada') and cantidad > 0)
  or (tipo in ('salida_produccion', 'salida_venta', 'salida_consumo', 'traspaso_salida', 'ajuste_salida') and cantidad < 0)
  or (deshace_id is not null and tipo in ('salida_venta', 'salida_consumo') and cantidad > 0));

create or replace function public.deshacer_movimiento(p_movimiento bigint, p_motivo text) returns int
language plpgsql security definer set search_path = public as $$
declare
  m movimientos_inventario; o movimientos_inventario; s movimientos_inventario; e movimientos_inventario;
  f record; n int; v_t uuid; v_hora text; v_motivo text := trim(coalesce(p_motivo, ''));
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
  if m.en < now() - interval '15 minutes' then
    raise exception 'Pasaron más de 15 minutos: pide un ajuste y lo autoriza otra persona' using errcode = '23514';
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
revoke execute on function public.deshacer_movimiento(bigint, text) from public, anon;
grant execute on function public.deshacer_movimiento(bigint, text) to authenticated;

-- Los movimientos con su liga: deshace_id (esta es la corrección de aquel) y deshecho_por (a este lo deshizo aquel).
create or replace view public.v_movimientos with (security_invoker = true) as
SELECT m.id,
    m.en,
    m.tipo,
    m.articulo_id,
    a.clave,
    a.nombre,
    a.unidad,
    m.almacen_id,
    al.nombre AS almacen,
    m.cantidad,
    cm.costo_unitario,
    m.motivo,
    m.fuera_de_lista,
    m.usuario_id,
    u.nombre AS usuario,
    m.orden_compra_id,
    oc.folio AS oc_folio,
    m.orden_produccion_id,
    op.folio AS op_folio,
    m.pedido_id,
    pe.folio AS pedido_folio,
    m.ajuste_id,
    aj.folio AS ajuste_folio,
    m.traspaso_id,
    t.almacen AS traspaso_almacen,
    COALESCE('OC '::text || oc.folio, op.folio || COALESCE(' · '::text || pe.folio, ''::text), pe.folio, aj.folio,
        CASE m.tipo
            WHEN 'traspaso_salida'::tipo_movimiento THEN 'a '::text || t.almacen
            WHEN 'traspaso_entrada'::tipo_movimiento THEN 'de '::text || t.almacen
            ELSE NULL::text
        END) AS referencia,
    m.recibio,
    m.deshace_id,
    ( SELECT d.id FROM movimientos_inventario d WHERE d.deshace_id = m.id) AS deshecho_por
   FROM movimientos_inventario m
     JOIN articulos a ON a.id = m.articulo_id
     JOIN almacenes al ON al.id = m.almacen_id
     LEFT JOIN perfiles u ON u.id = m.usuario_id
     LEFT JOIN v_ordenes_compra oc ON oc.id = m.orden_compra_id
     LEFT JOIN ordenes_produccion op ON op.id = m.orden_produccion_id
     LEFT JOIN pedidos_basicos() pe ON pe.id = m.pedido_id
     LEFT JOIN costos_movimientos() cm ON cm.movimiento_id = m.id
     LEFT JOIN ajustes_inventario aj ON aj.id = m.ajuste_id
     LEFT JOIN LATERAL ( SELECT al2.nombre AS almacen
           FROM movimientos_inventario m2
             JOIN almacenes al2 ON al2.id = m2.almacen_id
          WHERE m.traspaso_id IS NOT NULL AND m2.traspaso_id = m.traspaso_id AND m2.id <> m.id
         LIMIT 1) t ON true;

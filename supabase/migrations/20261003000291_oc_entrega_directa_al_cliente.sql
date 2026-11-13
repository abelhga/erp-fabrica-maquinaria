-- =============================================================================
-- Partida de OC con entrega directa al cliente (el proveedor la manda sin pasar por la planta).
--
-- Por qué: a veces una refacción que no hay en planta la manda Transbelt directo al cliente. Si
-- alguien recibía esa OC, las piezas «entraban» a un almacén donde nunca estuvieron; si nadie hacía
-- nada, el pedido se quedaba sin entregar en el ERP y la OC abierta. Con la captura tarde de Isaac
-- (13 nov) varias partidas salieron «sin inventario» justo por eso.
--
-- Cómo queda:
--   * oc_lineas.pedido_linea_id: la partida de la OC se liga a la partida del pedido que surte.
--   * oc_linea_directa(linea, pedido_linea | null): compras la marca o la desmarca (antes de recibir).
--   * entregado_directo(linea, cantidad, recibió, nota): cuando el proveedor entregó, en un solo paso
--     se recibe la OC (entrada con su costo, como siempre) y se entrega el pedido (salida al cliente)
--     en el mismo almacén: el inventario queda igual, el costo queda ligado al pedido y la OC y el
--     pedido avanzan. Lo hace quien recibe compras (compras, almacén, gerencia de producción).
--   * Una partida directa no se recibe con «Recibir» (entraría al almacén sin estar ahí).
--   * Si ventas ya pidió un envío «Directo del proveedor» para ese pedido, se cierra con la entrega
--     directa: es la misma entrega vista desde ventas.
-- =============================================================================

alter table public.oc_lineas add column if not exists pedido_linea_id uuid references public.pedido_lineas(id) on delete set null;

-- Las partidas de pedidos abiertos que puede surtir una partida de OC (mismo artículo, falta entregar).
create or replace function public.pedidos_para_directo(p_articulo uuid)
returns table (pedido_linea_id uuid, folio text, cliente text, pendiente numeric, fecha_compromiso date)
language sql stable security definer set search_path = public as $$
  select pl.id, p.folio, (select nombre from clientes where id = p.cliente_id),
         (pl.cantidad - coalesce(pl.cantidad_entregada, 0)) * coalesce(pl.piezas_por_venta, 1), p.fecha_compromiso
  from pedido_lineas pl join pedidos p on p.id = pl.pedido_id
  where (select puede('compras', 2)) and pl.articulo_id = p_articulo
    and p.estado in ('confirmado', 'en_produccion', 'listo') and pl.cantidad > coalesce(pl.cantidad_entregada, 0)
  order by p.fecha_compromiso nulls last, p.folio
$$;
revoke execute on function public.pedidos_para_directo(uuid) from public, anon;
grant execute on function public.pedidos_para_directo(uuid) to authenticated;

create or replace function public.oc_linea_directa(p_linea uuid, p_pedido_linea uuid) returns void
language plpgsql security definer set search_path = public as $$
declare l oc_lineas; o ordenes_compra; pl pedido_lineas;
begin
  if not puede('compras', 2) then raise exception 'La entrega directa la marca compras' using errcode = '42501'; end if;
  select * into l from oc_lineas where id = p_linea for update;
  if l.id is null then raise exception 'No existe la partida'; end if;
  select * into o from ordenes_compra where id = l.orden_compra_id;
  if o.estado not in ('borrador', 'enviada', 'parcial') then raise exception 'La orden ya está %', o.estado; end if;
  if l.recibido > 0 then raise exception 'Esta partida ya se empezó a recibir en almacén'; end if;
  if p_pedido_linea is not null then
    select * into pl from pedido_lineas where id = p_pedido_linea;
    if pl.id is null or pl.articulo_id is distinct from l.articulo_id then
      raise exception 'La partida del pedido no es del mismo artículo';
    end if;
    if not exists (select 1 from pedidos where id = pl.pedido_id and estado in ('confirmado', 'en_produccion', 'listo')) then
      raise exception 'Ese pedido ya no está abierto';
    end if;
  end if;
  update oc_lineas set pedido_linea_id = p_pedido_linea where id = p_linea;
end $$;
revoke execute on function public.oc_linea_directa(uuid, uuid) from public, anon;
grant execute on function public.oc_linea_directa(uuid, uuid) to authenticated;

-- «Recibir» no recibe una partida directa: entraría al almacén sin estar ahí.
do $$
declare d text; n text;
begin
  d := pg_get_functiondef('public.recibir_orden_compra(uuid, jsonb, text, boolean)'::regprocedure);
  n := replace(d, $a$    if v_linea.id is null then raise exception 'La partida no pertenece a esta orden'; end if;$a$,
    $a$    if v_linea.id is null then raise exception 'La partida no pertenece a esta orden'; end if;
    if v_linea.pedido_linea_id is not null and coalesce(current_setting('hegamex.entrega_directa', true), '0') <> '1' then
      raise exception 'Esta partida la entrega el proveedor directo al cliente: usa «Entregado directo» (no entra al almacén)' using errcode = '23514';
    end if;$a$);
  if n = d and position('hegamex.entrega_directa' in d) = 0 then raise exception 'recibir_orden_compra: no encontré dónde revisar la partida'; end if;
  if n <> d then execute n; end if;

  -- Quien recibe la entrega directa (compras, almacén) entrega el pedido en el mismo paso.
  d := pg_get_functiondef('public.entregar_pedido(uuid, text, text, text, jsonb)'::regprocedure);
  n := replace(d, $a$  if not puede_entregar(p.vendedor_id) then$a$,
    $a$  if not (puede_entregar(p.vendedor_id)
          or (coalesce(current_setting('hegamex.entrega_directa', true), '0') = '1' and puede('inventario', 2))) then$a$);
  if n = d and position('hegamex.entrega_directa' in d) = 0 then raise exception 'entregar_pedido: no encontré quién entrega'; end if;
  if n <> d then execute n; end if;
end $$;

create or replace function public.entregado_directo(p_linea uuid, p_cantidad numeric, p_recibio text, p_nota text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare l oc_lineas; o ordenes_compra; pl pedido_lineas; p pedidos; v_alm int; v_salida uuid; v_sale numeric; v_pend numeric;
begin
  if not puede('inventario', 2) then raise exception 'Lo registra quien recibe las compras (compras o almacén)' using errcode = '42501'; end if;
  select * into l from oc_lineas where id = p_linea for update;
  if l.id is null or l.pedido_linea_id is null then raise exception 'Esta partida no va directo a un cliente'; end if;
  select * into o from ordenes_compra where id = l.orden_compra_id;
  select * into pl from pedido_lineas where id = l.pedido_linea_id;
  select * into p from pedidos where id = pl.pedido_id;
  if coalesce(p_cantidad, 0) <= 0 then raise exception 'Escribe cuánto entregó el proveedor'; end if;
  if l.recibido + p_cantidad > l.cantidad then
    raise exception 'De esta partida faltan % por llegar, no %', trim_scale(l.cantidad - l.recibido), trim_scale(p_cantidad);
  end if;
  v_pend := (pl.cantidad - pl.cantidad_entregada) * coalesce(pl.piezas_por_venta, 1);
  if p_cantidad > v_pend then
    raise exception 'Al pedido % le faltan % por entregar, no %', p.folio, trim_scale(v_pend), trim_scale(p_cantidad);
  end if;
  if coalesce(length(trim(p_recibio)), 0) < 3 then raise exception 'Anota quién recibió' using errcode = '23514'; end if;

  -- Si ventas ya había pedido un envío «Directo del proveedor» para este pedido, es esta misma entrega:
  -- se cierra aquí (no lleva guía ni inventario) para que no quede abierto ni bloquee la entrega.
  update envios set estado = 'cancelado', cancelado_por = auth.uid(), cancelado_en = now(),
    motivo_cancelacion = format('Se registró como entrega directa en la OC %s', o.folio)
  where pedido_id = p.id and tipo = 'proveedor' and estado not in ('enviado', 'entregado', 'cancelado');
  if exists (select 1 from envios where pedido_id = p.id and estado not in ('enviado', 'entregado', 'cancelado')) then
    raise exception 'Este pedido tiene abierto el envío %: si lo mandó el proveedor, cancélalo en Envíos y vuelve a intentar',
      (select string_agg(folio, ', ') from envios where pedido_id = p.id and estado not in ('enviado', 'entregado', 'cancelado'))
      using errcode = '23514';
  end if;

  -- El almacén del que va a salir la entrega es el mismo al que entra: el inventario queda igual.
  v_alm := almacen_de_salida(l.articulo_id, p_cantidad);
  perform set_config('hegamex.entrega_directa', '1', true);
  perform recibir_orden_compra(o.id, jsonb_build_array(jsonb_build_object('linea_id', l.id, 'cantidad', p_cantidad, 'almacen_id', v_alm)), null, true);
  v_salida := entregar_pedido(p.id, p_recibio,
    concat_ws(' · ', format('Directo del proveedor (OC %s)', o.folio), nullif(trim(p_nota), '')), null,
    jsonb_build_array(jsonb_build_object('id', pl.id, 'cantidad', p_cantidad / coalesce(pl.piezas_por_venta, 1))));
  perform set_config('hegamex.entrega_directa', '0', true);

  -- Si por apartados de otros la salida no pudo descontar, no se deja la entrada sola (inflaría el inventario).
  select coalesce(-sum(cantidad), 0) into v_sale from movimientos_inventario
  where pedido_id = p.id and articulo_id = l.articulo_id and tipo = 'salida_venta'
    and id = any(coalesce((select movimientos from pedido_salidas where id = v_salida), '{}'));
  if v_sale < p_cantidad then
    raise exception 'No se pudo registrar la salida al cliente (lo de planta está apartado para otras órdenes): revisa los apartados de % antes de registrar la entrega directa',
      (select clave from articulos where id = l.articulo_id) using errcode = '23514';
  end if;
  return v_salida;
end $$;
revoke execute on function public.entregado_directo(uuid, numeric, text, text) from public, anon;
grant execute on function public.entregado_directo(uuid, numeric, text, text) to authenticated;

-- Folio y cliente del pedido al que va una partida directa: compras no lee pedidos (tienen montos),
-- pero sí necesita saber a quién va lo que compró.
create or replace function public._pedido_de_linea(p_pedido_linea uuid) returns text
language sql stable security definer set search_path = public as $$
  select p.folio || ' · ' || coalesce((select nombre from clientes where id = p.cliente_id), '')
  from pedido_lineas pl join pedidos p on p.id = pl.pedido_id where pl.id = p_pedido_linea
$$;
revoke execute on function public._pedido_de_linea(uuid) from public, anon;
grant execute on function public._pedido_de_linea(uuid) to authenticated;

-- La lista de partidas de la OC dice a qué pedido va directo.
-- Igual que 069: la vista decide quién ve las filas (permiso) y quién ve el dinero; no pasa por la RLS de oc_lineas.
create or replace view public.v_oc_lineas with (security_invoker = false) as
 WITH permiso AS (
         SELECT ve_costos_compra() AS dinero,
            (puede('compras'::text, 1) OR puede('finanzas'::text, 1) OR puede('inventario'::text, 2) OR puede('produccion'::text, 2)) AS fila
        )
 SELECT l.id, l.orden_compra_id, l.articulo_id, COALESCE(a.nombre, l.descripcion) AS nombre, l.descripcion, a.clave,
    COALESCE(a.unidad, 'pieza'::text) AS unidad, a.empaque, a.almacen_preferido_id, l.cantidad,
    CASE WHEN permiso.dinero THEN l.costo_unitario ELSE NULL::numeric END AS costo_unitario,
    CASE WHEN permiso.dinero THEN l.importe ELSE NULL::numeric END AS importe,
    l.recibido, GREATEST(l.cantidad - l.recibido, 0::numeric) AS pendiente,
    (SELECT string_agg(DISTINCT COALESCE(op.folio, r.folio), ', '::text)
       FROM requisicion_lineas rl JOIN requisiciones r ON r.id = rl.requisicion_id
       LEFT JOIN ordenes_produccion op ON op.id = rl.orden_produccion_id
      WHERE rl.oc_linea_id = l.id) AS para,
    l.pedido_linea_id,
    CASE WHEN l.pedido_linea_id IS NOT NULL THEN _pedido_de_linea(l.pedido_linea_id) END AS directo_a
   FROM oc_lineas l CROSS JOIN permiso LEFT JOIN articulos a ON a.id = l.articulo_id
  WHERE permiso.fila;

-- =============================================================================
-- Ventas de Mercado Libre: el total del pedido es lo que cobró ML, al centavo.
--
-- Por qué: al registrar una venta de ML, cada partida guarda el precio sin IVA redondeado a centavos
-- (precio ÷ 1.16, y ÷ piezas cuando la publicación es un paquete). El total del pedido se rehacía
-- desde ahí y quedaba unos centavos arriba o abajo de lo cobrado: 20 de 42 ventas de ML no cuadraban
-- (ML-26-0016 decía $388.99 y se cobraron $389; el paquete de 24 cangilones, $14,500.19 por $14,500),
-- y cobranza las veía con saldo de centavos.
--
-- Ahora cada partida de ML guarda el precio con IVA de cada venta tal como lo cobró ML y cuántas
-- piezas lleva cada venta. El total del pedido sale de ahí; el IVA es la diferencia contra el subtotal,
-- así que el centavo lo absorbe el IVA y no el cliente. Si después se liga la publicación con otras
-- piezas (paquete de 24 en vez de 1), las ventas y el dinero no cambian: solo las piezas por venta.
-- Ese precio solo lo pone la conexión con ML; nadie lo cambia desde la pantalla.
-- Las ventas que ya existían toman su precio de la orden original que guardó la conexión (ml_crudo).
-- =============================================================================

alter table public.pedido_lineas add column if not exists precio_con_iva numeric(14,2),
  add column if not exists piezas_por_venta numeric(14,4) not null default 1;

create or replace function public.pedido_linea_precio_canal() returns trigger
language plpgsql set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if new.precio_con_iva is not null and auth.uid() is not null then
      raise exception 'El precio con IVA de una venta de Mercado Libre lo pone la conexión con ML' using errcode = '42501';
    end if;
    return new;
  end if;
  if new.precio_con_iva is distinct from old.precio_con_iva and auth.uid() is not null then
    raise exception 'El precio con IVA de una venta de Mercado Libre lo pone la conexión con ML' using errcode = '42501';
  end if;
  -- Ligar o corregir la publicación cambia las piezas, no cuántas ventas ni cuánto se cobró.
  if new.precio_con_iva is not null and new.cantidad is distinct from old.cantidad and old.cantidad > 0 then
    new.piezas_por_venta := round(old.piezas_por_venta * new.cantidad / old.cantidad, 4);
  elsif new.piezas_por_venta is distinct from old.piezas_por_venta and auth.uid() is not null then
    new.piezas_por_venta := old.piezas_por_venta;
  end if;
  return new;
end $$;
drop trigger if exists precio_canal on public.pedido_lineas;
create trigger precio_canal before insert or update on public.pedido_lineas
  for each row execute function public.pedido_linea_precio_canal();

-- Total: las partidas con precio del canal suman lo cobrado; las demás, subtotal más IVA como siempre.
create or replace function public.totales_pedido(p_id uuid) returns void
language sql security definer set search_path = public as $$
  update pedidos p set subtotal = t.sub,
    iva = case when t.bruto is not null and p.tasa_iva > 0
               then t.bruto - t.sub_canal + round((t.sub - t.sub_canal) * p.tasa_iva, 2)
               else round(t.sub * p.tasa_iva, 2) end,
    total = t.sub + case when t.bruto is not null and p.tasa_iva > 0
               then t.bruto - t.sub_canal + round((t.sub - t.sub_canal) * p.tasa_iva, 2)
               else round(t.sub * p.tasa_iva, 2) end
  from (select coalesce(sum(importe), 0) sub,
               sum(round(cantidad / nullif(piezas_por_venta, 0) * precio_con_iva, 2)) bruto,
               coalesce(sum(importe) filter (where precio_con_iva is not null), 0) sub_canal
        from pedido_lineas where pedido_id = p_id) t
  where p.id = p_id
$$;

-- Las ventas nuevas guardan el precio de ML y las piezas por venta.
create or replace function public.ml_registrar_orden(p jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_ped pedidos; it jsonb; v_art uuid; v_pzas numeric; v_orden int := 0; v_sin text[] := '{}'; v_full boolean := coalesce((p->>'full')::boolean, false);
  v_envio jsonb := jsonb_build_object('order_id', p->>'id', 'estado', p->>'envio_estado', 'subestado', p->>'envio_sub', 'guia', p->>'guia');
begin
  if auth.uid() is not null then raise exception 'Las ventas de Mercado Libre las registra la conexión con ML' using errcode = '42501'; end if;
  if nullif(p->>'id', '') is null then raise exception 'Falta el número de venta'; end if;
  select * into v_ped from pedidos where canal = 'mercadolibre' and id_externo = p->>'id';

  if v_ped.id is not null then
    insert into ml_ventas (order_id, pedido_id, full_ml, pack_id, comprador, estado, envio_ml, envio_id, envio_sub, guia, envio_tipo)
    values (p->>'id', v_ped.id, v_full, p->>'pack_id', p->>'comprador', p->>'estado', nullif(p->>'envio_estado', ''),
            nullif(p->>'envio_id', ''), nullif(p->>'envio_sub', ''), nullif(p->>'guia', ''), nullif(p->>'envio_tipo', ''))
    on conflict (order_id) do update set estado = excluded.estado, pedido_id = excluded.pedido_id,
      envio_ml = coalesce(excluded.envio_ml, ml_ventas.envio_ml), envio_id = coalesce(excluded.envio_id, ml_ventas.envio_id),
      envio_tipo = coalesce(excluded.envio_tipo, ml_ventas.envio_tipo), actualizado_en = now();
    if p->>'estado' = 'cancelled' and v_ped.estado not in ('cancelado', 'entregado') then
      update pedidos set estado = 'cancelado', motivo_cancelacion = 'Cancelada en Mercado Libre' where id = v_ped.id;
      update envios set estado = 'cancelado' where pedido_id = v_ped.id and estado in ('solicitado', 'cotizado');
      perform avisar(ml_atienden(), 'ml_cancelada', 'Venta de ML cancelada: ' || v_ped.folio,
        'Mercado Libre canceló la venta ' || (p->>'id') || '. Si ya estaba empacada, no la mandes.', '/ventas/pedidos/' || v_ped.id, 'pedidos', v_ped.id::text);
    end if;
    perform _ml_pagos(v_ped.id, p->>'id', p->'pagos');
    if p->>'estado' <> 'cancelled' then perform ml_sincronizar_envio(v_envio); end if;
    return v_ped.id;
  end if;
  if coalesce(p->>'estado', '') <> 'paid' then return null; end if;
  if not ml_ventas_activas() then return null; end if;
  -- Todo de la otra tienda: no es venta de Hegamex.
  if not exists (select 1 from jsonb_array_elements(coalesce(p->'items', '[]')) x
                 where not exists (select 1 from ml_publicaciones_ajenas a where a.item_id = x->>'item_id')) then
    return null;
  end if;

  insert into pedidos (cliente_id, vendedor_id, canal, id_externo, fecha, estado, moneda, condiciones_pago, notas)
  values (ml_cliente_publico(), nullif((select valor->>'responsable_id' from configuracion where clave = 'mercadolibre'), '')::uuid,
    'mercadolibre', p->>'id',
    coalesce(((p->>'fecha')::timestamptz at time zone 'America/Mexico_City')::date, hoy_planta()),
    'confirmado', 'MXN', 'Pagado en Mercado Libre',
    concat_ws(' · ', 'Venta de Mercado Libre' || case when v_full then ' (Full)' else '' end, 'comprador ' || nullif(p->>'comprador', '')))
  returning * into v_ped;
  insert into ml_ventas (order_id, pedido_id, full_ml, pack_id, comprador, estado, envio_ml, envio_id, envio_sub, guia, envio_tipo)
  values (p->>'id', v_ped.id, v_full, p->>'pack_id', p->>'comprador', p->>'estado', nullif(p->>'envio_estado', ''),
          nullif(p->>'envio_id', ''), nullif(p->>'envio_sub', ''), nullif(p->>'guia', ''), nullif(p->>'envio_tipo', ''))
  on conflict (order_id) do update set pedido_id = excluded.pedido_id, estado = excluded.estado,
    envio_ml = coalesce(excluded.envio_ml, ml_ventas.envio_ml), envio_id = coalesce(excluded.envio_id, ml_ventas.envio_id),
    envio_tipo = coalesce(excluded.envio_tipo, ml_ventas.envio_tipo), actualizado_en = now();

  for it in select * from jsonb_array_elements(coalesce(p->'items', '[]')) loop
    continue when exists (select 1 from ml_publicaciones_ajenas a where a.item_id = it->>'item_id');
    v_art := null; v_pzas := null;
    select articulo_id, piezas_por_paquete into v_art, v_pzas from publicaciones where canal = 'mercadolibre' and id_externo = it->>'item_id';
    v_pzas := coalesce(nullif(v_pzas, 0), 1);
    if v_art is null and nullif(trim(it->>'sku'), '') is not null then
      select id into v_art from articulos where upper(clave) = upper(trim(it->>'sku')) and activo limit 1;
      if v_art is not null then
        insert into publicaciones (articulo_id, canal, id_externo, titulo, precio)
        values (v_art, 'mercadolibre', it->>'item_id', it->>'titulo', (it->>'precio')::numeric)
        on conflict (canal, id_externo) do nothing;
      end if;
    end if;
    if v_art is null then
      insert into ml_publicaciones_sin_ligar (item_id, titulo, sku, precio) values (it->>'item_id', it->>'titulo', nullif(trim(it->>'sku'), ''), (it->>'precio')::numeric)
      on conflict (item_id) do update set veces = ml_publicaciones_sin_ligar.veces + 1, visto_en = now(), titulo = excluded.titulo, precio = excluded.precio;
      v_sin := array_append(v_sin, coalesce(it->>'titulo', it->>'item_id'));
    end if;
    v_orden := v_orden + 1;
    insert into pedido_lineas (pedido_id, orden, articulo_id, titulo, unidad, cantidad, precio_unitario, linea, referencia_externa,
                               precio_con_iva, piezas_por_venta)
    values (v_ped.id, v_orden, v_art, coalesce(it->>'titulo', 'Publicación ' || (it->>'item_id')),
      coalesce((select unidad from articulos where id = v_art), 'pieza'), greatest(coalesce((it->>'cantidad')::numeric, 1), 0.001) * v_pzas,
      round(coalesce((it->>'precio')::numeric, 0) / 1.16 / v_pzas, 2), case when v_art is null then 'refacciones' else linea_de(v_art) end, it->>'item_id',
      (it->>'precio')::numeric, v_pzas);
  end loop;

  perform ml_envio_si_falta(v_ped.id);
  if cardinality(v_sin) > 0 then
    perform avisar(ml_atienden(), 'ml_por_ligar', 'Venta de ML con publicación sin ligar: ' || v_ped.folio,
      'No sé qué artículo es «' || array_to_string(v_sin, '», «') || '». El envío ya está pedido; lígala una vez (o almacén al empacar). Si no es de Hegamex, márcala así.',
      '/ventas/mercadolibre?seccion=ligar', 'pedidos', v_ped.id::text);
  end if;
  perform _ml_pagos(v_ped.id, p->>'id', p->'pagos');
  perform ml_sincronizar_envio(v_envio);
  return v_ped.id;
end $$;


-- Las que ya existían: precio y piezas por venta de la orden original de ML.
with x as (
  select l.id, max((it->>'unit_price')::numeric) precio, sum((it->>'quantity')::numeric) ventas
  from public.pedido_lineas l
  join public.pedidos p on p.id = l.pedido_id and p.canal = 'mercadolibre'
  join public.ml_ventas v on v.pedido_id = p.id
  join public.ml_crudo c on c.order_id = v.order_id
  cross join lateral jsonb_array_elements(c.orden->'order_items') it
  where it->'item'->>'id' = l.referencia_externa and l.precio_con_iva is null
  group by l.id)
update public.pedido_lineas l set precio_con_iva = x.precio, piezas_por_venta = round(l.cantidad / x.ventas, 4)
from x where l.id = x.id and x.ventas > 0 and x.precio > 0;

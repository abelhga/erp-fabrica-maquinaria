-- =============================================================================
-- Ventas de Mercado Libre que se ven como son: pagadas, con lo que ML se queda y con el
-- envío al día.
--
-- Lo que no le gustó a dirección de las tres ventas que trajo «Traer lo pendiente»:
--   * Salían sin pagar. El pedido decía «Pagado en Mercado Libre», pero sin cobro registrado
--     el saldo era el total. Ahora el pago aprobado entra como cobro por Mercado Pago, con su
--     fecha; si ML lo reembolsa, entra el reembolso en negativo.
--   * No se veía lo que se resta. Con las ventas de verdad de la cuenta (ml_crudo, 164) se vio
--     que el pago de Mercado Pago lo trae desglosado en charges_details: meli_fee (comisión),
--     shp_* (el envío que paga Hegamex), tax_withholding-iva y tax_withholding-isr (retenciones:
--     8 % y 2.5 % sobre el precio sin IVA), y net_received_amount (lo que llega). Ejemplo real:
--     $1,480 − 177.60 − 84.50 − 102.07 − 31.90 = $1,083.93. Se guarda por pago en ml_pagos.
--   * El envío salía «no enviado» aunque ML ya lo llevaba. Nadie le contaba al ERP: el aviso de
--     la venta no llega cuando cambia el envío. Ahora con el tópico «shipments» (se activa en la
--     aplicación de ML) y en cada aviso de la venta, el envío del ERP sigue al de ML: guía lista,
--     en camino (con su salida de inventario) y entregado (el pedido queda entregado).
-- Además: Full se detectaba con logistic_type, que el formato nuevo del envío ya no trae
-- (ahora es logistic.type): se corrige en la función de borde.
-- =============================================================================

alter table public.ml_ventas add column if not exists envio_id text;
alter table public.ml_ventas add column if not exists envio_sub text;
alter table public.ml_ventas add column if not exists guia text;
alter table public.ml_ventas add column if not exists envio_tipo text;
create index if not exists ml_ventas_envio on public.ml_ventas (envio_id);

-- El dinero de cada pago de una venta. Aparte de ml_ventas, que también lee almacén (envíos):
-- la planta no ve montos de pedidos (147).
create table if not exists public.ml_pagos (
  pago_id text primary key,
  order_id text not null references public.ml_ventas(order_id) on delete cascade,
  estado text,                       -- approved, refunded, cancelled…
  pagado_en timestamptz,
  metodo text,                       -- tarjeta, OXXO…
  total numeric(14,2) not null default 0,         -- lo que pagó el comprador por lo vendido (con IVA)
  comision numeric(14,2) not null default 0,      -- meli_fee
  envio numeric(14,2) not null default 0,         -- el envío que paga Hegamex (shp_*)
  retencion_iva numeric(14,2) not null default 0,
  retencion_isr numeric(14,2) not null default 0,
  otros numeric(14,2) not null default 0,         -- cualquier otro cargo al vendedor (meses sin intereses…)
  reembolsado numeric(14,2) not null default 0,   -- lo que se le regresó al comprador
  neto numeric(14,2),                             -- lo que llega a Mercado Pago (net_received_amount)
  libera_en timestamptz,                          -- cuándo queda disponible en Mercado Pago
  liberado boolean not null default false,
  completo boolean not null default false,        -- false: no se pudo leer el detalle de Mercado Pago
  cargos jsonb,                                   -- el desglose tal cual (nombre, tipo, monto, reembolsado)
  actualizado_en timestamptz not null default now()
);
create index if not exists ml_pagos_orden on public.ml_pagos (order_id);
alter table public.ml_pagos enable row level security;
drop policy if exists ver on public.ml_pagos;
create policy ver on public.ml_pagos for select to authenticated using ((select puede('ventas', 1)) or (select puede('finanzas', 1)));

-- Guarda los pagos de una venta y registra su cobro (y su reembolso) una sola vez.
create or replace function public._ml_pagos(p_pedido uuid, p_order text, p_pagos jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare x jsonb; v_ped pedidos; v_ref text; v_fecha date;
begin
  for x in select * from jsonb_array_elements(coalesce(p_pagos, '[]')) loop
    continue when nullif(x->>'id', '') is null;
    insert into ml_pagos (pago_id, order_id, estado, pagado_en, metodo, total, comision, envio, retencion_iva, retencion_isr, otros,
                          reembolsado, neto, libera_en, liberado, completo, cargos, actualizado_en)
    values (x->>'id', p_order, x->>'estado', (x->>'pagado_en')::timestamptz, x->>'metodo', coalesce((x->>'total')::numeric, 0),
            coalesce((x->>'comision')::numeric, 0), coalesce((x->>'envio')::numeric, 0), coalesce((x->>'retencion_iva')::numeric, 0),
            coalesce((x->>'retencion_isr')::numeric, 0), coalesce((x->>'otros')::numeric, 0), coalesce((x->>'reembolsado')::numeric, 0),
            (x->>'neto')::numeric, (x->>'libera_en')::timestamptz, coalesce((x->>'liberado')::boolean, false),
            coalesce((x->>'completo')::boolean, false), x->'cargos', now())
    on conflict (pago_id) do update set estado = excluded.estado, pagado_en = excluded.pagado_en, metodo = excluded.metodo,
      total = excluded.total, comision = excluded.comision, envio = excluded.envio, retencion_iva = excluded.retencion_iva,
      retencion_isr = excluded.retencion_isr, otros = excluded.otros, reembolsado = excluded.reembolsado, neto = excluded.neto,
      libera_en = excluded.libera_en, liberado = excluded.liberado,
      -- Un aviso que no pudo leer Mercado Pago no borra el detalle que ya se tenía.
      completo = excluded.completo or ml_pagos.completo, cargos = coalesce(excluded.cargos, ml_pagos.cargos), actualizado_en = now();

    continue when p_pedido is null;
    select * into v_ped from pedidos where id = p_pedido;
    v_ref := 'Mercado Pago ' || (x->>'id');
    v_fecha := coalesce(((x->>'pagado_en')::timestamptz at time zone 'America/Mexico_City')::date, hoy_planta());
    -- El comprador ya pagó: entra el cobro (el dinero llega a la cuenta de Mercado Pago). Si no
    -- se puede (no cuadra con el pedido), la venta no se frena: queda anotado para revisarlo.
    if x->>'estado' in ('approved', 'refunded', 'charged_back') and coalesce((x->>'total')::numeric, 0) > 0
       and v_ped.estado <> 'cancelado'
       and not exists (select 1 from cobros where pedido_id = p_pedido and referencia = v_ref) then
      begin
        insert into cobros (pedido_id, fecha, monto, metodo, referencia, notas)
        values (p_pedido, v_fecha, (x->>'total')::numeric, 'mercadopago', v_ref,
          'Pagado en Mercado Libre (venta ' || p_order || '). Llega a la cuenta de Mercado Pago'
          || coalesce(' el ' || to_char(((x->>'libera_en')::timestamptz at time zone 'America/Mexico_City')::date, 'DD/MM/YYYY'), '') || '.');
      exception when others then
        update ml_ventas set nota = 'No se pudo registrar el cobro solo: ' || sqlerrm, actualizado_en = now() where order_id = p_order;
      end;
    end if;
    -- Lo que ML le regresó al comprador sale como cobro en negativo (una vez).
    if coalesce((x->>'reembolsado')::numeric, 0) > 0
       and exists (select 1 from cobros where pedido_id = p_pedido and referencia = v_ref)
       and not exists (select 1 from cobros where pedido_id = p_pedido and referencia = 'Reembolso ' || v_ref) then
      insert into cobros (pedido_id, fecha, monto, metodo, referencia, notas)
      values (p_pedido, hoy_planta(), -(x->>'reembolsado')::numeric, 'mercadopago', 'Reembolso ' || v_ref,
              'Mercado Libre le regresó el dinero al comprador (venta ' || p_order || ').');
    end if;
  end loop;
end $$;
revoke execute on function public._ml_pagos(uuid, text, jsonb) from public, anon, authenticated;

-- El envío del ERP sigue al de Mercado Libre: guía, en camino, entregado. p: envio_id (o
-- order_id), estado, subestado, guia. Lo llama la conexión con ML (sin sesión).
create or replace function public.ml_sincronizar_envio(p jsonb)
returns int language plpgsql security definer set search_path = public as $$
declare v ml_ventas; e envios; v_est text := nullif(p->>'estado', ''); v_guia text := nullif(p->>'guia', '');
  v_nota text; v_n int := 0;
begin
  if auth.uid() is not null then raise exception 'El envío de Mercado Libre lo actualiza la conexión con ML' using errcode = '42501'; end if;
  -- Un envío puede llevar varias ventas (las del mismo carrito).
  for v in select * from ml_ventas
           where (nullif(p->>'envio_id', '') is not null and envio_id = p->>'envio_id')
              or (nullif(p->>'order_id', '') is not null and order_id = p->>'order_id') loop
    v_n := v_n + 1;
    update ml_ventas set envio_ml = coalesce(v_est, envio_ml), envio_sub = nullif(p->>'subestado', ''),
      guia = coalesce(v_guia, guia), actualizado_en = now() where order_id = v.order_id;
    continue when v.pedido_id is null or v_est is null;

    select * into e from envios where pedido_id = v.pedido_id and estado <> 'cancelado' order by solicitado_en desc limit 1;
    if e.id is not null then
      if v_guia is not null and e.numero_guia is null then update envios set numero_guia = v_guia where id = e.id; end if;
      -- ML ya hizo la guía: almacén la imprime desde ML y empaca.
      if v_est = 'ready_to_ship' and v_guia is not null and e.estado in ('solicitado', 'cotizado') then
        update envios set estado = 'guia_lista', guia_en = now() where id = e.id;
        insert into eventos_envio (envio_id, tipo, nota) values (e.id, 'guia', 'Mercado Libre generó la guía ' || v_guia);
      end if;
      -- En camino: sale del inventario (una sola vez) aunque en el ERP no se haya marcado.
      if v_est in ('shipped', 'delivered') and e.estado not in ('enviado', 'entregado') then
        v_nota := null;
        begin
          perform _dar_salida(e.id);
        exception when others then
          v_nota := 'no se pudo descontar el inventario solo (' || sqlerrm || '): revísalo en el envío';
        end;
        update envios set estado = 'enviado', enviado_en = now(), numero_guia = coalesce(numero_guia, v_guia) where id = e.id;
        insert into eventos_envio (envio_id, tipo, nota) values (e.id, 'enviado', concat_ws(' · ',
          case when e.tipo = 'full' then 'Lo surtió Full' else 'Mercado Libre lo reporta en camino' end,
          'guía ' || coalesce(v_guia, e.numero_guia),
          case when e.tipo <> 'full' and e.empacado_en is null then 'sin empaque registrado en el ERP' end, v_nota));
      end if;
      if v_est = 'delivered' and e.estado <> 'entregado' then
        update envios set estado = 'entregado', entregado_en = now() where id = e.id;
        perform _entregar_en_pedido(e.id);
        insert into eventos_envio (envio_id, tipo, nota) values (e.id, 'entregado', 'Entregado según Mercado Libre');
      end if;
    elsif v_est = 'delivered' then
      -- Sin envío en el ERP (una venta traída cuando ML ya la había mandado): el pedido se entregó.
      update pedido_lineas set cantidad_entregada = cantidad where pedido_id = v.pedido_id and cantidad_entregada <> cantidad;
      update pedidos set estado = 'entregado', entregado_en = coalesce(entregado_en, now())
      where id = v.pedido_id and estado not in ('entregado', 'cancelado');
    end if;
  end loop;
  return v_n;
end $$;
-- Solo la conexión con ML (llave de servicio): con sesión, la función misma lo rechaza.
revoke execute on function public.ml_sincronizar_envio(jsonb) from public, anon, authenticated;

-- La venta: lo mismo que en 134, más los datos del envío, los pagos y el envío al día.
create or replace function public.ml_registrar_orden(p jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_ped pedidos; it jsonb; v_art uuid; v_pzas int; v_orden int := 0; v_sin text[] := '{}'; v_full boolean := coalesce((p->>'full')::boolean, false);
  v_envio jsonb := jsonb_build_object('order_id', p->>'id', 'estado', p->>'envio_estado', 'subestado', p->>'envio_sub', 'guia', p->>'guia');
begin
  if auth.uid() is not null then raise exception 'Las ventas de Mercado Libre las registra la conexión con ML' using errcode = '42501'; end if;
  if nullif(p->>'id', '') is null then raise exception 'Falta el número de venta'; end if;
  select * into v_ped from pedidos where canal = 'mercadolibre' and id_externo = p->>'id';

  if v_ped.id is not null then
    -- Ya estaba (capturada a mano antes de conectar, o un aviso repetido): se pone al día.
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
  -- Solo las pagadas son venta; las demás (pago pendiente, canceladas antes de pagar) no.
  if coalesce(p->>'estado', '') <> 'paid' then return null; end if;
  -- Con las ventas apagadas no se registra nada nuevo (se pueden traer después con una fecha).
  if not ml_ventas_activas() then return null; end if;

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
    select articulo_id, piezas_por_paquete into v_art, v_pzas from publicaciones where canal = 'mercadolibre' and id_externo = it->>'item_id';
    v_pzas := greatest(coalesce(v_pzas, 1), 1);
    -- El SKU de la publicación es la clave del ERP: se liga sola la primera vez.
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
    insert into pedido_lineas (pedido_id, orden, articulo_id, titulo, unidad, cantidad, precio_unitario, linea, referencia_externa)
    values (v_ped.id, v_orden, v_art, coalesce(it->>'titulo', 'Publicación ' || (it->>'item_id')),
      coalesce((select unidad from articulos where id = v_art), 'pieza'), greatest(coalesce((it->>'cantidad')::numeric, 1), 0.001) * v_pzas,
      round(coalesce((it->>'precio')::numeric, 0) / 1.16 / v_pzas, 2), case when v_art is null then 'refacciones' else linea_de(v_art) end, it->>'item_id');
  end loop;

  if cardinality(v_sin) = 0 then
    perform ml_envio_si_falta(v_ped.id);
  else
    perform avisar(ml_atienden(), 'ml_por_ligar', 'Venta de ML con publicación sin ligar: ' || v_ped.folio,
      'No sé qué artículo es «' || array_to_string(v_sin, '», «') || '». Lígala una vez y el envío se pide solo.',
      '/ventas/mercadolibre?seccion=ligar', 'pedidos', v_ped.id::text);
  end if;
  -- Pagada en ML: el cobro entra ya, con lo que se queda ML. Y el envío, como va en ML.
  perform _ml_pagos(v_ped.id, p->>'id', p->'pagos');
  perform ml_sincronizar_envio(v_envio);
  return v_ped.id;
end $$;

-- El dinero de Mercado Libre por venta, para la pestaña «Dinero» y la ficha del pedido.
create or replace view public.v_ml_dinero with (security_invoker = true) as
select g.pago_id, g.order_id, v.pedido_id, pe.folio, v.comprador, v.full_ml, v.envio_ml, g.estado, g.pagado_en, g.metodo,
  g.total, g.comision, g.envio, g.retencion_iva, g.retencion_isr, g.otros, g.reembolsado, g.neto, g.libera_en,
  (g.liberado or g.libera_en <= now()) as disponible, g.completo, g.cargos
from public.ml_pagos g
join public.ml_ventas v on v.order_id = g.order_id
left join public.pedidos pe on pe.id = v.pedido_id;

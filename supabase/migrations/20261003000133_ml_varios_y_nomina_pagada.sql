-- =============================================================================
-- Mercado Libre lo atienden varias personas, y la nómina pagada se ve en la prenómina.
--
-- 1. Mercado Libre tenía un solo "responsable": a él le llegaban los avisos de ventas por
--    ligar, reclamos y preguntas, y las ventas quedaban a su nombre. Lo atienden Juan Carlos
--    y Susana. Ahora configuracion.mercadolibre.atienden es una lista (los avisos llegan a
--    todos) y responsable_id queda solo como "las ventas van a nombre de" (una persona, por
--    la comisión; vacío = sin vendedor). Si nadie está elegido, sigue llegando a dirección.
-- 2. RRHH calcula la prenómina pero no sabía si finanzas ya la pagó (el pago vive en
--    finanzas, que RRHH no ve). pagar_semana_nomina deja la semana cerrada como "Pagada el
--    …, de …": registra la compra y el pago en la cuenta de la nómina (sale en Pagos hechos,
--    filtro Nómina e impuestos) y le avisa a RRHH. RRHH ve solo eso, no los demás pagos.
-- =============================================================================

-- 1. Mercado Libre ------------------------------------------------------------
update public.configuracion set valor = valor || jsonb_build_object('atienden',
    case when valor->>'responsable_id' is not null then jsonb_build_array(valor->>'responsable_id') else '[]'::jsonb end)
where clave = 'mercadolibre' and not (valor ? 'atienden');

-- A quién le llegan los avisos de ML: los que atienden (activos) y el de las ventas; si no
-- hay nadie, dirección (ml_responsable ya sabe caer ahí).
create or replace function public.ml_atienden() returns uuid[]
language sql stable security definer set search_path = public as $$
  select coalesce(nullif(array(
    select p.id from perfiles p
    where p.activo and (p.id in (select jsonb_array_elements_text(coalesce((select valor->'atienden' from configuracion where clave = 'mercadolibre'), '[]'))::uuid)
                        or p.id = nullif((select valor->>'responsable_id' from configuracion where clave = 'mercadolibre'), '')::uuid)
  ), '{}'), array[ml_responsable()])
$$;

create or replace function public.fijar_atienden_ml(p_usuarios uuid[]) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not tiene_rol('direccion') then raise exception 'Quién atiende Mercado Libre lo elige dirección' using errcode = '42501'; end if;
  if exists (select 1 from unnest(coalesce(p_usuarios, '{}')) u where not exists (select 1 from perfiles where id = u and activo)) then
    raise exception 'Alguna de esas personas no tiene cuenta activa';
  end if;
  update configuracion set valor = jsonb_set(valor, '{atienden}', to_jsonb(coalesce(p_usuarios, '{}'))) where clave = 'mercadolibre';
end $$;
revoke execute on function public.fijar_atienden_ml(uuid[]) from public, anon;
grant execute on function public.fijar_atienden_ml(uuid[]) to authenticated;

create or replace function public.ml_registrar_orden(p jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_ped pedidos; it jsonb; v_art uuid; v_orden int := 0; v_sin text[] := '{}'; v_full boolean := coalesce((p->>'full')::boolean, false);
begin
  if auth.uid() is not null then raise exception 'Las ventas de Mercado Libre las registra la conexión con ML' using errcode = '42501'; end if;
  if nullif(p->>'id', '') is null then raise exception 'Falta el número de venta'; end if;
  select * into v_ped from pedidos where canal = 'mercadolibre' and id_externo = p->>'id';

  if v_ped.id is not null then
    -- Ya estaba (capturada a mano antes de conectar, o un aviso repetido): solo la cancelación cambia algo.
    insert into ml_ventas (order_id, pedido_id, full_ml, pack_id, comprador, estado)
    values (p->>'id', v_ped.id, v_full, p->>'pack_id', p->>'comprador', p->>'estado')
    on conflict (order_id) do update set estado = excluded.estado, pedido_id = excluded.pedido_id, actualizado_en = now();
    if p->>'estado' = 'cancelled' and v_ped.estado not in ('cancelado', 'entregado') then
      update pedidos set estado = 'cancelado', motivo_cancelacion = 'Cancelada en Mercado Libre' where id = v_ped.id;
      update envios set estado = 'cancelado' where pedido_id = v_ped.id and estado in ('solicitado', 'cotizado');
      perform avisar(ml_atienden(), 'ml_cancelada', 'Venta de ML cancelada: ' || v_ped.folio,
        'Mercado Libre canceló la venta ' || (p->>'id') || '. Si ya estaba empacada, no la mandes.', '/ventas/pedidos/' || v_ped.id, 'pedidos', v_ped.id::text);
    end if;
    return v_ped.id;
  end if;
  -- Solo las pagadas son venta; las demás (pago pendiente, canceladas antes de pagar) no.
  if coalesce(p->>'estado', '') <> 'paid' then return null; end if;

  insert into pedidos (cliente_id, vendedor_id, canal, id_externo, fecha, estado, moneda, condiciones_pago, notas)
  values (ml_cliente_publico(), nullif((select valor->>'responsable_id' from configuracion where clave = 'mercadolibre'), '')::uuid,
    'mercadolibre', p->>'id',
    coalesce(((p->>'fecha')::timestamptz at time zone 'America/Mexico_City')::date, hoy_planta()),
    'confirmado', 'MXN', 'Pagado en Mercado Libre',
    concat_ws(' · ', 'Venta de Mercado Libre' || case when v_full then ' (Full)' else '' end, 'comprador ' || nullif(p->>'comprador', '')))
  returning * into v_ped;
  insert into ml_ventas (order_id, pedido_id, full_ml, pack_id, comprador, estado)
  values (p->>'id', v_ped.id, v_full, p->>'pack_id', p->>'comprador', p->>'estado')
  on conflict (order_id) do update set pedido_id = excluded.pedido_id, estado = excluded.estado, actualizado_en = now();

  for it in select * from jsonb_array_elements(coalesce(p->'items', '[]')) loop
    v_art := (select articulo_id from publicaciones where canal = 'mercadolibre' and id_externo = it->>'item_id');
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
      coalesce((select unidad from articulos where id = v_art), 'pieza'), greatest(coalesce((it->>'cantidad')::numeric, 1), 0.001),
      round(coalesce((it->>'precio')::numeric, 0) / 1.16, 2), case when v_art is null then 'refacciones' else linea_de(v_art) end, it->>'item_id');
  end loop;

  if cardinality(v_sin) = 0 then
    perform ml_envio_si_falta(v_ped.id);
  else
    perform avisar(ml_atienden(), 'ml_por_ligar', 'Venta de ML con publicación sin ligar: ' || v_ped.folio,
      'No sé qué artículo es «' || array_to_string(v_sin, '», «') || '». Lígala una vez y el envío se pide solo.',
      '/ventas/mercadolibre?seccion=ligar', 'pedidos', v_ped.id::text);
  end if;
  return v_ped.id;
end $function$;

create or replace function public.ml_registrar_reclamo(p jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_ref text := 'ML:' || (p->>'id'); v_dev devoluciones; v_ped uuid; v uuid; v_tipo text := coalesce(p->>'tipo', 'reclamo');
begin
  if auth.uid() is not null then raise exception 'Los reclamos de Mercado Libre los registra la conexión con ML' using errcode = '42501'; end if;
  select * into v_dev from devoluciones where referencia_externa = v_ref;
  if v_dev.id is not null then
    if v_dev.estado not in ('resuelta', 'cancelada') then
      update devoluciones set fecha_limite = coalesce(nullif(p->>'fecha_limite', '')::timestamptz, fecha_limite) where id = v_dev.id;
      if not coalesce((p->>'abierto')::boolean, true) then
        insert into eventos_envio (devolucion_id, tipo, nota) values (v_dev.id, 'nota', 'Mercado Libre lo cerró: resuélvelo aquí con lo que decidió ML.');
      end if;
    end if;
    return v_dev.id;
  end if;
  if not coalesce((p->>'abierto')::boolean, true) then return null; end if;
  select id into v_ped from pedidos where canal = 'mercadolibre' and id_externo = p->>'order_id';
  if v_ped is null then raise exception 'La venta % todavía no está en el ERP: se reintenta', p->>'order_id'; end if;
  -- Si ya lo habían capturado a mano, se liga en lugar de abrir otro.
  select id into v from devoluciones where pedido_id = v_ped and tipo = v_tipo and estado not in ('resuelta', 'cancelada') and referencia_externa is null limit 1;
  if v is null then
    v := abrir_devolucion(v_ped, v_tipo, coalesce(nullif(trim(p->>'motivo'), ''), 'Reclamo en Mercado Libre'), null, null,
      nullif(p->>'fecha_limite', '')::timestamptz, null, null, ml_responsable());
  end if;
  update devoluciones set referencia_externa = v_ref,
    fecha_limite = coalesce(nullif(p->>'fecha_limite', '')::timestamptz, fecha_limite) where id = v;
  perform avisar(ml_atienden(), 'ml_reclamo', 'Mercado Libre: ' || case v_tipo when 'devolucion' then 'devolución' when 'cancelacion' then 'cancelación' else 'reclamo' end
    || ' de la venta ' || (p->>'order_id'), coalesce(p->>'motivo', '') || coalesce(' · responde antes del ' || to_char((p->>'fecha_limite')::timestamptz at time zone 'America/Mexico_City', 'DD/MM HH24:MI'), ''),
    '/ventas/devoluciones', 'devoluciones', v::text);
  return v;
end $function$;

create or replace function public.ml_registrar_pregunta(p jsonb)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_nueva boolean; v_estado text := case p->>'estado' when 'ANSWERED' then 'contestada' when 'UNANSWERED' then 'pendiente' else 'borrada' end;
begin
  if auth.uid() is not null then raise exception 'Las preguntas de Mercado Libre las registra la conexión con ML' using errcode = '42501'; end if;
  v_nueva := not exists (select 1 from ml_preguntas where id = (p->>'id')::bigint);
  insert into ml_preguntas (id, item_id, articulo_id, titulo_publicacion, texto, estado, recibida_en, respuesta, contestada_en)
  values ((p->>'id')::bigint, p->>'item_id',
    (select articulo_id from publicaciones where canal = 'mercadolibre' and id_externo = p->>'item_id'),
    p->>'titulo', coalesce(p->>'texto', ''), v_estado, coalesce((p->>'fecha')::timestamptz, now()),
    p->>'respuesta', nullif(p->>'fecha_respuesta', '')::timestamptz)
  on conflict (id) do update set estado = excluded.estado,
    respuesta = coalesce(excluded.respuesta, ml_preguntas.respuesta),
    contestada_en = coalesce(ml_preguntas.contestada_en, excluded.contestada_en),
    titulo_publicacion = coalesce(excluded.titulo_publicacion, ml_preguntas.titulo_publicacion), actualizado_en = now();
  if v_nueva and v_estado = 'pendiente' then
    perform avisar(ml_atienden(), 'ml_pregunta', 'Pregunta en Mercado Libre',
      left(coalesce(p->>'titulo', '') || ': ' || coalesce(p->>'texto', ''), 240), '/ventas/mercadolibre', 'ml_preguntas', p->>'id');
  end if;
  return (p->>'id')::bigint;
end $function$;

create or replace function public.estado_mercadolibre()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare c ml_cuenta;
begin
  if not (puede('ventas', 1) or puede('admin', 1)) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  select * into c from ml_cuenta where id = 1;
  return jsonb_build_object(
    'conectada', c.ml_user_id is not null, 'nickname', c.nickname, 'conectada_en', c.conectada_en,
    'conectada_por', (select nombre from perfiles where id = c.conectada_por),
    'responsable_id', ml_responsable(), 'responsable', (select nombre from perfiles where id = ml_responsable()),
    'responsable_elegido_id', nullif((select valor->>'responsable_id' from configuracion where clave = 'mercadolibre'), ''),
    'atienden', (select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'nombre', p.nombre) order by p.nombre), '[]'::jsonb)
                 from perfiles p where p.activo and p.id in (select jsonb_array_elements_text(coalesce((select valor->'atienden' from configuracion where clave = 'mercadolibre'), '[]'))::uuid)),
    'avisos_pendientes', (select count(*) from ml_avisos where procesado_en is null),
    'avisos_con_error', (select count(*) from ml_avisos where procesado_en is null and error is not null),
    'ultimo_error', (select error from ml_avisos where procesado_en is null and error is not null order by recibido_en desc limit 1),
    'ultimo_aviso', (select max(recibido_en) from ml_avisos),
    'ventas_30d', (select count(*) from ml_ventas where actualizado_en > now() - interval '30 days'),
    'sin_ligar', (select count(*) from ml_publicaciones_sin_ligar),
    'preguntas_pendientes', (select count(*) from ml_preguntas where estado = 'pendiente'));
end $function$;

-- 2. Nómina pagada -------------------------------------------------------------
alter table public.nomina_semanas
  add column if not exists pagada_el date,
  add column if not exists pagada_cuenta text references public.cuentas_dinero(clave),
  add column if not exists pagada_monto numeric(14,2),
  add column if not exists pagada_por uuid references public.perfiles(id),
  add column if not exists pagada_registrada_en timestamptz;

-- Una semana cerrada no se toca, salvo para anotar que se pagó.
create or replace function public.nomina_semana_guardia() returns trigger
language plpgsql as $$
declare v_pago text[] := array['pagada_el', 'pagada_cuenta', 'pagada_monto', 'pagada_por', 'pagada_registrada_en'];
begin
  if old.estado = 'cerrada' then
    if tg_op = 'UPDATE' and (to_jsonb(new) - v_pago) = (to_jsonb(old) - v_pago) then return new; end if;
    raise exception 'La semana del % ya está cerrada: no se modifica', to_char(old.inicio, 'DD/MM/YYYY') using errcode = '42501';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;

create or replace function public.pagar_semana_nomina(p_semana date, p_fecha date, p_cuenta text, p_monto numeric default null)
returns void language plpgsql security definer set search_path = public as $$
declare s nomina_semanas; v_monto numeric; v_prov uuid; v_folio text := 'NOM-' || to_char(p_semana, 'YYYYMMDD');
begin
  if not puede('finanzas', 2) then raise exception 'El pago de la nómina lo registra finanzas' using errcode = '42501'; end if;
  select * into s from nomina_semanas where inicio = p_semana for update;
  if s.inicio is null or s.estado <> 'cerrada' then raise exception 'Primero RRHH cierra la semana; luego se registra el pago'; end if;
  if s.pagada_el is not null then
    raise exception 'Esa semana ya está pagada (el %)', to_char(s.pagada_el, 'DD/MM/YYYY');
  end if;
  if p_fecha is null or p_fecha > hoy_planta() then raise exception 'La fecha del pago no puede ser futura'; end if;
  if not exists (select 1 from cuentas_dinero where clave = p_cuenta) then raise exception 'Di de qué cuenta salió el pago'; end if;
  v_monto := coalesce(p_monto, (select sum(neto) from nomina_renglones where semana = p_semana));
  if coalesce(v_monto, 0) <= 0 then raise exception 'La semana no tiene nada que pagar'; end if;

  -- La cuenta de la nómina (la de la hoja si existe; si no, una nueva).
  select id into v_prov from proveedores where tipo_acreedor = 'nomina' and nombre ilike 'nomina%' order by activo desc, creado_en limit 1;
  if v_prov is null then
    insert into proveedores (nombre, categoria, tipo_acreedor) values ('Nómina', 'Nómina', 'nomina') returning id into v_prov;
  end if;
  perform registrar_movimiento_proveedor(p_proveedor => v_prov, p_tipo => 'compra', p_monto => v_monto, p_fecha => p_fecha,
    p_factura => v_folio, p_descripcion => format('Nómina de la semana del %s al %s', to_char(p_semana, 'DD/MM'), to_char(p_semana + 6, 'DD/MM/YYYY')),
    p_vence => p_fecha, p_categoria => 'Nómina', p_leido_de => 'captura');
  perform registrar_movimiento_proveedor(p_proveedor => v_prov, p_tipo => 'pago', p_monto => v_monto, p_fecha => p_fecha,
    p_cuenta => p_cuenta, p_factura => v_folio, p_descripcion => 'Pago de la nómina');

  update nomina_semanas set pagada_el = p_fecha, pagada_cuenta = p_cuenta, pagada_monto = v_monto, pagada_por = auth.uid(),
    pagada_registrada_en = now()
  where inicio = p_semana;
  perform avisar(array(select usuarios_con_permiso('nomina', 3)), 'nomina_pagada',
    'Nómina pagada: semana del ' || to_char(p_semana, 'DD/MM'),
    texto_dinero(v_monto) || ' el ' || to_char(p_fecha, 'DD/MM/YYYY') || ' de ' || (select nombre from cuentas_dinero where clave = p_cuenta),
    '/rrhh/prenomina', 'nomina_semanas', p_semana::text);
end $$;
revoke execute on function public.pagar_semana_nomina(date, date, text, numeric) from public, anon;
grant execute on function public.pagar_semana_nomina(date, date, text, numeric) to authenticated;

drop function if exists public.semanas_nomina(integer);
create or replace function public.semanas_nomina(p_cuantas integer DEFAULT 12)
 RETURNS TABLE(inicio date, fin date, pago date, estado text, cerrada_en timestamp with time zone, cerrada_por text, personas bigint, neto numeric,
   pagada_el date, pagada_cuenta text, pagada_monto numeric, pagada_por text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_viernes date := hoy_planta() - ((extract(isodow from hoy_planta())::int - 5 + 7) % 7);
begin
  if not puede('nomina', 1) then raise exception 'Sin permiso de nómina' using errcode = '42501'; end if;
  return query
  select g.d, g.d + 6, g.d + 7, coalesce(s.estado, 'abierta'), s.cerrada_en, p.nombre,
    (select count(*) from nomina_renglones r where r.semana = g.d),
    (select sum(r.neto) from nomina_renglones r where r.semana = g.d),
    s.pagada_el, cd.nombre, s.pagada_monto, pp.nombre
  from (select (v_viernes - 7 * n) d from generate_series(0, greatest(p_cuantas, 1) - 1) n) g
  left join nomina_semanas s on s.inicio = g.d
  left join perfiles p on p.id = s.cerrada_por
  left join cuentas_dinero cd on cd.clave = s.pagada_cuenta
  left join perfiles pp on pp.id = s.pagada_por
  order by g.d desc;
end $function$;

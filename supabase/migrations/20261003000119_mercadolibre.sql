-- Mercado Libre conectado: las ventas, los reclamos y las preguntas entran solos.
--
-- Hoy cada venta de ML se captura a mano como pedido, los reclamos se pasan por chat con
-- su código y las preguntas se contestan en la app de ML sin que nadie mida el tiempo
-- (que es justo lo que pide el bono de Susy). La función de borde "mercadolibre" recibe
-- los avisos de ML, vuelve a pedir cada recurso a la API con el token de la cuenta (no le
-- cree al aviso) y llama a estas funciones, que deciden qué hacer en la base.
--
-- Los tokens viven en ml_cuenta, sin políticas: ni la API ni nadie con sesión los lee;
-- solo la función de borde con la llave de servicio.

-- -----------------------------------------------------------------------------
-- 1. Tablas
-- -----------------------------------------------------------------------------
create table if not exists public.ml_cuenta (
  id int primary key default 1 check (id = 1),     -- una sola cuenta de vendedor
  ml_user_id bigint not null,
  nickname text,
  access_token text not null,
  refresh_token text not null,
  expira_en timestamptz not null,
  conectada_por uuid references public.perfiles(id),
  conectada_en timestamptz not null default now()
);
alter table public.ml_cuenta enable row level security;
revoke all on public.ml_cuenta from anon, authenticated;

-- El "state" del permiso de ML: quien lo pidió y hasta cuándo vale (contra un enlace robado).
create table if not exists public.ml_permisos_pendientes (
  state text primary key,
  usuario_id uuid not null references public.perfiles(id),
  creado_en timestamptz not null default now()
);
alter table public.ml_permisos_pendientes enable row level security;
revoke all on public.ml_permisos_pendientes from anon, authenticated;

-- Avisos de ML por procesar. Un mismo recurso llega muchas veces: se guarda una vez.
create table if not exists public.ml_avisos (
  id bigserial primary key,
  topic text not null,
  resource text not null,
  ml_user_id bigint,
  recibido_en timestamptz not null default now(),
  procesado_en timestamptz,
  intentos int not null default 0,
  error text
);
create unique index if not exists ml_avisos_pendiente on public.ml_avisos (topic, resource) where procesado_en is null;
alter table public.ml_avisos enable row level security;
revoke all on public.ml_avisos from anon, authenticated;

-- Lo propio de cada venta de ML (sin ensuciar pedidos): Full o no, paquete, comprador.
create table if not exists public.ml_ventas (
  order_id text primary key,
  pedido_id uuid references public.pedidos(id) on delete set null,
  full_ml boolean not null default false,
  pack_id text,
  comprador text,
  estado text,
  nota text,                                       -- lo que no se pudo hacer solo (el envío, por ejemplo)
  actualizado_en timestamptz not null default now()
);
alter table public.ml_ventas enable row level security;
drop policy if exists ver on public.ml_ventas;
create policy ver on public.ml_ventas for select to authenticated using ((select puede('ventas', 1)) or (select puede('envios', 1)));

-- Publicaciones que se vendieron y no se sabe qué artículo son. Se ligan una vez.
create table if not exists public.ml_publicaciones_sin_ligar (
  item_id text primary key,
  titulo text,
  sku text,
  precio numeric(14,2),
  veces int not null default 1,
  visto_en timestamptz not null default now()
);
alter table public.ml_publicaciones_sin_ligar enable row level security;
drop policy if exists ver on public.ml_publicaciones_sin_ligar;
create policy ver on public.ml_publicaciones_sin_ligar for select to authenticated
  using ((select puede('ventas', 1)) or (select puede('compras', 1)));

create table if not exists public.ml_preguntas (
  id bigint primary key,                           -- el id de la pregunta en ML
  item_id text not null,
  articulo_id uuid references public.articulos(id) on delete set null,
  titulo_publicacion text,
  texto text not null,
  estado text not null default 'pendiente' check (estado in ('pendiente', 'contestada', 'borrada')),
  recibida_en timestamptz not null,
  respuesta text,
  contestada_en timestamptz,
  contestada_por uuid references public.perfiles(id),
  actualizado_en timestamptz not null default now()
);
create index if not exists ml_preguntas_pendientes on public.ml_preguntas (recibida_en) where estado = 'pendiente';
alter table public.ml_preguntas enable row level security;
drop policy if exists ver on public.ml_preguntas;
create policy ver on public.ml_preguntas for select to authenticated using ((select puede('ventas', 1)));

-- La partida recuerda de qué publicación vino, para ligarla después.
alter table public.pedido_lineas add column if not exists referencia_externa text;
-- El reclamo de ML que originó la devolución (no se abre dos veces).
alter table public.devoluciones add column if not exists referencia_externa text;
create unique index if not exists devoluciones_referencia on public.devoluciones (referencia_externa) where referencia_externa is not null;

-- A quién le llegan los avisos de ML y a nombre de quién quedan las ventas (Juan Carlos).
insert into public.configuracion (clave, valor, descripcion)
values ('mercadolibre', '{"responsable_id": null}', 'Mercado Libre: quién atiende las ventas, reclamos y preguntas')
on conflict (clave) do nothing;

-- -----------------------------------------------------------------------------
-- 2. Envíos y devoluciones que abre la base sola
-- -----------------------------------------------------------------------------
-- pedir_envio y abrir_devolucion revisaban el permiso de quien llama. Una venta de ML
-- llega sin sesión (la función de borde con la llave de servicio): sin sesión es la base
-- misma y pasa; con sesión, todo igual que antes. Por eso ya no las puede llamar anon.
create or replace function public.pedir_envio(p_pedido uuid, p_tipo text default 'paqueteria', p_lineas jsonb default null,
  p_paqueteria int default null, p_contacto uuid default null, p_destino text default null,
  p_fecha_recoleccion date default null, p_notas text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare p pedidos; c contactos; v_cli clientes; v_id uuid; l record; v_cant numeric; v_orden int := 0; v_ml int := almacen_ml();
begin
  -- Sin sesión = la base misma (una venta que llegó de Mercado Libre); con sesión, los permisos de siempre.
  if auth.uid() is not null and not puede('envios', 2) then raise exception 'Sin permiso para pedir envíos' using errcode = '42501'; end if;
  select * into p from pedidos where id = p_pedido;
  if p.id is null or (auth.uid() is not null and not (pedido_visible(p.id) or ve_todos_los_envios())) then
    raise exception 'No encontré el pedido' using errcode = '42501';
  end if;
  if p.estado = 'cancelado' then raise exception 'El pedido % está cancelado', p.folio; end if;
  if coalesce(p.historico, false) then raise exception 'Es una venta histórica de los paneles: no lleva envío'; end if;
  if p_tipo is null or p_tipo not in ('paqueteria', 'flete', 'recoge', 'full', 'proveedor') then
    raise exception 'Tipo de envío no válido: %', coalesce(p_tipo, 'vacío');
  end if;
  if p_tipo = 'full' and p.canal <> 'mercadolibre' then raise exception 'Solo una venta de Mercado Libre la surte Full'; end if;
  if p_tipo = 'full' and v_ml is null then raise exception 'No hay un almacén de Mercado Libre activo'; end if;
  if p_paqueteria is not null and not exists (select 1 from paqueterias where id = p_paqueteria and activa) then
    raise exception 'Esa paquetería no está activa';
  end if;
  if p_lineas is not null and exists (select 1 from jsonb_array_elements(p_lineas) x
       where nullif(x->>'pedido_linea_id', '')::uuid not in (select id from pedido_lineas where pedido_id = p.id)) then
    raise exception 'Una de las partidas no es de este pedido';
  end if;

  -- Destino: el contacto elegido (de este cliente) o el principal; el domicilio de
  -- entrega del pedido manda sobre el del contacto.
  select * into v_cli from clientes where id = p.cliente_id;
  if p_contacto is not null then
    select * into c from contactos where id = p_contacto and cliente_id = p.cliente_id;
    if c.id is null then raise exception 'Ese contacto no es de este cliente'; end if;
  else
    select * into c from contactos where cliente_id = p.cliente_id order by principal desc, creado_en limit 1;
  end if;

  insert into envios (pedido_id, tipo, paqueteria_id, contacto_id, destinatario, telefono, destino, fecha_recoleccion, notas)
  values (p.id, p_tipo, p_paqueteria, c.id,
    case when p_tipo in ('paqueteria', 'flete', 'proveedor') then coalesce(nullif(trim(c.nombre), ''), v_cli.razon_social, v_cli.nombre) end,
    case when p_tipo in ('paqueteria', 'flete', 'proveedor') then coalesce(nullif(trim(c.telefono), ''), nullif(trim(c.whatsapp), '')) end,
    case when p_tipo in ('paqueteria', 'flete', 'proveedor') then
      coalesce(nullif(trim(p_destino), ''), nullif(trim(p.direccion_entrega), ''), nullif(trim(c.domicilio), ''),
               nullif(concat_ws(', ', v_cli.ciudad, v_cli.estado), '')) end,
    p_fecha_recoleccion, nullif(trim(p_notas), ''))
  returning id into v_id;

  -- Partidas: lo que falta por enviar de cada una (o lo que se pidió). Las
  -- partidas libres y los servicios no se empacan.
  for l in select pl.id, pl.articulo_id, pl.titulo, a.tipo art_tipo,
                  pl.cantidad - coalesce((select sum(x.cantidad) from envio_lineas x join envios y on y.id = x.envio_id
                                          where x.pedido_linea_id = pl.id and y.estado <> 'cancelado' and y.id <> v_id), 0) pendiente
           from pedido_lineas pl left join articulos a on a.id = pl.articulo_id
           where pl.pedido_id = p.id order by pl.orden, pl.id loop
    if l.articulo_id is null or l.art_tipo = 'servicio' then continue; end if;
    if p_lineas is not null then
      select (x->>'cantidad')::numeric into v_cant from jsonb_array_elements(p_lineas) x
      where (x->>'pedido_linea_id')::uuid = l.id;
      if coalesce(v_cant, 0) <= 0 then continue; end if;
      if v_cant > l.pendiente + 0.0005 then
        raise exception 'De "%" quedan % por enviar, no %', l.titulo, l.pendiente::float8, v_cant::float8;
      end if;
    else
      v_cant := l.pendiente;
      if v_cant <= 0 then continue; end if;
    end if;
    v_orden := v_orden + 1;
    insert into envio_lineas (envio_id, orden, pedido_linea_id, articulo_id, descripcion, cantidad, almacen_id)
    values (v_id, v_orden, l.id, l.articulo_id, l.titulo, v_cant,
            case p_tipo when 'full' then v_ml when 'proveedor' then null else almacen_de_salida(l.articulo_id, v_cant) end);
  end loop;
  if v_orden = 0 then
    raise exception 'De % no queda nada por enviar: todo ya tiene envío (o son servicios y partidas libres)', p.folio;
  end if;
  if p_tipo in ('paqueteria', 'flete') then perform prellenar_bultos(v_id); end if;

  insert into eventos_envio (envio_id, tipo, nota) values (v_id, 'solicitado',
    format('%s · %s partida(s)%s', nombre_tipo_envio(p_tipo), v_orden,
           coalesce(' · recolección ' || to_char(p_fecha_recoleccion, 'DD/MM'), '')));
  return v_id;
end $$;

create or replace function public.abrir_devolucion(p_pedido uuid, p_tipo text, p_motivo text, p_codigo text default null,
  p_fecha_esperada date default null, p_fecha_limite timestamptz default null, p_lineas jsonb default null,
  p_envio uuid default null, p_responsable uuid default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare p pedidos; v uuid; v_otra text; v_cfg jsonb; l record; v_cant numeric; v_n int := 0; v_envio uuid;
begin
  if auth.uid() is not null and not puede('envios', 2) then raise exception 'Sin permiso para registrar devoluciones' using errcode = '42501'; end if;
  select * into p from pedidos where id = p_pedido;
  if p.id is null or (auth.uid() is not null and not (pedido_visible(p.id) or ve_todos_los_envios())) then
    raise exception 'No encontré la venta' using errcode = '42501';
  end if;
  if p_tipo is null or p_tipo not in ('devolucion', 'reclamo', 'cancelacion') then raise exception 'Tipo no válido: %', coalesce(p_tipo, 'vacío'); end if;
  if length(trim(coalesce(p_motivo, ''))) < 3 then raise exception 'Escribe el motivo (lo que dice el cliente o Mercado Libre)'; end if;
  select folio into v_otra from devoluciones where pedido_id = p.id and tipo = p_tipo and estado not in ('resuelta', 'cancelada') limit 1;
  if v_otra is not null then raise exception 'Esta venta ya tiene % abierta: %', case p_tipo when 'reclamo' then 'un reclamo' when 'cancelacion' then 'una cancelación' else 'una devolución' end, v_otra; end if;
  if p_responsable is not null and not exists (select 1 from perfiles where id = p_responsable and activo) then
    raise exception 'Ese responsable no existe';
  end if;
  if p_envio is not null then
    select id into v_envio from envios where id = p_envio and pedido_id = p.id;
    if v_envio is null then raise exception 'Ese envío no es de esta venta'; end if;
  else
    select id into v_envio from envios where pedido_id = p.id and estado <> 'cancelado' order by enviado_en desc nulls last, solicitado_en desc limit 1;
  end if;
  select valor into v_cfg from configuracion where clave = 'envios';
  insert into devoluciones (pedido_id, envio_id, tipo, codigo_autorizacion, motivo, fecha_esperada, fecha_limite, responsable_id)
  values (p.id, v_envio, p_tipo, nullif(trim(p_codigo), ''), trim(p_motivo),
    case when p_tipo = 'devolucion' then coalesce(p_fecha_esperada, sumar_dias_habiles(hoy_planta(), coalesce((v_cfg->>'dias_devolucion')::int, 3))) end,
    case when p_tipo = 'reclamo' then coalesce(p_fecha_limite, now() + make_interval(hours => coalesce((v_cfg->>'horas_respuesta_reclamo')::int, 24)))
         else p_fecha_limite end,
    coalesce(p_responsable, auth.uid()))
  returning id into v;
  -- Partidas: lo que se pidió o, si no se dice, todo lo de la venta que lleva artículo.
  for l in select pl.id, pl.articulo_id, pl.titulo, pl.cantidad from pedido_lineas pl left join articulos a on a.id = pl.articulo_id
           where pl.pedido_id = p.id and pl.articulo_id is not null and a.tipo <> 'servicio' order by pl.orden loop
    if p_lineas is not null then
      select (x->>'cantidad')::numeric into v_cant from jsonb_array_elements(p_lineas) x where (x->>'pedido_linea_id')::uuid = l.id;
      if coalesce(v_cant, 0) <= 0 then continue; end if;
      if v_cant > l.cantidad then raise exception 'De "%" se vendieron %, no se pueden devolver %', l.titulo, l.cantidad::float8, v_cant::float8; end if;
    else
      v_cant := l.cantidad;
    end if;
    insert into devolucion_lineas (devolucion_id, pedido_linea_id, articulo_id, descripcion, cantidad)
    values (v, l.id, l.articulo_id, l.titulo, v_cant);
    v_n := v_n + 1;
  end loop;
  if p_tipo = 'devolucion' and v_n = 0 then raise exception 'Di qué partidas regresan'; end if;
  insert into eventos_envio (devolucion_id, tipo, nota) values (v, 'abierta',
    concat_ws(' · ', case p_tipo when 'devolucion' then 'Devolución' when 'reclamo' then 'Reclamo' else 'Cancelación' end,
              case when nullif(trim(p_codigo), '') is not null then 'código ' || trim(p_codigo) end, trim(p_motivo)));
  return v;
end $$;
revoke execute on function public.pedir_envio(uuid, text, jsonb, int, uuid, text, date, text) from public, anon;
grant execute on function public.pedir_envio(uuid, text, jsonb, int, uuid, text, date, text) to authenticated;
revoke execute on function public.abrir_devolucion(uuid, text, text, text, date, timestamptz, jsonb, uuid, uuid) from public, anon;
grant execute on function public.abrir_devolucion(uuid, text, text, text, date, timestamptz, jsonb, uuid, uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- 3. Lo que hace la base con cada aviso (lo llama la función de borde, sin sesión)
-- -----------------------------------------------------------------------------
create or replace function public.ml_responsable() returns uuid
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select p.id from perfiles p where p.activo and p.id = nullif((select valor->>'responsable_id' from configuracion where clave = 'mercadolibre'), '')::uuid),
    (select usuario_id from usuario_roles ur join perfiles p on p.id = ur.usuario_id and p.activo where ur.rol = 'direccion' order by ur.usuario_id limit 1))
$$;

create or replace function public.ml_cliente_publico() returns uuid
language plpgsql security definer set search_path = public as $$
declare v uuid;
begin
  select id into v from clientes where nombre ilike 'Público General (Mercado%' order by activo desc, creado_en limit 1;
  if v is null then
    insert into clientes (nombre, razon_social, rfc, ciudad) values ('Público General (Mercadolibre)', 'PUBLICO EN GENERAL', 'XAXX010101000', null)
    returning id into v;
  end if;
  return v;
end $$;

-- El envío de una venta de ML en cuanto todas sus partidas tienen artículo: Full sale de la
-- bodega de ML; lo demás se surte en planta con la guía que genera ML (Mercado Envíos).
create or replace function public.ml_envio_si_falta(p_pedido uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_full boolean; v_paq int; v uuid; v_sesion text := current_setting('request.jwt.claims', true);
begin
  if exists (select 1 from envios where pedido_id = p_pedido and estado <> 'cancelado') then return null; end if;
  if exists (select 1 from pedido_lineas where pedido_id = p_pedido and articulo_id is null) then return null; end if;
  select coalesce(full_ml, false) into v_full from ml_ventas where pedido_id = p_pedido;
  select id into v_paq from paqueterias where nombre ilike 'Mercado Env%' and activa limit 1;
  -- El envío lo pide la venta, no quien ligó la publicación (que puede no tener permiso de
  -- envíos): se pide sin sesión, como cuando llega la venta, y luego se devuelve la sesión.
  perform set_config('request.jwt.claims', '', true);
  begin
    v := pedir_envio(p_pedido, case when v_full then 'full' else 'paqueteria' end, null,
      case when v_full then null else v_paq end, null,
      case when v_full then null else 'Guía de Mercado Libre (Mercado Envíos)' end, null, 'Venta de Mercado Libre');
  exception when others then
    -- No frena la venta: queda anotado y almacén lo pide a mano.
    update ml_ventas set nota = 'No se pudo pedir el envío solo: ' || sqlerrm, actualizado_en = now() where pedido_id = p_pedido;
  end;
  perform set_config('request.jwt.claims', coalesce(v_sesion, ''), true);
  return v;
end $$;

-- Una venta de ML. p: {id, estado, fecha, comprador, full, pack_id, items:[{item_id, titulo, sku, cantidad, precio}]}
-- precio = unitario con IVA, como lo cobra ML.
create or replace function public.ml_registrar_orden(p jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
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
      perform avisar(array[ml_responsable()], 'ml_cancelada', 'Venta de ML cancelada: ' || v_ped.folio,
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
    perform avisar(array[ml_responsable()], 'ml_por_ligar', 'Venta de ML con publicación sin ligar: ' || v_ped.folio,
      'No sé qué artículo es «' || array_to_string(v_sin, '», «') || '». Lígala una vez y el envío se pide solo.',
      '/ventas/mercadolibre?seccion=ligar', 'pedidos', v_ped.id::text);
  end if;
  return v_ped.id;
end $$;

-- Ligar una publicación de ML con su artículo: una vez, y las ventas que esperaban se completan.
create or replace function public.ml_ligar_publicacion(p_item text, p_articulo uuid) returns int
language plpgsql security definer set search_path = public as $$
declare s ml_publicaciones_sin_ligar; v_n int; r record;
begin
  if not (puede('ventas', 2) or puede('compras', 2)) then raise exception 'Ligar publicaciones es de ventas o compras' using errcode = '42501'; end if;
  if not exists (select 1 from articulos where id = p_articulo and activo) then raise exception 'Ese artículo no existe o está dado de baja'; end if;
  select * into s from ml_publicaciones_sin_ligar where item_id = p_item;
  insert into publicaciones (articulo_id, canal, id_externo, titulo, precio)
  values (p_articulo, 'mercadolibre', p_item, s.titulo, s.precio)
  on conflict (canal, id_externo) do update set articulo_id = excluded.articulo_id, actualizado_en = now();
  delete from ml_publicaciones_sin_ligar where item_id = p_item;
  update pedido_lineas pl set articulo_id = p_articulo, linea = linea_de(p_articulo),
    unidad = (select unidad from articulos where id = p_articulo)
  from pedidos p
  where p.id = pl.pedido_id and p.canal = 'mercadolibre' and p.estado <> 'cancelado'
    and pl.referencia_externa = p_item and pl.articulo_id is null;
  get diagnostics v_n = row_count;
  for r in select distinct pl.pedido_id from pedido_lineas pl join pedidos p on p.id = pl.pedido_id
           where pl.referencia_externa = p_item and p.estado <> 'cancelado' loop
    perform ml_envio_si_falta(r.pedido_id);
  end loop;
  return v_n;
end $$;

-- Un reclamo, devolución o cancelación de ML. p: {id, order_id, tipo, motivo, fecha_limite, abierto}
create or replace function public.ml_registrar_reclamo(p jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
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
  perform avisar(array[ml_responsable()], 'ml_reclamo', 'Mercado Libre: ' || case v_tipo when 'devolucion' then 'devolución' when 'cancelacion' then 'cancelación' else 'reclamo' end
    || ' de la venta ' || (p->>'order_id'), coalesce(p->>'motivo', '') || coalesce(' · responde antes del ' || to_char((p->>'fecha_limite')::timestamptz at time zone 'America/Mexico_City', 'DD/MM HH24:MI'), ''),
    '/ventas/devoluciones', 'devoluciones', v::text);
  return v;
end $$;

-- Una pregunta de un comprador. p: {id, item_id, titulo, texto, estado, fecha, respuesta, fecha_respuesta}
create or replace function public.ml_registrar_pregunta(p jsonb) returns bigint
language plpgsql security definer set search_path = public as $$
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
    perform avisar(array[ml_responsable()], 'ml_pregunta', 'Pregunta en Mercado Libre',
      left(coalesce(p->>'titulo', '') || ': ' || coalesce(p->>'texto', ''), 240), '/ventas/mercadolibre', 'ml_preguntas', p->>'id');
  end if;
  return (p->>'id')::bigint;
end $$;

-- La respuesta que se mandó desde el ERP (la función de borde ya la publicó en ML).
create or replace function public.ml_marcar_contestada(p_pregunta bigint, p_texto text, p_usuario uuid) returns void
language sql security definer set search_path = public as $$
  update ml_preguntas set estado = 'contestada', respuesta = p_texto, contestada_en = now(), contestada_por = p_usuario, actualizado_en = now()
  where id = p_pregunta
$$;

-- Lo que la pantalla de Integraciones muestra (sin tokens).
create or replace function public.estado_mercadolibre() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare c ml_cuenta;
begin
  if not (puede('ventas', 1) or puede('admin', 1)) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  select * into c from ml_cuenta where id = 1;
  return jsonb_build_object(
    'conectada', c.ml_user_id is not null, 'nickname', c.nickname, 'conectada_en', c.conectada_en,
    'conectada_por', (select nombre from perfiles where id = c.conectada_por),
    'responsable_id', ml_responsable(), 'responsable', (select nombre from perfiles where id = ml_responsable()),
    'responsable_elegido_id', nullif((select valor->>'responsable_id' from configuracion where clave = 'mercadolibre'), ''),
    'avisos_pendientes', (select count(*) from ml_avisos where procesado_en is null),
    'avisos_con_error', (select count(*) from ml_avisos where procesado_en is null and error is not null),
    'ultimo_error', (select error from ml_avisos where procesado_en is null and error is not null order by recibido_en desc limit 1),
    'ultimo_aviso', (select max(recibido_en) from ml_avisos),
    'ventas_30d', (select count(*) from ml_ventas where actualizado_en > now() - interval '30 days'),
    'sin_ligar', (select count(*) from ml_publicaciones_sin_ligar),
    'preguntas_pendientes', (select count(*) from ml_preguntas where estado = 'pendiente'));
end $$;

create or replace function public.fijar_responsable_ml(p_usuario uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not tiene_rol('direccion') then raise exception 'El responsable de Mercado Libre lo elige dirección' using errcode = '42501'; end if;
  if p_usuario is not null and not exists (select 1 from perfiles where id = p_usuario and activo) then raise exception 'Esa persona no existe'; end if;
  update configuracion set valor = jsonb_set(valor, '{responsable_id}', coalesce(to_jsonb(p_usuario), 'null'::jsonb)) where clave = 'mercadolibre';
end $$;

-- Solo la conexión (llave de servicio) registra lo que llega de ML.
do $$
declare f text;
begin
  foreach f in array array['ml_registrar_orden(jsonb)', 'ml_registrar_reclamo(jsonb)', 'ml_registrar_pregunta(jsonb)',
                           'ml_marcar_contestada(bigint, text, uuid)', 'ml_envio_si_falta(uuid)', 'ml_cliente_publico()'] loop
    execute format('revoke execute on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
  foreach f in array array['ml_ligar_publicacion(text, uuid)', 'estado_mercadolibre()', 'fijar_responsable_ml(uuid)', 'ml_responsable()'] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

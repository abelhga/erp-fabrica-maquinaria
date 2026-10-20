-- =============================================================================
-- Mercado Libre: publicaciones de paquete, ligas que se corrigen, alguien invitado que
-- todavía no entra, reclamos de ventas de antes y ventas traídas que ML ya mandó.
--
-- 1. Se ligó «24 Cangilones Tapco 6x4» con el cangilón suelto y no había cómo corregirlo:
--    la venta quedó como 1 cangilón de $3,137. publicaciones.piezas_por_paquete ya existía
--    pero las ventas no lo usaban. Ahora cada venta multiplica la cantidad por las piezas
--    del paquete y divide el precio, y ml_corregir_publicacion cambia el artículo o las
--    piezas (o la desliga) y rehace las ventas que todavía no se empacan.
-- 2. Juan Carlos atiende ML pero no ha aceptado su invitación: sin cuenta no tenía id y no se
--    podía elegir. Se elige por correo (atienden_correos) y le llega en cuanto entra.
-- 3. «Traer lo pendiente» trajo dos reclamos de ventas de antes de conectar ML, que no están
--    en el ERP: se reintentaban para siempre y la tarjeta los marcaba como error. Si la venta
--    es de antes de conectar se avisa una vez a quienes atienden ML para resolverlo allá (o
--    traer las ventas desde esa fecha, y entonces el reclamo entra completo).
-- 4. Al traer ventas de días anteriores, una que ML ya envió pedía otra vez su envío a planta:
--    se guarda el estado del envío en ML y esas no lo piden.
-- 5. Dirección quiere revisar algo antes de que las ventas de ML entren como pedidos: queda un
--    interruptor (mercadolibre.ventas_activas). Apagado, las ventas nuevas no se registran (las
--    preguntas y los reclamos siguen entrando) y se borran los tres pedidos que trajo «Traer lo
--    pendiente». Para traerlas después basta prenderlo y traer las ventas desde una fecha.
-- =============================================================================

alter table public.ml_ventas add column if not exists envio_ml text;

-- Sin la llave, prendidas (como hasta hoy). La cuenta ya conectada arranca apagada: es la de
-- producción, donde dirección pidió revisarlo antes.
create or replace function public.ml_ventas_activas() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select (valor->>'ventas_activas')::boolean from configuracion where clave = 'mercadolibre'), true)
$$;
update public.configuracion set valor = valor || '{"ventas_activas": false}'
where clave = 'mercadolibre' and exists (select 1 from public.ml_cuenta) and not (valor ? 'ventas_activas');

create or replace function public.fijar_ventas_ml(p_activas boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not tiene_rol('direccion') then raise exception 'Si las ventas de Mercado Libre entran como pedidos lo decide dirección' using errcode = '42501'; end if;
  update configuracion set valor = valor || jsonb_build_object('ventas_activas', coalesce(p_activas, false)) where clave = 'mercadolibre';
end $$;
revoke execute on function public.fijar_ventas_ml(boolean) from public, anon;
grant execute on function public.fijar_ventas_ml(boolean) to authenticated;

-- Los pedidos que entraron con «Traer lo pendiente» mientras dirección lo revisa: fuera, con
-- su envío y su renglón en ml_ventas. Solo si las ventas quedaron apagadas.
do $$
declare v_peds uuid[];
begin
  if ml_ventas_activas() then return; end if;
  select coalesce(array_agg(p.id), '{}') into v_peds from pedidos p
  where p.canal = 'mercadolibre' and p.cotizacion_id is null
    and exists (select 1 from ml_ventas v where v.pedido_id = p.id)
    and not exists (select 1 from envios e where e.pedido_id = p.id and e.estado not in ('solicitado', 'cotizado', 'cancelado'))
    and not exists (select 1 from cobros c where c.pedido_id = p.id)
    and not exists (select 1 from facturas f where f.pedido_id = p.id)
    and not exists (select 1 from movimientos_inventario m where m.pedido_id = p.id)
    and not exists (select 1 from devoluciones d where d.pedido_id = p.id)
    and not exists (select 1 from ordenes_produccion o where o.pedido_id = p.id);
  if cardinality(v_peds) = 0 then return; end if;
  -- Su único evento es el «solicitado» automático (sin persona ni evidencia): la protección de
  -- la evidencia se apaga solo para borrarlo y se vuelve a prender en la misma transacción.
  if exists (select 1 from eventos_envio ev join envios e on e.id = ev.envio_id
             where e.pedido_id = any(v_peds) and (ev.tipo <> 'solicitado' or ev.usuario_id is not null)) then
    raise exception 'Un envío de esas ventas ya tiene movimientos de alguien: no se borra';
  end if;
  alter table eventos_envio disable trigger inalterable;
  delete from eventos_envio where envio_id in (select id from envios where pedido_id = any(v_peds));
  alter table eventos_envio enable trigger inalterable;
  delete from envio_lineas where envio_id in (select id from envios where pedido_id = any(v_peds));
  delete from envios where pedido_id = any(v_peds);
  delete from ml_ventas where pedido_id = any(v_peds);
  delete from avisos where tabla = 'pedidos' and registro_id = any(select unnest(v_peds)::text);
  delete from reservas where pedido_id = any(v_peds);
  delete from pedido_vendedores where pedido_id = any(v_peds);
  delete from pedido_lineas where pedido_id = any(v_peds);
  delete from pedidos where id = any(v_peds);
  raise notice 'Pedidos de ML borrados: %', cardinality(v_peds);
end $$;

create or replace function public.ml_atienden() returns uuid[]
language sql stable security definer set search_path = public as $$
  with cfg as (select valor v from configuracion where clave = 'mercadolibre')
  select coalesce(nullif(array(
    select p.id from perfiles p, cfg
    where p.activo and (p.id in (select jsonb_array_elements_text(coalesce(cfg.v->'atienden', '[]'))::uuid)
                        or lower(p.correo) in (select jsonb_array_elements_text(coalesce(cfg.v->'atienden_correos', '[]')))
                        or p.id = nullif(cfg.v->>'responsable_id', '')::uuid)
  ), '{}'), array[ml_responsable()])
$$;

drop function if exists public.fijar_atienden_ml(uuid[]);
create or replace function public.fijar_atienden_ml(p_usuarios uuid[], p_correos text[] default '{}') returns void
language plpgsql security definer set search_path = public as $$
declare v_correos text[];
begin
  if not tiene_rol('direccion') then raise exception 'Quién atiende Mercado Libre lo elige dirección' using errcode = '42501'; end if;
  if exists (select 1 from unnest(coalesce(p_usuarios, '{}')) u where not exists (select 1 from perfiles where id = u and activo)) then
    raise exception 'Alguna de esas personas no tiene cuenta activa';
  end if;
  select coalesce(array_agg(distinct lower(trim(c))), '{}') into v_correos from unnest(coalesce(p_correos, '{}')) c where nullif(trim(c), '') is not null;
  if exists (select 1 from unnest(v_correos) c where not exists (select 1 from invitaciones where correo = c)
                                                and not exists (select 1 from perfiles where lower(correo) = c and activo)) then
    raise exception 'Ese correo no tiene invitación: invítalo primero en Usuarios';
  end if;
  update configuracion set valor = valor || jsonb_build_object('atienden', to_jsonb(coalesce(p_usuarios, '{}')), 'atienden_correos', to_jsonb(v_correos))
  where clave = 'mercadolibre';
end $$;
revoke execute on function public.fijar_atienden_ml(uuid[], text[]) from public, anon;
grant execute on function public.fijar_atienden_ml(uuid[], text[]) to authenticated;

-- Reclamo de una venta de antes de conectar ML (no está en el ERP): se avisa una sola vez.
create or replace function public.ml_reclamo_sin_venta(p jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null then raise exception 'Los reclamos de Mercado Libre los registra la conexión con ML' using errcode = '42501'; end if;
  if exists (select 1 from avisos where tipo = 'ml_reclamo_sin_venta' and registro_id = p->>'id') then return; end if;
  perform avisar(ml_atienden(), 'ml_reclamo_sin_venta', 'Mercado Libre: reclamo de la venta ' || (p->>'order_id'),
    concat_ws(' · ', 'Es una venta ' || coalesce('del ' || to_char((p->>'fecha_venta')::timestamptz at time zone 'America/Mexico_City', 'DD/MM/YYYY') || ', ', '')
        || 'de antes de conectar Mercado Libre y no está en el ERP: atiéndelo en Mercado Libre',
      nullif(trim(p->>'motivo'), ''),
      'responde antes del ' || to_char((p->>'fecha_limite')::timestamptz at time zone 'America/Mexico_City', 'DD/MM HH24:MI')),
    '/ventas/mercadolibre', 'ml_reclamos', p->>'id');
end $$;
revoke execute on function public.ml_reclamo_sin_venta(jsonb) from public, anon, authenticated;

-- Ligar con las piezas del paquete: las ventas que esperaban quedan en piezas.
drop function if exists public.ml_ligar_publicacion(text, uuid);
create or replace function public.ml_ligar_publicacion(p_item text, p_articulo uuid, p_piezas int default 1) returns int
language plpgsql security definer set search_path = public as $$
declare s ml_publicaciones_sin_ligar; v_n int; r record; v_pzas int := coalesce(p_piezas, 1);
begin
  if not (puede('ventas', 2) or puede('compras', 2)) then raise exception 'Ligar publicaciones es de ventas o compras' using errcode = '42501'; end if;
  if not exists (select 1 from articulos where id = p_articulo and activo) then raise exception 'Ese artículo no existe o está dado de baja'; end if;
  if v_pzas < 1 then raise exception 'Las piezas por venta van de 1 en adelante'; end if;
  select * into s from ml_publicaciones_sin_ligar where item_id = p_item;
  insert into publicaciones (articulo_id, canal, id_externo, titulo, precio, piezas_por_paquete)
  values (p_articulo, 'mercadolibre', p_item, s.titulo, s.precio, v_pzas)
  on conflict (canal, id_externo) do update set articulo_id = excluded.articulo_id, piezas_por_paquete = excluded.piezas_por_paquete, actualizado_en = now();
  delete from ml_publicaciones_sin_ligar where item_id = p_item;
  update pedido_lineas pl set articulo_id = p_articulo, linea = linea_de(p_articulo),
    unidad = (select unidad from articulos where id = p_articulo),
    cantidad = pl.cantidad * v_pzas, precio_unitario = round(pl.precio_unitario / v_pzas, 2)
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
revoke execute on function public.ml_ligar_publicacion(text, uuid, int) from public, anon;
grant execute on function public.ml_ligar_publicacion(text, uuid, int) to authenticated;

-- Corregir una publicación ya ligada: otro artículo, otras piezas por venta, o desligarla
-- (p_articulo nulo: vuelve a «por ligar»). Rehace las ventas abiertas cuyo envío todavía no
-- tiene guía; las que ya van empacadas o en camino se quedan y se reportan.
create or replace function public.ml_corregir_publicacion(p_item text, p_articulo uuid, p_piezas int default 1) returns jsonb
language plpgsql security definer set search_path = public as $$
declare pub publicaciones; r record; v_lin int := 0; v_tarde int := 0; v_pzas int := coalesce(p_piezas, 1);
begin
  if not (puede('ventas', 2) or puede('compras', 2)) then raise exception 'Corregir publicaciones es de ventas o compras' using errcode = '42501'; end if;
  select * into pub from publicaciones where canal = 'mercadolibre' and id_externo = p_item for update;
  if not found then raise exception 'Esa publicación no está ligada'; end if;
  if v_pzas < 1 then raise exception 'Las piezas por venta van de 1 en adelante'; end if;
  if p_articulo is not null and not exists (select 1 from articulos where id = p_articulo and activo) then
    raise exception 'Ese artículo no existe o está dado de baja';
  end if;
  for r in select pl.id, pl.pedido_id from pedido_lineas pl join pedidos p on p.id = pl.pedido_id
           where pl.referencia_externa = p_item and p.canal = 'mercadolibre' and p.estado not in ('cancelado', 'entregado') loop
    if exists (select 1 from envios e where e.pedido_id = r.pedido_id and e.estado in ('guia_lista', 'empacado', 'enviado', 'entregado')) then
      v_tarde := v_tarde + 1; continue;
    end if;
    -- Cantidad y precio se regresan a "una venta de ML" y se vuelven a repartir en piezas.
    if p_articulo is null then
      update envios set estado = 'cancelado' where pedido_id = r.pedido_id and estado in ('solicitado', 'cotizado');
      update pedido_lineas set articulo_id = null, linea = 'refacciones',
        cantidad = cantidad / pub.piezas_por_paquete, precio_unitario = round(precio_unitario * pub.piezas_por_paquete, 2)
      where id = r.id;
    else
      update pedido_lineas set articulo_id = p_articulo, linea = linea_de(p_articulo), unidad = (select unidad from articulos where id = p_articulo),
        cantidad = cantidad / pub.piezas_por_paquete * v_pzas, precio_unitario = round(precio_unitario * pub.piezas_por_paquete / v_pzas, 2)
      where id = r.id;
      update envio_lineas el set articulo_id = p_articulo, cantidad = el.cantidad / pub.piezas_por_paquete * v_pzas,
        descripcion = coalesce((select nombre from articulos where id = p_articulo), el.descripcion)
      from envios e where e.id = el.envio_id and el.pedido_linea_id = r.id and e.estado in ('solicitado', 'cotizado');
    end if;
    v_lin := v_lin + 1;
  end loop;
  if p_articulo is null then
    delete from publicaciones where id = pub.id;
    insert into ml_publicaciones_sin_ligar (item_id, titulo, precio) values (p_item, pub.titulo, pub.precio) on conflict (item_id) do nothing;
  else
    update publicaciones set articulo_id = p_articulo, piezas_por_paquete = v_pzas, actualizado_en = now() where id = pub.id;
    for r in select distinct pl.pedido_id from pedido_lineas pl join pedidos p on p.id = pl.pedido_id
             where pl.referencia_externa = p_item and p.estado not in ('cancelado', 'entregado') loop
      perform ml_envio_si_falta(r.pedido_id);
    end loop;
  end if;
  return jsonb_build_object('ventas', v_lin, 'ya_en_camino', v_tarde);
end $$;
revoke execute on function public.ml_corregir_publicacion(text, uuid, int) from public, anon;
grant execute on function public.ml_corregir_publicacion(text, uuid, int) to authenticated;

create or replace function public.ml_registrar_orden(p jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_ped pedidos; it jsonb; v_art uuid; v_pzas int; v_orden int := 0; v_sin text[] := '{}'; v_full boolean := coalesce((p->>'full')::boolean, false);
begin
  if auth.uid() is not null then raise exception 'Las ventas de Mercado Libre las registra la conexión con ML' using errcode = '42501'; end if;
  if nullif(p->>'id', '') is null then raise exception 'Falta el número de venta'; end if;
  select * into v_ped from pedidos where canal = 'mercadolibre' and id_externo = p->>'id';

  if v_ped.id is not null then
    -- Ya estaba (capturada a mano antes de conectar, o un aviso repetido): solo la cancelación cambia algo.
    insert into ml_ventas (order_id, pedido_id, full_ml, pack_id, comprador, estado, envio_ml)
    values (p->>'id', v_ped.id, v_full, p->>'pack_id', p->>'comprador', p->>'estado', nullif(p->>'envio_estado', ''))
    on conflict (order_id) do update set estado = excluded.estado, pedido_id = excluded.pedido_id,
      envio_ml = coalesce(excluded.envio_ml, ml_ventas.envio_ml), actualizado_en = now();
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
  -- Con las ventas apagadas no se registra nada nuevo (se pueden traer después con una fecha).
  if not ml_ventas_activas() then return null; end if;

  insert into pedidos (cliente_id, vendedor_id, canal, id_externo, fecha, estado, moneda, condiciones_pago, notas)
  values (ml_cliente_publico(), nullif((select valor->>'responsable_id' from configuracion where clave = 'mercadolibre'), '')::uuid,
    'mercadolibre', p->>'id',
    coalesce(((p->>'fecha')::timestamptz at time zone 'America/Mexico_City')::date, hoy_planta()),
    'confirmado', 'MXN', 'Pagado en Mercado Libre',
    concat_ws(' · ', 'Venta de Mercado Libre' || case when v_full then ' (Full)' else '' end, 'comprador ' || nullif(p->>'comprador', '')))
  returning * into v_ped;
  insert into ml_ventas (order_id, pedido_id, full_ml, pack_id, comprador, estado, envio_ml)
  values (p->>'id', v_ped.id, v_full, p->>'pack_id', p->>'comprador', p->>'estado', nullif(p->>'envio_estado', ''))
  on conflict (order_id) do update set pedido_id = excluded.pedido_id, estado = excluded.estado,
    envio_ml = coalesce(excluded.envio_ml, ml_ventas.envio_ml), actualizado_en = now();

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
  return v_ped.id;
end $function$;

CREATE OR REPLACE FUNCTION public.ml_envio_si_falta(p_pedido uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_full boolean; v_paq int; v uuid; v_sesion text := current_setting('request.jwt.claims', true);
begin
  if exists (select 1 from envios where pedido_id = p_pedido and estado <> 'cancelado') then return null; end if;
  -- Una venta traída de días anteriores que ML ya mandó (o entregó) no se vuelve a empacar.
  if exists (select 1 from ml_ventas where pedido_id = p_pedido and envio_ml in ('shipped', 'delivered', 'not_delivered')) then return null; end if;
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
end $function$;

create or replace function public.estado_mercadolibre()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare c ml_cuenta; v_cfg jsonb := (select valor from configuracion where clave = 'mercadolibre');
begin
  if not (puede('ventas', 1) or puede('admin', 1)) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  select * into c from ml_cuenta where id = 1;
  return jsonb_build_object(
    'conectada', c.ml_user_id is not null, 'nickname', c.nickname, 'conectada_en', c.conectada_en,
    'conectada_por', (select nombre from perfiles where id = c.conectada_por),
    'responsable_id', ml_responsable(), 'responsable', (select nombre from perfiles where id = ml_responsable()),
    'responsable_elegido_id', nullif((select valor->>'responsable_id' from configuracion where clave = 'mercadolibre'), ''),
    'atienden', (select coalesce(jsonb_agg(x order by x->>'nombre'), '[]'::jsonb) from (
        select jsonb_build_object('id', p.id, 'nombre', p.nombre, 'correo', p.correo, 'pendiente', false) x
        from perfiles p where p.activo and (p.id in (select jsonb_array_elements_text(coalesce(v_cfg->'atienden', '[]'))::uuid)
                                            or lower(p.correo) in (select jsonb_array_elements_text(coalesce(v_cfg->'atienden_correos', '[]'))))
        union all
        select jsonb_build_object('id', null, 'nombre', coalesce(i.nombre, i.correo), 'correo', i.correo, 'pendiente', true)
        from invitaciones i where i.correo in (select jsonb_array_elements_text(coalesce(v_cfg->'atienden_correos', '[]')))
          and not exists (select 1 from perfiles p where lower(p.correo) = i.correo)) t),
    -- Para elegir a alguien que ya se invitó y todavía no entra (solo dirección elige).
    'invitados', case when tiene_rol('direccion') then (select coalesce(jsonb_agg(jsonb_build_object('correo', i.correo, 'nombre', coalesce(i.nombre, i.correo)) order by i.nombre), '[]'::jsonb)
        from invitaciones i where not exists (select 1 from perfiles p where lower(p.correo) = i.correo)) else '[]'::jsonb end,
    'ventas_activas', ml_ventas_activas(),
    'avisos_pendientes', (select count(*) from ml_avisos where procesado_en is null),
    'avisos_con_error', (select count(*) from ml_avisos where procesado_en is null and error is not null),
    'ultimo_error', (select error from ml_avisos where procesado_en is null and error is not null order by recibido_en desc limit 1),
    'ultimo_aviso', (select max(recibido_en) from ml_avisos),
    'ventas_30d', (select count(*) from ml_ventas where actualizado_en > now() - interval '30 days'),
    'sin_ligar', (select count(*) from ml_publicaciones_sin_ligar),
    'preguntas_pendientes', (select count(*) from ml_preguntas where estado = 'pendiente'));
end $function$;

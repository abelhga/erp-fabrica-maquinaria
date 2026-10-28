-- =============================================================================
-- Mercado Libre: un paquete con guía impresa ya no se esconde por no estar ligado.
--
-- Noemí vio dos envíos donde había cinco paquetes. Las otras tres ventas eran de publicaciones
-- que el ERP no conocía, y una venta sin artículo no pedía envío (ml_envio_si_falta esperaba a que
-- ventas la ligara). El aviso «por ligar» le llegaba solo a ventas; almacén no se enteraba, aunque
-- ML ya había impreso la guía.
--
-- 1. El envío se pide igual. La partida sin artículo va con el título de la publicación y su
--    número (envio_lineas.publicacion_ml). Almacén la puede ligar ahí mismo, y la caja no se
--    cierra hasta que se diga qué artículo es: sin eso, ni el check list ni la salida de
--    inventario saben qué lleva. Si ML se la lleva antes de ligarla, el inventario se descuenta
--    al ligar.
-- 2. Piezas por venta con decimales. «1 juego de grapas» es 0.25 de C-00013, que es una caja de
--    4 juegos. Antes solo se aceptaban enteros (paquetes de 24 cangilones).
-- 3. «No es de Hegamex». En la cuenta de ML también se vende extracto de café de otra tienda.
--    Marcar la publicación así cancela la venta que ya había entrado y le quita el cobro (no es
--    dinero de Hegamex); las siguientes ya no entran.
-- =============================================================================

-- 1. ---------------------------------------------------------------------------
alter table public.envio_lineas add column if not exists publicacion_ml text;

-- La vista lleva la publicación para que la pantalla del envío ofrezca «Ligar artículo».
create or replace view public.v_envio_lineas with (security_invoker = true) as
select el.id, el.envio_id, el.orden, el.pedido_linea_id, el.articulo_id, a.clave, coalesce(a.nombre, el.descripcion) as nombre,
  el.descripcion, a.tipo as articulo_tipo, a.unidad, el.cantidad, el.almacen_id, al.nombre as almacen, el.series,
  el.cantidad_descontada, el.movimiento_id is not null or el.traspaso_id is not null as descontado, el.nota_inventario,
  a.paquete_kg, a.paquete_largo_cm, a.paquete_ancho_cm, a.paquete_alto_cm, a.paquete_piezas,
  o.series_orden, o.ordenes, o.ordenes_sin_terminar,
  el.publicacion_ml
from public.envio_lineas el
join public.envios e on e.id = el.envio_id
left join public.articulos a on a.id = el.articulo_id
left join public.almacenes al on al.id = el.almacen_id
left join lateral (
  select array_agg(x.numero_serie order by x.folio) filter (where x.numero_serie is not null) series_orden,
    array_agg(x.folio order by x.folio) ordenes,
    count(*) filter (where x.estado not in ('terminada', 'entregada'))::int ordenes_sin_terminar
  from public.ordenes_produccion x
  where x.estado <> 'cancelada' and e.pedido_id is not null
    and (x.pedido_linea_id = el.pedido_linea_id or (x.pedido_id = e.pedido_id and x.pedido_linea_id is null and x.articulo_id = el.articulo_id))
  having count(*) > 0) o on true;

-- pedir_envio (119): igual, salvo que una partida de ML sin artículo sí entra al envío.
create or replace function public.pedir_envio(p_pedido uuid, p_tipo text default 'paqueteria', p_lineas jsonb default null,
  p_paqueteria int default null, p_contacto uuid default null, p_destino text default null,
  p_fecha_recoleccion date default null, p_notas text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare p pedidos; c contactos; v_cli clientes; v_id uuid; l record; v_cant numeric; v_orden int := 0; v_ml int := almacen_ml();
begin
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

  -- Partidas: lo que falta por enviar de cada una (o lo que se pidió). Las partidas libres y los
  -- servicios no se empacan; la de una publicación de ML sin ligar sí (es lo que dice la guía).
  for l in select pl.id, pl.articulo_id, pl.titulo, a.tipo art_tipo,
                  case when p.canal = 'mercadolibre' and pl.articulo_id is null then pl.referencia_externa end publicacion,
                  pl.cantidad - coalesce((select sum(x.cantidad) from envio_lineas x join envios y on y.id = x.envio_id
                                          where x.pedido_linea_id = pl.id and y.estado <> 'cancelado' and y.id <> v_id), 0) pendiente
           from pedido_lineas pl left join articulos a on a.id = pl.articulo_id
           where pl.pedido_id = p.id order by pl.orden, pl.id loop
    if (l.articulo_id is null and l.publicacion is null) or l.art_tipo = 'servicio' then continue; end if;
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
    insert into envio_lineas (envio_id, orden, pedido_linea_id, articulo_id, descripcion, cantidad, almacen_id, publicacion_ml)
    values (v_id, v_orden, l.id, l.articulo_id, l.titulo, v_cant,
            case p_tipo when 'full' then v_ml when 'proveedor' then null
              else case when l.articulo_id is not null then almacen_de_salida(l.articulo_id, v_cant) end end,
            l.publicacion);
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

-- El envío de una venta de ML en cuanto entra, ligada o no (134 esperaba a que todo tuviera artículo).
create or replace function public.ml_envio_si_falta(p_pedido uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_full boolean; v_paq int; v uuid; v_sesion text := current_setting('request.jwt.claims', true);
begin
  if exists (select 1 from envios where pedido_id = p_pedido and estado <> 'cancelado') then return null; end if;
  -- Una venta traída de días anteriores que ML ya mandó (o entregó) no se vuelve a empacar (134).
  if exists (select 1 from ml_ventas where pedido_id = p_pedido and envio_ml in ('shipped', 'delivered', 'not_delivered')) then return null; end if;
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
    update ml_ventas set nota = 'No se pudo pedir el envío solo: ' || sqlerrm, actualizado_en = now() where pedido_id = p_pedido;
  end;
  perform set_config('request.jwt.claims', coalesce(v_sesion, ''), true);
  return v;
end $$;

-- La caja no se cierra con una partida que nadie sabe qué es. Va en un disparador para no tocar
-- marcar_empacado (183), que es largo y ya tiene sus reglas.
create or replace function public.envio_sin_ligar() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_que text;
begin
  if new.estado = 'empacado' and old.estado is distinct from 'empacado' then
    select string_agg(descripcion, '», «') into v_que from envio_lineas
    where envio_id = new.id and articulo_id is null and publicacion_ml is not null;
    if v_que is not null then
      raise exception 'Antes de cerrar la caja di qué artículo es «%»: «Ligar artículo» en la partida', v_que;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists envio_sin_ligar on public.envios;
create trigger envio_sin_ligar before update of estado on public.envios
  for each row execute function public.envio_sin_ligar();

-- 2. ---------------------------------------------------------------------------
alter table public.publicaciones alter column piezas_por_paquete type numeric(12,4);
alter table public.publicaciones drop constraint if exists publicaciones_piezas_positivas;
alter table public.publicaciones add constraint publicaciones_piezas_positivas check (piezas_por_paquete > 0);

-- Ligar: las ventas que esperaban quedan en piezas y sus envíos abiertos también. Si ML ya se
-- llevó el paquete, la salida de inventario que no se pudo hacer sin artículo se hace ahora.
drop function if exists public.ml_ligar_publicacion(text, uuid, int);
create or replace function public.ml_ligar_publicacion(p_item text, p_articulo uuid, p_piezas numeric default 1) returns int
language plpgsql security definer set search_path = public as $$
declare s ml_publicaciones_sin_ligar; v_n int; r record; v_pzas numeric := coalesce(p_piezas, 1); a articulos;
  v_alm int; v_mov bigint; v_ml int := almacen_ml();
begin
  -- Almacén también: es quien tiene el paquete enfrente cuando ventas no lo ha ligado.
  if not (puede('ventas', 2) or puede('compras', 2) or puede('envios', 2)) then
    raise exception 'Ligar publicaciones es de ventas, compras o almacén' using errcode = '42501';
  end if;
  select * into a from articulos where id = p_articulo and activo;
  if a.id is null then raise exception 'Ese artículo no existe o está dado de baja'; end if;
  if v_pzas <= 0 then raise exception 'Las piezas por venta tienen que ser más de cero'; end if;
  if exists (select 1 from ml_publicaciones_ajenas where item_id = p_item) then
    raise exception 'Esa publicación está marcada como de otra tienda';
  end if;
  select * into s from ml_publicaciones_sin_ligar where item_id = p_item;
  insert into publicaciones (articulo_id, canal, id_externo, titulo, precio, piezas_por_paquete)
  values (p_articulo, 'mercadolibre', p_item, s.titulo, s.precio, v_pzas)
  on conflict (canal, id_externo) do update set articulo_id = excluded.articulo_id, piezas_por_paquete = excluded.piezas_por_paquete, actualizado_en = now();
  delete from ml_publicaciones_sin_ligar where item_id = p_item;

  -- Las partidas de envío van primero, mientras la del pedido todavía dice cuántas ventas eran.
  for r in select el.id, el.cantidad, e.id envio_id, e.tipo, e.estado, e.inventario_descontado_en, e.pedido_id, e.folio
           from envio_lineas el join envios e on e.id = el.envio_id
           where el.publicacion_ml = p_item and el.articulo_id is null and e.estado <> 'cancelado' loop
    v_alm := case r.tipo when 'full' then v_ml when 'proveedor' then null else almacen_de_salida(p_articulo, r.cantidad * v_pzas) end;
    update envio_lineas set articulo_id = p_articulo, descripcion = a.nombre, cantidad = r.cantidad * v_pzas, almacen_id = v_alm
    where id = r.id;
    if r.inventario_descontado_en is not null and a.controla_inventario and a.tipo <> 'servicio' and v_alm is not null then
      begin
        insert into movimientos_inventario (tipo, articulo_id, almacen_id, cantidad, pedido_id, motivo, costo_unitario)
        values ('salida_venta', p_articulo, v_alm, -(r.cantidad * v_pzas), r.pedido_id,
                r.folio || ' · ligada después de salir',
                (select c.costo * tc(c.moneda) from costos_articulo c where c.articulo_id = p_articulo))
        returning id into v_mov;
        update envio_lineas set cantidad_descontada = r.cantidad * v_pzas, movimiento_id = v_mov,
          nota_inventario = 'Se descontó al ligarla, después de salir' where id = r.id;
      exception when others then
        update envio_lineas set nota_inventario = 'Se ligó después de salir y no se pudo descontar (' || sqlerrm || '): pide un ajuste'
        where id = r.id;
      end;
    end if;
    insert into eventos_envio (envio_id, tipo, nota) values (r.envio_id, 'nota', format('Partida ligada a %s · %s', a.clave, a.nombre));
  end loop;

  update pedido_lineas pl set articulo_id = p_articulo, linea = linea_de(p_articulo), unidad = a.unidad,
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
revoke execute on function public.ml_ligar_publicacion(text, uuid, numeric) from public, anon;
grant execute on function public.ml_ligar_publicacion(text, uuid, numeric) to authenticated;

-- Corregir (134), con piezas que pueden ser fracción.
drop function if exists public.ml_corregir_publicacion(text, uuid, int);
create or replace function public.ml_corregir_publicacion(p_item text, p_articulo uuid, p_piezas numeric default 1) returns jsonb
language plpgsql security definer set search_path = public as $$
declare pub publicaciones; r record; v_lin int := 0; v_tarde int := 0; v_pzas numeric := coalesce(p_piezas, 1);
begin
  if not (puede('ventas', 2) or puede('compras', 2)) then raise exception 'Corregir publicaciones es de ventas o compras' using errcode = '42501'; end if;
  select * into pub from publicaciones where canal = 'mercadolibre' and id_externo = p_item for update;
  if not found then raise exception 'Esa publicación no está ligada'; end if;
  if v_pzas <= 0 then raise exception 'Las piezas por venta tienen que ser más de cero'; end if;
  if p_articulo is not null and not exists (select 1 from articulos where id = p_articulo and activo) then
    raise exception 'Ese artículo no existe o está dado de baja';
  end if;
  for r in select pl.id, pl.pedido_id from pedido_lineas pl join pedidos p on p.id = pl.pedido_id
           where pl.referencia_externa = p_item and p.canal = 'mercadolibre' and p.estado not in ('cancelado', 'entregado') loop
    if exists (select 1 from envios e where e.pedido_id = r.pedido_id and e.estado in ('guia_lista', 'empacado', 'enviado', 'entregado')) then
      v_tarde := v_tarde + 1; continue;
    end if;
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
revoke execute on function public.ml_corregir_publicacion(text, uuid, numeric) from public, anon;
grant execute on function public.ml_corregir_publicacion(text, uuid, numeric) to authenticated;

-- 3. ---------------------------------------------------------------------------
create table if not exists public.ml_publicaciones_ajenas (
  item_id text primary key,
  titulo text,
  sku text,
  marcada_por uuid default auth.uid() references public.perfiles(id),
  marcada_en timestamptz not null default now()
);
alter table public.ml_publicaciones_ajenas enable row level security;
drop policy if exists ver on public.ml_publicaciones_ajenas;
create policy ver on public.ml_publicaciones_ajenas for select to authenticated
  using ((select puede('ventas', 1)) or (select puede('compras', 1)));

-- No es de Hegamex: sus ventas que ya entraron se cancelan (con el motivo), pierden su cobro (no es
-- dinero de Hegamex) y se sueltan de la venta de ML para que un aviso repetido no las reviva. No se
-- borran: el envío ya tiene su historial, que no se borra. Si el paquete ya se empacó o salió,
-- alguien de planta lo movió y se revisa a mano.
create or replace function public.ml_marcar_ajena(p_item text) returns int
language plpgsql security definer set search_path = public as $$
declare s ml_publicaciones_sin_ligar; r record; v_n int := 0;
  v_motivo text := 'No es de Hegamex: publicación de otra tienda en la misma cuenta de Mercado Libre';
begin
  if not (puede('ventas', 2) or puede('compras', 2)) then raise exception 'Esto lo decide ventas o compras' using errcode = '42501'; end if;
  if exists (select 1 from publicaciones where canal = 'mercadolibre' and id_externo = p_item) then
    raise exception 'Esa publicación está ligada a un artículo: desligala primero';
  end if;
  select * into s from ml_publicaciones_sin_ligar where item_id = p_item;
  insert into ml_publicaciones_ajenas (item_id, titulo, sku) values (p_item, s.titulo, s.sku) on conflict (item_id) do nothing;
  delete from ml_publicaciones_sin_ligar where item_id = p_item;

  for r in select distinct p.id, p.folio, p.id_externo from pedidos p join pedido_lineas pl on pl.pedido_id = p.id
           where p.canal = 'mercadolibre' and p.estado <> 'cancelado' and pl.referencia_externa = p_item and pl.articulo_id is null loop
    if exists (select 1 from envios e where e.pedido_id = r.id and (e.empacado_en is not null or e.estado in ('enviado', 'entregado'))) then
      raise exception 'La venta % ya se empacó o salió: revísala a mano antes de marcar la publicación', r.folio;
    end if;
    if exists (select 1 from pedido_lineas pl where pl.pedido_id = r.id
               and (pl.referencia_externa is distinct from p_item or pl.articulo_id is not null)) then
      -- Venta mixta (algo nuestro y algo de la otra tienda): solo sale la partida ajena.
      delete from envio_lineas where publicacion_ml = p_item and pedido_linea_id in (select id from pedido_lineas where pedido_id = r.id);
      delete from pedido_lineas where pedido_id = r.id and referencia_externa = p_item and articulo_id is null;
    else
      update envios set estado = 'cancelado', motivo_cancelacion = v_motivo, cancelado_en = now(), cancelado_por = auth.uid()
      where pedido_id = r.id and estado <> 'cancelado';
      delete from cobros where pedido_id = r.id;
      delete from ml_ventas where pedido_id = r.id;      -- y sus pagos
      update pedidos set estado = 'cancelado', motivo_cancelacion = v_motivo, id_externo = null,
        notas = concat_ws(' · ', notas, 'venta ' || r.id_externo || ' de Mercado Libre')
      where id = r.id;
    end if;
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;
revoke execute on function public.ml_marcar_ajena(text) from public, anon;
grant execute on function public.ml_marcar_ajena(text) to authenticated;

-- Por si se marcó por error: vuelve a «por ligar». Las ventas canceladas no regresan solas;
-- «Traer lo pendiente» las vuelve a traer como ventas nuevas.
create or replace function public.ml_desmarcar_ajena(p_item text) returns void
language plpgsql security definer set search_path = public as $$
declare a ml_publicaciones_ajenas;
begin
  if not (puede('ventas', 2) or puede('compras', 2)) then raise exception 'Esto lo decide ventas o compras' using errcode = '42501'; end if;
  delete from ml_publicaciones_ajenas where item_id = p_item returning * into a;
  if a.item_id is null then raise exception 'Esa publicación no estaba marcada'; end if;
  insert into ml_publicaciones_sin_ligar (item_id, titulo, sku) values (a.item_id, a.titulo, a.sku) on conflict (item_id) do nothing;
end $$;
revoke execute on function public.ml_desmarcar_ajena(text) from public, anon;
grant execute on function public.ml_desmarcar_ajena(text) to authenticated;

-- La venta (165): no registra lo de la otra tienda, acepta piezas con fracción y pide el envío
-- aunque falte ligar.
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
    insert into pedido_lineas (pedido_id, orden, articulo_id, titulo, unidad, cantidad, precio_unitario, linea, referencia_externa)
    values (v_ped.id, v_orden, v_art, coalesce(it->>'titulo', 'Publicación ' || (it->>'item_id')),
      coalesce((select unidad from articulos where id = v_art), 'pieza'), greatest(coalesce((it->>'cantidad')::numeric, 1), 0.001) * v_pzas,
      round(coalesce((it->>'precio')::numeric, 0) / 1.16 / v_pzas, 2), case when v_art is null then 'refacciones' else linea_de(v_art) end, it->>'item_id');
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

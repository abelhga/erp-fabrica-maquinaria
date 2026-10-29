-- =============================================================================
-- Mercado Libre, fase 1 (solo lee de ML): tablero de publicaciones, reputación y reclamos, y lo
-- que hace falta para sugerir respuestas con el conocimiento del artículo.
--
-- Juan Carlos y Adriana atendían ML sin ver, desde el ERP, cómo va cada publicación ni la
-- reputación de la cuenta, y contestaban de memoria. Aquí nada escribe en ML: la conexión trae lo
-- que ML dice de cada publicación y de la cuenta, y la base lo cruza con el catálogo (precio de
-- lista, lo libre en planta, las piezas por venta).
--
-- 1. ml_publicaciones_estado: cómo está cada publicación en ML (precio, existencia, visitas,
--    fotos, envío, atributos y descripción). ml_tablero() la cruza con el ERP: precio sugerido,
--    existencia que se podría publicar, preguntas y ventas de 30 días.
-- 2. ml_reputacion: el termómetro de ML. ml_reclamos_abiertos(): los reclamos de ML que siguen
--    abiertos, sin montos (marketing no ve dinero).
-- 3. Para contestar: los datos fijos de la empresa (factura, envíos, garantía, horario) y las
--    respuestas rápidas. Claude los usa junto con la ficha del artículo; quien contesta decide.
-- =============================================================================

-- 1. ---------------------------------------------------------------------------
create table if not exists public.ml_publicaciones_estado (
  item_id text primary key,
  titulo text,
  estado text,                          -- active, paused, closed, under_review…
  precio numeric(14,2),                 -- con IVA, como se publica
  stock int,                            -- available_quantity
  vendidas int,                         -- sold_quantity (de por vida en ML)
  visitas_30d int,
  fotos int,
  permalink text,
  tipo_publicacion text,                -- gold_special (clásica), gold_pro (premium)
  logistica text,                       -- fulfillment (Full), xd_drop_off, cross_docking…
  envio_gratis boolean,
  atributos jsonb,                      -- [{nombre, valor}] tal cual los tiene ML
  descripcion text,                     -- se trae cuando hay preguntas de esa publicación
  descripcion_en timestamptz,
  actualizado_en timestamptz not null default now()
);
alter table public.ml_publicaciones_estado enable row level security;
drop policy if exists ver on public.ml_publicaciones_estado;
create policy ver on public.ml_publicaciones_estado for select to authenticated using ((select puede('mercadolibre', 1)));

-- Lo que manda la conexión: {publicaciones: [...], completo: bool}. Con completo, lo que ML ya no
-- devolvió (se cerró o se borró) sale del tablero.
create or replace function public.ml_registrar_publicaciones(p jsonb) returns int
language plpgsql security definer set search_path = public as $$
declare x jsonb; v_n int := 0; v_ids text[] := '{}';
begin
  if auth.uid() is not null then raise exception 'Las publicaciones las trae la conexión con ML' using errcode = '42501'; end if;
  for x in select * from jsonb_array_elements(coalesce(p->'publicaciones', '[]')) loop
    continue when nullif(x->>'item_id', '') is null;
    v_ids := v_ids || (x->>'item_id');
    insert into ml_publicaciones_estado (item_id, titulo, estado, precio, stock, vendidas, visitas_30d, fotos, permalink,
      tipo_publicacion, logistica, envio_gratis, atributos, actualizado_en)
    values (x->>'item_id', x->>'titulo', x->>'estado', (x->>'precio')::numeric, (x->>'stock')::int, (x->>'vendidas')::int,
      (x->>'visitas_30d')::int, (x->>'fotos')::int, x->>'permalink', x->>'tipo_publicacion', x->>'logistica',
      (x->>'envio_gratis')::boolean, x->'atributos', now())
    on conflict (item_id) do update set titulo = excluded.titulo, estado = excluded.estado, precio = excluded.precio,
      stock = excluded.stock, vendidas = excluded.vendidas, visitas_30d = coalesce(excluded.visitas_30d, ml_publicaciones_estado.visitas_30d),
      fotos = excluded.fotos, permalink = excluded.permalink, tipo_publicacion = excluded.tipo_publicacion,
      logistica = excluded.logistica, envio_gratis = excluded.envio_gratis,
      atributos = coalesce(excluded.atributos, ml_publicaciones_estado.atributos), actualizado_en = now();
    v_n := v_n + 1;
  end loop;
  if coalesce((p->>'completo')::boolean, false) then
    delete from ml_publicaciones_estado where not (item_id = any(v_ids));
  end if;
  return v_n;
end $$;
revoke execute on function public.ml_registrar_publicaciones(jsonb) from public, anon, authenticated;

-- La descripción de una publicación (se trae cuando alguien pregunta en ella).
create or replace function public.ml_registrar_descripcion(p_item text, p_texto text, p_atributos jsonb default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null then raise exception 'La descripción la trae la conexión con ML' using errcode = '42501'; end if;
  insert into ml_publicaciones_estado (item_id, descripcion, descripcion_en, atributos)
  values (p_item, nullif(trim(p_texto), ''), now(), p_atributos)
  on conflict (item_id) do update set descripcion = excluded.descripcion, descripcion_en = now(),
    atributos = coalesce(excluded.atributos, ml_publicaciones_estado.atributos);
end $$;
revoke execute on function public.ml_registrar_descripcion(text, text, jsonb) from public, anon, authenticated;

-- El precio sugerido para ML, como precio_canal (003) pero con piezas por venta con fracción
-- (1 juego = 0.25 de caja, 186). Con IVA.
create or replace function public.precio_ml_sugerido(p_articulo uuid, p_con_envio boolean, p_piezas numeric default 1)
returns numeric language sql stable set search_path = public as $$
  select round(case when bruto * 1.16 < c.umbral_cuota_fija then (bruto + c.cuota_fija) * 1.16 else bruto * 1.16 end, 2)
  from canales c
  cross join lateral (
    select (pl.precio * coalesce(nullif(p_piezas, 0), 1)) / (1 - c.comision_pct) + case when p_con_envio then c.costo_envio else 0 end as bruto
    from precios_lista pl where pl.articulo_id = p_articulo
  ) x
  where c.canal = 'mercadolibre'
$$;

-- Lo libre en planta: existencia en almacenes de planta menos lo apartado (Full no cuenta).
create or replace function public.libre_en_planta(p_articulo uuid) returns numeric
language sql stable security definer set search_path = public as $$
  select greatest(0,
    coalesce((select sum(e.cantidad) from existencias e join almacenes al on al.id = e.almacen_id
              where e.articulo_id = p_articulo and al.disponible_para_planta), 0)
    - coalesce((select sum(r.cantidad - r.surtido) from reservas r where r.articulo_id = p_articulo and r.estado = 'activa'), 0))
$$;
revoke execute on function public.libre_en_planta(uuid) from public, anon;
grant execute on function public.libre_en_planta(uuid) to authenticated;

-- El tablero: cada publicación con lo que dice ML y lo que dice el ERP. Unidades, no dinero de
-- ventas: lo ve marketing. El precio sugerido solo sale a quien ve precios de venta (149).
create or replace function public.ml_tablero()
returns table (item_id text, titulo text, estado text, logistica text, envio_gratis boolean, permalink text, fotos int,
  tipo_publicacion text, precio_ml numeric, stock_ml int, vendidas_total int, visitas_30d int,
  articulo_id uuid, clave text, articulo text, imagen_url text, piezas numeric,
  precio_sugerido numeric, libre_planta numeric, stock_sugerido int,
  preguntas_30d int, sin_contestar int, ventas_30d int, unidades_30d numeric, actualizado_en timestamptz)
language plpgsql stable security definer set search_path = public as $$
declare v_precios boolean := ve_precios_venta();
begin
  if not puede('mercadolibre', 1) then raise exception 'El tablero de Mercado Libre es de quien atiende ML' using errcode = '42501'; end if;
  return query
  select e.item_id, e.titulo, e.estado, e.logistica, e.envio_gratis, e.permalink, e.fotos, e.tipo_publicacion,
    case when v_precios then e.precio end, e.stock, e.vendidas, e.visitas_30d,
    pub.articulo_id, a.clave, a.nombre, a.imagen_url, pub.piezas_por_paquete,
    case when v_precios and pub.articulo_id is not null then precio_ml_sugerido(pub.articulo_id, coalesce(e.envio_gratis, false), pub.piezas_por_paquete) end,
    case when pub.articulo_id is not null then libre_en_planta(pub.articulo_id) end,
    case when pub.articulo_id is not null and coalesce(e.logistica, '') <> 'fulfillment'
         then floor(libre_en_planta(pub.articulo_id) / nullif(pub.piezas_por_paquete, 0))::int end,
    (select count(*)::int from ml_preguntas q where q.item_id = e.item_id and q.recibida_en > now() - interval '30 days'),
    (select count(*)::int from ml_preguntas q where q.item_id = e.item_id and q.estado = 'pendiente'),
    (select count(distinct pe.id)::int from pedido_lineas pl join pedidos pe on pe.id = pl.pedido_id
      where pe.canal = 'mercadolibre' and pe.estado <> 'cancelado' and pl.referencia_externa = e.item_id and pe.fecha > hoy_mx() - 30),
    (select coalesce(sum(pl.cantidad / coalesce(nullif(pub.piezas_por_paquete, 0), 1)), 0) from pedido_lineas pl join pedidos pe on pe.id = pl.pedido_id
      where pe.canal = 'mercadolibre' and pe.estado <> 'cancelado' and pl.referencia_externa = e.item_id and pe.fecha > hoy_mx() - 30),
    e.actualizado_en
  from ml_publicaciones_estado e
  left join publicaciones pub on pub.canal = 'mercadolibre' and pub.id_externo = e.item_id
  left join articulos a on a.id = pub.articulo_id
  where e.titulo is not null
  order by e.visitas_30d desc nulls last, e.titulo;
end $$;
revoke execute on function public.ml_tablero() from public, anon;
grant execute on function public.ml_tablero() to authenticated;

-- 2. ---------------------------------------------------------------------------
create table if not exists public.ml_reputacion (
  id int primary key default 1 check (id = 1),
  datos jsonb not null,                 -- seller_reputation de ML, tal cual
  actualizado_en timestamptz not null default now()
);
alter table public.ml_reputacion enable row level security;
drop policy if exists ver on public.ml_reputacion;
create policy ver on public.ml_reputacion for select to authenticated using ((select puede('mercadolibre', 1)));

create or replace function public.ml_registrar_reputacion(p jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null then raise exception 'La reputación la trae la conexión con ML' using errcode = '42501'; end if;
  insert into ml_reputacion (id, datos, actualizado_en) values (1, coalesce(p, '{}'), now())
  on conflict (id) do update set datos = excluded.datos, actualizado_en = now();
end $$;
revoke execute on function public.ml_registrar_reputacion(jsonb) from public, anon, authenticated;

-- Los reclamos y devoluciones de ML que siguen abiertos. Sin montos: lo ve marketing.
create or replace function public.ml_reclamos_abiertos()
returns table (id uuid, folio text, tipo text, estado text, motivo text, fecha_limite timestamptz, responsable text,
  pedido text, venta_ml text, publicacion text, abierto_en timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not puede('mercadolibre', 1) then raise exception 'Los reclamos de ML son de quien atiende ML' using errcode = '42501'; end if;
  return query
  select d.id, d.folio, d.tipo, d.estado, d.motivo, d.fecha_limite, pr.nombre, pe.folio, pe.id_externo,
    (select string_agg(pl.titulo, ', ') from pedido_lineas pl where pl.pedido_id = pe.id), d.creado_en
  from devoluciones d
  join pedidos pe on pe.id = d.pedido_id
  left join perfiles pr on pr.id = d.responsable_id
  where pe.canal = 'mercadolibre' and d.estado in ('abierta', 'respondida')
  order by d.fecha_limite nulls last, d.creado_en;
end $$;
revoke execute on function public.ml_reclamos_abiertos() from public, anon;
grant execute on function public.ml_reclamos_abiertos() to authenticated;

-- 3. ---------------------------------------------------------------------------
-- Los datos fijos con que se contesta (factura, envíos, garantía, horario…). Un solo texto que
-- edita quien atiende ML; Claude lo toma como verdad de la empresa.
insert into public.configuracion (clave, valor, descripcion)
values ('mercadolibre_respuestas', '{"politicas": ""}', 'Mercado Libre: lo que siempre aplica al contestar (factura, envíos, garantía, horario)')
on conflict (clave) do nothing;

create or replace function public.politicas_ml() returns text
language sql stable security definer set search_path = public as $$
  select case when puede('mercadolibre', 1) then (select valor->>'politicas' from configuracion where clave = 'mercadolibre_respuestas') end
$$;
revoke execute on function public.politicas_ml() from public, anon;
grant execute on function public.politicas_ml() to authenticated;

create or replace function public.fijar_politicas_ml(p_texto text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not puede('mercadolibre', 2) then raise exception 'Esto lo cambia quien atiende Mercado Libre' using errcode = '42501'; end if;
  update configuracion set valor = jsonb_set(valor, '{politicas}', to_jsonb(left(coalesce(trim(p_texto), ''), 4000))), actualizado_en = now()
  where clave = 'mercadolibre_respuestas';
end $$;
revoke execute on function public.fijar_politicas_ml(text) from public, anon;
grant execute on function public.fijar_politicas_ml(text) to authenticated;

create table if not exists public.ml_respuestas_rapidas (
  id uuid primary key default gen_random_uuid(),
  titulo text not null check (length(trim(titulo)) between 2 and 60),
  texto text not null check (length(trim(texto)) between 2 and 2000),
  creado_por uuid default auth.uid() references public.perfiles(id),
  creado_en timestamptz not null default now()
);
alter table public.ml_respuestas_rapidas enable row level security;
drop policy if exists ver on public.ml_respuestas_rapidas;
create policy ver on public.ml_respuestas_rapidas for select to authenticated using ((select puede('mercadolibre', 1)));
drop policy if exists editar on public.ml_respuestas_rapidas;
create policy editar on public.ml_respuestas_rapidas for all to authenticated
  using ((select puede('mercadolibre', 2))) with check ((select puede('mercadolibre', 2)));
grant select, insert, update, delete on public.ml_respuestas_rapidas to authenticated;

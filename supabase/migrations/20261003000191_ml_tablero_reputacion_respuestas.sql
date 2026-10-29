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
--    fotos, envío, atributos y descripción) y lo que ML cobra de verdad por venderla: la comisión
--    clásica y la premium de su categoría y lo que le cuesta a la cuenta su envío gratis (cambia con
--    el peso, la reputación y el tipo de envío). ml_tablero() la cruza con el ERP: precio sugerido
--    para clásica y para premium, existencia que se podría publicar, preguntas y ventas de 30 días.
--    Juan Carlos veía una sola tarifa: la de canales (12 % y $110 de envío para todo).
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
  categoria_id text,
  categoria text,
  comision_clasica numeric(6,3),        -- % que cobra ML en clásica (gold_special) en esa categoría
  fijo_clasica numeric(10,2),           -- cuota fija por unidad al precio de hoy (abajo de $299)
  comision_premium numeric(6,3),        -- % en premium (gold_pro)
  fijo_premium numeric(10,2),
  costo_envio numeric(10,2),            -- lo que paga la cuenta por el envío gratis de esta publicación
  peso_facturable numeric(10,3),
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
      tipo_publicacion, logistica, envio_gratis, atributos, categoria_id, categoria, comision_clasica, fijo_clasica,
      comision_premium, fijo_premium, costo_envio, peso_facturable, actualizado_en)
    values (x->>'item_id', x->>'titulo', x->>'estado', (x->>'precio')::numeric, (x->>'stock')::int, (x->>'vendidas')::int,
      (x->>'visitas_30d')::int, (x->>'fotos')::int, x->>'permalink', x->>'tipo_publicacion', x->>'logistica',
      (x->>'envio_gratis')::boolean, x->'atributos', x->>'categoria_id', x->>'categoria',
      (x->>'comision_clasica')::numeric, (x->>'fijo_clasica')::numeric, (x->>'comision_premium')::numeric, (x->>'fijo_premium')::numeric,
      (x->>'costo_envio')::numeric, (x->>'peso_facturable')::numeric, now())
    on conflict (item_id) do update set titulo = excluded.titulo, estado = excluded.estado, precio = excluded.precio,
      stock = excluded.stock, vendidas = excluded.vendidas, visitas_30d = coalesce(excluded.visitas_30d, ml_publicaciones_estado.visitas_30d),
      fotos = excluded.fotos, permalink = excluded.permalink, tipo_publicacion = excluded.tipo_publicacion,
      logistica = excluded.logistica, envio_gratis = excluded.envio_gratis,
      atributos = coalesce(excluded.atributos, ml_publicaciones_estado.atributos),
      categoria_id = coalesce(excluded.categoria_id, ml_publicaciones_estado.categoria_id),
      categoria = coalesce(excluded.categoria, ml_publicaciones_estado.categoria),
      -- Si ML no respondió esta vez, se queda lo último que dijo.
      comision_clasica = coalesce(excluded.comision_clasica, ml_publicaciones_estado.comision_clasica),
      fijo_clasica = coalesce(excluded.fijo_clasica, ml_publicaciones_estado.fijo_clasica),
      comision_premium = coalesce(excluded.comision_premium, ml_publicaciones_estado.comision_premium),
      fijo_premium = coalesce(excluded.fijo_premium, ml_publicaciones_estado.fijo_premium),
      costo_envio = coalesce(excluded.costo_envio, ml_publicaciones_estado.costo_envio),
      peso_facturable = coalesce(excluded.peso_facturable, ml_publicaciones_estado.peso_facturable), actualizado_en = now();
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

-- La comisión premium de respaldo (cuando ML no la dio): canales solo tenía la clásica.
alter table public.canales add column if not exists comision_premium_pct numeric(6,4);
update public.canales set comision_premium_pct = 0.165 where canal = 'mercadolibre' and comision_premium_pct is null;

-- El precio que deja, después de la comisión, la cuota fija y el envío, lo que se quiere recibir
-- (p_base: el precio de lista con IVA por las piezas de cada venta). En ML México el envío gratis
-- es obligatorio desde $299 en artículos nuevos y lo paga el vendedor; abajo de $299 lo paga el
-- comprador, pero se cobra una cuota fija por unidad ($25 abajo de $99, $30 abajo de $149, $37
-- abajo de $299). Redondeado al peso hacia arriba.
create or replace function public.precio_ml_para(p_base numeric, p_pct numeric, p_envio numeric,
  p_con_cuota boolean default true, p_envio_siempre boolean default false)
returns numeric language plpgsql immutable as $$
declare v numeric; t record;
begin
  if p_base is null or p_pct is null or p_pct >= 100 then return null; end if;
  v := (p_base + coalesce(p_envio, 0)) / (1 - p_pct / 100);
  if v >= 299 or p_envio_siempre then return ceil(v); end if;
  if not p_con_cuota then return ceil(p_base / (1 - p_pct / 100)); end if;
  for t in select * from (values (99, 25), (149, 30), (299, 37)) x(lim, cuota) loop
    v := (p_base + t.cuota) / (1 - p_pct / 100);
    if v < t.lim then return ceil(v); end if;
  end loop;
  return 299;   -- con la cuota pasaría de $299, y ahí ya va con envío: el escalón mismo
end $$;

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
-- ventas: lo ve marketing. Los precios sugeridos solo salen a quien ve precios de venta (149). La
-- comisión y el envío son los de ML para esa publicación; si ML no los dio, los de respaldo de
-- canales (y tarifas_de_ml = false lo dice).
create or replace function public.ml_tablero()
returns table (item_id text, titulo text, estado text, logistica text, envio_gratis boolean, permalink text, fotos int,
  tipo_publicacion text, categoria text, precio_ml numeric, stock_ml int, vendidas_total int, visitas_30d int,
  articulo_id uuid, clave text, articulo text, imagen_url text, piezas numeric,
  comision_clasica numeric, comision_premium numeric, costo_envio numeric, tarifas_de_ml boolean,
  precio_recibir numeric, sugerido_clasica numeric, sugerido_premium numeric, precio_sugerido numeric,
  libre_planta numeric, stock_sugerido int,
  preguntas_30d int, sin_contestar int, ventas_30d int, unidades_30d numeric, actualizado_en timestamptz)
language plpgsql stable security definer set search_path = public as $$
declare v_precios boolean := ve_precios_venta(); c canales;
begin
  if not puede('mercadolibre', 1) then raise exception 'El tablero de Mercado Libre es de quien atiende ML' using errcode = '42501'; end if;
  select * into c from canales where canal = 'mercadolibre';
  return query
  with b as (
    select e.*, pub.articulo_id art, pub.piezas_por_paquete pz, a.clave a_clave, a.nombre a_nombre, a.imagen_url a_img,
      coalesce(e.comision_clasica, c.comision_pct * 100) pct_c, coalesce(e.comision_premium, c.comision_premium_pct * 100) pct_p,
      coalesce(e.costo_envio, c.costo_envio) envio,
      (select pl.precio * coalesce(nullif(pub.piezas_por_paquete, 0), 1) * 1.16 from precios_lista pl where pl.articulo_id = pub.articulo_id) base
    from ml_publicaciones_estado e
    left join publicaciones pub on pub.canal = 'mercadolibre' and pub.id_externo = e.item_id
    left join articulos a on a.id = pub.articulo_id
    where e.titulo is not null
  ), s as (
    select b.*,
      -- Abajo de $299, una cuota fija de 0 en lo que ML cobró dice que ese tipo no la lleva.
      precio_ml_para(b.base, b.pct_c, b.envio, not (b.precio < 299 and b.fijo_clasica = 0), coalesce(b.envio_gratis, false) and b.precio < 299) sc,
      precio_ml_para(b.base, b.pct_p, b.envio, not (b.precio < 299 and b.fijo_premium = 0), coalesce(b.envio_gratis, false) and b.precio < 299) sp
    from b
  )
  select s.item_id, s.titulo, s.estado, s.logistica, s.envio_gratis, s.permalink, s.fotos, s.tipo_publicacion, s.categoria,
    case when v_precios then s.precio end, s.stock, s.vendidas, s.visitas_30d,
    s.art, s.a_clave, s.a_nombre, s.a_img, s.pz,
    s.pct_c, s.pct_p, case when v_precios then s.envio end, s.comision_clasica is not null and s.costo_envio is not null,
    case when v_precios then round(s.base, 2) end,
    case when v_precios then s.sc end, case when v_precios then s.sp end,
    case when v_precios then case when s.tipo_publicacion = 'gold_pro' then s.sp else s.sc end end,
    case when s.art is not null then libre_en_planta(s.art) end,
    case when s.art is not null and coalesce(s.logistica, '') <> 'fulfillment'
         then floor(libre_en_planta(s.art) / nullif(s.pz, 0))::int end,
    (select count(*)::int from ml_preguntas q where q.item_id = s.item_id and q.recibida_en > now() - interval '30 days'),
    (select count(*)::int from ml_preguntas q where q.item_id = s.item_id and q.estado = 'pendiente'),
    (select count(distinct pe.id)::int from pedido_lineas pl join pedidos pe on pe.id = pl.pedido_id
      where pe.canal = 'mercadolibre' and pe.estado <> 'cancelado' and pl.referencia_externa = s.item_id and pe.fecha > hoy_mx() - 30),
    (select coalesce(sum(pl.cantidad / coalesce(nullif(s.pz, 0), 1)), 0) from pedido_lineas pl join pedidos pe on pe.id = pl.pedido_id
      where pe.canal = 'mercadolibre' and pe.estado <> 'cancelado' and pl.referencia_externa = s.item_id and pe.fecha > hoy_mx() - 30),
    s.actualizado_en
  from s
  order by s.visitas_30d desc nulls last, s.titulo;
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

-- Varias fotos por equipo o subensamble, que salen en la cotización.
--
-- articulos.imagen_url existía, pero solo los componentes tenían pantalla para llenarla:
-- a un equipo no había cómo ponerle foto. Ahora un equipo tiene su lista de fotos; la
-- primera es la principal y se copia a articulos.imagen_url, así el buscador, la ficha y
-- agregar_partida siguen igual. Las demás viajan a la partida de la cotización como
-- copia (imagenes_extra), igual que ya se copiaba la principal: lo que se mandó al
-- cliente no cambia si después se cambian las fotos del equipo.

create table if not exists public.articulo_imagenes (
  id uuid primary key default gen_random_uuid(),
  articulo_id uuid not null references public.articulos(id) on delete cascade,
  url text not null,
  orden int not null default 0,
  creado_por uuid default auth.uid() references public.perfiles(id),
  creado_en timestamptz not null default now()
);
create index if not exists articulo_imagenes_articulo on public.articulo_imagenes (articulo_id, orden);
alter table public.articulo_imagenes enable row level security;
drop policy if exists ver on public.articulo_imagenes;
create policy ver on public.articulo_imagenes for select to authenticated using ((select cardinality(mis_roles())) > 0);
drop policy if exists editar on public.articulo_imagenes;
create policy editar on public.articulo_imagenes for all to authenticated
  using ((select puede('costeo', 2))) with check ((select puede('costeo', 2)));

-- La liga de Drive se convierte en imagen directa, como en articulos y cotizaciones.
create or replace function public.trg_liga_imagen_url() returns trigger
language plpgsql set search_path = public as $$
begin
  new.url := liga_imagen(new.url);
  if new.url is null then raise exception 'Pega la liga de la imagen o súbela'; end if;
  return new;
end $$;
drop trigger if exists liga_imagen on public.articulo_imagenes;
create trigger liga_imagen before insert or update of url on public.articulo_imagenes
  for each row execute function public.trg_liga_imagen_url();

-- Solo equipos y subensambles: los componentes siguen con su campo único en su ficha.
create or replace function public.trg_articulo_imagenes_fabricado() returns trigger
language plpgsql set search_path = public as $$
begin
  if not exists (select 1 from articulos where id = new.articulo_id and tipo in ('equipo', 'subensamble')) then
    raise exception 'Las fotos en lista son de equipos y subensambles; la del componente va en su ficha';
  end if;
  return new;
end $$;
drop trigger if exists solo_fabricados on public.articulo_imagenes;
create trigger solo_fabricados before insert or update of articulo_id on public.articulo_imagenes
  for each row execute function public.trg_articulo_imagenes_fabricado();

-- La principal (la de menor orden) es la que se ve en todo el ERP y junto a la partida.
-- Definer: escribe en articulos aunque quien sube la foto no pudiera tocar otras columnas.
create or replace function public.trg_imagen_principal() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_art uuid;
begin
  for v_art in select distinct x from unnest(array[case when tg_op <> 'INSERT' then old.articulo_id end,
                                                   case when tg_op <> 'DELETE' then new.articulo_id end]) x where x is not null loop
    update articulos set imagen_url = (select url from articulo_imagenes where articulo_id = v_art order by orden, creado_en limit 1)
    where id = v_art
      and imagen_url is distinct from (select url from articulo_imagenes where articulo_id = v_art order by orden, creado_en limit 1);
  end loop;
  return null;
end $$;
drop trigger if exists principal on public.articulo_imagenes;
create trigger principal after insert or update or delete on public.articulo_imagenes
  for each row execute function public.trg_imagen_principal();

-- Lo que ya había: la foto de un equipo (puesta por SQL o el importador) pasa a ser su principal.
insert into public.articulo_imagenes (articulo_id, url, orden, creado_por)
select a.id, a.imagen_url, 0, null from public.articulos a
where a.tipo in ('equipo', 'subensamble') and a.imagen_url is not null
  and not exists (select 1 from public.articulo_imagenes i where i.articulo_id = a.id);

-- -----------------------------------------------------------------------------
-- La copia en la cotización
-- -----------------------------------------------------------------------------
alter table public.cotizacion_lineas add column if not exists imagenes_extra text[];

create or replace function public.agregar_partida(p_cotizacion uuid, p_articulo uuid, p_cantidad numeric default 1)
returns public.cotizacion_lineas language plpgsql security invoker as $$
declare r cotizacion_lineas;
begin
  insert into cotizacion_lineas (cotizacion_id, orden, articulo_id, titulo, descripcion, imagen_url, imagenes_extra, unidad, cantidad, precio_unitario)
  select c.id, coalesce((select max(orden) from cotizacion_lineas where cotizacion_id = c.id), 0) + 1,
    a.id, a.nombre, a.descripcion, a.imagen_url,
    -- Las fotos del equipo después de la principal: van a la hoja de fotos del PDF.
    nullif((select array_agg(i.url order by i.orden, i.creado_en) from articulo_imagenes i
            where i.articulo_id = a.id and i.url is distinct from a.imagen_url), '{}'),
    a.unidad, coalesce(p_cantidad, 1),
    round(coalesce(pl.precio, 0) / c.tipo_cambio * case when c.precios_con_iva then 1 + c.tasa_iva else 1 end, 2)
  from cotizaciones c cross join articulos a
  left join precios_lista pl on pl.articulo_id = a.id
  where c.id = p_cotizacion and a.id = p_articulo
  returning * into r;
  if r.id is null then raise exception 'No encontré la cotización o el artículo'; end if;
  return r;
end $$;

create or replace function public.duplicar_cotizacion(p_id uuid) returns uuid
language plpgsql security invoker as $$
declare v_nueva uuid;
begin
  insert into cotizaciones (cliente_id, contacto_id, atencion, empresa, vigencia_dias, moneda, tipo_cambio, tasa_iva, precios_con_iva,
    descuento_pct, leyenda_promocion, condiciones_pago, tiempo_entrega, notas, plan_meses, logo_comarca_url)
  select cliente_id, contacto_id, atencion, empresa, vigencia_dias, moneda, tipo_cambio, tasa_iva, precios_con_iva,
    descuento_pct, leyenda_promocion, condiciones_pago, tiempo_entrega, notas, plan_meses, logo_comarca_url
  from cotizaciones where id = p_id
  returning id into v_nueva;
  if v_nueva is null then raise exception 'No existe la cotización'; end if;
  insert into cotizacion_lineas (cotizacion_id, orden, articulo_id, titulo, descripcion, imagen_url, imagenes_extra, unidad, cantidad,
    precio_unitario, descuento_pct, opcional)
  select v_nueva, orden, articulo_id, titulo, descripcion, imagen_url, imagenes_extra, unidad, cantidad, precio_unitario, descuento_pct, opcional
  from cotizacion_lineas where cotizacion_id = p_id;
  return v_nueva;
end $$;

create or replace function public.nueva_version_cotizacion(p_id uuid) returns uuid
language plpgsql security invoker as $$
declare v_nueva uuid; v_raiz uuid; v_ver int; v_folio text;
begin
  select coalesce(origen_id, id) into v_raiz from cotizaciones where id = p_id;
  if v_raiz is null then raise exception 'No existe la cotización'; end if;
  select max(version) + 1 into v_ver from cotizaciones where id = v_raiz or origen_id = v_raiz;
  select regexp_replace(folio, '-v[0-9]+$', '') || '-v' || v_ver into v_folio from cotizaciones where id = v_raiz;
  insert into cotizaciones (folio, version, origen_id, cliente_id, contacto_id, atencion, empresa, oportunidad_id, vendedor_id,
    vigencia_dias, moneda, tipo_cambio, tasa_iva, precios_con_iva, descuento_pct, leyenda_promocion, condiciones_pago,
    tiempo_entrega, notas, plan_meses, logo_comarca_url)
  select v_folio, v_ver, v_raiz, cliente_id, contacto_id, atencion, empresa, oportunidad_id, vendedor_id,
    vigencia_dias, moneda, tipo_cambio, tasa_iva, precios_con_iva, descuento_pct, leyenda_promocion, condiciones_pago,
    tiempo_entrega, notas, plan_meses, logo_comarca_url
  from cotizaciones where id = p_id returning id into v_nueva;
  insert into cotizacion_lineas (cotizacion_id, orden, articulo_id, titulo, descripcion, imagen_url, imagenes_extra, unidad, cantidad,
    precio_unitario, descuento_pct, opcional)
  select v_nueva, orden, articulo_id, titulo, descripcion, imagen_url, imagenes_extra, unidad, cantidad, precio_unitario, descuento_pct, opcional
  from cotizacion_lineas l where cotizacion_id = p_id;
  return v_nueva;
end $$;

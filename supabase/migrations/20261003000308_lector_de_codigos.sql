-- =============================================================================
-- Almacén listo para un lector de códigos de barras (apagado mientras nadie lo prenda).
--
-- Por qué: quien compre el ERP con un almacén de mostrador va a querer registrar con lector, y
-- para eso hacen falta dos cosas que no había: saber qué código es de qué artículo, y encontrar
-- el artículo con el código exacto sin pasar por la búsqueda por nombre. En Hegamex no se usa
-- por ahora: el interruptor nace apagado y nada cambia en pantalla.
--
-- Cómo trabaja un lector USB: la computadora lo ve como un teclado; «escribe» el código y da
-- Enter. No hay controlador ni integración con el fabricante. De ahí salen dos reglas:
--   · El código se compara solo por letras y números, sin importar mayúsculas. Un lector manda
--     teclas, no letras: con el teclado en español el guion de «C-00041» llega como «'» o «/».
--   · La clave del artículo también vale como código: imprimir la clave en una etiqueta (barras
--     o QR) basta para usar lector sin dar de alta nada.
--
-- Qué hay:
--   · articulo_codigos: los códigos de un artículo (el del fabricante, el del proveedor, uno
--     propio). Un código es de un solo artículo y no puede ser la clave de otro.
--   · articulo_por_codigo(código, tipos): el artículo de ese código o de esa clave; nada si no
--     hay o si es ambiguo.
--   · buscar_articulos también encuentra por código, primero en la lista.
--   · fijar_lector_codigos(activo): el interruptor (almacén nivel 3 o sistemas).
-- =============================================================================

create or replace function public.codigo_normal(p text) returns text
language sql immutable parallel safe as $$
  select regexp_replace(upper(coalesce(p, '')), '[^A-Z0-9]', '', 'g')
$$;
revoke execute on function public.codigo_normal(text) from public, anon;
grant execute on function public.codigo_normal(text) to authenticated;

create table if not exists public.articulo_codigos (
  id bigint generated always as identity primary key,
  articulo_id uuid not null references public.articulos(id) on delete cascade,
  codigo text not null,
  nota text,
  creado_por uuid default auth.uid(),
  creado_en timestamptz not null default now(),
  constraint articulo_codigos_forma check (codigo = btrim(codigo) and codigo !~ '[\n\r\t]' and length(codigo) <= 120
    and length(public.codigo_normal(codigo)) >= 3)
);
create unique index if not exists articulo_codigos_unico on public.articulo_codigos (public.codigo_normal(codigo));
create index if not exists articulo_codigos_articulo on public.articulo_codigos (articulo_id);
create index if not exists articulos_clave_normal on public.articulos (public.codigo_normal(clave));

alter table public.articulo_codigos enable row level security;
drop policy if exists ver on public.articulo_codigos;
create policy ver on public.articulo_codigos for select to authenticated using ((select cardinality(mis_roles())) > 0);
-- Los mismos que editan el artículo. No hay «editar»: un código mal capturado se quita y se vuelve a poner.
drop policy if exists agregar on public.articulo_codigos;
create policy agregar on public.articulo_codigos for insert to authenticated
  with check ((select puede('inventario', 2)) or (select puede('compras', 2)) or (select puede('costeo', 2)));
drop policy if exists quitar on public.articulo_codigos;
create policy quitar on public.articulo_codigos for delete to authenticated
  using ((select puede('inventario', 2)) or (select puede('compras', 2)) or (select puede('costeo', 2)));
grant select, insert, delete on public.articulo_codigos to authenticated;

-- Un código que es la clave de otro artículo no se sabría de quién es.
create or replace function public.trg_codigo_no_es_clave_ajena() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_otro text;
begin
  new.codigo := btrim(new.codigo);
  select a.clave || ' · ' || a.nombre into v_otro from articulos a
  where codigo_normal(a.clave) = codigo_normal(new.codigo) and a.id <> new.articulo_id limit 1;
  if v_otro is not null then
    raise exception 'Ese código es la clave de otro artículo (%): no se puede usar para este', v_otro using errcode = '23505';
  end if;
  return new;
end $$;
drop trigger if exists no_es_clave_ajena on public.articulo_codigos;
create trigger no_es_clave_ajena before insert on public.articulo_codigos
  for each row execute function public.trg_codigo_no_es_clave_ajena();

-- El artículo de un código leído. Misma forma que buscar_articulos para que el buscador lo use igual.
create or replace function public.articulo_por_codigo(p_codigo text, p_tipos tipo_articulo[] default null)
returns table(id uuid, clave text, nombre text, tipo tipo_articulo, unidad text, descripcion text, imagen_url text, precio numeric,
              existencia numeric, tiempo_entrega_dias integer, es_importado boolean)
language sql stable security invoker set search_path = public as $$
  with c as (select codigo_normal(p_codigo) n),
  hallados as (
    -- Primero lo dado de alta como código; si no hay, la clave.
    select ac.articulo_id as id, 1 as peso from articulo_codigos ac, c where length(c.n) >= 3 and codigo_normal(ac.codigo) = c.n
    union all
    select a.id, 2 from articulos a, c where length(c.n) >= 3 and codigo_normal(a.clave) = c.n
  ), elegido as (
    select h.id from hallados h where h.peso = (select min(peso) from hallados)
  )
  select a.id, a.clave, a.nombre, a.tipo, a.unidad, a.descripcion, a.imagen_url, pl.precio,
    (select sum(e.cantidad) from existencias e join almacenes al on al.id = e.almacen_id
     where e.articulo_id = a.id and al.disponible_para_planta),
    a.tiempo_entrega_dias, a.es_importado
  from articulos a left join precios_lista pl on pl.articulo_id = a.id
  where a.activo and (p_tipos is null or a.tipo = any(p_tipos))
    and a.id in (select id from elegido)
    -- Dos artículos con la misma clave sin guiones: no se adivina.
    and (select count(*) from elegido) = 1
$$;
revoke execute on function public.articulo_por_codigo(text, tipo_articulo[]) from public, anon;
grant execute on function public.articulo_por_codigo(text, tipo_articulo[]) to authenticated;

-- buscar_articulos: quien escribe (o lee) un código en cualquier buscador encuentra su artículo.
-- Se parcha la definición viva para no pisar lo que haya cambiado desde la última vez.
do $$
declare v_def text := pg_get_functiondef('public.buscar_articulos(text, tipo_articulo[], integer)'::regprocedure);
  v_donde text := 'or sin_acentos(a.nombre) % t.t)';
  v_orden text := 'order by (sin_acentos(a.clave) = t.t) desc,';
begin
  if v_def like '%articulo_codigos%' then return; end if;
  if position(v_donde in v_def) = 0 or position(v_orden in v_def) = 0 then
    raise exception 'buscar_articulos ya no es la que se conocía: revisar antes de agregarle la búsqueda por código';
  end if;
  v_def := replace(v_def, v_donde, v_donde || E'\n         or a.id in (select ac.articulo_id from articulo_codigos ac where length(codigo_normal(q)) >= 3 and codigo_normal(ac.codigo) = codigo_normal(q))');
  v_def := replace(v_def, v_orden, 'order by (a.id in (select ac.articulo_id from articulo_codigos ac where length(codigo_normal(q)) >= 3 and codigo_normal(ac.codigo) = codigo_normal(q))) desc, (sin_acentos(a.clave) = t.t) desc,');
  execute v_def;
end $$;

-- El interruptor. Apagado no se ve nada del lector; los códigos que ya existan se conservan.
insert into public.configuracion (clave, valor, descripcion)
values ('almacen_lector_codigos', 'false'::jsonb, 'Almacén trabaja con lector de códigos de barras')
on conflict (clave) do nothing;

create or replace function public.fijar_lector_codigos(p_activo boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not (puede('inventario', 3) or puede('admin', 3)) then
    raise exception 'Solo almacén (administrar) o sistemas cambian esto' using errcode = '42501';
  end if;
  insert into configuracion (clave, valor, descripcion)
  values ('almacen_lector_codigos', to_jsonb(coalesce(p_activo, false)), 'Almacén trabaja con lector de códigos de barras')
  on conflict (clave) do update set valor = excluded.valor, actualizado_en = now();
end $$;
revoke execute on function public.fijar_lector_codigos(boolean) from public, anon;
grant execute on function public.fijar_lector_codigos(boolean) to authenticated;

-- Conteo con lista y a ciegas.
--
-- Un conteo traía todo lo que el sistema dice que hay en el almacén (1,032 renglones en Mallado):
-- para contar 24 artículos urgentes había que buscarlos uno por uno entre mil, y junto a la casilla
-- de lo contado se veía lo que dice el sistema, así que el número esperado contagiaba el conteo.
--
-- Ahora un conteo puede traer solo su lista (lo que piden las órdenes de producción, lo que se
-- movió en los últimos días o unas claves pegadas) y puede ser a ciegas: lo que dice el sistema
-- no se ve hasta capturar lo contado. El conteo de todo el almacén sigue igual.
--
-- A ciegas es para el proceso, no un secreto: quien cuenta puede ver existencias en otras
-- pantallas. Lo que importa es que la pantalla de captura no le ponga el número enfrente.

alter table public.conteos add column if not exists con_lista boolean not null default false;
alter table public.conteos add column if not exists a_ciegas boolean not null default false;

-- Lo que se cuenta en un conteo con lista, con una nota opcional de qué revisar en ese artículo.
create table if not exists public.conteo_articulos (
  conteo_id uuid not null references public.conteos(id) on delete cascade,
  articulo_id uuid not null references public.articulos(id),
  nota text,
  primary key (conteo_id, articulo_id)
);
alter table public.conteo_articulos enable row level security;
drop policy if exists ver on public.conteo_articulos;
create policy ver on public.conteo_articulos for select to authenticated using ((select puede('inventario', 1)));
-- La lista se arma al abrir el conteo (crear_conteo); mientras está abierto, almacén la puede completar.
drop policy if exists editar on public.conteo_articulos;
create policy editar on public.conteo_articulos for all to authenticated
  using ((select puede('inventario', 2)) and conteo_id in (select id from public.conteos where estado = 'abierto'))
  with check ((select puede('inventario', 2)) and conteo_id in (select id from public.conteos where estado = 'abierto'));

-- Abrir un conteo. p_modo: 'todo' (todo el almacén, como siempre), 'produccion' (lo que las órdenes
-- abiertas todavía no reciben o está apartado, y hay en este almacén), 'movidos' (lo que salió de
-- este almacén en los últimos p_dias días) o 'claves' (las que se peguen, separadas por espacio,
-- coma o renglón). security invoker: la RLS de conteos y conteo_articulos es la barrera.
create or replace function public.crear_conteo(p_almacen int, p_nombre text, p_modo text default 'todo',
                                               p_dias int default 30, p_claves text default null, p_a_ciegas boolean default true)
returns uuid language plpgsql security invoker set search_path = public as $$
declare v_id uuid; v_n int; v_faltan text; v_claves text[];
begin
  if not puede('inventario', 2) then
    raise exception 'Los conteos los abre almacén' using errcode = '42501';
  end if;
  if p_modo not in ('todo', 'produccion', 'movidos', 'claves') then
    raise exception 'No sé qué contar: %', p_modo using errcode = '22023';
  end if;
  if p_modo = 'claves' then
    v_claves := array(select distinct upper(trim(c)) from regexp_split_to_table(coalesce(p_claves, ''), '[\s,;]+') c where trim(c) <> '');
    if cardinality(v_claves) = 0 then
      raise exception 'Pega al menos una clave' using errcode = '22023';
    end if;
    select string_agg(c, ', ' order by c) into v_faltan from unnest(v_claves) c
     where not exists (select 1 from articulos a where upper(a.clave) = c);
    if v_faltan is not null then
      raise exception 'Estas claves no existen: %', v_faltan using errcode = '22023';
    end if;
  end if;

  insert into conteos (nombre, almacen_id, con_lista, a_ciegas)
  values (coalesce(nullif(trim(p_nombre), ''), (select nombre from almacenes where id = p_almacen) || ' · ' || to_char(hoy_planta(), 'DD/MM/YYYY')),
          p_almacen, p_modo <> 'todo', coalesce(p_a_ciegas, true))
  returning id into v_id;

  if p_modo = 'produccion' then
    insert into conteo_articulos (conteo_id, articulo_id)
    select distinct v_id, x.articulo_id from (
      select m.articulo_id from op_materiales m join ordenes_produccion o on o.id = m.orden_id
       where m.requerido > m.surtido and o.estado not in ('terminada', 'entregada', 'cancelada')
      union
      select r.articulo_id from reservas r where r.estado = 'activa'
    ) x
    join existencias e on e.articulo_id = x.articulo_id and e.almacen_id = p_almacen and e.cantidad <> 0;
  elsif p_modo = 'movidos' then
    insert into conteo_articulos (conteo_id, articulo_id)
    select distinct v_id, m.articulo_id from movimientos_inventario m
     where m.almacen_id = p_almacen and m.cantidad < 0 and m.en >= now() - make_interval(days => greatest(coalesce(p_dias, 30), 1));
  elsif p_modo = 'claves' then
    insert into conteo_articulos (conteo_id, articulo_id)
    select distinct v_id, a.id from articulos a where upper(a.clave) = any (v_claves);
  end if;

  if p_modo <> 'todo' then
    select count(*) into v_n from conteo_articulos where conteo_id = v_id;
    if v_n = 0 then
      raise exception 'No hay nada que contar con ese criterio en %', (select nombre from almacenes where id = p_almacen) using errcode = '22023';
    end if;
  end if;
  return v_id;
end $$;
revoke execute on function public.crear_conteo(int, text, text, int, text, boolean) from public, anon;
grant execute on function public.crear_conteo(int, text, text, int, text, boolean) to authenticated;

-- La captura: con lista, solo lo de la lista más lo que se agregó al contar; sin lista, todo lo que
-- el sistema dice que hay más lo agregado. A ciegas, lo que dice el sistema (y su valor) sale vacío
-- hasta que el artículo tiene lo contado.
drop function if exists public.conteo_captura(uuid);
create or replace function public.conteo_captura(p_conteo uuid)
returns table (articulo_id uuid, clave text, nombre text, unidad text, sistema numeric, contada numeric, diferencia numeric,
               contado_por text, contado_en timestamptz, valor_diferencia numeric, nota text)
language sql stable security invoker as $$
  with c as (select * from public.conteos where id = p_conteo),
  arts as (
    select e.articulo_id from public.existencias e join c on e.almacen_id = c.almacen_id where e.cantidad <> 0 and not c.con_lista
    union
    select ca.articulo_id from public.conteo_articulos ca where ca.conteo_id = p_conteo
    union
    select l.articulo_id from public.conteo_lineas l where l.conteo_id = p_conteo
  )
  select a.id, a.clave, a.nombre, a.unidad,
    case when c.a_ciegas and l.cantidad_contada is null then null else s.sistema end,
    l.cantidad_contada, l.cantidad_contada - s.sistema, u.nombre, l.en,
    case when (select public.puede('costos', 1)) and l.cantidad_contada is not null
         then round((l.cantidad_contada - s.sistema) * ca.costo * public.tc(ca.moneda), 2) end,
    n.nota
  from arts x
  join public.articulos a on a.id = x.articulo_id
  cross join c
  left join public.existencias e on e.articulo_id = a.id and e.almacen_id = c.almacen_id
  left join public.conteo_lineas l on l.conteo_id = p_conteo and l.articulo_id = a.id
  left join public.conteo_articulos n on n.conteo_id = p_conteo and n.articulo_id = a.id
  cross join lateral (select coalesce(l.sistema_al_contar, e.cantidad, 0) as sistema) s
  left join public.perfiles u on u.id = l.contado_por
  left join public.costos_articulo ca on ca.articulo_id = a.id
  order by a.nombre
$$;

-- «X de N contados»: con lista, N es la lista más lo agregado; sin lista, lo que hay en el almacén.
create or replace view public.v_conteos with (security_invoker = true) as
select c.id, c.nombre, c.almacen_id, al.nombre as almacen, c.estado, c.creado_por, u.nombre as creado_por_nombre,
  c.creado_en, c.cerrado_en,
  (select count(*) from public.conteo_lineas l where l.conteo_id = c.id) as capturados,
  case when c.con_lista then
    (select count(*) from (select ca.articulo_id from public.conteo_articulos ca where ca.conteo_id = c.id
                           union select l.articulo_id from public.conteo_lineas l where l.conteo_id = c.id) t)
  else (select count(*) from public.existencias e where e.almacen_id = c.almacen_id and e.cantidad <> 0) end as en_sistema,
  (select count(*) from public.ajustes_inventario aj where aj.conteo_id = c.id) as ajustes,
  (select count(*) from public.ajustes_inventario aj where aj.conteo_id = c.id and aj.estado = 'pendiente') as ajustes_pendientes,
  c.con_lista, c.a_ciegas
from public.conteos c
join public.almacenes al on al.id = c.almacen_id
left join public.perfiles u on u.id = c.creado_por;

-- =============================================================================
-- Planos y documentos técnicos con folio, revisión y vigente.
--
-- La carpeta de ingeniería en Drive (unos 6,500 archivos) no dice cuál plano es el
-- bueno: folios sin letra de revisión, carpetas DN/DA, 147 archivos "Final", "(1)"
-- o "copia", 316 copias duplicadas y al menos 103 planos que solo existen en la
-- "Mi unidad" del dibujante. El taller fabrica con el que encuentra.
--
-- Aquí el ERP da el folio (PL-00001) y la revisión (A, B, C…), y solo una revisión
-- por folio es la vigente. El archivo se queda en Drive: el ERP guarda la liga, no
-- el archivo. Cuando ingeniería revisa una orden de producción, la orden guarda con
-- qué revisión se va a fabricar; si después sale una revisión nueva, se avisa.
-- =============================================================================

create sequence if not exists public.planos_folio_seq;

create table if not exists public.documentos_tecnicos (
  id uuid primary key default gen_random_uuid(),
  folio text not null,
  revision text not null default 'A' check (revision ~ '^[A-Z]{1,2}$'),
  articulo_id uuid references public.articulos(id),
  pedido_id uuid references public.pedidos(id),
  -- carpeta = la carpeta de diseño del equipo en Drive (SolidWorks, DXF, programas de corte, fotos).
  tipo text not null check (tipo in ('plano', 'carpeta', 'corte', 'programa_cnc', 'modelo_3d', 'ficha', 'foto', 'otro')),
  titulo text not null check (length(trim(titulo)) > 0),
  drive_url text not null check (drive_url ~ '^https://(drive|docs)\.google\.com/'),
  estado text not null default 'borrador' check (estado in ('borrador', 'vigente', 'obsoleto')),
  cambio text,
  creado_por uuid default auth.uid() references public.perfiles(id),
  creado_en timestamptz not null default now(),
  aprobado_por uuid references public.perfiles(id),
  aprobado_en timestamptz,
  unique (folio, revision),
  -- Un plano es de un equipo o componente del catálogo, o de un proyecto de adaptación (un pedido).
  check (articulo_id is not null or pedido_id is not null)
);
alter table public.documentos_tecnicos drop constraint if exists documentos_tecnicos_tipo_check;
alter table public.documentos_tecnicos add constraint documentos_tecnicos_tipo_check
  check (tipo in ('plano', 'carpeta', 'corte', 'programa_cnc', 'modelo_3d', 'ficha', 'foto', 'otro'));
create unique index if not exists documentos_un_vigente on public.documentos_tecnicos (folio) where estado = 'vigente';
create index if not exists documentos_articulo on public.documentos_tecnicos (articulo_id, estado);

-- Con qué revisión se fabrica cada orden: se fija cuando ingeniería la revisa.
create table if not exists public.op_planos (
  orden_id uuid not null references public.ordenes_produccion(id) on delete cascade,
  documento_id uuid not null references public.documentos_tecnicos(id),
  registrado_en timestamptz not null default now(),
  primary key (orden_id, documento_id)
);

alter table public.documentos_tecnicos enable row level security;
alter table public.op_planos enable row level security;

-- Ingeniería ve todo (borradores y obsoletos). Los demás que trabajan con equipos
-- (taller, almacén, ventas para la ficha) ven solo lo vigente: nadie fabrica con un
-- plano viejo por error.
drop policy if exists ver on public.documentos_tecnicos;
create policy ver on public.documentos_tecnicos for select to authenticated using (
  (select puede('costeo', 2))
  or (estado = 'vigente' and ((select puede('costeo', 1)) or (select puede('produccion', 1)))));
drop policy if exists ver on public.op_planos;
create policy ver on public.op_planos for select to authenticated using (
  (select puede('produccion', 1)) or (select puede('costeo', 1)));
-- No hay políticas de escritura: todo pasa por las funciones de abajo.

create or replace function public.siguiente_revision(p_rev text) returns text
language sql immutable as $$
  -- A → B … Z → AA → AB…
  select case
    when p_rev ~ '^[A-Y]$' then chr(ascii(p_rev) + 1)
    when p_rev = 'Z' then 'AA'
    when p_rev ~ '^[A-Z][A-Y]$' then left(p_rev, 1) || chr(ascii(right(p_rev, 1)) + 1)
    else chr(ascii(left(p_rev, 1)) + 1) || 'A' end
$$;

create or replace function public.nuevo_documento_tecnico(p_articulo uuid, p_pedido uuid, p_tipo text, p_titulo text,
  p_drive_url text, p_cambio text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not puede('costeo', 2) then raise exception 'Solo ingeniería da de alta planos' using errcode = '42501'; end if;
  insert into documentos_tecnicos (folio, articulo_id, pedido_id, tipo, titulo, drive_url, cambio, creado_por)
  values ('PL-' || lpad(nextval('planos_folio_seq')::text, 5, '0'), p_articulo, p_pedido, p_tipo, trim(p_titulo),
          trim(p_drive_url), nullif(trim(coalesce(p_cambio, '')), ''), auth.uid())
  returning id into v_id;
  return v_id;
end $$;

-- Revisión nueva del mismo plano: mismo folio, la letra que sigue, en borrador.
create or replace function public.nueva_revision(p_documento uuid, p_drive_url text, p_cambio text) returns uuid
language plpgsql security definer set search_path = public as $$
declare d documentos_tecnicos; v_id uuid; v_rev text;
begin
  if not puede('costeo', 2) then raise exception 'Solo ingeniería saca revisiones' using errcode = '42501'; end if;
  if coalesce(trim(p_cambio), '') = '' then raise exception 'Di qué cambió en esta revisión: es lo que lee el taller' using errcode = '22023'; end if;
  select * into d from documentos_tecnicos where id = p_documento;
  if d.id is null then raise exception 'No existe ese plano'; end if;
  if exists (select 1 from documentos_tecnicos where folio = d.folio and estado = 'borrador') then
    raise exception 'Ya hay una revisión en borrador de %; apruébala o descártala primero', d.folio;
  end if;
  select siguiente_revision(max(revision)) into v_rev from documentos_tecnicos where folio = d.folio
    and length(revision) = (select max(length(revision)) from documentos_tecnicos where folio = d.folio);
  insert into documentos_tecnicos (folio, revision, articulo_id, pedido_id, tipo, titulo, drive_url, cambio, creado_por)
  values (d.folio, v_rev, d.articulo_id, d.pedido_id, d.tipo, d.titulo, trim(p_drive_url), trim(p_cambio), auth.uid())
  returning id into v_id;
  return v_id;
end $$;

-- Aprobar: esta revisión pasa a vigente y la anterior a obsoleta. Si hay órdenes
-- abiertas que se revisaron con la anterior, se avisa a quien las fabrica.
create or replace function public.aprobar_documento(p_documento uuid) returns void
language plpgsql security definer set search_path = public as $$
declare d documentos_tecnicos; v_anterior uuid; v_ops text;
begin
  if not puede('costeo', 2) then raise exception 'Solo ingeniería aprueba planos' using errcode = '42501'; end if;
  select * into d from documentos_tecnicos where id = p_documento for update;
  if d.estado <> 'borrador' then raise exception 'Solo se aprueba un borrador (este está %)', d.estado; end if;
  update documentos_tecnicos set estado = 'obsoleto' where folio = d.folio and estado = 'vigente' returning id into v_anterior;
  update documentos_tecnicos set estado = 'vigente', aprobado_por = auth.uid(), aprobado_en = now() where id = d.id;

  if v_anterior is not null then
    select string_agg(o.folio, ', ' order by o.folio) into v_ops
    from op_planos op join ordenes_produccion o on o.id = op.orden_id
    where op.documento_id = v_anterior and o.estado in ('planeada', 'liberada', 'en_proceso');
    if v_ops is not null and to_regproc('public.avisar') is not null then
      perform avisar(array(select usuarios_con_rol('gerente_produccion') union select usuarios_con_rol('ingenieria')),
        'plano_cambio', format('%s cambió a revisión %s', d.folio, d.revision),
        format('%s. Se revisaron con la anterior: %s. %s', d.titulo, v_ops, coalesce(d.cambio, '')),
        '/costeo/planos?folio=' || d.folio, 'documentos_tecnicos', d.id::text);
    end if;
  end if;
end $$;

-- Un borrador que no sirvió se descarta (se borra: nunca fue vigente, nadie fabricó con él).
create or replace function public.descartar_borrador(p_documento uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not puede('costeo', 2) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  delete from documentos_tecnicos where id = p_documento and estado = 'borrador';
  if not found then raise exception 'Solo se descarta un borrador'; end if;
end $$;

-- Un plano vigente u obsoleto no se reescribe: la historia de qué se fabricó con qué
-- tiene que sobrevivir. Lo único que cambia es vigente → obsoleto (al aprobar otro).
create or replace function public.documento_inmutable() returns trigger
language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    if old.estado <> 'borrador' then raise exception 'Un plano que fue vigente no se borra' using errcode = '42501'; end if;
    return old;
  end if;
  if old.estado <> 'borrador' then
    if (new.folio, new.revision, new.articulo_id, new.pedido_id, new.tipo, new.titulo, new.drive_url, new.cambio, new.creado_por)
       is distinct from (old.folio, old.revision, old.articulo_id, old.pedido_id, old.tipo, old.titulo, old.drive_url, old.cambio, old.creado_por)
       or not (old.estado = 'vigente' and new.estado = 'obsoleto' or new.estado = old.estado) then
      raise exception 'Un plano aprobado no se edita: saca una revisión nueva' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists documento_inmutable on public.documentos_tecnicos;
create trigger documento_inmutable before update or delete on public.documentos_tecnicos
  for each row execute function public.documento_inmutable();

-- Cuando ingeniería revisa una orden, la orden se queda con los planos vigentes de su equipo.
create or replace function public.fijar_planos_orden() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.revisado_ingenieria_en is not null and old.revisado_ingenieria_en is null then
    insert into op_planos (orden_id, documento_id)
    select new.id, d.id from documentos_tecnicos d
    where d.estado = 'vigente' and (d.articulo_id = new.articulo_id or (new.pedido_id is not null and d.pedido_id = new.pedido_id))
    on conflict do nothing;
  end if;
  return new;
end $$;
drop trigger if exists fijar_planos_orden on public.ordenes_produccion;
create trigger fijar_planos_orden after update of revisado_ingenieria_en on public.ordenes_produccion
  for each row execute function public.fijar_planos_orden();

-- Para las pantallas: cada documento con su equipo y, para la orden, si su revisión sigue vigente.
create or replace view public.v_documentos_tecnicos with (security_invoker = true) as
select d.*, a.clave, a.nombre as articulo, p.folio as pedido_folio, c.nombre as creado_por_nombre, ap.nombre as aprobado_por_nombre,
  (select count(*) from documentos_tecnicos x where x.folio = d.folio) as revisiones
from public.documentos_tecnicos d
left join public.articulos a on a.id = d.articulo_id
left join public.pedidos p on p.id = d.pedido_id
left join public.perfiles c on c.id = d.creado_por
left join public.perfiles ap on ap.id = d.aprobado_por;

-- Con los permisos de su dueño: el taller no lee planos obsoletos (para que nadie
-- fabrique con uno), pero sí tiene que ver que SU orden se revisó con una revisión
-- que ya cambió. Por eso repite aquí el filtro de quién ve órdenes.
drop view if exists public.v_planos_orden cascade;
create view public.v_planos_orden with (security_invoker = false) as
select * from (
select o.id as orden_id, d.id as documento_id, d.folio, d.revision, d.tipo, d.titulo, d.drive_url, d.estado,
  op.registrado_en,
  -- Si después de revisar la orden salió otra revisión, esta ya no es la buena.
  (select v.revision from public.documentos_tecnicos v where v.folio = d.folio and v.estado = 'vigente') as revision_vigente
from public.ordenes_produccion o
join public.op_planos op on op.orden_id = o.id
join public.documentos_tecnicos d on d.id = op.documento_id
union all
-- Orden aún sin revisar: se muestran los vigentes de su equipo (todavía no fijados).
select o.id, d.id, d.folio, d.revision, d.tipo, d.titulo, d.drive_url, d.estado, null, d.revision
from public.ordenes_produccion o
join public.documentos_tecnicos d on d.estado = 'vigente' and (d.articulo_id = o.articulo_id or (o.pedido_id is not null and d.pedido_id = o.pedido_id))
where o.revisado_ingenieria_en is null
) x
where (select puede('produccion', 1)) or (select puede('costeo', 1));
revoke all on public.v_planos_orden from anon;

-- Lo que importa hoy en ingeniería: órdenes abiertas fabricándose con una revisión
-- vieja y equipos en producción que no tienen plano vigente en el ERP.
create or replace function public.hallazgos_planos(p_area text) returns table (area text, tono text, titulo text, detalle text, ruta text, peso int)
language plpgsql stable security invoker as $$
declare k int; v_txt text;
begin
  if not (puede('costeo', 2) or puede('produccion', 3)) then return; end if;
  select count(distinct p.orden_id), string_agg(distinct o.folio, ', ') into k, v_txt
  from v_planos_orden p join ordenes_produccion o on o.id = p.orden_id
  where p.registrado_en is not null and p.revision_vigente is distinct from p.revision
    and o.estado in ('planeada', 'liberada', 'en_proceso');
  if k > 0 then
    area := 'produccion'; tono := 'riesgo'; peso := 8; ruta := '/produccion/ordenes';
    titulo := format('%s %s con un plano que ya cambió', k, case when k = 1 then 'orden se fabrica' else 'órdenes se fabrican' end);
    detalle := format('%s. Revisar con ingeniería antes de seguir cortando.', v_txt);
    return next;
  end if;
  select count(distinct o.articulo_id) into k from ordenes_produccion o
  where o.estado in ('planeada', 'liberada', 'en_proceso')
    and not exists (select 1 from documentos_tecnicos d where d.articulo_id = o.articulo_id and d.estado = 'vigente' and d.tipo = 'plano');
  if k > 0 then
    area := 'produccion'; tono := 'info'; peso := 75; ruta := '/costeo/planos';
    titulo := format('%s %s en producción sin plano vigente en el ERP', k, case when k = 1 then 'equipo' else 'equipos' end);
    detalle := 'El taller trabaja con lo que encuentra en Drive. Ligar el plano bueno toma un minuto.';
    return next;
  end if;
end $$;

select public.optimizar_politicas();

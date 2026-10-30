-- =============================================================================
-- Mantenimiento, segunda entrega de la junta con Esteban (30 oct).
--
-- 4. Rutinas: el encargado de mantenimiento las edita en su pantalla (antes solo se cargaban por
--    SQL). Guardar es una función para que la regla viva aquí: puntos con texto, nombre único, y
--    los preventivos que ya salieron y nadie ha empezado toman la lista nueva (si ya palomearon
--    algo, se quedan con la que tenían: cambiarla a medias revolvería lo marcado).
-- 7. Manuales y fichas técnicas por máquina: un archivo (PDF o imagen, en la carpeta de la máquina)
--    o una liga de Drive. Puede ser de una máquina o de todas las de la misma categoría y modelo:
--    las 13 inversoras AXT comparten manual y nadie lo va a subir 13 veces.
-- 8. Préstamo: para qué se la lleva (o para qué servicio) ya no es opcional; «no sé quién tiene
--    las pinzas ni para qué» era la queja. Al recibirla, una foto opcional de cómo regresó; si
--    regresó dañada, la foto va también en el reporte de falla.
-- 9. El QR y la etiqueta NFC no necesitan nada aquí: apuntan a /servicio/reportar?maquina=<id>,
--    que ya existía.
-- =============================================================================

-- ---------------------------------------------------------------- 4. rutinas
create or replace function public.guardar_rutina(p_id uuid, p_nombre text, p_categoria text, p_frecuencia text,
  p_recomendaciones text, p_puntos jsonb, p_activa boolean default true) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_id uuid := p_id; v_puntos jsonb; v_n int; v_planes int; v_ordenes int := 0; o record;
begin
  if not puede('mantenimiento', 3) then raise exception 'Solo el encargado de mantenimiento o la gerencia editan rutinas' using errcode = '42501'; end if;
  if coalesce(length(trim(p_nombre)), 0) < 3 then raise exception 'Ponle nombre a la rutina (por ejemplo «Inversoras AXT · mensual»)'; end if;
  if p_frecuencia is not null and p_frecuencia not in ('diaria', 'semanal', 'mensual', 'trimestral', 'semestral', 'anual') then
    raise exception 'Frecuencia no válida';
  end if;
  if jsonb_typeof(p_puntos) is distinct from 'array' then raise exception 'Los puntos van en una lista'; end if;
  -- Limpios y en orden: sin renglones vacíos, sección opcional.
  select coalesce(jsonb_agg(jsonb_build_object('seccion', nullif(trim(x->>'seccion'), ''), 'texto', trim(x->>'texto')) order by n), '[]')
  into v_puntos
  from jsonb_array_elements(p_puntos) with ordinality e(x, n)
  where coalesce(length(trim(x->>'texto')), 0) > 0;
  v_n := jsonb_array_length(v_puntos);
  if v_n = 0 then raise exception 'La rutina necesita al menos un punto que revisar'; end if;
  if exists (select 1 from rutinas_mantenimiento where lower(nombre) = lower(trim(p_nombre)) and id is distinct from v_id) then
    raise exception 'Ya hay una rutina que se llama «%»', trim(p_nombre);
  end if;

  if v_id is null then
    insert into rutinas_mantenimiento (nombre, categoria, frecuencia, recomendaciones, puntos, activa)
    values (trim(p_nombre), nullif(lower(trim(p_categoria)), ''), p_frecuencia, nullif(trim(p_recomendaciones), ''), v_puntos, coalesce(p_activa, true))
    returning id into v_id;
  else
    select count(*) into v_planes from planes_preventivos where rutina_id = v_id and activo;
    if not coalesce(p_activa, true) and v_planes > 0 then
      raise exception 'La usan % planes preventivos: cámbiales la rutina antes de desactivarla', v_planes;
    end if;
    update rutinas_mantenimiento set nombre = trim(p_nombre), categoria = nullif(lower(trim(p_categoria)), ''), frecuencia = p_frecuencia,
      recomendaciones = nullif(trim(p_recomendaciones), ''), puntos = v_puntos, activa = coalesce(p_activa, true)
    where id = v_id;
    if not found then raise exception 'No existe esa rutina'; end if;

    -- Los preventivos que salieron con esta rutina y nadie ha tocado toman la lista nueva.
    for o in
      select om.id from ordenes_mantenimiento om join planes_preventivos pl on pl.id = om.plan_id
      where pl.rutina_id = v_id and om.estado = 'pendiente'
        and not exists (select 1 from orden_checklist c where c.orden_id = om.id and c.bien is not null)
    loop
      delete from orden_checklist where orden_id = o.id;
      insert into orden_checklist (orden_id, orden, seccion, texto)
      select o.id, n::int, x->>'seccion', x->>'texto' from jsonb_array_elements(v_puntos) with ordinality e(x, n);
      v_ordenes := v_ordenes + 1;
    end loop;
  end if;
  return jsonb_build_object('id', v_id, 'puntos', v_n, 'ordenes_actualizadas', v_ordenes);
end $$;
revoke execute on function public.guardar_rutina(uuid, text, text, text, text, jsonb, boolean) from public, anon;
grant execute on function public.guardar_rutina(uuid, text, text, text, text, jsonb, boolean) to authenticated;

-- La lista de la pantalla: cuántos puntos, y qué planes y máquinas la usan.
create or replace view public.v_rutinas_mantenimiento with (security_invoker = true) as
select r.id, r.nombre, r.categoria, r.frecuencia, r.recomendaciones, r.puntos, r.activa, r.creado_en,
  jsonb_array_length(r.puntos) as num_puntos,
  (select count(distinct x->>'seccion') from jsonb_array_elements(r.puntos) x)::int as secciones,
  (select count(*) from public.planes_preventivos p where p.rutina_id = r.id and p.activo)::int as planes,
  (select coalesce(jsonb_agg(jsonb_build_object('id', m.id, 'numero', m.numero, 'nombre', m.nombre) order by m.numero), '[]')
   from public.maquinas m where m.id in (select p.maquina_id from public.planes_preventivos p where p.rutina_id = r.id and p.activo)) as maquinas
from public.rutinas_mantenimiento r;

-- ---------------------------------------------------------------- 7. manuales y fichas
create table if not exists public.maquina_documentos (
  id uuid primary key default gen_random_uuid(),
  maquina_id uuid references public.maquinas(id) on delete cascade,  -- de esta máquina…
  categoria text,                                                    -- …o de todas las de esta categoría
  modelo text,                                                       --    (y modelo, si lo tiene)
  tipo text not null default 'manual' check (tipo in ('manual', 'ficha_tecnica', 'diagrama', 'garantia', 'otro')),
  titulo text not null check (length(trim(titulo)) >= 3),
  ruta text check (ruta like 'maquinas/%/docs/%'),                   -- archivo en el almacenamiento de mantenimiento
  url text check (url ~* '^https?://'),                              -- o liga (Drive)
  creado_por uuid default auth.uid() references public.perfiles(id),
  creado_en timestamptz not null default now(),
  check (num_nonnulls(ruta, url) = 1),
  check (num_nonnulls(maquina_id, categoria) = 1)
);
create index if not exists maquina_documentos_maquina on public.maquina_documentos (maquina_id);
create index if not exists maquina_documentos_categoria on public.maquina_documentos (categoria, modelo);
alter table public.maquina_documentos enable row level security;
drop policy if exists ver on public.maquina_documentos;
create policy ver on public.maquina_documentos for select to authenticated using ((select puede('mantenimiento', 1)));
drop policy if exists agregar on public.maquina_documentos;
create policy agregar on public.maquina_documentos for insert to authenticated with check ((select puede('mantenimiento', 3)));
drop policy if exists quitar on public.maquina_documentos;
create policy quitar on public.maquina_documentos for delete to authenticated using ((select puede('mantenimiento', 3)));
drop trigger if exists auditar on public.maquina_documentos;
create trigger auditar after insert or delete or update on public.maquina_documentos for each row execute function public.auditar();

-- Los de la máquina más los de su categoría y modelo (un documento sin modelo es de toda la categoría).
create or replace function public.documentos_maquina(p_maquina uuid)
returns table (id uuid, tipo text, titulo text, ruta text, url text, compartido boolean, alcance text, creado_por_nombre text, creado_en timestamptz)
language sql stable security invoker set search_path = public as $$
  select d.id, d.tipo, d.titulo, d.ruta, d.url, d.maquina_id is null,
    case when d.maquina_id is not null then 'Solo esta máquina'
         else 'Todas: ' || d.categoria || coalesce(' · ' || d.modelo, '') end,
    p.nombre, d.creado_en
  from maquina_documentos d
  join maquinas m on m.id = p_maquina
  left join perfiles p on p.id = d.creado_por
  where d.maquina_id = p_maquina
     or (d.maquina_id is null and lower(d.categoria) = lower(m.categoria) and (d.modelo is null or lower(d.modelo) = lower(m.modelo)))
  order by d.tipo, d.titulo
$$;
revoke execute on function public.documentos_maquina(uuid) from public, anon;
grant execute on function public.documentos_maquina(uuid) to authenticated;

-- Un manual en PDF pasa fácil de 10 MB (el límite que se puso para fotos).
update storage.buckets set file_size_limit = 52428800 where id = 'servicio';

-- ---------------------------------------------------------------- 8. préstamo
alter table public.resguardos
  add column if not exists para text,
  add column if not exists foto_devolucion text;

drop function if exists public.prestar_herramienta(uuid, uuid, text, date, uuid, text);
create or replace function public.prestar_herramienta(p_maquina uuid, p_empleado uuid default null, p_persona text default null,
  p_devolver_en date default null, p_servicio uuid default null, p_notas text default null, p_para text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare m maquinas; r record; v uuid;
begin
  if not es_personal_mantenimiento() then raise exception 'Sin permiso para prestar herramienta' using errcode = '42501'; end if;
  select * into m from maquinas where id = p_maquina for update;
  if m.id is null then raise exception 'No existe esa herramienta'; end if;
  if not (m.prestable or m.tipo = 'herramienta') then raise exception '% no se presta: es equipo fijo del taller', m.nombre; end if;
  if m.estado in ('baja', 'fuera_de_servicio', 'en_mantenimiento') then raise exception '% no está en condiciones de prestarse', m.nombre; end if;
  if num_nonnulls(p_empleado, nullif(trim(p_persona), '')) <> 1 then raise exception 'Indica quién se la lleva'; end if;
  if p_servicio is null and coalesce(length(trim(p_para)), 0) < 3 then
    raise exception 'Escribe para qué se la lleva (o elige el servicio)';
  end if;
  select coalesce(e.nombre, x.persona) quien, x.entregado_en into r
  from resguardos x left join empleados e on e.id = x.empleado_id where x.maquina_id = p_maquina and x.devuelto_en is null;
  if found then
    raise exception '% la tiene % desde el %: primero que la regrese', m.nombre, r.quien,
      to_char(r.entregado_en at time zone 'America/Mexico_City', 'DD/MM');
  end if;
  insert into resguardos (maquina_id, empleado_id, persona, servicio_id, devolver_en, notas, para)
  values (p_maquina, p_empleado, nullif(trim(p_persona), ''), p_servicio, p_devolver_en, nullif(trim(p_notas), ''), nullif(trim(p_para), ''))
  returning id into v;
  return v;
end $$;
revoke execute on function public.prestar_herramienta(uuid, uuid, text, date, uuid, text, text) from public, anon;
grant execute on function public.prestar_herramienta(uuid, uuid, text, date, uuid, text, text) to authenticated;

drop function if exists public.devolver_herramienta(uuid, text, text);
create or replace function public.devolver_herramienta(p_resguardo uuid, p_estado text default 'bien', p_notas text default null,
  p_foto text default null) returns void
language plpgsql security definer set search_path = public as $$
declare r resguardos; v_quien text; v_foto text := nullif(trim(p_foto), '');
begin
  if not es_personal_mantenimiento() then raise exception 'Sin permiso para recibir herramienta' using errcode = '42501'; end if;
  select * into r from resguardos where id = p_resguardo for update;
  if r.id is null then raise exception 'No existe ese resguardo'; end if;
  if r.devuelto_en is not null then raise exception 'Esa herramienta ya se había regresado'; end if;
  if p_estado not in ('bien', 'con_dano', 'incompleta') then raise exception 'Estado de devolución no válido'; end if;
  if p_estado <> 'bien' and coalesce(length(trim(p_notas)), 0) < 3 then raise exception 'Anota qué le pasó o qué le falta'; end if;
  -- La foto tiene que estar ya subida y en la carpeta de esa herramienta (como las de las órdenes).
  if v_foto is not null then
    if left(v_foto, length('mantenimiento/' || r.maquina_id || '/')) <> 'mantenimiento/' || r.maquina_id || '/' then
      raise exception 'La foto no está en la carpeta de esta herramienta';
    end if;
    if not exists (select 1 from storage.objects o where o.bucket_id = 'servicio' and o.name = v_foto) then
      raise exception 'La foto no se subió completa; vuelve a intentarlo';
    end if;
  end if;
  update resguardos set devuelto_en = now(), recibido_por = auth.uid(), estado_devolucion = p_estado,
    notas_devolucion = nullif(trim(p_notas), ''), foto_devolucion = v_foto
  where id = p_resguardo;
  if p_estado <> 'bien' then
    select coalesce(e.nombre, r.persona) into v_quien from empleados e where e.id = r.empleado_id;
    perform reportar_falla(r.maquina_id,
      format('Regresó %s de resguardo (%s): %s', case p_estado when 'con_dano' then 'dañada' else 'incompleta' end,
             coalesce(v_quien, r.persona), trim(p_notas)), false, case when v_foto is not null then array[v_foto] end, null);
  end if;
end $$;
revoke execute on function public.devolver_herramienta(uuid, text, text, text) from public, anon;
grant execute on function public.devolver_herramienta(uuid, text, text, text) to authenticated;

-- v_resguardos de 080 con las columnas nuevas al final.
create or replace view public.v_resguardos with (security_invoker = true) as
with personal as (select * from public.personal_servicio()),
cfg as (select coalesce((select (valor->>'dias_herramienta')::int from public.configuracion where clave = 'servicio'), 7) dias)
select r.id, r.maquina_id, m.numero, m.nombre as herramienta, m.categoria, r.empleado_id,
  coalesce(p.nombre, r.persona) as quien, p.puesto, r.persona, r.servicio_id, s.folio as servicio_folio,
  r.entregado_en, pe.nombre as entregado_por_nombre, r.devolver_en, r.devuelto_en, pr.nombre as recibido_por_nombre,
  r.estado_devolucion, r.notas, r.notas_devolucion,
  r.devuelto_en is null as abierto,
  (coalesce(r.devuelto_en, now()) at time zone 'America/Mexico_City')::date - (r.entregado_en at time zone 'America/Mexico_City')::date as dias,
  r.devuelto_en is null and (r.devolver_en < public.hoy_planta()
    or public.hoy_planta() - (r.entregado_en at time zone 'America/Mexico_City')::date > cfg.dias) as vencido,
  r.para, r.foto_devolucion
from public.resguardos r
cross join cfg
join public.maquinas m on m.id = r.maquina_id
left join personal p on p.id = r.empleado_id
left join public.servicios s on s.id = r.servicio_id
left join public.perfiles pe on pe.id = r.entregado_por
left join public.perfiles pr on pr.id = r.recibido_por;

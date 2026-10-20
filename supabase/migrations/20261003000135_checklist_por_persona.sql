-- =============================================================================
-- Qué puntos del checklist diario le aplican a cada persona.
--
-- El checklist de EPP, celular y vehículo traía a todo el personal activo (oficinas
-- incluidas) y se filtraba por los objetivos de su puesto, que en la nube nadie tiene
-- todavía: la pantalla salía vacía o, con «Mostrar a todos», con los 49. El EPP es del
-- personal de taller, la revisión de vehículo de quien maneja. Ahora la ficha de cada
-- persona dice qué puntos le aplican (empleados.checklist); sin palomear no sale en esa
-- lista y la base no deja marcarla. Arranca vacío: RRHH lo palomea persona por persona.
-- Limpieza no va aquí: se marca por área.
--
-- También: la ficha del personal ya tenía foto_url pero no había cómo subirla. Las fotos
-- van en un bucket PRIVADO (personal/empleados/<id>/…), no en el catálogo público: la
-- cara de un trabajador no debe quedar en una liga abierta. Las ve quien ve la ficha
-- (rrhh, la gerencia de producción) y la propia persona; las sube RRHH.
-- =============================================================================

alter table public.empleados add column if not exists checklist text[] not null default '{}'
  check (checklist <@ array['epp', 'celular', 'vehiculo']);

create or replace function public.registrar_marca(p_tipo text, p_fecha date, p_empleado uuid, p_area int, p_momento text,
  p_cumplio boolean, p_nota text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_ant objetivo_marcas; v_mes date := date_trunc('month', p_fecha)::date; v_momento text := coalesce(p_momento, '');
begin
  if not puede('objetivos', 1) then raise exception 'Sin permiso para marcar el checklist' using errcode = '42501'; end if;
  if p_empleado is not null and exists (select 1 from empleados where id = p_empleado and usuario_id = auth.uid()) then
    raise exception 'Nadie se marca a sí mismo' using errcode = '42501';
  end if;
  -- Solo a quien su ficha dice que le aplica ese punto (el EPP es del personal de taller).
  if p_tipo <> 'limpieza' and p_empleado is not null and not exists (select 1 from empleados where id = p_empleado and p_tipo = any(checklist)) then
    raise exception 'A % no le aplica %: palomeálo en su ficha (Personal)',
      coalesce((select nombre from empleados where id = p_empleado), 'esa persona'),
      case p_tipo when 'epp' then 'el EPP' when 'celular' then 'la entrega de celular' when 'vehiculo' then 'la revisión de vehículo' else p_tipo end;
  end if;
  if p_fecha > hoy_planta() then raise exception 'No se marca un día que no ha llegado'; end if;
  if p_fecha < hoy_planta() - 7 and not puede('objetivos', 3) then
    raise exception 'Solo RRHH marca o corrige días de hace más de una semana';
  end if;
  if exists (select 1 from objetivo_evaluaciones e where e.mes = v_mes and e.estado <> 'borrador'
             and (e.empleado_id = p_empleado
                  or (p_area is not null and exists (select 1 from objetivo_resultados r join objetivo_indicadores i on i.id = r.indicador_id
                                                     where r.evaluacion_id = e.id and i.checklist = p_tipo
                                                       and r.parametros->'areas' @> to_jsonb(p_area))))) then
    raise exception 'El mes de % ya se calificó: una corrección se pide como ajuste', objetivo_nombre_mes(v_mes);
  end if;
  select * into v_ant from objetivo_marcas
  where tipo = p_tipo and fecha = p_fecha and momento = v_momento
    and (empleado_id = p_empleado or area_id = p_area)
  for update;
  if v_ant.id is not null then
    update objetivo_marcas set cumplio = p_cumplio, nota = nullif(trim(p_nota), ''), marcado_por = auth.uid(), marcado_en = now(),
      anterior = jsonb_build_object('cumplio', v_ant.cumplio, 'nota', v_ant.nota, 'marcado_por', v_ant.marcado_por,
                                    'marcado_en', v_ant.marcado_en)
    where id = v_ant.id returning id into v_id;
  else
    insert into objetivo_marcas (tipo, fecha, empleado_id, area_id, momento, cumplio, nota)
    values (p_tipo, p_fecha, p_empleado, p_area, v_momento, p_cumplio, nullif(trim(p_nota), ''))
    returning id into v_id;
  end if;
  return v_id;
end $$;

-- Quién se marca en el checklist de un día: quienes lo tienen palomeado en su ficha
-- (primero los que además lo traen en sus objetivos).
create or replace function public.checklist_del_dia(p_tipo text, p_fecha date)
returns table (empleado_id uuid, area_id int, nombre text, puesto text, en_plantilla boolean, soy_yo boolean, marcas jsonb)
language plpgsql stable security definer set search_path = public as $$
declare v_mes date := date_trunc('month', p_fecha)::date;
begin
  if not puede('objetivos', 1) then raise exception 'Sin permiso para ver el checklist' using errcode = '42501'; end if;
  if p_tipo = 'limpieza' then
    return query
    select null::uuid, a.id, a.nombre, null::text,
      exists (select 1 from objetivo_plantilla_lineas l join objetivo_plantillas p on p.id = l.plantilla_id
              join objetivo_indicadores i on i.id = l.indicador_id
              where i.checklist = 'limpieza' and l.parametros->'areas' @> to_jsonb(a.id)
                and p.desde <= v_mes and (p.hasta is null or p.hasta >= v_mes)),
      false,
      coalesce((select jsonb_agg(jsonb_build_object('momento', m.momento, 'cumplio', m.cumplio, 'nota', m.nota,
                  'por', pf.nombre, 'en', m.marcado_en))
                from objetivo_marcas m left join perfiles pf on pf.id = m.marcado_por
                where m.tipo = 'limpieza' and m.fecha = p_fecha and m.area_id = a.id), '[]'::jsonb)
    from objetivo_areas a where a.activa
    order by 5 desc, a.nombre;
  else
    return query
    select e.id, null::int, e.nombre, coalesce(pa.puesto, e.puesto),
      coalesce(pa.en_plantilla, false),
      e.usuario_id is not distinct from auth.uid() and e.usuario_id is not null,
      coalesce((select jsonb_agg(jsonb_build_object('momento', m.momento, 'cumplio', m.cumplio, 'nota', m.nota,
                  'por', pf.nombre, 'en', m.marcado_en) order by m.momento)
                from objetivo_marcas m left join perfiles pf on pf.id = m.marcado_por
                where m.tipo = p_tipo and m.fecha = p_fecha and m.empleado_id = e.id), '[]'::jsonb)
    from empleados e
    left join lateral (
      select p.nombre puesto, exists (
          select 1 from objetivo_plantilla_lineas l join objetivo_indicadores i on i.id = l.indicador_id
          where l.plantilla_id = objetivo_plantilla_de(e.id, x.puesto_id, v_mes) and i.checklist = p_tipo) en_plantilla
      from puesto_asignaciones x join puestos p on p.id = x.puesto_id
      where x.empleado_id = e.id and x.desde <= p_fecha and (x.hasta is null or x.hasta >= p_fecha)
      order by x.desde desc limit 1
    ) pa on true
    where e.activo and e.fecha_ingreso <= p_fecha and p_tipo = any(e.checklist)
    order by 5 desc, e.nombre;
  end if;
end $$;

-- Lo que los objetivos vigentes de alguien miden con el checklist pero su ficha no tiene
-- palomeado: ese objetivo se quedaría sin dato porque nadie lo podría marcar. Definer porque
-- objetivo_plantilla_de no se abre a las sesiones; solo responde a quien ve la ficha.
create or replace function public.checklist_sin_palomear(p_empleado uuid) returns text[]
language plpgsql stable security definer set search_path = public as $$
begin
  if not (puede('rrhh', 1) or puede('objetivos', 1)) then return '{}'; end if;
  return (
    select coalesce(array_agg(distinct i.checklist order by i.checklist), '{}')
    from empleados e
    join lateral (
      select x.puesto_id from puesto_asignaciones x
      where x.empleado_id = e.id and x.desde <= current_date and (x.hasta is null or x.hasta >= current_date)
      order by x.desde desc limit 1
    ) pa on true
    join objetivo_plantilla_lineas l on l.plantilla_id = objetivo_plantilla_de(e.id, pa.puesto_id, date_trunc('month', current_date)::date)
    join objetivo_indicadores i on i.id = l.indicador_id
    where e.id = p_empleado and i.checklist in ('epp', 'celular', 'vehiculo') and not (i.checklist = any(e.checklist)));
end $$;
revoke execute on function public.checklist_sin_palomear(uuid) from public, anon;
grant execute on function public.checklist_sin_palomear(uuid) to authenticated;

-- Fotos del personal --------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('personal', 'personal', false, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- Lo mismo que la política de lectura de empleados; la propia persona, por su carpeta.
drop policy if exists personal_ver on storage.objects;
create policy personal_ver on storage.objects for select to authenticated using (
  bucket_id = 'personal' and split_part(name, '/', 1) = 'empleados'
  and ((select puede('rrhh', 1)) or (select puede('produccion', 3))
       or split_part(name, '/', 2) in (select e.id::text from public.empleados e where e.usuario_id = (select auth.uid()))));
drop policy if exists personal_subir on storage.objects;
create policy personal_subir on storage.objects for insert to authenticated
  with check (bucket_id = 'personal' and split_part(name, '/', 1) = 'empleados' and (select puede('rrhh', 2)));
drop policy if exists personal_cambiar on storage.objects;
create policy personal_cambiar on storage.objects for update to authenticated
  using (bucket_id = 'personal' and split_part(name, '/', 1) = 'empleados' and (select puede('rrhh', 2)));
drop policy if exists personal_borrar on storage.objects;
create policy personal_borrar on storage.objects for delete to authenticated
  using (bucket_id = 'personal' and split_part(name, '/', 1) = 'empleados' and (select puede('rrhh', 2)));

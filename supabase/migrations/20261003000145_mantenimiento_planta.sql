-- =============================================================================
-- Mantenimiento de planta: su propio módulo, su rol y lo que pedía el programa de Luis.
--
-- 1. Módulo "mantenimiento". Máquinas, preventivos, fallas y préstamo de herramienta
--    compartían el módulo "servicio" con el servicio postventa a clientes: para que la
--    persona de mantenimiento cerrara una orden había que darle servicio 3, y con eso
--    veía y programaba los servicios de los clientes. Ahora cada cosa tiene su permiso.
--    Los roles que ya tenían servicio lo conservan; mantenimiento lo reciben la gerencia
--    de producción y dirección (3), producción y almacén (2, para reportar fallas) y
--    compras (1). Ventas ya no ve las máquinas del taller: no le toca.
-- 2. Rol "mantenimiento": administra todo lo de planta (nivel 3), ve producción e
--    inventario (para saber qué se trabaja y qué refacciones hay), y nada de ventas ni
--    costos. Lo de RRHH, compras y finanzas sigue en sus áreas.
-- 3. Lo que el programa de mantenimiento (hoja de Luis) llevaba y el ERP no:
--    criticidad en 5 niveles, tipo de mantenimiento (preventivo, predictivo, autónomo),
--    quién lo hace (técnico, externo, operador, jefe), tipo de equipo, la herramienta
--    asignada de planta a una persona (las soldadoras), rutinas con checklist que se
--    palomea al hacer el preventivo, horas trabajadas en cada orden (para el MTTR y la
--    mano de obra) y refacciones por tipo y modelo de máquina.
-- =============================================================================

insert into public.permisos_rol (rol, modulo, nivel) values
  ('direccion', 'mantenimiento', 3), ('gerente_produccion', 'mantenimiento', 3), ('mantenimiento', 'mantenimiento', 3),
  ('produccion', 'mantenimiento', 2), ('almacen', 'mantenimiento', 2), ('compras', 'mantenimiento', 1),
  ('mantenimiento', 'produccion', 1), ('mantenimiento', 'inventario', 1)
on conflict do nothing;

-- Atiende, presta y registra: mantenimiento 3, o mantenimiento 2 con producción 2 (los
-- encargados de piso), igual que era con servicio.
create or replace function public.es_personal_mantenimiento() returns boolean
language sql stable security definer set search_path = public as $$
  select puede('mantenimiento', 3) or (puede('mantenimiento', 2) and puede('produccion', 2))
$$;

-- -----------------------------------------------------------------------------
-- Campos que pedía el programa de mantenimiento
-- -----------------------------------------------------------------------------
alter table public.maquinas
  add column if not exists criticidad text check (criticidad in ('muy_alta', 'alta', 'media', 'baja', 'muy_baja')),
  add column if not exists tipo_mantenimiento text check (tipo_mantenimiento in ('preventivo', 'predictivo', 'autonomo')),
  add column if not exists especialidad text check (especialidad in ('tecnico', 'externo', 'operador', 'jefe')),
  add column if not exists tipo_equipo text check (tipo_equipo in ('electrico', 'neumatico', 'hidraulico', 'mecanico')),
  add column if not exists asignada_a uuid references public.empleados(id);

-- "Crítica" (si se para, se para el área) sale de la criticidad cuando la hay.
create or replace function public.maquina_critica() returns trigger language plpgsql as $$
begin
  if new.criticidad is not null then new.critica := new.criticidad in ('muy_alta', 'alta'); end if;
  return new;
end $$;
drop trigger if exists critica on public.maquinas;
create trigger critica before insert or update of criticidad on public.maquinas for each row execute function public.maquina_critica();

alter table public.ordenes_mantenimiento add column if not exists horas_trabajadas numeric(6,2) check (horas_trabajadas >= 0);

-- Rutinas: la lista de puntos que se revisan, por tipo de máquina y frecuencia
-- ("Inversoras AXT · mensual"). Un plan preventivo apunta a su rutina y cada orden que
-- sale del plan copia los puntos para palomearlos.
create table if not exists public.rutinas_mantenimiento (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  categoria text,
  frecuencia text check (frecuencia in ('diaria', 'semanal', 'mensual', 'trimestral', 'semestral', 'anual')),
  recomendaciones text,
  puntos jsonb not null default '[]'::jsonb check (jsonb_typeof(puntos) = 'array'),   -- [{seccion, texto}]
  activa boolean not null default true,
  creado_en timestamptz not null default now()
);
alter table public.rutinas_mantenimiento enable row level security;
drop policy if exists ver on public.rutinas_mantenimiento;
create policy ver on public.rutinas_mantenimiento for select to authenticated using ((select puede('mantenimiento', 1)));
drop policy if exists editar on public.rutinas_mantenimiento;
create policy editar on public.rutinas_mantenimiento for all to authenticated
  using ((select puede('mantenimiento', 3))) with check ((select puede('mantenimiento', 3)));

alter table public.planes_preventivos add column if not exists rutina_id uuid references public.rutinas_mantenimiento(id) on delete set null;

create table if not exists public.orden_checklist (
  id uuid primary key default gen_random_uuid(),
  orden_id uuid not null references public.ordenes_mantenimiento(id) on delete cascade,
  orden int not null,
  seccion text,
  texto text not null,
  bien boolean,                       -- null = sin revisar · true = bien · false = con falla
  nota text,
  marcado_por uuid references public.perfiles(id),
  marcado_en timestamptz
);
create index if not exists orden_checklist_orden on public.orden_checklist (orden_id, orden);
alter table public.orden_checklist enable row level security;
drop policy if exists ver on public.orden_checklist;
create policy ver on public.orden_checklist for select to authenticated using (orden_id in (select id from public.ordenes_mantenimiento));

-- Al crearse una orden de un plan con rutina, sus puntos quedan en la orden.
create or replace function public.copiar_checklist() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.plan_id is not null then
    insert into orden_checklist (orden_id, orden, seccion, texto)
    select new.id, x.n, x.p->>'seccion', x.p->>'texto'
    from planes_preventivos pl join rutinas_mantenimiento r on r.id = pl.rutina_id,
         jsonb_array_elements(r.puntos) with ordinality x(p, n)
    where pl.id = new.plan_id;
  end if;
  return new;
end $$;
drop trigger if exists copiar_checklist on public.ordenes_mantenimiento;
create trigger copiar_checklist after insert on public.ordenes_mantenimiento for each row execute function public.copiar_checklist();

-- Palomear un punto: bien, o con falla y qué tiene.
create or replace function public.marcar_punto(p_punto uuid, p_bien boolean, p_nota text default null) returns void
language plpgsql security definer set search_path = public as $$
declare c orden_checklist; v_estado text;
begin
  if not es_personal_mantenimiento() then raise exception 'Sin permiso' using errcode = '42501'; end if;
  select * into c from orden_checklist where id = p_punto for update;
  if c.id is null then raise exception 'No existe ese punto'; end if;
  select estado into v_estado from ordenes_mantenimiento where id = c.orden_id;
  if v_estado not in ('pendiente', 'en_proceso') then raise exception 'La orden ya está %', v_estado; end if;
  if p_bien is false and coalesce(length(trim(p_nota)), 0) < 3 then raise exception 'Anota qué tiene'; end if;
  update orden_checklist set bien = p_bien, nota = nullif(trim(p_nota), ''),
    marcado_por = case when p_bien is null then null else auth.uid() end, marcado_en = case when p_bien is null then null else now() end
  where id = p_punto;
end $$;
revoke execute on function public.marcar_punto(uuid, boolean, text) from public, anon;
grant execute on function public.marcar_punto(uuid, boolean, text) to authenticated;

-- Refacciones de cada tipo de máquina (y modelo, si aplica): en la ficha de la máquina
-- se ve qué piezas lleva y cuántas hay en almacén.
create table if not exists public.refacciones_maquina (
  id uuid primary key default gen_random_uuid(),
  articulo_id uuid not null references public.articulos(id) on delete cascade,
  categoria text not null,
  modelo text,
  unique (articulo_id, categoria, modelo)
);
alter table public.refacciones_maquina enable row level security;
drop policy if exists ver on public.refacciones_maquina;
create policy ver on public.refacciones_maquina for select to authenticated using ((select puede('mantenimiento', 1)));
drop policy if exists editar on public.refacciones_maquina;
create policy editar on public.refacciones_maquina for all to authenticated
  using ((select puede('mantenimiento', 3))) with check ((select puede('mantenimiento', 3)));

-- -----------------------------------------------------------------------------
-- Permisos: lo de planta con "mantenimiento"; lo de clientes sigue con "servicio"
-- -----------------------------------------------------------------------------
drop policy if exists ver on public.maquinas;
create policy ver on public.maquinas for select to authenticated using ((select puede('mantenimiento', 1)));
drop policy if exists editar on public.maquinas;
create policy editar on public.maquinas for all to authenticated
  using ((select puede('mantenimiento', 3))) with check ((select puede('mantenimiento', 3)));
drop policy if exists ver on public.planes_preventivos;
create policy ver on public.planes_preventivos for select to authenticated using ((select puede('mantenimiento', 1)));
drop policy if exists editar on public.planes_preventivos;
create policy editar on public.planes_preventivos for all to authenticated
  using ((select puede('mantenimiento', 3))) with check ((select puede('mantenimiento', 3)));
drop policy if exists ver on public.ordenes_mantenimiento;
create policy ver on public.ordenes_mantenimiento for select to authenticated using ((select puede('mantenimiento', 1)));
-- La herramienta que sale a un servicio con cliente también la ve la gerencia de servicio.
drop policy if exists ver on public.resguardos;
create policy ver on public.resguardos for select to authenticated using ((select puede('mantenimiento', 1)) or (select puede('servicio', 3)));

drop policy if exists ver on public.costos_servicio;
create policy ver on public.costos_servicio for select to authenticated using (
  (servicio_id in (select id from public.servicios)
     and (((select puede('costos', 1)) and (select puede('servicio', 1))) or (concepto <> 'material' and (select puede('servicio', 3)))))
  or (mantenimiento_id in (select id from public.ordenes_mantenimiento)
     and (((select puede('costos', 1)) and (select puede('mantenimiento', 1))) or (concepto <> 'material' and (select puede('mantenimiento', 3))))));
drop policy if exists alta on public.costos_servicio;
create policy alta on public.costos_servicio for insert to authenticated with check (
  concepto <> 'material' and material_id is null and registrado_por = (select auth.uid())
  and ((servicio_id in (select id from public.servicios) and (select puede('servicio', 3)))
    or (mantenimiento_id in (select id from public.ordenes_mantenimiento) and (select puede('mantenimiento', 3)))));
drop policy if exists baja on public.costos_servicio;
create policy baja on public.costos_servicio for delete to authenticated using (
  concepto <> 'material' and ((servicio_id is not null and (select puede('servicio', 3)))
    or (mantenimiento_id is not null and (select puede('mantenimiento', 3)))));

drop policy if exists servicio_ver on storage.objects;
create policy servicio_ver on storage.objects for select to authenticated using (
  bucket_id = 'servicio' and (
    ((storage.foldername(name))[1] = 'servicios' and (storage.foldername(name))[2] in (select id::text from public.servicios))
    or ((storage.foldername(name))[1] in ('mantenimiento', 'maquinas') and (select public.puede('mantenimiento', 1)))));
drop policy if exists servicio_subir on storage.objects;
create policy servicio_subir on storage.objects for insert to authenticated with check (
  bucket_id = 'servicio' and (
    ((storage.foldername(name))[1] = 'servicios' and (select public.puede('servicio', 2))
        and (storage.foldername(name))[2] in (select id::text from public.servicios))
    or ((storage.foldername(name))[1] = 'mantenimiento' and (select public.puede('mantenimiento', 2))
        and (storage.foldername(name))[2] in (select id::text from public.maquinas))
    or ((storage.foldername(name))[1] = 'maquinas' and (select public.puede('mantenimiento', 3))
        and (storage.foldername(name))[2] in (select id::text from public.maquinas))));

-- Cerrar: además del trabajo, las horas trabajadas; y si la orden trae checklist, todos
-- sus puntos revisados (un preventivo a medias no se da por hecho).
drop function if exists public.cerrar_mantenimiento(uuid, text, numeric);
create or replace function public.cerrar_mantenimiento(p_orden uuid, p_trabajo text, p_horas_uso numeric default null,
  p_horas_trabajadas numeric default null) returns void
language plpgsql security definer set search_path = public as $$
declare o ordenes_mantenimiento; v_horas numeric; v_faltan int;
begin
  if not puede('mantenimiento', 3) then raise exception 'Solo mantenimiento o la gerencia de producción cierran órdenes de mantenimiento' using errcode = '42501'; end if;
  select * into o from ordenes_mantenimiento where id = p_orden for update;
  if o.id is null then raise exception 'No existe la orden'; end if;
  if o.estado not in ('pendiente', 'en_proceso') then raise exception 'La orden % ya está %', o.folio, o.estado; end if;
  if coalesce(length(trim(p_trabajo)), 0) < 5 then raise exception 'Escribe qué se hizo (qué se cambió o reparó)'; end if;
  if p_horas_trabajadas is not null and (p_horas_trabajadas < 0 or p_horas_trabajadas > 500) then raise exception 'Horas trabajadas fuera de rango'; end if;
  select count(*) into v_faltan from orden_checklist where orden_id = p_orden and bien is null;
  if v_faltan > 0 then raise exception 'Faltan % puntos del checklist por revisar', v_faltan; end if;
  if p_horas_uso is not null then
    if p_horas_uso < (select horas_uso from maquinas where id = o.maquina_id) then
      raise exception 'El horómetro no puede ir para atrás';
    end if;
    update maquinas set horas_uso = p_horas_uso, horas_actualizado_en = now() where id = o.maquina_id;
  end if;
  select horas_uso into v_horas from maquinas where id = o.maquina_id;
  update ordenes_mantenimiento set estado = 'cerrada', cerrada_en = now(), cerrada_por = auth.uid(), trabajo_realizado = trim(p_trabajo),
    inicio_en = coalesce(inicio_en, now()), fuera_hasta = case when fuera_desde is not null then now() end, horas_uso_al_cerrar = v_horas,
    horas_trabajadas = coalesce(p_horas_trabajadas, horas_trabajadas)
  where id = p_orden;
  if o.tipo = 'preventivo' and o.plan_id is not null then
    update planes_preventivos set ultima_fecha = hoy_planta(), ultima_horas = v_horas where id = o.plan_id;
  end if;
  perform recalcular_estado_maquina(o.maquina_id);
end $$;
revoke execute on function public.cerrar_mantenimiento(uuid, text, numeric, numeric) from public, anon;
grant execute on function public.cerrar_mantenimiento(uuid, text, numeric, numeric) to authenticated;

-- Las mismas funciones de 080, con el permiso de mantenimiento en lugar de servicio
-- (las que sirven a los dos piden el permiso según para qué es).
create or replace function public.reportar_falla(p_maquina uuid, p_falla text, p_detiene boolean default false,
  p_fotos text[] default null, p_nombre text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare m maquinas; v uuid; f text;
begin
  if not puede('mantenimiento', 2) then raise exception 'Sin permiso para reportar fallas' using errcode = '42501'; end if;
  select * into m from maquinas where id = p_maquina;
  if m.id is null then raise exception 'No existe esa máquina'; end if;
  if m.estado = 'baja' then raise exception '% está dada de baja', m.nombre; end if;
  if coalesce(length(trim(p_falla)), 0) < 5 then raise exception 'Describe la falla: qué hace o qué dejó de hacer'; end if;
  insert into ordenes_mantenimiento (maquina_id, tipo, falla, detiene, reportado_por_nombre, fuera_desde)
  values (p_maquina, 'correctivo', trim(p_falla), coalesce(p_detiene, false), nullif(trim(p_nombre), ''),
          case when p_detiene then now() end)
  returning id into v;
  foreach f in array coalesce(p_fotos, '{}') loop
    perform agregar_evidencia(f, 'falla', null, v, null, p_nombre);
  end loop;
  perform recalcular_estado_maquina(p_maquina);
  return v;
end $$;

create or replace function public.atender_mantenimiento(p_orden uuid, p_diagnostico text, p_atiende text default null,
  p_detiene boolean default null) returns void
language plpgsql security definer set search_path = public as $$
declare o ordenes_mantenimiento;
begin
  if not es_personal_mantenimiento() then raise exception 'Sin permiso para atender mantenimiento' using errcode = '42501'; end if;
  select * into o from ordenes_mantenimiento where id = p_orden for update;
  if o.id is null then raise exception 'No existe la orden'; end if;
  if o.estado not in ('pendiente', 'en_proceso') then raise exception 'La orden % ya está %', o.folio, o.estado; end if;
  if coalesce(length(trim(p_diagnostico)), 0) < 3 then raise exception 'Escribe el diagnóstico (qué tiene)'; end if;
  update ordenes_mantenimiento set estado = 'en_proceso', inicio_en = coalesce(inicio_en, now()), diagnostico = trim(p_diagnostico),
    atendido_por = coalesce(nullif(trim(p_atiende), ''), atendido_por),
    detiene = coalesce(p_detiene, detiene or tipo = 'preventivo'),
    fuera_desde = case when coalesce(p_detiene, detiene or tipo = 'preventivo') then coalesce(fuera_desde, now()) else fuera_desde end
  where id = p_orden;
  perform recalcular_estado_maquina(o.maquina_id);
end $$;

create or replace function public.cancelar_mantenimiento(p_orden uuid, p_motivo text) returns void
language plpgsql security definer set search_path = public as $$
declare o ordenes_mantenimiento;
begin
  if not puede('mantenimiento', 3) then raise exception 'Solo mantenimiento o la gerencia cancelan órdenes de mantenimiento' using errcode = '42501'; end if;
  select * into o from ordenes_mantenimiento where id = p_orden for update;
  if o.id is null then raise exception 'No existe la orden'; end if;
  if o.estado not in ('pendiente', 'en_proceso') then raise exception 'La orden % ya está %', o.folio, o.estado; end if;
  if coalesce(length(trim(p_motivo)), 0) < 3 then raise exception 'Escribe por qué se cancela (¿era el mismo reporte?)'; end if;
  update ordenes_mantenimiento set estado = 'cancelada', motivo_cancelacion = trim(p_motivo),
    fuera_hasta = case when fuera_desde is not null then now() end where id = p_orden;
  update servicio_materiales set estado = 'cancelado' where mantenimiento_id = p_orden and estado = 'pendiente';
  perform recalcular_estado_maquina(o.maquina_id);
end $$;

create or replace function public.generar_preventivos(p_maquina uuid default null) returns int
language plpgsql security definer set search_path = public as $$
declare v_n int;
begin
  -- Sin usuario = pg_cron o el sistema. Con usuario, cualquiera que vea mantenimiento (solo crea lo vencido).
  if auth.uid() is not null and not puede('mantenimiento', 1) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  insert into ordenes_mantenimiento (maquina_id, tipo, falla, plan_id, vence, vence_horas, reportado_por, reportado_por_nombre)
  select p.maquina_id, 'preventivo', p.nombre || coalesce(': ' || nullif(trim(p.tareas), ''), ''), p.id,
    p.ultima_fecha + p.cada_dias, p.ultima_horas + p.cada_horas, null, 'Plan preventivo'
  from planes_preventivos p join maquinas m on m.id = p.maquina_id
  where p.activo and m.estado <> 'baja' and (p_maquina is null or p.maquina_id = p_maquina)
    and ((p.cada_dias is not null and p.ultima_fecha + p.cada_dias - p.anticipacion_dias <= hoy_planta())
      or (p.cada_horas is not null and m.horas_uso >= p.ultima_horas + p.cada_horas))
    and not exists (select 1 from ordenes_mantenimiento o where o.plan_id = p.id and o.estado in ('pendiente', 'en_proceso'))
  on conflict do nothing;
  get diagnostics v_n = row_count;
  return v_n;
end $$;

create or replace function public.registrar_horas_maquina(p_maquina uuid, p_horas numeric) returns int
language plpgsql security definer set search_path = public as $$
declare v_actual numeric;
begin
  if not es_personal_mantenimiento() then raise exception 'Sin permiso para registrar horas de uso' using errcode = '42501'; end if;
  select horas_uso into v_actual from maquinas where id = p_maquina for update;
  if v_actual is null then raise exception 'No existe esa máquina'; end if;
  if p_horas is null or p_horas < v_actual then
    raise exception 'El horómetro no puede ir para atrás: la última lectura es % h', v_actual::float8;
  end if;
  update maquinas set horas_uso = p_horas, horas_actualizado_en = now() where id = p_maquina;
  return generar_preventivos(p_maquina);
end $$;

create or replace function public.prestar_herramienta(p_maquina uuid, p_empleado uuid default null, p_persona text default null,
  p_devolver_en date default null, p_servicio uuid default null, p_notas text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare m maquinas; r record; v uuid;
begin
  if not es_personal_mantenimiento() then raise exception 'Sin permiso para prestar herramienta' using errcode = '42501'; end if;
  select * into m from maquinas where id = p_maquina for update;
  if m.id is null then raise exception 'No existe esa herramienta'; end if;
  if not (m.prestable or m.tipo = 'herramienta') then raise exception '% no se presta: es equipo fijo del taller', m.nombre; end if;
  if m.estado in ('baja', 'fuera_de_servicio', 'en_mantenimiento') then raise exception '% no está en condiciones de prestarse', m.nombre; end if;
  if num_nonnulls(p_empleado, nullif(trim(p_persona), '')) <> 1 then raise exception 'Indica quién se la lleva'; end if;
  select coalesce(e.nombre, x.persona) quien, x.entregado_en into r
  from resguardos x left join empleados e on e.id = x.empleado_id where x.maquina_id = p_maquina and x.devuelto_en is null;
  if found then
    raise exception '% la tiene % desde el %: primero que la regrese', m.nombre, r.quien,
      to_char(r.entregado_en at time zone 'America/Mexico_City', 'DD/MM');
  end if;
  insert into resguardos (maquina_id, empleado_id, persona, servicio_id, devolver_en, notas)
  values (p_maquina, p_empleado, nullif(trim(p_persona), ''), p_servicio, p_devolver_en, nullif(trim(p_notas), ''))
  returning id into v;
  return v;
end $$;

create or replace function public.devolver_herramienta(p_resguardo uuid, p_estado text default 'bien', p_notas text default null) returns void
language plpgsql security definer set search_path = public as $$
declare r resguardos; v_quien text;
begin
  if not es_personal_mantenimiento() then raise exception 'Sin permiso para recibir herramienta' using errcode = '42501'; end if;
  select * into r from resguardos where id = p_resguardo for update;
  if r.id is null then raise exception 'No existe ese resguardo'; end if;
  if r.devuelto_en is not null then raise exception 'Esa herramienta ya se había regresado'; end if;
  if p_estado not in ('bien', 'con_dano', 'incompleta') then raise exception 'Estado de devolución no válido'; end if;
  if p_estado <> 'bien' and coalesce(length(trim(p_notas)), 0) < 3 then raise exception 'Anota qué le pasó o qué le falta'; end if;
  update resguardos set devuelto_en = now(), recibido_por = auth.uid(), estado_devolucion = p_estado, notas_devolucion = nullif(trim(p_notas), '')
  where id = p_resguardo;
  if p_estado <> 'bien' then
    select coalesce(e.nombre, r.persona) into v_quien from empleados e where e.id = r.empleado_id;
    perform reportar_falla(r.maquina_id,
      format('Regresó %s de resguardo (%s): %s', case p_estado when 'con_dano' then 'dañada' else 'incompleta' end,
             coalesce(v_quien, r.persona), trim(p_notas)), false, null, null);
  end if;
end $$;

create or replace function public.agregar_evidencia(p_ruta text, p_momento text, p_servicio uuid default null,
  p_mantenimiento uuid default null, p_nota text default null, p_nombre text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare v uuid; v_prefijo text; v_maquina uuid;
begin
  if not (case when p_servicio is not null then puede('servicio', 2) else puede('mantenimiento', 2) end) then
    raise exception 'Sin permiso para subir evidencia' using errcode = '42501';
  end if;
  if num_nonnulls(p_servicio, p_mantenimiento) <> 1 then raise exception 'La foto va en un servicio o en una orden de mantenimiento'; end if;
  if p_servicio is not null then
    if not servicio_visible(p_servicio) then raise exception 'No existe el servicio'; end if;
    if p_momento = 'falla' then raise exception 'Momento no válido para un servicio'; end if;
    v_prefijo := 'servicios/' || p_servicio || '/';
  else
    select maquina_id into v_maquina from ordenes_mantenimiento where id = p_mantenimiento;
    if v_maquina is null then raise exception 'No existe la orden de mantenimiento'; end if;
    v_prefijo := 'mantenimiento/' || v_maquina || '/';
  end if;
  if p_ruta is null or left(p_ruta, length(v_prefijo)) <> v_prefijo then raise exception 'La foto no está en la carpeta de este registro'; end if;
  if not exists (select 1 from storage.objects o where o.bucket_id = 'servicio' and o.name = p_ruta) then
    raise exception 'La foto no se subió completa; vuelve a intentarlo';
  end if;
  insert into servicio_evidencias (servicio_id, mantenimiento_id, momento, ruta, nota, subido_por_nombre)
  values (p_servicio, p_mantenimiento, p_momento, p_ruta, nullif(trim(p_nota), ''), nullif(trim(p_nombre), ''))
  returning id into v;
  return v;
end $$;

create or replace function public.agregar_material_servicio(p_articulo uuid, p_cantidad numeric,
  p_servicio uuid default null, p_mantenimiento uuid default null, p_notas text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare v uuid; v_estado text;
begin
  if not (case when p_servicio is not null then es_personal_servicio() else es_personal_mantenimiento() end) then
    raise exception 'Sin permiso para pedir material' using errcode = '42501';
  end if;
  if num_nonnulls(p_servicio, p_mantenimiento) <> 1 then raise exception 'El material va a un servicio o a una orden de mantenimiento'; end if;
  if coalesce(p_cantidad, 0) <= 0 then raise exception 'La cantidad debe ser mayor a cero'; end if;
  if p_servicio is not null then
    select estado into v_estado from servicios where id = p_servicio;
    if v_estado is null then raise exception 'No existe el servicio'; end if;
    if v_estado in ('cerrada', 'cancelada') then raise exception 'El servicio ya está %', v_estado; end if;
  else
    select estado into v_estado from ordenes_mantenimiento where id = p_mantenimiento;
    if v_estado is null then raise exception 'No existe la orden de mantenimiento'; end if;
    if v_estado in ('cerrada', 'cancelada') then raise exception 'La orden ya está %', v_estado; end if;
  end if;
  insert into servicio_materiales (servicio_id, mantenimiento_id, articulo_id, cantidad, notas)
  values (p_servicio, p_mantenimiento, p_articulo, p_cantidad, nullif(trim(p_notas), '')) returning id into v;
  return v;
end $$;

create or replace function public.pedir_material_a_compras(p_servicio uuid default null, p_mantenimiento uuid default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_req uuid; v_folio text; v_para text; v_fecha date; l record; v_linea uuid;
begin
  if not (case when p_servicio is not null then es_personal_servicio() else es_personal_mantenimiento() end) then
    raise exception 'Sin permiso para pedir a compras' using errcode = '42501';
  end if;
  if num_nonnulls(p_servicio, p_mantenimiento) <> 1 then raise exception 'Indica el servicio o la orden de mantenimiento'; end if;
  if p_servicio is not null then
    select s.folio, nombre_tipo_servicio(s.tipo) || ' · ' || c.nombre, coalesce((s.inicio at time zone 'America/Mexico_City')::date, s.fecha_deseada)
      into v_folio, v_para, v_fecha from servicios s join clientes c on c.id = s.cliente_id where s.id = p_servicio;
  else
    select o.folio, m.numero || ' ' || m.nombre, hoy_planta() into v_folio, v_para, v_fecha
    from ordenes_mantenimiento o join maquinas m on m.id = o.maquina_id where o.id = p_mantenimiento;
  end if;
  if v_folio is null then raise exception 'No existe el registro'; end if;
  if not exists (select 1 from servicio_materiales where (servicio_id = p_servicio or mantenimiento_id = p_mantenimiento) and estado = 'pendiente') then
    return null;
  end if;
  insert into requisiciones (origen, necesaria_para, notas)
  values ('manual', v_fecha, format('Para %s · %s', v_folio, v_para)) returning id into v_req;
  for l in select * from servicio_materiales where (servicio_id = p_servicio or mantenimiento_id = p_mantenimiento) and estado = 'pendiente' for update loop
    insert into requisicion_lineas (requisicion_id, articulo_id, cantidad, notas)
    values (v_req, l.articulo_id, l.cantidad, v_folio) returning id into v_linea;
    update servicio_materiales set estado = 'en_compra', requisicion_linea_id = v_linea where id = l.id;
  end loop;
  return v_req;
end $$;

create or replace function public.cancelar_material_servicio(p_linea uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not (select case when l.servicio_id is not null then es_personal_servicio() else es_personal_mantenimiento() end
          from servicio_materiales l where l.id = p_linea) then
    raise exception 'Sin permiso' using errcode = '42501';
  end if;
  update servicio_materiales set estado = 'cancelado' where id = p_linea and estado = 'pendiente';
  if not found then raise exception 'Solo se quita una partida que no se ha surtido ni pedido a compras'; end if;
end $$;

-- Vistas de 080 con las columnas nuevas al final.
create or replace view public.v_planes_preventivos with (security_invoker = true) as
select p.id, p.maquina_id, m.numero, m.nombre as maquina, m.horas_uso as horas_actuales, p.nombre, p.tareas,
  p.cada_dias, p.cada_horas, p.ultima_fecha, p.ultima_horas, p.anticipacion_dias, p.activo,
  p.ultima_fecha + p.cada_dias as proxima_fecha,
  p.ultima_horas + p.cada_horas as proximas_horas,
  p.ultima_fecha + p.cada_dias - public.hoy_planta() as dias_restantes,
  p.ultima_horas + p.cada_horas - m.horas_uso as horas_restantes,
  case when (p.cada_dias is not null and p.ultima_fecha + p.cada_dias < public.hoy_planta())
         or (p.cada_horas is not null and m.horas_uso >= p.ultima_horas + p.cada_horas) then 'vencido'
       when (p.cada_dias is not null and p.ultima_fecha + p.cada_dias - p.anticipacion_dias <= public.hoy_planta())
         or (p.cada_horas is not null and m.horas_uso >= p.ultima_horas + p.cada_horas * 0.9) then 'por_vencer'
       else 'al_dia' end as situacion,
  o.id as orden_id, o.folio as orden_folio, o.estado as orden_estado,
  p.rutina_id, ru.nombre as rutina, jsonb_array_length(ru.puntos) as rutina_puntos
from public.planes_preventivos p
join public.maquinas m on m.id = p.maquina_id
left join public.ordenes_mantenimiento o on o.plan_id = p.id and o.estado in ('pendiente', 'en_proceso')
left join public.rutinas_mantenimiento ru on ru.id = p.rutina_id;

create or replace view public.v_maquinas with (security_invoker = true) as
with personal as (select * from public.personal_servicio())
select m.id, m.numero, m.nombre, m.tipo, m.categoria, m.marca, m.modelo, m.numero_serie, m.etapa_id, et.nombre as etapa,
  et.color as etapa_color, m.ubicacion, m.estado, m.critica, m.prestable, m.usa_horometro, m.horas_uso, m.horas_actualizado_en,
  m.foto_ruta, m.fecha_alta, m.notas,
  ab.id as orden_id, ab.folio as orden_folio, ab.tipo as orden_tipo, ab.estado as orden_estado, ab.falla as orden_falla,
  ab.reportado_en as orden_desde, ab.fuera_desde as parada_desde,
  (select count(*) from public.ordenes_mantenimiento o where o.maquina_id = m.id and o.estado in ('pendiente', 'en_proceso'))::int as ordenes_abiertas,
  (select count(*) from public.ordenes_mantenimiento o where o.maquina_id = m.id and o.tipo = 'correctivo' and o.estado <> 'cancelada'
     and o.reportado_en > now() - interval '12 months')::int as fallas_12m,
  coalesce((select round((sum(extract(epoch from coalesce(o.fuera_hasta, now()) - greatest(o.fuera_desde, now() - interval '12 months'))) / 3600.0)::numeric, 1)
            from public.ordenes_mantenimiento o where o.maquina_id = m.id and o.estado <> 'cancelada' and o.fuera_desde is not null
              and coalesce(o.fuera_hasta, now()) > now() - interval '12 months'), 0) as horas_paro_12m,
  (select max(o.reportado_en) from public.ordenes_mantenimiento o where o.maquina_id = m.id and o.tipo = 'correctivo' and o.estado <> 'cancelada') as ultima_falla,
  pv.proxima_fecha as preventivo_fecha, pv.proximas_horas as preventivo_horas, pv.nombre as preventivo, pv.situacion as preventivo_situacion,
  rg.id as resguardo_id, coalesce(pp.nombre, rg.persona) as prestada_a, rg.entregado_en as prestada_desde,
  m.criticidad, m.tipo_mantenimiento, m.especialidad, m.tipo_equipo, m.asignada_a, pa.nombre as asignada_nombre
from public.maquinas m
left join public.etapas et on et.id = m.etapa_id
left join lateral (select o.* from public.ordenes_mantenimiento o where o.maquina_id = m.id and o.estado in ('pendiente', 'en_proceso')
                   order by (o.fuera_desde is not null and o.fuera_hasta is null) desc, o.reportado_en limit 1) ab on true
left join lateral (select v.* from public.v_planes_preventivos v where v.maquina_id = m.id and v.activo
                   order by case v.situacion when 'vencido' then 0 when 'por_vencer' then 1 else 2 end, v.proxima_fecha nulls last limit 1) pv on true
left join public.resguardos rg on rg.maquina_id = m.id and rg.devuelto_en is null
left join personal pp on pp.id = rg.empleado_id
left join personal pa on pa.id = m.asignada_a;

create or replace view public.v_ordenes_mantenimiento with (security_invoker = true) as
select o.id, o.folio, o.maquina_id, m.numero, m.nombre as maquina, m.categoria, m.tipo as maquina_tipo, m.etapa_id,
  et.nombre as etapa, o.tipo, o.estado, o.falla, o.detiene,
  coalesce(o.reportado_por_nombre, pr.nombre) as reportado_por_nombre, o.reportado_en,
  o.plan_id, pl.nombre as plan, o.vence, o.vence_horas, o.diagnostico, o.atendido_por, o.trabajo_realizado,
  o.inicio_en, o.cerrada_en, pc.nombre as cerrada_por_nombre, o.fuera_desde, o.fuera_hasta,
  case when o.fuera_desde is not null then round((extract(epoch from coalesce(o.fuera_hasta, now()) - o.fuera_desde) / 3600.0)::numeric, 1) end as horas_paro,
  o.horas_uso_al_cerrar, o.motivo_cancelacion,
  o.estado in ('pendiente', 'en_proceso') as abierta,
  o.tipo = 'preventivo' and o.estado in ('pendiente', 'en_proceso') and o.vence < public.hoy_planta() as vencida,
  (select count(*) from public.servicio_materiales x where x.mantenimiento_id = o.id and x.estado <> 'cancelado')::int as refacciones,
  (select count(*) from public.servicio_materiales x where x.mantenimiento_id = o.id and x.estado in ('pendiente', 'en_compra'))::int as refacciones_pendientes,
  (select count(*) from public.servicio_evidencias x where x.mantenimiento_id = o.id)::int as fotos,
  o.creado_en,
  o.horas_trabajadas,
  (select count(*) from public.orden_checklist c where c.orden_id = o.id)::int as puntos,
  (select count(*) from public.orden_checklist c where c.orden_id = o.id and c.bien is not null)::int as puntos_revisados,
  (select count(*) from public.orden_checklist c where c.orden_id = o.id and c.bien is false)::int as puntos_con_falla
from public.ordenes_mantenimiento o
join public.maquinas m on m.id = o.maquina_id
left join public.etapas et on et.id = m.etapa_id
left join public.planes_preventivos pl on pl.id = o.plan_id
left join public.perfiles pr on pr.id = o.reportado_por
left join public.perfiles pc on pc.id = o.cerrada_por;

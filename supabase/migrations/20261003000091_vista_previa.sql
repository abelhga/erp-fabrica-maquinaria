-- =============================================================================
-- "Ver como": dirección y sistemas abren el ERP con la sesión de otra persona
-- para ver exactamente lo que ve (su menú, sus clientes, sus avisos), sin poder
-- guardar nada a su nombre.
--
-- Por qué una sesión de verdad y no "fingir el rol" en la pantalla: la RLS decide
-- con auth.uid() en más de 250 lugares (los clientes de cada vendedor, los avisos de
-- cada quien, "mi desempeño"…). Simular el rol en React enseñaría lo que el rol
-- podría ver en general, no lo que esa persona ve. La función de borde ver-como
-- crea la sesión (solo si quien la pide es dirección o sistemas) y la anota aquí.
--
-- Por qué solo lectura en la base y no en la pantalla: la sesión es de la otra
-- persona; si se pudiera guardar, quedaría hecho a su nombre. antes_de_cada_peticion()
-- corre antes de cada consulta de la API y, si la sesión es una vista previa, vuelve
-- la transacción de solo lectura: falla cualquier escritura, venga de una tabla, de
-- una función security definer o de la función de borde del asistente.
-- =============================================================================

create table public.vistas_previas (
  session_id uuid primary key,
  usuario_id uuid not null references public.perfiles(id) on delete cascade,
  abierta_por uuid not null references public.perfiles(id) on delete cascade,
  desde timestamptz not null default now()
);
comment on table public.vistas_previas is
  'Sesiones abiertas con "Ver como". Solo las escribe la función de borde ver-como; es también el registro de quién vio como quién.';
create index on public.vistas_previas (abierta_por, desde desc);

alter table public.vistas_previas enable row level security;
-- Dirección y sistemas ven el registro completo; la persona vista también ve
-- cuándo y quién abrió el ERP como ella. Sin políticas de escritura.
create policy ver on public.vistas_previas for select using (
  (select tiene_rol('direccion')) or (select tiene_rol('admin')) or usuario_id = (select auth.uid())
);

-- ¿Esta petición viene de una vista previa? Por el session_id del JWT (lo pone
-- Supabase Auth en cada token; el usuario no lo puede cambiar).
create or replace function public.en_vista_previa() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from vistas_previas v
    where v.session_id = nullif(auth.jwt() ->> 'session_id', '')::uuid
  )
$$;

-- Lo corre PostgREST antes de cada petición (pgrst.db_pre_request, abajo).
create or replace function public.antes_de_cada_peticion() returns void
language plpgsql security definer set search_path = public as $$
begin
  if en_vista_previa() then
    perform set_config('transaction_read_only', 'on', true);
  end if;
end $$;

-- A quién se le puede abrir una vista previa: lo revisa la función de borde con la
-- sesión de quien la pide, antes de crear nada. Regresa el correo de la persona.
create or replace function public.vista_previa_destino(p_usuario uuid) returns text
language plpgsql stable security definer set search_path = public as $$
declare v_correo text;
begin
  if not (tiene_rol('direccion') or tiene_rol('admin')) then
    raise exception 'Solo dirección y sistemas pueden ver el ERP como otra persona' using errcode = '42501';
  end if;
  if en_vista_previa() then
    raise exception 'Desde una vista previa no se abre otra' using errcode = '42501';
  end if;
  if p_usuario = auth.uid() then
    raise exception 'Esa persona eres tú' using errcode = '22023';
  end if;
  select p.correo into v_correo from perfiles p where p.id = p_usuario and p.activo;
  if v_correo is null then
    raise exception 'Esa persona no existe o está dada de baja' using errcode = '22023';
  end if;
  -- Dirección y sistemas ya ven todo: verlos "como" ellos no enseña nada y sería
  -- la forma de que uno de los dos actuara con la cuenta del otro.
  if exists (select 1 from usuario_roles r where r.usuario_id = p_usuario and r.rol in ('direccion', 'admin')) then
    raise exception 'No hace falta ver como dirección o sistemas: ya ven todo' using errcode = '22023';
  end if;
  return v_correo;
end $$;

-- La lista para elegir: cada persona activa con sus roles, sin dirección ni sistemas.
create or replace function public.personas_para_vista_previa()
returns table (id uuid, nombre text, correo text, roles public.app_rol[])
language sql stable security definer set search_path = public as $$
  select p.id, p.nombre, p.correo, array_agg(r.rol order by r.rol)
  from perfiles p join usuario_roles r on r.usuario_id = p.id
  where p.activo and p.id <> auth.uid()
    and (tiene_rol('direccion') or tiene_rol('admin'))
    and not exists (select 1 from usuario_roles x where x.usuario_id = p.id and x.rol in ('direccion', 'admin'))
  group by p.id, p.nombre, p.correo
  order by min(r.rol::text), p.nombre
$$;

revoke execute on function public.en_vista_previa(), public.antes_de_cada_peticion(),
  public.vista_previa_destino(uuid), public.personas_para_vista_previa() from public, anon;
grant execute on function public.en_vista_previa(), public.vista_previa_destino(uuid),
  public.personas_para_vista_previa() to authenticated;
-- PostgREST la llama con el rol de la petición: anon, authenticated o service_role
-- (sin este último, la función de borde no podría ni anotar la vista previa).
grant execute on function public.antes_de_cada_peticion() to anon, authenticated, service_role;

-- La app arranca con mi_sesion(): ahora además dice si es una vista previa y quién la
-- abrió, para enseñar la franja de aviso. Lo demás, igual que en 070.
create or replace function public.mi_sesion() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'perfil', to_jsonb(p) - 'creado_en' - 'actualizado_en',
    'roles', to_jsonb(mis_roles()),
    'permisos', coalesce((
      select jsonb_object_agg(modulo, nivel) from (
        select modulo, max(nivel) nivel from permisos_rol where rol = any(mis_roles()) group by modulo
      ) x), '{}'::jsonb)
      || case when exists (select 1 from empleados e where e.usuario_id = p.id and e.activo
                             and (exists (select 1 from puesto_asignaciones a where a.empleado_id = e.id)
                                  or exists (select 1 from objetivo_evaluaciones v where v.empleado_id = e.id)))
              then '{"mi_desempeno": 1}'::jsonb else '{}'::jsonb end,
    'vista_previa', (
      select jsonb_build_object('abierta_por', q.nombre, 'desde', v.desde)
      from vistas_previas v join perfiles q on q.id = v.abierta_por
      where v.session_id = nullif(auth.jwt() ->> 'session_id', '')::uuid)
  )
  from perfiles p where p.id = auth.uid()
$$;

-- Que PostgREST la use. Se puede revertir con:
--   alter role authenticator reset pgrst.db_pre_request; notify pgrst, 'reload config';
alter role authenticator set pgrst.db_pre_request = 'public.antes_de_cada_peticion';
notify pgrst, 'reload config';

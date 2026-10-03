-- =============================================================================
-- Base del ERP: quién entra, qué puede ver, y quién cambió qué.
--
-- Las hojas de hoy tienen un problema de fondo: quien tiene el enlace ve todo
-- (costos y márgenes incluidos) y no queda rastro de quién movió un precio.
-- Aquí la seguridad vive en la base (RLS), no en la pantalla: aunque alguien
-- llame a la API directo, solo recibe lo que su rol permite.
-- =============================================================================

create extension if not exists pg_trgm with schema extensions;
create extension if not exists unaccent with schema extensions;

-- unaccent() no es IMMUTABLE y por eso no sirve en índices; esta envoltura sí.
create or replace function public.sin_acentos(t text) returns text
language sql immutable parallel safe as $$
  select lower(extensions.unaccent('extensions.unaccent'::regdictionary, coalesce(t, '')))
$$;

-- ----------------------------------------------------------------------------
-- Roles y permisos
-- ----------------------------------------------------------------------------
create type public.app_rol as enum (
  'direccion',          -- ve y edita todo, incluidos costos y márgenes
  'admin',              -- sistemas: usuarios, configuración, importaciones
  'gerente_ventas',
  'ventas',
  'ingenieria',         -- listas de materiales y costeo
  'compras',
  'almacen',
  'gerente_produccion',
  'produccion',         -- supervisores y terminal de piso
  'rrhh',
  'finanzas',
  'pantalla'            -- TV del taller: solo lectura del tablero de piso
);

create table public.perfiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nombre text not null default '',
  correo text not null,
  puesto text,
  telefono text,
  iniciales text,                    -- las usan las cotizaciones hoy (IH, JM, SR…)
  activo boolean not null default true,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create table public.usuario_roles (
  usuario_id uuid not null references public.perfiles(id) on delete cascade,
  rol public.app_rol not null,
  primary key (usuario_id, rol)
);

-- Nivel: 1 = ver, 2 = capturar/editar, 3 = administrar (borrar, aprobar, configurar).
create table public.permisos_rol (
  rol public.app_rol not null,
  modulo text not null,
  nivel smallint not null check (nivel between 1 and 3),
  primary key (rol, modulo)
);
comment on table public.permisos_rol is
  'Matriz rol × módulo. "costos" es aparte de "costeo": quien no lo tiene ve precios de venta pero nunca costos ni márgenes.';

insert into public.permisos_rol (rol, modulo, nivel) values
  -- dirección: todo
  ('direccion','ventas',3),('direccion','costeo',3),('direccion','costos',3),('direccion','compras',3),
  ('direccion','inventario',3),('direccion','produccion',3),('direccion','rrhh',3),('direccion','finanzas',3),
  ('direccion','admin',3),
  ('admin','admin',3),('admin','ventas',1),('admin','costeo',1),('admin','compras',1),('admin','inventario',1),
  ('admin','produccion',1),
  ('gerente_ventas','ventas',3),('gerente_ventas','costeo',1),('gerente_ventas','inventario',1),
  ('gerente_ventas','produccion',1),('gerente_ventas','finanzas',1),
  ('ventas','ventas',2),('ventas','costeo',1),('ventas','inventario',1),('ventas','produccion',1),
  ('ingenieria','costeo',3),('ingenieria','costos',2),('ingenieria','compras',1),('ingenieria','inventario',1),
  ('ingenieria','produccion',1),
  ('compras','compras',3),('compras','costeo',2),('compras','costos',2),('compras','inventario',2),
  ('compras','produccion',1),('compras','finanzas',1),
  ('almacen','inventario',3),('almacen','compras',1),('almacen','costeo',1),('almacen','produccion',2),
  ('gerente_produccion','produccion',3),('gerente_produccion','inventario',2),('gerente_produccion','costeo',1),
  ('gerente_produccion','compras',1),('gerente_produccion','rrhh',1),('gerente_produccion','ventas',1),
  ('produccion','produccion',2),('produccion','inventario',1),('produccion','costeo',1),
  ('rrhh','rrhh',3),
  ('finanzas','finanzas',3),('finanzas','ventas',1),('finanzas','compras',1),('finanzas','costos',1),
  ('finanzas','inventario',1),
  ('pantalla','produccion',1);

-- Correos autorizados que todavía no han entrado. Al primer inicio de sesión
-- toman sus roles; así el alta de un vendedor es "escribir su correo", nada más.
create table public.invitaciones (
  correo text primary key check (correo = lower(correo)),
  nombre text,
  roles public.app_rol[] not null default '{}',
  invitado_por uuid references public.perfiles(id),
  creado_en timestamptz not null default now()
);

create table public.configuracion (
  clave text primary key,
  valor jsonb not null,
  descripcion text,
  actualizado_en timestamptz not null default now()
);

insert into public.configuracion (clave, valor, descripcion) values
  ('dominios_permitidos', '["hegamex.com"]', 'Dominios de correo que pueden crear cuenta sin invitación (entran sin roles hasta que un admin se los dé).'),
  ('iva', '0.16', 'Tasa de IVA para cotizaciones y pedidos.'),
  ('empresa', '{"nombre":"Hegamex","razon_social":"","rfc":"","telefono":"","sitio":"hegamex.com","direccion":""}', 'Datos que salen en cotizaciones y documentos.');

-- ----------------------------------------------------------------------------
-- Funciones de autorización (las usan todas las políticas RLS)
-- ----------------------------------------------------------------------------
create or replace function public.mis_roles() returns public.app_rol[]
language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(r.rol), '{}')
  from usuario_roles r join perfiles p on p.id = r.usuario_id
  where r.usuario_id = auth.uid() and p.activo
$$;

create or replace function public.tiene_rol(r public.app_rol) returns boolean
language sql stable security definer set search_path = public as $$
  select r = any(mis_roles())
$$;

-- puede('compras', 2) → ¿el usuario actual puede capturar en compras?
create or replace function public.puede(p_modulo text, p_nivel int default 1) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from permisos_rol pr
    where pr.rol = any(mis_roles()) and pr.modulo = p_modulo and pr.nivel >= p_nivel
  )
$$;

-- Lo que la app necesita al arrancar para armar el menú.
create or replace function public.mi_sesion() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'perfil', to_jsonb(p) - 'creado_en' - 'actualizado_en',
    'roles', to_jsonb(mis_roles()),
    'permisos', coalesce((
      select jsonb_object_agg(modulo, nivel) from (
        select modulo, max(nivel) nivel from permisos_rol where rol = any(mis_roles()) group by modulo
      ) x), '{}'::jsonb)
  )
  from perfiles p where p.id = auth.uid()
$$;

-- ----------------------------------------------------------------------------
-- Alta automática de perfil al crear cuenta (Google o contraseña)
-- ----------------------------------------------------------------------------
create or replace function public.al_crear_usuario() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_correo text := lower(new.email);
  v_inv invitaciones;
  v_dominios jsonb;
  v_nombre text;
begin
  select * into v_inv from invitaciones where correo = v_correo;
  select valor into v_dominios from configuracion where clave = 'dominios_permitidos';

  -- Fuera del dominio de la empresa y sin invitación: la cuenta no se crea.
  -- Es la diferencia con "cualquiera que tenga el enlace de la hoja".
  if v_inv.correo is null and not (v_dominios ? split_part(v_correo, '@', 2)) then
    raise exception 'El correo % no está autorizado. Pide a un administrador que te invite.', v_correo
      using errcode = '42501';
  end if;

  v_nombre := coalesce(nullif(v_inv.nombre, ''), new.raw_user_meta_data->>'full_name',
                       new.raw_user_meta_data->>'name', split_part(v_correo, '@', 1));

  insert into perfiles (id, nombre, correo, iniciales)
  values (new.id, v_nombre, v_correo,
          upper(left(split_part(v_nombre, ' ', 1), 1) || left(split_part(v_nombre, ' ', 2), 1)));

  if v_inv.correo is not null then
    insert into usuario_roles (usuario_id, rol) select new.id, unnest(v_inv.roles) on conflict do nothing;
    delete from invitaciones where correo = v_correo;
  end if;
  return new;
end $$;

create trigger al_crear_usuario after insert on auth.users
  for each row execute function public.al_crear_usuario();

-- ----------------------------------------------------------------------------
-- Utilidades comunes
-- ----------------------------------------------------------------------------
create or replace function public.tocar_actualizado() returns trigger language plpgsql as $$
begin new.actualizado_en := now(); return new; end $$;

create trigger tocar before update on public.perfiles for each row execute function public.tocar_actualizado();

-- Folios consecutivos sin huecos por serie y año: COT-2026-00042.
-- Con una tabla y "for update" dos vendedores no pueden sacar el mismo número,
-- cosa que en la hoja pasa cuando dos copian la última fila a la vez.
create table public.folios (
  serie text not null,
  anio int not null,
  ultimo int not null default 0,
  primary key (serie, anio)
);

create or replace function public.siguiente_folio(p_serie text) returns text
language plpgsql security definer set search_path = public as $$
declare v_anio int := extract(year from now() at time zone 'America/Mexico_City'); v_n int;
begin
  insert into folios (serie, anio, ultimo) values (p_serie, v_anio, 1)
  on conflict (serie, anio) do update set ultimo = folios.ultimo + 1
  returning ultimo into v_n;
  return format('%s-%s-%s', p_serie, v_anio, lpad(v_n::text, 5, '0'));
end $$;

-- ----------------------------------------------------------------------------
-- Bitácora: quién cambió qué y cuándo
-- ----------------------------------------------------------------------------
create table public.bitacora (
  id bigserial primary key,
  tabla text not null,
  registro_id text not null,
  accion text not null check (accion in ('alta','cambio','baja')),
  cambios jsonb,          -- en cambios: solo las columnas que cambiaron, {col: [antes, después]}
  usuario_id uuid default auth.uid(),
  en timestamptz not null default now()
);
create index bitacora_registro on public.bitacora (tabla, registro_id, en desc);
create index bitacora_en on public.bitacora (en desc);

create or replace function public.auditar() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_cambios jsonb; v_id text; j jsonb;
begin
  -- Tablas con llave compuesta o natural no tienen "id"; se arma una legible.
  j := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  v_id := coalesce(j->>'id', j->>'clave', nullif(concat_ws(':', j->>'usuario_id', j->>'rol'), ''), md5(j::text));
  if tg_op = 'INSERT' then
    insert into bitacora (tabla, registro_id, accion, cambios) values (tg_table_name, v_id, 'alta', null);
    return new;
  elsif tg_op = 'DELETE' then
    insert into bitacora (tabla, registro_id, accion, cambios) values (tg_table_name, v_id, 'baja', to_jsonb(old));
    return old;
  end if;
  select jsonb_object_agg(n.key, jsonb_build_array(o.value, n.value)) into v_cambios
  from jsonb_each(to_jsonb(new)) n join jsonb_each(to_jsonb(old)) o using (key)
  where n.value is distinct from o.value and n.key not in ('actualizado_en');
  if v_cambios is not null then
    insert into bitacora (tabla, registro_id, accion, cambios) values (tg_table_name, v_id, 'cambio', v_cambios);
  end if;
  return new;
end $$;

-- ----------------------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------------------
alter table public.perfiles enable row level security;
alter table public.usuario_roles enable row level security;
alter table public.permisos_rol enable row level security;
alter table public.invitaciones enable row level security;
alter table public.configuracion enable row level security;
alter table public.folios enable row level security;
alter table public.bitacora enable row level security;

-- Todos los usuarios activos se ven entre sí (para asignar vendedores, responsables…).
create policy perfiles_ver on public.perfiles for select to authenticated using (cardinality(mis_roles()) > 0 or id = auth.uid());
create policy perfiles_propio on public.perfiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
create policy perfiles_admin on public.perfiles for all to authenticated using (puede('admin', 3)) with check (puede('admin', 3));

create policy roles_ver on public.usuario_roles for select to authenticated using (usuario_id = auth.uid() or puede('admin', 1));
create policy roles_admin on public.usuario_roles for all to authenticated using (puede('admin', 3)) with check (puede('admin', 3));

create policy permisos_ver on public.permisos_rol for select to authenticated using (true);
create policy permisos_admin on public.permisos_rol for all to authenticated using (tiene_rol('direccion')) with check (tiene_rol('direccion'));

create policy invitaciones_admin on public.invitaciones for all to authenticated using (puede('admin', 3)) with check (puede('admin', 3));

create policy config_ver on public.configuracion for select to authenticated using (cardinality(mis_roles()) > 0);
create policy config_admin on public.configuracion for all to authenticated using (puede('admin', 3)) with check (puede('admin', 3));

create policy bitacora_ver on public.bitacora for select to authenticated using (puede('admin', 1) or tiene_rol('direccion'));

-- Un usuario no puede darse roles a sí mismo cambiando su perfil: la columna
-- "activo" solo la toca un admin.
create or replace function public.proteger_perfil() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.activo is distinct from old.activo and not puede('admin', 3) then
    raise exception 'Solo un administrador puede activar o desactivar usuarios' using errcode = '42501';
  end if;
  if new.correo is distinct from old.correo and not puede('admin', 3) then
    raise exception 'El correo no se cambia desde el perfil' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger proteger_perfil before update on public.perfiles for each row execute function public.proteger_perfil();

create trigger auditar after insert or update or delete on public.usuario_roles for each row execute function public.auditar();
create trigger auditar after update on public.perfiles for each row execute function public.auditar();
create trigger auditar after insert or update or delete on public.configuracion for each row execute function public.auditar();

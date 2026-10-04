-- =============================================================================
-- "Ver como": dirección recorre el ERP con los permisos de otro rol.
--
-- Esconder el menú no basta para probar qué ve un vendedor: la RLS es la que
-- decide qué renglones llegan, y con los permisos de dirección la pantalla de
-- un vendedor mostraría los pedidos de todos y los costos. Por eso la simulación
-- vive en mis_roles(), de donde sale todo lo demás (puede(), tiene_rol(),
-- mi_sesion(), cada política, el asistente y el tiempo real): mientras dura, la
-- base trata a la persona como si solo tuviera ese rol.
--
-- Solo dirección, porque dirección conserva siempre el nivel 3 en todos los
-- módulos (proteger_permisos_direccion): simular únicamente le QUITA permisos.
-- A sistemas no: no puede darse roles a sí misma (proteger_roles) y "ver como
-- finanzas" le abriría los costos.
--
-- Lo que depende de la persona y no del rol (sus clientes, sus pedidos, su ficha
-- de empleado) sigue siendo de quien simula: se ve lo que vería alguien NUEVO
-- con ese rol, no lo que ve un vendedor en particular. Para eso está la vista
-- previa de una persona (091, función ver-como), que convive con esta.
--
-- (Se escribió como 091 en otra sesión al mismo tiempo que 091_vista_previa; va
-- después porque la nube ya tenía registrada la 091 y la saltaría.)
-- =============================================================================

create table public.simulacion_rol (
  usuario_id uuid primary key references public.perfiles(id) on delete cascade,
  rol public.app_rol not null,
  desde timestamptz not null default now()
);
comment on table public.simulacion_rol is
  'Quién de dirección está viendo el ERP como otro rol. Sin políticas: solo la escribe ver_como() y solo la lee mis_roles().';
alter table public.simulacion_rol enable row level security;

-- Que quede en la bitácora: lo que se capture mientras tanto sale a nombre de
-- quien simula, y esto explica por qué dirección "no pudo" algo un rato.
create trigger auditar after insert or update or delete on public.simulacion_rol
  for each row execute function public.auditar();

-- Los roles de verdad, sin simulación. Los necesita ver_como() para dejar
-- volver: mientras se ve como "ventas", tiene_rol('direccion') ya es falso.
create or replace function public.mis_roles_reales() returns public.app_rol[]
language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(r.rol), '{}')
  from usuario_roles r join perfiles p on p.id = r.usuario_id
  where r.usuario_id = auth.uid() and p.activo
$$;

-- Se vuelve a revisar 'direccion' en cada llamada y no solo al empezar: si a
-- alguien le quitan dirección a media simulación, el renglón que quedó no le
-- debe seguir dando el rol simulado (sería una forma de quedarse con "finanzas").
--
-- En plpgsql y no en sql: una función sql security definer se vuelve a planear
-- en cada llamada, y puede() la llama por cada permiso que revisa. Con la
-- simulación agregada en sql, puede() pasaba de ~130 µs a ~230 µs; en plpgsql el
-- plan se guarda en la sesión y baja a ~33 µs, más rápido que antes de esto.
create or replace function public.mis_roles() returns public.app_rol[]
language plpgsql stable security definer set search_path = public as $$
declare v_roles public.app_rol[]; v_simulado public.app_rol;
begin
  select coalesce(array_agg(r.rol), '{}') into v_roles
  from usuario_roles r join perfiles p on p.id = r.usuario_id
  where r.usuario_id = auth.uid() and p.activo;
  if 'direccion' = any(v_roles) then
    select s.rol into v_simulado from simulacion_rol s where s.usuario_id = auth.uid();
    if found then return array[v_simulado]; end if;
  end if;
  return v_roles;
end $$;

-- ver_como(null) o ver_como('direccion') regresa a la vista propia.
create or replace function public.ver_como(p_rol public.app_rol) returns void
language plpgsql security definer set search_path = public as $$
begin
  -- Volver siempre se puede: borrar la propia simulación nunca da nada.
  if p_rol is null or p_rol = 'direccion' then
    delete from simulacion_rol where usuario_id = auth.uid();
    return;
  end if;
  if not 'direccion' = any(mis_roles_reales()) then
    raise exception 'Solo dirección puede ver el ERP como otro rol' using errcode = '42501';
  end if;
  insert into simulacion_rol (usuario_id, rol) values (auth.uid(), p_rol)
  on conflict (usuario_id) do update set rol = excluded.rol, desde = now();
end $$;

-- mi_sesion() de 70_objetivos_prenomina, más lo que la pantalla necesita para
-- el aviso de simulación y para ofrecer "ver como" aun estando en otro rol, y la
-- franja de la vista previa de una persona (091).
create or replace function public.mi_sesion() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'perfil', to_jsonb(p) - 'creado_en' - 'actualizado_en',
    'roles', to_jsonb(mis_roles()),
    'roles_reales', to_jsonb(mis_roles_reales()),
    'viendo_como', case when 'direccion' = any(mis_roles_reales())
                        then (select to_jsonb(s.rol) from simulacion_rol s where s.usuario_id = p.id) end,
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

-- La vista previa de una persona (091) revisaba tiene_rol(): mientras dirección ve
-- como "ventas", eso ya es falso y no la dejaba abrir la de un vendedor. Lo que
-- cuenta para abrirla son los roles de verdad. Lo demás, igual que en 091.
create or replace function public.vista_previa_destino(p_usuario uuid) returns text
language plpgsql stable security definer set search_path = public as $$
declare v_correo text;
begin
  if not (mis_roles_reales() && array['direccion', 'admin']::public.app_rol[]) then
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
  if exists (select 1 from usuario_roles r where r.usuario_id = p_usuario and r.rol in ('direccion', 'admin')) then
    raise exception 'No hace falta ver como dirección o sistemas: ya ven todo' using errcode = '22023';
  end if;
  return v_correo;
end $$;

create or replace function public.personas_para_vista_previa()
returns table (id uuid, nombre text, correo text, roles public.app_rol[])
language sql stable security definer set search_path = public as $$
  select p.id, p.nombre, p.correo, array_agg(r.rol order by r.rol)
  from perfiles p join usuario_roles r on r.usuario_id = p.id
  where p.activo and p.id <> auth.uid()
    and mis_roles_reales() && array['direccion', 'admin']::public.app_rol[]
    and not exists (select 1 from usuario_roles x where x.usuario_id = p.id and x.rol in ('direccion', 'admin'))
  group by p.id, p.nombre, p.correo
  order by min(r.rol::text), p.nombre
$$;

revoke all on function public.ver_como(public.app_rol) from public, anon;
grant execute on function public.ver_como(public.app_rol) to authenticated;

-- La bitácora nombra a la persona, como en usuario_roles.
create or replace function public.etiqueta_registro(p_tabla text, p_id text)
 returns text
 language plpgsql
 stable
 set search_path to 'public'
as $function$
declare v_uuid uuid; v_int int; v_parte text := split_part(p_id, ':', 1);
begin
  if v_parte ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then v_uuid := v_parte::uuid; end if;
  if p_id ~ '^\d{1,9}$' then v_int := p_id::int; end if;
  return case p_tabla
    when 'empleados' then (select coalesce(numero || ' · ', '') || nombre from empleados where id = v_uuid)
    when 'empleado_datos' then (select nombre from empleados where id = v_uuid)
    when 'incidencias' then (select e.nombre from incidencias i join empleados e on e.id = i.empleado_id where i.id = v_uuid)
    when 'pedidos' then (select folio from pedidos where id = v_uuid)
    when 'cotizaciones' then (select folio from cotizaciones where id = v_uuid)
    when 'clientes' then (select nombre from clientes where id = v_uuid)
    when 'proveedores' then (select nombre from proveedores where id = v_uuid)
    when 'ordenes_compra' then (select folio from v_ordenes_compra where id = v_uuid)
    when 'ordenes_produccion' then (select folio from ordenes_produccion where id = v_uuid)
    when 'articulos' then (select clave || ' · ' || nombre from articulos where id = v_uuid)
    when 'perfiles' then (select nombre from perfiles where id = v_uuid)
    when 'usuario_roles' then (select nombre from perfiles where id = v_uuid)
    when 'simulacion_rol' then (select nombre from perfiles where id = v_uuid)
    when 'cobros' then (select 'Cobro de ' || p.folio from cobros c join pedidos p on p.id = c.pedido_id where c.id = v_uuid)
    when 'facturas' then (select f.folio || ' · ' || p.folio from facturas f join pedidos p on p.id = f.pedido_id where f.id = v_uuid)
    when 'pagos_proveedor' then (select 'Pago de ' || o.folio from pagos_proveedor x join v_ordenes_compra o on o.id = x.orden_compra_id where x.id = v_uuid)
    when 'almacenes' then (select nombre from almacenes where id = v_int)
    when 'etapas' then (select nombre from etapas where id = v_int)
    when 'departamentos' then (select nombre from departamentos where id = v_int)
    when 'textos_comerciales' then (select left(texto, 60) from textos_comerciales where id = v_int)
    else null end;
end $function$;

notify pgrst, 'reload schema';

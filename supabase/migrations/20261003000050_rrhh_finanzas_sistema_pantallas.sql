-- =============================================================================
-- Lo que la base tenía que saber para las pantallas de RRHH, finanzas y sistema.
--
-- Las pantallas no recalculan nada: días hábiles, saldo de vacaciones,
-- antigüedad de saldos, quién puede dar qué rol y qué ve cada quien en la
-- bitácora se deciden aquí, con su prueba en 90_rrhh_finanzas_sistema.sql.
--
-- Cambios a objetos de migraciones anteriores (con create or replace):
--  * auditar(): llave legible para tablas sin "id" (permisos_rol, tipos_cambio,
--    canales…) y el alta guarda lo que se creó, con el mismo formato
--    {col: [antes, después]} que un cambio (la baja, {col: [antes, null]}).
--  * bitacora_ver: la bitácora ya no enseña salarios, CURP ni costos a quien no
--    los puede ver en su tabla (sistemas tiene "admin" pero no "costos" ni "rrhh").
--  * v_vacaciones: antes del primer aniversario el saldo era 12; la LFT da
--    vacaciones a partir del año cumplido. Columnas nuevas al final.
-- =============================================================================

-- ----------------------------------------------------------------------------
-- Bitácora
-- ----------------------------------------------------------------------------
create or replace function public.auditar() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_cambios jsonb; v_id text; j jsonb;
begin
  -- Tablas con llave compuesta o natural no tienen "id"; se arma una legible
  -- (antes salía un md5 que nadie podía buscar).
  j := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  v_id := coalesce(j->>'id', j->>'clave',
    case when j ? 'usuario_id' and j ? 'rol' then concat_ws(':', j->>'usuario_id', j->>'rol') end,
    case when j ? 'rol' and j ? 'modulo' then concat_ws(':', j->>'rol', j->>'modulo') end,
    case when j ? 'fecha' and j ? 'moneda' then concat_ws(':', j->>'fecha', j->>'moneda') end,
    j->>'empleado_id', j->>'articulo_id', j->>'etapa_id', j->>'canal', j->>'meses', j->>'correo',
    md5(j::text));
  if tg_op = 'INSERT' then
    -- Un alta es un cambio desde "nada": así la pantalla enseña qué se creó.
    select jsonb_object_agg(key, jsonb_build_array(null, value)) into v_cambios
    from jsonb_each(j) where value <> 'null'::jsonb and key not in ('creado_en', 'actualizado_en');
    insert into bitacora (tabla, registro_id, accion, cambios) values (tg_table_name, v_id, 'alta', v_cambios);
    return new;
  elsif tg_op = 'DELETE' then
    select jsonb_object_agg(key, jsonb_build_array(value, null)) into v_cambios
    from jsonb_each(j) where value <> 'null'::jsonb and key not in ('creado_en', 'actualizado_en');
    insert into bitacora (tabla, registro_id, accion, cambios) values (tg_table_name, v_id, 'baja', v_cambios);
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

-- La bitácora guarda valores completos. Sin este filtro, sistemas (que tiene
-- "admin" para ver la bitácora) leía ahí salarios, CURP y utilidades que la
-- RLS de cada tabla le esconde. Mismo criterio que el "ver" de cada tabla.
-- Cada puede() va en (select …) para que se evalúe una vez por consulta y no
-- una vez por renglón (la bitácora es la tabla que más crece).
drop policy if exists bitacora_ver on public.bitacora;
create policy bitacora_ver on public.bitacora for select to authenticated using (
  ((select puede('admin', 1)) or (select tiene_rol('direccion')))
  and (tabla <> 'empleado_datos' or (select puede('rrhh', 3)))
  and (tabla not in ('empleados', 'incidencias') or (select puede('rrhh', 1)) or (select puede('produccion', 3)))
  and (tabla not in ('costos_articulo', 'historial_costos', 'costos_calculados', 'politicas_precio', 'tarifas_mano_obra', 'historial_costeo')
       or (select puede('costos', 1)))
  and (tabla not in ('cobros', 'facturas', 'comision_ajustes', 'comision_pagos', 'vendedor_plan')
       or (select puede('finanzas', 1)) or (select puede('ventas', 3)))
);
drop function if exists public.bitacora_visible(text);

-- Nombre legible del registro ("PED-2026-00012", "Juan Pérez"). security
-- invoker: si quien pregunta no ve el registro, sale vacío y la pantalla usa
-- lo que guarda el propio cambio.
create or replace function public.etiqueta_registro(p_tabla text, p_id text) returns text
language plpgsql stable security invoker set search_path = public as $$
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
    when 'ordenes_compra' then (select folio from ordenes_compra where id = v_uuid)
    when 'ordenes_produccion' then (select folio from ordenes_produccion where id = v_uuid)
    when 'articulos' then (select clave || ' · ' || nombre from articulos where id = v_uuid)
    when 'perfiles' then (select nombre from perfiles where id = v_uuid)
    when 'usuario_roles' then (select nombre from perfiles where id = v_uuid)
    when 'cobros' then (select 'Cobro de ' || p.folio from cobros c join pedidos p on p.id = c.pedido_id where c.id = v_uuid)
    when 'facturas' then (select f.folio || ' · ' || p.folio from facturas f join pedidos p on p.id = f.pedido_id where f.id = v_uuid)
    when 'pagos_proveedor' then (select 'Pago de ' || o.folio from pagos_proveedor x join ordenes_compra o on o.id = x.orden_compra_id where x.id = v_uuid)
    when 'almacenes' then (select nombre from almacenes where id = v_int)
    when 'etapas' then (select nombre from etapas where id = v_int)
    when 'departamentos' then (select nombre from departamentos where id = v_int)
    when 'textos_comerciales' then (select left(texto, 60) from textos_comerciales where id = v_int)
    else null end;
end $$;

create or replace view public.v_bitacora with (security_invoker = true) as
select b.id, b.tabla, b.registro_id, b.accion, b.cambios, b.usuario_id, b.en,
  p.nombre as usuario, p.correo as usuario_correo, etiqueta_registro(b.tabla, b.registro_id) as etiqueta
from public.bitacora b left join public.perfiles p on p.id = b.usuario_id;

-- Lo que se configura desde Sistema también deja rastro (antes no: la matriz
-- de permisos o una comisión de Mercado Libre cambiaban sin que nadie supiera).
do $$
declare t text;
begin
  foreach t in array array['permisos_rol', 'invitaciones', 'etapas', 'tipos_cambio', 'textos_comerciales',
                           'planes_meses', 'canales', 'facturas', 'departamentos'] loop
    execute format('drop trigger if exists auditar on public.%I', t);
    execute format('create trigger auditar after insert or update or delete on public.%I for each row execute function public.auditar()', t);
  end loop;
end $$;

-- ----------------------------------------------------------------------------
-- Usuarios, roles e invitaciones
-- ----------------------------------------------------------------------------
-- Con "admin" nivel 3, sistemas podía darse el rol de dirección (y con él
-- costos y márgenes), o dárselo a un cómplice o a una invitación. Ahora:
--  * nadie cambia sus propios roles;
--  * el rol de dirección solo lo da o lo quita dirección.
-- Sin sesión (postgres, service role, o el alta automática de al_crear_usuario
-- que toma los roles de la invitación) no se revisa: ahí no hay "alguien".
create or replace function public.proteger_roles() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_usuario uuid; v_toca_direccion boolean;
begin
  if auth.uid() is null then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  if tg_op = 'DELETE' then
    v_usuario := old.usuario_id; v_toca_direccion := old.rol = 'direccion';
  elsif tg_op = 'INSERT' then
    v_usuario := new.usuario_id; v_toca_direccion := new.rol = 'direccion';
  else
    -- Un cambio que mueve el rol de una persona a otra cuenta para las dos.
    v_usuario := case when old.usuario_id = auth.uid() then old.usuario_id else new.usuario_id end;
    v_toca_direccion := 'direccion' in (old.rol, new.rol);
  end if;
  if v_usuario = auth.uid() then
    raise exception 'Nadie cambia sus propios roles: pídeselo a otra persona de sistemas o a dirección' using errcode = '42501';
  end if;
  if v_toca_direccion and not tiene_rol('direccion') then
    raise exception 'Solo dirección puede dar o quitar el rol de dirección' using errcode = '42501';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;
drop trigger if exists proteger_roles on public.usuario_roles;
create trigger proteger_roles before insert or update or delete on public.usuario_roles
  for each row execute function public.proteger_roles();

-- Desactivar: nadie se desactiva a sí mismo (se quedaría fuera sin que nadie
-- lo note) y a dirección solo la desactiva dirección.
create or replace function public.proteger_activacion() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or new.activo is not distinct from old.activo then return new; end if;
  if new.id = auth.uid() and not new.activo then
    raise exception 'No puedes desactivar tu propia cuenta' using errcode = '42501';
  end if;
  if exists (select 1 from usuario_roles where usuario_id = new.id and rol = 'direccion') and not tiene_rol('direccion') then
    raise exception 'Solo dirección puede desactivar o reactivar a alguien de dirección' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists proteger_activacion on public.perfiles;
create trigger proteger_activacion before update on public.perfiles for each row execute function public.proteger_activacion();

create or replace function public.proteger_invitacion() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.correo := lower(trim(new.correo));
  new.invitado_por := coalesce(new.invitado_por, auth.uid());
  if new.correo !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'El correo "%" no parece válido', new.correo;
  end if;
  -- Una invitación con rol de dirección sería la misma puerta que proteger_roles cierra.
  if auth.uid() is not null and 'direccion' = any(new.roles) and not tiene_rol('direccion') then
    raise exception 'Solo dirección puede invitar a alguien con rol de dirección' using errcode = '42501';
  end if;
  -- La invitación solo sirve al crear la cuenta; a quien ya entró se le dan roles en su ficha.
  if exists (select 1 from perfiles where correo = new.correo) then
    raise exception '% ya tiene cuenta: dale los roles desde la lista de usuarios', new.correo;
  end if;
  return new;
end $$;
drop trigger if exists proteger_invitacion on public.invitaciones;
create trigger proteger_invitacion before insert or update on public.invitaciones
  for each row execute function public.proteger_invitacion();

-- Lista para la pantalla de usuarios, con el último acceso (vive en auth.users,
-- que la app no puede leer). security definer porque lee auth; por eso revisa
-- el permiso antes de nada.
create or replace function public.lista_usuarios()
returns table (id uuid, nombre text, correo text, puesto text, iniciales text, activo boolean, roles public.app_rol[],
               ultimo_acceso timestamptz, creado_en timestamptz, metodo text,
               empleado_id uuid, empleado text, empleado_activo boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  if not puede('admin', 3) then
    raise exception 'Solo sistemas o dirección ven la lista de usuarios' using errcode = '42501';
  end if;
  return query
  select p.id, p.nombre, p.correo, p.puesto, p.iniciales, p.activo,
    coalesce((select array_agg(r.rol order by r.rol) from usuario_roles r where r.usuario_id = p.id), '{}'::app_rol[]),
    u.last_sign_in_at, p.creado_en, coalesce(u.raw_app_meta_data->>'provider', 'email'),
    e.id, e.nombre, e.activo
  from perfiles p
  left join auth.users u on u.id = p.id
  left join empleados e on e.usuario_id = p.id
  order by p.activo desc, p.nombre;
end $$;

-- La matriz la edita dirección, y dirección se podía quitar a sí misma
-- "admin" o "costos" de un clic y quedarse sin poder deshacerlo.
create or replace function public.proteger_permisos_direccion() returns trigger
language plpgsql set search_path = public as $$
begin
  if (tg_op = 'DELETE' and old.rol = 'direccion')
     or (tg_op = 'UPDATE' and (old.rol = 'direccion' or new.rol = 'direccion') and new.nivel < 3) then
    raise exception 'Dirección conserva siempre el nivel 3 en todos los módulos' using errcode = '42501';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;
drop trigger if exists proteger_direccion on public.permisos_rol;
create trigger proteger_direccion before update or delete on public.permisos_rol
  for each row execute function public.proteger_permisos_direccion();

-- ----------------------------------------------------------------------------
-- Configuración: los catálogos del sistema también los cuida sistemas.
-- Comisiones de canales, planes de meses y tipo de cambio NO: mueven precios,
-- siguen siendo de ventas 3 / compras-finanzas 2.
-- ----------------------------------------------------------------------------
drop policy if exists config_admin on public.almacenes;
create policy config_admin on public.almacenes for all to authenticated using ((select puede('admin', 3))) with check ((select puede('admin', 3)));
drop policy if exists config_admin on public.etapas;
create policy config_admin on public.etapas for all to authenticated using ((select puede('admin', 3))) with check ((select puede('admin', 3)));
drop policy if exists config_admin on public.textos_comerciales;
create policy config_admin on public.textos_comerciales for all to authenticated using ((select puede('admin', 3))) with check ((select puede('admin', 3)));

-- Un solo texto "por defecto" por tipo de pago, entrega y vigencia (las notas
-- sí pueden ser varias): con dos, el cotizador elegía uno al azar.
create or replace function public.un_texto_por_defecto() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.por_defecto and new.tipo <> 'nota' then
    update textos_comerciales set por_defecto = false where tipo = new.tipo and id <> new.id and por_defecto;
  end if;
  return null;
end $$;
drop trigger if exists un_por_defecto on public.textos_comerciales;
create trigger un_por_defecto after insert or update of por_defecto, tipo on public.textos_comerciales
  for each row when (new.por_defecto) execute function public.un_texto_por_defecto();

-- ----------------------------------------------------------------------------
-- RRHH: días hábiles, incidencias y vacaciones
-- ----------------------------------------------------------------------------
insert into public.configuracion (clave, valor, descripcion) values
  ('calendario_laboral', '{"dias":[1,2,3,4,5,6],"descansos_empresa":[]}',
   'Días que se trabajan (1 = lunes … 7 = domingo) y descansos propios de la empresa (fechas). Con esto se cuentan los días hábiles de vacaciones y permisos; los feriados de ley se suman solos.')
on conflict (clave) do nothing;

-- Descanso obligatorio, art. 74 LFT. El 1 de octubre solo cada seis años
-- (transmisión del Poder Ejecutivo, desde 2024).
create or replace function public.festivos_lft(p_anio int) returns setof date
language sql immutable as $$
  select d from (values
    (make_date(p_anio, 1, 1)),
    (make_date(p_anio, 2, 1) + (8 - extract(isodow from make_date(p_anio, 2, 1))::int) % 7),        -- 1.er lunes de febrero
    (make_date(p_anio, 3, 1) + (8 - extract(isodow from make_date(p_anio, 3, 1))::int) % 7 + 14),   -- 3.er lunes de marzo
    (make_date(p_anio, 5, 1)),
    (make_date(p_anio, 9, 16)),
    (make_date(p_anio, 11, 1) + (8 - extract(isodow from make_date(p_anio, 11, 1))::int) % 7 + 14), -- 3.er lunes de noviembre
    (make_date(p_anio, 12, 25))
  ) v(d)
  union all
  select make_date(p_anio, 10, 1) where p_anio >= 2024 and (p_anio - 2024) % 6 = 0
$$;

-- Días hábiles entre dos fechas (incluidas): los de la semana laboral, menos
-- feriados de ley y descansos de la empresa. Así se descuentan las vacaciones.
create or replace function public.dias_habiles(p_inicio date, p_fin date) returns int
language sql stable security definer set search_path = public as $$
  with cfg as (
    select coalesce((select valor from configuracion where clave = 'calendario_laboral'), '{"dias":[1,2,3,4,5,6]}'::jsonb) v
  ), fest as (
    select festivos_lft(y) d from generate_series(extract(year from p_inicio)::int, extract(year from p_fin)::int) y
  )
  select count(*)::int
  from generate_series(p_inicio, p_fin, interval '1 day') g(t), cfg
  where (cfg.v->'dias') @> to_jsonb(extract(isodow from g.t)::int)
    and g.t::date not in (select d from fest)
    and not coalesce(cfg.v->'descansos_empresa', '[]'::jsonb) @> to_jsonb(to_char(g.t, 'YYYY-MM-DD'))
$$;

-- Calendario de un mes con lo que la pantalla necesita para pintar los días.
create or replace function public.dias_del_mes(p_mes date)
returns table (dia date, habil boolean, festivo boolean)
language sql stable security definer set search_path = public as $$
  select g.t::date, dias_habiles(g.t::date, g.t::date) = 1,
    g.t::date in (select festivos_lft(extract(year from p_mes)::int))
  from generate_series(date_trunc('month', p_mes), date_trunc('month', p_mes) + interval '1 month - 1 day', interval '1 day') g(t)
$$;

create or replace function public.trg_incidencia() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_calc numeric;
begin
  if tg_op = 'INSERT' then
    -- El trabajador o su gerente solo piden; aprobar es de RRHH. Sin esto, la
    -- política "alta" dejaba a cualquiera registrar sus vacaciones ya aprobadas.
    if auth.uid() is not null and not puede('rrhh', 2) then
      new.estado := 'solicitada';
    end if;
    new.solicitada_por := coalesce(new.solicitada_por, auth.uid());
  end if;
  if new.estado = 'solicitada' then
    new.resuelta_por := null;
  elsif tg_op = 'INSERT' or new.estado is distinct from old.estado then
    new.resuelta_por := coalesce(auth.uid(), new.resuelta_por);
  end if;

  if new.tipo in ('vacaciones', 'permiso_con_goce', 'permiso_sin_goce', 'falta') then
    v_calc := dias_habiles(new.inicio, new.fin);
    -- Medio día de permiso: se respeta si es un solo día hábil.
    if not (new.inicio = new.fin and new.dias = 0.5 and v_calc = 1) then new.dias := v_calc; end if;
    if new.dias = 0 then
      raise exception 'Entre el % y el % no hay días hábiles (fin de semana o feriado)', to_char(new.inicio, 'DD/MM/YYYY'), to_char(new.fin, 'DD/MM/YYYY');
    end if;
  elsif new.tipo = 'incapacidad' then
    new.dias := new.fin - new.inicio + 1;          -- el IMSS cuenta días naturales
  else                                             -- retardo y horas extra son de un día
    new.dias := 0;
    new.fin := new.inicio;
    if new.tipo = 'horas_extra' and coalesce(new.horas, 0) <= 0 then
      raise exception 'Indica cuántas horas extra fueron';
    end if;
  end if;

  if new.estado <> 'rechazada' and new.tipo in ('vacaciones', 'permiso_con_goce', 'permiso_sin_goce', 'falta', 'incapacidad')
     and exists (select 1 from incidencias i
                 where i.empleado_id = new.empleado_id and i.id <> new.id and i.estado <> 'rechazada'
                   and i.tipo in ('vacaciones', 'permiso_con_goce', 'permiso_sin_goce', 'falta', 'incapacidad')
                   and daterange(i.inicio, i.fin, '[]') && daterange(new.inicio, new.fin, '[]')) then
    raise exception 'Esa persona ya tiene otra ausencia registrada en esas fechas';
  end if;
  return new;
end $$;
drop trigger if exists calcular on public.incidencias;
create trigger calcular before insert or update on public.incidencias for each row execute function public.trg_incidencia();

-- Una baja sin fecha ni motivo no sirve para el finiquito ni para el IMSS.
create or replace function public.trg_empleado() returns trigger
language plpgsql set search_path = public as $$
begin
  new.nombre := trim(new.nombre);
  new.numero := nullif(trim(new.numero), '');
  if not new.activo then
    if new.baja_en is null or coalesce(trim(new.motivo_baja), '') = '' then
      raise exception 'Para dar de baja a alguien se necesita la fecha y el motivo';
    end if;
    if new.baja_en < new.fecha_ingreso then
      raise exception 'La fecha de baja no puede ser antes del ingreso';
    end if;
  else
    -- Reingreso: la baja anterior queda en la bitácora.
    new.baja_en := null; new.motivo_baja := null;
  end if;
  return new;
end $$;
drop trigger if exists validar on public.empleados;
create trigger validar before insert or update on public.empleados for each row execute function public.trg_empleado();

-- CURP, RFC y NSS con su forma: un dígito de más en el NSS es un alta del IMSS rechazada.
create or replace function public.validar_empleado_datos() returns trigger
language plpgsql set search_path = public as $$
begin
  new.curp := nullif(upper(trim(new.curp)), '');
  new.rfc := nullif(upper(trim(new.rfc)), '');
  new.nss := nullif(regexp_replace(coalesce(new.nss, ''), '\D', '', 'g'), '');
  new.cuenta_bancaria := nullif(regexp_replace(coalesce(new.cuenta_bancaria, ''), '\s', '', 'g'), '');
  if new.curp is not null and new.curp !~ '^[A-Z][AEIOUX][A-Z]{2}[0-9]{6}[HMX][A-Z]{5}[0-9A-Z][0-9]$' then
    raise exception 'La CURP no tiene la forma correcta (18 caracteres: 4 letras, fecha AAMMDD, sexo, estado, 3 consonantes y 2 de verificación)';
  end if;
  if new.rfc is not null and new.rfc !~ '^[A-ZÑ&]{4}[0-9]{6}[A-Z0-9]{3}$' then
    raise exception 'El RFC de una persona son 13 caracteres: 4 letras, fecha AAMMDD y homoclave';
  end if;
  if new.nss is not null and length(new.nss) <> 11 then
    raise exception 'El NSS son 11 dígitos';
  end if;
  if new.salario_diario is not null and new.salario_diario <= 0 then
    raise exception 'El salario diario debe ser mayor a cero';
  end if;
  return new;
end $$;
drop trigger if exists validar on public.empleado_datos;
create trigger validar before insert or update on public.empleado_datos for each row execute function public.validar_empleado_datos();

-- LFT art. 76 (reforma 2023): vacaciones a partir del primer año cumplido.
-- Antes este saldo decía 12 a quien llevaba un mes.
create or replace view public.v_vacaciones with (security_invoker = true) as
select e.id empleado_id, e.nombre, e.fecha_ingreso, x.anios,
  dias_vacaciones(x.anios) as dias_periodo,
  x.inicio_periodo,
  t.tomados,
  dias_vacaciones(x.anios) - t.tomados as saldo,
  (x.inicio_periodo + interval '1 year')::date as proximo_aniversario,
  dias_vacaciones(x.anios + 1) as dias_proximo_periodo,
  t.solicitados,
  (x.inicio_periodo + interval '6 months')::date as disfrutar_antes_de    -- art. 81: dentro de los 6 meses siguientes
from public.empleados e
cross join lateral (
  select extract(year from age(current_date, e.fecha_ingreso))::int anios,
         (e.fecha_ingreso + make_interval(years => extract(year from age(current_date, e.fecha_ingreso))::int))::date inicio_periodo
) x
cross join lateral (
  select coalesce(sum(i.dias) filter (where i.estado = 'aprobada'), 0) tomados,
         coalesce(sum(i.dias) filter (where i.estado = 'solicitada'), 0) solicitados
  from public.incidencias i
  where i.empleado_id = e.id and i.tipo = 'vacaciones' and i.inicio >= x.inicio_periodo
) t
where e.activo;

-- ----------------------------------------------------------------------------
-- Finanzas
-- ----------------------------------------------------------------------------
-- Cobranza con antigüedad. La antigüedad corre desde la primera factura (o el
-- pedido si aún no se factura); "vence" suma los días de crédito del cliente.
create or replace view public.v_cobranza with (security_invoker = true) as
select s.pedido_id, s.folio, s.cliente_id, c.nombre as cliente, s.vendedor_id, v.nombre as vendedor, p.canal,
  s.fecha, s.estado, s.moneda, s.total, s.cobrado, s.saldo, s.facturado,
  f.primera_factura, f.facturas, coalesce(f.facturado_monto, 0) as facturado_monto, uc.ultimo_cobro,
  c.dias_credito,
  coalesce(f.primera_factura, s.fecha) as fecha_base,
  coalesce(f.primera_factura, s.fecha) + c.dias_credito as vence,
  current_date - coalesce(f.primera_factura, s.fecha) as dias,
  case when current_date - coalesce(f.primera_factura, s.fecha) <= 30 then '0-30'
       when current_date - coalesce(f.primera_factura, s.fecha) <= 60 then '31-60'
       when current_date - coalesce(f.primera_factura, s.fecha) <= 90 then '61-90'
       else '90+' end as rango,
  round(s.saldo * case when s.moneda = 'MXN' then 1 else tc(s.moneda) end, 2) as saldo_mxn,
  round(s.total * case when s.moneda = 'MXN' then 1 else tc(s.moneda) end, 2) as total_mxn
from public.v_saldos_pedido s
join public.pedidos p on p.id = s.pedido_id
join public.clientes c on c.id = s.cliente_id
left join public.perfiles v on v.id = s.vendedor_id
left join lateral (
  select min(x.fecha) primera_factura, string_agg(x.folio, ', ' order by x.fecha) facturas, sum(x.total) facturado_monto
  from public.facturas x where x.pedido_id = s.pedido_id
) f on true
left join lateral (select max(x.fecha) ultimo_cobro from public.cobros x where x.pedido_id = s.pedido_id) uc on true;

-- Cobrado y facturado por mes, en pesos (al tipo de cambio del pedido, como ventas_por_mes).
create or replace function public.cobranza_por_mes(p_meses int default 12)
returns table (mes date, cobrado numeric, facturado numeric, cobros bigint)
language sql stable security invoker as $$
  with m as (
    select g::date mes from generate_series(date_trunc('month', current_date) - make_interval(months => p_meses - 1),
                                            date_trunc('month', current_date), interval '1 month') g
  )
  select m.mes,
    coalesce((select sum(c.monto * p.tipo_cambio) from cobros c join pedidos p on p.id = c.pedido_id
              where c.fecha >= m.mes and c.fecha < m.mes + interval '1 month'), 0),
    coalesce((select sum(f.total * p.tipo_cambio) from facturas f join pedidos p on p.id = f.pedido_id
              where f.fecha >= m.mes and f.fecha < m.mes + interval '1 month'), 0),
    (select count(*) from cobros c where c.fecha >= m.mes and c.fecha < m.mes + interval '1 month')
  from m order by m.mes
$$;

-- Un cobro que deja el pedido pagado de más casi siempre es un dedazo o el
-- cobro de otro pedido. La devolución (monto negativo) sí pasa.
create or replace function public.validar_cobro() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_p pedidos; v_cobrado numeric;
begin
  select * into v_p from pedidos where id = new.pedido_id;
  if v_p.estado = 'cancelado' and new.monto > 0 then
    raise exception 'El pedido % está cancelado: no se le registran cobros', v_p.folio;
  end if;
  select coalesce(sum(monto), 0) into v_cobrado from cobros where pedido_id = new.pedido_id;
  if new.monto > 0 and v_cobrado > v_p.total + 1 then
    raise exception 'Con este cobro el pedido % quedaría pagado de más: total %, cobrado %. ¿Es de otro pedido?',
      v_p.folio, to_char(v_p.total, 'FM$999,999,990.00'), to_char(v_cobrado, 'FM$999,999,990.00');
  end if;
  return null;
end $$;
drop trigger if exists validar on public.cobros;
create trigger validar after insert or update on public.cobros for each row execute function public.validar_cobro();

create or replace function public.validar_factura() returns trigger
language plpgsql set search_path = public as $$
begin
  new.folio := trim(new.folio);
  new.uuid_sat := nullif(upper(trim(coalesce(new.uuid_sat, ''))), '');
  if new.folio = '' then raise exception 'La factura necesita folio'; end if;
  if new.uuid_sat is not null and new.uuid_sat !~ '^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$' then
    raise exception 'El UUID del SAT son 36 caracteres en grupos 8-4-4-4-12 (números y letras A–F)';
  end if;
  if new.total <= 0 then raise exception 'El total de la factura debe ser mayor a cero'; end if;
  return new;
end $$;
drop trigger if exists validar on public.facturas;
create trigger validar before insert or update on public.facturas for each row execute function public.validar_factura();

-- Pagos a proveedores: nunca más de lo que se debe, ni a una orden que no existe en firme.
create or replace function public.validar_pago_proveedor() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_o ordenes_compra; v_pagado numeric;
begin
  select * into v_o from ordenes_compra where id = new.orden_compra_id;
  if v_o.estado in ('borrador', 'cancelada') then
    raise exception 'La orden % está en %: no se le registran pagos', v_o.folio, v_o.estado;
  end if;
  select coalesce(sum(monto), 0) into v_pagado from pagos_proveedor where orden_compra_id = new.orden_compra_id;
  if v_pagado > v_o.total + 1 then
    raise exception 'Con este pago la orden % quedaría pagada de más: total %, pagado %',
      v_o.folio, to_char(v_o.total, 'FM$999,999,990.00'), to_char(v_pagado, 'FM$999,999,990.00');
  end if;
  return null;
end $$;
drop trigger if exists validar on public.pagos_proveedor;
create trigger validar after insert or update on public.pagos_proveedor for each row execute function public.validar_pago_proveedor();

-- Cuentas por pagar con lo que la agenda necesita: saldo en pesos y días para vencer.
create or replace view public.v_por_pagar with (security_invoker = true) as
select cp.orden_compra_id, cp.folio, cp.proveedor_id, cp.proveedor, cp.fecha, cp.vence_pago, cp.moneda, cp.total,
  cp.pagado, cp.saldo, cp.factura_proveedor, pr.dias_credito, pr.categoria, pr.datos_bancarios,
  round(cp.saldo * case when cp.moneda = 'MXN' then 1 else tc(cp.moneda) end, 2) as saldo_mxn,
  cp.vence_pago - current_date as dias_para_vencer,
  (select max(x.fecha) from public.pagos_proveedor x where x.orden_compra_id = cp.orden_compra_id) as ultimo_pago
from public.v_cuentas_por_pagar cp
join public.proveedores pr on pr.id = cp.proveedor_id
where cp.saldo > 0;

notify pgrst, 'reload schema';

-- =============================================================================
-- Avisos automáticos y pendientes entre áreas.
--
-- Del análisis del chat interno (30 mil mensajes): 608 avisos de "ya llegó"
-- escritos a mano, 76 de "hoy vienen por el equipo", 326 insistencias ("??",
-- "¿alguna respuesta?") y recordatorios usados como empujón. La información ya
-- estaba en el sistema; faltaba que llegara sola a quien le importa.
--
--  - avisos: lo que le pasó a un registro que le importa a una persona. Los crea
--    la base con disparadores (nadie los escribe a mano) y cada quien ve los suyos.
--  - pendientes: "te toca a ti, para tal día", ligados al pedido, la orden o el
--    cliente. Quien lo pide ve si ya se hizo sin tener que preguntar.
--  - canales externos (Cliq): opcional y apagado. La dirección del webhook es un
--    secreto: va en Vault, no en `configuracion` (que leen todos).
-- =============================================================================

create table if not exists public.avisos (
  id bigserial primary key,
  usuario_id uuid not null references public.perfiles(id) on delete cascade,
  tipo text not null,
  titulo text not null,
  cuerpo text,
  ruta text,
  tabla text,
  registro_id text,
  leido_en timestamptz,
  creado_en timestamptz not null default now()
);
create index if not exists avisos_bandeja on public.avisos (usuario_id, creado_en desc);
create index if not exists avisos_sin_leer on public.avisos (usuario_id) where leido_en is null;

create table if not exists public.pendientes (
  id uuid primary key default gen_random_uuid(),
  titulo text not null check (length(trim(titulo)) > 0),
  detalle text,
  responsable_id uuid not null references public.perfiles(id),
  creado_por uuid not null default auth.uid() references public.perfiles(id),
  vence date,
  estado text not null default 'abierto' check (estado in ('abierto', 'hecho', 'cancelado')),
  tabla text,
  registro_id text,
  ruta text,
  nota_cierre text,
  cerrado_por uuid references public.perfiles(id),
  cerrado_en timestamptz,
  creado_en timestamptz not null default now()
);
create index if not exists pendientes_responsable on public.pendientes (responsable_id, estado, vence);
create index if not exists pendientes_creador on public.pendientes (creado_por, estado);
create index if not exists pendientes_registro on public.pendientes (tabla, registro_id);

alter table public.avisos enable row level security;
alter table public.pendientes enable row level security;

-- Avisos: cada quien los suyos; solo puede marcarlos leídos. Los crea la base.
drop policy if exists ver on public.avisos;
create policy ver on public.avisos for select to authenticated using (usuario_id = (select auth.uid()));
drop policy if exists leer on public.avisos;
create policy leer on public.avisos for update to authenticated
  using (usuario_id = (select auth.uid())) with check (usuario_id = (select auth.uid()));
revoke update on public.avisos from authenticated;
grant update (leido_en) on public.avisos to authenticated;

-- Pendientes: los ve quien lo tiene y quien lo pidió (y dirección, para destrabar).
drop policy if exists ver on public.pendientes;
create policy ver on public.pendientes for select to authenticated using (
  responsable_id = (select auth.uid()) or creado_por = (select auth.uid()) or (select tiene_rol('direccion')));
drop policy if exists alta on public.pendientes;
create policy alta on public.pendientes for insert to authenticated with check (
  creado_por = (select auth.uid()) and (select cardinality(mis_roles())) > 0);
drop policy if exists cambio on public.pendientes;
create policy cambio on public.pendientes for update to authenticated using (
  responsable_id = (select auth.uid()) or creado_por = (select auth.uid()));

-- Quién puede cambiar qué de un pendiente: el responsable lo cierra; quien lo pidió
-- lo edita o lo cancela. Uno cerrado ya no se mueve (la historia no se reescribe).
create or replace function public.pendiente_reglas() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_yo uuid := auth.uid();
begin
  if v_yo is null then return new; end if;  -- funciones internas y migraciones
  if old.estado <> 'abierto' then raise exception 'Este pendiente ya se cerró' using errcode = '42501'; end if;
  if new.creado_por is distinct from old.creado_por then raise exception 'No se cambia quién pidió el pendiente' using errcode = '42501'; end if;
  if v_yo <> old.creado_por and (new.titulo, new.detalle, new.responsable_id, new.vence, new.tabla, new.registro_id, new.ruta)
       is distinct from (old.titulo, old.detalle, old.responsable_id, old.vence, old.tabla, old.registro_id, old.ruta) then
    raise exception 'Solo quien pidió el pendiente lo puede cambiar' using errcode = '42501';
  end if;
  if new.estado = 'cancelado' and v_yo <> old.creado_por then
    raise exception 'Solo quien pidió el pendiente lo puede cancelar' using errcode = '42501';
  end if;
  if new.estado <> 'abierto' then new.cerrado_por := v_yo; new.cerrado_en := now(); end if;
  return new;
end $$;
drop trigger if exists pendiente_reglas on public.pendientes;
create trigger pendiente_reglas before update on public.pendientes for each row execute function public.pendiente_reglas();

-- -----------------------------------------------------------------------------
-- Repartir avisos
-- -----------------------------------------------------------------------------

-- Usuarios activos que tienen un permiso (para "a quien autorice ajustes", etc.).
create or replace function public.usuarios_con_permiso(p_modulo text, p_nivel int) returns setof uuid
language sql stable security definer set search_path = public as $$
  select distinct ur.usuario_id from usuario_roles ur
  join permisos_rol pr on pr.rol = ur.rol and pr.modulo = p_modulo and pr.nivel >= p_nivel
  join perfiles p on p.id = ur.usuario_id and p.activo
$$;

create or replace function public.usuarios_con_rol(p_rol public.app_rol) returns setof uuid
language sql stable security definer set search_path = public as $$
  select ur.usuario_id from usuario_roles ur join perfiles p on p.id = ur.usuario_id and p.activo where ur.rol = p_rol
$$;

-- Crea el aviso para cada destinatario, menos para quien lo provocó (nadie necesita
-- que le avisen de lo que acaba de hacer). p_una_vez evita repetir el mismo aviso
-- del mismo registro en 24 h (para los recordatorios periódicos).
create or replace function public.avisar(p_usuarios uuid[], p_tipo text, p_titulo text, p_cuerpo text,
  p_ruta text, p_tabla text, p_registro text, p_una_vez boolean default false) returns int
language plpgsql security definer set search_path = public as $$
declare v_n int;
begin
  insert into avisos (usuario_id, tipo, titulo, cuerpo, ruta, tabla, registro_id)
  select distinct u, p_tipo, p_titulo, p_cuerpo, p_ruta, p_tabla, p_registro
  from unnest(p_usuarios) u
  where u is not null and u is distinct from auth.uid()
    and not (p_una_vez and exists (select 1 from avisos a where a.usuario_id = u and a.tipo = p_tipo
                                   and a.registro_id = p_registro and a.creado_en > now() - interval '24 hours'));
  get diagnostics v_n = row_count;
  return v_n;
end $$;
revoke execute on function public.avisar(uuid[], text, text, text, text, text, text, boolean) from public, anon, authenticated;

-- Canales externos: { "canales": { "almacen": "cliq_almacen", … } } dice qué secreto de
-- Vault tiene la dirección del webhook de cada canal. Sin secreto, no se manda nada.
insert into public.configuracion (clave, valor, descripcion) values
  ('avisos_canales', '{"activo": false, "canales": {}}',
   'Avisos también en Cliq. "canales" liga un canal (almacen, pedidos, compras, produccion) con el nombre del secreto en Vault que guarda la URL del webhook entrante de Cliq. La URL lleva la llave del canal: por eso no va aquí.')
on conflict (clave) do nothing;

do $$ begin
  create extension if not exists pg_net with schema extensions;
exception when others then
  raise notice 'pg_net no está disponible: los avisos a Cliq quedan apagados (%).', sqlerrm;
end $$;

create or replace function public.publicar_en_canal(p_canal text, p_texto text) returns void
language plpgsql security definer set search_path = public as $$
declare v_cfg jsonb; v_secreto text; v_url text;
begin
  select valor into v_cfg from configuracion where clave = 'avisos_canales';
  if not coalesce((v_cfg->>'activo')::boolean, false) then return; end if;
  v_secreto := v_cfg #>> array['canales', p_canal];
  if v_secreto is null then return; end if;
  select decrypted_secret into v_url from vault.decrypted_secrets where name = v_secreto;
  if v_url is null then return; end if;
  -- Asíncrono: si Cliq tarda o falla, la operación del ERP no se entera ni se detiene.
  perform net.http_post(url := v_url, body := jsonb_build_object('text', left(p_texto, 4000)));
exception when others then
  raise notice 'No se pudo publicar en el canal %: %', p_canal, sqlerrm;
end $$;
revoke execute on function public.publicar_en_canal(text, text) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Eventos que avisan solos
-- -----------------------------------------------------------------------------

-- Llegó material: a quien lo pidió (requisición), y al canal de almacén.
create or replace function public.aviso_oc_recibida() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_dest uuid[]; v_prov text;
begin
  if new.estado not in ('parcial', 'recibida') or old.estado = new.estado then return new; end if;
  select array_agg(distinct r.solicitante_id) into v_dest
  from oc_lineas l join requisicion_lineas rl on rl.oc_linea_id = l.id join requisiciones r on r.id = rl.requisicion_id
  where l.orden_compra_id = new.id;
  select nombre into v_prov from proveedores where id = new.proveedor_id;
  perform avisar(v_dest, 'oc_recibida',
    format('Llegó material de %s', new.folio),
    format('%s · %s', v_prov, case new.estado when 'recibida' then 'completa' else 'llegó una parte' end),
    '/compras/ordenes/' || new.id, 'ordenes_compra', new.id::text);
  perform publicar_en_canal('almacen', format('📦 Llegó %s de %s (%s).', new.folio, v_prov,
    case new.estado when 'recibida' then 'completa' else 'parcial' end));
  return new;
end $$;
drop trigger if exists aviso_oc_recibida on public.ordenes_compra;
create trigger aviso_oc_recibida after update of estado on public.ordenes_compra
  for each row execute function public.aviso_oc_recibida();

-- Orden de producción nueva: a ingeniería y almacén, que la validan.
-- Terminada: al vendedor del pedido. Entregada: también, para que no pregunte.
create or replace function public.aviso_orden_produccion() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_equipo text; v_cliente text; v_vendedor uuid; v_pedido text;
begin
  select a.nombre into v_equipo from articulos a where a.id = new.articulo_id;
  select c.nombre, p.vendedor_id, p.folio into v_cliente, v_vendedor, v_pedido
  from pedidos p left join clientes c on c.id = p.cliente_id where p.id = new.pedido_id;
  if tg_op = 'INSERT' then
    perform avisar(array(select usuarios_con_rol('ingenieria') union select usuarios_con_rol('almacen')),
      'op_por_validar', format('Orden %s por validar', new.folio),
      format('%s%s', v_equipo, coalesce(' · ' || v_cliente, ' · para stock')),
      '/produccion/ordenes/' || new.id, 'ordenes_produccion', new.id::text);
  elsif new.estado is distinct from old.estado and new.estado in ('terminada', 'entregada') then
    perform avisar(array[v_vendedor], 'op_' || new.estado::text,
      format('%s: %s', case new.estado when 'terminada' then 'Terminado' else 'Entregado' end, v_equipo),
      format('%s%s%s', new.folio, coalesce(' · ' || v_cliente, ''), coalesce(' · pedido ' || v_pedido, '')),
      '/produccion/ordenes/' || new.id, 'ordenes_produccion', new.id::text);
    if new.estado = 'terminada' then
      perform publicar_en_canal('pedidos', format('✅ Terminado %s (%s)%s.', v_equipo, new.folio, coalesce(' para ' || v_cliente, '')));
    end if;
  end if;
  return new;
end $$;
drop trigger if exists aviso_orden_produccion on public.ordenes_produccion;
create trigger aviso_orden_produccion after insert or update of estado on public.ordenes_produccion
  for each row execute function public.aviso_orden_produccion();

-- Ajuste de inventario: a quien puede autorizarlo; resuelto: a quien lo pidió.
create or replace function public.aviso_ajuste() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_art text;
begin
  select nombre into v_art from articulos where id = new.articulo_id;
  if tg_op = 'INSERT' and new.estado = 'pendiente' then
    perform avisar(array(select usuarios_con_permiso('inventario', 3) union select usuarios_con_rol('direccion')
                         union select usuarios_con_rol('gerente_produccion')
                         except select new.solicitado_por),
      'ajuste_por_autorizar', format('Ajuste %s por autorizar', coalesce(new.folio, '')),
      format('%s: de %s a %s. %s', v_art, new.cantidad_sistema, new.cantidad_fisica, coalesce(new.motivo, '')),
      '/almacen/movimientos?vista=ajustes', 'ajustes_inventario', new.id::text);
  elsif tg_op = 'UPDATE' and old.estado = 'pendiente' and new.estado <> 'pendiente' then
    perform avisar(array[new.solicitado_por], 'ajuste_' || new.estado,
      format('Ajuste %s %s', coalesce(new.folio, ''), new.estado), format('%s. %s', v_art, coalesce(new.comentario, '')),
      '/almacen/movimientos?vista=ajustes', 'ajustes_inventario', new.id::text);
  end if;
  return new;
end $$;
drop trigger if exists aviso_ajuste on public.ajustes_inventario;
create trigger aviso_ajuste after insert or update of estado on public.ajustes_inventario
  for each row execute function public.aviso_ajuste();

-- Cotización: el vendedor pide autorización → gerencia; la autorizan → vendedor.
-- (Se usa la fecha de la solicitud y no el estado, que se recalcula con cada partida.)
create or replace function public.aviso_cotizacion() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_cliente text;
begin
  select nombre into v_cliente from clientes where id = new.cliente_id;
  if new.autorizacion_pedida_en is distinct from old.autorizacion_pedida_en and new.autorizacion_pedida_en is not null then
    perform avisar(array(select usuarios_con_permiso('ventas', 3)), 'cotizacion_por_autorizar',
      format('%s pide autorización de precio', new.folio),
      format('%s%s', coalesce(v_cliente, new.empresa, 'Cliente'), coalesce('. ' || new.nota_autorizacion, '')),
      '/ventas/cotizaciones/' || new.id, 'cotizaciones', new.id::text);
  end if;
  if new.autorizada_en is distinct from old.autorizada_en and new.autorizada_en is not null then
    perform avisar(array[new.vendedor_id], 'cotizacion_autorizada', format('%s autorizada', new.folio),
      coalesce(v_cliente, new.empresa), '/ventas/cotizaciones/' || new.id, 'cotizaciones', new.id::text);
  end if;
  return new;
end $$;
drop trigger if exists aviso_cotizacion on public.cotizaciones;
create trigger aviso_cotizacion after update of autorizacion_pedida_en, autorizada_en on public.cotizaciones
  for each row execute function public.aviso_cotizacion();

-- Requisición nueva: a compras.
create or replace function public.aviso_requisicion() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_quien text;
begin
  select nombre into v_quien from perfiles where id = new.solicitante_id;
  perform avisar(array(select usuarios_con_permiso('compras', 2)), 'requisicion_nueva',
    format('Requisición %s', coalesce(new.folio, 'nueva')),
    format('%s%s', coalesce(v_quien, 'Alguien'), coalesce(' · necesaria para el ' || to_char(new.necesaria_para, 'DD/MM'), '')),
    '/compras/ordenes?vista=requisiciones', 'requisiciones', new.id::text);
  return new;
end $$;
drop trigger if exists aviso_requisicion on public.requisiciones;
create trigger aviso_requisicion after insert on public.requisiciones
  for each row execute function public.aviso_requisicion();

-- Pedido nuevo: a gerencia de producción y almacén (sin montos).
create or replace function public.aviso_pedido() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_cliente text;
begin
  if new.historico then return new; end if;
  select nombre into v_cliente from clientes where id = new.cliente_id;
  perform avisar(array(select usuarios_con_rol('gerente_produccion') union select usuarios_con_rol('almacen')),
    'pedido_nuevo', format('Pedido nuevo %s', new.folio),
    format('%s%s', coalesce(v_cliente, 'Cliente'), coalesce(' · compromiso ' || to_char(new.fecha_compromiso, 'DD/MM'), '')),
    -- Almacén no entra a ventas: los dos sí ven las órdenes que salen del pedido.
    '/produccion/ordenes', 'pedidos', new.id::text);
  perform publicar_en_canal('pedidos', format('🧾 Pedido nuevo %s de %s.', new.folio, coalesce(v_cliente, 'cliente')));
  return new;
end $$;
drop trigger if exists aviso_pedido on public.pedidos;
create trigger aviso_pedido after insert on public.pedidos for each row execute function public.aviso_pedido();

-- Cobro: al vendedor del pedido (su comisión depende de eso).
create or replace function public.aviso_cobro() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_folio text; v_vend uuid; v_cliente text; v_moneda text;
begin
  select p.folio, p.vendedor_id, c.nombre, p.moneda::text into v_folio, v_vend, v_cliente, v_moneda
  from pedidos p left join clientes c on c.id = p.cliente_id where p.id = new.pedido_id;
  perform avisar(array[v_vend], 'cobro', format('Pago de %s', coalesce(v_cliente, 'cliente')),
    format('%s %s · %s', texto_dinero(new.monto), coalesce(nullif(v_moneda, 'MXN'), ''), v_folio),
    '/ventas/pedidos/' || new.pedido_id, 'cobros', new.id::text);
  return new;
end $$;
drop trigger if exists aviso_cobro on public.cobros;
create trigger aviso_cobro after insert on public.cobros for each row execute function public.aviso_cobro();

-- Vacaciones y permisos: a RRHH; resueltos, a quien los pidió.
create or replace function public.aviso_incidencia() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_emp text;
begin
  select nombre into v_emp from empleados where id = new.empleado_id;
  if tg_op = 'INSERT' and new.estado = 'solicitada' then
    perform avisar(array(select usuarios_con_permiso('rrhh', 3)), 'incidencia_por_aprobar',
      format('%s pide %s', v_emp, replace(new.tipo, '_', ' ')),
      format('Del %s al %s', to_char(new.inicio, 'DD/MM'), to_char(coalesce(new.fin, new.inicio), 'DD/MM')),
      '/rrhh/incidencias', 'incidencias', new.id::text);
  elsif tg_op = 'UPDATE' and old.estado = 'solicitada' and new.estado <> 'solicitada' then
    perform avisar(array[new.solicitada_por], 'incidencia_' || new.estado,
      format('%s: %s %s', v_emp, replace(new.tipo, '_', ' '), new.estado),
      format('Del %s al %s', to_char(new.inicio, 'DD/MM'), to_char(coalesce(new.fin, new.inicio), 'DD/MM')),
      '/rrhh/incidencias', 'incidencias', new.id::text);
  end if;
  return new;
end $$;
drop trigger if exists aviso_incidencia on public.incidencias;
create trigger aviso_incidencia after insert or update of estado on public.incidencias
  for each row execute function public.aviso_incidencia();

-- Pendientes: al responsable cuando se lo asignan; a quien lo pidió cuando se cierra.
create or replace function public.aviso_pendiente() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_de text;
begin
  if tg_op = 'INSERT' or new.responsable_id is distinct from old.responsable_id then
    select nombre into v_de from perfiles where id = new.creado_por;
    perform avisar(array[new.responsable_id], 'pendiente_nuevo', new.titulo,
      format('De %s%s', coalesce(v_de, 'alguien'), coalesce(' · para el ' || to_char(new.vence, 'DD/MM'), '')),
      coalesce(new.ruta, '/pendientes'), 'pendientes', new.id::text);
  elsif new.estado <> old.estado and new.estado = 'hecho' then
    select nombre into v_de from perfiles where id = new.cerrado_por;
    perform avisar(array[new.creado_por], 'pendiente_hecho', 'Listo: ' || new.titulo,
      format('%s%s', coalesce(v_de, ''), coalesce(' · ' || new.nota_cierre, '')),
      coalesce(new.ruta, '/pendientes'), 'pendientes', new.id::text);
  end if;
  return new;
end $$;
drop trigger if exists aviso_pendiente on public.pendientes;
create trigger aviso_pendiente after insert or update on public.pendientes
  for each row execute function public.aviso_pendiente();

-- -----------------------------------------------------------------------------
-- Recordatorios periódicos (pg_cron cada 30 min): lo que se atora sin que nadie
-- lo note. Validaciones de más de 4 horas y pendientes vencidos.
-- -----------------------------------------------------------------------------
create or replace function public.avisos_periodicos() returns int
language plpgsql security definer set search_path = public as $$
declare v_n int := 0; r record;
begin
  for r in select o.id, o.folio, a.nombre equipo, o.revisado_ingenieria_en, o.revisado_almacen_en
           from ordenes_produccion o join articulos a on a.id = o.articulo_id
           where o.estado = 'planeada' and o.creado_en < now() - interval '4 hours'
             and (o.revisado_ingenieria_en is null or o.revisado_almacen_en is null) loop
    if r.revisado_ingenieria_en is null then
      v_n := v_n + avisar(array(select usuarios_con_rol('ingenieria')), 'op_validacion_atorada',
        format('%s lleva más de 4 h sin revisión de ingeniería', r.folio), r.equipo,
        '/produccion/ordenes/' || r.id, 'ordenes_produccion', r.id::text, true);
    end if;
    if r.revisado_almacen_en is null then
      v_n := v_n + avisar(array(select usuarios_con_rol('almacen')), 'op_validacion_atorada',
        format('%s lleva más de 4 h sin revisión de almacén', r.folio), r.equipo,
        '/produccion/ordenes/' || r.id, 'ordenes_produccion', r.id::text, true);
    end if;
  end loop;
  for r in select * from pendientes where estado = 'abierto' and vence < (now() at time zone 'America/Mexico_City')::date loop
    v_n := v_n + avisar(array[r.responsable_id, r.creado_por], 'pendiente_vencido', 'Vencido: ' || r.titulo,
      format('Era para el %s', to_char(r.vence, 'DD/MM')), coalesce(r.ruta, '/pendientes'), 'pendientes', r.id::text, true);
  end loop;
  return v_n;
end $$;
revoke execute on function public.avisos_periodicos() from public, anon, authenticated;

do $$ begin
  perform cron.unschedule('avisos-periodicos') where exists (select 1 from cron.job where jobname = 'avisos-periodicos');
  perform cron.schedule('avisos-periodicos', '*/30 * * * *', 'select public.avisos_periodicos()');
exception when others then
  raise notice 'pg_cron no está disponible: los recordatorios periódicos quedan apagados (%).', sqlerrm;
end $$;

-- Marcar leídos de una vez.
create or replace function public.marcar_avisos_leidos(p_ids bigint[] default null) returns int
language sql security invoker as $$
  with x as (update avisos set leido_en = now()
             where usuario_id = auth.uid() and leido_en is null and (p_ids is null or id = any(p_ids)) returning 1)
  select count(*)::int from x
$$;

-- Los avisos llegan en vivo a la campana.
do $$ begin
  alter publication supabase_realtime add table public.avisos;
exception when duplicate_object then null; when undefined_object then null;
end $$;
do $$ begin
  alter publication supabase_realtime add table public.pendientes;
exception when duplicate_object then null; when undefined_object then null;
end $$;

select public.optimizar_politicas();

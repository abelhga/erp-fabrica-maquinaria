-- =============================================================================
-- Servicio postventa y mantenimiento de maquinaria y herramienta.
--
-- Del análisis del chat interno (§2.9, §2.10 y propuestas 5 y 6):
--  * Instalaciones, puestas en marcha, garantías y reparaciones se piden por chat;
--    producción arma cuadrilla, viáticos e insumos por chat y lo apunta en un
--    calendario de Drive. En abril de 2026 producción dijo que los servicios no
--    considerados fueron una de las tres causas de atraso y que "no podemos juntar
--    2 instalaciones al mismo tiempo". La carga del taller no los veía.
--  * El canal para fotografiar equipos que llegan a reparación tiene 3 mensajes y
--    ninguna foto.
--  * ≈35 reportes de falla de herramienta y equipo propio (soldadoras numeradas,
--    rectificadores, taladros, compresor, torno, roladora, montacargas,
--    conmutador), un solo preventivo documentado y dos canales de mantenimiento
--    abandonados. La herramienta prestada no se regresa.
--
-- Lo que la base hace cumplir:
--  * Una persona no puede estar en dos servicios que se enciman (restricción de
--    exclusión, más un mensaje que dice con quién choca), ni salir a servicio
--    con vacaciones o incapacidad aprobadas.
--  * Las horas de cuadrilla (campo y reparación en planta) se descuentan de la
--    capacidad semanal del área de cada persona: carga_semanal(). v_carga_etapas
--    no se toca.
--  * Una garantía va ligada al pedido y al número de serie que se entregó.
--  * Un equipo que llega a reparación no se recibe sin fotos, y una reparación en
--    planta no empieza sin recepción. Un servicio no se cierra sin foto, sin el
--    nombre de quien recibe y sin notas.
--  * Las refacciones e insumos salen de almacén con registrar_salida() (el
--    movimiento queda con el folio) o se piden a compras como requisición.
--  * El preventivo vencido genera su orden solo (pg_cron diario y al registrar
--    horas de uso), una sola vez por vencimiento.
--  * Los costos (viáticos, refacciones, servicios externos) viven en su propia
--    tabla. Ventas, el taller y almacén no los ven; el costo de las refacciones
--    de almacén solo lo ve quien tiene "costos" (es el costo del artículo).
--  * La evidencia no se borra: ni las fotos del bucket privado "servicio" ni su
--    registro.
--  * El taller reporta fallas y presta herramienta; cerrar una orden de
--    mantenimiento es de la gerencia. Ventas pide servicios para sus clientes,
--    pero no programa ni cierra.
-- =============================================================================

create extension if not exists btree_gist with schema extensions;

-- -----------------------------------------------------------------------------
-- Permisos y configuración
-- -----------------------------------------------------------------------------
-- Nivel 1 ver · 2 capturar (pedir servicio, reportar falla, prestar herramienta,
-- surtir) · 3 administrar (programar, cerrar mantenimiento, costos y catálogo).
insert into public.permisos_rol (rol, modulo, nivel) values
  ('gerente_produccion', 'servicio', 3), ('direccion', 'servicio', 3),
  ('produccion', 'servicio', 2), ('ventas', 'servicio', 2), ('almacen', 'servicio', 2),
  ('compras', 'servicio', 1)
on conflict (rol, modulo) do nothing;

insert into public.configuracion (clave, valor, descripcion) values
  ('servicio', '{"jornada_inicio": "08:30", "horas_jornada": 9, "meses_garantia": 12, "dias_herramienta": 7}',
   'Servicio y mantenimiento. jornada_inicio y horas_jornada (lunes a viernes) dicen cuántas horas de taller se pierden por cada persona que sale a servicio; meses_garantia, cuánto dura la garantía desde la entrega; dias_herramienta, a partir de cuántos días una herramienta prestada se marca como "sin regresar".')
on conflict (clave) do nothing;

-- -----------------------------------------------------------------------------
-- Quién es quién en servicio
-- -----------------------------------------------------------------------------
-- Gerencia, o personal de producción (el jefe de cuadrilla, almacén). Ventas tiene
-- servicio 2 para pedir, pero producción 1: no inicia ni cierra servicios.
create or replace function public.es_personal_servicio() returns boolean
language sql stable security definer set search_path = public as $$
  select puede('servicio', 3) or (puede('servicio', 2) and puede('produccion', 2))
$$;

-- Ventas ve los servicios de sus clientes (los suyos y los libres) y los que pidió;
-- el resto del personal con servicio los ve todos.
create or replace function public.ve_todos_los_servicios() returns boolean
language sql stable security definer set search_path = public as $$
  select puede('servicio', 3) or (puede('servicio', 1) and not puede('ventas', 1))
$$;

create or replace function public.nombre_tipo_servicio(p_tipo text) returns text
language sql immutable as $$
  select case p_tipo when 'instalacion' then 'Instalación' when 'puesta_en_marcha' then 'Puesta en marcha'
    when 'garantia' then 'Garantía' when 'reparacion_planta' then 'Reparación en planta'
    when 'servicio_campo' then 'Servicio en campo' else p_tipo end
$$;

-- Personal para armar cuadrillas: nombre, puesto y área. La tabla empleados la ve
-- RRHH (trae datos personales); el taller y ventas necesitan solo esto.
create or replace function public.personal_servicio()
returns table (id uuid, numero text, nombre text, puesto text, etapa_id int, etapa text, etapa_color text, departamento text, activo boolean)
language sql stable security definer set search_path = public as $$
  select e.id, e.numero, e.nombre, e.puesto, e.etapa_id, et.nombre, et.color, d.nombre, e.activo
  from empleados e
  left join etapas et on et.id = e.etapa_id
  left join departamentos d on d.id = e.departamento_id
  where puede('servicio', 1) or puede('produccion', 1)
  order by et.orden nulls last, e.nombre
$$;

-- Horas de taller (lunes a viernes, jornada de configuracion.servicio) que caen
-- dentro de un periodo. Es lo que una persona deja de trabajar en el taller.
create or replace function public.horas_laborables(p_desde timestamptz, p_hasta timestamptz)
returns table (dia date, horas numeric)
language sql stable set search_path = public as $$
  with cfg as (
    select coalesce((select (valor->>'jornada_inicio')::time from configuracion where clave = 'servicio'), time '08:30') ini,
           coalesce((select (valor->>'horas_jornada')::numeric from configuracion where clave = 'servicio'), 9) h
  ),
  d as (
    select g::date dia
    from generate_series((p_desde at time zone 'America/Mexico_City')::date,
                         (p_hasta at time zone 'America/Mexico_City')::date, interval '1 day') g
    where p_hasta > p_desde
  ),
  j as (
    select d.dia, (d.dia + cfg.ini) at time zone 'America/Mexico_City' a,
           (d.dia + cfg.ini + cfg.h * interval '1 hour') at time zone 'America/Mexico_City' b
    from d, cfg where extract(isodow from d.dia) <= 5
  )
  select j.dia, round((extract(epoch from least(p_hasta, j.b) - greatest(p_desde, j.a)) / 3600.0)::numeric, 2)
  from j where least(p_hasta, j.b) > greatest(p_desde, j.a)
$$;

-- -----------------------------------------------------------------------------
-- Servicio postventa
-- -----------------------------------------------------------------------------
create table if not exists public.servicios (
  id uuid primary key default gen_random_uuid(),
  folio text not null default '' unique,
  tipo text not null check (tipo in ('instalacion', 'puesta_en_marcha', 'garantia', 'reparacion_planta', 'servicio_campo')),
  estado text not null default 'solicitada' check (estado in ('solicitada', 'programada', 'en_curso', 'cerrada', 'cancelada')),
  prioridad int not null default 2 check (prioridad between 1 and 3),
  cliente_id uuid not null references public.clientes(id),
  pedido_id uuid references public.pedidos(id),
  orden_produccion_id uuid references public.ordenes_produccion(id),   -- el equipo: su número de serie
  numero_serie text,
  equipo text,
  descripcion text not null check (length(trim(descripcion)) >= 5),
  referencia text,                                  -- número de reporte u orden del cliente
  lugar text,                                       -- dónde (servicio en campo)
  contacto_nombre text,
  contacto_telefono text,
  fecha_deseada date,
  solicitado_por uuid default auth.uid() references public.perfiles(id),
  solicitado_en timestamptz not null default now(),
  -- Programación: el periodo en que la cuadrilla está ocupada (en campo o en el equipo).
  inicio timestamptz,
  fin timestamptz,
  programado_por uuid references public.perfiles(id),
  programado_en timestamptz,
  -- Recepción de un equipo que llega a la planta.
  recibido_en timestamptz,
  recibido_por uuid references public.perfiles(id),
  condicion_recepcion text,
  -- Ejecución y cierre.
  iniciado_en timestamptz,
  cerrado_en timestamptz,
  cerrado_por uuid references public.perfiles(id),
  recibio_nombre text,
  firma_ruta text,
  notas_cierre text,
  garantia_procede boolean,                         -- dictamen al cerrar una garantía
  cancelado_en timestamptz,
  motivo_cancelacion text,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  check (fin is null or (inicio is not null and fin > inicio)),
  check (tipo <> 'garantia' or (pedido_id is not null and orden_produccion_id is not null))
);
create index if not exists servicios_estado on public.servicios (estado, inicio);
create index if not exists servicios_cliente on public.servicios (cliente_id);
create index if not exists servicios_op on public.servicios (orden_produccion_id) where orden_produccion_id is not null;

-- Cuadrilla: una fila por persona con el periodo copiado del servicio. La exclusión
-- es la garantía dura (dos programaciones al mismo tiempo no pasan); programar_servicio()
-- revisa antes para decir con qué servicio choca. etapa_id es el área de la que sale
-- la persona al programarla: de ahí se descuentan sus horas.
create table if not exists public.servicio_cuadrilla (
  servicio_id uuid not null references public.servicios(id) on delete cascade,
  empleado_id uuid not null references public.empleados(id),
  etapa_id int references public.etapas(id),
  jefe boolean not null default false,
  periodo tstzrange not null,
  vigente boolean not null default true,
  primary key (servicio_id, empleado_id),
  constraint cuadrilla_sin_traslape exclude using gist (empleado_id with =, periodo with &&) where (vigente)
);

-- -----------------------------------------------------------------------------
-- Maquinaria y herramienta propias
-- -----------------------------------------------------------------------------
create table if not exists public.maquinas (
  id uuid primary key default gen_random_uuid(),
  numero text not null unique,                      -- lo que está pintado en la máquina: "SOL-03"
  nombre text not null,
  tipo text not null default 'maquina' check (tipo in ('maquina', 'herramienta', 'vehiculo', 'instalacion')),
  categoria text not null,                          -- soldadora, rectificador, taladro, compresor…
  marca text,
  modelo text,
  numero_serie text,
  etapa_id int references public.etapas(id),        -- área del taller
  ubicacion text,
  estado text not null default 'operando'
    check (estado in ('operando', 'con_falla', 'en_mantenimiento', 'fuera_de_servicio', 'baja')),
  critica boolean not null default false,           -- si se para, se para el área
  prestable boolean not null default false,         -- se presta con resguardo
  usa_horometro boolean not null default false,
  horas_uso numeric(10,1) not null default 0 check (horas_uso >= 0),
  horas_actualizado_en timestamptz,
  foto_ruta text,
  fecha_alta date,
  notas text,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create table if not exists public.planes_preventivos (
  id uuid primary key default gen_random_uuid(),
  maquina_id uuid not null references public.maquinas(id) on delete cascade,
  nombre text not null,
  tareas text,
  cada_dias int check (cada_dias > 0),
  cada_horas numeric(10,1) check (cada_horas > 0),
  ultima_fecha date not null default current_date,
  ultima_horas numeric(10,1) not null default 0,
  anticipacion_dias int not null default 7 check (anticipacion_dias >= 0),
  activo boolean not null default true,
  creado_en timestamptz not null default now(),
  check (cada_dias is not null or cada_horas is not null)
);

create table if not exists public.ordenes_mantenimiento (
  id uuid primary key default gen_random_uuid(),
  folio text not null default '' unique,
  maquina_id uuid not null references public.maquinas(id),
  tipo text not null check (tipo in ('correctivo', 'preventivo')),
  estado text not null default 'pendiente' check (estado in ('pendiente', 'en_proceso', 'cerrada', 'cancelada')),
  falla text,                                       -- lo que vio quien reporta, o las tareas del plan
  detiene boolean not null default false,           -- la máquina quedó parada
  reportado_por uuid default auth.uid() references public.perfiles(id),
  reportado_por_nombre text,                        -- nombre de piso (la terminal es compartida)
  reportado_en timestamptz not null default now(),
  plan_id uuid references public.planes_preventivos(id) on delete set null,
  vence date,
  vence_horas numeric(10,1),
  diagnostico text,
  atendido_por text,                                -- quién la repara (del taller o externo)
  trabajo_realizado text,
  inicio_en timestamptz,
  cerrada_en timestamptz,
  cerrada_por uuid references public.perfiles(id),
  fuera_desde timestamptz,                          -- tiempo fuera de servicio
  fuera_hasta timestamptz,
  horas_uso_al_cerrar numeric(10,1),
  motivo_cancelacion text,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);
create index if not exists mantenimiento_maquina on public.ordenes_mantenimiento (maquina_id, reportado_en desc);
create index if not exists mantenimiento_abiertas on public.ordenes_mantenimiento (estado) where estado in ('pendiente', 'en_proceso');
-- Un vencimiento, una orden: generar_preventivos() puede correr cuantas veces sea.
create unique index if not exists mantenimiento_un_preventivo_abierto on public.ordenes_mantenimiento (plan_id)
  where estado in ('pendiente', 'en_proceso');

-- Insumos de un servicio y refacciones de un mantenimiento: salen de almacén o se piden a compras.
create table if not exists public.servicio_materiales (
  id uuid primary key default gen_random_uuid(),
  servicio_id uuid references public.servicios(id) on delete cascade,
  mantenimiento_id uuid references public.ordenes_mantenimiento(id) on delete cascade,
  articulo_id uuid not null references public.articulos(id),
  cantidad numeric(14,3) not null check (cantidad > 0),
  estado text not null default 'pendiente' check (estado in ('pendiente', 'surtido', 'en_compra', 'cancelado')),
  movimiento_id bigint references public.movimientos_inventario(id),
  requisicion_linea_id uuid references public.requisicion_lineas(id) on delete set null,
  notas text,
  pedido_por uuid default auth.uid() references public.perfiles(id),
  pedido_en timestamptz not null default now(),
  surtido_por uuid references public.perfiles(id),
  surtido_en timestamptz,
  check (num_nonnulls(servicio_id, mantenimiento_id) = 1)
);
create index if not exists servicio_materiales_servicio on public.servicio_materiales (servicio_id);
create index if not exists servicio_materiales_mto on public.servicio_materiales (mantenimiento_id);
create index if not exists servicio_materiales_pendientes on public.servicio_materiales (pedido_en) where estado = 'pendiente';

-- Costos aparte, como todo costo en este ERP: viáticos, refacciones, servicios externos.
create table if not exists public.costos_servicio (
  id bigserial primary key,
  servicio_id uuid references public.servicios(id) on delete cascade,
  mantenimiento_id uuid references public.ordenes_mantenimiento(id) on delete cascade,
  concepto text not null check (concepto in ('viaticos', 'material', 'servicio_externo', 'mano_obra', 'otro')),
  descripcion text not null check (length(trim(descripcion)) > 0),
  monto numeric(14,2) not null check (monto >= 0),
  material_id uuid references public.servicio_materiales(id) on delete cascade,
  registrado_por uuid default auth.uid() references public.perfiles(id),
  en timestamptz not null default now(),
  check (num_nonnulls(servicio_id, mantenimiento_id) = 1)
);
create index if not exists costos_servicio_servicio on public.costos_servicio (servicio_id);
create index if not exists costos_servicio_mto on public.costos_servicio (mantenimiento_id);

-- Evidencia: fotos (y la firma) en el bucket privado "servicio". No se borra.
create table if not exists public.servicio_evidencias (
  id uuid primary key default gen_random_uuid(),
  servicio_id uuid references public.servicios(id) on delete cascade,
  mantenimiento_id uuid references public.ordenes_mantenimiento(id) on delete cascade,
  momento text not null check (momento in ('recepcion', 'antes', 'durante', 'despues', 'entrega', 'firma', 'falla')),
  ruta text not null unique,
  nota text,
  subido_por uuid default auth.uid() references public.perfiles(id),
  subido_por_nombre text,
  en timestamptz not null default now(),
  check (num_nonnulls(servicio_id, mantenimiento_id) = 1)
);
create index if not exists evidencias_servicio on public.servicio_evidencias (servicio_id);
create index if not exists evidencias_mto on public.servicio_evidencias (mantenimiento_id);

-- Resguardo de herramienta: quién la tiene, desde cuándo y cómo regresó.
create table if not exists public.resguardos (
  id uuid primary key default gen_random_uuid(),
  maquina_id uuid not null references public.maquinas(id),
  empleado_id uuid references public.empleados(id),
  persona text,                                     -- si no es del personal ("los ingenieros", un externo)
  servicio_id uuid references public.servicios(id) on delete set null,
  entregado_en timestamptz not null default now(),
  entregado_por uuid default auth.uid() references public.perfiles(id),
  devolver_en date,
  devuelto_en timestamptz,
  recibido_por uuid references public.perfiles(id),
  estado_devolucion text check (estado_devolucion in ('bien', 'con_dano', 'incompleta')),
  notas text,
  notas_devolucion text,
  check (empleado_id is not null or nullif(trim(persona), '') is not null)
);
create unique index if not exists resguardo_abierto on public.resguardos (maquina_id) where devuelto_en is null;

-- -----------------------------------------------------------------------------
-- Disparadores: folios, fechas de cambio, bitácora y reglas de la garantía
-- -----------------------------------------------------------------------------
drop trigger if exists folio on public.servicios;
create trigger folio before insert on public.servicios for each row execute function public.trg_folio('SRV');
drop trigger if exists folio on public.ordenes_mantenimiento;
create trigger folio before insert on public.ordenes_mantenimiento for each row execute function public.trg_folio('MTO');

drop trigger if exists tocar on public.servicios;
create trigger tocar before update on public.servicios for each row execute function public.tocar_actualizado();
drop trigger if exists tocar on public.maquinas;
create trigger tocar before update on public.maquinas for each row execute function public.tocar_actualizado();
drop trigger if exists tocar on public.ordenes_mantenimiento;
create trigger tocar before update on public.ordenes_mantenimiento for each row execute function public.tocar_actualizado();

drop trigger if exists auditar on public.servicios;
create trigger auditar after insert or update or delete on public.servicios for each row execute function public.auditar();
drop trigger if exists auditar on public.maquinas;
create trigger auditar after insert or update or delete on public.maquinas for each row execute function public.auditar();
drop trigger if exists auditar on public.planes_preventivos;
create trigger auditar after insert or update or delete on public.planes_preventivos for each row execute function public.auditar();
drop trigger if exists auditar on public.ordenes_mantenimiento;
create trigger auditar after insert or update or delete on public.ordenes_mantenimiento for each row execute function public.auditar();
drop trigger if exists auditar on public.resguardos;
create trigger auditar after insert or update or delete on public.resguardos for each row execute function public.auditar();
drop trigger if exists auditar on public.costos_servicio;
create trigger auditar after insert or update or delete on public.costos_servicio for each row execute function public.auditar();

-- El equipo manda: con la orden de producción se llenan pedido, serie y equipo, y
-- se revisa que todo sea del mismo cliente. Hoy una garantía llega por chat sin
-- saber qué equipo es ni cuándo se entregó.
create or replace function public.trg_servicio() returns trigger
language plpgsql security definer set search_path = public as $$
declare o ordenes_produccion; v_cliente uuid;
begin
  new.descripcion := trim(new.descripcion);
  if new.orden_produccion_id is not null then
    select * into o from ordenes_produccion where id = new.orden_produccion_id;
    if o.id is null then raise exception 'No existe esa orden de producción'; end if;
    if new.pedido_id is null then new.pedido_id := o.pedido_id; end if;
    if o.pedido_id is not null and new.pedido_id is distinct from o.pedido_id then
      raise exception 'El equipo % no es de ese pedido', coalesce(o.numero_serie, o.folio);
    end if;
    new.numero_serie := coalesce(o.numero_serie, new.numero_serie);
    new.equipo := coalesce(nullif(trim(new.equipo), ''), (select nombre from articulos where id = o.articulo_id));
    if tg_op = 'INSERT' and new.tipo = 'garantia' and o.estado not in ('terminada', 'entregada') then
      raise exception 'El equipo % todavía no se termina: no puede tener garantía', coalesce(o.numero_serie, o.folio);
    end if;
  end if;
  if new.pedido_id is not null then
    select cliente_id into v_cliente from pedidos where id = new.pedido_id;
    if v_cliente is distinct from new.cliente_id then raise exception 'Ese pedido es de otro cliente'; end if;
  end if;
  if new.tipo = 'garantia' and (new.pedido_id is null or new.orden_produccion_id is null) then
    raise exception 'Una garantía va ligada al pedido y al equipo: elige el número de serie que se le entregó al cliente';
  end if;
  return new;
end $$;
drop trigger if exists validar on public.servicios;
create trigger validar before insert or update on public.servicios for each row execute function public.trg_servicio();

-- -----------------------------------------------------------------------------
-- RLS. Escribir pasa por las funciones de abajo; directo solo lo descriptivo.
-- -----------------------------------------------------------------------------
alter table public.servicios enable row level security;
alter table public.servicio_cuadrilla enable row level security;
alter table public.maquinas enable row level security;
alter table public.planes_preventivos enable row level security;
alter table public.ordenes_mantenimiento enable row level security;
alter table public.servicio_materiales enable row level security;
alter table public.costos_servicio enable row level security;
alter table public.servicio_evidencias enable row level security;
alter table public.resguardos enable row level security;

drop policy if exists ver on public.servicios;
create policy ver on public.servicios for select to authenticated using (
  (select ve_todos_los_servicios())
  or ((select puede('servicio', 1)) and (solicitado_por = (select auth.uid()) or cliente_id in (select mis_clientes_visibles()))));
-- Quien lo pidió corrige la descripción mientras nadie lo programa; la gerencia, siempre.
-- Las columnas de estado, fechas y cierre no se pueden escribir directo (ver grant abajo).
drop policy if exists cambio on public.servicios;
create policy cambio on public.servicios for update to authenticated
  using ((select puede('servicio', 3)) or (solicitado_por = (select auth.uid()) and estado = 'solicitada'))
  with check ((select puede('servicio', 3)) or (solicitado_por = (select auth.uid()) and estado = 'solicitada'));
revoke insert, update, delete on public.servicios from anon, authenticated;
grant update (descripcion, referencia, lugar, contacto_nombre, contacto_telefono, fecha_deseada, prioridad, equipo, numero_serie)
  on public.servicios to authenticated;

drop policy if exists ver on public.servicio_cuadrilla;
create policy ver on public.servicio_cuadrilla for select to authenticated using (servicio_id in (select id from public.servicios));

drop policy if exists ver on public.maquinas;
create policy ver on public.maquinas for select to authenticated using ((select puede('servicio', 1)));
drop policy if exists editar on public.maquinas;
create policy editar on public.maquinas for all to authenticated
  using ((select puede('servicio', 3))) with check ((select puede('servicio', 3)));

drop policy if exists ver on public.planes_preventivos;
create policy ver on public.planes_preventivos for select to authenticated using ((select puede('servicio', 1)));
drop policy if exists editar on public.planes_preventivos;
create policy editar on public.planes_preventivos for all to authenticated
  using ((select puede('servicio', 3))) with check ((select puede('servicio', 3)));

drop policy if exists ver on public.ordenes_mantenimiento;
create policy ver on public.ordenes_mantenimiento for select to authenticated using ((select puede('servicio', 1)));

drop policy if exists ver on public.servicio_materiales;
create policy ver on public.servicio_materiales for select to authenticated using (
  servicio_id in (select id from public.servicios) or mantenimiento_id in (select id from public.ordenes_mantenimiento));

-- Costos: quien tiene "costos" ve todo; la gerencia (servicio 3) ve y captura viáticos,
-- servicios externos y mano de obra, pero no el costo de las refacciones de almacén,
-- que es el costo del artículo (lo mismo que se le esconde en las órdenes de compra).
drop policy if exists ver on public.costos_servicio;
create policy ver on public.costos_servicio for select to authenticated using (
  (((select puede('costos', 1)) and (select puede('servicio', 1))) or (concepto <> 'material' and (select puede('servicio', 3))))
  and (servicio_id in (select id from public.servicios) or mantenimiento_id in (select id from public.ordenes_mantenimiento)));
drop policy if exists alta on public.costos_servicio;
create policy alta on public.costos_servicio for insert to authenticated with check (
  (select puede('servicio', 3)) and concepto <> 'material' and material_id is null and registrado_por = (select auth.uid())
  and (servicio_id in (select id from public.servicios) or mantenimiento_id in (select id from public.ordenes_mantenimiento)));
drop policy if exists baja on public.costos_servicio;
create policy baja on public.costos_servicio for delete to authenticated using ((select puede('servicio', 3)) and concepto <> 'material');
revoke update on public.costos_servicio from anon, authenticated;

drop policy if exists ver on public.servicio_evidencias;
create policy ver on public.servicio_evidencias for select to authenticated using (
  servicio_id in (select id from public.servicios) or mantenimiento_id in (select id from public.ordenes_mantenimiento));

drop policy if exists ver on public.resguardos;
create policy ver on public.resguardos for select to authenticated using ((select puede('servicio', 1)));

-- -----------------------------------------------------------------------------
-- Fotos: bucket privado. servicios/<id>/… (lo ve quien ve el servicio),
-- mantenimiento/<máquina>/… y maquinas/<máquina>/… (quien tiene servicio).
-- No hay política de borrar ni de reemplazar: la evidencia se queda.
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('servicio', 'servicio', false, 10485760,
        array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf'])
on conflict (id) do update set public = false;

drop policy if exists servicio_ver on storage.objects;
create policy servicio_ver on storage.objects for select to authenticated using (
  bucket_id = 'servicio' and (
    ((storage.foldername(name))[1] = 'servicios' and (storage.foldername(name))[2] in (select id::text from public.servicios))
    or ((storage.foldername(name))[1] in ('mantenimiento', 'maquinas') and (select public.puede('servicio', 1)))));
drop policy if exists servicio_subir on storage.objects;
create policy servicio_subir on storage.objects for insert to authenticated with check (
  bucket_id = 'servicio' and (select public.puede('servicio', 2)) and (
    ((storage.foldername(name))[1] = 'servicios' and (storage.foldername(name))[2] in (select id::text from public.servicios))
    or ((storage.foldername(name))[1] = 'mantenimiento' and (storage.foldername(name))[2] in (select id::text from public.maquinas))
    or ((storage.foldername(name))[1] = 'maquinas' and (select public.puede('servicio', 3))
        and (storage.foldername(name))[2] in (select id::text from public.maquinas))));

-- -----------------------------------------------------------------------------
-- Servicios: pedir, programar, recibir, iniciar, cerrar, cancelar
-- -----------------------------------------------------------------------------
create or replace function public.servicio_visible(p_servicio uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from servicios s where s.id = p_servicio and (ve_todos_los_servicios()
    or (puede('servicio', 1) and (s.solicitado_por = auth.uid() or s.cliente_id in (select mis_clientes_visibles())))))
$$;

create or replace function public.solicitar_servicio(p_tipo text, p_cliente uuid, p_descripcion text,
  p_pedido uuid default null, p_orden_produccion uuid default null, p_numero_serie text default null,
  p_equipo text default null, p_lugar text default null, p_contacto_nombre text default null,
  p_contacto_telefono text default null, p_fecha_deseada date default null, p_prioridad int default 2,
  p_referencia text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare v uuid;
begin
  if not puede('servicio', 2) then raise exception 'Sin permiso para pedir servicios' using errcode = '42501'; end if;
  -- Un vendedor pide servicio para los clientes que ve (los suyos y los libres), no para los de otro.
  if not ve_todos_los_servicios() and not cliente_visible(p_cliente) then
    raise exception 'Ese cliente es de otro vendedor' using errcode = '42501';
  end if;
  if coalesce(length(trim(p_descripcion)), 0) < 5 then raise exception 'Describe qué pide el cliente'; end if;
  insert into servicios (tipo, cliente_id, descripcion, pedido_id, orden_produccion_id, numero_serie, equipo, lugar,
                         contacto_nombre, contacto_telefono, fecha_deseada, prioridad, referencia)
  values (p_tipo, p_cliente, p_descripcion, p_pedido, p_orden_produccion, nullif(trim(p_numero_serie), ''),
          nullif(trim(p_equipo), ''), nullif(trim(p_lugar), ''), nullif(trim(p_contacto_nombre), ''),
          nullif(trim(p_contacto_telefono), ''), p_fecha_deseada, coalesce(p_prioridad, 2), nullif(trim(p_referencia), ''))
  returning id into v;
  return v;
end $$;

-- Equipos que se le han hecho a un cliente (para ligar una garantía o un servicio a su serie).
create or replace function public.equipos_del_cliente(p_cliente uuid)
returns table (orden_id uuid, folio text, numero_serie text, equipo text, pedido_id uuid, pedido_folio text,
               estado text, entregado date, garantia_vence date)
language sql stable security definer set search_path = public as $$
  select o.id, o.folio, o.numero_serie, a.nombre, o.pedido_id, p.folio, o.estado::text,
    coalesce(o.entregada_en, o.terminada_en)::date,
    (coalesce(o.entregada_en, o.terminada_en)::date
      + make_interval(months => coalesce((select (valor->>'meses_garantia')::int from configuracion where clave = 'servicio'), 12)))::date
  from ordenes_produccion o
  join pedidos p on p.id = o.pedido_id
  join articulos a on a.id = o.articulo_id
  where p.cliente_id = p_cliente and o.estado <> 'cancelada'
    and puede('servicio', 1) and (ve_todos_los_servicios() or cliente_visible(p_cliente))
  order by coalesce(o.entregada_en, o.terminada_en, o.creado_en) desc
$$;

create or replace function public.programar_servicio(p_servicio uuid, p_inicio timestamptz, p_fin timestamptz,
  p_cuadrilla uuid[], p_jefe uuid default null) returns void
language plpgsql security definer set search_path = public as $$
declare s servicios; e record; c record; v_rango tstzrange; v_n int;
begin
  if not puede('servicio', 3) then raise exception 'Solo la gerencia de producción programa servicios' using errcode = '42501'; end if;
  select * into s from servicios where id = p_servicio for update;
  if s.id is null then raise exception 'No existe el servicio'; end if;
  if s.estado not in ('solicitada', 'programada') then
    raise exception 'El servicio % ya está %: no se reprograma', s.folio, replace(s.estado, '_', ' ');
  end if;
  if p_inicio is null or p_fin is null or p_fin <= p_inicio then raise exception 'El fin tiene que ser después del inicio'; end if;
  if coalesce(cardinality(p_cuadrilla), 0) = 0 then raise exception 'Asigna al menos a una persona a la cuadrilla'; end if;
  select count(*) into v_n from empleados where id = any(p_cuadrilla);
  if v_n <> (select count(distinct x) from unnest(p_cuadrilla) x) then raise exception 'Alguien de la cuadrilla no está en el personal'; end if;
  v_rango := tstzrange(p_inicio, p_fin);

  for e in select x.id, x.nombre, x.activo from empleados x where x.id = any(p_cuadrilla) order by x.nombre loop
    if not e.activo then raise exception '% está dado de baja', e.nombre; end if;
    -- "No podemos juntar 2 instalaciones al mismo tiempo": con la misma gente, la base no deja.
    select s2.folio, s2.tipo, cl.nombre cliente, lower(sc.periodo) ini, upper(sc.periodo) fin into c
    from servicio_cuadrilla sc join servicios s2 on s2.id = sc.servicio_id join clientes cl on cl.id = s2.cliente_id
    where sc.empleado_id = e.id and sc.vigente and sc.servicio_id <> p_servicio and sc.periodo && v_rango
    order by lower(sc.periodo) limit 1;
    if found then
      raise exception '% ya va en % (% · %) del % al %: una persona no puede estar en dos servicios a la vez',
        e.nombre, c.folio, nombre_tipo_servicio(c.tipo), c.cliente,
        to_char(c.ini at time zone 'America/Mexico_City', 'DD/MM HH24:MI'), to_char(c.fin at time zone 'America/Mexico_City', 'DD/MM HH24:MI')
        using errcode = '23P01';
    end if;
    if exists (select 1 from incidencias i where i.empleado_id = e.id and i.estado = 'aprobada'
                 and i.tipo in ('vacaciones', 'permiso_con_goce', 'permiso_sin_goce', 'incapacidad')
                 and daterange(i.inicio, i.fin, '[]') && daterange((p_inicio at time zone 'America/Mexico_City')::date,
                                                                    (p_fin at time zone 'America/Mexico_City')::date, '[]')) then
      raise exception '% tiene vacaciones, permiso o incapacidad en esas fechas', e.nombre;
    end if;
  end loop;

  delete from servicio_cuadrilla where servicio_id = p_servicio;
  insert into servicio_cuadrilla (servicio_id, empleado_id, etapa_id, jefe, periodo)
  select p_servicio, x.id, x.etapa_id, x.id = coalesce(p_jefe, p_cuadrilla[1]), v_rango from empleados x where x.id = any(p_cuadrilla);
  update servicios set inicio = p_inicio, fin = p_fin, estado = 'programada', programado_por = auth.uid(), programado_en = now()
  where id = p_servicio;
end $$;

-- Un equipo que llega a reparación se recibe con fotos (antes de tocarlo): si después
-- el cliente dice que llegó entero, ahí está cómo llegó.
create or replace function public.recibir_equipo(p_servicio uuid, p_condicion text) returns void
language plpgsql security definer set search_path = public as $$
declare s servicios;
begin
  if not es_personal_servicio() then raise exception 'Sin permiso para recibir equipos' using errcode = '42501'; end if;
  select * into s from servicios where id = p_servicio for update;
  if s.id is null then raise exception 'No existe el servicio'; end if;
  if s.tipo not in ('reparacion_planta', 'garantia') then raise exception 'Solo se recibe en planta un equipo para reparación o garantía'; end if;
  if s.estado in ('cerrada', 'cancelada') then raise exception 'El servicio % ya está %', s.folio, s.estado; end if;
  if s.recibido_en is not null then raise exception 'Ese equipo ya se recibió el %', to_char(s.recibido_en at time zone 'America/Mexico_City', 'DD/MM HH24:MI'); end if;
  if not exists (select 1 from servicio_evidencias where servicio_id = p_servicio and momento = 'recepcion') then
    raise exception 'Toma al menos una foto de cómo llega el equipo antes de recibirlo';
  end if;
  if coalesce(length(trim(p_condicion)), 0) < 3 then raise exception 'Anota en qué condiciones llega (golpes, piezas que faltan…)'; end if;
  update servicios set recibido_en = now(), recibido_por = auth.uid(), condicion_recepcion = trim(p_condicion) where id = p_servicio;
end $$;

create or replace function public.iniciar_servicio(p_servicio uuid) returns void
language plpgsql security definer set search_path = public as $$
declare s servicios;
begin
  if not es_personal_servicio() then raise exception 'Sin permiso para iniciar servicios' using errcode = '42501'; end if;
  select * into s from servicios where id = p_servicio for update;
  if s.id is null then raise exception 'No existe el servicio'; end if;
  if s.estado <> 'programada' then raise exception 'Solo se inicia un servicio programado (este está %)', replace(s.estado, '_', ' '); end if;
  if s.tipo = 'reparacion_planta' and s.recibido_en is null then
    raise exception 'Primero recibe el equipo en planta, con fotos de cómo llegó';
  end if;
  update servicios set estado = 'en_curso', iniciado_en = now() where id = p_servicio;
end $$;

create or replace function public.cerrar_servicio(p_servicio uuid, p_recibio text, p_notas text,
  p_firma_ruta text default null, p_garantia_procede boolean default null) returns void
language plpgsql security definer set search_path = public as $$
declare s servicios;
begin
  if not es_personal_servicio() then raise exception 'Solo producción cierra servicios' using errcode = '42501'; end if;
  select * into s from servicios where id = p_servicio for update;
  if s.id is null then raise exception 'No existe el servicio'; end if;
  if s.estado not in ('programada', 'en_curso') then raise exception 'Solo se cierra un servicio programado o en curso (este está %)', replace(s.estado, '_', ' '); end if;
  if s.tipo = 'reparacion_planta' and s.recibido_en is null then raise exception 'Ese equipo nunca se recibió en planta'; end if;
  if coalesce(length(trim(p_recibio)), 0) < 3 then raise exception 'Escribe el nombre de quien recibe el trabajo'; end if;
  if coalesce(length(trim(p_notas)), 0) < 5 then raise exception 'Escribe qué se hizo (notas de cierre)'; end if;
  if not exists (select 1 from servicio_evidencias where servicio_id = p_servicio and momento in ('antes', 'durante', 'despues', 'entrega')) then
    raise exception 'Sube al menos una foto del trabajo terminado: sin evidencia no se cierra';
  end if;
  if s.tipo = 'garantia' and p_garantia_procede is null then raise exception 'Indica si la garantía procedió o no'; end if;
  if p_firma_ruta is not null and not exists (select 1 from servicio_evidencias where servicio_id = p_servicio and ruta = p_firma_ruta and momento = 'firma') then
    raise exception 'La firma no está guardada en este servicio';
  end if;
  update servicios set estado = 'cerrada', cerrado_en = now(), cerrado_por = auth.uid(), iniciado_en = coalesce(iniciado_en, now()),
    recibio_nombre = trim(p_recibio), notas_cierre = trim(p_notas), firma_ruta = p_firma_ruta,
    garantia_procede = case when s.tipo = 'garantia' then p_garantia_procede end
  where id = p_servicio;
  -- Si terminó antes de lo programado, la cuadrilla queda libre desde ahora; si se hizo
  -- antes de la fecha programada (llegó antes el equipo), esa fecha se libera completa.
  update servicio_cuadrilla set vigente = false where servicio_id = p_servicio and lower(periodo) > now();
  update servicio_cuadrilla set periodo = tstzrange(lower(periodo), greatest(now(), lower(periodo) + interval '1 minute'))
  where servicio_id = p_servicio and vigente and upper(periodo) > now();
end $$;

create or replace function public.cancelar_servicio(p_servicio uuid, p_motivo text) returns void
language plpgsql security definer set search_path = public as $$
declare s servicios;
begin
  select * into s from servicios where id = p_servicio for update;
  if s.id is null or not servicio_visible(p_servicio) then raise exception 'No existe el servicio'; end if;
  if not (puede('servicio', 3) or (s.solicitado_por = auth.uid() and s.estado = 'solicitada')) then
    raise exception 'Solo la gerencia cancela un servicio ya programado' using errcode = '42501';
  end if;
  if s.estado in ('cerrada', 'cancelada') then raise exception 'El servicio % ya está %', s.folio, s.estado; end if;
  if coalesce(length(trim(p_motivo)), 0) < 3 then raise exception 'Escribe por qué se cancela'; end if;
  update servicios set estado = 'cancelada', cancelado_en = now(), motivo_cancelacion = trim(p_motivo) where id = p_servicio;
  update servicio_cuadrilla set vigente = false where servicio_id = p_servicio;
  update servicio_materiales set estado = 'cancelado' where servicio_id = p_servicio and estado = 'pendiente';
end $$;

-- Registra una foto ya subida al bucket. La ruta tiene que existir y estar en la
-- carpeta del servicio o de la máquina: no se puede "adoptar" la foto de otro.
create or replace function public.agregar_evidencia(p_ruta text, p_momento text, p_servicio uuid default null,
  p_mantenimiento uuid default null, p_nota text default null, p_nombre text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare v uuid; v_prefijo text; v_maquina uuid;
begin
  if not puede('servicio', 2) then raise exception 'Sin permiso para subir evidencia' using errcode = '42501'; end if;
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

-- -----------------------------------------------------------------------------
-- Insumos y refacciones: salen de almacén o se piden a compras
-- -----------------------------------------------------------------------------
create or replace function public.agregar_material_servicio(p_articulo uuid, p_cantidad numeric,
  p_servicio uuid default null, p_mantenimiento uuid default null, p_notas text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare v uuid; v_estado text;
begin
  if not es_personal_servicio() then raise exception 'Sin permiso para pedir material' using errcode = '42501'; end if;
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

-- Almacén entrega: la salida es la de siempre (registrar_salida, tipo consumo) con el
-- folio en el motivo, y su costo queda en costos_servicio.
create or replace function public.surtir_material_servicio(p_linea uuid, p_almacen int) returns bigint
language plpgsql security definer set search_path = public as $$
declare l servicio_materiales; v_folio text; v_para text; v_mov bigint; v_costo numeric; v_art text;
begin
  if not puede('inventario', 2) then raise exception 'Solo almacén entrega material' using errcode = '42501'; end if;
  select * into l from servicio_materiales where id = p_linea for update;
  if l.id is null then raise exception 'No existe esa partida'; end if;
  if l.estado not in ('pendiente', 'en_compra') then raise exception 'Esa partida ya está %', l.estado; end if;
  if not coalesce((select disponible_para_planta from almacenes where id = p_almacen), false) then
    raise exception 'De ese almacén no sale material para planta';
  end if;
  if l.servicio_id is not null then
    select s.folio, nombre_tipo_servicio(s.tipo) || ' · ' || c.nombre into v_folio, v_para
    from servicios s join clientes c on c.id = s.cliente_id where s.id = l.servicio_id and s.estado not in ('cerrada', 'cancelada');
  else
    select o.folio, m.numero || ' ' || m.nombre into v_folio, v_para
    from ordenes_mantenimiento o join maquinas m on m.id = o.maquina_id where o.id = l.mantenimiento_id and o.estado in ('pendiente', 'en_proceso');
  end if;
  if v_folio is null then raise exception 'El servicio u orden ya está cerrado'; end if;

  v_mov := registrar_salida(l.articulo_id, p_almacen, l.cantidad, 'salida_consumo', v_folio || ' · ' || v_para);
  select costo_unitario into v_costo from movimientos_inventario where id = v_mov;
  select nombre into v_art from articulos where id = l.articulo_id;
  update servicio_materiales set estado = 'surtido', movimiento_id = v_mov, surtido_por = auth.uid(), surtido_en = now() where id = p_linea;
  insert into costos_servicio (servicio_id, mantenimiento_id, concepto, descripcion, monto, material_id)
  values (l.servicio_id, l.mantenimiento_id, 'material', format('%s × %s', l.cantidad::float8, v_art), round(l.cantidad * coalesce(v_costo, 0), 2), l.id);
  return v_mov;
end $$;

-- Lo que no hay en almacén va a compras como requisición, con el folio en las notas.
create or replace function public.pedir_material_a_compras(p_servicio uuid default null, p_mantenimiento uuid default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_req uuid; v_folio text; v_para text; v_fecha date; l record; v_linea uuid;
begin
  if not es_personal_servicio() then raise exception 'Sin permiso para pedir a compras' using errcode = '42501'; end if;
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
  if not es_personal_servicio() then raise exception 'Sin permiso' using errcode = '42501'; end if;
  update servicio_materiales set estado = 'cancelado' where id = p_linea and estado = 'pendiente';
  if not found then raise exception 'Solo se quita una partida que no se ha surtido ni pedido a compras'; end if;
end $$;

-- -----------------------------------------------------------------------------
-- Mantenimiento: reportar, atender, cerrar
-- -----------------------------------------------------------------------------
-- El estado de la máquina sale de sus órdenes abiertas (no se captura a mano).
create or replace function public.recalcular_estado_maquina(p_maquina uuid) returns void
language sql security definer set search_path = public as $$
  update maquinas m set estado = case
    when m.estado = 'baja' then 'baja'
    when exists (select 1 from ordenes_mantenimiento o where o.maquina_id = m.id and o.estado = 'en_proceso'
                   and o.fuera_desde is not null and o.fuera_hasta is null) then 'en_mantenimiento'
    when exists (select 1 from ordenes_mantenimiento o where o.maquina_id = m.id and o.estado in ('pendiente', 'en_proceso')
                   and o.fuera_desde is not null and o.fuera_hasta is null) then 'fuera_de_servicio'
    when exists (select 1 from ordenes_mantenimiento o where o.maquina_id = m.id and o.estado in ('pendiente', 'en_proceso')
                   and o.tipo = 'correctivo') then 'con_falla'
    else 'operando' end
  where m.id = p_maquina
$$;
revoke execute on function public.recalcular_estado_maquina(uuid) from public, anon, authenticated;

-- "Se quemó el taladro" con una foto, desde el celular o la terminal de piso.
create or replace function public.reportar_falla(p_maquina uuid, p_falla text, p_detiene boolean default false,
  p_fotos text[] default null, p_nombre text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare m maquinas; v uuid; f text;
begin
  if not puede('servicio', 2) then raise exception 'Sin permiso para reportar fallas' using errcode = '42501'; end if;
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

-- Atender: diagnóstico y quién la repara. Un preventivo para la máquina mientras se hace.
create or replace function public.atender_mantenimiento(p_orden uuid, p_diagnostico text, p_atiende text default null,
  p_detiene boolean default null) returns void
language plpgsql security definer set search_path = public as $$
declare o ordenes_mantenimiento;
begin
  if not es_personal_servicio() then raise exception 'Sin permiso para atender mantenimiento' using errcode = '42501'; end if;
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

-- Cerrar es de la gerencia: pone la máquina de vuelta en servicio y cierra el costo.
create or replace function public.cerrar_mantenimiento(p_orden uuid, p_trabajo text, p_horas_uso numeric default null) returns void
language plpgsql security definer set search_path = public as $$
declare o ordenes_mantenimiento; v_horas numeric;
begin
  if not puede('servicio', 3) then raise exception 'Solo la gerencia de producción cierra órdenes de mantenimiento' using errcode = '42501'; end if;
  select * into o from ordenes_mantenimiento where id = p_orden for update;
  if o.id is null then raise exception 'No existe la orden'; end if;
  if o.estado not in ('pendiente', 'en_proceso') then raise exception 'La orden % ya está %', o.folio, o.estado; end if;
  if coalesce(length(trim(p_trabajo)), 0) < 5 then raise exception 'Escribe qué se hizo (qué se cambió o reparó)'; end if;
  if p_horas_uso is not null then
    if p_horas_uso < (select horas_uso from maquinas where id = o.maquina_id) then
      raise exception 'El horómetro no puede ir para atrás';
    end if;
    update maquinas set horas_uso = p_horas_uso, horas_actualizado_en = now() where id = o.maquina_id;
  end if;
  select horas_uso into v_horas from maquinas where id = o.maquina_id;
  update ordenes_mantenimiento set estado = 'cerrada', cerrada_en = now(), cerrada_por = auth.uid(), trabajo_realizado = trim(p_trabajo),
    inicio_en = coalesce(inicio_en, now()), fuera_hasta = case when fuera_desde is not null then now() end, horas_uso_al_cerrar = v_horas
  where id = p_orden;
  if o.tipo = 'preventivo' and o.plan_id is not null then
    update planes_preventivos set ultima_fecha = hoy_planta(), ultima_horas = v_horas where id = o.plan_id;
  end if;
  perform recalcular_estado_maquina(o.maquina_id);
end $$;

create or replace function public.cancelar_mantenimiento(p_orden uuid, p_motivo text) returns void
language plpgsql security definer set search_path = public as $$
declare o ordenes_mantenimiento;
begin
  if not puede('servicio', 3) then raise exception 'Solo la gerencia cancela órdenes de mantenimiento' using errcode = '42501'; end if;
  select * into o from ordenes_mantenimiento where id = p_orden for update;
  if o.id is null then raise exception 'No existe la orden'; end if;
  if o.estado not in ('pendiente', 'en_proceso') then raise exception 'La orden % ya está %', o.folio, o.estado; end if;
  if coalesce(length(trim(p_motivo)), 0) < 3 then raise exception 'Escribe por qué se cancela (¿era el mismo reporte?)'; end if;
  update ordenes_mantenimiento set estado = 'cancelada', motivo_cancelacion = trim(p_motivo),
    fuera_hasta = case when fuera_desde is not null then now() end where id = p_orden;
  update servicio_materiales set estado = 'cancelado' where mantenimiento_id = p_orden and estado = 'pendiente';
  perform recalcular_estado_maquina(o.maquina_id);
end $$;

-- -----------------------------------------------------------------------------
-- Preventivos: por fecha o por horas de uso. Se generan solos.
-- -----------------------------------------------------------------------------
create or replace function public.generar_preventivos(p_maquina uuid default null) returns int
language plpgsql security definer set search_path = public as $$
declare v_n int;
begin
  -- Sin usuario = pg_cron o el sistema. Con usuario, cualquiera que vea servicio (solo crea lo vencido).
  if auth.uid() is not null and not puede('servicio', 1) then raise exception 'Sin permiso' using errcode = '42501'; end if;
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
revoke execute on function public.generar_preventivos(uuid) from public, anon;
grant execute on function public.generar_preventivos(uuid) to authenticated, service_role;

-- Horómetro: al pasar el límite del plan, la orden preventiva sale en ese momento.
create or replace function public.registrar_horas_maquina(p_maquina uuid, p_horas numeric) returns int
language plpgsql security definer set search_path = public as $$
declare v_actual numeric;
begin
  if not es_personal_servicio() then raise exception 'Sin permiso para registrar horas de uso' using errcode = '42501'; end if;
  select horas_uso into v_actual from maquinas where id = p_maquina for update;
  if v_actual is null then raise exception 'No existe esa máquina'; end if;
  if p_horas is null or p_horas < v_actual then
    raise exception 'El horómetro no puede ir para atrás: la última lectura es % h', v_actual::float8;
  end if;
  update maquinas set horas_uso = p_horas, horas_actualizado_en = now() where id = p_maquina;
  return generar_preventivos(p_maquina);
end $$;

-- -----------------------------------------------------------------------------
-- Resguardo de herramienta
-- -----------------------------------------------------------------------------
create or replace function public.prestar_herramienta(p_maquina uuid, p_empleado uuid default null, p_persona text default null,
  p_devolver_en date default null, p_servicio uuid default null, p_notas text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare m maquinas; r record; v uuid;
begin
  if not es_personal_servicio() then raise exception 'Sin permiso para prestar herramienta' using errcode = '42501'; end if;
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

-- Si regresa dañada, la falla se reporta sola: así no se presta otra vez sin revisarla.
create or replace function public.devolver_herramienta(p_resguardo uuid, p_estado text default 'bien', p_notas text default null) returns void
language plpgsql security definer set search_path = public as $$
declare r resguardos; v_quien text;
begin
  if not es_personal_servicio() then raise exception 'Sin permiso para recibir herramienta' using errcode = '42501'; end if;
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

-- -----------------------------------------------------------------------------
-- Vistas (con los permisos de quien consulta)
-- -----------------------------------------------------------------------------
drop view if exists public.v_servicios cascade;
drop view if exists public.v_servicio_cuadrilla cascade;
drop view if exists public.v_servicio_materiales cascade;
drop view if exists public.v_servicio_evidencias cascade;
drop view if exists public.v_maquinas cascade;
drop view if exists public.v_ordenes_mantenimiento cascade;
drop view if exists public.v_planes_preventivos cascade;
drop view if exists public.v_resguardos cascade;
drop view if exists public.v_costos_servicio cascade;
drop view if exists public.v_costos_maquina cascade;

-- El folio del pedido sin sus importes (ventas solo lee sus pedidos; producción, todos).
create or replace function public.folio_pedido_servicio(p_pedido uuid) returns text
language sql stable security definer set search_path = public as $$
  select folio from pedidos where id = p_pedido and puede('servicio', 1)
$$;

create view public.v_servicios with (security_invoker = true) as
with personal as (select * from public.personal_servicio()),
cfg as (select coalesce((select (valor->>'meses_garantia')::int from public.configuracion where clave = 'servicio'), 12) meses)
select s.id, s.folio, s.tipo, public.nombre_tipo_servicio(s.tipo) as tipo_nombre, s.estado, s.prioridad,
  s.cliente_id, c.nombre as cliente, c.vendedor_id, s.pedido_id, public.folio_pedido_servicio(s.pedido_id) as pedido_folio,
  s.orden_produccion_id, op.folio as op_folio, s.numero_serie, s.equipo, s.descripcion, s.referencia, s.lugar,
  s.contacto_nombre, s.contacto_telefono, s.fecha_deseada,
  s.solicitado_por, ps.nombre as solicitado_por_nombre, s.solicitado_en,
  s.inicio, s.fin, s.programado_por, pp.nombre as programado_por_nombre, s.programado_en,
  coalesce((select sum(h.horas) from public.horas_laborables(s.inicio, s.fin) h), 0) as horas_por_persona,
  coalesce((select jsonb_agg(jsonb_build_object('id', q.empleado_id, 'nombre', p.nombre, 'puesto', p.puesto, 'etapa', p.etapa,
                                                'etapa_color', p.etapa_color, 'jefe', q.jefe) order by q.jefe desc, p.nombre)
            from public.servicio_cuadrilla q join personal p on p.id = q.empleado_id where q.servicio_id = s.id), '[]'::jsonb) as cuadrilla,
  s.recibido_en, pr.nombre as recibido_por_nombre, s.condicion_recepcion,
  s.iniciado_en, s.cerrado_en, pc.nombre as cerrado_por_nombre, s.recibio_nombre, s.firma_ruta, s.notas_cierre, s.garantia_procede,
  s.cancelado_en, s.motivo_cancelacion,
  coalesce(op.entregada_en, op.terminada_en)::date as equipo_entregado,
  (coalesce(op.entregada_en, op.terminada_en)::date + make_interval(months => cfg.meses))::date as garantia_vence,
  coalesce(op.entregada_en, op.terminada_en)::date + make_interval(months => cfg.meses) >= s.solicitado_en::date as en_garantia,
  (select count(*) from public.servicio_evidencias e where e.servicio_id = s.id and e.momento <> 'firma')::int as fotos,
  (select count(*) from public.servicio_evidencias e where e.servicio_id = s.id and e.momento = 'recepcion')::int as fotos_recepcion,
  (select count(*) from public.servicio_materiales m where m.servicio_id = s.id and m.estado = 'pendiente')::int as insumos_pendientes,
  case when s.estado = 'solicitada' then public.hoy_planta() - (s.solicitado_en at time zone 'America/Mexico_City')::date end as dias_esperando,
  s.creado_en, s.actualizado_en
from public.servicios s
cross join cfg
left join public.clientes c on c.id = s.cliente_id
left join public.ordenes_produccion op on op.id = s.orden_produccion_id
left join public.perfiles ps on ps.id = s.solicitado_por
left join public.perfiles pp on pp.id = s.programado_por
left join public.perfiles pr on pr.id = s.recibido_por
left join public.perfiles pc on pc.id = s.cerrado_por;

-- Calendario de cuadrillas: una fila por persona y servicio.
create view public.v_servicio_cuadrilla with (security_invoker = true) as
with personal as (select * from public.personal_servicio())
select q.servicio_id, s.folio, s.tipo, public.nombre_tipo_servicio(s.tipo) as tipo_nombre, s.estado, c.nombre as cliente, s.lugar,
  q.empleado_id, p.nombre as empleado, p.puesto, q.etapa_id, et.nombre as etapa, et.color as etapa_color, q.jefe,
  lower(q.periodo) as inicio, upper(q.periodo) as fin,
  coalesce((select sum(h.horas) from public.horas_laborables(lower(q.periodo), upper(q.periodo)) h), 0) as horas_taller
from public.servicio_cuadrilla q
join public.servicios s on s.id = q.servicio_id
left join public.clientes c on c.id = s.cliente_id
left join personal p on p.id = q.empleado_id
left join public.etapas et on et.id = q.etapa_id
where q.vigente and s.estado <> 'cancelada';

create view public.v_servicio_materiales with (security_invoker = true) as
select l.id, l.servicio_id, l.mantenimiento_id, coalesce(s.folio, o.folio) as folio,
  coalesce(public.nombre_tipo_servicio(s.tipo) || ' · ' || c.nombre, m.numero || ' ' || m.nombre) as para,
  l.articulo_id, a.clave, a.nombre, a.unidad, l.cantidad, l.estado, l.notas, l.movimiento_id,
  l.pedido_en, pp.nombre as pedido_por_nombre, l.surtido_en, psu.nombre as surtido_por_nombre,
  r.folio as requisicion_folio,
  coalesce((select sum(x.cantidad) from public.existencias x join public.almacenes al on al.id = x.almacen_id
            where x.articulo_id = l.articulo_id and al.disponible_para_planta), 0) as existencia_planta
from public.servicio_materiales l
join public.articulos a on a.id = l.articulo_id
left join public.servicios s on s.id = l.servicio_id
left join public.clientes c on c.id = s.cliente_id
left join public.ordenes_mantenimiento o on o.id = l.mantenimiento_id
left join public.maquinas m on m.id = o.maquina_id
left join public.perfiles pp on pp.id = l.pedido_por
left join public.perfiles psu on psu.id = l.surtido_por
left join public.requisicion_lineas rl on rl.id = l.requisicion_linea_id
left join public.requisiciones r on r.id = rl.requisicion_id;

create view public.v_servicio_evidencias with (security_invoker = true) as
select e.id, e.servicio_id, e.mantenimiento_id, e.momento, e.ruta, e.nota, e.en,
  coalesce(e.subido_por_nombre, p.nombre) as subido_por_nombre
from public.servicio_evidencias e left join public.perfiles p on p.id = e.subido_por;

create view public.v_ordenes_mantenimiento with (security_invoker = true) as
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
  o.creado_en
from public.ordenes_mantenimiento o
join public.maquinas m on m.id = o.maquina_id
left join public.etapas et on et.id = m.etapa_id
left join public.planes_preventivos pl on pl.id = o.plan_id
left join public.perfiles pr on pr.id = o.reportado_por
left join public.perfiles pc on pc.id = o.cerrada_por;

create view public.v_planes_preventivos with (security_invoker = true) as
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
  o.id as orden_id, o.folio as orden_folio, o.estado as orden_estado
from public.planes_preventivos p
join public.maquinas m on m.id = p.maquina_id
left join public.ordenes_mantenimiento o on o.plan_id = p.id and o.estado in ('pendiente', 'en_proceso');

create view public.v_resguardos with (security_invoker = true) as
with personal as (select * from public.personal_servicio()),
cfg as (select coalesce((select (valor->>'dias_herramienta')::int from public.configuracion where clave = 'servicio'), 7) dias)
select r.id, r.maquina_id, m.numero, m.nombre as herramienta, m.categoria, r.empleado_id,
  coalesce(p.nombre, r.persona) as quien, p.puesto, r.persona, r.servicio_id, s.folio as servicio_folio,
  r.entregado_en, pe.nombre as entregado_por_nombre, r.devolver_en, r.devuelto_en, pr.nombre as recibido_por_nombre,
  r.estado_devolucion, r.notas, r.notas_devolucion,
  r.devuelto_en is null as abierto,
  (coalesce(r.devuelto_en, now()) at time zone 'America/Mexico_City')::date - (r.entregado_en at time zone 'America/Mexico_City')::date as dias,
  r.devuelto_en is null and (r.devolver_en < public.hoy_planta()
    or public.hoy_planta() - (r.entregado_en at time zone 'America/Mexico_City')::date > cfg.dias) as vencido
from public.resguardos r
cross join cfg
join public.maquinas m on m.id = r.maquina_id
left join personal p on p.id = r.empleado_id
left join public.servicios s on s.id = r.servicio_id
left join public.perfiles pe on pe.id = r.entregado_por
left join public.perfiles pr on pr.id = r.recibido_por;

-- Ficha de la máquina sin dinero (la ve ventas y el taller): estado, orden abierta,
-- fallas y horas paradas del año, próximo preventivo y quién la tiene.
create view public.v_maquinas with (security_invoker = true) as
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
  rg.id as resguardo_id, coalesce(pp.nombre, rg.persona) as prestada_a, rg.entregado_en as prestada_desde
from public.maquinas m
left join public.etapas et on et.id = m.etapa_id
left join lateral (select o.* from public.ordenes_mantenimiento o where o.maquina_id = m.id and o.estado in ('pendiente', 'en_proceso')
                   order by (o.fuera_desde is not null and o.fuera_hasta is null) desc, o.reportado_en limit 1) ab on true
left join lateral (select v.* from public.v_planes_preventivos v where v.maquina_id = m.id and v.activo
                   order by case v.situacion when 'vencido' then 0 when 'por_vencer' then 1 else 2 end, v.proxima_fecha nulls last limit 1) pv on true
left join public.resguardos rg on rg.maquina_id = m.id and rg.devuelto_en is null
left join personal pp on pp.id = rg.empleado_id;

-- Costos por servicio u orden y por máquina. Leen costos_servicio con su RLS: a quien
-- no ve costos le salen vacías.
create view public.v_costos_servicio with (security_invoker = true) as
select k.servicio_id, k.mantenimiento_id, o.maquina_id,
  sum(k.monto) filter (where k.concepto = 'material') as material,
  sum(k.monto) filter (where k.concepto = 'viaticos') as viaticos,
  sum(k.monto) filter (where k.concepto = 'servicio_externo') as servicio_externo,
  sum(k.monto) filter (where k.concepto = 'mano_obra') as mano_obra,
  sum(k.monto) filter (where k.concepto = 'otro') as otro,
  sum(k.monto) as total
from public.costos_servicio k
left join public.ordenes_mantenimiento o on o.id = k.mantenimiento_id
group by k.servicio_id, k.mantenimiento_id, o.maquina_id;

create view public.v_costos_maquina with (security_invoker = true) as
select o.maquina_id, sum(k.monto) as total,
  sum(k.monto) filter (where o.reportado_en > now() - interval '12 months') as ultimos_12m,
  sum(k.monto) filter (where k.concepto = 'material') as refacciones,
  count(distinct o.id)::int as ordenes_con_costo
from public.costos_servicio k join public.ordenes_mantenimiento o on o.id = k.mantenimiento_id
where o.estado <> 'cancelada'
group by o.maquina_id;

-- -----------------------------------------------------------------------------
-- Carga del taller por semana: producción + servicios contra la capacidad.
-- -----------------------------------------------------------------------------
-- capacidad_disponible = capacidad de la etapa − horas que su gente pasa en servicio.
-- Producción: las horas por terminar de cada orden, parejas entre la semana en que
-- empieza (o esta, si ya empezó) y la de su compromiso; una orden atrasada cae
-- completa en esta semana. Es security definer para que todos vean la misma carga
-- (un vendedor ve solo sus servicios, pero la capacidad es la de todo el taller);
-- devuelve horas y folios, nada de clientes ni dinero.
create or replace function public.carga_semanal(p_semanas int default 6, p_desde date default null)
returns table (semana date, etapa_id int, etapa text, color text, orden int, capacidad numeric, horas_servicio numeric,
               capacidad_disponible numeric, horas_produccion numeric, horas_planeadas numeric, carga numeric, saldo numeric,
               ocupacion numeric, servicios jsonb)
language sql stable security definer set search_path = public as $$
  with hoy as (select hoy_planta() d, date_trunc('week', hoy_planta())::date s0),
  sem as (
    select (date_trunc('week', coalesce(p_desde, (select d from hoy)))::date + 7 * g) as semana
    from generate_series(0, greatest(least(coalesce(p_semanas, 6), 26), 1) - 1) g
  ),
  op as (
    select x.etapa_id, x.horas_estimadas h, o.estado = 'planeada' as planeada,
      greatest(hoy.s0, date_trunc('week', coalesce(o.inicio_plan, hoy.d))::date) ini,
      greatest(hoy.s0, date_trunc('week', coalesce(o.fecha_compromiso, hoy.d))::date) fin
    from op_operaciones x join ordenes_produccion o on o.id = x.orden_id cross join hoy
    where o.estado in ('planeada', 'liberada', 'en_proceso') and x.estado <> 'terminada' and x.horas_estimadas > 0
  ),
  op_sem as (
    select op.etapa_id, s.semana,
      sum(op.h / (((greatest(op.fin, op.ini) - op.ini) / 7) + 1)) filter (where not op.planeada) prod,
      sum(op.h / (((greatest(op.fin, op.ini) - op.ini) / 7) + 1)) filter (where op.planeada) plan
    from op join sem s on s.semana between op.ini and greatest(op.fin, op.ini)
    group by 1, 2
  ),
  srv as (
    select q.etapa_id, date_trunc('week', hl.dia)::date semana, s.id, s.folio, s.tipo,
      sum(hl.horas) h, count(distinct q.empleado_id) personas
    from servicios s join servicio_cuadrilla q on q.servicio_id = s.id and q.vigente
    cross join lateral horas_laborables(lower(q.periodo), upper(q.periodo)) hl
    where s.estado in ('programada', 'en_curso', 'cerrada') and q.etapa_id is not null
      and q.periodo && tstzrange(((select min(semana) from sem)::timestamp) at time zone 'America/Mexico_City',
                                 (((select max(semana) from sem) + 7)::timestamp) at time zone 'America/Mexico_City')
    group by 1, 2, 3, 4, 5
  ),
  srv_sem as (
    select etapa_id, semana, sum(h) h,
      jsonb_agg(jsonb_build_object('id', id, 'folio', folio, 'tipo', tipo, 'horas', round(h, 1), 'personas', personas) order by folio) servicios
    from srv group by 1, 2
  )
  select s.semana, e.id, e.nombre, e.color, e.orden, e.capacidad_horas_semana,
    round(coalesce(v.h, 0), 1), round(e.capacidad_horas_semana - coalesce(v.h, 0), 1),
    round(coalesce(p.prod, 0), 1), round(coalesce(p.plan, 0), 1),
    round(coalesce(p.prod, 0) + coalesce(v.h, 0), 1),
    round(e.capacidad_horas_semana - coalesce(v.h, 0) - coalesce(p.prod, 0), 1),
    case when e.capacidad_horas_semana > 0 then round((coalesce(p.prod, 0) + coalesce(v.h, 0)) / e.capacidad_horas_semana, 3) end,
    coalesce(v.servicios, '[]'::jsonb)
  from sem s cross join etapas e
  left join op_sem p on p.etapa_id = e.id and p.semana = s.semana
  left join srv_sem v on v.etapa_id = e.id and v.semana = s.semana
  where e.activa and (puede('produccion', 1) or puede('servicio', 1))
  order by s.semana, e.orden
$$;

-- -----------------------------------------------------------------------------
-- Avisos (infraestructura de 20261003000071_avisos_pendientes.sql)
-- -----------------------------------------------------------------------------
-- Servicio pedido → gerencia de producción. Programado, reprogramado o cerrado →
-- quien lo pidió y el vendedor del cliente (para que no tenga que preguntar).
create or replace function public.aviso_servicio() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_cliente text; v_vend uuid;
begin
  select nombre, vendedor_id into v_cliente, v_vend from clientes where id = new.cliente_id;
  if tg_op = 'INSERT' then
    perform avisar(array(select usuarios_con_rol('gerente_produccion')), 'servicio_solicitado',
      format('%s pide %s', coalesce(v_cliente, 'Un cliente'), lower(nombre_tipo_servicio(new.tipo))),
      format('%s · %s', new.folio, left(new.descripcion, 140)), '/servicio/' || new.id, 'servicios', new.id::text);
    perform publicar_en_canal('produccion', format('🛠 %s pide %s (%s).', coalesce(v_cliente, 'Un cliente'),
      lower(nombre_tipo_servicio(new.tipo)), new.folio));
  elsif new.estado = 'programada' and (old.estado <> 'programada' or old.inicio is distinct from new.inicio) then
    perform avisar(array[new.solicitado_por, v_vend], 'servicio_programado',
      format('%s %s: %s', new.folio, case when old.estado = 'programada' then 'reprogramado' else 'programado' end,
             to_char(new.inicio at time zone 'America/Mexico_City', 'DD/MM HH24:MI')),
      format('%s · %s', nombre_tipo_servicio(new.tipo), coalesce(v_cliente, '')), '/servicio/' || new.id, 'servicios', new.id::text);
  elsif new.estado = 'cerrada' and old.estado <> 'cerrada' then
    perform avisar(array[new.solicitado_por, v_vend], 'servicio_cerrado', format('%s cerrado', new.folio),
      format('%s · %s · recibió %s', nombre_tipo_servicio(new.tipo), coalesce(v_cliente, ''), coalesce(new.recibio_nombre, '')),
      '/servicio/' || new.id, 'servicios', new.id::text);
  end if;
  return new;
end $$;
drop trigger if exists aviso_servicio on public.servicios;
create trigger aviso_servicio after insert or update of estado, inicio on public.servicios
  for each row execute function public.aviso_servicio();

-- Falla reportada o preventivo generado → gerencia de producción.
create or replace function public.aviso_mantenimiento() returns trigger
language plpgsql security definer set search_path = public as $$
declare m maquinas;
begin
  select * into m from maquinas where id = new.maquina_id;
  if new.tipo = 'correctivo' then
    perform avisar(array(select usuarios_con_rol('gerente_produccion')), 'falla_reportada',
      format('Falla: %s %s%s', m.numero, m.nombre, case when new.detiene then ' (parada)' else '' end),
      format('%s%s', left(new.falla, 160), coalesce(' · reportó ' || new.reportado_por_nombre, '')),
      '/servicio/maquinas/' || m.id, 'ordenes_mantenimiento', new.id::text);
    perform publicar_en_canal('produccion', format('⚠ Falla en %s %s%s: %s', m.numero, m.nombre,
      case when new.detiene then ' (parada)' else '' end, left(new.falla, 200)));
  else
    perform avisar(array(select usuarios_con_rol('gerente_produccion')), 'preventivo_por_hacer',
      format('Preventivo: %s %s', m.numero, m.nombre),
      format('%s%s', left(new.falla, 140), coalesce(' · vence el ' || to_char(new.vence, 'DD/MM'), '')),
      '/servicio/maquinas/' || m.id, 'ordenes_mantenimiento', new.id::text);
  end if;
  return new;
end $$;
drop trigger if exists aviso_mantenimiento on public.ordenes_mantenimiento;
create trigger aviso_mantenimiento after insert on public.ordenes_mantenimiento
  for each row execute function public.aviso_mantenimiento();

-- Insumos o refacciones por entregar → almacén.
create or replace function public.aviso_material_servicio() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_art text; v_folio text;
begin
  select nombre into v_art from articulos where id = new.articulo_id;
  select coalesce((select folio from servicios where id = new.servicio_id), (select folio from ordenes_mantenimiento where id = new.mantenimiento_id))
    into v_folio;
  perform avisar(array(select usuarios_con_rol('almacen')), 'material_servicio',
    format('Material para %s', v_folio), format('%s × %s', new.cantidad::float8, v_art),
    '/servicio', 'servicio_materiales', new.id::text);
  return new;
end $$;
drop trigger if exists aviso_material_servicio on public.servicio_materiales;
create trigger aviso_material_servicio after insert on public.servicio_materiales
  for each row execute function public.aviso_material_servicio();

-- Una vez al día: genera los preventivos que vencen, recuerda los vencidos y la
-- herramienta que no ha regresado (un solo aviso con las peores, no uno por pinza).
create or replace function public.avisos_servicio() returns int
language plpgsql security definer set search_path = public as $$
declare v_n int := 0; r record; k int; v_txt text;
begin
  v_n := generar_preventivos();
  for r in select o.id, o.folio, o.vence, m.id maquina_id, m.numero, m.nombre from ordenes_mantenimiento o join maquinas m on m.id = o.maquina_id
           where o.tipo = 'preventivo' and o.estado = 'pendiente' and o.vence < hoy_planta() loop
    v_n := v_n + avisar(array(select usuarios_con_rol('gerente_produccion')), 'preventivo_vencido',
      format('Preventivo vencido: %s %s', r.numero, r.nombre), format('%s venció el %s', r.folio, to_char(r.vence, 'DD/MM')),
      '/servicio/maquinas/' || r.maquina_id, 'ordenes_mantenimiento', r.id::text, true);
  end loop;
  select count(*), string_agg(format('%s (%s, %s días)', herramienta, quien, dias), '; ' order by dias desc)
    into k, v_txt from (select * from v_resguardos where vencido order by dias desc) x;
  if k > 0 then
    v_n := v_n + avisar(array(select usuarios_con_rol('gerente_produccion') union select usuarios_con_rol('almacen')),
      'herramienta_sin_regresar', format('%s %s sin regresar', k, case when k = 1 then 'herramienta' else 'herramientas' end),
      left(v_txt, 300), '/servicio/resguardos', 'resguardos', hoy_planta()::text, true);
  end if;
  return v_n;
end $$;
revoke execute on function public.avisos_servicio() from public, anon, authenticated;

do $$ begin
  perform cron.unschedule('avisos-servicio') where exists (select 1 from cron.job where jobname = 'avisos-servicio');
  -- 6:47 de Guadalajara (UTC−6, sin horario de verano desde 2022).
  perform cron.schedule('avisos-servicio', '47 12 * * *', 'select public.avisos_servicio()');
exception when others then
  raise notice 'pg_cron no está disponible: los preventivos se generan al registrar horas o con generar_preventivos() (%).', sqlerrm;
end $$;

-- -----------------------------------------------------------------------------
-- Hallazgos de servicio. hallazgos() (20261003000068) junta todas las funciones
-- hallazgos_<área>(p_area): esta solo da las filas de servicio, sin dinero (también
-- las ven el taller y almacén), y revisa sus permisos aquí adentro.
-- -----------------------------------------------------------------------------
create or replace function public.hallazgos_servicio(p_area text)
returns table (area text, tono text, titulo text, detalle text, ruta text, peso int)
language plpgsql stable security invoker set search_path = public as $$
declare
  v_hoy date := hoy_planta();
  h jsonb := '[]'::jsonb;
  k int; v_txt text; r record;
begin
  -- Lo que para al taller o se lo come sin que nadie lo planee. Solo se calcula
  -- para quien ve servicio y para las áreas que lo muestran.
  if not puede('servicio', 1) or coalesce(p_area, 'direccion') not in ('direccion', 'servicio', 'produccion') then
    return;
  end if;

  -- Máquinas paradas.
  select count(*), string_agg(format('%s %s (%s)', z.numero, z.nombre,
                                     case when z.d <= 0 then 'desde hoy' when z.d = 1 then 'desde ayer' else format('hace %s días', z.d) end), '; ')
    into k, v_txt
  from (select mq.numero, mq.nombre, v_hoy - (mq.parada_desde at time zone 'America/Mexico_City')::date d
        from v_maquinas mq where mq.estado in ('fuera_de_servicio', 'en_mantenimiento')
        order by mq.critica desc, mq.parada_desde nulls last) z;
  if k > 0 then
    h := h || jsonb_build_object('tono', 'riesgo',
      'titulo', format('%s %s fuera de servicio', k, case when k = 1 then 'máquina' else 'máquinas' end),
      'detalle', v_txt || '. Cada día parada es trabajo que se atrasa o se hace a mano.',
      'ruta', '/servicio/maquinas', 'peso', 8);
  end if;

  -- Preventivos vencidos.
  select count(*) into k from v_planes_preventivos where activo and situacion = 'vencido';
  if k > 0 then
    select format('El más atrasado: %s %s — %s (%s).', p.numero, p.maquina, p.nombre,
                  case when p.dias_restantes < 0 then format('venció hace %s días', -p.dias_restantes)
                       else format('pasó sus %s h de uso', p.proximas_horas::float8) end)
      into v_txt from v_planes_preventivos p where p.activo and p.situacion = 'vencido'
    order by coalesce(p.dias_restantes, 0) limit 1;
    h := h || jsonb_build_object('tono', 'atencion',
      'titulo', format('%s %s', k, case when k = 1 then 'preventivo vencido' else 'preventivos vencidos' end),
      'detalle', v_txt || ' Un preventivo a tiempo cuesta menos que la falla y no para al taller.',
      'ruta', '/servicio/maquinas', 'peso', 24);
  end if;

  -- Herramienta sin regresar.
  select count(*), string_agg(format('%s la tiene %s desde hace %s días', z.herramienta, z.quien, z.dias), '; ')
    into k, v_txt
  from (select * from v_resguardos where vencido order by dias desc) z;
  if k > 0 then
    h := h || jsonb_build_object('tono', 'atencion',
      'titulo', format('%s %s sin regresar', k, case when k = 1 then 'herramienta prestada' else 'herramientas prestadas' end),
      'detalle', left(v_txt, 260) || '.',
      'ruta', '/servicio/resguardos', 'peso', 32);
  end if;

  -- Servicios que chocan con la carga del taller (esta semana y la que sigue).
  for r in select c.semana, c.etapa, c.capacidad, c.horas_servicio, c.horas_produccion, c.carga - c.capacidad faltan, c.servicios
           from carga_semanal(2) c where c.horas_servicio > 0 and c.carga > c.capacidad
           order by c.semana, c.carga - c.capacidad desc limit 4 loop
    v_txt := (select string_agg(s->>'folio', ', ') from jsonb_array_elements(r.servicios) s);
    h := h || jsonb_build_object(
      'tono', case when r.semana <= v_hoy then 'riesgo' else 'atencion' end,
      -- Si la producción sola ya no cabía, el servicio no es "la causa": se dice distinto.
      'titulo', case when r.horas_produccion <= r.capacidad
        then format('%s %s no alcanza por los servicios: le faltan %s h', case when r.semana <= v_hoy then 'Esta semana' else 'La próxima semana' end,
                    r.etapa, round(r.faltan))
        else format('%s %s ya va pasada y los servicios le quitan %s h más', case when r.semana <= v_hoy then 'Esta semana' else 'La próxima semana' end,
                    r.etapa, round(r.horas_servicio)) end,
      'detalle', format('%s se %s %s h de %s; la producción liberada pide %s h de %s h de capacidad. Mover el servicio, reforzar con horas extra o recorrer una entrega.',
                        v_txt, case when jsonb_array_length(r.servicios) = 1 then 'lleva' else 'llevan' end,
                        round(r.horas_servicio), r.etapa, round(r.horas_produccion), round(r.capacidad)),
      'ruta', '/servicio', 'peso', 9);
  end loop;

  -- Servicios pedidos que nadie ha programado (con la RLS: a un vendedor, los suyos).
  select count(*) into k from servicios s where s.estado = 'solicitada' and s.solicitado_en < now() - interval '2 days';
  if k > 0 then
    select format('El más viejo: %s de %s, pedido hace %s días.', s.folio, c.nombre,
                  v_hoy - (s.solicitado_en at time zone 'America/Mexico_City')::date)
      into v_txt from servicios s join clientes c on c.id = s.cliente_id
    where s.estado = 'solicitada' order by s.solicitado_en limit 1;
    h := h || jsonb_build_object('tono', 'atencion',
      'titulo', format('%s %s sin fecha', k, case when k = 1 then 'servicio pedido' else 'servicios pedidos' end),
      'detalle', v_txt || ' Sin fecha, el cliente le vuelve a llamar al vendedor.',
      'ruta', '/servicio', 'peso', 28);
  end if;

  return query
    select 'servicio'::text, e->>'tono', e->>'titulo', e->>'detalle', e->>'ruta', (e->>'peso')::int
    from jsonb_array_elements(h) e;
end $$;

-- -----------------------------------------------------------------------------
-- En vivo: el calendario y la ficha de la máquina se recargan solos.
-- -----------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['servicios', 'servicio_cuadrilla', 'servicio_materiales', 'servicio_evidencias',
                           'maquinas', 'ordenes_mantenimiento', 'resguardos'] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null; when undefined_object then null;
    end;
  end loop;
end $$;

select public.optimizar_politicas();

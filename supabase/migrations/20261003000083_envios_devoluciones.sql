-- =============================================================================
-- Envíos con evidencia, saldo de paquetería, y devoluciones y reclamos.
--
-- Del análisis del chat interno (§2.2, §2.3 y §3.6–3.8):
--  * Ventas en línea publica ≈65 guías al mes en un canal de 15 personas, con el
--    domicilio del cliente escrito ahí (≈390 mensajes con datos personales).
--  * 221 "cotízame el envío", 128 con peso y medidas tecleados a mano; el paquete
--    de la cosedora manual se tecleó más de 20 veces y con datos distintos. 77
--    veces se le pidió al almacén "pásame peso y medidas". El dato nunca se guarda.
--  * 322 fotos de paquetes antes de salir y solo 2 dicen de qué venta son; el chat
--    borra archivos. La regla de fotografiar nació de un reclamo de ML por "llegó
--    incompleta su compra", pero cuando llega el reclamo la foto no se encuentra.
--  * "El segundo equipo que se va sin que revisen número de serie" y "hizo falta
--    darle salida a esta venta" (el inventario no se descontó). 76 avisos de "hoy
--    vienen por el equipo" y 74 recargas de saldo de paquetería pedidas por chat.
--  * Devoluciones de ML en 31 días distintos, reclamos en 22: el código de
--    autorización viaja por chat y luego "¿llegó bien la devolución?".
--
-- Lo que la base hace cumplir:
--  * El empaque (peso, medidas y piezas por paquete) vive en el artículo. Se
--    captura una vez (almacén o ingeniería) y prellena cada envío.
--  * Un envío sale del pedido: partidas, bultos y destino se copian solos. El
--    domicilio lo ve quien ve el pedido y almacén; no viaja por chat.
--  * Empacar exige foto (1 a 6), el check list de salida completo y, si es equipo,
--    su número de serie, que tiene que ser el de su orden de producción. Esa
--    evidencia no se cambia ni se borra (ni el registro ni el archivo).
--  * Al salir de planta se descuenta del inventario lo que falte, UNA vez, con un
--    movimiento inmutable. Respeta lo apartado para otros y el almacén elegido;
--    lo que surte Full sale de "Almacén ML". Un equipo fabricado no se descuenta
--    (su material ya salió con la orden de producción) y lo que ya se había
--    sacado a mano con el pedido tampoco se descuenta dos veces.
--  * Saldo de paquetería = recargas − costo de las guías, con aviso de saldo bajo.
--  * Devoluciones, reclamos y cancelaciones ligados al pedido. Al recibir, almacén
--    revisa con fotos y decide: reingreso (una sola entrada), merma (pasa por el
--    flujo de ajustes) o reclamo a la paquetería. Junto al reclamo se ve la
--    evidencia de salida, que es con lo que uno se defiende.
--  * Un envío o devolución lo ve quien ve el pedido (pedido_visible) y almacén.
--    Ninguna vista de aquí trae costos de artículos; el costo de envío sí es de
--    ventas.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Permisos y configuración
-- -----------------------------------------------------------------------------
-- Nivel 1 ver · 2 pedir, cotizar, registrar guía (y empacar si además es almacén)
-- · 3 administrar (ve todos, catálogo de paqueterías, check list y recargas).
-- finanzas 1: paga las recargas y ve lo que cuesta enviar cada pedido.
-- gerente_produccion 1: "hoy vienen por la bazuca" — tiene que ver qué equipo sale.
-- compras, ingeniería, taller y RRHH no: no mueven paquetes ni ven domicilios.
insert into public.permisos_rol (rol, modulo, nivel) values
  ('direccion', 'envios', 3), ('admin', 'envios', 3), ('gerente_ventas', 'envios', 3),
  ('ventas', 'envios', 2), ('almacen', 'envios', 2),
  ('finanzas', 'envios', 1), ('gerente_produccion', 'envios', 1)
on conflict (rol, modulo) do nothing;

insert into public.configuracion (clave, valor, descripcion) values
  ('envios', '{"saldo_minimo": 1500, "horas_para_cotizar": 4, "horas_aviso_reclamo": 6, "horas_respuesta_reclamo": 24, "dias_devolucion": 3, "max_fotos": 6, "dias_en_camino": 5}',
   'Envíos y devoluciones. saldo_minimo: abajo de esto se avisa (cada paquetería puede tener el suyo); horas_para_cotizar: cuándo se recuerda una solicitud sin cotizar; horas_aviso_reclamo: con cuánta anticipación se avisa que un reclamo vence; horas_respuesta_reclamo y dias_devolucion: plazos por omisión al dar de alta; max_fotos: fotos de empaque por envío; dias_en_camino: cuándo un envío "en camino" ya es raro.')
on conflict (clave) do nothing;

-- Movimientos por pedido: la salida de un envío busca lo que ya salió a mano con
-- ese pedido, y el hallazgo de "entregado sin salida" también.
create index if not exists movimientos_pedido on public.movimientos_inventario (pedido_id, articulo_id) where pedido_id is not null;

-- -----------------------------------------------------------------------------
-- 2. Empaque en el artículo (no es costo: lo ve ventas)
-- -----------------------------------------------------------------------------
alter table public.articulos
  add column if not exists paquete_kg numeric(10,2) check (paquete_kg > 0),
  add column if not exists paquete_largo_cm numeric(8,1) check (paquete_largo_cm > 0),
  add column if not exists paquete_ancho_cm numeric(8,1) check (paquete_ancho_cm > 0),
  add column if not exists paquete_alto_cm numeric(8,1) check (paquete_alto_cm > 0),
  add column if not exists paquete_piezas numeric(12,3) not null default 1 check (paquete_piezas > 0),
  add column if not exists paquete_medido_por uuid references public.perfiles(id),
  add column if not exists paquete_medido_en timestamptz;
comment on column public.articulos.paquete_piezas is
  'Cuántas piezas van en un paquete con ese peso y medidas (una cosedora por caja, 10 catarinas por caja…).';

create or replace function public.guardar_empaque(p_articulo uuid, p_kg numeric, p_largo numeric, p_ancho numeric,
  p_alto numeric, p_piezas numeric default 1) returns void
language plpgsql security definer set search_path = public as $$
begin
  -- Lo captura quien lo mide (almacén) o quien diseña el equipo (ingeniería).
  -- Ventas lo lee; si lo tecleara cada vendedor tendríamos otra vez 20 versiones.
  if not (puede('inventario', 2) or puede('costeo', 2)) then
    raise exception 'El peso y las medidas del paquete los capturan almacén o ingeniería' using errcode = '42501';
  end if;
  if coalesce(p_kg, 0) <= 0 or coalesce(p_largo, 0) <= 0 or coalesce(p_ancho, 0) <= 0 or coalesce(p_alto, 0) <= 0 then
    raise exception 'Escribe peso (kg) y largo, ancho y alto (cm) del paquete, mayores a cero';
  end if;
  if coalesce(p_piezas, 0) <= 0 then raise exception 'Las piezas por paquete deben ser más de cero'; end if;
  if p_kg > 20000 or greatest(p_largo, p_ancho, p_alto) > 3000 then
    raise exception '% kg y % × % × % cm parecen error de captura (¿gramos o milímetros?)', p_kg, p_largo, p_ancho, p_alto;
  end if;
  update articulos set paquete_kg = round(p_kg, 2), paquete_largo_cm = round(p_largo, 1), paquete_ancho_cm = round(p_ancho, 1),
    paquete_alto_cm = round(p_alto, 1), paquete_piezas = p_piezas, paquete_medido_por = auth.uid(), paquete_medido_en = now()
  where id = p_articulo;
  if not found then raise exception 'No existe el artículo'; end if;
end $$;

-- -----------------------------------------------------------------------------
-- 3. Catálogos: paqueterías, recargas y check list de salida
-- -----------------------------------------------------------------------------
create table if not exists public.paqueterias (
  id serial primary key,
  nombre text not null unique check (length(trim(nombre)) > 1),
  usa_saldo boolean not null default true,      -- prepago: cada guía se descuenta del saldo de la plataforma
  saldo_minimo numeric(12,2) check (saldo_minimo >= 0),   -- null = el de configuración
  sitio text,
  activa boolean not null default true,
  notas text
);
insert into public.paqueterias (nombre, usa_saldo, notas)
select v.nombre, v.usa_saldo, v.notas from (values
  ('Estafeta', true, null), ('FedEx', true, null), ('DHL', true, null), ('Paquetexpress', true, null),
  ('Mercado Envíos', false, 'La guía la genera Mercado Libre y el costo sale de la venta: no consume saldo.'),
  ('Flete contratado', false, 'Equipos y bultos grandes; se paga por viaje.')) v(nombre, usa_saldo, notas)
where not exists (select 1 from public.paqueterias);

-- Recargas de saldo (las 74 que se pedían por chat). Una corrección (cargo por
-- sobrepeso, reembolso) va con monto negativo y su explicación.
create table if not exists public.recargas_paqueteria (
  id uuid primary key default gen_random_uuid(),
  paqueteria_id int not null references public.paqueterias(id),
  monto numeric(12,2) not null check (monto <> 0),
  fecha date not null default (now() at time zone 'America/Mexico_City')::date,
  referencia text,
  nota text,
  registrado_por uuid default auth.uid() references public.perfiles(id),
  creado_en timestamptz not null default now(),
  check (monto > 0 or length(trim(coalesce(nota, ''))) >= 5)
);
create index if not exists recargas_paqueteria_paq on public.recargas_paqueteria (paqueteria_id, fecha);

create table if not exists public.checklist_salida (
  id serial primary key,
  aplica text not null check (aplica in ('equipo', 'componente', 'todos')),
  texto text not null check (length(trim(texto)) > 2),
  orden int not null default 0,
  activo boolean not null default true
);
insert into public.checklist_salida (aplica, texto, orden)
select v.aplica, v.texto, v.orden from (values
  ('equipo', 'Número de serie revisado contra la placa del equipo', 1),
  ('equipo', 'Equipo probado y funcionando', 2),
  ('equipo', 'Manual y póliza de garantía en la caja', 3),
  ('equipo', 'Accesorios y refacciones del pedido completos', 4),
  ('equipo', 'Tornillería de ensamble completa', 5),
  ('equipo', 'Bien sujeto y protegido para el viaje', 6),
  ('componente', 'Piezas completas según el pedido', 1),
  ('componente', 'Tornillería completa', 2),
  ('componente', 'Manual o instructivo (si lleva)', 3),
  ('componente', 'Protegido: emplayado, esquineros o relleno', 4),
  ('todos', 'Etiqueta con folio del pedido o guía pegada y legible', 9)) v(aplica, texto, orden)
where not exists (select 1 from public.checklist_salida);

-- -----------------------------------------------------------------------------
-- 4. Envíos
-- -----------------------------------------------------------------------------
-- Tipos:
--   paqueteria  guía de paquetería (con saldo o Mercado Envíos)
--   flete       equipo o bultos grandes con transportista
--   recoge      el cliente pasa a planta ("hoy vienen por él")
--   full        venta de ML que surte Full desde su bodega: sale de Almacén ML
--   a_full      envío de mercancía a la bodega de Full: traspaso a Almacén ML
--   proveedor   lo manda el proveedor directo (bandas): no sale de nuestro almacén
create table if not exists public.envios (
  id uuid primary key default gen_random_uuid(),
  folio text not null default '' unique,
  pedido_id uuid references public.pedidos(id),
  tipo text not null check (tipo in ('paqueteria', 'flete', 'recoge', 'full', 'a_full', 'proveedor')),
  estado text not null default 'solicitado'
    check (estado in ('solicitado', 'cotizado', 'guia_lista', 'empacado', 'enviado', 'entregado', 'cancelado')),
  paqueteria_id int references public.paqueterias(id),
  servicio text,                                   -- "terrestre", "día siguiente"
  -- Destino copiado del pedido o del contacto al pedir el envío: nadie lo vuelve a teclear.
  contacto_id uuid references public.contactos(id) on delete set null,
  destinatario text,
  telefono text,
  destino text,
  fecha_recoleccion date,                          -- cuándo pasa la paquetería o el cliente
  notas text,
  costo_cotizado numeric(12,2) check (costo_cotizado >= 0),
  costo_real numeric(12,2) check (costo_real >= 0),
  numero_guia text,
  -- Quién y cuándo, paso por paso.
  solicitado_por uuid default auth.uid() references public.perfiles(id),
  solicitado_en timestamptz not null default now(),
  cotizado_por uuid references public.perfiles(id),
  cotizado_en timestamptz,
  guia_por uuid references public.perfiles(id),
  guia_en timestamptz,
  empacado_por uuid references public.perfiles(id),
  empacado_en timestamptz,
  checklist jsonb,                                 -- lo que se palomeó al empacar (se congela)
  enviado_por uuid references public.perfiles(id),
  enviado_en timestamptz,
  entregado_por uuid references public.perfiles(id),
  entregado_en timestamptz,
  recibio text,                                    -- quién se lo llevó o lo recibió
  cancelado_por uuid references public.perfiles(id),
  cancelado_en timestamptz,
  motivo_cancelacion text,
  guia_reembolsada boolean,                        -- al cancelar con guía: ¿regresó el saldo?
  inventario_descontado_en timestamptz,            -- la salida de inventario ya se hizo (una sola vez)
  inventario_descontado_por uuid references public.perfiles(id),
  actualizado_en timestamptz not null default now(),
  check ((tipo = 'a_full') = (pedido_id is null))
);
create index if not exists envios_pedido on public.envios (pedido_id);
create index if not exists envios_abiertos on public.envios (estado, fecha_recoleccion) where estado not in ('entregado', 'cancelado');

create table if not exists public.envio_lineas (
  id uuid primary key default gen_random_uuid(),
  envio_id uuid not null references public.envios(id) on delete cascade,
  orden int not null default 0,
  pedido_linea_id uuid references public.pedido_lineas(id),
  articulo_id uuid references public.articulos(id),
  descripcion text not null,
  cantidad numeric(14,3) not null check (cantidad > 0),
  almacen_id int references public.almacenes(id),         -- de dónde sale
  series text[] not null default '{}',                     -- números de serie (equipos), al empacar
  -- Lo que hizo la salida de inventario con esta partida.
  cantidad_descontada numeric(14,3),
  movimiento_id bigint references public.movimientos_inventario(id),
  traspaso_id uuid,
  nota_inventario text
);
create index if not exists envio_lineas_envio on public.envio_lineas (envio_id, orden);
create index if not exists envio_lineas_pedido_linea on public.envio_lineas (pedido_linea_id);
create index if not exists envio_lineas_articulo on public.envio_lineas (articulo_id);

create table if not exists public.envio_bultos (
  id uuid primary key default gen_random_uuid(),
  envio_id uuid not null references public.envios(id) on delete cascade,
  orden int not null default 0,
  articulo_id uuid references public.articulos(id),        -- de qué artículo salió el dato (para ofrecer guardarlo)
  contenido text,
  piezas numeric(12,3) check (piezas > 0),
  peso_kg numeric(10,2) check (peso_kg > 0),
  largo_cm numeric(8,1) check (largo_cm > 0),
  ancho_cm numeric(8,1) check (ancho_cm > 0),
  alto_cm numeric(8,1) check (alto_cm > 0)
);
create index if not exists envio_bultos_envio on public.envio_bultos (envio_id, orden);

-- -----------------------------------------------------------------------------
-- 5. Devoluciones, reclamos y cancelaciones
-- -----------------------------------------------------------------------------
create table if not exists public.devoluciones (
  id uuid primary key default gen_random_uuid(),
  folio text not null default '' unique,
  pedido_id uuid not null references public.pedidos(id),
  envio_id uuid references public.envios(id),
  tipo text not null check (tipo in ('devolucion', 'reclamo', 'cancelacion')),
  estado text not null default 'abierta' check (estado in ('abierta', 'respondida', 'recibida', 'resuelta', 'cancelada')),
  codigo_autorizacion text,                        -- el que hoy se pasa por chat
  motivo text not null check (length(trim(motivo)) >= 3),
  fecha_esperada date,                             -- devolución: cuándo llega a planta
  fecha_limite timestamptz,                        -- reclamo: hasta cuándo se puede responder
  responsable_id uuid references public.perfiles(id),
  respuesta text,
  respondido_por uuid references public.perfiles(id),
  respondido_en timestamptz,
  recibido_por uuid references public.perfiles(id),
  recibido_en timestamptz,
  nota_recepcion text,
  resultado text check (resultado in ('reingreso', 'merma', 'reclamo_transportista', 'a_favor', 'en_contra', 'sin_efecto')),
  almacen_id int references public.almacenes(id),
  reclamo_transportista text,                      -- folio del reclamo con la paquetería
  monto_reclamado numeric(12,2) check (monto_reclamado >= 0),
  nota_resolucion text,
  resuelto_por uuid references public.perfiles(id),
  resuelto_en timestamptz,
  reingresado_en timestamptz,                      -- la entrada al inventario ya se hizo (una sola vez)
  cancelado_por uuid references public.perfiles(id),
  cancelado_en timestamptz,
  motivo_cancelacion text,
  creado_por uuid default auth.uid() references public.perfiles(id),
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);
create index if not exists devoluciones_pedido on public.devoluciones (pedido_id);
create index if not exists devoluciones_abiertas on public.devoluciones (estado, tipo) where estado not in ('resuelta', 'cancelada');

create table if not exists public.devolucion_lineas (
  id uuid primary key default gen_random_uuid(),
  devolucion_id uuid not null references public.devoluciones(id) on delete cascade,
  pedido_linea_id uuid references public.pedido_lineas(id),
  articulo_id uuid references public.articulos(id),
  descripcion text not null,
  cantidad numeric(14,3) not null check (cantidad > 0),
  cantidad_recibida numeric(14,3) check (cantidad_recibida >= 0),
  movimiento_id bigint references public.movimientos_inventario(id),
  ajuste_id uuid references public.ajustes_inventario(id)
);
create index if not exists devolucion_lineas_dev on public.devolucion_lineas (devolucion_id);

-- Evidencia (fotos de empaque, PDF de la guía, fotos al recibir una devolución) y
-- línea de tiempo. No se cambian ni se borran.
create table if not exists public.evidencias_envio (
  id uuid primary key default gen_random_uuid(),
  envio_id uuid references public.envios(id) on delete cascade,
  devolucion_id uuid references public.devoluciones(id) on delete cascade,
  tipo text not null check (tipo in ('empaque', 'guia', 'entrega', 'recepcion', 'documento')),
  ruta text not null unique,
  nota text,
  subido_por uuid default auth.uid() references public.perfiles(id),
  en timestamptz not null default now(),
  check (num_nonnulls(envio_id, devolucion_id) = 1)
);
create index if not exists evidencias_envio_envio on public.evidencias_envio (envio_id);
create index if not exists evidencias_envio_dev on public.evidencias_envio (devolucion_id);

create table if not exists public.eventos_envio (
  id bigserial primary key,
  envio_id uuid references public.envios(id) on delete cascade,
  devolucion_id uuid references public.devoluciones(id) on delete cascade,
  tipo text not null,
  nota text,
  usuario_id uuid default auth.uid() references public.perfiles(id),
  en timestamptz not null default now(),
  check (num_nonnulls(envio_id, devolucion_id) = 1)
);
create index if not exists eventos_envio_envio on public.eventos_envio (envio_id, en);
create index if not exists eventos_envio_dev on public.eventos_envio (devolucion_id, en);

-- -----------------------------------------------------------------------------
-- 6. Folios, fechas y lo que no se puede cambiar
-- -----------------------------------------------------------------------------
drop trigger if exists folio on public.envios;
create trigger folio before insert on public.envios for each row execute function public.trg_folio('ENV');

create or replace function public.trg_folio_devolucion() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(new.folio, '') = '' then
    new.folio := siguiente_folio(case new.tipo when 'reclamo' then 'REC' when 'cancelacion' then 'CAN' else 'DEV' end);
  end if;
  return new;
end $$;
drop trigger if exists folio on public.devoluciones;
create trigger folio before insert on public.devoluciones for each row execute function public.trg_folio_devolucion();

drop trigger if exists tocar on public.envios;
create trigger tocar before update on public.envios for each row execute function public.tocar_actualizado();
drop trigger if exists tocar on public.devoluciones;
create trigger tocar before update on public.devoluciones for each row execute function public.tocar_actualizado();

drop trigger if exists auditar on public.paqueterias;
create trigger auditar after insert or update or delete on public.paqueterias for each row execute function public.auditar();
drop trigger if exists auditar on public.checklist_salida;
create trigger auditar after insert or update or delete on public.checklist_salida for each row execute function public.auditar();
drop trigger if exists auditar on public.recargas_paqueteria;
create trigger auditar after insert or update or delete on public.recargas_paqueteria for each row execute function public.auditar();

-- Evidencia y línea de tiempo: como los movimientos de inventario, solo se agregan.
create or replace function public.evidencia_inalterable() returns trigger
language plpgsql as $$
begin
  raise exception 'La evidencia de envíos y devoluciones no se cambia ni se borra: es la prueba si llega un reclamo'
    using errcode = '42501';
end $$;
drop trigger if exists inalterable on public.evidencias_envio;
create trigger inalterable before update or delete on public.evidencias_envio for each row execute function public.evidencia_inalterable();
drop trigger if exists inalterable on public.eventos_envio;
create trigger inalterable before update or delete on public.eventos_envio for each row execute function public.evidencia_inalterable();
drop trigger if exists inalterable_truncate on public.evidencias_envio;
create trigger inalterable_truncate before truncate on public.evidencias_envio for each statement execute function public.evidencia_inalterable();

-- Lo que se registró al empacar (check list, series, bultos, quién y cuándo) se
-- congela: ni una función nueva ni un cambio a mano lo puede reescribir después.
create or replace function public.trg_envio_congelado() returns trigger
language plpgsql as $$
begin
  if old.empacado_en is not null and (new.checklist, new.empacado_por, new.empacado_en)
       is distinct from (old.checklist, old.empacado_por, old.empacado_en) then
    raise exception 'La evidencia de salida de % ya quedó registrada y no se cambia', old.folio using errcode = '42501';
  end if;
  if old.inventario_descontado_en is not null and new.inventario_descontado_en is distinct from old.inventario_descontado_en then
    raise exception 'La salida de inventario de % ya se hizo', old.folio using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists congelado on public.envios;
create trigger congelado before update on public.envios for each row execute function public.trg_envio_congelado();

create or replace function public.trg_envio_partes_congeladas() returns trigger
language plpgsql as $$
declare v_empacado timestamptz;
begin
  select empacado_en into v_empacado from public.envios where id = coalesce(new.envio_id, old.envio_id);
  if v_empacado is null then return coalesce(new, old); end if;
  if tg_table_name = 'envio_bultos' or tg_op <> 'UPDATE' then
    raise exception 'El envío ya se empacó: sus partidas y bultos quedaron como evidencia' using errcode = '42501';
  end if;
  -- De una partida empacada solo se registra lo que hizo la salida de inventario.
  if (new.series, new.cantidad, new.articulo_id, new.descripcion, new.pedido_linea_id, new.almacen_id)
       is distinct from (old.series, old.cantidad, old.articulo_id, old.descripcion, old.pedido_linea_id, old.almacen_id) then
    raise exception 'El envío ya se empacó: el número de serie y las cantidades quedaron como evidencia' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists congelado on public.envio_lineas;
create trigger congelado before insert or update or delete on public.envio_lineas for each row execute function public.trg_envio_partes_congeladas();
drop trigger if exists congelado on public.envio_bultos;
create trigger congelado before insert or update or delete on public.envio_bultos for each row execute function public.trg_envio_partes_congeladas();

-- -----------------------------------------------------------------------------
-- 7. Quién ve qué (RLS). Escribir pasa por las funciones de abajo.
-- -----------------------------------------------------------------------------
-- Almacén (envios 2 + inventario 2) y la administración del módulo (envios 3) ven
-- todos; los demás, los envíos de los pedidos que ya ven. "produccion" nivel 2 ve
-- todos los pedidos, pero sin "envios" no ve domicilios.
create or replace function public.ve_todos_los_envios() returns boolean
language sql stable security definer set search_path = public as $$
  select puede('envios', 3) or (puede('envios', 2) and puede('inventario', 2))
$$;

-- Los envíos y devoluciones que ve quien pregunta, calculados de una vez y no por
-- renglón: una política que llama pedido_visible(id) en cada fila le cuesta medio
-- segundo a cada consulta de un vendedor. Es la misma regla que pedido_visible():
-- las áreas que ven todos los pedidos, o los pedidos propios o con crédito compartido.
create or replace function public.mis_envios_visibles() returns setof uuid
language sql stable security definer set search_path = public as $$
  with yo as materialized (
    select puede('envios', 1) ve, ve_todos_los_envios() todos,
      puede('ventas', 3) or puede('produccion', 2) or puede('finanzas', 1) or puede('inventario', 2) pedidos,
      auth.uid() id)
  select e.id from envios e, yo
  where yo.ve and (yo.todos
    or (e.pedido_id is not null and (yo.pedidos or e.pedido_id in (
          select p.id from pedidos p where p.vendedor_id = yo.id
          union select v.pedido_id from pedido_vendedores v where v.vendedor_id = yo.id)))
    or (e.pedido_id is null and e.solicitado_por = yo.id))
$$;

create or replace function public.mis_devoluciones_visibles() returns setof uuid
language sql stable security definer set search_path = public as $$
  with yo as materialized (
    select puede('envios', 1) ve, ve_todos_los_envios() todos,
      puede('ventas', 3) or puede('produccion', 2) or puede('finanzas', 1) or puede('inventario', 2) pedidos,
      auth.uid() id)
  select d.id from devoluciones d, yo
  where yo.ve and (yo.todos or yo.pedidos or d.pedido_id in (
    select p.id from pedidos p where p.vendedor_id = yo.id
    union select v.pedido_id from pedido_vendedores v where v.vendedor_id = yo.id))
$$;

create or replace function public.envio_visible(p_envio uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select p_envio in (select mis_envios_visibles())
$$;

create or replace function public.devolucion_visible(p_dev uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select p_dev in (select mis_devoluciones_visibles())
$$;

alter table public.paqueterias enable row level security;
alter table public.recargas_paqueteria enable row level security;
alter table public.checklist_salida enable row level security;
alter table public.envios enable row level security;
alter table public.envio_lineas enable row level security;
alter table public.envio_bultos enable row level security;
alter table public.devoluciones enable row level security;
alter table public.devolucion_lineas enable row level security;
alter table public.evidencias_envio enable row level security;
alter table public.eventos_envio enable row level security;

drop policy if exists ver on public.paqueterias;
create policy ver on public.paqueterias for select to authenticated using ((select puede('envios', 1)));
drop policy if exists editar on public.paqueterias;
create policy editar on public.paqueterias for all to authenticated
  using ((select puede('envios', 3))) with check ((select puede('envios', 3)));

-- La lista de recargas es de quien administra o paga; el saldo (agregado) lo da
-- saldos_paqueteria() también a quien genera guías.
drop policy if exists ver on public.recargas_paqueteria;
create policy ver on public.recargas_paqueteria for select to authenticated
  using ((select ve_todos_los_envios()) or (select puede('finanzas', 1)));

drop policy if exists ver on public.checklist_salida;
create policy ver on public.checklist_salida for select to authenticated using ((select puede('envios', 1)));
drop policy if exists editar on public.checklist_salida;
create policy editar on public.checklist_salida for all to authenticated
  using ((select puede('envios', 3)) or (select puede('inventario', 3)))
  with check ((select puede('envios', 3)) or (select puede('inventario', 3)));

drop policy if exists ver on public.envios;
create policy ver on public.envios for select to authenticated using (id in (select mis_envios_visibles()));
drop policy if exists ver on public.envio_lineas;
create policy ver on public.envio_lineas for select to authenticated using (envio_id in (select mis_envios_visibles()));
drop policy if exists ver on public.envio_bultos;
create policy ver on public.envio_bultos for select to authenticated using (envio_id in (select mis_envios_visibles()));

drop policy if exists ver on public.devoluciones;
create policy ver on public.devoluciones for select to authenticated using (id in (select mis_devoluciones_visibles()));
drop policy if exists ver on public.devolucion_lineas;
create policy ver on public.devolucion_lineas for select to authenticated using (devolucion_id in (select mis_devoluciones_visibles()));

drop policy if exists ver on public.evidencias_envio;
create policy ver on public.evidencias_envio for select to authenticated using (
  envio_id in (select mis_envios_visibles()) or devolucion_id in (select mis_devoluciones_visibles()));
drop policy if exists ver on public.eventos_envio;
create policy ver on public.eventos_envio for select to authenticated using (
  envio_id in (select mis_envios_visibles()) or devolucion_id in (select mis_devoluciones_visibles()));

revoke insert, update, delete on public.envios, public.envio_lineas, public.envio_bultos, public.devoluciones,
  public.devolucion_lineas, public.evidencias_envio, public.eventos_envio, public.recargas_paqueteria from anon, authenticated;

-- -----------------------------------------------------------------------------
-- 8. Archivos: bucket privado "envios". envios/<id>/… y devoluciones/<id>/… los
-- ve quien ve el registro. No hay política de borrar ni de reemplazar.
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('envios', 'envios', false, 10485760,
        array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf'])
on conflict (id) do update set public = false;

drop policy if exists envios_ver on storage.objects;
create policy envios_ver on storage.objects for select to authenticated using (
  bucket_id = 'envios' and (
    ((storage.foldername(name))[1] = 'envios' and (storage.foldername(name))[2] in (select x::text from public.mis_envios_visibles() x))
    or ((storage.foldername(name))[1] = 'devoluciones' and (storage.foldername(name))[2] in (select x::text from public.mis_devoluciones_visibles() x))));
drop policy if exists envios_subir on storage.objects;
create policy envios_subir on storage.objects for insert to authenticated with check (
  bucket_id = 'envios' and (select public.puede('envios', 2)) and (
    ((storage.foldername(name))[1] = 'envios' and (storage.foldername(name))[2] in (select x::text from public.mis_envios_visibles() x))
    or ((storage.foldername(name))[1] = 'devoluciones' and (storage.foldername(name))[2] in (select x::text from public.mis_devoluciones_visibles() x))));

-- -----------------------------------------------------------------------------
-- 9. Ayudas
-- -----------------------------------------------------------------------------
create or replace function public.nombre_tipo_envio(p_tipo text) returns text
language sql immutable as $$
  select case p_tipo when 'paqueteria' then 'Paquetería' when 'flete' then 'Flete' when 'recoge' then 'Recoge el cliente'
    when 'full' then 'Lo surte Full (ML)' when 'a_full' then 'Envío a Full' when 'proveedor' then 'Directo del proveedor'
    else p_tipo end
$$;

create or replace function public.almacen_ml() returns int
language sql stable security definer set search_path = public as $$
  select id from almacenes where tipo = 'mercadolibre' and activo order by id limit 1
$$;

-- De dónde sale un artículo si nadie dice otra cosa: su almacén preferido si ahí
-- alcanza, si no el almacén de planta donde hay más.
create or replace function public.almacen_de_salida(p_articulo uuid, p_cantidad numeric) returns int
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select a.almacen_preferido_id from articulos a
     join existencias x on x.articulo_id = a.id and x.almacen_id = a.almacen_preferido_id
     join almacenes al on al.id = a.almacen_preferido_id
     where a.id = p_articulo and al.disponible_para_planta and al.activo and x.cantidad >= p_cantidad),
    (select x.almacen_id from existencias x join almacenes al on al.id = x.almacen_id
     where x.articulo_id = p_articulo and al.disponible_para_planta and al.activo and x.cantidad > 0
     order by x.cantidad desc, al.id limit 1),
    (select a.almacen_preferido_id from articulos a where a.id = p_articulo),
    (select id from almacenes where disponible_para_planta and activo order by id limit 1))
$$;

-- Órdenes de producción que fabrican la partida de un pedido (las de stock que se
-- ligaron al pedido sin partida cuentan si son del mismo equipo).
create or replace function public.ordenes_de_partida(p_pedido uuid, p_pedido_linea uuid, p_articulo uuid)
returns setof public.ordenes_produccion
language sql stable security definer set search_path = public as $$
  select o.* from ordenes_produccion o
  where o.estado <> 'cancelada' and p_pedido is not null
    and (o.pedido_linea_id = p_pedido_linea or (o.pedido_id = p_pedido and o.pedido_linea_id is null and o.articulo_id = p_articulo))
$$;
revoke execute on function public.ordenes_de_partida(uuid, uuid, uuid) from public, anon, authenticated;

-- Bultos prellenados con el empaque de cada artículo × cantidad. Lo que no tiene
-- empaque queda como un bulto sin medidas: almacén lo mide y se ofrece guardarlo.
create or replace function public.prellenar_bultos(p_envio uuid) returns int
language plpgsql security definer set search_path = public as $$
declare l record; v_n int; v_rest numeric; v_orden int := 0;
begin
  delete from envio_bultos where envio_id = p_envio;
  for l in select el.articulo_id, el.descripcion, el.cantidad, a.paquete_kg, a.paquete_largo_cm, a.paquete_ancho_cm,
                  a.paquete_alto_cm, a.paquete_piezas
           from envio_lineas el left join articulos a on a.id = el.articulo_id
           where el.envio_id = p_envio order by el.orden, el.id loop
    if l.paquete_kg is not null and l.paquete_largo_cm is not null and l.paquete_ancho_cm is not null and l.paquete_alto_cm is not null then
      v_n := ceil(l.cantidad / l.paquete_piezas);
      if v_n <= 20 then
        v_rest := l.cantidad;
        for k in 1 .. v_n loop
          v_orden := v_orden + 1;
          insert into envio_bultos (envio_id, orden, articulo_id, contenido, piezas, peso_kg, largo_cm, ancho_cm, alto_cm)
          values (p_envio, v_orden, l.articulo_id, l.descripcion, least(l.paquete_piezas, v_rest), l.paquete_kg,
                  l.paquete_largo_cm, l.paquete_ancho_cm, l.paquete_alto_cm);
          v_rest := v_rest - least(l.paquete_piezas, v_rest);
        end loop;
        continue;
      end if;
    end if;
    v_orden := v_orden + 1;
    insert into envio_bultos (envio_id, orden, articulo_id, contenido, piezas)
    values (p_envio, v_orden, l.articulo_id, l.descripcion, l.cantidad);
  end loop;
  return v_orden;
end $$;
revoke execute on function public.prellenar_bultos(uuid) from public, anon, authenticated;

-- Reemplaza los bultos con lo que pesó y midió almacén.
create or replace function public.reemplazar_bultos(p_envio uuid, p_bultos jsonb) returns int
language plpgsql security definer set search_path = public as $$
declare b jsonb; v_orden int := 0;
begin
  if jsonb_typeof(coalesce(p_bultos, '[]'::jsonb)) <> 'array' then raise exception 'Los bultos van en una lista'; end if;
  delete from envio_bultos where envio_id = p_envio;
  for b in select * from jsonb_array_elements(p_bultos) loop
    if coalesce((b->>'peso_kg')::numeric, 1) <= 0 or coalesce((b->>'largo_cm')::numeric, 1) <= 0
       or coalesce((b->>'ancho_cm')::numeric, 1) <= 0 or coalesce((b->>'alto_cm')::numeric, 1) <= 0
       or coalesce((b->>'piezas')::numeric, 1) <= 0 then
      raise exception 'Peso, medidas y piezas de cada bulto van mayores a cero';
    end if;
    v_orden := v_orden + 1;
    insert into envio_bultos (envio_id, orden, articulo_id, contenido, piezas, peso_kg, largo_cm, ancho_cm, alto_cm)
    values (p_envio, v_orden, nullif(b->>'articulo_id', '')::uuid, nullif(trim(b->>'contenido'), ''),
            (b->>'piezas')::numeric, round((b->>'peso_kg')::numeric, 2), round((b->>'largo_cm')::numeric, 1),
            round((b->>'ancho_cm')::numeric, 1), round((b->>'alto_cm')::numeric, 1));
  end loop;
  return v_orden;
end $$;
revoke execute on function public.reemplazar_bultos(uuid, jsonb) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 10. Pedir un envío (desde el pedido) y envío a Full (reabasto de ML)
-- -----------------------------------------------------------------------------
create or replace function public.pedir_envio(p_pedido uuid, p_tipo text default 'paqueteria', p_lineas jsonb default null,
  p_paqueteria int default null, p_contacto uuid default null, p_destino text default null,
  p_fecha_recoleccion date default null, p_notas text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare p pedidos; c contactos; v_cli clientes; v_id uuid; l record; v_cant numeric; v_orden int := 0; v_ml int := almacen_ml();
begin
  if not puede('envios', 2) then raise exception 'Sin permiso para pedir envíos' using errcode = '42501'; end if;
  select * into p from pedidos where id = p_pedido;
  if p.id is null or not (pedido_visible(p.id) or ve_todos_los_envios()) then
    raise exception 'No encontré el pedido' using errcode = '42501';
  end if;
  if p.estado = 'cancelado' then raise exception 'El pedido % está cancelado', p.folio; end if;
  if coalesce(p.historico, false) then raise exception 'Es una venta histórica de los paneles: no lleva envío'; end if;
  if p_tipo is null or p_tipo not in ('paqueteria', 'flete', 'recoge', 'full', 'proveedor') then
    raise exception 'Tipo de envío no válido: %', coalesce(p_tipo, 'vacío');
  end if;
  if p_tipo = 'full' and p.canal <> 'mercadolibre' then raise exception 'Solo una venta de Mercado Libre la surte Full'; end if;
  if p_tipo = 'full' and v_ml is null then raise exception 'No hay un almacén de Mercado Libre activo'; end if;
  if p_paqueteria is not null and not exists (select 1 from paqueterias where id = p_paqueteria and activa) then
    raise exception 'Esa paquetería no está activa';
  end if;
  if p_lineas is not null and exists (select 1 from jsonb_array_elements(p_lineas) x
       where nullif(x->>'pedido_linea_id', '')::uuid not in (select id from pedido_lineas where pedido_id = p.id)) then
    raise exception 'Una de las partidas no es de este pedido';
  end if;

  -- Destino: el contacto elegido (de este cliente) o el principal; el domicilio de
  -- entrega del pedido manda sobre el del contacto.
  select * into v_cli from clientes where id = p.cliente_id;
  if p_contacto is not null then
    select * into c from contactos where id = p_contacto and cliente_id = p.cliente_id;
    if c.id is null then raise exception 'Ese contacto no es de este cliente'; end if;
  else
    select * into c from contactos where cliente_id = p.cliente_id order by principal desc, creado_en limit 1;
  end if;

  insert into envios (pedido_id, tipo, paqueteria_id, contacto_id, destinatario, telefono, destino, fecha_recoleccion, notas)
  values (p.id, p_tipo, p_paqueteria, c.id,
    case when p_tipo in ('paqueteria', 'flete', 'proveedor') then coalesce(nullif(trim(c.nombre), ''), v_cli.razon_social, v_cli.nombre) end,
    case when p_tipo in ('paqueteria', 'flete', 'proveedor') then coalesce(nullif(trim(c.telefono), ''), nullif(trim(c.whatsapp), '')) end,
    case when p_tipo in ('paqueteria', 'flete', 'proveedor') then
      coalesce(nullif(trim(p_destino), ''), nullif(trim(p.direccion_entrega), ''), nullif(trim(c.domicilio), ''),
               nullif(concat_ws(', ', v_cli.ciudad, v_cli.estado), '')) end,
    p_fecha_recoleccion, nullif(trim(p_notas), ''))
  returning id into v_id;

  -- Partidas: lo que falta por enviar de cada una (o lo que se pidió). Las
  -- partidas libres y los servicios no se empacan.
  for l in select pl.id, pl.articulo_id, pl.titulo, a.tipo art_tipo,
                  pl.cantidad - coalesce((select sum(x.cantidad) from envio_lineas x join envios y on y.id = x.envio_id
                                          where x.pedido_linea_id = pl.id and y.estado <> 'cancelado' and y.id <> v_id), 0) pendiente
           from pedido_lineas pl left join articulos a on a.id = pl.articulo_id
           where pl.pedido_id = p.id order by pl.orden, pl.id loop
    if l.articulo_id is null or l.art_tipo = 'servicio' then continue; end if;
    if p_lineas is not null then
      select (x->>'cantidad')::numeric into v_cant from jsonb_array_elements(p_lineas) x
      where (x->>'pedido_linea_id')::uuid = l.id;
      if coalesce(v_cant, 0) <= 0 then continue; end if;
      if v_cant > l.pendiente + 0.0005 then
        raise exception 'De "%" quedan % por enviar, no %', l.titulo, l.pendiente::float8, v_cant::float8;
      end if;
    else
      v_cant := l.pendiente;
      if v_cant <= 0 then continue; end if;
    end if;
    v_orden := v_orden + 1;
    insert into envio_lineas (envio_id, orden, pedido_linea_id, articulo_id, descripcion, cantidad, almacen_id)
    values (v_id, v_orden, l.id, l.articulo_id, l.titulo, v_cant,
            case p_tipo when 'full' then v_ml when 'proveedor' then null else almacen_de_salida(l.articulo_id, v_cant) end);
  end loop;
  if v_orden = 0 then
    raise exception 'De % no queda nada por enviar: todo ya tiene envío (o son servicios y partidas libres)', p.folio;
  end if;
  if p_tipo in ('paqueteria', 'flete') then perform prellenar_bultos(v_id); end if;

  insert into eventos_envio (envio_id, tipo, nota) values (v_id, 'solicitado',
    format('%s · %s partida(s)%s', nombre_tipo_envio(p_tipo), v_orden,
           coalesce(' · recolección ' || to_char(p_fecha_recoleccion, 'DD/MM'), '')));
  return v_id;
end $$;

-- Lo que falta por enviar de cada partida del pedido (lo que prellena "Pedir
-- envío"). Con los permisos de quien pregunta; sin precios ni costos.
create or replace function public.partidas_por_enviar(p_pedido uuid)
returns table (pedido_linea_id uuid, orden int, articulo_id uuid, clave text, titulo text, articulo_tipo public.tipo_articulo,
               unidad text, cantidad numeric, en_envios numeric, pendiente numeric, paquete_kg numeric, paquete_largo_cm numeric,
               paquete_ancho_cm numeric, paquete_alto_cm numeric, paquete_piezas numeric)
language sql stable security invoker set search_path = public as $$
  select pl.id, pl.orden, pl.articulo_id, a.clave, pl.titulo, a.tipo, pl.unidad, pl.cantidad,
    coalesce(x.cant, 0), greatest(pl.cantidad - coalesce(x.cant, 0), 0),
    a.paquete_kg, a.paquete_largo_cm, a.paquete_ancho_cm, a.paquete_alto_cm, a.paquete_piezas
  from pedido_lineas pl
  join articulos a on a.id = pl.articulo_id
  left join lateral (select sum(el.cantidad) cant from envio_lineas el join envios e on e.id = el.envio_id
                     where el.pedido_linea_id = pl.id and e.estado <> 'cancelado') x on true
  where pl.pedido_id = p_pedido and a.tipo <> 'servicio'
  order by pl.orden, pl.id
$$;

-- Reabasto de la bodega de Full: no es de un pedido; lo arma almacén con lo que
-- manda. Al salir se vuelve un traspaso a "Almacén ML", con su evidencia.
create or replace function public.envio_a_full(p_lineas jsonb, p_paqueteria int default null, p_notas text default null,
  p_fecha_recoleccion date default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid; x jsonb; a articulos; v_alm int; v_cant numeric; v_orden int := 0;
begin
  if not (puede('envios', 2) and puede('inventario', 2)) then
    raise exception 'El envío a Full lo arma almacén' using errcode = '42501';
  end if;
  if almacen_ml() is null then raise exception 'No hay un almacén de Mercado Libre activo'; end if;
  if jsonb_typeof(coalesce(p_lineas, 'null'::jsonb)) <> 'array' or jsonb_array_length(p_lineas) = 0 then
    raise exception 'Agrega al menos un artículo para mandar a Full';
  end if;
  insert into envios (tipo, paqueteria_id, destinatario, destino, fecha_recoleccion, notas)
  values ('a_full', p_paqueteria, 'Mercado Libre Full', 'Centro de distribución de Full (Mercado Libre)', p_fecha_recoleccion,
          nullif(trim(p_notas), ''))
  returning id into v_id;
  for x in select * from jsonb_array_elements(p_lineas) loop
    select * into a from articulos where id = nullif(x->>'articulo_id', '')::uuid;
    if a.id is null then raise exception 'No existe uno de los artículos'; end if;
    if not a.controla_inventario or a.tipo = 'servicio' then raise exception '"%" no lleva inventario: no se manda a Full', a.nombre; end if;
    v_cant := (x->>'cantidad')::numeric;
    if coalesce(v_cant, 0) <= 0 then raise exception 'Escribe cuántas piezas de "%" van a Full', a.nombre; end if;
    v_alm := coalesce(nullif(x->>'almacen_id', '')::int, almacen_de_salida(a.id, v_cant));
    if not exists (select 1 from almacenes where id = v_alm and disponible_para_planta and activo) then
      raise exception 'Un envío a Full sale de un almacén de planta';
    end if;
    v_orden := v_orden + 1;
    insert into envio_lineas (envio_id, orden, articulo_id, descripcion, cantidad, almacen_id)
    values (v_id, v_orden, a.id, a.nombre, v_cant, v_alm);
  end loop;
  perform prellenar_bultos(v_id);
  insert into eventos_envio (envio_id, tipo, nota) values (v_id, 'solicitado', format('Envío a Full · %s artículo(s)', v_orden));
  return v_id;
end $$;

-- -----------------------------------------------------------------------------
-- 11. Datos del envío, cotización, guía y archivos
-- -----------------------------------------------------------------------------
-- Cambios de lo descriptivo mientras no sale: paquetería, destino, recolección,
-- notas y el almacén de cada partida (ese, solo almacén).
create or replace function public.actualizar_envio(p_envio uuid, p_datos jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare e envios; x jsonb; v_cambios text[] := '{}';
begin
  if not puede('envios', 2) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  select * into e from envios where id = p_envio for update;
  if e.id is null or not envio_visible(p_envio) then raise exception 'No existe el envío' using errcode = '42501'; end if;
  if e.estado in ('enviado', 'entregado', 'cancelado') then raise exception 'El envío % ya está %', e.folio, e.estado; end if;
  if p_datos ? 'paqueteria_id' and nullif(p_datos->>'paqueteria_id', '') is not null
     and not exists (select 1 from paqueterias where id = (p_datos->>'paqueteria_id')::int and activa) then
    raise exception 'Esa paquetería no está activa';
  end if;
  update envios set
    paqueteria_id = case when p_datos ? 'paqueteria_id' then nullif(p_datos->>'paqueteria_id', '')::int else paqueteria_id end,
    servicio = case when p_datos ? 'servicio' then nullif(trim(p_datos->>'servicio'), '') else servicio end,
    destinatario = case when p_datos ? 'destinatario' then nullif(trim(p_datos->>'destinatario'), '') else destinatario end,
    telefono = case when p_datos ? 'telefono' then nullif(trim(p_datos->>'telefono'), '') else telefono end,
    destino = case when p_datos ? 'destino' then nullif(trim(p_datos->>'destino'), '') else destino end,
    notas = case when p_datos ? 'notas' then nullif(trim(p_datos->>'notas'), '') else notas end,
    fecha_recoleccion = case when p_datos ? 'fecha_recoleccion' then nullif(p_datos->>'fecha_recoleccion', '')::date else fecha_recoleccion end
  where id = p_envio;
  if p_datos ? 'fecha_recoleccion' and nullif(p_datos->>'fecha_recoleccion', '')::date is distinct from e.fecha_recoleccion then
    v_cambios := array_append(v_cambios, 'Recolección: ' || coalesce(to_char(nullif(p_datos->>'fecha_recoleccion', '')::date, 'DD/MM/YYYY'), 'sin fecha'));
  end if;
  if p_datos ? 'destino' and nullif(trim(p_datos->>'destino'), '') is distinct from e.destino then
    v_cambios := array_append(v_cambios, 'Cambió el destino');
  end if;
  if p_datos ? 'paqueteria_id' and nullif(p_datos->>'paqueteria_id', '')::int is distinct from e.paqueteria_id then
    v_cambios := array_append(v_cambios, 'Paquetería: ' || coalesce((select nombre from paqueterias where id = nullif(p_datos->>'paqueteria_id', '')::int), 'sin definir'));
  end if;
  if p_datos ? 'almacenes' then
    if not puede('inventario', 2) then raise exception 'El almacén de salida lo elige almacén' using errcode = '42501'; end if;
    if e.empacado_en is not null then raise exception 'El envío ya se empacó'; end if;
    for x in select * from jsonb_array_elements(p_datos->'almacenes') loop
      if not exists (select 1 from almacenes where id = (x->>'almacen_id')::int and activo) then raise exception 'Ese almacén no existe'; end if;
      update envio_lineas set almacen_id = (x->>'almacen_id')::int where id = (x->>'linea_id')::uuid and envio_id = p_envio;
    end loop;
    v_cambios := array_append(v_cambios, 'Cambió el almacén de salida');
  end if;
  if cardinality(v_cambios) > 0 then
    insert into eventos_envio (envio_id, tipo, nota) values (p_envio, 'cambio', array_to_string(v_cambios, ' · '));
  end if;
end $$;

create or replace function public.guardar_bultos(p_envio uuid, p_bultos jsonb) returns int
language plpgsql security definer set search_path = public as $$
declare e envios; v_n int;
begin
  if not puede('envios', 2) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  select * into e from envios where id = p_envio for update;
  if e.id is null or not envio_visible(p_envio) then raise exception 'No existe el envío' using errcode = '42501'; end if;
  if e.empacado_en is not null or e.estado in ('enviado', 'entregado', 'cancelado') then
    raise exception 'El envío % ya se empacó: sus bultos quedaron como evidencia', e.folio;
  end if;
  v_n := reemplazar_bultos(p_envio, p_bultos);
  insert into eventos_envio (envio_id, tipo, nota) values (p_envio, 'bultos', format('%s bulto(s)', v_n));
  return v_n;
end $$;

create or replace function public.cotizar_envio(p_envio uuid, p_costo numeric, p_paqueteria int default null,
  p_servicio text default null, p_nota text default null) returns void
language plpgsql security definer set search_path = public as $$
declare e envios;
begin
  if not puede('envios', 2) then raise exception 'Sin permiso para cotizar envíos' using errcode = '42501'; end if;
  select * into e from envios where id = p_envio for update;
  if e.id is null or not envio_visible(p_envio) then raise exception 'No existe el envío' using errcode = '42501'; end if;
  if e.tipo not in ('paqueteria', 'flete', 'a_full', 'proveedor') then raise exception '%: no se cotiza', nombre_tipo_envio(e.tipo); end if;
  if e.estado in ('enviado', 'entregado', 'cancelado') then raise exception 'El envío % ya está %', e.folio, e.estado; end if;
  if e.numero_guia is not null then raise exception '% ya tiene guía: el costo es el de la guía', e.folio; end if;
  if p_costo is null or p_costo < 0 then raise exception 'Escribe cuánto cuesta el envío'; end if;
  if p_paqueteria is not null and not exists (select 1 from paqueterias where id = p_paqueteria and activa) then
    raise exception 'Esa paquetería no está activa';
  end if;
  update envios set costo_cotizado = round(p_costo, 2), paqueteria_id = coalesce(p_paqueteria, paqueteria_id),
    servicio = coalesce(nullif(trim(p_servicio), ''), servicio), cotizado_por = auth.uid(), cotizado_en = now(),
    estado = case when estado = 'solicitado' then 'cotizado' else estado end
  where id = p_envio;
  insert into eventos_envio (envio_id, tipo, nota) values (p_envio, 'cotizado',
    format('%s%s%s', texto_dinero(p_costo), coalesce(' · ' || (select nombre from paqueterias where id = coalesce(p_paqueteria, e.paqueteria_id)), ''),
           coalesce(' · ' || nullif(trim(p_nota), ''), '')));
end $$;

-- Registra un archivo ya subido al bucket. La ruta tiene que existir y estar en la
-- carpeta del registro: no se puede "adoptar" la foto de otro envío.
create or replace function public.agregar_archivo_envio(p_ruta text, p_tipo text, p_envio uuid default null,
  p_devolucion uuid default null, p_nota text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare v uuid; v_prefijo text; e envios; d devoluciones; v_max int;
begin
  if not puede('envios', 2) then raise exception 'Sin permiso para subir archivos' using errcode = '42501'; end if;
  if num_nonnulls(p_envio, p_devolucion) <> 1 then raise exception 'El archivo va en un envío o en una devolución'; end if;
  if p_envio is not null then
    select * into e from envios where id = p_envio for update;
    if e.id is null or not envio_visible(p_envio) then raise exception 'No existe el envío' using errcode = '42501'; end if;
    if p_tipo not in ('empaque', 'guia', 'entrega', 'documento') then raise exception 'Tipo de archivo no válido para un envío'; end if;
    if p_tipo = 'empaque' then
      if not puede('inventario', 2) then raise exception 'Las fotos de empaque las toma almacén' using errcode = '42501'; end if;
      if e.empacado_en is not null then raise exception '% ya se empacó: su evidencia quedó cerrada', e.folio; end if;
      if e.estado = 'cancelado' then raise exception 'El envío % está cancelado', e.folio; end if;
      v_max := coalesce((select (valor->>'max_fotos')::int from configuracion where clave = 'envios'), 6);
      if (select count(*) from evidencias_envio where envio_id = p_envio and tipo = 'empaque') >= v_max then
        raise exception 'Ya hay % fotos de empaque: con eso basta', v_max;
      end if;
    end if;
    v_prefijo := 'envios/' || p_envio || '/';
  else
    select * into d from devoluciones where id = p_devolucion for update;
    if d.id is null or not devolucion_visible(p_devolucion) then raise exception 'No existe la devolución' using errcode = '42501'; end if;
    if p_tipo not in ('recepcion', 'documento') then raise exception 'Tipo de archivo no válido para una devolución'; end if;
    if p_tipo = 'recepcion' then
      if not puede('inventario', 2) then raise exception 'Las fotos al recibir las toma almacén' using errcode = '42501'; end if;
      if d.estado in ('resuelta', 'cancelada') then raise exception '% ya está %', d.folio, d.estado; end if;
    end if;
    v_prefijo := 'devoluciones/' || p_devolucion || '/';
  end if;
  if p_ruta is null or left(p_ruta, length(v_prefijo)) <> v_prefijo then raise exception 'El archivo no está en la carpeta de este registro'; end if;
  if not exists (select 1 from storage.objects o where o.bucket_id = 'envios' and o.name = p_ruta) then
    raise exception 'El archivo no se subió completo; vuelve a intentarlo';
  end if;
  insert into evidencias_envio (envio_id, devolucion_id, tipo, ruta, nota)
  values (p_envio, p_devolucion, p_tipo, p_ruta, nullif(trim(p_nota), ''))
  returning id into v;
  return v;
end $$;

-- Aviso de saldo bajo de una paquetería (a gerencia de ventas, finanzas y a quien
-- generó guías en el último mes). Una vez al día.
create or replace function public.revisar_saldo_paqueteria(p_paqueteria int) returns boolean
language plpgsql security definer set search_path = public as $$
declare s record; v_dest uuid[];
begin
  select * into s from saldos_paqueteria_todas() x where x.paqueteria_id = p_paqueteria;
  if s.paqueteria_id is null or not s.bajo then return false; end if;
  v_dest := array(select usuarios_con_rol('gerente_ventas') union select usuarios_con_rol('finanzas')
                  union select distinct e.guia_por from envios e where e.paqueteria_id = p_paqueteria and e.guia_en > now() - interval '30 days');
  perform avisar(v_dest, 'saldo_bajo', format('Saldo bajo en %s: %s', s.paqueteria, texto_dinero(s.saldo)),
    format('El mínimo es %s. Recarga antes de la siguiente guía.', texto_dinero(s.saldo_minimo)),
    '/almacen/envios?saldo=1', 'paqueterias', p_paqueteria::text, true);
  return true;
end $$;
revoke execute on function public.revisar_saldo_paqueteria(int) from public, anon, authenticated;

create or replace function public.registrar_guia(p_envio uuid, p_numero text, p_ruta text default null, p_costo numeric default null,
  p_paqueteria int default null) returns void
language plpgsql security definer set search_path = public as $$
declare e envios; q paqueterias; v_antes text;
begin
  if not puede('envios', 2) then raise exception 'Sin permiso para registrar guías' using errcode = '42501'; end if;
  select * into e from envios where id = p_envio for update;
  if e.id is null or not envio_visible(p_envio) then raise exception 'No existe el envío' using errcode = '42501'; end if;
  if e.tipo not in ('paqueteria', 'flete', 'a_full', 'proveedor') then raise exception '%: no lleva guía', nombre_tipo_envio(e.tipo); end if;
  if e.estado in ('enviado', 'entregado', 'cancelado') then raise exception 'El envío % ya está %', e.folio, e.estado; end if;
  select * into q from paqueterias where id = coalesce(p_paqueteria, e.paqueteria_id);
  if e.tipo = 'paqueteria' then
    if q.id is null then raise exception 'Elige la paquetería de la guía'; end if;
    if nullif(trim(p_numero), '') is null then raise exception 'Escribe el número de guía'; end if;
    if p_ruta is null and not exists (select 1 from evidencias_envio where envio_id = p_envio and tipo = 'guia') then
      raise exception 'Sube el PDF de la guía: así queda con el pedido y nadie la vuelve a pedir por chat';
    end if;
  end if;
  if q.usa_saldo and p_costo is null then
    raise exception 'Escribe lo que costó la guía: se descuenta del saldo de %', q.nombre;
  end if;
  if p_costo is not null and p_costo < 0 then raise exception 'El costo de la guía no puede ser negativo'; end if;
  if p_ruta is not null then perform agregar_archivo_envio(p_ruta, 'guia', p_envio); end if;
  v_antes := e.numero_guia;
  update envios set numero_guia = nullif(trim(p_numero), ''), costo_real = round(p_costo, 2), paqueteria_id = coalesce(q.id, paqueteria_id),
    costo_cotizado = coalesce(costo_cotizado, round(p_costo, 2)), guia_por = auth.uid(), guia_en = now(),
    estado = case when estado in ('solicitado', 'cotizado') then 'guia_lista' else estado end
  where id = p_envio;
  insert into eventos_envio (envio_id, tipo, nota) values (p_envio, 'guia',
    concat_ws(' · ', coalesce(q.nombre, 'Transporte'), nullif(trim(p_numero), ''), case when p_costo is not null then texto_dinero(p_costo) end,
              case when v_antes is not null then 'antes ' || v_antes end));
  if q.id is not null then perform revisar_saldo_paqueteria(q.id); end if;
end $$;

-- -----------------------------------------------------------------------------
-- 12. Salida de inventario: lo que se descuenta y por qué (sin costos)
-- -----------------------------------------------------------------------------
-- Una fila por partida: cuánto se descuenta, de qué almacén, o por qué no. Si algo
-- impide la salida (no hay existencia en ese almacén, lo libre está apartado para
-- otra orden), lo dice en "problema". Lo usan empacar (para avisar antes de que el
-- paquete esté en el camión), la salida misma y la pantalla.
create or replace function public._plan_salida_envio(p_envio uuid)
returns table (linea_id uuid, articulo_id uuid, articulo text, almacen_id int, almacen text, cantidad numeric,
               descontar numeric, accion text, nota text, problema text)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
declare
  e envios; l record; v_ml int := almacen_ml(); v_acum jsonb := '{}'; v_k text; v_prev numeric; v_hecho numeric;
  v_desc numeric; v_exist numeric; v_uso numeric; v_libre numeric; v_apartado text; v_ops int; v_folios text;
begin
  select * into e from envios where id = p_envio;
  if e.id is null then return; end if;
  for l in select el.id, el.articulo_id, el.descripcion, el.cantidad, el.almacen_id, el.pedido_linea_id, el.cantidad_descontada,
                  el.movimiento_id, el.traspaso_id, el.nota_inventario,
                  a.nombre art_nombre, a.tipo art_tipo, a.controla_inventario, al.nombre alm_nombre, al.disponible_para_planta
           from envio_lineas el
           left join articulos a on a.id = el.articulo_id
           left join almacenes al on al.id = el.almacen_id
           where el.envio_id = p_envio order by el.orden, el.id loop
    linea_id := l.id; articulo_id := l.articulo_id; articulo := coalesce(l.art_nombre, l.descripcion);
    almacen_id := l.almacen_id; almacen := l.alm_nombre; cantidad := l.cantidad;
    descontar := 0; accion := 'nada'; nota := null; problema := null;

    if e.inventario_descontado_en is not null then
      descontar := coalesce(l.cantidad_descontada, 0);
      accion := case when l.traspaso_id is not null then 'traspaso' when l.movimiento_id is not null then 'salida' else 'nada' end;
      nota := coalesce(l.nota_inventario, case when accion = 'nada' then null else 'Ya se descontó' end);
      return next; continue;
    end if;
    if e.tipo = 'proveedor' then
      nota := 'Lo manda el proveedor directo: no sale de nuestro almacén'; return next; continue;
    end if;
    if e.tipo <> 'a_full' and l.articulo_id is not null then
      -- Equipo fabricado: su material salió con la orden; el equipo no estuvo en inventario.
      select count(*), string_agg(o.folio, ', ' order by o.folio) into v_ops, v_folios
      from ordenes_de_partida(e.pedido_id, l.pedido_linea_id, l.articulo_id) o;
      if v_ops > 0 then
        nota := format('Equipo fabricado: su material ya salió con %s', v_folios); return next; continue;
      end if;
    end if;
    if l.articulo_id is null or not coalesce(l.controla_inventario, false) or l.art_tipo = 'servicio' then
      nota := 'No lleva control de inventario'; return next; continue;
    end if;
    if l.almacen_id is null then
      accion := 'salida'; problema := format('Elige de qué almacén sale "%s"', articulo); return next; continue;
    end if;

    if e.tipo = 'a_full' then
      v_desc := l.cantidad; accion := 'traspaso';
      nota := format('Traspaso de %s a Almacén ML (Full)', l.alm_nombre);
      if not l.disponible_para_planta then problema := 'Un envío a Full sale de un almacén de planta'; end if;
      if v_ml is null then problema := 'No hay un almacén de Mercado Libre activo'; end if;
    else
      -- Lo que este pedido ya mandó de este artículo contra lo que ya salió del
      -- inventario con el pedido (a mano o con otro envío): solo se descuenta la diferencia.
      v_k := l.articulo_id::text;
      if not v_acum ? v_k then
        select coalesce(sum(x.cantidad), 0) into v_prev from envio_lineas x join envios y on y.id = x.envio_id
        where y.pedido_id = e.pedido_id and y.id <> e.id and x.articulo_id = l.articulo_id and y.inventario_descontado_en is not null;
        select coalesce(-sum(m.cantidad), 0) into v_hecho from movimientos_inventario m
        where m.pedido_id = e.pedido_id and m.articulo_id = l.articulo_id and m.tipo = 'salida_venta';
        v_acum := v_acum || jsonb_build_object(v_k, jsonb_build_object('meta', v_prev, 'hecho', v_hecho, 'desc', 0));
      end if;
      v_acum := jsonb_set(v_acum, array[v_k, 'meta'], to_jsonb((v_acum #>> array[v_k, 'meta'])::numeric + l.cantidad));
      v_desc := least(l.cantidad, greatest(0, (v_acum #>> array[v_k, 'meta'])::numeric - (v_acum #>> array[v_k, 'hecho'])::numeric
                                                - (v_acum #>> array[v_k, 'desc'])::numeric));
      v_acum := jsonb_set(v_acum, array[v_k, 'desc'], to_jsonb((v_acum #>> array[v_k, 'desc'])::numeric + v_desc));
      accion := case when v_desc > 0 then 'salida' else 'nada' end;
      if v_desc = 0 then nota := 'Ya se le había dado salida a mano con este pedido';
      elsif v_desc < l.cantidad then nota := format('%s ya habían salido a mano con este pedido', (l.cantidad - v_desc)::float8);
      elsif not l.disponible_para_planta then nota := 'Sale de ' || l.alm_nombre;
      end if;
    end if;
    descontar := v_desc;

    if v_desc > 0 and problema is null then
      -- Existencia en el almacén elegido (sumando si el artículo se repite).
      select coalesce(max(x.cantidad), 0) into v_exist from existencias x
      where x.articulo_id = l.articulo_id and x.almacen_id = l.almacen_id;
      v_uso := coalesce((v_acum #>> array['_alm', l.articulo_id::text || ':' || l.almacen_id])::numeric, 0) + v_desc;
      v_acum := jsonb_set(case when v_acum ? '_alm' then v_acum else v_acum || '{"_alm": {}}' end,
                          array['_alm', l.articulo_id::text || ':' || l.almacen_id], to_jsonb(v_uso));
      if v_exist < v_uso then
        problema := format('En %s hay %s de "%s" y se necesitan %s: elige otro almacén o revisa la existencia',
                           l.alm_nombre, v_exist::float8, articulo, v_uso::float8);
      elsif l.disponible_para_planta then
        -- Respeta lo apartado: en planta solo se toma lo que no está reservado para otro.
        v_uso := coalesce((v_acum #>> array['_planta', l.articulo_id::text])::numeric, 0) + v_desc;
        v_acum := jsonb_set(case when v_acum ? '_planta' then v_acum else v_acum || '{"_planta": {}}' end,
                            array['_planta', l.articulo_id::text], to_jsonb(v_uso));
        select coalesce(sum(x.cantidad), 0) into v_libre from existencias x join almacenes al on al.id = x.almacen_id
        where x.articulo_id = l.articulo_id and al.disponible_para_planta;
        select v_libre - coalesce(sum(r.cantidad - r.surtido), 0),
               string_agg(distinct coalesce(op.folio, pe.folio, r.motivo, 'otra reserva'), ', ')
          into v_libre, v_apartado
        from reservas r left join ordenes_produccion op on op.id = r.orden_produccion_id left join pedidos pe on pe.id = r.pedido_id
        where r.articulo_id = l.articulo_id and r.estado = 'activa' and r.pedido_id is distinct from e.pedido_id;
        if v_libre < v_uso then
          problema := format('De "%s" quedan %s libres en planta: lo demás está apartado para %s. Libera la reserva o surte de otro almacén',
                             articulo, greatest(v_libre, 0)::float8, coalesce(v_apartado, 'otra orden'));
        end if;
      end if;
    end if;
    return next;
  end loop;
end $$;
revoke execute on function public._plan_salida_envio(uuid) from public, anon, authenticated;

create or replace function public.plan_salida_envio(p_envio uuid)
returns table (linea_id uuid, articulo_id uuid, articulo text, almacen_id int, almacen text, cantidad numeric,
               descontar numeric, accion text, nota text, problema text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not envio_visible(p_envio) then raise exception 'No existe el envío' using errcode = '42501'; end if;
  return query select * from _plan_salida_envio(p_envio);
end $$;

-- La salida misma: una sola vez por envío (el envío se bloquea y queda marcado),
-- con movimientos inmutables. Las reservas de este pedido se dan por surtidas.
create or replace function public._salida_inventario_envio(p_envio uuid) returns int
language plpgsql security definer set search_path = public as $$
declare e envios; r record; v_mov bigint; v_t uuid; v_n int := 0; v_ml int := almacen_ml(); v_ped text;
  v_res reservas; v_rest numeric; v_prob text;
begin
  select * into e from envios where id = p_envio for update;
  if e.id is null then raise exception 'No existe el envío'; end if;
  if e.inventario_descontado_en is not null then return 0; end if;     -- ya se hizo: reintentar no descuenta otra vez
  if e.estado = 'cancelado' then raise exception 'El envío % está cancelado', e.folio; end if;
  if e.pedido_id is not null then select folio into v_ped from pedidos where id = e.pedido_id for update; end if;
  -- Dos salidas del mismo artículo no se cruzan.
  perform 1 from existencias x where x.articulo_id in (select el.articulo_id from envio_lineas el where el.envio_id = e.id) for update;

  select string_agg(p.problema, ' · ') into v_prob from _plan_salida_envio(e.id) p where p.problema is not null;
  if v_prob is not null then raise exception '%', v_prob; end if;

  for r in select * from _plan_salida_envio(e.id) loop
    if r.accion = 'salida' and r.descontar > 0 then
      insert into movimientos_inventario (tipo, articulo_id, almacen_id, cantidad, pedido_id, motivo, costo_unitario)
      values ('salida_venta', r.articulo_id, r.almacen_id, -r.descontar, e.pedido_id, concat_ws(' · ', e.folio, v_ped),
              (select c.costo * tc(c.moneda) from costos_articulo c where c.articulo_id = r.articulo_id))
      returning id into v_mov;
      v_rest := r.descontar;
      for v_res in select * from reservas where pedido_id = e.pedido_id and articulo_id = r.articulo_id and estado = 'activa'
                   order by creado_en for update loop
        exit when v_rest <= 0;
        update reservas set surtido = surtido + least(v_rest, cantidad - surtido),
          estado = case when surtido + least(v_rest, cantidad - surtido) >= cantidad then 'surtida' else 'activa' end
        where id = v_res.id;
        v_rest := v_rest - least(v_rest, v_res.cantidad - v_res.surtido);
      end loop;
      update envio_lineas set cantidad_descontada = r.descontar, movimiento_id = v_mov, nota_inventario = r.nota where id = r.linea_id;
      v_n := v_n + 1;
    elsif r.accion = 'traspaso' and r.descontar > 0 then
      v_t := gen_random_uuid();
      insert into movimientos_inventario (tipo, articulo_id, almacen_id, cantidad, traspaso_id, motivo)
      values ('traspaso_salida', r.articulo_id, r.almacen_id, -r.descontar, v_t, e.folio || ' · envío a Full'),
             ('traspaso_entrada', r.articulo_id, v_ml, r.descontar, v_t, e.folio || ' · envío a Full');
      update envio_lineas set cantidad_descontada = r.descontar, traspaso_id = v_t, nota_inventario = r.nota where id = r.linea_id;
      v_n := v_n + 1;
    else
      update envio_lineas set cantidad_descontada = 0, nota_inventario = r.nota where id = r.linea_id;
    end if;
  end loop;
  update envios set inventario_descontado_en = now(), inventario_descontado_por = auth.uid() where id = e.id;
  insert into eventos_envio (envio_id, tipo, nota) values (e.id, 'inventario',
    case when v_n = 0 then 'Nada que descontar del inventario' else format('%s movimiento(s) de inventario', v_n) end);
  return v_n;
end $$;
revoke execute on function public._salida_inventario_envio(uuid) from public, anon, authenticated;

-- Para reintentar a mano (almacén) si algo falló al salir. Llamarla dos veces no
-- descuenta dos veces.
create or replace function public.salida_inventario_envio(p_envio uuid) returns int
language plpgsql security definer set search_path = public as $$
declare e envios;
begin
  if not puede('inventario', 2) then raise exception 'La salida de inventario la hace almacén' using errcode = '42501'; end if;
  select * into e from envios where id = p_envio;
  if e.id is null or not envio_visible(p_envio) then raise exception 'No existe el envío' using errcode = '42501'; end if;
  if e.estado not in ('enviado', 'entregado') then raise exception 'El envío % todavía no sale', e.folio; end if;
  return _salida_inventario_envio(p_envio);
end $$;

-- Lo entregado se refleja en el pedido; si ya se entregó todo lo que se empaca,
-- el pedido queda entregado (como entregar_pedido).
create or replace function public._entregar_en_pedido(p_envio uuid) returns void
language plpgsql security definer set search_path = public as $$
declare e envios;
begin
  select * into e from envios where id = p_envio;
  if e.pedido_id is null then return; end if;
  update pedido_lineas pl set cantidad_entregada = least(pl.cantidad, pl.cantidad_entregada + x.cant)
  from (select pedido_linea_id, sum(cantidad) cant from envio_lineas where envio_id = p_envio and pedido_linea_id is not null
        group by pedido_linea_id) x
  where pl.id = x.pedido_linea_id;
  if not exists (select 1 from pedido_lineas pl left join articulos a on a.id = pl.articulo_id
                 where pl.pedido_id = e.pedido_id and pl.articulo_id is not null and a.tipo <> 'servicio'
                   and pl.cantidad_entregada < pl.cantidad) then
    update pedido_lineas set cantidad_entregada = cantidad where pedido_id = e.pedido_id and cantidad_entregada <> cantidad;
    update pedidos set estado = 'entregado' where id = e.pedido_id and estado not in ('entregado', 'cancelado');
  end if;
end $$;
revoke execute on function public._entregar_en_pedido(uuid) from public, anon, authenticated;

-- Al salir: inventario, y la orden de producción del equipo queda entregada.
create or replace function public._dar_salida(p_envio uuid) returns int
language plpgsql security definer set search_path = public as $$
declare e envios; v_n int; o record;
begin
  select * into e from envios where id = p_envio;
  v_n := _salida_inventario_envio(p_envio);
  for o in select distinct x.id from envio_lineas el
           cross join lateral ordenes_de_partida(e.pedido_id, el.pedido_linea_id, el.articulo_id) x
           where el.envio_id = p_envio and x.estado = 'terminada' loop
    update ordenes_produccion set estado = 'entregada', entregada_en = now() where id = o.id;
    insert into op_eventos (orden_id, tipo, nota) values (o.id, 'entregada', 'Salió con ' || e.folio);
  end loop;
  return v_n;
end $$;
revoke execute on function public._dar_salida(uuid) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 13. Empacar, salir, entregar, cancelar
-- -----------------------------------------------------------------------------
create or replace function public.marcar_empacado(p_envio uuid, p_checklist int[] default '{}', p_series jsonb default '{}',
  p_bultos jsonb default null) returns void
language plpgsql security definer set search_path = public as $$
declare
  e envios; l record; v_faltan text; v_items jsonb; v_equipo boolean; v_comp boolean; v_fotos int; v_prob text;
  v_series text[]; v_esperadas text[]; v_ops int; v_sin_serie text; v_pend text; v_s text; v_otro text;
begin
  if not (puede('envios', 2) and puede('inventario', 2)) then
    raise exception 'Empacar es de almacén: es quien ve lo que va en la caja' using errcode = '42501';
  end if;
  select * into e from envios where id = p_envio for update;
  if e.id is null or not envio_visible(p_envio) then raise exception 'No existe el envío' using errcode = '42501'; end if;
  if e.tipo not in ('paqueteria', 'flete', 'recoge', 'a_full') then
    raise exception '%: este envío no lo empaca almacén', nombre_tipo_envio(e.tipo);
  end if;
  if e.empacado_en is not null then raise exception '% ya está empacado: su evidencia no se cambia', e.folio; end if;
  if e.estado not in ('solicitado', 'cotizado', 'guia_lista') then raise exception 'El envío % ya está %', e.folio, e.estado; end if;

  -- 1. Foto.
  select count(*) into v_fotos from evidencias_envio where envio_id = p_envio and tipo = 'empaque';
  if v_fotos = 0 then
    raise exception 'Toma al menos una foto del paquete antes de cerrarlo: es la prueba si llega un reclamo de "llegó incompleto"';
  end if;

  -- 2. Check list (el de equipo, el de componentes o los dos), completo.
  select coalesce(bool_or(a.tipo in ('equipo', 'subensamble')), false),
         coalesce(bool_or(a.tipo is null or a.tipo not in ('equipo', 'subensamble')), false)
    into v_equipo, v_comp
  from envio_lineas el left join articulos a on a.id = el.articulo_id where el.envio_id = p_envio;
  select string_agg(c.texto, '; ' order by case c.aplica when 'equipo' then 0 when 'componente' then 1 else 2 end, c.orden) into v_faltan
  from checklist_salida c
  where c.activo and (c.aplica = 'todos' or (c.aplica = 'equipo' and v_equipo) or (c.aplica = 'componente' and v_comp))
    and not (c.id = any(coalesce(p_checklist, '{}')));
  if v_faltan is not null then raise exception 'Falta palomear: %', v_faltan; end if;
  select jsonb_agg(jsonb_build_object('id', c.id, 'aplica', c.aplica, 'texto', c.texto)
                   order by case c.aplica when 'equipo' then 0 when 'componente' then 1 else 2 end, c.orden) into v_items
  from checklist_salida c
  where c.activo and (c.aplica = 'todos' or (c.aplica = 'equipo' and v_equipo) or (c.aplica = 'componente' and v_comp));

  -- 3. Números de serie de cada equipo, contra su orden de producción.
  for l in select el.id, el.cantidad, el.pedido_linea_id, el.articulo_id, coalesce(a.nombre, el.descripcion) nombre
           from envio_lineas el join articulos a on a.id = el.articulo_id
           where el.envio_id = p_envio and a.tipo in ('equipo', 'subensamble') order by el.orden loop
    select coalesce(array_agg(distinct upper(trim(x))) filter (where nullif(trim(x), '') is not null), '{}') into v_series
    from jsonb_array_elements_text(case when jsonb_typeof(p_series -> l.id::text) = 'array' then p_series -> l.id::text else '[]'::jsonb end) x;
    if cardinality(v_series) <> ceil(l.cantidad) then
      raise exception 'Escribe el número de serie de % (% %): el de la placa del equipo', l.nombre, ceil(l.cantidad),
        case when ceil(l.cantidad) = 1 then 'equipo' else 'equipos, uno por equipo' end;
    end if;
    select count(*), array_agg(upper(trim(o.numero_serie))) filter (where nullif(trim(o.numero_serie), '') is not null),
           string_agg(o.folio, ', ') filter (where nullif(trim(o.numero_serie), '') is null),
           string_agg(o.folio, ', ') filter (where o.estado not in ('terminada', 'entregada'))
      into v_ops, v_esperadas, v_sin_serie, v_pend
    from ordenes_de_partida(e.pedido_id, l.pedido_linea_id, l.articulo_id) o;
    if v_ops > 0 then
      if v_pend is not null then raise exception 'La orden % todavía no se termina: el equipo no se empaca', v_pend; end if;
      if v_esperadas is null then
        raise exception 'La orden % no tiene número de serie: que producción lo capture antes de empacar', v_sin_serie;
      end if;
      foreach v_s in array v_series loop
        if not v_s = any(v_esperadas) then
          raise exception 'La serie % no es la de la orden de producción (%): revisa la placa', v_s, array_to_string(v_esperadas, ', ');
        end if;
      end loop;
    end if;
    -- La misma placa no puede salir dos veces.
    select y.folio into v_otro from envio_lineas x join envios y on y.id = x.envio_id
    where y.id <> p_envio and y.estado <> 'cancelado' and x.series && v_series limit 1;
    if v_otro is not null then raise exception 'Ese número de serie ya salió con %', v_otro; end if;
    update envio_lineas set series = v_series where id = l.id;
  end loop;

  -- 4. Bultos pesados y medidos (para la guía y para el próximo envío).
  if p_bultos is not null then perform reemplazar_bultos(p_envio, p_bultos); end if;
  if e.tipo in ('paqueteria', 'a_full') then
    if not exists (select 1 from envio_bultos b where b.envio_id = p_envio) then
      raise exception 'Agrega los bultos con su peso y medidas';
    end if;
    if exists (select 1 from envio_bultos b where b.envio_id = p_envio
               and (b.peso_kg is null or b.largo_cm is null or b.ancho_cm is null or b.alto_cm is null)) then
      raise exception 'Pesa y mide cada bulto: con eso sale la guía y nadie lo vuelve a preguntar';
    end if;
  end if;

  -- 5. Que haya de dónde sacarlo, antes de que el paquete esté en el camión.
  select string_agg(p.problema, ' · ') into v_prob from _plan_salida_envio(p_envio) p where p.problema is not null;
  if v_prob is not null then raise exception '%', v_prob; end if;

  update envios set checklist = coalesce(v_items, '[]'::jsonb), empacado_por = auth.uid(), empacado_en = now(), estado = 'empacado'
  where id = p_envio;
  insert into eventos_envio (envio_id, tipo, nota) values (p_envio, 'empacado',
    format('%s foto(s) · %s bulto(s)%s', v_fotos, (select count(*) from envio_bultos where envio_id = p_envio),
           coalesce(' · serie ' || (select string_agg(array_to_string(series, ', '), ', ') from envio_lineas
                                    where envio_id = p_envio and cardinality(series) > 0), '')));
end $$;

create or replace function public.marcar_enviado(p_envio uuid, p_nota text default null) returns int
language plpgsql security definer set search_path = public as $$
declare e envios; v_n int;
begin
  select * into e from envios where id = p_envio for update;
  if e.id is null or not envio_visible(p_envio) then raise exception 'No existe el envío' using errcode = '42501'; end if;
  if e.tipo in ('full', 'proveedor') then
    if not puede('envios', 2) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  elsif not (puede('envios', 2) and puede('inventario', 2)) then
    raise exception 'La salida la marca almacén: es quien ve salir el paquete' using errcode = '42501';
  end if;
  if e.tipo = 'recoge' then raise exception 'Cuando el cliente se lo lleve, márcalo como entregado (con quién lo recogió)'; end if;
  if e.estado in ('enviado', 'entregado') then raise exception 'El envío % ya salió', e.folio; end if;
  if e.estado = 'cancelado' then raise exception 'El envío % está cancelado', e.folio; end if;
  if e.tipo in ('paqueteria', 'flete', 'a_full') and e.empacado_en is null then
    raise exception 'Primero se empaca, con fotos y check list: sin eso no sale';
  end if;
  if e.tipo = 'paqueteria' and e.numero_guia is null then raise exception 'Falta registrar la guía de %', e.folio; end if;
  v_n := _dar_salida(p_envio);
  update envios set estado = 'enviado', enviado_por = auth.uid(), enviado_en = now() where id = p_envio;
  insert into eventos_envio (envio_id, tipo, nota) values (p_envio, 'enviado',
    concat_ws(' · ', case e.tipo when 'full' then 'Lo surtió Full' when 'proveedor' then 'Lo mandó el proveedor' end,
              case when e.numero_guia is not null then 'guía ' || e.numero_guia end, nullif(trim(p_nota), '')));
  return v_n;
end $$;

create or replace function public.marcar_entregado(p_envio uuid, p_recibio text default null) returns void
language plpgsql security definer set search_path = public as $$
declare e envios;
begin
  if not puede('envios', 2) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  select * into e from envios where id = p_envio for update;
  if e.id is null or not envio_visible(p_envio) then raise exception 'No existe el envío' using errcode = '42501'; end if;
  if e.estado = 'entregado' then raise exception 'El envío % ya está entregado', e.folio; end if;
  if e.estado = 'cancelado' then raise exception 'El envío % está cancelado', e.folio; end if;
  if e.tipo = 'recoge' then
    -- El cliente se lo lleva de planta: aquí es la salida.
    if not puede('inventario', 2) then raise exception 'La entrega en planta la registra almacén' using errcode = '42501'; end if;
    if e.empacado_en is null then raise exception 'Primero se empaca, con fotos y check list: sin eso no sale'; end if;
    if nullif(trim(p_recibio), '') is null then raise exception 'Escribe quién se lo llevó'; end if;
    perform _dar_salida(p_envio);
    update envios set enviado_por = auth.uid(), enviado_en = now() where id = p_envio;
  elsif e.estado <> 'enviado' then
    raise exception 'El envío % todavía no sale', e.folio;
  end if;
  update envios set estado = 'entregado', entregado_por = auth.uid(), entregado_en = now(), recibio = nullif(trim(p_recibio), '')
  where id = p_envio;
  perform _entregar_en_pedido(p_envio);
  insert into eventos_envio (envio_id, tipo, nota) values (p_envio, 'entregado', coalesce('Recibió ' || nullif(trim(p_recibio), ''), null));
end $$;

create or replace function public.cancelar_envio(p_envio uuid, p_motivo text, p_guia_reembolsada boolean default true) returns void
language plpgsql security definer set search_path = public as $$
declare e envios;
begin
  if not puede('envios', 2) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  select * into e from envios where id = p_envio for update;
  if e.id is null or not envio_visible(p_envio) then raise exception 'No existe el envío' using errcode = '42501'; end if;
  if e.estado in ('enviado', 'entregado') then raise exception 'El envío % ya salió: si regresa, es una devolución', e.folio; end if;
  if e.estado = 'cancelado' then raise exception 'El envío % ya está cancelado', e.folio; end if;
  if length(trim(coalesce(p_motivo, ''))) < 5 then raise exception 'Escribe por qué se cancela'; end if;
  update envios set estado = 'cancelado', cancelado_por = auth.uid(), cancelado_en = now(), motivo_cancelacion = trim(p_motivo),
    guia_reembolsada = case when numero_guia is not null then coalesce(p_guia_reembolsada, true) end
  where id = p_envio;
  insert into eventos_envio (envio_id, tipo, nota) values (p_envio, 'cancelado', trim(p_motivo)
    || case when e.numero_guia is not null and not coalesce(p_guia_reembolsada, true) then ' · la guía no se reembolsó' else '' end);
end $$;

-- -----------------------------------------------------------------------------
-- 14. Saldo de paquetería
-- -----------------------------------------------------------------------------
create or replace function public.saldos_paqueteria_todas()
returns table (paqueteria_id int, paqueteria text, usa_saldo boolean, recargas numeric, consumo numeric, saldo numeric,
               saldo_minimo numeric, bajo boolean, ultima_recarga date, guias_30d int)
language sql stable security definer set search_path = public as $$
  with cfg as (select coalesce((select (valor->>'saldo_minimo')::numeric from configuracion where clave = 'envios'), 0) minimo)
  select p.id, p.nombre, p.usa_saldo, coalesce(r.total, 0), coalesce(c.total, 0), coalesce(r.total, 0) - coalesce(c.total, 0),
    coalesce(p.saldo_minimo, cfg.minimo),
    -- Una paquetería que nunca se ha recargado ni usado no "tiene saldo bajo": no se usa.
    p.usa_saldo and (r.total is not null or c.total is not null)
      and coalesce(r.total, 0) - coalesce(c.total, 0) < coalesce(p.saldo_minimo, cfg.minimo),
    r.ultima, coalesce(c.guias, 0)
  from paqueterias p cross join cfg
  left join lateral (select sum(x.monto) total, max(x.fecha) filter (where x.monto > 0) ultima
                     from recargas_paqueteria x where x.paqueteria_id = p.id) r on true
  -- Consumo: lo que costaron las guías generadas, salvo las de envíos cancelados
  -- cuya guía se reembolsó.
  left join lateral (select sum(e.costo_real) total, count(*) filter (where e.guia_en > now() - interval '30 days')::int guias
                     from envios e where e.paqueteria_id = p.id and e.guia_en is not null and e.costo_real is not null
                       and not (e.estado = 'cancelado' and coalesce(e.guia_reembolsada, true))) c on true
  where p.activa
$$;
revoke execute on function public.saldos_paqueteria_todas() from public, anon, authenticated;

-- El saldo (agregado) lo ve quien genera guías y quien paga; la lista de
-- recargas, solo la administración y finanzas.
create or replace function public.saldos_paqueteria()
returns table (paqueteria_id int, paqueteria text, usa_saldo boolean, recargas numeric, consumo numeric, saldo numeric,
               saldo_minimo numeric, bajo boolean, ultima_recarga date, guias_30d int)
language sql stable security definer set search_path = public as $$
  select * from saldos_paqueteria_todas() where puede('envios', 2) or puede('finanzas', 1) order by 2
$$;

create or replace function public.registrar_recarga(p_paqueteria int, p_monto numeric, p_referencia text default null,
  p_nota text default null, p_fecha date default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare v uuid;
begin
  if not (puede('envios', 3) or puede('finanzas', 2)) then
    raise exception 'Las recargas las registra quien las paga (finanzas o la gerencia)' using errcode = '42501';
  end if;
  if not exists (select 1 from paqueterias where id = p_paqueteria and activa) then raise exception 'Esa paquetería no está activa'; end if;
  if coalesce(p_monto, 0) = 0 then raise exception 'Escribe el monto de la recarga'; end if;
  if p_monto < 0 and length(trim(coalesce(p_nota, ''))) < 5 then
    raise exception 'Un cargo o corrección (monto negativo) lleva su explicación';
  end if;
  if p_fecha > hoy_planta() then raise exception 'La fecha de la recarga no puede ser futura'; end if;
  insert into recargas_paqueteria (paqueteria_id, monto, fecha, referencia, nota)
  values (p_paqueteria, round(p_monto, 2), coalesce(p_fecha, hoy_planta()), nullif(trim(p_referencia), ''), nullif(trim(p_nota), ''))
  returning id into v;
  perform revisar_saldo_paqueteria(p_paqueteria);
  return v;
end $$;

-- -----------------------------------------------------------------------------
-- 15. Devoluciones, reclamos y cancelaciones
-- -----------------------------------------------------------------------------
-- Busca la venta por número de ML (id_externo) o folio, con los permisos de quien
-- busca: a un vendedor no le aparece la venta de otro.
create or replace function public.buscar_venta(p_texto text)
returns table (id uuid, folio text, canal public.canal_venta, id_externo text, cliente text, fecha date,
               estado public.estado_pedido, vendedor text, partidas text)
language sql stable security invoker set search_path = public as $$
  with t as (select nullif(trim(p_texto), '') t)
  select p.id, p.folio, p.canal, p.id_externo, c.nombre, p.fecha, p.estado, pf.nombre,
    (select string_agg(format('%s × %s', l.cantidad::float8, l.titulo), '; ' order by l.orden) from pedido_lineas l where l.pedido_id = p.id)
  from pedidos p cross join t
  left join clientes c on c.id = p.cliente_id
  left join perfiles pf on pf.id = p.vendedor_id
  where t.t is not null and not coalesce(p.historico, false)
    and (p.id_externo = t.t or upper(p.folio) = upper(t.t)
         or (length(t.t) >= 4 and (p.id_externo ilike '%' || t.t || '%' or p.folio ilike '%' || t.t)))
  order by (p.id_externo = t.t or upper(p.folio) = upper(t.t)) desc, (p.canal = 'mercadolibre') desc, p.fecha desc
  limit 8
$$;

create or replace function public.abrir_devolucion(p_pedido uuid, p_tipo text, p_motivo text, p_codigo text default null,
  p_fecha_esperada date default null, p_fecha_limite timestamptz default null, p_lineas jsonb default null,
  p_envio uuid default null, p_responsable uuid default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare p pedidos; v uuid; v_otra text; v_cfg jsonb; l record; v_cant numeric; v_n int := 0; v_envio uuid;
begin
  if not puede('envios', 2) then raise exception 'Sin permiso para registrar devoluciones' using errcode = '42501'; end if;
  select * into p from pedidos where id = p_pedido;
  if p.id is null or not (pedido_visible(p.id) or ve_todos_los_envios()) then
    raise exception 'No encontré la venta' using errcode = '42501';
  end if;
  if p_tipo is null or p_tipo not in ('devolucion', 'reclamo', 'cancelacion') then raise exception 'Tipo no válido: %', coalesce(p_tipo, 'vacío'); end if;
  if length(trim(coalesce(p_motivo, ''))) < 3 then raise exception 'Escribe el motivo (lo que dice el cliente o Mercado Libre)'; end if;
  select folio into v_otra from devoluciones where pedido_id = p.id and tipo = p_tipo and estado not in ('resuelta', 'cancelada') limit 1;
  if v_otra is not null then raise exception 'Esta venta ya tiene % abierta: %', case p_tipo when 'reclamo' then 'un reclamo' when 'cancelacion' then 'una cancelación' else 'una devolución' end, v_otra; end if;
  if p_responsable is not null and not exists (select 1 from perfiles where id = p_responsable and activo) then
    raise exception 'Ese responsable no existe';
  end if;
  if p_envio is not null then
    select id into v_envio from envios where id = p_envio and pedido_id = p.id;
    if v_envio is null then raise exception 'Ese envío no es de esta venta'; end if;
  else
    select id into v_envio from envios where pedido_id = p.id and estado <> 'cancelado' order by enviado_en desc nulls last, solicitado_en desc limit 1;
  end if;
  select valor into v_cfg from configuracion where clave = 'envios';
  insert into devoluciones (pedido_id, envio_id, tipo, codigo_autorizacion, motivo, fecha_esperada, fecha_limite, responsable_id)
  values (p.id, v_envio, p_tipo, nullif(trim(p_codigo), ''), trim(p_motivo),
    case when p_tipo = 'devolucion' then coalesce(p_fecha_esperada, sumar_dias_habiles(hoy_planta(), coalesce((v_cfg->>'dias_devolucion')::int, 3))) end,
    case when p_tipo = 'reclamo' then coalesce(p_fecha_limite, now() + make_interval(hours => coalesce((v_cfg->>'horas_respuesta_reclamo')::int, 24)))
         else p_fecha_limite end,
    coalesce(p_responsable, auth.uid()))
  returning id into v;
  -- Partidas: lo que se pidió o, si no se dice, todo lo de la venta que lleva artículo.
  for l in select pl.id, pl.articulo_id, pl.titulo, pl.cantidad from pedido_lineas pl left join articulos a on a.id = pl.articulo_id
           where pl.pedido_id = p.id and pl.articulo_id is not null and a.tipo <> 'servicio' order by pl.orden loop
    if p_lineas is not null then
      select (x->>'cantidad')::numeric into v_cant from jsonb_array_elements(p_lineas) x where (x->>'pedido_linea_id')::uuid = l.id;
      if coalesce(v_cant, 0) <= 0 then continue; end if;
      if v_cant > l.cantidad then raise exception 'De "%" se vendieron %, no se pueden devolver %', l.titulo, l.cantidad::float8, v_cant::float8; end if;
    else
      v_cant := l.cantidad;
    end if;
    insert into devolucion_lineas (devolucion_id, pedido_linea_id, articulo_id, descripcion, cantidad)
    values (v, l.id, l.articulo_id, l.titulo, v_cant);
    v_n := v_n + 1;
  end loop;
  if p_tipo = 'devolucion' and v_n = 0 then raise exception 'Di qué partidas regresan'; end if;
  insert into eventos_envio (devolucion_id, tipo, nota) values (v, 'abierta',
    concat_ws(' · ', case p_tipo when 'devolucion' then 'Devolución' when 'reclamo' then 'Reclamo' else 'Cancelación' end,
              case when nullif(trim(p_codigo), '') is not null then 'código ' || trim(p_codigo) end, trim(p_motivo)));
  return v;
end $$;

create or replace function public.actualizar_devolucion(p_dev uuid, p_datos jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare d devoluciones; v_cambios text[] := '{}';
begin
  if not puede('envios', 2) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  select * into d from devoluciones where id = p_dev for update;
  if d.id is null or not devolucion_visible(p_dev) then raise exception 'No existe la devolución' using errcode = '42501'; end if;
  if d.estado in ('resuelta', 'cancelada') then raise exception '% ya está %', d.folio, d.estado; end if;
  if p_datos ? 'responsable_id' and not exists (select 1 from perfiles where id = nullif(p_datos->>'responsable_id', '')::uuid and activo) then
    raise exception 'Ese responsable no existe';
  end if;
  if p_datos ? 'motivo' and length(trim(coalesce(p_datos->>'motivo', ''))) < 3 then raise exception 'Escribe el motivo'; end if;
  update devoluciones set
    codigo_autorizacion = case when p_datos ? 'codigo_autorizacion' then nullif(trim(p_datos->>'codigo_autorizacion'), '') else codigo_autorizacion end,
    motivo = case when p_datos ? 'motivo' then trim(p_datos->>'motivo') else motivo end,
    fecha_esperada = case when p_datos ? 'fecha_esperada' then nullif(p_datos->>'fecha_esperada', '')::date else fecha_esperada end,
    fecha_limite = case when p_datos ? 'fecha_limite' then nullif(p_datos->>'fecha_limite', '')::timestamptz else fecha_limite end,
    responsable_id = case when p_datos ? 'responsable_id' then nullif(p_datos->>'responsable_id', '')::uuid else responsable_id end
  where id = p_dev;
  if p_datos ? 'codigo_autorizacion' and nullif(trim(p_datos->>'codigo_autorizacion'), '') is distinct from d.codigo_autorizacion then
    v_cambios := array_append(v_cambios, 'Código: ' || coalesce(nullif(trim(p_datos->>'codigo_autorizacion'), ''), 'sin código'));
  end if;
  if p_datos ? 'fecha_esperada' and nullif(p_datos->>'fecha_esperada', '')::date is distinct from d.fecha_esperada then
    v_cambios := array_append(v_cambios, 'Llega: ' || coalesce(to_char(nullif(p_datos->>'fecha_esperada', '')::date, 'DD/MM'), 'sin fecha'));
  end if;
  if p_datos ? 'fecha_limite' and nullif(p_datos->>'fecha_limite', '')::timestamptz is distinct from d.fecha_limite then
    v_cambios := array_append(v_cambios, 'Límite: ' || coalesce(to_char(nullif(p_datos->>'fecha_limite', '')::timestamptz at time zone 'America/Mexico_City', 'DD/MM HH24:MI'), 'sin límite'));
  end if;
  if p_datos ? 'responsable_id' and nullif(p_datos->>'responsable_id', '')::uuid is distinct from d.responsable_id then
    v_cambios := array_append(v_cambios, 'Lo lleva ' || coalesce((select nombre from perfiles where id = nullif(p_datos->>'responsable_id', '')::uuid), 'nadie'));
  end if;
  if cardinality(v_cambios) > 0 then
    insert into eventos_envio (devolucion_id, tipo, nota) values (p_dev, 'cambio', array_to_string(v_cambios, ' · '));
  end if;
end $$;

create or replace function public.responder_reclamo(p_dev uuid, p_respuesta text) returns void
language plpgsql security definer set search_path = public as $$
declare d devoluciones;
begin
  if not puede('envios', 2) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  select * into d from devoluciones where id = p_dev for update;
  if d.id is null or not devolucion_visible(p_dev) then raise exception 'No existe el reclamo' using errcode = '42501'; end if;
  if d.tipo <> 'reclamo' then raise exception '% no es un reclamo', d.folio; end if;
  if d.estado <> 'abierta' then raise exception 'El reclamo % ya está %', d.folio, d.estado; end if;
  if length(trim(coalesce(p_respuesta, ''))) < 5 then raise exception 'Escribe qué se le contestó'; end if;
  update devoluciones set respuesta = trim(p_respuesta), respondido_por = auth.uid(), respondido_en = now(), estado = 'respondida'
  where id = p_dev;
  insert into eventos_envio (devolucion_id, tipo, nota) values (p_dev, 'respondida', left(trim(p_respuesta), 300));
end $$;

-- Almacén recibe la devolución: con fotos de cómo llegó y lo que de verdad llegó.
create or replace function public.recibir_devolucion(p_dev uuid, p_lineas jsonb default null, p_nota text default null) returns void
language plpgsql security definer set search_path = public as $$
declare d devoluciones; l record; v_cant numeric;
begin
  if not (puede('envios', 2) and puede('inventario', 2)) then
    raise exception 'La devolución la recibe almacén' using errcode = '42501';
  end if;
  select * into d from devoluciones where id = p_dev for update;
  if d.id is null or not devolucion_visible(p_dev) then raise exception 'No existe la devolución' using errcode = '42501'; end if;
  if d.tipo <> 'devolucion' then raise exception '% no es una devolución', d.folio; end if;
  if d.estado <> 'abierta' then raise exception 'La devolución % ya está %', d.folio, d.estado; end if;
  if not exists (select 1 from evidencias_envio where devolucion_id = p_dev and tipo = 'recepcion') then
    raise exception 'Toma al menos una foto de cómo llegó, antes de abrirla: es la prueba ante Mercado Libre o la paquetería';
  end if;
  for l in select * from devolucion_lineas where devolucion_id = p_dev loop
    v_cant := l.cantidad;
    if p_lineas is not null then
      select (x->>'cantidad_recibida')::numeric into v_cant from jsonb_array_elements(p_lineas) x where (x->>'linea_id')::uuid = l.id;
      v_cant := coalesce(v_cant, 0);
    end if;
    if v_cant < 0 or v_cant > l.cantidad then raise exception 'De "%" se esperaban %: no se pueden recibir %', l.descripcion, l.cantidad::float8, v_cant::float8; end if;
    update devolucion_lineas set cantidad_recibida = v_cant where id = l.id;
  end loop;
  update devoluciones set estado = 'recibida', recibido_por = auth.uid(), recibido_en = now(), nota_recepcion = nullif(trim(p_nota), '')
  where id = p_dev;
  insert into eventos_envio (devolucion_id, tipo, nota) values (p_dev, 'recibida',
    concat_ws(' · ', (select string_agg(format('%s de %s %s', cantidad_recibida::float8, cantidad::float8, descripcion), '; ')
                      from devolucion_lineas where devolucion_id = p_dev), nullif(trim(p_nota), '')));
end $$;

-- Decisión al recibir (almacén): reingreso, merma o reclamo a la paquetería.
-- Reclamo y cancelación se cierran con su resultado (quien lo lleva).
create or replace function public.resolver_devolucion(p_dev uuid, p_resultado text, p_almacen int default null,
  p_nota text default null, p_reclamo text default null, p_monto numeric default null) returns void
language plpgsql security definer set search_path = public as $$
declare d devoluciones; l record; v_mov bigint; v_aj uuid; v_ped text; v_actual numeric; v_n int := 0;
begin
  select * into d from devoluciones where id = p_dev for update;
  if d.id is null or not devolucion_visible(p_dev) then raise exception 'No existe la devolución' using errcode = '42501'; end if;
  if d.estado in ('resuelta', 'cancelada') then raise exception '% ya está %', d.folio, d.estado; end if;
  select folio into v_ped from pedidos where id = d.pedido_id;

  if d.tipo = 'devolucion' then
    if not (puede('envios', 2) and puede('inventario', 2)) then
      raise exception 'Qué se hace con lo devuelto lo decide almacén' using errcode = '42501';
    end if;
    if d.estado <> 'recibida' then raise exception 'Primero recibe la devolución, con fotos de cómo llegó'; end if;
    if p_resultado is null or p_resultado not in ('reingreso', 'merma', 'reclamo_transportista') then
      raise exception 'Elige: reingresa al inventario, merma o reclamo a la paquetería';
    end if;
    if d.reingresado_en is not null then raise exception 'La devolución % ya entró al inventario', d.folio; end if;
    if p_resultado in ('reingreso', 'merma') then
      if not exists (select 1 from almacenes where id = p_almacen and activo) then raise exception 'Elige a qué almacén entra'; end if;
      if p_resultado = 'merma' and length(trim(coalesce(p_nota, ''))) < 5 then raise exception 'Escribe qué tiene (por qué es merma)'; end if;
      for l in select dl.*, a.controla_inventario, a.tipo art_tipo from devolucion_lineas dl left join articulos a on a.id = dl.articulo_id
               where dl.devolucion_id = p_dev and coalesce(dl.cantidad_recibida, 0) > 0 loop
        if l.articulo_id is null or not coalesce(l.controla_inventario, false) or l.art_tipo = 'servicio' then continue; end if;
        -- Lo devuelto está físicamente en planta: entra con un movimiento inmutable.
        insert into movimientos_inventario (tipo, articulo_id, almacen_id, cantidad, pedido_id, motivo, costo_unitario)
        values ('devolucion', l.articulo_id, p_almacen, l.cantidad_recibida, d.pedido_id,
                concat_ws(' · ', d.folio, v_ped, case when p_resultado = 'merma' then 'merma' end),
                (select c.costo * tc(c.moneda) from costos_articulo c where c.articulo_id = l.articulo_id))
        returning id into v_mov;
        v_aj := null;
        if p_resultado = 'merma' then
          -- No sirve para vender: se pide el ajuste de salida y lo autoriza otra
          -- persona con el flujo de ajustes de siempre. Hasta entonces se ve en existencia.
          select coalesce(x.cantidad, 0) into v_actual from existencias x where x.articulo_id = l.articulo_id and x.almacen_id = p_almacen;
          insert into ajustes_inventario (folio, articulo_id, almacen_id, cantidad_sistema, cantidad_fisica, motivo)
          values (siguiente_folio('AJU'), l.articulo_id, p_almacen, coalesce(v_actual, 0),
                  greatest(coalesce(v_actual, 0) - l.cantidad_recibida, 0),
                  format('Merma de la devolución %s (%s): %s', d.folio, v_ped, trim(p_nota)))
          returning id into v_aj;
        end if;
        update devolucion_lineas set movimiento_id = v_mov, ajuste_id = v_aj where id = l.id;
        v_n := v_n + 1;
      end loop;
      update devoluciones set reingresado_en = now(), almacen_id = p_almacen where id = p_dev;
    elsif nullif(trim(p_reclamo), '') is null then
      raise exception 'Escribe el folio del reclamo con la paquetería';
    end if;
  else
    if not puede('envios', 2) then raise exception 'Sin permiso' using errcode = '42501'; end if;
    if p_resultado is null or p_resultado not in ('a_favor', 'en_contra', 'sin_efecto') then
      raise exception 'Elige cómo se resolvió: a favor, en contra o sin efecto';
    end if;
  end if;

  update devoluciones set estado = 'resuelta', resultado = p_resultado, resuelto_por = auth.uid(), resuelto_en = now(),
    nota_resolucion = nullif(trim(p_nota), ''), reclamo_transportista = nullif(trim(p_reclamo), ''),
    monto_reclamado = case when p_monto is not null then round(p_monto, 2) end
  where id = p_dev;
  insert into eventos_envio (devolucion_id, tipo, nota) values (p_dev, 'resuelta',
    concat_ws(' · ', case p_resultado when 'reingreso' then 'Reingresó al inventario' when 'merma' then 'Merma: ajuste por autorizar'
                       when 'reclamo_transportista' then 'Reclamo a la paquetería ' || trim(p_reclamo)
                       when 'a_favor' then 'Resuelto a favor' when 'en_contra' then 'Resuelto en contra' else 'Sin efecto' end,
              case when v_n > 0 then format('%s partida(s) al almacén', v_n) end, nullif(trim(p_nota), '')));
end $$;

create or replace function public.cancelar_devolucion(p_dev uuid, p_motivo text) returns void
language plpgsql security definer set search_path = public as $$
declare d devoluciones;
begin
  if not puede('envios', 2) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  select * into d from devoluciones where id = p_dev for update;
  if d.id is null or not devolucion_visible(p_dev) then raise exception 'No existe la devolución' using errcode = '42501'; end if;
  if d.estado in ('recibida', 'resuelta', 'cancelada') then raise exception '% ya está %: no se cancela', d.folio, d.estado; end if;
  if length(trim(coalesce(p_motivo, ''))) < 5 then raise exception 'Escribe por qué se cancela'; end if;
  update devoluciones set estado = 'cancelada', cancelado_por = auth.uid(), cancelado_en = now(), motivo_cancelacion = trim(p_motivo)
  where id = p_dev;
  insert into eventos_envio (devolucion_id, tipo, nota) values (p_dev, 'cancelada', trim(p_motivo));
end $$;

-- -----------------------------------------------------------------------------
-- 16. Vistas para las pantallas (con la RLS de quien consulta; sin costos de artículos)
-- -----------------------------------------------------------------------------
drop view if exists public.v_envios, public.v_envio_lineas, public.v_evidencias_envio, public.v_eventos_envio, public.v_devoluciones cascade;

create view public.v_envios with (security_invoker = true) as
select e.id, e.folio, e.pedido_id, p.folio as pedido_folio, p.canal, p.id_externo, p.cliente_id, c.nombre as cliente,
  p.vendedor_id, pv.nombre as vendedor, e.tipo, nombre_tipo_envio(e.tipo) as tipo_nombre, e.estado,
  e.paqueteria_id, q.nombre as paqueteria, q.usa_saldo, e.servicio, e.contacto_id, e.destinatario, e.telefono, e.destino,
  e.fecha_recoleccion, e.notas, e.costo_cotizado, e.costo_real, e.numero_guia,
  e.solicitado_por, sp.nombre as solicitado_por_nombre, e.solicitado_en,
  e.cotizado_por, cp.nombre as cotizado_por_nombre, e.cotizado_en,
  e.guia_por, gp.nombre as guia_por_nombre, e.guia_en,
  e.empacado_por, ep.nombre as empacado_por_nombre, e.empacado_en, e.checklist,
  e.enviado_por, np.nombre as enviado_por_nombre, e.enviado_en,
  e.entregado_por, dp.nombre as entregado_por_nombre, e.entregado_en, e.recibio,
  e.cancelado_por, xp.nombre as cancelado_por_nombre, e.cancelado_en, e.motivo_cancelacion, e.guia_reembolsada,
  e.inventario_descontado_en,
  b.bultos, b.peso_total, b.peso_volumetrico, b.sin_medidas,
  l.partidas, l.piezas, l.resumen, l.lleva_equipo,
  (select count(*) from public.evidencias_envio v where v.envio_id = e.id and v.tipo = 'empaque')::int as fotos,
  (select v.ruta from public.evidencias_envio v where v.envio_id = e.id and v.tipo = 'guia' order by v.en desc limit 1) as guia_ruta,
  -- Lo que toca hacer (las pestañas de la pantalla).
  e.estado not in ('enviado', 'entregado', 'cancelado') as abierto,
  e.tipo in ('paqueteria', 'flete', 'recoge', 'a_full') as lleva_empaque,
  (e.estado not in ('enviado', 'entregado', 'cancelado') and e.tipo in ('paqueteria', 'flete') and e.guia_en is null) as falta_guia,
  (e.estado not in ('enviado', 'entregado', 'cancelado') and e.tipo in ('paqueteria', 'flete', 'recoge', 'a_full') and e.empacado_en is null) as falta_empaque,
  (e.estado not in ('enviado', 'entregado', 'cancelado')
   and (e.empacado_en is not null or e.tipo in ('full', 'proveedor'))
   and not (e.tipo = 'paqueteria' and e.numero_guia is null)) as listo_para_salir,
  (hoy_planta() - (e.solicitado_en at time zone 'America/Mexico_City')::date) as dias_desde_solicitud,
  case when e.estado = 'enviado' then hoy_planta() - (e.enviado_en at time zone 'America/Mexico_City')::date end as dias_en_camino,
  e.actualizado_en
from public.envios e
left join public.pedidos p on p.id = e.pedido_id
left join public.clientes c on c.id = p.cliente_id
left join public.perfiles pv on pv.id = p.vendedor_id
left join public.paqueterias q on q.id = e.paqueteria_id
left join public.perfiles sp on sp.id = e.solicitado_por
left join public.perfiles cp on cp.id = e.cotizado_por
left join public.perfiles gp on gp.id = e.guia_por
left join public.perfiles ep on ep.id = e.empacado_por
left join public.perfiles np on np.id = e.enviado_por
left join public.perfiles dp on dp.id = e.entregado_por
left join public.perfiles xp on xp.id = e.cancelado_por
left join lateral (
  select count(*)::int bultos, sum(x.peso_kg) peso_total,
    -- Peso volumétrico de paquetería: largo × ancho × alto / 5000 (cm → kg).
    round(sum(x.largo_cm * x.ancho_cm * x.alto_cm / 5000.0), 2) peso_volumetrico,
    count(*) filter (where x.peso_kg is null or x.largo_cm is null or x.ancho_cm is null or x.alto_cm is null)::int sin_medidas
  from public.envio_bultos x where x.envio_id = e.id) b on true
left join lateral (
  select count(*)::int partidas, sum(x.cantidad) piezas,
    string_agg(format('%s × %s', x.cantidad::float8, x.descripcion), '; ' order by x.orden) resumen,
    coalesce(bool_or(a.tipo in ('equipo', 'subensamble')), false) lleva_equipo
  from public.envio_lineas x left join public.articulos a on a.id = x.articulo_id where x.envio_id = e.id) l on true;

create view public.v_envio_lineas with (security_invoker = true) as
select el.id, el.envio_id, el.orden, el.pedido_linea_id, el.articulo_id, a.clave, coalesce(a.nombre, el.descripcion) as nombre,
  el.descripcion, a.tipo as articulo_tipo, a.unidad, el.cantidad, el.almacen_id, al.nombre as almacen, el.series,
  el.cantidad_descontada, el.movimiento_id is not null or el.traspaso_id is not null as descontado, el.nota_inventario,
  a.paquete_kg, a.paquete_largo_cm, a.paquete_ancho_cm, a.paquete_alto_cm, a.paquete_piezas,
  -- Series que tiene que llevar (las de sus órdenes de producción) y si ya se terminaron.
  o.series_orden, o.ordenes, o.ordenes_sin_terminar
from public.envio_lineas el
join public.envios e on e.id = el.envio_id
left join public.articulos a on a.id = el.articulo_id
left join public.almacenes al on al.id = el.almacen_id
left join lateral (
  select array_agg(x.numero_serie order by x.folio) filter (where x.numero_serie is not null) series_orden,
    array_agg(x.folio order by x.folio) ordenes,
    count(*) filter (where x.estado not in ('terminada', 'entregada'))::int ordenes_sin_terminar
  from public.ordenes_produccion x
  where x.estado <> 'cancelada' and e.pedido_id is not null
    and (x.pedido_linea_id = el.pedido_linea_id or (x.pedido_id = e.pedido_id and x.pedido_linea_id is null and x.articulo_id = el.articulo_id))
  having count(*) > 0) o on true;

create view public.v_evidencias_envio with (security_invoker = true) as
select v.id, v.envio_id, v.devolucion_id, v.tipo, v.ruta, v.nota, v.subido_por, p.nombre as subido_por_nombre, v.en
from public.evidencias_envio v left join public.perfiles p on p.id = v.subido_por;

create view public.v_eventos_envio with (security_invoker = true) as
select v.id, v.envio_id, v.devolucion_id, v.tipo, v.nota, v.usuario_id, p.nombre as usuario, v.en
from public.eventos_envio v left join public.perfiles p on p.id = v.usuario_id;

create view public.v_devoluciones with (security_invoker = true) as
select d.id, d.folio, d.pedido_id, p.folio as pedido_folio, p.canal, p.id_externo, p.cliente_id, c.nombre as cliente,
  p.vendedor_id, pv.nombre as vendedor, d.envio_id, e.folio as envio_folio, e.numero_guia, q.nombre as paqueteria,
  d.tipo, d.estado, d.codigo_autorizacion, d.motivo, d.fecha_esperada, d.fecha_limite,
  d.responsable_id, r.nombre as responsable, d.respuesta, d.respondido_en, rp.nombre as respondido_por_nombre,
  d.recibido_en, rc.nombre as recibido_por_nombre, d.nota_recepcion,
  d.resultado, d.almacen_id, al.nombre as almacen, d.reclamo_transportista, d.monto_reclamado, d.nota_resolucion,
  d.resuelto_en, rs.nombre as resuelto_por_nombre, d.reingresado_en,
  d.cancelado_en, d.motivo_cancelacion, d.creado_por, cr.nombre as creado_por_nombre, d.creado_en,
  (select string_agg(format('%s × %s', x.cantidad::float8, x.descripcion), '; ') from public.devolucion_lineas x where x.devolucion_id = d.id) as resumen,
  (select count(*) from public.evidencias_envio v where v.devolucion_id = d.id)::int as fotos,
  d.estado not in ('resuelta', 'cancelada') as abierta,
  -- Lo que vence: el reclamo, a la hora límite para responder; la devolución, el día que debía llegar.
  case when d.tipo = 'reclamo' and d.estado = 'abierta' then d.fecha_limite
       when d.tipo = 'devolucion' and d.estado = 'abierta' and d.fecha_esperada is not null
         then (d.fecha_esperada + time '18:00') at time zone 'America/Mexico_City'
       when d.tipo = 'cancelacion' and d.estado = 'abierta' then d.fecha_limite end as vence,
  (d.tipo = 'reclamo' and d.estado = 'abierta' and d.fecha_limite < now())
    or (d.tipo = 'devolucion' and d.estado = 'abierta' and d.fecha_esperada < hoy_planta()) as vencida,
  d.actualizado_en
from public.devoluciones d
join public.pedidos p on p.id = d.pedido_id
left join public.clientes c on c.id = p.cliente_id
left join public.perfiles pv on pv.id = p.vendedor_id
left join public.envios e on e.id = d.envio_id
left join public.paqueterias q on q.id = e.paqueteria_id
left join public.perfiles r on r.id = d.responsable_id
left join public.perfiles rp on rp.id = d.respondido_por
left join public.perfiles rc on rc.id = d.recibido_por
left join public.perfiles rs on rs.id = d.resuelto_por
left join public.perfiles cr on cr.id = d.creado_por
left join public.almacenes al on al.id = d.almacen_id;

grant select on public.v_envios, public.v_envio_lineas, public.v_evidencias_envio, public.v_eventos_envio, public.v_devoluciones to authenticated;
revoke all on public.v_envios, public.v_envio_lineas, public.v_evidencias_envio, public.v_eventos_envio, public.v_devoluciones from anon;

-- -----------------------------------------------------------------------------
-- 17. Avisos
-- -----------------------------------------------------------------------------
create or replace function public.aviso_envio() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_ped text; v_cli text; v_vend uuid; v_dest uuid[]; v_quien text; v_ruta text := '/almacen/envios?envio=' || new.id;
begin
  select p.folio, c.nombre, p.vendedor_id into v_ped, v_cli, v_vend
  from pedidos p left join clientes c on c.id = p.cliente_id where p.id = new.pedido_id;
  v_quien := coalesce(v_cli, case when new.tipo = 'a_full' then 'Full de Mercado Libre' end, 'sin cliente');
  v_dest := array[v_vend, new.solicitado_por];
  if tg_op = 'INSERT' then
    if new.tipo in ('paqueteria', 'flete', 'recoge', 'a_full') then
      perform avisar(array(select usuarios_con_rol('almacen')), 'envio_nuevo',
        format('Envío nuevo %s: %s', new.folio, v_quien),
        concat_ws(' · ', nombre_tipo_envio(new.tipo), v_ped,
                  case when new.fecha_recoleccion is not null then 'recolección ' || to_char(new.fecha_recoleccion, 'DD/MM') end),
        v_ruta, 'envios', new.id::text);
    end if;
  elsif new.estado is distinct from old.estado then
    case new.estado
      when 'guia_lista' then
        perform avisar(array(select usuarios_con_rol('almacen')), 'envio_guia_lista', format('Guía lista: empacar %s', new.folio),
          concat_ws(' · ', v_quien, (select nombre from paqueterias where id = new.paqueteria_id), new.numero_guia), v_ruta, 'envios', new.id::text);
      when 'empacado' then
        perform avisar(v_dest, 'envio_empacado', format('%s empacado', new.folio),
          concat_ws(' · ', v_quien, v_ped, format('%s foto(s)', (select count(*) from evidencias_envio where envio_id = new.id and tipo = 'empaque'))),
          v_ruta, 'envios', new.id::text);
      when 'enviado' then
        perform avisar(v_dest, 'envio_enviado', format('Salió %s', new.folio),
          concat_ws(' · ', v_quien, (select nombre from paqueterias where id = new.paqueteria_id), case when new.numero_guia is not null then 'guía ' || new.numero_guia end),
          v_ruta, 'envios', new.id::text);
      when 'entregado' then
        perform avisar(v_dest, 'envio_entregado', format('Entregado %s', new.folio),
          concat_ws(' · ', v_quien, case when new.recibio is not null then 'recibió ' || new.recibio end), v_ruta, 'envios', new.id::text);
      when 'cancelado' then
        perform avisar(case when old.estado in ('guia_lista', 'empacado') or old.empacado_en is not null
                            then array(select usuarios_con_rol('almacen')) || v_dest else v_dest end,
          'envio_cancelado', format('Cancelado %s', new.folio), concat_ws(' · ', v_quien, new.motivo_cancelacion), v_ruta, 'envios', new.id::text);
      else null;
    end case;
  end if;
  -- "Hoy vienen por él": al ponerle fecha de hoy.
  if new.fecha_recoleccion = hoy_planta() and new.estado not in ('enviado', 'entregado', 'cancelado')
     and (tg_op = 'INSERT' or new.fecha_recoleccion is distinct from old.fecha_recoleccion) then
    perform avisar(array(select usuarios_con_rol('almacen')), 'envio_hoy',
      format('Hoy %s %s', case when new.tipo = 'recoge' then 'vienen por' else 'sale' end, new.folio),
      concat_ws(' · ', v_quien, nombre_tipo_envio(new.tipo), case when new.empacado_en is null then 'todavía sin empacar' end),
      v_ruta, 'envios', new.id::text, true);
  end if;
  return new;
end $$;
drop trigger if exists aviso_envio on public.envios;
create trigger aviso_envio after insert or update of estado, fecha_recoleccion on public.envios
  for each row execute function public.aviso_envio();

create or replace function public.aviso_devolucion() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_ped text; v_ext text; v_cli text; v_vend uuid; v_ruta text := '/ventas/devoluciones?id=' || new.id; v_que text;
begin
  select p.folio, p.id_externo, c.nombre, p.vendedor_id into v_ped, v_ext, v_cli, v_vend
  from pedidos p left join clientes c on c.id = p.cliente_id where p.id = new.pedido_id;
  v_que := concat_ws(' · ', v_cli, coalesce('venta #' || v_ext, v_ped));
  if tg_op = 'INSERT' then
    if new.tipo = 'devolucion' then
      perform avisar(array(select usuarios_con_rol('almacen')), 'devolucion_por_llegar',
        format('Viene una devolución: %s', new.folio),
        concat_ws(' · ', v_que, case when new.codigo_autorizacion is not null then 'código ' || new.codigo_autorizacion end,
                  case when new.fecha_esperada is not null then 'llega ~' || to_char(new.fecha_esperada, 'DD/MM') end, left(new.motivo, 120)),
        v_ruta, 'devoluciones', new.id::text);
    end if;
    perform avisar(array[new.responsable_id, v_vend], 'devolucion_nueva',
      format('%s %s', case new.tipo when 'reclamo' then 'Reclamo' when 'cancelacion' then 'Cancelación' else 'Devolución' end, new.folio),
      concat_ws(' · ', v_que, left(new.motivo, 140),
                case when new.tipo = 'reclamo' and new.fecha_limite is not null
                     then 'responder antes de ' || to_char(new.fecha_limite at time zone 'America/Mexico_City', 'DD/MM HH24:MI') end),
      v_ruta, 'devoluciones', new.id::text);
  elsif new.estado is distinct from old.estado and new.estado in ('recibida', 'resuelta') then
    perform avisar(array[new.responsable_id, v_vend, new.creado_por],
      'devolucion_' || new.estado, format('%s %s', new.folio, case new.estado when 'recibida' then 'llegó a planta' else 'resuelta' end),
      concat_ws(' · ', v_que, case new.resultado when 'reingreso' then 'reingresó al inventario' when 'merma' then 'merma'
                                when 'reclamo_transportista' then 'reclamo a la paquetería' when 'a_favor' then 'a favor'
                                when 'en_contra' then 'en contra' end, new.nota_recepcion),
      v_ruta, 'devoluciones', new.id::text);
  elsif new.responsable_id is distinct from old.responsable_id then
    perform avisar(array[new.responsable_id], 'devolucion_asignada', format('Te toca %s', new.folio), v_que, v_ruta, 'devoluciones', new.id::text);
  end if;
  return new;
end $$;
drop trigger if exists aviso_devolucion on public.devoluciones;
create trigger aviso_devolucion after insert or update of estado, responsable_id on public.devoluciones
  for each row execute function public.aviso_devolucion();

-- Recordatorios (pg_cron cada 30 min, solo en horario de planta): solicitudes sin
-- cotizar, "hoy vienen por él", devoluciones que debían llegar, reclamos por vencer
-- y saldo bajo. Cada uno una vez al día por registro.
create or replace function public.avisos_envios() returns int
language plpgsql security definer set search_path = public as $$
declare v_n int := 0; r record; v_cfg jsonb; v_hora int := extract(hour from now() at time zone 'America/Mexico_City');
begin
  if v_hora < 7 or v_hora >= 20 then return 0; end if;
  select valor into v_cfg from configuracion where clave = 'envios';
  for r in select e.id, e.folio, e.solicitado_por, c.nombre cliente from envios e
           left join pedidos p on p.id = e.pedido_id left join clientes c on c.id = p.cliente_id
           where e.estado = 'solicitado' and e.tipo in ('paqueteria', 'flete') and e.guia_en is null
             and e.solicitado_en < now() - make_interval(hours => coalesce((v_cfg->>'horas_para_cotizar')::int, 4)) loop
    v_n := v_n + avisar(array(select usuarios_con_rol('gerente_ventas')) || r.solicitado_por, 'envio_sin_cotizar',
      format('%s sigue sin cotizar', r.folio), coalesce(r.cliente, ''), '/almacen/envios?envio=' || r.id, 'envios', r.id::text, true);
  end loop;
  for r in select e.id, e.folio, e.tipo, e.empacado_en, coalesce(c.nombre, 'Full de Mercado Libre') cliente from envios e
           left join pedidos p on p.id = e.pedido_id left join clientes c on c.id = p.cliente_id
           where e.estado not in ('enviado', 'entregado', 'cancelado') and e.fecha_recoleccion <= hoy_planta() loop
    v_n := v_n + avisar(array(select usuarios_con_rol('almacen')), 'envio_hoy',
      format('Hoy %s %s', case when r.tipo = 'recoge' then 'vienen por' else 'sale' end, r.folio),
      concat_ws(' · ', r.cliente, case when r.empacado_en is null then 'todavía sin empacar' end),
      '/almacen/envios?envio=' || r.id, 'envios', r.id::text, true);
  end loop;
  for r in select d.id, d.folio, d.codigo_autorizacion, c.nombre cliente from devoluciones d
           join pedidos p on p.id = d.pedido_id left join clientes c on c.id = p.cliente_id
           where d.tipo = 'devolucion' and d.estado = 'abierta' and d.fecha_esperada <= hoy_planta() loop
    v_n := v_n + avisar(array(select usuarios_con_rol('almacen')), 'devolucion_por_llegar',
      format('Hoy debía llegar la devolución %s', r.folio),
      concat_ws(' · ', r.cliente, case when r.codigo_autorizacion is not null then 'código ' || r.codigo_autorizacion end),
      '/ventas/devoluciones?id=' || r.id, 'devoluciones', r.id::text, true);
  end loop;
  for r in select d.id, d.folio, d.responsable_id, d.fecha_limite, p.vendedor_id, c.nombre cliente from devoluciones d
           join pedidos p on p.id = d.pedido_id left join clientes c on c.id = p.cliente_id
           where d.tipo = 'reclamo' and d.estado = 'abierta'
             and d.fecha_limite < now() + make_interval(hours => coalesce((v_cfg->>'horas_aviso_reclamo')::int, 6)) loop
    v_n := v_n + avisar(array[coalesce(r.responsable_id, r.vendedor_id)], 'reclamo_por_vencer',
      format('%s %s', r.folio, case when r.fecha_limite < now() then 'ya venció' else 'vence pronto' end),
      concat_ws(' · ', r.cliente, 'límite ' || to_char(r.fecha_limite at time zone 'America/Mexico_City', 'DD/MM HH24:MI')),
      '/ventas/devoluciones?id=' || r.id, 'devoluciones', r.id::text, true);
  end loop;
  for r in select paqueteria_id from saldos_paqueteria_todas() where bajo loop
    if revisar_saldo_paqueteria(r.paqueteria_id) then v_n := v_n + 1; end if;
  end loop;
  return v_n;
end $$;
revoke execute on function public.avisos_envios() from public, anon, authenticated;

do $$ begin
  perform cron.unschedule('avisos-envios') where exists (select 1 from cron.job where jobname = 'avisos-envios');
  perform cron.schedule('avisos-envios', '7,37 * * * *', 'select public.avisos_envios()');
exception when others then
  raise notice 'pg_cron no está disponible: los recordatorios de envíos quedan apagados (%).', sqlerrm;
end $$;

-- -----------------------------------------------------------------------------
-- 18. Hallazgos de envíos (los junta hallazgos() de 20261003000068). Sin dinero
-- de artículos; con la RLS de quien pregunta.
-- -----------------------------------------------------------------------------
create or replace function public.hallazgos_envios(p_area text)
returns table (area text, tono text, titulo text, detalle text, ruta text, peso int)
language plpgsql stable security invoker set search_path = public as $$
declare v_hoy date := hoy_planta(); h jsonb := '[]'::jsonb; k int; k2 int; v_txt text; v_cfg jsonb; r record;
begin
  if not puede('envios', 1) or coalesce(p_area, 'direccion') not in ('direccion', 'almacen', 'ventas') then return; end if;
  select valor into v_cfg from configuracion where clave = 'envios';

  if coalesce(p_area, 'direccion') in ('direccion', 'almacen') and puede('inventario', 2) then
    -- Hoy salen o los recogen.
    select count(*), count(*) filter (where falta_empaque), string_agg(folio || coalesce(' (' || cliente || ')', ''), ', ')
      into k, k2, v_txt from v_envios where abierto and fecha_recoleccion <= v_hoy;
    if k > 0 then
      h := h || jsonb_build_object('area', 'almacen', 'tono', case when k2 > 0 then 'riesgo' else 'atencion' end,
        'titulo', format('%s %s hoy', k, case when k = 1 then 'envío sale o lo recogen' else 'envíos salen o los recogen' end),
        'detalle', left(v_txt, 220) || case when k2 > 0 then format('. %s sin empacar todavía.', k2) else '.' end,
        'ruta', '/almacen/envios?pestana=hoy', 'peso', 4);
    end if;
    -- Guía lista y sin empacar.
    select count(*) into k from v_envios where falta_empaque and guia_en is not null;
    if k > 0 then
      h := h || jsonb_build_object('area', 'almacen', 'tono', 'atencion',
        'titulo', format('%s %s con guía y sin empacar', k, case when k = 1 then 'envío' else 'envíos' end),
        'detalle', 'La guía ya se pagó: empácalos con fotos y check list para que salgan en la siguiente recolección.',
        'ruta', '/almacen/envios?pestana=empacar', 'peso', 12);
    end if;
    -- Devoluciones que debían llegar.
    select count(*), string_agg(folio || coalesce(' código ' || codigo_autorizacion, ''), ', ') into k, v_txt
    from devoluciones where tipo = 'devolucion' and estado = 'abierta' and fecha_esperada <= v_hoy;
    if k > 0 then
      h := h || jsonb_build_object('area', 'almacen', 'tono', 'atencion',
        'titulo', format('%s %s por recibir', k, case when k = 1 then 'devolución' else 'devoluciones' end),
        'detalle', left(v_txt, 200) || '. Al llegar: fotos de cómo viene antes de abrirla.',
        'ruta', '/ventas/devoluciones', 'peso', 14);
    end if;
    -- "Hizo falta darle salida a esta venta": pedidos entregados en 30 días sin
    -- salida de inventario de sus componentes (ni a mano ni con un envío).
    select count(*), string_agg(x.folio, ', ') into k, v_txt from (
      select distinct p.folio from pedidos p
      join pedido_lineas pl on pl.pedido_id = p.id join articulos a on a.id = pl.articulo_id
      where p.estado = 'entregado' and not coalesce(p.historico, false) and p.entregado_en >= now() - interval '30 days'
        and a.controla_inventario and a.tipo in ('componente', 'materia_prima')
        and not exists (select 1 from movimientos_inventario m where m.pedido_id = p.id and m.articulo_id = pl.articulo_id and m.tipo = 'salida_venta')
        and not exists (select 1 from envio_lineas el join envios e on e.id = el.envio_id
                        where el.pedido_linea_id = pl.id and e.inventario_descontado_en is not null)
      order by 1 limit 20) x;
    if k > 0 then
      h := h || jsonb_build_object('area', 'almacen', 'tono', 'riesgo',
        'titulo', format('%s %s sin salida de inventario', k, case when k = 1 then 'pedido entregado' else 'pedidos entregados' end),
        'detalle', format('%s. Se marcaron entregados sin envío ni salida de inventario: la existencia está inflada. Revisa con el vendedor qué salió y corrígelo con un ajuste; lo que sale con un envío ya no se olvida.', left(v_txt, 160)),
        'ruta', '/almacen/movimientos', 'peso', 6);
    end if;
  end if;

  if coalesce(p_area, 'direccion') in ('direccion', 'ventas') then
    -- Reclamos por vencer o vencidos (los de quien pregunta, por la RLS).
    select count(*), count(*) filter (where fecha_limite < now()),
           string_agg(folio || coalesce(' (' || cliente || ')', ''), ', ' order by fecha_limite)
      into k, k2, v_txt
    from v_devoluciones where tipo = 'reclamo' and estado = 'abierta'
      and fecha_limite < now() + make_interval(hours => coalesce((v_cfg->>'horas_aviso_reclamo')::int, 6) * 2);
    if k > 0 then
      h := h || jsonb_build_object('area', 'ventas', 'tono', 'riesgo',
        'titulo', case when k2 > 0 then format('%s %s sin respuesta y vencido', k2, case when k2 = 1 then 'reclamo' else 'reclamos' end)
                       else format('%s %s por vencer', k, case when k = 1 then 'reclamo' else 'reclamos' end) end,
        'detalle', left(v_txt, 200) || '. Un reclamo sin respuesta le baja la reputación a la cuenta de Mercado Libre.',
        'ruta', '/ventas/devoluciones', 'peso', 3);
    end if;
    -- Solicitudes sin cotizar.
    select count(*), string_agg(folio || coalesce(' (' || cliente || ')', ''), ', ') into k, v_txt from v_envios
    where estado = 'solicitado' and tipo in ('paqueteria', 'flete') and guia_en is null
      and solicitado_en < now() - make_interval(hours => coalesce((v_cfg->>'horas_para_cotizar')::int, 4));
    if k > 0 then
      h := h || jsonb_build_object('area', 'ventas', 'tono', 'atencion',
        'titulo', format('%s %s sin cotizar', k, case when k = 1 then 'envío' else 'envíos' end),
        'detalle', left(v_txt, 200) || '. Peso y medidas ya vienen del artículo: cotiza con eso.',
        'ruta', '/almacen/envios?pestana=cotizar', 'peso', 16);
    end if;
    -- En camino de más.
    select count(*), string_agg(folio || coalesce(' (' || cliente || ')', ''), ', ') into k, v_txt from v_envios
    where estado = 'enviado' and dias_en_camino > coalesce((v_cfg->>'dias_en_camino')::int, 5);
    if k > 0 then
      h := h || jsonb_build_object('area', 'ventas', 'tono', 'atencion',
        'titulo', format('%s %s en camino hace más de %s días', k, case when k = 1 then 'envío lleva' else 'envíos llevan' end,
                         coalesce((v_cfg->>'dias_en_camino')::int, 5)),
        'detalle', left(v_txt, 200) || '. Rastrea la guía o confirma con el cliente y márcalo entregado.',
        'ruta', '/almacen/envios?pestana=camino', 'peso', 22);
    end if;
    -- Saldo bajo.
    if puede('envios', 2) or puede('finanzas', 1) then
      select count(*), string_agg(format('%s (%s)', paqueteria, texto_dinero(saldo)), ', ') into k, v_txt from saldos_paqueteria() where bajo;
      if k > 0 then
        h := h || jsonb_build_object('area', 'ventas', 'tono', 'atencion',
          'titulo', format('Saldo bajo en %s', case when k = 1 then 'una paquetería' else format('%s paqueterías', k) end),
          'detalle', v_txt || '. Pide la recarga antes de que se atore una guía.',
          'ruta', '/almacen/envios?saldo=1', 'peso', 18);
      end if;
    end if;
  end if;

  return query select e->>'area', e->>'tono', e->>'titulo', e->>'detalle', e->>'ruta', (e->>'peso')::int
               from jsonb_array_elements(h) e;
end $$;

-- -----------------------------------------------------------------------------
-- 19. En vivo: la lista del almacén y la tarjeta del pedido se recargan solas.
-- -----------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['envios', 'envio_lineas', 'envio_bultos', 'evidencias_envio', 'devoluciones', 'recargas_paqueteria'] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null; when undefined_object then null;
    end;
  end loop;
end $$;

select public.optimizar_politicas();

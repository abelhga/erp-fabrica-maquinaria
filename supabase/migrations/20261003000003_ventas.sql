-- =============================================================================
-- Ventas: clientes, oportunidades, cotizaciones, pedidos, cobranza y comisiones.
--
-- Hoy cada vendedor tiene su hoja con sus clientes (sin ID, repetidos entre
-- vendedores), cotiza pisando la misma pestaña (no queda registro de ninguna
-- cotización) y las comisiones dependen de rangos de filas que alguien mueve a
-- mano cada mes. Aquí todo es un solo registro: la cotización aceptada se
-- vuelve pedido, el pedido alimenta producción y cobranza, y la comisión sale
-- sola de los pedidos del mes.
-- =============================================================================

create type public.etapa_oportunidad as enum ('prospecto', 'contactado', 'cotizado', 'negociacion', 'ganada', 'perdida');
create type public.estado_cotizacion as enum ('borrador', 'por_autorizar', 'autorizada', 'enviada', 'aceptada', 'rechazada', 'vencida', 'cancelada');
create type public.estado_pedido as enum ('confirmado', 'en_produccion', 'listo', 'entregado', 'cancelado');
create type public.canal_venta as enum ('directo', 'mercadolibre', 'sitio_web', 'mostrador', 'distribuidor', 'amazon');
-- Las tres de los paneles de ventas: Maquinaria · Refacciones y/o Herramientas · Otros
create type public.linea_venta as enum ('maquinaria', 'refacciones', 'otros');

insert into public.configuracion (clave, valor, descripcion) values
  ('empresa_fiscal', '{"razon_social":"Máquinas y Herramientas Gamex S.A. de C.V.","rfc":"MHG160202UX1","domicilio":"Carretera Atotonilco–La Barca 151, Crucero Milpillas, 47775, Atotonilco el Alto, Jal.","terminos_url":"https://hegamex.com/terminos-y-condiciones"}',
   'Encabezado de cotizaciones y pedidos.'),
  ('envio_gratis', '{"desde_neto":5000,"excluir_palabras":["banda","cangilon","cangilón","tapco"]}',
   'Regla del BUSCADOR: envío gratis desde $5,000 con IVA, salvo bandas, cangilones y Tapco.'),
  ('meses_tope', '350000', 'Monto máximo a diferir por transacción con tarjeta.');

update public.configuracion set valor = jsonb_set(valor, '{nombre}', '"Hegamex"') where clave = 'empresa';

-- Hasta dónde puede bajar un vendedor sin pedir autorización. En componentes el
-- BUSCADOR fija el piso en neto × 0.7 / 0.77 (≈ 9.09 % de descuento).
alter table public.politicas_precio add column descuento_maximo numeric(6,4) not null default 0.10
  check (descuento_maximo >= 0 and descuento_maximo < 1);
update public.politicas_precio set descuento_maximo = round(1 - 0.7 / 0.77, 4) where compensar_isr = false;

create table public.fuentes_contacto (
  id serial primary key,
  nombre text not null unique,
  activa boolean not null default true
);
insert into public.fuentes_contacto (nombre) values
  ('Visita de ruta'), ('Llamada por parte del cliente'), ('Correo por parte del cliente'), ('Visita por parte del cliente'),
  ('Formulario del sitio web'), ('Formulario de Facebook'), ('Botón de Facebook'), ('Otro formulario'),
  ('Llamada del vendedor no solicitada'), ('Correo del vendedor no solicitado'), ('WhatsApp por parte del cliente'),
  ('Pregunta de Mercado Libre'), ('Ya había comprado'), ('Recomendación'), ('Llamada a recepción'), ('Otro');

create table public.clientes (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,                  -- como lo conocen los vendedores
  razon_social text,
  rfc text check (rfc is null or rfc ~ '^[A-ZÑ&]{3,4}[0-9]{6}[A-Z0-9]{3}$'),
  regimen_fiscal text,
  cp_fiscal text,
  uso_cfdi text,
  giro text,
  ciudad text,
  estado text,
  pais text not null default 'México',
  vendedor_id uuid references public.perfiles(id),   -- dueño de la cuenta
  fuente_id int references public.fuentes_contacto(id),
  es_distribuidor boolean not null default false,
  dias_credito int not null default 0,
  notas text,
  activo boolean not null default true,
  legacy_ref text,
  creado_por uuid default auth.uid() references public.perfiles(id),
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);
create index clientes_busqueda on public.clientes using gin ((sin_acentos(nombre || ' ' || coalesce(razon_social, '') || ' ' || coalesce(rfc, ''))) extensions.gin_trgm_ops);
create index clientes_vendedor on public.clientes (vendedor_id);

-- Teléfonos, correos y domicilio viven aquí y no en clientes: así la base puede
-- ocultarlos a otros vendedores (lo que hoy hace el "Privado" del BUSCADOR).
create table public.contactos (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  nombre text not null,
  puesto text,
  telefono text,
  whatsapp text,
  correo text,
  domicilio text,
  principal boolean not null default false,
  notas text,
  creado_en timestamptz not null default now()
);
create index contactos_cliente on public.contactos (cliente_id);

create table public.oportunidades (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  contacto_id uuid references public.contactos(id) on delete set null,
  titulo text not null,
  etapa public.etapa_oportunidad not null default 'prospecto',
  linea public.linea_venta not null default 'maquinaria',
  canal public.canal_venta not null default 'directo',
  monto_estimado numeric(14,2),
  probabilidad int check (probabilidad between 0 and 100),
  fecha_cierre_estimada date,
  vendedor_id uuid references public.perfiles(id) default auth.uid(),
  fuente_id int references public.fuentes_contacto(id),
  motivo_perdida text,
  cerrada_en timestamptz,
  notas text,
  orden int not null default 0,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);
create index oportunidades_vendedor on public.oportunidades (vendedor_id, etapa);

-- Bitácora comercial: llamadas, WhatsApp, visitas y tareas con fecha.
create table public.actividades (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid references public.clientes(id) on delete cascade,
  oportunidad_id uuid references public.oportunidades(id) on delete cascade,
  tipo text not null check (tipo in ('llamada', 'whatsapp', 'correo', 'visita', 'nota', 'tarea')),
  descripcion text not null,
  vence_en date,
  hecha boolean not null default false,
  usuario_id uuid default auth.uid() references public.perfiles(id),
  en timestamptz not null default now()
);
create index actividades_pendientes on public.actividades (usuario_id, vence_en) where not hecha;

-- Catálogos de la pestaña PoliticaDePago, editables por la gerencia.
create table public.textos_comerciales (
  id serial primary key,
  tipo text not null check (tipo in ('pago', 'entrega', 'vigencia', 'nota')),
  texto text not null,
  por_defecto boolean not null default false,
  orden int not null default 0,
  activo boolean not null default true
);
insert into public.textos_comerciales (tipo, texto, por_defecto, orden) values
  ('pago', 'En una sola exhibición.', false, 1),
  ('pago', '50% anticipo, 50% al aviso de la entrega.', true, 2),
  ('pago', '60% anticipo, 40% al aviso de la entrega.', false, 3),
  ('pago', '30% anticipo, 70% al aviso de la entrega.', false, 4),
  ('entrega', 'Entrega inmediata (salvo previa venta).', false, 1),
  ('entrega', '5 días hábiles tiempo estimado de entrega.', false, 2),
  ('entrega', '15 días hábiles tiempo estimado de entrega.', false, 3),
  ('entrega', '30 días hábiles tiempo estimado de entrega.', true, 4),
  ('entrega', '45 días hábiles tiempo estimado de entrega.', false, 5),
  ('entrega', '60 días hábiles tiempo estimado de entrega.', false, 6),
  ('nota', 'Garantía de fabricación por escrito.', true, 1),
  ('nota', 'No incluye envío (se cotiza según destino).', true, 2),
  ('nota', 'No incluye instalación, calibración ni soporte en destino.', true, 3),
  ('nota', 'No incluye adecuaciones del terreno ni obra civil.', false, 4),
  ('nota', 'Si se exporta no aplica IVA y se paga el subtotal (obligatorio pedimento de exportación).', false, 5),
  ('nota', 'Se aceptan tarjetas de débito y crédito.', false, 6),
  ('nota', 'La mercancía viaja por cuenta y riesgo del comprador.', false, 7),
  ('nota', 'Equipos eléctricos a 220 V, tres fases, salvo indicación.', false, 8),
  ('nota', 'Penalización del 20% si se cancela después del anticipo.', true, 9);

-- Meses con tarjeta (DiferirAMeses). tasa = comisión con IVA que paga el cliente.
-- Una sola fórmula para todos: mensualidad = total / (1 − tasa) / meses.
create table public.planes_meses (
  meses int primary key,
  etiqueta text not null,
  tasa numeric(6,4) not null default 0,
  activo boolean not null default true
);
insert into public.planes_meses (meses, etiqueta, tasa) values
  (3, '3 pagos sin intereses de', 0), (6, '6 pagos mensuales de', 0.0892), (9, '9 pagos mensuales de', 0.1298),
  (12, '12 pagos mensuales de', 0.1495), (18, '18 pagos mensuales de', 0.2249), (24, '24 pagos mensuales de', 0.3166);

-- ----------------------------------------------------------------------------
-- Cotizaciones
-- ----------------------------------------------------------------------------
create table public.cotizaciones (
  id uuid primary key default gen_random_uuid(),
  folio text not null unique,
  version int not null default 1,
  origen_id uuid references public.cotizaciones(id),   -- de qué cotización es versión
  cliente_id uuid references public.clientes(id),
  contacto_id uuid references public.contactos(id) on delete set null,
  atencion text,                                       -- "En atención a"
  empresa text,
  oportunidad_id uuid references public.oportunidades(id) on delete set null,
  vendedor_id uuid not null default auth.uid() references public.perfiles(id),
  fecha date not null default (now() at time zone 'America/Mexico_City')::date,
  vigencia_dias int not null default 15 check (vigencia_dias > 0),
  moneda public.moneda not null default 'MXN',
  tipo_cambio numeric(12,4) not null default 1,
  tasa_iva numeric(5,4) not null default 0.16,
  precios_con_iva boolean not null default false,      -- plantilla "PM IVA inc"
  descuento_pct numeric(6,4) not null default 0 check (descuento_pct >= 0 and descuento_pct < 1),
  leyenda_promocion text,
  condiciones_pago text,
  tiempo_entrega text,
  notas text[] not null default '{}',
  plan_meses int references public.planes_meses(meses),
  logo_comarca_url text,                               -- plantilla co-marca ("Powered by")
  estado public.estado_cotizacion not null default 'borrador',
  requiere_autorizacion boolean not null default false,
  autorizada_por uuid references public.perfiles(id),
  motivo_rechazo text,
  enviada_en timestamptz,
  cerrada_en timestamptz,
  subtotal numeric(14,2) not null default 0,
  descuento numeric(14,2) not null default 0,
  iva numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);
create index cotizaciones_vendedor on public.cotizaciones (vendedor_id, fecha desc);
create index cotizaciones_cliente on public.cotizaciones (cliente_id, fecha desc);

create table public.cotizacion_lineas (
  id uuid primary key default gen_random_uuid(),
  cotizacion_id uuid not null references public.cotizaciones(id) on delete cascade,
  orden int not null default 0,
  articulo_id uuid references public.articulos(id),    -- null = partida libre (flete, servicio…)
  titulo text not null,
  descripcion text,
  imagen_url text,
  unidad text not null default 'pieza',
  cantidad numeric(14,3) not null default 1 check (cantidad > 0),
  precio_unitario numeric(14,2) not null check (precio_unitario >= 0),   -- en la moneda de la cotización
  precio_lista numeric(14,2),                          -- foto del precio de lista al cotizar (MXN)
  descuento_pct numeric(6,4) not null default 0 check (descuento_pct >= 0 and descuento_pct < 1),
  opcional boolean not null default false,             -- alternativa: se muestra pero no suma
  bajo_minimo boolean not null default false,
  importe numeric(14,2) generated always as (
    case when opcional then 0 else round(cantidad * precio_unitario * (1 - descuento_pct), 2) end) stored
);
create index cotizacion_lineas_cot on public.cotizacion_lineas (cotizacion_id, orden);

-- ----------------------------------------------------------------------------
-- Pedidos, facturas y cobros
-- ----------------------------------------------------------------------------
create table public.pedidos (
  id uuid primary key default gen_random_uuid(),
  folio text not null unique,
  cotizacion_id uuid references public.cotizaciones(id),
  cliente_id uuid not null references public.clientes(id),
  vendedor_id uuid references public.perfiles(id),
  canal public.canal_venta not null default 'directo',
  id_externo text,                                     -- número de venta en Mercado Libre / tienda web
  fecha date not null default (now() at time zone 'America/Mexico_City')::date,
  fecha_compromiso date,
  estado public.estado_pedido not null default 'confirmado',
  moneda public.moneda not null default 'MXN',
  tipo_cambio numeric(12,4) not null default 1,
  tasa_iva numeric(5,4) not null default 0.16,
  subtotal numeric(14,2) not null default 0,
  iva numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0,
  condiciones_pago text,
  direccion_entrega text,
  notas text,
  motivo_cancelacion text,
  entregado_en timestamptz,
  creado_por uuid default auth.uid() references public.perfiles(id),
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  unique (canal, id_externo)
);
create index pedidos_fecha on public.pedidos (fecha desc);
create index pedidos_cliente on public.pedidos (cliente_id);

create table public.pedido_lineas (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references public.pedidos(id) on delete cascade,
  orden int not null default 0,
  articulo_id uuid references public.articulos(id),
  titulo text not null,
  descripcion text,
  unidad text not null default 'pieza',
  cantidad numeric(14,3) not null check (cantidad > 0),
  precio_unitario numeric(14,2) not null,
  descuento_pct numeric(6,4) not null default 0,
  importe numeric(14,2) generated always as (round(cantidad * precio_unitario * (1 - descuento_pct), 2)) stored,
  linea public.linea_venta not null default 'maquinaria',
  cantidad_entregada numeric(14,3) not null default 0
);
create index pedido_lineas_pedido on public.pedido_lineas (pedido_id);

-- Crédito compartido ("* Pinto, Isaac, Susy"): cada vendedor con su porcentaje.
create table public.pedido_vendedores (
  pedido_id uuid not null references public.pedidos(id) on delete cascade,
  vendedor_id uuid not null references public.perfiles(id),
  porcentaje numeric(5,2) not null check (porcentaje > 0 and porcentaje <= 100),
  primary key (pedido_id, vendedor_id)
);

create table public.facturas (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references public.pedidos(id) on delete cascade,
  folio text not null,
  uuid_sat text unique,
  fecha date not null default current_date,
  total numeric(14,2) not null,
  notas text,
  creado_en timestamptz not null default now()
);

create table public.cobros (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references public.pedidos(id) on delete cascade,
  fecha date not null default current_date,
  monto numeric(14,2) not null check (monto <> 0),
  metodo text not null default 'transferencia' check (metodo in ('transferencia', 'efectivo', 'tarjeta', 'cheque', 'mercadopago', 'otro')),
  referencia text,
  notas text,
  registrado_por uuid default auth.uid() references public.perfiles(id),
  creado_en timestamptz not null default now()
);
create index cobros_pedido on public.cobros (pedido_id);

-- ----------------------------------------------------------------------------
-- Canales en línea: Mercado Libre, sitio web, Amazon
-- ----------------------------------------------------------------------------
-- Fórmulas del BUSCADOR (col. M–V): precio = base / (1 − comisión); si queda
-- debajo del umbral se suma la cuota fija; más envío si se publica con envío.
create table public.canales (
  canal public.canal_venta primary key,
  comision_pct numeric(6,4) not null default 0,
  cuota_fija numeric(10,2) not null default 0,
  umbral_cuota_fija numeric(10,2) not null default 0,  -- precio con IVA debajo del cual se cobra la cuota
  costo_envio numeric(10,2) not null default 0,
  notas text
);
insert into public.canales (canal, comision_pct, cuota_fija, umbral_cuota_fija, costo_envio, notas) values
  ('directo', 0, 0, 0, 0, 'Venta de vendedor: precio de lista.'),
  ('mostrador', 0, 0, 0, 0, null),
  ('distribuidor', 0, 0, 0, 0, null),
  ('mercadolibre', 0.12, 37, 299, 110, 'Publicación clásica 12 % (premium 16.5 %). Cuota fija abajo de $299.'),
  ('sitio_web', 0.0349, 0, 0, 110, 'Comisión de pasarela de pago.'),
  ('amazon', 0.10, 15, 0, 110, null);

create table public.publicaciones (
  id uuid primary key default gen_random_uuid(),
  articulo_id uuid not null references public.articulos(id) on delete cascade,
  canal public.canal_venta not null check (canal in ('mercadolibre', 'sitio_web', 'amazon')),
  id_externo text,
  titulo text,
  url text,
  precio numeric(14,2),                 -- precio publicado con IVA
  con_envio boolean not null default false,
  piezas_por_paquete int not null default 1,
  stock_publicado numeric(14,3),
  estado text not null default 'activa' check (estado in ('activa', 'pausada', 'cerrada')),
  actualizado_en timestamptz not null default now(),
  unique (canal, id_externo)
);

-- Precio sugerido con IVA para publicar en un canal, a partir del de lista.
create or replace function public.precio_canal(p_articulo uuid, p_canal public.canal_venta, p_con_envio boolean default false, p_piezas int default 1)
returns numeric language sql stable as $$
  select round(case when bruto * 1.16 < c.umbral_cuota_fija then (bruto + c.cuota_fija) * 1.16 else bruto * 1.16 end, 2)
  from canales c
  cross join lateral (
    select (pl.precio * p_piezas) / (1 - c.comision_pct) + case when p_con_envio then c.costo_envio else 0 end as bruto
    from precios_lista pl where pl.articulo_id = p_articulo
  ) x
  where c.canal = p_canal
$$;

-- ----------------------------------------------------------------------------
-- Comisiones (regla de los paneles de ventas, sin filas que mover a mano)
-- ----------------------------------------------------------------------------
create table public.planes_comision (
  id serial primary key,
  nombre text not null unique,
  pct_maquinaria numeric(6,4) not null default 0.02,
  -- Hoy "Otros" (fletes, servicios) cobra como maquinaria porque la hoja solo excluye refacciones.
  otros_como_maquinaria boolean not null default true,
  -- Cuándo se gana: al registrar el pedido (como hoy), al facturar o al cobrar (proporcional).
  base text not null default 'pedido' check (base in ('pedido', 'factura', 'cobro')),
  activo boolean not null default true
);

create table public.plan_escalones (
  plan_id int not null references public.planes_comision(id) on delete cascade,
  tipo text not null check (tipo in ('meta_maquinaria', 'bono_refacciones')),
  desde numeric(14,2) not null,
  bono numeric(12,2) not null,
  primary key (plan_id, tipo, desde)
);

create table public.vendedor_plan (
  vendedor_id uuid primary key references public.perfiles(id) on delete cascade,
  plan_id int not null references public.planes_comision(id)
);

-- Bonos que no salen de una fórmula (los de Mercado Libre de Susy, ajustes).
create table public.comision_ajustes (
  id uuid primary key default gen_random_uuid(),
  vendedor_id uuid not null references public.perfiles(id),
  mes date not null check (extract(day from mes) = 1),
  concepto text not null,
  monto numeric(12,2) not null,
  autorizado_por uuid default auth.uid() references public.perfiles(id),
  creado_en timestamptz not null default now()
);

create table public.comision_pagos (
  vendedor_id uuid not null references public.perfiles(id),
  mes date not null check (extract(day from mes) = 1),
  total numeric(12,2) not null,
  detalle jsonb not null,
  pagado_en date,
  referencia text,
  registrado_por uuid default auth.uid() references public.perfiles(id),
  primary key (vendedor_id, mes)
);

do $$
declare v_gen int; v_susy int;
begin
  insert into public.planes_comision (nombre) values ('General (Isaac, Juan Manuel)') returning id into v_gen;
  insert into public.planes_comision (nombre) values ('Susana') returning id into v_susy;
  insert into public.plan_escalones (plan_id, tipo, desde, bono)
  select p, 'meta_maquinaria', d, b from unnest(array[v_gen, v_susy]) p,
    (values (500000, 2500), (1000000, 5000), (2000000, 10000), (5000000, 25000), (10000000, 50000)) m(d, b);
  insert into public.plan_escalones (plan_id, tipo, desde, bono) values
    (v_gen, 'bono_refacciones', 40000, 1600), (v_gen, 'bono_refacciones', 80000, 3200),
    (v_gen, 'bono_refacciones', 160000, 6400), (v_gen, 'bono_refacciones', 320000, 12800),
    (v_susy, 'bono_refacciones', 70000, 2800), (v_susy, 'bono_refacciones', 140000, 5600),
    (v_susy, 'bono_refacciones', 190000, 7600), (v_susy, 'bono_refacciones', 250000, 10000),
    (v_susy, 'bono_refacciones', 340000, 13600);
end $$;

-- Venta de cada vendedor en un mes, ya repartida por crédito compartido.
create or replace function public.ventas_vendedor_mes(p_mes date)
returns table (vendedor_id uuid, maquinaria numeric, refacciones numeric, otros numeric)
language sql stable security definer set search_path = public as $$
  with plan as (select vp.vendedor_id, pc.base from vendedor_plan vp join planes_comision pc on pc.id = vp.plan_id),
  reparto as (
    select p.id pedido_id, coalesce(pv.vendedor_id, p.vendedor_id) vendedor_id, coalesce(pv.porcentaje, 100) / 100.0 parte
    from pedidos p left join pedido_vendedores pv on pv.pedido_id = p.id
    where p.estado <> 'cancelado'
  ),
  -- Fracción del pedido que "cuenta" en el mes según la base del plan.
  fraccion as (
    select r.pedido_id, r.vendedor_id, r.parte *
      case coalesce(pl.base, 'pedido')
        when 'pedido' then case when date_trunc('month', p.fecha) = p_mes then 1 else 0 end
        when 'factura' then case when (select min(f.fecha) from facturas f where f.pedido_id = p.id) >= p_mes
                                  and (select min(f.fecha) from facturas f where f.pedido_id = p.id) < p_mes + interval '1 month' then 1 else 0 end
        when 'cobro' then coalesce((select sum(c.monto) from cobros c where c.pedido_id = p.id
                                     and c.fecha >= p_mes and c.fecha < p_mes + interval '1 month'), 0) / nullif(p.total, 0)
      end as f
    from reparto r join pedidos p on p.id = r.pedido_id left join plan pl on pl.vendedor_id = r.vendedor_id
  )
  select fr.vendedor_id,
    sum(case when l.linea = 'maquinaria' then l.importe * p.tipo_cambio * fr.f else 0 end),
    sum(case when l.linea = 'refacciones' then l.importe * p.tipo_cambio * fr.f else 0 end),
    sum(case when l.linea = 'otros' then l.importe * p.tipo_cambio * fr.f else 0 end)
  from fraccion fr join pedidos p on p.id = fr.pedido_id join pedido_lineas l on l.pedido_id = p.id
  where fr.f <> 0
  group by fr.vendedor_id
$$;

create or replace function public.comisiones_mes(p_mes date)
returns table (vendedor_id uuid, vendedor text, plan text, venta_maquinaria numeric, venta_refacciones numeric, venta_otros numeric,
               comision numeric, bono_meta numeric, bono_refacciones numeric, ajustes numeric, total numeric,
               siguiente_meta numeric, pagado_en date)
language sql stable security definer set search_path = public as $$
  select pf.id, pf.nombre, pc.nombre,
    round(coalesce(v.maquinaria, 0), 2), round(coalesce(v.refacciones, 0), 2), round(coalesce(v.otros, 0), 2),
    round((coalesce(v.maquinaria, 0) + case when pc.otros_como_maquinaria then coalesce(v.otros, 0) else 0 end) * pc.pct_maquinaria, 2),
    coalesce((select bono from plan_escalones e where e.plan_id = pc.id and e.tipo = 'meta_maquinaria'
              and e.desde <= coalesce(v.maquinaria, 0) + case when pc.otros_como_maquinaria then coalesce(v.otros, 0) else 0 end
              order by e.desde desc limit 1), 0),
    coalesce((select bono from plan_escalones e where e.plan_id = pc.id and e.tipo = 'bono_refacciones'
              and e.desde <= coalesce(v.refacciones, 0) order by e.desde desc limit 1), 0),
    coalesce((select sum(monto) from comision_ajustes a where a.vendedor_id = pf.id and a.mes = p_mes), 0),
    0, -- se completa abajo
    (select min(desde) from plan_escalones e where e.plan_id = pc.id and e.tipo = 'meta_maquinaria'
       and e.desde > coalesce(v.maquinaria, 0) + case when pc.otros_como_maquinaria then coalesce(v.otros, 0) else 0 end),
    (select pagado_en from comision_pagos cp where cp.vendedor_id = pf.id and cp.mes = p_mes)
  from vendedor_plan vp
  join perfiles pf on pf.id = vp.vendedor_id
  join planes_comision pc on pc.id = vp.plan_id
  left join ventas_vendedor_mes(p_mes) v on v.vendedor_id = pf.id
  -- Cada vendedor ve solo lo suyo; la gerencia, dirección y finanzas ven a todos.
  where pf.id = auth.uid() or puede('ventas', 3) or puede('finanzas', 1)
$$;

-- ----------------------------------------------------------------------------
-- Reglas automáticas
-- ----------------------------------------------------------------------------

-- Totales de la cotización + bandera de "bajo el mínimo" por partida.
create or replace function public.recalcular_cotizacion(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare c cotizaciones; v_sub numeric; v_desc numeric; v_bajo boolean;
begin
  select * into c from cotizaciones where id = p_id;
  if not found then return; end if;

  -- Partida bajo mínimo: precio efectivo (MXN, sin IVA) < lista × (1 − descuento máximo de su política).
  update cotizacion_lineas l set bajo_minimo = (
      l.articulo_id is not null and l.precio_lista is not null and not l.opcional and
      (l.precio_unitario * (1 - l.descuento_pct) * (1 - c.descuento_pct) * c.tipo_cambio
         / case when c.precios_con_iva then 1 + c.tasa_iva else 1 end)
      < l.precio_lista * (1 - coalesce((select pp.descuento_maximo from politicas_precio pp where pp.id = politica_de(l.articulo_id)), 0.10)) - 0.005)
  where l.cotizacion_id = p_id;

  select coalesce(sum(importe), 0), bool_or(bajo_minimo) into v_sub, v_bajo from cotizacion_lineas where cotizacion_id = p_id;
  v_desc := round(v_sub * c.descuento_pct, 2);
  update cotizaciones set
    subtotal = case when c.precios_con_iva then round((v_sub - v_desc) / (1 + c.tasa_iva), 2) + v_desc else v_sub end,
    descuento = v_desc,
    iva = case when c.precios_con_iva then v_sub - v_desc - round((v_sub - v_desc) / (1 + c.tasa_iva), 2)
               else round((v_sub - v_desc) * c.tasa_iva, 2) end,
    total = case when c.precios_con_iva then v_sub - v_desc else round((v_sub - v_desc) * (1 + c.tasa_iva), 2) end,
    requiere_autorizacion = coalesce(v_bajo, false),
    -- Si se edita algo después de autorizada, la autorización ya no vale.
    estado = case when coalesce(v_bajo, false) and c.estado in ('borrador', 'autorizada') and c.autorizada_por is null then 'por_autorizar'
                  when not coalesce(v_bajo, false) and c.estado = 'por_autorizar' then 'borrador'
                  else c.estado end
  where id = p_id;
end $$;

create or replace function public.trg_lineas_cotizacion() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform recalcular_cotizacion(coalesce(new.cotizacion_id, old.cotizacion_id));
  return null;
end $$;
-- Solo columnas que mueven dinero: recalcular_cotizacion() actualiza bajo_minimo
-- en estas mismas filas y, sin la lista, se dispararía a sí mismo sin fin.
create trigger recalcular after insert or delete or update of cantidad, precio_unitario, descuento_pct, opcional, articulo_id, precio_lista
  on public.cotizacion_lineas for each row execute function public.trg_lineas_cotizacion();

create or replace function public.trg_cotizacion() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' and (new.folio is null or new.folio = '') then
    new.folio := siguiente_folio('COT');
  end if;
  -- Cambiar precios o descuento invalida la autorización anterior.
  if tg_op = 'UPDATE' and (new.descuento_pct, new.tipo_cambio, new.precios_con_iva) is distinct from (old.descuento_pct, old.tipo_cambio, old.precios_con_iva) then
    new.autorizada_por := null;
  end if;
  if tg_op = 'UPDATE' and new.estado = 'enviada' and old.estado <> 'enviada' then
    if new.requiere_autorizacion and new.autorizada_por is null then
      raise exception 'Esta cotización tiene precios abajo del mínimo: necesita autorización de la gerencia antes de enviarse'
        using errcode = '42501';
    end if;
    new.enviada_en := coalesce(new.enviada_en, now());
  end if;
  if tg_op = 'UPDATE' and new.estado in ('aceptada', 'rechazada', 'cancelada') and old.estado <> new.estado then
    new.cerrada_en := now();
  end if;
  return new;
end $$;
create trigger antes before insert or update on public.cotizaciones for each row execute function public.trg_cotizacion();
create trigger recalcular_encabezado after update of descuento_pct, tipo_cambio, precios_con_iva, tasa_iva on public.cotizaciones
  for each row execute function public.trg_lineas_cotizacion();

-- La cotización necesita folio antes del insert; el default no puede llamar a la función con efectos.
alter table public.cotizaciones alter column folio set default '';

create or replace function public.autorizar_cotizacion(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not puede('ventas', 3) then raise exception 'Solo la gerencia de ventas autoriza precios bajo el mínimo' using errcode = '42501'; end if;
  update cotizaciones set autorizada_por = auth.uid(), estado = 'autorizada' where id = p_id and estado = 'por_autorizar';
end $$;

-- Nueva versión: copia la cotización (con un sufijo -v2, -v3…) y deja la anterior intacta.
create or replace function public.nueva_version_cotizacion(p_id uuid) returns uuid
language plpgsql security invoker as $$
declare v_nueva uuid; v_raiz uuid; v_ver int; v_folio text;
begin
  select coalesce(origen_id, id) into v_raiz from cotizaciones where id = p_id;
  select max(version) + 1 into v_ver from cotizaciones where id = v_raiz or origen_id = v_raiz;
  select regexp_replace(folio, '-v[0-9]+$', '') || '-v' || v_ver into v_folio from cotizaciones where id = v_raiz;
  insert into cotizaciones (folio, version, origen_id, cliente_id, contacto_id, atencion, empresa, oportunidad_id, vendedor_id,
    vigencia_dias, moneda, tipo_cambio, tasa_iva, precios_con_iva, descuento_pct, leyenda_promocion, condiciones_pago,
    tiempo_entrega, notas, plan_meses, logo_comarca_url)
  select v_folio, v_ver, v_raiz, cliente_id, contacto_id, atencion, empresa, oportunidad_id, auth.uid(),
    vigencia_dias, moneda, tipo_cambio, tasa_iva, precios_con_iva, descuento_pct, leyenda_promocion, condiciones_pago,
    tiempo_entrega, notas, plan_meses, logo_comarca_url
  from cotizaciones where id = p_id returning id into v_nueva;
  insert into cotizacion_lineas (cotizacion_id, orden, articulo_id, titulo, descripcion, imagen_url, unidad, cantidad,
    precio_unitario, precio_lista, descuento_pct, opcional)
  select v_nueva, orden, articulo_id, titulo, descripcion, imagen_url, unidad, cantidad, precio_unitario,
    (select precio from precios_lista where articulo_id = l.articulo_id), descuento_pct, opcional
  from cotizacion_lineas l where cotizacion_id = p_id;
  return v_nueva;
end $$;

-- Línea de comisión según el tipo de artículo.
create or replace function public.linea_de(p_articulo uuid) returns public.linea_venta
language sql stable as $$
  select case when p_articulo is null then 'otros'::linea_venta
    else (select case tipo when 'equipo' then 'maquinaria' when 'subensamble' then 'maquinaria'
                           when 'servicio' then 'otros' else 'refacciones' end::linea_venta
          from articulos where id = p_articulo) end
$$;

create or replace function public.totales_pedido(p_id uuid) returns void
language sql security definer set search_path = public as $$
  update pedidos p set subtotal = t.sub, iva = round(t.sub * p.tasa_iva, 2), total = t.sub + round(t.sub * p.tasa_iva, 2)
  from (select coalesce(sum(importe), 0) sub from pedido_lineas where pedido_id = p_id) t
  where p.id = p_id
$$;

create or replace function public.trg_lineas_pedido() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform totales_pedido(coalesce(new.pedido_id, old.pedido_id));
  return null;
end $$;
create trigger totales after insert or update or delete on public.pedido_lineas for each row execute function public.trg_lineas_pedido();

create or replace function public.trg_pedido() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' and coalesce(new.folio, '') = '' then new.folio := siguiente_folio('PED'); end if;
  if tg_op = 'UPDATE' and new.estado = 'entregado' and old.estado <> 'entregado' then new.entregado_en := now(); end if;
  return new;
end $$;
alter table public.pedidos alter column folio set default '';
create trigger antes before insert or update on public.pedidos for each row execute function public.trg_pedido();

-- Cotización aceptada → pedido, en un paso y sin recapturar nada.
create or replace function public.convertir_a_pedido(p_cotizacion uuid, p_fecha_compromiso date default null, p_partidas uuid[] default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare c cotizaciones; v_pedido uuid;
begin
  select * into c from cotizaciones where id = p_cotizacion;
  if c.id is null then raise exception 'No existe la cotización'; end if;
  if not (c.vendedor_id = auth.uid() or puede('ventas', 3)) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  if c.cliente_id is null then raise exception 'Liga la cotización a un cliente antes de convertirla en pedido'; end if;
  if c.requiere_autorizacion and c.autorizada_por is null then
    raise exception 'La cotización tiene precios abajo del mínimo sin autorizar' using errcode = '42501';
  end if;
  if exists (select 1 from pedidos where cotizacion_id = p_cotizacion and estado <> 'cancelado') then
    raise exception 'Esta cotización ya tiene pedido';
  end if;

  insert into pedidos (cotizacion_id, cliente_id, vendedor_id, fecha_compromiso, moneda, tipo_cambio, tasa_iva, condiciones_pago, notas)
  values (c.id, c.cliente_id, c.vendedor_id, p_fecha_compromiso, c.moneda, c.tipo_cambio, c.tasa_iva, c.condiciones_pago,
          'Desde cotización ' || c.folio)
  returning id into v_pedido;

  -- El descuento general se reparte en cada partida; con IVA incluido se pasa a precio sin IVA.
  insert into pedido_lineas (pedido_id, orden, articulo_id, titulo, descripcion, unidad, cantidad, precio_unitario, descuento_pct, linea)
  select v_pedido, l.orden, l.articulo_id, l.titulo, l.descripcion, l.unidad, l.cantidad,
         round(l.precio_unitario / case when c.precios_con_iva then 1 + c.tasa_iva else 1 end, 2),
         1 - (1 - l.descuento_pct) * (1 - c.descuento_pct), linea_de(l.articulo_id)
  from cotizacion_lineas l
  where l.cotizacion_id = c.id and (case when p_partidas is null then not l.opcional else l.id = any(p_partidas) end);

  update cotizaciones set estado = 'aceptada' where id = c.id;
  update oportunidades set etapa = 'ganada', cerrada_en = now() where id = c.oportunidad_id;
  return v_pedido;
end $$;

-- Saldos por pedido: lo que usan cobranza y el tablero.
create or replace view public.v_saldos_pedido with (security_invoker = true) as
select p.id pedido_id, p.folio, p.cliente_id, p.vendedor_id, p.fecha, p.estado, p.moneda, p.total,
  coalesce((select sum(monto) from public.cobros c where c.pedido_id = p.id), 0) as cobrado,
  p.total - coalesce((select sum(monto) from public.cobros c where c.pedido_id = p.id), 0) as saldo,
  exists (select 1 from public.facturas f where f.pedido_id = p.id) as facturado
from public.pedidos p where p.estado <> 'cancelado';

-- ----------------------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------------------
alter table public.fuentes_contacto enable row level security;
alter table public.clientes enable row level security;
alter table public.contactos enable row level security;
alter table public.oportunidades enable row level security;
alter table public.actividades enable row level security;
alter table public.textos_comerciales enable row level security;
alter table public.planes_meses enable row level security;
alter table public.cotizaciones enable row level security;
alter table public.cotizacion_lineas enable row level security;
alter table public.pedidos enable row level security;
alter table public.pedido_lineas enable row level security;
alter table public.pedido_vendedores enable row level security;
alter table public.facturas enable row level security;
alter table public.cobros enable row level security;
alter table public.canales enable row level security;
alter table public.publicaciones enable row level security;
alter table public.planes_comision enable row level security;
alter table public.plan_escalones enable row level security;
alter table public.vendedor_plan enable row level security;
alter table public.comision_ajustes enable row level security;
alter table public.comision_pagos enable row level security;

-- ¿Es mía esta cuenta? (dueño, sin dueño, o soy gerente/dirección)
create or replace function public.cliente_visible(p_cliente uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select puede('ventas', 3) or exists (select 1 from clientes c where c.id = p_cliente and (c.vendedor_id is null or c.vendedor_id = auth.uid()))
$$;

create policy ver on public.fuentes_contacto for select to authenticated using (cardinality(mis_roles()) > 0);
create policy editar on public.fuentes_contacto for all to authenticated using (puede('ventas', 3)) with check (puede('ventas', 3));

-- Clientes: todos los de ventas ven el nombre y quién es el dueño (para no pisarse);
-- producción y finanzas también, para saber de quién es cada pedido.
create policy ver on public.clientes for select to authenticated using (puede('ventas', 1) or puede('finanzas', 1) or puede('produccion', 1));
create policy alta on public.clientes for insert to authenticated with check (puede('ventas', 2));
create policy cambio on public.clientes for update to authenticated using (cliente_visible(id) and puede('ventas', 2));
create policy baja on public.clientes for delete to authenticated using (puede('ventas', 3));

-- Contactos: solo el dueño de la cuenta, la gerencia y finanzas (cobranza).
create policy ver on public.contactos for select to authenticated using (cliente_visible(cliente_id) or puede('finanzas', 1));
create policy editar on public.contactos for all to authenticated using (cliente_visible(cliente_id) and puede('ventas', 2))
  with check (cliente_visible(cliente_id) and puede('ventas', 2));

create policy ver on public.oportunidades for select to authenticated using (vendedor_id = auth.uid() or puede('ventas', 3));
create policy editar on public.oportunidades for all to authenticated using ((vendedor_id = auth.uid() and puede('ventas', 2)) or puede('ventas', 3))
  with check ((vendedor_id = auth.uid() and puede('ventas', 2)) or puede('ventas', 3));

create policy ver on public.actividades for select to authenticated using (usuario_id = auth.uid() or puede('ventas', 3)
  or (cliente_id is not null and cliente_visible(cliente_id)));
create policy editar on public.actividades for all to authenticated using (usuario_id = auth.uid() or puede('ventas', 3))
  with check (usuario_id = auth.uid() or puede('ventas', 3));

create policy ver on public.textos_comerciales for select to authenticated using (puede('ventas', 1));
create policy editar on public.textos_comerciales for all to authenticated using (puede('ventas', 3)) with check (puede('ventas', 3));
create policy ver on public.planes_meses for select to authenticated using (puede('ventas', 1));
create policy editar on public.planes_meses for all to authenticated using (puede('ventas', 3)) with check (puede('ventas', 3));

create policy ver on public.cotizaciones for select to authenticated using (vendedor_id = auth.uid() or puede('ventas', 3));
create policy alta on public.cotizaciones for insert to authenticated with check (puede('ventas', 2) and (vendedor_id = auth.uid() or puede('ventas', 3)));
-- La autorización solo la pone autorizar_cotizacion(); por aquí no se puede.
create policy cambio on public.cotizaciones for update to authenticated
  using ((vendedor_id = auth.uid() and puede('ventas', 2)) or puede('ventas', 3))
  with check ((vendedor_id = auth.uid() and puede('ventas', 2)) or puede('ventas', 3));
create policy baja on public.cotizaciones for delete to authenticated using (estado = 'borrador' and (vendedor_id = auth.uid() or puede('ventas', 3)));

create or replace function public.cotizacion_editable(p_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from cotizaciones c where c.id = p_id
    and c.estado in ('borrador', 'por_autorizar', 'autorizada')
    and ((c.vendedor_id = auth.uid() and puede('ventas', 2)) or puede('ventas', 3)))
$$;
create or replace function public.cotizacion_visible(p_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from cotizaciones c where c.id = p_id and (c.vendedor_id = auth.uid() or puede('ventas', 3)))
$$;
create policy ver on public.cotizacion_lineas for select to authenticated using (cotizacion_visible(cotizacion_id));
create policy editar on public.cotizacion_lineas for all to authenticated using (cotizacion_editable(cotizacion_id))
  with check (cotizacion_editable(cotizacion_id));

-- Pedidos: el vendedor ve los suyos (o donde comparte crédito); producción,
-- almacén y finanzas los ven todos porque de ahí sale su trabajo.
-- Ojo: "produccion" nivel 1 lo tienen también los vendedores (para ver el avance
-- de sus equipos), así que aquí se exige nivel 2: si no, cualquier vendedor veía
-- los pedidos de todos (lo atrapó 20_ventas.sql).
create or replace function public.pedido_visible(p_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select puede('ventas', 3) or puede('produccion', 2) or puede('finanzas', 1) or puede('inventario', 2)
    or exists (select 1 from pedidos p where p.id = p_id and p.vendedor_id = auth.uid())
    or exists (select 1 from pedido_vendedores v where v.pedido_id = p_id and v.vendedor_id = auth.uid())
$$;
create policy ver on public.pedidos for select to authenticated using (pedido_visible(id));
create policy alta on public.pedidos for insert to authenticated with check (puede('ventas', 2));
create policy cambio on public.pedidos for update to authenticated using ((vendedor_id = auth.uid() and puede('ventas', 2)) or puede('ventas', 3) or puede('produccion', 2) or puede('finanzas', 2));
create policy ver on public.pedido_lineas for select to authenticated using (pedido_visible(pedido_id));
create policy editar on public.pedido_lineas for all to authenticated using (puede('ventas', 3) or exists (
  select 1 from pedidos p where p.id = pedido_id and p.vendedor_id = auth.uid() and p.estado = 'confirmado'))
  with check (puede('ventas', 3) or exists (select 1 from pedidos p where p.id = pedido_id and p.vendedor_id = auth.uid() and p.estado = 'confirmado'));
create policy ver on public.pedido_vendedores for select to authenticated using (pedido_visible(pedido_id));
create policy editar on public.pedido_vendedores for all to authenticated using (puede('ventas', 3)) with check (puede('ventas', 3));

create policy ver on public.facturas for select to authenticated using (pedido_visible(pedido_id));
create policy editar on public.facturas for all to authenticated using (puede('finanzas', 2)) with check (puede('finanzas', 2));
create policy ver on public.cobros for select to authenticated using (pedido_visible(pedido_id));
create policy editar on public.cobros for all to authenticated using (puede('finanzas', 2)) with check (puede('finanzas', 2));

create policy ver on public.canales for select to authenticated using (puede('ventas', 1));
create policy editar on public.canales for all to authenticated using (puede('ventas', 3)) with check (puede('ventas', 3));
create policy ver on public.publicaciones for select to authenticated using (puede('ventas', 1) or puede('inventario', 1));
create policy editar on public.publicaciones for all to authenticated using (puede('ventas', 2)) with check (puede('ventas', 2));

create policy ver on public.planes_comision for select to authenticated using (puede('ventas', 1));
create policy editar on public.planes_comision for all to authenticated using (tiene_rol('direccion')) with check (tiene_rol('direccion'));
create policy ver on public.plan_escalones for select to authenticated using (puede('ventas', 1));
create policy editar on public.plan_escalones for all to authenticated using (tiene_rol('direccion')) with check (tiene_rol('direccion'));
create policy ver on public.vendedor_plan for select to authenticated using (vendedor_id = auth.uid() or puede('ventas', 3) or puede('finanzas', 1));
create policy editar on public.vendedor_plan for all to authenticated using (tiene_rol('direccion')) with check (tiene_rol('direccion'));
create policy ver on public.comision_ajustes for select to authenticated using (vendedor_id = auth.uid() or puede('ventas', 3) or puede('finanzas', 1));
create policy editar on public.comision_ajustes for all to authenticated using (tiene_rol('direccion') or tiene_rol('gerente_ventas'))
  with check (tiene_rol('direccion') or tiene_rol('gerente_ventas'));
create policy ver on public.comision_pagos for select to authenticated using (vendedor_id = auth.uid() or puede('ventas', 3) or puede('finanzas', 1));
create policy editar on public.comision_pagos for all to authenticated using (puede('finanzas', 2)) with check (puede('finanzas', 2));

create trigger tocar before update on public.clientes for each row execute function public.tocar_actualizado();
create trigger tocar before update on public.oportunidades for each row execute function public.tocar_actualizado();
create trigger tocar before update on public.cotizaciones for each row execute function public.tocar_actualizado();
create trigger tocar before update on public.pedidos for each row execute function public.tocar_actualizado();
create trigger auditar after insert or update or delete on public.clientes for each row execute function public.auditar();
create trigger auditar after insert or update or delete on public.cotizaciones for each row execute function public.auditar();
create trigger auditar after insert or update or delete on public.pedidos for each row execute function public.auditar();
create trigger auditar after insert or update or delete on public.cobros for each row execute function public.auditar();
create trigger auditar after insert or update or delete on public.comision_ajustes for each row execute function public.auditar();
create trigger auditar after insert or update or delete on public.plan_escalones for each row execute function public.auditar();

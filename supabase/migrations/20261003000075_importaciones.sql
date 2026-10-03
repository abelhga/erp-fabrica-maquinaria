-- =============================================================================
-- Importaciones: embarques, documentos, dinero en dólares y costo puesto en planta.
--
-- Hoy cada embarque es una fila de la hoja IMPORTACIONES con 29 casillas que no
-- dicen CUÁNDO se cumplió cada paso, va 1–3 semanas atrasada respecto a los
-- correos, y el costo puesto en planta se calcula aparte en PRORRATEO.xlsx sin
-- liga al catálogo. Almacén se entera de lo que llega solo si alguien le avisa.
-- Lo que este módulo cambia (ver el informe de importaciones, §9):
--  * Un embarque liga una o varias órdenes de compra (un BL trae varias facturas,
--    un consolidado trae varios proveedores) y guarda FECHAS REALES por etapa:
--    de ahí salen los tiempos por proveedor que usa el reabasto.
--  * Los documentos son un checklist por modalidad con quién los debe, y el
--    archivo vive en Storage. Los que traen precios solo los abre quien ve dinero.
--  * Pagos en USD con el tipo de cambio REAL de cada pago (no hay cuenta en
--    dólares: salen de cuentas en pesos o por EBANX). Nunca más de lo que se debe.
--  * Gastos con su criterio de prorrateo (valor o volumen) y el IVA acreditable
--    APARTE: la hoja metía el IVA al prorrateo y luego dividía todo entre 1.16,
--    incluida la mercancía, que no lleva IVA.
--  * El costo de un componente importado lo pone el costeo de importación, no la
--    recepción: recibir_orden_compra ponía el precio en USD sin indirectos, entre
--    27 % y 109 % abajo del costo real, y el precio de lista (costo ÷ 0.70) salía bajo.
--  * Almacén y el taller ven qué viene y cuándo, nunca cuánto costó. Ventas no ve nada.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Permisos. "importaciones" es un módulo nuevo; Alondra además captura en compras
-- (órdenes en USD) y ve costos, existencias y pagos de lo que importa.
-- -----------------------------------------------------------------------------
insert into public.permisos_rol (rol, modulo, nivel) values
  ('importaciones', 'importaciones', 3), ('direccion', 'importaciones', 3), ('compras', 'importaciones', 2),
  ('finanzas', 'importaciones', 1), ('almacen', 'importaciones', 1), ('gerente_produccion', 'importaciones', 1),
  ('importaciones', 'compras', 2), ('importaciones', 'costos', 1), ('importaciones', 'inventario', 1),
  ('importaciones', 'finanzas', 1),
  -- "Leer con Claude" pasa por el asistente: sin esto Alondra no podría usarlo.
  ('importaciones', 'asistente', 1)
on conflict (rol, modulo) do nothing;

-- Dinero de importaciones: quien ya ve el dinero de compras (compras 2, finanzas o
-- costos) y además ve importaciones. Almacén y la gerencia del taller ven el
-- embarque (qué viene y cuándo) pero no los montos.
create or replace function public.ve_dinero_importacion() returns boolean
language sql stable security definer set search_path = public as $$
  select puede('importaciones', 1) and (puede('compras', 2) or puede('finanzas', 1) or puede('costos', 1))
$$;

-- -----------------------------------------------------------------------------
-- Catálogo: fracción arancelaria en el artículo (hoy es una hoja suelta con
-- errores: una fracción de 7 dígitos, un indicador de nivel como "prenda de
-- vestir", pedales con dos fracciones distintas) y TAX ID del proveedor
-- extranjero (lo pide el agente en la factura y en el contrato).
-- -----------------------------------------------------------------------------
alter table public.articulos add column if not exists fraccion_arancelaria text;
alter table public.articulos add column if not exists nico text;
alter table public.articulos add column if not exists descripcion_aduanal text;
alter table public.proveedores add column if not exists tax_id text;

-- Se captura como venga ("8483.30.99", "8483309901"); se guarda en dígitos.
create or replace function public.normalizar_fraccion() returns trigger
language plpgsql as $$
declare d text;
begin
  if new.fraccion_arancelaria is not null then
    d := regexp_replace(new.fraccion_arancelaria, '\D', '', 'g');
    if length(d) = 10 and new.nico is null then
      new.nico := right(d, 2);
      d := left(d, 8);
    end if;
    new.fraccion_arancelaria := nullif(d, '');
  end if;
  if new.nico is not null then new.nico := nullif(regexp_replace(new.nico, '\D', '', 'g'), ''); end if;
  if new.fraccion_arancelaria is not null and new.fraccion_arancelaria !~ '^\d{8}$' then
    raise exception 'La fracción arancelaria son 8 dígitos (más 2 del NICO); "%" no lo es', new.fraccion_arancelaria using errcode = '23514';
  end if;
  if new.nico is not null and new.nico !~ '^\d{2}$' then
    raise exception 'El NICO son 2 dígitos' using errcode = '23514';
  end if;
  return new;
end $$;
drop trigger if exists normalizar_fraccion on public.articulos;
create trigger normalizar_fraccion before insert or update of fraccion_arancelaria, nico on public.articulos
  for each row execute function public.normalizar_fraccion();

-- -----------------------------------------------------------------------------
-- Etapas: sustituyen las 29 casillas. Cada una es una FECHA real, no una palomita.
-- "hito" = mueve al embarque de fase (mandar documentos al agente, devolver el
-- vacío o recibir la cuenta de gastos no cambian dónde está la mercancía).
-- -----------------------------------------------------------------------------
create table if not exists public.etapas_importacion (
  tipo text primary key,
  nombre text not null,
  orden int not null unique,
  fase text not null check (fase in ('produccion', 'listo', 'transito', 'puerto', 'planta', 'cerrado')),
  hito boolean not null default true,
  descripcion text
);
insert into public.etapas_importacion (tipo, nombre, orden, fase, hito, descripcion) values
  ('pi', 'PI aceptada', 10, 'produccion', true, 'Proforma invoice confirmada con el proveedor'),
  ('anticipo', 'Anticipo pagado', 20, 'produccion', true, '30–50 % según el proveedor'),
  ('produccion', 'En producción', 30, 'produccion', true, 'El proveedor confirmó que ya fabrica'),
  ('listo', 'Mercancía lista', 40, 'listo', true, 'Aviso de "goods ready": toca pagar el saldo'),
  ('zarpe', 'Zarpó', 50, 'transito', true, 'Salida real del buque (ETD real)'),
  ('documentos_agente', 'Documentos al agente', 55, 'transito', false, 'CI, PL, BL, fichas y cartas mandadas al agente aduanal'),
  ('arribo', 'Llegó a puerto', 60, 'puerto', true, 'Atraque o aviso de arribo: empiezan a correr los días libres'),
  ('revalidacion', 'BL revalidado', 65, 'puerto', true, 'Incluye desconsolidación en LCL'),
  ('previo', 'Previo', 70, 'puerto', true, 'Reconocimiento previo o carta de no previo'),
  ('pedimento_pagado', 'Pedimento pagado', 80, 'puerto', true, 'IGI, DTA, IVA y PRV pagados'),
  ('despacho', 'Despachado', 90, 'puerto', true, 'Salió del puerto con el transportista'),
  ('en_planta', 'En planta', 100, 'planta', true, 'Recibida en Atotonilco'),
  ('vacio_devuelto', 'Vacío devuelto', 105, 'planta', false, 'Contenedor vacío entregado a la naviera (FCL)'),
  ('cuenta_gastos', 'Cuenta de gastos', 110, 'planta', false, 'El agente aduanal mandó su cuenta de gastos'),
  ('cierre', 'Cerrado', 120, 'cerrado', true, 'Cuenta de gastos cerrada: saldo a favor y garantía recuperados')
on conflict (tipo) do update set nombre = excluded.nombre, orden = excluded.orden, fase = excluded.fase,
  hito = excluded.hito, descripcion = excluded.descripcion;

-- Documentos por modalidad: el checklist que hoy son casillas y 4 subcarpetas.
-- con_montos = trae precios o importes: el archivo solo lo abre quien ve dinero.
create table if not exists public.documentos_importacion (
  tipo text primary key,
  nombre text not null,
  debe text not null check (debe in ('proveedor', 'agente', 'naviera', 'forwarder', 'hegamex', 'transportista')),
  modalidades text[] not null default '{fcl,lcl,consolidado,aereo}',
  solo_incoterms text[],
  antes_de_arribo boolean not null default false,
  con_montos boolean not null default false,
  en_checklist boolean not null default true,
  orden int not null
);
insert into public.documentos_importacion (tipo, nombre, debe, modalidades, solo_incoterms, antes_de_arribo, con_montos, en_checklist, orden) values
  ('pi', 'Proforma invoice (PI)', 'proveedor', '{fcl,lcl,consolidado,aereo}', null, false, true, true, 10),
  ('ci', 'Commercial invoice', 'proveedor', '{fcl,lcl,consolidado,aereo}', null, true, true, true, 20),
  ('pl', 'Packing list', 'proveedor', '{fcl,lcl,consolidado,aereo}', null, true, false, true, 30),
  ('bl_draft', 'BL draft', 'proveedor', '{fcl,lcl,consolidado}', null, false, false, true, 40),
  ('bl', 'BL Telex / Seaway (o guía aérea)', 'proveedor', '{fcl,lcl,consolidado,aereo}', null, true, false, true, 50),
  ('poliza', 'Póliza de seguro', 'proveedor', '{fcl,lcl,consolidado,aereo}', '{CIF,CIP}', true, true, true, 60),
  ('certificado_origen', 'Certificado de origen', 'proveedor', '{fcl,lcl,consolidado,aereo}', null, true, false, true, 70),
  ('pedimento_exportacion', 'Pedimento de exportación del proveedor', 'proveedor', '{fcl,lcl,consolidado}', null, false, false, true, 80),
  ('oc', 'Orden de compra', 'hegamex', '{fcl,lcl,consolidado,aereo}', null, true, true, true, 90),
  ('contrato', 'Contrato de compraventa', 'hegamex', '{fcl,lcl,consolidado,aereo}', null, true, true, true, 100),
  ('ficha_tecnica', 'Fichas técnicas en español', 'hegamex', '{fcl,lcl,consolidado,aereo}', null, true, false, true, 110),
  ('carta_318', 'Carta 3.1.8', 'hegamex', '{fcl,lcl,consolidado,aereo}', null, true, false, true, 120),
  ('carta_instrucciones', 'Carta de instrucciones', 'hegamex', '{fcl,lcl,consolidado,aereo}', null, true, false, true, 130),
  ('carta_encomienda', 'Carta encomienda', 'hegamex', '{fcl,consolidado}', null, true, false, true, 140),
  ('aviso_arribo', 'Aviso de arribo y cargos locales', 'naviera', '{fcl,lcl,consolidado}', null, false, true, true, 150),
  ('aviso_desconsolidacion', 'Aviso de desconsolidación', 'forwarder', '{lcl}', null, false, false, true, 160),
  ('proforma_pedimento', 'Proforma del pedimento', 'agente', '{fcl,lcl,consolidado,aereo}', null, false, true, true, 170),
  ('manifestacion_valor', 'Manifestación de valor (MVE)', 'agente', '{fcl,lcl,consolidado,aereo}', null, false, true, true, 180),
  ('carta_no_previo', 'Carta de no previo', 'hegamex', '{fcl,lcl,consolidado,aereo}', null, false, false, false, 190),
  ('carta_valor', 'Carta valor / carta de uso', 'hegamex', '{fcl,lcl,consolidado,aereo}', null, false, true, false, 195),
  ('bl_revalidado', 'BL revalidado', 'agente', '{fcl,lcl,consolidado}', null, false, false, true, 200),
  ('pedimento', 'Pedimento pagado', 'agente', '{fcl,lcl,consolidado,aereo}', null, false, true, true, 210),
  ('doda', 'DODA', 'agente', '{fcl,lcl,consolidado,aereo}', null, false, false, false, 220),
  ('eir', 'EIR (devolución del vacío)', 'naviera', '{fcl,consolidado}', null, false, false, true, 230),
  ('cuenta_gastos', 'Cuenta de gastos del agente', 'agente', '{fcl,lcl,consolidado,aereo}', null, false, true, true, 240),
  ('comprobante', 'Comprobante de pago', 'hegamex', '{fcl,lcl,consolidado,aereo}', null, false, true, false, 250),
  ('otro', 'Otro documento', 'hegamex', '{fcl,lcl,consolidado,aereo}', null, false, true, false, 900)
on conflict (tipo) do update set nombre = excluded.nombre, debe = excluded.debe, modalidades = excluded.modalidades,
  solo_incoterms = excluded.solo_incoterms, antes_de_arribo = excluded.antes_de_arribo, con_montos = excluded.con_montos,
  en_checklist = excluded.en_checklist, orden = excluded.orden;

-- -----------------------------------------------------------------------------
-- Embarques
-- -----------------------------------------------------------------------------
create table if not exists public.embarques (
  id uuid primary key default gen_random_uuid(),
  folio text not null default '' unique,
  descripcion text not null check (length(trim(descripcion)) >= 3),   -- "71 celdas de carga", como la carpeta del expediente
  modalidad text not null default 'lcl' check (modalidad in ('fcl', 'lcl', 'consolidado', 'aereo')),
  -- Se ha importado a nombre de la empresa y de la persona física: hay que saber de quién es cada uno.
  importador text not null default 'empresa' check (importador in ('empresa', 'persona_fisica')),
  incoterm text check (incoterm in ('EXW', 'FCA', 'FAS', 'FOB', 'CFR', 'CIF', 'CPT', 'CIP', 'DAP', 'DPU', 'DDP')),
  puerto_origen text,
  puerto_destino text not null default 'Manzanillo',
  naviera text,
  forwarder text,                 -- consolidador o forwarder (Sea Bridge, Interteam, XPD…)
  agente_aduanal text,
  referencia_agente text,         -- EMZIF…, ZMZI…, LCM…: con esto se busca todo con el agente
  bl text,
  bl_house text,
  contenedores text,
  buque text,
  viaje text,
  bultos int check (bultos >= 0),
  peso_kg numeric(12,2) check (peso_kg >= 0),
  volumen_m3 numeric(10,3) check (volumen_m3 >= 0),
  etd date,
  eta date,
  eta_original date,
  dias_libres_almacenaje int not null default 7 check (dias_libres_almacenaje >= 0),
  dias_libres_demoras int check (dias_libres_demoras >= 0),   -- solo contenedor (FCL / consolidado)
  carpeta_url text,
  notas text,
  cancelado boolean not null default false,
  creado_por uuid default auth.uid() references public.perfiles(id),
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

-- Las órdenes de compra que viajan en el embarque. factura = número de la
-- commercial invoice; volumen = el que da el consolidador por proveedor (en un
-- consolidado la logística se reparte por volumen, como en PRORRATEO.xlsx).
create table if not exists public.embarque_oc (
  embarque_id uuid not null references public.embarques(id) on delete cascade,
  orden_compra_id uuid not null references public.ordenes_compra(id),
  factura text,
  volumen_m3 numeric(10,3) check (volumen_m3 >= 0),
  agregado_en timestamptz not null default now(),
  primary key (embarque_id, orden_compra_id)
);
create index if not exists embarque_oc_orden on public.embarque_oc (orden_compra_id);

create table if not exists public.embarque_eventos (
  id uuid primary key default gen_random_uuid(),
  embarque_id uuid not null references public.embarques(id) on delete cascade,
  tipo text not null check (tipo in ('pi', 'anticipo', 'produccion', 'listo', 'zarpe', 'documentos_agente', 'arribo',
    'revalidacion', 'previo', 'pedimento_pagado', 'despacho', 'en_planta', 'vacio_devuelto', 'cuenta_gastos', 'cierre',
    'cambio_eta', 'nota')),
  fecha date not null,
  detalle text,
  datos jsonb,                               -- cambio_eta: {"antes": …, "despues": …}
  registrado_por uuid default auth.uid() references public.perfiles(id),
  registrado_en timestamptz not null default now()
);
-- Una fecha real por etapa; los cambios de ETA y las notas son historia.
create unique index if not exists embarque_eventos_etapa on public.embarque_eventos (embarque_id, tipo)
  where tipo not in ('cambio_eta', 'nota');
create index if not exists embarque_eventos_embarque on public.embarque_eventos (embarque_id, fecha);

create table if not exists public.embarque_documentos (
  id uuid primary key default gen_random_uuid(),
  embarque_id uuid not null references public.embarques(id) on delete cascade,
  tipo text not null references public.documentos_importacion(tipo),
  descripcion text,
  debe text not null check (debe in ('proveedor', 'agente', 'naviera', 'forwarder', 'hegamex', 'transportista')),
  estado text not null default 'pendiente' check (estado in ('pendiente', 'recibido', 'observado', 'aceptado', 'no_aplica')),
  archivo text,                              -- ruta en el bucket "importaciones": <embarque>/<tipo>/<archivo>
  archivo_nombre text,
  tamano int,
  observaciones text,
  recibido_en date,
  ultimo_seguimiento date,                   -- la última vez que se pidió ("¿alguna novedad?")
  creado_por uuid default auth.uid() references public.perfiles(id),
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);
create index if not exists embarque_documentos_embarque on public.embarque_documentos (embarque_id);

-- Pagos al proveedor del extranjero, en la moneda de la orden (casi siempre USD)
-- con el tipo de cambio REAL: los pesos que salieron entre los dólares. El agente
-- aduanal pide ese comprobante para demostrar el tipo de cambio.
create table if not exists public.embarque_pagos (
  id uuid primary key default gen_random_uuid(),
  embarque_id uuid not null references public.embarques(id) on delete cascade,
  orden_compra_id uuid not null references public.ordenes_compra(id),
  concepto text not null default 'anticipo' check (concepto in ('anticipo', 'saldo', 'total', 'otro')),
  estado text not null default 'pagado' check (estado in ('programado', 'pagado', 'retenido', 'confirmado', 'devuelto')),
  fecha date not null default current_date,
  moneda public.moneda not null default 'USD',
  monto numeric(14,2) not null check (monto > 0),
  tipo_cambio numeric(12,4) check (tipo_cambio > 0),
  monto_mxn numeric(14,2) generated always as (round(monto * tipo_cambio, 2)) stored,
  metodo text not null default 'transferencia' check (metodo in ('transferencia', 'ebanx', 'otro')),
  cuenta_origen text,
  referencia text,
  comprobante text,
  confirmado_en date,
  notas text,
  registrado_por uuid default auth.uid() references public.perfiles(id),
  creado_en timestamptz not null default now()
);
create index if not exists embarque_pagos_embarque on public.embarque_pagos (embarque_id);
create index if not exists embarque_pagos_orden on public.embarque_pagos (orden_compra_id);

-- Gastos indirectos (módulo costos). Sin IVA y con el IVA acreditable aparte: el
-- IVA se recupera, no es costo. estimado = lo que se sabe antes de la cuenta de
-- gastos (entra al costeo preliminar, no al final).
create table if not exists public.embarque_gastos (
  id uuid primary key default gen_random_uuid(),
  embarque_id uuid not null references public.embarques(id) on delete cascade,
  concepto text not null check (concepto in ('flete_internacional', 'seguro', 'cargos_locales', 'revalidacion',
    'desconsolidacion', 'maniobras', 'almacenaje', 'demoras', 'limpieza', 'honorarios', 'cuenta_gastos',
    'flete_local', 'grua', 'otro')),
  descripcion text,
  proveedor text,                            -- quién lo cobra: naviera, agente, transportista…
  factura text,
  fecha date not null default current_date,
  moneda public.moneda not null default 'MXN',
  monto numeric(14,2) not null check (monto >= 0),
  tipo_cambio numeric(12,4) not null default 1 check (tipo_cambio > 0),
  monto_mxn numeric(14,2) generated always as (round(monto * tipo_cambio, 2)) stored,
  iva numeric(14,2) not null default 0 check (iva >= 0),
  criterio text not null default 'valor' check (criterio in ('valor', 'volumen', 'directo')),
  orden_compra_id uuid references public.ordenes_compra(id),   -- si solo le toca a una factura
  articulo_id uuid references public.articulos(id),            -- criterio directo
  estimado boolean not null default false,
  registrado_por uuid default auth.uid() references public.perfiles(id),
  creado_en timestamptz not null default now(),
  check (criterio <> 'directo' or articulo_id is not null)
);
create index if not exists embarque_gastos_embarque on public.embarque_gastos (embarque_id);

-- Pedimento: IGI, DTA y PRV son costo; el IVA de importación es acreditable.
create table if not exists public.pedimentos (
  id uuid primary key default gen_random_uuid(),
  embarque_id uuid not null references public.embarques(id) on delete cascade,
  numero text not null unique,
  clave text not null default 'A1',
  aduana text default 'Manzanillo',
  fecha_pago date not null,
  tipo_cambio numeric(12,4) check (tipo_cambio > 0),
  valor_aduana numeric(14,2) check (valor_aduana >= 0),
  igi numeric(14,2) not null default 0 check (igi >= 0),
  dta numeric(14,2) not null default 0 check (dta >= 0),
  iva numeric(14,2) not null default 0 check (iva >= 0),
  prv numeric(14,2) not null default 0 check (prv >= 0),
  otros numeric(14,2) not null default 0 check (otros >= 0),
  total numeric(14,2) generated always as (igi + dta + iva + prv + otros) stored,
  archivo text,
  registrado_por uuid default auth.uid() references public.perfiles(id),
  creado_en timestamptz not null default now()
);
create index if not exists pedimentos_embarque on public.pedimentos (embarque_id);

-- Dinero por recuperar: saldo a favor con el agente (22 devoluciones, $363 mil,
-- hasta 50 días después de la cuenta de gastos) y garantías de contenedor (una
-- tardó 68 días). No es costo: es dinero de Hegamex que alguien tiene.
create table if not exists public.embarque_saldos (
  id uuid primary key default gen_random_uuid(),
  embarque_id uuid not null references public.embarques(id) on delete cascade,
  tipo text not null check (tipo in ('saldo_agente', 'garantia_contenedor', 'otro')),
  descripcion text,
  deudor text,
  moneda public.moneda not null default 'MXN',
  monto numeric(14,2) not null check (monto > 0),
  tipo_cambio numeric(12,4) not null default 1 check (tipo_cambio > 0),
  fecha_origen date not null default current_date,
  fecha_esperada date,
  recuperado_en date,
  monto_recuperado numeric(14,2) check (monto_recuperado >= 0),
  notas text,
  registrado_por uuid default auth.uid() references public.perfiles(id),
  creado_en timestamptz not null default now()
);
create index if not exists embarque_saldos_embarque on public.embarque_saldos (embarque_id);

-- Costeo de importación (módulo costos). Una versión preliminar al pagar el
-- pedimento y una final con la cuenta de gastos; un complemento (almacenajes,
-- demoras) es otra versión final. Solo la final cerrada mueve el catálogo.
create table if not exists public.costeos_importacion (
  id uuid primary key default gen_random_uuid(),
  embarque_id uuid not null references public.embarques(id) on delete cascade,
  tipo text not null check (tipo in ('preliminar', 'final')),
  version int not null default 1,
  estado text not null default 'borrador' check (estado in ('borrador', 'cerrado')),
  valor_mxn numeric(16,2),
  gastos_mxn numeric(16,2),
  iva_acreditable numeric(16,2),
  factor numeric(10,6),
  gastos jsonb not null default '[]',        -- foto de los gastos que entraron, con su criterio
  huella text not null,                      -- para no cerrar un cálculo viejo
  calculado_en timestamptz not null default now(),
  calculado_por uuid default auth.uid() references public.perfiles(id),
  cerrado_en timestamptz,
  cerrado_por uuid references public.perfiles(id),
  articulos_actualizados int,
  unique (embarque_id, tipo, version)
);
create table if not exists public.costeo_importacion_lineas (
  id uuid primary key default gen_random_uuid(),
  costeo_id uuid not null references public.costeos_importacion(id) on delete cascade,
  orden_compra_id uuid references public.ordenes_compra(id),
  oc_linea_id uuid references public.oc_lineas(id) on delete set null,
  articulo_id uuid references public.articulos(id),
  descripcion text not null,
  cantidad numeric(14,3) not null check (cantidad > 0),
  precio numeric(14,4) not null,
  moneda public.moneda not null,
  tipo_cambio numeric(12,6) not null,
  valor_mxn numeric(16,2) not null,
  gastos_valor numeric(16,2) not null default 0,
  gastos_volumen numeric(16,2) not null default 0,
  gastos_directos numeric(16,2) not null default 0,
  costo_total numeric(16,2) not null,
  costo_unitario numeric(16,4) not null,
  factor numeric(10,6),
  costo_anterior numeric(16,4)               -- el del catálogo en pesos al calcular, para ver cuánto cambia
);
create index if not exists costeo_lineas_costeo on public.costeo_importacion_lineas (costeo_id);
create index if not exists costeo_lineas_oc_linea on public.costeo_importacion_lineas (oc_linea_id);

-- -----------------------------------------------------------------------------
-- Textos cortos para alertas y hallazgos
-- -----------------------------------------------------------------------------
create or replace function public.fecha_texto(d date) returns text
language sql immutable as $$
  select case when d is null then '—' else extract(day from d)::int || ' '
    || (array['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'])[extract(month from d)::int] end
$$;

create or replace function public.texto_usd(n numeric) returns text
language sql immutable as $$
  select case when n is null then '—' else 'USD ' || to_char(round(n), 'FM999,999,990') end
$$;

create or replace function public.nombre_concepto_gasto(p text) returns text
language sql immutable as $$
  select case p when 'flete_internacional' then 'Flete internacional' when 'seguro' then 'Seguro' when 'cargos_locales' then 'Cargos locales'
    when 'revalidacion' then 'Revalidación' when 'desconsolidacion' then 'Desconsolidación' when 'maniobras' then 'Maniobras'
    when 'almacenaje' then 'Almacenaje' when 'demoras' then 'Demoras' when 'limpieza' then 'Limpieza de contenedor'
    when 'honorarios' then 'Honorarios del agente' when 'cuenta_gastos' then 'Cuenta de gastos' when 'flete_local' then 'Flete Manzanillo–Atotonilco'
    when 'grua' then 'Grúa y otros' else 'Otro' end
$$;

create or replace function public.nombre_debe(p text) returns text
language sql immutable as $$
  select case p when 'proveedor' then 'proveedor' when 'agente' then 'agente aduanal' when 'naviera' then 'naviera'
    when 'forwarder' then 'forwarder' when 'hegamex' then 'Hegamex' when 'transportista' then 'transportista' else p end
$$;

-- -----------------------------------------------------------------------------
-- Reglas al capturar
-- -----------------------------------------------------------------------------
create or replace function public.sincronizar_checklist_importacion(p_embarque uuid) returns int
language plpgsql security definer set search_path = public as $$
declare v_n int;
begin
  insert into embarque_documentos (embarque_id, tipo, debe)
  select b.id, c.tipo, c.debe from embarques b cross join documentos_importacion c
  where b.id = p_embarque and c.en_checklist and b.modalidad = any(c.modalidades)
    and (c.solo_incoterms is null or b.incoterm = any(c.solo_incoterms))
    and not exists (select 1 from embarque_documentos d where d.embarque_id = b.id and d.tipo = c.tipo);
  get diagnostics v_n = row_count;
  -- Lo que ya no aplica (p. ej. la póliza al pasar de CIF a CFR) y sigue pendiente sin archivo, se quita.
  delete from embarque_documentos d using embarques b, documentos_importacion c
  where d.embarque_id = p_embarque and b.id = d.embarque_id and c.tipo = d.tipo and c.en_checklist
    and d.estado = 'pendiente' and d.archivo is null
    and not (b.modalidad = any(c.modalidades) and (c.solo_incoterms is null or b.incoterm = any(c.solo_incoterms)));
  return v_n;
end $$;

create or replace function public.trg_embarque_antes() returns trigger
language plpgsql set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    new.eta_original := coalesce(new.eta_original, new.eta);
    -- 21 días libres de demoras (COSCO/XPD) si no se dice otra cosa; aéreo y LCL no llevan contenedor propio.
    if new.modalidad in ('fcl', 'consolidado') and new.dias_libres_demoras is null then new.dias_libres_demoras := 21; end if;
  else
    if new.eta_original is null and old.eta is not null then new.eta_original := old.eta; end if;
  end if;
  new.descripcion := trim(new.descripcion);
  return new;
end $$;
drop trigger if exists antes on public.embarques;
create trigger antes before insert or update on public.embarques for each row execute function public.trg_embarque_antes();
drop trigger if exists folio on public.embarques;
create trigger folio before insert on public.embarques for each row execute function public.trg_folio('EMB');
drop trigger if exists tocar on public.embarques;
create trigger tocar before update on public.embarques for each row execute function public.tocar_actualizado();

create or replace function public.trg_embarque_despues() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' or new.modalidad is distinct from old.modalidad or new.incoterm is distinct from old.incoterm then
    perform sincronizar_checklist_importacion(new.id);
  end if;
  -- Cada cambio de ETA queda como evento: la hoja solo guardaba la última y se
  -- perdía la ventana de días libres cuando la naviera la movía.
  if tg_op = 'UPDATE' and old.eta is not null and new.eta is distinct from old.eta then
    insert into embarque_eventos (embarque_id, tipo, fecha, datos, detalle)
    values (new.id, 'cambio_eta', (now() at time zone 'America/Mexico_City')::date,
            jsonb_build_object('antes', old.eta, 'despues', new.eta),
            format('ETA del %s al %s', fecha_texto(old.eta), coalesce(fecha_texto(new.eta), 'sin fecha')));
    -- Quien espera la mercancía se entera sin estar en copia (avisos de 20261003000071).
    if to_regproc('public.avisar') is not null then
      perform avisar(array(select usuarios_con_rol('importaciones') union select usuarios_con_rol('compras')
                           union select usuarios_con_rol('almacen')),
        'importacion_eta', format('Cambió la ETA de %s: del %s al %s', new.folio, fecha_texto(old.eta), coalesce(fecha_texto(new.eta), 'sin fecha')),
        new.descripcion, '/importaciones/' || new.id, 'embarques', new.id::text, false);
    end if;
  end if;
  return null;
end $$;
drop trigger if exists despues on public.embarques;
create trigger despues after insert or update on public.embarques for each row execute function public.trg_embarque_despues();

-- Ligar una orden al embarque. Un proveedor del extranjero no cobra IVA mexicano
-- (el IVA se paga en el pedimento): si la orden lo traía, su total estaba inflado
-- y el tope de pagos saldría mal.
create or replace function public.trg_embarque_oc() returns trigger
language plpgsql security definer set search_path = public as $$
declare o ordenes_compra;
begin
  if tg_op = 'DELETE' then
    if exists (select 1 from embarque_pagos where embarque_id = old.embarque_id and orden_compra_id = old.orden_compra_id and estado <> 'devuelto') then
      raise exception 'Esa orden ya tiene pagos registrados en este embarque: no se puede quitar' using errcode = '23514';
    end if;
    return old;
  end if;
  select * into o from ordenes_compra where id = new.orden_compra_id;
  if o.estado = 'cancelada' then raise exception 'La orden % está cancelada', o.folio using errcode = '23514'; end if;
  if o.tasa_iva <> 0 and o.estado not in ('recibida', 'cancelada') then
    update ordenes_compra set tasa_iva = 0 where id = o.id;
    perform totales_oc(o.id);
  end if;
  return new;
end $$;
drop trigger if exists validar on public.embarque_oc;
create trigger validar before insert or update or delete on public.embarque_oc for each row execute function public.trg_embarque_oc();

-- Las etapas son fechas reales, no planes (para lo que se espera está el ETA).
create or replace function public.trg_embarque_evento() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.tipo not in ('cambio_eta', 'nota') and new.fecha > (now() at time zone 'America/Mexico_City')::date then
    raise exception 'La fecha de "%" es futura: aquí van fechas reales. Lo esperado va en el ETA.',
      (select nombre from etapas_importacion where tipo = new.tipo) using errcode = '23514';
  end if;
  if new.tipo = 'cierre' and not exists (select 1 from embarque_eventos where embarque_id = new.embarque_id and tipo = 'cuenta_gastos') then
    raise exception 'Para cerrar el embarque primero registra la cuenta de gastos' using errcode = '23514';
  end if;
  return new;
end $$;
drop trigger if exists validar on public.embarque_eventos;
create trigger validar before insert or update on public.embarque_eventos for each row execute function public.trg_embarque_evento();

create or replace function public.trg_embarque_documento() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.archivo is not null and new.archivo not like new.embarque_id::text || '/%' then
    raise exception 'El archivo tiene que estar en la carpeta del embarque' using errcode = '23514';
  end if;
  if new.archivo is not null and new.estado = 'pendiente' then new.estado := 'recibido'; end if;
  if new.estado in ('recibido', 'aceptado') and new.recibido_en is null then
    new.recibido_en := (now() at time zone 'America/Mexico_City')::date;
  end if;
  if tg_op = 'UPDATE' then new.actualizado_en := now(); end if;
  return new;
end $$;
drop trigger if exists validar on public.embarque_documentos;
create trigger validar before insert or update on public.embarque_documentos for each row execute function public.trg_embarque_documento();

-- Pagos: nunca más de lo que se le debe al proveedor por esa orden (contando lo
-- programado y lo que finanzas haya registrado en pagos_proveedor). Antes un
-- anticipo salió con el concepto de otra factura y nadie lo vio.
create or replace function public.validar_pago_importacion() returns trigger
language plpgsql security definer set search_path = public as $$
declare o ordenes_compra; v_otros numeric; v_prov numeric; v_hoy date := (now() at time zone 'America/Mexico_City')::date;
begin
  -- La RLS se evalúa después de este disparador: sin esto, quien no puede pagar
  -- recibiría "se pagaría de más" en vez de "no tienes permiso".
  if auth.uid() is not null and not (ve_dinero_importacion() and (puede('importaciones', 2) or puede('finanzas', 2))) then
    raise exception 'Los pagos a proveedores del extranjero los registran importaciones o finanzas' using errcode = '42501';
  end if;
  if not exists (select 1 from embarque_oc where embarque_id = new.embarque_id and orden_compra_id = new.orden_compra_id) then
    raise exception 'Esa orden de compra no va en este embarque' using errcode = '23514';
  end if;
  select * into o from ordenes_compra where id = new.orden_compra_id for update;
  if o.estado in ('borrador', 'cancelada') then
    raise exception 'La orden % está en %: primero se envía al proveedor', o.folio, o.estado using errcode = '23514';
  end if;
  new.moneda := o.moneda;
  if new.moneda = 'MXN' then new.tipo_cambio := 1; end if;
  if new.estado in ('pagado', 'retenido', 'confirmado') then
    if new.tipo_cambio is null then
      raise exception 'Falta el tipo de cambio real del pago: los pesos que salieron entre los %', new.moneda using errcode = '23514';
    end if;
    if new.fecha > v_hoy then
      raise exception 'Un pago hecho no lleva fecha futura; si todavía no sale, regístralo como programado' using errcode = '23514';
    end if;
  end if;
  if new.estado = 'confirmado' then new.confirmado_en := coalesce(new.confirmado_en, v_hoy); end if;
  if new.estado <> 'devuelto' then
    select coalesce(sum(monto), 0) into v_otros from embarque_pagos
    where orden_compra_id = new.orden_compra_id and estado <> 'devuelto' and id <> new.id;
    select coalesce(sum(monto), 0) into v_prov from pagos_proveedor where orden_compra_id = new.orden_compra_id;
    if v_otros + v_prov + new.monto > o.total + 0.01 then
      raise exception 'Con este pago se le pagaría de más al proveedor en la orden %: se le deben %, ya van % pagados o programados y este pago es de %',
        o.folio, o.moneda || ' ' || to_char(o.total, 'FM999,999,990.00'), o.moneda || ' ' || to_char(v_otros + v_prov, 'FM999,999,990.00'),
        o.moneda || ' ' || to_char(new.monto, 'FM999,999,990.00') using errcode = '23514';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists validar on public.embarque_pagos;
create trigger validar before insert or update on public.embarque_pagos for each row execute function public.validar_pago_importacion();

-- El primer anticipo pagado es la etapa "anticipo": no hay que registrarla dos veces.
-- El detalle no lleva el monto: las etapas las ve almacén, y el dinero vive en embarque_pagos.
create or replace function public.trg_pago_importacion_etapa() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.estado in ('pagado', 'retenido', 'confirmado') and new.concepto in ('anticipo', 'total')
     and not exists (select 1 from embarque_eventos where embarque_id = new.embarque_id and tipo = 'anticipo') then
    insert into embarque_eventos (embarque_id, tipo, fecha, detalle)
    values (new.embarque_id, 'anticipo', new.fecha,
            'Se anotó al registrar el pago' || case new.metodo when 'ebanx' then ' por EBANX' when 'transferencia' then ' por transferencia' else '' end);
  end if;
  return null;
end $$;
drop trigger if exists etapa on public.embarque_pagos;
create trigger etapa after insert or update of estado on public.embarque_pagos for each row execute function public.trg_pago_importacion_etapa();

-- Del otro lado: un pago capturado en finanzas (pagos_proveedor) tampoco puede
-- rebasar lo que ya se pagó por el embarque. Disparador aparte para no tocar el de 050.
create or replace function public.validar_pago_proveedor_importacion() returns trigger
language plpgsql security definer set search_path = public as $$
declare o ordenes_compra; v_total numeric;
begin
  if not exists (select 1 from embarque_pagos where orden_compra_id = new.orden_compra_id and estado <> 'devuelto') then return null; end if;
  select * into o from ordenes_compra where id = new.orden_compra_id;
  select coalesce((select sum(monto) from pagos_proveedor where orden_compra_id = o.id), 0)
       + coalesce((select sum(monto) from embarque_pagos where orden_compra_id = o.id and estado <> 'devuelto'), 0) into v_total;
  if v_total > o.total + 0.01 then
    raise exception 'La orden % ya tiene pagos en su embarque de importación: con este quedaría pagada de más (total %, pagado %)',
      o.folio, to_char(o.total, 'FM999,999,990.00'), to_char(v_total, 'FM999,999,990.00') using errcode = '23514';
  end if;
  return null;
end $$;
drop trigger if exists validar_importacion on public.pagos_proveedor;
create trigger validar_importacion after insert or update on public.pagos_proveedor
  for each row execute function public.validar_pago_proveedor_importacion();

create or replace function public.trg_gasto_importacion() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.moneda = 'MXN' then new.tipo_cambio := 1; end if;
  if new.orden_compra_id is not null and not exists (
       select 1 from embarque_oc where embarque_id = new.embarque_id and orden_compra_id = new.orden_compra_id) then
    raise exception 'Ese gasto apunta a una orden que no va en este embarque' using errcode = '23514';
  end if;
  return new;
end $$;
drop trigger if exists validar on public.embarque_gastos;
create trigger validar before insert or update on public.embarque_gastos for each row execute function public.trg_gasto_importacion();

-- Pedimento: el número son 15 dígitos (año, aduana, patente, consecutivo); se
-- guarda como lo escribe la aduana. Pagarlo es la etapa "pedimento pagado".
create or replace function public.trg_pedimento() returns trigger
language plpgsql security definer set search_path = public as $$
declare d text := regexp_replace(coalesce(new.numero, ''), '\D', '', 'g');
begin
  if tg_op = 'INSERT' or new.numero is distinct from old.numero then
    if length(d) <> 15 then
      raise exception 'El número de pedimento son 15 dígitos (año, aduana, patente y consecutivo): "%" no lo es', new.numero using errcode = '23514';
    end if;
    new.numero := substr(d, 1, 2) || ' ' || substr(d, 3, 2) || ' ' || substr(d, 5, 4) || ' ' || substr(d, 9, 7);
  end if;
  if not exists (select 1 from embarque_eventos where embarque_id = new.embarque_id and tipo = 'pedimento_pagado') then
    insert into embarque_eventos (embarque_id, tipo, fecha, detalle) values (new.embarque_id, 'pedimento_pagado', new.fecha_pago, 'Pedimento ' || new.numero);
  end if;
  return new;
end $$;
drop trigger if exists validar on public.pedimentos;
create trigger validar before insert or update on public.pedimentos for each row execute function public.trg_pedimento();

-- Saldo a favor: 15 días después de la cuenta de gastos; garantía: 30 días (§9.4).
create or replace function public.trg_saldo_importacion() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.moneda = 'MXN' then new.tipo_cambio := 1; end if;
  new.fecha_esperada := coalesce(new.fecha_esperada, new.fecha_origen + case new.tipo when 'saldo_agente' then 15 when 'garantia_contenedor' then 30 else 30 end);
  if new.recuperado_en is not null then new.monto_recuperado := coalesce(new.monto_recuperado, new.monto); end if;
  return new;
end $$;
drop trigger if exists validar on public.embarque_saldos;
create trigger validar before insert or update on public.embarque_saldos for each row execute function public.trg_saldo_importacion();

-- -----------------------------------------------------------------------------
-- Dónde va cada embarque. La fase sale del último hito con fecha real.
-- -----------------------------------------------------------------------------
-- Días típicos de llegada a planta (la mediana real: 8–24 días en la hoja).
create or replace function public.dias_puerto_tipicos() returns int
language sql stable security definer set search_path = public as $$
  select coalesce(round(percentile_cont(0.5) within group (order by p.fecha - a.fecha))::int, 10)
  from embarque_eventos a join embarque_eventos p on p.embarque_id = a.embarque_id and p.tipo = 'en_planta'
  where a.tipo = 'arribo' and p.fecha >= a.fecha
$$;

create or replace view public.v_embarque_etapa with (security_invoker = true) as
select b.id as embarque_id,
  case when b.cancelado then 'cancelado' else coalesce(et.fase, 'cotizando') end as fase,
  et.tipo as etapa, et.nombre as etapa_nombre,
  coalesce(ev.fechas, '{}'::jsonb) as fechas,
  f.arribo, f.despacho, f.en_planta, f.vacio,
  case when f.arribo is not null then coalesce(f.despacho, f.en_planta, (now() at time zone 'America/Mexico_City')::date) - f.arribo end as dias_en_puerto,
  case when f.arribo is not null and b.modalidad in ('fcl', 'consolidado')
       then coalesce(f.vacio, (now() at time zone 'America/Mexico_City')::date) - f.arribo end as dias_contenedor,
  case when f.en_planta is not null then f.en_planta
       when f.despacho is not null then f.despacho + 1
       when f.arribo is not null then greatest(f.arribo + public.dias_puerto_tipicos(), (now() at time zone 'America/Mexico_City')::date)
       when b.eta is not null then b.eta + public.dias_puerto_tipicos() end as llegada_planta_estimada,
  coalesce(ev.cambios_eta, 0) as cambios_eta
from public.embarques b
left join lateral (
  select jsonb_object_agg(e.tipo, e.fecha) filter (where x.tipo is not null) as fechas,
    max(x.orden) filter (where x.hito) as orden_hito,
    count(*) filter (where e.tipo = 'cambio_eta') as cambios_eta
  from public.embarque_eventos e left join public.etapas_importacion x on x.tipo = e.tipo
  where e.embarque_id = b.id
) ev on true
left join public.etapas_importacion et on et.orden = ev.orden_hito
cross join lateral (select (ev.fechas->>'arribo')::date as arribo, (ev.fechas->>'despacho')::date as despacho,
                           (ev.fechas->>'en_planta')::date as en_planta, (ev.fechas->>'vacio_devuelto')::date as vacio) f;

-- Siguiente paso y quién lo debe: lo que Alondra hoy persigue por correo.
create or replace function public.siguiente_paso_embarque(p_fase text, p_fechas jsonb, p_modalidad text, p_faltan jsonb, p_eta date)
returns table (paso text, debe text)
language plpgsql immutable as $$
begin
  p_fechas := coalesce(p_fechas, '{}'); p_faltan := coalesce(p_faltan, '[]');
  if p_fase in ('cerrado', 'cancelado') then return; end if;
  if p_fase = 'cotizando' then paso := 'Confirmar la PI con el proveedor'; debe := 'proveedor';
  elsif p_fase = 'produccion' and not p_fechas ? 'anticipo' then paso := 'Pagar el anticipo'; debe := 'hegamex';
  elsif p_fase = 'produccion' then paso := 'Que el proveedor avise que la mercancía está lista'; debe := 'proveedor';
  elsif p_fase = 'listo' then paso := 'Pagar el saldo y confirmar zarpe y BL'; debe := 'hegamex';
  elsif p_fase = 'transito' and jsonb_array_length(p_faltan) > 0 then
    paso := 'Juntar los documentos para el agente aduanal'; debe := coalesce(p_faltan->0->>'debe', 'hegamex');
  elsif p_fase = 'transito' and not p_fechas ? 'documentos_agente' then paso := 'Mandar los documentos al agente aduanal'; debe := 'hegamex';
  elsif p_fase = 'transito' then paso := 'Esperar el arribo' || coalesce(' (ETA ' || fecha_texto(p_eta) || ')', ''); debe := 'naviera';
  elsif p_fase = 'puerto' and not p_fechas ? 'revalidacion' then paso := 'Revalidar el BL'; debe := 'agente';
  elsif p_fase = 'puerto' and not (p_fechas ? 'previo' or p_fechas ? 'pedimento_pagado') then paso := 'Previo o carta de no previo'; debe := 'agente';
  elsif p_fase = 'puerto' and not p_fechas ? 'pedimento_pagado' then paso := 'Pagar el pedimento'; debe := 'agente';
  elsif p_fase = 'puerto' and not p_fechas ? 'despacho' then paso := 'Cita y despacho con el transportista'; debe := 'agente';
  elsif p_fase = 'puerto' then paso := 'Recibir en planta'; debe := 'transportista';
  elsif p_fase = 'planta' and p_modalidad in ('fcl', 'consolidado') and not p_fechas ? 'vacio_devuelto' then paso := 'Devolver el contenedor vacío'; debe := 'transportista';
  elsif p_fase = 'planta' and not p_fechas ? 'cuenta_gastos' then paso := 'Pedir la cuenta de gastos'; debe := 'agente';
  elsif p_fase = 'planta' then paso := 'Recuperar saldo a favor y garantía, y cerrar'; debe := 'agente';
  end if;
  return next;
end $$;

-- Lo que ven las pantallas. Sin montos: la lee también almacén. Las órdenes se
-- leen de v_ordenes_compra, que enmascara importes (20261003000069).
create or replace view public.v_embarques with (security_invoker = true) as
select b.*, e.fase, e.etapa, e.etapa_nombre, e.fechas, e.arribo, e.despacho, e.en_planta, e.vacio,
  e.dias_en_puerto, e.dias_contenedor, e.llegada_planta_estimada, e.cambios_eta,
  oc.proveedores, coalesce(oc.ordenes, '[]'::jsonb) as ordenes,
  coalesce(d.pendientes, 0) as docs_pendientes, coalesce(d.pendientes_arribo, 0) as docs_pendientes_arribo,
  coalesce(d.total, 0) as docs_total, coalesce(d.faltan, '[]'::jsonb) as docs_faltan,
  s.paso as siguiente_paso, s.debe
from public.embarques b
join public.v_embarque_etapa e on e.embarque_id = b.id
left join lateral (
  select string_agg(distinct o.proveedor, ', ') as proveedores,
    jsonb_agg(jsonb_build_object('id', o.id, 'folio', o.folio, 'proveedor', o.proveedor, 'proveedor_id', o.proveedor_id,
      'factura', x.factura, 'volumen_m3', x.volumen_m3, 'estado', o.estado, 'fecha', o.fecha, 'moneda', o.moneda) order by o.folio) as ordenes
  from public.embarque_oc x join public.v_ordenes_compra o on o.id = x.orden_compra_id
  where x.embarque_id = b.id
) oc on true
left join lateral (
  select count(*) filter (where dd.estado in ('pendiente', 'observado')) as pendientes,
    count(*) filter (where dd.estado in ('pendiente', 'observado') and c.antes_de_arribo) as pendientes_arribo,
    count(*) filter (where dd.estado <> 'no_aplica') as total,
    jsonb_agg(jsonb_build_object('id', dd.id, 'tipo', dd.tipo, 'nombre', c.nombre, 'debe', dd.debe, 'estado', dd.estado,
                                 'antes_de_arribo', c.antes_de_arribo) order by c.orden)
      filter (where dd.estado in ('pendiente', 'observado')) as faltan
  from public.embarque_documentos dd join public.documentos_importacion c on c.tipo = dd.tipo
  where dd.embarque_id = b.id
) d on true
left join lateral public.siguiente_paso_embarque(e.fase, e.fechas, b.modalidad,
  (select jsonb_agg(z) from jsonb_array_elements(d.faltan) z where (z->>'antes_de_arribo')::boolean), b.eta) s on true;

-- Para almacén y el taller: de cada orden de compra, en qué embarque viene, en qué
-- fase va y cuándo llega a planta. Sin montos. Con los permisos del dueño (como
-- v_oc_lineas) porque el taller no ve embarques, pero sí necesita saber cuándo llega.
create or replace view public.v_oc_llegada with (security_invoker = false) as
select distinct on (x.orden_compra_id) x.orden_compra_id, b.id as embarque_id, b.folio, e.fase, b.eta, e.llegada_planta_estimada
from public.embarque_oc x
join public.embarques b on b.id = x.embarque_id and not b.cancelado
join public.v_embarque_etapa e on e.embarque_id = b.id
where public.puede('compras', 1) or public.puede('finanzas', 1) or public.puede('inventario', 2)
   or public.puede('produccion', 2) or public.puede('importaciones', 1)
order by x.orden_compra_id, (e.fase = 'cerrado'), e.llegada_planta_estimada nulls last;

-- -----------------------------------------------------------------------------
-- Dinero (solo quien lo ve)
-- -----------------------------------------------------------------------------
create or replace view public.v_embarque_dinero with (security_invoker = true) as
select b.id as embarque_id, b.folio,
  coalesce(o.comprometido_usd, 0) as comprometido_usd,
  coalesce(p.pagado_usd, 0) as pagado_usd,
  coalesce(p.pagado_mxn, 0) as pagado_mxn,
  coalesce(p.programado_usd, 0) as programado_usd,
  greatest(coalesce(o.comprometido_usd, 0) - coalesce(p.pagado_usd, 0), 0) as por_pagar_usd,
  round(greatest(coalesce(o.comprometido_usd, 0) - coalesce(p.pagado_usd, 0), 0) * public.tc('USD'), 2) as por_pagar_mxn,
  case when coalesce(p.pagado_usd, 0) > 0 then round(p.pagado_mxn / p.pagado_usd, 4) end as tc_promedio,
  coalesce(g.gastos_mxn, 0) as gastos_mxn,
  coalesce(g.iva_mxn, 0) + coalesce(pd.iva, 0) as iva_acreditable_mxn,
  coalesce(pd.impuestos, 0) as impuestos_mxn,
  coalesce(s.por_recuperar_mxn, 0) as por_recuperar_mxn,
  round(coalesce(s.por_recuperar_mxn, 0) / public.tc('USD'), 2) as por_recuperar_usd,
  coalesce(s.recuperado_mxn, 0) as recuperado_mxn
from public.embarques b
left join lateral (
  select sum(oc.total * public.tc(oc.moneda) / public.tc('USD')) as comprometido_usd
  from public.embarque_oc x join public.ordenes_compra oc on oc.id = x.orden_compra_id where x.embarque_id = b.id
) o on true
left join lateral (
  select sum(pg.monto * public.tc(pg.moneda) / public.tc('USD')) filter (where pg.estado in ('pagado', 'retenido', 'confirmado')) as pagado_usd,
    sum(pg.monto_mxn) filter (where pg.estado in ('pagado', 'retenido', 'confirmado')) as pagado_mxn,
    sum(pg.monto * public.tc(pg.moneda) / public.tc('USD')) filter (where pg.estado = 'programado') as programado_usd
  from public.embarque_pagos pg where pg.embarque_id = b.id
) p on true
left join lateral (select sum(gg.monto_mxn) as gastos_mxn, sum(round(gg.iva * gg.tipo_cambio, 2)) as iva_mxn
                   from public.embarque_gastos gg where gg.embarque_id = b.id) g on true
left join lateral (select sum(x.igi + x.dta + x.prv + x.otros) as impuestos, sum(x.iva) as iva
                   from public.pedimentos x where x.embarque_id = b.id) pd on true
left join lateral (
  select sum((ss.monto - coalesce(ss.monto_recuperado, 0)) * ss.tipo_cambio) filter (where ss.recuperado_en is null) as por_recuperar_mxn,
    sum(coalesce(ss.monto_recuperado, 0) * ss.tipo_cambio) filter (where ss.recuperado_en is not null) as recuperado_mxn
  from public.embarque_saldos ss where ss.embarque_id = b.id
) s on true
where (select public.ve_dinero_importacion());

-- Lo que viene por pagar en dólares, por orden (para finanzas: no hay cuenta en
-- USD y todo sale de pesos, así que importa saber cuánto y cuándo).
create or replace view public.v_importacion_por_pagar with (security_invoker = true) as
select x.embarque_id, b.folio as embarque, b.descripcion, e.fase, b.eta, e.llegada_planta_estimada,
  oc.id as orden_compra_id, oc.folio, oc.proveedor_id, pr.nombre as proveedor, x.factura, oc.moneda, oc.total,
  coalesce(p.pagado, 0) as pagado, coalesce(p.programado, 0) as programado,
  oc.total - coalesce(p.pagado, 0) as saldo,
  round((oc.total - coalesce(p.pagado, 0)) * public.tc(oc.moneda), 2) as saldo_mxn,
  p.proximo_pago, p.proximo_monto
from public.embarque_oc x
join public.embarques b on b.id = x.embarque_id and not b.cancelado
join public.v_embarque_etapa e on e.embarque_id = b.id
join public.ordenes_compra oc on oc.id = x.orden_compra_id
join public.proveedores pr on pr.id = oc.proveedor_id
left join lateral (
  select sum(pg.monto) filter (where pg.estado in ('pagado', 'retenido', 'confirmado')) as pagado,
    sum(pg.monto) filter (where pg.estado = 'programado') as programado,
    min(pg.fecha) filter (where pg.estado = 'programado') as proximo_pago,
    (array_agg(pg.monto order by pg.fecha) filter (where pg.estado = 'programado'))[1] as proximo_monto
  from public.embarque_pagos pg where pg.orden_compra_id = oc.id
) p on true
where oc.total - coalesce(p.pagado, 0) > 0.009 and (select public.ve_dinero_importacion());

-- -----------------------------------------------------------------------------
-- Tiempos reales (para medir proveedores y alimentar el reabasto)
-- -----------------------------------------------------------------------------
create or replace view public.v_tiempos_importacion with (security_invoker = true) as
select b.id as embarque_id, b.folio, b.descripcion, b.modalidad, o.proveedor_id, o.proveedor,
  least(o.fecha, (e.fechas->>'pi')::date, (e.fechas->>'anticipo')::date) as inicio,
  (e.fechas->>'zarpe')::date as zarpe, e.arribo, e.en_planta, (e.fechas->>'cuenta_gastos')::date as cuenta_gastos,
  (e.fechas->>'zarpe')::date - least(o.fecha, (e.fechas->>'pi')::date, (e.fechas->>'anticipo')::date) as pedido_a_zarpe,
  e.arribo - (e.fechas->>'zarpe')::date as travesia,
  e.en_planta - e.arribo as puerto_a_planta,
  e.en_planta - least(o.fecha, (e.fechas->>'pi')::date, (e.fechas->>'anticipo')::date) as pedido_a_planta,
  (e.fechas->>'cuenta_gastos')::date - e.en_planta as planta_a_cuenta_gastos
from public.embarques b
join public.v_embarque_etapa e on e.embarque_id = b.id
join public.embarque_oc x on x.embarque_id = b.id
join public.v_ordenes_compra o on o.id = x.orden_compra_id
where not b.cancelado;

-- Tiempo de entrega real por proveedor: mediana de los últimos 5 embarques en
-- planta (3 años), de la orden (o la PI, lo que sea primero: las órdenes a veces
-- se hacen después) a planta. En días hábiles, como los usa el reabasto.
-- Con los permisos del dueño: el reabasto de cualquiera tiene que dar lo mismo.
create or replace function public.entrega_real_proveedores()
returns table (proveedor_id uuid, embarques int, dias_naturales int, dias_habiles int,
               pedido_a_zarpe int, travesia int, puerto_a_planta int, planta_a_cuenta_gastos int)
language sql stable security definer set search_path = public as $$
  with base as (
    select o.proveedor_id, b.id,
      least(o.fecha, (select min(ev.fecha) from embarque_eventos ev where ev.embarque_id = b.id and ev.tipo in ('pi', 'anticipo'))) as inicio,
      (select ev.fecha from embarque_eventos ev where ev.embarque_id = b.id and ev.tipo = 'zarpe') as zarpe,
      (select ev.fecha from embarque_eventos ev where ev.embarque_id = b.id and ev.tipo = 'arribo') as arribo,
      (select ev.fecha from embarque_eventos ev where ev.embarque_id = b.id and ev.tipo = 'en_planta') as en_planta,
      (select ev.fecha from embarque_eventos ev where ev.embarque_id = b.id and ev.tipo = 'cuenta_gastos') as cg
    from embarques b join embarque_oc x on x.embarque_id = b.id join ordenes_compra o on o.id = x.orden_compra_id
    where not b.cancelado
  ),
  ult as (
    select *, row_number() over (partition by proveedor_id order by en_planta desc) n from base
    where en_planta is not null and en_planta >= current_date - interval '3 years' and en_planta >= inicio
  )
  select u.proveedor_id, count(*)::int,
    round(percentile_cont(0.5) within group (order by u.en_planta - u.inicio))::int,
    round(percentile_cont(0.5) within group (order by
      (select count(*) from generate_series(u.inicio + 1, u.en_planta, interval '1 day') d where extract(isodow from d) < 6)))::int,
    round(percentile_cont(0.5) within group (order by u.zarpe - u.inicio))::int,
    round(percentile_cont(0.5) within group (order by u.arribo - u.zarpe))::int,
    round(percentile_cont(0.5) within group (order by u.en_planta - u.arribo))::int,
    round(percentile_cont(0.5) within group (order by u.cg - u.en_planta))::int
  from ult u where u.n <= 5
  group by u.proveedor_id
$$;

create or replace view public.v_tiempos_proveedor with (security_invoker = true) as
select t.*, p.nombre as proveedor, p.pais, p.dias_entrega as dias_entrega_capturados
from public.entrega_real_proveedores() t
join public.proveedores p on p.id = t.proveedor_id
where (select public.puede('importaciones', 1) or public.puede('compras', 1));

-- -----------------------------------------------------------------------------
-- Operaciones
-- -----------------------------------------------------------------------------
-- Registrar (o corregir) la fecha real de una etapa.
create or replace function public.registrar_evento_importacion(p_embarque uuid, p_tipo text, p_fecha date, p_detalle text default null)
returns uuid language plpgsql security invoker set search_path = public as $$
declare v_id uuid;
begin
  if not puede('importaciones', 2) then raise exception 'Solo importaciones registra etapas de embarques' using errcode = '42501'; end if;
  if p_tipo in ('cambio_eta', 'nota') then
    insert into embarque_eventos (embarque_id, tipo, fecha, detalle) values (p_embarque, p_tipo, p_fecha, p_detalle) returning id into v_id;
    return v_id;
  end if;
  if not exists (select 1 from etapas_importacion where tipo = p_tipo) then raise exception 'Etapa desconocida: %', p_tipo; end if;
  update embarque_eventos set fecha = p_fecha, detalle = coalesce(p_detalle, detalle), registrado_por = auth.uid(), registrado_en = now()
  where embarque_id = p_embarque and tipo = p_tipo returning id into v_id;
  if v_id is null then
    insert into embarque_eventos (embarque_id, tipo, fecha, detalle) values (p_embarque, p_tipo, p_fecha, p_detalle) returning id into v_id;
  end if;
  return v_id;
end $$;

create or replace function public.texto_a_numero(t text) returns numeric
language plpgsql immutable as $$
begin
  return nullif(regexp_replace(coalesce(t, ''), '[^0-9.\-]', '', 'g'), '')::numeric;
exception when others then return null;
end $$;

create or replace function public.texto_a_fecha(t text) returns date
language plpgsql immutable as $$
begin
  if t is null or t !~ '^\d{4}-\d{2}-\d{2}$' then return null; end if;
  return t::date;
exception when others then return null;
end $$;

-- Lo que Alondra confirmó de un documento (leído con Claude o capturado a mano):
-- guarda el archivo en su casilla y pasa los datos a donde van. Nada se guarda sin
-- que ella lo confirme: esta función solo la llama el botón "Confirmar y guardar".
create or replace function public.registrar_documento_importacion(p_embarque uuid, p_tipo text, p_archivo text, p_nombre text,
  p_campos jsonb default '{}'::jsonb, p_orden_compra uuid default null, p_tamano int default null)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare
  c jsonb := coalesce(p_campos, '{}'::jsonb); v_doc uuid; v_hechos text[] := '{}'; v_fecha date; v_num numeric;
  b embarques; x jsonb; v_n int := 0; v_hoy date := (now() at time zone 'America/Mexico_City')::date; v_txt text;
begin
  if not puede('importaciones', 2) then raise exception 'Solo importaciones captura documentos de embarques' using errcode = '42501'; end if;
  select * into b from embarques where id = p_embarque;
  if b.id is null then raise exception 'No existe el embarque'; end if;
  if not exists (select 1 from documentos_importacion where tipo = p_tipo) then raise exception 'Tipo de documento desconocido: %', p_tipo; end if;

  if p_archivo is not null then
    select id into v_doc from embarque_documentos where embarque_id = p_embarque and tipo = p_tipo and archivo is null
    order by creado_en limit 1;
    if v_doc is null then
      insert into embarque_documentos (embarque_id, tipo, debe, estado, archivo, archivo_nombre, tamano)
      select p_embarque, p_tipo, debe, 'recibido', p_archivo, p_nombre, p_tamano from documentos_importacion where tipo = p_tipo
      returning id into v_doc;
    else
      update embarque_documentos set archivo = p_archivo, archivo_nombre = p_nombre, tamano = p_tamano, estado = 'recibido'
      where id = v_doc;
    end if;
    v_hechos := v_hechos || 'archivo guardado en su casilla'::text;
  end if;
  -- Subir un archivo sin leerlo (sin campos) solo lo deja en su casilla.
  if c = '{}'::jsonb then
    return jsonb_build_object('documento_id', v_doc, 'hechos', to_jsonb(v_hechos));
  end if;

  if p_tipo in ('pi', 'ci') then
    v_txt := upper(nullif(trim(c->>'incoterm'), ''));
    if b.incoterm is null and v_txt in ('EXW', 'FCA', 'FAS', 'FOB', 'CFR', 'CIF', 'CPT', 'CIP', 'DAP', 'DPU', 'DDP') then
      update embarques set incoterm = v_txt where id = p_embarque;
      v_hechos := v_hechos || ('incoterm ' || v_txt);
    end if;
    if b.puerto_origen is null and nullif(trim(c->>'puerto_origen'), '') is not null then
      update embarques set puerto_origen = trim(c->>'puerto_origen') where id = p_embarque;
      v_hechos := v_hechos || 'puerto de origen'::text;
    end if;
  end if;
  if p_tipo = 'pi' then
    v_fecha := texto_a_fecha(c->>'fecha');
    if v_fecha is not null and v_fecha <= v_hoy and not exists (select 1 from embarque_eventos where embarque_id = p_embarque and tipo = 'pi') then
      insert into embarque_eventos (embarque_id, tipo, fecha, detalle) values (p_embarque, 'pi', v_fecha, nullif(trim(c->>'numero'), ''));
      v_hechos := v_hechos || ('PI del ' || fecha_texto(v_fecha));
    end if;
  elsif p_tipo = 'ci' then
    if p_orden_compra is not null and nullif(trim(c->>'numero'), '') is not null then
      update embarque_oc set factura = trim(c->>'numero') where embarque_id = p_embarque and orden_compra_id = p_orden_compra;
      if found then v_hechos := v_hechos || ('factura ' || trim(c->>'numero') || ' en su orden'); end if;
    end if;
  elsif p_tipo = 'pl' then
    if coalesce(texto_a_numero(c->>'bultos'), texto_a_numero(c->>'peso_bruto_kg'), texto_a_numero(c->>'volumen_m3')) is not null then
      update embarques set bultos = coalesce(texto_a_numero(c->>'bultos')::int, bultos),
        peso_kg = coalesce(texto_a_numero(c->>'peso_bruto_kg'), peso_kg), volumen_m3 = coalesce(texto_a_numero(c->>'volumen_m3'), volumen_m3)
      where id = p_embarque;
      v_hechos := v_hechos || 'bultos, peso y volumen'::text;
    end if;
  elsif p_tipo = 'bl' then
    select string_agg(concat_ws(' ', z->>'numero', nullif(z->>'tipo', ''), case when nullif(z->>'sello', '') is not null then 'sello ' || (z->>'sello') end), ', ')
    into v_txt from jsonb_array_elements(case when jsonb_typeof(c->'contenedores') = 'array' then c->'contenedores' else '[]' end) z
    where nullif(z->>'numero', '') is not null;
    update embarques set bl = coalesce(nullif(trim(c->>'numero_bl'), ''), bl), naviera = coalesce(nullif(trim(c->>'naviera'), ''), naviera),
      buque = coalesce(nullif(trim(c->>'buque'), ''), buque), viaje = coalesce(nullif(trim(c->>'viaje'), ''), viaje),
      puerto_origen = coalesce(puerto_origen, nullif(trim(c->>'puerto_carga'), '')), contenedores = coalesce(v_txt, contenedores),
      bultos = coalesce(bultos, texto_a_numero(c->>'bultos')::int), peso_kg = coalesce(peso_kg, texto_a_numero(c->>'peso_kg')),
      volumen_m3 = coalesce(volumen_m3, texto_a_numero(c->>'volumen_m3'))
    where id = p_embarque;
    v_hechos := v_hechos || 'BL, buque y contenedores'::text;
    v_fecha := texto_a_fecha(c->>'eta');
    if v_fecha is not null and v_fecha is distinct from b.eta then
      update embarques set eta = v_fecha where id = p_embarque;
      v_hechos := v_hechos || ('ETA ' || fecha_texto(v_fecha));
    end if;
    v_fecha := texto_a_fecha(c->>'fecha_embarque');
    if v_fecha is not null and v_fecha <= v_hoy and not exists (select 1 from embarque_eventos where embarque_id = p_embarque and tipo = 'zarpe') then
      insert into embarque_eventos (embarque_id, tipo, fecha, detalle) values (p_embarque, 'zarpe', v_fecha, 'Según el BL');
      v_hechos := v_hechos || ('zarpe del ' || fecha_texto(v_fecha));
    end if;
  elsif p_tipo = 'pedimento' then
    v_fecha := texto_a_fecha(c->>'fecha_pago');
    if nullif(trim(c->>'numero'), '') is null or v_fecha is null then
      raise exception 'Para guardar el pedimento hacen falta su número y la fecha de pago' using errcode = '23514';
    end if;
    insert into pedimentos (embarque_id, numero, clave, aduana, fecha_pago, tipo_cambio, valor_aduana, igi, dta, iva, prv, otros, archivo)
    values (p_embarque, c->>'numero', coalesce(nullif(trim(c->>'clave'), ''), 'A1'), coalesce(nullif(trim(c->>'aduana'), ''), 'Manzanillo'), v_fecha,
            texto_a_numero(c->>'tipo_cambio'), texto_a_numero(c->>'valor_aduana'), coalesce(texto_a_numero(c->>'igi'), 0),
            coalesce(texto_a_numero(c->>'dta'), 0), coalesce(texto_a_numero(c->>'iva'), 0), coalesce(texto_a_numero(c->>'prv'), 0),
            coalesce(texto_a_numero(c->>'otros'), 0), p_archivo);
    v_hechos := v_hechos || ('pedimento ' || (c->>'numero') || ' con sus impuestos');
  elsif p_tipo = 'cuenta_gastos' then
    v_fecha := coalesce(texto_a_fecha(c->>'fecha'), v_hoy);
    if not exists (select 1 from embarque_eventos where embarque_id = p_embarque and tipo = 'cuenta_gastos') then
      insert into embarque_eventos (embarque_id, tipo, fecha, detalle) values (p_embarque, 'cuenta_gastos', least(v_fecha, v_hoy), nullif(trim(c->>'folio'), ''));
      v_hechos := v_hechos || 'etapa cuenta de gastos'::text;
    end if;
    -- Una misma cuenta de gastos confirmada dos veces no duplica gastos.
    if nullif(trim(c->>'folio'), '') is not null and exists (select 1 from embarque_gastos where embarque_id = p_embarque and factura = trim(c->>'folio')) then
      v_hechos := v_hechos || 'los conceptos de esa cuenta de gastos ya estaban capturados'::text;
    else
      for x in select * from jsonb_array_elements(case when jsonb_typeof(c->'conceptos') = 'array' then c->'conceptos' else '[]' end) loop
        -- Los impuestos ya están en el pedimento y el anticipo no es gasto: no se repiten.
        continue when coalesce((x->>'incluir')::boolean, true) = false or x->>'concepto' in ('impuestos', 'anticipo')
                   or coalesce(texto_a_numero(x->>'monto'), 0) <= 0;
        insert into embarque_gastos (embarque_id, concepto, descripcion, proveedor, factura, fecha, moneda, monto, iva, criterio)
        values (p_embarque,
                case when x->>'concepto' in ('flete_internacional', 'seguro', 'cargos_locales', 'revalidacion', 'desconsolidacion', 'maniobras',
                  'almacenaje', 'demoras', 'limpieza', 'honorarios', 'cuenta_gastos', 'flete_local', 'grua') then x->>'concepto' else 'otro' end,
                nullif(trim(x->>'descripcion'), ''), coalesce(nullif(trim(c->>'agente'), ''), b.agente_aduanal), nullif(trim(c->>'folio'), ''),
                least(v_fecha, v_hoy), 'MXN', texto_a_numero(x->>'monto'), coalesce(texto_a_numero(x->>'iva'), 0), 'valor');
        v_n := v_n + 1;
      end loop;
      if v_n > 0 then v_hechos := v_hechos || (v_n || ' gastos para el costeo'); end if;
      v_num := texto_a_numero(c->>'saldo');
      if v_num > 0 then
        insert into embarque_saldos (embarque_id, tipo, descripcion, deudor, monto, fecha_origen)
        values (p_embarque, 'saldo_agente', 'Saldo a favor de la cuenta de gastos ' || coalesce(nullif(trim(c->>'folio'), ''), ''),
                coalesce(nullif(trim(c->>'agente'), ''), b.agente_aduanal, 'Agente aduanal'), v_num, least(v_fecha, v_hoy));
        v_hechos := v_hechos || ('saldo a favor por recuperar ' || texto_dinero(v_num));
      end if;
    end if;
  end if;
  return jsonb_build_object('documento_id', v_doc, 'hechos', to_jsonb(v_hechos));
end $$;

-- -----------------------------------------------------------------------------
-- Costo puesto en planta (módulo costos)
--
-- Por cada partida i:
--   valor_i  = cantidad × precio × TC del proveedor (lo que de verdad costaron los
--              dólares: pesos pagados ÷ dólares, ponderado entre anticipo y saldo)
--   gasto g  se reparte, SIN IVA, según su criterio:
--              valor    → valor_i / Σ valor (de las partidas a las que le toca)
--              volumen  → % de volumen del grupo (proveedor) y, dentro del grupo, por valor
--              directo  → solo a esa partida o artículo
--   costo_i  = valor_i + Σ prorrateo;   unitario = costo_i / cantidad;   factor = Σ prorrateo / valor_i
-- Con todos los gastos por valor es el "factor fijado por valor" de PRORRATEO.xlsx
-- (f = G / V, costo = USD × TC × (1 + f)); con logística por volumen e importación
-- por valor es su método "mixto" del consolidado. Lo que NO se copia es el ÷ 1.16
-- final: el IVA acreditable se deja fuera ANTES de prorratear.
-- Función pura (sin tablas) para poder probarla contra los bloques del Excel.
-- -----------------------------------------------------------------------------
create or replace function public.prorratear_importacion(p_lineas jsonb, p_gastos jsonb, p_volumenes jsonb default '{}'::jsonb)
returns table (i int, valor_mxn numeric, gastos_valor numeric, gastos_volumen numeric, gastos_directos numeric,
               costo_total numeric, costo_unitario numeric, factor numeric)
language plpgsql immutable as $$
#variable_conflict use_column
declare g record; v_alcance numeric; v_n int; v_sin_volumen int;
begin
  if jsonb_typeof(p_lineas) is distinct from 'array' or jsonb_array_length(p_lineas) = 0 then
    raise exception 'No hay partidas que costear' using errcode = '23514';
  end if;
  if exists (select 1 from jsonb_array_elements(p_lineas) x where coalesce((x->>'cantidad')::numeric, 0) <= 0) then
    raise exception 'Cada partida necesita una cantidad mayor a cero' using errcode = '23514';
  end if;
  if coalesce((select sum((x->>'cantidad')::numeric * coalesce((x->>'precio')::numeric, 0) * coalesce((x->>'tipo_cambio')::numeric, 1))
               from jsonb_array_elements(p_lineas) x), 0) <= 0 then
    raise exception 'Sin valor de mercancía no hay contra qué prorratear: revisa precios y tipo de cambio' using errcode = '23514';
  end if;
  -- Ningún gasto se puede perder en el camino: si no le toca a nadie, es un error de captura.
  for g in select coalesce(x->>'descripcion', x->>'concepto', 'un gasto') nombre, coalesce(x->>'criterio', 'valor') criterio,
                  nullif(x->>'grupo', '') grupo, nullif(x->>'articulo_id', '') articulo_id, (x->>'i')::int linea
           from jsonb_array_elements(coalesce(p_gastos, '[]')) x where coalesce((x->>'monto_mxn')::numeric, 0) <> 0 loop
    select sum(l.valor), count(*), count(*) filter (where not coalesce(p_volumenes, '{}') ? l.grupo or coalesce((p_volumenes->>l.grupo)::numeric, 0) <= 0)
    into v_alcance, v_n, v_sin_volumen
    from (select coalesce(y->>'grupo', '') grupo, nullif(y->>'articulo_id', '') articulo_id, (y->>'i')::int i,
                 (y->>'cantidad')::numeric * coalesce((y->>'precio')::numeric, 0) * coalesce((y->>'tipo_cambio')::numeric, 1) valor
          from jsonb_array_elements(p_lineas) y) l
    where (g.grupo is null or l.grupo = g.grupo) and (g.criterio <> 'directo' or l.i = g.linea or l.articulo_id = g.articulo_id);
    if v_n = 0 then
      raise exception 'El gasto "%" no le toca a ninguna partida del embarque', g.nombre using errcode = '23514';
    end if;
    if g.criterio = 'volumen' and v_sin_volumen > 0 then
      raise exception 'Para repartir "%" por volumen falta el volumen (m³) de una de las órdenes del embarque', g.nombre using errcode = '23514';
    end if;
    if g.criterio <> 'volumen' and coalesce(v_alcance, 0) <= 0 then
      raise exception 'El gasto "%" cae en partidas sin valor: no hay cómo repartirlo por valor', g.nombre using errcode = '23514';
    end if;
  end loop;

  return query
  with l as (
    select (x->>'i')::int li, coalesce(x->>'grupo', '') grupo, nullif(x->>'articulo_id', '') articulo_id,
      (x->>'cantidad')::numeric cantidad,
      (x->>'cantidad')::numeric * coalesce((x->>'precio')::numeric, 0) * coalesce((x->>'tipo_cambio')::numeric, 1) valor
    from jsonb_array_elements(p_lineas) x
  ),
  gg as (
    select row_number() over () gid, (x->>'monto_mxn')::numeric monto, coalesce(x->>'criterio', 'valor') criterio,
      nullif(x->>'grupo', '') grupo, nullif(x->>'articulo_id', '') articulo_id, (x->>'i')::int linea
    from jsonb_array_elements(coalesce(p_gastos, '[]')) x where coalesce((x->>'monto_mxn')::numeric, 0) <> 0
  ),
  alc as (
    select gg.gid, gg.monto, gg.criterio, l.li, l.grupo, l.valor
    from gg join l on (gg.grupo is null or l.grupo = gg.grupo)
      and (gg.criterio <> 'directo' or l.li = gg.linea or l.articulo_id = gg.articulo_id)
  ),
  vol as (select key grupo, (value #>> '{}')::numeric v from jsonb_each(coalesce(p_volumenes, '{}'))),
  gv as (
    select a.gid, a.grupo, max(vol.v) v from alc a join vol on vol.grupo = a.grupo where a.criterio = 'volumen' group by a.gid, a.grupo
  ),
  gs as (select gv.gid, gv.grupo, gv.v / sum(gv.v) over (partition by gv.gid) s from gv),
  rep as (
    select a.li, a.criterio,
      case when a.criterio = 'volumen' then
        a.monto * gs.s * case when sum(a.valor) over (partition by a.gid, a.grupo) > 0
                              then a.valor / sum(a.valor) over (partition by a.gid, a.grupo)
                              else 1.0 / count(*) over (partition by a.gid, a.grupo) end
      else a.monto * a.valor / sum(a.valor) over (partition by a.gid) end as monto
    from alc a left join gs on gs.gid = a.gid and gs.grupo = a.grupo
  )
  select l.li, l.valor,
    coalesce(sum(r.monto) filter (where r.criterio = 'valor'), 0),
    coalesce(sum(r.monto) filter (where r.criterio = 'volumen'), 0),
    coalesce(sum(r.monto) filter (where r.criterio = 'directo'), 0),
    l.valor + coalesce(sum(r.monto), 0),
    (l.valor + coalesce(sum(r.monto), 0)) / l.cantidad,
    case when l.valor > 0 then coalesce(sum(r.monto), 0) / l.valor end
  from l left join rep r on r.li = l.li
  group by l.li, l.valor, l.cantidad
  order by l.li;
end $$;

-- TC real de una orden: pesos que salieron ÷ dólares pagados. Lo que falta por
-- pagar se valúa al TC de respaldo (el del pedimento, o el de la orden).
create or replace function public.tc_real_oc(p_oc uuid, p_respaldo numeric default null) returns numeric
language sql stable security definer set search_path = public as $$
  select case when o.moneda = 'MXN' then 1 else coalesce(round(
    (coalesce(sum(p.monto_mxn), 0) + greatest(o.total - coalesce(sum(p.monto), 0), 0) * coalesce(p_respaldo, o.tipo_cambio, tc(o.moneda)))
      / nullif(greatest(o.total, coalesce(sum(p.monto), 0)), 0), 6), p_respaldo, o.tipo_cambio) end
  from ordenes_compra o
  left join embarque_pagos p on p.orden_compra_id = o.id and p.estado in ('pagado', 'retenido', 'confirmado')
  where o.id = p_oc
  group by o.id
$$;

-- Lo que entra a un costeo, en un JSON estable: con él se calcula y con su huella
-- se sabe si algo cambió entre "calcular" y "cerrar".
create or replace function public.insumos_costeo(p_embarque uuid, p_tipo text) returns jsonb
language sql stable security definer set search_path = public as $$
  with tc_ped as (select tipo_cambio from pedimentos where embarque_id = p_embarque and tipo_cambio is not null order by fecha_pago desc limit 1),
  lin as (
    select row_number() over (order by o.folio, l.id)::int as i, l.id as oc_linea_id, o.id as orden_compra_id, l.articulo_id,
      coalesce(a.nombre, l.descripcion, 'Partida sin descripción') as descripcion, o.id::text as grupo, l.cantidad, l.costo_unitario as precio,
      o.moneda, tc_real_oc(o.id, (select tipo_cambio from tc_ped)) as tipo_cambio, o.proveedor_id
    from embarque_oc x join ordenes_compra o on o.id = x.orden_compra_id join oc_lineas l on l.orden_compra_id = o.id
    left join articulos a on a.id = l.articulo_id
    where x.embarque_id = p_embarque
  ),
  gas as (
    select 1 as o1, p.fecha_pago as f, p.id::text as k,
      jsonb_build_object('origen', 'pedimento', 'concepto', 'impuestos', 'descripcion', 'IGI, DTA y PRV · pedimento ' || p.numero,
        'monto_mxn', p.igi + p.dta + p.prv + p.otros, 'iva_mxn', p.iva, 'criterio', 'valor') as g
    from pedimentos p where p.embarque_id = p_embarque and p.igi + p.dta + p.prv + p.otros > 0
    union all
    select 2, e.fecha, e.id::text,
      jsonb_build_object('origen', 'gasto', 'id', e.id, 'concepto', e.concepto,
        'descripcion', coalesce(e.descripcion, nombre_concepto_gasto(e.concepto)), 'proveedor', e.proveedor,
        'monto_mxn', e.monto_mxn, 'iva_mxn', round(e.iva * e.tipo_cambio, 2), 'criterio', e.criterio,
        'grupo', e.orden_compra_id::text, 'articulo_id', e.articulo_id::text, 'estimado', e.estimado)
    from embarque_gastos e where e.embarque_id = p_embarque and (p_tipo = 'preliminar' or not e.estimado)
  )
  select jsonb_build_object(
    'lineas', coalesce((select jsonb_agg(to_jsonb(lin) order by lin.i) from lin), '[]'::jsonb),
    'gastos', coalesce((select jsonb_agg(gas.g order by gas.o1, gas.f, gas.k) from gas), '[]'::jsonb),
    'volumenes', coalesce((select jsonb_object_agg(x.orden_compra_id::text, x.volumen_m3) from embarque_oc x
                           where x.embarque_id = p_embarque and x.volumen_m3 is not null), '{}'::jsonb))
$$;

-- Calcular (o recalcular) el borrador de un costeo.
create or replace function public.calcular_costeo_importacion(p_embarque uuid, p_tipo text) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_ins jsonb; v_id uuid; v_version int;
begin
  if not (puede('importaciones', 2) and puede('costos', 1)) then
    raise exception 'El costeo de importación lo calculan importaciones o compras' using errcode = '42501';
  end if;
  if p_tipo not in ('preliminar', 'final') then raise exception 'El costeo es preliminar o final'; end if;
  if not exists (select 1 from embarques where id = p_embarque) then raise exception 'No existe el embarque'; end if;
  if p_tipo = 'preliminar' and not exists (select 1 from pedimentos where embarque_id = p_embarque) then
    raise exception 'El costeo preliminar se calcula al pagar el pedimento: captura primero el pedimento' using errcode = '23514';
  end if;
  if p_tipo = 'final' and not exists (select 1 from embarque_eventos where embarque_id = p_embarque and tipo = 'cuenta_gastos') then
    raise exception 'El costeo final necesita la cuenta de gastos del agente aduanal: regístrala primero' using errcode = '23514';
  end if;
  v_ins := insumos_costeo(p_embarque, p_tipo);
  if jsonb_array_length(v_ins->'lineas') = 0 then
    raise exception 'El embarque no tiene órdenes de compra con partidas' using errcode = '23514';
  end if;

  delete from costeos_importacion where embarque_id = p_embarque and tipo = p_tipo and estado = 'borrador';
  select coalesce(max(version), 0) + 1 into v_version from costeos_importacion where embarque_id = p_embarque and tipo = p_tipo;
  insert into costeos_importacion (embarque_id, tipo, version, gastos, huella)
  values (p_embarque, p_tipo, v_version, v_ins->'gastos', md5(v_ins::text)) returning id into v_id;

  insert into costeo_importacion_lineas (costeo_id, orden_compra_id, oc_linea_id, articulo_id, descripcion, cantidad, precio, moneda,
    tipo_cambio, valor_mxn, gastos_valor, gastos_volumen, gastos_directos, costo_total, costo_unitario, factor, costo_anterior)
  select v_id, (x->>'orden_compra_id')::uuid, (x->>'oc_linea_id')::uuid, nullif(x->>'articulo_id', '')::uuid, x->>'descripcion',
    (x->>'cantidad')::numeric, (x->>'precio')::numeric, (x->>'moneda')::moneda, (x->>'tipo_cambio')::numeric,
    round(p.valor_mxn, 2), round(p.gastos_valor, 2), round(p.gastos_volumen, 2), round(p.gastos_directos, 2),
    round(p.costo_total, 2), round(p.costo_unitario, 4), round(p.factor, 6),
    (select round(ca.costo * tc(ca.moneda), 4) from costos_articulo ca where ca.articulo_id = nullif(x->>'articulo_id', '')::uuid)
  from jsonb_array_elements(v_ins->'lineas') x
  join prorratear_importacion(v_ins->'lineas', v_ins->'gastos', v_ins->'volumenes') p on p.i = (x->>'i')::int;

  update costeos_importacion c set valor_mxn = t.valor, gastos_mxn = t.gastos, factor = case when t.valor > 0 then round(t.gastos / t.valor, 6) end,
    iva_acreditable = (select coalesce(sum((g->>'iva_mxn')::numeric), 0) from jsonb_array_elements(v_ins->'gastos') g)
      + coalesce((select sum(iva) from pedimentos where embarque_id = p_embarque and igi + dta + prv + otros = 0), 0)
  -- Los gastos se suman de su foto (exactos), no de las partidas redondeadas a centavos.
  from (select (select sum(valor_mxn) from costeo_importacion_lineas where costeo_id = v_id) valor,
               (select coalesce(sum((g->>'monto_mxn')::numeric), 0) from jsonb_array_elements(v_ins->'gastos') g) gastos) t
  where c.id = v_id;
  return v_id;
end $$;

-- Cerrar un costeo. El final cerrado es lo ÚNICO que mueve el costo de un artículo
-- importado: queda en historial con origen "importacion" y el folio del embarque,
-- y el recálculo pone su precio (componentes: costo ÷ 0.70).
create or replace function public.cerrar_costeo_importacion(p_costeo uuid) returns int
language plpgsql security definer set search_path = public as $$
declare c costeos_importacion; v_folio text; v_n int := 0;
begin
  if not (puede('importaciones', 3) or (puede('importaciones', 2) and puede('costos', 2))) then
    raise exception 'Cerrar un costeo cambia costos del catálogo: lo hace importaciones o compras' using errcode = '42501';
  end if;
  select * into c from costeos_importacion where id = p_costeo for update;
  if c.id is null then raise exception 'No existe ese costeo'; end if;
  if c.estado <> 'borrador' then raise exception 'Ese costeo ya está cerrado' using errcode = '23514'; end if;
  if md5(insumos_costeo(c.embarque_id, c.tipo)::text) <> c.huella then
    raise exception 'Cambiaron pagos, gastos o el pedimento desde que se calculó: vuelve a calcular antes de cerrar' using errcode = '23514';
  end if;
  update costeos_importacion set estado = 'cerrado', cerrado_en = now(), cerrado_por = auth.uid() where id = p_costeo;
  if c.tipo = 'final' then
    select folio into v_folio from embarques where id = c.embarque_id;
    perform set_config('erp.origen_costo', 'importacion', true);
    perform set_config('erp.referencia_costo', v_folio || ' · costeo final v' || c.version, true);
    insert into costos_articulo (articulo_id, costo, moneda, proveedor_id, actualizado_en, actualizado_por)
    select l.articulo_id, round(sum(l.costo_unitario * l.cantidad) / sum(l.cantidad), 4), 'MXN',
      (array_agg(o.proveedor_id order by l.cantidad desc))[1], current_date, auth.uid()
    from costeo_importacion_lineas l join ordenes_compra o on o.id = l.orden_compra_id
    where l.costeo_id = p_costeo and l.articulo_id is not null
    group by l.articulo_id
    on conflict (articulo_id) do update set costo = excluded.costo, moneda = excluded.moneda,
      proveedor_id = coalesce(excluded.proveedor_id, costos_articulo.proveedor_id), actualizado_en = current_date,
      actualizado_por = auth.uid();
    get diagnostics v_n = row_count;
    perform set_config('erp.origen_costo', '', true);
    perform set_config('erp.referencia_costo', '', true);
    update costeos_importacion set articulos_actualizados = v_n where id = p_costeo;
    -- Compras e ingeniería: el costo de esos componentes (y el precio de lo que los lleva) cambió.
    if v_n > 0 and to_regproc('public.avisar') is not null then
      perform avisar(array(select usuarios_con_rol('compras') union select usuarios_con_rol('ingenieria')),
        'importacion_costeo_final',
        format('Cambió el costo de %s %s importados', v_n, case when v_n = 1 then 'componente' else 'componentes' end),
        format('Costeo final v%s de %s: costo puesto en planta con flete, impuestos y agente. Los precios ya se recalcularon.', c.version, v_folio),
        '/importaciones/' || c.embarque_id, 'costeos_importacion', p_costeo::text, false);
    end if;
  end if;
  return v_n;
end $$;

-- CORRECCIÓN de 20261003000030 (registrar_historial_costo): ahora guarda la
-- referencia (el folio del embarque) y, si cambió la moneda (USD → MXN al costear
-- una importación), el costo anterior se convierte a la moneda nueva; si no, el
-- historial decía que una pieza de 300 USD "subió 2,000 %" al pasar a $6,500.
create or replace function public.registrar_historial_costo() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' or new.costo is distinct from old.costo or new.moneda is distinct from old.moneda then
    insert into historial_costos (articulo_id, costo_anterior, costo_nuevo, moneda, proveedor_id, origen, referencia)
    values (new.articulo_id,
            case when tg_op = 'UPDATE' then
              case when old.moneda = new.moneda then old.costo else round(old.costo * tc(old.moneda) / tc(new.moneda), 4) end end,
            new.costo, new.moneda, new.proveedor_id,
            coalesce(nullif(current_setting('erp.origen_costo', true), ''), 'manual'),
            nullif(current_setting('erp.referencia_costo', true), ''));
  end if;
  return new;
end $$;

-- -----------------------------------------------------------------------------
-- CORRECCIÓN de 20261003000004 (recibir_orden_compra). Para una orden que viene
-- en un embarque, la recepción ya NO toca el costo del artículo: ponía el precio en
-- USD sin flete, impuestos ni agente (27 % a 109 % abajo del costo real). El costo
-- lo pone el costeo de importación. El movimiento se valúa con el último costeo
-- del embarque si ya existe, y la llegada marca la etapa "en planta": almacén
-- recibe contra el embarque, sin depender de que alguien le avise.
-- Las órdenes sin embarque siguen exactamente igual (30_inventario.sql lo prueba).
-- -----------------------------------------------------------------------------
create or replace function public.recibir_orden_compra(p_oc uuid, p_lineas jsonb, p_factura text default null,
  p_actualizar_costos boolean default true) returns void
language plpgsql security definer set search_path = public as $$
declare o ordenes_compra; l record; v_linea oc_lineas; v_embarque uuid; v_costo numeric;
begin
  if not puede('inventario', 2) then raise exception 'Sin permiso para recibir' using errcode = '42501'; end if;
  select * into o from ordenes_compra where id = p_oc for update;
  if o.estado not in ('enviada', 'parcial') then raise exception 'Solo se reciben órdenes enviadas'; end if;
  select x.embarque_id into v_embarque from embarque_oc x join embarques b on b.id = x.embarque_id
  where x.orden_compra_id = p_oc and not b.cancelado order by x.agregado_en limit 1;
  perform set_config('erp.origen_costo', 'orden_compra', true);

  for l in select (x->>'linea_id')::uuid linea_id, (x->>'cantidad')::numeric cantidad, (x->>'almacen_id')::int almacen_id
           from jsonb_array_elements(p_lineas) x loop
    if l.cantidad is null or l.cantidad <= 0 then continue; end if;
    select * into v_linea from oc_lineas where id = l.linea_id and orden_compra_id = p_oc for update;
    if v_linea.id is null then raise exception 'La partida no pertenece a esta orden'; end if;
    if v_linea.recibido + l.cantidad > v_linea.cantidad * 1.10 then
      raise exception 'Se está recibiendo más de lo pedido (más de 10 %% arriba) en una partida';
    end if;
    update oc_lineas set recibido = recibido + l.cantidad where id = v_linea.id;
    if v_linea.articulo_id is not null then
      v_costo := v_linea.costo_unitario * o.tipo_cambio;
      if v_embarque is not null then
        select cl.costo_unitario into v_costo from costeo_importacion_lineas cl join costeos_importacion c on c.id = cl.costeo_id
        where cl.oc_linea_id = v_linea.id
        order by (c.tipo = 'final') desc, (c.estado = 'cerrado') desc, c.version desc limit 1;
        v_costo := coalesce(v_costo, v_linea.costo_unitario * o.tipo_cambio);
      end if;
      insert into movimientos_inventario (tipo, articulo_id, almacen_id, cantidad, costo_unitario, orden_compra_id, motivo)
      values ('entrada_compra', v_linea.articulo_id, l.almacen_id, l.cantidad, v_costo, p_oc,
              'OC ' || o.folio || coalesce(' · factura ' || p_factura, ''));
      if p_actualizar_costos and v_embarque is null then
        insert into costos_articulo (articulo_id, costo, moneda, proveedor_id, actualizado_en)
        values (v_linea.articulo_id, v_linea.costo_unitario, o.moneda, o.proveedor_id, current_date)
        on conflict (articulo_id) do update set costo = excluded.costo, moneda = excluded.moneda,
          proveedor_id = excluded.proveedor_id, actualizado_en = current_date, actualizado_por = auth.uid()
        where costos_articulo.costo is distinct from excluded.costo or costos_articulo.moneda is distinct from excluded.moneda;
      end if;
    end if;
  end loop;

  update ordenes_compra set
    estado = case when not exists (select 1 from oc_lineas where orden_compra_id = p_oc and recibido < cantidad) then 'recibida' else 'parcial' end,
    factura_proveedor = coalesce(p_factura, factura_proveedor),
    vence_pago = coalesce(vence_pago, current_date + (select dias_credito from proveedores where id = o.proveedor_id))
  where id = p_oc;

  if v_embarque is not null and not exists (select 1 from embarque_eventos where embarque_id = v_embarque and tipo = 'en_planta') then
    insert into embarque_eventos (embarque_id, tipo, fecha, detalle)
    values (v_embarque, 'en_planta', (now() at time zone 'America/Mexico_City')::date, 'Recibida en almacén (OC ' || o.folio || ')');
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- Conexión con almacén: "en tránsito" dice dónde viene y cuándo llega.
--
-- CORRECCIÓN de paso: desde 20261003000069 almacén no puede leer oc_lineas, y
-- esta vista (con los permisos de quien consulta) le daba en_transito = 0 a
-- almacén. Su reabasto pedía otra vez lo que ya venía en camino. Ahora lee las
-- vistas que enmascaran montos pero sí dejan ver cantidades.
-- -----------------------------------------------------------------------------
create or replace view public.v_existencias with (security_invoker = true) as
with transito as (
  select l.articulo_id,
    sum(l.pendiente) as en_transito,
    sum(l.pendiente) filter (where ll.fase in ('cotizando', 'produccion', 'listo')) as en_produccion,
    sum(l.pendiente) filter (where ll.fase = 'transito') as en_mar,
    sum(l.pendiente) filter (where ll.fase in ('puerto', 'planta', 'cerrado')) as en_puerto,
    min(coalesce(ll.llegada_planta_estimada, o.fecha_entrega)) as llegada_estimada
  from public.v_oc_lineas l
  join public.v_ordenes_compra o on o.id = l.orden_compra_id
  left join public.v_oc_llegada ll on ll.orden_compra_id = o.id
  where o.estado in ('enviada', 'parcial') and l.pendiente > 0 and l.articulo_id is not null
  group by l.articulo_id
)
select a.id articulo_id, a.clave, a.nombre, a.unidad, a.tipo, a.es_importado,
  coalesce(sum(e.cantidad) filter (where al.disponible_para_planta), 0) as en_planta,
  coalesce(sum(e.cantidad) filter (where not al.disponible_para_planta), 0) as en_mercadolibre,
  coalesce((select sum(r.cantidad - r.surtido) from public.reservas r where r.articulo_id = a.id and r.estado = 'activa'), 0) as reservado,
  coalesce(max(t.en_transito), 0) as en_transito,
  jsonb_object_agg(al.nombre, e.cantidad) filter (where e.cantidad is not null and e.cantidad <> 0) as por_almacen,
  coalesce(max(t.en_produccion), 0) as en_produccion,
  coalesce(max(t.en_mar), 0) as en_mar,
  coalesce(max(t.en_puerto), 0) as en_puerto,
  max(t.llegada_estimada) as llegada_estimada
from public.articulos a
left join public.existencias e on e.articulo_id = a.id
left join public.almacenes al on al.id = e.almacen_id
left join transito t on t.articulo_id = a.id
where a.controla_inventario and a.tipo in ('componente', 'materia_prima')
group by a.id;

-- Reabasto (de 20261003000060): el tiempo de entrega es el REAL del proveedor (la
-- mediana de sus embarques, de la orden a planta) cuando lo hay. Antes era el
-- número capturado (7 días por defecto en el proveedor, 60 en los importados de la hoja).
create or replace function public.reabasto(p_al date default null)
returns table (
  articulo_id uuid, clave text, nombre text, unidad text, es_importado boolean, proveedor text,
  consumo_meses numeric[], meses_con_consumo int, demanda_mensual numeric, dias_entrega int, meses_cobertura numeric,
  stock_seguridad numeric, punto_reorden numeric, lote numeric, en_planta numeric, reservado numeric, en_transito numeric,
  disponible numeric, sugerido numeric, estado text
)
language sql stable security invoker as $$
  with cfg as (select valor c from configuracion where clave = 'reabasto'),
  hoy as (select date_trunc('month', coalesce(p_al, current_date))::date mes),
  salidas as (
    select m.articulo_id, m.en, -m.cantidad cantidad from movimientos_inventario m
    where m.tipo in ('salida_produccion', 'salida_venta', 'salida_consumo')
    union all
    select h.articulo_id, h.fecha, h.cantidad from historial_movimientos_hoja h
    where h.tipo = 'SALIDA' and h.articulo_id is not null
  ),
  consumo as (
    select s.articulo_id,
      ((extract(year from hoy.mes) - extract(year from s.en)) * 12 + extract(month from hoy.mes) - extract(month from s.en))::int g,
      sum(s.cantidad) total
    from salidas s, hoy
    where s.en >= hoy.mes - interval '12 months' and s.en < hoy.mes
    group by 1, 2
  ),
  real as (select r.proveedor_id, r.dias_habiles from entrega_real_proveedores() r),
  base as (
    select a.id, a.clave, a.nombre, a.unidad, a.es_importado, p.nombre proveedor, a.empaque, a.stock_minimo_fijo,
      (select array_agg(coalesce(c.total, 0) order by g.g desc) from generate_series(1, 12) g(g)
         left join consumo c on c.articulo_id = a.id and c.g = g.g) as consumo_meses,
      coalesce(re.dias_habiles, a.tiempo_entrega_dias, p.dias_entrega, ((select c from cfg)->>'dias_entrega_default')::int) dias,
      coalesce(a.meses_cobertura, case when a.es_importado then ((select c from cfg)->>'meses_cobertura_importado')::numeric
                                       else ((select c from cfg)->>'meses_cobertura_nacional')::numeric end) cobertura
    from articulos a left join proveedores p on p.id = a.proveedor_id
    left join real re on re.proveedor_id = a.proveedor_id
    where a.activo and a.controla_inventario and a.tipo in ('componente', 'materia_prima')
  ),
  calc as (
    select b.*, x.en_planta, x.reservado, x.en_transito, (select c from cfg) c,
      (select count(*) from unnest(b.consumo_meses[7:12]) v where v > 0)::int con_consumo
    from base b join v_existencias x on x.articulo_id = b.id
  ),
  demanda as (
    select calc.*,
      case
        when con_consumo >= (c->>'meses_con_consumo')::int then
          case when c->>'promedio' = 'todos' then (select avg(v) from unnest(consumo_meses[7:12]) v)
               else (select avg(v) from unnest(consumo_meses[7:12]) v where v > 0) end
        when es_importado and (select sum(v) from unnest(consumo_meses) v) > 0 then (select sum(v) from unnest(consumo_meses) v) / 12.0
        else 0 end as dm
    from calc
  ),
  final as (
    select d.*,
      ceil(d.dm / (c->>'dias_habiles_mes')::numeric * d.dias + coalesce(d.stock_minimo_fijo, 0)) as pr,
      ceil(d.dm * d.cobertura) as lt,
      d.en_planta - d.reservado + d.en_transito as disp
    from demanda d
  )
  select f.id, f.clave, f.nombre, f.unidad, f.es_importado, f.proveedor, f.consumo_meses, f.con_consumo,
    round(f.dm, 2), f.dias, f.cobertura, f.stock_minimo_fijo, f.pr, f.lt, f.en_planta, f.reservado, f.en_transito, f.disp,
    case when f.disp < f.pr then ceil((f.lt + f.pr - f.disp) / f.empaque) * f.empaque else 0 end,
    case when f.en_planta < 0 then 'negativo'
         when f.disp < f.pr then 'ordenar'
         when (select sum(v) from unnest(f.consumo_meses) v) = 0 and f.en_planta > 0 and f.stock_minimo_fijo is null then 'excedente'
         else 'ok' end
  from final f
$$;

-- -----------------------------------------------------------------------------
-- Alertas (§9.4). Cada una sale de un problema observado en los correos. Es con
-- los permisos de quien consulta: a almacén no le salen las de dinero.
-- -----------------------------------------------------------------------------
create or replace function public.alertas_importacion()
returns table (embarque_id uuid, folio text, descripcion text, tipo text, tono text, titulo text, detalle text,
               debe text, fecha date, orden int)
language sql stable security invoker as $$
  with hoy as (select (now() at time zone 'America/Mexico_City')::date d),
  b as (
    select e.id, e.folio, e.descripcion, e.modalidad, e.eta, e.etd, e.dias_libres_almacenaje, e.dias_libres_demoras,
      x.fase, x.fechas, x.arribo, x.despacho, x.en_planta, x.vacio, x.dias_en_puerto, x.dias_contenedor
    from public.embarques e join public.v_embarque_etapa x on x.embarque_id = e.id
    where x.fase not in ('cerrado', 'cancelado')
  ),
  faltan as (
    select d.embarque_id, count(*) n,
      case when count(*) = 1 then 'falta 1 documento' else format('faltan %s documentos', count(*)) end faltan,
      string_agg(c.nombre || ' (' || public.nombre_debe(d.debe) || case when d.estado = 'observado' then ', con observaciones' else '' end || ')', ', ' order by c.orden) lista,
      (array_agg(d.debe order by c.orden))[1] debe
    from public.embarque_documentos d join public.documentos_importacion c on c.tipo = d.tipo
    where d.estado in ('pendiente', 'observado') and c.antes_de_arribo
    group by d.embarque_id
  ),
  todas as (
    -- 1. Arribo en 7 días (o ya en puerto) y faltan documentos para el agente.
    select b.id, b.folio, b.descripcion, 'documentos' tipo,
      case when b.arribo is not null or b.eta <= hoy.d + 3 then 'riesgo' else 'atencion' end tono,
      case when b.arribo is not null then format('%s ya está en puerto y %s', b.folio, f.faltan)
           when b.eta <= hoy.d then format('%s llega hoy y %s', b.folio, f.faltan)
           else format('%s llega en %s %s y %s', b.folio, b.eta - hoy.d, case when b.eta - hoy.d = 1 then 'día' else 'días' end, f.faltan) end titulo,
      'Faltan: ' || f.lista || '. El agente los pide antes del arribo; cada día sin ellos es almacenaje.' detalle,
      f.debe, coalesce(b.arribo, b.eta) fecha
    from b join faltan f on f.embarque_id = b.id, hoy
    where b.despacho is null and b.en_planta is null and (b.arribo is not null or b.eta <= hoy.d + 7)
    union all
    -- 2. Días libres de almacenaje: aviso al día 4 de 7.
    select b.id, b.folio, b.descripcion, 'almacenaje',
      case when b.dias_en_puerto >= b.dias_libres_almacenaje then 'riesgo' else 'atencion' end,
      case when b.dias_en_puerto >= b.dias_libres_almacenaje
           then format('%s lleva %s días en puerto: ya pasó sus %s días libres', b.folio, b.dias_en_puerto, b.dias_libres_almacenaje)
           else format('%s: día %s de %s libres en puerto', b.folio, b.dias_en_puerto, b.dias_libres_almacenaje) end,
      format('Llegó el %s. Lo que pase de los días libres se cobra como almacenaje.', public.fecha_texto(b.arribo)),
      'agente', b.arribo + b.dias_libres_almacenaje
    from b, hoy where b.arribo is not null and b.despacho is null and b.en_planta is null
      and b.dias_en_puerto >= b.dias_libres_almacenaje - 3
    union all
    -- 3. Demoras del contenedor: 5 días antes del fin de los días libres.
    select b.id, b.folio, b.descripcion, 'demoras',
      case when b.dias_contenedor >= b.dias_libres_demoras then 'riesgo' else 'atencion' end,
      case when b.dias_contenedor >= b.dias_libres_demoras
           then format('%s: el contenedor ya genera demoras (%s de %s días libres)', b.folio, b.dias_contenedor, b.dias_libres_demoras)
           else format('%s: el contenedor lleva %s de %s días libres', b.folio, b.dias_contenedor, b.dias_libres_demoras) end,
      format('Hay que devolver el vacío antes del %s.', public.fecha_texto(b.arribo + b.dias_libres_demoras)),
      'transportista', b.arribo + b.dias_libres_demoras
    from b where b.modalidad in ('fcl', 'consolidado') and b.arribo is not null and b.vacio is null
      and b.dias_libres_demoras is not null and b.dias_contenedor >= b.dias_libres_demoras - 5
    union all
    -- 4. La ETA cambió (en las últimas 2 semanas).
    select b.id, b.folio, b.descripcion, 'eta',
      case when (ev.datos->>'despues')::date > (ev.datos->>'antes')::date then 'atencion' else 'info' end,
      format('La ETA de %s cambió del %s al %s', b.folio, public.fecha_texto((ev.datos->>'antes')::date), public.fecha_texto((ev.datos->>'despues')::date)),
      case when (ev.datos->>'despues')::date > (ev.datos->>'antes')::date
           then format('%s días después. Avisa a quien espera esta mercancía (ventas, producción).', (ev.datos->>'despues')::date - (ev.datos->>'antes')::date)
           else 'Llega antes: hay que tener listos documentos y transporte.' end,
      'naviera', (ev.datos->>'despues')::date
    from public.embarque_eventos ev join b on b.id = ev.embarque_id
    where ev.tipo = 'cambio_eta' and ev.registrado_en >= now() - interval '14 days' and (ev.datos->>'despues') is not null
    union all
    -- 5. Pagos: sin comprobante, retenidos, sin confirmar del proveedor, programados vencidos.
    select e.id, e.folio, e.descripcion, 'pago',
      case when p.estado = 'retenido' then 'riesgo' else 'atencion' end,
      case when p.estado = 'retenido' then format('Pago de %s %s a %s retenido', p.moneda, to_char(p.monto, 'FM999,999,990'), pr.nombre)
           when p.estado = 'programado' then format('Pago programado de %s %s a %s vencido', p.moneda, to_char(p.monto, 'FM999,999,990'), pr.nombre)
           when p.comprobante is null then format('Pago de %s %s a %s sin comprobante', p.moneda, to_char(p.monto, 'FM999,999,990'), pr.nombre)
           else format('%s no ha confirmado el pago de %s %s', pr.nombre, p.moneda, to_char(p.monto, 'FM999,999,990')) end,
      case when p.estado = 'retenido' then format('Desde el %s (%s días). Hablar con el banco y con el proveedor.', public.fecha_texto(p.fecha), hoy.d - p.fecha)
           when p.estado = 'programado' then format('Tocaba el %s (%s · %s).', public.fecha_texto(p.fecha), e.folio, o.folio)
           when p.comprobante is null then format('Del %s. El agente aduanal pide el comprobante para demostrar el tipo de cambio.', public.fecha_texto(p.fecha))
           else format('Salió el %s. Un pago a Tavol estuvo retenido 38 días sin que nadie lo notara.', public.fecha_texto(p.fecha)) end,
      case when p.estado = 'pagado' and p.comprobante is not null then 'proveedor' else 'hegamex' end, p.fecha
    from public.embarque_pagos p join public.embarques e on e.id = p.embarque_id and not e.cancelado
    join public.ordenes_compra o on o.id = p.orden_compra_id join public.proveedores pr on pr.id = o.proveedor_id, hoy
    where p.estado = 'retenido'
       or (p.estado = 'programado' and p.fecha < hoy.d)
       or (p.estado in ('pagado', 'confirmado') and p.comprobante is null)
       or (p.estado = 'pagado' and p.comprobante is not null and p.confirmado_en is null and p.fecha <= hoy.d - 7)
    union all
    -- 6. Cuenta de gastos que no llega (7 días después de "en planta").
    select b.id, b.folio, b.descripcion, 'cuenta_gastos', 'atencion',
      format('%s: la cuenta de gastos no ha llegado', b.folio),
      format('La mercancía está en planta desde el %s (%s días). Contabilidad la necesita para cerrar.', public.fecha_texto(b.en_planta), hoy.d - b.en_planta),
      'agente', b.en_planta + 7
    from b, hoy where b.en_planta is not null and not b.fechas ? 'cuenta_gastos' and hoy.d - b.en_planta >= 7
    union all
    -- 7. Saldo a favor o garantía sin recuperar.
    select e.id, e.folio, e.descripcion, 'por_recuperar',
      case when hoy.d - s.fecha_esperada > 30 then 'riesgo' else 'atencion' end,
      format('%s de %s sin recuperar (%s)', case s.tipo when 'saldo_agente' then 'Saldo a favor' when 'garantia_contenedor' then 'Garantía de contenedor' else 'Dinero' end,
             case when s.moneda = 'MXN' then public.texto_dinero(s.monto) else s.moneda || ' ' || to_char(s.monto, 'FM999,999,990') end, e.folio),
      format('Se esperaba el %s (%s días tarde) de %s.', public.fecha_texto(s.fecha_esperada), hoy.d - s.fecha_esperada, coalesce(s.deudor, 'quien lo debe')),
      case when s.tipo = 'garantia_contenedor' then 'naviera' else 'agente' end, s.fecha_esperada
    from public.embarque_saldos s join public.embarques e on e.id = s.embarque_id, hoy
    where s.recuperado_en is null and s.fecha_esperada < hoy.d
    union all
    -- 8. EIR que no llega después de devolver el vacío.
    select b.id, b.folio, b.descripcion, 'eir', 'atencion', format('%s: falta el EIR del contenedor', b.folio),
      format('El vacío se devolvió el %s. Sin el EIR no se recupera la garantía.', public.fecha_texto(b.vacio)), 'naviera', b.vacio + 3
    from b join public.embarque_documentos d on d.embarque_id = b.id and d.tipo = 'eir' and d.estado = 'pendiente', hoy
    where b.vacio is not null and hoy.d - b.vacio >= 3
    union all
    -- 9. El proveedor no ha embarcado y el ETD ya pasó (la grúa viajera).
    select b.id, b.folio, b.descripcion, 'sin_avance', 'atencion', format('%s: el ETD era el %s y no ha zarpado', b.folio, public.fecha_texto(b.etd)),
      'Pedir al proveedor fecha real de embarque y fotos de la mercancía.', 'proveedor', b.etd
    from b, hoy where b.fase in ('cotizando', 'produccion', 'listo') and b.etd < hoy.d
    union all
    -- 10. Llegaron gastos después de cerrar el costeo final: hace falta otra versión.
    select e.id, e.folio, e.descripcion, 'costeo', 'atencion', format('%s: hay gastos nuevos después del costeo final', e.folio),
      'Un complemento (almacenaje, demoras, limpieza) cambia el costo: calcula y cierra otra versión del costeo final.', 'hegamex', c.cerrado_en::date
    from public.costeos_importacion c join public.embarques e on e.id = c.embarque_id
    where c.tipo = 'final' and c.estado = 'cerrado'
      and c.version = (select max(c2.version) from public.costeos_importacion c2 where c2.embarque_id = c.embarque_id and c2.tipo = 'final')
      -- Gastos reales que no entraron a ese cálculo (los que entraron están en su foto).
      and exists (select 1 from public.embarque_gastos g where g.embarque_id = c.embarque_id and not g.estimado
                  and not exists (select 1 from jsonb_array_elements(c.gastos) cg where cg->>'id' = g.id::text))
  )
  select t.id, t.folio, t.descripcion, t.tipo, t.tono, t.titulo, t.detalle, t.debe, t.fecha,
    case t.tono when 'riesgo' then 1 when 'atencion' then 2 else 3 end
  from todas t
  order by case t.tono when 'riesgo' then 1 when 'atencion' then 2 else 3 end, t.fecha nulls last, t.folio
$$;

-- -----------------------------------------------------------------------------
-- Hallazgos de importaciones. hallazgos() (20261003000068) junta todas las
-- funciones hallazgos_<área>(p_area); esta trae las alertas más urgentes del
-- tablero, el dinero por recuperar, un aviso a almacén de lo que llega (almacén
-- nunca iba en copia) y uno a finanzas de los dólares por pagar.
-- Con los permisos de quien consulta: a quien no ve dinero no le sale dinero.
-- -----------------------------------------------------------------------------
create or replace function public.hallazgos_importaciones(p_area text default 'direccion')
returns table (area text, tono text, titulo text, detalle text, ruta text, peso int)
language plpgsql stable security invoker as $$
#variable_conflict use_column
declare
  v_hoy date := (now() at time zone 'America/Mexico_City')::date;
  r record; k int; n numeric; m numeric; v_mxn numeric;
begin
  if not puede('importaciones', 1) or p_area not in ('direccion', 'importaciones', 'almacen', 'finanzas', 'compras') then return; end if;

  if p_area in ('direccion', 'importaciones') then
    for r in select a.tono, a.titulo, a.detalle from alertas_importacion() a where a.tono in ('riesgo', 'atencion')
             order by a.orden, a.fecha limit 6 loop
      area := 'importaciones'; tono := r.tono; titulo := r.titulo; detalle := r.detalle; ruta := '/importaciones';
      peso := case r.tono when 'riesgo' then 8 else 28 end;
      return next;
    end loop;
    select count(*) filter (where e.fase not in ('cerrado', 'cancelado')), count(*) filter (where e.fase = 'transito'),
           count(*) filter (where e.fase = 'puerto')
    into k, n, m from v_embarque_etapa e;
    if k > 0 then
      area := 'importaciones'; tono := 'info'; ruta := '/importaciones'; peso := 75;
      titulo := format('%s %s en curso: %s en el mar y %s en puerto', k, case when k = 1 then 'embarque' else 'embarques' end, n, m);
      detalle := 'Las fechas reales de cada etapa están en el tablero; de ahí salen los tiempos por proveedor que usa el reabasto.';
      return next;
    end if;
  end if;

  if ve_dinero_importacion() and p_area in ('direccion', 'importaciones', 'finanzas') then
    select sum(d.por_recuperar_mxn), sum(d.por_pagar_usd), sum(d.por_pagar_mxn) into n, m, v_mxn
    from v_embarque_dinero d join v_embarque_etapa e on e.embarque_id = d.embarque_id where e.fase <> 'cancelado';
    if n > 0 and p_area <> 'finanzas' then
      area := 'importaciones'; tono := 'atencion'; ruta := '/importaciones/dinero'; peso := 32;
      titulo := format('%s por recuperar con agentes y navieras', texto_dinero(n));
      detalle := 'Saldos a favor y garantías de contenedor. Tardan hasta 50 días y siempre después de perseguirlos.';
      return next;
    end if;
    if m > 0 then
      area := 'finanzas'; tono := 'info'; ruta := '/importaciones/dinero'; peso := 36;
      titulo := format('%s por pagar a proveedores del extranjero', texto_usd(m));
      detalle := format('Unos %s al tipo de cambio de hoy. No hay cuenta en dólares: sale de pesos o por EBANX.', texto_dinero(v_mxn));
      return next;
    end if;
  end if;

  if p_area in ('direccion', 'almacen') then
    for r in select b.folio, b.descripcion, b.proveedores, b.llegada_planta_estimada, b.etapa_nombre
             from v_embarques b where b.fase in ('transito', 'puerto') and b.llegada_planta_estimada <= v_hoy + 14
             order by b.llegada_planta_estimada limit 3 loop
      area := 'almacen'; tono := 'info'; ruta := '/importaciones'; peso := 18;
      titulo := format('Llega mercancía importada hacia el %s: %s', fecha_texto(r.llegada_planta_estimada), r.descripcion);
      detalle := format('%s de %s (%s). Conviene preparar espacio y quién recibe.', r.folio,
                        coalesce(r.proveedores, 'proveedor del extranjero'), lower(coalesce(r.etapa_nombre, 'en camino')));
      return next;
    end loop;
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- Avisos en la campana (infraestructura de 20261003000071_avisos_pendientes).
-- Almacén nunca iba en copia de los correos con el agente: ahora le llega el
-- arribo y la salida del puerto, sin montos. Las alertas de Alondra le llegan solas.
-- Todo revisa que avisar() exista, para no tumbar una captura si faltara esa migración.
-- -----------------------------------------------------------------------------
create or replace function public.trg_aviso_etapa_importacion() returns trigger
language plpgsql security definer set search_path = public as $$
declare b embarques; v_llega date;
begin
  if new.tipo not in ('arribo', 'despacho') or to_regproc('public.avisar') is null then return null; end if;
  select * into b from embarques where id = new.embarque_id;
  select llegada_planta_estimada into v_llega from v_embarque_etapa where embarque_id = new.embarque_id;
  if new.tipo = 'arribo' then
    perform avisar(array(select usuarios_con_rol('almacen') union select usuarios_con_rol('compras')),
      'importacion_arribo', format('Llegó a puerto %s: %s', b.folio, b.descripcion),
      format('Arribó el %s a %s. Llegada estimada a planta: %s.', fecha_texto(new.fecha), b.puerto_destino, fecha_texto(v_llega)),
      '/importaciones/' || b.id, 'embarques', b.id::text, true);
  else
    perform avisar(array(select usuarios_con_rol('almacen')),
      'importacion_despacho', format('%s salió del puerto: llega a planta hacia el %s', b.folio, fecha_texto(v_llega)),
      b.descripcion || '. Prepara espacio y quién recibe contra su orden de compra.',
      '/importaciones/' || b.id, 'embarques', b.id::text, true);
  end if;
  return null;
end $$;
drop trigger if exists avisos on public.embarque_eventos;
create trigger avisos after insert on public.embarque_eventos for each row execute function public.trg_aviso_etapa_importacion();

-- Las alertas del tablero, a la campana de importaciones. Cada alerta llega una vez
-- al día mientras siga viva (el título cambia con los días que corren).
create or replace function public.avisos_importacion() returns int
language plpgsql security definer set search_path = public as $$
declare r record; v_n int := 0;
begin
  if to_regproc('public.avisar') is null then return 0; end if;
  for r in select * from alertas_importacion() a where a.tono in ('riesgo', 'atencion') loop
    v_n := v_n + avisar(array(select usuarios_con_rol('importaciones')), 'importacion_' || r.tipo, r.titulo, r.detalle,
      '/importaciones/' || r.embarque_id, 'embarques', r.embarque_id::text || ':' || r.tipo || ':' || left(md5(r.titulo), 8), true);
  end loop;
  return v_n;
end $$;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('avisos-importaciones', '17 * * * *', 'select public.avisos_importacion()');
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- Archivos: bucket privado. Los que traen precios (PI, factura, pedimento, cuenta
-- de gastos, comprobantes) solo los abre quien ve dinero; almacén abre el packing
-- list, el BL o las fichas, que no traen montos. La ruta es <embarque>/<tipo>/<archivo>.
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('importaciones', 'importaciones', false, 26214400,
        array['application/pdf', 'image/jpeg', 'image/png', 'image/webp',
              'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
              'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.puede_ver_archivo_importacion(p_nombre text) returns boolean
language sql stable security definer set search_path = public as $$
  select puede('importaciones', 1) and (ve_dinero_importacion() or exists (
    select 1 from documentos_importacion c where c.tipo = split_part(p_nombre, '/', 2) and not c.con_montos))
$$;

drop policy if exists importaciones_ver on storage.objects;
create policy importaciones_ver on storage.objects for select to authenticated
  using (bucket_id = 'importaciones' and (select public.puede_ver_archivo_importacion(name)));
drop policy if exists importaciones_subir on storage.objects;
create policy importaciones_subir on storage.objects for insert to authenticated
  with check (bucket_id = 'importaciones' and (select public.puede('importaciones', 2)));
drop policy if exists importaciones_cambiar on storage.objects;
create policy importaciones_cambiar on storage.objects for update to authenticated
  using (bucket_id = 'importaciones' and (select public.puede('importaciones', 2)));
drop policy if exists importaciones_borrar on storage.objects;
create policy importaciones_borrar on storage.objects for delete to authenticated
  using (bucket_id = 'importaciones' and (select public.puede('importaciones', 2)));

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.etapas_importacion enable row level security;
alter table public.documentos_importacion enable row level security;
alter table public.embarques enable row level security;
alter table public.embarque_oc enable row level security;
alter table public.embarque_eventos enable row level security;
alter table public.embarque_documentos enable row level security;
alter table public.embarque_pagos enable row level security;
alter table public.embarque_gastos enable row level security;
alter table public.pedimentos enable row level security;
alter table public.embarque_saldos enable row level security;
alter table public.costeos_importacion enable row level security;
alter table public.costeo_importacion_lineas enable row level security;

do $$
declare t text;
begin
  -- Lo que no lleva dinero: lo ve quien ve importaciones (almacén y el taller incluidos).
  foreach t in array array['embarques', 'embarque_oc', 'embarque_eventos', 'embarque_documentos'] loop
    execute format('drop policy if exists ver on public.%I', t);
    execute format('create policy ver on public.%I for select to authenticated using (puede(''importaciones'', 1))', t);
    execute format('drop policy if exists editar on public.%I', t);
  end loop;
  foreach t in array array['embarque_oc', 'embarque_eventos', 'embarque_documentos'] loop
    execute format('create policy editar on public.%I for all to authenticated using (puede(''importaciones'', 2)) with check (puede(''importaciones'', 2))', t);
  end loop;
  -- Dinero: solo quien lo ve.
  foreach t in array array['embarque_pagos', 'embarque_gastos', 'pedimentos', 'embarque_saldos'] loop
    execute format('drop policy if exists ver on public.%I', t);
    execute format('create policy ver on public.%I for select to authenticated using ((select ve_dinero_importacion()))', t);
    execute format('drop policy if exists editar on public.%I', t);
    execute format('drop policy if exists alta on public.%I', t);
    execute format('drop policy if exists cambiar on public.%I', t);
    execute format('drop policy if exists borrar on public.%I', t);
  end loop;
  -- Costeos: módulo costos; solo se escriben con las funciones.
  foreach t in array array['costeos_importacion', 'costeo_importacion_lineas'] loop
    execute format('drop policy if exists ver on public.%I', t);
    execute format('create policy ver on public.%I for select to authenticated using (puede(''costos'', 1))', t);
  end loop;
  foreach t in array array['etapas_importacion', 'documentos_importacion'] loop
    execute format('drop policy if exists ver on public.%I', t);
    execute format('create policy ver on public.%I for select to authenticated using (puede(''importaciones'', 1))', t);
    execute format('drop policy if exists editar on public.%I', t);
  end loop;
end $$;

create policy editar on public.embarques for insert to authenticated with check (puede('importaciones', 2));
drop policy if exists cambiar on public.embarques;
create policy cambiar on public.embarques for update to authenticated using (puede('importaciones', 2)) with check (puede('importaciones', 2));
drop policy if exists borrar on public.embarques;
-- Un embarque con pagos no se borra: se cancela (el dinero no desaparece).
create policy borrar on public.embarques for delete to authenticated
  using (puede('importaciones', 3) and not exists (select 1 from public.embarque_pagos p where p.embarque_id = id));

create policy editar on public.documentos_importacion for all to authenticated using (puede('importaciones', 3)) with check (puede('importaciones', 3));

-- Pagos: importaciones los captura y finanzas también (es quien ejecuta la transferencia).
create policy alta on public.embarque_pagos for insert to authenticated
  with check ((select ve_dinero_importacion()) and (puede('importaciones', 2) or puede('finanzas', 2)));
create policy cambiar on public.embarque_pagos for update to authenticated
  using ((select ve_dinero_importacion()) and (puede('importaciones', 2) or puede('finanzas', 2)))
  with check ((select ve_dinero_importacion()) and (puede('importaciones', 2) or puede('finanzas', 2)));
create policy borrar on public.embarque_pagos for delete to authenticated using (puede('importaciones', 3) or puede('finanzas', 3));

create policy editar on public.embarque_gastos for all to authenticated
  using ((select ve_dinero_importacion()) and puede('importaciones', 2)) with check ((select ve_dinero_importacion()) and puede('importaciones', 2));
create policy editar on public.pedimentos for all to authenticated
  using ((select ve_dinero_importacion()) and puede('importaciones', 2)) with check ((select ve_dinero_importacion()) and puede('importaciones', 2));
create policy editar on public.embarque_saldos for all to authenticated
  using ((select ve_dinero_importacion()) and (puede('importaciones', 2) or puede('finanzas', 2)))
  with check ((select ve_dinero_importacion()) and (puede('importaciones', 2) or puede('finanzas', 2)));

-- Las vistas con permisos del dueño no se exponen a anónimos.
grant select on public.v_oc_llegada to authenticated;
revoke all on public.v_oc_llegada from anon;

-- Bitácora: quién movió qué (pagos, gastos, pedimentos, saldos, costeos, fechas).
do $$
declare t text;
begin
  foreach t in array array['embarques', 'embarque_oc', 'embarque_eventos', 'embarque_pagos', 'embarque_gastos', 'pedimentos',
                           'embarque_saldos', 'costeos_importacion'] loop
    execute format('drop trigger if exists auditar on public.%I', t);
    execute format('create trigger auditar after insert or update or delete on public.%I for each row execute function public.auditar()', t);
  end loop;
end $$;

-- El tablero se mueve solo cuando alguien registra una etapa o un documento.
do $$
declare t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['embarques', 'embarque_eventos', 'embarque_documentos'] loop
      if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  end if;
end $$;

select public.optimizar_politicas();
notify pgrst, 'reload schema';

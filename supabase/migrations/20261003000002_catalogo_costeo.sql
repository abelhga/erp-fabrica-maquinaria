-- =============================================================================
-- Catálogo y costeo de varios niveles.
--
-- Hoy cada equipo es una lista plana en "Nuevo Costeo": para hacer una banda
-- de 22 m se copia la de 20 m y se corrige a mano, y piezas que en realidad son
-- el mismo subensamble (cabezal motriz, tambor de cola…) están repetidas en
-- cada copia. Si sube el precio de una chumacera hay que confiar en que todas
-- las copias la jalen bien.
--
-- Aquí un artículo puede ser comprado (componente, materia prima) o fabricado
-- (subensamble, equipo). Lo fabricado tiene su lista de materiales, que puede
-- incluir otros fabricados, y sus horas por etapa. Las cantidades pueden
-- depender de un parámetro del artículo (largo, ancho…), así que la banda de
-- 22 m es la de 20 m con largo_m = 22.
--
-- Los costos viven en tablas aparte con su propia RLS: quien no tiene permiso
-- de "costos" ve el catálogo y el precio de venta, nunca el costo ni el margen.
-- =============================================================================

create type public.tipo_articulo as enum ('componente', 'materia_prima', 'subensamble', 'equipo', 'servicio');
create type public.moneda as enum ('MXN', 'USD', 'EUR');

-- Panel de utilidad. Reproduce la pestaña "Reglas" de Nuevo Costeo, pero los
-- conceptos son una lista editable (no columnas fijas) y cada cambio queda en
-- la bitácora con fecha y usuario, en vez de una nota a mano en la columna N.
--
--   base   = costo × (1 + Σ recargos_costo) + costo × medida_especial (si aplica)
--   precio = base / (1 − utilidad/(1 − ISR) − Σ recargos_precio)
--
-- Es la forma despejada de la referencia circular de la hoja (que se resolvía
-- con cálculo iterativo); con ella salen idénticos los 476 precios actuales.
create table public.politicas_precio (
  id serial primary key,
  nombre text not null unique,
  utilidad numeric(6,4) not null check (utilidad >= 0 and utilidad < 1),
  -- La "utilidad esperada" de la hoja es neta después de ISR: se divide entre (1 − ISR).
  compensar_isr boolean not null default true,
  recargos_costo jsonb not null default '[]',   -- [{"nombre":"Mermas","pct":0.03}, …]
  recargos_precio jsonb not null default '[]',  -- [{"nombre":"Comisiones","pct":0.03}, …]
  pct_medida_especial numeric(6,4) not null default 0,
  -- [{"hasta":100000,"multiplo":100},{"hasta":null,"multiplo":1000}] → redondeo hacia arriba por tramo
  redondeo jsonb not null default '[{"hasta":null,"multiplo":0.01}]',
  por_defecto_para public.tipo_articulo unique,  -- política que toma un artículo sin categoría
  actualizado_en timestamptz not null default now()
);

do $$
declare
  rc jsonb := '[{"nombre":"Mermas","pct":0.03},{"nombre":"Luz","pct":0.01},{"nombre":"Administrativos y servicios","pct":0.065}]';
  rp jsonb := '[{"nombre":"Uso de Planta Milpillas","pct":0.01},{"nombre":"MKT","pct":0.01},{"nombre":"Rec. tarjeta de crédito","pct":0.0035},{"nombre":"Comisiones","pct":0.03},{"nombre":"Rec. garantía","pct":0.02}]';
  red jsonb := '[{"hasta":100000,"multiplo":100},{"hasta":null,"multiplo":1000}]';
begin
  -- Valores vigentes de Reglas!A4:L14 al 3-oct-2026.
  insert into public.politicas_precio (nombre, utilidad, recargos_costo, recargos_precio, pct_medida_especial, redondeo, por_defecto_para) values
    ('Banda Transportadora', 0.32, rc, rp, 0.10, red, null),
    ('Bazuca', 0.32, rc, rp, 0.10, red, null),
    ('Cribadora', 0.32, rc, rp, 0.10, red, null),
    ('Dosificadora', 0.34, rc, rp, 0.10, red, null),
    ('Silo para Cemento', 0.34, rc, rp, 0.10, red, null),
    ('Tolva', 0.34, rc, rp, 0.10, red, null),
    ('Mezcladora', 0.34, rc, rp, 0.10, red, null),
    ('Elevador', 0.34, rc, rp, 0.10, red, null),
    ('OTRO', 0.32, rc, rp, 0.10, red, 'equipo'),
    ('Baja Utilidad', 0.26, rc, rp, 0, red, null),
    ('ESPECIAL CEMEX', 0.30, rc, rp, 0.10, red, null),
    ('Subensambles', 0.32, rc, rp, 0, red, 'subensamble');
  -- Componentes de reventa: margen simple sobre precio, sin compensar ISR
  -- (ListaComponentes: $735 → $1,050 = 735 / 0.70). Ver informe de compras.
  insert into public.politicas_precio (nombre, utilidad, compensar_isr, por_defecto_para) values
    ('Componentes', 0.30, false, 'componente'),
    ('Materia prima', 0.30, false, 'materia_prima'),
    ('Servicios', 0.30, false, 'servicio');
end $$;

insert into public.configuracion (clave, valor, descripcion) values
  ('isr_compensacion', '0.25', '"ISR recup aprox" de Nuevo Costeo (EQUIPOS!AC1): la utilidad esperada es neta de este ISR.');

create table public.categorias (
  id serial primary key,
  nombre text not null unique,
  descripcion text,
  politica_id int references public.politicas_precio(id),
  creado_en timestamptz not null default now()
);
-- Los tipos de equipo de la hoja son categorías con su política del mismo nombre.
insert into public.categorias (nombre, politica_id) select nombre, id from public.politicas_precio where por_defecto_para is null or nombre = 'OTRO';

create table public.proveedores (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  razon_social text,
  rfc text,
  contacto text,
  telefono text,
  correo text,
  sitio text,
  categoria text,
  pais text not null default 'México',
  es_importacion boolean not null default false,
  moneda public.moneda not null default 'MXN',
  dias_credito int not null default 0,
  dias_entrega int,
  datos_bancarios text,
  notas text,
  activo boolean not null default true,
  legacy_id text unique,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);
create index proveedores_busqueda on public.proveedores using gin (sin_acentos(nombre) extensions.gin_trgm_ops);

create table public.articulos (
  id uuid primary key default gen_random_uuid(),
  clave text not null unique,
  tipo public.tipo_articulo not null,
  nombre text not null,
  descripcion text,                       -- ficha técnica (viñetas), sale en la cotización
  unidad text not null default 'pieza',
  categoria_id int references public.categorias(id),
  familia text,                           -- p.ej. "Banda transportadora", para agrupar variantes
  medida_especial boolean not null default false,  -- suma el recargo de medida especial de su política
  kg_por_unidad numeric(12,4),            -- para reportar consumo de acero en kg (hoy no existe)
  imagen_url text,
  -- Compra / reabasto (sin costos: esos están en costos_articulo)
  proveedor_id uuid references public.proveedores(id),
  tiempo_entrega_dias int,
  es_importado boolean not null default false,
  -- Inventario
  controla_inventario boolean not null default true,
  meses_cobertura numeric(5,2) check (meses_cobertura > 0),   -- null = 1 mes nacional, 6 importado
  stock_minimo_fijo numeric(14,3),                             -- si se pone, manda sobre el cálculo
  ubicacion text,
  -- Venta
  se_vende boolean not null default true,
  -- Datos de origen para reimportar sin duplicar
  legacy_id text unique,
  activo boolean not null default true,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);
create index articulos_busqueda on public.articulos using gin ((sin_acentos(clave || ' ' || nombre)) extensions.gin_trgm_ops);
create index articulos_tipo on public.articulos (tipo) where activo;
create index articulos_familia on public.articulos (familia) where familia is not null;

-- Parámetros de un artículo fabricado: largo_m = 20, ancho_pulg = 24…
create table public.articulo_parametros (
  articulo_id uuid not null references public.articulos(id) on delete cascade,
  nombre text not null check (nombre ~ '^[a-z][a-z0-9_]*$'),
  valor numeric not null,
  unidad text,
  descripcion text,
  primary key (articulo_id, nombre)
);

-- Lista de materiales. cantidad_efectiva = cantidad + por_parametro × valor(parametro)
create table public.bom_lineas (
  id uuid primary key default gen_random_uuid(),
  padre_id uuid not null references public.articulos(id) on delete cascade,
  hijo_id uuid not null references public.articulos(id),
  cantidad numeric(14,4) not null default 0,
  parametro text,
  por_parametro numeric(14,4) not null default 0,
  redondear_arriba boolean not null default false,   -- piezas enteras: 7.3 rodillos son 8
  merma numeric(5,4) not null default 0 check (merma >= 0 and merma < 1),
  grupo text,                                        -- sección dentro de la lista: "Estructura", "Motriz"…
  notas text,
  orden int not null default 0,
  creado_en timestamptz not null default now(),
  check (padre_id <> hijo_id),
  check (parametro is null or parametro ~ '^[a-z][a-z0-9_]*$')
);
create index bom_padre on public.bom_lineas (padre_id, orden);
create index bom_hijo on public.bom_lineas (hijo_id);

-- Etapas del taller. Las mismas que usa producción para planear y la pantalla de piso.
create table public.etapas (
  id serial primary key,
  nombre text not null unique,
  orden int not null,
  color text not null default '#64748b',
  activa boolean not null default true
);
-- Pailería, torno, pintura y detallado son los cuatro oficios con tarifa en
-- Nuevo Costeo; corte, eléctrico, pruebas y embarque se agregan para planear.
insert into public.etapas (nombre, orden, color) values
  ('Corte', 10, '#0ea5e9'), ('Pailería', 20, '#f97316'), ('Torno', 30, '#8b5cf6'),
  ('Pintura', 40, '#ec4899'), ('Detallado', 50, '#22c55e'), ('Eléctrico', 60, '#eab308'),
  ('Pruebas', 70, '#6366f1'), ('Embarque', 80, '#64748b');

-- Horas hombre por etapa de un fabricado (sin contar las de sus subensambles,
-- que ya traen las suyas). Sirve para costear y para planear la carga del taller.
create table public.bom_operaciones (
  id uuid primary key default gen_random_uuid(),
  articulo_id uuid not null references public.articulos(id) on delete cascade,
  etapa_id int not null references public.etapas(id),
  horas numeric(10,2) not null default 0,
  parametro text,
  horas_por_parametro numeric(10,3) not null default 0,
  notas text,
  unique (articulo_id, etapa_id)
);

-- ----------------------------------------------------------------------------
-- Costos (restringidos)
-- ----------------------------------------------------------------------------
create table public.costos_articulo (
  articulo_id uuid primary key references public.articulos(id) on delete cascade,
  costo numeric(14,4) not null check (costo >= 0),
  moneda public.moneda not null default 'MXN',
  proveedor_id uuid references public.proveedores(id),
  actualizado_en date not null default current_date,
  actualizado_por uuid default auth.uid(),
  -- Precio de venta fijado a mano (p.ej. un componente de línea con precio de mercado).
  precio_fijo numeric(14,2),
  margen numeric(6,4) check (margen >= 0 and margen < 1)
);

-- Cada cambio de costo queda aquí: reemplaza la hoja ACTUALIZACIONES y permite
-- ver tendencias por proveedor.
create table public.historial_costos (
  id bigserial primary key,
  articulo_id uuid not null references public.articulos(id) on delete cascade,
  costo_anterior numeric(14,4),
  costo_nuevo numeric(14,4) not null,
  moneda public.moneda not null default 'MXN',
  proveedor_id uuid references public.proveedores(id),
  origen text not null default 'manual' check (origen in ('manual', 'orden_compra', 'importacion', 'cotizacion_proveedor')),
  referencia text,
  usuario_id uuid default auth.uid(),
  en timestamptz not null default now()
);
create index historial_costos_articulo on public.historial_costos (articulo_id, en desc);

create table public.tipos_cambio (
  fecha date not null,
  moneda public.moneda not null check (moneda <> 'MXN'),
  valor numeric(12,4) not null check (valor > 0),
  fuente text default 'manual',
  primary key (fecha, moneda)
);
insert into public.tipos_cambio (fecha, moneda, valor, fuente) values (current_date, 'USD', 18.50, 'inicial'), (current_date, 'EUR', 20.00, 'inicial');

-- Tarifa por hora de cada etapa. En la hoja la mano de obra son 4 "componentes"
-- (horas hombre pailería, tornero, pintor, detallado) con costo de compras;
-- aquí son horas por etapa, que además sirven a producción para planear.
create table public.tarifas_mano_obra (
  etapa_id int primary key references public.etapas(id) on delete cascade,
  costo_hora numeric(10,2) not null check (costo_hora >= 0),
  actualizado_en timestamptz not null default now()
);

-- Resultado del costeo, recalculado por recalcular_costos(). Restringido.
create table public.costos_calculados (
  articulo_id uuid primary key references public.articulos(id) on delete cascade,
  costo_material numeric(16,4) not null default 0,
  costo_mano_obra numeric(16,4) not null default 0,
  costo_total numeric(16,4) not null default 0,
  horas numeric(12,2) not null default 0,
  sin_costo int not null default 0,            -- componentes sin costo capturado dentro de la lista
  costo_mas_viejo date,                        -- fecha del costo más antiguo que lo compone
  calculado_en timestamptz not null default now()
);

-- Precio de lista: lo único que ve ventas.
create table public.precios_lista (
  articulo_id uuid primary key references public.articulos(id) on delete cascade,
  precio numeric(14,2) not null,
  moneda public.moneda not null default 'MXN',
  calculado_en timestamptz not null default now()
);

insert into public.tarifas_mano_obra (etapa_id, costo_hora)
select id, case nombre when 'Pailería' then 87.67 when 'Torno' then 90.80 when 'Pintura' then 80.18
                       when 'Detallado' then 71.94 else 80 end from public.etapas;

-- La hoja solo guarda historial de componentes: de un equipo no se sabe cuánto
-- costaba hace un año ni cuánto de su alza vino de costos y cuánto de subir la
-- utilidad. Aquí cada vez que cambia el costo o el precio queda una foto con la
-- política aplicada, y factor = precio sin redondear / costo. Con eso se puede
-- graficar el precio real y el precio "a utilidad constante" (costo histórico ×
-- factor de hoy) y cruzarlos con las ventas.
create table public.historial_costeo (
  id bigserial primary key,
  articulo_id uuid not null references public.articulos(id) on delete cascade,
  en timestamptz not null default now(),
  costo_material numeric(16,4),
  costo_mano_obra numeric(16,4),
  costo_total numeric(16,4),
  precio_lista numeric(14,2),
  politica_id int,
  utilidad numeric(6,4),
  factor numeric(10,6),
  reconstruido boolean not null default false   -- calculado hacia atrás con la lista de materiales actual
);
create index historial_costeo_articulo on public.historial_costeo (articulo_id, en desc);

-- ----------------------------------------------------------------------------
-- Motor de costeo
-- ----------------------------------------------------------------------------

-- Valor de cambio a MXN más reciente.
create or replace function public.tc(p_moneda public.moneda) returns numeric
language sql stable as $$
  select case when p_moneda = 'MXN' then 1 else
    coalesce((select valor from tipos_cambio where moneda = p_moneda order by fecha desc limit 1), 1) end
$$;

create or replace function public.cantidad_linea(l public.bom_lineas) returns numeric
language sql stable as $$
  select case when l.redondear_arriba then ceil(q) else q end / (1 - l.merma)
  from (select l.cantidad + coalesce(l.por_parametro * (
      select valor from articulo_parametros p where p.articulo_id = l.padre_id and p.nombre = l.parametro), 0) as q) x
$$;

create or replace function public.horas_operacion(o public.bom_operaciones) returns numeric
language sql stable as $$
  select o.horas + coalesce(o.horas_por_parametro * (
    select valor from articulo_parametros p where p.articulo_id = o.articulo_id and p.nombre = o.parametro), 0)
$$;

-- Ciclos (A lleva B y B lleva A) colgarían el costeo: se rechazan al capturar.
create or replace function public.evitar_ciclos_bom() returns trigger
language plpgsql as $$
begin
  if exists (
    with recursive abajo(id) as (
      select new.hijo_id
      union
      select b.hijo_id from bom_lineas b join abajo on b.padre_id = abajo.id
    ) select 1 from abajo where id = new.padre_id
  ) then
    raise exception 'Ese artículo ya contiene a su padre en algún nivel: se formaría un ciclo' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger evitar_ciclos before insert or update of padre_id, hijo_id on public.bom_lineas
  for each row execute function public.evitar_ciclos_bom();

-- Solo lo fabricado lleva lista de materiales.
create or replace function public.validar_padre_bom() returns trigger
language plpgsql as $$
begin
  if (select tipo from articulos where id = new.padre_id) not in ('subensamble', 'equipo') then
    raise exception 'Solo subensambles y equipos llevan lista de materiales' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger validar_padre before insert or update of padre_id on public.bom_lineas
  for each row execute function public.validar_padre_bom();

create or replace function public.redondear_precio(p_precio numeric, p_tramos jsonb) returns numeric
language sql immutable as $$
  select ceil(round(p_precio / m, 6)) * m from (
    select (t->>'multiplo')::numeric m from jsonb_array_elements(p_tramos) t
    where t->>'hasta' is null or p_precio < (t->>'hasta')::numeric
    order by (t->>'hasta')::numeric nulls last limit 1) x
$$;

-- Política que le toca a un artículo: la de su categoría, o la por defecto de su tipo.
create or replace function public.politica_de(p_articulo uuid) returns int
language sql stable as $$
  select coalesce(c.politica_id, (select id from politicas_precio where por_defecto_para = a.tipo))
  from articulos a left join categorias c on c.id = a.categoria_id where a.id = p_articulo
$$;

create or replace function public.precio_sin_redondeo(p_costo numeric, p_politica int, p_utilidad numeric default null,
                                                      p_medida_especial boolean default false)
returns numeric language sql stable as $$
  select case when coalesce(p_costo, 0) = 0 then null else (
    (p_costo * (1 + coalesce((select sum((e->>'pct')::numeric) from jsonb_array_elements(pp.recargos_costo) e), 0))
       + case when p_medida_especial then p_costo * pp.pct_medida_especial else 0 end)
    / (1 - case when pp.compensar_isr
                then coalesce(p_utilidad, pp.utilidad) / (1 - (select valor::text::numeric from configuracion where clave = 'isr_compensacion'))
                else coalesce(p_utilidad, pp.utilidad) end
         - coalesce((select sum((e->>'pct')::numeric) from jsonb_array_elements(pp.recargos_precio) e), 0))) end
  from politicas_precio pp where pp.id = p_politica
$$;

create or replace function public.precio_desde_costo(p_costo numeric, p_politica int, p_utilidad numeric default null,
                                                     p_medida_especial boolean default false)
returns numeric language sql stable as $$
  select redondear_precio(precio_sin_redondeo(p_costo, p_politica, p_utilidad, p_medida_especial), redondeo)
  from politicas_precio where id = p_politica
$$;

-- Recalcula costos y precios de todo de abajo hacia arriba, en conjunto (no
-- artículo por artículo): con ~30 mil líneas tarda milisegundos, así que se
-- puede llamar en cada cambio y los precios "se mueven en tiempo real" como en
-- la hoja, pero sin que nadie tenga que abrirla.
create or replace function public.recalcular_costos() returns int
language plpgsql security definer set search_path = public as $$
declare v_nivel int := 0; v_n int;
begin
  -- Nivel de cada artículo = largo del camino más largo hacia abajo.
  if to_regclass('pg_temp._niveles') is null then
    create temp table _niveles (id uuid primary key, nivel int) on commit drop;
  end if;
  truncate _niveles;
  insert into _niveles
  with recursive camino(id, prof) as (
    select a.id, 0 from articulos a where a.tipo in ('subensamble', 'equipo')
      and not exists (select 1 from bom_lineas b join articulos h on h.id = b.hijo_id
                      where b.padre_id = a.id and h.tipo in ('subensamble', 'equipo'))
    union all
    select b.padre_id, c.prof + 1 from bom_lineas b join camino c on c.id = b.hijo_id
  )
  select id, max(prof) from camino group by id;

  -- Comprados: costo directo convertido a MXN.
  insert into costos_calculados (articulo_id, costo_material, costo_mano_obra, costo_total, horas, sin_costo, costo_mas_viejo, calculado_en)
  select a.id, coalesce(c.costo * tc(c.moneda), 0), 0, coalesce(c.costo * tc(c.moneda), 0), 0,
         case when c.costo is null or c.costo = 0 then 1 else 0 end, c.actualizado_en, now()
  from articulos a left join costos_articulo c on c.articulo_id = a.id
  where a.tipo in ('componente', 'materia_prima', 'servicio')
  on conflict (articulo_id) do update set costo_material = excluded.costo_material, costo_mano_obra = 0,
    costo_total = excluded.costo_total, horas = 0, sin_costo = excluded.sin_costo,
    costo_mas_viejo = excluded.costo_mas_viejo, calculado_en = now();

  -- Fabricados: nivel por nivel, cada uno suma lo de sus hijos ya calculados.
  for v_nivel in 0 .. coalesce((select max(nivel) from _niveles), -1) loop
    insert into costos_calculados (articulo_id, costo_material, costo_mano_obra, costo_total, horas, sin_costo, costo_mas_viejo, calculado_en)
    select n.id,
      coalesce(m.material, 0),
      coalesce(m.mano_obra_hijos, 0) + coalesce(o.costo, 0),
      coalesce(m.material, 0) + coalesce(m.mano_obra_hijos, 0) + coalesce(o.costo, 0),
      coalesce(m.horas_hijos, 0) + coalesce(o.horas, 0),
      coalesce(m.sin_costo, 0),
      m.mas_viejo,
      now()
    from _niveles n
    left join lateral (
      select sum(cantidad_linea(b) * cc.costo_material) material,
             sum(cantidad_linea(b) * cc.costo_mano_obra) mano_obra_hijos,
             sum(cantidad_linea(b) * cc.horas) horas_hijos,
             sum(cc.sin_costo)::int sin_costo,
             min(cc.costo_mas_viejo) mas_viejo
      from bom_lineas b join costos_calculados cc on cc.articulo_id = b.hijo_id
      where b.padre_id = n.id
    ) m on true
    left join lateral (
      select sum(horas_operacion(o)) horas, sum(horas_operacion(o) * coalesce(t.costo_hora, 0)) costo
      from bom_operaciones o left join tarifas_mano_obra t on t.etapa_id = o.etapa_id
      where o.articulo_id = n.id
    ) o on true
    where n.nivel = v_nivel
    on conflict (articulo_id) do update set costo_material = excluded.costo_material,
      costo_mano_obra = excluded.costo_mano_obra, costo_total = excluded.costo_total, horas = excluded.horas,
      sin_costo = excluded.sin_costo, costo_mas_viejo = excluded.costo_mas_viejo, calculado_en = now();
  end loop;

  -- Precios de lista: precio fijo si lo hay; si no, la fórmula de su política.
  if to_regclass('pg_temp._precios') is null then
    create temp table _precios (articulo_id uuid primary key, precio numeric) on commit drop;
  end if;
  truncate _precios;
  insert into _precios
  select a.id, coalesce(c.precio_fijo, precio_desde_costo(cc.costo_total, politica_de(a.id), c.margen, a.medida_especial))
  from articulos a
  join costos_calculados cc on cc.articulo_id = a.id
  left join costos_articulo c on c.articulo_id = a.id
  where a.se_vende and a.activo;
  delete from _precios where precio is null;

  -- Foto de lo que cambió (costo o precio) respecto a la última registrada.
  insert into historial_costeo (articulo_id, costo_material, costo_mano_obra, costo_total, precio_lista, politica_id, utilidad, factor)
  select cc.articulo_id, cc.costo_material, cc.costo_mano_obra, cc.costo_total, n.precio, pol.id,
         coalesce(c.margen, pol.utilidad),
         case when cc.costo_total > 0 then precio_sin_redondeo(cc.costo_total, pol.id, c.margen, a.medida_especial) / cc.costo_total end
  from costos_calculados cc
  join articulos a on a.id = cc.articulo_id
  left join _precios n on n.articulo_id = cc.articulo_id
  left join costos_articulo c on c.articulo_id = cc.articulo_id
  left join politicas_precio pol on pol.id = politica_de(cc.articulo_id)
  left join lateral (select h.costo_total, h.precio_lista from historial_costeo h
                     where h.articulo_id = cc.articulo_id order by h.en desc, h.id desc limit 1) u on true
  where (a.tipo in ('subensamble', 'equipo') or a.se_vende)
    and (u is null or u.costo_total is distinct from round(cc.costo_total, 4) or u.precio_lista is distinct from n.precio);

  insert into precios_lista (articulo_id, precio, moneda, calculado_en)
  select articulo_id, precio, 'MXN', now() from _precios
  on conflict (articulo_id) do update set precio = excluded.precio, calculado_en = now()
  where precios_lista.precio is distinct from excluded.precio;

  delete from precios_lista p where not exists (select 1 from _precios n where n.articulo_id = p.articulo_id);

  get diagnostics v_n = row_count;
  return v_n;
end $$;

-- Reconstruye el costo mensual hacia atrás de cada fabricado con su lista de
-- materiales ACTUAL y los costos históricos de sus componentes (el historial de
-- ACTUALIZACIONES llega a 2019). Responde "si hoy fabricara esta banda con los
-- precios de marzo de 2022, ¿cuánto me costaba?". La mano de obra se toma a la
-- tarifa actual, y no se inventa precio de lista porque la política de utilidad
-- de entonces no está registrada: la gráfica usa el factor de hoy.
create or replace function public.reconstruir_historial_costeo(p_desde date default null) returns int
language plpgsql security definer set search_path = public as $$
declare v_n int;
begin
  delete from historial_costeo where reconstruido;
  with meses as (
    select (generate_series(date_trunc('month', coalesce(p_desde, (select min(en) from historial_costos)::date)),
                            date_trunc('month', now()) - interval '1 month', interval '1 month'))::date mes
  ),
  hojas as (
    select a.id fabricado, e.articulo_id hoja, e.cantidad
    from articulos a cross join lateral explotar_materiales(a.id, 1) e
    where a.tipo in ('subensamble', 'equipo') and a.activo
  ),
  costo_mes as (
    select m.mes, h.hoja, hc.costo
    from meses m cross join (select distinct hoja from hojas) h
    cross join lateral (select costo_nuevo * tc(moneda) costo from historial_costos
                        where articulo_id = h.hoja and en < m.mes + interval '1 month'
                        order by en desc limit 1) hc
  )
  insert into historial_costeo (articulo_id, en, costo_material, costo_mano_obra, costo_total, reconstruido)
  select h.fabricado, (cm.mes + interval '1 month' - interval '1 second'),
         sum(h.cantidad * cm.costo), max(cc.costo_mano_obra), sum(h.cantidad * cm.costo) + max(cc.costo_mano_obra), true
  from hojas h join costo_mes cm on cm.hoja = h.hoja
  join costos_calculados cc on cc.articulo_id = h.fabricado
  group by h.fabricado, cm.mes
  -- Solo meses en que ya había precio de al menos 90 % de sus componentes: antes la cifra engaña.
  having count(*) >= 0.9 * (select count(*) from hojas x where x.fabricado = h.fabricado);
  get diagnostics v_n = row_count;
  return v_n;
end $$;

-- Disparadores a nivel sentencia: una actualización masiva de 500 precios
-- recalcula una sola vez, no 500.
create or replace function public.disparar_recalculo() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform recalcular_costos();
  return null;
end $$;

create trigger recalcular after insert or update or delete on public.costos_articulo for each statement execute function public.disparar_recalculo();
create trigger recalcular after insert or update or delete on public.bom_lineas for each statement execute function public.disparar_recalculo();
create trigger recalcular after insert or update or delete on public.bom_operaciones for each statement execute function public.disparar_recalculo();
create trigger recalcular after insert or update or delete on public.articulo_parametros for each statement execute function public.disparar_recalculo();
create trigger recalcular after insert or update or delete on public.politicas_precio for each statement execute function public.disparar_recalculo();
create trigger recalcular after insert or update or delete on public.tarifas_mano_obra for each statement execute function public.disparar_recalculo();
create trigger recalcular after update of valor on public.configuracion for each statement execute function public.disparar_recalculo();
create trigger recalcular after insert or update or delete on public.tipos_cambio for each statement execute function public.disparar_recalculo();
create trigger recalcular after insert or delete or update of tipo, categoria_id, se_vende, activo, medida_especial on public.articulos for each statement execute function public.disparar_recalculo();
create trigger recalcular after update of politica_id on public.categorias for each statement execute function public.disparar_recalculo();

-- Historial automático de costos: nadie tiene que acordarse de anotarlo.
create or replace function public.registrar_historial_costo() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' or new.costo is distinct from old.costo or new.moneda is distinct from old.moneda then
    insert into historial_costos (articulo_id, costo_anterior, costo_nuevo, moneda, proveedor_id, origen)
    values (new.articulo_id, case when tg_op = 'UPDATE' then old.costo end, new.costo, new.moneda, new.proveedor_id,
            coalesce(current_setting('erp.origen_costo', true), 'manual'));
  end if;
  return new;
end $$;
create trigger historial after insert or update on public.costos_articulo for each row execute function public.registrar_historial_costo();

-- ----------------------------------------------------------------------------
-- Operaciones de ingeniería
-- ----------------------------------------------------------------------------

-- Duplica un fabricado con su lista de materiales, horas y parámetros, y
-- opcionalmente cambia parámetros: "la banda de 20 m, pero de 22 m".
-- Los subensambles NO se copian: se siguen compartiendo.
create or replace function public.duplicar_articulo(p_origen uuid, p_clave text, p_nombre text, p_parametros jsonb default '{}')
returns uuid language plpgsql security invoker as $$
declare v_nuevo uuid; k text; v text;
begin
  if not puede('costeo', 2) then raise exception 'Sin permiso para editar costeo' using errcode = '42501'; end if;
  insert into articulos (clave, tipo, nombre, descripcion, unidad, categoria_id, familia, imagen_url, proveedor_id,
                         tiempo_entrega_dias, es_importado, controla_inventario, se_vende)
  select p_clave, tipo, p_nombre, descripcion, unidad, categoria_id, familia, imagen_url, proveedor_id,
         tiempo_entrega_dias, es_importado, controla_inventario, se_vende
  from articulos where id = p_origen
  returning id into v_nuevo;

  insert into articulo_parametros (articulo_id, nombre, valor, unidad, descripcion)
  select v_nuevo, nombre, coalesce((p_parametros->>nombre)::numeric, valor), unidad, descripcion
  from articulo_parametros where articulo_id = p_origen;
  -- Parámetros nuevos que no tenía el original
  for k, v in select * from jsonb_each_text(p_parametros) loop
    insert into articulo_parametros (articulo_id, nombre, valor) values (v_nuevo, k, v::numeric) on conflict do nothing;
  end loop;

  insert into bom_lineas (padre_id, hijo_id, cantidad, parametro, por_parametro, redondear_arriba, merma, grupo, notas, orden)
  select v_nuevo, hijo_id, cantidad, parametro, por_parametro, redondear_arriba, merma, grupo, notas, orden
  from bom_lineas where padre_id = p_origen;

  insert into bom_operaciones (articulo_id, etapa_id, horas, parametro, horas_por_parametro, notas)
  select v_nuevo, etapa_id, horas, parametro, horas_por_parametro, notas from bom_operaciones where articulo_id = p_origen;

  return v_nuevo;
end $$;

-- Explosión de materiales: hasta las hojas (lo que se compra), multiplicando
-- cantidades por nivel. Es lo que usa producción para validar material.
create or replace function public.explotar_materiales(p_articulo uuid, p_cantidad numeric default 1)
returns table (articulo_id uuid, cantidad numeric, ruta text)
language sql stable as $$
  with recursive arbol(id, cant, ruta) as (
    select p_articulo, p_cantidad::numeric, array[]::text[]
    union all
    select b.hijo_id, arbol.cant * cantidad_linea(b), arbol.ruta || a.nombre
    from arbol join bom_lineas b on b.padre_id = arbol.id join articulos a on a.id = arbol.id
  )
  select arbol.id, sum(arbol.cant), (array_agg(array_to_string(arbol.ruta, ' › ') order by cardinality(arbol.ruta)))[1]
  from arbol join articulos a on a.id = arbol.id
  where a.tipo in ('componente', 'materia_prima') and arbol.id <> p_articulo
  group by arbol.id
$$;

-- "¿Dónde se usa?": todos los fabricados que contienen al artículo, en cualquier nivel.
create or replace function public.donde_se_usa(p_articulo uuid)
returns table (articulo_id uuid, nivel int)
language sql stable as $$
  with recursive arriba(id, nivel) as (
    select padre_id, 1 from bom_lineas where hijo_id = p_articulo
    union
    select b.padre_id, arriba.nivel + 1 from bom_lineas b join arriba on b.hijo_id = arriba.id
  )
  select id, min(nivel) from arriba group by id
$$;

-- Vista sin costos del árbol directo de un fabricado, con la cantidad ya evaluada.
create or replace view public.v_bom with (security_invoker = true) as
select b.*, public.cantidad_linea(b) as cantidad_efectiva, h.clave as hijo_clave, h.nombre as hijo_nombre,
       h.tipo as hijo_tipo, h.unidad as hijo_unidad
from public.bom_lineas b join public.articulos h on h.id = b.hijo_id;

-- ----------------------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------------------
alter table public.categorias enable row level security;
alter table public.proveedores enable row level security;
alter table public.articulos enable row level security;
alter table public.articulo_parametros enable row level security;
alter table public.bom_lineas enable row level security;
alter table public.etapas enable row level security;
alter table public.bom_operaciones enable row level security;
alter table public.costos_articulo enable row level security;
alter table public.historial_costos enable row level security;
alter table public.tipos_cambio enable row level security;
alter table public.politicas_precio enable row level security;
alter table public.tarifas_mano_obra enable row level security;
alter table public.historial_costeo enable row level security;
alter table public.costos_calculados enable row level security;
alter table public.precios_lista enable row level security;

-- Catálogo: lo ve cualquiera con algún rol; lo edita ingeniería/compras.
create policy ver on public.categorias for select to authenticated using (cardinality(mis_roles()) > 0);
create policy editar on public.categorias for all to authenticated using (puede('costeo', 2)) with check (puede('costeo', 2));

create policy ver on public.articulos for select to authenticated using (cardinality(mis_roles()) > 0);
create policy editar on public.articulos for insert to authenticated with check (puede('costeo', 2) or puede('compras', 2));
create policy actualizar on public.articulos for update to authenticated using (puede('costeo', 2) or puede('compras', 2) or puede('inventario', 2));
create policy borrar on public.articulos for delete to authenticated using (puede('costeo', 3));

create policy ver on public.articulo_parametros for select to authenticated using (puede('costeo', 1) or puede('produccion', 1));
create policy editar on public.articulo_parametros for all to authenticated using (puede('costeo', 2)) with check (puede('costeo', 2));

create policy ver on public.bom_lineas for select to authenticated using (puede('costeo', 1) or puede('produccion', 1) or puede('inventario', 1));
create policy editar on public.bom_lineas for all to authenticated using (puede('costeo', 2)) with check (puede('costeo', 2));

create policy ver on public.etapas for select to authenticated using (cardinality(mis_roles()) > 0);
create policy editar on public.etapas for all to authenticated using (puede('produccion', 3)) with check (puede('produccion', 3));

create policy ver on public.bom_operaciones for select to authenticated using (puede('costeo', 1) or puede('produccion', 1));
create policy editar on public.bom_operaciones for all to authenticated using (puede('costeo', 2)) with check (puede('costeo', 2));

create policy ver on public.proveedores for select to authenticated using (puede('compras', 1) or puede('costeo', 1) or puede('inventario', 1) or puede('finanzas', 1));
create policy editar on public.proveedores for all to authenticated using (puede('compras', 2)) with check (puede('compras', 2));

-- Costos: solo quien tiene "costos" (dirección, ingeniería, compras, finanzas).
create policy ver on public.costos_articulo for select to authenticated using (puede('costos', 1));
create policy editar on public.costos_articulo for all to authenticated using (puede('costos', 2)) with check (puede('costos', 2));
create policy ver on public.historial_costos for select to authenticated using (puede('costos', 1));
create policy ver on public.costos_calculados for select to authenticated using (puede('costos', 1));
create policy ver on public.politicas_precio for select to authenticated using (puede('costos', 1));
create policy editar on public.politicas_precio for all to authenticated using (puede('costos', 3)) with check (puede('costos', 3));
create policy ver on public.tarifas_mano_obra for select to authenticated using (puede('costos', 1));
create policy editar on public.tarifas_mano_obra for all to authenticated using (puede('costos', 3)) with check (puede('costos', 3));
create policy ver on public.historial_costeo for select to authenticated using (puede('costos', 1));

create policy ver on public.tipos_cambio for select to authenticated using (cardinality(mis_roles()) > 0);
create policy editar on public.tipos_cambio for all to authenticated using (puede('compras', 2) or puede('finanzas', 2)) with check (puede('compras', 2) or puede('finanzas', 2));

-- Precio de lista: lo ve ventas (y todos los que ven catálogo).
create policy ver on public.precios_lista for select to authenticated using (cardinality(mis_roles()) > 0);

create trigger tocar before update on public.articulos for each row execute function public.tocar_actualizado();
create trigger tocar before update on public.proveedores for each row execute function public.tocar_actualizado();
create trigger auditar after insert or update or delete on public.articulos for each row execute function public.auditar();
create trigger auditar after insert or update or delete on public.bom_lineas for each row execute function public.auditar();
create trigger auditar after insert or update or delete on public.politicas_precio for each row execute function public.auditar();
create trigger auditar after update on public.tarifas_mano_obra for each row execute function public.auditar();
create trigger tocar before update on public.politicas_precio for each row execute function public.tocar_actualizado();
create trigger auditar after insert or update or delete on public.proveedores for each row execute function public.auditar();

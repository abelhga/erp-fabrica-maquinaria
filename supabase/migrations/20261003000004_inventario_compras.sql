-- =============================================================================
-- Inventario y compras.
--
-- Lo que se conserva de las hojas: el stock mínimo que se calcula solo a partir
-- de la demanda (lo más útil que tienen hoy).
-- Lo que se corrige:
--  * Un registro de inventario ya no se puede modificar ni borrar. Si algo no
--    cuadra, se pide un ajuste con su motivo y otra persona lo autoriza; la
--    existencia no cambia hasta entonces. (Hoy el almacenista puede regresar a
--    una fila vieja y cambiarla sin que nadie se entere.)
--  * La fecha la pone el servidor: no se capturan movimientos con fecha atrasada.
--  * Lo apartado es una reserva ligada a su orden o pedido, no un almacén
--    "RESERVADO" que se llena con pares de ajustes.
--  * Los traspasos son traspasos, no un AJUSTE SALIDA + AJUSTE ENTRADA.
--  * Meses de cobertura por artículo: los importados piden 6 meses, no 1.
--  * El stock de seguridad manual sí entra al cálculo (hoy la fórmula lee otra columna).
-- =============================================================================

create type public.tipo_movimiento as enum (
  'inicial',             -- saldo con el que arranca el ERP
  'entrada_compra',      -- recepción de orden de compra
  'devolucion',          -- regresa material de producción o de un cliente
  'salida_produccion',   -- surtido a una orden de producción
  'salida_venta',        -- venta directa de mostrador, ML o web
  'salida_consumo',      -- taller, EPP, uniformes, plasma… (gasto, no equipo)
  'traspaso_salida', 'traspaso_entrada',
  'ajuste_entrada', 'ajuste_salida'   -- solo nacen de un ajuste autorizado
);

create table public.almacenes (
  id serial primary key,
  nombre text not null unique,
  tipo text not null default 'fisico' check (tipo in ('fisico', 'mercadolibre')),
  -- Lo que está en Full de Mercado Libre existe, pero no se puede usar en planta.
  disponible_para_planta boolean not null default true,
  descripcion text,
  activo boolean not null default true
);
-- Los almacenes que aparecen hoy en A·Registro.
insert into public.almacenes (nombre, tipo, disponible_para_planta) values
  ('Planta Baja', 'fisico', true), ('Mallado', 'fisico', true), ('Planta Alta', 'fisico', true),
  ('Contenedor 1', 'fisico', true), ('Contenedor 2', 'fisico', true), ('Revolución', 'fisico', true),
  ('Almacén ML (Full)', 'mercadolibre', false);

alter table public.articulos add column empaque numeric(14,3) not null default 1 check (empaque > 0);  -- se compra en múltiplos de esto
alter table public.articulos add column almacen_preferido_id int references public.almacenes(id);

insert into public.configuracion (clave, valor, descripcion) values
  ('reabasto', '{"meses_historia":6,"meses_con_consumo":3,"promedio":"meses_con_consumo","dias_habiles_mes":22,"dias_entrega_default":7,"meses_cobertura_nacional":1,"meses_cobertura_importado":6}',
   'Regla del stock mínimo. Por defecto es la de la hoja Demanda: un artículo "genera demanda" si tuvo salidas en 3 de los últimos 6 meses y se promedian solo los meses con consumo. promedio = "todos" promedia los 6 meses (más conservador).');

-- ----------------------------------------------------------------------------
-- Movimientos: solo se agregan, nunca se cambian
-- ----------------------------------------------------------------------------
create table public.movimientos_inventario (
  id bigserial primary key,
  tipo public.tipo_movimiento not null,
  articulo_id uuid not null references public.articulos(id),
  almacen_id int not null references public.almacenes(id),
  cantidad numeric(14,3) not null check (cantidad <> 0),   -- con signo: + entra, − sale
  costo_unitario numeric(14,4),
  orden_compra_id uuid,
  orden_produccion_id uuid,
  pedido_id uuid references public.pedidos(id),
  ajuste_id uuid,
  traspaso_id uuid,                                          -- liga la salida y la entrada de un traspaso
  motivo text,
  fuera_de_lista boolean not null default false,             -- salió a una orden sin estar en su lista de materiales
  usuario_id uuid default auth.uid() references public.perfiles(id),
  en timestamptz not null default now(),
  check ((tipo in ('inicial', 'entrada_compra', 'devolucion', 'traspaso_entrada', 'ajuste_entrada') and cantidad > 0)
      or (tipo in ('salida_produccion', 'salida_venta', 'salida_consumo', 'traspaso_salida', 'ajuste_salida') and cantidad < 0))
);
create index movimientos_articulo on public.movimientos_inventario (articulo_id, en desc);
create index movimientos_en on public.movimientos_inventario (en desc);
create index movimientos_op on public.movimientos_inventario (orden_produccion_id) where orden_produccion_id is not null;

create or replace function public.movimientos_inalterables() returns trigger
language plpgsql as $$
begin
  raise exception 'Los movimientos de inventario no se modifican ni se borran. Si hay un error, solicita un ajuste.'
    using errcode = '42501';
end $$;
create trigger inalterable before update or delete on public.movimientos_inventario
  for each row execute function public.movimientos_inalterables();
-- Ni siquiera con TRUNCATE.
create trigger inalterable_truncate before truncate on public.movimientos_inventario
  for each statement execute function public.movimientos_inalterables();

create table public.existencias (
  articulo_id uuid not null references public.articulos(id) on delete cascade,
  almacen_id int not null references public.almacenes(id),
  cantidad numeric(14,3) not null default 0,
  actualizado_en timestamptz not null default now(),
  primary key (articulo_id, almacen_id)
);

create or replace function public.aplicar_movimiento() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_actual numeric;
begin
  -- La fecha es la del servidor, siempre.
  new.en := now();
  new.usuario_id := coalesce(auth.uid(), new.usuario_id);
  select cantidad into v_actual from existencias where articulo_id = new.articulo_id and almacen_id = new.almacen_id for update;
  if new.cantidad < 0 and coalesce(v_actual, 0) + new.cantidad < -0.0005 then
    raise exception 'No hay existencia suficiente de "%" en %: hay %, se quieren sacar %',
      (select nombre from articulos where id = new.articulo_id), (select nombre from almacenes where id = new.almacen_id),
      coalesce(v_actual, 0), -new.cantidad using errcode = '23514';
  end if;
  insert into existencias (articulo_id, almacen_id, cantidad) values (new.articulo_id, new.almacen_id, new.cantidad)
  on conflict (articulo_id, almacen_id) do update set cantidad = existencias.cantidad + excluded.cantidad, actualizado_en = now();
  return new;
end $$;
create trigger aplicar before insert on public.movimientos_inventario for each row execute function public.aplicar_movimiento();

-- ----------------------------------------------------------------------------
-- Reservas
-- ----------------------------------------------------------------------------
create table public.reservas (
  id uuid primary key default gen_random_uuid(),
  articulo_id uuid not null references public.articulos(id),
  cantidad numeric(14,3) not null check (cantidad > 0),
  surtido numeric(14,3) not null default 0,
  orden_produccion_id uuid,
  pedido_id uuid references public.pedidos(id),
  motivo text,
  estado text not null default 'activa' check (estado in ('activa', 'surtida', 'liberada')),
  creado_por uuid default auth.uid() references public.perfiles(id),
  creado_en timestamptz not null default now(),
  check (surtido <= cantidad)
);
create index reservas_activas on public.reservas (articulo_id) where estado = 'activa';

-- ----------------------------------------------------------------------------
-- Ajustes (con autorización) y conteos físicos
-- ----------------------------------------------------------------------------
create table public.ajustes_inventario (
  id uuid primary key default gen_random_uuid(),
  folio text not null default '',
  articulo_id uuid not null references public.articulos(id),
  almacen_id int not null references public.almacenes(id),
  cantidad_sistema numeric(14,3) not null,
  cantidad_fisica numeric(14,3) not null check (cantidad_fisica >= 0),
  diferencia numeric(14,3) generated always as (cantidad_fisica - cantidad_sistema) stored,
  motivo text not null check (length(trim(motivo)) >= 5),
  conteo_id uuid,
  estado text not null default 'pendiente' check (estado in ('pendiente', 'aprobado', 'rechazado')),
  solicitado_por uuid not null default auth.uid() references public.perfiles(id),
  solicitado_en timestamptz not null default now(),
  resuelto_por uuid references public.perfiles(id),
  resuelto_en timestamptz,
  comentario text
);
create index ajustes_pendientes on public.ajustes_inventario (solicitado_en) where estado = 'pendiente';

create table public.conteos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  almacen_id int not null references public.almacenes(id),
  estado text not null default 'abierto' check (estado in ('abierto', 'cerrado')),
  creado_por uuid default auth.uid() references public.perfiles(id),
  creado_en timestamptz not null default now(),
  cerrado_en timestamptz
);
create table public.conteo_lineas (
  conteo_id uuid not null references public.conteos(id) on delete cascade,
  articulo_id uuid not null references public.articulos(id),
  cantidad_contada numeric(14,3) not null check (cantidad_contada >= 0),
  contado_por uuid default auth.uid() references public.perfiles(id),
  en timestamptz not null default now(),
  primary key (conteo_id, articulo_id)
);

-- ----------------------------------------------------------------------------
-- Compras
-- ----------------------------------------------------------------------------
create table public.requisiciones (
  id uuid primary key default gen_random_uuid(),
  folio text not null default '',
  origen text not null default 'manual' check (origen in ('manual', 'reabasto', 'produccion')),
  estado text not null default 'abierta' check (estado in ('abierta', 'en_compra', 'cerrada', 'cancelada')),
  solicitante_id uuid default auth.uid() references public.perfiles(id),
  necesaria_para date,
  notas text,
  creado_en timestamptz not null default now()
);
create table public.requisicion_lineas (
  id uuid primary key default gen_random_uuid(),
  requisicion_id uuid not null references public.requisiciones(id) on delete cascade,
  articulo_id uuid not null references public.articulos(id),
  cantidad numeric(14,3) not null check (cantidad > 0),
  orden_produccion_id uuid,
  estado text not null default 'pendiente' check (estado in ('pendiente', 'ordenada', 'cancelada')),
  oc_linea_id uuid,
  notas text
);

create table public.ordenes_compra (
  id uuid primary key default gen_random_uuid(),
  folio text not null default '' unique,
  proveedor_id uuid not null references public.proveedores(id),
  estado text not null default 'borrador' check (estado in ('borrador', 'enviada', 'parcial', 'recibida', 'cancelada')),
  fecha date not null default (now() at time zone 'America/Mexico_City')::date,
  fecha_entrega date,
  moneda public.moneda not null default 'MXN',
  tipo_cambio numeric(12,4) not null default 1,
  tasa_iva numeric(5,4) not null default 0.16,
  condiciones text,
  notas text,
  factura_proveedor text,
  subtotal numeric(14,2) not null default 0,
  iva numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0,
  vence_pago date,
  creado_por uuid default auth.uid() references public.perfiles(id),
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);
create index oc_estado on public.ordenes_compra (estado, fecha desc);

create table public.oc_lineas (
  id uuid primary key default gen_random_uuid(),
  orden_compra_id uuid not null references public.ordenes_compra(id) on delete cascade,
  articulo_id uuid references public.articulos(id),
  descripcion text,
  cantidad numeric(14,3) not null check (cantidad > 0),
  costo_unitario numeric(14,4) not null check (costo_unitario >= 0),
  recibido numeric(14,3) not null default 0,
  importe numeric(14,2) generated always as (round(cantidad * costo_unitario, 2)) stored
);
create index oc_lineas_articulo on public.oc_lineas (articulo_id);

create table public.pagos_proveedor (
  id uuid primary key default gen_random_uuid(),
  orden_compra_id uuid not null references public.ordenes_compra(id),
  fecha date not null default current_date,
  monto numeric(14,2) not null check (monto > 0),
  metodo text not null default 'transferencia',
  referencia text,
  registrado_por uuid default auth.uid() references public.perfiles(id),
  creado_en timestamptz not null default now()
);

alter table public.movimientos_inventario add constraint mov_oc foreign key (orden_compra_id) references public.ordenes_compra(id);
alter table public.movimientos_inventario add constraint mov_ajuste foreign key (ajuste_id) references public.ajustes_inventario(id);
alter table public.ajustes_inventario add constraint ajuste_conteo foreign key (conteo_id) references public.conteos(id);
alter table public.requisicion_lineas add constraint req_oc foreign key (oc_linea_id) references public.oc_lineas(id) on delete set null;

-- ----------------------------------------------------------------------------
-- Vistas de existencias y reabasto
-- ----------------------------------------------------------------------------
create or replace view public.v_existencias with (security_invoker = true) as
select a.id articulo_id, a.clave, a.nombre, a.unidad, a.tipo, a.es_importado,
  coalesce(sum(e.cantidad) filter (where al.disponible_para_planta), 0) as en_planta,
  coalesce(sum(e.cantidad) filter (where not al.disponible_para_planta), 0) as en_mercadolibre,
  coalesce((select sum(r.cantidad - r.surtido) from public.reservas r where r.articulo_id = a.id and r.estado = 'activa'), 0) as reservado,
  coalesce((select sum(l.cantidad - l.recibido) from public.oc_lineas l join public.ordenes_compra o on o.id = l.orden_compra_id
            where l.articulo_id = a.id and o.estado in ('enviada', 'parcial') and l.cantidad > l.recibido), 0) as en_transito,
  jsonb_object_agg(al.nombre, e.cantidad) filter (where e.cantidad is not null and e.cantidad <> 0) as por_almacen
from public.articulos a
left join public.existencias e on e.articulo_id = a.id
left join public.almacenes al on al.id = e.almacen_id
where a.controla_inventario and a.tipo in ('componente', 'materia_prima')
group by a.id;

-- Demanda y reabasto. Explica cada cifra para que compras sepa POR QUÉ se sugiere.
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
  -- Consumo por artículo en cada uno de los 12 meses cerrados (g = 1 es el mes pasado).
  consumo as (
    select m.articulo_id,
      ((extract(year from hoy.mes) - extract(year from m.en)) * 12 + extract(month from hoy.mes) - extract(month from m.en))::int g,
      -sum(m.cantidad) total
    from movimientos_inventario m, hoy
    where m.tipo in ('salida_produccion', 'salida_venta', 'salida_consumo')
      and m.en >= hoy.mes - interval '12 months' and m.en < hoy.mes
    group by 1, 2
  ),
  base as (
    select a.id, a.clave, a.nombre, a.unidad, a.es_importado, p.nombre proveedor, a.empaque, a.stock_minimo_fijo,
      (select array_agg(coalesce(c.total, 0) order by g.g desc) from generate_series(1, 12) g(g)
         left join consumo c on c.articulo_id = a.id and c.g = g.g) as consumo_meses,
      coalesce(a.tiempo_entrega_dias, p.dias_entrega, ((select c from cfg)->>'dias_entrega_default')::int) dias,
      coalesce(a.meses_cobertura, case when a.es_importado then ((select c from cfg)->>'meses_cobertura_importado')::numeric
                                       else ((select c from cfg)->>'meses_cobertura_nacional')::numeric end) cobertura
    from articulos a left join proveedores p on p.id = a.proveedor_id
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
        -- Importados con consumo esporádico: la hoja los dejaba en cero (sin mínimo ni alerta),
        -- justo las refacciones que tardan meses en llegar. Aquí toman el promedio de 12 meses.
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

-- ----------------------------------------------------------------------------
-- Operaciones de almacén (la única manera de mover existencias)
-- ----------------------------------------------------------------------------
create or replace function public.registrar_salida(p_articulo uuid, p_almacen int, p_cantidad numeric,
  p_tipo public.tipo_movimiento, p_motivo text, p_pedido uuid default null) returns bigint
language plpgsql security definer set search_path = public as $$
declare v_id bigint;
begin
  if not puede('inventario', 2) then raise exception 'Sin permiso para registrar salidas' using errcode = '42501'; end if;
  if p_tipo not in ('salida_venta', 'salida_consumo') then
    raise exception 'Las salidas a producción se registran desde la orden de producción (surtir material)';
  end if;
  if p_cantidad <= 0 then raise exception 'La cantidad debe ser mayor a cero'; end if;
  if coalesce(trim(p_motivo), '') = '' then raise exception 'Escribe para qué o para quién es la salida'; end if;
  insert into movimientos_inventario (tipo, articulo_id, almacen_id, cantidad, motivo, pedido_id, costo_unitario)
  values (p_tipo, p_articulo, p_almacen, -p_cantidad, p_motivo, p_pedido,
          (select costo * tc(moneda) from costos_articulo where articulo_id = p_articulo))
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.registrar_devolucion(p_articulo uuid, p_almacen int, p_cantidad numeric, p_motivo text,
  p_orden_produccion uuid default null) returns bigint
language plpgsql security definer set search_path = public as $$
declare v_id bigint;
begin
  if not puede('inventario', 2) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  if p_cantidad <= 0 then raise exception 'La cantidad debe ser mayor a cero'; end if;
  insert into movimientos_inventario (tipo, articulo_id, almacen_id, cantidad, motivo, orden_produccion_id)
  values ('devolucion', p_articulo, p_almacen, p_cantidad, p_motivo, p_orden_produccion) returning id into v_id;
  return v_id;
end $$;

create or replace function public.traspasar(p_articulo uuid, p_de int, p_a int, p_cantidad numeric, p_motivo text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_t uuid := gen_random_uuid();
begin
  if not puede('inventario', 2) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  if p_de = p_a then raise exception 'El almacén de origen y destino son el mismo'; end if;
  if p_cantidad <= 0 then raise exception 'La cantidad debe ser mayor a cero'; end if;
  insert into movimientos_inventario (tipo, articulo_id, almacen_id, cantidad, traspaso_id, motivo)
  values ('traspaso_salida', p_articulo, p_de, -p_cantidad, v_t, p_motivo),
         ('traspaso_entrada', p_articulo, p_a, p_cantidad, v_t, p_motivo);
  return v_t;
end $$;

create or replace function public.solicitar_ajuste(p_articulo uuid, p_almacen int, p_cantidad_fisica numeric, p_motivo text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not puede('inventario', 2) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  insert into ajustes_inventario (folio, articulo_id, almacen_id, cantidad_sistema, cantidad_fisica, motivo)
  values (siguiente_folio('AJU'), p_articulo, p_almacen,
          coalesce((select cantidad from existencias where articulo_id = p_articulo and almacen_id = p_almacen), 0),
          p_cantidad_fisica, p_motivo)
  returning id into v_id;
  return v_id;
end $$;

-- Autorizar: lo hace alguien distinto de quien lo pidió. La diferencia se
-- aplica contra la existencia de HOY (pudo haber movimientos entre la solicitud y la autorización).
create or replace function public.resolver_ajuste(p_ajuste uuid, p_aprobar boolean, p_comentario text default null)
returns void language plpgsql security definer set search_path = public as $$
declare a ajustes_inventario; v_dif numeric; v_actual numeric;
begin
  if not (puede('inventario', 3) or tiene_rol('direccion') or tiene_rol('gerente_produccion')) then
    raise exception 'Solo la gerencia autoriza ajustes de inventario' using errcode = '42501';
  end if;
  select * into a from ajustes_inventario where id = p_ajuste for update;
  if a.estado <> 'pendiente' then raise exception 'Este ajuste ya fue resuelto'; end if;
  if a.solicitado_por = auth.uid() and not tiene_rol('direccion') then
    raise exception 'Un ajuste lo autoriza alguien distinto de quien lo pidió' using errcode = '42501';
  end if;
  if p_aprobar then
    select coalesce(cantidad, 0) into v_actual from existencias where articulo_id = a.articulo_id and almacen_id = a.almacen_id;
    v_dif := a.cantidad_fisica - coalesce(v_actual, 0);
    if v_dif <> 0 then
      insert into movimientos_inventario (tipo, articulo_id, almacen_id, cantidad, ajuste_id, motivo, costo_unitario)
      values (case when v_dif > 0 then 'ajuste_entrada'::tipo_movimiento else 'ajuste_salida'::tipo_movimiento end,
              a.articulo_id, a.almacen_id, v_dif, a.id, a.motivo,
              (select costo * tc(moneda) from costos_articulo where articulo_id = a.articulo_id));
    end if;
  end if;
  update ajustes_inventario set estado = case when p_aprobar then 'aprobado' else 'rechazado' end,
    resuelto_por = auth.uid(), resuelto_en = now(), comentario = p_comentario
  where id = p_ajuste;
end $$;

-- Cerrar un conteo convierte cada diferencia en una solicitud de ajuste.
create or replace function public.cerrar_conteo(p_conteo uuid) returns int
language plpgsql security definer set search_path = public as $$
declare c conteos; v_n int;
begin
  if not puede('inventario', 2) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  select * into c from conteos where id = p_conteo for update;
  if c.estado <> 'abierto' then raise exception 'El conteo ya está cerrado'; end if;
  insert into ajustes_inventario (folio, articulo_id, almacen_id, cantidad_sistema, cantidad_fisica, motivo, conteo_id)
  select siguiente_folio('AJU'), l.articulo_id, c.almacen_id, coalesce(e.cantidad, 0), l.cantidad_contada,
         'Conteo físico: ' || c.nombre, c.id
  from conteo_lineas l left join existencias e on e.articulo_id = l.articulo_id and e.almacen_id = c.almacen_id
  where l.conteo_id = p_conteo and l.cantidad_contada <> coalesce(e.cantidad, 0);
  get diagnostics v_n = row_count;
  update conteos set estado = 'cerrado', cerrado_en = now() where id = p_conteo;
  return v_n;
end $$;

-- Recepción de una orden de compra: entra al inventario y, si el costo cambió,
-- actualiza el costo del artículo (queda en historial con origen "orden_compra").
-- Así el costeo se mueve con lo que de verdad se pagó, sin que nadie lo recapture.
create or replace function public.recibir_orden_compra(p_oc uuid, p_lineas jsonb, p_factura text default null,
  p_actualizar_costos boolean default true) returns void
language plpgsql security definer set search_path = public as $$
declare o ordenes_compra; l record; v_linea oc_lineas;
begin
  if not puede('inventario', 2) then raise exception 'Sin permiso para recibir' using errcode = '42501'; end if;
  select * into o from ordenes_compra where id = p_oc for update;
  if o.estado not in ('enviada', 'parcial') then raise exception 'Solo se reciben órdenes enviadas'; end if;
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
      insert into movimientos_inventario (tipo, articulo_id, almacen_id, cantidad, costo_unitario, orden_compra_id, motivo)
      values ('entrada_compra', v_linea.articulo_id, l.almacen_id, l.cantidad, v_linea.costo_unitario * o.tipo_cambio, p_oc,
              'OC ' || o.folio || coalesce(' · factura ' || p_factura, ''));
      if p_actualizar_costos then
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
end $$;

create or replace function public.totales_oc(p_id uuid) returns void
language sql security definer set search_path = public as $$
  update ordenes_compra o set subtotal = t.s, iva = round(t.s * o.tasa_iva, 2), total = t.s + round(t.s * o.tasa_iva, 2)
  from (select coalesce(sum(importe), 0) s from oc_lineas where orden_compra_id = p_id) t where o.id = p_id
$$;
create or replace function public.trg_oc_lineas() returns trigger
language plpgsql security definer set search_path = public as $$
begin perform totales_oc(coalesce(new.orden_compra_id, old.orden_compra_id)); return null; end $$;
create trigger totales after insert or delete or update of cantidad, costo_unitario on public.oc_lineas
  for each row execute function public.trg_oc_lineas();

create or replace function public.trg_folio() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(new.folio, '') = '' then new.folio := siguiente_folio(tg_argv[0]); end if;
  return new;
end $$;
create trigger folio before insert on public.ordenes_compra for each row execute function public.trg_folio('OC');
create trigger folio before insert on public.requisiciones for each row execute function public.trg_folio('REQ');

-- Sugerencia de reabasto → órdenes de compra en borrador, una por proveedor.
create or replace function public.generar_oc_desde_reabasto(p_articulos uuid[]) returns int
language plpgsql security definer set search_path = public as $$
declare v_prov uuid; v_oc uuid; v_n int := 0;
begin
  if not puede('compras', 2) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  for v_prov in select distinct coalesce(c.proveedor_id, a.proveedor_id) from articulos a
                left join costos_articulo c on c.articulo_id = a.id
                where a.id = any(p_articulos) and coalesce(c.proveedor_id, a.proveedor_id) is not null loop
    insert into ordenes_compra (proveedor_id, notas) values (v_prov, 'Generada desde reabasto') returning id into v_oc;
    insert into oc_lineas (orden_compra_id, articulo_id, descripcion, cantidad, costo_unitario)
    select v_oc, r.articulo_id, r.nombre, r.sugerido, coalesce(c.costo, 0)
    from reabasto() r join articulos a on a.id = r.articulo_id left join costos_articulo c on c.articulo_id = a.id
    where r.articulo_id = any(p_articulos) and r.sugerido > 0 and coalesce(c.proveedor_id, a.proveedor_id) = v_prov;
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;

-- ----------------------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------------------
alter table public.almacenes enable row level security;
alter table public.movimientos_inventario enable row level security;
alter table public.existencias enable row level security;
alter table public.reservas enable row level security;
alter table public.ajustes_inventario enable row level security;
alter table public.conteos enable row level security;
alter table public.conteo_lineas enable row level security;
alter table public.requisiciones enable row level security;
alter table public.requisicion_lineas enable row level security;
alter table public.ordenes_compra enable row level security;
alter table public.oc_lineas enable row level security;
alter table public.pagos_proveedor enable row level security;

create policy ver on public.almacenes for select to authenticated using (cardinality(mis_roles()) > 0);
create policy editar on public.almacenes for all to authenticated using (puede('inventario', 3)) with check (puede('inventario', 3));

-- Movimientos y existencias: se leen; NO hay política de escritura. Solo las
-- funciones de arriba (security definer) pueden insertar.
-- Los movimientos llevan costo unitario: no basta "ver inventario" (eso lo
-- tienen los vendedores para consultar existencias). Lo atrapó 30_inventario.sql.
create policy ver on public.movimientos_inventario for select to authenticated
  using (puede('inventario', 2) or puede('costos', 1));
-- Existencias: las ve también ventas (el BUSCADOR de hoy muestra "stock en planta").
create policy ver on public.existencias for select to authenticated using (puede('inventario', 1) or puede('ventas', 1));
create policy ver on public.reservas for select to authenticated using (puede('inventario', 1) or puede('produccion', 1));

create policy ver on public.ajustes_inventario for select to authenticated using (puede('inventario', 1));
create policy ver on public.conteos for select to authenticated using (puede('inventario', 1));
create policy alta on public.conteos for insert to authenticated with check (puede('inventario', 2));
create policy ver on public.conteo_lineas for select to authenticated using (puede('inventario', 1));
create policy editar on public.conteo_lineas for all to authenticated
  using (puede('inventario', 2) and exists (select 1 from conteos c where c.id = conteo_id and c.estado = 'abierto'))
  with check (puede('inventario', 2) and exists (select 1 from conteos c where c.id = conteo_id and c.estado = 'abierto'));

create policy ver on public.requisiciones for select to authenticated using (puede('compras', 1) or puede('produccion', 2) or puede('inventario', 2));
create policy editar on public.requisiciones for all to authenticated using (puede('compras', 2) or puede('produccion', 2) or puede('inventario', 2))
  with check (puede('compras', 2) or puede('produccion', 2) or puede('inventario', 2));
create policy ver on public.requisicion_lineas for select to authenticated using (puede('compras', 1) or puede('produccion', 2) or puede('inventario', 2));
create policy editar on public.requisicion_lineas for all to authenticated using (puede('compras', 2) or puede('produccion', 2) or puede('inventario', 2))
  with check (puede('compras', 2) or puede('produccion', 2) or puede('inventario', 2));

-- Órdenes de compra: el almacén las ve (para recibir) pero no ve costos si no tiene "costos".
create policy ver on public.ordenes_compra for select to authenticated using (puede('compras', 1) or puede('finanzas', 1));
create policy editar on public.ordenes_compra for all to authenticated using (puede('compras', 2)) with check (puede('compras', 2));
create policy ver on public.oc_lineas for select to authenticated using (puede('compras', 1) or puede('finanzas', 1));
create policy editar on public.oc_lineas for all to authenticated
  using (puede('compras', 2) and exists (select 1 from ordenes_compra o where o.id = orden_compra_id and o.estado = 'borrador'))
  with check (puede('compras', 2) and exists (select 1 from ordenes_compra o where o.id = orden_compra_id and o.estado = 'borrador'));
create policy ver on public.pagos_proveedor for select to authenticated using (puede('finanzas', 1) or puede('compras', 1));
create policy editar on public.pagos_proveedor for all to authenticated using (puede('finanzas', 2)) with check (puede('finanzas', 2));

create trigger tocar before update on public.ordenes_compra for each row execute function public.tocar_actualizado();
create trigger auditar after insert or update or delete on public.ordenes_compra for each row execute function public.auditar();
create trigger auditar after insert or update or delete on public.ajustes_inventario for each row execute function public.auditar();
create trigger auditar after insert or update or delete on public.almacenes for each row execute function public.auditar();
create trigger auditar after insert or update or delete on public.pagos_proveedor for each row execute function public.auditar();

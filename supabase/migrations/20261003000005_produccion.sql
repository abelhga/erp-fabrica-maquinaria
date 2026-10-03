-- =============================================================================
-- Producción: órdenes, validación de material, surtido y avance por etapa.
--
-- Hoy la validación es una pestaña por equipo que trae la lista de materiales
-- de Nuevo Costeo por NOMBRE, la compara contra todo el stock sin apartar nada
-- (dos bazucas y el S133 piden 28 m de tubo, hay 18 m, y cada pestaña dice
-- "faltante 0"), su cruce con inventario está roto desde el 7 de agosto, y lo
-- que sale de almacén no es lo que se validó (P786: otra tornillería, 3
-- chumaceras de 4). Las casillas de compras y de "INGRESADO" nunca se usan.
--
-- Aquí la orden congela su lista de materiales (si después cambia el costeo,
-- la orden no se mueve), aparta material con reservas que ven todas las demás
-- órdenes, convierte lo que falta en requisición, y el surtido sale contra la
-- orden: lo que no estaba en la lista se registra como "fuera de lista" con su
-- motivo. Las horas por etapa salen del mismo costeo y alimentan la carga del
-- taller, la pantalla del gerente y la TV de piso.
-- =============================================================================

create type public.estado_op as enum ('planeada', 'liberada', 'en_proceso', 'terminada', 'entregada', 'cancelada');
create type public.estado_operacion as enum ('pendiente', 'en_proceso', 'pausada', 'terminada');

alter table public.etapas add column capacidad_horas_semana numeric(8,1) not null default 0;  -- para la gráfica de carga

create table public.ordenes_produccion (
  id uuid primary key default gen_random_uuid(),
  folio text not null default '' unique,
  numero_serie text unique,                          -- el "S###" que hoy aparece en las salidas
  pedido_id uuid references public.pedidos(id),
  pedido_linea_id uuid references public.pedido_lineas(id),
  articulo_id uuid not null references public.articulos(id),
  cantidad numeric(10,2) not null default 1 check (cantidad > 0),
  estado public.estado_op not null default 'planeada',
  prioridad int not null default 2 check (prioridad between 1 and 3),   -- 1 urgente · 2 normal · 3 baja
  fecha_compromiso date,
  inicio_plan date,
  responsable_id uuid references public.perfiles(id),
  notas text,
  -- Pasos de la validación de hoy, ahora con quién y cuándo.
  revisado_ingenieria_por uuid references public.perfiles(id),
  revisado_ingenieria_en timestamptz,
  revisado_almacen_por uuid references public.perfiles(id),
  revisado_almacen_en timestamptz,
  terminada_en timestamptz,
  entregada_en timestamptz,
  creado_por uuid default auth.uid() references public.perfiles(id),
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);
create index op_estado on public.ordenes_produccion (estado, prioridad, fecha_compromiso);
create index op_pedido on public.ordenes_produccion (pedido_id);

-- Lista de materiales congelada al crear la orden.
create table public.op_materiales (
  id uuid primary key default gen_random_uuid(),
  orden_id uuid not null references public.ordenes_produccion(id) on delete cascade,
  articulo_id uuid not null references public.articulos(id),
  requerido numeric(14,3) not null check (requerido >= 0),
  surtido numeric(14,3) not null default 0,
  ruta text,                                -- en qué subensamble va (para el almacenista)
  agregado boolean not null default false,  -- no venía en el costeo: lo agregó ingeniería para esta orden
  notas text,
  unique (orden_id, articulo_id)
);

create table public.op_operaciones (
  id uuid primary key default gen_random_uuid(),
  orden_id uuid not null references public.ordenes_produccion(id) on delete cascade,
  etapa_id int not null references public.etapas(id),
  horas_estimadas numeric(10,2) not null default 0,
  estado public.estado_operacion not null default 'pendiente',
  inicio timestamptz,
  fin timestamptz,
  responsable text,                         -- quién la trabaja (nombre de piso; puede no tener usuario)
  notas text,
  unique (orden_id, etapa_id)
);
create index op_operaciones_etapa on public.op_operaciones (etapa_id, estado);

-- Línea de tiempo de la orden: lo que marca la terminal de piso.
create table public.op_eventos (
  id bigserial primary key,
  orden_id uuid not null references public.ordenes_produccion(id) on delete cascade,
  operacion_id uuid references public.op_operaciones(id) on delete cascade,
  tipo text not null check (tipo in ('creada', 'liberada', 'inicio', 'pausa', 'reanudar', 'fin', 'problema', 'nota', 'surtido', 'cambio_material', 'terminada', 'entregada')),
  nota text,
  usuario_id uuid default auth.uid() references public.perfiles(id),
  en timestamptz not null default now()
);
create index op_eventos_orden on public.op_eventos (orden_id, en desc);
create index op_eventos_en on public.op_eventos (en desc);

-- Correcciones que hoy se quedan en notas sueltas ("Son de 14\"", "DEBE SER 4X3")
-- y nunca regresan al costeo: aquí llegan a ingeniería como pendiente.
create table public.solicitudes_cambio_bom (
  id uuid primary key default gen_random_uuid(),
  orden_id uuid references public.ordenes_produccion(id) on delete set null,
  articulo_id uuid not null references public.articulos(id),
  descripcion text not null,
  estado text not null default 'pendiente' check (estado in ('pendiente', 'aplicada', 'descartada')),
  solicitado_por uuid default auth.uid() references public.perfiles(id),
  solicitado_en timestamptz not null default now(),
  resuelto_por uuid references public.perfiles(id),
  resuelto_en timestamptz
);

alter table public.reservas add constraint reserva_op foreign key (orden_produccion_id) references public.ordenes_produccion(id) on delete cascade;
alter table public.movimientos_inventario add constraint mov_op foreign key (orden_produccion_id) references public.ordenes_produccion(id);
alter table public.requisicion_lineas add constraint req_op foreign key (orden_produccion_id) references public.ordenes_produccion(id) on delete set null;

create trigger folio before insert on public.ordenes_produccion for each row execute function public.trg_folio('OP');

-- ----------------------------------------------------------------------------
-- Vista de material por orden: requerido, apartado, surtido, faltante
-- ----------------------------------------------------------------------------
create or replace view public.v_op_material with (security_invoker = true) as
select m.id, m.orden_id, m.articulo_id, a.clave, a.nombre, a.unidad, m.requerido, m.surtido, m.ruta, m.agregado, m.notas,
  coalesce(r.apartado, 0) as apartado,
  greatest(m.requerido - m.surtido - coalesce(r.apartado, 0), 0) as faltante,
  coalesce((select sum(l.cantidad) from public.requisicion_lineas l where l.orden_produccion_id = m.orden_id
            and l.articulo_id = m.articulo_id and l.estado <> 'cancelada'), 0) as pedido_a_compras,
  coalesce(e.en_planta, 0) as existencia_planta
from public.op_materiales m
join public.articulos a on a.id = m.articulo_id
left join lateral (select sum(cantidad - surtido) apartado from public.reservas
                   where orden_produccion_id = m.orden_id and articulo_id = m.articulo_id and estado = 'activa') r on true
left join lateral (select sum(x.cantidad) en_planta from public.existencias x join public.almacenes al on al.id = x.almacen_id
                   where x.articulo_id = m.articulo_id and al.disponible_para_planta) e on true;

-- ----------------------------------------------------------------------------
-- Crear la orden: explota la lista de materiales y las horas por etapa
-- ----------------------------------------------------------------------------
create or replace function public.crear_orden_produccion(p_articulo uuid, p_cantidad numeric default 1,
  p_pedido_linea uuid default null, p_fecha_compromiso date default null, p_prioridad int default 2,
  p_numero_serie text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_op uuid; v_pedido uuid;
begin
  if not puede('produccion', 2) then raise exception 'Sin permiso para crear órdenes de producción' using errcode = '42501'; end if;
  if (select tipo from articulos where id = p_articulo) not in ('equipo', 'subensamble') then
    raise exception 'Solo se fabrican equipos y subensambles';
  end if;
  if not exists (select 1 from bom_lineas where padre_id = p_articulo) then
    raise exception 'Ese equipo no tiene lista de materiales: ingeniería tiene que capturarla primero';
  end if;
  select pedido_id into v_pedido from pedido_lineas where id = p_pedido_linea;

  insert into ordenes_produccion (articulo_id, cantidad, pedido_id, pedido_linea_id, fecha_compromiso, prioridad, numero_serie)
  values (p_articulo, p_cantidad, v_pedido, p_pedido_linea,
          coalesce(p_fecha_compromiso, (select fecha_compromiso from pedidos where id = v_pedido)), p_prioridad, p_numero_serie)
  returning id into v_op;

  insert into op_materiales (orden_id, articulo_id, requerido, ruta)
  select v_op, e.articulo_id, round(e.cantidad, 3), e.ruta from explotar_materiales(p_articulo, p_cantidad) e;

  -- Horas por etapa de todo el árbol (el equipo y sus subensambles).
  insert into op_operaciones (orden_id, etapa_id, horas_estimadas)
  with recursive arbol(id, cant) as (
    select p_articulo, p_cantidad::numeric
    union all
    select b.hijo_id, arbol.cant * cantidad_linea(b) from arbol join bom_lineas b on b.padre_id = arbol.id
  )
  select v_op, o.etapa_id, round(sum(arbol.cant * horas_operacion(o)), 2)
  from arbol join bom_operaciones o on o.articulo_id = arbol.id
  group by o.etapa_id having sum(arbol.cant * horas_operacion(o)) > 0;

  insert into op_eventos (orden_id, tipo, nota) values (v_op, 'creada', null);
  if v_pedido is not null then
    update pedidos set estado = 'en_produccion' where id = v_pedido and estado = 'confirmado';
  end if;
  return v_op;
end $$;

-- Una orden por cada unidad de equipo del pedido (como hoy: una pestaña por equipo).
create or replace function public.ordenes_desde_pedido(p_pedido uuid) returns int
language plpgsql security definer set search_path = public as $$
declare l record; v_n int := 0;
begin
  for l in select pl.* from pedido_lineas pl join articulos a on a.id = pl.articulo_id
           where pl.pedido_id = p_pedido and a.tipo in ('equipo', 'subensamble')
             and exists (select 1 from bom_lineas b where b.padre_id = a.id)
             and not exists (select 1 from ordenes_produccion o where o.pedido_linea_id = pl.id and o.estado <> 'cancelada') loop
    for i in 1 .. ceil(l.cantidad)::int loop
      perform crear_orden_produccion(l.articulo_id, 1, l.id);
      v_n := v_n + 1;
    end loop;
  end loop;
  return v_n;
end $$;

-- ----------------------------------------------------------------------------
-- Validación: aparta lo que hay (respetando lo que otras órdenes ya apartaron)
-- ----------------------------------------------------------------------------
create or replace function public.apartar_material(p_op uuid) returns table (articulo_id uuid, nombre text, faltante numeric)
language plpgsql security definer set search_path = public as $$
declare m record; v_libre numeric; v_tomar numeric;
begin
  if not (puede('produccion', 2) or puede('inventario', 2)) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  -- Bloquea las reservas de los artículos involucrados para que dos órdenes no aparten lo mismo a la vez.
  perform 1 from existencias where existencias.articulo_id in (select om.articulo_id from op_materiales om where om.orden_id = p_op) for update;

  for m in select * from v_op_material v where v.orden_id = p_op and v.faltante > 0 loop
    select coalesce(sum(x.cantidad), 0) - coalesce((select sum(r.cantidad - r.surtido) from reservas r
                                                     where r.articulo_id = m.articulo_id and r.estado = 'activa'), 0)
      into v_libre
    from existencias x join almacenes al on al.id = x.almacen_id
    where x.articulo_id = m.articulo_id and al.disponible_para_planta;
    v_tomar := least(m.faltante, greatest(v_libre, 0));
    if v_tomar > 0 then
      insert into reservas (articulo_id, cantidad, orden_produccion_id, motivo)
      values (m.articulo_id, v_tomar, p_op, 'OP ' || (select folio from ordenes_produccion where id = p_op));
    end if;
  end loop;

  return query select v.articulo_id, v.nombre, v.faltante from v_op_material v where v.orden_id = p_op and v.faltante > 0;
end $$;

-- Lo que falta (menos lo que ya se pidió) → requisición a compras.
create or replace function public.pedir_faltantes(p_op uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_req uuid; o ordenes_produccion;
begin
  if not (puede('produccion', 2) or puede('inventario', 2)) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  select * into o from ordenes_produccion where id = p_op;
  if not exists (select 1 from v_op_material where orden_id = p_op and faltante - pedido_a_compras > 0) then return null; end if;
  insert into requisiciones (origen, necesaria_para, notas)
  values ('produccion', coalesce(o.inicio_plan, o.fecha_compromiso), 'Faltantes de ' || o.folio)
  returning id into v_req;
  insert into requisicion_lineas (requisicion_id, articulo_id, cantidad, orden_produccion_id)
  select v_req, articulo_id, faltante - pedido_a_compras, p_op from v_op_material
  where orden_id = p_op and faltante - pedido_a_compras > 0;
  return v_req;
end $$;

create or replace function public.revisar_orden(p_op uuid, p_paso text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_paso = 'ingenieria' then
    if not (puede('costeo', 2) or puede('produccion', 3)) then raise exception 'Sin permiso' using errcode = '42501'; end if;
    update ordenes_produccion set revisado_ingenieria_por = auth.uid(), revisado_ingenieria_en = now() where id = p_op;
  elsif p_paso = 'almacen' then
    if not puede('inventario', 2) then raise exception 'Sin permiso' using errcode = '42501'; end if;
    update ordenes_produccion set revisado_almacen_por = auth.uid(), revisado_almacen_en = now() where id = p_op;
  else
    raise exception 'Paso desconocido: %', p_paso;
  end if;
  insert into op_eventos (orden_id, tipo, nota) values (p_op, 'nota', 'Revisión de ' || p_paso);
end $$;

-- Liberar = puede entrar al taller. Se exige revisión de ingeniería; el material
-- puede ir llegando (se avisa, no se bloquea, como pasa en la práctica).
create or replace function public.liberar_orden(p_op uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not puede('produccion', 3) then raise exception 'Solo la gerencia de producción libera órdenes' using errcode = '42501'; end if;
  if (select revisado_ingenieria_en from ordenes_produccion where id = p_op) is null then
    raise exception 'Falta que ingeniería revise materiales y cantidades';
  end if;
  update ordenes_produccion set estado = 'liberada', inicio_plan = coalesce(inicio_plan, current_date)
  where id = p_op and estado = 'planeada';
  insert into op_eventos (orden_id, tipo) values (p_op, 'liberada');
end $$;

-- ----------------------------------------------------------------------------
-- Surtido: la salida de almacén va contra la orden y consume su reserva
-- ----------------------------------------------------------------------------
create or replace function public.surtir_material(p_op uuid, p_lineas jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare l record; o ordenes_produccion; v_req numeric; v_res reservas; v_rest numeric;
begin
  if not puede('inventario', 2) then raise exception 'Solo almacén surte material' using errcode = '42501'; end if;
  select * into o from ordenes_produccion where id = p_op;
  if o.estado in ('terminada', 'entregada', 'cancelada') then raise exception 'La orden ya está cerrada'; end if;

  for l in select (x->>'articulo_id')::uuid articulo_id, (x->>'cantidad')::numeric cantidad,
                  (x->>'almacen_id')::int almacen_id, x->>'motivo' motivo
           from jsonb_array_elements(p_lineas) x loop
    if coalesce(l.cantidad, 0) <= 0 then continue; end if;
    select requerido - surtido into v_req from op_materiales where orden_id = p_op and articulo_id = l.articulo_id;
    if v_req is null and coalesce(trim(l.motivo), '') = '' then
      raise exception '"%" no está en la lista de materiales de esta orden: escribe el motivo',
        (select nombre from articulos where id = l.articulo_id);
    end if;

    insert into movimientos_inventario (tipo, articulo_id, almacen_id, cantidad, orden_produccion_id, pedido_id, motivo, fuera_de_lista, costo_unitario)
    values ('salida_produccion', l.articulo_id, l.almacen_id, -l.cantidad, p_op, o.pedido_id,
            coalesce(l.motivo, o.folio), v_req is null,
            (select costo * tc(moneda) from costos_articulo where articulo_id = l.articulo_id));

    if v_req is null then
      insert into op_materiales (orden_id, articulo_id, requerido, surtido, agregado, notas)
      values (p_op, l.articulo_id, 0, l.cantidad, true, l.motivo);
    else
      update op_materiales set surtido = surtido + l.cantidad where orden_id = p_op and articulo_id = l.articulo_id;
    end if;

    -- Consume reservas de la orden (las más viejas primero).
    v_rest := l.cantidad;
    for v_res in select * from reservas where orden_produccion_id = p_op and articulo_id = l.articulo_id and estado = 'activa'
                 order by creado_en for update loop
      exit when v_rest <= 0;
      update reservas set surtido = surtido + least(v_rest, cantidad - surtido),
        estado = case when surtido + least(v_rest, cantidad - surtido) >= cantidad then 'surtida' else 'activa' end
      where id = v_res.id;
      v_rest := v_rest - least(v_rest, v_res.cantidad - v_res.surtido);
    end loop;
  end loop;
  insert into op_eventos (orden_id, tipo, nota) values (p_op, 'surtido', jsonb_array_length(p_lineas) || ' partida(s)');
end $$;

-- ----------------------------------------------------------------------------
-- Terminal de piso: iniciar / pausar / terminar una etapa
-- ----------------------------------------------------------------------------
create or replace function public.avanzar_operacion(p_operacion uuid, p_accion text, p_nota text default null, p_responsable text default null)
returns void language plpgsql security definer set search_path = public as $$
declare op op_operaciones; o ordenes_produccion;
begin
  if not puede('produccion', 2) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  select * into op from op_operaciones where id = p_operacion for update;
  select * into o from ordenes_produccion where id = op.orden_id for update;
  if o.estado in ('planeada') then raise exception 'La orden % todavía no está liberada', o.folio; end if;
  if o.estado in ('terminada', 'entregada', 'cancelada') then raise exception 'La orden % ya está cerrada', o.folio; end if;

  case p_accion
    when 'inicio' then
      if op.estado = 'terminada' then raise exception 'Esa etapa ya se terminó'; end if;
      update op_operaciones set estado = 'en_proceso', inicio = coalesce(inicio, now()),
        responsable = coalesce(p_responsable, responsable) where id = p_operacion;
      update ordenes_produccion set estado = 'en_proceso' where id = o.id and estado = 'liberada';
    when 'pausa' then update op_operaciones set estado = 'pausada' where id = p_operacion;
    when 'reanudar' then update op_operaciones set estado = 'en_proceso' where id = p_operacion;
    when 'fin' then
      update op_operaciones set estado = 'terminada', fin = now(), inicio = coalesce(inicio, now()) where id = p_operacion;
      if not exists (select 1 from op_operaciones where orden_id = o.id and estado <> 'terminada') then
        update ordenes_produccion set estado = 'terminada', terminada_en = now() where id = o.id;
        insert into op_eventos (orden_id, tipo) values (o.id, 'terminada');
        -- Si todas las órdenes del pedido terminaron, el pedido queda listo para entregar.
        if o.pedido_id is not null and not exists (select 1 from ordenes_produccion where pedido_id = o.pedido_id
                                                   and estado not in ('terminada', 'entregada', 'cancelada')) then
          update pedidos set estado = 'listo' where id = o.pedido_id and estado = 'en_produccion';
        end if;
      end if;
    when 'problema' then null;
    when 'nota' then null;
    else raise exception 'Acción desconocida: %', p_accion;
  end case;
  insert into op_eventos (orden_id, operacion_id, tipo, nota) values (o.id, p_operacion, p_accion, p_nota);
end $$;

-- ----------------------------------------------------------------------------
-- Tablero: una fila por orden abierta con todo lo que el gerente necesita ver
-- ----------------------------------------------------------------------------
create or replace view public.v_tablero_produccion with (security_invoker = true) as
select o.id, o.folio, o.numero_serie, o.estado, o.prioridad, o.fecha_compromiso, o.inicio_plan, o.cantidad,
  a.clave, a.nombre as equipo, a.imagen_url,
  p.folio as pedido_folio, c.nombre as cliente,
  coalesce(sum(op.horas_estimadas), 0) as horas_totales,
  coalesce(sum(op.horas_estimadas) filter (where op.estado = 'terminada'), 0) as horas_terminadas,
  case when coalesce(sum(op.horas_estimadas), 0) = 0 then 0
       else round(100 * coalesce(sum(op.horas_estimadas) filter (where op.estado = 'terminada'), 0) / sum(op.horas_estimadas)) end as avance,
  (select e.nombre from public.op_operaciones x join public.etapas e on e.id = x.etapa_id
   where x.orden_id = o.id and x.estado in ('en_proceso', 'pausada') order by e.orden limit 1) as etapa_actual,
  (select e.nombre from public.op_operaciones x join public.etapas e on e.id = x.etapa_id
   where x.orden_id = o.id and x.estado = 'pendiente' order by e.orden limit 1) as siguiente_etapa,
  bool_or(op.estado = 'pausada') as pausada,
  (select count(*) from public.v_op_material m where m.orden_id = o.id and m.faltante > 0) as materiales_faltantes,
  o.fecha_compromiso - current_date as dias_restantes,
  (o.fecha_compromiso < current_date and o.estado not in ('terminada', 'entregada')) as atrasada,
  o.revisado_ingenieria_en is not null as revisada_ingenieria,
  o.revisado_almacen_en is not null as revisada_almacen,
  (select max(en) from public.op_eventos ev where ev.orden_id = o.id) as ultimo_movimiento
from public.ordenes_produccion o
join public.articulos a on a.id = o.articulo_id
left join public.pedidos p on p.id = o.pedido_id
left join public.clientes c on c.id = p.cliente_id
left join public.op_operaciones op on op.orden_id = o.id
where o.estado not in ('entregada', 'cancelada')
group by o.id, a.id, p.id, c.id;

-- Carga del taller: horas pendientes por etapa contra su capacidad semanal.
create or replace view public.v_carga_etapas with (security_invoker = true) as
select e.id etapa_id, e.nombre, e.color, e.orden, e.capacidad_horas_semana,
  coalesce(sum(x.horas_estimadas) filter (where x.estado <> 'terminada'), 0) as horas_pendientes,
  count(*) filter (where x.estado = 'en_proceso') as en_proceso,
  count(*) filter (where x.estado = 'pausada') as pausadas,
  count(*) filter (where x.estado = 'pendiente') as en_espera
from public.etapas e
left join public.op_operaciones x on x.etapa_id = e.id
  and exists (select 1 from public.ordenes_produccion o where o.id = x.orden_id and o.estado in ('liberada', 'en_proceso'))
where e.activa
group by e.id;

-- ----------------------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------------------
alter table public.ordenes_produccion enable row level security;
alter table public.op_materiales enable row level security;
alter table public.op_operaciones enable row level security;
alter table public.op_eventos enable row level security;
alter table public.solicitudes_cambio_bom enable row level security;

-- La TV de piso (rol "pantalla") lee órdenes, operaciones y eventos; no escribe nada.
create policy ver on public.ordenes_produccion for select to authenticated using (puede('produccion', 1) or puede('inventario', 1));
create policy editar on public.ordenes_produccion for update to authenticated using (puede('produccion', 3)) with check (puede('produccion', 3));
create policy ver on public.op_materiales for select to authenticated using (puede('produccion', 1) or puede('inventario', 1));
-- Ingeniería puede corregir la lista de una orden antes de que se surta (queda en bitácora).
create policy editar on public.op_materiales for all to authenticated using (puede('costeo', 2) or puede('produccion', 3))
  with check (puede('costeo', 2) or puede('produccion', 3));
create policy ver on public.op_operaciones for select to authenticated using (puede('produccion', 1));
create policy editar on public.op_operaciones for update to authenticated using (puede('produccion', 3)) with check (puede('produccion', 3));
create policy ver on public.op_eventos for select to authenticated using (puede('produccion', 1));
create policy alta on public.op_eventos for insert to authenticated with check (puede('produccion', 2) and tipo in ('nota', 'problema'));
create policy ver on public.solicitudes_cambio_bom for select to authenticated using (puede('produccion', 1) or puede('costeo', 1));
create policy alta on public.solicitudes_cambio_bom for insert to authenticated with check (puede('produccion', 1) or puede('inventario', 2) or puede('costeo', 1));
create policy cambio on public.solicitudes_cambio_bom for update to authenticated using (puede('costeo', 2)) with check (puede('costeo', 2));

create trigger tocar before update on public.ordenes_produccion for each row execute function public.tocar_actualizado();
create trigger auditar after insert or update or delete on public.ordenes_produccion for each row execute function public.auditar();
create trigger auditar after insert or update or delete on public.op_materiales for each row execute function public.auditar();

update public.etapas set capacidad_horas_semana = case nombre
  when 'Pailería' then 400 when 'Corte' then 90 when 'Torno' then 90 when 'Pintura' then 90
  when 'Detallado' then 135 when 'Eléctrico' then 45 when 'Pruebas' then 45 else 45 end;

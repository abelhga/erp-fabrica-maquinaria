-- =============================================================================
-- RRHH, cuentas por pagar, tableros por rol y buscador global.
-- =============================================================================

-- ----------------------------------------------------------------------------
-- Personal
-- ----------------------------------------------------------------------------
create table public.departamentos (
  id serial primary key,
  nombre text not null unique
);
insert into public.departamentos (nombre) values
  ('Dirección'), ('Ventas'), ('Ingeniería'), ('Compras'), ('Almacén'), ('Producción'), ('Administración'), ('Recursos Humanos');

create table public.empleados (
  id uuid primary key default gen_random_uuid(),
  numero text unique,
  nombre text not null,
  puesto text,
  departamento_id int references public.departamentos(id),
  etapa_id int references public.etapas(id),          -- área de piso (pailería, pintura…)
  fecha_ingreso date not null,
  fecha_nacimiento date,
  telefono text,
  correo text,
  contacto_emergencia text,
  foto_url text,
  usuario_id uuid unique references public.perfiles(id),
  activo boolean not null default true,
  baja_en date,
  motivo_baja text,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

-- Lo delicado aparte: solo RRHH y dirección.
create table public.empleado_datos (
  empleado_id uuid primary key references public.empleados(id) on delete cascade,
  curp text, rfc text, nss text, domicilio text,
  salario_diario numeric(10,2),
  cuenta_bancaria text
);

create table public.incidencias (
  id uuid primary key default gen_random_uuid(),
  empleado_id uuid not null references public.empleados(id) on delete cascade,
  tipo text not null check (tipo in ('vacaciones', 'permiso_con_goce', 'permiso_sin_goce', 'falta', 'incapacidad', 'retardo', 'horas_extra')),
  inicio date not null,
  fin date not null,
  dias numeric(5,1) not null default 1,
  horas numeric(5,1),
  motivo text,
  documento_url text,
  estado text not null default 'solicitada' check (estado in ('solicitada', 'aprobada', 'rechazada')),
  solicitada_por uuid default auth.uid() references public.perfiles(id),
  resuelta_por uuid references public.perfiles(id),
  creado_en timestamptz not null default now(),
  check (fin >= inicio)
);
create index incidencias_empleado on public.incidencias (empleado_id, inicio desc);

-- Vacaciones según la LFT reformada en 2023 ("vacaciones dignas").
create or replace function public.dias_vacaciones(p_anios int) returns int
language sql immutable as $$
  select case when p_anios < 1 then 0
              when p_anios <= 5 then 10 + 2 * p_anios
              else 20 + 2 * ceil((p_anios - 5) / 5.0)::int end
$$;

create or replace view public.v_vacaciones with (security_invoker = true) as
select e.id empleado_id, e.nombre, e.fecha_ingreso, x.anios,
  dias_vacaciones(greatest(x.anios, 1)) as dias_periodo,
  x.inicio_periodo,
  coalesce((select sum(i.dias) from public.incidencias i where i.empleado_id = e.id and i.tipo = 'vacaciones'
            and i.estado = 'aprobada' and i.inicio >= x.inicio_periodo), 0) as tomados,
  dias_vacaciones(greatest(x.anios, 1)) - coalesce((select sum(i.dias) from public.incidencias i where i.empleado_id = e.id
            and i.tipo = 'vacaciones' and i.estado = 'aprobada' and i.inicio >= x.inicio_periodo), 0) as saldo
from public.empleados e
cross join lateral (
  select extract(year from age(current_date, e.fecha_ingreso))::int anios,
         (e.fecha_ingreso + make_interval(years => extract(year from age(current_date, e.fecha_ingreso))::int))::date inicio_periodo
) x
where e.activo;

-- ----------------------------------------------------------------------------
-- Cuentas por pagar
-- ----------------------------------------------------------------------------
create or replace view public.v_cuentas_por_pagar with (security_invoker = true) as
select o.id orden_compra_id, o.folio, o.proveedor_id, p.nombre proveedor, o.fecha, o.vence_pago, o.moneda, o.total,
  coalesce((select sum(monto) from public.pagos_proveedor x where x.orden_compra_id = o.id), 0) pagado,
  o.total - coalesce((select sum(monto) from public.pagos_proveedor x where x.orden_compra_id = o.id), 0) saldo,
  o.factura_proveedor
from public.ordenes_compra o join public.proveedores p on p.id = o.proveedor_id
where o.estado in ('parcial', 'recibida');

-- ----------------------------------------------------------------------------
-- Tableros
-- ----------------------------------------------------------------------------
-- Ventas por mes (pedidos no cancelados), por canal y línea. Se usa en dirección y ventas.
create or replace function public.ventas_por_mes(p_meses int default 12)
returns table (mes date, canal text, linea text, importe numeric, pedidos bigint)
language sql stable security invoker as $$
  select date_trunc('month', p.fecha)::date, p.canal::text, l.linea::text, sum(l.importe * p.tipo_cambio), count(distinct p.id)
  from pedidos p join pedido_lineas l on l.pedido_id = p.id
  where p.estado <> 'cancelado' and p.fecha >= date_trunc('month', current_date) - make_interval(months => p_meses - 1)
  group by 1, 2, 3 order by 1
$$;

-- Indicadores de un vistazo. Cada sección solo se llena si el usuario puede verla.
create or replace function public.indicadores() returns jsonb
language plpgsql stable security invoker as $$
declare r jsonb := '{}'::jsonb; v_mes date := date_trunc('month', current_date);
begin
  if puede('ventas', 1) then
    r := r || jsonb_build_object('ventas', (
      select jsonb_build_object(
        'mes', coalesce(sum(p.subtotal * p.tipo_cambio) filter (where p.fecha >= v_mes), 0),
        -- El mismo tramo del mes pasado (del 1 al día de hoy): contra el mes completo,
        -- los primeros días siempre salían "77 % abajo".
        'mes_anterior', coalesce(sum(p.subtotal * p.tipo_cambio) filter (where p.fecha >= v_mes - interval '1 month'
                          and p.fecha <= (now() at time zone 'America/Mexico_City')::date - interval '1 month'), 0),
        'anio', coalesce(sum(p.subtotal * p.tipo_cambio) filter (where p.fecha >= date_trunc('year', current_date)), 0),
        'pedidos_mes', count(*) filter (where p.fecha >= v_mes))
      from pedidos p where p.estado <> 'cancelado'),
      'cotizaciones', (
      select jsonb_build_object(
        'abiertas', count(*) filter (where c.estado in ('borrador', 'por_autorizar', 'autorizada', 'enviada') and c.fecha + c.vigencia_dias >= current_date),
        'monto_abierto', coalesce(sum(c.subtotal * c.tipo_cambio) filter (where c.estado in ('enviada') and c.fecha + c.vigencia_dias >= current_date), 0),
        'por_autorizar', count(*) filter (where c.estado = 'por_autorizar'),
        'mes', count(*) filter (where c.fecha >= v_mes),
        'ganadas_90d', count(*) filter (where c.estado = 'aceptada' and c.fecha >= current_date - 90),
        'cerradas_90d', count(*) filter (where c.estado in ('aceptada', 'rechazada', 'vencida') and c.fecha >= current_date - 90))
      from cotizaciones c),
      'tareas_vencidas', (select count(*) from actividades a where not a.hecha and a.vence_en < current_date and a.usuario_id = auth.uid()));
  end if;
  if puede('finanzas', 1) or puede('ventas', 3) then
    r := r || jsonb_build_object('cobranza', (
      select jsonb_build_object('por_cobrar', coalesce(sum(saldo * case when moneda = 'MXN' then 1 else tc(moneda) end) filter (where saldo > 0), 0),
                                'pedidos_con_saldo', count(*) filter (where saldo > 0))
      from v_saldos_pedido));
  end if;
  if puede('finanzas', 1) then
    r := r || jsonb_build_object('por_pagar', (
      select jsonb_build_object('total', coalesce(sum(saldo * case when moneda = 'MXN' then 1 else tc(moneda) end), 0),
                                'vencido', coalesce(sum(saldo * case when moneda = 'MXN' then 1 else tc(moneda) end) filter (where vence_pago < current_date), 0))
      from v_cuentas_por_pagar where saldo > 0));
  end if;
  if puede('inventario', 1) then
    r := r || jsonb_build_object('inventario', jsonb_build_object(
      'ajustes_pendientes', (select count(*) from ajustes_inventario where estado = 'pendiente'),
      'articulos_con_existencia', (select count(distinct articulo_id) from existencias where cantidad > 0)));
  end if;
  if puede('costos', 1) then
    r := r || jsonb_build_object('valor_inventario', (
      select coalesce(sum(e.cantidad * cc.costo_total), 0) from existencias e join costos_calculados cc on cc.articulo_id = e.articulo_id where e.cantidad > 0),
      'costos_viejos', (select count(*) from costos_articulo where actualizado_en < current_date - 180));
  end if;
  if puede('compras', 1) then
    r := r || jsonb_build_object('compras', jsonb_build_object(
      'oc_abiertas', (select count(*) from ordenes_compra where estado in ('enviada', 'parcial')),
      'oc_atrasadas', (select count(*) from ordenes_compra where estado in ('enviada', 'parcial') and fecha_entrega < current_date),
      'requisiciones_abiertas', (select count(*) from requisiciones where estado = 'abierta')));
  end if;
  if puede('produccion', 1) then
    r := r || jsonb_build_object('produccion', (
      select jsonb_build_object('abiertas', count(*), 'atrasadas', count(*) filter (where atrasada),
             'en_proceso', count(*) filter (where estado = 'en_proceso'),
             'con_faltantes', count(*) filter (where materiales_faltantes > 0),
             'terminadas_mes', (select count(*) from ordenes_produccion where terminada_en >= v_mes))
      from v_tablero_produccion));
  end if;
  if puede('rrhh', 1) then
    r := r || jsonb_build_object('rrhh', jsonb_build_object(
      'empleados', (select count(*) from empleados where activo),
      'incidencias_pendientes', (select count(*) from incidencias where estado = 'solicitada'),
      'ausentes_hoy', (select count(distinct empleado_id) from incidencias where estado = 'aprobada'
                       and current_date between inicio and fin and tipo in ('vacaciones', 'incapacidad', 'permiso_con_goce', 'permiso_sin_goce', 'falta'))));
  end if;
  return r;
end $$;

-- Un buscador para todo. security invoker: la RLS de cada tabla decide qué ve cada quien.
create or replace function public.buscar_global(q text)
returns table (tipo text, id text, titulo text, subtitulo text, ruta text)
language sql stable security invoker as $$
  with t as (select sin_acentos(trim(q)) t)
  (select case a.tipo when 'equipo' then 'equipo' when 'subensamble' then 'subensamble' else 'componente' end,
          a.id::text, a.nombre, a.clave, case when a.tipo in ('equipo', 'subensamble') then '/costeo/equipos/' else '/costeo/componentes/' end || a.id
   from articulos a, t where a.activo and sin_acentos(a.clave || ' ' || a.nombre) like '%' || replace(t.t, ' ', '%') || '%'
   order by similarity(sin_acentos(a.nombre), t.t) desc limit 8)
  union all
  (select 'cliente', c.id::text, c.nombre, coalesce(c.razon_social, c.ciudad), '/ventas/clientes/' || c.id
   from clientes c, t where sin_acentos(c.nombre || ' ' || coalesce(c.razon_social, '') || ' ' || coalesce(c.rfc, '')) like '%' || replace(t.t, ' ', '%') || '%'
   limit 6)
  union all
  (select 'cotizacion', c.id::text, c.folio || coalesce(' · ' || c.atencion, ''), to_char(c.total, 'FM$999,999,990.00'), '/ventas/cotizaciones/' || c.id
   from cotizaciones c, t where sin_acentos(c.folio || ' ' || coalesce(c.atencion, '') || ' ' || coalesce(c.empresa, '')) like '%' || replace(t.t, ' ', '%') || '%'
   order by c.fecha desc limit 5)
  union all
  (select 'pedido', p.id::text, p.folio, (select nombre from clientes where id = p.cliente_id), '/ventas/pedidos/' || p.id
   from pedidos p, t where sin_acentos(p.folio || ' ' || coalesce(p.id_externo, '')) like '%' || t.t || '%' order by p.fecha desc limit 5)
  union all
  (select 'orden_produccion', o.id::text, o.folio || coalesce(' · ' || o.numero_serie, ''), (select nombre from articulos where id = o.articulo_id), '/produccion/ordenes/' || o.id
   from ordenes_produccion o, t where sin_acentos(o.folio || ' ' || coalesce(o.numero_serie, '')) like '%' || t.t || '%' limit 5)
  union all
  (select 'proveedor', p.id::text, p.nombre, p.categoria, '/compras/proveedores/' || p.id
   from proveedores p, t where sin_acentos(p.nombre) like '%' || replace(t.t, ' ', '%') || '%' limit 5)
  union all
  (select 'orden_compra', o.id::text, o.folio, (select nombre from proveedores where id = o.proveedor_id), '/compras/ordenes/' || o.id
   from ordenes_compra o, t where sin_acentos(o.folio || ' ' || coalesce(o.factura_proveedor, '')) like '%' || t.t || '%' limit 5)
$$;

-- ----------------------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------------------
alter table public.departamentos enable row level security;
alter table public.empleados enable row level security;
alter table public.empleado_datos enable row level security;
alter table public.incidencias enable row level security;

create policy ver on public.departamentos for select to authenticated using (cardinality(mis_roles()) > 0);
create policy editar on public.departamentos for all to authenticated using (puede('rrhh', 3)) with check (puede('rrhh', 3));
-- La gerencia de producción ve a su gente (para asignar y planear); RRHH a todos.
create policy ver on public.empleados for select to authenticated using (puede('rrhh', 1) or puede('produccion', 3) or usuario_id = auth.uid());
create policy editar on public.empleados for all to authenticated using (puede('rrhh', 2)) with check (puede('rrhh', 2));
create policy ver on public.empleado_datos for select to authenticated using (puede('rrhh', 3));
create policy editar on public.empleado_datos for all to authenticated using (puede('rrhh', 3)) with check (puede('rrhh', 3));
create policy ver on public.incidencias for select to authenticated using (puede('rrhh', 1) or puede('produccion', 3)
  or exists (select 1 from empleados e where e.id = empleado_id and e.usuario_id = auth.uid()));
create policy alta on public.incidencias for insert to authenticated with check (puede('rrhh', 2) or puede('produccion', 3)
  or exists (select 1 from empleados e where e.id = empleado_id and e.usuario_id = auth.uid()));
create policy resolver on public.incidencias for update to authenticated using (puede('rrhh', 2)) with check (puede('rrhh', 2));

create trigger tocar before update on public.empleados for each row execute function public.tocar_actualizado();
create trigger auditar after insert or update or delete on public.empleados for each row execute function public.auditar();
create trigger auditar after insert or update or delete on public.empleado_datos for each row execute function public.auditar();
create trigger auditar after insert or update or delete on public.incidencias for each row execute function public.auditar();

-- ----------------------------------------------------------------------------
-- Tiempo real: lo que debe moverse solo en pantalla (TV de piso, tablero,
-- cotizador cuando compras cambia un precio).
-- ----------------------------------------------------------------------------
alter publication supabase_realtime add table public.op_operaciones, public.op_eventos, public.ordenes_produccion,
  public.precios_lista, public.existencias, public.ajustes_inventario, public.cotizaciones;

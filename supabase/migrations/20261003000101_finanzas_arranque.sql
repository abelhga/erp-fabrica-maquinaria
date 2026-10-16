-- =============================================================================
-- Finanzas deja la hoja: cuenta corriente de proveedores, cobros a los saldos de
-- clientes de la hoja y caja chica, todo en el ERP.
--
-- Por qué: el ERP solo sabía pagar órdenes de compra, y Compras todavía no las usa.
-- En la hoja, Finanzas registra unas 175 compras al mes en COMPRAS: material, pero
-- también nómina, IMSS, impuestos, renta, fletes y servicios (más de la cuarta parte
-- del dinero), y los cobros de los saldos viejos de clientes van en VENTAS. Sin
-- dónde capturar eso aquí, Finanzas no puede soltar la hoja.
--
-- 1. movimientos_proveedor: el libro de COMPRAS sigue en el ERP con la misma forma
--    (compra, pago, reembolsos), con vencimiento, cuenta de salida y categoría. El
--    saldo de cada proveedor = lo de la hoja + lo del ERP. Sustituye a
--    pagos_saldo_hoja (097), que nunca se usó en la nube: un pago es un movimiento.
-- 2. cobros_saldo_hoja: el cobro de un saldo de cliente que viene de la hoja.
-- 3. caja_chica: entradas, salidas y arqueos con saldo corrido (la hoja lo llevaba
--    a mano en una columna que se rompía al insertar un renglón).
-- 4. fecha_arranque_finanzas: desde ese día el importador ya no trae COMPRAS ni
--    caja chica de la hoja (lo nuevo vive aquí).
--
-- Mientras la hoja siga abierta, alguien puede anotar lo mismo en los dos lados:
-- un movimiento del ERP igual a uno de la hoja (mismo proveedor o cliente, mismo
-- tipo y monto, ±7 días) no se cuenta dos veces y se ve "también en la hoja".
-- =============================================================================

-- Cuentas de donde sale o entra el dinero (las mismas de la hoja).
create table public.cuentas_dinero (
  clave text primary key,
  nombre text not null,
  hoja text,            -- cómo aparece en la columna "CUENTA" de la hoja
  orden int not null default 0,
  activa boolean not null default true
);
insert into public.cuentas_dinero (clave, nombre, hoja, orden) values
  ('santander_fiscal', 'Santander fiscal', 'SANTANDER FISCAL', 10),
  ('banorte_fiscal', 'Banorte fiscal', 'BANORTE FISCAL', 20),
  ('no_fiscal', 'No fiscal', 'NO FISCAL', 30),
  ('nota_credito', 'Nota de crédito', 'NOTA DE CRÉDITO', 40),
  ('mercadopago', 'Mercado Pago', 'MERCADOPAGO', 50),
  ('caja_chica', 'Caja chica', null, 60);
alter table public.cuentas_dinero enable row level security;
create policy ver on public.cuentas_dinero for select to authenticated using (true);
create policy editar on public.cuentas_dinero for all to authenticated using ((select puede('finanzas', 3))) with check ((select puede('finanzas', 3)));

insert into public.configuracion (clave, valor, descripcion) values
  ('fecha_arranque_finanzas', 'null', 'Día en que Finanzas dejó la hoja: desde ahí, compras, pagos y caja chica se capturan en el ERP y el importador ya no trae COMPRAS ni caja chica.'),
  ('caja_chica_minimo', '500', 'Si el saldo de caja chica baja de aquí, toca reponer.'),
  ('caja_chica_maximo', '4500', 'Más de esto en caja chica es dinero que debería estar en el banco.')
on conflict (clave) do nothing;

-- ---------------------------------------------------------------------------
-- 1. Cuenta corriente de proveedores
-- ---------------------------------------------------------------------------
drop view if exists public.v_saldo_arranque_proveedores;
drop view if exists public.v_pagos_saldo_hoja;
drop function if exists public.pagar_saldo_hoja(text, numeric, date, text, text);
drop table if exists public.pagos_saldo_hoja;

create table public.movimientos_proveedor (
  id uuid primary key default gen_random_uuid(),
  proveedor_id uuid not null references public.proveedores(id),
  proveedor_llave text not null,     -- la misma llave del libro de la hoja: así se suman
  tipo text not null check (tipo in ('compra', 'pago', 'reembolso_pendiente', 'reembolso_realizado')),
  fecha date not null default hoy_planta(),
  monto numeric(14,2) not null check (monto > 0),
  cuenta text references public.cuentas_dinero(clave),
  categoria text,
  factura text,
  descripcion text,
  vence_el date,
  -- De la factura electrónica (XML): el folio fiscal no se repite, así la misma factura
  -- no entra dos veces; PUE = se paga de contado, PPD = a crédito (en parcialidades).
  cfdi_uuid text unique,
  metodo_pago text check (metodo_pago in ('PUE', 'PPD')),
  registrado_por uuid default auth.uid() references public.perfiles(id),
  creado_en timestamptz not null default now()
);
create index movimientos_proveedor_llave on public.movimientos_proveedor (proveedor_llave, fecha);
alter table public.movimientos_proveedor enable row level security;
-- Como el libro de la hoja: trae nómina, préstamos e impuestos. Se escribe con la función.
create policy ver on public.movimientos_proveedor for select to authenticated using ((select puede('finanzas', 2)));
create policy borrar on public.movimientos_proveedor for delete to authenticated using ((select puede('finanzas', 2)));
create trigger auditar after insert or update or delete on public.movimientos_proveedor for each row execute function public.auditar();

-- Signo como en la pestaña Tipo de la hoja: lo que aumenta lo que debemos suma.
create or replace function public.signo_movimiento_proveedor(p_tipo text) returns int
language sql immutable as $$ select case when p_tipo in ('pago', 'reembolso_pendiente') then -1 else 1 end $$;

-- Cada movimiento del ERP y si la hoja ya trae uno igual (entonces no cuenta).
create or replace view public.v_movimientos_proveedor with (security_invoker = true) as
select m.*,
  exists (select 1 from public.historial_compras_hoja h
          where h.proveedor_llave = m.proveedor_llave
            and h.tipo = case m.tipo when 'compra' then 'Compra' when 'pago' then 'Pago'
                                     when 'reembolso_pendiente' then 'Reembolso Pend.' else 'Reembolso Realizado' end
            and abs(h.monto - m.monto) < 0.01 and h.fecha between m.fecha - 7 and m.fecha + 7) as en_hoja
from public.movimientos_proveedor m;

-- Facturas que siguen sin pagar, de la hoja y del ERP: así cada proveedor dice qué
-- facturas debe, cuánto de cada una y cuándo vence, aunque la hoja solo guardara
-- renglones de compra y de pago. 19 de cada 20 pagos de la hoja dicen qué factura
-- pagan: esos se aplican a su factura. Lo demás (pagos sin factura, con una que no casa
-- o de más) se aplica a lo que vence primero, como se paga en la práctica. Aplicarlo
-- todo a lo más viejo dejaba "pendientes" facturas de 2023 que sí se pagaron.
-- El vencimiento de lo de la hoja es fecha + días de crédito del proveedor; el adeudo
-- con que arrancó 2022 cuenta como vencido.
create or replace function public.llave_factura(p text) returns text
language sql immutable as $$ select nullif(ltrim(regexp_replace(upper(coalesce(p, '')), '[^A-Z0-9]', '', 'g'), '0'), '') $$;

create view public.v_compras_proveedor_pendientes with (security_invoker = true) as
with cargos as (
  select 'hoja:' || h.id as id, h.proveedor_llave, h.proveedor_id, h.fecha, h.factura, h.descripcion,
    null::text as categoria, h.monto, h.fecha + coalesce(p.dias_credito, 0) as vence_el, 'hoja'::text as origen,
    llave_factura(h.factura) as fk
  from public.historial_compras_hoja h left join public.proveedores p on p.id = h.proveedor_id
  where h.tipo in ('Compra', 'Adeudo 2021', 'Reembolso Realizado') and h.monto > 0
  union all
  select m.id::text, m.proveedor_llave, m.proveedor_id, m.fecha, m.factura, m.descripcion, m.categoria, m.monto,
    coalesce(m.vence_el, m.fecha), 'erp', llave_factura(m.factura)
  from public.v_movimientos_proveedor m where m.tipo in ('compra', 'reembolso_realizado') and not m.en_hoja
),
abonos as (
  select h.proveedor_llave, llave_factura(h.factura) as fk, h.monto from public.historial_compras_hoja h where h.tipo in ('Pago', 'Reembolso Pend.')
  union all
  -- Un adeudo de 2021 negativo es saldo a favor con que arrancó: abona como un pago sin factura.
  select h.proveedor_llave, null, -h.monto from public.historial_compras_hoja h
  where h.tipo in ('Compra', 'Adeudo 2021', 'Reembolso Realizado') and h.monto < 0
  union all
  select m.proveedor_llave, llave_factura(m.factura), m.monto from public.v_movimientos_proveedor m
  where m.tipo in ('pago', 'reembolso_pendiente') and not m.en_hoja
),
-- Lo pagado a cada factura contra lo cargado con ese número.
por_factura as (
  select a.proveedor_llave, a.fk, a.pagado, coalesce(c.cargado, 0) as cargado
  from (select proveedor_llave, fk, sum(monto) as pagado from abonos where fk is not null group by 1, 2) a
  left join (select proveedor_llave, fk, sum(monto) as cargado from cargos where fk is not null group by 1, 2) c
    on c.proveedor_llave = a.proveedor_llave and c.fk = a.fk
),
-- Lo que queda para aplicar a lo que vence primero: sin factura, con una que no casa, o lo pagado de más.
libre as (
  select x.proveedor_llave, sum(x.monto) as libre from (
    select proveedor_llave, monto from abonos where fk is null
    union all
    select proveedor_llave, pagado - cargado from por_factura where pagado > cargado
  ) x group by x.proveedor_llave
),
directo as (
  select c.*, least(c.monto, greatest(0, coalesce(f.pagado, 0)
      - (sum(c.monto) over (partition by c.proveedor_llave, c.fk order by c.vence_el, c.fecha, c.id) - c.monto))) as pagado_directo
  from cargos c left join por_factura f on f.proveedor_llave = c.proveedor_llave and f.fk = c.fk
),
acum as (
  select d.*, sum(d.monto - d.pagado_directo) over (partition by d.proveedor_llave order by d.vence_el, d.fecha, d.id) as acumulado
  from directo d
)
select a.id, a.proveedor_llave, a.proveedor_id, a.fecha, a.factura, a.descripcion, a.categoria, a.monto, a.vence_el, a.origen,
  -- restante = lo que falta de esta factura: lo que no se le pagó directo, menos lo libre
  -- que alcanza después de cubrir lo que vencía antes.
  greatest(0, least(a.monto - a.pagado_directo, a.acumulado - coalesce(l.libre, 0))) as restante
from acum a left join libre l on l.proveedor_llave = a.proveedor_llave;

-- Saldo por proveedor: lo de la hoja más lo del ERP (sin lo repetido).
create view public.v_saldo_arranque_proveedores with (security_invoker = true) as
with libro as (
  select h.proveedor_llave,
    (array_agg(h.proveedor_id) filter (where h.proveedor_id is not null))[1] as proveedor_id,
    max(h.proveedor_nombre) as nombre_hoja,
    sum(h.monto) filter (where h.tipo = 'Adeudo 2021') as adeudo_2021,
    sum(h.monto) filter (where h.tipo = 'Compra') as comprado,
    sum(h.monto) filter (where h.tipo = 'Pago') as pagado,
    sum(h.monto * signo_compra_hoja(h.tipo)) as saldo_hoja,
    max(h.fecha) filter (where h.tipo = 'Compra') as ultima_compra,
    max(h.fecha) filter (where h.tipo = 'Pago') as ultimo_pago,
    count(*) filter (where h.tipo <> 'Adeudo 2021') as movimientos
  from public.historial_compras_hoja h
  group by h.proveedor_llave
),
erp as (
  select m.proveedor_llave, (array_agg(m.proveedor_id))[1] as proveedor_id,
    coalesce(sum(m.monto) filter (where m.tipo = 'compra' and not m.en_hoja), 0) as comprado_erp,
    coalesce(sum(m.monto) filter (where m.tipo = 'pago' and not m.en_hoja), 0) as pagado_erp,
    coalesce(sum(m.monto * signo_movimiento_proveedor(m.tipo)) filter (where not m.en_hoja), 0) as saldo_erp,
    max(m.fecha) filter (where m.tipo = 'compra') as ultima_compra,
    max(m.fecha) filter (where m.tipo = 'pago') as ultimo_pago,
    count(*) as movimientos
  from public.v_movimientos_proveedor m
  group by m.proveedor_llave
)
select coalesce(l.proveedor_llave, e.proveedor_llave) as proveedor_llave,
  coalesce(l.proveedor_id, e.proveedor_id) as proveedor_id,
  coalesce(p.nombre, l.nombre_hoja) as nombre,
  p.categoria,
  coalesce(p.tipo_acreedor, 'proveedor') as tipo_acreedor,
  l.adeudo_2021, l.comprado, l.pagado,
  coalesce(l.saldo_hoja, 0) as saldo_hoja,
  coalesce(e.comprado_erp, 0) as comprado_erp,
  coalesce(e.pagado_erp, 0) as pagado_erp,
  coalesce(l.saldo_hoja, 0) + coalesce(e.saldo_erp, 0) as saldo,
  greatest(l.ultima_compra, e.ultima_compra) as ultima_compra,
  greatest(l.ultimo_pago, e.ultimo_pago) as ultimo_pago,
  coalesce(l.movimientos, 0) + coalesce(e.movimientos, 0) as movimientos,
  coalesce(f.vencido, 0) as vencido,
  f.proximo_vence
from libro l
full join erp e on e.proveedor_llave = l.proveedor_llave
left join public.proveedores p on p.id = coalesce(l.proveedor_id, e.proveedor_id)
-- Una pasada por todas las facturas, no una por proveedor (la vista de pendientes es pesada).
left join (
  select c.proveedor_llave, sum(c.restante) filter (where c.vence_el < hoy_planta()) as vencido,
         min(c.vence_el) filter (where c.vence_el >= hoy_planta() and c.restante > 0) as proximo_vence
  from public.v_compras_proveedor_pendientes c group by c.proveedor_llave
) f on f.proveedor_llave = coalesce(l.proveedor_llave, e.proveedor_llave);

-- Registrar una compra, un pago o un reembolso. Un pago mayor que el saldo deja un
-- anticipo (pasa con importaciones): se permite solo si se pide a propósito, para
-- que un cero de más no se vuelva un "anticipo" que nadie pidió.
create or replace function public.registrar_movimiento_proveedor(
  p_proveedor uuid, p_tipo text, p_monto numeric, p_fecha date default null, p_cuenta text default null,
  p_factura text default null, p_descripcion text default null, p_vence date default null,
  p_categoria text default null, p_anticipo boolean default false,
  p_cfdi_uuid text default null, p_metodo_pago text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_llave text; v_prov proveedores; v_fecha date := coalesce(p_fecha, hoy_planta()); v_saldo numeric; v_id uuid;
begin
  if not puede('finanzas', 2) then raise exception 'Solo finanzas registra compras y pagos a proveedores' using errcode = '42501'; end if;
  if coalesce(p_monto, 0) <= 0 then raise exception 'El monto tiene que ser mayor a cero' using errcode = '22023'; end if;
  if v_fecha > hoy_planta() then raise exception 'La fecha no puede ser futura' using errcode = '22023'; end if;
  if p_tipo not in ('compra', 'pago', 'reembolso_pendiente', 'reembolso_realizado') then
    raise exception 'Tipo de movimiento desconocido: %', p_tipo using errcode = '22023';
  end if;
  if p_tipo = 'pago' and p_cuenta is null then raise exception 'Di de qué cuenta salió el pago' using errcode = '22023'; end if;
  if p_cfdi_uuid is not null and exists (select 1 from movimientos_proveedor where cfdi_uuid = upper(trim(p_cfdi_uuid))) then
    raise exception 'Esa factura (folio fiscal %) ya está registrada', upper(trim(p_cfdi_uuid)) using errcode = '23505';
  end if;
  select * into v_prov from proveedores where id = p_proveedor;
  if not found then raise exception 'No existe ese proveedor' using errcode = '22023'; end if;
  -- La llave del libro de la hoja, para que hoja y ERP sumen en el mismo renglón.
  v_llave := coalesce(
    (select proveedor_llave from historial_compras_hoja where proveedor_id = p_proveedor order by fecha desc limit 1),
    (select proveedor_llave from movimientos_proveedor where proveedor_id = p_proveedor limit 1),
    case when v_prov.legacy_id like 'PROV:%' then substr(v_prov.legacy_id, 6) end,
    'erp:' || p_proveedor::text);
  perform pg_advisory_xact_lock(hashtext('movimiento_proveedor:' || v_llave));
  if p_tipo = 'pago' and not p_anticipo then
    select saldo into v_saldo from v_saldo_arranque_proveedores where proveedor_llave = v_llave;
    if p_monto > coalesce(v_saldo, 0) + 0.5 then
      raise exception 'El pago (%) es mayor que lo que se le debe (%): si es un anticipo, márcalo como anticipo',
        to_char(p_monto, 'FM$999,999,990.00'), to_char(greatest(coalesce(v_saldo, 0), 0), 'FM$999,999,990.00') using errcode = '22023';
    end if;
  end if;
  insert into movimientos_proveedor (proveedor_id, proveedor_llave, tipo, fecha, monto, cuenta, categoria, factura, descripcion, vence_el,
    cfdi_uuid, metodo_pago)
  values (p_proveedor, v_llave, p_tipo, v_fecha, round(p_monto, 2), p_cuenta,
    case when p_tipo = 'compra' then coalesce(nullif(trim(p_categoria), ''), v_prov.categoria) end,
    nullif(trim(p_factura), ''), nullif(trim(p_descripcion), ''),
    case when p_tipo = 'compra' then coalesce(p_vence, v_fecha + coalesce(v_prov.dias_credito, 0)) end,
    upper(nullif(trim(p_cfdi_uuid), '')), case when p_tipo = 'compra' then p_metodo_pago end)
  returning id into v_id;
  return v_id;
end $$;
revoke execute on function public.registrar_movimiento_proveedor(uuid, text, numeric, date, text, text, text, date, text, boolean, text, text) from public, anon;
grant execute on function public.registrar_movimiento_proveedor(uuid, text, numeric, date, text, text, text, date, text, boolean, text, text) to authenticated;

-- Finanzas da de alta al que le factura algo que Compras nunca compró (la luz, un
-- servicio, un flete) sin pedírselo a Compras: con nombre y RFC, como viene en la
-- factura. Si el RFC ya existe, regresa ese proveedor (no se duplica).
create or replace function public.alta_proveedor_finanzas(p_nombre text, p_rfc text default null, p_categoria text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_rfc text := upper(nullif(trim(p_rfc), ''));
begin
  if not puede('finanzas', 2) then raise exception 'Solo finanzas da de alta proveedores desde una factura' using errcode = '42501'; end if;
  if nullif(trim(p_nombre), '') is null then raise exception 'Escribe el nombre del proveedor' using errcode = '22023'; end if;
  if v_rfc is not null then
    select id into v_id from proveedores where upper(rfc) = v_rfc order by activo desc, creado_en limit 1;
    if found then return v_id; end if;
  end if;
  insert into proveedores (nombre, razon_social, rfc, categoria) values (trim(p_nombre), trim(p_nombre), v_rfc, nullif(trim(p_categoria), ''))
  returning id into v_id;
  return v_id;
end $$;

-- Los días de crédito deciden cuándo vence cada factura (también las de la hoja, que se
-- calculan con el dato de hoy). Muchos proveedores llegaron de la hoja con 0: Finanzas,
-- que es quien negocia el pago, los corrige sin pasar por Compras.
create or replace function public.fijar_credito_proveedor(p_proveedor uuid, p_dias int)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not puede('finanzas', 2) then raise exception 'Solo finanzas cambia los días de crédito' using errcode = '42501'; end if;
  if p_dias is null or p_dias < 0 or p_dias > 365 then raise exception 'Los días de crédito van de 0 a 365' using errcode = '22023'; end if;
  update proveedores set dias_credito = p_dias, actualizado_en = now() where id = p_proveedor;
  if not found then raise exception 'No existe ese proveedor' using errcode = '22023'; end if;
end $$;
revoke execute on function public.alta_proveedor_finanzas(text, text, text) from public, anon;
revoke execute on function public.fijar_credito_proveedor(uuid, int) from public, anon;
grant execute on function public.alta_proveedor_finanzas(text, text, text) to authenticated;
grant execute on function public.fijar_credito_proveedor(uuid, int) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Cobros a los saldos de clientes que vienen de la hoja
-- ---------------------------------------------------------------------------
create table public.cobros_saldo_hoja (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  fecha date not null default hoy_planta(),
  monto numeric(14,2) not null check (monto > 0),
  cuenta text not null references public.cuentas_dinero(clave),
  referencia text,
  registrado_por uuid default auth.uid() references public.perfiles(id),
  creado_en timestamptz not null default now()
);
create index cobros_saldo_hoja_cliente on public.cobros_saldo_hoja (cliente_id, fecha);
alter table public.cobros_saldo_hoja enable row level security;
-- Lo ve quien ve el libro de ventas de ese cliente (finanzas, la gerencia y su vendedor).
create policy ver on public.cobros_saldo_hoja for select to authenticated using (
  (select puede('finanzas', 1)) or (select puede('ventas', 3)) or (cliente_id in (select mis_clientes_visibles())));
create policy borrar on public.cobros_saldo_hoja for delete to authenticated using ((select puede('finanzas', 2)));
create trigger auditar after insert or update or delete on public.cobros_saldo_hoja for each row execute function public.auditar();

create or replace view public.v_cobros_saldo_hoja with (security_invoker = true) as
select c.*,
  exists (select 1 from public.historial_ventas_hoja h
          where h.cliente_id = c.cliente_id and h.tipo = 'Pago'
            and abs(h.monto - c.monto) < 0.01 and h.fecha between c.fecha - 7 and c.fecha + 7) as en_hoja
from public.cobros_saldo_hoja c;

-- Mismas columnas de siempre (las usan el tablero y la ficha del cliente) más lo cobrado en el ERP.
create or replace view public.v_saldo_arranque_clientes with (security_invoker = true) as
select h.cliente_id, c.nombre, c.vendedor_id,
  sum(h.monto) filter (where h.tipo = 'Venta') as vendido,
  sum(h.monto) filter (where h.tipo = 'Pago') as pagado,
  coalesce(sum(h.monto) filter (where h.tipo = 'Venta'), 0) - coalesce(sum(h.monto) filter (where h.tipo = 'Pago'), 0)
    - coalesce(sum(h.monto) filter (where h.tipo like 'Reembolso/NC aplicado%'), 0)
    - coalesce(max(e.cobrado), 0) as saldo,
  max(h.fecha) filter (where h.tipo = 'Venta') as ultima_venta,
  greatest(max(h.fecha) filter (where h.tipo = 'Pago'), max(e.ultimo)) as ultimo_pago,
  coalesce(max(e.cobrado), 0) as cobrado_erp
from public.historial_ventas_hoja h
join public.clientes c on c.id = h.cliente_id
left join (select cliente_id, sum(monto) filter (where not en_hoja) as cobrado, max(fecha) as ultimo
           from public.v_cobros_saldo_hoja group by cliente_id) e on e.cliente_id = h.cliente_id
group by h.cliente_id, c.nombre, c.vendedor_id;

create or replace function public.registrar_cobro_saldo_hoja(p_cliente uuid, p_monto numeric, p_cuenta text,
  p_fecha date default null, p_referencia text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_saldo numeric; v_id uuid; v_fecha date := coalesce(p_fecha, hoy_planta());
begin
  if not puede('finanzas', 2) then raise exception 'Solo finanzas registra cobros' using errcode = '42501'; end if;
  if coalesce(p_monto, 0) <= 0 then raise exception 'El monto tiene que ser mayor a cero' using errcode = '22023'; end if;
  if v_fecha > hoy_planta() then raise exception 'La fecha no puede ser futura' using errcode = '22023'; end if;
  perform pg_advisory_xact_lock(hashtext('cobro_saldo_hoja:' || p_cliente::text));
  select saldo into v_saldo from v_saldo_arranque_clientes where cliente_id = p_cliente;
  if v_saldo is null then raise exception 'Ese cliente no tiene saldo en la hoja' using errcode = '22023'; end if;
  -- Un cobro de más es un error de dedo o un anticipo de un pedido nuevo (va en el pedido).
  if p_monto > v_saldo + 0.5 then
    raise exception 'El cobro (%) es mayor que el saldo (%)', to_char(p_monto, 'FM$999,999,990.00'), to_char(v_saldo, 'FM$999,999,990.00')
      using errcode = '22023';
  end if;
  insert into cobros_saldo_hoja (cliente_id, fecha, monto, cuenta, referencia)
  values (p_cliente, v_fecha, round(p_monto, 2), p_cuenta, nullif(trim(p_referencia), ''))
  returning id into v_id;
  return v_id;
end $$;
revoke execute on function public.registrar_cobro_saldo_hoja(uuid, numeric, text, date, text) from public, anon;
grant execute on function public.registrar_cobro_saldo_hoja(uuid, numeric, text, date, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Caja chica
-- ---------------------------------------------------------------------------
create table public.caja_chica (
  id bigserial primary key,
  fecha date not null default hoy_planta(),
  tipo text not null check (tipo in ('entrada', 'salida', 'arqueo')),
  importe numeric(12,2) not null check (importe <> 0),   -- con signo: + entra, − sale (el arqueo, lo que sobró o faltó)
  concepto text not null,
  en_turno text,                                          -- quién la llevaba ese día (en la hoja era texto libre)
  notas text,
  origen text not null default 'erp' check (origen in ('erp', 'hoja')),
  fila_origen int,
  registrado_por uuid default auth.uid() references public.perfiles(id),
  creado_en timestamptz not null default now(),
  check ((tipo = 'entrada' and importe > 0) or (tipo = 'salida' and importe < 0) or tipo = 'arqueo')
);
create index caja_chica_fecha on public.caja_chica (fecha, id);
alter table public.caja_chica enable row level security;
create policy ver on public.caja_chica for select to authenticated using ((select puede('finanzas', 2)));
-- Lo capturado mal se borra (queda en la bitácora); lo de la hoja no se toca.
create policy borrar on public.caja_chica for delete to authenticated using ((select puede('finanzas', 2)) and origen = 'erp');
create trigger auditar after insert or update or delete on public.caja_chica for each row execute function public.auditar();

-- Si dos personas llevan la caja (una captura, otra arquea), cada una ve el saldo al momento.
do $$ begin
  alter publication supabase_realtime add table public.caja_chica;
exception when duplicate_object then null; when undefined_object then null;
end $$;

create or replace view public.v_caja_chica with (security_invoker = true) as
select k.*, sum(k.importe) over (order by k.fecha, k.id) as saldo
from public.caja_chica k;

create or replace function public.registrar_caja_chica(p_tipo text, p_monto numeric, p_concepto text,
  p_fecha date default null, p_notas text default null) returns bigint
language plpgsql security definer set search_path = public as $$
declare v_id bigint; v_fecha date := coalesce(p_fecha, hoy_planta());
begin
  if not puede('finanzas', 2) then raise exception 'Solo finanzas lleva la caja chica' using errcode = '42501'; end if;
  if p_tipo not in ('entrada', 'salida') then raise exception 'Es entrada o salida' using errcode = '22023'; end if;
  if coalesce(p_monto, 0) <= 0 then raise exception 'El monto tiene que ser mayor a cero' using errcode = '22023'; end if;
  if nullif(trim(p_concepto), '') is null then raise exception 'Escribe el concepto' using errcode = '22023'; end if;
  if v_fecha > hoy_planta() then raise exception 'La fecha no puede ser futura' using errcode = '22023'; end if;
  insert into caja_chica (fecha, tipo, importe, concepto, notas, en_turno)
  values (v_fecha, p_tipo, case when p_tipo = 'entrada' then round(p_monto, 2) else -round(p_monto, 2) end, trim(p_concepto),
          nullif(trim(p_notas), ''), (select nombre from perfiles where id = auth.uid()))
  returning id into v_id;
  return v_id;
end $$;

-- Arqueo: se cuenta el efectivo y la diferencia contra el saldo queda como movimiento.
create or replace function public.arqueo_caja_chica(p_contado numeric, p_nota text default null) returns numeric
language plpgsql security definer set search_path = public as $$
declare v_saldo numeric; v_dif numeric;
begin
  if not puede('finanzas', 2) then raise exception 'Solo finanzas lleva la caja chica' using errcode = '42501'; end if;
  if p_contado is null or p_contado < 0 then raise exception 'Escribe cuánto efectivo contaste' using errcode = '22023'; end if;
  perform pg_advisory_xact_lock(hashtext('caja_chica'));
  select coalesce(sum(importe), 0) into v_saldo from caja_chica;
  v_dif := round(p_contado - v_saldo, 2);
  if v_dif <> 0 then
    insert into caja_chica (tipo, importe, concepto, notas, en_turno)
    values ('arqueo', v_dif, case when v_dif > 0 then 'Arqueo: sobrante' else 'Arqueo: faltante' end,
            coalesce(nullif(trim(p_nota), ''), format('Se contaron %s; el sistema decía %s', to_char(p_contado, 'FM$999,999,990.00'), to_char(v_saldo, 'FM$999,999,990.00'))),
            (select nombre from perfiles where id = auth.uid()));
  end if;
  return v_dif;
end $$;
revoke execute on function public.registrar_caja_chica(text, numeric, text, date, text) from public, anon;
revoke execute on function public.arqueo_caja_chica(numeric, text) from public, anon;
grant execute on function public.registrar_caja_chica(text, numeric, text, date, text) to authenticated;
grant execute on function public.arqueo_caja_chica(numeric, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Hallazgos: ya no es "de la hoja", es la cuenta de cada proveedor.
-- ---------------------------------------------------------------------------
create or replace function public.hallazgos_compras_hoja(p_area text default 'direccion')
returns table (area text, tono text, titulo text, detalle text, ruta text, peso int)
language plpgsql stable security invoker as $$
declare v_debe numeric; v_venc numeric; v_n int; v_mayor text;
begin
  if not puede('finanzas', 2) then return; end if;
  select coalesce(sum(saldo) filter (where saldo > 1), 0), coalesce(sum(vencido), 0), count(*) filter (where saldo > 1)
  into v_debe, v_venc, v_n from v_saldo_arranque_proveedores where tipo_acreedor = 'proveedor';
  if v_debe <= 0 then return; end if;
  select nombre into v_mayor from v_saldo_arranque_proveedores where saldo > 1 and tipo_acreedor = 'proveedor' order by saldo desc limit 1;
  return query select 'finanzas'::text, case when v_venc > 0 then 'atencion' else 'info' end,
    format('%s por pagar a %s proveedores', texto_dinero(v_debe), v_n)
      || case when v_venc > 0 then format(' (%s vencido)', texto_dinero(v_venc)) else '' end,
    format('Lo que viene de la hoja más lo registrado en el ERP (el mayor: %s). Compras y pagos se registran en Pagos a proveedores; préstamos de socios y créditos van aparte.', v_mayor),
    '/finanzas/pagos'::text, case when v_venc > 0 then 30 else 72 end;
end $$;

-- Caja chica abajo del mínimo: toca reponer.
create or replace function public.hallazgos_caja_chica(p_area text default 'direccion')
returns table (area text, tono text, titulo text, detalle text, ruta text, peso int)
language plpgsql stable security invoker as $$
declare v_saldo numeric; v_min numeric := coalesce((select (valor #>> '{}')::numeric from configuracion where clave = 'caja_chica_minimo'), 500);
begin
  if not puede('finanzas', 2) then return; end if;
  if not exists (select 1 from caja_chica where origen = 'erp') then return; end if;   -- hasta que se use aquí
  select coalesce(sum(importe), 0) into v_saldo from caja_chica;
  if v_saldo >= v_min then return; end if;
  return query select 'finanzas'::text, 'atencion'::text,
    format('Caja chica en %s: abajo del mínimo de %s', texto_dinero(v_saldo), texto_dinero(v_min)),
    'Toca reponer el efectivo de caja chica.'::text, '/finanzas/caja-chica'::text, 40;
end $$;

-- ---------------------------------------------------------------------------
-- 5. Tablero: lo vencido de las cuentas de proveedores también cuenta como vencido
--    (antes solo las órdenes de compra, que casi no se usan todavía).
-- ---------------------------------------------------------------------------
create or replace function public.tablero_direccion() returns jsonb
language plpgsql stable security invoker as $$
declare
  r jsonb := '{}'::jsonb;
  v_hoy date := (now() at time zone 'America/Mexico_City')::date;
  v_mes date := date_trunc('month', v_hoy);
  v_anio date := date_trunc('year', v_hoy);
  v_dia_anio int := v_hoy - date_trunc('year', v_hoy)::date + 1;
begin
  if puede('ventas', 3) or puede('finanzas', 1) then
    r := r || jsonb_build_object('ventas', (
      -- Todo contra el mismo tramo del año pasado: comparar el mes en curso (3 días)
      -- contra el mes completo del año pasado siempre sale en rojo.
      with c as (select ventas_entre(v_anio, v_hoy) anio,
                        ventas_entre((v_anio - interval '1 year')::date, (v_hoy - interval '1 year')::date) misma_fecha,
                        ventas_entre((v_anio - interval '1 year')::date, (v_anio - interval '1 day')::date) anterior_total)
      select jsonb_build_object(
        'mes', ventas_entre(v_mes, v_hoy),
        'mes_anio_anterior', ventas_entre((v_mes - interval '1 year')::date, (v_hoy - interval '1 year')::date),
        'anio', c.anio,
        'anio_anterior_misma_fecha', c.misma_fecha,
        'anio_anterior_total', c.anterior_total,
        -- "A este ritmo" con la estacionalidad del año pasado: si vamos 22 % arriba a
        -- la misma fecha, cerramos 22 % arriba de lo que cerró. La lineal (× 365 / día)
        -- subestima cuando el último trimestre es fuerte, como en 2025.
        'proyeccion_anio', round(case when c.misma_fecha > 0 and c.anterior_total > 0
                                      then c.anterior_total * c.anio / c.misma_fecha
                                      else c.anio * 365.0 / v_dia_anio end),
        'serie_12', (select jsonb_agg(jsonb_build_object('mes', x.mes, 'monto', x.monto) order by x.mes)
                     from ventas_historicas_mes((v_mes - interval '11 months')::date) x)
      ) from c),
      'top_clientes', (
        select coalesce(jsonb_agg(t order by t.monto desc), '[]') from (
          select c.id, c.nombre, round(sum(x.monto)) monto from (
            select h.cliente_id, h.monto from historial_ventas_hoja h where h.tipo = 'Venta' and h.fecha >= v_anio
            union all
            select p.cliente_id, p.total * p.tipo_cambio from pedidos p where not p.historico and p.estado <> 'cancelado' and p.fecha >= v_anio
              and p.fecha >= coalesce((select (valor #>> '{}')::date from configuracion where clave = 'fecha_arranque'), current_date)
          ) x join clientes c on c.id = x.cliente_id group by c.id, c.nombre order by sum(x.monto) desc limit 8) t));
  end if;

  if puede('ventas', 3) then
    r := r || jsonb_build_object('embudo', (
      select coalesce(jsonb_agg(jsonb_build_object('etapa', e.etapa, 'n', coalesce(o.n, 0), 'monto', coalesce(o.monto, 0)) order by e.ord), '[]')
      from (values ('prospecto', 1), ('contactado', 2), ('cotizado', 3), ('negociacion', 4)) e(etapa, ord)
      left join (select etapa::text, count(*) n, sum(monto_estimado) monto from oportunidades where etapa not in ('ganada', 'perdida') group by etapa) o
        on o.etapa = e.etapa),
      'cotizaciones', (
        select jsonb_build_object(
          'abiertas', count(*) filter (where estado in ('enviada', 'autorizada') and fecha + vigencia_dias >= v_hoy),
          'monto_abierto', coalesce(sum(total * tipo_cambio) filter (where estado in ('enviada', 'autorizada') and fecha + vigencia_dias >= v_hoy), 0),
          'por_autorizar', count(*) filter (where estado = 'por_autorizar'),
          'cierre_90d', round(count(*) filter (where estado = 'aceptada' and fecha >= v_hoy - 90)::numeric
                         / nullif(count(*) filter (where estado in ('aceptada', 'rechazada', 'vencida') and fecha >= v_hoy - 90), 0), 3),
          'del_mes', count(*) filter (where fecha >= v_mes))
        from cotizaciones),
      'vendedores', (
        select coalesce(jsonb_agg(jsonb_build_object('nombre', c.vendedor, 'maquinaria', c.venta_maquinaria + c.venta_otros,
          'refacciones', c.venta_refacciones, 'siguiente_meta', c.siguiente_meta, 'comision', c.total) order by c.venta_maquinaria + c.venta_otros desc), '[]')
        from comisiones_mes(v_mes) c),
      'canales', (
        select coalesce(jsonb_agg(jsonb_build_object('canal', canal, 'monto', monto) order by monto desc), '[]') from (
          select p.canal::text canal, round(sum(p.subtotal * p.tipo_cambio)) monto from pedidos p
          where p.estado <> 'cancelado' and p.fecha >= v_anio group by 1) x));
  end if;

  if puede('produccion', 1) then
    r := r || jsonb_build_object('produccion', (
      select jsonb_build_object(
        'abiertas', count(*), 'atrasadas', count(*) filter (where atrasada), 'en_proceso', count(*) filter (where estado = 'en_proceso'),
        'con_faltantes', count(*) filter (where materiales_faltantes > 0),
        'a_tiempo_90d', (select round(count(*) filter (where terminada_en::date <= fecha_compromiso)::numeric / nullif(count(*), 0), 3)
                         from ordenes_produccion where terminada_en >= v_hoy - 90 and fecha_compromiso is not null),
        'terminadas_mes', (select count(*) from ordenes_produccion where terminada_en >= v_mes),
        'carga', (select coalesce(jsonb_agg(jsonb_build_object('etapa', nombre, 'color', color, 'horas', horas_pendientes,
                    'semanas', round(horas_pendientes / nullif(capacidad_horas_semana, 0), 1)) order by orden), '[]') from v_carga_etapas))
      from v_tablero_produccion));
  end if;

  if puede('inventario', 1) and puede('costos', 1) then
    r := r || jsonb_build_object('inventario', (
      with re as (select * from reabasto())
      select jsonb_build_object(
        'valor', (select round(sum(e.cantidad * cc.costo_total)) from existencias e join costos_calculados cc using (articulo_id) where e.cantidad > 0),
        'por_almacen', (select coalesce(jsonb_agg(jsonb_build_object('almacen', a.nombre, 'valor', x.v) order by x.v desc), '[]') from (
            select e.almacen_id, round(sum(e.cantidad * cc.costo_total)) v from existencias e join costos_calculados cc using (articulo_id)
            where e.cantidad > 0 group by 1) x join almacenes a on a.id = x.almacen_id),
        'excedentes_valor', (select round(sum(re.en_planta * cc.costo_total)) from re join costos_calculados cc on cc.articulo_id = re.articulo_id where re.estado = 'excedente'),
        'excedentes_n', (select count(*) from re where estado = 'excedente'),
        'a_ordenar_n', (select count(*) from re where estado = 'ordenar'),
        'inversion_sugerida', (select round(sum(re.sugerido * cc.costo_total)) from re join costos_calculados cc on cc.articulo_id = re.articulo_id where re.estado = 'ordenar'),
        'importados_en_riesgo_n', (select count(*) from re where es_importado and estado = 'ordenar'),
        'importados_en_riesgo', (select coalesce(jsonb_agg(jsonb_build_object('id', articulo_id, 'nombre', nombre, 'disponible', disponible,
                                   'reorden', punto_reorden, 'dias', dias_entrega) order by disponible - punto_reorden), '[]')
                                 from (select * from re where es_importado and estado = 'ordenar' order by disponible - punto_reorden limit 6) i),
        'ajustes_pendientes', (select count(*) from ajustes_inventario where estado = 'pendiente'))));
  end if;

  if puede('costos', 1) then
    r := r || jsonb_build_object('costos_al_alza', (
      select coalesce(jsonb_agg(t order by t.cambio desc), '[]') from (
        select a.id, a.nombre, h.costo_anterior, h.costo_nuevo, round(h.costo_nuevo / nullif(h.costo_anterior, 0) - 1, 4) cambio, h.en,
          (select count(*) from donde_se_usa(a.id)) equipos
        from historial_costos h join articulos a on a.id = h.articulo_id
        where h.en >= v_hoy - 30 and h.costo_anterior > 0 and h.costo_nuevo > h.costo_anterior * 1.03
        order by h.costo_nuevo / h.costo_anterior desc limit 6) t),
      'equipos_que_subieron', (
        select coalesce(jsonb_agg(t order by t.cambio desc), '[]') from (
          select a.id, a.clave, a.nombre, u.precio_lista precio, round(u.precio_lista / nullif(p.precio_lista, 0) - 1, 4) cambio
          from articulos a
          join lateral (select precio_lista from historial_costeo where articulo_id = a.id and precio_lista is not null order by en desc limit 1) u on true
          join lateral (select precio_lista from historial_costeo where articulo_id = a.id and precio_lista is not null and en < v_hoy - 30 order by en desc limit 1) p on true
          where a.tipo = 'equipo' and u.precio_lista <> p.precio_lista
          order by abs(u.precio_lista / nullif(p.precio_lista, 0) - 1) desc limit 6) t));
  end if;

  if puede('finanzas', 1) then
    r := r || jsonb_build_object('cobranza', (
      select jsonb_build_object(
        'erp', (select coalesce(sum(saldo), 0) from v_saldos_pedido where saldo > 0),
        'arranque', (select coalesce(sum(saldo), 0) from v_saldo_arranque_clientes where saldo > 1),
        'antiguedad', (select jsonb_build_object(
            'd0_30', coalesce(sum(saldo) filter (where v_hoy - fecha <= 30), 0),
            'd31_60', coalesce(sum(saldo) filter (where v_hoy - fecha between 31 and 60), 0),
            'd61_90', coalesce(sum(saldo) filter (where v_hoy - fecha between 61 and 90), 0),
            'd90', coalesce(sum(saldo) filter (where v_hoy - fecha > 90), 0))
          from v_saldos_pedido where saldo > 0),
        'cobrado_mes', (select coalesce(sum(monto), 0) from cobros where fecha >= v_mes)
          + (select coalesce(sum(monto), 0) from historial_ventas_hoja where tipo = 'Pago' and fecha >= v_mes))),
      'por_pagar', (select jsonb_build_object(
          'total', coalesce(sum(saldo * case when moneda = 'MXN' then 1 else tc(moneda) end), 0),
          'vencido', coalesce(sum(saldo * case when moneda = 'MXN' then 1 else tc(moneda) end) filter (where vence_pago < v_hoy), 0),
          -- Lo que la hoja dice que debemos (solo saldos a cargo) y lo que nos deben los
          -- proveedores (anticipos y reembolsos): no se netean, son cosas distintas.
          -- La cuenta de cada proveedor (lo de la hoja más lo registrado aquí sin orden de compra).
          'arranque', (select coalesce(sum(saldo), 0) from v_saldo_arranque_proveedores where saldo > 1 and tipo_acreedor = 'proveedor'),
          'arranque_vencido', (select coalesce(sum(vencido), 0) from v_saldo_arranque_proveedores where tipo_acreedor = 'proveedor'),
          'arranque_a_favor', (select coalesce(-sum(saldo), 0) from v_saldo_arranque_proveedores where saldo < -1 and tipo_acreedor = 'proveedor'),
          -- Préstamos de socios y créditos de banco: deuda, pero no con proveedores.
          'socios', (select coalesce(sum(saldo), 0) from v_saldo_arranque_proveedores where saldo > 1 and tipo_acreedor = 'socio'),
          'financiamiento', (select coalesce(sum(saldo), 0) from v_saldo_arranque_proveedores where saldo > 1 and tipo_acreedor = 'financiamiento'))
        from v_cuentas_por_pagar where saldo > 0));
  end if;

  return r || jsonb_build_object('generado', now());
end $$;

-- Inicio (el tablero de cada quien) dice lo mismo que Pagos y que el de dirección. Es la
-- versión de 076 (la que separa lo que ve almacén) con este único cambio.
CREATE OR REPLACE FUNCTION public.indicadores()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
AS $function$
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
    -- Órdenes de compra más la cuenta de cada proveedor (hoja y compras sin orden), como en
    -- Pagos. La cuenta solo la ve finanzas 2: para compras esa parte suma cero (RLS).
    r := r || jsonb_build_object('por_pagar', (
      select jsonb_build_object('total', o.total + c.debe, 'vencido', o.vencido + c.vencido)
      from (select coalesce(sum(saldo * case when moneda = 'MXN' then 1 else tc(moneda) end), 0) as total,
                   coalesce(sum(saldo * case when moneda = 'MXN' then 1 else tc(moneda) end) filter (where vence_pago < current_date), 0) as vencido
            from v_cuentas_por_pagar where saldo > 0) o,
           (select coalesce(sum(saldo) filter (where saldo > 1), 0) as debe, coalesce(sum(vencido), 0) as vencido
            from v_saldo_arranque_proveedores where tipo_acreedor = 'proveedor') c));
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
      'oc_abiertas', (select count(*) from v_ordenes_compra where estado in ('enviada', 'parcial')),
      'oc_atrasadas', (select count(*) from v_ordenes_compra where estado in ('enviada', 'parcial') and fecha_entrega < current_date),
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
end $function$;

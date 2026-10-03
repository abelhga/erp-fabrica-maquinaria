-- =============================================================================
-- Historial de ventas y cobros de la hoja "BASE DE DATOS ACTUAL" (2022 → hoy).
--
-- Es un libro de movimientos (Venta / Pago / Reembolso) ligado por NOMBRE de
-- cliente. Entra como archivo de solo lectura: sirve para ver qué ha comprado
-- cada cliente y cuánto debía al arrancar el ERP (saldo de arranque), sin
-- inventar pedidos ni cobros que el ERP no registró.
-- =============================================================================

create table public.historial_ventas_hoja (
  id bigserial primary key,
  fecha date not null,
  cliente_id uuid references public.clientes(id) on delete set null,
  cliente_nombre text not null,
  tipo text not null,                 -- Venta, Pago, Reembolso/NC aplicado, Reembolso/NC pend
  monto numeric(14,2) not null,       -- tal como la hoja: neto (con IVA cuando hubo factura)
  cuenta text,
  descripcion text,
  factura text,
  pedido text,
  fila_origen int
);
create index hist_ventas_cliente on public.historial_ventas_hoja (cliente_id, fecha desc);
create index hist_ventas_fecha on public.historial_ventas_hoja (fecha);

-- Saldo de arranque por cliente según la hoja: ventas − pagos − notas de crédito aplicadas.
create or replace view public.v_saldo_arranque_clientes with (security_invoker = true) as
select h.cliente_id, c.nombre, c.vendedor_id,
  sum(h.monto) filter (where h.tipo = 'Venta') as vendido,
  sum(h.monto) filter (where h.tipo = 'Pago') as pagado,
  coalesce(sum(h.monto) filter (where h.tipo = 'Venta'), 0) - coalesce(sum(h.monto) filter (where h.tipo = 'Pago'), 0)
    - coalesce(sum(h.monto) filter (where h.tipo like 'Reembolso/NC aplicado%'), 0) as saldo,
  max(h.fecha) filter (where h.tipo = 'Venta') as ultima_venta,
  max(h.fecha) filter (where h.tipo = 'Pago') as ultimo_pago
from public.historial_ventas_hoja h join public.clientes c on c.id = h.cliente_id
group by h.cliente_id, c.nombre, c.vendedor_id;

alter table public.historial_ventas_hoja enable row level security;
-- Como los contactos: el dueño de la cuenta, la gerencia y finanzas.
create policy ver on public.historial_ventas_hoja for select to authenticated
  using ((select puede('finanzas', 1)) or (cliente_id is not null and cliente_visible(cliente_id)));

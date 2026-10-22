-- =============================================================================
-- Lo que Mercado Libre regresa de cada venta, tal cual, para verlo antes de usarlo.
--
-- Las tres ventas que trajo «Traer lo pendiente» salían sin pagar (no se registraba el
-- cobro), sin lo que ML descuenta (comisión, envío, retenciones) y con el envío del ERP en
-- «solicitado» aunque ML ya lo llevaba en camino. Antes de decidir de qué campo sale cada
-- cosa hay que ver lo que de verdad manda ML para la cuenta de Hegamex: la orden con sus
-- pagos, el envío, lo que costó el envío y el pago en Mercado Pago. Se guarda aquí, sin
-- crear pedidos y sin políticas (solo la función de borde escribe y nadie lo lee desde la
-- API: trae datos del comprador).
-- =============================================================================
create table if not exists public.ml_crudo (
  order_id text primary key,
  orden jsonb,
  envio jsonb,
  costos_envio jsonb,
  pagos jsonb,
  actualizado_en timestamptz not null default now()
);
alter table public.ml_crudo enable row level security;
revoke all on public.ml_crudo from anon, authenticated;

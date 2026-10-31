-- =============================================================================
-- Lo que se quedó Mercado Libre antes de conectar la cuenta.
--
-- Resultados toma la línea «Mercado Libre» de ml_pagos (comisión, envío que paga Hegamex y otros
-- cargos de cada venta), y ml_pagos solo tenía lo que llegó desde que se conectó la cuenta (19 de
-- octubre de 2026): todo lo anterior salía en $0. La hoja tampoco lo tenía: ML se cobra antes de
-- depositar, así que nunca pasó como una compra. Los meses pasados se veían con más utilidad de
-- la real.
--
-- La función de borde trae de ML, mes por mes, cada venta pasada con el detalle de Mercado Pago, y
-- aquí se guarda solo su cargo: el renglón de la venta va SIN pedido (las ventas de antes ya están
-- en la hoja; crear pedidos las duplicaría) y _ml_pagos con pedido nulo no registra cobros. Una
-- venta que el ERP ya conocía no se toca.
-- =============================================================================

alter table public.ml_ventas add column if not exists historial boolean not null default false;
comment on column public.ml_ventas.historial is 'Venta de antes de conectar la cuenta, traída solo por sus cargos (sin pedido).';

create or replace function public.ml_registrar_historial(p jsonb) returns text
language plpgsql security definer set search_path = public as $$
declare v_id text := nullif(trim(p->>'id'), '');
begin
  if v_id is null then return 'sin_id'; end if;
  if exists (select 1 from ml_ventas where order_id = v_id) then return 'ya_estaba'; end if;
  insert into ml_ventas (order_id, pedido_id, full_ml, pack_id, comprador, estado, nota, historial)
  values (v_id, null, coalesce((p->>'full')::boolean, false), nullif(p->>'pack_id', ''), nullif(p->>'comprador', ''),
          nullif(p->>'estado', ''), 'Venta de antes de conectar Mercado Libre: solo sus cargos, sin pedido.', true);
  perform _ml_pagos(null, v_id, p->'pagos');
  return 'nueva';
end $$;
revoke execute on function public.ml_registrar_historial(jsonb) from public, anon, authenticated;

-- Lo que la base le pide a la función: un mes de ventas pasadas (asíncrono, con la llave de pg_cron).
create or replace function public.ml_historial_disparar(p_mes date) returns bigint
language plpgsql security definer set search_path = public as $$
declare c record;
begin
  select url_funciones, llave_automatico into c from ml_cuenta where id = 1;
  if c.url_funciones is null then raise exception 'La conexión con Mercado Libre todavía no anota su dirección'; end if;
  return net.http_post(url := c.url_funciones || '/functions/v1/mercadolibre/historial',
    body := jsonb_build_object('mes', to_char(date_trunc('month', p_mes), 'YYYY-MM-DD')),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-llave', c.llave_automatico),
    timeout_milliseconds := 5000);
end $$;
revoke execute on function public.ml_historial_disparar(date) from public, anon, authenticated;

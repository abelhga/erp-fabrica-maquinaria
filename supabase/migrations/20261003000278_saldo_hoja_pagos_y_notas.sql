-- =============================================================================
-- El saldo de la hoja de clientes cuenta bien los pagos, las notas de crédito y los reembolsos.
--
-- Por qué: Cotoh Ingeniería salía debiendo $48,256 desde enero de 2020. En la hoja, su anticipo se
-- capturó como «pago» (con minúscula) y el saldo solo restaba «Pago». Además, de los reembolsos y
-- notas de crédito se tomaba uno con el signo al revés y el otro no se tomaba:
--   * «Reembolso/NC pend» es la nota de crédito o el reembolso que se le debe al cliente: reduce lo
--     que debe (La Hojuela: la NC-6 cancela el resto de la factura 2039; Ernesto Becerra: se canceló
--     la cribadora). No se restaba, y salían debiendo $248,760 y $78,000 que no deben.
--   * «Reembolso/NC aplicado» es el dinero que ya se le devolvió: deshace lo que tenía a favor. Se
--     restaba, así que el que pagó de más y recibió su devolución salía con el doble a favor
--     (José Ezequiel −$397,880, Lussel −$142,912, Finall −$10,000, Bernardo Rivera −$5,597).
-- Es la misma regla que ya usa la hoja de proveedores («Reembolso Pend.» resta, «Reembolso
-- Realizado» suma). Con la corrección, esos siete clientes quedan en cero, salvo La Hojuela, que debe
-- solo su servicio de mayo de 2026.
--
-- Y tres clientes salían con saldo a favor desde enero de 2018 (Comercializadora de Todo Mena
-- $86,000, Grupo Botanero Alteño $44,544, Jaguar Ingenieros $38,029): en la hoja solo tienen un «Pago
-- de adeudo año anterior», que pagó una deuda de 2017, y la hoja empieza en 2018. Abel decidió que
-- queden en cero.
--
-- Qué cambia: «pago» pasa a «Pago» (lo cuentan también la cobranza por mes y los tableros), el tipo
-- solo admite los valores de la hoja más «Saldo inicial», y el saldo suma o resta cada uno con su
-- signo. «Saldo inicial» es la deuda de antes de la hoja: suma al saldo pero no es venta (no cuenta
-- en ventas, comisiones ni antigüedad). Se agrega uno por cada «Pago de adeudo año anterior» de un
-- cliente que no tenía ventas antes de ese pago.
-- =============================================================================

update public.historial_ventas_hoja set tipo = 'Pago' where tipo = 'pago';
alter table public.historial_ventas_hoja drop constraint if exists historial_ventas_hoja_tipo;
alter table public.historial_ventas_hoja add constraint historial_ventas_hoja_tipo
  check (tipo in ('Venta', 'Pago', 'Reembolso/NC aplicado', 'Reembolso/NC pend', 'Saldo inicial'));

insert into public.historial_ventas_hoja (fecha, cliente_id, cliente_nombre, tipo, monto, descripcion)
select date '2017-12-31', p.cliente_id, p.cliente_nombre, 'Saldo inicial', p.monto,
  'Adeudo de 2017, antes de la hoja: lo que pagó el «Pago de adeudo año anterior» del ' || to_char(p.fecha, 'DD/MM/YYYY')
from public.historial_ventas_hoja p
where p.tipo = 'Pago' and p.descripcion ilike 'pago de adeudo a_o anterior%' and p.cliente_id is not null
  and not exists (select 1 from public.historial_ventas_hoja v where v.cliente_id = p.cliente_id and v.tipo in ('Venta', 'Saldo inicial') and v.fecha <= p.fecha);

create or replace view public.v_saldo_arranque_clientes with (security_invoker = true) as
select h.cliente_id, c.nombre, c.vendedor_id,
  sum(h.monto) filter (where h.tipo = 'Venta') as vendido,
  sum(h.monto) filter (where h.tipo = 'Pago') as pagado,
  coalesce(sum(h.monto) filter (where h.tipo in ('Venta', 'Saldo inicial')), 0) - coalesce(sum(h.monto) filter (where h.tipo = 'Pago'), 0)
    - coalesce(sum(h.monto) filter (where h.tipo = 'Reembolso/NC pend'), 0)
    + coalesce(sum(h.monto) filter (where h.tipo = 'Reembolso/NC aplicado'), 0)
    - coalesce(max(e.cobrado), 0) as saldo,
  max(h.fecha) filter (where h.tipo = 'Venta') as ultima_venta,
  greatest(max(h.fecha) filter (where h.tipo = 'Pago'), max(e.ultimo)) as ultimo_pago,
  coalesce(max(e.cobrado), 0) as cobrado_erp
from public.historial_ventas_hoja h
join public.clientes c on c.id = h.cliente_id
left join (select cliente_id, sum(monto) filter (where not en_hoja) as cobrado, max(fecha) as ultimo
           from public.v_cobros_saldo_hoja group by cliente_id) e on e.cliente_id = h.cliente_id
group by h.cliente_id, c.nombre, c.vendedor_id;

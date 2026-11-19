-- =============================================================================
-- Dos cosas que no dejaban capturar a finanzas (19 de noviembre).
--
-- 1. «Esa compra ya está en la hoja» aunque fuera otra factura. Seguros Monterrey expidió el mismo
--    día (06/12/2025) los recibos mensuales de la póliza, todos de $16,490.72: REGT 16508629 a
--    16508640. La hoja trae hasta el 16508637; al capturar el 16508638 la base lo rechazaba, porque
--    el candado de 129 compara proveedor, monto y fecha (±7 días) y no mira el folio. La pantalla
--    sí preguntaba «¿es otra compra?», pero el candado no tenía cómo saberlo.
--    Qué cambia: una compra con folio solo se compara con las de la hoja que no traen folio (ahí no
--    hay cómo distinguirlas); la del mismo folio ya la rechaza trg_factura_repetida (131). Sin folio
--    sigue rechazándose, y el mensaje dice qué hacer. Los pagos quedan igual.
--
-- 2. Forrajes los Chapeteados salía debiendo $72,499.99 de una venta de $160,000. Su primer renglón
--    en la hoja es un «Pago de adeudo de año anterior» de $87,500.01 (febrero de 2018): pagó una
--    deuda de 2017, y la hoja empieza en 2018, así que ese pago se le restaba a lo que compró
--    después. Es el mismo caso que 278 arregló para tres clientes con un «Saldo inicial», pero 278
--    buscaba «Pago de adeudo año anterior» y este dice «…adeudo de año anterior». Como después
--    compró, no quedó con saldo a favor y nadie lo vio hasta que finanzas quiso cobrarle.
--    Qué cambia: se le agrega su «Saldo inicial», con la misma regla de 278 y el texto con o sin «de».
-- =============================================================================

create or replace function public.trg_movimiento_ya_en_hoja() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_arranque date; v_hoja date; v_llave text := llave_factura(new.factura);
  -- Folios que no identifican nada (sin factura, sin número, no aplica): como en trg_factura_repetida.
  v_con_folio boolean;
begin
  select (valor #>> '{}')::date into v_arranque from configuracion where clave = 'fecha_arranque_finanzas';
  if v_arranque is null or new.fecha >= v_arranque then return new; end if;
  v_con_folio := new.tipo = 'compra' and v_llave is not null and v_llave not in ('SF', 'SN', 'NA');
  select h.fecha into v_hoja from historial_compras_hoja h
  where h.proveedor_llave = new.proveedor_llave and abs(h.monto - new.monto) < 0.01
    and h.fecha between new.fecha - 7 and new.fecha + 7
    and h.tipo = case new.tipo when 'compra' then 'Compra' when 'pago' then 'Pago'
                               when 'reembolso_pendiente' then 'Reembolso Pend.' else 'Reembolso Realizado' end
    -- Otra factura del mismo monto y la misma semana (recibos mensuales, cargos iguales) no es la misma compra.
    and (not v_con_folio or coalesce(llave_factura(h.factura), 'SF') in ('SF', 'SN', 'NA', v_llave))
  order by abs(h.fecha - new.fecha) limit 1;
  if v_hoja is null then return new; end if;
  if new.tipo = 'pago' then
    raise exception 'Ese pago ya está en la hoja (el %), así que no cambiaría el saldo. Si la factura sigue saliendo por pagar, seguramente está capturada dos veces en la hoja: márcala con «Estaba repetida».',
      to_char(v_hoja, 'DD/MM/YYYY') using errcode = '23505';
  end if;
  if new.tipo = 'compra' and not v_con_folio then
    raise exception 'En la hoja ya hay una compra igual (el %). Si esta es otra factura, escribe su folio para distinguirla; si es la misma, no hace falta capturarla otra vez.',
      to_char(v_hoja, 'DD/MM/YYYY') using errcode = '23505';
  end if;
  raise exception 'Esa compra ya está en la hoja (el %): no hace falta capturarla otra vez.', to_char(v_hoja, 'DD/MM/YYYY') using errcode = '23505';
end $$;

-- La deuda de antes de la hoja de quien la pagó con un «Pago de adeudo (de) año anterior» y no tenía
-- ventas antes de ese pago. No repite los que 278 ya puso.
insert into public.historial_ventas_hoja (fecha, cliente_id, cliente_nombre, tipo, monto, descripcion)
select date '2017-12-31', p.cliente_id, p.cliente_nombre, 'Saldo inicial', p.monto,
  'Adeudo de 2017, antes de la hoja: lo que pagó el «' || p.descripcion || '» del ' || to_char(p.fecha, 'DD/MM/YYYY')
from public.historial_ventas_hoja p
where p.tipo = 'Pago' and p.descripcion ~* '^\s*pago de adeudo (de )?a.o anterior' and p.cliente_id is not null
  and not exists (select 1 from public.historial_ventas_hoja v where v.cliente_id = p.cliente_id and v.tipo in ('Venta', 'Saldo inicial') and v.fecha <= p.fecha);

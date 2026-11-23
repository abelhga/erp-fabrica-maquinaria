-- =============================================================================
-- El CFDI de un anticipo no es una compra.
--
-- Por qué: el 23 de noviembre finanzas subió el CFDI del anticipo de $400,000 a un proveedor de
-- acero («Anticipo del bien o servicio», clave del SAT 84111506) y quedó como una compra de
-- contado; el pago de ese dinero se registró aparte, sin marcar que era anticipo. Resultado: una
-- «factura por pagar» de $400,000 que no existe, y el pago repartido entre las facturas a crédito
-- más viejas, que desaparecieron de «por pagar» aunque siguen debiéndose. El saldo total cuadraba
-- ($5,556.72) y nada de lo que enseñaba era cierto.
--
-- Un anticipo es dinero que se entrega antes de recibir nada: no es material ni gasto. El SAT
-- pide que su CFDI lleve la clave 84111506; la compra de verdad llega después, con su propia
-- factura, y contra ella se aplica el anticipo. En el ERP eso es un pago marcado como anticipo
-- (queda a favor y se descuenta de las facturas de contado, no de las que son a crédito: 303).
--
-- Qué cambia: registrar_movimiento_proveedor rechaza una «compra» cuyos conceptos son todos de
-- la clave 84111506 y dice cómo va. La pantalla ya lo registra sola como anticipo; el candado es
-- para una app instalada con la versión vieja y para cualquier otra entrada.
-- =============================================================================

do $$
declare v_def text := pg_get_functiondef((select oid from pg_proc where proname = 'registrar_movimiento_proveedor'));
  v_ancla text := 'if p_tipo = ''pago'' and p_cuenta is null then raise exception ''Di de qué cuenta salió el pago'' using errcode = ''22023''; end if;';
begin
  if v_def like '%84111506%' then return; end if;
  if position(v_ancla in v_def) = 0 then
    raise exception 'registrar_movimiento_proveedor ya no es la que se conocía: revisar antes de ponerle el candado del anticipo';
  end if;
  v_def := replace(v_def, v_ancla, v_ancla || $parche$
  -- El CFDI de un anticipo (todos sus conceptos con la clave del SAT 84111506) no es una compra.
  if p_tipo = 'compra' and cardinality(coalesce(p_claves_sat, '{}')) > 0 and p_claves_sat <@ array['84111506'] then
    raise exception 'Ese CFDI es un anticipo, no una compra: regístralo como pago marcando «Es un anticipo». Queda a favor y se descuenta de las facturas de contado que vengan.'
      using errcode = '22023';
  end if;$parche$);
  execute v_def;
end $$;

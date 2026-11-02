-- =============================================================================
-- Cotizaciones y pedidos sin IVA (cuando el cliente no quiere factura).
--
-- Por qué: hay clientes que compran sin factura. La hoja lo anotaba como «S/F» y el pedido iba
-- por el subtotal, sin IVA (Gumaro Machorro, $850,000; Miguel Arturo Nuño, $193,200). En el ERP
-- la cotización siempre nacía con el 16 % y no había forma de quitárselo: el pedido salía con IVA y
-- cobranza esperaba un total que el cliente nunca iba a pagar. Susana lo vio con el PED-26-804
-- (Javier Gonzáles Rico) y con los pedidos que vinieron de la hoja.
--
-- La cotización y el pedido ya guardan su tasa de IVA y todas las cuentas la usan, así que «sin IVA»
-- es tasa 0. Lo nuevo son las dos funciones para cambiarla, con sus reglas:
--   * La cotización la cambia quien la puede editar, mientras se puede editar. El precio de cada
--     partida queda igual sin IVA: si los precios incluían IVA, se pasan primero a precio sin IVA.
--     Al regresarla, toma la tasa de la configuración. El pedido hereda la tasa al convertirla.
--   * El pedido lo cambia quien lo puede cambiar (su vendedor, la gerencia de ventas, finanzas).
--     Un pedido que ya tiene factura no puede quedar sin IVA: primero se quita la factura. El
--     subtotal no cambia, así que la comisión tampoco; cambian el IVA, el total y el saldo.
--     El cambio queda en la bitácora (el pedido ya se audita).
-- =============================================================================

create or replace function public.tasa_iva_general() returns numeric
language sql stable set search_path = public as $$
  select coalesce((select (valor #>> '{}')::numeric from configuracion where clave = 'iva'), 0.16)
$$;

create or replace function public.cotizacion_sin_iva(p_id uuid, p_sin_iva boolean) returns void
language plpgsql security invoker set search_path = public as $$
declare c cotizaciones;
begin
  select * into c from cotizaciones where id = p_id;
  if c.id is null then raise exception 'No existe la cotización'; end if;
  if not cotizacion_editable(p_id) then raise exception 'Esta cotización ya se envió: saca una nueva versión para cambiarla'; end if;
  if p_sin_iva then
    if c.tasa_iva = 0 then return; end if;
    -- Lo que se cobra sin factura es el precio sin IVA: si las partidas lo incluían, se le quita.
    if c.precios_con_iva then
      update cotizacion_lineas set precio_unitario = round(precio_unitario / (1 + c.tasa_iva), 2) where cotizacion_id = p_id;
    end if;
    update cotizaciones set tasa_iva = 0, precios_con_iva = false where id = p_id;
  else
    if c.tasa_iva > 0 then return; end if;
    update cotizaciones set tasa_iva = tasa_iva_general() where id = p_id;
  end if;
  if not found then raise exception 'No puedes cambiar esta cotización' using errcode = '42501'; end if;
end $$;
revoke execute on function public.cotizacion_sin_iva(uuid, boolean) from public, anon;
grant execute on function public.cotizacion_sin_iva(uuid, boolean) to authenticated;

create or replace function public.pedido_sin_iva(p_pedido uuid, p_sin_iva boolean) returns void
language plpgsql security definer set search_path = public as $$
declare p pedidos; v_fac text;
begin
  select * into p from pedidos where id = p_pedido for update;
  if p.id is null then raise exception 'No existe ese pedido'; end if;
  -- Los mismos que pueden cambiar el pedido (la política «cambio»).
  if not ((p.vendedor_id = auth.uid() and puede('ventas', 2)) or puede('ventas', 3) or puede('finanzas', 2)) then
    raise exception 'El IVA del pedido lo cambia su vendedor, la gerencia de ventas o finanzas' using errcode = '42501';
  end if;
  if p.estado = 'cancelado' then raise exception 'El pedido está cancelado'; end if;
  if p_sin_iva then
    if p.tasa_iva = 0 then return; end if;
    select string_agg(folio, ', ' order by fecha) into v_fac from facturas where pedido_id = p_pedido;
    if v_fac is not null then
      raise exception 'El pedido ya tiene la factura %: si de verdad no lleva factura, primero quítala (con el lápiz, en Facturas)', v_fac
        using errcode = '23514';
    end if;
    update pedidos set tasa_iva = 0 where id = p_pedido;
  else
    if p.tasa_iva > 0 then return; end if;
    update pedidos set tasa_iva = tasa_iva_general() where id = p_pedido;
  end if;
  perform totales_pedido(p_pedido);
end $$;
revoke execute on function public.pedido_sin_iva(uuid, boolean) from public, anon;
grant execute on function public.pedido_sin_iva(uuid, boolean) to authenticated;

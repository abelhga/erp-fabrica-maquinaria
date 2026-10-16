-- Facturas de proveedor leídas de un PDF: de dónde salió cada una.
--
-- El XML (CFDI) se lee exacto en el navegador. Cuando no hay XML (proveedor extranjero,
-- recibo, o el contador solo mandó el PDF), Claude lee el PDF y la persona lo revisa. Lo
-- leído de un PDF puede traer un dígito mal: el contador necesita saber cuáles fueron para
-- pedir su XML, y por eso cada compra guarda de dónde salió (xml, pdf o captura a mano).
-- La función es la de 101 con un parámetro más al final (las llamadas por nombre siguen igual).
alter table public.movimientos_proveedor add column if not exists leido_de text
  check (leido_de in ('xml', 'pdf', 'captura'));

drop function if exists public.registrar_movimiento_proveedor(uuid, text, numeric, date, text, text, text, date, text, boolean, text, text);
create or replace function public.registrar_movimiento_proveedor(
  p_proveedor uuid, p_tipo text, p_monto numeric, p_fecha date default null, p_cuenta text default null,
  p_factura text default null, p_descripcion text default null, p_vence date default null,
  p_categoria text default null, p_anticipo boolean default false,
  p_cfdi_uuid text default null, p_metodo_pago text default null, p_leido_de text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_llave text; v_prov proveedores; v_fecha date := coalesce(p_fecha, hoy_planta()); v_saldo numeric; v_id uuid;
begin
  if not puede('finanzas', 2) then raise exception 'Solo finanzas registra compras y pagos a proveedores' using errcode = '42501'; end if;
  if coalesce(p_monto, 0) <= 0 then raise exception 'El monto tiene que ser mayor a cero' using errcode = '22023'; end if;
  if v_fecha > hoy_planta() then raise exception 'La fecha no puede ser futura' using errcode = '22023'; end if;
  if p_tipo not in ('compra', 'pago', 'reembolso_pendiente', 'reembolso_realizado') then
    raise exception 'Tipo de movimiento desconocido: %', p_tipo using errcode = '22023';
  end if;
  if p_leido_de is not null and p_leido_de not in ('xml', 'pdf', 'captura') then
    raise exception 'Origen de la factura desconocido: %', p_leido_de using errcode = '22023';
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
    cfdi_uuid, metodo_pago, leido_de)
  values (p_proveedor, v_llave, p_tipo, v_fecha, round(p_monto, 2), p_cuenta,
    case when p_tipo = 'compra' then coalesce(nullif(trim(p_categoria), ''), v_prov.categoria) end,
    nullif(trim(p_factura), ''), nullif(trim(p_descripcion), ''),
    case when p_tipo = 'compra' then coalesce(p_vence, v_fecha + coalesce(v_prov.dias_credito, 0)) end,
    upper(nullif(trim(p_cfdi_uuid), '')), case when p_tipo = 'compra' then p_metodo_pago end,
    case when p_tipo in ('compra', 'reembolso_pendiente') then p_leido_de end)
  returning id into v_id;
  return v_id;
end $$;
revoke execute on function public.registrar_movimiento_proveedor(uuid, text, numeric, date, text, text, text, date, text, boolean, text, text, text) from public, anon;
grant execute on function public.registrar_movimiento_proveedor(uuid, text, numeric, date, text, text, text, date, text, boolean, text, text, text) to authenticated;

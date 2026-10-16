-- =============================================================================
-- Facturas de venta y cobros desde el XML (CFDI emitidos y complementos de pago).
--
-- Por qué: en Cobranza folio, UUID y total se tecleaban, y cada pago de un cliente
-- a crédito (PPD) llega con su complemento de pago, que ya dice qué facturas paga y
-- cuánto. La carpeta de ingresos del Drive tiene esos XML. Con ellos el cobro se
-- registra solo, en el pedido de cada factura, y subir el mismo XML dos veces no
-- lo duplica.
-- =============================================================================

-- De qué complemento y de qué factura salió cada cobro.
alter table public.cobros add column cfdi_uuid text;        -- folio fiscal del complemento de pago
alter table public.cobros add column cfdi_factura text;     -- folio fiscal de la factura que paga
create unique index cobros_complemento on public.cobros (cfdi_uuid, cfdi_factura) where cfdi_uuid is not null;

-- Registra los pagos de un complemento: cada documento relacionado va a su factura,
-- y la factura dice el pedido. Lo que no se encuentra (facturas de antes del ERP o no
-- registradas) se regresa para que se vea, no se adivina. Cada documento es aparte:
-- uno que no cabe (pagaría de más) no tumba a los demás.
create or replace function public.registrar_complemento_pago(p_uuid text, p_folio text, p_pagos jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_uuid text := upper(trim(p_uuid)); pago jsonb; d jsonb; f facturas; v_res jsonb := '[]'; v_estado text; v_msj text;
begin
  if not puede('finanzas', 2) then raise exception 'Solo finanzas registra cobros' using errcode = '42501'; end if;
  if v_uuid is null or v_uuid = '' then raise exception 'El complemento no trae folio fiscal' using errcode = '22023'; end if;
  for pago in select * from jsonb_array_elements(coalesce(p_pagos, '[]')) loop
    for d in select * from jsonb_array_elements(coalesce(pago -> 'doctos', '[]')) loop
      v_msj := null;
      select * into f from facturas where uuid_sat = upper(d ->> 'uuid');
      if not found then
        v_estado := 'sin_factura';
      elsif exists (select 1 from cobros where cfdi_uuid = v_uuid and cfdi_factura = f.uuid_sat) then
        v_estado := 'repetido';
      elsif coalesce((d ->> 'pagado')::numeric, 0) <= 0 then
        v_estado := 'sin_monto';
      else
        begin
          insert into cobros (pedido_id, fecha, monto, metodo, referencia, notas, cfdi_uuid, cfdi_factura)
          values (f.pedido_id, coalesce((pago ->> 'fecha')::date, hoy_planta()), round((d ->> 'pagado')::numeric, 2),
                  coalesce(pago ->> 'metodo', 'transferencia'),
                  'Complemento ' || coalesce(nullif(trim(p_folio), ''), left(v_uuid, 8)),
                  'Factura ' || f.folio || coalesce(', parcialidad ' || (d ->> 'parcialidad'), ''), v_uuid, f.uuid_sat);
          v_estado := 'registrado';
        exception when others then
          v_estado := 'rechazado'; v_msj := sqlerrm;
        end;
      end if;
      v_res := v_res || jsonb_build_object('factura', coalesce(f.folio, d ->> 'folio'), 'uuid', upper(d ->> 'uuid'), 'monto', (d ->> 'pagado')::numeric,
        'pedido_id', f.pedido_id, 'estado', v_estado, 'mensaje', v_msj);
      f := null;
    end loop;
  end loop;
  return v_res;
end $$;
revoke execute on function public.registrar_complemento_pago(text, text, jsonb) from public, anon;
grant execute on function public.registrar_complemento_pago(text, text, jsonb) to authenticated;

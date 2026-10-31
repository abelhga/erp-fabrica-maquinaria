-- =============================================================================
-- Facturas sin registrar: lo que el SAT dice que nos facturaron y no está en ningún libro.
--
-- Al cruzar los XML cargados en «Facturas anteriores» con la hoja y el ERP salieron unas 94
-- facturas recibidas desde el 21 de septiembre (cerca de $1 millón) que no están ni en la hoja
-- (que se dejó de llenar a fines de septiembre) ni en el ERP: es el hueco del cambio. Sin
-- registrar, Resultados sale con menos gasto y la mitad (a crédito) son cuentas por pagar que
-- nadie ve venir.
--
-- facturas_sin_registrar() hace ese cruce siempre igual: una factura recibida, vigente, cuenta
-- como registrada si está amarrada a la hoja (o su folio está en la hoja), si está en las
-- compras del ERP (por folio fiscal, por folio del mismo proveedor, o por monto del mismo
-- proveedor a 20 días), o si salió de caja chica por el mismo monto a 10 días. Lo que no se
-- registra en estos libros (lo domicilia el banco, es de un socio…) finanzas lo descarta con
-- su motivo y se puede regresar.
-- =============================================================================

alter table public.cfdi_historico
  add column if not exists no_registrar text,
  add column if not exists no_registrar_por uuid references public.perfiles(id),
  add column if not exists no_registrar_en timestamptz;

create or replace function public.facturas_sin_registrar(p_desde date default null, p_descartadas boolean default false)
returns table (uuid text, fecha date, serie text, folio text, emisor_rfc text, emisor_nombre text, proveedor_id uuid,
  proveedor text, moneda text, tipo_cambio numeric, subtotal numeric, total numeric, total_mxn numeric, metodo_pago text,
  forma_pago text, conceptos jsonb, claves_sat text[], dias int, no_registrar text, no_registrar_por text, no_registrar_en timestamptz)
language sql stable security definer set search_path = public as $$
  with d as (
    -- De entrada, desde 45 días antes del arranque del ERP: ahí empieza el hueco entre la hoja y el ERP.
    select coalesce(p_desde, coalesce((select (valor #>> '{}')::date from configuracion where clave = 'fecha_arranque'), current_date) - 45) desde
  )
  select c.uuid, c.fecha, c.serie, c.folio, c.emisor_rfc, c.emisor_nombre, coalesce(c.proveedor_id, pr.id), pr.nombre,
    c.moneda, c.tipo_cambio, c.subtotal, c.total, round(c.total * c.tipo_cambio, 2), c.metodo_pago, c.forma_pago,
    c.conceptos, c.claves_sat, (hoy_planta() - c.fecha)::int, c.no_registrar, pn.nombre, c.no_registrar_en
  from cfdi_historico c cross join d
  left join lateral (select p.id, p.nombre from proveedores p where p.id = c.proveedor_id
                     or (c.proveedor_id is null and upper(trim(p.rfc)) = c.emisor_rfc) order by p.activo desc limit 1) pr on true
  left join perfiles pn on pn.id = c.no_registrar_por
  where puede('finanzas', 1)
    and c.rol = 'recibida' and c.tipo = 'I' and not c.cancelada and c.fecha >= d.desde
    and (c.no_registrar is not null) = coalesce(p_descartadas, false)
    and c.hoja_compra_id is null and c.hoja_compra_2018_id is null
    and not exists (select 1 from historial_compras_hoja h where h.proveedor_id = coalesce(c.proveedor_id, pr.id)
                    and folio_comparable(h.factura) in (folio_comparable(c.folio), folio_comparable(coalesce(c.serie, '') || coalesce(c.folio, ''))))
    and not exists (select 1 from movimientos_proveedor m where m.tipo = 'compra' and (
          upper(m.cfdi_uuid) = c.uuid
          or (m.proveedor_id = coalesce(c.proveedor_id, pr.id) and folio_comparable(m.factura) in (folio_comparable(c.folio), folio_comparable(coalesce(c.serie, '') || coalesce(c.folio, ''))))
          or (m.proveedor_id = coalesce(c.proveedor_id, pr.id) and abs(m.monto - c.total * c.tipo_cambio) <= 1 and abs(m.fecha - c.fecha) <= 20)))
    and not exists (select 1 from caja_chica k where k.tipo = 'salida' and abs(-k.importe - c.total * c.tipo_cambio) <= 1 and abs(k.fecha - c.fecha) <= 10)
  order by c.fecha, c.emisor_nombre
$$;
revoke execute on function public.facturas_sin_registrar(date, boolean) from public, anon;
grant execute on function public.facturas_sin_registrar(date, boolean) to authenticated;

-- «No se registra aquí», con su motivo; sin motivo, regresa a la lista.
create or replace function public.descartar_factura_sin_registrar(p_uuid text, p_motivo text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not puede('finanzas', 2) then raise exception 'Esto lo decide finanzas' using errcode = '42501'; end if;
  if p_motivo is not null and length(trim(p_motivo)) < 3 then raise exception 'Escribe por qué no se registra (lo domicilia el banco, es de un socio…)'; end if;
  update cfdi_historico set no_registrar = nullif(trim(p_motivo), ''),
    no_registrar_por = case when nullif(trim(p_motivo), '') is null then null else auth.uid() end,
    no_registrar_en = case when nullif(trim(p_motivo), '') is null then null else now() end
  where uuid = upper(trim(p_uuid)) and rol = 'recibida';
  if not found then raise exception 'No existe esa factura'; end if;
end $$;
revoke execute on function public.descartar_factura_sin_registrar(text, text) from public, anon;
grant execute on function public.descartar_factura_sin_registrar(text, text) to authenticated;

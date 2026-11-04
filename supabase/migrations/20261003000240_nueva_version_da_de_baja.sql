-- =============================================================================
-- Nueva versión de una cotización: la anterior se puede dar de baja en el mismo paso.
--
-- Por qué (Juan Manuel, ventas): al sacar una versión nueva, la anterior se quedaba «enviada» y viva:
-- le seguían saliendo seguimientos, contaba en lo cotizado y había que rechazarla a mano después. Ahora
-- al sacar la versión se pregunta si la actual sigue vigente (el cliente puede escoger cualquiera) o
-- ya no vale. Si ya no vale: la enviada queda rechazada y la que nunca se envió, cancelada; las dos con
-- «Se reemplazó por la versión …» y sin cerrar la oportunidad.
-- =============================================================================

-- La firma cambia (parámetro nuevo): se quita la de un parámetro para que no haya dos.
drop function if exists public.nueva_version_cotizacion(uuid);
create or replace function public.nueva_version_cotizacion(p_id uuid, p_rechazar_anterior boolean default false) returns uuid
language plpgsql security invoker as $$
declare v_nueva uuid; v_raiz uuid; v_ver int; v_folio text; v_estado estado_cotizacion; v_ok boolean;
begin
  select coalesce(origen_id, id) into v_raiz from cotizaciones where id = p_id;
  if v_raiz is null then raise exception 'No existe la cotización'; end if;
  select max(version) + 1 into v_ver from cotizaciones where id = v_raiz or origen_id = v_raiz;
  select regexp_replace(folio, '-v[0-9]+$', '') || '-v' || v_ver into v_folio from cotizaciones where id = v_raiz;
  insert into cotizaciones (folio, version, origen_id, cliente_id, contacto_id, atencion, empresa, oportunidad_id, vendedor_id,
    vigencia_dias, moneda, tipo_cambio, tasa_iva, precios_con_iva, descuento_pct, leyenda_promocion, condiciones_pago,
    tiempo_entrega, notas, plan_meses, logo_comarca_url)
  select v_folio, v_ver, v_raiz, cliente_id, contacto_id, atencion, empresa, oportunidad_id, vendedor_id,
    vigencia_dias, moneda, tipo_cambio, tasa_iva, precios_con_iva, descuento_pct, leyenda_promocion, condiciones_pago,
    tiempo_entrega, notas, plan_meses, logo_comarca_url
  from cotizaciones where id = p_id returning id into v_nueva;
  insert into cotizacion_lineas (cotizacion_id, orden, articulo_id, titulo, descripcion, imagen_url, imagenes_extra, unidad, cantidad,
    precio_unitario, descuento_pct, opcional)
  select v_nueva, orden, articulo_id, titulo, descripcion, imagen_url, imagenes_extra, unidad, cantidad, precio_unitario, descuento_pct, opcional
  from cotizacion_lineas l where cotizacion_id = p_id;
  -- La de antes ya no vale: si se envió, queda rechazada («la reemplazó la versión …», sin cerrar la
  -- oportunidad, que sigue con la nueva); si nunca se envió, cancelada («Cancelada sin enviar»). Así no
  -- se le da seguimiento ni se convierte por error, y no cuenta como venta perdida por un motivo real.
  select estado into v_estado from cotizaciones where id = p_id;
  if p_rechazar_anterior and v_estado in ('borrador', 'por_autorizar', 'autorizada', 'enviada') then
    update cotizaciones set estado = case when v_estado = 'enviada' then 'rechazada'::estado_cotizacion else 'cancelada'::estado_cotizacion end,
      motivo_rechazo = 'Se reemplazó por la versión ' || v_folio
    where id = p_id returning true into v_ok;
    if v_ok is null then raise exception 'No puedes dar de baja la versión anterior: pídeselo a su vendedor o a la gerencia' using errcode = '42501'; end if;
  end if;
  return v_nueva;
end $$;
grant execute on function public.nueva_version_cotizacion(uuid, boolean) to authenticated;

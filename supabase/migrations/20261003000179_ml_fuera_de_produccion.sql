-- =============================================================================
-- Las ventas de Mercado Libre ya no le avisan «Pedido nuevo» a producción ni a almacén.
--
-- Cada venta de ML le mandaba a la gerencia de producción y a almacén un «Pedido nuevo ML-…»:
-- 22 a cada uno en dos semanas, por refacciones que no pasan por el taller. Producción no tiene
-- nada que hacer con ellas, y almacén ya se entera por donde sí trabaja una venta de ML: el
-- envío («envio_nuevo», «envio_guia_lista»). Entre tanto aviso se perdía lo que sí era del taller.
-- Si una venta de ML lleva un equipo, sale en Producción → Pedidos como «Sin orden», igual que
-- cualquier otra.
-- =============================================================================
create or replace function public.aviso_pedido() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_cliente text;
begin
  if new.historico then return new; end if;
  select nombre into v_cliente from clientes where id = new.cliente_id;
  if new.canal is distinct from 'mercadolibre' then
    perform avisar(array(select usuarios_con_rol('gerente_produccion') union select usuarios_con_rol('almacen')),
      'pedido_nuevo', format('Pedido nuevo %s', new.folio),
      format('%s%s', coalesce(v_cliente, 'Cliente'), coalesce(' · compromiso ' || to_char(new.fecha_compromiso, 'DD/MM'), '')),
      -- Almacén no entra a ventas: los dos sí ven las órdenes que salen del pedido.
      '/produccion/ordenes', 'pedidos', new.id::text);
  end if;
  perform publicar_en_canal('pedidos', format('🧾 Pedido nuevo %s de %s.', new.folio, coalesce(v_cliente, 'cliente')));
  return new;
end $$;

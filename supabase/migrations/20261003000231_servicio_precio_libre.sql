-- =============================================================================
-- Servicios con monto libre (el primero: servicio de paquetería).
--
-- Por qué: el envío por paquetería se cobra según el paquete ($700, $850, $1,000…) y casi nunca
-- se cotiza. «Pedido sin cotización» solo deja agregar artículos con precio de lista, así que esas
-- ventas se facturaban sin pedido: en octubre, la A3361 y la A3364 no estaban en el ERP y no
-- contaban en ventas ni en cobranza.
--
-- Un artículo con precio_libre no tiene precio de lista: el monto se escribe al agregarlo (sin IVA,
-- en la moneda del pedido) y tiene que ser mayor a cero. Lo demás no cambia: a un artículo normal
-- el monto que mande la pantalla no le aplica (sale su precio de lista, como siempre).
-- =============================================================================

alter table public.articulos add column if not exists precio_libre boolean not null default false;

insert into public.articulos (clave, nombre, tipo, unidad, controla_inventario, precio_libre, descripcion)
select public.sugerir_clave('servicio'), 'Servicio de paquetería', 'servicio', 'servicio', false, true,
       'Envío por paquetería (DHL, Estafeta, FedEx…). El monto se escribe en cada venta, según el paquete.'
where not exists (select 1 from public.articulos where nombre = 'Servicio de paquetería');

drop function if exists public.agregar_partida_pedido(uuid, uuid, numeric);
create or replace function public.agregar_partida_pedido(p_pedido uuid, p_articulo uuid, p_cantidad numeric default 1,
                                                         p_precio numeric default null)
returns public.pedido_lineas language plpgsql security invoker as $$
declare r pedido_lineas; v_libre boolean;
begin
  select precio_libre into v_libre from articulos where id = p_articulo;
  if coalesce(v_libre, false) then
    if coalesce(p_precio, 0) <= 0 then
      raise exception 'Escribe el monto del servicio (sin IVA)' using errcode = '23514';
    end if;
  elsif not exists (select 1 from precios_lista where articulo_id = p_articulo and precio > 0) then
    raise exception 'Ese artículo todavía no tiene precio de lista: cotízalo (ahí sí se escribe el precio) y convierte la cotización en pedido';
  end if;
  insert into pedido_lineas (pedido_id, orden, articulo_id, titulo, descripcion, unidad, cantidad, precio_unitario, linea)
  select p.id, coalesce((select max(orden) from pedido_lineas where pedido_id = p.id), 0) + 1, a.id, a.nombre, a.descripcion, a.unidad,
    coalesce(p_cantidad, 1),
    case when a.precio_libre then round(p_precio, 2) else round(coalesce(pl.precio, 0) / p.tipo_cambio, 2) end,
    linea_de(a.id)
  from pedidos p cross join articulos a
  left join precios_lista pl on pl.articulo_id = a.id
  where p.id = p_pedido and a.id = p_articulo
  returning * into r;
  if r.id is null then raise exception 'No encontré el pedido o el artículo (¿ya no está confirmado?)'; end if;
  return r;
end $$;
revoke execute on function public.agregar_partida_pedido(uuid, uuid, numeric, numeric) from public, anon;
grant execute on function public.agregar_partida_pedido(uuid, uuid, numeric, numeric) to authenticated;

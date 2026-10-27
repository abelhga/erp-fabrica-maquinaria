-- =============================================================================
-- Ligar a un artículo la partida de texto de una orden de compra, al recibirla.
--
-- Las órdenes que venían de la hoja de compras (y las que se pasan de un PDF) traen partidas
-- escritas a mano, sin artículo del catálogo: «Rollo de 90 cm…», «PLACA 3/8 A-50», «Manejo».
-- La pantalla de recibir solo ofrecía partidas con artículo, así que esas órdenes no se podían
-- recibir nunca (nueve se quedaron «enviadas» con todo pendiente). La base ya sabe recibir una
-- partida de texto —la marca recibida sin tocar el inventario—, lo que sirve para un cobro como
-- «Manejo» o un flete. Pero la placa o la banda sí son material: si entran sin artículo, el
-- inventario no se entera. Esto liga la partida a su artículo justo antes de recibirla, para
-- que entre al almacén con el costo de la orden como cualquier otra.
-- =============================================================================
create or replace function public.ligar_partida_oc(p_linea uuid, p_articulo uuid) returns void
language plpgsql security definer set search_path = public as $$
declare l oc_lineas; o ordenes_compra; a articulos;
begin
  if not (puede('inventario', 2) or puede('compras', 2)) then
    raise exception 'Ligar una partida es de almacén o de compras' using errcode = '42501';
  end if;
  select * into l from oc_lineas where id = p_linea for update;
  if l.id is null then raise exception 'No existe esa partida'; end if;
  select * into o from ordenes_compra where id = l.orden_compra_id;
  if o.estado not in ('borrador', 'enviada', 'parcial') then raise exception 'La orden % ya está %', o.folio, o.estado; end if;
  if l.articulo_id is not null then raise exception 'Esa partida ya tiene artículo'; end if;
  -- Lo que ya se recibió de ella no entró al inventario: ligarla a medias dejaría la existencia chueca.
  if l.recibido > 0 then raise exception 'De esa partida ya se recibió una parte sin artículo; lígala con un ajuste de inventario'; end if;
  select * into a from articulos where id = p_articulo;
  if a.id is null or not a.activo then raise exception 'Ese artículo no existe o está apagado'; end if;
  if a.tipo not in ('componente', 'materia_prima') then raise exception 'Una compra entra al almacén como componente o materia prima'; end if;
  -- La descripción se queda: es como el proveedor le llama, y sale en la orden impresa.
  update oc_lineas set articulo_id = p_articulo, descripcion = coalesce(descripcion, a.nombre) where id = l.id;
end $$;
revoke execute on function public.ligar_partida_oc(uuid, uuid) from public, anon;
grant execute on function public.ligar_partida_oc(uuid, uuid) to authenticated;

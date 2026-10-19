-- Inhabilitar un equipo o subensamble que ya no se fabrica ni se vende.
--
-- La columna articulos.activo existía desde el principio y la base ya la respeta (el buscador
-- del cotizador, pedidos y listas de materiales no ofrece lo inactivo, y recalcular_costos le
-- quita el precio de lista), pero nadie podía cambiarla: la lista de equipos escondía los
-- inactivos para siempre y no había forma de regresarlos.
--
-- Inhabilitar no rompe lo que ya existe: un subensamble inhabilitado sigue costeando y
-- explotando dentro de los equipos que ya lo usan, y las cotizaciones, pedidos y órdenes
-- abiertos conservan sus partidas. Por eso no se bloquea: se avisa antes de confirmar.

-- Lo que conviene saber antes de inhabilitar (solo lee: la RLS filtra lo que cada quien ve).
create or replace function public.articulo_uso_abierto(p_articulo uuid)
returns jsonb language sql stable security invoker set search_path = public as $$
  select jsonb_build_object(
    'equipos_activos', (select count(distinct b.padre_id) from bom_lineas b join articulos p on p.id = b.padre_id
                        where b.hijo_id = p_articulo and p.activo),
    'pedidos_abiertos', (select count(distinct l.pedido_id) from pedido_lineas l join pedidos p on p.id = l.pedido_id
                         where l.articulo_id = p_articulo and p.estado in ('confirmado', 'en_produccion', 'listo')),
    'cotizaciones_abiertas', (select count(distinct l.cotizacion_id) from cotizacion_lineas l join cotizaciones c on c.id = l.cotizacion_id
                              where l.articulo_id = p_articulo and c.estado in ('borrador', 'por_autorizar', 'autorizada', 'enviada')));
$$;

-- Inhabilitar o reactivar. Es de quien mantiene el catálogo (costeo 2: ingeniería y compras);
-- la política de articulos también deja escribir a almacén, pero sacar un equipo del
-- cotizador no es decisión de almacén.
create or replace function public.fijar_articulo_activo(p_articulo uuid, p_activo boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare a articulos;
begin
  if not puede('costeo', 2) then raise exception 'Inhabilitar equipos es de ingeniería' using errcode = '42501'; end if;
  select * into a from articulos where id = p_articulo for update;
  if a.id is null then raise exception 'No existe el artículo'; end if;
  if a.tipo not in ('equipo', 'subensamble') then raise exception 'Solo los equipos y subensambles se inhabilitan desde aquí'; end if;
  if p_activo is null then raise exception 'Di si queda activo o inhabilitado'; end if;
  -- El disparador recalcular_cambio quita (o vuelve a calcular) el precio de lista.
  if a.activo is distinct from p_activo then update articulos set activo = p_activo where id = p_articulo; end if;
  return articulo_uso_abierto(p_articulo) || jsonb_build_object('activo', p_activo);
end $$;

revoke execute on function public.articulo_uso_abierto(uuid), public.fijar_articulo_activo(uuid, boolean) from public, anon;
grant execute on function public.articulo_uso_abierto(uuid), public.fijar_articulo_activo(uuid, boolean) to authenticated;

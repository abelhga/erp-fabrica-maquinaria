-- =============================================================================
-- Tres pendientes de la gente: lo apartado en el catálogo, inhabilitar componentes, y nada más.
--
-- 1. Catálogo: quien publica en Mercado Libre veía la existencia en planta sin restar lo apartado
--    para órdenes y pedidos, y vendía contra un número que no estaba libre. v_catalogo trae ahora
--    «apartado» (igual que Existencias) y la pantalla enseña lo disponible. Las reservas se dejan
--    leer a quien ve el catálogo: son cantidades, no dinero; sin eso la vista le sumaba cero.
--
-- 2. Componentes: compras pidió «eliminar componentes». No se borran: tienen compras, movimientos,
--    listas de materiales e historial. Lo que faltaba es poder inhabilitarlos, que hasta hoy solo
--    existía para equipos y subensambles. Inhabilitado deja de salir en buscadores, cotizador y
--    listas nuevas, y conserva todo; se reactiva cuando haga falta. La confirmación dice además
--    cuánto hay en existencia y en órdenes de compra abiertas.
-- =============================================================================

drop policy if exists ver on public.reservas;
create policy ver on public.reservas for select to authenticated
  using ((select puede('inventario', 1)) or (select puede('produccion', 1)) or (select puede('catalogo', 1)));

-- v_catalogo: una columna más al final (así create or replace conserva permisos y dependencias).
do $$
declare v_def text := pg_get_viewdef('public.v_catalogo'::regclass, true);
  v_ancla text := 'AS usado_en';
begin
  if v_def ~ '\mAS apartado\M' then return; end if;
  if (length(v_def) - length(replace(v_def, v_ancla, ''))) / length(v_ancla) <> 1 then
    raise exception 'v_catalogo ya no es la que se conocía: revisar antes de agregarle lo apartado';
  end if;
  v_def := replace(v_def, v_ancla, v_ancla || E',\n    COALESCE(( SELECT sum(r.cantidad - r.surtido) FROM reservas r WHERE r.articulo_id = a.id AND r.estado = ''activa''::text), 0::numeric) AS apartado');
  execute 'create or replace view public.v_catalogo with (security_invoker = true) as ' || v_def;
end $$;

create or replace function public.articulo_uso_abierto(p_articulo uuid) returns jsonb
language sql stable set search_path = public as $$
  select jsonb_build_object(
    'equipos_activos', (select count(distinct b.padre_id) from bom_lineas b join articulos p on p.id = b.padre_id
                        where b.hijo_id = p_articulo and p.activo),
    'pedidos_abiertos', (select count(distinct l.pedido_id) from pedido_lineas_basicas() l join pedidos_basicos() p on p.id = l.pedido_id
                         where l.articulo_id = p_articulo and p.estado in ('confirmado', 'en_produccion', 'listo')),
    'cotizaciones_abiertas', (select count(distinct l.cotizacion_id) from cotizacion_lineas l join cotizaciones c on c.id = l.cotizacion_id
                              where l.articulo_id = p_articulo and c.estado in ('borrador', 'por_autorizar', 'autorizada', 'enviada')),
    'existencia', (select coalesce(sum(e.cantidad), 0) from existencias e where e.articulo_id = p_articulo),
    'compras_abiertas', (select count(distinct l.orden_compra_id) from oc_lineas l join v_ordenes_compra o on o.id = l.orden_compra_id
                         where l.articulo_id = p_articulo and l.recibido < l.cantidad and o.estado in ('enviada', 'parcial')));
$$;

create or replace function public.fijar_articulo_activo(p_articulo uuid, p_activo boolean) returns jsonb
language plpgsql security definer set search_path = public as $$
declare a articulos;
begin
  select * into a from articulos where id = p_articulo for update;
  if a.id is null then raise exception 'No existe el artículo'; end if;
  -- Equipos y subensambles son de ingeniería; lo que se compra, de ingeniería o de compras.
  if not (puede('costeo', 2) or (a.tipo not in ('equipo', 'subensamble') and puede('compras', 2))) then
    raise exception 'Inhabilitar % es de %', case when a.tipo in ('equipo', 'subensamble') then 'equipos' else 'componentes' end,
      case when a.tipo in ('equipo', 'subensamble') then 'ingeniería' else 'ingeniería o compras' end using errcode = '42501';
  end if;
  if p_activo is null then raise exception 'Di si queda activo o inhabilitado'; end if;
  -- El disparador recalcular_cambio quita (o vuelve a calcular) el precio de lista.
  if a.activo is distinct from p_activo then update articulos set activo = p_activo where id = p_articulo; end if;
  return articulo_uso_abierto(p_articulo) || jsonb_build_object('activo', p_activo);
end $$;

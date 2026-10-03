-- =============================================================================
-- RLS de ventas: la misma regla, evaluada una vez por consulta y no por renglón.
--
-- Qué pasaba: para un vendedor, cada lectura de pedidos, partidas, cobros o
-- historial tardaba ~0.5 s. mis_clientes_visibles() llamaba puede() dos veces por
-- cada uno de los ~1,900 clientes, y la política de pedidos llamaba
-- pedido_visible(id) (security definer, no se puede "aplanar") por cada pedido.
-- El resumen semanal de un vendedor, que lee esas tablas varias veces, tardaba
-- 3.6 s; dirección, 40 ms. Quién ve qué NO cambia: lo cuidan 20_ventas,
-- 25_cartera, 60_ventas_pantallas y 86_resumen_semanal.
-- =============================================================================

create or replace function public.mis_clientes_visibles() returns setof uuid
language sql stable security definer set search_path = public as $$
  -- materialized: los permisos se calculan una vez, no por cliente.
  with yo as materialized (select puede('ventas', 3) todos, puede('ventas', 1) alguno, auth.uid() id)
  select c.id from clientes c, yo
  where yo.todos or (yo.alguno and (c.vendedor_id is null or c.vendedor_id = yo.id))
$$;

-- Las áreas que ven todos los pedidos (lo que pedido_visible revisa primero).
create or replace function public.ve_todos_los_pedidos() returns boolean
language sql stable security definer set search_path = public as $$
  select puede('ventas', 3) or puede('produccion', 2) or puede('finanzas', 1) or puede('inventario', 2)
$$;

-- Pedidos propios o con crédito compartido. security definer para no rebotar en la
-- RLS de pedidos y pedido_vendedores (que a su vez preguntan por pedidos).
create or replace function public.mis_pedidos_visibles() returns setof uuid
language sql stable security definer set search_path = public as $$
  select id from pedidos where vendedor_id = auth.uid()
  union
  select pedido_id from pedido_vendedores where vendedor_id = auth.uid()
$$;

-- pedido_visible() se queda igual para quien revisa un solo pedido (funciones, otros
-- módulos); las políticas de lectura usan las piezas de arriba, que el planeador
-- evalúa una vez (InitPlan) y compara con un hash.
alter policy ver on public.pedidos
  using (vendedor_id = (select auth.uid()) or (select ve_todos_los_pedidos()) or id in (select mis_pedidos_visibles()));
alter policy ver on public.pedido_lineas
  using ((select ve_todos_los_pedidos()) or pedido_id in (select mis_pedidos_visibles()));
alter policy ver on public.pedido_vendedores
  using ((select ve_todos_los_pedidos()) or pedido_id in (select mis_pedidos_visibles()));
alter policy ver on public.facturas
  using ((select ve_todos_los_pedidos()) or pedido_id in (select mis_pedidos_visibles()));
alter policy ver on public.cobros
  using ((select ve_todos_los_pedidos()) or pedido_id in (select mis_pedidos_visibles()));

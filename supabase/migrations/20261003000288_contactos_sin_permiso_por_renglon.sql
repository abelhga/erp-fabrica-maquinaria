-- =============================================================================
-- Contactos: la regla de «editar» ya no revisa cliente por cliente.
--
-- Por qué: José Antonio (compras) buscaba «Banda PVC120 negra 10" ancho» en el buscador de arriba y le
-- salía «Sin resultados». La base cortaba la búsqueda por tiempo (500, statement timeout) desde que el
-- buscador también busca por contactos (282). La política «editar» de contactos es FOR ALL, así que
-- también cuenta al leer, y llamaba cliente_visible(cliente_id) —una función security definer— en
-- cada renglón: a quien no es de ventas ni finanzas, leer los 2,650 contactos le costaba 3 s por
-- búsqueda, y con varias búsquedas seguidas (una por tecla) se pasaba del tope. Es el mismo error
-- que 086 quitó de los pedidos.
--
-- Qué cambia: la misma regla escrita con el conjunto (cliente_id in mis_clientes_visibles()), que se
-- calcula una vez por consulta. Quién puede ver o editar un contacto no cambia: mis_clientes_visibles
-- es exactamente cliente_visible en forma de conjunto (ventas 3 todos; ventas 1 los suyos y los sin
-- vendedor).
-- =============================================================================

drop policy if exists editar on public.contactos;
create policy editar on public.contactos for all to authenticated
  using ((select puede('ventas', 2)) and cliente_id in (select mis_clientes_visibles()))
  with check ((select puede('ventas', 2)) and cliente_id in (select mis_clientes_visibles()));

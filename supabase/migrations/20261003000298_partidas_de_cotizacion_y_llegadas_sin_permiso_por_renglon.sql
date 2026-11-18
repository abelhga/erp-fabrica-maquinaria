-- =============================================================================
-- Las partidas de cotización y las llegadas de compras ya no revisan permisos renglón por renglón.
--
-- Por qué: en la revisión de todo el ERP después de la 295 (qué más puede toparse con el límite de 8 s),
-- la lista de cotizaciones tardaba 1.2 s con la base sola para quien ve todas (534 cotizaciones, 2,592
-- consultas registradas). La lista cuenta partidas, descuento y primera partida de cada cotización, y
-- cada partida que lee pasa por dos políticas (ver y editar) que llaman cotizacion_visible(id) y
-- cotizacion_editable(id): security definer por renglón, con puede() adentro. Lo mismo que 086
-- corrigió en pedidos y 288 en contactos.
-- v_oc_llegada (en qué embarque viene cada orden de compra) evaluaba cinco puede() por renglón en su
-- where. Hoy no pesa porque casi no hay embarques ligados; se corrige antes de que pese.
--
-- Qué cambia: las mismas reglas escritas con el conjunto, que se calcula una vez por consulta. Quién ve
-- o edita una partida no cambia: mis_cotizaciones_visibles() es cotizacion_visible() en forma de
-- conjunto (las suyas; ventas 3, todas) y mis_cotizaciones_editables() es cotizacion_editable() (en
-- borrador, por autorizar o autorizada, y suya con ventas 2 o de cualquiera con ventas 3).
-- =============================================================================

create or replace function public.mis_cotizaciones_visibles()
returns setof uuid language sql stable security definer set search_path = public as $$
  select c.id from cotizaciones c
  where c.vendedor_id = auth.uid() or (select puede('ventas', 3))
$$;
create or replace function public.mis_cotizaciones_editables()
returns setof uuid language sql stable security definer set search_path = public as $$
  select c.id from cotizaciones c
  where c.estado in ('borrador', 'por_autorizar', 'autorizada')
    and ((c.vendedor_id = auth.uid() and (select puede('ventas', 2))) or (select puede('ventas', 3)))
$$;
revoke execute on function public.mis_cotizaciones_visibles(), public.mis_cotizaciones_editables() from public, anon;
grant execute on function public.mis_cotizaciones_visibles(), public.mis_cotizaciones_editables() to authenticated;

alter policy ver on public.cotizacion_lineas
  using (cotizacion_id in (select mis_cotizaciones_visibles()));
alter policy editar on public.cotizacion_lineas
  using (cotizacion_id in (select mis_cotizaciones_editables()))
  with check (cotizacion_id in (select mis_cotizaciones_editables()));

-- Misma vista que en 075; el permiso se revisa una vez (select), no por renglón.
create or replace view public.v_oc_llegada with (security_invoker = false) as
select distinct on (x.orden_compra_id) x.orden_compra_id, b.id as embarque_id, b.folio, e.fase, b.eta, e.llegada_planta_estimada
from public.embarque_oc x
join public.embarques b on b.id = x.embarque_id and not b.cancelado
join public.v_embarque_etapa e on e.embarque_id = b.id
where (select public.puede('compras', 1) or public.puede('finanzas', 1) or public.puede('inventario', 2)
           or public.puede('produccion', 2) or public.puede('importaciones', 1))
order by x.orden_compra_id, (e.fase = 'cerrado'), e.llegada_planta_estimada nulls last;

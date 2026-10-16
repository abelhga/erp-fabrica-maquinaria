-- =============================================================================
-- Números de serie: el ERP los asigna y guarda la historia de la hoja.
--
-- Por qué: el serial se escribía a mano en el formato de pedido y en el libro
-- "SERIALES Y CLIENTES" (una pestaña por familia). Es un código de medidas y
-- motor más el consecutivo de la familia: TB20090275E247 = banda, 20", 9 m,
-- motor 2 HP caja 75, el equipo 247 de esa pestaña. A mano se repite o se salta
-- un número, y el libro (1,000+ equipos desde 2015) no estaba en el ERP: servicio
-- y garantía no encontraban un equipo vendido antes del ERP.
--
-- 1. familias_serie: una por pestaña del libro, con su último consecutivo.
-- 2. articulos.codigo_serie: la parte fija del código de cada equipo (la banda de
--    22 m es otro artículo, con otras medidas), capturada una vez.
-- 3. Al crear la orden de producción de un equipo (una por unidad, como hoy el
--    pedido trae un serial por equipo) el serial sale solo: código + consecutivo.
--    Si el equipo aún no tiene código, la orden queda sin serial y se asigna
--    después, cuando alguien lo capture.
-- 4. equipos_historicos: el libro de la hoja, para buscar, dar servicio y ver qué
--    tiene cada cliente.
-- =============================================================================

create table public.familias_serie (
  clave text primary key,
  nombre text not null,
  hoja text,                       -- pestaña del libro "SERIALES Y CLIENTES"
  prefijo text,                    -- el más usado en la familia, solo como guía al capturar códigos
  ultimo int not null default 0,   -- último consecutivo usado (hoja o ERP)
  orden int not null default 0
);
insert into public.familias_serie (clave, nombre, hoja, prefijo, orden) values
  ('banda', 'Transportador de banda', 'Transportador de Banda', 'TB', 10),
  ('artesa', 'Transportador tipo artesa', 'TRANSPORTADOR ARTESA', 'TA', 20),
  ('bazuca_helicoidal', 'Bazuca helicoidal', 'Bazuca Helicoidal', null, 30),
  ('bazuca_banda', 'Bazuca de banda', 'Bazuca de banda', null, 40),
  ('helicoidal', 'Transportador helicoidal horizontal', 'T. Helicoidales Horizontales', null, 50),
  ('granel', 'Transportador para granel', 'TRANSPORTADOR PARA GRANEL', null, 60),
  ('elevador', 'Elevador de cangilones', 'ELEVADOR DE CANGILONES', null, 70),
  ('tolva', 'Tolva', 'Tolvas', 'T', 80),
  ('silo', 'Silo', 'SILOS', null, 90),
  ('dosificadora', 'Planta dosificadora', 'Dosificadoras', 'P', 100),
  ('cribadora', 'Cribadora', 'Cribadoras', 'C', 110),
  ('mezcladora', 'Mezcladora / revolvedora', 'Mezcladoras-Revolvedoras', null, 120),
  ('quebrador', 'Quebrador', 'QUEBRADORES', null, 130),
  ('seleccionadora', 'Seleccionadora', 'seleccionadoras', null, 140),
  ('molino', 'Molino', 'Molinos', null, 150);
alter table public.familias_serie enable row level security;
create policy ver on public.familias_serie for select to authenticated using (true);
-- El consecutivo lo mueven las funciones; a mano solo nombre y prefijo, quien administra producción.
create policy editar on public.familias_serie for update to authenticated
  using ((select puede('produccion', 3))) with check ((select puede('produccion', 3)));

alter table public.articulos add column familia_serie text references public.familias_serie(clave);
alter table public.articulos add column codigo_serie text check (codigo_serie ~ '^[A-Z0-9]+$');

-- Punto de partida: la familia del catálogo dice casi siempre la familia de serie.
-- El código (medidas y motor) lo captura producción o ingeniería, una vez por equipo.
update public.articulos set familia_serie = case familia
    when 'Banda Transportadora' then 'banda' when 'Bazuca' then 'bazuca_helicoidal' when 'Elevador' then 'elevador'
    when 'Tolva' then 'tolva' when 'Cribadora' then 'cribadora' when 'Silo para Cemento' then 'silo'
    when 'Dosificadora' then 'dosificadora' when 'Mezcladora' then 'mezcladora' end
where tipo = 'equipo' and familia_serie is null;

-- ---------------------------------------------------------------------------
-- Historia de la hoja
-- ---------------------------------------------------------------------------
create table public.equipos_historicos (
  id bigserial primary key,
  numero_serie text not null unique,
  familia text references public.familias_serie(clave),
  consecutivo int,
  tipo_equipo text,
  subcategoria text,
  pedido_hoja text,              -- número de pedido del formato (773, S131…)
  fecha_pedido date,
  cliente_id uuid references public.clientes(id) on delete set null,
  cliente_nombre text,
  contacto text,
  factura text,
  entrega_acordada date,
  estado text check (estado in ('espera', 'proceso', 'terminado', 'entregado', 'cancelado')),
  vendedor text,
  descripcion text,
  ubicacion text,
  fila_origen int
);
create index equipos_historicos_cliente on public.equipos_historicos (cliente_id);
alter table public.equipos_historicos enable row level security;
-- Quién compró qué: servicio y producción ven todo; un vendedor, los de sus clientes.
-- Sin nada que se evalúe por renglón (ver 086). Solo el importador escribe.
create policy ver on public.equipos_historicos for select to authenticated using (
  (select ve_todos_los_servicios()) or (select puede('produccion', 2)) or (select puede('ventas', 3))
  or cliente_id in (select mis_clientes_visibles()));

-- ---------------------------------------------------------------------------
-- Asignar el serial
-- ---------------------------------------------------------------------------
-- El siguiente serial libre de un artículo: código + consecutivo de su familia (3
-- dígitos, como la hoja). El update toma el candado del renglón de la familia, así
-- que dos órdenes al mismo tiempo no se llevan el mismo número. Si el número ya
-- existe (en la hoja o escrito a mano), se brinca al siguiente.
create or replace function public.siguiente_numero_serie(p_articulo uuid) returns text
language plpgsql security definer set search_path = public as $$
declare v_fam text; v_cod text; v_n int; v_serie text;
begin
  select familia_serie, codigo_serie into v_fam, v_cod from articulos where id = p_articulo;
  if v_fam is null or v_cod is null then return null; end if;
  loop
    update familias_serie set ultimo = ultimo + 1 where clave = v_fam returning ultimo into v_n;
    v_serie := v_cod || lpad(v_n::text, 3, '0');
    -- El consecutivo es de la familia, no del código: el 259 de una banda de 18" ya
    -- ocupa el 259 de todas las bandas.
    exit when not exists (select 1 from ordenes_produccion where numero_serie = v_serie)
          and not exists (select 1 from equipos_historicos where numero_serie = v_serie or (familia = v_fam and consecutivo = v_n));
  end loop;
  return v_serie;
end $$;
revoke execute on function public.siguiente_numero_serie(uuid) from public, anon, authenticated;

-- Cada orden de un equipo (una unidad) nace con su serial, venga de un pedido o
-- sea para stock. Una orden de varias piezas (subensambles en lote) no lleva serial.
create or replace function public.trg_serie_orden() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.numero_serie is null and new.cantidad = 1 then
    new.numero_serie := siguiente_numero_serie(new.articulo_id);
  end if;
  return new;
end $$;
create trigger numero_serie before insert on public.ordenes_produccion
  for each row execute function public.trg_serie_orden();

-- Para una orden que nació sin serial porque su equipo no tenía código.
create or replace function public.asignar_numero_serie(p_orden uuid) returns text
language plpgsql security definer set search_path = public as $$
declare o ordenes_produccion; v_serie text;
begin
  if not puede('produccion', 2) then raise exception 'Solo producción asigna números de serie' using errcode = '42501'; end if;
  select * into o from ordenes_produccion where id = p_orden for update;
  if not found then raise exception 'No existe esa orden' using errcode = '22023'; end if;
  if o.numero_serie is not null then return o.numero_serie; end if;
  if o.estado = 'cancelada' then raise exception 'La orden está cancelada' using errcode = '22023'; end if;
  if o.cantidad <> 1 then raise exception 'Una orden de varias piezas no lleva número de serie' using errcode = '22023'; end if;
  v_serie := siguiente_numero_serie(o.articulo_id);
  if v_serie is null then
    raise exception 'Ese equipo no tiene código de serie: captúralo en Números de serie → Códigos por equipo' using errcode = '22023';
  end if;
  update ordenes_produccion set numero_serie = v_serie where id = p_orden;
  insert into op_eventos (orden_id, tipo, nota) values (p_orden, 'nota', 'Número de serie asignado: ' || v_serie);
  return v_serie;
end $$;
revoke execute on function public.asignar_numero_serie(uuid) from public, anon;
grant execute on function public.asignar_numero_serie(uuid) to authenticated;

-- Capturar el código de un equipo (una vez). Quien administra producción o ingeniería.
create or replace function public.fijar_codigo_serie(p_articulo uuid, p_familia text, p_codigo text) returns void
language plpgsql security definer set search_path = public as $$
declare v_cod text := nullif(upper(regexp_replace(coalesce(p_codigo, ''), '\s', '', 'g')), '');
begin
  if not (puede('produccion', 3) or puede('costeo', 3)) then
    raise exception 'Solo la gerencia de producción o ingeniería cambia códigos de serie' using errcode = '42501';
  end if;
  if v_cod is not null and v_cod !~ '^[A-Z0-9]+$' then
    raise exception 'El código lleva solo letras y números (por ejemplo TB20090275E)' using errcode = '22023';
  end if;
  if v_cod is not null and p_familia is null then raise exception 'Elige la familia del equipo' using errcode = '22023'; end if;
  update articulos set familia_serie = p_familia, codigo_serie = v_cod, actualizado_en = now()
  where id = p_articulo and tipo = 'equipo';
  if not found then raise exception 'No existe ese equipo' using errcode = '22023'; end if;
end $$;
revoke execute on function public.fijar_codigo_serie(uuid, text, text) from public, anon;
grant execute on function public.fijar_codigo_serie(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Una sola lista: lo del ERP y lo de la hoja
-- ---------------------------------------------------------------------------
create or replace view public.v_numeros_serie with (security_invoker = true) as
select 'erp'::text as origen, o.numero_serie, a.familia_serie as familia, o.id as orden_id, o.folio as orden_folio,
  a.nombre as equipo, p.cliente_id, c.nombre as cliente, p.id as pedido_id, p.folio as pedido, coalesce(p.fecha, o.creado_en::date) as fecha,
  case o.estado when 'planeada' then 'espera' when 'liberada' then 'espera' when 'en_proceso' then 'proceso'
    when 'terminada' then 'terminado' when 'entregada' then 'entregado' else 'cancelado' end as estado,
  (select string_agg(f.folio, ', ' order by f.fecha) from facturas f where f.pedido_id = p.id) as factura,
  (select v.nombre from perfiles v where v.id = p.vendedor_id) as vendedor,
  coalesce(o.entregada_en::date, o.fecha_compromiso) as entrega, null::text as ubicacion, null::text as contacto
from ordenes_produccion o
join articulos a on a.id = o.articulo_id
left join pedidos p on p.id = o.pedido_id
left join clientes c on c.id = p.cliente_id
where o.numero_serie is not null
union all
select 'hoja', h.numero_serie, h.familia, null, null, coalesce(h.descripcion, h.subcategoria, h.tipo_equipo), h.cliente_id,
  coalesce(c.nombre, h.cliente_nombre), null, h.pedido_hoja, h.fecha_pedido, h.estado, h.factura, h.vendedor,
  h.entrega_acordada, h.ubicacion, h.contacto
from equipos_historicos h
left join clientes c on c.id = h.cliente_id;

-- Los equipos de un cliente para pedir servicio: también los de antes del ERP.
-- Una garantía sigue necesitando la orden del ERP (lo exige la tabla de servicios).
drop function if exists public.equipos_del_cliente(uuid);
create function public.equipos_del_cliente(p_cliente uuid)
returns table (orden_id uuid, folio text, numero_serie text, equipo text, pedido_id uuid, pedido_folio text,
               estado text, entregado date, garantia_vence date, historico boolean)
language sql stable security definer set search_path = public as $$
  select * from (
    select o.id, o.folio, o.numero_serie, a.nombre, o.pedido_id, p.folio, o.estado::text,
      coalesce(o.entregada_en, o.terminada_en)::date,
      (coalesce(o.entregada_en, o.terminada_en)::date
        + make_interval(months => coalesce((select (valor->>'meses_garantia')::int from configuracion where clave = 'servicio'), 12)))::date,
      false
    from ordenes_produccion o
    join pedidos p on p.id = o.pedido_id
    join articulos a on a.id = o.articulo_id
    where p.cliente_id = p_cliente and o.estado <> 'cancelada'
    union all
    select null, null, h.numero_serie, coalesce(h.descripcion, h.subcategoria, h.tipo_equipo, h.numero_serie), null, h.pedido_hoja, h.estado,
      coalesce(h.entrega_acordada, h.fecha_pedido), null, true
    from equipos_historicos h
    where h.cliente_id = p_cliente and coalesce(h.estado, '') <> 'cancelado'
  ) x
  where puede('servicio', 1) and (ve_todos_los_servicios() or cliente_visible(p_cliente))
  order by 8 desc nulls last   -- entregado
$$;
revoke execute on function public.equipos_del_cliente(uuid) from public, anon;
grant execute on function public.equipos_del_cliente(uuid) to authenticated;

-- El buscador (Ctrl+K) también encuentra los seriales de la hoja; los del ERP ya
-- salían con su orden. Es la versión de 076 con un bloque más.
CREATE OR REPLACE FUNCTION public.buscar_global(q text)
 RETURNS TABLE(tipo text, id text, titulo text, subtitulo text, ruta text)
 LANGUAGE sql
 STABLE
AS $function$
  with t as (select sin_acentos(trim(q)) t)
  (select case a.tipo when 'equipo' then 'equipo' when 'subensamble' then 'subensamble' else 'componente' end,
          a.id::text, a.nombre, a.clave, case when a.tipo in ('equipo', 'subensamble') then '/costeo/equipos/' else '/costeo/componentes/' end || a.id
   from articulos a, t where a.activo and sin_acentos(a.clave || ' ' || a.nombre) like '%' || replace(t.t, ' ', '%') || '%'
   order by similarity(sin_acentos(a.nombre), t.t) desc limit 8)
  union all
  (select 'cliente', c.id::text, c.nombre, coalesce(c.razon_social, c.ciudad), '/ventas/clientes/' || c.id
   from clientes c, t where sin_acentos(c.nombre || ' ' || coalesce(c.razon_social, '') || ' ' || coalesce(c.rfc, '')) like '%' || replace(t.t, ' ', '%') || '%'
   limit 6)
  union all
  (select 'cotizacion', c.id::text, c.folio || coalesce(' · ' || c.atencion, ''), to_char(c.total, 'FM$999,999,990.00'), '/ventas/cotizaciones/' || c.id
   from cotizaciones c, t where sin_acentos(c.folio || ' ' || coalesce(c.atencion, '') || ' ' || coalesce(c.empresa, '')) like '%' || replace(t.t, ' ', '%') || '%'
   order by c.fecha desc limit 5)
  union all
  (select 'pedido', p.id::text, p.folio, (select nombre from clientes where id = p.cliente_id), '/ventas/pedidos/' || p.id
   from pedidos p, t where sin_acentos(p.folio || ' ' || coalesce(p.id_externo, '')) like '%' || t.t || '%' order by p.fecha desc limit 5)
  union all
  (select 'orden_produccion', o.id::text, o.folio || coalesce(' · ' || o.numero_serie, ''), (select nombre from articulos where id = o.articulo_id), '/produccion/ordenes/' || o.id
   from ordenes_produccion o, t where sin_acentos(o.folio || ' ' || coalesce(o.numero_serie, '')) like '%' || t.t || '%' limit 5)
  union all
  (select 'numero_serie', h.id::text, h.numero_serie, coalesce(h.cliente_nombre, '') || coalesce(' · ' || h.fecha_pedido::text, ''),
          '/produccion/seriales?serie=' || h.numero_serie
   from equipos_historicos h, t where sin_acentos(h.numero_serie) like '%' || t.t || '%' limit 5)
  union all
  (select 'proveedor', p.id::text, p.nombre, p.categoria, '/compras/proveedores/' || p.id
   from proveedores p, t where sin_acentos(p.nombre) like '%' || replace(t.t, ' ', '%') || '%' limit 5)
  union all
  (select 'orden_compra', o.id::text, o.folio, (select nombre from proveedores where id = o.proveedor_id), '/compras/ordenes/' || o.id
   from v_ordenes_compra o, t where sin_acentos(o.folio || ' ' || coalesce(o.factura_proveedor, '')) like '%' || t.t || '%' limit 5)
$function$;

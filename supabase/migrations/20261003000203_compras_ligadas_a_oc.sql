-- =============================================================================
-- La factura de un proveedor se liga a su orden de compra, y de ahí sale en qué se gastó.
--
-- La categoría de una compra se tecleaba al registrar la factura (o se quedaba la del
-- proveedor), así que decía a quién se compró, no qué: «Pintura» traía discos y catalizador
-- (consumibles del taller), «Componentes y refacciones varios» traía cinta para empacar y un
-- servicio de reparación. Resultados resta los gastos y deja el material en lo vendido, así
-- que una categoría mal puesta movía la utilidad. Además, una orden recibida y su factura
-- contaban dos veces en «Por pagar» (la orden en su pestaña y la factura en la suya).
--
-- 1. compra_oc: una factura del libro (movimientos_proveedor) se liga a una o varias órdenes
--    de compra del mismo proveedor; una orden puede tener varias facturas (entregas parciales).
--    Se liga sola cuando el folio de la factura casa con el que almacén capturó al recibir (al
--    registrar la factura o al recibir la orden después), y a mano desde la pantalla.
-- 2. Con orden, la factura se reparte entre las partidas de sus órdenes (por su importe) y
--    cada una cuenta por su artículo: consumible del taller → gasto de fabricación; artículo de
--    inventario → material (ya está en lo vendido, no se resta otra vez); sin artículo (fletes,
--    servicios) o un servicio → la categoría de la factura.
-- 3. Sin orden, la categoría es obligatoria (con la del proveedor de sugerencia): es lo único
--    que dice en qué se gastó.
-- 4. Una orden con su factura ligada sale de «Órdenes por pagar»: lo que se debe ya está en la
--    factura. Tampoco suma dos veces en «Comprado en 12 meses».
-- =============================================================================

create table if not exists public.compra_oc (
  movimiento_id uuid not null references public.movimientos_proveedor(id) on delete cascade,
  orden_compra_id uuid not null references public.ordenes_compra(id) on delete cascade,
  como text not null default 'a_mano' check (como in ('folio', 'a_mano')),
  ligada_por uuid default auth.uid() references public.perfiles(id),
  ligada_en timestamptz not null default now(),
  primary key (movimiento_id, orden_compra_id)
);
comment on table public.compra_oc is
  'Qué factura del libro de compras es de qué orden de compra. «folio»: casó sola por el folio; «a_mano»: la eligió finanzas.';
create index if not exists compra_oc_orden on public.compra_oc (orden_compra_id);
alter table public.compra_oc enable row level security;
-- Solo son ids: quien ve el dinero de las órdenes puede saber si ya tienen factura.
drop policy if exists ver on public.compra_oc;
create policy ver on public.compra_oc for select to authenticated
  using ((select puede('finanzas', 2)) or (select ve_costos_compra()));
revoke insert, update, delete on public.compra_oc from authenticated, anon;
drop trigger if exists auditar on public.compra_oc;
create trigger auditar after insert or update or delete on public.compra_oc for each row execute function public.auditar();

-- Dos folios son la misma factura si sus números casan: almacén escribe «F0175226» y la factura
-- dice «0175226»; «A-0896» y «A896» también. Con menos de 3 dígitos no se compara (S/F, «sin
-- remisión»): casaría cualquier cosa.
create or replace function public.folios_casan(a text, b text) returns boolean
language sql immutable as $$
  select coalesce(length(x) >= 3 and x = y, false)
  from (select nullif(ltrim(regexp_replace(coalesce(a, ''), '\D', '', 'g'), '0'), '') x,
               nullif(ltrim(regexp_replace(coalesce(b, ''), '\D', '', 'g'), '0'), '') y) t
$$;

-- La orden y la factura son del mismo proveedor: el mismo registro o el mismo RFC (al importar
-- la hoja quedaron proveedores repetidos con el mismo RFC).
create or replace function public.mismo_proveedor(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select a = b or exists (select 1 from proveedores x join proveedores y on upper(trim(y.rfc)) = upper(trim(x.rfc))
                          where x.id = a and y.id = b and nullif(trim(x.rfc), '') is not null)
$$;
revoke execute on function public.mismo_proveedor(uuid, uuid) from public, anon, authenticated;

-- Las órdenes de este proveedor cuyo folio de factura casa con el de esta compra.
create or replace function public.ordenes_por_folio(p_proveedor uuid, p_factura text, p_fecha date) returns uuid[]
language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(o.id order by o.fecha), '{}')
  from ordenes_compra o
  where folios_casan(o.factura_proveedor, p_factura) and o.estado not in ('borrador', 'cancelada')
    and mismo_proveedor(o.proveedor_id, p_proveedor) and p_fecha between o.fecha - 15 and o.fecha + 365
$$;
revoke execute on function public.ordenes_por_folio(uuid, text, date) from public, anon, authenticated;

-- Pone las ligas de una compra (sin quitar las que ya tiene). Revisa que cada orden sea del
-- mismo proveedor y esté viva.
create or replace function public.poner_ligas_compra(p_movimiento uuid, p_ordenes uuid[], p_como text) returns int
language plpgsql security definer set search_path = public as $$
declare m movimientos_proveedor; r record; n int := 0;
begin
  select * into m from movimientos_proveedor where id = p_movimiento;
  if m.id is null or m.tipo <> 'compra' then raise exception 'Solo una compra se liga a una orden de compra' using errcode = '22023'; end if;
  for r in select o.id, o.folio, o.estado, o.proveedor_id from ordenes_compra o where o.id = any(coalesce(p_ordenes, '{}')) loop
    if r.estado in ('borrador', 'cancelada') then
      raise exception 'La orden % está %: no se le liga una factura', r.folio, case r.estado when 'borrador' then 'en borrador' else 'cancelada' end using errcode = '22023';
    end if;
    if not mismo_proveedor(r.proveedor_id, m.proveedor_id) then
      raise exception 'La orden % es de otro proveedor', r.folio using errcode = '22023';
    end if;
    insert into compra_oc (movimiento_id, orden_compra_id, como) values (p_movimiento, r.id, p_como) on conflict do nothing;
    n := n + 1;
  end loop;
  if n < cardinality(array(select distinct unnest(coalesce(p_ordenes, '{}')))) then raise exception 'Alguna de esas órdenes no existe' using errcode = '22023'; end if;
  return n;
end $$;
revoke execute on function public.poner_ligas_compra(uuid, uuid[], text) from public, anon, authenticated;

-- Cambiar a qué órdenes es una compra ya registrada (y su categoría, que manda en lo que no
-- tenga orden o artículo). La lista que llega es la que queda.
create or replace function public.ligar_compra_oc(p_movimiento uuid, p_ordenes uuid[], p_categoria text default null) returns int
language plpgsql security definer set search_path = public as $$
declare m movimientos_proveedor; v_cat text; n int;
begin
  if not puede('finanzas', 2) then raise exception 'Ligar facturas es de finanzas' using errcode = '42501'; end if;
  select * into m from movimientos_proveedor where id = p_movimiento for update;
  if m.id is null or m.tipo <> 'compra' then raise exception 'Solo una compra se liga a una orden de compra' using errcode = '22023'; end if;
  v_cat := coalesce(nullif(trim(p_categoria), ''), nullif(trim(m.categoria), ''));
  if cardinality(coalesce(p_ordenes, '{}')) = 0 and v_cat is null then
    raise exception 'Sin orden de compra, la categoría es lo que dice en qué se gastó: elígela' using errcode = '22023';
  end if;
  delete from compra_oc where movimiento_id = p_movimiento and orden_compra_id <> all(coalesce(p_ordenes, '{}'));
  n := poner_ligas_compra(p_movimiento, p_ordenes, 'a_mano');
  if v_cat is distinct from m.categoria then update movimientos_proveedor set categoria = v_cat where id = p_movimiento; end if;
  return n;
end $$;
revoke execute on function public.ligar_compra_oc(uuid, uuid[], text) from public, anon;
grant execute on function public.ligar_compra_oc(uuid, uuid[], text) to authenticated;

-- Las órdenes de un proveedor que pueden ser de esta factura, las más probables primero: la que
-- ya está ligada, la que casa por folio, la del mismo total. «facturada» = ya tiene otra factura.
create or replace function public.ordenes_para_ligar(p_proveedor uuid, p_factura text default null,
  p_monto numeric default null, p_movimiento uuid default null)
returns table (id uuid, folio text, fecha date, estado text, moneda text, total numeric, total_mxn numeric,
  factura_proveedor text, partidas int, sin_articulo int, ligada boolean, facturada boolean, casa_folio boolean, casa_total boolean)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
begin
  if not puede('finanzas', 2) then raise exception 'Ligar facturas es de finanzas' using errcode = '42501'; end if;
  return query
  select o.id, o.folio, o.fecha, o.estado, o.moneda::text, o.total, round(o.total * o.tipo_cambio, 2), o.factura_proveedor,
    (select count(*)::int from oc_lineas l where l.orden_compra_id = o.id),
    (select count(*)::int from oc_lineas l where l.orden_compra_id = o.id and l.articulo_id is null),
    x.ligada, x.facturada, folios_casan(o.factura_proveedor, p_factura),
    coalesce(abs(o.total * o.tipo_cambio - p_monto) <= greatest(1, p_monto * 0.01), false)
  from ordenes_compra o
  cross join lateral (select exists (select 1 from compra_oc c where c.orden_compra_id = o.id and c.movimiento_id = p_movimiento) ligada,
                             exists (select 1 from compra_oc c where c.orden_compra_id = o.id and c.movimiento_id is distinct from p_movimiento) facturada) x
  where mismo_proveedor(o.proveedor_id, p_proveedor) and o.estado in ('enviada', 'parcial', 'recibida')
    and (o.fecha >= current_date - 365 or x.ligada)
  order by x.ligada desc, folios_casan(o.factura_proveedor, p_factura) desc,
    coalesce(abs(o.total * o.tipo_cambio - p_monto) <= greatest(1, p_monto * 0.01), false) desc,
    x.facturada, o.fecha desc
  limit 25;
end $$;
revoke execute on function public.ordenes_para_ligar(uuid, text, numeric, uuid) from public, anon;
grant execute on function public.ordenes_para_ligar(uuid, text, numeric, uuid) to authenticated;

-- Las facturas de una orden, para verlas desde la orden. El monto, solo a finanzas.
create or replace function public.facturas_de_oc(p_oc uuid)
returns table (movimiento_id uuid, factura text, fecha date, monto numeric, como text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not (puede('finanzas', 2) or ve_costos_compra()) then return; end if;
  return query
  select m.id, m.factura, m.fecha, case when puede('finanzas', 2) then m.monto end, c.como
  from compra_oc c join movimientos_proveedor m on m.id = c.movimiento_id
  where c.orden_compra_id = p_oc order by m.fecha;
end $$;
revoke execute on function public.facturas_de_oc(uuid) from public, anon;
grant execute on function public.facturas_de_oc(uuid) to authenticated;

-- Almacén captura el folio al recibir, a veces después de que finanzas ya registró la factura:
-- entonces se ligan solas.
create or replace function public.trg_oc_liga_por_folio() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.factura_proveedor is not distinct from old.factura_proveedor or new.estado in ('borrador', 'cancelada') then return new; end if;
  insert into compra_oc (movimiento_id, orden_compra_id, como)
  select m.id, new.id, 'folio' from movimientos_proveedor m
  where m.tipo = 'compra' and folios_casan(new.factura_proveedor, m.factura)
    and mismo_proveedor(new.proveedor_id, m.proveedor_id) and m.fecha between new.fecha - 15 and new.fecha + 365
  on conflict do nothing;
  return new;
end $$;
drop trigger if exists liga_por_folio on public.ordenes_compra;
create trigger liga_por_folio after update of factura_proveedor on public.ordenes_compra
  for each row execute function public.trg_oc_liga_por_folio();

-- Las dos categorías que pone el artículo de una partida (Resultados las suma por nombre).
insert into public.compras_categorias (categoria, tipo) values
  ('consumibles del taller', 'fabricacion'), ('material de inventario', 'material')
on conflict (categoria) do nothing;

-- Las compras del ERP de un periodo, ya repartidas: las ligadas a una orden, por partida con la
-- categoría de su artículo; las demás, enteras con la de la factura. Sin IVA si tienen factura.
-- La usan Resultados y la lista de categorías, para que digan lo mismo.
create or replace function public.compras_erp(p_desde date, p_hasta date)
returns table (movimiento_id uuid, fecha date, categoria text, importe numeric, con_orden boolean, sin_articulo boolean)
language sql stable security definer set search_path = public as $$
  with iva as (select coalesce((select (valor #>> '{}')::numeric from configuracion where clave = 'iva'), 0.16) t),
  m as (
    select m.id, m.fecha, coalesce(nullif(trim(m.categoria), ''), 'Sin categoría') categoria,
      case when coalesce(m.cfdi_uuid, nullif(trim(m.factura), '')) is not null then m.monto / (1 + iva.t) else m.monto end importe
    from movimientos_proveedor m cross join iva
    where m.tipo = 'compra' and m.fecha between p_desde and p_hasta
  ),
  p as (
    select x.movimiento_id, greatest(l.importe * o.tipo_cambio, 0) peso, l.articulo_id is null sin_articulo,
      case when l.articulo_id is null or a.tipo = 'servicio' or not a.controla_inventario then null
           when coalesce(c.consumible_taller, false) then 'Consumibles del taller'
           else 'material' end clase
    from compra_oc x
    join ordenes_compra o on o.id = x.orden_compra_id and o.estado <> 'cancelada'
    join oc_lineas l on l.orden_compra_id = o.id
    left join articulos a on a.id = l.articulo_id
    left join categorias c on c.id = a.categoria_id
    where x.movimiento_id in (select id from m)
  ),
  t as (select movimiento_id, sum(peso) peso, count(*) n from p group by 1)
  select m.id, m.fecha,
    case when p.clase is null then m.categoria
         when p.clase = 'material' then case when tipo_categoria_compra(m.categoria) = 'material' then m.categoria else 'Material de inventario' end
         else p.clase end,
    m.importe * case when t.peso > 0 then p.peso / t.peso else 1.0 / t.n end,
    true, p.sin_articulo
  from m join p on p.movimiento_id = m.id join t on t.movimiento_id = m.id
  union all
  select m.id, m.fecha, m.categoria, m.importe, false, false
  from m where not exists (select 1 from p where p.movimiento_id = m.id)
$$;
revoke execute on function public.compras_erp(date, date) from public, anon, authenticated;

-- La de 118 con un parámetro más al final: de qué órdenes es la compra (las llamadas por nombre siguen igual).
drop function if exists public.registrar_movimiento_proveedor(uuid, text, numeric, date, text, text, text, date, text, boolean, text, text, text);
create or replace function public.registrar_movimiento_proveedor(
  p_proveedor uuid, p_tipo text, p_monto numeric, p_fecha date default null, p_cuenta text default null,
  p_factura text default null, p_descripcion text default null, p_vence date default null,
  p_categoria text default null, p_anticipo boolean default false,
  p_cfdi_uuid text default null, p_metodo_pago text default null, p_leido_de text default null,
  p_ordenes uuid[] default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_llave text; v_prov proveedores; v_fecha date := coalesce(p_fecha, hoy_planta()); v_saldo numeric; v_id uuid; v_ocs uuid[];
begin
  if not puede('finanzas', 2) then raise exception 'Solo finanzas registra compras y pagos a proveedores' using errcode = '42501'; end if;
  if coalesce(p_monto, 0) <= 0 then raise exception 'El monto tiene que ser mayor a cero' using errcode = '22023'; end if;
  if v_fecha > hoy_planta() then raise exception 'La fecha no puede ser futura' using errcode = '22023'; end if;
  if p_tipo not in ('compra', 'pago', 'reembolso_pendiente', 'reembolso_realizado') then
    raise exception 'Tipo de movimiento desconocido: %', p_tipo using errcode = '22023';
  end if;
  if p_leido_de is not null and p_leido_de not in ('xml', 'pdf', 'captura') then
    raise exception 'Origen de la factura desconocido: %', p_leido_de using errcode = '22023';
  end if;
  if p_tipo = 'pago' and p_cuenta is null then raise exception 'Di de qué cuenta salió el pago' using errcode = '22023'; end if;
  if p_cfdi_uuid is not null and exists (select 1 from movimientos_proveedor where cfdi_uuid = upper(trim(p_cfdi_uuid))) then
    raise exception 'Esa factura (folio fiscal %) ya está registrada', upper(trim(p_cfdi_uuid)) using errcode = '23505';
  end if;
  select * into v_prov from proveedores where id = p_proveedor;
  if not found then raise exception 'No existe ese proveedor' using errcode = '22023'; end if;
  -- De qué orden es: la que dijo quien registra o, si no dijo, la que casa por folio. Sin orden,
  -- la categoría es lo único que dice en qué se gastó: es obligatoria.
  if p_tipo = 'compra' then
    v_ocs := coalesce(p_ordenes, ordenes_por_folio(p_proveedor, p_factura, v_fecha));
    if cardinality(v_ocs) = 0 and coalesce(nullif(trim(p_categoria), ''), nullif(trim(v_prov.categoria), '')) is null then
      raise exception 'Sin orden de compra, la categoría es lo que dice en qué se gastó: elígela' using errcode = '22023';
    end if;
  end if;
  -- La llave del libro de la hoja, para que hoja y ERP sumen en el mismo renglón.
  v_llave := coalesce(
    (select proveedor_llave from historial_compras_hoja where proveedor_id = p_proveedor order by fecha desc limit 1),
    (select proveedor_llave from movimientos_proveedor where proveedor_id = p_proveedor limit 1),
    case when v_prov.legacy_id like 'PROV:%' then substr(v_prov.legacy_id, 6) end,
    'erp:' || p_proveedor::text);
  perform pg_advisory_xact_lock(hashtext('movimiento_proveedor:' || v_llave));
  if p_tipo = 'pago' and not p_anticipo then
    select saldo into v_saldo from v_saldo_arranque_proveedores where proveedor_llave = v_llave;
    if p_monto > coalesce(v_saldo, 0) + 0.5 then
      raise exception 'El pago (%) es mayor que lo que se le debe (%): si es un anticipo, márcalo como anticipo',
        to_char(p_monto, 'FM$999,999,990.00'), to_char(greatest(coalesce(v_saldo, 0), 0), 'FM$999,999,990.00') using errcode = '22023';
    end if;
  end if;
  insert into movimientos_proveedor (proveedor_id, proveedor_llave, tipo, fecha, monto, cuenta, categoria, factura, descripcion, vence_el,
    cfdi_uuid, metodo_pago, leido_de)
  values (p_proveedor, v_llave, p_tipo, v_fecha, round(p_monto, 2), p_cuenta,
    case when p_tipo = 'compra' then coalesce(nullif(trim(p_categoria), ''), v_prov.categoria) end,
    nullif(trim(p_factura), ''), nullif(trim(p_descripcion), ''),
    case when p_tipo = 'compra' then coalesce(p_vence, v_fecha + coalesce(v_prov.dias_credito, 0)) end,
    upper(nullif(trim(p_cfdi_uuid), '')), case when p_tipo = 'compra' then p_metodo_pago end,
    case when p_tipo in ('compra', 'reembolso_pendiente') then p_leido_de end)
  returning id into v_id;
  if cardinality(v_ocs) > 0 then
    perform poner_ligas_compra(v_id, v_ocs, case when p_ordenes is null then 'folio' else 'a_mano' end);
  end if;
  return v_id;
end $$;
revoke execute on function public.registrar_movimiento_proveedor(uuid, text, numeric, date, text, text, text, date, text, boolean, text, text, text, uuid[]) from public, anon;
grant execute on function public.registrar_movimiento_proveedor(uuid, text, numeric, date, text, text, text, date, text, boolean, text, text, text, uuid[]) to authenticated;

-- La de 201; solo cambian las compras del ERP (repartidas por partida) y el desglose compras_erp.
create or replace function public.resultados_periodo(p_desde date, p_hasta date)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_iva numeric := coalesce((select (valor #>> '{}')::numeric from configuracion where clave = 'iva'), 0.16);
  v_prod int := departamento_produccion();
  v_arr date := coalesce((select (valor #>> '{}')::date from configuracion where clave = 'fecha_arranque'), current_date);
  v_mes_arr date;
  v_taller numeric;
  v_res jsonb;
  v_tot jsonb;
begin
  if not (puede('costos', 1) and (puede('finanzas', 1) or puede('analisis', 1))) then
    raise exception 'Los resultados son de dirección y finanzas' using errcode = '42501';
  end if;
  if p_hasta < p_desde then raise exception 'El periodo está al revés'; end if;
  v_mes_arr := date_trunc('month', v_arr)::date;
  -- La nómina de la hoja no separa taller y oficina: se reparte con la proporción de los sueldos de hoy.
  select coalesce(sum(s.sueldo_semanal) filter (where e.departamento_id is not distinct from v_prod) / nullif(sum(s.sueldo_semanal), 0), 0.7)
  into v_taller
  from empleados e
  join lateral (select x.sueldo_semanal from nomina_sueldos x where x.empleado_id = e.id order by x.desde desc limit 1) s on true
  where e.activo;

  with
  -- Ventas. Antes del arranque, las de la hoja (como Análisis), con su familia para la línea y sin IVA
  -- cuando hubo factura; desde el arranque, los pedidos del ERP.
  hoja_ventas as (
    select case when h.familia in ('dosificadoras', 'bandas', 'helicoidales', 'tolvas_silos', 'cribas', 'elevadores') then 'maquinaria'
                when h.familia in ('banda_hule', 'poleas', 'colectores', 'cosedoras') then 'refacciones' else 'otros' end linea,
      case when lower(trim(coalesce(h.factura, ''))) not in ('', '-', 's/f', 'sf', 'n/a') then h.monto / (1 + v_iva) else h.monto end importe
    from historial_ventas_hoja h
    where h.tipo = 'Venta' and h.fecha between p_desde and least(p_hasta, v_arr - 1)
  ),
  lineas as (
    select pl.linea::text linea, pl.importe * p.tipo_cambio importe, pl.cantidad * coalesce(c.costo_material, 0) material,
      coalesce(c.costo_total, 0) > 0 con_costo
    from pedido_lineas pl join pedidos p on p.id = pl.pedido_id
    left join costos_calculados c on c.articulo_id = pl.articulo_id
    where p.fecha between greatest(p_desde, v_arr) and p_hasta and p.estado <> 'cancelado' and not p.historico and pl.importe > 0
  ),
  ventas as (
    select linea, importe from hoja_ventas union all select linea, importe from lineas
  ),
  -- Material/precio de lo vendido con costeo en el último año. El costeo es el de hoy, así que la
  -- muestra es la de hoy aunque el periodo sea viejo.
  muestra as (
    select pl.linea::text linea, sum(pl.importe * p.tipo_cambio) importe, sum(pl.cantidad * c.costo_material) material, count(*) n
    from pedido_lineas pl join pedidos p on p.id = pl.pedido_id
    join costos_calculados c on c.articulo_id = pl.articulo_id and c.costo_total > 0
    where p.fecha > current_date - 365 and p.estado <> 'cancelado' and pl.importe > 0
    group by 1
  ),
  -- Con menos de 10 partidas vendidas la proporción de ventas es ruido: se usa la del catálogo.
  catalogo as (
    select linea_de(c.articulo_id)::text linea, sum(c.costo_material) material, sum(pr.precio) importe
    from costos_calculados c join precios_lista pr on pr.articulo_id = c.articulo_id
    where c.costo_total > 0 and pr.precio > 0 and linea_de(c.articulo_id) is not null
    group by 1
  ),
  proporcion as (
    select coalesce(m.linea, k.linea) linea,
      case when coalesce(m.n, 0) >= 10 then m.material / nullif(m.importe, 0) else k.material / nullif(k.importe, 0) end r,
      case when coalesce(m.n, 0) >= 10 then 'ventas' else 'catalogo' end fuente,
      coalesce(m.n, 0) partidas
    from muestra m full join catalogo k on k.linea = m.linea
  ),
  global as (
    select coalesce((select sum(material) / nullif(sum(importe), 0) from muestra where n >= 10),
                    (select sum(material) / nullif(sum(importe), 0) from catalogo)) r
  ),
  material as (
    select coalesce(sum(l.material) filter (where l.con_costo), 0) exacto,
      coalesce(sum(l.importe * least(greatest(coalesce(p.r, g.r, 0.5), 0.05), 0.95)) filter (where not l.con_costo), 0) estimado,
      coalesce(sum(l.importe) filter (where l.con_costo), 0) ventas_con_costo,
      coalesce(sum(l.importe), 0) ventas_erp
    from lineas l left join proporcion p on p.linea = l.linea cross join global g
  ),
  -- Compras: antes del arranque, el libro de la hoja; desde el arranque, el del ERP. Sin IVA si hubo factura.
  compras_todas as (
    select 'hoja' fuente, h.fecha, h.categoria, h.importe from compras_hoja(p_desde, least(p_hasta, v_arr - 1)) h
    union all
    -- Las ligadas a su orden de compra, por partida con la categoría de su artículo (compras_erp).
    select 'erp', c.fecha, c.categoria, c.importe from compras_erp(greatest(p_desde, v_arr), p_hasta) c
  ),
  compras as (
    select tipo_categoria_compra(c.categoria) tipo, min(c.categoria) categoria, lower(trim(c.categoria)) llave,
      sum(c.importe) importe
    from compras_todas c
    -- Desde el mes del arranque la comisión la calcula la regla (comisiones_mes); antes, la que se pagó.
    where not (lower(trim(c.categoria)) = 'comisiones' and c.fecha >= v_mes_arr)
      -- En el ERP los sueldos salen de nómina, no del libro de compras.
      and not (c.fuente = 'erp' and tipo_categoria_compra(c.categoria) = 'nomina')
    group by 1, 3
  ),
  -- Sueldos del ERP (desde el arranque): días de semanas cerradas con lo pagado; los demás, con el
  -- sueldo semanal ÷ 7 (antes de su primer sueldo registrado, ese primero).
  dias as (select d::date dia from generate_series(greatest(p_desde, v_arr), p_hasta, interval '1 day') d),
  cerradas as (select inicio from nomina_semanas where estado = 'cerrada' and inicio between greatest(p_desde, v_arr) - 6 and p_hasta),
  estimado as (
    select (e.departamento_id is not distinct from v_prod) taller, sum(s.sueldo_semanal / 7) importe
    from dias d
    join empleados e on e.fecha_ingreso <= d.dia and (e.activo or e.baja_en >= d.dia)
    join lateral (select x.sueldo_semanal from nomina_sueldos x where x.empleado_id = e.id
                  order by (x.desde <= d.dia) desc, case when x.desde <= d.dia then x.desde end desc, x.desde limit 1) s on true
    where not exists (select 1 from cerradas c where d.dia between c.inicio and c.inicio + 6)
    group by 1
  ),
  real as (
    select (e.departamento_id is not distinct from v_prod) taller,
      sum(n.total_percepciones * (least(c.inicio + 6, p_hasta) - greatest(c.inicio, p_desde, v_arr) + 1) / 7.0) importe
    from cerradas c join nomina_renglones n on n.semana = c.inicio join empleados e on e.id = n.empleado_id
    group by 1
  ),
  hoja_nomina as (select coalesce(sum(importe), 0) importe from compras where tipo = 'nomina'),
  comisiones as (
    select coalesce(sum(c.total), 0) importe
    from generate_series(greatest(date_trunc('month', p_desde)::date, v_mes_arr), date_trunc('month', p_hasta)::date, interval '1 month') g
    cross join lateral comisiones_mes(g::date) c
  ),
  hoja_comisiones as (select coalesce(sum(importe), 0) importe from compras where llave = 'comisiones')
  select jsonb_build_object(
    'periodo', jsonb_build_object('desde', p_desde, 'hasta', p_hasta),
    'arranque', v_arr,
    'usa_hoja', p_desde < v_arr,
    'ventas', (select coalesce(jsonb_agg(jsonb_build_object('linea', linea, 'importe', round(s, 2)) order by s desc), '[]')
               from (select linea, sum(importe) s from ventas group by linea) z),
    'ventas_total', (select round(coalesce(sum(importe), 0), 2) from ventas),
    'ventas_hoja', (select round(coalesce(sum(importe), 0), 2) from hoja_ventas),
    'material', (select jsonb_build_object('exacto', round(exacto, 2), 'estimado', round(estimado, 2),
                  'cobertura', round(ventas_con_costo / nullif(ventas_erp, 0), 4),
                  -- En la historia no hay costeo de lo vendido: el material es lo que se compró de material.
                  'comprado_hoja', (select round(coalesce(sum(importe), 0), 2) from compras_todas t
                                    where t.fuente = 'hoja' and tipo_categoria_compra(t.categoria) = 'material')) from material),
    'proporcion', (select coalesce(jsonb_object_agg(linea, jsonb_build_object('r', round(r, 4), 'fuente', fuente, 'partidas', partidas)), '{}')
                   from proporcion where r is not null and linea is not null),
    'proporcion_global', (select round(r, 4) from global),
    'proporcion_taller', round(v_taller, 4),
    'mano_obra', jsonb_build_object('estimado', (select round(coalesce(sum(importe), 0), 2) from estimado where taller),
                                    'real', (select round(coalesce(sum(importe), 0), 2) from real where taller),
                                    'hoja', (select round(importe * v_taller, 2) from hoja_nomina)),
    'sueldos_oficina', jsonb_build_object('estimado', (select round(coalesce(sum(importe), 0), 2) from estimado where not taller),
                                          'real', (select round(coalesce(sum(importe), 0), 2) from real where not taller),
                                          'hoja', (select round(importe * (1 - v_taller), 2) from hoja_nomina)),
    'semanas_cerradas', (select count(*) from cerradas),
    'comisiones', (select round(importe, 2) from comisiones) + (select round(importe, 2) from hoja_comisiones),
    'comisiones_hoja', (select round(importe, 2) from hoja_comisiones),
    -- comisiones_mes solo da las de todos a quien ve comisiones; a los demás, las suyas (cero).
    'comisiones_completas', puede('comisiones', 1) or puede('ventas', 3),
    'fabricacion', (select coalesce(jsonb_agg(jsonb_build_object('categoria', categoria, 'importe', round(importe, 2)) order by importe desc), '[]') from compras where tipo = 'fabricacion'),
    'operacion', (select coalesce(jsonb_agg(jsonb_build_object('categoria', categoria, 'importe', round(importe, 2)) order by importe desc), '[]') from compras where tipo = 'operacion' and llave <> 'comisiones'),
    'impuestos', (select coalesce(jsonb_agg(jsonb_build_object('categoria', categoria, 'importe', round(importe, 2)) order by importe desc), '[]') from compras where tipo in ('impuestos', 'financiero')),
    'fuera', (select coalesce(jsonb_agg(jsonb_build_object('categoria', categoria, 'importe', round(importe, 2)) order by importe desc), '[]') from compras where tipo = 'fuera'),
    'nomina_hoja', (select round(importe, 2) from hoja_nomina),
    'material_comprado', (select round(coalesce(sum(importe), 0), 2) from compras_todas t where t.fuente = 'erp' and tipo_categoria_compra(t.categoria) = 'material'),
    'compras_erp', (select jsonb_build_object('con_orden', round(coalesce(sum(c.importe) filter (where c.con_orden), 0), 2),
                      'sin_orden', round(coalesce(sum(c.importe) filter (where not c.con_orden), 0), 2),
                      'sin_articulo', round(coalesce(sum(c.importe) filter (where c.sin_articulo), 0), 2))
                    from compras_erp(greatest(p_desde, v_arr), p_hasta) c),
    'caja_chica', (select round(coalesce(-sum(importe), 0), 2) from caja_chica where tipo = 'salida' and fecha between p_desde and p_hasta),
    -- Lo que Mercado Libre se queda de cada venta (comisión, envío que paga Hegamex, otros cargos).
    -- Las retenciones no: son impuestos a cuenta, no gasto.
    'mercado_libre', (select round(coalesce(sum(comision + envio + otros), 0), 2) from ml_pagos
                      where estado = 'approved' and (pagado_en at time zone 'America/Mexico_City')::date between p_desde and p_hasta),
    -- Las guías que pagamos (Envíos), por la fecha en que salió el paquete.
    'envios', (select round(coalesce(sum(costo_real), 0), 2) from envios
               where estado <> 'cancelado' and coalesce(enviado_en, guia_en, solicitado_en) is not null
                 and (coalesce(enviado_en, guia_en, solicitado_en) at time zone 'America/Mexico_City')::date between p_desde and p_hasta),
    'sin_clasificar', (select coalesce(jsonb_agg(distinct t.categoria), '[]') from compras_todas t
                       where t.categoria <> 'Sin categoría'
                         and not exists (select 1 from compras_categorias k where k.categoria = lower(trim(t.categoria)))),
    'sin_categoria', (select round(coalesce(sum(importe), 0), 2) from compras_todas where categoria = 'Sin categoría'),
    -- Desde cuándo tiene datos cada fuente: un periodo anterior sale incompleto y la pantalla lo dice.
    'desde_compras', least((select min(fecha) from historial_compras_2018_2021), (select min(fecha) from historial_compras_hoja where tipo = 'Compra'),
                           (select min(fecha) from movimientos_proveedor where tipo = 'compra')),
    'desde_caja', (select min(fecha) from caja_chica),
    'desde_ventas', least((select min(fecha) from historial_ventas_hoja), (select min(fecha) from pedidos)),
    'sin_sueldo', (select count(*) from empleados e where e.activo and not exists (select 1 from nomina_sueldos s where s.empleado_id = e.id))
  ) into v_res;

  -- Los totales los da la base para que la pantalla no saque su propia utilidad.
  select jsonb_build_object(
    'material', mat, 'mano_obra', mo, 'gastos_fabricacion', gf, 'costo_fabricacion', mat + mo + gf,
    'sueldos_oficina', so, 'compras_operacion', co,
    'gastos_operacion', so + com + co + caja + ml + env,
    'utilidad_operacion', ven - (mat + mo + gf) - (so + com + co + caja + ml + env),
    'impuestos_financieros', imp,
    'utilidad', ven - (mat + mo + gf) - (so + com + co + caja + ml + env) - imp,
    'fuera', fue)
  into v_tot
  from (select (v_res->>'ventas_total')::numeric ven,
          (v_res#>>'{material,exacto}')::numeric + (v_res#>>'{material,estimado}')::numeric + (v_res#>>'{material,comprado_hoja}')::numeric mat,
          (v_res#>>'{mano_obra,estimado}')::numeric + (v_res#>>'{mano_obra,real}')::numeric + (v_res#>>'{mano_obra,hoja}')::numeric mo,
          (select coalesce(sum((x->>'importe')::numeric), 0) from jsonb_array_elements(v_res->'fabricacion') x) gf,
          (v_res#>>'{sueldos_oficina,estimado}')::numeric + (v_res#>>'{sueldos_oficina,real}')::numeric + (v_res#>>'{sueldos_oficina,hoja}')::numeric so,
          (v_res->>'comisiones')::numeric com,
          (select coalesce(sum((x->>'importe')::numeric), 0) from jsonb_array_elements(v_res->'operacion') x) co,
          (v_res->>'caja_chica')::numeric caja, (v_res->>'mercado_libre')::numeric ml, (v_res->>'envios')::numeric env,
          (select coalesce(sum((x->>'importe')::numeric), 0) from jsonb_array_elements(v_res->'impuestos') x) imp,
          (select coalesce(sum((x->>'importe')::numeric), 0) from jsonb_array_elements(v_res->'fuera') x) fue) z;
  return v_res || jsonb_build_object('totales', v_tot);
end $$;
revoke execute on function public.resultados_periodo(date, date) from public, anon;
grant execute on function public.resultados_periodo(date, date) to authenticated;

-- La de 201 con las compras del ERP como las cuenta Resultados (sin IVA y repartidas por partida).
create or replace function public.categorias_compra_periodo(p_desde date, p_hasta date)
returns table (categoria text, tipo text, clasificada boolean, compras int, importe numeric)
language plpgsql stable security definer set search_path = public as $$
declare v_arr date := coalesce((select (valor #>> '{}')::date from configuracion where clave = 'fecha_arranque'), current_date);
begin
  if not (puede('costos', 1) and (puede('finanzas', 1) or puede('analisis', 1))) then
    raise exception 'Sin permiso' using errcode = '42501';
  end if;
  return query
  with t as (
    select h.categoria c, h.importe m from compras_hoja(p_desde, least(p_hasta, v_arr - 1)) h
    where h.categoria <> 'Sin categoría'
    union all
    -- Una factura cuenta una vez por categoría aunque se reparta en varias partidas.
    select c.categoria, sum(c.importe) from compras_erp(greatest(p_desde, v_arr), p_hasta) c
    where c.categoria <> 'Sin categoría' group by c.movimiento_id, c.categoria
  )
  select lower(trim(t.c)), tipo_categoria_compra(t.c),
    exists (select 1 from compras_categorias k where k.categoria = lower(trim(t.c))), count(*)::int, round(sum(t.m), 2)
  from t
  group by 1, 2, 3
  order by 5 desc;
end $$;
revoke execute on function public.categorias_compra_periodo(date, date) from public, anon;
grant execute on function public.categorias_compra_periodo(date, date) to authenticated;

-- La de 050 sin las órdenes que ya tienen su factura en la cuenta del proveedor (contaban dos veces).
create or replace view public.v_por_pagar with (security_invoker = true) as
select cp.orden_compra_id, cp.folio, cp.proveedor_id, cp.proveedor, cp.fecha, cp.vence_pago, cp.moneda, cp.total,
  cp.pagado, cp.saldo, cp.factura_proveedor, pr.dias_credito, pr.categoria, pr.datos_bancarios,
  round(cp.saldo * case when cp.moneda = 'MXN' then 1 else tc(cp.moneda) end, 2) as saldo_mxn,
  cp.vence_pago - current_date as dias_para_vencer,
  (select max(x.fecha) from public.pagos_proveedor x where x.orden_compra_id = cp.orden_compra_id) as ultimo_pago
from public.v_cuentas_por_pagar cp
join public.proveedores pr on pr.id = cp.proveedor_id
where cp.saldo > 0
  and not exists (select 1 from public.compra_oc x where x.orden_compra_id = cp.orden_compra_id);

-- La de 131: una orden con su factura ligada ya cuenta por la factura.
create or replace function public.compras_proveedores_12m(p_proveedor uuid default null)
returns table (proveedor_id uuid, comprado_12m numeric, ultima_compra date)
language plpgsql stable security definer set search_path = public as $$
begin
  if not (puede('costos', 1) or puede('finanzas', 1)) then return; end if;
  return query
  with todo as (
    select h.proveedor_id, h.monto, h.fecha from historial_compras_hoja h
    where h.tipo = 'Compra' and h.proveedor_id is not null and h.fecha >= current_date - 365
      and (p_proveedor is null or h.proveedor_id = p_proveedor)
      and h.id not in (select i.id from v_compras_hoja_ignoradas i)
    union all
    select m.proveedor_id, m.monto, m.fecha from v_movimientos_proveedor m
    where m.tipo = 'compra' and not m.en_hoja and m.proveedor_id is not null and m.fecha >= current_date - 365
      and (p_proveedor is null or m.proveedor_id = p_proveedor)
    union all
    select o.proveedor_id, o.total * o.tipo_cambio, o.fecha from ordenes_compra o
    where o.estado <> 'cancelada' and o.fecha >= current_date - 365
      and not exists (select 1 from compra_oc x where x.orden_compra_id = o.id)
      and (p_proveedor is null or o.proveedor_id = p_proveedor)
  )
  -- Préstamos de socios y créditos de banco no son compras.
  select t.proveedor_id, round(sum(t.monto), 2), max(t.fecha) from todo t
  join proveedores p on p.id = t.proveedor_id and coalesce(p.tipo_acreedor, 'proveedor') = 'proveedor'
  group by t.proveedor_id;
end $$;

-- Las facturas que ya estaban registradas: se ligan las que casan por folio con una orden.
insert into public.compra_oc (movimiento_id, orden_compra_id, como, ligada_por)
select m.id, o, 'folio', null
from public.movimientos_proveedor m cross join lateral unnest(public.ordenes_por_folio(m.proveedor_id, m.factura, m.fecha)) o
where m.tipo = 'compra' and m.factura is not null
on conflict do nothing;

notify pgrst, 'reload schema';

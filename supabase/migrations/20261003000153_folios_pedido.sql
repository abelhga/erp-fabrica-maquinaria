-- Folios de pedido: PED-26-799.
--
-- El ERP numeraba PED-2026-00001 desde cero, y en la planta y con los clientes cada pedido
-- se conoce por su número corrido de la hoja de Susana ("el 798"), que nunca reinicia. El
-- formato nuevo junta las dos cosas: el año del pedido para ubicarlo y el número corrido
-- que todos conocen. El siguiente al 798 es PED-26-799; en 2027 sigue el número (PED-27-8xx),
-- no vuelve a 1.
--
-- Mercado Libre, la tienda web y Amazon llevan su propia serie por año (ML-26-0001,
-- WEB-26-0001, AMZ-26-0001): son muchas ventas chicas y no deben comerse el número que la
-- planta usa para hablar de un equipo.
--
-- Un equipo de stock que se vende ya no necesita una "S": su pedido lleva el folio normal y
-- la orden de stock se le asigna con «Usar OP-…» (151).
--
-- Los pedidos que ya estaban en el ERP con otro folio (HIS-…, P-…, PED-2026-…) se renumeran
-- con el número de su PDF; el folio anterior se guarda y se sigue encontrando en el buscador.

alter table public.pedidos add column if not exists folio_anterior text;
create index if not exists pedidos_folio_anterior on public.pedidos (folio_anterior) where folio_anterior is not null;

-- La serie corrida de pedidos vive en folios con año 0 ("no reinicia").
create or replace function public.folio_pedido(p_canal canal_venta, p_fecha date) returns text
language plpgsql security definer set search_path = public as $$
declare v_fecha date := coalesce(p_fecha, hoy_mx()); v_serie text; v_anio int; v_n int;
begin
  v_serie := case p_canal when 'mercadolibre' then 'ML' when 'sitio_web' then 'WEB' when 'amazon' then 'AMZ' else 'PED' end;
  v_anio := case when v_serie = 'PED' then 0 else extract(year from v_fecha)::int end;
  insert into folios (serie, anio, ultimo) values (v_serie, v_anio, 1)
  on conflict (serie, anio) do update set ultimo = folios.ultimo + 1
  returning ultimo into v_n;
  return format('%s-%s-%s', v_serie, to_char(v_fecha, 'YY'), lpad(v_n::text, case when v_serie = 'PED' then 3 else 4 end, '0'));
end $$;
revoke execute on function public.folio_pedido(canal_venta, date) from public, anon, authenticated;

create or replace function public.trg_pedido() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' and coalesce(new.folio, '') = '' then new.folio := folio_pedido(new.canal, new.fecha); end if;
  -- Un pedido de Mercado Libre que captura la vendedora es suyo si no dice otra cosa.
  if tg_op = 'INSERT' and new.vendedor_id is null and auth.uid() is not null and puede('ventas', 2) then
    new.vendedor_id := auth.uid();
  end if;
  if tg_op = 'UPDATE' and new.estado = 'entregado' and old.estado <> 'entregado' then new.entregado_en := now(); end if;
  if tg_op = 'UPDATE' and new.estado = 'cancelado' and old.estado <> 'cancelado'
     and coalesce(length(trim(new.motivo_cancelacion)), 0) < 3 then
    raise exception 'Anota el motivo de la cancelación' using errcode = '23514';
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- Renumerar lo que ya está en el ERP
-- ---------------------------------------------------------------------------
-- La relación sale de los PDF de pedido de Susana (2025 y 2026): cliente, fecha y total
-- (el ERP guarda el total con IVA). Lo que no tiene PDF (ventas de refacciones de la hoja de
-- comisiones) se queda con su folio HIS: no tuvo número de pedido.
create temp table _renumerar (folio text primary key, numero int not null unique) on commit drop;
-- 88 pedidos con su número del PDF (relación por cliente, fecha y total; ver el commit).
insert into _renumerar (folio, numero) values
  ('HIS-SR-0001', 661),
  ('HIS-SR-0005', 663),
  ('HIS-SR-0010', 675),
  ('HIS-JM-0001', 679),
  ('HIS-IH-0003', 684),
  ('HIS-IH-0006', 685),
  ('HIS-IH-0008', 686),
  ('HIS-JM-0003', 687),
  ('HIS-IH-0012', 688),
  ('HIS-IH-0017', 689),
  ('HIS-JM-0006', 691),
  ('HIS-IH-0030', 692),
  ('HIS-IH-0035', 693),
  ('HIS-IH-0036', 694),
  ('HIS-IH-0043', 695),
  ('HIS-JM-0008', 696),
  ('HIS-IH-0047', 697),
  ('HIS-IH-0051', 698),
  ('HIS-IH-0052', 699),
  ('HIS-JM-0015', 702),
  ('HIS-IH-0077', 707),
  ('HIS-IH-0078', 708),
  ('HIS-JM-0037', 711),
  ('HIS-SR-0040', 712),
  ('HIS-IH-0104', 714),
  ('HIS-IH-0107', 716),
  ('HIS-JM-0042', 719),
  ('HIS-JM-0045', 720),
  ('HIS-JM-0047', 721),
  ('HIS-JM-0050', 722),
  ('HIS-IH-0120', 723),
  ('HIS-IH-0121', 724),
  ('HIS-JM-0049', 725),
  ('HIS-IH-0123', 726),
  ('HIS-JM-0052', 727),
  ('HIS-JM-0056', 728),
  ('HIS-JM-0053', 729),
  ('HIS-JM-0058', 731),
  ('HIS-IH-0133', 732),
  ('HIS-SR-0048', 733),
  ('HIS-IH-0136', 734),
  ('HIS-JM-0061', 735),
  ('HIS-JM-0062', 736),
  ('HIS-JM-0064', 738),
  ('HIS-JM-0068', 739),
  ('HIS-IH-0151', 741),
  ('HIS-IH-0156', 742),
  ('HIS-IH-0175', 746),
  ('HIS-JM-0086', 747),
  ('HIS-JM-0087', 748),
  ('HIS-JM-0096', 752),
  ('HIS-IH-0183', 753),
  ('HIS-IH-0188', 754),
  ('HIS-IH-0193', 757),
  ('HIS-JM-0115', 758),
  ('HIS-IH-0202', 759),
  ('HIS-IH-0205', 760),
  ('HIS-JM-0121', 761),
  ('HIS-JM-0123', 762),
  ('HIS-JM-0124', 763),
  ('HIS-IH-0228', 766),
  ('HIS-JM-0147', 768),
  ('HIS-IH-0233', 769),
  ('HIS-SR-0063', 770),
  ('HIS-JM-0152', 772),
  ('HIS-SR-0064', 773),
  ('HIS-JM-0161', 774),
  ('HIS-IH-0237', 775),
  ('HIS-JM-0163', 776),
  ('HIS-IH-0239', 777),
  ('HIS-JM-0164', 778),
  ('HIS-IH-0242', 779),
  ('P-780', 780),
  ('HIS-JM-0168', 781),
  ('HIS-IH-0246', 783),
  ('HIS-JM-0173', 784),
  ('HIS-IH-0248', 785),
  ('HIS-IH-0259', 786),
  ('P-788', 788),
  ('HIS-IH-0267', 789),
  ('HIS-IH-0273', 791),
  ('HIS-IH-0274', 792),
  ('HIS-JM-0193', 793),
  ('HIS-JM-0200', 794),
  ('HIS-JM-0201', 795),
  ('P-796', 796),
  ('HIS-IH-0291', 797),
  ('HIS-JM-0218', 798)
on conflict do nothing;

-- Los pedidos que ya nacieron en el ERP (PED-2026-…) siguen al 798 en el orden en que se capturaron.
insert into _renumerar (folio, numero)
select folio, 798 + row_number() over (order by creado_en, folio)
from public.pedidos where folio like 'PED-____-_____';

-- El S131 (cribadora y bazuca de stock que se vendieron a Roberto Becerra) no lleva S: es
-- un pedido como cualquiera y toma el siguiente número (el «S131» se sigue encontrando: queda
-- en su referencia externa).
insert into _renumerar (folio, numero)
select 'HIS-JM-0198', coalesce((select max(numero) from _renumerar where numero > 798), 798) + 1
where exists (select 1 from public.pedidos where folio = 'HIS-JM-0198');

do $$
declare v_dup text;
begin
  -- El folio nuevo no puede ser el de otro pedido que no se renumera.
  select string_agg(r.folio || ' → ' || n.nuevo, ', ') into v_dup
  from _renumerar r join public.pedidos p on p.folio = r.folio
  cross join lateral (select format('PED-%s-%s', to_char(p.fecha, 'YY'), lpad(r.numero::text, 3, '0')) nuevo) n
  where exists (select 1 from public.pedidos x where x.folio = n.nuevo and x.folio not in (select folio from _renumerar));
  if v_dup is not null then raise exception 'Choque de folios: %', v_dup; end if;
  -- (En una base sin los pedidos de la hoja, como la local de pruebas, simplemente no están.)
  delete from _renumerar r where not exists (select 1 from public.pedidos p where p.folio = r.folio);
end $$;

-- Primero a un folio provisional y luego al final: así ningún paso choca con otro.
update public.pedidos p set folio_anterior = coalesce(p.folio_anterior, p.folio), folio = 'TMP-' || r.numero
from _renumerar r where r.folio = p.folio;
update public.pedidos p set folio = format('PED-%s-%s', to_char(p.fecha, 'YY'), lpad(substr(p.folio, 5), 3, '0'))
where p.folio like 'TMP-%';

insert into public.folios (serie, anio, ultimo)
values ('PED', 0, greatest(798, coalesce((select max(numero) from _renumerar), 0)))
on conflict (serie, anio) do update set ultimo = greatest(folios.ultimo, excluded.ultimo);

-- ---------------------------------------------------------------------------
-- Que el folio de antes se siga encontrando
-- ---------------------------------------------------------------------------
create or replace view public.v_pedidos with (security_invoker = true) as
SELECT p.id,
    p.folio,
    p.fecha,
    p.fecha_compromiso,
    p.estado,
    p.canal,
    p.id_externo,
    p.historico,
    p.cliente_id,
    cl.nombre AS cliente,
    p.vendedor_id,
    pf.nombre AS vendedor,
    p.cotizacion_id,
    ct.folio AS cotizacion_folio,
    p.moneda,
    p.tipo_cambio,
    p.subtotal,
    p.iva,
    p.total,
    COALESCE(cb.cobrado, 0::numeric) AS cobrado,
        CASE
            WHEN p.estado = 'cancelado'::estado_pedido OR p.historico THEN 0::numeric
            ELSE p.total - COALESCE(cb.cobrado, 0::numeric)
        END AS saldo,
    (EXISTS ( SELECT 1
           FROM facturas f
          WHERE f.pedido_id = p.id)) AS facturado,
    op.ordenes,
    op.terminadas,
    op.avance,
    p.fecha_compromiso < hoy_mx() AND (p.estado <> ALL (ARRAY['entregado'::estado_pedido, 'cancelado'::estado_pedido])) AS atrasado,
    (( SELECT count(*) AS count
           FROM pedido_vendedores v
          WHERE v.pedido_id = p.id)) > 1 AS credito_compartido,
    p.entregado_en,
    p.motivo_cancelacion,
    p.creado_en,
    p.folio_anterior
   FROM pedidos p
     JOIN clientes cl ON cl.id = p.cliente_id
     LEFT JOIN perfiles pf ON pf.id = p.vendedor_id
     LEFT JOIN cotizaciones ct ON ct.id = p.cotizacion_id
     LEFT JOIN LATERAL ( SELECT sum(c.monto) AS cobrado
           FROM cobros c
          WHERE c.pedido_id = p.id) cb ON true
     LEFT JOIN LATERAL ( SELECT count(*) AS ordenes,
            count(*) FILTER (WHERE o.estado = ANY (ARRAY['terminada'::estado_op, 'entregada'::estado_op])) AS terminadas,
            round(avg(
                CASE
                    WHEN o.estado = ANY (ARRAY['terminada'::estado_op, 'entregada'::estado_op]) THEN 100::numeric
                    WHEN h.total > 0::numeric THEN 100::numeric * h.hechas / h.total
                    ELSE 0::numeric
                END)) AS avance
           FROM ordenes_produccion o
             LEFT JOIN LATERAL ( SELECT sum(x.horas_estimadas) AS total,
                    COALESCE(sum(x.horas_estimadas) FILTER (WHERE x.estado = 'terminada'::estado_operacion), 0::numeric) AS hechas
                   FROM op_operaciones x
                  WHERE x.orden_id = o.id) h ON true
          WHERE o.pedido_id = p.id AND o.estado <> 'cancelada'::estado_op) op ON true;

-- La de 151, y el pedido también se encuentra por su folio anterior.
CREATE OR REPLACE FUNCTION public.buscar_global(q text)
 RETURNS TABLE(tipo text, id text, titulo text, subtitulo text, ruta text)
 LANGUAGE sql
 STABLE
AS $function$
  with t as (select sin_acentos(trim(q)) t)
  -- Ingeniería abre la ficha de costeo; quien vende (sin costeo), la del catálogo con su
  -- precio, y solo lo que se vende; los demás no reciben artículos.
  (select case a.tipo when 'equipo' then 'equipo' when 'subensamble' then 'subensamble' else 'componente' end,
          a.id::text, a.nombre, a.clave,
          case when (select puede('costeo', 1))
               then case when a.tipo in ('equipo', 'subensamble') then '/costeo/equipos/' else '/costeo/componentes/' end || a.id
               else '/catalogo?articulo=' || a.id end
   from articulos a, t where a.activo and sin_acentos(a.clave || ' ' || a.nombre) like '%' || replace(t.t, ' ', '%') || '%'
     and ((select puede('costeo', 1))
          or ((select ve_precios_venta()) and a.se_vende and a.tipo in ('equipo', 'componente')))
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
  -- Pedidos sin montos: la planta también los encuentra y cae en su pantalla de pedidos.
  (select 'pedido', p.id::text, p.folio, (select nombre from clientes where id = p.cliente_id),
          case when (select puede('ventas', 1)) then '/ventas/pedidos/' || p.id else '/produccion/pedidos?pedido=' || p.id end
   from pedidos_basicos() p cross join t
   -- (El folio de antes, "HIS-JM-0218", lo encuentra quien ve pedidos: ventas.)
   left join pedidos x on x.id = p.id
   where sin_acentos(p.folio || ' ' || coalesce(p.id_externo, '') || ' ' || coalesce(x.folio_anterior, '')) like '%' || t.t || '%'
   order by p.fecha desc limit 5)
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

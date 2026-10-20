-- =============================================================================
-- Finanzas fuera de compras e importaciones, y compras repetidas en la hoja.
--
-- 1. Permisos. Importaciones y compras tenían "Finanzas: ver" desde que se crearon. No lo
--    usan para su trabajo (el dinero de importaciones sale de compras 2 y costos; los pagos
--    de órdenes de compra, de compras 2), pero con él leían la cobranza, todos los clientes
--    y contactos, todos los pedidos y el libro de ventas. Se quita.
--
-- 2. Compras repetidas en la hoja. Qué se rompía: en el libro de compras hay facturas
--    capturadas dos veces (Baleros 5960, Héctor Barrios 6,254.72 y otras 11). Una se pagó y
--    la otra se quedó como deuda que no existe. Finanzas la "pagó" con la fecha del pago
--    original, y la regla que evita contar dos veces un pago (en_hoja: mismo proveedor,
--    monto y ±7 días) tomó ese pago por el que ya estaba en la hoja: no bajó el saldo y,
--    para el historial, el dinero salió dos veces. El error de fondo es la compra repetida.
--    * compras_hoja_repetidas: finanzas marca la copia ("estaba repetida", con motivo) y
--      deja de contar en el saldo y en las facturas por pagar. Se guarda la huella
--      (proveedor, fecha, monto, factura) y no el id, porque importar.ts vacía y vuelve a
--      numerar la tabla; de cada huella se ignoran tantas copias como marcas tenga.
--    * v_compras_proveedor_pendientes.posible_repetida avisa de las que parecen repetidas.
--    * Un pago o compra con fecha anterior al arranque de finanzas que ya está en la hoja se
--      rechaza con la explicación, en vez de guardarse sin efecto.
-- 3. Arreglo de los tres pagos del 19 de octubre y sus dos compras repetidas.
-- =============================================================================

delete from public.permisos_rol where rol in ('importaciones', 'compras') and modulo = 'finanzas';

create table public.compras_hoja_repetidas (
  id bigint generated always as identity primary key,
  proveedor_llave text not null,
  fecha date not null,
  monto numeric(14,2) not null,
  factura text,
  motivo text not null check (length(trim(motivo)) >= 3),
  marcada_por uuid references public.perfiles(id) default auth.uid(),
  marcada_en timestamptz not null default now()
);
create index compras_hoja_repetidas_huella on public.compras_hoja_repetidas (proveedor_llave, fecha, monto);
alter table public.compras_hoja_repetidas enable row level security;
create policy ver on public.compras_hoja_repetidas for select to authenticated using ((select puede('finanzas', 2)));
grant select on public.compras_hoja_repetidas to authenticated;
create trigger auditar after insert or update or delete on public.compras_hoja_repetidas for each row execute function public.auditar();

-- Qué renglones de la hoja ya no cuentan: de cada huella marcada, las últimas copias.
create or replace view public.v_compras_hoja_ignoradas with (security_invoker = true) as
select x.id, m.motivo, m.marcada_por, m.marcada_en, m.marca_id
from (select r.proveedor_llave, r.fecha, r.monto, coalesce(r.factura, '') as f, count(*) as n,
             max(r.motivo) as motivo, max(r.marcada_por::text)::uuid as marcada_por, max(r.marcada_en) as marcada_en, max(r.id) as marca_id
      from compras_hoja_repetidas r group by 1, 2, 3, 4) m
cross join lateral (
  select h.id, row_number() over (order by h.id desc) as rn
  from historial_compras_hoja h
  where h.tipo = 'Compra' and h.proveedor_llave = m.proveedor_llave and h.fecha = m.fecha
    and h.monto = m.monto and coalesce(h.factura, '') = m.f) x
where x.rn <= m.n;
grant select on public.v_compras_hoja_ignoradas to authenticated;

-- La gemela de una compra de la hoja: otra compra del mismo proveedor, mismo monto, a una
-- semana o menos, con la misma factura, o con factura en una y sin factura en la otra. Dos
-- sin factura no cuentan (los préstamos de socios se repiten así y son de verdad), y a socios
-- y bancos no se les busca.
create or replace function public.tiene_gemela_hoja(p_id bigint) returns boolean
language sql stable security invoker as $$
  select exists (
    select 1 from historial_compras_hoja a join historial_compras_hoja b
      on b.proveedor_llave = a.proveedor_llave and b.tipo = 'Compra' and b.id <> a.id
     and abs(b.monto - a.monto) < 0.01 and abs(b.fecha - a.fecha) <= 7
     and (llave_factura(a.factura) = llave_factura(b.factura) or ((a.factura is null) <> (b.factura is null)))
    where a.id = p_id and a.tipo = 'Compra'
      and not exists (select 1 from proveedores p where p.id = a.proveedor_id and p.tipo_acreedor <> 'proveedor')
      and b.id not in (select id from v_compras_hoja_ignoradas))
$$;

create or replace function public.marcar_compra_repetida(p_hoja_id bigint, p_motivo text) returns void
language plpgsql security definer set search_path = public as $$
declare h historial_compras_hoja;
begin
  if not puede('finanzas', 2) then raise exception 'Solo finanzas corrige el libro de compras' using errcode = '42501'; end if;
  if coalesce(length(trim(p_motivo)), 0) < 3 then raise exception 'Anota por qué estaba repetida' using errcode = '23514'; end if;
  select * into h from historial_compras_hoja where id = p_hoja_id;
  if h.id is null or h.tipo <> 'Compra' then raise exception 'Esa no es una compra de la hoja'; end if;
  if h.id in (select id from v_compras_hoja_ignoradas) then raise exception 'Esa compra ya está marcada como repetida'; end if;
  if not tiene_gemela_hoja(p_hoja_id) then
    raise exception 'No hay otra compra igual (mismo monto, a una semana) en la hoja: no parece repetida' using errcode = '23514';
  end if;
  insert into compras_hoja_repetidas (proveedor_llave, fecha, monto, factura, motivo)
  values (h.proveedor_llave, h.fecha, h.monto, h.factura, trim(p_motivo));
end $$;

create or replace function public.desmarcar_compra_repetida(p_hoja_id bigint) returns void
language plpgsql security definer set search_path = public as $$
declare h historial_compras_hoja; v_marca bigint;
begin
  if not puede('finanzas', 2) then raise exception 'Solo finanzas corrige el libro de compras' using errcode = '42501'; end if;
  select * into h from historial_compras_hoja where id = p_hoja_id;
  select max(r.id) into v_marca from compras_hoja_repetidas r
  where r.proveedor_llave = h.proveedor_llave and r.fecha = h.fecha and r.monto = h.monto and coalesce(r.factura, '') = coalesce(h.factura, '');
  if v_marca is null then raise exception 'Esa compra no está marcada como repetida'; end if;
  delete from compras_hoja_repetidas where id = v_marca;
end $$;

-- Saldo por proveedor: igual que antes, sin las compras repetidas.
create or replace view public.v_saldo_arranque_proveedores with (security_invoker = true) as
 WITH libro AS (
         SELECT h.proveedor_llave,
            (array_agg(h.proveedor_id) FILTER (WHERE h.proveedor_id IS NOT NULL))[1] AS proveedor_id,
            max(h.proveedor_nombre) AS nombre_hoja,
            sum(h.monto) FILTER (WHERE h.tipo = 'Adeudo 2021'::text) AS adeudo_2021,
            sum(h.monto) FILTER (WHERE h.tipo = 'Compra'::text) AS comprado,
            sum(h.monto) FILTER (WHERE h.tipo = 'Pago'::text) AS pagado,
            sum(h.monto * signo_compra_hoja(h.tipo)::numeric) AS saldo_hoja,
            max(h.fecha) FILTER (WHERE h.tipo = 'Compra'::text) AS ultima_compra,
            max(h.fecha) FILTER (WHERE h.tipo = 'Pago'::text) AS ultimo_pago,
            count(*) FILTER (WHERE h.tipo <> 'Adeudo 2021'::text) AS movimientos
           FROM historial_compras_hoja h
          WHERE h.id NOT IN (SELECT i.id FROM v_compras_hoja_ignoradas i)
          GROUP BY h.proveedor_llave
        ), erp AS (
         SELECT m.proveedor_llave,
            (array_agg(m.proveedor_id))[1] AS proveedor_id,
            COALESCE(sum(m.monto) FILTER (WHERE m.tipo = 'compra'::text AND NOT m.en_hoja), 0::numeric) AS comprado_erp,
            COALESCE(sum(m.monto) FILTER (WHERE m.tipo = 'pago'::text AND NOT m.en_hoja), 0::numeric) AS pagado_erp,
            COALESCE(sum(m.monto * signo_movimiento_proveedor(m.tipo)::numeric) FILTER (WHERE NOT m.en_hoja), 0::numeric) AS saldo_erp,
            max(m.fecha) FILTER (WHERE m.tipo = 'compra'::text) AS ultima_compra,
            max(m.fecha) FILTER (WHERE m.tipo = 'pago'::text) AS ultimo_pago,
            count(*) AS movimientos
           FROM v_movimientos_proveedor m
          GROUP BY m.proveedor_llave
        )
 SELECT COALESCE(l.proveedor_llave, e.proveedor_llave) AS proveedor_llave,
    COALESCE(l.proveedor_id, e.proveedor_id) AS proveedor_id,
    COALESCE(p.nombre, l.nombre_hoja) AS nombre,
    p.categoria,
    COALESCE(p.tipo_acreedor, 'proveedor'::text) AS tipo_acreedor,
    l.adeudo_2021,
    l.comprado,
    l.pagado,
    COALESCE(l.saldo_hoja, 0::numeric) AS saldo_hoja,
    COALESCE(e.comprado_erp, 0::numeric) AS comprado_erp,
    COALESCE(e.pagado_erp, 0::numeric) AS pagado_erp,
    COALESCE(l.saldo_hoja, 0::numeric) + COALESCE(e.saldo_erp, 0::numeric) AS saldo,
    GREATEST(l.ultima_compra, e.ultima_compra) AS ultima_compra,
    GREATEST(l.ultimo_pago, e.ultimo_pago) AS ultimo_pago,
    COALESCE(l.movimientos, 0::bigint) + COALESCE(e.movimientos, 0::bigint) AS movimientos,
    COALESCE(f.vencido, 0::numeric) AS vencido,
    f.proximo_vence
   FROM libro l
     FULL JOIN erp e ON e.proveedor_llave = l.proveedor_llave
     LEFT JOIN proveedores p ON p.id = COALESCE(l.proveedor_id, e.proveedor_id)
     LEFT JOIN ( SELECT c.proveedor_llave,
            sum(c.restante) FILTER (WHERE c.vence_el < hoy_planta()) AS vencido,
            min(c.vence_el) FILTER (WHERE c.vence_el >= hoy_planta() AND c.restante > 0::numeric) AS proximo_vence
           FROM v_compras_proveedor_pendientes c
          GROUP BY c.proveedor_llave) f ON f.proveedor_llave = COALESCE(l.proveedor_llave, e.proveedor_llave);

-- Facturas por pagar: sin las repetidas, y avisando de las que lo parecen.
create or replace view public.v_compras_proveedor_pendientes with (security_invoker = true) as
 WITH cargos AS (
         SELECT 'hoja:'::text || h.id AS id,
            h.proveedor_llave,
            h.proveedor_id,
            h.fecha,
            h.factura,
            h.descripcion,
            NULL::text AS categoria,
            h.monto,
            h.fecha + COALESCE(p.dias_credito, 0) AS vence_el,
            'hoja'::text AS origen,
            llave_factura(h.factura) AS fk,
            h.id AS hoja_id
           FROM historial_compras_hoja h
             LEFT JOIN proveedores p ON p.id = h.proveedor_id
          WHERE (h.tipo = ANY (ARRAY['Compra'::text, 'Adeudo 2021'::text, 'Reembolso Realizado'::text])) AND h.monto > 0::numeric
            AND h.id NOT IN (SELECT i.id FROM v_compras_hoja_ignoradas i)
        UNION ALL
         SELECT m.id::text AS id,
            m.proveedor_llave,
            m.proveedor_id,
            m.fecha,
            m.factura,
            m.descripcion,
            m.categoria,
            m.monto,
            COALESCE(m.vence_el, m.fecha) AS "coalesce",
            'erp'::text,
            llave_factura(m.factura) AS llave_factura,
            NULL::bigint
           FROM v_movimientos_proveedor m
          WHERE (m.tipo = ANY (ARRAY['compra'::text, 'reembolso_realizado'::text])) AND NOT m.en_hoja
        ), abonos AS (
         SELECT h.proveedor_llave,
            llave_factura(h.factura) AS fk,
            h.monto
           FROM historial_compras_hoja h
          WHERE h.tipo = ANY (ARRAY['Pago'::text, 'Reembolso Pend.'::text])
        UNION ALL
         SELECT h.proveedor_llave,
            NULL::text,
            - h.monto
           FROM historial_compras_hoja h
          WHERE (h.tipo = ANY (ARRAY['Compra'::text, 'Adeudo 2021'::text, 'Reembolso Realizado'::text])) AND h.monto < 0::numeric
        UNION ALL
         SELECT m.proveedor_llave,
            llave_factura(m.factura) AS llave_factura,
            m.monto
           FROM v_movimientos_proveedor m
          WHERE (m.tipo = ANY (ARRAY['pago'::text, 'reembolso_pendiente'::text])) AND NOT m.en_hoja
        ), por_factura AS (
         SELECT a_1.proveedor_llave,
            a_1.fk,
            a_1.pagado,
            COALESCE(c.cargado, 0::numeric) AS cargado
           FROM ( SELECT abonos.proveedor_llave,
                    abonos.fk,
                    sum(abonos.monto) AS pagado
                   FROM abonos
                  WHERE abonos.fk IS NOT NULL
                  GROUP BY abonos.proveedor_llave, abonos.fk) a_1
             LEFT JOIN ( SELECT cargos.proveedor_llave,
                    cargos.fk,
                    sum(cargos.monto) AS cargado
                   FROM cargos
                  WHERE cargos.fk IS NOT NULL
                  GROUP BY cargos.proveedor_llave, cargos.fk) c ON c.proveedor_llave = a_1.proveedor_llave AND c.fk = a_1.fk
        ), libre AS (
         SELECT x.proveedor_llave,
            sum(x.monto) AS libre
           FROM ( SELECT abonos.proveedor_llave,
                    abonos.monto
                   FROM abonos
                  WHERE abonos.fk IS NULL
                UNION ALL
                 SELECT por_factura.proveedor_llave,
                    por_factura.pagado - por_factura.cargado
                   FROM por_factura
                  WHERE por_factura.pagado > por_factura.cargado) x
          GROUP BY x.proveedor_llave
        ), directo AS (
         SELECT c.id,
            c.proveedor_llave,
            c.proveedor_id,
            c.fecha,
            c.factura,
            c.descripcion,
            c.categoria,
            c.monto,
            c.vence_el,
            c.origen,
            c.fk,
            c.hoja_id,
            LEAST(c.monto, GREATEST(0::numeric, COALESCE(f.pagado, 0::numeric) - (sum(c.monto) OVER (PARTITION BY c.proveedor_llave, c.fk ORDER BY c.vence_el, c.fecha, c.id) - c.monto))) AS pagado_directo
           FROM cargos c
             LEFT JOIN por_factura f ON f.proveedor_llave = c.proveedor_llave AND f.fk = c.fk
        ), acum AS (
         SELECT d.id,
            d.proveedor_llave,
            d.proveedor_id,
            d.fecha,
            d.factura,
            d.descripcion,
            d.categoria,
            d.monto,
            d.vence_el,
            d.origen,
            d.fk,
            d.hoja_id,
            d.pagado_directo,
            sum(d.monto - d.pagado_directo) OVER (PARTITION BY d.proveedor_llave ORDER BY d.vence_el, d.fecha, d.id) AS acumulado
           FROM directo d
        )
 SELECT a.id,
    a.proveedor_llave,
    a.proveedor_id,
    a.fecha,
    a.factura,
    a.descripcion,
    a.categoria,
    a.monto,
    a.vence_el,
    a.origen,
    GREATEST(0::numeric, LEAST(a.monto - a.pagado_directo, a.acumulado - COALESCE(l.libre, 0::numeric))) AS restante,
    a.hoja_id,
    -- Solo se pregunta por las que siguen debiéndose: una pagada no estorba aunque esté doble.
    CASE WHEN a.hoja_id IS NOT NULL AND GREATEST(0::numeric, LEAST(a.monto - a.pagado_directo, a.acumulado - COALESCE(l.libre, 0::numeric))) > 0
         THEN tiene_gemela_hoja(a.hoja_id) ELSE false END AS posible_repetida
   FROM acum a
     LEFT JOIN libre l ON l.proveedor_llave = a.proveedor_llave;

-- Un pago (o compra) con fecha de antes del arranque que ya está en la hoja no cambia nada:
-- se rechaza con la explicación en vez de guardarse sin efecto.
create or replace function public.trg_movimiento_ya_en_hoja() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_arranque date; v_hoja date;
begin
  select (valor #>> '{}')::date into v_arranque from configuracion where clave = 'fecha_arranque_finanzas';
  if v_arranque is null or new.fecha >= v_arranque then return new; end if;
  select h.fecha into v_hoja from historial_compras_hoja h
  where h.proveedor_llave = new.proveedor_llave and abs(h.monto - new.monto) < 0.01
    and h.fecha between new.fecha - 7 and new.fecha + 7
    and h.tipo = case new.tipo when 'compra' then 'Compra' when 'pago' then 'Pago'
                               when 'reembolso_pendiente' then 'Reembolso Pend.' else 'Reembolso Realizado' end
  order by abs(h.fecha - new.fecha) limit 1;
  if v_hoja is null then return new; end if;
  if new.tipo = 'pago' then
    raise exception 'Ese pago ya está en la hoja (el %), así que no cambiaría el saldo. Si la factura sigue saliendo por pagar, seguramente está capturada dos veces en la hoja: márcala con «Estaba repetida».',
      to_char(v_hoja, 'DD/MM/YYYY') using errcode = '23505';
  end if;
  raise exception 'Esa compra ya está en la hoja (el %): no hace falta capturarla otra vez.', to_char(v_hoja, 'DD/MM/YYYY') using errcode = '23505';
end $$;
create trigger ya_en_hoja before insert on public.movimientos_proveedor for each row execute function public.trg_movimiento_ya_en_hoja();

-- Arreglo de datos (19 de octubre): los tres pagos que finanzas capturó para saldar las dos
-- compras repetidas, y las compras repetidas mismas. Solo si existen tal cual (la base local
-- y las pruebas no los tienen).
delete from public.movimientos_proveedor
where id in ('3718b4a4-8ea8-4262-b474-b5418f94ac69', 'da9fb272-d3f5-4583-946c-bf974d6db493', '130f39d5-d904-44c1-b310-86d32e1ea2d2')
  and tipo = 'pago';
insert into public.compras_hoja_repetidas (proveedor_llave, fecha, monto, factura, motivo, marcada_por)
select h.proveedor_llave, h.fecha, h.monto, h.factura,
  'Capturada dos veces en la hoja; se pagó la otra (revisión con finanzas, 20 de octubre)',
  (select id from auth.users where lower(email) = 'adriana.garcia@hegamex.com')
from public.historial_compras_hoja h
where (h.proveedor_llave = 'hector barrios camacho' and h.fecha = '2022-08-04' and h.monto = 6254.72 and h.factura is null and h.tipo = 'Compra')
   or (h.proveedor_llave = 'baleros e insumos agricolas' and h.fecha = '2026-04-08' and h.monto = 2204 and h.factura = '5960'
       and h.orden is null and h.tipo = 'Compra');

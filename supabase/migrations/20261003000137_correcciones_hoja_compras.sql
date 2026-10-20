-- =============================================================================
-- Correcciones del libro de compras de la hoja que finanzas va encontrando.
--
-- 1. «Dice que el proveedor no existe»: la compra 2370 de Cristoper Amaury Castruita Huitrom
--    venía de la hoja sin proveedor del catálogo (no existía al importar). Susana lo dio de
--    alta hoy, pero la hoja solo se ligaba al importar, así que la compra siguió suelta y el
--    pago no tenía a quién registrarse. Ahora un proveedor nuevo (o renombrado) se liga solo
--    a sus renglones sueltos de la hoja por nombre, y finanzas puede ligar a mano una cuenta
--    suelta con otro nombre (ligar_hoja_proveedor).
-- 2. Lo que la hoja trae de más no se podía quitar si era un pago (solo compras repetidas).
--    Compresores Romero gdl tiene la compra A1019 y su anticipo repetidos (la misma compra
--    está completa en Carolina Romero Lopez). Ahora un renglón de compra o de pago se marca
--    «no cuenta» por repetido, o una compra por factura cancelada (la 419 de Jessica Tinoco
--    Esparza). Queda tachado con su motivo y se puede deshacer; la hoja no se toca.
-- 3. (En pantalla) diferencias de centavos entre una factura y su pago (la 546 de Tinoco:
--    $3,466.99 contra $3,466.90) la dejaban en la lista «por pagar» por $0.09. La base sigue
--    exacta (lo pendiente suma el saldo al centavo); la lista ya no enseña menos de $1.
-- =============================================================================

-- 1. Proveedores y la hoja ---------------------------------------------------------
create or replace function public.trg_ligar_hoja_proveedor() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update historial_compras_hoja set proveedor_id = new.id
  where proveedor_id is null and proveedor_llave = regexp_replace(trim(sin_acentos(new.nombre)), '\s+', ' ', 'g');
  return null;
end $$;
drop trigger if exists ligar_hoja on public.proveedores;
create trigger ligar_hoja after insert or update of nombre on public.proveedores
  for each row execute function public.trg_ligar_hoja_proveedor();

-- Una cuenta de la hoja con otro nombre que el del catálogo («FERRECSA» contra su razón social).
create or replace function public.ligar_hoja_proveedor(p_llave text, p_proveedor uuid) returns int
language plpgsql security definer set search_path = public as $$
declare v_n int;
begin
  if not puede('finanzas', 2) then raise exception 'Solo finanzas corrige el libro de compras' using errcode = '42501'; end if;
  if not exists (select 1 from proveedores where id = p_proveedor) then raise exception 'Ese proveedor no existe en el catálogo'; end if;
  update historial_compras_hoja set proveedor_id = p_proveedor where proveedor_llave = p_llave and proveedor_id is null;
  get diagnostics v_n = row_count;
  if v_n = 0 then raise exception 'Esa cuenta de la hoja ya está ligada a un proveedor'; end if;
  return v_n;
end $$;
revoke execute on function public.ligar_hoja_proveedor(text, uuid) from public, anon;
grant execute on function public.ligar_hoja_proveedor(text, uuid) to authenticated;

-- Lo que ya quedó suelto.
update public.historial_compras_hoja h set proveedor_id = p.id
from public.proveedores p
where h.proveedor_id is null and h.proveedor_llave = regexp_replace(trim(public.sin_acentos(p.nombre)), '\s+', ' ', 'g');

-- 2. Renglones de la hoja que no cuentan: compras o pagos, repetidos o cancelados -----------
alter table public.compras_hoja_repetidas add column if not exists tipo text not null default 'Compra' check (tipo in ('Compra', 'Pago'));
alter table public.compras_hoja_repetidas add column if not exists razon text not null default 'repetida' check (razon in ('repetida', 'cancelada'));
alter table public.compras_hoja_repetidas drop constraint if exists compras_hoja_repetidas_cancelada_compra;
alter table public.compras_hoja_repetidas add constraint compras_hoja_repetidas_cancelada_compra check (razon <> 'cancelada' or tipo = 'Compra');

create or replace view public.v_compras_hoja_ignoradas with (security_invoker = true) as
select x.id, m.motivo, m.marcada_por, m.marcada_en, m.marca_id, m.razon, m.tipo
from (select r.tipo, r.proveedor_llave, r.fecha, r.monto, coalesce(r.factura, '') as f, count(*) as n,
             max(r.motivo) as motivo, max(r.marcada_por::text)::uuid as marcada_por, max(r.marcada_en) as marcada_en, max(r.id) as marca_id,
             max(r.razon) as razon
      from compras_hoja_repetidas r group by 1, 2, 3, 4, 5) m
cross join lateral (
  select h.id, row_number() over (order by h.id desc) as rn
  from historial_compras_hoja h
  where h.tipo = m.tipo and h.proveedor_llave = m.proveedor_llave and h.fecha = m.fecha
    and h.monto = m.monto and coalesce(h.factura, '') = m.f) x
where x.rn <= m.n;
grant select on public.v_compras_hoja_ignoradas to authenticated;

-- Quitar un renglón de la hoja a mano (sin exigir gemela: la copia puede estar con otro
-- nombre de proveedor, como Romero). Queda en la bitácora con quién y por qué.
create or replace function public.ignorar_movimiento_hoja(p_hoja_id bigint, p_razon text, p_motivo text) returns void
language plpgsql security definer set search_path = public as $$
declare h historial_compras_hoja;
begin
  if not puede('finanzas', 2) then raise exception 'Solo finanzas corrige el libro de compras' using errcode = '42501'; end if;
  if coalesce(length(trim(p_motivo)), 0) < 3 then raise exception 'Anota por qué no cuenta' using errcode = '23514'; end if;
  if p_razon not in ('repetida', 'cancelada') then raise exception 'La razón es repetida o cancelada'; end if;
  select * into h from historial_compras_hoja where id = p_hoja_id;
  if h.id is null or h.tipo not in ('Compra', 'Pago') then raise exception 'Solo se quitan compras o pagos de la hoja'; end if;
  if p_razon = 'cancelada' and h.tipo <> 'Compra' then raise exception 'Cancelada aplica a una factura (compra), no a un pago'; end if;
  if h.id in (select id from v_compras_hoja_ignoradas) then raise exception 'Ese renglón ya no cuenta'; end if;
  insert into compras_hoja_repetidas (proveedor_llave, fecha, monto, factura, motivo, tipo, razon)
  values (h.proveedor_llave, h.fecha, h.monto, h.factura, trim(p_motivo), h.tipo, p_razon);
end $$;
revoke execute on function public.ignorar_movimiento_hoja(bigint, text, text) from public, anon;
grant execute on function public.ignorar_movimiento_hoja(bigint, text, text) to authenticated;

create or replace function public.desmarcar_compra_repetida(p_hoja_id bigint) returns void
language plpgsql security definer set search_path = public as $$
declare h historial_compras_hoja; v_marca bigint;
begin
  if not puede('finanzas', 2) then raise exception 'Solo finanzas corrige el libro de compras' using errcode = '42501'; end if;
  select * into h from historial_compras_hoja where id = p_hoja_id;
  select max(r.id) into v_marca from compras_hoja_repetidas r
  where r.tipo = h.tipo and r.proveedor_llave = h.proveedor_llave and r.fecha = h.fecha and r.monto = h.monto
    and coalesce(r.factura, '') = coalesce(h.factura, '');
  if v_marca is null then raise exception 'Ese renglón no está marcado'; end if;
  delete from compras_hoja_repetidas where id = v_marca;
end $$;

-- Los pagos que no cuentan tampoco abonan ni salen en el historial de pagos.
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
          WHERE (h.tipo = ANY (ARRAY['Compra'::text, 'Adeudo 2021'::text, 'Reembolso Realizado'::text])) AND h.monto > 0::numeric AND NOT (h.id IN ( SELECT i.id
                   FROM v_compras_hoja_ignoradas i))
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
            'erp'::text AS text,
            llave_factura(m.factura) AS llave_factura,
            NULL::bigint AS int8
           FROM v_movimientos_proveedor m
          WHERE (m.tipo = ANY (ARRAY['compra'::text, 'reembolso_realizado'::text])) AND NOT m.en_hoja
        ), abonos AS (
         SELECT h.proveedor_llave,
            llave_factura(h.factura) AS fk,
            h.monto
           FROM historial_compras_hoja h
          WHERE (h.tipo = ANY (ARRAY['Pago'::text, 'Reembolso Pend.'::text])) AND NOT (h.id IN ( SELECT i.id
                   FROM v_compras_hoja_ignoradas i))
        UNION ALL
         SELECT h.proveedor_llave,
            NULL::text AS text,
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
        CASE
            WHEN a.hoja_id IS NOT NULL AND GREATEST(0::numeric, LEAST(a.monto - a.pagado_directo, a.acumulado - COALESCE(l.libre, 0::numeric))) > 0::numeric THEN tiene_gemela_hoja(a.hoja_id)
            ELSE false
        END AS posible_repetida
   FROM acum a
     LEFT JOIN libre l ON l.proveedor_llave = a.proveedor_llave;

create or replace view public.v_pagos_hechos with (security_invoker = true) as
SELECT 'erp:'::text || m.id::text AS id,
    'erp'::text AS origen,
    m.fecha,
    m.proveedor_id,
    m.proveedor_llave,
    COALESCE(p.nombre, m.proveedor_llave) AS proveedor,
    COALESCE(p.tipo_acreedor, 'proveedor'::text) AS tipo_acreedor,
    m.monto,
    'MXN'::text AS moneda,
    m.monto AS monto_mxn,
    m.cuenta,
    cd.nombre AS cuenta_nombre,
    m.factura AS referencia,
    m.descripcion,
    rp.nombre AS registrado_por,
    m.creado_en AS registrado_en
   FROM movimientos_proveedor m
     LEFT JOIN proveedores p ON p.id = m.proveedor_id
     LEFT JOIN cuentas_dinero cd ON cd.clave = m.cuenta
     LEFT JOIN perfiles rp ON rp.id = m.registrado_por
  WHERE m.tipo = 'pago'::text
UNION ALL
 SELECT 'hoja:'::text || h.id::text AS id,
    'hoja'::text AS origen,
    h.fecha,
    h.proveedor_id,
    h.proveedor_llave,
    COALESCE(p.nombre, h.proveedor_nombre) AS proveedor,
    COALESCE(p.tipo_acreedor, 'proveedor'::text) AS tipo_acreedor,
    h.monto,
    'MXN'::text AS moneda,
    h.monto AS monto_mxn,
    cd.clave AS cuenta,
    COALESCE(cd.nombre, h.cuenta) AS cuenta_nombre,
    COALESCE(h.factura, h.orden) AS referencia,
    h.descripcion,
    NULL::text AS registrado_por,
    NULL::timestamp with time zone AS registrado_en
   FROM historial_compras_hoja h
     LEFT JOIN proveedores p ON p.id = h.proveedor_id
     LEFT JOIN cuentas_dinero cd ON cd.hoja = h.cuenta
  WHERE h.tipo = 'Pago'::text AND NOT (h.id IN ( SELECT i.id
           FROM v_compras_hoja_ignoradas i)) AND NOT (EXISTS ( SELECT 1
           FROM movimientos_proveedor m
          WHERE m.tipo = 'pago'::text AND m.proveedor_llave = h.proveedor_llave AND abs(m.monto - h.monto) < 0.01 AND m.fecha >= (h.fecha - 7) AND m.fecha <= (h.fecha + 7)))
UNION ALL
 SELECT 'oc:'::text || pp.id::text AS id,
    'orden'::text AS origen,
    pp.fecha,
    oc.proveedor_id,
    NULL::text AS proveedor_llave,
    p.nombre AS proveedor,
    COALESCE(p.tipo_acreedor, 'proveedor'::text) AS tipo_acreedor,
    pp.monto,
    oc.moneda::text AS moneda,
    round(pp.monto *
        CASE
            WHEN oc.moneda::text = 'MXN'::text THEN 1::numeric
            ELSE COALESCE(oc.tipo_cambio, 1::numeric)
        END, 2) AS monto_mxn,
    NULL::text AS cuenta,
    initcap(pp.metodo) AS cuenta_nombre,
    oc.folio || COALESCE(' · '::text || pp.referencia, ''::text) AS referencia,
    NULL::text AS descripcion,
    rp.nombre AS registrado_por,
    pp.creado_en AS registrado_en
   FROM pagos_proveedor pp
     JOIN ordenes_compra oc ON oc.id = pp.orden_compra_id
     LEFT JOIN proveedores p ON p.id = oc.proveedor_id
     LEFT JOIN perfiles rp ON rp.id = pp.registrado_por;

-- 3. Lo que encontró finanzas ------------------------------------------------------------
insert into public.compras_hoja_repetidas (proveedor_llave, fecha, monto, factura, motivo, tipo, razon)
select h.proveedor_llave, h.fecha, h.monto, h.factura, x.motivo, h.tipo, x.razon
from (values
  ('compresores romero gdl', 'Compra', 'A1019', 27780.00, 'repetida', 'La compra A1019 ya está completa en Carolina Romero Lopez (compra, anticipo y liquidación)'),
  ('compresores romero gdl', 'Pago', 'A1019', 13890.00, 'repetida', 'El anticipo de la A1019 ya está en Carolina Romero Lopez (20 oct 2025)'),
  ('jessica tinoco esparza', 'Compra', '419', 1074.02, 'cancelada', 'La factura 419 se canceló')
) as x(llave, tipo, factura, monto, razon, motivo)
join public.historial_compras_hoja h on h.proveedor_llave = x.llave and h.tipo = x.tipo and h.factura = x.factura and h.monto = x.monto
where not exists (select 1 from public.compras_hoja_repetidas r where r.proveedor_llave = h.proveedor_llave and r.tipo = h.tipo
                    and r.fecha = h.fecha and r.monto = h.monto and coalesce(r.factura, '') = coalesce(h.factura, ''));

-- =============================================================================
-- El dinero de un anticipo no cubre facturas a crédito.
--
-- Por qué: siete facturas a crédito de Aceros Ocotlán ($150,458.96, cinco ya vencidas) no salían
-- en «vencidas». El proveedor lleva dos carriles: facturas a crédito (método PPD, 30 días, se
-- pagan por transferencia una por una) y facturas de contado contra anticipo (método PUE, se
-- descuentan de un anticipo pagado antes). La cuenta del ERP juntaba todo: lo que quedaba de los
-- anticipos, más lo que la hoja trae pagado de más, se aplicaba «a lo que vence primero» y tapaba
-- las facturas a crédito. Finanzas las veía en papel y no en pantalla.
-- Y como ya salían cubiertas, no aparecían en «Factura que paga»: los pagos de octubre se
-- capturaron con el folio escrito en la referencia («FAC. 0174159»), sin ligar a su factura.
--
-- Qué cambia:
--   * Se guarda qué pago es un anticipo (hoja y ERP). Antes «es un anticipo» solo servía para
--     dejar pagar de más.
--   * Las facturas pendientes se calculan por pasos. Lo pagado sin factura que no es anticipo
--     sigue yéndose a lo que vence primero. Lo de anticipos NO cubre una factura a crédito
--     capturada en el ERP (método PPD o, si no trae método, con vencimiento posterior a su fecha):
--     lo que sobre queda «a favor». Lo de la hoja se sigue compensando como antes: ahí no hay
--     forma de saber qué anticipo se aplicó a qué factura (en 2024 el mismo proveedor aplicó un
--     anticipo a facturas PPD), y moverlo cambiaría cuentas que ya están cuadradas.
--   * La cuenta dice aparte cuánto hay por pagar y cuánto a favor. El saldo (uno menos el otro)
--     no cambia.
--   * «Ya está en la hoja» (en_hoja) mira el folio, igual que el candado de 302: una compra con
--     otro folio no es la de la hoja aunque coincidan monto y semana (los recibos de un seguro).
--   * Los pagos del ERP que traen el folio en la referencia se ligan a su factura.
-- Medido en la nube antes de publicar: de 10,207 facturas solo cambian las de Aceros Ocotlán.
-- =============================================================================

alter table public.historial_compras_hoja add column if not exists anticipo boolean not null default false;
alter table public.movimientos_proveedor add column if not exists anticipo boolean not null default false;
comment on column public.historial_compras_hoja.anticipo is 'El pago es un anticipo: no cubre facturas a crédito capturadas en el ERP.';
comment on column public.movimientos_proveedor.anticipo is 'El pago es un anticipo: no cubre facturas a crédito capturadas en el ERP.';

-- Los anticipos de la hoja: el pago lo dice en su descripción, o su folio es el de una factura de
-- «Anticipo del bien o servicio» de ese proveedor.
update public.historial_compras_hoja h set anticipo = true
where h.tipo = 'Pago' and not h.anticipo
  and (h.descripcion ~* '^\s*anticipo'
       or exists (select 1 from public.cfdi_historico c
                  where c.proveedor_id = h.proveedor_id and c.tipo = 'I' and not coalesce(c.cancelada, false)
                    and public.llave_factura(c.folio) = public.llave_factura(h.factura)
                    and exists (select 1 from jsonb_array_elements(c.conceptos) x where x->>'descripcion' ilike 'anticipo%')));

-- Pagos del ERP con el folio escrito en la referencia («FAC. 0174159»): se ligan a su factura, si
-- ese proveedor tiene una compra con ese folio.
update public.movimientos_proveedor m set factura = trim(substring(m.descripcion from '(?i)^\s*fac(?:t(?:ura)?)?\.?\s*(?:no\.?\s*|#\s*)?([0-9][0-9A-Za-z -]{3,})\s*$'))
where m.tipo = 'pago' and m.factura is null
  and m.descripcion ~* '^\s*fac(?:t(?:ura)?)?\.?\s*(?:no\.?\s*|#\s*)?[0-9][0-9A-Za-z -]{3,}\s*$'
  and (exists (select 1 from public.historial_compras_hoja h
               where h.proveedor_llave = m.proveedor_llave and h.tipo = 'Compra'
                 and public.llave_factura(h.factura) = public.llave_factura(substring(m.descripcion from '(?i)^\s*fac(?:t(?:ura)?)?\.?\s*(?:no\.?\s*|#\s*)?([0-9][0-9A-Za-z -]{3,})\s*$')))
       or exists (select 1 from public.movimientos_proveedor c
                  where c.proveedor_llave = m.proveedor_llave and c.tipo = 'compra'
                    and public.llave_factura(c.factura) = public.llave_factura(substring(m.descripcion from '(?i)^\s*fac(?:t(?:ura)?)?\.?\s*(?:no\.?\s*|#\s*)?([0-9][0-9A-Za-z -]{3,})\s*$'))));

-- ── «Ya está en la hoja» mira el folio ───────────────────────────────────────────────────────────
-- Igual que antes, más: una compra con folio solo es «la de la hoja» si la de la hoja no trae
-- folio o trae el mismo. Se agrega anticipo al final.
create or replace view public.v_movimientos_proveedor with (security_invoker = true) as
select m.id, m.proveedor_id, m.proveedor_llave, m.tipo, m.fecha, m.monto, m.cuenta, m.categoria, m.factura, m.descripcion,
  m.vence_el, m.cfdi_uuid, m.metodo_pago, m.registrado_por, m.creado_en,
  (exists (select 1 from public.historial_compras_hoja h
           where h.proveedor_llave = m.proveedor_llave
             and h.tipo = case m.tipo when 'compra' then 'Compra' when 'pago' then 'Pago'
                                      when 'reembolso_pendiente' then 'Reembolso Pend.' else 'Reembolso Realizado' end
             and abs(h.monto - m.monto) < 0.01 and h.fecha >= m.fecha - 7 and h.fecha <= m.fecha + 7
             and (m.tipo <> 'compra'
                  or coalesce(public.llave_factura(m.factura), 'SF') in ('SF', 'SN', 'NA')
                  or coalesce(public.llave_factura(h.factura), 'SF') in ('SF', 'SN', 'NA', public.llave_factura(m.factura))))) as en_hoja,
  m.anticipo
from public.movimientos_proveedor m;

-- ── Facturas pendientes, por pasos ───────────────────────────────────────────────────────────────
-- Misma vista que en 137. Cambia de dónde sale «restante»:
--   1. Lo pagado a una factura por su folio se le aplica a ella (igual que antes).
--   2. Lo pagado en la hoja sin factura (y que no es anticipo) cubre facturas de la hoja, por
--      vencimiento: el dinero de la hoja compensa primero lo de la hoja.
--   3. Lo de anticipos cubre, por vencimiento, todo menos las facturas a crédito del ERP (PPD, o
--      sin método y con vencimiento posterior a su fecha).
--   4. Lo demás (pagos del ERP sin factura, y lo que sobró del paso 2) cubre lo que vence primero
--      de lo que quede: así un pago nuevo «a lo que vence primero» baja las vencidas, no una
--      factura vieja que ya cubría un anticipo.
-- Al final: cuánto de la factura lo cubrió un anticipo.
create or replace view public.v_compras_proveedor_pendientes with (security_invoker = true) as
with cargos as (
  select 'hoja:' || h.id as id, h.proveedor_llave, h.proveedor_id, h.fecha, h.factura, h.descripcion, null::text as categoria, h.monto,
         h.fecha + coalesce(p.dias_credito, 0) as vence_el, 'hoja'::text as origen, public.llave_factura(h.factura) as fk, h.id as hoja_id,
         true as con_anticipo
  from public.historial_compras_hoja h left join public.proveedores p on p.id = h.proveedor_id
  where h.tipo in ('Compra', 'Adeudo 2021', 'Reembolso Realizado') and h.monto > 0
    and h.id not in (select i.id from public.v_compras_hoja_ignoradas i)
  union all
  select m.id::text, m.proveedor_llave, m.proveedor_id, m.fecha, m.factura, m.descripcion, m.categoria, m.monto,
         coalesce(m.vence_el, m.fecha), 'erp'::text, public.llave_factura(m.factura), null::bigint,
         -- A crédito: el XML dice PPD o, capturada a mano, vence después de su fecha.
         coalesce(m.metodo_pago = 'PUE', coalesce(m.vence_el, m.fecha) <= m.fecha)
  from public.v_movimientos_proveedor m
  where m.tipo in ('compra', 'reembolso_realizado') and not m.en_hoja
), abonos as (
  select h.proveedor_llave, public.llave_factura(h.factura) as fk, h.monto, h.anticipo, true as de_hoja
  from public.historial_compras_hoja h
  where h.tipo in ('Pago', 'Reembolso Pend.') and h.id not in (select i.id from public.v_compras_hoja_ignoradas i)
  union all
  select h.proveedor_llave, null::text, -h.monto, false, true
  from public.historial_compras_hoja h
  where h.tipo in ('Compra', 'Adeudo 2021', 'Reembolso Realizado') and h.monto < 0
  union all
  select m.proveedor_llave, public.llave_factura(m.factura), m.monto, m.anticipo, false
  from public.v_movimientos_proveedor m
  where m.tipo in ('pago', 'reembolso_pendiente') and not m.en_hoja
), por_factura as (
  select a.proveedor_llave, a.fk, a.pagado, a.de_anticipo, a.del_erp, coalesce(c.cargado, 0) as cargado
  from (select proveedor_llave, fk, sum(monto) as pagado,
               coalesce(sum(monto) filter (where anticipo), 0) as de_anticipo,
               coalesce(sum(monto) filter (where not anticipo and not de_hoja), 0) as del_erp
        from abonos where fk is not null group by proveedor_llave, fk) a
  left join (select proveedor_llave, fk, sum(monto) as cargado from cargos where fk is not null group by proveedor_llave, fk) c
    on c.proveedor_llave = a.proveedor_llave and c.fk = a.fk
), libre as (
  -- Lo que no quedó aplicado a una factura por su folio, en sus tres bolsas. De lo que sobra de un
  -- folio, primero cuenta como anticipo lo que entró como anticipo, luego lo del ERP.
  select x.proveedor_llave, sum(x.de_anticipo) as libre_anticipo, sum(x.del_erp) as libre_erp, sum(x.de_la_hoja) as libre_hoja
  from (select proveedor_llave,
               case when anticipo then monto else 0 end as de_anticipo,
               case when not anticipo and not de_hoja then monto else 0 end as del_erp,
               case when not anticipo and de_hoja then monto else 0 end as de_la_hoja
        from abonos where fk is null
        union all
        select proveedor_llave,
               least(pagado - cargado, de_anticipo),
               least(pagado - cargado - least(pagado - cargado, de_anticipo), del_erp),
               pagado - cargado - least(pagado - cargado, de_anticipo) - least(pagado - cargado - least(pagado - cargado, de_anticipo), del_erp)
        from por_factura where pagado > cargado) x
  group by x.proveedor_llave
), directo as (
  select c.*,
    least(c.monto, greatest(0, coalesce(f.pagado, 0) - (sum(c.monto) over (partition by c.proveedor_llave, c.fk order by c.vence_el, c.fecha, c.id) - c.monto))) as pagado_directo
  from cargos c left join por_factura f on f.proveedor_llave = c.proveedor_llave and f.fk = c.fk
), paso2 as (
  select d.*, coalesce(l.libre_anticipo, 0) as libre_anticipo,
    coalesce(l.libre_erp, 0) + greatest(0, coalesce(l.libre_hoja, 0)
      - sum(case when d.origen = 'hoja' then d.monto - d.pagado_directo else 0 end) over (partition by d.proveedor_llave)) as libre_final,
    case when d.origen <> 'hoja' then d.monto - d.pagado_directo
         else greatest(0, least(d.monto - d.pagado_directo,
                sum(case when d.origen = 'hoja' then d.monto - d.pagado_directo else 0 end)
                  over (partition by d.proveedor_llave order by d.vence_el, d.fecha, d.id) - coalesce(l.libre_hoja, 0))) end as resto2
  from directo d left join libre l on l.proveedor_llave = d.proveedor_llave
), paso3 as (
  select p.*,
    case when not p.con_anticipo then p.resto2
         else greatest(0, least(p.resto2,
                sum(case when p.con_anticipo then p.resto2 else 0 end)
                  over (partition by p.proveedor_llave order by p.vence_el, p.fecha, p.id) - p.libre_anticipo)) end as resto3
  from paso2 p
), final as (
  select p.*,
    greatest(0, least(p.resto3, sum(p.resto3) over (partition by p.proveedor_llave order by p.vence_el, p.fecha, p.id) - p.libre_final)) as restante
  from paso3 p
)
select f.id, f.proveedor_llave, f.proveedor_id, f.fecha, f.factura, f.descripcion, f.categoria, f.monto, f.vence_el, f.origen,
  f.restante, f.hoja_id,
  case when f.hoja_id is not null and f.restante > 0 then public.tiene_gemela_hoja(f.hoja_id) else false end as posible_repetida,
  f.resto2 - f.resto3 as cubierto_anticipo
from final f;

-- ── La cuenta: por pagar y a favor, aparte ───────────────────────────────────────────────────────
-- Misma vista que en 248, con dos columnas al final. El saldo no cambia: es por_pagar − a_favor.
create or replace view public.v_saldo_arranque_proveedores with (security_invoker = true) as
with libro as (
  select h.proveedor_llave,
    (array_agg(h.proveedor_id) filter (where h.proveedor_id is not null))[1] as proveedor_id,
    max(h.proveedor_nombre) as nombre_hoja,
    sum(h.monto) filter (where h.tipo = 'Adeudo 2021') as adeudo_2021,
    sum(h.monto) filter (where h.tipo = 'Compra') as comprado,
    sum(h.monto) filter (where h.tipo = 'Pago') as pagado,
    sum(h.monto * public.signo_compra_hoja(h.tipo)::numeric) as saldo_hoja,
    max(h.fecha) filter (where h.tipo = 'Compra') as ultima_compra,
    max(h.fecha) filter (where h.tipo = 'Pago') as ultimo_pago,
    count(*) filter (where h.tipo <> 'Adeudo 2021') as movimientos
  from public.historial_compras_hoja h
  where h.id not in (select i.id from public.v_compras_hoja_ignoradas i)
  group by h.proveedor_llave
), erp as (
  select m.proveedor_llave,
    (array_agg(m.proveedor_id))[1] as proveedor_id,
    coalesce(sum(m.monto) filter (where m.tipo = 'compra' and not m.en_hoja), 0) as comprado_erp,
    coalesce(sum(m.monto) filter (where m.tipo = 'pago' and not m.en_hoja), 0) as pagado_erp,
    coalesce(sum(m.monto * public.signo_movimiento_proveedor(m.tipo)::numeric) filter (where not m.en_hoja), 0) as saldo_erp,
    max(m.fecha) filter (where m.tipo = 'compra') as ultima_compra,
    max(m.fecha) filter (where m.tipo = 'pago') as ultimo_pago,
    count(*) as movimientos
  from public.v_movimientos_proveedor m
  group by m.proveedor_llave
)
select coalesce(l.proveedor_llave, e.proveedor_llave) as proveedor_llave,
  coalesce(l.proveedor_id, e.proveedor_id) as proveedor_id,
  coalesce(p.nombre, l.nombre_hoja) as nombre,
  p.categoria,
  coalesce(p.tipo_acreedor, 'proveedor') as tipo_acreedor,
  l.adeudo_2021, l.comprado, l.pagado,
  coalesce(l.saldo_hoja, 0) as saldo_hoja,
  coalesce(e.comprado_erp, 0) as comprado_erp,
  coalesce(e.pagado_erp, 0) as pagado_erp,
  coalesce(l.saldo_hoja, 0) + coalesce(e.saldo_erp, 0) as saldo,
  greatest(l.ultima_compra, e.ultima_compra) as ultima_compra,
  greatest(l.ultimo_pago, e.ultimo_pago) as ultimo_pago,
  coalesce(l.movimientos, 0) + coalesce(e.movimientos, 0) as movimientos,
  coalesce(f.vencido, 0) as vencido,
  f.proximo_vence,
  coalesce(f.por_pagar, 0) as por_pagar,
  greatest(coalesce(f.por_pagar, 0) - (coalesce(l.saldo_hoja, 0) + coalesce(e.saldo_erp, 0)), 0) as a_favor
from libro l
full join erp e on e.proveedor_llave = l.proveedor_llave
left join public.proveedores p on p.id = coalesce(l.proveedor_id, e.proveedor_id)
left join (select c.proveedor_llave,
             sum(c.restante) filter (where c.vence_el < public.hoy_planta()) as vencido,
             min(c.vence_el) filter (where c.vence_el >= public.hoy_planta() and c.restante > 0) as proximo_vence,
             sum(c.restante) as por_pagar
           from public.v_compras_proveedor_pendientes c
           group by c.proveedor_llave) f on f.proveedor_llave = coalesce(l.proveedor_llave, e.proveedor_llave);

-- ── Registrar: guarda el anticipo y compara contra lo que hay por pagar ──────────────────────────
do $$
declare s text; v_ancla text;
begin
  select pg_get_functiondef(p.oid) into s from pg_proc p
  where p.pronamespace = 'public'::regnamespace and p.proname = 'registrar_movimiento_proveedor';
  if position('por_pagar' in s) = 0 then
    v_ancla := 'select saldo into v_saldo from v_saldo_arranque_proveedores where proveedor_llave = v_llave;';
    if position(v_ancla in s) = 0
       or position('cfdi_uuid, metodo_pago, leido_de, claves_sat)' in s) = 0
       or position('returning id into v_id;' in s) = 0 then
      raise exception 'registrar_movimiento_proveedor ya no es la que se conocía: revisa este parche';
    end if;
    -- Con anticipo a favor el saldo es menor que lo que hay por pagar: un pago a una factura a crédito cabe.
    s := replace(s, v_ancla, 'select greatest(saldo, por_pagar) into v_saldo from v_saldo_arranque_proveedores where proveedor_llave = v_llave;');
    s := replace(s, 'cfdi_uuid, metodo_pago, leido_de, claves_sat)', 'cfdi_uuid, metodo_pago, leido_de, claves_sat, anticipo)');
    -- Un pago a una factura (con folio) no es un anticipo, aunque la pantalla lo mande marcado para pagar de contado.
    s := regexp_replace(s, '\)\s+returning id into v_id;',
      ',' || chr(10) || '    p_tipo = ''pago'' and coalesce(p_anticipo, false) and nullif(trim(p_factura), '''') is null)' || chr(10) || '  returning id into v_id;');
    execute s;
  end if;
end $$;

-- Historial de pagos a proveedores, todos juntos.
--
-- Los pagos solo se veían por proveedor (su cuenta, en Pagos a proveedores): no había cómo
-- ver "todo lo que pagamos en octubre", por cuenta o para el contador. Los pagos viven en
-- tres lugares y aquí se juntan:
--   * movimientos_proveedor (tipo 'pago'): los que se registran en el ERP;
--   * historial_compras_hoja (tipo 'Pago'): los del libro de compras desde 2022, menos los
--     que también se registraron en el ERP (misma regla que v_movimientos_proveedor.en_hoja:
--     mismo proveedor, mismo monto y ±7 días), para no contarlos dos veces;
--   * pagos_proveedor: los que se registran desde una orden de compra.
-- Es invoker: cada parte respeta la RLS de su tabla (las dos primeras son de finanzas 2;
-- los pagos de órdenes también los ve compras 2).

create or replace view public.v_pagos_hechos with (security_invoker = true) as
select 'erp:' || m.id::text as id, 'erp'::text as origen, m.fecha, m.proveedor_id, m.proveedor_llave,
  coalesce(p.nombre, m.proveedor_llave) as proveedor, coalesce(p.tipo_acreedor, 'proveedor') as tipo_acreedor,
  m.monto, 'MXN'::text as moneda, m.monto as monto_mxn, m.cuenta, cd.nombre as cuenta_nombre,
  m.factura as referencia, m.descripcion, rp.nombre as registrado_por
from movimientos_proveedor m
left join proveedores p on p.id = m.proveedor_id
left join cuentas_dinero cd on cd.clave = m.cuenta
left join perfiles rp on rp.id = m.registrado_por
where m.tipo = 'pago'
union all
select 'hoja:' || h.id::text, 'hoja', h.fecha, h.proveedor_id, h.proveedor_llave,
  coalesce(p.nombre, h.proveedor_nombre), coalesce(p.tipo_acreedor, 'proveedor'),
  h.monto, 'MXN', h.monto, cd.clave, coalesce(cd.nombre, h.cuenta),
  coalesce(h.factura, h.orden), h.descripcion, null
from historial_compras_hoja h
left join proveedores p on p.id = h.proveedor_id
left join cuentas_dinero cd on cd.hoja = h.cuenta
where h.tipo = 'Pago'
  and not exists (select 1 from movimientos_proveedor m
                  where m.tipo = 'pago' and m.proveedor_llave = h.proveedor_llave
                    and abs(m.monto - h.monto) < 0.01 and m.fecha between h.fecha - 7 and h.fecha + 7)
union all
select 'oc:' || pp.id::text, 'orden', pp.fecha, oc.proveedor_id, null,
  p.nombre, coalesce(p.tipo_acreedor, 'proveedor'),
  pp.monto, oc.moneda::text, round(pp.monto * case when oc.moneda::text = 'MXN' then 1 else coalesce(oc.tipo_cambio, 1) end, 2),
  null, initcap(pp.metodo), oc.folio || coalesce(' · ' || pp.referencia, ''), null, rp.nombre
from pagos_proveedor pp
join ordenes_compra oc on oc.id = pp.orden_compra_id
left join proveedores p on p.id = oc.proveedor_id
left join perfiles rp on rp.id = pp.registrado_por;

grant select on public.v_pagos_hechos to authenticated;

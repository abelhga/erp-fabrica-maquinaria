-- Historial de pagos: cuándo se capturó cada pago.
--
-- Qué se rompía: el historial va por la fecha del pago. Quien captura hoy un pago de
-- septiembre lo busca en «Este mes» y no lo encuentra (pasó con tres pagos de Susana el 20
-- de octubre). Se agrega registrado_en para el filtro «Recién capturados» de la pantalla.
-- La hoja no dice cuándo se capturó: queda vacío.

create or replace view public.v_pagos_hechos with (security_invoker = true) as
select 'erp:' || m.id::text as id, 'erp'::text as origen, m.fecha, m.proveedor_id, m.proveedor_llave,
  coalesce(p.nombre, m.proveedor_llave) as proveedor, coalesce(p.tipo_acreedor, 'proveedor') as tipo_acreedor,
  m.monto, 'MXN'::text as moneda, m.monto as monto_mxn, m.cuenta, cd.nombre as cuenta_nombre,
  m.factura as referencia, m.descripcion, rp.nombre as registrado_por, m.creado_en as registrado_en
from movimientos_proveedor m
left join proveedores p on p.id = m.proveedor_id
left join cuentas_dinero cd on cd.clave = m.cuenta
left join perfiles rp on rp.id = m.registrado_por
where m.tipo = 'pago'
union all
select 'hoja:' || h.id::text, 'hoja', h.fecha, h.proveedor_id, h.proveedor_llave,
  coalesce(p.nombre, h.proveedor_nombre), coalesce(p.tipo_acreedor, 'proveedor'),
  h.monto, 'MXN', h.monto, cd.clave, coalesce(cd.nombre, h.cuenta),
  coalesce(h.factura, h.orden), h.descripcion, null, null::timestamptz
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
  null, initcap(pp.metodo), oc.folio || coalesce(' · ' || pp.referencia, ''), null, rp.nombre, pp.creado_en
from pagos_proveedor pp
join ordenes_compra oc on oc.id = pp.orden_compra_id
left join proveedores p on p.id = oc.proveedor_id
left join perfiles rp on rp.id = pp.registrado_por;

grant select on public.v_pagos_hechos to authenticated;

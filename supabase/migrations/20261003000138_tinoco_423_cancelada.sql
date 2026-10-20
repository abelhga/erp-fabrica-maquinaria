-- La factura cancelada de Jessica Tinoco Esparza es la 423, no la 419 (en la 137 se marcó la
-- 419 por un error al dictarlo). La 419 vuelve a contar: se pagó el 27 de enero junto con la
-- 415 y la 416. La 423 ($1,218.90) deja de contar.
delete from public.compras_hoja_repetidas
where proveedor_llave = 'jessica tinoco esparza' and tipo = 'Compra' and factura = '419' and razon = 'cancelada';

insert into public.compras_hoja_repetidas (proveedor_llave, fecha, monto, factura, motivo, tipo, razon)
select h.proveedor_llave, h.fecha, h.monto, h.factura, 'La factura 423 se canceló', 'Compra', 'cancelada'
from public.historial_compras_hoja h
where h.proveedor_llave = 'jessica tinoco esparza' and h.tipo = 'Compra' and h.factura = '423' and h.monto = 1218.90
  and not exists (select 1 from public.compras_hoja_repetidas r where r.proveedor_llave = h.proveedor_llave and r.tipo = 'Compra'
                    and r.fecha = h.fecha and r.monto = h.monto and coalesce(r.factura, '') = coalesce(h.factura, ''));

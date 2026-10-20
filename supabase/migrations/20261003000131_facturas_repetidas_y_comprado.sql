-- =============================================================================
-- Facturas de proveedor repetidas, y "Comprado en 12 meses" con facturas.
--
-- 1. Qué se rompía: Susana registró la factura 2000018286690302 de Doris Navarrete dos
--    veces (16 y 19 de octubre, cada una de contado: compra y pago). El saldo quedó en
--    cero, pero el historial de pagos sumó $5,399.10 que no salieron y las compras de
--    septiembre se inflaron. Solo se revisaba el folio fiscal del XML; a mano pasaba todo.
--    Ahora una compra con el mismo folio del mismo proveedor (en el ERP o en la hoja, en
--    los últimos dos años por si alguien reinicia su numeración) se rechaza con la fecha y
--    quién la capturó. Sin folio ("S/F") no hay con qué comparar: la pantalla avisa si hay
--    una compra del mismo monto a una semana (compras_parecidas), sin bloquear.
-- 2. Se borra el registro del 16 (compra y pago) y se deja el del 19, que trae descripción.
-- 3. "Comprado en 12 meses" sumaba solo órdenes de compra: hay una en total y 2,086
--    compras de la hoja en el último año, así que decía $0 para casi todos. Los ERP miden lo
--    comprado por facturas; aquí una orden de compra se paga desde la orden sin factura
--    aparte, así que se suman las dos sin duplicar.
-- =============================================================================

create or replace function public.trg_factura_repetida() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_llave text := llave_factura(new.factura); r record;
begin
  if new.tipo <> 'compra' or v_llave is null or v_llave in ('SF', 'SN', 'NA') then return new; end if;
  select m.fecha, m.creado_en, p.nombre as quien into r
  from movimientos_proveedor m left join perfiles p on p.id = m.registrado_por
  where m.tipo = 'compra' and llave_factura(m.factura) = v_llave
    and (m.proveedor_llave = new.proveedor_llave or m.proveedor_id = new.proveedor_id)
    and m.fecha >= new.fecha - 730
  order by m.creado_en limit 1;
  if found then
    raise exception 'La factura % ya está registrada: compra del %, capturada el %.', new.factura,
      to_char(r.fecha, 'DD/MM/YYYY'),
      to_char(r.creado_en at time zone 'America/Mexico_City', 'DD/MM/YYYY') || coalesce(' por ' || r.quien, '') using errcode = '23505';
  end if;
  select h.fecha into r from historial_compras_hoja h
  where h.tipo = 'Compra' and h.proveedor_llave = new.proveedor_llave and llave_factura(h.factura) = v_llave
    and h.fecha >= new.fecha - 730
    and h.id not in (select i.id from v_compras_hoja_ignoradas i)
  order by h.fecha limit 1;
  if found then
    raise exception 'La factura % ya está en la hoja (compra del %): no hace falta registrarla otra vez.', new.factura,
      to_char(r.fecha, 'DD/MM/YYYY') using errcode = '23505';
  end if;
  return new;
end $$;
create trigger factura_repetida before insert on public.movimientos_proveedor for each row execute function public.trg_factura_repetida();

-- Compras del mismo proveedor, mismo monto y a una semana, con otro folio o sin folio: el
-- formulario las enseña para que quien captura confirme que es otra compra.
create or replace function public.compras_parecidas(p_proveedor uuid, p_monto numeric, p_fecha date, p_factura text default null)
returns table (origen text, fecha date, monto numeric, factura text, descripcion text)
language sql stable security invoker as $$
  with llave as (
    select coalesce((select proveedor_llave from historial_compras_hoja where proveedor_id = p_proveedor order by fecha desc limit 1),
                    (select proveedor_llave from movimientos_proveedor where proveedor_id = p_proveedor limit 1)) as l
  )
  select 'erp', m.fecha, m.monto, m.factura, m.descripcion from movimientos_proveedor m, llave
  where m.tipo = 'compra' and (m.proveedor_id = p_proveedor or m.proveedor_llave = llave.l)
    and abs(m.monto - p_monto) < 0.01 and abs(m.fecha - p_fecha) <= 7
    and llave_factura(m.factura) is distinct from llave_factura(p_factura)
  union all
  select 'hoja', h.fecha, h.monto, h.factura, h.descripcion from historial_compras_hoja h, llave
  where h.tipo = 'Compra' and h.proveedor_llave = llave.l
    and abs(h.monto - p_monto) < 0.01 and abs(h.fecha - p_fecha) <= 7
    and llave_factura(h.factura) is distinct from llave_factura(p_factura)
    and h.id not in (select i.id from v_compras_hoja_ignoradas i)
  order by 2 desc
  limit 5
$$;

-- Lo comprado a cada proveedor en 12 meses: facturas (hoja y ERP, sin repetidas) más órdenes
-- de compra no canceladas, sin socios ni bancos. Definer: compras no lee las facturas de
-- finanzas pero sí debe ver el total; quien no ve dinero de compras no recibe nada.
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
      and (p_proveedor is null or o.proveedor_id = p_proveedor)
  )
  -- Préstamos de socios y créditos de banco no son compras.
  select t.proveedor_id, round(sum(t.monto), 2), max(t.fecha) from todo t
  join proveedores p on p.id = t.proveedor_id and coalesce(p.tipo_acreedor, 'proveedor') = 'proveedor'
  group by t.proveedor_id;
end $$;

-- El duplicado de Doris Navarrete: se queda el registro del 19 de octubre.
delete from public.movimientos_proveedor
where (id = '75447c1b-76fa-4ee7-9212-820e4f453ed0' and tipo = 'compra')
   or (id = '95289553-bf46-4fe9-bdf1-8f31e84cba67' and tipo = 'pago');

-- =============================================================================
-- Socios y bancos aparte de los proveedores, y pagar en el ERP lo que se debe
-- según la hoja.
--
-- 1. tipo_acreedor en proveedores. El libro de compras mezcla proveedores con el
--    préstamo de un socio ($2.6 M) y el capital de un crédito: "por pagar a
--    proveedores" salía en $4.9 M cuando a proveedores se les deben $2.3 M. Los
--    saldos siguen en el libro; solo se cuentan aparte.
--
-- 2. pagos_saldo_hoja. Hasta hoy solo se podía pagar contra una orden de compra:
--    para abonarle a Grupo Aduanal lo que viene de la hoja, finanzas tenía que
--    volver a la hoja. Ahora el pago se registra aquí y el saldo baja en el ERP.
--    Mientras la hoja siga viva, el mismo pago puede anotarse en los dos lados y
--    el importador lo vuelve a traer: un pago del ERP con el mismo monto que un
--    "Pago" de la hoja al mismo proveedor (±7 días) no se descuenta otra vez. Se
--    ve marcado "también en la hoja" para que nadie se pregunte.
-- =============================================================================

alter table public.proveedores add column if not exists tipo_acreedor text not null default 'proveedor'
  check (tipo_acreedor in ('proveedor', 'socio', 'financiamiento'));
comment on column public.proveedores.tipo_acreedor is
  'proveedor: surte material o servicios. socio: préstamos de los dueños. financiamiento: créditos de banco. Los dos últimos no cuentan en "por pagar a proveedores".';

create table public.pagos_saldo_hoja (
  id uuid primary key default gen_random_uuid(),
  proveedor_llave text not null,                 -- la llave del libro de la hoja (historial_compras_hoja)
  proveedor_id uuid references public.proveedores(id) on delete set null,
  fecha date not null default hoy_planta(),
  monto numeric(14,2) not null check (monto > 0),
  metodo text not null default 'transferencia',
  referencia text,
  registrado_por uuid default auth.uid() references public.perfiles(id),
  creado_en timestamptz not null default now()
);
create index pagos_saldo_hoja_llave on public.pagos_saldo_hoja (proveedor_llave, fecha);
alter table public.pagos_saldo_hoja enable row level security;
-- Lo mismo que el libro: solo quien lleva finanzas. Se escribe por pagar_saldo_hoja()
-- (revisa el saldo); borrar un pago mal capturado sí se puede, y queda en la bitácora.
create policy ver on public.pagos_saldo_hoja for select to authenticated using ((select puede('finanzas', 2)));
create policy borrar on public.pagos_saldo_hoja for delete to authenticated using ((select puede('finanzas', 2)));
create trigger auditar after insert or update or delete on public.pagos_saldo_hoja for each row execute function public.auditar();

-- Cada pago del ERP y si la hoja ya lo trae (entonces no se descuenta dos veces).
create or replace view public.v_pagos_saldo_hoja with (security_invoker = true) as
select p.*,
  exists (select 1 from public.historial_compras_hoja h
          where h.proveedor_llave = p.proveedor_llave and h.tipo = 'Pago'
            and abs(h.monto - p.monto) < 0.01 and h.fecha between p.fecha - 7 and p.fecha + 7) as en_hoja
from public.pagos_saldo_hoja p;

-- Saldo por proveedor: lo de la hoja menos lo pagado en el ERP (que la hoja no traiga ya).
drop view if exists public.v_saldo_arranque_proveedores;
create view public.v_saldo_arranque_proveedores with (security_invoker = true) as
with libro as (
  select h.proveedor_llave,
    (array_agg(h.proveedor_id) filter (where h.proveedor_id is not null))[1] as proveedor_id,
    max(h.proveedor_nombre) as nombre_hoja,
    sum(h.monto) filter (where h.tipo = 'Adeudo 2021') as adeudo_2021,
    sum(h.monto) filter (where h.tipo = 'Compra') as comprado,
    sum(h.monto) filter (where h.tipo = 'Pago') as pagado,
    sum(h.monto * signo_compra_hoja(h.tipo)) as saldo_hoja,
    max(h.fecha) filter (where h.tipo = 'Compra') as ultima_compra,
    max(h.fecha) filter (where h.tipo = 'Pago') as ultimo_pago_hoja,
    count(*) filter (where h.tipo <> 'Adeudo 2021') as movimientos
  from public.historial_compras_hoja h
  group by h.proveedor_llave
),
erp as (
  select proveedor_llave, sum(monto) filter (where not en_hoja) as pagado_erp, max(fecha) as ultimo_pago_erp
  from public.v_pagos_saldo_hoja group by proveedor_llave
)
select l.proveedor_llave, l.proveedor_id,
  coalesce(p.nombre, l.nombre_hoja) as nombre,
  p.categoria,
  coalesce(p.tipo_acreedor, 'proveedor') as tipo_acreedor,
  l.adeudo_2021, l.comprado, l.pagado,
  l.saldo_hoja,
  coalesce(e.pagado_erp, 0) as pagado_erp,
  l.saldo_hoja - coalesce(e.pagado_erp, 0) as saldo,
  l.ultima_compra,
  greatest(l.ultimo_pago_hoja, e.ultimo_pago_erp) as ultimo_pago,
  l.movimientos
from libro l
left join public.proveedores p on p.id = l.proveedor_id
left join erp e on e.proveedor_llave = l.proveedor_llave;

-- Registrar un pago a un saldo de la hoja. No deja pagar de más: un error de dedo
-- de un cero más dejaba el saldo negativo y parecía anticipo.
create or replace function public.pagar_saldo_hoja(p_llave text, p_monto numeric, p_fecha date default null,
  p_metodo text default 'transferencia', p_referencia text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_saldo numeric; v_prov uuid; v_id uuid;
begin
  if not puede('finanzas', 2) then
    raise exception 'Solo finanzas registra pagos a proveedores' using errcode = '42501';
  end if;
  if coalesce(p_monto, 0) <= 0 then raise exception 'El monto tiene que ser mayor a cero' using errcode = '22023'; end if;
  if p_fecha > hoy_planta() then raise exception 'La fecha del pago no puede ser futura' using errcode = '22023'; end if;
  -- Dos personas pagando al mismo proveedor a la vez podían pasarse del saldo.
  perform pg_advisory_xact_lock(hashtext('pagar_saldo_hoja:' || p_llave));
  select saldo, proveedor_id into v_saldo, v_prov from v_saldo_arranque_proveedores where proveedor_llave = p_llave;
  if not found then raise exception 'Ese proveedor no tiene saldo en la hoja' using errcode = '22023'; end if;
  if p_monto > v_saldo + 0.5 then
    raise exception 'El pago (%) es mayor que el saldo (%)', to_char(p_monto, 'FM$999,999,990.00'), to_char(v_saldo, 'FM$999,999,990.00')
      using errcode = '22023';
  end if;
  insert into pagos_saldo_hoja (proveedor_llave, proveedor_id, fecha, monto, metodo, referencia)
  values (p_llave, v_prov, coalesce(p_fecha, hoy_planta()), round(p_monto, 2), coalesce(nullif(p_metodo, ''), 'transferencia'), nullif(trim(p_referencia), ''))
  returning id into v_id;
  return v_id;
end $$;
revoke execute on function public.pagar_saldo_hoja(text, numeric, date, text, text) from public, anon;
grant execute on function public.pagar_saldo_hoja(text, numeric, date, text, text) to authenticated;

-- Hallazgo: solo proveedores (el préstamo de un socio no es "deuda con proveedores").
create or replace function public.hallazgos_compras_hoja(p_area text default 'direccion')
returns table (area text, tono text, titulo text, detalle text, ruta text, peso int)
language plpgsql stable security invoker as $$
declare v_debe numeric; v_favor numeric; v_n int; v_mayor text;
begin
  if not puede('finanzas', 2) then return; end if;
  select coalesce(sum(saldo) filter (where saldo > 1), 0), coalesce(-sum(saldo) filter (where saldo < -1), 0), count(*) filter (where saldo > 1)
  into v_debe, v_favor, v_n from v_saldo_arranque_proveedores where tipo_acreedor = 'proveedor';
  if v_debe <= 0 then return; end if;
  select nombre into v_mayor from v_saldo_arranque_proveedores where saldo > 1 and tipo_acreedor = 'proveedor' order by saldo desc limit 1;
  return query select 'finanzas'::text, 'info'::text,
    format('%s por pagar a %s proveedores según la hoja', texto_dinero(v_debe), v_n),
    format('Saldos del libro de compras de la hoja (el mayor: %s)%s. Los pagos se registran en Pagos → Saldos de la hoja; préstamos de socios y créditos van aparte.',
           v_mayor, case when v_favor > 0 then format('; además hay %s a nuestro favor en anticipos y reembolsos', texto_dinero(v_favor)) else '' end),
    '/finanzas/pagos'::text, 72;
end $$;

-- Tablero: por pagar de la hoja solo con proveedores; socios y créditos en su renglón.
create or replace function public.tablero_direccion() returns jsonb
language plpgsql stable security invoker as $$
declare
  r jsonb := '{}'::jsonb;
  v_hoy date := (now() at time zone 'America/Mexico_City')::date;
  v_mes date := date_trunc('month', v_hoy);
  v_anio date := date_trunc('year', v_hoy);
  v_dia_anio int := v_hoy - date_trunc('year', v_hoy)::date + 1;
begin
  if puede('ventas', 3) or puede('finanzas', 1) then
    r := r || jsonb_build_object('ventas', (
      -- Todo contra el mismo tramo del año pasado: comparar el mes en curso (3 días)
      -- contra el mes completo del año pasado siempre sale en rojo.
      with c as (select ventas_entre(v_anio, v_hoy) anio,
                        ventas_entre((v_anio - interval '1 year')::date, (v_hoy - interval '1 year')::date) misma_fecha,
                        ventas_entre((v_anio - interval '1 year')::date, (v_anio - interval '1 day')::date) anterior_total)
      select jsonb_build_object(
        'mes', ventas_entre(v_mes, v_hoy),
        'mes_anio_anterior', ventas_entre((v_mes - interval '1 year')::date, (v_hoy - interval '1 year')::date),
        'anio', c.anio,
        'anio_anterior_misma_fecha', c.misma_fecha,
        'anio_anterior_total', c.anterior_total,
        -- "A este ritmo" con la estacionalidad del año pasado: si vamos 22 % arriba a
        -- la misma fecha, cerramos 22 % arriba de lo que cerró. La lineal (× 365 / día)
        -- subestima cuando el último trimestre es fuerte, como en 2025.
        'proyeccion_anio', round(case when c.misma_fecha > 0 and c.anterior_total > 0
                                      then c.anterior_total * c.anio / c.misma_fecha
                                      else c.anio * 365.0 / v_dia_anio end),
        'serie_12', (select jsonb_agg(jsonb_build_object('mes', x.mes, 'monto', x.monto) order by x.mes)
                     from ventas_historicas_mes((v_mes - interval '11 months')::date) x)
      ) from c),
      'top_clientes', (
        select coalesce(jsonb_agg(t order by t.monto desc), '[]') from (
          select c.id, c.nombre, round(sum(x.monto)) monto from (
            select h.cliente_id, h.monto from historial_ventas_hoja h where h.tipo = 'Venta' and h.fecha >= v_anio
            union all
            select p.cliente_id, p.total * p.tipo_cambio from pedidos p where not p.historico and p.estado <> 'cancelado' and p.fecha >= v_anio
              and p.fecha >= coalesce((select (valor #>> '{}')::date from configuracion where clave = 'fecha_arranque'), current_date)
          ) x join clientes c on c.id = x.cliente_id group by c.id, c.nombre order by sum(x.monto) desc limit 8) t));
  end if;

  if puede('ventas', 3) then
    r := r || jsonb_build_object('embudo', (
      select coalesce(jsonb_agg(jsonb_build_object('etapa', e.etapa, 'n', coalesce(o.n, 0), 'monto', coalesce(o.monto, 0)) order by e.ord), '[]')
      from (values ('prospecto', 1), ('contactado', 2), ('cotizado', 3), ('negociacion', 4)) e(etapa, ord)
      left join (select etapa::text, count(*) n, sum(monto_estimado) monto from oportunidades where etapa not in ('ganada', 'perdida') group by etapa) o
        on o.etapa = e.etapa),
      'cotizaciones', (
        select jsonb_build_object(
          'abiertas', count(*) filter (where estado in ('enviada', 'autorizada') and fecha + vigencia_dias >= v_hoy),
          'monto_abierto', coalesce(sum(total * tipo_cambio) filter (where estado in ('enviada', 'autorizada') and fecha + vigencia_dias >= v_hoy), 0),
          'por_autorizar', count(*) filter (where estado = 'por_autorizar'),
          'cierre_90d', round(count(*) filter (where estado = 'aceptada' and fecha >= v_hoy - 90)::numeric
                         / nullif(count(*) filter (where estado in ('aceptada', 'rechazada', 'vencida') and fecha >= v_hoy - 90), 0), 3),
          'del_mes', count(*) filter (where fecha >= v_mes))
        from cotizaciones),
      'vendedores', (
        select coalesce(jsonb_agg(jsonb_build_object('nombre', c.vendedor, 'maquinaria', c.venta_maquinaria + c.venta_otros,
          'refacciones', c.venta_refacciones, 'siguiente_meta', c.siguiente_meta, 'comision', c.total) order by c.venta_maquinaria + c.venta_otros desc), '[]')
        from comisiones_mes(v_mes) c),
      'canales', (
        select coalesce(jsonb_agg(jsonb_build_object('canal', canal, 'monto', monto) order by monto desc), '[]') from (
          select p.canal::text canal, round(sum(p.subtotal * p.tipo_cambio)) monto from pedidos p
          where p.estado <> 'cancelado' and p.fecha >= v_anio group by 1) x));
  end if;

  if puede('produccion', 1) then
    r := r || jsonb_build_object('produccion', (
      select jsonb_build_object(
        'abiertas', count(*), 'atrasadas', count(*) filter (where atrasada), 'en_proceso', count(*) filter (where estado = 'en_proceso'),
        'con_faltantes', count(*) filter (where materiales_faltantes > 0),
        'a_tiempo_90d', (select round(count(*) filter (where terminada_en::date <= fecha_compromiso)::numeric / nullif(count(*), 0), 3)
                         from ordenes_produccion where terminada_en >= v_hoy - 90 and fecha_compromiso is not null),
        'terminadas_mes', (select count(*) from ordenes_produccion where terminada_en >= v_mes),
        'carga', (select coalesce(jsonb_agg(jsonb_build_object('etapa', nombre, 'color', color, 'horas', horas_pendientes,
                    'semanas', round(horas_pendientes / nullif(capacidad_horas_semana, 0), 1)) order by orden), '[]') from v_carga_etapas))
      from v_tablero_produccion));
  end if;

  if puede('inventario', 1) and puede('costos', 1) then
    r := r || jsonb_build_object('inventario', (
      with re as (select * from reabasto())
      select jsonb_build_object(
        'valor', (select round(sum(e.cantidad * cc.costo_total)) from existencias e join costos_calculados cc using (articulo_id) where e.cantidad > 0),
        'por_almacen', (select coalesce(jsonb_agg(jsonb_build_object('almacen', a.nombre, 'valor', x.v) order by x.v desc), '[]') from (
            select e.almacen_id, round(sum(e.cantidad * cc.costo_total)) v from existencias e join costos_calculados cc using (articulo_id)
            where e.cantidad > 0 group by 1) x join almacenes a on a.id = x.almacen_id),
        'excedentes_valor', (select round(sum(re.en_planta * cc.costo_total)) from re join costos_calculados cc on cc.articulo_id = re.articulo_id where re.estado = 'excedente'),
        'excedentes_n', (select count(*) from re where estado = 'excedente'),
        'a_ordenar_n', (select count(*) from re where estado = 'ordenar'),
        'inversion_sugerida', (select round(sum(re.sugerido * cc.costo_total)) from re join costos_calculados cc on cc.articulo_id = re.articulo_id where re.estado = 'ordenar'),
        'importados_en_riesgo_n', (select count(*) from re where es_importado and estado = 'ordenar'),
        'importados_en_riesgo', (select coalesce(jsonb_agg(jsonb_build_object('id', articulo_id, 'nombre', nombre, 'disponible', disponible,
                                   'reorden', punto_reorden, 'dias', dias_entrega) order by disponible - punto_reorden), '[]')
                                 from (select * from re where es_importado and estado = 'ordenar' order by disponible - punto_reorden limit 6) i),
        'ajustes_pendientes', (select count(*) from ajustes_inventario where estado = 'pendiente'))));
  end if;

  if puede('costos', 1) then
    r := r || jsonb_build_object('costos_al_alza', (
      select coalesce(jsonb_agg(t order by t.cambio desc), '[]') from (
        select a.id, a.nombre, h.costo_anterior, h.costo_nuevo, round(h.costo_nuevo / nullif(h.costo_anterior, 0) - 1, 4) cambio, h.en,
          (select count(*) from donde_se_usa(a.id)) equipos
        from historial_costos h join articulos a on a.id = h.articulo_id
        where h.en >= v_hoy - 30 and h.costo_anterior > 0 and h.costo_nuevo > h.costo_anterior * 1.03
        order by h.costo_nuevo / h.costo_anterior desc limit 6) t),
      'equipos_que_subieron', (
        select coalesce(jsonb_agg(t order by t.cambio desc), '[]') from (
          select a.id, a.clave, a.nombre, u.precio_lista precio, round(u.precio_lista / nullif(p.precio_lista, 0) - 1, 4) cambio
          from articulos a
          join lateral (select precio_lista from historial_costeo where articulo_id = a.id and precio_lista is not null order by en desc limit 1) u on true
          join lateral (select precio_lista from historial_costeo where articulo_id = a.id and precio_lista is not null and en < v_hoy - 30 order by en desc limit 1) p on true
          where a.tipo = 'equipo' and u.precio_lista <> p.precio_lista
          order by abs(u.precio_lista / nullif(p.precio_lista, 0) - 1) desc limit 6) t));
  end if;

  if puede('finanzas', 1) then
    r := r || jsonb_build_object('cobranza', (
      select jsonb_build_object(
        'erp', (select coalesce(sum(saldo), 0) from v_saldos_pedido where saldo > 0),
        'arranque', (select coalesce(sum(saldo), 0) from v_saldo_arranque_clientes where saldo > 1),
        'antiguedad', (select jsonb_build_object(
            'd0_30', coalesce(sum(saldo) filter (where v_hoy - fecha <= 30), 0),
            'd31_60', coalesce(sum(saldo) filter (where v_hoy - fecha between 31 and 60), 0),
            'd61_90', coalesce(sum(saldo) filter (where v_hoy - fecha between 61 and 90), 0),
            'd90', coalesce(sum(saldo) filter (where v_hoy - fecha > 90), 0))
          from v_saldos_pedido where saldo > 0),
        'cobrado_mes', (select coalesce(sum(monto), 0) from cobros where fecha >= v_mes)
          + (select coalesce(sum(monto), 0) from historial_ventas_hoja where tipo = 'Pago' and fecha >= v_mes))),
      'por_pagar', (select jsonb_build_object(
          'total', coalesce(sum(saldo * case when moneda = 'MXN' then 1 else tc(moneda) end), 0),
          'vencido', coalesce(sum(saldo * case when moneda = 'MXN' then 1 else tc(moneda) end) filter (where vence_pago < v_hoy), 0),
          -- Lo que la hoja dice que debemos (solo saldos a cargo) y lo que nos deben los
          -- proveedores (anticipos y reembolsos): no se netean, son cosas distintas.
          'arranque', (select coalesce(sum(saldo), 0) from v_saldo_arranque_proveedores where saldo > 1 and tipo_acreedor = 'proveedor'),
          'arranque_a_favor', (select coalesce(-sum(saldo), 0) from v_saldo_arranque_proveedores where saldo < -1 and tipo_acreedor = 'proveedor'),
          -- Préstamos de socios y créditos de banco: deuda, pero no con proveedores.
          'socios', (select coalesce(sum(saldo), 0) from v_saldo_arranque_proveedores where saldo > 1 and tipo_acreedor = 'socio'),
          'financiamiento', (select coalesce(sum(saldo), 0) from v_saldo_arranque_proveedores where saldo > 1 and tipo_acreedor = 'financiamiento'))
        from v_cuentas_por_pagar where saldo > 0));
  end if;

  return r || jsonb_build_object('generado', now());
end $$;

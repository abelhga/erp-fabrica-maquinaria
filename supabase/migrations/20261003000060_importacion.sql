-- =============================================================================
-- Lo que necesita la migración desde las hojas.
--
-- El ERP no arranca en cero: trae catálogo, listas de materiales, costos con su
-- historia desde 2019, existencias por almacén, clientes y las ventas que los
-- vendedores registraron en sus paneles. Dos cosas no caben en las tablas
-- normales sin falsear algo, y por eso tienen lugar propio:
--  * Los movimientos de inventario de la hoja (32 mil, desde abril de 2024) no
--    pueden entrar como movimientos del ERP: la existencia de arranque ya los
--    incluye y se contarían dos veces. Van a un archivo de solo lectura, que el
--    reabasto usa como consumo histórico (si no, el stock mínimo automático
--    arrancaría en cero y dejaría de funcionar justo el día del cambio).
--  * Las ventas de los paneles no dicen si se cobraron. Entran como pedidos
--    "históricos": cuentan para el historial del cliente, las comisiones y los
--    tableros, pero no aparecen como cuentas por cobrar.
-- =============================================================================

create table public.historial_movimientos_hoja (
  id bigserial primary key,
  fecha timestamptz not null,
  articulo_id uuid references public.articulos(id) on delete set null,
  nombre_original text not null,
  cantidad numeric(14,3) not null,      -- como venía (positiva); el signo lo da el tipo
  tipo text not null,                   -- SALIDA, ENTRADA, AJUSTE SALIDA, AJUSTE ENTRADA…
  almacen text,
  personal text,
  motivo text,
  documento text,
  proveedor text,
  notas text,
  merma boolean not null default false,
  fila_origen int
);
create index hist_mov_articulo on public.historial_movimientos_hoja (articulo_id, fecha);
create index hist_mov_fecha on public.historial_movimientos_hoja (fecha);

create table public.importaciones (
  id bigserial primary key,
  fuente text not null,
  en timestamptz not null default now(),
  resumen jsonb not null,
  usuario text default current_user
);

alter table public.pedidos add column historico boolean not null default false;

create or replace view public.v_saldos_pedido with (security_invoker = true) as
select p.id pedido_id, p.folio, p.cliente_id, p.vendedor_id, p.fecha, p.estado, p.moneda, p.total,
  coalesce((select sum(monto) from public.cobros c where c.pedido_id = p.id), 0) as cobrado,
  p.total - coalesce((select sum(monto) from public.cobros c where c.pedido_id = p.id), 0) as saldo,
  exists (select 1 from public.facturas f where f.pedido_id = p.id) as facturado
from public.pedidos p where p.estado <> 'cancelado' and not p.historico;

-- Reabasto: el consumo sale de los movimientos del ERP y, para los meses
-- anteriores al arranque, del archivo de la hoja (solo SALIDA, igual que la
-- fórmula de Demanda, que no cuenta los AJUSTE SALIDA).
create or replace function public.reabasto(p_al date default null)
returns table (
  articulo_id uuid, clave text, nombre text, unidad text, es_importado boolean, proveedor text,
  consumo_meses numeric[], meses_con_consumo int, demanda_mensual numeric, dias_entrega int, meses_cobertura numeric,
  stock_seguridad numeric, punto_reorden numeric, lote numeric, en_planta numeric, reservado numeric, en_transito numeric,
  disponible numeric, sugerido numeric, estado text
)
language sql stable security invoker as $$
  with cfg as (select valor c from configuracion where clave = 'reabasto'),
  hoy as (select date_trunc('month', coalesce(p_al, current_date))::date mes),
  salidas as (
    select m.articulo_id, m.en, -m.cantidad cantidad from movimientos_inventario m
    where m.tipo in ('salida_produccion', 'salida_venta', 'salida_consumo')
    union all
    select h.articulo_id, h.fecha, h.cantidad from historial_movimientos_hoja h
    where h.tipo = 'SALIDA' and h.articulo_id is not null
  ),
  consumo as (
    select s.articulo_id,
      ((extract(year from hoy.mes) - extract(year from s.en)) * 12 + extract(month from hoy.mes) - extract(month from s.en))::int g,
      sum(s.cantidad) total
    from salidas s, hoy
    where s.en >= hoy.mes - interval '12 months' and s.en < hoy.mes
    group by 1, 2
  ),
  base as (
    select a.id, a.clave, a.nombre, a.unidad, a.es_importado, p.nombre proveedor, a.empaque, a.stock_minimo_fijo,
      (select array_agg(coalesce(c.total, 0) order by g.g desc) from generate_series(1, 12) g(g)
         left join consumo c on c.articulo_id = a.id and c.g = g.g) as consumo_meses,
      coalesce(a.tiempo_entrega_dias, p.dias_entrega, ((select c from cfg)->>'dias_entrega_default')::int) dias,
      coalesce(a.meses_cobertura, case when a.es_importado then ((select c from cfg)->>'meses_cobertura_importado')::numeric
                                       else ((select c from cfg)->>'meses_cobertura_nacional')::numeric end) cobertura
    from articulos a left join proveedores p on p.id = a.proveedor_id
    where a.activo and a.controla_inventario and a.tipo in ('componente', 'materia_prima')
  ),
  calc as (
    select b.*, x.en_planta, x.reservado, x.en_transito, (select c from cfg) c,
      (select count(*) from unnest(b.consumo_meses[7:12]) v where v > 0)::int con_consumo
    from base b join v_existencias x on x.articulo_id = b.id
  ),
  demanda as (
    select calc.*,
      case
        when con_consumo >= (c->>'meses_con_consumo')::int then
          case when c->>'promedio' = 'todos' then (select avg(v) from unnest(consumo_meses[7:12]) v)
               else (select avg(v) from unnest(consumo_meses[7:12]) v where v > 0) end
        when es_importado and (select sum(v) from unnest(consumo_meses) v) > 0 then (select sum(v) from unnest(consumo_meses) v) / 12.0
        else 0 end as dm
    from calc
  ),
  final as (
    select d.*,
      ceil(d.dm / (c->>'dias_habiles_mes')::numeric * d.dias + coalesce(d.stock_minimo_fijo, 0)) as pr,
      ceil(d.dm * d.cobertura) as lt,
      d.en_planta - d.reservado + d.en_transito as disp
    from demanda d
  )
  select f.id, f.clave, f.nombre, f.unidad, f.es_importado, f.proveedor, f.consumo_meses, f.con_consumo,
    round(f.dm, 2), f.dias, f.cobertura, f.stock_minimo_fijo, f.pr, f.lt, f.en_planta, f.reservado, f.en_transito, f.disp,
    case when f.disp < f.pr then ceil((f.lt + f.pr - f.disp) / f.empaque) * f.empaque else 0 end,
    case when f.en_planta < 0 then 'negativo'
         when f.disp < f.pr then 'ordenar'
         when (select sum(v) from unnest(f.consumo_meses) v) = 0 and f.en_planta > 0 and f.stock_minimo_fijo is null then 'excedente'
         else 'ok' end
  from final f
$$;

alter table public.historial_movimientos_hoja enable row level security;
alter table public.importaciones enable row level security;
create policy ver on public.historial_movimientos_hoja for select to authenticated using (puede('inventario', 2) or puede('costos', 1));
create policy ver on public.importaciones for select to authenticated using (puede('admin', 1));

-- El directorio de proveedores trae domicilio (para imprimir órdenes de compra).
alter table public.proveedores add column if not exists domicilio text;

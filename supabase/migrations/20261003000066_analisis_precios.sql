-- =============================================================================
-- Precio contra ventas, por familia de equipo.
--
-- El dueño quiere ver cómo cambió el costo y el precio de un equipo en el tiempo
-- (con y sin los cambios de utilidad) para correlacionarlo con las ventas.
--  * Índice de costo por familia: promedio, entre los equipos de la familia, del
--    costo de cada mes dividido entre su costo del primer mes (base 100). Sale de
--    historial_costeo (reconstruido desde 2019 + el registrado por el ERP).
--  * Índice de precio real: igual, con el precio de lista; solo existe desde que
--    el ERP guarda la política aplicada (antes la hoja no la registraba).
--  * Ventas: hasta el arranque, el libro de ventas de la hoja (texto libre, se
--    clasifica por palabras clave y solo cuenta ventas ≥ $40,000 para no confundir
--    "banda" equipo con "banda" refacción); después, los pedidos del ERP, que traen
--    el equipo exacto. Los paneles no se usan aquí: repiten lo del libro.
-- =============================================================================

insert into public.configuracion (clave, valor, descripcion) values
  ('fecha_arranque', to_jsonb(current_date::text), 'Día en que el ERP empezó a registrar ventas: antes, los análisis usan el libro de ventas de la hoja.')
on conflict (clave) do nothing;

-- Familia (categoría de equipo) a partir de un texto de venta.
create or replace function public.familia_de_texto(t text) returns text
language sql immutable as $$
  select case
    when x ~ '(dosificadora|zeus|planta dosificadora)' then 'Dosificadora'
    when x ~ 'bazuca' then 'Bazuca'
    when x ~ '(cribadora|criba )' then 'Cribadora'
    when x ~ 'silo' then 'Silo para Cemento'
    when x ~ 'tolva' then 'Tolva'
    when x ~ '(mezcladora|revolvedora)' then 'Mezcladora'
    when x ~ 'elevador' then 'Elevador'
    when x ~ '(banda transportadora|banda hombrera|banda pedestal|banda cargadora|banda de [0-9.]+ ?m|transportador)' then 'Banda Transportadora'
  end
  from (select sin_acentos(t) x) s
$$;

create or replace function public.analisis_precios_familia(p_familia text, p_desde date default '2021-01-01')
returns table (mes date, indice_costo numeric, indice_precio numeric, equipos int, ventas_importe numeric, ventas_num int)
language sql stable security invoker as $$
  with arranque as (select coalesce((select (valor #>> '{}')::date from configuracion where clave = 'fecha_arranque'), current_date) f),
  eqs as (
    select a.id from articulos a join categorias c on c.id = a.categoria_id
    where a.tipo = 'equipo' and c.nombre = p_familia
  ),
  meses as (select generate_series(date_trunc('month', p_desde), date_trunc('month', current_date), interval '1 month')::date mes),
  -- Último registro de cada equipo en o antes de cada fin de mes.
  serie as (
    select m.mes, e.id, h.costo_total, h.precio_lista
    from meses m cross join eqs e
    cross join lateral (select costo_total, precio_lista from historial_costeo h
                        where h.articulo_id = e.id and h.en < m.mes + interval '1 month'
                        order by h.en desc limit 1) h
  ),
  -- Índice ENCADENADO: cada mes se compara contra el anterior solo con los equipos
  -- que existen en ambos, y se acumula. Así un equipo nuevo en el catálogo no jala
  -- el índice hacia 100 (pasaba con "costo del mes / costo del primer mes").
  cambios as (
    select mes, id, costo_total, precio_lista,
      costo_total / nullif(lag(costo_total) over (partition by id order by mes), 0) rc,
      precio_lista / nullif(lag(precio_lista) over (partition by id order by mes), 0) rp
    from serie
  ),
  por_mes as (
    select mes, count(*)::int n, exp(avg(ln(rc)) filter (where rc > 0)) gc, exp(avg(ln(rp)) filter (where rp > 0)) gp,
           bool_or(precio_lista is not null) hay_precio
    from cambios group by mes
  ),
  indices as (
    select mes, n,
      round(100 * exp(sum(ln(coalesce(gc, 1))) over (order by mes)), 1) ic,
      case when hay_precio then round(100 * exp(sum(ln(coalesce(gp, 1))) over (order by mes)), 1) end ip
    from por_mes
  ),
  ventas as (
    select date_trunc('month', h.fecha)::date mes, sum(h.monto) importe, count(*)::int n
    from historial_ventas_hoja h, arranque
    where h.tipo = 'Venta' and h.monto >= 40000 and h.fecha < arranque.f and familia_de_texto(h.descripcion) = p_familia
    group by 1
    union all
    select date_trunc('month', p.fecha)::date, sum(l.importe * p.tipo_cambio * (1 + p.tasa_iva)), count(distinct p.id)::int
    from pedidos p join pedido_lineas l on l.pedido_id = p.id join eqs on eqs.id = l.articulo_id, arranque
    where p.estado <> 'cancelado' and not p.historico and p.fecha >= arranque.f
    group by 1
  )
  select m.mes, i.ic, i.ip, coalesce(i.n, 0), coalesce(sum(v.importe), 0), coalesce(sum(v.n), 0)::int
  from meses m left join indices i on i.mes = m.mes left join ventas v on v.mes = m.mes
  group by m.mes, i.ic, i.ip, i.n order by m.mes
$$;

-- Familias con su cantidad de equipos, para el selector.
create or replace view public.v_familias_equipo with (security_invoker = true) as
select c.nombre familia, count(*) equipos
from public.articulos a join public.categorias c on c.id = a.categoria_id
where a.tipo = 'equipo' and a.activo group by c.nombre;

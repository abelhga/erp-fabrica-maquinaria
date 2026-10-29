-- =============================================================================
-- Resultados desde 2018: el libro de compras de las hojas entra al ERP como histórico.
--
-- Resultados solo contaba el libro de compras del ERP y dirección pidió ver cuánto ha dejado la
-- empresa desde 2018. El libro de la hoja «BASE DE DATOS ACTUAL» (2022 al 12-oct-2026) ya estaba en
-- historial_compras_hoja (096, de ahí salen los saldos de arranque de proveedores); el de 2018 a 2021
-- («2018-2021 BASE DE DATOS UNIFICADA») entra en su propia tabla para no mover esos saldos, que
-- parten del adeudo al 31-dic-2021. El 12-oct-2026 compras dejó la hoja y arrancó el ERP, así que
-- la regla es la misma que ya usa Análisis para las ventas:
--   · antes del arranque (configuracion 'fecha_arranque'): ventas y compras de la hoja;
--   · desde el arranque: pedidos y libro de compras del ERP.
-- Las 75 compras de 2026 que ya estaban en el ERP salieron de esa misma hoja: con el corte no se
-- cuentan dos veces.
--
-- La hoja no dice qué se compró, solo a quién: la categoría es la del proveedor en su directorio
-- («Tipo de Proveedor», 97 categorías), guardada por nombre en compras_hoja_categoria. A los
-- proveedores grandes sin categoría se les asignó una al cargar, por lo que dice su descripción. En el ERP, lo bien amarrado es que cada compra tome
-- su categoría de lo que se compró (la partida de la OC): esto es solo para la historia.
--
-- Cada categoría cuenta como (compras_categorias.tipo):
--   material      ya va en el costo de lo vendido (en la historia: lo comprado de material);
--   fabricacion   gasto del taller que no se queda en el equipo;
--   operacion     gasto de vender y administrar;
--   nomina        nómina, IMSS y servicios médicos: en la historia son los sueldos reales;
--   impuestos     impuestos y PTU;
--   financiero    intereses y comisiones de financieras;
--   fuera         no es gasto: retiros de socios, préstamos, activos (vehículos, maquinaria,
--                 instalaciones), pagos de capital, «sin efectos». Se enseña aparte, no se resta.
-- =============================================================================

alter table public.compras_categorias drop constraint if exists compras_categorias_tipo_check;
alter table public.compras_categorias add constraint compras_categorias_tipo_check
  check (tipo in ('material', 'fabricacion', 'operacion', 'nomina', 'impuestos', 'financiero', 'fuera'));
alter table public.compras_categorias add column if not exists grupo_hoja text;
comment on column public.compras_categorias.grupo_hoja is 'El grupo contable que le daba la hoja (pestaña «Categorías Prov.»), para referencia.';

-- Las 97 categorías del directorio con su grupo de la hoja, más las que se asignaron al cargar.
-- Lo que finanzas ya reclasificó a mano (actualizado_por) no se toca.
insert into public.compras_categorias (categoria, tipo, grupo_hoja, actualizado_por)
select lower(trim(c)), t, g, null from (values
  ('Acero inoxidable (Exclusivamente)', 'material', 'Costos de producción'),
  ('Aceros', 'material', 'Costos de producción'),
  ('Automatización', 'material', 'Costos de producción'),
  ('Bandas transportadoras (cintas)', 'material', 'Costos de producción'),
  ('Bandas, mangas de hule y accesorios para bandas', 'material', 'Costos de producción'),
  ('Bandas Flexibles', 'material', 'Costos de producción'),
  ('Básculas', 'material', 'Costos de producción'),
  ('Cables y accesorios', 'material', 'Costos de producción'),
  ('Calcas e Indicadores para Equipos', 'material', 'Costos de producción'),
  ('Celdas de carga', 'material', 'Costos de producción'),
  ('Celosia blanca, Operador celocia bd.', 'material', 'Costos de producción'),
  ('Cilindros, electrovalvulas, unidades de mant.', 'material', 'Costos de producción'),
  ('Componentes y refacciones varios', 'material', 'Costos de producción'),
  ('Compresores', 'material', 'Costos de producción'),
  ('Cuenta litros', 'material', 'Costos de producción'),
  ('Ejes y componentes relacionados', 'material', 'Costos de producción'),
  ('Ensamble', 'material', 'Costos de producción'),
  ('Envasadoras y cosedoras', 'material', 'Costos de producción'),
  ('Equipos para reventa', 'material', 'Costos de producción'),
  ('Estructuras y construcciones metálicas', 'material', 'Costos de producción'),
  ('Herrajes', 'material', 'Costos de producción'),
  ('Imanes', 'material', 'Costos de producción'),
  ('Indicadores', 'material', 'Costos de producción'),
  ('Laminas perforadas, Lam. negras, placas, ptr.', 'material', 'Costos de producción'),
  ('Malacate galvanizado', 'material', 'Costos de producción'),
  ('Masas', 'material', 'Costos de producción'),
  ('Material y suministros electricos', 'material', 'Costos de producción'),
  ('Materiales industriales', 'material', 'Costos de producción'),
  ('Molinos', 'material', 'Costos de producción'),
  ('Motores y componentes afines', 'material', 'Costos de producción'),
  ('Patines', 'material', 'Costos de producción'),
  ('Pintura', 'material', 'Costos de producción'),
  ('poleas, bujes etc.', 'material', 'Costos de producción'),
  ('Rodamientos y chumaceras', 'material', 'Costos de producción'),
  ('Rodillos', 'material', 'Costos de producción'),
  ('Rotores y Estatores', 'material', 'Costos de producción'),
  ('Sondas de alveolos', 'material', 'Costos de producción'),
  ('Suspensiones', 'material', 'Costos de producción'),
  ('Tornillería y relacionado', 'material', 'Costos de producción'),
  ('Unidad de mantenimiento', 'material', 'Costos de producción'),
  ('Varios accesorios (Manga de hule)', 'material', 'Costos de producción'),
  ('Vibradores', 'material', 'Costos de producción'),
  ('Servicios aduanales', 'material', 'Costos de producción'),
  ('Consumibles para plasma', 'fabricacion', 'Costos de producción'),
  ('Equipo de seguridad para personal', 'fabricacion', 'Costos de producción'),
  ('Extintores', 'fabricacion', 'Costos de producción'),
  ('Ferreteria en general', 'fabricacion', 'Costos de producción'),
  ('Gases, soldadura, consumibles, etc.', 'fabricacion', 'Costos de producción'),
  ('Gruas y Servicios de Maniobras', 'fabricacion', 'Costos de producción'),
  ('Luz (electricidad)', 'fabricacion', 'Costos de producción'),
  ('pinzas de corte, prensas tipo c, etc', 'fabricacion', 'Costos de producción'),
  ('Reparación de equipos y maquinaria (torno, plasma, etc)', 'fabricacion', 'Costos de producción'),
  ('Servicios de paquetería (no fletes)', 'fabricacion', 'Costos de producción'),
  ('Servicios eléctricos y técnicos', 'fabricacion', 'Costos de producción'),
  ('Uniformes', 'fabricacion', 'Costos de producción'),
  ('Llantas', 'operacion', 'Costos de producción'),
  ('Llantera', 'operacion', 'Costos de producción'),
  ('Agua Potable', 'operacion', 'Gastos administrativos'),
  ('Alimentos', 'operacion', 'Gastos administrativos'),
  ('Consumibles oficina', 'operacion', 'Gastos administrativos'),
  ('Cristales y vidrio', 'operacion', 'Gastos administrativos'),
  ('Donativos', 'operacion', 'Gastos administrativos'),
  ('Luminaria led', 'operacion', 'Gastos administrativos'),
  ('Renta', 'operacion', 'Gastos administrativos'),
  ('Seguros (Vehículos)', 'operacion', 'Gastos administrativos'),
  ('Servicio de correo y herramientas online', 'operacion', 'Gastos administrativos'),
  ('Servicios de capacitación', 'operacion', 'Gastos administrativos'),
  ('Servicios de teléfono', 'operacion', 'Gastos administrativos'),
  ('Servicios Profesionales (varios)', 'operacion', 'Gastos administrativos'),
  ('Software (Contpaq i)', 'operacion', 'Gastos administrativos'),
  ('Bancos (Servicios Varios)', 'operacion', 'Gastos de ventas'),
  ('Casetas', 'operacion', 'Gastos de ventas'),
  ('Combustible (gasolina)', 'operacion', 'Gastos de ventas'),
  ('Comisiones', 'operacion', 'Gastos de ventas'),
  ('Fletes y paquetería (ambos)', 'operacion', 'Gastos de ventas'),
  ('Hospedaje', 'operacion', 'Gastos de ventas'),
  ('Publicidad', 'operacion', 'Gastos de ventas'),
  ('Reparación de vehículos', 'operacion', 'Gastos de ventas'),
  ('Seguros de carga', 'operacion', 'Gastos de ventas'),
  ('Servicio logistica', 'operacion', 'Gastos de ventas'),
  ('Viajes de ventas', 'operacion', 'Gastos de ventas'),
  ('Fletes (exclusivamente)', 'operacion', 'Fletes de envío'),
  ('Nómina', 'nomina', 'MOD'),
  ('IMSS', 'nomina', 'MOD'),
  ('Servicios medicos', 'nomina', 'MOD'),
  ('Impuestos', 'impuestos', 'Impuestos'),
  ('PTU', 'impuestos', 'PTU'),
  ('Bancos (Intereses)', 'financiero', 'Gastos Financieros'),
  ('Financiera', 'financiero', 'Gastos Financieros'),
  ('Bancos (Capital Créditos)', 'fuera', 'Gastos Financieros'),
  ('Préstamos de socios', 'fuera', 'Gastos Financieros'),
  ('Retiros Personales (Dividendos)', 'fuera', 'Dividendos (Retiros accionistas)'),
  ('Ropa (uso personal)', 'fuera', 'Dividendos (Retiros accionistas)'),
  ('Seguros', 'fuera', 'Dividendos (Retiros accionistas)'),
  ('Fertilizantes', 'fuera', 'Dividendos (Retiros accionistas)'),
  ('Concreto premezclado, etc (mat. construccion)', 'fuera', 'Dividendos (Retiros accionistas)'),
  ('Equipo de oficina', 'fuera', 'Adquisición de Activos'),
  ('Maquinaria para taller', 'fuera', 'Adquisición de Activos'),
  ('Vehículos', 'fuera', 'Adquisición de Activos'),
  ('Instalaciones y mejoras', 'fuera', 'Adquisición de Activos'),
  ('Utilidad a Socio de negocios varios', 'fuera', 'Otros'),
  ('Sin efectos', 'fuera', null),
  ('ds', 'fuera', null)
) x(c, t, g)
on conflict (categoria) do update set tipo = excluded.tipo, grupo_hoja = excluded.grupo_hoja
  where public.compras_categorias.actualizado_por is null;

create or replace function public.fijar_categoria_compra(p_categoria text, p_tipo text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not (puede('finanzas', 2) or puede('analisis', 3)) then
    raise exception 'Esto lo cambia finanzas' using errcode = '42501';
  end if;
  if p_tipo is null or p_tipo not in ('material', 'fabricacion', 'operacion', 'nomina', 'impuestos', 'financiero', 'fuera') then
    raise exception 'Tipo de categoría desconocido';
  end if;
  if coalesce(trim(p_categoria), '') = '' then raise exception 'Falta la categoría'; end if;
  insert into compras_categorias (categoria, tipo) values (lower(trim(p_categoria)), p_tipo)
  on conflict (categoria) do update set tipo = excluded.tipo, actualizado_por = auth.uid(), actualizado_en = now();
end $$;
revoke execute on function public.fijar_categoria_compra(text, text) from public, anon;
grant execute on function public.fijar_categoria_compra(text, text) to authenticated;

-- La categoría de cada proveedor de la hoja, por su nombre (la llave del libro, sin acentos ni
-- mayúsculas): la del directorio de la hoja o la que se le asignó al cargar.
create table if not exists public.compras_hoja_categoria (
  proveedor_llave text primary key,
  categoria text not null,
  origen text not null default 'directorio' check (origen in ('directorio', 'asignada'))
);
alter table public.compras_hoja_categoria enable row level security;
drop policy if exists ver on public.compras_hoja_categoria;
create policy ver on public.compras_hoja_categoria for select to authenticated
  using ((select puede('finanzas', 1)) or (select puede('analisis', 1)));
revoke insert, update, delete on public.compras_hoja_categoria from authenticated, anon;

-- Las compras de 2018 a 2021 (solo los renglones «Compra»: los pagos no son gasto).
create table if not exists public.historial_compras_2018_2021 (
  id bigserial primary key,
  fecha date not null check (fecha <= '2021-12-31'),
  proveedor_nombre text not null,
  proveedor_llave text not null,
  monto numeric(14,2) not null,       -- como la hoja: con IVA cuando hubo factura
  cuenta text,
  descripcion text,
  factura text,
  orden text,
  fila_origen int unique
);
comment on table public.historial_compras_2018_2021 is
  'Compras de 2018 a 2021 del libro COMPRAS de «2018-2021 BASE DE DATOS UNIFICADA». Solo lectura: alimenta Resultados.';
create index if not exists historial_compras_2018_fecha on public.historial_compras_2018_2021 (fecha);
alter table public.historial_compras_2018_2021 enable row level security;
drop policy if exists ver on public.historial_compras_2018_2021;
create policy ver on public.historial_compras_2018_2021 for select to authenticated
  using ((select puede('costos', 1)) and ((select puede('finanzas', 1)) or (select puede('analisis', 1))));
revoke insert, update, delete on public.historial_compras_2018_2021 from authenticated, anon;

-- Las compras de la hoja (2018 al arranque) con su categoría y sin IVA cuando hubo factura.
create or replace function public.compras_hoja(p_desde date, p_hasta date)
returns table (fecha date, categoria text, importe numeric)
language sql stable security definer set search_path = public as $$
  with iva as (select coalesce((select (valor #>> '{}')::numeric from configuracion where clave = 'iva'), 0.16) t),
  h as (
    select fecha, proveedor_llave, proveedor_id, monto, factura from historial_compras_hoja
    where tipo = 'Compra' and fecha between p_desde and p_hasta
    union all
    select fecha, proveedor_llave, null, monto, factura from historial_compras_2018_2021
    where fecha between p_desde and p_hasta
  )
  select h.fecha, coalesce(k.categoria, nullif(trim(pr.categoria), ''), 'Sin categoría'),
    case when lower(trim(coalesce(h.factura, ''))) not in ('', '-', 's/f', 'sf', 'n/a') then h.monto / (1 + iva.t) else h.monto end
  from h cross join iva
  left join compras_hoja_categoria k on k.proveedor_llave = h.proveedor_llave
  left join proveedores pr on pr.id = h.proveedor_id
$$;
revoke execute on function public.compras_hoja(date, date) from public, anon, authenticated;

create or replace function public.resultados_periodo(p_desde date, p_hasta date)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_iva numeric := coalesce((select (valor #>> '{}')::numeric from configuracion where clave = 'iva'), 0.16);
  v_prod int := departamento_produccion();
  v_arr date := coalesce((select (valor #>> '{}')::date from configuracion where clave = 'fecha_arranque'), current_date);
  v_mes_arr date;
  v_taller numeric;
  v_res jsonb;
  v_tot jsonb;
begin
  if not (puede('costos', 1) and (puede('finanzas', 1) or puede('analisis', 1))) then
    raise exception 'Los resultados son de dirección y finanzas' using errcode = '42501';
  end if;
  if p_hasta < p_desde then raise exception 'El periodo está al revés'; end if;
  v_mes_arr := date_trunc('month', v_arr)::date;
  -- La nómina de la hoja no separa taller y oficina: se reparte con la proporción de los sueldos de hoy.
  select coalesce(sum(s.sueldo_semanal) filter (where e.departamento_id is not distinct from v_prod) / nullif(sum(s.sueldo_semanal), 0), 0.7)
  into v_taller
  from empleados e
  join lateral (select x.sueldo_semanal from nomina_sueldos x where x.empleado_id = e.id order by x.desde desc limit 1) s on true
  where e.activo;

  with
  -- Ventas. Antes del arranque, las de la hoja (como Análisis), con su familia para la línea y sin IVA
  -- cuando hubo factura; desde el arranque, los pedidos del ERP.
  hoja_ventas as (
    select case when h.familia in ('dosificadoras', 'bandas', 'helicoidales', 'tolvas_silos', 'cribas', 'elevadores') then 'maquinaria'
                when h.familia in ('banda_hule', 'poleas', 'colectores', 'cosedoras') then 'refacciones' else 'otros' end linea,
      case when lower(trim(coalesce(h.factura, ''))) not in ('', '-', 's/f', 'sf', 'n/a') then h.monto / (1 + v_iva) else h.monto end importe
    from historial_ventas_hoja h
    where h.tipo = 'Venta' and h.fecha between p_desde and least(p_hasta, v_arr - 1)
  ),
  lineas as (
    select pl.linea::text linea, pl.importe * p.tipo_cambio importe, pl.cantidad * coalesce(c.costo_material, 0) material,
      coalesce(c.costo_total, 0) > 0 con_costo
    from pedido_lineas pl join pedidos p on p.id = pl.pedido_id
    left join costos_calculados c on c.articulo_id = pl.articulo_id
    where p.fecha between greatest(p_desde, v_arr) and p_hasta and p.estado <> 'cancelado' and not p.historico and pl.importe > 0
  ),
  ventas as (
    select linea, importe from hoja_ventas union all select linea, importe from lineas
  ),
  -- Material/precio de lo vendido con costeo en el último año. El costeo es el de hoy, así que la
  -- muestra es la de hoy aunque el periodo sea viejo.
  muestra as (
    select pl.linea::text linea, sum(pl.importe * p.tipo_cambio) importe, sum(pl.cantidad * c.costo_material) material, count(*) n
    from pedido_lineas pl join pedidos p on p.id = pl.pedido_id
    join costos_calculados c on c.articulo_id = pl.articulo_id and c.costo_total > 0
    where p.fecha > current_date - 365 and p.estado <> 'cancelado' and pl.importe > 0
    group by 1
  ),
  -- Con menos de 10 partidas vendidas la proporción de ventas es ruido: se usa la del catálogo.
  catalogo as (
    select linea_de(c.articulo_id)::text linea, sum(c.costo_material) material, sum(pr.precio) importe
    from costos_calculados c join precios_lista pr on pr.articulo_id = c.articulo_id
    where c.costo_total > 0 and pr.precio > 0 and linea_de(c.articulo_id) is not null
    group by 1
  ),
  proporcion as (
    select coalesce(m.linea, k.linea) linea,
      case when coalesce(m.n, 0) >= 10 then m.material / nullif(m.importe, 0) else k.material / nullif(k.importe, 0) end r,
      case when coalesce(m.n, 0) >= 10 then 'ventas' else 'catalogo' end fuente,
      coalesce(m.n, 0) partidas
    from muestra m full join catalogo k on k.linea = m.linea
  ),
  global as (
    select coalesce((select sum(material) / nullif(sum(importe), 0) from muestra where n >= 10),
                    (select sum(material) / nullif(sum(importe), 0) from catalogo)) r
  ),
  material as (
    select coalesce(sum(l.material) filter (where l.con_costo), 0) exacto,
      coalesce(sum(l.importe * least(greatest(coalesce(p.r, g.r, 0.5), 0.05), 0.95)) filter (where not l.con_costo), 0) estimado,
      coalesce(sum(l.importe) filter (where l.con_costo), 0) ventas_con_costo,
      coalesce(sum(l.importe), 0) ventas_erp
    from lineas l left join proporcion p on p.linea = l.linea cross join global g
  ),
  -- Compras: antes del arranque, el libro de la hoja; desde el arranque, el del ERP. Sin IVA si hubo factura.
  compras_todas as (
    select 'hoja' fuente, h.fecha, h.categoria, h.importe from compras_hoja(p_desde, least(p_hasta, v_arr - 1)) h
    union all
    select 'erp', m.fecha, coalesce(nullif(trim(m.categoria), ''), 'Sin categoría'),
      case when coalesce(m.cfdi_uuid, nullif(trim(m.factura), '')) is not null then m.monto / (1 + v_iva) else m.monto end
    from movimientos_proveedor m
    where m.tipo = 'compra' and m.fecha between greatest(p_desde, v_arr) and p_hasta
  ),
  compras as (
    select tipo_categoria_compra(c.categoria) tipo, min(c.categoria) categoria, lower(trim(c.categoria)) llave,
      sum(c.importe) importe
    from compras_todas c
    -- Desde el mes del arranque la comisión la calcula la regla (comisiones_mes); antes, la que se pagó.
    where not (lower(trim(c.categoria)) = 'comisiones' and c.fecha >= v_mes_arr)
      -- En el ERP los sueldos salen de nómina, no del libro de compras.
      and not (c.fuente = 'erp' and tipo_categoria_compra(c.categoria) = 'nomina')
    group by 1, 3
  ),
  -- Sueldos del ERP (desde el arranque): días de semanas cerradas con lo pagado; los demás, con el
  -- sueldo semanal ÷ 7 (antes de su primer sueldo registrado, ese primero).
  dias as (select d::date dia from generate_series(greatest(p_desde, v_arr), p_hasta, interval '1 day') d),
  cerradas as (select inicio from nomina_semanas where estado = 'cerrada' and inicio between greatest(p_desde, v_arr) - 6 and p_hasta),
  estimado as (
    select (e.departamento_id is not distinct from v_prod) taller, sum(s.sueldo_semanal / 7) importe
    from dias d
    join empleados e on e.fecha_ingreso <= d.dia and (e.activo or e.baja_en >= d.dia)
    join lateral (select x.sueldo_semanal from nomina_sueldos x where x.empleado_id = e.id
                  order by (x.desde <= d.dia) desc, case when x.desde <= d.dia then x.desde end desc, x.desde limit 1) s on true
    where not exists (select 1 from cerradas c where d.dia between c.inicio and c.inicio + 6)
    group by 1
  ),
  real as (
    select (e.departamento_id is not distinct from v_prod) taller,
      sum(n.total_percepciones * (least(c.inicio + 6, p_hasta) - greatest(c.inicio, p_desde, v_arr) + 1) / 7.0) importe
    from cerradas c join nomina_renglones n on n.semana = c.inicio join empleados e on e.id = n.empleado_id
    group by 1
  ),
  hoja_nomina as (select coalesce(sum(importe), 0) importe from compras where tipo = 'nomina'),
  comisiones as (
    select coalesce(sum(c.total), 0) importe
    from generate_series(greatest(date_trunc('month', p_desde)::date, v_mes_arr), date_trunc('month', p_hasta)::date, interval '1 month') g
    cross join lateral comisiones_mes(g::date) c
  ),
  hoja_comisiones as (select coalesce(sum(importe), 0) importe from compras where llave = 'comisiones')
  select jsonb_build_object(
    'periodo', jsonb_build_object('desde', p_desde, 'hasta', p_hasta),
    'arranque', v_arr,
    'usa_hoja', p_desde < v_arr,
    'ventas', (select coalesce(jsonb_agg(jsonb_build_object('linea', linea, 'importe', round(s, 2)) order by s desc), '[]')
               from (select linea, sum(importe) s from ventas group by linea) z),
    'ventas_total', (select round(coalesce(sum(importe), 0), 2) from ventas),
    'ventas_hoja', (select round(coalesce(sum(importe), 0), 2) from hoja_ventas),
    'material', (select jsonb_build_object('exacto', round(exacto, 2), 'estimado', round(estimado, 2),
                  'cobertura', round(ventas_con_costo / nullif(ventas_erp, 0), 4),
                  -- En la historia no hay costeo de lo vendido: el material es lo que se compró de material.
                  'comprado_hoja', (select round(coalesce(sum(importe), 0), 2) from compras_todas t
                                    where t.fuente = 'hoja' and tipo_categoria_compra(t.categoria) = 'material')) from material),
    'proporcion', (select coalesce(jsonb_object_agg(linea, jsonb_build_object('r', round(r, 4), 'fuente', fuente, 'partidas', partidas)), '{}')
                   from proporcion where r is not null and linea is not null),
    'proporcion_global', (select round(r, 4) from global),
    'proporcion_taller', round(v_taller, 4),
    'mano_obra', jsonb_build_object('estimado', (select round(coalesce(sum(importe), 0), 2) from estimado where taller),
                                    'real', (select round(coalesce(sum(importe), 0), 2) from real where taller),
                                    'hoja', (select round(importe * v_taller, 2) from hoja_nomina)),
    'sueldos_oficina', jsonb_build_object('estimado', (select round(coalesce(sum(importe), 0), 2) from estimado where not taller),
                                          'real', (select round(coalesce(sum(importe), 0), 2) from real where not taller),
                                          'hoja', (select round(importe * (1 - v_taller), 2) from hoja_nomina)),
    'semanas_cerradas', (select count(*) from cerradas),
    'comisiones', (select round(importe, 2) from comisiones) + (select round(importe, 2) from hoja_comisiones),
    'comisiones_hoja', (select round(importe, 2) from hoja_comisiones),
    -- comisiones_mes solo da las de todos a quien ve comisiones; a los demás, las suyas (cero).
    'comisiones_completas', puede('comisiones', 1) or puede('ventas', 3),
    'fabricacion', (select coalesce(jsonb_agg(jsonb_build_object('categoria', categoria, 'importe', round(importe, 2)) order by importe desc), '[]') from compras where tipo = 'fabricacion'),
    'operacion', (select coalesce(jsonb_agg(jsonb_build_object('categoria', categoria, 'importe', round(importe, 2)) order by importe desc), '[]') from compras where tipo = 'operacion' and llave <> 'comisiones'),
    'impuestos', (select coalesce(jsonb_agg(jsonb_build_object('categoria', categoria, 'importe', round(importe, 2)) order by importe desc), '[]') from compras where tipo in ('impuestos', 'financiero')),
    'fuera', (select coalesce(jsonb_agg(jsonb_build_object('categoria', categoria, 'importe', round(importe, 2)) order by importe desc), '[]') from compras where tipo = 'fuera'),
    'nomina_hoja', (select round(importe, 2) from hoja_nomina),
    'material_comprado', (select round(coalesce(sum(importe), 0), 2) from compras_todas t where t.fuente = 'erp' and tipo_categoria_compra(t.categoria) = 'material'),
    'caja_chica', (select round(coalesce(-sum(importe), 0), 2) from caja_chica where tipo = 'salida' and fecha between p_desde and p_hasta),
    -- Lo que Mercado Libre se queda de cada venta (comisión, envío que paga Hegamex, otros cargos).
    -- Las retenciones no: son impuestos a cuenta, no gasto.
    'mercado_libre', (select round(coalesce(sum(comision + envio + otros), 0), 2) from ml_pagos
                      where estado = 'approved' and (pagado_en at time zone 'America/Mexico_City')::date between p_desde and p_hasta),
    -- Las guías que pagamos (Envíos), por la fecha en que salió el paquete.
    'envios', (select round(coalesce(sum(costo_real), 0), 2) from envios
               where estado <> 'cancelado' and coalesce(enviado_en, guia_en, solicitado_en) is not null
                 and (coalesce(enviado_en, guia_en, solicitado_en) at time zone 'America/Mexico_City')::date between p_desde and p_hasta),
    'sin_clasificar', (select coalesce(jsonb_agg(distinct t.categoria), '[]') from compras_todas t
                       where t.categoria <> 'Sin categoría'
                         and not exists (select 1 from compras_categorias k where k.categoria = lower(trim(t.categoria)))),
    'sin_categoria', (select round(coalesce(sum(importe), 0), 2) from compras_todas where categoria = 'Sin categoría'),
    -- Desde cuándo tiene datos cada fuente: un periodo anterior sale incompleto y la pantalla lo dice.
    'desde_compras', least((select min(fecha) from historial_compras_2018_2021), (select min(fecha) from historial_compras_hoja where tipo = 'Compra'),
                           (select min(fecha) from movimientos_proveedor where tipo = 'compra')),
    'desde_caja', (select min(fecha) from caja_chica),
    'desde_ventas', least((select min(fecha) from historial_ventas_hoja), (select min(fecha) from pedidos)),
    'sin_sueldo', (select count(*) from empleados e where e.activo and not exists (select 1 from nomina_sueldos s where s.empleado_id = e.id))
  ) into v_res;

  -- Los totales los da la base para que la pantalla no saque su propia utilidad.
  select jsonb_build_object(
    'material', mat, 'mano_obra', mo, 'gastos_fabricacion', gf, 'costo_fabricacion', mat + mo + gf,
    'sueldos_oficina', so, 'compras_operacion', co,
    'gastos_operacion', so + com + co + caja + ml + env,
    'utilidad_operacion', ven - (mat + mo + gf) - (so + com + co + caja + ml + env),
    'impuestos_financieros', imp,
    'utilidad', ven - (mat + mo + gf) - (so + com + co + caja + ml + env) - imp,
    'fuera', fue)
  into v_tot
  from (select (v_res->>'ventas_total')::numeric ven,
          (v_res#>>'{material,exacto}')::numeric + (v_res#>>'{material,estimado}')::numeric + (v_res#>>'{material,comprado_hoja}')::numeric mat,
          (v_res#>>'{mano_obra,estimado}')::numeric + (v_res#>>'{mano_obra,real}')::numeric + (v_res#>>'{mano_obra,hoja}')::numeric mo,
          (select coalesce(sum((x->>'importe')::numeric), 0) from jsonb_array_elements(v_res->'fabricacion') x) gf,
          (v_res#>>'{sueldos_oficina,estimado}')::numeric + (v_res#>>'{sueldos_oficina,real}')::numeric + (v_res#>>'{sueldos_oficina,hoja}')::numeric so,
          (v_res->>'comisiones')::numeric com,
          (select coalesce(sum((x->>'importe')::numeric), 0) from jsonb_array_elements(v_res->'operacion') x) co,
          (v_res->>'caja_chica')::numeric caja, (v_res->>'mercado_libre')::numeric ml, (v_res->>'envios')::numeric env,
          (select coalesce(sum((x->>'importe')::numeric), 0) from jsonb_array_elements(v_res->'impuestos') x) imp,
          (select coalesce(sum((x->>'importe')::numeric), 0) from jsonb_array_elements(v_res->'fuera') x) fue) z;
  return v_res || jsonb_build_object('totales', v_tot);
end $$;
revoke execute on function public.resultados_periodo(date, date) from public, anon;
grant execute on function public.resultados_periodo(date, date) to authenticated;

-- Las categorías con lo que sumaron en el periodo (hoja antes del arranque, ERP después), para
-- reclasificarlas en la pantalla.
create or replace function public.categorias_compra_periodo(p_desde date, p_hasta date)
returns table (categoria text, tipo text, clasificada boolean, compras int, importe numeric)
language plpgsql stable security definer set search_path = public as $$
declare v_arr date := coalesce((select (valor #>> '{}')::date from configuracion where clave = 'fecha_arranque'), current_date);
begin
  if not (puede('costos', 1) and (puede('finanzas', 1) or puede('analisis', 1))) then
    raise exception 'Sin permiso' using errcode = '42501';
  end if;
  return query
  with t as (
    select h.categoria c, h.importe m from compras_hoja(p_desde, least(p_hasta, v_arr - 1)) h
    where h.categoria <> 'Sin categoría'
    union all
    select m.categoria, m.monto from movimientos_proveedor m
    where m.tipo = 'compra' and nullif(trim(m.categoria), '') is not null and m.fecha between greatest(p_desde, v_arr) and p_hasta
  )
  select lower(trim(t.c)), tipo_categoria_compra(t.c),
    exists (select 1 from compras_categorias k where k.categoria = lower(trim(t.c))), count(*)::int, round(sum(t.m), 2)
  from t
  group by 1, 2, 3
  order by 5 desc;
end $$;
revoke execute on function public.categorias_compra_periodo(date, date) from public, anon;
grant execute on function public.categorias_compra_periodo(date, date) to authenticated;

-- Año por año desde 2018, con la misma cuenta que Resultados: para ver de un vistazo cómo ha ido.
create or replace function public.resultados_por_anio(p_desde int default 2018)
returns table (anio int, ventas numeric, costo_fabricacion numeric, gastos_operacion numeric,
               impuestos_financieros numeric, utilidad numeric, fuera numeric, parcial boolean)
language plpgsql stable security definer set search_path = public as $$
declare y int; v_hoy date := hoy_mx(); r jsonb;
begin
  if not (puede('costos', 1) and (puede('finanzas', 1) or puede('analisis', 1))) then
    raise exception 'Los resultados son de dirección y finanzas' using errcode = '42501';
  end if;
  for y in greatest(coalesce(p_desde, 2018), 2018)..extract(year from v_hoy)::int loop
    r := resultados_periodo(make_date(y, 1, 1), least(make_date(y, 12, 31), v_hoy));
    anio := y;
    ventas := (r->>'ventas_total')::numeric;
    costo_fabricacion := (r#>>'{totales,costo_fabricacion}')::numeric;
    gastos_operacion := (r#>>'{totales,gastos_operacion}')::numeric;
    impuestos_financieros := (r#>>'{totales,impuestos_financieros}')::numeric;
    utilidad := (r#>>'{totales,utilidad}')::numeric;
    fuera := (r#>>'{totales,fuera}')::numeric;
    parcial := make_date(y, 12, 31) > v_hoy;
    return next;
  end loop;
end $$;
revoke execute on function public.resultados_por_anio(int) from public, anon;
grant execute on function public.resultados_por_anio(int) to authenticated;

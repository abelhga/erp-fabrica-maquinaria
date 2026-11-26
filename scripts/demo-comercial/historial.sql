-- =============================================================================
-- Historia de una fábrica que no existe, para la base de DEMOSTRACIÓN comercial.
--
-- Los scripts de scripts/demo/* llenan cada módulo con lo de "esta semana", pero el
-- tablero de dirección, el análisis y las fichas de cliente necesitan años de ventas
-- para verse vivos, y en Hegamex esos años salen del libro real (que no se enseña).
-- Aquí se inventan: unos 90 clientes repartidos por el país y tres años y nueve meses
-- de libro de ventas con temporada (enero flojo, marzo–mayo y octubre fuertes),
-- crecimiento de ~12 % al año y la mezcla de siempre: pocos equipos caros, muchas
-- refacciones y un goteo de Mercado Libre.
--
-- Va DESPUÉS de los scripts de scripts/demo y ANTES de analisis.sql (que fija la meta
-- del año sobre el año anterior). Es determinista (setseed): correrlo en dos bases da
-- los mismos números. Si ya hay libro, no hace nada.
--   psql "$DB_URL" -v ON_ERROR_STOP=1 -f scripts/demo-comercial/historial.sql
-- =============================================================================
begin;

do $$
begin
  if exists (select 1 from public.historial_ventas_hoja) then
    raise exception 'Esta base ya tiene libro de ventas: este script es solo para la base de demostración vacía';
  end if;
end $$;

-- El ERP "arrancó" el 1 de octubre: lo de antes es libro (hoja), lo de después son pedidos.
update public.configuracion set valor = '"2026-10-01"' where clave = 'fecha_arranque';

-- Los pedidos del taller de demostración (scripts/demo/produccion.sql, folios DEMO-7xx) son los
-- equipos grandes que tienen órdenes en piso, y todos nacen en las últimas semanas: sumados al
-- libro, el año salía 40 % arriba y noviembre triplicaba a cualquier otro mes. Se recorren dos
-- meses y medio atrás: pedidos tomados antes de arrancar el ERP que se siguen fabricando (como
-- pasa de verdad al arrancar). Lo que vendieron ya está en el libro de esos meses.
set local session_replication_role = replica;
update public.pedidos set fecha = fecha - 75 where folio ~ '^DEMO-[0-9]+$' and fecha >= date '2026-10-01';
set local session_replication_role = origin;

select setseed(0.4242);

-- Los pedidos de los scripts de casa casi no tienen cobros: la cobranza salía con $20 M por cobrar
-- y octubre y noviembre casi sin cobrar. Como lo haría finanzas: lo entregado, liquidado; lo que
-- está en fábrica, con su anticipo del 50 % (y el pago contra avance si ya lleva un mes). Cuatro se quedan sin cobrar (los atrasados de la demo).
insert into public.cobros (pedido_id, fecha, monto, metodo, referencia, notas, registrado_por)
select p.id, x.fecha, round(x.monto, 2), 'transferencia', 'SPEI ' || upper(substr(md5(p.id::text || x.cual), 1, 8)), x.nota,
       (select id from public.perfiles where correo = 'finanzas@hegamex.com')
from public.pedidos p
cross join lateral (
  select 'anticipo' cual, least(p.fecha + 3, current_date) fecha, p.total * 0.5 monto, 'Anticipo 50 %' nota
  union all
  select 'saldo', least(p.fecha + 25, current_date), p.total * 0.5, 'Liquidación'
  where p.estado in ('entregado', 'listo')
  union all
  -- Lo que lleva más de un mes en fábrica ya dio su pago contra avance: sin él, la mitad de cada
  -- equipo grande salía «vencida» y la cartera parecía un incendio que no es.
  select 'avance', p.fecha + 30, p.total * 0.25, 'Pago contra avance'
  where p.estado not in ('entregado', 'listo') and p.fecha + 30 <= current_date
) x
where p.estado <> 'cancelado' and not p.historico and p.total > 0
  and not exists (select 1 from public.cobros c where c.pedido_id = p.id)
  and p.id not in (select id from public.pedidos where estado <> 'cancelado' and not historico
                   and not exists (select 1 from public.cobros c where c.pedido_id = pedidos.id)
                   and total * tipo_cambio < 600000   -- los atrasados, de los chicos: un equipo grande sin anticipo no se fabrica
                   order by md5(folio) limit 4);

-- ---------------------------------------------------------------------------
-- Clientes: giro + nombre + ciudad. Los municipios son reales (para el mapa); las
-- empresas, inventadas.
-- ---------------------------------------------------------------------------
create temp table _plaza (ciudad text, estado text) on commit drop;
insert into _plaza values
  ('Guadalajara','Jalisco'),('Zapopan','Jalisco'),('Tlaquepaque','Jalisco'),('Tepatitlán','Jalisco'),('Lagos de Moreno','Jalisco'),
  ('Arandas','Jalisco'),('Ocotlán','Jalisco'),('Ameca','Jalisco'),('Ciudad Guzmán','Jalisco'),('Puerto Vallarta','Jalisco'),
  ('León','Guanajuato'),('Celaya','Guanajuato'),('Irapuato','Guanajuato'),('Salamanca','Guanajuato'),('Silao','Guanajuato'),
  ('Querétaro','Querétaro'),('San Juan del Río','Querétaro'),('Aguascalientes','Aguascalientes'),('Morelia','Michoacán'),
  ('Uruapan','Michoacán'),('Zamora','Michoacán'),('Monterrey','Nuevo León'),('Apodaca','Nuevo León'),('Saltillo','Coahuila'),
  ('Torreón','Coahuila'),('Chihuahua','Chihuahua'),('Ciudad Juárez','Chihuahua'),('Culiacán','Sinaloa'),('Los Mochis','Sinaloa'),
  ('Hermosillo','Sonora'),('Ciudad Obregón','Sonora'),('San Luis Potosí','San Luis Potosí'),('Zacatecas','Zacatecas'),
  ('Fresnillo','Zacatecas'),('Durango','Durango'),('Tepic','Nayarit'),('Colima','Colima'),('Toluca','México'),
  ('Tlalnepantla','México'),('Puebla','Puebla'),('Tehuacán','Puebla'),('Veracruz','Veracruz'),('Córdoba','Veracruz'),
  ('Mérida','Yucatán'),('Villahermosa','Tabasco'),('Tuxtla Gutiérrez','Chiapas'),('Oaxaca de Juárez','Oaxaca'),
  ('Pachuca','Hidalgo'),('Tampico','Tamaulipas'),('Reynosa','Tamaulipas'),('Mexicali','Baja California');

create temp table _giro (giro text, prefijo text, peso int) on commit drop;
insert into _giro values
  ('Concretera','Concretos',14),('Agregados pétreos','Agregados',10),('Molino de grano','Molinos',9),
  ('Acopio de granos','Granos',10),('Alimento balanceado','Alimentos Balanceados',9),('Minería','Minera',6),
  ('Fertilizantes','Fertilizantes',6),('Bloquera','Block y Prefabricados',7),('Reciclaje','Reciclados',5),
  ('Ingenio y alcoholera','Agroindustrial',4),('Constructora','Constructora',6),('Distribuidor de refacciones','Distribuidora Industrial',5),
  ('Avícola','Avícola',5),('Cementera','Cementos',3);

create temp table _apellido (n text) on commit drop;
insert into _apellido values ('del Valle'),('San Rafael'),('La Providencia'),('del Pacífico'),('Santa Fe'),('El Mirador'),
  ('Los Pinos'),('La Esperanza'),('del Real'),('Monte Alto'),('San José'),('La Cruz'),('del Río'),('Santa Rita'),('El Roble'),
  ('Las Palmas'),('del Golfo'),('Sierra Madre'),('La Loma'),('San Miguel'),('El Sauz'),('Tres Ríos'),('La Ceiba'),('Buenavista'),
  ('El Castillo'),('Santa Clara'),('La Joya'),('Los Altos'),('del Centro'),('Peña Blanca');

create temp table _nuevo on commit drop as
with g as (
  select giro, prefijo, generate_series(1, peso) from _giro
), sorteo as (
  select row_number() over () i, giro, prefijo from (select * from g order by random()) x
)
select s.i, s.giro,
       s.prefijo || ' ' || (select n from _apellido order by random() + s.i * 0 limit 1) as nombre,
       p.ciudad, p.estado
from sorteo s
cross join lateral (select * from _plaza order by random() + s.i * 0 limit 1) p
limit 90;

-- Sin repetir nombre (dos "Concretos del Valle" en ciudades distintas no le ayudan a nadie).
delete from _nuevo a using _nuevo b where a.nombre = b.nombre and a.i > b.i;
delete from _nuevo n using public.clientes c where c.nombre = n.nombre;

insert into public.clientes (nombre, razon_social, rfc, giro, ciudad, estado, vendedor_id, fuente_id, dias_credito, legacy_ref)
select n.nombre,
       n.nombre || case when n.i % 5 = 0 then ' S.P.R. de R.L.' when n.i % 3 = 0 then ' S. de R.L. de C.V.' else ' S.A. de C.V.' end,
       -- RFC con forma válida y fecha inventada: no hace falta que exista, solo que pase la regla.
       upper(substr(translate(n.nombre, 'ÁÉÍÓÚáéíóúñÑ ', 'AEIOUaeiounN'), 1, 3))
         || to_char(date '2004-01-01' + ((n.i * 97) % 6500)::int, 'YYMMDD')
         || upper(substr(md5(n.nombre), 1, 3)),
       n.giro, n.ciudad, n.estado,
       (select id from public.perfiles where correo = (array['isaac@hegamex.com','juan@hegamex.com','susana@hegamex.com'])[1 + n.i % 3]),
       (select id from public.fuentes_contacto order by id offset (n.i % 6) limit 1),
       case when n.i % 4 = 0 then 30 when n.i % 7 = 0 then 15 else 0 end,
       'demo-com-' || n.i
from _nuevo n;

-- Los RFC inventados no deben chocar con el formato: si alguno sacó un carácter raro, sin RFC.
update public.clientes set rfc = null where legacy_ref like 'demo-com-%' and rfc !~ '^[A-ZÑ&]{3,4}[0-9]{6}[A-Z0-9]{3}$';

-- ---------------------------------------------------------------------------
-- Libro de ventas: enero de 2023 a septiembre de 2026.
-- ---------------------------------------------------------------------------
create temp table _producto (familia text, descripcion text, minimo numeric, maximo numeric, peso numeric) on commit drop;
insert into _producto values
  -- Remolques: los nombres y precios del catálogo de la demostración (giro.sql)
  ('equipo', 'Cama baja de 60 t con suspensión de aire', 1950000, 2250000, 0.1),
  ('equipo', 'Caja refrigerada de 53 ft con equipo de frío', 1850000, 2050000, 0.1),
  ('equipo', 'Pipa de 30,000 L de acero inoxidable', 1900000, 2200000, 0.1),
  ('equipo', 'Remolque granelero de 40 t', 1800000, 2000000, 0.1),
  ('equipo', 'Cama baja de 50 t de 3 ejes', 1050000, 1200000, 0.1),
  ('equipo', 'Pipa de agua de 10,000 L', 350000, 410000, 3),
  ('equipo', 'Góndola de 14 m³ con volteo hidráulico', 340000, 400000, 4),
  ('equipo', 'Plataforma de 30 ft con laterales abatibles', 230000, 280000, 6),
  ('equipo', 'Remolque ganadero de 1 piso', 220000, 260000, 5),
  ('equipo', 'Remolque cañero de 2 ejes', 200000, 245000, 5),
  ('equipo', 'Caja seca de 28 ft', 200000, 240000, 5),
  ('equipo', 'Dolly convertidor de 2 ejes', 190000, 225000, 4),
  ('equipo', 'Remolque agrícola de volteo de 8 t', 170000, 205000, 6),
  ('equipo', 'Remolque jaula para pacas', 150000, 180000, 4),
  ('equipo', 'Remolque utilitario de 3.5 t', 115000, 145000, 8),
  ('equipo', 'Remolque utilitario de 2.5 t', 95000, 115000, 8),
  -- Refacciones (muchas y baratas)
  ('refaccion', 'Llanta 11R22.5 (juego de 4)', 24000, 32000, 9),
  ('refaccion', 'Rin de acero de 22.5"', 2800, 3900, 8),
  ('refaccion', 'Rin de aluminio de 22.5" pulido', 6200, 8200, 4),
  ('refaccion', 'Tambor de freno de 16.5"', 3400, 4600, 8),
  ('refaccion', 'Cámara de freno 30/30', 1900, 2900, 9),
  ('refaccion', 'Balero de rueda cónico (juego)', 1100, 2300, 10),
  ('refaccion', 'Bolsa de aire para suspensión', 2600, 3800, 7),
  ('refaccion', 'Eje de 25,000 lb con frenos de tambor', 26000, 34000, 3),
  ('refaccion', 'Suspensión neumática de 2 ejes', 68000, 86000, 2),
  ('refaccion', 'Patín de aterrizaje de 2 velocidades', 9800, 13500, 5),
  ('refaccion', 'Calavera LED trasera (par)', 1400, 2600, 9),
  ('refaccion', 'Plafón LED lateral (caja de 20)', 2400, 3600, 6),
  ('refaccion', 'Lona de cubierta de 22 oz (rollo)', 9000, 16000, 4),
  ('refaccion', 'Perno rey de 2"', 1600, 2600, 5),
  ('refaccion', 'Quinta rueda de 2"', 24000, 31000, 2),
  -- Servicio
  ('servicio', 'Instalación de caja en chasis', 18000, 45000, 4),
  ('servicio', 'Flete a cliente', 6500, 22000, 6),
  ('servicio', 'Reparación de piso y cambio de travesaños', 12000, 38000, 3);

-- Un renglón por venta. Cuántas por mes: temporada × crecimiento.
create temp table _mes on commit drop as
select m::date mes,
       -- 12 % al año desde enero de 2023
       power(1.12, (extract(year from m) - 2023) + (extract(month from m) - 1) / 12.0) *
       (array[0.72, 0.86, 1.12, 1.18, 1.15, 0.96, 0.90, 0.94, 0.98, 1.16, 1.08, 0.95])[extract(month from m)::int] as factor
from generate_series(date '2023-01-01', date '2026-09-01', interval '1 month') m;

create temp table _cli on commit drop as
select id, nombre, row_number() over (order by random()) r from public.clientes
where activo and nombre not ilike '%mercado libre%' and coalesce(pais, 'México') = 'México';

create temp table _venta (fecha date, cliente_id uuid, cliente_nombre text, descripcion text, monto numeric, familia_tipo text) on commit drop;

do $$
declare
  m record; n int; k int; p record; c record; v_fecha date; v_monto numeric; v_clientes int; v_r int;
begin
  select count(*) into v_clientes from _cli;
  for m in select * from _mes order by mes loop
    -- equipos, refacciones, servicios y Mercado Libre
    foreach k in array array[1, 2, 3, 4] loop
      n := round(m.factor * (array[9, 50, 6, 70])[k] * (0.85 + random() * 0.3));
      for i in 1..n loop
        v_fecha := m.mes + floor(random() * extract(day from (m.mes + interval '1 month' - interval '1 day')))::int;
        if extract(dow from v_fecha) = 0 then v_fecha := v_fecha + 1; end if;
        if v_fecha > (m.mes + interval '1 month' - interval '1 day')::date then v_fecha := v_fecha - 2; end if;
        if k = 4 then
          select * into p from _producto where familia = 'refaccion' order by -ln(random()) / peso limit 1;
          v_monto := round((p.minimo * (0.15 + random() * 0.35))::numeric, -1);
          insert into _venta values (v_fecha, null, 'Ventas Mercado Libre', p.descripcion, v_monto, 'ml');
        else
          select * into p from _producto
          where familia = (array['equipo', 'refaccion', 'servicio'])[k] order by -ln(random()) / peso limit 1;
          v_monto := round(((p.minimo + random() * (p.maximo - p.minimo)) * (1 + (extract(year from m.mes) - 2023) * 0.05))::numeric, -2);
          -- Pareto: un tercio de los clientes hace dos tercios de las compras.
          v_r := 1 + floor(power(random(), 2.2) * v_clientes)::int;  -- fuera del where: ahí random() cambia por renglón
          select * into c from _cli where r = v_r;
          insert into _venta values (v_fecha, c.id, c.nombre, p.descripcion, v_monto, p.familia);
        end if;
      end loop;
    end loop;
  end loop;
end $$;

insert into public.historial_ventas_hoja (fecha, cliente_id, cliente_nombre, tipo, monto, cuenta, descripcion, factura)
select fecha, cliente_id, cliente_nombre, 'Venta', monto,
       case when familia_tipo = 'ml' then 'Mercado Libre' else 'Fiscal' end,
       descripcion,
       case when familia_tipo = 'ml' then null else 'A-' || (10000 + row_number() over (order by fecha, monto)) end
from _venta order by fecha;

-- Los pagos: la mayoría a los pocos días; los de crédito, a 15–35 días. Lo de septiembre
-- de 2026 queda en parte sin pagar (cartera viva al arrancar).
insert into public.historial_ventas_hoja (fecha, cliente_id, cliente_nombre, tipo, monto, cuenta, descripcion, factura)
select least(h.fecha + case when random() < 0.7 then floor(random() * 6)::int else 15 + floor(random() * 20)::int end, date '2026-09-30'),
       h.cliente_id, h.cliente_nombre, 'Pago', h.monto, h.cuenta, 'Pago ' || coalesce(h.factura, 'Mercado Libre'), h.factura
from public.historial_ventas_hoja h
where h.tipo = 'Venta' and not (h.fecha > date '2026-09-10' and random() < 0.45);

-- ---------------------------------------------------------------------------
-- Octubre y noviembre en el ERP: desde el arranque las ventas salen de los pedidos, y los de los
-- scripts de casa son pocos (Resultados de noviembre salía con pérdida: un mes de nómina contra
-- $600 mil de ventas). Aquí, un mes normal: ~9 remolques del catálogo a precio de lista y
-- refacciones casi a diario, con sus cobros. Las refacciones van como partida libre (sin artículo)
-- para no pedir salidas de almacén que nadie dio.
-- ---------------------------------------------------------------------------
do $$
declare
  d date; c record; a record; r record; p uuid; v_vend uuid; v_estado public.estado_pedido; n int;
  v_vendedores uuid[] := array(select id from public.perfiles where correo in ('isaac@hegamex.com', 'juan@hegamex.com', 'susana@hegamex.com'));
  v_fin uuid := (select id from public.perfiles where correo = 'finanzas@hegamex.com');
begin
  for d in select x::date from generate_series(date '2026-10-01', current_date - 1, interval '1 day') x loop
    continue when extract(dow from d) = 0;
    -- Remolques: ~9 al mes, más los baratos que los caros.
    if random() < 0.30 then
      select x.id, x.nombre, round(pl.precio, -2) precio into a
      from public.articulos x join public.precios_lista pl on pl.articulo_id = x.id
      where x.tipo = 'equipo' and x.activo and pl.precio between 90000 and 2300000
        and exists (select 1 from public.bom_operaciones o where o.articulo_id = x.id)  -- con horas: su orden llena el Gantt
      order by -ln(random()) * case when pl.precio > 900000 then 40 else 1 end limit 1;
      select * into c from _cli order by random() limit 1;
      v_vend := coalesce((select vendedor_id from public.clientes where id = c.id), v_vendedores[1 + floor(random() * 3)::int]);
      -- Lo de las últimas cuatro semanas sigue por fabricarse: actividad.sql lo manda al taller.
      v_estado := case when d < current_date - 35 then 'entregado' when d < current_date - 28 then 'listo' else 'confirmado' end;
      insert into public.pedidos (cliente_id, vendedor_id, fecha, fecha_compromiso, estado, condiciones_pago, entregado_en, notas)
      values (c.id, v_vend, d, d + 30, v_estado, '50 % de anticipo y 50 % contra entrega',
              case when v_estado = 'entregado' then (d + 30)::timestamptz + interval '12 hours' end, 'Pedido de piso')
      returning id into p;
      insert into public.pedido_lineas (pedido_id, orden, articulo_id, titulo, cantidad, precio_unitario, linea, cantidad_entregada)
      values (p, 1, a.id, a.nombre, 1, a.precio, 'maquinaria', case when v_estado = 'entregado' then 1 else 0 end);
    end if;
    -- Refacciones: casi a diario, de 1 a 3 partidas.
    for n in 1 .. (case when random() < 0.75 then 1 else 2 end) loop
      select * into c from _cli order by random() limit 1;
      v_vend := coalesce((select vendedor_id from public.clientes where id = c.id), v_vendedores[1 + floor(random() * 3)::int]);
      insert into public.pedidos (cliente_id, vendedor_id, fecha, estado, condiciones_pago, entregado_en, notas)
      values (c.id, v_vend, d, case when d < current_date - 3 then 'entregado'::public.estado_pedido else 'confirmado' end,
              'Contado', case when d < current_date - 3 then (d + 1)::timestamptz + interval '11 hours' end, 'Refacciones de mostrador')
      returning id into p;
      for r in select x.*, row_number() over () o from (
                 select descripcion, round((minimo + random() * (maximo - minimo))::numeric, -1) precio, 1 + floor(random() * 3)::int cant
                 from _producto where familia = 'refaccion' order by -ln(random()) / peso limit (1 + floor(random() * 3)::int)) x loop
        insert into public.pedido_lineas (pedido_id, orden, titulo, cantidad, precio_unitario, linea, cantidad_entregada)
        values (p, r.o, r.descripcion, r.cant, r.precio, 'refacciones', case when d < current_date - 3 then r.cant else 0 end);
      end loop;
    end loop;
  end loop;

  -- Cobros: lo entregado, pagado (anticipo y liquidación); lo que está en fábrica, su anticipo.
  insert into public.cobros (pedido_id, fecha, monto, metodo, referencia, notas, registrado_por)
  select p.id, x.fecha, round(x.monto, 2), 'transferencia', 'SPEI ' || upper(substr(md5(p.id::text || x.cual), 1, 8)), x.nota, v_fin
  from public.pedidos p
  cross join lateral (
    select 'unico' cual, least(p.fecha + 2, current_date) fecha, p.total monto, 'Pago de contado' nota where p.notas = 'Refacciones de mostrador'
    union all
    select 'anticipo', least(p.fecha + 2, current_date), p.total * 0.5, 'Anticipo 50 %' where p.notas = 'Pedido de piso'
    union all
    select 'saldo', (p.entregado_en at time zone 'America/Mexico_City')::date, p.total * 0.5, 'Liquidación'
    where p.notas = 'Pedido de piso' and p.estado = 'entregado'
  ) x
  where p.notas in ('Pedido de piso', 'Refacciones de mostrador') and p.total > 0
    and (p.notas <> 'Refacciones de mostrador' or p.estado = 'entregado')
    and not exists (select 1 from public.cobros cb where cb.pedido_id = p.id);
  update public.pedidos set notas = null where notas in ('Pedido de piso', 'Refacciones de mostrador');
end $$;

-- Gastos de octubre y noviembre: Resultados los toma de las compras con categoría, y la demostración
-- no traía ninguna (salía una fábrica sin renta ni luz, con 39 % de utilidad). Proveedores de
-- servicios inventados; cada gasto con su factura y pagado.
do $$
declare g record; d date; p uuid; n int := 0;
begin
  for g in select * from (values
    ('Inmobiliaria Parque Industrial Zapopan', 'renta',                                   1, 98000, 0.00),
    ('Energía y Servicios de Occidente',      'luz (electricidad)',                      1, 46000, 0.12),
    ('Gases Industriales de Jalisco',         'gases, soldadura, consumibles, etc.',     4, 11500, 0.25),
    ('Ferretería La Tuerca',                  'ferreteria en general',                   5, 5200, 0.35),
    ('Seguridad Industrial Bajío',            'equipo de seguridad para personal',      1, 9800, 0.20),
    ('Gasolinera Periférico Sur',             'combustible (gasolina)',                  6, 5600, 0.25),
    ('Fletes y Paquetería del Centro',        'fletes (exclusivamente)',                 5, 12800, 0.40),
    ('Telefonía Empresarial MX',              'servicios de teléfono',                   1, 7400, 0.00),
    ('Seguros Unidos del Pacífico',           'seguros (vehículos)',                     1, 14600, 0.00),
    ('Publicidad Digital Occidente',          'publicidad',                              1, 28000, 0.15),
    ('Viajes Corporativos GDL',               'viajes de ventas',                        2, 9500, 0.30),
    ('Taller de Mantenimiento Industrial',    'reparación de equipos y maquinaria (torno, plasma, etc)', 1, 17500, 0.40),
    ('Papelería Corporativa',                 'consumibles oficina',                     1, 5200, 0.20),
    ('Software y Licencias MX',               'servicio de correo y herramientas online', 1, 6300, 0.00),
    ('Servicios Profesionales Contables',     'servicios profesionales (varios)',        1, 32000, 0.00),
    ('Uniformes Industriales del Bajío',        'uniformes',                               1, 8800, 0.30)
  ) x(nombre, categoria, veces, monto, variacion) loop
    insert into public.proveedores (nombre, razon_social, categoria, dias_credito, legacy_id)
    values (g.nombre, g.nombre || ' S.A. de C.V.', 'Servicios', 0, 'demo-com-gasto-' || md5(g.nombre))
    returning id into p;
    for d in select x::date from generate_series(date '2026-10-01', current_date - 1, interval '1 month') x loop
      for i in 1 .. g.veces loop
        n := n + 1;
        insert into public.movimientos_proveedor (proveedor_id, proveedor_llave, tipo, fecha, monto, cuenta, categoria, factura, descripcion, leido_de, metodo_pago, registrado_por)
        values (p, lower(public.sin_acentos(g.nombre)), 'compra',
                least(d + case when g.veces = 1 then 2 + floor(random() * 5)::int else floor(random() * 27)::int end, current_date - 1),
                round((g.monto * (1 + (random() * 2 - 1) * g.variacion))::numeric, 2) * 1.16,
                'santander_fiscal', g.categoria, 'F-' || (20000 + n), g.categoria, 'captura', 'PUE',
                (select id from public.perfiles where correo = 'finanzas@hegamex.com'));
      end loop;
    end loop;
  end loop;
  -- Pagados al día (de contado): el saldo con proveedores es el de la operación, no el de estos.
  insert into public.movimientos_proveedor (proveedor_id, proveedor_llave, tipo, fecha, monto, cuenta, descripcion, leido_de, registrado_por)
  select m.proveedor_id, m.proveedor_llave, 'pago', m.fecha, m.monto, m.cuenta, 'Pago ' || m.factura, 'captura', m.registrado_por
  from public.movimientos_proveedor m join public.proveedores pr on pr.id = m.proveedor_id
  where m.tipo = 'compra' and pr.legacy_id like 'demo-com-gasto-%';
end $$;

-- La familia la pone el disparador con las reglas de la base; las que no reconoció, a la vista.
do $$
declare v int;
begin
  select count(*) into v from public.historial_ventas_hoja where tipo = 'Venta' and coalesce(familia, 'otros') = 'otros' and cuenta <> 'Mercado Libre';
  raise notice 'Libro: % ventas, % pagos, $% vendido; % ventas sin familia reconocida',
    (select count(*) from public.historial_ventas_hoja where tipo = 'Venta'),
    (select count(*) from public.historial_ventas_hoja where tipo = 'Pago'),
    (select to_char(sum(monto), 'FM999,999,999') from public.historial_ventas_hoja where tipo = 'Venta'), v;
end $$;

commit;

select extract(year from fecha)::int anio, to_char(sum(monto), 'FM999,999,999') vendido, count(*) ventas
from public.historial_ventas_hoja where tipo = 'Venta' group by 1 order by 1;

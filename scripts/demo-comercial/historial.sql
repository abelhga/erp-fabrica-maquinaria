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
-- está en fábrica, con su anticipo del 50 %. Cuatro se quedan sin cobrar (los atrasados de la demo).
insert into public.cobros (pedido_id, fecha, monto, metodo, referencia, notas, registrado_por)
select p.id, x.fecha, round(x.monto, 2), 'transferencia', 'SPEI ' || upper(substr(md5(p.id::text || x.cual), 1, 8)), x.nota,
       (select id from public.perfiles where correo = 'finanzas@hegamex.com')
from public.pedidos p
cross join lateral (
  select 'anticipo' cual, least(p.fecha + 3, current_date) fecha, p.total * 0.5 monto, 'Anticipo 50 %' nota
  union all
  select 'saldo', least(p.fecha + 25, current_date), p.total * 0.5, 'Liquidación'
  where p.estado in ('entregado', 'listo')
) x
where p.estado <> 'cancelado' and not p.historico and p.total > 0
  and not exists (select 1 from public.cobros c where c.pedido_id = p.id)
  and p.id not in (select id from public.pedidos where estado <> 'cancelado' and not historico
                   and not exists (select 1 from public.cobros c where c.pedido_id = pedidos.id)
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
create temp table _producto (familia text, descripcion text, minimo numeric, maximo numeric, peso int) on commit drop;
insert into _producto values
  -- Equipos (pocos y caros)
  ('equipo', 'Dosificadora ZEUS 15 móvil', 520000, 690000, 3),
  ('equipo', 'Dosificadora ZEUS 30 con 3 tolvas móvil', 980000, 1350000, 2),
  ('equipo', 'Banda transportadora 18" x 12 m', 165000, 210000, 6),
  ('equipo', 'Banda transportadora 24" x 20 m con variador', 310000, 395000, 3),
  ('equipo', 'Banda cargadora 20" x 10 m con levante y remolque', 230000, 290000, 5),
  ('equipo', 'Banda transportadora tipo artesa 30" x 15 m', 420000, 560000, 2),
  ('equipo', 'Elevador de cangilones 8 m con cangilón 6 x 5', 180000, 240000, 4),
  ('equipo', 'Elevador de cangilones 14 m', 290000, 360000, 2),
  ('equipo', 'Cribadora vibratoria 3 x 6 ft, 2 pisos', 210000, 270000, 3),
  ('equipo', 'Cribadora ZAR 4T con turbina', 340000, 410000, 2),
  ('equipo', 'Silo de 60 toneladas con accesorios', 450000, 580000, 2),
  ('equipo', 'Tolva de 5 m³ con descarga lateral', 95000, 130000, 4),
  ('equipo', 'Transportador helicoidal tipo bazuca 8" x 9 m', 85000, 115000, 5),
  ('equipo', 'Colector de polvos de 14 cartuchos', 145000, 185000, 2),
  -- Refacciones (muchas y baratas)
  ('refaccion', 'Banda grip top 2 capas 18" (30 m)', 18000, 26000, 8),
  ('refaccion', 'Metros de banda lisa 3 capas 24"', 6000, 22000, 8),
  ('refaccion', 'Cangilón 6 x 5 azul (caja de 50)', 7000, 11000, 9),
  ('refaccion', 'Tornillo para cangilón 1/4 x 1 1/2 galv. (500 pzas)', 1800, 3200, 6),
  ('refaccion', 'Chumacera de piso UCP 207', 900, 2400, 10),
  ('refaccion', 'Polea motriz 10" x 20" ahulada', 6500, 9500, 5),
  ('refaccion', 'Motorreductor 3 HP relación 25:1', 14000, 19000, 6),
  ('refaccion', 'Rodillo de carga 4" x 20" con flecha (10 pzas)', 9000, 14000, 6),
  ('refaccion', 'Grapas RS 187 de 24" (caja)', 4500, 7000, 6),
  ('refaccion', 'Cosedora manual F300A', 5200, 6900, 7),
  ('refaccion', 'Cabezal cosedor F900', 38000, 52000, 2),
  ('refaccion', 'Malla para criba 1/4" inoxidable', 3500, 9000, 5),
  ('refaccion', 'Catarina 80B14 y cadena', 2500, 6000, 5),
  ('refaccion', 'Variador de frecuencia 5 HP 220 V', 9000, 13000, 3),
  -- Servicio
  ('servicio', 'Instalación y puesta en marcha', 18000, 65000, 4),
  ('servicio', 'Flete a obra', 4500, 18000, 6),
  ('servicio', 'Reparación de banda y cambio de rodillos', 8000, 30000, 3);

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
      n := round(m.factor * (array[7, 55, 6, 70])[k] * (0.85 + random() * 0.3));
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

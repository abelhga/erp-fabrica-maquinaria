-- =============================================================================
-- Datos de demostración del módulo de costeo e ingeniería.
--
-- Sirven para ver y probar las pantallas mientras no está el catálogo real:
-- bandas con subensambles compartidos y cantidades por largo, una banda
-- "plana" como las de la hoja (con el cabezal motriz repetido línea por línea,
-- para probar "Usar subensamble existente"), componentes importados en USD y
-- EUR, uno sin costo, costos viejos, historial desde 2023 y cambios de
-- utilidad en el tiempo para la gráfica de precio real contra precio a
-- utilidad constante.
--
-- Todo lleva clave DEMO-C-…, DEMO-SUB-… o DEMO-E-…; el script es idempotente
-- (se puede correr varias veces) y solo borra o reescribe SUS artículos: otros
-- datos de demostración que también usen el prefijo DEMO- no se tocan. Uso:
--   psql "$DB_URL" -f scripts/demo/costeo.sql
--
-- Las existencias se escriben directo en `existencias` (sin movimiento):
-- los movimientos no se pueden borrar nunca y no queremos dejar basura
-- permanente en la base por una demostración.
-- =============================================================================
begin;

-- El historial de costos que dejen los disparadores dice "importación", no "manual".
select set_config('erp.origen_costo', 'importacion', true);

-- -----------------------------------------------------------------------------
-- Proveedores
-- -----------------------------------------------------------------------------
insert into proveedores (legacy_id, nombre, categoria, pais, es_importacion, moneda, dias_credito, dias_entrega) values
  ('DEMO-PROV-1', 'Rodamientos y Transmisiones del Bajío', 'Rodamientos', 'México', false, 'MXN', 30, 5),
  ('DEMO-PROV-2', 'Aceros y Perfiles de Guadalajara', 'Acero', 'México', false, 'MXN', 15, 3),
  ('DEMO-PROV-3', 'Motores y Reductores de Occidente', 'Motores', 'México', false, 'MXN', 30, 10),
  ('DEMO-PROV-4', 'Conveyor Parts Supply (EUA)', 'Importación', 'Estados Unidos', true, 'USD', 0, 60),
  ('DEMO-PROV-5', 'Vibrotecnia Europea', 'Importación', 'Italia', true, 'EUR', 0, 90),
  ('DEMO-PROV-6', 'Bandas Industriales Atotonilco', 'Bandas', 'México', false, 'MXN', 30, 4),
  ('DEMO-PROV-7', 'Eléctrica y Control Jalisco', 'Eléctricos', 'México', false, 'MXN', 30, 3)
on conflict (legacy_id) do update set nombre = excluded.nombre, categoria = excluded.categoria, pais = excluded.pais,
  es_importacion = excluded.es_importacion, moneda = excluded.moneda, dias_credito = excluded.dias_credito,
  dias_entrega = excluded.dias_entrega;

-- -----------------------------------------------------------------------------
-- Componentes, materia prima y servicios con su costo vigente
-- -----------------------------------------------------------------------------
create temp table _demo_comp (clave text, tipo tipo_articulo, nombre text, unidad text, costo numeric, moneda moneda,
  prov text, importado boolean, dias int, kg numeric, actualizado date, descripcion text) on commit drop;
insert into _demo_comp values
  ('DEMO-C-001', 'componente', 'Banda 2 capas lisa 18" de ancho', 'metro', 420, 'MXN', 'DEMO-PROV-6', false, 4, 3.1, '2026-08-12', 'Banda de 2 capas de lona, cubierta lisa 1/8" + 1/16". Para granel y costal.'),
  ('DEMO-C-002', 'componente', 'Banda grip top 2 capas 20" de ancho', 'metro', 380, 'MXN', 'DEMO-PROV-6', false, 4, 3.4, '2026-08-12', null),
  ('DEMO-C-003', 'componente', 'Rodillo de carga 4" x 20" con flecha', 'pieza', 310, 'MXN', 'DEMO-PROV-1', false, 7, 4.2, '2026-07-28', null),
  ('DEMO-C-004', 'componente', 'Rodillo de retorno 4" x 22"', 'pieza', 260, 'MXN', 'DEMO-PROV-1', false, 7, 4.5, '2026-07-28', null),
  ('DEMO-C-005', 'componente', 'Chumacera de piso 1 7/16" UCP-207', 'pieza', 385, 'MXN', 'DEMO-PROV-1', false, 3, 1.6, '2026-09-02', null),
  ('DEMO-C-006', 'componente', 'Chumacera tensora 1 7/16" UCT-207', 'pieza', 520, 'MXN', 'DEMO-PROV-1', false, 3, 2.3, '2026-09-02', null),
  ('DEMO-C-007', 'componente', 'Motorreductor 3F 3 HP caja 90 relación 25:1', 'pieza', 15000, 'MXN', 'DEMO-PROV-3', false, 10, 38, '2026-06-18', 'Motor trifásico 220/440 V, 1750 rpm, flecha de salida 1 7/16".'),
  ('DEMO-C-008', 'componente', 'Motorreductor 3F 5 HP caja 110 relación 30:1', 'pieza', 21500, 'MXN', 'DEMO-PROV-3', false, 10, 55, '2026-06-18', null),
  ('DEMO-C-009', 'componente', 'Polea motriz 10" x 20" ahulada con buje', 'pieza', 3200, 'MXN', 'DEMO-PROV-1', false, 8, 22, '2026-05-09', null),
  ('DEMO-C-010', 'componente', 'Polea de cola 8" x 20" con buje', 'pieza', 2450, 'MXN', 'DEMO-PROV-1', false, 8, 17, '2026-05-09', null),
  ('DEMO-C-011', 'componente', 'Cople flexible L-100', 'pieza', 780, 'MXN', 'DEMO-PROV-1', false, 3, 1.2, '2026-08-20', null),
  ('DEMO-C-012', 'materia_prima', 'Lámina calibre 14 de 4 x 10', 'pieza', 1040, 'MXN', 'DEMO-PROV-2', false, 2, 56.5, '2026-09-10', null),
  ('DEMO-C-013', 'materia_prima', 'Lámina calibre 12 de 4 x 10', 'pieza', 1380, 'MXN', 'DEMO-PROV-2', false, 2, 79, '2026-09-10', null),
  ('DEMO-C-014', 'materia_prima', 'PTR 4 x 3 calibre 11 (tramo de 6 m)', 'pieza', 1200, 'MXN', 'DEMO-PROV-2', false, 2, 47, '2026-09-10', null),
  ('DEMO-C-015', 'materia_prima', 'Ángulo 2" x 3/16"', 'metro', 118, 'MXN', 'DEMO-PROV-2', false, 2, 3.63, '2026-09-10', null),
  ('DEMO-C-016', 'materia_prima', 'Solera 2" x 1/4"', 'metro', 95, 'MXN', 'DEMO-PROV-2', false, 2, 2.53, '2026-09-10', null),
  ('DEMO-C-017', 'materia_prima', 'Canal U 6" x 12.12 kg/m', 'metro', 410, 'MXN', 'DEMO-PROV-2', false, 2, 12.12, '2026-09-10', null),
  ('DEMO-C-018', 'componente', 'Tornillería galvanizada surtida', 'juego', 350, 'MXN', null, false, 1, null, '2026-07-01', null),
  ('DEMO-C-019', 'materia_prima', 'Micro alambre ER70S-6 de 0.035"', 'kilo', 68, 'MXN', 'DEMO-PROV-2', false, 2, 1, '2026-08-05', null),
  ('DEMO-C-020', 'materia_prima', 'Carga de CO2 de 25 kg', 'carga', 480, 'MXN', null, false, 1, null, '2026-08-05', null),
  ('DEMO-C-021', 'materia_prima', 'Cubeta de pintura epóxica 19 L', 'pieza', 10000, 'MXN', null, false, 5, null, '2026-04-22', null),
  ('DEMO-C-022', 'materia_prima', 'Thinner estándar', 'litro', 38, 'MXN', null, false, 1, null, '2026-08-05', null),
  ('DEMO-C-023', 'componente', 'Contactor Square D 3 HP bobina 220 V', 'pieza', null, 'MXN', 'DEMO-PROV-7', false, 5, 0.4, null, null),
  ('DEMO-C-024', 'componente', 'Botonera arranque-paro con paro de emergencia', 'pieza', 640, 'MXN', 'DEMO-PROV-7', false, 3, 0.5, '2026-07-15', null),
  ('DEMO-C-025', 'componente', 'Cable uso rudo 4 x 12 AWG', 'metro', 42, 'MXN', 'DEMO-PROV-7', false, 2, 0.2, '2026-07-15', null),
  ('DEMO-C-026', 'componente', 'Rin 14" con masa y espiga', 'juego', 1550, 'MXN', null, false, 7, 14, '2026-03-11', null),
  ('DEMO-C-027', 'componente', 'Gato cuello de ganso 2 ton', 'pieza', 3200, 'MXN', null, false, 7, 9, '2025-12-01', null),
  ('DEMO-C-028', 'componente', 'Raspador de banda de poliuretano 18"', 'pieza', 95, 'USD', 'DEMO-PROV-4', true, 60, 2.8, '2026-06-30', 'Raspador primario con tensor de resorte. Importado.'),
  ('DEMO-C-029', 'componente', 'Cangilón plástico 6" x 4" HDPE', 'pieza', 4.2, 'USD', 'DEMO-PROV-4', true, 75, 0.3, '2026-06-30', 'Cangilón de polietileno de alta densidad para elevador de granos.'),
  ('DEMO-C-030', 'componente', 'Motovibrador 0.5 HP 1800 rpm', 'pieza', 460, 'EUR', 'DEMO-PROV-5', true, 90, 24, '2026-02-14', null),
  ('DEMO-C-031', 'materia_prima', 'Malla criba acero 1/2" calibre 8', 'm2', 890, 'MXN', 'DEMO-PROV-2', false, 5, 6.5, '2026-08-25', null),
  ('DEMO-C-032', 'componente', 'Celda de carga tipo S de 1 ton', 'pieza', 2400, 'MXN', 'DEMO-PROV-7', false, 10, 0.6, '2026-05-20', null),
  ('DEMO-C-033', 'componente', 'Indicador de peso digital con salida RS-232', 'pieza', 6800, 'MXN', 'DEMO-PROV-7', false, 10, 1.5, '2026-01-15', null),
  ('DEMO-C-034', 'servicio', 'Servicio de vulcanizado de banda', 'servicio', 8500, 'MXN', 'DEMO-PROV-6', false, 3, null, '2026-07-01', null),
  ('DEMO-C-035', 'componente', 'Banda para elevador 3 capas 7" de ancho', 'metro', 640, 'MXN', 'DEMO-PROV-6', false, 4, 2.6, '2026-08-12', null),
  ('DEMO-C-036', 'componente', 'Tornillo para cangilón 1/4" x 1" con tuerca', 'pieza', 3.5, 'MXN', null, false, 2, 0.02, '2026-08-12', null),
  ('DEMO-C-037', 'materia_prima', 'Placa de acero 3/16" de 4 x 8', 'pieza', 4900, 'MXN', 'DEMO-PROV-2', false, 3, 177, '2026-09-10', null),
  ('DEMO-C-038', 'componente', 'Variador de frecuencia 5 HP 220 V', 'pieza', 7800, 'MXN', 'DEMO-PROV-7', false, 8, 3.1, '2025-11-20', null),
  ('DEMO-C-039', 'componente', 'Disco de corte 4 1/2"', 'pieza', 28, 'MXN', null, false, 1, null, '2026-08-05', null);

insert into articulos (clave, tipo, nombre, unidad, descripcion, proveedor_id, es_importado, tiempo_entrega_dias, kg_por_unidad, se_vende)
select d.clave, d.tipo, d.nombre, d.unidad, d.descripcion, p.id, d.importado, d.dias, d.kg, true
from _demo_comp d left join proveedores p on p.legacy_id = d.prov
on conflict (clave) do update set tipo = excluded.tipo, nombre = excluded.nombre, unidad = excluded.unidad,
  descripcion = excluded.descripcion, proveedor_id = excluded.proveedor_id, es_importado = excluded.es_importado,
  tiempo_entrega_dias = excluded.tiempo_entrega_dias, kg_por_unidad = excluded.kg_por_unidad, activo = true;

update articulos set meses_cobertura = 6, stock_minimo_fijo = 4 where clave in ('DEMO-C-028', 'DEMO-C-030');
update articulos set stock_minimo_fijo = 200, empaque = 50 where clave = 'DEMO-C-029';

insert into costos_articulo (articulo_id, costo, moneda, proveedor_id, actualizado_en)
select a.id, d.costo, d.moneda, a.proveedor_id, d.actualizado
from _demo_comp d join articulos a on a.clave = d.clave
where d.costo is not null
on conflict (articulo_id) do update set costo = excluded.costo, moneda = excluded.moneda,
  proveedor_id = excluded.proveedor_id, actualizado_en = excluded.actualizado_en;

-- Historial de costos desde 2023: un cambio cada ~5 meses, con alzas de 4 a
-- 9 % anual según el artículo, terminando en el costo vigente.
delete from historial_costos where articulo_id in (select id from articulos where clave in (select clave from _demo_comp));
insert into historial_costos (articulo_id, costo_anterior, costo_nuevo, moneda, proveedor_id, origen, en)
select articulo_id, lag(costo) over (partition by articulo_id order by en), costo, moneda, proveedor_id, 'importacion', en
from (
  select c.articulo_id, c.moneda, c.proveedor_id, f.en,
    case when f.en::date = c.actualizado_en then c.costo
         else round(c.costo / power(1 + (4 + abs(hashtext(a.clave)) % 6) / 100.0,
                                     extract(epoch from (c.actualizado_en::timestamptz - f.en)) / 31557600.0), 2) end costo
  from costos_articulo c
  join articulos a on a.id = c.articulo_id and a.clave in (select clave from _demo_comp)
  cross join lateral (
    select g en from generate_series('2023-01-10'::timestamptz + (abs(hashtext(a.clave)) % 50) * interval '1 day',
                                     c.actualizado_en::timestamptz - interval '20 days', interval '5 months') g
    union all select c.actualizado_en::timestamptz + interval '10 hours'
  ) f
) x;

-- -----------------------------------------------------------------------------
-- Subensambles y equipos
-- -----------------------------------------------------------------------------
create temp table _demo_fab (clave text, tipo tipo_articulo, nombre text, categoria text, medida boolean, descripcion text) on commit drop;
insert into _demo_fab values
  ('DEMO-SUB-CM18', 'subensamble', 'Cabezal motriz 18" con motorreductor 3 HP', null, false, 'Polea motriz ahulada, chumaceras de piso, motorreductor y cople, sobre base de lámina.'),
  ('DEMO-SUB-TC18', 'subensamble', 'Tambor de cola 18" con tensor', null, false, null),
  ('DEMO-SUB-TAB3', 'subensamble', 'Tablero eléctrico de arranque 3 HP', null, false, null),
  ('DEMO-SUB-REM', 'subensamble', 'Remolque con rines de 14" y gato', null, false, null),
  ('DEMO-E-101', 'equipo', 'Banda transportadora 18" x 20 m', 'Banda Transportadora', false,
   E'• Banda de 18" de ancho y 20 m entre centros\n• Motorreductor de 3 HP trifásico\n• Rodillos de carga a cada 1.2 m\n• Raspador de poliuretano\n• Tablero de arranque con paro de emergencia'),
  ('DEMO-E-102', 'equipo', 'Banda transportadora 18" x 12 m', 'Banda Transportadora', false,
   E'• Banda de 18" de ancho y 12 m entre centros\n• Motorreductor de 3 HP trifásico\n• Rodillos de carga a cada 1.2 m'),
  ('DEMO-E-103', 'equipo', 'Banda cargadora 18" x 13 m con levante y remolque', 'Banda Transportadora', false,
   E'• Tipo cargadora para costales\n• Banda grip top de 20"\n• Remolque con rines de 14" y gato'),
  ('DEMO-E-201', 'equipo', 'Elevador de cangilones 7" x 8 m', 'Elevador', false,
   E'• Altura de descarga 8 m\n• Cangilones de polietileno 6" x 4"\n• Motorreductor de 5 HP con variador'),
  ('DEMO-E-301', 'equipo', 'Cribadora vibratoria de 3 x 6 ft, 2 pisos', 'Cribadora', false,
   E'• Dos motovibradores de 0.5 HP\n• Malla de 1/2" en cada piso'),
  ('DEMO-E-401', 'equipo', 'Tolva de 2.5 m³ con descarga lateral y pesaje', 'Tolva', true,
   E'• Lámina calibre 12\n• Cuatro celdas de carga de 1 ton\n• Indicador digital');

insert into articulos (clave, tipo, nombre, unidad, descripcion, categoria_id, medida_especial, familia, se_vende)
select d.clave, d.tipo, d.nombre, 'pieza', d.descripcion, c.id, d.medida,
       case when d.clave like 'DEMO-E-1%' then 'Banda transportadora 18"' end, true
from _demo_fab d left join categorias c on c.nombre = d.categoria
on conflict (clave) do update set tipo = excluded.tipo, nombre = excluded.nombre, descripcion = excluded.descripcion,
  categoria_id = excluded.categoria_id, medida_especial = excluded.medida_especial, familia = excluded.familia, activo = true;

-- Parámetros
delete from articulo_parametros where articulo_id in (select id from articulos where clave in (select clave from _demo_fab));
insert into articulo_parametros (articulo_id, nombre, valor, unidad, descripcion)
select a.id, p.nombre, p.valor, p.unidad, p.descripcion
from (values
  ('DEMO-E-101', 'largo_m', 20, 'm', 'Largo entre centros'),
  ('DEMO-E-101', 'ancho_pulg', 18, 'pulg', 'Ancho de banda'),
  ('DEMO-E-102', 'largo_m', 12, 'm', 'Largo entre centros'),
  ('DEMO-E-102', 'ancho_pulg', 18, 'pulg', 'Ancho de banda'),
  ('DEMO-E-201', 'altura_m', 8, 'm', 'Altura de descarga'),
  ('DEMO-E-301', 'pisos', 2, null, 'Pisos de malla')
) p(clave, nombre, valor, unidad, descripcion) join articulos a on a.clave = p.clave;

-- Listas de materiales
delete from bom_lineas where padre_id in (select id from articulos where clave in (select clave from _demo_fab));
insert into bom_lineas (padre_id, hijo_id, cantidad, parametro, por_parametro, redondear_arriba, merma, grupo, notas, orden)
select p.id, h.id, l.cantidad, l.parametro, l.por_parametro, l.redondear, l.merma, l.grupo, l.notas, l.orden
from (values
  -- Cabezal motriz
  ('DEMO-SUB-CM18', 'DEMO-C-009', 1, null, 0, false, 0, null, null, 10),
  ('DEMO-SUB-CM18', 'DEMO-C-005', 2, null, 0, false, 0, null, null, 20),
  ('DEMO-SUB-CM18', 'DEMO-C-007', 1, null, 0, false, 0, null, null, 30),
  ('DEMO-SUB-CM18', 'DEMO-C-011', 1, null, 0, false, 0, null, null, 40),
  ('DEMO-SUB-CM18', 'DEMO-C-013', 0.5, null, 0, false, 0, null, 'Base y guarda', 50),
  ('DEMO-SUB-CM18', 'DEMO-C-014', 0.5, null, 0, false, 0, null, null, 60),
  ('DEMO-SUB-CM18', 'DEMO-C-018', 1, null, 0, false, 0, null, null, 70),
  -- Tambor de cola
  ('DEMO-SUB-TC18', 'DEMO-C-010', 1, null, 0, false, 0, null, null, 10),
  ('DEMO-SUB-TC18', 'DEMO-C-006', 2, null, 0, false, 0, null, null, 20),
  ('DEMO-SUB-TC18', 'DEMO-C-013', 0.25, null, 0, false, 0, null, null, 30),
  ('DEMO-SUB-TC18', 'DEMO-C-018', 0.5, null, 0, false, 0, null, null, 40),
  -- Tablero
  ('DEMO-SUB-TAB3', 'DEMO-C-023', 1, null, 0, false, 0, null, null, 10),
  ('DEMO-SUB-TAB3', 'DEMO-C-024', 1, null, 0, false, 0, null, null, 20),
  ('DEMO-SUB-TAB3', 'DEMO-C-025', 10, null, 0, false, 0, null, null, 30),
  -- Remolque
  ('DEMO-SUB-REM', 'DEMO-C-026', 2, null, 0, false, 0, null, null, 10),
  ('DEMO-SUB-REM', 'DEMO-C-027', 1, null, 0, false, 0, null, null, 20),
  ('DEMO-SUB-REM', 'DEMO-C-014', 2, null, 0, false, 0, null, null, 30),
  ('DEMO-SUB-REM', 'DEMO-C-016', 3, null, 0, false, 0, null, null, 40)
) l(padre, hijo, cantidad, parametro, por_parametro, redondear, merma, grupo, notas, orden)
join articulos p on p.clave = l.padre join articulos h on h.clave = l.hijo;

-- Las bandas de 20 y 12 m: la misma lista, las cantidades salen del largo.
insert into bom_lineas (padre_id, hijo_id, cantidad, parametro, por_parametro, redondear_arriba, merma, grupo, notas, orden)
select p.id, h.id, l.cantidad, l.parametro, l.por_parametro, l.redondear, l.merma, l.grupo, l.notas, l.orden
from (values
  ('DEMO-SUB-CM18', 1, null, 0, false, 0, 'Motriz y tensión', null, 10),
  ('DEMO-SUB-TC18', 1, null, 0, false, 0, 'Motriz y tensión', null, 20),
  ('DEMO-C-014', 2, 'largo_m', 0.45, false, 0, 'Estructura', 'Largueros y patas', 30),
  ('DEMO-C-015', 0, 'largo_m', 2.2, false, 0, 'Estructura', 'Travesaños', 40),
  ('DEMO-C-012', 1, 'largo_m', 0.2, false, 0, 'Estructura', 'Cama y guardas', 50),
  ('DEMO-C-018', 2, null, 0, false, 0, 'Estructura', null, 60),
  ('DEMO-C-001', 1.5, 'largo_m', 2, false, 0, 'Banda y rodillos', '2 m por metro de largo + 1.5 m de empalme', 70),
  ('DEMO-C-003', 0, 'largo_m', 0.83, true, 0, 'Banda y rodillos', 'Uno cada 1.2 m', 80),
  ('DEMO-C-004', 0, 'largo_m', 0.34, true, 0, 'Banda y rodillos', 'Uno cada 3 m', 90),
  ('DEMO-C-028', 1, null, 0, false, 0, 'Banda y rodillos', null, 100),
  ('DEMO-C-034', 1, null, 0, false, 0, 'Banda y rodillos', null, 110),
  ('DEMO-SUB-TAB3', 1, null, 0, false, 0, 'Eléctrico', null, 120),
  ('DEMO-C-019', 4, 'largo_m', 0.6, false, 0.05, 'Consumibles y acabado', null, 130),
  ('DEMO-C-020', 0.3, 'largo_m', 0.02, false, 0, 'Consumibles y acabado', null, 140),
  ('DEMO-C-021', 0.2, 'largo_m', 0.015, false, 0, 'Consumibles y acabado', null, 150),
  ('DEMO-C-022', 4, 'largo_m', 0.2, false, 0, 'Consumibles y acabado', null, 160)
) l(hijo, cantidad, parametro, por_parametro, redondear, merma, grupo, notas, orden)
cross join (select id from articulos where clave in ('DEMO-E-101', 'DEMO-E-102')) p
join articulos h on h.clave = l.hijo;

-- La cargadora viene "plana", como en la hoja: el cabezal motriz está repetido
-- línea por línea (polea, chumaceras, motorreductor, cople, lámina, PTR, tornillería).
insert into bom_lineas (padre_id, hijo_id, cantidad, parametro, por_parametro, redondear_arriba, merma, grupo, notas, orden)
select p.id, h.id, l.cantidad, null, 0, false, 0, null, l.notas, l.orden
from (values
  ('DEMO-C-009', 1, null, 10), ('DEMO-C-005', 2, null, 20), ('DEMO-C-007', 1, null, 30), ('DEMO-C-011', 1, null, 40),
  ('DEMO-C-013', 0.5, null, 50), ('DEMO-C-014', 0.5, null, 60), ('DEMO-C-018', 1, null, 70),
  ('DEMO-SUB-TC18', 1, null, 80), ('DEMO-SUB-REM', 1, null, 90),
  ('DEMO-C-002', 27, null, 100), ('DEMO-C-003', 16, null, 110), ('DEMO-C-004', 7, null, 120),
  ('DEMO-C-014', 4.5, 'Estructura y levante', 130), ('DEMO-C-012', 5.5, null, 140), ('DEMO-C-015', 18, null, 150),
  ('DEMO-SUB-TAB3', 1, null, 160),
  ('DEMO-C-019', 12, null, 170), ('DEMO-C-020', 0.6, null, 180), ('DEMO-C-021', 0.6, null, 190), ('DEMO-C-022', 8, null, 200),
  ('DEMO-C-039', 10, null, 210)
) l(hijo, cantidad, notas, orden)
cross join (select id from articulos where clave = 'DEMO-E-103') p
join articulos h on h.clave = l.hijo;

insert into bom_lineas (padre_id, hijo_id, cantidad, parametro, por_parametro, redondear_arriba, merma, grupo, notas, orden)
select p.id, h.id, l.cantidad, l.parametro, l.por_parametro, l.redondear, 0, l.grupo, l.notas, l.orden
from (values
  ('DEMO-E-201', 'DEMO-C-008', 1, null, 0, false, 'Cabeza', null, 10),
  ('DEMO-E-201', 'DEMO-C-009', 1, null, 0, false, 'Cabeza', null, 20),
  ('DEMO-E-201', 'DEMO-C-005', 2, null, 0, false, 'Cabeza', null, 30),
  ('DEMO-E-201', 'DEMO-C-011', 1, null, 0, false, 'Cabeza', null, 40),
  ('DEMO-E-201', 'DEMO-C-010', 1, null, 0, false, 'Bota', null, 50),
  ('DEMO-E-201', 'DEMO-C-006', 2, null, 0, false, 'Bota', null, 60),
  ('DEMO-E-201', 'DEMO-C-035', 0.5, 'altura_m', 2, false, 'Banda y cangilones', null, 70),
  ('DEMO-E-201', 'DEMO-C-029', 0, 'altura_m', 6.5, true, 'Banda y cangilones', 'Paso de 12"', 80),
  ('DEMO-E-201', 'DEMO-C-036', 0, 'altura_m', 13, true, 'Banda y cangilones', 'Dos por cangilón', 90),
  ('DEMO-E-201', 'DEMO-C-013', 4, 'altura_m', 0.8, false, 'Estructura', 'Ductos y cabeza', 100),
  ('DEMO-E-201', 'DEMO-C-017', 0, 'altura_m', 2, false, 'Estructura', null, 110),
  ('DEMO-E-201', 'DEMO-C-018', 3, null, 0, false, 'Estructura', null, 120),
  ('DEMO-E-201', 'DEMO-C-038', 1, null, 0, false, 'Eléctrico', null, 130),
  ('DEMO-E-201', 'DEMO-C-024', 1, null, 0, false, 'Eléctrico', null, 140),
  ('DEMO-E-201', 'DEMO-C-025', 15, null, 0, false, 'Eléctrico', null, 150),
  ('DEMO-E-201', 'DEMO-C-019', 6, 'altura_m', 0.8, false, 'Consumibles y acabado', null, 160),
  ('DEMO-E-201', 'DEMO-C-021', 0.3, 'altura_m', 0.03, false, 'Consumibles y acabado', null, 170),
  ('DEMO-E-301', 'DEMO-C-030', 2, null, 0, false, 'Vibración', null, 10),
  ('DEMO-E-301', 'DEMO-C-031', 0.2, 'pisos', 1.7, false, 'Mallas', '1.7 m² por piso + recorte', 20),
  ('DEMO-E-301', 'DEMO-C-013', 4, null, 0, false, 'Caja', null, 30),
  ('DEMO-E-301', 'DEMO-C-014', 3, null, 0, false, 'Bastidor', null, 40),
  ('DEMO-E-301', 'DEMO-C-015', 12, null, 0, false, 'Bastidor', null, 50),
  ('DEMO-E-301', 'DEMO-C-018', 2, null, 0, false, 'Bastidor', null, 60),
  ('DEMO-E-301', 'DEMO-SUB-TAB3', 1, null, 0, false, 'Eléctrico', 'Arranque de los dos motovibradores', 70),
  ('DEMO-E-301', 'DEMO-C-019', 8, null, 0, false, 'Consumibles y acabado', null, 80),
  ('DEMO-E-301', 'DEMO-C-021', 0.4, null, 0, false, 'Consumibles y acabado', null, 90),
  ('DEMO-E-401', 'DEMO-C-013', 6, null, 0, false, 'Cuerpo', null, 10),
  ('DEMO-E-401', 'DEMO-C-037', 1, null, 0, false, 'Cuerpo', 'Compuerta lateral', 20),
  ('DEMO-E-401', 'DEMO-C-014', 3, null, 0, false, 'Estructura', null, 30),
  ('DEMO-E-401', 'DEMO-C-032', 4, null, 0, false, 'Pesaje', null, 40),
  ('DEMO-E-401', 'DEMO-C-033', 1, null, 0, false, 'Pesaje', null, 50),
  ('DEMO-E-401', 'DEMO-C-018', 2, null, 0, false, 'Estructura', null, 60),
  ('DEMO-E-401', 'DEMO-C-019', 10, null, 0, false, 'Consumibles y acabado', null, 70),
  ('DEMO-E-401', 'DEMO-C-021', 0.5, null, 0, false, 'Consumibles y acabado', null, 80),
  ('DEMO-E-401', 'DEMO-C-022', 6, null, 0, false, 'Consumibles y acabado', null, 90)
) l(padre, hijo, cantidad, parametro, por_parametro, redondear, grupo, notas, orden)
join articulos p on p.clave = l.padre join articulos h on h.clave = l.hijo;

-- Horas por etapa
delete from bom_operaciones where articulo_id in (select id from articulos where clave in (select clave from _demo_fab));
insert into bom_operaciones (articulo_id, etapa_id, horas, parametro, horas_por_parametro)
select a.id, e.id, o.horas, o.parametro, o.hpp
from (values
  ('DEMO-SUB-CM18', 'Corte', 1, null, 0), ('DEMO-SUB-CM18', 'Pailería', 14, null, 0), ('DEMO-SUB-CM18', 'Torno', 4, null, 0),
  ('DEMO-SUB-TC18', 'Pailería', 6, null, 0), ('DEMO-SUB-TC18', 'Torno', 2, null, 0),
  ('DEMO-SUB-TAB3', 'Eléctrico', 3, null, 0),
  ('DEMO-SUB-REM', 'Pailería', 12, null, 0), ('DEMO-SUB-REM', 'Pintura', 3, null, 0),
  ('DEMO-E-101', 'Corte', 4, 'largo_m', 0.2), ('DEMO-E-101', 'Pailería', 40, 'largo_m', 3), ('DEMO-E-101', 'Pintura', 8, 'largo_m', 0.6),
  ('DEMO-E-101', 'Detallado', 6, 'largo_m', 0.2), ('DEMO-E-101', 'Pruebas', 2, null, 0),
  ('DEMO-E-102', 'Corte', 4, 'largo_m', 0.2), ('DEMO-E-102', 'Pailería', 40, 'largo_m', 3), ('DEMO-E-102', 'Pintura', 8, 'largo_m', 0.6),
  ('DEMO-E-102', 'Detallado', 6, 'largo_m', 0.2), ('DEMO-E-102', 'Pruebas', 2, null, 0),
  ('DEMO-E-103', 'Pailería', 195, null, 0), ('DEMO-E-103', 'Torno', 22, null, 0), ('DEMO-E-103', 'Pintura', 40, null, 0),
  ('DEMO-E-201', 'Corte', 6, 'altura_m', 0.5), ('DEMO-E-201', 'Pailería', 60, 'altura_m', 6), ('DEMO-E-201', 'Torno', 6, null, 0),
  ('DEMO-E-201', 'Pintura', 10, 'altura_m', 1), ('DEMO-E-201', 'Eléctrico', 4, null, 0), ('DEMO-E-201', 'Pruebas', 3, null, 0),
  ('DEMO-E-301', 'Pailería', 70, null, 0), ('DEMO-E-301', 'Torno', 4, null, 0), ('DEMO-E-301', 'Pintura', 12, null, 0),
  ('DEMO-E-301', 'Detallado', 8, null, 0), ('DEMO-E-301', 'Eléctrico', 3, null, 0),
  ('DEMO-E-401', 'Pailería', 130, null, 0), ('DEMO-E-401', 'Pintura', 20, null, 0), ('DEMO-E-401', 'Detallado', 10, null, 0),
  ('DEMO-E-401', 'Eléctrico', 4, null, 0), ('DEMO-E-401', 'Pruebas', 3, null, 0)
) o(clave, etapa, horas, parametro, hpp)
join articulos a on a.clave = o.clave join etapas e on e.nombre = o.etapa;

-- -----------------------------------------------------------------------------
-- Historial de costeo de los fabricados
-- -----------------------------------------------------------------------------
-- 2023–2024: reconstruido (lista de materiales de hoy × costos de cada mes).
-- 2025 en adelante: fotos "reales" como las que irá dejando el ERP, con la
-- utilidad que regía cada mes. Así la gráfica muestra lo que pidió el dueño:
-- cuánto subió el precio por costos y cuánto por decisiones de utilidad.
delete from historial_costeo where articulo_id in (select id from articulos where clave in (select clave from _demo_fab));

with recursive arbol(raiz, id, cant) as (
  select a.id, a.id, 1::numeric from articulos a where a.clave in (select clave from _demo_fab)
  union all
  select arbol.raiz, b.hijo_id, arbol.cant * cantidad_linea(b) from arbol join bom_lineas b on b.padre_id = arbol.id
),
hojas as (
  select arbol.raiz fabricado, arbol.id hoja, sum(arbol.cant) cantidad
  from arbol join articulos h on h.id = arbol.id
  where h.tipo in ('componente', 'materia_prima', 'servicio') group by 1, 2
),
meses as (
  select generate_series('2023-01-01'::date, (date_trunc('month', now()) - interval '1 month')::date, interval '1 month')::date mes
),
costo_mes as (
  select m.mes, h.hoja, hc.costo
  from meses m cross join (select distinct hoja from hojas) h
  cross join lateral (select costo_nuevo * tc(moneda) costo from historial_costos
                      where articulo_id = h.hoja and en < m.mes + interval '1 month' order by en desc limit 1) hc
),
mensual as (
  select h.fabricado, cm.mes, sum(h.cantidad * cm.costo) material, count(*) n,
         (select count(*) from hojas x where x.fabricado = h.fabricado) total
  from hojas h join costo_mes cm on cm.hoja = h.hoja group by h.fabricado, cm.mes
),
-- Utilidad que regía en cada fecha (las de hoy son las de politicas_precio).
utilidades(politica, hasta, utilidad) as (values
  ('Banda Transportadora', '2025-08-31'::date, 0.30),
  ('Elevador', '2026-02-28'::date, 0.32),
  ('Cribadora', '2025-10-31'::date, 0.30)
),
serie as (
  select m.fabricado, a.medida_especial, m.mes, (m.mes + interval '1 month' - interval '1 second') en,
    round(m.material, 4) material, cc.costo_mano_obra mo, round(m.material + cc.costo_mano_obra, 4) costo,
    politica_de(m.fabricado) pol,
    coalesce((select u.utilidad from utilidades u join politicas_precio pp on pp.nombre = u.politica
              where pp.id = politica_de(m.fabricado) and m.mes <= u.hasta), (select utilidad from politicas_precio where id = politica_de(m.fabricado))) utilidad
  from mensual m join costos_calculados cc on cc.articulo_id = m.fabricado join articulos a on a.id = m.fabricado
  where m.n >= 0.9 * m.total
),
con_cambio as (
  select s.*, lag(s.costo) over (partition by s.fabricado order by s.mes) costo_ant,
              lag(s.utilidad) over (partition by s.fabricado order by s.mes) util_ant
  from serie s
)
insert into historial_costeo (articulo_id, en, costo_material, costo_mano_obra, costo_total, precio_lista, politica_id, utilidad, factor, reconstruido)
select fabricado, en, material, mo, costo,
  case when mes >= '2025-01-01' then precio_desde_costo(costo, pol, utilidad, medida_especial) end,
  case when mes >= '2025-01-01' then pol end,
  case when mes >= '2025-01-01' then utilidad end,
  case when mes >= '2025-01-01' and costo > 0 then round(precio_sin_redondeo(costo, pol, utilidad, medida_especial) / costo, 6) end,
  mes < '2025-01-01'
from con_cambio
where mes < '2025-01-01' or costo_ant is null or costo is distinct from costo_ant or utilidad is distinct from util_ant
   or mes = '2025-01-01';

-- La foto de hoy, para que la serie termine en el costo y precio vigentes.
insert into historial_costeo (articulo_id, en, costo_material, costo_mano_obra, costo_total, precio_lista, politica_id, utilidad, factor)
select cc.articulo_id, now(), cc.costo_material, cc.costo_mano_obra, cc.costo_total, pl.precio, pol.id, coalesce(c.margen, pol.utilidad),
       case when cc.costo_total > 0 then precio_sin_redondeo(cc.costo_total, pol.id, c.margen, a.medida_especial) / cc.costo_total end
from costos_calculados cc
join articulos a on a.id = cc.articulo_id and a.clave in (select clave from _demo_fab)
left join precios_lista pl on pl.articulo_id = cc.articulo_id
left join costos_articulo c on c.articulo_id = cc.articulo_id
left join politicas_precio pol on pol.id = politica_de(cc.articulo_id);

-- -----------------------------------------------------------------------------
-- Existencias, publicaciones y solicitudes de producción
-- -----------------------------------------------------------------------------
insert into existencias (articulo_id, almacen_id, cantidad)
select a.id, al.id, e.cantidad
from (values
  ('DEMO-C-001', 'Planta Baja', 64), ('DEMO-C-003', 'Planta Baja', 120), ('DEMO-C-003', 'Mallado', 36),
  ('DEMO-C-004', 'Planta Baja', 45), ('DEMO-C-005', 'Planta Alta', 18), ('DEMO-C-005', 'Almacén ML (Full)', 6),
  ('DEMO-C-006', 'Planta Alta', 9), ('DEMO-C-007', 'Contenedor 1', 2), ('DEMO-C-009', 'Contenedor 1', 3),
  ('DEMO-C-012', 'Mallado', 22), ('DEMO-C-013', 'Mallado', 15), ('DEMO-C-014', 'Mallado', 31),
  ('DEMO-C-028', 'Planta Alta', 3), ('DEMO-C-028', 'Almacén ML (Full)', 8), ('DEMO-C-029', 'Contenedor 2', 420),
  ('DEMO-C-029', 'Almacén ML (Full)', 150), ('DEMO-C-030', 'Contenedor 2', 1), ('DEMO-C-032', 'Planta Alta', 4),
  ('DEMO-C-036', 'Planta Alta', 900), ('DEMO-C-039', 'Revolución', 75)
) e(clave, almacen, cantidad)
join articulos a on a.clave = e.clave join almacenes al on al.nombre = e.almacen
on conflict (articulo_id, almacen_id) do update set cantidad = excluded.cantidad, actualizado_en = now();

insert into publicaciones (articulo_id, canal, id_externo, titulo, url, precio, con_envio, piezas_por_paquete, stock_publicado, estado)
select a.id, p.canal::canal_venta, p.id_externo, p.titulo, p.url, p.precio, p.envio, p.piezas, p.stock, p.estado
from (values
  ('DEMO-C-028', 'mercadolibre', 'DEMO-MLM-2287001', 'Raspador De Banda Transportadora Poliuretano 18 Pulgadas', 'https://articulo.mercadolibre.com.mx/DEMO-MLM-2287001', 3890.00, true, 1, 8, 'activa'),
  ('DEMO-C-028', 'sitio_web', 'DEMO-WEB-RASP18', 'Raspador de banda de poliuretano 18"', 'https://hegamex.com/productos/raspador-18', 3590.00, false, 1, null, 'activa'),
  ('DEMO-C-029', 'mercadolibre', 'DEMO-MLM-2287002', 'Cangilón Plástico 6x4 Elevador De Granos Paquete 10 Pzas', 'https://articulo.mercadolibre.com.mx/DEMO-MLM-2287002', 1290.00, true, 10, 150, 'activa'),
  ('DEMO-C-005', 'mercadolibre', 'DEMO-MLM-2287003', 'Chumacera De Piso Ucp207 1 7/16', 'https://articulo.mercadolibre.com.mx/DEMO-MLM-2287003', 899.00, false, 1, 6, 'pausada')
) p(clave, canal, id_externo, titulo, url, precio, envio, piezas, stock, estado)
join articulos a on a.clave = p.clave
on conflict (canal, id_externo) do update set titulo = excluded.titulo, precio = excluded.precio, con_envio = excluded.con_envio,
  piezas_por_paquete = excluded.piezas_por_paquete, stock_publicado = excluded.stock_publicado, estado = excluded.estado;

delete from solicitudes_cambio_bom
where articulo_id in (select id from articulos where clave in (select clave from _demo_fab union select clave from _demo_comp));
insert into solicitudes_cambio_bom (articulo_id, descripcion, solicitado_por, solicitado_en)
select a.id, s.descripcion, (select id from perfiles where correo = 'gerente.produccion@hegamex.com'), now() - s.hace
from (values
  ('DEMO-E-103', 'Los rodillos de carga de la cargadora son de 14" de ancho, no de 20". Se cambiaron en la orden pasada.', interval '2 days'),
  ('DEMO-E-201', 'Faltan 4 tornillos de cabeza de arado por cangilón en la lista; se surtieron fuera de lista.', interval '6 hours'),
  ('DEMO-SUB-TC18', 'El tensor lleva solera de 2" x 1/4" (60 cm) para las guías; no viene en la lista.', interval '9 days')
) s(clave, descripcion, hace)
join articulos a on a.clave = s.clave;

commit;

select tipo, count(*) articulos from articulos
where clave ~ '^DEMO-(C-0\d\d|SUB-(CM18|TC18|TAB3|REM)|E-[1-4]0\d)$' group by tipo order by tipo;

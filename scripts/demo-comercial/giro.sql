-- =============================================================================
-- Cambia el giro de la base de demostración: de maquinaria para manejo de materiales (lo que hace
-- Hegamex) a REMOLQUES Y CARROCERÍAS (cajas secas, plataformas, góndolas, camas bajas, remolques
-- agrícolas y ganaderos, pipas).
--
-- Por qué: los scripts de scripts/demo/* se escribieron con el catálogo de Hegamex (bandas,
-- cangilones, dosificadoras Zeus, Pailería…). Con otro nombre seguía siendo Hegamex: cualquiera
-- que conozca la empresa la reconoce. Un remolque se fabrica igual (lista de materiales, corte,
-- soldadura, pintura, ensamble), así que todas las pantallas siguen teniendo sentido.
--
-- Va después de los scripts de scripts/demo/* y ANTES de historial.sql (que inventa el libro de
-- ventas con productos de remolques y necesita estas familias) y del maquillaje. Por clave DEMO-…:
--   psql "$DB_URL" -v ON_ERROR_STOP=1 -f scripts/demo-comercial/giro.sql
-- Apaga los disparadores mientras renombra (como el maquillaje): movimientos y bitácora son
-- inalterables, y un renombre no es algo que alguien haya hecho.
-- =============================================================================
begin;

do $$
begin
  if exists (select 1 from public.clientes where legacy_ref like 'CLI:%') then
    raise exception 'Esta base tiene datos importados de las hojas reales: el cambio de giro es solo para la demostración';
  end if;
end $$;

set local session_replication_role = replica;

-- ---------------------------------------------------------------------------
-- 1. Artículos: clave DEMO-… → nombre (y descripción) de remolques. Lo genérico no está aquí.
-- ---------------------------------------------------------------------------
create temp table _art (clave text primary key, nombre text not null, descripcion text) on commit drop;
insert into _art values
  -- Equipos
  ('DEMO-E-005', 'Remolque agrícola de volteo de 8 t', null),
  ('DEMO-E-041', 'Remolque forrajero de 12 t', null),
  ('DEMO-E-069', 'Pipa de 30,000 L de acero inoxidable con bomba y medidor', null),
  ('DEMO-E-101', 'Plataforma de 30 ft con laterales abatibles', null),
  ('DEMO-E-102', 'Dolly convertidor de 2 ejes', null),
  ('DEMO-E-103', 'Plataforma de 28 ft con rampas', null),
  ('DEMO-E-121', 'Góndola de 14 m³ con volteo hidráulico', null),
  ('DEMO-E-123', 'Caja refrigerada de 53 ft con equipo de frío', null),
  ('DEMO-E-125', 'Pipa de 36,000 L para combustible', null),
  ('DEMO-E-139', 'Remolque jaula para pacas', null),
  ('DEMO-E-163', 'Remolque ganadero de 1 piso', null),
  ('DEMO-E-187', 'Remolque granelero de 40 t', null),
  ('DEMO-E-198', 'Cama baja de 50 t de 3 ejes', null),
  ('DEMO-E-201', 'Remolque cañero de 2 ejes', null),
  ('DEMO-E-208', 'Caja refrigerada de 40 ft', null),
  ('DEMO-E-215', 'Cama baja modular de 70 t', null),
  ('DEMO-E-289', 'Cama baja de 80 t extensible', null),
  ('DEMO-E-301', 'Remolque utilitario de 2.5 t', null),
  ('DEMO-E-303', 'Caja refrigerada de 48 ft', null),
  ('DEMO-E-309', 'Remolque utilitario de 3.5 t', null),
  ('DEMO-E-369', 'Cama baja de 60 t con suspensión de aire', null),
  ('DEMO-E-388', 'Caja seca de 28 ft', null),
  ('DEMO-E-393', 'Cama baja de 60 t de 4 ejes', null),
  ('DEMO-E-395', 'Pipa de 30,000 L para químicos', null),
  ('DEMO-E-401', 'Remolque para lancha de 24 ft', null),
  ('DEMO-E-471', 'Remolque granelero de 45 t de aluminio', null),
  ('DEMO-E-TREN4', 'Full de góndolas (2 cajas y dolly)', null),
  ('DEMO-EQ-BT18-10', 'Remolque para maquinaria de 10 t', null),
  ('DEMO-EQ-BT18-6', 'Remolque de caja cerrada de 12 ft', null),
  ('DEMO-EQ-ELV-10', 'Remolque de caja abierta de 14 ft', null),
  ('DEMO-SP-ZAR6', 'Pipa de agua de 10,000 L',
     E'• Tanque de acero al carbón de 10,000 L con rompeolas\n• Bomba de 3" con motor a gasolina\n• Suspensión de aire en 2 ejes'),
  -- Subensambles
  ('DEMO-SUB-CM18', 'Chasis de 40 ft con travesaños', null),
  ('DEMO-SUB-REM',  'Tren de rodaje de 2 ejes con rines de 22.5"', null),
  ('DEMO-SUB-TAB3', 'Arnés eléctrico con luces LED', null),
  ('DEMO-SUB-TC18', 'Puerta trasera abatible con herrajes', null),
  -- Componentes
  ('DEMO-AER-OLI', 'Válvula relevadora de aire', null),
  ('DEMO-BAN-18',  'Lona de cubierta de 18 oz', null),
  ('DEMO-BAN-24',  'Hule antiderrapante para piso', null),
  ('DEMO-C-001',   'Lámina de aluminio para costado', null),
  ('DEMO-C-00142', 'Perno rey de 2"', null),
  ('DEMO-C-002',   'Duela de madera dura para piso', null),
  ('DEMO-C-003',   'Guía para puerta cortina', null),
  ('DEMO-C-004',   'Travesaño de aluminio de 4"', null),
  ('DEMO-C-00420', 'Plafón LED ámbar', null),
  ('DEMO-C-00423', 'Remache de aluminio 1/4" (caja de 500)', null),
  ('DEMO-C-00482', 'Lona de cubierta de 22 oz', null),
  ('DEMO-C-005',   'Balero de rueda cónico 6205', null),
  ('DEMO-C-006',   'Matraca de ajuste automático', null),
  ('DEMO-C-007',   'Patín de aterrizaje de 2 velocidades', null),
  ('DEMO-C-00783', 'Sensor de carga por eje', null),
  ('DEMO-C-008',   'Bomba hidráulica de volteo', null),
  ('DEMO-C-00864', 'Bisagra de acero inoxidable (juego)', null),
  ('DEMO-C-009',   'Tambor de freno de 16.5"', null),
  ('DEMO-C-010',   'Maza de rueda con birlos', null),
  ('DEMO-C-011',   'Manita de aire (gladhand)', null),
  ('DEMO-C-023',   'Relevador para luces de 24 V', null),
  ('DEMO-C-024',   'Control de volteo con paro de emergencia', null),
  ('DEMO-C-025',   'Cable de 7 hilos para remolque', null),
  ('DEMO-C-026',   'Rin de acero de 22.5"', null),
  ('DEMO-C-027',   'Cilindro hidráulico telescópico', null),
  ('DEMO-C-028',   'Loderas de hule (par)', null),
  ('DEMO-C-029',   'Calavera LED trasera', null),
  ('DEMO-C-030',   'Compresor de aire de 24 V', null),
  ('DEMO-C-031',   'Malla de acero de 1/2" calibre 8', null),
  ('DEMO-C-032',   'Báscula de eje de 1 t', null),
  ('DEMO-C-033',   'Indicador de presión de llantas', null),
  ('DEMO-C-035',   'Bolsa de aire para suspensión', null),
  ('DEMO-C-036',   'Birlo con tuerca de 7/8"', null),
  ('DEMO-C-038',   'Sistema ABS para remolque', null),
  ('DEMO-C-CHUM',  'Perno rey de 2" (refacción)', null),
  ('DEMO-C-MOT',   'Eje de 25,000 lb', null),
  ('DEMO-C-N1637', 'Suspensión neumática de 2 ejes', null),
  ('DEMO-C-N2341', 'Cámara de freno 30/30', null),
  ('DEMO-C-PINT',  'Esmalte poliuretano blanco', null),
  ('DEMO-CAD-40',  'Cadena de seguridad grado 70', null),
  ('DEMO-CAN-43',  'Plafón LED lateral de 2"', null),
  ('DEMO-CAN-54',  'Plafón LED lateral de 4"', null),
  ('DEMO-CAN-65',  'Calavera LED de 6"', null),
  ('DEMO-CAT-40',  'Engrane para patín de aterrizaje', null),
  ('DEMO-CHU-205', 'Balero cónico 6205', null),
  ('DEMO-CHU-206', 'Balero cónico 6206', null),
  ('DEMO-CHU-208', 'Balero cónico 6208', null),
  ('DEMO-COL-14',  'Suspensión mecánica de muelles para 3 ejes', null),
  ('DEMO-ENV-C-00007', 'Rótula de dirección', null),
  ('DEMO-ENV-C-00173', 'Tambor de freno de 15"', null),
  ('DEMO-ENV-C-00175', 'Ajustador de holgura', null),
  ('DEMO-ENV-C-00382', 'Calavera LED redonda de 4"', null),
  ('DEMO-ENV-C-00393', 'Kit de lonas laterales', null),
  ('DEMO-ENV-C-00394', 'Kit de conversión a luces LED', null),
  ('DEMO-ENV-C-N0245', 'Tuerca de birlo (caja de 50)', null),
  ('DEMO-GRA-125', 'Bisagras de puerta (caja)', null),
  ('DEMO-IMP-191FF6', 'Rampa de aluminio plegable', null),
  ('DEMO-IMP-1BFEC6', 'Cámara de freno doble 30/30 modelo SC3030', null),
  ('DEMO-IMP-425CC8', 'Módulo ABS 2S/1M', null),
  ('DEMO-IMP-50AA01', 'Colgante de suspensión', null),
  ('DEMO-IMP-60A6A0', 'Sensor de presión de suspensión', null),
  ('DEMO-IMP-6D3767', 'Rin de aluminio de 22.5" pulido', null),
  ('DEMO-IMP-80E5E5', 'Rin de acero de 22.5" blanco', null),
  ('DEMO-IMP-81A440', 'Eje direccional de 20,000 lb', null),
  ('DEMO-IMP-8CB189', 'Quinta rueda de 2"', null),
  ('DEMO-IMP-9AB263', 'Cilindro de volteo telescópico de 5 etapas', null),
  ('DEMO-IMP-CA32DF', 'Buje de muelle', null),
  ('DEMO-IMP-CA991D', 'Eje de 30,000 lb con frenos de disco', null),
  ('DEMO-IMP-E2B0CA', 'Llanta 11R22.5', null),
  ('DEMO-IMP-E2C634', 'Caja de conexiones eléctricas de 7 vías', null),
  ('DEMO-IMP-EA494F', 'Eje de 25,000 lb con frenos de tambor', null),
  ('DEMO-IMP-FC9564', 'Puerta cortina de aluminio', null),
  ('DEMO-MOT-2',   'Motor de 12 V para lona corrediza', null),
  ('DEMO-MR-15',   'Válvula niveladora de altura (importada)', null),
  ('DEMO-MR-3',    'Válvula de emergencia SR-5 (importada)', null),
  ('DEMO-POL-8',   'Tambor de freno de 16.5" ventilado', null),
  ('DEMO-ROD-418', 'Travesaño de acero de 4"', null),
  ('DEMO-ROD-RET', 'Travesaño de acero de 6"', null),
  ('DEMO-SP-CANG', 'Calavera LED de 9"', null),
  ('DEMO-SP-CAT',  'Rótula de barra de dirección', null),
  ('DEMO-SP-MALLA','Malla antiderrapante de acero', null),
  ('DEMO-TEN-1',   'Tensor de lona (matraca)', null),
  ('DEMO-TOR-CAN', 'Tornillo de cabeza de coche 1/2"', null),
  ('DEMO-C-00517', 'Servicio de instalación de caja en chasis', null),
  ('DEMO-C-034',   'Servicio de alineación y balanceo', null);

-- Lo que decía cada artículo, para cambiarlo también donde se copió (partidas, órdenes, avisos…).
create temp table _lit (viejo text primary key, nuevo text not null) on commit drop;
insert into _lit
select a.nombre, x.nombre from public.articulos a join _art x on x.clave = a.clave where a.nombre <> x.nombre
on conflict do nothing;
-- Cuando se imprimió el nombre sin "(demo)" o sin el sufijo de la marca, también.
insert into _lit
select btrim(regexp_replace(a.nombre, '\s*(\(demo\)|- Hegamex®)\s*$', '')), x.nombre
from public.articulos a join _art x on x.clave = a.clave
where a.nombre ~ '(\(demo\)|- Hegamex®)\s*$'
on conflict do nothing;

update public.articulos a set nombre = x.nombre, descripcion = coalesce(x.descripcion, case when a.descripcion ~* '(banda|cangil|tolva|silo|criba|dosific|elevador|colector|cosedora|celda|helicoidal|bazuca)' then null else a.descripcion end)
from _art x where x.clave = a.clave;

-- ---------------------------------------------------------------------------
-- 2. Lo que organiza el catálogo y el taller (antes de las frases sueltas: aquí se busca por el
--    nombre de antes).
-- ---------------------------------------------------------------------------
-- Etapas del taller de remolques (mismos id: las órdenes y listas de materiales las usan).
update public.etapas set nombre = x.n from (values
  (1, 'Corte'), (2, 'Soldadura'), (3, 'Maquinado'), (4, 'Pintura'), (5, 'Ensamble'), (6, 'Eléctrico'),
  (7, 'Calidad'), (8, 'Embarque')) x(id, n) where etapas.id = x.id;
-- Un taller de remolques de buen tamaño: con la capacidad de Hegamex el plan acababa en abril de 2027.
update public.etapas set capacidad_horas_semana = x.h from (values
  (1, 180), (2, 1000), (3, 180), (4, 220), (5, 300), (6, 120), (7, 90), (8, 90)) x(id, h) where etapas.id = x.id;

-- Tipos de equipo y sus políticas de precio. "ESPECIAL CEMEX" era un cliente real.
update public.categorias set nombre = x.n from (values
  ('Banda Transportadora', 'Plataforma'), ('Bazuca', 'Caja seca'), ('Cribadora', 'Remolque utilitario'),
  ('Dosificadora', 'Cama baja'), ('Silo para Cemento', 'Pipa'), ('Tolva', 'Remolque recreativo'),
  ('Mezcladora', 'Remolque agrícola'), ('Elevador', 'Remolque cañero'), ('ESPECIAL CEMEX', 'Especial flotillas')) x(a, n)
where categorias.nombre = x.a;
update public.politicas_precio set nombre = x.n from (values
  ('Banda Transportadora', 'Plataforma'), ('Bazuca', 'Caja seca'), ('Cribadora', 'Remolque utilitario'),
  ('Dosificadora', 'Cama baja'), ('Silo para Cemento', 'Pipa'), ('Tolva', 'Remolque recreativo'),
  ('Mezcladora', 'Remolque agrícola'), ('Elevador', 'Remolque cañero'), ('ESPECIAL CEMEX', 'Especial flotillas')) x(a, n)
where politicas_precio.nombre = x.a;

-- Familias de venta: la clave es interna (el libro y las reglas la usan); el nombre es lo que se ve.
update public.familias_venta set nombre = x.n from (values
  ('bandas', 'Cajas secas y refrigeradas'), ('dosificadoras', 'Plataformas y camas bajas'),
  ('banda_hule', 'Llantas, rines y lonas'), ('helicoidales', 'Remolques agrícolas y cañeros'),
  ('tolvas_silos', 'Pipas y tanques'), ('cribas', 'Góndolas'), ('elevadores', 'Remolques ganaderos'),
  ('colectores', 'Ejes y suspensiones'), ('poleas', 'Frenos y refacciones de rodaje'),
  ('cosedoras', 'Iluminación y eléctrico'), ('servicio', 'Servicio, fletes e instalación'), ('otros', 'Otros')) x(c, n)
where familias_venta.clave = x.c;

-- Las reglas que reconocen la familia por el texto de la venta, para el vocabulario nuevo.
delete from public.reglas_familia_venta;
insert into public.reglas_familia_venta (patron, familia, prioridad, activo, nota)
select x.p, x.f, x.o, true, 'Demostración: remolques' from (values
  ('\m(servicio|instalaci[oó]n|reparaci[oó]n|alineaci[oó]n|balanceo|flete|mano de obra)', 'servicio', 10),
  ('\m(cama baja|plataforma)', 'dosificadoras', 20),
  ('\m(ca[nñ]ero|agr[ií]cola|forrajero|pacas)', 'helicoidales', 22),
  ('\m(pipa|tanque)', 'tolvas_silos', 24),
  ('\mganader', 'elevadores', 26),
  ('\mg[oó]ndola', 'cribas', 28),
  ('\m(caja seca|caja refrigerada|caja t[eé]rmica|remolque|dolly)', 'bandas', 40),
  ('\m(llanta|rin\M|rines|lona)', 'banda_hule', 45),
  ('\m(eje|suspensi[oó]n|muelle|bolsa de aire)', 'colectores', 50),
  ('\m(freno|tambor|balero|maza|matraca|ajustador|c[aá]mara|patin|pat[ií]n|perno rey|quinta rueda)', 'poleas', 55),
  ('\m(luz|luces|led|plaf[oó]n|calavera|arn[eé]s|cable|el[eé]ctric)', 'cosedoras', 60)) x(p, f, o);

-- Grupos de las listas de materiales.
update public.bom_lineas set grupo = x.n from (values
  ('Cuerpo', 'Caja'), ('Banda', 'Piso y costados'), ('Pesaje', 'Sensores'), ('Rodillos', 'Travesaños'),
  ('Cabeza', 'Frente'), ('Motriz y tensión', 'Tren de rodaje'), ('Mallas', 'Piso'), ('Vibración', 'Frenos'),
  ('Cola', 'Puerta trasera'), ('Banda y rodillos', 'Piso y travesaños'), ('Banda y cangilones', 'Costados y luces'),
  ('Bota', 'Defensa'), ('Cangilones', 'Iluminación'), ('Motriz', 'Suspensión'), ('Caja', 'Caja')) x(a, n)
where bom_lineas.grupo = x.a;

-- Proveedores: los de bandas, cangilones y vibradores pasan a ser de ejes, llantas y frenos.
update public.proveedores set nombre = x.n, razon_social = case when razon_social is null then null else x.n || ' S.A. de C.V.' end
from (values
  ('Bandas y Hules Industriales de Occidente', 'Ejes y Suspensiones de Occidente'),
  ('Bandas Industriales Atotonilco', 'Lonas y Toldos Atotonilco'),
  ('Rodillos Transportadores del Norte', 'Llantas y Rines del Norte'),
  ('Conveyor Parts Supply (EUA)', 'Trailer Parts Supply (EUA)'),
  ('Vibrotecnia Europea', 'Frenos de Aire Europea'),
  ('Rodamientos y Transmisiones del Bajío', 'Baleros y Frenos del Bajío'),
  ('Rodamientos y Transmisiones de Occidente S.A.', 'Baleros y Frenos de Occidente'),
  ('DEMO Rodamientos y Transmisiones', 'DEMO Baleros y Frenos de Occidente'),
  ('DEMO Bandas Importadas LLC', 'DEMO Trailer Axles LLC'),
  ('Motores y Reductores de Occidente', 'Hidráulica y Volteos de Occidente'),
  ('Ningbo Gearmotor Co.', 'Ningbo Valve Co.'),
  ('Yao Han Industries Co., Ltd.', 'Huaxin Wheel Co., Ltd.'),
  ('Xi''an Gavin Electronic Technology Co., Ltd.', 'Xi''an Hengli Sensor Technology Co., Ltd.'),
  ('Hangzhou Jusheng Machinery and Equipment Co., Ltd.', 'Hangzhou Mingda Trailer Parts Co., Ltd.'),
  ('Henan Lanyi Environmental Technology Co., Ltd.', 'Henan Qingyuan Axle Co., Ltd.'),
  ('Shandong Tavol Machinery Co., Ltd.', 'Shandong Ruitai Suspension Co., Ltd.')) x(a, n)
where proveedores.nombre = x.a;
update public.proveedores set categoria = x.n from (values
  ('Bandas', 'Lonas y pisos'), ('Bandas transportadoras', 'Lonas y pisos'), ('Rodillos', 'Llantas y rines'),
  ('Cangilones', 'Iluminación'), ('Motorreductores', 'Hidráulica'), ('Motores y reductores', 'Hidráulica'),
  ('Rodamientos', 'Baleros y frenos'), ('Rodamientos y transmisión', 'Baleros y frenos'), ('Motores', 'Eléctricos')) x(a, n)
where proveedores.categoria = x.a;

-- ---------------------------------------------------------------------------
-- 3. Frases sueltas que quedan en notas, avisos, oportunidades, servicios, embarques, la
--    bitácora… De lo más largo a lo más corto. Expresiones regulares, sin distinguir mayúsculas.
-- ---------------------------------------------------------------------------
create temp table _rx (orden serial, patron text, nuevo text) on commit drop;
insert into _rx (patron, nuevo) values
  ('20 cosedoras N600A, 10 F300A y 2 cabezales F900A', '40 rines de acero, 20 de aluminio y 2 quintas ruedas'),
  ('10 cosedoras N620A y un cabezal F900A', '20 rines de aluminio y una quinta rueda'),
  ('71 celdas de carga, 6 indicadores y 6 cajas suma', '70 sensores de suspensión, 6 módulos ABS y 6 cajas de conexiones'),
  ('\mSilo de 60 t, 4 helicoidales de 8 y 10 pulgadas, colgantes y motovibradores', '4 ejes de 25,000 y 30,000 lb, colgantes de suspensión y cámaras de freno'),
  ('3 bandas flexibles motorizadas y 4 de gravedad de 10 m', '3 puertas cortina y 4 rampas de aluminio'),
  ('20 patines hidráulicos de 3 t y un volteador 360', '20 patines hidráulicos de 3 t y un cilindro de volteo'),
  ('\mDosificadoras? ZEUS ?(\d+)', 'Cama baja de \1 t'),
  ('\mZEUS\M ?(\d+)?', 'cama baja'), ('\mZAR[- ]?\d*T?\M', 'góndola'), ('\mTHOR\M ?\d*', 'pipa'),
  ('\mdosificadoras', 'camas bajas'), ('\mdosificadora', 'cama baja'),
  ('\mcribadoras?', 'góndola'), ('\mcribas', 'góndolas'), ('\mcriba\M', 'góndola'), ('\mzarandas?', 'góndola'),
  ('\melevadores de cangilones', 'remolques ganaderos'), ('\melevador de cangilones', 'remolque ganadero'),
  ('\melevadores', 'remolques ganaderos'), ('\melevador', 'remolque ganadero'),
  ('\mbandas? transportadoras?', 'caja seca'), ('\mbandas? cargadoras?', 'plataforma'), ('\mbanda artesa', 'caja seca'),
  ('\mbandas? pedestal', 'dolly'), ('\mbandas? flexibles?', 'rampa'),
  ('\mengrapar su banda', 'alinear su remolque'), ('\mgrapas? (para|de) banda', 'bisagras'),
  ('\mmetros de banda', 'metros de lona'), ('\mrollo de banda', 'rollo de lona'),
  ('\mbandas\M', 'cajas secas'), ('\mbanda\M', 'caja seca'),
  ('\mcangilones', 'plafones LED'), ('\mcangil[oó]n', 'plafón LED'),
  ('\mbazucas?', 'remolque cañero'), ('\mhelicoidal(es)?', 'eje'), ('\mrompesacos', 'redilas altas'),
  ('\mtolvas', 'góndolas'), ('\mtolva\M', 'góndola'), ('\msilos', 'pipas'), ('\msilo\M', 'pipa'),
  ('\mcolectores? de polvos?', 'suspensión neumática'), ('\mcolectores', 'suspensiones'), ('\mcolector', 'suspensión'),
  ('\mcosedoras', 'rines'), ('\mcosedora', 'rin'), ('\mcabezal(es)? cosedor(es)?', 'quinta rueda'),
  ('\mceldas de carga', 'sensores de carga'), ('\mcelda de carga', 'sensor de carga'),
  ('\mmotovibradores', 'cámaras de freno'), ('\mmoto ?vibrador', 'cámara de freno'), ('\mvibradores', 'cámaras de freno'),
  ('\mmotorreductores', 'patines de aterrizaje'), ('\mmotorreductor', 'patín de aterrizaje'),
  ('\mchumaceras', 'baleros'), ('\mchumacera', 'balero'), ('\mcatarinas', 'rótulas'), ('\mcatarina', 'rótula'),
  ('\mpoleas\M', 'tambores de freno'), ('\mpolea\M', 'tambor de freno'),
  ('\mrodillos', 'travesaños'), ('\mrodillo', 'travesaño'),
  ('\mmezcladora', 'remolque forrajero'), ('\menvasadora', 'caja térmica'),
  ('\mgrip ?top', 'antiderrapante'), ('\mTapco', 'Truck-Lite'), ('\mFlexco', 'Hendrickson'),
  ('\mla bomba de la caja seca', 'la bomba de volteo'), ('\mcostales', 'tarimas'), ('\mcostal', 'tarima'),
  ('\mPailería', 'Soldadura'), ('\mPailer(o|a)s?\M', 'Soldador'), ('\mDetallado\M', 'Ensamble');

-- Frases que, ya cambiadas, quedaban forzadas («la rin de tarimas ya no cose»): una por una.
create temp table _fin (viejo text, nuevo text) on commit drop;
insert into _fin values
  ('La rin de tarimas ya no cose: se brinca puntadas y se atora el hilo.', 'El compresor portátil ya no levanta presión y se calienta.'),
  ('rin de tarimas portátil', 'Compresor portátil'),
  ('Instalación de la remolque cañero redilas altas en la bodega nueva y arranque con el operador', 'Entrega del remolque cañero de 3 ejes y capacitación al operador'),
  ('Instalación de la plataforma de 18" × 6.60 m con levante electrónico; conectar al tablero del cliente', 'Entrega de la plataforma de 28 ft; revisar luces y frenos con el cliente'),
  ('se abrió el empalme de la caja seca principal', 'se abrió una costura del piso de la caja seca'),
  ('capacitación al operador de la báscula', 'capacitación al operador'),
  ('suspensión de polvos', 'suspensión de aire'),
  ('Apareció una balero', 'Apareció un balero'), ('Esa balero', 'Ese balero'),
  ('Arranque de los dos cámaras de freno', 'Las dos cámaras de freno'),
  ('(opcional: alimentación a góndolas)', '(opcional: lona corrediza)'),
  ('2 góndolas de 6 m³ con básculas independientes', 'Tanque de 10,000 L con rompeolas'),
  ('caja seca de 24" con variador de velocidad', 'Bomba de 3" con motor a gasolina'),
  ('Tablero con dosificación automática por receta', 'Suspensión de aire en 2 ejes'),
  ('tambor de freno motriz 10" doble canal para góndola', 'Tambor de freno de 16.5" ventilado para góndola'),
  ('Martin 2B10 bushing SK', 'Webb 66864'),
  ('Ficha técnica rótula 80B14', 'Ficha técnica de la rótula de dirección'),
  ('Cement pipa 60t with accessories', 'Axle 30,000 lb with disc brakes'),
  ('Eje de 25,000 lb 1:30', 'Eje de 25,000 lb'),
  ('balero de piso 2 15/16"', 'Balero cónico 6208'),
  ('rótula 60B18 maza 2 15/16"', 'Rótula de dirección reforzada'),
  ('Ancho de caja seca', 'Largo de la caja'),
  ('caja seca 18" x 12 m con patín de aterrizaje', 'Caja seca de 40 ft con lona corrediza'),
  ('caja seca 24" x 20 m (exportación)', 'Caja seca de 53 ft (exportación)'),
  ('caja seca 24" x 8 m', 'Caja seca de 28 ft'),
  ('caja seca de 18" de ancho y 12 m entre centros', 'Caja de 40 ft con costados de aluminio'),
  ('patín de aterrizaje de 3 HP trifásico', 'Patín de aterrizaje de 2 velocidades'),
  ('travesaños de carga a cada 1.2 m', 'Travesaños de acero a cada 30 cm'),
  ('Cama baja de 30 t con 2 góndolas', 'Cama baja de 30 t de 2 ejes'),
  ('cama baja de agregados de 3 góndolas', 'Cama baja de 50 t para maquinaria'),
  ('góndola de alimentación 10 m³', 'Góndola de 10 m³'),
  ('góndola vibratoria 4'' x 8'' doble cama', 'Góndola de 12 m³ de 1 eje'),
  ('góndola vibratoria 5'' x 12''', 'Góndola de 18 m³'),
  ('pipa de 60 toneladas', 'Pipa de 40,000 L'),
  ('plafón LED plástico 9" x 6"', 'Calavera LED de 9"'),
  ('remolque forrajero horizontal de listón 2 ton', 'Remolque forrajero de 2 t'),
  ('remolque ganadero 15 m', 'Remolque ganadero de 3 pisos'),
  ('tambor de freno motriz 16" x 24"', 'Tambor de freno de 16.5"'),
  ('Transportador eje 9" x 6 m', 'Remolque cañero corto'),
  ('Rodamiento de travesaños a rótula 22218 E', 'Balero de rodillos 22218 E'),
  ('Los travesaños de carga de la cargadora son de 14" de ancho, no de 20". Se cambiaron en la orden pasada.', 'Los travesaños de la plataforma van a cada 30 cm, no a cada 40 cm. Se cambiaron en la orden pasada.'),
  ('tornillos de cabeza de arado por plafón LED', 'remaches por plafón LED'),
  ('El tensor lleva solera de 2" x 1/4" (60 cm) para las guías', 'La puerta lleva solera de 2" x 1/4" (60 cm) para los refuerzos'),
  ('balero De Piso Ucp207 1 7/16', 'Balero Cónico 6205 Para Remolque'),
  ('plafón LED Plástico 6x4 remolque ganadero De Granos Paquete 10 Pzas', 'Plafón LED Lateral Ámbar Paquete 10 Pzas'),
  ('Raspador De caja seca Poliuretano 18 Pulgadas', 'Loderas De Hule Para Remolque (par)'),
  ('remolque cañero 10" x 12', 'remolque cañero de 2 ejes'),
  ('caja seca PVC 2 capas 24" de ancho, 30 m', 'Lona de PVC de 24 oz, rollo de 30 m'),
  ('Eje de 25,000 lb relación 40:1, flecha de 1 7/16"', 'Eje de 25,000 lb con frenos de disco'),
  ('Sensor de nivel tipo paleta para góndola', 'Sensor de inclinación para góndola de volteo'),
  ('góndola cilíndrica con caja seca de descarga', 'Góndola de 30 m³ con volteo'),
  ('Carro góndola para obra en SLP', 'Góndola para obra en SLP'),
  ('cajas secas para trituradora secundaria', 'Dos góndolas para la trituradora'),
  ('remolque ganadero 7 m y remolque forrajero para molino', 'Remolque ganadero y remolque forrajero para el rancho'),
  ('plataforma 24" para planta Apodaca', 'Plataforma de 48 ft para planta Apodaca'),
  ('Refacciones para cajas secas (grapas y travesaños)', 'Refacciones para cajas secas (bisagras y travesaños)'),
  ('plafones LED Truck-Lite y caja seca para remolques ganaderos', 'Luces LED y lonas para su flotilla'),
  ('pipa y eje para nueva planta', 'Pipa y dolly para la nueva planta'),
  ('remolque ganadero para pipa', 'Remolque ganadero de 2 pisos'),
  ('Terminar la caja seca de 18" para embarque', 'Terminar la caja seca de 40 ft para embarque'),
  ('travesaño guía para puerta cortina', 'Guía para puerta cortina');

-- Todo el texto de la base, menos catálogos geográficos y reglas internas.
-- En JSON (bitácora, detalles) las pulgadas van escapadas (\"): se busca y se pone así.
create function pg_temp.giro(p text, es_json boolean default false) returns text language plpgsql immutable as $$
declare r record; v text := p;
begin
  if v is null then return null; end if;
  for r in select * from _lit order by length(viejo) desc loop
    if es_json then
      v := replace(v, replace(r.viejo, '"', '\"'), replace(r.nuevo, '"', '\"'));
    else
      v := replace(v, r.viejo, r.nuevo);
    end if;
  end loop;
  for r in select * from _rx order by orden loop
    v := regexp_replace(v, r.patron, r.nuevo, 'gi');
  end loop;
  for r in select * from _fin order by length(viejo) desc loop
    if es_json then
      v := replace(v, replace(r.viejo, '"', '\"'), replace(r.nuevo, '"', '\"'));
    else
      v := replace(v, r.viejo, r.nuevo);
    end if;
  end loop;
  return v;
end $$;

do $$
declare r record; n bigint; total bigint := 0;
  v_patron text := '(banda|cangil|dosificad|tolva|silo|criba|zaranda|\mzar|zeus|thor|bazuca|helicoidal|elevador|cosedora|colector|mezcladora|celda|motorreduct|vibrador|grip ?top|rodillo|chumacera|polea|catarina|pailer|detallado|tapco|flexco|costal|envasadora|rompesacos|hegamex|espiga|raspador|grapa|contactor|botonera|cuello de ganso|cople|aerovibrador|variador|malla|cadena de rodillos|tensor|flecha|rodamiento|skatewheel|roller|volteador|colgante|buje de acople|caja suma|indicador|tambor de cola|cabezal|tablero el|motor 2 hp|\(demo\))';
begin
  for r in
    select c.table_name t, c.column_name col, c.data_type tipo
    from information_schema.columns c
    join information_schema.tables tb on tb.table_schema = c.table_schema and tb.table_name = c.table_name and tb.table_type = 'BASE TABLE'
    where c.table_schema = 'public' and c.is_generated = 'NEVER' and c.data_type in ('text', 'character varying', 'jsonb')
      and c.table_name !~ '^(geo_|nombres_palabras$|reglas_familia_venta$|familias_venta$|categorias$|politicas_precio$|etapas$|compras_categorias$|compras_hoja|categoria_clave_sat$|familia_categoria$|historial_ventas_hoja$)'
      and c.column_name not in ('legacy_id', 'legacy_ref', 'clave', 'familia', 'categoria')
  loop
    if r.tipo = 'jsonb' then
      execute format('update public.%I set %I = pg_temp.giro(%I::text, true)::jsonb where %I::text ~* %L', r.t, r.col, r.col, r.col, v_patron);
    else
      execute format('update public.%I set %I = pg_temp.giro(%I) where %I ~* %L', r.t, r.col, r.col, r.col, v_patron);
    end if;
    get diagnostics n = row_count; total := total + n;
  end loop;
  raise notice 'Giro: % renglones con texto cambiado', total;
end $$;

commit;

-- Lo que quedó con vocabulario de Hegamex: debe salir vacío; si sale algo, se agrega arriba.
do $$
declare r record; n int; v text := '';
begin
  for r in select c.table_name t, c.column_name col from information_schema.columns c
           join information_schema.tables tb on tb.table_schema = c.table_schema and tb.table_name = c.table_name and tb.table_type = 'BASE TABLE'
           where c.table_schema = 'public' and c.data_type in ('text', 'character varying', 'jsonb')
             and c.table_name !~ '^(geo_|nombres_palabras$|reglas_familia_venta$|compras_categorias$|compras_hoja|categoria_clave_sat$|familia_categoria$|historial_ventas_hoja$)'
             and c.column_name not in ('legacy_id', 'legacy_ref', 'clave', 'familia', 'categoria') loop
    execute format('select count(*) from public.%I where %I::text ~* %L', r.t, r.col,
      '(banda|cangil|dosificad|\mtolva|\msilo|criba|zaranda|zeus|thor|bazuca|helicoidal|\melevador|cosedora|colector|celda de carga|motorreduct|vibrador|chumacera|pailer)') into n;
    if n > 0 then v := v || format('%s.%s (%s) ', r.t, r.col, n); end if;
  end loop;
  if v <> '' then raise notice 'Quedó vocabulario de Hegamex en: %', v; end if;
end $$;

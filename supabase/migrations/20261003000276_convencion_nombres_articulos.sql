-- =============================================================================
-- La convención de nombres del catálogo se aplica sola al dar de alta o renombrar un artículo, y al
-- capturar se avisa si ya existe uno igual.
--
-- Por qué: el 10 de noviembre se homogeneizaron 3,121 nombres y se juntaron 53 artículos repetidos
-- (solo cambiaba una comilla, el orden de las medidas o una falta). Sin una regla en la base, el
-- siguiente «Tornillo 8x25mm» o «CANGILON 6X5» vuelve a empezar el desorden, y el siguiente repetido
-- vuelve a partir la existencia en dos.
--
-- La convención (la misma con la que se renombró):
--   * Escritura normal: primera letra en mayúscula y lo demás en minúsculas; un nombre TODO EN
--     MAYÚSCULAS o Con Cada Palabra Así se pasa a escritura normal. Se respetan las siglas (HP, PVC,
--     UCF), las marcas (Tapco, WEG), las claves con guion (BTH-16) y lo que lleva números.
--   * Acentos y faltas corregidos con la lista nombres_palabras (cangilón, válvula, «rosaca»→rosca).
--   * Medidas: «x» minúscula con espacios, número separado de su unidad (25 mm, 12 m, 5 HP, 220 V),
--     comillas rectas. En equipos «metros», como en la cotización.
--   * Sin abreviaturas caseras: p/ → para, c/ → con, s/ → sin, inox → inoxidable, mts → m.
-- La lista de palabras es un dato: se agrega una marca o una falta nueva sin tocar la base.
-- =============================================================================

create table if not exists public.nombres_palabras (
  palabra text primary key check (palabra = lower(palabra)),
  forma text not null,
  clase text not null check (clase in ('ortografia', 'marca', 'sigla'))
);
alter table public.nombres_palabras enable row level security;
drop policy if exists ver on public.nombres_palabras;
create policy ver on public.nombres_palabras for select to authenticated using (true);
drop policy if exists editar on public.nombres_palabras;
create policy editar on public.nombres_palabras for all to authenticated
  using ((select puede('costeo', 3))) with check ((select puede('costeo', 3)));

insert into public.nombres_palabras (palabra, forma, clase) values
  ('abb', 'ABB', 'marca'),
  ('abracol', 'Abracol', 'marca'),
  ('abrasadera', 'abrazadera', 'ortografia'),
  ('ac', 'AC', 'sigla'),
  ('accor', 'Accor', 'marca'),
  ('acme', 'ACME', 'sigla'),
  ('acrilastic', 'Acrilastic', 'marca'),
  ('acrilico', 'acrílico', 'ortografia'),
  ('acrilicos', 'acrílicos', 'ortografia'),
  ('adelgasador', 'adelgazador', 'ortografia'),
  ('adictivo', 'aditivo', 'ortografia'),
  ('aerografica', 'aerográfica', 'ortografia'),
  ('agma', 'AGMA', 'sigla'),
  ('agricola', 'agrícola', 'ortografia'),
  ('aigsa', 'Aigsa', 'marca'),
  ('alambron', 'alambrón', 'ortografia'),
  ('aleacion', 'aleación', 'ortografia'),
  ('alimentacion', 'alimentación', 'ortografia'),
  ('allen', 'Allen', 'marca'),
  ('ambar', 'ámbar', 'ortografia'),
  ('amperimetro', 'amperímetro', 'ortografia'),
  ('angulo', 'ángulo', 'ortografia'),
  ('angulos', 'ángulos', 'ortografia'),
  ('ansi', 'ANSI', 'sigla'),
  ('antisalpicduras', 'antisalpicaduras', 'ortografia'),
  ('anyload', 'Anyload', 'marca'),
  ('apollar', 'apoyar', 'ortografia'),
  ('armazon', 'armazón', 'ortografia'),
  ('asegurese', 'asegúrese', 'ortografia'),
  ('atotonilco', 'Atotonilco', 'marca'),
  ('austromex', 'Austromex', 'marca'),
  ('autoelectrico', 'autoeléctrico', 'ortografia'),
  ('automatica', 'automática', 'ortografia'),
  ('automaticos', 'automáticos', 'ortografia'),
  ('autonics', 'Autonics', 'marca'),
  ('avaloy', 'Avaloy', 'marca'),
  ('avante', 'Avante', 'marca'),
  ('awg', 'AWG', 'sigla'),
  ('axt', 'AXT', 'sigla'),
  ('axtech', 'Axtech', 'marca'),
  ('azcapotzalco', 'Azcapotzalco', 'marca'),
  ('balancin', 'balancín', 'ortografia'),
  ('baldor', 'Baldor', 'marca'),
  ('bardahl', 'Bardahl', 'marca'),
  ('bascula', 'báscula', 'ortografia'),
  ('basica', 'básica', 'ortografia'),
  ('basico', 'básico', 'ortografia'),
  ('bateria', 'batería', 'ortografia'),
  ('baterias', 'baterías', 'ortografia'),
  ('benz', 'Benz', 'marca'),
  ('bifasica', 'bifásica', 'ortografia'),
  ('bifasico', 'bifásico', 'ortografia'),
  ('bimeal', 'bimetal', 'ortografia'),
  ('bimentalico', 'bimetálico', 'ortografia'),
  ('bimetalica', 'bimetálica', 'ortografia'),
  ('bimetalico', 'bimetálico', 'ortografia'),
  ('bosch', 'Bosch', 'marca'),
  ('boton', 'botón', 'ortografia'),
  ('briggs', 'Briggs', 'marca'),
  ('brite', 'Brite', 'marca'),
  ('browning', 'Browning', 'marca'),
  ('bticino', 'Bticino', 'marca'),
  ('buick', 'Buick', 'marca'),
  ('bujia', 'bujía', 'ortografia'),
  ('bunan', 'Bunan', 'marca'),
  ('cabkle', 'cable', 'ortografia'),
  ('cadenena', 'cadena', 'ortografia'),
  ('calcomania', 'calcomanía', 'ortografia'),
  ('calibracion', 'calibración', 'ortografia'),
  ('california', 'California', 'marca'),
  ('camara', 'cámara', 'ortografia'),
  ('camaras', 'cámaras', 'ortografia'),
  ('camion', 'camión', 'ortografia'),
  ('cangilon', 'cangilón', 'ortografia'),
  ('capuchon', 'capuchón', 'ortografia'),
  ('carcaza', 'carcasa', 'ortografia'),
  ('carrillo', 'Carrillo', 'marca'),
  ('caterpillar', 'Caterpillar', 'marca'),
  ('cautin', 'cautín', 'ortografia'),
  ('cedula', 'cédula', 'ortografia'),
  ('celulas', 'células', 'ortografia'),
  ('centrifuga', 'centrífuga', 'ortografia'),
  ('century', 'Century', 'marca'),
  ('chevrolet', 'Chevrolet', 'marca'),
  ('chziri', 'Chziri', 'marca'),
  ('cilindrica', 'cilíndrica', 'ortografia'),
  ('cilindrico', 'cilíndrico', 'ortografia'),
  ('cintllo', 'cintillo', 'ortografia'),
  ('clasica', 'clásica', 'ortografia'),
  ('clipper', 'Clipper', 'marca'),
  ('cnc', 'CNC', 'sigla'),
  ('cnector', 'conector', 'ortografia'),
  ('codigo', 'código', 'ortografia'),
  ('codod', 'codo', 'ortografia'),
  ('coginete', 'cojinete', 'ortografia'),
  ('compas', 'compás', 'ortografia'),
  ('conduid', 'conduit', 'ortografia'),
  ('coneccion', 'conexión', 'ortografia'),
  ('conecciones', 'conexiones', 'ortografia'),
  ('conexion', 'conexión', 'ortografia'),
  ('conica', 'cónica', 'ortografia'),
  ('conico', 'cónico', 'ortografia'),
  ('construccion', 'construcción', 'ortografia'),
  ('contacor', 'contactor', 'ortografia'),
  ('contraccion', 'contracción', 'ortografia'),
  ('convinadas', 'combinadas', 'ortografia'),
  ('cpvc', 'CPVC', 'sigla'),
  ('cronometro', 'cronómetro', 'ortografia'),
  ('cubica', 'cúbica', 'ortografia'),
  ('cubicas', 'cúbicas', 'ortografia'),
  ('cubico', 'cúbico', 'ortografia'),
  ('cubicos', 'cúbicos', 'ortografia'),
  ('cuneo', 'cuñero', 'ortografia'),
  ('cuñeo', 'cuñero', 'ortografia'),
  ('cyclo', 'Cyclo', 'marca'),
  ('dc', 'DC', 'sigla'),
  ('debastar', 'desbastar', 'ortografia'),
  ('defenza', 'defensa', 'ortografia'),
  ('delta', 'Delta', 'marca'),
  ('delvac', 'Delvac', 'marca'),
  ('deposito', 'depósito', 'ortografia'),
  ('desconexion', 'desconexión', 'ortografia'),
  ('diametro', 'diámetro', 'ortografia'),
  ('diametros', 'diámetros', 'ortografia'),
  ('din', 'DIN', 'sigla'),
  ('direccion', 'dirección', 'ortografia'),
  ('disolac', 'Disolac', 'marca'),
  ('distribucion', 'distribución', 'ortografia'),
  ('division', 'división', 'ortografia'),
  ('dixon', 'Dixon', 'marca'),
  ('dkt', 'DKT', 'marca'),
  ('dktec', 'DKTEC', 'marca'),
  ('dodge', 'Dodge', 'marca'),
  ('domovare', 'Domovare', 'marca'),
  ('dorot', 'Dorot', 'marca'),
  ('ductil', 'dúctil', 'ortografia'),
  ('duplex', 'dúplex', 'ortografia'),
  ('dyco', 'Dyco', 'marca'),
  ('easymix', 'Easymix', 'marca'),
  ('economica', 'económica', 'ortografia'),
  ('economico', 'económico', 'ortografia'),
  ('electico', 'eléctrico', 'ortografia'),
  ('electrica', 'eléctrica', 'ortografia'),
  ('electricas', 'eléctricas', 'ortografia'),
  ('electrico', 'eléctrico', 'ortografia'),
  ('electricos', 'eléctricos', 'ortografia'),
  ('electronica', 'electrónica', 'ortografia'),
  ('electronico', 'electrónico', 'ortografia'),
  ('electronicos', 'electrónicos', 'ortografia'),
  ('electrovalvula', 'electroválvula', 'ortografia'),
  ('enpujadores', 'empujadores', 'ortografia'),
  ('envio', 'envío', 'ortografia'),
  ('esc', 'ESC', 'sigla'),
  ('esg', 'ESG', 'sigla'),
  ('eslabon', 'eslabón', 'ortografia'),
  ('espartano', 'Espartano', 'marca'),
  ('espatula', 'espátula', 'ortografia'),
  ('espigs', 'espiga', 'ortografia'),
  ('estandar', 'estándar', 'ortografia'),
  ('evans', 'Evans', 'marca'),
  ('everest', 'Everest', 'marca'),
  ('extension', 'extensión', 'ortografia'),
  ('fabricacion', 'fabricación', 'ortografia'),
  ('fag', 'FAG', 'marca'),
  ('ferronilox', 'Ferronilox', 'marca'),
  ('festo', 'Festo', 'marca'),
  ('filtracion', 'filtración', 'ortografia'),
  ('fischbein', 'Fischbein', 'marca'),
  ('fisica', 'física', 'ortografia'),
  ('flexco', 'Flexco', 'marca'),
  ('flexometro', 'flexómetro', 'ortografia'),
  ('ford', 'Ford', 'marca'),
  ('fortune', 'Fortune', 'marca'),
  ('frabricacion', 'fabricación', 'ortografia'),
  ('fram', 'Fram', 'marca'),
  ('galon', 'galón', 'ortografia'),
  ('garrafon', 'garrafón', 'ortografia'),
  ('gates', 'Gates', 'marca'),
  ('gemini', 'Gemini', 'marca'),
  ('glandula', 'glándula', 'ortografia'),
  ('goodride', 'Goodride', 'marca'),
  ('grafitti', 'Grafitti', 'marca'),
  ('grende', 'grande', 'ortografia'),
  ('gripco', 'Gripco', 'marca'),
  ('griptop', 'Griptop', 'marca'),
  ('grua', 'grúa', 'ortografia'),
  ('gruas', 'grúas', 'ortografia'),
  ('guia', 'guía', 'ortografia'),
  ('haldex', 'Haldex', 'marca'),
  ('hecort', 'Hecort', 'marca'),
  ('hegamex', 'Hegamex', 'marca'),
  ('hepa', 'HEPA', 'sigla'),
  ('hermex', 'Hermex', 'marca'),
  ('hidrahulico', 'hidráulico', 'ortografia'),
  ('hidratec', 'Hidratec', 'marca'),
  ('hidraulica', 'hidráulica', 'ortografia'),
  ('hidraulico', 'hidráulico', 'ortografia'),
  ('hidraulicos', 'hidráulicos', 'ortografia'),
  ('higienico', 'higiénico', 'ortografia'),
  ('hilux', 'Hilux', 'marca'),
  ('holland', 'Holland', 'marca'),
  ('honda', 'Honda', 'marca'),
  ('hp', 'HP', 'sigla'),
  ('hss', 'HSS', 'sigla'),
  ('husky', 'Husky', 'marca'),
  ('hyundai', 'Hyundai', 'marca'),
  ('ib', 'IB', 'sigla'),
  ('identificacion', 'identificación', 'ortografia'),
  ('iluminacion', 'iluminación', 'ortografia'),
  ('impak', 'Impak', 'marca'),
  ('impuresas', 'impurezas', 'ortografia'),
  ('inagrind', 'Inagrind', 'marca'),
  ('indutrial', 'industrial', 'ortografia'),
  ('ingersoll', 'Ingersoll', 'marca'),
  ('insercion', 'inserción', 'ortografia'),
  ('instalacion', 'instalación', 'ortografia'),
  ('instantaneo', 'instantáneo', 'ortografia'),
  ('inverter', 'Inverter', 'marca'),
  ('ipr', 'IPR', 'sigla'),
  ('iso', 'ISO', 'sigla'),
  ('jabon', 'jabón', 'ortografia'),
  ('jackson', 'Jackson', 'marca'),
  ('jamay', 'Jamay', 'marca'),
  ('jonh', 'Jonh', 'marca'),
  ('kelox', 'Kelox', 'marca'),
  ('kobrax', 'Kobrax', 'marca'),
  ('kohler', 'Kohler', 'marca'),
  ('kola', 'Kola', 'marca'),
  ('ladron', 'ladrón', 'ortografia'),
  ('lamina', 'lámina', 'ortografia'),
  ('laminas', 'láminas', 'ortografia'),
  ('lampara', 'lámpara', 'ortografia'),
  ('lapiz', 'lápiz', 'ortografia'),
  ('laton', 'latón', 'ortografia'),
  ('led', 'LED', 'sigla'),
  ('leeson', 'Leeson', 'marca'),
  ('legrand', 'Legrand', 'marca'),
  ('leonesa', 'Leonesa', 'marca'),
  ('lesson', 'Leeson', 'ortografia'),
  ('leviton', 'Leviton', 'marca'),
  ('linea', 'línea', 'ortografia'),
  ('liquido', 'líquido', 'ortografia'),
  ('liquidos', 'líquidos', 'ortografia'),
  ('llavez', 'llaves', 'ortografia'),
  ('loca', 'Loca', 'marca'),
  ('loctite', 'Loctite', 'marca'),
  ('ltp', 'LTP', 'sigla'),
  ('lubricacion', 'lubricación', 'ortografia'),
  ('machinery', 'Machinery', 'marca'),
  ('magnetica', 'magnética', 'ortografia'),
  ('magnetico', 'magnético', 'ortografia'),
  ('maguera', 'manguera', 'ortografia'),
  ('makita', 'Makita', 'marca'),
  ('manometro', 'manómetro', 'ortografia'),
  ('maquina', 'máquina', 'ortografia'),
  ('maquna', 'máquina', 'ortografia'),
  ('marathon', 'Marathon', 'marca'),
  ('martin', 'Martin', 'marca'),
  ('mascara', 'máscara', 'ortografia'),
  ('matehuala', 'Matehuala', 'marca'),
  ('maxilift', 'Maxilift', 'marca'),
  ('maximo', 'máximo', 'ortografia'),
  ('mecanica', 'mecánica', 'ortografia'),
  ('mecanico', 'mecánico', 'ortografia'),
  ('megadyne', 'Megadyne', 'marca'),
  ('mercedes', 'Mercedes', 'marca'),
  ('metalica', 'metálica', 'ortografia'),
  ('metalicas', 'metálicas', 'ortografia'),
  ('metalico', 'metálico', 'ortografia'),
  ('metalicos', 'metálicos', 'ortografia'),
  ('metalite', 'Metalite', 'marca'),
  ('metrica', 'métrica', 'ortografia'),
  ('metricas', 'métricas', 'ortografia'),
  ('miestras', 'mientras', 'ortografia'),
  ('mig', 'MIG', 'sigla'),
  ('milimetrica', 'milimétrica', 'ortografia'),
  ('milimetricas', 'milimétricas', 'ortografia'),
  ('milimetrico', 'milimétrico', 'ortografia'),
  ('miller', 'Miller', 'marca'),
  ('millermatic', 'Millermatic', 'marca'),
  ('milwaukee', 'Milwaukee', 'marca'),
  ('mineralmex', 'Mineralmex', 'marca'),
  ('minimo', 'mínimo', 'ortografia'),
  ('mirage', 'Mirage', 'marca'),
  ('mobil', 'Mobil', 'marca'),
  ('modulo', 'módulo', 'ortografia'),
  ('modulos', 'módulos', 'ortografia'),
  ('monofasica', 'monofásica', 'ortografia'),
  ('monofasico', 'monofásico', 'ortografia'),
  ('monofasicos', 'monofásicos', 'ortografia'),
  ('motool', 'Motool', 'marca'),
  ('mototool', 'Mototool', 'marca'),
  ('movil', 'móvil', 'ortografia'),
  ('mtrs', 'm', 'ortografia'),
  ('multichevron', 'Multichevron', 'marca'),
  ('multimetro', 'multímetro', 'ortografia'),
  ('méxico', 'México', 'marca'),
  ('nailon', 'nylon', 'ortografia'),
  ('naylon', 'nylon', 'ortografia'),
  ('nc', 'NC', 'sigla'),
  ('nema', 'NEMA', 'sigla'),
  ('nemesis', 'Nemesis', 'marca'),
  ('neumatica', 'neumática', 'ortografia'),
  ('neumaticas', 'neumáticas', 'ortografia'),
  ('neumatico', 'neumático', 'ortografia'),
  ('neumaticos', 'neumáticos', 'ortografia'),
  ('nf', 'NF', 'sigla'),
  ('nissan', 'Nissan', 'marca'),
  ('nitrofer', 'Nitrofer', 'marca'),
  ('npt', 'NPT', 'sigla'),
  ('nucleo', 'núcleo', 'ortografia'),
  ('numero', 'número', 'ortografia'),
  ('nuto', 'Nuto', 'marca'),
  ('nylacero', 'Nylacero', 'marca'),
  ('nylalloy', 'Nylalloy', 'marca'),
  ('nylamind', 'Nylamind', 'marca'),
  ('obscuro', 'oscuro', 'ortografia'),
  ('omegalfa', 'Omegalfa', 'marca'),
  ('organicos', 'orgánicos', 'ortografia'),
  ('oxido', 'óxido', 'ortografia'),
  ('oxigeno', 'oxígeno', 'ortografia'),
  ('pais', 'país', 'ortografia'),
  ('panoramica', 'panorámica', 'ortografia'),
  ('parazzini', 'Parazzini', 'marca'),
  ('particulas', 'partículas', 'ortografia'),
  ('pcb', 'PCB', 'sigla'),
  ('pegalon', 'Pegalon', 'marca'),
  ('pelicula', 'película', 'ortografia'),
  ('pemex', 'Pemex', 'marca'),
  ('perforacion', 'perforación', 'ortografia'),
  ('perkins', 'Perkins', 'marca'),
  ('phillips', 'Phillips', 'marca'),
  ('plastiacero', 'Plastiacero', 'marca'),
  ('plastica', 'plástica', 'ortografia'),
  ('plasticas', 'plásticas', 'ortografia'),
  ('plastico', 'plástico', 'ortografia'),
  ('plasticos', 'plásticos', 'ortografia'),
  ('plc', 'PLC', 'sigla'),
  ('poliflex', 'Poliflex', 'marca'),
  ('polin', 'polín', 'ortografia'),
  ('potenciometro', 'potenciómetro', 'ortografia'),
  ('precaucion', 'precaución', 'ortografia'),
  ('precion', 'presión', 'ortografia'),
  ('presion', 'presión', 'ortografia'),
  ('presurizacion', 'presurización', 'ortografia'),
  ('pretul', 'Pretul', 'marca'),
  ('prolipropileno', 'polipropileno', 'ortografia'),
  ('proteccion', 'protección', 'ortografia'),
  ('psi', 'PSI', 'sigla'),
  ('ptr', 'PTR', 'sigla'),
  ('pulimentro', 'pulimento', 'ortografia'),
  ('pvc', 'PVC', 'sigla'),
  ('quimicos', 'químicos', 'ortografia'),
  ('rand', 'Rand', 'marca'),
  ('rapida', 'rápida', 'ortografia'),
  ('rapido', 'rápido', 'ortografia'),
  ('reduccion', 'reducción', 'ortografia'),
  ('reforzasa', 'reforzada', 'ortografia'),
  ('regulacion', 'regulación', 'ortografia'),
  ('relacion', 'relación', 'ortografia'),
  ('rele', 'relé', 'ortografia'),
  ('reliance', 'Reliance', 'marca'),
  ('renault', 'Renault', 'marca'),
  ('reparacion', 'reparación', 'ortografia'),
  ('resistol', 'Resistol', 'marca'),
  ('retactil', 'retráctil', 'ortografia'),
  ('reten', 'retén', 'ortografia'),
  ('retencion', 'retención', 'ortografia'),
  ('retractil', 'retráctil', 'ortografia'),
  ('rhino', 'Rhino', 'marca'),
  ('rigida', 'rígida', 'ortografia'),
  ('rigido', 'rígido', 'ortografia'),
  ('rma', 'RMA', 'sigla'),
  ('rmi', 'RMI', 'sigla'),
  ('rmp', 'rpm', 'ortografia'),
  ('roadstone', 'Roadstone', 'marca'),
  ('rocket', 'Rocket', 'marca'),
  ('rodian', 'Rodian', 'marca'),
  ('rosaca', 'rosca', 'ortografia'),
  ('roshfrans', 'Roshfrans', 'marca'),
  ('rost', 'Rost', 'marca'),
  ('rotomex', 'Rotomex', 'marca'),
  ('rpm', 'RPM', 'sigla'),
  ('rppm', 'rpm', 'ortografia'),
  ('rs', 'RS', 'sigla'),
  ('sae', 'SAE', 'sigla'),
  ('safetygrip', 'Safetygrip', 'marca'),
  ('salzer', 'Salzer', 'marca'),
  ('sayer', 'Sayer', 'marca'),
  ('scotch', 'Scotch', 'marca'),
  ('sealco', 'Sealco', 'marca'),
  ('sekurit', 'Sekurit', 'marca'),
  ('semaforo', 'semáforo', 'ortografia'),
  ('separacion', 'separación', 'ortografia'),
  ('separcion', 'separación', 'ortografia'),
  ('siemens', 'Siemens', 'marca'),
  ('sintetico', 'sintético', 'ortografia'),
  ('sirius', 'Sirius', 'marca'),
  ('skf', 'SKF', 'marca'),
  ('smartbitt', 'Smartbitt', 'marca'),
  ('smiths', 'Smiths', 'marca'),
  ('solida', 'sólida', 'ortografia'),
  ('solido', 'sólido', 'ortografia'),
  ('solidos', 'sólidos', 'ortografia'),
  ('ss', 'SS', 'sigla'),
  ('standar', 'estándar', 'ortografia'),
  ('stanley', 'Stanley', 'marca'),
  ('stemco', 'Stemco', 'marca'),
  ('sthelson', 'Sthelson', 'marca'),
  ('stilson', 'Stilson', 'marca'),
  ('suburban', 'Suburban', 'marca'),
  ('succion', 'succión', 'ortografia'),
  ('suerficie', 'superficie', 'ortografia'),
  ('suich', 'switch', 'ortografia'),
  ('sujecion', 'sujeción', 'ortografia'),
  ('sumitomo', 'Sumitomo', 'marca'),
  ('surtek', 'Surtek', 'marca'),
  ('suspecion', 'suspensión', 'ortografia'),
  ('suspension', 'suspensión', 'ortografia'),
  ('swich', 'switch', 'ortografia'),
  ('swicht', 'switch', 'ortografia'),
  ('tapco', 'Tapco', 'marca'),
  ('tapcop', 'Tapcop', 'marca'),
  ('tapon', 'tapón', 'ortografia'),
  ('tavol', 'Tavol', 'marca'),
  ('tb', 'TB', 'sigla'),
  ('tecnica', 'técnica', 'ortografia'),
  ('tecnico', 'técnico', 'ortografia'),
  ('teco', 'Teco', 'marca'),
  ('tefc', 'TEFC', 'sigla'),
  ('telescopica', 'telescópica', 'ortografia'),
  ('telescopico', 'telescópico', 'ortografia'),
  ('tenazi', 'Tenazi', 'marca'),
  ('tension', 'tensión', 'ortografia'),
  ('teraflex', 'Teraflex', 'marca'),
  ('termica', 'térmica', 'ortografia'),
  ('termico', 'térmico', 'ortografia'),
  ('termocontractil', 'termocontráctil', 'ortografia'),
  ('termocontractiles', 'termocontráctiles', 'ortografia'),
  ('termofil', 'Termofil', 'marca'),
  ('termomagnetico', 'termomagnético', 'ortografia'),
  ('termoplastica', 'termoplástica', 'ortografia'),
  ('therman', 'Therman', 'marca'),
  ('thermoplastica', 'termoplástica', 'ortografia'),
  ('thhw', 'THHW', 'sigla'),
  ('thor', 'THOR', 'marca'),
  ('thw', 'THW', 'sigla'),
  ('tig', 'TIG', 'sigla'),
  ('tipsa', 'Tipsa', 'marca'),
  ('titanium', 'Titanium', 'marca'),
  ('titulo', 'título', 'ortografia'),
  ('tolteca', 'Tolteca', 'marca'),
  ('tonelas', 'toneladas', 'ortografia'),
  ('tonillo', 'tornillo', 'ortografia'),
  ('traccion', 'tracción', 'ortografia'),
  ('trafico', 'tráfico', 'ortografia'),
  ('trajeta', 'tarjeta', 'ortografia'),
  ('transbelt', 'Transbelt', 'marca'),
  ('transmicion', 'transmisión', 'ortografia'),
  ('transmision', 'transmisión', 'ortografia'),
  ('transtecno', 'Transtecno', 'marca'),
  ('trasmision', 'transmisión', 'ortografia'),
  ('trasparente', 'transparente', 'ortografia'),
  ('traxion', 'Traxion', 'marca'),
  ('trifasica', 'trifásica', 'ortografia'),
  ('trifasico', 'trifásico', 'ortografia'),
  ('trifasicos', 'trifásicos', 'ortografia'),
  ('trivesa', 'Trivesa', 'marca'),
  ('truper', 'Truper', 'marca'),
  ('tted', 'TTED', 'sigla'),
  ('ttem', 'TTEM', 'sigla'),
  ('ttsd', 'TTSD', 'sigla'),
  ('ttsm', 'TTSM', 'sigla'),
  ('tuflo', 'Tuflo', 'marca'),
  ('tugsteno', 'tungsteno', 'ortografia'),
  ('tulum', 'Tulum', 'marca'),
  ('ucf', 'UCF', 'sigla'),
  ('ucfl', 'UCFL', 'sigla'),
  ('ucflpl', 'UCFLPL', 'sigla'),
  ('ucfp', 'UCFP', 'sigla'),
  ('ucfpl', 'UCFPL', 'sigla'),
  ('ucnfl', 'UCNFL', 'sigla'),
  ('ucp', 'UCP', 'sigla'),
  ('ucppl', 'UCPPL', 'sigla'),
  ('uct', 'UCT', 'sigla'),
  ('uhmw', 'UHMW', 'sigla'),
  ('ultragrip', 'Ultragrip', 'marca'),
  ('unica', 'única', 'ortografia'),
  ('unico', 'único', 'ortografia'),
  ('union', 'unión', 'ortografia'),
  ('urrea', 'Urrea', 'marca'),
  ('utp', 'UTP', 'sigla'),
  ('vac', 'VAC', 'sigla'),
  ('valvula', 'válvula', 'ortografia'),
  ('valvulas', 'válvulas', 'ortografia'),
  ('variacion', 'variación', 'ortografia'),
  ('vca', 'VCA', 'sigla'),
  ('vcd', 'VCD', 'sigla'),
  ('vdc', 'VDC', 'sigla'),
  ('ventilacion', 'ventilación', 'ortografia'),
  ('veracruz', 'Veracruz', 'marca'),
  ('verical', 'vertical', 'ortografia'),
  ('via', 'vía', 'ortografia'),
  ('vias', 'vías', 'ortografia'),
  ('viaticos', 'viáticos', 'ortografia'),
  ('vibracion', 'vibración', 'ortografia'),
  ('vimai', 'Vimai', 'marca'),
  ('vitafilm', 'Vitafilm', 'marca'),
  ('volteck', 'Volteck', 'marca'),
  ('vultimetro', 'voltímetro', 'ortografia'),
  ('wamflo', 'Wamflo', 'marca'),
  ('weg', 'WEG', 'marca'),
  ('weidmuller', 'Weidmuller', 'marca'),
  ('weldon', 'Weldon', 'marca'),
  ('westinghouse', 'Westinghouse', 'marca'),
  ('westlake', 'Westlake', 'marca'),
  ('weston', 'Weston', 'marca'),
  ('westoon', 'Westoon', 'marca'),
  ('wix', 'Wix', 'marca'),
  ('woltman', 'Woltman', 'marca'),
  ('wurth', 'Wurth', 'marca'),
  ('xhhw', 'XHHW', 'sigla'),
  ('xtrong', 'Xtrong', 'marca'),
  ('yaskawa', 'Yaskawa', 'marca'),
  ('zar', 'ZAR', 'marca'),
  ('zeus', 'ZEUS', 'marca')
on conflict (palabra) do update set forma = excluded.forma, clase = excluded.clase;

-- Una palabra: corrige la falta, respeta marca, sigla y código, y pone mayúscula solo al principio.
create or replace function public.nombre_palabra(p_w text, p_primera boolean, p_cambiar boolean) returns text
language plpgsql stable set search_path = public as $$
declare w text := p_w; lw text; f text; punto boolean; r text;
begin
  punto := right(w, 1) = '.' and w !~ '[0-9]';
  if punto then w := left(w, -1); end if;
  lw := lower(w);
  select forma into f from nombres_palabras where palabra = lw and clase = 'ortografia';
  if f is not null then
    -- Con la forma de la palabra original: «CANGILON» → «CANGILÓN», «Cangilon» → «Cangilón».
    w := case when w = upper(w) and w <> lower(w) and length(w) > 1 then upper(f)
              when left(w, 1) <> lower(left(w, 1)) then upper(left(f, 1)) || substr(f, 2)
              else f end;
    lw := lower(w);
  end if;
  if w ~ '[0-9]' then r := w;
  elsif length(w) = 1 and w = upper(w) and w <> lower(w) and not (p_cambiar and lw in ('a', 'o', 'y', 'e')) then r := w;   -- «brida C»
  elsif lw = 'no' and not p_primera and left(w, 1) <> lower(left(w, 1)) then r := w;                                       -- «No. 6»
  elsif w ~ '^[A-Z][a-z]+[A-Z]+$' then r := w;                                                                               -- TaladroBI
  else
    select forma into f from nombres_palabras where palabra = lw and clase in ('marca', 'sigla');
    if f is not null then r := f;
    elsif w = upper(w) and w <> lower(w) and length(w) <= 5 and not p_cambiar then r := w;                                   -- RMA, TTED
    elsif p_primera then r := upper(left(lw, 1)) || substr(lw, 2);
    else r := lw;
    end if;
  end if;
  return r || case when punto then '.' else '' end;
end $$;

create or replace function public.nombre_convencion(p_nombre text, p_tipo text) returns text
language plpgsql stable set search_path = public as $$
declare n text; letras text; todo_mayus boolean; titulo boolean; cambiar boolean; pal text[];
  t text[]; i int; s text := ''; primera boolean; tok text;
  separ constant text := '[(),;:/"+\-]';
begin
  if p_nombre is null then return null; end if;
  n := btrim(p_nombre);
  n := replace(replace(replace(replace(replace(n, '·', '.'), '“', '"'), '”', '"'), '″', '"'), '´', '''');
  n := regexp_replace(n, '\yp/\s*', 'para ', 'gi');
  n := regexp_replace(n, '\yf/\s*aire', 'para aire', 'gi');
  n := regexp_replace(n, '\yc/\s*(?=[a-záéíóúñ])', 'con ', 'gi');
  n := regexp_replace(n, '\yinox\y\.?', 'inoxidable', 'gi');
  n := regexp_replace(n, '\ys/\s*(?=[A-Za-záéíóúñ])', 'sin ', 'gi');
  n := regexp_replace(n, '\yH\.\s?P\.?(?=[\s,)]|$)', 'HP', 'g');
  n := regexp_replace(n, '\y([123])f\y', '\1F', 'g');
  n := regexp_replace(n, '(\d)\s*pulg(adas|ada)?\y\.?', '\1"', 'gi');
  n := regexp_replace(n, '(?<=[\d"])\s*[xX]\s*(?=\d)', ' x ', 'g');
  n := regexp_replace(n, '(?<![\w.\-/])(\d+(\.\d+)?)\s*mm\y', '\1 mm', 'gi');
  n := regexp_replace(n, '(?<![\w.\-/])(\d+(\.\d+)?)\s*cm\y', '\1 cm', 'gi');
  n := regexp_replace(n, '(?<![\w.\-/])(\d+(\.\d+)?)\s*kg\y', '\1 kg', 'gi');
  n := regexp_replace(n, '(?<![\w.\-/])(\d+(\.\d+)?)\s*hp\y', '\1 HP', 'gi');
  n := regexp_replace(n, '(?<![\w.\-/])(\d+(\.\d+)?)\s*(rpm|rppm|rmp)\y', '\1 RPM', 'gi');
  n := regexp_replace(n, '(?<=\s)X(?=\s+\d)', 'x', 'g');
  if p_tipo = 'equipo' then
    n := regexp_replace(n, '(?<![\w.\-/])(\d+(\.\d+)?)\s*(mts?|mtrs|metros?|m)\y\.?(?!\d)', '\1 metros', 'gi');
    n := regexp_replace(n, '(?<![\w.\-/])1 metros\y', '1 metro', 'g');
  else
    n := regexp_replace(n, '(?<![\w.\-/])(\d+(\.\d+)?)\s*(mts?|mtrs|metros?|m)\y\.?(?!\d)', '\1 m', 'gi');
  end if;
  n := regexp_replace(n, '(?<![\w.\-/])(\d+(\.\d+)?)\s*(volts?|vlts)\y\.?', '\1 V', 'gi');
  n := regexp_replace(n, '(?<![\w.\-/])(\d+(\.\d+)?)\s*(amperes|ampers|amps?)\y\.?', '\1 A', 'gi');
  n := regexp_replace(n, '(^|\s)"\s+(?=[A-Za-zÁÉÍÓÚÑáéíóúñ])', '\1"', 'g');

  -- Se decide con el nombre original: lo que cambió arriba («x», «m») no cuenta.
  letras := regexp_replace(p_nombre, '[^A-Za-zÁÉÍÓÚÑáéíóúñ]', '', 'g');
  todo_mayus := letras <> '' and letras = upper(letras) and length(letras) > 6;
  select array_agg(m[1]) into pal from regexp_matches(p_nombre, '([A-Za-zÁÉÍÓÚÑáéíóúñü]+)', 'g') m
   where length(m[1]) > 2 and m[1] <> upper(m[1]);
  titulo := coalesce(cardinality(pal), 0) >= 3 and not todo_mayus
    and not exists (select 1 from unnest(pal) w where left(w, 1) = lower(left(w, 1)));
  cambiar := todo_mayus or titulo;

  -- Fichas: claves con guion (se quedan tal cual), espacios, separadores y palabras.
  select array_agg(m[1] order by o) into t
  from regexp_matches(n, '(\m[A-Z0-9]{1,6}(?:-[A-Z0-9]{1,8})+\M|\s+|[(),;:/"+\-]+|[^\s(),;:/"+\-]+)', 'g') with ordinality x(m, o);
  primera := n ~ '^[A-Za-zÁÉÍÓÚÑáéíóúñ"]';
  for i in 1 .. coalesce(cardinality(t), 0) loop
    tok := t[i];
    if tok ~ '^[A-Z0-9]{1,6}(-[A-Z0-9]{1,8})+$' then
      s := s || tok;
    elsif tok ~ '^[A-Za-zÁÉÍÓÚÑáéíóúñü0-9.''#°]+$' and tok ~ '[A-Za-zÁÉÍÓÚÑáéíóúñ]' then
      s := s || nombre_palabra(tok, primera, cambiar);
      primera := false;
    else
      s := s || tok;
      -- Una comilla que abre (pegada a la palabra que sigue) empieza un texto: «Calca "Paro"».
      if btrim(tok) = '"' then primera := i < cardinality(t) and t[i + 1] ~ '^[A-Za-zÁÉÍÓÚÑáéíóúñ]'; end if;
    end if;
  end loop;
  s := btrim(regexp_replace(s, '\s+', ' ', 'g'));
  s := regexp_replace(regexp_replace(s, '\(\s+', '(', 'g'), '\s+\)', ')', 'g');
  if left(s, 1) <> upper(left(s, 1)) then s := upper(left(s, 1)) || substr(s, 2); end if;
  return s;
end $$;
grant execute on function public.nombre_convencion(text, text) to authenticated;

-- Al dar de alta o renombrar, por cualquier camino (alta, duplicar, ficha, importar), el nombre queda
-- con la convención.
create or replace function public.articulo_nombre_convencion() returns trigger
language plpgsql set search_path = public as $$
begin
  new.nombre := nombre_convencion(new.nombre, new.tipo::text);
  return new;
end $$;
drop trigger if exists nombre_convencion on public.articulos;
create trigger nombre_convencion before insert or update of nombre on public.articulos
  for each row execute function public.articulo_nombre_convencion();

-- Para comparar dos nombres: sin acentos, comillas, signos ni palabras de relleno, y con las palabras
-- en cualquier orden («Ángulo 2 x 3/16» y «Ángulo 3/16 x 2» son el mismo).
create or replace function public.articulo_clave_nombre(p text) returns text
language sql stable set search_path = public, extensions as $$
  select string_agg(w, ' ' order by w)
  from regexp_split_to_table(
         regexp_replace(regexp_replace(translate(lower(unaccent(coalesce(p, ''))), '"''', '  '), '[,;()]', ' ', 'g'),
                        '(\d) x (\d)', '\1 \2', 'g'), '\s+') w
  where w <> '' and w not in ('de', 'del', 'la', 'el', 'para', 'con', 'marca', 'tipo', 'en', 'y', 'nc', 'x')
$$;

-- Lo que la pantalla de alta enseña mientras escribes: cómo va a quedar el nombre y si ya existe uno
-- igual (activo o no). Con los permisos de quien pregunta: solo ve los artículos que ya podía ver.
create or replace function public.revisar_nombre_articulo(p_nombre text, p_tipo text, p_excluir uuid default null)
returns jsonb language plpgsql stable security invoker set search_path = public as $$
declare v_nombre text := nombre_convencion(nullif(trim(p_nombre), ''), p_tipo); v_clave text; v jsonb;
  v_fam text[] := case when p_tipo in ('componente', 'materia_prima') then array['componente', 'materia_prima'] else array[p_tipo] end;
begin
  if v_nombre is null or length(v_nombre) < 3 then return jsonb_build_object('nombre', v_nombre, 'parecidos', '[]'::jsonb); end if;
  v_clave := articulo_clave_nombre(v_nombre);
  select coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'clave', a.clave, 'nombre', a.nombre, 'tipo', a.tipo, 'activo', a.activo)
                            order by a.activo desc, a.clave), '[]')
    into v
  from (select * from articulos a where a.tipo::text = any (v_fam) and a.id is distinct from p_excluir
          and articulo_clave_nombre(a.nombre) = v_clave limit 5) a;
  return jsonb_build_object('nombre', v_nombre, 'parecidos', v);
end $$;
grant execute on function public.revisar_nombre_articulo(text, text, uuid) to authenticated;

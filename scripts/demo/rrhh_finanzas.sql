-- Datos de demostración para RRHH y finanzas (pantallas de Personal, Vacaciones,
-- Cobranza y Pagos a proveedores).
--
-- Idempotente: cada registro tiene un id fijo (md5 de una etiqueta) y se inserta
-- solo si no existe, así que correrlo dos veces no duplica nada ni gasta folios.
-- Las fechas son relativas al día en que se corre, para que siempre haya
-- "ausentes hoy", saldos vencidos y pagos en las próximas 4 semanas.
-- Los clientes y proveedores se llaman "DEMO …" para distinguirlos de los reales.
--
-- Se corre como postgres pero firmando con usuarios de prueba (request.jwt.claims),
-- para que la bitácora diga quién hizo qué, como pasaría desde la app.
--
-- Uso: psql "$DB_URL" -f scripts/demo/rrhh_finanzas.sql
begin;

create or replace function pg_temp.id(t text) returns uuid language sql immutable as $$ select md5('demo-rf:' || t)::uuid $$;
create or replace function pg_temp.perfil(c text) returns uuid language sql stable as $$ select id from public.perfiles where correo = c $$;
create or replace function pg_temp.como(c text) returns void language sql as $$
  select set_config('request.jwt.claims', coalesce(json_build_object('sub', (select id from public.perfiles where correo = c), 'role', 'authenticated')::text, ''), true) $$;
-- El siguiente día hábil (para que una falta o un retardo nunca caigan en domingo).
create or replace function pg_temp.habil(d date) returns date language sql stable as $$
  select min(x)::date from generate_series(d, d + 10, interval '1 day') x where public.dias_habiles(x::date, x::date) = 1 $$;
-- Lunes de esta semana: las vacaciones se piden de lunes a sábado.
create or replace function pg_temp.lunes(n int) returns date language sql stable as $$
  select (date_trunc('week', current_date)::date + n) $$;

-- ---------------------------------------------------------------------------
-- Personal
-- ---------------------------------------------------------------------------
do $$ begin perform pg_temp.como('rrhh@hegamex.com'); end $$;

create temp table demo_emp (numero text, nombre text, puesto text, depto text, etapa text, ingreso date, nacimiento date,
  telefono text, usuario text, rfc4 text, sexo text, salario numeric) on commit drop;
insert into demo_emp values
  ('1001', 'José Luis Ramírez Ortega',      'Jefe de taller',             'Producción',       'Pailería',  '2009-03-02', '1976-04-12', '348 112 4501', null, 'RAOJ', 'H', 920),
  ('1002', 'Martín Hernández Gómez',        'Soldador',                   'Producción',       'Pailería',  '2014-06-16', '1985-09-03', '348 109 2287', null, 'HEGM', 'H', 560),
  ('1003', 'Ricardo Pérez Navarro',         'Soldador',                   'Producción',       'Pailería',  '2019-01-14', '1992-01-27', '348 127 9034', null, 'PENR', 'H', 520),
  ('1004', 'Juan Carlos Mendoza Ruiz',      'Pailero',                    'Producción',       'Pailería',  '2021-08-02', '1990-11-08', '348 133 5512', null, 'MERJ', 'H', 500),
  ('1005', 'Luis Ángel Torres Velázquez',   'Ayudante de pailería',       'Producción',       'Pailería',  current_date - 180, '2004-06-21', '348 140 7788', null, 'TOVL', 'H', 330),
  ('1006', 'Francisco Javier Gutiérrez Luna','Pailero',                   'Producción',       'Pailería',  '2023-02-13', '1988-02-14', '348 118 3321', null, 'GULF', 'H', 500),
  ('1007', 'Alejandro Castillo Reyes',      'Tornero',                    'Producción',       'Torno',     '2011-09-05', '1980-07-30', '348 102 6650', null, 'CARA', 'H', 640),
  ('1008', 'Miguel Ángel Flores Jiménez',   'Tornero',                    'Producción',       'Torno',     '2020-10-19', '1994-03-15', '348 125 0943', null, 'FOJM', 'H', 560),
  ('1009', 'Raúl Sánchez Medina',           'Fresador',                   'Producción',       'Torno',     '2024-07-01', '1997-12-02', '348 131 4410', null, 'SAMR', 'H', 480),
  ('1010', 'Jorge Alberto Morales Díaz',    'Pintor',                     'Producción',       'Pintura',   '2016-05-09', '1983-05-19', '348 107 8876', null, 'MODJ', 'H', 470),
  ('1011', 'Eduardo Vargas Luna',           'Pintor',                     'Producción',       'Pintura',   current_date - 330, '2001-10-11', '348 144 1209', null, 'VALE', 'H', 400),
  ('1012', 'Héctor Romero Aguilar',         'Ayudante de pintura',        'Producción',       'Pintura',   '2022-03-22', '1999-08-25', '348 136 3354', null, 'ROAH', 'H', 340),
  ('1013', 'Daniel Ruiz Cervantes',         'Operador de corte (plasma)', 'Producción',       'Corte',     '2018-02-05', '1991-04-04', '348 121 7765', null, 'RUCD', 'H', 520),
  ('1014', 'Óscar Jiménez Salazar',         'Detallador',                 'Producción',       'Detallado', '2015-08-17', '1984-06-29', '348 110 2093', null, 'JISO', 'H', 500),
  ('1015', 'Arturo Domínguez Campos',       'Electricista',               'Producción',       'Eléctrico', '2017-11-27', '1986-01-16', '348 115 6621', null, 'DOCA', 'H', 610),
  ('1016', 'Sergio Navarro Ibarra',         'Ayudante general',           'Producción',       'Embarque',  current_date - 45, '2006-02-09', '348 149 3008', null, 'NAIS', 'H', 315.04),
  ('1017', 'Gerardo López Fuentes',         'Almacenista',                'Almacén',          null,        '2013-04-08', '1982-10-05', '348 104 5547', null, 'LOFG', 'H', 480),
  ('1018', 'Rosa María Delgado Cruz',       'Auxiliar de almacén',        'Almacén',          null,        '2022-09-12', '1995-03-08', '348 138 9902', null, 'DECR', 'M', 380),
  ('1019', 'Isaac Hernández García',        'Ejecutivo de ventas',        'Ventas',           null,        '2012-01-09', '1987-08-14', '33 1450 2201', 'isaac@hegamex.com', 'HEGI', 'H', 650),
  ('1020', 'Juan Manuel Ramírez Soto',      'Ejecutivo de ventas',        'Ventas',           null,        '2019-05-20', '1990-05-01', '33 1450 2202', 'juan@hegamex.com', 'RASJ', 'H', 600),
  ('1021', 'Susana Rizo Mercado',           'Ejecutiva de ventas',        'Ventas',           null,        '2021-01-11', '1993-12-12', '33 1450 2203', 'susana@hegamex.com', 'RIMS', 'M', 600),
  ('1022', 'Elizabeth Hernández García',    'Gerente de ventas',          'Ventas',           null,        '2010-07-05', '1982-02-20', '33 1450 2204', 'gerente.ventas@hegamex.com', 'HEGE', 'M', 950),
  ('1023', 'Miguel Ángel Ortiz Plascencia', 'Ingeniero de diseño',        'Ingeniería',       null,        '2018-08-27', '1989-09-09', '33 1450 2205', 'ingenieria@hegamex.com', 'OIPM', 'H', 820),
  ('1024', 'Laura Patricia Gómez Ruvalcaba','Contadora',                  'Administración',   null,        '2016-02-01', '1984-11-23', '33 1450 2206', 'finanzas@hegamex.com', 'GORL', 'M', 780),
  ('1025', 'Mariana Castañeda Villa',       'Auxiliar de RRHH',           'Recursos Humanos', null,        '2020-06-15', '1996-07-07', '33 1450 2207', 'rrhh@hegamex.com', 'CAVM', 'M', 520),
  ('1026', 'Claudia Ivonne Rivas Orozco',   'Compradora',                 'Compras',          null,        '2018-09-03', '1991-05-30', '33 1450 2208', 'compras@hegamex.com', 'RIOC', 'M', 620),
  ('1027', 'Abel Hernández G.',             'Director general',           'Dirección',        null,        '2005-01-03', '1970-03-21', '33 1450 2200', 'direccion@hegamex.com', 'HEGA', 'H', 1800);

insert into public.empleados (id, numero, nombre, puesto, departamento_id, etapa_id, fecha_ingreso, fecha_nacimiento,
  telefono, correo, contacto_emergencia, usuario_id)
select pg_temp.id('emp:' || x.numero), x.numero, x.nombre, x.puesto, d.id, e.id, x.ingreso, x.nacimiento, x.telefono, x.usuario,
  'Esposa/o o mamá: 348 ' || substr(x.telefono, 5, 3) || ' 0000', pg_temp.perfil(x.usuario)
from demo_emp x
left join public.departamentos d on d.nombre = x.depto
left join public.etapas e on e.nombre = x.etapa
where not exists (select 1 from public.empleados w where w.id = pg_temp.id('emp:' || x.numero))
on conflict do nothing;

-- Datos sensibles con formato válido (CURP 18, RFC 13, NSS 11, CLABE 18), inventados.
insert into public.empleado_datos (empleado_id, curp, rfc, nss, domicilio, salario_diario, cuenta_bancaria)
select pg_temp.id('emp:' || x.numero),
  x.rfc4 || to_char(x.nacimiento, 'YYMMDD') || x.sexo || 'JC' || upper(translate(substr(md5(x.nombre), 1, 3), '0123456789abcdef', 'BCDFGHJKLMNPRSTV')) || '0' || (ascii(x.nombre) % 10),
  x.rfc4 || to_char(x.nacimiento, 'YYMMDD') || upper(translate(substr(md5(x.nombre), 4, 3), '0123456789abcdef', 'ABCDEFGHJK123456')),
  lpad(((('x' || substr(md5(x.nombre), 7, 8))::bit(32)::bigint) % 100000000000)::text, 11, '0'),
  'Calle Hidalgo ' || (ascii(x.nombre) * 3) || ', Atotonilco el Alto, Jal.',
  x.salario,
  '0143' || lpad(((('x' || substr(md5(x.nombre), 15, 8))::bit(32)::bigint) % 100000000000000)::text, 14, '0')
from demo_emp x
where exists (select 1 from public.empleados w where w.id = pg_temp.id('emp:' || x.numero))
on conflict do nothing;

-- Una baja: renunció hace un mes.
insert into public.empleados (id, numero, nombre, puesto, departamento_id, etapa_id, fecha_ingreso, fecha_nacimiento, telefono, activo, baja_en, motivo_baja)
select pg_temp.id('emp:1028'), '1028', 'Pedro Salinas Ochoa', 'Soldador',
  (select id from public.departamentos where nombre = 'Producción'), (select id from public.etapas where nombre = 'Pailería'),
  '2022-05-02', '1993-02-17', '348 150 1100', false, current_date - 35, 'Renuncia voluntaria: se fue a trabajar a Estados Unidos'
where not exists (select 1 from public.empleados where id = pg_temp.id('emp:1028'))
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Vacaciones e incidencias (aprobadas por RRHH, salvo las solicitudes)
-- ---------------------------------------------------------------------------
create temp table demo_inc (clave text, numero text, tipo text, inicio date, fin date, estado text, motivo text, horas numeric, dias numeric) on commit drop;
insert into demo_inc values
  ('vac-jorge',     '1010', 'vacaciones',       pg_temp.lunes(0),   pg_temp.lunes(8),   'aprobada',   'Vacaciones del periodo 2026',           null, null),
  ('inc-jcarlos',   '1004', 'incapacidad',      current_date - 3,   current_date + 11,  'aprobada',   'Incapacidad IMSS por lesión en la mano (folio RT-58821)', null, null),
  ('vac-alejandro', '1007', 'vacaciones',       pg_temp.lunes(14),  pg_temp.lunes(19),  'aprobada',   'Viaje familiar',                         null, null),
  ('vac-oscar',     '1014', 'vacaciones',       pg_temp.lunes(28),  pg_temp.lunes(33),  'aprobada',   null,                                     null, null),
  ('vac-martin',    '1002', 'vacaciones',       pg_temp.lunes(-21), pg_temp.lunes(-16), 'aprobada',   null,                                     null, null),
  ('hx-martin',     '1002', 'horas_extra',      pg_temp.habil(current_date - 2), null,  'aprobada',   'Terminar la banda de 18" para embarque', 4,    null),
  ('falta-hector',  '1012', 'falta',            pg_temp.lunes(-7),  pg_temp.lunes(-7),  'aprobada',   'No se presentó ni avisó',                null, null),
  ('ret-raul',      '1009', 'retardo',          pg_temp.lunes(1),   null,               'aprobada',   'Llegó 30 minutos tarde',                 0.5,  null),
  ('psg-eduardo',   '1011', 'permiso_sin_goce', pg_temp.lunes(3),   pg_temp.lunes(4),   'aprobada',   'Asuntos personales',                     null, null),
  ('vac-daniel',    '1013', 'vacaciones',       pg_temp.lunes(14),  pg_temp.lunes(16),  'rechazada',  'Coincide con la entrega de la cribadora de Minera Santa Cruz', null, null),
  ('vac-joseluis',  '1001', 'vacaciones',       '2026-03-30',       '2026-04-04',       'aprobada',   'Semana Santa',                           null, null),
  ('vac-laura',     '1024', 'vacaciones',       '2026-07-20',       '2026-07-25',       'aprobada',   null,                                     null, null),
  ('vac-arturo',    '1015', 'vacaciones',       '2026-08-10',       '2026-08-14',       'aprobada',   null,                                     null, null),
  ('vac-gerardo-1', '1017', 'vacaciones',       '2026-06-15',       '2026-06-20',       'aprobada',   null,                                     null, null),
  -- Solicitudes por aprobar
  ('vac-ricardo',   '1003', 'vacaciones',       pg_temp.lunes(21),  pg_temp.lunes(26),  'solicitada', 'Boda de su hermano en Guadalajara',      null, null),
  ('pcg-gerardo',   '1017', 'permiso_con_goce', pg_temp.habil(current_date + 5), pg_temp.habil(current_date + 5), 'solicitada', 'Trámite en el SAT', null, null),
  ('pcg-rosa',      '1018', 'permiso_con_goce', pg_temp.habil(current_date + 2), pg_temp.habil(current_date + 2), 'solicitada', 'Cita médica (medio día)', null, 0.5);

insert into public.incidencias (id, empleado_id, tipo, inicio, fin, estado, motivo, horas, dias)
select pg_temp.id('inc:' || x.clave), pg_temp.id('emp:' || x.numero), x.tipo, x.inicio, coalesce(x.fin, x.inicio), x.estado, x.motivo, x.horas, coalesce(x.dias, 1)
from demo_inc x
where exists (select 1 from public.empleados w where w.id = pg_temp.id('emp:' || x.numero))
  and not exists (select 1 from public.incidencias i where i.id = pg_temp.id('inc:' || x.clave))
on conflict do nothing;

-- Susana pide sus vacaciones desde su cuenta: la base la deja "solicitada" aunque pidiera otra cosa.
do $$ begin perform pg_temp.como('susana@hegamex.com'); end $$;
insert into public.incidencias (id, empleado_id, tipo, inicio, fin, estado, motivo)
select pg_temp.id('inc:vac-susana'), pg_temp.id('emp:1021'), 'vacaciones', pg_temp.lunes(35), pg_temp.lunes(40), 'aprobada', 'Puente de noviembre con la familia'
where exists (select 1 from public.empleados w where w.id = pg_temp.id('emp:1021'))
  and not exists (select 1 from public.incidencias i where i.id = pg_temp.id('inc:vac-susana'))
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Cobranza: clientes, pedidos con anticipos, facturas y cobros en varios meses
-- ---------------------------------------------------------------------------
do $$ begin perform pg_temp.como('gerente.ventas@hegamex.com'); end $$;

insert into public.clientes (id, nombre, razon_social, ciudad, estado, vendedor_id, dias_credito, legacy_ref)
select pg_temp.id('cli:' || x.c), x.nombre, x.rs, x.ciudad, x.edo, pg_temp.perfil(x.vend), x.credito, 'demo-rf-' || x.c
from (values
  ('agro',   'DEMO Agroindustrias del Bajío',         'Agroindustrias del Bajío S.A. de C.V.',   'León',        'Guanajuato', 'isaac@hegamex.com',  30),
  ('minera', 'DEMO Minera Santa Cruz',                'Minera Santa Cruz S.A. de C.V.',          'Fresnillo',   'Zacatecas',  'juan@hegamex.com',   0),
  ('granos', 'DEMO Granos Los Altos',                 'Granos y Semillas Los Altos S.P.R.',      'Tepatitlán',  'Jalisco',    'susana@hegamex.com', 15),
  ('concre', 'DEMO Concretos Tapatíos',               'Concretos Tapatíos S.A. de C.V.',         'Zapopan',     'Jalisco',    'isaac@hegamex.com',  30),
  ('ferti',  'DEMO Fertilizantes del Pacífico',       'Fertilizantes del Pacífico S.A. de C.V.', 'Culiacán',    'Sinaloa',    'juan@hegamex.com',   0),
  ('alba',   'DEMO Alimentos Balanceados Jalisco',    'Alimentos Balanceados de Jalisco S.A.',   'Arandas',     'Jalisco',    'susana@hegamex.com', 30),
  ('recic',  'DEMO Reciclados del Norte',             'Northern Recycling LLC',                  'Laredo',      'Texas',      'juan@hegamex.com',   0)
) x(c, nombre, rs, ciudad, edo, vend, credito)
where not exists (select 1 from public.clientes w where w.id = pg_temp.id('cli:' || x.c));

create temp table demo_ped (c text, cli text, dias int, estado public.estado_pedido, moneda public.moneda, tc numeric, vend text) on commit drop;
insert into demo_ped values
  ('p01', 'agro',   150, 'entregado',     'MXN', 1,     'isaac@hegamex.com'),
  ('p02', 'minera',  75, 'entregado',     'MXN', 1,     'juan@hegamex.com'),
  ('p03', 'granos',  40, 'en_produccion', 'MXN', 1,     'susana@hegamex.com'),
  ('p04', 'concre',  20, 'en_produccion', 'MXN', 1,     'isaac@hegamex.com'),
  ('p05', 'ferti',  100, 'entregado',     'MXN', 1,     'juan@hegamex.com'),
  ('p06', 'alba',    65, 'entregado',     'MXN', 1,     'susana@hegamex.com'),
  ('p07', 'recic',   10, 'confirmado',    'USD', 18.40, 'juan@hegamex.com'),
  ('p08', 'agro',   200, 'entregado',     'MXN', 1,     'isaac@hegamex.com'),
  ('p09', 'granos', 250, 'entregado',     'MXN', 1,     'susana@hegamex.com'),
  ('p10', 'concre', 130, 'entregado',     'MXN', 1,     'isaac@hegamex.com'),
  ('p11', 'minera', 300, 'entregado',     'MXN', 1,     'juan@hegamex.com'),
  ('p12', 'alba',    12, 'listo',         'MXN', 1,     'susana@hegamex.com');

insert into public.pedidos (id, cliente_id, vendedor_id, canal, fecha, fecha_compromiso, estado, moneda, tipo_cambio, condiciones_pago)
select pg_temp.id('ped:' || x.c), pg_temp.id('cli:' || x.cli), pg_temp.perfil(x.vend), 'directo', current_date - x.dias,
  current_date - x.dias + 30, x.estado, x.moneda, x.tc, '50% anticipo, 50% al aviso de la entrega.'
from demo_ped x
where exists (select 1 from public.clientes w where w.id = pg_temp.id('cli:' || x.cli))
  and not exists (select 1 from public.pedidos w where w.id = pg_temp.id('ped:' || x.c));

insert into public.pedido_lineas (id, pedido_id, orden, titulo, cantidad, precio_unitario, linea)
select pg_temp.id('lin:' || x.c || ':' || x.n), pg_temp.id('ped:' || x.c), x.n, x.titulo, x.cant, x.precio, x.linea::public.linea_venta
from (values
  ('p01', 1, 'Banda transportadora 18" x 12 m con motorreductor', 1, 285000, 'maquinaria'),
  ('p02', 1, 'Cribadora vibratoria 4'' x 8'' doble cama',           1, 640000, 'maquinaria'),
  ('p02', 2, 'Tolva de alimentación 10 m³',                         1, 185000, 'maquinaria'),
  ('p03', 1, 'Elevador de cangilones 15 m',                         1, 420000, 'maquinaria'),
  ('p04', 1, 'Dosificadora de agregados de 3 tolvas',               1, 780000, 'maquinaria'),
  ('p05', 1, 'Polea motriz 16" x 24"',                              4,   9800, 'refacciones'),
  ('p05', 2, 'Cangilón plástico 9" x 6"',                         300,    145, 'refacciones'),
  ('p06', 1, 'Transportador helicoidal 9" x 6 m',                   2,  96000, 'maquinaria'),
  ('p07', 1, 'Banda transportadora 24" x 20 m (exportación)',       1,  21500, 'maquinaria'),
  ('p08', 1, 'Banda transportadora 24" x 8 m',                      1, 198000, 'maquinaria'),
  ('p09', 1, 'Silo de 60 toneladas',                                1, 510000, 'maquinaria'),
  ('p10', 1, 'Catarina 60B18 maza 2 15/16"',                       12,   2350, 'refacciones'),
  ('p10', 2, 'Chumacera de piso 2 15/16"',                          8,   1890, 'refacciones'),
  ('p11', 1, 'Cribadora vibratoria 5'' x 12''',                     1, 890000, 'maquinaria'),
  ('p12', 1, 'Mezcladora horizontal de listón 2 ton',               1, 365000, 'maquinaria')
) x(c, n, titulo, cant, precio, linea)
where exists (select 1 from public.pedidos w where w.id = pg_temp.id('ped:' || x.c))
on conflict do nothing;

do $$ begin perform pg_temp.como('finanzas@hegamex.com'); end $$;

-- Facturas: el folio sigue la serie A de las hojas; no todas llevan UUID todavía.
insert into public.facturas (id, pedido_id, folio, uuid_sat, fecha, total)
select pg_temp.id('fac:' || x.c), p.id, x.folio,
  case when x.con_uuid then upper(substr(md5(x.folio), 1, 8) || '-' || substr(md5(x.folio), 9, 4) || '-4' || substr(md5(x.folio), 14, 3) || '-A' || substr(md5(x.folio), 18, 3) || '-' || substr(md5(x.folio), 21, 12)) end,
  current_date - x.dias, round(p.total * x.pct, 2)
from (values
  ('p01', 'A 3301', 120, 1.0, true),
  ('p02', 'A 3322',  60, 1.0, true),
  ('p03', 'A 3335',  40, 0.6, true),
  ('p05', 'A 3310',  98, 1.0, true),
  ('p06', 'A 3318',  62, 1.0, false),
  ('p08', 'A 3270', 195, 1.0, true),
  ('p09', 'A 3240', 248, 1.0, true),
  ('p10', 'A 3296', 128, 1.0, true),
  ('p11', 'A 3205', 298, 1.0, true),
  ('p12', 'A 3348',  10, 1.0, false)
) x(c, folio, dias, pct, con_uuid)
join public.pedidos p on p.id = pg_temp.id('ped:' || x.c)
where not exists (select 1 from public.facturas f where f.id = pg_temp.id('fac:' || x.c));

-- Cobros: anticipo y liquidación, como se cobran las máquinas.
insert into public.cobros (id, pedido_id, fecha, monto, metodo, referencia, notas)
select pg_temp.id('cob:' || x.c || ':' || x.n), p.id, current_date - x.dias, round(p.total * x.pct, 2), x.metodo, x.ref, x.notas
from (values
  ('p01', 1, 150, 0.50, 'transferencia', 'SPEI 8812201', 'Anticipo 50 %'),
  ('p01', 2, 100, 0.30, 'transferencia', 'SPEI 8840113', 'Abono a liquidación'),
  ('p02', 1,  75, 0.50, 'transferencia', 'SPEI 9001244', 'Anticipo 50 %'),
  ('p02', 2,  30, 0.25, 'cheque',        'Cheque 004512', 'Abono'),
  ('p03', 1,  40, 0.60, 'transferencia', 'SPEI 9120087', 'Anticipo 60 %'),
  ('p04', 1,  18, 0.50, 'transferencia', 'SPEI 9188730', 'Anticipo 50 %'),
  ('p06', 1,  65, 0.50, 'transferencia', 'SPEI 9050002', 'Anticipo 50 %'),
  ('p07', 1,   8, 0.30, 'transferencia', 'Wire 22871',   'Anticipo 30 % en dólares'),
  ('p08', 1, 200, 0.50, 'transferencia', 'SPEI 8700120', 'Anticipo 50 %'),
  ('p08', 2, 170, 0.50, 'transferencia', 'SPEI 8755004', 'Liquidación'),
  ('p09', 1, 250, 0.60, 'transferencia', 'SPEI 8610055', 'Anticipo 60 %'),
  ('p09', 2, 215, 0.40, 'transferencia', 'SPEI 8667319', 'Liquidación'),
  ('p10', 1, 110, 1.00, 'tarjeta',       'Terminal 4471', 'Pago de contado'),
  ('p11', 1, 300, 0.50, 'transferencia', 'SPEI 8500101', 'Anticipo 50 %'),
  ('p11', 2, 260, 0.50, 'transferencia', 'SPEI 8541999', 'Liquidación'),
  ('p12', 1,  12, 0.50, 'transferencia', 'SPEI 9201733', 'Anticipo 50 %')
) x(c, n, dias, pct, metodo, ref, notas)
join public.pedidos p on p.id = pg_temp.id('ped:' || x.c)
where not exists (select 1 from public.cobros w where w.id = pg_temp.id('cob:' || x.c || ':' || x.n));

-- ---------------------------------------------------------------------------
-- Pagos a proveedores: órdenes recibidas con saldo, algunas vencidas
-- ---------------------------------------------------------------------------
do $$ begin perform pg_temp.como('compras@hegamex.com'); end $$;

insert into public.proveedores (id, nombre, razon_social, categoria, moneda, dias_credito, es_importacion, pais, datos_bancarios, legacy_id)
select pg_temp.id('prov:' || x.c), x.nombre, x.rs, x.cat, x.mon::public.moneda, x.credito, x.mon <> 'MXN', x.pais, x.banco, 'demo-rf-' || x.c
from (values
  ('acero', 'DEMO Aceros del Centro',            'Aceros del Centro S.A. de C.V.',       'Acero',              'MXN', 30, 'México',         'BBVA CLABE 012320001234567891'),
  ('rodam', 'DEMO Rodamientos y Transmisiones',  'Rodamientos y Transmisiones de Occidente S.A.', 'Rodamientos', 'MXN', 15, 'México', 'Santander CLABE 014320655001234567'),
  ('pintu', 'DEMO Pinturas Industriales GDL',    'Pinturas Industriales de Guadalajara S.A.', 'Pintura',        'MXN', 30, 'México',         'Banorte CLABE 072320011223344556'),
  ('motor', 'DEMO Motores Eléctricos SA',        'Motores Eléctricos de Occidente S.A.',  'Motores y reductores', 'MXN', 45, 'México',       'BBVA CLABE 012320009988776655'),
  ('banda', 'DEMO Bandas Importadas LLC',        'Imported Belting LLC',                  'Bandas',             'USD', 60, 'Estados Unidos', 'Wire: Chase 021000021 · 7788990011')
) x(c, nombre, rs, cat, mon, credito, pais, banco)
where not exists (select 1 from public.proveedores w where w.id = pg_temp.id('prov:' || x.c))
on conflict do nothing;

create temp table demo_oc (c text, prov text, dias int, vence int, estado text, moneda public.moneda, tc numeric, factura text) on commit drop;
insert into demo_oc values
  ('oc1', 'acero', 50, -20, 'recibida', 'MXN', 1,     'F-102868'),
  ('oc2', 'rodam', 25, -10, 'recibida', 'MXN', 1,     'A-22160'),
  ('oc3', 'pintu', 20,  10, 'recibida', 'MXN', 1,     'PI-5531'),
  ('oc4', 'motor', 15,  20, 'parcial',  'MXN', 1,     'ME-9087'),
  ('oc5', 'banda', 40,   3, 'recibida', 'USD', 18.45, 'INV-77120'),
  ('oc6', 'acero', 10,  20, 'parcial',  'MXN', 1,     'F-103122'),
  ('oc7', 'pintu', 70, -40, 'recibida', 'MXN', 1,     'PI-5410'),
  ('oc8', 'rodam',  8,   6, 'recibida', 'MXN', 1,     'A-22301'),
  ('oc9', 'acero', 33,  -3, 'recibida', 'MXN', 1,     'F-102990');

insert into public.ordenes_compra (id, proveedor_id, estado, fecha, fecha_entrega, moneda, tipo_cambio, factura_proveedor, vence_pago, notas)
select pg_temp.id('oc:' || x.c), pg_temp.id('prov:' || x.prov), x.estado, current_date - x.dias, current_date - x.dias + 7,
  x.moneda, x.tc, x.factura, current_date + x.vence, 'Demostración'
from demo_oc x
where exists (select 1 from public.proveedores w where w.id = pg_temp.id('prov:' || x.prov))
  and not exists (select 1 from public.ordenes_compra w where w.id = pg_temp.id('oc:' || x.c));

-- Partidas sin artículo (material descrito): no mueven inventario, solo la cuenta por pagar.
insert into public.oc_lineas (id, orden_compra_id, descripcion, cantidad, costo_unitario, recibido)
select pg_temp.id('ocl:' || x.c || ':' || x.n), pg_temp.id('oc:' || x.c), x.descr, x.cant, x.costo, x.rec
from (values
  ('oc1', 1, 'Lámina negra cal. 10 4'' x 10''',     40, 2850,  40),
  ('oc1', 2, 'PTR 4" x 4" cal. 11 (tramo 6 m)',     30, 1480,  30),
  ('oc2', 1, 'Chumacera de piso 2 15/16"',          12, 1650,  12),
  ('oc2', 2, 'Rodamiento 6310 2RS',                 40,  310,  40),
  ('oc3', 1, 'Esmalte alquidálico azul (cubeta 19 L)', 10, 2100, 10),
  ('oc3', 2, 'Primario anticorrosivo (cubeta 19 L)',   5, 1170,  5),
  ('oc4', 1, 'Motorreductor 5 HP 1:30',              4, 18500,  2),
  ('oc4', 2, 'Motor trifásico 10 HP',                2, 11000,  2),
  ('oc5', 1, 'Belt EP-400 24" x 3 plies (ft)',     200,    36, 200),
  ('oc6', 1, 'Placa A36 1/2" 4'' x 8''',             8, 7200,   4),
  ('oc7', 1, 'Thinner estándar (tambo)',             3, 4300,   3),
  ('oc8', 1, 'Catarina 60B18 maza 2 15/16"',        10, 1290,  10),
  ('oc9', 1, 'Ángulo 2" x 1/4" (tramo 6 m)',        60,  690,  60)
) x(c, n, descr, cant, costo, rec)
where exists (select 1 from public.ordenes_compra w where w.id = pg_temp.id('oc:' || x.c))
on conflict do nothing;

do $$ begin perform pg_temp.como('finanzas@hegamex.com'); end $$;
insert into public.pagos_proveedor (id, orden_compra_id, fecha, monto, metodo, referencia)
select pg_temp.id('pag:' || x.c || ':' || x.n), o.id, current_date - x.dias, round(o.total * x.pct, 2), 'transferencia', x.ref
from (values
  ('oc1', 1, 15, 0.35, 'SPEI 7710021'),
  ('oc5', 1, 38, 0.30, 'Wire 55120 (anticipo)'),
  ('oc7', 1, 40, 1.00, 'SPEI 7600344'),
  ('oc9', 1,  5, 0.50, 'SPEI 7799120')
) x(c, n, dias, pct, ref)
join public.ordenes_compra o on o.id = pg_temp.id('oc:' || x.c)
where not exists (select 1 from public.pagos_proveedor w where w.id = pg_temp.id('pag:' || x.c || ':' || x.n));

-- Historial de tipo de cambio (días hábiles del último mes) para la pantalla de configuración.
-- Solo días anteriores a hoy: no cambia el tipo de cambio vigente.
insert into public.tipos_cambio (fecha, moneda, valor, fuente)
select g::date, 'USD', round((18.35 + 0.25 * sin(extract(doy from g) / 4.0) + 0.05 * cos(extract(doy from g)))::numeric, 4), 'demo'
from generate_series(current_date - 30, current_date - 1, interval '1 day') g
where extract(isodow from g) < 6
on conflict do nothing;

commit;

select (select count(*) from public.empleados where numero between '1001' and '1028') as empleados_demo,
       (select count(*) from public.incidencias i join public.empleados e on e.id = i.empleado_id where e.numero between '1001' and '1028') as incidencias_demo,
       (select count(*) from public.pedidos p join public.clientes c on c.id = p.cliente_id where c.legacy_ref like 'demo-rf-%') as pedidos_demo,
       (select count(*) from public.v_por_pagar v join public.proveedores p on p.id = v.proveedor_id where p.legacy_id like 'demo-rf-%') as oc_por_pagar_demo;

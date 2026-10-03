-- =============================================================================
-- Objetivos, bonos y prenómina.
--
-- Hoy el bono es una hoja con una pestaña por persona donde alguien escribe a
-- mano, al cierre del mes, el % logrado de cada objetivo. No queda la cuenta de
-- incidencias que lo justifica, la regla más fuerte (celular → bono 0) no está
-- en ninguna fórmula (se borra el total y se escribe 0), no hay tope (un mes
-- llegó a 109 %) y los evaluados pueden editar su propia calificación. La
-- nómina semanal se copia en bloques de 60 filas y paga dobles todas las horas
-- extra aunque pasen de 9 a la semana (LFT art. 68 manda triples).
--
-- Aquí la base:
--  * guarda los 61 indicadores de la hoja y plantillas por puesto con vigencia,
--    con los seis tipos de regla que de verdad se usan (meta, descuento por
--    incidencia, una incidencia = 0, proporcional, escalón y llave);
--  * arma el borrador del mes con los 17 indicadores que ya puede medir sola y
--    guarda la evidencia de cada resultado (qué órdenes, pedidos, ajustes…);
--  * lleva el flujo borrador → calificada (jefe) → revisada (RRHH) → aprobada
--    (dirección). Lo aprobado no se toca: un error se corrige con un ajuste que
--    autoriza otra persona. Nadie se califica a sí mismo;
--  * calcula la prenómina semanal (viernes a jueves, se paga el viernes) desde
--    las incidencias aprobadas y la congela al cerrarla.
--
-- Montos (sueldos, bonos, prenómina) viven en el módulo "nomina", aparte de
-- "objetivos", igual que los costos frente a ventas: un jefe califica a su gente
-- sin ver cuánto gana. Lo fiscal (ISR, IMSS, timbrado y la división fiscal /
-- no fiscal) lo hace el contador; aquí se registra qué se le paga a cada quien
-- y por qué concepto.
--
-- PENDIENTE DEL DUEÑO: cuánto vale el bono. bono_bases nace vacía y mientras lo
-- esté nadie ve un monto inventado: solo el % y "Falta definir la base del bono".
--
-- Re-ejecutable (la base local es compartida y se aplica con psql).
-- Pruebas: supabase/pruebas/95_objetivos_prenomina.sql.
-- =============================================================================

-- ----------------------------------------------------------------------------
-- 1. Permisos: "objetivos" (calificar) y "nomina" (dinero), separados
-- ----------------------------------------------------------------------------
-- Nivel 1 en objetivos = jefe: ve y califica solo a su gente (la RLS filtra por
-- evaluador). Nivel 3 = RRHH y dirección: todo el mundo, plantillas y revisión.
insert into public.permisos_rol (rol, modulo, nivel) values
  ('direccion', 'objetivos', 3), ('rrhh', 'objetivos', 3),
  ('gerente_produccion', 'objetivos', 1), ('gerente_ventas', 'objetivos', 1),
  ('compras', 'objetivos', 1), ('almacen', 'objetivos', 1),
  ('direccion', 'nomina', 3), ('rrhh', 'nomina', 3), ('finanzas', 'nomina', 1)
on conflict (rol, modulo) do nothing;

-- El empleado ligado a quien pregunta. security definer: un almacenista no ve
-- la tabla de empleados, pero sí necesita saber cuál es su propia ficha.
create or replace function public.mi_empleado() returns uuid
language sql stable security definer set search_path = public as $$
  select id from empleados where usuario_id = auth.uid()
$$;

create or replace function public.objetivo_nombre_mes(p date) returns text
language sql immutable as $$
  select (array['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre',
                'noviembre', 'diciembre'])[extract(month from p)::int] || ' ' || extract(year from p)::int
$$;

-- ----------------------------------------------------------------------------
-- 2. Catálogos: puestos, indicadores y áreas del checklist
-- ----------------------------------------------------------------------------
-- En la nómina el catálogo de puestos está roto (el rango apunta a otra
-- columna) y en objetivos cada pestaña es de una persona. Aquí el puesto es
-- de verdad un catálogo y la persona se asigna a él con fecha.
create table if not exists public.puestos (
  id serial primary key,
  nombre text not null unique,
  departamento_id int references public.departamentos(id),
  descripcion text,
  activo boolean not null default true,
  creado_en timestamptz not null default now()
);

insert into public.puestos (nombre, departamento_id, descripcion)
select x.nombre, d.id, x.descripcion
from (values
  ('Marketing', 'Ventas', 'Ventas del mes, contenido, reseñas y gasto de marketing.'),
  ('Atención a prospectos web', 'Ventas', 'Formularios, chats y llamadas del sitio; asignación a vendedores.'),
  ('Compras', 'Compras', 'Material a tiempo, costos vigentes, proveedores y facturas.'),
  ('Importaciones y manuales técnicos', 'Compras', 'Importaciones, agente aduanal y manuales y fichas técnicas.'),
  ('Supervisor de producción', 'Producción', 'Entregas a tiempo, retrabajos, seguridad y su gente.'),
  ('Ayudante de supervisor', 'Producción', 'Apoyo al supervisor en piso.'),
  ('Calidad', 'Producción', 'Checklist de equipos, garantías y EPP del personal.'),
  ('Diseño industrial', 'Ingeniería', 'Planos, listas de material y retrabajos por diseño.'),
  ('Ingeniería de control eléctrico', 'Ingeniería', 'Diagramas, tableros, puesta en marcha.'),
  ('Encargado de almacén', 'Almacén', 'Existencias, reabasto, conteos y empaque.'),
  ('Auxiliar de almacén', 'Almacén', 'Surtido a producción y orden de almacenes.'),
  ('Chofer, montacarguista y auxiliar de almacén', 'Almacén', 'Recepción de proveedores, rutas y vehículos.')
) x(nombre, depto, descripcion)
left join public.departamentos d on d.nombre = x.depto
on conflict (nombre) do nothing;

-- Los 61 indicadores distintos que salen de juntar los textos de la hoja.
-- fuente: automatica = la base lo calcula con tablas que ya existen;
--         checklist = se marca a diario en el celular y la base lo cuenta;
--         manual = lo califica el jefe (o falta un dato para medirlo solo);
--         externa = viene de Meta, Google o el chat: captura mensual con evidencia.
create table if not exists public.objetivo_indicadores (
  id int primary key,                       -- el número del análisis de la hoja (1 a 61)
  clave text not null unique,
  nombre text not null,
  area text not null check (area in ('ventas', 'compras', 'ingenieria', 'produccion', 'almacen', 'general')),
  fuente text not null check (fuente in ('automatica', 'checklist', 'manual', 'externa')),
  checklist text check (checklist in ('epp', 'limpieza', 'celular', 'vehiculo')),
  unidad text not null,
  descripcion text not null,
  dato_faltante text,                       -- qué campo o evento falta para que se mida solo
  activo boolean not null default true,
  check ((fuente = 'checklist') = (checklist is not null))
);

insert into public.objetivo_indicadores (id, clave, nombre, area, fuente, checklist, unidad, descripcion, dato_faltante, activo) values
  (1, 'ventas_mes', 'Ventas del mes', 'ventas', 'automatica', null, 'pesos',
   'Pedidos del mes sin IVA ni cancelados, en pesos al tipo de cambio del pedido. En la hoja: "Ventas ≥ $2,000,000 mensual".', null, true),
  (2, 'crecimiento_ventas', 'Crecimiento de ventas contra el mes anterior', 'ventas', 'automatica', null, '%',
   'Ventas del mes contra las del mes anterior, con el mismo criterio. En la hoja: "≥ 5 %".', null, true),
  (3, 'visitantes_blog', 'Crecimiento de visitantes únicos al blog', 'ventas', 'externa', null, '%',
   'De Google Analytics: se captura una vez al mes con la liga del reporte.', null, true),
  (4, 'ctr_meta', 'CTR en anuncios de Meta', 'ventas', 'externa', null, '%',
   'De Meta Ads, captura mensual con evidencia. En la hoja: "≥ 3.8 %"; ya se retiró.', null, false),
  (5, 'alcance_meta', 'Alcance orgánico en Meta', 'ventas', 'externa', null, 'personas',
   'De Meta, captura mensual con evidencia. En la hoja: "≥ 100 mil"; ya se retiró.', null, false),
  (6, 'resenas_google', 'Reseñas reales en Google Maps', 'ventas', 'externa', null, 'reseñas',
   'Reseñas nuevas del mes, con la liga. En la hoja: "≥ 2 al mes".', null, true),
  (7, 'gastos_marketing', 'Control de gastos de marketing en la presentación mensual', 'ventas', 'manual', null, 'entregables',
   'Entregable mensual: la presentación con el gasto registrado. 1 = se entregó.', null, true),
  (8, 'plan_marketing', 'Plan de estrategia de marketing quincenal', 'ventas', 'manual', null, 'entregables',
   'Planes entregados en el mes (uno por quincena).', null, true),
  (9, 'video_mensual', 'Video semiprofesional de un equipo de línea', 'ventas', 'manual', null, 'videos',
   'Videos publicados en el mes, con la liga de YouTube.', null, true),
  (10, 'seguimiento_prospectos', 'Seguimiento a prospectos en 7 días', 'ventas', 'automatica', null, '%',
   'Oportunidades creadas en el mes con al menos 2 actividades en sus primeros 7 días. Cada una sin ese seguimiento es una incidencia. En la hoja nunca se calificó.', null, true),
  (11, 'primer_contacto', 'Primer contacto el mismo día a formularios', 'ventas', 'manual', null, '%',
   'Formularios del sitio contestados el mismo día.', 'Que el formulario web entre como oportunidad con su hora de llegada.', true),
  (12, 'asignacion_4h', 'Asignar formularios y correos de cotización en 4 horas', 'ventas', 'manual', null, '%',
   'Solicitudes asignadas a un vendedor en 4 horas o menos.', 'Hora de llegada y hora de asignación del vendedor en la oportunidad.', true),
  (13, 'chats_perdidos', 'Chats perdidos en el sitio en horario laboral', 'ventas', 'externa', null, 'chats',
   'De la herramienta de chat del sitio, captura mensual con evidencia.', null, true),
  (14, 'conversiones_registradas', 'Conversiones registradas', 'ventas', 'automatica', null, '%',
   'Pedidos del mes (sin Mercado Libre, Amazon ni históricos) que vienen de una cotización del ERP. Cada pedido suelto es una incidencia. Con el ERP la conversión se registra sola.', null, true),
  (15, 'llamadas_registradas', 'Llamadas registradas con datos completos', 'ventas', 'manual', null, '%',
   'Llamadas del mes con cliente, motivo y resultado.', 'Actividades tipo llamada; se puede cruzar con el registro de la recepción telefónica.', true),
  (16, 'redes_sin_perdidos', 'Chats perdidos o comentarios negativos en redes', 'ventas', 'externa', null, 'chats',
   'Captura mensual con evidencia (importaciones, hasta dic 2024).', null, false),
  (17, 'credito_proveedor', 'Crédito nuevo con proveedor', 'compras', 'manual', null, 'créditos',
   'Condiciones de crédito nuevas conseguidas en el mes (días de crédito en la ficha del proveedor).', null, true),
  (18, 'material_a_tiempo_compras', 'Material pedido a tiempo (compras)', 'compras', 'manual', null, 'incidencias',
   'Retrasos de fabricación por material que llegó tarde o equivocado.',
   'Comparar la fecha "necesaria para" de la requisición contra la entrega y la recepción de la OC; material equivocado como devolución o ajuste con causa.', true),
  (19, 'costos_vigentes', 'Costos de componentes de línea vigentes', 'compras', 'automatica', null, 'artículos',
   'Componentes y materia prima que usa algún equipo o subensamble activo, con costo actualizado en los 3 meses anteriores al cierre del mes. Cada uno vencido o sin costo es una incidencia (se enseña la fecha, nunca el costo).', null, true),
  (20, 'proveedores_nuevos', 'Proveedores nuevos', 'compras', 'automatica', null, 'proveedores',
   'Proveedores dados de alta en el mes que ya tienen su primera orden de compra en el mes.', null, true),
  (21, 'facturas_compra', 'Facturas de compra solicitadas y recibidas a tiempo', 'compras', 'manual', null, 'incidencias',
   'Crédito ≤ 5 días hábiles, complemento ≤ 2, anticipo ≤ 2.', 'Fecha en que se recibió la factura y el complemento en la orden de compra.', true),
  (22, 'proveedores_importacion', 'Proveedores de importación propuestos', 'compras', 'manual', null, 'proveedores',
   'Proveedores de importación o equipos para importar propuestos en el mes.', null, true),
  (23, 'gastos_importacion', 'Gastos de importación por documentos tardíos', 'compras', 'manual', null, 'incidencias',
   'Gastos con el agente aduanal por mandar tarde los documentos, cada uno con su pedimento.', null, true),
  (24, 'manuales_importacion', 'Manuales de procesos de importación', 'compras', 'manual', null, 'entregables',
   'Avance de los manuales de procesos de importación (evaluación del jefe).', null, true),
  (25, 'manuales_fichas', 'Manuales y fichas técnicas a tiempo', 'ingenieria', 'manual', null, 'incidencias',
   'Manuales y fichas entregados según el aviso de pedido.', 'Entregable "manual" por pedido u orden con fecha compromiso.', true),
  (26, 'planos_a_tiempo', 'Planos y dibujos a tiempo y en su carpeta', 'ingenieria', 'manual', null, 'incidencias',
   'Ningún equipo nuevo sin planos.', 'Plano obligatorio para liberar la orden (la revisión de ingeniería ya existe; falta el adjunto).', true),
  (27, 'retrabajos_diseno', 'Retrabajos por diseño', 'ingenieria', 'manual', null, 'incidencias',
   'Dibujo sin actualizar o código equivocado a plasma.', 'Problemas en la orden con causa (diseño, personal, material) y responsable.', true),
  (28, 'materiales_por_cliente', 'Material completo al liberar', 'ingenieria', 'automatica', null, '%',
   'Órdenes liberadas en el mes: es incidencia la que se liberó sin lista de material o a la que se le cambió material después de liberarla.', null, true),
  (29, 'desarrollo_auxiliar_diseno', 'Supervisar y desarrollar al auxiliar de diseño', 'ingenieria', 'manual', null, 'puntos',
   'Evaluación del jefe.', null, true),
  (30, 'diagramas_electricos', 'Diagramas eléctricos a tiempo para las fichas técnicas', 'ingenieria', 'manual', null, 'incidencias',
   'Diagramas entregados a tiempo por orden.', 'Entregable por orden con fecha compromiso.', true),
  (31, 'diagramas_carpeta', 'Diagramas de conexiones en alta calidad en su carpeta', 'ingenieria', 'manual', null, 'incidencias',
   'Diagramas subidos completos y legibles.', 'Adjunto en la orden o en el artículo.', true),
  (32, 'errores_con_gasto', 'Errores con gasto (material dañado, aparatos quemados)', 'ingenieria', 'manual', null, 'incidencias',
   'Material dañado, aparatos quemados o conexiones mal hechas.', 'Ajuste de inventario por daño con responsable y causa.', true),
  (33, 'puesta_en_marcha', 'Puesta en marcha y calibración sin errores ni garantías', 'ingenieria', 'manual', null, 'incidencias',
   'Errores o garantías en la puesta en marcha.', 'Garantía ligada al pedido con causa.', true),
  (34, 'manuales_variadores_llaves', 'Manuales de variadores y llaves de gabinetes entregados', 'ingenieria', 'manual', null, 'incidencias',
   'Si falta uno, el indicador vale 0.', 'Lista de entrega del pedido.', true),
  (35, 'retrabajos_garantias', 'Retrabajos y garantías por errores del personal', 'produccion', 'manual', null, 'puntos',
   'Se capturan en unidades: reproceso = 1, retrabajo con reposición = 2, garantía = 4.', 'Problemas en la orden con gravedad (reproceso, reposición, garantía), causa y responsable.', true),
  (36, 'entregas_a_tiempo', 'Entrega de equipos a tiempo (incluidos los de stock)', 'produccion', 'automatica', null, '%',
   'Órdenes de producción con compromiso en el mes: es incidencia cada una terminada después de su fecha (o abierta al cierre del mes).', null, true),
  (37, 'inicio_sin_orden', 'Ningún equipo empezado sin orden y planos', 'produccion', 'automatica', null, '%',
   'Órdenes que empezaron en el mes sin la revisión de ingeniería. El ERP ya no deja liberar sin ella: debería salir en cero.', null, true),
  (38, 'checklist_calidad', 'Checklist de calidad de cada equipo entregado', 'produccion', 'manual', null, 'incidencias',
   'Equipos entregados o de stock sin checklist.', 'Etapa obligatoria "calidad" en las operaciones de la orden.', true),
  (39, 'garantias_no_detectadas', 'Garantías por fallas no detectadas en el checklist', 'produccion', 'manual', null, 'incidencias',
   'Una garantía por falla que el checklist debió detectar.', 'Garantía ligada a la orden con causa.', true),
  (40, 'bitacora_incidencias', 'Incidencias registradas en la bitácora', 'produccion', 'automatica', null, 'registros',
   'Problemas que la persona registró en las órdenes de producción en el mes. Si no tiene usuario, se califica a mano.', null, true),
  (41, 'video_prueba', 'Video de prueba antes de entregar', 'produccion', 'manual', null, 'incidencias',
   'Equipos entregados sin el video de prueba.', 'Adjunto obligatorio antes de marcar la orden como entregada.', true),
  (42, 'cero_accidentes', 'Cero accidentes y uso de EPP del personal', 'produccion', 'manual', null, 'puntos',
   'Rebaba = 1, accidente con consulta = 2, con incapacidad = 3. Si el EPP del personal baja de 90 %, vale 0.', 'Marcar la incapacidad como riesgo de trabajo; capturar las rebabas.', true),
  (43, 'desarrollo_personal', 'Plan de desarrollo y capacitación del personal', 'general', 'manual', null, 'puntos',
   'Evaluación del jefe.', null, true),
  (44, 'rotacion', 'Bajas por mal liderazgo', 'produccion', 'manual', null, 'bajas',
   'Bajas de su gente por mal liderazgo (lo juzga una persona).', 'Motivo de baja con causa en la ficha del empleado.', true),
  (45, 'exactitud_inventario', 'Existencias, nombres y ubicaciones correctas', 'almacen', 'automatica', null, 'incidencias',
   'Ajustes de inventario del mes con diferencia; los rechazados no cuentan. Se puede limitar a ciertos almacenes.', null, true),
  (46, 'material_a_tiempo_almacen', 'Material pedido a tiempo (almacén)', 'almacen', 'automatica', null, 'artículos',
   'Foto al cierre del mes: artículos bajo su punto de reorden sin requisición abierta ni compra en camino.', null, true),
  (47, 'material_pedido_de_mas', 'No pedir material que ya había en planta', 'almacen', 'automatica', null, 'partidas',
   'Partidas de requisición manuales o de reabasto del mes de artículos que en ese momento ya tenían en planta la cantidad pedida (sin descontar lo apartado: si estaba apartado, se impugna con el motivo).', null, true),
  (48, 'desabasto', 'Desabasto de almacén', 'almacen', 'automatica', null, '%',
   'Foto al cierre del mes: % de artículos con punto de reorden cuya existencia en planta está por debajo. La hoja decía "óptimo, aceptable, deficiente" sin definirlo; los escalones van en la plantilla.', null, true),
  (49, 'movimientos_mismo_dia', 'Entradas y salidas registradas el mismo día', 'almacen', 'manual', null, 'incidencias',
   'Movimientos registrados tarde o con la unidad equivocada.', 'Fecha de llegada física para compararla con la del movimiento.', true),
  (50, 'inventario_herramientas', 'Inventario de herramientas', 'almacen', 'automatica', null, 'conteos',
   'Conteos cerrados en el mes con "herramienta" en el nombre. La hoja pedía uno cada 15 días.', null, true),
  (51, 'empaque_a_tiempo', 'Empacar a tiempo pedidos de clientes y de Mercado Libre', 'almacen', 'manual', null, 'incidencias',
   'Pedidos empacados después de su fecha límite.', 'Fecha límite de envío y fecha de empaque en el pedido.', true),
  (52, 'surtido_produccion', 'Material surtido a producción', 'almacen', 'automatica', null, '%',
   'Órdenes terminadas en el mes: es incidencia la que terminó con material sin surtir completo.', null, true),
  (53, 'recepcion_oc', 'Recibir de proveedores lo pedido', 'almacen', 'automatica', null, '%',
   'Órdenes de compra con entradas en el mes: incidencia si se recibió de más o si quedó incompleta con su fecha de entrega vencida.', null, true),
  (54, 'puntualidad_rutas', 'Puntualidad de salidas y llegadas de rutas', 'almacen', 'manual', null, 'incidencias',
   'Salidas o llegadas fuera de horario.', 'Registro de salida y llegada de cada ruta.', true),
  (55, 'revision_vehiculos', 'Revisión diaria de vehículos y montacargas', 'almacen', 'checklist', 'vehiculo', 'días',
   'Niveles, llantas y documentos, marcado en el checklist diario. Proporcional a los días marcados.', null, true),
  (56, 'orden_almacenes', 'Orden, acomodo y seguridad de almacenes', 'almacen', 'checklist', 'limpieza', 'días',
   'Material en su lugar, puertas y cadena; checklist diario por área.', null, true),
  (57, 'mejoras_almacen', 'Mejoras en almacén y errores en general', 'almacen', 'manual', null, 'puntos',
   'Evaluación del jefe: mejoras propuestas, contenedor ordenado, errores en general.', null, true),
  (58, 'uso_epp', 'Uso de EPP (casco, botas, guantes)', 'general', 'checklist', 'epp', 'días',
   'Lo marca calidad en el checklist diario. Proporcional a los días marcados: un día sin marca no cuenta en contra.', null, true),
  (59, 'limpieza_areas', 'Limpieza y orden de áreas', 'general', 'checklist', 'limpieza', 'días',
   'Checklist diario por área. Una marca afecta a todos los que comparten el área.', null, true),
  (60, 'entrega_celular', 'Entrega del celular', 'general', 'checklist', 'celular', 'días',
   'Tres momentos al día (entrada, break 1, break 2). Un día cuenta como incumplido si falló en cualquiera.', null, true),
  (61, 'actividades_asignadas', 'Actividades asignadas por dirección y supervisión', 'general', 'manual', null, 'puntos',
   'Evaluación del jefe (en la hoja era una propuesta sin peso).', null, true)
on conflict (id) do nothing;

-- Áreas del checklist de limpieza y orden. Una marca a un área cuenta para
-- todos los que la tienen en su plantilla: el mismo desorden ya no le quita
-- el 5 % a tres personas o a ninguna según quién califique.
create table if not exists public.objetivo_areas (
  id serial primary key,
  nombre text not null unique,
  activa boolean not null default true
);
insert into public.objetivo_areas (nombre) values
  ('Pintura'), ('Comedor'), ('Plasma'), ('Torno'), ('Chatarra'), ('Mesa de trabajo eléctrica'),
  ('Almacén planta'), ('Contenedores'), ('Revolución')
on conflict (nombre) do nothing;

-- ----------------------------------------------------------------------------
-- 3. Plantillas por puesto con vigencia
-- ----------------------------------------------------------------------------
create table if not exists public.objetivo_plantillas (
  id uuid primary key default gen_random_uuid(),
  puesto_id int references public.puestos(id),
  empleado_id uuid references public.empleados(id),      -- ajuste propio de una persona
  desde date not null check (desde = date_trunc('month', desde)),
  hasta date,                                            -- último mes en que aplica; null = vigente
  notas text,
  creada_por uuid default auth.uid() references public.perfiles(id),
  creada_en timestamptz not null default now(),
  check (num_nonnulls(puesto_id, empleado_id) = 1),
  check (hasta is null or (hasta = date_trunc('month', hasta) and hasta >= desde))
);

-- Reglas (las seis que aparecen en los textos de la hoja):
--  meta            valor ≥ meta (o ≤ si sentido = 'menor') → todo el peso, si no 0
--  descuento       peso − incidencias × descuento ("1 entrega tarde = −10 de 20")
--  una_incidencia  una sola incidencia → 0
--  proporcional    peso × cumplidos / posibles (días marcados, o calificación del jefe sobre su escala)
--  escalon         [{limite, pct}]: el primer escalón que alcanza da su %
--  llave           llave_limite incumplimientos en el mes → el bono TOTAL vale 0
create table if not exists public.objetivo_plantilla_lineas (
  id uuid primary key default gen_random_uuid(),
  plantilla_id uuid not null references public.objetivo_plantillas(id) on delete cascade,
  orden int not null default 0,
  indicador_id int not null references public.objetivo_indicadores(id),
  peso numeric(5,2) not null check (peso > 0 and peso <= 100),
  regla text not null check (regla in ('meta', 'descuento', 'una_incidencia', 'proporcional', 'escalon', 'llave')),
  meta numeric(16,2),
  sentido text not null default 'mayor' check (sentido in ('mayor', 'menor')),
  descuento numeric(6,2) check (descuento > 0),
  escalones jsonb,
  llave_limite int check (llave_limite > 0),
  parametros jsonb not null default '{}'::jsonb,         -- {"areas": [..]}, {"almacenes": [..]}, {"escala": 10}
  texto text,                                            -- cómo lo lee la persona
  check (regla <> 'meta' or meta is not null),
  check (regla <> 'descuento' or descuento is not null),
  check (regla <> 'escalon' or jsonb_typeof(escalones) = 'array'),
  check (regla <> 'llave' or llave_limite is not null)
);
create index if not exists objetivo_plantilla_lineas_plantilla on public.objetivo_plantilla_lineas (plantilla_id, orden);

-- Una sola versión vigente por puesto (o persona) en cada mes.
create or replace function public.validar_plantilla_objetivos() returns trigger
language plpgsql set search_path = public as $$
begin
  if exists (select 1 from objetivo_plantillas p
             where p.id <> new.id
               and p.puesto_id is not distinct from new.puesto_id and p.empleado_id is not distinct from new.empleado_id
               and daterange(p.desde, p.hasta, '[]') && daterange(new.desde, new.hasta, '[]')) then
    raise exception 'Ya hay otra plantilla vigente en esos meses para ese puesto: ciérrala (mes "hasta") o empieza la nueva después';
  end if;
  return new;
end $$;
drop trigger if exists validar on public.objetivo_plantillas;
create trigger validar before insert or update on public.objetivo_plantillas
  for each row execute function public.validar_plantilla_objetivos();

-- Una plantilla con la que ya se calificó a alguien no se reescribe: la
-- historia de "qué se le pedía en marzo" se pierde. Se crea una versión nueva
-- desde el mes siguiente (y la anterior se cierra sola). Solo se puede tocar
-- "hasta" y las notas.
create or replace function public.proteger_plantilla_usada() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_plantilla uuid;
begin
  if tg_table_name = 'objetivo_plantillas' then
    v_plantilla := case when tg_op = 'DELETE' then old.id else new.id end;
    if tg_op = 'UPDATE' and new.desde = old.desde and new.puesto_id is not distinct from old.puesto_id
       and new.empleado_id is not distinct from old.empleado_id then
      return new;
    end if;
  else
    v_plantilla := case when tg_op = 'DELETE' then old.plantilla_id else new.plantilla_id end;
  end if;
  if exists (select 1 from objetivo_evaluaciones e where e.plantilla_id = v_plantilla and e.estado <> 'borrador') then
    raise exception 'Con esta plantilla ya se calificó a alguien: crea una versión nueva desde el mes siguiente' using errcode = '42501';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;

-- Pesos que suman 100. Diferido: al guardar una plantilla se insertan los
-- renglones uno por uno y la suma solo tiene sentido al final.
create or replace function public.validar_pesos_plantilla() returns trigger
language plpgsql set search_path = public as $$
declare v_id uuid; v_suma numeric;
begin
  -- En plpgsql cada rama se resuelve al ejecutarse: con un solo CASE, la
  -- plantilla (que no tiene plantilla_id) no compila.
  if tg_table_name = 'objetivo_plantillas' then v_id := new.id;
  elsif tg_op = 'DELETE' then v_id := old.plantilla_id;
  else v_id := new.plantilla_id;
  end if;
  if not exists (select 1 from objetivo_plantillas where id = v_id) then return null; end if;
  select coalesce(sum(peso), 0) into v_suma from objetivo_plantilla_lineas where plantilla_id = v_id;
  if v_suma <> 100 then
    raise exception 'Los pesos de la plantilla suman % y deben sumar 100', trim_scale(v_suma) using errcode = '23514';
  end if;
  return null;
end $$;
drop trigger if exists pesos_100 on public.objetivo_plantilla_lineas;
create constraint trigger pesos_100 after insert or update or delete on public.objetivo_plantilla_lineas
  deferrable initially deferred for each row execute function public.validar_pesos_plantilla();
drop trigger if exists pesos_100 on public.objetivo_plantillas;
create constraint trigger pesos_100 after insert on public.objetivo_plantillas
  deferrable initially deferred for each row execute function public.validar_pesos_plantilla();

-- ----------------------------------------------------------------------------
-- 4. Persona → puesto, con fecha y jefe directo (quien la califica)
-- ----------------------------------------------------------------------------
create table if not exists public.puesto_asignaciones (
  id uuid primary key default gen_random_uuid(),
  empleado_id uuid not null references public.empleados(id) on delete cascade,
  puesto_id int not null references public.puestos(id),
  jefe_id uuid references public.perfiles(id),
  desde date not null,
  hasta date,
  nota text,
  creado_por uuid default auth.uid() references public.perfiles(id),
  creado_en timestamptz not null default now(),
  check (hasta is null or hasta >= desde)
);
create index if not exists puesto_asignaciones_empleado on public.puesto_asignaciones (empleado_id, desde desc);
create index if not exists puesto_asignaciones_jefe on public.puesto_asignaciones (jefe_id);

create or replace function public.validar_asignacion_puesto() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.jefe_id is not null and exists (select 1 from empleados where id = new.empleado_id and usuario_id = new.jefe_id) then
    raise exception 'Nadie califica su propio objetivo: el jefe directo no puede ser la misma persona' using errcode = '42501';
  end if;
  if exists (select 1 from puesto_asignaciones a where a.empleado_id = new.empleado_id and a.id <> new.id
             and daterange(a.desde, a.hasta, '[]') && daterange(new.desde, new.hasta, '[]')) then
    raise exception 'Esa persona ya tiene un puesto en esas fechas: cierra el anterior (fecha "hasta") antes de asignar otro';
  end if;
  return new;
end $$;
drop trigger if exists validar on public.puesto_asignaciones;
create trigger validar before insert or update on public.puesto_asignaciones
  for each row execute function public.validar_asignacion_puesto();

-- ----------------------------------------------------------------------------
-- 5. Evaluación mensual
-- ----------------------------------------------------------------------------
create table if not exists public.objetivo_evaluaciones (
  id uuid primary key default gen_random_uuid(),
  empleado_id uuid not null references public.empleados(id),
  mes date not null check (mes = date_trunc('month', mes)),
  puesto_id int references public.puestos(id),
  plantilla_id uuid references public.objetivo_plantillas(id),
  evaluador_id uuid references public.perfiles(id),      -- jefe directo al armar el mes
  -- Copias para que un jefe sin acceso a la tabla de empleados sepa a quién califica,
  -- y para que el mes diga el puesto que tenía entonces.
  empleado_nombre text not null,
  empleado_numero text,
  puesto_nombre text,
  estado text not null default 'borrador' check (estado in ('borrador', 'calificada', 'revisada', 'aprobada')),
  suma_renglones numeric(6,2),                           -- antes de llave y tope
  total numeric(5,2) check (total >= 0 and total <= 100), -- tope de 100 %
  completa boolean not null default false,
  llave_activada boolean not null default false,
  llave_detalle text,
  medida_en timestamptz,
  calificada_por uuid references public.perfiles(id), calificada_en timestamptz,
  revisada_por uuid references public.perfiles(id), revisada_en timestamptz,
  aprobada_por uuid references public.perfiles(id), aprobada_en timestamptz,
  devuelta_motivo text,
  creado_en timestamptz not null default now(),
  unique (empleado_id, mes),
  check (revisada_por is null or revisada_por is distinct from calificada_por),
  check (aprobada_por is null or aprobada_por is distinct from revisada_por)
);
create index if not exists objetivo_evaluaciones_mes on public.objetivo_evaluaciones (mes, estado);
create index if not exists objetivo_evaluaciones_evaluador on public.objetivo_evaluaciones (evaluador_id, mes);

-- Cada renglón copia la línea de la plantilla: cambiar la plantilla no mueve un
-- mes ya armado.
create table if not exists public.objetivo_resultados (
  id uuid primary key default gen_random_uuid(),
  evaluacion_id uuid not null references public.objetivo_evaluaciones(id) on delete cascade,
  linea_id uuid,                                         -- línea de la plantilla de donde salió (sin FK: la historia no depende de ella)
  orden int not null default 0,
  indicador_id int not null references public.objetivo_indicadores(id),
  fuente text not null,
  peso numeric(5,2) not null check (peso > 0 and peso <= 100),
  regla text not null,
  meta numeric(16,2),
  sentido text not null default 'mayor',
  descuento numeric(6,2),
  escalones jsonb,
  llave_limite int,
  parametros jsonb not null default '{}'::jsonb,
  texto text,
  valor numeric(16,2),
  incidencias numeric(10,2),
  posibles numeric(10,2),
  modo_valor text not null default 'no' check (modo_valor in ('no', 'resta', 'porcentaje')),
  pct numeric(5,2) check (pct >= 0 and pct <= 100),
  calificacion numeric(5,2),
  nota text,
  evidencia_url text,
  nota_medicion text,
  medido_en timestamptz,
  capturado_por uuid references public.perfiles(id),
  capturado_en timestamptz,
  check (calificacion is null or (calificacion >= 0 and calificacion <= peso))
);
create index if not exists objetivo_resultados_evaluacion on public.objetivo_resultados (evaluacion_id, orden);

-- Lo que explica cada resultado: la orden que se entregó tarde, el ajuste de
-- inventario, el día que no entregó el celular. "cuenta" = resta (incidencia);
-- las demás solo explican (los pedidos que suman la venta del mes).
-- No se borra nada: al volver a medir, lo que ya no sale queda vigente = false;
-- una incidencia que no aplica se impugna con motivo.
create table if not exists public.objetivo_evidencias (
  id bigserial primary key,
  resultado_id uuid not null references public.objetivo_resultados(id) on delete cascade,
  tipo text not null,
  referencia text not null default '',
  folio text,
  detalle text,
  fecha date,
  cantidad numeric(16,2),
  unidades numeric(10,2) not null default 1,             -- cuántas incidencias representa (un resumen "y 300 más")
  cuenta boolean not null default true,
  vigente boolean not null default true,
  impugnacion text check (impugnacion in ('pendiente', 'aceptada', 'rechazada')),
  impugnada_por uuid references public.perfiles(id),
  impugnada_en timestamptz,
  motivo_impugnacion text,
  impugnacion_resuelta_por uuid references public.perfiles(id),
  impugnacion_resuelta_en timestamptz,
  impugnacion_comentario text,
  unique (resultado_id, tipo, referencia),
  check (impugnacion is null or length(trim(motivo_impugnacion)) >= 10),
  check (impugnacion_resuelta_por is null or impugnacion_resuelta_por is distinct from impugnada_por)
);

create table if not exists public.objetivo_comentarios (
  id uuid primary key default gen_random_uuid(),
  evaluacion_id uuid not null references public.objetivo_evaluaciones(id) on delete cascade,
  autor_id uuid not null default auth.uid() references public.perfiles(id),
  texto text not null check (length(trim(texto)) > 0),
  en timestamptz not null default now()
);
create index if not exists objetivo_comentarios_evaluacion on public.objetivo_comentarios (evaluacion_id, en);

-- Un mes aprobado no se toca. Si estaba mal, se pide un ajuste con el total
-- corregido y lo autoriza otra persona (como los ajustes de inventario).
create table if not exists public.objetivo_ajustes (
  id uuid primary key default gen_random_uuid(),
  evaluacion_id uuid not null references public.objetivo_evaluaciones(id),
  total_anterior numeric(5,2),
  total_corregido numeric(5,2) not null check (total_corregido >= 0 and total_corregido <= 100),
  motivo text not null check (length(trim(motivo)) >= 10),
  estado text not null default 'pendiente' check (estado in ('pendiente', 'autorizado', 'rechazado')),
  solicitado_por uuid not null default auth.uid() references public.perfiles(id),
  solicitado_en timestamptz not null default now(),
  resuelto_por uuid references public.perfiles(id),
  resuelto_en timestamptz,
  comentario text,
  check (resuelto_por is null or resuelto_por <> solicitado_por)
);

-- Checklist diario: EPP, limpieza por área, celular (3 momentos) y vehículos.
-- Una marca guarda quién, cuándo y a quién. Que no haya marca significa "nadie
-- lo capturó", no "no cumplió" (en la hoja eran lo mismo: 20 casillas
-- marcadas contra 772 vacías en un mes).
create table if not exists public.objetivo_marcas (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('epp', 'limpieza', 'celular', 'vehiculo')),
  fecha date not null,
  empleado_id uuid references public.empleados(id),
  area_id int references public.objetivo_areas(id),
  momento text not null default '' check (momento in ('', 'entrada', 'break1', 'break2')),
  cumplio boolean not null,
  nota text,
  marcado_por uuid not null default auth.uid() references public.perfiles(id),
  marcado_en timestamptz not null default now(),
  anterior jsonb,                                        -- la marca que esta corrigió (quién y qué decía)
  check (num_nonnulls(empleado_id, area_id) = 1),
  check ((tipo = 'celular') = (momento <> '')),
  check ((tipo = 'limpieza') = (area_id is not null))
);
create unique index if not exists objetivo_marcas_persona on public.objetivo_marcas (tipo, fecha, empleado_id, momento) where empleado_id is not null;
create unique index if not exists objetivo_marcas_area on public.objetivo_marcas (tipo, fecha, area_id, momento) where area_id is not null;
create index if not exists objetivo_marcas_fecha on public.objetivo_marcas (fecha, tipo);

-- ----------------------------------------------------------------------------
-- 6. Guardias: flujo, aprobado inmutable, nadie se califica a sí mismo
-- ----------------------------------------------------------------------------
create or replace function public.objetivo_flujo() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    if old.estado = 'aprobada' then
      raise exception 'El mes ya está aprobado y cerrado: no se borra. Si hay un error, solicita un ajuste.' using errcode = '42501';
    end if;
    return old;
  end if;
  if old.estado = 'aprobada' then
    raise exception 'El mes ya está aprobado y cerrado: no se modifica. Si hay un error, solicita un ajuste.' using errcode = '42501';
  end if;
  if new.estado is distinct from old.estado then
    if auth.uid() is not null and exists (select 1 from empleados where id = new.empleado_id and usuario_id = auth.uid()) then
      raise exception 'Nadie califica su propio objetivo' using errcode = '42501';
    end if;
    if (old.estado, new.estado) not in (('borrador', 'calificada'), ('calificada', 'revisada'), ('revisada', 'aprobada'),
                                        ('calificada', 'borrador'), ('revisada', 'borrador')) then
      raise exception 'Una evaluación no pasa de "%" a "%"', old.estado, new.estado;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists flujo on public.objetivo_evaluaciones;
create trigger flujo before update or delete on public.objetivo_evaluaciones
  for each row execute function public.objetivo_flujo();

create or replace function public.objetivo_resultado_guardia() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_estado text; v_empleado uuid;
begin
  select estado, empleado_id into v_estado, v_empleado from objetivo_evaluaciones
  where id = case when tg_op = 'DELETE' then old.evaluacion_id else new.evaluacion_id end;
  if v_estado = 'aprobada' then
    raise exception 'El mes ya está aprobado y cerrado: no se modifica. Si hay un error, solicita un ajuste.' using errcode = '42501';
  end if;
  if tg_op = 'UPDATE' and new.capturado_en is distinct from old.capturado_en and auth.uid() is not null
     and exists (select 1 from empleados where id = v_empleado and usuario_id = auth.uid()) then
    raise exception 'Nadie califica su propio objetivo' using errcode = '42501';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;
drop trigger if exists guardia on public.objetivo_resultados;
create trigger guardia before update or delete on public.objetivo_resultados
  for each row execute function public.objetivo_resultado_guardia();

create or replace function public.objetivo_evidencia_guardia() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_estado text;
begin
  select e.estado into v_estado from objetivo_resultados r join objetivo_evaluaciones e on e.id = r.evaluacion_id
  where r.id = case when tg_op = 'DELETE' then old.resultado_id else new.resultado_id end;
  if v_estado = 'aprobada' then
    raise exception 'El mes ya está aprobado y cerrado: no se modifica. Si hay un error, solicita un ajuste.' using errcode = '42501';
  end if;
  if tg_op = 'DELETE' and old.impugnacion is not null then
    raise exception 'Una incidencia impugnada no se borra: queda como constancia' using errcode = '42501';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;
drop trigger if exists guardia on public.objetivo_evidencias;
create trigger guardia before update or delete on public.objetivo_evidencias
  for each row execute function public.objetivo_evidencia_guardia();

drop trigger if exists proteger_usada on public.objetivo_plantillas;
create trigger proteger_usada before update or delete on public.objetivo_plantillas
  for each row execute function public.proteger_plantilla_usada();
drop trigger if exists proteger_usada on public.objetivo_plantilla_lineas;
create trigger proteger_usada before insert or update or delete on public.objetivo_plantilla_lineas
  for each row execute function public.proteger_plantilla_usada();

-- ----------------------------------------------------------------------------
-- 7. Cálculo: % de un renglón y total de la evaluación
-- ----------------------------------------------------------------------------
create or replace function public.objetivo_pct(p_regla text, p_peso numeric, p_meta numeric, p_sentido text, p_descuento numeric,
  p_escalones jsonb, p_valor numeric, p_incidencias numeric, p_posibles numeric) returns numeric
language sql immutable as $$
  select case p_regla
    when 'meta' then case when p_valor is null then null
                          when (p_sentido = 'menor' and p_valor <= p_meta) or (p_sentido <> 'menor' and p_valor >= p_meta) then 100
                          else 0 end
    when 'descuento' then case when p_incidencias is null then null
                               else greatest(0, round(100 * (p_peso - p_incidencias * p_descuento) / p_peso, 2)) end
    when 'una_incidencia' then case when p_incidencias is null then null when p_incidencias > 0 then 0 else 100 end
    -- Con tope: en la hoja un objetivo de 10 % se calificó con 20 % y el mes llegó a 109 %.
    when 'proporcional' then case when p_valor is null or coalesce(p_posibles, 0) <= 0 then null
                                  else least(100, greatest(0, round(100 * p_valor / p_posibles, 2))) end
    when 'escalon' then case when p_valor is null then null else coalesce((
        select (x->>'pct')::numeric from jsonb_array_elements(p_escalones) x
        where (p_sentido = 'menor' and p_valor <= (x->>'limite')::numeric)
           or (p_sentido <> 'menor' and p_valor >= (x->>'limite')::numeric)
        order by case when p_sentido = 'menor' then (x->>'limite')::numeric else -(x->>'limite')::numeric end
        limit 1), 0) end
    when 'llave' then case when p_incidencias is null then null when p_incidencias = 0 then 100
                           when p_descuento is not null then greatest(0, round(100 * (p_peso - p_incidencias * p_descuento) / p_peso, 2))
                           else 0 end
  end
$$;

create or replace function public.objetivo_recalcular(p_eval uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  -- Lo que mide el sistema: incidencias = evidencias que cuentan, menos las impugnaciones aceptadas.
  update objetivo_resultados r set incidencias = coalesce((
      select sum(v.unidades) from objetivo_evidencias v
      where v.resultado_id = r.id and v.vigente and v.cuenta and v.impugnacion is distinct from 'aceptada'), 0)
  where r.evaluacion_id = p_eval and r.medido_en is not null and r.capturado_en is null;

  update objetivo_resultados r set valor = case r.modo_valor
      when 'resta' then greatest(r.posibles - r.incidencias, 0)
      -- Sin casos en el mes (ninguna orden con compromiso, ningún prospecto) no falló nada.
      when 'porcentaje' then case when coalesce(r.posibles, 0) = 0 then 100
                                  else round(100 * greatest(r.posibles - r.incidencias, 0) / r.posibles, 2) end end
  where r.evaluacion_id = p_eval and r.medido_en is not null and r.capturado_en is null and r.modo_valor in ('resta', 'porcentaje');

  update objetivo_resultados r set pct = x.pct,
    calificacion = case when x.pct is null then null else round(r.peso * x.pct / 100, 2) end
  from (select id, objetivo_pct(regla, peso, meta, sentido, descuento, escalones, valor, incidencias, posibles) pct
        from objetivo_resultados where evaluacion_id = p_eval) x
  where r.id = x.id;

  update objetivo_evaluaciones e set
    suma_renglones = s.suma,
    completa = s.pendientes = 0,
    llave_activada = s.llave,
    llave_detalle = s.detalle,
    -- La llave se aplica sola (en la hoja alguien borraba la fórmula y escribía 0) y el total tiene tope.
    total = case when s.llave then 0 else least(100, s.suma) end
  from (select coalesce(sum(r.calificacion), 0) suma,
          count(*) filter (where r.calificacion is null) pendientes,
          coalesce(bool_or(r.regla = 'llave' and r.incidencias >= r.llave_limite), false) llave,
          string_agg(format('%s: %s incumplimientos en el mes (con %s el bono vale 0)', i.nombre, trim_scale(r.incidencias), r.llave_limite), '; ')
            filter (where r.regla = 'llave' and r.incidencias >= r.llave_limite) detalle
        from objetivo_resultados r join objetivo_indicadores i on i.id = r.indicador_id
        where r.evaluacion_id = p_eval) s
  where e.id = p_eval;
end $$;

-- ----------------------------------------------------------------------------
-- 8. Medición automática (17 indicadores) y del checklist
-- ----------------------------------------------------------------------------
-- Devuelve {valor, posibles, modo, nota, evidencias: [...]} o {sin_dato: true}
-- cuando no hay con qué medir (entonces lo califica el jefe), o {conservar:
-- true} cuando es una foto al cierre y ese momento ya pasó.
-- security definer y sin permiso de ejecución para nadie: solo la llaman
-- armar_evaluaciones y medir_evaluacion, que revisan puede() antes. Así un jefe
-- de almacén no puede preguntarle a esta función cuánto se vendió en el mes.
create or replace function public.objetivo_medir(p_clave text, p_checklist text, p_empleado uuid, p_mes date,
  p_parametros jsonb default '{}'::jsonb) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  tz constant text := 'America/Mexico_City';
  v_ini date := date_trunc('month', p_mes)::date;
  v_fin date := (date_trunc('month', p_mes) + interval '1 month')::date;          -- exclusivo
  v_t0 timestamptz := date_trunc('month', p_mes)::timestamp at time zone 'America/Mexico_City';
  v_t1 timestamptz := (date_trunc('month', p_mes) + interval '1 month')::timestamp at time zone 'America/Mexico_City';
  v_hoy date := hoy_planta();
  v_corte date := least((date_trunc('month', p_mes) + interval '1 month')::date - 1, hoy_planta());
  v_usuario uuid;
  v_a numeric; v_b numeric; v_n int;
  v_areas int[] := coalesce(array(select jsonb_array_elements_text(coalesce(p_parametros->'areas', '[]'::jsonb))::int), '{}');
  v_almacenes int[] := coalesce(array(select jsonb_array_elements_text(coalesce(p_parametros->'almacenes', '[]'::jsonb))::int), '{}');
  v_r jsonb;
begin
  select usuario_id into v_usuario from empleados where id = p_empleado;

  -- Checklist: un día (o un día-área) con cualquier falla es un incumplimiento.
  if p_checklist is not null then
    with m as (
      select x.fecha, x.area_id, a.nombre area, bool_and(x.cumplio) cumplio,
        string_agg(case x.momento when 'entrada' then 'entrada' when 'break1' then 'break 1' when 'break2' then 'break 2'
                                  else 'revisión' end || coalesce(' (' || x.nota || ')', ''), ', ' order by x.momento)
          filter (where not x.cumplio) fallas,
        string_agg(distinct p.nombre, ', ') filter (where not x.cumplio) quien
      from objetivo_marcas x
      left join objetivo_areas a on a.id = x.area_id
      left join perfiles p on p.id = x.marcado_por
      where x.tipo = p_checklist and x.fecha >= v_ini and x.fecha < v_fin
        and case when cardinality(v_areas) > 0 then x.area_id = any(v_areas) else x.empleado_id = p_empleado end
      group by x.fecha, x.area_id, a.nombre
    )
    select case when count(*) = 0 then jsonb_build_object('sin_dato', true,
             'nota', 'Nadie marcó el checklist este mes: sin marcas no se sabe si cumplió. Márcalo en el checklist diario o califícalo a mano.')
           else jsonb_build_object('posibles', count(*), 'modo', 'resta',
             'nota', format('%s %s marcados en el mes, %s con falla. Un día sin marca no cuenta en contra.',
                            count(*), case when cardinality(v_areas) > 0 then 'días-área' else 'días' end, count(*) filter (where not m.cumplio)),
             'evidencias', coalesce(jsonb_agg(jsonb_build_object(
                'tipo', 'marca', 'referencia', m.fecha::text || coalesce(':' || m.area_id, ''),
                'folio', coalesce(m.area, case p_checklist when 'celular' then 'Celular' when 'epp' then 'EPP'
                                                           when 'vehiculo' then 'Vehículo' else 'Checklist' end),
                'detalle', 'No cumplió: ' || m.fallas || coalesce(' · marcó ' || m.quien, ''),
                'fecha', m.fecha, 'cuenta', true) order by m.fecha) filter (where not m.cumplio), '[]'::jsonb)) end
    into v_r from m;
    return v_r;
  end if;

  case p_clave
  when 'ventas_mes' then
    select jsonb_build_object('valor', coalesce(round(sum(p.subtotal * p.tipo_cambio), 2), 0), 'modo', 'no',
      'nota', 'Pedidos del mes sin IVA ni cancelados, en pesos al tipo de cambio del pedido.',
      'evidencias', coalesce(jsonb_agg(jsonb_build_object('tipo', 'pedido', 'referencia', p.id::text, 'folio', p.folio,
          'detalle', coalesce(c.nombre, 'Sin cliente') || ' · ' || p.canal::text, 'fecha', p.fecha,
          'cantidad', round(p.subtotal * p.tipo_cambio, 2), 'cuenta', false) order by p.subtotal * p.tipo_cambio desc), '[]'::jsonb))
    into v_r
    from pedidos p left join clientes c on c.id = p.cliente_id
    where p.estado <> 'cancelado' and p.fecha >= v_ini and p.fecha < v_fin;

  when 'crecimiento_ventas' then
    select coalesce(sum(subtotal * tipo_cambio) filter (where fecha >= v_ini), 0),
           coalesce(sum(subtotal * tipo_cambio) filter (where fecha < v_ini), 0)
    into v_a, v_b
    from pedidos where estado <> 'cancelado' and fecha >= (v_ini - interval '1 month')::date and fecha < v_fin;
    if v_b = 0 then
      v_r := jsonb_build_object('sin_dato', true, 'nota', 'El mes anterior no tuvo ventas: no hay contra qué comparar.');
    else
      v_r := jsonb_build_object('valor', round(100 * (v_a / v_b - 1), 2), 'modo', 'no',
        'nota', 'Ventas sin IVA del mes contra el mes anterior.',
        'evidencias', jsonb_build_array(
          jsonb_build_object('tipo', 'resumen', 'referencia', 'mes', 'folio', objetivo_nombre_mes(v_ini),
                             'detalle', 'Ventas del mes', 'cantidad', round(v_a, 2), 'cuenta', false),
          jsonb_build_object('tipo', 'resumen', 'referencia', 'anterior', 'folio', objetivo_nombre_mes((v_ini - interval '1 month')::date),
                             'detalle', 'Ventas del mes anterior', 'cantidad', round(v_b, 2), 'cuenta', false)));
    end if;

  when 'seguimiento_prospectos' then
    with o as (
      select o.id, o.titulo, o.creado_en, c.nombre cliente,
        (select count(*) from actividades a where a.oportunidad_id = o.id
           and a.en >= o.creado_en and a.en < o.creado_en + interval '7 days') seg
      from oportunidades o left join clientes c on c.id = o.cliente_id
      where o.creado_en >= v_t0 and o.creado_en < v_t1 and o.creado_en + interval '7 days' <= now()
    )
    select jsonb_build_object('posibles', count(*), 'modo', 'porcentaje',
      'nota', 'Oportunidades creadas en el mes (con sus 7 días ya cumplidos). Incidencia: menos de 2 actividades en esos 7 días.',
      'evidencias', coalesce(jsonb_agg(jsonb_build_object('tipo', 'oportunidad', 'referencia', o.id::text, 'folio', o.titulo,
          'detalle', coalesce(o.cliente || ' · ', '') || o.seg || ' seguimiento(s) en 7 días',
          'fecha', (o.creado_en at time zone tz)::date, 'cantidad', o.seg, 'cuenta', o.seg < 2) order by o.creado_en), '[]'::jsonb))
    into v_r from o;

  when 'conversiones_registradas' then
    select jsonb_build_object('posibles', count(*), 'modo', 'porcentaje',
      'nota', 'Pedidos del mes sin Mercado Libre, Amazon ni históricos. Incidencia: pedido sin cotización del ERP.',
      'evidencias', coalesce(jsonb_agg(jsonb_build_object('tipo', 'pedido', 'referencia', p.id::text, 'folio', p.folio,
          'detalle', coalesce(c.nombre, 'Sin cliente') || ' · sin cotización', 'fecha', p.fecha,
          'cantidad', round(p.subtotal * p.tipo_cambio, 2), 'cuenta', true) order by p.fecha) filter (where p.cotizacion_id is null), '[]'::jsonb))
    into v_r
    from pedidos p left join clientes c on c.id = p.cliente_id
    where p.estado <> 'cancelado' and not p.historico and p.fecha >= v_ini and p.fecha < v_fin
      and p.canal not in ('mercadolibre', 'amazon');

  when 'costos_vigentes' then
    with linea as (
      select a.id, a.clave, a.nombre from articulos a
      where a.activo and a.tipo in ('componente', 'materia_prima')
        and exists (select 1 from bom_lineas b join articulos p on p.id = b.padre_id where b.hijo_id = a.id and p.activo)
    ), fechas as (
      select l.*, greatest(
          (select max((h.en at time zone tz)::date) from historial_costos h where h.articulo_id = l.id and h.en < v_t1),
          (select c.actualizado_en from costos_articulo c where c.articulo_id = l.id and c.actualizado_en < v_fin)) ultima
      from linea l
    ), vencidos as (
      select f.*, row_number() over (order by f.ultima nulls first, f.clave) n
      from fechas f where f.ultima is null or f.ultima < (v_fin - interval '3 months')::date
    )
    select jsonb_build_object('posibles', (select count(*) from linea), 'valor', (select count(*) from vencidos), 'modo', 'no',
      'nota', format('%s de %s componentes de línea con costo de más de 3 meses (o sin costo) al cierre del mes.',
                     (select count(*) from vencidos), (select count(*) from linea)),
      'evidencias', coalesce((select jsonb_agg(jsonb_build_object('tipo', 'articulo', 'referencia', v.id::text, 'folio', v.clave,
            'detalle', v.nombre || ' · ' || coalesce('costo del ' || to_char(v.ultima, 'DD/MM/YYYY'), 'sin costo'),
            'fecha', v.ultima, 'cuenta', true) order by v.n) from vencidos v where v.n <= 100), '[]'::jsonb)
        || case when (select count(*) from vencidos) > 100 then jsonb_build_array(jsonb_build_object(
             'tipo', 'resumen', 'referencia', 'resto', 'folio', 'Y ' || ((select count(*) from vencidos) - 100) || ' artículos más',
             'detalle', 'Mismo motivo: costo de más de 3 meses o sin costo', 'cuenta', true,
             'unidades', (select count(*) from vencidos) - 100)) else '[]'::jsonb end)
    into v_r;

  when 'proveedores_nuevos' then
    select jsonb_build_object('valor', count(*), 'modo', 'no',
      'nota', 'Proveedores dados de alta en el mes con su primera orden de compra en el mes.',
      'evidencias', coalesce(jsonb_agg(jsonb_build_object('tipo', 'proveedor', 'referencia', p.id::text, 'folio', p.nombre,
          'detalle', coalesce(p.categoria || ' · ', '') || 'primera OC ' || o.folio, 'fecha', o.fecha, 'cuenta', false)), '[]'::jsonb))
    into v_r
    from proveedores p
    cross join lateral (select x.folio, x.fecha from ordenes_compra x where x.proveedor_id = p.id
                        and x.estado not in ('borrador', 'cancelada') order by x.fecha limit 1) o
    where p.creado_en >= v_t0 and p.creado_en < v_t1 and o.fecha >= v_ini and o.fecha < v_fin;

  when 'materiales_por_cliente' then
    with lib as (
      select distinct on (ev.orden_id) ev.orden_id, ev.en from op_eventos ev
      where ev.tipo = 'liberada' and ev.en >= v_t0 and ev.en < v_t1 order by ev.orden_id, ev.en
    ), x as (
      select o.id, o.folio, a.nombre equipo, l.en,
        not exists (select 1 from op_materiales m where m.orden_id = o.id) sin_material,
        (select count(*) from op_eventos c where c.orden_id = o.id and c.tipo = 'cambio_material' and c.en > l.en) cambios
      from lib l join ordenes_produccion o on o.id = l.orden_id join articulos a on a.id = o.articulo_id
    )
    select jsonb_build_object('posibles', count(*), 'modo', 'porcentaje',
      'nota', 'Órdenes liberadas en el mes. Incidencia: sin lista de material o con cambios de material después de liberarla.',
      'evidencias', coalesce(jsonb_agg(jsonb_build_object('tipo', 'orden_produccion', 'referencia', x.id::text, 'folio', x.folio,
          'detalle', x.equipo || ' · ' || case when x.sin_material then 'liberada sin lista de material'
                                              when x.cambios > 0 then x.cambios || ' cambio(s) de material después de liberarla'
                                              else 'material completo al liberar' end,
          'fecha', (x.en at time zone tz)::date, 'cantidad', x.cambios, 'cuenta', x.sin_material or x.cambios > 0) order by x.en), '[]'::jsonb))
    into v_r from x;

  when 'entregas_a_tiempo' then
    with x as (
      select o.id, o.folio, a.nombre equipo, o.fecha_compromiso, (o.terminada_en at time zone tz)::date terminada,
        o.pedido_id is null para_stock
      from ordenes_produccion o join articulos a on a.id = o.articulo_id
      where o.estado <> 'cancelada' and o.fecha_compromiso >= v_ini and o.fecha_compromiso < v_fin
        -- La que sigue abierta y todavía puede llegar a tiempo no se juzga aún.
        and (o.terminada_en is not null or o.fecha_compromiso < v_corte)
    ), y as (
      select x.*, coalesce(x.terminada, v_corte) - x.fecha_compromiso atraso from x
    )
    select jsonb_build_object('posibles', count(*), 'modo', 'porcentaje',
      'nota', 'Órdenes con fecha compromiso en el mes, incluidas las de stock. Incidencia: terminada después de su fecha o abierta al cierre.',
      'evidencias', coalesce(jsonb_agg(jsonb_build_object('tipo', 'orden_produccion', 'referencia', y.id::text, 'folio', y.folio,
          'detalle', y.equipo || case when y.para_stock then ' (stock)' else '' end || ' · ' ||
              case when y.terminada is null then 'sigue abierta, ' || y.atraso || ' días tarde'
                   when y.atraso > 0 then 'terminada ' || y.atraso || ' días tarde' else 'a tiempo' end,
          'fecha', y.fecha_compromiso, 'cantidad', greatest(y.atraso, 0), 'cuenta', y.atraso > 0) order by y.fecha_compromiso), '[]'::jsonb))
    into v_r from y;

  when 'inicio_sin_orden' then
    with ini as (
      select distinct on (ev.orden_id) ev.orden_id, ev.en from op_eventos ev where ev.tipo = 'inicio' order by ev.orden_id, ev.en
    ), x as (
      select o.id, o.folio, a.nombre equipo, i.en, o.revisado_ingenieria_en,
        o.revisado_ingenieria_en is null or o.revisado_ingenieria_en > i.en sin_revision
      from ini i join ordenes_produccion o on o.id = i.orden_id join articulos a on a.id = o.articulo_id
      where i.en >= v_t0 and i.en < v_t1
    )
    select jsonb_build_object('posibles', count(*), 'modo', 'porcentaje',
      'nota', 'Órdenes que empezaron en el mes. Incidencia: empezó antes de la revisión de ingeniería.',
      'evidencias', coalesce(jsonb_agg(jsonb_build_object('tipo', 'orden_produccion', 'referencia', x.id::text, 'folio', x.folio,
          'detalle', x.equipo || ' · ' || case when x.sin_revision then 'empezó sin revisión de ingeniería' else 'revisada antes de empezar' end,
          'fecha', (x.en at time zone tz)::date, 'cuenta', x.sin_revision) order by x.en), '[]'::jsonb))
    into v_r from x;

  when 'bitacora_incidencias' then
    if v_usuario is null then
      v_r := jsonb_build_object('sin_dato', true, 'nota', 'La persona no tiene usuario en el ERP: no se sabe qué registró. Califícalo a mano.');
    else
      select jsonb_build_object('valor', count(*), 'modo', 'no',
        'nota', 'Problemas que registró en las órdenes de producción en el mes.',
        'evidencias', coalesce(jsonb_agg(jsonb_build_object('tipo', 'evento', 'referencia', ev.id::text, 'folio', o.folio,
            'detalle', left(ev.nota, 160), 'fecha', (ev.en at time zone tz)::date, 'cuenta', false) order by ev.en), '[]'::jsonb))
      into v_r
      from op_eventos ev join ordenes_produccion o on o.id = ev.orden_id
      where ev.tipo = 'problema' and ev.usuario_id = v_usuario and ev.en >= v_t0 and ev.en < v_t1;
    end if;

  when 'exactitud_inventario' then
    select jsonb_build_object('valor', count(*), 'modo', 'no',
      'nota', 'Ajustes de inventario del mes con diferencia. Los rechazados no cuentan: el conteo estaba mal, no el inventario.',
      'evidencias', coalesce(jsonb_agg(jsonb_build_object('tipo', 'ajuste', 'referencia', j.id::text, 'folio', j.folio,
          'detalle', a.clave || ' · ' || a.nombre || ' · ' || al.nombre || ' · sistema ' || trim_scale(j.cantidad_sistema)
                     || ', físico ' || trim_scale(j.cantidad_fisica) || ' · ' || j.motivo,
          'fecha', (j.solicitado_en at time zone tz)::date, 'cantidad', j.diferencia, 'cuenta', true) order by j.solicitado_en), '[]'::jsonb))
    into v_r
    from ajustes_inventario j join articulos a on a.id = j.articulo_id join almacenes al on al.id = j.almacen_id
    where j.estado <> 'rechazado' and j.diferencia <> 0 and j.solicitado_en >= v_t0 and j.solicitado_en < v_t1
      and (cardinality(v_almacenes) = 0 or j.almacen_id = any(v_almacenes));

  when 'material_a_tiempo_almacen' then
    -- Foto: solo vale tomarla durante el mes o en los 5 días siguientes al cierre.
    if v_hoy < v_ini or v_hoy > v_fin + 5 then return jsonb_build_object('conservar', true); end if;
    select jsonb_build_object('valor', count(*), 'modo', 'no',
      'nota', format('Foto del %s: artículos bajo su punto de reorden sin requisición abierta ni compra en camino.', to_char(v_hoy, 'DD/MM/YYYY')),
      'evidencias', coalesce(jsonb_agg(jsonb_build_object('tipo', 'articulo', 'referencia', r.articulo_id::text, 'folio', r.clave,
          'detalle', r.nombre || ' · disponible ' || trim_scale(r.disponible) || ' de ' || trim_scale(r.punto_reorden) || ' ' || r.unidad,
          'fecha', v_hoy, 'cantidad', r.punto_reorden - r.disponible, 'cuenta', true) order by r.clave), '[]'::jsonb))
    into v_r
    from reabasto() r
    where r.estado = 'ordenar' and r.en_transito = 0
      and not exists (select 1 from requisicion_lineas l join requisiciones q on q.id = l.requisicion_id
                      where l.articulo_id = r.articulo_id and l.estado = 'pendiente' and q.estado in ('abierta', 'en_compra'));

  when 'material_pedido_de_mas' then
    with x as (
      select l.id, q.folio, q.creado_en, a.clave, a.nombre, a.unidad, l.cantidad,
        coalesce((select sum(m.cantidad) from movimientos_inventario m join almacenes al on al.id = m.almacen_id
                  where m.articulo_id = l.articulo_id and al.disponible_para_planta and m.en <= q.creado_en), 0) en_planta
      from requisicion_lineas l join requisiciones q on q.id = l.requisicion_id join articulos a on a.id = l.articulo_id
      where q.origen in ('manual', 'reabasto') and q.creado_en >= v_t0 and q.creado_en < v_t1
    )
    select jsonb_build_object('posibles', count(*), 'valor', count(*) filter (where x.en_planta >= x.cantidad), 'modo', 'no',
      'nota', 'Partidas de requisición del mes (manuales y de reabasto). Incidencia: en ese momento ya había en planta lo que se pidió.',
      'evidencias', coalesce(jsonb_agg(jsonb_build_object('tipo', 'requisicion', 'referencia', x.id::text, 'folio', x.folio,
          'detalle', x.clave || ' · ' || x.nombre || ' · pidió ' || trim_scale(x.cantidad) || ', había ' || trim_scale(x.en_planta) || ' ' || x.unidad,
          'fecha', (x.creado_en at time zone tz)::date, 'cantidad', x.cantidad, 'cuenta', true) order by x.creado_en)
          filter (where x.en_planta >= x.cantidad), '[]'::jsonb))
    into v_r from x;

  when 'desabasto' then
    if v_hoy < v_ini or v_hoy > v_fin + 5 then return jsonb_build_object('conservar', true); end if;
    select jsonb_build_object(
      'valor', case when count(*) > 0 then round(100.0 * count(*) filter (where r.en_planta < r.punto_reorden) / count(*), 2) else 0 end,
      'posibles', count(*), 'modo', 'no',
      'nota', format('Foto del %s: %s de %s artículos con punto de reorden están por debajo en planta.',
                     to_char(v_hoy, 'DD/MM/YYYY'), count(*) filter (where r.en_planta < r.punto_reorden), count(*)),
      'evidencias', coalesce(jsonb_agg(jsonb_build_object('tipo', 'articulo', 'referencia', r.articulo_id::text, 'folio', r.clave,
          'detalle', r.nombre || ' · en planta ' || trim_scale(r.en_planta) || ' de ' || trim_scale(r.punto_reorden) || ' ' || r.unidad,
          'fecha', v_hoy, 'cantidad', r.punto_reorden - r.en_planta, 'cuenta', false) order by r.clave)
          filter (where r.en_planta < r.punto_reorden), '[]'::jsonb))
    into v_r from reabasto() r where r.punto_reorden > 0;

  when 'inventario_herramientas' then
    select jsonb_build_object('valor', count(*), 'modo', 'no',
      'nota', 'Conteos cerrados en el mes con "herramienta" en el nombre.',
      'evidencias', coalesce(jsonb_agg(jsonb_build_object('tipo', 'conteo', 'referencia', c.id::text, 'folio', c.nombre,
          'detalle', al.nombre || ' · ' || (select count(*) from conteo_lineas l where l.conteo_id = c.id) || ' artículos contados',
          'fecha', (c.cerrado_en at time zone tz)::date, 'cuenta', false) order by c.cerrado_en), '[]'::jsonb))
    into v_r
    from conteos c join almacenes al on al.id = c.almacen_id
    where c.estado = 'cerrado' and c.cerrado_en >= v_t0 and c.cerrado_en < v_t1 and sin_acentos(c.nombre) like '%herramienta%';

  when 'surtido_produccion' then
    with x as (
      select o.id, o.folio, a.nombre equipo, (o.terminada_en at time zone tz)::date terminada,
        (select count(*) from op_materiales m where m.orden_id = o.id and m.requerido > 0 and m.surtido < m.requerido) sin_surtir,
        (select count(*) from op_materiales m where m.orden_id = o.id and m.requerido > 0) renglones
      from ordenes_produccion o join articulos a on a.id = o.articulo_id
      where o.terminada_en >= v_t0 and o.terminada_en < v_t1
    )
    select jsonb_build_object('posibles', count(*), 'modo', 'porcentaje',
      'nota', 'Órdenes terminadas en el mes. Incidencia: terminó con material sin surtir completo.',
      'evidencias', coalesce(jsonb_agg(jsonb_build_object('tipo', 'orden_produccion', 'referencia', x.id::text, 'folio', x.folio,
          'detalle', x.equipo || ' · ' || case when x.sin_surtir > 0 then x.sin_surtir || ' de ' || x.renglones || ' renglones sin surtir completo'
                                               else 'material surtido completo' end,
          'fecha', x.terminada, 'cantidad', x.sin_surtir, 'cuenta', x.sin_surtir > 0) order by x.terminada), '[]'::jsonb))
    into v_r from x;

  when 'recepcion_oc' then
    with oc as (
      select distinct m.orden_compra_id id from movimientos_inventario m
      where m.tipo = 'entrada_compra' and m.orden_compra_id is not null and m.en >= v_t0 and m.en < v_t1
    ), x as (
      select o.id, o.folio, p.nombre proveedor, o.fecha_entrega,
        (select count(*) from oc_lineas l where l.orden_compra_id = o.id and l.recibido > l.cantidad) de_mas,
        o.estado = 'parcial' and o.fecha_entrega < v_corte incompleta
      from oc join ordenes_compra o on o.id = oc.id join proveedores p on p.id = o.proveedor_id
    )
    select jsonb_build_object('posibles', count(*), 'modo', 'porcentaje',
      'nota', 'Órdenes de compra con entradas en el mes. Incidencia: se recibió de más, o quedó incompleta con su fecha de entrega vencida.',
      'evidencias', coalesce(jsonb_agg(jsonb_build_object('tipo', 'orden_compra', 'referencia', x.id::text, 'folio', x.folio,
          'detalle', x.proveedor || ' · ' || case when x.de_mas > 0 then 'se recibió de más en ' || x.de_mas || ' partida(s)'
                                                  when x.incompleta then 'incompleta; debía llegar el ' || to_char(x.fecha_entrega, 'DD/MM/YYYY')
                                                  else 'recibida como se pidió' end,
          'fecha', x.fecha_entrega, 'cuenta', x.de_mas > 0 or x.incompleta) order by x.folio), '[]'::jsonb))
    into v_r from x;

  else
    v_r := jsonb_build_object('sin_dato', true, 'nota', 'Este indicador todavía no se mide solo: califícalo a mano.');
  end case;
  return v_r;
end $$;

create or replace function public.objetivo_aplicar_medicion(p_resultado uuid) returns void
language plpgsql security definer set search_path = public as $$
declare r objetivo_resultados; e objetivo_evaluaciones; i objetivo_indicadores; m jsonb;
begin
  select * into r from objetivo_resultados where id = p_resultado;
  select * into e from objetivo_evaluaciones where id = r.evaluacion_id;
  select * into i from objetivo_indicadores where id = r.indicador_id;
  if e.estado <> 'borrador' or i.fuente not in ('automatica', 'checklist') then return; end if;
  -- Si el jefe lo calificó a mano porque no había dato, volver a medir no lo pisa.
  if r.capturado_en is not null then return; end if;

  m := objetivo_medir(i.clave, i.checklist, e.empleado_id, e.mes, r.parametros);
  if coalesce((m->>'conservar')::boolean, false) then
    if r.medido_en is null then
      update objetivo_resultados set nota_medicion = 'Se mide con una foto al cierre del mes y ese momento ya pasó: califícalo a mano.'
      where id = r.id;
    end if;
    return;
  end if;

  update objetivo_evidencias set vigente = false where resultado_id = r.id and vigente;
  if coalesce((m->>'sin_dato')::boolean, false) then
    update objetivo_resultados set valor = null, posibles = null, incidencias = null, medido_en = null,
      modo_valor = 'no', nota_medicion = m->>'nota' where id = r.id;
    return;
  end if;
  insert into objetivo_evidencias (resultado_id, tipo, referencia, folio, detalle, fecha, cantidad, unidades, cuenta, vigente)
  select r.id, x->>'tipo', coalesce(x->>'referencia', ''), x->>'folio', x->>'detalle', (x->>'fecha')::date,
         (x->>'cantidad')::numeric, coalesce((x->>'unidades')::numeric, 1), coalesce((x->>'cuenta')::boolean, true), true
  from jsonb_array_elements(coalesce(m->'evidencias', '[]'::jsonb)) x
  on conflict (resultado_id, tipo, referencia) do update set
    folio = excluded.folio, detalle = excluded.detalle, fecha = excluded.fecha, cantidad = excluded.cantidad,
    unidades = excluded.unidades, cuenta = excluded.cuenta, vigente = true;
  update objetivo_resultados set
    valor = (m->>'valor')::numeric, posibles = (m->>'posibles')::numeric, modo_valor = coalesce(m->>'modo', 'no'),
    nota_medicion = m->>'nota', medido_en = now()
  where id = r.id;
end $$;

-- Plantilla vigente de una persona en un mes: la suya propia, o la de su puesto.
create or replace function public.objetivo_plantilla_de(p_empleado uuid, p_puesto int, p_mes date) returns uuid
language sql stable security definer set search_path = public as $$
  select id from objetivo_plantillas
  where (empleado_id = p_empleado or (empleado_id is null and puesto_id = p_puesto))
    and desde <= p_mes and (hasta is null or hasta >= p_mes)
  order by (empleado_id is not null) desc limit 1
$$;

-- Copia (o actualiza) los renglones de la plantilla en una evaluación en borrador.
create or replace function public.objetivo_sincronizar(p_eval uuid) returns void
language plpgsql security definer set search_path = public as $$
declare e objetivo_evaluaciones;
begin
  select * into e from objetivo_evaluaciones where id = p_eval;
  if e.estado <> 'borrador' then return; end if;
  delete from objetivo_resultados r where r.evaluacion_id = p_eval
    and not exists (select 1 from objetivo_plantilla_lineas l where l.id = r.linea_id and l.plantilla_id = e.plantilla_id);
  update objetivo_resultados r set orden = l.orden, indicador_id = l.indicador_id, fuente = i.fuente, peso = l.peso, regla = l.regla,
    meta = l.meta, sentido = l.sentido, descuento = l.descuento, escalones = l.escalones, llave_limite = l.llave_limite,
    parametros = l.parametros, texto = l.texto, pct = null, calificacion = null
  from objetivo_plantilla_lineas l join objetivo_indicadores i on i.id = l.indicador_id
  where r.evaluacion_id = p_eval and l.id = r.linea_id
    and (r.orden, r.indicador_id, r.peso, r.regla, r.meta, r.sentido, r.descuento, r.escalones, r.llave_limite, r.parametros, r.texto)
        is distinct from (l.orden, l.indicador_id, l.peso, l.regla, l.meta, l.sentido, l.descuento, l.escalones, l.llave_limite, l.parametros, l.texto);
  insert into objetivo_resultados (evaluacion_id, linea_id, orden, indicador_id, fuente, peso, regla, meta, sentido, descuento,
    escalones, llave_limite, parametros, texto)
  select p_eval, l.id, l.orden, l.indicador_id, i.fuente, l.peso, l.regla, l.meta, l.sentido, l.descuento,
    l.escalones, l.llave_limite, l.parametros, l.texto
  from objetivo_plantilla_lineas l join objetivo_indicadores i on i.id = l.indicador_id
  where l.plantilla_id = e.plantilla_id
    and not exists (select 1 from objetivo_resultados r where r.evaluacion_id = p_eval and r.linea_id = l.id);
end $$;

create or replace function public.objetivo_medir_evaluacion(p_eval uuid) returns void
language plpgsql security definer set search_path = public as $$
declare r record;
begin
  for r in select id from objetivo_resultados where evaluacion_id = p_eval and fuente in ('automatica', 'checklist') loop
    perform objetivo_aplicar_medicion(r.id);
  end loop;
  update objetivo_evaluaciones set medida_en = now() where id = p_eval;
  perform objetivo_recalcular(p_eval);
end $$;

revoke execute on function public.objetivo_medir(text, text, uuid, date, jsonb) from public, anon, authenticated;
revoke execute on function public.objetivo_aplicar_medicion(uuid) from public, anon, authenticated;
revoke execute on function public.objetivo_recalcular(uuid) from public, anon, authenticated;
revoke execute on function public.objetivo_sincronizar(uuid) from public, anon, authenticated;
revoke execute on function public.objetivo_medir_evaluacion(uuid) from public, anon, authenticated;
revoke execute on function public.objetivo_plantilla_de(uuid, int, date) from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 9. Lo que hace cada quien (RPC). Todas security definer: revisan permiso al
--    inicio y escriben en tablas sin política de escritura.
-- ----------------------------------------------------------------------------
-- El día 1 (o cuando RRHH quiera): arma el borrador de cada persona con puesto
-- asignado y mide lo automático. Un borrador que ya existía se vuelve a medir;
-- uno ya calificado no se toca.
-- objetivo_armar no revisa permisos: la llaman armar_evaluaciones (que sí) y el
-- cron del día 1 (sin sesión). Nadie más puede ejecutarla.
create or replace function public.objetivo_armar(p_mes date) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_mes date := date_trunc('month', p_mes)::date; a record; v_eval uuid; v_estado text; v_plantilla uuid;
  v_creadas int := 0; v_medidas int := 0; v_ya int := 0; v_sin jsonb := '[]'::jsonb;
begin
  if v_mes > date_trunc('month', hoy_planta()) then
    raise exception 'No se arma un mes que no ha empezado';
  end if;
  for a in
    select distinct on (x.empleado_id) x.empleado_id, x.puesto_id, x.jefe_id, e.nombre, e.numero, p.nombre puesto
    from puesto_asignaciones x join empleados e on e.id = x.empleado_id join puestos p on p.id = x.puesto_id
    where x.desde < v_mes + interval '1 month' and (x.hasta is null or x.hasta >= v_mes)
      and e.fecha_ingreso < v_mes + interval '1 month' and (e.activo or e.baja_en >= v_mes)
    order by x.empleado_id, x.desde desc
  loop
    v_plantilla := objetivo_plantilla_de(a.empleado_id, a.puesto_id, v_mes);
    if v_plantilla is null then
      v_sin := v_sin || jsonb_build_object('empleado', a.nombre, 'puesto', a.puesto);
      continue;
    end if;
    v_eval := null;
    select id, estado into v_eval, v_estado from objetivo_evaluaciones where empleado_id = a.empleado_id and mes = v_mes;
    if v_eval is null then
      insert into objetivo_evaluaciones (empleado_id, mes, puesto_id, plantilla_id, evaluador_id, empleado_nombre, empleado_numero, puesto_nombre)
      values (a.empleado_id, v_mes, a.puesto_id, v_plantilla, a.jefe_id, a.nombre, a.numero, a.puesto)
      returning id into v_eval;
      v_creadas := v_creadas + 1;
    elsif v_estado <> 'borrador' then
      v_ya := v_ya + 1;
      continue;
    else
      update objetivo_evaluaciones set puesto_id = a.puesto_id, plantilla_id = v_plantilla, evaluador_id = a.jefe_id,
        empleado_nombre = a.nombre, empleado_numero = a.numero, puesto_nombre = a.puesto
      where id = v_eval;
    end if;
    perform objetivo_sincronizar(v_eval);
    perform objetivo_medir_evaluacion(v_eval);
    v_medidas := v_medidas + 1;
  end loop;
  return jsonb_build_object('creadas', v_creadas, 'medidas', v_medidas, 'ya_calificadas', v_ya, 'sin_plantilla', v_sin);
end $$;
revoke execute on function public.objetivo_armar(date) from public, anon, authenticated;

create or replace function public.armar_evaluaciones(p_mes date) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if not puede('objetivos', 3) then
    raise exception 'Solo RRHH o dirección arman el mes' using errcode = '42501';
  end if;
  return objetivo_armar(p_mes);
end $$;

-- Permiso para calificar: su jefe directo (objetivos 1) o RRHH/dirección
-- (objetivos 3), y nunca la persona misma.
create or replace function public.objetivo_validar_calificador(e public.objetivo_evaluaciones) returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if e.id is null then raise exception 'No existe esa evaluación'; end if;
  if exists (select 1 from empleados where id = e.empleado_id and usuario_id = auth.uid()) then
    raise exception 'Nadie califica su propio objetivo' using errcode = '42501';
  end if;
  if not (puede('objetivos', 3) or (puede('objetivos', 1) and e.evaluador_id = auth.uid())) then
    raise exception 'Solo su jefe directo o RRHH califican a esta persona' using errcode = '42501';
  end if;
end $$;
revoke execute on function public.objetivo_validar_calificador(public.objetivo_evaluaciones) from public, anon, authenticated;

create or replace function public.medir_evaluacion(p_evaluacion uuid) returns void
language plpgsql security definer set search_path = public as $$
declare e objetivo_evaluaciones;
begin
  select * into e from objetivo_evaluaciones where id = p_evaluacion for update;
  if e.id is null then raise exception 'No existe esa evaluación'; end if;
  -- Medir no es calificar: el jefe o RRHH lo hacen, pero no la persona.
  perform objetivo_validar_calificador(e);
  if e.estado <> 'borrador' then raise exception 'Solo se vuelve a medir un borrador'; end if;
  perform objetivo_sincronizar(e.id);
  perform objetivo_medir_evaluacion(e.id);
end $$;

-- El jefe califica lo que no mide el sistema. Lo automático no se sobreescribe:
-- si una incidencia no aplica, se impugna (con motivo) y RRHH la resuelve.
create or replace function public.capturar_resultado(p_resultado uuid, p_valor numeric default null, p_incidencias numeric default null,
  p_posibles numeric default null, p_nota text default null, p_evidencia_url text default null) returns void
language plpgsql security definer set search_path = public as $$
declare r objetivo_resultados; e objetivo_evaluaciones;
begin
  select * into r from objetivo_resultados where id = p_resultado;
  if r.id is null then raise exception 'No existe ese renglón'; end if;
  select * into e from objetivo_evaluaciones where id = r.evaluacion_id for update;
  perform objetivo_validar_calificador(e);
  if e.estado <> 'borrador' then
    raise exception 'La evaluación ya se envió: para cambiar algo, RRHH la devuelve a borrador';
  end if;
  if r.fuente in ('automatica', 'checklist') and r.medido_en is not null then
    raise exception 'Este indicador lo mide el sistema: si una incidencia no aplica, impúgnala con el motivo';
  end if;
  case r.regla
    when 'meta', 'escalon' then
      if p_valor is null then raise exception 'Escribe el resultado del mes'; end if;
    when 'descuento', 'una_incidencia', 'llave' then
      if p_incidencias is null or p_incidencias < 0 then raise exception 'Escribe cuántas incidencias hubo (0 si ninguna)'; end if;
    when 'proporcional' then
      if p_valor is null or p_valor < 0 or coalesce(p_posibles, 0) <= 0 then
        raise exception 'Escribe lo cumplido y el total posible (por ejemplo, 8 de 10)';
      end if;
  end case;
  update objetivo_resultados set valor = p_valor, incidencias = p_incidencias, posibles = p_posibles,
    nota = nullif(trim(p_nota), ''), evidencia_url = nullif(trim(p_evidencia_url), ''),
    capturado_por = auth.uid(), capturado_en = now()
  where id = r.id;
  perform objetivo_recalcular(e.id);
end $$;

create or replace function public.enviar_evaluacion(p_evaluacion uuid) returns void
language plpgsql security definer set search_path = public as $$
declare e objetivo_evaluaciones; v_faltan int;
begin
  select * into e from objetivo_evaluaciones where id = p_evaluacion for update;
  perform objetivo_validar_calificador(e);
  if e.estado <> 'borrador' then raise exception 'Esta evaluación ya se envió'; end if;
  select count(*) into v_faltan from objetivo_resultados where evaluacion_id = e.id and calificacion is null;
  if v_faltan > 0 and not e.llave_activada then
    raise exception 'Faltan % indicador(es) por calificar', v_faltan;
  end if;
  update objetivo_evaluaciones set estado = 'calificada', calificada_por = auth.uid(), calificada_en = now(), devuelta_motivo = null
  where id = e.id;
end $$;

create or replace function public.revisar_evaluacion(p_evaluacion uuid) returns void
language plpgsql security definer set search_path = public as $$
declare e objetivo_evaluaciones; v_n int;
begin
  if not puede('objetivos', 3) then raise exception 'La revisión es de Recursos Humanos' using errcode = '42501'; end if;
  select * into e from objetivo_evaluaciones where id = p_evaluacion for update;
  if e.id is null then raise exception 'No existe esa evaluación'; end if;
  if exists (select 1 from empleados where id = e.empleado_id and usuario_id = auth.uid()) then
    raise exception 'Nadie califica su propio objetivo' using errcode = '42501';
  end if;
  if e.estado <> 'calificada' then raise exception 'Solo se revisa una evaluación que el jefe ya calificó'; end if;
  if e.calificada_por = auth.uid() then
    raise exception 'Calificaste esta evaluación: que la revise otra persona' using errcode = '42501';
  end if;
  select count(*) into v_n from objetivo_evidencias v join objetivo_resultados r on r.id = v.resultado_id
  where r.evaluacion_id = e.id and v.impugnacion = 'pendiente';
  if v_n > 0 then raise exception 'Resuelve primero % impugnación(es) pendiente(s)', v_n; end if;
  update objetivo_evaluaciones set estado = 'revisada', revisada_por = auth.uid(), revisada_en = now() where id = e.id;
end $$;

create or replace function public.aprobar_evaluacion(p_evaluacion uuid) returns void
language plpgsql security definer set search_path = public as $$
declare e objetivo_evaluaciones;
begin
  if not tiene_rol('direccion') then raise exception 'Solo dirección aprueba el mes' using errcode = '42501'; end if;
  select * into e from objetivo_evaluaciones where id = p_evaluacion for update;
  if e.id is null then raise exception 'No existe esa evaluación'; end if;
  if exists (select 1 from empleados where id = e.empleado_id and usuario_id = auth.uid()) then
    raise exception 'Nadie califica su propio objetivo' using errcode = '42501';
  end if;
  if e.estado <> 'revisada' then raise exception 'Primero la revisa Recursos Humanos'; end if;
  if e.revisada_por = auth.uid() then
    raise exception 'Revisaste esta evaluación: que la apruebe otra persona de dirección' using errcode = '42501';
  end if;
  update objetivo_evaluaciones set estado = 'aprobada', aprobada_por = auth.uid(), aprobada_en = now() where id = e.id;
end $$;

create or replace function public.devolver_evaluacion(p_evaluacion uuid, p_motivo text) returns void
language plpgsql security definer set search_path = public as $$
declare e objetivo_evaluaciones;
begin
  if not puede('objetivos', 3) then raise exception 'Solo RRHH o dirección devuelven una evaluación' using errcode = '42501'; end if;
  if length(trim(coalesce(p_motivo, ''))) < 5 then raise exception 'Escribe por qué se devuelve'; end if;
  select * into e from objetivo_evaluaciones where id = p_evaluacion for update;
  if e.estado not in ('calificada', 'revisada') then raise exception 'Solo se devuelve una evaluación enviada que no se ha aprobado'; end if;
  update objetivo_evaluaciones set estado = 'borrador', devuelta_motivo = trim(p_motivo),
    calificada_por = null, calificada_en = null, revisada_por = null, revisada_en = null
  where id = e.id;
  insert into objetivo_comentarios (evaluacion_id, texto) values (e.id, 'Devuelta a borrador: ' || trim(p_motivo));
end $$;

-- El jefe no borra una incidencia automática: la impugna con motivo y queda
-- pendiente hasta que otra persona (RRHH) la acepta o la rechaza.
create or replace function public.impugnar_evidencia(p_evidencia bigint, p_motivo text) returns void
language plpgsql security definer set search_path = public as $$
declare v objetivo_evidencias; e objetivo_evaluaciones;
begin
  select * into v from objetivo_evidencias where id = p_evidencia for update;
  if v.id is null then raise exception 'No existe esa incidencia'; end if;
  select x.* into e from objetivo_evaluaciones x join objetivo_resultados r on r.evaluacion_id = x.id where r.id = v.resultado_id;
  perform objetivo_validar_calificador(e);
  if e.estado not in ('borrador', 'calificada') then raise exception 'La evaluación ya se revisó: pide a RRHH que la devuelva'; end if;
  if not v.cuenta or not v.vigente then raise exception 'Solo se impugna una incidencia que cuenta en contra'; end if;
  if v.impugnacion is not null then raise exception 'Esa incidencia ya está impugnada'; end if;
  if length(trim(coalesce(p_motivo, ''))) < 10 then raise exception 'Explica por qué no aplica (al menos 10 letras)'; end if;
  update objetivo_evidencias set impugnacion = 'pendiente', impugnada_por = auth.uid(), impugnada_en = now(),
    motivo_impugnacion = trim(p_motivo)
  where id = v.id;
end $$;

create or replace function public.resolver_impugnacion(p_evidencia bigint, p_aceptar boolean, p_comentario text default null) returns void
language plpgsql security definer set search_path = public as $$
declare v objetivo_evidencias; e objetivo_evaluaciones;
begin
  if not puede('objetivos', 3) then raise exception 'Las impugnaciones las resuelve Recursos Humanos' using errcode = '42501'; end if;
  select * into v from objetivo_evidencias where id = p_evidencia for update;
  if v.impugnacion is distinct from 'pendiente' then raise exception 'Esa incidencia no tiene una impugnación pendiente'; end if;
  if v.impugnada_por = auth.uid() then raise exception 'Tú la impugnaste: que la resuelva otra persona' using errcode = '42501'; end if;
  select x.* into e from objetivo_evaluaciones x join objetivo_resultados r on r.evaluacion_id = x.id where r.id = v.resultado_id;
  if exists (select 1 from empleados where id = e.empleado_id and usuario_id = auth.uid()) then
    raise exception 'Nadie califica su propio objetivo' using errcode = '42501';
  end if;
  if e.estado not in ('borrador', 'calificada') then raise exception 'La evaluación ya se revisó'; end if;
  update objetivo_evidencias set impugnacion = case when p_aceptar then 'aceptada' else 'rechazada' end,
    impugnacion_resuelta_por = auth.uid(), impugnacion_resuelta_en = now(), impugnacion_comentario = nullif(trim(p_comentario), '')
  where id = v.id;
  perform objetivo_recalcular(e.id);
end $$;

create or replace function public.solicitar_ajuste_objetivo(p_evaluacion uuid, p_total numeric, p_motivo text) returns uuid
language plpgsql security definer set search_path = public as $$
declare e objetivo_evaluaciones; v_id uuid;
begin
  if not puede('objetivos', 3) then raise exception 'Los ajustes los pide Recursos Humanos o dirección' using errcode = '42501'; end if;
  select * into e from objetivo_evaluaciones where id = p_evaluacion;
  if e.estado is distinct from 'aprobada' then raise exception 'Un ajuste es para un mes ya aprobado; antes de eso, devuélvela a borrador'; end if;
  if exists (select 1 from empleados where id = e.empleado_id and usuario_id = auth.uid()) then
    raise exception 'Nadie califica su propio objetivo' using errcode = '42501';
  end if;
  if exists (select 1 from objetivo_ajustes where evaluacion_id = e.id and estado = 'pendiente') then
    raise exception 'Ya hay un ajuste pendiente para ese mes';
  end if;
  insert into objetivo_ajustes (evaluacion_id, total_anterior, total_corregido, motivo)
  values (e.id, coalesce((select total_corregido from objetivo_ajustes where evaluacion_id = e.id and estado = 'autorizado'
                          order by resuelto_en desc limit 1), e.total), p_total, trim(p_motivo))
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.resolver_ajuste_objetivo(p_ajuste uuid, p_autorizar boolean, p_comentario text default null) returns void
language plpgsql security definer set search_path = public as $$
declare a objetivo_ajustes; e objetivo_evaluaciones;
begin
  if not puede('objetivos', 3) then raise exception 'Los ajustes los autoriza Recursos Humanos o dirección' using errcode = '42501'; end if;
  select * into a from objetivo_ajustes where id = p_ajuste for update;
  if a.estado is distinct from 'pendiente' then raise exception 'Ese ajuste ya se resolvió'; end if;
  if a.solicitado_por = auth.uid() then raise exception 'Lo autoriza otra persona, no quien lo pidió' using errcode = '42501'; end if;
  select * into e from objetivo_evaluaciones where id = a.evaluacion_id;
  if exists (select 1 from empleados where id = e.empleado_id and usuario_id = auth.uid()) then
    raise exception 'Nadie califica su propio objetivo' using errcode = '42501';
  end if;
  update objetivo_ajustes set estado = case when p_autorizar then 'autorizado' else 'rechazado' end,
    resuelto_por = auth.uid(), resuelto_en = now(), comentario = nullif(trim(p_comentario), '')
  where id = a.id;
end $$;

-- Checklist desde el celular. Quien marca no se marca a sí mismo, y un mes ya
-- calificado no se cambia por la puerta de atrás.
create or replace function public.registrar_marca(p_tipo text, p_fecha date, p_empleado uuid, p_area int, p_momento text,
  p_cumplio boolean, p_nota text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_ant objetivo_marcas; v_mes date := date_trunc('month', p_fecha)::date; v_momento text := coalesce(p_momento, '');
begin
  if not puede('objetivos', 1) then raise exception 'Sin permiso para marcar el checklist' using errcode = '42501'; end if;
  if p_empleado is not null and exists (select 1 from empleados where id = p_empleado and usuario_id = auth.uid()) then
    raise exception 'Nadie se marca a sí mismo' using errcode = '42501';
  end if;
  if p_fecha > hoy_planta() then raise exception 'No se marca un día que no ha llegado'; end if;
  if p_fecha < hoy_planta() - 7 and not puede('objetivos', 3) then
    raise exception 'Solo RRHH marca o corrige días de hace más de una semana';
  end if;
  if exists (select 1 from objetivo_evaluaciones e where e.mes = v_mes and e.estado <> 'borrador'
             and (e.empleado_id = p_empleado
                  or (p_area is not null and exists (select 1 from objetivo_resultados r join objetivo_indicadores i on i.id = r.indicador_id
                                                     where r.evaluacion_id = e.id and i.checklist = p_tipo
                                                       and r.parametros->'areas' @> to_jsonb(p_area))))) then
    raise exception 'El mes de % ya se calificó: una corrección se pide como ajuste', objetivo_nombre_mes(v_mes);
  end if;
  select * into v_ant from objetivo_marcas
  where tipo = p_tipo and fecha = p_fecha and momento = v_momento
    and (empleado_id = p_empleado or area_id = p_area)
  for update;
  if v_ant.id is not null then
    update objetivo_marcas set cumplio = p_cumplio, nota = nullif(trim(p_nota), ''), marcado_por = auth.uid(), marcado_en = now(),
      anterior = jsonb_build_object('cumplio', v_ant.cumplio, 'nota', v_ant.nota, 'marcado_por', v_ant.marcado_por,
                                    'marcado_en', v_ant.marcado_en)
    where id = v_ant.id returning id into v_id;
  else
    insert into objetivo_marcas (tipo, fecha, empleado_id, area_id, momento, cumplio, nota)
    values (p_tipo, p_fecha, p_empleado, p_area, v_momento, p_cumplio, nullif(trim(p_nota), ''))
    returning id into v_id;
  end if;
  return v_id;
end $$;

-- Quién se marca en el checklist de un día. Primero quienes tienen ese
-- indicador en su plantilla; el resto también (el EPP del taller cuenta para el
-- supervisor aunque los soldadores no tengan objetivos).
create or replace function public.checklist_del_dia(p_tipo text, p_fecha date)
returns table (empleado_id uuid, area_id int, nombre text, puesto text, en_plantilla boolean, soy_yo boolean, marcas jsonb)
language plpgsql stable security definer set search_path = public as $$
declare v_mes date := date_trunc('month', p_fecha)::date;
begin
  if not puede('objetivos', 1) then raise exception 'Sin permiso para ver el checklist' using errcode = '42501'; end if;
  if p_tipo = 'limpieza' then
    return query
    select null::uuid, a.id, a.nombre, null::text,
      exists (select 1 from objetivo_plantilla_lineas l join objetivo_plantillas p on p.id = l.plantilla_id
              join objetivo_indicadores i on i.id = l.indicador_id
              where i.checklist = 'limpieza' and l.parametros->'areas' @> to_jsonb(a.id)
                and p.desde <= v_mes and (p.hasta is null or p.hasta >= v_mes)),
      false,
      coalesce((select jsonb_agg(jsonb_build_object('momento', m.momento, 'cumplio', m.cumplio, 'nota', m.nota,
                  'por', pf.nombre, 'en', m.marcado_en))
                from objetivo_marcas m left join perfiles pf on pf.id = m.marcado_por
                where m.tipo = 'limpieza' and m.fecha = p_fecha and m.area_id = a.id), '[]'::jsonb)
    from objetivo_areas a where a.activa
    order by 5 desc, a.nombre;
  else
    return query
    select e.id, null::int, e.nombre, coalesce(pa.puesto, e.puesto),
      coalesce(pa.en_plantilla, false),
      e.usuario_id is not distinct from auth.uid() and e.usuario_id is not null,
      coalesce((select jsonb_agg(jsonb_build_object('momento', m.momento, 'cumplio', m.cumplio, 'nota', m.nota,
                  'por', pf.nombre, 'en', m.marcado_en) order by m.momento)
                from objetivo_marcas m left join perfiles pf on pf.id = m.marcado_por
                where m.tipo = p_tipo and m.fecha = p_fecha and m.empleado_id = e.id), '[]'::jsonb)
    from empleados e
    left join lateral (
      select p.nombre puesto, exists (
          select 1 from objetivo_plantilla_lineas l join objetivo_indicadores i on i.id = l.indicador_id
          where l.plantilla_id = objetivo_plantilla_de(e.id, x.puesto_id, v_mes) and i.checklist = p_tipo) en_plantilla
      from puesto_asignaciones x join puestos p on p.id = x.puesto_id
      where x.empleado_id = e.id and x.desde <= p_fecha and (x.hasta is null or x.hasta >= p_fecha)
      order by x.desde desc limit 1
    ) pa on true
    where e.activo and e.fecha_ingreso <= p_fecha
    order by 5 desc, e.nombre;
  end if;
end $$;

-- Guardar una plantilla completa en una sola transacción (los pesos se validan
-- al final). Sin id es una versión nueva: la anterior del mismo puesto termina
-- el mes antes. security invoker: la RLS (objetivos 3) decide.
create or replace function public.guardar_plantilla(p jsonb) returns uuid
language plpgsql security invoker set search_path = public as $$
declare v_id uuid := nullif(p->>'id', '')::uuid; v_desde date := date_trunc('month', (p->>'desde')::date)::date;
  v_hasta date := date_trunc('month', nullif(p->>'hasta', '')::date)::date; v_suma numeric; l jsonb; v_lid uuid;
  v_ids uuid[] := '{}'; v_orden int := 0; v_puesto int := nullif(p->>'puesto_id', '')::int; v_empleado uuid := nullif(p->>'empleado_id', '')::uuid;
begin
  if not puede('objetivos', 3) then raise exception 'Solo RRHH o dirección editan plantillas' using errcode = '42501'; end if;
  if jsonb_array_length(coalesce(p->'lineas', '[]'::jsonb)) = 0 then raise exception 'La plantilla necesita al menos un indicador'; end if;
  select coalesce(sum((x->>'peso')::numeric), 0) into v_suma from jsonb_array_elements(p->'lineas') x;
  if v_suma <> 100 then raise exception 'Los pesos suman % y deben sumar 100', trim_scale(v_suma); end if;
  if v_id is null then
    update objetivo_plantillas set hasta = (v_desde - interval '1 month')::date
    where puesto_id is not distinct from v_puesto and empleado_id is not distinct from v_empleado
      and desde < v_desde and (hasta is null or hasta >= v_desde);
    insert into objetivo_plantillas (puesto_id, empleado_id, desde, hasta, notas)
    values (v_puesto, v_empleado, v_desde, v_hasta, nullif(trim(p->>'notas'), ''))
    returning id into v_id;
  else
    update objetivo_plantillas set desde = v_desde, hasta = v_hasta, notas = nullif(trim(p->>'notas'), '') where id = v_id;
    if not found then raise exception 'No existe esa plantilla'; end if;
  end if;
  for l in select * from jsonb_array_elements(p->'lineas') loop
    v_orden := v_orden + 1;
    v_lid := nullif(l->>'id', '')::uuid;
    if v_lid is not null and exists (select 1 from objetivo_plantilla_lineas where id = v_lid and plantilla_id = v_id) then
      update objetivo_plantilla_lineas set orden = v_orden, indicador_id = (l->>'indicador_id')::int, peso = (l->>'peso')::numeric,
        regla = l->>'regla', meta = nullif(l->>'meta', '')::numeric, sentido = coalesce(nullif(l->>'sentido', ''), 'mayor'),
        descuento = nullif(l->>'descuento', '')::numeric, escalones = nullif(l->'escalones', 'null'::jsonb),
        llave_limite = nullif(l->>'llave_limite', '')::int, parametros = coalesce(nullif(l->'parametros', 'null'::jsonb), '{}'::jsonb),
        texto = nullif(trim(l->>'texto'), '')
      where id = v_lid;
    else
      insert into objetivo_plantilla_lineas (plantilla_id, orden, indicador_id, peso, regla, meta, sentido, descuento, escalones,
        llave_limite, parametros, texto)
      values (v_id, v_orden, (l->>'indicador_id')::int, (l->>'peso')::numeric, l->>'regla', nullif(l->>'meta', '')::numeric,
        coalesce(nullif(l->>'sentido', ''), 'mayor'), nullif(l->>'descuento', '')::numeric, nullif(l->'escalones', 'null'::jsonb),
        nullif(l->>'llave_limite', '')::int, coalesce(nullif(l->'parametros', 'null'::jsonb), '{}'::jsonb), nullif(trim(l->>'texto'), ''))
      returning id into v_lid;
    end if;
    v_ids := v_ids || v_lid;
  end loop;
  delete from objetivo_plantilla_lineas where plantilla_id = v_id and not (id = any(v_ids));
  return v_id;
end $$;

-- Lo que ve la pantalla de una evaluación. security_invoker: la RLS de cada
-- tabla decide (el jefe ve a su gente, la persona lo suyo).
create or replace view public.v_objetivo_evaluaciones with (security_invoker = true) as
select e.*,
  ev.nombre as evaluador, cp.nombre as calificada_por_nombre, rp.nombre as revisada_por_nombre, ap.nombre as aprobada_por_nombre,
  aj.total_corregido,
  coalesce(aj.total_corregido, e.total) as total_final,
  (select count(*) from public.objetivo_resultados r where r.evaluacion_id = e.id and r.calificacion is null) as pendientes,
  (select count(*) from public.objetivo_resultados r where r.evaluacion_id = e.id) as indicadores,
  (select count(*) from public.objetivo_evidencias v join public.objetivo_resultados r on r.id = v.resultado_id
    where r.evaluacion_id = e.id and v.impugnacion = 'pendiente') as impugnaciones_pendientes,
  (select count(*) from public.objetivo_ajustes a where a.evaluacion_id = e.id and a.estado = 'pendiente') as ajustes_pendientes,
  e.empleado_id = public.mi_empleado() as es_mia,
  e.evaluador_id = auth.uid() as soy_evaluador
from public.objetivo_evaluaciones e
left join public.perfiles ev on ev.id = e.evaluador_id
left join public.perfiles cp on cp.id = e.calificada_por
left join public.perfiles rp on rp.id = e.revisada_por
left join public.perfiles ap on ap.id = e.aprobada_por
left join lateral (
  select a.total_corregido from public.objetivo_ajustes a
  where a.evaluacion_id = e.id and a.estado = 'autorizado' order by a.resuelto_en desc limit 1
) aj on true;

-- ----------------------------------------------------------------------------
-- 10. Plantillas sembradas (las que se deducen de la hoja, por puesto)
-- ----------------------------------------------------------------------------
-- Pesos y reglas tomados de los textos de cada pestaña ("1 entrega tarde = 10 %
-- del 20 %" → descuento de 10 sobre un peso de 20). Vigentes desde septiembre de
-- 2026, el último mes completo de la hoja, para poder comparar. Solo se siembra
-- si el puesto no tiene plantilla: RRHH puede cambiarlas sin que esto las pise.
do $$
declare
  v_plantillas jsonb := $j$[
    {"puesto": "Marketing", "lineas": [
      {"i": 1, "p": 20, "r": "meta", "meta": 2000000, "t": "Ventas del mes de al menos $2,000,000 sin IVA"},
      {"i": 2, "p": 10, "r": "meta", "meta": 5, "t": "Crecer al menos 5 % contra el mes anterior"},
      {"i": 3, "p": 15, "r": "meta", "meta": 5, "t": "+5 % de visitantes únicos al blog"},
      {"i": 6, "p": 10, "r": "meta", "meta": 2, "t": "Al menos 2 reseñas reales en Google Maps"},
      {"i": 7, "p": 10, "r": "meta", "meta": 1, "t": "Presentación mensual con el gasto de marketing"},
      {"i": 8, "p": 15, "r": "meta", "meta": 2, "t": "Un plan de estrategia por quincena"},
      {"i": 9, "p": 15, "r": "meta", "meta": 1, "t": "Al menos 1 video semiprofesional de un equipo de línea"},
      {"i": 60, "p": 5, "r": "llave", "llave": 3, "t": "Entregar el celular 3 veces al día; 3 días con falla en el mes = bono total 0"}]},
    {"puesto": "Atención a prospectos web",
     "notas": "En la hoja los pesos sumaban 110 %: el seguimiento (10 %) nunca se calificó. Aquí lo mide el sistema; llamadas y reseñas bajaron de 15 a 10 para que sume 100. Confirmar con dirección.",
     "lineas": [
      {"i": 11, "p": 20, "r": "meta", "meta": 100, "t": "Primer contacto el mismo día al 100 % de los formularios"},
      {"i": 12, "p": 20, "r": "meta", "meta": 100, "t": "Asignar el 100 % de formularios y correos en 4 horas o menos"},
      {"i": 13, "p": 15, "r": "meta", "meta": 0, "s": "menor", "t": "Cero chats perdidos en horario laboral"},
      {"i": 14, "p": 10, "r": "descuento", "d": 2, "t": "Cada pedido ligado a su cotización; −2 por pedido suelto"},
      {"i": 15, "p": 10, "r": "meta", "meta": 100, "t": "100 % de llamadas registradas con datos completos"},
      {"i": 6, "p": 10, "r": "meta", "meta": 2, "t": "Al menos 2 reseñas reales en Google Maps"},
      {"i": 10, "p": 10, "r": "meta", "meta": 100, "t": "100 % de prospectos con 2 seguimientos en 7 días"},
      {"i": 60, "p": 5, "r": "llave", "llave": 3, "t": "Entregar el celular 3 veces al día; 3 días con falla en el mes = bono total 0"}]},
    {"puesto": "Compras", "lineas": [
      {"i": 17, "p": 10, "r": "meta", "meta": 1, "t": "Conseguir 1 crédito nuevo con proveedor"},
      {"i": 18, "p": 30, "r": "descuento", "d": 15, "t": "Sin retrasos de fabricación por material tarde o equivocado; −15 por cada uno"},
      {"i": 19, "p": 30, "r": "descuento", "d": 10, "t": "Costos de componentes de línea con menos de 3 meses; −10 por cada uno vencido"},
      {"i": 20, "p": 10, "r": "escalon", "e": [{"limite": 2, "pct": 100}, {"limite": 1, "pct": 50}], "t": "Proveedores nuevos: 1 = la mitad, 2 o más = completo"},
      {"i": 21, "p": 15, "r": "descuento", "d": 5, "t": "Facturas a tiempo (crédito ≤ 5 días hábiles, complemento y anticipo ≤ 2); −5 por factura"},
      {"i": 60, "p": 5, "r": "llave", "llave": 3, "t": "Entregar el celular 3 veces al día; 3 días con falla en el mes = bono total 0"}]},
    {"puesto": "Importaciones y manuales técnicos", "lineas": [
      {"i": 25, "p": 50, "r": "descuento", "d": 20, "t": "Manuales y fichas técnicas a tiempo según el aviso de pedido; 1 retraso = −20"},
      {"i": 22, "p": 10, "r": "meta", "meta": 2, "t": "Proponer al menos 2 proveedores de importación"},
      {"i": 23, "p": 25, "r": "una_incidencia", "t": "Ningún gasto de importación por documentos tardíos; uno = 0"},
      {"i": 24, "p": 10, "r": "meta", "meta": 1, "t": "Avance de los manuales de procesos de importación"},
      {"i": 60, "p": 5, "r": "llave", "llave": 3, "t": "Entregar el celular 3 veces al día; 3 días con falla en el mes = bono total 0"}]},
    {"puesto": "Supervisor de producción", "lineas": [
      {"i": 35, "p": 40, "r": "descuento", "d": 10, "t": "Retrabajos y garantías por el personal: reproceso = 1, reposición = 2, garantía = 4; −10 por unidad"},
      {"i": 36, "p": 20, "r": "descuento", "d": 10, "t": "Equipos entregados a tiempo, incluidos los de stock; 1 tarde = −10"},
      {"i": 42, "p": 10, "r": "descuento", "d": 5, "t": "Cero accidentes: rebaba = 1, consulta = 2, incapacidad = 3; −5 por unidad"},
      {"i": 43, "p": 10, "r": "proporcional", "par": {"escala": 10}, "t": "Plan de desarrollo y capacitación (el jefe califica de 0 a 10)"},
      {"i": 59, "p": 5, "r": "una_incidencia", "areas": ["Pintura", "Comedor", "Plasma", "Torno", "Chatarra"], "t": "Limpieza de pintura, comedor, plasma, torno y chatarra; un día de desorden = 0"},
      {"i": 25, "p": 5, "r": "descuento", "d": 5, "t": "Manuales de usuario a tiempo (compartido con importaciones); 1 retraso = −5"},
      {"i": 44, "p": 5, "r": "descuento", "d": 5, "t": "Bajas por mal liderazgo; −5 por cada una"},
      {"i": 60, "p": 5, "r": "llave", "llave": 3, "t": "Entregar el celular 3 veces al día; 3 días con falla en el mes = bono total 0"}]},
    {"puesto": "Ayudante de supervisor", "lineas": [
      {"i": 35, "p": 40, "r": "descuento", "d": 10, "t": "Retrabajos y garantías por el personal: reproceso = 1, reposición = 2, garantía = 4; −10 por unidad"},
      {"i": 36, "p": 20, "r": "descuento", "d": 10, "t": "Equipos entregados a tiempo, incluidos los de stock; 1 tarde = −10"},
      {"i": 37, "p": 10, "r": "una_incidencia", "t": "Ningún equipo empezado sin orden ni planos; una incidencia = 0"},
      {"i": 42, "p": 10, "r": "descuento", "d": 5, "t": "Cero accidentes: rebaba = 1, consulta = 2, incapacidad = 3; −5 por unidad"},
      {"i": 58, "p": 10, "r": "proporcional", "t": "Uso de EPP, proporcional a los días marcados"},
      {"i": 59, "p": 5, "r": "una_incidencia", "areas": ["Pintura", "Comedor", "Plasma", "Torno", "Chatarra"], "t": "Limpieza de pintura, comedor, plasma, torno y chatarra; un día de desorden = 0"},
      {"i": 60, "p": 5, "r": "llave", "llave": 3, "t": "Entregar el celular 3 veces al día; 3 días con falla en el mes = bono total 0"}]},
    {"puesto": "Calidad", "notas": "Calidad no tenía la llave del celular en la hoja.", "lineas": [
      {"i": 38, "p": 25, "r": "descuento", "d": 12.5, "t": "Checklist de cada equipo entregado y de stock; −12.5 por equipo sin checklist"},
      {"i": 39, "p": 40, "r": "una_incidencia", "t": "Una garantía por falla no detectada en el checklist = 0"},
      {"i": 40, "p": 10, "r": "meta", "meta": 1, "t": "Registrar en la bitácora las incidencias que encuentre"},
      {"i": 41, "p": 5, "r": "una_incidencia", "t": "Video de prueba antes de cada entrega"},
      {"i": 42, "p": 15, "r": "descuento", "d": 5, "t": "Cero accidentes y EPP del personal ≥ 90 %; −5 por unidad"},
      {"i": 59, "p": 5, "r": "una_incidencia", "areas": ["Pintura", "Comedor", "Plasma", "Torno", "Chatarra"], "t": "Limpieza de pintura, comedor, plasma, torno y chatarra; un día de desorden = 0"}]},
    {"puesto": "Diseño industrial", "lineas": [
      {"i": 26, "p": 30, "r": "descuento", "d": 15, "t": "Planos a tiempo y en su carpeta, ningún equipo nuevo sin planos; −15 por incidencia"},
      {"i": 27, "p": 35, "r": "descuento", "d": 17.5, "t": "Retrabajos por diseño; −17.5 por cada uno"},
      {"i": 28, "p": 15, "r": "descuento", "d": 5, "t": "Lista de material completa al liberar; −5 por orden incompleta"},
      {"i": 29, "p": 10, "r": "proporcional", "par": {"escala": 10}, "t": "Desarrollo del auxiliar de diseño (el jefe califica de 0 a 10)"},
      {"i": 58, "p": 5, "r": "proporcional", "t": "Uso de EPP, proporcional a los días marcados"},
      {"i": 60, "p": 5, "r": "llave", "llave": 3, "t": "Entregar el celular 3 veces al día; 3 días con falla en el mes = bono total 0"}]},
    {"puesto": "Ingeniería de control eléctrico", "lineas": [
      {"i": 30, "p": 10, "r": "descuento", "d": 5, "t": "Diagramas eléctricos a tiempo para las fichas técnicas; −5 por retraso"},
      {"i": 31, "p": 15, "r": "descuento", "d": 5, "t": "Diagramas de conexiones en alta calidad en su carpeta; −5 por faltante"},
      {"i": 32, "p": 20, "r": "descuento", "d": 10, "t": "Errores con gasto (material dañado, aparatos quemados); −10 por cada uno"},
      {"i": 33, "p": 20, "r": "descuento", "d": 10, "t": "Puesta en marcha sin errores ni garantías; −10 por cada uno"},
      {"i": 34, "p": 10, "r": "una_incidencia", "t": "Si falta un manual de variador o una llave de gabinete = 0"},
      {"i": 43, "p": 10, "r": "proporcional", "par": {"escala": 10}, "t": "Desarrollo y capacitación (el jefe califica de 0 a 10)"},
      {"i": 59, "p": 5, "r": "una_incidencia", "areas": ["Mesa de trabajo eléctrica"], "t": "Mesa de trabajo limpia y ordenada; un día de desorden = 0"},
      {"i": 58, "p": 5, "r": "proporcional", "t": "Uso de EPP, proporcional a los días marcados"},
      {"i": 60, "p": 5, "r": "llave", "llave": 3, "t": "Entregar el celular 3 veces al día; 3 días con falla en el mes = bono total 0"}]},
    {"puesto": "Encargado de almacén", "lineas": [
      {"i": 45, "p": 30, "r": "descuento", "d": 10, "t": "Existencias, nombres y ubicaciones correctas; −10 por error"},
      {"i": 46, "p": 30, "r": "descuento", "d": 15, "t": "Pedir material a tiempo, incluidos mínimos, acero y Mercado Libre; −15 por incidencia"},
      {"i": 47, "p": 10, "r": "descuento", "d": 5, "t": "No pedir material que ya había en planta; −5 por partida"},
      {"i": 48, "p": 15, "r": "escalon", "s": "menor", "e": [{"limite": 5, "pct": 100}, {"limite": 10, "pct": 80}], "t": "Desabasto: hasta 5 % = completo, hasta 10 % = 80 %, más = 0"},
      {"i": 50, "p": 5, "r": "meta", "meta": 2, "t": "Inventario de herramientas cada 15 días (2 al mes)"},
      {"i": 51, "p": 5, "r": "descuento", "d": 5, "t": "Pedidos empacados a tiempo; −5 por pedido tarde"},
      {"i": 60, "p": 5, "r": "llave", "llave": 3, "t": "Entregar el celular 3 veces al día; 3 días con falla en el mes = bono total 0"}]},
    {"puesto": "Auxiliar de almacén", "lineas": [
      {"i": 52, "p": 30, "r": "una_incidencia", "t": "Material y herramienta surtidos a producción según la solicitud; una incidencia = 0"},
      {"i": 45, "p": 15, "r": "descuento", "d": 7.5, "t": "Existencias, nombres y ubicaciones correctas; −7.5 por error"},
      {"i": 56, "p": 20, "r": "proporcional", "areas": ["Almacén planta", "Contenedores"], "t": "Orden y acomodo de almacenes, proporcional a los días marcados"},
      {"i": 57, "p": 15, "r": "proporcional", "par": {"escala": 10}, "t": "Mejoras y errores en general (el jefe califica de 0 a 10)"},
      {"i": 58, "p": 10, "r": "proporcional", "t": "Uso de EPP, proporcional a los días marcados"},
      {"i": 49, "p": 5, "r": "descuento", "d": 5, "t": "Entradas y salidas el mismo día y con la unidad correcta; −5 por incidencia"},
      {"i": 60, "p": 5, "r": "llave", "llave": 3, "t": "Entregar el celular 3 veces al día; 3 días con falla en el mes = bono total 0"}]},
    {"puesto": "Chofer, montacarguista y auxiliar de almacén", "lineas": [
      {"i": 53, "p": 20, "r": "descuento", "d": 10, "t": "Recibir de proveedores lo pedido y en buen estado; −10 por incidencia"},
      {"i": 54, "p": 10, "r": "descuento", "d": 5, "t": "Puntualidad de salidas y llegadas de rutas; −5 por incidencia"},
      {"i": 55, "p": 30, "r": "proporcional", "t": "Revisión diaria de vehículos y montacargas, proporcional a los días marcados"},
      {"i": 56, "p": 10, "r": "proporcional", "areas": ["Almacén planta", "Contenedores"], "t": "Orden y seguridad de almacenes, proporcional a los días marcados"},
      {"i": 57, "p": 15, "r": "proporcional", "par": {"escala": 10}, "t": "Mejoras y errores en general (el jefe califica de 0 a 10)"},
      {"i": 58, "p": 10, "r": "proporcional", "t": "Uso de EPP, proporcional a los días marcados"},
      {"i": 60, "p": 5, "r": "llave", "llave": 3, "t": "Entregar el celular 3 veces al día; 3 días con falla en el mes = bono total 0"}]}
  ]$j$;
  pl jsonb; l jsonb; v_puesto int; v_id uuid; v_orden int; v_par jsonb;
begin
  for pl in select * from jsonb_array_elements(v_plantillas) loop
    select id into v_puesto from puestos where nombre = pl->>'puesto';
    if v_puesto is null or exists (select 1 from objetivo_plantillas where puesto_id = v_puesto) then continue; end if;
    insert into objetivo_plantillas (puesto_id, desde, notas)
    values (v_puesto, '2026-09-01', coalesce(pl->>'notas', 'Sembrada a partir de la hoja "REGISTRO CELULARES Y OBJETIVOS".'))
    returning id into v_id;
    v_orden := 0;
    for l in select * from jsonb_array_elements(pl->'lineas') loop
      v_orden := v_orden + 1;
      v_par := coalesce(l->'par', '{}'::jsonb);
      if l ? 'areas' then
        v_par := v_par || jsonb_build_object('areas', (select jsonb_agg(a.id order by a.id) from objetivo_areas a
                                                      where a.nombre in (select jsonb_array_elements_text(l->'areas'))));
      end if;
      insert into objetivo_plantilla_lineas (plantilla_id, orden, indicador_id, peso, regla, meta, sentido, descuento, escalones,
        llave_limite, parametros, texto)
      values (v_id, v_orden, (l->>'i')::int, (l->>'p')::numeric, l->>'r', (l->>'meta')::numeric, coalesce(l->>'s', 'mayor'),
        (l->>'d')::numeric, l->'e', (l->>'llave')::int, v_par, l->>'t');
    end loop;
  end loop;
  -- La suma de 100 se revisa aquí y no al final: si la migración corre en una
  -- sola transacción (db reset), con la revisión pendiente el "enable row level
  -- security" de más abajo falla ("pending trigger events").
  set constraints public.pesos_100 immediate;
  set constraints public.pesos_100 deferred;
end $$;

-- ----------------------------------------------------------------------------
-- 11. Prenómina semanal
-- ----------------------------------------------------------------------------
insert into public.configuracion (clave, valor, descripcion) values
  ('nomina', '{"septimo_dia": "simple", "retardos": "descontar_tiempo", "prima_vacacional": 0.25, "horas_dobles_semana": 9}',
   'Reglas de la prenómina, una sola para todos. septimo_dia: "simple" (cada falta o permiso sin goce descuenta un día, como se hace hoy) o "proporcional" (además la parte del descanso: 1 falta en semana de 5 días paga 5.6 de 7, como la tabla FACTOR 7° DIA). retardos: "descontar_tiempo" (las horas de retardo ÷ 8) o "no_descontar". prima_vacacional: fracción del salario de los días de vacaciones (LFT: al menos 0.25). horas_dobles_semana: LFT art. 68, de ahí en adelante se pagan triples.')
on conflict (clave) do nothing;

-- Sueldo base SEMANAL con historial: un aumento es un renglón nuevo con su
-- fecha (en la hoja se escondía dentro de la fórmula: "=<monto>+<aumento>").
create table if not exists public.nomina_sueldos (
  id uuid primary key default gen_random_uuid(),
  empleado_id uuid not null references public.empleados(id),
  sueldo_semanal numeric(12,2) not null check (sueldo_semanal > 0),
  desde date not null,
  motivo text not null check (length(trim(motivo)) >= 3),
  registrado_por uuid default auth.uid() references public.perfiles(id),
  registrado_en timestamptz not null default now(),
  unique (empleado_id, desde)
);

-- Conceptos que hoy viven en notas de celda ("apoyo por ayuda en pintura",
-- "BONO POR CUMPLIMIENTO DE CARTA COMPROMISO", servicios fuera de planta).
create table if not exists public.nomina_conceptos (
  clave text primary key,
  nombre text not null,
  tipo text not null check (tipo in ('percepcion', 'deduccion')),
  descripcion text,
  activo boolean not null default true
);
insert into public.nomina_conceptos (clave, nombre, tipo, descripcion) values
  ('servicio_fuera', 'Servicio fuera de planta', 'percepcion', 'Instalación, puesta en marcha, levantamiento o garantía fuera de planta; anota el pedido o el lugar.'),
  ('gratificacion_entrega', 'Gratificación por entrega o flete', 'percepcion', 'Lo que hoy va en la pestaña "Incentivos": entrega de equipos y fletes.'),
  ('apoyo', 'Apoyo', 'percepcion', 'Apoyos fijos o eventuales; anota el motivo.'),
  ('bono_carta', 'Bono por carta compromiso', 'percepcion', 'Bono semanal acordado por carta compromiso.'),
  ('bono_referido', 'Bono por referir personal', 'percepcion', 'Por traer a una persona que se quedó a trabajar.'),
  ('proyecto_especial', 'Incentivo por proyecto especial', 'percepcion', 'Lo que hoy va en "Proyectos especiales".'),
  ('descuento_herramienta', 'Descuento por herramienta dañada', 'deduccion', 'Con la herramienta y quién lo autorizó.'),
  ('ahorro', 'Caja de ahorro', 'deduccion', 'Aportación semanal a la caja de ahorro.'),
  ('otro_descuento', 'Otro descuento', 'deduccion', 'Cualquier otro descuento; anota el motivo.')
on conflict (clave) do nothing;

-- Semana de nómina: del viernes al jueves; se paga el viernes siguiente. En la
-- hoja el título dice "Del 25 de septiembre al 02 de octubre" (de viernes a
-- viernes de pago) y había semanas de 6 y de 8 días y una que faltaba.
create table if not exists public.nomina_semanas (
  inicio date primary key check (extract(isodow from inicio) = 5),
  estado text not null default 'abierta' check (estado in ('abierta', 'cerrada')),
  cerrada_por uuid references public.perfiles(id),
  cerrada_en timestamptz,
  notas text
);

create table if not exists public.nomina_movimientos (
  id uuid primary key default gen_random_uuid(),
  semana date not null references public.nomina_semanas(inicio),
  empleado_id uuid not null references public.empleados(id),
  concepto text not null references public.nomina_conceptos(clave),
  importe numeric(12,2) not null check (importe > 0),
  nota text,
  referencia text,
  registrado_por uuid default auth.uid() references public.perfiles(id),
  registrado_en timestamptz not null default now()
);
create index if not exists nomina_movimientos_semana on public.nomina_movimientos (semana, empleado_id);

-- Préstamos con saldo, plan de descuento y quién autorizó (hoy viven en notas:
-- "PRESTAMO DE $… SE EMPIEZA HACER DEDUCCION A PARTIR DEL…").
create table if not exists public.nomina_prestamos (
  id uuid primary key default gen_random_uuid(),
  empleado_id uuid not null references public.empleados(id),
  monto numeric(12,2) not null check (monto > 0),
  descuento_semanal numeric(12,2) not null check (descuento_semanal > 0),
  primera_semana date not null check (extract(isodow from primera_semana) = 5),
  motivo text not null check (length(trim(motivo)) >= 3),
  autorizado_por uuid not null default auth.uid() references public.perfiles(id),
  autorizado_en timestamptz not null default now(),
  estado text not null default 'activo' check (estado in ('activo', 'cancelado')),
  cancelado_motivo text
);

-- Lo que se descontó de cada préstamo cada semana. En una semana abierta se
-- puede fijar a mano (0 = "esta semana no se descuenta"); al cerrar, lo que no
-- se fijó toma el descuento semanal.
create table if not exists public.nomina_prestamo_abonos (
  prestamo_id uuid not null references public.nomina_prestamos(id),
  semana date not null references public.nomina_semanas(inicio),
  importe numeric(12,2) not null check (importe >= 0),
  nota text,
  registrado_por uuid default auth.uid() references public.perfiles(id),
  registrado_en timestamptz not null default now(),
  primary key (prestamo_id, semana)
);

-- PENDIENTE DEL DUEÑO: base mensual del bono por puesto o por persona. Nace
-- vacía; base_mensual puede quedar en null. Sin base no hay monto.
create table if not exists public.bono_bases (
  id uuid primary key default gen_random_uuid(),
  puesto_id int references public.puestos(id),
  empleado_id uuid references public.empleados(id),
  base_mensual numeric(12,2) check (base_mensual is null or base_mensual >= 0),
  desde date not null,
  nota text,
  registrado_por uuid default auth.uid() references public.perfiles(id),
  registrado_en timestamptz not null default now(),
  check (num_nonnulls(puesto_id, empleado_id) = 1)
);

-- Bonos ya pagados (para no pagar dos veces el mismo mes).
create table if not exists public.nomina_bonos (
  evaluacion_id uuid primary key references public.objetivo_evaluaciones(id),
  semana date not null references public.nomina_semanas(inicio),
  pct numeric(5,2) not null,
  base numeric(12,2) not null,
  monto numeric(12,2) not null,
  registrado_en timestamptz not null default now()
);

-- La semana congelada: un renglón por persona, tal como se pagó.
create table if not exists public.nomina_renglones (
  semana date not null references public.nomina_semanas(inicio),
  empleado_id uuid not null references public.empleados(id),
  numero text,
  nombre text not null,
  puesto text,
  sueldo_semanal numeric(12,2),
  sueldo_origen text,
  salario_dia numeric(12,4),
  dias_fuera numeric(6,3) not null default 0,          -- antes del ingreso o después de la baja
  faltas numeric(6,3) not null default 0,
  permisos_sin_goce numeric(6,3) not null default 0,
  permisos_con_goce numeric(6,3) not null default 0,
  incapacidad numeric(6,3) not null default 0,
  vacaciones numeric(6,3) not null default 0,
  retardo_horas numeric(6,2) not null default 0,
  descuento_dias numeric(6,3) not null default 0,
  dias_pagados numeric(6,3) not null default 0,
  importe_dias numeric(12,2) not null default 0,
  horas_extra numeric(6,2) not null default 0,
  horas_dobles numeric(6,2) not null default 0,
  horas_triples numeric(6,2) not null default 0,
  importe_dobles numeric(12,2) not null default 0,
  importe_triples numeric(12,2) not null default 0,
  prima_vacacional numeric(12,2) not null default 0,
  percepciones numeric(12,2) not null default 0,
  deducciones numeric(12,2) not null default 0,
  prestamos numeric(12,2) not null default 0,
  bono_pct numeric(5,2),
  bono_monto numeric(12,2),
  bono_aviso text,
  bono_detalle jsonb,
  total_percepciones numeric(12,2) not null default 0,
  total_deducciones numeric(12,2) not null default 0,
  neto numeric(12,2) not null default 0,
  conceptos jsonb not null default '[]'::jsonb,
  avisos text[] not null default '{}',
  primary key (semana, empleado_id)
);

-- Guardias de nómina ----------------------------------------------------------
create or replace function public.nomina_sueldos_inalterables() returns trigger
language plpgsql as $$
begin
  raise exception 'El historial de sueldos no se edita ni se borra: registra el sueldo nuevo con su fecha' using errcode = '42501';
end $$;
drop trigger if exists inalterable on public.nomina_sueldos;
create trigger inalterable before update or delete on public.nomina_sueldos
  for each row execute function public.nomina_sueldos_inalterables();

create or replace function public.nomina_renglones_inalterables() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if exists (select 1 from nomina_semanas where inicio = new.semana and estado = 'cerrada') then
      raise exception 'La semana ya está cerrada' using errcode = '42501';
    end if;
    return new;
  end if;
  raise exception 'Una semana cerrada no se modifica: corrígelo en la semana abierta con otro concepto' using errcode = '42501';
end $$;
drop trigger if exists inalterable on public.nomina_renglones;
create trigger inalterable before insert or update or delete on public.nomina_renglones
  for each row execute function public.nomina_renglones_inalterables();
drop trigger if exists inalterable on public.nomina_bonos;
create trigger inalterable before update or delete on public.nomina_bonos
  for each row execute function public.nomina_renglones_inalterables();

create or replace function public.nomina_semana_guardia() returns trigger
language plpgsql as $$
begin
  if old.estado = 'cerrada' then
    raise exception 'La semana del % ya está cerrada: no se modifica', to_char(old.inicio, 'DD/MM/YYYY') using errcode = '42501';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;
drop trigger if exists guardia on public.nomina_semanas;
create trigger guardia before update or delete on public.nomina_semanas
  for each row execute function public.nomina_semana_guardia();

-- Movimientos y abonos solo en una semana abierta. Si la semana no existe, se
-- crea (abierta) al registrar lo primero.
create or replace function public.nomina_semana_abierta() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_semana date := case when tg_op = 'DELETE' then old.semana else new.semana end;
begin
  if tg_op = 'UPDATE' and old.semana <> new.semana
     and exists (select 1 from nomina_semanas where inicio = old.semana and estado = 'cerrada') then
    raise exception 'La semana del % ya se cerró: no se modifica', to_char(old.semana, 'DD/MM/YYYY') using errcode = '42501';
  end if;
  if tg_op = 'INSERT' then
    if extract(isodow from new.semana) <> 5 then raise exception 'La semana de nómina empieza en viernes'; end if;
    insert into nomina_semanas (inicio) values (new.semana) on conflict do nothing;
  end if;
  if exists (select 1 from nomina_semanas where inicio = v_semana and estado = 'cerrada') then
    raise exception 'La semana del % ya se cerró: no se modifica. Corrígelo en la semana abierta con otro concepto.',
      to_char(v_semana, 'DD/MM/YYYY') using errcode = '42501';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;
drop trigger if exists semana_abierta on public.nomina_movimientos;
create trigger semana_abierta before insert or update or delete on public.nomina_movimientos
  for each row execute function public.nomina_semana_abierta();
drop trigger if exists semana_abierta on public.nomina_prestamo_abonos;
create trigger semana_abierta before insert or update or delete on public.nomina_prestamo_abonos
  for each row execute function public.nomina_semana_abierta();

-- Un préstamo lo autoriza alguien que no es quien lo recibe; después solo
-- cambian el plan de descuento y el estado.
create or replace function public.nomina_prestamo_guardia() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Un préstamo no se borra: cancélalo con el motivo' using errcode = '42501';
  end if;
  if tg_op = 'INSERT' then
    new.autorizado_por := coalesce(auth.uid(), new.autorizado_por);
    new.autorizado_en := now();
  elsif (new.empleado_id, new.monto, new.primera_semana, new.autorizado_por) is distinct from
        (old.empleado_id, old.monto, old.primera_semana, old.autorizado_por) then
    raise exception 'De un préstamo solo cambia el descuento semanal o se cancela; si el monto era otro, cancélalo y regístralo de nuevo';
  end if;
  if exists (select 1 from empleados where id = new.empleado_id and usuario_id = new.autorizado_por) then
    raise exception 'Nadie se autoriza un préstamo a sí mismo' using errcode = '42501';
  end if;
  if new.estado = 'cancelado' and coalesce(trim(new.cancelado_motivo), '') = '' then
    raise exception 'Para cancelar un préstamo se necesita el motivo';
  end if;
  return new;
end $$;
drop trigger if exists guardia on public.nomina_prestamos;
create trigger guardia before insert or update or delete on public.nomina_prestamos
  for each row execute function public.nomina_prestamo_guardia();

-- Sueldos iniciales: si la ficha tiene salario diario, es el punto de partida
-- del historial (× 7 días, como la hoja: costo por día = semanal ÷ 7).
insert into public.nomina_sueldos (empleado_id, sueldo_semanal, desde, motivo, registrado_por)
select d.empleado_id, round(d.salario_diario * 7, 2), e.fecha_ingreso, 'Valor inicial tomado de la ficha (salario diario × 7)', null
from public.empleado_datos d join public.empleados e on e.id = d.empleado_id
where d.salario_diario is not null
  and not exists (select 1 from public.nomina_sueldos s where s.empleado_id = d.empleado_id)
on conflict do nothing;

-- Base del bono vigente para una persona en un mes (la suya, o la de su puesto).
create or replace function public.bono_base(p_empleado uuid, p_puesto int, p_mes date) returns numeric
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select base_mensual from bono_bases where empleado_id = p_empleado and desde <= p_mes order by desde desc limit 1),
    (select base_mensual from bono_bases where puesto_id = p_puesto and empleado_id is null and desde <= p_mes order by desde desc limit 1))
$$;
revoke execute on function public.bono_base(uuid, int, date) from public, anon, authenticated;

-- Prenómina de una semana: si está cerrada, lo congelado; si no, calculada al
-- momento desde las incidencias aprobadas, sueldos, conceptos, préstamos y
-- bonos aprobados. security definer porque finanzas (nómina 1) no ve la tabla
-- de empleados ni las incidencias; por eso revisa el permiso antes de nada.
create or replace function public.prenomina(p_semana date) returns setof public.nomina_renglones
language plpgsql stable security definer set search_path = public as $$
declare
  v_ini date := p_semana; v_fin date := p_semana + 6;
  v_cfg jsonb := coalesce((select valor from configuracion where clave = 'nomina'), '{}'::jsonb);
  v_habiles int; v_tope numeric; v_prima numeric; v_proporcional boolean; v_retardo boolean;
begin
  if not puede('nomina', 1) then
    raise exception 'La prenómina solo la ve quien tiene el módulo de nómina' using errcode = '42501';
  end if;
  if extract(isodow from p_semana) <> 5 then
    raise exception 'La semana de nómina empieza en viernes y el % no lo es', to_char(p_semana, 'DD/MM/YYYY');
  end if;
  if exists (select 1 from nomina_semanas where inicio = p_semana and estado = 'cerrada') then
    return query select * from nomina_renglones where semana = p_semana order by nombre;
    return;
  end if;
  v_habiles := greatest(dias_habiles(v_ini, v_fin), 1);
  v_tope := coalesce((v_cfg->>'horas_dobles_semana')::numeric, 9);
  v_prima := coalesce((v_cfg->>'prima_vacacional')::numeric, 0.25);
  v_proporcional := coalesce(v_cfg->>'septimo_dia', 'simple') = 'proporcional';
  v_retardo := coalesce(v_cfg->>'retardos', 'descontar_tiempo') = 'descontar_tiempo';

  return query
  with emp as (
    select e.id, e.numero, e.nombre, e.puesto, e.fecha_ingreso, e.baja_en
    from empleados e
    where e.fecha_ingreso <= v_fin and (e.activo or e.baja_en >= v_ini)
  ), sueldo as (
    select emp.id,
      coalesce(s.sueldo_semanal, round(d.salario_diario * 7, 2)) sueldo,
      case when s.sueldo_semanal is not null then 'historial' when d.salario_diario is not null then 'ficha' end origen
    from emp
    left join lateral (select x.sueldo_semanal from nomina_sueldos x where x.empleado_id = emp.id and x.desde <= v_fin
                       order by x.desde desc limit 1) s on true
    left join empleado_datos d on d.empleado_id = emp.id
  ), inc as (
    select i.empleado_id, i.tipo, coalesce(i.horas, 0) horas,
      case when i.tipo = 'incapacidad' then (least(i.fin, v_fin) - greatest(i.inicio, v_ini) + 1)::numeric
           when i.tipo in ('retardo', 'horas_extra') then 0::numeric
           when i.inicio >= v_ini and i.fin <= v_fin then i.dias
           else dias_habiles(greatest(i.inicio, v_ini), least(i.fin, v_fin))::numeric end dias
    from incidencias i
    where i.estado = 'aprobada' and i.inicio <= v_fin and i.fin >= v_ini
  ), aus as (
    select inc.empleado_id,
      coalesce(sum(dias) filter (where tipo = 'falta'), 0) faltas,
      coalesce(sum(dias) filter (where tipo = 'permiso_sin_goce'), 0) psg,
      coalesce(sum(dias) filter (where tipo = 'permiso_con_goce'), 0) pcg,
      coalesce(sum(dias) filter (where tipo = 'incapacidad'), 0) incap,
      coalesce(sum(dias) filter (where tipo = 'vacaciones'), 0) vac,
      coalesce(sum(horas) filter (where tipo = 'retardo'), 0) retardo,
      coalesce(sum(horas) filter (where tipo = 'horas_extra'), 0) extra
    from inc group by inc.empleado_id
  ), mov as (
    select m.empleado_id,
      coalesce(sum(m.importe) filter (where c.tipo = 'percepcion'), 0) perc,
      coalesce(sum(m.importe) filter (where c.tipo = 'deduccion'), 0) dedu,
      jsonb_agg(jsonb_build_object('clave', c.clave, 'concepto', c.nombre, 'tipo', c.tipo, 'importe', m.importe,
                                   'nota', m.nota, 'referencia', m.referencia, 'id', m.id) order by c.tipo desc, c.nombre) detalle
    from nomina_movimientos m join nomina_conceptos c on c.clave = m.concepto
    where m.semana = v_ini group by m.empleado_id
  ), pres as (
    select p.empleado_id, sum(x.importe) importe,
      jsonb_agg(jsonb_build_object('clave', 'prestamo', 'concepto', 'Préstamo', 'tipo', 'deduccion', 'importe', x.importe,
                                   'nota', p.motivo || ' · queda ' || to_char(x.saldo - x.importe, 'FM$999,999,990.00'),
                                   'referencia', p.id)) detalle
    from nomina_prestamos p
    cross join lateral (
      select coalesce(a.importe, least(p.descuento_semanal, s.saldo)) importe, s.saldo
      from (select p.monto - coalesce((select sum(b.importe) from nomina_prestamo_abonos b join nomina_semanas w on w.inicio = b.semana
                                        where b.prestamo_id = p.id and w.estado = 'cerrada'), 0) saldo) s
      left join nomina_prestamo_abonos a on a.prestamo_id = p.id and a.semana = v_ini
    ) x
    where p.estado = 'activo' and p.primera_semana <= v_ini and x.saldo > 0
    group by p.empleado_id
  ), bono as (
    -- Bonos de meses aprobados que no se han pagado. Sin base, se enseña el %
    -- y el aviso, y el mes sigue pendiente hasta que se defina la base.
    select ev.empleado_id,
      (array_agg(b.pct order by ev.mes desc))[1] pct,
      sum(round(b.base * b.pct / 100, 2)) filter (where b.base is not null) monto,
      bool_or(b.base is null) falta_base,
      jsonb_agg(jsonb_build_object('evaluacion', ev.id, 'mes', ev.mes, 'pct', b.pct, 'base', b.base,
                                   'monto', case when b.base is not null then round(b.base * b.pct / 100, 2) end) order by ev.mes) detalle
    from objetivo_evaluaciones ev
    cross join lateral (
      select coalesce((select a.total_corregido from objetivo_ajustes a where a.evaluacion_id = ev.id and a.estado = 'autorizado'
                       order by a.resuelto_en desc limit 1), ev.total) pct,
             bono_base(ev.empleado_id, ev.puesto_id, ev.mes) base
    ) b
    where ev.estado = 'aprobada' and (ev.aprobada_en at time zone 'America/Mexico_City')::date <= v_fin
      and not exists (select 1 from nomina_bonos nb where nb.evaluacion_id = ev.id)
    group by ev.empleado_id
  ), c1 as (
    select emp.*, s.sueldo, s.origen,
      least(7, greatest(0, emp.fecha_ingreso - v_ini)
               + case when emp.baja_en is not null and emp.baja_en < v_fin then v_fin - greatest(emp.baja_en, v_ini - 1) else 0 end)::numeric fuera,
      coalesce(a.faltas, 0) faltas, coalesce(a.psg, 0) psg, coalesce(a.pcg, 0) pcg, coalesce(a.incap, 0) incap,
      coalesce(a.vac, 0) vac, coalesce(a.retardo, 0) retardo, coalesce(a.extra, 0) extra,
      coalesce(m.perc, 0) perc, coalesce(m.dedu, 0) dedu, coalesce(pr.importe, 0) prest,
      coalesce(m.detalle, '[]'::jsonb) || coalesce(pr.detalle, '[]'::jsonb) conceptos,
      b.pct bono_pct, b.monto bono_monto, coalesce(b.falta_base, false) falta_base, b.detalle bono_detalle
    from emp
    join sueldo s on s.id = emp.id
    left join aus a on a.empleado_id = emp.id
    left join mov m on m.empleado_id = emp.id
    left join pres pr on pr.empleado_id = emp.id
    left join bono b on b.empleado_id = emp.id
  ), c2 as (
    select c1.*,
      round((c1.faltas + c1.psg) * case when v_proporcional then 7.0 / v_habiles else 1 end
            + case when v_retardo then c1.retardo / 8 else 0 end, 3) descuento,
      least(c1.extra, v_tope) dobles,
      greatest(c1.extra - v_tope, 0) triples
    from c1
  ), c3 as (
    select c2.*,
      greatest(0, round(7 - c2.fuera - c2.incap - c2.descuento, 3)) pagados
    from c2
  ), c4 as (
    select c3.*,
      coalesce(round(c3.sueldo / 7 * c3.pagados, 2), 0) imp_dias,
      coalesce(round(c3.sueldo / 56 * 2 * c3.dobles, 2), 0) imp_dobles,
      coalesce(round(c3.sueldo / 56 * 3 * c3.triples, 2), 0) imp_triples,
      coalesce(round(c3.sueldo / 7 * c3.vac * v_prima, 2), 0) prima
    from c3
  )
  -- return query exige el tipo exacto de cada columna, con su precisión.
  select v_ini, c4.id, c4.numero, c4.nombre, c4.puesto,
    c4.sueldo::numeric(12,2), c4.origen, round(c4.sueldo / 7, 4)::numeric(12,4),
    c4.fuera::numeric(6,3), c4.faltas::numeric(6,3), c4.psg::numeric(6,3), c4.pcg::numeric(6,3), c4.incap::numeric(6,3),
    c4.vac::numeric(6,3), c4.retardo::numeric(6,2), c4.descuento::numeric(6,3), c4.pagados::numeric(6,3),
    c4.imp_dias::numeric(12,2), c4.extra::numeric(6,2), c4.dobles::numeric(6,2), c4.triples::numeric(6,2),
    c4.imp_dobles::numeric(12,2), c4.imp_triples::numeric(12,2), c4.prima::numeric(12,2),
    c4.perc::numeric(12,2), c4.dedu::numeric(12,2), c4.prest::numeric(12,2),
    c4.bono_pct::numeric(5,2), c4.bono_monto::numeric(12,2), case when c4.falta_base then 'Falta definir la base del bono' end, c4.bono_detalle,
    (c4.imp_dias + c4.imp_dobles + c4.imp_triples + c4.prima + c4.perc + coalesce(c4.bono_monto, 0))::numeric(12,2),
    (c4.dedu + c4.prest)::numeric(12,2),
    (c4.imp_dias + c4.imp_dobles + c4.imp_triples + c4.prima + c4.perc + coalesce(c4.bono_monto, 0) - c4.dedu - c4.prest)::numeric(12,2),
    c4.conceptos,
    array_remove(array[
      case when c4.sueldo is null then 'Sin sueldo registrado' end,
      case when c4.origen = 'ficha' then 'Sueldo tomado de la ficha (salario diario × 7)' end,
      case when c4.triples > 0 then format('%s h extra: %s dobles y %s triples (LFT art. 68)', trim_scale(c4.extra), trim_scale(c4.dobles), trim_scale(c4.triples)) end,
      case when c4.falta_base then 'Falta definir la base del bono' end
    ], null)
  from c4
  order by c4.nombre;
end $$;

-- Cierra la semana: guarda los renglones tal como se calcularon, aplica los
-- abonos de préstamos y marca como pagados los bonos con monto.
create or replace function public.cerrar_semana_nomina(p_semana date) returns int
language plpgsql security definer set search_path = public as $$
declare v_n int;
begin
  if not puede('nomina', 3) then raise exception 'Solo RRHH o dirección cierran la semana de nómina' using errcode = '42501'; end if;
  if extract(isodow from p_semana) <> 5 then raise exception 'La semana de nómina empieza en viernes'; end if;
  if p_semana + 6 > hoy_planta() then
    raise exception 'La semana termina el jueves %: se cierra a partir de ese día', to_char(p_semana + 6, 'DD/MM/YYYY');
  end if;
  insert into nomina_semanas (inicio) values (p_semana) on conflict do nothing;
  perform 1 from nomina_semanas where inicio = p_semana and estado = 'abierta' for update;
  if not found then raise exception 'La semana del % ya está cerrada', to_char(p_semana, 'DD/MM/YYYY'); end if;

  insert into nomina_renglones select * from prenomina(p_semana);
  get diagnostics v_n = row_count;

  insert into nomina_prestamo_abonos (prestamo_id, semana, importe, nota)
  select (c->>'referencia')::uuid, p_semana, (c->>'importe')::numeric, 'Descuento semanal'
  from nomina_renglones r, jsonb_array_elements(r.conceptos) c
  where r.semana = p_semana and c->>'clave' = 'prestamo'
  on conflict (prestamo_id, semana) do nothing;

  insert into nomina_bonos (evaluacion_id, semana, pct, base, monto)
  select (b->>'evaluacion')::uuid, p_semana, (b->>'pct')::numeric, (b->>'base')::numeric, (b->>'monto')::numeric
  from nomina_renglones r, jsonb_array_elements(coalesce(r.bono_detalle, '[]'::jsonb)) b
  where r.semana = p_semana and b->>'monto' is not null;

  update nomina_semanas set estado = 'cerrada', cerrada_por = auth.uid(), cerrada_en = now() where inicio = p_semana;
  return v_n;
end $$;

-- Semanas recientes para el selector de la pantalla (la actual primero).
create or replace function public.semanas_nomina(p_cuantas int default 12)
returns table (inicio date, fin date, pago date, estado text, cerrada_en timestamptz, cerrada_por text, personas bigint, neto numeric)
language plpgsql stable security definer set search_path = public as $$
declare v_viernes date := hoy_planta() - ((extract(isodow from hoy_planta())::int - 5 + 7) % 7);
begin
  if not puede('nomina', 1) then raise exception 'Sin permiso de nómina' using errcode = '42501'; end if;
  return query
  select g.d, g.d + 6, g.d + 7, coalesce(s.estado, 'abierta'), s.cerrada_en, p.nombre,
    (select count(*) from nomina_renglones r where r.semana = g.d),
    (select sum(r.neto) from nomina_renglones r where r.semana = g.d)
  from (select (v_viernes - 7 * n) d from generate_series(0, greatest(p_cuantas, 1) - 1) n) g
  left join nomina_semanas s on s.inicio = g.d
  left join perfiles p on p.id = s.cerrada_por
  order by g.d desc;
end $$;

create or replace function public.prestamos_nomina()
returns table (id uuid, empleado_id uuid, nombre text, monto numeric, descuento_semanal numeric, primera_semana date, motivo text,
               autorizado_por text, autorizado_en timestamptz, estado text, cancelado_motivo text, abonado numeric, saldo numeric, semanas_restantes int)
language plpgsql stable security definer set search_path = public as $$
begin
  if not puede('nomina', 1) then raise exception 'Sin permiso de nómina' using errcode = '42501'; end if;
  return query
  select p.id, p.empleado_id, e.nombre, p.monto, p.descuento_semanal, p.primera_semana, p.motivo, a.nombre, p.autorizado_en,
    p.estado, p.cancelado_motivo, x.abonado, p.monto - x.abonado,
    case when p.estado = 'activo' and p.monto > x.abonado then ceil((p.monto - x.abonado) / p.descuento_semanal)::int else 0 end
  from nomina_prestamos p
  join empleados e on e.id = p.empleado_id
  left join perfiles a on a.id = p.autorizado_por
  cross join lateral (select coalesce(sum(b.importe), 0) abonado from nomina_prestamo_abonos b join nomina_semanas w on w.inicio = b.semana
                      where b.prestamo_id = p.id and w.estado = 'cerrada') x
  order by (p.estado = 'activo' and p.monto > x.abonado) desc, p.autorizado_en desc;
end $$;

create or replace function public.sueldos_nomina()
returns table (empleado_id uuid, numero text, nombre text, puesto text, activo boolean, sueldo_semanal numeric, desde date,
               origen text, historial jsonb)
language plpgsql stable security definer set search_path = public as $$
begin
  if not puede('nomina', 1) then raise exception 'Sin permiso de nómina' using errcode = '42501'; end if;
  return query
  select e.id, e.numero, e.nombre, e.puesto, e.activo,
    coalesce(s.sueldo_semanal, round(d.salario_diario * 7, 2)), s.desde,
    case when s.sueldo_semanal is not null then 'historial' when d.salario_diario is not null then 'ficha' end,
    coalesce((select jsonb_agg(jsonb_build_object('sueldo', h.sueldo_semanal, 'desde', h.desde, 'motivo', h.motivo,
                                                  'por', pf.nombre, 'en', h.registrado_en) order by h.desde desc)
              from nomina_sueldos h left join perfiles pf on pf.id = h.registrado_por where h.empleado_id = e.id), '[]'::jsonb)
  from empleados e
  left join lateral (select x.sueldo_semanal, x.desde from nomina_sueldos x where x.empleado_id = e.id and x.desde <= hoy_planta()
                     order by x.desde desc limit 1) s on true
  left join empleado_datos d on d.empleado_id = e.id
  where e.activo
  order by e.nombre;
end $$;

-- El bono en pesos de cada evaluación de un mes, solo para quien tiene nómina
-- (la pantalla de objetivos lo pide aparte; sin nómina, no existe).
create or replace function public.bonos_objetivos(p_mes date)
returns table (evaluacion_id uuid, pct numeric, base numeric, monto numeric, aviso text, pagado_semana date, pagado_monto numeric)
language plpgsql stable security definer set search_path = public as $$
begin
  if not puede('nomina', 1) then raise exception 'Los montos del bono solo los ve nómina' using errcode = '42501'; end if;
  return query
  select ev.id, b.pct, b.base, case when b.base is not null and b.pct is not null then round(b.base * b.pct / 100, 2) end,
    case when b.base is null then 'Falta definir la base del bono' end, nb.semana, nb.monto
  from objetivo_evaluaciones ev
  cross join lateral (
    select coalesce((select a.total_corregido from objetivo_ajustes a where a.evaluacion_id = ev.id and a.estado = 'autorizado'
                     order by a.resuelto_en desc limit 1), ev.total) pct,
           bono_base(ev.empleado_id, ev.puesto_id, ev.mes) base
  ) b
  left join nomina_bonos nb on nb.evaluacion_id = ev.id
  where ev.mes = date_trunc('month', p_mes)::date;
end $$;

-- ----------------------------------------------------------------------------
-- 12. RLS
-- ----------------------------------------------------------------------------
alter table public.puestos enable row level security;
alter table public.objetivo_indicadores enable row level security;
alter table public.objetivo_areas enable row level security;
alter table public.objetivo_plantillas enable row level security;
alter table public.objetivo_plantilla_lineas enable row level security;
alter table public.puesto_asignaciones enable row level security;
alter table public.objetivo_evaluaciones enable row level security;
alter table public.objetivo_resultados enable row level security;
alter table public.objetivo_evidencias enable row level security;
alter table public.objetivo_comentarios enable row level security;
alter table public.objetivo_ajustes enable row level security;
alter table public.objetivo_marcas enable row level security;
alter table public.nomina_sueldos enable row level security;
alter table public.nomina_conceptos enable row level security;
alter table public.nomina_semanas enable row level security;
alter table public.nomina_movimientos enable row level security;
alter table public.nomina_prestamos enable row level security;
alter table public.nomina_prestamo_abonos enable row level security;
alter table public.bono_bases enable row level security;
alter table public.nomina_bonos enable row level security;
alter table public.nomina_renglones enable row level security;

-- Catálogos: los ve cualquiera con rol o con ficha (no son sensibles).
do $$
declare t text;
begin
  foreach t in array array['puestos', 'objetivo_indicadores', 'objetivo_areas'] loop
    execute format('drop policy if exists ver on public.%I', t);
    execute format('create policy ver on public.%I for select to authenticated using ((select cardinality(mis_roles())) > 0 or (select mi_empleado()) is not null)', t);
    execute format('drop policy if exists editar on public.%I', t);
    execute format('create policy editar on public.%I for all to authenticated using ((select puede(''objetivos'', 3))) with check ((select puede(''objetivos'', 3)))', t);
  end loop;
  foreach t in array array['objetivo_plantillas', 'objetivo_plantilla_lineas'] loop
    execute format('drop policy if exists ver on public.%I', t);
    execute format('create policy ver on public.%I for select to authenticated using ((select puede(''objetivos'', 1)))', t);
    execute format('drop policy if exists editar on public.%I', t);
    execute format('create policy editar on public.%I for all to authenticated using ((select puede(''objetivos'', 3))) with check ((select puede(''objetivos'', 3)))', t);
  end loop;
end $$;

-- Un jefe ve las asignaciones de su gente; RRHH y dirección, todas; la persona, la suya.
drop policy if exists ver on public.puesto_asignaciones;
create policy ver on public.puesto_asignaciones for select to authenticated using (
  (select puede('objetivos', 3)) or ((select puede('objetivos', 1)) and jefe_id = (select auth.uid()))
  or empleado_id = (select mi_empleado()));
drop policy if exists editar on public.puesto_asignaciones;
create policy editar on public.puesto_asignaciones for all to authenticated
  using ((select puede('objetivos', 3))) with check ((select puede('objetivos', 3)));

-- Evaluaciones: sin política de escritura (solo las funciones de arriba).
-- El jefe ve a su gente; la persona, lo suyo; los vendedores, nada.
drop policy if exists ver on public.objetivo_evaluaciones;
create policy ver on public.objetivo_evaluaciones for select to authenticated using (
  (select puede('objetivos', 3)) or ((select puede('objetivos', 1)) and evaluador_id = (select auth.uid()))
  or empleado_id = (select mi_empleado()));
drop policy if exists ver on public.objetivo_resultados;
create policy ver on public.objetivo_resultados for select to authenticated using (
  exists (select 1 from public.objetivo_evaluaciones e where e.id = evaluacion_id));
drop policy if exists ver on public.objetivo_evidencias;
create policy ver on public.objetivo_evidencias for select to authenticated using (
  exists (select 1 from public.objetivo_resultados r where r.id = resultado_id));
drop policy if exists ver on public.objetivo_ajustes;
create policy ver on public.objetivo_ajustes for select to authenticated using (
  exists (select 1 from public.objetivo_evaluaciones e where e.id = evaluacion_id));
drop policy if exists ver on public.objetivo_comentarios;
create policy ver on public.objetivo_comentarios for select to authenticated using (
  exists (select 1 from public.objetivo_evaluaciones e where e.id = evaluacion_id));
-- La persona, su jefe y RRHH comentan lo que pueden ver; no se edita ni se borra.
drop policy if exists alta on public.objetivo_comentarios;
create policy alta on public.objetivo_comentarios for insert to authenticated with check (
  autor_id = (select auth.uid()) and exists (select 1 from public.objetivo_evaluaciones e where e.id = evaluacion_id));

-- Marcas: RRHH ve todas; cada quien las que hizo, las de su gente y las propias.
drop policy if exists ver on public.objetivo_marcas;
create policy ver on public.objetivo_marcas for select to authenticated using (
  (select puede('objetivos', 3)) or marcado_por = (select auth.uid()) or empleado_id = (select mi_empleado())
  or ((select puede('objetivos', 1)) and (area_id is not null or exists (
        select 1 from public.puesto_asignaciones a where a.empleado_id = objetivo_marcas.empleado_id and a.jefe_id = (select auth.uid())))));

-- Nómina: todo lo que tiene pesos, solo con el módulo "nomina".
do $$
declare t text;
begin
  foreach t in array array['nomina_sueldos', 'nomina_conceptos', 'nomina_semanas', 'nomina_movimientos', 'nomina_prestamos',
                           'nomina_prestamo_abonos', 'bono_bases', 'nomina_bonos', 'nomina_renglones'] loop
    execute format('drop policy if exists ver on public.%I', t);
    execute format('create policy ver on public.%I for select to authenticated using ((select puede(''nomina'', 1)))', t);
  end loop;
end $$;
drop policy if exists alta on public.nomina_sueldos;
create policy alta on public.nomina_sueldos for insert to authenticated with check ((select puede('nomina', 3)));
drop policy if exists editar on public.nomina_conceptos;
create policy editar on public.nomina_conceptos for all to authenticated using ((select puede('nomina', 3))) with check ((select puede('nomina', 3)));
drop policy if exists editar on public.nomina_movimientos;
create policy editar on public.nomina_movimientos for all to authenticated using ((select puede('nomina', 2))) with check ((select puede('nomina', 2)));
drop policy if exists alta on public.nomina_prestamos;
create policy alta on public.nomina_prestamos for insert to authenticated with check ((select puede('nomina', 3)));
drop policy if exists cambio on public.nomina_prestamos;
create policy cambio on public.nomina_prestamos for update to authenticated using ((select puede('nomina', 3))) with check ((select puede('nomina', 3)));
drop policy if exists editar on public.nomina_prestamo_abonos;
create policy editar on public.nomina_prestamo_abonos for all to authenticated using ((select puede('nomina', 2))) with check ((select puede('nomina', 2)));
drop policy if exists editar on public.bono_bases;
create policy editar on public.bono_bases for all to authenticated using ((select puede('nomina', 3))) with check ((select puede('nomina', 3)));

-- El checklist se mueve en varios celulares a la vez.
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'objetivo_marcas') then
    alter publication supabase_realtime add table public.objetivo_marcas;
  end if;
end $$;

-- Va al final: es language sql y la base revisa su cuerpo al crearla, así que
-- las tablas que consulta ya tienen que existir (en un reset desde cero).
--
-- "Mi desempeño" no es un permiso de rol: lo tiene quien tiene ficha de
-- empleado activa ligada a su usuario y un puesto con objetivos (un vendedor
-- sin objetivos no ve una pantalla vacía). Va en el mapa de permisos para que
-- el menú y la ruta lo filtren igual que lo demás; la RLS no lo usa (cada
-- quien ve lo suyo por usuario_id).
create or replace function public.mi_sesion() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'perfil', to_jsonb(p) - 'creado_en' - 'actualizado_en',
    'roles', to_jsonb(mis_roles()),
    'permisos', coalesce((
      select jsonb_object_agg(modulo, nivel) from (
        select modulo, max(nivel) nivel from permisos_rol where rol = any(mis_roles()) group by modulo
      ) x), '{}'::jsonb)
      || case when exists (select 1 from empleados e where e.usuario_id = p.id and e.activo
                             and (exists (select 1 from puesto_asignaciones a where a.empleado_id = e.id)
                                  or exists (select 1 from objetivo_evaluaciones v where v.empleado_id = e.id)))
              then '{"mi_desempeno": 1}'::jsonb else '{}'::jsonb end
  )
  from perfiles p where p.id = auth.uid()
$$;

notify pgrst, 'reload schema';

-- =============================================================================
-- Datos de demostración del módulo de ventas (CRM y cotizador).
--
-- Clientes "DEMO …" (concreteras, agregados, constructoras, molinos de grano),
-- sus contactos, oportunidades en todas las etapas con tareas, cotizaciones en
-- todos los estados (una por autorizar, una en dólares, una vencida, una
-- rechazada), pedidos directos, de Mercado Libre y del sitio web con facturas,
-- cobros y crédito compartido, y ajustes de comisión.
--
-- Usa los artículos reales del catálogo si ya se importaron (por clave) y, si
-- no, crea DEMO-… con precio fijo para que el cotizador tenga qué cotizar.
-- Ningún pedido DEMO lleva órdenes de producción ni movimientos de inventario:
-- así se pueden borrar (y 20_ventas.sql, que hace "delete from pedidos", no choca).
--
-- Idempotente: si ya están los clientes DEMO no hace nada.
--   psql "$DB_URL" -f scripts/demo/ventas.sql                 # cargar
--   psql "$DB_URL" -v limpiar=1 -f scripts/demo/ventas.sql    # borrar y volver a cargar
-- Requiere los usuarios de scripts/usuarios-locales.mjs (isaac@, juan@, susana@,
-- gerente.ventas@, finanzas@).
-- =============================================================================
\set ON_ERROR_STOP on

\if :{?limpiar}
begin;
-- Solo los clientes de ESTE script, por nombre: otros módulos también cargan
-- clientes "DEMO …" (producción, finanzas) y no son nuestros para borrarlos.
create temp table _mis_demo on commit drop as
select id from public.clientes where nombre in ('DEMO Concretos del Bajío', 'DEMO Agregados San Miguel', 'DEMO Constructora Altiplano',
  'DEMO Agroindustrias del Pacífico', 'DEMO Molino La Espiga', 'DEMO Premezclados del Norte', 'DEMO Granos y Semillas Los Altos',
  'DEMO Ferretería Industrial Tapatía', 'DEMO Compradores Mercado Libre', 'DEMO Cementos y Block Atotonilco');
-- Pedidos (cobros, facturas y crédito compartido se van en cascada).
delete from public.pedidos where cliente_id in (select id from _mis_demo);
-- Versiones primero (apuntan a su cotización raíz), luego las raíces.
delete from public.cotizaciones where origen_id is not null and cliente_id in (select id from _mis_demo);
delete from public.cotizaciones where cliente_id in (select id from _mis_demo);
delete from public.comision_ajustes where concepto like '%(demo)';
delete from public.comision_pagos where referencia like 'DEMO SPEI comisiones%';
-- Contactos, oportunidades y actividades se van con el cliente.
delete from public.clientes where id in (select id from _mis_demo);
commit;
\echo 'Datos DEMO de ventas borrados'
\endif

begin;

-- Quién "hace" cada paso: solo cambia auth.uid() (la RLS se la salta postgres),
-- para que los disparadores y funciones registren al vendedor correcto.
create or replace function pg_temp.como(p_correo text) returns uuid language plpgsql as $$
declare v uuid;
begin
  select id into v from public.perfiles where correo = p_correo;
  if v is null then raise exception 'Falta el usuario % (corre node scripts/usuarios-locales.mjs)', p_correo; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', v, 'role', 'authenticated')::text, true);
  return v;
end $$;

-- Artículo real por clave; si no existe, uno DEMO-… con precio fijo.
create or replace function pg_temp.art(p_clave text, p_tipo public.tipo_articulo, p_nombre text, p_unidad text, p_precio numeric,
                                       p_desc text default null) returns uuid language plpgsql as $$
declare v uuid;
begin
  select id into v from public.articulos where clave = p_clave and activo;
  if v is not null and exists (select 1 from public.precios_lista where articulo_id = v) then return v; end if;
  select id into v from public.articulos where clave = 'DEMO-' || p_clave;
  if v is null then
    insert into public.articulos (clave, tipo, nombre, unidad, descripcion) values ('DEMO-' || p_clave, p_tipo, p_nombre, p_unidad, p_desc) returning id into v;
    insert into public.costos_articulo (articulo_id, costo, precio_fijo) values (v, round(p_precio * 0.6, 2), p_precio);
  end if;
  return v;
end $$;

-- Partida libre (flete, instalación) con su texto.
create or replace function pg_temp.libre(p_cot uuid, p_titulo text, p_precio numeric, p_desc text default null, p_opcional boolean default false)
returns uuid language sql as $$
  insert into public.cotizacion_lineas (cotizacion_id, orden, titulo, descripcion, unidad, cantidad, precio_unitario, opcional)
  values (p_cot, coalesce((select max(orden) from public.cotizacion_lineas where cotizacion_id = p_cot), 0) + 1, p_titulo, p_desc, 'servicio', 1, p_precio, p_opcional)
  returning id
$$;

do $$
declare
  v_isaac uuid; v_juan uuid; v_susy uuid; v_ger uuid; v_fin uuid;
  -- artículos
  a_zeus15 uuid; a_zeus30 uuid; a_criba uuid; a_artesa uuid; a_cargadora uuid; a_elev4 uuid; a_elev7 uuid; a_mezcla uuid; a_tolva uuid;
  a_grip uuid; a_cang uuid; a_torn uuid; a_chum uuid; a_colector uuid; a_vibra uuid; a_celda uuid; a_grapas uuid; a_instal uuid;
  -- clientes
  c_bajio uuid; c_sanmiguel uuid; c_altiplano uuid; c_espiga uuid; c_norte uuid; c_altos uuid; c_tapatia uuid; c_ml uuid; c_block uuid; c_guate uuid;
  o uuid; q uuid; l uuid; p uuid; v_hoy date := (now() at time zone 'America/Mexico_City')::date;
begin
  if exists (select 1 from public.clientes where nombre = 'DEMO Concretos del Bajío') then
    raise notice 'Los datos DEMO de ventas ya estaban (usa -v limpiar=1 para recargarlos)';
    return;
  end if;

  v_isaac := pg_temp.como('isaac@hegamex.com');
  v_juan := pg_temp.como('juan@hegamex.com');
  v_susy := pg_temp.como('susana@hegamex.com');
  v_ger := pg_temp.como('gerente.ventas@hegamex.com');
  v_fin := pg_temp.como('finanzas@hegamex.com');
  perform set_config('request.jwt.claims', '', true);

  -- Celular del agente: sale en la cotización impresa (en la hoja se escribía a mano en D5).
  update public.perfiles set telefono = '33 1890 4417' where id = v_isaac and telefono is null;
  update public.perfiles set telefono = '33 2104 7782' where id = v_juan and telefono is null;
  update public.perfiles set telefono = '33 1566 0931' where id = v_susy and telefono is null;

  -- ------------------------------------------------------------------ catálogo
  a_zeus15 := pg_temp.art('E-198', 'equipo', 'Dosificadora ZEUS 15 móvil', 'pieza', 1121000);
  a_zeus30 := pg_temp.art('E-289', 'equipo', 'Dosificadora ZEUS 30 con 3 tolvas móvil', 'pieza', 1656000);
  a_criba := pg_temp.art('E-121', 'equipo', 'Cribadora cilíndrica secuencial de 13 a 16 metros cúbicos', 'pieza', 373000);
  a_artesa := pg_temp.art('E-005', 'equipo', 'Banda transportadora tipo artesa de doble uso de 20" x 8 metros con variador', 'pieza', 188000);
  a_cargadora := pg_temp.art('E-041', 'equipo', 'Banda cargadora de 20" x 12 metros con levante manual', 'pieza', 214000);
  a_elev4 := pg_temp.art('E-309', 'equipo', 'Elevador de 4 metros con cangilón de 6" x 5"', 'pieza', 132000);
  a_elev7 := pg_temp.art('E-139', 'equipo', 'Elevador de 7 metros con cangilones de 6" x 5"', 'pieza', 164000);
  a_mezcla := pg_temp.art('E-163', 'equipo', 'Mezcladora horizontal de 1 tonelada', 'pieza', 242000);
  a_tolva := pg_temp.art('E-388', 'equipo', 'Carro tolva sencillo de 5 metros cúbicos inoxidable', 'pieza', 221000);
  a_grip := pg_temp.art('C-00482', 'componente', 'Banda grip top 2 capas 18" de ancho', 'metro', 488.58);
  a_cang := pg_temp.art('C-00420', 'componente', 'Cangilon 8x5 azul, marca Tapco', 'pieza', 152.86);
  a_torn := pg_temp.art('C-00423', 'componente', 'Tornillo p/cangilon 1/4 X 1 1/2 Galv.', 'pieza', 5.72);
  a_chum := pg_temp.art('C-00142', 'componente', 'Chumacera 2" 4B pared UCF 211-32', 'pieza', 392.86);
  a_colector := pg_temp.art('C-N1637', 'componente', 'Colector de polvos de 14 cartuchos marca DKT', 'pieza', 25410);
  a_vibra := pg_temp.art('C-N2341', 'componente', 'Moto Vibrador eléctrico DKTEC 1/2 HP 3450 RPM 3F 220-360 Volts', 'pieza', 7285.72);
  a_celda := pg_temp.art('C-00783', 'componente', 'Celda de carga tipo S, (5,000/10,000 lbs), cable de 6 m', 'pieza', 3428.58);
  a_grapas := pg_temp.art('C-00864', 'componente', 'Grapas RS 187 de 24" FLEXCO Inoxidable', 'caja', 13218.58);
  a_instal := pg_temp.art('C-00517', 'servicio', 'Servicio tecnico de instalacion silo movil', 'servicio', 62857.15);

  -- ------------------------------------------------------------------ clientes y contactos
  insert into public.clientes (nombre, razon_social, rfc, giro, ciudad, estado, vendedor_id, fuente_id, dias_credito, notas) values
    ('DEMO Concretos del Bajío', 'Concretos del Bajío S.A. de C.V.', 'CBA180315KJ2', 'Concretera', 'León', 'Guanajuato', v_isaac,
     (select id from public.fuentes_contacto where nombre = 'Ya había comprado'), 15, 'Dos plantas en León y una en Silao. Compran refacciones cada trimestre.')
    returning id into c_bajio;
  insert into public.clientes (nombre, razon_social, rfc, giro, ciudad, estado, vendedor_id, fuente_id) values
    ('DEMO Agregados San Miguel', 'Agregados y Triturados San Miguel S. de R.L. de C.V.', 'ATS150722QW8', 'Agregados pétreos', 'Querétaro', 'Querétaro', v_isaac,
     (select id from public.fuentes_contacto where nombre = 'Formulario del sitio web')) returning id into c_sanmiguel;
  insert into public.clientes (nombre, razon_social, giro, ciudad, estado, vendedor_id, fuente_id) values
    ('DEMO Constructora Altiplano', 'Constructora Altiplano del Centro S.A. de C.V.', 'Constructora', 'San Luis Potosí', 'San Luis Potosí', v_isaac,
     (select id from public.fuentes_contacto where nombre = 'Llamada por parte del cliente')) returning id into c_altiplano;
  insert into public.clientes (nombre, razon_social, rfc, giro, ciudad, estado, pais, vendedor_id, fuente_id) values
    ('DEMO Agroindustrias del Pacífico', 'Agroindustrias del Pacífico S.A.', null, 'Molino de granos (exportación)', 'Escuintla', 'Escuintla', 'Guatemala', v_isaac,
     (select id from public.fuentes_contacto where nombre = 'Correo por parte del cliente')) returning id into c_guate;
  insert into public.clientes (nombre, razon_social, rfc, giro, ciudad, estado, vendedor_id, fuente_id) values
    ('DEMO Molino La Espiga', 'Molinos La Espiga S.A. de C.V.', 'MES0904118Z3', 'Molino de grano', 'Celaya', 'Guanajuato', v_juan,
     (select id from public.fuentes_contacto where nombre = 'Formulario de Facebook')) returning id into c_espiga;
  insert into public.clientes (nombre, razon_social, rfc, giro, ciudad, estado, vendedor_id, fuente_id, dias_credito) values
    ('DEMO Premezclados del Norte', 'Premezclados del Norte S.A.P.I. de C.V.', 'PNO120530RT6', 'Concretera', 'Monterrey', 'Nuevo León', v_juan,
     (select id from public.fuentes_contacto where nombre = 'Llamada por parte del cliente'), 30) returning id into c_norte;
  insert into public.clientes (nombre, razon_social, giro, ciudad, estado, vendedor_id, fuente_id) values
    ('DEMO Granos y Semillas Los Altos', 'Granos y Semillas de Los Altos S.P.R. de R.L.', 'Acopio de granos', 'Tepatitlán', 'Jalisco', v_susy,
     (select id from public.fuentes_contacto where nombre = 'WhatsApp por parte del cliente')) returning id into c_altos;
  insert into public.clientes (nombre, razon_social, rfc, giro, ciudad, estado, vendedor_id, es_distribuidor, fuente_id) values
    ('DEMO Ferretería Industrial Tapatía', 'Ferretería Industrial Tapatía S.A. de C.V.', 'FIT0711239A1', 'Distribuidor de refacciones', 'Guadalajara', 'Jalisco', v_susy, true,
     (select id from public.fuentes_contacto where nombre = 'Visita por parte del cliente')) returning id into c_tapatia;
  insert into public.clientes (nombre, giro, ciudad, estado, vendedor_id, fuente_id) values
    ('DEMO Compradores Mercado Libre', 'Venta en línea', 'Varias', 'Varios', v_susy,
     (select id from public.fuentes_contacto where nombre = 'Pregunta de Mercado Libre')) returning id into c_ml;
  insert into public.clientes (nombre, giro, ciudad, estado, fuente_id) values
    ('DEMO Cementos y Block Atotonilco', 'Bloquera', 'Atotonilco el Alto', 'Jalisco', (select id from public.fuentes_contacto where nombre = 'Llamada a recepción'))
    returning id into c_block;

  insert into public.contactos (cliente_id, nombre, puesto, telefono, whatsapp, correo, principal) values
    (c_bajio, 'Ing. Rodrigo Ramírez', 'Gerente de planta', '477 210 4410', '477 210 4410', 'rramirez@concretosbajio.demo', true),
    (c_bajio, 'Lic. Mariana Olvera', 'Compras', '477 210 4422', '477 552 1087', 'compras@concretosbajio.demo', false),
    (c_sanmiguel, 'Ing. Fernando Ugalde', 'Director de operaciones', '442 318 2290', '442 318 2290', 'fugalde@agregadossm.demo', true),
    (c_altiplano, 'Arq. Laura Medina', 'Residente de obra', '444 129 8831', '444 129 8831', null, true),
    (c_guate, 'Sr. Carlos Méndez', 'Gerente general', '+502 5521 4430', '50255214430', 'cmendez@agropacifico.demo', true),
    (c_espiga, 'Don Ernesto Villalobos', 'Dueño', '461 612 0098', '461 612 0098', null, true),
    (c_norte, 'Ing. Patricia Garza', 'Mantenimiento', '81 8340 2211', '81 1250 7734', 'pgarza@premezcladosnorte.demo', true),
    (c_altos, 'Sr. Jorge Gutiérrez', 'Encargado de bodega', '378 781 2203', '378 781 2203', null, true),
    (c_tapatia, 'Sra. Rocío Navarro', 'Compras', '33 3614 9902', '33 1290 4471', 'rnavarro@ferretapatia.demo', true),
    (c_block, 'Sr. Tomás Aceves', 'Dueño', '391 917 0042', '391 917 0042', null, true);

  -- ------------------------------------------------------------------ Isaac
  perform pg_temp.como('isaac@hegamex.com');

  -- Oportunidad en negociación con tarea vencida: la dosificadora para León.
  insert into public.oportunidades (cliente_id, contacto_id, titulo, etapa, linea, monto_estimado, probabilidad, fecha_cierre_estimada, vendedor_id, fuente_id, etapa_desde)
  values (c_bajio, (select id from public.contactos where cliente_id = c_bajio and principal), 'Dosificadora ZEUS 15 para planta León',
          'negociacion', 'maquinaria', 1121000, 60, v_hoy + 20, v_isaac, (select fuente_id from public.clientes where id = c_bajio), now() - interval '9 days')
  returning id into o;
  insert into public.actividades (cliente_id, oportunidad_id, tipo, descripcion, vence_en, usuario_id, en) values
    (c_bajio, o, 'visita', 'Visita a planta León: midieron el espacio, quieren la ZEUS 15 con colector de polvos.', null, v_isaac, now() - interval '12 days'),
    (c_bajio, o, 'llamada', 'Piden precio especial si cierran este mes; les dije que lo consulto con gerencia.', null, v_isaac, now() - interval '3 days'),
    (c_bajio, o, 'tarea', 'Llamar al Ing. Ramírez para cerrar anticipo', v_hoy - 1, v_isaac, now() - interval '3 days');

  -- Cotización POR AUTORIZAR (la del editor: 6 partidas, una bajo el mínimo, una opcional, flete libre, 12 meses).
  q := public.nueva_cotizacion(c_bajio, o);
  perform public.agregar_partida(q, a_zeus15, 1);
  perform public.agregar_partida(q, a_colector, 1);
  perform public.agregar_partida(q, a_vibra, 2);
  perform public.agregar_partida(q, a_celda, 4);
  l := (select id from public.agregar_partida(q, a_artesa, 1));
  update public.cotizacion_lineas set opcional = true,
    titulo = titulo || ' (opcional: alimentación a tolvas)' where id = l;
  perform pg_temp.libre(q, 'Flete a León, Gto. (tractocamión con plataforma)', 24000, '• Incluye maniobras de carga en planta Hegamex' || chr(10) || '• Descarga por cuenta del cliente');
  -- 1,000,000 contra 1,008,900 de mínimo: abajo del mínimo, pide autorización.
  update public.cotizacion_lineas set precio_unitario = 1000000 where cotizacion_id = q and articulo_id = a_zeus15;
  update public.cotizaciones set plan_meses = 12, tiempo_entrega = '45 días hábiles tiempo estimado de entrega.',
    notas = notas || array['Incluye capacitación al operador en sitio (1 día).'] where id = q;
  perform public.pedir_autorizacion(q, 'Cierran este mes si queda en un millón; ya compraron refacciones con nosotros 3 veces.');

  -- Cotización ENVIADA hace 10 días: cribadora + banda + flete + instalación opcional.
  insert into public.oportunidades (cliente_id, titulo, etapa, linea, monto_estimado, probabilidad, vendedor_id, etapa_desde)
  values (c_sanmiguel, 'Cribadora cilíndrica con banda de descarga', 'cotizado', 'maquinaria', 579500, 40, v_isaac, now() - interval '10 days') returning id into o;
  insert into public.actividades (cliente_id, oportunidad_id, tipo, descripcion, vence_en, usuario_id, en) values
    (c_sanmiguel, o, 'whatsapp', 'Le mandé la cotización y videos de la cribadora trabajando en Celaya.', null, v_isaac, now() - interval '10 days'),
    (c_sanmiguel, o, 'tarea', 'Dar seguimiento: ¿ya la presentó al consejo?', v_hoy + 3, v_isaac, now() - interval '2 days');
  q := public.nueva_cotizacion(c_sanmiguel, o);
  perform public.agregar_partida(q, a_criba, 1);
  perform public.agregar_partida(q, a_artesa, 1);
  perform pg_temp.libre(q, 'Flete a Querétaro, Qro.', 18500);
  perform pg_temp.libre(q, 'Instalación y puesta en marcha', 35000, '• 2 técnicos, 3 días' || chr(10) || '• No incluye grúa ni obra civil', true);
  update public.cotizaciones set fecha = v_hoy - 10 where id = q;
  update public.cotizaciones set estado = 'enviada', enviada_en = now() - interval '10 days' where id = q;

  -- Cotización RECHAZADA (elevador): la oportunidad se pierde con su motivo.
  insert into public.oportunidades (cliente_id, titulo, etapa, linea, monto_estimado, vendedor_id, etapa_desde)
  values (c_sanmiguel, 'Elevador de cangilones para silo', 'cotizado', 'maquinaria', 132000, v_isaac, now() - interval '40 days') returning id into o;
  q := public.nueva_cotizacion(c_sanmiguel, o);
  perform public.agregar_partida(q, a_elev4, 1);
  update public.cotizaciones set fecha = v_hoy - 40 where id = q;
  update public.cotizaciones set estado = 'enviada', enviada_en = now() - interval '40 days' where id = q;
  perform public.rechazar_cotizacion(q, 'Compró con la competencia (precio 12 % abajo)', true);

  -- Cotización VENCIDA (enviada hace 30 días, vigencia 15).
  insert into public.oportunidades (cliente_id, titulo, etapa, linea, monto_estimado, vendedor_id, etapa_desde)
  values (c_altiplano, 'Carro tolva para obra en SLP', 'cotizado', 'maquinaria', 221000, v_isaac, now() - interval '30 days') returning id into o;
  q := public.nueva_cotizacion(c_altiplano, o);
  perform public.agregar_partida(q, a_tolva, 1);
  update public.cotizaciones set fecha = v_hoy - 30 where id = q;
  update public.cotizaciones set estado = 'enviada', enviada_en = now() - interval '30 days' where id = q;

  insert into public.oportunidades (cliente_id, titulo, etapa, linea, monto_estimado, probabilidad, vendedor_id, etapa_desde, notas) values
    (c_altiplano, 'Silo y helicoidal para nueva planta', 'prospecto', 'maquinaria', 450000, 20, v_isaac, now() - interval '4 days', 'Arranca obra en enero.'),
    (c_altiplano, 'Bandas para trituradora secundaria', 'contactado', 'maquinaria', 380000, 30, v_isaac, now() - interval '6 days', null);
  insert into public.actividades (cliente_id, tipo, descripcion, vence_en, usuario_id, en) values
    (c_altiplano, 'llamada', 'La arquitecta pide visita a obra para medir la trituradora.', null, v_isaac, now() - interval '6 days'),
    (c_altiplano, 'tarea', 'Agendar visita a obra en SLP', v_hoy + 1, v_isaac, now() - interval '6 days');

  -- Cotización BORRADOR en dólares para Guatemala (exportación).
  q := public.nueva_cotizacion(c_guate);
  perform public.agregar_partida(q, a_mezcla, 1);
  perform public.agregar_partida(q, a_elev7, 1);
  perform public.ajustar_moneda_cotizacion(q, 'USD', 18.50, false);
  update public.cotizaciones set notas = array['Garantía de fabricación por escrito.',
    'Si se exporta no aplica IVA y se paga el subtotal (obligatorio pedimento de exportación).', 'Precio EXW planta Atotonilco, Jal.'],
    condiciones_pago = '50% T/T in advance, 50% T/T before shipping.' where id = q;

  -- ACEPTADAS → pedidos de septiembre (comisiones): la ZEUS 30 y refacciones.
  q := public.nueva_cotizacion(c_bajio);
  perform public.agregar_partida(q, a_zeus30, 1);
  perform public.agregar_partida(q, a_instal, 1);
  update public.cotizaciones set fecha = '2026-08-27' where id = q;
  update public.cotizaciones set estado = 'enviada', enviada_en = '2026-08-27 11:00-06' where id = q;
  perform pg_temp.como('gerente.ventas@hegamex.com');
  p := public.convertir_a_pedido(q, '2026-11-14');
  update public.pedidos set fecha = '2026-09-03', estado = 'en_produccion' where id = p;
  update public.oportunidades set cerrada_en = '2026-09-03', etapa_desde = '2026-09-03' where id = (select oportunidad_id from public.cotizaciones where id = q);
  insert into public.facturas (pedido_id, folio, fecha, total) values (p, 'A-2961', '2026-09-03', (select total from public.pedidos where id = p));
  insert into public.cobros (pedido_id, fecha, monto, metodo, referencia, registrado_por) values
    (p, '2026-09-04', round((select total from public.pedidos where id = p) * 0.5, 2), 'transferencia', 'SPEI 0904-ANT', v_fin);

  perform pg_temp.como('isaac@hegamex.com');
  q := public.nueva_cotizacion(c_bajio);
  perform public.agregar_partida(q, a_grip, 30);
  perform public.agregar_partida(q, a_cang, 60);
  perform public.agregar_partida(q, a_torn, 120);
  perform public.agregar_partida(q, a_chum, 4);
  perform public.agregar_partida(q, a_grapas, 2);
  update public.cotizaciones set fecha = '2026-09-10', tiempo_entrega = 'Entrega inmediata (salvo previa venta).', condiciones_pago = 'En una sola exhibición.' where id = q;
  update public.cotizaciones set estado = 'enviada', enviada_en = '2026-09-10 10:00-06' where id = q;
  p := public.convertir_a_pedido(q, '2026-09-15');
  update public.pedidos set fecha = '2026-09-12', estado = 'entregado' where id = p;
  update public.pedidos set entregado_en = '2026-09-15 13:00-06' where id = p;
  update public.pedido_lineas set cantidad_entregada = cantidad where pedido_id = p;
  insert into public.facturas (pedido_id, folio, fecha, total) values (p, 'A-2950', '2026-09-12', (select total from public.pedidos where id = p));
  insert into public.cobros (pedido_id, fecha, monto, metodo, referencia, registrado_por) values
    (p, '2026-09-12', (select total from public.pedidos where id = p), 'transferencia', 'SPEI 0912', v_fin);

  -- Banda + elevador para la constructora con crédito compartido 70/30 con Susana.
  q := public.nueva_cotizacion(c_altiplano);
  perform public.agregar_partida(q, a_cargadora, 1);
  perform public.agregar_partida(q, a_elev4, 1);
  update public.cotizaciones set fecha = '2026-09-15' where id = q;
  update public.cotizaciones set estado = 'enviada', enviada_en = '2026-09-15 09:00-06' where id = q;
  p := public.convertir_a_pedido(q, v_hoy + 18);
  update public.pedidos set fecha = '2026-09-22' where id = p;
  insert into public.pedido_vendedores (pedido_id, vendedor_id, porcentaje) values (p, v_isaac, 70), (p, v_susy, 30);
  insert into public.cobros (pedido_id, fecha, monto, metodo, referencia, registrado_por) values
    (p, '2026-09-23', round((select total from public.pedidos where id = p) * 0.5, 2), 'transferencia', 'Anticipo 50 %', v_fin);

  -- ------------------------------------------------------------------ Juan Manuel
  perform pg_temp.como('juan@hegamex.com');
  insert into public.oportunidades (cliente_id, titulo, etapa, linea, monto_estimado, probabilidad, vendedor_id, etapa_desde)
  values (c_espiga, 'Elevador 7 m y mezcladora para molino', 'cotizado', 'maquinaria', 386000, 50, v_juan, now() - interval '5 days') returning id into o;
  insert into public.actividades (cliente_id, oportunidad_id, tipo, descripcion, vence_en, usuario_id, en) values
    (c_espiga, o, 'tarea', 'Confirmar si el elevador va a 220 o 440 V', v_hoy + 2, v_juan, now() - interval '5 days');
  q := public.nueva_cotizacion(c_espiga, o);
  perform public.agregar_partida(q, a_elev7, 1);
  perform public.agregar_partida(q, a_mezcla, 1);
  update public.cotizaciones set fecha = v_hoy - 5, descuento_pct = 0.05,
    leyenda_promocion = 'de descuento ya aplicado por la promoción de octubre. Válido hasta el 31 de octubre.' where id = q;
  update public.cotizaciones set estado = 'enviada', enviada_en = now() - interval '5 days' where id = q;

  q := public.nueva_cotizacion(c_norte);
  perform public.agregar_partida(q, a_tolva, 1);
  update public.cotizaciones set fecha = '2026-09-28', condiciones_pago = '60% anticipo, 40% al aviso de la entrega.' where id = q;
  update public.cotizaciones set estado = 'enviada', enviada_en = '2026-09-28 12:00-06' where id = q;
  p := public.convertir_a_pedido(q, v_hoy + 40);
  update public.pedidos set fecha = '2026-10-01' where id = p;
  insert into public.facturas (pedido_id, folio, fecha, total) values (p, 'A-2988', '2026-10-01', round((select total from public.pedidos where id = p) * 0.6, 2));
  insert into public.cobros (pedido_id, fecha, monto, metodo, referencia, registrado_por) values
    (p, '2026-10-02', round((select total from public.pedidos where id = p) * 0.6, 2), 'transferencia', 'Anticipo 60 %', v_fin);

  insert into public.oportunidades (cliente_id, titulo, etapa, linea, monto_estimado, probabilidad, vendedor_id, etapa_desde) values
    (c_norte, 'Banda cargadora 24" para planta Apodaca', 'prospecto', 'maquinaria', 172000, 20, v_juan, now() - interval '2 days'),
    (c_norte, 'Refacciones para bandas (grapas y rodillos)', 'negociacion', 'refacciones', 48000, 70, v_juan, now() - interval '15 days');
  q := public.nueva_cotizacion(c_norte);
  perform public.agregar_partida(q, a_grapas, 2);
  perform public.agregar_partida(q, a_grip, 20);

  -- ------------------------------------------------------------------ Susana: refacciones, ML y sitio web
  perform pg_temp.como('susana@hegamex.com');
  insert into public.oportunidades (cliente_id, titulo, etapa, linea, monto_estimado, probabilidad, vendedor_id, etapa_desde) values
    (c_altos, 'Cangilones Tapco y banda para elevadores', 'contactado', 'refacciones', 35000, 50, v_susy, now() - interval '3 days'),
    (c_tapatia, 'Distribución de chumaceras y catarinas', 'negociacion', 'refacciones', 90000, 60, v_susy, now() - interval '8 days');
  q := public.nueva_cotizacion(c_altos);
  perform public.agregar_partida(q, a_cang, 80);
  perform public.agregar_partida(q, a_torn, 160);
  perform public.agregar_partida(q, a_grip, 25);
  update public.cotizaciones set fecha = v_hoy - 2 where id = q;
  update public.cotizaciones set estado = 'enviada', enviada_en = now() - interval '2 days' where id = q;

  -- Mercado Libre: sin cotización, con número de venta.
  p := gen_random_uuid();
  insert into public.pedidos (id, cliente_id, vendedor_id, canal, id_externo, fecha, estado, entregado_en, notas)
  values (p, c_ml, v_susy, 'mercadolibre', '2000009812345671', v_hoy - 1, 'entregado', now() - interval '20 hours', 'Envío Full');
  perform public.agregar_partida_pedido(p, a_vibra, 1);
  perform public.agregar_partida_pedido(p, a_chum, 2);
  update public.pedido_lineas set cantidad_entregada = cantidad where pedido_id = p;
  insert into public.cobros (pedido_id, fecha, monto, metodo, referencia, registrado_por) values
    (p, v_hoy - 1, (select total from public.pedidos where id = p), 'mercadopago', 'Liberado ML', v_fin);
  p := gen_random_uuid();
  insert into public.pedidos (id, cliente_id, vendedor_id, canal, id_externo, fecha, notas)
  values (p, c_ml, v_susy, 'mercadolibre', '2000009812399014', v_hoy, 'Esperando recolección');
  perform public.agregar_partida_pedido(p, a_cang, 40);
  perform public.agregar_partida_pedido(p, a_torn, 80);
  -- Sitio web: el distribuidor compra chumaceras.
  p := gen_random_uuid();
  insert into public.pedidos (id, cliente_id, vendedor_id, canal, id_externo, fecha, fecha_compromiso, condiciones_pago)
  values (p, c_tapatia, v_susy, 'sitio_web', 'WEB-10472', '2026-09-18', '2026-09-25', 'En una sola exhibición.');
  perform public.agregar_partida_pedido(p, a_chum, 24);
  perform public.agregar_partida_pedido(p, a_celda, 6);
  update public.pedidos set estado = 'entregado' where id = p;
  update public.pedidos set entregado_en = '2026-09-24 16:00-06' where id = p;
  insert into public.facturas (pedido_id, folio, fecha, total) values (p, 'A-2957', '2026-09-18', (select total from public.pedidos where id = p));
  insert into public.cobros (pedido_id, fecha, monto, metodo, referencia, registrado_por) values
    (p, '2026-09-18', (select total from public.pedidos where id = p), 'tarjeta', 'Pasarela web', v_fin);

  -- ------------------------------------------------------------------ comisiones: ajustes y pago de septiembre
  perform pg_temp.como('gerente.ventas@hegamex.com');
  insert into public.comision_ajustes (vendedor_id, mes, concepto, monto, autorizado_por) values
    (v_susy, '2026-09-01', 'Bono MercadoLíder Gold (demo)', 1600, v_ger),
    (v_susy, '2026-09-01', 'Tiempo de respuesta < 1 h (demo)', 1000, v_ger),
    (v_susy, '2026-10-01', 'Bono MercadoLíder Gold (demo)', 1600, v_ger);
  perform pg_temp.como('finanzas@hegamex.com');
  insert into public.comision_pagos (vendedor_id, mes, total, detalle, pagado_en, referencia, registrado_por)
  select vendedor_id, '2026-09-01', total, to_jsonb(c), '2026-10-02', 'DEMO SPEI comisiones sep', v_fin
  from public.comisiones_mes('2026-09-01') c where vendedor_id = v_juan;

  -- Fechas reales en el tablero: las ganadas, el día de su pedido; la perdida, el día del rechazo.
  update public.oportunidades o set etapa_desde = p.fecha + time '12:00', cerrada_en = p.fecha + time '12:00'
  from public.cotizaciones c join public.pedidos p on p.cotizacion_id = c.id
  where c.oportunidad_id = o.id and o.etapa = 'ganada' and o.cliente_id in (c_bajio, c_altiplano, c_norte);
  update public.oportunidades set etapa_desde = now() - interval '25 days', cerrada_en = now() - interval '25 days'
  where etapa = 'perdida' and cliente_id = c_sanmiguel;

  perform set_config('request.jwt.claims', '', true);
  raise notice 'Datos DEMO de ventas cargados';
end $$;

commit;

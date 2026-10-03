-- Servicio y mantenimiento "vivos" para ver y fotografiar las pantallas en la base LOCAL.
--
--   psql "$DB_URL" -f scripts/demo/servicio.sql                  crea lo que falte
--   psql "$DB_URL" -v limpiar=1 -f scripts/demo/servicio.sql     cancela servicios y órdenes DEMO
--
-- Necesita los usuarios locales (scripts/usuarios-locales.mjs), el personal de
-- scripts/demo/rrhh_finanzas.sql y los clientes y pedidos de scripts/demo/produccion.sql.
--
-- Todo pasa por las funciones de la base con el usuario que lo haría de verdad
-- (Isaac pide la garantía, el taller reporta la falla, almacén presta y surte, la
-- gerencia programa y cierra): la demostración también prueba los permisos. Luego
-- las fechas se recorren al pasado para que el historial parezca de semanas.
--
-- Se reconoce por las claves DEMO: máquinas "DEMO-…", servicios con referencia
-- "DEMO-SRV-…". Lo que viene del informe del chat: soldadoras numeradas,
-- rectificadores, compresor, torno, roladora, montacargas y conmutador; "hace
-- chispa y ya no jaló", "se quemó el taladro", "se descompuso el conmutador",
-- "las pinzas se las prestó a los ingenieros", la garantía de la bomba de la
-- dosificadora, "me pide otro servicio para engrapar su banda", y el único
-- preventivo documentado (motor a gasolina, enero de 2026).
--
-- Los contactos son puestos con "DEMO" y sin teléfono: un número inventado puede ser
-- de alguien real y en una captura parece dato de verdad.
\set ON_ERROR_STOP on

\if :{?limpiar}
begin;
update public.servicios set estado = 'cancelada', cancelado_en = now(), motivo_cancelacion = 'Limpieza de la demostración'
where referencia like 'DEMO-SRV-%' and estado not in ('cerrada', 'cancelada');
update public.servicio_cuadrilla q set vigente = false from public.servicios s
where s.id = q.servicio_id and s.referencia like 'DEMO-SRV-%' and s.estado = 'cancelada';
update public.ordenes_mantenimiento o set estado = 'cancelada', motivo_cancelacion = 'Limpieza de la demostración',
  fuera_hasta = case when o.fuera_desde is not null then coalesce(o.fuera_hasta, now()) end
from public.maquinas m where m.id = o.maquina_id and m.numero like 'DEMO-%' and o.estado in ('pendiente', 'en_proceso');
update public.resguardos r set devuelto_en = now(), estado_devolucion = 'bien', notas_devolucion = 'Limpieza de la demostración'
from public.maquinas m where m.id = r.maquina_id and m.numero like 'DEMO-%' and r.devuelto_en is null;
update public.maquinas set estado = 'operando' where numero like 'DEMO-%' and estado <> 'baja';
commit;
\echo 'Servicios y mantenimiento DEMO cancelados.'
\quit
\endif

begin;

create or replace function pg_temp.soy(p_correo text) returns uuid language plpgsql as $$
declare v uuid;
begin
  perform set_config('role', 'postgres', true);
  select id into v from public.perfiles where correo = p_correo;
  if v is null then raise exception 'Falta el usuario %: corre node scripts/usuarios-locales.mjs', p_correo; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', v, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  return v;
end $$;

create or replace function pg_temp.postgres() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end $$;

create or replace function pg_temp.emp(p_nombre text) returns uuid language plpgsql as $$
declare v uuid;
begin
  select id into v from public.empleados where nombre = p_nombre and activo;
  if v is null then raise exception 'Falta "%" en el personal: corre scripts/demo/rrhh_finanzas.sql', p_nombre; end if;
  return v;
end $$;

create or replace function pg_temp.cliente(p_nombre text) returns uuid language plpgsql as $$
declare v uuid;
begin
  select id into v from public.clientes where nombre = p_nombre;
  if v is null then raise exception 'Falta el cliente "%": corre scripts/demo/produccion.sql', p_nombre; end if;
  return v;
end $$;

-- Hora de Guadalajara de un día relativo a hoy.
create or replace function pg_temp.a_las(p_dia date, p_hora time) returns timestamptz language sql as $$
  select (p_dia + p_hora) at time zone 'America/Mexico_City'
$$;

do $$
declare
  v_hoy date := (now() at time zone 'America/Mexico_City')::date;
  v_lunes date := date_trunc('week', (now() at time zone 'America/Mexico_City')::date)::date + 7;
  v_pb int; v_s uuid; v_o uuid; v_l uuid; v_ped uuid; v_op uuid; v_m uuid; v_art uuid; v_r uuid; v_e uuid;
begin
  select id into v_pb from public.almacenes where nombre = 'Planta Baja';

  -- ---------------------------------------------------------------------------
  -- Catálogo de máquinas y herramienta (lo da de alta la gerencia).
  -- ---------------------------------------------------------------------------
  perform pg_temp.soy('gerente.produccion@hegamex.com');
  insert into public.maquinas (numero, nombre, tipo, categoria, marca, modelo, etapa_id, ubicacion, critica, prestable, usa_horometro, horas_uso, fecha_alta, notas)
  select v.numero, v.nombre, v.tipo, v.categoria, v.marca, v.modelo, (select id from public.etapas where nombre = v.etapa), v.ubicacion,
         v.critica, v.prestable, v.horometro, v.horas, v.alta::date, v.notas
  from (values
    ('DEMO-SOL-01', 'Soldadora 01', 'maquina', 'soldadora', 'Miller', 'Dimension 452', 'Pailería', 'Nave 1, mesa 1', true, false, false, 0, '2019-03-01', null),
    ('DEMO-SOL-02', 'Soldadora 02', 'maquina', 'soldadora', 'Miller', 'Dimension 452', 'Pailería', 'Nave 1, mesa 2', true, false, false, 0, '2019-03-01', null),
    ('DEMO-SOL-03', 'Soldadora 03', 'maquina', 'soldadora', 'Lincoln', 'Idealarc DC-600', 'Pailería', 'Nave 1, mesa 3', true, false, false, 0, '2020-08-15', null),
    ('DEMO-SOL-04', 'Soldadora 04', 'maquina', 'soldadora', 'Lincoln', 'Power MIG 350MP', 'Pailería', 'Nave 2', false, false, false, 0, '2022-01-10', null),
    ('DEMO-SOL-05', 'Soldadora portátil 05', 'herramienta', 'soldadora', 'Infra', 'Inframig 255', 'Pailería', 'Jaula de herramienta', false, true, false, 0, '2023-05-02', 'La que sale a instalaciones.'),
    ('DEMO-RECT-01', 'Rectificador 01', 'maquina', 'rectificador', 'Infra', 'MM-400', 'Pailería', 'Nave 1', false, false, false, 0, '2018-06-01', null),
    ('DEMO-RECT-02', 'Rectificador 02', 'maquina', 'rectificador', 'Infra', 'MM-400', 'Pailería', 'Nave 2', false, false, false, 0, '2018-06-01', null),
    ('DEMO-COMP-01', 'Compresor de tornillo 25 HP', 'instalacion', 'compresor', 'Atlas Copco', 'GA 18', 'Pintura', 'Cuarto de máquinas', true, false, true, 6120, '2017-02-01', 'Alimenta pintura y herramienta neumática.'),
    ('DEMO-TOR-01', 'Torno paralelo 2 m', 'maquina', 'torno', 'Romi', 'Tormax 30', 'Torno', 'Área de torno', true, false, false, 0, '2016-09-01', 'Dirección pidió poka-yokes (jul-2025).'),
    ('DEMO-ROL-01', 'Roladora de lámina', 'maquina', 'roladora', 'Durma', 'HRB-3 2050', 'Pailería', 'Nave 2', true, false, false, 0, '2018-11-01', 'Dirección pidió poka-yokes (jul-2025).'),
    ('DEMO-MONT-01', 'Montacargas 2.5 t', 'vehiculo', 'montacargas', 'Toyota', '8FGU25', 'Embarque', 'Patio', true, false, true, 1235, '2015-04-01', null),
    ('DEMO-CONM-01', 'Conmutador telefónico', 'instalacion', 'conmutador', 'Grandstream', 'UCM6301', null, 'Oficinas', false, false, false, 0, '2021-07-01', null),
    ('DEMO-TAL-01', 'Taladro magnético', 'herramienta', 'taladro', 'Evolution', 'EVOMAG42', 'Pailería', 'Jaula de herramienta', false, true, false, 0, '2022-03-01', null),
    ('DEMO-TAL-02', 'Taladro de banco', 'maquina', 'taladro', 'Truper', 'TB-16', 'Torno', 'Área de torno', false, false, false, 0, '2019-01-01', null),
    ('DEMO-ESM-01', 'Esmeril angular 4½"', 'herramienta', 'esmeril', 'DeWalt', 'DWE4120', 'Detallado', 'Jaula de herramienta', false, true, false, 0, '2024-02-01', null),
    ('DEMO-ESM-02', 'Esmeril angular 7"', 'herramienta', 'esmeril', 'Makita', 'GA7020', 'Detallado', 'Jaula de herramienta', false, true, false, 0, '2023-09-01', null),
    ('DEMO-MOTO-01', 'Mototool', 'herramienta', 'mototool', 'Dremel', '4000', 'Detallado', 'Jaula de herramienta', false, true, false, 0, '2024-06-01', null),
    ('DEMO-PIN-01', 'Pinzas de presión 10"', 'herramienta', 'pinzas', 'Irwin', 'Vise-Grip 10WR', 'Pailería', 'Jaula de herramienta', false, true, false, 0, '2024-01-15', null),
    ('DEMO-MGAS-01', 'Motor a gasolina 13 HP', 'maquina', 'motor', 'Honda', 'GX390', 'Pruebas', 'Área de pruebas', false, false, true, 410, '2020-10-01', 'Para probar equipos sin toma eléctrica.')
  ) v(numero, nombre, tipo, categoria, marca, modelo, etapa, ubicacion, critica, prestable, horometro, horas, alta, notas)
  on conflict (numero) do nothing;

  -- Dos planes preventivos: el compresor por fecha (ya vencido) y el montacargas por horas (por vencer).
  if not exists (select 1 from public.planes_preventivos p join public.maquinas m on m.id = p.maquina_id where m.numero = 'DEMO-COMP-01') then
    insert into public.planes_preventivos (maquina_id, nombre, tareas, cada_dias, ultima_fecha, ultima_horas, anticipacion_dias)
    select id, 'Cambio de aceite y filtros', 'Aceite, filtro de aceite, filtro de aire, separador y purga del tanque', 90, v_hoy - 97, 5600, 7
    from public.maquinas where numero = 'DEMO-COMP-01';
  end if;
  if not exists (select 1 from public.planes_preventivos p join public.maquinas m on m.id = p.maquina_id where m.numero = 'DEMO-MONT-01') then
    insert into public.planes_preventivos (maquina_id, nombre, tareas, cada_horas, ultima_fecha, ultima_horas, anticipacion_dias)
    select id, 'Servicio de 250 horas', 'Aceite de motor, filtros, revisión de frenos, cadenas y horquillas', 250, v_hoy - 70, 1000, 7
    from public.maquinas where numero = 'DEMO-MONT-01';
  end if;
  perform public.generar_preventivos();

  -- El único preventivo documentado (enero de 2026), como historia.
  perform pg_temp.postgres();
  if not exists (select 1 from public.ordenes_mantenimiento o join public.maquinas m on m.id = o.maquina_id
                 where m.numero = 'DEMO-MGAS-01' and o.tipo = 'preventivo') then
    insert into public.ordenes_mantenimiento (maquina_id, tipo, estado, falla, reportado_por, reportado_por_nombre, reportado_en,
      diagnostico, atendido_por, trabajo_realizado, inicio_en, cerrada_en, fuera_desde, fuera_hasta, horas_uso_al_cerrar)
    select id, 'preventivo', 'cerrada', 'Servicio preventivo del motor a gasolina', null, 'Gerencia de producción',
      timestamptz '2026-01-14 09:00-06', 'Aceite oscuro, bujía con carbón', 'Pedro Salinas',
      'Cambio de aceite, bujía y filtro de aire. Se limpió el carburador.',
      timestamptz '2026-01-14 09:30-06', timestamptz '2026-01-14 12:00-06', timestamptz '2026-01-14 09:30-06', timestamptz '2026-01-14 12:00-06', 395
    from public.maquinas where numero = 'DEMO-MGAS-01' returning id into v_o;
    delete from public.avisos where tabla = 'ordenes_mantenimiento' and registro_id = v_o::text;
  end if;

  -- ---------------------------------------------------------------------------
  -- Fallas: las reporta el taller (desde la terminal, con nombre de piso).
  -- ---------------------------------------------------------------------------
  -- Cerradas, con su costo: rectificador y conmutador.
  select id into v_m from public.maquinas where numero = 'DEMO-RECT-01';
  if not exists (select 1 from public.ordenes_mantenimiento where maquina_id = v_m and estado <> 'cancelada') then
    perform pg_temp.soy('taller@hegamex.com');
    v_o := public.reportar_falla(v_m, 'No da amperaje, el arco se corta', true, null, 'Ricardo Pérez');
    perform pg_temp.soy('gerente.produccion@hegamex.com');
    perform public.atender_mantenimiento(v_o, 'Puente rectificador dañado', 'Taller externo (Electromecánica Atotonilco)');
    insert into public.costos_servicio (mantenimiento_id, concepto, descripcion, monto)
    values (v_o, 'servicio_externo', 'Cambio de puente rectificador en taller externo', 2800);
    perform public.cerrar_mantenimiento(v_o, 'Se cambió el puente rectificador y se probó a 300 A');
    perform pg_temp.postgres();
    update public.ordenes_mantenimiento set reportado_en = now() - interval '40 days', fuera_desde = now() - interval '40 days',
      inicio_en = now() - interval '39 days', cerrada_en = now() - interval '37 days', fuera_hasta = now() - interval '37 days' where id = v_o;
    update public.costos_servicio set en = now() - interval '37 days' where mantenimiento_id = v_o;
  end if;

  select id into v_m from public.maquinas where numero = 'DEMO-CONM-01';
  if not exists (select 1 from public.ordenes_mantenimiento where maquina_id = v_m and estado <> 'cancelada') then
    perform pg_temp.soy('almacen@hegamex.com');
    v_o := public.reportar_falla(v_m, 'Se descompuso el conmutador, no entran llamadas', true, null, null);
    perform pg_temp.soy('gerente.produccion@hegamex.com');
    perform public.atender_mantenimiento(v_o, 'Fuente de poder quemada por una variación', 'Proveedor de telefonía');
    insert into public.costos_servicio (mantenimiento_id, concepto, descripcion, monto)
    values (v_o, 'servicio_externo', 'Fuente de poder y visita del técnico', 1500);
    perform public.cerrar_mantenimiento(v_o, 'Se cambió la fuente y se conectó a un regulador');
    perform pg_temp.postgres();
    update public.ordenes_mantenimiento set reportado_en = now() - interval '61 days', fuera_desde = now() - interval '61 days',
      inicio_en = now() - interval '60 days', cerrada_en = now() - interval '59 days', fuera_hasta = now() - interval '59 days' where id = v_o;
    update public.costos_servicio set en = now() - interval '59 days' where mantenimiento_id = v_o;
  end if;

  -- Abiertas: la soldadora 03 parada y en reparación (con refacción de almacén), el taladro
  -- magnético quemado y la roladora que hace ruido pero todavía trabaja.
  select id into v_m from public.maquinas where numero = 'DEMO-SOL-03';
  if not exists (select 1 from public.ordenes_mantenimiento where maquina_id = v_m and estado <> 'cancelada') then
    perform pg_temp.soy('taller@hegamex.com');
    v_o := public.reportar_falla(v_m, 'La soldadora hace chispa y ya no jaló', true, null, 'Martín Hernández');
    perform pg_temp.soy('gerente.produccion@hegamex.com');
    perform public.atender_mantenimiento(v_o, 'Cable de tierra quemado y pinza floja', 'José Luis Ramírez');
    select id into v_art from public.articulos where clave = 'C-N1036';
    if v_art is not null then
      v_l := public.agregar_material_servicio(v_art, 5, null, v_o, 'Para rehacer el cable de tierra');
      -- Sale del almacén de planta donde hay más.
      perform pg_temp.postgres();
      select x.almacen_id into v_pb from public.existencias x join public.almacenes al on al.id = x.almacen_id
      where x.articulo_id = v_art and al.disponible_para_planta and x.cantidad >= 5 order by x.cantidad desc limit 1;
      perform pg_temp.soy('almacen@hegamex.com');
      if v_pb is not null then perform public.surtir_material_servicio(v_l, v_pb); end if;
    end if;
    perform pg_temp.postgres();
    update public.ordenes_mantenimiento set reportado_en = now() - interval '2 days 3 hours', fuera_desde = now() - interval '2 days 3 hours',
      inicio_en = now() - interval '1 day 6 hours' where id = v_o;
  end if;

  select id into v_m from public.maquinas where numero = 'DEMO-TAL-01';
  if not exists (select 1 from public.ordenes_mantenimiento where maquina_id = v_m and estado <> 'cancelada') then
    perform pg_temp.soy('taller@hegamex.com');
    v_o := public.reportar_falla(v_m, 'Se quemó el taladro, huele a quemado y no gira', true, null, 'Daniel Ruiz');
    perform pg_temp.postgres();
    update public.ordenes_mantenimiento set reportado_en = now() - interval '20 hours', fuera_desde = now() - interval '20 hours' where id = v_o;
  end if;

  select id into v_m from public.maquinas where numero = 'DEMO-ROL-01';
  if not exists (select 1 from public.ordenes_mantenimiento where maquina_id = v_m and estado <> 'cancelada') then
    perform pg_temp.soy('taller@hegamex.com');
    v_o := public.reportar_falla(v_m, 'Hace ruido al rolar lámina de 3/16; todavía rola', false, null, 'José Luis Ramírez');
    perform pg_temp.postgres();
    update public.ordenes_mantenimiento set reportado_en = now() - interval '3 hours' where id = v_o;
  end if;

  -- ---------------------------------------------------------------------------
  -- Servicios
  -- ---------------------------------------------------------------------------
  -- 1. En curso: instalación de una bazuca rompesacos (la cuadrilla salió hace dos días).
  if not exists (select 1 from public.servicios where referencia = 'DEMO-SRV-6' and estado <> 'cancelada') then
    perform pg_temp.soy('isaac@hegamex.com');
    v_s := public.solicitar_servicio('instalacion', pg_temp.cliente('DEMO Molinos Tepa'),
      'Instalación de la bazuca rompesacos en la bodega nueva y arranque con el operador',
      p_lugar => 'Tepatitlán, Jal.', p_contacto_nombre => 'DEMO Jefe de bodega',
      p_referencia => 'DEMO-SRV-6', p_fecha_deseada => v_hoy - 2);
    perform pg_temp.soy('gerente.produccion@hegamex.com');
    perform public.programar_servicio(v_s, pg_temp.a_las(v_hoy - 2, '07:00'), pg_temp.a_las(v_hoy + 2, '17:30'),
      array[pg_temp.emp('Francisco Javier Gutiérrez Luna'), pg_temp.emp('Luis Ángel Torres Velázquez'), pg_temp.emp('Sergio Navarro Ibarra')],
      pg_temp.emp('Francisco Javier Gutiérrez Luna'));
    insert into public.costos_servicio (servicio_id, concepto, descripcion, monto) values
      (v_s, 'viaticos', 'Hospedaje 4 noches × 3 personas', 6000), (v_s, 'viaticos', 'Comidas', 3600), (v_s, 'viaticos', 'Gasolina y casetas', 1450);
    perform pg_temp.soy('taller@hegamex.com');
    perform public.iniciar_servicio(v_s);
    perform pg_temp.postgres();
    update public.servicios set solicitado_en = now() - interval '9 days', programado_en = now() - interval '6 days',
      iniciado_en = pg_temp.a_las(v_hoy - 2, '07:10') where id = v_s;
  end if;

  -- 2. Programada la semana que entra: instalación de una banda cargadora (3 días, 3 personas).
  if not exists (select 1 from public.servicios where referencia = 'DEMO-SRV-1' and estado <> 'cancelada') then
    select id into v_ped from public.pedidos where folio = 'DEMO-792';
    perform pg_temp.soy('isaac@hegamex.com');
    v_s := public.solicitar_servicio('instalacion', pg_temp.cliente('DEMO Alimentos La Huerta'),
      'Instalación de la banda cargadora de 18" × 6.60 m con levante electrónico; conectar al tablero del cliente',
      p_pedido => v_ped, p_lugar => 'Arandas, Jal.', p_contacto_nombre => 'DEMO Jefe de planta',
      p_referencia => 'DEMO-SRV-1', p_fecha_deseada => v_lunes);
    perform pg_temp.soy('gerente.produccion@hegamex.com');
    perform public.programar_servicio(v_s, pg_temp.a_las(v_lunes, '08:30'), pg_temp.a_las(v_lunes + 2, '17:30'),
      array[pg_temp.emp('José Luis Ramírez Ortega'), pg_temp.emp('Martín Hernández Gómez'), pg_temp.emp('Arturo Domínguez Campos')],
      pg_temp.emp('José Luis Ramírez Ortega'));
    insert into public.costos_servicio (servicio_id, concepto, descripcion, monto) values
      (v_s, 'viaticos', 'Hospedaje 2 noches × 3 personas', 3600), (v_s, 'viaticos', 'Comidas', 2700), (v_s, 'viaticos', 'Gasolina y casetas', 950);
    select id into v_art from public.articulos where clave = 'C-00003';
    if v_art is not null then perform public.agregar_material_servicio(v_art, 25, v_s, null, 'Alimentación del motor al tablero'); end if;
    perform pg_temp.postgres();
    update public.servicios set solicitado_en = now() - interval '5 days', programado_en = now() - interval '3 days' where id = v_s;
  end if;

  -- 3. Programada: puesta en marcha de la dosificadora ZEUS 30 (jueves y viernes).
  if not exists (select 1 from public.servicios where referencia = 'DEMO-SRV-2' and estado <> 'cancelada') then
    select id into v_op from public.ordenes_produccion where folio = 'OP-2026-00001' and numero_serie like 'DEMO-%';
    perform pg_temp.soy('isaac@hegamex.com');
    v_s := public.solicitar_servicio('puesta_en_marcha', pg_temp.cliente('DEMO Concretos Atotonilco'),
      'Puesta en marcha de la dosificadora y capacitación al operador de la báscula',
      p_orden_produccion => v_op, p_lugar => 'Atotonilco el Alto, Jal.', p_contacto_nombre => 'DEMO Supervisora de calidad',
      p_referencia => 'DEMO-SRV-2', p_fecha_deseada => v_lunes + 3);
    perform pg_temp.soy('gerente.produccion@hegamex.com');
    perform public.programar_servicio(v_s, pg_temp.a_las(v_lunes + 3, '08:30'), pg_temp.a_las(v_lunes + 4, '13:30'),
      array[pg_temp.emp('Arturo Domínguez Campos'), pg_temp.emp('Óscar Jiménez Salazar')], pg_temp.emp('Arturo Domínguez Campos'));
    perform pg_temp.postgres();
    update public.servicios set solicitado_en = now() - interval '3 days', programado_en = now() - interval '1 day' where id = v_s;
  end if;

  -- 4. Programada: reparación en planta de una cosedora (llega el martes; se recibe con fotos).
  if not exists (select 1 from public.servicios where referencia = 'DEMO-SRV-4' and estado <> 'cancelada') then
    perform pg_temp.soy('isaac@hegamex.com');
    v_s := public.solicitar_servicio('reparacion_planta', pg_temp.cliente('DEMO Agrícola El Salto'),
      'La cosedora de costales ya no cose: se brinca puntadas y se atora el hilo. La traen el martes.',
      p_equipo => 'Cosedora de costales portátil', p_numero_serie => 'GK9-2 (sin número Hegamex)',
      p_contacto_nombre => 'DEMO Encargado de envasado', p_referencia => 'DEMO-SRV-4', p_fecha_deseada => v_lunes + 1);
    perform pg_temp.soy('gerente.produccion@hegamex.com');
    perform public.programar_servicio(v_s, pg_temp.a_las(v_lunes + 1, '09:00'), pg_temp.a_las(v_lunes + 1, '15:00'),
      array[pg_temp.emp('Alejandro Castillo Reyes')]);
    perform pg_temp.postgres();
    update public.servicios set solicitado_en = now() - interval '2 days', programado_en = now() - interval '1 day' where id = v_s;
  end if;

  -- 5. Programada en dos semanas: "me pide otro servicio para engrapar su banda".
  if not exists (select 1 from public.servicios where referencia = 'DEMO-SRV-5' and estado <> 'cancelada') then
    perform pg_temp.soy('juan@hegamex.com');
    v_s := public.solicitar_servicio('servicio_campo', pg_temp.cliente('DEMO Minera Santa Cruz'),
      'Me pide otro servicio para engrapar su banda: se abrió el empalme de la banda principal',
      p_lugar => 'Fresnillo, Zac.', p_contacto_nombre => 'DEMO Jefe de mantenimiento',
      p_referencia => 'DEMO-SRV-5', p_prioridad => 1);
    perform pg_temp.soy('gerente.produccion@hegamex.com');
    perform public.programar_servicio(v_s, pg_temp.a_las(v_lunes + 8, '06:00'), pg_temp.a_las(v_lunes + 9, '18:00'),
      array[pg_temp.emp('Ricardo Pérez Navarro'), pg_temp.emp('Martín Hernández Gómez')], pg_temp.emp('Ricardo Pérez Navarro'));
    perform pg_temp.postgres();
    update public.servicios set solicitado_en = now() - interval '1 day', programado_en = now() - interval '4 hours' where id = v_s;
  end if;

  -- 6. Solicitada hace 4 días y sin fecha: la garantía de la bomba de la dosificadora.
  --    Se liga al número de serie que se le entregó hace 4 meses.
  perform pg_temp.postgres();
  if not exists (select 1 from public.pedidos where folio = 'DEMO-801') then
    insert into public.pedidos (folio, cliente_id, vendedor_id, fecha, fecha_compromiso, estado, entregado_en, notas)
    select 'DEMO-801', c.id, c.vendedor_id, v_hoy - 160, v_hoy - 130, 'entregado', now() - interval '128 days', 'DEMO servicio: equipo entregado'
    from public.clientes c where c.nombre = 'DEMO Alimentos La Huerta' returning id into v_ped;
    insert into public.pedido_lineas (pedido_id, articulo_id, titulo, cantidad, precio_unitario)
    select v_ped, o.articulo_id, 'Dosificadora ZEUS 30 con 2 tolvas', 1, 485000 from public.ordenes_produccion o where o.folio = 'OP-2026-00001';
    insert into public.ordenes_produccion (articulo_id, pedido_id, numero_serie, estado, terminada_en, entregada_en, notas)
    select o.articulo_id, v_ped, 'DEMO-DZ30-0412', 'entregada', now() - interval '135 days', now() - interval '128 days', 'DEMO servicio: equipo entregado'
    from public.ordenes_produccion o where o.folio = 'OP-2026-00001' returning id into v_op;
    -- Es historia: que no les llegue a ingeniería y almacén como pedido u orden nueva.
    delete from public.avisos where (tabla = 'pedidos' and registro_id = v_ped::text) or (tabla = 'ordenes_produccion' and registro_id = v_op::text);
  end if;
  if not exists (select 1 from public.servicios where referencia = 'DEMO-SRV-3' and estado <> 'cancelada') then
    select id into v_op from public.ordenes_produccion where numero_serie = 'DEMO-DZ30-0412';
    perform pg_temp.soy('isaac@hegamex.com');
    v_s := public.solicitar_servicio('garantia', pg_temp.cliente('DEMO Alimentos La Huerta'),
      'Me pide garantía de la bomba de la dosificadora: no levanta presión y el pistón baja solo',
      p_orden_produccion => v_op, p_lugar => 'Arandas, Jal.', p_contacto_nombre => 'DEMO Jefe de planta',
      p_referencia => 'DEMO-SRV-3');
    perform pg_temp.postgres();
    update public.servicios set solicitado_en = now() - interval '4 days' where id = v_s;
  end if;

  -- ---------------------------------------------------------------------------
  -- Resguardos: las pinzas que se llevaron los ingenieros, el esmeril y la soldadora
  -- portátil que van a la instalación, y uno ya devuelto. (Almacén no lee la tabla de
  -- personal, que es de RRHH: el id de cada persona se busca antes, como postgres.)
  -- ---------------------------------------------------------------------------
  select id into v_m from public.maquinas where numero = 'DEMO-PIN-01';
  if not exists (select 1 from public.resguardos where maquina_id = v_m) then
    perform pg_temp.soy('almacen@hegamex.com');
    v_r := public.prestar_herramienta(v_m, null, 'Ingeniería (Miguel Ortiz)', null, null, 'Para medir en la línea de pruebas');
    perform pg_temp.postgres();
    update public.resguardos set entregado_en = now() - interval '21 days' where id = v_r;
  end if;
  select id into v_m from public.maquinas where numero = 'DEMO-ESM-01';
  if not exists (select 1 from public.resguardos where maquina_id = v_m) then
    v_e := pg_temp.emp('Luis Ángel Torres Velázquez');
    perform pg_temp.soy('almacen@hegamex.com');
    v_r := public.prestar_herramienta(v_m, v_e, null, v_hoy + 3,
      (select id from public.servicios where referencia = 'DEMO-SRV-6' and estado <> 'cancelada'), 'Va a la instalación de Tepatitlán');
    perform pg_temp.postgres();
    update public.resguardos set entregado_en = now() - interval '2 days 2 hours' where id = v_r;
  end if;
  select id into v_m from public.maquinas where numero = 'DEMO-SOL-05';
  if not exists (select 1 from public.resguardos where maquina_id = v_m) then
    v_e := pg_temp.emp('Francisco Javier Gutiérrez Luna');
    perform pg_temp.soy('almacen@hegamex.com');
    v_r := public.prestar_herramienta(v_m, v_e, null, v_hoy + 3,
      (select id from public.servicios where referencia = 'DEMO-SRV-6' and estado <> 'cancelada'), 'Con careta y 20 kg de soldadura');
    perform pg_temp.postgres();
    update public.resguardos set entregado_en = now() - interval '2 days 2 hours' where id = v_r;
  end if;
  select id into v_m from public.maquinas where numero = 'DEMO-ESM-02';
  if not exists (select 1 from public.resguardos where maquina_id = v_m) then
    v_e := pg_temp.emp('Ricardo Pérez Navarro');
    perform pg_temp.soy('almacen@hegamex.com');
    v_r := public.prestar_herramienta(v_m, v_e, null, null, null, null);
    perform public.devolver_herramienta(v_r, 'bien', null);
    perform pg_temp.postgres();
    update public.resguardos set entregado_en = now() - interval '9 days', devuelto_en = now() - interval '5 days' where id = v_r;
  end if;
  perform pg_temp.postgres();
end $$;

commit;

\echo 'Servicio y mantenimiento DEMO listos:'
select m.numero, m.nombre, m.estado from public.maquinas m where m.numero like 'DEMO-%' and m.estado <> 'operando' order by 1;
select folio, tipo, estado, referencia from public.servicios where referencia like 'DEMO-SRV-%' and estado <> 'cancelada' order by referencia;

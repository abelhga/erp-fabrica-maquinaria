-- =============================================================================
-- Quita TODOS los datos de demostración y deja lo real como quedó al terminar la
-- importación de las hojas. Es para el día en que el ERP empieza a usarse en serio.
--
-- Por qué no basta con borrar lo que dice "DEMO": las demostraciones (scripts/demo/*)
-- trabajaron con las funciones de la app sobre datos reales. Dieron salidas de
-- almacén de artículos reales (producción, envíos, servicio), apartaron material
-- real para órdenes, pidieron faltantes, cerraron el costeo de un embarque que
-- cambió el costo de tres cosedoras y el precio de los equipos que las llevan,
-- midieron empaques de seis refacciones, pusieron teléfonos inventados a tres
-- vendedores y una regla de familia que reclasificó ventas del libro. Todo eso se
-- deshace aquí con las mismas reglas de la base (recalcular_costos,
-- reclasificar_ventas) para que costos, precios y existencias cuadren solos.
--
-- Cómo se corre (es UNA transacción: si algo no cuadra, no queda nada a medias):
--   psql "$DB_URL" -v ON_ERROR_STOP=1 -f scripts/demo/limpiar_todo.sql
--   NUBE_REF=<ref> python3 scripts/nube/sql_nube.py scripts/demo/limpiar_todo.sql
-- No lleva metacomandos de psql para que también entre como un solo texto por la
-- API de SQL. La última consulta (ya confirmada la transacción) es el resumen.
-- Correrlo dos veces no hace daño: la segunda vez no encuentra nada que quitar.
-- Mejor sin gente usando el sistema: mientras borra apaga los disparadores (los
-- "inalterables" no dejarían borrar movimientos ni evidencia, y la bitácora
-- anotaría cada borrado como si alguien lo hubiera hecho).
--
-- Qué es real y se queda:
--   · lo que crean las migraciones (configuración, almacenes, permisos, etapas,
--     catálogos geográficos, políticas, plantillas de objetivos, puestos…);
--   · lo que carga scripts/importar.ts: artículos LC:/EQ:/FALTA:, proveedores PROV:,
--     clientes CLI: y sus contactos, listas de materiales, costos y su historial,
--     pedidos HIS-, libros históricos, existencias de arranque (movimientos
--     "inicial" sin usuario) y los apartados de la hoja; el registro en importaciones;
--   · los planos de Drive (precargar-planos.mjs, entran con la sesión de
--     ingeniería: por eso aquí NO se borra "lo que creó ingeniería@", solo los
--     documentos de artículos o pedidos de la demostración) y las sugerencias de
--     subensambles;
--   · las cuentas (auth.users, perfiles, roles, invitaciones): las 15 de prueba
--     las borra el dueño después;
--   · las correcciones de ubicación de clientes (geo_alias_ciudad): son ciertas y
--     clientes reales ya dependen de ellas;
--   · asistente_uso: es el registro de gasto de la API.
-- Qué es demostración y se va: lo marcado (clientes "DEMO …", artículos DEMO-…,
-- proveedores DEMO-PROV-/demo-rf-, máquinas DEMO-…, empleados demo-rf, notas DEMO…),
-- todo lo que crearon las 15 cuentas de prueba de scripts/usuarios-locales.mjs y
-- todo lo que cuelga de eso. Los borradores vacíos que dejan los recorridos
-- automáticos los crea una cuenta de prueba, así que entran en la misma regla.
--
-- Protección: nada que haya creado una persona que NO sea una de esas 15 cuentas
-- se borra (se reconoce por la columna de quién lo creó o por el "alta" en la
-- bitácora). Si algo real depende de algo de la demostración, se detiene y dice qué.
--
-- Archivos de Storage: no se borran aquí. Borrar storage.objects por SQL deja el
-- archivo en el almacenamiento sin registro; al final se listan los que quedaron
-- sin dueño para borrarlos con la API de Storage (o desde el panel de Supabase).
-- =============================================================================
begin;

set local search_path = public;
set local statement_timeout = '15min';
-- Si alguien tiene una tabla tomada, mejor fallar y reintentar que quedarse colgado.
set local lock_timeout = '30s';

-- -----------------------------------------------------------------------------
-- 0. Quién es de prueba y quién no
-- -----------------------------------------------------------------------------
create temp table _usr_demo on commit drop as
select id, correo from perfiles
where lower(correo) = any (array['direccion@hegamex.com', 'isaac@hegamex.com', 'juan@hegamex.com', 'susana@hegamex.com',
  'gerente.ventas@hegamex.com', 'ingenieria@hegamex.com', 'compras@hegamex.com', 'almacen@hegamex.com',
  'gerente.produccion@hegamex.com', 'taller@hegamex.com', 'rrhh@hegamex.com', 'finanzas@hegamex.com',
  'sistemas@hegamex.com', 'tv@hegamex.com', 'importaciones@hegamex.com']);
create temp table _usr_real on commit drop as
select id, correo from perfiles where id not in (select id from _usr_demo);

-- Quién dio de alta cada registro, según la bitácora (para tablas sin columna de
-- creador, como proveedores, máquinas o empleados).
create temp table _alta on commit drop as
select distinct b.tabla, b.registro_id,
       case when b.usuario_id in (select id from _usr_real) then 'real' else 'demo' end quien
from bitacora b
where b.accion = 'alta' and b.usuario_id is not null
  and (b.usuario_id in (select id from _usr_real) or b.usuario_id in (select id from _usr_demo));
create index on _alta (tabla, registro_id);

create or replace function pg_temp.de_real(p_tabla text, p_id text, p_creador uuid default null) returns boolean
language sql stable as $$
  select (p_creador is not null and p_creador in (select id from _usr_real))
      or exists (select 1 from _alta a where a.tabla = p_tabla and a.registro_id = p_id and a.quien = 'real')
$$;
create or replace function pg_temp.de_demo(p_tabla text, p_id text, p_creador uuid default null) returns boolean
language sql stable as $$
  select (p_creador is not null and p_creador in (select id from _usr_demo))
      or exists (select 1 from _alta a where a.tabla = p_tabla and a.registro_id = p_id and a.quien = 'demo')
$$;

-- El mismo identificador que escribe auditar() en la bitácora (y avisar() casi
-- siempre): sirve para saber de qué registros hablan bitácora y avisos.
create or replace function pg_temp.reg_id(j jsonb) returns text language sql immutable as $$
  select coalesce(j->>'id', j->>'clave',
    case when j ? 'usuario_id' and j ? 'rol' then concat_ws(':', j->>'usuario_id', j->>'rol') end,
    case when j ? 'rol' and j ? 'modulo' then concat_ws(':', j->>'rol', j->>'modulo') end,
    case when j ? 'fecha' and j ? 'moneda' then concat_ws(':', j->>'fecha', j->>'moneda') end,
    j->>'empleado_id', j->>'articulo_id', j->>'etapa_id', j->>'canal', j->>'meses', j->>'correo',
    md5(j::text))
$$;

-- -----------------------------------------------------------------------------
-- 1. Foto de antes: conteos, medidas de lo real y qué registros existían
-- -----------------------------------------------------------------------------
drop table if exists pg_temp._resumen;
create temp table _resumen (seccion text, detalle text, antes bigint, despues bigint);

create temp table _conteo (tabla text primary key, antes bigint, despues bigint) on commit drop;
do $$
declare t text; n bigint;
begin
  for t in select c.relname from pg_class c join pg_namespace s on s.oid = c.relnamespace
           where s.nspname = 'public' and c.relkind in ('r', 'p') order by 1 loop
    execute format('select count(*) from public.%I', t) into n;
    insert into _conteo (tabla, antes) values (t, n);
  end loop;
end $$;

-- Lo real medido con definiciones que NO dependen de las reglas de esta limpieza
-- (legacy de la importación, folios HIS-, existencias sin usuario…): si una regla
-- de abajo se equivocara y tocara algo real, estas cifras no cuadrarían al final.
create or replace function pg_temp.medidas() returns table (clave text, valor numeric) language sql stable as $$
  select 'articulos de la importacion', count(*)::numeric from articulos where legacy_id ~ '^(LC|EQ|FALTA):'
  union all select 'proveedores de la importacion', count(*) from proveedores where legacy_id like 'PROV:%'
  union all select 'clientes de la importacion', count(*) from clientes where legacy_ref like 'CLI:%'
  union all select 'contactos de clientes importados', count(*) from contactos k join clientes c on c.id = k.cliente_id where c.legacy_ref like 'CLI:%'
  union all select 'pedidos HIS', count(*) from pedidos where folio like 'HIS-%' and historico
  union all select 'pedidos HIS: total', coalesce(sum(total), 0) from pedidos where folio like 'HIS-%' and historico
  union all select 'pedidos HIS: partidas', count(*) from pedido_lineas l join pedidos p on p.id = l.pedido_id where p.folio like 'HIS-%' and p.historico
  union all select 'historial_ventas_hoja', count(*) from historial_ventas_hoja
  union all select 'historial_ventas_hoja: monto', coalesce(sum(monto), 0) from historial_ventas_hoja
  union all select 'historial_ventas_hoja: con cliente', count(cliente_id) from historial_ventas_hoja
  union all select 'historial_movimientos_hoja', count(*) from historial_movimientos_hoja
  union all select 'historial_movimientos_hoja: con articulo', count(articulo_id) from historial_movimientos_hoja
  union all select 'existencia de arranque: movimientos', count(*) from movimientos_inventario m join articulos a on a.id = m.articulo_id
            where m.tipo = 'inicial' and m.usuario_id is null and a.legacy_id ~ '^(LC|EQ|FALTA):'
  union all select 'existencia de arranque: piezas', coalesce(sum(m.cantidad), 0) from movimientos_inventario m join articulos a on a.id = m.articulo_id
            where m.tipo = 'inicial' and m.usuario_id is null and a.legacy_id ~ '^(LC|EQ|FALTA):'
  union all select 'apartados de la hoja', count(*) from reservas where motivo like 'Apartado en la hoja%' and creado_por is null
  union all select 'apartados de la hoja: piezas', coalesce(sum(cantidad), 0) from reservas where motivo like 'Apartado en la hoja%' and creado_por is null
  union all select 'apartados de la hoja: surtido', coalesce(sum(surtido), 0) from reservas where motivo like 'Apartado en la hoja%' and creado_por is null
  union all select 'listas de materiales importadas', count(*) from bom_lineas b join articulos a on a.id = b.padre_id where a.legacy_id ~ '^(LC|EQ|FALTA):'
  union all select 'listas de materiales importadas: cantidad', coalesce(sum(b.cantidad), 0) from bom_lineas b join articulos a on a.id = b.padre_id where a.legacy_id ~ '^(LC|EQ|FALTA):'
  union all select 'horas por etapa importadas', count(*) from bom_operaciones o join articulos a on a.id = o.articulo_id where a.legacy_id ~ '^(LC|EQ|FALTA):'
  union all select 'costos de articulos importados', count(*) from costos_articulo c join articulos a on a.id = c.articulo_id where a.legacy_id ~ '^(LC|EQ|FALTA):'
  union all select 'historial de costos de la importacion', count(*) from historial_costos h join articulos a on a.id = h.articulo_id
            where h.origen = 'importacion' and h.usuario_id is null and a.legacy_id ~ '^(LC|EQ|FALTA):'
  union all select 'costeo mensual reconstruido', count(*) from historial_costeo h join articulos a on a.id = h.articulo_id
            where h.reconstruido and a.legacy_id ~ '^(LC|EQ|FALTA):'
  union all select 'planos de articulos importados', count(*) from documentos_tecnicos d join articulos a on a.id = d.articulo_id where a.legacy_id ~ '^(LC|EQ|FALTA):'
  union all select 'categorias', count(*) from categorias
  union all select 'tarifas de mano de obra', coalesce(sum(costo_hora), 0) from tarifas_mano_obra
  union all select 'sugerencias de subensamble', count(*) from sugerencias_subensamble
  union all select 'registro de importaciones', count(*) from importaciones
  union all select 'tipos de cambio que no son demo', count(*) from tipos_cambio where fuente is distinct from 'demo'
  union all select 'cuentas (auth.users)', count(*) from auth.users
  union all select 'perfiles', count(*) from perfiles
  union all select 'roles de usuario', count(*) from usuario_roles
  union all select 'invitaciones', count(*) from invitaciones
  union all select 'uso del asistente', count(*) from asistente_uso
  union all select 'correcciones de ubicacion', count(*) from geo_alias_ciudad
  union all select 'bitacora sin sesion hasta la importacion', count(*) from bitacora
            where usuario_id is null and en <= coalesce((select max(en) from importaciones), '-infinity')
  union all select 'plantillas de objetivos generales', count(*) from objetivo_plantillas where empleado_id is null
$$;
create temp table _medidas on commit drop as select clave, valor antes, null::numeric despues from pg_temp.medidas();

-- Cuántas filas creó cada persona real, por cada columna "creado por" (las que
-- llenan auth.uid() solas). Al final tienen que seguir todas.
create temp table _creado_real (tabla text, columna text, antes bigint, despues bigint) on commit drop;
do $$
declare r record; n bigint;
begin
  for r in select c.table_name t, c.column_name col from information_schema.columns c
           join information_schema.tables x on x.table_schema = c.table_schema and x.table_name = c.table_name and x.table_type = 'BASE TABLE'
           where c.table_schema = 'public' and c.column_default like '%auth.uid()%'
             and c.table_name not in ('bitacora', 'asistente_uso', 'asistente_resumenes') loop
    execute format('select count(*) from public.%I where %I in (select id from _usr_real)', r.t, r.col) into n;
    insert into _creado_real values (r.t, r.col, n, null);
  end loop;
end $$;

-- -----------------------------------------------------------------------------
-- 2. Qué es de la demostración: un conjunto de ids por tabla
-- -----------------------------------------------------------------------------
-- Se arma de padres a hijos: lo que cuelga de algo DEMO también lo es, salvo que
-- lo haya creado una persona real (y entonces el paso 3 se detiene).
create temp table _d (tabla text not null, id text not null, primary key (tabla, id)) on commit drop;

-- Catálogos y personas de la demostración.
insert into _d select 'clientes', c.id::text from clientes c
where coalesce(c.legacy_ref, '') !~ '^CLI:'
  and (c.nombre like 'DEMO %' or c.legacy_ref like 'demo-rf-%' or pg_temp.de_demo('clientes', c.id::text, c.creado_por))
  and not pg_temp.de_real('clientes', c.id::text, c.creado_por);

insert into _d select 'proveedores', p.id::text from proveedores p
where coalesce(p.legacy_id, '') !~ '^PROV:'
  and (p.legacy_id like 'DEMO-PROV-%' or p.legacy_id like 'demo-rf-%' or p.nombre like 'DEMO %' or pg_temp.de_demo('proveedores', p.id::text))
  and not pg_temp.de_real('proveedores', p.id::text);

insert into _d select 'articulos', a.id::text from articulos a
where coalesce(a.legacy_id, '') !~ '^(LC|EQ|FALTA):'
  and (a.clave like 'DEMO-%' or pg_temp.de_demo('articulos', a.id::text))
  and not pg_temp.de_real('articulos', a.id::text);

insert into _d select 'maquinas', m.id::text from maquinas m
where (m.numero like 'DEMO-%' or pg_temp.de_demo('maquinas', m.id::text))
  and not pg_temp.de_real('maquinas', m.id::text);

-- El personal de rrhh_finanzas.sql tiene ids fijos (md5 de 'demo-rf:emp:<número>').
insert into _d select 'empleados', e.id::text from empleados e
where (e.id = md5('demo-rf:emp:' || e.numero)::uuid or pg_temp.de_demo('empleados', e.id::text))
  and not pg_temp.de_real('empleados', e.id::text);

-- Ventas.
insert into _d select 'cotizaciones', c.id::text from cotizaciones c
where (pg_temp.de_demo('cotizaciones', c.id::text, c.vendedor_id) or c.cliente_id::text in (select id from _d where tabla = 'clientes'))
  and not pg_temp.de_real('cotizaciones', c.id::text, c.vendedor_id);
-- Las versiones de una cotización DEMO también lo son.
insert into _d select 'cotizaciones', c.id::text from cotizaciones c
where c.origen_id::text in (select id from _d where tabla = 'cotizaciones') and not pg_temp.de_real('cotizaciones', c.id::text, c.vendedor_id)
on conflict do nothing;

insert into _d select 'pedidos', p.id::text from pedidos p
where not (p.historico and p.folio like 'HIS-%')
  and (pg_temp.de_demo('pedidos', p.id::text, p.creado_por)
       or p.cliente_id::text in (select id from _d where tabla = 'clientes')
       or p.cotizacion_id::text in (select id from _d where tabla = 'cotizaciones'))
  and not pg_temp.de_real('pedidos', p.id::text, p.creado_por);

insert into _d select 'oportunidades', o.id::text from oportunidades o
where (o.cliente_id::text in (select id from _d where tabla = 'clientes') or o.vendedor_id in (select id from _usr_demo))
  and not pg_temp.de_real('oportunidades', o.id::text, o.vendedor_id);

insert into _d select 'actividades', a.id::text from actividades a
where (a.cliente_id::text in (select id from _d where tabla = 'clientes')
       or a.oportunidad_id::text in (select id from _d where tabla = 'oportunidades')
       or a.usuario_id in (select id from _usr_demo))
  and not pg_temp.de_real('actividades', a.id::text, a.usuario_id);

insert into _d select 'solicitudes_precio', s.id::text from solicitudes_precio s
where (pg_temp.de_demo('solicitudes_precio', s.id::text, s.solicitante_id)
       or s.cotizacion_id::text in (select id from _d where tabla = 'cotizaciones')
       or s.articulo_id::text in (select id from _d where tabla = 'articulos')
       or s.cliente_id::text in (select id from _d where tabla = 'clientes'))
  and not pg_temp.de_real('solicitudes_precio', s.id::text, s.solicitante_id);

-- Producción.
insert into _d select 'ordenes_produccion', o.id::text from ordenes_produccion o
where (pg_temp.de_demo('ordenes_produccion', o.id::text, o.creado_por)
       or o.pedido_id::text in (select id from _d where tabla = 'pedidos')
       or o.articulo_id::text in (select id from _d where tabla = 'articulos')
       or o.notas like 'DEMO%' or o.numero_serie like 'DEMO-%')
  and not pg_temp.de_real('ordenes_produccion', o.id::text, o.creado_por);

insert into _d select 'solicitudes_cambio_bom', s.id::text from solicitudes_cambio_bom s
where (s.solicitado_por in (select id from _usr_demo)
       or s.articulo_id::text in (select id from _d where tabla = 'articulos')
       or s.orden_id::text in (select id from _d where tabla = 'ordenes_produccion'))
  and not pg_temp.de_real('solicitudes_cambio_bom', s.id::text, s.solicitado_por);

-- Ingeniería: solo los documentos de cosas de la demostración. Los planos de Drive
-- también los dio de alta ingenieria@ y son reales.
insert into _d select 'documentos_tecnicos', d.id::text from documentos_tecnicos d
where (d.articulo_id::text in (select id from _d where tabla = 'articulos') or d.pedido_id::text in (select id from _d where tabla = 'pedidos'))
  and not pg_temp.de_real('documentos_tecnicos', d.id::text, d.creado_por);

-- Compras e importaciones.
insert into _d select 'ordenes_compra', o.id::text from ordenes_compra o
where (pg_temp.de_demo('ordenes_compra', o.id::text, o.creado_por)
       or o.proveedor_id::text in (select id from _d where tabla = 'proveedores') or o.notas like 'DEMO%')
  and not pg_temp.de_real('ordenes_compra', o.id::text, o.creado_por);

insert into _d select 'requisiciones', r.id::text from requisiciones r
where (pg_temp.de_demo('requisiciones', r.id::text, r.solicitante_id) or r.notas like 'DEMO%')
  and not pg_temp.de_real('requisiciones', r.id::text, r.solicitante_id);

insert into _d select 'embarques', e.id::text from embarques e
where (pg_temp.de_demo('embarques', e.id::text, e.creado_por) or e.notas like 'DEMO%'
       or exists (select 1 from embarque_oc x where x.embarque_id = e.id and x.orden_compra_id::text in (select id from _d where tabla = 'ordenes_compra')))
  and not pg_temp.de_real('embarques', e.id::text, e.creado_por);

insert into _d select 'pagos_proveedor', p.id::text from pagos_proveedor p
where (p.registrado_por in (select id from _usr_demo) or p.orden_compra_id::text in (select id from _d where tabla = 'ordenes_compra'))
  and not pg_temp.de_real('pagos_proveedor', p.id::text, p.registrado_por);

-- Almacén. Se queda solo la existencia de arranque de la importación (movimiento
-- "inicial" sin usuario de un artículo real) y lo que haya movido una persona real.
insert into _d select 'movimientos_inventario', m.id::text from movimientos_inventario m
where not (m.tipo = 'inicial' and m.usuario_id is null and m.articulo_id::text not in (select id from _d where tabla = 'articulos'))
  and not pg_temp.de_real('movimientos_inventario', m.id::text, m.usuario_id);

-- Igual con los apartados: se quedan los de la hoja (RESERVADO) y los de personas reales.
insert into _d select 'reservas', r.id::text from reservas r
where not (r.motivo like 'Apartado en la hoja%' and r.creado_por is null and r.orden_produccion_id is null and r.pedido_id is null
           and r.articulo_id::text not in (select id from _d where tabla = 'articulos'))
  and not pg_temp.de_real('reservas', r.id::text, r.creado_por);

insert into _d select 'conteos', c.id::text from conteos c
where pg_temp.de_demo('conteos', c.id::text, c.creado_por) and not pg_temp.de_real('conteos', c.id::text, c.creado_por);

insert into _d select 'ajustes_inventario', a.id::text from ajustes_inventario a
where (pg_temp.de_demo('ajustes_inventario', a.id::text, a.solicitado_por)
       or a.articulo_id::text in (select id from _d where tabla = 'articulos')
       or a.conteo_id::text in (select id from _d where tabla = 'conteos'))
  and not pg_temp.de_real('ajustes_inventario', a.id::text, a.solicitado_por);

-- Envíos y devoluciones.
insert into _d select 'envios', e.id::text from envios e
where (pg_temp.de_demo('envios', e.id::text, e.solicitado_por) or e.pedido_id::text in (select id from _d where tabla = 'pedidos'))
  and not pg_temp.de_real('envios', e.id::text, e.solicitado_por);

insert into _d select 'devoluciones', d.id::text from devoluciones d
where (pg_temp.de_demo('devoluciones', d.id::text, d.creado_por)
       or d.pedido_id::text in (select id from _d where tabla = 'pedidos')
       or d.envio_id::text in (select id from _d where tabla = 'envios'))
  and not pg_temp.de_real('devoluciones', d.id::text, d.creado_por);

insert into _d select 'recargas_paqueteria', r.id::text from recargas_paqueteria r
where (pg_temp.de_demo('recargas_paqueteria', r.id::text, r.registrado_por) or r.referencia like 'DEMO%')
  and not pg_temp.de_real('recargas_paqueteria', r.id::text, r.registrado_por);

-- Servicio y mantenimiento.
insert into _d select 'servicios', s.id::text from servicios s
where (pg_temp.de_demo('servicios', s.id::text, s.solicitado_por)
       or s.cliente_id::text in (select id from _d where tabla = 'clientes')
       or s.pedido_id::text in (select id from _d where tabla = 'pedidos')
       or s.orden_produccion_id::text in (select id from _d where tabla = 'ordenes_produccion')
       or s.referencia like 'DEMO-SRV-%')
  and not pg_temp.de_real('servicios', s.id::text, s.solicitado_por);

insert into _d select 'ordenes_mantenimiento', o.id::text from ordenes_mantenimiento o
where (pg_temp.de_demo('ordenes_mantenimiento', o.id::text, o.reportado_por) or o.maquina_id::text in (select id from _d where tabla = 'maquinas'))
  and not pg_temp.de_real('ordenes_mantenimiento', o.id::text, o.reportado_por);

insert into _d select 'resguardos', r.id::text from resguardos r
where (pg_temp.de_demo('resguardos', r.id::text, r.entregado_por)
       or r.maquina_id::text in (select id from _d where tabla = 'maquinas')
       or r.servicio_id::text in (select id from _d where tabla = 'servicios')
       or r.empleado_id::text in (select id from _d where tabla = 'empleados'))
  and not pg_temp.de_real('resguardos', r.id::text, r.entregado_por);

-- Comisiones de la demostración (ajustes "(demo)", pago "DEMO SPEI…").
insert into _d select 'comision_ajustes', c.id::text from comision_ajustes c
where (pg_temp.de_demo('comision_ajustes', c.id::text, c.autorizado_por) or c.concepto like '%(demo)')
  and not pg_temp.de_real('comision_ajustes', c.id::text, c.autorizado_por);

-- Recursos humanos: todo lo del personal DEMO y lo que capturaron las cuentas de prueba.
insert into _d select 'objetivo_evaluaciones', e.id::text from objetivo_evaluaciones e
where e.empleado_id::text in (select id from _d where tabla = 'empleados');
insert into _d select 'objetivo_ajustes', a.id::text from objetivo_ajustes a
where (a.evaluacion_id::text in (select id from _d where tabla = 'objetivo_evaluaciones') or a.solicitado_por in (select id from _usr_demo))
  and not pg_temp.de_real('objetivo_ajustes', a.id::text, a.solicitado_por);
-- Las marcas sobre empleados de la demostración se van aunque las haya puesto una
-- persona real: hablan de alguien que no existe (en la nube, el dueño probó el
-- checklist con dos de ellos). Se cuentan para que la comprobación del final sepa
-- que esas sí se borraron a propósito.
insert into _d select 'objetivo_marcas', m.id::text from objetivo_marcas m
where m.empleado_id::text in (select id from _d where tabla = 'empleados')
   or (m.marcado_por in (select id from _usr_demo) and not pg_temp.de_real('objetivo_marcas', m.id::text, m.marcado_por));
create temp table _real_sobre_demo on commit drop as
select 'objetivo_marcas'::text tabla, 'marcado_por'::text columna, count(*) n from objetivo_marcas m
where m.empleado_id::text in (select id from _d where tabla = 'empleados') and m.marcado_por in (select id from _usr_real);
insert into _d select 'nomina_prestamos', p.id::text from nomina_prestamos p
where (p.empleado_id::text in (select id from _d where tabla = 'empleados') or p.autorizado_por in (select id from _usr_demo))
  and not pg_temp.de_real('nomina_prestamos', p.id::text, p.autorizado_por);
insert into _d select 'nomina_movimientos', m.id::text from nomina_movimientos m
where (m.empleado_id::text in (select id from _d where tabla = 'empleados') or m.registrado_por in (select id from _usr_demo))
  and not pg_temp.de_real('nomina_movimientos', m.id::text, m.registrado_por);
insert into _d select 'nomina_sueldos', s.id::text from nomina_sueldos s
where (s.empleado_id::text in (select id from _d where tabla = 'empleados') or s.registrado_por in (select id from _usr_demo))
  and not pg_temp.de_real('nomina_sueldos', s.id::text, s.registrado_por);
insert into _d select 'bono_bases', b.id::text from bono_bases b
where (b.empleado_id::text in (select id from _d where tabla = 'empleados') or b.registrado_por in (select id from _usr_demo))
  and not pg_temp.de_real('bono_bases', b.id::text, b.registrado_por);
insert into _d select 'incidencias', i.id::text from incidencias i
where (i.empleado_id::text in (select id from _d where tabla = 'empleados') or pg_temp.de_demo('incidencias', i.id::text, i.solicitada_por))
  and not pg_temp.de_real('incidencias', i.id::text, i.solicitada_por);
insert into _d select 'puesto_asignaciones', a.id::text from puesto_asignaciones a
where (a.empleado_id::text in (select id from _d where tabla = 'empleados') or a.creado_por in (select id from _usr_demo))
  and not pg_temp.de_real('puesto_asignaciones', a.id::text, a.creado_por);

-- -----------------------------------------------------------------------------
-- 3. Lo real que depende de la demostración: mejor detenerse que adivinar
-- -----------------------------------------------------------------------------
do $$
declare v text;
begin
  select string_agg(distinct c.folio, ', ') into v
  from cotizaciones c left join cotizacion_lineas l on l.cotizacion_id = c.id
  where c.id::text not in (select id from _d where tabla = 'cotizaciones')
    and (l.articulo_id::text in (select id from _d where tabla = 'articulos')
         or c.cliente_id::text in (select id from _d where tabla = 'clientes')
         or c.origen_id::text in (select id from _d where tabla = 'cotizaciones'));
  if v is not null then
    raise exception 'No se limpió nada: las cotizaciones % las hizo una persona real pero usan artículos o clientes de la demostración. Decide qué hacer con ellas (cambiarles la partida o el cliente) y vuelve a correr.', v;
  end if;

  select string_agg(distinct p.folio, ', ') into v
  from pedidos p left join pedido_lineas l on l.pedido_id = p.id
  where p.id::text not in (select id from _d where tabla = 'pedidos')
    and (l.articulo_id::text in (select id from _d where tabla = 'articulos')
         or p.cliente_id::text in (select id from _d where tabla = 'clientes')
         or p.cotizacion_id::text in (select id from _d where tabla = 'cotizaciones'));
  if v is not null then
    raise exception 'No se limpió nada: los pedidos % no son de la demostración pero usan artículos, clientes o cotizaciones de ella.', v;
  end if;

  select string_agg(distinct m.id::text, ', ') into v
  from movimientos_inventario m
  where m.id::text not in (select id from _d where tabla = 'movimientos_inventario')
    and (m.articulo_id::text in (select id from _d where tabla = 'articulos')
         or m.orden_produccion_id::text in (select id from _d where tabla = 'ordenes_produccion')
         or m.orden_compra_id::text in (select id from _d where tabla = 'ordenes_compra')
         or m.pedido_id::text in (select id from _d where tabla = 'pedidos')
         or m.ajuste_id::text in (select id from _d where tabla = 'ajustes_inventario'));
  if v is not null then
    raise exception 'No se limpió nada: los movimientos de inventario % los registró una persona real sobre cosas de la demostración.', v;
  end if;

  select string_agg(distinct o.folio, ', ') into v
  from ordenes_compra o join oc_lineas l on l.orden_compra_id = o.id
  where o.id::text not in (select id from _d where tabla = 'ordenes_compra')
    and l.articulo_id::text in (select id from _d where tabla = 'articulos');
  if v is not null then
    raise exception 'No se limpió nada: las órdenes de compra % no son de la demostración pero piden artículos DEMO.', v;
  end if;
end $$;

-- Qué registros existían, para saber al final de cuáles hablan bitácora y avisos
-- que ya no están (los que borró esta limpieza; lo que ya faltaba antes no se toca).
create temp table _existian (tabla text, registro_id text) on commit drop;
do $$
declare t text;
begin
  for t in select distinct x.tabla from (select tabla from bitacora union select tabla from avisos union select tabla from pendientes) x
           where x.tabla is not null and to_regclass('public.' || quote_ident(x.tabla)) is not null loop
    execute format('insert into _existian select %L, pg_temp.reg_id(to_jsonb(x)) from public.%I x', t, t);
  end loop;
end $$;

-- Los momentos (transacciones) en que la demostración cambió costos de artículos
-- reales: las fotos de costeo de esos mismos momentos también son de la demostración.
create temp table _costo_demo on commit drop as
select h.id, h.articulo_id, h.en, h.costo_anterior, h.moneda,
       row_number() over (partition by h.articulo_id order by h.en, h.id) n
from historial_costos h
where h.usuario_id in (select id from _usr_demo)
  and h.articulo_id::text not in (select id from _d where tabla = 'articulos');

-- -----------------------------------------------------------------------------
-- 4. Disparadores apagados mientras se borra
-- -----------------------------------------------------------------------------
-- Los "inalterables" (movimientos, evidencia de envíos, nómina cerrada, planos)
-- no dejarían borrar; auditar() llenaría la bitácora de bajas; los de costeo
-- recalcularían a cada paso (se recalcula una vez al final). Solo se apagan los
-- que estaban encendidos y al final se encienden exactamente esos.
create temp table _disparadores on commit drop as
select t.tgrelid::regclass tabla, t.tgname nombre
from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace s on s.oid = c.relnamespace
where s.nspname = 'public' and not t.tgisinternal and t.tgenabled = 'O';
do $$
declare r record;
begin
  for r in select * from _disparadores loop
    execute format('alter table %s disable trigger %I', r.tabla, r.nombre);
  end loop;
end $$;

-- -----------------------------------------------------------------------------
-- 5. Borrado, de hijos a padres (las llaves sin "on delete cascade" lo exigen)
-- -----------------------------------------------------------------------------
-- Solicitudes de precio (sus costos y fotos se van en cascada).
delete from solicitudes_precio where id::text in (select id from _d where tabla = 'solicitudes_precio');

-- Planos ligados a órdenes DEMO y documentos de artículos/pedidos DEMO.
delete from op_planos where orden_id::text in (select id from _d where tabla = 'ordenes_produccion')
  or documento_id::text in (select id from _d where tabla = 'documentos_tecnicos');
delete from documentos_tecnicos where id::text in (select id from _d where tabla = 'documentos_tecnicos');

-- Devoluciones y envíos (partidas, bultos, evidencia y eventos en cascada).
delete from devoluciones where id::text in (select id from _d where tabla = 'devoluciones');
delete from envios where id::text in (select id from _d where tabla = 'envios');
delete from recargas_paqueteria where id::text in (select id from _d where tabla = 'recargas_paqueteria');

-- Servicio y mantenimiento (cuadrillas, materiales, costos y evidencias en cascada;
-- los planes preventivos se van con su máquina).
delete from resguardos where id::text in (select id from _d where tabla = 'resguardos');
delete from servicios where id::text in (select id from _d where tabla = 'servicios');
delete from ordenes_mantenimiento where id::text in (select id from _d where tabla = 'ordenes_mantenimiento');
delete from maquinas where id::text in (select id from _d where tabla = 'maquinas');

-- Importaciones: el embarque se lleva sus órdenes ligadas, pagos, gastos, pedimentos,
-- saldos, documentos y costeos.
delete from embarques where id::text in (select id from _d where tabla = 'embarques');
delete from pagos_proveedor where id::text in (select id from _d where tabla = 'pagos_proveedor');

-- Almacén: movimientos (después de envíos y servicio, que los referencian), ajustes,
-- conteos y apartados.
delete from movimientos_inventario where id::text in (select id from _d where tabla = 'movimientos_inventario');
delete from ajustes_inventario where id::text in (select id from _d where tabla = 'ajustes_inventario');
delete from conteos where id::text in (select id from _d where tabla = 'conteos');
delete from reservas where id::text in (select id from _d where tabla = 'reservas');

-- Compras y producción.
delete from requisiciones where id::text in (select id from _d where tabla = 'requisiciones');
delete from ordenes_compra where id::text in (select id from _d where tabla = 'ordenes_compra');
delete from solicitudes_cambio_bom where id::text in (select id from _d where tabla = 'solicitudes_cambio_bom');
delete from ordenes_produccion where id::text in (select id from _d where tabla = 'ordenes_produccion');

-- Ventas (partidas, facturas, cobros y crédito compartido se van con el pedido).
delete from pedidos where id::text in (select id from _d where tabla = 'pedidos');
delete from cotizaciones where id::text in (select id from _d where tabla = 'cotizaciones');
delete from actividades where id::text in (select id from _d where tabla = 'actividades');
delete from oportunidades where id::text in (select id from _d where tabla = 'oportunidades');
delete from clientes where id::text in (select id from _d where tabla = 'clientes');
delete from comision_ajustes where id::text in (select id from _d where tabla = 'comision_ajustes');
delete from comision_pagos c
where (c.registrado_por in (select id from _usr_demo) or c.referencia like 'DEMO%')
  and not pg_temp.de_real('comision_pagos', pg_temp.reg_id(to_jsonb(c)), c.registrado_por);

-- Recursos humanos. Primero lo que apunta a evaluaciones y préstamos, luego el personal
-- (sus datos, incidencias y asignaciones de puesto se van con él).
delete from objetivo_ajustes where id::text in (select id from _d where tabla = 'objetivo_ajustes');
delete from nomina_bonos where evaluacion_id::text in (select id from _d where tabla = 'objetivo_evaluaciones');
delete from objetivo_evaluaciones where id::text in (select id from _d where tabla = 'objetivo_evaluaciones');
delete from objetivo_marcas where id::text in (select id from _d where tabla = 'objetivo_marcas');
delete from nomina_renglones where empleado_id::text in (select id from _d where tabla = 'empleados');
delete from nomina_prestamo_abonos a
where (a.prestamo_id::text in (select id from _d where tabla = 'nomina_prestamos') or a.registrado_por in (select id from _usr_demo))
  and not (a.registrado_por is not null and a.registrado_por in (select id from _usr_real));
delete from nomina_prestamos where id::text in (select id from _d where tabla = 'nomina_prestamos');
delete from nomina_movimientos where id::text in (select id from _d where tabla = 'nomina_movimientos');
delete from nomina_sueldos where id::text in (select id from _d where tabla = 'nomina_sueldos');
delete from bono_bases where id::text in (select id from _d where tabla = 'bono_bases');
delete from incidencias where id::text in (select id from _d where tabla = 'incidencias');
delete from puesto_asignaciones where id::text in (select id from _d where tabla = 'puesto_asignaciones');
delete from objetivo_plantillas where empleado_id::text in (select id from _d where tabla = 'empleados');
delete from empleados where id::text in (select id from _d where tabla = 'empleados');
-- Semanas de nómina que ya no tienen nada y que no cerró una persona real.
delete from nomina_semanas s
where not exists (select 1 from nomina_renglones x where x.semana = s.inicio)
  and not exists (select 1 from nomina_movimientos x where x.semana = s.inicio)
  and not exists (select 1 from nomina_prestamo_abonos x where x.semana = s.inicio)
  and not exists (select 1 from nomina_bonos x where x.semana = s.inicio)
  and (s.cerrada_por is null or s.cerrada_por in (select id from _usr_demo));

-- Catálogo: sugerencias que mencionen artículos DEMO (no debería haber), artículos
-- (costos, historial, listas, precios, publicaciones y existencias en cascada) y proveedores.
delete from sugerencias_subensamble s
where s.subensamble_id::text in (select id from _d where tabla = 'articulos')
   or exists (select 1 from unnest(s.equipos) e where e::text in (select id from _d where tabla = 'articulos'))
   or exists (select 1 from _d x where x.tabla = 'articulos' and s.componentes::text like '%' || x.id || '%');
-- Las líneas de las listas DEMO van antes: si se dejan a la cascada, la revisión de
-- "hijo_id" puede correr antes de que la cascada por "padre_id" las borre.
delete from bom_lineas where padre_id::text in (select id from _d where tabla = 'articulos')
  or hijo_id::text in (select id from _d where tabla = 'articulos');
delete from articulos where id::text in (select id from _d where tabla = 'articulos');
delete from proveedores where id::text in (select id from _d where tabla = 'proveedores');

-- Configuración que puso la demostración: tipos de cambio "demo", la meta anual DEMO
-- (con su meta por estado) y la regla de familia DEMO. Al quitar la regla, el libro de
-- ventas se reclasifica con las que quedan y vuelve a la familia que traía.
delete from tipos_cambio where fuente = 'demo';
delete from metas_anuales where notas like 'DEMO%' and (actualizado_por is null or actualizado_por in (select id from _usr_demo));
delete from reglas_familia_venta where nota like 'DEMO%' and (creado_por is null or creado_por in (select id from _usr_demo));
select reclasificar_ventas();

-- Los resúmenes del asistente describen datos que ya no existen; se vuelven a generar.
delete from asistente_resumenes;

-- -----------------------------------------------------------------------------
-- 6. Lo real que la demostración había cambiado, de vuelta como lo dejó la importación
-- -----------------------------------------------------------------------------
-- 6.1 Costos. El costeo final del embarque DEMO de Yao Han puso a tres cosedoras el
-- costo "puesto en planta" de una compra que no existió. Se regresa al costo de antes
-- (el costo_anterior de la primera vez que la demostración lo tocó), con la fecha y el
-- proveedor de la importación. Si después lo cambió una persona real, ese manda.
create temp table _costo_restaurar on commit drop as
select d.articulo_id, d.costo_anterior, d.moneda, u.costo_nuevo costo_import, u.moneda moneda_import, u.en en_import
from _costo_demo d
left join lateral (select i.costo_nuevo, i.moneda, i.en from historial_costos i
                   where i.articulo_id = d.articulo_id and i.origen = 'importacion' and i.usuario_id is null
                   order by i.en desc, i.id desc limit 1) u on true
where d.n = 1
  and not exists (select 1 from historial_costos r where r.articulo_id = d.articulo_id
                  and r.usuario_id in (select id from _usr_real) and (r.en, r.id) > (d.en, d.id));

-- Si la demostración le dio costo a algo que no tenía, se le quita.
delete from costos_articulo c using _costo_restaurar r where c.articulo_id = r.articulo_id and r.costo_anterior is null;
update costos_articulo c set
  costo = case when r.moneda = coalesce(r.moneda_import, 'MXN') then r.costo_anterior else coalesce(r.costo_import, r.costo_anterior) end,
  moneda = coalesce(r.moneda_import, 'MXN'),
  proveedor_id = a.proveedor_id,
  actualizado_en = coalesce((r.en_import at time zone 'America/Mexico_City')::date, c.actualizado_en),
  actualizado_por = null
from _costo_restaurar r join articulos a on a.id = r.articulo_id
where c.articulo_id = r.articulo_id and r.costo_anterior is not null;

-- Su historia y las fotos de costeo que dejó la demostración (las de esos artículos y
-- las de los equipos que los llevan, tomadas en la misma transacción).
delete from historial_costeo h
where not h.reconstruido
  and h.articulo_id::text not in (select id from _d where tabla = 'articulos')
  and h.en in (select d.en from _costo_demo d where d.articulo_id in (select articulo_id from _costo_restaurar));
delete from historial_costos where id in (select d.id from _costo_demo d where d.articulo_id in (select articulo_id from _costo_restaurar));

-- 6.2 Medidas de empaque que almacén "tomó" en la demostración de envíos. Cada campo
-- vuelve al valor que tenía antes del primer cambio de una cuenta de prueba (la
-- bitácora lo guarda); la importación no llena estos campos, así que casi siempre es
-- "sin medir".
create temp table _empaque on commit drop as
select b.registro_id, jsonb_object_agg(k.key, k.value->0 order by b.en desc, b.id desc) viejo, array_agg(b.id) bitacora_ids
from bitacora b cross join jsonb_each(b.cambios) k
where b.tabla = 'articulos' and b.accion = 'cambio' and b.usuario_id in (select id from _usr_demo)
  and b.cambios ? 'paquete_medido_por' and k.key like 'paquete%'
  and b.registro_id not in (select id from _d where tabla = 'articulos')
group by b.registro_id;
update articulos a set
  paquete_kg = case when e.viejo ? 'paquete_kg' then (e.viejo->>'paquete_kg')::numeric else a.paquete_kg end,
  paquete_largo_cm = case when e.viejo ? 'paquete_largo_cm' then (e.viejo->>'paquete_largo_cm')::numeric else a.paquete_largo_cm end,
  paquete_ancho_cm = case when e.viejo ? 'paquete_ancho_cm' then (e.viejo->>'paquete_ancho_cm')::numeric else a.paquete_ancho_cm end,
  paquete_alto_cm = case when e.viejo ? 'paquete_alto_cm' then (e.viejo->>'paquete_alto_cm')::numeric else a.paquete_alto_cm end,
  paquete_piezas = case when e.viejo ? 'paquete_piezas' then coalesce((e.viejo->>'paquete_piezas')::numeric, 1) else a.paquete_piezas end,
  paquete_medido_por = case when e.viejo ? 'paquete_medido_por' then (e.viejo->>'paquete_medido_por')::uuid else a.paquete_medido_por end,
  paquete_medido_en = case when e.viejo ? 'paquete_medido_en' then (e.viejo->>'paquete_medido_en')::timestamptz else a.paquete_medido_en end,
  -- Sin otro cambio en la bitácora, el artículo no se había tocado desde que se importó.
  actualizado_en = case when not exists (select 1 from bitacora o where o.tabla = 'articulos' and o.registro_id = a.id::text
                                           and o.accion = 'cambio' and o.id <> all (e.bitacora_ids))
                        then a.creado_en else a.actualizado_en end
from _empaque e
where a.id::text = e.registro_id;
delete from bitacora where id in (select unnest(bitacora_ids) from _empaque);

-- 6.3 Teléfonos inventados de los vendedores (ventas.sql los puso para la cotización
-- impresa). Solo si siguen siendo exactamente esos.
create temp table _telefonos on commit drop as
select p.id, v.tel from perfiles p
join (values ('isaac@hegamex.com', '33 1890 4417'), ('juan@hegamex.com', '33 2104 7782'), ('susana@hegamex.com', '33 1566 0931')) v(correo, tel)
  on lower(p.correo) = v.correo and p.telefono = v.tel;
update perfiles p set telefono = null,
  actualizado_en = case when not exists (select 1 from bitacora o where o.tabla = 'perfiles' and o.registro_id = p.id::text and o.accion = 'cambio'
                                           and o.cambios <> jsonb_build_object('telefono', jsonb_build_array(null, t.tel)))
                        then p.creado_en else p.actualizado_en end
from _telefonos t where p.id = t.id;
delete from bitacora b using _telefonos t
where b.tabla = 'perfiles' and b.registro_id = t.id::text and b.accion = 'cambio'
  and b.cambios = jsonb_build_object('telefono', jsonb_build_array(null, t.tel));

-- -----------------------------------------------------------------------------
-- 7. Existencias = suma de los movimientos que quedan
-- -----------------------------------------------------------------------------
-- Es lo que aplicar_movimiento() habría dejado si la demostración nunca hubiera
-- sacado ni traspasado nada; actualizado_en vuelve a la hora del último movimiento.
create temp table _suma_mov on commit drop as
select articulo_id, almacen_id, sum(cantidad) cantidad, max(en) ultimo from movimientos_inventario group by 1, 2;
update existencias e set cantidad = s.cantidad, actualizado_en = s.ultimo
from _suma_mov s
where e.articulo_id = s.articulo_id and e.almacen_id = s.almacen_id
  and (e.cantidad is distinct from s.cantidad or e.actualizado_en is distinct from s.ultimo);
delete from existencias e
where not exists (select 1 from _suma_mov s where s.articulo_id = e.articulo_id and s.almacen_id = e.almacen_id);
insert into existencias (articulo_id, almacen_id, cantidad, actualizado_en)
select s.articulo_id, s.almacen_id, s.cantidad, s.ultimo from _suma_mov s
where not exists (select 1 from existencias e where e.articulo_id = s.articulo_id and e.almacen_id = s.almacen_id);

-- -----------------------------------------------------------------------------
-- 8. Costeo: un recálculo completo con la regla de la base
-- -----------------------------------------------------------------------------
-- Con los costos de vuelta, costos calculados y precios de lista regresan solos a lo
-- de la importación. Si quedara algo distinto, recalcular_costos() tomaría una foto
-- nueva en historial_costeo: el paso 11 revisa que no haya tomado ninguna.
create temp table _antes_recalculo on commit drop as select coalesce(max(id), 0) ultimo from historial_costeo;
select recalcular_costos();

-- -----------------------------------------------------------------------------
-- 9. Bitácora, avisos y pendientes que hablan de lo que se borró
-- -----------------------------------------------------------------------------
create temp table _existen on commit drop as select * from _existian where false;
do $$
declare t text;
begin
  for t in select distinct tabla from _existian loop
    execute format('insert into _existen select %L, pg_temp.reg_id(to_jsonb(x)) from public.%I x', t, t);
  end loop;
end $$;
create temp table _borrados on commit drop as select * from _existian except select * from _existen;
create index on _borrados (tabla, registro_id);

delete from bitacora b using _borrados x where b.tabla = x.tabla and b.registro_id = x.registro_id;

-- Los avisos usan a veces "id:tipo:huella" o "mes:fecha:usuario"; se compara la
-- primera parte. Los de objetivos del mes y los de saldo bajo se revisan contra lo que
-- quedó: sin evaluaciones ese mes o sin saldo bajo de verdad, ya no dicen nada cierto.
delete from avisos a
where exists (select 1 from _borrados x where x.tabla = a.tabla and x.registro_id = split_part(a.registro_id, ':', 1))
   -- (el case asegura que la fecha solo se lea cuando el texto sí trae una)
   or (a.tabla = 'objetivo_evaluaciones'
       and case when a.registro_id ~ '^mes:\d{4}-\d{2}-\d{2}'
                then not exists (select 1 from objetivo_evaluaciones e where e.mes = split_part(a.registro_id, ':', 2)::date)
                else false end)
   or (a.tipo = 'saldo_bajo' and a.tabla = 'paqueterias'
       and not exists (select 1 from saldos_paqueteria_todas() s where s.paqueteria_id::text = a.registro_id and s.bajo));

delete from pendientes p
where (p.creado_por in (select id from _usr_demo)
       or exists (select 1 from _borrados x where x.tabla = p.tabla and x.registro_id = split_part(p.registro_id, ':', 1)))
  and not (p.creado_por is not null and p.creado_por in (select id from _usr_real));

-- -----------------------------------------------------------------------------
-- 10. Folios: cada serie sigue después del último folio que quedó
-- -----------------------------------------------------------------------------
-- La demostración gastó COT-, PED-, OC-…; sin bajar nunca de un folio que siga en
-- la base (no se repetiría), la numeración real empieza donde debe.
do $$
declare r record; v int;
begin
  for r in select f.serie, f.anio, f.ultimo, m.tabla from folios f
           join (values ('COT', 'cotizaciones'), ('PED', 'pedidos'), ('AJU', 'ajustes_inventario'), ('OC', 'ordenes_compra'),
                        ('REQ', 'requisiciones'), ('OP', 'ordenes_produccion'), ('EMB', 'embarques'), ('SRV', 'servicios'),
                        ('MTO', 'ordenes_mantenimiento'), ('ENV', 'envios'), ('DEV', 'devoluciones'), ('REC', 'devoluciones'),
                        ('CAN', 'devoluciones'), ('SP', 'solicitudes_precio')) m(serie, tabla) on m.serie = f.serie loop
    execute format('select max((substring(folio from %L))::int) from public.%I', '^' || r.serie || '-' || r.anio || '-(\d+)', r.tabla) into v;
    if v is null then
      delete from folios where serie = r.serie and anio = r.anio;
    elsif v < r.ultimo then
      update folios set ultimo = v where serie = r.serie and anio = r.anio;
    end if;
  end loop;
end $$;

-- -----------------------------------------------------------------------------
-- 11. Disparadores encendidos otra vez y comprobaciones (si una falla, no queda nada)
-- -----------------------------------------------------------------------------
do $$
declare r record;
begin
  for r in select * from _disparadores loop
    execute format('alter table %s enable trigger %I', r.tabla, r.nombre);
  end loop;
end $$;

do $$
declare t text; n bigint; v text; r record;
begin
  for t in select tabla from _conteo loop
    execute format('select count(*) from public.%I', t) into n;
    update _conteo set despues = n where tabla = t;
  end loop;

  -- a) Las tablas que esta limpieza no tiene por qué tocar quedan igual.
  select string_agg(format('%s (%s → %s)', tabla, antes, despues), ', ') into v from _conteo
  where antes is distinct from despues and tabla not in (
    'actividades', 'ajustes_inventario', 'articulo_parametros', 'articulos', 'asistente_resumenes', 'avisos', 'bitacora',
    'bom_lineas', 'bom_operaciones', 'bono_bases', 'clientes', 'cobros', 'comision_ajustes', 'comision_pagos', 'contactos',
    'conteo_lineas', 'conteos', 'costeo_importacion_lineas', 'costeos_importacion', 'costos_articulo', 'costos_calculados',
    'costos_servicio', 'cotizacion_lineas', 'cotizaciones', 'devolucion_lineas', 'devoluciones', 'documentos_tecnicos',
    'embarque_documentos', 'embarque_eventos', 'embarque_gastos', 'embarque_oc', 'embarque_pagos', 'embarque_saldos', 'embarques',
    'empleado_datos', 'empleados', 'envio_bultos', 'envio_lineas', 'envios', 'eventos_envio', 'evidencias_envio', 'existencias',
    'facturas', 'folios', 'historial_costeo', 'historial_costos', 'incidencias', 'maquinas', 'metas_anuales', 'metas_estado',
    'movimientos_inventario', 'nomina_bonos', 'nomina_movimientos', 'nomina_prestamo_abonos', 'nomina_prestamos',
    'nomina_renglones', 'nomina_semanas', 'nomina_sueldos', 'objetivo_ajustes', 'objetivo_comentarios', 'objetivo_evaluaciones',
    'objetivo_evidencias', 'objetivo_marcas', 'objetivo_plantilla_lineas', 'objetivo_plantillas', 'objetivo_resultados',
    'oc_lineas', 'op_eventos', 'op_materiales', 'op_operaciones', 'op_planos', 'oportunidades', 'ordenes_compra',
    'ordenes_mantenimiento', 'ordenes_produccion', 'pagos_proveedor', 'pedido_lineas', 'pedido_vendedores', 'pedidos',
    'pedimentos', 'pendientes', 'planes_preventivos', 'precios_lista', 'proveedores', 'publicaciones', 'puesto_asignaciones',
    'recargas_paqueteria', 'reglas_familia_venta', 'requisicion_lineas', 'requisiciones', 'reservas', 'resguardos',
    'servicio_cuadrilla', 'servicio_evidencias', 'servicio_materiales', 'servicios', 'solicitudes_cambio_bom',
    'solicitudes_precio', 'solicitudes_precio_costos', 'solicitudes_precio_fotos', 'sugerencias_subensamble', 'tipos_cambio');
  if v is not null then raise exception 'Cambiaron tablas que no debían: %', v; end if;

  -- b) Lo real (medido sin las reglas de esta limpieza) sigue completo.
  update _medidas m set despues = x.valor from pg_temp.medidas() x where x.clave = m.clave;
  select string_agg(format('%s (%s → %s)', clave, antes, despues), ', ') into v from _medidas where antes is distinct from despues;
  if v is not null then raise exception 'Se movió algo real: %', v; end if;

  -- c) Nada que haya creado una persona real desapareció (ni por cascada).
  for r in select * from _creado_real loop
    execute format('select count(*) from public.%I where %I in (select id from _usr_real)', r.tabla, r.columna) into n;
    if n <> r.antes - coalesce((select sum(x.n) from _real_sobre_demo x where x.tabla = r.tabla and x.columna = r.columna), 0) then
      raise exception 'Se borró algo que creó una persona real en %.% (% → %)', r.tabla, r.columna, r.antes, n;
    end if;
  end loop;
  select string_agg(distinct a.tabla || ' ' || a.registro_id, ', ') into v from _alta a
  where a.quien = 'real' and exists (select 1 from _borrados x where x.tabla = a.tabla and x.registro_id = a.registro_id);
  if v is not null then raise exception 'Se borró algo que dio de alta una persona real: %', v; end if;

  -- d) No queda nada marcado como demostración.
  select string_agg(x, ', ') into v from (
    select 'clientes ' || count(*) x from clientes where (nombre like 'DEMO %' or legacy_ref like 'demo-rf-%') and coalesce(legacy_ref, '') !~ '^CLI:'
      and not pg_temp.de_real('clientes', id::text, creado_por) having count(*) > 0
    union all select 'proveedores ' || count(*) from proveedores where (legacy_id like 'DEMO-PROV-%' or legacy_id like 'demo-rf-%')
      and not pg_temp.de_real('proveedores', id::text) having count(*) > 0
    union all select 'articulos ' || count(*) from articulos where clave like 'DEMO-%' and coalesce(legacy_id, '') !~ '^(LC|EQ|FALTA):'
      and not pg_temp.de_real('articulos', id::text) having count(*) > 0
    union all select 'maquinas ' || count(*) from maquinas where numero like 'DEMO-%' and not pg_temp.de_real('maquinas', id::text) having count(*) > 0
    union all select 'empleados ' || count(*) from empleados where id = md5('demo-rf:emp:' || numero)::uuid having count(*) > 0
    union all select 'pedidos ' || count(*) from pedidos where (folio like 'DEMO-%' or notas like 'DEMO%' or id_externo like '20000091000%'
      or id_externo like '2000009812%') and not pg_temp.de_real('pedidos', id::text, creado_por) having count(*) > 0
    union all select 'cotizaciones ' || count(*) from cotizaciones where atencion like '%DEMO%' and not pg_temp.de_real('cotizaciones', id::text, vendedor_id) having count(*) > 0
    union all select 'ordenes_produccion ' || count(*) from ordenes_produccion where (notas like 'DEMO%' or numero_serie like 'DEMO-%')
      and not pg_temp.de_real('ordenes_produccion', id::text, creado_por) having count(*) > 0
    union all select 'ordenes_compra ' || count(*) from ordenes_compra where (notas like 'DEMO%' or notas = 'Demostración')
      and not pg_temp.de_real('ordenes_compra', id::text, creado_por) having count(*) > 0
    union all select 'requisiciones ' || count(*) from requisiciones where notas like 'DEMO%' and not pg_temp.de_real('requisiciones', id::text, solicitante_id) having count(*) > 0
    union all select 'embarques ' || count(*) from embarques where notas like 'DEMO%' and not pg_temp.de_real('embarques', id::text, creado_por) having count(*) > 0
    union all select 'envios ' || count(*) from envios where notas like 'DEMO%' and not pg_temp.de_real('envios', id::text, solicitado_por) having count(*) > 0
    union all select 'servicios ' || count(*) from servicios where referencia like 'DEMO-SRV-%' and not pg_temp.de_real('servicios', id::text, solicitado_por) having count(*) > 0
    union all select 'publicaciones ' || count(*) from publicaciones where id_externo like 'DEMO-%' having count(*) > 0
    union all select 'tipos_cambio ' || count(*) from tipos_cambio where fuente = 'demo' having count(*) > 0
    union all select 'metas_anuales ' || count(*) from metas_anuales where notas like 'DEMO%' and (actualizado_por is null or actualizado_por in (select id from _usr_demo)) having count(*) > 0
    union all select 'reglas_familia_venta ' || count(*) from reglas_familia_venta where nota like 'DEMO%' and (creado_por is null or creado_por in (select id from _usr_demo)) having count(*) > 0
    union all select 'comision_ajustes ' || count(*) from comision_ajustes where concepto like '%(demo)' having count(*) > 0
    union all select 'comision_pagos ' || count(*) from comision_pagos where referencia like 'DEMO%' having count(*) > 0
    union all select 'recargas_paqueteria ' || count(*) from recargas_paqueteria where referencia like 'DEMO%' having count(*) > 0
    union all select 'puesto_asignaciones ' || count(*) from puesto_asignaciones where nota = 'DEMO' having count(*) > 0
  ) z;
  if v is not null then raise exception 'Quedaron registros de la demostración: %', v; end if;

  -- e) Nada creado por las cuentas de prueba, salvo lo que es real aunque haya entrado
  --    con ellas: los planos de Drive (ingeniería) y las correcciones de ubicación.
  for r in select c.table_name t, c.column_name col from information_schema.columns c
           join information_schema.tables x on x.table_schema = c.table_schema and x.table_name = c.table_name and x.table_type = 'BASE TABLE'
           where c.table_schema = 'public' and c.column_default like '%auth.uid()%'
             and c.table_name not in ('bitacora', 'asistente_uso', 'asistente_resumenes', 'geo_alias_ciudad', 'documentos_tecnicos') loop
    execute format('select count(*) from public.%I where %I in (select id from _usr_demo)', r.t, r.col) into n;
    if n > 0 then raise exception 'Quedaron % filas de %.% creadas por cuentas de prueba', n, r.t, r.col; end if;
  end loop;
  select count(*) into n from documentos_tecnicos d left join articulos a on a.id = d.articulo_id
  where d.creado_por in (select id from _usr_demo) and coalesce(a.legacy_id, '') !~ '^(LC|EQ|FALTA):';
  if n > 0 then raise exception 'Quedaron % documentos técnicos de cuentas de prueba que no son de artículos importados', n; end if;
  select string_agg(distinct a.tabla, ', ') into v from _alta a
  where a.quien = 'demo' and a.tabla not in ('geo_alias_ciudad')
    and exists (select 1 from _existen x where x.tabla = a.tabla and x.registro_id = a.registro_id);
  if v is not null then raise exception 'Quedaron registros que dio de alta una cuenta de prueba en: %', v; end if;

  -- f) Existencias = suma de movimientos, sin filas huérfanas; lo importado, como lo dejó la hoja.
  select count(*) into n from (
    select articulo_id, almacen_id, cantidad from existencias
    except select articulo_id, almacen_id, sum(cantidad) from movimientos_inventario group by 1, 2) z;
  if n > 0 then raise exception '% existencias no cuadran con sus movimientos', n; end if;
  select count(*) into n from (
    select articulo_id, almacen_id, sum(cantidad) from movimientos_inventario group by 1, 2
    except select articulo_id, almacen_id, cantidad from existencias) z;
  if n > 0 then raise exception '% combinaciones artículo-almacén con movimientos no tienen existencia', n; end if;
  select count(*) into n from movimientos_inventario m
  where not (m.tipo = 'inicial' and m.usuario_id is null)
    and (m.usuario_id is null or m.usuario_id not in (select id from _usr_real));
  if n > 0 then raise exception 'Quedaron % movimientos que no son de arranque ni de personas reales', n; end if;

  -- g) Costos: ningún artículo real con costo o historia puesto por una cuenta de prueba,
  --    y el recálculo no tuvo que tomar ninguna foto nueva (todo quedó como la importación).
  select count(*) into n from costos_articulo where actualizado_por in (select id from _usr_demo);
  if n > 0 then raise exception '% costos reales siguen con un cambio de una cuenta de prueba', n; end if;
  select count(*) into n from historial_costos where usuario_id in (select id from _usr_demo);
  if n > 0 then raise exception '% renglones de historial de costos siguen siendo de cuentas de prueba', n; end if;
  select count(*) into n from historial_costeo where id > (select ultimo from _antes_recalculo);
  if n > 0 then raise exception 'El recálculo dejó % fotos nuevas de costeo: algo no volvió a como lo dejó la importación', n; end if;
  select count(*) into n from articulos a
  join costos_calculados cc on cc.articulo_id = a.id
  left join precios_lista pl on pl.articulo_id = a.id
  join lateral (select h.costo_total, h.precio_lista from historial_costeo h where h.articulo_id = a.id
                order by h.en desc, h.id desc limit 1) u on true
  where u.costo_total is distinct from round(cc.costo_total, 4) or u.precio_lista is distinct from pl.precio;
  if n > 0 then raise exception '% artículos tienen costo o precio distinto a su última foto de costeo', n; end if;
  -- Sin personas reales en la base, después de la importación no puede haber fotos de costeo.
  if not exists (select 1 from _usr_real) then
    select count(*) into n from historial_costeo where not reconstruido and en > (select max(en) from importaciones);
    if n > 0 then raise exception 'Quedaron % fotos de costeo posteriores a la importación', n; end if;
  end if;

  -- h) El libro de ventas quedó clasificado con las reglas que quedan.
  select count(*) into n from historial_ventas_hoja where tipo = 'Venta' and familia is distinct from familia_venta_de(descripcion);
  if n > 0 then raise exception '% ventas del libro con familia distinta a la de sus reglas', n; end if;

  -- i) Ningún folio por debajo de uno que exista.
  for r in select f.serie, f.anio, f.ultimo, m.tabla from folios f
           join (values ('COT', 'cotizaciones'), ('PED', 'pedidos'), ('AJU', 'ajustes_inventario'), ('OC', 'ordenes_compra'),
                        ('REQ', 'requisiciones'), ('OP', 'ordenes_produccion'), ('EMB', 'embarques'), ('SRV', 'servicios'),
                        ('MTO', 'ordenes_mantenimiento'), ('ENV', 'envios'), ('DEV', 'devoluciones'), ('REC', 'devoluciones'),
                        ('CAN', 'devoluciones'), ('SP', 'solicitudes_precio')) m(serie, tabla) on m.serie = f.serie loop
    execute format('select coalesce(max((substring(folio from %L))::int), 0) from public.%I', '^' || r.serie || '-' || r.anio || '-(\d+)', r.tabla) into n;
    if n > r.ultimo then raise exception 'El folio % % quedó en % y ya existe el %', r.serie, r.anio, r.ultimo, n; end if;
  end loop;

  -- j) Los disparadores quedaron como estaban.
  select string_agg(d.tabla || '.' || d.nombre, ', ') into v from _disparadores d
  join pg_trigger t on t.tgrelid = d.tabla and t.tgname = d.nombre where t.tgenabled <> 'O';
  if v is not null then raise exception 'Quedaron apagados: %', v; end if;
end $$;

-- -----------------------------------------------------------------------------
-- 12. Resumen
-- -----------------------------------------------------------------------------
insert into _resumen
select 'tabla', tabla, antes, despues from _conteo where antes <> despues
union all select 'restaurado', 'costos de artículos reales (costeo de embarque DEMO)', null, count(*) from _costo_restaurar
union all select 'restaurado', 'medidas de empaque de artículos reales', null, count(*) from _empaque
union all select 'restaurado', 'teléfonos inventados de vendedores', null, count(*) from _telefonos
union all select 'restaurado', 'existencias recalculadas desde los movimientos', null, count(*) from existencias
-- Un borrador vacío de una persona real no se borra (es suyo), pero conviene saberlo.
union all select 'revisar', 'borradores de cotización vacíos de personas reales (se dejaron)', null, count(*)
from cotizaciones c where c.estado = 'borrador' and c.cliente_id is null
  and not exists (select 1 from cotizacion_lineas l where l.cotizacion_id = c.id) having count(*) > 0
union all select 'storage', o.bucket_id || '/' || o.name, null, null from storage.objects o
where (o.bucket_id = 'envios' and (
         (split_part(o.name, '/', 1) = 'envios' and not exists (select 1 from envios e where e.id::text = split_part(o.name, '/', 2)))
      or (split_part(o.name, '/', 1) = 'devoluciones' and not exists (select 1 from devoluciones d where d.id::text = split_part(o.name, '/', 2)))))
   or (o.bucket_id = 'importaciones' and not exists (select 1 from embarques e where e.id::text = split_part(o.name, '/', 1)))
   or (o.bucket_id = 'servicio' and (
         (split_part(o.name, '/', 1) = 'servicios' and not exists (select 1 from servicios s where s.id::text = split_part(o.name, '/', 2)))
      or (split_part(o.name, '/', 1) in ('mantenimiento', 'maquinas') and not exists (select 1 from maquinas m where m.id::text = split_part(o.name, '/', 2)))))
   or (o.bucket_id = 'solicitudes-precio' and not exists (select 1 from solicitudes_precio s where s.id::text = split_part(o.name, '/', 1)));

do $$
declare r record;
begin
  for r in select * from _resumen order by seccion, detalle loop
    raise notice '% · %: % → %', r.seccion, r.detalle, coalesce(r.antes::text, '-'), coalesce(r.despues::text, '-');
  end loop;
  if exists (select 1 from _resumen where seccion = 'storage') then
    raise notice 'Los archivos de "storage" quedaron sin registro: bórralos con la API de Storage o desde el panel.';
  end if;
end $$;

commit;

select seccion, detalle, antes, despues from _resumen order by seccion, detalle;

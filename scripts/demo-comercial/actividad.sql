-- =============================================================================
-- Que la demostración parezca una fábrica con semanas de uso, no algo armado ayer:
--   1. Los remolques vendidos en noviembre que siguen confirmados entran a producción (como lo
--      haría la gerencia con «Órdenes desde pedido»), y unas órdenes para stock: el Gantt se llena.
--   2. 45 días de uso del ERP por persona (pantallas, minutos y consultas a la IA), según su puesto:
--      el tablero de «Uso del ERP» tiene historia.
--
-- Va después de historial.sql (los pedidos de octubre y noviembre) y antes del maquillaje (firma
-- con las cuentas @hegamex.com de scripts/usuarios-locales.mjs). Determinista (setseed).
--   psql "$DB_URL" -v ON_ERROR_STOP=1 -f scripts/demo-comercial/actividad.sql
-- =============================================================================
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
-- Desde la 223 ninguna función se ejecuta sin permiso explícito, ni las temporales de este script.
grant execute on all functions in schema pg_temp to authenticated;

select setseed(0.2026);

-- ---------------------------------------------------------------------------
-- 1. Producción
-- ---------------------------------------------------------------------------
do $$
declare p record; a record; n int := 0; i int := 0; v_pedidos uuid[];
begin
  -- Cuáles, antes de entrar como la gerencia: ella no ve las partidas de venta (son de ventas).
  select array_agg(pe.id order by pe.fecha) into v_pedidos from public.pedidos pe
    where pe.estado = 'confirmado' and not pe.historico and pe.fecha >= date '2026-10-01'
      and exists (select 1 from public.pedido_lineas l join public.articulos x on x.id = l.articulo_id
                  where l.pedido_id = pe.id and x.tipo = 'equipo')
      and not exists (select 1 from public.ordenes_produccion o join public.pedido_lineas l on l.id = o.pedido_linea_id where l.pedido_id = pe.id);
  perform pg_temp.soy('gerente.produccion@hegamex.com');
  for i in 1 .. coalesce(array_length(v_pedidos, 1), 0) loop
    perform public.ordenes_desde_pedido(v_pedidos[i], true);
    n := n + 1;
  end loop;
  i := 0;
  -- Para stock: los remolques que más se venden, para entregar de inmediato.
  for a in
    select x.id from public.articulos x
    where x.tipo = 'equipo' and x.activo and exists (select 1 from public.bom_operaciones o where o.articulo_id = x.id)
      and x.clave in ('DEMO-E-301', 'DEMO-E-201', 'DEMO-E-102', 'DEMO-E-401', 'DEMO-E-101', 'DEMO-E-103')
    order by x.clave
  loop
    i := i + 1;
    perform public.crear_orden_produccion(a.id, 1, null, current_date + 14 + i * 6, 3, null);
  end loop;
  perform pg_temp.postgres();
  raise notice 'Producción: % pedidos a órdenes, % órdenes para stock', n, i;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Uso del ERP: por puesto, las pantallas de su día y cuánto las usa.
-- ---------------------------------------------------------------------------
create temp table _rutina (correo text, ruta text, peso numeric, sabado boolean) on commit drop;
insert into _rutina values
  ('direccion@hegamex.com', '/', 5, true), ('direccion@hegamex.com', '/analisis', 2, false),
  ('direccion@hegamex.com', '/finanzas/resultados', 1.5, false), ('direccion@hegamex.com', '/revision', 1.5, true),
  ('direccion@hegamex.com', '/produccion/gerencia', 1, false), ('direccion@hegamex.com', '/ventas/pedidos', 1, false),
  ('isaac@hegamex.com', '/ventas/oportunidades', 4, true), ('isaac@hegamex.com', '/ventas/cotizaciones', 4, true),
  ('isaac@hegamex.com', '/ventas/para-llamar', 3, false), ('isaac@hegamex.com', '/ventas/clientes', 2, false),
  ('isaac@hegamex.com', '/catalogo', 2, true), ('isaac@hegamex.com', '/ventas/pedidos', 1.5, false),
  ('juan@hegamex.com', '/ventas/oportunidades', 3, false), ('juan@hegamex.com', '/ventas/cotizaciones', 4, true),
  ('juan@hegamex.com', '/ventas/para-llamar', 2, false), ('juan@hegamex.com', '/catalogo', 3, true),
  ('juan@hegamex.com', '/ventas/clientes', 1.5, false),
  ('susana@hegamex.com', '/ventas/cotizaciones', 3, true), ('susana@hegamex.com', '/ventas/mercadolibre', 3, true),
  ('susana@hegamex.com', '/catalogo', 3, false), ('susana@hegamex.com', '/ventas/pedidos', 2, false),
  ('gerente.ventas@hegamex.com', '/ventas/oportunidades', 3, false), ('gerente.ventas@hegamex.com', '/ventas/cotizado', 2, false),
  ('gerente.ventas@hegamex.com', '/ventas/comisiones', 1, false), ('gerente.ventas@hegamex.com', '/ventas/coaching', 1.5, false),
  ('gerente.ventas@hegamex.com', '/ventas/leads', 2, true),
  ('ingenieria@hegamex.com', '/costeo/equipos', 5, false), ('ingenieria@hegamex.com', '/costeo/componentes', 3, false),
  ('ingenieria@hegamex.com', '/costeo/planos', 1.5, false), ('ingenieria@hegamex.com', '/produccion/ordenes', 1.5, false),
  ('compras@hegamex.com', '/compras/ordenes', 5, true), ('compras@hegamex.com', '/compras/solicitudes', 3, false),
  ('compras@hegamex.com', '/almacen/reabasto', 2.5, false), ('compras@hegamex.com', '/compras/proveedores', 1.5, false),
  ('almacen@hegamex.com', '/almacen/existencias', 5, true), ('almacen@hegamex.com', '/almacen/movimientos', 4, true),
  ('almacen@hegamex.com', '/almacen/envios', 3, true), ('almacen@hegamex.com', '/produccion/ordenes', 2, false),
  ('gerente.produccion@hegamex.com', '/produccion/gerencia', 5, true), ('gerente.produccion@hegamex.com', '/produccion/gantt', 3, false),
  ('gerente.produccion@hegamex.com', '/produccion/ordenes', 3, true), ('gerente.produccion@hegamex.com', '/produccion/cuadrillas', 2, false),
  ('taller@hegamex.com', '/produccion/terminal', 6, true), ('taller@hegamex.com', '/produccion/ordenes', 2, true),
  ('rrhh@hegamex.com', '/rrhh/empleados', 2, false), ('rrhh@hegamex.com', '/rrhh/incidencias', 3, false),
  ('rrhh@hegamex.com', '/rrhh/prenomina', 3, true), ('rrhh@hegamex.com', '/rrhh/objetivos', 1.5, false),
  ('finanzas@hegamex.com', '/finanzas/cobranza', 5, false), ('finanzas@hegamex.com', '/finanzas/pagos', 3, false),
  ('finanzas@hegamex.com', '/finanzas/caja-chica', 2, true), ('finanzas@hegamex.com', '/finanzas/resultados', 1, false),
  ('importaciones@hegamex.com', '/importaciones', 5, false), ('importaciones@hegamex.com', '/importaciones/dinero', 2, false),
  ('recepcion@hegamex.com', '/ventas/leads', 4, true), ('recepcion@hegamex.com', '/', 1, true),
  ('mantenimiento@hegamex.com', '/servicio', 3, true), ('mantenimiento@hegamex.com', '/servicio/maquinas', 2, false),
  ('marketing@hegamex.com', '/ventas/mercadolibre', 3, false), ('marketing@hegamex.com', '/catalogo', 2, false),
  ('procesos@hegamex.com', '/produccion/mejoras', 3, false), ('procesos@hegamex.com', '/produccion/metricas', 2, false),
  ('tv@hegamex.com', '/piso', 1, true);

-- Cuánto de su jornada vive cada quien en el ERP (los de oficina más que el taller).
create temp table _gente on commit drop as
select p.id, p.correo,
       case when p.correo like 'tv@%' then 540 when p.correo like 'taller@%' then 90 when p.correo like 'direccion@%' then 110
            when p.correo similar to '(isaac|juan|susana|compras|almacen|finanzas|gerente.produccion)@%' then 210 else 140 end minutos_dia,
       case when p.correo similar to '(rrhh|mantenimiento|marketing|procesos|importaciones)@%' then 0.82 else 0.95 end constancia
from public.perfiles p where p.correo like '%@hegamex.com' and p.correo not like 'sistemas@%';

insert into public.uso_diario (usuario_id, dia, ruta, vistas, minutos, primera, ultima)
select g.id, d.dia, r.ruta,
       greatest(1, round(r.peso * (2 + random() * 6)))::int,
       greatest(1, round(g.minutos_dia * r.peso / t.total * (0.6 + random() * 0.8)))::int,
       (d.dia + time '08:05' + (random() * 85) * interval '1 minute') at time zone 'America/Mexico_City',
       (d.dia + case when extract(dow from d.dia) = 6 then time '13:10' else time '17:20' end + (random() * 70) * interval '1 minute') at time zone 'America/Mexico_City'
from _gente g
join _rutina r on r.correo = g.correo
join (select correo, sum(peso) total from _rutina group by 1) t on t.correo = g.correo
cross join lateral (
  select x::date dia from generate_series(current_date - 45, current_date, interval '1 day') x
  where extract(dow from x) <> 0
) d
where (extract(dow from d.dia) <> 6 or r.sabado)
  -- Un día cualquiera alguien falta o no abre cierta pantalla; la gente de más uso va subiendo.
  and random() < g.constancia * (0.55 + 0.45 * (1 - (current_date - d.dia) / 60.0))
on conflict (usuario_id, dia, ruta) do nothing;

-- Consultas a la IA: los de oficina le preguntan unas cuantas veces al día.
insert into public.asistente_uso (usuario_id, modo, area, modelo, entrada_tokens, salida_tokens, cache_tokens, herramientas, en)
select g.id, (array['chat', 'chat', 'chat', 'resumen', 'mensaje_seguimiento'])[1 + floor(random() * 5)::int],
       null, (select valor->>'modelo' from public.configuracion where clave = 'asistente'),
       (9000 + random() * 22000)::int, (300 + random() * 1500)::int, (6000 + random() * 15000)::int,
       array['consultar'],
       (d.dia + time '09:00' + (random() * 480) * interval '1 minute') at time zone 'America/Mexico_City'
from _gente g
cross join lateral (
  select x::date dia from generate_series(current_date - 45, current_date - 1, interval '1 day') x where extract(dow from x) between 1 and 5
) d
cross join lateral generate_series(1, case when g.correo similar to '(direccion|isaac|juan|susana|gerente.ventas|compras|finanzas)@%' then 3 else 1 end) k
where g.correo not similar to '(tv|taller)@%' and random() < 0.45;

-- La bitácora: todo lo que hicieron los scripts quedó con la hora de la carga, y «Cambios por día»
-- era una sola barra hoy. Se reparte en las últimas semanas, en horario de oficina (lo más
-- reciente pesa más), dejando lo de hoy en hoy.
set local session_replication_role = replica;
update public.bitacora set en =
  ((current_date - (1 + floor(power(random(), 1.4) * 40))::int) + time '08:30' + (random() * 560) * interval '1 minute')
    at time zone 'America/Mexico_City'
where en > now() - interval '6 hours' and random() < 0.9;
update public.bitacora set en = en + interval '1 day' where extract(dow from en at time zone 'America/Mexico_City') = 0;
set local session_replication_role = origin;

do $$
begin
  raise notice 'Uso: % renglones en % días; % consultas a la IA',
    (select count(*) from public.uso_diario), (select count(distinct dia) from public.uso_diario), (select count(*) from public.asistente_uso);
end $$;

commit;

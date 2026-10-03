-- Taller "vivo" para ver y fotografiar las pantallas de producción en la base LOCAL.
--
--   psql "$DB_URL" -f scripts/demo/produccion.sql                  crea las órdenes (si no existen)
--   psql "$DB_URL" -v limpiar=1 -f scripts/demo/produccion.sql     las cancela (para volver a crearlas)
--
-- Todo pasa por las funciones de la base y con el usuario que lo haría de verdad
-- (gerente, ingeniería, almacén, supervisor de taller), igual que las pruebas:
-- así la demostración también prueba los permisos. Las fechas de los eventos se
-- recorren al pasado para que la línea de tiempo y la TV parezcan un taller con
-- semanas de trabajo, no algo que pasó todo en el mismo segundo.
--
-- Usa los equipos reales del catálogo si ya se importaron (la bazuca del pedido
-- 786, la Zar 4T, el Thor 36…); si no, crea equipos DEMO- con su lista y horas.
-- Las órdenes se reconocen por sus notas ("DEMO · …") y los clientes por "DEMO ".
-- Los movimientos de inventario no se borran (así es el sistema): limpiar
-- cancela las órdenes, lo que suelta sus reservas y sus requisiciones.
\set ON_ERROR_STOP on

\if :{?limpiar}
begin;
-- También las que se crearon desde la pantalla con los pedidos DEMO-… (esas no llevan la nota).
update public.ordenes_produccion set estado = 'cancelada', cancelada_en = now(),
  motivo_cancelacion = 'Limpieza de la demostración', numero_serie = null
where (notas like 'DEMO%' or pedido_id in (select id from public.pedidos where folio like 'DEMO-%')) and estado <> 'cancelada';
update public.requisicion_lineas l set estado = 'cancelada'
from public.ordenes_produccion o where o.id = l.orden_produccion_id and o.motivo_cancelacion = 'Limpieza de la demostración'
  and l.estado = 'pendiente';
update public.pedidos set estado = 'cancelado', motivo_cancelacion = 'Limpieza de la demostración'
where folio like 'DEMO-%' and estado not in ('cancelado', 'entregado');
commit;
\echo 'Órdenes DEMO canceladas.'
\quit
\endif

begin;

-- Actuar como un usuario local (scripts/usuarios-locales.mjs) o volver a postgres.
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

-- Lo que pasó desde la última marca, ocurrió hace p_hace. Devuelve la nueva marca.
-- Lo de días atrás cae en horario de taller (8:30 a 16:30 de Guadalajara), no a la hora en que se corre esto.
create or replace function pg_temp.fechar(p_desde bigint, p_hace interval) returns bigint language plpgsql as $$
declare v bigint; v_en timestamptz;
begin
  perform pg_temp.postgres();
  v_en := case when p_hace < interval '1 day' then now() - p_hace
               else (((now() - p_hace) at time zone 'America/Mexico_City')::date + time '08:30'
                     + (p_desde % 97) * interval '5 minutes') at time zone 'America/Mexico_City' end;
  update public.op_eventos set en = v_en where id > p_desde;
  select coalesce(max(id), 0) into v from public.op_eventos;
  return v;
end $$;

create or replace function pg_temp.marca() returns bigint language sql as $$
  select coalesce(max(id), 0) from public.op_eventos
$$;

-- Equipo real por clave (o por nombre); si no hay catálogo, uno DEMO- con lista y horas.
create or replace function pg_temp.equipo(p_clave text, p_nombre text, p_horas jsonb) returns uuid language plpgsql as $$
declare v uuid; v_demo text := 'DEMO-' || p_clave; k text; h numeric; i int := 0; c record;
begin
  select id into v from public.articulos a where (a.clave = p_clave or a.nombre = p_nombre) and a.tipo = 'equipo'
    and exists (select 1 from public.bom_lineas b where b.padre_id = a.id)
  order by (a.clave = p_clave) desc limit 1;
  if v is not null then return v; end if;
  select id into v from public.articulos where clave = v_demo;
  if v is not null then return v; end if;

  -- Componentes de demostración (una sola vez) con su existencia inicial en Planta Baja.
  insert into public.articulos (clave, tipo, nombre, unidad) values
    ('DEMO-C-TUBO2', 'materia_prima', 'Tubo 2" ced. 40 (demo)', 'metro'),
    ('DEMO-C-LAM10', 'materia_prima', 'Lámina calibre 10 4x10 (demo)', 'pieza'),
    ('DEMO-C-PTR', 'materia_prima', 'PTR 2x2 cal. 11 (demo)', 'pieza'),
    ('DEMO-C-CHUM', 'componente', 'Chumacera 2" 4B pared (demo)', 'pieza'),
    ('DEMO-C-MOT', 'componente', 'Motorreductor 5 HP (demo)', 'pieza'),
    ('DEMO-C-TORN', 'componente', 'Tornillo 5/8 x 3" (demo)', 'pieza'),
    ('DEMO-C-PINT', 'componente', 'Esmalte azul Hegamex (demo)', 'litro')
  on conflict (clave) do nothing;
  insert into public.movimientos_inventario (tipo, articulo_id, almacen_id, cantidad, motivo)
  select 'inicial', a.id, (select id from public.almacenes where nombre = 'Planta Baja'), x.c, 'Demostración'
  from (values ('DEMO-C-TUBO2', 18), ('DEMO-C-LAM10', 12), ('DEMO-C-PTR', 30), ('DEMO-C-CHUM', 10),
               ('DEMO-C-MOT', 2), ('DEMO-C-TORN', 200), ('DEMO-C-PINT', 40)) x(k, c)
  join public.articulos a on a.clave = x.k
  where not exists (select 1 from public.movimientos_inventario m where m.articulo_id = a.id);

  insert into public.articulos (clave, tipo, nombre) values (v_demo, 'equipo', p_nombre) returning id into v;
  for c in select id, row_number() over (order by clave) n from public.articulos where clave like 'DEMO-C-%' loop
    insert into public.bom_lineas (padre_id, hijo_id, cantidad) values (v, c.id, (c.n % 4) * 2 + 2);
  end loop;
  for k, h in select key, value::numeric from jsonb_each_text(p_horas) loop
    insert into public.bom_operaciones (articulo_id, etapa_id, horas) values (v, (select id from public.etapas where nombre = k), h);
  end loop;
  return v;
end $$;

create or replace function pg_temp.cliente(p_nombre text, p_ciudad text) returns uuid language plpgsql as $$
declare v uuid;
begin
  select id into v from public.clientes where nombre = p_nombre;
  if v is null then
    insert into public.clientes (nombre, ciudad, estado, vendedor_id)
    values (p_nombre, p_ciudad, 'Jalisco', (select id from public.perfiles where correo = 'isaac@hegamex.com')) returning id into v;
  end if;
  return v;
end $$;

-- Pedido confirmado con sus partidas [{equipo, cantidad}], al precio de lista.
create or replace function pg_temp.pedido(p_folio text, p_cliente uuid, p_vendedor text, p_dias_compromiso int, p_hace int, p_partidas jsonb)
returns uuid language plpgsql as $$
declare v uuid; x jsonb; n int := 0;
begin
  insert into public.pedidos (folio, cliente_id, vendedor_id, fecha, fecha_compromiso)
  values (p_folio, p_cliente, (select id from public.perfiles where correo = p_vendedor), current_date - p_hace, current_date + p_dias_compromiso)
  returning id into v;
  for x in select * from jsonb_array_elements(p_partidas) loop
    n := n + 1;
    insert into public.pedido_lineas (pedido_id, orden, articulo_id, titulo, cantidad, precio_unitario)
    select v, n, a.id, a.nombre, (x->>'cantidad')::numeric, coalesce(pl.precio, 0)
    from public.articulos a left join public.precios_lista pl on pl.articulo_id = a.id where a.id = (x->>'equipo')::uuid;
  end loop;
  return v;
end $$;

create or replace function pg_temp.etapa(p_op uuid, p_etapa text) returns uuid language sql as $$
  select x.id from public.op_operaciones x join public.etapas e on e.id = x.etapa_id where x.orden_id = p_op and e.nombre = p_etapa
$$;

-- Almacén surte lo apartado (una fracción), cada partida del almacén que más tiene.
create or replace function pg_temp.surtir_apartado(p_op uuid, p_fraccion numeric, p_extra jsonb default '[]') returns void language plpgsql as $$
declare v jsonb;
begin
  perform pg_temp.soy('almacen@hegamex.com');
  select coalesce(jsonb_agg(jsonb_build_object('articulo_id', m.articulo_id, 'almacen_id', al.almacen_id,
           'cantidad', least(case when m.unidad in ('pieza', 'juego', 'par') then floor(m.apartado * p_fraccion)
                                  else round(m.apartado * p_fraccion, 3) end, al.cantidad))), '[]')
    into v
  from public.v_op_material m
  cross join lateral (select e.almacen_id, e.cantidad from public.existencias e join public.almacenes a on a.id = e.almacen_id
                      where e.articulo_id = m.articulo_id and a.disponible_para_planta and e.cantidad > 0
                      order by e.cantidad desc limit 1) al
  where m.orden_id = p_op and m.apartado > 0;
  if jsonb_array_length(v || p_extra) > 0 then perform public.surtir_material(p_op, v || p_extra); end if;
end $$;

do $$
declare
  v_m bigint;
  v_baz uuid; v_zar uuid; v_tolva uuid; v_pedestal uuid; v_cargadora uuid; v_silo uuid; v_v3 uuid; v_artesa uuid;
  v_rompe uuid; v_zeus uuid; v_elevador uuid; v_sin_lista uuid; v_torn uuid;
  p786 uuid; p792 uuid; p793 uuid; p795 uuid; p796 uuid; p790 uuid;
  op1 uuid; op2 uuid; op_zar uuid; op_tolva uuid; op_ped uuid; op_carg uuid; op_silo uuid; op_v3 uuid; op_art uuid;
  op_rompe uuid; op_zeus uuid;
begin
  if exists (select 1 from public.ordenes_produccion where notas like 'DEMO%' and estado <> 'cancelada') then
    raise notice 'Ya hay órdenes DEMO; no se crea nada. Para empezar de nuevo: psql -v limpiar=1 -f scripts/demo/produccion.sql';
    return;
  end if;
  -- Folios de pedido DEMO de una corrida anterior (cancelada): se les cambia el folio para reutilizarlos.
  update public.pedidos set folio = folio || '-' || to_char(now(), 'HH24MISS') where folio like 'DEMO-%' and estado = 'cancelado'
    and folio !~ '-\d{6}$';

  -- Equipos: los del análisis de la hoja de validación (pedidos 786 a 797).
  v_baz := pg_temp.equipo('E-395', 'Transportador helicoidal tipo bazuca de 10" x 12 S/C S/M', '{"Pailería":150,"Torno":4,"Pintura":14,"Detallado":6}');
  v_zar := pg_temp.equipo('E-125', 'Cribadora Zar 4T con turbina', '{"Pailería":220,"Torno":28,"Pintura":28,"Detallado":30}');
  v_tolva := pg_temp.equipo('E-187', 'Tolva para envasadora de 5 metros cúbicos', '{"Pailería":120,"Pintura":18,"Detallado":15}');
  v_pedestal := pg_temp.equipo('E-303', 'Banda pedestal de 2.5 metros para cabezal - Hegamex®', '{"Pailería":160,"Torno":24,"Pintura":24,"Detallado":20}');
  v_cargadora := pg_temp.equipo('E-215', 'Banda cargadora de 18" x 6.60 metros con levante electrónico', '{"Pailería":230,"Torno":28,"Pintura":24,"Detallado":25}');
  v_silo := pg_temp.equipo('E-069', 'Silo móvil THOR 36 con pesaje, colector, válvula, suspensión y frenos', '{"Pailería":800,"Torno":80,"Pintura":210,"Detallado":220}');
  v_v3 := pg_temp.equipo('E-123', 'Cribadora V3 con turbina bifásica', '{"Pailería":275,"Torno":22,"Pintura":33,"Detallado":30}');
  v_artesa := pg_temp.equipo('E-208', 'Banda transportadora tipo artesa de 20" x 5.0 metros', '{"Pailería":115,"Torno":8,"Pintura":16,"Detallado":15}');
  v_rompe := pg_temp.equipo('E-471', 'Transportador helicoidal tipo bazuca rompesacos 8" x 8 metros con manga y 2 registros', '{"Pailería":195,"Torno":16,"Pintura":22,"Detallado":24}');
  v_zeus := pg_temp.equipo('E-369', 'Dosificadora ZEUS 30 con 2 tolvas móvil suspensión de aire, frenos', '{"Pailería":970,"Torno":90,"Pintura":210,"Detallado":270}');
  v_elevador := pg_temp.equipo('E-393', 'Elevador de 2.8 metros de 4" x 5" para zaranda', '{"Pailería":160,"Torno":14,"Pintura":16,"Detallado":38}');
  -- Un equipo vendido que ingeniería no ha capturado: "Crear órdenes" debe avisar, no fallar callado.
  select id into v_sin_lista from public.articulos a where a.tipo = 'equipo' and a.activo
    and not exists (select 1 from public.bom_lineas b where b.padre_id = a.id) order by clave limit 1;
  if v_sin_lista is null then
    insert into public.articulos (clave, tipo, nombre) values ('DEMO-E-TREN4', 'equipo', 'Tren de 4 tolvas provisional (demo)')
    on conflict (clave) do update set nombre = excluded.nombre returning id into v_sin_lista;
  end if;
  select id into v_torn from public.articulos where nombre = 'Tornillo 3/8 x 1"' and tipo in ('componente', 'materia_prima') limit 1;

  -- Pedidos (como los capturaría ventas).
  p786 := pg_temp.pedido('DEMO-786', pg_temp.cliente('DEMO Agrícola El Salto', 'El Salto'), 'isaac@hegamex.com', -10, 30,
                         jsonb_build_array(jsonb_build_object('equipo', v_baz, 'cantidad', 2)));
  p790 := pg_temp.pedido('DEMO-790', pg_temp.cliente('DEMO Concretos Atotonilco', 'Atotonilco el Alto'), 'juan@hegamex.com', -1, 45,
                         jsonb_build_array(jsonb_build_object('equipo', v_zeus, 'cantidad', 1)));
  p792 := pg_temp.pedido('DEMO-792', pg_temp.cliente('DEMO Alimentos La Huerta', 'Zapopan'), 'isaac@hegamex.com', 2, 14,
                         jsonb_build_array(jsonb_build_object('equipo', v_tolva, 'cantidad', 1), jsonb_build_object('equipo', v_pedestal, 'cantidad', 1),
                                           jsonb_build_object('equipo', v_cargadora, 'cantidad', 1)));
  p793 := pg_temp.pedido('DEMO-793', pg_temp.cliente('DEMO Granos San Isidro', 'Tepatitlán'), 'juan@hegamex.com', 31, 16,
                         jsonb_build_array(jsonb_build_object('equipo', v_zar, 'cantidad', 1)));
  p795 := pg_temp.pedido('DEMO-795', pg_temp.cliente('DEMO Forrajes del Norte', 'Lagos de Moreno'), 'isaac@hegamex.com', 60, 2,
                         jsonb_build_array(jsonb_build_object('equipo', v_silo, 'cantidad', 1)));
  p796 := pg_temp.pedido('DEMO-796', pg_temp.cliente('DEMO Molinos Tepa', 'Tepatitlán'), 'juan@hegamex.com', 6, 7,
                         jsonb_build_array(jsonb_build_object('equipo', v_rompe, 'cantidad', 1)));
  -- Confirmado y sin órdenes todavía: lo que el gerente ve en "Crear órdenes desde pedido".
  perform pg_temp.pedido('DEMO-797', pg_temp.cliente('DEMO Forrajes del Norte', 'Lagos de Moreno'), 'isaac@hegamex.com', 45, 1,
                         jsonb_build_array(jsonb_build_object('equipo', v_elevador, 'cantidad', 2), jsonb_build_object('equipo', v_sin_lista, 'cantidad', 1)));

  -- ===== Órdenes, de la más vieja a la más nueva (el orden importa: la primera en apartar se lleva el material).
  -- Zeus 30: lleva 40 días, atrasada un día, pailería en proceso.
  v_m := pg_temp.marca();
  perform pg_temp.soy('gerente.produccion@hegamex.com');
  perform public.ordenes_desde_pedido(p790);
  select id into op_zeus from public.ordenes_produccion where pedido_id = p790;
  v_m := pg_temp.fechar(v_m, '40 days');
  update public.ordenes_produccion set numero_serie = 'DEMO-3AAMBACE7TMMJA042', notas = 'DEMO · Cable 3x10: son 16 m, no 12' where id = op_zeus;
  perform pg_temp.soy('ingenieria@hegamex.com');
  perform public.revisar_orden(op_zeus, 'ingenieria');
  perform pg_temp.soy('gerente.produccion@hegamex.com');
  perform public.apartar_material(op_zeus);
  perform public.pedir_faltantes(op_zeus);
  v_m := pg_temp.fechar(v_m, '39 days');
  perform pg_temp.soy('almacen@hegamex.com');
  perform public.revisar_orden(op_zeus, 'almacen');
  perform pg_temp.soy('gerente.produccion@hegamex.com');
  perform public.liberar_orden(op_zeus);
  v_m := pg_temp.fechar(v_m, '38 days');
  perform pg_temp.soy('taller@hegamex.com');
  perform public.avanzar_operacion(pg_temp.etapa(op_zeus, 'Pailería'), 'inicio', null, 'Héctor Medina');
  v_m := pg_temp.fechar(v_m, '35 days');
  perform pg_temp.soy('taller@hegamex.com');
  perform public.avanzar_operacion(pg_temp.etapa(op_zeus, 'Torno'), 'inicio', null, 'Mario Íñiguez');
  v_m := pg_temp.fechar(v_m, '30 days');
  perform pg_temp.soy('taller@hegamex.com');
  perform public.avanzar_operacion(pg_temp.etapa(op_zeus, 'Torno'), 'fin');
  v_m := pg_temp.fechar(v_m, '24 days');

  -- Pedido 786: las dos bazucas que se pelean el tubo de 2" (18 m en existencia, 12 m cada una).
  perform pg_temp.soy('gerente.produccion@hegamex.com');
  perform public.ordenes_desde_pedido(p786);
  select id into op1 from public.ordenes_produccion where pedido_id = p786 order by folio limit 1;
  select id into op2 from public.ordenes_produccion where pedido_id = p786 order by folio desc limit 1;
  v_m := pg_temp.fechar(v_m, '25 days');
  update public.ordenes_produccion set numero_serie = 'DEMO-BH1012000N345', notas = 'DEMO · Pedido 786, unidad 1 de 2' where id = op1;
  update public.ordenes_produccion set numero_serie = 'DEMO-BH1012000N346', notas = 'DEMO · Pedido 786, unidad 2 de 2' where id = op2;
  perform pg_temp.soy('ingenieria@hegamex.com');
  perform public.revisar_orden(op1, 'ingenieria');
  perform public.revisar_orden(op2, 'ingenieria');
  perform pg_temp.soy('gerente.produccion@hegamex.com');
  perform public.apartar_material(op1);
  perform public.apartar_material(op2);
  perform public.pedir_faltantes(op1);
  perform public.pedir_faltantes(op2);
  v_m := pg_temp.fechar(v_m, '24 days');
  perform pg_temp.soy('almacen@hegamex.com');
  perform public.revisar_orden(op1, 'almacen');
  perform public.revisar_orden(op2, 'almacen');
  perform pg_temp.soy('gerente.produccion@hegamex.com');
  perform public.liberar_orden(op1);
  v_m := pg_temp.fechar(v_m, '23 days');
  -- Surtido parcial: 3 de 4 chumaceras, y tornillería que no venía en la lista (como pasó con el P786).
  perform pg_temp.surtir_apartado(op1, 0.75, coalesce((
    select jsonb_build_array(jsonb_build_object('articulo_id', v_torn, 'cantidad', least(8, e.cantidad), 'almacen_id', e.almacen_id,
                                                'motivo', 'Tornillería para guardas (no venía en la lista)'))
    from public.existencias e join public.almacenes a on a.id = e.almacen_id
    where e.articulo_id = v_torn and a.disponible_para_planta and e.cantidad >= 1 order by e.cantidad desc limit 1), '[]'::jsonb));
  v_m := pg_temp.fechar(v_m, '22 days');
  perform pg_temp.soy('taller@hegamex.com');
  perform public.avanzar_operacion(pg_temp.etapa(op1, 'Torno'), 'inicio', null, 'Mario Íñiguez');
  v_m := pg_temp.fechar(v_m, '21 days');
  perform pg_temp.soy('taller@hegamex.com');
  perform public.avanzar_operacion(pg_temp.etapa(op1, 'Torno'), 'fin');
  perform public.avanzar_operacion(pg_temp.etapa(op1, 'Pailería'), 'inicio', null, 'Leonardo Carranza');
  v_m := pg_temp.fechar(v_m, '20 days');
  perform pg_temp.soy('gerente.produccion@hegamex.com');
  perform public.editar_orden(op1, p_prioridad => 1);
  v_m := pg_temp.fechar(v_m, '9 days');
  perform pg_temp.soy('gerente.produccion@hegamex.com');
  perform public.liberar_orden(op2);
  v_m := pg_temp.fechar(v_m, '2 days');

  -- V3 para stock (el S131): pailería y torno terminados, pintura en proceso.
  perform pg_temp.soy('gerente.produccion@hegamex.com');
  op_v3 := public.crear_orden_produccion(v_v3, 1, null, current_date + 9, 2, 'DEMO-CV0200N155');
  update public.ordenes_produccion set notas = 'DEMO · Para stock (S131)' where id = op_v3;
  v_m := pg_temp.fechar(v_m, '20 days');
  perform pg_temp.soy('ingenieria@hegamex.com');
  perform public.revisar_orden(op_v3, 'ingenieria');
  perform pg_temp.soy('almacen@hegamex.com');
  perform public.apartar_material(op_v3);
  perform public.revisar_orden(op_v3, 'almacen');
  v_m := pg_temp.fechar(v_m, '19 days');
  perform pg_temp.soy('gerente.produccion@hegamex.com');
  perform public.liberar_orden(op_v3);
  v_m := pg_temp.fechar(v_m, '18 days');
  perform pg_temp.surtir_apartado(op_v3, 1);
  perform pg_temp.soy('taller@hegamex.com');
  perform public.avanzar_operacion(pg_temp.etapa(op_v3, 'Pailería'), 'inicio', null, 'Leonardo Carranza');
  v_m := pg_temp.fechar(v_m, '17 days');
  perform pg_temp.soy('taller@hegamex.com');
  perform public.avanzar_operacion(pg_temp.etapa(op_v3, 'Torno'), 'inicio', null, 'Mario Íñiguez');
  v_m := pg_temp.fechar(v_m, '10 days');
  perform pg_temp.soy('taller@hegamex.com');
  perform public.avanzar_operacion(pg_temp.etapa(op_v3, 'Torno'), 'fin');
  v_m := pg_temp.fechar(v_m, '8 days');
  perform pg_temp.soy('taller@hegamex.com');
  perform public.avanzar_operacion(pg_temp.etapa(op_v3, 'Pailería'), 'fin');
  v_m := pg_temp.fechar(v_m, '6 days');
  perform pg_temp.soy('taller@hegamex.com');
  perform public.avanzar_operacion(pg_temp.etapa(op_v3, 'Pintura'), 'inicio', null, 'Luis Navarro');
  v_m := pg_temp.fechar(v_m, '4 hours');

  -- Banda artesa para stock: terminada hace dos días (cuenta en "terminadas este mes").
  perform pg_temp.soy('gerente.produccion@hegamex.com');
  op_art := public.crear_orden_produccion(v_artesa, 1, null, current_date + 3, 2, 'DEMO-TA20050281');
  update public.ordenes_produccion set notas = 'DEMO · Para stock' where id = op_art;
  v_m := pg_temp.fechar(v_m, '18 days');
  perform pg_temp.soy('ingenieria@hegamex.com');
  perform public.revisar_orden(op_art, 'ingenieria');
  perform pg_temp.soy('almacen@hegamex.com');
  perform public.apartar_material(op_art);
  perform public.revisar_orden(op_art, 'almacen');
  perform pg_temp.soy('gerente.produccion@hegamex.com');
  perform public.liberar_orden(op_art);
  v_m := pg_temp.fechar(v_m, '17 days');
  perform pg_temp.surtir_apartado(op_art, 1);
  perform pg_temp.soy('taller@hegamex.com');
  perform public.avanzar_operacion(pg_temp.etapa(op_art, 'Pailería'), 'inicio', null, 'Ramón Gutiérrez');
  v_m := pg_temp.fechar(v_m, '15 days');
  perform pg_temp.soy('taller@hegamex.com');
  perform public.avanzar_operacion(pg_temp.etapa(op_art, 'Torno'), 'inicio', null, 'Mario Íñiguez');
  v_m := pg_temp.fechar(v_m, '9 days');
  perform pg_temp.soy('taller@hegamex.com');
  perform public.avanzar_operacion(pg_temp.etapa(op_art, 'Torno'), 'fin');
  perform public.avanzar_operacion(pg_temp.etapa(op_art, 'Pailería'), 'fin');
  v_m := pg_temp.fechar(v_m, '7 days');
  perform pg_temp.soy('taller@hegamex.com');
  perform public.avanzar_operacion(pg_temp.etapa(op_art, 'Pintura'), 'inicio', null, 'Luis Navarro');
  v_m := pg_temp.fechar(v_m, '5 days');
  perform pg_temp.soy('taller@hegamex.com');
  perform public.avanzar_operacion(pg_temp.etapa(op_art, 'Pintura'), 'fin');
  perform public.avanzar_operacion(pg_temp.etapa(op_art, 'Detallado'), 'inicio', null, 'Pedro Sánchez');
  v_m := pg_temp.fechar(v_m, '3 days');
  perform pg_temp.soy('taller@hegamex.com');
  perform public.avanzar_operacion(pg_temp.etapa(op_art, 'Detallado'), 'fin');
  v_m := pg_temp.fechar(v_m, '1 day');

  -- Zar 4T (P793): pailería y torno al mismo tiempo.
  perform pg_temp.soy('gerente.produccion@hegamex.com');
  perform public.ordenes_desde_pedido(p793);
  select id into op_zar from public.ordenes_produccion where pedido_id = p793;
  v_m := pg_temp.fechar(v_m, '15 days');
  update public.ordenes_produccion set numero_serie = 'DEMO-CZ0202VT158',
    notas = 'DEMO · Bifásico: motor de fierro vaciado a 2F; el variador entra en 2F y sale en 3F' where id = op_zar;
  perform pg_temp.soy('ingenieria@hegamex.com');
  perform public.revisar_orden(op_zar, 'ingenieria');
  perform pg_temp.soy('gerente.produccion@hegamex.com');
  perform public.apartar_material(op_zar);
  perform public.pedir_faltantes(op_zar);
  v_m := pg_temp.fechar(v_m, '14 days');
  perform pg_temp.soy('almacen@hegamex.com');
  perform public.revisar_orden(op_zar, 'almacen');
  perform pg_temp.soy('gerente.produccion@hegamex.com');
  perform public.liberar_orden(op_zar);
  v_m := pg_temp.fechar(v_m, '12 days');
  perform pg_temp.soy('taller@hegamex.com');
  perform public.avanzar_operacion(pg_temp.etapa(op_zar, 'Pailería'), 'inicio', null, 'Juan Carranza');
  v_m := pg_temp.fechar(v_m, '10 days');
  perform pg_temp.soy('taller@hegamex.com');
  perform public.avanzar_operacion(pg_temp.etapa(op_zar, 'Torno'), 'inicio', null, 'Mario Íñiguez');
  v_m := pg_temp.fechar(v_m, '26 hours');

  -- Pedido 792: tolva (pausada por falta de lámina), banda pedestal (en pintura) y banda cargadora (planeada).
  perform pg_temp.soy('gerente.produccion@hegamex.com');
  perform public.ordenes_desde_pedido(p792);
  select id into op_tolva from public.ordenes_produccion where pedido_id = p792 and articulo_id = v_tolva;
  select id into op_ped from public.ordenes_produccion where pedido_id = p792 and articulo_id = v_pedestal;
  select id into op_carg from public.ordenes_produccion where pedido_id = p792 and articulo_id = v_cargadora;
  v_m := pg_temp.fechar(v_m, '12 days');
  update public.ordenes_produccion set numero_serie = 'DEMO-TC05B069', notas = 'DEMO · Lleva envasadora electrónica a prueba de polvos en acero al carbón' where id = op_tolva;
  update public.ordenes_produccion set numero_serie = 'DEMO-TP12020163E257', notas = 'DEMO · Lleva cabezal cosedor F900A' where id = op_ped;
  update public.ordenes_produccion set numero_serie = 'DEMO-TB18060275E258', notas = 'DEMO · Pedido 792' where id = op_carg;
  perform pg_temp.soy('ingenieria@hegamex.com');
  perform public.revisar_orden(op_tolva, 'ingenieria');
  perform public.revisar_orden(op_ped, 'ingenieria');
  perform pg_temp.soy('gerente.produccion@hegamex.com');
  perform public.apartar_material(op_tolva);
  perform public.apartar_material(op_ped);
  perform public.pedir_faltantes(op_tolva);
  v_m := pg_temp.fechar(v_m, '11 days');
  perform pg_temp.soy('almacen@hegamex.com');
  perform public.revisar_orden(op_tolva, 'almacen');
  perform public.revisar_orden(op_ped, 'almacen');
  v_m := pg_temp.fechar(v_m, '10 days');
  perform pg_temp.soy('gerente.produccion@hegamex.com');
  perform public.liberar_orden(op_tolva);
  perform public.liberar_orden(op_ped);
  v_m := pg_temp.fechar(v_m, '9 days');
  perform pg_temp.soy('taller@hegamex.com');
  perform public.avanzar_operacion(pg_temp.etapa(op_ped, 'Pailería'), 'inicio', null, 'Ramón Gutiérrez');
  v_m := pg_temp.fechar(v_m, '8 days');
  perform pg_temp.soy('taller@hegamex.com');
  perform public.avanzar_operacion(pg_temp.etapa(op_tolva, 'Pailería'), 'inicio', null, 'Ramón Gutiérrez');
  v_m := pg_temp.fechar(v_m, '7 days');
  perform pg_temp.soy('taller@hegamex.com');
  perform public.avanzar_operacion(pg_temp.etapa(op_ped, 'Torno'), 'inicio', null, 'Mario Íñiguez');
  v_m := pg_temp.fechar(v_m, '6 days');
  perform pg_temp.soy('taller@hegamex.com');
  perform public.avanzar_operacion(pg_temp.etapa(op_ped, 'Torno'), 'fin');
  v_m := pg_temp.fechar(v_m, '5 days');
  perform pg_temp.soy('taller@hegamex.com');
  perform public.avanzar_operacion(pg_temp.etapa(op_ped, 'Pailería'), 'fin');
  v_m := pg_temp.fechar(v_m, '3 days');
  perform pg_temp.soy('ingenieria@hegamex.com');
  perform public.revisar_orden(op_carg, 'ingenieria');
  perform pg_temp.soy('gerente.produccion@hegamex.com');
  perform public.apartar_material(op_carg);
  perform public.editar_orden(op_carg, p_fecha_compromiso => current_date + 39);
  v_m := pg_temp.fechar(v_m, '3 days');
  perform pg_temp.soy('taller@hegamex.com');
  perform public.avanzar_operacion(pg_temp.etapa(op_tolva, 'Pailería'), 'problema',
    'Falta lámina cal. 10 para el cono; compras dice que llega el lunes', 'Ramón Gutiérrez');
  perform public.avanzar_operacion(pg_temp.etapa(op_tolva, 'Pailería'), 'pausa');
  v_m := pg_temp.fechar(v_m, '50 minutes');
  perform pg_temp.soy('taller@hegamex.com');
  perform public.avanzar_operacion(pg_temp.etapa(op_ped, 'Pintura'), 'inicio', null, 'Luis Navarro');
  v_m := pg_temp.fechar(v_m, '2 hours');

  -- Rompesacos (P796): urgente, liberada ayer, nadie la ha empezado.
  perform pg_temp.soy('gerente.produccion@hegamex.com');
  perform public.ordenes_desde_pedido(p796);
  select id into op_rompe from public.ordenes_produccion where pedido_id = p796;
  v_m := pg_temp.fechar(v_m, '6 days');
  update public.ordenes_produccion set numero_serie = 'DEMO-BH080810ET347', notas = 'DEMO · Pedido 796' where id = op_rompe;
  perform pg_temp.soy('ingenieria@hegamex.com');
  perform public.revisar_orden(op_rompe, 'ingenieria');
  perform pg_temp.soy('gerente.produccion@hegamex.com');
  perform public.apartar_material(op_rompe);
  perform public.pedir_faltantes(op_rompe);
  v_m := pg_temp.fechar(v_m, '5 days');
  perform pg_temp.soy('almacen@hegamex.com');
  perform public.revisar_orden(op_rompe, 'almacen');
  v_m := pg_temp.fechar(v_m, '4 days');
  perform pg_temp.soy('gerente.produccion@hegamex.com');
  perform public.liberar_orden(op_rompe);
  perform public.editar_orden(op_rompe, p_prioridad => 1);
  v_m := pg_temp.fechar(v_m, '22 hours');

  -- Silo Thor 36 (P795): recién creado, nadie lo ha revisado.
  perform pg_temp.soy('gerente.produccion@hegamex.com');
  perform public.ordenes_desde_pedido(p795);
  select id into op_silo from public.ordenes_produccion where pedido_id = p795;
  v_m := pg_temp.fechar(v_m, '20 hours');
  update public.ordenes_produccion set numero_serie = 'DEMO-3AAMBACE9TMMJA043', notas = 'DEMO · Pedido 795', prioridad = 3 where id = op_silo;

  -- Lo último del día, para que el ticker de la TV tenga movimiento reciente.
  perform pg_temp.soy('taller@hegamex.com');
  perform public.avanzar_operacion(pg_temp.etapa(op_zar, 'Pailería'), 'nota', 'Se armó el bastidor; mañana se suelda la tolva', 'Juan Carranza');
  v_m := pg_temp.fechar(v_m, '35 minutes');
  perform pg_temp.soy('taller@hegamex.com');
  perform public.avanzar_operacion(pg_temp.etapa(op_v3, 'Pintura'), 'pausa', null, 'Luis Navarro');
  v_m := pg_temp.fechar(v_m, '18 minutes');
  perform pg_temp.soy('taller@hegamex.com');
  perform public.avanzar_operacion(pg_temp.etapa(op_v3, 'Pintura'), 'reanudar', null, 'Luis Navarro');
  v_m := pg_temp.fechar(v_m, '6 minutes');

  -- Las columnas de fecha siguen a los eventos (se crearon "hoy" y la historia dice otra cosa).
  perform pg_temp.postgres();
  update public.ordenes_produccion o set
    creado_en = coalesce((select min(en) from public.op_eventos where orden_id = o.id and tipo = 'creada'), o.creado_en),
    revisado_ingenieria_en = (select max(en) from public.op_eventos where orden_id = o.id and nota = 'Ingeniería revisó materiales y cantidades'),
    revisado_almacen_en = (select max(en) from public.op_eventos where orden_id = o.id and nota = 'Almacén revisó el material físicamente'),
    material_apartado_en = (select max(en) from public.op_eventos where orden_id = o.id and nota like 'Material apartado%'),
    faltantes_pedidos_en = (select max(en) from public.op_eventos where orden_id = o.id and nota like 'Faltantes pedidos%'),
    terminada_en = (select max(en) from public.op_eventos where orden_id = o.id and tipo = 'terminada'),
    inicio_plan = (select min(en)::date from public.op_eventos where orden_id = o.id and tipo = 'liberada')
  where o.notas like 'DEMO%' and o.estado <> 'cancelada';
  update public.op_operaciones x set
    inicio = (select min(en) from public.op_eventos where operacion_id = x.id and tipo in ('inicio', 'fin')),
    fin = (select max(en) from public.op_eventos where operacion_id = x.id and tipo = 'fin')
  from public.ordenes_produccion o where o.id = x.orden_id and o.notas like 'DEMO%' and o.estado <> 'cancelada';
  update public.reservas r set creado_en = o.material_apartado_en
  from public.ordenes_produccion o where o.id = r.orden_produccion_id and o.notas like 'DEMO%' and o.material_apartado_en is not null;
  update public.requisiciones q set creado_en = o.faltantes_pedidos_en, necesaria_para = coalesce(o.inicio_plan, o.fecha_compromiso)
  from public.requisicion_lineas l join public.ordenes_produccion o on o.id = l.orden_produccion_id
  where l.requisicion_id = q.id and o.notas like 'DEMO%' and o.faltantes_pedidos_en is not null;

  raise notice 'Listo: % órdenes DEMO', (select count(*) from public.ordenes_produccion where notas like 'DEMO%' and estado <> 'cancelada');
end $$;

commit;

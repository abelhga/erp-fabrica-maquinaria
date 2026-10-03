-- Solicitudes de precio a compras y fichas técnicas "vivas" para ver y fotografiar
-- las pantallas en la base LOCAL.
--
--   psql "$DB_URL" -f scripts/demo/solicitudes_precio.sql                 crea lo que falte y recorre las horas a hoy
--   psql "$DB_URL" -v limpiar=1 -f scripts/demo/solicitudes_precio.sql    cancela las solicitudes y la cotización DEMO
--
-- Necesita los usuarios locales (scripts/usuarios-locales.mjs), los clientes DEMO de
-- scripts/demo/ventas.sql y los proveedores DEMO de scripts/demo/compras_almacen.sql.
--
-- Todo pasa por las funciones de la base con quien lo haría de verdad: Isaac, Juan,
-- Susana e ingeniería piden; compras toma y contesta; ingeniería liga las fichas. Lo
-- que viene del chat: "@compras me ayudas a cotizar esta polea?" con el cliente en la
-- línea, la catarina que no tiene precio en el catálogo, el motorreductor, el
-- rodamiento que se quedó sin contestar, el reductor descontinuado y "¿tenemos video
-- de prueba de la Zar-6?". Ningún costo ni precio del catálogo real se toca: lo que
-- compras contesta son artículos DEMO-SP-….
--
-- Las horas se cuentan hacia atrás desde AHORA en horas hábiles (lun–vie 8–18, sáb
-- 8–14), así que cada vez que se corre el semáforo queda igual: una por vencer, una
-- vencida, una urgente recién pedida y las contestadas de hoy y de la semana.
\set ON_ERROR_STOP on

\if :{?limpiar}
begin;
update public.solicitudes_precio set estado = 'cancelada', cancelada_en = now(), motivo_cancelacion = 'Limpieza de la demostración'
where estado in ('abierta', 'tomada')
  and (cotizacion_id in (select id from public.cotizaciones where atencion = 'Jefe de planta (DEMO solicitudes)')
       or descripcion in ('Motorreductor 5 HP relación 40:1, flecha de 1 7/16"', 'Rodamiento de rodillos a rótula 22218 E',
                          'Sensor de nivel tipo paleta para tolva'));
update public.cotizaciones set estado = 'cancelada' where atencion = 'Jefe de planta (DEMO solicitudes)' and estado <> 'cancelada';
commit;
\echo 'Solicitudes de precio DEMO canceladas.'
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

create or replace function pg_temp.cliente(p_nombre text) returns uuid language plpgsql as $$
declare v uuid;
begin
  select id into v from public.clientes where nombre = p_nombre;
  if v is null then raise exception 'Falta el cliente "%": corre scripts/demo/ventas.sql', p_nombre; end if;
  return v;
end $$;

create or replace function pg_temp.prov(p_legacy text) returns uuid language sql as $$
  select id from public.proveedores where legacy_id = p_legacy
$$;

-- El instante que quedó p_horas hábiles antes de ahora (búsqueda binaria sobre horas_habiles).
create or replace function pg_temp.hace(p_horas numeric) returns timestamptz language plpgsql as $$
declare lo timestamptz := now() - interval '40 days'; hi timestamptz := now(); m timestamptz;
begin
  for i in 1 .. 40 loop
    m := lo + (hi - lo) / 2;
    if public.horas_habiles(m, now()) > p_horas then lo := m; else hi := m; end if;
  end loop;
  return hi;
end $$;

do $$
declare
  v_isaac uuid; v_juan uuid; v_susy uuid; v_dir uuid; v_ing uuid;
  v_eq uuid; v_cat uuid; v_cot uuid; v_l_cat uuid; v_l_polea uuid; v_doc uuid; v_s uuid;
begin
  if exists (select 1 from public.cotizaciones where atencion = 'Jefe de planta (DEMO solicitudes)' and estado <> 'cancelada') then
    raise notice 'Las solicitudes DEMO ya estaban: solo se recorren sus horas a hoy.';
    return;
  end if;
  perform pg_temp.cliente('DEMO Constructora Altiplano');

  -- ---------------------------------------------------------------------------
  -- Ingeniería: la Zar-6 con su ficha y su carpeta de fotos y video (vigentes), y la
  -- catarina con una ficha todavía en borrador (ventas no la ve).
  -- ---------------------------------------------------------------------------
  v_ing := pg_temp.soy('ingenieria@hegamex.com');
  insert into public.articulos (clave, tipo, nombre, descripcion, unidad)
  values ('DEMO-SP-ZAR6', 'equipo', 'Dosificadora Zar-6 de 2 tolvas',
          E'• 2 tolvas de 6 m³ con básculas independientes\n• Banda de 24" con variador de velocidad\n• Tablero con dosificación automática por receta', 'equipo')
  on conflict (clave) do nothing;
  select id into v_eq from public.articulos where clave = 'DEMO-SP-ZAR6';
  insert into public.costos_articulo (articulo_id, costo, precio_fijo) values (v_eq, 231000, 385000) on conflict (articulo_id) do nothing;
  insert into public.articulos (clave, tipo, nombre, unidad) values ('DEMO-SP-CAT', 'componente', 'Catarina 80B14 para elevador de cangilones', 'pieza')
  on conflict (clave) do nothing;
  select id into v_cat from public.articulos where clave = 'DEMO-SP-CAT';
  -- La catarina llega sin costo (y por eso sin precio de lista), aunque otra corrida ya lo haya contestado.
  perform pg_temp.soy('compras@hegamex.com');
  delete from public.costos_articulo where articulo_id = v_cat;
  perform pg_temp.soy('ingenieria@hegamex.com');

  if not exists (select 1 from public.documentos_tecnicos where articulo_id = v_eq) then
    v_doc := public.nuevo_documento_tecnico(v_eq, null, 'ficha', 'Ficha técnica Zar-6',
                                            'https://drive.google.com/file/d/DEMO-ficha-zar6/view');
    perform public.aprobar_documento(v_doc);
    v_doc := public.nuevo_documento_tecnico(v_eq, null, 'foto', 'Fotos y video de prueba en planta',
                                            'https://drive.google.com/drive/folders/DEMO-fotos-zar6');
    perform public.aprobar_documento(v_doc);
    perform public.nuevo_documento_tecnico(v_cat, null, 'ficha', 'Ficha técnica catarina 80B14 (por revisar)',
                                           'https://drive.google.com/file/d/DEMO-ficha-catarina/view');
  end if;

  -- ---------------------------------------------------------------------------
  -- Isaac cotiza la Zar-6 a la constructora: la catarina no tiene precio y la polea
  -- doble canal no está en el catálogo. Pide las dos sin salir de la cotización.
  -- ---------------------------------------------------------------------------
  v_isaac := pg_temp.soy('isaac@hegamex.com');
  v_cot := public.nueva_cotizacion(pg_temp.cliente('DEMO Constructora Altiplano'));
  update public.cotizaciones set atencion = 'Jefe de planta (DEMO solicitudes)' where id = v_cot;
  perform public.agregar_partida(v_cot, v_eq, 1);
  select id into v_l_cat from public.agregar_partida(v_cot, v_cat, 4);
  insert into public.cotizacion_lineas (cotizacion_id, orden, titulo, descripcion, unidad, cantidad, precio_unitario)
  values (v_cot, 3, 'Polea motriz 10" doble canal para Zar-6', 'Refacción de repuesto', 'pieza', 2, 0) returning id into v_l_polea;

  perform public.pedir_precio('Polea motriz 10" doble canal para Zar-6', null, 2, true, 'Martin', '2B10 bushing SK',
                              'El cliente está en la línea: la quiere con el equipo', v_cot, v_l_polea);
  perform public.pedir_precio('Para el elevador de la cotización; el cliente pide 4', v_cat, 4, false, null, null, null, v_cot, v_l_cat);
  perform public.pedir_precio('Sensor de nivel tipo paleta para tolva', null, 2, true, null, null,
                              'Lo pidió por teléfono para la misma obra', v_cot);
  perform public.pedir_precio('Reductor Falk 1070 (o equivalente)', null, 1, false, 'Falk', '1070', null, null, null,
                              pg_temp.cliente('DEMO Concretos del Bajío'));

  v_juan := pg_temp.soy('juan@hegamex.com');
  perform public.pedir_precio('Motorreductor 5 HP relación 40:1, flecha de 1 7/16"', null, 1, false, 'SEW', null,
                              'Para reponer el de su elevador', null, null, pg_temp.cliente('DEMO Molino La Espiga'));
  perform public.pedir_precio('Cangilón de plástico 9 x 6 para elevador', null, 50, false, null, null, 'Le urge en 2 semanas',
                              null, null, pg_temp.cliente('DEMO Molino La Espiga'));

  v_susy := pg_temp.soy('susana@hegamex.com');
  perform public.pedir_precio('Rodamiento de rodillos a rótula 22218 E', null, 6, false, 'SKF', '22218 E', null, null, null,
                              pg_temp.cliente('DEMO Ferretería Industrial Tapatía'));
  perform public.pedir_precio('Banda PVC 2 capas 24" de ancho, 30 m', null, 1, false, null, null, null, null, null,
                              pg_temp.cliente('DEMO Ferretería Industrial Tapatía'));

  -- Ingeniería también pide: el costo de una pieza nueva para costear un equipo.
  v_dir := pg_temp.soy('ingenieria@hegamex.com');
  perform public.pedir_precio('Malla para criba 1/4" acero inoxidable 2 x 1 m', null, 3, false, null, null, 'Para costear la cribadora de exhibición');

  -- ---------------------------------------------------------------------------
  -- Compras toma, contesta (dando de alta lo que no existe), y avisa lo que no se consigue.
  -- ---------------------------------------------------------------------------
  perform pg_temp.soy('compras@hegamex.com');
  select id into v_s from public.solicitudes_precio where descripcion = 'Polea motriz 10" doble canal para Zar-6' and cotizacion_id = v_cot;
  perform public.tomar_solicitud_precio(v_s);
  select id into v_s from public.solicitudes_precio where partida_id = v_l_cat;
  perform public.tomar_solicitud_precio(v_s);
  perform public.contestar_solicitud_precio(v_s, 465, 'MXN', pg_temp.prov('DEMO-PROV-ROD'), 10, (now() at time zone 'America/Mexico_City')::date + 15,
                                            'Precio por 4 piezas o más');
  select id into v_s from public.solicitudes_precio where descripcion = 'Malla para criba 1/4" acero inoxidable 2 x 1 m' and solicitante_id = v_dir;
  -- Lo que no existe se da de alta desde la respuesta (si ya se dio de alta en otra corrida, se reusa).
  perform public.contestar_solicitud_precio(v_s, 2380, 'MXN', pg_temp.prov('DEMO-PROV-ACE'), 5, null, 'Se corta a la medida',
    (select id from public.articulos where clave = 'DEMO-SP-MALLA'),
    '{"clave": "DEMO-SP-MALLA", "nombre": "Malla para criba 1/4\" acero inoxidable 2 x 1 m", "unidad": "pieza"}');
  select id into v_s from public.solicitudes_precio where descripcion = 'Cangilón de plástico 9 x 6 para elevador' and solicitante_id = v_juan;
  perform public.tomar_solicitud_precio(v_s);
  perform public.contestar_solicitud_precio(v_s, 3.40, 'USD', pg_temp.prov('DEMO-PROV-TAP'), 25, null, 'Importado: llega por paquetería en 5 semanas',
    (select id from public.articulos where clave = 'DEMO-SP-CANG'),
    '{"clave": "DEMO-SP-CANG", "nombre": "Cangilón de plástico 9 x 6 para elevador", "unidad": "pieza"}');
  select id into v_s from public.solicitudes_precio where descripcion = 'Reductor Falk 1070 (o equivalente)' and solicitante_id = v_isaac;
  perform public.marcar_no_se_consigue(v_s, 'Descontinuado por el fabricante; el equivalente es el Falk 1080 con entrega de 6 semanas');

  -- Susana ya no necesita la banda: el cliente la compró por Mercado Libre.
  perform pg_temp.soy('susana@hegamex.com');
  select id into v_s from public.solicitudes_precio where descripcion = 'Banda PVC 2 capas 24" de ancho, 30 m' and solicitante_id = v_susy;
  perform public.cancelar_solicitud_precio(v_s, 'El cliente la compró por Mercado Libre');
  perform pg_temp.postgres();
end $$;

-- -----------------------------------------------------------------------------
-- Las horas, recorridas a hoy (en horas hábiles hacia atrás): se corre en cada
-- ejecución para que el semáforo se vea igual cualquier día.
--   (descripción, creada hace, tomada después de, contestada/cancelada después de)
-- -----------------------------------------------------------------------------
do $$
declare r record; v_creada timestamptz;
begin
  perform pg_temp.postgres();
  for r in select * from (values
      ('Polea motriz 10" doble canal para Zar-6', 3.2, 0.15, null::numeric),       -- urgente, la tiene compras, por vencer
      ('Para el elevador de la cotización; el cliente pide 4', 6.0, 0.1, 2.4),     -- contestada hoy, falta aplicarla
      ('Sensor de nivel tipo paleta para tolva', 0.4, null, null),                 -- urgente recién pedida, sin tomar
      ('Motorreductor 5 HP relación 40:1, flecha de 1 7/16"', 1.0, null, null),    -- normal, sin tomar
      ('Rodamiento de rodillos a rótula 22218 E', 14.0, null, null),               -- nadie la tomó: vencida
      ('Malla para criba 1/4" acero inoxidable 2 x 1 m', 9.0, 0.2, 1.2),           -- contestada rápido
      ('Cangilón de plástico 9 x 6 para elevador', 20.0, 1.5, 11.5),               -- contestada, pasó de un día
      ('Reductor Falk 1070 (o equivalente)', 30.0, 0.5, 3.0),                      -- no se consigue
      ('Banda PVC 2 capas 24" de ancho, 30 m', 12.0, null, 2.0)                    -- cancelada
    ) x(descripcion, hace, tomada, cerrada) loop
    v_creada := pg_temp.hace(r.hace);
    update public.solicitudes_precio s set
      creado_en = v_creada,
      vence_en = public.sumar_horas_habiles(v_creada, case when s.urgente then 4 else 10 end),
      tomada_en = case when s.tomada_por is not null then public.sumar_horas_habiles(v_creada, coalesce(r.tomada, r.cerrada, 0)) end,
      horas_acuse = case when s.tomada_por is not null then coalesce(r.tomada, r.cerrada) end,
      contestada_en = case when s.contestada_en is not null then public.sumar_horas_habiles(v_creada, r.cerrada) end,
      horas_respuesta = case when s.contestada_en is not null then r.cerrada end,
      cancelada_en = case when s.cancelada_en is not null then public.sumar_horas_habiles(v_creada, r.cerrada) end
    where s.descripcion = r.descripcion
      and (s.cotizacion_id in (select id from public.cotizaciones where atencion = 'Jefe de planta (DEMO solicitudes)')
           or s.cliente_id in (select id from public.clientes where nombre like 'DEMO %')
           or s.solicitante_id = (select id from public.perfiles where correo = 'ingenieria@hegamex.com'));
  end loop;
end $$;

commit;

\echo 'Solicitudes de precio DEMO:'
select s.folio, s.estado, s.urgente, p.nombre as pidio, coalesce(a.nombre, s.descripcion) as que,
       to_char(s.vence_en at time zone 'America/Mexico_City', 'DD/MM HH24:MI') as vence, pl.precio as precio_lista
from public.solicitudes_precio s
join public.perfiles p on p.id = s.solicitante_id
left join public.articulos a on a.id = s.articulo_id
left join public.precios_lista pl on pl.articulo_id = s.articulo_id
where s.cotizacion_id in (select id from public.cotizaciones where atencion = 'Jefe de planta (DEMO solicitudes)')
   or s.cliente_id in (select id from public.clientes where nombre like 'DEMO %')
   or p.correo = 'ingenieria@hegamex.com'
order by s.creado_en desc;

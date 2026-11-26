-- =============================================================================
-- Convierte la base de demostración en "Fábrica Atlas Industrial", una fábrica que no existe,
-- para enseñarle el ERP a alguien de fuera.
--
-- Los scripts de scripts/demo/* se escribieron para probar pantallas en casa: firman
-- con las cuentas @hegamex.com, usan los nombres de los vendedores de verdad, marcan
-- todo con "DEMO" y traen a los proveedores reales de importación. Nada de eso se le
-- enseña a un posible socio: aquí se cambia, al final, sobre la base ya llena.
--
-- Va AL FINAL de scripts/demo-comercial/cargar.sh. Solo para una base de demostración:
-- se niega si encuentra el libro de ventas real (clientes CLI:) o pedidos HIS-.
--   psql "$DB_URL" -v ON_ERROR_STOP=1 -f scripts/demo-comercial/maquillaje.sql
-- Apaga los disparadores mientras corre (session_replication_role): los "inalterables"
-- no dejarían corregir el texto de un movimiento, y la bitácora anotaría cada renombre
-- como si alguien lo hubiera hecho.
-- =============================================================================
begin;

do $$
begin
  if exists (select 1 from public.clientes where legacy_ref like 'CLI:%')
     or exists (select 1 from public.pedidos where folio like 'HIS-%') then
    raise exception 'Esta base tiene datos importados de las hojas reales: el maquillaje es solo para la base de demostración';
  end if;
end $$;

set local session_replication_role = replica;
set local statement_timeout = '15min';

-- ---------------------------------------------------------------------------
-- 1. Las cuentas: correo y nombre. El nombre del perfil es el mismo que el del
--    empleado, para que RRHH, nómina y el menú digan lo mismo.
-- ---------------------------------------------------------------------------
create temp table _cuenta (antes text, despues text, nombre text) on commit drop;
insert into _cuenta values
  ('direccion@hegamex.com',          'direccion@fabricaatlas.demo',          'Gabriel Medina Lozano'),
  ('isaac@hegamex.com',              'rodrigo@fabricaatlas.demo',            'Rodrigo Valdez Aranda'),
  ('juan@hegamex.com',               'fernando@fabricaatlas.demo',           'Fernando Ochoa Quintero'),
  ('susana@hegamex.com',             'paola@fabricaatlas.demo',              'Paola Ibarra Núñez'),
  ('gerente.ventas@hegamex.com',     'gerente.ventas@fabricaatlas.demo',     'Verónica Lara Ponce'),
  ('ingenieria@hegamex.com',         'ingenieria@fabricaatlas.demo',         'Miguel Ángel Ortiz Plascencia'),
  ('compras@hegamex.com',            'compras@fabricaatlas.demo',            'Claudia Ivonne Rivas Orozco'),
  ('almacen@hegamex.com',            'almacen@fabricaatlas.demo',            'Ramón Aguilar Solís'),
  ('gerente.produccion@hegamex.com', 'gerente.produccion@fabricaatlas.demo', 'Jaime Contreras Vega'),
  ('taller@hegamex.com',             'taller@fabricaatlas.demo',             'Felipe Andrade Mora'),
  ('rrhh@hegamex.com',               'rrhh@fabricaatlas.demo',               'Mariana Castañeda Villa'),
  ('finanzas@hegamex.com',           'finanzas@fabricaatlas.demo',           'Laura Patricia Gómez Ruvalcaba'),
  ('sistemas@hegamex.com',           'sistemas@fabricaatlas.demo',           'Soporte de Sistemas'),
  ('tv@hegamex.com',                 'tv@fabricaatlas.demo',                 'Pantalla del taller'),
  ('importaciones@hegamex.com',      'importaciones@fabricaatlas.demo',      'Fernanda Robles Mejía'),
  ('recepcion@hegamex.com',          'recepcion@fabricaatlas.demo',          'Diana Herrera Gil'),
  ('mantenimiento@hegamex.com',      'mantenimiento@fabricaatlas.demo',      'Iván Saldaña Ríos'),
  ('marketing@hegamex.com',          'marketing@fabricaatlas.demo',          'Andrea Montes Lira'),
  ('procesos@hegamex.com',           'procesos@fabricaatlas.demo',           'Tomás Beltrán Cázares');

-- Texto libre que nombra a esas personas (avisos, bitácora, planes, notas). De lo más
-- largo a lo más corto, para que "Isaac Hernández García" no quede en "Rodrigo Hernández García".
create temp table _texto (orden int, patron text, reemplazo text) on commit drop;
insert into _texto values
  (1,  'Isaac Hernández García', 'Rodrigo Valdez Aranda'), (2, 'Isaac Hernández', 'Rodrigo Valdez'), (3, '\mIsaac\M', 'Rodrigo'),
  (4,  'Juan Manuel Ramírez Soto', 'Fernando Ochoa Quintero'), (5, 'Juan Manuel Ramírez', 'Fernando Ochoa'), (6, '\mJuan Manuel\M', 'Fernando'),
  (7,  'Susana Rizo Mercado', 'Paola Ibarra Núñez'), (8, 'Susana Rizo', 'Paola Ibarra'), (9, '\mSusana\M', 'Paola'), (10, '\mSusy\M', 'Paola'),
  (11, 'Elizabeth Hernández García', 'Verónica Lara Ponce'), (12, 'Elizabeth Hernández', 'Verónica Lara'), (13, '\mElizabeth\M', 'Verónica'),
  (14, 'Abel Hernández G(arcía)?', 'Gabriel Medina Lozano'), (15, '\mAbel\M', 'Gabriel'),
  (16, 'Alondra \(prueba\)', 'Fernanda Robles Mejía'), (17, '\mAlondra\M', 'Fernanda'),
  (18, 'DEMO Dirección General', 'Gabriel Medina Lozano'),
  (19, 'Almacenista Hegamex', 'Ramón Aguilar Solís'), (20, 'Comprador Hegamex', 'Claudia Ivonne Rivas Orozco'),
  (21, 'Finanzas Hegamex', 'Laura Patricia Gómez Ruvalcaba'), (22, 'Miguel Ingeniería', 'Miguel Ángel Ortiz Plascencia'),
  (23, 'Marketing Hegamex', 'Andrea Montes Lira'), (24, 'Recepción Hegamex', 'Diana Herrera Gil'), (25, 'Sistemas Hegamex', 'Soporte de Sistemas'),
  (26, 'isaac@hegamex\.com', 'rodrigo@fabricaatlas.demo'), (27, 'juan@hegamex\.com', 'fernando@fabricaatlas.demo'),
  (28, 'susana@hegamex\.com', 'paola@fabricaatlas.demo'),
  -- La empresa
  (30, 'M[áa]quinas y Herramientas Gamex( S\.A\. de C\.V\.)?', 'Fábrica Atlas Industrial S.A. de C.V.'),
  (31, '\s*-\s*Hegamex®', ''), (32, 'Hegamex®', 'Fábrica Atlas Industrial'), (33, 'hegamex\.com', 'fabricaatlas.demo'),
  (34, 'HEGAMEX', 'FÁBRICA ATLAS INDUSTRIAL'), (35, 'Hegamex', 'Fábrica Atlas Industrial'),
  -- Proveedores de importación reales → inventados
  (40, 'Yao ?Han Industries', 'Huaxin Packing Machinery'), (41, '\s+yao ?han\M', ''), (42, '\myao ?han\M', 'Huaxin'),
  (43, 'Gavin Electronic', 'Hengli Weighing'), (44, '\mGavin\M', 'Hengli'),
  (45, 'Jusheng', 'Mingda'), (46, 'Lanyi', 'Qingyuan'), (47, 'Tavol', 'Ruitai'),
  (48, 'yaohan', 'HUAXIN'), (49, 'gavin', 'HENGLI'),             -- claves internas sin espacios (PROV-YAOHANINDUST)
  -- Agentes aduanales y forwarders de verdad, y el formato de proforma del proveedor
  (50, 'Agencia Aduanal Careaga', 'Aduanas del Pacífico'), (51, '\mCareaga\M', 'Aduanas del Pacífico'),
  (52, '\mInterteam\M', 'Transpacific Logistics'), (53, '\mNewtral\M', 'Blue Anchor Logistics'),
  (54, '\mLME\M', 'Aduanas Manzanillo'), (55, '\mMEHE-', 'PI-'),
  -- Las marcas de la demostración de casa
  (60, '\mDEMO-(\d{3})\M', 'PED-26-0\1'),           -- folios de pedido DEMO-792 (PED-26-801 ya existe)
  (59, '\mDEMO ENV ', ''),                           -- clientes de scripts/demo/envios.sql
  (61, '\mDEMO-ENV-', ''), (62, '\mDEMO-PROV-', 'PROV-'), (63, '\mDEMO-', ''),
  (64, '\s*\((DEMO|demo)[^)]*\)', ''),             -- "(demo)", "(DEMO solicitudes)"
  (65, '\mDEMO\M:?\s*', '');

create function pg_temp.limpio(p text) returns text language plpgsql immutable as $$
declare r record; v text := p;
begin
  if v is null then return null; end if;
  for r in select * from _texto order by orden loop
    v := regexp_replace(v, r.patron, r.reemplazo, case when r.orden between 40 and 49 then 'gi' else 'g' end);
  end loop;
  return v;
end $$;

-- Antes de tocar claves: que quitar "DEMO-" no junte dos artículos en la misma clave.
do $$
declare v text;
begin
  select string_agg(c, ', ') into v from (
    select pg_temp.limpio(clave) c from public.articulos group by 1 having count(*) > 1) x;
  if v is not null then raise exception 'Al quitar DEMO- se repetirían las claves: %', v; end if;
  select string_agg(c, ', ') into v from (
    select pg_temp.limpio(folio) c from public.pedidos group by 1 having count(*) > 1) x;
  if v is not null then raise exception 'Al quitar DEMO- se repetirían los folios: %', v; end if;
end $$;

-- Cuentas de acceso.
update auth.users u set email = c.despues,
  raw_user_meta_data = coalesce(u.raw_user_meta_data, '{}') || jsonb_build_object('full_name', c.nombre, 'name', c.nombre, 'email', c.despues)
from _cuenta c where lower(u.email) = c.antes;
update auth.identities i set provider_id = case when i.provider = 'email' then i.user_id::text else i.provider_id end,
  identity_data = coalesce(i.identity_data, '{}') || jsonb_build_object('email', c.despues)
from _cuenta c where lower(i.email) = c.antes;
update public.perfiles p set correo = c.despues, nombre = c.nombre,
  iniciales = upper(left(split_part(c.nombre, ' ', 1), 1) || left(split_part(c.nombre, ' ', 2), 1))
from _cuenta c where lower(p.correo) = c.antes;
update public.empleados e set correo = c.despues, nombre = c.nombre from _cuenta c where lower(e.correo) = c.antes;
delete from auth.audit_log_entries;
delete from auth.sessions;
delete from auth.refresh_tokens;
-- La invitación que sembró una migración es de una persona real.
delete from public.invitaciones where correo !~* 'fabricaatlas\.demo$';

-- Todo el texto de la base (menos catálogos geográficos y reglas internas, que no nombran a nadie).
do $$
declare r record; n bigint; total bigint := 0;
  v_patron text := (select string_agg(patron, '|') from _texto) || '|hegamex|gamex';
begin
  for r in
    select c.table_name t, c.column_name col, c.data_type tipo
    from information_schema.columns c
    join information_schema.tables tb on tb.table_schema = c.table_schema and tb.table_name = c.table_name and tb.table_type = 'BASE TABLE'
    where c.table_schema = 'public' and c.is_generated = 'NEVER'
      and c.data_type in ('text', 'character varying', 'jsonb')
      and c.table_name !~ '^(geo_|nombres_palabras$|reglas_familia_venta$|familias_venta$)'
  loop
    if r.tipo = 'jsonb' then
      execute format('update public.%I set %I = pg_temp.limpio(%I::text)::jsonb where %I::text ~* %L', r.t, r.col, r.col, r.col, v_patron);
    else
      execute format('update public.%I set %I = btrim(regexp_replace(pg_temp.limpio(%I), ''  +'', '' '', ''g'')) where %I ~* %L', r.t, r.col, r.col, r.col, v_patron);
    end if;
    get diagnostics n = row_count;
    total := total + n;
  end loop;
  raise notice 'Maquillaje: % renglones con texto cambiado', total;
end $$;

-- ---------------------------------------------------------------------------
-- 2. La empresa y lo que la configura.
-- ---------------------------------------------------------------------------
update public.configuracion set valor = '{"nombre": "Fábrica Atlas Industrial", "razon_social": "Fábrica Atlas Industrial S.A. de C.V.", "rfc": "FAI150101AB1", "telefono": "33 0000 0000", "sitio": "fabricaatlas.demo", "direccion": "Av. de la Industria 1250, Parque Industrial, Zapopan, Jal."}'
where clave = 'empresa';
update public.configuracion set valor = valor || '{"razon_social": "Fábrica Atlas Industrial S.A. de C.V.", "rfc": "FAI150101AB1", "domicilio": "Av. de la Industria 1250, Parque Industrial, 45130, Zapopan, Jal."}'::jsonb
where clave = 'empresa_fiscal';
update public.configuracion set valor = '["fabricaatlas.demo"]' where clave = 'dominios_permitidos';
-- La carpeta de Drive de las órdenes de compra es de Hegamex.
update public.configuracion set valor = '{"carpeta": null}' where clave = 'drive_ordenes_compra';
-- Cuentas bancarias, datos de pago o teléfonos de la configuración fiscal: los de Hegamex no.
update public.configuracion set valor = valor - 'cuentas' - 'banco' - 'clabe' - 'cuenta' where clave = 'empresa_fiscal';
-- Los mensajes de las funciones («Le toca a Hegamex»…) los cambia funciones_con_marca.sql, aparte:
-- en la nube las funciones vienen de las migraciones, no del respaldo de datos.
-- "Dosificadoras (Zeus)": Zeus es la línea de Hegamex; aquí basta con el nombre del producto.
update public.familias_venta set nombre = 'Dosificadoras' where clave = 'dosificadoras';

-- ---------------------------------------------------------------------------
-- 3. Lo que quedó: si algo sigue nombrando a Hegamex o a su gente, que no pase.
-- ---------------------------------------------------------------------------
do $$
declare r record; n bigint; v text := '';
begin
  for r in
    select c.table_schema s, c.table_name t, c.column_name col
    from information_schema.columns c
    join information_schema.tables tb on tb.table_schema = c.table_schema and tb.table_name = c.table_name and tb.table_type = 'BASE TABLE'
    where c.table_schema in ('public', 'auth') and c.data_type in ('text', 'character varying', 'jsonb')
      and c.table_name !~ '^(geo_|nombres_palabras$|reglas_familia_venta$)'
  loop
    -- "DEMO" en mayúsculas es la marca de casa; ".demo" en minúsculas es el dominio inventado y se queda.
    -- "hegamex" en minúsculas también: es la clave de «a quién le toca» en importaciones (una regla
    -- de la base la exige así) y la pantalla la muestra con el nombre de la empresa.
    execute format('select count(*) from %I.%I where %I::text ~* %L or %I::text ~ %L', r.s, r.t, r.col,
      'hegamex\.com|\mgamex|isaac|susana|juan manuel|elizabeth|\mabel\M|alondra|yao ?han|gavin|jusheng|lanyi|tavol|MHG160202|careaga|interteam|newtral|MEHE-', r.col, 'Hegamex|HEGAMEX|\mDEMO\M') into n;
    if n > 0 then v := v || format('%s.%s.%s (%s) ', r.s, r.t, r.col, n); end if;
  end loop;
  if v <> '' then raise exception 'Quedó texto de la demostración de casa en: %', v; end if;
end $$;

commit;

select correo, nombre from public.perfiles order by correo;

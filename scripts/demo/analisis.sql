-- BI de dirección "vivo" para ver y fotografiar las pantallas en la base LOCAL.
--
--   psql "$DB_URL" -f scripts/demo/analisis.sql                 crea lo que falte (se puede correr varias veces)
--   psql "$DB_URL" -v limpiar=1 -f scripts/demo/analisis.sql    deshace lo de esta demostración
--
-- Necesita los usuarios locales (scripts/usuarios-locales.mjs) y el libro de ventas
-- importado. No inventa ventas: el análisis sale de las reales. Lo que hace es lo que
-- haría dirección la primera semana, con sus funciones y sus permisos:
--   * corregir ciudades que no se reconocieron, solo las que se sabe a qué municipio
--     pertenecen (San Mateo Otzacatipan es de Toluca; San Francisco de Asís, de
--     Atotonilco el Alto; Capilla de Guadalupe, de Tepatitlán; Ciudad Satélite, de
--     Naucalpan; Villa Unión, Dgo., cabecera de Poanas) y marcar «Varios» como no ubicable;
--   * capturar la meta de este año (12 % sobre el anterior, redondeada) y la de Jalisco;
--   * agregar una regla de familia para lámina y placa sueltas.
-- Todo lo de la demostración dice "DEMO" en sus notas para poder quitarlo.
\set ON_ERROR_STOP on

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

create temporary table demo_ubicaciones (estado text, ciudad text, municipio text, cve_ent text, no_ubicable boolean) on commit drop;
insert into demo_ubicaciones values
  ('Ciudad de México', 'San Mateo Otzacatipan', 'toluca', '15', false),
  ('Jalisco', 'San Francisco de Asis', 'atotonilco el alto', '14', false),
  ('Jalisco', 'Capilla de Guadalupe', 'tepatitlan de morelos', '14', false),
  ('Estado de México', 'Ciudad Satelite', 'naucalpan de juarez', '15', false),
  ('Durango', 'Villa Unión', 'poanas', '10', false),
  ('Varios', 'Varias', null, null, true);
-- La lista la lee dirección (rol authenticated), no postgres.
grant select on demo_ubicaciones to authenticated;

\if :{?limpiar}
select pg_temp.soy('direccion@hegamex.com');
select public.quitar_alias_ubicacion(a.id)
from public.geo_alias_ciudad a join demo_ubicaciones d
  on a.estado_norm = coalesce(public.geo_normalizar(d.estado), '') and a.ciudad_norm = coalesce(public.geo_normalizar(d.ciudad), '')
where a.origen = 'direccion';
delete from public.metas_anuales where notas like 'DEMO%';
select public.borrar_regla_familia(id) from public.reglas_familia_venta where nota like 'DEMO%';
commit;
\echo 'Demostración del análisis deshecha.'
\quit
\endif

-- Dirección corrige ubicaciones (cada una re-ubica a todos los clientes que la escribieron igual).
select pg_temp.soy('direccion@hegamex.com');
select d.estado, d.ciudad,
       public.corregir_ubicacion(d.estado, d.ciudad, m.cvegeo, null, d.no_ubicable) as clientes_reubicados
from demo_ubicaciones d
left join public.geo_municipios m on m.cve_ent = d.cve_ent and m.nombre_norm = d.municipio;

-- La meta del año: 12 % sobre el anterior, en millones cerrados; y Jalisco con su parte.
select public.guardar_meta_anual(
  extract(year from public.hoy_planta())::int,
  round(public.ventas_entre(make_date(extract(year from public.hoy_planta())::int - 1, 1, 1),
                            make_date(extract(year from public.hoy_planta())::int - 1, 12, 31)) * 1.12, -6),
  'DEMO: 12 % sobre el año anterior, según la junta de dirección');
select public.guardar_meta_estado(extract(year from public.hoy_planta())::int, '14',
  round((select meta from public.metas_anuales where anio = extract(year from public.hoy_planta())::int) * 0.30, -5));

-- Una regla de familia nueva: lámina y placa sueltas son "otros", no un equipo.
select public.guardar_regla_familia(null, '\m(lam\.|lamina\M|placas?\M)', 'otros', 65, true, 'DEMO: material suelto (lámina perforada, placa)');

commit;

select ubicacion, count(*) from public.clientes group by 1 order by 2 desc;

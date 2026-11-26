-- =============================================================================
-- Las funciones de la base que dicen "Hegamex" en un mensaje («Le toca a Hegamex», «No es de
-- Hegamex», la razón social en una carta…), con el nombre de la empresa de la demostración.
--
-- Aparte del maquillaje porque las funciones no viajan en el respaldo de datos: en la nube vienen
-- de las migraciones y hay que correrlo ahí también, después de migrar (y de cada migración nueva).
--   psql "$DB_URL" -v ON_ERROR_STOP=1 -f scripts/demo-comercial/funciones_con_marca.sql
--   NUBE_REF=<ref> python3 scripts/nube/sql_nube.py scripts/demo-comercial/funciones_con_marca.sql
-- Solo con mayúscula: "hegamex." en minúsculas son banderas internas (set_config) y la clave de
-- «a quién le toca», que no se ven. Se niega en una base con datos importados de las hojas reales.
-- =============================================================================
do $$
begin
  if exists (select 1 from public.clientes where legacy_ref like 'CLI:%') then
    raise exception 'Esta base tiene datos de Hegamex: esto es solo para la de demostración';
  end if;
end $$;

do $$
declare r record;
begin
  for r in select p.oid from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.prosrc ~ 'Hegamex|Herramientas Gamex|Tavol' loop
    -- «Un pago a Tavol estuvo retenido 38 días» es una anécdota de Hegamex escrita en una alerta.
    execute regexp_replace(regexp_replace(regexp_replace(pg_get_functiondef(r.oid), 'a Tavol', 'a un proveedor', 'g'),
      'M[áa]quinas y Herramientas Gamex', 'Fábrica Atlas Industrial', 'g'), 'Hegamex', 'Fábrica Atlas Industrial', 'g');
  end loop;
end $$;

select count(*) funciones_que_dicen_hegamex from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.prosrc ~ 'Hegamex|Herramientas Gamex|Tavol';

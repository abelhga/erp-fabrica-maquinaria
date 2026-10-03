-- =============================================================================
-- Columnas de la autorización de precios en cotizaciones.
--
-- Las agrega 20261003000082_ventas_pantallas.sql, pero el aviso a gerencia de
-- 20261003000071_avisos_pendientes.sql ya crea su disparador "after update of
-- autorizacion_pedida_en, autorizada_en": en una base nueva (db reset) esa
-- migración tronaba con "column does not exist" porque corre antes. Van aquí,
-- solas, para que existan desde antes; la 082 las vuelve a pedir con
-- "if not exists" y no pasa nada.
-- =============================================================================

alter table public.cotizaciones add column if not exists autorizacion_pedida_en timestamptz;
alter table public.cotizaciones add column if not exists nota_autorizacion text;
alter table public.cotizaciones add column if not exists autorizada_en timestamptz;

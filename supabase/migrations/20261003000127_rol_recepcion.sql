-- =============================================================================
-- Rol de recepción.
--
-- Va solo en esta migración porque Postgres no deja usar un valor nuevo de un
-- enum en la misma transacción en que se agrega: los permisos y el módulo de
-- leads están en 20261003000128_leads.sql.
-- =============================================================================

alter type public.app_rol add value if not exists 'recepcion';

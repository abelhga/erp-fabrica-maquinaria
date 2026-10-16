-- =============================================================================
-- Rol de gerencia administrativa (Susana).
--
-- Va solo en esta migración porque Postgres no deja usar un valor nuevo de un
-- enum en la misma transacción en que se agrega: los permisos y lo demás están
-- en 20261003000111_comisiones_y_administracion.sql.
-- =============================================================================

alter type public.app_rol add value if not exists 'administracion';

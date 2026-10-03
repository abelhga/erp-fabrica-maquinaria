-- =============================================================================
-- Rol de importaciones (Alondra).
--
-- Va solo en esta migración porque Postgres no deja usar un valor nuevo de un
-- enum en la misma transacción en que se agrega: los permisos y todo lo demás
-- del módulo están en 20261003000075_importaciones.sql.
-- =============================================================================

alter type public.app_rol add value if not exists 'importaciones';

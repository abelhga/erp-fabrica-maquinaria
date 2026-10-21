-- =============================================================================
-- Rol de mantenimiento (de planta).
--
-- Va solo porque Postgres no deja usar un valor nuevo de un enum en la misma
-- transacción en que se agrega: el módulo, sus permisos y lo demás van en 145.
-- =============================================================================

alter type public.app_rol add value if not exists 'mantenimiento';

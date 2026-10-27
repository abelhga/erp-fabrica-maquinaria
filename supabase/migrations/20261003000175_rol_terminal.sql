-- =============================================================================
-- Rol de la terminal de piso (la tablet del taller).
--
-- Va solo porque Postgres no deja usar un valor nuevo de un enum en la misma
-- transacción en que se agrega: sus permisos van en 176.
-- =============================================================================

alter type public.app_rol add value if not exists 'terminal';

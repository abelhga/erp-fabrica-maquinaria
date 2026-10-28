-- =============================================================================
-- Rol de marketing (Adriana Barragán).
--
-- Va solo porque Postgres no deja usar un valor nuevo de un enum en la misma transacción en que
-- se agrega: sus permisos van en 189.
-- =============================================================================

alter type public.app_rol add value if not exists 'marketing';

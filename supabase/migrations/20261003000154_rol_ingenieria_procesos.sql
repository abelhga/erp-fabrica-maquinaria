-- =============================================================================
-- Rol de ingeniería de procesos (lean manufacturing).
--
-- Va solo porque Postgres no deja usar un valor nuevo de un enum en la misma
-- transacción en que se agrega: su módulo, sus permisos y las métricas van en 155.
-- =============================================================================

alter type public.app_rol add value if not exists 'ingenieria_procesos';

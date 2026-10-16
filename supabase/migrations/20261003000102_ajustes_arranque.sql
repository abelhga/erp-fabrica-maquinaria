-- Topes de caja chica como los lleva la hoja de 2026 (mínimo $1,000, máximo $5,000).
-- La 101 sembró los de la hoja de 2025 ($500 / $4,500), que ya no son los que usan:
-- con esos, el aviso de "toca reponer" llegaba tarde.
update public.configuracion set valor = '1000'::jsonb where clave = 'caja_chica_minimo';
update public.configuracion set valor = '5000'::jsonb where clave = 'caja_chica_maximo';

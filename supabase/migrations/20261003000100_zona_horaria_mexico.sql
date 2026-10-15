-- =============================================================================
-- La base trabaja en hora de la planta (America/Mexico_City), no en UTC.
--
-- Por qué: 22 funciones usan current_date (vencimientos, "hoy", la fecha por omisión
-- de un pago, de un intento de contacto, de una salida de almacén…). En UTC, a partir
-- de las 6 de la tarde en Atotonilco ya era "mañana": un pago registrado a las 7 pm
-- quedaba con fecha del día siguiente y "vence hoy" cambiaba antes de tiempo. Las
-- funciones que ya usaban hoy_planta() no cambian; las demás quedan bien sin tocarlas.
-- Las columnas son timestamptz (ninguna "timestamp" sin zona): los instantes guardados
-- no se mueven, solo cómo se lee "hoy".
-- =============================================================================
do $$ begin
  execute format('alter database %I set timezone to %L', current_database(), 'America/Mexico_City');
end $$;
-- Para esta conexión también (la de la base aplica a las conexiones nuevas).
set timezone to 'America/Mexico_City';

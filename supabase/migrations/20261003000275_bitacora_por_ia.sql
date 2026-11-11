-- =============================================================================
-- Lo que la IA hace a petición de alguien queda en la bitácora a su nombre, pero no cuenta como
-- su uso del ERP.
--
-- Por qué: el 10 de noviembre se renombraron 3,121 artículos y se juntaron 53 repetidos a petición
-- de Abel. La bitácora los anotó a su nombre (bien: él lo autorizó y debe verse quién) y «Uso del
-- ERP» los contó como cambios suyos: su cuadro de ese día salió encendido como si hubiera capturado
-- 3,000 cosas, y la comparación entre personas dejó de servir.
--
-- Qué cambia:
--   * bitacora.por_ia: verdadero cuando el cambio lo hizo la IA a petición de esa persona. Lo pone
--     sola la base si la sesión trae hegamex.por_ia = '1' (así lo hacen los cambios masivos).
--   * Uso del ERP (tablero, detalle por persona, por usuario y el destello en vivo) no los cuenta.
--   * Los de ese día se marcan: el renombre y la junta del catálogo, y los cambios hechos por la IA
--     esa mañana (25 cotizaciones renombradas, 9 partidas agregadas a pedidos, 5 órdenes de compra
--     deshechas), cada uno en su segundo exacto.
-- =============================================================================

alter table public.bitacora add column if not exists por_ia boolean not null
  default (coalesce(current_setting('hegamex.por_ia', true), '') = '1');

do $$
declare f text; d text; n text;
  pares text[][] := array[
    ['public.uso_por_usuario(date,date)', 'from bitacora x where x.en >= t0', 'from bitacora x where not x.por_ia and x.en >= t0'],
    ['public.uso_de_usuario(uuid,date,date)', 'from bitacora x where x.usuario_id = p_usuario', 'from bitacora x where not x.por_ia and x.usuario_id = p_usuario'],
    ['public.uso_de_usuario(uuid,date,date)', 'from bitacora where usuario_id = p_usuario', 'from bitacora where not por_ia and usuario_id = p_usuario'],
    ['public.uso_tablero(date,date)', 'from bitacora where usuario_id is not null and', 'from bitacora where not por_ia and usuario_id is not null and'],
    ['public.uso_tablero(date,date)', 'from bitacora where usuario_id = p.id', 'from bitacora where not por_ia and usuario_id = p.id'],
    ['public.uso_en_vivo_avisar()', 'from nuevos where usuario_id is not null', 'from nuevos where usuario_id is not null and not coalesce((to_jsonb(nuevos.*)->>''por_ia'')::boolean, false)']
  ];
  i int;
begin
  for i in 1 .. array_length(pares, 1) loop
    d := pg_get_functiondef(pares[i][1]::regprocedure);
    n := replace(d, pares[i][2], pares[i][3]);
    if n = d then raise exception '%: no encontré «%»', pares[i][1], pares[i][2]; end if;
    execute n;
  end loop;
end $$;

-- Lo que hizo la IA el 10 de noviembre a nombre de Abel (hora de la planta, al segundo).
update public.bitacora b set por_ia = true
where b.usuario_id = (select id from public.perfiles where nombre = 'Abel Hernández García')
  and ((b.tabla = 'articulos' and b.en >= timestamptz '2026-11-10 22:57:00-06' and b.en < timestamptz '2026-11-10 23:03:00-06')
    or (b.tabla = 'cotizaciones' and date_trunc('second', b.en) = timestamptz '2026-11-10 10:59:12-06')
    or (b.tabla = 'pedidos' and date_trunc('second', b.en) = timestamptz '2026-11-10 11:35:02-06')
    or (b.tabla = 'ordenes_compra' and date_trunc('second', b.en) = timestamptz '2026-11-10 11:34:12-06'));

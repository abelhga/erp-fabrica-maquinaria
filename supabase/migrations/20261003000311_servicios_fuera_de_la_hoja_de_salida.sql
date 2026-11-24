-- =============================================================================
-- Un servicio no va en la hoja de salida ni necesita quien lo firme de recibido.
--
-- Por qué: ventas avisó que en la hoja de salida salían los servicios (instalación, paquetería,
-- una barrenación) como algo que entregar, y no hay quien los firme. Desde 301 un servicio del
-- catálogo ya no detenía la entrega, pero quedaban dos huecos: los servicios escritos a mano
-- (sin artículo) seguían listándose y contando, y un pedido que es solo servicio no se podía
-- cerrar sin anotar «quién recibió» en una hoja que nadie firma.
--
-- Qué cambia:
--   · partida_es_servicio(artículo, título): servicio del catálogo, o partida escrita a mano
--     cuyo título empieza como servicio (servicio…, flete, paquetería, envío, instalación,
--     puesta en marcha, capacitación, maniobra, mano de obra, manejo y entrega).
--   · hoja_salida dice cuál partida es servicio y si el pedido es solo de servicios: la pantalla
--     y la hoja impresa las apartan de lo que se entrega.
--   · entregar_pedido: el pedido queda entregado cuando ya salió todo lo que no es servicio (los
--     servicios se dan por hechos con esa entrega). Uno que es solo servicio se cierra sin firma.
--     Y una partida física escrita a mano ahora sí cuenta: antes, si el pedido traía algún
--     artículo del catálogo, las de texto no detenían el «entregado» aunque faltaran.
-- =============================================================================

create or replace function public.partida_es_servicio(p_articulo uuid, p_titulo text) returns boolean
language sql stable set search_path = public, extensions as $$
  select case when p_articulo is not null then coalesce((select a.tipo = 'servicio' from articulos a where a.id = p_articulo), false)
    else sin_acentos(coalesce(p_titulo, '')) ~* '^\s*(servicio|flete|paqueteria|envio|ins?tal|puesta\s+en\s+marcha|capacitacion|maniobra|mano\s+de\s+obra|manejo\s+y\s+entrega)' end
$$;
revoke execute on function public.partida_es_servicio(uuid, text) from public, anon;
grant execute on function public.partida_es_servicio(uuid, text) to authenticated;

-- hoja_salida: cada partida dice si es servicio, y el pedido si es solo de servicios.
do $$
declare v_def text := pg_get_functiondef('public.hoja_salida(uuid)'::regprocedure);
  a1 text := '''titulo'', l.titulo, ''descripcion'', l.descripcion, ''clave'', a.clave,';
  a2 text := '''entregado'', l.cantidad_entregada, ''titulo'', l.titulo) order by l.orden)';
  a3 text := '''puede_reabrir'', puede(''ventas'', 3),';
begin
  if v_def like '%partida_es_servicio%' then return; end if;
  if position(a1 in v_def) = 0 or position(a2 in v_def) = 0 or position(a3 in v_def) = 0 then
    raise exception 'hoja_salida ya no es la que se conocía: revisar antes de apartar los servicios';
  end if;
  v_def := replace(v_def, a1, a1 || ' ''servicio'', partida_es_servicio(l.articulo_id, l.titulo),');
  v_def := replace(v_def, a2, '''entregado'', l.cantidad_entregada, ''titulo'', l.titulo, ''servicio'', partida_es_servicio(l.articulo_id, l.titulo)) order by l.orden)');
  v_def := replace(v_def, a3, a3 || E'\n    ''solo_servicios'', exists (select 1 from pedido_lineas l where l.pedido_id = p.id)'
    || ' and not exists (select 1 from pedido_lineas l where l.pedido_id = p.id and not partida_es_servicio(l.articulo_id, l.titulo)),');
  execute v_def;
end $$;

-- entregar_pedido: sin firma si es solo servicio, y «entregado» cuando salió lo que no es servicio.
do $$
declare v_def text := pg_get_functiondef('public.entregar_pedido(uuid, text, text, text, jsonb)'::regprocedure);
  a1 text := 'if coalesce(length(trim(p_recibio)), 0) < 3 then raise exception ''Anota quién recibió'' using errcode = ''23514''; end if;';
  a2 text := 'coalesce((select max(numero) from pedido_salidas where pedido_id = p_id), 0) + 1, trim(p_recibio),';
  a3 text := 'v_n int := 0; v_completo boolean;';
  v_nuevo text;
begin
  if v_def like '%partida_es_servicio%' then return; end if;
  if position(a1 in v_def) = 0 or position(a2 in v_def) = 0 or position(a3 in v_def) = 0 or v_def !~ 'v_completo := case' then
    raise exception 'entregar_pedido ya no es la que se conocía: revisar antes de apartar los servicios';
  end if;
  v_def := replace(v_def, a3, 'v_n int := 0; v_completo boolean; v_solo_servicios boolean;');
  v_def := replace(v_def, a1,
    'v_solo_servicios := exists (select 1 from pedido_lineas pl where pl.pedido_id = p_id)'
    || E'\n    and not exists (select 1 from pedido_lineas pl where pl.pedido_id = p_id and not partida_es_servicio(pl.articulo_id, pl.titulo));'
    || E'\n  -- Un servicio no se recibe en una hoja: solo lo que sale del almacén lleva quién recibió.'
    || E'\n  if not v_solo_servicios and coalesce(length(trim(p_recibio)), 0) < 3 then raise exception ''Anota quién recibió'' using errcode = ''23514''; end if;');
  v_def := replace(v_def, a2, 'coalesce((select max(numero) from pedido_salidas where pedido_id = p_id), 0) + 1, coalesce(nullif(trim(p_recibio), ''''), ''Servicio realizado''),');
  v_nuevo := regexp_replace(v_def,
    'v_completo := case.*?else not exists \(select 1 from pedido_lineas pl where pl\.pedido_id = p_id and pl\.cantidad_entregada < pl\.cantidad\) end;',
    'v_completo := not exists (select 1 from pedido_lineas pl where pl.pedido_id = p_id and pl.cantidad_entregada < pl.cantidad'
    || E'\n                               and not partida_es_servicio(pl.articulo_id, pl.titulo));');
  if v_nuevo = v_def then raise exception 'entregar_pedido: no se encontró la regla de «entregado»'; end if;
  execute v_nuevo;
end $$;

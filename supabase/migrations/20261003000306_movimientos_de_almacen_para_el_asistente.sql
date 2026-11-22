-- =============================================================================
-- Los movimientos de almacén de un periodo, resumidos (para el asistente).
--
-- Por qué: dirección le preguntó al asistente «¿cómo fueron los movimientos de almacén la semana
-- pasada?» y contestó que el ERP no lo deja consultarlos. Era cierto: sus herramientas leían
-- existencias, reabasto y los hallazgos, pero ninguna las entradas y salidas. Darle la tabla
-- cruda no sirve (una semana son 400 renglones y lleva costo): lo que se pregunta es cuánto
-- entró, cuánto salió, a dónde, qué fue lo que más se movió y qué se ajustó.
--
-- Qué hace: movimientos_almacen(desde, hasta) regresa eso ya contado, con folios (órdenes de
-- compra, de producción, pedidos, ajustes) para poder ir a verlos. Sin costos ni importes: las
-- cantidades van en la unidad de cada artículo y no se suman entre artículos distintos.
-- Lo que se deshizo (y el movimiento que lo deshace) no cuenta: se dice cuántos fueron.
--
-- Quién: los mismos que ven los movimientos en pantalla (inventario 2 o costos 1). Solo lee y
-- corre con los permisos de quien pregunta; el permiso se revisa al entrar para que a los demás
-- les diga «sin permiso» en vez de un resumen en ceros.
-- =============================================================================

create or replace function public.movimientos_almacen(p_desde date, p_hasta date) returns jsonb
language plpgsql stable security invoker set search_path = public as $$
declare v_ini timestamptz; v_fin timestamptz; r jsonb;
begin
  if not (puede('inventario', 2) or puede('costos', 1)) then
    raise exception 'Los movimientos de almacén los ven almacén, compras, producción y dirección' using errcode = '42501';
  end if;
  if p_desde is null or p_hasta is null or p_hasta < p_desde then
    raise exception 'Hace falta el periodo: desde y hasta, en ese orden' using errcode = '22023';
  end if;
  if p_hasta - p_desde > 92 then
    raise exception 'El periodo es de tres meses como máximo: pide uno más corto' using errcode = '22023';
  end if;
  -- Días de la planta, no UTC: una salida de las 7 de la noche es de ese día.
  v_ini := p_desde::timestamp at time zone 'America/Mexico_City';
  v_fin := (p_hasta + 1)::timestamp at time zone 'America/Mexico_City';

  with todos as (
    select m.id, m.tipo, m.articulo_id, m.almacen_id, m.cantidad, m.motivo, m.fuera_de_lista, m.usuario_id, m.recibio,
      m.orden_compra_id, m.orden_produccion_id, m.pedido_id, m.ajuste_id, m.traspaso_id,
      (m.en at time zone 'America/Mexico_City')::date as dia,
      m.deshace_id is not null or exists (select 1 from movimientos_inventario d where d.deshace_id = m.id) as deshecho,
      case when m.tipo in ('entrada_compra', 'devolucion', 'inicial') then 'entradas'
           when m.tipo in ('salida_produccion', 'salida_venta', 'salida_consumo') then 'salidas'
           when m.tipo in ('traspaso_salida', 'traspaso_entrada') then 'traspasos'
           else 'ajustes' end as grupo
    from movimientos_inventario m
    where m.en >= v_ini and m.en < v_fin
  ), mov as (
    select t.*, a.clave, a.nombre, a.unidad from todos t join articulos a on a.id = t.articulo_id where not t.deshecho
  )
  select jsonb_build_object(
    'periodo', jsonb_build_object('desde', p_desde, 'hasta', p_hasta),
    'movimientos', (select count(*) from mov),
    'deshechos', (select count(*) from todos where deshecho),
    'nota', 'Cantidades en la unidad de cada artículo; no hay importes. Las salidas van en positivo; en ajustes, negativo es que bajó la existencia.',
    'por_tipo', (select coalesce(jsonb_agg(to_jsonb(x) order by x.movimientos desc), '[]'::jsonb) from (
      select case tipo when 'entrada_compra' then 'Entrada por compra' when 'devolucion' then 'Devolución (entra)'
               when 'inicial' then 'Carga inicial' when 'salida_produccion' then 'Salida a producción'
               when 'salida_venta' then 'Salida por venta' when 'salida_consumo' then 'Salida a consumo interno'
               when 'traspaso_salida' then 'Traspaso (sale)' when 'traspaso_entrada' then 'Traspaso (entra)'
               when 'ajuste_entrada' then 'Ajuste que sube' else 'Ajuste que baja' end as tipo,
        count(*) as movimientos, count(distinct articulo_id) as articulos
      from mov group by mov.tipo) x),
    'por_dia', (select coalesce(jsonb_agg(to_jsonb(x) order by x.dia), '[]'::jsonb) from (
      select dia, count(*) filter (where grupo = 'entradas') as entradas, count(*) filter (where grupo = 'salidas') as salidas,
        count(*) filter (where grupo = 'traspasos') as traspasos, count(*) filter (where grupo = 'ajustes') as ajustes
      from mov group by dia) x),
    'por_almacen', (select coalesce(jsonb_agg(to_jsonb(x) order by x.movimientos desc), '[]'::jsonb) from (
      select al.nombre as almacen, count(*) as movimientos, count(*) filter (where grupo = 'entradas') as entradas,
        count(*) filter (where grupo = 'salidas') as salidas, count(*) filter (where grupo = 'ajustes') as ajustes
      from mov join almacenes al on al.id = mov.almacen_id group by al.nombre) x),
    'quien_registro', (select coalesce(jsonb_agg(to_jsonb(x) order by x.movimientos desc), '[]'::jsonb) from (
      select coalesce(p.nombre, 'El sistema') as quien, count(*) as movimientos
      from mov left join perfiles p on p.id = mov.usuario_id group by 1) x),
    'compras_recibidas', (select jsonb_build_object('ordenes', count(*), 'partidas', coalesce(sum(x.partidas), 0),
        'lista', coalesce(jsonb_agg(to_jsonb(x) - 'n' order by x.partidas desc) filter (where x.n <= 15), '[]'::jsonb)) from (
      select oc.folio as orden, oc.proveedor, count(*) as partidas, row_number() over (order by count(*) desc) as n
      from mov join v_ordenes_compra oc on oc.id = mov.orden_compra_id where mov.tipo = 'entrada_compra' group by oc.folio, oc.proveedor) x),
    'a_produccion', (select jsonb_build_object('ordenes', count(*), 'movimientos', coalesce(sum(x.materiales), 0),
        'fuera_de_lista', coalesce(sum(x.fuera_de_lista), 0),
        'lista', coalesce(jsonb_agg(to_jsonb(x) - 'n' order by x.materiales desc) filter (where x.n <= 15), '[]'::jsonb)) from (
      select op.folio as orden, eq.nombre as equipo, count(*) as materiales, count(*) filter (where mov.fuera_de_lista) as fuera_de_lista,
        row_number() over (order by count(*) desc) as n
      from mov join ordenes_produccion op on op.id = mov.orden_produccion_id join articulos eq on eq.id = op.articulo_id
      where mov.tipo = 'salida_produccion' group by op.folio, eq.nombre) x),
    'por_venta', (select jsonb_build_object('pedidos', count(*), 'partidas', coalesce(sum(x.partidas), 0),
        'lista', coalesce(jsonb_agg(to_jsonb(x) - 'n' order by x.partidas desc) filter (where x.n <= 15), '[]'::jsonb)) from (
      select pe.folio as pedido, count(*) as partidas, row_number() over (order by count(*) desc) as n
      from mov join pedidos_basicos() pe on pe.id = mov.pedido_id where mov.tipo = 'salida_venta' group by pe.folio) x),
    'consumo_interno', (select jsonb_build_object('movimientos', count(*),
        'lista', coalesce(jsonb_agg(to_jsonb(x) - 'n' order by x.cantidad desc) filter (where x.n <= 15), '[]'::jsonb)) from (
      select clave, nombre, unidad, -sum(cantidad) as cantidad, count(*) as veces,
        string_agg(distinct nullif(trim(recibio), ''), ', ') as recibio, row_number() over (order by count(*) desc) as n
      from mov where tipo = 'salida_consumo' group by clave, nombre, unidad) x),
    'lo_que_mas_salio', (select coalesce(jsonb_agg(to_jsonb(x) order by x.veces desc, x.cantidad desc), '[]'::jsonb) from (
      select clave, nombre, unidad, -sum(cantidad) as cantidad, count(*) as veces
      from mov where grupo = 'salidas' group by clave, nombre, unidad order by count(*) desc, -sum(cantidad) desc limit 15) x),
    'lo_que_mas_entro', (select coalesce(jsonb_agg(to_jsonb(x) order by x.veces desc, x.cantidad desc), '[]'::jsonb) from (
      select clave, nombre, unidad, sum(cantidad) as cantidad, count(*) as veces
      from mov where tipo = 'entrada_compra' group by clave, nombre, unidad order by count(*) desc, sum(cantidad) desc limit 15) x),
    'ajustes', jsonb_build_object(
      'que_suben', (select count(*) from mov where tipo = 'ajuste_entrada'),
      'que_bajan', (select count(*) from mov where tipo = 'ajuste_salida'),
      -- Los pendientes son de hoy, no del periodo: mientras nadie los autoriza no mueven nada.
      'pendientes_de_autorizar_hoy', (select count(*) from ajustes_inventario where estado = 'pendiente'),
      'los_mas_grandes', (select coalesce(jsonb_agg(to_jsonb(x) order by abs(x.cantidad) desc), '[]'::jsonb) from (
        select aj.folio as ajuste, mov.clave, mov.nombre, mov.unidad, mov.cantidad, al.nombre as almacen, left(coalesce(aj.motivo, mov.motivo), 160) as motivo
        from mov join almacenes al on al.id = mov.almacen_id left join ajustes_inventario aj on aj.id = mov.ajuste_id
        where mov.grupo = 'ajustes' order by abs(mov.cantidad) desc limit 12) x)),
    'traspasos', (select count(distinct traspaso_id) from mov where grupo = 'traspasos')
  ) into r;
  return r;
end $$;
revoke execute on function public.movimientos_almacen(date, date) from public, anon;
grant execute on function public.movimientos_almacen(date, date) to authenticated;

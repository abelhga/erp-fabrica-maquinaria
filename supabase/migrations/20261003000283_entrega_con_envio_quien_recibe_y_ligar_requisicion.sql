-- =============================================================================
-- Tres cosas que almacén y compras pidieron en pendientes (12 nov).
--
-- 1. Un pedido con envío se entrega desde Envíos, no desde el pedido.
--    Por qué: Noemí entregó PED-26-840 y 841 con «Entregar» del pedido, y sus envíos («el cliente
--    recoge») se quedaron abiertos en Envíos como si faltara entregarlos. Entregar desde Envíos sí
--    cierra el pedido (_entregar_en_pedido); al revés no. Además, por el pedido se saltaba el empaque
--    con fotos y check list que Envíos pide antes de que algo salga. Abel eligió un solo camino:
--    si el pedido tiene un envío abierto, entregar_pedido se niega y dice cuál; la hoja de salida
--    trae los envíos abiertos para que la pantalla lo diga antes de llenar nada.
--
-- 2. «¿Quién lo recibe?» en las salidas sugiere a todo el personal activo.
--    Por qué: la lista salía de personal_de_piso() (solo quien está en cuadrillas), así que cuando
--    administración, ventas o ingeniería pedían tóner o papelería, su nombre no aparecía. La función
--    nueva solo da el nombre (nada de datos personales) y la usa quien registra salidas.
--
-- 3. Ligar una requisición a una orden de compra que ya existe.
--    Por qué: José Antonio compra a veces sin pasar por la requisición (la OC ya estaba hecha cuando
--    Noemí la pidió, o la hizo a mano). La partida se quedaba «pendiente» para siempre: Noemí no sabía
--    que ya venía, no le llegaba el aviso de «Llegó material» y el reabasto la seguía restando como
--    pendiente. Ligarla la pone «ordenada» como si la orden hubiera salido de ella; si la orden ya
--    llegó, a quien la pidió le avisa en ese momento.
-- =============================================================================

-- 1 ---------------------------------------------------------------------------
do $$
declare v_def text; v_nuevo text;
begin
  v_def := pg_get_functiondef('public.entregar_pedido(uuid,text,text,text,jsonb)'::regprocedure);
  v_nuevo := replace(v_def,
    $a$  if p.estado in ('entregado', 'cancelado') then raise exception 'El pedido ya está %', p.estado; end if;
$a$,
    $a$  if p.estado in ('entregado', 'cancelado') then raise exception 'El pedido ya está %', p.estado; end if;
  -- Con un envío abierto, la salida va por Envíos (empaque con fotos y check list); si no, el
  -- envío se queda abierto y el material parece por salir dos veces.
  if exists (select 1 from envios where pedido_id = p_id and estado not in ('entregado', 'cancelado')) then
    raise exception 'Este pedido sale con el envío %: entrégalo desde Envíos (ahí van el empaque y las fotos), o cancela el envío si ya no aplica',
      (select string_agg(folio, ', ' order by solicitado_en) from envios where pedido_id = p_id and estado not in ('entregado', 'cancelado'))
      using errcode = '23514';
  end if;
$a$);
  if v_nuevo = v_def then raise exception 'No se encontró dónde poner la revisión del envío en entregar_pedido'; end if;
  execute v_nuevo;

  v_def := pg_get_functiondef('public.hoja_salida(uuid)'::regprocedure);
  v_nuevo := replace(v_def,
    $a$'puede_entregar', puede_entregar(p.vendedor_id),$a$,
    $a$'puede_entregar', puede_entregar(p.vendedor_id),
    'envios_abiertos', coalesce((select jsonb_agg(jsonb_build_object('id', e.id, 'folio', e.folio, 'tipo', e.tipo, 'estado', e.estado) order by e.solicitado_en)
                                 from envios e where e.pedido_id = p.id and e.estado not in ('entregado', 'cancelado')), '[]'::jsonb),$a$);
  if v_nuevo = v_def then raise exception 'No se encontró dónde poner los envíos abiertos en hoja_salida'; end if;
  execute v_nuevo;
end $$;

-- 2 ---------------------------------------------------------------------------
create or replace function public.quien_recibe_material()
returns table (id uuid, nombre text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not (puede('inventario', 2) or puede('produccion', 2)) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  return query select e.id, e.nombre from empleados e where e.activo order by e.nombre;
end $$;
revoke execute on function public.quien_recibe_material() from public, anon;
grant execute on function public.quien_recibe_material() to authenticated;

-- 3 ---------------------------------------------------------------------------
-- Para cada partida pendiente, las órdenes de compra recientes del mismo artículo que no se han
-- cancelado: las que compras puede ligarle. Desde 30 días antes de la requisición (la orden pudo
-- hacerse primero). Invoker: cada quien ve solo las órdenes que ya podía ver.
create or replace function public.requisicion_ocs_candidatas()
returns table (requisicion_linea_id uuid, oc_linea_id uuid, orden_compra_id uuid, oc_folio text, oc_estado text,
               cantidad numeric, recibido numeric, creada date)
language sql stable security invoker set search_path = public as $$
  select rl.id, l.id, o.id, o.folio, o.estado::text, l.cantidad, l.recibido, o.creado_en::date
  from requisicion_lineas rl
  join requisiciones r on r.id = rl.requisicion_id
  join oc_lineas l on l.articulo_id = rl.articulo_id
  join ordenes_compra o on o.id = l.orden_compra_id
  where rl.estado = 'pendiente' and o.estado in ('borrador', 'enviada', 'parcial', 'recibida')
    and o.creado_en >= r.creado_en - interval '30 days'
  order by rl.id, o.creado_en desc
$$;
revoke execute on function public.requisicion_ocs_candidatas() from public, anon;
grant execute on function public.requisicion_ocs_candidatas() to authenticated;

create or replace function public.ligar_requisicion_oc(p_req_linea uuid, p_oc_linea uuid)
returns void language plpgsql security definer set search_path = public as $$
declare rl requisicion_lineas; r requisiciones; l oc_lineas; o ordenes_compra; v_art text;
begin
  if not puede('compras', 2) then raise exception 'Solo compras liga requisiciones con órdenes de compra' using errcode = '42501'; end if;
  select * into rl from requisicion_lineas where id = p_req_linea for update;
  if rl.id is null then raise exception 'No existe la partida de la requisición'; end if;
  if rl.estado <> 'pendiente' then raise exception 'Esa partida ya no está pendiente (está %). Recarga la lista.', rl.estado; end if;
  select * into l from oc_lineas where id = p_oc_linea;
  if l.id is null then raise exception 'No existe la partida de la orden de compra'; end if;
  select * into o from ordenes_compra where id = l.orden_compra_id;
  if o.estado not in ('borrador', 'enviada', 'parcial', 'recibida') then raise exception 'La orden % está %: no se le liga nada', o.folio, o.estado; end if;
  if l.articulo_id is distinct from rl.articulo_id then raise exception 'La partida de la orden es de otro artículo'; end if;

  update requisicion_lineas set estado = 'ordenada', oc_linea_id = l.id,
    notas = concat_ws(' · ', notas, format('Ligada a %s por %s', o.folio, (select nombre from perfiles where id = auth.uid())))
  where id = rl.id;
  select * into r from requisiciones where id = rl.requisicion_id;
  update requisiciones set estado = 'en_compra'
  where id = r.id and estado = 'abierta'
    and not exists (select 1 from requisicion_lineas x where x.requisicion_id = r.id and x.estado = 'pendiente');

  -- Si ya llegó, el aviso de «Llegó material» ya pasó sin ella: se le da ahora.
  if o.estado in ('parcial', 'recibida') and r.solicitante_id is not null then
    select nombre into v_art from articulos where id = rl.articulo_id;
    perform avisar(array[r.solicitante_id], 'oc_recibida', format('Ya llegó lo de %s', r.folio),
      format('%s · %s (%s)', v_art, o.folio, case o.estado when 'recibida' then 'completa' else 'llegó una parte' end),
      '/compras/ordenes/' || o.id, 'ordenes_compra', o.id::text);
  end if;
end $$;
revoke execute on function public.ligar_requisicion_oc(uuid, uuid) from public, anon;
grant execute on function public.ligar_requisicion_oc(uuid, uuid) to authenticated;

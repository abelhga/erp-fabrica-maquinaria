-- =============================================================================
-- Almacén ve los pedidos de componentes por entregar (con si hay o falta), y los avisos de ajustes de
-- un conteo llegan juntos.
--
-- Por qué: Isaac vio que nadie había pedido ni preparado nada de PED-26-842 (banda blanca de 20") ni
-- de PED-26-843 (grapas RS125): no había existencia y nadie levantó requisición. A Noemí sí le llegó
-- el aviso de «Pedido nuevo», pero en 7 días le llegaron 249 avisos (179 sin leer): 66 eran «ajuste
-- aprobado», uno por artículo del conteo. Un pedido no puede depender de un aviso que se pierde.
--
-- Qué cambia:
--   * pedidos_por_surtir(): cada partida de componente o materia prima de los pedidos abiertos (sin
--     Mercado Libre, que tiene su flujo, ni los históricos) que falta por entregar, con lo que hay en
--     planta para ella, lo que viene en OC y en requisición, y si ya tiene envío solicitado. Sin precios.
--   * pedir_material_pedido(pedido): una requisición con lo que falta de ese pedido (lo que no cubre
--     la existencia ni lo que ya viene en camino o pedido), con el folio del pedido en la nota y la
--     fecha compromiso como «necesaria para». La lista la ven almacén, compras y la planta; cada
--     vendedor, la de sus pedidos.
--   * Los avisos de ajustes resueltos de un conteo se juntan en uno por conteo, que se actualiza; los
--     ajustes sueltos (fuera de un conteo) siguen avisando uno por uno. Los avisos sin leer que ya
--     estaban, uno por artículo, se juntan igual.
-- =============================================================================

create or replace function public.pedidos_por_surtir()
returns table (pedido_id uuid, folio text, cliente text, vendedor text, fecha_compromiso date, estado text,
               articulo_id uuid, clave text, articulo text, unidad text, pendiente numeric,
               disponible numeric, en_camino numeric, en_requisicion numeric, situacion text, envio text)
language sql stable security definer set search_path = public as $$
  -- Almacén, compras y la planta ven todos; un vendedor, solo los suyos (ventas tiene inventario 1 para
  -- ver existencias, pero no los clientes de los demás).
  with yo as materialized (select puede('inventario', 2) or puede('compras', 1) or puede('produccion', 2) todos,
                                  puede('ventas', 1) suyos, auth.uid() id),
  l as (
    select p.id pedido_id, p.folio, p.cliente_id, p.vendedor_id, p.fecha_compromiso, p.estado::text estado,
           a.id articulo_id, a.clave, a.nombre, a.unidad,
           sum((pl.cantidad - coalesce(pl.cantidad_entregada, 0)) * coalesce(pl.piezas_por_venta, 1)) pendiente
    from pedidos p join pedido_lineas pl on pl.pedido_id = p.id join articulos a on a.id = pl.articulo_id, yo
    where (yo.todos or (yo.suyos and p.vendedor_id = yo.id)) and p.estado in ('confirmado', 'en_produccion', 'listo') and not p.historico
      and p.canal <> 'mercadolibre' and a.tipo in ('componente', 'materia_prima')
      and pl.cantidad > coalesce(pl.cantidad_entregada, 0)
    group by 1, 2, 3, 4, 5, 6, 7, 8, 9, 10
  ), x as (
    select l.*,
      -- En planta, menos lo apartado para otras órdenes o pedidos (lo apartado para este pedido sí cuenta).
      greatest(coalesce((select sum(e.cantidad) from existencias e join almacenes al on al.id = e.almacen_id
                         where e.articulo_id = l.articulo_id and al.disponible_para_planta), 0)
               - coalesce((select sum(r.cantidad - r.surtido) from reservas r
                           where r.articulo_id = l.articulo_id and r.estado = 'activa' and r.pedido_id is distinct from l.pedido_id), 0), 0) disponible,
      coalesce((select sum(ol.pendiente) from v_oc_lineas ol join ordenes_compra o on o.id = ol.orden_compra_id
                where ol.articulo_id = l.articulo_id and o.estado in ('enviada', 'parcial') and ol.pendiente > 0), 0) en_camino,
      coalesce((select sum(rl.cantidad) from requisicion_lineas rl join requisiciones q on q.id = rl.requisicion_id
                where rl.articulo_id = l.articulo_id and rl.estado = 'pendiente' and q.estado in ('abierta', 'en_compra')), 0) en_requisicion
    from l
  )
  select x.pedido_id, x.folio, (select nombre from clientes where id = x.cliente_id), (select nombre from perfiles where id = x.vendedor_id),
         x.fecha_compromiso, x.estado, x.articulo_id, x.clave, x.nombre, x.unidad, x.pendiente,
         x.disponible, x.en_camino, x.en_requisicion,
         case when x.disponible >= x.pendiente then 'hay'
              when x.disponible + x.en_camino + x.en_requisicion >= x.pendiente then 'pedido'
              else 'falta' end,
         (select e.folio || ' · ' || e.estado from envios e where e.pedido_id = x.pedido_id and e.estado not in ('cancelado')
          order by e.solicitado_en desc limit 1)
  from x
  order by x.fecha_compromiso nulls last, x.folio, x.nombre
$$;
revoke execute on function public.pedidos_por_surtir() from public, anon;
grant execute on function public.pedidos_por_surtir() to authenticated;

-- Requisición con lo que le falta a un pedido. Regresa folio y partidas.
create or replace function public.pedir_material_pedido(p_pedido uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_ped pedidos; v_req requisiciones; v_n int;
begin
  select * into v_ped from pedidos where id = p_pedido;
  if v_ped.id is null then raise exception 'No existe el pedido'; end if;
  if not (puede('inventario', 2) or puede('compras', 2) or v_ped.vendedor_id = auth.uid()) then
    raise exception 'Sin permiso para pedir material a compras' using errcode = '42501';
  end if;
  if not exists (select 1 from pedidos_por_surtir() s where s.pedido_id = p_pedido
                 and s.pendiente - s.disponible - s.en_camino - s.en_requisicion > 0) then
    raise exception 'Nada que pedir: lo que falta ya está en existencia, en una OC o en una requisición';
  end if;
  insert into requisiciones (origen, necesaria_para, notas)
  values ('manual', v_ped.fecha_compromiso,
          format('Para el pedido %s (%s)', v_ped.folio, coalesce((select nombre from clientes where id = v_ped.cliente_id), 'sin cliente')))
  returning * into v_req;
  insert into requisicion_lineas (requisicion_id, articulo_id, cantidad, notas)
  select v_req.id, s.articulo_id, s.pendiente - s.disponible - s.en_camino - s.en_requisicion, v_ped.folio
  from pedidos_por_surtir() s
  where s.pedido_id = p_pedido and s.pendiente - s.disponible - s.en_camino - s.en_requisicion > 0;
  get diagnostics v_n = row_count;
  return jsonb_build_object('id', v_req.id, 'folio', v_req.folio, 'partidas', v_n);
end $$;
revoke execute on function public.pedir_material_pedido(uuid) from public, anon;
grant execute on function public.pedir_material_pedido(uuid) to authenticated;

-- Avisos de ajustes de un conteo: uno por conteo para quien los pidió, que se va actualizando.
create or replace function public._aviso_ajustes_de_conteo(p_conteo uuid, p_usuario uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_nombre text; v_ap int; v_re int; v_pe int; v_id bigint;
begin
  if p_usuario is null or p_usuario = auth.uid() then return; end if;
  select nombre into v_nombre from conteos where id = p_conteo;
  select count(*) filter (where estado = 'aprobado'), count(*) filter (where estado = 'rechazado'), count(*) filter (where estado = 'pendiente')
  into v_ap, v_re, v_pe from ajustes_inventario where conteo_id = p_conteo;
  select id into v_id from avisos where usuario_id = p_usuario and tipo = 'ajustes_de_conteo' and registro_id = p_conteo::text
    and leido_en is null order by creado_en desc limit 1;
  if v_id is null then
    insert into avisos (usuario_id, tipo, titulo, cuerpo, ruta, tabla, registro_id)
    values (p_usuario, 'ajustes_de_conteo', '', '', '/almacen/movimientos?vista=ajustes', 'conteos', p_conteo::text)
    returning id into v_id;
  end if;
  update avisos set
    titulo = format('Ajustes del conteo «%s»: %s aprobado(s), %s rechazado(s)', coalesce(v_nombre, 'sin nombre'), v_ap, v_re),
    cuerpo = case when v_pe > 0 then format('Faltan %s por autorizar.', v_pe) else 'Ya se resolvieron todos.' end,
    creado_en = now()
  where id = v_id;
end $$;
revoke execute on function public._aviso_ajustes_de_conteo(uuid, uuid) from public, anon, authenticated;

do $$
declare d text; n text;
begin
  d := pg_get_functiondef('public.aviso_ajuste()'::regprocedure);
  n := replace(d, $a$  elsif tg_op = 'UPDATE' and old.estado = 'pendiente' and new.estado <> 'pendiente' then
    perform avisar($a$, $a$  elsif tg_op = 'UPDATE' and old.estado = 'pendiente' and new.estado <> 'pendiente' and new.conteo_id is not null then
    -- Del conteo salen decenas a la vez: un solo aviso por conteo que se actualiza (290).
    perform _aviso_ajustes_de_conteo(new.conteo_id, new.solicitado_por);
  elsif tg_op = 'UPDATE' and old.estado = 'pendiente' and new.estado <> 'pendiente' then
    perform avisar($a$);
  if n = d then raise exception 'aviso_ajuste: no encontré el aviso al resolver'; end if;
  execute n;
end $$;

-- Los avisos sin leer que ya llegaron uno por artículo del conteo se juntan en uno por conteo.
do $$
declare r record;
begin
  for r in
    select distinct a.conteo_id, v.usuario_id
    from avisos v join ajustes_inventario a on a.id::text = v.registro_id
    where v.tipo in ('ajuste_aprobado', 'ajuste_rechazado') and v.leido_en is null and a.conteo_id is not null
  loop
    perform _aviso_ajustes_de_conteo(r.conteo_id, r.usuario_id);
  end loop;
  delete from avisos v using ajustes_inventario a
  where a.id::text = v.registro_id and v.tipo in ('ajuste_aprobado', 'ajuste_rechazado') and v.leido_en is null and a.conteo_id is not null;
end $$;

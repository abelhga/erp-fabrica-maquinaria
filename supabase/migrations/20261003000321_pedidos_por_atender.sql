-- =============================================================================
-- Cada pedido sabe qué le falta y a quién le toca, con numerito en el menú y aviso diario.
--
-- Por qué: en la reunión del 25 de noviembre el problema más real fue que pedidos de componentes (por
-- ejemplo metros de banda) pasan días sin que nadie los atienda, y el vendedor se da cuenta tarde. Con
-- datos del 26 de nov: 8 pedidos abiertos sin ninguna orden, salida, envío ni entrega; PED-26-803 con
-- 38 días (faltaba 1 de 6 aerovibradores), PED-26-813 con 29 días y el colector SÍ estaba en almacén,
-- PED-26-858 con 22 m de banda que nadie pidió. Un pedido de equipo tiene dueño (producción le crea su
-- orden); uno de componentes no le avisaba a nadie. La lista de «por surtir» (290) ya decía si hay o
-- falta, pero vivía en el Inicio de almacén y nadie la veía como suya.
--
-- Qué hay:
--   · pedidos_por_atender(): una fila por pedido y área con lo que falta hacer, desde cuándo (días
--     hábiles desde el pedido) y si ya se pasó del tiempo de esa área:
--       almacén → entregar lo que ya hay; compras → comprar lo que falta (sin OC ni requisición);
--       producción → crear la orden de un equipo o fabricar una pieza nuestra sin existencia;
--       ventas (el vendedor) → ligar al catálogo una partida escrita a mano, o conseguir el anticipo
--       (si las condiciones lo piden, no hay cobro y nada ha empezado: entonces no se alarma a nadie más).
--     Lo que ya viene en una OC o una requisición no es pendiente de nadie. Sin Mercado Libre (tiene su
--     flujo) ni pedidos de la hoja. Los días por área viven en configuracion (pedidos_atencion).
--   · mis_pedidos_por_atender(): el numerito del menú. Almacén, compras y producción ven lo suyo; el
--     vendedor, sus pedidos atrasados; la gerencia de ventas, todos los atrasados; dirección, los que ya
--     pasaron el tiempo de escalar.
--   · avisar_pedidos_por_atender(): un aviso al día por persona con su lista (no uno por pedido: los 249
--     avisos de Noemí en 7 días enseñaron que muchos avisos no se leen). Corre de lunes a viernes.
--   · Regla nocturna pedido_atorado: el pedido atrasado sale en «Por revisar» de quien le toca y se
--     cierra sola en cuanto se atiende.
-- =============================================================================

insert into public.configuracion (clave, valor, descripcion)
values ('pedidos_atencion', '{"almacen": 1, "compras": 2, "produccion": 2, "ventas": 2, "direccion": 4}'::jsonb,
        'Días hábiles que puede esperar un pedido en cada área antes de contar como atrasado (y en dirección, antes de escalarle)')
on conflict (clave) do nothing;

-- La lista de por surtir (290) sin depender de la sesión: el aviso diario corre sin nadie conectado.
create or replace function public._pedidos_por_surtir(p_todos boolean, p_yo uuid)
returns table (pedido_id uuid, folio text, cliente text, vendedor text, fecha_compromiso date, estado text,
               articulo_id uuid, clave text, articulo text, unidad text, pendiente numeric,
               disponible numeric, en_camino numeric, en_requisicion numeric, situacion text, envio text)
language sql stable security definer set search_path = public as $$
  -- Almacén, compras y la planta ven todos; un vendedor, solo los suyos (ventas tiene inventario 1 para
  -- ver existencias, pero no los clientes de los demás).
  with yo as materialized (select coalesce(p_todos, false) todos, p_yo is not null suyos, p_yo id),
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
revoke execute on function public._pedidos_por_surtir(boolean, uuid) from public, anon, authenticated;

-- La de siempre (290), ahora encima de la interna: misma regla de quién ve qué.
create or replace function public.pedidos_por_surtir()
returns table (pedido_id uuid, folio text, cliente text, vendedor text, fecha_compromiso date, estado text,
               articulo_id uuid, clave text, articulo text, unidad text, pendiente numeric,
               disponible numeric, en_camino numeric, en_requisicion numeric, situacion text, envio text)
language sql stable security definer set search_path = public as $$
  select * from _pedidos_por_surtir(puede('inventario', 2) or puede('compras', 1) or puede('produccion', 2),
                                    case when puede('ventas', 1) then auth.uid() end)
$$;
revoke execute on function public.pedidos_por_surtir() from public, anon;
grant execute on function public.pedidos_por_surtir() to authenticated;

create or replace function public._pedidos_por_atender(p_todos boolean, p_yo uuid)
returns table (pedido_id uuid, folio text, cliente text, vendedor_id uuid, vendedor text, creado_en timestamptz,
               fecha_compromiso date, area text, accion text, detalle text, dias int, atrasado boolean)
language sql stable security definer set search_path = public as $$
  with yo as materialized (
    select coalesce(p_todos, false) todos, p_yo id,
           coalesce((select valor from configuracion where clave = 'pedidos_atencion'), '{}'::jsonb) cfg
  ),
  p as materialized (
    select p.* from pedidos p, yo
    where p.estado in ('confirmado', 'en_produccion', 'listo') and not p.historico and p.canal <> 'mercadolibre'
      and (yo.todos or p.vendedor_id = yo.id)
  ),
  -- ¿Espera el anticipo? Las condiciones lo piden, no hay ningún cobro y nada ha empezado.
  anticipo as (
    select p.id from p
    where sin_acentos(coalesce(p.condiciones_pago, '')) ~* 'anticip'
      and not exists (select 1 from cobros c where c.pedido_id = p.id and c.monto > 0)
      and not exists (select 1 from ordenes_produccion o where o.pedido_id = p.id and o.estado <> 'cancelada')
      and not exists (select 1 from movimientos_inventario m where m.pedido_id = p.id)
  ),
  -- Componentes y materia prima: lo que dice la lista de por surtir (290).
  s as (
    select s.*, exists (select 1 from bom_lineas b where b.padre_id = s.articulo_id) fabricado
    from _pedidos_por_surtir(true, null) s where s.pedido_id in (select id from p) and s.pedido_id not in (select id from anticipo)
  ),
  filas as (
    select a.id pedido_id, 'ventas' area, 'Conseguir el anticipo' accion,
           'Las condiciones de pago piden anticipo y no hay ningún cobro registrado. Mientras, no se surte ni se fabrica.' detalle
    from anticipo a
    union all
    select s.pedido_id, 'almacen', 'Entregar lo que ya hay',
           string_agg(format('%s × %s (hay %s)', s.articulo, trim_scale(s.pendiente), trim_scale(s.disponible)), ' · ' order by s.articulo)
    from s where s.situacion = 'hay' group by s.pedido_id
    union all
    select s.pedido_id, 'compras', 'Comprar lo que falta',
           string_agg(format('%s: faltan %s', s.articulo, trim_scale(s.pendiente - s.disponible - s.en_camino - s.en_requisicion)), ' · ' order by s.articulo)
    from s where s.situacion = 'falta' and not s.fabricado group by s.pedido_id
    union all
    select s.pedido_id, 'produccion', 'Fabricar lo que no hay',
           string_agg(format('%s: faltan %s', s.articulo, trim_scale(s.pendiente - s.disponible)), ' · ' order by s.articulo)
    from s where s.situacion = 'falta' and s.fabricado group by s.pedido_id
    union all
    -- Equipos y subensambles: que tengan su orden.
    select x.pedido_id, 'produccion', 'Crear la orden de producción',
           string_agg(format('%s: faltan %s', x.nombre, trim_scale(x.falta)), ' · ' order by x.nombre)
    from (
      select l.pedido_id, a.nombre,
        sum((l.cantidad - coalesce(l.cantidad_entregada, 0)) * coalesce(l.piezas_por_venta, 1))
          - coalesce((select sum(o.cantidad) from ordenes_produccion o
                      where o.pedido_id = l.pedido_id and o.articulo_id = a.id and o.estado <> 'cancelada'), 0) falta
      from pedido_lineas l join articulos a on a.id = l.articulo_id
      where l.pedido_id in (select id from p) and l.pedido_id not in (select id from anticipo)
        and a.tipo in ('equipo', 'subensamble') and l.cantidad > coalesce(l.cantidad_entregada, 0)
      group by l.pedido_id, a.id, a.nombre) x
    where x.falta > 0 group by x.pedido_id
    union all
    -- Partidas escritas a mano: nadie sabe qué surtir, comprar o fabricar hasta que se ligan al catálogo.
    select l.pedido_id, 'ventas', 'Ligar al catálogo',
           string_agg(format('«%s»', btrim(l.titulo)), ' · ' order by l.orden)
    from pedido_lineas l
    where l.pedido_id in (select id from p) and l.articulo_id is null and l.cantidad > coalesce(l.cantidad_entregada, 0)
      and not partida_es_servicio(null, l.titulo)
      -- Si el pedido ya tiene órdenes o entregas, la partida a mano es un resumen (PED-26-798), no algo por hacer.
      and not exists (select 1 from ordenes_produccion o where o.pedido_id = l.pedido_id and o.estado <> 'cancelada')
      and not exists (select 1 from pedido_salidas ps where ps.pedido_id = l.pedido_id and ps.anulada_en is null)
    group by l.pedido_id
  )
  select p.id, p.folio, (select nombre from clientes where id = p.cliente_id), p.vendedor_id,
         (select nombre from perfiles where id = p.vendedor_id), p.creado_en, p.fecha_compromiso,
         f.area, f.accion, f.detalle, dias_habiles_desde(p.creado_en),
         dias_habiles_desde(p.creado_en) >= coalesce((yo.cfg->>f.area)::int, 2)
  from filas f join p on p.id = f.pedido_id, yo
  order by dias_habiles_desde(p.creado_en) desc, p.folio, f.area
$$;
revoke execute on function public._pedidos_por_atender(boolean, uuid) from public, anon, authenticated;

create or replace function public.pedidos_por_atender()
returns table (pedido_id uuid, folio text, cliente text, vendedor_id uuid, vendedor text, creado_en timestamptz,
               fecha_compromiso date, area text, accion text, detalle text, dias int, atrasado boolean)
language sql stable security definer set search_path = public as $$
  -- Almacén, compras, la planta y la gerencia de ventas ven todos; un vendedor, los suyos.
  select * from _pedidos_por_atender(puede('ventas', 3) or puede('inventario', 2) or puede('compras', 2) or puede('produccion', 2), auth.uid())
$$;
revoke execute on function public.pedidos_por_atender() from public, anon;
grant execute on function public.pedidos_por_atender() to authenticated;

-- Qué área es de cada quien (las que dirección también tiene no cuentan: dirección ve lo escalado).
create or replace function public.mis_areas_de_pedidos() returns text[]
language sql stable security definer set search_path = public as $$
  select array_remove(array[
    case when puede('inventario', 3) then 'almacen' end,
    case when puede('compras', 3) then 'compras' end,
    case when puede('produccion', 3) then 'produccion' end], null)
$$;
revoke execute on function public.mis_areas_de_pedidos() from public, anon;
grant execute on function public.mis_areas_de_pedidos() to authenticated;

create or replace function public.mis_pedidos_por_atender() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_dir boolean := 'direccion' = any(mis_roles()); v_ger boolean := puede('ventas', 3);
  v_areas text[] := mis_areas_de_pedidos(); v_esc int; r jsonb;
begin
  v_esc := coalesce((select (valor->>'direccion')::int from configuracion where clave = 'pedidos_atencion'), 4);
  select jsonb_build_object('total', count(distinct x.pedido_id), 'atrasados', count(distinct x.pedido_id) filter (where x.atrasado))
  into r
  from pedidos_por_atender() x
  where case
    when v_dir then x.dias >= v_esc
    when v_ger then x.atrasado
    else x.area = any(v_areas) or (x.vendedor_id = auth.uid() and x.atrasado) end;
  return r;
end $$;
revoke execute on function public.mis_pedidos_por_atender() from public, anon;
grant execute on function public.mis_pedidos_por_atender() to authenticated;

-- Quiénes atienden un área (sin dirección: a ella le llega lo escalado).
create or replace function public.usuarios_de_area_pedidos(p_area text) returns setof uuid
language sql stable security definer set search_path = public as $$
  select distinct ur.usuario_id
  from usuario_roles ur join permisos_rol pr on pr.rol = ur.rol
  join perfiles pf on pf.id = ur.usuario_id
  where coalesce(pf.activo, true)
    and not exists (select 1 from usuario_roles d where d.usuario_id = ur.usuario_id and d.rol = 'direccion')
    and ((p_area = 'almacen' and pr.modulo = 'inventario' and pr.nivel >= 3)
      or (p_area = 'compras' and pr.modulo = 'compras' and pr.nivel >= 3)
      or (p_area = 'produccion' and pr.modulo = 'produccion' and pr.nivel >= 3))
$$;
revoke execute on function public.usuarios_de_area_pedidos(text) from public, anon, authenticated;

-- Un aviso al día por persona, con su lista. Corre sin sesión, con la lista completa.
create or replace function public.avisar_pedidos_por_atender() returns int
language plpgsql security definer set search_path = public as $$
declare v_esc int; r record; v_n int := 0;
begin
  v_esc := coalesce((select (valor->>'direccion')::int from configuracion where clave = 'pedidos_atencion'), 4);
  for r in
    with destinos as (
      select u usuario, x.* from _pedidos_por_atender(true, null) x, usuarios_de_area_pedidos(x.area) u where x.atrasado
      union
      select x.vendedor_id, x.* from _pedidos_por_atender(true, null) x where x.atrasado and x.vendedor_id is not null
      union
      select d, x.* from _pedidos_por_atender(true, null) x, usuarios_con_rol('direccion') d where x.dias >= v_esc
    )
    select usuario, count(distinct pedido_id) n,
      -- La planta (almacén, compras, producción) abre la lista en Producción → Pedidos; los demás, en Ventas.
      case when exists (select 1 from usuario_roles ur join permisos_rol pr on pr.rol = ur.rol where ur.usuario_id = usuario
                        and pr.modulo in ('inventario', 'compras', 'produccion') and pr.nivel >= 3)
                and not exists (select 1 from usuario_roles d where d.usuario_id = usuario and d.rol = 'direccion')
           then '/produccion/pedidos?filtro=atender' else '/ventas/pedidos?vista=atender' end ruta,
      string_agg(distinct format('%s (%s días): %s', folio, dias, lower(accion)), '; ') lista
    from destinos where usuario is not null group by usuario
  loop
    -- Uno por persona y día: si ya está el de hoy, se actualiza.
    update avisos set cuerpo = r.lista, titulo = format('%s pedido(s) esperan que los atiendan', r.n), leido_en = null
    where usuario_id = r.usuario and tipo = 'pedidos_por_atender' and creado_en::date = hoy_planta();
    if not found then
      insert into avisos (usuario_id, tipo, titulo, cuerpo, ruta)
      values (r.usuario, 'pedidos_por_atender', format('%s pedido(s) esperan que los atiendan', r.n), r.lista, r.ruta);
    end if;
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;
revoke execute on function public.avisar_pedidos_por_atender() from public, anon, authenticated;

-- Regla nocturna: el pedido atrasado, a quien le toca. Se cierra sola cuando se atiende.
create or replace function public.revision_r_pedido_atorado() returns setof public.revision_hallazgo_nuevo
language sql stable security definer set search_path = public, extensions as $$
  select 'pedidos', x.pedido_id::text, '/ventas/pedidos/' || x.pedido_id,
    format('%s: %s (%s días hábiles)', x.folio, x.accion, x.dias),
    format('El pedido %s de %s lleva %s días hábiles y sigue esperando: %s. %s', x.folio, coalesce(x.cliente, 'sin cliente'), x.dias,
           lower(x.accion), x.detalle),
    jsonb_build_array(jsonb_build_object('tipo', 'pedido', 'folio', x.folio, 'detalle', x.detalle)),
    case when x.area = 'ventas' then array_remove(array[x.vendedor_id], null)
         else array(select usuarios_de_area_pedidos(x.area)) end,
    case when x.dias >= 5 then 'alta' else 'media' end,
    null::jsonb,
    'pedido_atorado:' || x.pedido_id || ':' || x.area
  from _pedidos_por_atender(true, null) x
  where x.atrasado
$$;
revoke execute on function public.revision_r_pedido_atorado() from public, anon, authenticated;

insert into public.revision_reglas (clave, modulo, nombre, descripcion, para, se_resuelve_sola) values
  ('pedido_atorado', 'ventas', 'Pedidos que nadie ha atendido',
   'Pedidos que pasaron el tiempo de su área sin atenderse: almacén sin entregar lo que hay, compras sin pedir lo que falta, producción sin crear la orden o fabricar, o el vendedor sin ligar una partida al catálogo o sin el anticipo. Le sale a quien le toca y se cierra sola cuando se atiende.',
   'responsable', true)
on conflict (clave) do nothing;

-- De lunes a viernes a las 8:37 de la planta (14:37 UTC).
do $$ begin
  perform cron.schedule('pedidos-por-atender', '37 14 * * 1-5', 'select public.avisar_pedidos_por_atender()');
exception when others then null;  -- sin pg_cron (base local de pruebas) no se programa
end $$;

-- =============================================================================
-- Los servicios no llevan inventario: se cubren con su compra o con «Marcar hecho».
--
-- Por qué: un servicio (un vulcanizado en la planta del proveedor, un maquilado, un flete) no es una
-- pieza que entre o salga del almacén, pero el ERP lo trataba como material. 73 de 75 servicios
-- «controlaban inventario»; al recibir su orden de compra se les daba entrada a un almacén, y en la
-- orden de producción salían «por surtir», así que para cerrar el renglón alguien tenía que inventar
-- una salida de almacén. El «Servicio de vulcanizado de rodillo 26"» traía 14 «piezas» en Mallado
-- (13 de la hoja y 1 de una compra) que nadie puede contar. Dirección pidió hacerlo como debe ser.
--
-- Qué cambia:
--   * Un servicio nunca controla inventario ni recibe movimientos: lo rechaza la base (disparador en
--     movimientos_inventario), entre por donde entre. Lo que traían se saca aquí con un ajuste que
--     dice por qué, y se suelta lo que tenían apartado.
--   * Al recibir la orden de compra, la partida de un servicio no entra a ningún almacén. Si se
--     compró para una orden de producción (requisición ligada), el renglón de esa orden queda
--     cubierto solo. Si la compra se hizo sin requisición, la gerencia de producción o compras lo
--     marcan con marcar_servicio_hecho().
--   * En el material de la orden un servicio no se aparta ni se surte; cuenta como faltante mientras
--     no esté hecho, para que «Pedir faltantes» lo mande a compras igual que antes.
--   * Servicio interno (articulos.servicio_interno): lo que hacemos en casa y solo está en la lista
--     por su costo (corte CNC, puesta en marcha). Nunca falta ni se pide a compras.
--   * La orden hereda de la lista del equipo los servicios de fuera. Antes explotar_materiales solo
--     bajaba componentes y materia prima: el vulcanizado estaba en la lista del equipo (y en su
--     costo) pero no en la orden, y nadie lo pedía; por eso ingeniería lo quiso agregar a mano (300).
--     Los internos no bajan: en la orden serían renglones que nadie tiene que atender.
--   * Lo que es de almacén (por surtir, órdenes esperando material, el indicador de surtido) deja de
--     contar servicios.
-- Además: la grúa viajera estaba dada de alta como servicio y es una máquina, y dos servicios estaban
-- como componente con unidad «servicio» (por eso uno sí aparecía en el buscador de la orden y otro no).
-- =============================================================================

alter table public.articulos add column if not exists servicio_interno boolean not null default false;
comment on column public.articulos.servicio_interno is
  'Servicio que se hace en casa: está en las listas de materiales solo por su costo; nunca falta ni se pide a compras.';

create or replace function public.es_servicio(p_articulo uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select tipo = 'servicio' from articulos where id = p_articulo), false)
$$;
revoke execute on function public.es_servicio(uuid) from public, anon, authenticated;

-- ── Datos: lo que estaba mal clasificado y lo que los servicios traían en almacén ─────────────────
-- Corre antes de los disparadores de abajo, que ya no dejarían hacer estos movimientos.
do $$
declare r record;
begin
  -- Es una máquina de la fábrica, no un servicio: conserva su pieza en almacén y no se vende.
  update articulos set tipo = 'componente', se_vende = false
  where clave = 'C-N4206' and tipo = 'servicio' and nombre ilike 'Grúa viajera%';

  -- Lo apartado de un servicio no aparta nada.
  update reservas r0 set estado = 'liberada'
  from articulos a
  where a.id = r0.articulo_id and r0.estado = 'activa'
    and (a.tipo = 'servicio' or (a.tipo in ('componente', 'materia_prima') and lower(a.unidad) = 'servicio'));

  -- Su existencia sale con un ajuste, sin valor: no es merma, nunca fue una pieza.
  for r in select e.articulo_id, e.almacen_id, e.cantidad
           from existencias e join articulos a on a.id = e.articulo_id
           where e.cantidad <> 0
             and (a.tipo = 'servicio' or (a.tipo in ('componente', 'materia_prima') and lower(a.unidad) = 'servicio')) loop
    insert into movimientos_inventario (tipo, articulo_id, almacen_id, cantidad, costo_unitario, motivo)
    values ((case when r.cantidad > 0 then 'ajuste_salida' else 'ajuste_entrada' end)::tipo_movimiento, r.articulo_id, r.almacen_id, -r.cantidad, 0,
            'Los servicios ya no llevan inventario: se saca lo que traía de la hoja o de una compra');
  end loop;

  -- Dados de alta como componente pero con unidad «servicio»: son servicios.
  update articulos set tipo = 'servicio'
  where tipo in ('componente', 'materia_prima') and lower(unidad) = 'servicio';

  update articulos set controla_inventario = false where tipo = 'servicio' and controla_inventario;
end $$;

-- ── Un servicio nunca controla inventario ────────────────────────────────────────────────────────
create or replace function public.trg_articulo_servicio()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.tipo = 'servicio' then
    if tg_op = 'UPDATE' and old.tipo <> 'servicio'
       and exists (select 1 from existencias where articulo_id = new.id and cantidad <> 0) then
      raise exception '"%" tiene existencia en almacén: un servicio no lleva inventario. Sácala con un ajuste antes de cambiarle el tipo', new.nombre
        using errcode = '23514';
    end if;
    new.controla_inventario := false;
  else
    new.servicio_interno := false;
  end if;
  return new;
end $$;
drop trigger if exists servicio_sin_inventario on public.articulos;
create trigger servicio_sin_inventario before insert or update of tipo, controla_inventario, servicio_interno on public.articulos
  for each row execute function public.trg_articulo_servicio();

-- La barrera de verdad: ningún camino (recepción, salida, traspaso, ajuste, carga inicial) mueve un servicio.
create or replace function public.trg_movimiento_sin_servicios()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if es_servicio(new.articulo_id) then
    raise exception '"%" es un servicio: no entra ni sale del almacén. Se cubre al recibir su compra o con «Marcar hecho» en la orden',
      (select nombre from articulos where id = new.articulo_id) using errcode = '23514';
  end if;
  return new;
end $$;
drop trigger if exists a_sin_servicios on public.movimientos_inventario;
-- Con «a_» para que corra antes de «aplicar», que es el que toca las existencias.
create trigger a_sin_servicios before insert on public.movimientos_inventario
  for each row execute function public.trg_movimiento_sin_servicios();

-- ── Cubrir el servicio de una orden ──────────────────────────────────────────────────────────────
-- Al recibir la partida de una orden de compra: lo recibido se reparte entre las órdenes de
-- producción para las que se pidió (requisición ligada a la partida), sin pasar de lo que les falta.
create or replace function public._servicio_recibido(p_oc_linea uuid, p_cantidad numeric, p_folio text)
returns void language plpgsql security definer set search_path = public as $$
declare r record; v_resto numeric := p_cantidad; v_toma numeric;
begin
  for r in select m.id, m.orden_id, m.requerido - m.surtido falta, a.nombre, a.unidad
           from requisicion_lineas rl
           join op_materiales m on m.orden_id = rl.orden_produccion_id and m.articulo_id = rl.articulo_id
           join ordenes_produccion o on o.id = m.orden_id
           join articulos a on a.id = m.articulo_id
           where rl.oc_linea_id = p_oc_linea and rl.estado <> 'cancelada' and m.quitado_en is null
             and m.requerido > m.surtido and o.estado not in ('terminada', 'entregada', 'cancelada')
           order by o.creado_en, m.id
           for update of m loop
    exit when v_resto <= 0;
    v_toma := least(v_resto, r.falta);
    update op_materiales set surtido = surtido + v_toma where id = r.id;
    insert into op_eventos (orden_id, tipo, nota)
    values (r.orden_id, 'nota', format('Servicio cubierto con la compra %s: %s (%s %s)', p_folio, r.nombre, trim_scale(v_toma), r.unidad));
    v_resto := v_resto - v_toma;
  end loop;
end $$;
revoke execute on function public._servicio_recibido(uuid, numeric, text) from public, anon, authenticated;

-- A mano, cuando la compra se hizo sin requisición o el trabajo ya se hizo. Lo marcan quienes lo
-- saben: la gerencia de producción o compras. Se puede desmarcar; todo queda en la línea de tiempo.
create or replace function public.marcar_servicio_hecho(p_material uuid, p_nota text default null, p_hecho boolean default true)
returns void language plpgsql security definer set search_path = public as $$
declare m op_materiales; a articulos; v_estado estado_op; v_nota text := nullif(trim(p_nota), '');
begin
  if not (puede('produccion', 3) or puede('compras', 2)) then
    raise exception 'Un servicio lo marca la gerencia de producción o compras' using errcode = '42501';
  end if;
  select * into m from op_materiales where id = p_material for update;
  if m.id is null then raise exception 'No existe ese renglón'; end if;
  select * into a from articulos where id = m.articulo_id;
  if a.tipo <> 'servicio' then
    raise exception '"%" no es un servicio: el material lo surte almacén', a.nombre using errcode = '23514';
  end if;
  if a.servicio_interno then
    raise exception '"%" se hace en casa: no hay nada que marcar', a.nombre using errcode = '23514';
  end if;
  if m.quitado_en is not null then raise exception '"%" se quitó de esta orden', a.nombre using errcode = '23514'; end if;
  select estado into v_estado from ordenes_produccion where id = m.orden_id;
  if v_estado in ('terminada', 'entregada', 'cancelada') then raise exception 'La orden ya está cerrada'; end if;

  if p_hecho then
    if m.surtido >= m.requerido then raise exception '"%" ya estaba marcado como hecho', a.nombre using errcode = '23514'; end if;
    update op_materiales set surtido = requerido where id = m.id;
    insert into op_eventos (orden_id, tipo, nota)
    values (m.orden_id, 'nota', format('Servicio hecho: %s', a.nombre) || coalesce(' (' || v_nota || ')', ''));
  else
    if m.surtido = 0 then raise exception '"%" no estaba marcado', a.nombre using errcode = '23514'; end if;
    if v_nota is null or length(v_nota) < 3 then
      raise exception 'Para desmarcarlo escribe por qué' using errcode = '22023';
    end if;
    update op_materiales set surtido = 0 where id = m.id;
    insert into op_eventos (orden_id, tipo, nota)
    values (m.orden_id, 'nota', format('Se desmarcó el servicio %s: %s', a.nombre, v_nota));
  end if;
end $$;
revoke execute on function public.marcar_servicio_hecho(uuid, text, boolean) from public, anon;
grant execute on function public.marcar_servicio_hecho(uuid, text, boolean) to authenticated;

-- ── El material de la orden ──────────────────────────────────────────────────────────────────────
-- Misma vista que en 297. Para un servicio: no hay nada que apartar ni que surtir; falta lo que no
-- está hecho (nada si es interno). Se agrega servicio_interno al final.
create or replace view public.v_op_material with (security_invoker = true) as
select m.id, m.orden_id, m.articulo_id, a.clave, a.nombre, a.unidad, m.requerido, m.surtido, m.ruta, m.agregado, m.notas,
  coalesce(r.apartado, 0) as apartado,
  case when t.del_taller or a.servicio_interno then 0
       when a.tipo = 'servicio' then greatest(m.requerido - m.surtido, 0)
       else greatest(m.requerido - m.surtido - coalesce(r.apartado, 0), 0) end as faltante,
  coalesce(pc.pedido, 0) as pedido_a_compras,
  coalesce(e.en_planta, 0) as existencia_planta,
  case when t.del_taller or a.tipo = 'servicio' then 0 else greatest(m.requerido - m.surtido, 0) end as por_surtir,
  greatest(coalesce(e.en_planta, 0) - coalesce((select sum(x.cantidad - x.surtido) from public.reservas x
                                                where x.articulo_id = m.articulo_id and x.estado = 'activa'), 0), 0) as disponible_planta,
  a.tipo,
  t.del_taller,
  c.nombre as categoria,
  m.quitado_en, m.motivo_quitado, pq.nombre as quitado_por, m.requerido_antes, m.reemplaza_a,
  (select a2.nombre from public.op_materiales m2 join public.articulos a2 on a2.id = m2.articulo_id where m2.id = m.reemplaza_a) as reemplaza_a_nombre,
  (select a3.nombre from public.op_materiales m3 join public.articulos a3 on a3.id = m3.articulo_id where m3.reemplaza_a = m.id limit 1) as reemplazado_por,
  a.servicio_interno
from public.op_materiales m
left join public.perfiles pq on pq.id = m.quitado_por
join public.articulos a on a.id = m.articulo_id
left join public.categorias c on c.id = a.categoria_id
left join public.pedido_a_compras_ops() pc on pc.orden_id = m.orden_id and pc.articulo_id = m.articulo_id
cross join lateral (select coalesce(c.consumible_taller, false) and (select public.consumibles_del_taller()) as del_taller) t
left join lateral (select sum(cantidad - surtido) apartado from public.reservas
                   where orden_produccion_id = m.orden_id and articulo_id = m.articulo_id and estado = 'activa') r on true
left join lateral (select sum(x.cantidad) en_planta from public.existencias x join public.almacenes al on al.id = x.almacen_id
                   where x.articulo_id = m.articulo_id and al.disponible_para_planta) e on true;

-- Lo que baja de la lista del equipo a la orden (y al agregar un subensamble completo): como en 238,
-- más los servicios que se compran fuera.
create or replace function public.explotar_materiales(p_articulo uuid, p_cantidad numeric default 1)
returns table (articulo_id uuid, cantidad numeric, ruta text)
language sql stable as $$
  with recursive arbol(id, cant, ruta) as (
    select p_articulo, p_cantidad::numeric, array[]::text[]
    union all
    select b.hijo_id, arbol.cant * cantidad_linea(b), arbol.ruta || a.nombre
    from arbol join bom_lineas b on b.padre_id = arbol.id join articulos a on a.id = arbol.id
  )
  select arbol.id, sum(arbol.cant), (array_agg(array_to_string(arbol.ruta, ' › ') order by cardinality(arbol.ruta)))[1]
  from arbol join articulos a on a.id = arbol.id
  where (a.tipo in ('componente', 'materia_prima') or (a.tipo = 'servicio' and not a.servicio_interno))
    and arbol.id <> p_articulo
  group by arbol.id
$$;

-- Igual que en 295, con la misma regla de la vista para los servicios.
create or replace function public.faltantes_de_ordenes()
returns table (orden_id uuid, faltantes bigint, sin_pedir bigint)
language sql stable security definer set search_path = public as $$
  with abiertas as (
    select o.id from ordenes_produccion o
    where o.estado not in ('terminada', 'entregada', 'cancelada')
      and ((select puede('produccion', 1)) or (select puede('inventario', 1)))
  ), res as (
    select r.orden_produccion_id, r.articulo_id, sum(r.cantidad - r.surtido) apartado
    from reservas r
    where r.estado = 'activa' and r.orden_produccion_id in (select id from abiertas)
    group by 1, 2
  ), req as (
    select l.orden_produccion_id, l.articulo_id, sum(l.cantidad) pedido
    from requisicion_lineas l
    where l.estado <> 'cancelada' and l.orden_produccion_id in (select id from abiertas)
    group by 1, 2
  ), mat as (
    select m.orden_id,
      -- Igual que v_op_material: lo que pone el taller (consumibles) y lo que se hace en casa nunca
      -- falta; a un servicio de fuera le falta lo que no está hecho.
      case when (coalesce(c.consumible_taller, false) and (select consumibles_del_taller())) or a.servicio_interno then 0
           when a.tipo = 'servicio' then greatest(m.requerido - m.surtido, 0)
           else greatest(m.requerido - m.surtido - coalesce(res.apartado, 0), 0) end faltante,
      coalesce(req.pedido, 0) pedido
    from op_materiales m
    join abiertas o on o.id = m.orden_id
    join articulos a on a.id = m.articulo_id
    left join categorias c on c.id = a.categoria_id
    left join res on res.orden_produccion_id = m.orden_id and res.articulo_id = m.articulo_id
    left join req on req.orden_produccion_id = m.orden_id and req.articulo_id = m.articulo_id
  )
  select mat.orden_id, count(*) filter (where mat.faltante > 0), count(*) filter (where mat.faltante - mat.pedido > 0)
  from mat group by mat.orden_id
$$;

-- La partida de la orden de compra dice de qué tipo es su artículo, para que la recepción no pida
-- almacén para un servicio. Misma vista que en 291, con tipo_articulo al final.
create or replace view public.v_oc_lineas with (security_invoker = false) as
 WITH permiso AS (
         SELECT ve_costos_compra() AS dinero,
            (puede('compras'::text, 1) OR puede('finanzas'::text, 1) OR puede('inventario'::text, 2) OR puede('produccion'::text, 2)) AS fila
        )
 SELECT l.id, l.orden_compra_id, l.articulo_id, COALESCE(a.nombre, l.descripcion) AS nombre, l.descripcion, a.clave,
    COALESCE(a.unidad, 'pieza'::text) AS unidad, a.empaque, a.almacen_preferido_id, l.cantidad,
    CASE WHEN permiso.dinero THEN l.costo_unitario ELSE NULL::numeric END AS costo_unitario,
    CASE WHEN permiso.dinero THEN l.importe ELSE NULL::numeric END AS importe,
    l.recibido, GREATEST(l.cantidad - l.recibido, 0::numeric) AS pendiente,
    (SELECT string_agg(DISTINCT COALESCE(op.folio, r.folio), ', '::text)
       FROM requisicion_lineas rl JOIN requisiciones r ON r.id = rl.requisicion_id
       LEFT JOIN ordenes_produccion op ON op.id = rl.orden_produccion_id
      WHERE rl.oc_linea_id = l.id) AS para,
    l.pedido_linea_id,
    CASE WHEN l.pedido_linea_id IS NOT NULL THEN _pedido_de_linea(l.pedido_linea_id) END AS directo_a,
    a.tipo AS tipo_articulo
   FROM oc_lineas l CROSS JOIN permiso LEFT JOIN articulos a ON a.id = l.articulo_id
  WHERE permiso.fila;

-- ── Parches a funciones largas: se cambia solo el pedazo, con candado para no parchar otra versión ──
do $$
declare s text; v_ancla text; v_n int;
  -- «m.requerido > m.surtido + 0.0005 join articulos a|am on …»: las cuentas de «órdenes esperando material».
  c_espera constant text := '(m\.requerido > m\.surtido \+ 0\.0005\s+join articulos (am?) on \2\.id = m\.articulo_id)';
begin
  -- Recepción: la partida de un servicio no entra al almacén; cubre a la orden para la que se pidió.
  s := pg_get_functiondef('public.recibir_orden_compra(uuid, jsonb, text, boolean)'::regprocedure);
  if position('_servicio_recibido' in s) = 0 then
    v_ancla := 'insert into movimientos_inventario (tipo, articulo_id, almacen_id, cantidad, costo_unitario, orden_compra_id, motivo)';
    if (length(s) - length(replace(s, v_ancla, ''))) / length(v_ancla) <> 1
       or position('''OC '' || o.folio || coalesce('' · factura '' || p_factura, ''''));' in s) = 0 then
      raise exception 'recibir_orden_compra ya no es la que se conocía: revisa este parche';
    end if;
    s := replace(s, v_ancla,
      'if es_servicio(v_linea.articulo_id) then' || chr(10) ||
      '        perform _servicio_recibido(v_linea.id, l.cantidad, o.folio);' || chr(10) ||
      '      else' || chr(10) || '      ' || v_ancla);
    s := replace(s, '''OC '' || o.folio || coalesce('' · factura '' || p_factura, ''''));',
                    '''OC '' || o.folio || coalesce('' · factura '' || p_factura, ''''));' || chr(10) || '      end if;');
    execute s;
  end if;

  -- Entrega directa de un servicio (un flete que el proveedor le da al cliente): no hay salida que comprobar.
  s := pg_get_functiondef('public.entregado_directo(uuid, numeric, text, text)'::regprocedure);
  if position('es_servicio' in s) = 0 then
    if position('if v_sale < p_cantidad then' in s) = 0 then
      raise exception 'entregado_directo ya no es la que se conocía: revisa este parche';
    end if;
    s := replace(s, 'if v_sale < p_cantidad then', 'if v_sale < p_cantidad and not es_servicio(l.articulo_id) then');
    execute s;
  end if;

  -- Surtir: un servicio no sale del almacén (ni «ya entregado con la hoja»).
  s := pg_get_functiondef('public.surtir_material(uuid, jsonb, text, boolean)'::regprocedure);
  if position('es_servicio' in s) = 0 then
    v_ancla := 'v_cons := es_consumible_taller(l.articulo_id);';
    if position(v_ancla in s) = 0 then raise exception 'surtir_material ya no es la que se conocía: revisa este parche'; end if;
    s := replace(s, v_ancla, v_ancla || chr(10) ||
      '    if es_servicio(l.articulo_id) then' || chr(10) ||
      '      raise exception ''"%" es un servicio: no sale del almacén. Se cubre al recibir su compra o con «Marcar hecho» en la orden'', v_nombre' || chr(10) ||
      '        using errcode = ''23514'';' || chr(10) ||
      '    end if;');
    execute s;
  end if;

  -- Apartar: de un servicio no hay existencia que apartar.
  s := pg_get_functiondef('public.apartar_material(uuid, text)'::regprocedure);
  if position('v.tipo <> ''servicio''' in s) = 0 then
    v_ancla := 'for m in select * from v_op_material v where v.orden_id = p_op and v.faltante > 0 loop';
    if position(v_ancla in s) = 0 then raise exception 'apartar_material ya no es la que se conocía: revisa este parche'; end if;
    s := replace(s, v_ancla, 'for m in select * from v_op_material v where v.orden_id = p_op and v.faltante > 0 and v.tipo <> ''servicio'' loop');
    execute s;
  end if;

  -- Lo que es de almacén no cuenta servicios: la lista de órdenes por surtir…
  s := pg_get_functiondef('public.ordenes_por_surtir()'::regprocedure);
  if position('.tipo <> ''servicio''' in s) = 0 then
    select count(*) into v_n from regexp_matches(s, c_espera, 'g');
    if v_n <> 1 then raise exception 'ordenes_por_surtir ya no es la que se conocía (% coincidencias): revisa este parche', v_n; end if;
    execute regexp_replace(s, c_espera, '\1 and \2.tipo <> ''servicio''', 'g');
  end if;

  -- …las órdenes «esperando material» de las métricas de almacén (dos cuentas y la lista)…
  s := pg_get_functiondef('public.metricas_almacen(date, date)'::regprocedure);
  if position('.tipo <> ''servicio''' in s) = 0 then
    select count(*) into v_n from regexp_matches(s, c_espera, 'g');
    if v_n <> 3 then raise exception 'metricas_almacen ya no es la que se conocía (% coincidencias): revisa este parche', v_n; end if;
    execute regexp_replace(s, c_espera, '\1 and \2.tipo <> ''servicio''', 'g');
  end if;

  -- …y el indicador «órdenes terminadas con el material surtido completo».
  select pg_get_functiondef(p.oid) into s from pg_proc p
  where p.pronamespace = 'public'::regnamespace and p.proname = 'objetivo_medir';
  if position('es_servicio' in s) = 0 then
    if position('not es_consumible_taller(m.articulo_id)) sin_surtir' in s) = 0
       or position('not es_consumible_taller(m.articulo_id)) renglones' in s) = 0 then
      raise exception 'objetivo_medir ya no es la que se conocía: revisa este parche';
    end if;
    s := replace(s, 'not es_consumible_taller(m.articulo_id)) sin_surtir',
                    'not es_consumible_taller(m.articulo_id) and not es_servicio(m.articulo_id)) sin_surtir');
    s := replace(s, 'not es_consumible_taller(m.articulo_id)) renglones',
                    'not es_consumible_taller(m.articulo_id) and not es_servicio(m.articulo_id)) renglones');
    execute s;
  end if;
end $$;

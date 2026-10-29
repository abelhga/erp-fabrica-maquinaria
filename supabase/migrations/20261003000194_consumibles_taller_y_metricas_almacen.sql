-- =============================================================================
-- Consumibles del taller, partidas de cada surtido y métricas de almacén.
--
-- 1. En la hoja, el mismo disco salía unas veces «a P792» y otras «a taller». Las recetas traen
--    discos y soldadura prorrateados (0.6 de carga de CO₂ por banda), pero nadie gasta un disco
--    en una sola orden: cargarlo a la orden llenaba la lista de «fuera de lista» de cosas que no
--    se pueden cuestionar, y escondía las que sí (una polea que la receta no trae). Con el switch
--    encendido, lo que se gasta trabajando (categorías marcadas: discos, lijas, soldadura, EPP…)
--    sale a nombre de quien lo recibe, no a la orden; en la orden se ve aparte y no cuenta como
--    faltante (ni se aparta, ni se pide a compras por orden: lo cubre el stock mínimo). Las
--    métricas comparan lo que se gastó contra lo que prevén las recetas de lo que se terminó.
-- 2. El aviso «Mimí surtió 3 partidas a Leonardo» no decía cuáles: ahora cada surtido guarda
--    sus partidas y la línea de tiempo las muestra.
-- 3. El historial de movimientos no enseñaba quién recibió (la columna existía desde 177).
-- 4. Métricas de almacén: fuera de lista para cuestionar, consumo por persona, consumo contra
--    receta, ajustes y exactitud de los conteos. Los montos, solo con costos.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. El switch y qué categorías son consumibles
-- -----------------------------------------------------------------------------
-- Guardar el switch no debe recalcular el costeo (el recálculo borra y rehace precios_lista).
-- «vacaciones%» va de una vez: la regla de vacaciones por periodo guarda su corte en configuración.
create or replace function public.disparar_recalculo_config() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from nuevos n join viejos v on v.clave = n.clave
             where n.valor is distinct from v.valor and n.clave <> 'horas_taller' and n.clave not like 'mercadolibre%'
               and n.clave not like 'almacen%' and n.clave not like 'vacaciones%') then
    perform recalcular_costos();
  end if;
  return null;
end $$;

alter table public.categorias add column if not exists consumible_taller boolean not null default false;
comment on column public.categorias.consumible_taller is
  'Se gasta trabajando y no se queda en el equipo: con el switch de almacén sale a consumo del taller, a nombre de quien lo recibe.';

update public.categorias set consumible_taller = true
where nombre in ('Discos', 'Lijas', 'Material de Soldadura', 'Proteccion', 'EPP', 'Limpieza', 'Uniforme');

insert into public.configuracion (clave, valor, descripcion) values
  ('almacen_consumibles_taller', 'true',
   'Discos, lijas, soldadura, EPP y lo demás de las categorías marcadas salen a consumo del taller (por persona), no a la orden.')
on conflict (clave) do nothing;

create or replace function public.consumibles_del_taller() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select valor = 'true'::jsonb from configuracion where clave = 'almacen_consumibles_taller'), false)
$$;

-- Si este artículo, hoy, sale a consumo del taller y no a la orden.
create or replace function public.es_consumible_taller(p_articulo uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select consumibles_del_taller() and coalesce((select c.consumible_taller from articulos a join categorias c on c.id = a.categoria_id
                                                where a.id = p_articulo), false)
$$;
grant execute on function public.consumibles_del_taller() to authenticated;
grant execute on function public.es_consumible_taller(uuid) to authenticated;

-- Material de la orden: lo del taller sigue en la lista (es lo que prevé la receta), pero no falta
-- ni está por surtir. Con eso apartar, pedir faltantes y la validación de la orden lo ignoran solos.
create or replace view public.v_op_material with (security_invoker = true) as
select m.id, m.orden_id, m.articulo_id, a.clave, a.nombre, a.unidad, m.requerido, m.surtido, m.ruta, m.agregado, m.notas,
  coalesce(r.apartado, 0) as apartado,
  case when t.del_taller then 0 else greatest(m.requerido - m.surtido - coalesce(r.apartado, 0), 0) end as faltante,
  public.pedido_a_compras_op(m.orden_id, m.articulo_id) as pedido_a_compras,
  coalesce(e.en_planta, 0) as existencia_planta,
  case when t.del_taller then 0 else greatest(m.requerido - m.surtido, 0) end as por_surtir,
  greatest(coalesce(e.en_planta, 0) - coalesce((select sum(x.cantidad - x.surtido) from public.reservas x
                                                where x.articulo_id = m.articulo_id and x.estado = 'activa'), 0), 0) as disponible_planta,
  a.tipo,
  t.del_taller
from public.op_materiales m
join public.articulos a on a.id = m.articulo_id
left join public.categorias c on c.id = a.categoria_id
cross join lateral (select coalesce(c.consumible_taller, false) and (select public.consumibles_del_taller()) as del_taller) t
left join lateral (select sum(cantidad - surtido) apartado from public.reservas
                   where orden_produccion_id = m.orden_id and articulo_id = m.articulo_id and estado = 'activa') r on true
left join lateral (select sum(x.cantidad) en_planta from public.existencias x join public.almacenes al on al.id = x.almacen_id
                   where x.articulo_id = m.articulo_id and al.disponible_para_planta) e on true;

-- Encender o apagar el switch y elegir las categorías. Al encenderlo se suelta lo que estaba
-- apartado de consumibles para órdenes: si no, un disco apartado para OP-26 no podría salir al taller.
create or replace function public.fijar_consumibles_taller(p_activo boolean, p_categorias int[]) returns int
language plpgsql security definer set search_path = public as $$
declare v_n int := 0;
begin
  if not (puede('inventario', 3) or puede('admin', 3)) then raise exception 'Solo almacén (administrar) o sistemas cambian esto' using errcode = '42501'; end if;
  insert into configuracion (clave, valor) values ('almacen_consumibles_taller', to_jsonb(coalesce(p_activo, false)))
  on conflict (clave) do update set valor = excluded.valor, actualizado_en = now();
  if p_categorias is not null then
    update categorias set consumible_taller = (id = any(p_categorias)) where consumible_taller is distinct from (id = any(p_categorias));
  end if;
  if p_activo then
    update reservas r set estado = 'liberada'
    from articulos a join categorias c on c.id = a.categoria_id
    where a.id = r.articulo_id and c.consumible_taller and r.estado = 'activa' and r.orden_produccion_id is not null;
    get diagnostics v_n = row_count;
  end if;
  return v_n;
end $$;
revoke execute on function public.fijar_consumibles_taller(boolean, int[]) from public, anon;
grant execute on function public.fijar_consumibles_taller(boolean, int[]) to authenticated;

-- Lo que quedó apartado de consumibles para órdenes cuando el switch nace encendido.
update public.reservas r set estado = 'liberada'
from public.articulos a join public.categorias c on c.id = a.categoria_id
where a.id = r.articulo_id and c.consumible_taller and r.estado = 'activa' and r.orden_produccion_id is not null
  and public.consumibles_del_taller();

-- -----------------------------------------------------------------------------
-- 2. Surtir: los consumibles salen al taller y cada surtido guarda sus partidas
-- -----------------------------------------------------------------------------
alter table public.op_eventos add column if not exists detalle jsonb;
comment on column public.op_eventos.detalle is
  'En un surtido: las partidas que salieron (artículo, cantidad, almacén, fuera de lista, consumo del taller, motivo).';

create or replace function public.surtir_material(p_op uuid, p_lineas jsonb, p_recibio text default null, p_previo boolean default false)
returns void language plpgsql security definer set search_path = public as $$
declare l record; o ordenes_produccion; v_req numeric; v_res reservas; v_rest numeric; v_propio numeric; v_libre numeric;
  v_nombre text; v_n int := 0; v_fuera int := 0; v_taller int := 0; v_recibio text := nullif(trim(p_recibio), '');
  v_cons boolean; v_detalle jsonb := '[]';
begin
  if not puede('inventario', 2) then raise exception 'Solo almacén surte material' using errcode = '42501'; end if;
  select * into o from ordenes_produccion where id = p_op;
  if o.id is null then raise exception 'No existe la orden'; end if;
  if o.estado in ('terminada', 'entregada', 'cancelada') then raise exception 'La orden ya está cerrada'; end if;
  if p_previo then
    -- Lo de la hoja ya no está en el inventario que se cargó: solo órdenes de antes del corte.
    if corte_surtido_previo() is null or (o.creado_en at time zone 'America/Mexico_City')::date > corte_surtido_previo() then
      raise exception 'La orden % se creó en el ERP: lo que se le entrega se surte normal y descuenta del inventario', o.folio;
    end if;
  elsif v_recibio is null then
    raise exception 'Elige quién recibe el material' using errcode = '23514';
  end if;

  for l in select (x->>'articulo_id')::uuid articulo_id, (x->>'cantidad')::numeric cantidad,
                  (x->>'almacen_id')::int almacen_id, x->>'motivo' motivo
           from jsonb_array_elements(p_lineas) x loop
    if coalesce(l.cantidad, 0) <= 0 then continue; end if;
    select nombre into v_nombre from articulos where id = l.articulo_id;
    select requerido - surtido into v_req from op_materiales where orden_id = p_op and articulo_id = l.articulo_id;
    v_cons := es_consumible_taller(l.articulo_id);

    if p_previo then
      if v_cons then
        raise exception '"%" es consumible del taller: no se registra contra la orden', v_nombre;
      end if;
      if v_req is null then
        raise exception '"%" no está en la lista de esta orden: lo entregado antes del ERP se registra solo de la lista', v_nombre;
      end if;
      if l.cantidad > v_req + 0.0005 then
        raise exception 'De "%" faltaban % por surtir, no %', v_nombre, trim_scale(v_req), trim_scale(l.cantidad);
      end if;
      update op_materiales set surtido = surtido + l.cantidad where orden_id = p_op and articulo_id = l.articulo_id;
    else
      if l.almacen_id is null then raise exception 'Falta elegir de qué almacén sale "%"', v_nombre; end if;
      if not coalesce((select disponible_para_planta from almacenes where id = l.almacen_id), false) then
        raise exception 'Del almacén % no se surte a planta', (select nombre from almacenes where id = l.almacen_id);
      end if;
      -- El motivo se pide para cuestionar lo que la receta no trae; un consumible no lo necesita.
      if v_req is null and not v_cons and coalesce(trim(l.motivo), '') = '' then
        raise exception '"%" no está en la lista de materiales de esta orden: escribe el motivo', v_nombre;
      end if;

      -- Lo que esta orden puede llevarse: su propia reserva más lo que nadie apartó.
      perform 1 from existencias where articulo_id = l.articulo_id for update;
      select coalesce(sum(cantidad - surtido), 0) into v_propio from reservas
      where orden_produccion_id = p_op and articulo_id = l.articulo_id and estado = 'activa';
      select coalesce(sum(x.cantidad), 0) - coalesce((select sum(r.cantidad - r.surtido) from reservas r
                                                       where r.articulo_id = l.articulo_id and r.estado = 'activa'), 0)
        into v_libre
      from existencias x join almacenes al on al.id = x.almacen_id
      where x.articulo_id = l.articulo_id and al.disponible_para_planta;
      if l.cantidad > v_propio + greatest(v_libre, 0) + 0.0005 then
        raise exception 'De "%" solo puedes surtir % a esta orden: lo demás está apartado para %',
          v_nombre, trim_scale(v_propio + greatest(v_libre, 0)),
          coalesce((select string_agg(distinct coalesce(o2.folio, 'un pedido'), ', ') from reservas r
                    left join ordenes_produccion o2 on o2.id = r.orden_produccion_id
                    where r.articulo_id = l.articulo_id and r.estado = 'activa' and r.orden_produccion_id is distinct from p_op),
                   'otras órdenes')
          using errcode = '23514';
      end if;

      if v_cons then
        -- Al taller, a nombre de quien lo recibe: no entra al costo ni a la lista de la orden.
        insert into movimientos_inventario (tipo, articulo_id, almacen_id, cantidad, motivo, costo_unitario, recibio)
        values ('salida_consumo', l.articulo_id, l.almacen_id, -l.cantidad,
                'Consumo del taller · ' || o.folio || coalesce(' · ' || nullif(trim(l.motivo), ''), ''),
                (select costo * tc(moneda) from costos_articulo where articulo_id = l.articulo_id), v_recibio);
        v_taller := v_taller + 1;
      else
        insert into movimientos_inventario (tipo, articulo_id, almacen_id, cantidad, orden_produccion_id, pedido_id, motivo,
                                            fuera_de_lista, costo_unitario, recibio)
        values ('salida_produccion', l.articulo_id, l.almacen_id, -l.cantidad, p_op, o.pedido_id,
                coalesce(nullif(trim(l.motivo), ''), o.folio), v_req is null,
                (select costo * tc(moneda) from costos_articulo where articulo_id = l.articulo_id), v_recibio);

        if v_req is null then
          insert into op_materiales (orden_id, articulo_id, requerido, surtido, agregado, notas)
          values (p_op, l.articulo_id, 0, l.cantidad, true, l.motivo);
          v_fuera := v_fuera + 1;
        else
          update op_materiales set surtido = surtido + l.cantidad where orden_id = p_op and articulo_id = l.articulo_id;
        end if;
      end if;
    end if;

    -- Consume reservas de la orden (las más viejas primero).
    v_rest := l.cantidad;
    for v_res in select * from reservas where orden_produccion_id = p_op and articulo_id = l.articulo_id and estado = 'activa'
                 order by creado_en for update loop
      exit when v_rest <= 0;
      update reservas set surtido = surtido + least(v_rest, cantidad - surtido),
        estado = case when surtido + least(v_rest, cantidad - surtido) >= cantidad then 'surtida' else 'activa' end
      where id = v_res.id;
      v_rest := v_rest - least(v_rest, v_res.cantidad - v_res.surtido);
    end loop;
    v_n := v_n + 1;
    v_detalle := v_detalle || jsonb_build_object('articulo_id', l.articulo_id, 'cantidad', l.cantidad,
      'almacen_id', case when p_previo then null else l.almacen_id end,
      'fuera_de_lista', not p_previo and not v_cons and v_req is null, 'consumo', not p_previo and v_cons,
      'motivo', nullif(trim(l.motivo), ''));
  end loop;
  if v_n = 0 then raise exception 'No hay cantidades para surtir'; end if;
  insert into op_eventos (orden_id, tipo, nota, responsable, detalle)
  values (p_op, 'surtido',
          case when p_previo then format('%s partida(s) que ya se habían entregado con la hoja; no descuenta inventario', v_n)
               else format('%s partida(s)%s%s', v_n,
                           case when v_fuera > 0 then format(', %s fuera de lista', v_fuera) else '' end,
                           case when v_taller > 0 then format(', %s de consumo del taller', v_taller) else '' end) end,
          v_recibio, v_detalle);
end $$;
revoke execute on function public.surtir_material(uuid, jsonb, text, boolean) from public, anon;
grant execute on function public.surtir_material(uuid, jsonb, text, boolean) to authenticated;

-- Los surtidos de antes: sus partidas son las salidas de esa orden en esa misma transacción
-- (surtir pone la misma hora a las salidas y al aviso). Solo donde no hay duda: un único aviso
-- de esa orden a esa hora, y tantas salidas como partidas dice su nota.
update public.op_eventos e set detalle = d.detalle
from (select e2.id, count(*) n,
        jsonb_agg(jsonb_build_object('articulo_id', m.articulo_id, 'cantidad', -m.cantidad, 'almacen_id', m.almacen_id,
          'fuera_de_lista', m.fuera_de_lista, 'consumo', false, 'motivo', case when m.fuera_de_lista then m.motivo end) order by m.id) detalle
      from public.op_eventos e2
      join public.movimientos_inventario m on m.orden_produccion_id = e2.orden_id and m.en = e2.en and m.tipo = 'salida_produccion'
                                          and m.recibio is not distinct from e2.responsable
      where e2.tipo = 'surtido' and e2.detalle is null
        and not exists (select 1 from public.op_eventos e3 where e3.tipo = 'surtido' and e3.id <> e2.id and e3.orden_id = e2.orden_id and e3.en = e2.en)
      group by e2.id) d
where e.id = d.id and e.nota ~ ('^' || d.n || ' partida');
-- Lo entregado con la hoja no movió inventario: sus partidas salen de la bitácora del material.
update public.op_eventos e set detalle = d.detalle
from (select e2.id, count(*) n,
        jsonb_agg(jsonb_build_object('articulo_id', om.articulo_id,
          'cantidad', (b.cambios->'surtido'->>1)::numeric - (b.cambios->'surtido'->>0)::numeric,
          'almacen_id', null, 'fuera_de_lista', false, 'consumo', false, 'motivo', null) order by b.id) detalle
      from public.op_eventos e2
      join public.bitacora b on b.tabla = 'op_materiales' and b.accion = 'cambio' and b.en = e2.en and b.cambios ? 'surtido'
      join public.op_materiales om on om.id::text = b.registro_id::text and om.orden_id = e2.orden_id
      where e2.tipo = 'surtido' and e2.detalle is null and e2.nota like '%ya se habían entregado con la hoja%'
        and not exists (select 1 from public.op_eventos e3 where e3.tipo = 'surtido' and e3.id <> e2.id and e3.en = e2.en)
      group by e2.id) d
where e.id = d.id and e.nota ~ ('^' || d.n || ' partida');

-- Qué fueron las partidas de un surtido. La ve quien ve la orden (los vendedores también, para
-- seguir su equipo): nombres y cantidades, sin costos.
create or replace function public.partidas_surtido(p_evento bigint)
returns table (articulo_id uuid, clave text, nombre text, unidad text, cantidad numeric, almacen text,
               fuera_de_lista boolean, consumo boolean, motivo text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not (puede('produccion', 1) or puede('inventario', 1)) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  return query
  select a.id, a.clave, a.nombre, a.unidad, (x->>'cantidad')::numeric, al.nombre,
         coalesce((x->>'fuera_de_lista')::boolean, false), coalesce((x->>'consumo')::boolean, false), x->>'motivo'
  from op_eventos e
  cross join lateral jsonb_array_elements(coalesce(e.detalle, '[]')) with ordinality d(x, n)
  join articulos a on a.id = (x->>'articulo_id')::uuid
  left join almacenes al on al.id = (x->>'almacen_id')::int
  where e.id = p_evento and e.tipo = 'surtido'
  order by d.n;
end $$;
revoke execute on function public.partidas_surtido(bigint) from public, anon;
grant execute on function public.partidas_surtido(bigint) to authenticated;

-- Lo que almacén tiene que preparar: sin los consumibles del taller (no se surten por orden).
create or replace function public.ordenes_por_surtir()
returns table (id uuid, folio text, estado text, equipo text, pedido text, cliente text, para_stock boolean,
               partidas int, empieza date, fecha_compromiso date, previo boolean)
-- No es «stable»: plan_produccion() arma tablas temporales y en una consulta de solo lectura falla.
language plpgsql security definer set search_path = public as $$
declare v_taller boolean := consumibles_del_taller();
begin
  if not puede('inventario', 2) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  return query
  with plan as (select p.orden_id, min(p.inicio_plan) inicio from plan_produccion() p where p.estado <> 'terminada' group by p.orden_id)
  select o.id, o.folio, o.estado::text, a.nombre, pb.folio, pb.cliente, o.pedido_id is null,
         count(*)::int, pl.inicio, o.fecha_compromiso,
         (o.creado_en at time zone 'America/Mexico_City')::date <= coalesce(corte_surtido_previo(), '-infinity'::date)
  from ordenes_produccion o
  join articulos a on a.id = o.articulo_id
  join op_materiales m on m.orden_id = o.id and m.requerido > m.surtido + 0.0005
  join articulos am on am.id = m.articulo_id
  left join categorias cm on cm.id = am.categoria_id
  left join lateral pedido_de_orden(o.pedido_id) pb on true
  left join plan pl on pl.orden_id = o.id
  where o.estado in ('planeada', 'liberada', 'en_proceso') and o.en_espera_motivo is null
    and not (v_taller and coalesce(cm.consumible_taller, false))
  group by o.id, o.folio, o.estado, a.nombre, pb.folio, pb.cliente, pl.inicio, o.fecha_compromiso, o.creado_en, o.pedido_id, o.prioridad
  order by pl.inicio nulls last, o.prioridad, o.fecha_compromiso nulls last, o.folio;
end $$;
revoke execute on function public.ordenes_por_surtir() from public, anon;
grant execute on function public.ordenes_por_surtir() to authenticated;

-- -----------------------------------------------------------------------------
-- 3. Salida a consumo con quién la recibe, y el historial que lo enseña
-- -----------------------------------------------------------------------------
-- Para el consumo por persona hace falta el nombre aparte del motivo («Taller · Juan»).
-- Mantenimiento la llama sin quién (el técnico va en el motivo con el folio): sigue igual.
drop function if exists public.registrar_salida(uuid, int, numeric, public.tipo_movimiento, text, uuid);
drop function if exists public.registrar_salida(uuid, int, numeric, public.tipo_movimiento, text, uuid, text);
create function public.registrar_salida(p_articulo uuid, p_almacen int, p_cantidad numeric,
  p_tipo public.tipo_movimiento, p_motivo text, p_pedido uuid default null, p_recibio text default null) returns bigint
language plpgsql security definer set search_path = public as $$
declare v_id bigint;
begin
  if not puede('inventario', 2) then raise exception 'Sin permiso para registrar salidas' using errcode = '42501'; end if;
  if p_tipo not in ('salida_venta', 'salida_consumo') then
    raise exception 'Las salidas a producción se registran desde la orden de producción (surtir material)';
  end if;
  if p_cantidad <= 0 then raise exception 'La cantidad debe ser mayor a cero'; end if;
  if coalesce(trim(p_motivo), '') = '' then raise exception 'Escribe para qué o para quién es la salida'; end if;
  insert into movimientos_inventario (tipo, articulo_id, almacen_id, cantidad, motivo, pedido_id, costo_unitario, recibio)
  values (p_tipo, p_articulo, p_almacen, -p_cantidad, p_motivo, p_pedido,
          (select costo * tc(moneda) from costos_articulo where articulo_id = p_articulo), nullif(trim(p_recibio), ''))
  returning id into v_id;
  return v_id;
end $$;
revoke execute on function public.registrar_salida(uuid, int, numeric, public.tipo_movimiento, text, uuid, text) from public, anon;
grant execute on function public.registrar_salida(uuid, int, numeric, public.tipo_movimiento, text, uuid, text) to authenticated;

-- Quién recibió no es un monto: se puede leer (147 dejó fuera la columna porque no existía en la lista).
grant select (recibio) on public.movimientos_inventario to authenticated;

create or replace view public.v_movimientos with (security_invoker = true) as
SELECT m.id,
    m.en,
    m.tipo,
    m.articulo_id,
    a.clave,
    a.nombre,
    a.unidad,
    m.almacen_id,
    al.nombre AS almacen,
    m.cantidad,
    cm.costo_unitario,
    m.motivo,
    m.fuera_de_lista,
    m.usuario_id,
    u.nombre AS usuario,
    m.orden_compra_id,
    oc.folio AS oc_folio,
    m.orden_produccion_id,
    op.folio AS op_folio,
    m.pedido_id,
    pe.folio AS pedido_folio,
    m.ajuste_id,
    aj.folio AS ajuste_folio,
    m.traspaso_id,
    t.almacen AS traspaso_almacen,
    COALESCE('OC '::text || oc.folio, op.folio || COALESCE(' · '::text || pe.folio, ''::text), pe.folio, aj.folio,
        CASE m.tipo
            WHEN 'traspaso_salida'::tipo_movimiento THEN 'a '::text || t.almacen
            WHEN 'traspaso_entrada'::tipo_movimiento THEN 'de '::text || t.almacen
            ELSE NULL::text
        END) AS referencia,
    m.recibio
   FROM movimientos_inventario m
     JOIN articulos a ON a.id = m.articulo_id
     JOIN almacenes al ON al.id = m.almacen_id
     LEFT JOIN perfiles u ON u.id = m.usuario_id
     LEFT JOIN v_ordenes_compra oc ON oc.id = m.orden_compra_id
     LEFT JOIN ordenes_produccion op ON op.id = m.orden_produccion_id
     LEFT JOIN pedidos_basicos() pe ON pe.id = m.pedido_id
     LEFT JOIN costos_movimientos() cm ON cm.movimiento_id = m.id
     LEFT JOIN ajustes_inventario aj ON aj.id = m.ajuste_id
     LEFT JOIN LATERAL ( SELECT al2.nombre AS almacen
           FROM movimientos_inventario m2
             JOIN almacenes al2 ON al2.id = m2.almacen_id
          WHERE m.traspaso_id IS NOT NULL AND m2.traspaso_id = m.traspaso_id AND m2.id <> m.id
         LIMIT 1) t ON true;

-- -----------------------------------------------------------------------------
-- 4. Métricas de almacén
-- -----------------------------------------------------------------------------
-- Todo sale de los movimientos, el material de las órdenes, los ajustes y los conteos:
--   fuera de lista     = partidas surtidas a una orden que su lista no traía (para cuestionarlas)
--   consumo del taller = lo de las categorías consumibles que salió, por quién lo recibió
--   contra receta      = lo que salió de cada consumible ÷ lo que prevén las recetas de las
--                        órdenes que se terminaron en el periodo
--   exactitud          = renglones contados en conteos cerrados que no dieron diferencia
-- Los montos (valor de lo fuera de lista, de los ajustes, del consumo) solo con costos.
create or replace function public.metricas_almacen(p_desde date, p_hasta date)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  d0 timestamptz := p_desde::timestamp at time zone 'America/Mexico_City';
  d1 timestamptz := (p_hasta + 1)::timestamp at time zone 'America/Mexico_City';
  v_costos boolean := puede('costos', 1);
  v_taller boolean := consumibles_del_taller();
  r jsonb;
begin
  if not puede('inventario', 2) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  if p_hasta < p_desde then raise exception 'El periodo está al revés'; end if;

  with mov as materialized (
    select m.id, m.tipo, m.articulo_id, -m.cantidad sale, m.cantidad, m.orden_produccion_id, m.fuera_de_lista,
           coalesce(nullif(trim(m.recibio), ''), 'Sin anotar') recibio, m.usuario_id, m.en, m.motivo,
           coalesce(m.costo_unitario, 0) cu, a.nombre, a.clave, a.unidad, coalesce(c.nombre, 'Sin categoría') categoria,
           coalesce(c.consumible_taller, false) consumible
    from movimientos_inventario m join articulos a on a.id = m.articulo_id left join categorias c on c.id = a.categoria_id
    where m.en >= d0 and m.en < d1 and m.tipo <> 'inicial'
  ),
  -- Lo que prevén las recetas para las órdenes que se terminaron en el periodo.
  previsto as (
    select om.articulo_id, sum(om.requerido) cantidad
    from op_materiales om join ordenes_produccion o on o.id = om.orden_id
    where not om.agregado and o.terminada_en >= d0 and o.terminada_en < d1
    group by om.articulo_id
  ),
  receta as (
    select a.id, a.clave, a.nombre, a.unidad, coalesce(c.nombre, 'Sin categoría') categoria,
      coalesce((select sum(x.sale) from mov x where x.articulo_id = a.id and x.tipo in ('salida_consumo', 'salida_produccion')), 0) real,
      coalesce(p.cantidad, 0) previsto,
      coalesce((select sum(x.sale * x.cu) from mov x where x.articulo_id = a.id and x.tipo in ('salida_consumo', 'salida_produccion')), 0) valor
    from articulos a join categorias c on c.id = a.categoria_id and c.consumible_taller
    left join previsto p on p.articulo_id = a.id
    where p.articulo_id is not null or exists (select 1 from mov x where x.articulo_id = a.id and x.tipo in ('salida_consumo', 'salida_produccion'))
  ),
  conteo as (
    select k.id, k.nombre, al.nombre almacen, k.cerrado_en,
      (select count(*) from conteo_lineas l where l.conteo_id = k.id) lineas,
      (select count(*) from ajustes_inventario j where j.conteo_id = k.id and j.diferencia <> 0) con_diferencia
    from conteos k join almacenes al on al.id = k.almacen_id
    where k.estado = 'cerrado' and k.cerrado_en >= d0 and k.cerrado_en < d1
  )
  select jsonb_build_object(
    'periodo', jsonb_build_object('desde', p_desde, 'hasta', p_hasta),
    'con_costos', v_costos,
    'consumibles_taller', v_taller,
    'resumen', jsonb_build_object(
      'partidas_orden', (select count(*) from mov where tipo = 'salida_produccion'),
      'ordenes', (select count(distinct orden_produccion_id) from mov where tipo = 'salida_produccion'),
      'fuera_lista', (select count(*) from mov where tipo = 'salida_produccion' and fuera_de_lista),
      'fuera_lista_valor', case when v_costos then (select round(coalesce(sum(sale * cu), 0), 2) from mov where tipo = 'salida_produccion' and fuera_de_lista) end,
      'consumo_lineas', (select count(*) from mov where consumible and tipo in ('salida_consumo', 'salida_produccion')),
      'consumo_personas', (select count(distinct recibio) filter (where recibio <> 'Sin anotar') from mov where consumible and tipo in ('salida_consumo', 'salida_produccion')),
      'consumo_sin_anotar', (select count(*) from mov where tipo = 'salida_consumo' and recibio = 'Sin anotar'),
      'consumo_valor', case when v_costos then (select round(coalesce(sum(sale * cu), 0), 2) from mov where consumible and tipo in ('salida_consumo', 'salida_produccion')) end,
      'arriba_receta', (select count(*) from receta where previsto > 0 and real > previsto * 1.2),
      'con_receta', (select count(*) from receta where previsto > 0),
      'sin_receta', (select count(*) from receta where previsto = 0 and real > 0),
      'ajustes', (select count(*) from mov where tipo in ('ajuste_entrada', 'ajuste_salida')),
      'ajustes_pendientes', (select count(*) from ajustes_inventario where estado = 'pendiente'),
      'ajustes_valor', case when v_costos then (select round(coalesce(sum(cantidad * cu), 0), 2) from mov where tipo in ('ajuste_entrada', 'ajuste_salida')) end,
      'conteos', (select count(*) from conteo),
      'lineas_contadas', (select coalesce(sum(lineas), 0) from conteo),
      'lineas_con_diferencia', (select coalesce(sum(con_diferencia), 0) from conteo),
      'esperando', (select count(distinct o.id) from ordenes_produccion o join op_materiales m on m.orden_id = o.id and m.requerido > m.surtido + 0.0005
                    join articulos a on a.id = m.articulo_id left join categorias c on c.id = a.categoria_id
                    where o.estado in ('planeada', 'liberada', 'en_proceso') and o.en_espera_motivo is null
                      and not (v_taller and coalesce(c.consumible_taller, false))),
      'esperando_en_proceso', (select count(distinct o.id) from ordenes_produccion o join op_materiales m on m.orden_id = o.id and m.requerido > m.surtido + 0.0005
                    join articulos a on a.id = m.articulo_id left join categorias c on c.id = a.categoria_id
                    where o.estado = 'en_proceso' and o.en_espera_motivo is null
                      and not (v_taller and coalesce(c.consumible_taller, false)))),

    -- Partidas por semana: de la lista, fuera de lista y consumo del taller.
    'semanas', (select coalesce(jsonb_agg(jsonb_build_object('semana', g::date,
        'lista', (select count(*) from mov x where x.tipo = 'salida_produccion' and not x.fuera_de_lista
                  and (x.en at time zone 'America/Mexico_City')::date between g::date and g::date + 6),
        'fuera', (select count(*) from mov x where x.tipo = 'salida_produccion' and x.fuera_de_lista
                  and (x.en at time zone 'America/Mexico_City')::date between g::date and g::date + 6),
        'consumo', (select count(*) from mov x where x.tipo = 'salida_consumo'
                    and (x.en at time zone 'America/Mexico_City')::date between g::date and g::date + 6)) order by g), '[]')
      from generate_series(date_trunc('week', p_desde::timestamp), p_hasta::timestamp, interval '7 days') g),

    -- Cada partida fuera de lista, para preguntarle a almacén por qué.
    'fuera_lista', (select coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'en', x.en, 'orden_id', x.orden_produccion_id, 'op', o.folio,
        'articulo', x.nombre, 'clave', x.clave, 'categoria', x.categoria, 'unidad', x.unidad, 'cantidad', x.sale, 'recibio', x.recibio,
        'motivo', x.motivo, 'usuario', u.nombre, 'consumible', x.consumible,
        'valor', case when v_costos then round(x.sale * x.cu, 2) end) order by x.en desc), '[]')
      from (select * from mov where tipo = 'salida_produccion' and fuera_de_lista order by en desc limit 500) x
      left join ordenes_produccion o on o.id = x.orden_produccion_id left join perfiles u on u.id = x.usuario_id),

    -- Consumibles por persona y categoría (lo que salió al taller y lo que todavía se cargaba a órdenes).
    'personas', (select coalesce(jsonb_agg(jsonb_build_object('recibio', recibio, 'categoria', categoria, 'lineas', lineas, 'cantidad', cantidad,
        'valor', case when v_costos then valor end) order by recibio, cantidad desc), '[]')
      from (select recibio, categoria, count(*) lineas, sum(sale) cantidad, round(sum(sale * cu), 2) valor
            from mov where consumible and tipo in ('salida_consumo', 'salida_produccion') group by recibio, categoria) z),

    'receta', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'clave', clave, 'nombre', nombre, 'unidad', unidad, 'categoria', categoria,
        'real', real, 'previsto', previsto, 'valor', case when v_costos then round(valor, 2) end) order by real desc), '[]') from receta),

    'ajustes_lista', (select coalesce(jsonb_agg(jsonb_build_object('id', j.id, 'folio', j.folio, 'articulo', a.nombre, 'clave', a.clave, 'unidad', a.unidad,
        'almacen', al.nombre, 'diferencia', j.diferencia, 'motivo', j.motivo, 'estado', j.estado, 'de_conteo', j.conteo_id is not null,
        'solicito', ps.nombre, 'resolvio', pr.nombre, 'en', coalesce(j.resuelto_en, j.solicitado_en),
        'valor', case when v_costos then round(j.diferencia * coalesce((select costo * tc(moneda) from costos_articulo ca where ca.articulo_id = j.articulo_id), 0), 2) end)
        order by coalesce(j.resuelto_en, j.solicitado_en) desc), '[]')
      from ajustes_inventario j join articulos a on a.id = j.articulo_id join almacenes al on al.id = j.almacen_id
      left join perfiles ps on ps.id = j.solicitado_por left join perfiles pr on pr.id = j.resuelto_por
      where (j.solicitado_en >= d0 and j.solicitado_en < d1) or (j.resuelto_en >= d0 and j.resuelto_en < d1) or j.estado = 'pendiente'),

    'conteos_lista', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'nombre', nombre, 'almacen', almacen, 'cerrado_en', cerrado_en,
        'lineas', lineas, 'con_diferencia', con_diferencia) order by cerrado_en desc), '[]') from conteo),

    -- Quién registra qué (por usuario del ERP).
    'quien', (select coalesce(jsonb_agg(jsonb_build_object('usuario', coalesce(u.nombre, 'Sistema'),
        'surtidos', z.surtidos, 'consumos', z.consumos, 'ventas', z.ventas, 'entradas', z.entradas, 'ajustes', z.ajustes, 'traspasos', z.traspasos)
        order by z.total desc), '[]')
      from (select usuario_id, count(*) total,
              count(*) filter (where tipo = 'salida_produccion') surtidos, count(*) filter (where tipo = 'salida_consumo') consumos,
              count(*) filter (where tipo = 'salida_venta') ventas, count(*) filter (where tipo in ('entrada_compra', 'devolucion')) entradas,
              count(*) filter (where tipo in ('ajuste_entrada', 'ajuste_salida')) ajustes, count(*) filter (where tipo = 'traspaso_salida') traspasos
            from mov group by usuario_id) z left join perfiles u on u.id = z.usuario_id),

    -- Órdenes abiertas con partidas por surtir (sin consumibles del taller), las que ya empezaron primero.
    'esperando', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'folio', folio, 'estado', estado, 'equipo', equipo, 'partidas', partidas)
        order by estado = 'en_proceso' desc, folio), '[]')
      from (select o.id, o.folio, o.estado::text estado, a.nombre equipo, count(*) partidas
            from ordenes_produccion o join articulos a on a.id = o.articulo_id
            join op_materiales m on m.orden_id = o.id and m.requerido > m.surtido + 0.0005
            join articulos am on am.id = m.articulo_id left join categorias c on c.id = am.categoria_id
            where o.estado in ('planeada', 'liberada', 'en_proceso') and o.en_espera_motivo is null
              and not (v_taller and coalesce(c.consumible_taller, false))
            group by o.id, o.folio, o.estado, a.nombre order by o.estado = 'en_proceso' desc, o.folio limit 40) w)
  ) into r;
  return r;
end $$;
revoke execute on function public.metricas_almacen(date, date) from public, anon;
grant execute on function public.metricas_almacen(date, date) to authenticated;

-- -----------------------------------------------------------------------------
-- 5. El objetivo de almacén «surtido a producción» no cuenta los consumibles del taller
-- -----------------------------------------------------------------------------
-- Sin esto, con el switch encendido toda orden terminaría «con material sin surtir» (los discos
-- de la receta ya no se surten a la orden) y le bajaría el bono a almacén. Es la función de 070
-- tal cual, salvo esos dos conteos.
create or replace function public.objetivo_medir(p_clave text, p_checklist text, p_empleado uuid, p_mes date,
  p_parametros jsonb default '{}'::jsonb) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  tz constant text := 'America/Mexico_City';
  v_ini date := date_trunc('month', p_mes)::date;
  v_fin date := (date_trunc('month', p_mes) + interval '1 month')::date;          -- exclusivo
  v_t0 timestamptz := date_trunc('month', p_mes)::timestamp at time zone 'America/Mexico_City';
  v_t1 timestamptz := (date_trunc('month', p_mes) + interval '1 month')::timestamp at time zone 'America/Mexico_City';
  v_hoy date := hoy_planta();
  v_corte date := least((date_trunc('month', p_mes) + interval '1 month')::date - 1, hoy_planta());
  v_usuario uuid;
  v_a numeric; v_b numeric; v_n int;
  v_areas int[] := coalesce(array(select jsonb_array_elements_text(coalesce(p_parametros->'areas', '[]'::jsonb))::int), '{}');
  v_almacenes int[] := coalesce(array(select jsonb_array_elements_text(coalesce(p_parametros->'almacenes', '[]'::jsonb))::int), '{}');
  v_r jsonb;
begin
  select usuario_id into v_usuario from empleados where id = p_empleado;

  -- Checklist: un día (o un día-área) con cualquier falla es un incumplimiento.
  if p_checklist is not null then
    with m as (
      select x.fecha, x.area_id, a.nombre area, bool_and(x.cumplio) cumplio,
        string_agg(case x.momento when 'entrada' then 'entrada' when 'break1' then 'break 1' when 'break2' then 'break 2'
                                  else 'revisión' end || coalesce(' (' || x.nota || ')', ''), ', ' order by x.momento)
          filter (where not x.cumplio) fallas,
        string_agg(distinct p.nombre, ', ') filter (where not x.cumplio) quien
      from objetivo_marcas x
      left join objetivo_areas a on a.id = x.area_id
      left join perfiles p on p.id = x.marcado_por
      where x.tipo = p_checklist and x.fecha >= v_ini and x.fecha < v_fin
        and case when cardinality(v_areas) > 0 then x.area_id = any(v_areas) else x.empleado_id = p_empleado end
      group by x.fecha, x.area_id, a.nombre
    )
    select case when count(*) = 0 then jsonb_build_object('sin_dato', true,
             'nota', 'Nadie marcó el checklist este mes: sin marcas no se sabe si cumplió. Márcalo en el checklist diario o califícalo a mano.')
           else jsonb_build_object('posibles', count(*), 'modo', 'resta',
             'nota', format('%s %s marcados en el mes, %s con falla. Un día sin marca no cuenta en contra.',
                            count(*), case when cardinality(v_areas) > 0 then 'días-área' else 'días' end, count(*) filter (where not m.cumplio)),
             'evidencias', coalesce(jsonb_agg(jsonb_build_object(
                'tipo', 'marca', 'referencia', m.fecha::text || coalesce(':' || m.area_id, ''),
                'folio', coalesce(m.area, case p_checklist when 'celular' then 'Celular' when 'epp' then 'EPP'
                                                           when 'vehiculo' then 'Vehículo' else 'Checklist' end),
                'detalle', 'No cumplió: ' || m.fallas || coalesce(' · marcó ' || m.quien, ''),
                'fecha', m.fecha, 'cuenta', true) order by m.fecha) filter (where not m.cumplio), '[]'::jsonb)) end
    into v_r from m;
    return v_r;
  end if;

  case p_clave
  when 'ventas_mes' then
    select jsonb_build_object('valor', coalesce(round(sum(p.subtotal * p.tipo_cambio), 2), 0), 'modo', 'no',
      'nota', 'Pedidos del mes sin IVA ni cancelados, en pesos al tipo de cambio del pedido.',
      'evidencias', coalesce(jsonb_agg(jsonb_build_object('tipo', 'pedido', 'referencia', p.id::text, 'folio', p.folio,
          'detalle', coalesce(c.nombre, 'Sin cliente') || ' · ' || p.canal::text, 'fecha', p.fecha,
          'cantidad', round(p.subtotal * p.tipo_cambio, 2), 'cuenta', false) order by p.subtotal * p.tipo_cambio desc), '[]'::jsonb))
    into v_r
    from pedidos p left join clientes c on c.id = p.cliente_id
    where p.estado <> 'cancelado' and p.fecha >= v_ini and p.fecha < v_fin;

  when 'crecimiento_ventas' then
    select coalesce(sum(subtotal * tipo_cambio) filter (where fecha >= v_ini), 0),
           coalesce(sum(subtotal * tipo_cambio) filter (where fecha < v_ini), 0)
    into v_a, v_b
    from pedidos where estado <> 'cancelado' and fecha >= (v_ini - interval '1 month')::date and fecha < v_fin;
    if v_b = 0 then
      v_r := jsonb_build_object('sin_dato', true, 'nota', 'El mes anterior no tuvo ventas: no hay contra qué comparar.');
    else
      v_r := jsonb_build_object('valor', round(100 * (v_a / v_b - 1), 2), 'modo', 'no',
        'nota', 'Ventas sin IVA del mes contra el mes anterior.',
        'evidencias', jsonb_build_array(
          jsonb_build_object('tipo', 'resumen', 'referencia', 'mes', 'folio', objetivo_nombre_mes(v_ini),
                             'detalle', 'Ventas del mes', 'cantidad', round(v_a, 2), 'cuenta', false),
          jsonb_build_object('tipo', 'resumen', 'referencia', 'anterior', 'folio', objetivo_nombre_mes((v_ini - interval '1 month')::date),
                             'detalle', 'Ventas del mes anterior', 'cantidad', round(v_b, 2), 'cuenta', false)));
    end if;

  when 'seguimiento_prospectos' then
    with o as (
      select o.id, o.titulo, o.creado_en, c.nombre cliente,
        (select count(*) from actividades a where a.oportunidad_id = o.id
           and a.en >= o.creado_en and a.en < o.creado_en + interval '7 days') seg
      from oportunidades o left join clientes c on c.id = o.cliente_id
      where o.creado_en >= v_t0 and o.creado_en < v_t1 and o.creado_en + interval '7 days' <= now()
    )
    select jsonb_build_object('posibles', count(*), 'modo', 'porcentaje',
      'nota', 'Oportunidades creadas en el mes (con sus 7 días ya cumplidos). Incidencia: menos de 2 actividades en esos 7 días.',
      'evidencias', coalesce(jsonb_agg(jsonb_build_object('tipo', 'oportunidad', 'referencia', o.id::text, 'folio', o.titulo,
          'detalle', coalesce(o.cliente || ' · ', '') || o.seg || ' seguimiento(s) en 7 días',
          'fecha', (o.creado_en at time zone tz)::date, 'cantidad', o.seg, 'cuenta', o.seg < 2) order by o.creado_en), '[]'::jsonb))
    into v_r from o;

  when 'conversiones_registradas' then
    select jsonb_build_object('posibles', count(*), 'modo', 'porcentaje',
      'nota', 'Pedidos del mes sin Mercado Libre, Amazon ni históricos. Incidencia: pedido sin cotización del ERP.',
      'evidencias', coalesce(jsonb_agg(jsonb_build_object('tipo', 'pedido', 'referencia', p.id::text, 'folio', p.folio,
          'detalle', coalesce(c.nombre, 'Sin cliente') || ' · sin cotización', 'fecha', p.fecha,
          'cantidad', round(p.subtotal * p.tipo_cambio, 2), 'cuenta', true) order by p.fecha) filter (where p.cotizacion_id is null), '[]'::jsonb))
    into v_r
    from pedidos p left join clientes c on c.id = p.cliente_id
    where p.estado <> 'cancelado' and not p.historico and p.fecha >= v_ini and p.fecha < v_fin
      and p.canal not in ('mercadolibre', 'amazon');

  when 'costos_vigentes' then
    with linea as (
      select a.id, a.clave, a.nombre from articulos a
      where a.activo and a.tipo in ('componente', 'materia_prima')
        and exists (select 1 from bom_lineas b join articulos p on p.id = b.padre_id where b.hijo_id = a.id and p.activo)
    ), fechas as (
      select l.*, greatest(
          (select max((h.en at time zone tz)::date) from historial_costos h where h.articulo_id = l.id and h.en < v_t1),
          (select c.actualizado_en from costos_articulo c where c.articulo_id = l.id and c.actualizado_en < v_fin)) ultima
      from linea l
    ), vencidos as (
      select f.*, row_number() over (order by f.ultima nulls first, f.clave) n
      from fechas f where f.ultima is null or f.ultima < (v_fin - interval '3 months')::date
    )
    select jsonb_build_object('posibles', (select count(*) from linea), 'valor', (select count(*) from vencidos), 'modo', 'no',
      'nota', format('%s de %s componentes de línea con costo de más de 3 meses (o sin costo) al cierre del mes.',
                     (select count(*) from vencidos), (select count(*) from linea)),
      'evidencias', coalesce((select jsonb_agg(jsonb_build_object('tipo', 'articulo', 'referencia', v.id::text, 'folio', v.clave,
            'detalle', v.nombre || ' · ' || coalesce('costo del ' || to_char(v.ultima, 'DD/MM/YYYY'), 'sin costo'),
            'fecha', v.ultima, 'cuenta', true) order by v.n) from vencidos v where v.n <= 100), '[]'::jsonb)
        || case when (select count(*) from vencidos) > 100 then jsonb_build_array(jsonb_build_object(
             'tipo', 'resumen', 'referencia', 'resto', 'folio', 'Y ' || ((select count(*) from vencidos) - 100) || ' artículos más',
             'detalle', 'Mismo motivo: costo de más de 3 meses o sin costo', 'cuenta', true,
             'unidades', (select count(*) from vencidos) - 100)) else '[]'::jsonb end)
    into v_r;

  when 'proveedores_nuevos' then
    select jsonb_build_object('valor', count(*), 'modo', 'no',
      'nota', 'Proveedores dados de alta en el mes con su primera orden de compra en el mes.',
      'evidencias', coalesce(jsonb_agg(jsonb_build_object('tipo', 'proveedor', 'referencia', p.id::text, 'folio', p.nombre,
          'detalle', coalesce(p.categoria || ' · ', '') || 'primera OC ' || o.folio, 'fecha', o.fecha, 'cuenta', false)), '[]'::jsonb))
    into v_r
    from proveedores p
    cross join lateral (select x.folio, x.fecha from ordenes_compra x where x.proveedor_id = p.id
                        and x.estado not in ('borrador', 'cancelada') order by x.fecha limit 1) o
    where p.creado_en >= v_t0 and p.creado_en < v_t1 and o.fecha >= v_ini and o.fecha < v_fin;

  when 'materiales_por_cliente' then
    with lib as (
      select distinct on (ev.orden_id) ev.orden_id, ev.en from op_eventos ev
      where ev.tipo = 'liberada' and ev.en >= v_t0 and ev.en < v_t1 order by ev.orden_id, ev.en
    ), x as (
      select o.id, o.folio, a.nombre equipo, l.en,
        not exists (select 1 from op_materiales m where m.orden_id = o.id) sin_material,
        (select count(*) from op_eventos c where c.orden_id = o.id and c.tipo = 'cambio_material' and c.en > l.en) cambios
      from lib l join ordenes_produccion o on o.id = l.orden_id join articulos a on a.id = o.articulo_id
    )
    select jsonb_build_object('posibles', count(*), 'modo', 'porcentaje',
      'nota', 'Órdenes liberadas en el mes. Incidencia: sin lista de material o con cambios de material después de liberarla.',
      'evidencias', coalesce(jsonb_agg(jsonb_build_object('tipo', 'orden_produccion', 'referencia', x.id::text, 'folio', x.folio,
          'detalle', x.equipo || ' · ' || case when x.sin_material then 'liberada sin lista de material'
                                              when x.cambios > 0 then x.cambios || ' cambio(s) de material después de liberarla'
                                              else 'material completo al liberar' end,
          'fecha', (x.en at time zone tz)::date, 'cantidad', x.cambios, 'cuenta', x.sin_material or x.cambios > 0) order by x.en), '[]'::jsonb))
    into v_r from x;

  when 'entregas_a_tiempo' then
    with x as (
      select o.id, o.folio, a.nombre equipo, o.fecha_compromiso, (o.terminada_en at time zone tz)::date terminada,
        o.pedido_id is null para_stock
      from ordenes_produccion o join articulos a on a.id = o.articulo_id
      where o.estado <> 'cancelada' and o.fecha_compromiso >= v_ini and o.fecha_compromiso < v_fin
        -- La que sigue abierta y todavía puede llegar a tiempo no se juzga aún.
        and (o.terminada_en is not null or o.fecha_compromiso < v_corte)
    ), y as (
      select x.*, coalesce(x.terminada, v_corte) - x.fecha_compromiso atraso from x
    )
    select jsonb_build_object('posibles', count(*), 'modo', 'porcentaje',
      'nota', 'Órdenes con fecha compromiso en el mes, incluidas las de stock. Incidencia: terminada después de su fecha o abierta al cierre.',
      'evidencias', coalesce(jsonb_agg(jsonb_build_object('tipo', 'orden_produccion', 'referencia', y.id::text, 'folio', y.folio,
          'detalle', y.equipo || case when y.para_stock then ' (stock)' else '' end || ' · ' ||
              case when y.terminada is null then 'sigue abierta, ' || y.atraso || ' días tarde'
                   when y.atraso > 0 then 'terminada ' || y.atraso || ' días tarde' else 'a tiempo' end,
          'fecha', y.fecha_compromiso, 'cantidad', greatest(y.atraso, 0), 'cuenta', y.atraso > 0) order by y.fecha_compromiso), '[]'::jsonb))
    into v_r from y;

  when 'inicio_sin_orden' then
    with ini as (
      select distinct on (ev.orden_id) ev.orden_id, ev.en from op_eventos ev where ev.tipo = 'inicio' order by ev.orden_id, ev.en
    ), x as (
      select o.id, o.folio, a.nombre equipo, i.en, o.revisado_ingenieria_en,
        o.revisado_ingenieria_en is null or o.revisado_ingenieria_en > i.en sin_revision
      from ini i join ordenes_produccion o on o.id = i.orden_id join articulos a on a.id = o.articulo_id
      where i.en >= v_t0 and i.en < v_t1
    )
    select jsonb_build_object('posibles', count(*), 'modo', 'porcentaje',
      'nota', 'Órdenes que empezaron en el mes. Incidencia: empezó antes de la revisión de ingeniería.',
      'evidencias', coalesce(jsonb_agg(jsonb_build_object('tipo', 'orden_produccion', 'referencia', x.id::text, 'folio', x.folio,
          'detalle', x.equipo || ' · ' || case when x.sin_revision then 'empezó sin revisión de ingeniería' else 'revisada antes de empezar' end,
          'fecha', (x.en at time zone tz)::date, 'cuenta', x.sin_revision) order by x.en), '[]'::jsonb))
    into v_r from x;

  when 'bitacora_incidencias' then
    if v_usuario is null then
      v_r := jsonb_build_object('sin_dato', true, 'nota', 'La persona no tiene usuario en el ERP: no se sabe qué registró. Califícalo a mano.');
    else
      select jsonb_build_object('valor', count(*), 'modo', 'no',
        'nota', 'Problemas que registró en las órdenes de producción en el mes.',
        'evidencias', coalesce(jsonb_agg(jsonb_build_object('tipo', 'evento', 'referencia', ev.id::text, 'folio', o.folio,
            'detalle', left(ev.nota, 160), 'fecha', (ev.en at time zone tz)::date, 'cuenta', false) order by ev.en), '[]'::jsonb))
      into v_r
      from op_eventos ev join ordenes_produccion o on o.id = ev.orden_id
      where ev.tipo = 'problema' and ev.usuario_id = v_usuario and ev.en >= v_t0 and ev.en < v_t1;
    end if;

  when 'exactitud_inventario' then
    select jsonb_build_object('valor', count(*), 'modo', 'no',
      'nota', 'Ajustes de inventario del mes con diferencia. Los rechazados no cuentan: el conteo estaba mal, no el inventario.',
      'evidencias', coalesce(jsonb_agg(jsonb_build_object('tipo', 'ajuste', 'referencia', j.id::text, 'folio', j.folio,
          'detalle', a.clave || ' · ' || a.nombre || ' · ' || al.nombre || ' · sistema ' || trim_scale(j.cantidad_sistema)
                     || ', físico ' || trim_scale(j.cantidad_fisica) || ' · ' || j.motivo,
          'fecha', (j.solicitado_en at time zone tz)::date, 'cantidad', j.diferencia, 'cuenta', true) order by j.solicitado_en), '[]'::jsonb))
    into v_r
    from ajustes_inventario j join articulos a on a.id = j.articulo_id join almacenes al on al.id = j.almacen_id
    where j.estado <> 'rechazado' and j.diferencia <> 0 and j.solicitado_en >= v_t0 and j.solicitado_en < v_t1
      and (cardinality(v_almacenes) = 0 or j.almacen_id = any(v_almacenes));

  when 'material_a_tiempo_almacen' then
    -- Foto: solo vale tomarla durante el mes o en los 5 días siguientes al cierre.
    if v_hoy < v_ini or v_hoy > v_fin + 5 then return jsonb_build_object('conservar', true); end if;
    select jsonb_build_object('valor', count(*), 'modo', 'no',
      'nota', format('Foto del %s: artículos bajo su punto de reorden sin requisición abierta ni compra en camino.', to_char(v_hoy, 'DD/MM/YYYY')),
      'evidencias', coalesce(jsonb_agg(jsonb_build_object('tipo', 'articulo', 'referencia', r.articulo_id::text, 'folio', r.clave,
          'detalle', r.nombre || ' · disponible ' || trim_scale(r.disponible) || ' de ' || trim_scale(r.punto_reorden) || ' ' || r.unidad,
          'fecha', v_hoy, 'cantidad', r.punto_reorden - r.disponible, 'cuenta', true) order by r.clave), '[]'::jsonb))
    into v_r
    from reabasto() r
    where r.estado = 'ordenar' and r.en_transito = 0
      and not exists (select 1 from requisicion_lineas l join requisiciones q on q.id = l.requisicion_id
                      where l.articulo_id = r.articulo_id and l.estado = 'pendiente' and q.estado in ('abierta', 'en_compra'));

  when 'material_pedido_de_mas' then
    with x as (
      select l.id, q.folio, q.creado_en, a.clave, a.nombre, a.unidad, l.cantidad,
        coalesce((select sum(m.cantidad) from movimientos_inventario m join almacenes al on al.id = m.almacen_id
                  where m.articulo_id = l.articulo_id and al.disponible_para_planta and m.en <= q.creado_en), 0) en_planta
      from requisicion_lineas l join requisiciones q on q.id = l.requisicion_id join articulos a on a.id = l.articulo_id
      where q.origen in ('manual', 'reabasto') and q.creado_en >= v_t0 and q.creado_en < v_t1
    )
    select jsonb_build_object('posibles', count(*), 'valor', count(*) filter (where x.en_planta >= x.cantidad), 'modo', 'no',
      'nota', 'Partidas de requisición del mes (manuales y de reabasto). Incidencia: en ese momento ya había en planta lo que se pidió.',
      'evidencias', coalesce(jsonb_agg(jsonb_build_object('tipo', 'requisicion', 'referencia', x.id::text, 'folio', x.folio,
          'detalle', x.clave || ' · ' || x.nombre || ' · pidió ' || trim_scale(x.cantidad) || ', había ' || trim_scale(x.en_planta) || ' ' || x.unidad,
          'fecha', (x.creado_en at time zone tz)::date, 'cantidad', x.cantidad, 'cuenta', true) order by x.creado_en)
          filter (where x.en_planta >= x.cantidad), '[]'::jsonb))
    into v_r from x;

  when 'desabasto' then
    if v_hoy < v_ini or v_hoy > v_fin + 5 then return jsonb_build_object('conservar', true); end if;
    select jsonb_build_object(
      'valor', case when count(*) > 0 then round(100.0 * count(*) filter (where r.en_planta < r.punto_reorden) / count(*), 2) else 0 end,
      'posibles', count(*), 'modo', 'no',
      'nota', format('Foto del %s: %s de %s artículos con punto de reorden están por debajo en planta.',
                     to_char(v_hoy, 'DD/MM/YYYY'), count(*) filter (where r.en_planta < r.punto_reorden), count(*)),
      'evidencias', coalesce(jsonb_agg(jsonb_build_object('tipo', 'articulo', 'referencia', r.articulo_id::text, 'folio', r.clave,
          'detalle', r.nombre || ' · en planta ' || trim_scale(r.en_planta) || ' de ' || trim_scale(r.punto_reorden) || ' ' || r.unidad,
          'fecha', v_hoy, 'cantidad', r.punto_reorden - r.en_planta, 'cuenta', false) order by r.clave)
          filter (where r.en_planta < r.punto_reorden), '[]'::jsonb))
    into v_r from reabasto() r where r.punto_reorden > 0;

  when 'inventario_herramientas' then
    select jsonb_build_object('valor', count(*), 'modo', 'no',
      'nota', 'Conteos cerrados en el mes con "herramienta" en el nombre.',
      'evidencias', coalesce(jsonb_agg(jsonb_build_object('tipo', 'conteo', 'referencia', c.id::text, 'folio', c.nombre,
          'detalle', al.nombre || ' · ' || (select count(*) from conteo_lineas l where l.conteo_id = c.id) || ' artículos contados',
          'fecha', (c.cerrado_en at time zone tz)::date, 'cuenta', false) order by c.cerrado_en), '[]'::jsonb))
    into v_r
    from conteos c join almacenes al on al.id = c.almacen_id
    where c.estado = 'cerrado' and c.cerrado_en >= v_t0 and c.cerrado_en < v_t1 and sin_acentos(c.nombre) like '%herramienta%';

  when 'surtido_produccion' then
    with x as (
      select o.id, o.folio, a.nombre equipo, (o.terminada_en at time zone tz)::date terminada,
        (select count(*) from op_materiales m where m.orden_id = o.id and m.requerido > 0 and m.surtido < m.requerido
           and not es_consumible_taller(m.articulo_id)) sin_surtir,
        (select count(*) from op_materiales m where m.orden_id = o.id and m.requerido > 0 and not es_consumible_taller(m.articulo_id)) renglones
      from ordenes_produccion o join articulos a on a.id = o.articulo_id
      where o.terminada_en >= v_t0 and o.terminada_en < v_t1
    )
    select jsonb_build_object('posibles', count(*), 'modo', 'porcentaje',
      'nota', 'Órdenes terminadas en el mes. Incidencia: terminó con material sin surtir completo.',
      'evidencias', coalesce(jsonb_agg(jsonb_build_object('tipo', 'orden_produccion', 'referencia', x.id::text, 'folio', x.folio,
          'detalle', x.equipo || ' · ' || case when x.sin_surtir > 0 then x.sin_surtir || ' de ' || x.renglones || ' renglones sin surtir completo'
                                               else 'material surtido completo' end,
          'fecha', x.terminada, 'cantidad', x.sin_surtir, 'cuenta', x.sin_surtir > 0) order by x.terminada), '[]'::jsonb))
    into v_r from x;

  when 'recepcion_oc' then
    with oc as (
      select distinct m.orden_compra_id id from movimientos_inventario m
      where m.tipo = 'entrada_compra' and m.orden_compra_id is not null and m.en >= v_t0 and m.en < v_t1
    ), x as (
      select o.id, o.folio, p.nombre proveedor, o.fecha_entrega,
        (select count(*) from oc_lineas l where l.orden_compra_id = o.id and l.recibido > l.cantidad) de_mas,
        o.estado = 'parcial' and o.fecha_entrega < v_corte incompleta
      from oc join ordenes_compra o on o.id = oc.id join proveedores p on p.id = o.proveedor_id
    )
    select jsonb_build_object('posibles', count(*), 'modo', 'porcentaje',
      'nota', 'Órdenes de compra con entradas en el mes. Incidencia: se recibió de más, o quedó incompleta con su fecha de entrega vencida.',
      'evidencias', coalesce(jsonb_agg(jsonb_build_object('tipo', 'orden_compra', 'referencia', x.id::text, 'folio', x.folio,
          'detalle', x.proveedor || ' · ' || case when x.de_mas > 0 then 'se recibió de más en ' || x.de_mas || ' partida(s)'
                                                  when x.incompleta then 'incompleta; debía llegar el ' || to_char(x.fecha_entrega, 'DD/MM/YYYY')
                                                  else 'recibida como se pidió' end,
          'fecha', x.fecha_entrega, 'cuenta', x.de_mas > 0 or x.incompleta) order by x.folio), '[]'::jsonb))
    into v_r from x;

  else
    v_r := jsonb_build_object('sin_dato', true, 'nota', 'Este indicador todavía no se mide solo: califícalo a mano.');
  end case;
  return v_r;
end $$;

-- =============================================================================
-- Almacén entrega sabiendo qué se dio y a quién, también por partes (KZ-2, contramedidas 1–3).
--
-- Mimi preguntó cómo llevar el control de lo que entrega, completo o en partes, y a quién.
-- Lo que había:
--   * Surtir material a una orden guardaba qué, cuánto, de dónde y quién lo dio; a quién, no.
--   * Nada le decía a almacén qué orden preparar primero: se enteraba cuando iban por el material.
--   * «Entregar» un pedido era todo o nada y no descontaba el inventario: el ERP avisaba después
--     «pedido entregado sin salida de inventario» y alguien tenía que corregirlo a mano.
--   * Las órdenes que vinieron de la hoja ya tenían material entregado con las salidas de la
--     hoja. Surtirlo ahora lo descontaría dos veces: el inventario que se cargó el 20 de octubre
--     ya venía sin eso. Por eso no se había surtido ninguna.
--
-- Ahora:
--   1. Surtir pide quién recibe (el nombre, como en la terminal) y lo guarda en el movimiento y
--      en la historia de la orden. «Ya se entregó antes del ERP» registra lo que salió con la
--      hoja sin tocar el inventario, solo en órdenes que existían antes del corte.
--   2. ordenes_por_surtir(): lo que almacén tiene que preparar, en el orden del plan del taller.
--   3. Entregar un pedido por partes: cada entrega dice qué partidas y cuántas. Descuenta del
--      inventario lo que todavía no había salido con ese pedido (a mano o con un envío), deja
--      entregados los equipos y anota lo que no pudo descontar para que almacén lo revise. El
--      pedido queda entregado cuando ya no falta nada; deshacer regresa todo, inventario incluido.
-- =============================================================================

alter table public.movimientos_inventario add column if not exists recibio text;
comment on column public.movimientos_inventario.recibio is 'Quién recibió físicamente lo que salió (el del taller o el cliente).';

alter table public.pedido_salidas add column if not exists lineas jsonb;
alter table public.pedido_salidas add column if not exists movimientos bigint[] not null default '{}';
alter table public.pedido_salidas add column if not exists ordenes uuid[] not null default '{}';
alter table public.pedido_salidas add column if not exists sin_inventario jsonb not null default '[]';
comment on column public.pedido_salidas.lineas is 'Lo que salió en esta entrega: [{id de la partida, cantidad}]. Las de antes de 177 (null) fueron de todo el pedido.';

-- Hasta qué día de creación una orden puede registrar lo que ya se le había entregado con la hoja.
insert into public.configuracion (clave, valor, descripcion) values ('surtido_antes_del_erp', '"2026-10-27"',
  'Órdenes creadas hasta este día pueden registrar el material que se les entregó con la hoja, sin descontar inventario.')
on conflict (clave) do nothing;

create or replace function public.corte_surtido_previo() returns date
language sql stable security definer set search_path = public as $$
  select (valor #>> '{}')::date from configuracion where clave = 'surtido_antes_del_erp'
$$;

-- -----------------------------------------------------------------------------
-- 1. Surtir con quién recibe, y lo entregado antes del ERP
-- -----------------------------------------------------------------------------
drop function if exists public.surtir_material(uuid, jsonb);
create or replace function public.surtir_material(p_op uuid, p_lineas jsonb, p_recibio text default null, p_previo boolean default false)
returns void language plpgsql security definer set search_path = public as $$
declare l record; o ordenes_produccion; v_req numeric; v_res reservas; v_rest numeric; v_propio numeric; v_libre numeric;
  v_nombre text; v_n int := 0; v_fuera int := 0; v_recibio text := nullif(trim(p_recibio), '');
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

    if p_previo then
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
      if v_req is null and coalesce(trim(l.motivo), '') = '' then
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
  end loop;
  if v_n = 0 then raise exception 'No hay cantidades para surtir'; end if;
  insert into op_eventos (orden_id, tipo, nota, responsable)
  values (p_op, 'surtido',
          case when p_previo then format('%s partida(s) que ya se habían entregado con la hoja; no descuenta inventario', v_n)
               else format('%s partida(s)%s', v_n, case when v_fuera > 0 then format(', %s fuera de lista', v_fuera) else '' end) end,
          v_recibio);
end $$;
revoke execute on function public.surtir_material(uuid, jsonb, text, boolean) from public, anon;
grant execute on function public.surtir_material(uuid, jsonb, text, boolean) to authenticated;

-- -----------------------------------------------------------------------------
-- 2. Lo que almacén tiene que preparar, en el orden en que el taller lo va a tomar
-- -----------------------------------------------------------------------------
create or replace function public.ordenes_por_surtir()
returns table (id uuid, folio text, estado text, equipo text, pedido text, cliente text, para_stock boolean,
               partidas int, empieza date, fecha_compromiso date, previo boolean)
-- No es «stable»: plan_produccion() arma tablas temporales y en una consulta de solo lectura falla.
language plpgsql security definer set search_path = public as $$
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
  left join lateral pedido_de_orden(o.pedido_id) pb on true
  left join plan pl on pl.orden_id = o.id
  where o.estado in ('planeada', 'liberada', 'en_proceso') and o.en_espera_motivo is null
  group by o.id, o.folio, o.estado, a.nombre, pb.folio, pb.cliente, pl.inicio, o.fecha_compromiso, o.creado_en, o.pedido_id, o.prioridad
  order by pl.inicio nulls last, o.prioridad, o.fecha_compromiso nulls last, o.folio;
end $$;
revoke execute on function public.ordenes_por_surtir() from public, anon;
grant execute on function public.ordenes_por_surtir() to authenticated;

-- -----------------------------------------------------------------------------
-- 3. Entregar un pedido por partes, con su salida de inventario
-- -----------------------------------------------------------------------------
-- Lo que salió en una entrega: inventario de los componentes (solo lo que no había salido ya
-- con el pedido), los equipos fabricados quedan entregados, y lo que no se pudo descontar se
-- anota para almacén. No detiene la entrega: el cliente está en el mostrador.
create or replace function public._salida_inventario_entrega(p_salida uuid) returns void
language plpgsql security definer set search_path = public as $$
declare s pedido_salidas; p pedidos; l record; o record; v_ops int; v_meta numeric; v_hecho numeric; v_desc numeric;
  v_alm int; v_exist numeric; v_libre numeric; v_mov bigint; v_movs bigint[] := '{}'; v_ordenes uuid[] := '{}';
  v_sin jsonb := '[]'; v_res reservas; v_rest numeric;
begin
  select * into s from pedido_salidas where id = p_salida for update;
  select * into p from pedidos where id = s.pedido_id;
  for l in select pl.id, pl.articulo_id, x.cantidad, a.tipo art_tipo, a.controla_inventario, coalesce(a.nombre, pl.titulo) nombre
           from jsonb_to_recordset(coalesce(s.lineas, '[]')) x(id uuid, cantidad numeric)
           join pedido_lineas pl on pl.id = x.id left join articulos a on a.id = pl.articulo_id loop
    if l.articulo_id is null or l.art_tipo = 'servicio' then continue; end if;
    -- Equipo fabricado: su material ya salió con la orden; la orden queda entregada.
    select count(*) into v_ops from ordenes_de_partida(s.pedido_id, l.id, l.articulo_id);
    if v_ops > 0 then
      for o in select x.id from ordenes_de_partida(s.pedido_id, l.id, l.articulo_id) x
               where x.estado = 'terminada' order by x.folio limit ceil(l.cantidad)::int loop
        update ordenes_produccion set estado = 'entregada', entregada_en = now() where id = o.id;
        insert into op_eventos (orden_id, tipo, nota) values (o.id, 'entregada', format('Salió con la entrega %s de %s', s.numero, p.folio));
        v_ordenes := v_ordenes || o.id;
      end loop;
      continue;
    end if;
    if not coalesce(l.controla_inventario, false) then continue; end if;

    -- Lo entregado de este artículo contra lo que ya salió del inventario con el pedido.
    perform 1 from existencias where articulo_id = l.articulo_id for update;
    select coalesce(sum(pl.cantidad_entregada), 0) into v_meta from pedido_lineas pl
    where pl.pedido_id = s.pedido_id and pl.articulo_id = l.articulo_id;
    select coalesce(-sum(m.cantidad), 0) into v_hecho from movimientos_inventario m
    where m.pedido_id = s.pedido_id and m.articulo_id = l.articulo_id and m.tipo in ('salida_venta', 'devolucion');
    v_desc := least(l.cantidad, greatest(0, v_meta - v_hecho));
    if v_desc <= 0 then continue; end if;

    v_alm := almacen_de_salida(l.articulo_id, v_desc);
    select coalesce(max(x.cantidad), 0) into v_exist from existencias x where x.articulo_id = l.articulo_id and x.almacen_id = v_alm;
    select coalesce(sum(x.cantidad), 0) - coalesce((select sum(r.cantidad - r.surtido) from reservas r
                                                     where r.articulo_id = l.articulo_id and r.estado = 'activa'
                                                       and r.pedido_id is distinct from s.pedido_id), 0)
      into v_libre
    from existencias x join almacenes al on al.id = x.almacen_id
    where x.articulo_id = l.articulo_id and al.disponible_para_planta;
    if v_alm is null or v_exist < v_desc or v_libre < v_desc then
      v_sin := v_sin || jsonb_build_object('articulo', l.nombre, 'cantidad', v_desc, 'hay', greatest(least(v_exist, v_libre), 0));
      continue;
    end if;

    insert into movimientos_inventario (tipo, articulo_id, almacen_id, cantidad, pedido_id, motivo, recibio, costo_unitario)
    values ('salida_venta', l.articulo_id, v_alm, -v_desc, s.pedido_id, format('%s · entrega %s', p.folio, s.numero), s.recibio,
            (select c.costo * tc(c.moneda) from costos_articulo c where c.articulo_id = l.articulo_id))
    returning id into v_mov;
    v_movs := v_movs || v_mov;
    v_rest := v_desc;
    for v_res in select * from reservas where pedido_id = s.pedido_id and articulo_id = l.articulo_id and estado = 'activa'
                 order by creado_en for update loop
      exit when v_rest <= 0;
      update reservas set surtido = surtido + least(v_rest, cantidad - surtido),
        estado = case when surtido + least(v_rest, cantidad - surtido) >= cantidad then 'surtida' else 'activa' end
      where id = v_res.id;
      v_rest := v_rest - least(v_rest, v_res.cantidad - v_res.surtido);
    end loop;
  end loop;
  update pedido_salidas set movimientos = v_movs, ordenes = v_ordenes, sin_inventario = v_sin where id = p_salida;
end $$;
revoke execute on function public._salida_inventario_entrega(uuid) from public, anon, authenticated;

drop function if exists public.entregar_pedido(uuid, text, text, text);
create or replace function public.entregar_pedido(p_id uuid, p_recibio text default null, p_nota text default null,
                                                  p_evidencia text default null, p_lineas jsonb default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare p pedidos; v_id uuid; l record; o record; v_cant numeric; v_lineas jsonb := '[]'; v_n int := 0; v_completo boolean;
begin
  select * into p from pedidos where id = p_id for update;
  if p.id is null then raise exception 'No existe el pedido'; end if;
  if not puede_entregar(p.vendedor_id) then
    raise exception 'Entregan almacén, el vendedor del pedido, la gerencia de ventas y dirección' using errcode = '42501';
  end if;
  if p.estado in ('entregado', 'cancelado') then raise exception 'El pedido ya está %', p.estado; end if;
  if coalesce(length(trim(p_recibio)), 0) < 3 then raise exception 'Anota quién recibió' using errcode = '23514'; end if;
  if p_evidencia is not null and p_evidencia not like p_id || '/%' then raise exception 'La hoja firmada no es de este pedido'; end if;
  if p_lineas is not null and exists (select 1 from jsonb_array_elements(p_lineas) x
       where nullif(x->>'id', '')::uuid is null or (x->>'id')::uuid not in (select id from pedido_lineas where pedido_id = p_id)) then
    raise exception 'Una de las partidas no es de este pedido';
  end if;

  -- Lo que sale en esta entrega: lo que se dijo de cada partida o, sin decir, todo lo que falta.
  for l in select pl.id, pl.titulo, pl.cantidad - pl.cantidad_entregada pendiente from pedido_lineas pl
           where pl.pedido_id = p_id order by pl.orden, pl.id loop
    if p_lineas is null then
      v_cant := l.pendiente;
    else
      select coalesce(sum((x->>'cantidad')::numeric), 0) into v_cant from jsonb_array_elements(p_lineas) x where (x->>'id')::uuid = l.id;
      if v_cant < 0 then raise exception 'La cantidad de "%" no puede ser negativa', l.titulo; end if;
      if v_cant > l.pendiente + 0.0005 then
        raise exception 'De "%" faltan % por entregar, no %', l.titulo, trim_scale(greatest(l.pendiente, 0)), trim_scale(v_cant);
      end if;
    end if;
    if v_cant > 0 then
      v_lineas := v_lineas || jsonb_build_object('id', l.id, 'cantidad', v_cant);
      v_n := v_n + 1;
    end if;
  end loop;
  if v_n = 0 and (p_lineas is not null or exists (select 1 from pedido_lineas where pedido_id = p_id and cantidad > cantidad_entregada)) then
    raise exception 'Escribe cuánto sale de cada partida' using errcode = '23514';
  end if;

  insert into pedido_salidas (pedido_id, numero, recibio, nota, evidencia_ruta, evidencia_subida_en, entregado_por,
                              estado_anterior, entregado_en_anterior, lineas_anteriores, lineas)
  values (p_id, coalesce((select max(numero) from pedido_salidas where pedido_id = p_id), 0) + 1, trim(p_recibio),
          nullif(trim(p_nota), ''), p_evidencia, case when p_evidencia is not null then now() end, auth.uid(),
          p.estado, p.entregado_en,
          coalesce((select jsonb_agg(jsonb_build_object('id', pl.id, 'cantidad_entregada', pl.cantidad_entregada))
                    from pedido_lineas pl where pl.pedido_id = p_id), '[]'),
          v_lineas)
  returning id into v_id;
  update pedido_lineas pl set cantidad_entregada = pl.cantidad_entregada + x.cantidad
  from jsonb_to_recordset(v_lineas) x(id uuid, cantidad numeric) where pl.id = x.id;
  perform _salida_inventario_entrega(v_id);

  -- Entregado cuando ya no falta nada de lo que se cuenta: los artículos (los servicios no salen
  -- del almacén); si el pedido solo trae partidas de texto (los que vinieron de la hoja), esas.
  v_completo := case
    when exists (select 1 from pedido_lineas pl join articulos a on a.id = pl.articulo_id where pl.pedido_id = p_id and a.tipo <> 'servicio')
      then not exists (select 1 from pedido_lineas pl join articulos a on a.id = pl.articulo_id
                       where pl.pedido_id = p_id and a.tipo <> 'servicio' and pl.cantidad_entregada < pl.cantidad)
    else not exists (select 1 from pedido_lineas pl where pl.pedido_id = p_id and pl.cantidad_entregada < pl.cantidad) end;
  if v_completo then
    update pedido_lineas set cantidad_entregada = cantidad where pedido_id = p_id and cantidad_entregada <> cantidad;
    update pedidos set estado = 'entregado' where id = p_id;
    -- Los equipos que no cuelgan de una partida (los de la hoja) salen con la última entrega.
    for o in select x.id from ordenes_produccion x
             where x.pedido_id = p_id and x.estado = 'terminada'
               and (x.pedido_linea_id is null or not exists (select 1 from pedido_lineas pl where pl.id = x.pedido_linea_id)) loop
      update ordenes_produccion set estado = 'entregada', entregada_en = now() where id = o.id;
      insert into op_eventos (orden_id, tipo, nota) values (o.id, 'entregada', format('Salió con la entrega de %s', p.folio));
      update pedido_salidas set ordenes = ordenes || o.id where id = v_id;
    end loop;
  end if;
  return v_id;
end $$;
revoke execute on function public.entregar_pedido(uuid, text, text, text, jsonb) from public, anon;
grant execute on function public.entregar_pedido(uuid, text, text, text, jsonb) to authenticated;

-- Deshacer la última entrega (ya no solo la de un pedido entregado): regresa sus partidas, el
-- estado, el inventario que salió y los equipos.
create or replace function public.deshacer_entrega(p_pedido uuid, p_motivo text default null)
returns void language plpgsql security definer set search_path = public as $$
declare p pedidos; s pedido_salidas; v_propia boolean; m movimientos_inventario;
begin
  select * into p from pedidos where id = p_pedido for update;
  if p.id is null then raise exception 'No existe el pedido'; end if;
  select * into s from pedido_salidas where pedido_id = p_pedido and anulada_en is null order by numero desc limit 1;
  if s.id is null then
    if p.estado = 'entregado' then
      raise exception 'Esta entrega no tiene hoja de salida (se entregó con un envío o es de antes): la regresa sistemas';
    end if;
    raise exception 'El pedido no tiene entregas que deshacer';
  end if;
  v_propia := s.entregado_por = auth.uid() and s.entregado_en > now() - interval '15 minutes' and puede_entregar(p.vendedor_id);
  if not v_propia then
    if not puede('ventas', 3) then
      raise exception 'Pasados 15 minutos, la reabre la gerencia de ventas o dirección' using errcode = '42501';
    end if;
    if coalesce(length(trim(p_motivo)), 0) < 3 then raise exception 'Anota por qué se reabre la entrega' using errcode = '23514'; end if;
  end if;

  -- Lo que salió del inventario con esta entrega regresa al mismo almacén.
  for m in select * from movimientos_inventario where id = any(s.movimientos) loop
    insert into movimientos_inventario (tipo, articulo_id, almacen_id, cantidad, pedido_id, motivo, costo_unitario)
    values ('devolucion', m.articulo_id, m.almacen_id, -m.cantidad, m.pedido_id,
            format('Se deshizo la entrega %s de %s', s.numero, p.folio), m.costo_unitario);
  end loop;
  update ordenes_produccion set estado = 'terminada', entregada_en = null where id = any(s.ordenes) and estado = 'entregada';
  insert into op_eventos (orden_id, tipo, nota)
  select x, 'nota', format('Se deshizo la entrega %s de %s: el equipo regresa a terminado', s.numero, p.folio) from unnest(s.ordenes) x;

  update pedido_lineas l set cantidad_entregada = (a->>'cantidad_entregada')::numeric
  from jsonb_array_elements(s.lineas_anteriores) a where l.id = (a->>'id')::uuid;
  update pedidos set estado = s.estado_anterior where id = p_pedido;
  -- El disparador pone la fecha al entregar; al regresar se deja la que tenía.
  update pedidos set entregado_en = s.entregado_en_anterior where id = p_pedido;
  update pedido_salidas set anulada_en = now(), anulada_por = auth.uid(),
    motivo_anulacion = coalesce(nullif(trim(p_motivo), ''), 'Se marcó entregado por error')
  where id = s.id;
end $$;

-- La hoja de salida (mismo cuerpo que en 170) más lo entregado de cada partida y lo que salió en
-- cada entrega, para imprimir la hoja de una entrega parcial.
create or replace function public.hoja_salida(p_pedido uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare p pedidos; r jsonb; v_sueltas jsonb; v_solo_texto boolean;
begin
  select * into p from pedidos where id = p_pedido;
  if p.id is null then raise exception 'No existe el pedido'; end if;
  if not (ve_todos_los_pedidos() or ve_pedidos_sin_montos() or puede('inventario', 3) or p.vendedor_id = auth.uid()
          or p_pedido in (select mis_pedidos_visibles())) then
    raise exception 'Sin permiso' using errcode = '42501';
  end if;
  v_sueltas := coalesce((select jsonb_agg(jsonb_build_object('equipo', a.nombre, 'clave', a.clave, 'serie', o.numero_serie, 'folio', o.folio) order by o.folio)
    from ordenes_produccion o join articulos a on a.id = o.articulo_id
    where o.pedido_id = p.id and o.estado <> 'cancelada'
      and (o.pedido_linea_id is null or not exists (select 1 from pedido_lineas l where l.id = o.pedido_linea_id))), '[]');
  v_solo_texto := jsonb_array_length(v_sueltas) > 0
    and not exists (select 1 from pedido_lineas l where l.pedido_id = p.id and l.articulo_id is not null);
  select jsonb_build_object(
    'pedido', jsonb_build_object('id', p.id, 'folio', p.folio, 'folio_anterior', p.folio_anterior, 'fecha', p.fecha,
      'fecha_compromiso', p.fecha_compromiso, 'estado', p.estado, 'direccion_entrega', p.direccion_entrega, 'canal', p.canal),
    'cliente', (select jsonb_build_object('nombre', c.nombre, 'razon_social', c.razon_social, 'rfc', c.rfc, 'ciudad', c.ciudad, 'estado', c.estado)
                from clientes c where c.id = p.cliente_id),
    'vendedor', (select jsonb_build_object('nombre', v.nombre, 'telefono', v.telefono) from perfiles v where v.id = p.vendedor_id),
    'puede_entregar', puede_entregar(p.vendedor_id),
    'puede_reabrir', puede('ventas', 3),
    'partidas', case when v_solo_texto then '[]'::jsonb else coalesce((select jsonb_agg(jsonb_build_object('id', l.id, 'cantidad', l.cantidad, 'unidad', l.unidad,
        'entregado', l.cantidad_entregada, 'titulo', l.titulo, 'descripcion', l.descripcion, 'clave', a.clave,
        'series', (select coalesce(jsonb_agg(o.numero_serie order by o.folio) filter (where o.numero_serie is not null), '[]')
                   from ordenes_produccion o where o.pedido_linea_id = l.id and o.estado <> 'cancelada'))
      order by l.orden) from pedido_lineas l left join articulos a on a.id = l.articulo_id where l.pedido_id = p.id), '[]') end,
    -- Para entregar por partes los pedidos que vinieron de la hoja: sus partidas de texto, con lo que falta.
    'partidas_texto', case when v_solo_texto then coalesce((select jsonb_agg(jsonb_build_object('id', l.id, 'cantidad', l.cantidad,
        'unidad', l.unidad, 'entregado', l.cantidad_entregada, 'titulo', l.titulo) order by l.orden)
      from pedido_lineas l where l.pedido_id = p.id), '[]') end,
    'sueltas', v_sueltas,
    'como_venia', case when v_solo_texto then (select string_agg(nullif(trim(concat_ws(' ', l.titulo, l.descripcion)), ''), ' · ' order by l.orden)
                                                 from pedido_lineas l where l.pedido_id = p.id) end,
    'salidas', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'numero', s.numero, 'recibio', s.recibio, 'nota', s.nota,
        'evidencia_ruta', s.evidencia_ruta, 'entregado_en', s.entregado_en, 'entregado_por', e.nombre,
        'mia', s.entregado_por = auth.uid(), 'anulada_en', s.anulada_en, 'motivo_anulacion', s.motivo_anulacion,
        'sin_inventario', s.sin_inventario,
        'lineas', (select jsonb_agg(jsonb_build_object('id', x.id, 'cantidad', x.cantidad,
                     'series', (select coalesce(jsonb_agg(o.numero_serie order by o.folio) filter (where o.numero_serie is not null), '[]')
                                from ordenes_produccion o where o.id = any(s.ordenes) and o.pedido_linea_id = x.id)))
                   from jsonb_to_recordset(s.lineas) x(id uuid, cantidad numeric)))
        order by s.numero desc)
      from pedido_salidas s left join perfiles e on e.id = s.entregado_por where s.pedido_id = p.id), '[]')
  ) into r;
  return r;
end $$;

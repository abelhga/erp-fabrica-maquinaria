-- Regresa el candado: de una partida de la lista de una orden no se surte más de lo que falta.
--
-- Por qué: en la demostración con Luis, Miguel y Mimí se vio que sin tope la lista de materiales
-- nunca se corrige: si una pieza requiere 2 y salen 3, la tercera queda como «surtido de más» y la
-- lista sigue diciendo 2. Con el candado, cuando hace falta más se le pide el cambio a ingeniería y
-- la lista del equipo se depura sola con el uso. Lo que no está en la lista se sigue sacando como
-- «fuera de la lista» con su motivo, y los consumibles del taller siguen sin tope (salen a nombre de
-- quien los recibe). Lo entregado con la hoja antes del ERP ya tenía este mismo tope.
--
-- Es la función de 194 con solo ese bloque nuevo.

create or replace function public.surtir_material(p_op uuid, p_lineas jsonb, p_recibio text default null, p_previo boolean default false)
returns void language plpgsql security definer set search_path = public as $$
declare l record; o ordenes_produccion; v_req numeric; v_requerido numeric; v_res reservas; v_rest numeric; v_propio numeric; v_libre numeric;
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
    select requerido - surtido, requerido into v_req, v_requerido from op_materiales where orden_id = p_op and articulo_id = l.articulo_id;
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
      -- De una partida de la lista no se surte más de lo que falta. Si hace falta más, la lista está
      -- mal y la corrige ingeniería: así se parece cada vez más a lo que de verdad lleva el equipo.
      -- (Lo que se agregó «fuera de lista», con requerido 0, y los consumibles del taller no tienen tope.)
      if v_req is not null and not v_cons and v_requerido > 0 and l.cantidad > v_req + 0.0005 then
        raise exception 'De "%" solo faltan % por surtir. Si hace falta más, pide el cambio a ingeniería («Solicitar cambio a ingeniería» en la orden)',
          v_nombre, trim_scale(greatest(v_req, 0)) using errcode = '23514';
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

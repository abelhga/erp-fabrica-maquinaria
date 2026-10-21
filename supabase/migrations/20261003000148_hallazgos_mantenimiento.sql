-- =============================================================================
-- "Lo que importa hoy" para mantenimiento y para los supervisores de piso.
--
-- Los avisos de máquinas (paradas, preventivos vencidos, herramienta sin regresar)
-- vivían en hallazgos_servicio y pedían el permiso "servicio". Cuando mantenimiento se
-- volvió módulo aparte (145) no se movieron: la persona de mantenimiento, que no tiene
-- servicio, no veía ni uno; la gerencia de producción sí, porque tiene los dos.
-- Ahora salen de hallazgos_mantenimiento(), con el permiso de mantenimiento y su propia
-- área, y se suman los de fallas sin atender y preventivos de la semana. La gerencia de
-- producción los sigue viendo en su resumen (como antes los de servicio).
-- =============================================================================

create or replace function public.hallazgos_mantenimiento(p_area text)
returns table(area text, tono text, titulo text, detalle text, ruta text, peso integer)
language plpgsql stable set search_path = public as $$
declare
  v_hoy date := hoy_planta();
  h jsonb := '[]'::jsonb;
  k int; v_txt text;
begin
  if not puede('mantenimiento', 1) or coalesce(p_area, 'direccion') not in ('direccion', 'mantenimiento', 'produccion') then
    return;
  end if;

  -- Máquinas paradas.
  select count(*), string_agg(format('%s %s (%s)', z.numero, z.nombre,
                                     case when z.d <= 0 then 'desde hoy' when z.d = 1 then 'desde ayer' else format('hace %s días', z.d) end), '; ')
    into k, v_txt
  from (select mq.numero, mq.nombre, v_hoy - (mq.parada_desde at time zone 'America/Mexico_City')::date d
        from v_maquinas mq where mq.estado in ('fuera_de_servicio', 'en_mantenimiento')
        order by mq.critica desc, mq.parada_desde nulls last) z;
  if k > 0 then
    h := h || jsonb_build_object('tono', 'riesgo',
      'titulo', format('%s %s fuera de servicio', k, case when k = 1 then 'máquina' else 'máquinas' end),
      'detalle', v_txt || '. Cada día parada es trabajo que se atrasa o se hace a mano.',
      'ruta', '/servicio/maquinas', 'peso', 8);
  end if;

  -- Fallas que alguien reportó y nadie ha empezado a atender.
  select count(*) into k from v_ordenes_mantenimiento where tipo = 'correctivo' and estado = 'pendiente';
  if k > 0 then
    select format('La más vieja: %s %s — «%s», reportada %s.', o.numero, o.maquina, left(o.falla, 80),
                  case when v_hoy - (o.reportado_en at time zone 'America/Mexico_City')::date <= 0 then 'hoy'
                       when v_hoy - (o.reportado_en at time zone 'America/Mexico_City')::date = 1 then 'ayer'
                       else format('hace %s días', v_hoy - (o.reportado_en at time zone 'America/Mexico_City')::date) end)
      into v_txt from v_ordenes_mantenimiento o where o.tipo = 'correctivo' and o.estado = 'pendiente'
    order by o.detiene desc, o.reportado_en limit 1;
    h := h || jsonb_build_object('tono', 'atencion',
      'titulo', format('%s %s sin atender', k, case when k = 1 then 'falla reportada' else 'fallas reportadas' end),
      'detalle', v_txt || ' Quien la reportó sigue trabajando con la máquina así.',
      'ruta', '/servicio/maquinas', 'peso', 15);
  end if;

  -- Preventivos vencidos.
  select count(*) into k from v_planes_preventivos where activo and situacion = 'vencido';
  if k > 0 then
    select format('El más atrasado: %s %s — %s (%s).', p.numero, p.maquina, p.nombre,
                  case when p.dias_restantes < 0 then format('venció hace %s días', -p.dias_restantes)
                       else format('pasó sus %s h de uso', p.proximas_horas::float8) end)
      into v_txt from v_planes_preventivos p where p.activo and p.situacion = 'vencido'
    order by coalesce(p.dias_restantes, 0) limit 1;
    h := h || jsonb_build_object('tono', 'atencion',
      'titulo', format('%s %s', k, case when k = 1 then 'preventivo vencido' else 'preventivos vencidos' end),
      'detalle', v_txt || ' Un preventivo a tiempo cuesta menos que la falla y no para al taller.',
      'ruta', '/servicio/maquinas', 'peso', 24);
  end if;

  -- Lo que toca esta semana: para planearlo con el taller antes de que venza.
  select count(*), string_agg(format('%s %s', z.numero, z.maquina), ', ') into k, v_txt
  from (select p.numero, p.maquina from v_planes_preventivos p
        where p.activo and p.situacion = 'por_vencer' order by p.dias_restantes nulls last limit 8) z;
  if k > 0 then
    h := h || jsonb_build_object('tono', 'info',
      'titulo', format('%s %s por vencer', k, case when k = 1 then 'preventivo' else 'preventivos' end),
      'detalle', v_txt || '. Acuérdalo con producción para parar la máquina cuando menos se use.',
      'ruta', '/servicio/maquinas', 'peso', 40);
  end if;

  -- Herramienta sin regresar.
  select count(*), string_agg(format('%s la tiene %s desde hace %s días', z.herramienta, z.quien, z.dias), '; ')
    into k, v_txt
  from (select * from v_resguardos where vencido order by dias desc) z;
  if k > 0 then
    h := h || jsonb_build_object('tono', 'atencion',
      'titulo', format('%s %s sin regresar', k, case when k = 1 then 'herramienta prestada' else 'herramientas prestadas' end),
      'detalle', left(v_txt, 260) || '.',
      'ruta', '/servicio/resguardos', 'peso', 32);
  end if;

  return query
    select 'mantenimiento'::text, e->>'tono', e->>'titulo', e->>'detalle', e->>'ruta', (e->>'peso')::int
    from jsonb_array_elements(h) e;
end $$;

-- Servicio a clientes se queda con lo suyo: servicios que chocan con la carga del
-- taller y servicios pedidos sin fecha.
create or replace function public.hallazgos_servicio(p_area text)
returns table(area text, tono text, titulo text, detalle text, ruta text, peso integer)
language plpgsql stable set search_path = public as $$
declare
  v_hoy date := hoy_planta();
  h jsonb := '[]'::jsonb;
  k int; v_txt text; r record;
begin
  if not puede('servicio', 1) or coalesce(p_area, 'direccion') not in ('direccion', 'servicio', 'produccion') then
    return;
  end if;

  -- Servicios que chocan con la carga del taller (esta semana y la que sigue).
  for r in select c.semana, c.etapa, c.capacidad, c.horas_servicio, c.horas_produccion, c.carga - c.capacidad faltan, c.servicios
           from carga_semanal(2) c where c.horas_servicio > 0 and c.carga > c.capacidad
           order by c.semana, c.carga - c.capacidad desc limit 4 loop
    v_txt := (select string_agg(s->>'folio', ', ') from jsonb_array_elements(r.servicios) s);
    h := h || jsonb_build_object(
      'tono', case when r.semana <= v_hoy then 'riesgo' else 'atencion' end,
      -- Si la producción sola ya no cabía, el servicio no es "la causa": se dice distinto.
      'titulo', case when r.horas_produccion <= r.capacidad
        then format('%s %s no alcanza por los servicios: le faltan %s h', case when r.semana <= v_hoy then 'Esta semana' else 'La próxima semana' end,
                    r.etapa, round(r.faltan))
        else format('%s %s ya va pasada y los servicios le quitan %s h más', case when r.semana <= v_hoy then 'Esta semana' else 'La próxima semana' end,
                    r.etapa, round(r.horas_servicio)) end,
      'detalle', format('%s se %s %s h de %s; la producción liberada pide %s h de %s h de capacidad. Mover el servicio, reforzar con horas extra o recorrer una entrega.',
                        v_txt, case when jsonb_array_length(r.servicios) = 1 then 'lleva' else 'llevan' end,
                        round(r.horas_servicio), r.etapa, round(r.horas_produccion), round(r.capacidad)),
      'ruta', '/servicio', 'peso', 9);
  end loop;

  -- Servicios pedidos que nadie ha programado (con la RLS: a un vendedor, los suyos).
  select count(*) into k from servicios s where s.estado = 'solicitada' and s.solicitado_en < now() - interval '2 days';
  if k > 0 then
    select format('El más viejo: %s de %s, pedido hace %s días.', s.folio, c.nombre,
                  v_hoy - (s.solicitado_en at time zone 'America/Mexico_City')::date)
      into v_txt from servicios s join clientes c on c.id = s.cliente_id
    where s.estado = 'solicitada' order by s.solicitado_en limit 1;
    h := h || jsonb_build_object('tono', 'atencion',
      'titulo', format('%s %s sin fecha', k, case when k = 1 then 'servicio pedido' else 'servicios pedidos' end),
      'detalle', v_txt || ' Sin fecha, el cliente le vuelve a llamar al vendedor.',
      'ruta', '/servicio', 'peso', 28);
  end if;

  return query
    select 'servicio'::text, e->>'tono', e->>'titulo', e->>'detalle', e->>'ruta', (e->>'peso')::int
    from jsonb_array_elements(h) e;
end $$;

-- La gerencia de producción también responde por las máquinas: su resumen las incluye.
create or replace function public.hallazgos(p_area text default 'direccion')
returns table(area text, tono text, titulo text, detalle text, ruta text)
language plpgsql stable as $$
declare v_sql text;
begin
  select string_agg(format('select * from public.%I($1)', p.proname), ' union all ')
  into v_sql
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname like 'hallazgos\_%'
    and pg_get_function_identity_arguments(p.oid) = 'p_area text';
  return query execute format(
    'select h.area, h.tono, h.titulo, h.detalle, h.ruta from (%s) h
     where $1 = ''direccion'' or h.area = $1
           or ($1 = ''almacen'' and h.area = ''compras'' and puede(''inventario'', 2))
           -- La gerencia de producción también responde por máquinas y servicios en campo;
           -- compras, por lo que viene de importación.
           or ($1 = ''produccion'' and h.area in (''servicio'', ''mantenimiento''))
           or ($1 = ''compras'' and h.area = ''importaciones'')
     order by case h.tono when ''riesgo'' then 1 when ''atencion'' then 2 when ''bueno'' then 3 else 4 end, h.peso', v_sql)
  using p_area;
end $$;

-- "1 orden atrasadas en el taller": el plural no seguía al número.
CREATE OR REPLACE FUNCTION public.hallazgos_nucleo(p_area text DEFAULT 'direccion'::text)
 RETURNS TABLE(area text, tono text, titulo text, detalle text, ruta text, peso integer)
 LANGUAGE plpgsql
 STABLE
AS $function$
declare
  t jsonb := tablero_direccion();
  v_hoy date := (now() at time zone 'America/Mexico_City')::date;
  h jsonb := '[]'::jsonb;
  x jsonb; n numeric; m numeric; k int; v_txt text;
begin
  -- Ventas del año contra el año pasado a la misma fecha.
  if t ? 'ventas' then
    n := (t #>> '{ventas,anio}')::numeric; m := (t #>> '{ventas,anio_anterior_misma_fecha}')::numeric;
    if m > 0 then
      h := h || jsonb_build_object('area', 'ventas',
        'tono', case when n / m - 1 >= 0.05 then 'bueno' when n / m - 1 <= -0.05 then 'riesgo' else 'info' end,
        'titulo', format('Ventas del año: %s, %s %% %s del año pasado', texto_dinero(n),
                         abs(round((n / m - 1) * 100)), case when n >= m then 'arriba' else 'abajo' end),
        'detalle', format('A la misma fecha de %s iban %s. A este ritmo el año cierra en %s; %s cerró en %s.',
                          extract(year from v_hoy) - 1, texto_dinero(m), texto_dinero((t #>> '{ventas,proyeccion_anio}')::numeric),
                          extract(year from v_hoy) - 1, texto_dinero((t #>> '{ventas,anio_anterior_total}')::numeric)),
        'ruta', '/', 'peso', 50);
    end if;
    -- Dependencia de pocos clientes.
    x := t #> '{ventas,top_clientes,0}';
    if x is not null and n > 0 and (x->>'monto')::numeric / n >= 0.12 then
      h := h || jsonb_build_object('area', 'ventas', 'tono', 'info',
        'titulo', format('%s es el %s %% de lo vendido en el año', x->>'nombre', round((x->>'monto')::numeric / n * 100)),
        'detalle', 'Mucho peso en un solo cliente: si se va, se nota. Vale la pena cuidarlo y abrir otros parecidos.',
        'ruta', '/ventas/clientes', 'peso', 80);
    end if;
  end if;

  if t ? 'cotizaciones' then
    k := (t #>> '{cotizaciones,por_autorizar}')::int;
    if k > 0 then
      h := h || jsonb_build_object('area', 'ventas', 'tono', 'atencion',
        'titulo', case when k = 1 then 'Una cotización espera autorización' else k || ' cotizaciones esperan autorización' end,
        'detalle', 'Un cliente esperando precio es un cliente que sigue cotizando con otros.',
        'ruta', '/ventas/cotizaciones', 'peso', 20);
    end if;
  end if;

  -- Lo que cada vendedor ve de lo suyo (la RLS ya filtra). Solo para ventas:
  -- producción ve clientes, pero no tiene por qué ver a quién hay que llamar.
  if puede('ventas', 1) and p_area in ('direccion', 'ventas') then
    select count(*), sum(c.total * c.tipo_cambio) into k, n from cotizaciones c
    where c.estado in ('enviada', 'autorizada') and c.fecha + c.vigencia_dias between v_hoy and v_hoy + 7;
    if k > 0 then
      h := h || jsonb_build_object('area', 'ventas', 'tono', 'atencion',
        'titulo', format('%s por %s %s esta semana', case when k = 1 then 'Una cotización' else k || ' cotizaciones' end,
                         texto_dinero(n), case when k = 1 then 'vence' else 'vencen' end),
        'detalle', 'Una llamada antes de que venzan cierra más que una cotización nueva.',
        'ruta', '/ventas/cotizaciones', 'peso', 15);
    end if;

    select count(*) over (), sum(o.valor_estimado) over (), format('La de más valor: %s. %s', o.cliente, o.detalle)
    into k, n, v_txt from oportunidades_sugeridas(1000) o order by o.puntaje desc limit 1;
    if k > 0 then
      h := h || jsonb_build_object('area', 'ventas', 'tono', 'info',
        'titulo', format('%s clientes con motivo para buscarlos (%s en juego)', k, texto_dinero(n)),
        'detalle', v_txt,
        'ruta', '/ventas/oportunidades', 'peso', 30);
    end if;
  end if;

  if t ? 'produccion' then
    k := (t #>> '{produccion,atrasadas}')::int;
    if k > 0 then
      h := h || jsonb_build_object('area', 'produccion', 'tono', 'riesgo',
        'titulo', format('%s en el taller', case when k = 1 then '1 orden atrasada' else k || ' órdenes atrasadas' end),
        'detalle', format('De %s abiertas. Entregadas a tiempo en los últimos 90 días: %s.',
                          t #>> '{produccion,abiertas}', coalesce(round((t #>> '{produccion,a_tiempo_90d}')::numeric * 100) || ' %', 'sin datos')),
        'ruta', '/produccion/gerencia', 'peso', 10);
    end if;
    k := (t #>> '{produccion,con_faltantes}')::int;
    if k > 0 then
      h := h || jsonb_build_object('area', 'produccion', 'tono', 'atencion',
        'titulo', format('%s %s sin todo el material', k, case when k = 1 then 'orden' else 'órdenes' end),
        'detalle', 'Hay que comprarlo o surtirlo antes de que paren al soldador.',
        'ruta', '/produccion/ordenes', 'peso', 25);
    end if;
    x := null;
    select e.value into x from jsonb_array_elements(t #> '{produccion,carga}') e
    order by (e.value->>'semanas')::numeric desc nulls last limit 1;
    if (x->>'semanas')::numeric >= 3 then
      h := h || jsonb_build_object('area', 'produccion', 'tono', 'atencion',
        'titulo', format('%s tiene %s semanas de trabajo encima', x->>'etapa', x->>'semanas'),
        'detalle', 'Es el cuello de botella: ahí se decide la fecha de entrega que se le promete al cliente.',
        'ruta', '/produccion/gerencia', 'peso', 35);
    end if;
  end if;

  -- Almacén no ve costos, así que el tablero no le trae la sección de inventario:
  -- lo que no lleva dinero se calcula aquí con el mismo reabasto().
  if not t ? 'inventario' and puede('inventario', 1) then
    t := t || jsonb_build_object('inventario', (
      with re as (select * from reabasto())
      select jsonb_build_object(
        'a_ordenar_n', (select count(*) from re where estado = 'ordenar'),
        'importados_en_riesgo', (select coalesce(jsonb_agg(jsonb_build_object('nombre', nombre, 'disponible', disponible, 'reorden', punto_reorden)
                                   order by disponible - punto_reorden), '[]')
                                 from re where es_importado and estado = 'ordenar'),
        'ajustes_pendientes', (select count(*) from ajustes_inventario where estado = 'pendiente'))));
  end if;

  if t ? 'inventario' then
    k := coalesce((t #>> '{inventario,importados_en_riesgo_n}')::int, jsonb_array_length(t #> '{inventario,importados_en_riesgo}'));
    if k > 0 then
      x := t #> '{inventario,importados_en_riesgo,0}';
      h := h || jsonb_build_object('area', 'almacen', 'tono', 'riesgo',
        'titulo', format('%s %s abajo del punto de reorden', k, case when k = 1 then 'importado' else 'importados' end),
        'detalle', format('El más justo: %s (quedan %s, se pide en %s). Un importado tarda meses: si se acaba no hay cómo reponerlo rápido.',
                          x->>'nombre', round((x->>'disponible')::numeric), round((x->>'reorden')::numeric)),
        'ruta', '/almacen/reabasto', 'peso', 12);
    end if;
    k := (t #>> '{inventario,a_ordenar_n}')::int;
    if k > 0 then
      h := h || jsonb_build_object('area', 'compras', 'tono', 'atencion',
        'titulo', format('%s artículos por pedir', k),
        'detalle', case when t #> '{inventario,inversion_sugerida}' is not null
                        then format('Inversión sugerida: %s, según el consumo de los últimos 6 meses.', texto_dinero((t #>> '{inventario,inversion_sugerida}')::numeric))
                        else 'Están abajo de su punto de reorden según el consumo de los últimos 6 meses.' end,
        'ruta', '/almacen/reabasto', 'peso', 40);
    end if;
    n := (t #>> '{inventario,excedentes_valor}')::numeric;
    if n >= 100000 then
      h := h || jsonb_build_object('area', 'almacen', 'tono', 'atencion',
        'titulo', format('%s parados en excedentes', texto_dinero(n)),
        'detalle', format('%s artículos con más de lo que se consume en su cobertura. Es dinero que no trabaja: no volver a pedirlos y ofrecerlos.',
                          t #>> '{inventario,excedentes_n}'),
        'ruta', '/almacen/reabasto', 'peso', 60);
    end if;
    k := (t #>> '{inventario,ajustes_pendientes}')::int;
    if k > 0 then
      h := h || jsonb_build_object('area', 'almacen', 'tono', 'atencion',
        'titulo', format('%s %s de inventario por autorizar', k, case when k = 1 then 'ajuste' else 'ajustes' end),
        'detalle', 'Mientras no se autoricen, las existencias del sistema no cuadran con el almacén.',
        'ruta', '/almacen/movimientos', 'peso', 22);
    end if;
  end if;

  if t ? 'costos_al_alza' and jsonb_array_length(t -> 'costos_al_alza') > 0 then
    x := t #> '{costos_al_alza,0}';
    h := h || jsonb_build_object('area', 'compras', 'tono', 'atencion',
      'titulo', format('%s subió %s %% este mes', x->>'nombre', round((x->>'cambio')::numeric * 100)),
      'detalle', format('De %s a %s. %s Revisar si conviene otro proveedor.',
                        texto_dinero((x->>'costo_anterior')::numeric), texto_dinero((x->>'costo_nuevo')::numeric),
                        case when (x->>'equipos')::int = 0 then 'No entra en ningún equipo: pega en su precio de venta suelto.'
                             else format('Entra en %s equipos, cuyos precios ya se recalcularon.', x->>'equipos') end),
      'ruta', '/costeo/componentes', 'peso', 45);
  end if;

  if t ? 'cobranza' then
    n := (t #>> '{cobranza,antiguedad,d90}')::numeric;
    if n > 0 then
      h := h || jsonb_build_object('area', 'finanzas', 'tono', 'riesgo',
        'titulo', format('%s con más de 90 días sin cobrar', texto_dinero(n)),
        'detalle', 'Entre más tiempo pasa, menos probable es cobrarlo. Antes de venderle más a esos clientes, que liquiden.',
        'ruta', '/finanzas/cobranza', 'peso', 11);
    end if;
    n := (t #>> '{cobranza,arranque}')::numeric;
    if n > 0 then
      h := h || jsonb_build_object('area', 'finanzas', 'tono', 'info',
        'titulo', format('%s por cobrar que viene de la hoja', texto_dinero(n)),
        'detalle', 'Saldos de clientes de antes del arranque del sistema. Conviene conciliarlos uno por uno.',
        'ruta', '/finanzas/cobranza', 'peso', 70);
    end if;
  end if;
  if t ? 'por_pagar' then
    n := (t #>> '{por_pagar,vencido}')::numeric;
    if n > 0 then
      h := h || jsonb_build_object('area', 'finanzas', 'tono', 'atencion',
        'titulo', format('%s vencidos con proveedores', texto_dinero(n)),
        'detalle', 'Pagar tarde cuesta precio y prioridad con el proveedor.',
        'ruta', '/finanzas/pagos', 'peso', 30);
    end if;
  end if;

  return query
    select e->>'area', e->>'tono', e->>'titulo', e->>'detalle', e->>'ruta', (e->>'peso')::int
    from jsonb_array_elements(h) e;
end $function$;

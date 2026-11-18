-- =============================================================================
-- Avisos de órdenes de producción: un resumen al día de lo que falta validar, y la orden nueva
-- también le llega al vendedor y a la gerencia de producción.
--
-- Por qué: «OP-… lleva más de 4 h sin revisión» llegaba una vez al día por orden y por persona; con
-- varias órdenes sin validar fueron 563 avisos en 30 días (la OP-55 sola, decenas a cada uno), y entre
-- tantos se perdió el aviso del PED-26-842 que Noemí sí necesitaba. Al revés, cuando se crea una orden,
-- el vendedor del pedido no se enteraba de que su equipo entró a producción, ni la gerencia de que hay
-- una orden nueva (las de stock las crea dirección).
--
-- Qué cambia:
--   * avisos_periodicos: en lugar de un aviso por orden, uno al día por persona: «N órdenes llevan más
--     de 4 h sin tu revisión» con sus folios. A ingeniería solo le cuenta lo que le toca firmar (su
--     especialidad, 286); a almacén, lo que falta revisar en piso.
--   * Al crear una orden: además de ingeniería y almacén («por validar»), al vendedor del pedido
--     («Tu equipo entró a producción») y a la gerencia de producción («Orden nueva»).
--   * Los recordatorios por orden que siguen sin leer se dan por leídos: los sustituye el resumen.
-- =============================================================================

create or replace function public.avisos_periodicos()
returns integer language plpgsql security definer set search_path = public as $$
declare v_n int := 0; r record; u record;
begin
  -- Ingeniería: las órdenes planeadas de hace más de 4 h con una firma suya pendiente.
  for u in select x.u from (select usuarios_con_rol('ingenieria') u) x loop
    select count(*) c, string_agg(o.folio || ' (' || to_char(o.creado_en at time zone 'America/Mexico_City', 'DD/MM') || ')', ', ' order by o.creado_en) f into r
    from ordenes_produccion o
    where o.estado = 'planeada' and o.creado_en < now() - interval '4 hours' and o.revisado_ingenieria_en is null
      and exists (select 1 from jsonb_array_elements(_especialidades_ingenieria()) e
                  where (jsonb_array_length(e->'personas') = 0 or (e->'personas') ? u.u::text)
                    and not exists (select 1 from op_firmas_ingenieria f where f.orden_id = o.id and f.especialidad = e->>'clave'));
    if r.c > 0 then
      v_n := v_n + avisar(array[u.u], 'op_validacion_atorada',
        case when r.c = 1 then '1 orden lleva más de 4 h sin tu revisión' else format('%s órdenes llevan más de 4 h sin tu revisión', r.c) end,
        left(r.f, 300), '/produccion/ordenes', 'ordenes_produccion', 'resumen-ingenieria', true);
    end if;
  end loop;
  -- Almacén: las que faltan de revisar en piso.
  select count(*) c, string_agg(o.folio || ' (' || to_char(o.creado_en at time zone 'America/Mexico_City', 'DD/MM') || ')', ', ' order by o.creado_en) f into r
  from ordenes_produccion o
  where o.estado = 'planeada' and o.creado_en < now() - interval '4 hours' and o.revisado_almacen_en is null;
  if r.c > 0 then
    v_n := v_n + avisar(array(select usuarios_con_rol('almacen')), 'op_validacion_atorada',
      case when r.c = 1 then '1 orden lleva más de 4 h sin revisión de almacén' else format('%s órdenes llevan más de 4 h sin revisión de almacén', r.c) end,
      left(r.f, 300), '/produccion/ordenes', 'ordenes_produccion', 'resumen-almacen', true);
  end if;
  for r in select * from pendientes where estado = 'abierto' and vence < (now() at time zone 'America/Mexico_City')::date loop
    v_n := v_n + avisar(array[r.responsable_id, r.creado_por], 'pendiente_vencido', 'Vencido: ' || r.titulo,
      format('Era para el %s', to_char(r.vence, 'DD/MM')), coalesce(r.ruta, '/pendientes'), 'pendientes', r.id::text, true);
  end loop;
  return v_n;
end $$;

create or replace function public.aviso_orden_produccion()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_equipo text; v_cliente text; v_vendedor uuid; v_pedido text;
begin
  select a.nombre into v_equipo from articulos a where a.id = new.articulo_id;
  select c.nombre, p.vendedor_id, p.folio into v_cliente, v_vendedor, v_pedido
  from pedidos p left join clientes c on c.id = p.cliente_id where p.id = new.pedido_id;
  if tg_op = 'INSERT' then
    perform avisar(array(select usuarios_con_rol('ingenieria') union select usuarios_con_rol('almacen')),
      'op_por_validar', format('Orden %s por validar', new.folio),
      format('%s%s', v_equipo, coalesce(' · ' || v_cliente, ' · para stock')),
      '/produccion/ordenes/' || new.id, 'ordenes_produccion', new.id::text);
    -- La gerencia de producción se entera de toda orden nueva (las de stock las crea dirección).
    perform avisar(array(select usuarios_con_rol('gerente_produccion')), 'op_nueva',
      format('Orden nueva %s: %s', new.folio, v_equipo),
      coalesce('Pedido ' || v_pedido || ' · ' || v_cliente, 'Para stock'),
      '/produccion/ordenes/' || new.id, 'ordenes_produccion', new.id::text);
    -- El vendedor sabe que su equipo ya entró a producción.
    if v_vendedor is not null then
      perform avisar(array[v_vendedor], 'op_en_produccion',
        format('Tu equipo entró a producción: %s', v_equipo),
        format('%s · %s · pedido %s', new.folio, coalesce(v_cliente, ''), v_pedido),
        '/produccion/ordenes/' || new.id, 'ordenes_produccion', new.id::text);
    end if;
  elsif new.estado is distinct from old.estado and new.estado in ('terminada', 'entregada') then
    perform avisar(array[v_vendedor], 'op_' || new.estado::text,
      format('%s: %s', case new.estado when 'terminada' then 'Terminado' else 'Entregado' end, v_equipo),
      format('%s%s%s', new.folio, coalesce(' · ' || v_cliente, ''), coalesce(' · pedido ' || v_pedido, '')),
      '/produccion/ordenes/' || new.id, 'ordenes_produccion', new.id::text);
    if new.estado = 'terminada' then
      perform publicar_en_canal('pedidos', format('✅ Terminado %s (%s)%s.', v_equipo, new.folio, coalesce(' para ' || v_cliente, '')));
    end if;
  end if;
  return new;
end $$;

-- Los recordatorios por orden que nadie leyó: los sustituye el resumen diario.
update public.avisos set leido_en = now()
where tipo = 'op_validacion_atorada' and leido_en is null and registro_id not like 'resumen-%';

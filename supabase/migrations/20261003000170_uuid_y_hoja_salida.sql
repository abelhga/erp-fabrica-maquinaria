-- =============================================================================
-- Dos cosas que vio Susana el 23 oct.
--
-- 1. «El ERP no me acepta el UUID»: el folio fiscal se veía bien (36 caracteres, 8-4-4-4-12) y
--    la base lo rechazaba. Al copiarlo del PDF de la factura se cuelan caracteres que no se ven
--    (espacio de ancho cero, espacio duro) o guiones tipográficos (‐ – —) en lugar del guion;
--    trim() solo quita espacios normales. Ahora se limpian: se dejan letras, números y guiones,
--    los guiones raros se vuelven guion, y 32 caracteres sin guiones se acomodan en 8-4-4-4-12.
--    Lo que sigue sin servir (una letra O por un cero) se dice con nombre y apellido.
--
-- 2. «Se duplica el producto» en la hoja de salida del PED-26-784: los pedidos que vinieron de
--    la hoja traen la partida como texto («1 cribadora ZAR 4 PEDIDO 784») y el equipo como orden
--    sin ligar a esa partida; la hoja imprimía las dos. Cuando todas las partidas son texto (sin
--    artículo) y hay equipos sueltos, lo que sale de la planta son esos equipos: van como
--    renglones (con su serie) y el texto del pedido queda de referencia, sin contarse como pieza.
-- =============================================================================

create or replace function public.validar_factura() returns trigger
language plpgsql set search_path = public as $$
declare v text; v_raras text;
begin
  new.folio := trim(new.folio);
  -- Guiones tipográficos → guion; fuera todo lo que no sea letra, número o guion (espacios,
  -- caracteres invisibles que trae el PDF, saltos de línea).
  v := upper(regexp_replace(translate(coalesce(new.uuid_sat, ''), '‐‑‒–—―−', '-------'), '[^0-9A-Za-z-]', '', 'g'));
  -- Sin guiones (32 caracteres) también se entiende.
  if v ~ '^[0-9A-F]{32}$' then
    v := substr(v, 1, 8) || '-' || substr(v, 9, 4) || '-' || substr(v, 13, 4) || '-' || substr(v, 17, 4) || '-' || substr(v, 21, 12);
  end if;
  new.uuid_sat := nullif(v, '');
  if new.folio = '' then raise exception 'La factura necesita folio'; end if;
  if new.uuid_sat is not null and new.uuid_sat !~ '^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$' then
    v_raras := (select string_agg(distinct c, ', ') from regexp_split_to_table(regexp_replace(new.uuid_sat, '[0-9A-F-]', '', 'g'), '') c where c <> '');
    if v_raras is not null then
      raise exception 'El UUID del SAT solo lleva números y letras de la A a la F, y este trae %: revisa que no sea un cero escrito como letra O', v_raras;
    end if;
    raise exception 'El UUID del SAT son 36 caracteres en grupos 8-4-4-4-12 y este trae %: cópialo completo del XML o del PDF', length(new.uuid_sat);
  end if;
  if new.total <= 0 then raise exception 'El total de la factura debe ser mayor a cero'; end if;
  return new;
end $$;

-- Lo que va en la hoja de salida (mismo cuerpo que en 159), sin repetir el equipo de los pedidos
-- que vinieron de la hoja.
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
  -- Equipos del pedido que no cuelgan de una partida (los pedidos que vinieron de la hoja).
  v_sueltas := coalesce((select jsonb_agg(jsonb_build_object('equipo', a.nombre, 'clave', a.clave, 'serie', o.numero_serie, 'folio', o.folio) order by o.folio)
    from ordenes_produccion o join articulos a on a.id = o.articulo_id
    where o.pedido_id = p.id and o.estado <> 'cancelada'
      and (o.pedido_linea_id is null or not exists (select 1 from pedido_lineas l where l.id = o.pedido_linea_id))), '[]');
  -- Todas las partidas son texto (sin artículo) y hay equipos sueltos: la partida describe esos
  -- mismos equipos. Salen los equipos; el texto, como referencia.
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
        'titulo', l.titulo, 'descripcion', l.descripcion, 'clave', a.clave,
        'series', (select coalesce(jsonb_agg(o.numero_serie order by o.folio) filter (where o.numero_serie is not null), '[]')
                   from ordenes_produccion o where o.pedido_linea_id = l.id and o.estado <> 'cancelada'))
      order by l.orden) from pedido_lineas l left join articulos a on a.id = l.articulo_id where l.pedido_id = p.id), '[]') end,
    'sueltas', v_sueltas,
    'como_venia', case when v_solo_texto then (select string_agg(nullif(trim(concat_ws(' ', l.titulo, l.descripcion)), ''), ' · ' order by l.orden)
                                                 from pedido_lineas l where l.pedido_id = p.id) end,
    'salidas', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'numero', s.numero, 'recibio', s.recibio, 'nota', s.nota,
        'evidencia_ruta', s.evidencia_ruta, 'entregado_en', s.entregado_en, 'entregado_por', e.nombre,
        'mia', s.entregado_por = auth.uid(), 'anulada_en', s.anulada_en, 'motivo_anulacion', s.motivo_anulacion) order by s.numero desc)
      from pedido_salidas s left join perfiles e on e.id = s.entregado_por where s.pedido_id = p.id), '[]')
  ) into r;
  return r;
end $$;
revoke execute on function public.hoja_salida(uuid) from public, anon;
grant execute on function public.hoja_salida(uuid) to authenticated;

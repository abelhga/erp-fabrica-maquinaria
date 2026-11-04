-- =============================================================================
-- Bitácora: los cambios a listas de materiales y al material de una orden dicen de qué son.
--
-- Por qué: Miguel corrige listas de materiales y el material de las órdenes, y en la bitácora salía
-- «Redondear arriba: Sí → No» sin decir de qué equipo, qué artículo ni cuánto; los artículos y las
-- órdenes dentro del cambio salían como un código cortado («3f2a91c0…»). Ahora:
--   * la etiqueta de cada renglón dice el equipo o la OP, el artículo y la cantidad (también en las
--     bajas, con lo que tenía el renglón al borrarse);
--   * «nombres» trae el nombre de cada id que aparece en el cambio (artículos, órdenes, personas,
--     clientes, proveedores, pedidos), para que la pantalla los muestre legibles.
-- =============================================================================

-- El valor de una columna en el cambio: el de después y, si se borró, el de antes.
create or replace function public.bitacora_valor(p_cambios jsonb, p_col text) returns text
language sql immutable as $$
  select case jsonb_typeof(p_cambios -> p_col)
    when 'array' then coalesce(p_cambios -> p_col ->> 1, p_cambios -> p_col ->> 0)
    else p_cambios ->> p_col end
$$;

create or replace function public.etiqueta_registro(p_tabla text, p_id text, p_cambios jsonb)
returns text language plpgsql stable set search_path = public as $$
declare v_uuid uuid; v_padre uuid; v_hijo uuid; v_art uuid; v_op uuid; v_cant text; v_etapa int; r text; v_alta jsonb;
begin
  if split_part(p_id, ':', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then v_uuid := split_part(p_id, ':', 1)::uuid; end if;
  -- Un renglón que ya se borró y cuyo cambio no trae sus ids (solo «redondear arriba»): se toman de su alta o su baja.
  if p_tabla in ('bom_lineas', 'op_materiales', 'bom_operaciones') and not (p_cambios ? 'articulo_id' or p_cambios ? 'hijo_id') then
    select b.cambios into v_alta from bitacora b where b.tabla = p_tabla and b.registro_id = p_id and b.accion in ('alta', 'baja') order by b.en limit 1;
    p_cambios := coalesce(v_alta, '{}'::jsonb) || coalesce(p_cambios, '{}'::jsonb);
  end if;
  if p_tabla = 'bom_lineas' then
    select padre_id, hijo_id, trim_scale(cantidad)::text into v_padre, v_hijo, v_cant from bom_lineas where id = v_uuid;
    v_padre := coalesce(v_padre, bitacora_valor(p_cambios, 'padre_id')::uuid);
    v_hijo := coalesce(v_hijo, bitacora_valor(p_cambios, 'hijo_id')::uuid);
    v_cant := coalesce(v_cant, bitacora_valor(p_cambios, 'cantidad'));
    select coalesce((select nombre from articulos where id = v_padre), 'Equipo borrado') || ' › ' || a.clave || ' ' || a.nombre || coalesce(' × ' || v_cant || ' ' || a.unidad, '')
      into r from articulos a where a.id = v_hijo;
    return r;
  elsif p_tabla = 'op_materiales' then
    select orden_id, articulo_id, trim_scale(requerido)::text into v_op, v_art, v_cant from op_materiales where id = v_uuid;
    v_op := coalesce(v_op, bitacora_valor(p_cambios, 'orden_id')::uuid);
    v_art := coalesce(v_art, bitacora_valor(p_cambios, 'articulo_id')::uuid);
    v_cant := coalesce(v_cant, bitacora_valor(p_cambios, 'requerido'));
    select coalesce((select folio from ordenes_produccion where id = v_op), 'Orden borrada') || ' · ' || a.clave || ' ' || a.nombre || coalesce(' (' || v_cant || ' ' || a.unidad || ')', '')
      into r from articulos a where a.id = v_art;
    return r;
  elsif p_tabla = 'bom_operaciones' then
    select articulo_id, etapa_id, trim_scale(horas)::text into v_art, v_etapa, v_cant from bom_operaciones where id = v_uuid;
    v_art := coalesce(v_art, bitacora_valor(p_cambios, 'articulo_id')::uuid);
    v_etapa := coalesce(v_etapa, bitacora_valor(p_cambios, 'etapa_id')::int);
    v_cant := coalesce(v_cant, bitacora_valor(p_cambios, 'horas'));
    select a.nombre || ' · ' || coalesce((select nombre from etapas where id = v_etapa), 'etapa') || coalesce(': ' || v_cant || ' h', '')
      into r from articulos a where a.id = v_art;
    return r;
  end if;
  return etiqueta_registro(p_tabla, p_id);
end $$;

-- Nombre de cada id que aparece en un cambio (antes o después).
create or replace function public.bitacora_nombres(p_cambios jsonb) returns jsonb
language sql stable set search_path = public as $$
  with ids as (
    select distinct v::uuid id
    from jsonb_each(coalesce(p_cambios, '{}'::jsonb)) c,
         lateral (select x from jsonb_array_elements_text(case jsonb_typeof(c.value) when 'array' then c.value else jsonb_build_array(c.value) end) x) e(v)
    where c.key <> 'id' and v ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  )
  select coalesce(jsonb_object_agg(ids.id, n.nombre), '{}'::jsonb)
  from ids cross join lateral (
    select coalesce(
      (select clave || ' · ' || nombre from articulos where id = ids.id),
      (select folio from ordenes_produccion where id = ids.id),
      (select o.folio || ' · ' || a.nombre from op_materiales m join ordenes_produccion o on o.id = m.orden_id join articulos a on a.id = m.articulo_id where m.id = ids.id),
      (select nombre from perfiles where id = ids.id),
      (select nombre from clientes where id = ids.id),
      (select nombre from proveedores where id = ids.id),
      (select folio from pedidos where id = ids.id),
      (select folio from cotizaciones where id = ids.id)) nombre
  ) n
  where n.nombre is not null
$$;

create or replace view public.v_bitacora with (security_invoker = true) as
select b.id, b.tabla, b.registro_id, b.accion, b.cambios, b.usuario_id, b.en,
  p.nombre as usuario, p.correo as usuario_correo, etiqueta_registro(b.tabla, b.registro_id, b.cambios) as etiqueta,
  bitacora_nombres(b.cambios) as nombres
from public.bitacora b left join public.perfiles p on p.id = b.usuario_id;

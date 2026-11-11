-- =============================================================================
-- El buscador encuentra a un cliente por sus contactos, y también encuentra leads.
--
-- Por qué: Abel buscó a una persona (el contacto de un cliente) en el buscador de arriba y no salió:
-- solo buscaba por el nombre del cliente, su razón social y su RFC. Lo mismo al elegir cliente en
-- una cotización o un pedido. Y un lead (alguien que llamó y todavía no es cliente) no salía en
-- ningún buscador fuera de la pantalla de Leads.
--
-- Qué cambia:
--   * buscar_global: el cliente sale también por el nombre, el correo o el teléfono (sus dígitos,
--     desde 7) de cualquiera de sus contactos, y dice «Contacto: …». Hay un grupo nuevo, Leads, por
--     nombre, empresa, correo o teléfono, los abiertos primero. Cada quien ve solo lo que ya podía
--     ver (las dos funciones respetan los permisos de quien busca).
--   * buscar_clientes (elegir cliente): también por contacto.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.buscar_global(q text)
 RETURNS TABLE(tipo text, id text, titulo text, subtitulo text, ruta text)
 LANGUAGE sql
 STABLE
AS $function$
  with t as (select sin_acentos(trim(q)) t)
  -- Ingeniería abre la ficha de costeo; quien vende (sin costeo), la del catálogo con su
  -- precio, y solo lo que se vende; los demás no reciben artículos.
  (select case a.tipo when 'equipo' then 'equipo' when 'subensamble' then 'subensamble' else 'componente' end,
          a.id::text, a.nombre, a.clave,
          case when (select puede('costeo', 1))
               then case when a.tipo in ('equipo', 'subensamble') then '/costeo/equipos/' else '/costeo/componentes/' end || a.id
               else '/catalogo?articulo=' || a.id end
   from articulos a, t where a.activo and sin_acentos(a.clave || ' ' || a.nombre) like '%' || replace(t.t, ' ', '%') || '%'
     and ((select puede('costeo', 1))
          or ((select ve_precios_venta()) and a.se_vende and a.tipo in ('equipo', 'componente')))
   order by similarity(sin_acentos(a.nombre), t.t) desc limit 8)
  union all
  -- El cliente también se encuentra por sus contactos: nombre, teléfono (los dígitos) o correo (282).
  (select 'cliente', c.id::text, c.nombre,
          coalesce('Contacto: ' || k.nombre, c.razon_social, c.ciudad), '/ventas/clientes/' || c.id
   from clientes c cross join t
   left join lateral (select x.nombre from contactos x where x.cliente_id = c.id
                        and (sin_acentos(x.nombre || ' ' || coalesce(x.correo, '')) like '%' || replace(t.t, ' ', '%') || '%'
                             or (length(regexp_replace(t.t, '\D', '', 'g')) >= 7
                                 and regexp_replace(coalesce(x.telefono, ''), '\D', '', 'g') like '%' || regexp_replace(t.t, '\D', '', 'g') || '%'))
                      limit 1) k on true
   where sin_acentos(c.nombre || ' ' || coalesce(c.razon_social, '') || ' ' || coalesce(c.rfc, '')) like '%' || replace(t.t, ' ', '%') || '%'
      or k.nombre is not null
   limit 6)
  union all
  -- Leads (los que cada quien puede ver): por nombre, empresa o teléfono. Primero los abiertos.
  (select 'lead', l.id::text, l.nombre,
          concat_ws(' · ', nullif(l.empresa, ''), case l.estado when 'nuevo' then 'Por tomar' when 'asignado' then 'Abierto'
                                                              when 'convertido' then 'Ya es oportunidad' else 'Descartado' end),
          '/ventas/leads?id=' || l.id
   from leads l, t
   where sin_acentos(l.nombre || ' ' || coalesce(l.empresa, '') || ' ' || coalesce(l.correo, '')) like '%' || replace(t.t, ' ', '%') || '%'
      or (length(regexp_replace(t.t, '\D', '', 'g')) >= 7
          and regexp_replace(coalesce(l.telefono, ''), '\D', '', 'g') like '%' || regexp_replace(t.t, '\D', '', 'g') || '%')
   order by (l.estado in ('nuevo', 'asignado')) desc, l.creado_en desc limit 5)
  union all
  (select 'cotizacion', c.id::text, c.folio || coalesce(' · ' || c.atencion, ''), to_char(c.total, 'FM$999,999,990.00'), '/ventas/cotizaciones/' || c.id
   from cotizaciones c, t where sin_acentos(c.folio || ' ' || coalesce(c.atencion, '') || ' ' || coalesce(c.empresa, '')) like '%' || replace(t.t, ' ', '%') || '%'
   order by c.fecha desc limit 5)
  union all
  -- Pedidos sin montos: la planta también los encuentra y cae en su pantalla de pedidos.
  (select 'pedido', p.id::text, p.folio, (select nombre from clientes where id = p.cliente_id),
          case when (select puede('ventas', 1)) then '/ventas/pedidos/' || p.id else '/produccion/pedidos?pedido=' || p.id end
   from pedidos_basicos() p cross join t
   -- (El folio de antes, "HIS-JM-0218", lo encuentra quien ve pedidos: ventas.)
   left join pedidos x on x.id = p.id
   where sin_acentos(p.folio || ' ' || coalesce(p.id_externo, '') || ' ' || coalesce(x.folio_anterior, '')) like '%' || t.t || '%'
   order by p.fecha desc limit 5)
  union all
  (select 'orden_produccion', o.id::text, o.folio || coalesce(' · ' || o.numero_serie, ''), (select nombre from articulos where id = o.articulo_id), '/produccion/ordenes/' || o.id
   from ordenes_produccion o, t where sin_acentos(o.folio || ' ' || coalesce(o.numero_serie, '')) like '%' || t.t || '%' limit 5)
  union all
  (select 'numero_serie', h.id::text, h.numero_serie, coalesce(h.cliente_nombre, '') || coalesce(' · ' || h.fecha_pedido::text, ''),
          '/produccion/seriales?serie=' || h.numero_serie
   from equipos_historicos h, t where sin_acentos(h.numero_serie) like '%' || t.t || '%' limit 5)
  union all
  (select 'proveedor', p.id::text, p.nombre, p.categoria, '/compras/proveedores/' || p.id
   from proveedores p, t where sin_acentos(p.nombre) like '%' || replace(t.t, ' ', '%') || '%' limit 5)
  union all
  (select 'orden_compra', o.id::text, o.folio, (select nombre from proveedores where id = o.proveedor_id), '/compras/ordenes/' || o.id
   from v_ordenes_compra o, t where sin_acentos(o.folio || ' ' || coalesce(o.factura_proveedor, '')) like '%' || t.t || '%' limit 5)
$function$;

CREATE OR REPLACE FUNCTION public.buscar_clientes(q text, p_limite integer DEFAULT 15)
 RETURNS TABLE(id uuid, nombre text, razon_social text, ciudad text, vendedor text, vendedor_id uuid)
 LANGUAGE sql
 STABLE
AS $function$
  with t as (select sin_acentos(trim(coalesce(q, ''))) t)
  select c.id, c.nombre, c.razon_social, c.ciudad, p.nombre, c.vendedor_id
  from clientes c cross join t left join perfiles p on p.id = c.vendedor_id
  where c.activo and (t.t = '' or sin_acentos(c.nombre || ' ' || coalesce(c.razon_social, '') || ' ' || coalesce(c.rfc, ''))
        like '%' || replace(t.t, ' ', '%') || '%'
        -- o por uno de sus contactos: nombre, correo o teléfono (282)
        or exists (select 1 from contactos x where x.cliente_id = c.id
                     and (sin_acentos(x.nombre || ' ' || coalesce(x.correo, '')) like '%' || replace(t.t, ' ', '%') || '%'
                          or (length(regexp_replace(t.t, '\D', '', 'g')) >= 7
                              and regexp_replace(coalesce(x.telefono, ''), '\D', '', 'g') like '%' || regexp_replace(t.t, '\D', '', 'g') || '%'))))
  order by similarity(sin_acentos(c.nombre), t.t) desc, c.nombre
  limit p_limite
$function$;

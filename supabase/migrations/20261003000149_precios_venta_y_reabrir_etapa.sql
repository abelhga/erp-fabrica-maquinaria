-- =============================================================================
-- Precios de venta solo para quien vende, el buscador lleva al catálogo, y una etapa
-- terminada por error se puede reabrir.
--
-- 1. Precios de venta. Cualquier rol leía precios_lista, y con eso ingeniería, el taller,
--    almacén y compras veían el precio de lista en costeo, en el buscador de artículos y
--    con Claude. Ahora los ve quien vende o decide precios: ventas, catálogo (recepción),
--    márgenes y finanzas, por ve_precios_venta(). Lo mismo el precio de Mercado Libre y
--    del sitio, el precio guardado en el historial de costeo, el precio estimado al
--    contestar una solicitud y el que la solicitud ya trae. Ingeniería deja márgenes:
--    utilidad y fórmula del precio no le sirven sin el precio (y con ellas lo vería).
--    Ventas y su gerencia reciben el catálogo.
-- 2. El buscador de arriba mandaba a recepción y a ventas a fichas de costeo que no pueden
--    abrir. Quien no tiene costeo cae en la ficha del catálogo, solo con lo que se vende.
-- 3. Luis marcó «Terminada» una etapa por error y no había forma de regresarla. La
--    gerencia de producción reabre una etapa con su motivo; quien la marcó lo deshace en
--    los primeros 15 minutos. De paso se corrigen los inicios que puso la sincronización
--    con la hoja de Luis (las 18:00 del día de la hoja: en el futuro, o después del fin).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Precios de venta
-- -----------------------------------------------------------------------------
create or replace function public.ve_precios_venta() returns boolean
language sql stable security definer set search_path = public as $$
  select puede('ventas', 1) or puede('catalogo', 1) or puede('margenes', 1) or puede('finanzas', 1)
$$;
revoke execute on function public.ve_precios_venta() from public, anon;
grant execute on function public.ve_precios_venta() to authenticated;

insert into public.permisos_rol (rol, modulo, nivel) values ('ventas', 'catalogo', 1), ('gerente_ventas', 'catalogo', 1)
on conflict do nothing;
delete from public.permisos_rol where rol = 'ingenieria' and modulo = 'margenes';

alter policy ver on public.precios_lista using ((select ve_precios_venta()));
alter policy ver on public.publicaciones using ((select puede('ventas', 1)) or (select ve_precios_venta()));
alter policy ver on public.ml_publicaciones_sin_ligar using ((select puede('ventas', 1)) or (select ve_precios_venta()));

-- El precio de lista de cada foto del costeo: la API ya no lo da (ingeniería ve el historial
-- de costos). Lo leen quien ve precios, por estas funciones.
revoke select on public.historial_costeo from anon, authenticated;
grant select (id, articulo_id, en, costo_material, costo_mano_obra, costo_total, reconstruido) on public.historial_costeo to authenticated;

create or replace function public.historial_precios()
returns table (articulo_id uuid, en timestamptz, precio_lista numeric)
language sql stable security definer set search_path = public as $$
  select h.articulo_id, h.en, h.precio_lista from historial_costeo h where (select ve_precios_venta())
$$;
revoke execute on function public.historial_precios() from public, anon;
grant execute on function public.historial_precios() to authenticated;

-- Costo y precio en el tiempo (de 117): el precio, solo para quien ve precios.
create or replace function public.serie_costeo(p_articulo uuid)
returns table (en timestamptz, costo numeric, precio_real numeric, precio_constante numeric, reconstruido boolean, utilidad numeric)
language plpgsql stable security definer set search_path = public as $$
declare v_margenes boolean := puede('margenes', 1); v_precios boolean := ve_precios_venta();
begin
  if not puede('costos', 1) then raise exception 'Sin permiso de costos' using errcode = '42501'; end if;
  return query
  with hoy as (
    select case when cc.costo_total > 0 then precio_sin_redondeo(cc.costo_total, politica_de(a.id), c.margen, a.medida_especial) / cc.costo_total end f
    from articulos a join costos_calculados cc on cc.articulo_id = a.id left join costos_articulo c on c.articulo_id = a.id
    where a.id = p_articulo
  )
  select h.en, round(h.costo_total, 2), case when v_precios then h.precio_lista end,
    case when v_margenes then round(h.costo_total * hoy.f, 2) end, h.reconstruido,
    case when v_margenes then h.utilidad end
  from historial_costeo h left join hoy on true where h.articulo_id = p_articulo order by h.en;
end $$;

-- El precio que saldría de un costo: compras captura el costo, pero el precio es de ventas.
create or replace function public.precio_lista_estimado(p_articulo uuid, p_costo numeric, p_moneda public.moneda default 'MXN')
returns numeric language plpgsql stable security definer set search_path = public as $$
declare v_pol int; v_med boolean := false; v_margen numeric; v_fijo numeric;
begin
  if not puede('costos', 1) then raise exception 'Sin permiso de costos' using errcode = '42501'; end if;
  if not ve_precios_venta() then return null; end if;
  if coalesce(p_costo, 0) <= 0 then return null; end if;
  if p_articulo is null then
    select id into v_pol from politicas_precio where por_defecto_para = 'componente';
  else
    v_pol := politica_de(p_articulo);
    select a.medida_especial, c.margen, c.precio_fijo into v_med, v_margen, v_fijo
    from articulos a left join costos_articulo c on c.articulo_id = a.id where a.id = p_articulo;
  end if;
  -- Un precio fijado a mano manda sobre el costo (igual que en recalcular_costos).
  if v_fijo is not null then return v_fijo; end if;
  return precio_desde_costo(p_costo * tc(p_moneda), v_pol, v_margen, coalesce(v_med, false));
end $$;

-- El índice de precios por familia lee el precio de cada foto: es de márgenes.
alter function public.analisis_precios_familia(text, date) rename to analisis_precios_familia_interno;
alter function public.analisis_precios_familia_interno(text, date) security definer set search_path = public;
revoke execute on function public.analisis_precios_familia_interno(text, date) from public, anon, authenticated;
create function public.analisis_precios_familia(p_familia text, p_desde date default '2021-01-01')
returns table (mes date, indice_costo numeric, indice_precio numeric, equipos integer, ventas_importe numeric, ventas_num integer)
language plpgsql stable security definer set search_path = public as $$
begin
  if not puede('margenes', 1) then raise exception 'El índice de precios es de quien maneja márgenes' using errcode = '42501'; end if;
  return query select * from analisis_precios_familia_interno(p_familia, p_desde);
end $$;
revoke execute on function public.analisis_precios_familia(text, date) from public, anon;
grant execute on function public.analisis_precios_familia(text, date) to authenticated;

-- Precio sugerido por canal en línea: de quien ve precios (antes, cualquier rol).
CREATE OR REPLACE FUNCTION public.precios_por_canal(p_articulo uuid)
 RETURNS TABLE(canal canal_venta, comision_pct numeric, costo_envio numeric, precio_sugerido numeric, precio_con_envio numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select c.canal, c.comision_pct, c.costo_envio, precio_canal(p_articulo, c.canal, false), precio_canal(p_articulo, c.canal, true)
  from canales c
  where ve_precios_venta() and c.canal in ('mercadolibre', 'sitio_web', 'amazon')
  order by case c.canal when 'mercadolibre' then 1 when 'sitio_web' then 2 else 3 end
$function$;

-- Compras contesta y se guarda el precio para ventas, pero a compras no se le regresa.
CREATE OR REPLACE FUNCTION public.contestar_solicitud_precio(p_solicitud uuid, p_costo numeric, p_moneda moneda DEFAULT 'MXN'::moneda, p_proveedor uuid DEFAULT NULL::uuid, p_tiempo_entrega_dias integer DEFAULT NULL::integer, p_vigencia_hasta date DEFAULT NULL::date, p_respuesta text DEFAULT NULL::text, p_articulo uuid DEFAULT NULL::uuid, p_nuevo jsonb DEFAULT NULL::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare s solicitudes_precio; v_art uuid; v_clave text; v_nombre text; v_precio numeric; v_quien text;
begin
  if not puede('compras', 2) then raise exception 'Solo compras contesta solicitudes de precio' using errcode = '42501'; end if;
  if not puede('costos', 2) then
    raise exception 'Contestar un precio es capturar un costo: tu rol no puede capturar costos' using errcode = '42501';
  end if;
  select * into s from solicitudes_precio where id = p_solicitud for update;
  if s.id is null then raise exception 'No existe la solicitud'; end if;
  if s.estado in ('contestada', 'no_se_consigue') then
    select nombre into v_quien from perfiles where id = s.contestada_por;
    raise exception '% ya la contestó % el %: no se contesta dos veces', s.folio, coalesce(v_quien, 'compras'),
      to_char(s.contestada_en at time zone 'America/Mexico_City', 'DD/MM HH24:MI');
  end if;
  if s.estado = 'cancelada' then raise exception '% la canceló quien la pidió: ya no hace falta', s.folio; end if;
  if coalesce(p_costo, 0) <= 0 then raise exception 'Escribe el costo (mayor a cero)'; end if;
  if p_tiempo_entrega_dias is null or p_tiempo_entrega_dias < 0 then
    raise exception 'Escribe el tiempo de entrega: es lo primero que pregunta el cliente';
  end if;
  if p_vigencia_hasta is not null and p_vigencia_hasta < hoy_planta() then raise exception 'La vigencia ya pasó'; end if;
  if p_proveedor is not null and not exists (select 1 from proveedores where id = p_proveedor) then raise exception 'No existe ese proveedor'; end if;

  v_art := coalesce(p_articulo, s.articulo_id);
  if v_art is not null and not exists (select 1 from articulos where id = v_art) then raise exception 'No existe ese artículo'; end if;
  if v_art is null then
    if p_nuevo is null then
      raise exception 'Elige el artículo del catálogo o dalo de alta: sin artículo no hay precio de lista';
    end if;
    v_nombre := nullif(trim(coalesce(p_nuevo->>'nombre', s.descripcion)), '');
    if v_nombre is null or length(v_nombre) < 3 then raise exception 'Escribe el nombre del artículo nuevo'; end if;
    v_clave := coalesce(nullif(trim(p_nuevo->>'clave'), ''), sugerir_clave('componente'));
    if exists (select 1 from articulos where clave = v_clave) then raise exception 'Ya existe un artículo con la clave %', v_clave; end if;
    insert into articulos (clave, tipo, nombre, descripcion, unidad, proveedor_id, tiempo_entrega_dias)
    values (v_clave, 'componente', v_nombre,
            coalesce(nullif(trim(p_nuevo->>'descripcion'), ''),
                     nullif(concat_ws(E'\n', '• Marca: ' || s.marca, '• Modelo: ' || s.modelo), '')),
            coalesce(nullif(trim(p_nuevo->>'unidad'), ''), 'pieza'), p_proveedor, p_tiempo_entrega_dias)
    returning id into v_art;
  end if;

  -- El mismo camino que /compras/precios: historial con origen y referencia, y recálculo.
  perform set_config('erp.origen_costo', 'cotizacion_proveedor', true);
  perform set_config('erp.referencia_costo', s.folio, true);
  perform actualizar_costos(jsonb_build_array(jsonb_build_object('articulo_id', v_art, 'costo', p_costo,
    'moneda', p_moneda, 'proveedor_id', coalesce(p_proveedor::text, ''))));
  perform set_config('erp.origen_costo', '', true);
  perform set_config('erp.referencia_costo', '', true);

  -- El plazo queda en el artículo (lo ve la ficha de venta); el proveedor solo si no tenía.
  update articulos set tiempo_entrega_dias = p_tiempo_entrega_dias, proveedor_id = coalesce(proveedor_id, p_proveedor)
  where id = v_art and (tiempo_entrega_dias is distinct from p_tiempo_entrega_dias or (proveedor_id is null and p_proveedor is not null));

  select precio into v_precio from precios_lista where articulo_id = v_art;

  insert into solicitudes_precio_costos (solicitud_id, proveedor_id, costo, moneda)
  values (s.id, p_proveedor, p_costo, p_moneda)
  on conflict (solicitud_id) do update set proveedor_id = excluded.proveedor_id, costo = excluded.costo,
    moneda = excluded.moneda, capturado_por = auth.uid(), en = now();

  update solicitudes_precio set estado = 'contestada', articulo_id = v_art,
    contestada_por = auth.uid(), contestada_en = now(),
    tomada_por = coalesce(tomada_por, auth.uid()), tomada_en = coalesce(tomada_en, now()),
    horas_acuse = coalesce(horas_acuse, horas_habiles(creado_en, now())),
    horas_respuesta = horas_habiles(creado_en, now()),
    tiempo_entrega_dias = p_tiempo_entrega_dias, vigencia_hasta = p_vigencia_hasta,
    respuesta = nullif(trim(p_respuesta), ''), precio_lista = v_precio
  where id = s.id;

  return jsonb_build_object('articulo_id', v_art, 'clave', (select clave from articulos where id = v_art), 'precio_lista', case when ve_precios_venta() then v_precio end);
end $function$;

-- La solicitud trae el precio de lista para el vendedor, no para compras.
create or replace view public.v_solicitudes_precio as
WITH permiso AS MATERIALIZED (
         SELECT ve_costo_solicitud() AS costo,
            puede('compras'::text, 2) AS compras,
            puede('ventas'::text, 3) AS gerente,
            auth.uid() AS yo,
            COALESCE(( SELECT (configuracion.valor ->> 'por_vencer'::text)::numeric AS "numeric"
                   FROM configuracion
                  WHERE configuracion.clave = 'plazos_solicitud_precio'::text), 1::numeric) AS aviso
        )
 SELECT s.id,
    s.folio,
    s.estado,
    s.urgente,
    s.solicitante_id,
    so.nombre AS solicitante,
    so.iniciales AS solicitante_iniciales,
    s.cotizacion_id,
    c.folio AS cotizacion_folio,
    s.partida_id,
    s.cliente_id,
    cl.nombre AS cliente,
    s.articulo_id,
    a.clave,
    a.nombre AS articulo,
    COALESCE(a.unidad, 'pieza'::text) AS unidad,
    a.tipo AS articulo_tipo,
    s.descripcion,
    s.marca,
    s.modelo,
    s.cantidad,
    s.notas,
    s.creado_en,
    s.vence_en,
    s.tomada_por,
    tp.nombre AS tomada_por_nombre,
    s.tomada_en,
    s.contestada_por,
    cp.nombre AS contestada_por_nombre,
    s.contestada_en,
    s.tiempo_entrega_dias,
    s.vigencia_hasta,
    s.respuesta,
        CASE
            WHEN ( SELECT ve_precios_venta() AS ve_precios_venta) THEN s.precio_lista
            ELSE NULL::numeric(14,2)
        END AS precio_lista,
        CASE
            WHEN ( SELECT ve_precios_venta() AS ve_precios_venta) THEN pl.precio
            ELSE NULL::numeric(14,2)
        END AS precio_lista_actual,
    s.horas_acuse,
    s.horas_respuesta,
    s.aplicada_en,
    s.cancelada_en,
    s.motivo_cancelacion,
    xp.nombre AS cancelada_por_nombre,
        CASE
            WHEN permiso.costo THEN k.costo
            ELSE NULL::numeric
        END AS costo,
        CASE
            WHEN permiso.costo THEN k.moneda
            ELSE NULL::moneda
        END AS moneda,
        CASE
            WHEN permiso.costo THEN k.proveedor_id
            ELSE NULL::uuid
        END AS proveedor_id,
        CASE
            WHEN permiso.costo THEN pr.nombre
            ELSE NULL::text
        END AS proveedor,
    (( SELECT count(*) AS count
           FROM solicitudes_precio_fotos f
          WHERE f.solicitud_id = s.id))::integer AS fotos,
        CASE
            WHEN s.estado = ANY (ARRAY['abierta'::text, 'tomada'::text]) THEN horas_habiles(now(), s.vence_en)
            ELSE NULL::numeric
        END AS horas_restantes,
        CASE
            WHEN s.estado = ANY (ARRAY['abierta'::text, 'tomada'::text]) THEN horas_habiles(s.creado_en, now())
            ELSE s.horas_respuesta
        END AS horas_transcurridas,
        CASE
            WHEN (s.estado = ANY (ARRAY['abierta'::text, 'tomada'::text])) AND s.vence_en <= now() THEN horas_habiles(s.vence_en, now())
            ELSE NULL::numeric
        END AS horas_vencida,
        CASE
            WHEN s.estado <> ALL (ARRAY['abierta'::text, 'tomada'::text]) THEN NULL::text
            WHEN s.vence_en <= now() THEN 'vencida'::text
            WHEN horas_habiles(now(), s.vence_en) <= permiso.aviso THEN 'por_vencer'::text
            ELSE 'a_tiempo'::text
        END AS semaforo,
        CASE
            WHEN s.contestada_en IS NOT NULL THEN s.contestada_en <= s.vence_en
            ELSE NULL::boolean
        END AS a_tiempo,
        CASE
            WHEN s.estado = 'contestada'::text THEN s.aplicada_en IS NOT NULL OR (EXISTS ( SELECT 1
               FROM cotizacion_lineas l
                 JOIN cotizaciones q ON q.id = l.cotizacion_id
              WHERE l.articulo_id = s.articulo_id AND q.vendedor_id = s.solicitante_id AND l.precio_unitario > 0::numeric AND q.actualizado_en >= s.contestada_en))
            ELSE NULL::boolean
        END AS usada
   FROM solicitudes_precio s
     CROSS JOIN permiso
     JOIN perfiles so ON so.id = s.solicitante_id
     LEFT JOIN cotizaciones c ON c.id = s.cotizacion_id
     LEFT JOIN clientes cl ON cl.id = s.cliente_id
     LEFT JOIN articulos a ON a.id = s.articulo_id
     LEFT JOIN precios_lista pl ON pl.articulo_id = s.articulo_id
     LEFT JOIN perfiles tp ON tp.id = s.tomada_por
     LEFT JOIN perfiles cp ON cp.id = s.contestada_por
     LEFT JOIN perfiles xp ON xp.id = s.cancelada_por
     LEFT JOIN solicitudes_precio_costos k ON k.solicitud_id = s.id
     LEFT JOIN proveedores pr ON pr.id = k.proveedor_id
  WHERE permiso.compras OR permiso.gerente OR s.solicitante_id = permiso.yo;

-- Tablero de dirección: "equipos que subieron de precio" sale del historial por la función.
CREATE OR REPLACE FUNCTION public.tablero_direccion()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
AS $function$
declare
  r jsonb := '{}'::jsonb;
  v_hoy date := (now() at time zone 'America/Mexico_City')::date;
  v_mes date := date_trunc('month', v_hoy);
  v_anio date := date_trunc('year', v_hoy);
  v_dia_anio int := v_hoy - date_trunc('year', v_hoy)::date + 1;
begin
  if puede('ventas', 3) or puede('finanzas', 1) then
    r := r || jsonb_build_object('ventas', (
      -- Todo contra el mismo tramo del año pasado: comparar el mes en curso (3 días)
      -- contra el mes completo del año pasado siempre sale en rojo.
      with c as (select ventas_entre(v_anio, v_hoy) anio,
                        ventas_entre((v_anio - interval '1 year')::date, (v_hoy - interval '1 year')::date) misma_fecha,
                        ventas_entre((v_anio - interval '1 year')::date, (v_anio - interval '1 day')::date) anterior_total)
      select jsonb_build_object(
        'mes', ventas_entre(v_mes, v_hoy),
        'mes_anio_anterior', ventas_entre((v_mes - interval '1 year')::date, (v_hoy - interval '1 year')::date),
        'anio', c.anio,
        'anio_anterior_misma_fecha', c.misma_fecha,
        'anio_anterior_total', c.anterior_total,
        -- "A este ritmo" con la estacionalidad del año pasado: si vamos 22 % arriba a
        -- la misma fecha, cerramos 22 % arriba de lo que cerró. La lineal (× 365 / día)
        -- subestima cuando el último trimestre es fuerte, como en 2025.
        'proyeccion_anio', round(case when c.misma_fecha > 0 and c.anterior_total > 0
                                      then c.anterior_total * c.anio / c.misma_fecha
                                      else c.anio * 365.0 / v_dia_anio end),
        'serie_12', (select jsonb_agg(jsonb_build_object('mes', x.mes, 'monto', x.monto) order by x.mes)
                     from ventas_historicas_mes((v_mes - interval '11 months')::date) x)
      ) from c),
      'top_clientes', (
        select coalesce(jsonb_agg(t order by t.monto desc), '[]') from (
          select c.id, c.nombre, round(sum(x.monto)) monto from (
            select h.cliente_id, h.monto from historial_ventas_hoja h where h.tipo = 'Venta' and h.fecha >= v_anio
            union all
            select p.cliente_id, p.total * p.tipo_cambio from pedidos p where not p.historico and p.estado <> 'cancelado' and p.fecha >= v_anio
              and p.fecha >= coalesce((select (valor #>> '{}')::date from configuracion where clave = 'fecha_arranque'), current_date)
          ) x join clientes c on c.id = x.cliente_id group by c.id, c.nombre order by sum(x.monto) desc limit 8) t));
  end if;

  if puede('ventas', 3) then
    r := r || jsonb_build_object('embudo', (
      select coalesce(jsonb_agg(jsonb_build_object('etapa', e.etapa, 'n', coalesce(o.n, 0), 'monto', coalesce(o.monto, 0)) order by e.ord), '[]')
      from (values ('prospecto', 1), ('contactado', 2), ('cotizado', 3), ('negociacion', 4)) e(etapa, ord)
      left join (select etapa::text, count(*) n, sum(monto_estimado) monto from oportunidades where etapa not in ('ganada', 'perdida') group by etapa) o
        on o.etapa = e.etapa),
      'cotizaciones', (
        select jsonb_build_object(
          'abiertas', count(*) filter (where estado in ('enviada', 'autorizada') and fecha + vigencia_dias >= v_hoy),
          'monto_abierto', coalesce(sum(total * tipo_cambio) filter (where estado in ('enviada', 'autorizada') and fecha + vigencia_dias >= v_hoy), 0),
          'por_autorizar', count(*) filter (where estado = 'por_autorizar'),
          'cierre_90d', round(count(*) filter (where estado = 'aceptada' and fecha >= v_hoy - 90)::numeric
                         / nullif(count(*) filter (where estado in ('aceptada', 'rechazada', 'vencida') and fecha >= v_hoy - 90), 0), 3),
          'del_mes', count(*) filter (where fecha >= v_mes))
        from cotizaciones),
      'vendedores', (
        select coalesce(jsonb_agg(jsonb_build_object('nombre', c.vendedor, 'maquinaria', c.venta_maquinaria + c.venta_otros,
          'refacciones', c.venta_refacciones, 'siguiente_meta', c.siguiente_meta, 'comision', c.total) order by c.venta_maquinaria + c.venta_otros desc), '[]')
        from comisiones_mes(v_mes) c),
      'canales', (
        select coalesce(jsonb_agg(jsonb_build_object('canal', canal, 'monto', monto) order by monto desc), '[]') from (
          select p.canal::text canal, round(sum(p.subtotal * p.tipo_cambio)) monto from pedidos p
          where p.estado <> 'cancelado' and p.fecha >= v_anio group by 1) x));
  end if;

  if puede('produccion', 1) then
    r := r || jsonb_build_object('produccion', (
      select jsonb_build_object(
        'abiertas', count(*), 'atrasadas', count(*) filter (where atrasada), 'en_proceso', count(*) filter (where estado = 'en_proceso'),
        'con_faltantes', count(*) filter (where materiales_faltantes > 0),
        'a_tiempo_90d', (select round(count(*) filter (where terminada_en::date <= fecha_compromiso)::numeric / nullif(count(*), 0), 3)
                         from ordenes_produccion where terminada_en >= v_hoy - 90 and fecha_compromiso is not null),
        'terminadas_mes', (select count(*) from ordenes_produccion where terminada_en >= v_mes),
        'carga', (select coalesce(jsonb_agg(jsonb_build_object('etapa', nombre, 'color', color, 'horas', horas_pendientes,
                    'semanas', round(horas_pendientes / nullif(capacidad_horas_semana, 0), 1)) order by orden), '[]') from v_carga_etapas))
      from v_tablero_produccion));
  end if;

  if puede('inventario', 1) and puede('costos', 1) then
    r := r || jsonb_build_object('inventario', (
      with re as (select * from reabasto())
      select jsonb_build_object(
        'valor', (select round(sum(e.cantidad * cc.costo_total)) from existencias e join costos_calculados cc using (articulo_id) where e.cantidad > 0),
        'por_almacen', (select coalesce(jsonb_agg(jsonb_build_object('almacen', a.nombre, 'valor', x.v) order by x.v desc), '[]') from (
            select e.almacen_id, round(sum(e.cantidad * cc.costo_total)) v from existencias e join costos_calculados cc using (articulo_id)
            where e.cantidad > 0 group by 1) x join almacenes a on a.id = x.almacen_id),
        'excedentes_valor', (select round(sum(re.en_planta * cc.costo_total)) from re join costos_calculados cc on cc.articulo_id = re.articulo_id where re.estado = 'excedente'),
        'excedentes_n', (select count(*) from re where estado = 'excedente'),
        'a_ordenar_n', (select count(*) from re where estado = 'ordenar'),
        'inversion_sugerida', (select round(sum(re.sugerido * cc.costo_total)) from re join costos_calculados cc on cc.articulo_id = re.articulo_id where re.estado = 'ordenar'),
        'importados_en_riesgo_n', (select count(*) from re where es_importado and estado = 'ordenar'),
        'importados_en_riesgo', (select coalesce(jsonb_agg(jsonb_build_object('id', articulo_id, 'nombre', nombre, 'disponible', disponible,
                                   'reorden', punto_reorden, 'dias', dias_entrega) order by disponible - punto_reorden), '[]')
                                 from (select * from re where es_importado and estado = 'ordenar' order by disponible - punto_reorden limit 6) i),
        'ajustes_pendientes', (select count(*) from ajustes_inventario where estado = 'pendiente'))));
  end if;

  if puede('costos', 1) then
    r := r || jsonb_build_object('costos_al_alza', (
      select coalesce(jsonb_agg(t order by t.cambio desc), '[]') from (
        select a.id, a.nombre, h.costo_anterior, h.costo_nuevo, round(h.costo_nuevo / nullif(h.costo_anterior, 0) - 1, 4) cambio, h.en,
          (select count(*) from donde_se_usa(a.id)) equipos
        from historial_costos h join articulos a on a.id = h.articulo_id
        where h.en >= v_hoy - 30 and h.costo_anterior > 0 and h.costo_nuevo > h.costo_anterior * 1.03
        order by h.costo_nuevo / h.costo_anterior desc limit 6) t),
      -- El precio de lista solo para quien ve precios de venta (149): lo da historial_precios().
      'equipos_que_subieron', (
        with hp as (select h.articulo_id, h.en, h.precio_lista from historial_precios() h)
        select coalesce(jsonb_agg(t order by t.cambio desc), '[]') from (
          select a.id, a.clave, a.nombre, u.precio_lista precio, round(u.precio_lista / nullif(p.precio_lista, 0) - 1, 4) cambio
          from articulos a
          join lateral (select precio_lista from hp where hp.articulo_id = a.id and hp.precio_lista is not null order by hp.en desc limit 1) u on true
          join lateral (select precio_lista from hp where hp.articulo_id = a.id and hp.precio_lista is not null and hp.en < v_hoy - 30 order by hp.en desc limit 1) p on true
          where a.tipo = 'equipo' and u.precio_lista <> p.precio_lista
          order by abs(u.precio_lista / nullif(p.precio_lista, 0) - 1) desc limit 6) t));
  end if;

  if puede('finanzas', 1) then
    r := r || jsonb_build_object('cobranza', (
      select jsonb_build_object(
        'erp', (select coalesce(sum(saldo), 0) from v_saldos_pedido where saldo > 0),
        'arranque', (select coalesce(sum(saldo), 0) from v_saldo_arranque_clientes where saldo > 1),
        'antiguedad', (select jsonb_build_object(
            'd0_30', coalesce(sum(saldo) filter (where v_hoy - fecha <= 30), 0),
            'd31_60', coalesce(sum(saldo) filter (where v_hoy - fecha between 31 and 60), 0),
            'd61_90', coalesce(sum(saldo) filter (where v_hoy - fecha between 61 and 90), 0),
            'd90', coalesce(sum(saldo) filter (where v_hoy - fecha > 90), 0))
          from v_saldos_pedido where saldo > 0),
        'cobrado_mes', (select coalesce(sum(monto), 0) from cobros where fecha >= v_mes)
          + (select coalesce(sum(monto), 0) from historial_ventas_hoja where tipo = 'Pago' and fecha >= v_mes))),
      'por_pagar', (select jsonb_build_object(
          'total', coalesce(sum(saldo * case when moneda = 'MXN' then 1 else tc(moneda) end), 0),
          'vencido', coalesce(sum(saldo * case when moneda = 'MXN' then 1 else tc(moneda) end) filter (where vence_pago < v_hoy), 0),
          -- Lo que la hoja dice que debemos (solo saldos a cargo) y lo que nos deben los
          -- proveedores (anticipos y reembolsos): no se netean, son cosas distintas.
          -- La cuenta de cada proveedor (lo de la hoja más lo registrado aquí sin orden de compra).
          'arranque', (select coalesce(sum(saldo), 0) from v_saldo_arranque_proveedores where saldo > 1 and tipo_acreedor not in ('socio', 'financiamiento')),
          'arranque_vencido', (select coalesce(sum(vencido), 0) from v_saldo_arranque_proveedores where tipo_acreedor not in ('socio', 'financiamiento')),
          'arranque_a_favor', (select coalesce(-sum(saldo), 0) from v_saldo_arranque_proveedores where saldo < -1 and tipo_acreedor not in ('socio', 'financiamiento')),
          -- Préstamos de socios y créditos de banco: deuda, pero no con proveedores.
          'socios', (select coalesce(sum(saldo), 0) from v_saldo_arranque_proveedores where saldo > 1 and tipo_acreedor = 'socio'),
          'financiamiento', (select coalesce(sum(saldo), 0) from v_saldo_arranque_proveedores where saldo > 1 and tipo_acreedor = 'financiamiento'))
        from v_cuentas_por_pagar where saldo > 0));
  end if;

  return r || jsonb_build_object('generado', now());
end $function$;

-- -----------------------------------------------------------------------------
-- 2. El buscador lleva a cada quien a donde puede entrar
-- -----------------------------------------------------------------------------
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
  (select 'cliente', c.id::text, c.nombre, coalesce(c.razon_social, c.ciudad), '/ventas/clientes/' || c.id
   from clientes c, t where sin_acentos(c.nombre || ' ' || coalesce(c.razon_social, '') || ' ' || coalesce(c.rfc, '')) like '%' || replace(t.t, ' ', '%') || '%'
   limit 6)
  union all
  (select 'cotizacion', c.id::text, c.folio || coalesce(' · ' || c.atencion, ''), to_char(c.total, 'FM$999,999,990.00'), '/ventas/cotizaciones/' || c.id
   from cotizaciones c, t where sin_acentos(c.folio || ' ' || coalesce(c.atencion, '') || ' ' || coalesce(c.empresa, '')) like '%' || replace(t.t, ' ', '%') || '%'
   order by c.fecha desc limit 5)
  union all
  (select 'pedido', p.id::text, p.folio, (select nombre from clientes where id = p.cliente_id), '/ventas/pedidos/' || p.id
   from pedidos p, t where sin_acentos(p.folio || ' ' || coalesce(p.id_externo, '')) like '%' || t.t || '%' order by p.fecha desc limit 5)
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

-- -----------------------------------------------------------------------------
-- 3. Reabrir una etapa terminada por error
-- -----------------------------------------------------------------------------
alter table public.op_eventos drop constraint op_eventos_tipo_check;
alter table public.op_eventos add constraint op_eventos_tipo_check check (tipo = any (array['creada', 'liberada', 'inicio', 'pausa',
  'reanudar', 'fin', 'problema', 'nota', 'surtido', 'cambio_material', 'terminada', 'entregada', 'reabierta']));

-- La etapa queda pausada (conserva su inicio): se reanuda en la terminal eligiendo quién la
-- trabaja, y así las horas hombre siguen contando bien.
create or replace function public.reabrir_etapa(p_operacion uuid, p_motivo text default null) returns void
language plpgsql security definer set search_path = public as $$
declare op op_operaciones; o ordenes_produccion; v_etapa text; v_fin op_eventos;
  v_motivo text := nullif(trim(p_motivo), '');
begin
  select * into op from op_operaciones where id = p_operacion for update;
  if op.id is null then raise exception 'No existe esa etapa'; end if;
  select * into o from ordenes_produccion where id = op.orden_id for update;
  select nombre into v_etapa from etapas where id = op.etapa_id;
  select * into v_fin from op_eventos where operacion_id = p_operacion and tipo = 'fin' order by en desc limit 1;
  if puede('produccion', 3) then
    if v_motivo is null then raise exception 'Escribe por qué se reabre %', v_etapa; end if;
  elsif puede('produccion', 2) and v_fin.usuario_id = auth.uid() and v_fin.en > now() - interval '15 minutes' then
    v_motivo := coalesce(v_motivo, 'Se marcó terminada por error');
  else
    raise exception 'Reabrir una etapa es de la gerencia de producción (quien la terminó puede deshacerlo en los primeros 15 minutos)'
      using errcode = '42501';
  end if;
  if op.estado <> 'terminada' then raise exception '% de % no está terminada', v_etapa, o.folio; end if;
  if o.estado in ('entregada', 'cancelada') then raise exception 'La orden % ya está %', o.folio, o.estado; end if;

  update op_operaciones set estado = 'pausada', fin = null where id = p_operacion;
  -- Si era la última etapa, la orden (y su pedido) dejan de estar terminados.
  if o.estado = 'terminada' then
    update ordenes_produccion set estado = 'en_proceso', terminada_en = null where id = o.id;
    if o.pedido_id is not null then
      update pedidos set estado = 'en_produccion' where id = o.pedido_id and estado = 'listo';
    end if;
  end if;
  insert into op_eventos (orden_id, operacion_id, tipo, nota) values (o.id, p_operacion, 'reabierta', v_motivo);
end $$;
revoke execute on function public.reabrir_etapa(uuid, text) from public, anon;
grant execute on function public.reabrir_etapa(uuid, text) to authenticated;

-- Un inicio nunca queda en el futuro (la sincronización llegó a poner las 18:00 de hoy).
CREATE OR REPLACE FUNCTION public.avanzar_operacion(p_operacion uuid, p_accion text, p_nota text DEFAULT NULL::text, p_responsable text DEFAULT NULL::text, p_empleados uuid[] DEFAULT NULL::uuid[], p_sin_nombre integer DEFAULT 0)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare op op_operaciones; o ordenes_produccion; v_etapa text; v_resp text := nullif(trim(p_responsable), '');
  v_cuadrilla text;
  v_nota text := nullif(trim(p_nota), '');
begin
  if not puede('produccion', 2) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  select * into op from op_operaciones where id = p_operacion for update;
  if op.id is null then raise exception 'No existe esa etapa'; end if;
  select * into o from ordenes_produccion where id = op.orden_id for update;
  select nombre into v_etapa from etapas where id = op.etapa_id;
  if o.estado = 'planeada' then raise exception 'La orden % todavía no está liberada', o.folio; end if;
  if o.estado in ('terminada', 'entregada', 'cancelada') then raise exception 'La orden % ya está cerrada', o.folio; end if;
  if o.en_espera_motivo is not null then
    raise exception 'La orden % está en espera (%): la gerencia de producción la reactiva', o.folio, o.en_espera_motivo;
  end if;

  if p_accion in ('inicio', 'reanudar') then
    v_cuadrilla := nombres_cuadrilla(p_empleados, p_sin_nombre);
    v_resp := coalesce(v_cuadrilla, v_resp);
  end if;

  case p_accion
    when 'inicio' then
      if op.estado = 'terminada' then raise exception '% de % ya se terminó', v_etapa, o.folio; end if;
      if op.estado = 'en_proceso' then
        raise exception '% de % ya estaba en proceso%', v_etapa, o.folio, coalesce(' (' || op.responsable || ')', '');
      end if;
      update op_operaciones set estado = 'en_proceso', inicio = least(coalesce(inicio, now()), now()),
        responsable = coalesce(v_resp, responsable) where id = p_operacion;
      update ordenes_produccion set estado = 'en_proceso' where id = o.id and estado = 'liberada';
    when 'pausa' then
      if op.estado <> 'en_proceso' then raise exception 'Solo se pausa una etapa que está en proceso'; end if;
      update op_operaciones set estado = 'pausada', responsable = coalesce(v_resp, responsable) where id = p_operacion;
    when 'reanudar' then
      if op.estado <> 'pausada' then raise exception '% de % no está pausada', v_etapa, o.folio; end if;
      update op_operaciones set estado = 'en_proceso', responsable = coalesce(v_resp, responsable) where id = p_operacion;
    when 'fin' then
      if op.estado = 'terminada' then raise exception '% de % ya se terminó', v_etapa, o.folio; end if;
      update op_operaciones set estado = 'terminada', fin = now(), inicio = least(coalesce(inicio, now()), now()),
        responsable = coalesce(v_resp, responsable) where id = p_operacion;
      update ordenes_produccion set estado = 'en_proceso' where id = o.id and estado = 'liberada';
    when 'problema' then
      if v_nota is null then raise exception 'Escribe cuál es el problema'; end if;
    when 'nota' then
      if v_nota is null then raise exception 'La nota está vacía'; end if;
    else raise exception 'Acción desconocida: %', p_accion;
  end case;
  insert into op_eventos (orden_id, operacion_id, tipo, nota, responsable)
  values (o.id, p_operacion, p_accion, v_nota, coalesce(v_resp, op.responsable));

  -- Quien empieza o reanuda la etapa abre su tramo de tiempo (pausa y fin los cierra el disparador).
  if p_accion in ('inicio', 'reanudar') then
    perform abrir_tramos(p_operacion, p_empleados, p_sin_nombre);
  end if;

  if p_accion = 'fin' and not exists (select 1 from op_operaciones where orden_id = o.id and estado <> 'terminada') then
    update ordenes_produccion set estado = 'terminada', terminada_en = now() where id = o.id;
    insert into op_eventos (orden_id, tipo) values (o.id, 'terminada');
    -- Si todas las órdenes del pedido terminaron, el pedido queda listo para entregar.
    if o.pedido_id is not null and not exists (select 1 from ordenes_produccion where pedido_id = o.pedido_id
                                               and estado not in ('terminada', 'entregada', 'cancelada')) then
      update pedidos set estado = 'listo' where id = o.pedido_id and estado = 'en_produccion';
    end if;
  end if;
end $function$;

-- La sincronización con la hoja de Luis (21-oct) puso las 18:00 del día de la hoja como
-- inicio o fin de etapas que nadie tocó en la terminal: quedaron en el futuro o con el
-- inicio después del fin. Lo único seguro es que a la hora de la sincronización ya
-- estaban así, y esa hora se les pone.
with sinc as (
  select orden_id, min(en) en from public.op_eventos
  where tipo = 'nota' and nota like 'Actualizada con la hoja de Luis%' group by orden_id
)
-- (Si la etapa ya venía terminada desde la carga del 16-oct, el inicio no pasa de su fin.)
update public.op_operaciones x set inicio = least(s.en, coalesce(x.fin, s.en))
from sinc s
where s.orden_id = x.orden_id and x.inicio > s.en
  and (x.inicio at time zone 'America/Mexico_City')::time = '18:00'
  and not exists (select 1 from public.op_eventos v where v.operacion_id = x.id and v.tipo in ('inicio', 'reanudar'));

with sinc as (
  select orden_id, min(en) en from public.op_eventos
  where tipo = 'nota' and nota like 'Actualizada con la hoja de Luis%' group by orden_id
)
update public.op_operaciones x set fin = s.en
from sinc s
where s.orden_id = x.orden_id and x.fin > s.en
  and (x.fin at time zone 'America/Mexico_City')::time = '18:00'
  and not exists (select 1 from public.op_eventos v where v.operacion_id = x.id and v.tipo = 'fin');

with sinc as (
  select orden_id, min(en) en from public.op_eventos
  where tipo = 'nota' and nota like 'Actualizada con la hoja de Luis%' group by orden_id
)
update public.ordenes_produccion o set terminada_en = s.en
from sinc s
where s.orden_id = o.id and o.terminada_en > s.en
  and (o.terminada_en at time zone 'America/Mexico_City')::time = '18:00';

-- OP-2026-00023: Luis marcó Pailería terminada por error el 21-oct y pidió regresarla.
do $$
declare x uuid; v_orden uuid;
begin
  select op.id, op.orden_id into x, v_orden
  from public.op_operaciones op join public.ordenes_produccion o on o.id = op.orden_id join public.etapas e on e.id = op.etapa_id
  where o.folio = 'OP-2026-00023' and e.nombre = 'Pailería' and op.estado = 'terminada' and o.estado = 'en_proceso';
  if x is not null then
    update public.op_operaciones set estado = 'pausada', fin = null where id = x;
    insert into public.op_eventos (orden_id, operacion_id, tipo, nota)
    values (v_orden, x, 'reabierta', 'Luis la marcó terminada por error el 21-oct; se reabrió a petición suya.');
  end if;
end $$;

-- Skydropx: cotizar y generar la guía desde el envío.
--
-- Hoy Juan Carlos cotiza en el panel de Skydropx, genera la guía ahí y la vuelve a capturar
-- en el ERP (paquetería, costo, número y PDF). La función de borde "skydropx" hace las dos
-- cosas con la API y deja el envío igual que si se hubiera capturado a mano: las funciones
-- de aquí terminan llamando a cotizar_envio/registrar_guia, así que el estado, el saldo y
-- los avisos no cambian de reglas. La captura a mano se queda como respaldo (fletes, o si
-- Skydropx falla).
--
-- Lo que faltaba de verdad era la dirección con estructura: Skydropx cotiza por CP,
-- estado, municipio y colonia, y en el ERP el destino era un solo texto. Se guarda por
-- campos en el envío y se copia al contacto del cliente, para que el siguiente envío a la
-- misma persona ya salga lleno.
--
-- La función de borde actúa con la sesión de quien da el clic (no con la llave de
-- servicio): la guía queda a su nombre y la RLS de envíos y del bucket sigue mandando.

-- -----------------------------------------------------------------------------
-- Dirección por campos (envío y contacto)
-- -----------------------------------------------------------------------------
alter table public.envios
  add column if not exists dest_cp text,
  add column if not exists dest_estado text,
  add column if not exists dest_municipio text,
  add column if not exists dest_colonia text,
  add column if not exists dest_calle text,          -- calle y número (en México van juntos)
  add column if not exists dest_referencia text,
  add column if not exists dest_empresa text,
  add column if not exists dest_correo text,
  add column if not exists skydropx_cotizacion_id text,
  add column if not exists skydropx_envio_id text,   -- en cuanto Skydropx acepta la guía: con esto nadie la vuelve a pedir
  add column if not exists rastreo_url text;

alter table public.contactos
  add column if not exists domicilio_cp text,
  add column if not exists domicilio_estado text,
  add column if not exists domicilio_municipio text,
  add column if not exists domicilio_colonia text,
  add column if not exists domicilio_calle text,
  add column if not exists domicilio_referencia text;

-- -----------------------------------------------------------------------------
-- Skydropx como paquetería: es una sola billetera de prepago para todas las paqueterías
-- que ofrece, así que el saldo calculado (recargas − guías) que ya existía sirve tal cual.
-- La paquetería real (FedEx, Estafeta…) y el servicio quedan en "servicio".
-- -----------------------------------------------------------------------------
insert into public.paqueterias (nombre, usa_saldo, notas)
values ('Skydropx', true, 'Guías de cualquier paquetería pagadas con el saldo de Skydropx. Las que se generan desde el ERP se descuentan solas.')
on conflict (nombre) do nothing;

insert into public.configuracion (clave, valor, descripcion) values
  ('skydropx', '{"origen_plantilla_id": null, "origen": null, "carta_porte": null, "tipo_empaque": "4G", "formato": "standard"}',
   'Skydropx. origen_plantilla_id/origen: la dirección de la planta (de las plantillas de Skydropx); carta_porte: clave SAT de lo que se manda; tipo_empaque: clave SAT del empaque (4G = caja de cartón); formato: standard (hoja) o thermal (etiqueta).')
on conflict (clave) do nothing;

-- -----------------------------------------------------------------------------
-- La vista de envíos con lo nuevo (al final, para no mover las columnas de siempre)
-- -----------------------------------------------------------------------------
create or replace view public.v_envios with (security_invoker = true) as
 SELECT e.id, e.folio, e.pedido_id, p.folio AS pedido_folio, p.canal, p.id_externo, p.cliente_id, c.nombre AS cliente,
    p.vendedor_id, pv.nombre AS vendedor, e.tipo, nombre_tipo_envio(e.tipo) AS tipo_nombre, e.estado, e.paqueteria_id,
    q.nombre AS paqueteria, q.usa_saldo, e.servicio, e.contacto_id, e.destinatario, e.telefono, e.destino,
    e.fecha_recoleccion, e.notas, e.costo_cotizado, e.costo_real, e.numero_guia, e.solicitado_por,
    sp.nombre AS solicitado_por_nombre, e.solicitado_en, e.cotizado_por, cp.nombre AS cotizado_por_nombre, e.cotizado_en,
    e.guia_por, gp.nombre AS guia_por_nombre, e.guia_en, e.empacado_por, ep.nombre AS empacado_por_nombre, e.empacado_en,
    e.checklist, e.enviado_por, np.nombre AS enviado_por_nombre, e.enviado_en, e.entregado_por,
    dp.nombre AS entregado_por_nombre, e.entregado_en, e.recibio, e.cancelado_por, xp.nombre AS cancelado_por_nombre,
    e.cancelado_en, e.motivo_cancelacion, e.guia_reembolsada, e.inventario_descontado_en,
    b.bultos, b.peso_total, b.peso_volumetrico, b.sin_medidas, l.partidas, l.piezas, l.resumen, l.lleva_equipo,
    (( SELECT count(*) FROM evidencias_envio v WHERE v.envio_id = e.id AND v.tipo = 'empaque'))::integer AS fotos,
    ( SELECT v.ruta FROM evidencias_envio v WHERE v.envio_id = e.id AND v.tipo = 'guia' ORDER BY v.en DESC LIMIT 1) AS guia_ruta,
    (e.estado <> ALL (ARRAY['enviado', 'entregado', 'cancelado'])) AS abierto,
    (e.tipo = ANY (ARRAY['paqueteria', 'flete', 'recoge', 'a_full'])) AS lleva_empaque,
    ((e.estado <> ALL (ARRAY['enviado', 'entregado', 'cancelado'])) AND (e.tipo = ANY (ARRAY['paqueteria', 'flete'])) AND (e.guia_en IS NULL)) AS falta_guia,
    ((e.estado <> ALL (ARRAY['enviado', 'entregado', 'cancelado'])) AND (e.tipo = ANY (ARRAY['paqueteria', 'flete', 'recoge', 'a_full'])) AND (e.empacado_en IS NULL)) AS falta_empaque,
    ((e.estado <> ALL (ARRAY['enviado', 'entregado', 'cancelado'])) AND ((e.empacado_en IS NOT NULL) OR (e.tipo = ANY (ARRAY['full', 'proveedor'])))
      AND (NOT ((e.tipo = 'paqueteria') AND (e.numero_guia IS NULL)))) AS listo_para_salir,
    (hoy_planta() - ((e.solicitado_en AT TIME ZONE 'America/Mexico_City'))::date) AS dias_desde_solicitud,
    CASE WHEN e.estado = 'enviado' THEN hoy_planta() - ((e.enviado_en AT TIME ZONE 'America/Mexico_City'))::date ELSE NULL::integer END AS dias_en_camino,
    e.actualizado_en,
    e.dest_cp, e.dest_estado, e.dest_municipio, e.dest_colonia, e.dest_calle, e.dest_referencia, e.dest_empresa, e.dest_correo,
    e.skydropx_cotizacion_id, e.skydropx_envio_id, e.rastreo_url
   FROM envios e
     LEFT JOIN pedidos p ON p.id = e.pedido_id
     LEFT JOIN clientes c ON c.id = p.cliente_id
     LEFT JOIN perfiles pv ON pv.id = p.vendedor_id
     LEFT JOIN paqueterias q ON q.id = e.paqueteria_id
     LEFT JOIN perfiles sp ON sp.id = e.solicitado_por
     LEFT JOIN perfiles cp ON cp.id = e.cotizado_por
     LEFT JOIN perfiles gp ON gp.id = e.guia_por
     LEFT JOIN perfiles ep ON ep.id = e.empacado_por
     LEFT JOIN perfiles np ON np.id = e.enviado_por
     LEFT JOIN perfiles dp ON dp.id = e.entregado_por
     LEFT JOIN perfiles xp ON xp.id = e.cancelado_por
     LEFT JOIN LATERAL ( SELECT count(*)::integer AS bultos, sum(x.peso_kg) AS peso_total,
            round(sum(x.largo_cm * x.ancho_cm * x.alto_cm / 5000.0), 2) AS peso_volumetrico,
            (count(*) FILTER (WHERE x.peso_kg IS NULL OR x.largo_cm IS NULL OR x.ancho_cm IS NULL OR x.alto_cm IS NULL))::integer AS sin_medidas
           FROM envio_bultos x WHERE x.envio_id = e.id) b ON true
     LEFT JOIN LATERAL ( SELECT count(*)::integer AS partidas, sum(x.cantidad) AS piezas,
            string_agg(format('%s × %s', x.cantidad::double precision, x.descripcion), '; ' ORDER BY x.orden) AS resumen,
            COALESCE(bool_or(a.tipo = ANY (ARRAY['equipo'::tipo_articulo, 'subensamble'::tipo_articulo])), false) AS lleva_equipo
           FROM envio_lineas x LEFT JOIN articulos a ON a.id = x.articulo_id
          WHERE x.envio_id = e.id) l ON true;

-- -----------------------------------------------------------------------------
-- Lo que se prellena al abrir "Cotizar con Skydropx": lo del envío; si no hay, lo que
-- se guardó en el contacto la vez pasada; si tampoco, el estado y la ciudad del cliente.
-- Es definer porque almacén genera guías sin ver la ficha del cliente; solo da la dirección
-- de un envío que quien pregunta ya puede ver.
-- -----------------------------------------------------------------------------
create or replace function public.destino_envio(p_envio uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'cp', coalesce(e.dest_cp, k.domicilio_cp),
    'estado', coalesce(e.dest_estado, k.domicilio_estado, c.estado),
    'municipio', coalesce(e.dest_municipio, k.domicilio_municipio, c.ciudad),
    'colonia', coalesce(e.dest_colonia, k.domicilio_colonia),
    'calle', coalesce(e.dest_calle, k.domicilio_calle),
    'referencia', coalesce(e.dest_referencia, k.domicilio_referencia),
    'empresa', coalesce(e.dest_empresa, c.razon_social, c.nombre),
    'correo', coalesce(e.dest_correo, k.correo),
    'destinatario', coalesce(e.destinatario, k.nombre),
    'telefono', coalesce(e.telefono, k.telefono, k.whatsapp),
    'texto', coalesce(e.destino, k.domicilio),
    'capturado', e.dest_cp is not null)
  from envios e
  left join contactos k on k.id = e.contacto_id
  left join pedidos p on p.id = e.pedido_id
  left join clientes c on c.id = p.cliente_id
  where e.id = p_envio and puede('envios', 2) and envio_visible(p_envio);
$$;

-- -----------------------------------------------------------------------------
-- Guardar el destino por campos. Los topes de largo son los de Skydropx: mejor que la
-- persona lo acorte aquí a que la guía salga con el nombre cortado.
-- -----------------------------------------------------------------------------
create or replace function public.guardar_destino_envio(p_envio uuid, p_datos jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare
  e envios;
  v_cp text := regexp_replace(coalesce(p_datos->>'cp', ''), '\s', '', 'g');
  v_tel text := regexp_replace(coalesce(p_datos->>'telefono', ''), '\D', '', 'g');
  v_estado text := nullif(trim(p_datos->>'estado'), '');
  v_mun text := nullif(trim(p_datos->>'municipio'), '');
  v_col text := nullif(trim(p_datos->>'colonia'), '');
  v_calle text := nullif(trim(p_datos->>'calle'), '');
  v_ref text := nullif(trim(p_datos->>'referencia'), '');
  v_emp text := nullif(trim(p_datos->>'empresa'), '');
  v_correo text := nullif(lower(trim(p_datos->>'correo')), '');
  v_nombre text := nullif(trim(p_datos->>'destinatario'), '');
  v_texto text;
begin
  if not puede('envios', 2) then raise exception 'Sin permiso para capturar envíos' using errcode = '42501'; end if;
  select * into e from envios where id = p_envio for update;
  if e.id is null or not envio_visible(p_envio) then raise exception 'No existe el envío' using errcode = '42501'; end if;
  if e.estado in ('enviado', 'entregado', 'cancelado') then raise exception 'El envío % ya está %', e.folio, e.estado; end if;
  if e.numero_guia is not null then raise exception '% ya tiene guía: el destino es el que quedó impreso', e.folio; end if;
  if v_cp !~ '^\d{5}$' then raise exception 'El código postal son 5 números'; end if;
  if v_estado is null or v_mun is null or v_col is null then raise exception 'Faltan estado, municipio o colonia: la paquetería cotiza con ellos'; end if;
  if v_calle is null then raise exception 'Escribe la calle y el número'; end if;
  if v_nombre is null then raise exception 'Escribe quién recibe'; end if;
  if length(v_tel) < 10 then raise exception 'El teléfono de quien recibe lleva 10 números'; end if;
  if length(v_calle) > 45 then raise exception 'La calle y número caben en 45 letras (lleva %); lo demás va en referencia', length(v_calle); end if;
  if length(v_nombre) > 30 then raise exception 'El nombre de quien recibe cabe en 30 letras (lleva %)', length(v_nombre); end if;
  if length(v_emp) > 60 then raise exception 'La empresa cabe en 60 letras (lleva %)', length(v_emp); end if;
  if length(v_ref) > 40 then raise exception 'La referencia cabe en 40 letras (lleva %)', length(v_ref); end if;
  if v_correo is not null and v_correo !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Ese correo no parece válido'; end if;

  v_texto := concat_ws(E'\n', v_calle, concat_ws(', ', 'Col. ' || v_col, v_cp || ' ' || v_mun, v_estado), v_ref);
  update envios set dest_cp = v_cp, dest_estado = v_estado, dest_municipio = v_mun, dest_colonia = v_col, dest_calle = v_calle,
    dest_referencia = v_ref, dest_empresa = v_emp, dest_correo = v_correo, destinatario = v_nombre, telefono = v_tel, destino = v_texto,
    -- Otra dirección es otra cotización: la anterior ya no sirve para generar.
    skydropx_cotizacion_id = case when (e.dest_cp, e.dest_municipio, e.dest_colonia) is distinct from (v_cp, v_mun, v_col) then null else e.skydropx_cotizacion_id end
  where id = p_envio;
  if (e.dest_cp, e.dest_calle, e.dest_colonia) is distinct from (v_cp, v_calle, v_col) then
    insert into eventos_envio (envio_id, tipo, nota) values (p_envio, 'cambio', 'Destino: ' || v_cp || ' ' || v_mun || ', ' || v_estado);
  end if;

  -- La próxima vez que se le mande a este contacto, ya sale llena.
  if e.contacto_id is not null then
    update contactos set domicilio_cp = v_cp, domicilio_estado = v_estado, domicilio_municipio = v_mun, domicilio_colonia = v_col,
      domicilio_calle = v_calle, domicilio_referencia = v_ref, domicilio = v_texto,
      correo = coalesce(correo, v_correo), telefono = coalesce(telefono, v_tel)
    where id = e.contacto_id;
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- Lo que registra la función de borde, siempre con la sesión de quien dio el clic.
-- -----------------------------------------------------------------------------
create or replace function public.registrar_cotizacion_skydropx(p_envio uuid, p_cotizacion text)
returns void language plpgsql security definer set search_path = public as $$
declare e envios;
begin
  if not puede('envios', 2) then raise exception 'Sin permiso para cotizar envíos' using errcode = '42501'; end if;
  select * into e from envios where id = p_envio for update;
  if e.id is null or not envio_visible(p_envio) then raise exception 'No existe el envío' using errcode = '42501'; end if;
  if e.numero_guia is not null then raise exception '% ya tiene guía', e.folio; end if;
  update envios set skydropx_cotizacion_id = nullif(trim(p_cotizacion), '') where id = p_envio;
end $$;

-- Skydropx aceptó la guía (y la cobró) pero el PDF todavía no sale: se apunta ya, para que
-- un segundo clic revise esa misma en vez de pagar otra. Con null se suelta (Skydropx la
-- rechazó y no la cobró), con el motivo en la historia.
create or replace function public.registrar_envio_skydropx(p_envio uuid, p_envio_skydropx text, p_nota text default null, p_servicio text default null)
returns void language plpgsql security definer set search_path = public as $$
declare e envios;
begin
  if not puede('envios', 2) then raise exception 'Sin permiso para registrar guías' using errcode = '42501'; end if;
  select * into e from envios where id = p_envio for update;
  if e.id is null or not envio_visible(p_envio) then raise exception 'No existe el envío' using errcode = '42501'; end if;
  if e.numero_guia is not null then raise exception '% ya tiene guía', e.folio; end if;
  if p_envio_skydropx is not null and e.skydropx_envio_id is not null and e.skydropx_envio_id <> p_envio_skydropx then
    raise exception '% ya tiene una guía pedida a Skydropx: revísala antes de pedir otra', e.folio;
  end if;
  -- El servicio elegido se apunta ya: si el PDF tarda, "revisar" ya no tiene la tarifa a la mano.
  update envios set skydropx_envio_id = nullif(trim(p_envio_skydropx), ''), servicio = coalesce(nullif(trim(p_servicio), ''), servicio) where id = p_envio;
  if p_envio_skydropx is null and e.skydropx_envio_id is not null or nullif(trim(p_nota), '') is not null then
    insert into eventos_envio (envio_id, tipo, nota) values (p_envio, 'cambio',
      concat_ws(' · ', case when p_envio_skydropx is null then 'Skydropx no generó la guía' else 'Guía pedida a Skydropx' end, nullif(trim(p_nota), '')));
  end if;
end $$;

-- La guía lista: número, PDF(s), costo y rastreo. Reutiliza registrar_guia para que el
-- estado, el saldo y el aviso de saldo bajo sean los de siempre. Un envío de varios bultos
-- trae una etiqueta por bulto: la primera es "la guía" y las demás se suman como archivos.
create or replace function public.registrar_guia_skydropx(p_envio uuid, p_envio_skydropx text, p_numero text, p_rutas text[],
  p_costo numeric, p_servicio text, p_rastreo_url text default null)
returns void language plpgsql security definer set search_path = public as $$
declare e envios; v_paq int; r text;
begin
  if not puede('envios', 2) then raise exception 'Sin permiso para registrar guías' using errcode = '42501'; end if;
  select * into e from envios where id = p_envio for update;
  if e.id is null or not envio_visible(p_envio) then raise exception 'No existe el envío' using errcode = '42501'; end if;
  if e.tipo <> 'paqueteria' then raise exception '%: Skydropx solo genera guías de paquetería', nombre_tipo_envio(e.tipo); end if;
  if nullif(trim(p_envio_skydropx), '') is null then raise exception 'Falta el envío de Skydropx'; end if;
  if e.skydropx_envio_id is not null and e.skydropx_envio_id <> p_envio_skydropx then
    raise exception '% tiene otra guía pedida a Skydropx', e.folio;
  end if;
  if coalesce(cardinality(p_rutas), 0) = 0 then raise exception 'Falta el PDF de la guía'; end if;
  select id into v_paq from paqueterias where nombre = 'Skydropx';
  update envios set skydropx_envio_id = p_envio_skydropx, rastreo_url = nullif(trim(p_rastreo_url), ''),
    servicio = coalesce(nullif(trim(p_servicio), ''), servicio)
  where id = p_envio;
  perform registrar_guia(p_envio, p_numero, p_rutas[1], p_costo, v_paq);
  foreach r in array p_rutas[2:] loop
    perform agregar_archivo_envio(r, 'guia', p_envio);
  end loop;
end $$;

-- Configuración: la dirección de origen, la carta porte y el empaque los decide quien
-- administra envíos (o dirección), no cualquiera que genere guías.
create or replace function public.fijar_config_skydropx(p_datos jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare v jsonb; v_cp text := nullif(trim(p_datos->>'carta_porte'), '');
begin
  if not puede('envios', 3) then raise exception 'La configuración de Skydropx es de quien administra envíos' using errcode = '42501'; end if;
  if v_cp is not null and v_cp !~ '^\d{8}$' then raise exception 'La clave de carta porte son 8 números (catálogo del SAT)'; end if;
  if p_datos ? 'formato' and p_datos->>'formato' not in ('standard', 'thermal') then raise exception 'Formato no válido'; end if;
  -- Bloquea antes de leer: cada cambio de configuración recalcula costos (segundos), y dos
  -- clics seguidos (origen, luego carta porte) leían la misma versión y el segundo borraba el primero.
  select valor into v from configuracion where clave = 'skydropx' for update;
  v := coalesce(v, '{}'::jsonb) || jsonb_strip_nulls(jsonb_build_object(
    'origen_plantilla_id', p_datos->'origen_plantilla_id', 'origen', p_datos->'origen',
    'carta_porte', to_jsonb(v_cp), 'tipo_empaque', to_jsonb(nullif(trim(p_datos->>'tipo_empaque'), '')),
    'formato', p_datos->'formato'));
  insert into configuracion (clave, valor) values ('skydropx', v)
  on conflict (clave) do update set valor = excluded.valor, actualizado_en = now();
end $$;

revoke execute on function public.guardar_destino_envio(uuid, jsonb), public.registrar_cotizacion_skydropx(uuid, text),
  public.registrar_envio_skydropx(uuid, text, text, text), public.registrar_guia_skydropx(uuid, text, text, text[], numeric, text, text),
  public.fijar_config_skydropx(jsonb), public.destino_envio(uuid) from public, anon;
grant execute on function public.guardar_destino_envio(uuid, jsonb), public.registrar_cotizacion_skydropx(uuid, text),
  public.registrar_envio_skydropx(uuid, text, text, text), public.registrar_guia_skydropx(uuid, text, text, text[], numeric, text, text),
  public.fijar_config_skydropx(jsonb), public.destino_envio(uuid) to authenticated;

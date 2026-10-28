-- =============================================================================
-- Retirar una foto de evidencia sin borrarla.
--
-- Noemí (almacén) subió a ENV-2026-00010 una foto que no era de ese paquete y pidió quitarla. La
-- evidencia de envíos y devoluciones no se cambia ni se borra (083): es la prueba ante Mercado
-- Libre o el cliente si dice «llegó incompleto», y si se pudiera borrar dejaría de probar nada.
-- Retirar no la borra: la foto y su archivo se quedan; se anota aparte qué foto se retiró, por
-- qué, quién y cuándo, y la historia del envío lo dice. Deja de contar como evidencia y la
-- pantalla la enseña aparte, como «retirada», a quien ve el envío.
--
-- Reglas:
--  · Con motivo (5 letras o más), y una vez retirada se queda así (también solo se agrega).
--  · Almacén la retira mientras la caja no sale (envío) o la devolución sigue abierta; después,
--    solo la gerencia (envíos nivel 3): una vez en camino, la foto ya es la prueba.
--  · Ya empacado, no se deja el envío sin ninguna foto de empaque: se sube primero la correcta.
--    Por eso, ya empacado y mientras no salga, almacén puede agregar fotos de empaque (la
--    historia dice que fue después de empacar).
--  · La guía no se retira: se reemplaza registrando otra.
-- =============================================================================

create table if not exists public.evidencias_retiradas (
  evidencia_id uuid primary key references public.evidencias_envio(id) on delete cascade,
  motivo text not null check (length(trim(motivo)) >= 5),
  retirada_por uuid default auth.uid() references public.perfiles(id),
  en timestamptz not null default now()
);
alter table public.evidencias_retiradas enable row level security;
-- La ve quien ve la foto (la RLS de evidencias_envio filtra la subconsulta); nadie la escribe
-- directo, solo retirar_evidencia().
drop policy if exists ver on public.evidencias_retiradas;
create policy ver on public.evidencias_retiradas for select to authenticated using (
  evidencia_id in (select v.id from evidencias_envio v));
revoke insert, update, delete on public.evidencias_retiradas from anon, authenticated;
drop trigger if exists inalterable on public.evidencias_retiradas;
create trigger inalterable before update or delete on public.evidencias_retiradas for each row execute function public.evidencia_inalterable();

create or replace function public.retirar_evidencia(p_evidencia uuid, p_motivo text) returns void
language plpgsql security definer set search_path = public as $$
declare v evidencias_envio; e envios; d devoluciones; v_quedan int;
begin
  if not puede('envios', 2) then raise exception 'Sin permiso para retirar evidencia' using errcode = '42501'; end if;
  select * into v from evidencias_envio where id = p_evidencia;
  if v.id is null then raise exception 'No existe esa foto'; end if;
  if v.envio_id is not null and not envio_visible(v.envio_id) then raise exception 'No existe esa foto' using errcode = '42501'; end if;
  if v.devolucion_id is not null and not devolucion_visible(v.devolucion_id) then raise exception 'No existe esa foto' using errcode = '42501'; end if;
  if v.tipo = 'guia' then raise exception 'La guía no se retira: registra la correcta y queda la última'; end if;
  if not puede('envios', 3) and not puede('inventario', 2) then
    raise exception 'Las fotos las retira almacén, que es quien las toma' using errcode = '42501';
  end if;
  if exists (select 1 from evidencias_retiradas where evidencia_id = v.id) then raise exception 'Esa foto ya está retirada'; end if;
  if coalesce(length(trim(p_motivo)), 0) < 5 then raise exception 'Escribe por qué se retira (por ejemplo, «era de otro paquete»)'; end if;

  if v.envio_id is not null then
    select * into e from envios where id = v.envio_id for update;
    -- Ya en camino o entregado, la foto es la prueba: solo la gerencia la retira.
    if (e.enviado_en is not null or e.estado in ('enviado', 'entregado')) and not puede('envios', 3) then
      raise exception '% ya salió: una foto de su evidencia solo la retira la gerencia', e.folio using errcode = '42501';
    end if;
    if v.tipo = 'empaque' and e.empacado_en is not null then
      select count(*) into v_quedan from evidencias_envio x
      where x.envio_id = e.id and x.tipo = 'empaque' and x.id <> v.id and x.id not in (select evidencia_id from evidencias_retiradas);
      if v_quedan = 0 then
        raise exception '% ya se empacó y es su única foto de empaque: sube primero la correcta y luego retira esta', e.folio;
      end if;
    end if;
    insert into evidencias_retiradas (evidencia_id, motivo) values (v.id, trim(p_motivo));
    insert into eventos_envio (envio_id, tipo, nota) values (e.id, 'foto_retirada',
      format('Retiró una foto de %s (subida %s): %s', v.tipo, to_char(v.en at time zone 'America/Mexico_City', 'DD-MM HH24:MI'), trim(p_motivo)));
  else
    select * into d from devoluciones where id = v.devolucion_id for update;
    if d.estado in ('resuelta', 'cancelada') and not puede('envios', 3) then
      raise exception '% ya está %: una foto de su evidencia solo la retira la gerencia', d.folio, d.estado using errcode = '42501';
    end if;
    if v.tipo = 'recepcion' and d.estado <> 'abierta' then
      select count(*) into v_quedan from evidencias_envio x
      where x.devolucion_id = d.id and x.tipo = 'recepcion' and x.id <> v.id and x.id not in (select evidencia_id from evidencias_retiradas);
      if v_quedan = 0 then
        raise exception '% ya se recibió y es su única foto de cómo llegó: sube primero la correcta', d.folio;
      end if;
    end if;
    insert into evidencias_retiradas (evidencia_id, motivo) values (v.id, trim(p_motivo));
    insert into eventos_envio (devolucion_id, tipo, nota) values (d.id, 'foto_retirada',
      format('Retiró una foto de %s (subida %s): %s', v.tipo, to_char(v.en at time zone 'America/Mexico_City', 'DD-MM HH24:MI'), trim(p_motivo)));
  end if;
end $$;
revoke execute on function public.retirar_evidencia(uuid, text) from public, anon;
grant execute on function public.retirar_evidencia(uuid, text) to authenticated;

-- Subir: lo retirado no cuenta para el tope, y ya empacado se puede agregar mientras no salga.
create or replace function public.agregar_archivo_envio(p_ruta text, p_tipo text, p_envio uuid default null,
  p_devolucion uuid default null, p_nota text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare v uuid; v_prefijo text; e envios; d devoluciones; v_max int;
begin
  if not puede('envios', 2) then raise exception 'Sin permiso para subir archivos' using errcode = '42501'; end if;
  if num_nonnulls(p_envio, p_devolucion) <> 1 then raise exception 'El archivo va en un envío o en una devolución'; end if;
  if p_envio is not null then
    select * into e from envios where id = p_envio for update;
    if e.id is null or not envio_visible(p_envio) then raise exception 'No existe el envío' using errcode = '42501'; end if;
    if p_tipo not in ('empaque', 'guia', 'entrega', 'documento') then raise exception 'Tipo de archivo no válido para un envío'; end if;
    if p_tipo = 'empaque' then
      if not puede('inventario', 2) then raise exception 'Las fotos de empaque las toma almacén' using errcode = '42501'; end if;
      -- Ya empacado, todavía se puede agregar (reemplazar una foto retirada) mientras no salga:
      -- la caja sigue en el almacén. Ya en camino, la evidencia de salida queda cerrada.
      if e.enviado_en is not null or e.estado in ('enviado', 'entregado') then
        raise exception '% ya salió: su evidencia de empaque quedó cerrada', e.folio;
      end if;
      if e.estado = 'cancelado' then raise exception 'El envío % está cancelado', e.folio; end if;
      v_max := coalesce((select (valor->>'max_fotos')::int from configuracion where clave = 'envios'), 6);
      if (select count(*) from evidencias_envio where envio_id = p_envio and tipo = 'empaque' and id not in (select evidencia_id from evidencias_retiradas)) >= v_max then
        raise exception 'Ya hay % fotos de empaque: con eso basta', v_max;
      end if;
    end if;
    v_prefijo := 'envios/' || p_envio || '/';
  else
    select * into d from devoluciones where id = p_devolucion for update;
    if d.id is null or not devolucion_visible(p_devolucion) then raise exception 'No existe la devolución' using errcode = '42501'; end if;
    if p_tipo not in ('recepcion', 'documento') then raise exception 'Tipo de archivo no válido para una devolución'; end if;
    if p_tipo = 'recepcion' then
      if not puede('inventario', 2) then raise exception 'Las fotos al recibir las toma almacén' using errcode = '42501'; end if;
      if d.estado in ('resuelta', 'cancelada') then raise exception '% ya está %', d.folio, d.estado; end if;
    end if;
    v_prefijo := 'devoluciones/' || p_devolucion || '/';
  end if;
  if p_ruta is null or left(p_ruta, length(v_prefijo)) <> v_prefijo then raise exception 'El archivo no está en la carpeta de este registro'; end if;
  if not exists (select 1 from storage.objects o where o.bucket_id = 'envios' and o.name = p_ruta) then
    raise exception 'El archivo no se subió completo; vuelve a intentarlo';
  end if;
  insert into evidencias_envio (envio_id, devolucion_id, tipo, ruta, nota)
  values (p_envio, p_devolucion, p_tipo, p_ruta, nullif(trim(p_nota), ''))
  returning id into v;
  if p_tipo = 'empaque' and e.empacado_en is not null then
    insert into eventos_envio (envio_id, tipo, nota) values (p_envio, 'foto_agregada', 'Foto de empaque agregada después de empacar');
  end if;
  return v;
end $$;

-- Empacar y recibir una devolución piden al menos una foto que no esté retirada.
create or replace function public.marcar_empacado(p_envio uuid, p_checklist int[] default '{}', p_series jsonb default '{}',
  p_bultos jsonb default null) returns void
language plpgsql security definer set search_path = public as $$
declare
  e envios; l record; v_faltan text; v_items jsonb; v_equipo boolean; v_comp boolean; v_fotos int; v_prob text;
  v_series text[]; v_esperadas text[]; v_ops int; v_sin_serie text; v_pend text; v_s text; v_otro text;
begin
  if not (puede('envios', 2) and puede('inventario', 2)) then
    raise exception 'Empacar es de almacén: es quien ve lo que va en la caja' using errcode = '42501';
  end if;
  select * into e from envios where id = p_envio for update;
  if e.id is null or not envio_visible(p_envio) then raise exception 'No existe el envío' using errcode = '42501'; end if;
  if e.tipo not in ('paqueteria', 'flete', 'recoge', 'a_full') then
    raise exception '%: este envío no lo empaca almacén', nombre_tipo_envio(e.tipo);
  end if;
  if e.empacado_en is not null then raise exception '% ya está empacado: su evidencia no se cambia', e.folio; end if;
  if e.estado not in ('solicitado', 'cotizado', 'guia_lista') then raise exception 'El envío % ya está %', e.folio, e.estado; end if;

  -- 1. Foto.
  select count(*) into v_fotos from evidencias_envio where envio_id = p_envio and tipo = 'empaque' and id not in (select evidencia_id from evidencias_retiradas);
  if v_fotos = 0 then
    raise exception 'Toma al menos una foto del paquete antes de cerrarlo: es la prueba si llega un reclamo de "llegó incompleto"';
  end if;

  -- 2. Check list (el de equipo, el de componentes o los dos), completo.
  select coalesce(bool_or(a.tipo in ('equipo', 'subensamble')), false),
         coalesce(bool_or(a.tipo is null or a.tipo not in ('equipo', 'subensamble')), false)
    into v_equipo, v_comp
  from envio_lineas el left join articulos a on a.id = el.articulo_id where el.envio_id = p_envio;
  select string_agg(c.texto, '; ' order by case c.aplica when 'equipo' then 0 when 'componente' then 1 else 2 end, c.orden) into v_faltan
  from checklist_salida c
  where c.activo and (c.aplica = 'todos' or (c.aplica = 'equipo' and v_equipo) or (c.aplica = 'componente' and v_comp))
    and not (c.id = any(coalesce(p_checklist, '{}')));
  if v_faltan is not null then raise exception 'Falta palomear: %', v_faltan; end if;
  select jsonb_agg(jsonb_build_object('id', c.id, 'aplica', c.aplica, 'texto', c.texto)
                   order by case c.aplica when 'equipo' then 0 when 'componente' then 1 else 2 end, c.orden) into v_items
  from checklist_salida c
  where c.activo and (c.aplica = 'todos' or (c.aplica = 'equipo' and v_equipo) or (c.aplica = 'componente' and v_comp));

  -- 3. Números de serie de cada equipo, contra su orden de producción.
  for l in select el.id, el.cantidad, el.pedido_linea_id, el.articulo_id, coalesce(a.nombre, el.descripcion) nombre
           from envio_lineas el join articulos a on a.id = el.articulo_id
           where el.envio_id = p_envio and a.tipo in ('equipo', 'subensamble') order by el.orden loop
    select coalesce(array_agg(distinct upper(trim(x))) filter (where nullif(trim(x), '') is not null), '{}') into v_series
    from jsonb_array_elements_text(case when jsonb_typeof(p_series -> l.id::text) = 'array' then p_series -> l.id::text else '[]'::jsonb end) x;
    if cardinality(v_series) <> ceil(l.cantidad) then
      raise exception 'Escribe el número de serie de % (% %): el de la placa del equipo', l.nombre, ceil(l.cantidad),
        case when ceil(l.cantidad) = 1 then 'equipo' else 'equipos, uno por equipo' end;
    end if;
    select count(*), array_agg(upper(trim(o.numero_serie))) filter (where nullif(trim(o.numero_serie), '') is not null),
           string_agg(o.folio, ', ') filter (where nullif(trim(o.numero_serie), '') is null),
           string_agg(o.folio, ', ') filter (where o.estado not in ('terminada', 'entregada'))
      into v_ops, v_esperadas, v_sin_serie, v_pend
    from ordenes_de_partida(e.pedido_id, l.pedido_linea_id, l.articulo_id) o;
    if v_ops > 0 then
      if v_pend is not null then raise exception 'La orden % todavía no se termina: el equipo no se empaca', v_pend; end if;
      if v_esperadas is null then
        raise exception 'La orden % no tiene número de serie: que producción lo capture antes de empacar', v_sin_serie;
      end if;
      foreach v_s in array v_series loop
        if not v_s = any(v_esperadas) then
          raise exception 'La serie % no es la de la orden de producción (%): revisa la placa', v_s, array_to_string(v_esperadas, ', ');
        end if;
      end loop;
    end if;
    -- La misma placa no puede salir dos veces.
    select y.folio into v_otro from envio_lineas x join envios y on y.id = x.envio_id
    where y.id <> p_envio and y.estado <> 'cancelado' and x.series && v_series limit 1;
    if v_otro is not null then raise exception 'Ese número de serie ya salió con %', v_otro; end if;
    update envio_lineas set series = v_series where id = l.id;
  end loop;

  -- 4. Bultos pesados y medidos (para la guía y para el próximo envío).
  if p_bultos is not null then perform reemplazar_bultos(p_envio, p_bultos); end if;
  if e.tipo in ('paqueteria', 'a_full') then
    if not exists (select 1 from envio_bultos b where b.envio_id = p_envio) then
      raise exception 'Agrega los bultos con su peso y medidas';
    end if;
    if exists (select 1 from envio_bultos b where b.envio_id = p_envio
               and (b.peso_kg is null or b.largo_cm is null or b.ancho_cm is null or b.alto_cm is null)) then
      raise exception 'Pesa y mide cada bulto: con eso sale la guía y nadie lo vuelve a preguntar';
    end if;
  end if;

  -- 5. Que haya de dónde sacarlo, antes de que el paquete esté en el camión.
  select string_agg(p.problema, ' · ') into v_prob from _plan_salida_envio(p_envio) p where p.problema is not null;
  if v_prob is not null then raise exception '%', v_prob; end if;

  update envios set checklist = coalesce(v_items, '[]'::jsonb), empacado_por = auth.uid(), empacado_en = now(), estado = 'empacado'
  where id = p_envio;
  insert into eventos_envio (envio_id, tipo, nota) values (p_envio, 'empacado',
    format('%s foto(s) · %s bulto(s)%s', v_fotos, (select count(*) from envio_bultos where envio_id = p_envio),
           coalesce(' · serie ' || (select string_agg(array_to_string(series, ', '), ', ') from envio_lineas
                                    where envio_id = p_envio and cardinality(series) > 0), '')));
end $$;

create or replace function public.recibir_devolucion(p_dev uuid, p_lineas jsonb default null, p_nota text default null) returns void
language plpgsql security definer set search_path = public as $$
declare d devoluciones; l record; v_cant numeric;
begin
  if not (puede('envios', 2) and puede('inventario', 2)) then
    raise exception 'La devolución la recibe almacén' using errcode = '42501';
  end if;
  select * into d from devoluciones where id = p_dev for update;
  if d.id is null or not devolucion_visible(p_dev) then raise exception 'No existe la devolución' using errcode = '42501'; end if;
  if d.tipo <> 'devolucion' then raise exception '% no es una devolución', d.folio; end if;
  if d.estado <> 'abierta' then raise exception 'La devolución % ya está %', d.folio, d.estado; end if;
  if not exists (select 1 from evidencias_envio where devolucion_id = p_dev and tipo = 'recepcion' and id not in (select evidencia_id from evidencias_retiradas)) then
    raise exception 'Toma al menos una foto de cómo llegó, antes de abrirla: es la prueba ante Mercado Libre o la paquetería';
  end if;
  for l in select * from devolucion_lineas where devolucion_id = p_dev loop
    v_cant := l.cantidad;
    if p_lineas is not null then
      select (x->>'cantidad_recibida')::numeric into v_cant from jsonb_array_elements(p_lineas) x where (x->>'linea_id')::uuid = l.id;
      v_cant := coalesce(v_cant, 0);
    end if;
    if v_cant < 0 or v_cant > l.cantidad then raise exception 'De "%" se esperaban %: no se pueden recibir %', l.descripcion, l.cantidad::float8, v_cant::float8; end if;
    update devolucion_lineas set cantidad_recibida = v_cant where id = l.id;
  end loop;
  update devoluciones set estado = 'recibida', recibido_por = auth.uid(), recibido_en = now(), nota_recepcion = nullif(trim(p_nota), '')
  where id = p_dev;
  insert into eventos_envio (devolucion_id, tipo, nota) values (p_dev, 'recibida',
    concat_ws(' · ', (select string_agg(format('%s de %s %s', cantidad_recibida::float8, cantidad::float8, descripcion), '; ')
                      from devolucion_lineas where devolucion_id = p_dev), nullif(trim(p_nota), '')));
end $$;

-- Las fotos que cuentan en las listas son las que no se retiraron (mismo cuerpo que en 147).
create or replace view public.v_envios with (security_invoker = true) as
SELECT e.id,
    e.folio,
    e.pedido_id,
    p.folio AS pedido_folio,
    p.canal,
    p.id_externo,
    p.cliente_id,
    c.nombre AS cliente,
    p.vendedor_id,
    pv.nombre AS vendedor,
    e.tipo,
    nombre_tipo_envio(e.tipo) AS tipo_nombre,
    e.estado,
    e.paqueteria_id,
    q.nombre AS paqueteria,
    q.usa_saldo,
    e.servicio,
    e.contacto_id,
    e.destinatario,
    e.telefono,
    e.destino,
    e.fecha_recoleccion,
    e.notas,
    e.costo_cotizado,
    e.costo_real,
    e.numero_guia,
    e.solicitado_por,
    sp.nombre AS solicitado_por_nombre,
    e.solicitado_en,
    e.cotizado_por,
    cp.nombre AS cotizado_por_nombre,
    e.cotizado_en,
    e.guia_por,
    gp.nombre AS guia_por_nombre,
    e.guia_en,
    e.empacado_por,
    ep.nombre AS empacado_por_nombre,
    e.empacado_en,
    e.checklist,
    e.enviado_por,
    np.nombre AS enviado_por_nombre,
    e.enviado_en,
    e.entregado_por,
    dp.nombre AS entregado_por_nombre,
    e.entregado_en,
    e.recibio,
    e.cancelado_por,
    xp.nombre AS cancelado_por_nombre,
    e.cancelado_en,
    e.motivo_cancelacion,
    e.guia_reembolsada,
    e.inventario_descontado_en,
    b.bultos,
    b.peso_total,
    b.peso_volumetrico,
    b.sin_medidas,
    l.partidas,
    l.piezas,
    l.resumen,
    l.lleva_equipo,
    (( SELECT count(*) AS count
           FROM evidencias_envio v
          WHERE v.envio_id = e.id AND v.tipo = 'empaque'::text AND NOT (v.id IN ( SELECT evidencias_retiradas.evidencia_id FROM evidencias_retiradas))))::integer AS fotos,
    ( SELECT v.ruta
           FROM evidencias_envio v
          WHERE v.envio_id = e.id AND v.tipo = 'guia'::text
          ORDER BY v.en DESC
         LIMIT 1) AS guia_ruta,
    e.estado <> ALL (ARRAY['enviado'::text, 'entregado'::text, 'cancelado'::text]) AS abierto,
    e.tipo = ANY (ARRAY['paqueteria'::text, 'flete'::text, 'recoge'::text, 'a_full'::text]) AS lleva_empaque,
    (e.estado <> ALL (ARRAY['enviado'::text, 'entregado'::text, 'cancelado'::text])) AND (e.tipo = ANY (ARRAY['paqueteria'::text, 'flete'::text])) AND e.guia_en IS NULL AS falta_guia,
    (e.estado <> ALL (ARRAY['enviado'::text, 'entregado'::text, 'cancelado'::text])) AND (e.tipo = ANY (ARRAY['paqueteria'::text, 'flete'::text, 'recoge'::text, 'a_full'::text])) AND e.empacado_en IS NULL AS falta_empaque,
    (e.estado <> ALL (ARRAY['enviado'::text, 'entregado'::text, 'cancelado'::text])) AND (e.empacado_en IS NOT NULL OR (e.tipo = ANY (ARRAY['full'::text, 'proveedor'::text]))) AND NOT (e.tipo = 'paqueteria'::text AND e.numero_guia IS NULL) AS listo_para_salir,
    hoy_planta() - (e.solicitado_en AT TIME ZONE 'America/Mexico_City'::text)::date AS dias_desde_solicitud,
        CASE
            WHEN e.estado = 'enviado'::text THEN hoy_planta() - (e.enviado_en AT TIME ZONE 'America/Mexico_City'::text)::date
            ELSE NULL::integer
        END AS dias_en_camino,
    e.actualizado_en,
    e.dest_cp,
    e.dest_estado,
    e.dest_municipio,
    e.dest_colonia,
    e.dest_calle,
    e.dest_referencia,
    e.dest_empresa,
    e.dest_correo,
    e.skydropx_cotizacion_id,
    e.skydropx_envio_id,
    e.rastreo_url
   FROM envios e
     LEFT JOIN pedidos_basicos() p ON p.id = e.pedido_id
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
     LEFT JOIN LATERAL ( SELECT count(*)::integer AS bultos,
            sum(x.peso_kg) AS peso_total,
            round(sum(x.largo_cm * x.ancho_cm * x.alto_cm / 5000.0), 2) AS peso_volumetrico,
            count(*) FILTER (WHERE x.peso_kg IS NULL OR x.largo_cm IS NULL OR x.ancho_cm IS NULL OR x.alto_cm IS NULL)::integer AS sin_medidas
           FROM envio_bultos x
          WHERE x.envio_id = e.id) b ON true
     LEFT JOIN LATERAL ( SELECT count(*)::integer AS partidas,
            sum(x.cantidad) AS piezas,
            string_agg(format('%s × %s'::text, x.cantidad::double precision, x.descripcion), '; '::text ORDER BY x.orden) AS resumen,
            COALESCE(bool_or(a.tipo = ANY (ARRAY['equipo'::tipo_articulo, 'subensamble'::tipo_articulo])), false) AS lleva_equipo
           FROM envio_lineas x
             LEFT JOIN articulos a ON a.id = x.articulo_id
          WHERE x.envio_id = e.id) l ON true;

create or replace view public.v_devoluciones with (security_invoker = true) as
SELECT d.id,
    d.folio,
    d.pedido_id,
    p.folio AS pedido_folio,
    p.canal,
    p.id_externo,
    p.cliente_id,
    c.nombre AS cliente,
    p.vendedor_id,
    pv.nombre AS vendedor,
    d.envio_id,
    e.folio AS envio_folio,
    e.numero_guia,
    q.nombre AS paqueteria,
    d.tipo,
    d.estado,
    d.codigo_autorizacion,
    d.motivo,
    d.fecha_esperada,
    d.fecha_limite,
    d.responsable_id,
    r.nombre AS responsable,
    d.respuesta,
    d.respondido_en,
    rp.nombre AS respondido_por_nombre,
    d.recibido_en,
    rc.nombre AS recibido_por_nombre,
    d.nota_recepcion,
    d.resultado,
    d.almacen_id,
    al.nombre AS almacen,
    d.reclamo_transportista,
    d.monto_reclamado,
    d.nota_resolucion,
    d.resuelto_en,
    rs.nombre AS resuelto_por_nombre,
    d.reingresado_en,
    d.cancelado_en,
    d.motivo_cancelacion,
    d.creado_por,
    cr.nombre AS creado_por_nombre,
    d.creado_en,
    ( SELECT string_agg(format('%s × %s'::text, x.cantidad::double precision, x.descripcion), '; '::text) AS string_agg
           FROM devolucion_lineas x
          WHERE x.devolucion_id = d.id) AS resumen,
    (( SELECT count(*) AS count
           FROM evidencias_envio v
          WHERE v.devolucion_id = d.id AND NOT (v.id IN ( SELECT evidencias_retiradas.evidencia_id FROM evidencias_retiradas))))::integer AS fotos,
    d.estado <> ALL (ARRAY['resuelta'::text, 'cancelada'::text]) AS abierta,
        CASE
            WHEN d.tipo = 'reclamo'::text AND d.estado = 'abierta'::text THEN d.fecha_limite
            WHEN d.tipo = 'devolucion'::text AND d.estado = 'abierta'::text AND d.fecha_esperada IS NOT NULL THEN ((d.fecha_esperada + '18:00:00'::time without time zone) AT TIME ZONE 'America/Mexico_City'::text)
            WHEN d.tipo = 'cancelacion'::text AND d.estado = 'abierta'::text THEN d.fecha_limite
            ELSE NULL::timestamp with time zone
        END AS vence,
    d.tipo = 'reclamo'::text AND d.estado = 'abierta'::text AND d.fecha_limite < now() OR d.tipo = 'devolucion'::text AND d.estado = 'abierta'::text AND d.fecha_esperada < hoy_planta() AS vencida,
    d.actualizado_en
   FROM devoluciones d
     JOIN pedidos_basicos() p ON p.id = d.pedido_id
     LEFT JOIN clientes c ON c.id = p.cliente_id
     LEFT JOIN perfiles pv ON pv.id = p.vendedor_id
     LEFT JOIN envios e ON e.id = d.envio_id
     LEFT JOIN paqueterias q ON q.id = e.paqueteria_id
     LEFT JOIN perfiles r ON r.id = d.responsable_id
     LEFT JOIN perfiles rp ON rp.id = d.respondido_por
     LEFT JOIN perfiles rc ON rc.id = d.recibido_por
     LEFT JOIN perfiles rs ON rs.id = d.resuelto_por
     LEFT JOIN perfiles cr ON cr.id = d.creado_por
     LEFT JOIN almacenes al ON al.id = d.almacen_id;

-- La foto dice si se retiró, por qué, quién y cuándo (columnas nuevas al final).
create or replace view public.v_evidencias_envio with (security_invoker = true) as
select v.id, v.envio_id, v.devolucion_id, v.tipo, v.ruta, v.nota, v.subido_por, p.nombre as subido_por_nombre, v.en,
  r.evidencia_id is not null as retirada, r.motivo as motivo_retiro, rp.nombre as retirada_por_nombre, r.en as retirada_en
from public.evidencias_envio v left join public.perfiles p on p.id = v.subido_por
left join public.evidencias_retiradas r on r.evidencia_id = v.id
left join public.perfiles rp on rp.id = r.retirada_por;

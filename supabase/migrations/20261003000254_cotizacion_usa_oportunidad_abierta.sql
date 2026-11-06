-- =============================================================================
-- La cotización usa la oportunidad que ya tenía el cliente en vez de abrir otra.
--
-- Al convertir un lead nace su oportunidad en «Contactado» (convertir_lead, 214). El vendedor
-- cotiza desde la ficha del cliente, que solo pasa ?cliente=, y al enviar trg_cotizacion (099)
-- abría OTRA oportunidad porque la cotización no traía ninguna. Del 22 oct al 6 nov eso dejó 100
-- oportunidades de lead sin cotización con el cliente cotizado en otra (77 abiertas y 23 ya
-- perdidas), y de las 295 oportunidades que abrió el disparador en 30 días, 109 debieron ir a la
-- del lead. Efectos: el embudo cuenta doble, recepción ve «Contactado» en un lead que ya se cotizó
-- y no se puede medir qué fuente vende.
--
-- 1. oportunidad_para_cotizar(): la abierta más reciente del mismo cliente y vendedor que todavía
--    no se cotiza (prospecto o contactado), y la que vino de un lead antes que ninguna. Se usa al
--    crear la cotización, al cambiarle el cliente y, por si apareció después, al enviarla.
-- 2. cotizaciones.oportunidad_nueva: el vendedor dijo «es otro proyecto». Sin esto, ligar sola
--    sería una trampa: no habría forma de abrir otra a propósito.
-- 3. Una cotización solo se liga a una oportunidad del mismo cliente y del mismo vendedor (la
--    gerencia sí puede cruzarlas). Antes un vendedor podía colgar su cotización de la oportunidad
--    de otro por la API y el disparador, que se salta la RLS, se la movía a «Cotizado». En la nube
--    hoy no hay ninguna cruzada (0 de otro cliente, 0 de otro vendedor).
--    Se revisa al ligarla (alta o cambio de oportunidad), no en cada cambio, y una versión nueva
--    hereda la de su familia sin revisarla otra vez.
-- 4. Cambiar el cliente solo suelta la oportunidad antes de enviar la cotización, y juntar_clientes
--    mueve las oportunidades primero: así juntar clientes no deja cotizaciones sin su oportunidad.
-- =============================================================================

alter table public.cotizaciones add column if not exists oportunidad_nueva boolean not null default false;
comment on column public.cotizaciones.oportunidad_nueva is
  'El vendedor dijo que es otro proyecto: al enviarla se abre una oportunidad nueva en vez de ligarla a la abierta del cliente.';

-- Buscar «la del lead» y «¿tiene cotización?» en cada envío: sin índice eran recorridos completos.
create index if not exists leads_oportunidad on public.leads (oportunidad_id) where oportunidad_id is not null;
create index if not exists cotizaciones_oportunidad on public.cotizaciones (oportunidad_id) where oportunidad_id is not null;

-- security invoker: desde nueva_cotizacion la RLS ya deja ver solo las del vendedor; desde el
-- disparador (security definer) ve todas, por eso el filtro por vendedor va explícito.
create or replace function public.oportunidad_para_cotizar(p_cliente uuid, p_vendedor uuid) returns uuid
language sql stable security invoker set search_path = public as $$
  select o.id from oportunidades o
  where o.cliente_id = p_cliente and o.vendedor_id = p_vendedor and o.etapa in ('prospecto', 'contactado')
  order by exists (select 1 from leads l where l.oportunidad_id = o.id) desc, o.creado_en desc
  limit 1
$$;
revoke execute on function public.oportunidad_para_cotizar(uuid, uuid) from public, anon;
grant execute on function public.oportunidad_para_cotizar(uuid, uuid) to authenticated;

-- trg_cotizacion de 099 con la oportunidad elegida antes de abrir otra.
create or replace function public.trg_cotizacion() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  -- Sin sesión = migración o script de servicio.
  v_gerente boolean := auth.uid() is null or puede('ventas', 3);
  v_op uuid;
  v_op_cli uuid; v_op_ven uuid;
  -- Antes de enviarla la oportunidad todavía se puede cambiar; ya enviada es historia.
  v_por_enviar boolean := tg_op = 'INSERT' or old.estado in ('borrador', 'por_autorizar', 'autorizada');
begin
  -- Cambiar el cliente de una que no se ha enviado suelta la oportunidad del anterior (antes lo
  -- hacía la pantalla), salvo que esa oportunidad ya sea del cliente nuevo (juntar clientes mueve
  -- las oportunidades antes que las cotizaciones). Ya enviada no se toca: juntar clientes también
  -- les cambia el cliente a enviadas y aceptadas (el 2 nov a 3 en la nube), y soltarla dejaba la
  -- oportunidad en «Cotizado» sin su cotización y la venta aceptada sin oportunidad.
  if tg_op = 'UPDATE' and new.cliente_id is distinct from old.cliente_id
     and new.oportunidad_id is not distinct from old.oportunidad_id and v_por_enviar
     and (select o.cliente_id from oportunidades o where o.id = new.oportunidad_id) is distinct from new.cliente_id then
    new.oportunidad_id := null; new.oportunidad_nueva := false;
  end if;
  if new.oportunidad_id is not null then
    new.oportunidad_nueva := false;
    -- Se revisa al ligarla, no al cambiar otra cosa. Una versión nueva hereda la oportunidad de su
    -- familia: si después se reasignó la cotización o la oportunidad, la versión no se traba.
    if (tg_op = 'INSERT' or new.oportunidad_id is distinct from old.oportunidad_id)
       and not (tg_op = 'INSERT' and new.origen_id is not null and exists (
         select 1 from cotizaciones x where (x.id = new.origen_id or x.origen_id = new.origen_id)
           and x.oportunidad_id = new.oportunidad_id and x.vendedor_id = new.vendedor_id)) then
      select cliente_id, vendedor_id into v_op_cli, v_op_ven from oportunidades where id = new.oportunidad_id;
      if v_op_ven is distinct from new.vendedor_id and not v_gerente then
        raise exception 'Esa oportunidad es de otro vendedor: cotiza en una tuya o pide a la gerencia de ventas que te la pase'
          using errcode = '42501';
      end if;
      if v_op_cli is distinct from new.cliente_id then
        raise exception 'Esa oportunidad es de otro cliente: elige una de este cliente o «Una nueva al enviar»' using errcode = '23514';
      end if;
    end if;
  elsif new.cliente_id is not null and not new.oportunidad_nueva and v_por_enviar
        and (tg_op = 'INSERT' or new.cliente_id is distinct from old.cliente_id) then
    new.oportunidad_id := oportunidad_para_cotizar(new.cliente_id, new.vendedor_id);
  end if;

  if tg_op = 'INSERT' then
    -- Provisional hasta que se capture algo (ver 099); el id ya viene puesto por el default.
    if coalesce(new.folio, '') = '' then new.folio := 'BORRADOR-' || upper(left(replace(new.id::text, '-', ''), 8)); end if;
    -- Nadie crea una cotización "ya autorizada".
    if not v_gerente then
      new.autorizada_por := null; new.autorizada_en := null;
      if new.estado <> 'borrador' then new.estado := 'borrador'; end if;
    end if;
    return new;
  end if;

  -- Salir de borrador (enviarla, pedir autorización) también le da su folio definitivo.
  if old.estado = 'borrador' and new.estado <> 'borrador' and folio_es_provisional(new.folio) then
    new.folio := siguiente_folio('COT');
  end if;

  if new.autorizada_por is distinct from old.autorizada_por and new.autorizada_por is not null and not v_gerente then
    raise exception 'Solo la gerencia de ventas autoriza precios bajo el mínimo' using errcode = '42501';
  end if;
  if new.estado = 'autorizada' and old.estado <> 'autorizada' and not v_gerente then
    raise exception 'Solo la gerencia de ventas autoriza precios bajo el mínimo' using errcode = '42501';
  end if;
  -- Cambiar descuento, tipo de cambio o IVA invalida la autorización anterior.
  if (new.descuento_pct, new.tipo_cambio, new.precios_con_iva, new.tasa_iva)
     is distinct from (old.descuento_pct, old.tipo_cambio, old.precios_con_iva, old.tasa_iva) then
    new.autorizada_por := null; new.autorizada_en := null; new.autorizacion_pedida_en := null;
  end if;

  if new.estado in ('enviada', 'aceptada') and old.estado not in ('enviada', 'aceptada')
     and new.autorizada_por is null and cotizacion_bajo_minimo(new) then
    raise exception 'Esta cotización tiene precios abajo del mínimo: necesita autorización de la gerencia antes de enviarse'
      using errcode = '42501';
  end if;

  if new.estado = 'enviada' and old.estado <> 'enviada' then
    new.enviada_en := coalesce(new.enviada_en, now());
    -- El embudo se llena solo: cotizar ES mover la oportunidad a "cotizado". Primero la que ya
    -- tenía el cliente (la del lead, casi siempre); solo si no hay, o si el vendedor dijo que es
    -- otro proyecto, se abre una (nadie captura dos veces).
    if new.oportunidad_id is null and new.cliente_id is not null and not new.oportunidad_nueva then
      new.oportunidad_id := oportunidad_para_cotizar(new.cliente_id, new.vendedor_id);
    end if;
    if new.oportunidad_id is null and new.cliente_id is not null then
      insert into oportunidades (cliente_id, contacto_id, titulo, etapa, linea, monto_estimado, vendedor_id, fecha_cierre_estimada)
      values (new.cliente_id, new.contacto_id,
              coalesce((select l.titulo from cotizacion_lineas l where l.cotizacion_id = new.id and not l.opcional order by l.orden limit 1),
                       'Cotización ' || new.folio),
              'cotizado',
              coalesce((select linea_de(l.articulo_id) from cotizacion_lineas l where l.cotizacion_id = new.id and not l.opcional
                        order by (linea_de(l.articulo_id) = 'maquinaria') desc, l.orden limit 1), 'maquinaria'),
              round((new.total - new.iva) * new.tipo_cambio, 2), new.vendedor_id, new.fecha + new.vigencia_dias)
      returning id into v_op;
      new.oportunidad_id := v_op;
      new.oportunidad_nueva := false;
    elsif new.oportunidad_id is not null then
      update oportunidades set etapa = 'cotizado', monto_estimado = coalesce(monto_estimado, round((new.total - new.iva) * new.tipo_cambio, 2))
      where id = new.oportunidad_id and etapa in ('prospecto', 'contactado');
    end if;
  end if;

  if new.estado in ('aceptada', 'rechazada', 'cancelada') and old.estado <> new.estado then
    new.cerrada_en := now();
  end if;
  return new;
end $$;

-- nueva_cotizacion de 082 con «es otro proyecto». Cambia la firma: la de dos argumentos se quita
-- para que la API no tenga dos con el mismo nombre.
drop function if exists public.nueva_cotizacion(uuid, uuid);
create function public.nueva_cotizacion(p_cliente uuid default null, p_oportunidad uuid default null, p_oportunidad_nueva boolean default false)
returns uuid language plpgsql security invoker as $$
declare v_id uuid; v_cli uuid := p_cliente; v_nombre text; v_razon text; v_contacto uuid; v_atencion text;
begin
  if not puede('ventas', 2) then raise exception 'Tu rol no puede cotizar' using errcode = '42501'; end if;
  if v_cli is null and p_oportunidad is not null then
    select cliente_id into v_cli from oportunidades where id = p_oportunidad;
    -- La RLS no deja ver la oportunidad de otro vendedor: mejor decirlo que crear una cotización sin cliente.
    if v_cli is null then raise exception 'Esa oportunidad no es tuya o ya no existe' using errcode = '42501'; end if;
  end if;
  select nombre, razon_social into v_nombre, v_razon from clientes where id = v_cli;
  -- Si el cliente es de otro vendedor, la RLS no da el contacto y queda vacío: correcto.
  select id, nombre into v_contacto, v_atencion from contactos where cliente_id = v_cli order by principal desc, creado_en limit 1;
  -- Sin oportunidad, el disparador la liga a la abierta del cliente (o, si es otro proyecto, no).
  insert into cotizaciones (cliente_id, contacto_id, atencion, empresa, oportunidad_id, oportunidad_nueva, condiciones_pago, tiempo_entrega, notas)
  values (v_cli, v_contacto, v_atencion, coalesce(v_razon, v_nombre), p_oportunidad, coalesce(p_oportunidad_nueva, false) and p_oportunidad is null,
    (select texto from textos_comerciales where tipo = 'pago' and activo order by por_defecto desc, orden limit 1),
    (select texto from textos_comerciales where tipo = 'entrega' and activo order by por_defecto desc, orden limit 1),
    coalesce((select array_agg(texto order by orden) from textos_comerciales where tipo = 'nota' and activo and por_defecto), '{}'))
  returning id into v_id;
  return v_id;
end $$;
revoke execute on function public.nueva_cotizacion(uuid, uuid, boolean) from public, anon;
grant execute on function public.nueva_cotizacion(uuid, uuid, boolean) to authenticated;

-- juntar_clientes de 227, igual, salvo que mueve las oportunidades antes que todo lo demás. El orden
-- de pg_constraint no está garantizado (en la nube salen primero las oportunidades; en una base
-- local, las cotizaciones) y con cotizaciones primero el borrador del repetido perdía su oportunidad.
create or replace function public.juntar_clientes(p_repetido uuid, p_bueno uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  r clientes; b clientes; f record; k record; n int; v jsonb := '{}';
  v_quien text := coalesce((select nombre from perfiles where id = auth.uid()), 'el sistema');
  solo_digitos constant text := '[^0-9]';
begin
  if p_repetido = p_bueno then raise exception 'Es el mismo cliente'; end if;
  select * into r from clientes where id = p_repetido for update;
  select * into b from clientes where id = p_bueno for update;
  if r.id is null or b.id is null then raise exception 'No existe uno de los dos clientes'; end if;
  if not puede_juntar_clientes(p_repetido, p_bueno) then
    raise exception 'Juntar clientes lo hace la gerencia de ventas, o tú si los dos son tuyos o libres' using errcode = '42501';
  end if;
  if nullif(r.rfc, '') is not null and nullif(b.rfc, '') is not null and upper(r.rfc) <> upper(b.rfc) then
    raise exception 'Tienen RFC distinto (% y %): no son el mismo cliente. Si uno está mal, corrígelo primero', r.rfc, b.rfc using errcode = '23514';
  end if;

  -- Contactos: el que el bueno ya tiene (mismo teléfono o mismo nombre) solo le completa lo que le falta.
  for k in select * from contactos where cliente_id = p_repetido loop
    update contactos c set telefono = coalesce(c.telefono, k.telefono), whatsapp = coalesce(c.whatsapp, k.whatsapp),
      correo = coalesce(c.correo, k.correo), puesto = coalesce(c.puesto, k.puesto), domicilio = coalesce(c.domicilio, k.domicilio)
    where c.id = (select x.id from contactos x where x.cliente_id = p_bueno and (
        (nullif(regexp_replace(coalesce(k.telefono, k.whatsapp, ''), solo_digitos, '', 'g'), '') is not null
         and right(regexp_replace(coalesce(x.telefono, x.whatsapp, ''), solo_digitos, '', 'g'), 10)
           = right(regexp_replace(coalesce(k.telefono, k.whatsapp, ''), solo_digitos, '', 'g'), 10))
        or lower(trim(x.nombre)) = lower(trim(k.nombre))) limit 1);
    if found then
      delete from contactos where id = k.id;
    else
      -- En la hoja muchos venían como «Contacto»: el nombre de la persona era el del cliente repetido.
      update contactos set cliente_id = p_bueno, principal = false,
        nombre = case when lower(trim(nombre)) = 'contacto' then r.nombre else nombre end
      where id = k.id;
      v := v || jsonb_build_object('contactos', coalesce((v->>'contactos')::int, 0) + 1);
    end if;
  end loop;

  -- Todo lo demás que apunta al repetido pasa al bueno.
  for f in select cl.relname t, a.attname col from pg_constraint k2 join pg_class cl on cl.oid = k2.conrelid
           join pg_attribute a on a.attrelid = k2.conrelid and a.attnum = k2.conkey[1]
           where k2.confrelid = 'public.clientes'::regclass and k2.contype = 'f' and cl.relnamespace = 'public'::regnamespace
             and cl.relname <> 'contactos'
           -- Las oportunidades primero: así, cuando se mueve una cotización, su oportunidad ya es del
           -- bueno y trg_cotizacion (254) no la suelta por creer que le cambiaron el cliente.
           order by (cl.relname = 'oportunidades') desc, k2.oid loop
    execute format('update public.%I set %I = $1 where %I = $2', f.t, f.col, f.col) using p_bueno, p_repetido;
    get diagnostics n = row_count;
    if n > 0 then v := v || jsonb_build_object(f.t, coalesce((v->>f.t)::int, 0) + n); end if;
  end loop;
  -- Los pendientes ligados al repetido (los pidió cualquiera): la regla de pendientes lo permite con la bandera.
  perform set_config('hegamex.juntar', '1', true);
  update pendientes set registro_id = p_bueno::text, ruta = replace(ruta, p_repetido::text, p_bueno::text)
  where tabla = 'clientes' and registro_id = p_repetido::text;
  perform set_config('hegamex.juntar', '0', true);

  -- Lo que el bueno no tiene, lo toma del repetido; su nota dice con quién se juntó.
  update clientes set
    razon_social = coalesce(nullif(razon_social, ''), r.razon_social), rfc = coalesce(nullif(rfc, ''), r.rfc),
    regimen_fiscal = coalesce(nullif(regimen_fiscal, ''), r.regimen_fiscal), cp_fiscal = coalesce(nullif(cp_fiscal, ''), r.cp_fiscal),
    uso_cfdi = coalesce(nullif(uso_cfdi, ''), r.uso_cfdi), giro = coalesce(nullif(giro, ''), r.giro),
    ciudad = coalesce(nullif(ciudad, ''), r.ciudad), estado = coalesce(nullif(estado, ''), r.estado),
    cve_ent = coalesce(cve_ent, r.cve_ent), cvegeo = coalesce(cvegeo, r.cvegeo), ubicacion = coalesce(ubicacion, r.ubicacion),
    fuente_id = coalesce(fuente_id, r.fuente_id), vendedor_id = coalesce(vendedor_id, r.vendedor_id),
    es_distribuidor = es_distribuidor or r.es_distribuidor, dias_credito = greatest(dias_credito, r.dias_credito),
    activo = activo or r.activo,
    notas = concat_ws(E'\n', nullif(notas, ''), format('Se juntó con «%s» el %s (%s).', r.nombre, to_char(hoy_mx(), 'DD/MM/YYYY'), v_quien))
  where id = p_bueno;

  delete from clientes where id = p_repetido;
  return v;
end $$;
revoke execute on function public.juntar_clientes(uuid, uuid) from public, anon;
grant execute on function public.juntar_clientes(uuid, uuid) to authenticated;

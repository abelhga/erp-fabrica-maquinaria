-- =============================================================================
-- El folio de la cotización se asigna al capturar, no al abrir.
--
-- Por qué: "Nueva cotización" crea el registro en cuanto se abre el editor, y el
-- folio salía en ese momento. Abrir y salir sin capturar gastaba un folio: en la
-- nube había 3 cotizaciones y el contador iba en 23. Una numeración con huecos
-- parece de cotizaciones borradas y nadie puede saber cuáles.
--
-- Ahora nace con un folio provisional ("BORRADOR-…") y el definitivo sale cuando
-- entra la primera partida o cuando deja de ser borrador (enviarla, mandarla a
-- autorizar). Los borradores que nunca tuvieron partidas se borran solos al día
-- siguiente: no quedan en la lista ni gastaron folio.
-- =============================================================================

create or replace function public.folio_es_provisional(p_folio text) returns boolean
language sql immutable as $$ select p_folio like 'BORRADOR-%' $$;

-- Asigna el folio definitivo si todavía es provisional (una sola vez: el where lo garantiza).
create or replace function public.asignar_folio_cotizacion(p_id uuid) returns void
language sql security definer set search_path = public as $$
  update cotizaciones set folio = siguiente_folio('COT') where id = p_id and folio like 'BORRADOR-%'
$$;
revoke execute on function public.asignar_folio_cotizacion(uuid) from public, anon, authenticated;

create or replace function public.trg_folio_primera_partida() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform asignar_folio_cotizacion(new.cotizacion_id);
  return null;
end $$;
drop trigger if exists folio_primera_partida on public.cotizacion_lineas;
create trigger folio_primera_partida after insert on public.cotizacion_lineas
  for each row execute function public.trg_folio_primera_partida();

create or replace function public.trg_cotizacion() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  -- Sin sesión = migración o script de servicio.
  v_gerente boolean := auth.uid() is null or puede('ventas', 3);
  v_op uuid;
begin
  if tg_op = 'INSERT' then
    -- Provisional hasta que se capture algo (ver arriba); el id ya viene puesto por el default.
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
    -- El embudo se llena solo: cotizar ES mover la oportunidad a "cotizado", y
    -- si el vendedor no la abrió antes, se abre aquí (nadie captura dos veces).
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

-- Los borradores que se abrieron y nunca tuvieron partidas: fuera al día siguiente.
create or replace function public.limpiar_borradores_vacios() returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  delete from cotizaciones c
  where c.estado = 'borrador' and folio_es_provisional(c.folio) and c.creado_en < now() - interval '1 day'
    and not exists (select 1 from cotizacion_lineas l where l.cotizacion_id = c.id);
  get diagnostics n = row_count;
  return n;
end $$;
revoke execute on function public.limpiar_borradores_vacios() from public, anon, authenticated;

do $$ begin
  perform cron.unschedule('limpiar-borradores') where exists (select 1 from cron.job where jobname = 'limpiar-borradores');
  perform cron.schedule('limpiar-borradores', '17 9 * * *', 'select public.limpiar_borradores_vacios()');
exception when others then
  raise notice 'pg_cron no está disponible: los borradores vacíos no se limpian solos (%).', sqlerrm;
end $$;

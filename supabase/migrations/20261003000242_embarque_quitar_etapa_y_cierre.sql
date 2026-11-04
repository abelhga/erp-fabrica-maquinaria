-- =============================================================================
-- Embarques: quitar una etapa registrada por error, y no cerrar con dinero por recuperar.
--
-- Por qué (Alondra, importaciones): cerró un embarque que no era y no había forma de quitar ese paso;
-- solo se podía cambiar su fecha. Y cerró EMB-2026-00001 creyendo que «Cerrado» marcaba la devolución
-- del saldo a favor (la etapa dice «saldo a favor y garantía recuperados»), pero el saldo de Careaga
-- seguía sin marcar como recuperado: le seguía llegando el aviso cada día y no entendía por qué.
--   * quitar_evento_importacion(): quita una etapa con su motivo; queda una nota en la historia con
--     qué se quitó, qué fecha tenía y por qué. La cuenta de gastos no se quita mientras esté «Cerrado».
--   * Cerrar pide que antes se marque lo que había por recuperar (saldo a favor, garantía): el aviso
--     dice cuánto, de quién y dónde se marca.
-- =============================================================================

-- Lo que falta por recuperar, aunque quien cierra no vea el dinero del embarque (la regla no puede
-- depender de lo que la RLS le deja ver).
create or replace function public.embarque_por_recuperar(p_embarque uuid) returns text
language sql stable security definer set search_path = public as $$
  select string_agg(case s.tipo when 'saldo_agente' then 'saldo a favor' when 'garantia_contenedor' then 'garantía de contenedor' else coalesce(s.descripcion, 'dinero') end
                    || ' de ' || s.moneda || ' ' || to_char(s.monto - coalesce(s.monto_recuperado, 0), 'FM999,999,990.00')
                    || coalesce(' (' || s.deudor || ')', ''), '; ' order by s.fecha_origen)
  from embarque_saldos s where s.embarque_id = p_embarque and s.recuperado_en is null
$$;
revoke execute on function public.embarque_por_recuperar(uuid) from public, anon;
grant execute on function public.embarque_por_recuperar(uuid) to authenticated;

create or replace function public.trg_embarque_evento() returns trigger
language plpgsql set search_path = public as $$
declare v_pendiente text;
begin
  if new.tipo not in ('cambio_eta', 'nota') and new.fecha > (now() at time zone 'America/Mexico_City')::date then
    raise exception 'La fecha de "%" es futura: aquí van fechas reales. Lo esperado va en el ETA.',
      (select nombre from etapas_importacion where tipo = new.tipo) using errcode = '23514';
  end if;
  if new.tipo = 'cierre' and not exists (select 1 from embarque_eventos where embarque_id = new.embarque_id and tipo = 'cuenta_gastos') then
    raise exception 'Para cerrar el embarque primero registra la cuenta de gastos' using errcode = '23514';
  end if;
  -- Al registrar el cierre (no al corregir su fecha): lo que había por recuperar ya tiene que estar marcado.
  if new.tipo = 'cierre' and tg_op = 'INSERT' then
    v_pendiente := embarque_por_recuperar(new.embarque_id);
    if v_pendiente is not null then
      raise exception 'Antes de cerrar, marca como recuperado lo que estaba pendiente: %. Se marca en la pestaña Dinero, en «Por recuperar»', v_pendiente
        using errcode = '23514';
    end if;
  end if;
  return new;
end $$;

create or replace function public.quitar_evento_importacion(p_embarque uuid, p_tipo text, p_motivo text) returns void
language plpgsql security invoker set search_path = public as $$
declare v_ev embarque_eventos; v_nombre text;
begin
  if not puede('importaciones', 2) then raise exception 'Solo importaciones corrige las etapas de un embarque' using errcode = '42501'; end if;
  if p_tipo in ('cambio_eta', 'nota') then raise exception 'Los cambios de ETA y las notas son historia: no se quitan'; end if;
  if length(trim(coalesce(p_motivo, ''))) < 3 then raise exception 'Escribe por qué se quita: queda en la historia del embarque'; end if;
  select * into v_ev from embarque_eventos where embarque_id = p_embarque and tipo = p_tipo;
  if v_ev.id is null then raise exception 'Esa etapa no está registrada'; end if;
  if p_tipo = 'cuenta_gastos' and exists (select 1 from embarque_eventos where embarque_id = p_embarque and tipo = 'cierre') then
    raise exception 'El embarque está cerrado: quita primero «Cerrado»';
  end if;
  select nombre into v_nombre from etapas_importacion where tipo = p_tipo;
  delete from embarque_eventos where id = v_ev.id;
  insert into embarque_eventos (embarque_id, tipo, fecha, detalle)
  values (p_embarque, 'nota', (now() at time zone 'America/Mexico_City')::date,
          format('Se quitó la etapa «%s» (tenía fecha %s): %s', coalesce(v_nombre, p_tipo), to_char(v_ev.fecha, 'DD/MM/YYYY'), trim(p_motivo)));
end $$;
revoke execute on function public.quitar_evento_importacion(uuid, text, text) from public, anon;
grant execute on function public.quitar_evento_importacion(uuid, text, text) to authenticated;

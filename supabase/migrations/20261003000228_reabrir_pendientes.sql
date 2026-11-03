-- =============================================================================
-- Un pendiente cerrado por error se reabre en los siguientes 15 minutos.
--
-- Por qué: el 2 nov se cancelaron por error dos pendientes (el de Susana con sus respuestas y el de
-- Alondra para conectar su Gmail) y no había cómo regresarlos: la pantalla no reabre un pendiente
-- cerrado y hubo que hacerlo directo en la base. Ahora «Cancelar» pide confirmación (con motivo
-- opcional) y, como en las entregas, quien lo cerró (cancelado o hecho) lo reabre durante 15 minutos.
-- Después ya no: se pide otro pendiente, para que lo cerrado no cambie a escondidas.
--
-- Queda el rastro: la conversación del pendiente dice quién lo reabrió y por qué, y la bitácora
-- guarda el cambio. Si se había marcado hecho, a quien lo pidió (que recibió «Listo») se le avisa que
-- se reabrió, y a los del grupo que se les cerró porque otro lo hizo, que les vuelve a tocar. Los de la
-- revisión nocturna no se reabren aquí: se contestan en «Por revisar».
-- =============================================================================

create or replace function public.reabrir_pendiente(p_pendiente uuid, p_motivo text default null) returns int
language plpgsql security definer set search_path = public as $$
declare
  p pendientes; n int; v_yo uuid := auth.uid(); v_quien text; v_cubiertos uuid[];
  v_motivo text := coalesce(nullif(trim(p_motivo), ''), 'lo había cerrado por error');
begin
  select * into p from pendientes where id = p_pendiente for update;
  if p.id is null then raise exception 'No existe ese pendiente'; end if;
  if p.estado = 'abierto' then return 0; end if;
  if p.tabla = 'revision_hallazgos' then
    raise exception 'Este pendiente lo puso la revisión nocturna: contéstalo en «Por revisar»' using errcode = '42501';
  end if;
  if p.cerrado_por is distinct from v_yo then
    raise exception 'Solo quien lo cerró lo puede reabrir' using errcode = '42501';
  end if;
  if p.cerrado_en < now() - interval '15 minutes' then
    raise exception 'Ya pasaron más de 15 minutos desde que se cerró: pide un pendiente nuevo' using errcode = '23514';
  end if;
  select nombre into v_quien from perfiles where id = v_yo;
  -- Los del grupo que se cerraron en el mismo momento (al cancelar el pedido completo, o los que «lo
  -- hizo otra persona»): los cerró la misma persona hace menos de 15 minutos.
  select array_agg(responsable_id) into v_cubiertos from pendientes
  where p.grupo_id is not null and grupo_id = p.grupo_id and id <> p.id and estado = 'cubierto'
    and cerrado_por = v_yo and cerrado_en >= now() - interval '15 minutes';
  perform set_config('hegamex.reabrir', '1', true);
  update pendientes set estado = 'abierto', cerrado_por = null, cerrado_en = null, nota_cierre = null
  where (id = p.id or (p.grupo_id is not null and grupo_id = p.grupo_id))
    and estado <> 'abierto' and cerrado_por = v_yo and cerrado_en >= now() - interval '15 minutes';
  get diagnostics n = row_count;
  perform set_config('hegamex.reabrir', '0', true);

  insert into pendiente_mensajes (pendiente_id, autor_id, texto)
  values (p.id, v_yo, format('Lo reabrió %s (%s): %s.', coalesce(v_quien, 'alguien'),
                             case p.estado when 'hecho' then 'estaba hecho' else 'estaba cancelado' end, v_motivo));
  if p.estado = 'hecho' and p.creado_por is not null and p.creado_por <> v_yo then
    perform avisar(array[p.creado_por], 'pendiente_reabierto', 'Se reabrió: ' || p.titulo,
      format('%s: %s', coalesce(v_quien, 'alguien'), v_motivo), coalesce(p.ruta, '/pendientes'), 'pendientes', p.id::text);
  end if;
  if v_cubiertos is not null then
    perform avisar(v_cubiertos, 'pendiente_reabierto', 'Te vuelve a tocar: ' || p.titulo,
      format('%s lo reabrió: %s', coalesce(v_quien, 'alguien'), v_motivo), coalesce(p.ruta, '/pendientes'), 'pendientes', p.id::text);
  end if;
  return n;
end $$;
revoke execute on function public.reabrir_pendiente(uuid, text) from public, anon;
grant execute on function public.reabrir_pendiente(uuid, text) to authenticated;

-- La regla de pendientes (la de 227) con la excepción de reabrir.
create or replace function public.pendiente_reglas() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_yo uuid := auth.uid();
begin
  if v_yo is null then return new; end if;  -- funciones internas y migraciones
  -- Juntar clientes solo cambia a qué cliente apunta (registro_id y ruta), también en los cerrados.
  -- Reabrir (reabrir_pendiente) solo regresa a abierto lo que quien lo cerró cerró hace poco.
  if coalesce(current_setting('hegamex.reabrir', true), '') = '1' and new.estado = 'abierto'
     and (to_jsonb(new) - 'estado' - 'cerrado_por' - 'cerrado_en' - 'nota_cierre')
       = (to_jsonb(old) - 'estado' - 'cerrado_por' - 'cerrado_en' - 'nota_cierre') then
    return new;
  end if;
  if coalesce(current_setting('hegamex.juntar', true), '') = '1'
     and (to_jsonb(new) - 'registro_id' - 'ruta') = (to_jsonb(old) - 'registro_id' - 'ruta') then
    return new;
  end if;
  if old.estado <> 'abierto' then raise exception 'Este pendiente ya se cerró' using errcode = '42501'; end if;
  if old.tabla = 'revision_hallazgos' and coalesce(current_setting('hegamex.revision', true), '') <> '1' then
    if new.estado not in ('abierto', 'hecho')
       or (new.titulo, new.detalle, new.responsable_id, new.vence, new.tabla, new.registro_id, new.ruta, new.creado_por)
          is distinct from (old.titulo, old.detalle, old.responsable_id, old.vence, old.tabla, old.registro_id, old.ruta, old.creado_por) then
      raise exception 'Este pendiente lo puso la revisión nocturna: si no es error, contéstalo en «Por revisar»' using errcode = '42501';
    end if;
    if new.estado <> 'abierto' then new.cerrado_por := v_yo; new.cerrado_en := now(); end if;
    return new;
  end if;
  if new.creado_por is distinct from old.creado_por then raise exception 'No se cambia quién pidió el pendiente' using errcode = '42501'; end if;
  if (new.grupo_id, new.modo) is distinct from (old.grupo_id, old.modo) then
    raise exception 'No se cambia a quiénes se pidió ni cómo se cierra' using errcode = '42501';
  end if;
  if v_yo is distinct from old.creado_por and (new.titulo, new.detalle, new.responsable_id, new.vence, new.tabla, new.registro_id, new.ruta)
       is distinct from (old.titulo, old.detalle, old.responsable_id, old.vence, old.tabla, old.registro_id, old.ruta)
       and coalesce(current_setting('hegamex.revision', true), '') <> '1' then
    raise exception 'Solo quien pidió el pendiente lo puede cambiar' using errcode = '42501';
  end if;
  if new.estado = 'cancelado' and v_yo is distinct from old.creado_por and coalesce(current_setting('hegamex.revision', true), '') <> '1' then
    raise exception 'Solo quien pidió el pendiente lo puede cancelar' using errcode = '42501';
  end if;
  if new.esperando_respuesta is distinct from old.esperando_respuesta and coalesce(current_setting('hegamex.pregunta', true), '') <> '1' then
    raise exception '«Esperando respuesta» lo pone el ERP al preguntar y lo quita al responder' using errcode = '42501';
  end if;
  if new.estado = 'cubierto' and coalesce(current_setting('hegamex.cubrir', true), '') <> '1' then
    raise exception '«Lo hizo otro» lo marca el ERP cuando alguien del grupo lo termina' using errcode = '42501';
  end if;
  if new.estado <> 'abierto' then new.cerrado_por := v_yo; new.cerrado_en := now(); end if;
  return new;
end $$;

-- =============================================================================
-- «Ya lo corregí» comprueba antes de cerrar.
--
-- Por qué: el 10 de noviembre se marcaron siete hallazgos como corregidos en 32 segundos y solo uno
-- lo estaba. Los dos artículos repetidos seguían activos, aunque estaba a la mano «Corrígelo». La
-- compra atrasada seguía sin entradas, y la banda seguía diciendo 30". Los de la IA ya no vuelven a
-- salir nunca, así que un clic de más los borraba para siempre, y Pendientes contaba cada uno como
-- hecho.
--
-- Qué cambia (vale para «Ya lo corregí» en Por revisar y para «Hecho» en Pendientes):
--   * Si el hallazgo es de una regla que mide un estado (artículo o cliente repetido, compra
--     atrasada, cuenta sin ficha…), la regla se vuelve a correr. Si lo sigue encontrando, no se cierra
--     y se dice qué hacer: «Corrígelo» si existe, o «Está bien así» con el porqué.
--   * Si no se puede volver a medir (lo que señala la IA, o un hecho como un costo atípico) y el
--     registro no cambió desde que salió el hallazgo, pide que se escriba qué se corrigió.
--   * Los patrones para dirección («Ya lo revisé») no cambian.
-- =============================================================================

-- null: se puede cerrar. Si no: {motivo: 'sigue' | 'falta_nota', mensaje}.
create or replace function public.revision_comprobar_corregido(h public.revision_hallazgos, p_nota text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare r revision_reglas; v_sigue boolean; v_cambio boolean := false;
begin
  if h.para = 'direccion' then return null; end if;
  if h.origen = 'regla' and h.regla is not null then
    select * into r from revision_reglas where clave = h.regla;
  end if;
  if r.clave is not null and r.se_resuelve_sola then
    execute format('select exists (select 1 from public.%I() x where x.huella = $1)', 'revision_r_' || r.clave)
      into v_sigue using h.huella;
    if v_sigue then
      return jsonb_build_object('motivo', 'sigue', 'mensaje',
        'Todavía sale igual: la revisión lo acaba de volver a encontrar. '
        || case when h.accion is not null
                then 'Usa «Corrígelo» (' || coalesce(h.accion->>'texto', 'la corrección segura') || ') o corrígelo en su pantalla.'
                else 'Corrígelo en su pantalla y vuelve a contestar; si está bien así, usa «Está bien así» con el porqué.' end);
    end if;
    return null;
  end if;

  -- No se puede volver a medir: basta con que el registro haya cambiado, o con decir qué se corrigió.
  if length(trim(coalesce(p_nota, ''))) >= 10 then return null; end if;
  if h.tabla is not null and h.registro_id is not null then
    select exists (
      select 1 from bitacora b
      where b.en > h.creado_en
        and ((b.tabla = h.tabla and b.registro_id = h.registro_id)
             -- Una orden de compra se corrige casi siempre en sus partidas.
             or (h.tabla = 'ordenes_compra' and b.tabla = 'oc_lineas'
                 and (b.cambios->'orden_compra_id'->>0 = h.registro_id or b.cambios->'orden_compra_id'->>1 = h.registro_id
                      or b.registro_id in (select l.id::text from oc_lineas l where l.orden_compra_id::text = h.registro_id))))
    ) into v_cambio;
  end if;
  if v_cambio then return null; end if;
  return jsonb_build_object('motivo', 'falta_nota', 'mensaje',
    'No veo ningún cambio en ese registro desde que salió esto. Escribe qué corregiste (una frase), '
    || 'o, si no había nada que corregir, usa «Está bien así» con el porqué.');
end $$;
revoke execute on function public.revision_comprobar_corregido(public.revision_hallazgos, text) from public, anon, authenticated;

-- Lo que llama la pantalla: contesta qué pasó en vez de tronar, para poder pedir la nota ahí mismo.
create or replace function public.revision_ya_lo_corregi(p_hallazgo uuid, p_nota text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare h revision_hallazgos; v jsonb;
begin
  select * into h from revision_hallazgos where id = p_hallazgo;
  if h.id is null then raise exception 'No existe ese hallazgo'; end if;
  if not revision_me_toca(h) then raise exception 'Esto no te toca a ti' using errcode = '42501'; end if;
  if h.estado <> 'abierto' then raise exception 'Ya se contestó'; end if;
  v := revision_comprobar_corregido(h, p_nota);
  if v is not null then return v || jsonb_build_object('estado', 'abierto'); end if;
  perform set_config('hegamex.corregido_comprobado', h.id::text, true);
  return jsonb_build_object('estado', 'cerrado', 'mensaje', revision_responder(p_hallazgo, 'corregido', p_nota));
end $$;
revoke execute on function public.revision_ya_lo_corregi(uuid, text) from public, anon;
grant execute on function public.revision_ya_lo_corregi(uuid, text) to authenticated;

-- revision_responder: el mismo candado para quien la llame directo.
do $$
declare d text; n text;
begin
  d := pg_get_functiondef('public.revision_responder(uuid, text, text)'::regprocedure);
  n := replace(d, $a$  elsif p_respuesta = 'corregido' then
    update revision_hallazgos set estado = 'corregido', respuesta = nullif(trim(p_nota), ''),$a$,
    $a$  elsif p_respuesta = 'corregido' then
    if coalesce(current_setting('hegamex.corregido_comprobado', true), '') <> h.id::text then
      v_msg := revision_comprobar_corregido(h, p_nota)->>'mensaje';
      if v_msg is not null then raise exception '%', v_msg using errcode = '23514'; end if;
    end if;
    update revision_hallazgos set estado = 'corregido', respuesta = nullif(trim(p_nota), ''),$a$);
  if n = d then raise exception 'revision_responder: no encontré la rama de «corregido»'; end if;
  execute n;
end $$;

-- Y «Hecho» en Pendientes, que es lo mismo que «Ya lo corregí».
create or replace function public.pendiente_revision_hecho() returns trigger
language plpgsql security definer set search_path = public as $$
declare h revision_hallazgos; v jsonb;
begin
  if new.tabla = 'revision_hallazgos' and old.estado = 'abierto' and new.estado = 'hecho'
     and coalesce(current_setting('hegamex.revision', true), '0') <> '1' then
    select * into h from revision_hallazgos where id::text = new.registro_id and estado = 'abierto';
    if h.id is not null then
      v := revision_comprobar_corregido(h, new.nota_cierre);
      if v is not null then raise exception '%', v->>'mensaje' using errcode = '23514'; end if;
      update revision_hallazgos set estado = 'corregido', respuesta = coalesce(new.nota_cierre, respuesta),
             cerrado_en = now(), cerrado_por = new.cerrado_por
      where id = h.id;
    end if;
  end if;
  return null;
end $$;

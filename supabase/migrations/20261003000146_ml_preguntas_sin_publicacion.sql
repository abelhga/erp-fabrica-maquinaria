-- Preguntas de publicaciones pausadas o cerradas: fuera de la lista.
--
-- Mercado Libre no deja contestar una pregunta si su publicación no está activa
-- ("Item must be active"): la pantalla mostraba 10 pendientes, la más vieja de hace 5
-- meses, y al contestar salía ese error en inglés. Esas preguntas quedan como
-- "sin_publicacion": no salen por contestar ni cuentan en el indicador. Si la publicación
-- se reactiva, al revisarla de nuevo la pregunta vuelve a pendiente.

alter table public.ml_preguntas drop constraint if exists ml_preguntas_estado_check;
alter table public.ml_preguntas add constraint ml_preguntas_estado_check
  check (estado in ('pendiente', 'contestada', 'borrada', 'sin_publicacion'));

-- La de 133, con la publicación activa o no (item_activo lo manda la conexión con ML).
create or replace function public.ml_registrar_pregunta(p jsonb)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_nueva boolean; v_estado text := case p->>'estado' when 'ANSWERED' then 'contestada'
  -- Pausada o cerrada en ML: ya no se puede contestar.
  when 'UNANSWERED' then case when p->>'item_activo' = 'false' then 'sin_publicacion' else 'pendiente' end else 'borrada' end;
begin
  if auth.uid() is not null then raise exception 'Las preguntas de Mercado Libre las registra la conexión con ML' using errcode = '42501'; end if;
  v_nueva := not exists (select 1 from ml_preguntas where id = (p->>'id')::bigint);
  insert into ml_preguntas (id, item_id, articulo_id, titulo_publicacion, texto, estado, recibida_en, respuesta, contestada_en)
  values ((p->>'id')::bigint, p->>'item_id',
    (select articulo_id from publicaciones where canal = 'mercadolibre' and id_externo = p->>'item_id'),
    p->>'titulo', coalesce(p->>'texto', ''), v_estado, coalesce((p->>'fecha')::timestamptz, now()),
    p->>'respuesta', nullif(p->>'fecha_respuesta', '')::timestamptz)
  on conflict (id) do update set estado = excluded.estado,
    respuesta = coalesce(excluded.respuesta, ml_preguntas.respuesta),
    contestada_en = coalesce(ml_preguntas.contestada_en, excluded.contestada_en),
    titulo_publicacion = coalesce(excluded.titulo_publicacion, ml_preguntas.titulo_publicacion), actualizado_en = now();
  if v_nueva and v_estado = 'pendiente' then
    perform avisar(ml_atienden(), 'ml_pregunta', 'Pregunta en Mercado Libre',
      left(coalesce(p->>'titulo', '') || ': ' || coalesce(p->>'texto', ''), 240), '/ventas/mercadolibre', 'ml_preguntas', p->>'id');
  end if;
  return (p->>'id')::bigint;
end $function$;

-- Al contestar, ML respondió que la publicación no está activa: se quita de la lista.
create or replace function public.ml_pregunta_sin_publicacion(p_pregunta bigint) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null then raise exception 'Lo marca la conexión con ML' using errcode = '42501'; end if;
  update ml_preguntas set estado = 'sin_publicacion', actualizado_en = now() where id = p_pregunta and estado = 'pendiente';
end $$;
revoke execute on function public.ml_pregunta_sin_publicacion(bigint) from public, anon, authenticated;
grant execute on function public.ml_pregunta_sin_publicacion(bigint) to service_role;

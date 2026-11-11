-- =============================================================================
-- En las preguntas y respuestas de un pendiente se puede mandar una captura o foto.
--
-- Por qué: Fernando le pidió a Abel cambiar un gabinete en la OP-2026-00029. Abel le quería
-- contestar «lo puedes hacer tú, así» con una captura de la pantalla de «Reemplazar», y el pendiente
-- solo aceptaba texto: la imagen tenía que irse por WhatsApp y la conversación quedaba partida.
--
-- Qué hay ahora:
--   * Bucket privado «pendientes», una carpeta por pendiente. La foto la ve quien ve el pendiente
--     (la misma regla que la conversación) y la sube quien lo tiene o quien lo pidió, mientras siga
--     abierto. No se reemplaza ni se borra, igual que los mensajes.
--   * pendiente_mensajes.adjunto: la ruta de la imagen. Un mensaje puede ser solo la imagen.
--   * comentar_pendiente(pendiente, texto, adjunto): revisa que la imagen sea de ese pendiente y que
--     ya esté subida, y el aviso dice que trae captura.
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('pendientes', 'pendientes', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])
on conflict (id) do update set public = false;

drop policy if exists pendientes_ver on storage.objects;
create policy pendientes_ver on storage.objects for select to authenticated using (
  bucket_id = 'pendientes' and (storage.foldername(name))[1] in (select p.id::text from public.pendientes p));
drop policy if exists pendientes_subir on storage.objects;
create policy pendientes_subir on storage.objects for insert to authenticated with check (
  bucket_id = 'pendientes' and (storage.foldername(name))[1] in (
    select p.id::text from public.pendientes p
    where p.estado = 'abierto' and (select auth.uid()) in (p.responsable_id, p.creado_por)));

alter table public.pendiente_mensajes add column if not exists adjunto text;
alter table public.pendiente_mensajes drop constraint if exists pendiente_mensajes_texto_check;
alter table public.pendiente_mensajes add constraint pendiente_mensajes_texto_check
  check (length(trim(texto)) > 0 or adjunto is not null);

drop function if exists public.comentar_pendiente(uuid, text);
create or replace function public.comentar_pendiente(p_pendiente uuid, p_texto text, p_adjunto text default null) returns void
language plpgsql security definer set search_path = public as $$
declare p pendientes; v_yo uuid := auth.uid(); v_nombre text; v_para uuid; v_texto text := trim(coalesce(p_texto, ''));
  v_adj text := nullif(trim(coalesce(p_adjunto, '')), ''); v_resumen text;
begin
  select * into p from pendientes where id = p_pendiente for update;
  if p.id is null or v_yo not in (p.responsable_id, p.creado_por) then
    raise exception 'Solo quien tiene el pendiente y quien lo pidió escriben en él' using errcode = '42501';
  end if;
  if p.estado <> 'abierto' then raise exception 'Este pendiente ya se cerró'; end if;
  if v_texto = '' and v_adj is null then raise exception 'Escribe la pregunta o la respuesta'; end if;
  -- La imagen tiene que ser de este pendiente y ya estar subida: no se liga una de otro.
  if v_adj is not null and (split_part(v_adj, '/', 1) <> p.id::text
      or not exists (select 1 from storage.objects o where o.bucket_id = 'pendientes' and o.name = v_adj)) then
    raise exception 'Esa imagen no es de este pendiente o no se terminó de subir' using errcode = '22023';
  end if;
  insert into pendiente_mensajes (pendiente_id, autor_id, texto, adjunto) values (p.id, v_yo, left(v_texto, 2000), v_adj);
  select nombre into v_nombre from perfiles where id = v_yo;
  v_resumen := case when v_texto = '' then 'te mandó una captura'
                    else left(v_texto, 180) || case when v_adj is not null then ' (con captura)' else '' end end;
  -- Quien lo tiene pregunta: espera a quien lo pidió. Quien lo pidió contesta: ya no espera.
  -- (Si uno se lo pidió a sí mismo, solo es una nota.)
  if p.responsable_id <> p.creado_por then
    perform set_config('hegamex.pregunta', '1', true);
    update pendientes set esperando_respuesta = (v_yo = p.responsable_id) where id = p.id;
    perform set_config('hegamex.pregunta', '0', true);
    v_para := case when v_yo = p.responsable_id then p.creado_por else p.responsable_id end;
    perform avisar(array[v_para],
      case when v_yo = p.responsable_id then 'pendiente_pregunta' else 'pendiente_respuesta' end,
      case when v_yo = p.responsable_id then 'Te preguntan: ' else 'Te contestaron: ' end || p.titulo,
      format('%s: %s', coalesce(v_nombre, 'alguien'), v_resumen),
      '/pendientes?pendiente=' || p.id, 'pendientes', p.id::text);
  end if;
end $$;
revoke execute on function public.comentar_pendiente(uuid, text, text) from public, anon;
grant execute on function public.comentar_pendiente(uuid, text, text) to authenticated;

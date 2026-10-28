-- =============================================================================
-- Marketing pone las fotos del catálogo, Juan Carlos es también de marketing, y cada pregunta de
-- Mercado Libre sabe quién la hizo.
--
-- 1. Fotos. Hoy solo ingeniería, compras y almacén podían cambiar la foto de un artículo (la
--    política «actualizar» de articulos, que además deja cambiar todo lo demás). Marketing es
--    quien tiene las fotos buenas. Catálogo nivel 2 ahora es «poner la foto»: solo la foto, con
--    poner_imagen_articulo(), sin abrirle el resto de la ficha.
-- 2. Juan Carlos tiene el mismo puesto que Adriana (es el principal de envíos y Mercado Libre):
--    conserva ventas y suma marketing.
-- 3. Muchas preguntas de ML siguen a otra que el mismo comprador ya hizo en esa publicación.
--    Sin saber quién preguntó no había cómo mostrar lo anterior. Ahora se guarda comprador_id
--    (from.id de ML) y la conexión trae también sus preguntas anteriores en esa publicación.
-- =============================================================================

-- 1. ---------------------------------------------------------------------------
insert into public.permisos_rol (rol, modulo, nivel) values ('marketing', 'catalogo', 2)
on conflict (rol, modulo) do update set nivel = greatest(permisos_rol.nivel, excluded.nivel);

create or replace function public.puede_subir_catalogo(p_nombre text) returns boolean
language sql stable security definer set search_path = public as $$
  select case split_part(p_nombre, '/', 1)
    when 'articulos' then puede('costeo', 2) or puede('compras', 2) or puede('inventario', 2) or puede('catalogo', 2)
    when 'cotizaciones' then puede('ventas', 2)
    else false end
$$;

create or replace function public.poner_imagen_articulo(p_articulo uuid, p_url text) returns text
language plpgsql security definer set search_path = public as $$
declare v text;
begin
  if not (puede('catalogo', 2) or puede('costeo', 2) or puede('compras', 2) or puede('inventario', 2)) then
    raise exception 'Poner la foto de un artículo es de marketing o ingeniería' using errcode = '42501';
  end if;
  update articulos set imagen_url = nullif(trim(p_url), '') where id = p_articulo and tipo in ('equipo', 'componente', 'subensamble', 'materia_prima')
  returning imagen_url into v;
  if not found then raise exception 'No existe ese artículo'; end if;
  return v;   -- ya convertida (una liga de Drive se vuelve imagen: liga_imagen, 115)
end $$;
revoke execute on function public.poner_imagen_articulo(uuid, text) from public, anon;
grant execute on function public.poner_imagen_articulo(uuid, text) to authenticated;

-- 2. ---------------------------------------------------------------------------
insert into public.usuario_roles (usuario_id, rol)
select id, 'marketing' from public.perfiles where lower(correo) = 'juancarlos@hegamex.com'
on conflict do nothing;

-- 3. ---------------------------------------------------------------------------
alter table public.ml_preguntas add column if not exists comprador_id bigint;
create index if not exists ml_preguntas_comprador on public.ml_preguntas (item_id, comprador_id, recibida_en);

-- 146, más comprador_id. Las anteriores que trae la conexión ya vienen contestadas: no avisan.
create or replace function public.ml_registrar_pregunta(p jsonb)
returns bigint language plpgsql security definer set search_path = public as $$
declare v_nueva boolean; v_estado text := case p->>'estado' when 'ANSWERED' then 'contestada'
  when 'UNANSWERED' then case when p->>'item_activo' = 'false' then 'sin_publicacion' else 'pendiente' end else 'borrada' end;
begin
  if auth.uid() is not null then raise exception 'Las preguntas de Mercado Libre las registra la conexión con ML' using errcode = '42501'; end if;
  v_nueva := not exists (select 1 from ml_preguntas where id = (p->>'id')::bigint);
  insert into ml_preguntas (id, item_id, articulo_id, titulo_publicacion, texto, estado, recibida_en, respuesta, contestada_en, comprador_id)
  values ((p->>'id')::bigint, p->>'item_id',
    (select articulo_id from publicaciones where canal = 'mercadolibre' and id_externo = p->>'item_id'),
    p->>'titulo', coalesce(p->>'texto', ''), v_estado, coalesce((p->>'fecha')::timestamptz, now()),
    p->>'respuesta', nullif(p->>'fecha_respuesta', '')::timestamptz, nullif(p->>'comprador_id', '')::bigint)
  on conflict (id) do update set estado = excluded.estado,
    respuesta = coalesce(excluded.respuesta, ml_preguntas.respuesta),
    contestada_en = coalesce(ml_preguntas.contestada_en, excluded.contestada_en),
    titulo_publicacion = coalesce(excluded.titulo_publicacion, ml_preguntas.titulo_publicacion),
    comprador_id = coalesce(excluded.comprador_id, ml_preguntas.comprador_id), actualizado_en = now();
  if v_nueva and v_estado = 'pendiente' then
    perform avisar(ml_atienden(), 'ml_pregunta', 'Pregunta en Mercado Libre',
      left(coalesce(p->>'titulo', '') || ': ' || coalesce(p->>'texto', ''), 240), '/ventas/mercadolibre', 'ml_preguntas', p->>'id');
  end if;
  return (p->>'id')::bigint;
end $$;

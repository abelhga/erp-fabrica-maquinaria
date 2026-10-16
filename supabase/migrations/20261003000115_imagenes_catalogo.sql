-- Imágenes del catálogo: la liga de Drive se convierte sola, y se puede subir la foto.
--
-- Una liga "drive.google.com/file/d/<id>/view" abre la página de Drive (HTML), no la
-- imagen: la ficha del componente la guardaba tal cual y no se veía. El importador de
-- la hoja ya la convertía (imagen() en src/importador/util.ts, como la columna AG de
-- EQUIPOS); ahora la base aplica la misma regla venga de donde venga la liga (ficha,
-- cotización, importador o asistente). Sin "authuser=1": eso solo sirve en el navegador
-- de quien tiene esa sesión de Google, no en el PDF que recibe el cliente.
create or replace function public.liga_imagen(p text) returns text
language sql immutable set search_path = public as $$
  select case
    when nullif(trim(p), '') is null then null
    when trim(p) ~* 'drive\.google\.com|docs\.google\.com' and coalesce(
           substring(trim(p) from '/d/([A-Za-z0-9_-]{20,})'), substring(trim(p) from '[?&]id=([A-Za-z0-9_-]{20,})')) is not null
      then 'https://lh3.googleusercontent.com/d/' || coalesce(
           substring(trim(p) from '/d/([A-Za-z0-9_-]{20,})'), substring(trim(p) from '[?&]id=([A-Za-z0-9_-]{20,})')) || '=w1000'
    else trim(p)
  end
$$;

create or replace function public.trg_liga_imagen() returns trigger
language plpgsql set search_path = public as $$
begin
  new.imagen_url := liga_imagen(new.imagen_url);
  return new;
end $$;

drop trigger if exists liga_imagen on public.articulos;
create trigger liga_imagen before insert or update of imagen_url on public.articulos
  for each row execute function public.trg_liga_imagen();
drop trigger if exists liga_imagen on public.cotizacion_lineas;
create trigger liga_imagen before insert or update of imagen_url on public.cotizacion_lineas
  for each row execute function public.trg_liga_imagen();

-- Lo que ya se pegó así (en la nube, un componente).
update public.articulos set imagen_url = imagen_url where imagen_url ~* 'drive\.google\.com|docs\.google\.com';
update public.cotizacion_lineas set imagen_url = imagen_url where imagen_url ~* 'drive\.google\.com|docs\.google\.com';

-- Fotos subidas al ERP: no dependen de que alguien siga compartiendo el archivo en Drive.
-- Público porque la foto sale en el PDF que se le manda al cliente (un enlace firmado
-- caduca), y son fotos de catálogo que ya están públicas en el sitio.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('catalogo', 'catalogo', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- Quién sube: articulos/… quien puede editar artículos (la política "actualizar" de
-- articulos); cotizaciones/… quien captura ventas. Leer no necesita política: es público.
create or replace function public.puede_subir_catalogo(p_nombre text) returns boolean
language sql stable security definer set search_path = public as $$
  select case split_part(p_nombre, '/', 1)
    when 'articulos' then puede('costeo', 2) or puede('compras', 2) or puede('inventario', 2)
    when 'cotizaciones' then puede('ventas', 2)
    else false end
$$;
revoke execute on function public.puede_subir_catalogo(text) from public, anon;
grant execute on function public.puede_subir_catalogo(text) to authenticated;

drop policy if exists catalogo_subir on storage.objects;
create policy catalogo_subir on storage.objects for insert to authenticated
  with check (bucket_id = 'catalogo' and public.puede_subir_catalogo(name));
drop policy if exists catalogo_cambiar on storage.objects;
create policy catalogo_cambiar on storage.objects for update to authenticated
  using (bucket_id = 'catalogo' and public.puede_subir_catalogo(name));
drop policy if exists catalogo_borrar on storage.objects;
create policy catalogo_borrar on storage.objects for delete to authenticated
  using (bucket_id = 'catalogo' and public.puede_subir_catalogo(name));

-- =============================================================================
-- Entregar un pedido: quién, con hoja de salida firmada y con marcha atrás.
--
-- Antes «Entregar» era un clic sin confirmar, lo podía dar toda la planta y no quedaba
-- quién recibió ni la firma del cliente: PED-26-768 se marcó entregado por error y no había
-- cómo regresarlo sin sistemas.
--
-- Ahora:
--   * Entregan almacén (quien despacha), el vendedor sus pedidos, la gerencia de ventas y
--     dirección. La planta termina las órdenes; no entrega al cliente.
--   * Cada entrega es una «salida» con quién recibió, nota y la hoja firmada (foto o PDF en
--     el bucket privado «entregas», carpeta del pedido). La hoja se puede subir después.
--   * Quien la marcó la deshace en los primeros 15 minutos; después, la gerencia de ventas o
--     dirección la reabre con motivo. Deshacer regresa el pedido y lo entregado de cada
--     partida a como estaban (por eso la salida guarda el «antes»).
--   * hoja_salida(pedido): lo que va en la hoja que firma el cliente, sin precios (la imprime
--     también almacén, que no ve montos).
-- =============================================================================

create table public.pedido_salidas (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references public.pedidos(id) on delete cascade,
  numero int not null,
  recibio text not null check (length(trim(recibio)) >= 3),
  nota text,
  evidencia_ruta text,
  evidencia_subida_en timestamptz,
  entregado_por uuid references public.perfiles(id),
  entregado_en timestamptz not null default now(),
  -- Cómo estaba el pedido antes, para deshacer sin adivinar.
  estado_anterior estado_pedido not null,
  entregado_en_anterior timestamptz,
  lineas_anteriores jsonb not null default '[]',
  anulada_en timestamptz,
  anulada_por uuid references public.perfiles(id),
  motivo_anulacion text,
  unique (pedido_id, numero)
);
create index on public.pedido_salidas (pedido_id);
alter table public.pedido_salidas enable row level security;

-- Quién puede entregar este pedido (y deshacer o subir su hoja).
create or replace function public.puede_entregar(p_vendedor uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select (p_vendedor = auth.uid() and puede('ventas', 2)) or puede('ventas', 3) or puede('inventario', 3)
$$;
revoke execute on function public.puede_entregar(uuid) from public, anon;
grant execute on function public.puede_entregar(uuid) to authenticated;

-- Las salidas las ve quien ve el pedido completo y almacén. Nadie escribe directo.
create policy ver on public.pedido_salidas for select to authenticated using (
  (select ve_todos_los_pedidos()) or (select puede('inventario', 3))
  or pedido_id in (select mis_pedidos_visibles()));
grant select on public.pedido_salidas to authenticated;
create trigger auditar after insert or update or delete on public.pedido_salidas for each row execute function auditar();

create or replace function public.entregar_pedido(p_id uuid, p_recibio text default null, p_nota text default null,
                                                  p_evidencia text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare p pedidos; v_id uuid;
begin
  select * into p from pedidos where id = p_id for update;
  if p.id is null then raise exception 'No existe el pedido'; end if;
  if not puede_entregar(p.vendedor_id) then
    raise exception 'Entregan almacén, el vendedor del pedido, la gerencia de ventas y dirección' using errcode = '42501';
  end if;
  if p.estado in ('entregado', 'cancelado') then raise exception 'El pedido ya está %', p.estado; end if;
  if coalesce(length(trim(p_recibio)), 0) < 3 then raise exception 'Anota quién recibió' using errcode = '23514'; end if;
  if p_evidencia is not null and p_evidencia not like p_id || '/%' then raise exception 'La hoja firmada no es de este pedido'; end if;

  insert into pedido_salidas (pedido_id, numero, recibio, nota, evidencia_ruta, evidencia_subida_en, entregado_por,
                              estado_anterior, entregado_en_anterior, lineas_anteriores)
  values (p_id, coalesce((select max(numero) from pedido_salidas where pedido_id = p_id), 0) + 1, trim(p_recibio),
          nullif(trim(p_nota), ''), p_evidencia, case when p_evidencia is not null then now() end, auth.uid(),
          p.estado, p.entregado_en,
          coalesce((select jsonb_agg(jsonb_build_object('id', l.id, 'cantidad_entregada', l.cantidad_entregada))
                    from pedido_lineas l where l.pedido_id = p_id), '[]'))
  returning id into v_id;
  update pedido_lineas set cantidad_entregada = cantidad where pedido_id = p_id and cantidad_entregada <> cantidad;
  update pedidos set estado = 'entregado' where id = p_id;
  return v_id;
end $$;
-- La firma vieja (solo el pedido) ya no sirve: sin quién recibió no hay entrega.
drop function if exists public.entregar_pedido(uuid);
revoke execute on function public.entregar_pedido(uuid, text, text, text) from public, anon;
grant execute on function public.entregar_pedido(uuid, text, text, text) to authenticated;

create or replace function public.deshacer_entrega(p_pedido uuid, p_motivo text default null)
returns void language plpgsql security definer set search_path = public as $$
declare p pedidos; s pedido_salidas; v_propia boolean;
begin
  select * into p from pedidos where id = p_pedido for update;
  if p.id is null then raise exception 'No existe el pedido'; end if;
  if p.estado <> 'entregado' then raise exception 'El pedido no está entregado'; end if;
  select * into s from pedido_salidas where pedido_id = p_pedido and anulada_en is null order by numero desc limit 1;
  if s.id is null then raise exception 'Esta entrega no tiene hoja de salida (se entregó con un envío o es de antes): la regresa sistemas'; end if;
  v_propia := s.entregado_por = auth.uid() and s.entregado_en > now() - interval '15 minutes' and puede_entregar(p.vendedor_id);
  if not v_propia then
    if not puede('ventas', 3) then
      raise exception 'Pasados 15 minutos, la reabre la gerencia de ventas o dirección' using errcode = '42501';
    end if;
    if coalesce(length(trim(p_motivo)), 0) < 3 then raise exception 'Anota por qué se reabre la entrega' using errcode = '23514'; end if;
  end if;

  update pedido_lineas l set cantidad_entregada = (a->>'cantidad_entregada')::numeric
  from jsonb_array_elements(s.lineas_anteriores) a where l.id = (a->>'id')::uuid;
  update pedidos set estado = s.estado_anterior where id = p_pedido;
  -- El disparador pone la fecha al entregar; al regresar se deja la que tenía.
  update pedidos set entregado_en = s.entregado_en_anterior where id = p_pedido;
  update pedido_salidas set anulada_en = now(), anulada_por = auth.uid(),
    motivo_anulacion = coalesce(nullif(trim(p_motivo), ''), 'Se marcó entregado por error')
  where id = s.id;
end $$;
revoke execute on function public.deshacer_entrega(uuid, text) from public, anon;
grant execute on function public.deshacer_entrega(uuid, text) to authenticated;

-- La hoja firmada llega casi siempre después (el cliente firma en el papel): se adjunta a la salida.
create or replace function public.adjuntar_hoja_salida(p_salida uuid, p_ruta text)
returns void language plpgsql security definer set search_path = public as $$
declare s pedido_salidas; v_vendedor uuid;
begin
  select * into s from pedido_salidas where id = p_salida;
  if s.id is null then raise exception 'No existe esa entrega'; end if;
  select vendedor_id into v_vendedor from pedidos where id = s.pedido_id;
  if not puede_entregar(v_vendedor) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  if p_ruta is null or p_ruta not like s.pedido_id || '/%' then raise exception 'La hoja firmada no es de este pedido'; end if;
  update pedido_salidas set evidencia_ruta = p_ruta, evidencia_subida_en = now() where id = p_salida;
end $$;
revoke execute on function public.adjuntar_hoja_salida(uuid, text) from public, anon;
grant execute on function public.adjuntar_hoja_salida(uuid, text) to authenticated;

-- Lo que va en la hoja de salida (y en el recuadro de entrega del pedido). Sin precios.
create or replace function public.hoja_salida(p_pedido uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare p pedidos; r jsonb;
begin
  select * into p from pedidos where id = p_pedido;
  if p.id is null then raise exception 'No existe el pedido'; end if;
  if not (ve_todos_los_pedidos() or ve_pedidos_sin_montos() or puede('inventario', 3) or p.vendedor_id = auth.uid()
          or p_pedido in (select mis_pedidos_visibles())) then
    raise exception 'Sin permiso' using errcode = '42501';
  end if;
  select jsonb_build_object(
    'pedido', jsonb_build_object('id', p.id, 'folio', p.folio, 'folio_anterior', p.folio_anterior, 'fecha', p.fecha,
      'fecha_compromiso', p.fecha_compromiso, 'estado', p.estado, 'direccion_entrega', p.direccion_entrega, 'canal', p.canal),
    'cliente', (select jsonb_build_object('nombre', c.nombre, 'razon_social', c.razon_social, 'rfc', c.rfc, 'ciudad', c.ciudad, 'estado', c.estado)
                from clientes c where c.id = p.cliente_id),
    'vendedor', (select jsonb_build_object('nombre', v.nombre, 'telefono', v.telefono) from perfiles v where v.id = p.vendedor_id),
    'puede_entregar', puede_entregar(p.vendedor_id),
    'puede_reabrir', puede('ventas', 3),
    'partidas', coalesce((select jsonb_agg(jsonb_build_object('id', l.id, 'cantidad', l.cantidad, 'unidad', l.unidad,
        'titulo', l.titulo, 'descripcion', l.descripcion, 'clave', a.clave,
        'series', (select coalesce(jsonb_agg(o.numero_serie order by o.folio) filter (where o.numero_serie is not null), '[]')
                   from ordenes_produccion o where o.pedido_linea_id = l.id and o.estado <> 'cancelada'))
      order by l.orden) from pedido_lineas l left join articulos a on a.id = l.articulo_id where l.pedido_id = p.id), '[]'),
    -- Equipos del pedido que no cuelgan de una partida (los pedidos que vinieron de la hoja).
    'sueltas', coalesce((select jsonb_agg(jsonb_build_object('equipo', a.nombre, 'clave', a.clave, 'serie', o.numero_serie, 'folio', o.folio) order by o.folio)
      from ordenes_produccion o join articulos a on a.id = o.articulo_id
      where o.pedido_id = p.id and o.estado <> 'cancelada'
        and (o.pedido_linea_id is null or not exists (select 1 from pedido_lineas l where l.id = o.pedido_linea_id))), '[]'),
    'salidas', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'numero', s.numero, 'recibio', s.recibio, 'nota', s.nota,
        'evidencia_ruta', s.evidencia_ruta, 'entregado_en', s.entregado_en, 'entregado_por', e.nombre,
        'mia', s.entregado_por = auth.uid(), 'anulada_en', s.anulada_en, 'motivo_anulacion', s.motivo_anulacion) order by s.numero desc)
      from pedido_salidas s left join perfiles e on e.id = s.entregado_por where s.pedido_id = p.id), '[]')
  ) into r;
  return r;
end $$;
revoke execute on function public.hoja_salida(uuid) from public, anon;
grant execute on function public.hoja_salida(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Archivos: bucket privado «entregas», una carpeta por pedido (<pedido_id>/…). La ve quien
-- ve el pedido (y almacén); la sube quien puede entregar. No se borra ni se reemplaza.
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('entregas', 'entregas', false, 15728640,
        array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf'])
on conflict (id) do update set public = false;

drop policy if exists entregas_ver on storage.objects;
create policy entregas_ver on storage.objects for select to authenticated using (
  bucket_id = 'entregas' and (
    (select public.ve_todos_los_pedidos()) or (select public.puede('inventario', 3))
    or (storage.foldername(name))[1] in (select x::text from public.mis_pedidos_visibles() x)));
drop policy if exists entregas_subir on storage.objects;
create policy entregas_subir on storage.objects for insert to authenticated with check (
  bucket_id = 'entregas' and (
    (select public.puede('ventas', 3)) or (select public.puede('inventario', 3))
    or ((select public.puede('ventas', 2)) and (storage.foldername(name))[1] in (select x::text from public.mis_pedidos_visibles() x))));

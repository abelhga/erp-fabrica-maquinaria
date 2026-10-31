-- =============================================================================
-- Correos de los embarques: la segunda etapa de Gmail, empezando por importaciones.
--
-- Un embarque se lleva por correo con el proveedor, el forwarder, la naviera y el agente aduanal,
-- en hilos que llegan a 80 correos. Saber en qué va (si ya zarpó, si llegó el BL, qué pidió el
-- agente) es releer todo, y lo que se apunta en el ERP va atrás de los correos. Ahora:
--   * Alondra liga a cada embarque los hilos de su Gmail (la función de borde «correo» los trae
--     con su permiso de leer, que se pide desde la primera etapa) y se guarda el texto de cada
--     correo, sin lo citado de correos anteriores. Así lo consulta quien ve el dinero de
--     importaciones aunque no sea su Gmail, y no depende de que nadie borre un correo.
--   * La IA lee todos los hilos del embarque juntos y PROPONE: fechas reales de etapas, ETA y ETD,
--     datos (BL, contenedor, buque…), documentos recibidos y pendientes de quién. Cada punto dice
--     de qué correo salió. Decisión de dirección: lee el hilo completo, con montos.
--   * Nada se cambia solo: Alondra marca lo que es correcto y lo aplica, con las mismas reglas que
--     si lo capturara a mano (registrar_evento_importacion, la política de embarques, el disparador
--     que anota cada cambio de ETA).
--   * Lo de los correos lleva montos: lo ve quien ve el dinero de importaciones, no almacén ni el
--     taller (que sí ven el embarque).
-- =============================================================================

create table if not exists public.embarque_hilos (
  id uuid primary key default gen_random_uuid(),
  embarque_id uuid not null references public.embarques(id) on delete cascade,
  usuario_id uuid not null references public.perfiles(id),   -- de qué Gmail se trae (solo esa persona lo actualiza)
  cuenta text not null,                                      -- el correo de esa cuenta de Google
  gmail_hilo text not null,
  asunto text,
  participantes text[] not null default '{}',
  mensajes int not null default 0,
  primer_mensaje_en timestamptz,
  ultimo_mensaje_en timestamptz,
  traido_en timestamptz not null default now(),
  ligado_por uuid default auth.uid() references public.perfiles(id),
  ligado_en timestamptz not null default now(),
  unique (embarque_id, usuario_id, gmail_hilo)
);
create index if not exists embarque_hilos_embarque on public.embarque_hilos (embarque_id);

create table if not exists public.embarque_correos (
  id uuid primary key default gen_random_uuid(),
  hilo_id uuid not null references public.embarque_hilos(id) on delete cascade,
  gmail_id text not null,
  enviado_en timestamptz not null,
  de text,
  para text,
  asunto text,
  texto text not null default '',          -- sin lo citado de correos anteriores, hasta 12,000 letras
  adjuntos text[] not null default '{}',   -- nombres de los archivos (el archivo se queda en Gmail)
  unique (hilo_id, gmail_id)
);
create index if not exists embarque_correos_hilo on public.embarque_correos (hilo_id, enviado_en);

create table if not exists public.embarque_propuestas (
  id uuid primary key default gen_random_uuid(),
  embarque_id uuid not null references public.embarques(id) on delete cascade,
  contenido jsonb not null,
  correos int not null,                    -- cuántos correos leyó
  hasta timestamptz,                       -- el correo más nuevo que leyó
  modelo text,
  estado text not null default 'nueva' check (estado in ('nueva', 'aplicada', 'descartada')),
  aplicado jsonb,                          -- lo que se aplicó de verdad
  creada_por uuid default auth.uid() references public.perfiles(id),
  creada_en timestamptz not null default now(),
  resuelta_por uuid references public.perfiles(id),
  resuelta_en timestamptz
);
create index if not exists embarque_propuestas_embarque on public.embarque_propuestas (embarque_id, creada_en desc);

-- Solo se escriben por la función de borde (llave de servicio) o por las funciones de abajo.
alter table public.embarque_hilos enable row level security;
alter table public.embarque_correos enable row level security;
alter table public.embarque_propuestas enable row level security;
revoke insert, update, delete on public.embarque_hilos, public.embarque_correos, public.embarque_propuestas from anon, authenticated;
drop policy if exists ver on public.embarque_hilos;
create policy ver on public.embarque_hilos for select to authenticated using ((select ve_dinero_importacion()));
drop policy if exists ver on public.embarque_correos;
create policy ver on public.embarque_correos for select to authenticated using ((select ve_dinero_importacion()));
drop policy if exists ver on public.embarque_propuestas;
create policy ver on public.embarque_propuestas for select to authenticated using ((select ve_dinero_importacion()));
-- Resolverla (aplicada) la hace aplicar_propuesta_embarque con los permisos de quien aplica.
grant update (estado, aplicado, resuelta_por, resuelta_en) on public.embarque_propuestas to authenticated;
drop policy if exists resolver on public.embarque_propuestas;
create policy resolver on public.embarque_propuestas for update to authenticated
  using ((select puede('importaciones', 2)) and (select ve_dinero_importacion()))
  with check ((select puede('importaciones', 2)) and (select ve_dinero_importacion()));

-- Quitar un hilo del embarque (se borran sus correos guardados; en Gmail no se toca nada).
create or replace function public.desligar_hilo_embarque(p_hilo uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not (puede('importaciones', 2) and ve_dinero_importacion()) then
    raise exception 'Solo importaciones liga y quita correos de los embarques' using errcode = '42501';
  end if;
  delete from embarque_hilos where id = p_hilo;
  if not found then raise exception 'Ese hilo ya no está ligado'; end if;
end $$;
revoke execute on function public.desligar_hilo_embarque(uuid) from public, anon;
grant execute on function public.desligar_hilo_embarque(uuid) to authenticated;

-- Lo que propuso la IA. Lo guarda la función del asistente con la sesión de quien la pidió.
create or replace function public.guardar_propuesta_embarque(p_embarque uuid, p_contenido jsonb, p_correos int,
  p_hasta timestamptz, p_modelo text) returns uuid
language plpgsql security definer set search_path = public as $$
declare v uuid;
begin
  if not (puede('importaciones', 2) and ve_dinero_importacion()) then
    raise exception 'Leer los correos de un embarque es de importaciones' using errcode = '42501';
  end if;
  if jsonb_typeof(p_contenido) <> 'object' then raise exception 'Propuesta no válida'; end if;
  -- La anterior que nadie resolvió queda descartada: siempre hay una sola vigente.
  update embarque_propuestas set estado = 'descartada', resuelta_por = auth.uid(), resuelta_en = now()
  where embarque_id = p_embarque and estado = 'nueva';
  insert into embarque_propuestas (embarque_id, contenido, correos, hasta, modelo)
  values (p_embarque, p_contenido, greatest(coalesce(p_correos, 0), 0), p_hasta, p_modelo) returning id into v;
  return v;
end $$;
revoke execute on function public.guardar_propuesta_embarque(uuid, jsonb, int, timestamptz, text) from public, anon;
grant execute on function public.guardar_propuesta_embarque(uuid, jsonb, int, timestamptz, text) to authenticated;

create or replace function public.descartar_propuesta_embarque(p_propuesta uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not (puede('importaciones', 2) and ve_dinero_importacion()) then
    raise exception 'Solo importaciones resuelve lo que propone la IA' using errcode = '42501';
  end if;
  update embarque_propuestas set estado = 'descartada', resuelta_por = auth.uid(), resuelta_en = now()
  where id = p_propuesta and estado = 'nueva';
  if not found then raise exception 'Esa propuesta ya se resolvió'; end if;
end $$;
revoke execute on function public.descartar_propuesta_embarque(uuid) from public, anon;
grant execute on function public.descartar_propuesta_embarque(uuid) to authenticated;

-- Aplicar lo que Alondra marcó. Corre con SUS permisos (security invoker): las fechas pasan por
-- registrar_evento_importacion (nada futuro, el cierre pide la cuenta de gastos), los datos por la
-- política de embarques y el cambio de ETA queda anotado por el disparador de siempre.
--   p_items = { eventos: [{tipo, fecha, detalle}], campos: {eta, etd, bl, …}, documentos: [{tipo, fecha}] }
create or replace function public.aplicar_propuesta_embarque(p_propuesta uuid, p_items jsonb) returns jsonb
language plpgsql security invoker set search_path = public as $$
declare
  pr embarque_propuestas;
  x jsonb;
  k text;
  v_campos constant text[] := array['eta', 'etd', 'bl', 'bl_house', 'contenedores', 'buque', 'viaje', 'naviera', 'forwarder',
                                    'agente_aduanal', 'referencia_agente', 'puerto_origen'];
  v_set text[] := '{}';
  n_ev int := 0; n_campos int := 0; n_docs int := 0;
begin
  if not (puede('importaciones', 2) and ve_dinero_importacion()) then
    raise exception 'Solo importaciones aplica lo que propone la IA' using errcode = '42501';
  end if;
  select * into pr from embarque_propuestas where id = p_propuesta;
  if pr.id is null then raise exception 'No existe esa propuesta'; end if;
  if pr.estado <> 'nueva' then raise exception 'Esa propuesta ya se resolvió: vuelve a leer los correos' using errcode = '23514'; end if;

  for x in select * from jsonb_array_elements(coalesce(p_items->'eventos', '[]')) loop
    perform registrar_evento_importacion(pr.embarque_id, x->>'tipo', (x->>'fecha')::date, nullif(x->>'detalle', ''));
    n_ev := n_ev + 1;
  end loop;

  for k in select jsonb_object_keys(coalesce(p_items->'campos', '{}')) loop
    if not k = any(v_campos) then raise exception 'Ese dato no se cambia desde los correos: %', k; end if;
    if k in ('eta', 'etd') then
      v_set := v_set || format('%I = %L::date', k, (p_items->'campos'->>k)::date);
    else
      v_set := v_set || format('%I = %L', k, nullif(trim(p_items->'campos'->>k), ''));
    end if;
    n_campos := n_campos + 1;
  end loop;
  if n_campos > 0 then
    execute format('update embarques set %s where id = $1', array_to_string(v_set, ', ')) using pr.embarque_id;
    if not found then raise exception 'No puedes cambiar este embarque' using errcode = '42501'; end if;
  end if;

  -- Un documento que llegó por correo: recibido con su fecha. Nunca baja de estado (lo aceptado
  -- o revisado se queda) y el archivo se sube aparte: el correo solo dice que llegó.
  for x in select * from jsonb_array_elements(coalesce(p_items->'documentos', '[]')) loop
    update embarque_documentos set estado = 'recibido', recibido_en = coalesce((x->>'fecha')::date, recibido_en),
      observaciones = concat_ws(' · ', nullif(observaciones, ''), 'Llegó por correo')
    where embarque_id = pr.embarque_id and tipo = x->>'tipo' and estado = 'pendiente';
    n_docs := n_docs + case when found then 1 else 0 end;
  end loop;

  update embarque_propuestas set estado = 'aplicada', aplicado = p_items, resuelta_por = auth.uid(), resuelta_en = now()
  where id = p_propuesta;
  return jsonb_build_object('eventos', n_ev, 'campos', n_campos, 'documentos', n_docs);
end $$;
revoke execute on function public.aplicar_propuesta_embarque(uuid, jsonb) from public, anon;
grant execute on function public.aplicar_propuesta_embarque(uuid, jsonb) to authenticated;

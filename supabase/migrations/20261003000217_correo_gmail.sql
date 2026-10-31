-- =============================================================================
-- Correo desde el ERP con el Gmail de cada quien (primera etapa: mandar).
--
-- La cotización salía por WhatsApp sin adjunto (wa.me no deja) o se descargaba el PDF y se
-- mandaba a mano desde Gmail; la orden de compra igual. Lo mandado así no quedaba en el ERP:
-- nadie sabía a qué correo se fue ni cuándo, y la segunda etapa (leer lo que contestan) no
-- tendría de dónde colgarse. Ahora cada quien conecta su Gmail una vez y manda desde la
-- cotización o la orden; sale de su propia cuenta (las respuestas le llegan a él) y aquí
-- queda a quién, cuándo y el hilo de Gmail.
--
-- La función de borde «correo» habla con Google. Aquí:
--   * correo_cuentas guarda los tokens sin políticas: solo esa función, con la llave de
--     servicio, los lee (igual que ml_cuenta en 119).
--   * correo_preparar() revisa ANTES de mandar que el documento se puede enviar, con las mismas
--     reglas que «Marcar enviada» (freno de seguimientos, precios bajo mínimo, OC sin precio):
--     hace el cambio de verdad y lo deshace. Un correo que sale no se puede regresar.
--   * correo_marcar_enviado() hace el cambio ya con el correo fuera, como la persona (su RLS,
--     sus disparadores): la cotización queda enviada y agenda su seguimiento (172).
--
-- Se pide permiso de leer desde ahora (decisión de dirección): la segunda etapa no obliga a
-- nadie a volver a conectar. Mientras tanto la función no lee nada.
-- =============================================================================

create table if not exists public.correo_cuentas (
  usuario_id uuid primary key references public.perfiles(id) on delete cascade,
  correo text not null,                       -- la cuenta de Google que dio el permiso
  access_token text,
  refresh_token text not null,
  expira_en timestamptz,
  alcances text[] not null default '{}',
  conectada_en timestamptz not null default now(),
  error text,                                 -- «Vuelve a conectar»: Google revocó el permiso
  error_en timestamptz
);
alter table public.correo_cuentas enable row level security;
revoke all on public.correo_cuentas from anon, authenticated;

-- El «state» del permiso: quién lo pidió y hasta cuándo vale (contra un enlace robado).
create table if not exists public.correo_permisos_pendientes (
  state text primary key,
  usuario_id uuid not null references public.perfiles(id) on delete cascade,
  volver_a text,
  creado_en timestamptz not null default now()
);
alter table public.correo_permisos_pendientes enable row level security;
revoke all on public.correo_permisos_pendientes from anon, authenticated;

create table if not exists public.correos_enviados (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.perfiles(id),
  de text not null,
  tipo text not null check (tipo in ('cotizacion', 'orden_compra')),
  documento_id uuid not null,
  folio text,
  para text[] not null,
  cc text[] not null default '{}',
  asunto text not null,
  cuerpo text,
  adjunto text,
  gmail_id text,
  gmail_hilo text,                            -- la segunda etapa lee las respuestas de este hilo
  enviado_en timestamptz not null default now()
);
create index if not exists correos_enviados_documento on public.correos_enviados (tipo, documento_id, enviado_en desc);
alter table public.correos_enviados enable row level security;
revoke insert, update, delete on public.correos_enviados from anon, authenticated;
-- Lo ve quien lo mandó y quien ve el documento (la cotización o la orden: su RLS decide).
drop policy if exists ver on public.correos_enviados;
create policy ver on public.correos_enviados for select to authenticated using (
  usuario_id = (select auth.uid())
  or (tipo = 'cotizacion' and documento_id in (select id from public.cotizaciones))
  or (tipo = 'orden_compra' and documento_id in (select id from public.ordenes_compra)));

-- Mi conexión, sin tokens.
create or replace function public.mi_correo() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce((select jsonb_build_object('conectado', true, 'correo', correo, 'conectada_en', conectada_en,
                                             'error', error, 'lee', alcances @> array['https://www.googleapis.com/auth/gmail.readonly'])
                   from correo_cuentas where usuario_id = auth.uid()), jsonb_build_object('conectado', false))
$$;
revoke execute on function public.mi_correo() from public, anon;
grant execute on function public.mi_correo() to authenticated;

-- Hace el cambio de «enviada» como la persona (RLS y disparadores incluidos). Sirve igual
-- para el ensayo de correo_preparar que para el cambio real.
create or replace function public.correo_cambiar_a_enviado(p_tipo text, p_id uuid) returns void
language plpgsql security invoker set search_path = public as $$
declare v_estado text;
begin
  if p_tipo = 'cotizacion' then
    select estado into v_estado from cotizaciones where id = p_id;
    if v_estado is null then raise exception 'No encontramos la cotización (o es de otro vendedor)' using errcode = '42501'; end if;
    if v_estado in ('enviada', 'aceptada') then return; end if;   -- reenviar no cambia nada
    if v_estado not in ('borrador', 'autorizada') then
      raise exception 'La cotización está %: no se puede enviar', replace(v_estado, '_', ' ');
    end if;
    update cotizaciones set estado = 'enviada' where id = p_id;
    if not found then raise exception 'No puedes enviar esta cotización' using errcode = '42501'; end if;
  elsif p_tipo = 'orden_compra' then
    select estado into v_estado from ordenes_compra where id = p_id;
    if v_estado is null then raise exception 'No encontramos la orden de compra' using errcode = '42501'; end if;
    if v_estado = 'cancelada' then raise exception 'La orden está cancelada'; end if;
    if v_estado = 'borrador' then perform enviar_orden_compra(p_id); end if;
  else
    raise exception 'Tipo de documento no válido';
  end if;
end $$;
-- Es lo mismo que «Marcar enviada» desde la pantalla: corre como la persona y sus reglas la cuidan.
revoke execute on function public.correo_cambiar_a_enviado(text, uuid) from public, anon;
grant execute on function public.correo_cambiar_a_enviado(text, uuid) to authenticated;

-- Antes de mandar: ¿se puede? Y lo que se propone (a quién, asunto, nombre del PDF).
create or replace function public.correo_preparar(p_tipo text, p_id uuid) returns jsonb
language plpgsql security invoker set search_path = public as $$
declare v jsonb; v_msg text;
begin
  if en_vista_previa() then raise exception 'Estás viendo el ERP como otra persona: desde aquí no se mandan correos' using errcode = '42501'; end if;
  if p_tipo = 'cotizacion' then
    if not puede('ventas', 2) then raise exception 'Sin permiso para enviar cotizaciones' using errcode = '42501'; end if;
    select jsonb_build_object('folio', c.folio, 'estado', c.estado, 'para_nombre', coalesce(ct.nombre, c.atencion, cl.nombre),
             'cliente', cl.nombre,
             'para', to_jsonb(array_remove(array[nullif(trim(ct.correo), '')], null)),
             -- Los demás contactos del cliente con correo, para elegir.
             'sugeridos', coalesce((select jsonb_agg(jsonb_build_object('nombre', x.nombre, 'correo', trim(x.correo)) order by x.nombre)
                                    from contactos x where x.cliente_id = c.cliente_id and nullif(trim(x.correo), '') is not null), '[]'),
             'asunto', 'Cotización ' || c.folio || ' · Hegamex',
             'archivo', 'Cotizacion ' || c.folio || '.pdf')
    into v
    from cotizaciones c left join contactos ct on ct.id = c.contacto_id left join clientes cl on cl.id = c.cliente_id
    where c.id = p_id;
  elsif p_tipo = 'orden_compra' then
    if not puede('compras', 2) then raise exception 'Solo compras envía órdenes de compra' using errcode = '42501'; end if;
    select jsonb_build_object('folio', o.folio, 'estado', o.estado, 'para_nombre', p.nombre, 'proveedor', p.nombre,
             'para', to_jsonb(array_remove(array[nullif(trim(p.correo), '')], null)), 'sugeridos', '[]'::jsonb,
             'asunto', 'Orden de compra ' || o.folio || ' · Hegamex',
             'archivo', 'Orden de compra ' || o.folio || '.pdf')
    into v
    from ordenes_compra o join proveedores p on p.id = o.proveedor_id where o.id = p_id;
  else
    raise exception 'Tipo de documento no válido';
  end if;
  if v is null then raise exception 'No encontramos el documento (o no lo puedes ver)' using errcode = '42501'; end if;

  -- El ensayo: el mismo cambio que hará correo_marcar_enviado, deshecho al final.
  begin
    perform correo_cambiar_a_enviado(p_tipo, p_id);
    raise exception using errcode = 'P0099', message = 'ensayo';
  exception
    when sqlstate 'P0099' then null;
    when others then v_msg := sqlerrm; raise exception '%', v_msg using errcode = sqlstate;
  end;
  return v || jsonb_build_object('ya_enviada', v->>'estado' not in ('borrador', 'autorizada'));
end $$;
revoke execute on function public.correo_preparar(text, uuid) from public, anon;
grant execute on function public.correo_preparar(text, uuid) to authenticated;

-- Ya con el correo fuera: el cambio de verdad y, en una cotización, la nota en la bitácora
-- comercial (un correo con la cotización sí es hablar con el cliente).
create or replace function public.correo_marcar_enviado(p_tipo text, p_id uuid, p_para text[]) returns uuid
language plpgsql security invoker set search_path = public as $$
declare v_act uuid; c cotizaciones;
begin
  perform correo_cambiar_a_enviado(p_tipo, p_id);
  if p_tipo = 'cotizacion' then
    select * into c from cotizaciones where id = p_id;
    if c.cliente_id is not null then
      insert into actividades (cliente_id, oportunidad_id, tipo, descripcion, hecha)
      values (c.cliente_id, c.oportunidad_id, 'correo', 'Se le mandó la cotización ' || c.folio || ' por correo a ' || array_to_string(p_para, ', '), true)
      returning id into v_act;
    end if;
  end if;
  return v_act;
end $$;
revoke execute on function public.correo_marcar_enviado(text, uuid, text[]) from public, anon;
grant execute on function public.correo_marcar_enviado(text, uuid, text[]) to authenticated;

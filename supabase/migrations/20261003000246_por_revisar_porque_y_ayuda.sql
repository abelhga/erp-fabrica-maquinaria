-- «Por revisar», dos cambios que pidió dirección (nov 2026):
--
-- 1. «Está bien así» exige el porqué. Muchas respuestas eran malas prácticas («el cliente está
--    decidiendo», por eso la cotización salió sin tiempo de entrega) y nadie las cuestionaba. Con el
--    interruptor `cuestionar_bien_asi` prendido, la IA lee el porqué y, si no le convence, pregunta
--    (tres veces a lo más). Si sigue sin convencer, el hallazgo se queda abierto y le llega a
--    dirección con la conversación. La decisión de la IA la guarda la función con la llave de
--    servicio (`revision_dialogo_ia`), no la pantalla: si no, cualquiera escribía «acepta».
--    Dirección no pasa por la IA: es a quien se le escala.
--
-- 2. «Ayúdame a corregirlo»: la IA propone el cambio exacto y la persona lo acepta. Solo toca los
--    campos de captura de `revision_campos_corregibles` (fechas, tiempo de entrega, notas, contacto,
--    categoría, cantidades de partida): nunca precios, dinero, inventario ni permisos. Se aplica con
--    `revision_aplicar_propuesta`, que corre con los permisos de quien acepta (security invoker):
--    si a mano no podría, tampoco así, y la bitácora lo anota a su nombre.

alter table public.revision_hallazgos add column if not exists escalado_en timestamptz;

update public.configuracion set valor = valor || '{"cuestionar_bien_asi": true}'
where clave = 'revision_nocturna' and not valor ? 'cuestionar_bien_asi';

create or replace function public.revision_configurar(p_cambios jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not tiene_rol('direccion') then raise exception 'Solo dirección' using errcode = '42501'; end if;
  update configuracion set valor = valor || (select coalesce(jsonb_object_agg(k, v), '{}') from jsonb_each(p_cambios) x(k, v)
                                             where k in ('activa', 'claude', 'consejos', 'cuestionar_bien_asi') and jsonb_typeof(v) = 'boolean'),
         actualizado_en = now()
  where clave = 'revision_nocturna';
  update revision_reglas r set activa = (p_cambios->'reglas'->>r.clave)::boolean
  where p_cambios->'reglas' ? r.clave and jsonb_typeof(p_cambios->'reglas'->r.clave) = 'boolean';
end $$;

-- ¿Le toca a quien está en sesión contestar este hallazgo?
create or replace function public.revision_me_toca(h public.revision_hallazgos) returns boolean
language sql stable security definer set search_path = public as $$
  select (h.para = 'responsable' and auth.uid() = any (h.responsables)) or tiene_rol('direccion')
$$;
revoke execute on function public.revision_me_toca(public.revision_hallazgos) from public, anon;

-- ¿La IA cuestiona el porqué? Con el interruptor prendido y si no contesta dirección. El costo
-- atípico no: su detalle trae el costo del artículo y eso no le llega a la IA.
create or replace function public.revision_cuestiona(h public.revision_hallazgos) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select (valor->>'cuestionar_bien_asi')::boolean from configuracion where clave = 'revision_nocturna'), false)
     and not tiene_rol('direccion')
     and coalesce(h.regla, '') <> 'costo_compra_atipico'
$$;
revoke execute on function public.revision_cuestiona(public.revision_hallazgos) from public, anon;

-- 1. ---------------------------------------------------------------------------------------
create table if not exists public.revision_dialogos (
  id bigint generated always as identity primary key,
  hallazgo_id uuid not null references public.revision_hallazgos on delete cascade,
  usuario_id uuid not null references public.perfiles,
  rol text not null check (rol in ('persona', 'ia')),
  texto text not null,
  veredicto text check (veredicto in ('acepta', 'pregunta', 'no_convence')),
  modelo text,
  creado_en timestamptz not null default now(),
  check ((rol = 'ia') = (veredicto is not null))
);
create index if not exists revision_dialogos_hallazgo on public.revision_dialogos (hallazgo_id, usuario_id, id);
alter table public.revision_dialogos enable row level security;
-- Lo ve quien ve el hallazgo (el responsable y dirección). Nadie escribe directo.
drop policy if exists revision_dialogos_ver on public.revision_dialogos;
create policy revision_dialogos_ver on public.revision_dialogos for select to authenticated
  using (hallazgo_id in (select id from public.revision_hallazgos));
grant select on public.revision_dialogos to authenticated;

create or replace function public.revision_responder(p_hallazgo uuid, p_respuesta text, p_nota text default null) returns text
language plpgsql security definer set search_path = public as $$
declare h revision_hallazgos; v_msg text;
begin
  select * into h from revision_hallazgos where id = p_hallazgo for update;
  if h.id is null then raise exception 'No existe ese hallazgo'; end if;
  if not revision_me_toca(h) then raise exception 'Esto no te toca a ti' using errcode = '42501'; end if;
  if h.estado <> 'abierto' then raise exception 'Ya se contestó'; end if;
  if p_respuesta = 'corregir' then
    if h.accion is null then raise exception 'Este hallazgo no tiene una corrección automática: corrígelo y contesta «Ya lo corregí»'; end if;
    v_msg := revision_aplicar_accion(h.accion);
    update revision_hallazgos set estado = 'corregido', respuesta = coalesce(nullif(trim(p_nota), ''), v_msg),
           cerrado_en = now(), cerrado_por = auth.uid() where id = h.id;
    return v_msg;
  elsif p_respuesta = 'corregido' then
    update revision_hallazgos set estado = 'corregido', respuesta = nullif(trim(p_nota), ''), cerrado_en = now(), cerrado_por = auth.uid()
    where id = h.id;
    return 'Gracias: queda como corregido';
  elsif p_respuesta = 'bien_asi' then
    -- Sin porqué no se entiende si era falsa alarma o costumbre, y la revisión no aprende nada.
    if length(trim(coalesce(p_nota, ''))) < 10 then
      raise exception 'Escribe por qué está bien (una frase completa): así se entiende y no vuelve a salir' using errcode = '23514';
    end if;
    if h.escalado_en is not null and not tiene_rol('direccion') then
      raise exception 'Este ya lo está viendo dirección' using errcode = '42501';
    end if;
    if revision_cuestiona(h) then
      raise exception 'La IA revisa primero el porqué: contéstalo desde «Por revisar»' using errcode = '42501';
    end if;
    update revision_hallazgos set estado = 'bien_asi', respuesta = trim(p_nota), cerrado_en = now(), cerrado_por = auth.uid()
    where id = h.id;
    return 'Listo: no vuelve a salir';
  else
    raise exception 'Respuesta no válida';
  end if;
end $$;
revoke execute on function public.revision_responder(uuid, text, text) from public, anon;
grant execute on function public.revision_responder(uuid, text, text) to authenticated;

-- La persona dice «Está bien así» (o contesta la pregunta de la IA). Si nadie lo cuestiona, se cierra
-- aquí mismo; si sí, queda su turno anotado y la pantalla le pide a la IA que lo lea.
-- Con p_texto vacío y su turno ya anotado es un reintento (la IA falló a medias).
create or replace function public.revision_bien_asi(p_hallazgo uuid, p_texto text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare h revision_hallazgos; v_ultimo text; v_turnos int; v_texto text := trim(coalesce(p_texto, ''));
begin
  select * into h from revision_hallazgos where id = p_hallazgo for update;
  if h.id is null then raise exception 'No existe ese hallazgo'; end if;
  if not revision_me_toca(h) then raise exception 'Esto no te toca a ti' using errcode = '42501'; end if;
  if h.estado <> 'abierto' then raise exception 'Ya se contestó'; end if;
  if not revision_cuestiona(h) then
    return jsonb_build_object('estado', 'cerrado', 'mensaje', revision_responder(p_hallazgo, 'bien_asi', v_texto));
  end if;
  if h.escalado_en is not null then raise exception 'Este ya lo está viendo dirección' using errcode = '42501'; end if;

  select rol into v_ultimo from revision_dialogos where hallazgo_id = h.id and usuario_id = auth.uid() order by id desc limit 1;
  select count(*) into v_turnos from revision_dialogos where hallazgo_id = h.id and usuario_id = auth.uid() and rol = 'persona';
  if v_ultimo = 'persona' then
    if v_texto = '' then return jsonb_build_object('estado', 'revisar'); end if;
    raise exception 'La IA todavía no contesta lo anterior' using errcode = '55000';
  end if;
  if v_turnos = 0 and length(v_texto) < 10 then
    raise exception 'Escribe por qué está bien (una frase completa): así se entiende y no vuelve a salir' using errcode = '23514';
  elsif length(v_texto) < 2 then
    raise exception 'Escribe tu respuesta' using errcode = '23514';
  end if;
  insert into revision_dialogos (hallazgo_id, usuario_id, rol, texto) values (h.id, auth.uid(), 'persona', left(v_texto, 1500));
  return jsonb_build_object('estado', 'revisar');
end $$;
revoke execute on function public.revision_bien_asi(uuid, text) from public, anon;
grant execute on function public.revision_bien_asi(uuid, text) to authenticated;

-- Lo que la función de la IA necesita para leer el porqué. Solo si hay un turno de la persona
-- esperando: así la IA no se llama de gratis ni dos veces por el mismo turno.
create or replace function public.revision_dialogo_contexto(p_hallazgo uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare h revision_hallazgos; v_dialogo jsonb;
begin
  select * into h from revision_hallazgos where id = p_hallazgo;
  if h.id is null or not revision_me_toca(h) then raise exception 'Esto no te toca a ti' using errcode = '42501'; end if;
  if h.estado <> 'abierto' then raise exception 'Ya se contestó'; end if;
  if not revision_cuestiona(h) then raise exception 'Este no lo revisa la IA' using errcode = '55000'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('rol', rol, 'texto', texto, 'veredicto', veredicto) order by id), '[]') into v_dialogo
  from revision_dialogos where hallazgo_id = h.id and usuario_id = auth.uid();
  if v_dialogo->-1->>'rol' is distinct from 'persona' then raise exception 'No hay nada que la IA tenga que leer' using errcode = '55000'; end if;
  return jsonb_build_object(
    'hallazgo', jsonb_build_object('titulo', h.titulo, 'detalle', h.detalle, 'evidencia', h.evidencia, 'modulo', h.modulo,
                                   'origen', h.origen, 'regla', h.regla, 'creado_en', h.creado_en::date),
    'dialogo', v_dialogo,
    'preguntas', (select count(*) from jsonb_array_elements(v_dialogo) d where d->>'veredicto' = 'pregunta'));
end $$;
revoke execute on function public.revision_dialogo_contexto(uuid) from public, anon;
grant execute on function public.revision_dialogo_contexto(uuid) to authenticated;

-- La respuesta de la IA. Solo la llave de servicio (la función del asistente) la escribe.
create or replace function public.revision_dialogo_ia(p_hallazgo uuid, p_usuario uuid, p_texto text, p_veredicto text, p_modelo text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare h revision_hallazgos; v_ultimo text; v_preguntas int; v_veredicto text := p_veredicto; v_porque text;
begin
  if v_veredicto not in ('acepta', 'pregunta', 'no_convence') then raise exception 'Veredicto no válido'; end if;
  select * into h from revision_hallazgos where id = p_hallazgo for update;
  if h.id is null or h.estado <> 'abierto' then raise exception 'Ese hallazgo ya no está abierto'; end if;
  select rol into v_ultimo from revision_dialogos where hallazgo_id = h.id and usuario_id = p_usuario order by id desc limit 1;
  if v_ultimo is distinct from 'persona' then raise exception 'No hay nada que contestar'; end if;
  select count(*) into v_preguntas from revision_dialogos where hallazgo_id = h.id and usuario_id = p_usuario and veredicto = 'pregunta';
  -- Tres preguntas a lo más: la cuarta ya no se hace, se escala.
  if v_veredicto = 'pregunta' and v_preguntas >= 3 then v_veredicto := 'no_convence'; end if;
  insert into revision_dialogos (hallazgo_id, usuario_id, rol, texto, veredicto, modelo)
  values (h.id, p_usuario, 'ia', left(coalesce(nullif(trim(p_texto), ''), '—'), 1500), v_veredicto, p_modelo);

  select string_agg(texto, ' / ' order by id) into v_porque
  from revision_dialogos where hallazgo_id = h.id and usuario_id = p_usuario and rol = 'persona';
  if v_veredicto = 'acepta' then
    update revision_hallazgos set estado = 'bien_asi', respuesta = v_porque, cerrado_en = now(), cerrado_por = p_usuario where id = h.id;
  elsif v_veredicto = 'no_convence' then
    update revision_hallazgos set escalado_en = now() where id = h.id;
    perform avisar(array(select usuarios_con_rol('direccion')), 'revision',
      format('«Está bien así» sin convencer: %s', h.titulo),
      format('%s dice: «%s». La IA preguntó y no quedó claro; está abierto en Por revisar con la conversación.',
             coalesce((select nombre from perfiles where id = p_usuario), 'Alguien'), left(v_porque, 300)),
      '/revision', 'revision_hallazgos', h.id::text);
  end if;
  return jsonb_build_object('veredicto', v_veredicto, 'texto', p_texto, 'preguntas', v_preguntas + (v_veredicto = 'pregunta')::int);
end $$;
revoke execute on function public.revision_dialogo_ia(uuid, uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.revision_dialogo_ia(uuid, uuid, text, text, text) to service_role;

-- 2. ---------------------------------------------------------------------------------------
-- Lo único que «Ayúdame a corregirlo» puede cambiar. `padre` es la columna que liga una tabla hija
-- (las partidas) con el registro del hallazgo; `solo_vacio`, que solo se llena si falta.
create table if not exists public.revision_campos_corregibles (
  tabla text not null,
  campo text not null,
  etiqueta text not null,
  padre_tabla text,
  padre_columna text,
  solo_vacio boolean not null default false,
  primary key (tabla, campo)
);
alter table public.revision_campos_corregibles enable row level security;
drop policy if exists revision_campos_corregibles_ver on public.revision_campos_corregibles;
create policy revision_campos_corregibles_ver on public.revision_campos_corregibles for select to authenticated using (true);
grant select on public.revision_campos_corregibles to authenticated;

insert into public.revision_campos_corregibles (tabla, campo, etiqueta, padre_tabla, padre_columna, solo_vacio) values
  ('cotizaciones', 'tiempo_entrega', 'Tiempo de entrega', null, null, false),
  ('cotizaciones', 'vigencia_dias', 'Vigencia (días)', null, null, false),
  ('cotizaciones', 'atencion', 'Atención a', null, null, false),
  ('cotizaciones', 'contacto_id', 'Contacto', null, null, true),
  ('cotizacion_lineas', 'cantidad', 'Cantidad de la partida', 'cotizaciones', 'cotizacion_id', false),
  ('clientes', 'ciudad', 'Ciudad', null, null, false),
  ('clientes', 'estado', 'Estado', null, null, false),
  ('clientes', 'giro', 'Giro', null, null, false),
  ('clientes', 'notas', 'Notas', null, null, false),
  ('leads', 'ciudad', 'Ciudad', null, null, false),
  ('leads', 'estado_mx', 'Estado', null, null, false),
  ('leads', 'interes', 'Qué busca', null, null, false),
  ('leads', 'notas', 'Notas', null, null, false),
  ('ordenes_compra', 'fecha_entrega', 'Fecha de entrega', null, null, false),
  ('ordenes_compra', 'notas', 'Notas', null, null, false),
  ('ordenes_produccion', 'fecha_compromiso', 'Fecha compromiso', null, null, false),
  ('ordenes_produccion', 'inicio_plan', 'Inicio planeado', null, null, false),
  ('ordenes_produccion', 'notas', 'Notas', null, null, false),
  ('pedidos', 'fecha_compromiso', 'Fecha compromiso', null, null, false),
  ('pedidos', 'notas', 'Notas', null, null, false),
  ('articulos', 'categoria_id', 'Categoría', null, null, false)
on conflict (tabla, campo) do update set etiqueta = excluded.etiqueta, padre_tabla = excluded.padre_tabla,
  padre_columna = excluded.padre_columna, solo_vacio = excluded.solo_vacio;

create or replace function public.revision_tipo_columna(p_tabla text, p_campo text) returns text
language sql stable set search_path = public as $$
  select format_type(a.atttypid, a.atttypmod) from pg_attribute a
  where a.attrelid = to_regclass('public.' || quote_ident(p_tabla)) and a.attname = p_campo and not a.attisdropped
$$;

-- Cómo se lee un valor para la persona: el nombre del contacto o de la categoría, no su número.
create or replace function public.revision_valor_legible(p_campo text, p_valor text) returns text
language sql stable security definer set search_path = public as $$
  select case
    when p_valor is null or p_valor = '' then '(vacío)'
    when p_campo = 'contacto_id' then coalesce((select nombre from contactos where id::text = p_valor), p_valor)
    when p_campo = 'categoria_id' then coalesce((select nombre from categorias where id::text = p_valor), p_valor)
    else p_valor end
$$;
revoke execute on function public.revision_valor_legible(text, text) from public, anon, authenticated;

-- ¿Este hallazgo admite «Ayúdame a corregirlo»? Su registro es de una tabla de la lista.
create or replace function public.revision_tablas_corregibles() returns text[]
language sql stable set search_path = public as $$
  select array_agg(distinct coalesce(padre_tabla, tabla)) from revision_campos_corregibles
$$;
grant execute on function public.revision_tablas_corregibles() to authenticated;

-- Lo que la IA necesita para proponer: el hallazgo y los campos corregibles del registro (y de sus
-- partidas), leídos con los permisos de quien pide (security invoker: lo que no ve, no se manda).
create or replace function public.revision_ayuda_contexto(p_hallazgo uuid) returns jsonb
language plpgsql stable security invoker set search_path = public as $$
declare h revision_hallazgos; c record; v_reg jsonb; v_hijos jsonb := '[]'; v_campos jsonb; v_opciones jsonb := '{}'; v_cols text; v_filas jsonb;
begin
  select * into h from revision_hallazgos where id = p_hallazgo;
  if h.id is null or not revision_me_toca(h) then raise exception 'Esto no te toca a ti' using errcode = '42501'; end if;
  if h.estado <> 'abierto' then raise exception 'Ya se contestó'; end if;
  if h.registro_id is null or not exists (select 1 from revision_campos_corregibles where coalesce(padre_tabla, tabla) = h.tabla) then
    raise exception 'Este hallazgo no se corrige con un cambio de captura: ábrelo y corrígelo a mano' using errcode = '55000';
  end if;

  select jsonb_agg(jsonb_build_object('tabla', tabla, 'campo', campo, 'etiqueta', etiqueta, 'tipo', revision_tipo_columna(tabla, campo),
                                      'solo_si_esta_vacio', solo_vacio) order by tabla, campo)
  into v_campos from revision_campos_corregibles where coalesce(padre_tabla, tabla) = h.tabla;

  select string_agg(quote_ident(campo), ', ') into v_cols from revision_campos_corregibles where tabla = h.tabla;
  execute format('select to_jsonb(x) from (select id%s from %I where id = $1::%s) x',
                 coalesce(', ' || v_cols, ''), h.tabla, revision_tipo_columna(h.tabla, 'id')) using h.registro_id into v_reg;
  if v_reg is null then raise exception 'No ves ese registro: pídele a quien lo capturó que lo corrija' using errcode = '42501'; end if;

  for c in select tabla, padre_columna, string_agg(quote_ident(campo), ', ') cols from revision_campos_corregibles
           where padre_tabla = h.tabla group by tabla, padre_columna loop
    execute format('select coalesce(jsonb_agg(to_jsonb(x)), ''[]'') from (select id, %s%s from %I where %I = $1::%s) x',
                   c.cols, case when c.tabla = 'cotizacion_lineas' then ', orden, titulo' else '' end, c.tabla, c.padre_columna,
                   revision_tipo_columna(c.tabla, c.padre_columna))
      using h.registro_id into v_filas;
    v_hijos := v_hijos || jsonb_build_array(jsonb_build_object('tabla', c.tabla, 'filas', v_filas));
  end loop;

  if h.tabla = 'cotizaciones' then
    v_opciones := jsonb_build_object('contacto_id', (select coalesce(jsonb_agg(jsonb_build_object('id', ct.id, 'nombre', ct.nombre, 'puesto', ct.puesto)), '[]')
      from cotizaciones q join contactos ct on ct.cliente_id = q.cliente_id where q.id::text = h.registro_id));
  elsif h.tabla = 'articulos' then
    v_opciones := jsonb_build_object('categoria_id', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'nombre', nombre) order by nombre), '[]') from categorias));
  end if;

  return jsonb_build_object(
    'hallazgo', jsonb_build_object('titulo', h.titulo, 'detalle', h.detalle, 'evidencia', h.evidencia, 'modulo', h.modulo, 'origen', h.origen,
                                   'regla', h.regla),
    'registro', jsonb_build_object('tabla', h.tabla, 'valores', v_reg),
    'partidas', v_hijos, 'campos', v_campos, 'opciones', v_opciones,
    'hoy', (now() at time zone 'America/Mexico_City')::date);
end $$;
revoke execute on function public.revision_ayuda_contexto(uuid) from public, anon;
grant execute on function public.revision_ayuda_contexto(uuid) to authenticated;

-- La propuesta de la IA, ya revisada contra la lista. Solo la escribe la llave de servicio.
create table if not exists public.revision_propuestas (
  id uuid primary key default gen_random_uuid(),
  hallazgo_id uuid not null references public.revision_hallazgos on delete cascade,
  usuario_id uuid not null references public.perfiles,
  -- [{tabla, id, campo, etiqueta, antes, despues, antes_texto, despues_texto}]
  cambios jsonb not null,
  explicacion text not null,
  modelo text,
  estado text not null default 'propuesta' check (estado in ('propuesta', 'aplicada')),
  creado_en timestamptz not null default now(),
  aplicada_en timestamptz
);
create index if not exists revision_propuestas_hallazgo on public.revision_propuestas (hallazgo_id);
alter table public.revision_propuestas enable row level security;
drop policy if exists revision_propuestas_ver on public.revision_propuestas;
create policy revision_propuestas_ver on public.revision_propuestas for select to authenticated
  using (usuario_id = (select auth.uid()) or (select tiene_rol('direccion')));
grant select on public.revision_propuestas to authenticated;

create or replace function public.revision_propuesta_guardar(p_hallazgo uuid, p_usuario uuid, p_cambios jsonb, p_explicacion text, p_modelo text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare h revision_hallazgos; c jsonb; f revision_campos_corregibles; v_antes text; v_padre text; v_ok jsonb := '[]'; v_id uuid;
begin
  select * into h from revision_hallazgos where id = p_hallazgo;
  if h.id is null or h.estado <> 'abierto' then raise exception 'Ese hallazgo ya no está abierto'; end if;
  for c in select * from jsonb_array_elements(coalesce(p_cambios, '[]')) loop
    select * into f from revision_campos_corregibles where tabla = c->>'tabla' and campo = c->>'campo';
    continue when f.tabla is null;
    -- Solo el registro del hallazgo o una partida suya: la IA no toca otra cosa aunque la nombre.
    if f.padre_tabla is null then
      continue when f.tabla <> h.tabla or c->>'id' is distinct from h.registro_id;
    else
      continue when f.padre_tabla <> h.tabla;
      begin
        execute format('select %I::text from %I where id = $1::%s', f.padre_columna, f.tabla, revision_tipo_columna(f.tabla, 'id'))
          using c->>'id' into v_padre;
      exception when others then v_padre := null; end;
      continue when v_padre is distinct from h.registro_id;
    end if;
    begin
      execute format('select %I::text from %I where id = $1::%s', f.campo, f.tabla, revision_tipo_columna(f.tabla, 'id'))
        using c->>'id' into v_antes;
      -- Que el valor nuevo sea del tipo de la columna (una fecha que no es fecha no llega a la pantalla).
      execute format('select $1::%s', revision_tipo_columna(f.tabla, f.campo)) using c->>'valor';
    exception when others then continue;
    end;
    continue when f.solo_vacio and coalesce(v_antes, '') <> '';
    continue when coalesce(c->>'valor', '') = '' or c->>'valor' is not distinct from v_antes;
    v_ok := v_ok || jsonb_build_array(jsonb_build_object('tabla', f.tabla, 'id', c->>'id', 'campo', f.campo, 'etiqueta', f.etiqueta,
      'antes', v_antes, 'despues', c->>'valor',
      'antes_texto', revision_valor_legible(f.campo, v_antes), 'despues_texto', revision_valor_legible(f.campo, c->>'valor')));
  end loop;
  if jsonb_array_length(v_ok) = 0 then return jsonb_build_object('id', null, 'cambios', '[]'::jsonb); end if;
  insert into revision_propuestas (hallazgo_id, usuario_id, cambios, explicacion, modelo)
  values (h.id, p_usuario, v_ok, left(coalesce(nullif(trim(p_explicacion), ''), 'Propuesta de la IA'), 1000), p_modelo)
  returning id into v_id;
  return jsonb_build_object('id', v_id, 'cambios', v_ok);
end $$;
revoke execute on function public.revision_propuesta_guardar(uuid, uuid, jsonb, text, text) from public, anon, authenticated;
grant execute on function public.revision_propuesta_guardar(uuid, uuid, jsonb, text, text) to service_role;

-- Cierra el hallazgo como corregido, pero solo si lo propuesto de verdad quedó en la base: así nadie
-- marca «corregido con la IA» sin haber aplicado nada.
create or replace function public.revision_propuesta_cerrar(p_propuesta uuid) returns text
language plpgsql security definer set search_path = public as $$
declare p revision_propuestas; c jsonb; v_igual boolean; v_resumen text;
begin
  select * into p from revision_propuestas where id = p_propuesta and usuario_id = auth.uid() and estado = 'propuesta' for update;
  if p.id is null then raise exception 'Esa propuesta ya no está' using errcode = '42501'; end if;
  for c in select * from jsonb_array_elements(p.cambios) loop
    -- Comparado ya convertido: «45» y «45.000» son la misma cantidad.
    execute format('select %I = $2::%s from %I where id = $1::%s', c->>'campo', revision_tipo_columna(c->>'tabla', c->>'campo'),
                   c->>'tabla', revision_tipo_columna(c->>'tabla', 'id'))
      using c->>'id', c->>'despues' into v_igual;
    if v_igual is not true then raise exception 'El cambio no quedó aplicado'; end if;
  end loop;
  select string_agg(format('%s: %s → %s', x->>'etiqueta', x->>'antes_texto', x->>'despues_texto'), '; ') into v_resumen
  from jsonb_array_elements(p.cambios) x;
  update revision_propuestas set estado = 'aplicada', aplicada_en = now() where id = p.id;
  perform revision_responder(p.hallazgo_id, 'corregido', 'Corregido con ayuda de la IA. ' || v_resumen);
  return 'Listo: quedó corregido a tu nombre';
end $$;
revoke execute on function public.revision_propuesta_cerrar(uuid) from public, anon;
grant execute on function public.revision_propuesta_cerrar(uuid) to authenticated;

-- Aplica la propuesta con los permisos de quien la acepta (security invoker): pasa por la RLS y por
-- los disparadores igual que si lo capturara a mano, y la bitácora lo anota a su nombre.
create or replace function public.revision_aplicar_propuesta(p_propuesta uuid) returns text
language plpgsql security invoker set search_path = public as $$
declare p revision_propuestas; c jsonb; v_n int;
begin
  select * into p from revision_propuestas where id = p_propuesta and usuario_id = auth.uid() and estado = 'propuesta';
  if p.id is null then raise exception 'Esa propuesta ya no está' using errcode = '42501'; end if;
  for c in select * from jsonb_array_elements(p.cambios) loop
    if not exists (select 1 from revision_campos_corregibles where tabla = c->>'tabla' and campo = c->>'campo') then
      raise exception 'Ese campo no se corrige así' using errcode = '42501';
    end if;
    execute format('update %I set %I = $1::%s where id = $2::%s', c->>'tabla', c->>'campo',
                   revision_tipo_columna(c->>'tabla', c->>'campo'), revision_tipo_columna(c->>'tabla', 'id'))
      using c->>'despues', c->>'id';
    get diagnostics v_n = row_count;
    if v_n = 0 then
      raise exception 'No tienes permiso de cambiar «%» ahí (o ya no se puede editar): pídeselo a quien lo capturó', c->>'etiqueta'
        using errcode = '42501';
    end if;
  end loop;
  return revision_propuesta_cerrar(p.id);
end $$;
revoke execute on function public.revision_aplicar_propuesta(uuid) from public, anon;
grant execute on function public.revision_aplicar_propuesta(uuid) to authenticated;

-- Las de arriba que se usan desde funciones security invoker corren como quien está en sesión.
grant execute on function public.revision_me_toca(public.revision_hallazgos) to authenticated;
grant execute on function public.revision_tipo_columna(text, text) to authenticated;

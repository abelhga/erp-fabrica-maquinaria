-- =============================================================================
-- Mejoras (kaizen), con A3 para las grandes, ligadas a lo que el piso ya reporta.
--
-- El piso ya avisa de lo que estorba: «Problema» en la terminal, las pausas con motivo, las
-- etapas que se reabren y las fallas de máquinas. Hasta hoy eso se quedaba en la línea de
-- tiempo de cada orden y nadie le daba seguimiento. Aquí cada problema puede volverse una
-- mejora con responsable, fecha y resultado, y cualquiera del piso puede proponer una idea
-- (también desde la terminal, con su nombre: el reconocimiento es parte del kaizen).
--
-- Quién: ve y propone quien es de producción (nivel 2) o de procesos; la decide (la pone en
-- marcha, la descarta, asigna responsable, la vuelve A3) ingeniería de procesos, la gerencia
-- de producción y dirección (procesos 2+). El responsable la trabaja y la marca hecha.
-- Todo se escribe por funciones: la tabla solo tiene política de lectura.
-- =============================================================================

create table public.mejoras (
  id uuid primary key default gen_random_uuid(),
  -- KZ-12: lo que se dice en la junta.
  numero int generated always as identity unique,
  titulo text not null check (length(trim(titulo)) between 3 and 140),
  problema text,
  propuesta text,
  etapa_id int references public.etapas(id),
  -- Los ocho desperdicios de lean, para ver dónde se nos va más.
  desperdicio text check (desperdicio in ('espera', 'transporte', 'movimiento', 'inventario', 'sobreproceso',
                                          'sobreproduccion', 'defectos', 'talento')),
  tipo text not null default 'kaizen' check (tipo in ('kaizen', 'a3')),
  estado text not null default 'propuesta' check (estado in ('propuesta', 'en_marcha', 'hecha', 'descartada')),
  -- De dónde salió: un problema, pausa o etapa reabierta del piso, o una falla de máquina.
  evento_id bigint references public.op_eventos(id) on delete set null,
  mantenimiento_id uuid references public.ordenes_mantenimiento(id) on delete set null,
  -- Lo que agrega el A3 (antecedentes y situación actual van en «problema»; contramedidas, en «propuesta»).
  objetivo text,
  causa_raiz text,
  plan text,
  responsable_id uuid references public.perfiles(id),
  fecha_compromiso date,
  resultado text,
  ahorro_horas_mes numeric(8, 1) check (ahorro_horas_mes >= 0),
  -- Rutas en el bucket «mejoras» (<id de la mejora>/…).
  foto_antes text,
  foto_despues text,
  motivo_descarte text,
  -- En la tablet del piso la cuenta es compartida: el nombre de quien tuvo la idea va aparte.
  propuesta_por uuid references public.perfiles(id) default auth.uid(),
  quien_propone text,
  propuesta_en timestamptz not null default now(),
  en_marcha_en timestamptz,
  hecha_en timestamptz,
  descartada_en timestamptz,
  actualizado_en timestamptz not null default now()
);
-- Un problema del piso se vuelve una sola mejora.
create unique index mejoras_un_evento on public.mejoras (evento_id) where evento_id is not null;
create unique index mejoras_una_falla on public.mejoras (mantenimiento_id) where mantenimiento_id is not null;
create index mejoras_estado on public.mejoras (estado, propuesta_en desc);

alter table public.mejoras enable row level security;
create policy ver on public.mejoras for select to authenticated
  using ((select puede('produccion', 2)) or (select puede('procesos', 1)));
-- Sin política de escritura y, por si acaso, sin el privilegio: solo las funciones escriben.
revoke insert, update, delete, truncate on public.mejoras from anon, authenticated;
create trigger auditar after insert or update or delete on public.mejoras for each row execute function public.auditar();
do $$ begin
  alter publication supabase_realtime add table public.mejoras;
exception when duplicate_object then null; when undefined_object then null;
end $$;

-- Con nombres, área y de dónde salió, para el tablero y la ficha.
create view public.v_mejoras with (security_invoker = true) as
select m.*,
  'KZ-' || m.numero as folio,
  et.nombre as etapa, et.color as etapa_color,
  r.nombre as responsable,
  coalesce(nullif(trim(m.quien_propone), ''), p.nombre) as propuso,
  m.estado = 'en_marcha' and m.fecha_compromiso < public.hoy_mx() as vencida,
  case when m.evento_id is not null then 'piso' when m.mantenimiento_id is not null then 'maquina' end as origen,
  ev.tipo as origen_tipo, ev.nota as origen_nota, coalesce(ev.en, om.reportado_en) as origen_en,
  ev.orden_id as origen_orden_id, o.folio as origen_folio,
  om.maquina_id as origen_maquina_id, mq.nombre as origen_maquina, om.falla as origen_falla
from public.mejoras m
left join public.etapas et on et.id = m.etapa_id
left join public.perfiles r on r.id = m.responsable_id
left join public.perfiles p on p.id = m.propuesta_por
left join public.op_eventos ev on ev.id = m.evento_id
left join public.ordenes_produccion o on o.id = ev.orden_id
left join public.ordenes_mantenimiento om on om.id = m.mantenimiento_id
left join public.maquinas mq on mq.id = om.maquina_id;

-- A quién le llega «hay una idea nueva»: quien decide las mejoras de verdad (no dirección: sería ruido).
create or replace function public._gestores_mejoras() returns uuid[]
language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(distinct usuario_id), '{}') from usuario_roles where rol in ('ingenieria_procesos', 'gerente_produccion')
$$;
revoke execute on function public._gestores_mejoras() from public, anon, authenticated;

-- Proponer: una idea suelta o un problema del piso (evento) o de una máquina (falla).
create or replace function public.proponer_mejora(
  p_titulo text, p_problema text default null, p_propuesta text default null, p_etapa int default null,
  p_evento bigint default null, p_mantenimiento uuid default null, p_quien text default null, p_desperdicio text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_etapa int := p_etapa; v_titulo text := nullif(trim(p_titulo), '');
begin
  if not (puede('produccion', 2) or puede('procesos', 1)) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  if v_titulo is null then raise exception 'Escribe en una línea qué se puede mejorar'; end if;
  if p_evento is not null then
    if not exists (select 1 from op_eventos where id = p_evento and (tipo in ('problema', 'reabierta') or (tipo = 'pausa' and nota is not null))) then
      raise exception 'Ese evento no es un problema del piso';
    end if;
    if exists (select 1 from mejoras where evento_id = p_evento) then raise exception 'Ese problema ya tiene su mejora'; end if;
    -- Si no dijeron el área, la de la etapa donde pasó.
    v_etapa := coalesce(v_etapa, (select x.etapa_id from op_eventos e join op_operaciones x on x.id = e.operacion_id where e.id = p_evento));
  end if;
  if p_mantenimiento is not null then
    if not exists (select 1 from ordenes_mantenimiento where id = p_mantenimiento and tipo = 'correctivo') then
      raise exception 'Esa orden de mantenimiento no es una falla';
    end if;
    if exists (select 1 from mejoras where mantenimiento_id = p_mantenimiento) then raise exception 'Esa falla ya tiene su mejora'; end if;
    v_etapa := coalesce(v_etapa, (select q.etapa_id from ordenes_mantenimiento om join maquinas q on q.id = om.maquina_id where om.id = p_mantenimiento));
  end if;

  insert into mejoras (titulo, problema, propuesta, etapa_id, evento_id, mantenimiento_id, quien_propone, desperdicio)
  values (v_titulo, nullif(trim(p_problema), ''), nullif(trim(p_propuesta), ''), v_etapa, p_evento, p_mantenimiento,
          nullif(trim(p_quien), ''), p_desperdicio)
  returning id into v_id;

  perform avisar(_gestores_mejoras(), 'mejora_nueva', 'Idea de mejora: ' || v_titulo,
    coalesce('Propone ' || nullif(trim(p_quien), '') || '. ', '') || coalesce(nullif(trim(p_problema), ''), ''),
    '/produccion/mejoras?mejora=' || v_id, 'mejoras', v_id::text);
  return v_id;
end $$;
revoke execute on function public.proponer_mejora(text, text, text, int, bigint, uuid, text, text) from public, anon;
grant execute on function public.proponer_mejora(text, text, text, int, bigint, uuid, text, text) to authenticated;

-- Editar. Quien decide cambia todo; el responsable, lo que le toca trabajar (A3, plan, resultado,
-- fotos); quien la propuso, su idea mientras sigue en propuesta.
create or replace function public.editar_mejora(p_id uuid, p_datos jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare
  m mejoras; k text; v_gestor boolean := puede('procesos', 2);
  v_todos text[] := array['titulo', 'problema', 'propuesta', 'etapa_id', 'desperdicio', 'tipo', 'objetivo', 'causa_raiz', 'plan',
                          'responsable_id', 'fecha_compromiso', 'resultado', 'ahorro_horas_mes', 'foto_antes', 'foto_despues'];
  v_responsable text[] := array['problema', 'propuesta', 'objetivo', 'causa_raiz', 'plan', 'resultado', 'ahorro_horas_mes', 'foto_antes', 'foto_despues'];
  v_autor text[] := array['titulo', 'problema', 'propuesta', 'etapa_id', 'desperdicio', 'foto_antes'];
  v_puede text[];
begin
  select * into m from mejoras where id = p_id for update;
  if m.id is null or not (puede('produccion', 2) or puede('procesos', 1)) then raise exception 'No existe esa mejora' using errcode = '42501'; end if;
  v_puede := case
    when v_gestor then v_todos
    when m.responsable_id = auth.uid() and m.estado in ('propuesta', 'en_marcha') then v_responsable
    when m.propuesta_por = auth.uid() and m.estado = 'propuesta' then v_autor
    else '{}' end;
  for k in select jsonb_object_keys(coalesce(p_datos, '{}')) loop
    if not k = any(v_todos) then raise exception 'Campo desconocido: %', k; end if;
    if not k = any(v_puede) then raise exception 'Sin permiso para cambiar eso' using errcode = '42501'; end if;
  end loop;
  -- Las fotos van en la carpeta de su mejora (la política del bucket ya deja subir solo ahí).
  if (p_datos->>'foto_antes') not like p_id || '/%' or (p_datos->>'foto_despues') not like p_id || '/%' then
    raise exception 'La foto no es de esta mejora';
  end if;
  if p_datos ? 'responsable_id' and (p_datos->>'responsable_id') is not null
     and not exists (select 1 from personas_mejoras() x where x.id = (p_datos->>'responsable_id')::uuid) then
    raise exception 'Esa persona no puede llevar mejoras (no es de producción ni de procesos)';
  end if;

  update mejoras set
    titulo = case when p_datos ? 'titulo' then coalesce(nullif(trim(p_datos->>'titulo'), ''), titulo) else titulo end,
    problema = case when p_datos ? 'problema' then nullif(trim(p_datos->>'problema'), '') else problema end,
    propuesta = case when p_datos ? 'propuesta' then nullif(trim(p_datos->>'propuesta'), '') else propuesta end,
    etapa_id = case when p_datos ? 'etapa_id' then (p_datos->>'etapa_id')::int else etapa_id end,
    desperdicio = case when p_datos ? 'desperdicio' then nullif(p_datos->>'desperdicio', '') else desperdicio end,
    tipo = case when p_datos ? 'tipo' then p_datos->>'tipo' else tipo end,
    objetivo = case when p_datos ? 'objetivo' then nullif(trim(p_datos->>'objetivo'), '') else objetivo end,
    causa_raiz = case when p_datos ? 'causa_raiz' then nullif(trim(p_datos->>'causa_raiz'), '') else causa_raiz end,
    plan = case when p_datos ? 'plan' then nullif(trim(p_datos->>'plan'), '') else plan end,
    responsable_id = case when p_datos ? 'responsable_id' then (p_datos->>'responsable_id')::uuid else responsable_id end,
    fecha_compromiso = case when p_datos ? 'fecha_compromiso' then (p_datos->>'fecha_compromiso')::date else fecha_compromiso end,
    resultado = case when p_datos ? 'resultado' then nullif(trim(p_datos->>'resultado'), '') else resultado end,
    ahorro_horas_mes = case when p_datos ? 'ahorro_horas_mes' then (p_datos->>'ahorro_horas_mes')::numeric else ahorro_horas_mes end,
    foto_antes = case when p_datos ? 'foto_antes' then p_datos->>'foto_antes' else foto_antes end,
    foto_despues = case when p_datos ? 'foto_despues' then p_datos->>'foto_despues' else foto_despues end,
    actualizado_en = now()
  where id = p_id;

  -- Al nuevo responsable le llega el aviso.
  if p_datos ? 'responsable_id' and (p_datos->>'responsable_id')::uuid is distinct from m.responsable_id then
    perform avisar(array[(p_datos->>'responsable_id')::uuid], 'mejora_responsable', 'Te toca llevar la mejora KZ-' || m.numero,
      m.titulo, '/produccion/mejoras?mejora=' || p_id, 'mejoras', p_id::text);
  end if;
end $$;
revoke execute on function public.editar_mejora(uuid, jsonb) from public, anon;
grant execute on function public.editar_mejora(uuid, jsonb) to authenticated;

-- Moverla de estado: en marcha (con responsable y fecha), hecha (con resultado), descartada (con
-- motivo) o de regreso a propuesta. A quien la propuso le llega cómo va su idea.
create or replace function public.mover_mejora(p_id uuid, p_estado text, p_nota text default null)
returns void language plpgsql security definer set search_path = public as $$
declare m mejoras; v_gestor boolean := puede('procesos', 2); v_texto text;
begin
  select * into m from mejoras where id = p_id for update;
  if m.id is null or not (puede('produccion', 2) or puede('procesos', 1)) then raise exception 'No existe esa mejora' using errcode = '42501'; end if;
  if p_estado not in ('propuesta', 'en_marcha', 'hecha', 'descartada') then raise exception 'Estado desconocido: %', p_estado; end if;
  if p_estado = m.estado then return; end if;
  -- Marcarla hecha también la puede su responsable; lo demás, quien decide las mejoras.
  if not (v_gestor or (p_estado = 'hecha' and m.estado = 'en_marcha' and m.responsable_id = auth.uid())) then
    raise exception 'Sin permiso' using errcode = '42501';
  end if;
  if p_estado = 'en_marcha' and (m.responsable_id is null or m.fecha_compromiso is null) then
    raise exception 'Para ponerla en marcha, primero dile quién la lleva y para cuándo';
  end if;
  if p_estado = 'hecha' and m.resultado is null then
    raise exception 'Para marcarla hecha, escribe qué se logró (el resultado)';
  end if;
  if p_estado = 'descartada' and nullif(trim(p_nota), '') is null then
    raise exception 'Di por qué se descarta: quien la propuso lo va a leer';
  end if;

  update mejoras set estado = p_estado, actualizado_en = now(),
    en_marcha_en = case when p_estado = 'en_marcha' then now() else en_marcha_en end,
    hecha_en = case when p_estado = 'hecha' then now() when p_estado = 'propuesta' then null else hecha_en end,
    descartada_en = case when p_estado = 'descartada' then now() when p_estado = 'propuesta' then null else descartada_en end,
    motivo_descarte = case when p_estado = 'descartada' then trim(p_nota) when p_estado = 'propuesta' then null else motivo_descarte end
  where id = p_id;

  v_texto := case p_estado
    when 'en_marcha' then 'Tu idea KZ-' || m.numero || ' ya está en marcha'
    when 'hecha' then 'Tu idea KZ-' || m.numero || ' ya se hizo'
    when 'descartada' then 'Tu idea KZ-' || m.numero || ' se descartó' end;
  if v_texto is not null then
    perform avisar(array[m.propuesta_por], 'mejora_estado', v_texto,
      m.titulo || case when p_estado = 'descartada' then '. Por qué: ' || trim(p_nota) else '' end,
      '/produccion/mejoras?mejora=' || p_id, 'mejoras', p_id::text);
  end if;
end $$;
revoke execute on function public.mover_mejora(uuid, text, text) from public, anon;
grant execute on function public.mover_mejora(uuid, text, text) to authenticated;

-- Quién puede llevar una mejora: las cuentas activas con producción 2+ o procesos (roles de verdad).
create or replace function public.personas_mejoras()
returns table (id uuid, nombre text)
language sql stable security definer set search_path = public as $$
  select distinct p.id, p.nombre
  from perfiles p
  join usuario_roles ur on ur.usuario_id = p.id
  join permisos_rol pr on pr.rol = ur.rol
  where (puede('produccion', 2) or puede('procesos', 1))
    and coalesce(p.activo, true)
    and ((pr.modulo = 'produccion' and pr.nivel >= 2) or (pr.modulo = 'procesos' and pr.nivel >= 1))
    and ur.rol not in ('pantalla')
  order by p.nombre
$$;
revoke execute on function public.personas_mejoras() from public, anon;
grant execute on function public.personas_mejoras() to authenticated;

-- Lo que el piso reportó y todavía no tiene mejora: problemas, pausas con motivo, etapas
-- reabiertas y fallas de máquinas. Invoker: cada quien ve lo que su rol ya ve.
create or replace function public.problemas_sin_mejora(p_dias int default 30)
returns table (fuente text, evento_id bigint, mantenimiento_id uuid, en timestamptz, tipo text, nota text,
               etapa_id int, etapa text, etapa_color text, folio text, equipo text, orden_id uuid, maquina text)
language sql stable security invoker set search_path = public as $$
  select 'piso', e.id, null::uuid, e.en, e.tipo, e.nota, x.etapa_id, et.nombre, et.color, o.folio, a.nombre, e.orden_id, null
  from op_eventos e
  join ordenes_produccion o on o.id = e.orden_id
  join articulos a on a.id = o.articulo_id
  left join op_operaciones x on x.id = e.operacion_id
  left join etapas et on et.id = x.etapa_id
  where e.en > now() - make_interval(days => greatest(p_dias, 1))
    and (e.tipo in ('problema', 'reabierta') or (e.tipo = 'pausa' and nullif(trim(e.nota), '') is not null))
    and not exists (select 1 from mejoras m where m.evento_id = e.id)
  union all
  select 'maquina', null, om.id, om.reportado_en, 'falla', om.falla, q.etapa_id, et.nombre, et.color, null, null, null, q.nombre
  from ordenes_mantenimiento om
  join maquinas q on q.id = om.maquina_id
  left join etapas et on et.id = q.etapa_id
  where om.tipo = 'correctivo' and om.estado <> 'cancelada'
    and om.reportado_en > now() - make_interval(days => greatest(p_dias, 1))
    and not exists (select 1 from mejoras m where m.mantenimiento_id = om.id)
  order by 4 desc
$$;
revoke execute on function public.problemas_sin_mejora(int) from public, anon;
grant execute on function public.problemas_sin_mejora(int) to authenticated;

-- -----------------------------------------------------------------------------
-- Fotos de antes y después: bucket privado «mejoras», una carpeta por mejora. La ve quien ve
-- las mejoras; la sube cualquiera de ellos a la carpeta de una mejora que existe (qué foto
-- queda puesta lo decide editar_mejora). No se reemplaza ni se borra.
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('mejoras', 'mejoras', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])
on conflict (id) do update set public = false;

drop policy if exists mejoras_ver on storage.objects;
create policy mejoras_ver on storage.objects for select to authenticated using (
  bucket_id = 'mejoras' and ((select public.puede('produccion', 2)) or (select public.puede('procesos', 1))));
drop policy if exists mejoras_subir on storage.objects;
create policy mejoras_subir on storage.objects for insert to authenticated with check (
  bucket_id = 'mejoras' and ((select public.puede('produccion', 2)) or (select public.puede('procesos', 1)))
  and (storage.foldername(name))[1] in (select m.id::text from public.mejoras m));

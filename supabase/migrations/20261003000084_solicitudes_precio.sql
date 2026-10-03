-- =============================================================================
-- Solicitudes de precio a compras, y fichas técnicas en el cotizador.
--
-- Del chat de la empresa (abr-2025 a sep-2026): 481 "@compras me ayudas a cotizar
-- esta polea?" (≈27 al mes; 392 de ventas, 81 de dirección). Compras acusa en 8
-- minutos, pero el precio llega en una mediana de 3.8 h hábiles y el 35 % pasa de
-- un día hábil; en 2026 empeoró (6.2 h y 44 %). En 26 casos el vendedor tuvo que
-- insistir ("ya van 2 veces que llama el cliente") y 4 de los 17 recordatorios de
-- Cliq persiguen a compras. Nadie sabe qué sigue abierto, qué venció ni si el
-- precio quedó cargado en el catálogo.
--
-- Aquí la solicitud tiene folio, dueño, plazo en horas hábiles de la planta y
-- estado (abierta → tomada → contestada / no se consigue / cancelada). Al
-- contestar, el costo entra por el mismo camino que /compras/precios (historial
-- con origen "cotización" y el folio como referencia), el tiempo de entrega se
-- guarda en el artículo y el precio de lista se recalcula con lo que ya existe.
-- El vendedor recibe el precio de lista y el plazo, NUNCA el costo:
--
--  - solicitudes_precio no tiene dinero de compra: la lee quien la pidió (y su
--    gerencia) y por eso también le llega en vivo (Realtime respeta la RLS).
--  - El costo, la moneda y el proveedor van en solicitudes_precio_costos, que solo
--    lee quien ya ve costos. El proveedor también se esconde: con el proveedor y el
--    precio de lista se adivina el margen, y el vendedor necesita precio y plazo,
--    no a quién se le compra.
--  - v_solicitudes_precio (patrón de v_ordenes_compra, 069) junta las dos con los
--    permisos de su dueño, repite el filtro de renglones y pone el costo en null a
--    quien no lo ve.
--
-- Y las fichas: 29 pedidos de fichas, fotos o manuales a marketing por chat ("¿tenemos
-- video de prueba de la Zar-6? No lo encontré") y dirección "casi no encuentro nada"
-- en Drive. Los documentos ya viven en documentos_tecnicos (077) con su revisión
-- vigente; aquí se le dan al cotizador y se avisa a ingeniería qué equipos se cotizan
-- sin ficha.
--
-- Idempotente: la base local es compartida y esto se aplica con psql sobre una base viva.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Horas hábiles de la planta
-- -----------------------------------------------------------------------------
-- El chat midió en horas hábiles (lun–vie 8–18, sáb 8–14; jornada de 10 h), y un
-- plazo en horas naturales vencería solo de noche o en domingo. El horario es dato:
-- si un día cambia (sábados libres, horario de verano de la planta) se edita aquí.
insert into public.configuracion (clave, valor, descripcion) values
  ('horario_habil',
   '{"1": ["08:00", "18:00"], "2": ["08:00", "18:00"], "3": ["08:00", "18:00"], "4": ["08:00", "18:00"], "5": ["08:00", "18:00"], "6": ["08:00", "14:00"]}',
   'Horario de la planta por día de la semana (1 = lunes … 7 = domingo; el día que falta no se trabaja). Con él se cuentan las horas hábiles de las solicitudes de precio. Los feriados de ley y los descansos de calendario_laboral tampoco cuentan.'),
  ('plazos_solicitud_precio', '{"normal": 10, "urgente": 4, "por_vencer": 1}',
   'Horas hábiles que tiene compras para contestar un precio: normal = 1 día hábil (10 h), urgente = "el cliente está esperando". por_vencer = cuántas horas antes se le avisa a compras.')
on conflict (clave) do nothing;

-- Ventana de trabajo de un día (ninguna si no se trabaja), en hora de la planta.
create or replace function public.ventana_habil(p_dia date)
returns table (inicio timestamptz, fin timestamptz)
language sql stable security invoker set search_path = public as $$
  with h as (
    select coalesce((select valor from configuracion where clave = 'horario_habil'),
                    '{"1":["08:00","18:00"],"2":["08:00","18:00"],"3":["08:00","18:00"],"4":["08:00","18:00"],"5":["08:00","18:00"],"6":["08:00","14:00"]}'::jsonb)
           -> (extract(isodow from p_dia)::int)::text as t
  )
  select (p_dia + (h.t->>0)::time) at time zone 'America/Mexico_City',
         (p_dia + (h.t->>1)::time) at time zone 'America/Mexico_City'
  from h
  where h.t is not null
    and p_dia not in (select festivos_lft(extract(year from p_dia)::int))
    and not coalesce((select valor->'descansos_empresa' from configuracion where clave = 'calendario_laboral'), '[]'::jsonb)
            @> to_jsonb(to_char(p_dia, 'YYYY-MM-DD'))
$$;

-- Instante en que se cumplen p_horas hábiles a partir de p_desde. Lo que cae fuera de
-- horario cuenta desde la siguiente apertura: una solicitud del domingo empieza a
-- correr el lunes a las 8:00.
create or replace function public.sumar_horas_habiles(p_desde timestamptz, p_horas numeric)
returns timestamptz language plpgsql stable security invoker set search_path = public as $$
declare
  v_dia date := (p_desde at time zone 'America/Mexico_City')::date;
  v_resta interval := make_interval(secs => (greatest(coalesce(p_horas, 0), 0) * 3600)::double precision);
  v record; v_ini timestamptz; v_tramo interval;
begin
  for i in 0 .. 400 loop
    for v in select * from ventana_habil(v_dia + i) loop
      v_ini := greatest(v.inicio, p_desde);
      if v.fin > v_ini then
        v_tramo := v.fin - v_ini;
        if v_tramo >= v_resta then return v_ini + v_resta; end if;
        v_resta := v_resta - v_tramo;
      end if;
    end loop;
  end loop;
  raise exception 'No hay horario hábil en el próximo año: revisa horario_habil en la configuración';
end $$;

-- Horas hábiles entre dos instantes (0 si el segundo es antes).
create or replace function public.horas_habiles(p_desde timestamptz, p_hasta timestamptz)
returns numeric language sql stable security invoker set search_path = public as $$
  select coalesce(round(sum(greatest(extract(epoch from least(v.fin, p_hasta) - greatest(v.inicio, p_desde)), 0))::numeric / 3600, 2), 0)
  from generate_series((p_desde at time zone 'America/Mexico_City')::date,
                       (p_hasta at time zone 'America/Mexico_City')::date, interval '1 day') g(d)
  cross join lateral ventana_habil(g.d::date) v
  where p_hasta > p_desde
$$;

create or replace function public.en_horario_habil(p_t timestamptz default now())
returns boolean language sql stable security invoker set search_path = public as $$
  select exists (select 1 from ventana_habil((p_t at time zone 'America/Mexico_City')::date) v where p_t >= v.inicio and p_t < v.fin)
$$;

-- -----------------------------------------------------------------------------
-- 2. Tablas
-- -----------------------------------------------------------------------------
create table if not exists public.solicitudes_precio (
  id uuid primary key default gen_random_uuid(),
  folio text not null default '' unique,
  solicitante_id uuid not null default auth.uid() references public.perfiles(id),
  -- Para qué (opcional): la cotización y su partida, o solo el cliente.
  cotizacion_id uuid references public.cotizaciones(id) on delete set null,
  partida_id uuid references public.cotizacion_lineas(id) on delete set null,
  cliente_id uuid references public.clientes(id) on delete set null,
  -- Qué: un artículo del catálogo, o una descripción libre con marca y modelo.
  articulo_id uuid references public.articulos(id),
  descripcion text,
  marca text,
  modelo text,
  cantidad numeric(14,3) not null default 1 check (cantidad > 0),
  urgente boolean not null default false,          -- "el cliente está esperando"
  notas text,
  estado text not null default 'abierta'
    check (estado in ('abierta', 'tomada', 'contestada', 'no_se_consigue', 'cancelada')),
  creado_en timestamptz not null default now(),
  vence_en timestamptz not null,
  tomada_por uuid references public.perfiles(id),
  tomada_en timestamptz,
  contestada_por uuid references public.perfiles(id),
  contestada_en timestamptz,
  -- Lo que sí ve el vendedor: plazo, vigencia, nota y el precio de lista resultante.
  tiempo_entrega_dias int check (tiempo_entrega_dias >= 0),
  vigencia_hasta date,
  respuesta text,
  precio_lista numeric(14,2),                      -- foto del precio de lista al contestar (MXN, sin IVA)
  horas_acuse numeric(8,2),                        -- horas hábiles hasta que compras la tomó
  horas_respuesta numeric(8,2),                    -- horas hábiles hasta el precio (o el "no se consigue")
  aplicada_en timestamptz,                         -- el vendedor puso el precio en su partida
  cancelada_por uuid references public.perfiles(id),
  cancelada_en timestamptz,
  motivo_cancelacion text,
  check (articulo_id is not null or length(trim(coalesce(descripcion, ''))) >= 3)
);
create index if not exists solicitudes_precio_cola on public.solicitudes_precio (estado, vence_en);
create index if not exists solicitudes_precio_solicitante on public.solicitudes_precio (solicitante_id, creado_en desc);
create index if not exists solicitudes_precio_cotizacion on public.solicitudes_precio (cotizacion_id) where cotizacion_id is not null;
create index if not exists solicitudes_precio_partida on public.solicitudes_precio (partida_id) where partida_id is not null;
create index if not exists solicitudes_precio_contestada on public.solicitudes_precio (contestada_en) where contestada_en is not null;

-- Lo que costó y a quién: solo para quien ve costos (compras, ingeniería, finanzas, dirección).
create table if not exists public.solicitudes_precio_costos (
  solicitud_id uuid primary key references public.solicitudes_precio(id) on delete cascade,
  proveedor_id uuid references public.proveedores(id),
  costo numeric(14,4) not null check (costo > 0),
  moneda public.moneda not null default 'MXN',
  capturado_por uuid default auth.uid() references public.perfiles(id),
  en timestamptz not null default now()
);

-- La foto que hoy se manda por chat ("esta polea"). Bucket privado; no se borra.
create table if not exists public.solicitudes_precio_fotos (
  id uuid primary key default gen_random_uuid(),
  solicitud_id uuid not null references public.solicitudes_precio(id) on delete cascade,
  ruta text not null unique,
  subido_por uuid default auth.uid() references public.perfiles(id),
  en timestamptz not null default now()
);
create index if not exists solicitudes_precio_fotos_sol on public.solicitudes_precio_fotos (solicitud_id);

drop trigger if exists folio on public.solicitudes_precio;
create trigger folio before insert on public.solicitudes_precio for each row execute function public.trg_folio('SP');

-- -----------------------------------------------------------------------------
-- 3. Quién ve qué
-- -----------------------------------------------------------------------------
create or replace function public.ve_costo_solicitud() returns boolean
language sql stable security invoker set search_path = public as $$
  select puede('compras', 2) or puede('costos', 1)
$$;

alter table public.solicitudes_precio enable row level security;
alter table public.solicitudes_precio_costos enable row level security;
alter table public.solicitudes_precio_fotos enable row level security;

-- La suya quien la pidió; todas compras (la cola) y la gerencia de ventas (su equipo).
-- Un vendedor no ve las de otro. Sin políticas de escritura: todo pasa por las
-- funciones de abajo, que revisan permisos y estado.
drop policy if exists ver on public.solicitudes_precio;
create policy ver on public.solicitudes_precio for select to authenticated using (
  solicitante_id = (select auth.uid()) or (select puede('compras', 2)) or (select puede('ventas', 3)));
drop policy if exists ver on public.solicitudes_precio_costos;
create policy ver on public.solicitudes_precio_costos for select to authenticated using ((select ve_costo_solicitud()));
drop policy if exists ver on public.solicitudes_precio_fotos;
create policy ver on public.solicitudes_precio_fotos for select to authenticated using (
  solicitud_id in (select id from public.solicitudes_precio));

-- Fotos: carpeta = id de la solicitud. Las ve quien ve la solicitud; las sube quien la
-- pidió o compras mientras siga abierta. No hay política de borrar ni de reemplazar.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('solicitudes-precio', 'solicitudes-precio', false, 10485760,
        array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf'])
on conflict (id) do update set public = false;

drop policy if exists solicitudes_precio_ver on storage.objects;
create policy solicitudes_precio_ver on storage.objects for select to authenticated using (
  bucket_id = 'solicitudes-precio' and (storage.foldername(name))[1] in (select id::text from public.solicitudes_precio));
drop policy if exists solicitudes_precio_subir on storage.objects;
create policy solicitudes_precio_subir on storage.objects for insert to authenticated with check (
  bucket_id = 'solicitudes-precio' and (storage.foldername(name))[1] in (
    select id::text from public.solicitudes_precio
    where estado in ('abierta', 'tomada') and (solicitante_id = (select auth.uid()) or (select public.puede('compras', 2)))));

-- Lo que leen las pantallas. Con los permisos de su dueño porque tiene que leer la
-- tabla de costos para enmascararla; por eso repite aquí el filtro de renglones.
drop view if exists public.v_solicitudes_precio cascade;
create view public.v_solicitudes_precio with (security_invoker = false) as
with permiso as materialized (
  select ve_costo_solicitud() as costo, puede('compras', 2) as compras, puede('ventas', 3) as gerente, auth.uid() as yo,
         coalesce((select (valor->>'por_vencer')::numeric from public.configuracion where clave = 'plazos_solicitud_precio'), 1) as aviso
)
select s.id, s.folio, s.estado, s.urgente,
  s.solicitante_id, so.nombre as solicitante, so.iniciales as solicitante_iniciales,
  s.cotizacion_id, c.folio as cotizacion_folio, s.partida_id, s.cliente_id, cl.nombre as cliente,
  s.articulo_id, a.clave, a.nombre as articulo, coalesce(a.unidad, 'pieza') as unidad, a.tipo as articulo_tipo,
  s.descripcion, s.marca, s.modelo, s.cantidad, s.notas,
  s.creado_en, s.vence_en,
  s.tomada_por, tp.nombre as tomada_por_nombre, s.tomada_en,
  s.contestada_por, cp.nombre as contestada_por_nombre, s.contestada_en,
  s.tiempo_entrega_dias, s.vigencia_hasta, s.respuesta, s.precio_lista,
  pl.precio as precio_lista_actual,
  s.horas_acuse, s.horas_respuesta, s.aplicada_en,
  s.cancelada_en, s.motivo_cancelacion, xp.nombre as cancelada_por_nombre,
  -- Dinero de compra: solo quien ve costos.
  case when permiso.costo then k.costo end as costo,
  case when permiso.costo then k.moneda end as moneda,
  case when permiso.costo then k.proveedor_id end as proveedor_id,
  case when permiso.costo then pr.nombre end as proveedor,
  (select count(*) from public.solicitudes_precio_fotos f where f.solicitud_id = s.id)::int as fotos,
  case when s.estado in ('abierta', 'tomada') then horas_habiles(now(), s.vence_en) end as horas_restantes,
  case when s.estado in ('abierta', 'tomada') then horas_habiles(s.creado_en, now()) else s.horas_respuesta end as horas_transcurridas,
  case when s.estado in ('abierta', 'tomada') and s.vence_en <= now() then horas_habiles(s.vence_en, now()) end as horas_vencida,
  case when s.estado not in ('abierta', 'tomada') then null
       when s.vence_en <= now() then 'vencida'
       when horas_habiles(now(), s.vence_en) <= permiso.aviso then 'por_vencer'
       else 'a_tiempo' end as semaforo,
  case when s.contestada_en is not null then s.contestada_en <= s.vence_en end as a_tiempo,
  -- "Usada": la aplicó a su partida, o ya cotizó ese artículo con precio después de la respuesta.
  case when s.estado = 'contestada' then s.aplicada_en is not null or exists (
    select 1 from public.cotizacion_lineas l join public.cotizaciones q on q.id = l.cotizacion_id
    where l.articulo_id = s.articulo_id and q.vendedor_id = s.solicitante_id and l.precio_unitario > 0
      and q.actualizado_en >= s.contestada_en) end as usada
from public.solicitudes_precio s
cross join permiso
join public.perfiles so on so.id = s.solicitante_id
left join public.cotizaciones c on c.id = s.cotizacion_id
left join public.clientes cl on cl.id = s.cliente_id
left join public.articulos a on a.id = s.articulo_id
left join public.precios_lista pl on pl.articulo_id = s.articulo_id
left join public.perfiles tp on tp.id = s.tomada_por
left join public.perfiles cp on cp.id = s.contestada_por
left join public.perfiles xp on xp.id = s.cancelada_por
left join public.solicitudes_precio_costos k on k.solicitud_id = s.id
left join public.proveedores pr on pr.id = k.proveedor_id
where permiso.compras or permiso.gerente or s.solicitante_id = permiso.yo;
grant select on public.v_solicitudes_precio to authenticated;
revoke all on public.v_solicitudes_precio from anon;

-- -----------------------------------------------------------------------------
-- 4. Avisos: nueva → compras; tomada, contestada o sin precio → a quien la pidió;
--    cancelada → a quien la tenía. avisar() no le avisa al que hizo el cambio.
-- -----------------------------------------------------------------------------
-- Invoker: el catálogo lo lee cualquiera con rol; desde el disparador y el cron corre como su dueño.
create or replace function public.que_pide_solicitud(s public.solicitudes_precio) returns text
language sql stable security invoker set search_path = public as $$
  select left(coalesce((select nombre from articulos where id = s.articulo_id), s.descripcion, 'artículo'), 90)
         || coalesce(' (' || nullif(concat_ws(' ', s.marca, s.modelo), '') || ')', '')
$$;

-- A quién se escala una vencida: la gerencia de ventas para lo de ventas; dirección
-- para lo demás (lo que pide la gerente, ingeniería o la misma dirección).
create or replace function public.jefes_solicitud(p_solicitante uuid) returns setof uuid
language sql stable security definer set search_path = public as $$
  select usuarios_con_rol('gerente_ventas')
  where exists (select 1 from usuario_roles where usuario_id = p_solicitante and rol = 'ventas')
    and not exists (select 1 from usuario_roles where usuario_id = p_solicitante and rol in ('gerente_ventas', 'direccion'))
  union
  select usuarios_con_rol('direccion')
  where not exists (select 1 from usuario_roles where usuario_id = p_solicitante and rol = 'ventas')
     or exists (select 1 from usuario_roles where usuario_id = p_solicitante and rol = 'gerente_ventas')
$$;
-- Solo la usan el aviso y el recordatorio (que corren como su dueño): nadie más la llama.
revoke execute on function public.jefes_solicitud(uuid) from public, anon, authenticated;

create or replace function public.aviso_solicitud_precio() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_que text := que_pide_solicitud(new); v_nombre text; v_ruta text;
begin
  -- Al vendedor lo lleva a su cotización (ahí aplica el precio); sin cotización, a su lista.
  v_ruta := case when new.cotizacion_id is not null then '/ventas/cotizaciones/' || new.cotizacion_id
                 else '/ventas/solicitudes?id=' || new.id end;
  if tg_op = 'INSERT' then
    select nombre into v_nombre from perfiles where id = new.solicitante_id;
    perform avisar(array(select usuarios_con_rol('compras')),
      case when new.urgente then 'solicitud_precio_urgente' else 'solicitud_precio_nueva' end,
      format('%sPrecio de %s', case when new.urgente then 'URGENTE · ' else '' end, v_que),
      format('%s · %s %s · lo pide %s%s · vence %s', new.folio, trim_scale(new.cantidad),
             coalesce((select unidad from articulos where id = new.articulo_id), 'pieza'), coalesce(v_nombre, 'alguien'),
             case when new.urgente then ' (el cliente está esperando)' else '' end,
             to_char(new.vence_en at time zone 'America/Mexico_City', 'DD/MM HH24:MI')),
      '/compras/solicitudes?id=' || new.id, 'solicitudes_precio', new.id::text);
    return new;
  end if;
  if new.estado is not distinct from old.estado then return new; end if;
  if new.estado = 'tomada' then
    select nombre into v_nombre from perfiles where id = new.tomada_por;
    perform avisar(array[new.solicitante_id], 'solicitud_precio_tomada',
      format('%s ya está cotizando tu %s', coalesce(v_nombre, 'Compras'), new.folio), v_que,
      v_ruta, 'solicitudes_precio', new.id::text);
  elsif new.estado = 'contestada' then
    perform avisar(array[new.solicitante_id], 'solicitud_precio_contestada', format('Precio listo: %s', v_que),
      format('%s · %s · entrega %s%s', new.folio,
             coalesce('$' || to_char(new.precio_lista, 'FM999,999,990.00') || ' + IVA de lista', 'sin precio de lista'),
             coalesce(new.tiempo_entrega_dias || ' días hábiles', 'por confirmar'),
             coalesce(' · ' || new.respuesta, '')),
      v_ruta, 'solicitudes_precio', new.id::text);
  elsif new.estado = 'no_se_consigue' then
    perform avisar(array[new.solicitante_id], 'solicitud_precio_sin_precio', format('Compras no lo consiguió: %s', v_que),
      format('%s · %s', new.folio, coalesce(new.respuesta, '')), v_ruta, 'solicitudes_precio', new.id::text);
  elsif new.estado = 'cancelada' and new.tomada_por is not null then
    select nombre into v_nombre from perfiles where id = new.cancelada_por;
    perform avisar(array[new.tomada_por], 'solicitud_precio_cancelada', format('Ya no hace falta: %s', v_que),
      format('%s · la canceló %s%s', new.folio, coalesce(v_nombre, 'quien la pidió'), coalesce(' · ' || new.motivo_cancelacion, '')),
      '/compras/solicitudes?id=' || new.id, 'solicitudes_precio', new.id::text);
  end if;
  return new;
end $$;
drop trigger if exists aviso_solicitud_precio on public.solicitudes_precio;
create trigger aviso_solicitud_precio after insert or update of estado on public.solicitudes_precio
  for each row execute function public.aviso_solicitud_precio();

-- -----------------------------------------------------------------------------
-- 5. Pedir, tomar, contestar, no se consigue, cancelar, aplicar
-- -----------------------------------------------------------------------------

-- Pedir precio: desde la partida de una cotización, desde el buscador ("¿No está?")
-- o suelto. El plazo lo pone la base: 1 día hábil, o 4 horas hábiles si el cliente
-- está esperando.
create or replace function public.pedir_precio(p_descripcion text default null, p_articulo uuid default null,
  p_cantidad numeric default 1, p_urgente boolean default false, p_marca text default null, p_modelo text default null,
  p_notas text default null, p_cotizacion uuid default null, p_partida uuid default null, p_cliente uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_cot uuid := p_cotizacion; v_cli uuid := p_cliente; v_folio text; l cotizacion_lineas; v_horas numeric;
begin
  if not (puede('ventas', 2) or puede('costeo', 3)) then
    raise exception 'Tu rol no pide precios a compras' using errcode = '42501';
  end if;
  if p_partida is not null then
    select * into l from cotizacion_lineas where id = p_partida;
    if l.id is null then raise exception 'No encontré la partida'; end if;
    if v_cot is not null and v_cot <> l.cotizacion_id then raise exception 'Esa partida es de otra cotización'; end if;
    v_cot := l.cotizacion_id;
    select folio into v_folio from solicitudes_precio where partida_id = p_partida and estado in ('abierta', 'tomada') limit 1;
    if v_folio is not null then raise exception 'Ya pediste el precio de esta partida (%): compras ya lo tiene', v_folio; end if;
  end if;
  if v_cot is not null then
    if not cotizacion_visible(v_cot) then raise exception 'No encontré la cotización' using errcode = '42501'; end if;
    if v_cli is null then select cliente_id into v_cli from cotizaciones where id = v_cot; end if;
  end if;
  if p_cliente is not null and not cliente_visible(p_cliente) then
    raise exception 'Ese cliente es de otro vendedor' using errcode = '42501';
  end if;
  if p_articulo is not null and not exists (select 1 from articulos where id = p_articulo) then
    raise exception 'No existe ese artículo';
  end if;
  if p_articulo is null and length(trim(coalesce(p_descripcion, ''))) < 3 then
    raise exception 'Escribe qué necesitas (qué es, medida, marca o modelo): con eso cotiza compras';
  end if;
  if coalesce(p_cantidad, 0) <= 0 then raise exception 'La cantidad debe ser mayor a cero'; end if;

  select coalesce((valor->>case when p_urgente then 'urgente' else 'normal' end)::numeric, case when p_urgente then 4 else 10 end)
  into v_horas from configuracion where clave = 'plazos_solicitud_precio';
  insert into solicitudes_precio (solicitante_id, cotizacion_id, partida_id, cliente_id, articulo_id, descripcion, marca, modelo,
                                  cantidad, urgente, notas, vence_en)
  values (auth.uid(), v_cot, p_partida, v_cli, p_articulo, nullif(trim(p_descripcion), ''), nullif(trim(p_marca), ''),
          nullif(trim(p_modelo), ''), p_cantidad, coalesce(p_urgente, false), nullif(trim(p_notas), ''),
          sumar_horas_habiles(now(), coalesce(v_horas, case when p_urgente then 4 else 10 end)))
  returning id into v_id;
  return v_id;
end $$;

-- Registra una foto ya subida al bucket. Tiene que existir y estar en la carpeta de
-- la solicitud: no se puede "adoptar" la foto de otra.
create or replace function public.agregar_foto_solicitud(p_solicitud uuid, p_ruta text) returns uuid
language plpgsql security definer set search_path = public as $$
declare s solicitudes_precio; v uuid;
begin
  select * into s from solicitudes_precio where id = p_solicitud;
  if s.id is null or not (s.solicitante_id = auth.uid() or puede('compras', 2)) then
    raise exception 'Solo quien pidió el precio (o compras) sube fotos' using errcode = '42501';
  end if;
  if s.estado not in ('abierta', 'tomada') then raise exception '% ya está cerrada', s.folio; end if;
  if p_ruta is null or left(p_ruta, length(p_solicitud::text) + 1) <> p_solicitud::text || '/' then
    raise exception 'La foto no está en la carpeta de esta solicitud';
  end if;
  if not exists (select 1 from storage.objects o where o.bucket_id = 'solicitudes-precio' and o.name = p_ruta) then
    raise exception 'La foto no se subió completa; vuelve a intentarlo';
  end if;
  insert into solicitudes_precio_fotos (solicitud_id, ruta) values (p_solicitud, p_ruta) returning id into v;
  return v;
end $$;

-- Tomar = el acuse de hoy ("te lo checo"), pero visible: el vendedor ve quién la tiene.
create or replace function public.tomar_solicitud_precio(p_solicitud uuid) returns void
language plpgsql security definer set search_path = public as $$
declare s solicitudes_precio; v_quien text;
begin
  if not puede('compras', 2) then raise exception 'Solo compras toma solicitudes de precio' using errcode = '42501'; end if;
  select * into s from solicitudes_precio where id = p_solicitud for update;
  if s.id is null then raise exception 'No existe la solicitud'; end if;
  if s.estado = 'tomada' then
    if s.tomada_por = auth.uid() then return; end if;
    select nombre into v_quien from perfiles where id = s.tomada_por;
    raise exception '% ya la tiene %', s.folio, coalesce(v_quien, 'alguien más');
  end if;
  if s.estado <> 'abierta' then raise exception '% ya está %', s.folio, replace(s.estado, '_', ' '); end if;
  update solicitudes_precio set estado = 'tomada', tomada_por = auth.uid(), tomada_en = now(),
    horas_acuse = horas_habiles(s.creado_en, now())
  where id = p_solicitud;
end $$;

-- Estimado del precio de lista para el panel de compras mientras escribe el costo
-- (misma fórmula que el recálculo). Solo para quien ve costos.
create or replace function public.precio_lista_estimado(p_articulo uuid, p_costo numeric, p_moneda public.moneda default 'MXN')
returns numeric language plpgsql stable security invoker set search_path = public as $$
declare v_pol int; v_med boolean := false; v_margen numeric; v_fijo numeric;
begin
  if not puede('costos', 1) then raise exception 'Sin permiso de costos' using errcode = '42501'; end if;
  if coalesce(p_costo, 0) <= 0 then return null; end if;
  if p_articulo is null then
    select id into v_pol from politicas_precio where por_defecto_para = 'componente';
  else
    v_pol := politica_de(p_articulo);
    select a.medida_especial, c.margen, c.precio_fijo into v_med, v_margen, v_fijo
    from articulos a left join costos_articulo c on c.articulo_id = a.id where a.id = p_articulo;
  end if;
  -- Un precio fijado a mano manda sobre el costo (igual que en recalcular_costos).
  if v_fijo is not null then return v_fijo; end if;
  return precio_desde_costo(p_costo * tc(p_moneda), v_pol, v_margen, coalesce(v_med, false));
end $$;

-- Contestar: compras captura proveedor, costo, moneda, tiempo de entrega y vigencia.
-- Si el artículo no existe, se da de alta como componente y la solicitud queda ligada.
-- El costo entra con actualizar_costos() —el mismo camino que /compras/precios—, así
-- que queda en el historial (origen "cotización", referencia = folio) y el precio de
-- lista se recalcula solo. Contestar es capturar un costo: hace falta costos nivel 2.
create or replace function public.contestar_solicitud_precio(p_solicitud uuid, p_costo numeric,
  p_moneda public.moneda default 'MXN', p_proveedor uuid default null, p_tiempo_entrega_dias int default null,
  p_vigencia_hasta date default null, p_respuesta text default null, p_articulo uuid default null, p_nuevo jsonb default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare s solicitudes_precio; v_art uuid; v_clave text; v_nombre text; v_precio numeric; v_quien text;
begin
  if not puede('compras', 2) then raise exception 'Solo compras contesta solicitudes de precio' using errcode = '42501'; end if;
  if not puede('costos', 2) then
    raise exception 'Contestar un precio es capturar un costo: tu rol no puede capturar costos' using errcode = '42501';
  end if;
  select * into s from solicitudes_precio where id = p_solicitud for update;
  if s.id is null then raise exception 'No existe la solicitud'; end if;
  if s.estado in ('contestada', 'no_se_consigue') then
    select nombre into v_quien from perfiles where id = s.contestada_por;
    raise exception '% ya la contestó % el %: no se contesta dos veces', s.folio, coalesce(v_quien, 'compras'),
      to_char(s.contestada_en at time zone 'America/Mexico_City', 'DD/MM HH24:MI');
  end if;
  if s.estado = 'cancelada' then raise exception '% la canceló quien la pidió: ya no hace falta', s.folio; end if;
  if coalesce(p_costo, 0) <= 0 then raise exception 'Escribe el costo (mayor a cero)'; end if;
  if p_tiempo_entrega_dias is null or p_tiempo_entrega_dias < 0 then
    raise exception 'Escribe el tiempo de entrega: es lo primero que pregunta el cliente';
  end if;
  if p_vigencia_hasta is not null and p_vigencia_hasta < hoy_planta() then raise exception 'La vigencia ya pasó'; end if;
  if p_proveedor is not null and not exists (select 1 from proveedores where id = p_proveedor) then raise exception 'No existe ese proveedor'; end if;

  v_art := coalesce(p_articulo, s.articulo_id);
  if v_art is not null and not exists (select 1 from articulos where id = v_art) then raise exception 'No existe ese artículo'; end if;
  if v_art is null then
    if p_nuevo is null then
      raise exception 'Elige el artículo del catálogo o dalo de alta: sin artículo no hay precio de lista';
    end if;
    v_nombre := nullif(trim(coalesce(p_nuevo->>'nombre', s.descripcion)), '');
    if v_nombre is null or length(v_nombre) < 3 then raise exception 'Escribe el nombre del artículo nuevo'; end if;
    v_clave := coalesce(nullif(trim(p_nuevo->>'clave'), ''), sugerir_clave('componente'));
    if exists (select 1 from articulos where clave = v_clave) then raise exception 'Ya existe un artículo con la clave %', v_clave; end if;
    insert into articulos (clave, tipo, nombre, descripcion, unidad, proveedor_id, tiempo_entrega_dias)
    values (v_clave, 'componente', v_nombre,
            coalesce(nullif(trim(p_nuevo->>'descripcion'), ''),
                     nullif(concat_ws(E'\n', '• Marca: ' || s.marca, '• Modelo: ' || s.modelo), '')),
            coalesce(nullif(trim(p_nuevo->>'unidad'), ''), 'pieza'), p_proveedor, p_tiempo_entrega_dias)
    returning id into v_art;
  end if;

  -- El mismo camino que /compras/precios: historial con origen y referencia, y recálculo.
  perform set_config('erp.origen_costo', 'cotizacion_proveedor', true);
  perform set_config('erp.referencia_costo', s.folio, true);
  perform actualizar_costos(jsonb_build_array(jsonb_build_object('articulo_id', v_art, 'costo', p_costo,
    'moneda', p_moneda, 'proveedor_id', coalesce(p_proveedor::text, ''))));
  perform set_config('erp.origen_costo', '', true);
  perform set_config('erp.referencia_costo', '', true);

  -- El plazo queda en el artículo (lo ve la ficha de venta); el proveedor solo si no tenía.
  update articulos set tiempo_entrega_dias = p_tiempo_entrega_dias, proveedor_id = coalesce(proveedor_id, p_proveedor)
  where id = v_art and (tiempo_entrega_dias is distinct from p_tiempo_entrega_dias or (proveedor_id is null and p_proveedor is not null));

  select precio into v_precio from precios_lista where articulo_id = v_art;

  insert into solicitudes_precio_costos (solicitud_id, proveedor_id, costo, moneda)
  values (s.id, p_proveedor, p_costo, p_moneda)
  on conflict (solicitud_id) do update set proveedor_id = excluded.proveedor_id, costo = excluded.costo,
    moneda = excluded.moneda, capturado_por = auth.uid(), en = now();

  update solicitudes_precio set estado = 'contestada', articulo_id = v_art,
    contestada_por = auth.uid(), contestada_en = now(),
    tomada_por = coalesce(tomada_por, auth.uid()), tomada_en = coalesce(tomada_en, now()),
    horas_acuse = coalesce(horas_acuse, horas_habiles(creado_en, now())),
    horas_respuesta = horas_habiles(creado_en, now()),
    tiempo_entrega_dias = p_tiempo_entrega_dias, vigencia_hasta = p_vigencia_hasta,
    respuesta = nullif(trim(p_respuesta), ''), precio_lista = v_precio
  where id = s.id;

  return jsonb_build_object('articulo_id', v_art, 'clave', (select clave from articulos where id = v_art), 'precio_lista', v_precio);
end $$;

-- "No se consigue" (descontinuado, sin proveedor, fuera de presupuesto): también es
-- una respuesta, y el vendedor la necesita igual de rápido.
create or replace function public.marcar_no_se_consigue(p_solicitud uuid, p_motivo text) returns void
language plpgsql security definer set search_path = public as $$
declare s solicitudes_precio;
begin
  if not puede('compras', 2) then raise exception 'Solo compras contesta solicitudes de precio' using errcode = '42501'; end if;
  select * into s from solicitudes_precio where id = p_solicitud for update;
  if s.id is null then raise exception 'No existe la solicitud'; end if;
  if s.estado in ('contestada', 'no_se_consigue') then raise exception '% ya se contestó: no se contesta dos veces', s.folio; end if;
  if s.estado = 'cancelada' then raise exception '% la canceló quien la pidió', s.folio; end if;
  if coalesce(length(trim(p_motivo)), 0) < 3 then raise exception 'Escribe por qué no se consigue: el vendedor se lo tiene que explicar al cliente'; end if;
  update solicitudes_precio set estado = 'no_se_consigue', respuesta = trim(p_motivo),
    contestada_por = auth.uid(), contestada_en = now(),
    tomada_por = coalesce(tomada_por, auth.uid()), tomada_en = coalesce(tomada_en, now()),
    horas_acuse = coalesce(horas_acuse, horas_habiles(creado_en, now())),
    horas_respuesta = horas_habiles(creado_en, now())
  where id = s.id;
end $$;

-- La cancela quien la pidió (o su gerencia) mientras no esté contestada.
create or replace function public.cancelar_solicitud_precio(p_solicitud uuid, p_motivo text default null) returns void
language plpgsql security definer set search_path = public as $$
declare s solicitudes_precio;
begin
  select * into s from solicitudes_precio where id = p_solicitud for update;
  if s.id is null or not (s.solicitante_id = auth.uid() or puede('ventas', 3)) then
    raise exception 'Solo quien pidió el precio (o su gerencia) lo cancela' using errcode = '42501';
  end if;
  if s.estado in ('contestada', 'no_se_consigue') then raise exception '% ya se contestó: ya no se cancela', s.folio; end if;
  if s.estado = 'cancelada' then raise exception '% ya estaba cancelada', s.folio; end if;
  update solicitudes_precio set estado = 'cancelada', cancelada_por = auth.uid(), cancelada_en = now(),
    motivo_cancelacion = nullif(trim(p_motivo), '')
  where id = s.id;
end $$;

-- Aplicar el precio a la partida de la cotización de donde vino: la partida libre se
-- vuelve el artículo (con su nombre, unidad y foto) y el precio es el de lista en la
-- moneda de la cotización, como agregar_partida(). Si la partida ya no existe, se
-- agrega una nueva.
create or replace function public.aplicar_solicitud_precio(p_solicitud uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare s solicitudes_precio; c cotizaciones; a articulos; l cotizacion_lineas; v_lista numeric; v_precio numeric; v_id uuid;
begin
  select * into s from solicitudes_precio where id = p_solicitud;
  if s.id is null or not (s.solicitante_id = auth.uid() or puede('ventas', 3)) then
    raise exception 'No encontré esa solicitud' using errcode = '42501';
  end if;
  if s.estado <> 'contestada' then
    raise exception '% todavía no tiene precio (está %)', s.folio, replace(s.estado, '_', ' ');
  end if;
  if s.cotizacion_id is null then raise exception '% no viene de una cotización: agrégalo desde el buscador del cotizador', s.folio; end if;
  if not cotizacion_editable(s.cotizacion_id) then
    raise exception 'La cotización ya no se puede cambiar (ya se envió o se cerró): saca una nueva versión' using errcode = '42501';
  end if;
  select * into c from cotizaciones where id = s.cotizacion_id;
  select * into a from articulos where id = s.articulo_id;
  select precio into v_lista from precios_lista where articulo_id = s.articulo_id;
  if v_lista is null then raise exception '% no tiene precio de lista todavía: pregúntale a compras', a.clave; end if;
  v_precio := round(v_lista / c.tipo_cambio * case when c.precios_con_iva then 1 + c.tasa_iva else 1 end, 2);

  select * into l from cotizacion_lineas where id = s.partida_id and cotizacion_id = c.id;
  if l.id is null then
    insert into cotizacion_lineas (cotizacion_id, orden, articulo_id, titulo, descripcion, imagen_url, unidad, cantidad, precio_unitario)
    values (c.id, coalesce((select max(orden) from cotizacion_lineas where cotizacion_id = c.id), 0) + 1, a.id, a.nombre,
            a.descripcion, a.imagen_url, a.unidad, s.cantidad, v_precio)
    returning id into v_id;
  else
    -- La foto del precio de lista solo se toma cuando cambia el artículo (082): si la
    -- partida ya era ese artículo (sin precio), se suelta y se vuelve a ligar.
    if l.articulo_id = a.id then update cotizacion_lineas set articulo_id = null where id = l.id; end if;
    update cotizacion_lineas set articulo_id = a.id,
      titulo = case when l.articulo_id is null then a.nombre else l.titulo end,
      descripcion = coalesce(nullif(trim(l.descripcion), ''), a.descripcion),
      unidad = case when l.articulo_id is null then a.unidad else l.unidad end,
      imagen_url = coalesce(l.imagen_url, a.imagen_url),
      precio_unitario = v_precio
    where id = l.id;
    v_id := l.id;
  end if;
  update solicitudes_precio set aplicada_en = now(), partida_id = v_id where id = s.id;
  return v_id;
end $$;

-- -----------------------------------------------------------------------------
-- 6. Contadores e indicador honesto
-- -----------------------------------------------------------------------------
-- Mediana de horas hábiles hasta el precio este mes y % de más de un día hábil,
-- contra la línea base del chat. "Honesto": las que siguen abiertas y ya pasaron de
-- un día también cuentan como "más de un día" (si no, el indicador mejora con solo
-- no contestar). Con la RLS de quien pregunta: un vendedor ve el de sus solicitudes.
create or replace function public.resumen_solicitudes_precio() returns jsonb
language sql stable security invoker set search_path = public as $$
  with v as (select * from v_solicitudes_precio),
  mes as (select date_trunc('month', now() at time zone 'America/Mexico_City') at time zone 'America/Mexico_City' as desde),
  res as (select v.* from v, mes where v.estado in ('contestada', 'no_se_consigue') and v.contestada_en >= mes.desde),
  abiertas_largas as (select * from v where v.estado in ('abierta', 'tomada') and v.horas_transcurridas > 10)
  select jsonb_build_object(
    'abiertas', (select count(*) from v where estado in ('abierta', 'tomada')),
    'sin_tomar', (select count(*) from v where estado = 'abierta'),
    'por_vencer', (select count(*) from v where semaforo = 'por_vencer'),
    'vencidas', (select count(*) from v where semaforo = 'vencida'),
    'contestadas_hoy', (select count(*) from v where estado in ('contestada', 'no_se_consigue')
                        and (contestada_en at time zone 'America/Mexico_City')::date = hoy_planta()),
    'sin_usar', (select count(*) from v where estado = 'contestada' and not usada),
    'mes', jsonb_build_object(
      'resueltas', (select count(*) from res),
      'mediana_horas', (select round((percentile_cont(0.5) within group (order by horas_respuesta))::numeric, 1) from res),
      'mediana_acuse', (select round((percentile_cont(0.5) within group (order by horas_acuse))::numeric, 2) from res),
      'mas_de_un_dia', (select count(*) from res where horas_respuesta > 10) + (select count(*) from abiertas_largas),
      'abiertas_mas_de_un_dia', (select count(*) from abiertas_largas),
      'pct_mas_de_un_dia', (select round(((select count(*) from res where horas_respuesta > 10) + (select count(*) from abiertas_largas))::numeric
                                         / nullif((select count(*) from res) + (select count(*) from abiertas_largas), 0), 3)),
      'a_tiempo', (select count(*) from res where a_tiempo)),
    'linea_base', jsonb_build_object('mediana_horas', 3.8, 'pct_mas_de_un_dia', 0.35, 'mediana_horas_2026', 6.2,
                                     'pct_mas_de_un_dia_2026', 0.44, 'fuente', 'Chat de la empresa, abr-2025 a sep-2026 (481 solicitudes)'))
$$;

-- -----------------------------------------------------------------------------
-- 7. Recordatorios periódicos (pg_cron cada 15 min, solo en horario hábil):
--    por vencer → quien la tiene (o todo compras); vencida → compras y la jefatura
--    de quien la pidió. Una vez al día por solicitud y persona (avisar … una_vez).
-- -----------------------------------------------------------------------------
-- p_ahora existe para probarla a una hora fija (las pruebas corren a cualquier hora).
drop function if exists public.avisos_solicitudes_precio();
create or replace function public.avisos_solicitudes_precio(p_ahora timestamptz default now()) returns int
language plpgsql security definer set search_path = public as $$
declare v_n int := 0; r record; v_aviso numeric; v_compras uuid[];
begin
  if not en_horario_habil(p_ahora) then return 0; end if;
  v_aviso := coalesce((select (valor->>'por_vencer')::numeric from configuracion where clave = 'plazos_solicitud_precio'), 1);
  for r in select s.*, que_pide_solicitud(s) que, p.nombre quien from solicitudes_precio s join perfiles p on p.id = s.solicitante_id
           where s.estado in ('abierta', 'tomada') and s.vence_en <= sumar_horas_habiles(p_ahora, v_aviso) loop
    v_compras := case when r.tomada_por is not null then array[r.tomada_por] else array(select usuarios_con_rol('compras')) end;
    if r.vence_en <= p_ahora then
      v_n := v_n + avisar(v_compras, 'solicitud_precio_vencida', format('Vencida: precio de %s', r.que),
        format('%s · lo pidió %s%s · venció %s', r.folio, r.quien, case when r.urgente then ' (urgente)' else '' end,
               to_char(r.vence_en at time zone 'America/Mexico_City', 'DD/MM HH24:MI')),
        '/compras/solicitudes?id=' || r.id, 'solicitudes_precio', r.id::text, true);
      v_n := v_n + avisar(array(select jefes_solicitud(r.solicitante_id)), 'solicitud_precio_vencida',
        format('Compras no ha contestado %s', r.folio),
        format('%s pidió precio de %s; venció %s%s', r.quien, r.que, to_char(r.vence_en at time zone 'America/Mexico_City', 'DD/MM HH24:MI'),
               coalesce('. La tiene ' || (select nombre from perfiles where id = r.tomada_por), '. Nadie la ha tomado')),
        '/ventas/solicitudes?id=' || r.id, 'solicitudes_precio', r.id::text, true);
    else
      v_n := v_n + avisar(v_compras, 'solicitud_precio_por_vencer', format('Por vencer: precio de %s', r.que),
        format('%s · lo pidió %s · vence %s', r.folio, r.quien, to_char(r.vence_en at time zone 'America/Mexico_City', 'HH24:MI')),
        '/compras/solicitudes?id=' || r.id, 'solicitudes_precio', r.id::text, true);
    end if;
  end loop;
  return v_n;
end $$;
revoke execute on function public.avisos_solicitudes_precio(timestamptz) from public, anon, authenticated;

do $$ begin
  perform cron.unschedule('avisos-solicitudes-precio') where exists (select 1 from cron.job where jobname = 'avisos-solicitudes-precio');
  perform cron.schedule('avisos-solicitudes-precio', '*/15 * * * *', 'select public.avisos_solicitudes_precio()');
exception when others then
  raise notice 'pg_cron no está disponible: los recordatorios de solicitudes de precio quedan apagados (%).', sqlerrm;
end $$;

-- -----------------------------------------------------------------------------
-- 8. Fichas técnicas en el cotizador
-- -----------------------------------------------------------------------------
-- Las fichas y fotos VIGENTES de los artículos de una cotización. security invoker:
-- la RLS de documentos_tecnicos (077) ya le da a ventas solo lo vigente; el filtro
-- de estado va también aquí para que ingeniería, que sí ve borradores, no mande uno
-- al cliente desde el cotizador.
create or replace function public.fichas_de_articulos(p_articulos uuid[])
returns table (articulo_id uuid, documento_id uuid, folio text, revision text, tipo text, titulo text, drive_url text)
language sql stable security invoker set search_path = public as $$
  select d.articulo_id, d.id, d.folio, d.revision, d.tipo, d.titulo, d.drive_url
  from documentos_tecnicos d
  where d.articulo_id = any(p_articulos) and d.estado = 'vigente' and d.tipo in ('ficha', 'foto')
  order by d.articulo_id, case d.tipo when 'ficha' then 1 else 2 end, d.folio
$$;

-- Equipos que se cotizan sin ficha técnica vigente, por cuántas cotizaciones los
-- llevan. Cuenta cotizaciones de todos los vendedores (que ingeniería no puede leer),
-- por eso es security definer: solo regresa equipo y conteo, nada de clientes ni montos.
create or replace function public.equipos_sin_ficha(p_dias int default 365)
returns table (articulo_id uuid, clave text, nombre text, cotizaciones int, ultima date)
language plpgsql stable security definer set search_path = public as $$
begin
  if not puede('costeo', 2) then raise exception 'Solo ingeniería ve los equipos sin ficha' using errcode = '42501'; end if;
  return query
  select a.id, a.clave, a.nombre, count(distinct c.id)::int, max(c.fecha)
  from cotizacion_lineas l
  join cotizaciones c on c.id = l.cotizacion_id
  join articulos a on a.id = l.articulo_id
  where a.tipo = 'equipo' and c.fecha >= hoy_planta() - coalesce(p_dias, 365) and c.estado <> 'cancelada'
    and not exists (select 1 from documentos_tecnicos d where d.articulo_id = a.id and d.estado = 'vigente' and d.tipo = 'ficha')
  group by a.id, a.clave, a.nombre
  order by 4 desc, 5 desc, a.nombre;
end $$;

-- -----------------------------------------------------------------------------
-- 9. Hallazgos (los junta hallazgos() de 068)
-- -----------------------------------------------------------------------------
create or replace function public.hallazgos_solicitudes(p_area text)
returns table (area text, tono text, titulo text, detalle text, ruta text, peso int)
language plpgsql stable security invoker set search_path = public as $$
declare k int; r record; j jsonb; v_med numeric; v_pct numeric; v_txt text;
begin
  -- Compras: lo vencido, lo que está por vencer y el tiempo de respuesta contra el chat.
  if p_area in ('direccion', 'compras') and puede('compras', 2) then
    select count(*) into k from v_solicitudes_precio where semaforo = 'vencida';
    if k > 0 then
      select * into r from v_solicitudes_precio where semaforo = 'vencida' order by vence_en limit 1;
      area := 'compras'; tono := 'riesgo'; peso := 9; ruta := '/compras/solicitudes';
      titulo := format('%s %s de precio %s', k, case when k = 1 then 'solicitud' else 'solicitudes' end,
                       case when k = 1 then 'vencida' else 'vencidas' end);
      detalle := format('La más atrasada: %s, %s pidió %s y venció hace %s h hábiles. Mientras, el cliente sigue cotizando con otros.',
                        r.folio, r.solicitante, coalesce(r.articulo, r.descripcion), round(horas_habiles(r.vence_en, now()), 1));
      return next;
    end if;
    select count(*) into k from v_solicitudes_precio where semaforo = 'por_vencer';
    if k > 0 then
      area := 'compras'; tono := 'atencion'; peso := 14; ruta := '/compras/solicitudes';
      titulo := format('%s %s de precio por vencer', k, case when k = 1 then 'solicitud' else 'solicitudes' end);
      detalle := 'Vencen en menos de una hora hábil. Si el proveedor no contesta, avísale al vendedor desde la solicitud.';
      return next;
    end if;
    j := resumen_solicitudes_precio() -> 'mes';
    if (j->>'resueltas')::int > 0 then
      v_med := (j->>'mediana_horas')::numeric; v_pct := (j->>'pct_mas_de_un_dia')::numeric;
      area := 'compras'; peso := 52; ruta := '/compras/solicitudes';
      tono := case when v_med <= 3.8 and coalesce(v_pct, 0) <= 0.35 then 'bueno' else 'atencion' end;
      titulo := format('Precios de este mes: mediana de %s h hábiles, %s %% de más de un día', v_med, round(coalesce(v_pct, 0) * 100));
      detalle := format('En el chat eran 3.8 h y 35 %% (6.2 h y 44 %% en 2026). Van %s contestadas; cuentan también las abiertas que ya pasaron de un día.',
                        j->>'resueltas');
      return next;
    end if;
  end if;

  -- Ventas: precios que compras ya contestó y nadie ha usado (la RLS de la vista
  -- deja a cada vendedor ver los suyos y a la gerencia los de todos).
  if p_area in ('direccion', 'ventas') and puede('ventas', 2) then
    select count(*) into k from v_solicitudes_precio
    where estado = 'contestada' and not usada and contestada_en > now() - interval '30 days';
    if k > 0 then
      select * into r from v_solicitudes_precio
      where estado = 'contestada' and not usada and contestada_en > now() - interval '30 days' order by contestada_en limit 1;
      area := 'ventas'; tono := 'atencion'; peso := 16; ruta := '/ventas/solicitudes';
      titulo := format('%s %s de compras sin usar', k, case when k = 1 then 'precio' else 'precios' end);
      detalle := format('%s (%s) ya tiene precio de lista y entrega%s: aplícalo a la cotización o avísale al cliente.',
                        r.folio, left(coalesce(r.articulo, r.descripcion), 60), coalesce(' para ' || r.cliente, ''));
      return next;
    end if;
  end if;

  -- Ingeniería: equipos que se cotizan sin ficha técnica (los vendedores la piden por chat).
  if p_area in ('direccion', 'ingenieria') and puede('costeo', 2) then
    select count(*), string_agg(format('%s (%s)', x.nombre, x.cotizaciones), ', ') filter (where x.n <= 3)
    into k, v_txt
    from (select e.*, row_number() over (order by e.cotizaciones desc, e.ultima desc) n from equipos_sin_ficha(365) e) x;
    if k > 0 then
      area := 'ingenieria'; tono := 'atencion'; peso := 30; ruta := '/costeo/planos';
      titulo := format('%s %s se %s sin ficha técnica', k, case when k = 1 then 'equipo' else 'equipos' end,
                       case when k = 1 then 'cotiza' else 'cotizan' end);
      detalle := format('Los más cotizados: %s. Sin ficha en el ERP, el vendedor la pide por chat; ligar la de Drive toma un minuto.', v_txt);
      return next;
    end if;
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- 10. En vivo y permisos de ejecución
-- -----------------------------------------------------------------------------
do $$ begin
  alter publication supabase_realtime add table public.solicitudes_precio;
exception when duplicate_object then null; when undefined_object then null;
end $$;

revoke execute on function public.pedir_precio(text, uuid, numeric, boolean, text, text, text, uuid, uuid, uuid) from anon;
revoke execute on function public.agregar_foto_solicitud(uuid, text) from anon;
revoke execute on function public.tomar_solicitud_precio(uuid) from anon;
revoke execute on function public.contestar_solicitud_precio(uuid, numeric, public.moneda, uuid, int, date, text, uuid, jsonb) from anon;
revoke execute on function public.marcar_no_se_consigue(uuid, text) from anon;
revoke execute on function public.cancelar_solicitud_precio(uuid, text) from anon;
revoke execute on function public.aplicar_solicitud_precio(uuid) from anon;
revoke execute on function public.equipos_sin_ficha(int) from anon;

select public.optimizar_politicas();

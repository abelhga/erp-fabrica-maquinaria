-- =============================================================================
-- Seguimiento de cotizaciones: cada cotización enviada pide saber qué pasó.
--
-- En octubre se enviaron más de 100 cotizaciones y en todo el mes se anotó UNA actividad:
-- el embudo se llenaba solo (cotizar crea la oportunidad) y nadie lo movía, así que nadie
-- sabía qué pasó con 82 cotizaciones. Pedir «¿qué pasó?» solo al arrastrar a Negociación no
-- habría atrapado nada (en un mes se arrastró una tarjeta). La obligación tiene que colgar
-- de lo que sí hacen, cotizar, y anotar qué pasó tiene que ser lo que mueve la tarjeta:
--
-- 1. Enviar una cotización agenda un seguimiento a 3 días hábiles (uno por oportunidad: una
--    versión nueva lo recorre, no lo duplica). Lo cierra la base cuando la cotización se
--    vuelve pedido, se rechaza o la oportunidad se cierra.
-- 2. registrar_seguimiento() es la única forma de cerrarlo a mano: pide qué pasó, deja la
--    nota en la bitácora comercial (actividades, la que ya cuentan los objetivos y la cartera)
--    y el resultado mueve la oportunidad (negociando, perdida) y agenda el siguiente.
-- 3. Pasar a Negociación sin anotar qué pasó lo rechaza la base, no solo la pantalla.
-- 4. Freno: con más de 10 seguimientos vencidos, el vendedor no puede enviar cotizaciones
--    nuevas hasta ponerse al día; la gerencia de ventas lo libera por el día con un motivo.
--    Nunca frena un pedido: convertir en pedido sigue igual.
-- 5. Arranque: las cotizaciones ya enviadas reciben su seguimiento; las que ya pasaron de los
--    3 días se reparten de 8 en 8 por vendedor desde el siguiente día hábil, para no
--    amanecer con 40 vencidos (y el freno puesto) el primer día.
--
-- Los seguimientos van en su propia tabla y no en actividades: una tarea creada por la
-- máquina contaría como «contacto» para quedarse con el cliente (065) y como seguimiento
-- para el bono (070) sin que nadie hablara con nadie. Lo que sí cuenta es la nota de qué pasó.
-- =============================================================================

insert into public.configuracion (clave, valor, descripcion) values ('seguimiento_cotizaciones',
  '{"dias_habiles": 3, "dias_no_contesta": 2, "tope_vencidos": 10, "por_dia_al_arrancar": 8}',
  'Seguimiento de cotizaciones: días hábiles para preguntar qué pasó después de enviarla (y después de un «no contestó»), cuántos vencidos frenan el envío de cotizaciones nuevas y cuántos por día se repartieron al arrancar.')
on conflict (clave) do nothing;

-- Días hábiles de oficina: lunes a viernes, sin festivos de ley ni descansos de la empresa.
-- (sumar_dias_habiles, de compras, no conoce los festivos.)
create or replace function public.sumar_dias_laborables(p_desde date, p_dias int) returns date
language sql stable set search_path = public as $$
  select case when coalesce(p_dias, 0) <= 0 then p_desde else (
    select d::date from generate_series(p_desde + 1, p_desde + p_dias * 2 + 21, interval '1 day') d
    where extract(isodow from d) < 6
      and d::date not in (select festivos_lft(extract(year from d)::int))
      and not coalesce((select valor->'descansos_empresa' from configuracion where clave = 'calendario_laboral'), '[]'::jsonb)
              @> to_jsonb(to_char(d, 'YYYY-MM-DD'))
    order by d offset p_dias - 1 limit 1) end
$$;

create table public.seguimientos_cotizacion (
  id uuid primary key default gen_random_uuid(),
  oportunidad_id uuid not null references public.oportunidades(id) on delete cascade,
  cotizacion_id uuid references public.cotizaciones(id) on delete set null,
  vendedor_id uuid references public.perfiles(id),
  vence date not null,
  -- hecho = lo cerró una persona diciendo qué pasó; cerrado = lo cerró la base (pedido, rechazo…).
  estado text not null default 'pendiente' check (estado in ('pendiente', 'hecho', 'cerrado')),
  resultado text check (resultado in ('sigue', 'no_contesta', 'contactado', 'negociacion', 'perdida', 'pedido', 'cerrada')),
  que_paso text,
  actividad_id uuid references public.actividades(id) on delete set null,
  creado_en timestamptz not null default now(),
  cerrado_en timestamptz,
  cerrado_por uuid references public.perfiles(id)
);
create unique index seguimientos_uno_pendiente on public.seguimientos_cotizacion (oportunidad_id) where estado = 'pendiente';
create index seguimientos_por_vendedor on public.seguimientos_cotizacion (vendedor_id, vence) where estado = 'pendiente';
create index seguimientos_cotizacion_idx on public.seguimientos_cotizacion (cotizacion_id);
alter table public.seguimientos_cotizacion enable row level security;
create policy ver on public.seguimientos_cotizacion for select to authenticated
  using (vendedor_id = (select auth.uid()) or (select puede('ventas', 3)));
-- Nadie lo escribe directo: solo las funciones de abajo.
revoke insert, update, delete on public.seguimientos_cotizacion from authenticated, anon;

-- Cuándo la gerencia dejó enviar cotizaciones a alguien frenado, por qué y quién.
create table public.freno_liberado (
  id bigint generated always as identity primary key,
  vendedor_id uuid not null references public.perfiles(id),
  dia date not null default hoy_mx(),
  motivo text not null,
  por uuid references public.perfiles(id) default auth.uid(),
  en timestamptz not null default now(),
  unique (vendedor_id, dia)
);
alter table public.freno_liberado enable row level security;
create policy ver on public.freno_liberado for select to authenticated
  using (vendedor_id = (select auth.uid()) or (select puede('ventas', 3)));
revoke insert, update, delete on public.freno_liberado from authenticated, anon;

create or replace function public._config_seguimiento() returns jsonb
language sql stable set search_path = public as $$
  select '{"dias_habiles": 3, "dias_no_contesta": 2, "tope_vencidos": 10, "por_dia_al_arrancar": 8}'::jsonb
         || coalesce((select valor from configuracion where clave = 'seguimiento_cotizaciones'), '{}'::jsonb)
$$;

-- Uno pendiente por oportunidad: si ya hay, se recorre (otra versión enviada) en vez de duplicarse.
create or replace function public._programar_seguimiento(p_op uuid, p_cot uuid, p_vendedor uuid, p_vence date) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  update seguimientos_cotizacion set vence = p_vence, cotizacion_id = coalesce(p_cot, cotizacion_id), vendedor_id = coalesce(p_vendedor, vendedor_id)
  where oportunidad_id = p_op and estado = 'pendiente' returning id into v_id;
  if v_id is null then
    insert into seguimientos_cotizacion (oportunidad_id, cotizacion_id, vendedor_id, vence)
    values (p_op, p_cot, p_vendedor, p_vence) returning id into v_id;
  end if;
  return v_id;
end $$;

create or replace function public._cerrar_seguimiento(p_op uuid, p_resultado text, p_texto text) returns void
language sql security definer set search_path = public as $$
  update seguimientos_cotizacion set estado = 'cerrado', resultado = p_resultado, que_paso = p_texto, cerrado_en = now(), cerrado_por = auth.uid()
  where oportunidad_id = p_op and estado = 'pendiente'
$$;
revoke execute on function public._programar_seguimiento(uuid, uuid, uuid, date), public._cerrar_seguimiento(uuid, text, text) from public, anon, authenticated;

-- Cuántos vencidos trae alguien y si ya no puede enviar cotizaciones. Un vendedor solo se ve a sí mismo.
create or replace function public.freno_seguimiento(p_vendedor uuid default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v uuid := coalesce(p_vendedor, auth.uid()); v_n int; v_tope int; v_lib record;
begin
  if auth.uid() is not null and v is distinct from auth.uid() and not puede('ventas', 3) then v := auth.uid(); end if;
  v_tope := (_config_seguimiento()->>'tope_vencidos')::int;
  select count(*) into v_n from seguimientos_cotizacion where vendedor_id = v and estado = 'pendiente' and vence < hoy_mx();
  select l.motivo, p.nombre as por into v_lib from freno_liberado l left join perfiles p on p.id = l.por
  where l.vendedor_id = v and l.dia = hoy_mx();
  return jsonb_build_object('vencidos', v_n, 'tope', v_tope, 'liberado', v_lib.motivo is not null,
    'liberado_por', v_lib.por, 'motivo', v_lib.motivo, 'frenado', v_n > v_tope and v_lib.motivo is null);
end $$;

-- Enviar con el freno puesto no pasa (la gerencia sí puede enviar por alguien).
create or replace function public.trg_freno_seguimiento() returns trigger
language plpgsql security definer set search_path = public as $$
declare f jsonb;
begin
  if new.estado = 'enviada' and old.estado is distinct from 'enviada' and auth.uid() is not null and not puede('ventas', 3) then
    f := freno_seguimiento(coalesce(new.vendedor_id, auth.uid()));
    if (f->>'frenado')::boolean then
      raise exception 'Tienes % seguimientos vencidos y el tope es %: antes de enviar otra cotización, anota qué pasó con las que ya mandaste (Cotizaciones → Seguimiento) o pide a la gerencia de ventas que te libere por hoy.',
        f->>'vencidos', f->>'tope' using errcode = 'P0001';
    end if;
  end if;
  return new;
end $$;
create trigger freno_seguimiento before update of estado on public.cotizaciones
  for each row execute function public.trg_freno_seguimiento();

-- Enviar agenda (o recorre) el seguimiento; pedido, rechazo o cancelación lo cierran si ya no
-- queda otra cotización enviada en la oportunidad.
create or replace function public.trg_seguimiento_cotizacion() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_etapa text;
begin
  if new.oportunidad_id is null or new.estado is not distinct from old.estado then return null; end if;
  select etapa into v_etapa from oportunidades where id = new.oportunidad_id;
  if new.estado = 'enviada' and v_etapa not in ('ganada', 'perdida') then
    perform _programar_seguimiento(new.oportunidad_id, new.id,
      coalesce(new.vendedor_id, (select vendedor_id from oportunidades where id = new.oportunidad_id)),
      sumar_dias_laborables(hoy_mx(), (_config_seguimiento()->>'dias_habiles')::int));
  elsif new.estado in ('aceptada', 'rechazada', 'cancelada')
        and not exists (select 1 from cotizaciones c where c.oportunidad_id = new.oportunidad_id and c.id <> new.id and c.estado = 'enviada') then
    perform _cerrar_seguimiento(new.oportunidad_id, case when new.estado = 'aceptada' then 'pedido' else 'cerrada' end,
      case new.estado when 'aceptada' then 'Se volvió pedido'
                      when 'rechazada' then 'Cotización rechazada' || coalesce(': ' || new.motivo_rechazo, '')
                      else 'Cotización cancelada' end);
  end if;
  return null;
end $$;
create trigger seguimiento after update of estado on public.cotizaciones
  for each row execute function public.trg_seguimiento_cotizacion();

-- Negociación solo con «qué pasó» (registrar_seguimiento prende la bandera). Las cargas de
-- servicio (sin sesión) no pasan por aquí.
create or replace function public.trg_negociacion_con_que_paso() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.etapa = 'negociacion' and (tg_op = 'INSERT' or old.etapa is distinct from 'negociacion')
     and auth.uid() is not null and coalesce(current_setting('hegamex.que_paso', true), '') <> '1' then
    raise exception 'Para pasarla a Negociación anota qué pasó: qué está negociando el cliente y cuándo le vuelves a buscar'
      using errcode = '23514';
  end if;
  return new;
end $$;
create trigger negociacion_con_que_paso before insert or update of etapa on public.oportunidades
  for each row execute function public.trg_negociacion_con_que_paso();

-- Ganada o perdida por cualquier camino (pedido, rechazo, arrastrar a Perdida) cierra el seguimiento.
create or replace function public.trg_oportunidad_cierra_seguimiento() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.etapa in ('ganada', 'perdida') and old.etapa is distinct from new.etapa then
    perform _cerrar_seguimiento(new.id, case when new.etapa = 'ganada' then 'pedido' else 'cerrada' end,
      case when new.etapa = 'ganada' then 'Se ganó' else 'Se perdió' || coalesce(': ' || new.motivo_perdida, '') end);
  end if;
  return null;
end $$;
create trigger cierra_seguimiento after update of etapa on public.oportunidades
  for each row execute function public.trg_oportunidad_cierra_seguimiento();

-- La única forma de cerrar un seguimiento a mano. El resultado decide qué sigue:
--   sigue / no_contesta → otro seguimiento (3 o 2 días hábiles, o la fecha que dio el cliente)
--   contactado          → un prospecto pasa a Contactado
--   negociacion         → pasa a Negociación, con su siguiente seguimiento
--   perdida             → la oportunidad y sus cotizaciones vivas se cierran con el motivo
-- «Ya compró» no pasa por aquí: es convertir la cotización en pedido, y eso lo cierra solo.
create or replace function public.registrar_seguimiento(p_oportunidad uuid, p_resultado text, p_que_paso text default null,
  p_canal text default 'llamada', p_proxima date default null, p_motivo text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  o oportunidades;
  cfg jsonb := _config_seguimiento();
  v_texto text := nullif(trim(coalesce(p_que_paso, '')), '');
  v_desc text; v_act uuid; v_cot uuid; v_vence date; v_pend uuid;
begin
  select * into o from oportunidades where id = p_oportunidad;
  if not found then raise exception 'No encontré esa oportunidad'; end if;
  if not ((o.vendedor_id = auth.uid() and puede('ventas', 2)) or puede('ventas', 3)) then
    raise exception 'El seguimiento lo anota el vendedor de la oportunidad o la gerencia de ventas' using errcode = '42501';
  end if;
  if o.etapa in ('ganada', 'perdida') then raise exception 'Esa oportunidad ya está cerrada'; end if;
  if p_resultado is null or p_resultado not in ('sigue', 'no_contesta', 'contactado', 'negociacion', 'perdida') then
    raise exception 'Elige qué resultado tuvo';
  end if;
  if coalesce(p_canal, '') not in ('llamada', 'whatsapp', 'correo', 'visita', 'nota') then raise exception 'Elige por dónde fue'; end if;
  if p_resultado = 'no_contesta' then v_texto := coalesce(v_texto, 'No contestó'); end if;
  if coalesce(length(v_texto), 0) < 3 then
    raise exception 'Anota qué pasó (lo que dijo el cliente, qué sigue): sin eso no se cierra el seguimiento' using errcode = '23514';
  end if;
  if p_resultado = 'perdida' and coalesce(length(trim(p_motivo)), 0) < 3 then
    raise exception 'Elige por qué se perdió: sin eso no sabemos qué corregir' using errcode = '23514';
  end if;
  if p_proxima is not null and (p_proxima < hoy_mx() or p_proxima > hoy_mx() + 120) then
    raise exception 'El siguiente seguimiento va de hoy a cuatro meses';
  end if;

  -- La nota va a la bitácora comercial: es contacto de verdad (cuenta para la cartera y el bono).
  v_desc := case p_resultado
    when 'no_contesta' then case when v_texto = 'No contestó' then v_texto else 'No contestó: ' || v_texto end
    when 'contactado' then 'Contactado: ' || v_texto
    when 'negociacion' then 'Negociando: ' || v_texto
    when 'perdida' then 'Se perdió (' || trim(p_motivo) || '): ' || v_texto
    else v_texto end;
  insert into actividades (cliente_id, oportunidad_id, tipo, descripcion) values (o.cliente_id, o.id, p_canal, v_desc)
  returning id into v_act;

  select cotizacion_id into v_cot from seguimientos_cotizacion where oportunidad_id = o.id and estado = 'pendiente';
  v_cot := coalesce(v_cot, (select c.id from cotizaciones c where c.oportunidad_id = o.id and c.estado = 'enviada'
                            order by c.enviada_en desc nulls last limit 1));
  update seguimientos_cotizacion set estado = 'hecho', resultado = p_resultado, que_paso = v_texto, actividad_id = v_act,
    cerrado_en = now(), cerrado_por = auth.uid()
  where oportunidad_id = o.id and estado = 'pendiente';

  if p_resultado = 'perdida' then
    -- Los borradores se quedan como están: rechazarlos les gastaría un folio.
    update cotizaciones set estado = 'rechazada', motivo_rechazo = trim(p_motivo)
    where oportunidad_id = o.id and estado in ('por_autorizar', 'autorizada', 'enviada');
    update oportunidades set etapa = 'perdida', motivo_perdida = trim(p_motivo) where id = o.id;
    return null;
  end if;

  if p_resultado = 'negociacion' and o.etapa <> 'negociacion' then
    perform set_config('hegamex.que_paso', '1', true);
    update oportunidades set etapa = 'negociacion' where id = o.id;
    perform set_config('hegamex.que_paso', '0', true);
  elsif p_resultado = 'contactado' and o.etapa = 'prospecto' then
    update oportunidades set etapa = 'contactado' where id = o.id;
  end if;

  -- El siguiente: la fecha que dieron, o el plazo de siempre mientras siga viva la cotización.
  v_vence := coalesce(p_proxima, case
    when p_resultado = 'no_contesta' then sumar_dias_laborables(hoy_mx(), (cfg->>'dias_no_contesta')::int)
    when p_resultado in ('sigue', 'negociacion') or v_cot is not null then sumar_dias_laborables(hoy_mx(), (cfg->>'dias_habiles')::int)
  end);
  if v_vence is not null then
    v_pend := _programar_seguimiento(o.id, v_cot, coalesce(o.vendedor_id, auth.uid()), v_vence);
  end if;
  return v_pend;
end $$;
revoke execute on function public.registrar_seguimiento(uuid, text, text, text, date, text) from public, anon;
grant execute on function public.registrar_seguimiento(uuid, text, text, text, date, text) to authenticated;

-- La gerencia deja enviar por hoy a alguien frenado (un cliente esperando no se pierde por esto).
create or replace function public.liberar_freno_seguimiento(p_vendedor uuid, p_motivo text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not puede('ventas', 3) then raise exception 'Solo la gerencia de ventas quita el freno' using errcode = '42501'; end if;
  if coalesce(length(trim(p_motivo)), 0) < 3 then raise exception 'Escribe por qué lo liberas'; end if;
  insert into freno_liberado (vendedor_id, motivo, por) values (p_vendedor, trim(p_motivo), auth.uid())
  on conflict (vendedor_id, dia) do update set motivo = excluded.motivo, por = excluded.por, en = now();
  perform avisar(array[p_vendedor], 'freno_liberado', 'Puedes enviar cotizaciones hoy',
    'La gerencia te liberó por hoy (' || trim(p_motivo) || '). Mañana vuelve el freno si sigues con seguimientos vencidos.',
    '/ventas/cotizaciones?estado=seguimiento', null, null, false);
end $$;
revoke execute on function public.liberar_freno_seguimiento(uuid, text) from public, anon;
grant execute on function public.liberar_freno_seguimiento(uuid, text) to authenticated;

-- La cola de cada quien: lo que toca preguntar, con lo necesario para llamar sin abrir nada más.
create or replace view public.v_seguimientos with (security_invoker = true) as
select s.id, s.oportunidad_id, s.cotizacion_id, s.vendedor_id, pf.nombre as vendedor, s.vence, s.creado_en,
  s.vence < hoy_mx() as vencido, hoy_mx() - s.vence as dias_vencido,
  o.titulo, o.etapa, o.cliente_id, cl.nombre as cliente, o.monto_estimado,
  c.folio, c.total, c.moneda, c.enviada_en,
  ct.nombre as contacto, coalesce(nullif(ct.whatsapp, ''), ct.telefono) as telefono,
  (select count(*) from seguimientos_cotizacion x where x.oportunidad_id = s.oportunidad_id and x.estado = 'hecho') as veces,
  u.descripcion as ultimo_que_paso, u.en as ultimo_en
from seguimientos_cotizacion s
join oportunidades o on o.id = s.oportunidad_id
left join clientes cl on cl.id = o.cliente_id
left join perfiles pf on pf.id = s.vendedor_id
left join cotizaciones c on c.id = s.cotizacion_id
left join contactos ct on ct.id = coalesce(c.contacto_id, o.contacto_id)
left join lateral (select a.descripcion, a.en from actividades a where a.oportunidad_id = o.id and a.tipo <> 'tarea'
                   order by a.en desc limit 1) u on true
where s.estado = 'pendiente';

-- Para la gerencia: cómo va cada vendedor (el vendedor se ve solo a sí mismo).
create or replace view public.v_seguimientos_por_vendedor with (security_invoker = true) as
with s as (
  select vendedor_id,
    count(*) filter (where estado = 'pendiente') as pendientes,
    count(*) filter (where estado = 'pendiente' and vence < hoy_mx()) as vencidos,
    count(*) filter (where estado = 'pendiente' and vence = hoy_mx()) as para_hoy,
    count(*) filter (where estado = 'hecho' and cerrado_en > now() - interval '7 days') as anotados_7d
  from seguimientos_cotizacion group by vendedor_id
)
select s.vendedor_id, pf.nombre as vendedor, s.pendientes, s.vencidos, s.para_hoy, s.anotados_7d,
  (select count(*) from cotizaciones c where c.vendedor_id = s.vendedor_id and c.enviada_en > now() - interval '7 days') as enviadas_7d,
  s.vencidos > (_config_seguimiento()->>'tope_vencidos')::int and l.motivo is null as frenado,
  l.motivo as liberado_motivo
from s
join perfiles pf on pf.id = s.vendedor_id
left join freno_liberado l on l.vendedor_id = s.vendedor_id and l.dia = hoy_mx();

-- El tablero de oportunidades muestra el seguimiento de cada tarjeta (columnas nuevas al final).
create or replace view public.v_oportunidades with (security_invoker = true) as
select o.id, o.cliente_id, cl.nombre as cliente, o.contacto_id, o.titulo, o.etapa, o.linea, o.canal, o.monto_estimado,
  o.probabilidad, o.fecha_cierre_estimada, o.vendedor_id, pf.nombre as vendedor, o.fuente_id, fc.nombre as fuente,
  o.motivo_perdida, o.cerrada_en, o.notas, o.orden, o.etapa_desde,
  hoy_mx() - (o.etapa_desde at time zone 'America/Mexico_City')::date as dias_en_etapa,
  t.id as tarea_id, t.descripcion as tarea, t.vence_en as tarea_vence,
  (select count(*) from cotizaciones c where c.oportunidad_id = o.id) as cotizaciones,
  (select c.total from cotizaciones c where c.oportunidad_id = o.id order by c.creado_en desc limit 1) as ultima_cotizacion_total,
  o.creado_en, o.actualizado_en,
  sg.id as seguimiento_id, sg.vence as seguimiento_vence
from oportunidades o
join clientes cl on cl.id = o.cliente_id
left join perfiles pf on pf.id = o.vendedor_id
left join fuentes_contacto fc on fc.id = o.fuente_id
left join lateral (select a.id, a.descripcion, a.vence_en from actividades a
                   where a.oportunidad_id = o.id and not a.hecha and a.vence_en is not null order by a.vence_en limit 1) t on true
left join seguimientos_cotizacion sg on sg.oportunidad_id = o.id and sg.estado = 'pendiente';

-- Arranque: cada oportunidad abierta con una cotización enviada recibe su seguimiento. Las que
-- ya pasaron de su plazo se reparten desde el siguiente día hábil, de 8 en 8 por vendedor.
with base as (
  select distinct on (c.oportunidad_id) c.oportunidad_id, c.id as cot, coalesce(c.vendedor_id, o.vendedor_id) as vend,
    coalesce(c.enviada_en, c.creado_en) as enviada,
    sumar_dias_laborables((coalesce(c.enviada_en, c.creado_en) at time zone 'America/Mexico_City')::date,
                          (_config_seguimiento()->>'dias_habiles')::int) as toca
  from cotizaciones c join oportunidades o on o.id = c.oportunidad_id
  where c.estado = 'enviada' and o.etapa not in ('ganada', 'perdida')
    and not exists (select 1 from seguimientos_cotizacion s where s.oportunidad_id = c.oportunidad_id and s.estado = 'pendiente')
  order by c.oportunidad_id, coalesce(c.enviada_en, c.creado_en) desc
), atrasadas as (
  select b.*, row_number() over (partition by b.vend order by b.enviada) as n from base b where b.toca <= hoy_mx()
)
insert into seguimientos_cotizacion (oportunidad_id, cotizacion_id, vendedor_id, vence)
select b.oportunidad_id, b.cot, b.vend,
  case when a.n is null then b.toca
       else sumar_dias_laborables(hoy_mx(), 1 + ((a.n - 1) / (_config_seguimiento()->>'por_dia_al_arrancar')::int)::int) end
from base b left join atrasadas a on a.oportunidad_id = b.oportunidad_id;

-- El calendario de cada vendedor muestra sus seguimientos (la función es la de 160 con un bloque más).
CREATE OR REPLACE FUNCTION public.calendario(p_desde date, p_hasta date)
 RETURNS TABLE(clave text, tipo text, area text, fecha date, fecha_fin date, hora text, titulo text, detalle text, ruta text, tono text, mio boolean)
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
#variable_conflict use_column
declare
  v_yo uuid := auth.uid();
  v_hoy date := hoy_mx();
  v_ventas boolean := puede('ventas', 1);
  v_mi_etapa int := (select e.etapa_id from empleados e where e.usuario_id = auth.uid() and e.activo limit 1);
begin
  if p_desde is null or p_hasta is null or p_hasta < p_desde then raise exception 'El periodo está al revés'; end if;
  -- Un mes con sus orillas cabe de sobra; más que eso ya no es un calendario y el plan pesa.
  if p_hasta - p_desde > 124 then raise exception 'El calendario se pide de a lo más cuatro meses'; end if;

  -- Ventas -------------------------------------------------------------------------------
  return query
  select 'entrega:' || p.id, 'entrega', 'ventas', p.fecha_compromiso, null::date, null::text,
    'Entrega ' || p.folio || coalesce(' · ' || c.nombre, ''),
    case p.estado when 'listo' then 'Listo para entregar' when 'en_produccion' then 'En producción' else 'Confirmado' end,
    case when v_ventas then '/ventas/pedidos/' || p.id else '/produccion/pedidos' end,
    case when p.fecha_compromiso < v_hoy then 'peligro' when p.estado = 'listo' then 'ok' else 'neutro' end,
    p.vendedor_id = v_yo
  from pedidos p left join clientes c on c.id = p.cliente_id
  where p.estado in ('confirmado', 'en_produccion', 'listo') and not p.historico
    and p.fecha_compromiso between p_desde and p_hasta;

  return query
  select 'oportunidad:' || o.id, 'oportunidad', 'ventas', o.fecha_cierre_estimada, null::date, null::text,
    'Cierre esperado: ' || o.titulo, c.nombre, '/ventas/oportunidades'::text,
    case when o.fecha_cierre_estimada < v_hoy then 'aviso' else 'neutro' end, o.vendedor_id = v_yo
  from oportunidades o left join clientes c on c.id = o.cliente_id
  where o.cerrada_en is null and o.etapa not in ('ganada', 'perdida')
    and o.fecha_cierre_estimada between p_desde and p_hasta;

  return query
  select 'actividad:' || a.id, 'actividad', 'ventas', a.vence_en, null::date, null::text,
    initcap(a.tipo) || coalesce(' · ' || c.nombre, ''), a.descripcion,
    case when a.cliente_id is not null then '/ventas/clientes/' || a.cliente_id else '/ventas/oportunidades' end,
    case when a.vence_en < v_hoy then 'peligro' else 'neutro' end, a.usuario_id = v_yo
  from actividades a left join clientes c on c.id = a.cliente_id
  where not a.hecha and a.vence_en between p_desde and p_hasta
    -- La gerencia ve las de todos en Clientes; en su calendario, las suyas.
    and a.usuario_id = v_yo;

  -- Seguimiento de cotizaciones (172): el día que toca preguntar qué pasó. Los de cada quien.
  return query
  select 'seguimiento:' || s.id, 'seguimiento', 'ventas', s.vence, null::date, null::text,
    'Seguimiento' || coalesce(' · ' || cl.nombre, ''), coalesce(ct.folio || ' · ', '') || o.titulo,
    '/ventas/cotizaciones?estado=seguimiento'::text,
    case when s.vence < v_hoy then 'peligro' else 'neutro' end, true
  from seguimientos_cotizacion s join oportunidades o on o.id = s.oportunidad_id
  left join clientes cl on cl.id = o.cliente_id left join cotizaciones ct on ct.id = s.cotizacion_id
  where s.estado = 'pendiente' and s.vendedor_id = v_yo and s.vence between p_desde and p_hasta;

  -- «Volver a llamar»: solo cuenta lo último que se anotó de cada cliente (si se volvió a
  -- llamar después, la fecha vieja ya no aplica). Ventas puede leer los de todos; aquí, los tuyos.
  return query
  select 'llamar:' || r.cliente_id, 'llamar', 'ventas', r.volver_el, null::date, null::text,
    'Llamar a ' || coalesce(c.nombre, 'cliente'), r.razon, '/ventas/clientes/' || r.cliente_id,
    case when r.volver_el < v_hoy then 'aviso' else 'neutro' end, true
  from (select distinct on (x.cliente_id) x.* from resultados_contacto x where x.usuario_id = v_yo order by x.cliente_id, x.en desc) r
  left join clientes c on c.id = r.cliente_id
  where r.volver_el between p_desde and p_hasta;

  return query
  select 'devolucion:' || d.id, 'devolucion', 'ventas', d.fecha_esperada, null::date, null::text,
    'Llega ' || case d.tipo when 'reclamo' then 'reclamo ' when 'cancelacion' then 'cancelación ' else 'devolución ' end || d.folio,
    d.motivo, '/ventas/devoluciones'::text, case when d.fecha_esperada < v_hoy then 'aviso' else 'neutro' end, d.responsable_id = v_yo
  from devoluciones d
  where d.estado in ('abierta', 'respondida') and d.fecha_esperada between p_desde and p_hasta;

  -- Producción (la planta; el vendedor ya tiene la entrega de su pedido) ------------------
  if puede('produccion', 2) or puede('procesos', 1) then
    return query
    select 'compromiso:' || o.id, 'compromiso', 'produccion', o.fecha_compromiso, null::date, null::text,
      'Compromiso ' || regexp_replace(o.folio, '^([A-Z]+)-\d{4}-', '\1-') || ' · ' || a.nombre,
      coalesce((select p.folio from pedidos p where p.id = o.pedido_id), 'Para stock'),
      '/produccion/ordenes/' || o.id, case when o.fecha_compromiso < v_hoy then 'peligro' else 'neutro' end, false
    from ordenes_produccion o join articulos a on a.id = o.articulo_id
    where o.estado in ('planeada', 'liberada', 'en_proceso') and o.en_espera_motivo is null
      and o.fecha_compromiso between p_desde and p_hasta;

    -- Del plan del taller (el mismo del Gantt): cuándo termina cada orden y qué entra a cada área.
    drop table if exists _cal_plan;
    create temp table _cal_plan on commit drop as select * from plan_produccion();

    return query
    select 'fin_plan:' || o.id, 'fin_plan', 'produccion', z.fin, null::date, null::text,
      'Termina ' || regexp_replace(o.folio, '^([A-Z]+)-\d{4}-', '\1-') || ' (plan) · ' || a.nombre,
      case when o.fecha_compromiso is null then 'Sin fecha compromiso'
           when z.fin > o.fecha_compromiso then (z.fin - o.fecha_compromiso) || ' días después del compromiso (' || to_char(o.fecha_compromiso, 'DD/MM') || ')'
           else 'A tiempo para el compromiso (' || to_char(o.fecha_compromiso, 'DD/MM') || ')' end,
      '/produccion/ordenes/' || o.id,
      case when o.fecha_compromiso is not null and z.fin > o.fecha_compromiso then 'peligro' else 'ok' end, false
    from (select pl.orden_id, max(coalesce(pl.fin_plan, (pl.fin_real at time zone 'America/Mexico_City')::date)) fin
          from _cal_plan pl where pl.posicion is not null group by pl.orden_id
          having bool_and(pl.estado = 'terminada' or pl.fin_plan is not null)) z
    join ordenes_produccion o on o.id = z.orden_id join articulos a on a.id = o.articulo_id
    where z.fin between p_desde and p_hasta;

    return query
    select 'arranque:' || pl.etapa_id || ':' || pl.inicio_plan, 'arranque', 'produccion', pl.inicio_plan, null::date, null::text,
      'Entran a ' || et.nombre || ': ' || string_agg(regexp_replace(o.folio, '^([A-Z]+)-\d{4}-', '\1-'), ', ' order by pl.posicion),
      count(*) || case when count(*) = 1 then ' orden' else ' órdenes' end || ' según el plan',
      '/produccion/gantt'::text, 'neutro'::text, coalesce(pl.etapa_id = v_mi_etapa, false)
    from _cal_plan pl join etapas et on et.id = pl.etapa_id join ordenes_produccion o on o.id = pl.orden_id
    where pl.estado = 'pendiente' and pl.inicio_plan between p_desde and p_hasta
    group by pl.etapa_id, et.nombre, pl.inicio_plan;
  end if;

  -- Compras, almacén e importaciones -------------------------------------------------------
  return query
  select 'requisicion:' || r.id, 'requisicion', 'compras', r.necesaria_para, null::date, null::text,
    'Material para ' || r.folio, r.notas, '/compras/ordenes?vista=requisiciones'::text,
    case when r.necesaria_para < v_hoy then 'peligro' else 'neutro' end, r.solicitante_id = v_yo
  from requisiciones r
  where r.estado in ('abierta', 'en_compra') and r.necesaria_para between p_desde and p_hasta;

  return query
  select 'compra:' || oc.id, 'compra', 'compras', oc.fecha_entrega, null::date, null::text,
    'Llega ' || oc.folio || coalesce(' · ' || pr.nombre, ''),
    case oc.estado when 'parcial' then 'Llegó una parte' else 'Por recibir' end, '/compras/ordenes/' || oc.id,
    case when oc.fecha_entrega < v_hoy then 'peligro' else 'neutro' end, oc.creado_por = v_yo
  from ordenes_compra oc left join proveedores pr on pr.id = oc.proveedor_id
  where oc.estado in ('enviada', 'parcial') and oc.fecha_entrega between p_desde and p_hasta;

  return query
  select 'puerto:' || b.id, 'embarque', 'importaciones', b.eta, null::date, null::text,
    b.folio || ' llega a puerto', coalesce(b.descripcion, b.puerto_destino), '/importaciones/' || b.id,
    case when b.eta < v_hoy then 'aviso' else 'neutro' end, b.creado_por = v_yo
  from embarques b join v_embarque_etapa ve on ve.embarque_id = b.id
  where not b.cancelado and ve.arribo is null and b.eta between p_desde and p_hasta;

  return query
  select 'planta:' || b.id, 'embarque', 'importaciones', ve.llegada_planta_estimada, null::date, null::text,
    b.folio || ' llega a planta (estimado)', b.descripcion, '/importaciones/' || b.id, 'info'::text, b.creado_por = v_yo
  from embarques b join v_embarque_etapa ve on ve.embarque_id = b.id
  where not b.cancelado and ve.en_planta is null and ve.llegada_planta_estimada between p_desde and p_hasta;

  return query
  select 'recoleccion:' || e.id, 'recoleccion', 'compras', e.fecha_recoleccion, null::date, null::text,
    'Recolección ' || e.folio || coalesce(' · ' || coalesce(e.dest_empresa, e.destinatario), ''), e.destino, '/almacen/envios'::text,
    case when e.fecha_recoleccion < v_hoy then 'peligro' else 'neutro' end, e.solicitado_por = v_yo
  from envios e
  where e.estado in ('solicitado', 'cotizado', 'guia_lista', 'empacado') and e.fecha_recoleccion between p_desde and p_hasta;

  -- Servicio y mantenimiento ---------------------------------------------------------------
  return query
  select 'servicio:' || s.id, 'servicio', 'servicio', (s.inicio at time zone 'America/Mexico_City')::date,
    nullif((coalesce(s.fin, s.inicio) at time zone 'America/Mexico_City')::date, (s.inicio at time zone 'America/Mexico_City')::date),
    to_char(s.inicio at time zone 'America/Mexico_City', 'HH24:MI'),
    'Servicio ' || s.folio || coalesce(' · ' || s.equipo, ''), s.lugar, '/servicio/' || s.id,
    case when s.estado = 'en_curso' then 'marca' else 'neutro' end,
    s.programado_por = v_yo or exists (select 1 from servicio_cuadrilla q join empleados e on e.id = q.empleado_id
                                      where q.servicio_id = s.id and q.vigente and e.usuario_id = v_yo)
  from servicios s
  where s.estado in ('programada', 'en_curso') and s.inicio is not null
    and (s.inicio at time zone 'America/Mexico_City')::date <= p_hasta
    and (coalesce(s.fin, s.inicio) at time zone 'America/Mexico_City')::date >= p_desde;

  return query
  select 'servicio_pedido:' || s.id, 'servicio_pedido', 'servicio', s.fecha_deseada, null::date, null::text,
    'Servicio pedido ' || s.folio || coalesce(' · ' || s.equipo, ''), 'Falta programarlo', '/servicio/' || s.id,
    'aviso'::text, s.solicitado_por = v_yo
  from servicios s
  where s.estado = 'solicitada' and s.fecha_deseada between p_desde and p_hasta;

  return query
  select 'preventivo:' || om.id, 'preventivo', 'servicio', om.vence, null::date, null::text,
    'Preventivo ' || m.numero || ' · ' || m.nombre, om.folio, '/servicio/maquinas/' || m.id,
    case when om.vence < v_hoy then 'peligro' else 'neutro' end, m.asignada_a = v_yo
  from ordenes_mantenimiento om join maquinas m on m.id = om.maquina_id
  where om.tipo = 'preventivo' and om.estado in ('pendiente', 'en_proceso') and om.vence between p_desde and p_hasta;

  return query
  select 'resguardo:' || r.id, 'resguardo', 'servicio', r.devolver_en, null::date, null::text,
    'Devolver ' || m.nombre, coalesce(e.nombre, r.persona), '/servicio/resguardos'::text,
    case when r.devolver_en < v_hoy then 'peligro' else 'neutro' end, e.usuario_id = v_yo
  from resguardos r join maquinas m on m.id = r.maquina_id left join empleados e on e.id = r.empleado_id
  where r.devuelto_en is null and r.devolver_en between p_desde and p_hasta;

  -- Finanzas: lo que vence de pagar (no lo ve quien no tiene finanzas, aunque vea la orden).
  if puede('finanzas', 1) then
    return query
    select 'pago:' || pp.orden_compra_id, 'pago', 'finanzas', pp.vence_pago, null::date, null::text,
      'Pagar ' || pp.folio || coalesce(' · ' || pp.proveedor, ''),
      'Saldo $' || to_char(pp.saldo, 'FM999,999,999,990.00') || ' ' || pp.moneda, '/finanzas/pagos'::text,
      case when pp.vence_pago < v_hoy then 'peligro' when pp.vence_pago <= v_hoy + 3 then 'aviso' else 'neutro' end, false
    from v_por_pagar pp
    where pp.saldo > 0 and pp.vence_pago between p_desde and p_hasta;
  end if;

  -- Personas -------------------------------------------------------------------------------
  -- Ausencias: las ve RRHH, la gerencia de producción las de su gente y cada quien las suyas
  -- (lo decide la RLS de incidencias).
  return query
  select 'ausencia:' || i.id, 'ausencia', 'rrhh', i.inicio, nullif(coalesce(i.fin, i.inicio), i.inicio), null::text,
    split_part(e.nombre, ' ', 1) || coalesce(' ' || nullif(split_part(e.nombre, ' ', 2), ''), '') || ' · ' ||
      case i.tipo when 'vacaciones' then 'Vacaciones' when 'incapacidad' then 'Incapacidad' else 'Permiso' end,
    case when i.estado = 'solicitada' then 'Por autorizar' end, '/rrhh/incidencias'::text,
    case when i.estado = 'solicitada' then 'aviso' else 'info' end, e.usuario_id = v_yo
  from incidencias i join empleados e on e.id = i.empleado_id
  where i.tipo in ('vacaciones', 'permiso_con_goce', 'permiso_sin_goce', 'incapacidad') and i.estado <> 'rechazada'
    and i.inicio <= p_hasta and coalesce(i.fin, i.inicio) >= p_desde;

  -- Cumpleaños de la gente que ya puedes ver (un 29 de febrero se festeja el 28 si el año no es bisiesto).
  return query
  select 'cumple:' || e.id || ':' || d.dia, 'cumpleanos', 'rrhh', d.dia, null::date, null::text,
    'Cumpleaños de ' || split_part(e.nombre, ' ', 1) || coalesce(' ' || nullif(split_part(e.nombre, ' ', 2), ''), ''),
    null::text, case when puede('rrhh', 1) then '/rrhh/empleados' end, 'info'::text, e.usuario_id = v_yo
  from empleados e
  cross join lateral (
    select (make_date(y, extract(month from e.fecha_nacimiento)::int, 1)
            + (least(extract(day from e.fecha_nacimiento)::int,
                     extract(day from (make_date(y, extract(month from e.fecha_nacimiento)::int, 1) + interval '1 month - 1 day'))::int) - 1))::date dia
    from generate_series(extract(year from p_desde)::int, extract(year from p_hasta)::int) y
  ) d
  where e.activo and e.baja_en is null and e.fecha_nacimiento is not null and d.dia between p_desde and p_hasta;

  -- Pendientes: los que te tocan y los que pediste (dirección puede leerlos todos; en su
  -- calendario, solo los suyos).
  return query
  select 'pendiente:' || p.id, 'pendiente', 'personal', p.vence, null::date, null::text,
    p.titulo,
    case when p.responsable_id = v_yo then p.detalle else 'Le toca a ' || coalesce(pf.nombre, 'otra persona') end,
    coalesce(p.ruta, '/pendientes'), case when p.vence < v_hoy then 'peligro' else 'neutro' end, p.responsable_id = v_yo
  from pendientes p left join perfiles pf on pf.id = p.responsable_id
  where p.estado = 'abierto' and p.vence between p_desde and p_hasta
    and (p.responsable_id = v_yo or p.creado_por = v_yo);
end $function$;

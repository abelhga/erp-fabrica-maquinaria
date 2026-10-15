-- =============================================================================
-- Seguimiento de "A quién llamar hoy": que quede quién le escribió a quién.
--
-- Por qué: los botones de WhatsApp y llamar solo abrían la app; nada quedaba
-- registrado. Al día siguiente la tarjeta seguía igual, el vendedor no sabía si ya
-- le había escrito, y con un cliente libre dos vendedores podían escribirle el
-- mismo día sin saberlo.
--
-- Un mensaje es un INTENTO, no una oportunidad: si cada WhatsApp creara una
-- oportunidad en "Contactado", el embudo se llena de gente que nunca contestó y
-- deja de servir para pronosticar. La oportunidad nace solo cuando el cliente
-- contesta con interés.
--
-- Cadencia: WhatsApp (día 0), llamada (día 3), último mensaje (día 10). Cada
-- seguimiento se cierra con un resultado: le interesa (crea la oportunidad), no por
-- ahora (vuelve a la lista en 90 días), ya no compra (sale, con el motivo), o sin
-- respuesta (3 intentos y una semana sin contestar: vuelve en 90 días).
--
-- Visibilidad: los intentos y resultados los ve todo el que vende (ventas 2+),
-- para que nadie le escriba a un cliente que otro ya está siguiendo. Solo se
-- comparte el intento (quién, cuándo, por dónde y cómo terminó): ni el mensaje,
-- ni teléfonos, ni compras; eso sigue con la cartera de siempre (cliente_visible).
-- =============================================================================

create table public.intentos_contacto (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  usuario_id uuid not null default auth.uid() references public.perfiles(id),
  canal text not null check (canal in ('whatsapp', 'llamada', 'correo')),
  motivo text check (motivo in ('cotizacion', 'le_toca', 'refacciones', 'reactivar')),
  en timestamptz not null default now()
);
create index intentos_contacto_cliente on public.intentos_contacto (cliente_id, en desc);
create index intentos_contacto_usuario on public.intentos_contacto (usuario_id, en desc);

create table public.resultados_contacto (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  usuario_id uuid not null default auth.uid() references public.perfiles(id),
  resultado text not null check (resultado in ('interesa', 'no_por_ahora', 'ya_no_compra', 'sin_respuesta')),
  -- Sin texto libre: lo ven todos los vendedores y un comentario de un cliente no es de todos.
  razon text check (razon in ('cerro', 'competencia', 'ya_no_ocupa', 'otro')),
  volver_el date,
  oportunidad_id uuid references public.oportunidades(id) on delete set null,
  en timestamptz not null default now(),
  check (resultado <> 'ya_no_compra' or razon is not null)
);
create index resultados_contacto_cliente on public.resultados_contacto (cliente_id, en desc);

alter table public.intentos_contacto enable row level security;
alter table public.resultados_contacto enable row level security;
-- Nadie escribe directo: registrar_intento() y cerrar_seguimiento() revisan la cartera.
create policy ver on public.intentos_contacto for select to authenticated using ((select puede('ventas', 2)));
create policy ver on public.resultados_contacto for select to authenticated using ((select puede('ventas', 2)));
create trigger auditar after insert or update or delete on public.intentos_contacto for each row execute function public.auditar();
create trigger auditar after insert or update or delete on public.resultados_contacto for each row execute function public.auditar();

-- Estado del seguimiento de cada cliente (solo los que tienen intentos o resultado).
-- Las fechas van en hora de la planta: un intento a las 11 pm no es "mañana".
create or replace view public.v_seguimiento_clientes with (security_invoker = true) as
with hoy as (select hoy_planta() d),
res as (
  select distinct on (r.cliente_id) r.* from public.resultados_contacto r order by r.cliente_id, r.en desc
),
ints as (
  -- Los intentos del seguimiento en curso: los posteriores al último resultado.
  select i.cliente_id, count(*)::int n,
    min((i.en at time zone 'America/Mexico_City')::date) primero,
    max((i.en at time zone 'America/Mexico_City')::date) ultimo,
    max(i.en) ultimo_en,
    (array_agg(i.canal order by i.en desc))[1] ultimo_canal,
    (array_agg(i.usuario_id order by i.en desc))[1] ultimo_usuario
  from public.intentos_contacto i left join res on res.cliente_id = i.cliente_id
  where res.en is null or i.en > res.en
  group by i.cliente_id
)
select coalesce(i.cliente_id, r.cliente_id) as cliente_id,
  i.n as intentos, i.primero, i.ultimo, i.ultimo_en, i.ultimo_canal, i.ultimo_usuario, pi.nombre as ultimo_quien,
  r.resultado, r.razon, r.en as resultado_en, pr.nombre as resultado_quien, r.oportunidad_id,
  case
    when i.n >= 3 and hoy.d - i.ultimo >= 7 then 'sin_respuesta'
    when i.n is not null then 'seguimiento'
    else r.resultado
  end as estado,
  case
    when i.n >= 3 and hoy.d - i.ultimo >= 7 then i.ultimo + 90
    when i.n is null then r.volver_el
  end as volver_el,
  case when i.n = 1 then 'llamar' when i.n = 2 then 'ultimo_mensaje' when i.n >= 3 then 'esperar' end as siguiente,
  case when i.n = 1 then i.primero + 3 when i.n = 2 then i.primero + 10 when i.n >= 3 then i.ultimo + 7 end as siguiente_el
from ints i
full join res r on r.cliente_id = i.cliente_id
cross join hoy
left join public.perfiles pi on pi.id = i.ultimo_usuario
left join public.perfiles pr on pr.id = r.usuario_id;

-- Clientes que no van en la lista por ahora: los que dijeron "no por ahora", los que
-- no contestaron 3 intentos (90 días) y los que ya no compran. Función de conjunto
-- (security definer) para que la lista los saque aunque quien la vea no lea intentos.
create or replace function public.clientes_en_pausa() returns setof uuid
language sql stable security definer set search_path = public as $$
  select s.cliente_id from v_seguimiento_clientes s
  where s.estado in ('no_por_ahora', 'sin_respuesta', 'ya_no_compra')
    and (s.volver_el is null or s.volver_el > hoy_planta())
$$;

create or replace function public.registrar_intento(p_cliente uuid, p_canal text, p_motivo text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not puede('ventas', 2) then raise exception 'Solo ventas registra intentos de contacto' using errcode = '42501'; end if;
  -- Solo a clientes de su cartera o libres (lo mismo que ve en la lista).
  if not cliente_visible(p_cliente) then raise exception 'Ese cliente es de otro vendedor' using errcode = '42501'; end if;
  insert into intentos_contacto (cliente_id, canal, motivo) values (p_cliente, p_canal, p_motivo) returning id into v_id;
  return v_id;
end $$;

-- Deshacer un intento registrado por error (un toque de más): solo el suyo y al momento.
create or replace function public.deshacer_intento(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from intentos_contacto where id = p_id and usuario_id = auth.uid() and en > now() - interval '15 minutes';
  if not found then raise exception 'Solo se deshace un intento propio en los primeros 15 minutos' using errcode = '42501'; end if;
end $$;

create or replace function public.cerrar_seguimiento(p_cliente uuid, p_resultado text, p_razon text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_op uuid; v_motivo text; v_cliente text; v_volver date;
begin
  if not puede('ventas', 2) then raise exception 'Solo ventas cierra seguimientos' using errcode = '42501'; end if;
  if not cliente_visible(p_cliente) then raise exception 'Ese cliente es de otro vendedor' using errcode = '42501'; end if;
  if p_resultado = 'ya_no_compra' and p_razon is null then
    raise exception 'Di por qué ya no compra (cerró, competencia, ya no ocupa u otro)' using errcode = '22023';
  end if;
  v_volver := case when p_resultado in ('no_por_ahora', 'sin_respuesta') then hoy_planta() + 90 end;
  if p_resultado = 'interesa' then
    -- Si ya tiene una oportunidad abierta, esa es; si no, nace en "Contactado".
    select id into v_op from oportunidades where cliente_id = p_cliente and etapa not in ('ganada', 'perdida') order by creado_en desc limit 1;
    if v_op is null then
      select nombre into v_cliente from clientes where id = p_cliente;
      select motivo into v_motivo from intentos_contacto where cliente_id = p_cliente and motivo is not null order by en desc limit 1;
      insert into oportunidades (cliente_id, titulo, etapa, linea, vendedor_id)
      values (p_cliente,
        case v_motivo when 'refacciones' then 'Refacciones: ' when 'le_toca' then 'Recompra: ' when 'cotizacion' then 'Seguimiento de cotización: ' else 'Reactivación: ' end || v_cliente,
        'contactado', case when v_motivo = 'refacciones' then 'refacciones'::linea_venta else 'maquinaria'::linea_venta end, auth.uid())
      returning id into v_op;
    else
      update oportunidades set etapa = 'contactado' where id = v_op and etapa = 'prospecto';
    end if;
  end if;
  insert into resultados_contacto (cliente_id, resultado, razon, volver_el, oportunidad_id)
  values (p_cliente, p_resultado, case when p_resultado = 'ya_no_compra' then p_razon end, v_volver, v_op)
  returning id into v_id;
  return v_op;
end $$;

revoke execute on function public.registrar_intento(uuid, text, text) from public, anon;
revoke execute on function public.deshacer_intento(uuid) from public, anon;
revoke execute on function public.cerrar_seguimiento(uuid, text, text) from public, anon;
revoke execute on function public.clientes_en_pausa() from public, anon;
grant execute on function public.registrar_intento(uuid, text, text) to authenticated;
grant execute on function public.deshacer_intento(uuid) to authenticated;
grant execute on function public.cerrar_seguimiento(uuid, text, text) to authenticated;
grant execute on function public.clientes_en_pausa() to authenticated;

-- La lista ya no muestra a quien está en pausa (cambia solo una condición).
create or replace function public.oportunidades_sugeridas(p_limite int default 40)
returns table (cliente_id uuid, cliente text, vendedor_id uuid, vendedor text, motivo text, detalle text,
               ultima_compra date, ultima_descripcion text, compras int, total_historico numeric,
               ticket_promedio numeric, dias_sin_comprar int, intervalo_tipico int, valor_estimado numeric,
               puntaje numeric, cotizacion_id uuid, contacto text, telefono text, whatsapp text, correo text)
language sql stable security invoker as $$
  with hoy as (select (now() at time zone 'America/Mexico_City')::date d),
  arranque as (select coalesce((select (valor #>> '{}')::date from configuracion where clave = 'fecha_arranque'), current_date) f),
  ventas as (
    select h.cliente_id, h.fecha, h.monto, h.descripcion
    from historial_ventas_hoja h, arranque where h.tipo = 'Venta' and h.cliente_id is not null and h.monto > 0 and h.fecha < arranque.f
    union all
    select p.cliente_id, p.fecha, p.total * p.tipo_cambio,
      (select string_agg(l.titulo, ', ' order by l.orden) from pedido_lineas l where l.pedido_id = p.id)
    from pedidos p, arranque where not p.historico and p.estado <> 'cancelado' and p.fecha >= arranque.f
  ),
  -- Varias facturas el mismo día son una sola compra.
  compras as (
    select v.cliente_id, v.fecha, sum(v.monto) monto, string_agg(distinct v.descripcion, '; ') descripcion,
      v.fecha - lag(v.fecha) over (partition by v.cliente_id order by v.fecha) gap
    from ventas v group by v.cliente_id, v.fecha
  ),
  res as (
    select c.cliente_id, count(*)::int n, sum(c.monto) total, max(c.fecha) ultima,
      (array_agg(c.descripcion order by c.fecha desc))[1] ultima_desc,
      (array_agg(c.monto order by c.fecha desc))[1] ultimo_monto,
      -- Compras a menos de 2 semanas de la anterior son el mismo pedido partido.
      round(percentile_cont(0.5) within group (order by c.gap) filter (where c.gap > 14))::int intervalo
    from compras c group by c.cliente_id
  ),
  cand as (
    select r.*, hoy.d - r.ultima dias, r.total / r.n ticket,
      case
        -- "Ya le toca" solo con un ritmo de compra de hasta un año y sin haberlo pasado
        -- por más del doble; más allá ya no es ritmo, es un cliente que se fue (reactivar).
        when r.n >= 3 and r.intervalo between 30 and 365 and hoy.d - r.ultima >= r.intervalo
             and hoy.d - r.ultima <= r.intervalo * 2 then 'le_toca'
        when r.ultimo_monto >= 40000 and hoy.d - r.ultima between 180 and 1460
             and r.ultima_desc ~* '(banda|elevador|transportador|cribadora|dosificadora|tolva|silo|bazuca|gusano|sin ?fin|helicoidal)' then 'refacciones'
        when r.n >= 2 and hoy.d - r.ultima between 180 and 1095 then 'reactivar'
      end motivo
    from res r, hoy
  ),
  cot as (
    select distinct on (c.cliente_id) c.cliente_id, c.id, c.folio, c.total * c.tipo_cambio total, c.fecha + c.vigencia_dias vence
    from cotizaciones c, hoy
    where c.estado in ('enviada', 'autorizada') and c.cliente_id is not null
      and c.fecha + c.vigencia_dias between hoy.d - 10 and hoy.d + 7
    order by c.cliente_id, c.total desc
  ),
  todo as (
    select coalesce(k.cliente_id, x.cliente_id) cliente_id,
      case when k.cliente_id is not null then 'cotizacion' else x.motivo end motivo,
      x.n, x.total, x.ultima, x.ultima_desc, x.ultimo_monto, x.intervalo, x.dias, x.ticket,
      k.id cot_id, k.folio, k.total cot_total, k.vence
    from (select * from cand where motivo is not null) x
    full join cot k on k.cliente_id = x.cliente_id
  )
  , elegidos as (
  select t.cliente_id, cl.nombre, cl.vendedor_id, pf.nombre vendedor, t.motivo,
    case t.motivo
      when 'cotizacion' then format('La cotización %s por %s %s el %s. Llamar antes de que se enfríe.',
        t.folio, texto_dinero(t.cot_total), case when t.vence < (select d from hoy) then 'venció' else 'vence' end, to_char(t.vence, 'DD/MM'))
      when 'le_toca' then format('Compra cada ~%s días y ya van %s. La última fue %s: %s.',
        t.intervalo, t.dias, texto_dinero(t.ultimo_monto), left(t.ultima_desc, 80))
      when 'refacciones' then format('Hace %s meses compró %s (%s). A estas alturas ya pide rodillos, banda, cangilones o mantenimiento.',
        round(t.dias / 30.0), left(t.ultima_desc, 80), texto_dinero(t.ultimo_monto))
      else format('Compró %s veces (%s en total) y lleva %s meses sin comprar. Lo último: %s.',
        t.n, texto_dinero(t.total), round(t.dias / 30.0), left(t.ultima_desc, 80))
    end detalle,
    t.ultima, t.ultima_desc, t.n, round(t.total) total, round(t.ticket) ticket, t.dias, t.intervalo,
    -- Valor estimado: lo cotizado, o lo que suele comprar; en refacciones, una fracción del equipo.
    -- En refacciones, un 5 % del equipo (con tope de $150 mil): un silo de $2.7 M no
    -- pide $400 mil de refacciones en medio año.
    round(case t.motivo when 'cotizacion' then t.cot_total when 'refacciones' then least(greatest(t.ultimo_monto * 0.05, 10000), 150000) else t.ticket end) valor,
    round(case t.motivo
      when 'cotizacion' then t.cot_total * 1.5
      when 'le_toca' then t.ticket * t.n / (t.n + 2.0) * 1.2
      when 'refacciones' then least(greatest(t.ultimo_monto * 0.05, 10000), 150000) * 1.5 * (1 - t.dias / 1600.0)
      else t.ticket * 0.6 * (1 - t.dias / 1200.0) end) puntaje,
    t.cot_id
  from todo t
  join clientes cl on cl.id = t.cliente_id
  left join perfiles pf on pf.id = cl.vendedor_id
  where cl.activo
    -- Público en general, mostrador y Mercado Libre no son a quién llamar.
    and cl.nombre !~* '(p[uú]blico|mostrador|mercado ?libre|^demo )'
    -- Si ya hay una oportunidad abierta, el vendedor ya está en eso.
    and not exists (select 1 from oportunidades o where o.cliente_id = t.cliente_id and o.etapa not in ('ganada', 'perdida'))
    -- Dijo "no por ahora", no contestó 3 intentos o ya no compra: fuera hasta que toque volver.
    and t.cliente_id not in (select clientes_en_pausa())
    and (t.motivo = 'cotizacion' or not exists (
      select 1 from cotizaciones c where c.cliente_id = t.cliente_id and c.estado in ('borrador', 'por_autorizar', 'autorizada', 'enviada')
        and c.fecha >= (select d from hoy) - 45))
  order by 15 desc
  limit p_limite
  )
  -- El contacto se busca solo para los que quedaron, no para los cientos de candidatos.
  select e.*, ct.nombre, ct.telefono, ct.whatsapp, ct.correo
  from elegidos e
  left join lateral (select * from contactos c where c.cliente_id = e.cliente_id
                     order by c.principal desc, (c.whatsapp is not null or c.telefono is not null) desc, c.creado_en limit 1) ct on true
  order by e.puntaje desc
$$;

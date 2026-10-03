-- =============================================================================
-- Claude como capa de todo el ERP.
--
-- Tres piezas, de la más barata a la más cara:
--  1. hallazgos(area): reglas en SQL que dicen qué merece atención hoy en cada
--     área. Funcionan sin llave de la API y sin costo; son el piso.
--  2. oportunidades_sugeridas(): a quién llamar hoy y por qué (cotizaciones por
--     vencer, clientes a los que "ya les toca", equipos que ya piden refacciones,
--     clientes que dejaron de comprar). Sale del libro de ventas desde 2018.
--  3. La función de borde `asistente` (supabase/functions/asistente): Claude lee
--     lo anterior y todo lo demás con la sesión de quien pregunta, así que la RLS
--     le aplica igual que a la pantalla: a un vendedor no le puede contar un costo.
--
-- Todo es de solo lectura. Lo que el asistente propone (un mensaje, una llamada)
-- lo ejecuta una persona.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- cliente_visible() decía que sí a CUALQUIER usuario para los clientes sin
-- vendedor (1,225 de 2,098): un almacenista o un soldador podía leer el libro de
-- ventas y los contactos de esos clientes. Ahora además pide ser de ventas.
-- Y las políticas de lectura que la llamaban fila por fila (0.3 ms cada vez, 700 ms
-- para leer los contactos) usan una subconsulta que se resuelve una sola vez.
-- -----------------------------------------------------------------------------
create or replace function public.cliente_visible(p_cliente uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select puede('ventas', 3) or (puede('ventas', 1) and exists (
    select 1 from clientes c where c.id = p_cliente and (c.vendedor_id is null or c.vendedor_id = auth.uid())))
$$;

create or replace function public.mis_clientes_visibles() returns setof uuid
language sql stable security definer set search_path = public as $$
  select c.id from clientes c
  where puede('ventas', 3) or (puede('ventas', 1) and (c.vendedor_id is null or c.vendedor_id = auth.uid()))
$$;

drop policy if exists ver on public.historial_ventas_hoja;
create policy ver on public.historial_ventas_hoja for select to authenticated using (
  (select puede('finanzas', 1)) or (select puede('ventas', 3))
  or cliente_id in (select mis_clientes_visibles()));
drop policy if exists ver on public.contactos;
create policy ver on public.contactos for select to authenticated using (
  (select puede('finanzas', 1)) or (select puede('ventas', 3))
  or cliente_id in (select mis_clientes_visibles()));
drop policy if exists ver on public.actividades;
create policy ver on public.actividades for select to authenticated using (
  usuario_id = (select auth.uid()) or (select puede('ventas', 3))
  or cliente_id in (select mis_clientes_visibles()));

-- Nivel 1 = usar el asistente; 3 = ver el uso y gasto de todos.
insert into public.permisos_rol (rol, modulo, nivel) values
  ('direccion', 'asistente', 3), ('admin', 'asistente', 3), ('gerente_ventas', 'asistente', 1),
  ('ventas', 'asistente', 1), ('ingenieria', 'asistente', 1), ('compras', 'asistente', 1),
  ('almacen', 'asistente', 1), ('gerente_produccion', 'asistente', 1), ('rrhh', 'asistente', 1),
  ('finanzas', 'asistente', 1)
on conflict do nothing;

insert into public.configuracion (clave, valor, descripcion) values
  ('asistente', '{"limite_diario": 40, "modelo": "claude-opus-5-5", "esfuerzo": "medium"}',
   'Asistente con Claude. limite_diario = consultas por persona al día (el 28 de septiembre de 2026 un tope de gasto lleno dejó sin servicio a otro sistema de Hegamex por horas: mejor un límite propio y visible). La llave va en el secreto ANTHROPIC_API_KEY de la función, nunca aquí.')
on conflict (clave) do nothing;

-- Cada consulta queda registrada: quién, cuánto costó en tokens y si falló.
create table if not exists public.asistente_uso (
  id bigserial primary key,
  usuario_id uuid not null default auth.uid() references public.perfiles(id) on delete cascade,
  modo text not null,
  area text,
  modelo text,
  entrada_tokens int,
  salida_tokens int,
  cache_tokens int,
  herramientas text[],
  error text,
  en timestamptz not null default now()
);
create index if not exists asistente_uso_usuario on public.asistente_uso (usuario_id, en desc);

-- El último resumen por persona y área, para no pagar uno nuevo cada vez que se
-- abre la página. Es por persona porque cada quien ve datos distintos: un resumen
-- hecho con los permisos de dirección le contaría márgenes a ventas.
create table if not exists public.asistente_resumenes (
  usuario_id uuid not null default auth.uid() references public.perfiles(id) on delete cascade,
  area text not null,
  contenido jsonb not null,
  modelo text,
  generado_en timestamptz not null default now(),
  primary key (usuario_id, area)
);

alter table public.asistente_uso enable row level security;
alter table public.asistente_resumenes enable row level security;
drop policy if exists ver on public.asistente_uso;
create policy ver on public.asistente_uso for select to authenticated
  using (usuario_id = auth.uid() or puede('asistente', 3));
drop policy if exists alta on public.asistente_uso;
create policy alta on public.asistente_uso for insert to authenticated
  with check (usuario_id = auth.uid() and puede('asistente', 1));
drop policy if exists propio on public.asistente_resumenes;
create policy propio on public.asistente_resumenes for all to authenticated
  using (usuario_id = auth.uid()) with check (usuario_id = auth.uid() and puede('asistente', 1));

-- Cuántas consultas le quedan hoy a quien pregunta (la función de borde lo revisa
-- antes de gastar).
create or replace function public.asistente_cupo() returns int
language sql stable security invoker as $$
  select greatest(0,
    coalesce((select (valor->>'limite_diario')::int from configuracion where clave = 'asistente'), 40)
    - (select count(*) from asistente_uso where usuario_id = auth.uid()
         and en >= date_trunc('day', now() at time zone 'America/Mexico_City') at time zone 'America/Mexico_City'))::int
$$;

-- $34.8 M, $812 mil, $4,500: para frases que lee una persona, no para tablas.
create or replace function public.texto_dinero(n numeric) returns text
language sql immutable as $$
  select case when n is null then '—'
    when abs(n) >= 1e6 then '$' || to_char(round(n / 1e6, 1), 'FM999,990.0') || ' M'
    when abs(n) >= 1e4 then '$' || to_char(round(n / 1e3), 'FM999,990') || ' mil'
    else '$' || to_char(round(n), 'FM999,990') end
$$;

-- -----------------------------------------------------------------------------
-- A quién llamar hoy. Una fila por cliente con el motivo más fuerte:
--   cotizacion  → tiene una cotización enviada que vence en 7 días o venció hace poco
--   le_toca     → compra cada ~N días y ya pasaron N (pero no tantos como para darlo por perdido)
--   refacciones → compró un equipo hace 6+ meses y no ha vuelto: ya pide rodillos, banda, cangilones
--   reactivar   → compró 2+ veces y lleva 6 meses a 3 años sin comprar
-- Es security invoker: un vendedor solo ve sus clientes y los libres (cliente_visible).
-- -----------------------------------------------------------------------------
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

-- -----------------------------------------------------------------------------
-- Hallazgos por área. Reglas simples y explicables, ordenadas por gravedad.
-- tono: riesgo (hay que actuar), atencion (revisar), bueno (va bien), info.
-- Se arman sobre tablero_direccion(), que ya respeta los permisos de quien llama:
-- a quien no ve costos no le sale ningún hallazgo de costos.
-- -----------------------------------------------------------------------------
create or replace function public.hallazgos(p_area text default 'direccion')
returns table (area text, tono text, titulo text, detalle text, ruta text)
language plpgsql stable security invoker as $$
declare
  t jsonb := tablero_direccion();
  v_hoy date := (now() at time zone 'America/Mexico_City')::date;
  h jsonb := '[]'::jsonb;
  x jsonb; n numeric; m numeric; k int; v_txt text;
begin
  -- Ventas del año contra el año pasado a la misma fecha.
  if t ? 'ventas' then
    n := (t #>> '{ventas,anio}')::numeric; m := (t #>> '{ventas,anio_anterior_misma_fecha}')::numeric;
    if m > 0 then
      h := h || jsonb_build_object('area', 'ventas',
        'tono', case when n / m - 1 >= 0.05 then 'bueno' when n / m - 1 <= -0.05 then 'riesgo' else 'info' end,
        'titulo', format('Ventas del año: %s, %s %% %s del año pasado', texto_dinero(n),
                         abs(round((n / m - 1) * 100)), case when n >= m then 'arriba' else 'abajo' end),
        'detalle', format('A la misma fecha de %s iban %s. A este ritmo el año cierra en %s; %s cerró en %s.',
                          extract(year from v_hoy) - 1, texto_dinero(m), texto_dinero((t #>> '{ventas,proyeccion_anio}')::numeric),
                          extract(year from v_hoy) - 1, texto_dinero((t #>> '{ventas,anio_anterior_total}')::numeric)),
        'ruta', '/', 'peso', 50);
    end if;
    -- Dependencia de pocos clientes.
    x := t #> '{ventas,top_clientes,0}';
    if x is not null and n > 0 and (x->>'monto')::numeric / n >= 0.12 then
      h := h || jsonb_build_object('area', 'ventas', 'tono', 'info',
        'titulo', format('%s es el %s %% de lo vendido en el año', x->>'nombre', round((x->>'monto')::numeric / n * 100)),
        'detalle', 'Mucho peso en un solo cliente: si se va, se nota. Vale la pena cuidarlo y abrir otros parecidos.',
        'ruta', '/ventas/clientes', 'peso', 80);
    end if;
  end if;

  if t ? 'cotizaciones' then
    k := (t #>> '{cotizaciones,por_autorizar}')::int;
    if k > 0 then
      h := h || jsonb_build_object('area', 'ventas', 'tono', 'atencion',
        'titulo', case when k = 1 then 'Una cotización espera autorización' else k || ' cotizaciones esperan autorización' end,
        'detalle', 'Un cliente esperando precio es un cliente que sigue cotizando con otros.',
        'ruta', '/ventas/cotizaciones', 'peso', 20);
    end if;
  end if;

  -- Lo que cada vendedor ve de lo suyo (la RLS ya filtra). Solo para ventas:
  -- producción ve clientes, pero no tiene por qué ver a quién hay que llamar.
  if puede('ventas', 1) and p_area in ('direccion', 'ventas') then
    select count(*), sum(c.total * c.tipo_cambio) into k, n from cotizaciones c
    where c.estado in ('enviada', 'autorizada') and c.fecha + c.vigencia_dias between v_hoy and v_hoy + 7;
    if k > 0 then
      h := h || jsonb_build_object('area', 'ventas', 'tono', 'atencion',
        'titulo', format('%s por %s %s esta semana', case when k = 1 then 'Una cotización' else k || ' cotizaciones' end,
                         texto_dinero(n), case when k = 1 then 'vence' else 'vencen' end),
        'detalle', 'Una llamada antes de que venzan cierra más que una cotización nueva.',
        'ruta', '/ventas/cotizaciones', 'peso', 15);
    end if;

    select count(*) over (), sum(o.valor_estimado) over (), format('La de más valor: %s. %s', o.cliente, o.detalle)
    into k, n, v_txt from oportunidades_sugeridas(1000) o order by o.puntaje desc limit 1;
    if k > 0 then
      h := h || jsonb_build_object('area', 'ventas', 'tono', 'info',
        'titulo', format('%s clientes con motivo para buscarlos (%s en juego)', k, texto_dinero(n)),
        'detalle', v_txt,
        'ruta', '/ventas/oportunidades', 'peso', 30);
    end if;
  end if;

  if t ? 'produccion' then
    k := (t #>> '{produccion,atrasadas}')::int;
    if k > 0 then
      h := h || jsonb_build_object('area', 'produccion', 'tono', 'riesgo',
        'titulo', format('%s %s atrasadas en el taller', k, case when k = 1 then 'orden' else 'órdenes' end),
        'detalle', format('De %s abiertas. Entregadas a tiempo en los últimos 90 días: %s.',
                          t #>> '{produccion,abiertas}', coalesce(round((t #>> '{produccion,a_tiempo_90d}')::numeric * 100) || ' %', 'sin datos')),
        'ruta', '/produccion/gerencia', 'peso', 10);
    end if;
    k := (t #>> '{produccion,con_faltantes}')::int;
    if k > 0 then
      h := h || jsonb_build_object('area', 'produccion', 'tono', 'atencion',
        'titulo', format('%s %s sin todo el material', k, case when k = 1 then 'orden' else 'órdenes' end),
        'detalle', 'Hay que comprarlo o surtirlo antes de que paren al soldador.',
        'ruta', '/produccion/ordenes', 'peso', 25);
    end if;
    x := null;
    select e.value into x from jsonb_array_elements(t #> '{produccion,carga}') e
    order by (e.value->>'semanas')::numeric desc nulls last limit 1;
    if (x->>'semanas')::numeric >= 3 then
      h := h || jsonb_build_object('area', 'produccion', 'tono', 'atencion',
        'titulo', format('%s tiene %s semanas de trabajo encima', x->>'etapa', x->>'semanas'),
        'detalle', 'Es el cuello de botella: ahí se decide la fecha de entrega que se le promete al cliente.',
        'ruta', '/produccion/gerencia', 'peso', 35);
    end if;
  end if;

  -- Almacén no ve costos, así que el tablero no le trae la sección de inventario:
  -- lo que no lleva dinero se calcula aquí con el mismo reabasto().
  if not t ? 'inventario' and puede('inventario', 1) then
    t := t || jsonb_build_object('inventario', (
      with re as (select * from reabasto())
      select jsonb_build_object(
        'a_ordenar_n', (select count(*) from re where estado = 'ordenar'),
        'importados_en_riesgo', (select coalesce(jsonb_agg(jsonb_build_object('nombre', nombre, 'disponible', disponible, 'reorden', punto_reorden)
                                   order by disponible - punto_reorden), '[]')
                                 from re where es_importado and estado = 'ordenar'),
        'ajustes_pendientes', (select count(*) from ajustes_inventario where estado = 'pendiente'))));
  end if;

  if t ? 'inventario' then
    k := coalesce((t #>> '{inventario,importados_en_riesgo_n}')::int, jsonb_array_length(t #> '{inventario,importados_en_riesgo}'));
    if k > 0 then
      x := t #> '{inventario,importados_en_riesgo,0}';
      h := h || jsonb_build_object('area', 'almacen', 'tono', 'riesgo',
        'titulo', format('%s %s abajo del punto de reorden', k, case when k = 1 then 'importado' else 'importados' end),
        'detalle', format('El más justo: %s (quedan %s, se pide en %s). Un importado tarda meses: si se acaba no hay cómo reponerlo rápido.',
                          x->>'nombre', round((x->>'disponible')::numeric), round((x->>'reorden')::numeric)),
        'ruta', '/almacen/reabasto', 'peso', 12);
    end if;
    k := (t #>> '{inventario,a_ordenar_n}')::int;
    if k > 0 then
      h := h || jsonb_build_object('area', 'compras', 'tono', 'atencion',
        'titulo', format('%s artículos por pedir', k),
        'detalle', case when t #> '{inventario,inversion_sugerida}' is not null
                        then format('Inversión sugerida: %s, según el consumo de los últimos 6 meses.', texto_dinero((t #>> '{inventario,inversion_sugerida}')::numeric))
                        else 'Están abajo de su punto de reorden según el consumo de los últimos 6 meses.' end,
        'ruta', '/almacen/reabasto', 'peso', 40);
    end if;
    n := (t #>> '{inventario,excedentes_valor}')::numeric;
    if n >= 100000 then
      h := h || jsonb_build_object('area', 'almacen', 'tono', 'atencion',
        'titulo', format('%s parados en excedentes', texto_dinero(n)),
        'detalle', format('%s artículos con más de lo que se consume en su cobertura. Es dinero que no trabaja: no volver a pedirlos y ofrecerlos.',
                          t #>> '{inventario,excedentes_n}'),
        'ruta', '/almacen/reabasto', 'peso', 60);
    end if;
    k := (t #>> '{inventario,ajustes_pendientes}')::int;
    if k > 0 then
      h := h || jsonb_build_object('area', 'almacen', 'tono', 'atencion',
        'titulo', format('%s %s de inventario por autorizar', k, case when k = 1 then 'ajuste' else 'ajustes' end),
        'detalle', 'Mientras no se autoricen, las existencias del sistema no cuadran con el almacén.',
        'ruta', '/almacen/movimientos', 'peso', 22);
    end if;
  end if;

  if t ? 'costos_al_alza' and jsonb_array_length(t -> 'costos_al_alza') > 0 then
    x := t #> '{costos_al_alza,0}';
    h := h || jsonb_build_object('area', 'compras', 'tono', 'atencion',
      'titulo', format('%s subió %s %% este mes', x->>'nombre', round((x->>'cambio')::numeric * 100)),
      'detalle', format('De %s a %s. %s Revisar si conviene otro proveedor.',
                        texto_dinero((x->>'costo_anterior')::numeric), texto_dinero((x->>'costo_nuevo')::numeric),
                        case when (x->>'equipos')::int = 0 then 'No entra en ningún equipo: pega en su precio de venta suelto.'
                             else format('Entra en %s equipos, cuyos precios ya se recalcularon.', x->>'equipos') end),
      'ruta', '/costeo/componentes', 'peso', 45);
  end if;

  if t ? 'cobranza' then
    n := (t #>> '{cobranza,antiguedad,d90}')::numeric;
    if n > 0 then
      h := h || jsonb_build_object('area', 'finanzas', 'tono', 'riesgo',
        'titulo', format('%s con más de 90 días sin cobrar', texto_dinero(n)),
        'detalle', 'Entre más tiempo pasa, menos probable es cobrarlo. Antes de venderle más a esos clientes, que liquiden.',
        'ruta', '/finanzas/cobranza', 'peso', 11);
    end if;
    n := (t #>> '{cobranza,arranque}')::numeric;
    if n > 0 then
      h := h || jsonb_build_object('area', 'finanzas', 'tono', 'info',
        'titulo', format('%s por cobrar que viene de la hoja', texto_dinero(n)),
        'detalle', 'Saldos de clientes de antes del arranque del sistema. Conviene conciliarlos uno por uno.',
        'ruta', '/finanzas/cobranza', 'peso', 70);
    end if;
  end if;
  if t ? 'por_pagar' then
    n := (t #>> '{por_pagar,vencido}')::numeric;
    if n > 0 then
      h := h || jsonb_build_object('area', 'finanzas', 'tono', 'atencion',
        'titulo', format('%s vencidos con proveedores', texto_dinero(n)),
        'detalle', 'Pagar tarde cuesta precio y prioridad con el proveedor.',
        'ruta', '/finanzas/pagos', 'peso', 30);
    end if;
  end if;

  return query
    select e->>'area', e->>'tono', e->>'titulo', e->>'detalle', e->>'ruta'
    from jsonb_array_elements(h) e
    where p_area = 'direccion' or e->>'area' = p_area
          or (p_area = 'almacen' and e->>'area' = 'compras' and puede('inventario', 2))
    order by case e->>'tono' when 'riesgo' then 1 when 'atencion' then 2 when 'bueno' then 3 else 4 end, (e->>'peso')::int;
end $$;

select public.optimizar_politicas();

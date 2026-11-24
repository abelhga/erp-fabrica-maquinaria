-- =============================================================================
-- Historial del pedido, y corregir un cobro dejando constancia.
--
-- Por qué: Adriana capturó en el PED-26-855 un depósito de $148,132 que en realidad fue de
-- $92,000, y el pedido se vio pagado completo. Nadie podía ver quién lo marcó ni cuándo: la
-- bitácora lo sabía, pero solo la ve sistemas. Y para corregirlo la única salida era borrar el
-- cobro (con un botón escondido en la pantalla de ventas) y volverlo a capturar, sin rastro de por
-- qué. Las órdenes de producción ya tienen su línea de tiempo; el pedido no tenía nada.
--
-- Qué hay:
--   · pedido_historial(pedido): todo lo que le pasó al pedido, más nuevo primero, con quién y
--     cuándo: alta, cambios de estado, fecha compromiso y total, partidas, cobros (registrados,
--     corregidos, quitados), facturas, órdenes de producción, entregas, salidas de almacén,
--     envíos y devoluciones. Lo ve quien ve el pedido; las órdenes y las salidas de almacén, solo
--     quien ya las ve en su pantalla. Sin costos.
--   · corregir_cobro / quitar_cobro (finanzas 2): cambian o quitan un cobro con un motivo
--     obligatorio, que queda en cobro_correcciones y en el historial.
--   · Los cobros ya no se editan ni se borran directo: solo por esas dos funciones (o por las de
--     Mercado Libre, que corren con sus propias reglas). Registrar sigue igual.
--   · La bitácora de las partidas del pedido, para saber desde hoy quién cambió qué partida.
-- =============================================================================

create table if not exists public.cobro_correcciones (
  id bigint generated always as identity primary key,
  cobro_id uuid not null,
  pedido_id uuid not null references public.pedidos(id) on delete cascade,
  accion text not null check (accion in ('corregido', 'quitado')),
  antes jsonb not null,
  despues jsonb,
  motivo text not null check (length(btrim(motivo)) >= 5),
  por uuid default auth.uid(),
  en timestamptz not null default now()
);
create index if not exists cobro_correcciones_pedido on public.cobro_correcciones (pedido_id, en);
alter table public.cobro_correcciones enable row level security;
drop policy if exists ver on public.cobro_correcciones;
create policy ver on public.cobro_correcciones for select to authenticated
  using ((select ve_todos_los_pedidos()) or pedido_id in (select mis_pedidos_visibles()));
grant select on public.cobro_correcciones to authenticated;

-- Registrar, sí; cambiar o borrar, solo con motivo (las funciones de abajo).
drop policy if exists editar on public.cobros;
drop policy if exists registrar on public.cobros;
create policy registrar on public.cobros for insert to authenticated with check ((select puede('finanzas', 2)));

create or replace function public.corregir_cobro(p_cobro uuid, p_monto numeric, p_fecha date, p_metodo text,
  p_referencia text, p_motivo text) returns void
language plpgsql security definer set search_path = public as $$
declare v_c cobros; v_n cobros;
begin
  if not puede('finanzas', 2) then
    raise exception 'Los cobros los corrige finanzas' using errcode = '42501';
  end if;
  if length(btrim(coalesce(p_motivo, ''))) < 5 then
    raise exception 'Escribe por qué se corrige (queda en el historial del pedido)' using errcode = '22023';
  end if;
  select * into v_c from cobros where id = p_cobro for update;
  if not found then raise exception 'Ese cobro ya no existe' using errcode = 'P0002'; end if;
  if v_c.cfdi_uuid is not null then
    raise exception 'Este cobro salió de un complemento de pago: el monto y la fecha son los del CFDI. Si está mal, quítalo y vuelve a subir el complemento correcto'
      using errcode = '22023';
  end if;
  if coalesce(p_monto, 0) <= 0 then raise exception 'El monto tiene que ser mayor a cero' using errcode = '22023'; end if;
  if p_fecha is null or p_fecha > hoy_planta() then raise exception 'La fecha del cobro no puede ser futura' using errcode = '22023'; end if;
  if v_c.monto = p_monto and v_c.fecha = p_fecha and v_c.metodo = p_metodo
     and coalesce(v_c.referencia, '') = coalesce(nullif(btrim(p_referencia), ''), '') then
    raise exception 'No cambiaste nada del cobro' using errcode = '22023';
  end if;
  update cobros set monto = p_monto, fecha = p_fecha, metodo = p_metodo, referencia = nullif(btrim(p_referencia), '')
  where id = p_cobro returning * into v_n;
  insert into cobro_correcciones (cobro_id, pedido_id, accion, antes, despues, motivo)
  values (p_cobro, v_c.pedido_id, 'corregido', to_jsonb(v_c), to_jsonb(v_n), btrim(p_motivo));
end $$;
revoke execute on function public.corregir_cobro(uuid, numeric, date, text, text, text) from public, anon;
grant execute on function public.corregir_cobro(uuid, numeric, date, text, text, text) to authenticated;

create or replace function public.quitar_cobro(p_cobro uuid, p_motivo text) returns void
language plpgsql security definer set search_path = public as $$
declare v_c cobros;
begin
  if not puede('finanzas', 2) then
    raise exception 'Los cobros los quita finanzas' using errcode = '42501';
  end if;
  if length(btrim(coalesce(p_motivo, ''))) < 5 then
    raise exception 'Escribe por qué se quita (queda en el historial del pedido)' using errcode = '22023';
  end if;
  select * into v_c from cobros where id = p_cobro for update;
  if not found then raise exception 'Ese cobro ya no existe' using errcode = 'P0002'; end if;
  delete from cobros where id = p_cobro;
  insert into cobro_correcciones (cobro_id, pedido_id, accion, antes, motivo)
  values (p_cobro, v_c.pedido_id, 'quitado', to_jsonb(v_c), btrim(p_motivo));
end $$;
revoke execute on function public.quitar_cobro(uuid, text) from public, anon;
grant execute on function public.quitar_cobro(uuid, text) to authenticated;

-- Las partidas no tenían bitácora: desde hoy se sabe quién agregó, cambió o quitó cada una.
drop trigger if exists auditar on public.pedido_lineas;
create trigger auditar after insert or update or delete on public.pedido_lineas
  for each row execute function public.auditar();

-- El historial busca lo borrado de un pedido por el pedido_id que la bitácora guardó adentro.
create index if not exists bitacora_por_pedido on public.bitacora ((coalesce(cambios -> 'pedido_id' ->> 1, cambios -> 'pedido_id' ->> 0)))
  where tabla in ('cobros', 'facturas', 'pedido_lineas') and accion in ('alta', 'baja');

-- Dinero con su moneda, como lo lee la gente.
create or replace function public.importe_texto(p numeric, p_moneda text) returns text
language sql immutable parallel safe as $$
  select to_char(coalesce(p, 0), 'FM$999,999,999,990.00') || case when coalesce(p_moneda, 'MXN') <> 'MXN' then ' ' || p_moneda else '' end
$$;
grant execute on function public.importe_texto(numeric, text) to authenticated;

create or replace function public.estado_pedido_texto(p text) returns text
language sql immutable parallel safe as $$
  select case p when 'confirmado' then 'Confirmado' when 'en_produccion' then 'En producción' when 'listo' then 'Listo'
    when 'entregado' then 'Entregado' when 'cancelado' then 'Cancelado' else coalesce(p, '—') end
$$;
grant execute on function public.estado_pedido_texto(text) to authenticated;

create or replace function public.pedido_historial(p_pedido uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_p pedidos; v_ops boolean; v_mov boolean; v_cot text; r jsonb;
begin
  -- La misma regla que la tabla de pedidos: el vendedor lo suyo, las áreas que ven todos.
  select * into v_p from pedidos p where p.id = p_pedido
    and (p.vendedor_id = auth.uid() or ve_todos_los_pedidos() or p.id in (select mis_pedidos_visibles()));
  if not found then raise exception 'No encontramos ese pedido' using errcode = '42501'; end if;
  -- Órdenes y salidas de almacén: solo a quien ya las ve en su pantalla.
  v_ops := puede('produccion', 1) or puede('inventario', 1);
  v_mov := puede('inventario', 2) or puede('costos', 1);
  if puede('ventas', 1) then select folio into v_cot from cotizaciones where id = v_p.cotizacion_id; end if;

  with
  -- Lo de este pedido en la bitácora. Tres búsquedas por índice en vez de un OR que la recorre toda:
  -- el pedido, los renglones que existen hoy, y los ya borrados (que traen su pedido_id adentro).
  bit as materialized (
    select b.* from bitacora b where b.id in (
      select x.id from bitacora x where x.tabla = 'pedidos' and x.registro_id = p_pedido::text
      union
      select x.id from bitacora x where x.tabla = 'cobros' and x.registro_id in (select id::text from cobros where pedido_id = p_pedido)
      union
      select x.id from bitacora x where x.tabla = 'facturas' and x.registro_id in (select id::text from facturas where pedido_id = p_pedido)
      union
      select x.id from bitacora x where x.tabla = 'pedido_lineas' and x.registro_id in (select id::text from pedido_lineas where pedido_id = p_pedido)
      union
      select x.id from bitacora x where x.tabla in ('cobros', 'facturas', 'pedido_lineas') and x.accion in ('alta', 'baja')
        and coalesce(x.cambios -> 'pedido_id' ->> 1, x.cambios -> 'pedido_id' ->> 0) = p_pedido::text)
  ),
  correc as (select * from cobro_correcciones where pedido_id = p_pedido),
  -- Cada cobro que existió: los de hoy y los quitados, con los valores con que se registró.
  cobros_todos as (
    select c.id, c.creado_en, c.registrado_por, coalesce(
      (select x.antes from correc x where x.cobro_id = c.id order by x.en limit 1), to_jsonb(c)) as original
    from cobros c where c.pedido_id = p_pedido
    union all
    select x.cobro_id, (x.antes ->> 'creado_en')::timestamptz, (x.antes ->> 'registrado_por')::uuid,
      coalesce((select y.antes from correc y where y.cobro_id = x.cobro_id order by y.en limit 1), x.antes)
    from correc x where x.accion = 'quitado'
    union all
    -- Quitados antes de que existiera el motivo: la bitácora guardó el renglón al borrarlo.
    -- (sin creado_en: la bitácora no lo guarda; la hora es la del alta).
    select (b.registro_id)::uuid, (select a.en from bit a where a.tabla = 'cobros' and a.registro_id = b.registro_id and a.accion = 'alta' limit 1),
      (b.cambios -> 'registrado_por' ->> 0)::uuid,
      (select jsonb_object_agg(k, v -> 0) from jsonb_each(b.cambios) e(k, v))
    from bit b where b.tabla = 'cobros' and b.accion = 'baja'
      and not exists (select 1 from correc x where x.cobro_id::text = b.registro_id)
  ),
  ev as (
    -- Alta del pedido
    select v_p.creado_en as en, 'creado' as tipo,
      'Creó el pedido' || coalesce(' desde ' || v_cot, case when v_p.cotizacion_id is not null then ' desde una cotización' end, '')
        || ' por ' || importe_texto(v_p.total, v_p.moneda::text) as texto,
      coalesce(v_p.creado_por, (select b.usuario_id from bit b where b.tabla = 'pedidos' and b.accion = 'alta' limit 1)) as quien,
      null::text as nota
    union all
    -- Cambios del pedido. El recálculo de totales en el mismo momento del alta no es un cambio.
    select b.en, 'estado',
      'Cambió el estado: ' || estado_pedido_texto(b.cambios -> 'estado' ->> 0) || ' → ' || estado_pedido_texto(b.cambios -> 'estado' ->> 1),
      b.usuario_id, b.cambios -> 'motivo_cancelacion' ->> 1
    from bit b where b.tabla = 'pedidos' and b.accion = 'cambio' and b.cambios ? 'estado'
    union all
    select b.en, 'cambio', 'Cambió la fecha compromiso: ' || coalesce(to_char((b.cambios -> 'fecha_compromiso' ->> 0)::date, 'DD/MM/YYYY'), 'sin fecha')
        || ' → ' || coalesce(to_char((b.cambios -> 'fecha_compromiso' ->> 1)::date, 'DD/MM/YYYY'), 'sin fecha'),
      b.usuario_id, null
    from bit b where b.tabla = 'pedidos' and b.accion = 'cambio' and b.cambios ? 'fecha_compromiso'
    union all
    select b.en, 'total', 'El total pasó de ' || importe_texto((b.cambios -> 'total' ->> 0)::numeric, v_p.moneda::text)
        || ' a ' || importe_texto((b.cambios -> 'total' ->> 1)::numeric, v_p.moneda::text)
        || case when b.cambios ? 'tasa_iva' then case when (b.cambios -> 'tasa_iva' ->> 1)::numeric = 0 then ' (se quitó el IVA)' else ' (se regresó el IVA)' end else '' end,
      b.usuario_id, null
    from bit b where b.tabla = 'pedidos' and b.accion = 'cambio' and b.cambios ? 'total'
      and b.en > v_p.creado_en + interval '1 minute' and coalesce((b.cambios -> 'total' ->> 0)::numeric, 0) <> 0
    union all
    select b.en, 'cambio', 'Cambió el cliente: ' || coalesce((select nombre from clientes where id::text = b.cambios -> 'cliente_id' ->> 0), '—')
        || ' → ' || coalesce((select nombre from clientes where id::text = b.cambios -> 'cliente_id' ->> 1), '—'),
      b.usuario_id, null
    from bit b where b.tabla = 'pedidos' and b.accion = 'cambio' and b.cambios ? 'cliente_id'
    union all
    select b.en, 'cambio', 'Cambió el vendedor: ' || coalesce((select nombre from perfiles where id::text = b.cambios -> 'vendedor_id' ->> 0), '—')
        || ' → ' || coalesce((select nombre from perfiles where id::text = b.cambios -> 'vendedor_id' ->> 1), '—'),
      b.usuario_id, null
    from bit b where b.tabla = 'pedidos' and b.accion = 'cambio' and b.cambios ? 'vendedor_id'
    union all
    select b.en, 'cambio', 'Cambió ' || string_agg(case k when 'condiciones_pago' then 'las condiciones de pago' when 'direccion_entrega' then 'la dirección de entrega'
        when 'notas' then 'las notas' when 'folio' then 'el folio (' || coalesce(case when b.cambios -> 'folio' ->> 0 like 'TMP-%'
          then (select a.cambios -> 'folio' ->> 0 from bit a where a.tabla = 'pedidos' and a.cambios -> 'folio' ->> 1 = b.cambios -> 'folio' ->> 0 limit 1)
          else b.cambios -> 'folio' ->> 0 end, '—') || ' → ' || coalesce(b.cambios -> 'folio' ->> 1, '—') || ')' end, ', '),
      b.usuario_id, null
    from bit b, jsonb_object_keys(b.cambios) k
    where b.tabla = 'pedidos' and b.accion = 'cambio' and k in ('condiciones_pago', 'direccion_entrega', 'notas', 'folio')
      -- Los folios de paso (TMP-…) de la renumeración no son un cambio que alguien hizo.
      and not (k = 'folio' and b.cambios -> 'folio' ->> 1 like 'TMP-%')
      and b.en > v_p.creado_en + interval '1 minute'
    group by b.id, b.en, b.usuario_id, b.cambios
    union all
    -- Partidas (desde que tienen bitácora). Las que entraron con el pedido no cuentan como cambio.
    select b.en, 'partida',
      case b.accion when 'alta' then 'Agregó la partida «' || (b.cambios -> 'titulo' ->> 1) || '» (' || trim_scale((b.cambios -> 'cantidad' ->> 1)::numeric) || ')'
        when 'baja' then 'Quitó la partida «' || (b.cambios -> 'titulo' ->> 0) || '»'
        else 'Cambió la partida «' || coalesce((select titulo from pedido_lineas where id::text = b.registro_id), b.cambios -> 'titulo' ->> 1, '—') || '»: '
          || concat_ws(', ',
               case when b.cambios ? 'cantidad' then 'cantidad ' || trim_scale((b.cambios -> 'cantidad' ->> 0)::numeric) || ' → ' || trim_scale((b.cambios -> 'cantidad' ->> 1)::numeric) end,
               case when b.cambios ? 'precio_unitario' then 'precio ' || importe_texto((b.cambios -> 'precio_unitario' ->> 0)::numeric, v_p.moneda::text) || ' → ' || importe_texto((b.cambios -> 'precio_unitario' ->> 1)::numeric, v_p.moneda::text) end,
               case when b.cambios ? 'descuento_pct' then 'descuento ' || (b.cambios -> 'descuento_pct' ->> 0) || ' % → ' || (b.cambios -> 'descuento_pct' ->> 1) || ' %' end,
               case when b.cambios ? 'titulo' then 'nombre' end, case when b.cambios ? 'descripcion' then 'descripción' end) end,
      b.usuario_id, null
    from bit b where b.tabla = 'pedido_lineas' and b.en > v_p.creado_en + interval '1 minute'
      and (b.accion <> 'cambio' or b.cambios ?| array['cantidad', 'precio_unitario', 'descuento_pct', 'titulo', 'descripcion'])
    union all
    -- Cobros: cómo se registró cada uno, y luego sus correcciones.
    select c.creado_en, 'cobro', 'Registró un cobro de ' || importe_texto((c.original ->> 'monto')::numeric, v_p.moneda::text)
        || ' (' || coalesce(c.original ->> 'metodo', '—') || coalesce(', ' || nullif(c.original ->> 'referencia', ''), '')
        || ', del ' || to_char((c.original ->> 'fecha')::date, 'DD/MM/YYYY') || ')',
      c.registrado_por, nullif(c.original ->> 'notas', '')
    from cobros_todos c where c.creado_en is not null
    union all
    select x.en, 'cobro_corregido', 'Corrigió el cobro: ' || concat_ws(', ',
        case when (x.antes ->> 'monto')::numeric <> (x.despues ->> 'monto')::numeric then importe_texto((x.antes ->> 'monto')::numeric, v_p.moneda::text) || ' → ' || importe_texto((x.despues ->> 'monto')::numeric, v_p.moneda::text) end,
        case when x.antes ->> 'fecha' <> x.despues ->> 'fecha' then 'fecha ' || to_char((x.antes ->> 'fecha')::date, 'DD/MM/YYYY') || ' → ' || to_char((x.despues ->> 'fecha')::date, 'DD/MM/YYYY') end,
        case when x.antes ->> 'metodo' <> x.despues ->> 'metodo' then (x.antes ->> 'metodo') || ' → ' || (x.despues ->> 'metodo') end,
        case when coalesce(x.antes ->> 'referencia', '') <> coalesce(x.despues ->> 'referencia', '') then 'referencia «' || coalesce(x.despues ->> 'referencia', '') || '»' end),
      x.por, x.motivo
    from correc x where x.accion = 'corregido'
    union all
    select x.en, 'cobro_quitado', 'Quitó el cobro de ' || importe_texto((x.antes ->> 'monto')::numeric, v_p.moneda::text), x.por, x.motivo
    from correc x where x.accion = 'quitado'
    union all
    select b.en, 'cobro_quitado', 'Borró el cobro de ' || importe_texto((b.cambios -> 'monto' ->> 0)::numeric, v_p.moneda::text), b.usuario_id, null
    from bit b where b.tabla = 'cobros' and b.accion = 'baja' and not exists (select 1 from correc x where x.cobro_id::text = b.registro_id)
    union all
    -- Facturas
    select f.creado_en, 'factura', 'Registró la factura ' || f.folio || ' por ' || importe_texto(f.total, v_p.moneda::text),
      (select b.usuario_id from bit b where b.tabla = 'facturas' and b.registro_id = f.id::text and b.accion = 'alta' limit 1), null
    from facturas f where f.pedido_id = p_pedido
    union all
    -- Órdenes de producción
    select o.creado_en, 'op', 'Creó la ' || o.folio || coalesce(' · ' || a.nombre, ''), o.creado_por, null
    from ordenes_produccion o left join articulos a on a.id = o.articulo_id where v_ops and o.pedido_id = p_pedido
    union all
    select o.terminada_en, 'op', 'Se terminó la ' || o.folio, null, null
    from ordenes_produccion o where v_ops and o.pedido_id = p_pedido and o.terminada_en is not null
    union all
    select o.cancelada_en, 'op', 'Canceló la ' || o.folio,
      (select b.usuario_id from bitacora b where b.tabla = 'ordenes_produccion' and b.registro_id = o.id::text and b.cambios -> 'estado' ->> 1 = 'cancelada' order by b.en desc limit 1),
      o.motivo_cancelacion
    from ordenes_produccion o where v_ops and o.pedido_id = p_pedido and o.cancelada_en is not null
    union all
    -- Entregas (hoja de salida firmada)
    select s.entregado_en, 'entrega', 'Entrega n.º ' || s.numero || coalesce(': recibió ' || nullif(s.recibio, ''), ''), s.entregado_por, nullif(s.nota, '')
    from pedido_salidas s where s.pedido_id = p_pedido and s.entregado_en is not null
    union all
    select s.anulada_en, 'entrega', 'Anuló la entrega n.º ' || s.numero, s.anulada_por, s.motivo_anulacion
    from pedido_salidas s where s.pedido_id = p_pedido and s.anulada_en is not null
    union all
    -- Salidas de almacén por el pedido, juntas por persona y minuto.
    select min(m.en), 'almacen', 'Salió del almacén: ' || string_agg(a.clave || ' × ' || trim(to_char(-m.cantidad, 'FM999999990.###')), ', ' order by a.clave),
      m.usuario_id, null
    from movimientos_inventario m join articulos a on a.id = m.articulo_id
    where v_mov and m.pedido_id = p_pedido and m.tipo = 'salida_venta' and m.deshace_id is null
    group by m.usuario_id, date_trunc('minute', m.en)
    union all
    -- Envíos
    select e.solicitado_en, 'envio', 'Pidió el envío ' || e.folio || coalesce(' a ' || nullif(e.destino, ''), ''), e.solicitado_por, null
    from envios e where e.pedido_id = p_pedido and e.solicitado_en is not null and e.id in (select mis_envios_visibles())
    union all
    select e.enviado_en, 'envio', 'Salió el envío ' || e.folio || coalesce(' · guía ' || nullif(e.numero_guia, ''), ''), e.enviado_por, null
    from envios e where e.pedido_id = p_pedido and e.enviado_en is not null and e.id in (select mis_envios_visibles())
    union all
    select e.entregado_en, 'envio', 'Se entregó el envío ' || e.folio || coalesce(': recibió ' || nullif(e.recibio, ''), ''), e.entregado_por, null
    from envios e where e.pedido_id = p_pedido and e.entregado_en is not null and e.id in (select mis_envios_visibles())
    union all
    select e.cancelado_en, 'envio', 'Canceló el envío ' || e.folio, e.cancelado_por, e.motivo_cancelacion
    from envios e where e.pedido_id = p_pedido and e.cancelado_en is not null and e.id in (select mis_envios_visibles())
    union all
    -- Devoluciones
    select d.creado_en, 'devolucion', 'Abrió la devolución ' || d.folio, d.creado_por, d.motivo
    from devoluciones d where d.pedido_id = p_pedido and d.id in (select mis_devoluciones_visibles())
  )
  select coalesce(jsonb_agg(jsonb_build_object('en', ev.en, 'tipo', ev.tipo, 'texto', ev.texto, 'quien', pf.nombre, 'nota', ev.nota)
           order by ev.en desc, ev.tipo), '[]'::jsonb)
  into r
  from ev left join perfiles pf on pf.id = ev.quien
  where ev.en is not null and ev.texto is not null;
  return r;
end $$;
revoke execute on function public.pedido_historial(uuid) from public, anon;
grant execute on function public.pedido_historial(uuid) to authenticated;

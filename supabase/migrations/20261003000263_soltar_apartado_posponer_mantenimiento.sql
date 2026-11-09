-- =============================================================================
-- Dos cosas que pidió la planta.
--
-- 1. «Soltar lo apartado» de una orden de producción.
--    Por qué: lo apartado solo se soltaba cancelando la orden (o bajando su lista, 238). Mimí apartó
--    por error el material de OP-2026-00039 y no había cómo deshacerlo: hubo que cancelar la orden.
--    Ahora se suelta todo lo apartado de la orden, o solo las partidas que se elijan, con el motivo.
--    Lo ya surtido no se toca (ya salió del almacén). Si no queda nada apartado, el paso «Material
--    apartado» de la validación vuelve a «Pendiente» y se puede volver a apartar.
--    Quién: almacén (inventario 3) o la gerencia de producción (producción 3). Apartar lo pueden más
--    puestos (producción 2 o inventario 2: el piso, la terminal, compras) porque solo toma lo que
--    nadie tenía; soltar le quita el material a una orden y otra lo puede tomar, así que es de quien
--    administra el almacén o la orden. Solo gerencia dejaría a Mimí otra vez sin poder corregir su error.
--
-- 2. «Posponer» un mantenimiento preventivo.
--    Por qué (Juan Esteban, mantenimiento): seguido no se puede hacer el preventivo el día que toca
--    (imprevistos, salir a un servicio, no se puede parar producción); deja los viernes libres para
--    lo atrasado. Cancelarlo y que salga otro perdía el rastro, y dejarlo vencido lo contaba como
--    atrasado aunque ya tuviera fecha. Ahora se pasa a otra fecha con el motivo, queda cuántas veces
--    y por qué se pospuso, y no sale «Vencido» hasta su fecha nueva.
--    Qué NO se mueve: la frecuencia del plan. En los planes por mes («el primer lunes») la siguiente
--    sigue contando desde la fecha que le tocaba a la pospuesta, aunque se haya pasado al mes que
--    sigue (antes eso brincaba un mes). En los planes «cada N días» se cuenta desde que se hizo, como
--    siempre: así está pensado el plan (el engrase cada 30 días se cuenta desde el último engrase).
--    El indicador del bono «Mantenimientos preventivos a tiempo» sigue midiendo contra la fecha del
--    plan: posponer es para organizar el trabajo, no para que lo hecho tarde cuente a tiempo (quien
--    pospone es a quien se mide). La evidencia dice cuántas veces se pospuso y por qué.
-- =============================================================================

-- ---------------------------------------------------------------- 1. soltar lo apartado
alter table public.reservas
  add column if not exists soltada_en timestamptz,
  add column if not exists soltada_por uuid references public.perfiles(id),
  add column if not exists motivo_soltada text;
comment on column public.reservas.soltada_en is 'Se soltó a mano con «Soltar lo apartado» (soltar_apartado): quién, cuándo y por qué.';

alter table public.ordenes_produccion
  add column if not exists material_soltado_en timestamptz,
  add column if not exists material_soltado_por uuid references public.perfiles(id),
  add column if not exists material_soltado_motivo text;
comment on column public.ordenes_produccion.material_soltado_en is 'La última vez que se soltó lo apartado de la orden; lo apartado antes ya no cuenta para el paso «Material apartado».';

create or replace function public.soltar_apartado(p_op uuid, p_articulos uuid[] default null, p_motivo text default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare o ordenes_produccion; r reservas; v_motivo text := nullif(trim(p_motivo), ''); v_suelta numeric;
        v_partidas jsonb := '[]'; v_quedan int; v_texto text;
begin
  if not (puede('inventario', 3) or puede('produccion', 3)) then
    raise exception 'Soltar lo apartado es de almacén o de la gerencia de producción' using errcode = '42501';
  end if;
  if v_motivo is null or length(v_motivo) < 5 then
    raise exception 'Escribe por qué se suelta lo apartado' using errcode = '22023';
  end if;
  if p_articulos is not null and cardinality(p_articulos) = 0 then
    raise exception 'Elige qué partidas soltar' using errcode = '22023';
  end if;
  select * into o from ordenes_produccion where id = p_op for update;
  if o.id is null then raise exception 'No existe la orden'; end if;
  if o.estado in ('terminada', 'entregada', 'cancelada') then raise exception 'La orden % ya está cerrada', o.folio; end if;

  -- Cada reserva activa: lo que falta por surtir se suelta; lo surtido se queda como surtido.
  for r in select * from reservas x where x.orden_produccion_id = p_op and x.estado = 'activa'
             and (p_articulos is null or x.articulo_id = any(p_articulos))
           order by x.articulo_id, x.creado_en for update loop
    v_suelta := r.cantidad - r.surtido;
    update reservas set estado = case when r.surtido > 0 then 'surtida' else 'liberada' end,
      cantidad = case when r.surtido > 0 then r.surtido else r.cantidad end,
      soltada_en = now(), soltada_por = auth.uid(), motivo_soltada = v_motivo
    where id = r.id;
    if v_suelta > 0 then
      v_partidas := v_partidas || jsonb_build_object('articulo_id', r.articulo_id, 'cantidad', v_suelta);
    end if;
  end loop;
  if jsonb_array_length(v_partidas) = 0 then
    raise exception '%', case when p_articulos is null then format('La orden %s no tiene nada apartado por soltar', o.folio)
                              else 'Esas partidas no tienen nada apartado por soltar (lo surtido ya salió del almacén)' end
      using errcode = '22023';
  end if;

  -- Por artículo, con nombre, para la línea de tiempo.
  select jsonb_agg(jsonb_build_object('articulo_id', x.articulo_id, 'nombre', a.nombre, 'unidad', a.unidad, 'cantidad', x.cantidad) order by a.nombre),
         string_agg(format('%s %s de %s', trim_scale(x.cantidad), a.unidad, a.nombre), ', ' order by a.nombre)
    into v_partidas, v_texto
  from (select (e->>'articulo_id')::uuid articulo_id, sum((e->>'cantidad')::numeric) cantidad
        from jsonb_array_elements(v_partidas) e group by 1) x
  join articulos a on a.id = x.articulo_id;

  select count(*) into v_quedan from reservas where orden_produccion_id = p_op and estado = 'activa' and cantidad > surtido;
  -- Sin nada apartado, el paso «Material apartado» vuelve a pendiente (validacion_orden) y se puede
  -- volver a apartar; si quedan partidas apartadas, el paso se queda como estaba.
  update ordenes_produccion set
    material_soltado_en = now(), material_soltado_por = auth.uid(), material_soltado_motivo = v_motivo,
    material_apartado_en = case when v_quedan = 0 then null else material_apartado_en end,
    material_apartado_por = case when v_quedan = 0 then null else material_apartado_por end,
    apartado_sin_revision_motivo = case when v_quedan = 0 then null else apartado_sin_revision_motivo end,
    apartado_sin_revision_por = case when v_quedan = 0 then null else apartado_sin_revision_por end
  where id = p_op;

  insert into op_eventos (orden_id, tipo, nota, detalle) values (p_op, 'nota',
    format('Se soltó lo apartado (%s): %s. Motivo: %s',
           case when p_articulos is null then 'todo' else format('%s partida(s)', jsonb_array_length(v_partidas)) end,
           v_texto, v_motivo),
    jsonb_build_object('soltado', v_partidas, 'motivo', v_motivo, 'quedan_apartadas', v_quedan));

  return jsonb_build_object('partidas', jsonb_array_length(v_partidas), 'quedan_apartadas', v_quedan, 'detalle', v_partidas);
end $$;
revoke execute on function public.soltar_apartado(uuid, uuid[], text) from public, anon;
grant execute on function public.soltar_apartado(uuid, uuid[], text) to authenticated;

-- La validación de 040. El paso «Material apartado» ya no cuenta lo apartado antes de soltarlo: la
-- primera reserva (para las órdenes apartadas antes de material_apartado_en) solo vale si es posterior
-- a la última vez que se soltó. Pendiente después de soltar dice quién lo soltó y por qué.
create or replace function public.validacion_orden(p_op uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare o ordenes_produccion; v_lineas int; v_falt int; v_sin_pedir int; v_res record; v_req record; v_lib record;
        v_apartado_en timestamptz;
begin
  if not (puede('produccion', 1) or puede('inventario', 1)) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  select * into o from ordenes_produccion where id = p_op;
  if o.id is null then return null; end if;
  select count(*), count(*) filter (where faltante > 0), count(*) filter (where faltante - pedido_a_compras > 0)
    into v_lineas, v_falt, v_sin_pedir from v_op_material where orden_id = p_op;
  -- Órdenes apartadas antes de que existiera material_apartado_en: la primera reserva dice quién.
  select r.creado_en en, p.nombre por into v_res from reservas r left join perfiles p on p.id = r.creado_por
  where r.orden_produccion_id = p_op and (o.material_soltado_en is null or r.creado_en > o.material_soltado_en)
  order by r.creado_en limit 1;
  v_apartado_en := coalesce(o.material_apartado_en, v_res.en);
  select r.folio, r.creado_en en, p.nombre por into v_req
  from requisiciones r join requisicion_lineas l on l.requisicion_id = r.id left join perfiles p on p.id = r.solicitante_id
  where l.orden_produccion_id = p_op and l.estado <> 'cancelada' order by r.creado_en desc limit 1;
  select ev.en, p.nombre por into v_lib from op_eventos ev left join perfiles p on p.id = ev.usuario_id
  where ev.orden_id = p_op and ev.tipo = 'liberada' order by ev.en desc limit 1;

  return jsonb_build_array(
    jsonb_build_object('paso', 'ingenieria', 'titulo', 'Ingeniería revisó la lista',
      'estado', case when o.revisado_ingenieria_en is not null then 'hecho' else 'pendiente' end,
      'por', (select nombre from perfiles where id = o.revisado_ingenieria_por), 'en', o.revisado_ingenieria_en,
      'detalle', format('%s partida(s) en la lista', v_lineas)),
    case when v_apartado_en is null and o.material_soltado_en is not null then
      jsonb_build_object('paso', 'apartado', 'titulo', 'Material apartado', 'estado', 'pendiente',
        'por', (select nombre from perfiles where id = o.material_soltado_por), 'en', o.material_soltado_en,
        'detalle', format('Se soltó lo apartado: %s', o.material_soltado_motivo))
    else
      jsonb_build_object('paso', 'apartado', 'titulo', 'Material apartado',
        'estado', case when v_apartado_en is null then 'pendiente' when v_falt > 0 then 'parcial' else 'hecho' end,
        'por', coalesce((select nombre from perfiles where id = o.material_apartado_por), v_res.por),
        'en', v_apartado_en,
        'detalle', case when v_falt = 0 then 'Nada falta' else format('%s partida(s) con faltante', v_falt) end)
    end,
    jsonb_build_object('paso', 'faltantes', 'titulo', 'Faltantes pedidos a compras',
      'estado', case when v_sin_pedir > 0 then 'pendiente'
                     when v_req.folio is not null then 'hecho' else 'no_aplica' end,
      'por', coalesce((select nombre from perfiles where id = o.faltantes_pedidos_por), v_req.por),
      'en', coalesce(o.faltantes_pedidos_en, v_req.en),
      'detalle', case when v_sin_pedir > 0 then format('%s partida(s) sin pedir', v_sin_pedir)
                      when v_req.folio is not null then v_req.folio else 'No hizo falta' end),
    jsonb_build_object('paso', 'almacen', 'titulo', 'Almacén revisó',
      'estado', case when o.revisado_almacen_en is not null then 'hecho' else 'pendiente' end,
      'por', (select nombre from perfiles where id = o.revisado_almacen_por), 'en', o.revisado_almacen_en,
      'detalle', 'Existencia física'),
    jsonb_build_object('paso', 'liberada', 'titulo', 'Liberada al taller',
      'estado', case when o.estado not in ('planeada', 'cancelada') then 'hecho' else 'pendiente' end,
      'por', v_lib.por, 'en', v_lib.en,
      'detalle', case o.estado when 'planeada' then 'Espera a la gerencia' when 'cancelada' then 'Cancelada'
                                 else 'En el taller' end)
  );
end $$;

-- ---------------------------------------------------------------- 2. posponer un preventivo
-- vence es la fecha que manda (la nueva): con ella se calcula vencido, el calendario, la carga y los
-- avisos, sin tocar cada lugar que la lee. vence_original guarda la que le puso el plan.
alter table public.ordenes_mantenimiento
  add column if not exists vence_original date,
  add column if not exists pospuesto_veces int not null default 0,
  add column if not exists pospuesto_motivo text,
  add column if not exists pospuesto_en timestamptz,
  add column if not exists pospuesto_por uuid references public.perfiles(id);
comment on column public.ordenes_mantenimiento.vence_original is 'La fecha que le tocaba según su plan, antes de posponerla (vence es la nueva).';

create table if not exists public.mantenimiento_posposiciones (
  id bigserial primary key,
  orden_id uuid not null references public.ordenes_mantenimiento(id) on delete cascade,
  de date,
  a date not null,
  motivo text not null,
  por uuid default auth.uid() references public.perfiles(id),
  en timestamptz not null default now()
);
create index if not exists mantenimiento_posposiciones_orden on public.mantenimiento_posposiciones (orden_id, en);
create index if not exists mantenimiento_posposiciones_en on public.mantenimiento_posposiciones (en);
alter table public.mantenimiento_posposiciones enable row level security;
drop policy if exists ver on public.mantenimiento_posposiciones;
create policy ver on public.mantenimiento_posposiciones for select to authenticated using ((select puede('mantenimiento', 1)));
-- Sin políticas de escritura: solo posponer_mantenimiento() las anota.

-- Quien programa el mantenimiento (mantenimiento 3: mantenimiento, gerencia de producción y dirección,
-- los mismos que editan los planes, cierran y cancelan) lo pospone. Solo un preventivo que nadie ha
-- empezado: si ya se empezó, se pausa en la terminal.
create or replace function public.posponer_mantenimiento(p_orden uuid, p_fecha date, p_motivo text) returns void
language plpgsql security definer set search_path = public as $$
declare o ordenes_mantenimiento; m maquinas; v_motivo text := nullif(trim(p_motivo), '');
begin
  if not puede('mantenimiento', 3) then
    raise exception 'Posponer un preventivo es de mantenimiento o de la gerencia de producción' using errcode = '42501';
  end if;
  select * into o from ordenes_mantenimiento where id = p_orden for update;
  if o.id is null then raise exception 'No existe la orden'; end if;
  if o.tipo <> 'preventivo' then raise exception 'Solo un preventivo tiene fecha para posponer; una falla se atiende o se cancela'; end if;
  if o.estado = 'en_proceso' then
    raise exception 'La orden % ya se empezó: ponla en pausa en la terminal y síguela cuando se pueda', o.folio;
  end if;
  if o.estado <> 'pendiente' then raise exception 'La orden % ya está %', o.folio, o.estado; end if;
  if v_motivo is null or length(v_motivo) < 5 then raise exception 'Escribe por qué se pospone' using errcode = '22023'; end if;
  if p_fecha is null or p_fecha < hoy_planta() then
    raise exception 'La fecha nueva no puede ser antes de hoy' using errcode = '22023';
  end if;
  if o.vence is not null and p_fecha <= o.vence then
    raise exception 'La fecha nueva tiene que ser después del %: para hacerlo antes no hace falta moverlo', to_char(o.vence, 'DD/MM/YYYY')
      using errcode = '22023';
  end if;

  insert into mantenimiento_posposiciones (orden_id, de, a, motivo) values (o.id, o.vence, p_fecha, v_motivo);
  update ordenes_mantenimiento set vence = p_fecha, vence_original = coalesce(vence_original, vence),
    pospuesto_veces = pospuesto_veces + 1, pospuesto_motivo = v_motivo, pospuesto_en = now(), pospuesto_por = auth.uid()
  where id = o.id;

  -- Como el aviso de cada preventivo (080): la gerencia de producción, que decide si se puede parar,
  -- y el resto de mantenimiento. A quien lo pospuso no le llega (avisar lo quita).
  select * into m from maquinas where id = o.maquina_id;
  perform avisar(array(select usuarios_con_rol('gerente_produccion') union select usuarios_con_rol('mantenimiento')),
    'preventivo_pospuesto', format('Preventivo pospuesto: %s %s', m.numero, m.nombre),
    format('%s pasa %sal %s (%s %s) · %s', o.folio,
           coalesce('del ' || to_char(o.vence, 'DD/MM') || ' ', ''), to_char(p_fecha, 'DD/MM'),
           o.pospuesto_veces + 1, case when o.pospuesto_veces = 0 then 'vez' else 'veces' end, left(v_motivo, 140)),
    '/servicio/maquinas?pestana=ordenes&orden=' || o.id, 'ordenes_mantenimiento', o.id::text);
end $$;
revoke execute on function public.posponer_mantenimiento(uuid, date, text) from public, anon;
grant execute on function public.posponer_mantenimiento(uuid, date, text) to authenticated;

-- La fecha del plan (212). Un preventivo pospuesto cuenta por la fecha que le tocaba: si el del 30 de
-- noviembre se pasó al 4 de diciembre y se hizo ese día, el siguiente es el de diciembre, no el de
-- enero. Solo en los planes por mes; «cada N días» sigue contando desde que se hizo.
create or replace function public.preventivo_fecha(p_modo text, p_ultima date, p_cada_dias int, p_cada_meses int,
  p_semana_mes int, p_dia_semana int, p_dia_mes int, p_solo_laborables boolean, p_plan uuid default null)
returns date language plpgsql stable security invoker set search_path = public as $$
declare v_ancla date; v_ultima date := p_ultima; v_orig date; v_mes date; v_fin date; v_d date; v_x date; i int;
begin
  if p_modo = 'dias' then
    if p_cada_dias is null or p_ultima is null then return null; end if;
    v_d := p_ultima + p_cada_dias;
    if p_solo_laborables then
      v_x := v_d; i := 0;
      while i < 31 and not dia_laborable(v_x) loop v_x := v_x + 1; i := i + 1; end loop;
      if i < 31 then v_d := v_x; end if;
    end if;
    return v_d;
  end if;
  if p_modo not in ('mes_semana', 'mes_dia') or p_ultima is null then return null; end if;

  if p_plan is not null then
    -- La última vez que se hizo fue un preventivo pospuesto: la cuenta sigue desde su fecha del plan.
    select o.vence_original into v_orig from ordenes_mantenimiento o
    where o.plan_id = p_plan and o.estado = 'cerrada' and o.vence_original is not null
      and (o.cerrada_en at time zone 'America/Mexico_City')::date = p_ultima
    order by o.cerrada_en desc limit 1;
    if v_orig is not null then v_ultima := least(p_ultima, v_orig); end if;
  end if;
  select greatest(v_ultima, max(coalesce(o.vence_original, o.vence))) into v_ancla
  from ordenes_mantenimiento o where p_plan is not null and o.plan_id = p_plan and o.estado = 'cerrada';
  v_ancla := coalesce(v_ancla, v_ultima);
  -- El mes siguiente al último que se hizo (o a los N meses).
  v_mes := (date_trunc('month', v_ancla) + make_interval(months => coalesce(p_cada_meses, 1)))::date;
  v_fin := (v_mes + interval '1 month' - interval '1 day')::date;
  if p_modo = 'mes_dia' then
    v_d := v_mes + least(p_dia_mes, extract(day from v_fin)::int) - 1;
  elsif p_semana_mes = 5 then
    v_d := v_fin - ((extract(isodow from v_fin)::int - p_dia_semana + 7) % 7);
  else
    v_d := v_mes + ((p_dia_semana - extract(isodow from v_mes)::int + 7) % 7) + 7 * (p_semana_mes - 1);
  end if;

  if p_solo_laborables and not dia_laborable(v_d) then
    -- Al siguiente día que se trabaja; si ya es del otro mes, al anterior.
    v_x := v_d + 1;
    while v_x <= v_fin loop
      if dia_laborable(v_x) then return v_x; end if;
      v_x := v_x + 1;
    end loop;
    v_x := v_d - 1;
    while v_x >= v_mes loop
      if dia_laborable(v_x) then return v_x; end if;
      v_x := v_x - 1;
    end loop;
  end if;
  return v_d;
end $$;

-- Cambiaron el calendario de un plan (212). Lo que una persona pospuso con su motivo no lo mueve el
-- plan ni lo cancela: se queda en su fecha y solo cambia la que le tocaba (vence_original).
create or replace function public.plan_preventivo_reprogramar() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_prox date; v_horas numeric; o ordenes_mantenimiento;
begin
  if (new.modo, new.cada_dias, new.cada_meses, new.semana_mes, new.dia_semana, new.dia_mes, new.solo_laborables,
      new.ultima_fecha, new.anticipacion_dias, new.cada_horas, new.ultima_horas)
     is not distinct from
     (old.modo, old.cada_dias, old.cada_meses, old.semana_mes, old.dia_semana, old.dia_mes, old.solo_laborables,
      old.ultima_fecha, old.anticipacion_dias, old.cada_horas, old.ultima_horas) then
    return null;
  end if;
  select * into o from ordenes_mantenimiento where plan_id = new.id and estado = 'pendiente' for update;
  if o.id is null then return null; end if;
  v_prox := preventivo_proxima(new);
  select horas_uso into v_horas from maquinas where id = new.maquina_id;
  if o.pospuesto_veces > 0 then
    update ordenes_mantenimiento set vence_original = v_prox, vence_horas = new.ultima_horas + new.cada_horas where id = o.id;
  elsif (v_prox is not null and v_prox - new.anticipacion_dias <= hoy_planta())
     or (new.cada_horas is not null and v_horas >= new.ultima_horas + new.cada_horas)
     -- Si ya le capturaron algo (refacciones, checklist, fotos, diagnóstico), no se cancela: solo cambia la fecha.
     or o.inicio_en is not null or o.diagnostico is not null
     or exists (select 1 from servicio_materiales x where x.mantenimiento_id = o.id and x.estado <> 'cancelado')
     or exists (select 1 from orden_checklist c where c.orden_id = o.id and c.bien is not null)
     or exists (select 1 from servicio_evidencias x where x.mantenimiento_id = o.id) then
    update ordenes_mantenimiento set vence = v_prox, vence_horas = new.ultima_horas + new.cada_horas where id = o.id;
  else
    update ordenes_mantenimiento set estado = 'cancelada', motivo_cancelacion = 'Se cambió el calendario del plan; sale otra vez cuando toque'
    where id = o.id;
  end if;
  return null;
end $$;

-- La orden (216) con lo de posponer al final.
create or replace view public.v_ordenes_mantenimiento with (security_invoker = true) as
select o.id, o.folio, o.maquina_id, m.numero, m.nombre as maquina, m.categoria, m.tipo as maquina_tipo, m.etapa_id,
  et.nombre as etapa, o.tipo, o.estado, o.falla, o.detiene,
  coalesce(o.reportado_por_nombre, pr.nombre) as reportado_por_nombre, o.reportado_en,
  o.plan_id, pl.nombre as plan, o.vence, o.vence_horas, o.diagnostico, o.atendido_por, o.trabajo_realizado,
  o.inicio_en, o.cerrada_en, pc.nombre as cerrada_por_nombre, o.fuera_desde, o.fuera_hasta,
  case when o.fuera_desde is not null then round((extract(epoch from coalesce(o.fuera_hasta, now()) - o.fuera_desde) / 3600.0)::numeric, 1) end as horas_paro,
  o.horas_uso_al_cerrar, o.motivo_cancelacion,
  o.estado in ('pendiente', 'en_proceso') as abierta,
  o.tipo = 'preventivo' and o.estado in ('pendiente', 'en_proceso') and o.vence < public.hoy_planta() as vencida,
  (select count(*) from public.servicio_materiales x where x.mantenimiento_id = o.id and x.estado <> 'cancelado')::int as refacciones,
  (select count(*) from public.servicio_materiales x where x.mantenimiento_id = o.id and x.estado in ('pendiente', 'en_compra'))::int as refacciones_pendientes,
  (select count(*) from public.servicio_evidencias x where x.mantenimiento_id = o.id)::int as fotos,
  o.creado_en,
  o.horas_trabajadas,
  (select count(*) from public.orden_checklist c where c.orden_id = o.id)::int as puntos,
  (select count(*) from public.orden_checklist c where c.orden_id = o.id and c.bien is not null)::int as puntos_revisados,
  (select count(*) from public.orden_checklist c where c.orden_id = o.id and c.bien is false)::int as puntos_con_falla,
  tr.horas as horas_tramos, tr.en_play, coalesce(tr.yo_en_play, false) as yo_en_play, tr.ultima_pausa, tr.ultima_pausa_motivo,
  tr.mi_ultima_pausa, m.criticidad,
  o.vence_original, o.pospuesto_veces, o.pospuesto_motivo, o.pospuesto_en, pp.nombre as pospuesto_por_nombre
from public.ordenes_mantenimiento o
join public.maquinas m on m.id = o.maquina_id
left join public.etapas et on et.id = m.etapa_id
left join public.planes_preventivos pl on pl.id = o.plan_id
left join public.perfiles pr on pr.id = o.reportado_por
left join public.perfiles pc on pc.id = o.cerrada_por
left join public.perfiles pp on pp.id = o.pospuesto_por
left join lateral (
  select round(sum(public.horas_trabajadas(t.inicio, coalesce(t.fin, now())))::numeric, 2) as horas,
    array_agg(pt.nombre order by t.inicio) filter (where t.fin is null) as en_play,
    bool_or(t.fin is null and t.usuario_id = (select auth.uid())) as yo_en_play,
    max(t.fin) as ultima_pausa,
    (array_agg(t.motivo_pausa order by t.fin desc) filter (where t.fin is not null))[1] as ultima_pausa_motivo,
    max(t.fin) filter (where t.usuario_id = (select auth.uid())) as mi_ultima_pausa
  from public.mantenimiento_tramos t join public.perfiles pt on pt.id = t.usuario_id
  where t.orden_id = o.id) tr on true;

-- Los planes (212). Si su orden abierta se pospuso, manda la fecha nueva: no sale vencido (ni por
-- fecha ni por horas) hasta ese día, y «Toca» dice cuándo se va a hacer.
create or replace view public.v_planes_preventivos with (security_invoker = true) as
select p.id, p.maquina_id, m.numero, m.nombre as maquina, m.horas_uso as horas_actuales, p.nombre, p.tareas,
  p.cada_dias, p.cada_horas, p.ultima_fecha, p.ultima_horas, p.anticipacion_dias, p.activo,
  ef.fecha as proxima_fecha,
  p.ultima_horas + p.cada_horas as proximas_horas,
  ef.fecha - public.hoy_planta() as dias_restantes,
  p.ultima_horas + p.cada_horas - m.horas_uso as horas_restantes,
  case when ef.pospuesta then
         case when ef.fecha < public.hoy_planta() then 'vencido'
              when ef.fecha - p.anticipacion_dias <= public.hoy_planta() then 'por_vencer' else 'al_dia' end
       when px.fecha < public.hoy_planta()
         or (p.cada_horas is not null and m.horas_uso >= p.ultima_horas + p.cada_horas) then 'vencido'
       when px.fecha - p.anticipacion_dias <= public.hoy_planta()
         or (p.cada_horas is not null and m.horas_uso >= p.ultima_horas + p.cada_horas * 0.9) then 'por_vencer'
       else 'al_dia' end as situacion,
  o.id as orden_id, o.folio as orden_folio, o.estado as orden_estado,
  p.rutina_id, ru.nombre as rutina, jsonb_array_length(ru.puntos) as rutina_puntos,
  p.modo, p.cada_meses, p.semana_mes, p.dia_semana, p.dia_mes, p.solo_laborables,
  coalesce(o.pospuesto_veces, 0) as orden_pospuesta_veces, o.pospuesto_motivo as orden_pospuesto_motivo,
  o.vence_original as orden_vence_original
from public.planes_preventivos p
join public.maquinas m on m.id = p.maquina_id
cross join lateral (select public.preventivo_proxima(p) as fecha offset 0) px
left join public.ordenes_mantenimiento o on o.plan_id = p.id and o.estado in ('pendiente', 'en_proceso')
left join public.rutinas_mantenimiento ru on ru.id = p.rutina_id
cross join lateral (select coalesce(o.pospuesto_veces, 0) > 0 and o.vence is not null as pospuesta,
                           case when coalesce(o.pospuesto_veces, 0) > 0 and o.vence is not null then o.vence else px.fecha end as fecha) ef;

-- Métricas de mantenimiento (212): cuántas veces se pospuso en el periodo y cuántos siguen
-- pospuestos, y en lo abierto, cuántas veces se pospuso cada uno. Cada cambio se busca tal cual y
-- truena si no está, para no reemplazar a ciegas.
do $$
declare d text; n text;
begin
  d := pg_get_functiondef('public.metricas_mantenimiento(date, date)'::regprocedure);
  n := replace(d, $a$      'prev_vencidos', (select count(*)$a$,
    $a$      'posposiciones', (select count(*) from mantenimiento_posposiciones x
                        where (x.en at time zone 'America/Mexico_City')::date between p_desde and p_hasta),
      'prev_pospuestos', (select count(*) from ordenes_mantenimiento o where o.tipo = 'preventivo' and o.estado = 'pendiente'
                          and o.pospuesto_veces > 0),
      'prev_vencidos', (select count(*)$a$);
  if n = d then raise exception 'metricas_mantenimiento: no encontré prev_vencidos'; end if;
  d := n;
  n := replace(d, $a$'vence', o.vence,$a$, $a$'vence', o.vence, 'pospuesto_veces', o.pospuesto_veces,$a$);
  if n = d then raise exception 'metricas_mantenimiento: no encontré la fecha de lo abierto'; end if;
  execute n;

  -- La carga proyectada (247): después de un preventivo pospuesto, el siguiente sale de la fecha que le
  -- tocaba (planes por mes), igual que preventivo_fecha; si no, la proyección brincaba un mes.
  d := pg_get_functiondef('public.mantenimiento_analitica(date, date)'::regprocedure);
  n := replace(d, $a$p planes_preventivos; v_f date; v_abierta date; i int;$a$,
                  $a$p planes_preventivos; v_f date; v_abierta date; v_base date; i int;$a$);
  if n = d then raise exception 'mantenimiento_analitica: no encontré las variables'; end if;
  d := n;
  n := replace(d, $a$    select min(o.vence) into v_abierta from ordenes_mantenimiento o
    where o.plan_id = p.id and o.estado in ('pendiente', 'en_proceso');
    v_f := coalesce(v_abierta, preventivo_proxima(p));$a$,
    $a$    select min(o.vence), min(coalesce(o.vence_original, o.vence)) into v_abierta, v_base from ordenes_mantenimiento o
    where o.plan_id = p.id and o.estado in ('pendiente', 'en_proceso');
    v_f := coalesce(v_abierta, preventivo_proxima(p));
    v_base := case when p.modo = 'dias' then v_f else coalesce(v_base, v_f) end;$a$);
  if n = d then raise exception 'mantenimiento_analitica: no encontré la orden abierta'; end if;
  d := n;
  n := replace(d, $a$      v_f := preventivo_fecha(p.modo, v_f, p.cada_dias, p.cada_meses, p.semana_mes, p.dia_semana, p.dia_mes, p.solo_laborables, null);$a$,
    $a$      v_f := preventivo_fecha(p.modo, v_base, p.cada_dias, p.cada_meses, p.semana_mes, p.dia_semana, p.dia_mes, p.solo_laborables, null);
      v_base := v_f;$a$);
  if n = d then raise exception 'mantenimiento_analitica: no encontré la siguiente fecha'; end if;
  execute n;

  -- El indicador del bono (261) mide contra la fecha del plan, no contra la pospuesta.
  d := pg_get_functiondef('public.objetivo_medir(text, text, uuid, date, jsonb)'::regprocedure);
  n := replace(d, $a$      select o.id, o.folio, m.nombre maquina, o.vence, o.estado, (o.cerrada_en at time zone tz)::date cerrada
      from ordenes_mantenimiento o left join maquinas m on m.id = o.maquina_id
      where o.tipo = 'preventivo' and o.estado <> 'cancelada' and o.vence >= v_ini and o.vence < v_fin
        and (o.cerrada_en is not null or o.vence < v_hoy)
    )$a$,
    $a$      select o.id, o.folio, m.nombre maquina, coalesce(o.vence_original, o.vence) vence, o.estado,
        (o.cerrada_en at time zone tz)::date cerrada, o.pospuesto_veces, o.pospuesto_motivo
      from ordenes_mantenimiento o left join maquinas m on m.id = o.maquina_id
      where o.tipo = 'preventivo' and o.estado <> 'cancelada'
        and coalesce(o.vence_original, o.vence) >= v_ini and coalesce(o.vence_original, o.vence) < v_fin
        and (o.cerrada_en is not null or coalesce(o.vence_original, o.vence) < v_hoy)
    )$a$);
  if n = d then raise exception 'objetivo_medir: no encontré preventivos_a_tiempo'; end if;
  d := n;
  n := replace(d, $a$      'nota', 'Preventivos que vencían en el mes. Incidencia: se cerró después de su fecha o sigue abierto.',$a$,
    $a$      'nota', 'Preventivos que vencían en el mes, por la fecha de su plan aunque se hayan pospuesto. Incidencia: se cerró después de esa fecha o sigue abierto.',$a$);
  if n = d then raise exception 'objetivo_medir: no encontré la nota de preventivos'; end if;
  d := n;
  n := replace(d, $a$                       then 'hecho ' || (x.cerrada - x.vence) || ' día(s) tarde' else 'a tiempo' end,$a$,
    $a$                       then 'hecho ' || (x.cerrada - x.vence) || ' día(s) tarde' else 'a tiempo' end
                     || case when x.pospuesto_veces > 0 then format(' · pospuesto %s %s: %s', x.pospuesto_veces,
                                  case when x.pospuesto_veces = 1 then 'vez' else 'veces' end, x.pospuesto_motivo) else '' end,$a$);
  if n = d then raise exception 'objetivo_medir: no encontré el detalle de preventivos'; end if;
  execute n;
end $$;

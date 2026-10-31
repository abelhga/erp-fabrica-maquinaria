-- =============================================================================
-- Mantenimiento, tercera entrega de la junta con Esteban (30 oct).
--
-- 6. Terminal de mantenimiento con play y pausa. Esteban empieza una máquina, la deja por otra
--    y regresa: las horas trabajadas salían de memoria al cerrar. Ahora cada play abre un tramo
--    de esa persona y cada pausa lo cierra; al cerrar la orden, las horas son la suma de los
--    tramos (contadas como las del taller: horas_trabajadas(), sin noches ni descansos). Dar play
--    en otra orden pausa la que traía, porque una persona no trabaja dos máquinas a la vez.
-- 2. Criticidad calculada sola: impacto en producción y riesgo de seguridad los califica quien
--    conoce la máquina (eso no lo sabe la base); frecuencia de fallas y costo de reparación salen
--    de las órdenes; si tiene respaldo (otra igual en su área) y cuánto tarda la refacción, de
--    las máquinas y las refacciones, con opción de corregirlo a mano. Mientras falten los dos
--    factores que se capturan, se queda la criticidad de la hoja.
-- =============================================================================

-- ---------------------------------------------------------------- 6. tramos de trabajo
create table if not exists public.mantenimiento_tramos (
  id bigserial primary key,
  orden_id uuid not null references public.ordenes_mantenimiento(id) on delete cascade,
  usuario_id uuid not null references public.perfiles(id),
  -- clock_timestamp: play y pausa en la misma transacción (las pruebas) no deben empatar.
  inicio timestamptz not null default clock_timestamp(),
  fin timestamptz,
  motivo_pausa text,
  check (fin is null or fin >= inicio)
);
create index if not exists mantenimiento_tramos_orden on public.mantenimiento_tramos (orden_id, inicio);
create unique index if not exists mantenimiento_tramo_abierto on public.mantenimiento_tramos (usuario_id) where fin is null;
alter table public.mantenimiento_tramos enable row level security;
drop policy if exists ver on public.mantenimiento_tramos;
create policy ver on public.mantenimiento_tramos for select to authenticated using ((select puede('mantenimiento', 1)));
-- Sin políticas de escritura: solo play, pausa, cerrar y cancelar los tocan.
do $$ begin
  -- La terminal de otro (Esteban en el celular, la gerencia en la oficina) se entera del play.
  alter publication supabase_realtime add table public.mantenimiento_tramos;
exception when duplicate_object then null; when undefined_object then null;
end $$;

-- Horas de una orden según sus tramos (las abiertas cuentan hasta ahora).
create or replace function public.horas_tramos_mto(p_orden uuid) returns numeric
language sql stable security invoker set search_path = public as $$
  select round(coalesce(sum(horas_trabajadas(t.inicio, coalesce(t.fin, now()))), 0)::numeric, 2)
  from mantenimiento_tramos t where t.orden_id = p_orden
$$;
revoke execute on function public.horas_tramos_mto(uuid) from public, anon;
grant execute on function public.horas_tramos_mto(uuid) to authenticated;

create or replace function public.mto_play(p_orden uuid) returns void
language plpgsql security definer set search_path = public as $$
declare o ordenes_mantenimiento; v_yo uuid := auth.uid();
begin
  if not es_personal_mantenimiento() then raise exception 'Sin permiso para atender mantenimiento' using errcode = '42501'; end if;
  select * into o from ordenes_mantenimiento where id = p_orden for update;
  if o.id is null then raise exception 'No existe la orden'; end if;
  if o.estado not in ('pendiente', 'en_proceso') then raise exception 'La orden % ya está %', o.folio, o.estado; end if;
  if exists (select 1 from mantenimiento_tramos where usuario_id = v_yo and orden_id = p_orden and fin is null) then return; end if;
  -- La que traía se pausa sola: dice a cuál se fue, para que al volver se entienda el hueco.
  update mantenimiento_tramos set fin = clock_timestamp(),
    motivo_pausa = 'Se pasó a ' || (select numero from maquinas where id = o.maquina_id) || ' (' || o.folio || ')'
  where usuario_id = v_yo and fin is null;
  insert into mantenimiento_tramos (orden_id, usuario_id) values (p_orden, v_yo);
  -- Igual que «Empezar a repararla», pero sin pedir diagnóstico: eso se escribe cuando se sabe.
  update ordenes_mantenimiento set estado = 'en_proceso', inicio_en = coalesce(inicio_en, now()),
    atendido_por = coalesce(atendido_por, (select nombre from perfiles where id = v_yo)),
    detiene = detiene or tipo = 'preventivo',
    fuera_desde = case when detiene or tipo = 'preventivo' then coalesce(fuera_desde, now()) else fuera_desde end
  where id = p_orden;
  perform recalcular_estado_maquina(o.maquina_id);
end $$;
revoke execute on function public.mto_play(uuid) from public, anon;
grant execute on function public.mto_play(uuid) to authenticated;

create or replace function public.mto_pausa(p_orden uuid, p_motivo text default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not es_personal_mantenimiento() then raise exception 'Sin permiso para atender mantenimiento' using errcode = '42501'; end if;
  update mantenimiento_tramos set fin = clock_timestamp(), motivo_pausa = nullif(trim(p_motivo), '')
  where orden_id = p_orden and usuario_id = auth.uid() and fin is null;
  if not found then raise exception 'No la tienes en play'; end if;
end $$;
revoke execute on function public.mto_pausa(uuid, text) from public, anon;
grant execute on function public.mto_pausa(uuid, text) to authenticated;

-- Cerrar: los tramos que sigan abiertos terminan aquí, y si hubo tramos las horas trabajadas son
-- su suma (quien cierra puede escribir otra cifra si alguien olvidó dar play).
create or replace function public.cerrar_mantenimiento(p_orden uuid, p_trabajo text, p_horas_uso numeric default null,
  p_horas_trabajadas numeric default null) returns void
language plpgsql security definer set search_path = public as $$
declare o ordenes_mantenimiento; v_horas numeric; v_faltan int; v_tramos numeric;
begin
  if not puede('mantenimiento', 3) then raise exception 'Solo mantenimiento o la gerencia de producción cierran órdenes de mantenimiento' using errcode = '42501'; end if;
  select * into o from ordenes_mantenimiento where id = p_orden for update;
  if o.id is null then raise exception 'No existe la orden'; end if;
  if o.estado not in ('pendiente', 'en_proceso') then raise exception 'La orden % ya está %', o.folio, o.estado; end if;
  if coalesce(length(trim(p_trabajo)), 0) < 5 then raise exception 'Escribe qué se hizo (qué se cambió o reparó)'; end if;
  if p_horas_trabajadas is not null and (p_horas_trabajadas < 0 or p_horas_trabajadas > 500) then raise exception 'Horas trabajadas fuera de rango'; end if;
  select count(*) into v_faltan from orden_checklist where orden_id = p_orden and bien is null;
  if v_faltan > 0 then raise exception 'Faltan % puntos del checklist por revisar', v_faltan; end if;
  if p_horas_uso is not null then
    if p_horas_uso < (select horas_uso from maquinas where id = o.maquina_id) then
      raise exception 'El horómetro no puede ir para atrás';
    end if;
    update maquinas set horas_uso = p_horas_uso, horas_actualizado_en = now() where id = o.maquina_id;
  end if;
  update mantenimiento_tramos set fin = clock_timestamp(), motivo_pausa = 'Se cerró la orden' where orden_id = p_orden and fin is null;
  v_tramos := case when exists (select 1 from mantenimiento_tramos where orden_id = p_orden) then horas_tramos_mto(p_orden) end;
  select horas_uso into v_horas from maquinas where id = o.maquina_id;
  update ordenes_mantenimiento set estado = 'cerrada', cerrada_en = now(), cerrada_por = auth.uid(), trabajo_realizado = trim(p_trabajo),
    inicio_en = coalesce(inicio_en, now()), fuera_hasta = case when fuera_desde is not null then now() end, horas_uso_al_cerrar = v_horas,
    horas_trabajadas = coalesce(p_horas_trabajadas, v_tramos, horas_trabajadas)
  where id = p_orden;
  if o.tipo = 'preventivo' and o.plan_id is not null then
    update planes_preventivos set ultima_fecha = hoy_planta(), ultima_horas = v_horas where id = o.plan_id;
  end if;
  perform recalcular_estado_maquina(o.maquina_id);
end $$;

create or replace function public.cancelar_mantenimiento(p_orden uuid, p_motivo text) returns void
language plpgsql security definer set search_path = public as $$
declare o ordenes_mantenimiento;
begin
  if not puede('mantenimiento', 3) then raise exception 'Solo mantenimiento o la gerencia cancelan órdenes de mantenimiento' using errcode = '42501'; end if;
  select * into o from ordenes_mantenimiento where id = p_orden for update;
  if o.id is null then raise exception 'No existe la orden'; end if;
  if o.estado not in ('pendiente', 'en_proceso') then raise exception 'La orden % ya está %', o.folio, o.estado; end if;
  if coalesce(length(trim(p_motivo)), 0) < 3 then raise exception 'Escribe por qué se cancela (¿era el mismo reporte?)'; end if;
  update ordenes_mantenimiento set estado = 'cancelada', motivo_cancelacion = trim(p_motivo),
    fuera_hasta = case when fuera_desde is not null then now() end where id = p_orden;
  update mantenimiento_tramos set fin = clock_timestamp(), motivo_pausa = 'Se canceló la orden' where orden_id = p_orden and fin is null;
  update servicio_materiales set estado = 'cancelado' where mantenimiento_id = p_orden and estado = 'pendiente';
  perform recalcular_estado_maquina(o.maquina_id);
end $$;

-- La orden con lo de la terminal al final: quién la trae en play, si soy yo, cuándo fue su última
-- pausa (arriba van las pausadas más recientes) y las horas que llevan los tramos.
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
  tr.mi_ultima_pausa, m.criticidad
from public.ordenes_mantenimiento o
join public.maquinas m on m.id = o.maquina_id
left join public.etapas et on et.id = m.etapa_id
left join public.planes_preventivos pl on pl.id = o.plan_id
left join public.perfiles pr on pr.id = o.reportado_por
left join public.perfiles pc on pc.id = o.cerrada_por
left join lateral (
  select round(sum(public.horas_trabajadas(t.inicio, coalesce(t.fin, now())))::numeric, 2) as horas,
    array_agg(pt.nombre order by t.inicio) filter (where t.fin is null) as en_play,
    bool_or(t.fin is null and t.usuario_id = (select auth.uid())) as yo_en_play,
    max(t.fin) as ultima_pausa,
    (array_agg(t.motivo_pausa order by t.fin desc) filter (where t.fin is not null))[1] as ultima_pausa_motivo,
    max(t.fin) filter (where t.usuario_id = (select auth.uid())) as mi_ultima_pausa
  from public.mantenimiento_tramos t join public.perfiles pt on pt.id = t.usuario_id
  where t.orden_id = o.id) tr on true;

-- ---------------------------------------------------------------- 2. criticidad calculada
alter table public.maquinas
  add column if not exists impacto_produccion smallint check (impacto_produccion between 0 and 3),
  add column if not exists riesgo_seguridad smallint check (riesgo_seguridad between 0 and 3),
  add column if not exists tiene_respaldo boolean,          -- null: la base lo busca (otra igual en su área)
  add column if not exists dias_refaccion int check (dias_refaccion >= 0),  -- null: lo de las refacciones
  add column if not exists criticidad_puntos smallint;

comment on column public.maquinas.impacto_produccion is '0 no afecta · 1 la hace más lenta · 2 detiene una parte · 3 para el área';
comment on column public.maquinas.riesgo_seguridad is '0 ninguno · 1 golpe o corte leve · 2 lesión que incapacita · 3 grave (eléctrico, atrapamiento, presión)';

-- Los seis factores, sus puntos y el nivel. Sin revisar permisos: la usan los disparadores y la
-- madrugada; la pantalla entra por criticidad_factores().
create or replace function public.criticidad_factores_interna(p_maquina uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare m maquinas; v_respaldo boolean; v_otra text; v_fallas int; v_costo numeric; v_dias int; v_dias_de text;
  p_imp int; p_seg int; p_fal int; p_cos int; p_ref int; v_imp_ef int; v_total int; v_nivel text;
begin
  select * into m from maquinas where id = p_maquina;
  if m.id is null then return null; end if;

  -- Respaldo: otra en operación de la misma categoría en la misma área (o sin área las dos).
  select x.numero into v_otra from maquinas x
  where x.id <> m.id and x.categoria = m.categoria and x.etapa_id is not distinct from m.etapa_id and x.estado <> 'baja'
  order by x.numero limit 1;
  v_respaldo := coalesce(m.tiene_respaldo, v_otra is not null);

  select count(*) into v_fallas from ordenes_mantenimiento
  where maquina_id = m.id and tipo = 'correctivo' and estado <> 'cancelada' and reportado_en > now() - interval '12 months';
  select coalesce(sum(k.monto), 0) into v_costo from costos_servicio k join ordenes_mantenimiento o on o.id = k.mantenimiento_id
  where o.maquina_id = m.id and o.estado <> 'cancelada' and o.reportado_en > now() - interval '12 months';

  -- Refacción: la más lenta de las que lleva su categoría (y modelo); importada sin dato = 60 días.
  if m.dias_refaccion is not null then v_dias := m.dias_refaccion; v_dias_de := 'captura';
  else
    select max(coalesce(a.tiempo_entrega_dias, p.dias_entrega, case when a.es_importado then 60 end)) into v_dias
    from refacciones_maquina r join articulos a on a.id = r.articulo_id left join proveedores p on p.id = a.proveedor_id
    where r.categoria = m.categoria and (r.modelo is null or r.modelo = m.modelo);
    v_dias_de := case when v_dias is null then 'sin_dato' else 'refacciones' end;
  end if;

  v_imp_ef := case when m.impacto_produccion is null then null else greatest(m.impacto_produccion - case when v_respaldo then 1 else 0 end, 0) end;
  p_imp := coalesce(v_imp_ef, 0) * 3;
  p_seg := coalesce(m.riesgo_seguridad, 0) * 3;
  p_fal := 2 * case when v_fallas >= 6 then 3 when v_fallas >= 3 then 2 when v_fallas >= 1 then 1 else 0 end;
  p_cos := case when v_costo >= 50000 then 3 when v_costo >= 15000 then 2 when v_costo >= 3000 then 1 else 0 end;
  p_ref := case when v_dias is null or v_dias <= 2 then 0 when v_dias <= 7 then 1 when v_dias <= 30 then 2 else 3 end;
  v_total := p_imp + p_seg + p_fal + p_cos + p_ref;
  v_nivel := case when v_total >= 20 then 'muy_alta' when v_total >= 14 then 'alta' when v_total >= 8 then 'media'
                  when v_total >= 4 then 'baja' else 'muy_baja' end;
  -- Lo grave no se promedia: un riesgo grave o una máquina que para el área sin respaldo es al menos alta.
  if (m.riesgo_seguridad = 3 or v_imp_ef = 3) and v_nivel in ('media', 'baja', 'muy_baja') then v_nivel := 'alta'; end if;

  return jsonb_build_object(
    'completa', m.impacto_produccion is not null and m.riesgo_seguridad is not null,
    'nivel', case when m.impacto_produccion is not null and m.riesgo_seguridad is not null then v_nivel end,
    'puntos', v_total, 'maximo', 30,
    'factores', jsonb_build_array(
      jsonb_build_object('clave', 'impacto', 'valor', m.impacto_produccion, 'efectivo', v_imp_ef, 'puntos', p_imp, 'maximo', 9, 'de', 'captura'),
      jsonb_build_object('clave', 'seguridad', 'valor', m.riesgo_seguridad, 'puntos', p_seg, 'maximo', 9, 'de', 'captura'),
      jsonb_build_object('clave', 'fallas', 'valor', v_fallas, 'puntos', p_fal, 'maximo', 6, 'de', 'ordenes'),
      jsonb_build_object('clave', 'costo', 'valor', case when v_costo >= 50000 then 'alto' when v_costo >= 15000 then 'medio'
                                                          when v_costo >= 3000 then 'bajo' else 'minimo' end, 'puntos', p_cos, 'maximo', 3, 'de', 'ordenes'),
      jsonb_build_object('clave', 'respaldo', 'valor', v_respaldo, 'con', case when m.tiene_respaldo is null then v_otra end,
                         'de', case when m.tiene_respaldo is null then 'calculado' else 'captura' end),
      jsonb_build_object('clave', 'refaccion', 'valor', v_dias, 'puntos', p_ref, 'maximo', 3, 'de', v_dias_de)));
end $$;
revoke execute on function public.criticidad_factores_interna(uuid) from public, anon, authenticated;

-- Security definer porque el costo de reparación sale de costos_servicio, que mantenimiento no
-- siempre ve: regresa el escalón (mínimo, bajo, medio, alto), nunca el monto.
create or replace function public.criticidad_factores(p_maquina uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not puede('mantenimiento', 1) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  return criticidad_factores_interna(p_maquina);
end $$;
revoke execute on function public.criticidad_factores(uuid) from public, anon;
grant execute on function public.criticidad_factores(uuid) to authenticated;

-- Guarda el nivel en la máquina (y con él «crítica») cuando ya tiene los dos factores capturados;
-- sin ellos no toca la de la hoja. Corre al editar la máquina, al reportar o cerrar una falla, al
-- cargar un costo y cada madrugada (la ventana de 12 meses se recorre sola).
create or replace function public.recalcular_criticidad(p_maquina uuid default null) returns int
language plpgsql security definer set search_path = public as $$
declare r record; f jsonb; v_n int := 0;
begin
  for r in select id from maquinas where (p_maquina is null or id = p_maquina)
             and impacto_produccion is not null and riesgo_seguridad is not null and estado <> 'baja' loop
    f := criticidad_factores_interna(r.id);
    update maquinas set criticidad = f->>'nivel', criticidad_puntos = (f->>'puntos')::int
    where id = r.id and (criticidad is distinct from f->>'nivel' or criticidad_puntos is distinct from (f->>'puntos')::int);
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;
revoke execute on function public.recalcular_criticidad(uuid) from public, anon, authenticated;

-- Al cambiar un factor, o lo que decide el respaldo (categoría, área, baja), se recalculan todas:
-- dar de baja la otra soldadora del área deja a esta sin respaldo.
create or replace function public.trg_criticidad_maquina() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' and (old.categoria, old.etapa_id, old.estado = 'baja') is not distinct from (new.categoria, new.etapa_id, new.estado = 'baja') then
    perform recalcular_criticidad(new.id);
  else
    perform recalcular_criticidad();
  end if;
  return null;
end $$;
drop trigger if exists criticidad on public.maquinas;
create trigger criticidad after insert or update of impacto_produccion, riesgo_seguridad, tiene_respaldo, dias_refaccion,
  categoria, etapa_id, modelo, estado on public.maquinas
  for each row when (pg_trigger_depth() < 1) execute function public.trg_criticidad_maquina();

create or replace function public.trg_criticidad_orden() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform recalcular_criticidad(new.maquina_id);
  return null;
end $$;
drop trigger if exists criticidad on public.ordenes_mantenimiento;
create trigger criticidad after insert or update of estado on public.ordenes_mantenimiento
  for each row when (new.tipo = 'correctivo') execute function public.trg_criticidad_orden();

create or replace function public.trg_criticidad_costo() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_maq uuid;
begin
  select maquina_id into v_maq from ordenes_mantenimiento where id = coalesce(case when tg_op = 'DELETE' then old.mantenimiento_id else new.mantenimiento_id end);
  if v_maq is not null then perform recalcular_criticidad(v_maq); end if;
  return null;
end $$;
drop trigger if exists criticidad on public.costos_servicio;
create trigger criticidad after insert or delete on public.costos_servicio
  for each row execute function public.trg_criticidad_costo();

do $$ begin
  perform cron.unschedule('criticidad-maquinas') where exists (select 1 from cron.job where jobname = 'criticidad-maquinas');
  -- 6:27 de Guadalajara, antes de los avisos de servicio.
  perform cron.schedule('criticidad-maquinas', '27 12 * * *', 'select public.recalcular_criticidad()');
exception when others then
  raise notice 'pg_cron no está disponible: la criticidad se recalcula al editar la máquina o sus órdenes (%).', sqlerrm;
end $$;

-- La ficha y la lista muestran los factores capturados y los puntos.
create or replace view public.v_maquinas with (security_invoker = true) as
with personal as (select * from public.personal_servicio())
select m.id, m.numero, m.nombre, m.tipo, m.categoria, m.marca, m.modelo, m.numero_serie, m.etapa_id, et.nombre as etapa,
  et.color as etapa_color, m.ubicacion, m.estado, m.critica, m.prestable, m.usa_horometro, m.horas_uso, m.horas_actualizado_en,
  m.foto_ruta, m.fecha_alta, m.notas,
  ab.id as orden_id, ab.folio as orden_folio, ab.tipo as orden_tipo, ab.estado as orden_estado, ab.falla as orden_falla,
  ab.reportado_en as orden_desde, ab.fuera_desde as parada_desde,
  (select count(*) from public.ordenes_mantenimiento o where o.maquina_id = m.id and o.estado in ('pendiente', 'en_proceso'))::int as ordenes_abiertas,
  (select count(*) from public.ordenes_mantenimiento o where o.maquina_id = m.id and o.tipo = 'correctivo' and o.estado <> 'cancelada'
     and o.reportado_en > now() - interval '12 months')::int as fallas_12m,
  coalesce((select round((sum(extract(epoch from coalesce(o.fuera_hasta, now()) - greatest(o.fuera_desde, now() - interval '12 months'))) / 3600.0)::numeric, 1)
            from public.ordenes_mantenimiento o where o.maquina_id = m.id and o.estado <> 'cancelada' and o.fuera_desde is not null
              and coalesce(o.fuera_hasta, now()) > now() - interval '12 months'), 0) as horas_paro_12m,
  (select max(o.reportado_en) from public.ordenes_mantenimiento o where o.maquina_id = m.id and o.tipo = 'correctivo' and o.estado <> 'cancelada') as ultima_falla,
  pv.proxima_fecha as preventivo_fecha, pv.proximas_horas as preventivo_horas, pv.nombre as preventivo, pv.situacion as preventivo_situacion,
  rg.id as resguardo_id, coalesce(pp.nombre, rg.persona) as prestada_a, rg.entregado_en as prestada_desde,
  m.criticidad, m.tipo_mantenimiento, m.especialidad, m.tipo_equipo, m.asignada_a, pa.nombre as asignada_nombre,
  m.baja_en, m.motivo_baja, pb.nombre as baja_por_nombre,
  m.impacto_produccion, m.riesgo_seguridad, m.tiene_respaldo, m.dias_refaccion, m.criticidad_puntos,
  m.impacto_produccion is not null and m.riesgo_seguridad is not null as criticidad_calculada
from public.maquinas m
left join public.etapas et on et.id = m.etapa_id
left join lateral (select o.* from public.ordenes_mantenimiento o where o.maquina_id = m.id and o.estado in ('pendiente', 'en_proceso')
                   order by (o.fuera_desde is not null and o.fuera_hasta is null) desc, o.reportado_en limit 1) ab on true
left join lateral (select v.* from public.v_planes_preventivos v where v.maquina_id = m.id and v.activo
                   order by case v.situacion when 'vencido' then 0 when 'por_vencer' then 1 else 2 end, v.proxima_fecha nulls last limit 1) pv on true
left join public.resguardos rg on rg.maquina_id = m.id and rg.devuelto_en is null
left join personal pp on pp.id = rg.empleado_id
left join personal pa on pa.id = m.asignada_a
left join public.perfiles pb on pb.id = m.baja_por;

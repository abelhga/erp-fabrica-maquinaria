-- =============================================================================
-- Tiempos de entrega: cuánto tarda cada equipo y cuándo sale de verdad.
--
-- Por qué: ventas prometía la fecha con el texto de la cotización ("45 días
-- hábiles") sin ver el taller, y el taller ya traía meses de trabajo encima. Los
-- equipos salían tarde aunque cada uno tardara lo de siempre: el problema no es
-- cuánto tarda un equipo, es la fila en la que entra.
--
-- 1. articulos.dias_fabricacion: días hábiles que tarda el equipo con el taller
--    libre. Se siembra con la tabla "Tiempos de entrega" de producción (y sus reglas:
--    elevador +2 días por metro desde 3 m, bazuca +3 por metro desde 10 m). La
--    gerencia de producción o ingeniería la ajusta por equipo.
-- 2. estimar_entrega(partidas): la fecha realista. El equipo nuevo entra al final de
--    la fila: a las horas que ya tiene cada etapa (órdenes planeadas, liberadas y en
--    proceso) se le suman las del equipo y se dividen entre la capacidad semanal. La
--    etapa que más tarda (el cuello de botella) manda. La fecha propuesta es la más
--    tardía entre esa y el tiempo estándar del equipo.
--    Ventas ve semanas y fechas, nunca horas ni costos de un equipo.
-- =============================================================================

alter table public.articulos add column if not exists dias_fabricacion int
  check (dias_fabricacion is null or dias_fabricacion between 1 and 365);
comment on column public.articulos.dias_fabricacion is
  'Días hábiles (lunes a viernes) que tarda el equipo con el taller libre. La fila del taller se suma aparte (estimar_entrega).';

-- Siembra con la tabla de producción (actualizada al 12 de octubre de 2026). Solo donde no hay dato.
with a as (
  select id, sin_acentos(nombre) n,
    nullif(substring(sin_acentos(nombre) from '([0-9]+(?:\.[0-9]+)?) ?(?:metros|mts|m)\M'), '')::numeric largo
  from public.articulos
  where tipo = 'equipo' and dias_fabricacion is null
    and not sin_acentos(nombre) ~ '(refacci|juego de cribas|cribas para|listado|reparaci|provisional|carro tolva)'
), r as (
  select id, case
    when n ~ '^banda granelera' then 46
    when n ~ '^banda (transportadora )?cargadora de 18" x 6\.6' then 46
    when n ~ '^banda (transportadora )?cargadora de 20" x 9\.6.*electr' then 50
    when n ~ '^banda (transportadora )?cargadora de 20" x 9\.6' then 49
    when n ~ '^banda pedestal|^pedestal' then 40
    when n ~ 'tipo artesa' then 60
    when n ~ 'rompesacos' then 48
    when n ~ 'bazuca' and n ~ '\m(8|10)"' and largo is not null then greatest(30, 48 + 3 * (largo - 10))::int
    when n ~ 'cribadora( o seleccionadora)? v3' then 45
    when n ~ 'zar 4|zar-4' then 55
    when n ~ 'zar 6|zar-6' then 59
    when n ~ 'cilindrica secuencial.*7 a 9|cil(indrica)? 7' then 62
    when n ~ 'cilindrica secuencial.*13 a 16|cil(indrica)? 13' then 66
    when n ~ '^elevador' and largo is not null then least(365, greatest(40, 52 + 2 * (largo - 3)))::int
    when n ~ 'zeus 15' then 50
    when n ~ 'zeus 30.*3 tolvas' then 65
    when n ~ 'zeus 30.*2 tolvas' then 45
    when n ~ 'thor 36' then 60
    when n ~ 'tolva.*\m5 metros cubicos|tolva de 5 m' then 55
  end dias from a
)
update public.articulos x set dias_fabricacion = r.dias from r where x.id = r.id and r.dias is not null;

create or replace function public.fijar_dias_fabricacion(p_articulo uuid, p_dias int) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not (puede('produccion', 3) or puede('costeo', 3)) then
    raise exception 'Solo la gerencia de producción o ingeniería cambia los días de fabricación' using errcode = '42501';
  end if;
  if p_dias is not null and (p_dias < 1 or p_dias > 365) then
    raise exception 'Los días de fabricación van de 1 a 365' using errcode = '22023';
  end if;
  update articulos set dias_fabricacion = p_dias, actualizado_en = now() where id = p_articulo and tipo in ('equipo', 'subensamble');
  if not found then raise exception 'No existe ese equipo' using errcode = '22023'; end if;
end $$;
revoke execute on function public.fijar_dias_fabricacion(uuid, int) from public, anon;
grant execute on function public.fijar_dias_fabricacion(uuid, int) to authenticated;

-- Las partidas que se fabrican (equipos y subensambles) de un [{"articulo_id", "cantidad"}].
create or replace function public.lineas_estimacion(p_lineas jsonb) returns table (art uuid, cant numeric)
language sql stable set search_path = public as $$
  select a.id, greatest(coalesce((x->>'cantidad')::numeric, 1), 0)
  from jsonb_array_elements(coalesce(p_lineas, '[]'::jsonb)) x
  join articulos a on a.id = (x->>'articulo_id')::uuid and a.tipo in ('equipo', 'subensamble')
  where coalesce(x->>'articulo_id', '') <> ''
$$;
revoke execute on function public.lineas_estimacion(jsonb) from public, anon, authenticated;

-- p_lineas: [{"articulo_id": "...", "cantidad": 2}, …]. Sin partidas, dice solo cómo está la fila.
create or replace function public.estimar_entrega(p_lineas jsonb default '[]'::jsonb) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_hoy date := hoy_planta();
  v_estandar int; v_sin_dias text[]; v_equipos int;
  v_etapas jsonb; v_cuello text; v_sem numeric; v_sem_cola numeric; v_cuello_cola text;
  v_dias_carga int; v_dias int;
begin
  if not (puede('ventas', 1) or puede('produccion', 1)) then
    raise exception 'Sin permiso para ver los tiempos de entrega' using errcode = '42501';
  end if;

  select count(*), max(a.dias_fabricacion), array_agg(a.nombre order by a.nombre) filter (where a.dias_fabricacion is null)
  into v_equipos, v_estandar, v_sin_dias
  from lineas_estimacion(p_lineas) l join articulos a on a.id = l.art;

  with recursive arbol(id, cant) as (
    select art, cant from lineas_estimacion(p_lineas)
    union all
    select b.hijo_id, arbol.cant * cantidad_linea(b) from arbol join bom_lineas b on b.padre_id = arbol.id
  ), nuevas as (
    select o.etapa_id, sum(arbol.cant * horas_operacion(o)) horas from arbol join bom_operaciones o on o.articulo_id = arbol.id group by 1
  ), cola as (
    select x.etapa_id, sum(x.horas_estimadas) horas
    from op_operaciones x join ordenes_produccion o on o.id = x.orden_id
    where o.estado in ('planeada', 'liberada', 'en_proceso') and x.estado <> 'terminada'
    group by 1
  ), e as (
    select et.nombre, et.orden, coalesce(c.horas, 0) / et.capacidad_horas_semana sem_cola,
      (coalesce(c.horas, 0) + coalesce(n.horas, 0)) / et.capacidad_horas_semana sem
    from etapas et left join cola c on c.etapa_id = et.id left join nuevas n on n.etapa_id = et.id
    where et.activa and et.capacidad_horas_semana > 0
  )
  select jsonb_agg(jsonb_build_object('etapa', nombre, 'semanas_cola', round(sem_cola, 1), 'semanas', round(sem, 1)) order by orden)
           filter (where sem > 0),
         (array_agg(nombre order by sem desc))[1], max(sem),
         (array_agg(nombre order by sem_cola desc))[1], max(sem_cola)
  into v_etapas, v_cuello, v_sem, v_cuello_cola, v_sem_cola
  from e;

  -- Semanas de lunes a viernes, igual que los "días hábiles" de las cotizaciones.
  v_dias_carga := case when v_equipos > 0 and v_sem > 0 then ceil(v_sem * 5)::int end;
  v_dias := nullif(greatest(coalesce(v_estandar, 0), coalesce(v_dias_carga, 0)), 0);

  return jsonb_build_object(
    'equipos', v_equipos,
    'dias_estandar', v_estandar,
    'fecha_estandar', case when v_estandar is not null then sumar_dias_habiles(v_hoy, v_estandar) end,
    'sin_dias', coalesce(to_jsonb(v_sin_dias), '[]'::jsonb),
    'dias_carga', v_dias_carga,
    'fecha_carga', case when v_dias_carga is not null then sumar_dias_habiles(v_hoy, v_dias_carga) end,
    'cuello', case when v_equipos > 0 then v_cuello else v_cuello_cola end,
    'semanas_cola', round(coalesce(v_sem_cola, 0), 1),
    'cuello_cola', v_cuello_cola,
    'dias_propuestos', v_dias,
    'fecha_propuesta', case when v_dias is not null then sumar_dias_habiles(v_hoy, v_dias) end,
    'etapas', coalesce(v_etapas, '[]'::jsonb));
end $$;
revoke execute on function public.estimar_entrega(jsonb) from public, anon;
grant execute on function public.estimar_entrega(jsonb) to authenticated;

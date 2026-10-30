-- =============================================================================
-- Especialidades dentro de un área de piso: la cuadrilla de cribadoras, la de dosificadoras…
--
-- Por qué: en Pailería no todos hacen todo. Luis organiza a su gente por equipo: quien sabe hacer
-- cribadoras no necesariamente sabe hacer dosificadoras. El plan del taller tomaba las horas de
-- Pailería como una sola bolsa, así que prometía las cribadoras abiertas como si las 17 personas
-- del área pudieran hacerlas a la vez, y el Gantt no decía qué cuadrilla las hace.
--
-- La regla:
--   * Una especialidad es de un área y dice qué familias de equipo hace (las categorías de los
--     equipos: Cribadora, Dosificadora…). Una familia es de una sola especialidad por área.
--   * Cada persona del área tiene a lo más una especialidad; sin especialidad, hace de todo.
--   * El plan reparte la capacidad del área según su gente: cada especialidad tiene la parte de
--     sus personas y lo demás es del área en general. Lo de una familia con especialidad lo hacen
--     su cuadrilla y la gente sin especialidad; lo que no es de ninguna especialidad lo hace
--     cualquiera del área.
--   * Sirve para planear y para el Gantt: no impide anotar a nadie en una etapa. En el piso manda
--     lo que decide la gerencia.
-- Nada es de Hegamex: las áreas, las especialidades y las familias son datos que cada taller pone.
-- =============================================================================

create table if not exists public.especialidades (
  id serial primary key,
  etapa_id int not null references public.etapas(id),
  nombre text not null check (length(trim(nombre)) between 2 and 60),
  creado_por uuid default auth.uid() references public.perfiles(id),
  creado_en timestamptz not null default now()
);
create unique index if not exists especialidades_nombre on public.especialidades (etapa_id, lower(trim(nombre)));
comment on table public.especialidades is
  'Cuadrillas por tipo de equipo dentro de un área de piso (p. ej. Pailería: cribadoras, dosificadoras). El plan del taller reparte la capacidad del área entre ellas.';

-- etapa_id va repetida para que la base cuide que una familia sea de una sola especialidad por área.
create table if not exists public.especialidad_categorias (
  especialidad_id int not null references public.especialidades(id) on delete cascade,
  etapa_id int not null,
  categoria_id int not null references public.categorias(id) on delete cascade,
  primary key (especialidad_id, categoria_id),
  unique (etapa_id, categoria_id)
);

alter table public.empleados add column if not exists especialidad_id int references public.especialidades(id) on delete set null;
comment on column public.empleados.especialidad_id is
  'Su especialidad dentro de su área de piso (su cuadrilla por tipo de equipo). Vacía: hace de todo.';

-- Lo leen quienes ven el taller; se escribe solo con las funciones de abajo.
alter table public.especialidades enable row level security;
alter table public.especialidad_categorias enable row level security;
drop policy if exists ver on public.especialidades;
create policy ver on public.especialidades for select to authenticated
  using ((select puede('produccion', 1)) or (select puede('procesos', 1)));
drop policy if exists ver on public.especialidad_categorias;
create policy ver on public.especialidad_categorias for select to authenticated
  using ((select puede('produccion', 1)) or (select puede('procesos', 1)));
revoke insert, update, delete, truncate on public.especialidades, public.especialidad_categorias from anon, authenticated;
drop trigger if exists auditar on public.especialidades;
create trigger auditar after insert or update or delete on public.especialidades for each row execute function public.auditar();

-- La especialidad es del área de la persona. Si la cambian de área, la pierde: en el área nueva
-- no existe. Elegir a mano una de otra área es un error y se dice cuál.
create or replace function public.trg_empleado_especialidad() returns trigger
language plpgsql set search_path = public as $$
declare v_etapa int; v_esp text; v_area text;
begin
  if new.especialidad_id is null then return new; end if;
  select etapa_id, nombre into v_etapa, v_esp from especialidades where id = new.especialidad_id;
  if v_etapa is not distinct from new.etapa_id then return new; end if;
  if tg_op = 'UPDATE' and old.especialidad_id is not distinct from new.especialidad_id then
    new.especialidad_id := null;
    return new;
  end if;
  select nombre into v_area from etapas where id = v_etapa;
  raise exception '«%» es de %: primero pon a % en esa área', v_esp, v_area, new.nombre;
end $$;
drop trigger if exists especialidad on public.empleados;
create trigger especialidad before insert or update of etapa_id, especialidad_id on public.empleados
  for each row execute function public.trg_empleado_especialidad();

-- Alta o cambio de una especialidad con sus familias. Solo la gerencia de producción (la que
-- acomoda a la gente en Cuadrillas).
create or replace function public.guardar_especialidad(p_id int, p_etapa int, p_nombre text, p_categorias int[])
returns int language plpgsql security definer set search_path = public as $$
declare v_id int := p_id; v_nombre text := nullif(trim(p_nombre), ''); v_choca text; v_cat text; v_actual int;
begin
  if not puede('produccion', 3) then
    raise exception 'Las especialidades las acomoda la gerencia de producción' using errcode = '42501';
  end if;
  if v_nombre is null then raise exception 'Ponle nombre a la especialidad (p. ej. «Cribadoras»)'; end if;
  if not exists (select 1 from etapas where id = p_etapa and activa) then raise exception 'Esa área no existe o está apagada'; end if;
  if v_id is not null then
    select etapa_id into v_actual from especialidades where id = v_id for update;
    if v_actual is null then raise exception 'Esa especialidad ya no existe'; end if;
    if v_actual <> p_etapa and exists (select 1 from empleados where especialidad_id = v_id) then
      raise exception 'Tiene gente asignada: para cambiarla de área, primero quítasela a sus personas';
    end if;
  end if;
  if exists (select 1 from especialidades where etapa_id = p_etapa and lower(trim(nombre)) = lower(v_nombre) and id is distinct from v_id) then
    raise exception 'Ya hay una especialidad «%» en esa área', v_nombre;
  end if;
  -- Una familia es de una sola especialidad por área: se dice con cuál choca.
  select e.nombre, c.nombre into v_choca, v_cat
  from especialidad_categorias ec join especialidades e on e.id = ec.especialidad_id join categorias c on c.id = ec.categoria_id
  where ec.etapa_id = p_etapa and ec.categoria_id = any(coalesce(p_categorias, '{}')) and ec.especialidad_id is distinct from v_id
  limit 1;
  if v_choca is not null then raise exception 'Los equipos «%» ya los hace «%»', v_cat, v_choca; end if;

  if v_id is null then
    insert into especialidades (etapa_id, nombre) values (p_etapa, v_nombre) returning id into v_id;
  else
    update especialidades set etapa_id = p_etapa, nombre = v_nombre where id = v_id;
  end if;
  delete from especialidad_categorias where especialidad_id = v_id;
  insert into especialidad_categorias (especialidad_id, etapa_id, categoria_id)
  select v_id, p_etapa, c from unnest(coalesce(p_categorias, '{}')) c group by c;
  return v_id;
end $$;
revoke execute on function public.guardar_especialidad(int, int, text, int[]) from public, anon;
grant execute on function public.guardar_especialidad(int, int, text, int[]) to authenticated;

-- Borrarla deja a su gente sin especialidad (hacen de todo) y a sus familias para cualquiera.
create or replace function public.borrar_especialidad(p_id int) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not puede('produccion', 3) then
    raise exception 'Las especialidades las acomoda la gerencia de producción' using errcode = '42501';
  end if;
  delete from especialidades where id = p_id;
end $$;
revoke execute on function public.borrar_especialidad(int) from public, anon;
grant execute on function public.borrar_especialidad(int) to authenticated;

-- La especialidad de una persona de Producción (como su área: la gerencia o RH).
create or replace function public.ajustar_especialidad(p_empleado uuid, p_especialidad int) returns void
language plpgsql security definer set search_path = public as $$
declare e empleados;
begin
  select * into e from empleados where id = p_empleado for update;
  if e.id is null then raise exception 'No existe esa persona'; end if;
  if not (puede('rrhh', 2) or (puede('produccion', 3) and e.departamento_id = departamento_produccion())) then
    raise exception 'La gerencia de producción solo acomoda a la gente de Producción' using errcode = '42501';
  end if;
  update empleados set especialidad_id = p_especialidad where id = p_empleado;
end $$;
revoke execute on function public.ajustar_especialidad(uuid, int) from public, anon;
grant execute on function public.ajustar_especialidad(uuid, int) to authenticated;

-- Las especialidades con sus familias, su gente y lo que les toca de su área a la semana. Lo ve
-- quien ve el taller (el número de personas no es un dato personal).
create or replace function public.especialidades_taller()
returns table (id int, etapa_id int, nombre text, categorias int[], familias text[], personas int, horas_semana numeric)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
begin
  if not (puede('produccion', 1) or puede('procesos', 1)) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  return query
  with gente as (
    select em.etapa_id, em.especialidad_id, count(*)::int n from empleados em
    where em.activo and em.en_cuadrillas and em.etapa_id is not null group by 1, 2
  ), area as (select g.etapa_id, sum(g.n)::int n from gente g group by 1)
  select e.id, e.etapa_id, e.nombre,
    coalesce((select array_agg(ec.categoria_id order by c.nombre) from especialidad_categorias ec join categorias c on c.id = ec.categoria_id where ec.especialidad_id = e.id), '{}'),
    coalesce((select array_agg(c.nombre order by c.nombre) from especialidad_categorias ec join categorias c on c.id = ec.categoria_id where ec.especialidad_id = e.id), '{}'),
    coalesce(g.n, 0),
    case when a.n > 0 then round(et.capacidad_horas_semana * coalesce(g.n, 0) / a.n, 1) else 0 end
  from especialidades e join etapas et on et.id = e.etapa_id
  left join gente g on g.etapa_id = e.etapa_id and g.especialidad_id = e.id
  left join area a on a.etapa_id = e.etapa_id
  order by et.orden, e.nombre;
end $$;
revoke execute on function public.especialidades_taller() from public, anon;
grant execute on function public.especialidades_taller() to authenticated;

-- Las familias que puede hacer una especialidad: las de los equipos y las de lo que ya se ha
-- fabricado con una orden (un subensamble que se manda al taller). Con permisos de quien pregunta.
create or replace function public.familias_taller()
returns table (id int, nombre text, articulos int)
language sql stable security invoker set search_path = public as $$
  select c.id, c.nombre, count(distinct a.id)::int
  from categorias c join articulos a on a.categoria_id = c.id and a.activo
  where a.tipo = 'equipo' or exists (select 1 from ordenes_produccion o where o.articulo_id = a.id)
  group by c.id, c.nombre
  order by c.nombre
$$;
revoke execute on function public.familias_taller() from public, anon;
grant execute on function public.familias_taller() to authenticated;

-- Las dos listas de gente de Cuadrillas, ahora con su especialidad (las de 155).
drop function if exists public.personal_de_piso();
create function public.personal_de_piso()
returns table (id uuid, nombre text, etapa_id int, trabajando_en text, tiempo_id uuid, especialidad_id int)
language plpgsql stable security definer set search_path = public as $$
begin
  if not puede('produccion', 2) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  return query
  select e.id, e.nombre, e.etapa_id, et.nombre || ' · ' || o.folio, t.id, e.especialidad_id
  from empleados e
  left join op_tiempos t on t.empleado_id = e.id and t.fin is null
  left join op_operaciones x on x.id = t.operacion_id
  left join etapas et on et.id = x.etapa_id
  left join ordenes_produccion o on o.id = t.orden_id
  where e.activo and (e.en_cuadrillas or t.id is not null)
  order by e.nombre;
end $$;
revoke execute on function public.personal_de_piso() from public, anon;
grant execute on function public.personal_de_piso() to authenticated;

drop function if exists public.personal_produccion();
create function public.personal_produccion()
returns table (id uuid, nombre text, puesto text, etapa_id int, en_cuadrillas boolean, trabajando_en text, especialidad_id int)
language plpgsql stable security definer set search_path = public as $$
begin
  if not (puede('produccion', 3) or puede('rrhh', 1)) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  return query
  select e.id, e.nombre, e.puesto, e.etapa_id, e.en_cuadrillas,
    (select et.nombre || ' · ' || o.folio from op_tiempos t join op_operaciones x on x.id = t.operacion_id
     join etapas et on et.id = x.etapa_id join ordenes_produccion o on o.id = t.orden_id
     where t.empleado_id = e.id and t.fin is null limit 1),
    e.especialidad_id
  from empleados e
  where e.activo and e.departamento_id = departamento_produccion()
  order by e.nombre;
end $$;
revoke execute on function public.personal_produccion() from public, anon;
grant execute on function public.personal_produccion() to authenticated;

-- El piso (la de 182) dice de qué especialidad es cada etapa: la tarjeta de Cuadrillas lo enseña.
create or replace view public.v_piso_operaciones with (security_invoker = true) as
SELECT x.id,
    x.orden_id,
    x.etapa_id,
    e.nombre AS etapa,
    e.color,
    e.orden AS etapa_orden,
    x.estado,
    x.horas_estimadas,
    x.inicio,
    x.fin,
    x.responsable,
    t.folio,
    t.numero_serie,
    t.clave,
    t.equipo,
    t.cliente,
    t.pedido_folio,
    t.prioridad,
    t.fecha_compromiso,
    t.dias_restantes,
    t.atrasada,
    t.avance,
    t.materiales_faltantes,
    t.estado AS orden_estado,
    ant.pendientes IS NULL AS lista,
    ant.pendientes AS espera_a,
    pr.nota AS ultimo_problema,
    pr.en AS ultimo_problema_en,
    x.turno,
    COALESCE(hh.horas, 0::numeric)::numeric(10,2) AS horas_reales,
        CASE
            WHEN x.estado = ANY (ARRAY['en_proceso'::estado_operacion, 'pausada'::estado_operacion]) THEN cuadrilla_de(x.id)
            ELSE NULL::text
        END AS cuadrilla,
    x.avance AS avance_etapa,
    x.estado = 'en_proceso'::estado_operacion AND (EXISTS ( SELECT 1 FROM op_tiempos ta WHERE ta.operacion_id = x.id AND ta.fin IS NULL)) AS con_tiempo,
    esp.id AS especialidad_id,
    esp.nombre AS especialidad
   FROM op_operaciones x
     JOIN etapas e ON e.id = x.etapa_id
     JOIN v_tablero_produccion t ON t.id = x.orden_id
     LEFT JOIN LATERAL ( SELECT string_agg(ey.nombre, ', '::text ORDER BY ey.orden) AS pendientes
           FROM op_operaciones y
             JOIN etapas ey ON ey.id = y.etapa_id
          WHERE y.orden_id = x.orden_id AND ey.orden < e.orden AND NOT e.en_paralelo AND y.estado <> 'terminada'::estado_operacion) ant ON true
     LEFT JOIN LATERAL ( SELECT ev.nota,
            ev.en
           FROM op_eventos ev
          WHERE ev.operacion_id = x.id AND ev.tipo = 'problema'::text
          ORDER BY ev.en DESC, ev.id DESC
         LIMIT 1) pr ON true
     LEFT JOIN LATERAL ( SELECT sum(horas_trabajadas(ti.inicio, COALESCE(ti.fin, now())) * ti.personas::numeric) AS horas
           FROM op_tiempos ti
          WHERE ti.operacion_id = x.id) hh ON true
     LEFT JOIN LATERAL ( SELECT es.id, es.nombre
           FROM ordenes_produccion oo
             JOIN articulos ar ON ar.id = oo.articulo_id
             JOIN especialidad_categorias ec ON ec.categoria_id = ar.categoria_id AND ec.etapa_id = x.etapa_id
             JOIN especialidades es ON es.id = ec.especialidad_id
          WHERE oo.id = x.orden_id) esp ON true
  WHERE (t.estado = ANY (ARRAY['liberada'::estado_op, 'en_proceso'::estado_op])) AND x.estado <> 'terminada'::estado_operacion AND NOT (EXISTS ( SELECT 1
           FROM ordenes_produccion oe
          WHERE oe.id = x.orden_id AND oe.en_espera_motivo IS NOT NULL));

-- El plan del taller (mismo cuerpo que en 181), con la capacidad de cada área repartida entre sus
-- especialidades. Cada etapa toma horas de las bolsas que le tocan, en orden:
--   de una familia con especialidad con gente: la de su especialidad y luego la general del área;
--   de las demás: la general y luego cualquiera de las especialidades del área.
-- Regresa además de qué especialidad es cada etapa, para agruparlas en el Gantt.
drop function if exists public.plan_produccion();
create function public.plan_produccion()
returns table (operacion_id uuid, orden_id uuid, etapa_id int, estado estado_operacion, horas_estimadas numeric,
               horas_restantes numeric, gente int, inicio_real timestamptz, fin_real timestamptz,
               inicio_plan date, fin_plan date, posicion int, especialidad_id int)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare
  v_hoy date := hoy_mx();
  v_dia date;
  -- Arreglos de las etapas por planear, en el orden en que el taller las toma.
  a_op uuid[]; a_et int[]; a_rem numeric[]; a_rate numeric[]; a_ini date[]; a_fin date[]; a_activa boolean[]; a_esp int[];
  -- Lo que espera cada etapa, en un solo arreglo: a_pp[a_pp_ini[i] .. a_pp_fin[i]].
  a_pp int[] := '{}'; a_pp_ini int[]; a_pp_fin int[]; v_espera boolean;
  -- Las bolsas de horas (un área, o una especialidad de un área) y de cuáles toma cada etapa: a_bb[a_bb_ini[i] .. a_bb_fin[i]].
  b_et int[]; b_esp int[]; b_cap numeric[]; v_disp numeric[];
  a_bb int[] := '{}'; a_bb_ini int[]; a_bb_fin int[]; v_gen int;
  n int; i int; k int; v_pend int; v_toma numeric; v_lim numeric; v_t numeric; v_horas boolean;
  v_jor numeric; v_sem numeric := horas_semana_taller();
begin
  -- Las fechas las ve quien ve producción (el vendedor, en su pedido); las horas, solo la planta.
  if not (puede('produccion', 1) or puede('procesos', 1)) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  v_horas := puede('produccion', 2) or puede('procesos', 1);

  -- La especialidad de cada etapa abierta: la de la familia de su equipo en esa área.
  drop table if exists _esp;
  create temp table _esp on commit drop as
  select x.id op, ec.especialidad_id esp
  from op_operaciones x join ordenes_produccion o on o.id = x.orden_id join articulos ar on ar.id = o.articulo_id
  join especialidad_categorias ec on ec.categoria_id = ar.categoria_id and ec.etapa_id = x.etapa_id
  where o.estado in ('planeada', 'liberada', 'en_proceso');

  -- Las bolsas. Un área sin gente (Pruebas, Embarque) es una sola bolsa con toda su capacidad; con
  -- gente, cada especialidad se lleva la parte de sus personas y la general la de los demás.
  drop table if exists _bolsa;
  create temp table _bolsa on commit drop as
  with g as (
    select em.etapa_id, em.especialidad_id, count(*) n from empleados em
    where em.activo and em.en_cuadrillas and em.etapa_id is not null group by 1, 2
  ), a as (select g.etapa_id, sum(g.n) n from g group by 1)
  select row_number() over (order by et.orden, x.esp nulls first)::int b, et.id etapa_id, x.esp, x.cap
  from etapas et left join a on a.etapa_id = et.id
  cross join lateral (
    select null::int esp,
      et.capacidad_horas_semana * case when a.n is null then 1
        else coalesce((select g.n from g where g.etapa_id = et.id and g.especialidad_id is null), 0)::numeric / a.n end cap
    union all
    select g.especialidad_id, et.capacidad_horas_semana * g.n / a.n
    from g where g.etapa_id = et.id and g.especialidad_id is not null
  ) x
  where et.activa and et.capacidad_horas_semana > 0;
  -- Lo que da cada bolsa en un día es su parte de la semana (un sábado de 6 h, lo suyo).
  select array_agg(etapa_id order by b), array_agg(esp order by b), array_agg(cap / nullif(v_sem, 0) order by b)
  into b_et, b_esp, b_cap from _bolsa;

  -- Lo pendiente de las órdenes abiertas, con lo que falta y la velocidad de su cuadrilla.
  drop table if exists _plan;
  create temp table _plan on commit drop as
  with ops as (
    select x.id, x.orden_id, x.etapa_id, et.orden etapa_orden, x.estado, x.horas_estimadas, x.turno, x.avance,
      o.prioridad, o.fecha_compromiso, o.folio, et.en_paralelo paralela, s.esp,
      coalesce((select sum(horas_trabajadas(t.inicio, coalesce(t.fin, now())) * t.personas) from op_tiempos t where t.operacion_id = x.id), 0) hh,
      greatest((select count(*) from op_asignaciones a where a.operacion_id = x.id),
               (select coalesce(sum(t.personas), 0) from op_tiempos t where t.operacion_id = x.id and t.fin is null))::int gente
    from op_operaciones x join ordenes_produccion o on o.id = x.orden_id join etapas et on et.id = x.etapa_id
    left join _esp s on s.op = x.id
    where o.estado in ('planeada', 'liberada', 'en_proceso') and o.en_espera_motivo is null and x.estado <> 'terminada'
      and et.activa and et.capacidad_horas_semana > 0
  )
  select ops.*,
    -- Lo que falta: si el piso dijo cuánto lleva, eso manda; si no, lo estimado menos lo marcado.
    case when estado not in ('en_proceso', 'pausada') then horas_estimadas
         when avance is not null then greatest(horas_estimadas * (1 - avance), horas_estimadas * 0.05)
         else greatest(horas_estimadas - hh, horas_estimadas * 0.15) end rem,
    row_number() over (order by (estado in ('en_proceso', 'pausada')) desc, turno nulls last, prioridad, fecha_compromiso nulls last, folio, etapa_orden) n
  from ops;

  -- El renglón de cada orden: el turno de la etapa en la que va (la primera sin terminar).
  drop table if exists _pos;
  create temp table _pos on commit drop as
  select o.id orden_id, row_number() over (order by
      (select x.turno from op_operaciones x join etapas et on et.id = x.etapa_id
       where x.orden_id = o.id and x.estado <> 'terminada' order by et.orden limit 1) nulls last,
      o.prioridad, o.fecha_compromiso nulls last, o.folio)::int posicion
  from ordenes_produccion o
  where o.estado in ('planeada', 'liberada', 'en_proceso') and o.en_espera_motivo is null;

  select array_agg(id order by n), array_agg(etapa_id order by n), array_agg(rem order by n),
         array_agg(greatest(gente, 2)::numeric order by n),
         array_agg(estado in ('en_proceso', 'pausada') order by n), array_agg(esp order by n)
  into a_op, a_et, a_rem, a_rate, a_activa, a_esp from _plan;
  n := coalesce(array_length(a_op, 1), 0);
  a_ini := array_fill(null::date, array[greatest(n, 1)]);
  a_fin := array_fill(null::date, array[greatest(n, 1)]);
  -- Una etapa espera a todas las anteriores pendientes de su orden, salvo la que va en paralelo
  -- (Torno): esa arranca sin esperar, y las que siguen sí la esperan a ella.
  a_pp_ini := array_fill(1, array[greatest(n, 1)]);
  a_pp_fin := array_fill(0, array[greatest(n, 1)]);
  a_bb_ini := array_fill(1, array[greatest(n, 1)]);
  a_bb_fin := array_fill(0, array[greatest(n, 1)]);
  for i in 1..n loop
    a_pp_ini[i] := coalesce(array_length(a_pp, 1), 0) + 1;
    -- p2.n es la posición en los arreglos (están en el mismo orden que n).
    a_pp := a_pp || coalesce((select array_agg(p2.n::int) from _plan p1 join _plan p2 on p2.orden_id = p1.orden_id and p2.etapa_orden < p1.etapa_orden
                              where p1.id = a_op[i] and not p1.paralela), '{}'::int[]);
    a_pp_fin[i] := coalesce(array_length(a_pp, 1), 0);
    -- Sin horas que hacer: queda lista en cuanto puede empezar.
    if a_rem[i] <= 0 then a_rem[i] := 0; end if;
    -- De qué bolsas toma: su especialidad (si tiene gente) y la general; si no, la general y las demás.
    a_bb_ini[i] := coalesce(array_length(a_bb, 1), 0) + 1;
    select b into v_gen from _bolsa where etapa_id = a_et[i] and esp is null;
    if a_esp[i] is not null and exists (select 1 from _bolsa where etapa_id = a_et[i] and esp = a_esp[i]) then
      a_bb := a_bb || array[(select b from _bolsa where etapa_id = a_et[i] and esp = a_esp[i]), v_gen];
    else
      a_bb := a_bb || v_gen || coalesce((select array_agg(b order by b) from _bolsa where etapa_id = a_et[i] and esp is not null), '{}'::int[]);
    end if;
    a_bb_fin[i] := coalesce(array_length(a_bb, 1), 0);
  end loop;

  v_pend := n;
  v_dia := v_hoy;
  while v_pend > 0 and v_dia < v_hoy + 730 loop
    -- Un día cuenta lo que dura su jornada en el horario del taller (0 si no se trabaja).
    v_jor := horas_jornada(v_dia);
    if v_jor > 0 then
      v_disp := array(select c * v_jor from unnest(b_cap) with ordinality u(c, pos) order by u.pos);
      for i in 1..n loop
        continue when a_fin[i] is not null;
        -- Puede trabajarse si ya está en proceso o si lo que espera terminó antes de hoy.
        if not a_activa[i] then
          v_espera := false;
          for k in a_pp_ini[i]..a_pp_fin[i] loop
            if a_fin[a_pp[k]] is null or a_fin[a_pp[k]] >= v_dia then v_espera := true; exit; end if;
          end loop;
          continue when v_espera;
        end if;
        if a_rem[i] <= 0 then
          a_ini[i] := coalesce(a_ini[i], v_dia); a_fin[i] := v_dia; v_pend := v_pend - 1;
          continue;
        end if;
        -- Lo que puede avanzar hoy su cuadrilla, tomado de sus bolsas en orden.
        v_lim := least(a_rem[i], a_rate[i] * v_jor);
        v_toma := 0;
        for k in a_bb_ini[i]..a_bb_fin[i] loop
          exit when v_lim - v_toma <= 0.0001;
          continue when a_bb[k] is null or v_disp[a_bb[k]] <= 0;
          v_t := least(v_lim - v_toma, v_disp[a_bb[k]]);
          v_disp[a_bb[k]] := v_disp[a_bb[k]] - v_t;
          v_toma := v_toma + v_t;
        end loop;
        continue when v_toma <= 0;
        a_rem[i] := a_rem[i] - v_toma;
        a_ini[i] := coalesce(a_ini[i], v_dia);
        if a_rem[i] <= 0.0001 then a_fin[i] := v_dia; v_pend := v_pend - 1; end if;
      end loop;
    end if;
    v_dia := v_dia + 1;
  end loop;

  return query
  select z.operacion_id, z.orden_id, z.etapa_id, z.estado,
    case when v_horas then z.horas_estimadas end, case when v_horas then z.horas_restantes end, case when v_horas then z.gente end,
    z.inicio_real, z.fin_real, z.inicio_plan, z.fin_plan, z.posicion, s.esp
  from (
  -- Lo planeado.
  select p.id, p.orden_id, p.etapa_id, p.estado, p.horas_estimadas, round(p.rem, 1), greatest(p.gente, 0),
    x.inicio, null::timestamptz, a_ini[p.n::int], a_fin[p.n::int], s.posicion
  from _plan p join op_operaciones x on x.id = p.id left join _pos s on s.orden_id = p.orden_id
  union all
  -- Lo ya terminado de las órdenes abiertas (para dibujar lo que ya pasó).
  select x.id, x.orden_id, x.etapa_id, x.estado, x.horas_estimadas, 0::numeric, 0, x.inicio, x.fin, null::date, null::date, s.posicion
  from op_operaciones x join ordenes_produccion o on o.id = x.orden_id left join _pos s on s.orden_id = o.id
  where o.estado in ('planeada', 'liberada', 'en_proceso') and x.estado = 'terminada'
  union all
  -- Las órdenes en espera: sus etapas, sin plan ni renglón (van al final).
  select x.id, x.orden_id, x.etapa_id, x.estado, x.horas_estimadas, x.horas_estimadas, 0, x.inicio, x.fin, null::date, null::date, null::int
  from op_operaciones x join ordenes_produccion o on o.id = x.orden_id
  where o.estado in ('planeada', 'liberada', 'en_proceso') and o.en_espera_motivo is not null and x.estado <> 'terminada'
  ) z (operacion_id, orden_id, etapa_id, estado, horas_estimadas, horas_restantes, gente, inicio_real, fin_real, inicio_plan, fin_plan, posicion)
  left join _esp s on s.op = z.operacion_id;
end $$;
revoke execute on function public.plan_produccion() from public, anon;
grant execute on function public.plan_produccion() to authenticated;

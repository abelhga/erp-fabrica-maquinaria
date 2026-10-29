-- =============================================================================
-- Vacaciones por periodo, con el adelanto marcado.
--
-- Por qué: el saldo del ERP no cuadraba con el control de vacaciones de Margarita. La hoja
-- carga cada vacación a un «año de vacaciones» y, cuando alguien ya se acabó lo suyo, la anota
-- como «proporcional» del periodo siguiente (un adelanto). El ERP contaba solo desde el último
-- aniversario: al cumplir año perdonaba el adelanto, tiraba lo que sobraba y borraba el saldo con
-- que la persona arrancó en el ERP. A Emmanuel, por ejemplo, el 2-nov le habría subido de 12 a 16.
--
-- La regla (elegida por dirección: «por periodo, con adelanto marcado»):
--   * Periodo n = los días que da la ley al cumplir n años (dias_vacaciones(n)). Empieza en ese
--     aniversario y vence 18 meses después: 6 meses para darlas (art. 81 LFT) y un año más en que
--     prescriben (art. 516). Lo que no se tomó para entonces caduca.
--   * Cada vacación aprobada se carga, por orden de fecha, al periodo más viejo que siga vigente
--     ese día y tenga días. Si no alcanza, lo que falta se carga al periodo que todavía no empieza:
--     eso es un adelanto, y se descuenta de ese periodo cuando llegue (no se perdona).
--   * El saldo de arranque dice de qué periodo es: «al <fecha>, del periodo n le quedaban s días».
--     Los periodos anteriores se dan por usados y lo tomado antes de esa fecha ya está en la hoja.
--
-- No se guarda a qué periodo se cargó cada vacación: se calcula siempre igual (vacaciones_cargos),
-- así cancelar, corregir o capturar tarde una vacación vieja reacomoda todo sin dejar basura.
-- =============================================================================

alter table public.vacaciones_arranque add column if not exists periodo int check (periodo >= 1);
-- Los arranques que ya había eran «lo que le quedaba ese día» del periodo que corría: se les pone
-- ese periodo, así el saldo de hoy no cambia. Si la hoja ya iba en el siguiente, se corrige con
-- «Corregir saldo» eligiendo el periodo (o en la recarga del control de vacaciones).
update public.vacaciones_arranque va set periodo = greatest(1, extract(year from age(va.fecha, e.fecha_ingreso))::int)
from public.empleados e where e.id = va.empleado_id and va.periodo is null;
alter table public.vacaciones_arranque alter column periodo set not null;

-- Quien captura un arranque sin decir el periodo (la pantalla de antes, un script) se refiere al
-- que corría ese día.
create or replace function public.vacaciones_arranque_periodo() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.periodo is null then
    select greatest(1, extract(year from age(new.fecha, e.fecha_ingreso))::int) into new.periodo from empleados e where e.id = new.empleado_id;
  end if;
  return new;
end $$;
drop trigger if exists periodo on public.vacaciones_arranque;
create trigger periodo before insert or update on public.vacaciones_arranque for each row execute function public.vacaciones_arranque_periodo();

-- Desde cuándo lleva el ERP las vacaciones (el día que se cargó el control de Margarita). De quien
-- no tiene saldo de arranque, el ERP no sabe qué tomó antes: los periodos anteriores al que corría
-- ese día se dan por usados, como hacía la regla de antes.
insert into public.configuracion (clave, valor, descripcion)
values ('vacaciones_corte', to_jsonb(coalesce((select min(fecha) from public.vacaciones_arranque), current_date)::text),
  'Vacaciones: día desde el que el ERP lleva el control. Sin saldo de arranque, lo anterior se da por usado.')
on conflict (clave) do nothing;
create or replace function public.vacaciones_corte() returns date
language sql stable security definer set search_path = public as $$
  select coalesce((select (valor #>> '{}')::date from configuracion where clave = 'vacaciones_corte'), current_date)
$$;

create or replace function public.vacaciones_inicio_periodo(p_ingreso date, p_periodo int) returns date
language sql immutable as $$ select (p_ingreso + make_interval(years => p_periodo))::date $$;
create or replace function public.vacaciones_vence(p_ingreso date, p_periodo int) returns date
language sql immutable as $$ select (p_ingreso + make_interval(years => p_periodo, months => 18))::date $$;

-- A qué periodo se carga cada vacación aprobada (una vacación puede partirse entre dos). Con los
-- permisos de quien pregunta: el empleado ve las suyas, RRHH las de todos.
create or replace function public.vacaciones_cargos(p_empleado uuid)
returns table (incidencia_id uuid, inicio date, periodo int, dias numeric, adelanto boolean)
language plpgsql stable security invoker set search_path = public as $$
#variable_conflict use_column
declare
  v_ingreso date; a record; v record; v_hasta date;
  n_max int; rem numeric[]; ini date[]; ven date[]; falta numeric; toma numeric; k int;
begin
  select e.fecha_ingreso into v_ingreso from empleados e where e.id = p_empleado;
  if v_ingreso is null then return; end if;
  select va.fecha, va.periodo, va.saldo into a from vacaciones_arranque va where va.empleado_id = p_empleado;
  if a.periodo is null then
    -- Sin arranque: el periodo que corría en el corte, completo; los de antes, usados; todas sus vacaciones cuentan.
    select null::date fecha, greatest(1, extract(year from age(vacaciones_corte(), v_ingreso))::int) periodo, null::numeric saldo into a;
    a.saldo := dias_vacaciones(a.periodo);
  end if;
  select greatest(current_date, coalesce(max(i.fin), current_date)) into v_hasta
  from incidencias i where i.empleado_id = p_empleado and i.tipo = 'vacaciones';
  n_max := extract(year from age(v_hasta, v_ingreso))::int + 3;
  for k in 1..n_max loop
    ini[k] := vacaciones_inicio_periodo(v_ingreso, k);
    ven[k] := vacaciones_vence(v_ingreso, k);
    rem[k] := case when k > a.periodo then dias_vacaciones(k)
                   when k = a.periodo then a.saldo else 0 end;
  end loop;
  for v in
    select i.id, i.inicio, i.dias from incidencias i
    where i.empleado_id = p_empleado and i.tipo = 'vacaciones' and i.estado = 'aprobada'
      and (a.fecha is null or i.inicio >= a.fecha)
    order by i.inicio, i.creado_en
  loop
    falta := v.dias;
    -- Lo que ya le tocó y sigue vigente ese día, del periodo más viejo al más nuevo.
    for k in 1..n_max loop
      exit when falta <= 0;
      if ini[k] <= v.inicio and v.inicio < ven[k] and rem[k] > 0 then
        toma := least(falta, rem[k]); rem[k] := rem[k] - toma; falta := falta - toma;
        incidencia_id := v.id; inicio := v.inicio; periodo := k; dias := toma; adelanto := false; return next;
      end if;
    end loop;
    -- Adelanto: de los periodos que todavía no empiezan, el más cercano primero.
    for k in 1..n_max loop
      exit when falta <= 0;
      if ini[k] > v.inicio and rem[k] > 0 then
        toma := least(falta, rem[k]); rem[k] := rem[k] - toma; falta := falta - toma;
        incidencia_id := v.id; inicio := v.inicio; periodo := k; dias := toma; adelanto := true; return next;
      end if;
    end loop;
    -- Ya adelantó todo lo que hay a la vista (no debería pasar): el siguiente periodo queda en negativo.
    if falta > 0 then
      select min(x) into k from generate_series(1, n_max) x where ini[x] > v.inicio;
      k := coalesce(k, n_max);
      rem[k] := rem[k] - falta;
      incidencia_id := v.id; inicio := v.inicio; periodo := k; dias := falta; adelanto := true; return next;
    end if;
  end loop;
end $$;
revoke execute on function public.vacaciones_cargos(uuid) from public, anon;
grant execute on function public.vacaciones_cargos(uuid) to authenticated;

-- Cada periodo de la persona: cuándo empieza y vence, cuántos días da, cuántos se usaron (lo del
-- arranque más lo cargado en el ERP), cuántos de esos fueron adelanto y cuántos quedan.
create or replace function public.vacaciones_periodos(p_empleado uuid)
returns table (periodo int, desde date, vence date, dias int, usados numeric, adelantados numeric, restan numeric, estado text)
language plpgsql stable security invoker set search_path = public as $$
#variable_conflict use_column
declare v_ingreso date; a record; c record; n_max int; k int; u numeric[]; ad numeric[];
begin
  select e.fecha_ingreso into v_ingreso from empleados e where e.id = p_empleado;
  if v_ingreso is null then return; end if;
  select va.fecha, va.periodo, va.saldo into a from vacaciones_arranque va where va.empleado_id = p_empleado;
  if a.periodo is null then
    select null::date fecha, greatest(1, extract(year from age(vacaciones_corte(), v_ingreso))::int) periodo, null::numeric saldo into a;
    a.saldo := dias_vacaciones(a.periodo);
  end if;
  n_max := extract(year from age(current_date, v_ingreso))::int + 1;
  for c in select * from vacaciones_cargos(p_empleado) loop
    n_max := greatest(n_max, c.periodo);
    u[c.periodo] := coalesce(u[c.periodo], 0) + c.dias;
    if c.adelanto then ad[c.periodo] := coalesce(ad[c.periodo], 0) + c.dias; end if;
  end loop;
  for k in 1..n_max loop
    periodo := k;
    desde := vacaciones_inicio_periodo(v_ingreso, k);
    vence := vacaciones_vence(v_ingreso, k);
    dias := dias_vacaciones(k);
    -- Lo que dice el arranque: los periodos anteriores, usados; el suyo, lo que ya no le quedaba.
    usados := case when k > a.periodo then 0 when k = a.periodo then dias_vacaciones(k) - a.saldo else dias_vacaciones(k) end
              + coalesce(u[k], 0);
    -- Adelanto: lo cargado antes de que empezara el periodo, incluido lo que el arranque ya traía
    -- usado de un periodo que todavía no empezaba (la hoja lo anotaba como «proporcional»).
    adelantados := coalesce(ad[k], 0) + case when k = a.periodo and a.fecha < desde then dias_vacaciones(k) - a.saldo else 0 end;
    restan := dias - usados;
    estado := case when desde > current_date then 'por_venir' when vence <= current_date then 'vencido' else 'vigente' end;
    return next;
  end loop;
end $$;
revoke execute on function public.vacaciones_periodos(uuid) from public, anon;
grant execute on function public.vacaciones_periodos(uuid) to authenticated;

-- El resumen de cada quien. Las columnas de antes siguen diciendo lo mismo (del periodo que
-- corre); se agregan lo disponible hoy, lo adelantado y lo que está por vencer.
--   disponible  = lo que queda de los periodos vigentes
--   adelantados = lo ya tomado a cuenta de periodos que todavía no empiezan
--   saldo       = disponible − adelantados (negativo = debe días al periodo siguiente)
drop view if exists public.v_vacaciones;
create view public.v_vacaciones with (security_invoker = true) as
select e.id empleado_id, e.nombre, e.fecha_ingreso, x.anios,
  dias_vacaciones(x.anios) as dias_periodo,
  x.inicio_periodo,
  coalesce(r.usados_actual, 0) as tomados,
  coalesce(r.disponible, 0) - coalesce(r.adelantados, 0) as saldo,
  (x.inicio_periodo + interval '1 year')::date as proximo_aniversario,
  dias_vacaciones(x.anios + 1) as dias_proximo_periodo,
  t.solicitados,
  (x.inicio_periodo + interval '6 months')::date as disfrutar_antes_de,    -- art. 81: dentro de los 6 meses siguientes
  a.saldo as saldo_arranque, a.fecha as fecha_arranque, a.periodo as periodo_arranque,
  coalesce(r.disponible, 0) as disponible,
  coalesce(r.adelantados, 0) as adelantados,
  r.vence_primero, r.dias_vence_primero
from public.empleados e
cross join lateral (
  select extract(year from age(current_date, e.fecha_ingreso))::int anios,
         (e.fecha_ingreso + make_interval(years => extract(year from age(current_date, e.fecha_ingreso))::int))::date inicio_periodo
) x
left join public.vacaciones_arranque a on a.empleado_id = e.id
cross join lateral (
  select sum(p.restan) filter (where p.estado = 'vigente' and p.restan > 0) disponible,
         sum(p.adelantados) filter (where p.estado = 'por_venir') adelantados,
         min(p.vence) filter (where p.estado = 'vigente' and p.restan > 0) vence_primero,
         (array_agg(p.restan order by p.vence) filter (where p.estado = 'vigente' and p.restan > 0))[1] dias_vence_primero,
         max(p.usados) filter (where p.periodo = x.anios) usados_actual
  from vacaciones_periodos(e.id) p
) r
cross join lateral (
  select coalesce(sum(i.dias) filter (where i.estado = 'solicitada'), 0) solicitados
  from public.incidencias i where i.empleado_id = e.id and i.tipo = 'vacaciones'
) t
where e.activo;

-- Guardar el corte de vacaciones no recalcula el costeo: 194 ya se salta las claves «vacaciones%».

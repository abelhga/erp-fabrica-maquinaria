-- =============================================================================
-- La capacidad de cada área del taller se calcula sola con la gente asignada.
--
-- Pailería tenía 400 h a la semana (unas 9 personas) con 17 asignadas, y Detallado 135 (3) con
-- 2: el número se puso a mano al arrancar y nadie lo movió cuando cambió la gente. El plan del
-- taller, la fecha realista de entrega y la carga por semana lo usan, así que prometían fechas
-- con un taller que no existe. En las áreas marcadas «automática»:
--   capacidad = personas del área que entran a cuadrillas × horas de la semana del taller × aprovechamiento
-- redondeada a 5. El aprovechamiento (85 %) descuenta faltas, vacaciones, limpieza y esperas.
-- Las horas de las recetas son de todos los que trabajan (soldadores y ayudantes), por eso
-- cuenta a toda la gente del área.
-- Se recalcula sola cuando cambia la gente (área, cuadrillas, alta o baja), el horario del taller
-- o el aprovechamiento. Las áreas sin gente fija (Pruebas, Embarque) siguen a mano. Todo lo que
-- lee etapas.capacidad_horas_semana (plan, entregas, carga, análisis) sigue igual.
-- =============================================================================

-- Guardar el aprovechamiento no recalcula el costeo (el recálculo borra y rehace precios_lista).
create or replace function public.disparar_recalculo_config() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from nuevos n join viejos v on v.clave = n.clave
             where n.valor is distinct from v.valor and n.clave <> 'horas_taller' and n.clave not like 'mercadolibre%'
               and n.clave not like 'almacen%' and n.clave not like 'vacaciones%' and n.clave not like 'taller%') then
    perform recalcular_costos();
  end if;
  return null;
end $$;

alter table public.etapas add column if not exists capacidad_automatica boolean not null default false;
comment on column public.etapas.capacidad_automatica is
  'La capacidad la calcula el ERP con la gente del área (personas × horas de la semana × aprovechamiento); si no, se pone a mano.';

insert into public.configuracion (clave, valor, descripcion) values
  ('taller_capacidad', '{"aprovechamiento": 0.85}',
   'Qué parte de las horas de la gente se dedica a órdenes, para calcular la capacidad de cada área del taller.')
on conflict (clave) do nothing;

create or replace function public.aprovechamiento_taller() returns numeric
language sql stable security definer set search_path = public as $$
  select coalesce((select (valor->>'aprovechamiento')::numeric from configuracion where clave = 'taller_capacidad'), 0.85)
$$;
grant execute on function public.aprovechamiento_taller() to authenticated;

-- Lo que daría cada área con su gente, sea automática o no (la pantalla enseña las dos).
create or replace function public.capacidad_calculada()
returns table (etapa_id int, personas int, calculada numeric)
language sql stable security definer set search_path = public as $$
  select et.id, count(em.id)::int, round(count(em.id) * horas_semana_taller() * aprovechamiento_taller() / 5) * 5
  from etapas et left join empleados em on em.etapa_id = et.id and em.activo and em.en_cuadrillas
  group by et.id
$$;
revoke execute on function public.capacidad_calculada() from public, anon;

create or replace function public.recalcular_capacidad_taller() returns void
language plpgsql security definer set search_path = public as $$
begin
  -- Un área automática que se queda sin gente conserva su último número: con cero horas el plan
  -- la sacaría del recorrido y prometería como si no existiera.
  perform set_config('app.capacidad_automatica', 'si', true);
  update etapas e set capacidad_horas_semana = c.calculada
  from capacidad_calculada() c
  where c.etapa_id = e.id and e.capacidad_automatica and c.personas > 0 and e.capacidad_horas_semana is distinct from c.calculada;
  perform set_config('app.capacidad_automatica', '', true);
end $$;
revoke execute on function public.recalcular_capacidad_taller() from public, anon;

create or replace function public.disparar_capacidad_taller() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform recalcular_capacidad_taller();
  return null;
end $$;

-- A mano no se cambia la capacidad de un área automática: la siguiente vez que alguien cambiara
-- de área se borraría sin aviso.
create or replace function public.capacidad_automatica_a_mano() returns trigger
language plpgsql as $$
begin
  if new.capacidad_automatica and new.capacidad_horas_semana is distinct from old.capacidad_horas_semana
     and coalesce(current_setting('app.capacidad_automatica', true), '') <> 'si' then
    raise exception 'La capacidad de % se calcula sola con su gente: apaga «Automática» para ponerla a mano', new.nombre
      using errcode = '23514';
  end if;
  return new;
end $$;

drop trigger if exists capacidad_a_mano on public.etapas;
create trigger capacidad_a_mano before update of capacidad_horas_semana on public.etapas
  for each row execute function public.capacidad_automatica_a_mano();
drop trigger if exists capacidad_por_gente on public.empleados;
create trigger capacidad_por_gente after insert or delete or update of activo, en_cuadrillas, etapa_id on public.empleados
  for each statement execute function public.disparar_capacidad_taller();
drop trigger if exists capacidad_automatica on public.etapas;
create trigger capacidad_automatica after insert or update of capacidad_automatica on public.etapas
  for each statement execute function public.disparar_capacidad_taller();
drop trigger if exists capacidad_por_horario on public.configuracion;
create trigger capacidad_por_horario after insert or update on public.configuracion
  for each row when (new.clave in ('horas_taller', 'taller_capacidad')) execute function public.disparar_capacidad_taller();

-- Lo que enseñan Configuración → Taller y el personal de piso.
create or replace function public.capacidad_taller()
returns table (etapa_id int, nombre text, orden int, activa boolean, automatica boolean, personas int,
               capacidad numeric, calculada numeric, horas_semana numeric, aprovechamiento numeric)
language plpgsql stable security definer set search_path = public as $$
begin
  if not (puede('produccion', 1) or puede('procesos', 1) or puede('admin', 3)) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  return query
  select et.id, et.nombre, et.orden, et.activa, et.capacidad_automatica, c.personas, et.capacidad_horas_semana, c.calculada,
         horas_semana_taller(), aprovechamiento_taller()
  from etapas et join capacidad_calculada() c on c.etapa_id = et.id
  order by et.orden;
end $$;
revoke execute on function public.capacidad_taller() from public, anon;
grant execute on function public.capacidad_taller() to authenticated;

-- El aprovechamiento lo pone la gerencia de producción (o sistemas y dirección).
create or replace function public.fijar_aprovechamiento_taller(p_aprovechamiento numeric) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not (puede('produccion', 3) or puede('admin', 3)) then
    raise exception 'El aprovechamiento lo pone la gerencia de producción' using errcode = '42501';
  end if;
  if p_aprovechamiento is null or p_aprovechamiento < 0.5 or p_aprovechamiento > 1 then
    raise exception 'El aprovechamiento va de 50 %% a 100 %%' using errcode = '23514';
  end if;
  insert into configuracion (clave, valor) values ('taller_capacidad', jsonb_build_object('aprovechamiento', round(p_aprovechamiento, 2)))
  on conflict (clave) do update set valor = coalesce(configuracion.valor, '{}'::jsonb) || excluded.valor, actualizado_en = now();
end $$;
revoke execute on function public.fijar_aprovechamiento_taller(numeric) from public, anon;
grant execute on function public.fijar_aprovechamiento_taller(numeric) to authenticated;

-- Encender o apagar la capacidad automática de un área (la misma gente que edita el taller).
create or replace function public.fijar_capacidad_automatica(p_etapa int, p_automatica boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not (puede('produccion', 3) or puede('admin', 3)) then
    raise exception 'Esto lo cambia la gerencia de producción' using errcode = '42501';
  end if;
  update etapas set capacidad_automatica = coalesce(p_automatica, false) where id = p_etapa;
  if not found then raise exception 'No existe esa etapa'; end if;
end $$;
revoke execute on function public.fijar_capacidad_automatica(int, boolean) from public, anon;
grant execute on function public.fijar_capacidad_automatica(int, boolean) to authenticated;

-- Arranque: automáticas las áreas que tienen gente en cuadrillas; las demás siguen a mano.
-- (El disparador de etapas recalcula al marcarlas.)
update public.etapas et set capacidad_automatica = true
where exists (select 1 from public.empleados em where em.etapa_id = et.id and em.activo and em.en_cuadrillas);
select public.recalcular_capacidad_taller();

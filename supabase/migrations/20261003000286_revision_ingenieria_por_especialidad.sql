-- =============================================================================
-- La revisión de ingeniería de una orden se firma por especialidad: mecánica y eléctrica.
--
-- Por qué: Noemí (y antes otros) pidió que el Ing. Fernando valide los componentes eléctricos con su
-- propio botón. Hasta hoy bastaba con que una persona de ingeniería marcara «revisada» para que la
-- orden se pudiera apartar y liberar, aunque nadie hubiera visto lo eléctrico. Abel pidió que la
-- revisión quede hasta que las dos personas de ingeniería presionen su botón.
--
-- Cómo queda:
--   * configuracion.revision_ingenieria dice qué especialidades firman y quién firma cada una. Por
--     omisión hay una sola («Ingeniería», la firma cualquiera de ingeniería): el ERP sigue igual para
--     quien no lo configure. En Hegamex: Mecánica (Miguel) y Eléctrica (Fernando).
--   * revisar_orden(op, 'ingenieria', especialidad) guarda la firma en op_firmas_ingenieria. Sin
--     especialidad firma las que le tocan a esa persona. La gerencia de producción (o dirección) puede
--     firmar una especialidad por quien falte, nombrándola; queda «en lugar de».
--   * Cuando están todas, se llena revisado_ingenieria_* como antes: apartar, liberar, la revisión
--     nocturna y el tablero no cambian.
--   * validacion_orden trae las firmas para que la pantalla ponga un botón por especialidad.
-- =============================================================================

create table if not exists public.op_firmas_ingenieria (
  orden_id uuid not null references public.ordenes_produccion(id) on delete cascade,
  especialidad text not null,
  por uuid not null references public.perfiles(id),
  en_lugar_de boolean not null default false,
  en timestamptz not null default now(),
  primary key (orden_id, especialidad)
);
alter table public.op_firmas_ingenieria enable row level security;
drop policy if exists ver on public.op_firmas_ingenieria;
create policy ver on public.op_firmas_ingenieria for select to authenticated
  using ((select puede('produccion', 1)) or (select puede('inventario', 1)) or (select puede('costeo', 1)));

insert into public.configuracion (clave, valor, descripcion)
values ('revision_ingenieria', '{"especialidades": [{"clave": "general", "nombre": "Ingeniería", "personas": []}]}',
  'Revisión de ingeniería de las órdenes: qué especialidades la firman y quién firma cada una (personas vacío = cualquiera de ingeniería). La orden queda revisada hasta que firman todas.')
on conflict (clave) do nothing;

-- Hegamex: Miguel firma lo mecánico y Fernando lo eléctrico (si existen; en una base nueva queda el general).
update public.configuracion set valor = jsonb_build_object('especialidades', jsonb_build_array(
    jsonb_build_object('clave', 'mecanica', 'nombre', 'Mecánica', 'personas',
      coalesce((select jsonb_agg(id) from perfiles where nombre = 'Miguel Ángel González'), '[]')),
    jsonb_build_object('clave', 'electrica', 'nombre', 'Eléctrica', 'personas',
      coalesce((select jsonb_agg(id) from perfiles where nombre = 'Fernando Serrano'), '[]'))))
where clave = 'revision_ingenieria'
  and exists (select 1 from perfiles where nombre = 'Miguel Ángel González')
  and exists (select 1 from perfiles where nombre = 'Fernando Serrano');

create or replace function public._especialidades_ingenieria() returns jsonb
language sql stable set search_path = public as $$
  select coalesce(nullif((select valor->'especialidades' from configuracion where clave = 'revision_ingenieria'), '[]'::jsonb),
                  '[{"clave": "general", "nombre": "Ingeniería", "personas": []}]'::jsonb)
$$;

-- Las firmas de una orden, con si quien pregunta puede firmar cada una (puedo) y si sería en lugar de otro.
create or replace function public.firmas_ingenieria(p_op uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'clave', e->>'clave', 'nombre', e->>'nombre',
      'por', (select nombre from perfiles where id = f.por), 'en', f.en, 'en_lugar_de', coalesce(f.en_lugar_de, false),
      'responsables', (select string_agg(p.nombre, ', ') from perfiles p where p.id::text in (select jsonb_array_elements_text(e->'personas'))),
      'mia', (e->'personas') ? (select auth.uid())::text,
      'puedo', f.por is null and (
        (e->'personas') ? (select auth.uid())::text
        or (jsonb_array_length(e->'personas') = 0 and (puede('costeo', 2) or puede('produccion', 3)))
        or puede('produccion', 3))) order by ord), '[]'::jsonb)
  from jsonb_array_elements(_especialidades_ingenieria()) with ordinality as x(e, ord)
  left join op_firmas_ingenieria f on f.orden_id = p_op and f.especialidad = e->>'clave'
$$;
revoke execute on function public.firmas_ingenieria(uuid) from public, anon;
grant execute on function public.firmas_ingenieria(uuid) to authenticated;

drop function if exists public.revisar_orden(uuid, text);
create or replace function public.revisar_orden(p_op uuid, p_paso text, p_especialidad text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_estado estado_op; e jsonb; v_mia boolean; v_libre boolean; v_n int := 0; v_faltan int;
begin
  select estado into v_estado from ordenes_produccion where id = p_op;
  if v_estado is null then raise exception 'No existe la orden'; end if;
  if p_paso = 'ingenieria' then
    if not (puede('costeo', 2) or puede('produccion', 3)) then raise exception 'Sin permiso' using errcode = '42501'; end if;
    if p_especialidad is not null and not exists (select 1 from jsonb_array_elements(_especialidades_ingenieria()) x where x->>'clave' = p_especialidad) then
      raise exception 'Esa especialidad no existe';
    end if;
    for e in select x from jsonb_array_elements(_especialidades_ingenieria()) x loop
      continue when exists (select 1 from op_firmas_ingenieria where orden_id = p_op and especialidad = e->>'clave');
      v_mia := (e->'personas') ? auth.uid()::text;
      v_libre := jsonb_array_length(e->'personas') = 0;
      if p_especialidad is null then
        -- Sin decir cuál: firma solo lo suyo (o lo que no tiene responsable). Nunca por otro sin nombrarlo.
        continue when not (v_mia or v_libre);
      else
        continue when e->>'clave' <> p_especialidad;
        if not (v_mia or v_libre or puede('produccion', 3)) then
          raise exception 'La revisión % la firma %', lower(e->>'nombre'),
            coalesce((select string_agg(p.nombre, ' o ') from perfiles p where p.id::text in (select jsonb_array_elements_text(e->'personas'))), 'ingeniería')
            using errcode = '42501';
        end if;
      end if;
      insert into op_firmas_ingenieria (orden_id, especialidad, por, en_lugar_de)
      values (p_op, e->>'clave', auth.uid(), not (v_mia or v_libre));
      insert into op_eventos (orden_id, tipo, nota) values (p_op, 'nota',
        case when jsonb_array_length(_especialidades_ingenieria()) = 1 then 'Ingeniería revisó materiales y cantidades'
             else format('Ingeniería (%s) revisó materiales y cantidades%s', lower(e->>'nombre'),
                         case when not (v_mia or v_libre) then ' en lugar de quien le toca' else '' end) end);
      v_n := v_n + 1;
    end loop;
    if v_n = 0 then
      raise exception 'No tienes ninguna firma pendiente en esta orden: %',
        coalesce((select string_agg(x->>'nombre' || ' la firma ' || coalesce((select string_agg(p.nombre, ' o ') from perfiles p
                    where p.id::text in (select jsonb_array_elements_text(x->'personas'))), 'ingeniería'), '; ')
                  from jsonb_array_elements(_especialidades_ingenieria()) x
                  where not exists (select 1 from op_firmas_ingenieria where orden_id = p_op and especialidad = x->>'clave')),
                 'ya está firmada');
    end if;
    select count(*) into v_faltan from jsonb_array_elements(_especialidades_ingenieria()) x
    where not exists (select 1 from op_firmas_ingenieria where orden_id = p_op and especialidad = x->>'clave');
    if v_faltan = 0 then
      update ordenes_produccion set revisado_ingenieria_por = auth.uid(), revisado_ingenieria_en = now()
      where id = p_op and revisado_ingenieria_en is null;
    end if;
  elsif p_paso = 'almacen' then
    if not puede('inventario', 2) then raise exception 'Sin permiso' using errcode = '42501'; end if;
    update ordenes_produccion set revisado_almacen_por = auth.uid(), revisado_almacen_en = now() where id = p_op;
    insert into op_eventos (orden_id, tipo, nota) values (p_op, 'nota', 'Almacén revisó el material físicamente');
  else
    raise exception 'Paso desconocido: %', p_paso;
  end if;
end $$;
revoke execute on function public.revisar_orden(uuid, text, text) from public, anon;
grant execute on function public.revisar_orden(uuid, text, text) to authenticated;

-- La hoja de validación trae las firmas y dice «a medias» si falta alguna.
do $$
declare v_def text; v_nuevo text;
begin
  v_def := pg_get_functiondef('public.validacion_orden(uuid)'::regprocedure);
  v_nuevo := replace(v_def,
    $a$'estado', case when o.revisado_ingenieria_en is not null then 'hecho' else 'pendiente' end,
      'por', (select nombre from perfiles where id = o.revisado_ingenieria_por), 'en', o.revisado_ingenieria_en,
      'detalle', format('%s partida(s) en la lista', v_lineas)),$a$,
    $a$'estado', case when o.revisado_ingenieria_en is not null then 'hecho'
                      when exists (select 1 from op_firmas_ingenieria where orden_id = p_op) then 'parcial' else 'pendiente' end,
      'por', (select nombre from perfiles where id = o.revisado_ingenieria_por), 'en', o.revisado_ingenieria_en,
      'detalle', format('%s partida(s) en la lista', v_lineas),
      'firmas', case when o.revisado_ingenieria_en is null or exists (select 1 from op_firmas_ingenieria where orden_id = p_op)
                     then firmas_ingenieria(p_op) else '[]'::jsonb end),$a$);
  if v_nuevo = v_def then raise exception 'No encontré el paso de ingeniería en validacion_orden'; end if;
  execute v_nuevo;
end $$;

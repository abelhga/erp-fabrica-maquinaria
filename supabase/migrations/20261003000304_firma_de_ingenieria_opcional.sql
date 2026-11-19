-- =============================================================================
-- Una especialidad de la revisión de ingeniería puede quedar como opcional.
--
-- Por qué: desde 286 la orden queda revisada hasta que firman Mecánica (Miguel) y Eléctrica (el Ing.
-- Fernando), y sin eso no se libera al taller. La gerencia de producción pidió que, por ahora, la
-- firma eléctrica no detenga la liberación: que baste con la de Mecánica.
--
-- Qué cambia: cada especialidad de configuracion.revision_ingenieria puede traer
-- "obligatoria": false (si no lo trae, es obligatoria, como hasta hoy). La orden queda revisada
-- cuando firman las obligatorias. La opcional conserva su botón: se puede firmar antes o después,
-- queda en la historia, y no detiene nada ni manda recordatorio. Para volver a exigirla basta
-- quitarle la bandera.
-- En Hegamex: Eléctrica queda opcional. Las órdenes abiertas que ya tienen todas las obligatorias
-- quedan revisadas con esta migración.
-- =============================================================================

create or replace function public.firmas_ingenieria(p_op uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'clave', e->>'clave', 'nombre', e->>'nombre',
      'por', (select nombre from perfiles where id = f.por), 'en', f.en, 'en_lugar_de', coalesce(f.en_lugar_de, false),
      'responsables', (select string_agg(p.nombre, ', ') from perfiles p where p.id::text in (select jsonb_array_elements_text(e->'personas'))),
      'mia', (e->'personas') ? (select auth.uid())::text,
      'obligatoria', coalesce((e->>'obligatoria')::boolean, true),
      'puedo', f.por is null and (
        (e->'personas') ? (select auth.uid())::text
        or (jsonb_array_length(e->'personas') = 0 and (puede('costeo', 2) or puede('produccion', 3)))
        or puede('produccion', 3))) order by ord), '[]'::jsonb)
  from jsonb_array_elements(_especialidades_ingenieria()) with ordinality as x(e, ord)
  left join op_firmas_ingenieria f on f.orden_id = p_op and f.especialidad = e->>'clave'
$$;

do $$
declare s text; v_ancla text;
begin
  -- La orden queda revisada cuando ya no falta ninguna firma obligatoria.
  s := pg_get_functiondef('public.revisar_orden(uuid, text, text)'::regprocedure);
  if position('obligatoria' in s) = 0 then
    v_ancla := 'where not exists (select 1 from op_firmas_ingenieria where orden_id = p_op and especialidad = x->>''clave'');' || chr(10) || '    if v_faltan = 0 then';
    if position(v_ancla in s) = 0 then raise exception 'revisar_orden ya no es la de 286: revisa este parche'; end if;
    s := replace(s, v_ancla,
      'where coalesce((x->>''obligatoria'')::boolean, true)' || chr(10) ||
      '      and not exists (select 1 from op_firmas_ingenieria where orden_id = p_op and especialidad = x->>''clave'');' || chr(10) || '    if v_faltan = 0 then');
    execute s;
  end if;

  -- El recordatorio de «órdenes sin tu revisión» no insiste por una firma opcional.
  s := pg_get_functiondef('public.avisos_periodicos()'::regprocedure);
  if position('obligatoria' in s) = 0 then
    v_ancla := 'where (jsonb_array_length(e->''personas'') = 0 or (e->''personas'') ? u.u::text)';
    if position(v_ancla in s) = 0 then raise exception 'avisos_periodicos ya no es la de 294: revisa este parche'; end if;
    s := replace(s, v_ancla, v_ancla || chr(10) || '                    and coalesce((e->>''obligatoria'')::boolean, true)');
    execute s;
  end if;
end $$;

-- Hegamex: la firma eléctrica deja de ser obligatoria (si está configurada).
update public.configuracion c set valor = jsonb_set(c.valor, '{especialidades}',
  (select jsonb_agg(case when e->>'clave' = 'electrica' then e || '{"obligatoria": false}' else e end order by ord)
   from jsonb_array_elements(c.valor->'especialidades') with ordinality x(e, ord)))
where c.clave = 'revision_ingenieria'
  and exists (select 1 from jsonb_array_elements(c.valor->'especialidades') e where e->>'clave' = 'electrica')
  and exists (select 1 from jsonb_array_elements(c.valor->'especialidades') e where e->>'clave' = 'mecanica');

-- Las órdenes abiertas que ya tienen todas las firmas obligatorias quedan revisadas, a nombre de
-- quien dio la última de ellas.
with obligatorias as (
  select e->>'clave' as clave from jsonb_array_elements(public._especialidades_ingenieria()) e
  where coalesce((e->>'obligatoria')::boolean, true)
), listas as (
  select o.id,
    (select f.por from public.op_firmas_ingenieria f where f.orden_id = o.id and f.especialidad in (select clave from obligatorias) order by f.en desc limit 1) as por,
    (select max(f.en) from public.op_firmas_ingenieria f where f.orden_id = o.id and f.especialidad in (select clave from obligatorias)) as en
  from public.ordenes_produccion o
  where o.revisado_ingenieria_en is null and o.estado not in ('terminada', 'entregada', 'cancelada')
    and exists (select 1 from obligatorias)
    and not exists (select 1 from obligatorias b
                    where not exists (select 1 from public.op_firmas_ingenieria f where f.orden_id = o.id and f.especialidad = b.clave))
)
update public.ordenes_produccion o set revisado_ingenieria_por = l.por, revisado_ingenieria_en = l.en
from listas l where l.id = o.id;

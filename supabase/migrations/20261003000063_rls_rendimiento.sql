-- =============================================================================
-- RLS que no se vuelve lenta con datos reales.
--
-- Escribir la política como "using (puede('costeo', 1))" hace que Postgres
-- llame a puede() UNA VEZ POR FILA. Con el catálogo real (5,600 artículos) una
-- vista que cruza artículos llegó al límite de 8 s y la pantalla de subensambles
-- daba error 500. Envolviendo la llamada en un subselect, "(select puede(…))",
-- el planificador la evalúa una sola vez por consulta (es la recomendación de
-- Supabase). Lo mismo para auth.uid(), tiene_rol() y mis_roles().
--
-- En vez de reescribir a mano 130 políticas (y las que se agreguen después),
-- optimizar_politicas() las reescribe todas; se vuelve a llamar al final de
-- cualquier migración que agregue políticas.
-- Las que dependen de la fila (cliente_visible(cliente_id), etc.) se quedan como están.
-- =============================================================================

create or replace function public.envolver_en_select(expr text) returns text
language sql immutable as $$
  select regexp_replace(regexp_replace(regexp_replace(regexp_replace(expr,
    '(?<!SELECT )puede\(''([a-z_]+)''::text, ([0-9])\)', '(SELECT puede(''\1''::text, \2) AS puede)', 'g'),
    '(?<!SELECT )tiene_rol\(''([a-z_]+)''::app_rol\)', '(SELECT tiene_rol(''\1''::app_rol) AS tiene_rol)', 'g'),
    '(?<!SELECT )cardinality\(mis_roles\(\)\)', '(SELECT cardinality(mis_roles()) AS cardinality)', 'g'),
    '(?<!SELECT )auth\.uid\(\)', '(SELECT auth.uid() AS uid)', 'g')
$$;

create or replace function public.optimizar_politicas() returns int
language plpgsql as $$
declare p record; v_q text; v_c text; v_n int := 0;
begin
  for p in select * from pg_policies where schemaname = 'public' loop
    v_q := case when p.qual is not null then envolver_en_select(p.qual) end;
    v_c := case when p.with_check is not null then envolver_en_select(p.with_check) end;
    if v_q is distinct from p.qual or v_c is distinct from p.with_check then
      execute format('alter policy %I on %I.%I %s %s', p.policyname, p.schemaname, p.tablename,
        case when v_q is not null then 'using (' || v_q || ')' else '' end,
        case when v_c is not null then 'with check (' || v_c || ')' else '' end);
      v_n := v_n + 1;
    end if;
  end loop;
  return v_n;
end $$;

select public.optimizar_politicas();

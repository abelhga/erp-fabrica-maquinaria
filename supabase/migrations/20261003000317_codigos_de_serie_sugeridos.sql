-- =============================================================================
-- El ERP propone el código de serie de cada equipo, e ingeniería lo acepta.
--
-- Por qué: el número de serie sale solo al crear la orden de producción, pero solo si el equipo
-- tiene su código (la parte fija: TB20090275E = banda, 20", 9 m, 2 HP, caja 75, eléctrica). Solo
-- 18 de 469 equipos lo tenían, así que casi todas las órdenes nacían sin serie y había que
-- capturarlo a mano (por eso Luis «no podía generar los números de serie»). Capturar 451 códigos
-- a mano no iba a pasar. Dirección pidió que el ERP los genere y que ingeniería solo confirme.
--
-- Cómo: la IA lee el nombre de cada equipo, sus motores y reductores de la lista de materiales, y
-- los códigos de la misma familia en el libro de seriales de la hoja (cientos de ejemplos: así se
-- arma cada familia), y propone familia y código con qué tan segura está. La propuesta se guarda
-- aparte; no sirve para numerar hasta que alguien de ingeniería o la gerencia de producción la
-- acepta. Al aceptar (o al capturar un código a mano), las órdenes abiertas de ese equipo que
-- nacieron sin serie reciben su número de una vez.
-- =============================================================================

alter table public.articulos
  add column if not exists codigo_serie_sugerido text check (codigo_serie_sugerido ~ '^[A-Z0-9]+$'),
  add column if not exists familia_serie_sugerida text references public.familias_serie(clave),
  add column if not exists codigo_sugerido_seguro text check (codigo_sugerido_seguro in ('alto', 'medio', 'bajo')),
  add column if not exists codigo_sugerido_nota text,
  add column if not exists codigo_sugerido_en timestamptz;

-- Lo que la IA necesita para proponer: equipos sin código ni propuesta, cómo se arma cada familia
-- (códigos del libro de seriales con un ejemplo de descripción) y los códigos ya confirmados.
create or replace function public.codigos_serie_por_sugerir(p_limite int default 30) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare r jsonb;
begin
  if not (puede('produccion', 3) or puede('costeo', 3)) then
    raise exception 'Los códigos de serie los propone ingeniería o la gerencia de producción' using errcode = '42501';
  end if;
  with eq as (
    select a.id, a.clave, a.nombre, a.familia
    from articulos a
    where a.tipo = 'equipo' and a.activo and a.codigo_serie is null and a.codigo_serie_sugerido is null
      and coalesce(a.codigo_sugerido_seguro, '') <> 'bajo' and a.codigo_sugerido_en is null
    order by a.clave limit greatest(1, least(coalesce(p_limite, 30), 60))
  )
  select jsonb_build_object(
    'equipos', (select coalesce(jsonb_agg(jsonb_build_object('id', eq.id, 'clave', eq.clave, 'nombre', eq.nombre, 'familia_catalogo', eq.familia,
        'motores_y_reductores', (select coalesce(jsonb_agg(distinct h.nombre), '[]'::jsonb) from bom_lineas b join articulos h on h.id = b.hijo_id
                                  where b.padre_id = eq.id and sin_acentos(h.nombre) ~* '(motor|reductor|caja|turbina|vibrador|variador)'))), '[]'::jsonb) from eq),
    'familias', (select jsonb_agg(jsonb_build_object('clave', clave, 'nombre', nombre, 'prefijo', prefijo) order by orden) from familias_serie),
    'libro_de_seriales', (select jsonb_object_agg(familia, ejemplos) from (
        select familia, jsonb_agg(jsonb_build_object('codigo', codigo, 'equipo', descripcion) order by n desc) ejemplos from (
          select familia, regexp_replace(numero_serie, '[0-9]{3}$', '') codigo, max(descripcion) descripcion, count(*) n,
                 row_number() over (partition by familia order by count(*) desc) rn
          from equipos_historicos
          where familia is not null and numero_serie ~ '[0-9]{3}$' and numero_serie !~ '^3AAM'
          group by 1, 2) x where rn <= 30 group by familia) y),
    'confirmados', (select coalesce(jsonb_agg(jsonb_build_object('equipo', nombre, 'familia', familia_serie, 'codigo', codigo_serie)), '[]'::jsonb)
                    from articulos where codigo_serie is not null),
    'quedan', (select count(*) from articulos a where a.tipo = 'equipo' and a.activo and a.codigo_serie is null and a.codigo_sugerido_en is null)
  ) into r;
  return r;
end $$;
revoke execute on function public.codigos_serie_por_sugerir(int) from public, anon;
grant execute on function public.codigos_serie_por_sugerir(int) to authenticated;

-- Guarda lo que propuso la IA. Solo propuestas: no numeran nada hasta que alguien las acepta.
-- Un equipo que la IA no supo (sin código) queda marcado para no volver a preguntarle.
create or replace function public.guardar_codigos_sugeridos(p_sugerencias jsonb) returns int
language plpgsql security definer set search_path = public as $$
declare s jsonb; v_cod text; v_fam text; v_n int := 0;
begin
  if not (puede('produccion', 3) or puede('costeo', 3)) then
    raise exception 'Los códigos de serie los propone ingeniería o la gerencia de producción' using errcode = '42501';
  end if;
  for s in select * from jsonb_array_elements(coalesce(p_sugerencias, '[]'::jsonb)) loop
    v_cod := nullif(upper(regexp_replace(coalesce(s->>'codigo', ''), '[^A-Za-z0-9]', '', 'g')), '');
    v_fam := (select clave from familias_serie where clave = s->>'familia');
    if v_cod is not null and (v_fam is null or length(v_cod) < 3 or length(v_cod) > 20) then v_cod := null; end if;
    update articulos set
      codigo_serie_sugerido = v_cod,
      familia_serie_sugerida = case when v_cod is not null then v_fam end,
      codigo_sugerido_seguro = case when v_cod is null then 'bajo' when s->>'seguro' in ('alto', 'medio', 'bajo') then s->>'seguro' else 'medio' end,
      codigo_sugerido_nota = left(nullif(btrim(s->>'por_que'), ''), 400),
      codigo_sugerido_en = now()
    where id = (s->>'id')::uuid and tipo = 'equipo' and codigo_serie is null;
    if found then v_n := v_n + 1; end if;
  end loop;
  return v_n;
end $$;
revoke execute on function public.guardar_codigos_sugeridos(jsonb) from public, anon;
grant execute on function public.guardar_codigos_sugeridos(jsonb) to authenticated;

-- Al tener código, las órdenes abiertas de ese equipo que nacieron sin serie reciben su número.
create or replace function public.trg_serie_a_ordenes_pendientes() returns trigger
language plpgsql security definer set search_path = public as $$
declare o record; v_serie text;
begin
  if new.codigo_serie is null or new.familia_serie is null then return null; end if;
  for o in select id from ordenes_produccion
           where articulo_id = new.id and numero_serie is null and cantidad = 1 and estado not in ('cancelada', 'entregada')
           order by creado_en loop
    v_serie := siguiente_numero_serie(new.id);
    update ordenes_produccion set numero_serie = v_serie where id = o.id;
    insert into op_eventos (orden_id, tipo, nota) values (o.id, 'nota', 'Número de serie asignado al tener su equipo código: ' || v_serie);
  end loop;
  return null;
end $$;
drop trigger if exists serie_a_ordenes_pendientes on public.articulos;
create trigger serie_a_ordenes_pendientes after update of codigo_serie, familia_serie on public.articulos
  for each row when (new.codigo_serie is not null and new.familia_serie is not null
                     and (old.codigo_serie is distinct from new.codigo_serie or old.familia_serie is distinct from new.familia_serie))
  execute function public.trg_serie_a_ordenes_pendientes();

-- Aceptar propuestas: las elegidas, o todas las de la seguridad que se pida.
create or replace function public.aceptar_codigos_sugeridos(p_ids uuid[] default null, p_seguro text default null) returns int
language plpgsql security definer set search_path = public as $$
declare v_n int;
begin
  if not (puede('produccion', 3) or puede('costeo', 3)) then
    raise exception 'Solo la gerencia de producción o ingeniería acepta códigos de serie' using errcode = '42501';
  end if;
  if p_ids is null and p_seguro is null then raise exception 'Elige qué códigos aceptar' using errcode = '22023'; end if;
  update articulos set familia_serie = familia_serie_sugerida, codigo_serie = codigo_serie_sugerido,
    codigo_serie_sugerido = null, familia_serie_sugerida = null, actualizado_en = now()
  where tipo = 'equipo' and codigo_serie is null and codigo_serie_sugerido is not null and familia_serie_sugerida is not null
    and (p_ids is null or id = any(p_ids))
    and (p_seguro is null or codigo_sugerido_seguro = p_seguro);
  get diagnostics v_n = row_count;
  return v_n;
end $$;
revoke execute on function public.aceptar_codigos_sugeridos(uuid[], text) from public, anon;
grant execute on function public.aceptar_codigos_sugeridos(uuid[], text) to authenticated;

-- Capturar el código a mano limpia la propuesta que hubiera.
do $$
declare v_def text := pg_get_functiondef('public.fijar_codigo_serie(uuid, text, text)'::regprocedure);
  v_ancla text := 'update articulos set familia_serie = p_familia, codigo_serie = v_cod, actualizado_en = now()';
begin
  if v_def like '%codigo_serie_sugerido = null%' then return; end if;
  if position(v_ancla in v_def) = 0 then raise exception 'fijar_codigo_serie ya no es la que se conocía'; end if;
  execute replace(v_def, v_ancla, 'update articulos set familia_serie = p_familia, codigo_serie = v_cod, codigo_serie_sugerido = null, familia_serie_sugerida = null, actualizado_en = now()');
end $$;

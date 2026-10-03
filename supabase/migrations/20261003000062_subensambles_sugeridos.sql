-- =============================================================================
-- Subensambles sugeridos.
--
-- Las listas de materiales llegan planas porque en la hoja cada equipo se hizo
-- copiando otro: el mismo cabezal motriz o la misma estación de carga aparece
-- repetido pieza por pieza en decenas de equipos. scripts/detectar-subensambles.ts
-- compara todas las listas, encuentra grupos idénticos (mismo componente y
-- cantidad) que se repiten y los guarda aquí ordenados por cuántas líneas de
-- captura ahorran. Ingeniería revisa cada sugerencia, le pone nombre y la aplica:
-- el grupo se vuelve un subensamble y cada equipo lo usa en lugar de sus piezas
-- sueltas. El costo de cada equipo no cambia ni un centavo (lo prueba 15_subensambles.sql).
-- =============================================================================

create table public.sugerencias_subensamble (
  id serial primary key,
  componentes jsonb not null,          -- [{"articulo_id": "...", "cantidad": 2}, …]
  equipos uuid[] not null,             -- equipos que contienen el grupo completo
  lineas int not null,
  ahorro int not null,                 -- líneas que se dejan de capturar = (equipos − 1) × (lineas − 1)
  nombre_sugerido text,
  estado text not null default 'pendiente' check (estado in ('pendiente', 'aplicada', 'descartada')),
  subensamble_id uuid references public.articulos(id),
  detectada_en timestamptz not null default now(),
  resuelta_por uuid references public.perfiles(id),
  resuelta_en timestamptz
);

create or replace function public.aplicar_sugerencia_subensamble(p_id int, p_clave text, p_nombre text, p_equipos uuid[] default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare s sugerencias_subensamble; v_sub uuid; v_eq uuid; c record; v_linea uuid; v_orden int;
begin
  if not puede('costeo', 2) then raise exception 'Sin permiso para editar listas de materiales' using errcode = '42501'; end if;
  select * into s from sugerencias_subensamble where id = p_id for update;
  if s.estado <> 'pendiente' then raise exception 'Esta sugerencia ya fue %', s.estado; end if;

  insert into articulos (clave, tipo, nombre, unidad, descripcion, controla_inventario, se_vende)
  values (p_clave, 'subensamble', p_nombre, 'pieza', 'Creado a partir de piezas que se repetían igual en varios equipos.', false, false)
  returning id into v_sub;
  insert into bom_lineas (padre_id, hijo_id, cantidad, orden)
  select v_sub, (x->>'articulo_id')::uuid, (x->>'cantidad')::numeric, row_number() over ()
  from jsonb_array_elements(s.componentes) x;

  -- En cada equipo: quita una línea por cada pieza del grupo y pone el subensamble.
  foreach v_eq in array coalesce(p_equipos, s.equipos) loop
    if not (v_eq = any(s.equipos)) then raise exception 'Ese equipo no estaba en la sugerencia'; end if;
    v_orden := null;
    for c in select (x->>'articulo_id')::uuid hijo, (x->>'cantidad')::numeric cant from jsonb_array_elements(s.componentes) x loop
      select id, orden into v_linea, v_orden from bom_lineas
      where padre_id = v_eq and hijo_id = c.hijo and cantidad = c.cant and parametro is null
      order by orden limit 1;
      if v_linea is null then
        raise exception 'El equipo % ya no tiene la pieza del grupo (¿se editó después de la detección?)',
          (select clave from articulos where id = v_eq);
      end if;
      delete from bom_lineas where id = v_linea;
    end loop;
    insert into bom_lineas (padre_id, hijo_id, cantidad, orden, notas)
    values (v_eq, v_sub, 1, coalesce(v_orden, 0), 'Subensamble ' || p_clave);
  end loop;

  update sugerencias_subensamble set estado = 'aplicada', subensamble_id = v_sub, resuelta_por = auth.uid(), resuelta_en = now()
  where id = p_id;
  return v_sub;
end $$;

create or replace function public.descartar_sugerencia_subensamble(p_id int) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not puede('costeo', 2) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  update sugerencias_subensamble set estado = 'descartada', resuelta_por = auth.uid(), resuelta_en = now()
  where id = p_id and estado = 'pendiente';
end $$;

-- Para la pantalla: cada sugerencia con los nombres de sus piezas y equipos.
create or replace view public.v_sugerencias_subensamble with (security_invoker = true) as
select s.id, s.estado, s.lineas, s.ahorro, s.nombre_sugerido, s.detectada_en, s.subensamble_id,
  cardinality(s.equipos) as num_equipos,
  (select jsonb_agg(jsonb_build_object('articulo_id', a.id, 'clave', a.clave, 'nombre', a.nombre, 'unidad', a.unidad,
                                       'cantidad', (x->>'cantidad')::numeric) order by a.nombre)
   from jsonb_array_elements(s.componentes) x join public.articulos a on a.id = (x->>'articulo_id')::uuid) as componentes,
  (select jsonb_agg(jsonb_build_object('id', a.id, 'clave', a.clave, 'nombre', a.nombre) order by a.clave)
   from public.articulos a where a.id = any(s.equipos)) as equipos
from public.sugerencias_subensamble s;

alter table public.sugerencias_subensamble enable row level security;
create policy ver on public.sugerencias_subensamble for select to authenticated using (puede('costeo', 1));

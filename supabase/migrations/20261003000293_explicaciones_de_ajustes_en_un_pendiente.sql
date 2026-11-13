-- =============================================================================
-- Las explicaciones de ajustes que se le piden a una persona van en un solo pendiente.
--
-- Por qué: el 12 nov se le pidieron a Noemí siete explicaciones seguidas y le llegaron siete
-- pendientes («Explica la diferencia del ajuste AJU-…»), uno por artículo, encima de los avisos.
--
-- Cómo queda:
--   * pedir_explicacion_ajuste junta las preguntas que la misma persona le hace a otra en un solo
--     pendiente abierto, «Explica N diferencias de ajustes», con la lista (folio, artículo, almacén,
--     sistema → contado y la pregunta). Cada pregunta queda ligada a ese pendiente (ajuste_notas).
--   * Cada explicación que se escribe en el ajuste la quita de la lista; cuando ya no queda ninguna,
--     el pendiente se cierra solo. Resolver el ajuste también la quita.
--   * Si se cierra desde Pendientes con una nota, esa nota queda como explicación de todos los que
--     faltaban (puede escribir «AJU-205: …; AJU-155: …»).
--   * Los pendientes de uno por ajuste que ya estaban abiertos se juntan igual.
-- =============================================================================

alter table public.ajuste_notas add column if not exists pendiente_id uuid references public.pendientes(id) on delete set null;

-- Rehace la lista del pendiente agrupado; si ya no falta nada, lo cierra.
create or replace function public._refrescar_pendiente_explicaciones(p_pendiente uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_n int; v_lista text; v_est text;
begin
  select estado into v_est from pendientes where id = p_pendiente;
  if v_est is distinct from 'abierto' then return; end if;
  select count(*), string_agg(format('• %s · %s (%s): sistema %s, contado %s.%s', a.folio, ar.nombre, al.nombre,
           trim_scale(a.cantidad_sistema), trim_scale(a.cantidad_fisica),
           case when n.texto not like 'Explica la diferencia:%' then ' Pregunta: ' || n.texto else '' end), chr(10) order by a.folio)
  into v_n, v_lista
  from ajuste_notas n join ajustes_inventario a on a.id = n.ajuste_id join articulos ar on ar.id = a.articulo_id
  join almacenes al on al.id = a.almacen_id
  where n.pendiente_id = p_pendiente and n.tipo = 'pregunta' and a.estado = 'pendiente'
    and not exists (select 1 from ajuste_notas x where x.ajuste_id = a.id and x.tipo = 'explicacion' and x.id > n.id);
  perform set_config('hegamex.revision', '1', true);
  if v_n = 0 then
    perform set_config('hegamex.ajuste_explicado', '1', true);
    update pendientes set estado = 'hecho', nota_cierre = 'Ya se explicaron (o se resolvieron) todos los ajustes'
    where id = p_pendiente;
    perform set_config('hegamex.ajuste_explicado', '0', true);
  else
    update pendientes set
      titulo = case when v_n = 1 then 'Explica la diferencia de 1 ajuste de inventario' else format('Explica %s diferencias de ajustes de inventario', v_n) end,
      detalle = v_lista || chr(10) || chr(10) || 'Escribe en cada ajuste qué pasó o dónde están (Entradas y salidas → Ajustes → «Explicar la diferencia»); cada uno sale de esta lista al explicarlo. Si lo cierras aquí, tu nota queda como explicación de todos los que falten.'
    where id = p_pendiente;
  end if;
  perform set_config('hegamex.revision', '0', true);
end $$;
revoke execute on function public._refrescar_pendiente_explicaciones(uuid) from public, anon, authenticated;

create or replace function public.pedir_explicacion_ajuste(p_ajuste uuid, p_a uuid default null, p_pregunta text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare a ajustes_inventario; v_para uuid; v_p uuid; v_preg text := nullif(trim(p_pregunta), '');
begin
  if not (tiene_rol('direccion') or tiene_rol('gerente_produccion')) then
    raise exception 'La explicación la pide quien autoriza los ajustes: la gerencia de producción o dirección' using errcode = '42501';
  end if;
  select * into a from ajustes_inventario where id = p_ajuste;
  if a.id is null then raise exception 'No existe el ajuste'; end if;
  if a.estado <> 'pendiente' then raise exception 'Este ajuste ya se resolvió'; end if;
  v_para := coalesce(p_a, a.solicitado_por);
  if not exists (select 1 from perfiles where id = v_para and activo) then raise exception 'Esa persona no está activa'; end if;
  if v_para = auth.uid() then raise exception 'La explicación se le pide a otra persona'; end if;
  if exists (select 1 from pendientes where tabla = 'ajustes_inventario' and registro_id = a.id::text
             and responsable_id = v_para and estado = 'abierto')
     or exists (select 1 from ajuste_notas n join pendientes p on p.id = n.pendiente_id
                where n.ajuste_id = a.id and n.para = v_para and n.tipo = 'pregunta' and p.estado = 'abierto'
                  and not exists (select 1 from ajuste_notas x where x.ajuste_id = a.id and x.tipo = 'explicacion' and x.id > n.id)) then
    raise exception 'A esa persona ya se le pidió la explicación de este ajuste y no ha contestado';
  end if;

  -- El pendiente abierto que ya tiene de quien pregunta, o uno nuevo.
  select id into v_p from pendientes
  where tabla = 'ajustes_explicacion' and responsable_id = v_para and creado_por = auth.uid() and estado = 'abierto'
  order by creado_en limit 1;
  if v_p is null then
    insert into pendientes (titulo, detalle, responsable_id, vence, tabla, ruta)
    values ('Explica la diferencia de 1 ajuste de inventario', '…', v_para, hoy_mx() + 2, 'ajustes_explicacion',
            '/almacen/movimientos?vista=ajustes')
    returning id into v_p;
  end if;
  insert into ajuste_notas (ajuste_id, tipo, texto, para, pendiente_id)
  values (a.id, 'pregunta', coalesce(v_preg, 'Explica la diferencia: qué pasó o dónde están.'), v_para, v_p);
  perform _refrescar_pendiente_explicaciones(v_p);
  return v_p;
end $$;

-- Explicar en el ajuste: además de lo de antes, saca el ajuste de los pendientes agrupados.
create or replace function public.explicar_ajuste(p_ajuste uuid, p_texto text) returns void
language plpgsql security definer set search_path = public as $$
declare a ajustes_inventario; v_txt text := trim(p_texto); v_p uuid;
begin
  select * into a from ajustes_inventario where id = p_ajuste;
  if a.id is null then raise exception 'No existe el ajuste'; end if;
  if not (puede('inventario', 2)
          or exists (select 1 from pendientes where tabla = 'ajustes_inventario' and registro_id = a.id::text
                     and responsable_id = auth.uid() and estado = 'abierto')
          or exists (select 1 from ajuste_notas n join pendientes p on p.id = n.pendiente_id
                     where n.ajuste_id = a.id and p.responsable_id = auth.uid() and p.estado = 'abierto')) then
    raise exception 'La explicación la escribe almacén o a quien se le pidió' using errcode = '42501';
  end if;
  if a.estado <> 'pendiente' then raise exception 'Este ajuste ya se resolvió'; end if;
  if coalesce(length(v_txt), 0) < 10 then raise exception 'Escribe qué pasó o dónde están (al menos una frase)'; end if;
  insert into ajuste_notas (ajuste_id, tipo, texto) values (a.id, 'explicacion', v_txt);
  perform set_config('hegamex.ajuste_explicado', '1', true);
  update pendientes set estado = 'hecho', nota_cierre = left(v_txt, 500)
  where tabla = 'ajustes_inventario' and registro_id = a.id::text and estado = 'abierto';
  perform set_config('hegamex.ajuste_explicado', '0', true);
  for v_p in select distinct n.pendiente_id from ajuste_notas n where n.ajuste_id = a.id and n.pendiente_id is not null loop
    perform _refrescar_pendiente_explicaciones(v_p);
  end loop;
end $$;

-- Cerrar el agrupado desde Pendientes: la nota es la explicación de los que faltaban.
create or replace function public.pendiente_ajuste_explicado() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.estado = 'abierto' and new.estado = 'hecho'
     and coalesce(current_setting('hegamex.ajuste_explicado', true), '0') <> '1' then
    if new.tabla = 'ajustes_inventario' then
      if coalesce(length(trim(new.nota_cierre)), 0) < 10 then
        raise exception 'Escribe la explicación (qué pasó o dónde están) en la nota al marcarlo como hecho' using errcode = '23514';
      end if;
      insert into ajuste_notas (ajuste_id, tipo, texto, por)
      select a.id, 'explicacion', trim(new.nota_cierre), coalesce(new.cerrado_por, auth.uid())
      from ajustes_inventario a where a.id::text = new.registro_id;
    elsif new.tabla = 'ajustes_explicacion' then
      if coalesce(length(trim(new.nota_cierre)), 0) < 10 then
        raise exception 'Escribe la explicación en la nota (puedes poner una por ajuste: «AJU-205: …»), o explica cada uno en su ajuste' using errcode = '23514';
      end if;
      insert into ajuste_notas (ajuste_id, tipo, texto, por)
      select distinct a.id, 'explicacion', trim(new.nota_cierre), coalesce(new.cerrado_por, auth.uid())
      from ajuste_notas n join ajustes_inventario a on a.id = n.ajuste_id
      where n.pendiente_id = new.id and n.tipo = 'pregunta' and a.estado = 'pendiente'
        and not exists (select 1 from ajuste_notas x where x.ajuste_id = a.id and x.tipo = 'explicacion' and x.id > n.id);
    end if;
  end if;
  return null;
end $$;

-- Al resolver un ajuste, sale de los agrupados (y se cancelan los de uno por ajuste, como antes).
create or replace function public._cerrar_explicaciones_ajuste(p_ajuste uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_p uuid;
begin
  perform set_config('hegamex.revision', '1', true);
  update pendientes set estado = 'cancelado', nota_cierre = 'El ajuste ya se resolvió'
  where tabla = 'ajustes_inventario' and registro_id = p_ajuste::text and estado = 'abierto';
  perform set_config('hegamex.revision', '0', true);
  for v_p in select distinct n.pendiente_id from ajuste_notas n where n.ajuste_id = p_ajuste and n.pendiente_id is not null loop
    perform _refrescar_pendiente_explicaciones(v_p);
  end loop;
end $$;
revoke execute on function public._cerrar_explicaciones_ajuste(uuid) from public, anon, authenticated;

-- Los de uno por ajuste que siguen abiertos (los pidió el ERP con «Pedir explicación») se juntan:
-- uno por persona y por quien preguntó.
do $$
declare r record; v_p uuid;
begin
  perform set_config('hegamex.revision', '1', true);
  for r in select responsable_id, creado_por from pendientes
           where tabla = 'ajustes_inventario' and estado = 'abierto' and titulo like 'Explica la diferencia del ajuste %'
           group by 1, 2 having count(*) >= 1 loop
    insert into pendientes (titulo, detalle, responsable_id, creado_por, vence, tabla, ruta)
    values ('Explica diferencias de ajustes de inventario', '…', r.responsable_id, r.creado_por,
            (select min(vence) from pendientes where tabla = 'ajustes_inventario' and estado = 'abierto'
               and responsable_id = r.responsable_id and creado_por = r.creado_por and titulo like 'Explica la diferencia del ajuste %'),
            'ajustes_explicacion', '/almacen/movimientos?vista=ajustes')
    returning id into v_p;
    update ajuste_notas n set pendiente_id = v_p
    from pendientes p
    where p.tabla = 'ajustes_inventario' and p.estado = 'abierto' and p.responsable_id = r.responsable_id
      and p.creado_por = r.creado_por and p.titulo like 'Explica la diferencia del ajuste %'
      and n.ajuste_id::text = p.registro_id and n.tipo = 'pregunta' and n.para = r.responsable_id;
    update pendientes set estado = 'cancelado', nota_cierre = 'Se juntó con las demás explicaciones en un solo pendiente'
    where tabla = 'ajustes_inventario' and estado = 'abierto' and responsable_id = r.responsable_id
      and creado_por = r.creado_por and titulo like 'Explica la diferencia del ajuste %';
    perform _refrescar_pendiente_explicaciones(v_p);
  end loop;
  perform set_config('hegamex.revision', '0', true);
end $$;

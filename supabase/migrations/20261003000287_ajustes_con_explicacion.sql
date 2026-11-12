-- =============================================================================
-- Ajustes de inventario: la explicación de una diferencia queda en el ERP, no en una libreta.
--
-- Por qué: en el conteo físico del 10-11 nov, Noemí y Margarita anotaban en una libreta la razón
-- que almacén daba cuando faltaba algo de valor. Abel aprobó 38 ajustes chicos y detuvo 20 (de
-- alto valor, sin costo o raros, como 4 motovibradores que nadie sabe dónde están) hasta que
-- alguien explique. El ajuste solo tenía un «motivo» de una línea al pedirlo y un comentario de
-- quien lo resuelve: no había dónde preguntar «¿y las 4 piezas?» ni dónde contestar.
--
-- Cómo queda:
--   * ajuste_notas: la conversación de cada ajuste (preguntas de la gerencia y explicaciones).
--   * pedir_explicacion_ajuste: la gerencia de producción o dirección le pide a alguien (por omisión,
--     a quien pidió el ajuste) que explique; le llega como pendiente. Puede ser alguien fuera de
--     almacén (Margarita, que estuvo en el conteo): contesta al marcar el pendiente como hecho.
--   * explicar_ajuste: almacén (o quien tiene el pendiente) escribe la explicación; cierra el
--     pendiente y le avisa a quien preguntó.
--   * Una diferencia que vale más de configuracion.ajustes_inventario.explicacion_desde ($5,000 por
--     omisión) no se aprueba sin explicación. Rechazar sí se puede siempre.
--   * resolver_ajuste_como_traspaso: cuando la explicación es «están en otro almacén», el ajuste se
--     resuelve moviendo las piezas entre almacenes en lugar de darlas por perdidas.
-- =============================================================================

create table if not exists public.ajuste_notas (
  id bigint generated always as identity primary key,
  ajuste_id uuid not null references public.ajustes_inventario(id) on delete cascade,
  tipo text not null check (tipo in ('pregunta', 'explicacion')),
  texto text not null check (length(trim(texto)) >= 5),
  por uuid not null default auth.uid() references public.perfiles(id),
  para uuid references public.perfiles(id),
  en timestamptz not null default now()
);
create index if not exists ajuste_notas_ajuste on public.ajuste_notas (ajuste_id, en);
alter table public.ajuste_notas enable row level security;
drop policy if exists ver on public.ajuste_notas;
create policy ver on public.ajuste_notas for select to authenticated
  using ((select puede('inventario', 1)) or por = (select auth.uid()) or para = (select auth.uid()));
-- Sin política de escritura: solo las funciones de abajo escriben.

insert into public.configuracion (clave, valor, descripcion)
values ('ajustes_inventario', '{"explicacion_desde": 5000}',
  'Ajustes de inventario: desde qué valor (en pesos, faltante o sobrante) una diferencia necesita explicación antes de aprobarse.')
on conflict (clave) do nothing;

-- Si un ajuste necesita explicación: su diferencia vale al menos el umbral. Sin costo no se puede
-- medir y no se exige. Devuelve solo sí/no: quien no ve costos no se entera del valor.
create or replace function public.ajuste_requiere_explicacion(p_ajuste uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(abs(a.diferencia * ca.costo * tc(ca.moneda))
           >= coalesce((select (valor->>'explicacion_desde')::numeric from configuracion where clave = 'ajustes_inventario'), 5000), false)
  from ajustes_inventario a left join costos_articulo ca on ca.articulo_id = a.articulo_id
  where a.id = p_ajuste
$$;
revoke execute on function public.ajuste_requiere_explicacion(uuid) from public, anon;
grant execute on function public.ajuste_requiere_explicacion(uuid) to authenticated;

-- La gerencia le pide a alguien que explique una diferencia. Regresa el pendiente.
create or replace function public.pedir_explicacion_ajuste(p_ajuste uuid, p_a uuid default null, p_pregunta text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare a ajustes_inventario; v_para uuid; v_art articulos; v_alm text; v_p uuid; v_preg text := nullif(trim(p_pregunta), '');
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
             and responsable_id = v_para and estado = 'abierto') then
    raise exception 'A esa persona ya se le pidió la explicación de este ajuste y no ha contestado';
  end if;
  select * into v_art from articulos where id = a.articulo_id;
  select nombre into v_alm from almacenes where id = a.almacen_id;

  insert into pendientes (titulo, detalle, responsable_id, vence, tabla, registro_id, ruta)
  values (format('Explica la diferencia del ajuste %s: %s', a.folio, v_art.nombre),
          format('En %s el sistema decía %s %s y se contaron %s (%s%s). %sEscribe qué pasó o dónde están al marcar este pendiente como hecho.',
                 v_alm, trim_scale(a.cantidad_sistema), coalesce(v_art.unidad, ''), trim_scale(a.cantidad_fisica),
                 case when a.diferencia > 0 then '+' else '' end, trim_scale(a.diferencia),
                 coalesce('Pregunta: ' || v_preg || ' ', '')),
          v_para, hoy_mx() + 2, 'ajustes_inventario', a.id::text, '/almacen/movimientos?vista=ajustes')
  returning id into v_p;
  insert into ajuste_notas (ajuste_id, tipo, texto, para)
  values (a.id, 'pregunta', coalesce(v_preg, 'Explica la diferencia: qué pasó o dónde están.'), v_para);
  return v_p;
end $$;
revoke execute on function public.pedir_explicacion_ajuste(uuid, uuid, text) from public, anon;
grant execute on function public.pedir_explicacion_ajuste(uuid, uuid, text) to authenticated;

-- Almacén, o quien tiene el pendiente de explicarlo, escribe la explicación.
create or replace function public.explicar_ajuste(p_ajuste uuid, p_texto text) returns void
language plpgsql security definer set search_path = public as $$
declare a ajustes_inventario; v_txt text := trim(p_texto);
begin
  select * into a from ajustes_inventario where id = p_ajuste;
  if a.id is null then raise exception 'No existe el ajuste'; end if;
  if not (puede('inventario', 2) or exists (select 1 from pendientes where tabla = 'ajustes_inventario'
          and registro_id = a.id::text and responsable_id = auth.uid() and estado = 'abierto')) then
    raise exception 'La explicación la escribe almacén o a quien se le pidió' using errcode = '42501';
  end if;
  if a.estado <> 'pendiente' then raise exception 'Este ajuste ya se resolvió'; end if;
  if coalesce(length(v_txt), 0) < 10 then raise exception 'Escribe qué pasó o dónde están (al menos una frase)'; end if;
  insert into ajuste_notas (ajuste_id, tipo, texto) values (a.id, 'explicacion', v_txt);
  -- Lo que se pidió queda contestado: se cierran los pendientes de explicarlo (el aviso de «hecho»
  -- le llega a quien preguntó). El disparador de abajo no lo vuelve a anotar.
  perform set_config('hegamex.ajuste_explicado', '1', true);
  update pendientes set estado = 'hecho', nota_cierre = left(v_txt, 500)
  where tabla = 'ajustes_inventario' and registro_id = a.id::text and estado = 'abierto';
  perform set_config('hegamex.ajuste_explicado', '0', true);
end $$;
revoke execute on function public.explicar_ajuste(uuid, text) from public, anon;
grant execute on function public.explicar_ajuste(uuid, text) to authenticated;

-- Quien contesta desde Pendientes («Hecho» con su nota) también deja la explicación en el ajuste.
create or replace function public.pendiente_ajuste_explicado() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.tabla = 'ajustes_inventario' and old.estado = 'abierto' and new.estado = 'hecho'
     and coalesce(current_setting('hegamex.ajuste_explicado', true), '0') <> '1' then
    if coalesce(length(trim(new.nota_cierre)), 0) < 10 then
      raise exception 'Escribe la explicación (qué pasó o dónde están) en la nota al marcarlo como hecho' using errcode = '23514';
    end if;
    insert into ajuste_notas (ajuste_id, tipo, texto, por)
    select a.id, 'explicacion', trim(new.nota_cierre), coalesce(new.cerrado_por, auth.uid())
    from ajustes_inventario a where a.id::text = new.registro_id;
  end if;
  return null;
end $$;
drop trigger if exists ajuste_explicado on public.pendientes;
create trigger ajuste_explicado after update of estado on public.pendientes
  for each row execute function public.pendiente_ajuste_explicado();

-- Al resolver el ajuste ya no hace falta que nadie lo explique: sus pendientes se cancelan.
create or replace function public._cerrar_explicaciones_ajuste(p_ajuste uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform set_config('hegamex.revision', '1', true);
  update pendientes set estado = 'cancelado', nota_cierre = 'El ajuste ya se resolvió'
  where tabla = 'ajustes_inventario' and registro_id = p_ajuste::text and estado = 'abierto';
  perform set_config('hegamex.revision', '0', true);
end $$;
revoke execute on function public._cerrar_explicaciones_ajuste(uuid) from public, anon, authenticated;

-- resolver_ajuste: lo que vale más del umbral no se aprueba sin explicación; al resolver se
-- cancelan los pendientes de explicarlo.
do $$
declare d text; n text;
begin
  d := pg_get_functiondef('public.resolver_ajuste(uuid, boolean, text)'::regprocedure);
  n := replace(d, $a$  if p_aprobar then
    -- Si el artículo$a$, $a$  if p_aprobar and ajuste_requiere_explicacion(a.id)
     and not exists (select 1 from ajuste_notas where ajuste_id = a.id and tipo = 'explicacion') then
    raise exception 'Esta diferencia es de valor alto y nadie la ha explicado: usa «Pedir explicación» o recházala' using errcode = '23514';
  end if;
  if p_aprobar then
    -- Si el artículo$a$);
  if n = d then raise exception 'resolver_ajuste: no encontré dónde revisar la explicación'; end if;
  n := replace(n, $a$  where id = p_ajuste;
end$a$, $a$  where id = p_ajuste;
  perform _cerrar_explicaciones_ajuste(p_ajuste);
end$a$);
  if position('_cerrar_explicaciones_ajuste' in n) = 0 then raise exception 'resolver_ajuste: no encontré el final'; end if;
  execute n;
end $$;

-- Resolver como traspaso: lo que falta aquí está en otro almacén (o lo que sobra aquí salió de
-- otro). Las piezas se mueven entre almacenes en lugar de darse por perdidas o encontradas.
-- Regresa un aviso si el otro almacén tiene su propio ajuste pendiente del mismo artículo.
create or replace function public.resolver_ajuste_como_traspaso(p_ajuste uuid, p_otro integer, p_comentario text default null)
returns text language plpgsql security definer set search_path = public as $$
declare a ajustes_inventario; v_dif numeric; v_aqui numeric; v_alla numeric; v_t uuid := gen_random_uuid();
        v_otro text; v_mot text; v_folio text; v_contado timestamptz;
begin
  if not (tiene_rol('direccion') or tiene_rol('gerente_produccion')) then
    raise exception 'Los ajustes los autoriza la gerencia de producción o dirección: almacén cuenta y los pide' using errcode = '42501';
  end if;
  select * into a from ajustes_inventario where id = p_ajuste for update;
  if a.id is null then raise exception 'No existe el ajuste'; end if;
  if a.estado <> 'pendiente' then raise exception 'Este ajuste ya fue resuelto'; end if;
  if a.solicitado_por = auth.uid() and not tiene_rol('direccion') then
    raise exception 'Un ajuste lo autoriza alguien distinto de quien lo pidió' using errcode = '42501';
  end if;
  if p_otro is null or p_otro = a.almacen_id then raise exception 'Elige el otro almacén'; end if;
  select nombre into v_otro from almacenes where id = p_otro;
  if v_otro is null then raise exception 'No existe ese almacén'; end if;
  v_dif := a.cantidad_fisica - a.cantidad_sistema;
  if v_dif = 0 then raise exception 'Este ajuste no tiene diferencia'; end if;
  if ajuste_requiere_explicacion(a.id) and not exists (select 1 from ajuste_notas where ajuste_id = a.id and tipo = 'explicacion') then
    raise exception 'Esta diferencia es de valor alto y nadie la ha explicado: usa «Pedir explicación» primero' using errcode = '23514';
  end if;
  select l.en into v_contado from conteo_lineas l join conteos c on c.id = l.conteo_id
  where l.articulo_id = a.articulo_id and c.almacen_id = a.almacen_id and l.en > a.solicitado_en and c.id is distinct from a.conteo_id
  limit 1;
  if v_contado is not null then
    raise exception 'Este artículo ya se volvió a contar en este almacén después de pedir el ajuste: recházalo, queda como constancia' using errcode = '23514';
  end if;
  select coalesce(cantidad, 0) into v_aqui from existencias where articulo_id = a.articulo_id and almacen_id = a.almacen_id;
  select coalesce(cantidad, 0) into v_alla from existencias where articulo_id = a.articulo_id and almacen_id = p_otro;
  if v_dif < 0 and coalesce(v_aqui, 0) + v_dif < 0 then
    raise exception 'Con lo que salió después del conteo, aquí quedaría en %: recházalo y que se vuelva a contar', trim_scale(coalesce(v_aqui, 0) + v_dif) using errcode = '23514';
  end if;
  if v_dif > 0 and coalesce(v_alla, 0) < v_dif then
    raise exception 'En % el sistema solo tiene %: no pudieron salir de ahí %', v_otro, trim_scale(coalesce(v_alla, 0)), trim_scale(v_dif) using errcode = '23514';
  end if;

  v_mot := format('Ajuste %s resuelto como traspaso%s', a.folio, coalesce(': ' || nullif(trim(p_comentario), ''), ''));
  -- Solo el movimiento del almacén del ajuste lleva ajuste_id: así «aplicado» es la diferencia y
  -- el valor del ajuste queda en cero (no se perdió nada, cambió de lugar).
  if v_dif < 0 then
    insert into movimientos_inventario (tipo, articulo_id, almacen_id, cantidad, traspaso_id, ajuste_id, motivo)
    values ('traspaso_salida', a.articulo_id, a.almacen_id, v_dif, v_t, a.id, v_mot),
           ('traspaso_entrada', a.articulo_id, p_otro, -v_dif, v_t, null, v_mot);
  else
    insert into movimientos_inventario (tipo, articulo_id, almacen_id, cantidad, traspaso_id, ajuste_id, motivo)
    values ('traspaso_salida', a.articulo_id, p_otro, -v_dif, v_t, null, v_mot),
           ('traspaso_entrada', a.articulo_id, a.almacen_id, v_dif, v_t, a.id, v_mot);
  end if;
  update ajustes_inventario set estado = 'aprobado', resuelto_por = auth.uid(), resuelto_en = now(),
    comentario = format('Traspaso %s %s%s', case when v_dif < 0 then 'a' else 'desde' end, v_otro,
                        coalesce('. ' || nullif(trim(p_comentario), ''), ''))
  where id = a.id;
  perform _cerrar_explicaciones_ajuste(a.id);

  select folio into v_folio from ajustes_inventario
  where articulo_id = a.articulo_id and almacen_id = p_otro and estado = 'pendiente' limit 1;
  return case when v_folio is not null
    then format('En %s hay otro ajuste pendiente de este artículo (%s): revísalo, quizá ya no hace falta.', v_otro, v_folio) end;
end $$;
revoke execute on function public.resolver_ajuste_como_traspaso(uuid, integer, text) from public, anon;
grant execute on function public.resolver_ajuste_como_traspaso(uuid, integer, text) to authenticated;

-- La lista de ajustes trae si necesita explicación y su conversación.
create or replace view public.v_ajustes with (security_invoker = true) as
 SELECT aj.id, aj.folio, aj.articulo_id, a.clave, a.nombre, a.unidad, aj.almacen_id, al.nombre AS almacen,
    aj.cantidad_sistema, aj.cantidad_fisica, aj.diferencia, aj.motivo, aj.conteo_id, co.nombre AS conteo,
    aj.estado, aj.solicitado_por, sp.nombre AS solicitado_por_nombre, aj.solicitado_en, aj.resuelto_por,
    rp.nombre AS resuelto_por_nombre, aj.resuelto_en, aj.comentario, e.cantidad AS existencia_actual,
    CASE WHEN aj.estado = 'aprobado'::text THEN COALESCE(ap.cantidad, 0::numeric) ELSE NULL::numeric END AS aplicado,
    CASE WHEN (SELECT puede('costos'::text, 1)) THEN
      CASE aj.estado WHEN 'aprobado'::text THEN round(COALESCE(va.valor, 0::numeric), 2)
        ELSE round(aj.diferencia * ca.costo * tc(ca.moneda), 2) END
    ELSE NULL::numeric END AS valor_diferencia,
    CASE WHEN aj.estado = 'pendiente' THEN ajuste_requiere_explicacion(aj.id) ELSE false END AS requiere_explicacion,
    COALESCE(n.notas, '[]'::jsonb) AS notas
   FROM ajustes_inventario aj
     JOIN articulos a ON a.id = aj.articulo_id
     JOIN almacenes al ON al.id = aj.almacen_id
     LEFT JOIN conteos co ON co.id = aj.conteo_id
     LEFT JOIN perfiles sp ON sp.id = aj.solicitado_por
     LEFT JOIN perfiles rp ON rp.id = aj.resuelto_por
     LEFT JOIN existencias e ON e.articulo_id = aj.articulo_id AND e.almacen_id = aj.almacen_id
     LEFT JOIN costos_articulo ca ON ca.articulo_id = aj.articulo_id
     LEFT JOIN LATERAL (SELECT sum(m.cantidad) AS cantidad FROM movimientos_inventario m WHERE m.ajuste_id = aj.id) ap ON true
     LEFT JOIN valor_ajustes() va(ajuste_id, valor) ON va.ajuste_id = aj.id
     LEFT JOIN LATERAL (SELECT jsonb_agg(jsonb_build_object('tipo', x.tipo, 'texto', x.texto, 'en', x.en,
                 'por', (SELECT nombre FROM perfiles WHERE id = x.por), 'para', (SELECT nombre FROM perfiles WHERE id = x.para))
                 ORDER BY x.en) AS notas
               FROM ajuste_notas x WHERE x.ajuste_id = aj.id) n ON true;

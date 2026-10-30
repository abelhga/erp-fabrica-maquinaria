-- Tres cosas chicas que salieron el mismo día:
--
-- 1. El material de una orden de producción trae la categoría de cada artículo. Miguel pidió ver
--    juntas las cosas eléctricas, las de aire, la tornillería…: en un Zeus de 185 partidas,
--    agrupadas solo por subensamble, encontrar «todo lo eléctrico» era leer la lista entera.
-- 2. En pantalla no se nombra al proveedor de la IA (puede cambiar): las notas de la revisión,
--    las descripciones de configuración y las mejoras que sugiere la IA dicen «IA».
-- 3. Lo urgente de la revisión nocturna también queda como pendiente, con fecha para el siguiente
--    día hábil. «Por revisar» es nuevo y la gente ya vive en Pendientes: ahí se pone rojo si se
--    vence, el ERP recuerda solo y cuenta para «pendientes a tiempo». Contestar en cualquiera de
--    los dos cierra el otro; «Está bien así» lo cancela, para que una falsa alarma no cuente en
--    contra de nadie.

-- 1. ---------------------------------------------------------------------------------------
create or replace view public.v_op_material with (security_invoker = true) as
select m.id, m.orden_id, m.articulo_id, a.clave, a.nombre, a.unidad, m.requerido, m.surtido, m.ruta, m.agregado, m.notas,
  coalesce(r.apartado, 0) as apartado,
  case when t.del_taller then 0 else greatest(m.requerido - m.surtido - coalesce(r.apartado, 0), 0) end as faltante,
  public.pedido_a_compras_op(m.orden_id, m.articulo_id) as pedido_a_compras,
  coalesce(e.en_planta, 0) as existencia_planta,
  case when t.del_taller then 0 else greatest(m.requerido - m.surtido, 0) end as por_surtir,
  greatest(coalesce(e.en_planta, 0) - coalesce((select sum(x.cantidad - x.surtido) from public.reservas x
                                                where x.articulo_id = m.articulo_id and x.estado = 'activa'), 0), 0) as disponible_planta,
  a.tipo,
  t.del_taller,
  c.nombre as categoria
from public.op_materiales m
join public.articulos a on a.id = m.articulo_id
left join public.categorias c on c.id = a.categoria_id
cross join lateral (select coalesce(c.consumible_taller, false) and (select public.consumibles_del_taller()) as del_taller) t
left join lateral (select sum(cantidad - surtido) apartado from public.reservas
                   where orden_produccion_id = m.orden_id and articulo_id = m.articulo_id and estado = 'activa') r on true
left join lateral (select sum(x.cantidad) en_planta from public.existencias x join public.almacenes al on al.id = x.almacen_id
                   where x.articulo_id = m.articulo_id and al.disponible_para_planta) e on true;

-- 2. ---------------------------------------------------------------------------------------
update public.configuracion set descripcion = 'Asistente con IA. limite_diario = consultas por persona al día; modelo y esfuerzo, los que usa.'
where clave = 'asistente';
update public.configuracion set descripcion = 'Revisión nocturna: reglas, lectura de la IA y consejos semanales'
where clave = 'revision_nocturna';

create or replace function public.revision_anotar_error(p_corrida bigint, p_nota text, p_sigue boolean default false) returns void
language sql security definer set search_path = public as $$
  update revision_corridas set nota = left(coalesce(nota || ' ', '') || p_nota, 1000),
         claude_estado = case when p_sigue then claude_estado
                              when p_nota ~ '^(IA|Claude): apagado' then 'apagado' when p_nota ~ '^(IA|Claude): tope' then 'tope' else 'error' end
  where id = p_corrida
$$;
revoke execute on function public.revision_anotar_error(bigint, text, boolean) from public, anon, authenticated;

create or replace function public.revision_recoger_disparar() returns void
language plpgsql security definer set search_path = public as $$
declare c record;
begin
  for c in select * from revision_corridas where termino_en is null and empezo_en > now() - interval '2 days' loop
    if c.claude_estado = 'enviado' and c.lote_id is not null and now() - c.empezo_en < interval '6 hours 30 minutes' then
      perform revision_disparar('recoger');
    else
      if c.claude_estado in ('enviado', 'no') then
        update revision_corridas set claude_estado = 'error', nota = coalesce(nota || ' ', '') || 'La IA no regresó a tiempo.' where id = c.id;
      end if;
      perform revision_terminar(c.id, 0, 0);
    end if;
  end loop;
end $$;
revoke execute on function public.revision_recoger_disparar() from public, anon, authenticated;

-- 3. ---------------------------------------------------------------------------------------
-- Un pendiente de la revisión no lo pidió una persona: no tiene creado_por (nadie recibe el «Listo»).
alter table public.pendientes alter column creado_por drop not null;
alter table public.pendientes add constraint pendientes_quien_pide
  check (creado_por is not null or tabla = 'revision_hallazgos');

-- Las reglas de siempre (071 y las que se agregaron), más una: el de la revisión no se cambia ni
-- se cancela desde Pendientes. Se marca hecho ahí, o se contesta en «Por revisar».
create or replace function public.pendiente_reglas() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_yo uuid := auth.uid();
begin
  if v_yo is null then return new; end if;  -- funciones internas y migraciones
  if old.estado <> 'abierto' then raise exception 'Este pendiente ya se cerró' using errcode = '42501'; end if;
  if old.tabla = 'revision_hallazgos' and coalesce(current_setting('hegamex.revision', true), '') <> '1' then
    if new.estado not in ('abierto', 'hecho')
       or (new.titulo, new.detalle, new.responsable_id, new.vence, new.tabla, new.registro_id, new.ruta, new.creado_por)
          is distinct from (old.titulo, old.detalle, old.responsable_id, old.vence, old.tabla, old.registro_id, old.ruta, old.creado_por) then
      raise exception 'Este pendiente lo puso la revisión nocturna: si no es error, contéstalo en «Por revisar»' using errcode = '42501';
    end if;
    if new.estado <> 'abierto' then new.cerrado_por := v_yo; new.cerrado_en := now(); end if;
    return new;
  end if;
  if new.creado_por is distinct from old.creado_por then raise exception 'No se cambia quién pidió el pendiente' using errcode = '42501'; end if;
  if (new.grupo_id, new.modo) is distinct from (old.grupo_id, old.modo) then
    raise exception 'No se cambia a quiénes se pidió ni cómo se cierra' using errcode = '42501';
  end if;
  if v_yo is distinct from old.creado_por and (new.titulo, new.detalle, new.responsable_id, new.vence, new.tabla, new.registro_id, new.ruta)
       is distinct from (old.titulo, old.detalle, old.responsable_id, old.vence, old.tabla, old.registro_id, old.ruta)
       and coalesce(current_setting('hegamex.revision', true), '') <> '1' then
    raise exception 'Solo quien pidió el pendiente lo puede cambiar' using errcode = '42501';
  end if;
  if new.estado = 'cancelado' and v_yo is distinct from old.creado_por and coalesce(current_setting('hegamex.revision', true), '') <> '1' then
    raise exception 'Solo quien pidió el pendiente lo puede cancelar' using errcode = '42501';
  end if;
  if new.esperando_respuesta is distinct from old.esperando_respuesta and coalesce(current_setting('hegamex.pregunta', true), '') <> '1' then
    raise exception '«Esperando respuesta» lo pone el ERP al preguntar y lo quita al responder' using errcode = '42501';
  end if;
  if new.estado = 'cubierto' and coalesce(current_setting('hegamex.cubrir', true), '') <> '1' then
    raise exception '«Lo hizo otro» lo marca el ERP cuando alguien del grupo lo termina' using errcode = '42501';
  end if;
  if new.estado <> 'abierto' then new.cerrado_por := v_yo; new.cerrado_en := now(); end if;
  return new;
end $$;

-- El aviso de «pendiente nuevo» dice de dónde viene aunque no lo haya pedido una persona.
create or replace function public.aviso_pendiente() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_de text; v_hechos int; v_total int;
begin
  if tg_op = 'INSERT' or new.responsable_id is distinct from old.responsable_id then
    select nombre into v_de from perfiles where id = new.creado_por;
    perform avisar(array[new.responsable_id], 'pendiente_nuevo', new.titulo,
      format('De %s%s', coalesce(v_de, case when new.creado_por is null then 'la revisión nocturna' else 'alguien' end),
             coalesce(' · para el ' || to_char(new.vence, 'DD/MM'), '')),
      coalesce(new.ruta, '/pendientes'), 'pendientes', new.id::text);
  elsif new.estado <> old.estado and new.estado = 'hecho' then
    select nombre into v_de from perfiles where id = new.cerrado_por;
    if new.modo = 'todos' then
      select count(*) filter (where estado = 'hecho'), count(*) filter (where estado <> 'cancelado')
        into v_hechos, v_total from pendientes where grupo_id = new.grupo_id;
      perform avisar(array[new.creado_por], 'pendiente_hecho',
        case when v_hechos >= v_total then 'Listo, todos: ' else format('Listo %s de %s: ', v_hechos, v_total) end || new.titulo,
        format('%s%s', coalesce(v_de, ''), coalesce(' · ' || new.nota_cierre, '')),
        coalesce(new.ruta, '/pendientes'), 'pendientes', new.id::text);
    else
      perform avisar(array[new.creado_por], 'pendiente_hecho', 'Listo: ' || new.titulo,
        format('%s%s', coalesce(v_de, ''), coalesce(' · ' || new.nota_cierre, '')),
        coalesce(new.ruta, '/pendientes'), 'pendientes', new.id::text);
    end if;
  end if;
  return new;
end $$;

-- Lo urgente de una corrida, a Pendientes: uno por responsable, para el siguiente día hábil.
create or replace function public.revision_crear_pendientes(p_corrida bigint) returns int
language plpgsql security definer set search_path = public as $$
declare v_n int; v_vence date := sumar_dias_laborables((now() at time zone 'America/Mexico_City')::date, 1);
begin
  insert into pendientes (titulo, detalle, responsable_id, creado_por, vence, tabla, registro_id, ruta)
  select left('Revisar: ' || h.titulo, 200), h.detalle, u, null, v_vence, 'revision_hallazgos', h.id::text, '/revision'
  from revision_hallazgos h, unnest(h.responsables) u
  where h.corrida_id = p_corrida and h.estado = 'abierto' and h.gravedad = 'alta' and h.para = 'responsable'
    and not exists (select 1 from pendientes p where p.tabla = 'revision_hallazgos' and p.registro_id = h.id::text and p.responsable_id = u);
  get diagnostics v_n = row_count;
  return v_n;
end $$;
revoke execute on function public.revision_crear_pendientes(bigint) from public, anon, authenticated;

create or replace function public.revision_terminar(p_corrida bigint, p_entrada bigint, p_salida bigint) returns void
language plpgsql security definer set search_path = public as $$
declare r record; v_dir uuid[];
begin
  if (select termino_en from revision_corridas where id = p_corrida) is not null then return; end if;
  update revision_corridas set termino_en = now(), entrada_tokens = entrada_tokens + coalesce(p_entrada, 0),
         salida_tokens = salida_tokens + coalesce(p_salida, 0),
         claude_estado = case when claude_estado = 'enviado' and coalesce(p_entrada, 0) > 0 then 'recogido' else claude_estado end
  where id = p_corrida;

  perform revision_crear_pendientes(p_corrida);

  for r in
    select u, count(*) n, string_agg(h.titulo, ' · ' order by h.gravedad = 'alta' desc, h.creado_en) titulos
    from revision_hallazgos h, unnest(h.responsables) u
    where h.corrida_id = p_corrida and h.estado = 'abierto' and h.para = 'responsable'
    group by u
  loop
    perform avisar(array[r.u], 'revision',
      case when r.n = 1 then 'La revisión de anoche encontró 1 cosa por revisar' else format('La revisión de anoche encontró %s cosas por revisar', r.n) end,
      left(r.titulos, 400), '/revision', 'revision_corridas', p_corrida::text, true);
  end loop;

  v_dir := (select array_agg(u) from usuarios_con_rol('direccion') u);
  select count(*) n, count(*) filter (where para = 'direccion') patrones into r
  from revision_hallazgos where corrida_id = p_corrida and estado = 'abierto';
  if r.n > 0 then
    perform avisar(v_dir, 'revision', format('Revisión de anoche: %s hallazgo(s), %s para ti', r.n, r.patrones),
      'Cada responsable ya tiene lo suyo en «Por revisar». Los patrones solo los ves tú.', '/revision', 'revision_corridas', p_corrida::text, true);
  end if;

  perform avisar(array(select distinct usuario_id from consejos where corrida_id = p_corrida), 'consejos',
    'Tus consejos de la semana', 'Están en tu Inicio. Dinos si te sirvieron.', '/', 'revision_corridas', p_corrida::text, true);
end $$;
revoke execute on function public.revision_terminar(bigint, bigint, bigint) from public, anon, authenticated;

-- Contestar el hallazgo cierra sus pendientes: quien contestó lo hizo («hecho»); a los demás
-- responsables ya no les toca («cubierto»); «Está bien así» los cancela (no cuenta para nadie);
-- lo que se corrigió solo, «hecho».
create or replace function public.revision_cerrar_pendientes() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_yo uuid := auth.uid();
begin
  if old.estado <> 'abierto' or new.estado = 'abierto' then return null; end if;
  perform set_config('hegamex.revision', '1', true);
  perform set_config('hegamex.cubrir', '1', true);
  update pendientes p set
    estado = case when new.estado = 'bien_asi' then 'cancelado'
                  when new.estado = 'corregido' and v_yo is not null and p.responsable_id <> v_yo then 'cubierto'
                  else 'hecho' end,
    nota_cierre = case when new.estado = 'bien_asi' then 'No era error: ' || coalesce(new.respuesta, 'está bien así')
                       when new.estado = 'resuelto' then 'Se corrigió (lo vio la revisión)'
                       when p.responsable_id <> coalesce(v_yo, p.responsable_id) then 'Lo corrigió ' || coalesce(revision_nombre(v_yo), 'otra persona')
                       else new.respuesta end,
    cerrado_en = coalesce(p.cerrado_en, now())
  where p.tabla = 'revision_hallazgos' and p.registro_id = new.id::text and p.estado = 'abierto';
  perform set_config('hegamex.revision', '0', true);
  perform set_config('hegamex.cubrir', '0', true);
  return null;
end $$;
create trigger cerrar_pendientes after update of estado on public.revision_hallazgos
  for each row execute function public.revision_cerrar_pendientes();

-- Y al revés: marcar hecho el pendiente en Pendientes es «Ya lo corregí».
create or replace function public.pendiente_revision_hecho() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.tabla = 'revision_hallazgos' and old.estado = 'abierto' and new.estado = 'hecho' then
    update revision_hallazgos set estado = 'corregido', respuesta = coalesce(new.nota_cierre, respuesta),
           cerrado_en = now(), cerrado_por = new.cerrado_por
    where id::text = new.registro_id and estado = 'abierto';
  end if;
  return null;
end $$;
create trigger revision_hecho after update of estado on public.pendientes
  for each row execute function public.pendiente_revision_hecho();

-- 4. ---------------------------------------------------------------------------------------
-- Las mejoras que sugiere la IA se guardaban como «Claude (sugerencia)»; ahora «IA (sugerencia)».
-- El indicador «ideas de mejora» no cambia: solo cuenta las que no dicen quién propone o dicen el
-- nombre de la persona, así que una sugerencia de la IA no cuenta con ninguna de las dos etiquetas.
update public.mejoras set quien_propone = 'IA (sugerencia)' where quien_propone ilike 'claude%';
update public.avisos set cuerpo = regexp_replace(cuerpo, '^Propone Claude \(sugerencia\)', 'Propone IA (sugerencia)')
where tipo = 'mejora_nueva' and cuerpo like 'Propone Claude (sugerencia)%';
update public.revision_corridas set nota = replace(replace(nota, 'Claude no regresó', 'La IA no regresó'), 'Claude: ', 'IA: ')
where nota like '%Claude%';

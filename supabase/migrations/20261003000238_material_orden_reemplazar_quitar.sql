-- =============================================================================
-- Material de una orden de producción: agregar un subensamble, reemplazar y quitar con constancia.
--
-- Por qué (Miguel, ingeniería): los cambios de una orden se hacían solo con componentes sueltos,
-- corrigiendo la cantidad a 0 o agregando otro renglón; nadie sabía después qué se cambió por qué.
--   * Agregar un subensamble completo: «para fabricarlo aquí» entran sus componentes (con su ruta,
--     para que se agrupen bajo ese subensamble) o «ya hecho» sale del almacén como una pieza.
--   * Reemplazar: el renglón de antes queda tachado con «Reemplazado por …» y el nuevo dice a quién
--     reemplaza.
--   * Quitar: el renglón no se borra; queda tachado con quién, cuándo y por qué. Su cantidad pasa a 0
--     (libera lo apartado y deja de pedirse a compras) y se puede volver a poner.
-- Cada cambio queda una vez en la línea de tiempo de la orden, con su motivo.
-- =============================================================================

alter table public.op_materiales
  add column if not exists quitado_en timestamptz,
  add column if not exists quitado_por uuid references public.perfiles(id),
  add column if not exists motivo_quitado text,
  add column if not exists requerido_antes numeric(14,3),
  add column if not exists reemplaza_a uuid references public.op_materiales(id) on delete set null;
comment on column public.op_materiales.quitado_en is 'Se quitó de esta orden (queda tachado como constancia); requerido_antes guarda cuánto llevaba.';
comment on column public.op_materiales.reemplaza_a is 'El renglón de esta orden que este material reemplazó.';

-- El disparador de 040, con silencio para que las funciones de abajo anoten un solo evento.
create or replace function public.trg_op_material_cambio() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_estado estado_op; v_exceso numeric; v_quita numeric; r reservas; v_nombre text; v_unidad text;
begin
  select estado into v_estado from ordenes_produccion where id = coalesce(new.orden_id, old.orden_id);
  -- Borrado en cascada de la orden completa: no hay a quién contarle el cambio.
  if v_estado is null then return coalesce(new, old); end if;
  -- La orden recién creada inserta su lista antes de su evento "creada": eso no es un cambio.
  if not exists (select 1 from op_eventos where orden_id = coalesce(new.orden_id, old.orden_id) and tipo = 'creada') then
    return coalesce(new, old);
  end if;
  if v_estado in ('terminada', 'entregada', 'cancelada') then
    raise exception 'La orden ya está cerrada: su lista de materiales no se cambia';
  end if;
  select nombre, unidad into v_nombre, v_unidad from articulos where id = coalesce(new.articulo_id, old.articulo_id);

  if tg_op = 'INSERT' then
    if new.requerido > 0 then
      if coalesce(current_setting('hegamex.op_material_silencio', true), '') <> 'si' then
    insert into op_eventos (orden_id, tipo, nota)
      values (new.orden_id, 'cambio_material', format('Se agregó %s %s de %s', trim_scale(new.requerido), v_unidad, v_nombre)
                                               || coalesce(' (' || nullif(trim(new.notas), '') || ')', ''));
    end if;
    end if;
    return new;
  elsif tg_op = 'DELETE' then
    if old.surtido > 0 then raise exception 'De "%" ya se surtió material: no se puede quitar de la lista', v_nombre; end if;
    update reservas set estado = 'liberada' where orden_produccion_id = old.orden_id and articulo_id = old.articulo_id and estado = 'activa';
    insert into op_eventos (orden_id, tipo, nota) values (old.orden_id, 'cambio_material', format('Se quitó %s de la lista', v_nombre));
    return old;
  end if;

  if new.requerido is distinct from old.requerido then
    if coalesce(current_setting('hegamex.op_material_silencio', true), '') <> 'si' then
      insert into op_eventos (orden_id, tipo, nota)
      values (new.orden_id, 'cambio_material', format('%s: %s → %s %s', v_nombre, trim_scale(old.requerido), trim_scale(new.requerido), v_unidad));
    end if;
    select new.surtido + coalesce(sum(cantidad - surtido), 0) - new.requerido into v_exceso
    from reservas where orden_produccion_id = new.orden_id and articulo_id = new.articulo_id and estado = 'activa';
    for r in select * from reservas where orden_produccion_id = new.orden_id and articulo_id = new.articulo_id and estado = 'activa'
             order by creado_en desc for update loop
      exit when v_exceso <= 0;
      v_quita := least(v_exceso, r.cantidad - r.surtido);
      if r.surtido = 0 and v_quita >= r.cantidad then
        update reservas set estado = 'liberada' where id = r.id;
      elsif r.cantidad - v_quita <= r.surtido then
        update reservas set cantidad = r.surtido, estado = 'surtida' where id = r.id;
      else
        update reservas set cantidad = r.cantidad - v_quita where id = r.id;
      end if;
      v_exceso := v_exceso - v_quita;
    end loop;
  end if;
  return new;
end $$;

-- Quién cambia la lista de una orden: lo mismo que la política «editar» de op_materiales.
create or replace function public.op_material_validar(p_op uuid) returns void
language plpgsql stable security definer set search_path = public as $$
declare v_estado estado_op;
begin
  if not (puede('costeo', 2) or puede('produccion', 3)) then
    raise exception 'Solo ingeniería o la gerencia de producción cambian el material de una orden' using errcode = '42501';
  end if;
  select estado into v_estado from ordenes_produccion where id = p_op;
  if v_estado is null then raise exception 'No existe la orden'; end if;
  if v_estado in ('terminada', 'entregada', 'cancelada') then
    raise exception 'La orden ya está cerrada: su lista de materiales no se cambia';
  end if;
end $$;
revoke execute on function public.op_material_validar(uuid) from public, anon;

-- Pone (o suma) un artículo en la lista de la orden. Si estaba quitado, lo vuelve a poner con la
-- cantidad nueva. Sin revisar permisos ni anotar evento: lo hacen quienes la llaman.
create or replace function public.op_material_poner(p_op uuid, p_articulo uuid, p_cantidad numeric, p_ruta text,
  p_nota text, p_reemplaza uuid, p_sumar boolean) returns uuid
language plpgsql security definer set search_path = public as $$
declare m op_materiales;
begin
  select * into m from op_materiales where orden_id = p_op and articulo_id = p_articulo for update;
  if m.id is null then
    insert into op_materiales (orden_id, articulo_id, requerido, ruta, agregado, notas, reemplaza_a)
    values (p_op, p_articulo, round(p_cantidad, 3), p_ruta, true, nullif(trim(p_nota), ''), p_reemplaza)
    returning id into m.id;
  elsif m.quitado_en is not null then
    update op_materiales set requerido = round(p_cantidad, 3), quitado_en = null, quitado_por = null, motivo_quitado = null,
      requerido_antes = null, agregado = true, notas = coalesce(nullif(trim(p_nota), ''), notas), reemplaza_a = coalesce(p_reemplaza, reemplaza_a)
    where id = m.id;
  elsif p_sumar then
    update op_materiales set requerido = round(requerido + p_cantidad, 3),
      notas = left(concat_ws(' · ', nullif(trim(notas), ''), nullif(trim(p_nota), '')), 500), reemplaza_a = coalesce(reemplaza_a, p_reemplaza)
    where id = m.id;
  else
    raise exception '«%» ya está en la lista: corrige su cantidad en la tabla', (select nombre from articulos where id = p_articulo);
  end if;
  return m.id;
end $$;
revoke execute on function public.op_material_poner(uuid, uuid, numeric, text, text, uuid, boolean) from public, anon, authenticated;

create or replace function public.agregar_material_orden(p_op uuid, p_articulo uuid, p_cantidad numeric, p_motivo text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare a articulos; v uuid;
begin
  perform op_material_validar(p_op);
  select * into a from articulos where id = p_articulo;
  if a.id is null or a.tipo not in ('componente', 'materia_prima', 'subensamble') then
    raise exception 'A una orden se agregan componentes, materia prima o subensambles';
  end if;
  if coalesce(p_cantidad, 0) <= 0 then raise exception 'Escribe cuántos lleva'; end if;
  perform set_config('hegamex.op_material_silencio', 'si', true);
  v := op_material_poner(p_op, p_articulo, p_cantidad, null, p_motivo, null, false);
  perform set_config('hegamex.op_material_silencio', '', true);
  insert into op_eventos (orden_id, tipo, nota) values (p_op, 'cambio_material',
    format('Se agregó %s %s de %s', trim_scale(round(p_cantidad, 3)), a.unidad, a.nombre) || coalesce(' (' || nullif(trim(p_motivo), '') || ')', ''));
  return v;
end $$;

-- «fabricar»: entran sus componentes y materia prima (como al crear la orden), sumándose a lo que
-- ya estaba. «pieza»: el subensamble ya hecho sale del almacén como un renglón.
create or replace function public.agregar_subensamble_orden(p_op uuid, p_subensamble uuid, p_cantidad numeric,
  p_motivo text default null, p_como text default 'fabricar') returns int
language plpgsql security definer set search_path = public as $$
declare a articulos; e record; v_n int := 0;
begin
  perform op_material_validar(p_op);
  select * into a from articulos where id = p_subensamble;
  if a.id is null or a.tipo <> 'subensamble' then raise exception 'Elige un subensamble'; end if;
  if coalesce(p_cantidad, 0) <= 0 then raise exception 'Escribe cuántos lleva'; end if;
  if p_como not in ('fabricar', 'pieza') then raise exception 'Di si se fabrica aquí o ya está hecho'; end if;
  perform set_config('hegamex.op_material_silencio', 'si', true);
  if p_como = 'pieza' then
    perform op_material_poner(p_op, p_subensamble, p_cantidad, null, p_motivo, null, true);
    v_n := 1;
  else
    if not exists (select 1 from bom_lineas where padre_id = p_subensamble) then
      raise exception '«%» no tiene lista de materiales: ingeniería tiene que capturarla, o agrégalo como ya hecho', a.nombre;
    end if;
    for e in select * from explotar_materiales(p_subensamble, p_cantidad) loop
      perform op_material_poner(p_op, e.articulo_id, e.cantidad, e.ruta,
        format('Del subensamble %s', a.nombre) || coalesce(': ' || nullif(trim(p_motivo), ''), ''), null, true);
      v_n := v_n + 1;
    end loop;
  end if;
  perform set_config('hegamex.op_material_silencio', '', true);
  insert into op_eventos (orden_id, tipo, nota) values (p_op, 'cambio_material',
    case when p_como = 'pieza' then format('Se agregó el subensamble %s ×%s, ya hecho', a.nombre, trim_scale(round(p_cantidad, 3)))
         else format('Se agregó el subensamble %s ×%s para fabricarlo aquí: %s partida(s)', a.nombre, trim_scale(round(p_cantidad, 3)), v_n) end
    || coalesce(' (' || nullif(trim(p_motivo), '') || ')', ''));
  return v_n;
end $$;

-- Quitar no borra: deja el renglón tachado. Lo que ya se surtió se queda contado como surtido
-- (salió del almacén); el aviso dice que hay que regresarlo.
create or replace function public.op_material_quitar(m op_materiales, p_motivo text) returns void
language plpgsql security definer set search_path = public as $$
begin
  update op_materiales set requerido_antes = requerido, requerido = 0, quitado_en = now(), quitado_por = auth.uid(),
    motivo_quitado = trim(p_motivo)
  where id = m.id;
end $$;
revoke execute on function public.op_material_quitar(op_materiales, text) from public, anon, authenticated;

create or replace function public.quitar_material_orden(p_material uuid, p_motivo text) returns void
language plpgsql security definer set search_path = public as $$
declare m op_materiales; a articulos;
begin
  select * into m from op_materiales where id = p_material for update;
  if m.id is null then raise exception 'Ese material ya no está en la orden'; end if;
  perform op_material_validar(m.orden_id);
  if m.quitado_en is not null then raise exception 'Ya estaba quitado'; end if;
  if length(trim(coalesce(p_motivo, ''))) < 3 then raise exception 'Escribe por qué se quita: queda como constancia'; end if;
  select * into a from articulos where id = m.articulo_id;
  perform set_config('hegamex.op_material_silencio', 'si', true);
  perform op_material_quitar(m, p_motivo);
  perform set_config('hegamex.op_material_silencio', '', true);
  insert into op_eventos (orden_id, tipo, nota) values (m.orden_id, 'cambio_material',
    format('Se quitó %s (llevaba %s %s): %s', a.nombre, trim_scale(m.requerido), a.unidad, trim(p_motivo))
    || case when m.surtido > 0 then format('. Ya se habían surtido %s: hay que regresarlos al almacén', trim_scale(m.surtido)) else '' end);
end $$;

create or replace function public.reemplazar_material_orden(p_material uuid, p_articulo uuid, p_cantidad numeric, p_motivo text)
returns uuid language plpgsql security definer set search_path = public as $$
declare m op_materiales; a_viejo articulos; a_nuevo articulos; v uuid;
begin
  select * into m from op_materiales where id = p_material for update;
  if m.id is null then raise exception 'Ese material ya no está en la orden'; end if;
  perform op_material_validar(m.orden_id);
  if m.quitado_en is not null then raise exception 'Ese material ya estaba quitado o reemplazado'; end if;
  if m.articulo_id = p_articulo then raise exception 'Elige un material distinto'; end if;
  select * into a_nuevo from articulos where id = p_articulo;
  if a_nuevo.id is null or a_nuevo.tipo not in ('componente', 'materia_prima', 'subensamble') then
    raise exception 'Se reemplaza con un componente, materia prima o subensamble';
  end if;
  if coalesce(p_cantidad, 0) <= 0 then raise exception 'Escribe cuántos lleva'; end if;
  if length(trim(coalesce(p_motivo, ''))) < 3 then raise exception 'Escribe por qué se reemplaza: queda como constancia'; end if;
  select * into a_viejo from articulos where id = m.articulo_id;
  perform set_config('hegamex.op_material_silencio', 'si', true);
  perform op_material_quitar(m, p_motivo);
  v := op_material_poner(m.orden_id, p_articulo, p_cantidad, m.ruta, trim(p_motivo), m.id, true);
  perform set_config('hegamex.op_material_silencio', '', true);
  insert into op_eventos (orden_id, tipo, nota) values (m.orden_id, 'cambio_material',
    format('Se reemplazó %s (%s %s) por %s (%s %s): %s', a_viejo.nombre, trim_scale(m.requerido), a_viejo.unidad,
           a_nuevo.nombre, trim_scale(round(p_cantidad, 3)), a_nuevo.unidad, trim(p_motivo))
    || case when m.surtido > 0 then format('. Del anterior ya se habían surtido %s: hay que regresarlos al almacén', trim_scale(m.surtido)) else '' end);
  return v;
end $$;

-- Deshacer un «quitar» hecho por error. Si se había reemplazado, el reemplazo sigue (quítalo aparte).
create or replace function public.reponer_material_orden(p_material uuid) returns void
language plpgsql security definer set search_path = public as $$
declare m op_materiales; a articulos;
begin
  select * into m from op_materiales where id = p_material for update;
  if m.id is null then raise exception 'Ese material ya no está en la orden'; end if;
  perform op_material_validar(m.orden_id);
  if m.quitado_en is null then raise exception 'Ese material no está quitado'; end if;
  select * into a from articulos where id = m.articulo_id;
  perform set_config('hegamex.op_material_silencio', 'si', true);
  update op_materiales set requerido = coalesce(requerido_antes, 0), requerido_antes = null, quitado_en = null, quitado_por = null, motivo_quitado = null
  where id = m.id;
  perform set_config('hegamex.op_material_silencio', '', true);
  insert into op_eventos (orden_id, tipo, nota) values (m.orden_id, 'cambio_material',
    format('Se volvió a poner %s (%s %s)', a.nombre, trim_scale(coalesce(m.requerido_antes, 0)), a.unidad));
end $$;

revoke execute on function public.agregar_material_orden(uuid, uuid, numeric, text) from public, anon;
revoke execute on function public.agregar_subensamble_orden(uuid, uuid, numeric, text, text) from public, anon;
revoke execute on function public.quitar_material_orden(uuid, text) from public, anon;
revoke execute on function public.reemplazar_material_orden(uuid, uuid, numeric, text) from public, anon;
revoke execute on function public.reponer_material_orden(uuid) from public, anon;
grant execute on function public.agregar_material_orden(uuid, uuid, numeric, text) to authenticated;
grant execute on function public.agregar_subensamble_orden(uuid, uuid, numeric, text, text) to authenticated;
grant execute on function public.quitar_material_orden(uuid, text) to authenticated;
grant execute on function public.reemplazar_material_orden(uuid, uuid, numeric, text) to authenticated;
grant execute on function public.reponer_material_orden(uuid) to authenticated;

-- La vista de 210 con lo quitado y lo reemplazado al final.
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
  c.nombre as categoria,
  m.quitado_en, m.motivo_quitado, pq.nombre as quitado_por, m.requerido_antes, m.reemplaza_a,
  (select a2.nombre from public.op_materiales m2 join public.articulos a2 on a2.id = m2.articulo_id where m2.id = m.reemplaza_a) as reemplaza_a_nombre,
  (select a3.nombre from public.op_materiales m3 join public.articulos a3 on a3.id = m3.articulo_id where m3.reemplaza_a = m.id limit 1) as reemplazado_por
from public.op_materiales m
left join public.perfiles pq on pq.id = m.quitado_por
join public.articulos a on a.id = m.articulo_id
left join public.categorias c on c.id = a.categoria_id
cross join lateral (select coalesce(c.consumible_taller, false) and (select public.consumibles_del_taller()) as del_taller) t
left join lateral (select sum(cantidad - surtido) apartado from public.reservas
                   where orden_produccion_id = m.orden_id and articulo_id = m.articulo_id and estado = 'activa') r on true
left join lateral (select sum(x.cantidad) en_planta from public.existencias x join public.almacenes al on al.id = x.almacen_id
                   where x.articulo_id = m.articulo_id and al.disponible_para_planta) e on true;
grant select on public.v_op_material to authenticated;

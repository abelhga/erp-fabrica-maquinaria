-- =============================================================================
-- «Solicitar cambio a ingeniería» le llega a ingeniería como pendiente.
--
-- Por qué: la solicitud se guardaba y se anotaba en la historia de la orden, pero no avisaba a
-- nadie. Ingeniería solo la veía si entraba a Equipos → Solicitudes de cambio: el 3 nov había tres
-- de almacén esperando (una del 29 oct) y Miguel no sabía. Ahora cada solicitud nueva es un
-- pendiente para ingeniería (con su aviso en la campana), pedido a nombre de quien la mandó, para
-- dentro de dos días hábiles. Si hay varias personas en ingeniería, basta con que una lo haga.
--
-- Al aplicarla o descartarla (desde la orden o desde Equipos) el pendiente se cierra solo con lo
-- que se hizo, y a quien la pidió le llega el «Listo» de siempre. Las que ya esperaban reciben su
-- pendiente al aplicar esta migración.
-- =============================================================================

create or replace function public.pendiente_de_solicitud_cambio(s public.solicitudes_cambio_bom) returns int
language plpgsql security definer set search_path = public as $$
declare v_ing uuid[]; v_grupo uuid; v_art text; v_op text; n int;
begin
  -- Ingeniería activa, sin contar a quien la pidió (no se pide algo a sí mismo).
  select array_agg(distinct u) into v_ing from usuarios_con_rol('ingenieria') u where u is distinct from s.solicitado_por;
  if v_ing is null then return 0; end if;
  if exists (select 1 from pendientes where tabla = 'solicitudes_cambio_bom' and registro_id = s.id::text) then return 0; end if;
  select clave || ' ' || nombre into v_art from articulos where id = s.articulo_id;
  select folio into v_op from ordenes_produccion where id = s.orden_id;
  v_grupo := case when cardinality(v_ing) > 1 then gen_random_uuid() end;
  insert into pendientes (titulo, detalle, responsable_id, creado_por, vence, tabla, registro_id, ruta, grupo_id, modo)
  select left(format('Corregir la lista de %s%s', v_art, coalesce(' (' || v_op || ')', '')), 200),
         s.descripcion || E'\n\nAplícalo o descártalo en Equipos → Solicitudes de cambio (o desde la orden): el pendiente se cierra solo y a quien lo pidió le llega el aviso.',
         u, s.solicitado_por, sumar_dias_habiles(hoy_planta(), 2), 'solicitudes_cambio_bom', s.id::text,
         '/costeo/equipos?vista=solicitudes', v_grupo, case when v_grupo is not null then 'uno' end
  from unnest(v_ing) u;
  get diagnostics n = row_count;
  return n;
end $$;
revoke execute on function public.pendiente_de_solicitud_cambio(public.solicitudes_cambio_bom) from public, anon, authenticated;

create or replace function public.trg_solicitud_cambio_pendiente() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_p pendientes; v_nota text;
begin
  if tg_op = 'INSERT' then
    if new.estado = 'pendiente' then perform pendiente_de_solicitud_cambio(new); end if;
    return new;
  end if;
  -- Resuelta: se cierra su pendiente. Uno solo «hecho» (el de quien resolvió, si es suyo); a los demás
  -- del grupo los cierra el disparador de grupos como «lo hizo otra persona».
  if new.estado <> old.estado and new.estado in ('aplicada', 'descartada') then
    v_nota := case new.estado when 'aplicada' then 'Aplicado' else 'Descartado' end || coalesce(': ' || nullif(trim(new.respuesta), ''), '');
    select * into v_p from pendientes where tabla = 'solicitudes_cambio_bom' and registro_id = new.id::text and estado = 'abierto'
    order by (responsable_id = new.resuelto_por) desc, creado_en limit 1;
    if v_p.id is not null then
      update pendientes set estado = 'hecho', nota_cierre = left(v_nota, 500) where id = v_p.id;
      -- Sin grupo, si había más (no debería), se cierran igual.
      update pendientes set estado = 'hecho', nota_cierre = left(v_nota, 500)
      where tabla = 'solicitudes_cambio_bom' and registro_id = new.id::text and estado = 'abierto' and grupo_id is null;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists pendiente on public.solicitudes_cambio_bom;
create trigger pendiente after insert or update of estado on public.solicitudes_cambio_bom
  for each row execute function public.trg_solicitud_cambio_pendiente();

-- Las que ya esperaban.
select public.pendiente_de_solicitud_cambio(s) from public.solicitudes_cambio_bom s where s.estado = 'pendiente';

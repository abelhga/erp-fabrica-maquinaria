-- =============================================================================
-- Agregar a una orden la etapa que le falta.
--
-- OP-2026-00010 (mezcladora horizontal de 2 toneladas, E-169) se terminó sola al marcar
-- Pintura, sin pasar por Detallado. Las etapas de una orden salen de las horas por etapa del
-- equipo en el costeo, y E-169 solo trae Pailería, Torno y Pintura: Pintura era su última
-- etapa. De 46 órdenes vivas, es la única sin Detallado; de 473 equipos con horas, 163 no lo
-- traen, así que va a volver a pasar con cualquiera de ellos.
--
-- La ruta del equipo la corrige ingeniería en el costeo (y con eso cambia su costo). Esto es
-- para la orden que ya está en el piso: la gerencia de producción le agrega la etapa con sus
-- horas y, si la orden ya se había dado por terminada, regresa a «en proceso» (y su pedido
-- deja de estar listo), igual que al reabrir una etapa.
-- =============================================================================

alter table public.op_eventos drop constraint op_eventos_tipo_check;
alter table public.op_eventos add constraint op_eventos_tipo_check check (tipo = any (array['creada', 'liberada', 'inicio', 'pausa',
  'reanudar', 'fin', 'problema', 'nota', 'surtido', 'cambio_material', 'terminada', 'entregada', 'reabierta', 'etapa_agregada']));

-- Sin revisar permisos: la llaman agregar_etapa_orden y el arreglo de abajo.
create or replace function public._agregar_etapa_orden(p_op uuid, p_etapa int, p_horas numeric, p_motivo text)
returns uuid language plpgsql security definer set search_path = public as $$
declare o ordenes_produccion; v_etapa etapas; v_id uuid;
begin
  select * into o from ordenes_produccion where id = p_op for update;
  if o.id is null then raise exception 'No existe la orden'; end if;
  if o.estado in ('entregada', 'cancelada') then raise exception 'La orden % ya está %', o.folio, o.estado; end if;
  select * into v_etapa from etapas where id = p_etapa;
  if v_etapa.id is null or not v_etapa.activa then raise exception 'Esa etapa no existe o ya no se usa'; end if;
  if exists (select 1 from op_operaciones where orden_id = p_op and etapa_id = p_etapa) then
    raise exception '% ya tiene %', o.folio, v_etapa.nombre;
  end if;
  -- Sin horas no hay avance que medir ni lugar en el plan del taller.
  if coalesce(p_horas, 0) <= 0 then raise exception 'Escribe cuántas horas lleva %', v_etapa.nombre; end if;
  if coalesce(length(trim(p_motivo)), 0) < 5 then raise exception 'Escribe por qué se agrega %', v_etapa.nombre; end if;

  insert into op_operaciones (orden_id, etapa_id, horas_estimadas) values (p_op, p_etapa, round(p_horas, 2)) returning id into v_id;
  -- Si ya se había dado por terminada, le falta esta etapa: regresa al taller.
  if o.estado = 'terminada' then
    update ordenes_produccion set estado = 'en_proceso', terminada_en = null where id = o.id;
    if o.pedido_id is not null then
      update pedidos set estado = 'en_produccion' where id = o.pedido_id and estado = 'listo';
    end if;
  end if;
  insert into op_eventos (orden_id, operacion_id, tipo, nota)
  values (o.id, v_id, 'etapa_agregada', format('%s h · %s', trim_scale(round(p_horas, 2)), trim(p_motivo)));
  return v_id;
end $$;
revoke execute on function public._agregar_etapa_orden(uuid, int, numeric, text) from public, anon, authenticated;

create or replace function public.agregar_etapa_orden(p_op uuid, p_etapa int, p_horas numeric, p_motivo text)
returns uuid language plpgsql security definer set search_path = public as $$
begin
  -- Cambiar el camino de una orden es planear: de la gerencia de producción, como reabrir.
  if not puede('produccion', 3) then
    raise exception 'Agregar una etapa a la orden es de la gerencia de producción' using errcode = '42501';
  end if;
  return _agregar_etapa_orden(p_op, p_etapa, p_horas, p_motivo);
end $$;
revoke execute on function public.agregar_etapa_orden(uuid, int, numeric, text) from public, anon;
grant execute on function public.agregar_etapa_orden(uuid, int, numeric, text) to authenticated;

-- OP-2026-00010: Detallado con 15 h, como la mezcladora horizontal de 1 tonelada (E-438), la
-- más parecida que sí lo trae. Si son otras, la gerencia corrige las horas.
do $$
declare v_op uuid; v_detallado int;
begin
  select id into v_op from ordenes_produccion where folio = 'OP-2026-00010' and estado = 'terminada';
  select id into v_detallado from etapas where nombre = 'Detallado';
  if v_op is not null and v_detallado is not null
     and not exists (select 1 from op_operaciones where orden_id = v_op and etapa_id = v_detallado) then
    perform _agregar_etapa_orden(v_op, v_detallado, 15,
      'El equipo E-169 no trae Detallado en el costeo y la orden se terminó al acabar Pintura (lo reportó Luis el 26 oct). '
      || 'Horas como la mezcladora de 1 tonelada (E-438)');
  end if;
end $$;

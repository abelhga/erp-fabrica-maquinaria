-- =============================================================================
-- Un ajuste no se aplica encima de un conteo posterior.
--
-- Por qué: hay ajustes que se piden por cambios que no pasaron por un conteo (por ejemplo, lo que se
-- corrigió en la hoja de inventario y no llegó al ERP). Si ese artículo se cuenta antes de autorizar
-- el ajuste, el conteo ya lo dejó en lo que hay, y autorizarlo después lo movería dos veces.
--
-- Ahora, si el artículo se contó en ese almacén después de pedirse el ajuste, autorizarlo se rechaza
-- con el aviso de que el conteo ya lo dejó en lo que hay; rechazarlo sí se puede y queda de constancia.
-- Contar nunca se bloquea, y los ajustes nuevos del artículo funcionan normal.
-- =============================================================================

create or replace function public.resolver_ajuste(p_ajuste uuid, p_aprobar boolean, p_comentario text default null)
returns void language plpgsql security definer set search_path = public as $$
declare a ajustes_inventario; v_dif numeric; v_actual numeric; v_conteo text; v_contado_en timestamptz;
begin
  if not (puede('inventario', 3) or tiene_rol('direccion') or tiene_rol('gerente_produccion')) then
    raise exception 'Solo la gerencia autoriza ajustes de inventario' using errcode = '42501';
  end if;
  select * into a from ajustes_inventario where id = p_ajuste for update;
  if a.estado <> 'pendiente' then raise exception 'Este ajuste ya fue resuelto'; end if;
  if a.solicitado_por = auth.uid() and not tiene_rol('direccion') then
    raise exception 'Un ajuste lo autoriza alguien distinto de quien lo pidió' using errcode = '42501';
  end if;
  if p_aprobar then
    -- Si el artículo se contó en ese almacén después de pedir este ajuste, el conteo ya lo dejó en
    -- lo que hay: aplicar el ajuste encima lo movería dos veces. Rechazarlo sí se puede (queda de constancia).
    select c.nombre, l.en into v_conteo, v_contado_en
    from conteo_lineas l join conteos c on c.id = l.conteo_id
    where l.articulo_id = a.articulo_id and c.almacen_id = a.almacen_id and l.en > a.solicitado_en
      and c.id is distinct from a.conteo_id
    order by l.en desc limit 1;
    if v_contado_en is not null then
      raise exception 'Este artículo ya se contó en este almacén el % («%»), después de pedir el ajuste: el conteo ya lo dejó en lo que hay. Recházalo; queda como constancia',
        to_char(v_contado_en at time zone 'America/Mexico_City', 'DD/MM/YYYY'), v_conteo using errcode = '23514';
    end if;
    v_dif := a.cantidad_fisica - a.cantidad_sistema;
    select coalesce(cantidad, 0) into v_actual from existencias where articulo_id = a.articulo_id and almacen_id = a.almacen_id;
    if coalesce(v_actual, 0) + v_dif < 0 then
      raise exception 'Con lo que salió después del conteo, la existencia quedaría en %: algo no cuadra. Recházalo y que se vuelva a contar',
        trim_scale(coalesce(v_actual, 0) + v_dif) using errcode = '23514';
    end if;
    if v_dif <> 0 then
      insert into movimientos_inventario (tipo, articulo_id, almacen_id, cantidad, ajuste_id, motivo, costo_unitario)
      values (case when v_dif > 0 then 'ajuste_entrada'::tipo_movimiento else 'ajuste_salida'::tipo_movimiento end,
              a.articulo_id, a.almacen_id, v_dif, a.id, a.motivo,
              (select costo * tc(moneda) from costos_articulo where articulo_id = a.articulo_id));
    end if;
  end if;
  update ajustes_inventario set estado = case when p_aprobar then 'aprobado' else 'rechazado' end,
    resuelto_por = auth.uid(), resuelto_en = now(), comentario = p_comentario
  where id = p_ajuste;
end $$;

-- Apartar material pide la revisión de ingeniería.
--
-- Por qué: liberar una orden ya pedía la revisión de ingeniería, pero apartar no. Se apartaba sobre
-- una lista sin revisar (3 de 14 órdenes apartadas en la nube, al 6-nov) y, cuando ingeniería la
-- cambiaba, había que soltar y volver a apartar; mientras tanto ese material no lo podía tomar otra
-- orden. Lo que baja o se quita de la lista ya suelta lo apartado solo (238); faltaba no apartar antes.
--
-- Para no frenar el taller si ingeniería tarda: gerencia de producción o dirección (producción
-- nivel 3) pueden apartar sin la revisión, con un motivo que queda en la orden y en su línea de
-- tiempo. Y cada madrugada, lo que lleva un día hábil o más sin revisar le sale a ingeniería en
-- «Por revisar» (y se cierra solo cuando lo revisa).

alter table public.ordenes_produccion add column if not exists apartado_sin_revision_motivo text;
alter table public.ordenes_produccion add column if not exists apartado_sin_revision_por uuid references public.perfiles(id);

drop function if exists public.apartar_material(uuid);
create or replace function public.apartar_material(p_op uuid, p_motivo text default null)
returns table (articulo_id uuid, nombre text, faltante numeric)
language plpgsql security definer set search_path = public as $$
declare m record; v_libre numeric; v_tomar numeric; v_folio text; v_estado estado_op; v_total int; v_falt int;
        v_revisada boolean; v_motivo text := nullif(trim(p_motivo), '');
begin
  if not (puede('produccion', 2) or puede('inventario', 2)) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  select o.folio, o.estado, o.revisado_ingenieria_en is not null into v_folio, v_estado, v_revisada from ordenes_produccion o where o.id = p_op;
  if v_folio is null then raise exception 'No existe la orden'; end if;
  if v_estado in ('terminada', 'entregada', 'cancelada') then raise exception 'La orden % ya está cerrada', v_folio; end if;
  if not v_revisada then
    if not puede('produccion', 3) then
      raise exception 'Falta la revisión de ingeniería de %: su lista de materiales todavía puede cambiar. Pídele a ingeniería que la revise, o a la gerencia de producción que la aparte con un motivo si es urgente', v_folio
        using errcode = '42501';
    end if;
    if v_motivo is null or length(v_motivo) < 5 then
      raise exception 'Sin la revisión de ingeniería, apartar pide el motivo (por qué no puede esperar)' using errcode = '22023';
    end if;
  end if;
  -- Bloquea las existencias de los artículos involucrados para que dos órdenes no aparten lo mismo a la vez.
  perform 1 from existencias where existencias.articulo_id in (select om.articulo_id from op_materiales om where om.orden_id = p_op) for update;

  for m in select * from v_op_material v where v.orden_id = p_op and v.faltante > 0 loop
    select coalesce(sum(x.cantidad), 0) - coalesce((select sum(r.cantidad - r.surtido) from reservas r
                                                     where r.articulo_id = m.articulo_id and r.estado = 'activa'), 0)
      into v_libre
    from existencias x join almacenes al on al.id = x.almacen_id
    where x.articulo_id = m.articulo_id and al.disponible_para_planta;
    v_tomar := least(m.faltante, greatest(v_libre, 0));
    if v_tomar > 0 then
      insert into reservas (articulo_id, cantidad, orden_produccion_id, motivo)
      values (m.articulo_id, v_tomar, p_op, 'OP ' || v_folio);
    end if;
  end loop;

  select count(*), count(*) filter (where v.faltante > 0) into v_total, v_falt from v_op_material v where v.orden_id = p_op;
  update ordenes_produccion set material_apartado_por = auth.uid(), material_apartado_en = now(),
    apartado_sin_revision_motivo = case when v_revisada then apartado_sin_revision_motivo else v_motivo end,
    apartado_sin_revision_por = case when v_revisada then apartado_sin_revision_por else auth.uid() end
  where id = p_op;
  insert into op_eventos (orden_id, tipo, nota) values (p_op, 'nota',
    case when v_falt = 0 then format('Material apartado: las %s partidas completas', v_total)
         else format('Material apartado: %s de %s partidas completas, %s con faltante', v_total - v_falt, v_total, v_falt) end
    || case when v_revisada then '' else format('. Sin la revisión de ingeniería: %s', v_motivo) end);

  return query select v.articulo_id, v.nombre, v.faltante from v_op_material v where v.orden_id = p_op and v.faltante > 0;
end $$;
revoke execute on function public.apartar_material(uuid, text) from public, anon;
grant execute on function public.apartar_material(uuid, text) to authenticated;

-- Revisión nocturna: órdenes abiertas que llevan un día hábil o más sin la revisión de ingeniería.
-- Una por orden, para ingeniería; se cierra sola cuando la revisa. Urgente si ya tiene material
-- apartado o ya está en el taller (se está trabajando sobre una lista sin revisar).
create or replace function public.revision_r_op_sin_revision_ingenieria() returns setof public.revision_hallazgo_nuevo
language sql stable security definer set search_path = public, extensions as $$
  select 'ordenes_produccion', o.id::text, '/produccion/ordenes/' || o.id,
    format('%s sin la revisión de ingeniería', o.folio),
    format('La orden %s (%s) lleva %s día(s) hábil(es) sin que ingeniería revise su lista de materiales.%s Sin la revisión no se puede liberar, y almacén no puede apartar su material.',
           o.folio, coalesce((select a.nombre from articulos a where a.id = o.articulo_id), 'sin equipo'),
           dias_habiles_desde(o.creado_en),
           case when o.material_apartado_en is not null then ' Ya tiene material apartado.'
                when o.estado::text = 'en_proceso' then ' Ya se está trabajando en el taller.' else '' end),
    jsonb_build_array(jsonb_build_object('tipo', 'orden', 'referencia', o.id, 'folio', o.folio,
                                         'detalle', 'Estado: ' || o.estado::text, 'fecha', o.creado_en)),
    (select array_agg(u) from (select usuarios_con_rol('ingenieria') u union select usuarios_con_rol('ingenieria_procesos')) x),
    case when o.material_apartado_en is not null or o.estado::text = 'en_proceso' then 'alta' else 'media' end,
    null::jsonb,
    'op_sin_revision_ingenieria:' || o.id
  from ordenes_produccion o
  where o.estado::text not in ('terminada', 'entregada', 'cancelada')
    and o.revisado_ingenieria_en is null
    and dias_habiles_desde(o.creado_en) >= 1
$$;
revoke execute on function public.revision_r_op_sin_revision_ingenieria() from public, anon, authenticated;

insert into public.revision_reglas (clave, modulo, nombre, descripcion, para, se_resuelve_sola) values
  ('op_sin_revision_ingenieria', 'produccion', 'Órdenes sin la revisión de ingeniería',
   'Órdenes abiertas que llevan un día hábil o más sin que ingeniería revise su lista de materiales. Le sale a ingeniería y se cierra sola cuando la revisa; urgente si ya tiene material apartado o ya está en el taller.',
   'responsable', true)
on conflict (clave) do nothing;

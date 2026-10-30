-- =============================================================================
-- Indicadores nuevos para objetivos y bonos: lo que ya se puede medir solo.
--
-- Por qué: el catálogo tenía 17 indicadores que mide el sistema y 33 que califica el jefe a mano,
-- varios solo porque «faltaba un dato». Lo construido después ya guarda ese dato: los leads traen
-- cuándo llegaron, cuándo se asignaron y cuándo se atendieron; los seguimientos de cotización, su
-- día; Mercado Libre, cuándo llegó y se contestó cada pregunta; mantenimiento, cuándo vence un
-- preventivo, cuándo se reportó una falla y cuánto estuvo parada la máquina; la terminal, quién
-- trabajó cada etapa y cuántas horas; los pendientes, su fecha; los envíos, cuándo se pidieron y
-- se empacaron. Medirlo solo quita discusiones («yo sí lo hice a tiempo») y le pone evidencia a
-- cada incidencia, como los 17 de antes.
--
--   * 4 que se calificaban a mano pasan a automáticos: asignación de leads en 4 h, primer contacto,
--     llamadas registradas y empaque a tiempo.
--   * 11 nuevos (62 a 72), con su área; se agrega el área Mantenimiento (departamento nuevo).
--   * Las horas «de horario» salen del horario del taller: lo que llega de noche no cuenta en contra
--     hasta que se abre. Los plazos (4 h, 2 h, 1 día hábil) son el valor de inicio y se cambian por
--     indicador en la plantilla (parámetros «horas» o «dias»).
--   * Los leads de una lista cargada de golpe (una expo) no cuentan para los tiempos de respuesta:
--     la fuente se marca «de lista».
-- =============================================================================

alter table public.objetivo_indicadores drop constraint if exists objetivo_indicadores_area_check;
alter table public.objetivo_indicadores add constraint objetivo_indicadores_area_check
  check (area in ('ventas', 'compras', 'ingenieria', 'produccion', 'almacen', 'mantenimiento', 'general'));

alter table public.fuentes_contacto add column if not exists de_lista boolean not null default false;
comment on column public.fuentes_contacto.de_lista is
  'La fuente es una lista que se carga de golpe (una expo, una base comprada): sus leads no cuentan para los tiempos de asignación y de primer contacto.';
update public.fuentes_contacto set de_lista = true where nombre ilike 'expo%';

-- Los que ya se pueden medir solos.
update public.objetivo_indicadores set fuente = 'automatica', dato_faltante = null,
  nombre = 'Asignar leads en 4 horas',
  descripcion = 'Leads que llegaron solos en el mes (formulario, Facebook, WhatsApp, llamada…), asignados a un vendedor en 4 horas de horario o menos. Incidencia: asignado después o sin asignar. No cuentan las listas cargadas de golpe.'
where clave = 'asignacion_4h';
update public.objetivo_indicadores set fuente = 'automatica', dato_faltante = null,
  nombre = 'Primer contacto a leads en un día de trabajo',
  descripcion = 'Leads que llegaron solos en el mes, atendidos en 8 horas de horario o menos (un día de trabajo). Si la persona tiene leads asignados, se miden los suyos; si no, los de todos. No cuentan las listas cargadas de golpe.'
where clave = 'primer_contacto';
update public.objetivo_indicadores set fuente = 'automatica', dato_faltante = null,
  descripcion = 'Llamadas que la persona registró en el mes. Incidencia: sin cliente, o sin decir qué se habló.'
where clave = 'llamadas_registradas';
update public.objetivo_indicadores set fuente = 'automatica', dato_faltante = null,
  nombre = 'Empacar envíos a tiempo',
  descripcion = 'Envíos pedidos en el mes (clientes y Mercado Libre). Incidencia: se empacó después del siguiente día hábil, o sigue sin empacar pasado ese plazo.'
where clave = 'empaque_a_tiempo';

insert into public.objetivo_indicadores (id, clave, nombre, area, fuente, checklist, unidad, descripcion, dato_faltante, activo) values
  (62, 'seguimientos_cotizacion', 'Seguimientos de cotización a tiempo', 'ventas', 'automatica', null, '%',
   'Seguimientos de cotización que vencían en el mes (los suyos, si es vendedor). Incidencia: se hizo después de su día o sigue pendiente. Si la cotización se ganó o se perdió antes, ya no cuenta.', null, true),
  (63, 'preguntas_ml_2h', 'Preguntas de Mercado Libre contestadas en 2 horas', 'ventas', 'automatica', null, '%',
   'Preguntas de Mercado Libre del mes. Incidencia: contestada después de 2 horas de horario, o sin contestar.', null, true),
  (64, 'preventivos_a_tiempo', 'Mantenimientos preventivos a tiempo', 'mantenimiento', 'automatica', null, '%',
   'Preventivos que vencían en el mes. Incidencia: se cerró después de su fecha o sigue abierto.', null, true),
  (65, 'horas_paro_falla', 'Horas de máquina parada por falla', 'mantenimiento', 'automatica', null, 'horas',
   'Horas de horario que las máquinas estuvieron paradas por falla en el mes, de que se reportó parada a que volvió a trabajar. Menos es mejor.', null, true),
  (66, 'respuesta_fallas', 'Atender fallas en 4 horas', 'mantenimiento', 'automatica', null, '%',
   'Fallas reportadas en el mes. Incidencia: se empezó a atender después de 4 horas de horario, o no se ha atendido.', null, true),
  (67, 'etapas_marcadas', 'Etapas marcadas en la terminal', 'produccion', 'automatica', null, '%',
   'Etapas terminadas en el mes. Incidencia: nadie marcó en la terminal quién la trabajó (sin eso no hay horas hombre ni costo real de esa etapa).', null, true),
  (68, 'horas_contra_costeo', 'Horas reales contra las del costeo', 'produccion', 'automatica', null, '%',
   'Horas reales de las etapas terminadas en el mes y marcadas en la terminal, contra las del costeo: 100 % es lo estimado, más es que se tardó más.', null, true),
  (69, 'etapas_reabiertas', 'Etapas reabiertas', 'produccion', 'automatica', null, 'etapas',
   'Etapas que se reabrieron en el mes porque se dieron por terminadas antes de tiempo o hubo que rehacer algo. Menos es mejor.', null, true),
  (70, 'pendientes_a_tiempo', 'Pendientes cerrados a tiempo', 'general', 'automatica', null, '%',
   'Pendientes de la persona que vencían en el mes. Incidencia: se cerró después de su fecha o sigue abierto.', null, true),
  (71, 'ideas_mejora', 'Ideas de mejora propuestas', 'general', 'automatica', null, 'ideas',
   'Ideas de mejora (kaizen) que la persona propuso en el mes, en Mejoras o desde la terminal. Las que sugiere el sistema no cuentan.', null, true),
  (72, 'solicitudes_precio_a_tiempo', 'Solicitudes de precio contestadas a tiempo', 'compras', 'automatica', null, '%',
   'Solicitudes de precio de ventas que vencían en el mes. Incidencia: se contestó después de su plazo o sigue sin contestar.', null, true)
on conflict (id) do update set clave = excluded.clave, nombre = excluded.nombre, area = excluded.area, fuente = excluded.fuente,
  unidad = excluded.unidad, descripcion = excluded.descripcion, dato_faltante = excluded.dato_faltante;

-- La medición (la de 194) con los de arriba. Sigue sin permiso de ejecución para nadie: la llaman
-- armar_evaluaciones y medir_evaluacion, que revisan puede() antes.
create or replace function public.objetivo_medir(p_clave text, p_checklist text, p_empleado uuid, p_mes date,
  p_parametros jsonb default '{}'::jsonb) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  tz constant text := 'America/Mexico_City';
  v_ini date := date_trunc('month', p_mes)::date;
  v_fin date := (date_trunc('month', p_mes) + interval '1 month')::date;          -- exclusivo
  v_t0 timestamptz := date_trunc('month', p_mes)::timestamp at time zone 'America/Mexico_City';
  v_t1 timestamptz := (date_trunc('month', p_mes) + interval '1 month')::timestamp at time zone 'America/Mexico_City';
  v_hoy date := hoy_planta();
  v_corte date := least((date_trunc('month', p_mes) + interval '1 month')::date - 1, hoy_planta());
  v_usuario uuid;
  v_a numeric; v_b numeric; v_n int;
  v_areas int[] := coalesce(array(select jsonb_array_elements_text(coalesce(p_parametros->'areas', '[]'::jsonb))::int), '{}');
  v_almacenes int[] := coalesce(array(select jsonb_array_elements_text(coalesce(p_parametros->'almacenes', '[]'::jsonb))::int), '{}');
  v_r jsonb;
begin
  select usuario_id into v_usuario from empleados where id = p_empleado;

  -- Checklist: un día (o un día-área) con cualquier falla es un incumplimiento.
  if p_checklist is not null then
    with m as (
      select x.fecha, x.area_id, a.nombre area, bool_and(x.cumplio) cumplio,
        string_agg(case x.momento when 'entrada' then 'entrada' when 'break1' then 'break 1' when 'break2' then 'break 2'
                                  else 'revisión' end || coalesce(' (' || x.nota || ')', ''), ', ' order by x.momento)
          filter (where not x.cumplio) fallas,
        string_agg(distinct p.nombre, ', ') filter (where not x.cumplio) quien
      from objetivo_marcas x
      left join objetivo_areas a on a.id = x.area_id
      left join perfiles p on p.id = x.marcado_por
      where x.tipo = p_checklist and x.fecha >= v_ini and x.fecha < v_fin
        and case when cardinality(v_areas) > 0 then x.area_id = any(v_areas) else x.empleado_id = p_empleado end
      group by x.fecha, x.area_id, a.nombre
    )
    select case when count(*) = 0 then jsonb_build_object('sin_dato', true,
             'nota', 'Nadie marcó el checklist este mes: sin marcas no se sabe si cumplió. Márcalo en el checklist diario o califícalo a mano.')
           else jsonb_build_object('posibles', count(*), 'modo', 'resta',
             'nota', format('%s %s marcados en el mes, %s con falla. Un día sin marca no cuenta en contra.',
                            count(*), case when cardinality(v_areas) > 0 then 'días-área' else 'días' end, count(*) filter (where not m.cumplio)),
             'evidencias', coalesce(jsonb_agg(jsonb_build_object(
                'tipo', 'marca', 'referencia', m.fecha::text || coalesce(':' || m.area_id, ''),
                'folio', coalesce(m.area, case p_checklist when 'celular' then 'Celular' when 'epp' then 'EPP'
                                                           when 'vehiculo' then 'Vehículo' else 'Checklist' end),
                'detalle', 'No cumplió: ' || m.fallas || coalesce(' · marcó ' || m.quien, ''),
                'fecha', m.fecha, 'cuenta', true) order by m.fecha) filter (where not m.cumplio), '[]'::jsonb)) end
    into v_r from m;
    return v_r;
  end if;

  case p_clave
  when 'ventas_mes' then
    select jsonb_build_object('valor', coalesce(round(sum(p.subtotal * p.tipo_cambio), 2), 0), 'modo', 'no',
      'nota', 'Pedidos del mes sin IVA ni cancelados, en pesos al tipo de cambio del pedido.',
      'evidencias', coalesce(jsonb_agg(jsonb_build_object('tipo', 'pedido', 'referencia', p.id::text, 'folio', p.folio,
          'detalle', coalesce(c.nombre, 'Sin cliente') || ' · ' || p.canal::text, 'fecha', p.fecha,
          'cantidad', round(p.subtotal * p.tipo_cambio, 2), 'cuenta', false) order by p.subtotal * p.tipo_cambio desc), '[]'::jsonb))
    into v_r
    from pedidos p left join clientes c on c.id = p.cliente_id
    where p.estado <> 'cancelado' and p.fecha >= v_ini and p.fecha < v_fin;

  when 'crecimiento_ventas' then
    select coalesce(sum(subtotal * tipo_cambio) filter (where fecha >= v_ini), 0),
           coalesce(sum(subtotal * tipo_cambio) filter (where fecha < v_ini), 0)
    into v_a, v_b
    from pedidos where estado <> 'cancelado' and fecha >= (v_ini - interval '1 month')::date and fecha < v_fin;
    if v_b = 0 then
      v_r := jsonb_build_object('sin_dato', true, 'nota', 'El mes anterior no tuvo ventas: no hay contra qué comparar.');
    else
      v_r := jsonb_build_object('valor', round(100 * (v_a / v_b - 1), 2), 'modo', 'no',
        'nota', 'Ventas sin IVA del mes contra el mes anterior.',
        'evidencias', jsonb_build_array(
          jsonb_build_object('tipo', 'resumen', 'referencia', 'mes', 'folio', objetivo_nombre_mes(v_ini),
                             'detalle', 'Ventas del mes', 'cantidad', round(v_a, 2), 'cuenta', false),
          jsonb_build_object('tipo', 'resumen', 'referencia', 'anterior', 'folio', objetivo_nombre_mes((v_ini - interval '1 month')::date),
                             'detalle', 'Ventas del mes anterior', 'cantidad', round(v_b, 2), 'cuenta', false)));
    end if;

  when 'seguimiento_prospectos' then
    with o as (
      select o.id, o.titulo, o.creado_en, c.nombre cliente,
        (select count(*) from actividades a where a.oportunidad_id = o.id
           and a.en >= o.creado_en and a.en < o.creado_en + interval '7 days') seg
      from oportunidades o left join clientes c on c.id = o.cliente_id
      where o.creado_en >= v_t0 and o.creado_en < v_t1 and o.creado_en + interval '7 days' <= now()
    )
    select jsonb_build_object('posibles', count(*), 'modo', 'porcentaje',
      'nota', 'Oportunidades creadas en el mes (con sus 7 días ya cumplidos). Incidencia: menos de 2 actividades en esos 7 días.',
      'evidencias', coalesce(jsonb_agg(jsonb_build_object('tipo', 'oportunidad', 'referencia', o.id::text, 'folio', o.titulo,
          'detalle', coalesce(o.cliente || ' · ', '') || o.seg || ' seguimiento(s) en 7 días',
          'fecha', (o.creado_en at time zone tz)::date, 'cantidad', o.seg, 'cuenta', o.seg < 2) order by o.creado_en), '[]'::jsonb))
    into v_r from o;

  when 'conversiones_registradas' then
    select jsonb_build_object('posibles', count(*), 'modo', 'porcentaje',
      'nota', 'Pedidos del mes sin Mercado Libre, Amazon ni históricos. Incidencia: pedido sin cotización del ERP.',
      'evidencias', coalesce(jsonb_agg(jsonb_build_object('tipo', 'pedido', 'referencia', p.id::text, 'folio', p.folio,
          'detalle', coalesce(c.nombre, 'Sin cliente') || ' · sin cotización', 'fecha', p.fecha,
          'cantidad', round(p.subtotal * p.tipo_cambio, 2), 'cuenta', true) order by p.fecha) filter (where p.cotizacion_id is null), '[]'::jsonb))
    into v_r
    from pedidos p left join clientes c on c.id = p.cliente_id
    where p.estado <> 'cancelado' and not p.historico and p.fecha >= v_ini and p.fecha < v_fin
      and p.canal not in ('mercadolibre', 'amazon');

  when 'costos_vigentes' then
    with linea as (
      select a.id, a.clave, a.nombre from articulos a
      where a.activo and a.tipo in ('componente', 'materia_prima')
        and exists (select 1 from bom_lineas b join articulos p on p.id = b.padre_id where b.hijo_id = a.id and p.activo)
    ), fechas as (
      select l.*, greatest(
          (select max((h.en at time zone tz)::date) from historial_costos h where h.articulo_id = l.id and h.en < v_t1),
          (select c.actualizado_en from costos_articulo c where c.articulo_id = l.id and c.actualizado_en < v_fin)) ultima
      from linea l
    ), vencidos as (
      select f.*, row_number() over (order by f.ultima nulls first, f.clave) n
      from fechas f where f.ultima is null or f.ultima < (v_fin - interval '3 months')::date
    )
    select jsonb_build_object('posibles', (select count(*) from linea), 'valor', (select count(*) from vencidos), 'modo', 'no',
      'nota', format('%s de %s componentes de línea con costo de más de 3 meses (o sin costo) al cierre del mes.',
                     (select count(*) from vencidos), (select count(*) from linea)),
      'evidencias', coalesce((select jsonb_agg(jsonb_build_object('tipo', 'articulo', 'referencia', v.id::text, 'folio', v.clave,
            'detalle', v.nombre || ' · ' || coalesce('costo del ' || to_char(v.ultima, 'DD/MM/YYYY'), 'sin costo'),
            'fecha', v.ultima, 'cuenta', true) order by v.n) from vencidos v where v.n <= 100), '[]'::jsonb)
        || case when (select count(*) from vencidos) > 100 then jsonb_build_array(jsonb_build_object(
             'tipo', 'resumen', 'referencia', 'resto', 'folio', 'Y ' || ((select count(*) from vencidos) - 100) || ' artículos más',
             'detalle', 'Mismo motivo: costo de más de 3 meses o sin costo', 'cuenta', true,
             'unidades', (select count(*) from vencidos) - 100)) else '[]'::jsonb end)
    into v_r;

  when 'proveedores_nuevos' then
    select jsonb_build_object('valor', count(*), 'modo', 'no',
      'nota', 'Proveedores dados de alta en el mes con su primera orden de compra en el mes.',
      'evidencias', coalesce(jsonb_agg(jsonb_build_object('tipo', 'proveedor', 'referencia', p.id::text, 'folio', p.nombre,
          'detalle', coalesce(p.categoria || ' · ', '') || 'primera OC ' || o.folio, 'fecha', o.fecha, 'cuenta', false)), '[]'::jsonb))
    into v_r
    from proveedores p
    cross join lateral (select x.folio, x.fecha from ordenes_compra x where x.proveedor_id = p.id
                        and x.estado not in ('borrador', 'cancelada') order by x.fecha limit 1) o
    where p.creado_en >= v_t0 and p.creado_en < v_t1 and o.fecha >= v_ini and o.fecha < v_fin;

  when 'materiales_por_cliente' then
    with lib as (
      select distinct on (ev.orden_id) ev.orden_id, ev.en from op_eventos ev
      where ev.tipo = 'liberada' and ev.en >= v_t0 and ev.en < v_t1 order by ev.orden_id, ev.en
    ), x as (
      select o.id, o.folio, a.nombre equipo, l.en,
        not exists (select 1 from op_materiales m where m.orden_id = o.id) sin_material,
        (select count(*) from op_eventos c where c.orden_id = o.id and c.tipo = 'cambio_material' and c.en > l.en) cambios
      from lib l join ordenes_produccion o on o.id = l.orden_id join articulos a on a.id = o.articulo_id
    )
    select jsonb_build_object('posibles', count(*), 'modo', 'porcentaje',
      'nota', 'Órdenes liberadas en el mes. Incidencia: sin lista de material o con cambios de material después de liberarla.',
      'evidencias', coalesce(jsonb_agg(jsonb_build_object('tipo', 'orden_produccion', 'referencia', x.id::text, 'folio', x.folio,
          'detalle', x.equipo || ' · ' || case when x.sin_material then 'liberada sin lista de material'
                                              when x.cambios > 0 then x.cambios || ' cambio(s) de material después de liberarla'
                                              else 'material completo al liberar' end,
          'fecha', (x.en at time zone tz)::date, 'cantidad', x.cambios, 'cuenta', x.sin_material or x.cambios > 0) order by x.en), '[]'::jsonb))
    into v_r from x;

  when 'entregas_a_tiempo' then
    with x as (
      select o.id, o.folio, a.nombre equipo, o.fecha_compromiso, (o.terminada_en at time zone tz)::date terminada,
        o.pedido_id is null para_stock
      from ordenes_produccion o join articulos a on a.id = o.articulo_id
      where o.estado <> 'cancelada' and o.fecha_compromiso >= v_ini and o.fecha_compromiso < v_fin
        -- La que sigue abierta y todavía puede llegar a tiempo no se juzga aún.
        and (o.terminada_en is not null or o.fecha_compromiso < v_corte)
    ), y as (
      select x.*, coalesce(x.terminada, v_corte) - x.fecha_compromiso atraso from x
    )
    select jsonb_build_object('posibles', count(*), 'modo', 'porcentaje',
      'nota', 'Órdenes con fecha compromiso en el mes, incluidas las de stock. Incidencia: terminada después de su fecha o abierta al cierre.',
      'evidencias', coalesce(jsonb_agg(jsonb_build_object('tipo', 'orden_produccion', 'referencia', y.id::text, 'folio', y.folio,
          'detalle', y.equipo || case when y.para_stock then ' (stock)' else '' end || ' · ' ||
              case when y.terminada is null then 'sigue abierta, ' || y.atraso || ' días tarde'
                   when y.atraso > 0 then 'terminada ' || y.atraso || ' días tarde' else 'a tiempo' end,
          'fecha', y.fecha_compromiso, 'cantidad', greatest(y.atraso, 0), 'cuenta', y.atraso > 0) order by y.fecha_compromiso), '[]'::jsonb))
    into v_r from y;

  when 'inicio_sin_orden' then
    with ini as (
      select distinct on (ev.orden_id) ev.orden_id, ev.en from op_eventos ev where ev.tipo = 'inicio' order by ev.orden_id, ev.en
    ), x as (
      select o.id, o.folio, a.nombre equipo, i.en, o.revisado_ingenieria_en,
        o.revisado_ingenieria_en is null or o.revisado_ingenieria_en > i.en sin_revision
      from ini i join ordenes_produccion o on o.id = i.orden_id join articulos a on a.id = o.articulo_id
      where i.en >= v_t0 and i.en < v_t1
    )
    select jsonb_build_object('posibles', count(*), 'modo', 'porcentaje',
      'nota', 'Órdenes que empezaron en el mes. Incidencia: empezó antes de la revisión de ingeniería.',
      'evidencias', coalesce(jsonb_agg(jsonb_build_object('tipo', 'orden_produccion', 'referencia', x.id::text, 'folio', x.folio,
          'detalle', x.equipo || ' · ' || case when x.sin_revision then 'empezó sin revisión de ingeniería' else 'revisada antes de empezar' end,
          'fecha', (x.en at time zone tz)::date, 'cuenta', x.sin_revision) order by x.en), '[]'::jsonb))
    into v_r from x;

  when 'bitacora_incidencias' then
    if v_usuario is null then
      v_r := jsonb_build_object('sin_dato', true, 'nota', 'La persona no tiene usuario en el ERP: no se sabe qué registró. Califícalo a mano.');
    else
      select jsonb_build_object('valor', count(*), 'modo', 'no',
        'nota', 'Problemas que registró en las órdenes de producción en el mes.',
        'evidencias', coalesce(jsonb_agg(jsonb_build_object('tipo', 'evento', 'referencia', ev.id::text, 'folio', o.folio,
            'detalle', left(ev.nota, 160), 'fecha', (ev.en at time zone tz)::date, 'cuenta', false) order by ev.en), '[]'::jsonb))
      into v_r
      from op_eventos ev join ordenes_produccion o on o.id = ev.orden_id
      where ev.tipo = 'problema' and ev.usuario_id = v_usuario and ev.en >= v_t0 and ev.en < v_t1;
    end if;

  when 'exactitud_inventario' then
    select jsonb_build_object('valor', count(*), 'modo', 'no',
      'nota', 'Ajustes de inventario del mes con diferencia. Los rechazados no cuentan: el conteo estaba mal, no el inventario.',
      'evidencias', coalesce(jsonb_agg(jsonb_build_object('tipo', 'ajuste', 'referencia', j.id::text, 'folio', j.folio,
          'detalle', a.clave || ' · ' || a.nombre || ' · ' || al.nombre || ' · sistema ' || trim_scale(j.cantidad_sistema)
                     || ', físico ' || trim_scale(j.cantidad_fisica) || ' · ' || j.motivo,
          'fecha', (j.solicitado_en at time zone tz)::date, 'cantidad', j.diferencia, 'cuenta', true) order by j.solicitado_en), '[]'::jsonb))
    into v_r
    from ajustes_inventario j join articulos a on a.id = j.articulo_id join almacenes al on al.id = j.almacen_id
    where j.estado <> 'rechazado' and j.diferencia <> 0 and j.solicitado_en >= v_t0 and j.solicitado_en < v_t1
      and (cardinality(v_almacenes) = 0 or j.almacen_id = any(v_almacenes));

  when 'material_a_tiempo_almacen' then
    -- Foto: solo vale tomarla durante el mes o en los 5 días siguientes al cierre.
    if v_hoy < v_ini or v_hoy > v_fin + 5 then return jsonb_build_object('conservar', true); end if;
    select jsonb_build_object('valor', count(*), 'modo', 'no',
      'nota', format('Foto del %s: artículos bajo su punto de reorden sin requisición abierta ni compra en camino.', to_char(v_hoy, 'DD/MM/YYYY')),
      'evidencias', coalesce(jsonb_agg(jsonb_build_object('tipo', 'articulo', 'referencia', r.articulo_id::text, 'folio', r.clave,
          'detalle', r.nombre || ' · disponible ' || trim_scale(r.disponible) || ' de ' || trim_scale(r.punto_reorden) || ' ' || r.unidad,
          'fecha', v_hoy, 'cantidad', r.punto_reorden - r.disponible, 'cuenta', true) order by r.clave), '[]'::jsonb))
    into v_r
    from reabasto() r
    where r.estado = 'ordenar' and r.en_transito = 0
      and not exists (select 1 from requisicion_lineas l join requisiciones q on q.id = l.requisicion_id
                      where l.articulo_id = r.articulo_id and l.estado = 'pendiente' and q.estado in ('abierta', 'en_compra'));

  when 'material_pedido_de_mas' then
    with x as (
      select l.id, q.folio, q.creado_en, a.clave, a.nombre, a.unidad, l.cantidad,
        coalesce((select sum(m.cantidad) from movimientos_inventario m join almacenes al on al.id = m.almacen_id
                  where m.articulo_id = l.articulo_id and al.disponible_para_planta and m.en <= q.creado_en), 0) en_planta
      from requisicion_lineas l join requisiciones q on q.id = l.requisicion_id join articulos a on a.id = l.articulo_id
      where q.origen in ('manual', 'reabasto') and q.creado_en >= v_t0 and q.creado_en < v_t1
    )
    select jsonb_build_object('posibles', count(*), 'valor', count(*) filter (where x.en_planta >= x.cantidad), 'modo', 'no',
      'nota', 'Partidas de requisición del mes (manuales y de reabasto). Incidencia: en ese momento ya había en planta lo que se pidió.',
      'evidencias', coalesce(jsonb_agg(jsonb_build_object('tipo', 'requisicion', 'referencia', x.id::text, 'folio', x.folio,
          'detalle', x.clave || ' · ' || x.nombre || ' · pidió ' || trim_scale(x.cantidad) || ', había ' || trim_scale(x.en_planta) || ' ' || x.unidad,
          'fecha', (x.creado_en at time zone tz)::date, 'cantidad', x.cantidad, 'cuenta', true) order by x.creado_en)
          filter (where x.en_planta >= x.cantidad), '[]'::jsonb))
    into v_r from x;

  when 'desabasto' then
    if v_hoy < v_ini or v_hoy > v_fin + 5 then return jsonb_build_object('conservar', true); end if;
    select jsonb_build_object(
      'valor', case when count(*) > 0 then round(100.0 * count(*) filter (where r.en_planta < r.punto_reorden) / count(*), 2) else 0 end,
      'posibles', count(*), 'modo', 'no',
      'nota', format('Foto del %s: %s de %s artículos con punto de reorden están por debajo en planta.',
                     to_char(v_hoy, 'DD/MM/YYYY'), count(*) filter (where r.en_planta < r.punto_reorden), count(*)),
      'evidencias', coalesce(jsonb_agg(jsonb_build_object('tipo', 'articulo', 'referencia', r.articulo_id::text, 'folio', r.clave,
          'detalle', r.nombre || ' · en planta ' || trim_scale(r.en_planta) || ' de ' || trim_scale(r.punto_reorden) || ' ' || r.unidad,
          'fecha', v_hoy, 'cantidad', r.punto_reorden - r.en_planta, 'cuenta', false) order by r.clave)
          filter (where r.en_planta < r.punto_reorden), '[]'::jsonb))
    into v_r from reabasto() r where r.punto_reorden > 0;

  when 'inventario_herramientas' then
    select jsonb_build_object('valor', count(*), 'modo', 'no',
      'nota', 'Conteos cerrados en el mes con "herramienta" en el nombre.',
      'evidencias', coalesce(jsonb_agg(jsonb_build_object('tipo', 'conteo', 'referencia', c.id::text, 'folio', c.nombre,
          'detalle', al.nombre || ' · ' || (select count(*) from conteo_lineas l where l.conteo_id = c.id) || ' artículos contados',
          'fecha', (c.cerrado_en at time zone tz)::date, 'cuenta', false) order by c.cerrado_en), '[]'::jsonb))
    into v_r
    from conteos c join almacenes al on al.id = c.almacen_id
    where c.estado = 'cerrado' and c.cerrado_en >= v_t0 and c.cerrado_en < v_t1 and sin_acentos(c.nombre) like '%herramienta%';

  when 'surtido_produccion' then
    with x as (
      select o.id, o.folio, a.nombre equipo, (o.terminada_en at time zone tz)::date terminada,
        (select count(*) from op_materiales m where m.orden_id = o.id and m.requerido > 0 and m.surtido < m.requerido
           and not es_consumible_taller(m.articulo_id)) sin_surtir,
        (select count(*) from op_materiales m where m.orden_id = o.id and m.requerido > 0 and not es_consumible_taller(m.articulo_id)) renglones
      from ordenes_produccion o join articulos a on a.id = o.articulo_id
      where o.terminada_en >= v_t0 and o.terminada_en < v_t1
    )
    select jsonb_build_object('posibles', count(*), 'modo', 'porcentaje',
      'nota', 'Órdenes terminadas en el mes. Incidencia: terminó con material sin surtir completo.',
      'evidencias', coalesce(jsonb_agg(jsonb_build_object('tipo', 'orden_produccion', 'referencia', x.id::text, 'folio', x.folio,
          'detalle', x.equipo || ' · ' || case when x.sin_surtir > 0 then x.sin_surtir || ' de ' || x.renglones || ' renglones sin surtir completo'
                                               else 'material surtido completo' end,
          'fecha', x.terminada, 'cantidad', x.sin_surtir, 'cuenta', x.sin_surtir > 0) order by x.terminada), '[]'::jsonb))
    into v_r from x;

  when 'recepcion_oc' then
    with oc as (
      select distinct m.orden_compra_id id from movimientos_inventario m
      where m.tipo = 'entrada_compra' and m.orden_compra_id is not null and m.en >= v_t0 and m.en < v_t1
    ), x as (
      select o.id, o.folio, p.nombre proveedor, o.fecha_entrega,
        (select count(*) from oc_lineas l where l.orden_compra_id = o.id and l.recibido > l.cantidad) de_mas,
        o.estado = 'parcial' and o.fecha_entrega < v_corte incompleta
      from oc join ordenes_compra o on o.id = oc.id join proveedores p on p.id = o.proveedor_id
    )
    select jsonb_build_object('posibles', count(*), 'modo', 'porcentaje',
      'nota', 'Órdenes de compra con entradas en el mes. Incidencia: se recibió de más, o quedó incompleta con su fecha de entrega vencida.',
      'evidencias', coalesce(jsonb_agg(jsonb_build_object('tipo', 'orden_compra', 'referencia', x.id::text, 'folio', x.folio,
          'detalle', x.proveedor || ' · ' || case when x.de_mas > 0 then 'se recibió de más en ' || x.de_mas || ' partida(s)'
                                                  when x.incompleta then 'incompleta; debía llegar el ' || to_char(x.fecha_entrega, 'DD/MM/YYYY')
                                                  else 'recibida como se pidió' end,
          'fecha', x.fecha_entrega, 'cuenta', x.de_mas > 0 or x.incompleta) order by x.folio), '[]'::jsonb))
    into v_r from x;

  -- ---------------------------------------------------------------------------
  -- 208: lo que ya se puede medir con lo construido después (leads, seguimientos,
  -- Mercado Libre, mantenimiento, terminal de piso, pendientes, kaizen, envíos).
  -- ---------------------------------------------------------------------------

  -- Leads que llegan solos: se asignan pronto. Las listas que se cargan de golpe (una expo) no
  -- cuentan: llegaron todas a la vez y nadie las esperaba. Las horas son de horario: un lead de
  -- las 9 de la noche no cuenta en contra hasta que abre el taller.
  when 'asignacion_4h' then
    with x as (
      select l.id, coalesce(nullif(trim(l.empresa), ''), l.nombre) quien, f.nombre fuente, l.creado_en, l.asignado_en,
        horas_en_horario(l.creado_en, coalesce(l.asignado_en, least(now(), v_t1 + interval '7 days'))) horas
      from leads l left join fuentes_contacto f on f.id = l.fuente_id
      where l.creado_en >= v_t0 and l.creado_en < v_t1 and not coalesce(f.de_lista, false)
        and not (l.estado = 'descartado' and l.asignado_en is null)
    ), y as (
      select x.*, x.asignado_en is null or x.horas > coalesce((p_parametros->>'horas')::numeric, 4) tarde from x
      -- El que todavía puede asignarse a tiempo no se juzga aún.
      where x.asignado_en is not null or x.horas > coalesce((p_parametros->>'horas')::numeric, 4)
    )
    select jsonb_build_object('posibles', count(*), 'modo', 'porcentaje',
      'nota', format('Leads que llegaron solos en el mes (sin las listas cargadas de golpe). Incidencia: asignado a un vendedor después de %s horas de horario, o sin asignar.',
                     coalesce((p_parametros->>'horas')::numeric, 4)),
      'evidencias', coalesce(jsonb_agg(jsonb_build_object('tipo', 'lead', 'referencia', y.id::text, 'folio', y.quien,
          'detalle', coalesce(y.fuente || ' · ', '') || case when y.asignado_en is null then 'sin asignar' else 'asignado en ' || round(y.horas, 1) || ' h de horario' end,
          'fecha', (y.creado_en at time zone tz)::date, 'cantidad', round(y.horas, 1), 'cuenta', y.tarde) order by y.creado_en), '[]'::jsonb))
    into v_r from y;

  -- Primer contacto: el lead se atiende dentro de un día de trabajo. Si la persona tiene leads
  -- asignados en el mes, se miden los suyos; si no (recepción, la gerencia), los de todos.
  when 'primer_contacto' then
    with x as (
      select l.id, coalesce(nullif(trim(l.empresa), ''), l.nombre) quien, f.nombre fuente, l.creado_en, l.atendido_en, l.vendedor_id,
        horas_en_horario(l.creado_en, coalesce(l.atendido_en, least(now(), v_t1 + interval '7 days'))) horas
      from leads l left join fuentes_contacto f on f.id = l.fuente_id
      where l.creado_en >= v_t0 and l.creado_en < v_t1 and not coalesce(f.de_lista, false)
        and not (l.estado = 'descartado' and l.atendido_en is null)
    ), y as (
      select x.*, x.atendido_en is null or x.horas > coalesce((p_parametros->>'horas')::numeric, 8) tarde from x
      where (x.atendido_en is not null or x.horas > coalesce((p_parametros->>'horas')::numeric, 8))
        and case when exists (select 1 from x where x.vendedor_id = v_usuario) then x.vendedor_id = v_usuario else true end
    )
    select jsonb_build_object('posibles', count(*), 'modo', 'porcentaje',
      'nota', format('Leads que llegaron solos en el mes%s. Incidencia: atendido después de %s horas de horario (un día de trabajo), o sin atender.',
                     case when exists (select 1 from leads l where l.vendedor_id = v_usuario and l.creado_en >= v_t0 and l.creado_en < v_t1) then ', los suyos' else '' end,
                     coalesce((p_parametros->>'horas')::numeric, 8)),
      'evidencias', coalesce(jsonb_agg(jsonb_build_object('tipo', 'lead', 'referencia', y.id::text, 'folio', y.quien,
          'detalle', coalesce(y.fuente || ' · ', '') || case when y.atendido_en is null then 'sin atender' else 'atendido en ' || round(y.horas, 1) || ' h de horario' end,
          'fecha', (y.creado_en at time zone tz)::date, 'cantidad', round(y.horas, 1), 'cuenta', y.tarde) order by y.creado_en), '[]'::jsonb))
    into v_r from y;

  -- Llamadas que registró la persona: con cliente y con qué se habló.
  when 'llamadas_registradas' then
    if v_usuario is null then
      v_r := jsonb_build_object('sin_dato', true, 'nota', 'La persona no tiene usuario en el ERP: no se sabe qué llamadas registró. Califícalo a mano.');
    else
      select jsonb_build_object('posibles', count(*), 'modo', 'porcentaje',
        'nota', 'Llamadas que registró en el mes. Incidencia: sin cliente, o sin decir qué se habló.',
        'evidencias', coalesce(jsonb_agg(jsonb_build_object('tipo', 'actividad', 'referencia', a.id::text, 'folio', coalesce(c.nombre, 'Sin cliente'),
            'detalle', coalesce(nullif(left(trim(a.descripcion), 120), ''), 'sin descripción'),
            'fecha', (a.en at time zone tz)::date, 'cuenta', a.cliente_id is null or length(trim(coalesce(a.descripcion, ''))) < 10) order by a.en), '[]'::jsonb))
      into v_r
      from actividades a left join clientes c on c.id = a.cliente_id
      where a.tipo = 'llamada' and a.usuario_id = v_usuario and a.en >= v_t0 and a.en < v_t1;
    end if;

  -- Seguimientos de cotización que vencían en el mes. Uno cerrado porque la cotización se ganó o
  -- se perdió antes de su día ya no aplica; cerrado después, sí se le pasó.
  when 'seguimientos_cotizacion' then
    with x as (
      select s.id, s.vence, s.estado, s.cerrado_en, s.vendedor_id, coalesce(c.folio, 'Seguimiento') folio, cl.nombre cliente,
        (s.cerrado_en at time zone tz)::date hecho
      from seguimientos_cotizacion s left join cotizaciones c on c.id = s.cotizacion_id left join clientes cl on cl.id = c.cliente_id
      where s.vence >= v_ini and s.vence < v_fin
        and not (s.estado = 'cerrado' and (s.cerrado_en at time zone tz)::date <= s.vence)
        and (s.estado <> 'pendiente' or s.vence < v_hoy)
    ), y as (
      select x.*, case when x.estado = 'pendiente' then true else x.hecho > x.vence end tarde from x
      where case when exists (select 1 from x where x.vendedor_id = v_usuario) then x.vendedor_id = v_usuario else true end
    )
    select jsonb_build_object('posibles', count(*), 'modo', 'porcentaje',
      'nota', 'Seguimientos de cotización que vencían en el mes (los suyos, si es vendedor). Incidencia: se hizo después de su día o sigue pendiente.',
      'evidencias', coalesce(jsonb_agg(jsonb_build_object('tipo', 'seguimiento', 'referencia', y.id::text, 'folio', y.folio,
          'detalle', coalesce(y.cliente || ' · ', '') || case when y.estado = 'pendiente' then 'pendiente desde el ' || to_char(y.vence, 'DD/MM')
                                                             when y.tarde then 'hecho ' || (y.hecho - y.vence) || ' día(s) tarde' else 'a tiempo' end,
          'fecha', y.vence, 'cuenta', y.tarde) order by y.vence), '[]'::jsonb))
    into v_r from y;

  -- Preguntas de Mercado Libre contestadas en horas de horario (la de la noche no cuenta hasta que se abre).
  when 'preguntas_ml_2h' then
    with x as (
      select p.id, coalesce(p.titulo_publicacion, p.item_id) publicacion, p.recibida_en, p.contestada_en,
        horas_en_horario(p.recibida_en, coalesce(p.contestada_en, least(now(), v_t1 + interval '7 days'))) horas
      from ml_preguntas p
      where p.recibida_en >= v_t0 and p.recibida_en < v_t1 and p.estado <> 'borrada'
    ), y as (
      select x.*, x.contestada_en is null or x.horas > coalesce((p_parametros->>'horas')::numeric, 2) tarde from x
      where x.contestada_en is not null or x.horas > coalesce((p_parametros->>'horas')::numeric, 2)
    )
    select jsonb_build_object('posibles', count(*), 'modo', 'porcentaje',
      'nota', format('Preguntas de Mercado Libre del mes. Incidencia: contestada después de %s horas de horario, o sin contestar.', coalesce((p_parametros->>'horas')::numeric, 2)),
      'evidencias', coalesce(jsonb_agg(jsonb_build_object('tipo', 'pregunta_ml', 'referencia', y.id::text, 'folio', left(y.publicacion, 60),
          'detalle', case when y.contestada_en is null then 'sin contestar' else 'contestada en ' || round(y.horas, 1) || ' h de horario' end,
          'fecha', (y.recibida_en at time zone tz)::date, 'cantidad', round(y.horas, 1), 'cuenta', y.tarde) order by y.recibida_en), '[]'::jsonb))
    into v_r from y;

  -- Preventivos que vencían en el mes: hechos a más tardar en su fecha.
  when 'preventivos_a_tiempo' then
    with x as (
      select o.id, o.folio, m.nombre maquina, o.vence, o.estado, (o.cerrada_en at time zone tz)::date cerrada
      from ordenes_mantenimiento o left join maquinas m on m.id = o.maquina_id
      where o.tipo = 'preventivo' and o.estado <> 'cancelada' and o.vence >= v_ini and o.vence < v_fin
        and (o.cerrada_en is not null or o.vence < v_hoy)
    )
    select jsonb_build_object('posibles', count(*), 'modo', 'porcentaje',
      'nota', 'Preventivos que vencían en el mes. Incidencia: se cerró después de su fecha o sigue abierto.',
      'evidencias', coalesce(jsonb_agg(jsonb_build_object('tipo', 'mantenimiento', 'referencia', x.id::text, 'folio', x.folio,
          'detalle', coalesce(x.maquina, 'Sin máquina') || ' · ' || case when x.cerrada is null then 'sigue abierto' when x.cerrada > x.vence
                       then 'hecho ' || (x.cerrada - x.vence) || ' día(s) tarde' else 'a tiempo' end,
          'fecha', x.vence, 'cuenta', x.cerrada is null or x.cerrada > x.vence) order by x.vence), '[]'::jsonb))
    into v_r from x;

  -- Horas de horario con una máquina parada por falla (lo que cae dentro del mes).
  when 'horas_paro_falla' then
    with x as (
      select o.id, o.folio, m.nombre maquina, o.fuera_desde, o.fuera_hasta,
        horas_en_horario(greatest(o.fuera_desde, v_t0), least(coalesce(o.fuera_hasta, now()), v_t1)) horas
      from ordenes_mantenimiento o left join maquinas m on m.id = o.maquina_id
      where o.estado <> 'cancelada' and o.fuera_desde is not null
        and o.fuera_desde < v_t1 and coalesce(o.fuera_hasta, now()) > v_t0
    )
    select jsonb_build_object('valor', coalesce(round(sum(x.horas), 1), 0), 'modo', 'no',
      'nota', 'Horas de horario que las máquinas estuvieron paradas por falla en el mes (de que se reportó parada a que volvió a trabajar). Menos es mejor.',
      'evidencias', coalesce(jsonb_agg(jsonb_build_object('tipo', 'mantenimiento', 'referencia', x.id::text, 'folio', x.folio,
          'detalle', coalesce(x.maquina, 'Sin máquina') || ' · ' || round(x.horas, 1) || ' h parada' || case when x.fuera_hasta is null then ' (sigue parada)' else '' end,
          'fecha', (x.fuera_desde at time zone tz)::date, 'cantidad', round(x.horas, 1), 'cuenta', true) order by x.fuera_desde), '[]'::jsonb))
    into v_r from x where x.horas > 0;

  -- Fallas reportadas en el mes: se empiezan a atender pronto (horas de horario).
  when 'respuesta_fallas' then
    with x as (
      select o.id, o.folio, m.nombre maquina, o.reportado_en, o.inicio_en,
        horas_en_horario(o.reportado_en, coalesce(o.inicio_en, least(now(), v_t1 + interval '7 days'))) horas
      from ordenes_mantenimiento o left join maquinas m on m.id = o.maquina_id
      where o.tipo = 'correctivo' and o.estado <> 'cancelada' and o.reportado_en >= v_t0 and o.reportado_en < v_t1
    ), y as (
      select x.*, x.inicio_en is null or x.horas > coalesce((p_parametros->>'horas')::numeric, 4) tarde from x
      where x.inicio_en is not null or x.horas > coalesce((p_parametros->>'horas')::numeric, 4)
    )
    select jsonb_build_object('posibles', count(*), 'modo', 'porcentaje',
      'nota', format('Fallas reportadas en el mes. Incidencia: se empezó a atender después de %s horas de horario, o no se ha atendido.', coalesce((p_parametros->>'horas')::numeric, 4)),
      'evidencias', coalesce(jsonb_agg(jsonb_build_object('tipo', 'mantenimiento', 'referencia', y.id::text, 'folio', y.folio,
          'detalle', coalesce(y.maquina, 'Sin máquina') || ' · ' || case when y.inicio_en is null then 'sin atender' else 'atendida en ' || round(y.horas, 1) || ' h de horario' end,
          'fecha', (y.reportado_en at time zone tz)::date, 'cantidad', round(y.horas, 1), 'cuenta', y.tarde) order by y.reportado_en), '[]'::jsonb))
    into v_r from y;

  -- Etapas terminadas en el mes: alguien marcó en la terminal quién la trabajó. Sin eso, las horas
  -- hombre, la eficiencia y el costo real de esa etapa no existen.
  when 'etapas_marcadas' then
    with x as (
      select x.id, o.folio, e.nombre etapa, x.fin,
        exists (select 1 from op_tiempos t where t.operacion_id = x.id and t.empleado_id is not null) marcada
      from op_operaciones x join ordenes_produccion o on o.id = x.orden_id join etapas e on e.id = x.etapa_id
      where x.estado = 'terminada' and x.fin >= v_t0 and x.fin < v_t1 and o.estado <> 'cancelada'
    )
    select jsonb_build_object('posibles', count(*), 'modo', 'porcentaje',
      'nota', 'Etapas terminadas en el mes. Incidencia: nadie marcó en la terminal quién la trabajó.',
      'evidencias', coalesce(jsonb_agg(jsonb_build_object('tipo', 'operacion', 'referencia', x.id::text, 'folio', x.folio,
          'detalle', x.etapa || ' · ' || case when x.marcada then 'marcada en la terminal' else 'sin marcar quién la trabajó' end,
          'fecha', (x.fin at time zone tz)::date, 'cuenta', not x.marcada) order by x.fin), '[]'::jsonb))
    into v_r from x;

  -- Horas reales contra las del costeo, de las etapas terminadas en el mes que se marcaron.
  when 'horas_contra_costeo' then
    with x as (
      select x.id, o.folio, e.nombre etapa, x.fin, x.horas_estimadas est,
        (select sum(horas_trabajadas(t.inicio, coalesce(t.fin, x.fin)) * t.personas) from op_tiempos t where t.operacion_id = x.id) real
      from op_operaciones x join ordenes_produccion o on o.id = x.orden_id join etapas e on e.id = x.etapa_id
      where x.estado = 'terminada' and x.fin >= v_t0 and x.fin < v_t1 and o.estado <> 'cancelada' and x.horas_estimadas > 0
    ), y as (select * from x where x.real > 0)
    select case when count(*) = 0 then jsonb_build_object('sin_dato', true,
        'nota', 'Ninguna etapa terminada en el mes se marcó en la terminal: no hay horas reales con qué comparar.')
      else jsonb_build_object('valor', round(100 * sum(y.real) / sum(y.est), 1), 'modo', 'no',
        'nota', format('Horas reales de %s etapa(s) terminadas en el mes y marcadas en la terminal, contra las del costeo (100 %% = lo estimado; más es que se tardó más).', count(*)),
        'evidencias', jsonb_agg(jsonb_build_object('tipo', 'operacion', 'referencia', y.id::text, 'folio', y.folio,
            'detalle', y.etapa || ' · ' || round(y.real, 1) || ' h de ' || round(y.est, 1) || ' h estimadas',
            'fecha', (y.fin at time zone tz)::date, 'cantidad', round(100 * y.real / y.est, 1), 'cuenta', y.real > y.est) order by y.fin)) end
    into v_r from y;

  -- Etapas que se reabrieron en el mes (se dieron por terminadas antes de tiempo o hubo que rehacer).
  when 'etapas_reabiertas' then
    select jsonb_build_object('valor', count(*), 'modo', 'no',
      'nota', 'Etapas que se reabrieron en el mes: se habían dado por terminadas antes de tiempo o hubo que rehacer algo. Menos es mejor.',
      'evidencias', coalesce(jsonb_agg(jsonb_build_object('tipo', 'evento', 'referencia', ev.id::text, 'folio', o.folio,
          'detalle', coalesce(e.nombre || ' · ', '') || coalesce(left(ev.nota, 140), 'sin motivo'),
          'fecha', (ev.en at time zone tz)::date, 'cuenta', true) order by ev.en), '[]'::jsonb))
    into v_r
    from op_eventos ev join ordenes_produccion o on o.id = ev.orden_id
    left join op_operaciones x on x.id = ev.operacion_id left join etapas e on e.id = x.etapa_id
    where ev.tipo = 'reabierta' and ev.en >= v_t0 and ev.en < v_t1;

  -- Pendientes de la persona que vencían en el mes.
  when 'pendientes_a_tiempo' then
    if v_usuario is null then
      v_r := jsonb_build_object('sin_dato', true, 'nota', 'La persona no tiene usuario en el ERP: no tiene pendientes. Califícalo a mano.');
    else
      with x as (
        select p.id, p.titulo, p.vence, p.estado, (p.cerrado_en at time zone tz)::date cerrado
        from pendientes p
        where p.responsable_id = v_usuario and p.estado <> 'cancelado' and p.vence >= v_ini and p.vence < v_fin
          and (p.estado <> 'abierto' or p.vence < v_hoy)
      )
      select jsonb_build_object('posibles', count(*), 'modo', 'porcentaje',
        'nota', 'Sus pendientes que vencían en el mes. Incidencia: se cerró después de su fecha o sigue abierto.',
        'evidencias', coalesce(jsonb_agg(jsonb_build_object('tipo', 'pendiente', 'referencia', x.id::text, 'folio', left(x.titulo, 60),
            'detalle', case when x.estado = 'abierto' then 'sigue abierto' when x.cerrado > x.vence then 'cerrado ' || (x.cerrado - x.vence) || ' día(s) tarde' else 'a tiempo' end,
            'fecha', x.vence, 'cuenta', x.estado = 'abierto' or x.cerrado > x.vence) order by x.vence), '[]'::jsonb))
      into v_r from x;
    end if;

  -- Ideas de mejora que propuso la persona (en Mejoras o desde la terminal, con su nombre).
  when 'ideas_mejora' then
    select jsonb_build_object('valor', count(*), 'modo', 'no',
      'nota', 'Ideas de mejora (kaizen) que propuso en el mes. Las que sugiere el sistema no cuentan.',
      'evidencias', coalesce(jsonb_agg(jsonb_build_object('tipo', 'mejora', 'referencia', m.id::text, 'folio', left(m.titulo, 60),
          'detalle', m.estado, 'fecha', (m.propuesta_en at time zone tz)::date, 'cuenta', false) order by m.propuesta_en), '[]'::jsonb))
    into v_r
    from mejoras m
    where m.propuesta_en >= v_t0 and m.propuesta_en < v_t1 and coalesce(m.quien_propone, '') not ilike 'claude%'
      and ((m.propuesta_por = v_usuario and m.quien_propone is null)
           or lower(trim(m.quien_propone)) = (select lower(trim(nombre)) from empleados where id = p_empleado));

  -- Solicitudes de precio de ventas que vencían en el mes, contestadas a tiempo.
  when 'solicitudes_precio_a_tiempo' then
    with x as (
      select s.id, s.folio, coalesce(a.nombre, s.descripcion) que, s.vence_en, s.contestada_en
      from solicitudes_precio s left join articulos a on a.id = s.articulo_id
      where s.estado <> 'cancelada' and s.vence_en >= v_t0 and s.vence_en < v_t1
        and (s.contestada_en is not null or s.vence_en < now())
    )
    select jsonb_build_object('posibles', count(*), 'modo', 'porcentaje',
      'nota', 'Solicitudes de precio que vencían en el mes. Incidencia: se contestó después de su plazo o sigue sin contestar.',
      'evidencias', coalesce(jsonb_agg(jsonb_build_object('tipo', 'solicitud_precio', 'referencia', x.id::text, 'folio', x.folio,
          'detalle', left(x.que, 80) || ' · ' || case when x.contestada_en is null then 'sin contestar' when x.contestada_en > x.vence_en then 'contestada tarde' else 'a tiempo' end,
          'fecha', (x.vence_en at time zone tz)::date, 'cuenta', x.contestada_en is null or x.contestada_en > x.vence_en) order by x.vence_en), '[]'::jsonb))
    into v_r from x;

  -- Envíos pedidos en el mes: empacados a más tardar el siguiente día hábil.
  when 'empaque_a_tiempo' then
    with x as (
      select v.id, v.folio, coalesce(v.destinatario, v.destino) a_quien, (v.solicitado_en at time zone tz)::date pedido,
        sumar_dias_habiles((v.solicitado_en at time zone tz)::date, coalesce((p_parametros->>'dias')::int, 1)) limite,
        (coalesce(v.empacado_en, v.enviado_en) at time zone tz)::date empacado
      from envios v
      where v.estado <> 'cancelado' and v.solicitado_en >= v_t0 and v.solicitado_en < v_t1
    ), y as (select * from x where x.empacado is not null or x.limite < v_hoy)
    select jsonb_build_object('posibles', count(*), 'modo', 'porcentaje',
      'nota', format('Envíos pedidos en el mes. Incidencia: se empacó después de %s día(s) hábil(es), o sigue sin empacar pasado ese plazo.', coalesce((p_parametros->>'dias')::int, 1)),
      'evidencias', coalesce(jsonb_agg(jsonb_build_object('tipo', 'envio', 'referencia', y.id::text, 'folio', y.folio,
          'detalle', coalesce(y.a_quien || ' · ', '') || case when y.empacado is null then 'sin empacar' when y.empacado > y.limite then 'empacado el ' || to_char(y.empacado, 'DD/MM') || ', tarde' else 'a tiempo' end,
          'fecha', y.pedido, 'cuenta', y.empacado is null or y.empacado > y.limite) order by y.pedido), '[]'::jsonb))
    into v_r from y;

  else
    v_r := jsonb_build_object('sin_dato', true, 'nota', 'Este indicador todavía no se mide solo: califícalo a mano.');
  end case;
  return v_r;
end $$;

revoke execute on function public.objetivo_medir(text, text, uuid, date, jsonb) from public, anon, authenticated;

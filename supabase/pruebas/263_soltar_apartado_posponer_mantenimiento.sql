-- 263, primera parte: «Soltar lo apartado» de una orden. Suelta todo o solo unas partidas, nunca lo
-- surtido; almacén y la gerencia sí, el piso, compras y ventas no; una orden cerrada no; y sin nada
-- apartado el paso «Material apartado» vuelve a pendiente (con quién lo soltó y por qué).
do $$
declare v_alm uuid; v_gp uuid; v_ing uuid; v_taller uuid; v_comp uuid; v_vend uuid;
  v_eq uuid; a1 uuid; a2 uuid; a3 uuid; v_pb int; v_op uuid; v_op2 uuid; v_ok boolean; v_msg text; r jsonb; v_exist numeric;
begin
  v_alm := pg_temp.usuario('alm263@hegamex.com', '{almacen}');
  v_gp := pg_temp.usuario('gp263@hegamex.com', '{gerente_produccion}');
  v_ing := pg_temp.usuario('ing263@hegamex.com', '{ingenieria}');
  v_taller := pg_temp.usuario('taller263@hegamex.com', '{produccion}');
  v_comp := pg_temp.usuario('comp263@hegamex.com', '{compras}');
  v_vend := pg_temp.usuario('vend263@hegamex.com', '{ventas}');
  select id into v_pb from almacenes where nombre = 'Planta Baja';
  insert into articulos (clave, tipo, nombre) values ('T263-EQ', 'equipo', 'T263 Banda') returning id into v_eq;
  insert into articulos (clave, tipo, nombre) values ('T263-A', 'componente', 'T263 Chumacera') returning id into a1;
  insert into articulos (clave, tipo, nombre) values ('T263-B', 'componente', 'T263 Polea') returning id into a2;
  insert into articulos (clave, tipo, nombre) values ('T263-C', 'componente', 'T263 Banda lisa') returning id into a3;
  insert into movimientos_inventario (tipo, articulo_id, almacen_id, cantidad, motivo)
  values ('inicial', a1, v_pb, 10, 'T263'), ('inicial', a2, v_pb, 10, 'T263'), ('inicial', a3, v_pb, 10, 'T263');
  insert into ordenes_produccion (articulo_id, cantidad, estado) values (v_eq, 1, 'planeada') returning id into v_op;
  insert into ordenes_produccion (articulo_id, cantidad, estado) values (v_eq, 1, 'planeada') returning id into v_op2;
  insert into op_materiales (orden_id, articulo_id, requerido) values (v_op, a1, 4), (v_op, a2, 3), (v_op, a3, 2), (v_op2, a1, 1);

  perform pg_temp.como(v_ing);
  perform revisar_orden(v_op, 'ingenieria');
  perform revisar_orden(v_op2, 'ingenieria');
  perform pg_temp.como(v_alm);
  perform apartar_material(v_op);
  perform apartar_material(v_op2);
  perform surtir_material(v_op, jsonb_build_array(jsonb_build_object('articulo_id', a1, 'cantidad', 1, 'almacen_id', v_pb)), 'Juan 263');
  assert (select e->>'estado' from jsonb_array_elements(validacion_orden(v_op)) e where e->>'paso' = 'apartado') = 'hecho', 'no quedó apartado';
  select sum(cantidad) into v_exist from existencias where articulo_id = a1;

  -- 1. El piso (producción 2, sin inventario 2), compras (inventario 2) y ventas NO sueltan.
  perform pg_temp.como(v_taller);
  begin perform soltar_apartado(v_op, null, 'Se apartó por error'); v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'el piso soltó lo apartado';
  perform pg_temp.como(v_comp);
  begin perform soltar_apartado(v_op, null, 'Se apartó por error'); v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'compras soltó lo apartado';
  perform pg_temp.como(v_vend);
  begin perform soltar_apartado(v_op, null, 'Se apartó por error'); v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'ventas soltó lo apartado';
  assert (select count(*) from reservas where orden_produccion_id = v_op and estado = 'activa') = 3, 'algo se soltó sin permiso';

  -- 2. Sin motivo, no.
  perform pg_temp.como(v_alm);
  begin perform soltar_apartado(v_op, null, ' err '); v_ok := true; exception when invalid_parameter_value then v_ok := false; end;
  assert not v_ok, 'soltó sin motivo';

  -- 3. Solo una partida: la polea se suelta, lo demás sigue apartado y el paso no vuelve a pendiente.
  r := soltar_apartado(v_op, array[a2], 'La polea va con la orden de la otra banda');
  assert (r->>'partidas')::int = 1 and (r->>'quedan_apartadas')::int = 2, 'resultado de soltar una partida: ' || r::text;
  assert (select estado = 'liberada' and soltada_por = v_alm and motivo_soltada like 'La polea%' from reservas
          where orden_produccion_id = v_op and articulo_id = a2), 'la polea no quedó soltada con quién y por qué';
  assert (select count(*) from reservas where orden_produccion_id = v_op and estado = 'activa') = 2, 'soltó de más';
  assert (select material_apartado_en is not null from ordenes_produccion where id = v_op), 'con partidas apartadas borró el apartado';
  assert (select e->>'estado' from jsonb_array_elements(validacion_orden(v_op)) e where e->>'paso' = 'apartado') = 'parcial',
    'con la polea suelta el paso debe decir que falta';
  begin perform soltar_apartado(v_op, array[a2], 'Otra vez la polea'); v_ok := true; exception when invalid_parameter_value then v_ok := false; get stacked diagnostics v_msg = message_text; end;
  assert not v_ok and v_msg like 'Esas partidas no tienen nada apartado%', 'soltó dos veces lo mismo: ' || coalesce(v_msg, '');

  -- 4. La gerencia suelta todo: lo surtido no se toca (ni la reserva ni el inventario); nada queda
  --    apartado y el paso vuelve a pendiente con quién y por qué. La otra orden no se toca.
  perform pg_temp.como(v_gp);
  r := soltar_apartado(v_op, null, 'Se apartó por error, era la OP equivocada');
  assert (r->>'partidas')::int = 2 and (r->>'quedan_apartadas')::int = 0, 'resultado de soltar todo: ' || r::text;
  assert (select estado = 'surtida' and cantidad = 1 and surtido = 1 from reservas where orden_produccion_id = v_op and articulo_id = a1),
    'lo surtido de la chumacera se tocó';
  assert (select surtido from op_materiales where orden_id = v_op and articulo_id = a1) = 1, 'cambió lo surtido de la orden';
  assert (select sum(cantidad) from existencias where articulo_id = a1) = v_exist, 'soltar movió el inventario';
  assert (select apartado = 0 and faltante = 3 from v_op_material where orden_id = v_op and articulo_id = a1), 'la chumacera sigue apartada';
  assert not exists (select 1 from reservas where orden_produccion_id = v_op and estado = 'activa'), 'quedó algo apartado';
  assert (select count(*) from reservas where orden_produccion_id = v_op2 and estado = 'activa') = 1, 'soltó lo de otra orden';
  assert (select material_apartado_en is null and material_apartado_por is null and material_soltado_por = v_gp
          and material_soltado_motivo like 'Se apartó por error%' from ordenes_produccion where id = v_op), 'no reinició el apartado';
  select e into r from jsonb_array_elements(validacion_orden(v_op)) e where e->>'paso' = 'apartado';
  assert r->>'estado' = 'pendiente' and r->>'detalle' like 'Se soltó lo apartado: Se apartó por error%' and r->>'por' is not null,
    'el paso no volvió a pendiente: ' || r::text;
  assert exists (select 1 from op_eventos where orden_id = v_op and tipo = 'nota' and usuario_id = v_gp
                 and nota like 'Se soltó lo apartado (todo)%T263 Chumacera%Motivo: Se apartó por error%'), 'la línea de tiempo no lo dice';
  perform pg_temp.como_postgres();
  assert exists (select 1 from bitacora where tabla = 'ordenes_produccion' and registro_id = v_op::text and usuario_id = v_gp
                 and accion = 'cambio'), 'no quedó en la bitácora';

  -- 5. Se puede volver a apartar y el paso regresa.
  perform pg_temp.como(v_alm);
  perform apartar_material(v_op);
  assert (select e->>'estado' from jsonb_array_elements(validacion_orden(v_op)) e where e->>'paso' = 'apartado') = 'hecho', 'no volvió a apartar';

  -- 6. Orden cerrada: no.
  perform pg_temp.como(v_gp);
  perform cancelar_orden(v_op2, 'El cliente ya no la quiere');
  perform pg_temp.como(v_alm);
  begin perform soltar_apartado(v_op2, null, 'Se apartó por error'); v_ok := true; exception when others then v_ok := false; v_msg := sqlerrm; end;
  assert not v_ok and v_msg like '%ya está cerrada%', 'soltó en una orden cerrada: ' || coalesce(v_msg, '');
end $$;

-- 263, segunda parte: «Posponer» un preventivo. Queda cuántas veces y por qué; no sale vencido hasta
-- su fecha nueva; el plan no lo mueve ni lo cancela; quien no programa el mantenimiento no puede; no
-- a una fecha pasada ni para adelantarlo; los planes por mes no se brincan un mes; y el bono sigue
-- midiendo contra la fecha del plan.
do $$
declare v_mtto uuid; v_gp uuid; v_taller uuid; v_alm uuid; v_vend uuid; v_maq uuid; v_plan uuid; v_ord uuid; v_falla uuid;
  v_antes date; v_f1 date := hoy_planta() + 7; v_f2 date := hoy_planta() + 14; v_ok boolean; v_msg text; m jsonb; x jsonb; v_n int;
  m1 uuid; m2 uuid;
begin
  perform pg_temp.como_postgres();
  v_mtto := pg_temp.usuario('mtto263@hegamex.com', '{mantenimiento}');
  v_gp := pg_temp.usuario('gp263b@hegamex.com', '{gerente_produccion}');
  v_taller := pg_temp.usuario('taller263b@hegamex.com', '{produccion}');
  v_alm := pg_temp.usuario('alm263b@hegamex.com', '{almacen}');
  v_vend := pg_temp.usuario('vend263b@hegamex.com', '{ventas}');

  perform pg_temp.como(v_mtto);
  insert into maquinas (numero, nombre, categoria) values ('T263-01', 'Cortadora 263', 'cortadoras') returning id into v_maq;
  insert into planes_preventivos (maquina_id, nombre, modo, cada_dias, ultima_fecha, anticipacion_dias)
  values (v_maq, 'Engrase 263', 'dias', 30, hoy_planta() - 40, 7) returning id into v_plan;
  perform generar_preventivos(v_maq);
  select id, vence into v_ord, v_antes from ordenes_mantenimiento where plan_id = v_plan and estado = 'pendiente';
  assert v_antes < hoy_planta() and (select vencida from v_ordenes_mantenimiento where id = v_ord), 'la orden de prueba debía salir vencida';
  assert (select situacion from v_planes_preventivos where id = v_plan) = 'vencido', 'el plan debía salir vencido';

  -- 1. Quien no programa el mantenimiento NO pospone: el piso, almacén (mantenimiento 2) y ventas.
  foreach v_msg in array array[v_taller::text, v_alm::text, v_vend::text] loop
    perform pg_temp.como(v_msg::uuid);
    begin perform posponer_mantenimiento(v_ord, v_f1, 'No se puede parar producción'); v_ok := true;
    exception when insufficient_privilege then v_ok := false; end;
    assert not v_ok, 'pospuso alguien sin permiso: ' || v_msg;
  end loop;

  -- 2. Sin motivo, a una fecha pasada o para adelantarlo, no.
  perform pg_temp.como(v_mtto);
  begin perform posponer_mantenimiento(v_ord, v_f1, 'no'); v_ok := true; exception when invalid_parameter_value then v_ok := false; end;
  assert not v_ok, 'pospuso sin motivo';
  begin perform posponer_mantenimiento(v_ord, hoy_planta() - 1, 'Salí a un servicio'); v_ok := true;
  exception when invalid_parameter_value then v_ok := false; get stacked diagnostics v_msg = message_text; end;
  assert not v_ok and v_msg like '%antes de hoy%', 'pospuso a una fecha pasada';
  assert (select pospuesto_veces = 0 and vence = v_antes from ordenes_mantenimiento where id = v_ord), 'algo cambió sin posponer';

  -- 3. Se pospone: fecha nueva, la del plan guardada, cuántas veces y por qué; deja de salir vencido.
  perform posponer_mantenimiento(v_ord, v_f1, 'Salí a un servicio en Zapopan');
  assert (select vence = v_f1 and vence_original = v_antes and pospuesto_veces = 1 and pospuesto_motivo = 'Salí a un servicio en Zapopan'
          and pospuesto_por = v_mtto from ordenes_mantenimiento where id = v_ord), 'no quedó pospuesto';
  assert (select not vencida and pospuesto_veces = 1 and pospuesto_por_nombre is not null from v_ordenes_mantenimiento where id = v_ord),
    'la orden pospuesta sigue vencida';
  assert (select situacion <> 'vencido' and proxima_fecha = v_f1 and orden_pospuesta_veces = 1 from v_planes_preventivos where id = v_plan),
    'el plan pospuesto sigue vencido o no dice la fecha nueva';
  perform pg_temp.como_postgres();   -- cada quien ve solo sus avisos
  assert (select count(*) from avisos where tipo = 'preventivo_pospuesto' and registro_id = v_ord::text and usuario_id = v_gp) = 1,
    'a la gerencia de producción no le llegó el aviso';
  assert not exists (select 1 from avisos where tipo = 'preventivo_pospuesto' and usuario_id = v_mtto), 'le avisó a quien lo pospuso';
  perform pg_temp.como(v_mtto);

  --    Adelantarlo no es posponer.
  begin perform posponer_mantenimiento(v_ord, v_f1 - 1, 'Mejor antes'); v_ok := true; exception when invalid_parameter_value then v_ok := false; end;
  assert not v_ok, 'se pudo «posponer» a una fecha antes de la que tenía';

  -- 4. Otra vez (la gerencia): queda la historia de las dos, con de dónde a dónde.
  perform pg_temp.como(v_gp);
  perform posponer_mantenimiento(v_ord, v_f2, 'No se pudo parar: entrega del lunes');
  assert (select vence = v_f2 and vence_original = v_antes and pospuesto_veces = 2 and pospuesto_motivo like 'No se pudo parar%'
          from ordenes_mantenimiento where id = v_ord), 'la segunda no quedó';
  assert (select count(*) from mantenimiento_posposiciones where orden_id = v_ord) = 2, 'faltan posposiciones en la historia';
  assert (select de = v_f1 and a = v_f2 and por = v_gp from mantenimiento_posposiciones where orden_id = v_ord order by en desc, id desc limit 1),
    'la historia no dice de dónde a dónde';
  perform pg_temp.como(v_vend);
  assert not exists (select 1 from mantenimiento_posposiciones where orden_id = v_ord), 'ventas ve la historia de mantenimiento';
  perform pg_temp.como_postgres();
  assert (select count(*) from bitacora where tabla = 'ordenes_mantenimiento' and registro_id = v_ord::text and accion = 'cambio') >= 2,
    'no quedó en la bitácora';

  -- 5. Métricas: se ven las posposiciones del periodo, lo que sigue pospuesto y cuántas veces cada abierto.
  perform pg_temp.como(v_mtto);
  m := metricas_mantenimiento(hoy_planta() - 30, hoy_planta());
  assert (m->'resumen'->>'posposiciones')::int >= 2 and (m->'resumen'->>'prev_pospuestos')::int >= 1, 'las métricas no ven lo pospuesto: ' || (m->'resumen')::text;
  select e into x from jsonb_array_elements(m->'pendientes') e where e->>'id' = v_ord::text;
  assert x is null or (x->>'pospuesto_veces')::int = 2, 'lo abierto no dice cuántas veces se pospuso: ' || coalesce(x::text, '');
  m := mantenimiento_analitica(hoy_planta() - 30, hoy_planta());
  assert m ? 'carga', 'la carga proyectada no salió';

  -- 6. Si cambian el plan, lo pospuesto no se mueve ni se cancela; solo la fecha que le tocaba.
  update planes_preventivos set cada_dias = 20 where id = v_plan;
  assert (select estado = 'pendiente' and vence = v_f2 and vence_original = preventivo_proxima(p) from ordenes_mantenimiento o, planes_preventivos p
          where o.id = v_ord and p.id = v_plan), 'el plan movió o canceló lo pospuesto';

  -- 7. Ya empezado no se pospone (se pausa); una falla no tiene fecha.
  perform mto_play(v_ord);
  begin perform posponer_mantenimiento(v_ord, v_f2 + 7, 'Me fui a otra'); v_ok := true; exception when others then v_ok := false; v_msg := sqlerrm; end;
  assert not v_ok and v_msg like '%ya se empezó%', 'pospuso una orden empezada: ' || coalesce(v_msg, '');
  v_falla := reportar_falla(v_maq, 'Truena 263');
  begin perform posponer_mantenimiento(v_falla, v_f2, 'Después la vemos'); v_ok := true; exception when others then v_ok := false; v_msg := sqlerrm; end;
  assert not v_ok and v_msg like 'Solo un preventivo%', 'pospuso una falla';

  -- 8. Plan «cada N días»: al cerrarlo, el siguiente cuenta desde que se hizo (así es el plan).
  perform cerrar_mantenimiento(v_ord, 'Engrase completo de la cortadora');
  assert (select proxima_fecha = preventivo_fecha('dias', hoy_planta(), 20, null, null, null, null, true) from v_planes_preventivos where id = v_plan),
    'el plan cada N días no contó desde el cierre';

  -- 9. Plan por mes: el del último lunes de noviembre, pospuesto al 4 de diciembre y hecho ese día, no
  --    brinca diciembre (sin lo pospuesto saldría el de enero).
  perform pg_temp.como_postgres();
  insert into planes_preventivos (maquina_id, nombre, modo, cada_meses, semana_mes, dia_semana, ultima_fecha)
  values (v_maq, 'Revisión 263', 'mes_semana', 1, 5, 1, '2026-12-04') returning id into v_plan;
  insert into ordenes_mantenimiento (maquina_id, tipo, estado, falla, plan_id, vence, vence_original, pospuesto_veces, pospuesto_motivo, cerrada_en)
  values (v_maq, 'preventivo', 'cerrada', 'Revisión 263', v_plan, '2026-12-04', '2026-11-30', 1, 'Salí a servicio', '2026-12-04 12:00-06');
  assert (select proxima_fecha from v_planes_preventivos where id = v_plan) = '2026-12-28', 'el plan por mes se brincó diciembre';
  update ordenes_mantenimiento set vence_original = null, pospuesto_veces = 0 where plan_id = v_plan;
  assert (select proxima_fecha from v_planes_preventivos where id = v_plan) = '2027-01-25', 'sin posponer, hecho en diciembre, toca enero (como antes)';

  -- 10. El bono mide contra la fecha del plan: pospuesto del 6 al 9 de mayo y hecho el 9 es tarde, con
  --     el motivo en la evidencia; el que tocaba en abril y se pospuso a mayo cuenta en abril.
  m := objetivo_medir('preventivos_a_tiempo', null, null, '2025-05-01');
  v_n := (m->>'posibles')::int;
  insert into ordenes_mantenimiento (maquina_id, tipo, estado, vence, vence_original, pospuesto_veces, pospuesto_motivo, cerrada_en)
  values (v_maq, 'preventivo', 'cerrada', '2025-05-09', '2025-05-06', 1, 'No se pudo parar la línea', '2025-05-09 15:00-06') returning id into m1;
  insert into ordenes_mantenimiento (maquina_id, tipo, estado, vence, vence_original, pospuesto_veces, pospuesto_motivo, cerrada_en)
  values (v_maq, 'preventivo', 'cerrada', '2025-05-05', '2025-04-28', 1, 'Faltó la refacción', '2025-05-05 15:00-06') returning id into m2;
  m := objetivo_medir('preventivos_a_tiempo', null, null, '2025-05-01');
  assert (m->>'posibles')::int = v_n + 1, 'el bono contó lo pospuesto en el mes nuevo: ' || m::text;
  select e into x from jsonb_array_elements(m->'evidencias') e where e->>'referencia' = m1::text;
  assert (x->>'cuenta')::boolean and x->>'fecha' = '2025-05-06' and x->>'detalle' like '%3 día(s) tarde · pospuesto 1 vez: No se pudo parar la línea',
    'el bono tomó la fecha pospuesta: ' || coalesce(x::text, 'no salió');
  m := objetivo_medir('preventivos_a_tiempo', null, null, '2025-04-01');
  assert (m->'evidencias') @> jsonb_build_array(jsonb_build_object('referencia', m2::text, 'cuenta', true)), 'el de abril no contó en abril';
end $$;

-- Los indicadores que ya se miden solos: cada uno cuenta la incidencia que debe, no cuenta lo que
-- no le toca (una lista de expo, un seguimiento que ya no aplica, la idea que sugirió el sistema) y
-- se mide por persona cuando es de la persona. Marzo de 2025: un mes sin otros datos de prueba.
do $$
declare
  v_ven uuid; v_otro uuid; e_ven uuid; e_mant uuid; f_form int; f_expo int; l1 uuid; l2 uuid; l3 uuid; l4 uuid;
  v_cli uuid; v_op uuid; s1 uuid; s2 uuid; s3 uuid; v_maq uuid; m1 uuid; m2 uuid; m3 uuid; p1 uuid; p2 uuid; p3 uuid;
  i1 uuid; i2 uuid; env1 uuid; env2 uuid; v_et int; v_orden uuid; v_orden2 uuid; x1 uuid; x2 uuid; m jsonb;
  mes constant date := '2025-03-01';
  -- Martes 4 de marzo de 2025, 10:00 en la planta.
  t0 constant timestamptz := '2025-03-04 10:00-06';
begin
  v_ven := pg_temp.usuario('ven208@hegamex.com', '{ventas}');
  v_otro := pg_temp.usuario('otro208@hegamex.com', '{ventas}');
  insert into empleados (nombre, fecha_ingreso, usuario_id) values ('P208 Vendedor', '2024-01-01', v_ven) returning id into e_ven;
  insert into empleados (nombre, fecha_ingreso) values ('P208 Mantenimiento', '2024-01-01') returning id into e_mant;

  -- 1. Leads: el de la expo no cuenta; el que se asignó al día siguiente sí es incidencia.
  insert into fuentes_contacto (nombre) values ('P208 Formulario') returning id into f_form;
  insert into fuentes_contacto (nombre, de_lista) values ('P208 Expo', true) returning id into f_expo;
  insert into leads (nombre, interes, telefono, fuente_id, creado_en, asignado_en, atendido_en, vendedor_id, estado)
    values ('P208 a tiempo', 'banda', '3300000001', f_form, t0, t0 + interval '1 hour', t0 + interval '2 hours', v_ven, 'asignado') returning id into l1;
  insert into leads (nombre, interes, telefono, fuente_id, creado_en, asignado_en, atendido_en, vendedor_id, estado)
    values ('P208 tarde', 'banda', '3300000002', f_form, t0, t0 + interval '30 hours', t0 + interval '54 hours', v_ven, 'asignado') returning id into l2;
  insert into leads (nombre, interes, telefono, fuente_id, creado_en, estado) values ('P208 expo', 'banda', '3300000003', f_expo, t0, 'nuevo') returning id into l3;
  insert into leads (nombre, interes, telefono, fuente_id, creado_en, asignado_en, atendido_en, vendedor_id, estado)
    values ('P208 de otro', 'banda', '3300000004', f_form, t0, t0 + interval '1 hour', t0 + interval '1 hour', v_otro, 'asignado') returning id into l4;
  -- El alta de un lead pone sus fechas de hoy (lo que pasa en la vida real); aquí se ponen las del caso.
  update leads set creado_en = t0, estado = 'asignado', vendedor_id = v_ven,
    asignado_en = t0 + case when id = l1 then interval '1 hour' else interval '30 hours' end,
    atendido_en = t0 + case when id = l1 then interval '2 hours' else interval '54 hours' end
  where id in (l1, l2);
  update leads set creado_en = t0, estado = 'asignado', vendedor_id = v_otro, asignado_en = t0 + interval '1 hour', atendido_en = t0 + interval '1 hour' where id = l4;
  update leads set creado_en = t0 where id = l3;

  m := objetivo_medir('asignacion_4h', null, e_mant, mes);
  assert not (m->'evidencias') @> jsonb_build_array(jsonb_build_object('referencia', l3::text)), 'contó el lead de la expo';
  assert (m->'evidencias') @> jsonb_build_array(jsonb_build_object('referencia', l2::text, 'cuenta', true)), format('el asignado al otro día no es incidencia: %s', m);
  assert (m->'evidencias') @> jsonb_build_array(jsonb_build_object('referencia', l1::text, 'cuenta', false)), 'el asignado en 1 h es incidencia';
  --    El primer contacto de un vendedor son sus leads, no los de otro.
  m := objetivo_medir('primer_contacto', null, e_ven, mes);
  assert (m->>'posibles')::int = 2 and not (m->'evidencias') @> jsonb_build_array(jsonb_build_object('referencia', l4::text)),
    format('el vendedor no se midió con sus leads: %s', m);
  assert (m->'evidencias') @> jsonb_build_array(jsonb_build_object('referencia', l2::text, 'cuenta', true)), 'el atendido a los dos días no es incidencia';

  -- 2. Seguimientos: hecho tarde cuenta; cerrado (se ganó o perdió) antes de su día no aplica.
  insert into clientes (nombre) values ('P208 Cliente') returning id into v_cli;
  insert into oportunidades (cliente_id, titulo) values (v_cli, 'P208') returning id into v_op;
  insert into seguimientos_cotizacion (oportunidad_id, vendedor_id, vence, estado, cerrado_en) values
    (v_op, v_ven, '2025-03-05', 'hecho', '2025-03-05 12:00-06') returning id into s1;
  insert into seguimientos_cotizacion (oportunidad_id, vendedor_id, vence, estado, cerrado_en) values
    (v_op, v_ven, '2025-03-10', 'hecho', '2025-03-12 12:00-06') returning id into s2;
  insert into seguimientos_cotizacion (oportunidad_id, vendedor_id, vence, estado, cerrado_en) values
    (v_op, v_ven, '2025-03-20', 'cerrado', '2025-03-15 12:00-06') returning id into s3;
  m := objetivo_medir('seguimientos_cotizacion', null, e_ven, mes);
  assert (m->>'posibles')::int = 2 and (m->'evidencias') @> jsonb_build_array(jsonb_build_object('referencia', s2::text, 'cuenta', true))
    and not (m->'evidencias') @> jsonb_build_array(jsonb_build_object('referencia', s3::text)), format('seguimientos: %s', m);

  -- 3. Mantenimiento: preventivo tarde, horas de paro dentro del horario, falla atendida tarde.
  insert into maquinas (numero, nombre, categoria) values ('P208-1', 'Plasma 208', 'maquina') returning id into v_maq;
  insert into ordenes_mantenimiento (maquina_id, tipo, estado, vence, cerrada_en) values
    (v_maq, 'preventivo', 'cerrada', '2025-03-06', '2025-03-06 15:00-06') returning id into m1;
  insert into ordenes_mantenimiento (maquina_id, tipo, estado, vence, cerrada_en) values
    (v_maq, 'preventivo', 'cerrada', '2025-03-07', '2025-03-11 15:00-06') returning id into m2;
  insert into ordenes_mantenimiento (maquina_id, tipo, estado, reportado_en, inicio_en, fuera_desde, fuera_hasta, detiene) values
    (v_maq, 'correctivo', 'cerrada', t0, t0 + interval '26 hours', t0, t0 + interval '2 hours', true) returning id into m3;
  m := objetivo_medir('preventivos_a_tiempo', null, e_mant, mes);
  assert (m->>'posibles')::int = 2 and (m->'evidencias') @> jsonb_build_array(jsonb_build_object('referencia', m2::text, 'cuenta', true)), format('preventivos: %s', m);
  m := objetivo_medir('horas_paro_falla', null, e_mant, mes);
  assert (m->>'valor')::numeric = round(horas_en_horario(t0, t0 + interval '2 hours'), 1), format('horas de paro: %s', m);
  m := objetivo_medir('respuesta_fallas', null, e_mant, mes);
  assert (m->'evidencias') @> jsonb_build_array(jsonb_build_object('referencia', m3::text, 'cuenta', true)), format('la falla atendida al otro día no es incidencia: %s', m);

  -- 4. Pendientes de la persona: cerrado tarde y abierto vencido cuentan; uno de otro no.
  insert into pendientes (titulo, responsable_id, creado_por, vence, estado, cerrado_en) values ('P208 a tiempo', v_ven, v_otro, '2025-03-10', 'hecho', '2025-03-10 09:00-06') returning id into p1;
  insert into pendientes (titulo, responsable_id, creado_por, vence, estado) values ('P208 abierto', v_ven, v_otro, '2025-03-12', 'abierto') returning id into p2;
  insert into pendientes (titulo, responsable_id, creado_por, vence, estado) values ('P208 de otro', v_otro, v_ven, '2025-03-12', 'abierto') returning id into p3;
  m := objetivo_medir('pendientes_a_tiempo', null, e_ven, mes);
  assert (m->>'posibles')::int = 2 and (m->'evidencias') @> jsonb_build_array(jsonb_build_object('referencia', p2::text, 'cuenta', true)), format('pendientes: %s', m);
  assert (objetivo_medir('pendientes_a_tiempo', null, e_mant, mes)->>'sin_dato')::boolean, 'sin usuario se midió pendientes';

  -- 5. Ideas de mejora: la suya cuenta; la que sugirió el sistema a su nombre de usuario, no.
  insert into mejoras (titulo, propuesta_por) values ('P208 idea', v_ven) returning id into i1;
  insert into mejoras (titulo, propuesta_por, quien_propone) values ('P208 sugerida', v_ven, 'Claude (sugerencia)') returning id into i2;
  update mejoras set propuesta_en = t0 where id in (i1, i2);
  m := objetivo_medir('ideas_mejora', null, e_ven, mes);
  assert (m->>'valor')::int = 1, format('ideas de mejora: %s', m);

  -- 6. Empaque: pedido el martes y empacado el jueves (2 días hábiles) es tarde.
  insert into envios (tipo, estado) values ('a_full', 'solicitado') returning id into env1;
  insert into envios (tipo, estado) values ('a_full', 'solicitado') returning id into env2;
  update envios set solicitado_en = t0, empacado_en = t0 + case when id = env1 then interval '3 hours' else interval '2 days' end where id in (env1, env2);
  m := objetivo_medir('empaque_a_tiempo', null, e_mant, mes);
  assert (m->'evidencias') @> jsonb_build_array(jsonb_build_object('referencia', env2::text, 'cuenta', true))
    and (m->'evidencias') @> jsonb_build_array(jsonb_build_object('referencia', env1::text, 'cuenta', false)), format('empaque: %s', m);

  -- 7. Etapas marcadas: la que tiene a alguien en la terminal cuenta bien; la otra no.
  insert into etapas (nombre, orden, capacidad_horas_semana) values ('P208 Área', 997, 40) returning id into v_et;
  insert into ordenes_produccion (articulo_id, cantidad, estado) values ((select id from articulos limit 1), 1, 'terminada') returning id into v_orden;
  insert into op_operaciones (orden_id, etapa_id, horas_estimadas, estado, inicio, fin) values (v_orden, v_et, 4, 'terminada', t0, t0 + interval '5 hours') returning id into x1;
  insert into ordenes_produccion (articulo_id, cantidad, estado) values ((select id from articulos limit 1), 1, 'terminada') returning id into v_orden2;
  insert into op_operaciones (orden_id, etapa_id, horas_estimadas, estado, inicio, fin) values (v_orden2, v_et, 4, 'terminada', t0, t0 + interval '5 hours') returning id into x2;
  update empleados set en_cuadrillas = true, etapa_id = v_et, departamento_id = departamento_produccion() where id = e_mant;
  insert into op_tiempos (orden_id, operacion_id, empleado_id, personas, inicio, fin) values (v_orden, x1, e_mant, 1, t0, t0 + interval '5 hours');
  m := objetivo_medir('etapas_marcadas', null, e_mant, mes);
  assert (m->'evidencias') @> jsonb_build_array(jsonb_build_object('referencia', x2::text, 'cuenta', true))
    and (m->'evidencias') @> jsonb_build_array(jsonb_build_object('referencia', x1::text, 'cuenta', false)), format('etapas marcadas: %s', m);
  m := objetivo_medir('horas_contra_costeo', null, e_mant, mes);
  assert (m->>'valor')::numeric > 0 and (m->'evidencias') @> jsonb_build_array(jsonb_build_object('referencia', x1::text)), format('horas contra costeo: %s', m);

  -- 8. El catálogo: los nuevos son automáticos y Mantenimiento es un área.
  assert (select count(*) from objetivo_indicadores where id between 62 and 72 and fuente = 'automatica') = 11, 'faltan indicadores nuevos';
  assert (select bool_and(fuente = 'automatica' and dato_faltante is null) from objetivo_indicadores
          where clave in ('asignacion_4h', 'primer_contacto', 'llamadas_registradas', 'empaque_a_tiempo')), 'no pasaron a automáticos';
  assert (select area from objetivo_indicadores where clave = 'preventivos_a_tiempo') = 'mantenimiento', 'preventivos no es de Mantenimiento';
end $$;

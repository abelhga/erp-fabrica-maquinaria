-- Horas de la terminal: con el modo «horario» solo cuenta el horario del taller menos los
-- descansos (nadie pausa para desayunar ni al irse); con «terminal», tal cual se marcó.
do $$
declare v_ger uuid; v_ven uuid; v_eq uuid; o uuid; x uuid; e1 uuid; v_pai int; v_ok boolean;
  -- Lunes 19 de octubre de 2026, hora de la planta.
  lun8 timestamptz := '2026-10-19 08:00 America/Mexico_City';
begin
  v_ger := pg_temp.usuario('ger163@hegamex.com', '{gerente_produccion}');
  v_ven := pg_temp.usuario('ven163@hegamex.com', '{ventas}');
  -- El horario de la prueba (el del taller: L–V 8:00 a 17:30) no depende de lo que alguien haya
  -- movido en la base. El de los plazos de compras (horario_habil, con sábado) no cuenta aquí.
  update configuracion set valor = '{"1":["08:00","18:00"],"2":["08:00","18:00"],"3":["08:00","18:00"],"4":["08:00","18:00"],"5":["08:00","18:00"],"6":["08:00","14:00"]}' where clave = 'horario_habil';
  update configuracion set valor = jsonb_set(valor, '{descansos_empresa}', '[]') where clave = 'calendario_laboral';
  update configuracion set valor = '{"modo": "horario", "horario": {"1": ["08:00", "17:30"], "2": ["08:00", "17:30"], "3": ["08:00", "17:30"], "4": ["08:00", "17:30"], "5": ["08:00", "17:30"]}, "descansos": [{"de": "10:00", "a": "11:00", "minutos": 40}, {"de": "15:00", "a": "15:20"}], "especiales": {}}' where clave = 'horas_taller';

  -- Un día completo: 9.5 h menos 40 min de desayuno y 20 de la tarde = 8.5 h (lo que cuenta el plan).
  assert horas_trabajadas(lun8, lun8 + interval '10 hours') = 8.5, format('día completo: %s', horas_trabajadas(lun8, lun8 + interval '10 hours'));
  -- Iniciada a las 17:00 y nadie la pausó hasta las 9:00 del martes: ½ h + 1 h, no 16.
  assert horas_trabajadas(lun8 + interval '9 hours', lun8 + interval '25 hours') = 1.5, 'la noche contó';
  -- Viernes 17:00 a lunes 9:00: ½ h + 1 h; ni el sábado ni el domingo.
  assert horas_trabajadas(lun8 + interval '4 days 9 hours', lun8 + interval '7 days 1 hour') = 1.5,
    format('fin de semana: %s', horas_trabajadas(lun8 + interval '4 days 9 hours', lun8 + interval '7 days 1 hour'));
  -- Media hora a la mitad del desayuno: se descuentan 2/3 de lo que cae en la ventana.
  assert round(horas_trabajadas(lun8 + interval '2 hours 15 minutes', lun8 + interval '2 hours 45 minutes'), 3) = round(10 / 60.0, 3), 'desayuno';
  assert horas_trabajadas(lun8, lun8) = 0 and horas_trabajadas(lun8, null) = 0, 'sin tramo';

  -- Las horas reales del piso y de la orden ya salen así.
  select id into v_pai from etapas where nombre = 'Pailería';
  insert into empleados (nombre, fecha_ingreso, etapa_id, departamento_id) values ('Genaro Prueba Ciento Tres', current_date, v_pai, departamento_produccion()) returning id into e1;
  insert into articulos (clave, tipo, nombre) values ('T163-EQ', 'equipo', 'Tren 163') returning id into v_eq;
  insert into ordenes_produccion (articulo_id, cantidad, estado) values (v_eq, 1, 'en_proceso') returning id into o;
  insert into op_operaciones (orden_id, etapa_id, horas_estimadas, estado, inicio) values (o, v_pai, 40, 'en_proceso', lun8 + interval '9 hours') returning id into x;
  insert into op_tiempos (operacion_id, orden_id, empleado_id, inicio, fin) values (x, o, e1, lun8 + interval '9 hours', lun8 + interval '25 hours');
  insert into op_tiempos (operacion_id, orden_id, personas, inicio, fin) values (x, o, 2, lun8 + interval '9 hours', lun8 + interval '25 hours');
  assert (select horas_reales from v_piso_operaciones where id = x) = 4.5, format('piso: %s', (select horas_reales from v_piso_operaciones where id = x));
  perform pg_temp.como(v_ger);
  assert (select horas_reales from horas_hombre_orden(o) where operacion_id = x) = 4.5, 'horas hombre de la orden';

  -- Ventas no cambia el modo; la gerencia sí, y entonces cuenta lo marcado tal cual.
  perform pg_temp.como(v_ven);
  begin perform poner_modo_horas('terminal'); v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'ventas cambió el modo de las horas';
  perform pg_temp.como(v_ger);
  begin perform poner_modo_horas('dias'); v_ok := true; exception when raise_exception then v_ok := false; end;
  assert not v_ok, 'aceptó un modo que no existe';
  perform poner_modo_horas('terminal');
  assert horas_trabajadas(lun8 + interval '9 hours', lun8 + interval '25 hours') = 16, 'modo terminal no contó lo marcado';
  assert (select horas_reales from v_piso_operaciones where id = x) = 48, 'el piso no siguió el modo';
  perform pg_temp.como_postgres();
  assert (select valor->'descansos' from configuracion where clave = 'horas_taller') is not null, 'perdió los descansos al cambiar el modo';
end $$;

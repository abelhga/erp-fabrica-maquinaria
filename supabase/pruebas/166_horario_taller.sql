-- El horario del taller lo pone la gerencia de producción: días, entrada y salida, descansos y
-- días con otro horario (tiempo extra). De ahí salen las horas, la jornada del plan y si el
-- taller está en horario ahorita. El horario de los plazos de compras ya no cuenta aquí.
do $$
declare v_ger uuid; v_sup uuid; v_ven uuid; v_ok boolean; v_err text; v_hoy date := hoy_mx(); a jsonb;
  semana jsonb := '{"1": ["08:00", "17:30"], "2": ["08:00", "17:30"], "3": ["08:00", "17:30"], "4": ["08:00", "17:30"], "5": ["08:00", "17:30"]}';
  descansos jsonb := '[{"de": "10:00", "a": "11:00", "minutos": 40}, {"de": "15:00", "a": "15:20"}]';
  -- Viernes 23 de octubre de 2026 a las 17:00, hora de la planta.
  vie17 timestamptz := '2026-10-23 17:00 America/Mexico_City';
begin
  v_ger := pg_temp.usuario('ger166@hegamex.com', '{gerente_produccion}');
  v_sup := pg_temp.usuario('sup166@hegamex.com', '{produccion}');
  v_ven := pg_temp.usuario('ven166@hegamex.com', '{ventas}');
  update configuracion set valor = jsonb_set(valor, '{descansos_empresa}', '[]') where clave = 'calendario_laboral';
  update configuracion set valor = '{"modo": "horario"}' where clave = 'horas_taller';
  -- El de compras trae sábado: si el taller lo usara, el sábado contaría.
  update configuracion set valor = '{"1":["08:00","18:00"],"2":["08:00","18:00"],"3":["08:00","18:00"],"4":["08:00","18:00"],"5":["08:00","18:00"],"6":["08:00","14:00"]}' where clave = 'horario_habil';

  -- Ni ventas ni el supervisor cambian el horario.
  perform pg_temp.como(v_ven);
  begin perform poner_horario_taller(semana, descansos); v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'ventas cambió el horario del taller';
  perform pg_temp.como(v_sup);
  begin perform poner_horario_taller(semana, descansos); v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'el supervisor cambió el horario del taller';

  -- La gerencia sí, y lo que no tiene sentido no entra.
  perform pg_temp.como(v_ger);
  begin perform poner_horario_taller('{"1": ["17:30", "08:00"]}', '[]'); v_ok := true; exception when raise_exception then v_ok := false; get stacked diagnostics v_err = message_text; end;
  assert not v_ok and v_err like '%salida%después de la entrada%', 'aceptó salir antes de entrar: ' || coalesce(v_err, '');
  begin perform poner_horario_taller('{"1": ["ocho", "17:30"]}', '[]'); v_ok := true; exception when raise_exception then v_ok := false; end;
  assert not v_ok, 'aceptó una hora que no se entiende';
  begin perform poner_horario_taller('{"1": null}', '[]'); v_ok := true; exception when raise_exception then v_ok := false; end;
  assert not v_ok, 'aceptó un taller que no trabaja ningún día';
  begin perform poner_horario_taller('{"8": ["08:00", "17:30"]}', '[]'); v_ok := true; exception when raise_exception then v_ok := false; end;
  assert not v_ok, 'aceptó un día de la semana que no existe';
  begin perform poner_horario_taller(semana, '[{"de": "10:00", "a": "11:00", "minutos": 90}]'); v_ok := true; exception when raise_exception then v_ok := false; end;
  assert not v_ok, 'aceptó un descanso más largo que su ventana';

  -- Se guarda limpio («8:00» → «08:00»; un descanso que dura toda su ventana no lleva minutos).
  perform poner_horario_taller('{"1": ["8:00", "17:30"], "2": ["08:00", "17:30"], "3": ["08:00", "17:30"], "4": ["08:00", "17:30"], "5": ["08:00", "17:30"], "6": null}',
                               '[{"de": "10:00", "a": "11:00", "minutos": 40}, {"de": "15:00", "a": "15:20", "minutos": 20}]', '{}');
  perform pg_temp.como_postgres();
  a := (select valor from configuracion where clave = 'horas_taller');
  assert a->'horario' = semana, 'el horario no quedó limpio: ' || (a->'horario')::text;
  assert a->'descansos' = '[{"de": "10:00", "a": "11:00", "minutos": 40}, {"de": "15:00", "a": "15:20"}]', 'los descansos no quedaron limpios: ' || (a->'descansos')::text;
  assert a->>'modo' = 'horario', 'perdió el modo al cambiar el horario';

  -- Lunes a viernes de 8:00 a 17:30 menos descansos: 8.5 h por día, 42.5 a la semana.
  assert (select count(*) from jornadas_taller()) = 5 and (select bool_and(horas = 8.5) from jornadas_taller()), 'jornadas de la semana';
  assert horas_semana_taller() = 42.5, 'horas de la semana: ' || horas_semana_taller();
  assert horas_jornada('2026-10-23') = 8.5 and horas_jornada('2026-10-24') = 0, 'el sábado contó o el viernes no';
  -- El viernes de 17:00 al lunes 9:00: ½ h + 1 h; el sábado no (aunque compras sí lo tenga).
  assert horas_trabajadas(vie17, vie17 + interval '64 hours') = 1.5, 'fin de semana: ' || horas_trabajadas(vie17, vie17 + interval '64 hours');
  -- El feriado de ley no se trabaja.
  assert horas_jornada('2026-11-16') = 0, 'contó el día de la Revolución';

  -- Tiempo extra: el sábado 24 de 8:00 a 14:00 cuenta (menos el desayuno), y un feriado que deciden trabajar, también.
  perform pg_temp.como(v_ger);
  perform poner_horario_taller(semana, descansos, '{"2026-10-24": ["08:00", "14:00"], "2026-11-16": ["08:00", "13:00"], "2026-10-28": null}');
  assert round(horas_jornada('2026-10-24'), 2) = 5.33, 'sábado de tiempo extra: ' || horas_jornada('2026-10-24');
  assert round(horas_trabajadas(vie17, vie17 + interval '64 hours'), 2) = 6.83, 'el sábado de tiempo extra no contó en las horas hombre';
  assert horas_jornada('2026-11-16') > 0, 'el feriado trabajado no contó';
  -- Un día marcado sin trabajo (null) no cuenta aunque sea miércoles.
  assert horas_jornada('2026-10-28') = 0, 'contó un miércoles marcado sin trabajo';
  -- La semana de siempre no cambia por un sábado suelto: el plan reparte con 42.5.
  assert horas_semana_taller() = 42.5, 'el tiempo extra movió la semana normal';
  begin perform poner_horario_taller(semana, descansos, '{"24/10/2026": ["08:00", "14:00"]}'); v_ok := true; exception when raise_exception then v_ok := false; end;
  assert not v_ok, 'aceptó una fecha que no se entiende';

  -- ¿En horario ahorita? Hoy sin trabajo y mañana de 8 a 17:30: fuera de horario y vuelve mañana a las 8.
  perform poner_horario_taller(semana, descansos, jsonb_build_object(to_char(v_hoy, 'YYYY-MM-DD'), null, to_char(v_hoy + 1, 'YYYY-MM-DD'), jsonb_build_array('08:00', '17:30')));
  perform pg_temp.como(v_ven);
  a := horario_taller_ahora();
  assert not (a->>'en_horario')::boolean, 'dijo en horario un día sin trabajo';
  assert (a->>'abre')::timestamptz = (v_hoy + 1 + time '08:00') at time zone 'America/Mexico_City', 'no dijo cuándo vuelve: ' || a::text;
  -- Hoy todo el día: en horario (salvo el último minuto) y dice a qué hora cierra.
  perform pg_temp.como(v_ger);
  perform poner_horario_taller(semana, descansos, jsonb_build_object(to_char(v_hoy, 'YYYY-MM-DD'), jsonb_build_array('00:00', '23:59')));
  a := horario_taller_ahora();
  assert (a->>'en_horario')::boolean = ((now() at time zone 'America/Mexico_City')::time < '23:59'), 'en horario: ' || a::text;
  assert (a->>'en_horario')::boolean is false or (a->>'cierra')::timestamptz = (v_hoy + time '23:59') at time zone 'America/Mexico_City', 'cierra: ' || a::text;
  perform pg_temp.como_postgres();
end $$;

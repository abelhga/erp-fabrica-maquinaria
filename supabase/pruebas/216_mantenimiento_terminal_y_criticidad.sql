-- Tercera entrega de la junta con Esteban: play y pausa por persona (las horas trabajadas salen de
-- los tramos) y la criticidad calculada con sus seis factores.
do $$
declare v_mtto uuid; v_alm uuid; v_vend uuid; v_a uuid; v_b uuid; v_c uuid; v_o1 uuid; v_o2 uuid; v_etapa int;
  r jsonb; v_ok boolean; v_msg text; v_h numeric; i int;
begin
  v_mtto := pg_temp.usuario('mtto216@hegamex.com', '{mantenimiento}');
  v_alm := pg_temp.usuario('comp216@hegamex.com', '{compras}');
  v_vend := pg_temp.usuario('vend216@hegamex.com', '{ventas}');
  select min(id) into v_etapa from etapas;
  insert into maquinas (numero, nombre, categoria, etapa_id, criticidad) values ('S216-A', 'Soldadora 216 A', 'soldadoras 216', v_etapa, 'muy_alta') returning id into v_a;
  insert into maquinas (numero, nombre, categoria) values ('T216-C', 'Taladro 216', 'taladros 216') returning id into v_c;
  insert into ordenes_mantenimiento (maquina_id, tipo, falla) values (v_a, 'correctivo', 'No prende') returning id into v_o1;
  insert into ordenes_mantenimiento (maquina_id, tipo, falla) values (v_c, 'preventivo', 'Lubricar') returning id into v_o2;

  -- 1. Play y pausa. Compras ve mantenimiento pero no lo atiende.
  perform pg_temp.como(v_alm);
  begin perform mto_play(v_o1); v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'compras dio play';

  perform pg_temp.como(v_mtto);
  perform mto_play(v_o1);
  perform mto_play(v_o1);   -- dos veces no abre dos tramos
  assert (select estado = 'en_proceso' and atendido_por is not null from ordenes_mantenimiento where id = v_o1), 'play no la empezó';
  assert (select count(*) from mantenimiento_tramos where orden_id = v_o1) = 1, 'el segundo play abrió otro tramo';
  assert (select yo_en_play and en_play = array[(select nombre from perfiles where id = v_mtto)] from v_ordenes_mantenimiento where id = v_o1), 'la vista no dice quién la trae';
  --    Play en otra pausa la que traía y dice a cuál se fue; un preventivo deja la máquina parada.
  perform mto_play(v_o2);
  assert (select fin is not null and motivo_pausa like 'Se pasó a %' from mantenimiento_tramos where orden_id = v_o1), 'no pausó la anterior';
  assert (select not yo_en_play and ultima_pausa is not null from v_ordenes_mantenimiento where id = v_o1), 'la vista no ve la pausa';
  assert (select fuera_desde is not null from ordenes_mantenimiento where id = v_o2), 'el preventivo no paró la máquina';
  perform mto_pausa(v_o2, 'Esperando refacción');
  begin perform mto_pausa(v_o2); v_ok := true; exception when others then v_ok := false; v_msg := sqlerrm; end;
  assert not v_ok and v_msg = 'No la tienes en play', 'pausó dos veces';

  -- 2. Al cerrar, las horas trabajadas son la suma de los tramos, contadas como las del taller.
  perform pg_temp.como_postgres();
  update mantenimiento_tramos set inicio = '2026-10-28 09:00-06', fin = '2026-10-28 12:00-06' where orden_id = v_o1;
  v_h := round(horas_trabajadas('2026-10-28 09:00-06', '2026-10-28 12:00-06')::numeric, 2);
  perform pg_temp.como(v_mtto);
  perform mto_play(v_o1);   -- un tramo abierto también cuenta: se cierra con la orden
  perform cerrar_mantenimiento(v_o1, 'Se cambió el cable de tierra');
  assert (select count(*) from mantenimiento_tramos where orden_id = v_o1 and fin is null) = 0, 'quedó un tramo abierto';
  assert (select horas_trabajadas = horas_tramos_mto(v_o1) and horas_trabajadas >= v_h and v_h > 2 from ordenes_mantenimiento where id = v_o1),
    format('horas: %s, esperado ≥ %s', (select horas_trabajadas from ordenes_mantenimiento where id = v_o1), v_h);
  --    Quien cierra puede escribir otra cifra (alguien olvidó dar play).
  perform mto_play(v_o2);
  perform cerrar_mantenimiento(v_o2, 'Lubricado completo', null, 1.5);
  assert (select horas_trabajadas = 1.5 from ordenes_mantenimiento where id = v_o2), 'no respetó las horas escritas';

  -- 3. Criticidad. Sin los dos factores que se capturan se queda la de la hoja.
  perform pg_temp.como_postgres();
  perform recalcular_criticidad();
  assert (select criticidad = 'muy_alta' from maquinas where id = v_a), 'tocó la criticidad de la hoja';
  perform pg_temp.como(v_mtto);
  r := criticidad_factores(v_a);
  assert not (r->>'completa')::boolean and r->>'nivel' is null, 'dio nivel sin factores: ' || r::text;

  --    Para el área (3) y lesión (2), sin respaldo y con la falla de arriba: 9 + 6 + 2 = 17, alta.
  update maquinas set impacto_produccion = 3, riesgo_seguridad = 2 where id = v_a;
  assert (select criticidad = 'alta' and criticidad_puntos = 17 and critica from maquinas where id = v_a),
    format('esperaba alta 17: %s', (select criticidad || ' ' || criticidad_puntos from maquinas where id = v_a));
  --    Otra soldadora en la misma área es respaldo: el impacto baja un escalón (6 + 6 + 2 = 14, sigue alta).
  perform pg_temp.como_postgres();
  insert into maquinas (numero, nombre, categoria, etapa_id) values ('S216-B', 'Soldadora 216 B', 'soldadoras 216', v_etapa) returning id into v_b;
  perform pg_temp.como(v_mtto);
  r := criticidad_factores(v_a);
  assert (select f->>'con' = 'S216-B' and (f->>'valor')::boolean from jsonb_array_elements(r->'factores') f where f->>'clave' = 'respaldo'), 'no vio el respaldo: ' || r::text;
  assert (select criticidad_puntos = 14 from maquinas where id = v_a), 'el respaldo no bajó el impacto';
  --    Corregido a mano (la otra no sirve para lo mismo): sin respaldo otra vez.
  update maquinas set tiene_respaldo = false where id = v_a;
  assert (select criticidad_puntos = 17 from maquinas where id = v_a), 'no respetó «sin respaldo»';
  --    Cada falla nueva cuenta: con 6 en el año, 9 + 6 + 6 = 21, muy alta.
  for i in 1..5 loop
    perform reportar_falla(v_a, 'Se bota el térmico ' || i);
  end loop;
  assert (select criticidad = 'muy_alta' and criticidad_puntos = 21 from maquinas where id = v_a), 'las fallas no subieron la criticidad';
  --    Un riesgo grave no se promedia: el taladro sin impacto, sin fallas, con riesgo 3 es alta.
  update maquinas set impacto_produccion = 0, riesgo_seguridad = 3 where id = v_c;
  assert (select criticidad = 'alta' and criticidad_puntos = 9 from maquinas where id = v_c), 'el riesgo grave se promedió';

  --    El costo sale como escalón, nunca como monto.
  perform pg_temp.como_postgres();
  insert into costos_servicio (mantenimiento_id, concepto, descripcion, monto, registrado_por) values (v_o1, 'servicio_externo', 'Rebobinado', 18000, v_mtto);
  perform pg_temp.como(v_mtto);
  r := criticidad_factores(v_a);
  assert (select f->>'valor' = 'medio' and (f->>'puntos')::int = 2 from jsonb_array_elements(r->'factores') f where f->>'clave' = 'costo'), 'costo: ' || r::text;
  assert r::text not like '%18000%', 'el monto se filtró';
  assert (select criticidad_puntos = 23 from maquinas where id = v_a), 'el costo no recalculó';

  -- 4. Ventas no ve factores ni tramos.
  perform pg_temp.como(v_vend);
  begin perform criticidad_factores(v_a); v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'ventas vio la criticidad';
  assert (select count(*) from mantenimiento_tramos) = 0, 'ventas ve los tramos';
end $$;

-- Junta con Esteban: preventivos por mes que nunca caen en día que no se trabaja, el plan que
-- cambia arrastra su orden pendiente, «Equipo de oficina», dar de baja con motivo (y quién no
-- puede) y las métricas que cuentan a la máquina dada de baja solo hasta su baja.
do $$
declare v_mtto uuid; v_taller uuid; v_vend uuid; v_maq uuid; v_herr uuid; v_plan uuid; v_ord uuid; v_ord2 uuid; v_vieja uuid;
  v_ok boolean; v_msg text; v_n int; v_d date; m jsonb; x jsonb; v_h numeric;
begin
  v_mtto := pg_temp.usuario('mtto212@hegamex.com', '{mantenimiento}');
  v_taller := pg_temp.usuario('taller212@hegamex.com', '{produccion}');
  v_vend := pg_temp.usuario('vend212@hegamex.com', '{ventas}');

  -- 0. dia_laborable dice lo mismo que el horario del taller (ventana_taller), día por día: con un
  --    sábado de tiempo extra, un feriado que sí se trabaja, un martes de descanso y un descanso de la empresa.
  update configuracion set valor = jsonb_set(valor, '{especiales}', coalesce(valor->'especiales', '{}') ||
    '{"2026-11-07": ["08:00", "13:00"], "2027-03-15": ["08:00", "17:30"], "2026-11-10": null}'::jsonb) where clave = 'horas_taller';
  update configuracion set valor = jsonb_set(coalesce(valor, '{}'), '{descansos_empresa}', coalesce(valor->'descansos_empresa', '[]') || '["2026-11-12"]'::jsonb)
  where clave = 'calendario_laboral';
  select count(*) into v_n from generate_series('2026-09-01'::date, '2027-03-31'::date, interval '1 day') g
  where dia_laborable(g::date) is distinct from exists (select 1 from ventana_taller(g::date));
  assert v_n = 0, format('dia_laborable no coincide con el horario del taller en %s días', v_n);
  assert dia_laborable('2026-11-07') and dia_laborable('2027-03-15') and not dia_laborable('2026-11-10') and not dia_laborable('2026-11-12'),
    'días especiales y descansos';

  -- 1. La regla de la fecha (con el horario del taller: L–V, feriados de ley).
  --    Primer lunes: después del 5 de octubre toca el 2 de noviembre.
  assert preventivo_fecha('mes_semana', '2026-10-05', null, 1, 1, 1, null, true) = '2026-11-02', 'primer lunes de noviembre';
  --    Cada 3 meses: el primer lunes de enero (el 1 es feriado y viernes; el lunes es el 4).
  assert preventivo_fecha('mes_semana', '2026-10-05', null, 3, 1, 1, null, true) = '2027-01-04', 'cada 3 meses';
  --    El primer lunes de febrero de 2027 es feriado (Constitución): pasa al martes 2. Sin la casilla, se queda.
  assert preventivo_fecha('mes_semana', '2027-01-04', null, 1, 1, 1, null, true) = '2027-02-02', 'feriado → siguiente día hábil';
  assert preventivo_fecha('mes_semana', '2027-01-04', null, 1, 1, 1, null, false) = '2027-02-01', 'sin «solo días hábiles» se queda en el feriado';
  --    Tercer lunes de noviembre (Revolución) → martes 17.
  assert preventivo_fecha('mes_semana', '2026-10-19', null, 1, 3, 1, null, true) = '2026-11-17', 'tercer lunes de noviembre';
  --    Último viernes de diciembre: el 25 (Navidad) → el lunes 28, todavía en diciembre.
  assert preventivo_fecha('mes_semana', '2026-11-27', null, 1, 5, 5, null, true) = '2026-12-28', 'último viernes de diciembre';
  --    El día 31 de enero de 2027 es domingo y el lunes ya es febrero (y feriado): se adelanta al viernes 29.
  assert preventivo_fecha('mes_dia', '2026-12-31', null, 1, null, null, 31, true) = '2027-01-29', 'no se brinca al mes siguiente';
  --    El 31 en un mes de 30 es el 30.
  assert preventivo_fecha('mes_dia', '2026-10-31', null, 1, null, null, 31, true) = '2026-11-30', 'día 31 en noviembre';
  --    Cada N días también se recorre al siguiente día hábil: del viernes 30 de octubre + 1 → lunes 2.
  assert preventivo_fecha('dias', '2026-10-30', 1, null, null, null, null, true) = '2026-11-02', 'cada N días en sábado → lunes';
  assert preventivo_fecha('dias', '2026-10-30', 1, null, null, null, null, false) = '2026-10-31', 'sin la casilla, sábado';

  -- 2. Un plan por mes: cerrar antes de tiempo no vuelve a programar el mismo mes.
  perform pg_temp.como(v_mtto);
  insert into maquinas (numero, nombre, categoria) values ('T212-01', 'Compresor 212', 'compresores') returning id into v_maq;
  insert into planes_preventivos (maquina_id, nombre, modo, cada_meses, semana_mes, dia_semana, ultima_fecha, anticipacion_dias)
  values (v_maq, 'Purga 212', 'mes_semana', 1, 1, 1, '2026-10-28', 7) returning id into v_plan;
  perform pg_temp.como_postgres();
  insert into ordenes_mantenimiento (maquina_id, tipo, estado, falla, plan_id, vence, cerrada_en)
  values (v_maq, 'preventivo', 'cerrada', 'Purga 212', v_plan, '2026-11-02', '2026-10-28 12:00-06');
  assert (select proxima_fecha from v_planes_preventivos where id = v_plan) = '2026-12-07', 'el preventivo de noviembre ya se hizo: toca el de diciembre';
  begin
    insert into planes_preventivos (maquina_id, nombre, modo, cada_meses, ultima_fecha) values (v_maq, 'Sin día 212', 'mes_semana', 1, current_date);
    v_ok := true;
  exception when check_violation then v_ok := false; end;
  assert not v_ok, 'un plan por mes sin día de la semana';

  -- 3. Sale la orden con la fecha de la regla; si cambian el plan y todavía no toca, se cancela.
  perform pg_temp.como(v_mtto);
  update planes_preventivos set modo = 'dias', cada_dias = 30, cada_meses = null, semana_mes = null, dia_semana = null,
    ultima_fecha = hoy_planta() - 40 where id = v_plan;
  v_n := generar_preventivos(v_maq);
  select id, vence into v_ord, v_d from ordenes_mantenimiento where plan_id = v_plan and estado = 'pendiente';
  assert v_n = 1 and v_d = (select proxima_fecha from v_planes_preventivos where id = v_plan) and dia_laborable(v_d), 'la orden sale en día hábil: ' || coalesce(v_d::text, 'null');
  update planes_preventivos set modo = 'mes_semana', cada_dias = null, cada_meses = 2, semana_mes = 1, dia_semana = 1,
    ultima_fecha = hoy_planta(), anticipacion_dias = 0 where id = v_plan;
  assert (select estado = 'cancelada' and motivo_cancelacion like 'Se cambió el calendario%' from ordenes_mantenimiento where id = v_ord), 'la orden vieja siguió abierta';
  assert generar_preventivos(v_maq) = 0, 'salió otra antes de tiempo';
  --    Si ya le capturaron algo, no se cancela: solo cambia su fecha.
  update planes_preventivos set modo = 'dias', cada_dias = 30, ultima_fecha = hoy_planta() - 40 where id = v_plan;
  perform generar_preventivos(v_maq);
  select id into v_ord2 from ordenes_mantenimiento where plan_id = v_plan and estado = 'pendiente';
  perform pg_temp.como_postgres();
  update ordenes_mantenimiento set diagnostico = 'Fuga en la purga 212' where id = v_ord2;
  perform pg_temp.como(v_mtto);
  update planes_preventivos set ultima_fecha = hoy_planta() where id = v_plan;
  assert (select estado = 'pendiente' and vence = (select proxima_fecha from v_planes_preventivos where id = v_plan) from ordenes_mantenimiento where id = v_ord2),
    'la orden con diagnóstico se canceló o no cambió de fecha';

  -- 4. Equipo de oficina con categoría nueva.
  insert into maquinas (numero, nombre, tipo, categoria) values ('T212-OF', 'Impresora 212', 'oficina', 'impresora');

  -- 5. Dar de baja: el taller y ventas no pueden; sin motivo no; prestada no.
  insert into maquinas (numero, nombre, tipo, categoria, prestable) values ('T212-H', 'Esmeril 212', 'herramienta', 'esmeriles', true) returning id into v_herr;
  perform prestar_herramienta(v_herr, null, 'Juan 212', p_para => 'Desbastar soportes');
  perform pg_temp.como(v_taller);
  begin perform dar_de_baja_maquina(v_maq, 'Ya no conviene repararlo'); v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'el taller dio de baja una máquina';
  perform pg_temp.como(v_vend);
  begin perform dar_de_baja_maquina(v_maq, 'Ya no conviene repararlo'); v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'ventas dio de baja una máquina';
  perform pg_temp.como(v_mtto);
  begin perform dar_de_baja_maquina(v_maq, ' '); v_ok := true; exception when others then v_ok := false; v_msg := sqlerrm; end;
  assert not v_ok and v_msg like '%por qué%', 'baja sin motivo';
  begin perform dar_de_baja_maquina(v_herr, 'Ya no conviene repararlo'); v_ok := true; exception when others then v_ok := false; v_msg := sqlerrm; end;
  assert not v_ok and v_msg like '%la tiene Juan 212%', 'baja de una herramienta prestada: ' || coalesce(v_msg, '');

  --    Con una falla abierta que la detiene: la falla se cancela, el paro termina, los planes se apagan.
  perform pg_temp.como_postgres();
  insert into ordenes_mantenimiento (maquina_id, tipo, estado, falla, detiene, fuera_desde) values (v_maq, 'correctivo', 'pendiente', 'Truena 212', true, now() - interval '2 hours');
  perform pg_temp.como(v_mtto);
  perform dar_de_baja_maquina(v_maq, 'Ya no conviene repararlo: el motor cuesta más que uno nuevo');
  assert (select estado = 'baja' and baja_en = hoy_planta() and motivo_baja like 'Ya no conviene%' and baja_por = v_mtto from maquinas where id = v_maq), 'no quedó de baja';
  assert not exists (select 1 from ordenes_mantenimiento where maquina_id = v_maq and estado in ('pendiente', 'en_proceso')), 'quedaron órdenes abiertas';
  assert (select fuera_hasta is not null and motivo_cancelacion like 'Se dio de baja%' from ordenes_mantenimiento where maquina_id = v_maq and falla = 'Truena 212'), 'el paro no terminó';
  assert not exists (select 1 from planes_preventivos where maquina_id = v_maq and activo), 'sus planes siguen activos';
  assert generar_preventivos(v_maq) = 0, 'una máquina de baja generó preventivo';
  assert (select baja_por_nombre is not null from v_maquinas where id = v_maq), 'la vista no dice quién la dio de baja';

  --    Se puede reactivar; los planes se quedan apagados.
  perform reactivar_maquina(v_maq);
  assert (select estado = 'operando' and baja_en is null from maquinas where id = v_maq), 'no se reactivó';
  assert not exists (select 1 from planes_preventivos where maquina_id = v_maq and activo), 'se prendieron los planes solos';

  -- 6. Métricas: la dada de baja a media quincena cuenta hasta su baja; la de antes del periodo, no.
  perform pg_temp.como_postgres();
  insert into maquinas (numero, nombre, categoria, estado, baja_en) values ('T212-B1', 'Roladora 212', 'roladora', 'baja', '2026-09-15') returning id into v_maq;
  insert into ordenes_mantenimiento (maquina_id, tipo, estado, falla, detiene, reportado_en, fuera_desde, fuera_hasta, cerrada_en)
  values (v_maq, 'correctivo', 'cerrada', 'Rodillo 212', true, '2026-09-10 11:00-06', '2026-09-10 11:00-06', '2026-09-10 15:00-06', '2026-09-10 15:00-06');
  insert into maquinas (numero, nombre, categoria, estado, baja_en) values ('T212-B0', 'Dobladora 212', 'dobladoras', 'baja', '2026-08-01') returning id into v_vieja;
  perform pg_temp.como(v_mtto);
  v_h := horas_en_horario('2026-09-01 00:00-06', '2026-09-16 00:00-06');
  m := metricas_mantenimiento('2026-09-01', '2026-09-30');
  select e into x from jsonb_array_elements(m->'maquinas') e where e->>'numero' = 'T212-B1';
  assert (x->>'horas_fuera')::numeric = 4 and (x->>'disponibilidad')::numeric = round(1 - 4 / v_h, 4)
     and (x->>'mtbf_h')::numeric = round(v_h - 4, 0), 'la dada de baja el 15 cuenta hasta el 15: ' || coalesce(x::text, 'no salió');
  assert not exists (select 1 from jsonb_array_elements(m->'maquinas') e where e->>'numero' = 'T212-B0'), 'salió una baja de antes del periodo';
end $$;

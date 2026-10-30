-- Métricas de mantenimiento: disponibilidad, MTBF, MTTR (en horas laborales, 212), preventivo a
-- tiempo, reincidencia; costos solo con costos; ventas no las ve.
do $$
declare v_mtto uuid; v_gp uuid; v_vend uuid; v_maq uuid; v_otra uuid; m jsonb; x jsonb; v_ok boolean; v_n int; v_h numeric;
begin
  v_mtto := pg_temp.usuario('mtto157@hegamex.com', '{mantenimiento}');
  v_gp := pg_temp.usuario('gp157@hegamex.com', '{gerente_produccion}');
  v_vend := pg_temp.usuario('ven157@hegamex.com', '{ventas}');
  insert into maquinas (numero, nombre, categoria, critica, criticidad) values ('T157-01', 'Plasma 157', 'plasma', true, 'muy_alta') returning id into v_maq;
  insert into maquinas (numero, nombre, categoria) values ('T157-02', 'Taladro 157', 'taladro') returning id into v_otra;

  -- Todo en horas laborales del taller (L–V 8:00–17:30 menos descansos), con fechas fijas de
  -- septiembre para que no dependa del día en que corre la prueba.
  -- Primera falla del plasma: se para el viernes 4 a las 16:00 y vuelve el lunes 7 a las 10:00.
  -- En calendario serían 66 h; trabajadas, 1.5 del viernes y 2 del lunes.
  insert into ordenes_mantenimiento (maquina_id, tipo, estado, falla, detiene, reportado_en, fuera_desde, fuera_hasta, cerrada_en, horas_trabajadas, atendido_por)
  values (v_maq, 'correctivo', 'cerrada', 'No enciende 157', true, '2026-09-04 16:00-06', '2026-09-04 16:00-06', '2026-09-07 10:00-06', '2026-09-07 10:00-06', 6, 'Técnico 157');
  -- La segunda, a los 10 días de esa reparación (reincidencia): jueves 17 de 11:00 a 15:00 (el 16 es feriado).
  insert into ordenes_mantenimiento (maquina_id, tipo, estado, falla, detiene, reportado_en, fuera_desde, fuera_hasta, cerrada_en, horas_trabajadas, atendido_por)
  values (v_maq, 'correctivo', 'cerrada', 'Vuelve a no encender 157', true, '2026-09-17 11:00-06', '2026-09-17 11:00-06', '2026-09-17 15:00-06', '2026-09-17 15:00-06', 2, 'Técnico 157');
  -- Un preventivo a tiempo y otro vencido sin hacer.
  insert into ordenes_mantenimiento (maquina_id, tipo, estado, falla, vence, cerrada_en, horas_trabajadas, atendido_por)
  values (v_otra, 'preventivo', 'cerrada', 'Lubricar 157', '2026-09-10', '2026-09-08 12:00-06', 1, 'Técnico 157');
  insert into ordenes_mantenimiento (maquina_id, tipo, estado, falla, vence) values (v_maq, 'preventivo', 'pendiente', 'Cambiar boquilla 157', current_date - 2);

  perform pg_temp.como(v_mtto);
  v_h := horas_en_horario('2026-09-01 00:00-06', '2026-10-01 00:00-06');
  m := metricas_mantenimiento('2026-09-01', '2026-09-30');
  assert (m->'periodo'->>'horas')::numeric = round(v_h, 1) and v_h between 150 and 200, 'horas laborales del periodo: ' || (m->'periodo')::text;
  select e into x from jsonb_array_elements(m->'maquinas') e where e->>'numero' = 'T157-01';
  assert (x->>'fallas')::int = 2, 'fallas del plasma: ' || x::text;
  assert (x->>'horas_fuera')::numeric = 7.5, 'horas fuera del plasma (laborales, no 70 de calendario): ' || x::text;
  assert (x->>'disponibilidad')::numeric = round(1 - 7.5 / v_h, 4), 'disponibilidad del plasma: ' || x::text;
  assert (x->>'mtbf_h')::numeric = round((v_h - 7.5) / 2, 0), 'MTBF del plasma: ' || x::text;
  assert (x->>'mttr_h')::numeric = 3.8, 'MTTR del plasma (3.5 y 4 h laborales): ' || x::text;
  select e into x from jsonb_array_elements(m->'maquinas') e where e->>'numero' = 'T157-02';
  assert (x->>'prev_programados')::int = 1 and (x->>'prev_a_tiempo')::int = 1 and (x->>'disponibilidad')::numeric = 1, 'preventivo del taladro: ' || x::text;
  assert exists (select 1 from jsonb_array_elements(m->'reincidencias') e where e->>'falla' = 'Vuelve a no encender 157' and (e->>'dias')::int = 10), 'no salió la reincidencia';
  assert exists (select 1 from jsonb_array_elements(m->'pendientes') e where e->>'falla' = 'Cambiar boquilla 157'), 'no salió el preventivo vencido';
  assert (m->'resumen'->>'prev_vencidos')::int >= 1, 'no contó el vencido';
  assert exists (select 1 from jsonb_array_elements(m->'tecnicos') e where e->>'quien' = 'Técnico 157' and (e->>'horas')::numeric = 9), 'horas del técnico';
  assert not (m->>'con_costos')::boolean and m->'resumen'->'costo' = 'null'::jsonb, 'mantenimiento vio costos';

  -- Una falla abierta que detiene cuenta como parada ahorita.
  v_n := (m->'resumen'->>'paradas_ahora')::int;
  perform pg_temp.como_postgres();
  insert into ordenes_mantenimiento (maquina_id, tipo, estado, falla, detiene, fuera_desde) values (v_otra, 'correctivo', 'pendiente', 'Se trabó 157', true, now());
  perform pg_temp.como(v_mtto);
  assert (metricas_mantenimiento(current_date - 29, current_date)->'resumen'->>'paradas_ahora')::int = v_n + 1, 'no contó la parada';

  -- La gerencia también; ventas no.
  perform pg_temp.como(v_gp);
  m := metricas_mantenimiento(current_date - 29, current_date);
  assert (m->'resumen'->>'maquinas')::int >= 2, 'la gerencia no ve métricas de mantenimiento';
  perform pg_temp.como(v_vend);
  begin perform metricas_mantenimiento(current_date - 29, current_date); v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'ventas vio métricas de mantenimiento';
end $$;

-- Métricas de mantenimiento: disponibilidad, MTBF, MTTR, preventivo a tiempo, reincidencia;
-- costos solo con costos; ventas no las ve.
do $$
declare v_mtto uuid; v_gp uuid; v_vend uuid; v_maq uuid; v_otra uuid; m jsonb; x jsonb; v_ok boolean; v_n int;
begin
  v_mtto := pg_temp.usuario('mtto157@hegamex.com', '{mantenimiento}');
  v_gp := pg_temp.usuario('gp157@hegamex.com', '{gerente_produccion}');
  v_vend := pg_temp.usuario('ven157@hegamex.com', '{ventas}');
  insert into maquinas (numero, nombre, categoria, critica, criticidad) values ('T157-01', 'Plasma 157', 'plasma', true, 'muy_alta') returning id into v_maq;
  insert into maquinas (numero, nombre, categoria) values ('T157-02', 'Taladro 157', 'taladro') returning id into v_otra;

  -- Dos fallas del plasma: la primera paró 10 h y se cerró hace 20 días; la segunda volvió
  -- a fallar a los 5 días de esa reparación (reincidencia) y paró 4 h.
  insert into ordenes_mantenimiento (maquina_id, tipo, estado, falla, detiene, reportado_en, fuera_desde, fuera_hasta, cerrada_en, horas_trabajadas, atendido_por)
  values (v_maq, 'correctivo', 'cerrada', 'No enciende 157', true, now() - interval '20 days 10 hours', now() - interval '20 days 10 hours', now() - interval '20 days', now() - interval '20 days', 6, 'Técnico 157');
  insert into ordenes_mantenimiento (maquina_id, tipo, estado, falla, detiene, reportado_en, fuera_desde, fuera_hasta, cerrada_en, horas_trabajadas, atendido_por)
  values (v_maq, 'correctivo', 'cerrada', 'Vuelve a no encender 157', true, now() - interval '15 days 4 hours', now() - interval '15 days 4 hours', now() - interval '15 days', now() - interval '15 days', 2, 'Técnico 157');
  -- Un preventivo a tiempo y otro vencido sin hacer.
  insert into ordenes_mantenimiento (maquina_id, tipo, estado, falla, vence, cerrada_en, horas_trabajadas, atendido_por)
  values (v_otra, 'preventivo', 'cerrada', 'Lubricar 157', current_date - 3, now() - interval '5 days', 1, 'Técnico 157');
  insert into ordenes_mantenimiento (maquina_id, tipo, estado, falla, vence) values (v_maq, 'preventivo', 'pendiente', 'Cambiar boquilla 157', current_date - 2);

  perform pg_temp.como(v_mtto);
  m := metricas_mantenimiento(current_date - 29, current_date);
  select e into x from jsonb_array_elements(m->'maquinas') e where e->>'numero' = 'T157-01';
  assert (x->>'fallas')::int = 2, 'fallas del plasma: ' || x::text;
  assert (x->>'horas_fuera')::numeric = 14, 'horas fuera del plasma: ' || x::text;
  assert (x->>'disponibilidad')::numeric < 1 and (x->>'disponibilidad')::numeric > 0.97, 'disponibilidad del plasma: ' || x::text;
  assert (x->>'mtbf_h')::numeric > 300, 'MTBF del plasma: ' || x::text;
  assert (x->>'mttr_h')::numeric = 7, 'MTTR del plasma (10 y 4 h): ' || x::text;
  select e into x from jsonb_array_elements(m->'maquinas') e where e->>'numero' = 'T157-02';
  assert (x->>'prev_programados')::int = 1 and (x->>'prev_a_tiempo')::int = 1 and (x->>'disponibilidad')::numeric = 1, 'preventivo del taladro: ' || x::text;
  assert exists (select 1 from jsonb_array_elements(m->'reincidencias') e where e->>'falla' = 'Vuelve a no encender 157' and (e->>'dias')::int = 5), 'no salió la reincidencia';
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

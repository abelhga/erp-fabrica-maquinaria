-- Analítica de producción: cuánto creerle a cada número (con tiempo, marcada sin tiempo, sin
-- marcar), lo vencido cuenta como tarde, las horas contra el costeo solo de lo que la terminal vio
-- desde que empezó, la gerencia ve horas pero nunca pesos, y ventas y la terminal no ven nada.
-- Las cifras se comparan contra lo que había antes de crear los datos, para no depender de la base.
do $$
declare v_gp uuid; v_ip uuid; v_ven uuid; v_term uuid; v_dir uuid; v_eq uuid;
  v_cor int; v_pai int; v_pin int; v_sig int;
  oa uuid; ob uuid; oc uuid; od uuid; ofh uuid; og uuid; oe uuid; e_cor uuid; opl uuid; ocan uuid; x_can uuid;
  a_pin uuid; a_sig uuid; b_cor uuid; b_pai uuid; c_cor uuid; c_pai uuid; d_pin uuid;
  a0 jsonb; a jsonb; m0 jsonb; m jsonb; v_ok boolean; x jsonb;
begin
  v_gp := pg_temp.usuario('gp252@hegamex.com', '{gerente_produccion}');
  v_ip := pg_temp.usuario('ip252@hegamex.com', '{ingenieria_procesos}');
  v_ven := pg_temp.usuario('ven252@hegamex.com', '{ventas}');
  v_term := pg_temp.usuario('term252@hegamex.com', '{terminal}');
  v_dir := pg_temp.usuario('dir252@hegamex.com', '{direccion}');
  -- Horas de reloj, para no depender de la hora a la que corre la prueba (el horario lo prueba 163).
  update configuracion set valor = jsonb_set(valor, '{modo}', '"terminal"') where clave = 'horas_taller';
  select id into v_cor from etapas where nombre = 'Corte';
  select id into v_pai from etapas where nombre = 'Pailería';
  select id into v_pin from etapas where nombre = 'Pintura';
  select id into v_sig from etapas where orden > (select orden from etapas where id = v_pin) and activa and not en_paralelo order by orden limit 1;
  insert into tarifas_mano_obra (etapa_id, costo_hora) values (v_pin, 100) on conflict (etapa_id) do update set costo_hora = excluded.costo_hora;

  -- Lo que había antes, visto por la gerencia.
  perform pg_temp.como(v_gp);
  a0 := produccion_analitica(current_date - 30, current_date);
  m0 := metricas_produccion(current_date - 30, current_date);
  perform pg_temp.como_postgres();

  insert into articulos (clave, tipo, nombre) values ('T252-EQ', 'equipo', 'Banda analítica 252') returning id into v_eq;

  -- A. Liberada en el ERP: Pintura terminada con un tramo de 30 h (estimadas 10) y la siguiente ya puede empezar.
  insert into ordenes_produccion (articulo_id, cantidad, estado, fecha_compromiso) values (v_eq, 1, 'en_proceso', current_date + 30) returning id into oa;
  insert into op_eventos (orden_id, tipo, en) values (oa, 'liberada', now() - interval '10 days');
  insert into op_operaciones (orden_id, etapa_id, horas_estimadas, estado, inicio, fin)
    values (oa, v_pin, 10, 'terminada', now() - interval '6 days', now() - interval '6 days' + interval '30 hours') returning id into a_pin;
  insert into op_operaciones (orden_id, etapa_id, horas_estimadas) values (oa, v_sig, 8) returning id into a_sig;
  insert into op_tiempos (operacion_id, orden_id, personas, inicio, fin) values (a_pin, oa, 1, now() - interval '6 days', now() - interval '6 days' + interval '30 hours');
  insert into op_eventos (orden_id, operacion_id, tipo, en) values
    (oa, a_pin, 'inicio', now() - interval '6 days'), (oa, a_pin, 'fin', now() - interval '6 days' + interval '30 hours');

  -- B. De la hoja (sin «liberada»): Corte terminada sin iniciar y Pailería que empezó 20 días antes de su primer tramo.
  insert into ordenes_produccion (articulo_id, cantidad, estado, fecha_compromiso) values (v_eq, 1, 'en_proceso', current_date + 40) returning id into ob;
  insert into op_operaciones (orden_id, etapa_id, horas_estimadas, estado, inicio, fin)
    values (ob, v_cor, 4, 'terminada', now() - interval '26 days', now() - interval '26 days') returning id into b_cor;
  insert into op_eventos (orden_id, operacion_id, tipo, en) values (ob, b_cor, 'fin', now() - interval '26 days');
  insert into op_operaciones (orden_id, etapa_id, horas_estimadas, estado, inicio, avance)
    values (ob, v_pai, 40, 'en_proceso', now() - interval '25 days', 0.5) returning id into b_pai;
  insert into op_tiempos (operacion_id, orden_id, personas, inicio, fin) values (b_pai, ob, 1, now() - interval '5 days', now() - interval '5 days' + interval '30 hours');

  -- C. De la hoja: Corte cerrada sin eventos ni tramos (en bloque) y Pailería esperando detrás de ella.
  insert into ordenes_produccion (articulo_id, cantidad, estado, fecha_compromiso) values (v_eq, 1, 'en_proceso', current_date + 50) returning id into oc;
  insert into op_operaciones (orden_id, etapa_id, horas_estimadas, estado, inicio, fin)
    values (oc, v_cor, 4, 'terminada', now() - interval '3 days', now() - interval '3 days') returning id into c_cor;
  insert into op_operaciones (orden_id, etapa_id, horas_estimadas) values (oc, v_pai, 20) returning id into c_pai;

  -- D. Abierta y vencida hace 3 días.
  insert into ordenes_produccion (articulo_id, cantidad, estado, fecha_compromiso) values (v_eq, 1, 'liberada', hoy_mx() - 3) returning id into od;
  insert into op_operaciones (orden_id, etapa_id, horas_estimadas) values (od, v_pin, 5) returning id into d_pin;

  -- Dos terminadas: una de la hoja (terminada antes de existir en el ERP) y una liberada aquí.
  insert into ordenes_produccion (articulo_id, cantidad, estado, terminada_en, creado_en, fecha_compromiso)
    values (v_eq, 1, 'terminada', now() - interval '2 days', now() - interval '1 day', current_date) returning id into ofh;
  insert into ordenes_produccion (articulo_id, cantidad, estado, terminada_en, fecha_compromiso)
    values (v_eq, 1, 'terminada', now() - interval '1 day', current_date + 5) returning id into og;
  insert into op_eventos (orden_id, tipo, en) values (og, 'liberada', now() - interval '6 days');
  -- G marcó su Pailería a medias (1 h de 20) y no tiene horas reales completas.
  insert into op_operaciones (orden_id, etapa_id, horas_estimadas, estado, inicio, fin)
    values (og, v_pai, 20, 'terminada', now() - interval '4 days', now() - interval '1 day') returning id into x_can;
  insert into op_tiempos (operacion_id, orden_id, personas, inicio, fin) values (x_can, og, 1, now() - interval '4 days', now() - interval '4 days' + interval '1 hour');
  -- Una terminada con su única etapa marcada desde el principio: 12 h contra 10.
  insert into ordenes_produccion (articulo_id, cantidad, estado, terminada_en, creado_en, fecha_compromiso)
    values (v_eq, 1, 'terminada', now() - interval '2 days', now() - interval '4 days', current_date + 5) returning id into oe;
  insert into op_operaciones (orden_id, etapa_id, horas_estimadas, estado, inicio, fin)
    values (oe, v_cor, 10, 'terminada', now() - interval '3 days', now() - interval '3 days' + interval '12 hours') returning id into e_cor;
  insert into op_tiempos (operacion_id, orden_id, personas, inicio, fin) values (e_cor, oe, 1, now() - interval '3 days', now() - interval '3 days' + interval '12 hours');
  -- Planeada (no ha entrado al taller): su Pintura no está en la cola de nadie.
  insert into ordenes_produccion (articulo_id, cantidad, estado, fecha_compromiso) values (v_eq, 1, 'planeada', current_date + 60) returning id into opl;
  insert into op_operaciones (orden_id, etapa_id, horas_estimadas) values (opl, v_pin, 7);
  -- Cancelada con una pausa por máquina abierta: no cuenta como horas detenidas.
  insert into ordenes_produccion (articulo_id, cantidad, estado) values (v_eq, 1, 'cancelada') returning id into ocan;
  insert into op_operaciones (orden_id, etapa_id, horas_estimadas, estado, inicio) values (ocan, v_pin, 3, 'pausada', now() - interval '2 days') returning id into x_can;
  insert into op_eventos (orden_id, operacion_id, tipo, motivo, en) values (ocan, x_can, 'pausa', 'maquina', now() - interval '2 days');

  -- 1. Sin procesos no se ve: ventas (ve el avance de producción) y la terminal.
  perform pg_temp.como(v_ven);
  begin perform produccion_analitica(current_date - 30, current_date); v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'ventas vio la analítica de producción';
  perform pg_temp.como(v_term);
  begin perform produccion_analitica(current_date - 30, current_date); v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'la terminal vio la analítica de producción';

  -- 2. La gerencia: horas sí, pesos nunca.
  perform pg_temp.como(v_gp);
  a := produccion_analitica(current_date - 30, current_date);
  assert not (a->>'con_costos')::boolean, 'la gerencia de producción vio costos';
  assert not exists (select 1 from jsonb_array_elements(a->'horas') h where h->'desvio_costo' <> 'null'::jsonb), 'la gerencia vio el costo de la diferencia';
  -- Registro: Pintura y la Corte de E con tiempo; Corte una marcada sin tiempo (terminada sin iniciar) y una sin marcar.
  assert (select sum((r->>'con_tiempo')::int) from jsonb_array_elements(a->'registro') r)
       - coalesce((select sum((r->>'con_tiempo')::int) from jsonb_array_elements(a0->'registro') r), 0) = 2, format('con tiempo: %s', a->'registro');
  assert (select sum((r->>'sin_tiempo')::int) from jsonb_array_elements(a->'registro') r where (r->>'etapa_id')::int = v_cor)
       - coalesce((select sum((r->>'sin_tiempo')::int) from jsonb_array_elements(a0->'registro') r where (r->>'etapa_id')::int = v_cor), 0) = 1, format('sin tiempo: %s', a->'registro');
  assert (select sum((r->>'sin_marcar')::int) from jsonb_array_elements(a->'registro') r where (r->>'etapa_id')::int = v_cor)
       - coalesce((select sum((r->>'sin_marcar')::int) from jsonb_array_elements(a0->'registro') r where (r->>'etapa_id')::int = v_cor), 0) = 1, format('sin marcar: %s', a->'registro');
  -- Horas: Pintura 30 de 10 (×3); la Pailería que la terminal no vio empezar no entra (saldría ×0.38).
  assert (select (h->>'razon')::numeric = 3 and (h->>'terminada')::boolean from jsonb_array_elements(a->'horas') h where (h->>'operacion_id')::uuid = a_pin),
    format('Pintura no salió ×3: %s', a->'horas');
  assert not exists (select 1 from jsonb_array_elements(a->'horas') h where (h->>'operacion_id')::uuid = b_pai), 'entró la Pailería no cubierta';
  -- Cumplimiento: la vencida cae en «1 a 7 tarde» como vencida.
  assert (select (r->>'vencidas')::int from jsonb_array_elements(a->'cumplimiento'->'rangos') r where r->>'rango' = '1 a 7 tarde')
       - (select (r->>'vencidas')::int from jsonb_array_elements(a0->'cumplimiento'->'rangos') r where r->>'rango' = '1 a 7 tarde') = 1,
    format('la vencida no cayó en 1 a 7 tarde: %s', a->'cumplimiento'->'rangos');
  assert (a->'cumplimiento'->>'juzgadas')::int - (a0->'cumplimiento'->>'juzgadas')::int = 4, 'juzgadas: tres terminadas con fecha y una vencida';
  -- Dónde se atora: la siguiente de A espera desde que acabó Pintura (se sabe); la Pailería de C no (Corte se cerró sin marcar).
  x := (select e from jsonb_array_elements(a->'edad') e where (e->>'operacion_id')::uuid = a_sig);
  assert x->>'estado' = 'esperando' and (x->>'desde_conocido')::boolean, format('edad de la siguiente de A: %s', x);
  x := (select e from jsonb_array_elements(a->'edad') e where (e->>'operacion_id')::uuid = c_pai);
  assert x->>'estado' = 'esperando' and not (x->>'desde_conocido')::boolean, format('edad de la Pailería de C: %s', x);
  assert (select (e->>'estado') = 'en_proceso' from jsonb_array_elements(a->'edad') e where (e->>'operacion_id')::uuid = b_pai), 'falta la Pailería en proceso';
  -- Espera contra trabajo: la Pintura de A cuenta (liberada aquí, con tiempo y cubierta); con una sola no alcanza.
  assert coalesce((select (f->>'n')::int from jsonb_array_elements(a->'flujo') f where (f->>'etapa_id')::int = v_pin), 0)
       - coalesce((select (f->>'n')::int from jsonb_array_elements(a0->'flujo') f where (f->>'etapa_id')::int = v_pin), 0) = 1, format('flujo: %s', a->'flujo');
  assert exists (select 1 from jsonb_array_elements(a0->'flujo') f where (f->>'etapa_id')::int = v_pin)
      or not (select (f->>'suficiente')::boolean from jsonb_array_elements(a->'flujo') f where (f->>'etapa_id')::int = v_pin), 'flujo suficiente con una etapa';
  assert jsonb_typeof(a->'acumulado') = 'array' and jsonb_typeof(a->'pausas'->'motivos') = 'array', 'faltan el flujo acumulado o las pausas';
  -- En la cola de Pintura del último día entra la de D (5 h), no la planeada (7 h).
  assert coalesce((select (z->>'en_cola')::numeric from jsonb_array_elements(a->'acumulado') z where (z->>'etapa_id')::int = v_pin order by z->>'dia' desc limit 1), 0)
       - coalesce((select (z->>'en_cola')::numeric from jsonb_array_elements(a0->'acumulado') z where (z->>'etapa_id')::int = v_pin order by z->>'dia' desc limit 1), 0) = 5,
    format('cola de Pintura: %s', (select jsonb_agg(z) from jsonb_array_elements(a->'acumulado') z where (z->>'etapa_id')::int = v_pin));
  assert coalesce((select (p->>'pausas')::int from jsonb_array_elements(a->'pausas'->'motivos') p where p->>'motivo' = 'maquina'), 0)
       = coalesce((select (p->>'pausas')::int from jsonb_array_elements(a0->'pausas'->'motivos') p where p->>'motivo' = 'maquina'), 0), 'contó la pausa de una orden cancelada';

  -- 3. Ingeniería de procesos ve costos: la diferencia de Pintura son 20 h × $100.
  perform pg_temp.como(v_ip);
  a := produccion_analitica(current_date - 30, current_date);
  assert (a->>'con_costos')::boolean, 'ingeniería de procesos sin costos';
  assert (select (h->>'desvio_costo')::numeric from jsonb_array_elements(a->'horas') h where (h->>'operacion_id')::uuid = a_pin) = 2000,
    format('costo de la diferencia: %s', a->'horas');

  -- 5. metricas_produccion: el lead time solo de la liberada aquí, la vencida cuenta y una venía de la hoja.
  perform pg_temp.como(v_gp);
  m := metricas_produccion(current_date - 30, current_date);
  assert (m->'resumen'->>'ordenes_terminadas')::int - (m0->'resumen'->>'ordenes_terminadas')::int = 3, 'terminadas';
  assert (m->'resumen'->>'ordenes_con_tiempos')::int - (m0->'resumen'->>'ordenes_con_tiempos')::int = 1, format('con tiempos: %s', m->'resumen');
  -- Por equipo: de los tres terminados, solo el de la etapa marcada completa tiene horas reales (12 h);
  -- la Pailería a medias de G no las baja (antes salían 6.5 h).
  x := (select e from jsonb_array_elements(m->'equipos') e where e->>'clave' = 'T252-EQ');
  assert (x->>'terminados')::int = 3 and (x->>'completos')::int = 1 and (x->>'horas_reales')::numeric = 12, format('por equipo: %s', x);
  assert (m->'resumen'->>'ordenes_de_la_hoja')::int - (m0->'resumen'->>'ordenes_de_la_hoja')::int = 1, format('de la hoja: %s', m->'resumen');
  assert (m->'resumen'->>'ordenes_vencidas_abiertas')::int - (m0->'resumen'->>'ordenes_vencidas_abiertas')::int = 1, format('vencidas: %s', m->'resumen');
  -- Las horas reales / estimadas: de Corte solo la de E (con tiempo), no la que se terminó sin iniciar.
  assert (select (e->>'validas')::int from jsonb_array_elements(m->'etapas') e where (e->>'etapa_id')::int = v_cor)
       - (select (e->>'validas')::int from jsonb_array_elements(m0->'etapas') e where (e->>'etapa_id')::int = v_cor) = 1, 'Corte sin tiempo contó en las horas';

  -- 4. El motivo de la pausa: se guarda, sale en el Pareto con sus horas; uno inventado o fuera de una pausa, no.
  perform avanzar_operacion(a_sig, 'inicio', p_sin_nombre => 1);
  perform avanzar_operacion(a_sig, 'pausa', p_motivo => 'material');
  assert (select motivo from op_eventos where operacion_id = a_sig and tipo = 'pausa') = 'material', 'no guardó el motivo';
  perform pg_temp.como_postgres();
  update op_eventos set en = now() - interval '2 days' where operacion_id = a_sig and tipo = 'pausa';
  perform pg_temp.como(v_gp);
  a := produccion_analitica(current_date - 30, current_date);
  assert (select (p->>'horas')::numeric > 0 and (p->>'pausas')::int >= 1 from jsonb_array_elements(a->'pausas'->'motivos') p where p->>'motivo' = 'material'),
    format('pausas: %s', a->'pausas');
  perform avanzar_operacion(a_sig, 'reanudar', p_sin_nombre => 1);
  begin perform avanzar_operacion(a_sig, 'pausa', p_motivo => 'chisme'); v_ok := true; exception when check_violation then v_ok := false; end;
  assert not v_ok, 'aceptó un motivo que no es de la lista';
  begin perform avanzar_operacion(a_sig, 'fin', p_motivo => 'material'); v_ok := true; exception when raise_exception then v_ok := false; end;
  assert not v_ok, 'aceptó un motivo al terminar';
  -- Poner en espera guarda la causa; reactivar la limpia.
  perform poner_en_espera(od, 'Cliente sin anticipo 252', 'cliente');
  assert (select en_espera_causa from ordenes_produccion where id = od) = 'cliente', 'no guardó la causa de la espera';
  a := produccion_analitica(current_date - 30, current_date);
  assert exists (select 1 from jsonb_array_elements(a->'pausas'->'en_espera') e where e->>'causa' = 'cliente'), 'la espera no salió por causa';
  perform reactivar_orden(od);
  assert (select en_espera_causa from ordenes_produccion where id = od) is null, 'reactivar no limpió la causa';

  -- 6. Dirección simulando ventas tampoco la ve.
  perform pg_temp.como(v_dir);
  perform ver_como('ventas');
  begin perform produccion_analitica(current_date - 30, current_date); v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'dirección simulando ventas vio la analítica';
  perform ver_como(null);
  perform produccion_analitica(current_date - 30, current_date);
  perform pg_temp.como_postgres();
end $$;

-- Las gráficas del teléfono. coaching_graficas: cada quien lo suyo; el promedio del equipo solo con
-- 3 personas o más (con 2 se deduciría el del otro); persona × criterio solo para la gerencia; otro
-- vendedor no pide lo ajeno. telefono_tablero: el embudo llamada → lead → cotización → pedido, el
-- «regresar llamada» sin las históricas, y la banda del coaching solo para quien ve el de todos.
-- Almacén no ve nada.

create or replace function pg_temp.coaching_de(p_perfil uuid, p_sid text, p_cal numeric, p_inicio timestamptz, p_saludo int)
returns uuid language plpgsql as $$
declare l uuid;
begin
  insert into llamadas (call_sid, inicio, atendio_perfil) values (p_sid, p_inicio, p_perfil) returning id into l;
  insert into llamada_coaching (llamada_id, perfil_id, atendio_tipo, calificacion, rubrica_clave, criterios, fallos)
  values (l, p_perfil, 'persona', p_cal, 'ventas',
    jsonb_build_array(jsonb_build_object('clave', 'saludo', 'nombre', 'Saludo', 'peso', 50, 'nota', p_saludo),
                      jsonb_build_object('clave', 'siguiente_paso', 'nombre', 'Siguiente paso', 'peso', 50, 'nota', 4)),
    '[{"clave":"no-cerro-fecha","nombre":"Sin fecha","texto":"x"}]');
  return l;
end $$;

do $$
declare
  v_a uuid; v_b uuid; v_c uuid; v_dir uuid; v_alm uuid; r jsonb; v_ok boolean;
  v_cli uuid; v_op uuid; v_lead uuid; v_cot uuid; l1 uuid; l2 uuid; l3 uuid; l4 uuid;
  t timestamptz := now() - interval '10 days';
  d0 date := (now() at time zone 'America/Mexico_City')::date - 30;
  d1 date := (now() at time zone 'America/Mexico_City')::date;
begin
  v_a := pg_temp.usuario('vena266@hegamex.com', '{ventas}');
  v_b := pg_temp.usuario('venb266@hegamex.com', '{ventas}');
  v_c := pg_temp.usuario('venc266@hegamex.com', '{ventas}');
  v_dir := pg_temp.usuario('dir266@hegamex.com', '{direccion}');
  v_alm := pg_temp.usuario('alm266@hegamex.com', '{almacen}');

  l1 := pg_temp.coaching_de(v_a, 'CA266-A1', 8, t, 10);
  perform pg_temp.coaching_de(v_a, 'CA266-A2', 4, t + interval '7 days', 6);
  perform pg_temp.coaching_de(v_b, 'CA266-B1', 6, t, 2);

  -- 1. Con dos personas: lo suyo, y SIN promedio del equipo.
  perform pg_temp.como(v_a);
  r := coaching_graficas(d0, d1, null, 'ventas');
  assert jsonb_array_length(r->'llamadas_semana') = 2 and (r->>'personas_equipo')::int = 2, format('A ve sus dos semanas: %s', r->'llamadas_semana');
  assert r->'radar_equipo' = 'null'::jsonb, 'con dos personas no hay promedio del equipo: se deduciría el del otro';
  assert r->'equipo_criterios' = 'null'::jsonb, 'persona × criterio no es para un vendedor';
  assert (select sum((x->>'n')::int) from jsonb_array_elements(r->'criterios_semana') x where x->>'clave' = 'saludo') = 2,
    'los criterios de A son solo los suyos';
  assert (select sum((x->>'n')::int) from jsonb_array_elements(r->'fallos_semana') x) = 2, 'y sus fallos por semana';
  v_ok := false;
  begin perform coaching_graficas(d0, d1, v_b, 'ventas'); exception when insufficient_privilege then v_ok := true; end;
  assert v_ok, 'un vendedor no pide las gráficas de otro';

  -- 2. Con tres personas: sí hay promedio del equipo, de todos.
  perform pg_temp.como_postgres();
  perform pg_temp.coaching_de(v_c, 'CA266-C1', 7, t, 6);
  perform pg_temp.como(v_a);
  r := coaching_graficas(d0, d1, null, 'ventas');
  assert (select (x->>'promedio')::numeric from jsonb_array_elements(r->'radar_equipo') x where x->>'clave' = 'saludo') = 6,
    format('con tres, el promedio del equipo de saludo es (10+6+2+6)/4 = 6: %s', r->'radar_equipo');

  -- 3. La gerencia: persona × criterio.
  perform pg_temp.como(v_dir);
  r := coaching_graficas(d0, d1, null, 'ventas');
  assert (select count(distinct x->>'perfil_id') from jsonb_array_elements(r->'equipo_criterios') x) = 3, 'dirección ve a las tres personas por criterio';
  r := coaching_graficas(d0, d1, v_b, 'ventas');
  assert r->'equipo_criterios' = 'null'::jsonb, 'viendo a una persona, no viene el equipo';

  -- 4. El tablero: embudo, regresar y la banda del coaching.
  perform pg_temp.como_postgres();
  insert into clientes (nombre) values ('Cliente 266') returning id into v_cli;
  insert into oportunidades (cliente_id, titulo) values (v_cli, 'Banda 266') returning id into v_op;
  insert into leads (nombre, telefono, interes, oportunidad_id) values ('Lead 266', '5550002661', 'Banda', v_op) returning id into v_lead;
  update leads set oportunidad_id = v_op where id = v_lead;   -- como queda al convertirse
  update llamadas set lead_id = v_lead where id = l1;
  insert into cotizaciones (cliente_id, oportunidad_id, vendedor_id) values (v_cli, v_op, v_a) returning id into v_cot;
  update cotizaciones set creado_en = t + interval '1 day', folio = 'COT-266-1' where id = v_cot;   -- ya no es borrador
  insert into pedidos (cliente_id, cotizacion_id, vendedor_id) values (v_cli, v_cot, v_a);
  insert into llamadas (call_sid, inicio, nadie_contesto, regresada_en) values ('CA266-N1', t, true, t + interval '90 minutes') returning id into l2;
  insert into llamadas (call_sid, inicio, nadie_contesto) values ('CA266-N2', t, true) returning id into l3;
  insert into llamadas (call_sid, inicio, nadie_contesto, historica) values ('CA266-H1', t, true, true) returning id into l4;

  perform pg_temp.como(v_dir);
  r := telefono_tablero(d0, d1);
  assert (r->'embudo'->>'cotizaciones')::int >= 1 and (r->'embudo'->>'pedidos')::int >= 1 and (r->'embudo'->>'leads')::int >= 1,
    format('la llamada con lead llegó a cotización y a pedido: %s', r->'embudo');
  assert (r->'regresar'->>'nadie_contesto')::int = 2 and (r->'regresar'->>'regresadas')::int = 1 and (r->'regresar'->>'en_2h')::int = 1,
    format('regresar: dos que nadie contestó (sin la histórica), una regresada en hora y media: %s', r->'regresar');
  assert (select (b->>'cotizaron')::int from jsonb_array_elements(r->'coaching_resultado') b where b->>'banda' = 'alta') = 1,
    format('la llamada de 8 está en la banda alta y cotizó: %s', r->'coaching_resultado');
  assert r::text not like '%5550002661%' and r::text not like '%Cliente 266%', 'el tablero no lleva teléfonos ni nombres';

  -- 5. Lo que NO: almacén no ve el tablero.
  perform pg_temp.como(v_alm);
  v_ok := false;
  begin perform telefono_tablero(d0, d1); exception when insufficient_privilege then v_ok := true; end;
  assert v_ok, 'almacén no ve el tablero del teléfono';
end $$;

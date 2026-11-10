-- El coaching de ventas y el de atención, separados: el resumen, la lista y los indicadores 75 y 76
-- cuentan cada uno lo suyo, los criterios que se llaman igual no se mezclan, y lo de antes de la
-- clave cuenta como ventas. Los «NO debe»: otro vendedor sigue sin ver el coaching ajeno, también
-- pidiendo una rúbrica; un vendedor no ve el resumen de otro.

do $$
declare
  v_a uuid; v_b uuid; v_ger uuid; emp uuid; m jsonb; r jsonb; v_ok boolean; n int;
  l1 uuid; l2 uuid; l3 uuid;
  t timestamptz := date_trunc('month', now() at time zone 'America/Mexico_City') at time zone 'America/Mexico_City' + interval '2 days 10 hours';
  v_mes date := date_trunc('month', now() at time zone 'America/Mexico_City')::date;
  d0 date := (now() at time zone 'America/Mexico_City')::date - 60;
  d1 date := (now() at time zone 'America/Mexico_City')::date;
begin
  v_a := pg_temp.usuario('vena265@hegamex.com', '{ventas}');
  v_b := pg_temp.usuario('venb265@hegamex.com', '{ventas}');
  v_ger := pg_temp.usuario('dir265@hegamex.com', '{direccion}');
  if t > now() then t := now() - interval '1 hour'; end if;

  -- A: una venta en 5, una de atención en 9 y una vieja sin clave en 6 (cuenta como venta).
  insert into llamadas (call_sid, inicio, atendio_perfil) values ('CA265-1', t, v_a) returning id into l1;
  insert into llamadas (call_sid, inicio, atendio_perfil) values ('CA265-2', t + interval '1 hour', v_a) returning id into l2;
  insert into llamadas (call_sid, inicio, atendio_perfil) values ('CA265-3', t + interval '2 hours', v_a) returning id into l3;
  insert into llamada_coaching (llamada_id, perfil_id, atendio_tipo, calificacion, rubrica_clave, criterios) values
    (l1, v_a, 'persona', 5, 'ventas', '[{"clave":"saludo","nombre":"Saludo e identificación","peso":10,"nota":4}]'),
    (l2, v_a, 'persona', 9, 'atencion', '[{"clave":"saludo","nombre":"Saludo y disposición","peso":15,"nota":10}]'),
    (l3, v_a, 'persona', 6, null, '[]');

  -- 1. El resumen, por rúbrica.
  perform pg_temp.como(v_a);
  r := coaching_resumen(d0, d1, null, 'ventas');
  assert (r->>'n')::int = 2 and (r->>'promedio')::numeric = 5.5, format('ventas: la de 5 y la vieja de 6 (sin clave cuenta como venta): %s', r->'promedio');
  assert (select (c->>'promedio')::numeric from jsonb_array_elements(r->'criterios') c where c->>'clave' = 'saludo') = 4,
    'el saludo de ventas no se mezcla con el de atención';
  r := coaching_resumen(d0, d1, null, 'atencion');
  assert (r->>'n')::int = 1 and (r->>'promedio')::numeric = 9, format('atención: solo la de 9: %s', r);
  r := coaching_resumen(d0, d1, null, null);
  assert (r->>'n')::int = 3, 'sin rúbrica, todo, como antes';
  assert r->'rubricas' @> '[{"clave":"ventas","n":2},{"clave":"atencion","n":1}]'::jsonb, format('cuántas de cada una: %s', r->'rubricas');
  r := coaching_resumen(d0, d1, null, 'atencion');
  assert r->'rubricas' @> '[{"clave":"ventas","n":2}]'::jsonb, 'las pestañas cuentan sin el filtro de rúbrica';

  -- 2. La lista.
  select count(*) into n from coaching_llamadas(d0, d1, null, 'atencion');
  assert n = 1, 'la lista de atención trae una';
  assert (select rubrica from coaching_llamadas(d0, d1, null, null) where llamada_id = l3) = 'ventas', 'y dice su rúbrica (la vieja, ventas)';

  -- 3. Lo que NO debe: B no ve lo de A, ni pidiendo una rúbrica.
  perform pg_temp.como(v_b);
  r := coaching_resumen(d0, d1, null, 'atencion');
  assert (r->>'n')::int = 0 and r->'rubricas' = '[]'::jsonb, 'otro vendedor no ve el coaching ajeno, tampoco por rúbrica';
  select count(*) into n from coaching_llamadas(d0, d1, null, 'ventas');
  assert n = 0, 'ni en la lista';
  v_ok := false;
  begin perform coaching_resumen(d0, d1, v_a, 'ventas'); exception when insufficient_privilege then v_ok := true; end;
  assert v_ok, 'pedir el resumen de otra persona sin ser gerencia sigue siendo error';
  perform pg_temp.como(v_ger);
  r := coaching_resumen(d0, d1, v_a, 'atencion');
  assert (r->>'n')::int = 1, 'dirección sí ve el de A, por rúbrica';
  perform pg_temp.como_postgres();

  -- 4. Objetivos: 75 solo ventas, 76 solo atención.
  insert into empleados (nombre, fecha_ingreso, usuario_id) values ('P265 A', '2024-01-01', v_a) returning id into emp;
  assert (select nombre like '%(ventas)' from objetivo_indicadores where id = 75), 'el 75 dice que es de ventas';
  assert (select clave = 'calificacion_atencion' and fuente = 'automatica' from objetivo_indicadores where id = 76), 'falta el indicador 76';
  m := objetivo_medir('calificacion_coaching', null, emp, v_mes);
  assert (m->>'valor')::numeric = 5.5 and jsonb_array_length(m->'evidencias') = 2 and m->>'nota' like '%de venta%',
    format('el 75 mide solo ventas: %s', m);
  m := objetivo_medir('calificacion_atencion', null, emp, v_mes);
  assert (m->>'valor')::numeric = 9 and jsonb_array_length(m->'evidencias') = 1 and m->>'nota' like '%de atención%',
    format('el 76 mide solo atención: %s', m);
  delete from llamada_coaching where llamada_id = l2;
  m := objetivo_medir('calificacion_atencion', null, emp, v_mes);
  assert (m->>'sin_dato')::boolean and m->>'nota' like 'No hubo llamadas de atención%', format('sin llamadas de atención, sin dato: %s', m);
end $$;

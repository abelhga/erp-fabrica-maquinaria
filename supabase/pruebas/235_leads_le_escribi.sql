-- «Le escribí» cuenta como intento solo por WhatsApp o correo, la lista sabe por dónde fue el último, y
-- otro vendedor no lo anota en un lead ajeno.
do $$
declare v_a uuid; v_b uuid; v_dir uuid; v_l uuid; v_ok boolean; r record;
begin
  v_a := pg_temp.usuario('vena235@hegamex.com', '{ventas}');
  v_b := pg_temp.usuario('venb235@hegamex.com', '{ventas}');
  v_dir := pg_temp.usuario('dir235@hegamex.com', '{direccion}');
  perform pg_temp.como(v_dir);
  perform fijar_config_leads('recepcion', 2, 24, array[v_a, v_b]);
  insert into leads (nombre, telefono, interes, vendedor_id) values ('Diego 235', '5551112235', 'Silo para cemento', v_a) returning id into v_l;

  -- 1. A le escribe por WhatsApp: cuenta como intento, sin que haya contestado.
  perform pg_temp.como(v_a);
  perform registrar_intento_lead(v_l, 'whatsapp', 'enviado');
  select * into r from v_leads where id = v_l;
  assert r.intentos = 1 and not r.contesto and r.ultimo_resultado = 'enviado' and r.ultimo_canal = 'whatsapp',
    format('vista: %s %s %s %s', r.intentos, r.contesto, r.ultimo_resultado, r.ultimo_canal);

  -- 2. «Le escribí» no aplica a una llamada.
  begin perform registrar_intento_lead(v_l, 'llamada', 'enviado'); v_ok := true; exception when check_violation then v_ok := false; end;
  assert not v_ok, 'se anotó «le escribí» en una llamada';

  -- 3. Luego le llama y no contesta: lo último es la llamada.
  perform registrar_intento_lead(v_l, 'llamada', 'no_contesto');
  select * into r from v_leads where id = v_l;
  assert r.intentos = 2 and r.ultimo_canal = 'llamada' and r.ultimo_resultado = 'no_contesto', 'no tomó la llamada como lo último';

  -- 4. Otro vendedor no anota intentos en el lead de A.
  perform pg_temp.como(v_b);
  begin perform registrar_intento_lead(v_l, 'whatsapp', 'enviado'); v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'B anotó «le escribí» en el lead de A';
  perform pg_temp.como_postgres();
end $$;

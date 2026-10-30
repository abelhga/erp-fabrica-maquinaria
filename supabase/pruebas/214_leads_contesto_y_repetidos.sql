-- Un lead se vuelve oportunidad cuando contestó (y no duplica a un cliente que ya existe); la
-- revisión nocturna le avisa a dirección de los leads apartados sin seguimiento.
do $$
declare v_rec uuid; v_a uuid; v_b uuid; v_dir uuid; v_cli uuid; v_l1 uuid; v_l2 uuid; v_op uuid; v_ok boolean; v_msg text; i int;
  h public.revision_hallazgo_nuevo;
begin
  v_rec := pg_temp.usuario('rec214@hegamex.com', '{recepcion}');
  v_a := pg_temp.usuario('vena214@hegamex.com', '{ventas}');
  v_b := pg_temp.usuario('venb214@hegamex.com', '{ventas}');
  v_dir := pg_temp.usuario('dir214@hegamex.com', '{direccion}');
  perform pg_temp.como(v_dir);
  perform fijar_config_leads('recepcion', 2, 24, array[v_a, v_b]);
  perform pg_temp.como_postgres();
  insert into clientes (nombre, vendedor_id) values ('Granos del Bajío 214', v_b) returning id into v_cli;
  insert into contactos (cliente_id, nombre, telefono) values (v_cli, 'Rosa 214', '(55) 5999-8877');

  -- Recepción le pasa dos leads a A: uno con el teléfono de un cliente que ya existe.
  perform pg_temp.como(v_rec);
  insert into leads (nombre, telefono, interes, vendedor_id) values ('Rosa Pérez 214', '5559998877', 'Banda de 12 m', v_a) returning id into v_l1;
  insert into leads (nombre, telefono, interes, vendedor_id) values ('Iván Soto 214', '5551231234', 'Tolva', v_a) returning id into v_l2;

  -- 1. Sin que conteste no es oportunidad; «no contestó» no cuenta; «contestó» pide qué dijo.
  perform pg_temp.como(v_a);
  begin perform convertir_lead(v_l1); v_ok := true; exception when check_violation then v_ok := false; v_msg := sqlerrm; end;
  assert not v_ok and v_msg like 'Todavía no te contesta%', 'se volvió oportunidad sin que contestara';
  perform registrar_intento_lead(v_l1, 'llamada', 'no_contesto');
  begin perform convertir_lead(v_l1); v_ok := true; exception when check_violation then v_ok := false; end;
  assert not v_ok, '«no contestó» bastó para volverlo oportunidad';
  begin perform registrar_intento_lead(v_l1, 'whatsapp', 'contesto', 'ok'); v_ok := true; exception when others then v_ok := false; v_msg := sqlerrm; end;
  assert not v_ok and v_msg like 'Escribe qué te dijo%', '«contestó» sin decir qué';
  --    Otro vendedor no anota intentos en un lead ajeno.
  perform pg_temp.como(v_b);
  begin perform registrar_intento_lead(v_l1, 'llamada', 'contesto', 'Me dijo que sí quiere'); v_ok := true;
  exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'B anotó un intento en el lead de A';
  perform pg_temp.como(v_a);
  perform registrar_intento_lead(v_l1, 'whatsapp', 'contesto', 'Quiere la banda para diciembre; pide precio');

  -- 2. Su teléfono ya es de otro cliente: no se da de alta otra vez; eligiendo ese, sí.
  begin perform convertir_lead(v_l1); v_ok := true; exception when unique_violation then v_ok := false; v_msg := sqlerrm; end;
  assert not v_ok and v_msg like '%teléfono ya es de «Granos del Bajío 214» (de venb214%', format('se duplicó el cliente: %s', v_msg);
  v_op := convertir_lead(v_l1, v_cli);
  assert (select estado = 'convertido' and cliente_id = v_cli and etapa_oportunidad = 'contactado' from leads where id = v_l1), 'no quedó en la cuenta existente';
  assert (select etapa = 'contactado' and notas like '%Lo que dijo: Quiere la banda%' from oportunidades where id = v_op), 'la oportunidad no trae lo que dijo';
  assert (select count(*) from clientes where nombre like 'Rosa Pérez 214%') = 0, 'se creó un cliente repetido';

  --    Uno nuevo de verdad sí se da de alta.
  perform registrar_intento_lead(v_l2, 'llamada', 'contesto', 'Tolva de 3 toneladas, cotizar');
  perform convertir_lead(v_l2);
  assert (select c.nombre = 'Iván Soto 214' and c.vendedor_id = v_a from leads l join clientes c on c.id = l.cliente_id where l.id = v_l2), 'no se dio de alta el cliente nuevo';

  -- 3. Quien registró el lead ve los intentos y si contestó.
  perform pg_temp.como(v_rec);
  assert (select intentos = 2 and contesto and ultimo_resultado = 'contesto' from v_leads where id = v_l1), 'recepción no ve los intentos';

  -- 4. Revisión nocturna: B tiene 6 leads asignados hace 2 semanas sin ningún intento → a dirección, como patrón.
  for i in 1..6 loop
    insert into leads (nombre, telefono, interes, vendedor_id) values ('Lead quieto 214 ' || i, '55500000' || lpad(i::text, 2, '0'), 'Banda', v_b);
  end loop;
  perform pg_temp.como_postgres();
  update leads set asignado_en = now() - interval '14 days' where nombre like 'Lead quieto 214%';
  --    Lo asignado antes de que existieran los intentos cuenta desde ese día: con la fecha de hoy, nada.
  update configuracion set valor = valor || jsonb_build_object('intentos_desde', now()) where clave = 'leads';
  assert not exists (select 1 from revision_r_leads_sin_seguimiento() x where x.registro_id = v_b::text), 'contó días de antes de que hubiera intentos';
  update configuracion set valor = valor || jsonb_build_object('intentos_desde', now() - interval '30 days') where clave = 'leads';
  select * into h from revision_r_leads_sin_seguimiento() x where x.registro_id = v_b::text;
  assert h.titulo like '%6 leads sin seguimiento' and h.detalle like '6 leads asignados%' and jsonb_array_length(h.evidencia) = 6, 'la regla no vio a B: ' || coalesce(h.titulo, 'nada');
  assert not exists (select 1 from revision_r_leads_sin_seguimiento() x where x.registro_id = v_a::text), 'A sí dio seguimiento y salió';
  assert (select para = 'direccion' from revision_reglas where clave = 'leads_sin_seguimiento'), 'la regla debe ir a dirección';
  --    Guardar la configuración desde la pantalla no se lleva la fecha de arranque.
  perform pg_temp.como(v_dir);
  perform fijar_config_leads('recepcion', 3, 24, array[v_a, v_b]);
  perform pg_temp.como_postgres();
  assert (select valor ? 'intentos_desde' from configuracion where clave = 'leads'), 'la pantalla borró intentos_desde';
  --    Con un intento anotado deja de contar.
  insert into lead_intentos (lead_id, usuario_id, canal, resultado) select id, v_b, 'llamada', 'no_contesto' from leads where nombre = 'Lead quieto 214 1';
  select * into h from revision_r_leads_sin_seguimiento() x where x.registro_id = v_b::text;
  assert h.titulo like '%5 leads sin seguimiento', 'el intento no contó: ' || coalesce(h.titulo, 'nada');
end $$;

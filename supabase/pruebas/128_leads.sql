-- Recepción y leads: recepción captura y ve en qué quedó lo suyo sin ver clientes ni
-- ventas; en bandeja el primero que lo toma se lo queda; si ya es cliente le llega a su
-- vendedor; la gerencia asigna; el vendedor lo vuelve oportunidad o lo descarta.
do $$
declare v_rec uuid; v_a uuid; v_b uuid; v_ger uuid; v_fin uuid; v_cli uuid; v_l1 uuid; v_l2 uuid; v_l3 uuid; v_op uuid;
  v_n int; v_ok boolean; v_t text; l record;
begin
  v_rec := pg_temp.usuario('rec128@hegamex.com', '{recepcion}');
  v_a := pg_temp.usuario('vena128@hegamex.com', '{ventas}');
  v_b := pg_temp.usuario('venb128@hegamex.com', '{ventas}');
  v_ger := pg_temp.usuario('ger128@hegamex.com', '{gerente_ventas}');
  v_fin := pg_temp.usuario('fin128@hegamex.com', '{finanzas}');

  -- Solo A y B reciben leads (la base local tiene más vendedores).
  perform pg_temp.como(v_ger);
  perform fijar_config_leads('bandeja', 2, 24, array[v_a, v_b]);

  -- Un cliente de B, con su teléfono.
  perform pg_temp.como(v_b);
  insert into clientes (nombre, ciudad, vendedor_id) values ('Agregados T128', 'Saltillo', v_b) returning id into v_cli;
  insert into contactos (cliente_id, nombre, telefono) values (v_cli, 'Ing. Peña', '844 123 4567');

  -- Recepción: no lee clientes, pero sabe si quien llama ya es cliente y de quién.
  perform pg_temp.como(v_rec);
  assert not exists (select 1 from clientes where id = v_cli), 'recepción no debe leer clientes';
  select count(*) into v_n from buscar_cliente_lead('(844) 123-4567') where cliente_id = v_cli and vigente;
  assert v_n = 1, 'no encontró al cliente por teléfono';
  assert (select vendedor from buscar_cliente_lead('agregados t128') where cliente_id = v_cli) like 'venb128%', 'no dijo de quién es';

  -- Lead nuevo, sin cliente: en bandeja nace sin vendedor y se avisa a A y B.
  insert into leads (nombre, telefono, interes, vendedor_id) values ('Luis Ortega', '5551112233', 'Banda de 10 m para arena', v_a) returning id into v_l1;
  select * into l from v_leads where id = v_l1;
  assert l.estado = 'nuevo' and l.vendedor_id is null and l.capturo like 'rec128%', format('en bandeja no debe traer vendedor: %s', row_to_json(l));
  assert l.fuente = 'Llamada a recepción', 'la fuente por omisión es la llamada a recepción';
  perform pg_temp.como_postgres();
  assert (select count(*) from avisos where registro_id = v_l1::text and tipo = 'lead' and usuario_id in (v_a, v_b)) = 2, 'no se avisó a los vendedores';

  -- Lead de un cliente vigente: le llega directo a B, sin pasar por la bandeja.
  perform pg_temp.como(v_rec);
  insert into leads (nombre, interes, cliente_id) values ('Ing. Peña', 'Refacciones para su cribadora', v_cli) returning id into v_l2;
  select * into l from leads where id = v_l2;
  assert l.estado = 'asignado' and l.vendedor_id = v_b and l.como_se_asigno = 'cliente' and l.cliente_nombre = 'Agregados T128',
    format('el lead de un cliente debió ir a su vendedor: %s', row_to_json(l));

  -- Recepción no toma leads; finanzas ni los ve.
  begin perform tomar_lead(v_l1); v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'recepción no debe poder tomar un lead';
  perform pg_temp.como(v_fin);
  assert not exists (select 1 from leads), 'finanzas no debe ver leads';
  begin insert into leads (nombre, telefono, interes) values ('X', '1', 'algo'); v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'finanzas no debe capturar leads';

  -- Bandeja: A y B lo ven; A lo toma; B ya no lo ve y no se lo puede quedar.
  perform pg_temp.como(v_b);
  assert exists (select 1 from leads where id = v_l1), 'B no ve el lead por tomar';
  assert exists (select 1 from leads where id = v_l2), 'B no ve el lead de su cliente';
  perform pg_temp.como(v_a);
  assert not exists (select 1 from leads where id = v_l2), 'A no debe ver el lead del cliente de B';
  perform tomar_lead(v_l1);
  perform pg_temp.como(v_b);
  assert not exists (select 1 from leads where id = v_l1), 'B sigue viendo un lead que ya tomó A';
  begin perform tomar_lead(v_l1); v_t := 'tomado'; exception when others then v_t := sqlerrm; end;
  assert v_t like 'Ya lo tomó%', format('el segundo no debe quedárselo: %s', v_t);
  -- B no puede convertir ni descartar el de A.
  begin perform convertir_lead(v_l1); v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'B no debe atender el lead de A';

  -- A lo atiende: nace el cliente, su contacto y la oportunidad.
  perform pg_temp.como(v_a);
  -- Sin que conteste no es oportunidad (214); al contestar, nace en «Contactado».
  begin perform convertir_lead(v_l1); v_ok := true; exception when check_violation then v_ok := false; end;
  assert not v_ok, 'se volvió oportunidad sin que contestara';
  perform registrar_intento_lead(v_l1, 'llamada', 'contesto', 'Quiere una banda de 10 m para marzo');
  v_op := convertir_lead(v_l1);
  select * into l from leads where id = v_l1;
  assert l.estado = 'convertido' and l.oportunidad_id = v_op and l.etapa_oportunidad = 'contactado', 'el lead no quedó convertido';
  assert (select vendedor_id from clientes where id = l.cliente_id) = v_a and (select nombre from clientes where id = l.cliente_id) = 'Luis Ortega', 'no se dio de alta el cliente';
  assert (select count(*) from contactos where cliente_id = l.cliente_id and telefono = '5551112233') = 1, 'no se guardó el contacto';
  -- La oportunidad avanza y recepción lo ve en su lista, sin leer el embudo.
  update oportunidades set etapa = 'cotizado' where id = v_op;
  perform pg_temp.como(v_rec);
  assert (select etapa_oportunidad from v_leads where id = v_l1) = 'cotizado', 'recepción no ve en qué quedó';
  assert (select vendedor from v_leads where id = v_l1) like 'vena128%', 'recepción no ve quién lo tomó';
  assert not exists (select 1 from oportunidades where id = v_op), 'recepción no debe leer oportunidades';

  -- Modo gerente: los vendedores ya no ven la bandeja; la gerencia asigna.
  perform pg_temp.como(v_ger);
  perform fijar_config_leads('gerente', 2, 24, array[v_a, v_b]);
  perform pg_temp.como(v_rec);
  insert into leads (nombre, correo, interes) values ('Marta Ruiz', 'MARTA@ejemplo.com ', 'Dosificadora') returning id into v_l3;
  perform pg_temp.como(v_a);
  assert not exists (select 1 from leads where id = v_l3), 'en modo gerente un vendedor no ve los leads sin asignar';
  begin perform asignar_lead(v_l3, v_a); v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'un vendedor no se asigna leads';
  perform pg_temp.como(v_ger);
  assert exists (select 1 from leads where id = v_l3), 'la gerencia no ve el lead por asignar';
  perform asignar_lead(v_l3, v_b);
  assert (select vendedor_id from leads where id = v_l3) = v_b and (select correo from leads where id = v_l3) = 'marta@ejemplo.com', 'no se asignó';

  -- B lo descarta con motivo; sin motivo no se puede.
  perform pg_temp.como(v_b);
  begin perform descartar_lead(v_l3, ''); v_ok := true; exception when check_violation then v_ok := false; end;
  assert not v_ok, 'descartar sin motivo';
  perform descartar_lead(v_l3, 'Buscaba algo que no fabricamos');
  assert (select estado from leads where id = v_l3) = 'descartado', 'no se descartó';

  -- Modo recepción: quien captura escoge, y solo entre los que reciben leads.
  perform pg_temp.como(v_ger);
  perform fijar_config_leads('recepcion', 2, 24, array[v_a, v_b]);
  perform pg_temp.como(v_rec);
  begin insert into leads (nombre, telefono, interes) values ('Sin vendedor', '5550000000', 'Silo'); v_ok := true; exception when check_violation then v_ok := false; end;
  assert not v_ok, 'en modo recepción hay que escoger vendedor';
  begin insert into leads (nombre, telefono, interes, vendedor_id) values ('Otro', '5550000001', 'Silo', v_fin); v_ok := true; exception when check_violation then v_ok := false; end;
  assert not v_ok, 'no se le puede pasar a quien no recibe leads';
  insert into leads (nombre, telefono, interes, vendedor_id) values ('Pedro Gil', '5550000002', 'Tolva', v_a) returning id into v_l3;
  assert (select estado || '/' || como_se_asigno from leads where id = v_l3) = 'asignado/recepcion', 'no se asignó al que escogió recepción';
  assert (select count(*) from vendedores_para_leads()) = 2, 'la lista de vendedores para recepción';

  -- Solo la gerencia o dirección configuran.
  perform pg_temp.como(v_a);
  begin perform fijar_config_leads('bandeja', 2, 24, null); v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'un vendedor no configura los leads';

  -- Recordatorio: sin atender a tiempo, se avisa a la gerencia y al vendedor una sola vez.
  perform pg_temp.como_postgres();
  perform avisos_leads(now() + interval '25 hours');
  assert (select count(*) from avisos where registro_id = v_l3::text and tipo = 'lead_sin_atender' and usuario_id in (v_ger, v_a)) = 2, 'no avisó del lead sin atender';
  select count(*) into v_n from avisos where registro_id = v_l3::text and tipo = 'lead_sin_atender';
  perform avisos_leads(now() + interval '26 hours');
  assert (select count(*) from avisos where registro_id = v_l3::text and tipo = 'lead_sin_atender') = v_n, 'repitió el aviso';

  -- Inicio de recepción: lo que capturó hoy.
  perform pg_temp.como(v_rec);
  assert (indicadores(array['leads'])->'leads'->>'capturados_hoy')::int >= 3, 'Inicio no cuenta los leads de hoy';
end $$;

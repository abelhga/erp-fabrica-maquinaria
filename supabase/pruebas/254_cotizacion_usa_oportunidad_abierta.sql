-- La cotización usa la oportunidad que ya tenía el cliente (la del lead primero) en vez de abrir
-- otra; «es otro proyecto» sí abre una; nadie cuelga su cotización de la oportunidad de otro
-- vendedor ni de otro cliente.

-- Esta prueba no es de partidas libres (256): sus «Cribadora…» sin artículo pedirían autorización.
update configuracion set valor = valor || '{"desde": "2999-01-01"}' where clave = 'partidas_libres';

do $$
declare v_rec uuid; v_a uuid; v_b uuid; v_ger uuid; v_cli uuid; v_cli2 uuid; v_libre uuid; v_lead uuid; v_op_lead uuid; v_op_man uuid;
  v_op2 uuid; v_op_a uuid; c1 uuid; c2 uuid; c3 uuid; c4 uuid; c5 uuid; v_ok boolean; v_err text;
  v_rep uuid; v_op_rep uuid; v_op_c1 uuid; c6 uuid; c7 uuid; c8 uuid;
begin
  v_rec := pg_temp.usuario('rec254@hegamex.com', '{recepcion}');
  v_a := pg_temp.usuario('vena254@hegamex.com', '{ventas}');
  v_b := pg_temp.usuario('venb254@hegamex.com', '{ventas}');
  v_ger := pg_temp.usuario('ger254@hegamex.com', '{gerente_ventas}');
  perform pg_temp.como(v_ger);
  perform fijar_config_leads('recepcion', 2, 24, array[v_a, v_b]);
  perform pg_temp.como_postgres();
  insert into clientes (nombre, vendedor_id) values ('Cribados del Norte 254', v_a) returning id into v_cli2;
  insert into clientes (nombre) values ('Agregados Libres 254') returning id into v_libre;

  -- 1. Lead convertido + «Nueva cotización» desde la ficha (solo ?cliente=): sale ligada a la del lead.
  perform pg_temp.como(v_rec);
  insert into leads (nombre, telefono, interes, vendedor_id) values ('Marta Ríos 254', '5554443322', 'Cribadora V3', v_a) returning id into v_lead;
  perform pg_temp.como(v_a);
  perform registrar_intento_lead(v_lead, 'llamada', 'contesto', 'Quiere la cribadora para enero');
  v_op_lead := convertir_lead(v_lead);
  select cliente_id into v_cli from leads where id = v_lead;
  --    Una oportunidad que el vendedor abrió a mano después: más nueva, pero la del lead gana.
  insert into oportunidades (cliente_id, titulo, etapa, vendedor_id) values (v_cli, 'Refacciones 254', 'prospecto', v_a) returning id into v_op_man;
  assert oportunidad_para_cotizar(v_cli, v_a) = v_op_lead, 'no prefirió la oportunidad del lead';
  c1 := nueva_cotizacion(v_cli);
  assert (select oportunidad_id = v_op_lead and not oportunidad_nueva from cotizaciones where id = c1), 'el borrador no salió ligado a la del lead';
  insert into cotizacion_lineas (cotizacion_id, titulo, precio_unitario) values (c1, 'Cribadora V3', 250000);
  update cotizaciones set tiempo_entrega = '4 semanas', estado = 'enviada' where id = c1;
  assert (select oportunidad_id = v_op_lead from cotizaciones where id = c1), 'al enviar se cambió de oportunidad';
  assert (select etapa = 'cotizado' and monto_estimado = 250000 from oportunidades where id = v_op_lead), 'la del lead no pasó a Cotizado';
  assert (select etapa_oportunidad = 'cotizado' from leads where id = v_lead), 'recepción sigue viendo «Contactado»';
  assert (select count(*) from oportunidades where cliente_id = v_cli) = 2, 'se abrió otra oportunidad';
  assert exists (select 1 from seguimientos_cotizacion where oportunidad_id = v_op_lead and estado = 'pendiente'), 'el seguimiento no quedó en la del lead';

  -- 2. Sin la del lead, la más reciente en prospecto/contactado; las ya cotizadas no se toman solas.
  assert oportunidad_para_cotizar(v_cli, v_a) = v_op_man, 'no tomó la abierta más reciente';
  update oportunidades set etapa = 'perdida', motivo_perdida = 'Ya lo compró en otro lado' where id = v_op_man;
  assert oportunidad_para_cotizar(v_cli, v_a) is null, 'tomó una cotizada o perdida';
  c2 := nueva_cotizacion(v_cli);
  insert into cotizacion_lineas (cotizacion_id, titulo, precio_unitario) values (c2, 'Tolva 254', 90000);
  update cotizaciones set tiempo_entrega = '2 semanas', estado = 'enviada' where id = c2;
  assert (select o.etapa = 'cotizado' and o.id not in (v_op_lead, v_op_man) from cotizaciones c join oportunidades o on o.id = c.oportunidad_id where c.id = c2),
    'sin abierta por cotizar no abrió una nueva';

  -- 3. «Es otro proyecto»: aunque haya una en Contactado, abre otra y no toca la que estaba.
  insert into oportunidades (cliente_id, titulo, etapa, vendedor_id) values (v_cli, 'Banda 254', 'contactado', v_a) returning id into v_op2;
  c3 := nueva_cotizacion(v_cli, null, true);
  assert (select oportunidad_id is null and oportunidad_nueva from cotizaciones where id = c3), 'otro proyecto se ligó solo';
  insert into cotizacion_lineas (cotizacion_id, titulo, precio_unitario) values (c3, 'Elevador 254', 120000);
  update cotizaciones set tiempo_entrega = '6 semanas', estado = 'enviada' where id = c3;
  assert (select oportunidad_id not in (v_op_lead, v_op_man, v_op2) and not oportunidad_nueva from cotizaciones where id = c3), 'otro proyecto no abrió la suya';
  assert (select etapa = 'contactado' from oportunidades where id = v_op2), 'otro proyecto movió la oportunidad que estaba';

  -- 4. Borrador sin oportunidad y la oportunidad aparece después: se liga al enviarlo.
  perform pg_temp.como_postgres();
  insert into cotizaciones (cliente_id, vendedor_id, tiempo_entrega) values (v_cli2, v_a, '3 semanas') returning id into c4;
  assert (select oportunidad_id is null from cotizaciones where id = c4), 'apareció una oportunidad de la nada';
  insert into oportunidades (cliente_id, titulo, etapa, vendedor_id) values (v_cli2, 'Silo 254', 'contactado', v_a) returning id into v_op_a;
  perform pg_temp.como(v_a);
  insert into cotizacion_lineas (cotizacion_id, titulo, precio_unitario) values (c4, 'Silo 254', 300000);
  update cotizaciones set estado = 'enviada' where id = c4;
  assert (select oportunidad_id = v_op_a from cotizaciones where id = c4), 'al enviar no buscó la oportunidad abierta';

  -- 5. Cambiar el cliente del borrador suelta la oportunidad del anterior y toma la del nuevo.
  c5 := nueva_cotizacion(v_cli);
  assert (select oportunidad_id = v_op2 from cotizaciones where id = c5), 'no tomó la abierta del cliente';
  update oportunidades set etapa = 'contactado' where id = v_op_a;   -- (ya cotizada por c4; se reabre para la prueba)
  update cotizaciones set cliente_id = v_cli2 where id = c5;
  assert (select oportunidad_id = v_op_a from cotizaciones where id = c5), 'cambiar de cliente dejó la oportunidad del anterior';
  --    Elegir «Una nueva al enviar» no se vuelve a ligar sola al guardar.
  update cotizaciones set oportunidad_id = null, oportunidad_nueva = true where id = c5;
  update cotizaciones set notas = '{"Precio LAB planta"}' where id = c5;
  assert (select oportunidad_id is null and oportunidad_nueva from cotizaciones where id = c5), 'se ligó sola después de elegir «nueva»';

  -- 6. NO: colgar la cotización de la oportunidad de otro cliente.
  begin update cotizaciones set oportunidad_id = v_op_lead where id = c5; v_ok := true;
  exception when check_violation then v_ok := false; get stacked diagnostics v_err = message_text; end;
  assert not v_ok and v_err like 'Esa oportunidad es de otro cliente%', 'se ligó a la oportunidad de otro cliente';

  -- 7. NO: B no cuelga su cotización de la oportunidad de A, ni la arranca desde ella.
  perform pg_temp.como(v_b);
  begin perform nueva_cotizacion(null, v_op2); v_ok := true;
  exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'B arrancó una cotización desde la oportunidad de A';
  c5 := nueva_cotizacion(v_libre);
  begin update cotizaciones set cliente_id = v_cli, oportunidad_id = v_op2 where id = c5; v_ok := true;
  exception when insufficient_privilege then v_ok := false; get stacked diagnostics v_err = message_text; end;
  assert not v_ok and v_err like 'Esa oportunidad es de otro vendedor%', 'B colgó su cotización de la oportunidad de A';
  --    Ni se la toma sola: la de A es de A aunque B cotice a ese cliente.
  perform pg_temp.como_postgres();
  insert into oportunidades (cliente_id, titulo, etapa, vendedor_id) values (v_libre, 'Dosificadora 254', 'contactado', v_a) returning id into v_op_a;
  perform pg_temp.como(v_b);
  insert into cotizacion_lineas (cotizacion_id, titulo, precio_unitario) values (c5, 'Dosificadora 254', 500000);
  update cotizaciones set tiempo_entrega = '8 semanas', estado = 'enviada' where id = c5;
  assert (select o.vendedor_id = v_b and o.id <> v_op_a from cotizaciones c join oportunidades o on o.id = c.oportunidad_id where c.id = c5),
    'B se llevó la oportunidad de A';
  perform pg_temp.como_postgres();  -- B no ve la oportunidad de A: se revisa sin RLS
  assert (select etapa = 'contactado' from oportunidades where id = v_op_a), 'la cotización de B movió la oportunidad de A';

  -- 8. La gerencia sí puede ligar una cotización suya a la oportunidad de un vendedor.
  perform pg_temp.como(v_ger);
  c5 := nueva_cotizacion(null, v_op_a);
  assert (select oportunidad_id = v_op_a and cliente_id = v_libre from cotizaciones where id = c5), 'la gerencia no pudo cotizar en la oportunidad de A';

  -- 9. NO: quien no vende no cotiza.
  perform pg_temp.como(v_rec);
  begin perform nueva_cotizacion(v_cli); v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'recepción abrió una cotización';
  -- 10. NO: B tampoco arranca una cotización en la oportunidad de A pasándole el cliente (por la
  --     alta, no por un cambio), ni ve cuál tomaría la base para A.
  perform pg_temp.como(v_b);
  begin perform nueva_cotizacion(v_libre, v_op_a); v_ok := true;
  exception when insufficient_privilege then v_ok := false; get stacked diagnostics v_err = message_text; end;
  assert not v_ok and v_err like 'Esa oportunidad es de otro vendedor%', 'B arrancó con cliente y oportunidad de A';
  assert oportunidad_para_cotizar(v_libre, v_a) is null, 'B ve la oportunidad que la base le tomaría a A';

  -- 11. Juntar clientes: la ya enviada y el borrador conservan su oportunidad (antes se soltaban:
  --     la oportunidad se quedaba en «Cotizado» sin su cotización).
  perform pg_temp.como(v_a);
  insert into clientes (nombre, vendedor_id) values ('Cribados del Norte (repetido) 254', v_a) returning id into v_rep;
  insert into oportunidades (cliente_id, titulo, etapa, vendedor_id) values (v_rep, 'Criba 254', 'contactado', v_a) returning id into v_op_rep;
  c6 := nueva_cotizacion(v_rep);
  assert (select oportunidad_id = v_op_rep from cotizaciones where id = c6), 'el borrador del repetido no tomó su oportunidad';
  c7 := nueva_cotizacion(v_rep, null, true);
  insert into cotizacion_lineas (cotizacion_id, titulo, precio_unitario) values (c7, 'Criba grande 254', 400000);
  update cotizaciones set tiempo_entrega = '5 semanas', estado = 'enviada' where id = c7;
  select oportunidad_id into v_op_c1 from cotizaciones where id = c7;
  perform pg_temp.como(v_ger);
  perform juntar_clientes(v_rep, v_cli2);
  assert (select oportunidad_id = v_op_rep and cliente_id = v_cli2 from cotizaciones where id = c6), 'juntar clientes soltó la oportunidad del borrador';
  assert (select oportunidad_id = v_op_c1 and cliente_id = v_cli2 from cotizaciones where id = c7), 'juntar clientes soltó la oportunidad de la enviada';
  --    Y a una ya enviada, cambiarle el cliente a mano tampoco le quita la suya.
  update cotizaciones set cliente_id = v_cli where id = c7;
  assert (select oportunidad_id = v_op_c1 from cotizaciones where id = c7), 'cambiar el cliente de una enviada le quitó la oportunidad';

  -- 12. Una versión nueva hereda la oportunidad aunque la cotización se haya reasignado a otro vendedor.
  update clientes set vendedor_id = v_b where id = v_cli2;
  update cotizaciones set vendedor_id = v_b where id = c6;
  perform pg_temp.como(v_b);
  c8 := nueva_version_cotizacion(c6);
  assert (select oportunidad_id = v_op_rep and vendedor_id = v_b from cotizaciones where id = c8), 'la versión nueva no heredó su oportunidad';
  --     Pero ligar otra suya de A sigue sin poderse.
  begin update cotizaciones set oportunidad_id = v_op_a where id = c8; v_ok := true;
  exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'B ligó su versión a otra oportunidad de A';
end $$;

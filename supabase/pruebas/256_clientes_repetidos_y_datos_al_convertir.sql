-- Clientes repetidos (buscar antes de dar de alta y avisar al dueño vigente), datos del cliente al
-- convertir a pedido (RFC y razón social o público en general, estado y fuente) y partidas libres
-- de $20,000 o más que piden autorización. Usuarios: ventas A y B, gerente, dirección y almacén.
do $$
declare v_a uuid; v_b uuid; v_ger uuid; v_dir uuid; v_alm uuid;
  v_cb uuid; v_ca uuid; v_nuevo uuid; v_cot uuid; v_cot2 uuid; v_l uuid; v_opc uuid; v_ped uuid; v_ped2 uuid;
  v_ok boolean; v_msg text; v_par jsonb; v_cl record; v_ext uuid;
begin
  v_a := pg_temp.usuario('vena256@hegamex.com', '{ventas}');
  v_b := pg_temp.usuario('venb256@hegamex.com', '{ventas}');
  v_ger := pg_temp.usuario('ger256@hegamex.com', '{gerente_ventas}');
  v_dir := pg_temp.usuario('dir256@hegamex.com', '{direccion}');
  v_alm := pg_temp.usuario('alm256@hegamex.com', '{almacen}');

  -- 0. Diez dígitos, con lada, con +52 1 y con basura; menos de 10 no es teléfono.
  assert telefono10('(998) 195-9232') = '9981959232' and telefono10('+52 1 998 195 9232') = '9981959232', 'telefono10 no normaliza';
  assert telefono10('195 9232') is null and telefono10(null) is null, 'telefono10 inventó un teléfono';

  -- B ya tiene a Tekax (vigente: lo dio de alta hoy).
  perform pg_temp.como(v_b);
  v_cb := alta_cliente('{"nombre": "Triturados y Pretensados Tekax 256"}', '{"nombre": "Doroteo", "telefono": "998 195 9232"}');

  -- 1. A busca antes de darlo de alta: por teléfono (otra forma de escribirlo) y por nombre sin acentos ni mayúsculas.
  perform pg_temp.como(v_a);
  v_par := clientes_parecidos('Doroteo Tekax', '+52 1 998 195 92 32');
  assert jsonb_array_length(v_par) = 1 and v_par->0->>'id' = v_cb::text and v_par->0->>'por' = 'teléfono'
     and (v_par->0->>'de_otro_vigente')::boolean and not (v_par->0->>'editable')::boolean, 'no lo encontró por teléfono: ' || v_par::text;
  assert not (v_par->0 ? 'telefono'), 'clientes_parecidos regresó el teléfono de un cliente ajeno';
  v_par := clientes_parecidos('TRITURADOS Y PRETÉNSADOS  TEKAX 256');
  assert v_par->0->>'por' = 'nombre', 'no lo encontró por nombre sin acentos: ' || v_par::text;
  --    Un nombre de una palabra («Particular») no cuenta como el mismo cliente.
  perform alta_cliente('{"nombre": "Particular"}', null);
  perform pg_temp.como(v_b);
  assert jsonb_array_length(clientes_parecidos('Particular')) = 0, '«Particular» salió como repetido';

  -- 2. Darlo de alta otra vez se detiene y dice de quién es; «es otro» lo deja pasar y avisa a B y a la gerencia.
  perform pg_temp.como(v_a);
  begin perform alta_cliente('{"nombre": "Tekax obra Mérida"}', '{"telefono": "9981959232"}'); v_ok := true;
  exception when unique_violation then v_ok := false; v_msg := sqlerrm; end;
  assert not v_ok and v_msg like 'Ya existe «Triturados y Pretensados Tekax 256» (de venb256%mismo teléfono%', 'se duplicó sin preguntar: ' || coalesce(v_msg, 'pasó');
  v_nuevo := alta_cliente('{"nombre": "Tekax obra Mérida"}', '{"telefono": "9981959232"}', true);
  perform pg_temp.como_postgres();
  assert (select notas like 'Dado de alta aunque se parece a «Triturados%' and vendedor_id = v_a from clientes where id = v_nuevo), 'no dejó constancia';
  assert (select count(*) from avisos where tipo = 'cliente_repetido' and usuario_id = v_b and registro_id = v_nuevo || ':' || v_cb
          and cuerpo like '%dio de alta a «Tekax obra Mérida» con el mismo teléfono%') = 1, 'B no recibió un solo aviso (de alta)';
  assert (select count(*) from avisos where tipo = 'cliente_repetido' and usuario_id in (v_ger, v_dir) and registro_id = v_nuevo || ':' || v_cb) = 2, 'la gerencia y dirección no se enteraron';
  assert not exists (select 1 from avisos where tipo = 'cliente_repetido' and usuario_id = v_a), 'se avisó a quien lo dio de alta';

  -- 3. Saltarse alta_cliente con un insert directo no se salta el aviso; almacén no busca, no da de alta ni inserta.
  perform pg_temp.como(v_a);
  insert into clientes (id, nombre, vendedor_id) values (gen_random_uuid(), 'Tekax directo 256', v_a) returning id into v_l;
  insert into contactos (cliente_id, nombre, telefono) values (v_l, 'Doroteo', '9981959232');
  perform pg_temp.como_postgres();
  assert (select count(*) from avisos where tipo = 'cliente_repetido' and usuario_id = v_b and registro_id = v_l || ':' || v_cb) = 1, 'el insert directo se saltó el aviso';
  perform pg_temp.como(v_alm);
  begin perform clientes_parecidos('Tekax', '9981959232'); v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'almacén preguntó de quién es un teléfono';
  begin perform alta_cliente('{"nombre": "Almacén 256"}'); v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'almacén dio de alta un cliente';
  begin insert into clientes (nombre) values ('Almacén directo 256'); v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'almacén insertó un cliente';

  -- 4. Un contacto nuevo con el teléfono de un cliente ajeno también avisa; uno propio, no.
  perform pg_temp.como(v_a);
  v_ca := alta_cliente('{"nombre": "Granos del Sureste 256"}', '{"telefono": "5550001111"}');
  insert into contactos (cliente_id, nombre, whatsapp) values (v_ca, 'Doroteo (obra)', '998-195-9232');
  insert into contactos (cliente_id, nombre, telefono) values (v_nuevo, 'Otro de A', '5550001111');
  perform pg_temp.como_postgres();
  assert (select count(*) from avisos where tipo = 'cliente_repetido' and usuario_id = v_b and registro_id = v_ca || ':' || v_cb and cuerpo like '%agregó%contacto%') = 1, 'el contacto repetido no avisó';
  assert not exists (select 1 from avisos where tipo = 'cliente_repetido' and registro_id = v_nuevo || ':' || v_ca), 'avisó por un repetido entre clientes del mismo vendedor';
  --    La gerencia sí puede dar de alta un repetido sin que salgan avisos (es la que junta y reasigna).
  perform pg_temp.como(v_ger);
  perform alta_cliente('{"nombre": "Tekax gerencia"}', '{"telefono": "9981959232"}', true);
  perform pg_temp.como_postgres();
  assert (select count(*) from avisos where tipo = 'cliente_repetido' and usuario_id = v_b) = 3, 'la gerencia generó avisos';

  -- 5. Cotizarle a un cliente vigente de otro vendedor no se bloquea, pero avisa una sola vez por pareja.
  perform pg_temp.como(v_a);
  v_cot2 := nueva_cotizacion(v_cb);
  perform nueva_cotizacion(v_cb);
  perform pg_temp.como_postgres();
  assert (select count(*) from avisos where tipo = 'cliente_ajeno' and usuario_id = v_b and registro_id = v_cb || ':' || v_a) = 1, 'B no recibió un aviso (o recibió dos)';

  -- 6. Partida libre de $20,000 o más (sin IVA) que no es flete, instalación o puesta en marcha: por autorizar.
  perform pg_temp.como(v_a);
  v_cot := nueva_cotizacion(v_ca);
  update cotizaciones set tiempo_entrega = '4 semanas' where id = v_cot;
  insert into cotizacion_lineas (cotizacion_id, orden, titulo, unidad, cantidad, precio_unitario) values
    (v_cot, 1, 'Flete a Mérida', 'servicio', 1, 45000),
    (v_cot, 2, 'Servicio de instalación', 'servicio', 1, 60000),
    (v_cot, 3, 'Puesta en marcha y capacitación', 'servicio', 1, 30000),
    (v_cot, 4, 'Tornillería', 'pieza', 1, 19999);
  assert (select estado = 'borrador' and not requiere_autorizacion from cotizaciones where id = v_cot), 'flete, instalación o $19,999 pidieron autorización';
  insert into cotizacion_lineas (cotizacion_id, orden, titulo, unidad, cantidad, precio_unitario) values (v_cot, 5, 'Montacargas CPD-20', 'servicio', 2, 12000)
    returning id into v_l;
  assert (select libre_cara and not bajo_minimo from cotizacion_lineas where id = v_l), 'la partida libre cara no quedó marcada';
  assert (select estado = 'por_autorizar' and requiere_autorizacion from cotizaciones where id = v_cot), 'no pasó a por autorizar';
  --    «Servicio de automatización… equipo de control» no se salva por empezar con «servicio».
  assert not partida_libre_exenta('SERVICIO DE AUTOMATIZACIÓN HEGAMEX® DE PLANTA DOSIFICADORA') and partida_libre_exenta('Servicio de flete a destino'), 'exención mal';
  --    Este rol NO debe poder: enviarla, autorizarla él mismo ni convertirla.
  begin update cotizaciones set estado = 'enviada' where id = v_cot; v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'se envió con una partida libre cara sin autorizar';
  begin perform autorizar_cotizacion(v_cot); v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'el vendedor se autorizó solo';
  begin perform convertir_a_pedido(v_cot); v_ok := true; exception when insufficient_privilege then v_ok := false; v_msg := sqlerrm; end;
  assert not v_ok and v_msg like '%partidas libres sin autorizar%', 'se convirtió sin autorización';
  --    Con IVA incluido se mide sin IVA: 2 × $11,500 con IVA son $19,828; 2 × $12,000, $20,690.
  perform ajustar_moneda_cotizacion(v_cot, 'MXN', 1, true);
  update cotizacion_lineas set precio_unitario = 11500 where id = v_l;
  assert (select not libre_cara from cotizacion_lineas where id = v_l), 'midió con IVA';
  update cotizacion_lineas set precio_unitario = 12000 where id = v_l;
  assert (select libre_cara from cotizacion_lineas where id = v_l), 'con $20,690 sin IVA debió pedir autorización';
  --    Una opcional cara no frena el envío, pero no entra al pedido sin autorización.
  insert into cotizacion_lineas (cotizacion_id, orden, titulo, unidad, cantidad, precio_unitario, opcional) values (v_cot, 6, 'Generador TDK', 'pieza', 1, 176000, true)
    returning id into v_opc;
  assert (select not libre_cara from cotizacion_lineas where id = v_opc), 'una opcional pidió autorización';
  delete from cotizacion_lineas where id = v_l;
  assert (select estado = 'borrador' from cotizaciones where id = v_cot), 'al quitarla no regresó a borrador';
  begin perform convertir_a_pedido(v_cot, null, array(select id from cotizacion_lineas where cotizacion_id = v_cot));
    v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'la opcional cara entró al pedido sin autorización';
  delete from cotizacion_lineas where id = v_opc;
  --    Las cotizaciones de antes de la regla no se atoran.
  perform pg_temp.como_postgres();
  update configuracion set valor = valor || jsonb_build_object('desde', now() + interval '1 day') where clave = 'partidas_libres';
  perform pg_temp.como(v_a);
  insert into cotizacion_lineas (cotizacion_id, orden, titulo, unidad, cantidad, precio_unitario) values (v_cot, 7, 'Remolque', 'pieza', 1, 171000) returning id into v_l;
  assert (select not libre_cara from cotizacion_lineas where id = v_l), 'marcó una cotización de antes de la regla';
  perform pg_temp.como_postgres();
  update configuracion set valor = valor || jsonb_build_object('desde', now() - interval '1 day') where clave = 'partidas_libres';
  perform recalcular_cotizacion(v_cot);
  --    La gerencia la autoriza y ya se puede convertir.
  perform pg_temp.como(v_a);
  perform pedir_autorizacion(v_cot, 'Remolque de un tercero, precio del proveedor + 25 %');
  perform pg_temp.como(v_ger);
  perform autorizar_cotizacion(v_cot);

  -- 7. Al convertir: RFC y razón social (o «Público en general»), estado y fuente. B no puede convertir lo de A.
  perform pg_temp.como(v_b);
  begin perform convertir_a_pedido(v_cot, null, null, '{"rfc": "XXX010101AAA"}'); v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'B convirtió la cotización de A';
  perform pg_temp.como(v_a);
  begin perform convertir_a_pedido(v_cot); v_ok := true; exception when check_violation then v_ok := false; v_msg := sqlerrm; end;
  assert not v_ok and v_msg = 'Para hacer el pedido falta: RFC y razón social (o marca «Público en general»), el estado, ¿cómo llegó?', 'mensaje: ' || coalesce(v_msg, 'pasó');
  --    Un estado que no existe no cuenta; solo RFC sin razón social tampoco.
  begin perform convertir_a_pedido(v_cot, null, null, '{"rfc": "GSU160202AB1", "estado": "Narnia", "fuente_id": 2}'); v_ok := true;
  exception when check_violation then v_ok := false; v_msg := sqlerrm; end;
  assert not v_ok and v_msg = 'Para hacer el pedido falta: RFC y razón social (o marca «Público en general»), el estado', 'mensaje 2: ' || coalesce(v_msg, 'pasó');
  v_ped := convertir_a_pedido(v_cot, null, null, '{"publico_general": true, "estado": "Jalisco", "fuente_id": 2}');
  select * into v_cl from clientes where id = v_ca;
  assert v_ped is not null and v_cl.publico_general and v_cl.cve_ent = '14' and v_cl.fuente_id = 2 and v_cl.rfc is null, 'no guardó los datos del cliente';
  --    Solo llena lo que falta: el RFC que ya tenía no se pisa.
  perform pg_temp.como_postgres();
  update clientes set rfc = 'GSU160202AB1', razon_social = 'Granos del Sureste SA de CV' where id = v_ca;
  assert (select not publico_general from clientes where id = v_ca), 'con RFC de verdad siguió como público en general';
  perform pg_temp.como(v_a);
  v_cot := nueva_cotizacion(v_ca);
  update cotizaciones set tiempo_entrega = '1 semana' where id = v_cot;
  insert into cotizacion_lineas (cotizacion_id, orden, titulo, unidad, cantidad, precio_unitario) values (v_cot, 1, 'Flete a Mérida', 'servicio', 1, 5000);
  perform convertir_a_pedido(v_cot, null, null, '{"rfc": "OTR010101AAA", "razon_social": "Otra", "estado": "Sonora"}');
  assert (select rfc = 'GSU160202AB1' and razon_social = 'Granos del Sureste SA de CV' and cve_ent = '14' from clientes where id = v_ca), 'pisó datos que ya tenía';
  --    «Fuera de México»: con el país ya no pide estado.
  v_ext := alta_cliente('{"nombre": "Molinos de Guatemala 256"}', '{"telefono": "50222223333"}');
  v_cot := nueva_cotizacion(v_ext);
  update cotizaciones set tiempo_entrega = '1 semana' where id = v_cot;
  insert into cotizacion_lineas (cotizacion_id, orden, titulo, unidad, cantidad, precio_unitario) values (v_cot, 1, 'Flete a Guatemala', 'servicio', 1, 9000);
  perform convertir_a_pedido(v_cot, null, null, '{"publico_general": true, "pais": "Guatemala", "fuente_id": 2}');
  assert (select ubicacion = 'extranjero' and cve_ent is null and pais = 'Guatemala' from clientes where id = v_ext), 'fuera de México no quedó como extranjero';

  -- 8. Pedido sin cotización: un vendedor no mete una partida libre cara; la gerencia sí; un flete sí.
  insert into pedidos (cliente_id, vendedor_id, canal) values (v_ca, v_a, 'directo') returning id into v_ped2;
  begin insert into pedido_lineas (pedido_id, orden, titulo, unidad, cantidad, precio_unitario) values (v_ped2, 1, 'Generador TDK', 'pieza', 1, 176000);
    v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'el vendedor metió una partida libre cara a un pedido sin cotización';
  insert into pedido_lineas (pedido_id, orden, titulo, unidad, cantidad, precio_unitario) values (v_ped2, 1, 'Flete a Mérida', 'servicio', 1, 25000);
  perform pg_temp.como(v_ger);
  insert into pedido_lineas (pedido_id, orden, titulo, unidad, cantidad, precio_unitario) values (v_ped2, 2, 'Generador TDK', 'pieza', 1, 176000);
end $$;

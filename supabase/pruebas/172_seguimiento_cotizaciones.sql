-- Seguimiento de cotizaciones: enviar agenda uno a 3 días hábiles; solo se cierra diciendo qué
-- pasó y el resultado mueve la oportunidad; Negociación sin qué pasó no entra; con más de 10
-- vencidos no se envía otra cotización hasta que la gerencia libere; pedido o rechazo lo cierran.
do $$
declare v_ven uuid; v_otro uuid; v_ger uuid; v_cli uuid; c1 uuid; c2 uuid; c3 uuid; v_op uuid; v_op3 uuid; v_s uuid;
  v_ok boolean; v_err text; v_n int; i int;
begin
  v_ven := pg_temp.usuario('ven172@hegamex.com', '{ventas}');
  v_otro := pg_temp.usuario('otro172@hegamex.com', '{ventas}');
  v_ger := pg_temp.usuario('ger172@hegamex.com', '{gerente_ventas}');
  insert into clientes (nombre, vendedor_id) values ('Concretos 172', v_ven) returning id into v_cli;

  -- Los días hábiles brincan fin de semana y festivos (16 nov 2026 es el de la Revolución).
  assert sumar_dias_laborables('2026-10-23', 3) = '2026-10-28', 'viernes + 3 hábiles no dio miércoles';
  assert sumar_dias_laborables('2026-11-13', 1) = '2026-11-17', 'no brincó el festivo';

  -- Enviar agenda el seguimiento, a nombre del vendedor y a 3 días hábiles.
  perform pg_temp.como(v_ven);
  c1 := nueva_cotizacion(v_cli);
  insert into cotizacion_lineas (cotizacion_id, titulo, precio_unitario) values (c1, 'Cribadora V3', 100000);
  update cotizaciones set estado = 'enviada' where id = c1;
  select oportunidad_id into v_op from cotizaciones where id = c1;
  select id into v_s from seguimientos_cotizacion where oportunidad_id = v_op and estado = 'pendiente';
  assert v_s is not null, 'enviar no agendó el seguimiento';
  assert (select vence = sumar_dias_laborables(hoy_mx(), 3) and vendedor_id = v_ven and cotizacion_id = c1
          from seguimientos_cotizacion where id = v_s), 'el seguimiento no quedó a 3 días hábiles del vendedor';
  assert exists (select 1 from v_seguimientos where id = v_s and cliente = 'Concretos 172'), 'el vendedor no ve su cola';

  -- Nadie lo cierra ni lo mueve directo.
  begin update seguimientos_cotizacion set estado = 'hecho' where id = v_s; get diagnostics v_n = row_count; v_ok := v_n > 0;
  exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'se cerró el seguimiento sin decir qué pasó';
  begin insert into seguimientos_cotizacion (oportunidad_id, vence) values (v_op, current_date + 90); v_ok := true;
  exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'se creó un seguimiento por fuera';

  -- Otro vendedor no lo ve ni lo anota; la gerencia sí lo ve.
  perform pg_temp.como(v_otro);
  assert not exists (select 1 from v_seguimientos where id = v_s), 'otro vendedor vio el seguimiento';
  begin perform registrar_seguimiento(v_op, 'sigue', 'Le marqué'); v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'otro vendedor anotó el seguimiento';
  perform pg_temp.como(v_ger);
  assert exists (select 1 from v_seguimientos where id = v_s), 'la gerencia no ve el seguimiento';
  assert (select pendientes from v_seguimientos_por_vendedor where vendedor_id = v_ven) = 1, 'el resumen por vendedor no lo cuenta';

  -- Arrastrar a Negociación sin qué pasó: la base no lo deja.
  perform pg_temp.como(v_ven);
  begin update oportunidades set etapa = 'negociacion' where id = v_op; v_ok := true;
  exception when check_violation then v_ok := false; get stacked diagnostics v_err = message_text; end;
  assert not v_ok and v_err like '%anota qué pasó%', 'pasó a Negociación sin qué pasó: ' || coalesce(v_err, '');

  -- Sin qué pasó no se cierra; con «sigue» se anota y se agenda el siguiente.
  begin perform registrar_seguimiento(v_op, 'sigue', '  '); v_ok := true; exception when check_violation then v_ok := false; end;
  assert not v_ok, 'cerró el seguimiento sin qué pasó';
  perform registrar_seguimiento(v_op, 'sigue', 'Lo está viendo con su socio', 'whatsapp');
  assert (select estado = 'hecho' and resultado = 'sigue' and actividad_id is not null from seguimientos_cotizacion where id = v_s), 'no se cerró como hecho';
  assert exists (select 1 from actividades where oportunidad_id = v_op and tipo = 'whatsapp' and descripcion = 'Lo está viendo con su socio'),
    'la nota no quedó en la bitácora comercial';
  assert (select count(*) from seguimientos_cotizacion where oportunidad_id = v_op and estado = 'pendiente') = 1, 'no agendó el siguiente';

  -- «Negociando» la mueve de etapa y agenda en la fecha que dio el cliente.
  perform registrar_seguimiento(v_op, 'negociacion', 'Pide 5% por pago de contado', 'llamada', hoy_mx() + 10);
  assert (select etapa from oportunidades where id = v_op) = 'negociacion', 'no pasó a Negociación';
  assert (select vence from seguimientos_cotizacion where oportunidad_id = v_op and estado = 'pendiente') = hoy_mx() + 10, 'no respetó la fecha';
  assert exists (select 1 from actividades where oportunidad_id = v_op and descripcion = 'Negociando: Pide 5% por pago de contado'), 'la nota no dice el resultado';

  -- Otra versión enviada en la misma oportunidad recorre el seguimiento, no lo duplica.
  c2 := nueva_cotizacion(v_cli, v_op);
  insert into cotizacion_lineas (cotizacion_id, titulo, precio_unitario) values (c2, 'Cribadora V3 con descuento', 95000);
  update cotizaciones set estado = 'enviada' where id = c2;
  assert (select count(*) from seguimientos_cotizacion where oportunidad_id = v_op and estado = 'pendiente') = 1, 'se duplicó el seguimiento';
  assert (select cotizacion_id from seguimientos_cotizacion where oportunidad_id = v_op and estado = 'pendiente') = c2, 'no tomó la versión nueva';

  -- Volverse pedido lo cierra solo.
  perform pg_temp.como_postgres();
  update cotizaciones set estado = 'aceptada' where id = c2;
  assert exists (select 1 from seguimientos_cotizacion where oportunidad_id = v_op and estado = 'pendiente'), 'cerró aunque quedaba otra cotización enviada';
  update cotizaciones set estado = 'aceptada' where id = c1;
  assert (select resultado from seguimientos_cotizacion where oportunidad_id = v_op and estado = 'cerrado') = 'pedido', 'el pedido no cerró el seguimiento';

  -- Se perdió: sin motivo no; con motivo cierra la oportunidad y rechaza la cotización.
  perform pg_temp.como(v_ven);
  c3 := nueva_cotizacion(v_cli);
  insert into cotizacion_lineas (cotizacion_id, titulo, precio_unitario) values (c3, 'Colector de polvos', 29000);
  update cotizaciones set estado = 'enviada' where id = c3;
  select oportunidad_id into v_op3 from cotizaciones where id = c3;
  begin perform registrar_seguimiento(v_op3, 'perdida', 'Compró en otro lado'); v_ok := true; exception when check_violation then v_ok := false; end;
  assert not v_ok, 'se perdió sin motivo';
  perform registrar_seguimiento(v_op3, 'perdida', 'Compró en otro lado', 'llamada', null, 'Precio');
  assert (select etapa = 'perdida' and motivo_perdida = 'Precio' from oportunidades where id = v_op3), 'no quedó perdida con su motivo';
  assert (select estado from cotizaciones where id = c3) = 'rechazada', 'la cotización siguió viva';
  assert not exists (select 1 from seguimientos_cotizacion where oportunidad_id = v_op3 and estado = 'pendiente'), 'quedó un seguimiento de algo perdido';

  -- Freno: con más de 10 vencidos no se envía otra cotización.
  perform pg_temp.como_postgres();
  for i in 1..11 loop
    insert into oportunidades (cliente_id, titulo, etapa, vendedor_id) values (v_cli, 'Vieja ' || i, 'cotizado', v_ven) returning id into v_op;
    insert into seguimientos_cotizacion (oportunidad_id, vendedor_id, vence) values (v_op, v_ven, hoy_mx() - 5);
  end loop;
  perform pg_temp.como(v_ven);
  assert (freno_seguimiento()->>'frenado')::boolean, 'el freno no se puso';
  c3 := nueva_cotizacion(v_cli);
  insert into cotizacion_lineas (cotizacion_id, titulo, precio_unitario) values (c3, 'Banda grip', 6000);
  begin update cotizaciones set estado = 'enviada' where id = c3; v_ok := true;
  exception when raise_exception then v_ok := false; get stacked diagnostics v_err = message_text; end;
  assert not v_ok and v_err like '%11 seguimientos vencidos%', 'envió con el freno puesto: ' || coalesce(v_err, '');
  -- El vendedor no se libera solo; la gerencia sí, con motivo, y le avisa.
  begin perform liberar_freno_seguimiento(v_ven, 'Yo me libero'); v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'el vendedor se quitó el freno';
  perform pg_temp.como(v_ger);
  assert (select frenado from v_seguimientos_por_vendedor where vendedor_id = v_ven), 'la gerencia no ve que está frenado';
  perform liberar_freno_seguimiento(v_ven, 'Cliente esperando la cotización');
  perform pg_temp.como(v_ven);
  update cotizaciones set estado = 'enviada' where id = c3;
  assert (select estado from cotizaciones where id = c3) = 'enviada', 'liberado y aun así no envió';
  perform pg_temp.como_postgres();
  assert exists (select 1 from avisos where usuario_id = v_ven and tipo = 'freno_liberado'), 'no le avisó que quedó liberado';
  assert exists (select 1 from freno_liberado where vendedor_id = v_ven and por = v_ger and motivo = 'Cliente esperando la cotización'), 'no quedó quién liberó';
end $$;

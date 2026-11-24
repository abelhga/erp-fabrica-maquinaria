-- El historial del pedido dice quién hizo qué, y un cobro mal capturado se corrige con motivo (el
-- caso del PED-26-855: $148,132 capturados, $92,000 depositados). Finanzas ya no borra ni edita un
-- cobro directo; ventas no corrige cobros; y un vendedor no ve el historial de un pedido ajeno.
do $$
declare v_fin uuid; v_vend uuid; v_otro uuid; v_cli uuid; v_ped uuid; v_cobro uuid; v_ok boolean; v_msj text; h jsonb; n int;
begin
  v_fin := pg_temp.usuario('fin313@hegamex.com', '{finanzas}');
  v_vend := pg_temp.usuario('vend313@hegamex.com', '{ventas}');
  v_otro := pg_temp.usuario('otro313@hegamex.com', '{ventas}');
  update perfiles set nombre = 'Adriana 313' where id = v_fin;
  insert into clientes (nombre) values ('Jesús 313') returning id into v_cli;

  perform pg_temp.como(v_vend);
  insert into pedidos (cliente_id, vendedor_id, fecha_compromiso) values (v_cli, v_vend, current_date + 14) returning id into v_ped;
  insert into pedido_lineas (pedido_id, titulo, cantidad, precio_unitario) values (v_ped, 'Banda 313', 1, 12770);
  -- El pedido «nació» ayer: lo que sigue ya es un cambio, no parte del alta.
  perform pg_temp.como_postgres();
  update pedidos set creado_en = now() - interval '1 day' where id = v_ped;

  perform pg_temp.como(v_vend);
  update pedidos set fecha_compromiso = current_date + 28 where id = v_ped;

  -- Finanzas captura el depósito con el monto equivocado.
  perform pg_temp.como(v_fin);
  insert into cobros (pedido_id, fecha, monto, metodo, referencia, notas)
  values (v_ped, current_date, 14813.20, 'efectivo', 'DEP EN EFECTIVO', 'Santander') returning id into v_cobro;

  -- Ya no se edita ni se borra directo: la RLS no lo deja (no truena, no toca nada).
  update cobros set monto = 1 where id = v_cobro;
  delete from cobros where id = v_cobro;
  assert (select monto from cobros where id = v_cobro) = 14813.20, 'finanzas editó o borró un cobro sin pasar por la corrección';

  -- Sin motivo, no.
  begin perform corregir_cobro(v_cobro, 9200, current_date, 'efectivo', 'DEP EN EFECTIVO', ''); v_ok := true;
  exception when invalid_parameter_value then v_ok := false; get stacked diagnostics v_msj = message_text; end;
  assert not v_ok and v_msj like '%por qué%', format('corrigió sin motivo: %s', v_msj);
  -- Sin cambiar nada, tampoco.
  begin perform corregir_cobro(v_cobro, 14813.20, current_date, 'efectivo', 'DEP EN EFECTIVO', 'nada que cambiar'); v_ok := true;
  exception when invalid_parameter_value then v_ok := false; end;
  assert not v_ok, 'aceptó una corrección que no cambia nada';

  perform corregir_cobro(v_cobro, 9200, current_date, 'efectivo', 'DEP EN EFECTIVO', 'Me equivoqué de monto, fueron 92 mil');
  assert (select monto from cobros where id = v_cobro) = 9200, 'no se corrigió el monto';

  -- Ventas no corrige ni quita cobros.
  perform pg_temp.como(v_vend);
  begin perform corregir_cobro(v_cobro, 1, current_date, 'efectivo', null, 'quiero cambiarlo'); v_ok := true;
  exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'ventas corrigió un cobro';
  begin perform quitar_cobro(v_cobro, 'quiero quitarlo'); v_ok := true;
  exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'ventas quitó un cobro';

  -- El vendedor ve el historial de su pedido: el cobro como se capturó, la corrección con quién y por qué.
  h := pedido_historial(v_ped);
  assert exists (select 1 from jsonb_array_elements(h) e where e->>'tipo' = 'creado'), format('falta el alta: %s', h);
  assert exists (select 1 from jsonb_array_elements(h) e where e->>'tipo' = 'cambio' and e->>'texto' like 'Cambió la fecha compromiso%'), format('falta el cambio de fecha: %s', h);
  assert exists (select 1 from jsonb_array_elements(h) e where e->>'tipo' = 'cobro' and e->>'texto' like '%$14,813.20%'
                   and e->>'quien' = 'Adriana 313'), format('el cobro no sale como se capturó ni con quién: %s', h);
  assert exists (select 1 from jsonb_array_elements(h) e where e->>'tipo' = 'cobro_corregido' and e->>'texto' like '%$14,813.20 → $9,200.00%'
                   and e->>'quien' = 'Adriana 313' and e->>'nota' like 'Me equivoqué%'), format('la corrección no sale completa: %s', h);

  -- Otro vendedor no lo ve.
  perform pg_temp.como(v_otro);
  begin h := pedido_historial(v_ped); v_ok := true;
  exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'un vendedor vio el historial de un pedido ajeno';

  -- Quitar, con motivo, deja su renglón y el alta original sigue en el historial.
  perform pg_temp.como(v_fin);
  perform quitar_cobro(v_cobro, 'Era de otro pedido');
  assert not exists (select 1 from cobros where id = v_cobro), 'no se quitó el cobro';
  h := pedido_historial(v_ped);
  select count(*) into n from jsonb_array_elements(h) e where e->>'tipo' = 'cobro_quitado';
  assert n = 1, format('el cobro quitado sale %s veces: %s', n, h);
  assert exists (select 1 from jsonb_array_elements(h) e where e->>'tipo' = 'cobro_quitado' and e->>'nota' = 'Era de otro pedido'), 'falta el motivo de quitar';
  assert exists (select 1 from jsonb_array_elements(h) e where e->>'tipo' = 'cobro' and e->>'texto' like '%$14,813.20%'), 'se perdió cómo se registró el cobro quitado';

  -- Un cobro de complemento de pago no se corrige a mano (el CFDI manda), pero sí se quita.
  insert into cobros (pedido_id, fecha, monto, metodo, cfdi_uuid, cfdi_factura)
  values (v_ped, current_date, 1000, 'transferencia', 'AAAAAAAA-0000-0000-0000-000000000313', 'X') returning id into v_cobro;
  begin perform corregir_cobro(v_cobro, 900, current_date, 'transferencia', null, 'monto distinto'); v_ok := true;
  exception when invalid_parameter_value then v_ok := false; end;
  assert not v_ok, 'se corrigió a mano un cobro de complemento';
  perform quitar_cobro(v_cobro, 'Complemento equivocado');

  -- Una partida agregada después del alta sale en el historial.
  perform pg_temp.como(v_vend);
  insert into pedido_lineas (pedido_id, titulo, cantidad, precio_unitario) values (v_ped, 'Flete 313', 1, 2500);
  h := pedido_historial(v_ped);
  assert exists (select 1 from jsonb_array_elements(h) e where e->>'tipo' = 'partida' and e->>'texto' like 'Agregó la partida «Flete 313»%'), format('falta la partida: %s', h);
  -- Ventas no ve costos: nada de la historia los trae.
  assert h::text not ilike '%costo%', 'el historial trae costos';
end $$;

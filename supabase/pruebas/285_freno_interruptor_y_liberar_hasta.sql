-- Freno de seguimiento: la gerencia libera a varios hasta una fecha (y se quita sola al pasarla);
-- con el interruptor apagado nadie se frena; un vendedor no puede hacer ninguna de las dos.
do $$
declare v_a uuid; v_b uuid; v_ger uuid; v_cli uuid; v_op uuid; i int; v_ok boolean; v_n int;
begin
  v_a := pg_temp.usuario('a285@hegamex.com', '{ventas}');
  v_b := pg_temp.usuario('b285@hegamex.com', '{ventas}');
  v_ger := pg_temp.usuario('ger285@hegamex.com', '{gerente_ventas}');
  insert into clientes (nombre, vendedor_id) values ('Cliente 285', v_a) returning id into v_cli;
  for i in 1..11 loop
    insert into oportunidades (cliente_id, titulo, etapa, vendedor_id) values (v_cli, 'A ' || i, 'cotizado', v_a) returning id into v_op;
    insert into seguimientos_cotizacion (oportunidad_id, vendedor_id, vence) values (v_op, v_a, hoy_mx() - 5);
    insert into oportunidades (cliente_id, titulo, etapa, vendedor_id) values (v_cli, 'B ' || i, 'cotizado', v_b) returning id into v_op;
    insert into seguimientos_cotizacion (oportunidad_id, vendedor_id, vence) values (v_op, v_b, hoy_mx() - 5);
  end loop;
  assert (freno_seguimiento(v_a)->>'frenado')::boolean and (freno_seguimiento(v_b)->>'frenado')::boolean, 'no se frenaron';

  -- Un vendedor no se libera ni a sí mismo.
  perform pg_temp.como(v_a);
  begin perform liberar_freno_hasta(array[v_a], hoy_mx() + 1, 'Expo'); v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'un vendedor se liberó';

  -- La gerencia libera a los dos hasta mañana: hoy y mañana no están frenados; pasado mañana sí.
  perform pg_temp.como(v_ger);
  begin perform liberar_freno_hasta(array[v_a, v_b], hoy_mx() + 40, 'Expo'); v_ok := true; exception when raise_exception then v_ok := false; end;
  assert not v_ok, 'liberó por más de un mes';
  begin perform liberar_freno_hasta(array[v_a, v_b], hoy_mx() - 1, 'Expo'); v_ok := true; exception when raise_exception then v_ok := false; end;
  assert not v_ok, 'liberó hacia atrás';
  v_n := liberar_freno_hasta(array[v_a, v_b], hoy_mx() + 1, 'Expo Agroalimentaria');
  assert v_n = 2, 'no liberó a los dos';
  assert (select count(*) from freno_liberado where vendedor_id in (v_a, v_b)) = 4, 'no quedaron hoy y mañana para los dos';
  assert not (freno_seguimiento(v_a)->>'frenado')::boolean, 'siguió frenado hoy';
  assert (freno_seguimiento(v_a)->>'liberado_hasta')::date = hoy_mx() + 1, 'no dice hasta cuándo';
  assert (select liberado_hasta from v_seguimientos_por_vendedor where vendedor_id = v_b) = hoy_mx() + 1, 'la vista no dice hasta cuándo';
  assert not exists (select 1 from freno_liberado where vendedor_id = v_a and dia = hoy_mx() + 2), 'liberó un día de más';
  perform pg_temp.como_postgres();
  assert (select count(*) from avisos where tipo = 'freno_liberado' and usuario_id in (v_a, v_b) and titulo like 'Puedes enviar cotizaciones hasta el %') = 2, 'no les avisó';

  -- Interruptor: apagado, nadie se frena; prendido otra vez, vuelve.
  delete from freno_liberado where vendedor_id in (v_a, v_b);
  update configuracion set valor = valor || '{"freno_activo": false}' where clave = 'seguimiento_cotizaciones';
  assert not (freno_seguimiento(v_a)->>'frenado')::boolean, 'apagado y siguió frenado';
  assert not (select frenado from v_seguimientos_por_vendedor where vendedor_id = v_a), 'la vista lo siguió viendo frenado';
  update configuracion set valor = valor || '{"freno_activo": true}' where clave = 'seguimiento_cotizaciones';
  assert (freno_seguimiento(v_a)->>'frenado')::boolean, 'prendido y no se frenó';
end $$;

-- El folio de la cotización sale al capturar, no al abrir: abrir y salir no gasta folio,
-- la primera partida (o salir de borrador) le da el definitivo, una sola vez, y los
-- borradores vacíos de ayer se limpian.
do $$
declare v_ven uuid; v_cli uuid; v_c1 uuid; v_c2 uuid; v_c3 uuid; v_antes int; v_folio text; v_n int;
begin
  v_ven := pg_temp.usuario('ven99@hegamex.com', '{ventas}');
  insert into clientes (nombre, vendedor_id) values ('T99 Concretos', v_ven) returning id into v_cli;
  select coalesce((select ultimo from folios where serie = 'COT' and anio = extract(year from now() at time zone 'America/Mexico_City')), 0) into v_antes;

  perform pg_temp.como(v_ven);
  -- Abrir "Nueva cotización" no gasta folio.
  v_c1 := nueva_cotizacion(v_cli);
  v_c2 := nueva_cotizacion(v_cli);
  assert (select folio_es_provisional(folio) from cotizaciones where id = v_c1), 'nació con folio definitivo';
  perform pg_temp.como_postgres();   -- el contador de folios no lo lee ventas
  assert coalesce((select ultimo from folios where serie = 'COT' and anio = extract(year from now() at time zone 'America/Mexico_City')), 0) = v_antes,
    'abrir el editor gastó folio';
  perform pg_temp.como(v_ven);

  -- La primera partida le da el folio definitivo; la segunda ya no lo cambia.
  insert into cotizacion_lineas (cotizacion_id, titulo, precio_unitario) values (v_c1, 'Banda 20"', 100000);
  select folio into v_folio from cotizaciones where id = v_c1;
  assert v_folio ~ '^COT-\d{4}-\d{5}$', format('folio tras la primera partida: %s', v_folio);
  insert into cotizacion_lineas (cotizacion_id, titulo, precio_unitario) values (v_c1, 'Flete', 5000);
  assert (select folio from cotizaciones where id = v_c1) = v_folio, 'la segunda partida cambió el folio';
  perform pg_temp.como_postgres();
  assert (select ultimo from folios where serie = 'COT' and anio = extract(year from now() at time zone 'America/Mexico_City')) = v_antes + 1,
    'se gastó más de un folio';
  perform pg_temp.como(v_ven);

  -- Salir de borrador también le da folio (aunque fuera sin partidas por algún camino).
  update cotizaciones set estado = 'enviada' where id = v_c2;
  assert (select folio ~ '^COT-' from cotizaciones where id = v_c2), 'enviada con folio provisional';

  -- Los borradores vacíos de ayer se limpian; los de hoy y los que tienen partidas, no.
  v_c3 := nueva_cotizacion(v_cli);
  perform pg_temp.como_postgres();
  update cotizaciones set creado_en = now() - interval '2 days' where id in (v_c3, v_c1);
  v_n := limpiar_borradores_vacios();
  assert not exists (select 1 from cotizaciones where id = v_c3), 'no limpió el borrador vacío de hace 2 días';
  assert exists (select 1 from cotizaciones where id = v_c1), 'limpió un borrador con partidas';

  -- Nadie más que la base asigna folios a mano.
  perform pg_temp.como(v_ven);
  begin
    perform asignar_folio_cotizacion(v_c1);
    assert false, 'ventas llamó asignar_folio_cotizacion';
  exception when insufficient_privilege then null;
  end;
end $$;

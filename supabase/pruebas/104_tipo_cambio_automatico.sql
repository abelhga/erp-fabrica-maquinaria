-- Tipo de cambio automático: el del DOF y el del BCE entran solos, lo capturado a
-- mano se respeta, y el costeo solo lo sigue si se mueve 3% o más (o si es a mano).
do $$
declare v_comp uuid; v_fin uuid; v_vend uuid; v_cfg jsonb; v_estado text; v_n int; v_hoy date := hoy_planta();
begin
  v_comp := pg_temp.usuario('comp104@hegamex.com', '{compras}');
  v_fin := pg_temp.usuario('fin104@hegamex.com', '{finanzas}');
  v_vend := pg_temp.usuario('vend104@hegamex.com', '{ventas}');
  delete from tipos_cambio;
  update configuracion set valor = '{"USD": 18.50, "EUR": 20.00}' where clave = 'tipo_cambio_costeo';

  -- El DOF trae el dólar (158) de varios días y otros indicadores que no son tipo de cambio.
  v_n := aplicar_tipo_cambio('DOF', jsonb_build_object('ListaIndicadores', jsonb_build_array(
    jsonb_build_object('codTipoIndicador', 158, 'fecha', to_char(v_hoy - 1, 'DD-MM-YYYY'), 'valor', '18.3528'),
    jsonb_build_object('codTipoIndicador', 158, 'fecha', to_char(v_hoy, 'DD-MM-YYYY'), 'valor', '18.4888'),
    jsonb_build_object('codTipoIndicador', 165, 'fecha', to_char(v_hoy, 'DD-MM-YYYY'), 'valor', '6.7659%'))));
  assert v_n = 2, format('entraron %s del DOF', v_n);
  assert tc('USD') = 18.4888 and (select fuente from tipos_cambio where fecha = v_hoy and moneda = 'USD') = 'DOF', 'no quedó el dólar del DOF';
  -- Se movió menos de 3%: el costeo sigue en 18.50 (los precios no cambian).
  assert tc_costeo('USD') = 18.50, format('el costeo siguió un cambio chico: %s', tc_costeo('USD'));

  v_n := aplicar_tipo_cambio('BCE', jsonb_build_object('base', 'EUR', 'date', v_hoy::text, 'rates', jsonb_build_object('MXN', 20.7596)));
  assert v_n = 1 and tc('EUR') = 20.7596, 'no quedó el euro del BCE';
  -- El euro se movió 3.8%: el costeo lo sigue.
  assert tc_costeo('EUR') = 20.7596, format('el costeo no siguió un cambio grande: %s', tc_costeo('EUR'));
  -- Repetir la misma respuesta no hace nada.
  assert aplicar_tipo_cambio('BCE', jsonb_build_object('base', 'EUR', 'date', v_hoy::text, 'rates', jsonb_build_object('MXN', 20.7596))) = 0, 'reescribió el mismo valor';
  -- Una respuesta rara no rompe ni inventa.
  assert aplicar_tipo_cambio('BCE', '{"message": "not found"}') = 0, 'una respuesta sin tasas metió algo';

  -- Finanzas captura a mano el de hoy: se respeta aunque llegue el del DOF, y el costeo lo sigue aunque sea chico.
  perform pg_temp.como(v_fin);
  insert into tipos_cambio (fecha, moneda, valor, fuente) values (v_hoy, 'USD', 18.60, 'manual')
    on conflict (fecha, moneda) do update set valor = excluded.valor, fuente = excluded.fuente;
  perform pg_temp.como_postgres();
  assert tc_costeo('USD') = 18.60, 'lo capturado a mano no movió el costeo';
  perform aplicar_tipo_cambio('DOF', jsonb_build_object('ListaIndicadores', jsonb_build_array(
    jsonb_build_object('codTipoIndicador', 158, 'fecha', to_char(v_hoy, 'DD-MM-YYYY'), 'valor', '18.4888'))));
  assert tc('USD') = 18.60, 'el DOF pisó lo capturado a mano';

  -- Un salto de 5% del día siguiente: el costeo lo sigue.
  perform aplicar_tipo_cambio('DOF', jsonb_build_object('ListaIndicadores', jsonb_build_array(
    jsonb_build_object('codTipoIndicador', 158, 'fecha', to_char(v_hoy + 1, 'DD-MM-YYYY'), 'valor', '19.5300'))));
  assert tc_costeo('USD') = 19.53, format('el costeo no siguió el salto: %s', tc_costeo('USD'));

  -- El del costeo se puede fijar a mano sin tocar el del día.
  perform pg_temp.como(v_comp);
  perform fijar_tc_costeo('USD', 19.00);
  assert tc_costeo('USD') = 19.00 and tc('USD') = 19.53, 'fijar el del costeo movió el del día';
  -- Nadie desde la pantalla pide, guarda ni aplica tipos de cambio.
  begin
    perform aplicar_tipo_cambio('DOF', '{}');
    v_estado := 'aplicó';
  exception when insufficient_privilege then v_estado := 'negado';
  end;
  assert v_estado = 'negado', 'compras llamó aplicar_tipo_cambio';
  begin
    perform pedir_tipos_cambio();
    v_estado := 'pidió';
  exception when insufficient_privilege then v_estado := 'negado';
  end;
  assert v_estado = 'negado', 'compras llamó pedir_tipos_cambio';
  perform pg_temp.como(v_vend);
  begin
    perform fijar_tc_costeo('USD', 25);
    v_estado := 'fijó';
  exception when insufficient_privilege then v_estado := 'negado';
  end;
  assert v_estado = 'negado', 'un vendedor fijó el tipo de cambio del costeo';
end $$;

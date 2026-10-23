-- El UUID copiado del PDF con caracteres invisibles o guiones tipográficos se limpia solo; lo
-- que de verdad está mal se dice con claridad. Y la hoja de salida de un pedido de la hoja no
-- repite el equipo: salen los equipos con su serie y el texto del pedido como referencia.
do $$
declare v_ven uuid; v_alm uuid; v_cli uuid; p uuid; p2 uuid; l2 uuid; v_eq uuid; v_eq2 uuid; h jsonb; v_ok boolean; v_err text;
begin
  v_ven := pg_temp.usuario('ven170@hegamex.com', '{ventas}');
  v_alm := pg_temp.usuario('alm170@hegamex.com', '{almacen}');
  insert into clientes (nombre, vendedor_id) values ('Cliente 170', v_ven) returning id into v_cli;
  insert into pedidos (cliente_id, vendedor_id, estado) values (v_cli, v_ven, 'listo') returning id into p;
  insert into pedido_lineas (pedido_id, titulo, cantidad, precio_unitario) values (p, '1 cribadora ZAR 4 PEDIDO 170', 1, 198360);

  -- UUID: espacio de ancho cero, espacio duro al final y un guion tipográfico → queda limpio.
  insert into facturas (pedido_id, folio, uuid_sat, fecha, total)
  values (p, 'A 170-1', '9D3F1FD5' || chr(8208) || '3334-4012-ABC7-' || chr(8203) || '6C337F071FBE' || chr(160), current_date, 1);
  assert (select uuid_sat from facturas where folio = 'A 170-1') = '9D3F1FD5-3334-4012-ABC7-6C337F071FBE',
    'no limpió el UUID: ' || (select uuid_sat from facturas where folio = 'A 170-1');
  -- Sin guiones y en minúsculas también se entiende.
  insert into facturas (pedido_id, folio, uuid_sat, fecha, total) values (p, 'A 170-2', '0e3f1fd5333440129bc76c337f071fbe', current_date, 1);
  assert (select uuid_sat from facturas where folio = 'A 170-2') = '0E3F1FD5-3334-4012-9BC7-6C337F071FBE', 'no acomodó el UUID sin guiones';
  -- Una letra O en lugar de cero: se dice cuál.
  begin
    insert into facturas (pedido_id, folio, uuid_sat, fecha, total) values (p, 'A 170-3', '9D3F1FD5-3334-4O12-ABC7-6C337F071FBE', current_date, 1);
    v_ok := true;
  exception when raise_exception then v_ok := false; get stacked diagnostics v_err = message_text; end;
  assert not v_ok and v_err like '%trae O%', 'la letra O no se explicó: ' || coalesce(v_err, '');
  -- Incompleto: se dice cuántos trae.
  begin
    insert into facturas (pedido_id, folio, uuid_sat, fecha, total) values (p, 'A 170-4', '9D3F1FD5-3334-4012-ABC7-6C337F071F', current_date, 1);
    v_ok := true;
  exception when raise_exception then v_ok := false; get stacked diagnostics v_err = message_text; end;
  assert not v_ok and v_err like '%trae 34%', 'el UUID incompleto no se explicó: ' || coalesce(v_err, '');

  -- Hoja de salida de un pedido de la hoja: la partida es texto y el equipo es una orden sin ligar.
  insert into articulos (clave, tipo, nombre) values ('T170-CRIBA', 'equipo', 'Cribadora Zar 4T 170') returning id into v_eq;
  insert into ordenes_produccion (articulo_id, cantidad, estado, pedido_id, numero_serie) values (v_eq, 1, 'terminada', p, 'CZ170') ;
  perform pg_temp.como(v_alm);
  h := hoja_salida(p);
  assert jsonb_array_length(h->'partidas') = 0, 'repitió la partida de texto: ' || (h->'partidas')::text;
  assert jsonb_array_length(h->'sueltas') = 1 and h->'sueltas'->0->>'serie' = 'CZ170', 'no salió el equipo con su serie';
  assert h->>'como_venia' like '%cribadora ZAR 4 PEDIDO 170%', 'no quedó el texto del pedido de referencia';
  perform pg_temp.como_postgres();

  -- Un pedido del ERP (partida con artículo y su orden ligada) sale igual que antes.
  insert into articulos (clave, tipo, nombre) values ('T170-BANDA', 'equipo', 'Banda 170') returning id into v_eq2;
  insert into pedidos (cliente_id, vendedor_id, estado) values (v_cli, v_ven, 'listo') returning id into p2;
  insert into pedido_lineas (pedido_id, articulo_id, titulo, cantidad, precio_unitario) values (p2, v_eq2, 'Banda 170', 1, 1000) returning id into l2;
  insert into ordenes_produccion (articulo_id, cantidad, estado, pedido_id, pedido_linea_id, numero_serie) values (v_eq2, 1, 'terminada', p2, l2, 'BT170');
  perform pg_temp.como(v_alm);
  h := hoja_salida(p2);
  assert jsonb_array_length(h->'partidas') = 1 and h->'partidas'->0->'series' = '["BT170"]', 'el pedido del ERP cambió: ' || (h->'partidas')::text;
  assert jsonb_array_length(h->'sueltas') = 0 and h->>'como_venia' is null, 'el pedido del ERP trae referencia de la hoja';
  perform pg_temp.como_postgres();
end $$;

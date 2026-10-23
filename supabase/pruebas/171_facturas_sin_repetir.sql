-- Una factura emitida se registra una sola vez: el mismo folio (escrito como sea) o el mismo
-- UUID en otra factura se rechaza y dice dónde está. La que ya está se corrige en su lugar (le
-- falta el UUID, la fecha está mal) o se quita; eso lo hace finanzas, no ventas.
do $$
declare v_fin uuid; v_ven uuid; v_cli uuid; p uuid; p2 uuid; f uuid; v_ok boolean; v_err text; v_folio text; v_n int;
begin
  v_fin := pg_temp.usuario('fin171@hegamex.com', '{finanzas}');
  v_ven := pg_temp.usuario('ven171@hegamex.com', '{ventas}');
  insert into clientes (nombre, vendedor_id) values ('Cliente 171', v_ven) returning id into v_cli;
  insert into pedidos (cliente_id, vendedor_id, estado) values (v_cli, v_ven, 'listo') returning id into p;
  insert into pedidos (cliente_id, vendedor_id, estado) values (v_cli, v_ven, 'listo') returning id into p2;

  perform pg_temp.como(v_fin);
  insert into facturas (pedido_id, folio, fecha, total) values (p, 'Z 171', '2026-07-14', 198360) returning id into f;

  -- El mismo folio con guion, sin espacio o en minúsculas es la misma factura, aunque sea en otro pedido.
  foreach v_folio in array array['Z 171', 'Z-171', 'z171', ' Z 171 '] loop
    begin
      insert into facturas (pedido_id, folio, uuid_sat, fecha, total) values (p2, v_folio, '9D3F1FD5-3334-4012-ABC7-6C337F071171', '2026-10-23', 198360);
      v_ok := true;
    exception when unique_violation then v_ok := false; get stacked diagnostics v_err = message_text; end;
    assert not v_ok, 'aceptó la factura repetida como «' || v_folio || '»';
    assert v_err like '%ya está registrada%' and v_err like '%14/07/2026%' and v_err like '%lápiz%', 'el mensaje no dice dónde está: ' || v_err;
  end loop;
  -- Otro folio que solo se parece sí entra.
  insert into facturas (pedido_id, folio, fecha, total) values (p2, 'Z 1710', current_date, 1);

  -- Corregir la que ya estaba: ponerle el UUID (con el guion del PDF) no choca consigo misma.
  update facturas set uuid_sat = '9D3F1FD5' || chr(8208) || '3334-4012-ABC7-6C337F071171', folio = 'Z-171' where id = f;
  assert (select uuid_sat from facturas where id = f) = '9D3F1FD5-3334-4012-ABC7-6C337F071171', 'no guardó el UUID corregido';

  -- El mismo UUID con otro folio tampoco entra.
  begin
    insert into facturas (pedido_id, folio, uuid_sat, fecha, total) values (p2, 'Z 9171', '9d3f1fd5-3334-4012-abc7-6c337f071171', current_date, 1);
    v_ok := true;
  exception when unique_violation then v_ok := false; end;
  assert not v_ok, 'aceptó el mismo UUID con otro folio';
  -- Ni cambiándole el UUID a otra factura para que choque.
  begin
    update facturas set uuid_sat = '9D3F1FD5-3334-4012-ABC7-6C337F071171' where folio = 'Z 1710';
    v_ok := true;
  exception when unique_violation then v_ok := false; end;
  assert not v_ok, 'dejó repetir el UUID al corregir otra factura';

  -- Ventas no corrige ni quita facturas (la base no lo deja, aunque llegue a la pantalla).
  perform pg_temp.como(v_ven);
  update facturas set total = 1 where id = f;
  get diagnostics v_n = row_count;
  assert v_n = 0, 'ventas corrigió una factura';
  delete from facturas where id = f;
  get diagnostics v_n = row_count;
  assert v_n = 0, 'ventas quitó una factura';

  -- Finanzas la quita si se registró por error, y queda en la bitácora.
  perform pg_temp.como(v_fin);
  delete from facturas where folio = 'Z 1710';
  perform pg_temp.como_postgres();
  assert not exists (select 1 from facturas where folio = 'Z 1710'), 'no se quitó la factura';
  assert exists (select 1 from bitacora where tabla = 'facturas' and accion = 'baja' and cambios->'folio'->>0 = 'Z 1710'), 'no quedó en la bitácora';
end $$;

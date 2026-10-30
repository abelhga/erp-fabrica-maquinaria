-- La caja chica tiene su propio permiso: recepción y compras registran entradas y salidas y ven
-- el saldo; arqueo y borrar se quedan con finanzas; ventas no la ve. Nadie de ellos ve finanzas.
do $$
declare v_rec uuid; v_com uuid; v_fin uuid; v_ven uuid; v_id bigint; v_ok boolean; v_n int;
begin
  v_rec := pg_temp.usuario('rec202@hegamex.com', '{recepcion}');
  v_com := pg_temp.usuario('com202@hegamex.com', '{compras}');
  v_fin := pg_temp.usuario('fin202@hegamex.com', '{finanzas}');
  v_ven := pg_temp.usuario('ven202@hegamex.com', '{ventas}');

  -- 1. Recepción registra una salida y la ve, con su nombre en turno.
  perform pg_temp.como(v_rec);
  v_id := registrar_caja_chica('salida', 350, 'Gasolina para la camioneta (prueba 202)');
  assert (select importe = -350 and en_turno is not null from caja_chica where id = v_id), 'recepción no registró la salida';
  --    Compras también, y ve lo de recepción.
  perform pg_temp.como(v_com);
  perform registrar_caja_chica('entrada', 1000, 'Reposición (prueba 202)');
  assert exists (select 1 from caja_chica where id = v_id), 'compras no ve la caja';

  -- 2. Ni recepción ni compras hacen arqueo ni borran; tampoco ven finanzas.
  begin perform arqueo_caja_chica(100); v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'compras hizo un arqueo';
  delete from caja_chica where id = v_id;
  get diagnostics v_n = row_count;
  assert v_n = 0, 'compras borró un movimiento';
  assert not puede('finanzas', 1), 'compras ve finanzas';
  perform pg_temp.como(v_rec);
  assert not puede('finanzas', 1), 'recepción ve finanzas';

  -- 3. Finanzas sigue llevando todo: arqueo y borrar.
  perform pg_temp.como(v_fin);
  perform arqueo_caja_chica((select coalesce(sum(importe), 0) from caja_chica) + 10);
  delete from caja_chica where id = v_id;
  get diagnostics v_n = row_count;
  assert v_n = 1, 'finanzas no pudo borrar';

  -- 4. Ventas no la ve ni registra.
  perform pg_temp.como(v_ven);
  assert not exists (select 1 from caja_chica), 'ventas ve la caja chica';
  begin perform registrar_caja_chica('salida', 10, 'No debería'); v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'ventas registró en la caja chica';
  perform pg_temp.como_postgres();
end $$;

-- Un ajuste lo autoriza la gerencia de producción o dirección. Lo que NO: que una persona de almacén
-- autorice el ajuste que pidió su compañera, ni que le llegue el aviso de «por autorizar».
do $$
declare v_a1 uuid; v_a2 uuid; v_ger uuid; v_dir uuid; v_art uuid; v_pb int; v_aj uuid; v_aj2 uuid; v_ok boolean; v_msg text;
begin
  v_a1 := pg_temp.usuario('alm272a@hegamex.com', '{almacen}');
  v_a2 := pg_temp.usuario('alm272b@hegamex.com', '{almacen}');
  v_ger := pg_temp.usuario('ger272@hegamex.com', '{gerente_produccion}');
  v_dir := pg_temp.usuario('dir272@hegamex.com', '{direccion}');
  v_pb := (select id from almacenes where nombre = 'Planta Baja');
  insert into articulos (clave, tipo, nombre, unidad) values ('T-272', 'componente', 'T Chumacera 272', 'pieza') returning id into v_art;
  insert into movimientos_inventario (tipo, articulo_id, almacen_id, cantidad, motivo) values ('inicial', v_art, v_pb, 10, 'Prueba 272');

  perform pg_temp.como(v_a1);
  v_aj := solicitar_ajuste(v_art, v_pb, 7, 'Conteo 272');

  -- 1. La compañera de almacén no lo autoriza (ni lo rechaza).
  perform pg_temp.como(v_a2);
  begin perform resolver_ajuste(v_aj, true); v_ok := true; exception when insufficient_privilege then v_ok := false; v_msg := sqlerrm; end;
  assert not v_ok and v_msg like 'Los ajustes los autoriza la gerencia%', format('almacén autorizó el ajuste de su compañera: %s', v_msg);
  begin perform resolver_ajuste(v_aj, false, 'No'); v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'almacén rechazó el ajuste de su compañera';
  assert (select cantidad from existencias where articulo_id = v_art and almacen_id = v_pb) = 10, 'la existencia se movió';

  -- 2. El aviso le llega a la gerencia y a dirección, no a almacén.
  perform pg_temp.como_postgres();
  assert exists (select 1 from avisos where usuario_id = v_ger and tipo = 'ajuste_por_autorizar' and registro_id = v_aj::text), 'a la gerencia no le llegó';
  assert exists (select 1 from avisos where usuario_id = v_dir and tipo = 'ajuste_por_autorizar' and registro_id = v_aj::text), 'a dirección no le llegó';
  assert not exists (select 1 from avisos where usuario_id in (v_a1, v_a2) and tipo = 'ajuste_por_autorizar' and registro_id = v_aj::text), 'a almacén le llegó el por autorizar';

  -- 3. La gerencia lo autoriza y se aplica.
  perform pg_temp.como(v_ger);
  perform resolver_ajuste(v_aj, true, 'Visto en piso 272');
  assert (select cantidad from existencias where articulo_id = v_art and almacen_id = v_pb) = 7, 'no se aplicó';

  -- 4. Dirección también, aunque lo haya pedido ella misma.
  perform pg_temp.como(v_dir);
  v_aj2 := solicitar_ajuste(v_art, v_pb, 8, 'Conteo 272 dirección');
  perform resolver_ajuste(v_aj2, true, 'Visto');
  assert (select cantidad from existencias where articulo_id = v_art and almacen_id = v_pb) = 8, 'dirección no pudo autorizar';
end $$;

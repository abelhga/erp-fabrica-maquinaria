-- Los minutos para deshacer salen de Configuración: con 0 no se deshace ni se reabre nada, con 5 lo de
-- hace 6 minutos ya no, lo exagerado se recorta a 240 y solo sistemas o dirección lo cambian.
do $$
declare v_alm uuid; v_a uuid; v_b uuid; v_art uuid; v_s bigint; v_p uuid; v_ok boolean;
begin
  v_alm := pg_temp.usuario('alm230@hegamex.com', '{almacen}');
  v_a := pg_temp.usuario('a230@hegamex.com', '{ventas}');
  v_b := pg_temp.usuario('b230@hegamex.com', '{compras}');
  insert into articulos (clave, tipo, nombre) values ('T230-POL', 'componente', 'T230 Polea') returning id into v_art;
  insert into movimientos_inventario (tipo, articulo_id, almacen_id, cantidad, motivo)
  values ('inicial', v_art, (select id from almacenes where nombre = 'Planta Baja'), 10, 'T230');

  -- 1. Almacén apagado: la salida de hace un momento ya no se deshace.
  update configuracion set valor = '{"almacen": 0, "pendientes": 5}' where clave = 'deshacer';
  perform pg_temp.como(v_alm);
  v_s := registrar_salida(v_art, (select id from almacenes where nombre = 'Planta Baja'), 1, 'salida_venta', 'Venta mostrador');
  begin perform deshacer_movimiento(v_s, 'Me equivoqué'); v_ok := true; exception when check_violation then v_ok := false; end;
  assert not v_ok, 'se deshizo con el deshacer apagado';

  -- 2. Pendientes con 5 minutos: lo cerrado hace 6 ya no se reabre; lo de hace 4 sí.
  perform pg_temp.como(v_a);
  insert into pendientes (titulo, responsable_id, creado_por) values ('T230', v_b, v_a) returning id into v_p;
  update pendientes set estado = 'cancelado' where id = v_p;
  perform pg_temp.como_postgres();
  update pendientes set cerrado_en = now() - interval '6 minutes' where id = v_p;
  perform pg_temp.como(v_a);
  begin perform reabrir_pendiente(v_p); v_ok := true; exception when check_violation then v_ok := false; end;
  assert not v_ok, 'se reabrió después de los 5 minutos de Configuración';
  perform pg_temp.como_postgres();
  update pendientes set cerrado_en = now() - interval '4 minutes' where id = v_p;
  perform pg_temp.como(v_a);
  assert reabrir_pendiente(v_p) = 1, 'no se reabrió dentro de los 5 minutos';

  -- 3. Lo exagerado se recorta; sin la clave, 15.
  perform pg_temp.como_postgres();
  update configuracion set valor = '{"almacen": 99999, "pendientes": -3}' where clave = 'deshacer';
  assert minutos_deshacer('almacen') = 240 and minutos_deshacer('pendientes') = 0, 'no recortó los minutos';
  update configuracion set valor = '{}' where clave = 'deshacer';
  assert minutos_deshacer('almacen') = 15, 'sin la clave no quedó en 15';

  -- 4. Almacén no lo cambia (la configuración es de sistemas y dirección).
  perform pg_temp.como(v_alm);
  update configuracion set valor = '{"almacen": 240}' where clave = 'deshacer';
  perform pg_temp.como_postgres();
  assert (select valor from configuracion where clave = 'deshacer') = '{}'::jsonb, 'almacén cambió los minutos para deshacer';
end $$;

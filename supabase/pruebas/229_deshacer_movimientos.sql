-- Deshacer una salida o un traspaso: solo quien lo registró, antes de 15 minutos y con motivo. Queda
-- el movimiento contrario ligado al original (nada se borra) y el consumo se compensa; un traspaso
-- regresa solo si lo que llegó sigue ahí. Lo de otras pantallas (una orden) no se deshace aquí.
do $$
declare
  v_alm uuid; v_alm2 uuid; v_ven uuid; v_art uuid; v_pb int; v_ma int; v_s bigint; v_s2 bigint; v_t uuid; v_mt bigint;
  v_ok boolean; n int; r record;
begin
  v_alm := pg_temp.usuario('alm229@hegamex.com', '{almacen}');
  v_alm2 := pg_temp.usuario('alm2229@hegamex.com', '{almacen}');
  v_ven := pg_temp.usuario('ven229@hegamex.com', '{ventas}');
  select id into v_pb from almacenes where nombre = 'Planta Baja';
  select id into v_ma from almacenes where nombre = 'Mallado';
  insert into articulos (clave, tipo, nombre) values ('T229-POL', 'componente', 'T229 Polea') returning id into v_art;
  insert into movimientos_inventario (tipo, articulo_id, almacen_id, cantidad, motivo) values ('inicial', v_art, v_pb, 10, 'T229');

  -- 1. Noemí le da salida por error y la deshace: la existencia regresa y queda la liga.
  perform pg_temp.como(v_alm);
  v_s := registrar_salida(v_art, v_pb, 3, 'salida_consumo', 'Taller', null, 'Juan');
  -- Sin motivo, no.
  begin perform deshacer_movimiento(v_s, ' '); v_ok := true; exception when check_violation then v_ok := false; end;
  assert not v_ok, 'se deshizo sin motivo';
  -- Otra persona del almacén, no.
  perform pg_temp.como(v_alm2);
  begin perform deshacer_movimiento(v_s, 'No era para él'); v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'lo deshizo alguien que no lo registró';
  -- Ventas (sin almacén), no.
  perform pg_temp.como(v_ven);
  begin perform deshacer_movimiento(v_s, 'No era para él'); v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'ventas deshizo un movimiento';

  perform pg_temp.como(v_alm);
  n := deshacer_movimiento(v_s, 'Era de Mercado Libre');
  perform pg_temp.como_postgres();
  assert n = 1, format('deshacer regresó %s', n);
  assert (select cantidad from existencias where articulo_id = v_art and almacen_id = v_pb) = 10, 'la existencia no regresó';
  select * into r from movimientos_inventario where deshace_id = v_s;
  assert r.tipo = 'salida_consumo' and r.cantidad = 3 and r.usuario_id = v_alm and r.recibio = 'Juan' and r.motivo like 'Se deshizo la salida de las %Era de Mercado Libre',
    format('la corrección quedó mal: %s', row_to_json(r));
  -- El consumo (como lo suman la demanda y las métricas) queda en cero.
  assert (select sum(-cantidad) from movimientos_inventario where articulo_id = v_art and tipo = 'salida_consumo') = 0, 'el consumo no se compensó';
  -- La vista dice quién deshizo a quién.
  perform pg_temp.como(v_alm);
  assert (select deshecho_por from v_movimientos where id = v_s) = r.id, 'la vista no liga el original con su corrección';
  -- Dos veces, no; ni deshacer la corrección.
  begin perform deshacer_movimiento(v_s, 'Otra vez'); v_ok := true; exception when check_violation then v_ok := false; end;
  assert not v_ok, 'se deshizo dos veces';
  begin perform deshacer_movimiento(r.id, 'Al revés'); v_ok := true; exception when check_violation then v_ok := false; end;
  assert not v_ok, 'se deshizo una corrección';

  -- 2. Pasados 15 minutos, no: se pide un ajuste.
  v_s2 := registrar_salida(v_art, v_pb, 1, 'salida_venta', 'Venta mostrador');
  perform pg_temp.como_postgres();
  alter table movimientos_inventario disable trigger inalterable;
  update movimientos_inventario set en = now() - interval '16 minutes' where id = v_s2;
  alter table movimientos_inventario enable trigger inalterable;
  perform pg_temp.como(v_alm);
  begin perform deshacer_movimiento(v_s2, 'Me equivoqué'); v_ok := true; exception when check_violation then v_ok := false; end;
  assert not v_ok, 'se deshizo después de 15 minutos';

  -- 3. Un traspaso regresa completo; si lo que llegó ya salió del destino, no.
  v_t := traspasar(v_art, v_pb, v_ma, 4, 'Reacomodo');
  select id into v_mt from movimientos_inventario where traspaso_id = v_t and tipo = 'traspaso_entrada';
  n := deshacer_movimiento(v_mt, 'Era a Planta Alta');
  perform pg_temp.como_postgres();
  assert n = 2, format('el traspaso regresó %s movimientos', n);
  assert (select cantidad from existencias where articulo_id = v_art and almacen_id = v_pb) = 9
     and (select cantidad from existencias where articulo_id = v_art and almacen_id = v_ma) = 0, 'el traspaso no regresó';
  perform pg_temp.como(v_alm);
  begin perform deshacer_movimiento((select id from movimientos_inventario where traspaso_id = v_t and tipo = 'traspaso_salida'), 'Otra vez');
    v_ok := true; exception when check_violation then v_ok := false; end;
  assert not v_ok, 'se deshizo dos veces el mismo traspaso';
  v_t := traspasar(v_art, v_pb, v_ma, 2, 'Reacomodo');
  perform registrar_salida(v_art, v_ma, 1, 'salida_consumo', 'Taller', null, 'Juan');
  begin perform deshacer_movimiento((select id from movimientos_inventario where traspaso_id = v_t and tipo = 'traspaso_salida'), 'Era a otro');
    v_ok := true; exception when check_violation then v_ok := false; end;
  assert not v_ok, 'regresó un traspaso cuyo material ya había salido del destino';

  -- 4. Una devolución o lo de una orden no se deshace aquí.
  v_s := registrar_devolucion(v_art, v_pb, 1, 'Sobró de la orden');
  begin perform deshacer_movimiento(v_s, 'Me equivoqué'); v_ok := true; exception when check_violation then v_ok := false; end;
  assert not v_ok, 'se deshizo una devolución';
  perform pg_temp.como_postgres();
end $$;

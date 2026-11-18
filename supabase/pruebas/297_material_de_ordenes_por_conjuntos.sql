-- El material de las órdenes dice lo mismo que antes en «pedido a compras» (contra pedido_a_compras_op,
-- renglón por renglón), con lo pedido, lo cancelado y un material reemplazado; y quien no lee el
-- material sigue sin leerlo.
do $$
declare v_gp uuid; v_ing uuid; v_alm uuid; v_comp uuid; v_vend uuid; v_rh uuid; v_pb int;
  v_eq uuid; v_a uuid; v_b uuid; v_c uuid; v_d uuid; v_op1 uuid; v_op2 uuid; m_b uuid; v_n int; r record;
begin
  v_gp := pg_temp.usuario('gp297@hegamex.com', '{gerente_produccion}');
  v_ing := pg_temp.usuario('ing297@hegamex.com', '{ingenieria}');
  v_alm := pg_temp.usuario('alm297@hegamex.com', '{almacen}');
  v_comp := pg_temp.usuario('comp297@hegamex.com', '{compras}');
  v_vend := pg_temp.usuario('vend297@hegamex.com', '{ventas}');
  v_rh := pg_temp.usuario('rh297@hegamex.com', '{rrhh}');
  select id into v_pb from almacenes where nombre = 'Planta Baja';
  insert into articulos (clave, tipo, nombre) values ('T297-EQ', 'equipo', 'Tolva 297') returning id into v_eq;
  insert into articulos (clave, tipo, nombre) values ('T297-A', 'materia_prima', 'Lámina 297') returning id into v_a;
  insert into articulos (clave, tipo, nombre) values ('T297-B', 'componente', 'Chumacera 297') returning id into v_b;
  insert into articulos (clave, tipo, nombre) values ('T297-C', 'componente', 'Motor 297') returning id into v_c;
  insert into articulos (clave, tipo, nombre) values ('T297-D', 'componente', 'Chumacera con cuñero 297') returning id into v_d;
  insert into bom_lineas (padre_id, hijo_id, cantidad) values (v_eq, v_a, 10), (v_eq, v_b, 4), (v_eq, v_c, 1);
  insert into bom_operaciones (articulo_id, etapa_id, horas) values (v_eq, (select id from etapas where nombre = 'Pailería'), 10);
  insert into movimientos_inventario (tipo, articulo_id, almacen_id, cantidad) values ('inicial', v_a, v_pb, 10);

  perform pg_temp.como(v_gp);
  v_op1 := crear_orden_produccion(v_eq, 1);
  v_op2 := crear_orden_produccion(v_eq, 1);
  perform apartar_material(v_op1, 'Prueba 297');
  perform apartar_material(v_op2, 'Prueba 297');
  perform pedir_faltantes(v_op1);
  perform pedir_faltantes(v_op2);
  -- En la segunda se reemplaza la chumacera (ya pedida) por la de cuñero.
  perform pg_temp.como_postgres();
  select id into m_b from op_materiales where orden_id = v_op2 and articulo_id = v_b;
  perform pg_temp.como(v_ing);
  perform reemplazar_material_orden(m_b, v_d, 4, 'La de la lista no trae cuñero');
  -- Y compras cancela el motor de la primera.
  perform pg_temp.como_postgres();
  update requisicion_lineas set estado = 'cancelada' where orden_produccion_id = v_op1 and articulo_id = v_c;

  -- Lo mismo que la función de antes, renglón por renglón, para quien lee el material.
  for r in select * from (values (v_gp, 'gerencia de producción'), (v_alm, 'almacén'), (v_comp, 'compras'), (v_ing, 'ingeniería')) x(u, quien) loop
    perform pg_temp.como(r.u);
    select count(*) into v_n from v_op_material where orden_id in (v_op1, v_op2);
    assert v_n >= 7, format('%s ve %s renglones de material', r.quien, v_n);
    select count(*) into v_n from v_op_material m
    where m.orden_id in (v_op1, v_op2) and m.pedido_a_compras is distinct from pedido_a_compras_op(m.orden_id, m.articulo_id);
    assert v_n = 0, format('%s: %s renglones con otro «pedido a compras»', r.quien, v_n);
  end loop;

  perform pg_temp.como(v_gp);
  -- op1: no había chumaceras ni motor; el motor se canceló, así que ya no cuenta como pedido.
  assert (select pedido_a_compras from v_op_material where orden_id = v_op1 and articulo_id = v_b) = 4, 'chumaceras de op1 pedidas';
  assert (select pedido_a_compras from v_op_material where orden_id = v_op1 and articulo_id = v_c) = 0, 'la partida cancelada sigue contando';
  assert (select pedido_a_compras from v_op_material where orden_id = v_op1 and articulo_id = v_a) = 0, 'la lámina alcanzó: no se pidió';
  -- op2: se quedó sin lámina (se pidió) y el reemplazo dice de quién viene y quién lo sustituye.
  assert (select pedido_a_compras from v_op_material where orden_id = v_op2 and articulo_id = v_a) = 10, 'lámina de op2 pedida';
  select * into r from v_op_material where id = m_b;
  assert r.reemplazado_por = 'Chumacera con cuñero 297' and r.quitado_en is not null, format('reemplazado por: %s', r.reemplazado_por);
  assert (select reemplaza_a_nombre from v_op_material where orden_id = v_op2 and articulo_id = v_d) = 'Chumacera 297', 'a quién reemplaza';
  -- Un renglón por material: unir lo pedido no duplica nada.
  assert (select count(*) from v_op_material where orden_id = v_op2) = (select count(*) from op_materiales where orden_id = v_op2), 'renglones duplicados';

  -- Ventas no lee el material de la orden, ni lo pedido suelto.
  perform pg_temp.como(v_vend);
  assert not exists (select 1 from v_op_material where orden_id in (v_op1, v_op2)), 'ventas vio el material de la orden';
  -- Y quien no ve producción ni inventario no recibe lo pedido a compras.
  perform pg_temp.como(v_rh);
  assert not exists (select 1 from pedido_a_compras_ops()), 'recursos humanos recibió lo pedido a compras';

  -- El índice que evita recorrer la tabla por cada renglón.
  perform pg_temp.como_postgres();
  assert exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'op_materiales_reemplaza_a'), 'falta el índice de reemplaza_a';
end $$;

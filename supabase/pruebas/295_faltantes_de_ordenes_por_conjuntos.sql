-- El conteo de faltantes por orden da lo mismo que contar sobre el detalle de material (v_op_material),
-- con material apartado, pedido a compras, surtido a medias y consumibles del taller; y quien no ve
-- producción ni inventario no recibe nada.
do $$
declare v_gp uuid; v_vend uuid; v_fin uuid; -- v_fin: alguien sin producción ni inventario
  v_pb int;
  v_eq uuid; v_a uuid; v_b uuid; v_c uuid; v_d uuid; v_op1 uuid; v_op2 uuid; v_op3 uuid; v_n int; r record;
begin
  v_gp := pg_temp.usuario('gp295@hegamex.com', '{gerente_produccion}');
  v_vend := pg_temp.usuario('vend295@hegamex.com', '{ventas}');
  v_fin := pg_temp.usuario('rh295@hegamex.com', '{rrhh}');
  select id into v_pb from almacenes where nombre = 'Planta Baja';

  insert into articulos (clave, tipo, nombre) values ('T295-EQ', 'equipo', 'Tolva 295') returning id into v_eq;
  insert into articulos (clave, tipo, nombre) values ('T295-A', 'materia_prima', 'Lámina 295') returning id into v_a;
  insert into articulos (clave, tipo, nombre) values ('T295-B', 'componente', 'Chumacera 295') returning id into v_b;
  insert into articulos (clave, tipo, nombre) values ('T295-C', 'componente', 'Motor 295') returning id into v_c;
  insert into articulos (clave, tipo, nombre) values ('T295-D', 'componente', 'Tornillo 295') returning id into v_d;
  insert into bom_lineas (padre_id, hijo_id, cantidad) values (v_eq, v_a, 10), (v_eq, v_b, 4), (v_eq, v_c, 1), (v_eq, v_d, 20);
  insert into bom_operaciones (articulo_id, etapa_id, horas) values (v_eq, (select id from etapas where nombre = 'Pailería'), 10);
  -- Alcanza la lámina para una orden y las chumaceras para una y media; motor y tornillo no hay.
  insert into movimientos_inventario (tipo, articulo_id, almacen_id, cantidad) values
    ('inicial', v_a, v_pb, 10), ('inicial', v_b, v_pb, 6);

  perform pg_temp.como(v_gp);
  v_op1 := crear_orden_produccion(v_eq, 1);
  v_op2 := crear_orden_produccion(v_eq, 1);
  v_op3 := crear_orden_produccion(v_eq, 1);
  perform apartar_material(v_op1, 'Prueba 295');
  perform apartar_material(v_op2, 'Prueba 295');
  perform pedir_faltantes(v_op2);
  -- La tercera queda sin apartar ni pedir, y luego se cancela: no debe salir.
  select count(*) into v_n from faltantes_de_ordenes() where orden_id in (v_op1, v_op2, v_op3);
  assert v_n = 3, format('las tres órdenes abiertas tienen conteo: %s', v_n);

  -- Lo mismo que contar sobre el detalle, orden por orden.
  for r in
    select o.id, f.faltantes, f.sin_pedir,
      (select count(*) filter (where m.faltante > 0) from v_op_material m where m.orden_id = o.id) f_det,
      (select count(*) filter (where m.faltante - m.pedido_a_compras > 0) from v_op_material m where m.orden_id = o.id) s_det
    from ordenes_produccion o left join faltantes_de_ordenes() f on f.orden_id = o.id
    where o.id in (v_op1, v_op2, v_op3)
  loop
    assert r.faltantes = r.f_det and r.sin_pedir = r.s_det,
      format('conteo %s/%s contra el detalle %s/%s', r.faltantes, r.sin_pedir, r.f_det, r.s_det);
  end loop;
  -- Y los números esperados: op1 apartó lámina y chumaceras (faltan motor y tornillo, sin pedir);
  -- op2 se quedó sin lámina y con 2 chumaceras (faltan las 4 partidas, todas pedidas).
  select faltantes, sin_pedir into r from faltantes_de_ordenes() where orden_id = v_op1;
  assert r.faltantes = 2 and r.sin_pedir = 2, format('op1: %s faltantes, %s sin pedir', r.faltantes, r.sin_pedir);
  select faltantes, sin_pedir into r from faltantes_de_ordenes() where orden_id = v_op2;
  assert r.faltantes = 4 and r.sin_pedir = 0, format('op2: %s faltantes, %s sin pedir', r.faltantes, r.sin_pedir);
  select faltantes, sin_pedir into r from faltantes_de_ordenes() where orden_id = v_op3;
  assert r.faltantes = 4 and r.sin_pedir = 4, format('op3: %s faltantes, %s sin pedir', r.faltantes, r.sin_pedir);

  -- El vendedor (producción 1) recibe el conteo aunque no lea el material.
  perform pg_temp.como(v_vend);
  assert not exists (select 1 from op_materiales where orden_id = v_op2), 'ventas vio el material';
  select faltantes, sin_pedir into r from faltantes_de_ordenes() where orden_id = v_op2;
  assert r.faltantes = 4 and r.sin_pedir = 0, format('ventas: op2 %s/%s', r.faltantes, r.sin_pedir);

  -- Quien no ve producción ni inventario no recibe nada.
  perform pg_temp.como(v_fin);
  assert not puede('produccion', 1) and not puede('inventario', 1), 'recursos humanos ya ve producción o inventario: cambia el rol de esta prueba';
  assert not exists (select 1 from faltantes_de_ordenes()), 'recursos humanos recibió el conteo de faltantes';

  -- Una orden cancelada deja de contarse.
  perform pg_temp.como(v_gp);
  perform cancelar_orden(v_op3, 'Prueba 295');
  assert not exists (select 1 from faltantes_de_ordenes() where orden_id = v_op3), 'la orden cancelada sigue contando';
end $$;

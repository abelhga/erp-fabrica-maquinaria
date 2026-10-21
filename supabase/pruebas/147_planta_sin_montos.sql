-- Producción, almacén y la gerencia de producción trabajan con folio, cliente y equipos
-- de cada pedido, sin un solo monto; el costo de los movimientos es de "costos";
-- recepción ve el catálogo con precio y existencia, sin listas de materiales ni planos.
do $$
declare v_prod uuid; v_alm uuid; v_gp uuid; v_rec uuid; v_isaac uuid; v_juan uuid; v_fin uuid; v_gv uuid;
  v_cli uuid; v_ped uuid; v_otro uuid; v_eq uuid; v_comp uuid; v_tubo uuid; v_op uuid; v_pb int; v_total numeric; v_ok boolean; v_n int; r record;
begin
  v_prod := pg_temp.usuario('taller147@hegamex.com', '{produccion}');
  v_alm := pg_temp.usuario('alm147@hegamex.com', '{almacen}');
  v_gp := pg_temp.usuario('gp147@hegamex.com', '{gerente_produccion}');
  v_rec := pg_temp.usuario('rec147@hegamex.com', '{recepcion}');
  v_isaac := pg_temp.usuario('isaac147@hegamex.com', '{ventas}');
  v_juan := pg_temp.usuario('juan147@hegamex.com', '{ventas}');
  v_fin := pg_temp.usuario('fin147@hegamex.com', '{finanzas}');
  v_gv := pg_temp.usuario('gv147@hegamex.com', '{gerente_ventas}');
  select id into v_pb from almacenes where nombre = 'Planta Baja';

  -- Un pedido de Isaac con una banda (con lista de materiales), un cobro y su factura.
  insert into articulos (clave, tipo, nombre, se_vende) values ('T147-EQ', 'equipo', 'Banda 147', true) returning id into v_eq;
  insert into articulos (clave, tipo, nombre, se_vende, descripcion) values ('T147-COL', 'componente', 'Colector 147', true, 'Colector de polvo')
    returning id into v_comp;
  insert into articulos (clave, tipo, nombre) values ('T147-TUBO', 'materia_prima', 'Tubo 147') returning id into v_tubo;
  insert into bom_lineas (padre_id, hijo_id, cantidad) values (v_eq, v_tubo, 6);
  insert into precios_lista (articulo_id, precio) values (v_comp, 4500);
  insert into costos_articulo (articulo_id, costo) values (v_comp, 3150) on conflict (articulo_id) do update set costo = 3150;
  insert into movimientos_inventario (tipo, articulo_id, almacen_id, cantidad, costo_unitario) values ('inicial', v_comp, v_pb, 7, 3150);
  insert into clientes (nombre) values ('Cliente 147') returning id into v_cli;
  insert into pedidos (cliente_id, vendedor_id, fecha_compromiso, total) values (v_cli, v_isaac, current_date + 30, 250000) returning id into v_ped;
  insert into pedido_lineas (pedido_id, articulo_id, titulo, cantidad, precio_unitario) values (v_ped, v_eq, 'Banda 147', 1, 200000), (v_ped, v_comp, 'Colector', 2, 4500);
  insert into cobros (pedido_id, monto) values (v_ped, 100000);
  insert into facturas (pedido_id, folio, total) values (v_ped, 'F-147', 250000);
  insert into pedidos (cliente_id, vendedor_id, total) values (v_cli, v_juan, 999) returning id into v_otro;
  -- Salida de venta del colector (con su costo) y una orden con serie para la banda.
  insert into movimientos_inventario (tipo, articulo_id, almacen_id, cantidad, costo_unitario, pedido_id) values ('salida_venta', v_comp, v_pb, -1, 3150, v_ped);
  insert into ordenes_produccion (articulo_id, cantidad, pedido_id, numero_serie) values (v_eq, 1, v_ped, 'T147-S1') returning id into v_op;
  select total into v_total from pedidos where id = v_ped;  -- lo recalculan las partidas

  -- Producción, almacén y la gerencia: folio, cliente y equipos; ningún monto.
  for r in select * from (values (v_prod, 'producción'), (v_alm, 'almacén'), (v_gp, 'gerencia de producción')) x(u, quien) loop
    perform pg_temp.como(r.u);
    assert not exists (select 1 from pedidos where id = v_ped), format('%s vio el pedido con su total', r.quien);
    assert not exists (select 1 from pedido_lineas where pedido_id = v_ped), format('%s vio los precios de las partidas', r.quien);
    assert not exists (select 1 from cobros where pedido_id = v_ped), format('%s vio los cobros', r.quien);
    assert not exists (select 1 from facturas where pedido_id = v_ped), format('%s vio el importe de las facturas', r.quien);
    assert (select folio is not null and cliente_id = v_cli from pedidos_basicos() where id = v_ped), format('%s no ve el folio del pedido', r.quien);
    assert (select count(*) from pedido_lineas_basicas() where pedido_id = v_ped) = 2, format('%s no ve qué lleva el pedido', r.quien);
    assert (select cliente = 'Cliente 147' and pedido is not null and factura = 'F-147' from v_numeros_serie where numero_serie = 'T147-S1'),
      format('%s no ve de quién es la serie', r.quien);
    assert (select pedido_folio is not null and cliente = 'Cliente 147' from v_tablero_produccion where id = v_op), format('%s no ve el pedido de la orden', r.quien);
  end loop;

  -- El pedido por producir (la banda ya tiene orden: solo cuenta lo que falta).
  perform pg_temp.como_postgres();
  delete from ordenes_produccion where id = v_op;
  perform pg_temp.como(v_prod);
  assert (select unidades = 1 and cliente = 'Cliente 147' and jsonb_array_length(partidas) = 1 from v_pedidos_por_producir where id = v_ped),
    'producción no ve qué falta por producir';

  -- Producción 2 ya no edita pedidos directo, ni sin filtro.
  update pedidos set total = 0;
  perform pg_temp.como_postgres();
  assert (select total from pedidos where id = v_ped) = v_total, 'producción le cambió el total al pedido';

  -- Almacén: arma el envío con las partidas, ve el folio del movimiento y no su costo.
  perform pg_temp.como(v_alm);
  assert (select count(*) from partidas_por_enviar(v_ped)) = 2, 'almacén no ve las partidas por enviar';
  assert (select pedido_folio is not null and costo_unitario is null from v_movimientos where pedido_id = v_ped), 'almacén vio el costo del movimiento';
  begin perform costo_unitario from movimientos_inventario limit 1; v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'almacén leyó el costo directo de la tabla';
  assert (select count(*) from costos_movimientos()) = 0, 'almacén leyó el costo por la función';
  assert exists (select 1 from movimientos_inventario where pedido_id = v_ped), 'almacén ya no ve sus movimientos';

  -- Quien tiene costos sí lo ve; ventas 3 y finanzas siguen viendo el pedido completo.
  perform pg_temp.como(v_fin);
  assert (select costo_unitario from v_movimientos where pedido_id = v_ped) = 3150, 'finanzas ya no ve el costo';
  assert (select total from pedidos where id = v_ped) = v_total and exists (select 1 from cobros where pedido_id = v_ped), 'finanzas ya no ve montos';
  perform pg_temp.como(v_gv);
  assert (select count(*) from pedido_lineas where pedido_id = v_ped) = 2, 'la gerencia de ventas ya no ve las partidas';

  -- El vendedor ve lo suyo completo, y nada de lo ajeno (ni sin montos).
  perform pg_temp.como(v_isaac);
  assert (select total from pedidos where id = v_ped) = v_total, 'Isaac no ve su pedido';
  assert not exists (select 1 from pedidos_basicos() where id = v_otro), 'Isaac ve el pedido de Juan';

  -- La gerencia de producción ya no tiene ventas.
  perform pg_temp.como(v_gp);
  assert not puede('ventas', 1) and puede('produccion', 3), 'permisos de la gerencia de producción';

  -- Recepción: catálogo con precio y existencia; ni listas de materiales, ni planos, ni costos.
  perform pg_temp.como(v_rec);
  assert puede('catalogo', 1) and not puede('costeo', 1) and not puede('ventas', 1), 'permisos de recepción';
  select * into r from v_catalogo where id = v_comp;
  assert r.precio = 4500 and r.existencia = 6 and r.costo_total is null and r.costo_capturado is null,
    format('recepción ve: precio %s, existencia %s, costo %s', r.precio, r.existencia, r.costo_capturado);
  assert not exists (select 1 from bom_lineas where padre_id = v_eq), 'recepción vio la lista de materiales';
  assert not exists (select 1 from bom_operaciones), 'recepción vio las horas';
  assert not exists (select 1 from documentos_tecnicos), 'recepción vio planos';
  assert not exists (select 1 from proveedores), 'recepción vio proveedores';
  assert not exists (select 1 from pedidos_basicos()), 'recepción vio pedidos';
end $$;

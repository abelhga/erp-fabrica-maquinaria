-- La planta ve los pedidos sin montos (y los encuentra en el buscador), y un equipo de
-- stock se asigna al pedido que lo compró.
do $$
declare v_vend uuid; v_gp uuid; v_taller uuid; v_cli uuid; v_eq uuid; v_otro uuid; v_ped uuid; v_lin uuid;
  v_stock uuid; v_ok boolean; v_n int; r record; v_folio text;
begin
  v_vend := pg_temp.usuario('vend151@hegamex.com', '{ventas}');
  v_gp := pg_temp.usuario('gp151@hegamex.com', '{gerente_produccion}');
  v_taller := pg_temp.usuario('taller151@hegamex.com', '{produccion}');
  insert into clientes (nombre, vendedor_id) values ('Cliente 151', v_vend) returning id into v_cli;
  insert into articulos (clave, tipo, nombre) values ('T151-BAZ', 'equipo', 'Bazuca 151') returning id into v_eq;
  insert into articulos (clave, tipo, nombre) values ('T151-TUB', 'materia_prima', 'Tubo 151') returning id into v_otro;
  insert into bom_lineas (padre_id, hijo_id, cantidad) values (v_eq, v_otro, 14);

  perform pg_temp.como(v_vend);
  insert into pedidos (cliente_id, canal) values (v_cli, 'directo') returning id, folio into v_ped, v_folio;
  perform pg_temp.como_postgres();
  insert into pedido_lineas (pedido_id, articulo_id, titulo, cantidad, precio_unitario) values (v_ped, v_eq, 'Bazuca 151', 2, 150000) returning id into v_lin;

  -- El buscador: el vendedor va a su pedido; la planta, a su pantalla de pedidos.
  perform pg_temp.como(v_vend);
  assert (select ruta from buscar_global(v_folio) where id = v_ped::text) like '/ventas/pedidos/%', 'el vendedor no encontró su pedido';
  perform pg_temp.como(v_taller);
  assert (select ruta from buscar_global(v_folio) where id = v_ped::text) = '/produccion/pedidos?pedido=' || v_ped, 'la planta no va a sus pedidos';

  -- La planta ve el pedido sin montos: equipos y lo que falta por ordenar.
  select * into r from v_pedidos_produccion where id = v_ped;
  assert r.cliente = 'Cliente 151' and r.equipos = 1 and r.sin_orden = 2, format('pedido en la planta: %s', row_to_json(r));
  assert not (to_jsonb(r) ? 'total') and r.partidas::text not like '%150000%', 'la planta vio montos';

  -- Un equipo de stock se asigna a la partida; la otra unidad se fabrica.
  perform pg_temp.como(v_gp);
  v_stock := crear_orden_produccion(v_eq, 1);
  perform pg_temp.como(v_taller);
  begin perform asignar_orden_stock(v_stock, v_lin); v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'el taller asignó stock a un pedido';
  perform pg_temp.como(v_gp);
  perform asignar_orden_stock(v_stock, v_lin);
  assert (select pedido_id = v_ped and pedido_linea_id = v_lin from ordenes_produccion where id = v_stock), 'no se asignó';
  assert (select sin_orden from v_pedidos_produccion where id = v_ped) = 1, 'sigue pidiendo dos órdenes';
  assert (select estado from pedidos_basicos() where id = v_ped) = 'en_produccion', 'el pedido no pasó a producción';
  begin perform asignar_orden_stock(v_stock, v_lin); v_ok := true; exception when raise_exception then v_ok := false; end;
  assert not v_ok, 'se asignó dos veces';
  v_n := ordenes_desde_pedido(v_ped);
  assert v_n = 1 and (select sin_orden from v_pedidos_produccion where id = v_ped) = 0, format('crear órdenes después del stock: %s', v_n);
end $$;

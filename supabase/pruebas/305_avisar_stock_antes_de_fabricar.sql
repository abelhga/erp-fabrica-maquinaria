-- Mandar un pedido a producción cuando ya hay equipos iguales para stock: no se fabrica otro sin
-- que alguien lo decida. Con el de stock asignado, lo que falta se crea sin preguntar; el equipo
-- que no tiene stock no estorba; y quien no es de producción ni ve el stock ni crea órdenes.
do $$
declare v_vend uuid; v_gp uuid; v_taller uuid; v_cli uuid; v_eq uuid; v_eq2 uuid; v_mp uuid; v_ped uuid;
  v_lin uuid; v_lin2 uuid; v_stock uuid; v_cancelada uuid; v_ok boolean; v_n int; j jsonb; v_msj text;
begin
  v_vend := pg_temp.usuario('vend305@hegamex.com', '{ventas}');
  v_gp := pg_temp.usuario('gp305@hegamex.com', '{gerente_produccion}');
  v_taller := pg_temp.usuario('taller305@hegamex.com', '{produccion}');
  insert into clientes (nombre, vendedor_id) values ('Cliente 305', v_vend) returning id into v_cli;
  insert into articulos (clave, tipo, nombre) values ('T305-BAN', 'equipo', 'Banda 305') returning id into v_eq;
  insert into articulos (clave, tipo, nombre) values ('T305-TOL', 'equipo', 'Tolva 305') returning id into v_eq2;
  insert into articulos (clave, tipo, nombre) values ('T305-TUB', 'materia_prima', 'Tubo 305') returning id into v_mp;
  insert into bom_lineas (padre_id, hijo_id, cantidad) values (v_eq, v_mp, 4), (v_eq2, v_mp, 2);

  perform pg_temp.como(v_vend);
  insert into pedidos (cliente_id, canal) values (v_cli, 'directo') returning id into v_ped;
  perform pg_temp.como_postgres();
  insert into pedido_lineas (pedido_id, articulo_id, titulo, cantidad, precio_unitario, orden) values (v_ped, v_eq, 'Banda 305', 2, 150000, 1) returning id into v_lin;
  insert into pedido_lineas (pedido_id, articulo_id, titulo, cantidad, precio_unitario, orden) values (v_ped, v_eq2, 'Tolva 305', 1, 90000, 2) returning id into v_lin2;

  -- Sin stock no hay nada que avisar.
  perform pg_temp.como(v_gp);
  assert stock_para_pedido(v_ped) = '[]'::jsonb, 'avisó de stock sin haberlo';

  -- Una banda para stock y otra ya cancelada: solo cuenta la viva.
  v_stock := crear_orden_produccion(v_eq, 1);
  v_cancelada := crear_orden_produccion(v_eq, 1);
  perform cancelar_orden(v_cancelada, 'Prueba 305: se creó de más');
  j := stock_para_pedido(v_ped);
  assert jsonb_array_length(j) = 1 and j->0->>'linea_id' = v_lin::text and (j->0->>'faltan')::int = 2
     and jsonb_array_length(j->0->'ordenes') = 1 and j->0->'ordenes'->0->>'id' = v_stock::text, format('stock para el pedido: %s', j);
  assert j::text not like '%150000%', 'el aviso de stock trae montos';

  -- Con stock igual no se crea nada, ni lo de la tolva, hasta que alguien decida.
  begin v_n := ordenes_desde_pedido(v_ped); v_ok := true;
  exception when raise_exception then v_ok := false; get stacked diagnostics v_msj = message_text; end;
  assert not v_ok, 'creó órdenes nuevas habiendo stock igual';
  assert v_msj like '%Banda 305%' and v_msj like '%' || (select folio from ordenes_produccion where id = v_stock) || '%', format('el aviso no dice qué hay: %s', v_msj);
  assert (select count(*) from ordenes_produccion where pedido_id = v_ped) = 0, 'quedaron órdenes a medias';

  -- El taller también topa con el aviso, y no puede asignar el de stock (eso es de gerencia).
  perform pg_temp.como(v_taller);
  assert jsonb_array_length(stock_para_pedido(v_ped)) = 1, 'el taller no vio el stock';
  begin v_n := ordenes_desde_pedido(v_ped); v_ok := true; exception when raise_exception then v_ok := false; end;
  assert not v_ok, 'el taller creó órdenes nuevas habiendo stock igual';

  -- Ventas no ve órdenes de stock ni manda a producción.
  perform pg_temp.como(v_vend);
  assert stock_para_pedido(v_ped) = '[]'::jsonb, 'ventas vio las órdenes de stock';
  begin v_n := ordenes_desde_pedido(v_ped, true); v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'ventas creó órdenes de producción';

  -- Se usa el de stock: ya no hay aviso y lo que falta (una banda y la tolva) se crea solo.
  perform pg_temp.como(v_gp);
  perform asignar_orden_stock(v_stock, v_lin);
  assert stock_para_pedido(v_ped) = '[]'::jsonb, 'sigue avisando de un stock que ya se usó';
  v_n := ordenes_desde_pedido(v_ped);
  assert v_n = 2, format('después de usar el stock debía crear 2 y creó %s', v_n);
  assert (select count(*) from ordenes_produccion where pedido_linea_id = v_lin and estado <> 'cancelada') = 2
     and (select count(*) from ordenes_produccion where pedido_linea_id = v_lin2) = 1, 'las órdenes no quedaron en sus partidas';

  -- Y si de verdad se quiere fabricar otro habiendo stock, se dice y se crea.
  perform pg_temp.como_postgres();
  update pedido_lineas set cantidad = 2 where id = v_lin2;
  perform pg_temp.como(v_gp);
  perform crear_orden_produccion(v_eq2, 1);
  begin v_n := ordenes_desde_pedido(v_ped); v_ok := true; exception when raise_exception then v_ok := false; end;
  assert not v_ok, 'no avisó de la tolva de stock';
  v_n := ordenes_desde_pedido(v_ped, true);
  assert v_n = 1 and (select count(*) from ordenes_produccion where pedido_linea_id = v_lin2) = 2, format('fabricar nuevos: %s', v_n);
end $$;

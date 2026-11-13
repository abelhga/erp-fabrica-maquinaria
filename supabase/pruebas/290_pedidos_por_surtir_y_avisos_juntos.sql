-- Pedidos por surtir: almacén ve cada partida de componente con hay / pedido / falta, sin precios;
-- cada vendedor ve solo los suyos; «Pedir a compras» levanta una requisición solo con lo que falta y no la repite; ventas de otro
-- vendedor no la puede pedir. Y los ajustes de un conteo avisan una sola vez por conteo.
do $$
declare v_alm uuid; v_ven uuid; v_otro uuid; v_ger uuid; v_cli uuid; v_ped uuid; v_hay uuid; v_falta uuid; v_pb int;
        r jsonb; v_ok boolean; v_conteo uuid; v_art uuid;
begin
  v_alm := pg_temp.usuario('alm290@hegamex.com', '{almacen}');
  v_ven := pg_temp.usuario('ven290@hegamex.com', '{ventas}');
  v_otro := pg_temp.usuario('otro290@hegamex.com', '{ventas}');
  v_ger := pg_temp.usuario('ger290@hegamex.com', '{gerente_produccion}');
  select id into v_pb from almacenes where nombre = 'Planta Baja';
  insert into articulos (clave, tipo, nombre, unidad) values ('H290', 'componente', 'Banda grip 290', 'metro') returning id into v_hay;
  insert into articulos (clave, tipo, nombre, unidad) values ('F290', 'componente', 'Banda blanca 290', 'metro') returning id into v_falta;
  insert into movimientos_inventario (tipo, articulo_id, almacen_id, cantidad, motivo) values ('inicial', v_hay, v_pb, 30, 'T290'), ('inicial', v_falta, v_pb, 4, 'T290');
  insert into clientes (nombre, vendedor_id) values ('Cliente 290', v_ven) returning id into v_cli;
  insert into pedidos (cliente_id, vendedor_id, canal, estado, fecha, fecha_compromiso)
  values (v_cli, v_ven, 'directo', 'confirmado', hoy_mx(), hoy_mx() + 5) returning id into v_ped;
  insert into pedido_lineas (pedido_id, articulo_id, titulo, cantidad, precio_unitario)
  values (v_ped, v_hay, 'Banda grip 290', 12, 100), (v_ped, v_falta, 'Banda blanca 290', 10, 100);

  -- Almacén lo ve: una partida hay, la otra falta (hay 4 de 10).
  perform pg_temp.como(v_alm);
  assert (select situacion from pedidos_por_surtir() where pedido_id = v_ped and articulo_id = v_hay) = 'hay', 'la que hay no dice hay';
  assert (select situacion from pedidos_por_surtir() where pedido_id = v_ped and articulo_id = v_falta) = 'falta', 'la que falta no dice falta';

  -- Otro vendedor no pide material para un pedido ajeno.
  perform pg_temp.como(v_otro);
  begin perform pedir_material_pedido(v_ped); v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'otro vendedor pidió material de un pedido ajeno';

  -- Almacén lo pide: una requisición con solo los 6 que faltan, y ya no se repite.
  perform pg_temp.como(v_alm);
  r := pedir_material_pedido(v_ped);
  assert (r->>'partidas')::int = 1, 'pidió partidas de más';
  assert (select rl.cantidad from requisicion_lineas rl where rl.requisicion_id = (r->>'id')::uuid) = 6, 'no pidió solo lo que falta';
  assert (select necesaria_para from requisiciones where id = (r->>'id')::uuid) = hoy_mx() + 5, 'sin la fecha del pedido';
  assert (select situacion from pedidos_por_surtir() where pedido_id = v_ped and articulo_id = v_falta) = 'pedido', 'no dice que ya se pidió';
  begin perform pedir_material_pedido(v_ped); v_ok := true; exception when raise_exception then v_ok := false; end;
  assert not v_ok, 'pidió dos veces lo mismo';

  -- El vendedor ve sus pedidos; otro vendedor no los ve.
  perform pg_temp.como(v_ven);
  assert exists (select 1 from pedidos_por_surtir() where pedido_id = v_ped), 'el vendedor no ve su pedido';
  perform pg_temp.como(v_otro);
  assert not exists (select 1 from pedidos_por_surtir() where pedido_id = v_ped), 'otro vendedor ve un pedido ajeno';

  -- Avisos de un conteo: tres ajustes resueltos, un solo aviso que dice cuántos.
  perform pg_temp.como_postgres();
  for i in 1..3 loop
    insert into articulos (clave, tipo, nombre, unidad) values ('A290-' || i, 'componente', 'Pieza 290 ' || i, 'pieza') returning id into v_art;
    insert into movimientos_inventario (tipo, articulo_id, almacen_id, cantidad, motivo) values ('inicial', v_art, v_pb, 10, 'T290');
  end loop;
  perform pg_temp.como(v_alm);
  insert into conteos (nombre, almacen_id) values ('Conteo 290', v_pb) returning id into v_conteo;
  insert into conteo_lineas (conteo_id, articulo_id, cantidad_contada)
  select v_conteo, id, 9 from articulos where clave like 'A290-%';
  perform cerrar_conteo(v_conteo);
  perform pg_temp.como(v_ger);
  perform resolver_ajuste(a.id, a.clave <> 'A290-3', 'T290') from (select aj.id, ar.clave from ajustes_inventario aj join articulos ar on ar.id = aj.articulo_id where aj.conteo_id = v_conteo) a;
  perform pg_temp.como_postgres();
  assert (select count(*) from avisos where usuario_id = v_alm and tipo in ('ajuste_aprobado', 'ajuste_rechazado')
          and registro_id in (select id::text from ajustes_inventario where conteo_id = v_conteo)) = 0, 'siguió avisando uno por uno';
  assert (select count(*) from avisos where usuario_id = v_alm and tipo = 'ajustes_de_conteo' and registro_id = v_conteo::text) = 1, 'no quedó un solo aviso';
  assert (select titulo from avisos where usuario_id = v_alm and tipo = 'ajustes_de_conteo' and registro_id = v_conteo::text)
         like '%2 aprobado(s), 1 rechazado(s)%', 'el aviso no dice cuántos';
end $$;

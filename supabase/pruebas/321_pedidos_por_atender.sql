-- Cada pedido sabe qué le falta y a quién le toca: almacén entrega lo que hay, compras pide lo que falta
-- (y deja de tocarle en cuanto hay requisición), producción crea la orden del equipo, el vendedor liga
-- la partida a mano o consigue el anticipo. El numerito es de cada área; un vendedor no ve pedidos
-- ajenos; el aviso es uno al día por persona.
do $$
declare v_alm uuid; v_com uuid; v_gp uuid; v_ven uuid; v_otro uuid; v_cli uuid; v_ped uuid; v_ped2 uuid; v_hay uuid; v_falta uuid; v_eq uuid; v_pb int;
        r jsonb; v_n int;
begin
  v_alm := pg_temp.usuario('alm321@hegamex.com', '{almacen}');
  v_com := pg_temp.usuario('com321@hegamex.com', '{compras}');
  v_gp := pg_temp.usuario('gp321@hegamex.com', '{gerente_produccion}');
  v_ven := pg_temp.usuario('ven321@hegamex.com', '{ventas}');
  v_otro := pg_temp.usuario('otro321@hegamex.com', '{ventas}');
  select id into v_pb from almacenes where nombre = 'Planta Baja';
  insert into articulos (clave, tipo, nombre, unidad) values ('H321', 'componente', 'Banda grip 321', 'metro') returning id into v_hay;
  insert into articulos (clave, tipo, nombre, unidad) values ('F321', 'componente', 'Banda medias lunas 321', 'metro') returning id into v_falta;
  insert into articulos (clave, tipo, nombre) values ('E321', 'equipo', 'Cribadora 321') returning id into v_eq;
  insert into movimientos_inventario (tipo, articulo_id, almacen_id, cantidad, motivo) values ('inicial', v_hay, v_pb, 30, 'T321');
  insert into clientes (nombre, vendedor_id) values ('Cliente 321', v_ven) returning id into v_cli;
  -- Un pedido de hace 5 días hábiles con de todo.
  insert into pedidos (cliente_id, vendedor_id, canal, estado, fecha, condiciones_pago)
  values (v_cli, v_ven, 'directo', 'confirmado', hoy_mx(), 'Contado') returning id into v_ped;
  update pedidos set creado_en = now() - interval '10 days' where id = v_ped;
  insert into pedido_lineas (pedido_id, articulo_id, titulo, cantidad, precio_unitario) values
    (v_ped, v_hay, 'Banda grip 321', 12, 100), (v_ped, v_falta, 'Banda medias lunas 321', 22, 100), (v_ped, v_eq, 'Cribadora 321', 1, 1000),
    (v_ped, null, 'Banda para tarimas 321 de 1 x 9 m', 1, 900);
  -- Otro que pide anticipo y no tiene cobro: solo le toca al vendedor.
  insert into pedidos (cliente_id, vendedor_id, canal, estado, fecha, condiciones_pago)
  values (v_cli, v_ven, 'directo', 'confirmado', hoy_mx(), '50% de anticipo y 50% contra entrega') returning id into v_ped2;
  insert into pedido_lineas (pedido_id, articulo_id, titulo, cantidad, precio_unitario) values (v_ped2, v_falta, 'Banda medias lunas 321', 5, 100);

  perform pg_temp.como(v_ven);
  select jsonb_object_agg(area || ':' || accion, atrasado) into r from pedidos_por_atender() where pedido_id = v_ped;
  assert r ? 'almacen:Entregar lo que ya hay' and r ? 'compras:Comprar lo que falta' and r ? 'produccion:Crear la orden de producción'
     and r ? 'ventas:Ligar al catálogo', format('faltan áreas: %s', r);
  assert (r->>'almacen:Entregar lo que ya hay')::boolean and (r->>'compras:Comprar lo que falta')::boolean, format('5 días y no está atrasado: %s', r);
  select jsonb_agg(area || ':' || accion) into r from pedidos_por_atender() where pedido_id = v_ped2;
  assert r = '["ventas:Conseguir el anticipo"]'::jsonb, format('el de anticipo alarmó a otras áreas: %s', r);

  -- El otro vendedor no ve nada de esto.
  perform pg_temp.como(v_otro);
  assert not exists (select 1 from pedidos_por_atender() where pedido_id in (v_ped, v_ped2)), 'un vendedor vio pedidos ajenos';

  -- El numerito de cada área.
  perform pg_temp.como(v_alm);
  assert (mis_pedidos_por_atender()->>'total')::int >= 1, 'almacén no ve lo que tiene que entregar';
  perform pg_temp.como(v_com);
  v_n := (mis_pedidos_por_atender()->>'total')::int;
  assert v_n >= 1, 'compras no ve lo que tiene que comprar';
  perform pg_temp.como(v_gp);
  assert (mis_pedidos_por_atender()->>'total')::int >= 1, 'producción no ve el equipo sin orden';

  -- Compras levanta la requisición: ya no le toca (lo que viene en camino no es pendiente de nadie).
  perform pg_temp.como(v_com);
  perform pedir_material_pedido(v_ped);
  assert not exists (select 1 from pedidos_por_atender() where pedido_id = v_ped and area = 'compras'), 'con requisición, siguió siendo de compras';

  -- El aviso: uno por persona al día, aunque se corra dos veces.
  perform pg_temp.como_postgres();
  perform avisar_pedidos_por_atender();
  perform avisar_pedidos_por_atender();
  assert (select count(*) from avisos where usuario_id = v_alm and tipo = 'pedidos_por_atender' and creado_en::date = hoy_planta()) = 1, 'almacén recibió avisos repetidos';
  assert (select count(*) from avisos where usuario_id = v_ven and tipo = 'pedidos_por_atender') = 1, 'el vendedor no recibió su aviso';
  assert (select ruta from avisos where usuario_id = v_alm and tipo = 'pedidos_por_atender') = '/produccion/pedidos?filtro=atender', 'almacén abre otra pantalla';
end $$;

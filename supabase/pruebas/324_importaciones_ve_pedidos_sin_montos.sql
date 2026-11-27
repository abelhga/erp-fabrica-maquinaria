-- Importaciones ve los pedidos de la planta (sin montos), con lo que se vendió, para hacer los
-- manuales; no ve los montos (v_pedidos) ni las partidas con precio, y no puede entregar. Un
-- vendedor sigue sin ver pedidos ajenos.
do $$
declare v_imp uuid; v_ven uuid; v_otro uuid; v_cli uuid; v_ped uuid; v_art uuid; v_ok boolean;
begin
  v_imp := pg_temp.usuario('imp324@hegamex.com', '{importaciones}');
  v_ven := pg_temp.usuario('ven324@hegamex.com', '{ventas}');
  v_otro := pg_temp.usuario('otro324@hegamex.com', '{ventas}');
  insert into articulos (clave, tipo, nombre) values ('T324', 'componente', 'Cangilón 324') returning id into v_art;
  insert into clientes (nombre, vendedor_id) values ('Cliente 324', v_ven) returning id into v_cli;
  insert into pedidos (cliente_id, vendedor_id, canal, estado, fecha, condiciones_pago) values (v_cli, v_ven, 'directo', 'confirmado', hoy_mx(), 'Contado') returning id into v_ped;
  insert into pedido_lineas (pedido_id, articulo_id, titulo, cantidad, precio_unitario) values (v_ped, v_art, 'Cangilón 324', 3, 1000);

  perform pg_temp.como(v_imp);
  assert exists (select 1 from v_pedidos_produccion where id = v_ped), format('importaciones no ve el pedido de la planta (basicos %s, sin_montos %s)', (select count(*) from pedidos_basicos() where id = v_ped), ve_pedidos_sin_montos());
  assert (select cliente from v_pedidos_produccion where id = v_ped) = 'Cliente 324', format('sin cliente: %s', (select cliente from v_pedidos_produccion where id = v_ped));
  assert (select jsonb_array_length(partidas) from v_pedidos_produccion where id = v_ped) = 1, 'importaciones no ve lo que se vendió';
  assert not exists (select 1 from v_pedidos where id = v_ped), 'importaciones ve el pedido con montos';
  assert not exists (select 1 from pedido_lineas where pedido_id = v_ped), 'importaciones ve las partidas con precio';
  begin perform entregar_pedido(v_ped); v_ok := true; exception when others then v_ok := false; end;
  assert not v_ok, 'importaciones pudo entregar';

  perform pg_temp.como(v_otro);
  assert not exists (select 1 from v_pedidos_produccion where id = v_ped), 'un vendedor ve los pedidos de otro';
end $$;

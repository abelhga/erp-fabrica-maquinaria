-- Una venta de Mercado Libre no le avisa a producción ni a almacén; un pedido directo, sí.
do $$
declare v_vend uuid; v_alm uuid; v_ger uuid; v_cli uuid; v_ml uuid; v_dir uuid;
begin
  v_vend := pg_temp.usuario('vend179@hegamex.com', '{ventas}');
  v_alm := pg_temp.usuario('alm179@hegamex.com', '{almacen}');
  v_ger := pg_temp.usuario('gp179@hegamex.com', '{gerente_produccion}');
  insert into clientes (nombre, vendedor_id) values ('Cliente 179', v_vend) returning id into v_cli;
  insert into pedidos (cliente_id, vendedor_id, canal, id_externo) values (v_cli, v_vend, 'mercadolibre', 'T179-ML') returning id into v_ml;
  insert into pedidos (cliente_id, vendedor_id, canal) values (v_cli, v_vend, 'directo') returning id into v_dir;
  assert not exists (select 1 from avisos where tipo = 'pedido_nuevo' and registro_id = v_ml::text), 'una venta de ML le avisó a producción o almacén';
  assert exists (select 1 from avisos where usuario_id = v_ger and tipo = 'pedido_nuevo' and registro_id = v_dir::text), 'la gerencia ya no supo de un pedido directo';
  assert exists (select 1 from avisos where usuario_id = v_alm and tipo = 'pedido_nuevo' and registro_id = v_dir::text), 'almacén ya no supo de un pedido directo';
end $$;

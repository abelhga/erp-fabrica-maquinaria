-- El proveedor del embarque: sale de sus órdenes de compra si las tiene, y si no,
-- del que se capturó en el embarque (los que venían en camino al arrancar el ERP).
do $$
declare v_imp uuid; v_ven uuid; v_p1 uuid; v_p2 uuid; v_emb uuid; v_oc uuid; v_prov text;
begin
  v_imp := pg_temp.usuario('imp93@hegamex.com', '{importaciones}');
  v_ven := pg_temp.usuario('ven93@hegamex.com', '{ventas}');
  insert into proveedores (nombre, pais, es_importacion, moneda) values ('T93 Shandong Tavol', 'China', true, 'USD') returning id into v_p1;
  insert into proveedores (nombre, pais, es_importacion, moneda) values ('T93 Yao Han', 'Taiwán', true, 'USD') returning id into v_p2;

  perform pg_temp.como(v_imp);
  insert into embarques (descripcion, modalidad, proveedor_id) values ('T93 Grúa viajera', 'fcl', v_p1) returning id into v_emb;
  select proveedores into v_prov from v_embarques where id = v_emb;
  assert v_prov = 'T93 Shandong Tavol', format('sin orden, el proveedor debía salir del embarque: %s', v_prov);

  -- Con una orden ligada manda la orden (un consolidado puede traer varios).
  perform pg_temp.como_postgres();
  insert into ordenes_compra (proveedor_id, moneda, tipo_cambio) values (v_p2, 'USD', 18) returning id into v_oc;
  insert into embarque_oc (embarque_id, orden_compra_id) values (v_emb, v_oc);
  perform pg_temp.como(v_imp);
  select proveedores into v_prov from v_embarques where id = v_emb;
  assert v_prov = 'T93 Yao Han', format('con orden, el proveedor debía salir de la orden: %s', v_prov);

  -- Ventas sigue sin ver embarques.
  perform pg_temp.como(v_ven);
  assert not exists (select 1 from v_embarques where id = v_emb), 'ventas vio un embarque';
  begin
    update embarques set proveedor_id = v_p2 where id = v_emb;
    assert not found, 'ventas cambió el proveedor de un embarque';
  exception when insufficient_privilege then null;
  end;
end $$;

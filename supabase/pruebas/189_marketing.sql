-- Marketing: ve el catálogo con precio de lista, todos los leads y Mercado Libre (contesta y liga),
-- pero no clientes, cotizaciones, pedidos, costos, márgenes ni el dinero de ML. Ventas sigue
-- viendo Mercado Libre igual que antes, y quien no tiene ni ventas ni ML no lo ve.
do $$
declare v_mkt uuid; v_ven uuid; v_alm uuid; v_art uuid; v_ped uuid; v_ok boolean;
begin
  v_mkt := pg_temp.usuario('mkt189@hegamex.com', '{marketing}');
  v_ven := pg_temp.usuario('ven189@hegamex.com', '{ventas}');
  v_alm := pg_temp.usuario('alm189@hegamex.com', '{almacen}');
  update configuracion set valor = jsonb_set(coalesce(valor, '{}'), '{ventas_activas}', 'true') where clave = 'mercadolibre';
  insert into articulos (clave, tipo, nombre, unidad) values ('T189-POL', 'componente', 'Polea 189', 'pieza') returning id into v_art;
  perform ml_registrar_pregunta('{"id": 9189001, "item_id": "MLM189", "titulo": "Polea", "texto": "¿Hay de 6?", "estado": "UNANSWERED", "fecha": "2026-10-28T10:00:00Z"}');
  v_ped := ml_registrar_orden('{"id": "T189-1", "estado": "paid", "items": [{"item_id": "MLM189B", "titulo": "Polea 189", "cantidad": 1, "precio": 116}],
    "pagos": [{"id": "P189", "estado": "approved", "total": 116, "neto": 90, "completo": true, "cargos": []}]}');

  perform pg_temp.como(v_mkt);
  assert puede('catalogo', 1) and puede('leads', 3) and puede('mercadolibre', 2), 'marketing no tiene lo suyo';
  assert not puede('ventas', 1) and not puede('costos', 1) and not puede('margenes', 1) and not puede('finanzas', 1), 'marketing tiene de más';
  assert ve_precios_venta(), 'marketing no ve precios de lista';
  assert exists (select 1 from ml_preguntas where id = 9189001), 'marketing no ve las preguntas de ML';
  assert exists (select 1 from ml_publicaciones_sin_ligar where item_id = 'MLM189B'), 'marketing no ve lo que falta ligar';
  assert (estado_mercadolibre()->>'sin_ligar')::int >= 1, 'marketing no ve el estado de ML';
  assert not exists (select 1 from ml_pagos where order_id = 'T189-1'), 'marketing ve el dinero de ML';
  assert not exists (select 1 from pedidos where id = v_ped), 'marketing ve pedidos';
  assert not exists (select 1 from cobros where pedido_id = v_ped), 'marketing ve cobros';
  assert not exists (select 1 from cotizaciones limit 1), 'marketing ve cotizaciones';
  assert not exists (select 1 from costos_articulo limit 1), 'marketing ve costos';
  perform ml_ligar_publicacion('MLM189B', v_art, 1);
  assert not exists (select 1 from ml_publicaciones_sin_ligar where item_id = 'MLM189B'), 'marketing no pudo ligar';

  -- Ventas sigue igual; almacén (sin ventas ni ML) no ve preguntas ni estado.
  perform pg_temp.como(v_ven);
  assert exists (select 1 from ml_preguntas where id = 9189001), 'ventas dejó de ver las preguntas';
  assert exists (select 1 from ml_pagos where order_id = 'T189-1'), 'ventas dejó de ver el dinero de ML';
  perform pg_temp.como(v_alm);
  assert not exists (select 1 from ml_preguntas where id = 9189001), 'almacén ve las preguntas de ML';
  begin perform estado_mercadolibre(); v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'almacén ve el estado de ML';
  perform pg_temp.como_postgres();

  assert exists (select 1 from invitaciones where correo = 'adriana.barragan@hegamex.com' and roles = '{marketing}')
      or exists (select 1 from perfiles p join usuario_roles r on r.usuario_id = p.id where p.correo = 'adriana.barragan@hegamex.com' and r.rol = 'marketing'),
    'Adriana no quedó invitada como marketing';
end $$;

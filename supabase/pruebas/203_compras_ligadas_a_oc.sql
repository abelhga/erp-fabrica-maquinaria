-- Una factura de proveedor se liga a su orden de compra y de ahí sale en qué se gastó: cada partida
-- por su artículo (consumible del taller → fabricación, inventario → material, sin artículo → la
-- categoría de la factura). Sin orden la categoría es obligatoria. Se liga sola por folio, en los dos
-- sentidos, y una orden con su factura ya no cuenta dos veces en lo que se debe.
do $$
declare
  v_fin uuid; v_com uuid; v_ven uuid; v_prov uuid; v_otro uuid; v_sin uuid;
  v_cat int; v_cons uuid; v_mat uuid; v_serv uuid;
  v_oc uuid; v_oc2 uuid; v_oc3 uuid; v_oc4 uuid; v_ajena uuid;
  v_m uuid; v_m2 uuid; v_m3 uuid; v_m4 uuid;
  d date := hoy_planta(); r0 jsonb; r1 jsonb; v_ok boolean; v_n int;
begin
  -- Las llaves de folio: el número casa aunque cambien letras, guiones y ceros a la izquierda.
  assert folios_casan('F0175226', '0175226'), 'F0175226 y 0175226 son la misma';
  assert folios_casan('A-0896', 'a896'), 'A-0896 y a896 son la misma';
  assert not folios_casan('S/F', 'S/F'), 'dos «S/F» no son la misma factura';
  assert not folios_casan('12', 'F-12'), 'con dos dígitos casaría cualquier cosa';
  assert not folios_casan('F-2408', '2402'), 'folios distintos';

  v_fin := pg_temp.usuario('fin203@hegamex.com', '{finanzas}');
  v_com := pg_temp.usuario('com203@hegamex.com', '{compras}');
  v_ven := pg_temp.usuario('ven203@hegamex.com', '{ventas}');
  insert into proveedores (nombre, rfc, categoria) values ('T203 Fletes y Ferretería', 'TFF010101AA1', 'Fletes y paquetería (ambos)') returning id into v_prov;
  insert into proveedores (nombre, rfc, categoria) values ('T203 Repetido', 'TFF010101AA1', null) returning id into v_otro;
  insert into proveedores (nombre) values ('T203 Sin categoría') returning id into v_sin;
  insert into categorias (nombre, consumible_taller) values ('T203 Discos', true) returning id into v_cat;
  insert into articulos (clave, tipo, nombre, categoria_id) values ('T203-DISCO', 'componente', 'Disco de corte 203', v_cat) returning id into v_cons;
  insert into articulos (clave, tipo, nombre) values ('T203-PTR', 'materia_prima', 'PTR 203') returning id into v_mat;
  insert into articulos (clave, tipo, nombre, controla_inventario) values ('T203-SERV', 'servicio', 'Maquinado 203', false) returning id into v_serv;

  -- OC con consumible ($1,000), material ($3,000), un servicio ($500) y un flete sin artículo ($500).
  insert into ordenes_compra (proveedor_id, estado) values (v_prov, 'enviada') returning id into v_oc;
  insert into oc_lineas (orden_compra_id, articulo_id, descripcion, cantidad, costo_unitario) values
    (v_oc, v_cons, null, 10, 100), (v_oc, v_mat, null, 1, 3000), (v_oc, v_serv, null, 1, 500), (v_oc, null, 'Flete', 1, 500);
  insert into ordenes_compra (proveedor_id, estado, factura_proveedor) values (v_prov, 'recibida', 'F0099123') returning id into v_oc2;
  insert into oc_lineas (orden_compra_id, articulo_id, cantidad, costo_unitario) values (v_oc2, v_mat, 1, 1000);
  insert into ordenes_compra (proveedor_id, estado) values (v_otro, 'parcial') returning id into v_oc3;
  insert into oc_lineas (orden_compra_id, articulo_id, cantidad, costo_unitario) values (v_oc3, v_cons, 1, 200);
  insert into ordenes_compra (proveedor_id, estado) values (v_prov, 'recibida') returning id into v_oc4;
  insert into oc_lineas (orden_compra_id, articulo_id, cantidad, costo_unitario) values (v_oc4, v_mat, 1, 700);
  insert into ordenes_compra (proveedor_id, estado) values (v_sin, 'enviada') returning id into v_ajena;
  insert into oc_lineas (orden_compra_id, articulo_id, cantidad, costo_unitario) values (v_ajena, v_mat, 1, 100);

  perform pg_temp.como(v_fin);
  r0 := resultados_periodo(d, d);
  -- Las dos recibidas están por pagar mientras no tengan factura.
  assert (select count(*) from v_por_pagar where orden_compra_id in (v_oc2, v_oc4)) = 2, 'las órdenes recibidas no estaban por pagar';

  -- 1. Factura de $5,800 con IVA ($5,000) ligada a la orden: se reparte por partida.
  v_m := registrar_movimiento_proveedor(p_proveedor => v_prov, p_tipo => 'compra', p_monto => 5800, p_factura => 'A-77', p_ordenes => array[v_oc]);
  assert (select como from compra_oc where movimiento_id = v_m and orden_compra_id = v_oc) = 'a_mano', 'no quedó ligada';
  r1 := resultados_periodo(d, d);
  assert exists (select 1 from jsonb_array_elements(r1->'fabricacion') x where x->>'categoria' = 'Consumibles del taller'
                 and (x->>'importe')::numeric - coalesce((select (y->>'importe')::numeric from jsonb_array_elements(r0->'fabricacion') y where y->>'categoria' = 'Consumibles del taller'), 0) = 1000),
    format('el consumible no fue a fabricación: %s', r1->'fabricacion');
  assert (r1->>'material_comprado')::numeric - (r0->>'material_comprado')::numeric = 3000, 'el material no quedó como material';
  -- El servicio y el flete toman la categoría de la factura (la del proveedor).
  assert (select (x->>'importe')::numeric from jsonb_array_elements(r1->'operacion') x where x->>'categoria' = 'Fletes y paquetería (ambos)')
         - coalesce((select (x->>'importe')::numeric from jsonb_array_elements(r0->'operacion') x where x->>'categoria' = 'Fletes y paquetería (ambos)'), 0) = 1000,
    format('servicio y flete: %s', r1->'operacion');
  assert (r1#>>'{compras_erp,con_orden}')::numeric - (r0#>>'{compras_erp,con_orden}')::numeric = 5000, 'desglose con orden';
  assert (r1#>>'{compras_erp,sin_articulo}')::numeric - (r0#>>'{compras_erp,sin_articulo}')::numeric = 500, 'desglose sin artículo';
  assert (select compras from categorias_compra_periodo(d, d) where categoria = 'consumibles del taller') >= 1, 'la lista de categorías no la cuenta';

  -- 2. Sin orden y sin categoría no entra; con categoría, sí, entera.
  begin
    perform registrar_movimiento_proveedor(p_proveedor => v_sin, p_tipo => 'compra', p_monto => 100, p_factura => 'Z-1');
    v_ok := true;
  exception when invalid_parameter_value then v_ok := false;
  end;
  assert not v_ok, 'entró una compra sin orden ni categoría';
  v_m2 := registrar_movimiento_proveedor(p_proveedor => v_sin, p_tipo => 'compra', p_monto => 116, p_factura => 'Z-1', p_categoria => 'Publicidad');
  assert not exists (select 1 from compra_oc where movimiento_id = v_m2), 'se ligó sola sin casar';
  -- Una orden de otro proveedor no se le liga.
  begin
    perform ligar_compra_oc(v_m2, array[v_oc]);
    v_ok := true;
  exception when invalid_parameter_value then v_ok := false;
  end;
  assert not v_ok, 'se ligó a una orden de otro proveedor';

  -- 3. Se liga sola por folio: la orden ya traía la factura de almacén (F0099123)...
  v_m3 := registrar_movimiento_proveedor(p_proveedor => v_prov, p_tipo => 'compra', p_monto => 1160, p_factura => '99123');
  assert (select como from compra_oc where movimiento_id = v_m3 and orden_compra_id = v_oc2) = 'folio', 'no casó por folio';
  -- ...y al revés: la factura se registró primero (con el otro registro del mismo RFC) y almacén captura el folio después.
  v_m4 := registrar_movimiento_proveedor(p_proveedor => v_prov, p_tipo => 'compra', p_monto => 232, p_factura => '55501', p_categoria => 'Ferreteria en general');
  assert not exists (select 1 from compra_oc where movimiento_id = v_m4), 'se ligó antes de tiempo';
  perform pg_temp.como(v_com);
  update ordenes_compra set factura_proveedor = 'F-55501' where id = v_oc3;
  assert exists (select 1 from compra_oc where movimiento_id = v_m4 and orden_compra_id = v_oc3 and como = 'folio'), 'no se ligó al capturar el folio en la orden';

  -- 4. La orden con su factura ya no está por pagar (la deuda está en la factura); la otra, sí.
  perform pg_temp.como(v_fin);
  assert not exists (select 1 from v_por_pagar where orden_compra_id = v_oc2), 'la orden facturada contó dos veces';
  assert exists (select 1 from v_por_pagar where orden_compra_id = v_oc4), 'la orden sin factura dejó de estar por pagar';

  -- 5. Elegir de qué órdenes es: la que casa por folio sale primero; la ligada dice ligada.
  assert (select casa_folio from ordenes_para_ligar(v_prov, 'F-99123', 1160) limit 1), 'la que casa por folio no salió primero';
  assert (select ligada from ordenes_para_ligar(v_prov, 'A-77', 5800, v_m) where id = v_oc), 'no dice que ya está ligada';
  assert (select facturada from ordenes_para_ligar(v_prov, null, null, v_m) where id = v_oc2), 'no dice que ya tiene otra factura';
  assert not exists (select 1 from ordenes_para_ligar(v_prov) where id = v_ajena), 'ofreció la orden de otro proveedor';
  -- Cambiar las ligas: la lista que llega es la que queda; sin orden hace falta categoría.
  v_n := ligar_compra_oc(v_m, array[v_oc, v_oc4]);
  assert v_n = 2 and (select count(*) from compra_oc where movimiento_id = v_m) = 2, 'no quedaron las dos';
  perform ligar_compra_oc(v_m, '{}', 'Fletes y paquetería (ambos)');
  assert not exists (select 1 from compra_oc where movimiento_id = v_m), 'no se desligó';
  -- Con orden, una compra de un proveedor sin categoría sí entra; desligarla pide la categoría.
  v_m2 := registrar_movimiento_proveedor(p_proveedor => v_otro, p_tipo => 'compra', p_monto => 232, p_factura => 'B-2', p_ordenes => array[v_oc3]);
  assert (select categoria from movimientos_proveedor where id = v_m2) is null, 'le inventó categoría';
  begin
    perform ligar_compra_oc(v_m2, '{}');
    v_ok := true;
  exception when invalid_parameter_value then v_ok := false;
  end;
  assert not v_ok, 'quedó una compra sin orden ni categoría';
  perform ligar_compra_oc(v_m, array[v_oc]);

  -- 6. Desde la orden: finanzas ve la factura con su monto; compras, el folio sin monto.
  assert (select monto from facturas_de_oc(v_oc)) = 5800, 'finanzas no ve el monto de la factura';
  perform pg_temp.como(v_com);
  assert (select factura = 'A-77' and monto is null from facturas_de_oc(v_oc)), 'compras vio el monto o no vio la factura';
  assert exists (select 1 from compra_oc where orden_compra_id = v_oc), 'compras no sabe si la orden tiene factura';
  begin perform ligar_compra_oc(v_m, '{}', 'Aceros'); v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'compras cambió las ligas de finanzas';
  begin perform ordenes_para_ligar(v_prov); v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'compras usó la búsqueda de finanzas';

  -- 7. Ventas no ve nada de esto.
  perform pg_temp.como(v_ven);
  assert not exists (select 1 from compra_oc), 'ventas ve qué facturas tiene cada orden';
  assert not exists (select 1 from facturas_de_oc(v_oc)), 'ventas vio las facturas de una orden';
  perform pg_temp.como_postgres();
end $$;

-- Un pedido con envío abierto no se entrega desde el pedido; «¿Quién lo recibe?» trae a todo el
-- personal activo; compras liga una requisición a una orden de compra que ya existía.
do $$
declare v_alm uuid; v_ven uuid; v_comp uuid; v_art uuid; v_otro uuid; v_cli uuid; v_ped uuid; v_env uuid; v_prov uuid;
  v_req uuid; v_rl uuid; v_rl2 uuid; v_oc uuid; v_ocl uuid; v_ocl_otro uuid; v_pb int; h jsonb; v_ok boolean; v_msg text;
begin
  v_alm := pg_temp.usuario('alm283@hegamex.com', '{almacen}');
  v_ven := pg_temp.usuario('ven283@hegamex.com', '{ventas}');
  v_comp := pg_temp.usuario('comp283@hegamex.com', '{compras}');
  select id into v_pb from almacenes where nombre = 'Planta Baja';
  insert into articulos (clave, tipo, nombre, unidad) values ('P283-TONER', 'componente', 'Tóner 283', 'pieza') returning id into v_art;
  insert into articulos (clave, tipo, nombre, unidad) values ('P283-OTRO', 'componente', 'Otro 283', 'pieza') returning id into v_otro;
  insert into movimientos_inventario (tipo, articulo_id, almacen_id, cantidad) values ('inicial', v_art, v_pb, 10);

  -- 1. Pedido con envío «el cliente recoge» abierto: «Entregar» del pedido se niega y dice cuál.
  insert into clientes (nombre, vendedor_id) values ('Cliente 283', v_ven) returning id into v_cli;
  insert into pedidos (cliente_id, vendedor_id, estado) values (v_cli, v_ven, 'confirmado') returning id into v_ped;
  insert into pedido_lineas (pedido_id, articulo_id, titulo, cantidad, precio_unitario) values (v_ped, v_art, 'Tóner 283', 1, 500);
  insert into envios (pedido_id, tipo, solicitado_por) values (v_ped, 'recoge', v_ven) returning id into v_env;

  perform pg_temp.como(v_alm);
  h := hoja_salida(v_ped);
  assert jsonb_array_length(h->'envios_abiertos') = 1 and h->'envios_abiertos'->0->>'id' = v_env::text, 'la hoja de salida no trae el envío abierto';
  begin perform entregar_pedido(v_ped, 'Diego Tirado'); v_ok := true;
  exception when check_violation then v_ok := false; v_msg := sqlerrm; end;
  assert not v_ok, 'entregó desde el pedido con un envío abierto';
  assert v_msg like '%' || (select folio from envios where id = v_env) || '%Envíos%', 'el mensaje no dice qué envío ni a dónde ir: ' || coalesce(v_msg, '');
  perform pg_temp.como_postgres();
  assert (select cantidad from existencias where articulo_id = v_art and almacen_id = v_pb) = 10, 'descontó inventario aunque se negó';

  -- Cancelado el envío, ya se entrega desde el pedido.
  update envios set estado = 'cancelado', motivo_cancelacion = 'Prueba' where id = v_env;
  perform pg_temp.como(v_alm);
  assert jsonb_array_length(hoja_salida(v_ped)->'envios_abiertos') = 0, 'un envío cancelado sigue como abierto';
  perform entregar_pedido(v_ped, 'Diego Tirado');
  perform pg_temp.como_postgres();
  assert (select estado from pedidos where id = v_ped) = 'entregado', 'no se entregó sin envío abierto';

  -- 2. «¿Quién lo recibe?»: alguien de oficina (no está en cuadrillas) aparece; ventas no lo pide.
  insert into empleados (nombre, fecha_ingreso, en_cuadrillas, activo) values ('Oficina 283', '2020-01-01', false, true);
  insert into empleados (nombre, fecha_ingreso, en_cuadrillas, activo, baja_en, motivo_baja) values ('Baja 283', '2020-01-01', false, false, '2026-01-01', 'Prueba');
  perform pg_temp.como(v_alm);
  assert exists (select 1 from quien_recibe_material() where nombre = 'Oficina 283'), 'no sale el personal de oficina';
  assert not exists (select 1 from quien_recibe_material() where nombre = 'Baja 283'), 'sale alguien dado de baja';
  perform pg_temp.como(v_ven);
  begin perform quien_recibe_material(); v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'ventas pidió la lista del personal';

  -- 3. Requisición de almacén y una orden de compra que compras ya había hecho.
  perform pg_temp.como_postgres();
  insert into proveedores (nombre) values ('T283 Papelería') returning id into v_prov;
  insert into requisiciones (origen, solicitante_id) values ('manual', v_alm) returning id into v_req;
  insert into requisicion_lineas (requisicion_id, articulo_id, cantidad) values (v_req, v_art, 4) returning id into v_rl;
  insert into requisicion_lineas (requisicion_id, articulo_id, cantidad) values (v_req, v_otro, 1) returning id into v_rl2;
  insert into ordenes_compra (proveedor_id, moneda, tipo_cambio) values (v_prov, 'MXN', 1) returning id into v_oc;
  insert into oc_lineas (orden_compra_id, articulo_id, descripcion, cantidad, costo_unitario) values (v_oc, v_art, 'Tóner 283', 5, 300) returning id into v_ocl;
  insert into oc_lineas (orden_compra_id, articulo_id, descripcion, cantidad, costo_unitario) values (v_oc, v_otro, 'Otro 283', 1, 10) returning id into v_ocl_otro;
  update ordenes_compra set estado = 'recibida' where id = v_oc;

  perform pg_temp.como(v_comp);
  assert exists (select 1 from requisicion_ocs_candidatas() where requisicion_linea_id = v_rl and oc_linea_id = v_ocl), 'no propone la orden del mismo artículo';
  assert not exists (select 1 from requisicion_ocs_candidatas() where requisicion_linea_id = v_rl and oc_linea_id = v_ocl_otro), 'propone una partida de otro artículo';
  -- Otro artículo, no.
  begin perform ligar_requisicion_oc(v_rl, v_ocl_otro); v_ok := true; exception when raise_exception then v_ok := false; end;
  assert not v_ok, 'ligó a una partida de otro artículo';

  -- Almacén y ventas no ligan.
  perform pg_temp.como(v_alm);
  begin perform ligar_requisicion_oc(v_rl, v_ocl); v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'almacén ligó una requisición';
  perform pg_temp.como(v_ven);
  begin perform ligar_requisicion_oc(v_rl, v_ocl); v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'ventas ligó una requisición';

  -- Compras liga: queda ordenada, con la nota, y como la orden ya llegó a quien la pidió le avisa.
  perform pg_temp.como(v_comp);
  perform ligar_requisicion_oc(v_rl, v_ocl);
  perform pg_temp.como_postgres();
  assert (select estado = 'ordenada' and oc_linea_id = v_ocl and notas like 'Ligada a %' from requisicion_lineas where id = v_rl), 'no quedó ordenada y ligada';
  assert exists (select 1 from avisos where usuario_id = v_alm and tipo = 'oc_recibida' and titulo like 'Ya llegó lo de %'), 'no le avisó a quien la pidió';
  assert (select estado from requisiciones where id = v_req) = 'abierta', 'la requisición pasó a compra con una partida aún pendiente';
  -- Dos veces, no.
  perform pg_temp.como(v_comp);
  begin perform ligar_requisicion_oc(v_rl, v_ocl); v_ok := true; exception when raise_exception then v_ok := false; end;
  assert not v_ok, 'ligó dos veces la misma partida';

  -- Ligada la última pendiente, la requisición queda «en compra».
  perform ligar_requisicion_oc(v_rl2, v_ocl_otro);
  perform pg_temp.como_postgres();
  assert (select estado from requisiciones where id = v_req) = 'en_compra', 'la requisición no quedó en compra';
end $$;

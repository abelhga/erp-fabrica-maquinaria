-- Una orden con partidas de texto se puede recibir: la placa se liga a su artículo y entra al
-- almacén; el «Manejo» se recibe tal cual, sin inventario; y la orden queda recibida.
do $$
declare v_alm uuid; v_comp uuid; v_vend uuid; v_pb int; v_prov uuid; v_placa uuid; v_eq uuid; v_oc uuid; l_placa uuid; l_manejo uuid; v_ok boolean;
begin
  v_alm := pg_temp.usuario('alm180@hegamex.com', '{almacen}');
  v_comp := pg_temp.usuario('comp180@hegamex.com', '{compras}');
  v_vend := pg_temp.usuario('vend180@hegamex.com', '{ventas}');
  select id into v_pb from almacenes where nombre = 'Planta Baja';
  insert into proveedores (nombre, dias_entrega) values ('Aceros 180', 3) returning id into v_prov;
  insert into articulos (clave, tipo, nombre, unidad) values ('T180-PLACA', 'materia_prima', 'Placa 3/8 6x10', 'pieza') returning id into v_placa;
  insert into articulos (clave, tipo, nombre) values ('T180-EQ', 'equipo', 'Equipo 180') returning id into v_eq;
  insert into ordenes_compra (proveedor_id, estado) values (v_prov, 'enviada') returning id into v_oc;
  insert into oc_lineas (orden_compra_id, articulo_id, descripcion, cantidad, costo_unitario) values (v_oc, null, 'PLACA ACERO AL CARBON 3/8" A-50', 2, 5000) returning id into l_placa;
  insert into oc_lineas (orden_compra_id, articulo_id, descripcion, cantidad, costo_unitario) values (v_oc, null, 'Manejo', 1, 80) returning id into l_manejo;

  -- Ventas no liga; a un equipo no se liga una compra.
  perform pg_temp.como(v_vend);
  begin perform ligar_partida_oc(l_placa, v_placa); v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'ventas ligó una partida de compra';
  perform pg_temp.como(v_alm);
  begin perform ligar_partida_oc(l_placa, v_eq); v_ok := true; exception when raise_exception then v_ok := false; end;
  assert not v_ok, 'se ligó una compra a un equipo';

  -- Almacén liga la placa y recibe las dos: la placa entra al inventario, el manejo no.
  perform ligar_partida_oc(l_placa, v_placa);
  perform recibir_orden_compra(v_oc, jsonb_build_array(
    jsonb_build_object('linea_id', l_placa, 'cantidad', 2, 'almacen_id', v_pb),
    jsonb_build_object('linea_id', l_manejo, 'cantidad', 1)), 'F-180', false);
  perform pg_temp.como_postgres();
  assert (select articulo_id from oc_lineas where id = l_placa) = v_placa, 'la partida no quedó ligada';
  assert (select descripcion from oc_lineas where id = l_placa) = 'PLACA ACERO AL CARBON 3/8" A-50', 'se perdió cómo le llama el proveedor';
  assert (select cantidad from existencias where articulo_id = v_placa and almacen_id = v_pb) = 2, 'la placa no entró al almacén';
  assert (select count(*) from movimientos_inventario where orden_compra_id = v_oc) = 1, 'el manejo movió inventario';
  assert (select estado from ordenes_compra where id = v_oc) = 'recibida', 'la orden no quedó recibida';

  -- Ya recibida, no se liga nada.
  perform pg_temp.como(v_comp);
  begin perform ligar_partida_oc(l_manejo, v_placa); v_ok := true; exception when raise_exception then v_ok := false; end;
  assert not v_ok, 'se ligó una partida de una orden ya recibida';
  perform pg_temp.como_postgres();
end $$;

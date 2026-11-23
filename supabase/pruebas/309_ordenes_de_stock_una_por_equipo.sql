-- Para stock: cuatro equipos son cuatro órdenes con su serie y un subensamble es una orden por el
-- lote. Cancelar una orden que no arrancó libera su serie y regresa el consecutivo; una que ya
-- arrancó conserva la suya. El taller crea órdenes pero no las cancela; ventas, ninguna de las dos.
do $$
declare v_gp uuid; v_taller uuid; v_vend uuid; v_eq uuid; v_sub uuid; v_mp uuid; v_etapa int; r jsonb; v_ok boolean;
  v_ids uuid[]; v_ult int; v_op uuid;
begin
  v_gp := pg_temp.usuario('gp309@hegamex.com', '{gerente_produccion}');
  v_taller := pg_temp.usuario('taller309@hegamex.com', '{produccion}');
  v_vend := pg_temp.usuario('vend309@hegamex.com', '{ventas}');
  insert into familias_serie (clave, nombre, orden, ultimo) values ('fam309', 'Familia 309', 999, 40);
  insert into articulos (clave, tipo, nombre, familia_serie, codigo_serie) values ('T309-CRI', 'equipo', 'Cribadora 309', 'fam309', 'CX309N') returning id into v_eq;
  insert into articulos (clave, tipo, nombre) values ('T309-SUB', 'subensamble', 'Bastidor 309') returning id into v_sub;
  insert into articulos (clave, tipo, nombre) values ('T309-LAM', 'materia_prima', 'Lámina 309') returning id into v_mp;
  insert into bom_lineas (padre_id, hijo_id, cantidad) values (v_eq, v_mp, 3), (v_sub, v_mp, 2);

  -- Cuatro cribadoras: cuatro órdenes de una pieza, cada una con su material (3, no 12) y su serie.
  perform pg_temp.como(v_gp);
  r := crear_ordenes_stock(v_eq, 4);
  assert (r->>'ordenes')::int = 4 and jsonb_array_length(r->'folios') = 4, format('órdenes creadas: %s', r);
  select array_agg(id order by folio) into v_ids from ordenes_produccion where articulo_id = v_eq;
  assert (select bool_and(cantidad = 1 and pedido_id is null) from ordenes_produccion where articulo_id = v_eq), 'no son de una pieza';
  assert (select bool_and(requerido = 3) from op_materiales where orden_id = any(v_ids)), 'el material salió multiplicado';
  assert (select array_agg(numero_serie order by folio) from ordenes_produccion where articulo_id = v_eq) = array['CX309N041', 'CX309N042', 'CX309N043', 'CX309N044'],
    format('series: %s', (select array_agg(numero_serie order by folio) from ordenes_produccion where articulo_id = v_eq));
  -- Un subensamble va por lote: una orden por las 6 piezas.
  r := crear_ordenes_stock(v_sub, 6);
  assert (r->>'ordenes')::int = 1 and (select cantidad from ordenes_produccion where articulo_id = v_sub) = 6, 'el subensamble no quedó en una orden por el lote';
  -- La serie a mano es de un solo equipo.
  begin perform crear_ordenes_stock(v_eq, 2, null, 2, 'A-MANO'); v_ok := true; exception when invalid_parameter_value then v_ok := false; end;
  assert not v_ok, 'aceptó una serie a mano para dos equipos';

  -- Cancelar la última (no arrancó): su serie queda libre y el consecutivo regresa.
  perform cancelar_orden(v_ids[4], 'Prueba 309: se creó de más');
  assert (select numero_serie from ordenes_produccion where id = v_ids[4]) is null, 'la cancelada se quedó con su serie';
  assert (select ultimo from familias_serie where clave = 'fam309') = 43, 'el consecutivo no regresó';
  -- Cancelar una de en medio: queda libre, pero el consecutivo no se mueve (la 043 sigue viva).
  perform cancelar_orden(v_ids[2], 'Prueba 309: se creó de más');
  assert (select numero_serie from ordenes_produccion where id = v_ids[2]) is null and (select ultimo from familias_serie where clave = 'fam309') = 43, 'canceló una de en medio y movió el consecutivo';
  -- Una que ya arrancó conserva su serie.
  perform pg_temp.como_postgres();
  select id into v_etapa from etapas order by orden limit 1;
  insert into op_operaciones (orden_id, etapa_id, horas_estimadas, inicio) values (v_ids[3], v_etapa, 1, now());
  perform pg_temp.como(v_gp);
  perform cancelar_orden(v_ids[3], 'Prueba 309: el cliente canceló');
  assert (select numero_serie from ordenes_produccion where id = v_ids[3]) = 'CX309N043' and (select ultimo from familias_serie where clave = 'fam309') = 43, 'una orden que ya arrancó perdió su serie';

  -- El taller crea para stock pero no cancela; ventas, nada.
  perform pg_temp.como(v_taller);
  r := crear_ordenes_stock(v_eq, 1);
  v_op := (r->>'primera')::uuid;
  begin perform cancelar_orden(v_op, 'No me toca cancelar'); v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'el taller canceló una orden';
  perform pg_temp.como(v_vend);
  begin perform crear_ordenes_stock(v_eq, 1); v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'ventas creó una orden para stock';
end $$;

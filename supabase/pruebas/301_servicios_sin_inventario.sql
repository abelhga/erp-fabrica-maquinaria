-- Los servicios no llevan inventario: ningún movimiento los toca; la orden hereda de la lista los de
-- fuera (los internos no); en la orden no se apartan ni se
-- surten; el de fuera falta hasta que se recibe su compra (ligada a la orden por la requisición) o
-- la gerencia de producción o compras lo marcan hecho; el interno nunca falta ni se pide. Almacén y
-- el taller NO marcan servicios, y lo que es de almacén (por surtir, métricas, indicador) no los cuenta.
do $$
declare v_gp uuid; v_alm uuid; v_comp uuid; v_taller uuid; v_ing uuid; v_pb int; v_prov uuid;
  v_eq uuid; v_a uuid; v_s uuid; v_si uuid; v_op uuid; v_op2 uuid; v_req uuid; v_rl uuid; v_oc uuid; v_ocl uuid; v_oc2 uuid; v_ocl2 uuid;
  m_s uuid; m_s2 uuid; m_si uuid; m_a uuid; v_ok boolean; v_err text; v_n int; r record; j jsonb;
begin
  v_gp := pg_temp.usuario('gp301@hegamex.com', '{gerente_produccion}');
  v_alm := pg_temp.usuario('alm301@hegamex.com', '{almacen}');
  v_comp := pg_temp.usuario('comp301@hegamex.com', '{compras}');
  v_taller := pg_temp.usuario('taller301@hegamex.com', '{produccion}');
  v_ing := pg_temp.usuario('ing301@hegamex.com', '{ingenieria}');
  select id into v_pb from almacenes where nombre = 'Planta Baja';
  insert into proveedores (nombre) values ('Vulcanizadora 301') returning id into v_prov;
  insert into articulos (clave, tipo, nombre) values ('T301-EQ', 'equipo', 'Banda 301') returning id into v_eq;
  insert into articulos (clave, tipo, nombre) values ('T301-A', 'componente', 'Rodillo 301') returning id into v_a;

  -- 1. El artículo: un servicio nunca controla inventario, aunque se pida; «interno» solo existe en servicios.
  insert into articulos (clave, tipo, nombre, unidad, controla_inventario) values ('T301-S', 'servicio', 'Servicio de vulcanizado 301', 'servicio', true) returning id into v_s;
  insert into articulos (clave, tipo, nombre, unidad, servicio_interno) values ('T301-SI', 'servicio', 'Pulgada de corte CNC 301', 'pulgada', true) returning id into v_si;
  assert not (select controla_inventario from articulos where id = v_s), 'un servicio quedó controlando inventario';
  update articulos set controla_inventario = true where id = v_s;
  assert not (select controla_inventario from articulos where id = v_s), 'se le pudo prender el inventario a un servicio';
  update articulos set servicio_interno = true where id = v_a;
  assert not (select servicio_interno from articulos where id = v_a), 'un componente quedó como servicio interno';

  -- 2. Ningún movimiento toca un servicio, ni como postgres; y con existencia no se vuelve servicio.
  begin insert into movimientos_inventario (tipo, articulo_id, almacen_id, cantidad) values ('inicial', v_s, v_pb, 3); v_ok := true;
  exception when check_violation then v_ok := false; get stacked diagnostics v_err = message_text; end;
  assert not v_ok and v_err like '%es un servicio%', format('entró un movimiento de un servicio: %s', v_err);
  insert into movimientos_inventario (tipo, articulo_id, almacen_id, cantidad) values ('inicial', v_a, v_pb, 2);
  begin update articulos set tipo = 'servicio' where id = v_a; v_ok := true; exception when check_violation then v_ok := false; end;
  assert not v_ok, 'un componente con existencia se volvió servicio';

  insert into bom_lineas (padre_id, hijo_id, cantidad) values (v_eq, v_a, 2), (v_eq, v_s, 1), (v_eq, v_si, 40);
  insert into bom_operaciones (articulo_id, etapa_id, horas) values (v_eq, (select id from etapas where nombre = 'Pailería'), 5);
  perform pg_temp.como(v_gp);
  v_op := crear_orden_produccion(v_eq, 1);
  v_op2 := crear_orden_produccion(v_eq, 1);
  perform pg_temp.como_postgres();
  select id into m_s from op_materiales where orden_id = v_op and articulo_id = v_s;
  -- La orden hereda de la lista el servicio de fuera; el interno no baja (solo es costo). Para probar
  -- que uno interno agregado a mano tampoco estorba, ingeniería lo agrega.
  assert m_s is not null, 'la orden no heredó el servicio de fuera de la lista del equipo';
  assert not exists (select 1 from op_materiales where orden_id in (v_op, v_op2) and articulo_id = v_si), 'el servicio interno bajó a la orden';
  perform pg_temp.como(v_ing);
  perform agregar_material_orden(v_op, v_si, 40, 'Para probar el interno en la orden');
  perform pg_temp.como_postgres();
  select id into m_si from op_materiales where orden_id = v_op and articulo_id = v_si;
  select id into m_a from op_materiales where orden_id = v_op and articulo_id = v_a;
  select id into m_s2 from op_materiales where orden_id = v_op2 and articulo_id = v_s;

  -- 3. El material de la orden: el servicio de fuera falta pero no se surte; el interno ni falta ni se surte.
  perform pg_temp.como(v_gp);
  select * into r from v_op_material where id = m_s;
  assert r.faltante = 1 and r.por_surtir = 0 and not r.servicio_interno, format('servicio de fuera: falta %s, por surtir %s', r.faltante, r.por_surtir);
  select * into r from v_op_material where id = m_si;
  assert r.faltante = 0 and r.por_surtir = 0 and r.servicio_interno, format('servicio interno: falta %s, por surtir %s', r.faltante, r.por_surtir);
  select * into r from v_op_material where id = m_a;
  assert r.faltante = 2 and r.por_surtir = 2, 'el componente dejó de contar como antes';
  select * into r from faltantes_de_ordenes() where orden_id = v_op;
  assert r.faltantes = 2 and r.sin_pedir = 2, format('faltantes de la orden: %s / %s (el interno no cuenta)', r.faltantes, r.sin_pedir);

  -- 4. Apartar: toma el componente; del servicio no aparta nada y sigue faltando.
  perform apartar_material(v_op, 'Prueba 301');
  assert not exists (select 1 from reservas where orden_produccion_id = v_op and articulo_id in (v_s, v_si)), 'se apartó un servicio';
  select * into r from v_op_material where id = m_s;
  assert r.faltante = 1 and r.apartado = 0, 'el servicio dejó de faltar al apartar';
  assert (select faltante from v_op_material where id = m_a) = 0, 'el componente no se apartó';

  -- 5. Almacén: la orden sale por surtir solo por su componente, y un servicio no se surte.
  perform pg_temp.como(v_alm);
  assert (select partidas from ordenes_por_surtir() where id = v_op) = 1, format('partidas por surtir: %s (los servicios no son de almacén)', (select partidas from ordenes_por_surtir() where id = v_op));
  begin perform surtir_material(v_op, jsonb_build_array(jsonb_build_object('articulo_id', v_s, 'cantidad', 1, 'almacen_id', v_pb)), 'Leonardo'); v_ok := true;
  exception when check_violation then v_ok := false; get stacked diagnostics v_err = message_text; end;
  assert not v_ok and v_err like '%es un servicio%', format('almacén surtió un servicio: %s', v_err);

  -- 6. «Pedir faltantes» manda a compras el servicio de fuera; el interno nunca.
  perform pg_temp.como(v_gp);
  v_req := pedir_faltantes(v_op);
  perform pg_temp.como_postgres();
  select id into v_rl from requisicion_lineas where requisicion_id = v_req and articulo_id = v_s;
  assert v_rl is not null, 'el servicio de fuera no se pidió a compras';
  assert not exists (select 1 from requisicion_lineas where requisicion_id = v_req and articulo_id = v_si), 'el servicio interno se pidió a compras';

  -- 7. Compras lo ordena y lo liga; al recibirlo no entra a ningún almacén y la orden queda cubierta sola.
  insert into ordenes_compra (proveedor_id, estado) values (v_prov, 'enviada') returning id into v_oc;
  insert into oc_lineas (orden_compra_id, articulo_id, cantidad, costo_unitario) values (v_oc, v_s, 1, 850) returning id into v_ocl;
  perform pg_temp.como(v_comp);
  perform ligar_requisicion_oc(v_rl, v_ocl);
  perform pg_temp.como(v_alm);
  perform recibir_orden_compra(v_oc, jsonb_build_array(jsonb_build_object('linea_id', v_ocl, 'cantidad', 1, 'almacen_id', null)), 'F-301');
  perform pg_temp.como_postgres();
  assert (select estado from ordenes_compra where id = v_oc) = 'recibida' and (select recibido from oc_lineas where id = v_ocl) = 1, 'la orden de compra no quedó recibida';
  assert not exists (select 1 from movimientos_inventario where articulo_id = v_s), 'la recepción del servicio movió inventario';
  assert not exists (select 1 from existencias where articulo_id = v_s and cantidad <> 0), 'el servicio quedó con existencia';
  assert (select surtido from op_materiales where id = m_s) = 1, 'la recepción no cubrió el servicio de la orden';
  assert exists (select 1 from op_eventos where orden_id = v_op and nota like 'Servicio cubierto con la compra%Servicio de vulcanizado 301%'), 'no quedó en la línea de tiempo';
  assert (select costo from costos_articulo where articulo_id = v_s) = 850, 'la recepción no actualizó el costo del servicio';
  assert (select surtido from op_materiales where id = m_s2) = 0, 'se cubrió una orden para la que no se pidió';
  perform pg_temp.como(v_gp);
  assert (select faltante from v_op_material where id = m_s) = 0, 'el servicio recibido sigue faltando';

  -- 8. Una compra sin requisición no cubre nada: la otra orden sigue pendiente hasta que alguien lo marque.
  perform pg_temp.como_postgres();
  insert into ordenes_compra (proveedor_id, estado) values (v_prov, 'enviada') returning id into v_oc2;
  insert into oc_lineas (orden_compra_id, articulo_id, cantidad, costo_unitario) values (v_oc2, v_s, 1, 850) returning id into v_ocl2;
  perform pg_temp.como(v_alm);
  perform recibir_orden_compra(v_oc2, jsonb_build_array(jsonb_build_object('linea_id', v_ocl2, 'cantidad', 1)), null);
  perform pg_temp.como_postgres();
  assert (select surtido from op_materiales where id = m_s2) = 0, 'una compra sin requisición cubrió una orden';
  assert not exists (select 1 from movimientos_inventario where articulo_id = v_s), 'la compra sin requisición movió inventario';

  -- 9. «Marcar hecho»: el taller y almacén no; la gerencia de producción y compras sí.
  for r in select * from (values (v_taller, 'el taller'), (v_alm, 'almacén'), (v_ing, 'ingeniería')) x(u, quien) loop
    perform pg_temp.como(r.u);
    begin perform marcar_servicio_hecho(m_s2); v_ok := true; exception when insufficient_privilege then v_ok := false; end;
    assert not v_ok, format('%s marcó un servicio como hecho', r.quien);
  end loop;
  perform pg_temp.como(v_gp);
  perform marcar_servicio_hecho(m_s2, 'Ya regresó de la vulcanizadora');
  perform pg_temp.como_postgres();
  assert (select surtido = requerido from op_materiales where id = m_s2), 'no quedó marcado';
  assert exists (select 1 from op_eventos where orden_id = v_op2 and nota = 'Servicio hecho: Servicio de vulcanizado 301 (Ya regresó de la vulcanizadora)' and usuario_id = v_gp),
    'no quedó quién lo marcó';
  perform pg_temp.como(v_gp);
  begin perform marcar_servicio_hecho(m_s2); v_ok := true; exception when check_violation then v_ok := false; end;
  assert not v_ok, 'se marcó dos veces';
  --    Desmarcar pide el porqué, y lo puede hacer compras.
  perform pg_temp.como(v_comp);
  begin perform marcar_servicio_hecho(m_s2, null, false); v_ok := true; exception when invalid_parameter_value then v_ok := false; end;
  assert not v_ok, 'se desmarcó sin decir por qué';
  perform marcar_servicio_hecho(m_s2, 'Era el de la otra orden', false);
  perform pg_temp.como_postgres();
  assert (select surtido from op_materiales where id = m_s2) = 0, 'no se desmarcó';
  perform pg_temp.como(v_comp);
  perform marcar_servicio_hecho(m_s2);
  --    Ni el interno ni un componente se marcan.
  begin perform marcar_servicio_hecho(m_si); v_ok := true; exception when check_violation then v_ok := false; get stacked diagnostics v_err = message_text; end;
  assert not v_ok and v_err like '%se hace en casa%', 'se marcó un servicio interno';
  begin perform marcar_servicio_hecho(m_a); v_ok := true; exception when check_violation then v_ok := false; get stacked diagnostics v_err = message_text; end;
  assert not v_ok and v_err like '%no es un servicio%', 'se marcó un componente como servicio hecho';

  -- 10. Lo de almacén no cuenta servicios: una orden a la que solo le falta un servicio no «espera material»,
  --     y terminada no cuenta como surtida incompleta.
  perform pg_temp.como(v_comp);
  perform marcar_servicio_hecho(m_s2, 'Para probar que pendiente tampoco cuenta', false);
  perform pg_temp.como_postgres();
  update op_materiales set surtido = requerido where orden_id = v_op2 and articulo_id = v_a;
  perform pg_temp.como(v_alm);
  assert not exists (select 1 from ordenes_por_surtir() where id = v_op2), 'la orden espera a almacén por un servicio';
  j := metricas_almacen(current_date - 6, current_date);
  assert not exists (select 1 from jsonb_array_elements(j->'esperando') x where x->>'id' = v_op2::text), 'las métricas cuentan la orden como esperando material por un servicio';
  perform pg_temp.como_postgres();
  update ordenes_produccion set estado = 'terminada', terminada_en = now() where id = v_op2;
  j := objetivo_medir('surtido_produccion', null, null, current_date);
  assert not (select (x->>'cuenta')::boolean from jsonb_array_elements(j->'evidencias') x where x->>'referencia' = v_op2::text),
    'la orden terminada contó como surtida incompleta por un servicio';
end $$;

-- Inventario: movimientos inalterables, ajustes con autorización de otro,
-- reabasto con la regla de la hoja Demanda + cobertura de importados, y la
-- recepción de compras que actualiza existencia y costo.
do $$
declare
  v_alm uuid; v_jefe uuid; v_vend uuid; v_comp uuid;
  v_tapco uuid; v_import uuid; v_pb int; v_mall int; v_mov bigint; v_aj uuid; v_oc uuid; v_prov uuid;
  v_n int; v_num numeric; r record; m int;
begin
  v_alm := pg_temp.usuario('almacen@hegamex.com', '{almacen}');
  v_jefe := pg_temp.usuario('gerprod@hegamex.com', '{gerente_produccion}');
  v_vend := pg_temp.usuario('vende@hegamex.com', '{ventas}');
  v_comp := pg_temp.usuario('compras@hegamex.com', '{compras}');
  select id into v_pb from almacenes where nombre = 'Planta Baja';
  select id into v_mall from almacenes where nombre = 'Mallado';

  insert into proveedores (nombre, dias_entrega) values ('Tapco Inc', 7) returning id into v_prov;
  insert into articulos (clave, tipo, nombre, unidad, proveedor_id) values ('C-TAP', 'componente', 'Cangilon 5x4 azul, marca Tapco', 'pieza', v_prov) returning id into v_tapco;
  insert into articulos (clave, tipo, nombre, unidad, es_importado, tiempo_entrega_dias) values ('C-IMP', 'componente', 'Reductor importado', 'pieza', true, 60) returning id into v_import;
  insert into costos_articulo (articulo_id, costo) values (v_tapco, 100), (v_import, 5000);

  -- Saldo inicial (lo pone la importación, como postgres).
  insert into movimientos_inventario (tipo, articulo_id, almacen_id, cantidad, motivo) values
    ('inicial', v_tapco, v_pb, 300, 'Saldo inicial'), ('inicial', v_import, v_pb, 2, 'Saldo inicial');
  select id into v_mov from movimientos_inventario where articulo_id = v_tapco limit 1;

  -- ---------------------------------------------------------------------------
  -- Inalterables: ni editar, ni borrar, ni siquiera como superusuario.
  -- ---------------------------------------------------------------------------
  begin
    update movimientos_inventario set cantidad = 999 where id = v_mov;
    assert false, 'se pudo modificar un movimiento';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from movimientos_inventario where id = v_mov;
    assert false, 'se pudo borrar un movimiento';
  exception when insufficient_privilege then null;
  end;

  -- El almacenista no puede insertar movimientos directo (solo por las funciones).
  perform pg_temp.como(v_alm);
  begin
    insert into movimientos_inventario (tipo, articulo_id, almacen_id, cantidad) values ('ajuste_entrada', v_tapco, v_pb, 50);
    assert false, 'el almacenista insertó un ajuste directo sin autorización';
  exception when insufficient_privilege then null;
  end;

  -- No se puede sacar más de lo que hay.
  begin
    perform registrar_salida(v_tapco, v_pb, 301, 'salida_venta', 'Venta mostrador');
    assert false, 'se permitió dejar existencia negativa';
  exception when check_violation then null;
  end;

  -- Traspaso: 100 de Planta Baja a Mallado.
  perform traspasar(v_tapco, v_pb, v_mall, 100, 'Reacomodo');
  assert (select cantidad from existencias where articulo_id = v_tapco and almacen_id = v_mall) = 100, 'traspaso a Mallado';
  assert (select cantidad from existencias where articulo_id = v_tapco and almacen_id = v_pb) = 200, 'traspaso desde Planta Baja';

  -- ---------------------------------------------------------------------------
  -- Ajuste: el conteo dice 195 en Planta Baja. La existencia NO cambia hasta que otro autoriza.
  -- ---------------------------------------------------------------------------
  v_aj := solicitar_ajuste(v_tapco, v_pb, 195, 'Conteo físico del viernes');
  assert (select cantidad from existencias where articulo_id = v_tapco and almacen_id = v_pb) = 200, 'el ajuste se aplicó sin autorizar';
  begin
    perform resolver_ajuste(v_aj, true);
    assert false, 'el almacenista se autorizó su propio ajuste';
  exception when insufficient_privilege then null;
  end;
  -- Entre la solicitud y la autorización salen 10 piezas: el ajuste respeta lo contado (195 → 185 no, se deja en 195).
  perform pg_temp.como(v_jefe);
  perform resolver_ajuste(v_aj, true, 'Revisado en piso');
  assert (select cantidad from existencias where articulo_id = v_tapco and almacen_id = v_pb) = 195, 'ajuste aprobado';
  assert (select resuelto_por from ajustes_inventario where id = v_aj) = v_jefe, 'quién autorizó';
  -- La bitácora no la ve producción (solo sistemas y dirección): se revisa como postgres.
  perform pg_temp.como_postgres();
  select count(*) into v_n from bitacora where tabla = 'ajustes_inventario' and registro_id = v_aj::text;
  assert v_n >= 2, 'el ajuste no quedó en bitácora';

  -- El vendedor ve existencias (como en el BUSCADOR) pero no movimientos.
  perform pg_temp.como(v_vend);
  select count(*) into v_n from existencias where articulo_id = v_tapco;
  assert v_n = 2, 'ventas debería ver existencias';
  select count(*) into v_n from movimientos_inventario;
  assert v_n = 0, 'ventas no debería ver movimientos';

  -- ---------------------------------------------------------------------------
  -- Reabasto. Caso real de la hoja: Tapco con consumo 0, 0, 24, 110, 5, 24 en los últimos 6 meses
  -- → "genera demanda" (4 de 6 meses) y R = 163 / 4 = 40.75; punto de reorden ⌈40.75/22×7⌉ = 13.
  -- Los movimientos de prueba se fechan en el pasado desactivando el disparador que pone la hora.
  -- ---------------------------------------------------------------------------
  perform pg_temp.como_postgres();
  alter table movimientos_inventario disable trigger aplicar;
  for m in 1..6 loop
    if (array[24, 5, 110, 24, 0, 0])[m] > 0 then
      insert into movimientos_inventario (tipo, articulo_id, almacen_id, cantidad, motivo, en)
      values ('salida_produccion', v_tapco, v_pb, -(array[24, 5, 110, 24, 0, 0])[m], 'histórico',
              date_trunc('month', current_date) - make_interval(months => m) + interval '3 days');
    end if;
  end loop;
  -- El importado se usó 2 veces en el año (esporádico: la hoja lo dejaba sin mínimo).
  insert into movimientos_inventario (tipo, articulo_id, almacen_id, cantidad, motivo, en) values
    ('salida_produccion', v_import, v_pb, -3, 'histórico', date_trunc('month', current_date) - interval '8 months'),
    ('salida_produccion', v_import, v_pb, -3, 'histórico', date_trunc('month', current_date) - interval '2 months');
  alter table movimientos_inventario enable trigger aplicar;

  select * into r from reabasto() where articulo_id = v_tapco;
  assert r.meses_con_consumo = 4, format('meses con consumo %s', r.meses_con_consumo);
  assert r.demanda_mensual = 40.75, format('demanda mensual esperada 40.75, salió %s', r.demanda_mensual);
  assert r.punto_reorden = 13, format('punto de reorden esperado 13, salió %s', r.punto_reorden);
  assert r.lote = 41, format('lote (1 mes nacional) esperado 41, salió %s', r.lote);
  assert r.estado = 'ok', 'con 295 piezas está OK';

  -- Stock de seguridad manual (en la hoja se ignoraba): 300 → ya pide comprar.
  update articulos set stock_minimo_fijo = 300 where id = v_tapco;
  select * into r from reabasto() where articulo_id = v_tapco;
  assert r.punto_reorden = 313, format('con seguridad 300 el punto de reorden es 313, salió %s', r.punto_reorden);
  assert r.estado = 'ordenar' and r.sugerido = 41 + 313 - 295, format('sugerido esperado 59, salió %s (%s)', r.sugerido, r.estado);

  -- Importado: 6 meses de cobertura y promedio anual aunque el consumo sea esporádico.
  select * into r from reabasto() where articulo_id = v_import;
  assert r.demanda_mensual = 0.5, format('demanda anual promediada esperada 0.5, salió %s', r.demanda_mensual);
  assert r.meses_cobertura = 6, 'importado cubre 6 meses';
  -- punto de reorden = ⌈0.5/22×60⌉ = 2; lote = ⌈0.5×6⌉ = 3; existencia 2 − 0 reservado < 2? no → ok
  assert r.punto_reorden = 2 and r.lote = 3, format('pr %s lote %s', r.punto_reorden, r.lote);

  -- ---------------------------------------------------------------------------
  -- Compra: OC en dólares de 10 reductores a 300 USD; al recibir 10, existencia y costo se actualizan.
  -- ---------------------------------------------------------------------------
  perform pg_temp.como(v_comp);
  insert into ordenes_compra (proveedor_id, moneda, tipo_cambio) values (v_prov, 'USD', 18.5) returning id into v_oc;
  insert into oc_lineas (orden_compra_id, articulo_id, cantidad, costo_unitario) values (v_oc, v_import, 10, 300);
  assert (select subtotal from ordenes_compra where id = v_oc) = 3000, 'subtotal de la OC';
  update ordenes_compra set estado = 'enviada' where id = v_oc;
  select en_transito into v_num from v_existencias where articulo_id = v_import;
  assert v_num = 10, format('10 en tránsito, salió %s', v_num);

  perform pg_temp.como(v_alm);
  perform recibir_orden_compra(v_oc, jsonb_build_array(jsonb_build_object(
    'linea_id', (select id from oc_lineas where orden_compra_id = v_oc), 'cantidad', 10, 'almacen_id', v_pb)), 'F-123');
  -- (las salidas históricas se insertaron sin el disparador, así que no tocaron la existencia: 2 + 10)
  assert (select cantidad from existencias where articulo_id = v_import and almacen_id = v_pb) = 12, 'entraron 10';
  perform pg_temp.como_postgres();
  assert (select estado from ordenes_compra where id = v_oc) = 'recibida', 'OC recibida';
  select costo into v_num from costos_articulo where articulo_id = v_import;
  assert v_num = 300 and (select moneda from costos_articulo where articulo_id = v_import) = 'USD', 'el costo pasó a 300 USD';
  assert (select origen from historial_costos where articulo_id = v_import order by id desc limit 1) = 'orden_compra', 'historial con origen OC';
  -- …y el costeo lo convierte a pesos al tipo de cambio vigente.
  assert (select costo_total from costos_calculados where articulo_id = v_import) = 300 * tc('USD'), 'costo en MXN';
end $$;

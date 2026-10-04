-- Pantallas de compras y almacén: requisiciones → órdenes por proveedor, la
-- corrección de generar_oc_desde_reabasto (sin órdenes vacías, moneda bien
-- convertida), el ciclo de la orden (enviar, cancelar, borrar devuelve la
-- requisición), kardex, vistas que esconden costos a quien no los ve, conteos
-- sellados por la base e índice de precios por proveedor.
do $$
declare
  v_comp uuid; v_alm uuid; v_vend uuid; v_ger uuid; v_dir uuid;
  v_nac uuid; v_imp uuid; v_sin_prov uuid;
  v_chu uuid; v_mr uuid; v_tubo uuid; v_quieto uuid; v_tuerca uuid; v_equipo uuid; v_sub uuid;
  v_pb int; v_mall int; v_req uuid; v_l1 uuid; v_l2 uuid; v_l3 uuid; v_l4 uuid;
  v_res jsonb; v_oc uuid; v_oc2 uuid; v_n int; v_num numeric; v_txt text; r record; v_conteo uuid;
begin
  v_comp := pg_temp.usuario('compras@hegamex.com', '{compras}');
  v_alm := pg_temp.usuario('almacen@hegamex.com', '{almacen}');
  v_vend := pg_temp.usuario('vende@hegamex.com', '{ventas}');
  v_ger := pg_temp.usuario('gerprod@hegamex.com', '{gerente_produccion}');
  v_dir := pg_temp.usuario('dir@hegamex.com', '{direccion}');
  select id into v_pb from almacenes where nombre = 'Planta Baja';
  select id into v_mall from almacenes where nombre = 'Mallado';

  -- Días hábiles: del viernes 2 de octubre de 2026, 1 hábil es el lunes 5; 7 hábiles, el martes 13.
  assert sumar_dias_habiles('2026-10-02', 1) = '2026-10-05', 'viernes + 1 hábil = lunes';
  assert sumar_dias_habiles('2026-10-02', 7) = '2026-10-13', format('7 hábiles: %s', sumar_dias_habiles('2026-10-02', 7));
  assert sumar_dias_habiles('2026-10-02', 0) = '2026-10-02', '0 hábiles';

  insert into proveedores (nombre, moneda, dias_entrega, dias_credito) values ('P70 Rodamientos', 'MXN', 3, 30) returning id into v_nac;
  insert into proveedores (nombre, moneda, dias_entrega, es_importacion) values ('P70 Gearmotor', 'USD', 60, true) returning id into v_imp;
  insert into articulos (clave, tipo, nombre, proveedor_id) values ('P70-CHU', 'componente', 'Chumacera P70', v_nac) returning id into v_chu;
  -- Motorreductor: costo en dólares, pero lo surte (por excepción) el proveedor nacional en pesos.
  insert into articulos (clave, tipo, nombre, proveedor_id, es_importado) values ('P70-MR', 'componente', 'Motorreductor P70', v_imp, true) returning id into v_mr;
  insert into articulos (clave, tipo, nombre, empaque, stock_minimo_fijo) values ('P70-TUBO', 'materia_prima', 'Tubo P70 sin proveedor', 1, 5) returning id into v_tubo;
  insert into articulos (clave, tipo, nombre, proveedor_id) values ('P70-QUIETO', 'componente', 'Artículo P70 que no hace falta', v_nac) returning id into v_quieto;
  insert into articulos (clave, tipo, nombre, proveedor_id, empaque, stock_minimo_fijo) values ('P70-TUERCA', 'componente', 'Tuerca P70', v_nac, 100, 150) returning id into v_tuerca;
  -- Así queda la variable de origen en una conexión que ya recibió una orden de
  -- compra: '' y no NULL. El historial debe seguir anotando "manual".
  perform set_config('erp.origen_costo', '', true);
  insert into costos_articulo (articulo_id, costo, moneda, proveedor_id) values (v_chu, 185, 'MXN', v_nac), (v_mr, 300, 'USD', v_imp), (v_tuerca, 2, 'MXN', v_nac);
  assert (select origen from historial_costos where articulo_id = v_chu) = 'manual', 'origen del historial con la variable vacía';
  insert into movimientos_inventario (tipo, articulo_id, almacen_id, cantidad, motivo) values
    ('inicial', v_chu, v_pb, 40, 'Saldo'), ('inicial', v_quieto, v_pb, 10, 'Saldo'), ('inicial', v_tuerca, v_pb, 20, 'Saldo');

  -- ---------------------------------------------------------------------------
  -- Requisiciones → órdenes de compra agrupadas por proveedor
  -- ---------------------------------------------------------------------------
  perform pg_temp.como(v_ger);
  insert into requisiciones (origen, notas) values ('produccion', 'Faltantes P70') returning id into v_req;
  insert into requisicion_lineas (requisicion_id, articulo_id, cantidad) values (v_req, v_chu, 8) returning id into v_l1;
  insert into requisicion_lineas (requisicion_id, articulo_id, cantidad) values (v_req, v_chu, 4) returning id into v_l2;
  insert into requisicion_lineas (requisicion_id, articulo_id, cantidad) values (v_req, v_mr, 2) returning id into v_l3;
  insert into requisicion_lineas (requisicion_id, articulo_id, cantidad) values (v_req, v_tubo, 6) returning id into v_l4;

  -- Ni el vendedor ni almacén convierten requisiciones en órdenes.
  perform pg_temp.como(v_vend);
  begin
    perform ordenes_desde_requisiciones(array[v_l1]);
    assert false, 'un vendedor creó órdenes de compra';
  exception when insufficient_privilege then null;
  end;
  perform pg_temp.como(v_alm);
  begin
    perform ordenes_desde_requisiciones(array[v_l1]);
    assert false, 'almacén creó órdenes de compra';
  exception when insufficient_privilege then null;
  end;
  -- La función interna no está expuesta a la API.
  begin
    perform armar_ordenes_compra('[]', 'x');
    assert false, 'armar_ordenes_compra quedó expuesta';
  exception when insufficient_privilege then null;
  end;

  perform pg_temp.como(v_comp);
  v_res := ordenes_desde_requisiciones(array[v_l1, v_l2, v_l3, v_l4]);
  assert jsonb_array_length(v_res->'ordenes') = 2, format('dos proveedores, dos órdenes: %s', v_res);
  assert jsonb_array_length(v_res->'sin_proveedor') = 1 and v_res->'sin_proveedor'->0->>'clave' = 'P70-TUBO', 'el tubo no tiene proveedor';
  -- Las dos partidas de chumacera van en una sola, con el costo vigente.
  select o.id into v_oc from ordenes_compra o where o.proveedor_id = v_nac and o.estado = 'borrador';
  select count(*), sum(cantidad), max(costo_unitario) into v_n, v_num, v_txt from oc_lineas where orden_compra_id = v_oc;
  assert v_n = 1 and v_num = 12 and v_txt::numeric = 185, format('chumaceras agrupadas: %s partidas, %s piezas a %s', v_n, v_num, v_txt);
  assert (select fecha_entrega from ordenes_compra where id = v_oc) = sumar_dias_habiles(current_date, 3), 'entrega en 3 días hábiles del proveedor';
  assert (select condiciones from ordenes_compra where id = v_oc) = 'Crédito a 30 días', 'condiciones del proveedor';
  -- El motorreductor (300 USD) a un proveedor en dólares queda en 300 USD, no "300 pesos".
  select o.id into v_oc2 from ordenes_compra o where o.proveedor_id = v_imp and o.estado = 'borrador';
  assert (select moneda from ordenes_compra where id = v_oc2) = 'USD', 'orden de importación en dólares';
  assert (select costo_unitario from oc_lineas where orden_compra_id = v_oc2) = 300, 'costo en dólares sin convertir dos veces';
  -- Las partidas quedan ligadas y la requisición sigue abierta por el tubo.
  assert (select count(*) from requisicion_lineas where requisicion_id = v_req and estado = 'ordenada') = 3, 'tres partidas ordenadas';
  assert (select estado from requisiciones where id = v_req) = 'abierta', 'queda abierta: falta el tubo';
  assert (select oc_folio from v_requisicion_lineas where id = v_l1) is not null, 'la vista dice en qué orden quedó';
  -- Una partida ya ordenada no se vuelve a convertir.
  begin
    perform ordenes_desde_requisiciones(array[v_l1]);
    assert false, 'se ordenó dos veces la misma partida';
  exception when raise_exception then null;
  end;
  -- El tubo, con proveedor indicado a mano: la requisición se cierra a "en compra".
  v_res := ordenes_desde_requisiciones(array[v_l4], v_nac);
  assert jsonb_array_length(v_res->'ordenes') = 1, 'orden para el tubo';
  assert (select estado from requisiciones where id = v_req) = 'en_compra', 'requisición completa en compra';

  -- Borrar la orden del tubo regresa su partida a pendiente y la requisición a abierta.
  delete from ordenes_compra where id = (v_res->'ordenes'->0->>'id')::uuid;
  assert (select estado from requisicion_lineas where id = v_l4) = 'pendiente', 'la partida volvió a pendiente';
  assert (select estado from requisiciones where id = v_req) = 'abierta', 'la requisición volvió a abierta';

  -- ---------------------------------------------------------------------------
  -- Ciclo de la orden: agregar, enviar, cancelar
  -- ---------------------------------------------------------------------------
  -- Agregar el motorreductor a la orden en pesos: el costo se convierte (300 USD × tc).
  perform agregar_partida_oc(v_oc, v_mr, 1);
  assert (select costo_unitario from oc_lineas where orden_compra_id = v_oc and articulo_id = v_mr) = round(300 * tc('USD'), 4),
    'costo sugerido convertido a pesos';
  perform agregar_partida_oc(v_oc, v_chu, 3);
  assert (select cantidad from oc_lineas where orden_compra_id = v_oc and articulo_id = v_chu) = 15, 'agregar lo que ya está suma cantidad';
  -- Sin costo no se envía.
  update oc_lineas set costo_unitario = 0 where orden_compra_id = v_oc and articulo_id = v_mr;
  begin
    perform enviar_orden_compra(v_oc);
    assert false, 'se envió una orden con partidas sin costo';
  exception when raise_exception then null;
  end;
  delete from oc_lineas where orden_compra_id = v_oc and articulo_id = v_mr;
  perform pg_temp.como(v_alm);
  begin
    perform enviar_orden_compra(v_oc);
    assert false, 'almacén envió una orden';
  exception when insufficient_privilege then null;
  end;
  perform pg_temp.como(v_comp);
  perform enviar_orden_compra(v_oc);
  assert (select estado from ordenes_compra where id = v_oc) = 'enviada', 'orden enviada';
  begin
    perform agregar_partida_oc(v_oc, v_tuerca, 1);
    assert false, 'se agregó una partida a una orden enviada';
  exception when raise_exception then null;
  end;
  -- Llega una parte: ya no se puede cancelar.
  perform pg_temp.como(v_alm);
  perform recibir_orden_compra(v_oc, jsonb_build_array(jsonb_build_object(
    'linea_id', (select id from v_oc_lineas where orden_compra_id = v_oc and articulo_id = v_chu), 'cantidad', 5, 'almacen_id', v_mall)));
  perform pg_temp.como(v_comp);
  begin
    perform cancelar_orden_compra(v_oc, 'ya no se necesita');
    assert false, 'se canceló una orden con recepciones';
  exception when raise_exception then null;
  end;
  -- La de importación sí se cancela, y su partida regresa a la requisición.
  perform cancelar_orden_compra(v_oc2, 'El cliente canceló el pedido');
  assert (select estado from ordenes_compra where id = v_oc2) = 'cancelada', 'cancelada';
  assert (select estado from requisicion_lineas where id = v_l3) = 'pendiente', 'el motorreductor vuelve a pendiente';
  assert (select v.atrasada from v_ordenes_compra v where v.id = v_oc) = false, 'recién enviada no está atrasada';
  assert (select avance_recibido from v_ordenes_compra where id = v_oc) = 5 / 15.0, 'avance de recepción';

  -- ---------------------------------------------------------------------------
  -- Reabasto → órdenes (corrección de generar_oc_desde_reabasto)
  -- ---------------------------------------------------------------------------
  -- Tuerca: seguridad 150 con 20 en planta → hace falta; empaque de 100 → 200 (⌈(0 + 150 − 20)/100⌉·100).
  -- "Quieto" no necesita nada: antes se creaba una orden vacía para su proveedor.
  select sugerido into v_num from reabasto() where articulo_id = v_tuerca;
  assert v_num = 200, format('sugerido de la tuerca %s', v_num);
  perform pg_temp.como(v_alm);
  begin
    perform generar_oc_desde_reabasto(array[v_tuerca]);
    assert false, 'almacén generó órdenes de compra';
  exception when insufficient_privilege then null;
  end;
  perform pg_temp.como(v_comp);
  -- El tubo (seguridad 5) ya está pedido en la requisición de producción: no se pide otra vez.
  v_res := ordenes_desde_reabasto(array[v_tubo]);
  assert jsonb_array_length(v_res->'ordenes') = 0 and v_res->'omitidos'->0->>'clave' = 'P70-TUBO', format('tubo ya pedido: %s', v_res);
  update requisicion_lineas set estado = 'cancelada' where id = v_l4;
  select count(*) into v_n from ordenes_compra;
  v_res := ordenes_desde_reabasto(array[v_tuerca, v_quieto, v_tubo]);
  assert jsonb_array_length(v_res->'ordenes') = 1, format('una sola orden (la de la tuerca): %s', v_res);
  assert (select count(*) from ordenes_compra) = v_n + 1, 'no se crearon órdenes vacías';
  assert v_res->'sin_proveedor'->0->>'clave' = 'P70-TUBO', 'el tubo se avisa sin proveedor';
  assert exists (select 1 from jsonb_array_elements(v_res->'omitidos') o where o->>'clave' = 'P70-QUIETO'), 'el quieto se omite';
  assert (select l.cantidad from oc_lineas l where l.orden_compra_id = (v_res->'ordenes'->0->>'id')::uuid) = 200, 'cantidad sugerida';
  -- Volver a generar no duplica: ya está en borrador.
  assert generar_oc_desde_reabasto(array[v_tuerca]) = 0, 'no se duplica lo que ya está en borrador';
  assert (select en_borrador from reabasto_detalle() where articulo_id = v_tuerca) = 200, 'el reabasto muestra lo que está en borrador';

  -- Almacén sí puede pedírselo a compras como requisición (pero no lo ya pedido).
  update articulos set stock_minimo_fijo = 300 where id = v_tuerca;   -- ahora hacen falta 300 (⌈(300−20)/100⌉·100); 200 ya en borrador
  perform pg_temp.como(v_alm);
  -- La lista en una llamada trae lo mismo que la función por filas, y sin costos para almacén.
  assert jsonb_array_length(reabasto_lista()) = (select count(*) from reabasto_detalle()), 'reabasto_lista no trae todas las filas';
  assert (select (e->>'en_borrador')::numeric from jsonb_array_elements(reabasto_lista()) e where (e->>'articulo_id')::uuid = v_tuerca) = 200,
    'reabasto_lista no trae lo que está en borrador';
  assert not exists (select 1 from jsonb_array_elements(reabasto_lista()) e where e->>'costo_mxn' is not null), 'almacén vio costos en el reabasto';
  v_res := requisicion_desde_reabasto(array[v_tuerca]);
  assert (select cantidad from requisicion_lineas where requisicion_id = (v_res->>'id')::uuid) = 100, 'pide solo lo que falta';
  assert (select origen from requisiciones where id = (v_res->>'id')::uuid) = 'reabasto', 'origen reabasto';
  begin
    perform requisicion_desde_reabasto(array[v_tuerca]);
    assert false, 'se pidió dos veces lo mismo';
  exception when raise_exception then null;
  end;
  perform pg_temp.como(v_vend);
  begin
    perform requisicion_desde_reabasto(array[v_tubo]);
    assert false, 'un vendedor pidió material a compras';
  exception when insufficient_privilege then null;
  end;

  -- ---------------------------------------------------------------------------
  -- Kardex y vistas: el costo solo para quien ve costos
  -- ---------------------------------------------------------------------------
  perform pg_temp.como(v_alm);
  perform registrar_salida(v_chu, v_pb, 3, 'salida_venta', 'Venta mostrador');
  perform traspasar(v_chu, v_pb, v_mall, 10, 'Reacomodo');
  select * into r from kardex(v_chu) limit 1;
  assert r.tipo = 'traspaso_entrada' and r.saldo_almacen = 15, format('último movimiento %s con saldo %s', r.tipo, r.saldo_almacen);
  assert (select saldo_almacen from kardex(v_chu) k where k.tipo = 'salida_venta') = 37, 'saldo tras la venta: 40 − 3';
  assert (select referencia from v_movimientos where articulo_id = v_chu and tipo = 'traspaso_salida') = 'a Mallado', 'referencia del traspaso';
  assert (select referencia from v_movimientos where articulo_id = v_chu and tipo = 'entrada_compra') like 'OC %', 'referencia de la compra';
  -- Almacén lee la tabla de movimientos (para operar) pero la vista no le enseña costos.
  assert (select costo_unitario from v_movimientos where articulo_id = v_chu and tipo = 'salida_venta') is null, 'almacén vio el costo';
  perform pg_temp.como(v_comp);
  assert (select costo_unitario from v_movimientos where articulo_id = v_chu and tipo = 'salida_venta') = 185, 'compras sí ve el costo';
  -- El vendedor no ve movimientos: el kardex sale vacío, sin error.
  perform pg_temp.como(v_vend);
  select count(*) into v_n from kardex(v_chu);
  assert v_n = 0, 'el vendedor vio el kardex';
  select count(*) into v_n from v_existencias where articulo_id = v_chu;
  assert v_n = 1, 'el vendedor sí ve existencias';

  -- Ajustes: valor de la diferencia solo con permiso de costos.
  perform pg_temp.como(v_alm);
  v_txt := solicitar_ajuste(v_chu, v_pb, 25, 'Conteo: faltan dos chumaceras')::text;
  assert (select valor_diferencia from v_ajustes where id = v_txt::uuid) is null, 'almacén vio el valor del ajuste';
  perform pg_temp.como(v_dir);
  assert (select valor_diferencia from v_ajustes where id = v_txt::uuid) = -370, 'dirección ve −2 × 185';
  perform resolver_ajuste(v_txt::uuid, true, 'ok');
  assert (select aplicado from v_ajustes where id = v_txt::uuid) = -2, 'aplicado';

  -- ---------------------------------------------------------------------------
  -- Conteos: quién contó lo pone la base; la captura muestra la diferencia
  -- ---------------------------------------------------------------------------
  perform pg_temp.como(v_alm);
  insert into conteos (nombre, almacen_id) values ('Conteo P70', v_pb) returning id into v_conteo;
  -- Aunque la pantalla mande otro usuario, queda el que capturó.
  insert into conteo_lineas (conteo_id, articulo_id, cantidad_contada, contado_por) values (v_conteo, v_chu, 24, v_dir);
  assert (select contado_por from conteo_lineas where conteo_id = v_conteo) = v_alm, 'el conteo quedó a nombre de otro';
  select * into r from conteo_captura(v_conteo) c where c.articulo_id = v_chu;
  assert r.sistema = 25 and r.contada = 24 and r.diferencia = -1, format('captura %s/%s/%s', r.sistema, r.contada, r.diferencia);
  assert exists (select 1 from conteo_captura(v_conteo) c where c.articulo_id = v_quieto and c.contada is null), 'lo no contado aparece para contar';
  assert (select capturados from v_conteos where id = v_conteo) = 1, 'capturados';
  -- El vendedor no captura conteos.
  perform pg_temp.como(v_vend);
  begin
    insert into conteo_lineas (conteo_id, articulo_id, cantidad_contada) values (v_conteo, v_quieto, 1);
    assert false, 'un vendedor capturó un conteo';
  exception when insufficient_privilege then null;
  end;

  -- ---------------------------------------------------------------------------
  -- Precios: impacto en equipos e índice por proveedor
  -- ---------------------------------------------------------------------------
  perform pg_temp.como_postgres();
  insert into articulos (clave, tipo, nombre) values ('P70-SUB', 'subensamble', 'Cabezal P70') returning id into v_sub;
  insert into articulos (clave, tipo, nombre) values ('P70-EQ', 'equipo', 'Banda P70') returning id into v_equipo;
  insert into bom_lineas (padre_id, hijo_id, cantidad) values (v_sub, v_chu, 2), (v_equipo, v_sub, 1), (v_equipo, v_tuerca, 10);
  perform pg_temp.como(v_comp);
  v_res := impacto_costos(array[v_chu, v_tuerca]);
  assert (v_res->>'equipos')::int = 1 and (v_res->>'subensambles')::int = 1, format('impacto %s', v_res);

  -- Índice: dos artículos del proveedor; uno sube 10 % hace 2 meses y el otro no
  -- cambia → el índice sube √1.1 (media geométrica), no 10 %.
  perform pg_temp.como_postgres();
  delete from historial_costos where proveedor_id = v_nac;
  insert into historial_costos (articulo_id, costo_anterior, costo_nuevo, moneda, proveedor_id, en) values
    (v_chu, null, 100, 'MXN', v_nac, date_trunc('month', current_date) - interval '5 months'),
    (v_tuerca, null, 2, 'MXN', v_nac, date_trunc('month', current_date) - interval '5 months'),
    (v_chu, 100, 110, 'MXN', v_nac, date_trunc('month', current_date) - interval '2 months' + interval '3 days');
  perform pg_temp.como(v_comp);
  select indice into v_num from indice_precios_proveedor(v_nac, 12) where mes = (date_trunc('month', current_date) - interval '5 months')::date;
  assert v_num = 100, format('base 100, salió %s', v_num);
  select indice into v_num from indice_precios_proveedor(v_nac, 12) where mes = date_trunc('month', current_date)::date;
  assert v_num = round(100 * sqrt(1.1), 1), format('índice esperado %s, salió %s', round(100 * sqrt(1.1), 1), v_num);
  assert (select cambios from indice_precios_proveedor(v_nac, 12) where mes = (date_trunc('month', current_date) - interval '2 months')::date) = 1,
    'un cambio en ese mes';
  -- Sin permiso de costos no hay índice (ni error).
  perform pg_temp.como(v_alm);
  select count(*) into v_n from indice_precios_proveedor(v_nac, 12);
  assert v_n = 0, 'almacén vio el índice de precios';
  assert (select articulos from v_proveedores where id = v_nac) >= 3, 'artículos que surte';
end $$;

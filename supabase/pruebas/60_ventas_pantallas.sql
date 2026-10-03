-- Pantallas de ventas: los huecos que cerró 20261003000020_ventas_pantallas.sql
-- (descuento general que tronaba, precio mínimo distinto en la ficha y en la
-- base, autorizaciones que el vendedor se podía dar solo, comisión con total en
-- cero) y las funciones del editor, con la RLS de verdad.
-- Claves T60-… para no chocar con el catálogo real importado en la base local.
do $$
declare
  v_isaac uuid; v_juan uuid; v_gerente uuid; v_fin uuid;
  v_cli uuid; v_banda uuid; v_polea uuid; v_cot uuid; v_cot2 uuid; v_l_polea uuid; v_l_banda uuid; v_l uuid;
  v_ped uuid; v_op uuid; v_n int; v_num numeric; v_total_mxn numeric; v_txt text; v_j jsonb; r record;
begin
  v_isaac := pg_temp.usuario('isaac@hegamex.com', '{ventas}');
  v_juan := pg_temp.usuario('juan@hegamex.com', '{ventas}');
  v_gerente := pg_temp.usuario('gerente@hegamex.com', '{gerente_ventas}');
  v_fin := pg_temp.usuario('cobranza@hegamex.com', '{finanzas}');

  -- Banda $202,000 (equipo: hasta −10 %) y polea $1,050 (componente: hasta −9.09 %).
  insert into articulos (clave, tipo, nombre, categoria_id) values ('T60-E315', 'equipo', 'Banda cargadora 18" x 13 m',
    (select id from categorias where nombre = 'Banda Transportadora')) returning id into v_banda;
  insert into articulos (clave, tipo, nombre, descripcion) values ('T60-POL', 'componente', 'Polea 8"', '• Masa fija') returning id into v_polea;
  insert into costos_articulo (articulo_id, costo) values (v_polea, 735);
  insert into bom_lineas (padre_id, hijo_id, cantidad) values (v_banda, v_polea, 91345.69 / 735);
  assert (select precio from precios_lista where articulo_id = v_banda) = 202000, 'precio de la banda';

  -- ---------------------------------------------------------------------------
  -- La ficha del vendedor da el mismo mínimo con el que lo juzga la base
  -- (antes le daba −10 % a todo porque el vendedor no ve politicas_precio).
  -- ---------------------------------------------------------------------------
  perform pg_temp.como(v_isaac);
  v_j := ficha_venta(v_polea);
  assert (v_j->>'precio_minimo')::numeric = 954.56, format('mínimo de la polea: esperaba 954.56, salió %s', v_j->>'precio_minimo');
  assert (ficha_venta(v_banda)->>'precio_minimo')::numeric = 181800, 'mínimo de la banda';
  -- …y no le enseña nada de costos.
  assert not (v_j ? 'costo') and not (v_j ? 'utilidad'), 'la ficha no debe traer costos';

  -- ---------------------------------------------------------------------------
  -- Alta con condiciones por defecto, RFC normalizado, contacto principal
  -- ---------------------------------------------------------------------------
  insert into clientes (nombre, vendedor_id, razon_social, rfc) values (' Concretos T60 ', v_isaac, 'Concretos T60 SA de CV', ' cte160202ab1 ')
  returning id into v_cli;
  assert (select rfc from clientes where id = v_cli) = 'CTE160202AB1', 'el RFC se guarda en mayúsculas y sin espacios';
  insert into contactos (cliente_id, nombre, principal) values (v_cli, 'Ing. Pérez', true);
  v_cot := nueva_cotizacion(v_cli);
  select * into r from cotizaciones where id = v_cot;
  assert r.atencion = 'Ing. Pérez' and r.empresa = 'Concretos T60 SA de CV', 'atención y empresa salen del cliente';
  assert r.condiciones_pago = (select texto from textos_comerciales where tipo = 'pago' and por_defecto), 'pago por defecto';
  assert cardinality(r.notas) = (select count(*) from textos_comerciales where tipo = 'nota' and por_defecto and activo), 'notas por defecto';

  -- ---------------------------------------------------------------------------
  -- Partidas: precio desde catálogo y la foto de lista la pone la base
  -- ---------------------------------------------------------------------------
  select * into r from agregar_partida(v_cot, v_banda, 1);
  v_l_banda := r.id;
  assert r.precio_unitario = 202000 and r.precio_lista = 202000 and r.orden = 1, 'partida de la banda';
  select id into v_l_polea from agregar_partida(v_cot, v_polea, 4);
  -- Con precio_lista nulo no había mínimo contra qué comparar: ahora lo pone la base.
  insert into cotizacion_lineas (cotizacion_id, orden, articulo_id, titulo, cantidad, precio_unitario, precio_lista)
  values (v_cot, 9, v_polea, 'Polea "barata"', 1, 100, null) returning id into v_l;
  assert (select precio_lista from cotizacion_lineas where id = v_l) = 1050, 'precio_lista lo pone la base, no la pantalla';
  update cotizacion_lineas set precio_lista = 1 where id = v_l;
  assert (select precio_lista from cotizacion_lineas where id = v_l) = 1050, 'precio_lista no se puede reescribir';
  assert (select bajo_minimo from cotizacion_lineas where id = v_l), 'la polea a $100 está bajo el mínimo';
  assert (select estado::text from cotizaciones where id = v_cot) = 'por_autorizar', 'pide autorización';
  delete from cotizacion_lineas where id = v_l;
  assert (select estado::text from cotizaciones where id = v_cot) = 'borrador', 'sin la partida barata vuelve a borrador';

  -- ---------------------------------------------------------------------------
  -- Descuento general: antes tronaba con "record new has no field cotizacion_id"
  -- 202,000 + 4,200 = 206,200 − 5 % (10,310) = 195,890 + IVA 31,342.40 = 227,232.40
  -- ---------------------------------------------------------------------------
  update cotizaciones set descuento_pct = 0.05 where id = v_cot;
  select * into r from cotizaciones where id = v_cot;
  assert r.descuento = 10310 and r.total = 227232.40, format('totales con descuento: %s / %s', r.descuento, r.total);
  assert r.estado = 'borrador', '5 % está dentro del mínimo de las dos partidas';
  update cotizaciones set descuento_pct = 0 where id = v_cot;

  -- ---------------------------------------------------------------------------
  -- El vendedor no se autoriza solo, por ningún camino
  -- ---------------------------------------------------------------------------
  update cotizacion_lineas set precio_unitario = 900 where id = v_l_polea;
  assert (select estado::text from cotizaciones where id = v_cot) = 'por_autorizar', 'la polea a $900 pide autorización';
  begin
    update cotizaciones set autorizada_por = v_isaac where id = v_cot;
    assert false, 'el vendedor se puso a sí mismo como autorizador';
  exception when insufficient_privilege then null;
  end;
  begin
    update cotizaciones set estado = 'autorizada' where id = v_cot;
    assert false, 'el vendedor marcó su cotización como autorizada';
  exception when insufficient_privilege then null;
  end;
  begin
    update cotizaciones set requiere_autorizacion = false, estado = 'enviada' where id = v_cot;
    assert false, 'se envió quitando la bandera requiere_autorizacion en el mismo update';
  exception when insufficient_privilege then null;
  end;
  -- Tocar la bandera de la partida se puede (es solo para pintar), pero no sirve para enviar.
  update cotizacion_lineas set bajo_minimo = false where cotizacion_id = v_cot;
  begin
    update cotizaciones set estado = 'enviada' where id = v_cot;
    assert false, 'se envió después de borrar la bandera bajo_minimo';
  exception when insufficient_privilege then null;
  end;
  begin
    perform convertir_a_pedido(v_cot);
    assert false, 'se convirtió a pedido sin autorización';
  exception when insufficient_privilege then null;
  end;

  -- Pide autorización con nota y la gerente la ve en su cola.
  perform pedir_autorizacion(v_cot, 'Cliente frecuente, se lleva 4');
  perform pg_temp.como(v_gerente);
  select count(*) into v_n from v_cotizaciones where id = v_cot and estado = 'por_autorizar'
    and autorizacion_pedida_en is not null and nota_autorizacion = 'Cliente frecuente, se lleva 4';
  assert v_n = 1, 'la gerente ve la solicitud con su nota';
  perform autorizar_cotizacion(v_cot);
  assert (select autorizada_en from cotizaciones where id = v_cot) is not null, 'queda la fecha de autorización';
  begin
    perform autorizar_cotizacion(v_cot);
    assert false, 'autorizar dos veces debería avisar';
  exception when others then
    if sqlerrm not like '%ya no está esperando%' then raise; end if;
  end;

  -- Bajar más el precio después de autorizado: la autorización ya no vale.
  perform pg_temp.como(v_isaac);
  update cotizacion_lineas set precio_unitario = 500 where id = v_l_polea;
  select * into r from cotizaciones where id = v_cot;
  assert r.autorizada_por is null and r.estado = 'por_autorizar', format('cambiar el precio autorizado debe pedir autorización otra vez (quedó %s)', r.estado);
  -- Editar solo la descripción no invalida nada.
  update cotizacion_lineas set precio_unitario = 1050 where id = v_l_polea;
  assert (select estado::text from cotizaciones where id = v_cot) = 'borrador', 'a precio de lista vuelve a borrador';

  -- ---------------------------------------------------------------------------
  -- Moneda e IVA incluido: convierte las partidas y el total en pesos no se mueve
  -- ---------------------------------------------------------------------------
  select total into v_total_mxn from cotizaciones where id = v_cot;   -- 206,200 × 1.16 = 239,192
  perform ajustar_moneda_cotizacion(v_cot, 'USD', 20, false);
  assert (select precio_unitario from cotizacion_lineas where id = v_l_banda) = 10100, 'banda en dólares = 202,000 / 20';
  select * into r from cotizaciones where id = v_cot;
  assert abs(r.total * r.tipo_cambio - v_total_mxn) < 1, format('el total en pesos se movió: %s vs %s', r.total * r.tipo_cambio, v_total_mxn);
  assert r.estado = 'borrador', 'convertir no debe disparar autorizaciones';
  select precio_unitario into v_num from agregar_partida(v_cot, v_polea, 1);
  assert v_num = 52.50, format('partida nueva en USD: esperaba 52.50, salió %s', v_num);
  delete from cotizacion_lineas where cotizacion_id = v_cot and orden = 3;
  perform ajustar_moneda_cotizacion(v_cot, 'USD', 20, true);
  assert (select precio_unitario from cotizacion_lineas where id = v_l_banda) = 11716, 'con IVA incluido la banda sale en 11,716 USD';
  select * into r from cotizaciones where id = v_cot;
  assert abs(r.total * r.tipo_cambio - v_total_mxn) < 1, 'con IVA incluido el total no cambia';
  perform ajustar_moneda_cotizacion(v_cot, 'MXN', null, false);
  assert (select precio_unitario from cotizacion_lineas where id = v_l_banda) = 202000, 'de regreso a pesos';
  assert (select total from cotizaciones where id = v_cot) = v_total_mxn, 'el total regresa exacto';

  -- ---------------------------------------------------------------------------
  -- Enviar sin oportunidad abre una en "cotizado" (el embudo se llena solo)
  -- ---------------------------------------------------------------------------
  update cotizaciones set estado = 'enviada' where id = v_cot;
  select oportunidad_id into v_op from cotizaciones where id = v_cot;
  assert v_op is not null, 'enviar debió abrir una oportunidad';
  select * into r from oportunidades where id = v_op;
  assert r.etapa = 'cotizado' and r.monto_estimado = 206200 and r.vendedor_id = v_isaac, 'oportunidad en cotizado con el monto sin IVA';
  begin
    perform ajustar_moneda_cotizacion(v_cot, 'USD', 20, false);
    assert false, 'se cambió la moneda de una cotización enviada';
  exception when others then
    if sqlerrm not like '%ya se envió%' then raise; end if;
  end;

  -- Juan no ve la cotización, ni la oportunidad, ni puede duplicarla; sí ve que el cliente existe.
  perform pg_temp.como(v_juan);
  assert (select count(*) from v_cotizaciones where id = v_cot) = 0, 'Juan ve cotizaciones de Isaac en la vista';
  assert (select count(*) from v_oportunidades where id = v_op) = 0, 'Juan ve oportunidades de Isaac';
  assert (select count(*) from v_clientes where id = v_cli) = 1, 'Juan debe ver que el cliente existe (para no duplicarlo)';
  begin
    perform duplicar_cotizacion(v_cot);
    assert false, 'Juan duplicó una cotización de Isaac';
  exception when others then
    if sqlerrm not like '%No existe la cotización%' then raise; end if;
  end;

  -- La versión que saca la gerente sigue siendo de Isaac (antes se la quedaba ella).
  perform pg_temp.como(v_gerente);
  v_cot2 := nueva_version_cotizacion(v_cot);
  select * into r from cotizaciones where id = v_cot2;
  assert r.vendedor_id = v_isaac, 'la nueva versión cambió de dueño';
  assert r.folio = (select folio from cotizaciones where id = v_cot) || '-v2' and r.version = 2, 'folio de la versión';
  assert r.oportunidad_id = v_op, 'la versión sigue en la misma oportunidad';

  -- Duplicar: folio nuevo, mismas partidas, sin historia.
  perform pg_temp.como(v_isaac);
  v_l := duplicar_cotizacion(v_cot);
  select * into r from cotizaciones where id = v_l;
  assert r.version = 1 and r.origen_id is null and r.oportunidad_id is null and r.vendedor_id = v_isaac, 'duplicado limpio';
  assert (select count(*) from cotizacion_lineas where cotizacion_id = v_l) = 2, 'el duplicado trae las 2 partidas';

  -- ---------------------------------------------------------------------------
  -- Rechazar: motivo obligatorio; la oportunidad se cierra solo si no queda otra cotización viva
  -- ---------------------------------------------------------------------------
  begin
    perform rechazar_cotizacion(v_cot, ' ');
    assert false, 'se rechazó sin motivo';
  exception when others then
    if sqlerrm not like '%motivo%' then raise; end if;
  end;
  perform rechazar_cotizacion(v_cot, 'Compró con la competencia');
  assert (select etapa::text from oportunidades where id = v_op) = 'cotizado', 'la v2 sigue viva: la oportunidad no se pierde';
  perform rechazar_cotizacion(v_cot2, 'Compró con la competencia');
  select * into r from oportunidades where id = v_op;
  assert r.etapa = 'perdida' and r.motivo_perdida = 'Compró con la competencia' and r.cerrada_en is not null, 'oportunidad perdida con motivo';

  -- ---------------------------------------------------------------------------
  -- Oportunidades: días en la etapa y motivo de pérdida obligatorio
  -- ---------------------------------------------------------------------------
  insert into oportunidades (cliente_id, titulo, etapa_desde) values (v_cli, 'Tolva T60', now() - interval '10 days') returning id into v_op;
  assert (select dias_en_etapa from v_oportunidades where id = v_op) = 10, 'días en la etapa';
  update oportunidades set monto_estimado = 50000 where id = v_op;
  assert (select dias_en_etapa from v_oportunidades where id = v_op) = 10, 'editar el monto no reinicia los días';
  update oportunidades set etapa = 'contactado' where id = v_op;
  assert (select dias_en_etapa from v_oportunidades where id = v_op) = 0, 'cambiar de etapa sí';
  begin
    update oportunidades set etapa = 'perdida' where id = v_op;
    assert false, 'se perdió una oportunidad sin decir por qué';
  exception when check_violation then null;
  end;
  insert into actividades (cliente_id, oportunidad_id, tipo, descripcion, vence_en) values (v_cli, v_op, 'tarea', 'Llamar al ingeniero', current_date - 1);
  assert (select tarea_vence from v_oportunidades where id = v_op) = current_date - 1, 'la próxima tarea sale en la tarjeta';

  -- ---------------------------------------------------------------------------
  -- Pedido: partidas elegidas, entregar con permiso, cancelar con motivo, cobranza
  -- ---------------------------------------------------------------------------
  v_cot := nueva_cotizacion(v_cli);
  select id into v_l_banda from agregar_partida(v_cot, v_banda, 1);
  select id into v_l_polea from agregar_partida(v_cot, v_polea, 2);
  update cotizacion_lineas set opcional = true where id = v_l_polea;
  assert (select subtotal from cotizaciones where id = v_cot) = 202000, 'la opcional no suma';
  -- El cliente sí quiso la alternativa: se elige al convertir.
  v_ped := convertir_a_pedido(v_cot, current_date + 30, array[v_l_banda, v_l_polea]);
  assert (select count(*) from pedido_lineas where pedido_id = v_ped) = 2, 'el pedido lleva las 2 partidas elegidas';
  assert (select subtotal from pedidos where id = v_ped) = 204100, 'subtotal del pedido con la opcional elegida';

  perform pg_temp.como(v_juan);
  begin
    perform entregar_pedido(v_ped);
    assert false, 'Juan entregó un pedido de Isaac';
  exception when insufficient_privilege then null;
  end;
  perform pg_temp.como(v_isaac);
  begin
    update pedidos set estado = 'cancelado' where id = v_ped;
    assert false, 'se canceló un pedido sin motivo';
  exception when check_violation then null;
  end;
  begin
    insert into cobros (pedido_id, monto) values (v_ped, 1);
    assert false, 'un vendedor registró un cobro';
  exception when insufficient_privilege then null;
  end;

  perform pg_temp.como(v_fin);
  insert into cobros (pedido_id, monto, metodo) values (v_ped, 100000, 'transferencia');
  select * into r from v_pedidos where id = v_ped;
  assert r.cobrado = 100000 and r.saldo = r.total - 100000, 'saldo del pedido';

  perform pg_temp.como(v_isaac);
  perform entregar_pedido(v_ped);
  assert (select estado::text from pedidos where id = v_ped) = 'entregado', 'pedido entregado';
  assert not exists (select 1 from pedido_lineas where pedido_id = v_ped and cantidad_entregada <> cantidad), 'partidas entregadas';
  assert (select saldo from v_clientes where id = v_cli) = (select total - 100000 from pedidos where id = v_ped), 'Isaac ve el saldo de su cliente';
  assert (select ultima_compra from v_clientes where id = v_cli) = hoy_mx(), 'última compra';
  perform pg_temp.como(v_juan);
  assert (select coalesce(saldo, 0) from v_clientes where id = v_cli) = 0, 'Juan NO debe ver el saldo del cliente de Isaac';
  assert (select ultima_compra from v_clientes where id = v_cli) is null, 'Juan NO debe ver las compras del cliente de Isaac';

  -- Pedido de Mercado Libre sin cotización: la partida trae precio y línea de comisión.
  perform pg_temp.como(v_isaac);
  insert into pedidos (cliente_id, canal, id_externo) values (v_cli, 'mercadolibre', 'ML-T60-1') returning id into v_ped;
  assert (select vendedor_id from pedidos where id = v_ped) = v_isaac, 'el pedido capturado es de quien lo captura';
  select * into r from agregar_partida_pedido(v_ped, v_polea, 3);
  assert r.precio_unitario = 1050 and r.linea = 'refacciones', 'partida de ML con precio y línea';

  -- ---------------------------------------------------------------------------
  -- Comisiones: el total ya no sale en cero
  -- ---------------------------------------------------------------------------
  perform pg_temp.como_postgres();
  insert into vendedor_plan values (v_isaac, (select id from planes_comision where nombre like 'General%'));
  insert into comision_ajustes (vendedor_id, mes, concepto, monto) values (v_isaac, date_trunc('month', hoy_mx()), 'Bono MercadoLíder', 800);
  perform pg_temp.como(v_isaac);
  select * into r from comisiones_mes(hoy_mx()) where vendedor_id = v_isaac;
  assert r.venta_maquinaria = 202000 and r.venta_refacciones = 2100 + 3150, format('venta del mes: %s / %s', r.venta_maquinaria, r.venta_refacciones);
  assert r.comision = 4040 and r.ajustes = 800, format('comisión 2 %% y ajustes: %s / %s', r.comision, r.ajustes);
  assert r.total = r.comision + r.bono_meta + r.bono_refacciones + r.ajustes and r.total = 4840, format('total de la comisión: %s', r.total);
  select count(*) into v_n from pedidos_comision(v_isaac, hoy_mx());
  assert v_n = 2, format('detalle: esperaba 2 pedidos, salieron %s', v_n);
  perform pg_temp.como(v_juan);
  assert (select count(*) from comisiones_mes(hoy_mx()) where vendedor_id = v_isaac) = 0, 'Juan ve la comisión de Isaac';
  assert (select count(*) from pedidos_comision(v_isaac, hoy_mx())) = 0, 'Juan ve el detalle de comisión de Isaac';
  perform pg_temp.como(v_gerente);
  assert (select count(*) from comisiones_mes(hoy_mx()) where vendedor_id = v_isaac) = 1, 'la gerente ve la comisión de Isaac';
end $$;

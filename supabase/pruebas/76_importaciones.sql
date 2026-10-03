-- Importaciones: prorrateo igual al de PRORRATEO.xlsx, la recepción que ya no
-- pone el precio en USD como costo, el costeo final que sí lo pone (con historial
-- y precio), quién ve qué (almacén sin montos, ventas nada), el tope de pagos y
-- las alertas.

-- -----------------------------------------------------------------------------
-- 1. prorratear_importacion() contra los bloques de PRORRATEO.xlsx (informe §4 y §9.2).
--
-- Lo que el informe trae de los bloques reales: las fórmulas de las dos hojas
-- (factor por valor y "mixto" del consolidado), el factor de cada bloque
-- (0.27 a 1.09) y un resultado con cifra: Yao Han, nov 2024, f = 0.27 y el
-- cabezal F900A a $35,947.29 "antes de IVA" (el mismo costo que llegó a
-- ACTUALIZACIONES). No trae el USD ni el TC de cada partida, así que aquí el
-- valor en pesos del F900A se despeja de ese resultado y los demás bloques se
-- arman con sus factores. Si se pegan los bloques completos del Excel, basta con
-- cambiar estos números.
-- -----------------------------------------------------------------------------
do $$
declare
  v_tc numeric := 20.43; v_lineas jsonb; v_gastos jsonb; v_valor numeric; v_g numeric; r record; v_suma numeric;
  f numeric; a numeric; b numeric;
begin
  -- Bloque "Yao Han" nov 2024. Partidas: cabezal F900A, cosedoras N600A y F300A.
  v_lineas := jsonb_build_array(
    jsonb_build_object('i', 1, 'cantidad', 1, 'precio', 35947.29 * 1.16 / 1.27 / v_tc, 'tipo_cambio', v_tc),
    jsonb_build_object('i', 2, 'cantidad', 20, 'precio', 160, 'tipo_cambio', v_tc),
    jsonb_build_object('i', 3, 'cantidad', 20, 'precio', 150, 'tipo_cambio', v_tc));
  select sum((x->>'cantidad')::numeric * (x->>'precio')::numeric * v_tc) into v_valor from jsonb_array_elements(v_lineas) x;
  -- Indirectos del bloque: consolidador (Interteam) + "LME Agent" + "Flete Manza-Atoto" = 0.27 × V.
  v_g := 0.27 * v_valor;
  a := round(v_g * 0.22, 2); b := round(v_g * 0.61, 2);
  v_gastos := jsonb_build_array(
    jsonb_build_object('descripcion', 'Interteam', 'monto_mxn', a, 'criterio', 'valor'),
    jsonb_build_object('descripcion', 'LME Agent', 'monto_mxn', b, 'criterio', 'valor'),
    jsonb_build_object('descripcion', 'Flete Manza-Atoto', 'monto_mxn', v_g - a - b, 'criterio', 'valor'));
  for r in select * from prorratear_importacion(v_lineas, v_gastos) loop
    assert round(r.factor, 6) = 0.27, format('factor del bloque Yao Han: esperaba 0.27, salió %s', r.factor);
  end loop;
  select * into r from prorratear_importacion(v_lineas, v_gastos) where i = 1;
  -- El Excel divide entre 1.16 al final ("antes de IVA"): con la misma fórmula sale su cifra.
  assert round(r.costo_unitario / 1.16, 2) = 35947.29, format('F900A como en el Excel: esperaba 35,947.29, salió %s', round(r.costo_unitario / 1.16, 2));
  select * into r from prorratear_importacion(v_lineas, v_gastos) where i = 2;
  assert round(r.costo_unitario, 4) = round(160 * v_tc * 1.27, 4), format('N600A = USD × TC × (1 + f): salió %s', r.costo_unitario);
  -- Comprobación del Excel: Σ costo total = V + G.
  select sum(costo_total) into v_suma from prorratear_importacion(v_lineas, v_gastos);
  assert round(v_suma, 2) = round(v_valor + v_g, 2), format('Σ costo total %s ≠ V + G %s', v_suma, v_valor + v_g);

  -- Los demás factores del informe: Tavol 0.45, Xi''an Gavin 0.52–0.60, Henan Lanyi 0.69,
  -- poleas y catarinas 0.74, JS25035 (600 fluidificadores) 1.09.
  foreach f in array array[0.45, 0.52, 0.60, 0.69, 0.74, 1.09] loop
    v_lineas := jsonb_build_array(
      jsonb_build_object('i', 1, 'cantidad', 600, 'precio', 18.5, 'tipo_cambio', 19.87),
      jsonb_build_object('i', 2, 'cantidad', 3, 'precio', 2150, 'tipo_cambio', 19.87));
    v_valor := 600 * 18.5 * 19.87 + 3 * 2150 * 19.87;
    v_gastos := jsonb_build_array(jsonb_build_object('monto_mxn', f * v_valor, 'criterio', 'valor'));
    select * into r from prorratear_importacion(v_lineas, v_gastos) where i = 1;
    assert round(r.factor, 6) = f, format('factor %s: salió %s', f, r.factor);
    assert round(r.costo_unitario, 4) = round(18.5 * 19.87 * (1 + f), 4), format('factor %s: unitario %s', f, r.costo_unitario);
  end loop;

  -- Método "mixto" del CONSOLIDADO 27-04-2026: logística (XPD + flete terrestre) por
  -- volumen con 30/20/30/20 por proveedor y la importación ("LME Agent") por valor.
  --   costo = valor_u × (1 + G_log × %vol_g / valor_g + G_imp / V)
  v_tc := 17.20;
  v_lineas := jsonb_build_array(
    jsonb_build_object('i', 1, 'grupo', 'catarinas', 'cantidad', 200, 'precio', 6.40, 'tipo_cambio', v_tc),
    jsonb_build_object('i', 2, 'grupo', 'catarinas', 'cantidad', 120, 'precio', 9.10, 'tipo_cambio', v_tc),
    jsonb_build_object('i', 3, 'grupo', 'poleas', 'cantidad', 80, 'precio', 22.00, 'tipo_cambio', v_tc),
    jsonb_build_object('i', 4, 'grupo', 'gabinetes', 'cantidad', 40, 'precio', 58.00, 'tipo_cambio', v_tc),
    jsonb_build_object('i', 5, 'grupo', 'gabinetes', 'cantidad', 10, 'precio', 140.00, 'tipo_cambio', v_tc),
    jsonb_build_object('i', 6, 'grupo', 'celdas', 'cantidad', 24, 'precio', 35.50, 'tipo_cambio', v_tc));
  v_gastos := jsonb_build_array(
    jsonb_build_object('descripcion', 'XPD + flete terrestre', 'monto_mxn', 85000, 'criterio', 'volumen'),
    jsonb_build_object('descripcion', 'LME Agent', 'monto_mxn', 61250, 'criterio', 'valor'));
  select sum((x->>'cantidad')::numeric * (x->>'precio')::numeric * v_tc) into v_valor from jsonb_array_elements(v_lineas) x;
  for r in
    with l as (select (x->>'i')::int i, x->>'grupo' grupo, (x->>'cantidad')::numeric q, (x->>'precio')::numeric * v_tc vu
               from jsonb_array_elements(v_lineas) x),
    vg as (select grupo, sum(q * vu) valor_g from l group by grupo),
    pct as (select * from (values ('catarinas', 0.30), ('poleas', 0.20), ('gabinetes', 0.30), ('celdas', 0.20)) v(grupo, p))
    select l.i, l.vu * (1 + 85000 * pct.p / vg.valor_g + 61250 / v_valor) as esperado, p.costo_unitario
    from l join vg using (grupo) join pct using (grupo)
    join prorratear_importacion(v_lineas, v_gastos, '{"catarinas": 30, "poleas": 20, "gabinetes": 30, "celdas": 20}') p on p.i = l.i
  loop
    assert round(r.costo_unitario, 4) = round(r.esperado, 4), format('mixto, partida %s: esperaba %s, salió %s', r.i, r.esperado, r.costo_unitario);
  end loop;
  select sum(costo_total) into v_suma from prorratear_importacion(v_lineas, v_gastos, '{"catarinas": 30, "poleas": 20, "gabinetes": 30, "celdas": 20}');
  assert round(v_suma, 2) = round(v_valor + 85000 + 61250, 2), 'mixto: Σ costo total = V + G';

  -- IVA: lo que la hoja hace mal. La cuenta de gastos de $50,000 trae $8,000 de IVA
  -- (acreditable). La hoja lo mete al prorrateo y divide TODO entre 1.16, también la
  -- mercancía, que no lleva IVA: sobre $200,000 de mercancía da $222,413.79. Aquí el
  -- IVA no entra y no se divide nada: $250,000.
  v_lineas := jsonb_build_array(jsonb_build_object('i', 1, 'cantidad', 10, 'precio', 1000, 'tipo_cambio', 20));
  select * into r from prorratear_importacion(v_lineas, jsonb_build_array(jsonb_build_object('monto_mxn', 50000, 'iva_mxn', 8000)));
  assert r.costo_total = 250000, format('sin IVA: esperaba 250,000, salió %s', r.costo_total);
  assert round(200000 * (1 + 58000 / 200000.0) / 1.16, 2) = 222413.79, 'la cifra de la hoja con su ÷ 1.16';

  -- Ningún gasto se pierde: sin volumen o sin a quién cargárselo es error, no un costo bajo.
  begin
    perform * from prorratear_importacion(v_lineas || jsonb_build_object('i', 2, 'grupo', 'b', 'cantidad', 1, 'precio', 5, 'tipo_cambio', 20),
      jsonb_build_array(jsonb_build_object('descripcion', 'XPD', 'monto_mxn', 1000, 'criterio', 'volumen')), '{"b": 3}');
    assert false, 'un gasto por volumen sin el volumen de todos los proveedores no debe pasar';
  exception when check_violation then null;
  end;
  begin
    perform * from prorratear_importacion(v_lineas, jsonb_build_array(jsonb_build_object('monto_mxn', 1000, 'criterio', 'directo', 'articulo_id', gen_random_uuid())));
    assert false, 'un gasto directo a un artículo que no viene no debe pasar';
  exception when check_violation then null;
  end;
end $$;

-- -----------------------------------------------------------------------------
-- 2. El embarque de punta a punta, con los permisos de cada quien.
-- -----------------------------------------------------------------------------
do $$
declare
  v_hoy date := (now() at time zone 'America/Mexico_City')::date;
  v_imp uuid; v_alm uuid; v_vend uuid; v_comp uuid; v_fin uuid; v_ger uuid;
  v_prov uuid; v_f900 uuid; v_n600 uuid; v_nac uuid; v_oc uuid; v_oc_nac uuid; v_oc_celdas uuid; v_emb uuid; v_emb2 uuid;
  v_pb int; v_pago uuid; v_cost uuid; v_cost2 uuid; v_n int; v_num numeric; r record; v_txt text;
begin
  v_imp := pg_temp.usuario('importaciones@hegamex.com', '{importaciones}');
  v_alm := pg_temp.usuario('almacen@hegamex.com', '{almacen}');
  v_vend := pg_temp.usuario('isaac@hegamex.com', '{ventas}');
  v_comp := pg_temp.usuario('compras@hegamex.com', '{compras}');
  v_fin := pg_temp.usuario('finanzas@hegamex.com', '{finanzas}');
  v_ger := pg_temp.usuario('gerprod@hegamex.com', '{gerente_produccion}');
  select id into v_pb from almacenes where nombre = 'Planta Baja';

  -- Catálogo: el cabezal F900A costaba $40,250 en la hoja.
  insert into proveedores (nombre, pais, es_importacion, moneda) values ('T Yao Han Industries', 'Taiwán', true, 'USD') returning id into v_prov;
  insert into articulos (clave, tipo, nombre, es_importado, tiempo_entrega_dias, proveedor_id)
  values ('T-F900A', 'componente', 'T Cabezal cosedor F900A', true, 60, v_prov) returning id into v_f900;
  insert into articulos (clave, tipo, nombre, es_importado, tiempo_entrega_dias, proveedor_id)
  values ('T-N600A', 'componente', 'T Cosedora manual N600A', true, 60, v_prov) returning id into v_n600;
  insert into articulos (clave, tipo, nombre) values ('T-NAC', 'componente', 'T Chumacera nacional') returning id into v_nac;
  insert into costos_articulo (articulo_id, costo, moneda) values (v_f900, 40250, 'MXN'), (v_n600, 5100, 'MXN'), (v_nac, 100, 'MXN');

  -- Fracción arancelaria: se captura como venga y se guarda en dígitos; 7 dígitos no pasa.
  update articulos set fraccion_arancelaria = '8452.21.01-00' where id = v_f900;
  assert (select fraccion_arancelaria || '/' || nico from articulos where id = v_f900) = '84522101/00', 'fracción normalizada';
  begin
    update articulos set fraccion_arancelaria = '4834009' where id = v_n600;
    assert false, 'una fracción de 7 dígitos no debe pasar';
  exception when check_violation then null;
  end;

  -- Compras: orden en USD (con IVA por error: un proveedor del extranjero no lo cobra).
  perform pg_temp.como(v_comp);
  insert into ordenes_compra (proveedor_id, moneda, tipo_cambio, fecha) values (v_prov, 'USD', 19.5, v_hoy - 70) returning id into v_oc;
  insert into oc_lineas (orden_compra_id, articulo_id, cantidad, costo_unitario) values (v_oc, v_f900, 2, 1600), (v_oc, v_n600, 20, 160);
  assert (select total from ordenes_compra where id = v_oc) = 7424, 'con IVA la orden decía USD 7,424';
  update ordenes_compra set estado = 'enviada' where id = v_oc;

  -- ---------------------------------------------------------------------------
  -- Alondra da de alta el embarque y le liga la orden.
  -- ---------------------------------------------------------------------------
  perform pg_temp.como(v_imp);
  insert into embarques (descripcion, modalidad, incoterm, forwarder, agente_aduanal, eta, dias_libres_almacenaje)
  values ('T Cosedoras y cabezales', 'lcl', 'CIF', 'Interteam', 'Careaga', v_hoy + 20, 7) returning id into v_emb;
  assert (select folio from embarques where id = v_emb) like 'EMB-%', 'folio del embarque';
  insert into embarque_oc (embarque_id, orden_compra_id, factura) values (v_emb, v_oc, 'MEHE-T-001');
  assert (select total from ordenes_compra where id = v_oc) = 6400, 'al ligarla al embarque la orden queda sin IVA: USD 6,400';
  -- Checklist por modalidad: LCL lleva desconsolidación y no carta encomienda; CIF lleva póliza.
  assert exists (select 1 from embarque_documentos where embarque_id = v_emb and tipo = 'aviso_desconsolidacion'), 'LCL pide desconsolidación';
  assert not exists (select 1 from embarque_documentos where embarque_id = v_emb and tipo = 'carta_encomienda'), 'LCL no pide encomienda';
  assert exists (select 1 from embarque_documentos where embarque_id = v_emb and tipo = 'poliza'), 'CIF pide póliza';
  update embarques set incoterm = 'CFR' where id = v_emb;
  assert not exists (select 1 from embarque_documentos where embarque_id = v_emb and tipo = 'poliza'), 'CFR ya no pide póliza';

  -- ---------------------------------------------------------------------------
  -- Pagos en USD con el TC real, y nunca más de lo que se debe.
  -- ---------------------------------------------------------------------------
  insert into embarque_pagos (embarque_id, orden_compra_id, concepto, fecha, monto, tipo_cambio, metodo)
  values (v_emb, v_oc, 'anticipo', v_hoy - 60, 3200, 19.50, 'transferencia') returning id into v_pago;
  assert (select monto_mxn from embarque_pagos where id = v_pago) = 62400, 'MXN que salieron = USD × TC real';
  assert exists (select 1 from embarque_eventos where embarque_id = v_emb and tipo = 'anticipo' and fecha = v_hoy - 60), 'el anticipo marca su etapa';
  insert into embarque_pagos (embarque_id, orden_compra_id, concepto, estado, fecha, monto)
  values (v_emb, v_oc, 'saldo', 'programado', v_hoy + 3, 3200) returning id into v_pago;
  begin
    insert into embarque_pagos (embarque_id, orden_compra_id, concepto, fecha, monto, tipo_cambio) values (v_emb, v_oc, 'otro', v_hoy, 100, 19.6);
    assert false, 'se le pagó al proveedor más de lo que se le debe';
  exception when check_violation then
    get stacked diagnostics v_txt = message_text;
    assert v_txt like '%de más%', v_txt;
  end;
  begin
    update embarque_pagos set estado = 'pagado' where id = v_pago;
    assert false, 'un pago hecho sin tipo de cambio real no debe pasar';
  exception when check_violation then null;
  end;
  begin
    update embarque_pagos set estado = 'pagado', tipo_cambio = 20 where id = v_pago;
    assert false, 'un pago hecho con fecha futura no debe pasar';
  exception when check_violation then null;
  end;
  -- Finanzas tampoco puede pagar de más por su lado (pagos_proveedor).
  perform pg_temp.como(v_fin);
  begin
    insert into pagos_proveedor (orden_compra_id, monto) values (v_oc, 1);
    assert false, 'finanzas pagó de más una orden que ya se pagó por el embarque';
  exception when check_violation then null;
  end;
  -- Almacén ni ve ni registra pagos.
  perform pg_temp.como(v_alm);
  begin
    insert into embarque_pagos (embarque_id, orden_compra_id, fecha, monto, tipo_cambio) values (v_emb, v_oc, v_hoy, 10, 20);
    assert false, 'almacén registró un pago';
  exception when insufficient_privilege then null;
  end;

  -- ---------------------------------------------------------------------------
  -- En camino: almacén ve qué viene y cuándo (en el mar), sin montos.
  -- ---------------------------------------------------------------------------
  perform pg_temp.como(v_imp);
  perform registrar_evento_importacion(v_emb, 'pi', v_hoy - 75);
  perform registrar_evento_importacion(v_emb, 'listo', v_hoy - 35);
  perform registrar_evento_importacion(v_emb, 'zarpe', v_hoy - 30);
  begin
    perform registrar_evento_importacion(v_emb, 'arribo', v_hoy + 2);
    assert false, 'una etapa con fecha futura no debe pasar';
  exception when check_violation then null;
  end;
  update embarques set eta = v_hoy + 5 where id = v_emb;
  assert exists (select 1 from embarque_eventos where embarque_id = v_emb and tipo = 'cambio_eta' and datos->>'despues' = (v_hoy + 5)::text),
    'el cambio de ETA queda en la historia';
  select * into r from v_embarques where id = v_emb;
  assert r.fase = 'transito', format('con zarpe va en el mar: %s', r.fase);
  assert r.docs_pendientes_arribo > 0 and r.siguiente_paso like 'Juntar los documentos%', format('siguiente paso: %s', r.siguiente_paso);
  assert exists (select 1 from alertas_importacion() where embarque_id = v_emb and tipo = 'documentos' and titulo like '%llega en 5 días y faltan%'),
    'alerta: llega en 5 días y faltan documentos';
  assert exists (select 1 from alertas_importacion() where embarque_id = v_emb and tipo = 'eta'), 'alerta: cambió la ETA';
  assert exists (select 1 from alertas_importacion() where embarque_id = v_emb and tipo = 'pago' and titulo like '%sin comprobante%'), 'alerta: pago sin comprobante';

  perform pg_temp.como(v_alm);
  select * into r from v_embarques where id = v_emb;
  assert r.folio is not null and r.fase = 'transito', 'almacén ve el embarque y en qué va';
  select * into r from v_existencias where articulo_id = v_f900;
  assert r.en_transito = 2 and r.en_mar = 2 and r.llegada_estimada is not null,
    format('almacén ve 2 cabezales en el mar con fecha de llegada (en tránsito %s, en el mar %s)', r.en_transito, r.en_mar);
  assert not exists (select 1 from embarque_pagos), 'almacén leyó pagos';
  assert not exists (select 1 from v_embarque_dinero), 'almacén leyó el dinero del embarque';
  assert not exists (select 1 from v_importacion_por_pagar), 'almacén leyó lo que hay por pagar';
  assert (select costo_unitario from v_oc_lineas where orden_compra_id = v_oc and articulo_id = v_f900) is null, 'almacén vio el precio en USD';
  assert not exists (select 1 from alertas_importacion() where tipo in ('pago', 'por_recuperar') or titulo || detalle ~ '(\$|USD)'),
    'a almacén le salió una alerta con dinero';
  assert exists (select 1 from embarque_eventos where embarque_id = v_emb and tipo = 'anticipo'), 'almacén no ve que ya se pagó el anticipo';
  assert not exists (select 1 from embarque_eventos where embarque_id = v_emb and detalle ~ '(\$|USD|[0-9],[0-9]{3})'),
    'a almacén le salió el monto del pago en las etapas';
  assert not puede_ver_archivo_importacion(v_emb || '/ci/factura.pdf'), 'almacén puede abrir la factura (trae precios)';
  assert puede_ver_archivo_importacion(v_emb || '/pl/packing.pdf'), 'almacén sí abre el packing list';
  begin
    insert into embarques (descripcion) values ('T almacén no da de alta embarques');
    assert false, 'almacén dio de alta un embarque';
  exception when insufficient_privilege then null;
  end;

  -- Ventas no ve nada de importaciones.
  perform pg_temp.como(v_vend);
  assert not exists (select 1 from embarques) and not exists (select 1 from v_embarques), 'ventas vio embarques';
  assert not exists (select 1 from embarque_eventos) and not exists (select 1 from embarque_documentos), 'ventas vio etapas o documentos';
  assert not exists (select 1 from embarque_pagos) and not exists (select 1 from costeos_importacion), 'ventas vio pagos o costeos';
  assert not exists (select 1 from alertas_importacion()), 'ventas vio alertas de importación';
  assert not puede_ver_archivo_importacion(v_emb || '/pl/packing.pdf'), 'ventas abre archivos de importación';
  begin
    perform registrar_evento_importacion(v_emb, 'arribo', v_hoy);
    assert false, 'ventas registró una etapa';
  exception when insufficient_privilege then null;
  end;

  -- La gerencia del taller ve el embarque, no el dinero.
  perform pg_temp.como(v_ger);
  assert exists (select 1 from v_embarques where id = v_emb), 'gerencia de producción no ve el embarque';
  assert not exists (select 1 from embarque_pagos) and not exists (select 1 from pedimentos), 'gerencia de producción vio dinero';

  -- ---------------------------------------------------------------------------
  -- Puerto: días libres, pedimento y costeo preliminar.
  -- ---------------------------------------------------------------------------
  perform pg_temp.como(v_imp);
  update embarque_pagos set estado = 'pagado', fecha = v_hoy - 32, tipo_cambio = 20.00, comprobante = v_emb || '/comprobante/saldo.pdf' where id = v_pago;
  update embarque_pagos set comprobante = v_emb || '/comprobante/anticipo.pdf' where concepto = 'anticipo' and embarque_id = v_emb;
  -- TC real ponderado: (62,400 + 64,000) / 6,400 = 19.75.
  assert tc_real_oc(v_oc) = 19.75, format('TC real ponderado: %s', tc_real_oc(v_oc));
  perform registrar_evento_importacion(v_emb, 'arribo', v_hoy - 5);
  select * into r from v_embarques where id = v_emb;
  assert r.fase = 'puerto' and r.dias_en_puerto = 5, format('en puerto %s días (%s)', r.dias_en_puerto, r.fase);
  assert exists (select 1 from alertas_importacion() where embarque_id = v_emb and tipo = 'almacenaje' and titulo like '%día 5 de 7%'),
    'alerta: día 5 de 7 libres en puerto';
  perform pg_temp.como(v_alm);
  assert (select en_puerto from v_existencias where articulo_id = v_f900) = 2, 'almacén ve los cabezales en puerto';

  perform pg_temp.como(v_imp);
  begin
    perform calcular_costeo_importacion(v_emb, 'preliminar');
    assert false, 'el preliminar sin pedimento no debe pasar';
  exception when check_violation then null;
  end;
  begin
    insert into pedimentos (embarque_id, numero, fecha_pago) values (v_emb, '123', v_hoy);
    assert false, 'un número de pedimento que no son 15 dígitos no debe pasar';
  exception when check_violation then null;
  end;
  insert into pedimentos (embarque_id, numero, fecha_pago, tipo_cambio, valor_aduana, igi, dta, iva, prv)
  values (v_emb, '26161943 6004373', v_hoy - 2, 19.9, 127000, 5000, 500, 18000, 300);
  assert (select numero from pedimentos where embarque_id = v_emb) = '26 16 1943 6004373', 'número del pedimento como lo escribe la aduana';
  assert exists (select 1 from embarque_eventos where embarque_id = v_emb and tipo = 'pedimento_pagado'), 'pagar el pedimento es su etapa';
  insert into embarque_gastos (embarque_id, concepto, proveedor, monto, iva) values
    (v_emb, 'cargos_locales', 'Interteam', 8000, 1280), (v_emb, 'flete_local', 'Transportista Manzanillo', 12000, 1920);
  insert into embarque_gastos (embarque_id, concepto, proveedor, monto, iva, estimado) values (v_emb, 'honorarios', 'Careaga', 6000, 960, true);

  -- Preliminar: V = 6,400 × 19.75 = $126,400; G = 5,800 (IGI+DTA+PRV) + 8,000 + 12,000 + 6,000 (estimado) = $31,800.
  -- F900A = 1,600 × 19.75 × (1 + 31,800 / 126,400) = $39,550.
  v_cost := calcular_costeo_importacion(v_emb, 'preliminar');
  assert (select valor_mxn from costeos_importacion where id = v_cost) = 126400, 'valor de la mercancía';
  assert (select gastos_mxn from costeos_importacion where id = v_cost) = 31800, format('gastos del preliminar: %s', (select gastos_mxn from costeos_importacion where id = v_cost));
  assert (select iva_acreditable from costeos_importacion where id = v_cost) = 1280 + 1920 + 960 + 18000,
    'el IVA (de servicios y el del pedimento) queda aparte, como acreditable';
  assert (select costo_unitario from costeo_importacion_lineas where costeo_id = v_cost and articulo_id = v_f900) = 39550, 'F900A preliminar';
  perform cerrar_costeo_importacion(v_cost);
  assert (select costo from costos_articulo where articulo_id = v_f900) = 40250, 'el preliminar no mueve el catálogo';

  -- ---------------------------------------------------------------------------
  -- Recepción: la orden va en un embarque, así que NO toca el costo. Antes ponía
  -- USD 1,600 como costo del cabezal (27 %–109 % abajo del costo real).
  -- ---------------------------------------------------------------------------
  perform registrar_evento_importacion(v_emb, 'despacho', v_hoy - 1);
  perform pg_temp.como(v_alm);
  perform recibir_orden_compra(v_oc, (select jsonb_agg(jsonb_build_object('linea_id', id, 'cantidad', cantidad, 'almacen_id', v_pb))
                                      from v_oc_lineas where orden_compra_id = v_oc), 'MEHE-T-001');
  perform pg_temp.como_postgres();
  assert (select costo || ' ' || moneda from costos_articulo where articulo_id = v_f900) = '40250.0000 MXN',
    format('la recepción tocó el costo: %s', (select costo || ' ' || moneda from costos_articulo where articulo_id = v_f900));
  assert not exists (select 1 from historial_costos where articulo_id = v_f900 and origen = 'orden_compra'), 'la recepción dejó historial de costo';
  assert (select costo_unitario from movimientos_inventario where orden_compra_id = v_oc and articulo_id = v_f900) = 39550,
    'la entrada se valúa con el costeo del embarque, no con el precio en USD';
  assert exists (select 1 from embarque_eventos where embarque_id = v_emb and tipo = 'en_planta' and fecha = v_hoy), 'recibir marca "en planta"';

  -- La orden sin embarque sigue igual: la recepción sí actualiza su costo.
  perform pg_temp.como(v_comp);
  insert into ordenes_compra (proveedor_id, estado) values (v_prov, 'borrador') returning id into v_oc_nac;
  insert into oc_lineas (orden_compra_id, articulo_id, cantidad, costo_unitario) values (v_oc_nac, v_nac, 5, 120);
  update ordenes_compra set estado = 'enviada' where id = v_oc_nac;
  perform pg_temp.como(v_alm);
  perform recibir_orden_compra(v_oc_nac, (select jsonb_agg(jsonb_build_object('linea_id', id, 'cantidad', 5, 'almacen_id', v_pb))
                                          from v_oc_lineas where orden_compra_id = v_oc_nac));
  perform pg_temp.como_postgres();
  assert (select costo from costos_articulo where articulo_id = v_nac) = 120, 'la orden sin embarque sí actualiza el costo';

  -- ---------------------------------------------------------------------------
  -- Cuenta de gastos y costeo final: este sí mueve el costo, con historial y precio.
  -- ---------------------------------------------------------------------------
  perform pg_temp.como(v_imp);
  begin
    perform calcular_costeo_importacion(v_emb, 'final');
    assert false, 'el costeo final sin cuenta de gastos no debe pasar';
  exception when check_violation then null;
  end;
  select registrar_documento_importacion(v_emb, 'cuenta_gastos', v_emb || '/cuenta_gastos/cg.pdf', 'cg.pdf', jsonb_build_object(
    'folio', 'CG-T-123', 'fecha', (v_hoy - 0)::text, 'agente', 'Careaga',
    'conceptos', jsonb_build_array(
      jsonb_build_object('descripcion', 'Impuestos del pedimento', 'concepto', 'impuestos', 'monto', 5800, 'iva', 0),
      jsonb_build_object('descripcion', 'Honorarios', 'concepto', 'honorarios', 'monto', 6500, 'iva', 1040),
      jsonb_build_object('descripcion', 'Maniobras', 'concepto', 'maniobras', 'monto', 2500, 'iva', 400),
      jsonb_build_object('descripcion', 'Anticipo recibido', 'concepto', 'anticipo', 'monto', 40000, 'iva', 0)),
    'saldo', 4200)) into r;
  assert (select count(*) from embarque_gastos where embarque_id = v_emb and factura = 'CG-T-123') = 2,
    'de la cuenta de gastos entran honorarios y maniobras; impuestos y anticipo no se duplican';
  assert exists (select 1 from embarque_saldos where embarque_id = v_emb and tipo = 'saldo_agente' and monto = 4200), 'el saldo a favor queda por recuperar';
  assert exists (select 1 from embarque_documentos where embarque_id = v_emb and tipo = 'cuenta_gastos' and estado = 'recibido'), 'la CG queda en su casilla';
  -- Confirmar la misma CG otra vez no duplica gastos.
  perform registrar_documento_importacion(v_emb, 'cuenta_gastos', null, null, jsonb_build_object('folio', 'CG-T-123',
    'conceptos', jsonb_build_array(jsonb_build_object('concepto', 'honorarios', 'monto', 6500))));
  assert (select count(*) from embarque_gastos where embarque_id = v_emb and factura = 'CG-T-123') = 2, 'la CG se duplicó';

  -- Final: G = 5,800 + 8,000 + 12,000 + 6,500 + 2,500 = $34,800 (el estimado ya no entra).
  -- F900A = 31,600 × (1 + 34,800 / 126,400) = $40,300; N600A = 3,160 × 1.2753… = $4,030.
  v_cost2 := calcular_costeo_importacion(v_emb, 'final');
  assert (select gastos_mxn from costeos_importacion where id = v_cost2) = 34800, 'gastos del final';
  assert (select costo_unitario from costeo_importacion_lineas where costeo_id = v_cost2 and articulo_id = v_f900) = 40300, 'F900A final';
  assert (select costo_unitario from costeo_importacion_lineas where costeo_id = v_cost2 and articulo_id = v_n600) = 4030, 'N600A final';
  -- Algo cambió entre calcular y cerrar: no se cierra un cálculo viejo.
  insert into embarque_gastos (embarque_id, concepto, monto) values (v_emb, 'limpieza', 100) returning id into v_pago;
  begin
    perform cerrar_costeo_importacion(v_cost2);
    assert false, 'se cerró un costeo calculado con gastos viejos';
  exception when check_violation then null;
  end;
  delete from embarque_gastos where id = v_pago;
  -- Quien no es de importaciones o compras no cierra costeos.
  perform pg_temp.como(v_fin);
  begin
    perform cerrar_costeo_importacion(v_cost2);
    assert false, 'finanzas cerró un costeo';
  exception when insufficient_privilege then null;
  end;
  perform pg_temp.como(v_alm);
  begin
    perform calcular_costeo_importacion(v_emb, 'final');
    assert false, 'almacén calculó un costeo';
  exception when insufficient_privilege then null;
  end;
  assert not exists (select 1 from costeos_importacion) and not exists (select 1 from pedimentos) and not exists (select 1 from embarque_gastos),
    'almacén vio costeos, pedimentos o gastos';

  perform pg_temp.como(v_imp);
  v_n := cerrar_costeo_importacion(v_cost2);
  assert v_n = 2, format('artículos actualizados: %s', v_n);
  perform pg_temp.como_postgres();
  select * into r from costos_articulo where articulo_id = v_f900;
  assert r.costo = 40300 and r.moneda = 'MXN' and r.proveedor_id = v_prov, format('costo puesto en planta del F900A: %s %s', r.costo, r.moneda);
  select * into r from historial_costos where articulo_id = v_f900 order by id desc limit 1;
  assert r.origen = 'importacion' and r.costo_anterior = 40250 and r.costo_nuevo = 40300, format('historial: %s %s → %s', r.origen, r.costo_anterior, r.costo_nuevo);
  assert r.referencia like 'EMB-%costeo final v1', format('referencia del historial: %s', r.referencia);
  -- Componentes: precio = costo ÷ 0.70.
  assert (select precio from precios_lista where articulo_id = v_f900) = 57571.43,
    format('precio de lista del F900A: %s', (select precio from precios_lista where articulo_id = v_f900));
  assert (select costo_total from costos_calculados where articulo_id = v_n600) = 4030, 'costeo recalculado del N600A';

  -- Un complemento después del final pide otra versión.
  perform pg_temp.como(v_imp);
  insert into embarque_gastos (embarque_id, concepto, proveedor, monto) values (v_emb, 'almacenaje', 'OCUPA', 1500);
  assert exists (select 1 from alertas_importacion() where embarque_id = v_emb and tipo = 'costeo'), 'alerta: gastos nuevos después del costeo final';
  -- El saldo a favor que no regresa a tiempo es alerta.
  update embarque_saldos set fecha_origen = v_hoy - 20, fecha_esperada = null where embarque_id = v_emb;
  assert exists (select 1 from alertas_importacion() where embarque_id = v_emb and tipo = 'por_recuperar'), 'alerta: saldo a favor sin recuperar';
  assert (select por_recuperar_mxn from v_embarque_dinero where embarque_id = v_emb) = 4200, 'por recuperar';
  assert exists (select 1 from hallazgos('importaciones') where titulo like '%por recuperar%'), 'hallazgo de dinero por recuperar';
  -- Con comprobante, falta que el proveedor confirme que le llegó (Tavol: 38 días retenido).
  assert exists (select 1 from alertas_importacion() where embarque_id = v_emb and tipo = 'pago' and titulo like '%no ha confirmado%'),
    'alerta: el proveedor no confirma el pago';
  update embarque_pagos set estado = 'confirmado' where embarque_id = v_emb;
  assert not exists (select 1 from alertas_importacion() where embarque_id = v_emb and tipo = 'pago'), 'pagos confirmados y con comprobante ya no alertan';
  -- No se quita una orden que ya tiene pagos.
  begin
    delete from embarque_oc where embarque_id = v_emb and orden_compra_id = v_oc;
    assert false, 'se quitó del embarque una orden con pagos';
  exception when check_violation then null;
  end;

  -- ---------------------------------------------------------------------------
  -- Tiempo de entrega real para el reabasto: de la PI (75 días antes) a planta (hoy).
  -- ---------------------------------------------------------------------------
  select count(*) into v_n from generate_series(v_hoy - 75 + 1, v_hoy, interval '1 day') d where extract(isodow from d) < 6;
  select * into r from entrega_real_proveedores() where proveedor_id = v_prov;
  assert r.embarques = 1 and r.dias_naturales = 75 and r.dias_habiles = v_n, format('tiempo real: %s naturales, %s hábiles', r.dias_naturales, r.dias_habiles);
  perform pg_temp.como(v_alm);
  assert (select dias_entrega from reabasto() where articulo_id = v_n600) = v_n,
    format('el reabasto usa el tiempo real (%s días hábiles), no los 60 capturados', v_n);

  -- TC real de un bloque de la hoja "Calculo costos import": 46,367.80 / 2,274 = 20.39.
  perform pg_temp.como(v_comp);
  insert into ordenes_compra (proveedor_id, moneda, tipo_cambio) values (v_prov, 'USD', 18) returning id into v_oc_celdas;
  insert into oc_lineas (orden_compra_id, articulo_id, cantidad, costo_unitario) values (v_oc_celdas, v_n600, 1, 2274);
  update ordenes_compra set estado = 'enviada' where id = v_oc_celdas;
  perform pg_temp.como(v_imp);
  insert into embarques (descripcion, modalidad, eta) values ('T Celdas de carga', 'fcl', v_hoy + 6) returning id into v_emb2;
  insert into embarque_oc (embarque_id, orden_compra_id) values (v_emb2, v_oc_celdas);
  insert into embarque_pagos (embarque_id, orden_compra_id, concepto, fecha, monto, tipo_cambio)
  values (v_emb2, v_oc_celdas, 'total', v_hoy - 1, 2274, round(46367.80 / 2274, 4));
  assert round(tc_real_oc(v_oc_celdas), 2) = 20.39, format('TC real de la hoja: %s', tc_real_oc(v_oc_celdas));
  assert (select dias_libres_demoras from embarques where id = v_emb2) = 21, 'FCL: 21 días libres de demoras si no se dice otra cosa';

  -- Almacén se entera de lo que llega (sin montos).
  perform registrar_evento_importacion(v_emb2, 'zarpe', v_hoy - 10);
  perform pg_temp.como(v_alm);
  -- (Se muestran las 3 llegadas más próximas: con otros embarques en la base, el de la prueba puede no ser de ellas.)
  assert exists (select 1 from v_embarques where id = v_emb2 and fase = 'transito' and llegada_planta_estimada <= v_hoy + 14),
    'el embarque en el mar no tiene fecha de llegada a planta';
  assert exists (select 1 from hallazgos('almacen') where area = 'almacen' and titulo like 'Llega mercancía importada%'),
    'almacén no se enteró de lo que llega';
  assert not exists (select 1 from hallazgos('almacen') where titulo || detalle ~ '(\$|USD)'), 'a almacén le salió un hallazgo con dinero';

  -- Avisos a la campana (si ya está 20261003000071).
  perform pg_temp.como(v_imp);
  perform registrar_evento_importacion(v_emb2, 'arribo', v_hoy);
  perform pg_temp.como_postgres();
  if to_regproc('public.avisar') is not null then
    assert exists (select 1 from avisos where usuario_id = v_alm and tipo = 'importacion_arribo' and titulo like 'Llegó a puerto%'),
      'almacén no recibió el aviso de arribo';
    assert not exists (select 1 from avisos where usuario_id = v_vend and tipo like 'importacion_%'), 'ventas recibió avisos de importación';
    assert exists (select 1 from avisos where usuario_id = v_comp and tipo = 'importacion_costeo_final'), 'compras no supo que cambió el costo';
    perform avisos_importacion();
    assert exists (select 1 from avisos where usuario_id = v_imp and tipo = 'importacion_por_recuperar'), 'importaciones no recibió sus alertas';
    v_n := (select count(*) from avisos where usuario_id = v_imp);
    perform avisos_importacion();
    assert (select count(*) from avisos where usuario_id = v_imp) = v_n, 'la misma alerta se repitió el mismo día';
  end if;
end $$;

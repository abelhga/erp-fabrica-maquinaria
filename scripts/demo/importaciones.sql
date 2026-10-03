-- =============================================================================
-- Datos de demostración de importaciones (base LOCAL, nunca producción).
--
--   psql "$DB_URL" -f scripts/demo/importaciones.sql
--
-- Seis embarques en distintas etapas con los proveedores del informe de
-- importaciones (Yao Han, Xi'an Gavin, Hangzhou Jusheng, Henan Lanyi, Tavol) y sus
-- artículos importados del catálogo (si la base no los trae, se crean con clave
-- DEMO-IMP-…). Las fechas van contra hoy para que las alertas tengan sentido.
-- Todo lo que crea lleva "DEMO" en las notas; si ya están, no hace nada.
--
-- Se hace con las funciones y los permisos de quien lo haría (Alondra en
-- importaciones@, compras@), salvo una cosa: las órdenes que ya llegaron se marcan
-- como recibidas SIN movimientos de almacén, porque los movimientos no se pueden
-- borrar y moverían para siempre las existencias de artículos reales.
-- Ojo: el costeo final cerrado del embarque de Yao Han cambia el costo (y el
-- precio) de tres cosedoras del catálogo local, que es justo lo que hace en la vida real.
--
-- Requiere los usuarios de scripts/usuarios-locales.mjs.
-- =============================================================================

create or replace function pg_temp.como(p_correo text) returns uuid language plpgsql as $f$
declare v uuid;
begin
  select id into v from perfiles where correo = p_correo;
  if v is null then raise exception 'Falta el usuario %: corre antes node scripts/usuarios-locales.mjs', p_correo; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', v, 'role', 'authenticated')::text, true);
  return v;
end $f$;

create or replace function pg_temp.proveedor(p_patron text, p_nombre text, p_pais text) returns uuid language plpgsql as $f$
declare v uuid;
begin
  select id into v from proveedores where nombre ~* p_patron order by es_importacion desc, creado_en limit 1;
  if v is null then
    insert into proveedores (nombre, razon_social, pais, es_importacion, moneda, legacy_id)
    values (p_nombre, p_nombre, p_pais, true, 'USD', 'DEMO-PROV-' || upper(left(regexp_replace(p_nombre, '\W', '', 'g'), 12)))
    on conflict (legacy_id) do update set nombre = excluded.nombre returning id into v;
  end if;
  return v;
end $f$;

create or replace function pg_temp.articulo(p_nombre text, p_prov uuid) returns uuid language plpgsql as $f$
declare v uuid;
begin
  select id into v from articulos where nombre = p_nombre and activo order by clave limit 1;
  if v is null then
    insert into articulos (clave, tipo, nombre, es_importado, proveedor_id, tiempo_entrega_dias)
    values ('DEMO-IMP-' || upper(left(md5(p_nombre), 6)), 'componente', p_nombre, true, p_prov, 60)
    on conflict (clave) do update set nombre = excluded.nombre returning id into v;
  end if;
  return v;
end $f$;

-- Orden de compra en USD, enviada al proveedor (como compras).
create or replace function pg_temp.orden(p_prov uuid, p_fecha date, p_tc numeric, p_condiciones text, p_partidas jsonb) returns uuid
language plpgsql as $f$
declare v uuid; x jsonb;
begin
  perform pg_temp.como('compras@hegamex.com');
  insert into ordenes_compra (proveedor_id, moneda, tipo_cambio, tasa_iva, fecha, condiciones, notas)
  values (p_prov, 'USD', p_tc, 0, p_fecha, p_condiciones, 'DEMO importaciones') returning id into v;
  for x in select * from jsonb_array_elements(p_partidas) loop
    insert into oc_lineas (orden_compra_id, articulo_id, descripcion, cantidad, costo_unitario)
    values (v, (x->>'a')::uuid, x->>'d', (x->>'q')::numeric, (x->>'p')::numeric);
  end loop;
  update ordenes_compra set estado = 'enviada', fecha_entrega = p_fecha + 90 where id = v;
  return v;
end $f$;

do $$
declare
  hoy date := (now() at time zone 'America/Mexico_City')::date;
  v_yao uuid; v_gavin uuid; v_hz uuid; v_lanyi uuid; v_tavol uuid;
  oc_a uuid; oc_b uuid; oc_c uuid; oc_d uuid; oc_e uuid; oc_f uuid;
  e_a uuid; e_b uuid; e_c uuid; e_d uuid; e_e uuid; e_f uuid; v_c uuid;
begin
  if exists (select 1 from embarques where notas like 'DEMO%') then
    raise notice 'Los embarques DEMO ya estaban: no se hizo nada.';
    return;
  end if;
  perform pg_temp.como('importaciones@hegamex.com');

  v_yao := pg_temp.proveedor('yao ?han', 'Yao Han Industries Co., Ltd.', 'Taiwán');
  v_gavin := pg_temp.proveedor('gavin', 'Xi''an Gavin Electronic Technology Co., Ltd.', 'China');
  v_hz := pg_temp.proveedor('jusheng', 'Hangzhou Jusheng Machinery and Equipment Co., Ltd.', 'China');
  v_lanyi := pg_temp.proveedor('lanyi', 'Henan Lanyi Environmental Technology Co., Ltd.', 'China');
  v_tavol := pg_temp.proveedor('tavol', 'Shandong Tavol Machinery Co., Ltd.', 'China');

  -- ---------------------------------------------------------------------------
  -- A. Yao Han: cosedoras y cabezales. CERRADO, con costeo final cerrado.
  -- ---------------------------------------------------------------------------
  oc_a := pg_temp.orden(v_yao, hoy - 120, 19.10, '50 % anticipo, 50 % antes del embarque', jsonb_build_array(
    jsonb_build_object('a', pg_temp.articulo('Cosedora manual N600A Yao Han', v_yao), 'd', 'Portable bag closer N600A', 'q', 20, 'p', 175),
    jsonb_build_object('a', pg_temp.articulo('Cosedora manual F300A Yao Han', v_yao), 'd', 'Portable bag closer F300A', 'q', 10, 'p', 165),
    jsonb_build_object('a', pg_temp.articulo('Cabezal cosedor F900', v_yao), 'd', 'Sewing head F900A', 'q', 2, 'p', 1450)));
  perform pg_temp.como('importaciones@hegamex.com');
  insert into embarques (descripcion, modalidad, incoterm, puerto_origen, naviera, forwarder, agente_aduanal, referencia_agente, bl, buque, viaje,
                         etd, eta, bultos, peso_kg, volumen_m3, notas)
  values ('20 cosedoras N600A, 10 F300A y 2 cabezales F900A', 'lcl', 'CFR', 'Taichung', 'CMA CGM', 'Interteam', 'Careaga', 'LCM2190-2026',
          'CMDUTXG0418877', 'CMA CGM Tage', '0MXEXE1MA', hoy - 89, hoy - 62, 14, 512, 2.4, 'DEMO · reposición de cosedoras')
  returning id into e_a;
  insert into embarque_oc (embarque_id, orden_compra_id, factura) values (e_a, oc_a, 'MEHE-20260601003');
  insert into embarque_pagos (embarque_id, orden_compra_id, concepto, estado, fecha, monto, tipo_cambio, comprobante, confirmado_en) values
    (e_a, oc_a, 'anticipo', 'confirmado', hoy - 118, 4025, 19.10, e_a || '/comprobante/anticipo.pdf', hoy - 116),
    (e_a, oc_a, 'saldo', 'confirmado', hoy - 94, 4025, 19.30, e_a || '/comprobante/saldo.pdf', hoy - 92);
  perform registrar_evento_importacion(e_a, 'pi', hoy - 120);
  perform registrar_evento_importacion(e_a, 'listo', hoy - 95);
  perform registrar_evento_importacion(e_a, 'zarpe', hoy - 88);
  perform registrar_evento_importacion(e_a, 'documentos_agente', hoy - 85);
  perform registrar_evento_importacion(e_a, 'arribo', hoy - 62);
  perform registrar_evento_importacion(e_a, 'revalidacion', hoy - 60);
  perform registrar_evento_importacion(e_a, 'previo', hoy - 58);
  insert into pedimentos (embarque_id, numero, fecha_pago, tipo_cambio, valor_aduana, igi, dta, iva, prv)
  values (e_a, '26 16 1821 6002190', hoy - 57, 19.20, 154560, 7800, 1100, 26500, 290);
  perform registrar_evento_importacion(e_a, 'despacho', hoy - 56);
  perform registrar_evento_importacion(e_a, 'en_planta', hoy - 55);
  insert into embarque_gastos (embarque_id, concepto, proveedor, factura, fecha, monto, iva) values
    (e_a, 'cargos_locales', 'Interteam', 'ITM-55120', hoy - 60, 7200, 1152),
    (e_a, 'flete_local', 'Transportista Manzanillo', 'A-1187', hoy - 55, 9800, 1568),
    (e_a, 'honorarios', 'Careaga', 'CG-LCM2190', hoy - 52, 5800, 928),
    (e_a, 'maniobras', 'Careaga', 'CG-LCM2190', hoy - 52, 2100, 336);
  perform registrar_evento_importacion(e_a, 'cuenta_gastos', hoy - 52);
  insert into embarque_saldos (embarque_id, tipo, deudor, monto, fecha_origen, recuperado_en, monto_recuperado)
  values (e_a, 'saldo_agente', 'Agencia Aduanal Careaga', 12450, hoy - 52, hoy - 30, 12450);
  perform registrar_evento_importacion(e_a, 'cierre', hoy - 30);
  update embarque_documentos set estado = 'aceptado', recibido_en = hoy - 80, archivo_nombre = upper(tipo) || ' MEHE-20260601003.pdf' where embarque_id = e_a;
  update oc_lineas set recibido = cantidad where orden_compra_id = oc_a;
  update ordenes_compra set estado = 'recibida', factura_proveedor = 'MEHE-20260601003' where id = oc_a;
  perform cerrar_costeo_importacion(calcular_costeo_importacion(e_a, 'preliminar'));
  perform cerrar_costeo_importacion(calcular_costeo_importacion(e_a, 'final'));

  -- ---------------------------------------------------------------------------
  -- B. Xi'an Gavin: celdas de carga. EN PLANTA, cuenta de gastos recibida, saldo a
  --    favor que no regresa (alerta) y costeo final por cerrar.
  -- ---------------------------------------------------------------------------
  oc_b := pg_temp.orden(v_gavin, hoy - 75, 19.45, 'Pago total contra PI', jsonb_build_array(
    jsonb_build_object('a', pg_temp.articulo('Celda de carga tipo S, (5,000/10,000 lbs), cable de 6 m', v_gavin), 'd', 'Load cell S-type GSS 5t', 'q', 71, 'p', 35.5),
    jsonb_build_object('a', pg_temp.articulo('Indicador Modelo GSI401-2, Inoxidable', v_gavin), 'd', 'Weighing indicator GSI401-2', 'q', 6, 'p', 88),
    jsonb_build_object('a', pg_temp.articulo('Caja suma 4 canales Modelo GJB201, Inoxidable', v_gavin), 'd', 'Junction box GJB201', 'q', 6, 'p', 22)));
  perform pg_temp.como('importaciones@hegamex.com');
  insert into embarques (descripcion, modalidad, incoterm, puerto_origen, naviera, forwarder, agente_aduanal, referencia_agente, bl, etd, eta, bultos, peso_kg, volumen_m3, notas)
  values ('71 celdas de carga, 6 indicadores y 6 cajas suma', 'lcl', 'CFR', 'Shekou', 'COSCO', 'Sea Bridge', 'Careaga', 'LCM2311-2026',
          'SBLSZX2606210', hoy - 57, hoy - 36, 9, 236, 0.9, 'DEMO · reposición de celdas')
  returning id into e_b;
  insert into embarque_oc (embarque_id, orden_compra_id, factura) values (e_b, oc_b, 'EO-260603-002');
  insert into embarque_pagos (embarque_id, orden_compra_id, concepto, estado, fecha, monto, tipo_cambio, comprobante, confirmado_en)
  values (e_b, oc_b, 'total', 'confirmado', hoy - 74, 3180.5, 19.45, e_b || '/comprobante/pago.pdf', hoy - 72);
  perform registrar_evento_importacion(e_b, 'pi', hoy - 75);
  perform registrar_evento_importacion(e_b, 'listo', hoy - 60);
  perform registrar_evento_importacion(e_b, 'zarpe', hoy - 57);
  perform registrar_evento_importacion(e_b, 'documentos_agente', hoy - 55);
  perform registrar_evento_importacion(e_b, 'arribo', hoy - 36);
  perform registrar_evento_importacion(e_b, 'revalidacion', hoy - 34);
  perform registrar_evento_importacion(e_b, 'previo', hoy - 32);
  insert into pedimentos (embarque_id, numero, fecha_pago, tipo_cambio, valor_aduana, igi, dta, iva, prv)
  values (e_b, '26 16 1821 6002311', hoy - 31, 19.30, 61860, 3100, 950, 10900, 290);
  perform registrar_evento_importacion(e_b, 'despacho', hoy - 30);
  perform registrar_evento_importacion(e_b, 'en_planta', hoy - 29);
  insert into embarque_gastos (embarque_id, concepto, proveedor, factura, fecha, monto, iva) values
    (e_b, 'cargos_locales', 'Sea Bridge', 'SB-77310', hoy - 35, 6850, 1096),
    (e_b, 'desconsolidacion', 'Sea Bridge', 'SB-77310', hoy - 35, 1900, 304),
    (e_b, 'flete_local', 'Transportista Manzanillo', 'A-1203', hoy - 29, 5500, 880),
    (e_b, 'honorarios', 'Careaga', 'CG-LCM2311', hoy - 27, 4900, 784),
    (e_b, 'maniobras', 'Careaga', 'CG-LCM2311', hoy - 27, 1750, 280);
  perform registrar_evento_importacion(e_b, 'cuenta_gastos', hoy - 27);
  insert into embarque_saldos (embarque_id, tipo, deudor, monto, fecha_origen)
  values (e_b, 'saldo_agente', 'Agencia Aduanal Careaga', 18625.03, hoy - 27);
  update embarque_documentos set estado = 'aceptado', recibido_en = hoy - 50, archivo_nombre = upper(tipo) || ' EO-260603-002.pdf'
  where embarque_id = e_b and tipo <> 'eir';
  update oc_lineas set recibido = cantidad where orden_compra_id = oc_b;
  update ordenes_compra set estado = 'recibida', factura_proveedor = 'EO-260603-002' where id = oc_b;
  perform cerrar_costeo_importacion(calcular_costeo_importacion(e_b, 'preliminar'));
  perform calcular_costeo_importacion(e_b, 'final');

  -- ---------------------------------------------------------------------------
  -- C. Hangzhou Jusheng: silo y helicoidales en contenedor. EN PUERTO, la carta
  --    3.1.8 con observaciones y los días libres corriendo.
  -- ---------------------------------------------------------------------------
  oc_c := pg_temp.orden(v_hz, hoy - 80, 19.55, '30 % anticipo, 70 % al estar listo', jsonb_build_array(
    jsonb_build_object('a', pg_temp.articulo('Silo Auxiliar fijo 60 Toneladas con accesorios', v_hz), 'd', 'Cement silo 60t with accessories', 'q', 1, 'p', 14800),
    jsonb_build_object('a', pg_temp.articulo('Helicoidal de descarga de 10" x 9 metros para cemento', v_hz), 'd', 'Screw conveyor 273mm x 9m', 'q', 2, 'p', 1050),
    jsonb_build_object('a', pg_temp.articulo('Helicoidal de descarga de 8" x 9 metros para cemento', v_hz), 'd', 'Screw conveyor 219mm x 9m', 'q', 2, 'p', 890),
    jsonb_build_object('a', pg_temp.articulo('Colgante con balero para bazuca de 8"', v_hz), 'd', 'Hanger bearing 219mm', 'q', 6, 'p', 18),
    jsonb_build_object('a', pg_temp.articulo('Buje de acople para bazuca de 8"', v_hz), 'd', 'Coupling bush 219mm', 'q', 6, 'p', 3.2),
    jsonb_build_object('a', pg_temp.articulo('Moto Vibrador eléctrico DKTEC 1/2 HP 3450 RPM 3F 220-360 Volts Modelo MVE500/3', v_hz), 'd', 'Vibration motor MVE500/3', 'q', 4, 'p', 120)));
  perform pg_temp.como('importaciones@hegamex.com');
  insert into embarques (descripcion, modalidad, incoterm, puerto_origen, naviera, forwarder, agente_aduanal, referencia_agente, bl, contenedores, buque, viaje,
                         etd, eta, dias_libres_almacenaje, dias_libres_demoras, bultos, peso_kg, notas)
  values ('Silo de 60 t, 4 helicoidales de 8 y 10 pulgadas, colgantes y motovibradores', 'fcl', 'CFR', 'Qingdao', 'Sinotrans', null, 'LME', 'ZMZI04373-2026',
          'SNLGQDXL200955', 'SNLU4401872 40HC', 'Sinotrans Shanghai', '2614E', hoy - 27, hoy - 6, 7, 21, 81, 23500, 'DEMO · silo para cliente que espera')
  returning id into e_c;
  insert into embarque_oc (embarque_id, orden_compra_id, factura) values (e_c, oc_c, 'JS26083');
  insert into embarque_pagos (embarque_id, orden_compra_id, concepto, estado, fecha, monto, tipo_cambio, comprobante, confirmado_en) values
    (e_c, oc_c, 'anticipo', 'confirmado', hoy - 70, 5786.16, 19.55, e_c || '/comprobante/anticipo.pdf', hoy - 68),
    (e_c, oc_c, 'saldo', 'confirmado', hoy - 32, 13501.04, 19.70, e_c || '/comprobante/saldo.pdf', hoy - 30);
  perform registrar_evento_importacion(e_c, 'pi', hoy - 80);
  perform registrar_evento_importacion(e_c, 'produccion', hoy - 68);
  perform registrar_evento_importacion(e_c, 'listo', hoy - 35);
  perform registrar_evento_importacion(e_c, 'zarpe', hoy - 27);
  perform registrar_evento_importacion(e_c, 'documentos_agente', hoy - 24);
  perform registrar_evento_importacion(e_c, 'arribo', hoy - 6);
  perform registrar_evento_importacion(e_c, 'revalidacion', hoy - 2);
  update embarque_documentos set estado = 'recibido', recibido_en = hoy - 25, archivo_nombre = upper(tipo) || ' JS26083.pdf'
  where embarque_id = e_c and tipo in ('pi', 'ci', 'pl', 'bl_draft', 'bl', 'certificado_origen', 'pedimento_exportacion', 'oc', 'contrato', 'ficha_tecnica',
                                      'carta_instrucciones', 'carta_encomienda', 'aviso_arribo', 'bl_revalidado');
  update embarque_documentos set estado = 'observado', observaciones = 'El agente pide corregir marca y modelo del silo', ultimo_seguimiento = hoy - 1
  where embarque_id = e_c and tipo = 'carta_318';
  update embarque_documentos set ultimo_seguimiento = hoy - 2 where embarque_id = e_c and tipo = 'proforma_pedimento';
  insert into embarque_gastos (embarque_id, concepto, proveedor, factura, fecha, moneda, monto, tipo_cambio, iva, estimado) values
    (e_c, 'cargos_locales', 'Cooce (Sinotrans)', 'COO-26-4410', hoy - 5, 'USD', 960, 19.70, 153.6, false),
    (e_c, 'flete_local', 'Transportista Manzanillo', null, hoy, 'MXN', 38000, 1, 6080, true),
    (e_c, 'honorarios', 'LME', null, hoy, 'MXN', 9500, 1, 1520, true);
  insert into embarque_saldos (embarque_id, tipo, deudor, moneda, monto, tipo_cambio, fecha_origen)
  values (e_c, 'garantia_contenedor', 'Sinotrans (Cooce)', 'USD', 1000, 19.70, hoy - 5);

  -- ---------------------------------------------------------------------------
  -- D. Henan Lanyi (Alibaba, pagos por EBANX): bandas flexibles. EN EL MAR, llega
  --    en 5 días, la ETA cambió y faltan documentos para el agente.
  -- ---------------------------------------------------------------------------
  oc_d := pg_temp.orden(v_lanyi, hoy - 50, 19.60, '30 % anticipo y liquidación por Alibaba (EBANX)', jsonb_build_array(
    jsonb_build_object('a', pg_temp.articulo('Banda flexible tipo roller motorizada 10m (50 cm de ancho)', v_lanyi), 'd', 'Flexible powered roller conveyor 10m x 500mm', 'q', 3, 'p', 1650),
    jsonb_build_object('a', pg_temp.articulo('Banda flexible skatewheel de gravedad de 10m', v_lanyi), 'd', 'Flexible skatewheel conveyor 10m', 'q', 4, 'p', 560)));
  perform pg_temp.como('importaciones@hegamex.com');
  insert into embarques (descripcion, modalidad, incoterm, puerto_origen, naviera, forwarder, agente_aduanal, referencia_agente, bl, etd, eta, notas)
  values ('3 bandas flexibles motorizadas y 4 de gravedad de 10 m', 'lcl', 'CFR', 'Shanghái', 'TS Lines', 'Newtral', 'Careaga', 'LCM3282-2026',
          '800610246498', hoy - 21, hoy + 2, 'DEMO · bandas flexibles por Alibaba')
  returning id into e_d;
  insert into embarque_oc (embarque_id, orden_compra_id, factura) values (e_d, oc_d, 'LY-2026-0812');
  insert into embarque_pagos (embarque_id, orden_compra_id, concepto, estado, fecha, monto, tipo_cambio, metodo, comprobante, confirmado_en) values
    (e_d, oc_d, 'anticipo', 'confirmado', hoy - 45, 2157, 19.62, 'ebanx', e_d || '/comprobante/ebanx-anticipo.pdf', hoy - 45),
    (e_d, oc_d, 'saldo', 'pagado', hoy - 24, 5033, 19.48, 'ebanx', null, null);
  perform registrar_evento_importacion(e_d, 'pi', hoy - 50);
  perform registrar_evento_importacion(e_d, 'listo', hoy - 26);
  perform registrar_evento_importacion(e_d, 'zarpe', hoy - 21);
  update embarques set eta = hoy + 5 where id = e_d;   -- la naviera la movió: queda en la historia
  update embarque_documentos set estado = 'recibido', recibido_en = hoy - 18, archivo_nombre = upper(tipo) || ' LY-2026-0812.pdf'
  where embarque_id = e_d and tipo in ('pi', 'ci', 'pl', 'bl_draft', 'bl', 'oc', 'contrato');
  update embarque_documentos set ultimo_seguimiento = hoy - 3 where embarque_id = e_d and tipo in ('certificado_origen', 'pedimento_exportacion');

  -- ---------------------------------------------------------------------------
  -- E. Tavol: patines y volteador en contenedor de 20'. EN PUERTO más de los días
  --    libres; el primer anticipo se quedó retenido en el banco intermediario.
  -- ---------------------------------------------------------------------------
  oc_e := pg_temp.orden(v_tavol, hoy - 140, 18.95, '40 % anticipo, 60 % contra BL', jsonb_build_array(
    jsonb_build_object('a', pg_temp.articulo('Patin hidrahulico manual para 3 Ton con ruedas de poliuretano', v_tavol), 'd', 'Hand pallet truck 3T PU wheels', 'q', 20, 'p', 155),
    jsonb_build_object('a', pg_temp.articulo('Volteador 360 para montacargas', v_tavol), 'd', '360° rotator for forklift', 'q', 1, 'p', 2400)));
  perform pg_temp.como('importaciones@hegamex.com');
  insert into embarques (descripcion, modalidad, incoterm, puerto_origen, naviera, forwarder, agente_aduanal, referencia_agente, bl, contenedores,
                         etd, eta, dias_libres_almacenaje, dias_libres_demoras, notas)
  values ('20 patines hidráulicos de 3 t y un volteador 360', 'fcl', 'CIF', 'Qingdao', 'TS Lines', null, 'Careaga', 'LCM3389-2026',
          'TSLJKTB610E4019', 'TSLU2098811 20GP', hoy - 31, hoy - 13, 7, 14, 'DEMO · con reclamo de flete CIF')
  returning id into e_e;
  insert into embarque_oc (embarque_id, orden_compra_id, factura) values (e_e, oc_e, 'TVL-IVY-20260815');
  insert into embarque_pagos (embarque_id, orden_compra_id, concepto, estado, fecha, monto, tipo_cambio, comprobante, confirmado_en, notas) values
    (e_e, oc_e, 'anticipo', 'devuelto', hoy - 130, 2200, 18.95, e_e || '/comprobante/anticipo-1.pdf', null, 'Retenido 38 días en el banco intermediario y devuelto'),
    (e_e, oc_e, 'anticipo', 'confirmado', hoy - 92, 2200, 19.05, e_e || '/comprobante/anticipo-2.pdf', hoy - 90, 'Reenvío del 40 %'),
    (e_e, oc_e, 'saldo', 'pagado', hoy - 35, 3300, 19.40, e_e || '/comprobante/saldo.pdf', null, null);
  perform registrar_evento_importacion(e_e, 'pi', hoy - 140);
  perform registrar_evento_importacion(e_e, 'listo', hoy - 40);
  perform registrar_evento_importacion(e_e, 'zarpe', hoy - 30);
  perform registrar_evento_importacion(e_e, 'documentos_agente', hoy - 28);
  update embarques set eta = hoy - 10 where id = e_e;
  perform registrar_evento_importacion(e_e, 'arribo', hoy - 10);
  perform registrar_evento_importacion(e_e, 'revalidacion', hoy - 1);
  update embarque_documentos set estado = 'aceptado', recibido_en = hoy - 20, archivo_nombre = upper(tipo) || ' TVL-IVY-20260815.pdf'
  where embarque_id = e_e and tipo in ('pi', 'ci', 'pl', 'bl_draft', 'bl', 'poliza', 'certificado_origen', 'pedimento_exportacion', 'oc', 'contrato',
                                      'ficha_tecnica', 'carta_318', 'carta_instrucciones', 'carta_encomienda', 'aviso_arribo', 'bl_revalidado');
  insert into embarque_gastos (embarque_id, concepto, proveedor, factura, fecha, moneda, monto, tipo_cambio, iva)
  values (e_e, 'cargos_locales', 'Agunsa (TS Lines)', 'AGU-998120', hoy - 9, 'USD', 1150, 19.40, 184);
  insert into embarque_saldos (embarque_id, tipo, deudor, moneda, monto, tipo_cambio, fecha_origen)
  values (e_e, 'garantia_contenedor', 'TS Lines (Agunsa)', 'USD', 1000, 19.40, hoy - 9);

  -- ---------------------------------------------------------------------------
  -- F. Yao Han MEHE-20261001001: EN PRODUCCIÓN, anticipo pagado y saldo programado.
  -- ---------------------------------------------------------------------------
  oc_f := pg_temp.orden(v_yao, hoy - 16, 18.85, '50 % anticipo, 50 % antes del embarque', jsonb_build_array(
    jsonb_build_object('a', pg_temp.articulo('Cosedora manual N620A Yao Han', v_yao), 'd', 'Portable bag closer N620A', 'q', 10, 'p', 210),
    jsonb_build_object('a', pg_temp.articulo('Cabezal cosedor F900', v_yao), 'd', 'Sewing head F900A', 'q', 1, 'p', 1450)));
  perform pg_temp.como('importaciones@hegamex.com');
  insert into embarques (descripcion, modalidad, incoterm, puerto_origen, forwarder, agente_aduanal, etd, eta, notas)
  values ('10 cosedoras N620A y un cabezal F900A', 'lcl', 'CFR', 'Taichung', 'Interteam', 'Careaga', hoy + 12, hoy + 38, 'DEMO · MEHE-20261001001')
  returning id into e_f;
  insert into embarque_oc (embarque_id, orden_compra_id, factura) values (e_f, oc_f, 'MEHE-20261001001');
  insert into embarque_pagos (embarque_id, orden_compra_id, concepto, estado, fecha, monto, tipo_cambio, comprobante, confirmado_en) values
    (e_f, oc_f, 'anticipo', 'confirmado', hoy - 14, 1775, 18.85, e_f || '/comprobante/anticipo.pdf', hoy - 13);
  insert into embarque_pagos (embarque_id, orden_compra_id, concepto, estado, fecha, monto) values (e_f, oc_f, 'saldo', 'programado', hoy + 6, 1775);
  perform registrar_evento_importacion(e_f, 'pi', hoy - 15);
  perform registrar_evento_importacion(e_f, 'produccion', hoy - 10);
  update embarque_documentos set estado = 'recibido', recibido_en = hoy - 15, archivo_nombre = 'PI MEHE-20261001001.pdf' where embarque_id = e_f and tipo = 'pi';

  raise notice 'Embarques DEMO: % % % % % %', (select folio from embarques where id = e_a), (select folio from embarques where id = e_b),
    (select folio from embarques where id = e_c), (select folio from embarques where id = e_d), (select folio from embarques where id = e_e),
    (select folio from embarques where id = e_f);
end $$;

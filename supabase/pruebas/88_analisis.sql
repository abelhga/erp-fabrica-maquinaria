-- BI de dirección: ubicar clientes, que el mapa cuadre con el tablero, familias de
-- producto, metas y quién puede ver qué. Las ventas de prueba van en 2016-2017 (libro de
-- la hoja, antes de los datos reales) y en 2032 (pedidos del ERP): lo medido solo depende
-- de esta prueba.
do $$
declare
  v_dir uuid; v_ger uuid; v_ven uuid; v_alm uuid; v_adm uuid;
  v_qro uuid; v_tepa uuid; v_gdl uuid; v_cdmx uuid; v_edomex uuid; v_raro1 uuid; v_raro2 uuid; v_nada uuid; v_gua uuid;
  v_frio uuid; v_cli uuid;
  j jsonb; v_suma numeric; v_n int; r record; f text;
begin
  v_dir := pg_temp.usuario('dir88@hegamex.com', '{direccion}');
  v_ger := pg_temp.usuario('ger88@hegamex.com', '{gerente_ventas}');
  v_ven := pg_temp.usuario('ven88@hegamex.com', '{ventas}');
  v_alm := pg_temp.usuario('alm88@hegamex.com', '{almacen}');
  v_adm := pg_temp.usuario('adm88@hegamex.com', '{admin}');

  -- ---------------------------------------------------------------------------
  -- 1. Ubicar: el texto como lo escribe la gente → clave INEGI, al dar de alta.
  -- ---------------------------------------------------------------------------
  insert into clientes (nombre, estado, ciudad, vendedor_id) values ('T88 Querétaro', 'Querétaro', 'Queretaro', v_ven) returning id into v_qro;
  insert into clientes (nombre, estado, ciudad) values ('T88 Tepa', 'Jalisco', 'Tepatitlan de Morelos') returning id into v_tepa;
  insert into clientes (nombre, estado, ciudad) values ('T88 GDL', 'jalisco', 'Guadalajara') returning id into v_gdl;
  insert into clientes (nombre, estado, ciudad) values ('T88 CDMX', 'CDMX', 'Coyoacán') returning id into v_cdmx;
  insert into clientes (nombre, estado, ciudad) values ('T88 Edomex', 'Edo. Méx.', 'Toluca') returning id into v_edomex;
  insert into clientes (nombre, estado, ciudad) values ('T88 Raro 1', 'Jalisco', 'Rancho T88 Inexistente') returning id into v_raro1;
  insert into clientes (nombre, estado, ciudad) values ('T88 Raro 2', 'JALISCO', 'rancho t88 inexistente.') returning id into v_raro2;
  insert into clientes (nombre) values ('T88 Sin datos') returning id into v_nada;
  insert into clientes (nombre, estado, ciudad, pais) values ('T88 Guatemala', 'Escuintla', 'Escuintla', 'Guatemala') returning id into v_gua;
  insert into clientes (nombre, estado, ciudad) values ('T88 Se enfrió', 'Michoacán', 'Zamora') returning id into v_frio;

  select cvegeo into f from clientes where id = v_qro;
  assert f = '22014', format('"Queretaro, Querétaro" debe ser 22014, salió %s', f);
  select cvegeo into f from clientes where id = v_tepa;
  assert f = '14093', format('"Tepatitlan de Morelos, Jalisco" debe ser 14093, salió %s', f);
  select cvegeo into f from clientes where id = v_gdl;
  assert f = '14039', format('"Guadalajara, Jalisco" debe ser 14039, salió %s', f);
  select cve_ent || '/' || cvegeo into f from clientes where id = v_cdmx;
  assert f = '09/09003', format('"CDMX, Coyoacán" debe ser Coyoacán (09003), salió %s', f);
  select cve_ent || '/' || cvegeo into f from clientes where id = v_edomex;
  assert f = '15/15106', format('"Edo. Méx., Toluca" debe ser Toluca (15106), salió %s', f);
  assert (select cve_ent from ubicar('Estado de México', null, 'Mexico')) = '15', '"Estado de México" debe ser el 15';
  assert (select cve_ent from ubicar('Ciudad de México', 'Ciudad de México', 'México')) = '09', 'CDMX sin alcaldía debe quedar en el estado 09';
  assert (select cve_ent from ubicar('Michoacan', 'Morelia', 'México')) = '16', '"Michoacan" sin acento es el 16';
  assert (select cvegeo from ubicar('Sonora', 'CD. Obregon', 'México')) = '26018', 'Cd. Obregón es Cajeme (alias de fábrica)';
  assert (select cvegeo from ubicar('Jalisco', 'Guadajara', 'México')) = '14039', 'un error de dedo ("Guadajara") debe ligar a Guadalajara';
  assert (select metodo from ubicar('Jalisco', 'Guadajara', 'México')) = 'parecido', 'lo ligado por parecido se marca para confirmar';
  assert (select cvegeo from ubicar('Jalisco', 'Santa Maria del Valle', 'México')) is null,
    '"Santa María del Valle" no es "Santa María del Oro": no debe ligarse por parecido';
  assert (select cvegeo from ubicar('Jalisco', 'Jalisco', 'México')) is null, 'una ciudad que dice "Jalisco" no es Ojuelos de Jalisco';
  assert (select metodo from ubicar('Texas', 'Laredo', 'México')) = 'extranjero', 'Texas es exportación aunque el país diga México';
  select ubicacion into f from clientes where id = v_gua;
  assert f = 'extranjero', 'el cliente de Guatemala es exportación';
  assert (select cvegeo from clientes where id = v_raro1) is null and (select cve_ent from clientes where id = v_raro1) = '14',
    'una ciudad que no existe se queda solo con su estado';

  -- Cambiar la ciudad vuelve a ubicar; escribir la clave a mano no se queda.
  update clientes set ciudad = 'Zapopan' where id = v_gdl;
  assert (select cvegeo from clientes where id = v_gdl) = '14120', 'al cambiar la ciudad debe volver a ubicarse (Zapopan 14120)';
  update clientes set cvegeo = '01001', cve_ent = '01' where id = v_gdl;
  assert (select cvegeo from clientes where id = v_gdl) = '14120', 'la clave calculada no se puede pisar a mano';
  update clientes set ciudad = 'Guadalajara' where id = v_gdl;

  -- ---------------------------------------------------------------------------
  -- 2. Corregir un alias re-ubica a TODOS los que lo escribieron igual; solo dirección.
  -- ---------------------------------------------------------------------------
  perform pg_temp.como(v_ger);
  begin
    perform corregir_ubicacion('Jalisco', 'Rancho T88 Inexistente', '14013');
    assert false, 'la gerencia de ventas corrigió una ubicación (solo ve el análisis)';
  exception when insufficient_privilege then null;
  end;
  perform pg_temp.como(v_dir);
  v_n := corregir_ubicacion('Jalisco', 'Rancho T88 Inexistente', '14013');
  assert v_n = 2, format('el alias debía re-ubicar a los 2 clientes que lo escriben igual, re-ubicó %s', v_n);
  perform pg_temp.como_postgres();
  assert (select count(*) from clientes where id in (v_raro1, v_raro2) and cvegeo = '14013' and ubicacion = 'alias') = 2,
    'los dos clientes con "rancho t88 inexistente" deben quedar en Atotonilco el Alto';
  -- Uno nuevo que lo escribe igual ya entra ubicado.
  insert into clientes (nombre, estado, ciudad) values ('T88 Raro 3', 'Jalisco', 'Rancho T88 inexistente') returning id into v_cli;
  assert (select cvegeo from clientes where id = v_cli) = '14013', 'un cliente nuevo con el alias corregido debe entrar ubicado';
  perform pg_temp.como(v_dir);
  begin
    perform corregir_ubicacion('Jalisco', '', '14013');
    assert false, 'sin ciudad no se debe poder crear un alias para todo Jalisco';
  exception when invalid_parameter_value then null;
  end;

  -- ---------------------------------------------------------------------------
  -- 3. El mapa cuadra con el tablero al centavo.
  -- ---------------------------------------------------------------------------
  perform pg_temp.como_postgres();
  insert into historial_ventas_hoja (fecha, cliente_id, cliente_nombre, tipo, monto, descripcion, factura) values
    ('2017-02-10', v_qro, 'T88 Querétaro', 'Venta', 100000.10, 'zeus 30 fija', 'T88-1'),
    ('2017-03-11', v_tepa, 'T88 Tepa', 'Venta', 50000.25, 'banda cargadora 20"x6.60 mts', 'T88-2'),
    ('2017-04-12', v_gdl, 'T88 GDL', 'Venta', 30000.33, 'bazuca 8" x 12 mts 10 HP 2F', 'T88-3'),
    ('2017-04-12', v_gdl, 'T88 GDL', 'Venta', 1234.56, '10 bandas B116 Gates', 'T88-3'),
    ('2017-05-13', v_cdmx, 'T88 CDMX', 'Venta', 7000.07, 'tramo de gusano 8" x 92cm', 'T88-4'),
    ('2017-06-14', v_nada, 'T88 Sin datos', 'Venta', 999.99, '20 mts g.t. 18" engrapada', 'T88-5'),
    ('2017-07-15', v_gua, 'T88 Guatemala', 'Venta', 25000.01, 'Cosedora manual F300A', 'T88-6'),
    ('2017-08-16', v_raro1, 'T88 Raro 1', 'Venta', 333.33, 'Colector de polvos motorizado', 'T88-7'),
    ('2017-09-17', v_qro, 'T88 Querétaro', 'Pago', 100000.10, 'pago', 'T88-1'),
    -- El año anterior: el de Zamora compraba y en 2017 ya no.
    ('2016-05-01', v_frio, 'T88 Se enfrió', 'Venta', 80000, 'silo movil thor 23', 'T88-8'),
    ('2016-06-01', v_qro, 'T88 Querétaro', 'Venta', 20000, 'reparación banda amarilla', 'T88-9');
  -- Y pedidos del ERP en 2032 (después del arranque), uno con partidas.
  insert into pedidos (folio, cliente_id, fecha, total, tipo_cambio) values ('T88-P1', v_tepa, '2032-03-01', 11600, 1);
  insert into pedidos (folio, cliente_id, fecha, total, tipo_cambio) values ('T88-P2', v_nada, '2032-03-02', 500.5, 1);
  insert into pedidos (folio, cliente_id, fecha, total, tipo_cambio, moneda) values ('T88-P3', v_gua, '2032-03-03', 1000, 18.25, 'USD');

  perform pg_temp.como(v_dir);
  j := analisis_mapa('2017-01-01', '2017-12-31');
  select coalesce(sum((x->>'monto')::numeric), 0) into v_suma from jsonb_array_elements(j->'regiones') x;
  v_suma := v_suma + coalesce((j #>> '{sin_ubicar,monto}')::numeric, 0)
          + coalesce((select sum((x->>'monto')::numeric) from jsonb_array_elements(j->'extranjero') x), 0);
  assert v_suma = ventas_entre('2017-01-01', '2017-12-31'),
    format('estados + sin ubicar + exportación (%s) debe cuadrar con ventas_entre (%s)', v_suma, ventas_entre('2017-01-01', '2017-12-31'));
  assert (j->>'total')::numeric = ventas_entre('2017-01-01', '2017-12-31'), 'el total del mapa debe ser ventas_entre';
  assert (j #>> '{sin_ubicar,monto}')::numeric = 999.99, format('sin ubicar: %s', j->'sin_ubicar');
  assert j->'extranjero' @> '[{"pais": "Guatemala", "monto": 25000.01}]', format('exportación: %s', j->'extranjero');
  assert j->'regiones' @> '[{"cve": "14", "monto": 81568.47, "clientes": 3}]', format('Jalisco: %s', j->'regiones');
  assert j->'regiones' @> '[{"cve": "16", "monto": 0, "monto_anterior": 80000.00, "cambio": -1.0}]', 'Michoacán compraba y dejó de comprar';
  -- Los pedidos del ERP con tipo de cambio, igual que el tablero.
  j := analisis_mapa('2032-01-01', '2032-12-31');
  assert (j->>'total')::numeric = ventas_entre('2032-01-01', '2032-12-31') and (j->>'total')::numeric = 11600 + 500.5 + 18250,
    format('2032: mapa %s, ventas_entre %s', j->>'total', ventas_entre('2032-01-01', '2032-12-31'));
  -- Lo de un estado: sus municipios más lo que no tiene municipio.
  j := analisis_mapa('2017-01-01', '2017-12-31', '14');
  assert j->'regiones' @> '[{"cve": "14039", "monto": 31234.89}, {"cve": "14093"}, {"cve": "14013"}]', format('municipios de Jalisco: %s', j->'regiones');
  assert (j->>'total')::numeric = 81568.47, format('total de Jalisco %s', j->>'total');

  -- Zonas que se enfriaron: Zamora, con su cliente perdido.
  j := analisis_zonas_frias('2017-01-01', '2017-12-31');
  assert j->'zonas' @> jsonb_build_array(jsonb_build_object('cve', '16', 'perdido', 80000.00, 'clientes_perdidos', 1,
                                                            'clientes', jsonb_build_array(jsonb_build_object('id', v_frio)))),
    format('Michoacán debe salir como zona fría con su cliente: %s', j->'zonas');

  -- ---------------------------------------------------------------------------
  -- 4. Familias de producto desde el texto de la hoja (descripciones reales).
  -- ---------------------------------------------------------------------------
  for r in select * from (values
      ('zeus 30 fija', 'dosificadoras'),
      ('banda cargadora 20"x6.60 mts', 'bandas'),
      ('bazuca 8" x 12 mts 10 HP 2F', 'helicoidales'),
      ('10 bandas B116 Gates', 'poleas'),
      ('tramo de gusano 8" x 92cm', 'helicoidales'),
      ('20 mts g.t. 18" engrapada', 'banda_hule'),
      ('200 cangilones 11x6', 'elevadores'),
      ('Cosedora manual F300A', 'cosedoras'),
      ('Silo movil Thor 23', 'tolvas_silos'),
      ('reparación banda amarilla', 'servicio'),
      ('BAZUCA 8" X 13 M + Flete', 'helicoidales'),
      ('Cribadora Zar 4T 2F 220 volts', 'cribas')) t(descripcion, esperada)
  loop
    assert familia_venta_de(r.descripcion) is not distinct from r.esperada,
      format('"%s" debía ser %s y salió %s', r.descripcion, r.esperada, familia_venta_de(r.descripcion));
  end loop;
  perform pg_temp.como_postgres();
  assert (select familia from historial_ventas_hoja where factura = 'T88-1' and tipo = 'Venta') = 'dosificadoras',
    'la venta de la hoja guarda su familia al entrar';
  perform pg_temp.como(v_dir);
  j := analisis_producto_region('2017-01-01', '2017-12-31');
  assert j->'familias' @> '[{"clave": "dosificadoras", "monto": 100000.10}]', format('familias 2017: %s', j->'familias');
  -- Una regla nueva de dirección reclasifica; una expresión rota no se guarda.
  perform pg_temp.como_postgres();
  insert into historial_ventas_hoja (fecha, cliente_id, cliente_nombre, tipo, monto, descripcion) values
    ('2017-10-01', v_qro, 'T88 Querétaro', 'Venta', 10, 'aparato T88 raro');
  perform pg_temp.como(v_dir);
  assert (j #>> '{clasificado,sin_clasificar_ventas}')::int = 0, 'en 2017 todo estaba clasificado';
  j := guardar_regla_familia(null, 'aparato t88', 'otros', 5, true, 'prueba');
  assert (j->>'reclasificadas')::int >= 1, 'la regla nueva debe reclasificar lo que ya existía';
  perform pg_temp.como_postgres();
  assert (select familia from historial_ventas_hoja where descripcion = 'aparato T88 raro') = 'otros', 'la venta debe quedar en "otros"';
  perform pg_temp.como(v_dir);
  begin
    perform guardar_regla_familia(null, 'banda (', 'otros');
    assert false, 'se guardó una expresión regular inválida';
  exception when invalid_parameter_value then null;
  end;
  perform pg_temp.como(v_ger);
  begin
    perform guardar_regla_familia(null, 'aparato t88 bis', 'otros');
    assert false, 'la gerencia de ventas cambió una regla de familia';
  exception when insufficient_privilege then null;
  end;

  -- ---------------------------------------------------------------------------
  -- 5. Meta anual repartida por mes: suma exacto la meta.
  -- ---------------------------------------------------------------------------
  select sum(meta) into v_suma from meta_por_mes(2027, 12345678.91);
  assert v_suma = 12345678.91, format('la meta repartida suma %s y no 12,345,678.91', v_suma);
  assert (select count(*) from meta_por_mes(2027, 12345678.91)) = 12, 'doce meses';
  assert (select abs(sum(estacionalidad) - 1) < 0.0001 from meta_por_mes(2027, 1)), 'la estacionalidad debe sumar 1';
  perform pg_temp.como(v_ger);
  begin
    perform guardar_meta_anual(2033, 1000000);
    assert false, 'la gerencia de ventas capturó la meta anual';
  exception when insufficient_privilege then null;
  end;
  perform pg_temp.como(v_dir);
  perform guardar_meta_anual(2033, 9999999.99, 'prueba');
  j := analisis_planeacion(2033);
  select sum((m->>'meta')::numeric) into v_suma from jsonb_array_elements(j->'meses') m;
  assert v_suma = 9999999.99, format('los meses de la planeación suman %s', v_suma);
  assert (j->>'meta')::numeric = 9999999.99 and (j #>> '{avance,faltante}')::numeric = 9999999.99, format('avance 2033: %s', j->'avance');
  j := analisis_planeacion(2034, 0.10);
  assert j->>'meta' is null and (j->>'meta_propuesta')::numeric = round(ventas_entre('2033-01-01', '2033-12-31') * 1.10, -3),
    'sin meta capturada, el escenario +10 % propone sobre el año anterior';

  -- ---------------------------------------------------------------------------
  -- 6. Quién puede: el vendedor no, almacén no, sistemas no; la gerencia de ventas sí, sin márgenes.
  -- ---------------------------------------------------------------------------
  foreach v_cli in array array[v_ven, v_alm, v_adm] loop
    perform pg_temp.como(v_cli);
    for f in select unnest(array[
        'select analisis_mapa(''2017-01-01'', ''2017-12-31'')',
        'select analisis_zonas_frias(''2017-01-01'', ''2017-12-31'')',
        'select analisis_tendencias()',
        'select analisis_clientes(''2017-01-01'', ''2017-12-31'')',
        'select * from analisis_segmento_clientes()',
        'select analisis_producto_region(''2017-01-01'', ''2017-12-31'')',
        'select * from analisis_sin_clasificar()',
        'select probar_regla_familia(''zeus'')',
        'select analisis_ubicaciones()',
        'select * from analisis_clientes_de_ubicacion('''', '''')',
        'select analisis_planeacion(2033)'])
    loop
      begin
        execute f;
        assert false, format('un rol sin análisis pudo correr: %s', f);
      exception when insufficient_privilege then null;
      end;
    end loop;
    -- Y la base de todo no le regresa nada (ni sus propias ventas por esta vía).
    assert (select count(*) from ventas_detalle('2017-01-01', '2017-12-31')) = 0, 'ventas_detalle sin permiso de análisis debe salir vacío';
    assert not exists (select 1 from metas_anuales), 'un rol sin análisis vio las metas';
    assert not exists (select 1 from geo_alias_ciudad), 'un rol sin análisis vio los alias';
  end loop;
  -- El vendedor sí sigue ubicando a sus clientes al darlos de alta (lee los alias por el disparador).
  perform pg_temp.como(v_ven);
  insert into clientes (nombre, estado, ciudad, vendedor_id) values ('T88 Del vendedor', 'Jalisco', 'Rancho T88 Inexistente', v_ven) returning id into v_cli;
  perform pg_temp.como_postgres();
  assert (select cvegeo from clientes where id = v_cli) = '14013', 'el alta de un vendedor también se ubica con los alias';

  perform pg_temp.como(v_ger);
  j := analisis_mapa('2017-01-01', '2017-12-31');
  assert (j->>'total')::numeric = ventas_entre('2017-01-01', '2017-12-31'), 'la gerencia ve el mismo total que dirección';
  -- Todo lo que devuelve el análisis, junto, no menciona un costo ni un margen.
  f := analisis_mapa('2017-01-01', '2017-12-31')::text || analisis_mapa('2017-01-01', '2017-12-31', '14')::text
    || analisis_zonas_frias('2017-01-01', '2017-12-31')::text || analisis_tendencias('2016-01-01')::text
    || analisis_clientes('2017-01-01', '2017-12-31')::text
    || analisis_producto_region('2017-01-01', '2017-12-31', '14', 'dosificadoras')::text
    || analisis_ubicaciones()::text || analisis_planeacion(2033)::text
    || (select jsonb_agg(s)::text from analisis_segmento_clientes() s);
  assert f !~* '(costo|margen|utilidad)',
    format('la gerencia de ventas vio costos o márgenes: %s', substring(f from '(?i).{0,60}(costo|margen|utilidad).{0,60}'));
  assert exists (select 1 from analisis_segmento_clientes() where cliente_id = v_qro), 'la gerencia ve los segmentos';
end $$;

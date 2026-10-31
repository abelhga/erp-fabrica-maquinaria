-- Antes del arranque, Resultados resta las comisiones registradas como pagadas, en el mes en que se
-- ganaron (no en el que se pagaron). En un mes con comisiones registradas, el libro de la hoja ya no
-- se suma; en uno sin ellas, sí. Las que no se han pagado no cuentan, y quien no ve las comisiones de
-- todos solo ve las suyas.
do $$
declare
  v_dir uuid; v_adm uuid; v_ven1 uuid; v_ven2 uuid;
  may0 jsonb; may1 jsonb; abr0 jsonb; abr1 jsonb; r jsonb;
begin
  v_dir := pg_temp.usuario('dir222@hegamex.com', '{direccion}');
  v_adm := pg_temp.usuario('adm222@hegamex.com', '{administracion}');
  v_ven1 := pg_temp.usuario('ven1222@hegamex.com', '{ventas}');
  v_ven2 := pg_temp.usuario('ven2222@hegamex.com', '{ventas}');

  perform pg_temp.como(v_dir);
  may0 := resultados_periodo('2016-05-01', '2016-05-31');
  abr0 := resultados_periodo('2016-04-01', '2016-04-30');
  perform pg_temp.como_postgres();

  -- La hoja anotó comisiones en abril y en mayo.
  insert into compras_hoja_categoria (proveedor_llave, categoria) values ('t222 comisiones', 'Comisiones');
  insert into historial_compras_hoja (fecha, proveedor_nombre, proveedor_llave, tipo, monto) values
    ('2016-04-20', 'T222 Comisiones', 't222 comisiones', 'Compra', 3000),
    ('2016-05-20', 'T222 Comisiones', 't222 comisiones', 'Compra', 4000);
  -- Mayo tiene comisiones registradas: una pagada en junio (cuenta en mayo), otra sin pagar (no cuenta).
  -- La de junio no cae en mayo.
  insert into comision_pagos (vendedor_id, mes, total, detalle, pagado_en) values
    (v_ven1, '2016-05-01', 10000, '{}', '2016-06-01'),
    (v_ven2, '2016-05-01', 2500, '{}', null),
    (v_ven1, '2016-06-01', 7000, '{}', '2016-07-01');

  perform pg_temp.como(v_dir);
  may1 := resultados_periodo('2016-05-01', '2016-05-31');
  abr1 := resultados_periodo('2016-04-01', '2016-04-30');

  -- 1. Mayo: lo pagado de mayo, sin el libro de la hoja (serían las mismas contadas dos veces).
  assert (may1->>'comisiones_pagadas')::numeric - (may0->>'comisiones_pagadas')::numeric = 10000,
    format('pagadas de mayo: %s', may1->'comisiones_pagadas');
  assert (may1->>'comisiones')::numeric - (may0->>'comisiones')::numeric = 10000, format('comisiones de mayo: %s', may1->'comisiones');
  assert (may1->>'comisiones_hoja')::numeric = (may0->>'comisiones_hoja')::numeric, 'mayo sumó también el libro de la hoja';
  -- 2. La utilidad baja lo mismo.
  assert (may0#>>'{totales,utilidad}')::numeric - (may1#>>'{totales,utilidad}')::numeric = 10000,
    format('utilidad: %s → %s', may0#>>'{totales,utilidad}', may1#>>'{totales,utilidad}');
  -- 3. Abril no tiene comisiones registradas: sigue contando el libro de la hoja.
  assert (abr1->>'comisiones')::numeric - (abr0->>'comisiones')::numeric = 3000, format('abril: %s', abr1->'comisiones');
  assert (abr1->>'comisiones_pagadas')::numeric = (abr0->>'comisiones_pagadas')::numeric, 'abril sin pagos registrados';
  -- 4. Un periodo de dos meses suma los dos.
  r := resultados_periodo('2016-05-01', '2016-06-30');
  assert (r->>'comisiones_pagadas')::numeric >= 17000, format('mayo y junio: %s', r->'comisiones_pagadas');

  -- 5. La gerencia administrativa ve Resultados pero no las comisiones de cada vendedor: no le salen.
  perform pg_temp.como(v_adm);
  r := resultados_periodo('2016-05-01', '2016-05-31');
  assert not (r->>'comisiones_completas')::boolean, 'administración no debería ver las de todos';
  assert (r->>'comisiones_pagadas')::numeric = 0, format('administración ve pagadas ajenas: %s', r->'comisiones_pagadas');

  perform pg_temp.como_postgres();
end $$;

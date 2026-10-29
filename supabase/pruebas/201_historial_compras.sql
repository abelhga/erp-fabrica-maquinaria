-- Resultados antes del arranque del ERP salen de las hojas: ventas del libro de ventas (por familia,
-- sin IVA si hubo factura) y compras de los dos libros de compras con la categoría de su proveedor.
-- El material es lo comprado de material, la nómina es la pagada (repartida taller/oficina con la
-- proporción de hoy), los impuestos van aparte y lo que no es gasto (retiros) no se resta.
do $$
declare
  v_fin uuid; v_ven uuid; d date := '2015-03-01'; h date := '2015-03-31';
  r0 jsonb; r1 jsonb; vt numeric; v_ok boolean;
  delta numeric;
begin
  v_fin := pg_temp.usuario('fin201@hegamex.com', '{finanzas}');
  v_ven := pg_temp.usuario('ven201@hegamex.com', '{ventas}');
  perform pg_temp.como(v_fin);
  r0 := resultados_periodo(d, h);
  perform pg_temp.como_postgres();

  -- Ventas de la hoja: una banda facturada ($116,000 con IVA = $100,000) y poleas sin factura.
  -- (La familia la pone la base por la descripción, como con todo lo de la hoja.)
  insert into historial_ventas_hoja (fecha, cliente_nombre, tipo, monto, factura, descripcion) values
    ('2015-03-10', 'Cliente 201', 'Venta', 116000, 'F-201', 'Banda transportadora de 18" x 10 m'),
    ('2015-03-12', 'Cliente 201', 'Venta', 20000, null, 'Polea de 6" 2 ranuras B'),
    ('2015-03-15', 'Cliente 201', 'Pago', 116000, null, null);
  assert (select familia from historial_ventas_hoja where cliente_nombre = 'Cliente 201' and monto = 20000) = 'poleas',
    format('la polea salió como %s', (select familia from historial_ventas_hoja where cliente_nombre = 'Cliente 201' and monto = 20000));
  -- Categorías de los proveedores de la hoja.
  insert into compras_hoja_categoria (proveedor_llave, categoria) values
    ('t201 aceros', 'Aceros'), ('t201 nomina', 'Nómina'), ('t201 publicidad', 'Publicidad'),
    ('t201 gases', 'Gases, soldadura, consumibles, etc.'), ('t201 sat', 'Impuestos'),
    ('t201 retiros', 'Retiros Personales (Dividendos)'), ('t201 comisiones', 'Comisiones');
  insert into historial_compras_2018_2021 (fecha, proveedor_nombre, proveedor_llave, monto, factura, fila_origen) values
    ('2015-03-02', 'T201 Aceros', 't201 aceros', 11600, 'A-1', -2011),
    ('2015-03-06', 'T201 Nomina', 't201 nomina', 30000, null, -2012),
    ('2015-03-07', 'T201 Publicidad', 't201 publicidad', 5000, null, -2013),
    ('2015-03-08', 'T201 Gases', 't201 gases', 2000, '-', -2014),
    ('2015-03-09', 'T201 SAT', 't201 sat', 4000, null, -2015),
    ('2015-03-11', 'T201 Retiros', 't201 retiros', 50000, null, -2016),
    ('2015-03-13', 'T201 Comisiones', 't201 comisiones', 3000, null, -2017),
    ('2015-03-14', 'T201 Desconocido', 't201 desconocido', 1000, null, -2018);
  -- El libro de la hoja actual también cuenta (solo las compras, no los pagos).
  insert into historial_compras_hoja (fecha, proveedor_nombre, proveedor_llave, tipo, monto) values
    ('2015-03-20', 'T201 Aceros', 't201 aceros', 'Compra', 5000),
    ('2015-03-21', 'T201 Aceros', 't201 aceros', 'Pago', 16600);

  perform pg_temp.como(v_fin);
  r1 := resultados_periodo(d, h);
  vt := (r1->>'proporcion_taller')::numeric;
  assert (r1->>'usa_hoja')::boolean, 'un periodo de 2015 no usa la hoja';

  -- 1. Ventas por familia, sin IVA si hubo factura; los pagos no son venta.
  assert (r1->>'ventas_total')::numeric - (r0->>'ventas_total')::numeric = 120000, format('ventas: %s', r1->'ventas');
  assert (select (v->>'importe')::numeric from jsonb_array_elements(r1->'ventas') v where v->>'linea' = 'refacciones')
         - coalesce((select (v->>'importe')::numeric from jsonb_array_elements(r0->'ventas') v where v->>'linea' = 'refacciones'), 0) = 20000,
    'las poleas no son refacción';

  -- 2. Material = lo comprado de material (sin IVA): 10,000 + 5,000; los pagos no cuentan.
  assert (r1#>>'{material,comprado_hoja}')::numeric - (r0#>>'{material,comprado_hoja}')::numeric = 15000, format('material: %s', r1->'material');
  -- 3. Nómina pagada, repartida con la proporción de hoy.
  assert abs((r1#>>'{mano_obra,hoja}')::numeric - (r0#>>'{mano_obra,hoja}')::numeric - 30000 * vt) < 0.02, format('taller: %s', r1->'mano_obra');
  assert abs((r1#>>'{sueldos_oficina,hoja}')::numeric - (r0#>>'{sueldos_oficina,hoja}')::numeric - 30000 * (1 - vt)) < 0.02, 'oficina';
  -- 4. Gastos por categoría; la comisión pagada va a comisiones; lo que no tiene categoría, a operación y se avisa.
  assert exists (select 1 from jsonb_array_elements(r1->'fabricacion') x where x->>'categoria' = 'Gases, soldadura, consumibles, etc.' and (x->>'importe')::numeric = 2000), 'gases';
  assert exists (select 1 from jsonb_array_elements(r1->'operacion') x where x->>'categoria' = 'Publicidad' and (x->>'importe')::numeric = 5000), 'publicidad';
  assert not exists (select 1 from jsonb_array_elements(r1->'operacion') x where lower(x->>'categoria') = 'comisiones'), 'la comisión quedó en operación';
  assert (r1->>'comisiones')::numeric - (r0->>'comisiones')::numeric = 3000, 'comisiones de la hoja';
  assert (r1->>'sin_categoria')::numeric - (r0->>'sin_categoria')::numeric = 1000, 'sin categoría';
  -- 5. Impuestos aparte; los retiros no son gasto.
  assert exists (select 1 from jsonb_array_elements(r1->'impuestos') x where x->>'categoria' = 'Impuestos' and (x->>'importe')::numeric = 4000), 'impuestos';
  assert (r1#>>'{totales,fuera}')::numeric - (r0#>>'{totales,fuera}')::numeric = 50000, 'retiros';
  delta := ((r1#>>'{totales,utilidad}')::numeric - (r0#>>'{totales,utilidad}')::numeric);
  -- 120,000 − (15,000 + 30,000 + 2,000) − (5,000 + 1,000 + 3,000) − 4,000 = 60,000 (el retiro no se resta).
  assert abs(delta - 60000) < 0.05, format('utilidad: %s', r1->'totales');
  assert (r1#>>'{totales,utilidad}')::numeric = (r1#>>'{totales,utilidad_operacion}')::numeric - (r1#>>'{totales,impuestos_financieros}')::numeric,
    'utilidad después de impuestos';

  -- 6. Año por año usa la misma cuenta.
  assert (select ventas = (resultados_periodo('2018-01-01', '2018-12-31')->>'ventas_total')::numeric from resultados_por_anio(2018) where anio = 2018),
    'el año por año no cuadra con Resultados';
  assert (select parcial from resultados_por_anio(2018) where anio = extract(year from hoy_mx())::int), 'el año en curso no sale parcial';

  -- 7. Clasificar una categoría de la hoja la mueve; ventas no ve nada de esto.
  perform fijar_categoria_compra('Publicidad', 'fuera');
  assert not exists (select 1 from jsonb_array_elements(resultados_periodo(d, h)->'operacion') x where x->>'categoria' = 'Publicidad'), 'no se reclasificó';
  perform pg_temp.como(v_ven);
  begin perform resultados_periodo(d, h); v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'ventas vio los resultados';
  begin perform resultados_por_anio(2018); v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'ventas vio el año por año';
  begin perform compras_hoja(d, h); v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'ventas leyó las compras de la hoja';
  assert not exists (select 1 from historial_compras_2018_2021), 'ventas lee el libro de 2018-2021';
  perform pg_temp.como_postgres();
end $$;

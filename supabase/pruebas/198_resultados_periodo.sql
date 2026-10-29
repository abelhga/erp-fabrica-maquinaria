-- Resultados del periodo: lo vendido menos lo que costó fabricarlo y operar. El material sale del
-- costeo cuando la partida lo tiene y se estima con la proporción de su línea cuando no; los
-- sueldos se estiman con el sueldo vigente y se cambian por los de nómina en semanas cerradas; las
-- compras de material no se cuentan dos veces. Solo lo ve quien ve costos y finanzas.
-- La base local trae gente y pedidos de verdad: todo se compara contra la foto de antes.
do $$
declare
  v_dir uuid; v_fin uuid; v_adm uuid; v_ven uuid; v_com uuid; v_gv uuid;
  v_cli uuid; v_art uuid; v_ped uuid; v_usd uuid; v_can uuid; v_prov uuid; e_taller uuid; e_ofi uuid;
  d date := '2031-03-01'; h date := '2031-03-31';
  r0 jsonb; r1 jsonb; r2 jsonb; r3 jsonb; v_ok boolean;
begin
  v_dir := pg_temp.usuario('dir198@hegamex.com', '{direccion}');
  v_fin := pg_temp.usuario('fin198@hegamex.com', '{finanzas}');
  v_adm := pg_temp.usuario('adm198@hegamex.com', '{administracion}');
  v_ven := pg_temp.usuario('ven198@hegamex.com', '{ventas}');
  v_com := pg_temp.usuario('com198@hegamex.com', '{compras}');
  v_gv := pg_temp.usuario('gv198@hegamex.com', '{gerente_ventas}');

  perform pg_temp.como(v_fin);
  r0 := resultados_periodo(d, h);
  perform pg_temp.como_postgres();

  -- Un equipo con costeo (material 400 de 600) y partidas de texto, como las de la hoja.
  insert into clientes (nombre) values ('Cliente 198') returning id into v_cli;
  insert into articulos (clave, tipo, nombre) values ('T198-EQ', 'equipo', 'Equipo 198') returning id into v_art;
  insert into costos_calculados (articulo_id, costo_material, costo_mano_obra, costo_total) values (v_art, 400, 200, 600)
  on conflict (articulo_id) do update set costo_material = 400, costo_mano_obra = 200, costo_total = 600;
  insert into pedidos (cliente_id, canal, fecha) values (v_cli, 'directo', '2031-03-10') returning id into v_ped;
  insert into pedido_lineas (pedido_id, articulo_id, titulo, cantidad, precio_unitario, linea) values
    (v_ped, v_art, 'Equipo 198', 2, 1000, 'maquinaria'),
    (v_ped, null, 'Banda de la hoja', 1, 5000, 'maquinaria'),
    (v_ped, null, 'Refacción de la hoja', 1, 1000, 'refacciones');
  -- En dólares: 100 × 18 = 1,800 pesos.
  insert into pedidos (cliente_id, canal, fecha, moneda, tipo_cambio) values (v_cli, 'directo', '2031-03-12', 'USD', 18) returning id into v_usd;
  insert into pedido_lineas (pedido_id, titulo, cantidad, precio_unitario, linea) values (v_usd, 'Refacción en dólares', 1, 100, 'refacciones');
  -- Cancelado: no cuenta.
  insert into pedidos (cliente_id, canal, fecha) values (v_cli, 'directo', '2031-03-15') returning id into v_can;
  insert into pedido_lineas (pedido_id, titulo, cantidad, precio_unitario, linea) values (v_can, 'Se canceló', 1, 99999, 'maquinaria');
  update pedidos set estado = 'cancelado', motivo_cancelacion = 'Prueba 198' where id = v_can;

  -- Una persona del taller y una de oficina, con su sueldo semanal.
  insert into empleados (nombre, fecha_ingreso, departamento_id) values ('T198 Soldador', '2030-01-01', departamento_produccion()) returning id into e_taller;
  insert into empleados (nombre, fecha_ingreso, departamento_id) values ('T198 Auxiliar', '2030-01-01', (select id from departamentos where nombre = 'Administración')) returning id into e_ofi;
  insert into nomina_sueldos (empleado_id, sueldo_semanal, desde, motivo) values (e_taller, 7000, '2030-01-01', 'Prueba'), (e_ofi, 3500, '2030-01-01', 'Prueba');

  -- Compras: una facturada (con IVA), una sin factura; caja chica.
  insert into proveedores (nombre) values ('T198 Proveedor') returning id into v_prov;
  insert into movimientos_proveedor (proveedor_id, proveedor_llave, tipo, fecha, monto, categoria, factura) values
    (v_prov, 't198', 'compra', '2031-03-05', 1160, 'T198 Gases', 'A-1'),
    (v_prov, 't198', 'compra', '2031-03-06', 500, 'T198 Lámina', null),
    (v_prov, 't198', 'compra', '2031-04-02', 7777, 'T198 Gases', null);   -- fuera del periodo
  insert into caja_chica (fecha, tipo, importe, concepto) values ('2031-03-15', 'salida', -300, 'T198 comida');

  -- 1. Ventas por línea, sin IVA, en pesos, sin cancelados.
  perform pg_temp.como(v_fin);
  r1 := resultados_periodo(d, h);
  assert (r1->>'ventas_total')::numeric - (r0->>'ventas_total')::numeric = 9800, format('ventas: %s', r1->'ventas');
  assert (select (v->>'importe')::numeric from jsonb_array_elements(r1->'ventas') v where v->>'linea' = 'refacciones') = 2800, 'refacciones sin el tipo de cambio';

  -- 2. Material: exacto con costeo (2 × 400); el de las partidas de texto, con la proporción de su
  --    línea: la de lo vendido si hay 10 partidas con costeo en el año, si no la del catálogo.
  assert (r1#>>'{material,exacto}')::numeric - (r0#>>'{material,exacto}')::numeric = 800, format('material exacto: %s', r1->'material');
  assert (select bool_and((v->>'fuente') = case when (v->>'partidas')::int >= 10 then 'ventas' else 'catalogo' end)
          from jsonb_each(r1->'proporcion') x(k, v)), format('fuente de la proporción: %s', r1->'proporcion');
  assert abs((r1#>>'{material,estimado}')::numeric - (r0#>>'{material,estimado}')::numeric
             - 5000 * least(greatest(coalesce((r1#>>'{proporcion,maquinaria,r}')::numeric, (r1->>'proporcion_global')::numeric, 0.5), 0.05), 0.95)
             - 2800 * least(greatest(coalesce((r1#>>'{proporcion,refacciones,r}')::numeric, (r1->>'proporcion_global')::numeric, 0.5), 0.05), 0.95)) < 1,
    format('material estimado: %s con %s', r1->'material', r1->'proporcion');

  -- 3. Sueldos estimados: semanal ÷ 7 × 31 días, el taller aparte de la oficina.
  assert (r1#>>'{mano_obra,estimado}')::numeric - (r0#>>'{mano_obra,estimado}')::numeric = 31000, format('taller: %s', r1->'mano_obra');
  assert (r1#>>'{sueldos_oficina,estimado}')::numeric - (r0#>>'{sueldos_oficina,estimado}')::numeric = 15500, format('oficina: %s', r1->'sueldos_oficina');

  -- 4. Compras: la facturada sin IVA; una categoría nueva cuenta como gasto de operación hasta que
  --    finanzas la clasifique, y se avisa.
  assert (select (v->>'importe')::numeric from jsonb_array_elements(r1->'operacion') v where v->>'categoria' = 'T198 Gases') = 1000, 'la compra facturada trae IVA';
  assert r1->'sin_clasificar' ? 'T198 Gases', 'no avisa de la categoría sin clasificar';
  assert (r1->>'caja_chica')::numeric - (r0->>'caja_chica')::numeric = 300, 'caja chica';
  --    La utilidad la da la base: ventas − costo de fabricación − gastos de operación (las dos
  --    compras aún sin clasificar cuentan como operación).
  assert (r1#>>'{totales,utilidad}')::numeric = (r1->>'ventas_total')::numeric - (r1#>>'{totales,costo_fabricacion}')::numeric
         - (r1#>>'{totales,gastos_operacion}')::numeric, format('totales: %s', r1->'totales');
  assert (r1#>>'{totales,gastos_operacion}')::numeric - (r0#>>'{totales,gastos_operacion}')::numeric = 15500 + 1000 + 500 + 300,
    format('gastos de operación: %s contra %s', r1->'totales', r0->'totales');
  perform fijar_categoria_compra('T198 Gases', 'fabricacion');
  perform fijar_categoria_compra('  t198 LÁMINA ', 'material');
  r2 := resultados_periodo(d, h);
  assert (select (v->>'importe')::numeric from jsonb_array_elements(r2->'fabricacion') v where v->>'categoria' = 'T198 Gases') = 1000, 'no pasó a fabricación';
  assert not exists (select 1 from jsonb_array_elements(r2->'operacion') v where v->>'categoria' like 'T198%'), 'lo clasificado sigue en operación';
  --    El material comprado no es gasto: ya va en el costo de lo vendido.
  assert (r2->>'material_comprado')::numeric - (r1->>'material_comprado')::numeric = 500, 'material comprado';
  assert not exists (select 1 from jsonb_array_elements(r2->'fabricacion') v where v->>'categoria' = 'T198 Lámina'), 'la lámina se contó como gasto';
  assert (select tipo from categorias_compra_periodo(d, h) where categoria = 't198 gases') = 'fabricacion', 'categorias_compra_periodo';
  assert (r1->>'comisiones_completas')::boolean, 'finanzas no ve las comisiones de todos';

  -- 5. Semana de nómina cerrada: esos días van con lo pagado de verdad, no con el estimado.
  perform pg_temp.como_postgres();
  insert into nomina_semanas (inicio) values ('2031-03-07');
  insert into nomina_renglones (semana, empleado_id, nombre, total_percepciones) values ('2031-03-07', e_taller, 'T198 Soldador', 8000);
  update nomina_semanas set estado = 'cerrada' where inicio = '2031-03-07';
  perform pg_temp.como(v_dir);
  r3 := resultados_periodo(d, h);
  assert (r3#>>'{mano_obra,real}')::numeric = 8000 and (r3->>'semanas_cerradas')::int = 1, format('nómina real: %s', r3->'mano_obra');
  assert (r2#>>'{mano_obra,estimado}')::numeric - (r3#>>'{mano_obra,estimado}')::numeric >= 7000, 'la semana cerrada se contó dos veces';

  -- 6. Permisos: dirección, finanzas y la gerencia administrativa sí (esta última sin las comisiones
  --    de todos); ventas, compras (ve costos, no finanzas) y la gerencia de ventas (finanzas sin costos), no.
  perform pg_temp.como(v_adm);
  assert not (resultados_periodo(d, h)->>'comisiones_completas')::boolean, 'administración ve las comisiones de todos';
  perform pg_temp.como(v_ven);
  begin perform resultados_periodo(d, h); v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'ventas vio los resultados';
  begin perform fijar_categoria_compra('T198 Gases', 'operacion'); v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'ventas reclasificó una compra';
  assert not exists (select 1 from compras_categorias), 'ventas lee las categorías de compra';
  perform pg_temp.como(v_com);
  begin perform resultados_periodo(d, h); v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'compras vio los resultados';
  perform pg_temp.como(v_gv);
  begin perform resultados_periodo(d, h); v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'la gerencia de ventas vio los resultados';
  begin perform categorias_compra_periodo(d, h); v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'la gerencia de ventas vio las categorías';
  perform pg_temp.como_postgres();
end $$;

-- Resumen semanal: los números salen con los permisos de quien pregunta. Se usa una
-- semana de 2031, sin datos en la base, para que lo medido dependa solo de la prueba.
do $$
declare
  v_a uuid; v_b uuid; v_dir uuid; v_alm uuid; v_cli_a uuid; v_cli_b uuid; v_ped uuid;
  v_lunes date := '2031-01-13'; j jsonb; v_n int;
begin
  v_a := pg_temp.usuario('a86@hegamex.com', '{ventas}');
  v_b := pg_temp.usuario('b86@hegamex.com', '{ventas}');
  v_dir := pg_temp.usuario('dir86@hegamex.com', '{direccion}');
  v_alm := pg_temp.usuario('alm86@hegamex.com', '{almacen}');
  insert into clientes (nombre, vendedor_id) values ('T86 Cliente de A', v_a) returning id into v_cli_a;
  insert into clientes (nombre, vendedor_id) values ('T86 Cliente de B', v_b) returning id into v_cli_b;
  -- Semana pasada (6 al 12 de enero): una venta de cada uno; la de A con entrega comprometida esta semana.
  insert into pedidos (folio, cliente_id, vendedor_id, fecha, fecha_compromiso, total)
    values ('T86-A', v_cli_a, v_a, v_lunes - 5, v_lunes + 2, 1000) returning id into v_ped;
  insert into pedidos (folio, cliente_id, vendedor_id, fecha, fecha_compromiso, total)
    values ('T86-B', v_cli_b, v_b, v_lunes - 4, v_lunes + 3, 5000);
  -- La anterior (30 dic al 5 ene): una de A, para la comparación.
  insert into pedidos (folio, cliente_id, vendedor_id, fecha, total) values ('T86-A0', v_cli_a, v_a, v_lunes - 10, 400);

  -- El vendedor ve lo suyo y sabe que es lo suyo.
  perform pg_temp.como(v_a);
  j := semana_en_numeros(v_lunes);
  assert j #>> '{semana,pasada_desde}' = '2031-01-06' and j #>> '{semana,pasada_hasta}' = '2031-01-12', format('semana pasada: %s', j->'semana');
  assert semana_en_numeros(v_lunes + 3) #>> '{semana,lunes}' = '2031-01-13', 'un jueves debe dar la semana de su lunes';
  assert j #>> '{ventas,alcance}' = 'tuyas', 'el vendedor debe ver "tuyas", no el total de la empresa';
  assert (j #>> '{ventas,monto}')::numeric = 1000 and (j #>> '{ventas,monto_anterior}')::numeric = 400, format('ventas de A: %s', j->'ventas');
  assert (j #>> '{ventas,operaciones}')::int = 1, 'una operación de A';
  assert j #> '{ventas,mejores_clientes}' @> '[{"nombre": "T86 Cliente de A"}]', 'su cliente en los mejores';
  assert not (j #> '{ventas,mejores_clientes}' @> '[{"nombre": "T86 Cliente de B"}]'), 'el vendedor A vio un cliente de B';
  assert j #> '{ventas,entregas_comprometidas}' @> '[{"folio": "T86-A"}]', 'su entrega comprometida';
  assert not (j #> '{ventas,entregas_comprometidas}' @> '[{"folio": "T86-B"}]'), 'el vendedor A vio una entrega de B';
  assert not j ? 'cobranza', 'un vendedor no ve la cobranza de la empresa';
  assert not j ? 'compras', 'un vendedor no ve compras';

  -- Dirección ve la empresa completa.
  perform pg_temp.como(v_dir);
  j := semana_en_numeros(v_lunes);
  assert j #>> '{ventas,alcance}' = 'empresa', 'dirección ve la empresa';
  assert (j #>> '{ventas,monto}')::numeric = 6000, format('ventas de la empresa: %s', j #>> '{ventas,monto}');
  assert j ? 'cobranza' and j ? 'compras' and j ? 'produccion', 'dirección ve todas las áreas';

  -- Almacén: qué llega, sin dinero; nada de ventas.
  perform pg_temp.como(v_alm);
  j := semana_en_numeros(v_lunes);
  assert not j ? 'ventas' and not j ? 'cobranza', 'almacén vio ventas o cobranza';
  assert j ? 'compras', 'almacén debe ver lo que llega';
  assert not exists (select 1 from jsonb_array_elements(j #> '{compras,por_llegar}') e, jsonb_object_keys(e) k
                     where k not in ('folio', 'proveedor', 'fecha')), 'lo que llega no debe traer montos';

  -- El aviso del lunes: no lo dispara cualquiera, y va una sola vez por semana.
  begin
    perform avisar_resumen_semanal();
    assert false, 'un usuario disparó el aviso semanal';
  exception when insufficient_privilege then null;
  end;
  perform pg_temp.como_postgres();
  v_n := avisar_resumen_semanal();
  assert v_n > 0, 'el aviso no le llegó a nadie';
  assert exists (select 1 from avisos where usuario_id = v_dir and tipo = 'resumen_semanal' and ruta = '/semana'), 'a dirección no le llegó';
  assert not exists (select 1 from avisos a join usuario_roles r on r.usuario_id = a.usuario_id
                     where a.tipo = 'resumen_semanal' and r.rol = 'pantalla'), 'la pantalla del taller no usa el asistente';
  assert avisar_resumen_semanal() = 0, 'el aviso semanal se repitió';
end $$;

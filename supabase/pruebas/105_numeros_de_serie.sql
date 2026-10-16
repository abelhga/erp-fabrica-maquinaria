-- Números de serie: cada equipo nace con el suyo, consecutivo por familia y sin
-- repetirse; el equipo sin código espera a que lo capturen; la historia de la hoja
-- se busca y se ve por cliente; y quién no debe poder.
do $$
declare
  v_gp uuid; v_taller uuid; v_vend uuid; v_otro uuid; v_ing uuid;
  v_tubo uuid; v_banda uuid; v_pedestal uuid; v_raro uuid; v_cli uuid; v_cli2 uuid; v_ped uuid; v_ped2 uuid; v_op uuid;
  v_series text[]; v_base int; v_txt text; v_estado text;
begin
  v_gp := pg_temp.usuario('gp103@hegamex.com', '{gerente_produccion}');
  v_taller := pg_temp.usuario('taller103@hegamex.com', '{produccion}');
  v_vend := pg_temp.usuario('vend103@hegamex.com', '{ventas}');
  v_otro := pg_temp.usuario('otro103@hegamex.com', '{ventas}');
  v_ing := pg_temp.usuario('ing103@hegamex.com', '{ingenieria}');

  insert into articulos (clave, tipo, nombre, unidad) values ('S103-TUBO', 'materia_prima', 'Tubo', 'metro') returning id into v_tubo;
  insert into articulos (clave, tipo, nombre) values ('S103-B20', 'equipo', 'Banda cargadora 20" x 9 m') returning id into v_banda;
  insert into articulos (clave, tipo, nombre) values ('S103-P12', 'equipo', 'Banda pedestal 12" x 2.44 m') returning id into v_pedestal;
  insert into articulos (clave, tipo, nombre) values ('S103-RAR', 'equipo', 'Equipo especial sin código') returning id into v_raro;
  insert into bom_lineas (padre_id, hijo_id, cantidad) values (v_banda, v_tubo, 10), (v_pedestal, v_tubo, 3), (v_raro, v_tubo, 1);
  insert into clientes (nombre, vendedor_id) values ('T103 Granos del Bajío', v_vend) returning id into v_cli;
  insert into clientes (nombre, vendedor_id) values ('T103 Concretos', v_otro) returning id into v_cli2;
  -- La base local puede traer el libro real de seriales: la prueba arranca con la historia vacía.
  delete from equipos_historicos;
  -- La hoja ya llegó al 258 en bandas.
  update familias_serie set ultimo = 258 where clave = 'banda';
  insert into equipos_historicos (numero_serie, familia, consecutivo, pedido_hoja, fecha_pedido, cliente_id, cliente_nombre, factura, estado, descripcion)
  values ('TB20090275E247', 'banda', 247, '773', '2026-06-08', v_cli, 'T103 Granos del Bajío', 'A 3190', 'entregado', 'Banda cargadora 20" x 9.60'),
         ('TB18060275E259', 'banda', 259, '792', null, v_cli2, 'T103 Concretos', null, 'espera', 'Banda 18" x 6 m');

  -- Ingeniería captura el código de cada equipo una vez (en minúsculas y con espacios también entra).
  perform pg_temp.como(v_ing);
  perform fijar_codigo_serie(v_banda, 'banda', 'tb2009 0275e');
  perform fijar_codigo_serie(v_pedestal, 'banda', 'TP12020163E');
  begin
    perform fijar_codigo_serie(v_banda, 'banda', 'TB-20/09');
    v_estado := 'aceptó';
  exception when invalid_parameter_value then v_estado := 'negado';
  end;
  assert v_estado = 'negado', 'aceptó un código con guiones';

  -- Dos pedidos: 2 bandas + 1 pedestal y 1 banda. Cuatro seriales seguidos, la banda
  -- y el pedestal comparten consecutivo (como en la hoja), y el 259 que ya existía se brinca.
  perform pg_temp.como_postgres();
  insert into pedidos (cliente_id, vendedor_id) values (v_cli, v_vend) returning id into v_ped;
  insert into pedido_lineas (pedido_id, articulo_id, titulo, cantidad, precio_unitario) values
    (v_ped, v_banda, 'Banda', 2, 100000), (v_ped, v_pedestal, 'Pedestal', 1, 30000), (v_ped, v_raro, 'Especial', 1, 50000);
  insert into pedidos (cliente_id, vendedor_id) values (v_cli2, v_otro) returning id into v_ped2;
  insert into pedido_lineas (pedido_id, articulo_id, titulo, cantidad, precio_unitario) values (v_ped2, v_banda, 'Banda', 1, 100000);
  perform pg_temp.como(v_gp);
  perform ordenes_desde_pedido(v_ped);
  perform ordenes_desde_pedido(v_ped2);
  select array_agg(numero_serie order by right(numero_serie, 3)) into v_series
  from ordenes_produccion where pedido_id in (v_ped, v_ped2) and numero_serie is not null;
  assert (select array_agg(right(x, 3) order by x) from unnest(v_series) x) is not null
     and (select array_agg(right(x, 3) order by right(x, 3)) from unnest(v_series) x) = array['260', '261', '262', '263']
     and (select count(*) from unnest(v_series) x where x like 'TB20090275E%') = 3
     and (select count(*) from unnest(v_series) x where x like 'TP12020163E%') = 1,
    format('seriales: %s', v_series);
  assert (select ultimo from familias_serie where clave = 'banda') = 263, 'el consecutivo de la familia no quedó en 263';

  -- El equipo sin código nace sin serial y se le asigna cuando lo capturan.
  select id into v_op from ordenes_produccion where pedido_id = v_ped and articulo_id = v_raro;
  assert (select numero_serie from ordenes_produccion where id = v_op) is null, 'el equipo sin código sacó serial';
  begin
    perform asignar_numero_serie(v_op);
    v_estado := 'asignó';
  exception when invalid_parameter_value then v_estado := 'pide código';
  end;
  assert v_estado = 'pide código', 'asignó serial sin código';
  perform fijar_codigo_serie(v_raro, 'tolva', 'TC05B');
  v_txt := asignar_numero_serie(v_op);
  assert v_txt = 'TC05B' || lpad((select ultimo from familias_serie where clave = 'tolva')::text, 3, '0')
     and (select numero_serie from ordenes_produccion where id = v_op) = v_txt, format('serial pendiente: %s', v_txt);
  assert (select count(*) from op_eventos where orden_id = v_op and nota like 'Número de serie asignado%') = 1, 'no quedó en la historia de la orden';

  -- La lista junta lo del ERP y lo de la hoja.
  assert (select count(*) from v_numeros_serie where cliente_id = v_cli) = 5, 'la lista no junta ERP (4) y hoja (1) del cliente';
  assert exists (select 1 from v_numeros_serie where numero_serie = 'TB20090275E247' and origen = 'hoja' and factura = 'A 3190'), 'falta el histórico';
  assert exists (select 1 from buscar_global('E247') where tipo = 'numero_serie'), 'el buscador no encuentra el serial de la hoja';

  -- Servicio: el cliente tiene sus equipos del ERP y el de 2026 de la hoja.
  assert (select count(*) filter (where historico) = 1 and count(*) filter (where not historico) = 4
          from equipos_del_cliente(v_cli)), 'equipos del cliente sin el histórico';

  -- El vendedor ve los equipos de su cliente, no los del otro vendedor.
  perform pg_temp.como(v_vend);
  assert exists (select 1 from equipos_historicos where numero_serie = 'TB20090275E247'), 'el vendedor no ve el equipo de su cliente';
  assert not exists (select 1 from equipos_historicos where numero_serie = 'TB18060275E259'), 'el vendedor vio el equipo de otro';
  -- Un vendedor (producción 1) no asigna seriales, no captura códigos ni escribe la historia.
  begin
    perform asignar_numero_serie(v_op);
    v_estado := 'asignó';
  exception when insufficient_privilege then v_estado := 'negado';
  end;
  assert v_estado = 'negado', 'un vendedor asignó un serial';
  begin
    perform fijar_codigo_serie(v_banda, 'banda', 'XX');
    v_estado := 'cambió';
  exception when insufficient_privilege then v_estado := 'negado';
  end;
  assert v_estado = 'negado', 'un vendedor cambió un código de serie';
  begin
    insert into equipos_historicos (numero_serie) values ('X1');
    v_estado := 'escribió';
  exception when insufficient_privilege then v_estado := 'negado';
  end;
  assert v_estado = 'negado', 'un vendedor escribió en la historia';
  begin
    update familias_serie set ultimo = 1 where clave = 'banda';
    v_estado := case when (select ultimo from familias_serie where clave = 'banda') = 1 then 'movió' else 'negado' end;
  exception when insufficient_privilege then v_estado := 'negado';
  end;
  assert v_estado = 'negado', 'un vendedor movió el consecutivo';

  -- El taller (producción 2) sí asigna; no captura códigos (eso es de la gerencia o ingeniería).
  perform pg_temp.como(v_taller);
  begin
    perform fijar_codigo_serie(v_banda, 'banda', 'XX');
    v_estado := 'cambió';
  exception when insufficient_privilege then v_estado := 'negado';
  end;
  assert v_estado = 'negado', 'el taller cambió un código de serie';
end $$;

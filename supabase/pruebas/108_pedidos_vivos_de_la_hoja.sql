-- Pedidos de la hoja que siguen en el taller: el equipo con serie se ve una sola vez
-- (manda la orden del ERP) y el pedido no entra a la cobranza del ERP.
do $$
declare
  v_vend uuid; v_eq uuid; v_mp uuid; v_cli uuid; v_ped uuid; v_op uuid; v_n int;
begin
  v_vend := pg_temp.usuario('vend108@hegamex.com', '{ventas}');
  insert into articulos (clave, tipo, nombre, unidad) values ('S108-MP', 'materia_prima', 'Lámina', 'pieza') returning id into v_mp;
  insert into articulos (clave, tipo, nombre) values ('S108-EQ', 'equipo', 'Banda pedestal de prueba') returning id into v_eq;
  insert into bom_lineas (padre_id, hijo_id, cantidad) values (v_eq, v_mp, 2);
  insert into clientes (nombre, vendedor_id) values ('T108 Forrajes', v_vend) returning id into v_cli;

  delete from equipos_historicos;
  insert into equipos_historicos (numero_serie, familia, consecutivo, pedido_hoja, cliente_id, estado, descripcion)
  values ('TP108E001', 'banda', 1, 'P-108', v_cli, 'proceso', 'Banda pedestal'),
         ('TP108E002', 'banda', 2, 'P-107', v_cli, 'entregado', 'Banda pedestal vieja');

  -- La carga: pedido de la hoja (histórico para el dinero) y su orden en proceso con la misma serie.
  insert into pedidos (folio, cliente_id, vendedor_id, fecha, estado, historico, fecha_compromiso)
  values ('P-108', v_cli, v_vend, current_date - 30, 'en_produccion', true, current_date + 10) returning id into v_ped;
  insert into pedido_lineas (pedido_id, titulo, cantidad, precio_unitario) values (v_ped, 'Banda pedestal', 1, 50000);
  insert into ordenes_produccion (articulo_id, cantidad, pedido_id, estado, numero_serie, fecha_compromiso)
  values (v_eq, 1, v_ped, 'en_proceso', 'TP108E001', current_date + 10) returning id into v_op;

  -- Una sola vez en la lista de series, y es la del ERP (con su orden).
  select count(*) into v_n from v_numeros_serie where numero_serie = 'TP108E001';
  assert v_n = 1, format('la serie salió %s veces', v_n);
  assert (select origen from v_numeros_serie where numero_serie = 'TP108E001') = 'erp', 'la serie vigente debe ser la de la orden';
  assert (select estado from v_numeros_serie where numero_serie = 'TP108E001') = 'proceso', 'estado de la orden';
  -- La que ya se entregó antes del ERP sigue saliendo de la hoja.
  assert exists (select 1 from v_numeros_serie where numero_serie = 'TP108E002' and origen = 'hoja'), 'se perdió el histórico';

  -- Al pedir servicio: también una sola vez, y con su orden (sirve para la garantía).
  perform pg_temp.como(v_vend);
  select count(*) into v_n from equipos_del_cliente(v_cli) where numero_serie = 'TP108E001';
  assert v_n = 1, format('el equipo salió %s veces al pedir servicio', v_n);
  assert (select orden_id from equipos_del_cliente(v_cli) where numero_serie = 'TP108E001') = v_op, 'debe traer la orden';

  -- El dinero sigue en el saldo de arranque: el pedido no aparece en la cobranza del ERP.
  assert not exists (select 1 from v_saldos_pedido where pedido_id = v_ped), 'el pedido de la hoja entró a la cobranza';
  perform pg_temp.como_postgres();

  -- Y se entrega desde el ERP como cualquier otro.
  perform pg_temp.como(v_vend);
  perform entregar_pedido(v_ped);
  perform pg_temp.como_postgres();
  assert (select estado from pedidos where id = v_ped) = 'entregado', 'no se pudo entregar el pedido de la hoja';
end $$;

-- Servicio con monto libre: en un pedido sin cotización el vendedor escribe el monto (mayor a cero);
-- sin monto no entra. A un artículo normal el monto que mande la pantalla no le aplica.
do $$
declare v_ven uuid; v_cli uuid; v_ped uuid; v_paq uuid; v_art uuid; r pedido_lineas; v_ok boolean;
begin
  v_ven := pg_temp.usuario('ven231@hegamex.com', '{ventas}');
  select id into v_paq from articulos where nombre = 'Servicio de paquetería';
  assert v_paq is not null and (select precio_libre and tipo = 'servicio' and not controla_inventario from articulos where id = v_paq),
    'no existe el servicio de paquetería con monto libre';
  insert into articulos (clave, tipo, nombre) values ('T231-POL', 'componente', 'T231 Polea') returning id into v_art;
  insert into precios_lista (articulo_id, precio) values (v_art, 500);
  insert into clientes (nombre, vendedor_id) values ('Cliente 231', v_ven) returning id into v_cli;

  perform pg_temp.como(v_ven);
  insert into pedidos (cliente_id, canal) values (v_cli, 'directo') returning id into v_ped;
  -- Sin monto, no.
  begin perform agregar_partida_pedido(v_ped, v_paq, 1); v_ok := true; exception when check_violation then v_ok := false; end;
  assert not v_ok, 'entró el servicio sin monto';
  begin perform agregar_partida_pedido(v_ped, v_paq, 1, 0); v_ok := true; exception when check_violation then v_ok := false; end;
  assert not v_ok, 'entró el servicio en $0';
  -- Con monto, sí: lo de la factura A3364 ($732.76 + IVA = $850).
  r := agregar_partida_pedido(v_ped, v_paq, 1, 732.76);
  assert r.precio_unitario = 732.76 and r.linea = 'otros', format('partida: %s %s', r.precio_unitario, r.linea);
  assert (select total from pedidos where id = v_ped) = 850, format('total: %s', (select total from pedidos where id = v_ped));
  -- A un artículo normal el monto no le aplica: sale su precio de lista.
  r := agregar_partida_pedido(v_ped, v_art, 1, 1);
  assert r.precio_unitario = 500, format('el monto pisó el precio de lista: %s', r.precio_unitario);
  perform pg_temp.como_postgres();
end $$;

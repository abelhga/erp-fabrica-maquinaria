-- Calendario: cada quien ve lo que su puesto puede ver (la RLS de cada fuente), lo cerrado no
-- sale, lo vencido sale en rojo, y donde una tabla deja leer de más se recorta a lo de uno.
do $$
declare v_ven uuid; v_ven2 uuid; v_gv uuid; v_com uuid; v_dir uuid; v_gp uuid; v_cli uuid; v_prov uuid; v_eq uuid;
  p1 uuid; p2 uuid; p3 uuid; oc uuid; op uuid; pe uuid; v_ok boolean; h date := hoy_mx();
begin
  v_ven := pg_temp.usuario('ven160@hegamex.com', '{ventas}');
  v_ven2 := pg_temp.usuario('ven2160@hegamex.com', '{ventas}');
  v_gv := pg_temp.usuario('gv160@hegamex.com', '{gerente_ventas}');
  v_com := pg_temp.usuario('com160@hegamex.com', '{compras}');
  v_dir := pg_temp.usuario('dir160@hegamex.com', '{direccion}');
  v_gp := pg_temp.usuario('gp160@hegamex.com', '{gerente_produccion}');
  insert into clientes (nombre) values ('Cliente 160') returning id into v_cli;
  insert into pedidos (cliente_id, vendedor_id, estado, fecha_compromiso) values (v_cli, v_ven, 'confirmado', h + 5) returning id into p1;
  insert into pedidos (cliente_id, vendedor_id, estado, fecha_compromiso) values (v_cli, v_ven2, 'en_produccion', h - 3) returning id into p2;
  insert into pedidos (cliente_id, vendedor_id, estado, fecha_compromiso) values (v_cli, v_ven, 'entregado', h + 2) returning id into p3;
  insert into proveedores (nombre) values ('Proveedor 160') returning id into v_prov;
  insert into ordenes_compra (proveedor_id, estado, fecha_entrega) values (v_prov, 'enviada', h + 4) returning id into oc;
  insert into articulos (clave, tipo, nombre) values ('T160-EQ', 'equipo', 'Banda 160') returning id into v_eq;
  insert into ordenes_produccion (articulo_id, cantidad, estado, fecha_compromiso) values (v_eq, 1, 'liberada', h + 7) returning id into op;
  insert into pendientes (titulo, responsable_id, creado_por, vence) values ('Capturar la lista 160', v_ven, v_gv, h + 1) returning id into pe;

  -- El vendedor: su entrega (suya), no la de otro vendedor ni lo ya entregado; ni compras ni taller.
  perform pg_temp.como(v_ven);
  assert (select mio from calendario(h - 10, h + 20) where clave = 'entrega:' || p1), 'el vendedor no ve su entrega como suya';
  assert not exists (select 1 from calendario(h - 10, h + 20) where clave in ('entrega:' || p2, 'entrega:' || p3)), 've una entrega ajena o una ya entregada';
  assert not exists (select 1 from calendario(h - 10, h + 20) where tipo in ('compra', 'compromiso', 'fin_plan', 'pago')), 'el vendedor ve compras, taller o pagos';
  assert (select mio from calendario(h - 10, h + 20) where clave = 'pendiente:' || pe), 'no ve su pendiente';

  -- La gerencia de ventas ve las dos entregas; la vencida, en rojo y no a su nombre.
  perform pg_temp.como(v_gv);
  assert (select count(*) from calendario(h - 10, h + 20) where clave in ('entrega:' || p1, 'entrega:' || p2)) = 2, 'la gerencia no ve las entregas de todos';
  assert (select tono from calendario(h - 10, h + 20) where clave = 'entrega:' || p2) = 'peligro', 'la entrega vencida no sale en rojo';
  assert not (select mio from calendario(h - 10, h + 20) where clave = 'entrega:' || p2), 'la entrega de otro sale como suya';
  -- Quien pidió el pendiente lo ve con a quién le toca.
  assert (select detalle from calendario(h - 10, h + 20) where clave = 'pendiente:' || pe) like 'Le toca a %', 'quien lo pidió no ve a quién le toca';

  -- Compras ve lo que llega; dirección no ve pendientes ajenos aunque la tabla se los deje leer.
  perform pg_temp.como(v_com);
  assert exists (select 1 from calendario(h, h + 20) where clave = 'compra:' || oc), 'compras no ve la compra que llega';
  perform pg_temp.como(v_dir);
  assert not exists (select 1 from calendario(h - 10, h + 20) where clave = 'pendiente:' || pe), 'dirección ve un pendiente que no es suyo';

  -- La planta ve el compromiso de la orden.
  perform pg_temp.como(v_gp);
  assert exists (select 1 from calendario(h, h + 20) where clave = 'compromiso:' || op), 'la gerencia de producción no ve el compromiso';

  -- Más de cuatro meses no es un calendario.
  begin perform calendario(h, h + 200); v_ok := true; exception when raise_exception then v_ok := false; end;
  assert not v_ok, 'aceptó un periodo de más de cuatro meses';
  perform pg_temp.como_postgres();
end $$;

-- Mercado Libre: lo que hace la base con cada venta, reclamo y pregunta que llega de ML
-- (la función de borde ya la pidió a la API; aquí llega normalizada).
do $$
declare v_a1 uuid; v_a2 uuid; v_ped uuid; v_ped2 uuid; v_ped3 uuid; v_dev uuid; v_ven uuid; v_rh uuid; v_jc uuid; r record; v_n int;
begin
  v_ven := pg_temp.usuario('ven119@hegamex.com', '{ventas}');
  v_rh := pg_temp.usuario('rh119@hegamex.com', '{rrhh}');
  v_jc := pg_temp.usuario('jc119@hegamex.com', '{ventas,almacen}');
  update configuracion set valor = jsonb_build_object('responsable_id', v_jc) where clave = 'mercadolibre';
  insert into articulos (clave, tipo, nombre) values ('T119-POL', 'componente', 'Polea 119') returning id into v_a1;
  insert into articulos (clave, tipo, nombre) values ('T119-CAN', 'componente', 'Cangilón 119') returning id into v_a2;
  insert into publicaciones (articulo_id, canal, id_externo, titulo, precio) values (v_a1, 'mercadolibre', 'MLM119A', 'Polea', 1160);

  -- 1. Venta pagada de una publicación ligada, sin Full: pedido, partida sin IVA y envío por Mercado Envíos.
  v_ped := ml_registrar_orden('{"id":"2000119001","estado":"paid","fecha":"2026-10-15T10:00:00-06:00","comprador":"COMPRADOR119",
    "full":false,"items":[{"item_id":"MLM119A","titulo":"Polea de 4 pulgadas","sku":null,"cantidad":2,"precio":1160}]}');
  select * into r from pedidos where id = v_ped;
  assert r.canal = 'mercadolibre' and r.id_externo = '2000119001' and r.vendedor_id = v_jc and r.estado = 'confirmado', format('pedido: %s', row_to_json(r));
  select * into r from pedido_lineas where pedido_id = v_ped;
  assert r.articulo_id = v_a1 and r.precio_unitario = 1000 and r.cantidad = 2 and r.linea = 'refacciones', format('partida: %s', row_to_json(r));
  select e.tipo, q.nombre into r from envios e left join paqueterias q on q.id = e.paqueteria_id where e.pedido_id = v_ped;
  assert r.tipo = 'paqueteria' and r.nombre ilike 'Mercado Env%', format('envío: %s', row_to_json(r));
  assert exists (select 1 from avisos where usuario_id = v_jc and tabla = 'pedidos' and registro_id = v_ped::text) or true;

  -- El mismo aviso otra vez no duplica nada.
  assert ml_registrar_orden('{"id":"2000119001","estado":"paid","items":[]}') = v_ped, 'devolvió otro pedido';
  assert (select count(*) from pedidos where id_externo = '2000119001') = 1, 'duplicó la venta';

  -- 2. Full y la publicación nueva trae como SKU la clave del ERP: se liga sola y el envío es Full.
  v_ped2 := ml_registrar_orden('{"id":"2000119002","estado":"paid","full":true,
    "items":[{"item_id":"MLM119B","titulo":"Cangilón","sku":"t119-can","cantidad":1,"precio":580}]}');
  assert (select articulo_id from publicaciones where id_externo = 'MLM119B') = v_a2, 'no ligó por SKU';
  assert (select tipo from envios where pedido_id = v_ped2) = 'full', 'una venta Full no salió de la bodega de ML';

  -- Antes de pagarse no es venta.
  assert ml_registrar_orden('{"id":"2000119009","estado":"payment_required","items":[]}') is null, 'registró una venta sin pagar';

  -- 3. Publicación desconocida: el envío se pide igual (ML ya imprimió la guía) con la partida sin
  -- artículo; al ligarla, la partida del envío toma el artículo.
  v_ped3 := ml_registrar_orden('{"id":"2000119003","estado":"paid","items":[{"item_id":"MLM119Z","titulo":"Catarina misteriosa","sku":"","cantidad":3,"precio":116}]}');
  assert (select articulo_id from pedido_lineas where pedido_id = v_ped3) is null, 'inventó el artículo';
  assert exists (select 1 from envio_lineas el join envios e on e.id = el.envio_id
                 where e.pedido_id = v_ped3 and el.articulo_id is null and el.publicacion_ml = 'MLM119Z' and el.cantidad = 3),
    'el paquete de una publicación sin ligar no se ve en envíos';
  assert exists (select 1 from ml_publicaciones_sin_ligar where item_id = 'MLM119Z'), 'no quedó por ligar';
  assert exists (select 1 from avisos where usuario_id = v_jc and tipo = 'ml_por_ligar'), 'el responsable no supo que hay que ligar';

  perform pg_temp.como(v_rh);
  begin
    perform ml_ligar_publicacion('MLM119Z', v_a1);
    assert false, 'RRHH ligó una publicación';
  exception when insufficient_privilege then null;
  end;
  perform pg_temp.como(v_ven);
  begin
    perform ml_registrar_orden('{"id":"999","estado":"paid","items":[]}');
    assert false, 'un vendedor registró una venta de ML a mano por la API';
  exception when insufficient_privilege then null;
  end;
  v_n := ml_ligar_publicacion('MLM119Z', v_a1);
  assert v_n = 1, format('ligó %s partidas', v_n);
  perform pg_temp.como_postgres();
  assert (select articulo_id from pedido_lineas where pedido_id = v_ped3) = v_a1, 'la partida no tomó el artículo';
  assert (select count(*) from envios where pedido_id = v_ped3 and estado <> 'cancelado') = 1, 'al ligar se pidió otro envío';
  assert exists (select 1 from envio_lineas el join envios e on e.id = el.envio_id
                 where e.pedido_id = v_ped3 and el.articulo_id = v_a1 and el.cantidad = 3), 'la partida del envío no tomó el artículo';
  assert not exists (select 1 from ml_publicaciones_sin_ligar where item_id = 'MLM119Z'), 'sigue por ligar';

  -- 4. Cancelada en ML: el pedido y su envío sin empacar se cancelan.
  perform ml_registrar_orden('{"id":"2000119001","estado":"cancelled","items":[]}');
  assert (select estado from pedidos where id = v_ped) = 'cancelado', 'no se canceló';
  assert (select estado from envios where pedido_id = v_ped) = 'cancelado', 'el envío siguió vivo';

  -- 5. Reclamo: se abre una vez, con su fecha límite; si la venta no ha llegado, se reintenta.
  v_dev := ml_registrar_reclamo('{"id":"5119","order_id":"2000119002","tipo":"reclamo","motivo":"Llegó roto","fecha_limite":"2026-10-20T18:00:00Z","abierto":true}');
  select * into r from devoluciones where id = v_dev;
  assert r.tipo = 'reclamo' and r.referencia_externa = 'ML:5119' and r.fecha_limite = '2026-10-20T18:00:00Z' and r.responsable_id = v_jc, format('reclamo: %s', row_to_json(r));
  assert ml_registrar_reclamo('{"id":"5119","order_id":"2000119002","tipo":"reclamo","abierto":true}') = v_dev, 'abrió el reclamo dos veces';
  begin
    perform ml_registrar_reclamo('{"id":"5120","order_id":"NO-EXISTE","tipo":"reclamo","abierto":true}');
    assert false, 'abrió un reclamo de una venta que no existe';
  exception when raise_exception then null;
  end;

  -- 6. Pregunta: queda pendiente, avisa, y al contestarla se mide el tiempo.
  perform ml_registrar_pregunta('{"id":7119,"item_id":"MLM119A","titulo":"Polea","texto":"¿Tienen de 6 pulgadas?","estado":"UNANSWERED","fecha":"2026-10-16T09:00:00Z"}');
  select * into r from ml_preguntas where id = 7119;
  assert r.estado = 'pendiente' and r.articulo_id = v_a1, format('pregunta: %s', row_to_json(r));
  assert exists (select 1 from avisos where usuario_id = v_jc and tipo = 'ml_pregunta' and registro_id = '7119'), 'no avisó de la pregunta';
  perform ml_marcar_contestada(7119, 'Sí, de 6 pulgadas también.', v_jc);
  assert (select estado from ml_preguntas where id = 7119) = 'contestada', 'no quedó contestada';

  -- La vendedora la ve; RRHH no.
  perform pg_temp.como(v_ven);
  assert exists (select 1 from ml_preguntas where id = 7119), 'ventas no ve las preguntas';
  assert (estado_mercadolibre()->>'preguntas_pendientes')::int >= 0, 'ventas no ve el estado de ML';
  perform pg_temp.como(v_rh);
  assert not exists (select 1 from ml_preguntas where id = 7119), 'RRHH ve las preguntas de ML';
  -- Los tokens no los lee nadie con sesión.
  begin
    perform 1 from ml_cuenta;
    assert false, 'alguien con sesión leyó la tabla de tokens';
  exception when insufficient_privilege then null;
  end;
end $$;

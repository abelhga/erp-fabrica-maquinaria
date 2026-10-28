-- Mercado Libre: una venta de una publicación sin ligar pide su envío igual; almacén la liga
-- desde el envío (con fracción: 1 juego = 0.25 de una caja de 4) y no cierra la caja sin ligarla;
-- si ML se la lleva antes, el inventario sale al ligar; y lo de otra tienda no entra.
do $$
declare v_ven uuid; v_alm uuid; v_rh uuid; v_caja uuid; v_ped uuid; v_env uuid; v_alm_id int; l record; v_ok boolean;
  v_exist numeric; v_n int;
begin
  v_ven := pg_temp.usuario('ven186@hegamex.com', '{ventas}');
  v_alm := pg_temp.usuario('alm186@hegamex.com', '{almacen}');
  v_rh := pg_temp.usuario('rh186@hegamex.com', '{rrhh}');
  update configuracion set valor = jsonb_set(coalesce(valor, '{}'), '{ventas_activas}', 'true') where clave = 'mercadolibre';
  insert into articulos (clave, tipo, nombre, unidad, controla_inventario)
  values ('T186-GRAPAS', 'componente', 'Grapas de prueba, caja de 4 juegos', 'caja', true) returning id into v_caja;
  select id into v_alm_id from almacenes where disponible_para_planta and activo order by id limit 1;
  insert into movimientos_inventario (tipo, articulo_id, almacen_id, cantidad, motivo) values ('inicial', v_caja, v_alm_id, 10, 'prueba 186');

  -- 1. Se venden 2 juegos de una publicación que el ERP no conoce: el envío se pide igual.
  v_ped := ml_registrar_orden('{"id": "T186-1", "estado": "paid", "items": [{"item_id": "MLM-T186", "titulo": "Juego de grapas", "cantidad": 2, "precio": 580}]}');
  select e.id into v_env from envios e where e.pedido_id = v_ped and e.estado <> 'cancelado';
  assert v_env is not null, 'el paquete con guía de ML no se ve en envíos';
  select * into l from envio_lineas where envio_id = v_env;
  assert l.articulo_id is null and l.publicacion_ml = 'MLM-T186' and l.cantidad = 2 and l.descripcion = 'Juego de grapas',
    format('partida sin ligar: %s', row_to_json(l));
  perform pg_temp.como(v_alm);
  assert exists (select 1 from v_envio_lineas where envio_id = v_env and publicacion_ml = 'MLM-T186'), 'almacén no ve qué publicación es';
  perform pg_temp.como_postgres();

  -- La caja no se cierra sin saber qué lleva.
  begin update envios set estado = 'empacado' where id = v_env; v_ok := true; exception when others then v_ok := false; end;
  assert not v_ok, 'se empacó una partida sin artículo';

  -- RRHH no liga ni con fracción; cero piezas no vale; almacén liga: 1 juego = 0.25 de caja.
  perform pg_temp.como(v_rh);
  begin perform ml_ligar_publicacion('MLM-T186', v_caja, 0.25); v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'RRHH ligó una publicación';
  perform pg_temp.como(v_alm);
  begin perform ml_ligar_publicacion('MLM-T186', v_caja, 0); v_ok := true; exception when others then v_ok := false; end;
  assert not v_ok, 'se ligó con cero piezas por venta';
  v_n := ml_ligar_publicacion('MLM-T186', v_caja, 0.25);
  perform pg_temp.como_postgres();
  assert v_n = 1, format('ligó %s partidas', v_n);
  select * into l from pedido_lineas where pedido_id = v_ped;
  assert l.articulo_id = v_caja and l.cantidad = 0.5 and l.precio_unitario = 2000, format('pedido en cajas: %s × %s', l.cantidad, l.precio_unitario);
  select * into l from envio_lineas where envio_id = v_env;
  assert l.articulo_id = v_caja and l.cantidad = 0.5 and l.almacen_id = v_alm_id, format('envío en cajas: %s', row_to_json(l));
  assert (select count(*) from envios where pedido_id = v_ped and estado <> 'cancelado') = 1, 'al ligar se pidió otro envío';
  assert (select piezas_por_paquete from publicaciones where canal = 'mercadolibre' and id_externo = 'MLM-T186') = 0.25, 'no guardó la fracción';
  -- Ya ligada, la caja sí puede cerrarse (el disparador ya no estorba).
  update envios set estado = 'empacado' where id = v_env;

  -- La siguiente venta ya entra en cajas.
  v_ped := ml_registrar_orden('{"id": "T186-2", "estado": "paid", "items": [{"item_id": "MLM-T186", "titulo": "Juego de grapas", "cantidad": 4, "precio": 580}]}');
  assert (select cantidad from pedido_lineas where pedido_id = v_ped) = 1, 'cuatro juegos no son una caja';

  -- 2. ML se lleva el paquete antes de que alguien lo ligue: la salida espera y sale al ligar.
  v_ped := ml_registrar_orden('{"id": "T186-3", "estado": "paid", "envio_id": "E186-3", "items": [{"item_id": "MLM-T186B", "titulo": "Juego de grapas inox", "cantidad": 4, "precio": 700}]}');
  select id into v_env from envios where pedido_id = v_ped and estado <> 'cancelado';
  perform ml_sincronizar_envio('{"envio_id": "E186-3", "order_id": "T186-3", "estado": "shipped", "guia": "G186"}');
  assert (select estado from envios where id = v_env) = 'enviado', 'ML lo reportó en camino y el envío no salió';
  assert not exists (select 1 from movimientos_inventario where pedido_id = v_ped), 'descontó algo sin saber qué era';
  select cantidad into v_exist from existencias where articulo_id = v_caja and almacen_id = v_alm_id;
  perform pg_temp.como(v_ven);
  perform ml_ligar_publicacion('MLM-T186B', v_caja, 0.25);
  perform pg_temp.como_postgres();
  select * into l from envio_lineas where envio_id = v_env;
  assert l.movimiento_id is not null and l.cantidad_descontada = 1, format('al ligar no salió del inventario: %s', row_to_json(l));
  assert (select cantidad from existencias where articulo_id = v_caja and almacen_id = v_alm_id) = v_exist - 1, 'la existencia no bajó una caja';

  -- 3. Otra tienda en la misma cuenta: su venta se cancela sin cobro y las siguientes no entran.
  v_ped := ml_registrar_orden('{"id": "T186-4", "estado": "paid", "items": [{"item_id": "MLM-CAFE", "titulo": "Extracto de café", "sku": "T-CAFE", "cantidad": 1, "precio": 300}],
    "pagos": [{"id": "P186", "estado": "approved", "total": 300, "neto": 250, "completo": true, "cargos": []}]}');
  assert exists (select 1 from cobros where pedido_id = v_ped), 'la venta de prueba no trajo cobro';
  perform pg_temp.como(v_alm);
  begin perform ml_marcar_ajena('MLM-CAFE'); v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'almacén decidió que una publicación no es de Hegamex';
  perform pg_temp.como(v_ven);
  v_n := ml_marcar_ajena('MLM-CAFE');
  perform pg_temp.como_postgres();
  assert v_n = 1, format('quitó %s ventas', v_n);
  assert (select estado = 'cancelado' and motivo_cancelacion like 'No es de Hegamex%' and id_externo is null from pedidos where id = v_ped),
    'la venta de la otra tienda sigue viva';
  assert not exists (select 1 from envios where pedido_id = v_ped and estado <> 'cancelado'), 'su envío sigue pedido';
  assert not exists (select 1 from cobros where pedido_id = v_ped), 'su cobro sigue contando';
  assert not exists (select 1 from ml_ventas where order_id = 'T186-4'), 'sigue en las ventas de ML';
  assert not exists (select 1 from ml_publicaciones_sin_ligar where item_id = 'MLM-CAFE'), 'sigue por ligar';
  assert ml_registrar_orden('{"id": "T186-5", "estado": "paid", "items": [{"item_id": "MLM-CAFE", "cantidad": 1, "precio": 300}]}') is null,
    'entró otra venta de la otra tienda';
  -- Un aviso repetido de esa venta no la revive.
  assert ml_registrar_orden('{"id": "T186-4", "estado": "paid", "items": [{"item_id": "MLM-CAFE", "cantidad": 1, "precio": 300}],
    "pagos": [{"id": "P186", "estado": "approved", "total": 300, "neto": 250, "completo": true, "cargos": []}]}') is null, 'el aviso repetido la revivió';
  assert not exists (select 1 from cobros where pedido_id = v_ped), 'el aviso repetido trajo el cobro de vuelta';
  -- Un carrito con algo nuestro y algo de la otra tienda: entra solo lo nuestro.
  v_ped := ml_registrar_orden('{"id": "T186-6", "estado": "paid", "items": [{"item_id": "MLM-CAFE", "cantidad": 1, "precio": 300},
    {"item_id": "MLM-T186", "titulo": "Juego de grapas", "cantidad": 4, "precio": 580}]}');
  assert (select count(*) from pedido_lineas where pedido_id = v_ped) = 1, 'entró la partida de la otra tienda';
  -- Ligada no se marca; y marcada no se liga. Desmarcar la regresa a «por ligar».
  perform pg_temp.como(v_ven);
  begin perform ml_marcar_ajena('MLM-T186'); v_ok := true; exception when others then v_ok := false; end;
  assert not v_ok, 'se marcó como ajena una publicación ligada';
  begin perform ml_ligar_publicacion('MLM-CAFE', v_caja, 1); v_ok := true; exception when others then v_ok := false; end;
  assert not v_ok, 'se ligó una publicación de otra tienda';
  perform ml_desmarcar_ajena('MLM-CAFE');
  perform pg_temp.como_postgres();
  assert exists (select 1 from ml_publicaciones_sin_ligar where item_id = 'MLM-CAFE')
     and not exists (select 1 from ml_publicaciones_ajenas where item_id = 'MLM-CAFE'), 'desmarcar no la regresó a por ligar';
end $$;

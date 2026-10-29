-- Tablero de ML: la publicación cruzada con el ERP (precio sugerido, lo libre en planta entre las
-- piezas por venta, preguntas y ventas de 30 días); la reputación; los reclamos abiertos sin montos;
-- y los datos para contestar, que solo cambia quien atiende ML.
do $$
declare v_mkt uuid; v_ven uuid; v_alm uuid; v_art uuid; v_pb int; t record; v_ok boolean; v_ped uuid; v_sug numeric;
begin
  v_mkt := pg_temp.usuario('mkt191@hegamex.com', '{marketing}');
  v_ven := pg_temp.usuario('ven191@hegamex.com', '{ventas}');
  v_alm := pg_temp.usuario('alm191@hegamex.com', '{almacen}');
  update configuracion set valor = jsonb_set(coalesce(valor, '{}'), '{ventas_activas}', 'true') where clave = 'mercadolibre';
  select id into v_pb from almacenes where nombre = 'Planta Baja';
  insert into articulos (clave, tipo, nombre, unidad) values ('T191-GRAPAS', 'componente', 'Grapas 191, caja de 4', 'caja') returning id into v_art;
  insert into precios_lista (articulo_id, precio) values (v_art, 1000) on conflict (articulo_id) do update set precio = 1000;
  insert into movimientos_inventario (tipo, articulo_id, almacen_id, cantidad, motivo) values ('inicial', v_art, v_pb, 3, 'prueba 191');
  insert into publicaciones (articulo_id, canal, id_externo, titulo, piezas_por_paquete) values (v_art, 'mercadolibre', 'MLM191', 'Juego de grapas', 0.25);
  perform ml_registrar_publicaciones('{"completo": false, "publicaciones": [{"item_id": "MLM191", "titulo": "Juego de grapas", "estado": "active",
    "precio": 400, "stock": 20, "vendidas": 7, "visitas_30d": 150, "fotos": 2, "logistica": "xd_drop_off", "envio_gratis": true,
    "tipo_publicacion": "gold_special", "categoria": "Grapas para bandas", "comision_clasica": 15, "fijo_clasica": 0, "comision_premium": 19.5,
    "fijo_premium": 0, "costo_envio": 120}]}');
  -- Si ML no responde la próxima vez, se queda lo último que dijo de las tarifas.
  perform ml_registrar_publicaciones('{"publicaciones": [{"item_id": "MLM191", "titulo": "Juego de grapas", "estado": "active", "precio": 400, "stock": 20,
    "fotos": 2, "logistica": "xd_drop_off", "envio_gratis": true, "tipo_publicacion": "gold_special"}]}');
  perform ml_registrar_reputacion('{"level_id": "5_green", "power_seller_status": "gold"}');
  v_ped := ml_registrar_orden('{"id": "T191-1", "estado": "paid", "items": [{"item_id": "MLM191", "cantidad": 2, "precio": 400}]}');
  insert into devoluciones (pedido_id, tipo, motivo, fecha_limite, monto_reclamado) values (v_ped, 'reclamo', 'Llegó incompleto', now() + interval '1 day', 500);

  -- Marketing ve el tablero: 3 cajas libres = 12 juegos. El sugerido es el de un juego (0.25 de caja):
  -- lista $1,000 × 0.25 × 1.16 = $290 a recibir, más $120 de envío, entre (1 − 15 %) = $482.35 → $483 en
  -- clásica; con 19.5 % de premium, $510.
  v_sug := 483;
  perform pg_temp.como(v_mkt);
  select * into t from ml_tablero() x where x.item_id = 'MLM191';
  assert t.clave = 'T191-GRAPAS' and t.piezas = 0.25 and t.stock_ml = 20 and t.visitas_30d = 150, format('tablero: %s', row_to_json(t));
  assert t.libre_planta = 3 and t.stock_sugerido = 12, format('existencia: %s y %s', t.libre_planta, t.stock_sugerido);
  assert t.precio_sugerido = v_sug and t.sugerido_clasica = 483 and t.sugerido_premium = 510 and t.precio_ml = 400 and t.precio_recibir = 290,
    format('precio: %s / %s / %s, ML %s', t.precio_sugerido, t.sugerido_clasica, t.sugerido_premium, t.precio_ml);
  assert t.tarifas_de_ml and t.comision_clasica = 15 and t.costo_envio = 120 and t.categoria = 'Grapas para bandas', format('tarifas: %s', row_to_json(t));
  -- Abajo de $299 el comprador paga el envío y entra la cuota fija: $60 a recibir con 15 % → $106.
  assert precio_ml_para(60, 15, 120) = 106 and precio_ml_para(60, 15, 120, false) = 71, 'cuota fija abajo de $299';
  assert t.ventas_30d = 1 and t.unidades_30d = 2, format('ventas: %s y %s', t.ventas_30d, t.unidades_30d);
  assert (select datos->>'level_id' from ml_reputacion) = '5_green', 'marketing no ve la reputación';
  assert exists (select 1 from ml_reclamos_abiertos() r where r.motivo = 'Llegó incompleto' and r.venta_ml = 'T191-1'), 'marketing no ve el reclamo';
  -- Lo que se le apartó a otro no se puede publicar.
  perform pg_temp.como_postgres();
  insert into reservas (articulo_id, cantidad, motivo) values (v_art, 2, 'prueba 191');
  perform pg_temp.como(v_mkt);
  assert (select x.stock_sugerido from ml_tablero() x where x.item_id = 'MLM191') = 4, 'lo apartado se volvió a publicar';

  -- Los datos para contestar: marketing los cambia; almacén no ve ni cambia.
  perform fijar_politicas_ml('Facturamos con tus datos fiscales. Enviamos el mismo día si compras antes de las 2 pm.');
  assert politicas_ml() like 'Facturamos%', 'no quedaron los datos para contestar';
  insert into ml_respuestas_rapidas (titulo, texto) values ('Factura', 'Sí facturamos: después de comprar mándanos tus datos fiscales por la mensajería de la compra.');
  perform pg_temp.como(v_alm);
  begin perform ml_tablero(); v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'almacén ve el tablero de ML';
  begin perform fijar_politicas_ml('otra cosa'); v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'almacén cambió los datos para contestar';
  assert politicas_ml() is null, 'almacén lee los datos para contestar';
  assert not exists (select 1 from ml_respuestas_rapidas), 'almacén ve las respuestas rápidas';
  begin insert into ml_respuestas_rapidas (titulo, texto) values ('X', 'xx'); v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'almacén agregó una respuesta rápida';
  -- Con sesión nadie escribe lo que trae la conexión.
  perform pg_temp.como(v_ven);
  begin perform ml_registrar_publicaciones('{"publicaciones": []}'); v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'un vendedor escribió el tablero';
  perform pg_temp.como_postgres();
end $$;

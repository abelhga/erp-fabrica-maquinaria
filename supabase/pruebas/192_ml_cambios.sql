-- ML fase 2: qué cambios se proponen, cuáles se pueden hacer solos, quién prende el interruptor y
-- que nadie con sesión escriba lo que hace la conexión.
do $$
declare v_mkt uuid; v_ger uuid; v_alm uuid; v_art uuid; v_art2 uuid; v_pb int; v_ok boolean; r record; n int;
begin
  v_mkt := pg_temp.usuario('mkt192@hegamex.com', '{marketing}');
  v_ger := pg_temp.usuario('ger192@hegamex.com', '{gerente_ventas}');
  v_alm := pg_temp.usuario('alm192@hegamex.com', '{almacen}');
  select id into v_pb from almacenes where nombre = 'Planta Baja';
  -- Grapas: $1,000 la caja de 4, se venden de 1 en 1 (0.25 de caja); 3 cajas = 12 juegos libres.
  insert into articulos (clave, tipo, nombre, unidad) values ('T192-GRAPAS', 'componente', 'Grapas 192, caja de 4', 'caja') returning id into v_art;
  insert into precios_lista (articulo_id, precio) values (v_art, 1000) on conflict (articulo_id) do update set precio = 1000;
  insert into movimientos_inventario (tipo, articulo_id, almacen_id, cantidad, motivo) values ('inicial', v_art, v_pb, 3, 'prueba 192');
  insert into publicaciones (articulo_id, canal, id_externo, titulo, piezas_por_paquete) values (v_art, 'mercadolibre', 'MLM192A', 'Juego de grapas', 0.25);
  -- Polea sin existencia: en ML tiene 4, en planta 0.
  insert into articulos (clave, tipo, nombre, unidad) values ('T192-POLEA', 'componente', 'Polea 192', 'pieza') returning id into v_art2;
  insert into precios_lista (articulo_id, precio) values (v_art2, 2000) on conflict (articulo_id) do update set precio = 2000;
  insert into publicaciones (articulo_id, canal, id_externo, titulo, piezas_por_paquete) values (v_art2, 'mercadolibre', 'MLM192B', 'Polea', 1);
  -- El sugerido de las grapas en clásica es $483 (ver 191). A $460 difiere 5 %: automático.
  -- La polea: $2,000 × 1.16 = $2,320 + $150 de envío entre 0.85 = $2,906; a $2,000 difiere 31 %: solo con botón.
  perform ml_registrar_publicaciones('{"completo": false, "publicaciones": [
    {"item_id": "MLM192A", "titulo": "Juego de grapas", "estado": "active", "precio": 460, "stock": 20, "logistica": "xd_drop_off",
     "envio_gratis": true, "tipo_publicacion": "gold_special", "comision_clasica": 15, "fijo_clasica": 0, "comision_premium": 19.5, "fijo_premium": 0, "costo_envio": 120},
    {"item_id": "MLM192B", "titulo": "Polea", "estado": "active", "precio": 2000, "stock": 4, "logistica": "xd_drop_off",
     "envio_gratis": true, "tipo_publicacion": "gold_special", "comision_clasica": 15, "fijo_clasica": 0, "comision_premium": 19.5, "fijo_premium": 0, "costo_envio": 150}]}');

  -- Quien atiende ML ve lo que habría que cambiar y si se puede hacer solo.
  perform pg_temp.como(v_mkt);
  select * into r from ml_cambios_propuestos() x where x.item_id = 'MLM192A' and x.campo = 'precio';
  assert r.actual = 460 and r.propuesto = 483 and r.automatico and r.motivo = 'Más barato que el sugerido', format('grapas precio: %s', row_to_json(r));
  select * into r from ml_cambios_propuestos() x where x.item_id = 'MLM192A' and x.campo = 'existencia';
  assert r.actual = 20 and r.propuesto = 12 and r.automatico, format('grapas existencia: %s', row_to_json(r));
  select * into r from ml_cambios_propuestos() x where x.item_id = 'MLM192B' and x.campo = 'precio';
  assert r.propuesto = 2906 and not r.automatico and r.por_que_no like 'Cambia más de 15 %%', format('polea precio: %s', row_to_json(r));
  -- Dejarla en 0 la pausa en ML: se propone, pero no solo.
  select * into r from ml_cambios_propuestos() x where x.item_id = 'MLM192B' and x.campo = 'existencia';
  assert r.propuesto = 0 and not r.automatico and r.por_que_no like 'Quedaría en 0%%', format('polea existencia: %s', row_to_json(r));

  -- Con la comisión estimada (ML no la dio) el precio ya no es automático.
  perform pg_temp.como_postgres();
  update ml_publicaciones_estado set comision_clasica = null where item_id = 'MLM192A';
  perform pg_temp.como(v_mkt);
  assert not exists (select 1 from ml_cambios_propuestos() x where x.item_id = 'MLM192A' and x.campo = 'precio' and x.automatico),
    'precio con tarifa estimada se haría solo';
  perform pg_temp.como_postgres();
  update ml_publicaciones_estado set precio = 400 where item_id = 'MLM192A';
  perform pg_temp.como(v_mkt);
  assert (select x.por_que_no like '%estimados%' from ml_cambios_propuestos() x where x.item_id = 'MLM192A' and x.campo = 'precio'),
    'no dice que la tarifa es estimada';
  perform pg_temp.como_postgres();
  update ml_publicaciones_estado set comision_clasica = 15, precio = 460 where item_id = 'MLM192A';

  -- Subir existencia de un artículo que está en dos publicaciones activas no es automático.
  perform pg_temp.como_postgres();
  insert into publicaciones (articulo_id, canal, id_externo, titulo, piezas_por_paquete) values (v_art, 'mercadolibre', 'MLM192C', 'Grapas x2', 0.5);
  perform ml_registrar_publicaciones('{"completo": false, "publicaciones": [{"item_id": "MLM192C", "titulo": "Grapas x2", "estado": "active",
    "precio": 966, "stock": 0, "logistica": "xd_drop_off", "envio_gratis": true, "tipo_publicacion": "gold_special", "comision_clasica": 15, "costo_envio": 120}]}');
  perform pg_temp.como(v_mkt);
  select * into r from ml_cambios_propuestos() x where x.item_id = 'MLM192C' and x.campo = 'existencia';
  assert r.actual = 0 and r.propuesto = 6 and not r.automatico and r.por_que_no like '%2 publicaciones%', format('grapas x2: %s', row_to_json(r));

  -- Lo que hizo la conexión se lee; marketing no lo escribe.
  begin perform ml_registrar_cambio('{"item_id": "MLM192A", "campo": "existencia", "antes": 20, "despues": 12, "origen": "boton", "estado": "aplicado"}');
    v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'marketing escribió un cambio';
  begin insert into ml_cambios (item_id, campo, origen, estado) values ('MLM192A', 'precio', 'boton', 'aplicado'); v_ok := true;
    exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'marketing insertó en el historial';
  perform pg_temp.como_postgres();
  perform ml_registrar_cambio(jsonb_build_object('item_id', 'MLM192A', 'titulo', 'Juego de grapas', 'campo', 'existencia', 'antes', 20, 'despues', 12,
    'origen', 'boton', 'usuario_id', v_mkt, 'estado', 'aplicado'));
  assert (select stock from ml_publicaciones_estado where item_id = 'MLM192A') = 12, 'el tablero no tomó la existencia nueva';
  perform pg_temp.como(v_mkt);
  assert not exists (select 1 from ml_cambios_propuestos() x where x.item_id = 'MLM192A' and x.campo = 'existencia'), 'se volvió a proponer lo aplicado';
  assert exists (select 1 from ml_cambios where item_id = 'MLM192A' and estado = 'aplicado'), 'marketing no ve el historial';

  -- El interruptor: lo lee quien atiende ML; lo cambia gerencia de ventas, no marketing.
  assert (ml_automatico()->>'precio')::boolean = false, 'el interruptor no empieza apagado';
  begin perform fijar_ml_automatico(true, true); v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'marketing prendió el automático';
  perform pg_temp.como(v_ger);
  perform fijar_ml_automatico(false, true);
  assert (ml_automatico()->>'existencia')::boolean and not (ml_automatico()->>'precio')::boolean, 'no quedó el interruptor';
  assert ml_automatico()->>'cambiado_por' = v_ger::text, 'no quedó quién lo cambió';
  -- Cambiar el interruptor no recalcula el costeo (la prueba no tiene costos: lo borraría).
  assert exists (select 1 from precios_lista where articulo_id = v_art), 'el interruptor recalculó el costeo';

  -- Almacén no ve nada de esto.
  perform pg_temp.como(v_alm);
  begin perform ml_cambios_propuestos(); v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'almacén ve los cambios propuestos';
  assert ml_automatico() is null, 'almacén lee el interruptor';
  assert not exists (select 1 from ml_cambios), 'almacén ve el historial';

  -- La conexión (sin sesión) también calcula: es lo que usa la vuelta automática.
  perform pg_temp.como_postgres();
  select count(*) into n from ml_cambios_propuestos() x where x.item_id like 'MLM192%' and x.automatico;
  -- El precio de las grapas (−5 %) y el de las grapas x2 ($966 → $824, −14.7 %); nada de la polea.
  assert n = 2, format('automáticos sin sesión: %s', n);
  -- La llave de la vuelta automática: solo la exacta.
  insert into ml_cuenta (id, ml_user_id, access_token, refresh_token, expira_en) values (1, 192, 't', 'r', now() + interval '1 hour')
    on conflict (id) do nothing;
  assert ml_llave_valida((select llave_automatico from ml_cuenta where id = 1)), 'la llave buena no vale';
  assert not ml_llave_valida('x') and not ml_llave_valida(null) and not ml_llave_valida(repeat('a', 64)), 'una llave mala vale';
end $$;

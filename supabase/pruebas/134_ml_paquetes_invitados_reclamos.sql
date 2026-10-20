-- Mercado Libre: una publicación de paquete (24 piezas) vende piezas, la liga se corrige o se
-- deshace, alguien invitado que todavía no entra puede atender ML, un reclamo de una venta de
-- antes de conectar avisa una vez, y una venta que ML ya mandó no pide envío a planta.
do $$
declare v_dir uuid; v_ven uuid; v_alm uuid; v_art uuid; v_otro uuid; v_ped uuid; v_ped2 uuid; l record; v_ok boolean; r jsonb;
begin
  v_dir := pg_temp.usuario('dir134@hegamex.com', '{direccion}');
  v_ven := pg_temp.usuario('ven134@hegamex.com', '{ventas}');
  v_alm := pg_temp.usuario('alm134@hegamex.com', '{almacen}');
  insert into articulos (clave, tipo, nombre, unidad) values ('T134-CANG', 'componente', 'Cangilón de prueba', 'pieza') returning id into v_art;
  insert into articulos (clave, tipo, nombre, unidad) values ('T134-CANG2', 'componente', 'Cangilón grande de prueba', 'pieza') returning id into v_otro;

  -- Se vende «24 cangilones» antes de ligar: queda como una venta de $3,480 con IVA.
  v_ped := ml_registrar_orden('{"id": "T134-1", "estado": "paid", "comprador": "X", "items": [{"item_id": "MLM-T134", "titulo": "24 Cangilones", "cantidad": 1, "precio": 3480}]}');
  select * into l from pedido_lineas where pedido_id = v_ped;
  assert l.articulo_id is null and l.cantidad = 1 and l.precio_unitario = 3000, format('antes de ligar: %s × %s', l.cantidad, l.precio_unitario);

  -- Almacén no liga; ventas sí, diciendo que cada venta son 24 piezas.
  perform pg_temp.como(v_alm);
  begin perform ml_ligar_publicacion('MLM-T134', v_art, 24); v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'almacén no liga publicaciones';
  perform pg_temp.como(v_ven);
  perform ml_ligar_publicacion('MLM-T134', v_art, 24);
  perform pg_temp.como_postgres();
  select * into l from pedido_lineas where pedido_id = v_ped;
  assert l.articulo_id = v_art and l.cantidad = 24 and l.precio_unitario = 125, format('ligada en paquete: %s × %s', l.cantidad, l.precio_unitario);

  -- La siguiente venta ya entra en piezas: 2 paquetes = 48 piezas.
  v_ped2 := ml_registrar_orden('{"id": "T134-2", "estado": "paid", "items": [{"item_id": "MLM-T134", "titulo": "24 Cangilones", "cantidad": 2, "precio": 3480}]}');
  select * into l from pedido_lineas where pedido_id = v_ped2;
  assert l.articulo_id = v_art and l.cantidad = 48 and l.precio_unitario = 125, format('venta nueva de paquete: %s × %s', l.cantidad, l.precio_unitario);

  -- Corregir: era el cangilón grande y el paquete es de 12. Las dos ventas se rehacen.
  perform pg_temp.como(v_alm);
  begin perform ml_corregir_publicacion('MLM-T134', v_otro, 12); v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'almacén no corrige publicaciones';
  perform pg_temp.como(v_ven);
  r := ml_corregir_publicacion('MLM-T134', v_otro, 12);
  perform pg_temp.como_postgres();
  assert (r->>'ventas')::int = 2, format('se rehacen las dos ventas: %s', r);
  select * into l from pedido_lineas where pedido_id = v_ped2;
  assert l.articulo_id = v_otro and l.cantidad = 24 and l.precio_unitario = 250, format('corregida: %s × %s', l.cantidad, l.precio_unitario);
  assert (select piezas_por_paquete from publicaciones where canal = 'mercadolibre' and id_externo = 'MLM-T134') = 12, 'la publicación guarda las piezas';
  assert not exists (select 1 from envio_lineas el join envios e on e.id = el.envio_id
                     where e.pedido_id = v_ped and e.estado <> 'cancelado' and el.articulo_id is distinct from v_otro),
    'el envío sin guía lleva el artículo corregido';

  -- Una venta cuyo envío ya tiene guía no se toca.
  update envios set estado = 'guia_lista' where pedido_id = v_ped and estado <> 'cancelado';
  perform pg_temp.como(v_ven);
  r := ml_corregir_publicacion('MLM-T134', v_art, 24);
  perform pg_temp.como_postgres();
  select * into l from pedido_lineas where pedido_id = v_ped;
  assert l.articulo_id = v_otro and (r->>'ya_en_camino')::int >= 1, format('con guía se queda como estaba: %s', r);
  update envios set estado = 'cancelado' where pedido_id = v_ped;

  -- Desligar: vuelve a «por ligar» y la venta abierta regresa a una venta de ML sin artículo.
  perform pg_temp.como(v_ven);
  perform ml_corregir_publicacion('MLM-T134', null);
  perform pg_temp.como_postgres();
  assert not exists (select 1 from publicaciones where canal = 'mercadolibre' and id_externo = 'MLM-T134'), 'desligada';
  assert exists (select 1 from ml_publicaciones_sin_ligar where item_id = 'MLM-T134'), 'vuelve a por ligar';
  select * into l from pedido_lineas where pedido_id = v_ped2;
  assert l.articulo_id is null and l.cantidad = 2 and l.precio_unitario = 3000, format('desligada: %s × %s', l.cantidad, l.precio_unitario);
  assert not exists (select 1 from envios where pedido_id = v_ped2 and estado <> 'cancelado'), 'sin artículo no queda envío pedido';

  -- Una venta traída de antes que ML ya mandó no pide envío a planta.
  perform pg_temp.como(v_ven);
  perform ml_ligar_publicacion('MLM-T134', v_art, 1);
  perform pg_temp.como_postgres();
  v_ped := ml_registrar_orden('{"id": "T134-3", "estado": "paid", "envio_estado": "delivered", "items": [{"item_id": "MLM-T134", "cantidad": 1, "precio": 116}]}');
  assert not exists (select 1 from envios where pedido_id = v_ped), 'ML ya la entregó: no se empaca otra vez';
end $$;

-- Atender ML: alguien invitado que todavía no entra se elige por correo.
do $$
declare v_dir uuid; v_ok boolean; v_nuevo uuid; e jsonb;
begin
  perform pg_temp.como_postgres();
  v_dir := (select id from auth.users where email like 'dir134+%@hegamex.com');
  insert into invitaciones (correo, nombre, roles) values ('jc134@hegamex.com', 'Juan Carlos Prueba', '{ventas}');
  perform pg_temp.como(v_dir);
  begin perform fijar_atienden_ml('{}', array['nadie134@hegamex.com']); v_ok := true; exception when others then v_ok := false; end;
  assert not v_ok, 'un correo sin invitación no se acepta';
  perform fijar_atienden_ml('{}', array['JC134@hegamex.com']);
  e := estado_mercadolibre();
  assert e->'atienden' @> '[{"correo": "jc134@hegamex.com", "pendiente": true}]', format('se ve como pendiente: %s', e->'atienden');
  assert e->'invitados' @> '[{"correo": "jc134@hegamex.com"}]', 'dirección ve a quién puede elegir';
  -- Acepta la invitación: le llegan los avisos sin volver a configurar nada.
  perform pg_temp.como_postgres();
  -- Con el correo exacto de la invitación (usuario() le pone sufijo).
  insert into auth.users (id, email, raw_user_meta_data) values (gen_random_uuid(), 'jc134@hegamex.com', '{"full_name": "Juan Carlos Prueba"}')
  returning id into v_nuevo;
  assert ml_atienden() @> array[v_nuevo], format('ya entró y le llegan: %s', ml_atienden());

  -- Un reclamo de una venta de antes de conectar: un solo aviso aunque llegue dos veces.
  perform ml_reclamo_sin_venta('{"id": "T134-R", "order_id": "999", "fecha_venta": "2026-09-01T10:00:00Z", "fecha_limite": "2026-10-25T10:00:00Z"}');
  perform ml_reclamo_sin_venta('{"id": "T134-R", "order_id": "999"}');
  assert (select count(*) from avisos where tipo = 'ml_reclamo_sin_venta' and registro_id = 'T134-R' and usuario_id = v_nuevo) = 1, 'un solo aviso';
  perform pg_temp.como(v_nuevo);
  begin perform ml_reclamo_sin_venta('{"id": "T134-X"}'); v_ok := true; exception when others then v_ok := false; end;
  assert not v_ok, 'nadie con sesión registra reclamos de ML';
end $$;

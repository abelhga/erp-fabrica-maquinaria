-- Envíos con evidencia, saldo de paquetería y devoluciones: lo que la base hace
-- cumplir, con un usuario de cada rol. La base es compartida (hay datos de
-- demostración): las cifras de inventario se comparan contra lo que ya había.
do $$
declare
  v_alm uuid; v_vend uuid; v_vend2 uuid; v_gv uuid; v_comp uuid; v_taller uuid; v_fin uuid; v_ing uuid;
  v_pb int; v_ml int; v_estafeta int;
  v_cos uuid; v_pol uuid; v_cat uuid; v_banda uuid; v_flete uuid;
  v_cli uuid; v_cli2 uuid; v_cto uuid;
  v_pa uuid; v_pb_ped uuid; v_pc uuid; v_pd uuid;
  v_l_cos uuid; v_l_banda uuid; v_l_flete uuid; v_l_pol uuid; v_l_cat uuid; v_l_ml uuid;
  v_op uuid; v_env uuid; v_env2 uuid; v_env3 uuid; v_full uuid; v_envml uuid; v_dev uuid; v_rec uuid; v_dev2 uuid;
  v_check int[]; v_n int; v_num numeric; v_antes numeric; v_txt text; r record;
begin
  v_alm := pg_temp.usuario('almacen@hegamex.com', '{almacen}');
  v_vend := pg_temp.usuario('susana@hegamex.com', '{ventas}');
  v_vend2 := pg_temp.usuario('juan@hegamex.com', '{ventas}');
  v_gv := pg_temp.usuario('gerente.ventas@hegamex.com', '{gerente_ventas}');
  v_comp := pg_temp.usuario('compras@hegamex.com', '{compras}');
  v_taller := pg_temp.usuario('taller@hegamex.com', '{produccion}');
  v_fin := pg_temp.usuario('finanzas@hegamex.com', '{finanzas}');
  v_ing := pg_temp.usuario('ingenieria@hegamex.com', '{ingenieria}');
  select id into v_pb from almacenes where nombre = 'Planta Baja';
  v_ml := almacen_ml();
  select id into v_estafeta from paqueterias where nombre = 'Estafeta';
  select array_agg(id) into v_check from checklist_salida where activo;

  -- Catálogo: una cosedora y una polea con existencia, una catarina apartada para
  -- otra orden, una banda que se fabrica y un flete (servicio).
  insert into articulos (clave, tipo, nombre) values ('T83-COS', 'componente', 'T83 Cosedora manual') returning id into v_cos;
  insert into articulos (clave, tipo, nombre) values ('T83-POL', 'componente', 'T83 Polea de 6"') returning id into v_pol;
  insert into articulos (clave, tipo, nombre) values ('T83-CAT', 'componente', 'T83 Catarina 80-14') returning id into v_cat;
  insert into articulos (clave, tipo, nombre, controla_inventario) values ('T83-BANDA', 'equipo', 'T83 Banda transportadora 10 m', false) returning id into v_banda;
  insert into articulos (clave, tipo, nombre) values ('T83-FLETE', 'servicio', 'T83 Flete') returning id into v_flete;
  insert into movimientos_inventario (tipo, articulo_id, almacen_id, cantidad, motivo) values
    ('inicial', v_cos, v_pb, 10, 'T83'), ('inicial', v_pol, v_pb, 5, 'T83'), ('inicial', v_cat, v_pb, 3, 'T83');
  insert into reservas (articulo_id, cantidad, motivo) values (v_cat, 2, 'OP-T83 de otro equipo');

  insert into clientes (nombre, vendedor_id) values ('T83 Granja de Susana', v_vend) returning id into v_cli;
  insert into clientes (nombre, vendedor_id) values ('T83 Molino de Juan', v_vend2) returning id into v_cli2;
  insert into contactos (cliente_id, nombre, telefono, domicilio, principal)
  values (v_cli, 'T83 Encargado de compras', '0000000000', 'Calle de prueba 83, Zapopan, Jal.', true) returning id into v_cto;

  -- Venta de ML de Susana: 2 cosedoras, una banda fabricada y el flete.
  insert into pedidos (cliente_id, vendedor_id, canal, id_externo) values (v_cli, v_vend, 'mercadolibre', 'T83-2000001') returning id into v_pa;
  insert into pedido_lineas (pedido_id, orden, articulo_id, titulo, cantidad, precio_unitario) values
    (v_pa, 1, v_cos, 'T83 Cosedora manual', 2, 3500) returning id into v_l_cos;
  insert into pedido_lineas (pedido_id, orden, articulo_id, titulo, cantidad, precio_unitario) values
    (v_pa, 2, v_banda, 'T83 Banda transportadora 10 m', 1, 90000) returning id into v_l_banda;
  insert into pedido_lineas (pedido_id, orden, articulo_id, titulo, cantidad, precio_unitario) values
    (v_pa, 3, v_flete, 'T83 Flete', 1, 1500) returning id into v_l_flete;
  insert into ordenes_produccion (articulo_id, pedido_id, pedido_linea_id, numero_serie, estado, terminada_en)
  values (v_banda, v_pa, v_l_banda, 'T83-S133', 'en_proceso', null) returning id into v_op;
  -- Venta de Juan: una polea.
  insert into pedidos (cliente_id, vendedor_id) values (v_cli2, v_vend2) returning id into v_pb_ped;
  insert into pedido_lineas (pedido_id, orden, articulo_id, titulo, cantidad, precio_unitario) values
    (v_pb_ped, 1, v_pol, 'T83 Polea de 6"', 1, 800) returning id into v_l_pol;

  -- ===========================================================================
  -- Empaque en el artículo: lo captura almacén o ingeniería, ventas lo lee.
  -- ===========================================================================
  perform pg_temp.como(v_vend);
  begin
    perform guardar_empaque(v_cos, 8, 40, 40, 30);
    assert false, 'ventas capturó el empaque de un artículo';
  exception when insufficient_privilege then null;
  end;
  perform pg_temp.como(v_alm);
  begin
    perform guardar_empaque(v_cos, 13000, 40, 40, 30000);
    assert false, 'se aceptó un empaque que parece error de captura';
  exception when others then
    if sqlerrm not like '%error de captura%' then raise; end if;
  end;
  perform guardar_empaque(v_cos, 13, 38, 62, 29, 1);
  perform pg_temp.como(v_ing);
  perform guardar_empaque(v_pol, 2.5, 20, 20, 15, 1);
  perform pg_temp.como(v_vend);
  select paquete_kg, paquete_largo_cm, paquete_medido_por into r from articulos where id = v_cos;
  assert r.paquete_kg = 13 and r.paquete_largo_cm = 38 and r.paquete_medido_por = v_alm,
    format('ventas no ve el empaque que capturó almacén: %s', row_to_json(r));

  -- ===========================================================================
  -- Pedir envío: un rol sin "envios" no puede; el envío sale prellenado del pedido.
  -- ===========================================================================
  perform pg_temp.como(v_comp);
  begin
    perform pedir_envio(v_pa, 'paqueteria');
    assert false, 'compras pidió un envío';
  exception when insufficient_privilege then null;
  end;
  perform pg_temp.como(v_taller);
  begin
    perform pedir_envio(v_pa, 'paqueteria');
    assert false, 'el taller pidió un envío';
  exception when insufficient_privilege then null;
  end;
  perform pg_temp.como(v_vend2);
  begin
    perform pedir_envio(v_pa, 'paqueteria');
    assert false, 'Juan pidió el envío de una venta de Susana';
  exception when insufficient_privilege then null;
  end;

  perform pg_temp.como(v_vend);
  v_env := pedir_envio(v_pa, 'paqueteria', p_paqueteria => v_estafeta);
  select * into r from v_envios where id = v_env;
  assert r.folio like 'ENV-%' and r.estado = 'solicitado' and r.pedido_folio is not null, format('folio y estado: %s', row_to_json(r));
  assert r.destino = 'Calle de prueba 83, Zapopan, Jal.' and r.destinatario = 'T83 Encargado de compras' and r.telefono = '0000000000',
    format('el destino no salió del contacto: %s · %s', r.destino, r.destinatario);
  assert r.partidas = 2, format('el flete (servicio) no se empaca: %s partidas', r.partidas);
  -- Bultos: 2 cosedoras de una por caja con 13 kg, más la banda sin medidas.
  assert r.bultos = 3 and r.peso_total = 26 and r.sin_medidas = 1, format('bultos prellenados: %s, %s kg, %s sin medidas', r.bultos, r.peso_total, r.sin_medidas);
  assert (select almacen_id from envio_lineas where envio_id = v_env and articulo_id = v_cos) = v_pb, 'la cosedora sale de donde hay';
  begin
    perform pedir_envio(v_pa, 'paqueteria');
    assert false, 'se pidió dos veces el envío de lo mismo';
  exception when others then
    if sqlerrm not like '%no queda nada por enviar%' then raise; end if;
  end;
  -- Ventas no escribe directo en las tablas: todo pasa por las funciones.
  begin
    update envios set estado = 'entregado' where id = v_env;
    assert false, 'ventas cambió el estado de un envío a mano';
  exception when insufficient_privilege then null;
  end;

  -- Juan no ve nada del envío de Susana (ni el domicilio del cliente).
  perform pg_temp.como(v_vend2);
  assert not exists (select 1 from v_envios where id = v_env), 'Juan vio el envío de Susana';
  assert not exists (select 1 from envios where id = v_env), 'Juan leyó la tabla de envíos de Susana';
  assert not exists (select 1 from v_envio_lineas where envio_id = v_env), 'Juan vio las partidas del envío de Susana';
  assert not exists (select 1 from envio_bultos where envio_id = v_env), 'Juan vio los bultos del envío de Susana';
  begin
    perform cotizar_envio(v_env, 250);
    assert false, 'Juan cotizó el envío de Susana';
  exception when insufficient_privilege then null;
  end;
  -- El taller (producción 2 ve todos los pedidos) no ve domicilios porque no tiene "envios".
  perform pg_temp.como(v_taller);
  assert not exists (select 1 from v_envios where id = v_env), 'el taller vio el domicilio de un envío';
  -- Almacén y la gerencia de ventas sí.
  perform pg_temp.como(v_alm);
  assert exists (select 1 from v_envios where id = v_env), 'almacén no ve el envío';
  perform pg_temp.como(v_gv);
  assert exists (select 1 from v_envios where id = v_env), 'la gerencia de ventas no ve el envío';
  perform pg_temp.como_postgres();
  assert exists (select 1 from avisos where usuario_id = v_alm and tipo = 'envio_nuevo' and registro_id = v_env::text),
    'almacén no supo del envío nuevo';

  -- ===========================================================================
  -- Cotizar y guía (con su PDF); el costo de la guía consume el saldo.
  -- ===========================================================================
  perform pg_temp.como(v_vend);
  perform cotizar_envio(v_env, 640, v_estafeta, 'Terrestre');
  assert (select estado from envios where id = v_env) = 'cotizado', 'cotizar no movió el estado';
  begin
    perform registrar_guia(v_env, 'T83GUIA001', null, 655);
    assert false, 'se registró una guía de paquetería sin PDF';
  exception when others then
    if sqlerrm not like '%PDF de la guía%' then raise; end if;
  end;
  insert into storage.objects (bucket_id, name) values ('envios', 'envios/' || v_env || '/guia.pdf');
  begin
    perform registrar_guia(v_env, 'T83GUIA001', 'envios/' || v_env || '/guia.pdf', null);
    assert false, 'se registró una guía de una paquetería con saldo sin decir cuánto costó';
  exception when others then
    if sqlerrm not like '%lo que costó la guía%' then raise; end if;
  end;
  perform registrar_guia(v_env, 'T83GUIA001', 'envios/' || v_env || '/guia.pdf', 655);
  assert (select estado from envios where id = v_env) = 'guia_lista', 'la guía no dejó el envío listo para empacar';
  perform pg_temp.como_postgres();
  assert exists (select 1 from avisos where usuario_id = v_alm and tipo = 'envio_guia_lista' and registro_id = v_env::text),
    'almacén no supo que la guía está lista';
  -- Juan no puede subir archivos a un envío que no ve.
  perform pg_temp.como(v_vend2);
  begin
    insert into storage.objects (bucket_id, name) values ('envios', 'envios/' || v_env || '/intruso.jpg');
    assert false, 'Juan subió un archivo al envío de Susana';
  exception when insufficient_privilege then null;
  end;
  assert not exists (select 1 from storage.objects where bucket_id = 'envios' and name like 'envios/' || v_env || '/%'),
    'Juan ve el PDF de la guía de Susana';

  -- ===========================================================================
  -- Empacar: foto, check list completo y la serie de la orden de producción.
  -- ===========================================================================
  perform pg_temp.como(v_vend);
  begin
    perform marcar_empacado(v_env, v_check, jsonb_build_object((select id from envio_lineas where envio_id = v_env and articulo_id = v_banda)::text, '["T83-S133"]'::jsonb));
    assert false, 'ventas marcó empacado';
  exception when insufficient_privilege then null;
  end;
  perform pg_temp.como(v_alm);
  begin
    perform marcar_empacado(v_env, v_check, '{}');
    assert false, 'se empacó sin foto';
  exception when others then
    if sqlerrm not like '%foto%' then raise; end if;
  end;
  insert into storage.objects (bucket_id, name) values ('envios', 'envios/' || v_env || '/abierto.jpg'), ('envios', 'envios/' || v_env || '/cerrado.jpg');
  begin
    perform agregar_archivo_envio('envios/' || v_env || '/no-se-subio.jpg', 'empaque', v_env);
    assert false, 'se registró una foto que no está en el bucket';
  exception when others then
    if sqlerrm not like '%no se subió%' then raise; end if;
  end;
  perform agregar_archivo_envio('envios/' || v_env || '/abierto.jpg', 'empaque', v_env, null, 'Abierto: 2 cosedoras');
  perform agregar_archivo_envio('envios/' || v_env || '/cerrado.jpg', 'empaque', v_env);
  begin
    perform marcar_empacado(v_env, v_check[1:2], '{}');
    assert false, 'se empacó con el check list a medias';
  exception when others then
    if sqlerrm not like 'Falta palomear%' then raise; end if;
  end;
  begin
    perform marcar_empacado(v_env, v_check, '{}');
    assert false, 'se empacó un equipo sin número de serie';
  exception when others then
    if sqlerrm not like '%número de serie%' then raise; end if;
  end;
  -- La orden todavía no se termina: el equipo no se empaca.
  begin
    perform marcar_empacado(v_env, v_check, jsonb_build_object((select id from envio_lineas where envio_id = v_env and articulo_id = v_banda)::text, '["T83-S133"]'::jsonb));
    assert false, 'se empacó un equipo cuya orden no está terminada';
  exception when others then
    if sqlerrm not like '%todavía no se termina%' then raise; end if;
  end;
  perform pg_temp.como_postgres();
  update ordenes_produccion set estado = 'terminada', terminada_en = now() where id = v_op;
  perform pg_temp.como(v_alm);
  begin
    perform marcar_empacado(v_env, v_check, jsonb_build_object((select id from envio_lineas where envio_id = v_env and articulo_id = v_banda)::text, '["T83-S134"]'::jsonb));
    assert false, 'se empacó con una serie que no es la de la orden';
  exception when others then
    if sqlerrm not like '%no es la de la orden%' then raise; end if;
  end;
  -- Bultos medidos: la banda sin medidas no deja empacar una paquetería.
  begin
    perform marcar_empacado(v_env, v_check, jsonb_build_object((select id from envio_lineas where envio_id = v_env and articulo_id = v_banda)::text, '["t83-s133 "]'::jsonb));
    assert false, 'se empacó con un bulto sin peso ni medidas';
  exception when others then
    if sqlerrm not like '%Pesa y mide%' then raise; end if;
  end;
  perform marcar_empacado(v_env, v_check,
    jsonb_build_object((select id from envio_lineas where envio_id = v_env and articulo_id = v_banda)::text, '["t83-s133 "]'::jsonb),
    jsonb_build_array(
      jsonb_build_object('articulo_id', v_cos, 'contenido', 'Cosedora', 'piezas', 1, 'peso_kg', 13, 'largo_cm', 38, 'ancho_cm', 62, 'alto_cm', 29),
      jsonb_build_object('articulo_id', v_cos, 'contenido', 'Cosedora', 'piezas', 1, 'peso_kg', 13, 'largo_cm', 38, 'ancho_cm', 62, 'alto_cm', 29),
      jsonb_build_object('articulo_id', v_banda, 'contenido', 'Banda en tarima', 'piezas', 1, 'peso_kg', 410, 'largo_cm', 240, 'ancho_cm', 120, 'alto_cm', 110)));
  select * into r from v_envios where id = v_env;
  assert r.estado = 'empacado' and r.empacado_por = v_alm and r.fotos = 2 and jsonb_array_length(r.checklist) = cardinality(v_check),
    format('empacado: %s', row_to_json(r));
  assert (select series from envio_lineas where envio_id = v_env and articulo_id = v_banda) = '{T83-S133}', 'la serie se guarda como la de la placa';

  -- La evidencia no se edita ni se borra (ni con la API ni a mano).
  begin
    delete from evidencias_envio where envio_id = v_env;
    assert false, 'almacén borró una foto de evidencia';
  exception when insufficient_privilege then null;
  end;
  begin
    perform agregar_archivo_envio('envios/' || v_env || '/otra.jpg', 'empaque', v_env);
    assert false, 'se agregó una foto de empaque después de empacar';
  exception when others then
    if sqlerrm not like '%evidencia quedó cerrada%' then raise; end if;
  end;
  perform pg_temp.como_postgres();
  begin
    update evidencias_envio set ruta = ruta || '.x' where envio_id = v_env;
    assert false, 'se cambió una foto de evidencia';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from evidencias_envio where envio_id = v_env;
    assert false, 'se borró una foto de evidencia';
  exception when insufficient_privilege then null;
  end;
  begin
    update envios set checklist = '[]' where id = v_env;
    assert false, 'se reescribió el check list después de empacar';
  exception when insufficient_privilege then null;
  end;
  begin
    update envio_lineas set series = '{OTRA}' where envio_id = v_env and articulo_id = v_banda;
    assert false, 'se cambió el número de serie después de empacar';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from envio_bultos where envio_id = v_env;
    assert false, 'se borraron los bultos después de empacar';
  exception when insufficient_privilege then null;
  end;
  assert exists (select 1 from avisos where usuario_id = v_vend and tipo = 'envio_empacado' and registro_id = v_env::text),
    'la vendedora no supo que se empacó';

  -- ===========================================================================
  -- Salida: el inventario se descuenta una vez; el equipo fabricado no.
  -- ===========================================================================
  select coalesce(sum(cantidad), 0) into v_antes from existencias where articulo_id = v_cos;
  perform pg_temp.como(v_vend);
  begin
    perform marcar_enviado(v_env);
    assert false, 'ventas marcó la salida de un paquete de planta';
  exception when insufficient_privilege then null;
  end;
  perform pg_temp.como(v_alm);
  select count(*) into v_n from plan_salida_envio(v_env) where accion = 'salida' and descontar = 2 and problema is null;
  assert v_n = 1, 'el plan no dice que salen 2 cosedoras';
  select nota into v_txt from plan_salida_envio(v_env) where articulo_id = v_banda;
  assert v_txt like 'Equipo fabricado%', format('la banda fabricada no debe descontarse: %s', v_txt);
  perform marcar_enviado(v_env);
  v_n := salida_inventario_envio(v_env);   -- alguien le vuelve a dar (o se reintenta)
  assert v_n = 0, 'la segunda llamada volvió a descontar';
  begin
    perform marcar_enviado(v_env);
    assert false, 'se marcó la salida dos veces';
  exception when others then
    if sqlerrm not like '%ya salió%' then raise; end if;
  end;
  perform pg_temp.como_postgres();
  assert (select count(*) from movimientos_inventario where pedido_id = v_pa and articulo_id = v_cos and tipo = 'salida_venta') = 1,
    'la salida no quedó en un solo movimiento';
  assert (select sum(cantidad) from existencias where articulo_id = v_cos) = v_antes - 2, 'no se descontaron exactamente 2 cosedoras';
  assert not exists (select 1 from movimientos_inventario where pedido_id = v_pa and articulo_id = v_banda), 'se descontó la banda fabricada';
  assert (select estado from ordenes_produccion where id = v_op) = 'entregada', 'la orden de la banda no quedó entregada';
  assert exists (select 1 from avisos where usuario_id = v_vend and tipo = 'envio_enviado' and registro_id = v_env::text), 'la vendedora no supo que salió';
  begin
    insert into envio_lineas (envio_id, descripcion, cantidad) values (v_env, 'algo más', 1);
    assert false, 'se agregó una partida a un envío que ya salió';
  exception when insufficient_privilege then null;
  end;
  perform pg_temp.como(v_vend);
  perform marcar_entregado(v_env, 'Recepción de la granja');
  assert (select estado from pedidos where id = v_pa) = 'entregado', 'el pedido no quedó entregado con su envío';
  assert (select cantidad_entregada from pedido_lineas where id = v_l_cos) = 2, 'la partida no quedó entregada';

  -- ===========================================================================
  -- Lo que ya salió a mano con el pedido no se descuenta otra vez (recoge el cliente).
  -- ===========================================================================
  perform pg_temp.como(v_alm);
  perform registrar_salida(v_pol, v_pb, 1, 'salida_venta', 'Venta de mostrador', v_pb_ped);
  perform pg_temp.como(v_vend2);
  v_env2 := pedir_envio(v_pb_ped, 'recoge', p_fecha_recoleccion => hoy_planta());
  assert (select destino from envios where id = v_env2) is null, 'recoge el cliente no lleva domicilio';
  perform pg_temp.como_postgres();
  assert exists (select 1 from avisos where usuario_id = v_alm and tipo = 'envio_hoy' and registro_id = v_env2::text),
    'almacén no supo que hoy vienen por él';
  insert into storage.objects (bucket_id, name) values ('envios', 'envios/' || v_env2 || '/polea.jpg');
  perform pg_temp.como(v_alm);
  perform agregar_archivo_envio('envios/' || v_env2 || '/polea.jpg', 'empaque', v_env2);
  perform marcar_empacado(v_env2, v_check);
  begin
    perform marcar_entregado(v_env2, null);
    assert false, 'se entregó en planta sin decir quién se lo llevó';
  exception when others then
    if sqlerrm not like '%quién se lo llevó%' then raise; end if;
  end;
  perform marcar_entregado(v_env2, 'Chofer del cliente');
  perform pg_temp.como_postgres();
  assert (select count(*) from movimientos_inventario where pedido_id = v_pb_ped and articulo_id = v_pol) = 1,
    'se descontó dos veces la polea que ya había salido a mano';
  assert (select nota_inventario from envio_lineas where envio_id = v_env2) like 'Ya se le había dado salida%', 'no dice por qué no se descontó';

  -- ===========================================================================
  -- Respeta lo apartado: no se toma lo reservado para otra orden.
  -- ===========================================================================
  insert into pedidos (cliente_id, vendedor_id) values (v_cli, v_vend) returning id into v_pc;
  insert into pedido_lineas (pedido_id, orden, articulo_id, titulo, cantidad, precio_unitario) values
    (v_pc, 1, v_cat, 'T83 Catarina 80-14', 2, 300) returning id into v_l_cat;
  perform pg_temp.como(v_vend);
  v_env3 := pedir_envio(v_pc, 'recoge');
  perform pg_temp.como_postgres();
  insert into storage.objects (bucket_id, name) values ('envios', 'envios/' || v_env3 || '/catarinas.jpg');
  perform pg_temp.como(v_alm);
  perform agregar_archivo_envio('envios/' || v_env3 || '/catarinas.jpg', 'empaque', v_env3);
  begin
    perform marcar_empacado(v_env3, v_check);
    assert false, 'se empacó tomando lo apartado para otra orden';
  exception when others then
    if sqlerrm not like '%apartado para%' then raise; end if;
  end;
  perform cancelar_envio(v_env3, 'La catarina está apartada para producción');
  assert (select estado from envios where id = v_env3) = 'cancelado', 'no se canceló';

  -- ===========================================================================
  -- Envío a Full (traspaso a Almacén ML) y venta que surte Full (sale de Almacén ML).
  -- ===========================================================================
  select coalesce(max(cantidad), 0) into v_antes from existencias where articulo_id = v_cos and almacen_id = v_ml;
  perform pg_temp.como(v_vend);
  begin
    perform envio_a_full(jsonb_build_array(jsonb_build_object('articulo_id', v_cos, 'cantidad', 1)));
    assert false, 'ventas armó un envío a Full';
  exception when insufficient_privilege then null;
  end;
  perform pg_temp.como(v_alm);
  v_full := envio_a_full(jsonb_build_array(jsonb_build_object('articulo_id', v_cos, 'cantidad', 1)), v_estafeta, 'Reabasto semanal');
  perform pg_temp.como_postgres();
  insert into storage.objects (bucket_id, name) values ('envios', 'envios/' || v_full || '/caja.jpg');
  perform pg_temp.como(v_alm);
  perform agregar_archivo_envio('envios/' || v_full || '/caja.jpg', 'empaque', v_full);
  perform marcar_empacado(v_full, v_check);
  perform marcar_enviado(v_full);
  perform pg_temp.como_postgres();
  assert (select cantidad from existencias where articulo_id = v_cos and almacen_id = v_ml) = v_antes + 1, 'el envío a Full no traspasó a Almacén ML';
  assert (select count(*) from movimientos_inventario m join envio_lineas el on el.traspaso_id = m.traspaso_id where el.envio_id = v_full) = 2,
    'el traspaso a Full no son dos movimientos ligados';

  insert into pedidos (cliente_id, vendedor_id, canal, id_externo) values (v_cli, v_vend, 'mercadolibre', 'T83-2000002') returning id into v_pd;
  insert into pedido_lineas (pedido_id, orden, articulo_id, titulo, cantidad, precio_unitario) values
    (v_pd, 1, v_cos, 'T83 Cosedora manual', 1, 3500) returning id into v_l_ml;
  perform pg_temp.como(v_vend);
  v_envml := pedir_envio(v_pd, 'full');
  assert (select almacen_id from envio_lineas where envio_id = v_envml) = v_ml, 'lo que surte Full no sale de Almacén ML';
  perform marcar_enviado(v_envml);
  perform pg_temp.como_postgres();
  assert (select cantidad from existencias where articulo_id = v_cos and almacen_id = v_ml) = v_antes, 'la venta de Full no salió de Almacén ML';

  -- ===========================================================================
  -- Saldo de paquetería: recargas − guías, con aviso de saldo bajo.
  -- ===========================================================================
  perform pg_temp.como(v_vend);
  begin
    perform registrar_recarga(v_estafeta, 3000);
    assert false, 'ventas registró una recarga';
  exception when insufficient_privilege then null;
  end;
  assert not exists (select 1 from recargas_paqueteria), 'ventas ve la lista de recargas';
  select saldo into v_antes from saldos_paqueteria() where paqueteria_id = v_estafeta;
  assert v_antes is not null, 'quien genera guías no ve el saldo';
  perform pg_temp.como(v_fin);
  perform registrar_recarga(v_estafeta, 1000, 'SPEI T83');
  select saldo, bajo into r from saldos_paqueteria() where paqueteria_id = v_estafeta;
  assert r.saldo = v_antes + 1000, format('la recarga no subió el saldo: %s → %s', v_antes, r.saldo);
  perform pg_temp.como(v_taller);
  assert not exists (select 1 from saldos_paqueteria()), 'el taller ve el saldo de paquetería';

  -- ===========================================================================
  -- Devoluciones: la ve quien ve el pedido; al recibir, fotos; reingresa una vez.
  -- ===========================================================================
  perform pg_temp.como(v_vend2);
  begin
    perform abrir_devolucion(v_pa, 'devolucion', 'No le sirvió');
    assert false, 'Juan registró una devolución de una venta de Susana';
  exception when insufficient_privilege then null;
  end;
  assert not exists (select 1 from buscar_venta('T83-2000001')), 'Juan encontró la venta de Susana';
  perform pg_temp.como(v_vend);
  assert (select id from buscar_venta('T83-2000001') limit 1) = v_pa, 'Susana no encuentra su venta por el número de ML';
  v_dev := abrir_devolucion(v_pa, 'devolucion', 'Llegó una cosedora que no cose', 'T83-AUT-77',
                            p_lineas => jsonb_build_array(jsonb_build_object('pedido_linea_id', v_l_cos, 'cantidad', 1)));
  select * into r from v_devoluciones where id = v_dev;
  assert r.folio like 'DEV-%' and r.codigo_autorizacion = 'T83-AUT-77' and r.fecha_esperada is not null and r.envio_id = v_env,
    format('alta de devolución: %s', row_to_json(r));
  begin
    perform abrir_devolucion(v_pa, 'devolucion', 'Otra vez');
    assert false, 'se abrió una segunda devolución de la misma venta';
  exception when others then
    if sqlerrm not like '%ya tiene una devolución abierta%' then raise; end if;
  end;
  perform pg_temp.como(v_vend2);
  assert not exists (select 1 from v_devoluciones where id = v_dev), 'Juan vio la devolución de Susana';
  assert not exists (select 1 from devolucion_lineas where devolucion_id = v_dev), 'Juan vio las partidas de la devolución de Susana';
  -- Junto al reclamo se ve la evidencia de salida: Susana sí, Juan no.
  assert not exists (select 1 from v_evidencias_envio where envio_id = v_env), 'Juan vio las fotos de salida de Susana';
  perform pg_temp.como(v_vend);
  assert (select count(*) from v_evidencias_envio where envio_id = (select envio_id from v_devoluciones where id = v_dev) and tipo = 'empaque') = 2,
    'la vendedora no ve la evidencia de salida junto a su devolución';
  perform pg_temp.como_postgres();
  assert exists (select 1 from avisos where usuario_id = v_alm and tipo = 'devolucion_por_llegar' and registro_id = v_dev::text),
    'almacén no supo que viene una devolución';

  perform pg_temp.como(v_vend);
  begin
    perform recibir_devolucion(v_dev);
    assert false, 'ventas recibió una devolución en almacén';
  exception when insufficient_privilege then null;
  end;
  perform pg_temp.como(v_alm);
  begin
    perform recibir_devolucion(v_dev);
    assert false, 'se recibió una devolución sin fotos';
  exception when others then
    if sqlerrm not like '%foto%' then raise; end if;
  end;
  perform pg_temp.como_postgres();
  insert into storage.objects (bucket_id, name) values ('envios', 'devoluciones/' || v_dev || '/llego.jpg');
  perform pg_temp.como(v_alm);
  perform agregar_archivo_envio('devoluciones/' || v_dev || '/llego.jpg', 'recepcion', null, v_dev, 'Caja golpeada');
  perform recibir_devolucion(v_dev, null, 'Llegó en su caja, sin la manivela');
  select coalesce(sum(cantidad), 0) into v_antes from existencias where articulo_id = v_cos;
  perform resolver_devolucion(v_dev, 'reingreso', v_pb, 'Se probó y cose bien');
  begin
    perform resolver_devolucion(v_dev, 'reingreso', v_pb);
    assert false, 'se reingresó dos veces la misma devolución';
  exception when others then
    if sqlerrm not like '%ya está resuelta%' then raise; end if;
  end;
  perform pg_temp.como_postgres();
  assert (select count(*) from movimientos_inventario where pedido_id = v_pa and articulo_id = v_cos and tipo = 'devolucion') = 1,
    'la devolución no creó exactamente una entrada';
  assert (select sum(cantidad) from existencias where articulo_id = v_cos) = v_antes + 1, 'la devolución no regresó la pieza al inventario';
  assert exists (select 1 from avisos where usuario_id = v_vend and tipo = 'devolucion_resuelta' and registro_id = v_dev::text),
    'la vendedora no supo cómo se resolvió';

  -- Merma: entra lo que llegó y se pide el ajuste de salida (lo autoriza otra persona).
  perform pg_temp.como(v_vend);
  v_dev2 := abrir_devolucion(v_pa, 'devolucion', 'Llegó rota en la paquetería',
                             p_lineas => jsonb_build_array(jsonb_build_object('pedido_linea_id', v_l_cos, 'cantidad', 1)));
  perform pg_temp.como_postgres();
  insert into storage.objects (bucket_id, name) values ('envios', 'devoluciones/' || v_dev2 || '/rota.jpg');
  perform pg_temp.como(v_alm);
  perform agregar_archivo_envio('devoluciones/' || v_dev2 || '/rota.jpg', 'recepcion', null, v_dev2);
  perform recibir_devolucion(v_dev2);
  begin
    perform resolver_devolucion(v_dev2, 'merma', v_pb, null);
    assert false, 'se registró una merma sin decir qué tiene';
  exception when others then
    if sqlerrm not like '%por qué es merma%' then raise; end if;
  end;
  perform resolver_devolucion(v_dev2, 'merma', v_pb, 'Carcasa partida, no tiene arreglo');
  perform pg_temp.como_postgres();
  select a.* into r from devolucion_lineas dl join ajustes_inventario a on a.id = dl.ajuste_id where dl.devolucion_id = v_dev2;
  assert r.estado = 'pendiente' and r.diferencia = -1 and r.solicitado_por = v_alm, format('la merma no pidió su ajuste: %s', row_to_json(r));

  -- Reclamo: fecha límite por omisión, respuesta y cierre.
  perform pg_temp.como(v_vend);
  v_rec := abrir_devolucion(v_pa, 'reclamo', 'Dice que le llegó incompleta su compra');
  select * into r from v_devoluciones where id = v_rec;
  assert r.folio like 'REC-%' and r.fecha_limite > now() and r.responsable_id = v_vend and not r.vencida, format('reclamo: %s', row_to_json(r));
  perform responder_reclamo(v_rec, 'Se le mandaron las fotos del empaque con las 2 cosedoras y la guía');
  perform resolver_devolucion(v_rec, 'a_favor', null, 'ML lo cerró a nuestro favor con la evidencia de salida');
  assert (select estado from devoluciones where id = v_rec) = 'resuelta', 'el reclamo no se cerró';

  -- ===========================================================================
  -- Ventas no ve un costo de artículo por ninguna vista nueva.
  -- ===========================================================================
  assert not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name in ('v_envios', 'v_envio_lineas', 'v_evidencias_envio', 'v_eventos_envio', 'v_devoluciones')
      and (column_name like '%costo%' or column_name like '%margen%' or column_name like '%utilidad%')
      and column_name not in ('costo_cotizado', 'costo_real')),
    'una vista de envíos trae un costo de artículo';
  assert not exists (
    select 1 from information_schema.routines rt join information_schema.parameters pa on pa.specific_name = rt.specific_name
    where rt.routine_schema = 'public' and rt.routine_name in ('plan_salida_envio', 'saldos_paqueteria', 'buscar_venta')
      and pa.parameter_mode = 'OUT' and (pa.parameter_name like '%costo%' or pa.parameter_name like '%margen%')),
    'una función de envíos regresa un costo de artículo';
  perform pg_temp.como(v_vend);
  assert not exists (select 1 from movimientos_inventario where pedido_id = v_pa), 'ventas lee los movimientos (traen costo unitario)';
  begin
    perform * from _plan_salida_envio(v_env);
    assert false, 'ventas llamó la función interna de la salida';
  exception when insufficient_privilege then null;
  end;
  select * into r from v_envios where id = v_env;
  assert r.costo_real = 655, 'ventas no ve lo que costó su guía (eso sí es suyo)';

  -- Los hallazgos corren para cada área sin tronar.
  perform pg_temp.como(v_alm);
  perform * from hallazgos('almacen');
  perform pg_temp.como(v_vend);
  perform * from hallazgos('ventas');
  perform pg_temp.como(v_gv);
  perform * from hallazgos('ventas');
end $$;

-- Avisos y pendientes: la información llega sola a quien le importa, y a nadie más.
do $$
declare v_vend uuid; v_otro uuid; v_ing uuid; v_alm uuid; v_ger uuid; v_comp uuid;
        v_cli uuid; v_ped uuid; v_eq uuid; v_op uuid; v_art uuid; v_aj uuid; v_pend uuid; v_n int;
begin
  v_vend := pg_temp.usuario('isaac@hegamex.com', '{ventas}');
  v_otro := pg_temp.usuario('juan@hegamex.com', '{ventas}');
  v_ing := pg_temp.usuario('ingenieria@hegamex.com', '{ingenieria}');
  v_alm := pg_temp.usuario('almacen@hegamex.com', '{almacen}');
  v_ger := pg_temp.usuario('gerente.produccion@hegamex.com', '{gerente_produccion}');
  v_comp := pg_temp.usuario('compras@hegamex.com', '{compras}');

  insert into articulos (clave, tipo, nombre) values ('T-AV-EQ', 'equipo', 'T Banda de prueba 10 m') returning id into v_eq;
  insert into clientes (nombre, vendedor_id, legacy_ref) values ('T Cliente de avisos', v_vend, 'T:AV1') returning id into v_cli;

  -- Pedido nuevo → gerencia de producción y almacén (no el vendedor que lo capturó).
  perform pg_temp.como(v_vend);
  insert into pedidos (cliente_id, vendedor_id, fecha_compromiso) values (v_cli, v_vend, current_date + 20) returning id into v_ped;
  perform pg_temp.como_postgres();
  assert exists (select 1 from avisos where usuario_id = v_ger and tipo = 'pedido_nuevo' and registro_id = v_ped::text), 'gerencia no supo del pedido';
  assert exists (select 1 from avisos where usuario_id = v_alm and tipo = 'pedido_nuevo' and registro_id = v_ped::text), 'almacén no supo del pedido';
  assert not exists (select 1 from avisos where usuario_id = v_vend and tipo = 'pedido_nuevo'), 'al vendedor se le avisó de lo que él hizo';
  assert not exists (select 1 from avisos where tipo = 'pedido_nuevo' and registro_id = v_ped::text and cuerpo like '%$%'),
    'el aviso a almacén no lleva montos';

  -- Orden nueva → ingeniería y almacén la validan.
  insert into ordenes_produccion (pedido_id, articulo_id, cantidad, fecha_compromiso) values (v_ped, v_eq, 1, current_date + 20) returning id into v_op;
  assert exists (select 1 from avisos where usuario_id = v_ing and tipo = 'op_por_validar' and registro_id = v_op::text), 'ingeniería no supo de la orden';

  -- Terminada → al vendedor del pedido, no a otro vendedor.
  update ordenes_produccion set estado = 'terminada', terminada_en = now() where id = v_op;
  assert exists (select 1 from avisos where usuario_id = v_vend and tipo = 'op_terminada' and registro_id = v_op::text), 'el vendedor no supo que su equipo está terminado';
  assert not exists (select 1 from avisos where usuario_id = v_otro and registro_id = v_op::text), 'a otro vendedor le llegó el aviso';

  -- Cada quien ve solo sus avisos y solo puede marcarlos leídos.
  perform pg_temp.como(v_otro);
  assert not exists (select 1 from avisos where usuario_id = v_vend), 'un vendedor leyó los avisos de otro';
  perform pg_temp.como(v_vend);
  assert (select count(*) from avisos where leido_en is null) >= 1, 'el vendedor ve sus avisos';
  begin
    update avisos set titulo = 'cambiado' where usuario_id = v_vend;
    assert false, 'se pudo cambiar el texto de un aviso';
  exception when insufficient_privilege then null;
  end;
  v_n := marcar_avisos_leidos();
  assert v_n >= 1 and not exists (select 1 from avisos where leido_en is null), 'marcar todo como leído';

  -- Ajuste de inventario: lo pide almacén → le llega a quien autoriza, no a quien lo pidió.
  perform pg_temp.como_postgres();
  insert into articulos (clave, tipo, nombre, unidad) values ('T-AV-POL', 'componente', 'T Polea de avisos', 'pieza') returning id into v_art;
  perform pg_temp.como(v_alm);
  v_aj := solicitar_ajuste(v_art, (select id from almacenes where nombre = 'Planta Baja'), 3, 'Conteo de prueba');
  perform pg_temp.como_postgres();
  assert exists (select 1 from avisos where usuario_id = v_ger and tipo = 'ajuste_por_autorizar' and registro_id = v_aj::text), 'gerencia no supo del ajuste';
  assert not exists (select 1 from avisos where usuario_id = v_alm and tipo = 'ajuste_por_autorizar' and registro_id = v_aj::text), 'a quien pidió el ajuste se le avisó de su propio ajuste';
  perform pg_temp.como(v_ger);
  perform resolver_ajuste(v_aj, true, 'Visto en el piso');
  perform pg_temp.como_postgres();
  assert exists (select 1 from avisos where usuario_id = v_alm and tipo = 'ajuste_aprobado' and registro_id = v_aj::text), 'almacén no supo que se aprobó';

  -- Pendientes: el vendedor le pide algo a compras.
  perform pg_temp.como(v_vend);
  insert into pendientes (titulo, responsable_id, vence, tabla, registro_id, ruta)
  values ('Precio de motorreductor 5 HP para la cotización', v_comp, current_date - 1, 'pedidos', v_ped::text, '/ventas/pedidos/' || v_ped)
  returning id into v_pend;
  perform pg_temp.como_postgres();
  assert exists (select 1 from avisos where usuario_id = v_comp and tipo = 'pendiente_nuevo' and registro_id = v_pend::text), 'compras no supo del pendiente';

  perform pg_temp.como(v_otro);
  assert not exists (select 1 from pendientes where id = v_pend), 'un tercero vio un pendiente ajeno';

  perform pg_temp.como(v_comp);
  begin
    update pendientes set titulo = 'Otra cosa' where id = v_pend;
    assert false, 'el responsable cambió lo que le pidieron';
  exception when insufficient_privilege then null;
  end;
  begin
    update pendientes set estado = 'cancelado' where id = v_pend;
    assert false, 'el responsable canceló el pendiente en lugar de hacerlo';
  exception when insufficient_privilege then null;
  end;

  -- Vencido: el recordatorio periódico avisa una sola vez al día.
  perform pg_temp.como_postgres();
  perform avisos_periodicos();
  perform avisos_periodicos();
  assert (select count(*) from avisos where usuario_id = v_comp and tipo = 'pendiente_vencido' and registro_id = v_pend::text) = 1,
    'el recordatorio de vencido se repitió';

  perform pg_temp.como(v_comp);
  update pendientes set estado = 'hecho', nota_cierre = '$12,400 con Bonfiglioli, 3 semanas' where id = v_pend;
  perform pg_temp.como_postgres();
  assert (select cerrado_por from pendientes where id = v_pend) = v_comp, 'quién lo cerró';
  assert exists (select 1 from avisos where usuario_id = v_vend and tipo = 'pendiente_hecho' and registro_id = v_pend::text), 'el vendedor no supo que ya está';
  perform pg_temp.como(v_vend);
  begin
    update pendientes set estado = 'abierto' where id = v_pend;
    assert false, 'se reabrió un pendiente cerrado';
  exception when insufficient_privilege then null;
  end;

  -- Validación atorada: más de 4 horas sin revisión → ingeniería, una vez.
  perform pg_temp.como_postgres();
  update ordenes_produccion set estado = 'planeada', creado_en = now() - interval '5 hours',
    revisado_ingenieria_en = null, revisado_almacen_en = null where id = v_op;
  perform avisos_periodicos();
  perform avisos_periodicos();
  assert (select count(*) from avisos where usuario_id = v_ing and tipo = 'op_validacion_atorada' and registro_id = v_op::text) = 1,
    'el recordatorio de validación se repitió o no llegó';

  -- Sin Cliq configurado no pasa nada (ni error).
  perform publicar_en_canal('almacen', 'prueba');

  -- Nadie crea avisos a mano.
  perform pg_temp.como(v_vend);
  begin
    perform avisar(array[v_otro], 'falso', 'Aviso falso', null, '/', null, null);
    assert false, 'un usuario pudo crear avisos a otros';
  exception when insufficient_privilege then null;
  end;
  perform pg_temp.como_postgres();
end $$;

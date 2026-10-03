-- Servicio postventa y mantenimiento: lo que la base hace cumplir, con un usuario
-- de cada rol. La base es compartida (puede haber datos de demostración): las
-- cifras de carga se comparan contra lo que ya había.
do $$
declare
  v_gp uuid; v_taller uuid; v_alm uuid; v_vend uuid; v_vend2 uuid; v_dir uuid;
  v_e1 uuid; v_e2 uuid; v_e3 uuid; v_pail int; v_torno int; v_pb int; v_cap numeric;
  v_cli uuid; v_cli2 uuid; v_ped uuid; v_eq uuid; v_op uuid; v_op2 uuid; v_op3 uuid;
  v_s1 uuid; v_s2 uuid; v_s3 uuid; v_s4 uuid; v_s5 uuid; v_rep uuid; v_req uuid; v_lunes date; v_ini timestamptz; v_fin timestamptz;
  v_carga_antes jsonb; v_base record; v_n int; v_num numeric; v_txt text; r record;
  v_maq uuid; v_comp uuid; v_mont uuid; v_pinza uuid; v_plan uuid; v_plan2 uuid; v_mto uuid; v_prev uuid;
  v_ref uuid; v_linea uuid; v_mov bigint; v_res uuid;
begin
  v_gp := pg_temp.usuario('gerprod@hegamex.com', '{gerente_produccion}');
  v_taller := pg_temp.usuario('taller@hegamex.com', '{produccion}');
  v_alm := pg_temp.usuario('almacen@hegamex.com', '{almacen}');
  v_vend := pg_temp.usuario('isaac@hegamex.com', '{ventas}');
  v_vend2 := pg_temp.usuario('juan@hegamex.com', '{ventas}');
  v_dir := pg_temp.usuario('direccion@hegamex.com', '{direccion}');
  select id, capacidad_horas_semana into v_pail, v_cap from etapas where nombre = 'Pailería';
  select id into v_torno from etapas where nombre = 'Torno';
  select id into v_pb from almacenes where nombre = 'Planta Baja';
  v_lunes := date_trunc('week', hoy_planta())::date + 7;   -- la semana que entra

  insert into empleados (numero, nombre, puesto, etapa_id, fecha_ingreso) values
    ('T82-1', 'Soldador Uno T82', 'Soldador', v_pail, '2020-01-01') returning id into v_e1;
  insert into empleados (numero, nombre, puesto, etapa_id, fecha_ingreso) values
    ('T82-2', 'Soldador Dos T82', 'Soldador', v_pail, '2021-01-01') returning id into v_e2;
  insert into empleados (numero, nombre, puesto, etapa_id, fecha_ingreso) values
    ('T82-3', 'Tornero Tres T82', 'Tornero', v_torno, '2022-01-01') returning id into v_e3;

  -- Un cliente de Isaac con una dosificadora entregada hace 3 meses, y uno de Juan.
  insert into clientes (nombre, vendedor_id) values ('T82 Agro de Isaac', v_vend) returning id into v_cli;
  insert into clientes (nombre, vendedor_id) values ('T82 Minera de Juan', v_vend2) returning id into v_cli2;
  insert into articulos (clave, tipo, nombre) values ('T82-DOS', 'equipo', 'Dosificadora T82') returning id into v_eq;
  insert into pedidos (cliente_id, vendedor_id) values (v_cli, v_vend) returning id into v_ped;
  insert into ordenes_produccion (articulo_id, pedido_id, numero_serie, estado, terminada_en, entregada_en)
  values (v_eq, v_ped, 'T82-SERIE-1', 'entregada', now() - interval '100 days', now() - interval '90 days') returning id into v_op;

  -- ===========================================================================
  -- Ventas pide un servicio para su cliente; una garantía va ligada al equipo.
  -- ===========================================================================
  perform pg_temp.como(v_vend);
  begin
    perform solicitar_servicio('garantia', v_cli, 'La bomba de la dosificadora no arranca');
    assert false, 'se pidió una garantía sin decir qué equipo';
  exception when others then
    if sqlerrm not like '%garantía va ligada al pedido y al equipo%' then raise; end if;
  end;
  v_s1 := solicitar_servicio('garantia', v_cli, 'La bomba de la dosificadora no arranca', p_orden_produccion => v_op);
  select * into r from v_servicios where id = v_s1;
  assert r.pedido_id = v_ped and r.numero_serie = 'T82-SERIE-1' and r.equipo = 'Dosificadora T82',
    format('la garantía toma pedido, serie y equipo de la orden: %s', row_to_json(r));
  assert r.en_garantia and r.garantia_vence = (now() - interval '90 days')::date + interval '12 months', format('vigencia: %s', r.garantia_vence);
  assert r.estado = 'solicitada' and r.folio like 'SRV-%', 'folio y estado inicial';
  -- No para el cliente de otro vendedor.
  begin
    perform solicitar_servicio('servicio_campo', v_cli2, 'Engrapar la banda otra vez');
    assert false, 'ventas pidió servicio para el cliente de otro vendedor';
  exception when insufficient_privilege then null;
  end;
  -- Ventas no programa, no cierra y no cambia el estado a mano.
  begin
    perform programar_servicio(v_s1, now(), now() + interval '2 hours', array[v_e1]);
    assert false, 'ventas programó un servicio';
  exception when insufficient_privilege then null;
  end;
  begin
    update servicios set estado = 'cerrada' where id = v_s1;
    assert false, 'ventas cerró un servicio escribiendo el estado';
  exception when insufficient_privilege then null;
  end;
  -- Pero sí corrige la descripción mientras nadie lo ha programado.
  update servicios set descripcion = 'La bomba de la dosificadora no arranca; ya revisaron el fusible' where id = v_s1;
  assert (select descripcion from servicios where id = v_s1) like '%fusible', 'el vendedor no pudo corregir su solicitud';
  -- Juan no ve el servicio del cliente de Isaac.
  perform pg_temp.como(v_vend2);
  assert not exists (select 1 from v_servicios where id = v_s1), 'Juan vio el servicio de un cliente de Isaac';
  -- La gerencia no puede ligar el equipo de un cliente a otro cliente.
  perform pg_temp.como(v_gp);
  begin
    perform solicitar_servicio('garantia', v_cli2, 'Garantía cruzada', p_orden_produccion => v_op);
    assert false, 'se ligó el equipo de un cliente a otro';
  exception when others then
    if sqlerrm not like '%otro cliente%' then raise; end if;
  end;
  perform pg_temp.como_postgres();
  assert exists (select 1 from avisos where usuario_id = v_gp and tipo = 'servicio_solicitado' and registro_id = v_s1::text),
    'la gerencia de producción no recibió aviso del servicio pedido por ventas';

  -- ===========================================================================
  -- Cuadrilla: la misma persona no puede estar en dos servicios a la vez.
  -- Capacidad: sus horas se descuentan de la capacidad de su área.
  -- ===========================================================================
  perform pg_temp.como(v_gp);
  select horas_servicio, horas_produccion into v_base from carga_semanal(2) where semana = v_lunes and etapa_id = v_pail;
  assert v_base.horas_servicio is not null, 'la gerencia no ve la carga semanal';
  select jsonb_agg(to_jsonb(v) order by v.etapa_id) into v_carga_antes from v_carga_etapas v;
  v_s2 := solicitar_servicio('instalacion', v_cli, 'Instalar banda de 20 m en la planta de León', p_lugar => 'León, Gto.');
  v_ini := (v_lunes + time '08:30') at time zone 'America/Mexico_City';
  v_fin := ((v_lunes + 2) + time '17:30') at time zone 'America/Mexico_City';     -- lunes a miércoles
  perform programar_servicio(v_s2, v_ini, v_fin, array[v_e1, v_e2], v_e1);
  assert (select estado from servicios where id = v_s2) = 'programada', 'el servicio quedó programado';
  assert (select horas_por_persona from v_servicios where id = v_s2) = 27, 'tres jornadas de 9 h por persona';

  v_s3 := solicitar_servicio('puesta_en_marcha', v_cli, 'Arrancar la dosificadora nueva');
  begin
    perform programar_servicio(v_s3, v_ini + interval '1 day', v_ini + interval '1 day 4 hours', array[v_e2, v_e3]);
    assert false, 'se programó a una persona en dos servicios que se enciman';
  exception when exclusion_violation then
    if sqlerrm not like 'Soldador Dos T82 ya va en SRV-%' then raise; end if;
  end;
  -- El jueves sí cabe.
  perform programar_servicio(v_s3, v_ini + interval '3 days', v_ini + interval '3 days 4 hours', array[v_e2, v_e3]);

  -- La restricción de la tabla aguanta aunque alguien se salte la función.
  perform pg_temp.como_postgres();
  begin
    insert into servicio_cuadrilla (servicio_id, empleado_id, periodo)
    values (v_s1, v_e1, tstzrange(v_ini + interval '2 hours', v_ini + interval '5 hours'));
    assert false, 'la exclusión dejó pasar un traslape';
  exception when exclusion_violation then null;
  end;
  -- Con vacaciones aprobadas tampoco sale a servicio.
  insert into incidencias (empleado_id, tipo, inicio, fin, dias, estado) values (v_e3, 'vacaciones', v_lunes + 7, v_lunes + 8, 2, 'aprobada');
  perform pg_temp.como(v_gp);
  begin
    perform programar_servicio(v_s1, ((v_lunes + 7) + time '09:00') at time zone 'America/Mexico_City',
                               ((v_lunes + 7) + time '13:00') at time zone 'America/Mexico_City', array[v_e3]);
    assert false, 'salió a servicio alguien de vacaciones';
  exception when others then
    if sqlerrm not like '%vacaciones%' then raise; end if;
  end;

  -- Capacidad: Pailería pierde 2 personas × 27 h el lunes a miércoles y 4 h el jueves (Soldador Dos).
  select * into r from carga_semanal(2) where semana = v_lunes and etapa_id = v_pail;
  assert r.horas_servicio = v_base.horas_servicio + 58, format('horas de servicio en Pailería: %s (antes %s)', r.horas_servicio, v_base.horas_servicio);
  assert r.capacidad_disponible = v_cap - r.horas_servicio, 'capacidad disponible = capacidad − horas de cuadrilla';
  assert r.servicios @> jsonb_build_array(jsonb_build_object('folio', (select folio from servicios where id = v_s2), 'horas', 54)),
    format('el servicio aparece con sus horas en la semana: %s', r.servicios);
  assert (select horas_servicio from carga_semanal(2) where semana = v_lunes and etapa_id = v_torno) >= 4, 'el tornero también descuenta';
  -- v_carga_etapas (la usan la gerencia y la TV) no cambió: los servicios van aparte.
  assert (select jsonb_agg(to_jsonb(v) order by v.etapa_id) from v_carga_etapas v) = v_carga_antes, 'v_carga_etapas cambió';

  -- Producción: una orden liberada de 30 h de Pailería que vence el viernes que entra
  -- se reparte entre esta semana y la que entra.
  perform pg_temp.como_postgres();
  insert into ordenes_produccion (articulo_id, estado, inicio_plan, fecha_compromiso)
  values (v_eq, 'liberada', hoy_planta(), v_lunes + 4) returning id into v_op2;
  insert into op_operaciones (orden_id, etapa_id, horas_estimadas) values (v_op2, v_pail, 30);
  perform pg_temp.como(v_gp);
  select * into r from carga_semanal(2) where semana = v_lunes and etapa_id = v_pail;
  assert r.horas_produccion = v_base.horas_produccion + 15, format('producción en Pailería la semana que entra: %s (antes %s)', r.horas_produccion, v_base.horas_produccion);
  assert r.carga = r.horas_produccion + r.horas_servicio and r.saldo = v_cap - r.carga, 'carga y saldo';
  -- Un vendedor ve la misma carga (la capacidad es la de todo el taller), sin clientes.
  perform pg_temp.como(v_vend2);
  assert (select horas_servicio from carga_semanal(2) where semana = v_lunes and etapa_id = v_pail) = r.horas_servicio,
    'el vendedor ve otra carga del taller';
  perform pg_temp.como_postgres();
  assert exists (select 1 from avisos where usuario_id = v_vend and tipo = 'servicio_programado' and registro_id = v_s2::text),
    'el vendedor del cliente no recibió aviso de la programación';

  -- Cancelar suelta a la cuadrilla.
  perform pg_temp.como(v_gp);
  perform cancelar_servicio(v_s3, 'El cliente lo pospuso');
  perform programar_servicio(v_s1, v_ini + interval '3 days', v_ini + interval '3 days 4 hours', array[v_e2]);

  -- ===========================================================================
  -- Reparación en planta: se recibe con fotos; se cierra con evidencia.
  -- ===========================================================================
  perform pg_temp.como(v_vend);
  v_rep := solicitar_servicio('reparacion_planta', v_cli, 'Cosedora de costales que ya no cose', p_equipo => 'Cosedora portátil');
  perform pg_temp.como(v_gp);
  perform programar_servicio(v_rep, now(), now() + interval '6 hours', array[v_e3]);
  perform pg_temp.como(v_taller);
  begin
    perform iniciar_servicio(v_rep);
    assert false, 'se empezó a reparar un equipo que no se recibió';
  exception when others then
    if sqlerrm not like 'Primero recibe el equipo%' then raise; end if;
  end;
  begin
    perform recibir_equipo(v_rep, 'Llega sin la tapa del motor');
    assert false, 'se recibió un equipo sin fotos';
  exception when others then
    if sqlerrm not like '%foto%' then raise; end if;
  end;
  -- Las fotos ya están en el bucket (aquí se simula la subida).
  perform pg_temp.como_postgres();
  insert into storage.objects (bucket_id, name) values
    ('servicio', 'servicios/' || v_rep || '/recepcion-1.jpg'), ('servicio', 'servicios/' || v_rep || '/despues-1.jpg'),
    ('servicio', 'servicios/' || v_s2 || '/de-otro.jpg');
  perform pg_temp.como(v_taller);
  begin
    perform agregar_evidencia('servicios/' || v_s2 || '/de-otro.jpg', 'recepcion', v_rep);
    assert false, 'se registró como evidencia la foto de otro servicio';
  exception when others then
    if sqlerrm not like '%carpeta%' then raise; end if;
  end;
  begin
    perform agregar_evidencia('servicios/' || v_rep || '/no-se-subio.jpg', 'recepcion', v_rep);
    assert false, 'se registró una foto que no está en el bucket';
  exception when others then
    if sqlerrm not like '%no se subió%' then raise; end if;
  end;
  perform agregar_evidencia('servicios/' || v_rep || '/recepcion-1.jpg', 'recepcion', v_rep, null, 'Golpe en la carcasa');
  perform recibir_equipo(v_rep, 'Llega sin la tapa del motor');
  perform iniciar_servicio(v_rep);
  -- Fotos del bucket: Isaac (su cliente) y el taller las ven; Juan no.
  assert (select count(*) from storage.objects where bucket_id = 'servicio' and name like 'servicios/' || v_rep || '/%') = 2, 'el taller no ve las fotos';
  perform pg_temp.como(v_vend);
  assert (select count(*) from storage.objects where bucket_id = 'servicio' and name like 'servicios/' || v_rep || '/%') = 2, 'el vendedor no ve las fotos de su cliente';
  begin
    perform cerrar_servicio(v_rep, 'Don Pedro', 'Se cambió la aguja');
    assert false, 'ventas cerró un servicio';
  exception when insufficient_privilege then null;
  end;
  perform pg_temp.como(v_vend2);
  assert not exists (select 1 from storage.objects where bucket_id = 'servicio' and name like 'servicios/' || v_rep || '/%'), 'Juan vio fotos del cliente de Isaac';
  begin
    insert into storage.objects (bucket_id, name) values ('servicio', 'servicios/' || v_rep || '/intruso.jpg');
    assert false, 'Juan subió una foto al servicio de otro';
  exception when insufficient_privilege then null;
  end;
  perform pg_temp.como(v_taller);
  begin
    perform cerrar_servicio(v_rep, 'Don Pedro', 'Se cambió la aguja');
    assert false, 'se cerró un servicio sin foto del trabajo';
  exception when others then
    if sqlerrm not like '%foto del trabajo%' then raise; end if;
  end;
  perform agregar_evidencia('servicios/' || v_rep || '/despues-1.jpg', 'despues', v_rep);
  begin
    perform cerrar_servicio(v_rep, '', 'Se cambió la aguja');
    assert false, 'se cerró sin nombre de quien recibe';
  exception when others then
    if sqlerrm not like '%nombre de quien recibe%' then raise; end if;
  end;
  perform cerrar_servicio(v_rep, 'Don Pedro', 'Se cambió la aguja y el resorte del pisatelas');
  select * into r from v_servicios where id = v_rep;
  assert r.estado = 'cerrada' and r.recibio_nombre = 'Don Pedro' and r.fotos = 2 and r.fotos_recepcion = 1, format('cierre: %s', row_to_json(r));
  -- La evidencia no se borra.
  perform pg_temp.como(v_gp);
  delete from servicio_evidencias where servicio_id = v_rep;
  assert (select count(*) from servicio_evidencias where servicio_id = v_rep) = 2, 'se borró evidencia';
  perform pg_temp.como_postgres();
  assert exists (select 1 from avisos where usuario_id = v_vend and tipo = 'servicio_cerrado' and registro_id = v_rep::text),
    'quien pidió el servicio no recibió aviso del cierre';

  -- Hecho antes de su fecha (el cliente lo trajo antes): al cerrarlo, esa fecha queda libre.
  perform pg_temp.como(v_gp);
  v_s4 := solicitar_servicio('servicio_campo', v_cli, 'Engrapar la banda del elevador');
  perform programar_servicio(v_s4, v_ini + interval '4 days', v_ini + interval '4 days 6 hours', array[v_e1]);
  perform pg_temp.como_postgres();
  insert into storage.objects (bucket_id, name) values ('servicio', 'servicios/' || v_s4 || '/hecho.jpg');
  perform pg_temp.como(v_taller);
  perform agregar_evidencia('servicios/' || v_s4 || '/hecho.jpg', 'despues', v_s4);
  perform cerrar_servicio(v_s4, 'Encargado de planta', 'Se engrapó la banda antes de lo programado');
  assert not exists (select 1 from servicio_cuadrilla where servicio_id = v_s4 and vigente), 'la cuadrilla siguió apartada en la fecha programada';
  perform pg_temp.como(v_gp);
  v_s5 := solicitar_servicio('servicio_campo', v_cli, 'Otro servicio en el hueco que quedó libre');
  perform programar_servicio(v_s5, v_ini + interval '4 days', v_ini + interval '4 days 6 hours', array[v_e1]);

  -- ===========================================================================
  -- Mantenimiento: el taller reporta, almacén entrega la refacción, la gerencia cierra.
  -- ===========================================================================
  perform pg_temp.como(v_gp);
  insert into maquinas (numero, nombre, categoria, etapa_id, critica) values ('T82-SOL3', 'Soldadora 3 T82', 'soldadora', v_pail, true)
  returning id into v_maq;
  perform pg_temp.como(v_taller);
  begin
    insert into maquinas (numero, nombre, categoria) values ('T82-X', 'Máquina del taller', 'otra');
    assert false, 'el taller dio de alta una máquina';
  exception when insufficient_privilege then null;
  end;
  perform pg_temp.como_postgres();
  insert into articulos (clave, tipo, nombre, unidad) values ('T82-CABLE', 'componente', 'Cable de tierra T82', 'pieza') returning id into v_ref;
  insert into costos_articulo (articulo_id, costo) values (v_ref, 350);
  insert into movimientos_inventario (tipo, articulo_id, almacen_id, cantidad) values ('inicial', v_ref, v_pb, 5);
  insert into storage.objects (bucket_id, name) values ('servicio', 'mantenimiento/' || v_maq || '/falla-1.jpg');

  perform pg_temp.como(v_taller);
  v_mto := reportar_falla(v_maq, 'Hace chispa y ya no jaló', true, array['mantenimiento/' || v_maq || '/falla-1.jpg'], 'Martín');
  assert (select estado from maquinas where id = v_maq) = 'fuera_de_servicio', 'la máquina parada no quedó fuera de servicio';
  assert (select count(*) from servicio_evidencias where mantenimiento_id = v_mto and momento = 'falla') = 1, 'la foto de la falla';
  assert (select reportado_por_nombre from v_ordenes_mantenimiento where id = v_mto) = 'Martín', 'nombre de piso de quien reporta';
  -- …pero no la cierra ni la cancela, ni directo ni con la función.
  begin
    perform cerrar_mantenimiento(v_mto, 'Se cambió el cable');
    assert false, 'el taller cerró la orden de mantenimiento';
  exception when insufficient_privilege then null;
  end;
  begin
    perform cancelar_mantenimiento(v_mto, 'Era otra cosa');
    assert false, 'el taller canceló la orden de mantenimiento';
  exception when insufficient_privilege then null;
  end;
  update ordenes_mantenimiento set estado = 'cerrada' where id = v_mto;
  assert (select estado from ordenes_mantenimiento where id = v_mto) = 'pendiente', 'el taller cerró la orden escribiendo la tabla';

  perform pg_temp.como(v_gp);
  assert exists (select 1 from hallazgos_servicio('servicio') where titulo like '%fuera de servicio' and detalle like '%T82-SOL3 Soldadora 3 T82 (desde hoy)%'),
    'hallazgo de máquina parada';
  -- hallazgos() los junta solo (despachador de 20261003000068).
  assert exists (select 1 from hallazgos('servicio') where area = 'servicio' and titulo like '%fuera de servicio'),
    'hallazgos() no trae los de servicio';
  -- La gerencia entra a Inicio con el área "produccion": ahí también los ve.
  assert exists (select 1 from hallazgos('produccion') where area = 'servicio'), 'la gerencia no ve los hallazgos de servicio en su inicio';
  perform pg_temp.como_postgres();
  assert exists (select 1 from avisos where usuario_id = v_gp and tipo = 'falla_reportada' and registro_id = v_mto::text),
    'la gerencia no recibió aviso de la falla';

  -- Diagnóstico y refacción: el taller la pide, almacén la entrega con registrar_salida.
  perform pg_temp.como(v_taller);
  perform atender_mantenimiento(v_mto, 'Cable de tierra quemado', 'Martín');
  assert (select estado from maquinas where id = v_maq) = 'en_mantenimiento', 'en reparación';
  v_linea := agregar_material_servicio(v_ref, 2, null, v_mto, 'Para la pinza de tierra');
  begin
    perform surtir_material_servicio(v_linea, v_pb);
    assert false, 'el taller sacó material del almacén';
  exception when insufficient_privilege then null;
  end;
  perform pg_temp.como(v_alm);
  v_mov := surtir_material_servicio(v_linea, v_pb);
  perform pg_temp.como_postgres();
  select * into r from movimientos_inventario where id = v_mov;
  assert r.tipo = 'salida_consumo' and r.cantidad = -2 and r.articulo_id = v_ref and r.almacen_id = v_pb
     and r.motivo like (select folio from ordenes_mantenimiento where id = v_mto) || ' · T82-SOL3%',
    format('la refacción salió con su movimiento: %s', row_to_json(r));
  assert (select cantidad from existencias where articulo_id = v_ref and almacen_id = v_pb) = 3, 'la existencia bajó';
  assert (select estado from servicio_materiales where id = v_linea) = 'surtido', 'partida surtida';
  assert (select monto from costos_servicio where material_id = v_linea) = 700, 'costo de la refacción';

  -- Costos: la gerencia captura el servicio externo y lo ve; el costo de la refacción
  -- (que es el costo del artículo) solo lo ve quien tiene "costos".
  perform pg_temp.como(v_gp);
  insert into costos_servicio (mantenimiento_id, concepto, descripcion, monto) values (v_mto, 'servicio_externo', 'Revisión del transformador', 1200);
  assert (select count(*) from costos_servicio where mantenimiento_id = v_mto) = 1, 'la gerencia vio el costo del artículo en la refacción';
  begin
    insert into costos_servicio (mantenimiento_id, concepto, descripcion, monto) values (v_mto, 'material', 'Refacción a mano', 1);
    assert false, 'se capturó un costo de material a mano (sale de almacén)';
  exception when insufficient_privilege then null;
  end;
  perform pg_temp.como(v_dir);
  assert (select total from v_costos_maquina where maquina_id = v_maq) = 1900, 'dirección ve el costo acumulado de la máquina';
  -- Ventas, el taller y almacén no ven costos de mantenimiento ni los capturan.
  perform pg_temp.como(v_vend);
  assert not exists (select 1 from costos_servicio), 'ventas vio costos de servicio o mantenimiento';
  assert not exists (select 1 from v_costos_maquina), 'ventas vio el costo acumulado de una máquina';
  assert not exists (select 1 from v_costos_servicio), 'ventas vio costos por orden';
  assert exists (select 1 from v_maquinas where id = v_maq and estado = 'en_mantenimiento'), 'ventas sí ve la máquina (sin costos)';
  begin
    insert into costos_servicio (mantenimiento_id, concepto, descripcion, monto) values (v_mto, 'otro', 'Propina', 1);
    assert false, 'ventas capturó un costo';
  exception when insufficient_privilege then null;
  end;
  perform pg_temp.como(v_taller);
  assert not exists (select 1 from costos_servicio where mantenimiento_id = v_mto), 'el taller vio costos de mantenimiento';
  perform pg_temp.como(v_alm);
  assert not exists (select 1 from costos_servicio where mantenimiento_id = v_mto), 'almacén vio costos de mantenimiento';

  -- Cerrar: la máquina vuelve a servicio y queda el tiempo que estuvo parada.
  perform pg_temp.como_postgres();
  update ordenes_mantenimiento set fuera_desde = now() - interval '26 hours' where id = v_mto;
  perform pg_temp.como(v_gp);
  perform cerrar_mantenimiento(v_mto, 'Se cambió el cable de tierra y la pinza');
  select * into r from v_ordenes_mantenimiento where id = v_mto;
  assert r.estado = 'cerrada' and r.horas_paro = 26, format('cierre: %s h paradas', r.horas_paro);
  assert (select estado from maquinas where id = v_maq) = 'operando', 'la máquina no volvió a servicio';
  select * into r from v_maquinas where id = v_maq;
  assert r.fallas_12m = 1 and r.horas_paro_12m = 26 and r.orden_id is null, format('historial: %s', row_to_json(r));

  -- Insumos de un servicio que no hay en almacén: van a compras como requisición.
  v_linea := agregar_material_servicio(v_ref, 10, v_s2, null, 'Para fijar la banda');
  v_req := pedir_material_a_compras(v_s2);
  assert (select estado from servicio_materiales where id = v_linea) = 'en_compra', 'el insumo quedó en compra';
  assert exists (select 1 from requisicion_lineas where requisicion_id = v_req and articulo_id = v_ref and cantidad = 10
                 and notas = (select folio from servicios where id = v_s2)), 'la requisición trae el insumo y el folio';
  perform pg_temp.como(v_vend);
  begin
    perform agregar_material_servicio(v_ref, 1, v_s1);
    assert false, 'ventas pidió insumos';
  exception when insufficient_privilege then null;
  end;

  -- ===========================================================================
  -- Preventivos: el vencido genera su orden, una sola vez.
  -- ===========================================================================
  perform pg_temp.como(v_gp);
  insert into maquinas (numero, nombre, categoria, etapa_id) values ('T82-COMP', 'Compresor T82', 'compresor', v_pail) returning id into v_comp;
  insert into planes_preventivos (maquina_id, nombre, tareas, cada_dias, ultima_fecha)
  values (v_comp, 'Cambio de aceite', 'Aceite, filtro y purga del tanque', 90, hoy_planta() - 100) returning id into v_plan;
  insert into maquinas (numero, nombre, categoria, tipo, usa_horometro, horas_uso)
  values ('T82-MONT', 'Montacargas T82', 'montacargas', 'vehiculo', true, 200) returning id into v_mont;
  insert into planes_preventivos (maquina_id, nombre, cada_horas, ultima_horas) values (v_mont, 'Servicio de 250 h', 250, 0) returning id into v_plan2;
  perform pg_temp.como(v_taller);
  begin
    insert into planes_preventivos (maquina_id, nombre, cada_dias) values (v_comp, 'Plan del taller', 30);
    assert false, 'el taller creó un plan preventivo';
  exception when insufficient_privilege then null;
  end;
  assert (select situacion from v_planes_preventivos where id = v_plan) = 'vencido', 'el plan del compresor está vencido';

  perform pg_temp.como_postgres();      -- como lo corre pg_cron
  perform generar_preventivos();
  perform generar_preventivos();
  assert (select count(*) from ordenes_mantenimiento where plan_id = v_plan) = 1, 'el preventivo vencido no generó su orden (o la generó dos veces)';
  select * into r from v_ordenes_mantenimiento where plan_id = v_plan;
  assert r.tipo = 'preventivo' and r.estado = 'pendiente' and r.vence = hoy_planta() - 10 and r.vencida,
    format('orden preventiva: %s', row_to_json(r));
  assert not exists (select 1 from ordenes_mantenimiento where plan_id = v_plan2), 'el montacargas todavía no llega a sus 250 h';
  assert exists (select 1 from avisos where usuario_id = v_gp and tipo = 'preventivo_por_hacer' and registro_id = r.id::text),
    'la gerencia no recibió aviso del preventivo';
  perform pg_temp.como(v_gp);
  assert exists (select 1 from hallazgos_servicio('servicio') where titulo like '%preventivo%vencido%'), 'hallazgo de preventivos vencidos';

  -- Por horas: al pasar el horómetro de 250 h, la orden sale en ese momento.
  perform pg_temp.como(v_taller);
  begin
    perform registrar_horas_maquina(v_mont, 150);
    assert false, 'el horómetro fue para atrás';
  exception when others then
    if sqlerrm not like '%para atrás%' then raise; end if;
  end;
  perform registrar_horas_maquina(v_mont, 262);
  assert exists (select 1 from ordenes_mantenimiento where plan_id = v_plan2 and estado = 'pendiente' and vence_horas = 250),
    'el preventivo por horas no se generó';

  -- Cerrar el preventivo reinicia el plan.
  perform pg_temp.como(v_gp);
  select id into v_prev from ordenes_mantenimiento where plan_id = v_plan;
  perform atender_mantenimiento(v_prev, 'Aceite muy negro', 'José Luis');
  assert (select estado from maquinas where id = v_comp) = 'en_mantenimiento', 'el compresor se para mientras se le hace el preventivo';
  perform cerrar_mantenimiento(v_prev, 'Se cambió aceite y filtro; se purgó el tanque');
  assert (select ultima_fecha from planes_preventivos where id = v_plan) = hoy_planta(), 'el plan no se reinició';
  assert (select situacion from v_planes_preventivos where id = v_plan) = 'al_dia', 'el plan sigue vencido';
  assert (select estado from maquinas where id = v_comp) = 'operando', 'el compresor no volvió a servicio';

  -- ===========================================================================
  -- Resguardo: quién tiene la herramienta y desde cuándo.
  -- ===========================================================================
  insert into maquinas (numero, nombre, categoria, tipo, prestable) values ('T82-PIN', 'Pinzas de presión T82', 'pinzas', 'herramienta', true)
  returning id into v_pinza;
  perform pg_temp.como(v_vend);
  begin
    perform prestar_herramienta(v_pinza, null, 'Yo mismo');
    assert false, 'ventas prestó herramienta';
  exception when insufficient_privilege then null;
  end;
  perform pg_temp.como(v_alm);
  v_res := prestar_herramienta(v_pinza, null, 'Ingeniería (Miguel)');
  begin
    perform prestar_herramienta(v_pinza, v_e1);
    assert false, 'se prestó una herramienta que nadie ha regresado';
  exception when others then
    if sqlerrm not like '%la tiene Ingeniería (Miguel)%' then raise; end if;
  end;
  perform pg_temp.como_postgres();
  update resguardos set entregado_en = now() - interval '12 days' where id = v_res;
  perform pg_temp.como(v_taller);
  select * into r from v_resguardos where id = v_res;
  assert r.vencido and r.dias = 12 and r.quien = 'Ingeniería (Miguel)', format('resguardo vencido: %s', row_to_json(r));
  perform pg_temp.como(v_gp);
  assert exists (select 1 from hallazgos_servicio('servicio') where titulo like '%sin regresar' and detalle like '%Pinzas de presión T82 la tiene Ingeniería (Miguel) desde hace 12 días%'),
    'hallazgo de herramienta sin regresar';
  perform pg_temp.como_postgres();
  perform avisos_servicio();
  assert exists (select 1 from avisos where usuario_id = v_alm and tipo = 'herramienta_sin_regresar'), 'almacén no recibió el aviso de la herramienta';
  -- Regresa dañada: se reporta la falla sola.
  perform pg_temp.como(v_alm);
  perform devolver_herramienta(v_res, 'con_dano', 'Le falta el resorte');
  assert exists (select 1 from ordenes_mantenimiento where maquina_id = v_pinza and estado = 'pendiente' and falla like 'Regresó dañada%resorte'),
    'la herramienta dañada no generó su reporte de falla';
  assert not (select vencido from v_resguardos where id = v_res), 'sigue como prestada';

  -- ===========================================================================
  -- Hallazgos: un servicio que choca con la carga del taller.
  -- ===========================================================================
  perform pg_temp.como_postgres();
  insert into ordenes_produccion (articulo_id, estado, inicio_plan, fecha_compromiso)
  values (v_eq, 'liberada', v_lunes, v_lunes + 4) returning id into v_op3;
  insert into op_operaciones (orden_id, etapa_id, horas_estimadas) values (v_op3, v_pail, v_cap * 2);
  perform pg_temp.como(v_gp);
  assert exists (select 1 from hallazgos_servicio('servicio') where titulo ~ 'Pailería (no alcanza|ya va pasada)'
                   and detalle like '%' || (select folio from servicios where id = v_s2) || '%'), 'hallazgo de servicio contra la carga del taller';
  -- Fuera de su área no se calcula; y almacén no recibe hallazgos de servicio ni nada con dinero.
  assert not exists (select 1 from hallazgos_servicio('ventas')), 'hallazgos de servicio en el área de ventas';
  perform pg_temp.como(v_alm);
  assert not exists (select 1 from hallazgos('almacen') where area = 'servicio' or titulo || detalle like '%$%'), 'hallazgos de almacén';
  perform pg_temp.como_postgres();
end $$;

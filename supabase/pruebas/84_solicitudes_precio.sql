-- Solicitudes de precio a compras y fichas técnicas en el cotizador
-- (20261003000084_solicitudes_precio.sql), con la RLS de verdad.
-- Claves T84-… para no chocar con el catálogo real de la base local.

-- -----------------------------------------------------------------------------
-- Horas hábiles de la planta: lun–vie 8–18, sáb 8–14, sin domingos ni feriados.
-- -----------------------------------------------------------------------------
do $$
declare mx text := 'America/Mexico_City';
begin
  -- Viernes 17:00 + 4 h: 1 h el viernes y 3 el sábado (el sábado se trabaja de 8 a 14).
  assert (sumar_horas_habiles('2026-10-09 17:00-06', 4) at time zone mx) = '2026-10-10 11:00',
    format('vie 17:00 + 4 h = sáb 11:00, salió %s', sumar_horas_habiles('2026-10-09 17:00-06', 4) at time zone mx);
  -- Viernes 17:00 + 1 día hábil (10 h, el plazo normal) = lunes 11:00.
  assert (sumar_horas_habiles('2026-10-09 17:00-06', 10) at time zone mx) = '2026-10-12 11:00', 'vie 17:00 + 10 h = lun 11:00';
  -- Sábado 13:00 + 4 h: 1 h el sábado y 3 el lunes.
  assert (sumar_horas_habiles('2026-10-10 13:00-06', 4) at time zone mx) = '2026-10-12 11:00', 'sáb 13:00 + 4 h = lun 11:00';
  -- El domingo no cuenta: empieza a correr el lunes a las 8:00.
  assert (sumar_horas_habiles('2026-10-11 10:00-06', 0) at time zone mx) = '2026-10-12 08:00', 'domingo cuenta desde el lunes 8:00';
  assert (sumar_horas_habiles('2026-10-11 10:00-06', 4) at time zone mx) = '2026-10-12 12:00', 'dom + 4 h = lun 12:00';
  -- Fuera de horario entre semana: a las 20:00 cuenta desde el día siguiente a las 8:00.
  assert (sumar_horas_habiles('2026-10-07 20:00-06', 4) at time zone mx) = '2026-10-08 12:00', 'mié 20:00 + 4 h = jue 12:00';
  -- Feriado de ley: el lunes 16-nov-2026 (tercer lunes de noviembre) no se trabaja.
  assert (sumar_horas_habiles('2026-11-14 13:00-06', 4) at time zone mx) = '2026-11-17 11:00', 'el feriado no cuenta';
  assert horas_habiles('2026-10-09 17:00-06', '2026-10-12 11:00-06') = 10, 'vie 17:00 a lun 11:00 son 10 h hábiles';
  assert horas_habiles('2026-10-12 11:00-06', '2026-10-09 17:00-06') = 0, 'al revés son 0';
  assert en_horario_habil('2026-10-10 13:59-06') and not en_horario_habil('2026-10-10 14:00-06'), 'el sábado cierra a las 14:00';
  assert not en_horario_habil('2026-10-11 10:00-06'), 'el domingo no es hábil';

  -- El horario es dato: si la planta dejara de abrir los sábados, viernes 17:00 + 4 h
  -- caería el lunes a las 11:00 sin tocar código.
  update configuracion set valor = valor - '6' where clave = 'horario_habil';
  assert (sumar_horas_habiles('2026-10-09 17:00-06', 4) at time zone mx) = '2026-10-12 11:00', 'sin sábado: vie 17:00 + 4 h = lun 11:00';
  update configuracion set valor = valor || '{"6": ["08:00", "14:00"]}' where clave = 'horario_habil';
end $$;

-- -----------------------------------------------------------------------------
-- La cola: pedir, ver, tomar, contestar, cancelar, aplicar y avisos.
-- -----------------------------------------------------------------------------
do $$
declare
  v_isaac uuid; v_juan uuid; v_gerente uuid; v_compras uuid; v_compras2 uuid; v_imp uuid; v_alm uuid; v_ing uuid; v_doble uuid;
  v_cli uuid; v_pol uuid; v_pol2 uuid; v_eq uuid; v_prov uuid; v_cot uuid; v_libre uuid; v_l_pol2 uuid;
  v_s1 uuid; v_s2 uuid; v_s3 uuid; v_s4 uuid; v_s5 uuid; v_s6 uuid; v_nuevo uuid; v_doc uuid; v_plano uuid;
  v_j jsonb; r record; v_txt text; v_n int; v_u uuid;
begin
  v_isaac := pg_temp.usuario('isaac@hegamex.com', '{ventas}');
  v_juan := pg_temp.usuario('juan@hegamex.com', '{ventas}');
  v_gerente := pg_temp.usuario('gerente.ventas@hegamex.com', '{gerente_ventas}');
  v_compras := pg_temp.usuario('compras@hegamex.com', '{compras}');
  v_compras2 := pg_temp.usuario('compras2@hegamex.com', '{compras}');
  v_imp := pg_temp.usuario('importaciones@hegamex.com', '{importaciones}');
  v_alm := pg_temp.usuario('almacen@hegamex.com', '{almacen}');
  v_ing := pg_temp.usuario('ingenieria@hegamex.com', '{ingenieria}');
  v_doble := pg_temp.usuario('vende.y.compra@hegamex.com', '{ventas,compras}');

  -- Polea del catálogo a $700 de costo ($1,000 de lista, costo ÷ 0.70); otra sin costo
  -- (sin precio de lista); un equipo; un proveedor; y el cliente de Isaac.
  insert into articulos (clave, tipo, nombre, tiempo_entrega_dias) values ('T84-POL', 'componente', 'T Polea 8" masa fija', 3) returning id into v_pol;
  insert into costos_articulo (articulo_id, costo) values (v_pol, 700);
  assert (select precio from precios_lista where articulo_id = v_pol) = 1000, 'precio de la polea';
  insert into articulos (clave, tipo, nombre) values ('T84-CAT', 'componente', 'T Catarina 80-14 sin costo') returning id into v_pol2;
  insert into articulos (clave, tipo, nombre) values ('T84-EQ', 'equipo', 'T Dosificadora Zar-6') returning id into v_eq;
  insert into proveedores (nombre) values ('T84 Rodamientos del Bajío') returning id into v_prov;
  insert into clientes (nombre, vendedor_id, legacy_ref) values ('T84 Agregados del Centro', v_isaac, 'T:84') returning id into v_cli;

  -- Isaac cotiza: el equipo, la catarina sin precio y una partida libre ("no está en el catálogo").
  perform pg_temp.como(v_isaac);
  v_cot := nueva_cotizacion(v_cli);
  perform agregar_partida(v_cot, v_eq, 1);
  select id into v_l_pol2 from agregar_partida(v_cot, v_pol2, 4);
  assert (select precio_lista from cotizacion_lineas where id = v_l_pol2) is null, 'la catarina no tiene precio de lista';
  insert into cotizacion_lineas (cotizacion_id, orden, titulo, unidad, cantidad, precio_unitario)
  values (v_cot, 9, 'Polea 10" para Zar-6 (foto en el chat)', 'pieza', 2, 0) returning id into v_libre;

  -- ---------------------------------------------------------------------------
  -- Pedir: urgente vence a 4 h hábiles; normal a 1 día hábil (10 h).
  -- ---------------------------------------------------------------------------
  v_s1 := pedir_precio('Polea 10" doble canal para Zar-6', null, 2, true, 'Martin', '2B10', 'El cliente está en la línea',
                       v_cot, v_libre);
  v_s2 := pedir_precio(null, v_pol2, 4, false, null, null, null, null, v_l_pol2);
  perform pg_temp.como_postgres();
  select * into r from solicitudes_precio where id = v_s1;
  assert r.folio ~ '^SP-\d{4}-\d{5}$', format('folio propio: %s', r.folio);
  assert r.solicitante_id = v_isaac and r.cotizacion_id = v_cot and r.cliente_id = v_cli and r.estado = 'abierta', 'la solicitud trae para qué y de quién';
  assert r.vence_en = sumar_horas_habiles(r.creado_en, 4), 'urgente: 4 horas hábiles';
  assert (select vence_en = sumar_horas_habiles(creado_en, 10) and cotizacion_id = v_cot from solicitudes_precio where id = v_s2),
    'normal: un día hábil, y la cotización sale de la partida';

  perform pg_temp.como(v_isaac);
  begin
    perform pedir_precio(null, v_pol2, 1, false, null, null, null, null, v_l_pol2);
    assert false, 'se pidió dos veces el precio de la misma partida';
  exception when raise_exception then
    if sqlerrm not like '%Ya pediste%' then raise; end if;
  end;
  begin
    perform pedir_precio('ab');
    assert false, 'se pidió precio sin decir qué';
  exception when raise_exception then null;
  end;

  -- No pide quien no vende, ni nadie en la cotización de otro.
  perform pg_temp.como(v_alm);
  begin
    perform pedir_precio('Rodamiento 6205');
    assert false, 'almacén pidió precio a compras';
  exception when insufficient_privilege then null;
  end;
  perform pg_temp.como(v_juan);
  begin
    perform pedir_precio('Rodamiento 6205', null, 1, false, null, null, null, v_cot);
    assert false, 'Juan pidió precio para la cotización de Isaac';
  exception when insufficient_privilege then null;
  end;

  -- ---------------------------------------------------------------------------
  -- Quién ve qué: un vendedor no ve las de otro; la gerencia y compras ven todas.
  -- ---------------------------------------------------------------------------
  assert not exists (select 1 from solicitudes_precio where id in (v_s1, v_s2)), 'Juan vio las solicitudes de Isaac (tabla)';
  assert not exists (select 1 from v_solicitudes_precio where id in (v_s1, v_s2)), 'Juan vio las solicitudes de Isaac (vista)';
  perform pg_temp.como(v_alm);
  assert not exists (select 1 from v_solicitudes_precio where id = v_s1), 'almacén (compras 1) vio la cola de precios';
  perform pg_temp.como(v_gerente);
  assert (select count(*) from v_solicitudes_precio where id in (v_s1, v_s2)) = 2, 'la gerencia de ventas ve las de su equipo';
  perform pg_temp.como(v_compras);
  assert (select count(*) from v_solicitudes_precio where id in (v_s1, v_s2)) = 2, 'compras ve la cola';
  perform pg_temp.como(v_isaac);
  select * into r from v_solicitudes_precio where id = v_s1;
  assert r.folio is not null and r.semaforo = 'a_tiempo' and r.horas_restantes > 0, 'Isaac ve su solicitud con su semáforo';

  -- Avisos: la nueva le llega a compras (la urgente se distingue), no a quien la pidió.
  perform pg_temp.como_postgres();
  assert exists (select 1 from avisos where usuario_id = v_compras and tipo = 'solicitud_precio_urgente' and registro_id = v_s1::text
                 and titulo like 'URGENTE%'), 'compras no supo de la urgente';
  assert exists (select 1 from avisos where usuario_id = v_compras and tipo = 'solicitud_precio_nueva' and registro_id = v_s2::text), 'compras no supo de la normal';
  assert not exists (select 1 from avisos where usuario_id = v_isaac and registro_id in (v_s1::text, v_s2::text)), 'a Isaac le avisaron de lo que él pidió';
  assert not exists (select 1 from avisos where usuario_id in (v_juan, v_alm) and registro_id = v_s1::text), 'el aviso le llegó a quien no es de compras';
  -- Quien es de ventas y de compras no recibe aviso de su propia solicitud; el resto de compras sí.
  perform pg_temp.como(v_doble);
  v_s6 := pedir_precio('Cosedora de costales Fischbein');
  perform pg_temp.como_postgres();
  assert not exists (select 1 from avisos where usuario_id = v_doble and registro_id = v_s6::text), 'se le avisó al que pidió';
  assert exists (select 1 from avisos where usuario_id = v_compras2 and registro_id = v_s6::text), 'al resto de compras sí';

  -- Foto: la del chat ("esta polea"). Se simula la subida al bucket.
  insert into storage.objects (bucket_id, name) values
    ('solicitudes-precio', v_s1 || '/polea.jpg'), ('solicitudes-precio', v_s2 || '/de-otra.jpg');
  perform pg_temp.como(v_isaac);
  begin
    perform agregar_foto_solicitud(v_s1, v_s2 || '/de-otra.jpg');
    assert false, 'se registró la foto de otra solicitud';
  exception when raise_exception then
    if sqlerrm not like '%carpeta%' then raise; end if;
  end;
  begin
    perform agregar_foto_solicitud(v_s1, v_s1 || '/no-se-subio.jpg');
    assert false, 'se registró una foto que no está en el bucket';
  exception when raise_exception then
    if sqlerrm not like '%no se subió%' then raise; end if;
  end;
  perform agregar_foto_solicitud(v_s1, v_s1 || '/polea.jpg');
  assert (select fotos from v_solicitudes_precio where id = v_s1) = 1, 'la foto quedó en la solicitud';
  perform pg_temp.como(v_juan);
  assert not exists (select 1 from solicitudes_precio_fotos where solicitud_id = v_s1), 'Juan vio la foto de Isaac';
  assert not exists (select 1 from storage.objects where bucket_id = 'solicitudes-precio' and name like v_s1 || '/%'), 'Juan vio el archivo de Isaac';
  begin
    insert into storage.objects (bucket_id, name) values ('solicitudes-precio', v_s1 || '/intruso.jpg');
    assert false, 'Juan subió una foto a la solicitud de Isaac';
  exception when insufficient_privilege then null;
  end;
  perform pg_temp.como(v_compras);
  assert exists (select 1 from storage.objects where bucket_id = 'solicitudes-precio' and name = v_s1 || '/polea.jpg'), 'compras no ve la foto';

  -- ---------------------------------------------------------------------------
  -- Tomar: solo compras (nivel 2); el vendedor ve quién la tiene.
  -- ---------------------------------------------------------------------------
  foreach v_u in array array[v_isaac, v_alm] loop
    perform pg_temp.como(v_u);
    begin
      perform tomar_solicitud_precio(v_s1);
      assert false, 'tomó una solicitud quien no es de compras';
    exception when insufficient_privilege then null;
    end;
  end loop;
  perform pg_temp.como(v_compras);
  perform tomar_solicitud_precio(v_s1);
  perform pg_temp.como(v_compras2);
  begin
    perform tomar_solicitud_precio(v_s1);
    assert false, 'dos compradores tomaron la misma';
  exception when raise_exception then
    if sqlerrm not like '%ya la tiene%' then raise; end if;
  end;
  perform pg_temp.como(v_isaac);
  select * into r from v_solicitudes_precio where id = v_s1;
  assert r.estado = 'tomada' and r.tomada_por = v_compras and r.tomada_por_nombre is not null and r.horas_acuse is not null,
    'Isaac ve quién tiene su solicitud';
  perform pg_temp.como_postgres();
  assert exists (select 1 from avisos where usuario_id = v_isaac and tipo = 'solicitud_precio_tomada' and registro_id = v_s1::text),
    'a Isaac no le avisaron que compras ya la tiene';
  assert not exists (select 1 from avisos where usuario_id = v_compras and tipo = 'solicitud_precio_tomada'), 'a compras le avisaron de lo que hizo';

  -- ---------------------------------------------------------------------------
  -- Contestar: solo compras con permiso de costos. El vendedor, almacén e
  -- importaciones (compras 2, pero sin capturar costos) no pueden.
  -- ---------------------------------------------------------------------------
  foreach v_u in array array[v_isaac, v_gerente, v_alm, v_imp] loop
    perform pg_temp.como(v_u);
    begin
      perform contestar_solicitud_precio(v_s1, 735, 'MXN', v_prov, 5, current_date + 30, null, null, '{"nombre": "Polea 10 doble canal"}');
      assert false, 'contestó quien no debe';
    exception when insufficient_privilege then null;
    end;
  end loop;

  -- Partida libre: compras da de alta el componente con su costo; queda ligado.
  perform pg_temp.como(v_compras);
  begin
    perform contestar_solicitud_precio(v_s1, 735, 'MXN', v_prov, 5);
    assert false, 'contestó sin artículo';
  exception when raise_exception then
    if sqlerrm not like '%Elige el artículo%' then raise; end if;
  end;
  begin
    perform contestar_solicitud_precio(v_s1, 735, 'MXN', v_prov, null, null, null, null, '{"nombre": "x"}');
    assert false, 'contestó sin tiempo de entrega';
  exception when raise_exception then
    if sqlerrm not like '%tiempo de entrega%' then raise; end if;
  end;
  v_j := contestar_solicitud_precio(v_s1, 735, 'MXN', v_prov, 5, current_date + 30, 'Mínimo 2 piezas', null,
                                    '{"nombre": "T Polea 10\" doble canal 2B10", "unidad": "pieza"}');
  v_nuevo := (v_j->>'articulo_id')::uuid;
  assert (v_j->>'precio_lista')::numeric = 1050, format('precio de lista del nuevo: %s', v_j->>'precio_lista');
  perform pg_temp.como_postgres();
  select * into r from articulos where id = v_nuevo;
  assert r.tipo = 'componente' and r.tiempo_entrega_dias = 5 and r.proveedor_id = v_prov and r.descripcion like '%Martin%', 'alta del componente desde la solicitud';
  select * into r from solicitudes_precio where id = v_s1;
  assert r.estado = 'contestada' and r.articulo_id = v_nuevo and r.precio_lista = 1050 and r.contestada_por = v_compras
     and r.horas_respuesta is not null, 'la solicitud queda contestada y ligada al artículo nuevo';
  assert exists (select 1 from historial_costos where articulo_id = v_nuevo and costo_nuevo = 735 and origen = 'cotizacion_proveedor'
                 and referencia = r.folio), 'el costo no quedó en el historial con el folio';

  -- Artículo del catálogo: el costo entra por actualizar_costos (historial) y el precio
  -- de lista cambia; el tiempo de entrega queda en el artículo.
  perform pg_temp.como(v_isaac);
  v_s3 := pedir_precio(null, v_pol, 10, false, null, null, 'Precio por volumen');
  perform pg_temp.como(v_compras);
  v_j := contestar_solicitud_precio(v_s3, 770, 'MXN', v_prov, 8, null, null);
  assert (v_j->>'precio_lista')::numeric = 1100, format('precio de la polea después de la respuesta: %s', v_j->>'precio_lista');
  perform pg_temp.como_postgres();
  assert (select precio from precios_lista where articulo_id = v_pol) = 1100, 'el precio de lista no se recalculó';
  assert (select costo from costos_articulo where articulo_id = v_pol) = 770, 'el costo no quedó en el catálogo';
  assert exists (select 1 from historial_costos where articulo_id = v_pol and costo_anterior = 700 and costo_nuevo = 770
                 and origen = 'cotizacion_proveedor'), 'el cambio de costo no quedó en el historial';
  assert (select tiempo_entrega_dias from articulos where id = v_pol) = 8, 'el tiempo de entrega no quedó en el artículo';

  -- No se contesta dos veces (ni se marca "no se consigue" después).
  perform pg_temp.como(v_compras2);
  begin
    perform contestar_solicitud_precio(v_s3, 500, 'MXN', null, 2);
    assert false, 'se contestó dos veces';
  exception when raise_exception then
    if sqlerrm not like '%no se contesta dos veces%' then raise; end if;
  end;
  begin
    perform marcar_no_se_consigue(v_s3, 'Descontinuado');
    assert false, 'se marcó sin precio una ya contestada';
  exception when raise_exception then null;
  end;

  -- Avisos de la respuesta: a quien la pidió, con precio de lista y sin costo.
  perform pg_temp.como_postgres();
  select * into r from avisos where usuario_id = v_isaac and tipo = 'solicitud_precio_contestada' and registro_id = v_s1::text;
  assert r.id is not null, 'a Isaac no le avisaron que ya hay precio';
  assert r.cuerpo like '%1,050.00%' and r.cuerpo like '%5 días%' and r.cuerpo not like '%735%', format('aviso sin costo: %s', r.cuerpo);
  assert r.ruta = '/ventas/cotizaciones/' || v_cot, 'el aviso lleva a la cotización';
  assert not exists (select 1 from avisos where usuario_id = v_compras and tipo = 'solicitud_precio_contestada'), 'a compras le avisaron de su respuesta';

  -- ---------------------------------------------------------------------------
  -- El vendedor NUNCA ve el costo: ni en la vista, ni en la tabla de costos, ni en
  -- las funciones nuevas. Tampoco el proveedor (con él y la lista se adivina el margen).
  -- ---------------------------------------------------------------------------
  foreach v_u in array array[v_isaac, v_gerente] loop
    perform pg_temp.como(v_u);
    select * into r from v_solicitudes_precio where id = v_s1;
    assert r.precio_lista_actual = 1050 and r.tiempo_entrega_dias = 5 and r.respuesta = 'Mínimo 2 piezas',
      'ventas ve el precio de lista, la entrega y la nota';
    assert r.costo is null and r.moneda is null and r.proveedor_id is null and r.proveedor is null, 'ventas vio el costo o el proveedor';
    assert not exists (select 1 from solicitudes_precio_costos), 'ventas leyó la tabla de costos de las solicitudes';
    assert (select to_jsonb(v)::text from v_solicitudes_precio v where id = v_s3) not like '%770%', 'el costo se coló en la vista';
    assert resumen_solicitudes_precio()::text not like '%735%' and resumen_solicitudes_precio()::text not like '%770%', 'el resumen trae costos';
    assert not exists (select 1 from hallazgos_solicitudes('ventas') h where h.titulo || h.detalle like '%735%' or h.titulo || h.detalle like '%770%'), 'un hallazgo trae costos';
    begin
      perform precio_lista_estimado(v_pol, 100);
      assert false, 'ventas usó el estimador de precio (recibe un costo y da la fórmula)';
    exception when insufficient_privilege then null;
    end;
  end loop;
  -- Ni escribiendo directo: sin políticas de escritura, todo pasa por las funciones.
  perform pg_temp.como(v_isaac);
  update solicitudes_precio set estado = 'contestada', precio_lista = 1 where id = v_s2;
  assert (select estado from v_solicitudes_precio where id = v_s2) = 'abierta', 'Isaac cambió el estado de su solicitud por la API';
  begin
    insert into solicitudes_precio_costos (solicitud_id, costo) values (v_s1, 1);
    assert false, 'Isaac escribió un costo';
  exception when insufficient_privilege then null;
  end;
  perform pg_temp.como(v_compras);
  select * into r from v_solicitudes_precio where id = v_s1;
  assert r.costo = 735 and r.moneda = 'MXN' and r.proveedor = 'T84 Rodamientos del Bajío', 'compras sí ve costo y proveedor';
  assert precio_lista_estimado(v_pol, 840) = 1200 and precio_lista_estimado(null, 700) = 1000, 'estimado de compras';

  -- ---------------------------------------------------------------------------
  -- Aplicar a la partida: la libre se vuelve el artículo nuevo con su precio.
  -- ---------------------------------------------------------------------------
  perform pg_temp.como(v_isaac);
  assert exists (select 1 from v_solicitudes_precio where id = v_s1 and not usada), 'contestada y sin usar';
  assert exists (select 1 from hallazgos_solicitudes('ventas') where titulo like '%de compras sin usar%'), 'el vendedor no ve sus precios sin usar';
  perform pg_temp.como(v_juan);
  begin
    perform aplicar_solicitud_precio(v_s1);
    assert false, 'Juan aplicó la solicitud de Isaac';
  exception when insufficient_privilege then null;
  end;
  perform pg_temp.como(v_isaac);
  perform aplicar_solicitud_precio(v_s1);
  select * into r from cotizacion_lineas where id = v_libre;
  assert r.articulo_id = v_nuevo and r.precio_unitario = 1050 and r.precio_lista = 1050 and r.titulo like 'T Polea 10%' and r.cantidad = 2,
    format('la partida libre se volvió el artículo: %s %s %s', r.articulo_id, r.precio_unitario, r.precio_lista);
  assert exists (select 1 from v_solicitudes_precio where id = v_s1 and usada and aplicada_en is not null), 'quedó como usada';

  -- La catarina sin precio: compras contesta y al aplicar se toma la foto del precio de lista.
  perform pg_temp.como(v_compras);
  perform contestar_solicitud_precio(v_s2, 140, 'MXN', null, 2);
  perform pg_temp.como(v_isaac);
  perform aplicar_solicitud_precio(v_s2);
  select * into r from cotizacion_lineas where id = v_l_pol2;
  assert r.articulo_id = v_pol2 and r.precio_unitario = 200 and r.precio_lista = 200 and r.titulo = 'T Catarina 80-14 sin costo' and not r.bajo_minimo,
    format('precio y foto de lista de la catarina: %s / %s', r.precio_unitario, r.precio_lista);

  -- ---------------------------------------------------------------------------
  -- No se consigue: también es respuesta, con motivo.
  -- ---------------------------------------------------------------------------
  v_s4 := pedir_precio('Reductor Falk 1070 descontinuado', null, 1, false, null, null, null, v_cot);
  perform pg_temp.como(v_isaac);
  begin
    perform marcar_no_se_consigue(v_s4, 'No hay');
    assert false, 'el vendedor marcó su propia solicitud';
  exception when insufficient_privilege then null;
  end;
  perform pg_temp.como(v_compras);
  begin
    perform marcar_no_se_consigue(v_s4, '  ');
    assert false, 'sin precio y sin motivo';
  exception when raise_exception then null;
  end;
  perform marcar_no_se_consigue(v_s4, 'Descontinuado por el fabricante; el equivalente es el 1080');
  perform pg_temp.como_postgres();
  assert (select estado from solicitudes_precio where id = v_s4) = 'no_se_consigue', 'quedó sin precio';
  assert exists (select 1 from avisos where usuario_id = v_isaac and tipo = 'solicitud_precio_sin_precio' and registro_id = v_s4::text
                 and cuerpo like '%1080%'), 'a Isaac no le dijeron que no se consigue';

  -- ---------------------------------------------------------------------------
  -- Cancelar: quien la pidió (o su gerencia), mientras no esté contestada.
  -- ---------------------------------------------------------------------------
  perform pg_temp.como(v_isaac);
  v_s5 := pedir_precio('Cangilón 9x6 de plástico', null, 50);
  perform pg_temp.como(v_compras2);
  perform tomar_solicitud_precio(v_s5);
  foreach v_u in array array[v_juan, v_compras2] loop
    perform pg_temp.como(v_u);
    begin
      perform cancelar_solicitud_precio(v_s5, 'Ya no');
      assert false, 'canceló quien no la pidió ni es su gerente';
    exception when insufficient_privilege then null;
    end;
  end loop;
  perform pg_temp.como(v_isaac);
  perform cancelar_solicitud_precio(v_s5, 'El cliente lo compró en otro lado');
  perform pg_temp.como_postgres();
  assert (select estado from solicitudes_precio where id = v_s5) = 'cancelada', 'Isaac canceló la suya';
  assert exists (select 1 from avisos where usuario_id = v_compras2 and tipo = 'solicitud_precio_cancelada' and registro_id = v_s5::text),
    'a quien la tenía no le avisaron que ya no hace falta';
  assert not exists (select 1 from avisos where usuario_id = v_isaac and tipo = 'solicitud_precio_cancelada'), 'a Isaac le avisaron de su cancelación';
  perform pg_temp.como(v_compras);
  begin
    perform contestar_solicitud_precio(v_s5, 100, 'MXN', null, 1, null, null, v_pol);
    assert false, 'se contestó una cancelada';
  exception when raise_exception then null;
  end;
  perform pg_temp.como(v_isaac);
  begin
    perform cancelar_solicitud_precio(v_s3);
    assert false, 'se canceló una contestada';
  exception when raise_exception then
    if sqlerrm not like '%ya se contestó%' then raise; end if;
  end;
  -- La gerencia cancela la de su vendedor.
  v_s5 := pedir_precio('Motorreductor 5 HP 1:40', null, 1);
  perform pg_temp.como(v_gerente);
  perform cancelar_solicitud_precio(v_s5, 'Se cotiza con otro equipo');
  perform pg_temp.como_postgres();
  assert (select estado from solicitudes_precio where id = v_s5) = 'cancelada', 'la gerencia no pudo cancelar la de su vendedor';

  -- ---------------------------------------------------------------------------
  -- Recordatorios: por vencer → quien la tiene; vencida → compras y la gerencia de
  -- ventas (era de un vendedor). Se prueban a una hora hábil fija.
  -- ---------------------------------------------------------------------------
  perform pg_temp.como(v_isaac);
  v_s5 := pedir_precio('Rodillo de impacto 4" x 20"', null, 6);
  v_s3 := pedir_precio('Chumacera de piso UCP-210', null, 4);
  perform pg_temp.como(v_compras);
  perform tomar_solicitud_precio(v_s3);
  perform pg_temp.como_postgres();
  update solicitudes_precio set creado_en = '2026-10-06 08:00-06', vence_en = '2026-10-07 08:00-06' where id = v_s5;  -- vencida
  update solicitudes_precio set creado_en = '2026-10-07 08:00-06', vence_en = '2026-10-07 10:30-06' where id = v_s3;  -- por vencer a las 10:00
  v_n := avisos_solicitudes_precio('2026-10-07 10:00-06');
  assert v_n >= 3, format('recordatorios: %s', v_n);
  assert exists (select 1 from avisos where usuario_id = v_compras and tipo = 'solicitud_precio_vencida' and registro_id = v_s5::text), 'compras no supo de la vencida';
  assert exists (select 1 from avisos where usuario_id = v_gerente and tipo = 'solicitud_precio_vencida' and registro_id = v_s5::text
                 and ruta like '/ventas/%'), 'la gerencia de ventas no supo de la vencida de su vendedor';
  assert exists (select 1 from avisos where usuario_id = v_compras and tipo = 'solicitud_precio_por_vencer' and registro_id = v_s3::text), 'quien la tiene no supo que vence';
  assert not exists (select 1 from avisos where usuario_id = v_compras2 and tipo = 'solicitud_precio_por_vencer' and registro_id = v_s3::text),
    'el por vencer de una tomada le llegó a todo compras';
  assert not exists (select 1 from avisos where usuario_id in (v_juan, v_alm) and tipo like 'solicitud_precio_%'), 'le llegaron recordatorios a quien no le toca';
  -- Una vez al día, y nada fuera de horario.
  select count(*) into v_n from avisos where registro_id in (v_s5::text, v_s3::text);
  perform avisos_solicitudes_precio('2026-10-07 10:15-06');
  assert (select count(*) from avisos where registro_id in (v_s5::text, v_s3::text)) = v_n, 'repitió el recordatorio';
  assert avisos_solicitudes_precio('2026-10-11 10:00-06') = 0, 'mandó recordatorios en domingo';
  -- Para el semáforo (que usa la hora de verdad): la vencida, con una semana abierta.
  update solicitudes_precio set creado_en = now() - interval '7 days', vence_en = now() - interval '1 hour' where id = v_s5;

  -- Semáforo, hallazgos e indicador honesto (la abierta de más de un día cuenta).
  perform pg_temp.como(v_compras);
  assert (select semaforo from v_solicitudes_precio where id = v_s5) = 'vencida', 'semáforo de la vencida';
  assert exists (select 1 from hallazgos('compras') where titulo like '%vencida%'), 'compras no ve el hallazgo de vencidas';
  v_j := resumen_solicitudes_precio();
  assert (v_j->>'vencidas')::int >= 1 and (v_j #>> '{mes,abiertas_mas_de_un_dia}')::int >= 1 and (v_j #>> '{mes,resueltas}')::int >= 3,
    format('resumen: %s', v_j);
  assert (v_j #>> '{linea_base,mediana_horas}')::numeric = 3.8 and (v_j #>> '{linea_base,pct_mas_de_un_dia}')::numeric = 0.35, 'línea base del chat';
  assert exists (select 1 from hallazgos_solicitudes('compras') where titulo like 'Precios de este mes%'), 'indicador del mes en los hallazgos';

  -- ---------------------------------------------------------------------------
  -- Fichas técnicas: ventas ve las vigentes y nada en borrador; el equipo cotizado
  -- sin ficha le sale a ingeniería.
  -- ---------------------------------------------------------------------------
  perform pg_temp.como(v_ing);
  assert exists (select 1 from equipos_sin_ficha(365) where articulo_id = v_eq and cotizaciones >= 1), 'el equipo cotizado sin ficha';
  assert exists (select 1 from hallazgos('ingenieria') where titulo like '%sin ficha técnica%'),
    'ingeniería no ve los equipos que se cotizan sin ficha';
  v_doc := nuevo_documento_tecnico(v_eq, null, 'ficha', 'Ficha técnica Zar-6', 'https://drive.google.com/file/d/t84-ficha/view');
  v_plano := nuevo_documento_tecnico(v_eq, null, 'plano', 'Plano general Zar-6', 'https://drive.google.com/file/d/t84-plano/view');
  perform pg_temp.como(v_isaac);
  assert not exists (select 1 from fichas_de_articulos(array[v_eq])), 'ventas vio una ficha en borrador';
  assert not exists (select 1 from documentos_tecnicos where id = v_doc), 'ventas leyó el borrador en la tabla';
  begin
    perform equipos_sin_ficha(365);
    assert false, 'un vendedor leyó las cotizaciones de todos';
  exception when insufficient_privilege then null;
  end;
  perform pg_temp.como(v_ing);
  assert not exists (select 1 from fichas_de_articulos(array[v_eq])), 'el cotizador mostró un borrador aunque ingeniería sí lo ve';
  perform aprobar_documento(v_doc);
  perform aprobar_documento(v_plano);
  assert not exists (select 1 from equipos_sin_ficha(365) where articulo_id = v_eq), 'con ficha vigente ya no es hallazgo';
  perform pg_temp.como(v_isaac);
  select * into r from fichas_de_articulos(array[v_eq, v_pol]);
  assert r.documento_id = v_doc and r.drive_url like 'https://drive.google.com/%', 'ventas ve la ficha vigente con su liga';
  assert (select count(*) from fichas_de_articulos(array[v_eq])) = 1, 'el plano no es ficha de venta';
  perform pg_temp.como(v_juan);
  assert exists (select 1 from fichas_de_articulos(array[v_eq])), 'cualquier vendedor ve la ficha vigente';

  perform pg_temp.como_postgres();
end $$;

-- Avisos de ventas que sí mueven algo:
-- 1. Un lead con un intento ya no es «sin atender»; sin gerencia de ventas, dirección recibe un
--    resumen por vendedor, dos veces por día hábil como máximo.
-- 2. Cada envío de cotización deja por dónde salió y a quién; lo que llega a «enviada» por otro
--    camino queda como «solo marcada». Nadie escribe la constancia a mano.
-- 3. Un pedido de maquinaria con anticipo que entra a producción sin cobro avisa a finanzas y al
--    vendedor, una sola vez; con cobro, o sin la palabra anticipo, no.
do $$
declare v_a uuid; v_b uuid; v_ger uuid; v_dir uuid; v_rec uuid; v_fin uuid; v_gp uuid;
  v_cli uuid; v_con uuid; l1 uuid; l2 uuid; l3 uuid; lb uuid; c1 uuid; c2 uuid; c3 uuid;
  v_ped uuid; v_ped2 uuid; v_ped3 uuid; v_eq uuid; v_mp uuid; v_op uuid;
  v_dia date; t timestamptz; v_ok boolean; v_err text; v_n int; r record;
begin
  v_a := pg_temp.usuario('vena257@hegamex.com', '{ventas}');
  v_b := pg_temp.usuario('venb257@hegamex.com', '{ventas}');
  v_ger := pg_temp.usuario('ger257@hegamex.com', '{gerente_ventas}');
  v_dir := pg_temp.usuario('dir257@hegamex.com', '{direccion}');
  v_rec := pg_temp.usuario('rec257@hegamex.com', '{recepcion}');
  v_fin := pg_temp.usuario('fin257@hegamex.com', '{finanzas}');
  v_gp := pg_temp.usuario('gp257@hegamex.com', '{gerente_produccion}');

  -- El primer día hábil a dos o más días de hoy: los leads de hoy ya pasaron sus 24 h.
  v_dia := current_date + 2;
  while not dia_laborable(v_dia) loop v_dia := v_dia + 1; end loop;
  t := (v_dia + time '10:00') at time zone 'America/Mexico_City';

  -- =========================================================================
  -- 1. Leads
  -- =========================================================================
  perform pg_temp.como(v_ger);
  perform fijar_config_leads('recepcion', 2, 24, array[v_a, v_b]);
  perform pg_temp.como(v_rec);
  insert into leads (nombre, telefono, interes, vendedor_id) values ('Sin tocar 257', '5550002571', 'Banda 257', v_a) returning id into l1;
  insert into leads (nombre, telefono, interes, vendedor_id) values ('Con intento 257', '5550002572', 'Tolva 257', v_a) returning id into l2;
  insert into leads (nombre, telefono, interes, vendedor_id) values ('De B con intento 257', '5550002573', 'Silo 257', v_b) returning id into lb;
  perform pg_temp.como(v_a);
  perform registrar_intento_lead(l2, 'whatsapp', 'enviado');
  perform pg_temp.como(v_b);
  perform registrar_intento_lead(lb, 'llamada', 'no_contesto');

  -- 1a. Con gerencia: el sin tocar avisa a la gerencia y al vendedor; el que tiene intento, a nadie.
  perform pg_temp.como_postgres();
  perform avisos_leads(t);
  assert (select count(*) from avisos where tipo = 'lead_sin_atender' and registro_id = l1::text and usuario_id in (v_ger, v_a)) = 2,
    'el lead sin intento no avisó a gerencia y vendedor';
  assert not exists (select 1 from avisos where tipo = 'lead_sin_atender' and registro_id in (l2::text, lb::text)),
    'avisó «sin atender» de un lead que ya tenía intento';
  assert (select avisado_sin_atender_en from leads where id = l2) is null, 'marcó como avisado un lead con intento';
  assert not exists (select 1 from avisos where tipo = 'leads_sin_atender_resumen' and usuario_id = v_dir),
    'con gerencia no debe haber resumen a dirección';

  -- 1b. Sin nadie activo en gerente_ventas (como en la nube): el vendedor sigue recibiendo su
  --     aviso por lead y dirección un resumen por vendedor.
  --     La da de baja quien puede: un administrador (proteger_perfil).
  perform pg_temp.como(pg_temp.usuario('adm257@hegamex.com', '{admin}'));
  update perfiles set activo = false where id in (select usuario_id from usuario_roles where rol = 'gerente_ventas');
  perform pg_temp.como_postgres();
  assert not exists (select gerencia_leads()), 'la gerencia debía quedar vacía';
  perform pg_temp.como(v_rec);
  insert into leads (nombre, telefono, interes, vendedor_id) values ('Otro sin tocar 257', '5550002574', 'Criba 257', v_a) returning id into l3;
  perform pg_temp.como_postgres();
  perform avisos_leads(t + interval '5 minutes');
  assert (select count(*) from avisos where tipo = 'lead_sin_atender' and registro_id = l3::text) = 1
     and exists (select 1 from avisos where tipo = 'lead_sin_atender' and registro_id = l3::text and usuario_id = v_a),
    'sin gerencia el aviso por lead debe ir solo al vendedor';
  select * into r from avisos where tipo = 'leads_sin_atender_resumen' and usuario_id = v_dir and registro_id like v_a || ' %';
  assert r.id is not null and r.titulo like '%: 2 leads sin ningún intento' and r.ruta = '/ventas/leads?filtro=sin_contactar&vendedor=' || v_a,
    format('resumen de dirección: %s', row_to_json(r));
  assert not exists (select 1 from avisos where tipo = 'leads_sin_atender_resumen' and registro_id like v_b || ' %'),
    'B solo tiene un lead con intento: no debe salir en el resumen';
  assert not exists (select 1 from avisos where tipo = 'leads_sin_atender_resumen' and usuario_id in (v_a, v_b, v_rec)),
    'el resumen es para dirección, no para vendedores ni recepción';

  -- Máximo dos al día: el de la mañana no se repite, el de la tarde sale una vez, de noche nada.
  perform avisos_leads(t + interval '45 minutes');
  perform avisos_leads((v_dia + time '15:05') at time zone 'America/Mexico_City');
  perform avisos_leads((v_dia + time '15:20') at time zone 'America/Mexico_City');
  perform avisos_leads((v_dia + time '22:00') at time zone 'America/Mexico_City');
  select count(*) into v_n from avisos where tipo = 'leads_sin_atender_resumen' and usuario_id = v_dir and registro_id like v_a || ' %';
  assert v_n = 2, format('debían salir exactamente dos resúmenes en el día: %s', (select json_agg(json_build_object('t', titulo, 'en', creado_en)) from avisos where tipo = 'leads_sin_atender_resumen' and usuario_id = v_dir));
  -- Antes de las 9 del día siguiente, ni en un día inhábil.
  perform avisos_leads((v_dia + 1 + time '08:30') at time zone 'America/Mexico_City');
  v_dia := v_dia + 1;
  while dia_laborable(v_dia) loop v_dia := v_dia + 1; end loop;
  perform avisos_leads((v_dia + time '10:00') at time zone 'America/Mexico_City');
  assert (select count(*) from avisos where tipo = 'leads_sin_atender_resumen' and usuario_id = v_dir and registro_id like v_a || ' %') = 2,
    'salió un resumen antes de las 9 o en día inhábil';

  -- Un vendedor no corre los avisos a mano.
  perform pg_temp.como(v_a);
  begin perform avisos_leads(t); v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'un vendedor corrió avisos_leads';
  assert not exists (select 1 from avisos where tipo = 'leads_sin_atender_resumen'), 'un vendedor ve el resumen de dirección';
  perform pg_temp.como_postgres();

  -- =========================================================================
  -- 2. Por dónde salió la cotización
  -- =========================================================================
  insert into clientes (nombre, vendedor_id) values ('Granos 257', v_a) returning id into v_cli;
  insert into contactos (cliente_id, nombre, whatsapp, correo) values (v_cli, 'Rosa 257', '33 1234 5678', 'rosa@granos257.mx') returning id into v_con;
  perform pg_temp.como(v_a);
  c1 := nueva_cotizacion(v_cli);
  insert into cotizacion_lineas (cotizacion_id, titulo, precio_unitario) values (c1, 'Cribadora 257', 15000);   -- abajo del tope de partida libre (256): no pide autorización

  -- Sin canal no se envía; el número se guarda en dígitos.
  begin perform marcar_cotizacion_enviada(c1, null); v_ok := true; exception when check_violation then v_ok := false; end;
  assert not v_ok, 'se envió sin decir por dónde';
  begin perform marcar_cotizacion_enviada(c1, 'whatsapp', '33 12'); v_ok := true; exception when check_violation then v_ok := false; end;
  assert not v_ok, 'aceptó un número incompleto';
  assert (select estado from cotizaciones where id = c1) = 'borrador' and not exists (select 1 from cotizacion_envios where cotizacion_id = c1),
    'un envío rechazado dejó rastro';
  perform marcar_cotizacion_enviada(c1, 'whatsapp', '+52 (33) 1234-5678');
  assert (select estado from cotizaciones where id = c1) = 'enviada', 'no quedó enviada';
  select * into r from cotizacion_envios where cotizacion_id = c1;
  assert r.canal = 'whatsapp' and r.destino = '523312345678' and r.marco_enviada and r.usuario_id = v_a,
    format('envío por WhatsApp: %s', row_to_json(r));
  assert (select count(*) from cotizacion_envios where cotizacion_id = c1) = 1, 'el disparador duplicó la constancia';
  assert exists (select 1 from seguimientos_cotizacion s join cotizaciones c on c.oportunidad_id = s.oportunidad_id
                 where c.id = c1 and s.estado = 'pendiente'), 'enviar por aquí no agendó el seguimiento';

  -- Compartir otra vez queda anotado sin «marcar»; «solo marcar» una enviada no.
  perform marcar_cotizacion_enviada(c1, 'correo', 'rosa@granos257.mx');
  assert (select count(*) filter (where not marco_enviada and canal = 'correo') from cotizacion_envios where cotizacion_id = c1) = 1,
    'el reenvío no quedó';
  begin perform marcar_cotizacion_enviada(c1, 'solo_marcada'); v_ok := true; exception when raise_exception then v_ok := false; end;
  assert not v_ok, '«solo marcar» una que ya está enviada';

  -- En persona: sin destino. Sin tiempo de entrega no sale y no deja constancia.
  c2 := nueva_cotizacion(v_cli);
  insert into cotizacion_lineas (cotizacion_id, titulo, precio_unitario) values (c2, 'Tolva 257', 5000);
  update cotizaciones set tiempo_entrega = null where id = c2;
  begin perform marcar_cotizacion_enviada(c2, 'en_persona', 'lo que sea'); v_ok := true; exception when check_violation then v_ok := false; end;
  assert not v_ok and not exists (select 1 from cotizacion_envios where cotizacion_id = c2), 'se envió sin tiempo de entrega';
  update cotizaciones set tiempo_entrega = '20 días hábiles' where id = c2;
  perform marcar_cotizacion_enviada(c2, 'en_persona', 'lo que sea');
  assert (select canal = 'en_persona' and destino is null from cotizacion_envios where cotizacion_id = c2), 'en persona guardó destino';

  -- Por otro camino (cambio directo de estado): constancia «solo marcada», sin quién la mandó por dónde.
  c3 := nueva_cotizacion(v_cli);
  insert into cotizacion_lineas (cotizacion_id, titulo, precio_unitario) values (c3, 'Polea 257', 3000);
  update cotizaciones set estado = 'enviada' where id = c3;
  assert (select count(*) from cotizacion_envios where cotizacion_id = c3 and canal = 'solo_marcada' and marco_enviada) = 1,
    'el cambio directo no dejó constancia';

  -- Por correo (217): canal correo con los destinatarios, también al reenviar.
  perform correo_marcar_enviado('cotizacion', c3, array['rosa@granos257.mx', 'compras@granos257.mx']);
  assert exists (select 1 from cotizacion_envios where cotizacion_id = c3 and canal = 'correo'
                 and destino = 'rosa@granos257.mx, compras@granos257.mx' and not marco_enviada), 'el correo no dejó su canal';

  -- Nadie escribe ni borra la constancia a mano.
  begin insert into cotizacion_envios (cotizacion_id, canal) values (c2, 'whatsapp'); v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'el vendedor escribió una constancia a mano';
  begin update cotizacion_envios set canal = 'correo' where cotizacion_id = c2; v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'el vendedor cambió una constancia';
  begin delete from cotizacion_envios where cotizacion_id = c2; v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'el vendedor borró una constancia';

  -- Otro vendedor ni la ve ni la envía; recepción tampoco envía.
  perform pg_temp.como(v_b);
  assert not exists (select 1 from cotizacion_envios where cotizacion_id in (c1, c2, c3)), 'B ve los envíos de A';
  begin perform marcar_cotizacion_enviada(c1, 'whatsapp', '3312345678'); v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'B registró un envío en la cotización de A';
  perform pg_temp.como(v_rec);
  begin perform marcar_cotizacion_enviada(c1, 'whatsapp', '3312345678'); v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'recepción registró un envío';
  -- La gerencia (dirección) sí la ve.
  perform pg_temp.como(v_dir);
  assert (select count(*) from cotizacion_envios where cotizacion_id = c1) = 2, 'dirección no ve los envíos';

  -- =========================================================================
  -- 3. Pedido de maquinaria en producción sin anticipo
  -- =========================================================================
  perform pg_temp.como_postgres();
  insert into articulos (clave, tipo, nombre) values ('T257-BAN', 'equipo', 'Banda 257') returning id into v_eq;
  insert into articulos (clave, tipo, nombre) values ('T257-ROD', 'materia_prima', 'Rodillo 257') returning id into v_mp;
  insert into bom_lineas (padre_id, hijo_id, cantidad) values (v_eq, v_mp, 4);
  perform pg_temp.como(v_a);
  insert into pedidos (cliente_id, canal, condiciones_pago) values (v_cli, 'directo', '50% anticipo, 50% al aviso de la entrega.') returning id into v_ped;
  insert into pedidos (cliente_id, canal, condiciones_pago) values (v_cli, 'directo', '50% anticipo, 50% al aviso de la entrega.') returning id into v_ped2;
  insert into pedidos (cliente_id, canal, condiciones_pago) values (v_cli, 'directo', 'En una sola exhibición.') returning id into v_ped3;
  perform pg_temp.como_postgres();
  insert into pedido_lineas (pedido_id, articulo_id, titulo, cantidad, precio_unitario)
  select p, v_eq, 'Banda 257', 1, 120000 from unnest(array[v_ped, v_ped2, v_ped3]) p;
  insert into cobros (pedido_id, monto) values (v_ped2, 69600);

  -- Producción manda los tres al taller.
  perform pg_temp.como(v_gp);
  perform ordenes_desde_pedido(v_ped);
  perform ordenes_desde_pedido(v_ped2);
  perform ordenes_desde_pedido(v_ped3);
  perform pg_temp.como_postgres();
  assert (select estado from pedidos where id = v_ped) = 'en_produccion', 'el pedido no entró a producción';
  assert (select count(*) from avisos where tipo = 'pedido_sin_anticipo' and registro_id = v_ped::text and usuario_id in (v_fin, v_a)) = 2,
    'no avisó a finanzas y al vendedor';
  assert not exists (select 1 from avisos where tipo = 'pedido_sin_anticipo' and registro_id = v_ped::text and usuario_id in (v_gp, v_b, v_dir)),
    'el aviso le llegó a quien no le toca';
  assert not exists (select 1 from avisos where tipo = 'pedido_sin_anticipo' and registro_id in (v_ped2::text, v_ped3::text)),
    'avisó de un pedido con cobro o sin anticipo en sus condiciones';
  -- Una orden más del mismo pedido no repite el aviso (la base local tiene más gente de finanzas).
  select count(*) into v_n from avisos where tipo = 'pedido_sin_anticipo' and registro_id = v_ped::text;
  perform pg_temp.como(v_gp);
  v_op := crear_orden_produccion(v_eq, 1, (select id from pedido_lineas where pedido_id = v_ped));
  perform pg_temp.como_postgres();
  assert (select count(*) from avisos where tipo = 'pedido_sin_anticipo' and registro_id = v_ped::text) = v_n, 'repitió el aviso';

  -- Nadie lo dispara a mano.
  perform pg_temp.como(v_fin);
  begin perform avisar_pedido_sin_anticipo(v_ped2); v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'finanzas disparó el aviso a mano';
  perform pg_temp.como_postgres();
end $$;

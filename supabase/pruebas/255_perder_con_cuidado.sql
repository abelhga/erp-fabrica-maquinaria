-- Perder con cuidado: «No respondió» solo con 2 «No contestó» en días distintos o 10 días hábiles
-- desde el último envío (por «¿Qué pasó?», el tablero y «Marcar rechazada…», también la gerencia);
-- al tercer «Sigue en pie»/«No contestó» seguido se pide fecha con porqué; el canal no viene puesto.

-- Cotización enviada en una oportunidad nueva del cliente; regresa la oportunidad.
create function pg_temp.enviada255(p_cli uuid, p_op uuid default null) returns uuid
language plpgsql as $$
declare c uuid;
begin
  c := nueva_cotizacion(p_cli, p_op);
  insert into cotizacion_lineas (cotizacion_id, titulo, precio_unitario) values (c, 'Cribadora 255', 100000);
  update cotizaciones set estado = 'enviada' where id = c;
  return (select oportunidad_id from cotizaciones where id = c);
end $$;
-- Corre algo y regresa «sqlstate mensaje» si falló (lo de adentro se deshace), o null si pasó.
create function pg_temp.falla255(p_sql text) returns text
language plpgsql as $$
begin
  execute p_sql;
  return null;
exception when others then return sqlstate || ' ' || sqlerrm;
end $$;
grant execute on function pg_temp.enviada255(uuid, uuid), pg_temp.falla255(text) to public;

do $$
declare
  v_ven uuid; v_otro uuid; v_ger uuid; v_alm uuid; v_dir uuid; v_cli uuid; v_lead uuid;
  op1 uuid; op2 uuid; op3 uuid; op4 uuid; op5 uuid; op6 uuid; op7 uuid; op8 uuid; op9 uuid; op10 uuid;
  c uuid; e jsonb; v_err text; d date;
  perder text := 'select registrar_seguimiento(%L, ''perdida'', ''Ya no contesta'', ''llamada'', null, %L)';
begin
  v_ven := pg_temp.usuario('ven255@hegamex.com', '{ventas}');
  v_otro := pg_temp.usuario('otro255@hegamex.com', '{ventas}');
  v_ger := pg_temp.usuario('ger255@hegamex.com', '{gerente_ventas}');
  v_alm := pg_temp.usuario('alm255@hegamex.com', '{almacen}');
  v_dir := pg_temp.usuario('dir255@hegamex.com', '{direccion}');
  insert into clientes (nombre, vendedor_id) values ('Agregados 255', v_ven) returning id into v_cli;

  -- El motivo «no respondió», escrito como sea.
  assert es_motivo_sin_respuesta('No respondió') and es_motivo_sin_respuesta('no contesta')
    and es_motivo_sin_respuesta('Sin respuesta del cliente') and es_motivo_sin_respuesta('Dejó de contestar')
    and es_motivo_sin_respuesta('Nunca regresó la llamada'), 'no reconoció un «no respondió»';
  assert not es_motivo_sin_respuesta('Compró con la competencia') and not es_motivo_sin_respuesta('Precio más alto que la competencia')
    and not es_motivo_sin_respuesta(null), 'tomó como «no respondió» un motivo que dio el cliente';

  perform pg_temp.como(v_ven);
  op1 := pg_temp.enviada255(v_cli);

  -- (c) 1-2. Sin canal, o con uno que no existe, no se anota nada.
  v_err := pg_temp.falla255(format('select registrar_seguimiento(%L, ''sigue'', ''Lo está revisando'')', op1));
  assert v_err like '23514 Elige por dónde fue%', 'anotó sin canal: ' || coalesce(v_err, 'pasó');
  v_err := pg_temp.falla255(format('select registrar_seguimiento(%L, ''sigue'', ''Lo está revisando'', ''fax'')', op1));
  assert v_err like '23514 Elige por dónde fue%', 'anotó con canal fax: ' || coalesce(v_err, 'pasó');
  assert exists (select 1 from seguimientos_cotizacion where oportunidad_id = op1 and estado = 'pendiente')
    and not exists (select 1 from actividades where oportunidad_id = op1), 'sin canal quedó algo a medias';

  -- (c) 3. En Leads tampoco hay canal por omisión.
  perform pg_temp.como(v_dir);
  perform fijar_config_leads('recepcion', 2, 24, array[v_ven]);
  insert into leads (nombre, telefono, interes, vendedor_id) values ('Rosa 255', '5551112255', 'Tolva', v_ven) returning id into v_lead;
  perform pg_temp.como(v_ven);
  v_err := pg_temp.falla255(format('select registrar_intento_lead(%L, null, ''no_contesto'')', v_lead));
  assert v_err like '23514 Elige por dónde fue%', 'el intento sin canal no dio el mensaje claro: ' || coalesce(v_err, 'pasó');
  assert not exists (select 1 from lead_intentos where lead_id = v_lead), 'se anotó un intento sin canal';

  -- (a) 4. Recién enviada: «No respondió» no entra, y dice qué falta y cuándo se cumple.
  v_err := pg_temp.falla255(format(perder, op1, 'No respondió'));
  assert v_err like '23514 %hacen falta 2 «No contestó»%'
    and v_err like '%se cumplen el ' || fecha_texto(sumar_dias_laborables(hoy_mx(), 10)) || '%', 'perdió recién enviada: ' || coalesce(v_err, 'pasó');
  assert (select etapa from oportunidades where id = op1) = 'cotizado'
    and (select estado from cotizaciones where oportunidad_id = op1) = 'enviada'
    and exists (select 1 from seguimientos_cotizacion where oportunidad_id = op1 and estado = 'pendiente')
    and not exists (select 1 from actividades where oportunidad_id = op1 and descripcion like 'Se perdió%'), 'el rechazo dejó algo a medias';

  -- 5. Escrito a mano tampoco.
  assert pg_temp.falla255(format(perder, op1, 'no contesta')) like '23514 %hacen falta%', 'pasó «no contesta» escrito a mano';
  assert pg_temp.falla255(format(perder, op1, 'Sin respuesta del cliente')) like '23514 %hacen falta%', 'pasó «sin respuesta» escrito a mano';

  -- 6. Con un motivo que dio el cliente, sí.
  op2 := pg_temp.enviada255(v_cli);
  perform registrar_seguimiento(op2, 'perdida', 'Le salió más barato', 'whatsapp', null, 'Compró con la competencia');
  assert (select etapa = 'perdida' and motivo_perdida = 'Compró con la competencia' from oportunidades where id = op2)
    and (select estado from cotizaciones where oportunidad_id = op2) = 'rechazada', 'no dejó perder con un motivo del cliente';

  -- 7. La gerencia tampoco se la salta.
  perform pg_temp.como(v_ger);
  assert pg_temp.falla255(format(perder, op1, 'No respondió')) like '23514 %hacen falta%', 'la gerencia perdió sin insistir';

  -- 8. Las puertas de al lado: arrastrar la tarjeta y «Marcar rechazada…».
  perform pg_temp.como(v_ven);
  v_err := pg_temp.falla255(format('update oportunidades set etapa = ''perdida'', motivo_perdida = ''No respondió'' where id = %L', op1));
  assert v_err like '23514 %hacen falta%', 'arrastrar a Perdida se saltó la regla: ' || coalesce(v_err, 'pasó');
  c := (select id from cotizaciones where oportunidad_id = op1);
  assert pg_temp.falla255(format('select rechazar_cotizacion(%L, ''No respondió'', false)', c)) like '23514 %hacen falta%', 'rechazar sin cerrar se la saltó';
  assert pg_temp.falla255(format('select rechazar_cotizacion(%L, ''No respondió'', true)', c)) like '23514 %hacen falta%', 'rechazar y cerrar se la saltó';
  assert (select estado from cotizaciones where id = c) = 'enviada' and (select etapa from oportunidades where id = op1) = 'cotizado', 'el rechazo bloqueado cambió algo';
  op3 := pg_temp.enviada255(v_cli);
  perform rechazar_cotizacion((select id from cotizaciones where oportunidad_id = op3), 'Precio más alto que la competencia', true);
  assert (select etapa from oportunidades where id = op3) = 'perdida', 'rechazar con motivo del cliente no la cerró';

  -- 9. Lo que ve la pantalla.
  e := estado_seguimiento(op1);
  assert not (e->>'puede_sin_respuesta')::boolean and (e->>'no_contesto')::int = 0 and not (e->>'decidir')::boolean
    and (e->>'sin_respuesta_desde')::date = sumar_dias_laborables(hoy_mx(), 10), 'estado_seguimiento: ' || e::text;

  -- 10. Este rol NO debe poder: otro vendedor ni almacén ven el estado ni anotan.
  perform pg_temp.como(v_otro);
  assert pg_temp.falla255(format('select estado_seguimiento(%L)', op1)) like '42501%', 'otro vendedor vio el estado';
  assert pg_temp.falla255(format(perder, op1, 'Precio')) like '42501%', 'otro vendedor anotó la pérdida';
  perform pg_temp.como(v_alm);
  assert pg_temp.falla255(format('select estado_seguimiento(%L)', op1)) like '42501%', 'almacén vio el estado';
  assert pg_temp.falla255('select _estado_seguimiento(gen_random_uuid())') like '42501%', 'la función interna quedó abierta';

  -- 11. Dos «No contestó» el mismo día cuentan como uno.
  perform pg_temp.como(v_ven);
  perform registrar_seguimiento(op1, 'no_contesta', null, 'llamada');
  perform registrar_seguimiento(op1, 'no_contesta', null, 'llamada');
  assert (estado_seguimiento(op1)->>'no_contesto')::int = 1, 'contó dos veces el mismo día';
  assert pg_temp.falla255(format(perder, op1, 'No respondió')) like '23514 %lleva 1)%', 'perdió con dos «No contestó» del mismo día';

  -- 12. En días distintos, sí.
  perform pg_temp.como_postgres();
  update seguimientos_cotizacion set cerrado_en = cerrado_en - interval '1 day'
  where id = (select id from seguimientos_cotizacion where oportunidad_id = op1 and estado = 'hecho' order by id limit 1);
  perform pg_temp.como(v_ven);
  e := estado_seguimiento(op1);
  assert (e->>'no_contesto')::int = 2 and (e->>'puede_sin_respuesta')::boolean, 'no contó los dos días: ' || e::text;
  perform registrar_seguimiento(op1, 'perdida', 'Le marqué tres veces', 'llamada', null, 'No respondió');
  assert (select etapa = 'perdida' and motivo_perdida = 'No respondió' from oportunidades where id = op1)
    and (select estado = 'rechazada' and motivo_rechazo = 'No respondió' from cotizaciones where oportunidad_id = op1)
    and exists (select 1 from actividades where oportunidad_id = op1 and descripcion = 'Se perdió (No respondió): Le marqué tres veces'),
    'con dos «No contestó» no quedó perdida';

  -- 13. Por días hábiles desde el envío.
  op4 := pg_temp.enviada255(v_cli);
  op5 := pg_temp.enviada255(v_cli);
  op6 := pg_temp.enviada255(v_cli);
  op7 := pg_temp.enviada255(v_cli);
  perform pg_temp.como_postgres();
  update cotizaciones set enviada_en = now() - interval '20 days' where oportunidad_id = op4;
  update cotizaciones set enviada_en = now() - interval '5 days' where oportunidad_id = op5;
  select max(x::date) into d from generate_series(hoy_mx() - 40, hoy_mx(), interval '1 day') x where sumar_dias_laborables(x::date, 10) <= hoy_mx();
  update cotizaciones set enviada_en = (d + time '12:00') at time zone 'America/Mexico_City' where oportunidad_id = op6;
  update cotizaciones set enviada_en = (d + 1 + time '12:00') at time zone 'America/Mexico_City' where oportunidad_id = op7;
  perform pg_temp.como(v_ven);
  assert sumar_dias_laborables(d, 10) = hoy_mx() and sumar_dias_laborables(d + 1, 10) > hoy_mx(), 'la frontera no quedó donde debía';
  assert (estado_seguimiento(op6)->>'puede_sin_respuesta')::boolean, 'justo a los 10 días hábiles no dejó';
  assert not (estado_seguimiento(op7)->>'puede_sin_respuesta')::boolean, 'a 9 días hábiles dejó';
  assert pg_temp.falla255(format(perder, op5, 'No respondió')) like '23514 %hacen falta%', 'a 5 días naturales dejó perder';
  perform registrar_seguimiento(op4, 'perdida', 'Nunca regresó', 'llamada', null, 'No respondió');
  assert (select etapa from oportunidades where id = op4) = 'perdida', 'a 20 días no dejó perder';

  -- 14. Otra versión enviada reinicia el reloj.
  op8 := pg_temp.enviada255(v_cli);
  perform pg_temp.como_postgres();
  update cotizaciones set enviada_en = now() - interval '20 days' where oportunidad_id = op8;
  perform pg_temp.como(v_ven);
  assert (estado_seguimiento(op8)->>'puede_sin_respuesta')::boolean, 'a 20 días no dejaba';
  perform pg_temp.enviada255(v_cli, op8);
  assert pg_temp.falla255(format(perder, op8, 'No respondió')) like '23514 %hacen falta%', 'la versión nueva no reinició el reloj';

  -- 15. Las cargas sin sesión no se frenan.
  perform pg_temp.como_postgres();
  update oportunidades set etapa = 'perdida', motivo_perdida = 'No respondió' where id = op5;
  assert (select etapa from oportunidades where id = op5) = 'perdida', 'frenó una carga sin sesión';

  -- (b) 16. Dos seguidos sin avance después del envío: el siguiente pide decidir.
  perform pg_temp.como(v_ven);
  op9 := pg_temp.enviada255(v_cli);
  perform pg_temp.como_postgres();
  update cotizaciones set enviada_en = now() - interval '3 days' where oportunidad_id = op9;
  insert into seguimientos_cotizacion (oportunidad_id, vendedor_id, vence, estado, resultado, que_paso, creado_en, cerrado_en) values
    (op9, v_ven, hoy_mx() - 2, 'hecho', 'sigue', 'Lo está viendo', now() - interval '3 days', now() - interval '2 days'),
    (op9, v_ven, hoy_mx() - 1, 'hecho', 'no_contesta', 'No contestó', now() - interval '2 days', now() - interval '1 day');
  perform pg_temp.como(v_ven);
  e := estado_seguimiento(op9);
  assert (e->>'racha')::int = 2 and (e->>'decidir')::boolean, 'no vio la racha: ' || e::text;

  -- 17. Sin fecha o sin porqué no; con las dos, sí, y queda el porqué.
  v_err := pg_temp.falla255(format('select registrar_seguimiento(%L, ''sigue'', ''Lo sigue viendo'', ''llamada'')', op9));
  assert v_err like '23514 %Ya van 3 seguimientos seguidos sin avance%', 'tercer «sigue» sin fecha: ' || coalesce(v_err, 'pasó');
  v_err := pg_temp.falla255(format('select registrar_seguimiento(%L, ''sigue'', ''Lo sigue viendo'', ''llamada'', %L)', op9, hoy_mx() + 30));
  assert v_err like '23514 %Ya van 3%', 'tercer «sigue» sin porqué: ' || coalesce(v_err, 'pasó');
  perform registrar_seguimiento(op9, 'sigue', 'Lo sigue viendo', 'llamada', hoy_mx() + 30, 'Decide en enero');
  assert (select vence from seguimientos_cotizacion where oportunidad_id = op9 and estado = 'pendiente') = hoy_mx() + 30, 'no respetó la fecha';
  assert (select motivo_fecha from seguimientos_cotizacion where oportunidad_id = op9 and estado = 'hecho' order by cerrado_en desc limit 1) = 'Decide en enero',
    'no quedó el porqué de la fecha';
  assert exists (select 1 from actividades where oportunidad_id = op9 and descripcion like 'Lo sigue viendo · Nueva fecha %: Decide en enero'),
    'la bitácora no dice la fecha y su porqué';

  -- 18. El cuarto también lo pide.
  assert pg_temp.falla255(format('select registrar_seguimiento(%L, ''no_contesta'', null, ''llamada'')', op9)) like '23514 %Ya van 4%', 'el cuarto no pidió decidir';

  -- 19. Negociación en plena racha pasa sin porqué, y la racha se reinicia.
  perform registrar_seguimiento(op9, 'negociacion', 'Pide 5 % por pago de contado', 'llamada');
  assert (select etapa from oportunidades where id = op9) = 'negociacion' and not (estado_seguimiento(op9)->>'decidir')::boolean,
    'Negociación no reinició la racha';

  -- 20. Otra versión enviada también la reinicia.
  op10 := pg_temp.enviada255(v_cli);
  perform pg_temp.como_postgres();
  update cotizaciones set enviada_en = now() - interval '3 days' where oportunidad_id = op10;
  insert into seguimientos_cotizacion (oportunidad_id, vendedor_id, vence, estado, resultado, que_paso, creado_en, cerrado_en) values
    (op10, v_ven, hoy_mx() - 2, 'hecho', 'sigue', 'Lo está viendo', now() - interval '3 days', now() - interval '2 days'),
    (op10, v_ven, hoy_mx() - 1, 'hecho', 'sigue', 'Sigue viéndolo', now() - interval '2 days', now() - interval '1 day');
  perform pg_temp.como(v_ven);
  assert (estado_seguimiento(op10)->>'decidir')::boolean, 'la racha no estaba';
  perform pg_temp.enviada255(v_cli, op10);
  assert not (estado_seguimiento(op10)->>'decidir')::boolean, 'otra versión enviada no reinició la racha';
end $$;

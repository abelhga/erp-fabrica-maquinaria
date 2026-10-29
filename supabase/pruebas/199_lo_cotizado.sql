-- Lo cotizado: cada cotización cuenta una vez con todas sus versiones (monto de la última, sin
-- IVA, en pesos) y cae en ganada, perdida (con su motivo), abierta (según qué hace falta) o sin
-- enviar. El vendedor ve lo suyo; la gerencia, todo y por vendedor; quien no vende, nada.
do $$
declare
  v_ven uuid; v_otro uuid; v_ger uuid; v_fin uuid; v_cli uuid;
  c_gana uuid; c_pierde uuid; c_atrasa uuid; c_negocia uuid; c_borrador uuid; c_usd uuid; c_v1 uuid; c_v2 uuid; c_ajena uuid;
  d date := hoy_mx() - 30; h date := hoy_mx();
  r jsonb; g jsonb; v_ok boolean;
begin
  v_ven := pg_temp.usuario('ven199@hegamex.com', '{ventas}');
  v_otro := pg_temp.usuario('otro199@hegamex.com', '{ventas}');
  v_ger := pg_temp.usuario('ger199@hegamex.com', '{gerente_ventas}');
  v_fin := pg_temp.usuario('fin199@hegamex.com', '{finanzas}');
  insert into clientes (nombre, vendedor_id) values ('Concretos 199', v_ven) returning id into v_cli;

  perform pg_temp.como(v_ven);
  -- Ganada: se volvió pedido. $10,000 sin IVA.
  c_gana := nueva_cotizacion(v_cli);
  insert into cotizacion_lineas (cotizacion_id, titulo, precio_unitario) values (c_gana, 'Banda 199', 10000);
  update cotizaciones set estado = 'enviada' where id = c_gana;
  perform convertir_a_pedido(c_gana);
  -- Perdida por precio. $5,000.
  c_pierde := nueva_cotizacion(v_cli);
  insert into cotizacion_lineas (cotizacion_id, titulo, precio_unitario) values (c_pierde, 'Tolva 199', 5000);
  update cotizaciones set estado = 'enviada' where id = c_pierde;
  perform rechazar_cotizacion(c_pierde, 'Precio más alto que la competencia');
  -- Abierta con el seguimiento atrasado. $3,000.
  c_atrasa := nueva_cotizacion(v_cli);
  insert into cotizacion_lineas (cotizacion_id, titulo, precio_unitario) values (c_atrasa, 'Polea 199', 3000);
  update cotizaciones set estado = 'enviada' where id = c_atrasa;
  -- Abierta y negociando (lo dijo el vendedor al anotar qué pasó). $2,000.
  c_negocia := nueva_cotizacion(v_cli);
  insert into cotizacion_lineas (cotizacion_id, titulo, precio_unitario) values (c_negocia, 'Cribadora 199', 2000);
  update cotizaciones set estado = 'enviada' where id = c_negocia;
  perform registrar_seguimiento((select oportunidad_id from cotizaciones where id = c_negocia), 'negociacion', 'Pide 5 % menos');
  -- Sin enviar. $1,000.
  c_borrador := nueva_cotizacion(v_cli);
  insert into cotizacion_lineas (cotizacion_id, titulo, precio_unitario) values (c_borrador, 'Catarina 199', 1000);
  -- En dólares y con la vigencia vencida: 100 × 18 = $1,800.
  c_usd := nueva_cotizacion(v_cli);
  update cotizaciones set moneda = 'USD', tipo_cambio = 18, fecha = hoy_mx() - 10, vigencia_dias = 5 where id = c_usd;
  insert into cotizacion_lineas (cotizacion_id, titulo, precio_unitario) values (c_usd, 'Motor 199', 100);
  update cotizaciones set estado = 'enviada' where id = c_usd;
  -- Dos versiones de la misma: cuenta una vez, con el monto de la última ($4,500).
  c_v1 := nueva_cotizacion(v_cli);
  insert into cotizacion_lineas (cotizacion_id, titulo, precio_unitario) values (c_v1, 'Silo 199', 4000);
  update cotizaciones set estado = 'enviada' where id = c_v1;
  c_v2 := nueva_version_cotizacion(c_v1);
  update cotizacion_lineas set precio_unitario = 4500 where cotizacion_id = c_v2;
  update cotizaciones set estado = 'enviada' where id = c_v2;
  -- La de otro vendedor.
  perform pg_temp.como(v_otro);
  c_ajena := nueva_cotizacion(v_cli);
  insert into cotizacion_lineas (cotizacion_id, titulo, precio_unitario) values (c_ajena, 'Elevador 199', 7000);
  update cotizaciones set estado = 'enviada' where id = c_ajena;
  perform pg_temp.como_postgres();
  update seguimientos_cotizacion set vence = hoy_mx() - 2
  where oportunidad_id = (select oportunidad_id from cotizaciones where id = c_atrasa) and estado = 'pendiente';

  -- 1. El vendedor: solo lo suyo, una vez por cotización, sin IVA y en pesos.
  perform pg_temp.como(v_ven);
  r := lo_cotizado(d, h);
  assert (r#>>'{totales,cotizado,cotizaciones}')::int = 7, format('cotizaciones: %s', r->'totales');
  assert (r#>>'{totales,cotizado,monto}')::numeric = 27300, format('cotizado: %s', r->'totales');
  assert (r#>>'{totales,sin_enviar,monto}')::numeric = 1000 and (r#>>'{totales,enviada,monto}')::numeric = 26300, format('enviado: %s', r->'totales');
  assert (r#>>'{totales,ganada,monto}')::numeric = 10000, format('ganado: %s', r->'totales');
  assert (r#>>'{totales,perdida,monto}')::numeric = 5000, format('perdido: %s', r->'totales');
  assert (r#>>'{totales,abierta,monto}')::numeric = 11300, format('abierto: %s', r->'totales');
  assert (r#>>'{tasa_cierre,monto}')::numeric = round(10000 / 15000.0, 4), format('tasa de cierre: %s', r->'tasa_cierre');
  assert not exists (select 1 from jsonb_array_elements(r->'cotizaciones') x where x->>'id' = c_ajena::text), 'el vendedor vio la cotización de otro';

  -- 2. Por qué se perdió y qué le falta a lo abierto.
  select jsonb_object_agg(x->>'subgrupo', (x->>'monto')::numeric) into g from jsonb_array_elements(r->'nodos') x;
  assert (g->>'Precio más alto que la competencia')::numeric = 5000, format('motivo: %s', g);
  assert (g->>'Seguimiento atrasado')::numeric = 3000, format('atrasado: %s', g);
  assert (g->>'Negociando')::numeric = 2000, format('negociando: %s', g);
  assert (g->>'Vigencia vencida')::numeric = 1800, format('vencida y en dólares: %s', g);
  assert (g->>'Esperando respuesta')::numeric = 4500, format('versiones: %s', g);
  assert (g->>'Borrador')::numeric = 1000, format('borrador: %s', g);
  assert (select (x->>'versiones')::int = 2 and (x->>'id')::uuid = c_v2 from jsonb_array_elements(r->'cotizaciones') x where x->>'folio' = (select folio from cotizaciones where id = c_v2)),
    'la cotización con dos versiones no trae la última';

  -- 3. La gerencia ve todo y puede ver a un vendedor; finanzas (ventas sin capturar), nada.
  perform pg_temp.como(v_ger);
  r := lo_cotizado(d, h);
  assert exists (select 1 from jsonb_array_elements(r->'cotizaciones') x where x->>'id' = c_ajena::text), 'la gerencia no ve las de todos';
  assert (select count(*) from jsonb_array_elements(r->'vendedores') x where (x->>'id')::uuid in (v_ven, v_otro)) = 2, 'faltan vendedores en la lista';
  assert (lo_cotizado(d, h, v_ven)#>>'{totales,cotizado,monto}')::numeric = 27300, 'el filtro por vendedor no cuadra';
  perform pg_temp.como(v_fin);
  begin perform lo_cotizado(d, h); v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'finanzas vio lo cotizado';
  perform pg_temp.como_postgres();
end $$;

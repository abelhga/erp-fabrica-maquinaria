-- Seguimientos repartidos: los plazos se abren (3, 5 y 10 días hábiles), la fecha escrita a mano se
-- respeta, un vendedor no recibe más del tope el mismo día (la cotización grande conserva su día) y la
-- gerencia puede reacomodar lo atrasado. Un vendedor no reparte; otro vendedor no se ve afectado.

-- Esta prueba no es de partidas libres (256): sus partidas sin artículo pedirían autorización.
update configuracion set valor = valor || '{"desde": "2999-01-01"}' where clave = 'partidas_libres';
-- Tope chico para no crear 15 cotizaciones por día; el freno no es de esta prueba.
update configuracion set valor = valor || '{"maximo_por_dia": 3, "freno_activo": false}' where clave = 'seguimiento_cotizaciones';

create function pg_temp.cotiza(p_cli uuid, p_monto numeric) returns uuid language plpgsql as $$
declare c uuid;
begin
  c := nueva_cotizacion(p_cli);
  insert into cotizacion_lineas (cotizacion_id, titulo, precio_unitario) values (c, 'Equipo 299', p_monto);
  update cotizaciones set estado = 'enviada' where id = c;
  return (select oportunidad_id from cotizaciones where id = c);
end $$;
grant execute on function pg_temp.cotiza(uuid, numeric) to public;
create function pg_temp.vence(p_op uuid) returns date language sql as $$
  select vence from seguimientos_cotizacion where oportunidad_id = p_op and estado = 'pendiente' $$;
grant execute on function pg_temp.vence(uuid) to public;

do $$
declare v_ven uuid; v_otro uuid; v_ger uuid; v_cli uuid; v_cli2 uuid;
  o1 uuid; o2 uuid; o3 uuid; o4 uuid; o5 uuid; o6 uuid; ob uuid; ops uuid[] := '{}';
  d3 date := sumar_dias_laborables(hoy_mx(), 3); d4 date := sumar_dias_laborables(hoy_mx(), 4);
  hoy date := hoy_mx(); v_hab date := sumar_dias_laborables(hoy_mx() - 1, 1);
  v_ok boolean; v_n int; j jsonb; i int; r record;
begin
  v_ven := pg_temp.usuario('ven299@hegamex.com', '{ventas}');
  v_otro := pg_temp.usuario('otro299@hegamex.com', '{ventas}');
  v_ger := pg_temp.usuario('ger299@hegamex.com', '{gerente_ventas}');
  insert into clientes (nombre, vendedor_id) values ('Agregados 299', v_ven) returning id into v_cli;
  insert into clientes (nombre, vendedor_id) values ('Otro 299', v_otro) returning id into v_cli2;

  -- 1. Plazos: al enviar, 3 días hábiles; después del primero anotado, 5; después del segundo, 10.
  perform pg_temp.como(v_ven);
  o1 := pg_temp.cotiza(v_cli, 100000);
  assert pg_temp.vence(o1) = d3, format('el primero no quedó a 3 días hábiles: %s', pg_temp.vence(o1));
  assert (estado_seguimiento(o1)->>'dias_siguiente')::int = 5, 'la pantalla debe anunciar 5 días para el que sigue al primero';
  perform registrar_seguimiento(o1, 'sigue', 'Lo está viendo con su socio', 'llamada');
  assert pg_temp.vence(o1) = sumar_dias_laborables(hoy, 5), format('después del primero no quedó a 5: %s', pg_temp.vence(o1));
  assert (estado_seguimiento(o1)->>'dias_siguiente')::int = 10, 'después del primero, la pantalla debe anunciar 10';
  perform registrar_seguimiento(o1, 'no_contesta', null, 'llamada');
  assert pg_temp.vence(o1) = sumar_dias_laborables(hoy, 10), format('después del segundo no quedó a 10 (también si no contestó): %s', pg_temp.vence(o1));
  assert not (select fecha_fija from seguimientos_cotizacion where oportunidad_id = o1 and estado = 'pendiente'), 'un plazo no es fecha fija';
  --    La fecha que escribe el vendedor se respeta y queda fija.
  perform registrar_seguimiento(o1, 'sigue', 'Me pidió buscarlo en dos meses', 'llamada', hoy + 60, 'Su obra arranca en enero');
  assert pg_temp.vence(o1) = hoy + 60 and (select fecha_fija from seguimientos_cotizacion where oportunidad_id = o1 and estado = 'pendiente'),
    'la fecha escrita a mano no se respetó o no quedó fija';

  -- 2. Tope por día (3 en esta prueba): el cuarto del mismo día, más chico, pasa al siguiente día hábil.
  o2 := pg_temp.cotiza(v_cli, 200000);
  o3 := pg_temp.cotiza(v_cli, 300000);
  o4 := pg_temp.cotiza(v_cli, 150000);
  assert pg_temp.vence(o2) = d3 and pg_temp.vence(o3) = d3 and pg_temp.vence(o4) = d3, 'los tres primeros caben el mismo día';
  o5 := pg_temp.cotiza(v_cli, 50000);
  assert pg_temp.vence(o5) = d4, format('el cuarto, más chico, debía pasar al siguiente día hábil: %s', pg_temp.vence(o5));
  --    Uno más grande conserva el día y recorre al más chico de ese día.
  o6 := pg_temp.cotiza(v_cli, 900000);
  assert pg_temp.vence(o6) = d3, format('la cotización grande no conservó su día: %s', pg_temp.vence(o6));
  assert pg_temp.vence(o4) = d4, format('la más chica del día (150 mil) debía recorrerse: %s', pg_temp.vence(o4));
  assert pg_temp.vence(o2) = d3 and pg_temp.vence(o3) = d3, 'se movió una que no era la más chica';
  select count(*) into v_n from seguimientos_cotizacion where vendedor_id = v_ven and estado = 'pendiente' and vence = d3;
  assert v_n = 3, format('el día quedó con %s (tope 3)', v_n);
  --    Otro vendedor tiene su propio tope: su día no está lleno.
  perform pg_temp.como(v_otro);
  ob := pg_temp.cotiza(v_cli2, 10000);
  assert pg_temp.vence(ob) = d3, 'el tope de un vendedor recorrió el seguimiento de otro';
  --    Una fecha escrita a mano entra aunque el día esté lleno.
  perform pg_temp.como(v_ven);
  perform registrar_seguimiento(o5, 'sigue', 'Que le marque ese día', 'llamada', d3, null);
  assert pg_temp.vence(o5) = d3, 'la fecha a mano no entró en un día lleno';
  --    …y nunca es la que se recorre, aunque sea la más chica: llega otra grande y se va la de 200 mil.
  o1 := pg_temp.cotiza(v_cli, 950000);
  assert pg_temp.vence(o5) = d3, 'se recorrió una fecha fija';
  assert pg_temp.vence(o2) <> d3, 'debía recorrerse la más chica sin fecha fija (200 mil)';

  -- 3. Reacomodo. Se atrasan todos los de este vendedor que no tienen fecha fija.
  perform pg_temp.como_postgres();
  update seguimientos_cotizacion set vence = hoy - 5
  where vendedor_id = v_ven and estado = 'pendiente' and not fecha_fija;
  select count(*) into v_n from seguimientos_cotizacion where vendedor_id = v_ven and estado = 'pendiente' and vence < hoy;
  assert v_n = 5, format('se esperaban 5 atrasados, hay %s', v_n);
  --    Un vendedor no reparte, ni lo suyo.
  perform pg_temp.como(v_ven);
  begin perform repartir_seguimientos(v_ven); v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'un vendedor repartió seguimientos';
  --    La gerencia sí: 5 atrasados a 3 por día desde el primer día hábil, primero los montos grandes.
  perform pg_temp.como(v_ger);
  j := repartir_seguimientos(v_ven);
  assert (j->>'repartidos')::int = 5 and (j->>'movidos')::int = 5 and (j->>'por_dia')::int = 3, format('reparto: %s', j);
  perform pg_temp.como_postgres();
  assert not exists (select 1 from seguimientos_cotizacion where vendedor_id = v_ven and estado = 'pendiente' and vence < hoy), 'quedaron vencidos';
  assert not exists (select 1 from seguimientos_cotizacion where vendedor_id = v_ven and estado = 'pendiente' group by vence having count(*) > 3),
    'un día quedó con más del tope';
  --    Los tres más grandes de los repartidos (950, 900 y 300 mil) van el primer día.
  select count(*) into v_n from seguimientos_cotizacion s join cotizaciones c on c.id = s.cotizacion_id
  where s.vendedor_id = v_ven and s.estado = 'pendiente' and not s.fecha_fija and s.vence = v_hab and c.subtotal >= 300000;
  assert v_n = 3, format('los tres más grandes no quedaron el primer día (%s)', v_n);
  assert (j->>'del')::date = v_hab and (j->>'al')::date = sumar_dias_laborables(v_hab, 1), format('fechas del reparto: %s', j);
  --    Las fechas fijas no se movieron (la de dos meses y la que pidió ese día), ni las del otro vendedor.
  assert pg_temp.vence(o5) = d3, 'el reparto movió una fecha fija';
  assert exists (select 1 from seguimientos_cotizacion where vendedor_id = v_ven and estado = 'pendiente' and vence = hoy + 60), 'el reparto movió la de dos meses';
  assert pg_temp.vence(ob) = d3, 'el reparto movió el seguimiento de otro vendedor';
  --    Al vendedor le llega el aviso.
  assert exists (select 1 from avisos where usuario_id = v_ven and tipo = 'seguimientos_repartidos'), 'no se le avisó al vendedor';
  --    Repartir otra vez no mueve nada.
  perform pg_temp.como(v_ger);
  j := repartir_seguimientos(v_ven);
  assert (j->>'movidos')::int = 0, format('el segundo reparto movió %s', j->>'movidos');

  -- 4. Sin tope (0) todo cae en su plazo, como antes.
  perform pg_temp.como_postgres();
  update configuracion set valor = valor || '{"maximo_por_dia": 0}' where clave = 'seguimiento_cotizaciones';
  perform pg_temp.como(v_otro);
  for i in 1..5 loop ops := ops || pg_temp.cotiza(v_cli2, 1000 * i); end loop;
  select count(*) into v_n from seguimientos_cotizacion where vendedor_id = v_otro and estado = 'pendiente' and vence = d3;
  assert v_n = 6, format('sin tope debían caer los 6 el mismo día: %s', v_n);
end $$;

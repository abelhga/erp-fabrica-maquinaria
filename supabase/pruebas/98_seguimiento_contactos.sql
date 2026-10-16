-- Seguimiento de "A quién llamar hoy": los intentos quedan registrados y los ven
-- todos los vendedores (solo el intento), la cadencia marca el siguiente paso, los
-- resultados sacan al cliente de la lista 90 días o crean la oportunidad, y nadie
-- registra intentos sobre clientes de otro vendedor.
do $$
declare
  v_isaac uuid; v_juan uuid; v_fin uuid; v_libre uuid; v_dejuan uuid; v_otro uuid;
  v_int uuid; v_op uuid; s record; v_estado text;
begin
  v_isaac := pg_temp.usuario('isaac98@hegamex.com', '{ventas}');
  v_juan := pg_temp.usuario('juan98@hegamex.com', '{ventas}');
  v_fin := pg_temp.usuario('fin98@hegamex.com', '{finanzas}');
  insert into clientes (nombre) values ('T98 Concretos Libres') returning id into v_libre;
  insert into clientes (nombre, vendedor_id) values ('T98 Granos de Juan', v_juan) returning id into v_dejuan;
  insert into clientes (nombre) values ('T98 Otro Libre') returning id into v_otro;

  -- Isaac le escribe a un cliente libre: queda el intento y el siguiente paso es llamar.
  perform pg_temp.como(v_isaac);
  v_int := registrar_intento(v_libre, 'whatsapp', 'reactivar');
  select * into s from v_seguimiento_clientes where cliente_id = v_libre;
  assert s.estado = 'seguimiento' and s.intentos = 1 and s.siguiente = 'llamar' and s.siguiente_el = hoy_planta() + 3
    and s.ultimo_canal = 'whatsapp', format('primer intento: %s', row_to_json(s));

  -- Juan ve que Isaac ya le escribió (quién y cuándo), aunque no sea su intento.
  perform pg_temp.como(v_juan);
  select * into s from v_seguimiento_clientes where cliente_id = v_libre;
  assert s.ultimo_usuario = v_isaac and s.intentos = 1, format('juan no ve el intento de isaac: %s', row_to_json(s));
  -- Pero no puede deshacer el intento de Isaac.
  begin
    perform deshacer_intento(v_int);
    v_estado := 'deshizo';
  exception when insufficient_privilege then v_estado := 'negado';
  end;
  assert v_estado = 'negado', 'juan deshizo un intento de isaac';

  -- Isaac no registra intentos sobre clientes de Juan.
  perform pg_temp.como(v_isaac);
  begin
    perform registrar_intento(v_dejuan, 'llamada');
    v_estado := 'registró';
  exception when insufficient_privilege then v_estado := 'negado';
  end;
  assert v_estado = 'negado', 'isaac registró un intento sobre un cliente de juan';

  -- Tercer intento: el siguiente paso es esperar respuesta una semana.
  perform registrar_intento(v_libre, 'llamada', 'reactivar');
  perform registrar_intento(v_libre, 'whatsapp', 'reactivar');
  select * into s from v_seguimiento_clientes where cliente_id = v_libre;
  assert s.intentos = 3 and s.siguiente = 'esperar' and s.estado = 'seguimiento', format('tercer intento: %s', row_to_json(s));
  -- Una semana sin respuesta: sin_respuesta y fuera de la lista 90 días.
  perform pg_temp.como_postgres();
  update intentos_contacto set en = en - interval '8 days' where cliente_id = v_libre;
  perform pg_temp.como(v_isaac);
  select * into s from v_seguimiento_clientes where cliente_id = v_libre;
  assert s.estado = 'sin_respuesta' and s.volver_el = (s.ultimo + 90), format('sin respuesta: %s', row_to_json(s));
  assert v_libre in (select clientes_en_pausa()), 'el que no contestó sigue en la lista';

  -- "No por ahora": fuera 90 días.
  perform registrar_intento(v_otro, 'whatsapp', 'reactivar');
  perform cerrar_seguimiento(v_otro, 'no_por_ahora');
  select * into s from v_seguimiento_clientes where cliente_id = v_otro;
  assert s.estado = 'no_por_ahora' and s.volver_el = hoy_planta() + 90 and s.intentos is null, format('no por ahora: %s', row_to_json(s));
  assert v_otro in (select clientes_en_pausa()), '"no por ahora" sigue en la lista';
  -- Si alguien vuelve a escribirle, empieza un seguimiento nuevo (sale de la pausa).
  -- (En la prueba todo pasa en la misma transacción, con la misma hora: el resultado se
  -- recorre un minuto para que el intento nuevo quede después, como en la vida real.)
  perform pg_temp.como_postgres();
  update resultados_contacto set en = en - interval '1 minute' where cliente_id = v_otro;
  update intentos_contacto set en = en - interval '2 minutes' where cliente_id = v_otro;
  perform pg_temp.como(v_isaac);
  perform registrar_intento(v_otro, 'llamada');
  assert (select estado from v_seguimiento_clientes where cliente_id = v_otro) = 'seguimiento', 'un intento nuevo no reabrió el seguimiento';
  assert v_otro not in (select clientes_en_pausa()), 'en seguimiento pero fuera de la lista';

  -- "Le interesa" crea la oportunidad en Contactado, a nombre de quien la siguió.
  v_op := cerrar_seguimiento(v_otro, 'interesa');
  assert (select etapa = 'contactado' and vendedor_id = v_isaac and titulo like 'Reactivación: T98 Otro Libre' from oportunidades where id = v_op),
    'la oportunidad no nació en Contactado';
  assert (select oportunidad_id from v_seguimiento_clientes where cliente_id = v_otro) = v_op, 'el resultado no quedó ligado a la oportunidad';

  -- "Ya no compra" pide la razón.
  begin
    perform cerrar_seguimiento(v_libre, 'ya_no_compra');
    v_estado := 'cerró';
  exception when invalid_parameter_value then v_estado := 'negado';
  end;
  assert v_estado = 'negado', '"ya no compra" sin razón';
  perform cerrar_seguimiento(v_libre, 'ya_no_compra', 'competencia');
  assert (select estado = 'ya_no_compra' and volver_el is null from v_seguimiento_clientes where cliente_id = v_libre), 'ya no compra';

  -- Nadie escribe directo en las tablas.
  begin
    insert into intentos_contacto (cliente_id, canal) values (v_libre, 'whatsapp');
    v_estado := 'insertó';
  exception when insufficient_privilege then v_estado := 'negado';
  end;
  assert v_estado = 'negado', 'se insertó un intento sin pasar por registrar_intento';

  -- Finanzas (ventas 1) no ve intentos ni registra.
  perform pg_temp.como(v_fin);
  assert not exists (select 1 from intentos_contacto where cliente_id in (v_libre, v_otro)), 'finanzas vio intentos';
  begin
    perform registrar_intento(v_libre, 'whatsapp');
    v_estado := 'registró';
  exception when insufficient_privilege then v_estado := 'negado';
  end;
  assert v_estado = 'negado', 'finanzas registró un intento';
end $$;

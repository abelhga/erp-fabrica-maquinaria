-- Asistente: lo que Claude puede leer es exactamente lo que la persona puede leer.
-- Aquí se prueba el piso (hallazgos, oportunidades, cupo) sin llamar a la API.
do $$
declare v_a uuid; v_b uuid; v_alm uuid; v_tv uuid; v_cli_a uuid; v_cli_b uuid; v_libre uuid; v_equipo uuid;
        v_pub uuid; v_ocupado uuid; v_cot uuid; v_cupo int; r record;
begin
  update configuracion set valor = to_jsonb(current_date::text) where clave = 'fecha_arranque';
  v_a := pg_temp.usuario('isaac@hegamex.com', '{ventas}');
  v_b := pg_temp.usuario('juan@hegamex.com', '{ventas}');
  v_alm := pg_temp.usuario('almacen@hegamex.com', '{almacen}');
  v_tv := pg_temp.usuario('tv@hegamex.com', '{pantalla}');

  assert texto_dinero(34750000) = '$34.8 M', texto_dinero(34750000);
  assert texto_dinero(812345) = '$812 mil', texto_dinero(812345);
  assert texto_dinero(4500) = '$4,500', texto_dinero(4500);

  -- Cliente de A que compra cada ~60 días y lleva 90 sin comprar: "ya le toca".
  insert into clientes (nombre, vendedor_id, legacy_ref) values ('T Agrícola Cada Dos Meses', v_a, 'T:A1') returning id into v_cli_a;
  insert into historial_ventas_hoja (fecha, cliente_id, cliente_nombre, tipo, monto, descripcion)
  select current_date - 90 - 60 * g, v_cli_a, 'T Agrícola', 'Venta', 30000, 'Cangilones 9x6' from generate_series(0, 4) g;
  insert into contactos (cliente_id, nombre, whatsapp, principal) values (v_cli_a, 'Don Prueba', '3311112222', true);

  -- Cliente de B que compró un equipo hace 10 meses: refacciones.
  insert into clientes (nombre, vendedor_id, legacy_ref) values ('T Minera de B', v_b, 'T:B1') returning id into v_cli_b;
  insert into historial_ventas_hoja (fecha, cliente_id, cliente_nombre, tipo, monto, descripcion)
  values (current_date - 300, v_cli_b, 'T Minera', 'Venta', 250000, 'Banda transportadora 20 m x 24"');

  -- Cliente libre con cotización enviada que vence en 3 días.
  insert into clientes (nombre, legacy_ref) values ('T Libre con Cotización', 'T:L1') returning id into v_libre;
  insert into historial_ventas_hoja (fecha, cliente_id, cliente_nombre, tipo, monto, descripcion)
  values (current_date - 400, v_libre, 'T Libre', 'Venta', 18000, 'Rodillos');
  insert into contactos (cliente_id, nombre, telefono) values (v_libre, 'Contacto libre', '3399990000');
  insert into cotizaciones (cliente_id, vendedor_id, fecha, vigencia_dias, estado, total)
  values (v_libre, v_a, current_date - 12, 15, 'enviada', 120000) returning id into v_cot;

  -- Público en general nunca es "a quién llamar"; tampoco quien ya tiene una oportunidad abierta.
  insert into clientes (nombre, vendedor_id, legacy_ref) values ('Público en General T', v_a, 'T:P1') returning id into v_pub;
  insert into historial_ventas_hoja (fecha, cliente_id, cliente_nombre, tipo, monto, descripcion)
  select current_date - 200 - 30 * g, v_pub, 'Público', 'Venta', 900, 'Tornillos' from generate_series(0, 5) g;
  insert into clientes (nombre, vendedor_id, legacy_ref) values ('T Ya en Negociación', v_a, 'T:O1') returning id into v_ocupado;
  insert into historial_ventas_hoja (fecha, cliente_id, cliente_nombre, tipo, monto, descripcion)
  select current_date - 250 - 100 * g, v_ocupado, 'T Ocupado', 'Venta', 50000, 'Poleas' from generate_series(0, 2) g;
  insert into oportunidades (cliente_id, titulo, etapa, vendedor_id) values (v_ocupado, 'Ya la trae Isaac', 'negociacion', v_a);

  -- A ve lo suyo y lo libre, con el motivo correcto…
  perform pg_temp.como(v_a);
  select * into r from oportunidades_sugeridas(1000) where cliente_id = v_cli_a;
  assert r.motivo = 'le_toca', format('esperaba le_toca, salió %s', r.motivo);
  assert r.intervalo_tipico = 60, format('intervalo: esperaba 60, salió %s', r.intervalo_tipico);
  assert r.whatsapp = '3311112222', 'trae el contacto principal';
  select * into r from oportunidades_sugeridas(1000) where cliente_id = v_libre;
  assert r.motivo = 'cotizacion' and r.cotizacion_id = v_cot, 'la cotización por vencer gana a cualquier otro motivo';
  -- …pero no al cliente de B, ni al público en general, ni al que ya está en negociación.
  assert not exists (select 1 from oportunidades_sugeridas(1000) where cliente_id in (v_cli_b, v_pub, v_ocupado)),
    'A no debe ver al cliente de B, ni al público en general, ni al que ya tiene oportunidad abierta';
  assert exists (select 1 from hallazgos('ventas') where titulo like '%clientes con motivo%'), 'hallazgo de oportunidades para el vendedor';

  perform pg_temp.como(v_b);
  select * into r from oportunidades_sugeridas(1000) where cliente_id = v_cli_b;
  assert r.motivo = 'refacciones', format('esperaba refacciones, salió %s', r.motivo);
  assert not exists (select 1 from oportunidades_sugeridas(1000) where cliente_id = v_cli_a), 'B no ve al cliente de A';

  -- La fuga que había: cliente_visible() decía que sí a cualquiera para los clientes
  -- sin vendedor, así que almacén leía su libro de ventas y sus contactos.
  perform pg_temp.como(v_alm);
  assert not exists (select 1 from historial_ventas_hoja where cliente_id = v_libre), 'almacén leyó el libro de ventas de un cliente libre';
  assert not exists (select 1 from contactos where cliente_id = v_libre), 'almacén leyó los contactos de un cliente libre';
  assert not exists (select 1 from oportunidades_sugeridas(1000)), 'almacén no tiene a quién llamar';
  assert not exists (select 1 from hallazgos('almacen') where area in ('ventas', 'finanzas') or titulo || detalle like '%$%'),
    'a almacén no le sale ningún hallazgo con dinero ni de ventas';

  -- Cupo diario y registro de uso: cada quien el suyo.
  perform pg_temp.como(v_a);
  v_cupo := asistente_cupo();
  insert into asistente_uso (modo, entrada_tokens, salida_tokens) values ('chat', 1000, 200);
  assert asistente_cupo() = v_cupo - 1, 'el cupo baja con cada consulta';
  begin
    insert into asistente_uso (usuario_id, modo) values (v_b, 'chat');
    assert false, 'A registró uso a nombre de B';
  exception when insufficient_privilege then null;
  end;
  insert into asistente_resumenes (area, contenido) values ('ventas', '{"titular":"de A"}');
  perform pg_temp.como(v_b);
  assert not exists (select 1 from asistente_uso where usuario_id = v_a), 'B vio el uso de A';
  assert not exists (select 1 from asistente_resumenes where usuario_id = v_a), 'B vio el resumen de A (puede traer datos que B no ve)';

  -- La TV del taller no usa el asistente.
  perform pg_temp.como(v_tv);
  begin
    insert into asistente_uso (modo) values ('chat');
    assert false, 'la pantalla del taller pudo usar el asistente';
  exception when insufficient_privilege then null;
  end;
  perform pg_temp.como_postgres();
end $$;

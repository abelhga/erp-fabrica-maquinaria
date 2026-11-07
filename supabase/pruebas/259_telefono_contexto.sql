-- Teléfono, fase 2: lo que el ERP le contesta al conmutador cuando entra una llamada. El mismo
-- número con +52 o con 10 dígitos da lo mismo; salen los pedidos abiertos (no los históricos ni
-- los entregados) con su avance según 161, y las cotizaciones vivas (no vencidas ni borradores).
-- El vendedor solo si su cartera sigue vigente y está activo; sin cliente, el del lead abierto.
-- Y lo que NO debe pasar: que en la respuesta aparezca un monto, un RFC o un correo, o que una
-- sesión pueda llamar la función (es solo para la función de borde, con la llave de servicio).

-- Todas las llaves del jsonb, a cualquier profundidad.
create or replace function pg_temp.llaves(j jsonb) returns setof text language sql as $$
  with recursive t(v) as (
    select j
    union all
    select x.v from t, lateral (
      select e.value v from jsonb_each(case when jsonb_typeof(t.v) = 'object' then t.v else '{}' end) e
      union all
      select a.value from jsonb_array_elements(case when jsonb_typeof(t.v) = 'array' then t.v else '[]' end) a) x
  )
  select e.key from t, jsonb_each(case when jsonb_typeof(t.v) = 'object' then t.v else '{}' end) e
$$;

do $$
declare v_ven uuid; v_ven2 uuid; v_ven3 uuid; v_dir uuid; v_cli uuid; v_cli2 uuid; v_cli3 uuid; v_eq uuid;
  p1 uuid; p2 uuid; p3 uuid; p4 uuid; p5 uuid; l1 uuid; o1 uuid; o2 uuid; o3 uuid; o4 uuid; v_l1 uuid; v_l2 uuid;
  v_pai int; v_pin int; r jsonb; r2 jsonb; v_ok boolean; v_malas text; v_ped jsonb; v_av int;
begin
  v_ven := pg_temp.usuario('ven259@hegamex.com', '{ventas}');
  v_ven2 := pg_temp.usuario('venb259@hegamex.com', '{ventas}');
  v_ven3 := pg_temp.usuario('venc259@hegamex.com', '{ventas}');
  v_dir := pg_temp.usuario('dir259@hegamex.com', '{direccion}');
  update perfiles set nombre = 'Isaac 259', telefono = '+52 33 2590 0001' where id = v_ven;
  select id into v_pai from etapas where nombre = 'Pailería';
  select id into v_pin from etapas where nombre = 'Pintura';

  insert into clientes (nombre, vendedor_id, rfc) values ('Agregados 259', v_ven, 'AGR250101AB9') returning id into v_cli;
  insert into contactos (cliente_id, nombre, telefono, correo, domicilio) values
    (v_cli, 'Juan 259', '33 2590 1000', 'juan259@ejemplo.com', 'Calle Falsa 259'),
    (v_cli, 'Otra Persona 259', '33 2590 1999', 'otra259@ejemplo.com', null);
  insert into articulos (clave, tipo, nombre) values ('T259-EQ', 'equipo', 'Banda 259') returning id into v_eq;

  -- P1 en producción: una orden a medias (Pailería terminada, Pintura a la mitad), una terminada y
  -- una cancelada que no cuenta.
  insert into pedidos (cliente_id, canal, estado, fecha_compromiso) values (v_cli, 'directo', 'en_produccion', hoy_planta() + 10) returning id into p1;
  insert into pedido_lineas (pedido_id, articulo_id, titulo, cantidad, precio_unitario) values (p1, v_eq, 'Thor 36 259', 2, 123456.78) returning id into l1;
  insert into ordenes_produccion (articulo_id, cantidad, estado, pedido_id, pedido_linea_id) values (v_eq, 1, 'en_proceso', p1, l1) returning id into o1;
  insert into op_operaciones (orden_id, etapa_id, horas_estimadas, estado) values (o1, v_pai, 100, 'terminada');
  insert into op_operaciones (orden_id, etapa_id, horas_estimadas, estado, inicio, avance) values (o1, v_pin, 100, 'en_proceso', now(), 0.5);
  insert into ordenes_produccion (articulo_id, cantidad, estado, pedido_id, pedido_linea_id) values (v_eq, 1, 'terminada', p1, l1) returning id into o2;
  insert into ordenes_produccion (articulo_id, cantidad, estado, pedido_id, pedido_linea_id) values (v_eq, 1, 'cancelada', p1, l1) returning id into o3;
  -- P2 confirmado, ya pasó su fecha y su única orden está en espera sin arrancar.
  insert into pedidos (cliente_id, canal, estado, fecha_compromiso) values (v_cli, 'directo', 'confirmado', hoy_planta() - 1) returning id into p2;
  insert into pedido_lineas (pedido_id, titulo, cantidad, precio_unitario) values (p2, 'Cangilones 259', 50, 99);
  insert into ordenes_produccion (articulo_id, cantidad, estado, pedido_id, en_espera_motivo, en_espera_causa, en_espera_desde)
    values (v_eq, 1, 'planeada', p2, 'Falta el anticipo', 'cliente', hoy_planta()) returning id into o4;
  insert into op_operaciones (orden_id, etapa_id, horas_estimadas) values (o4, v_pai, 10);
  -- P3 histórico (de la hoja), P4 entregado: ninguno sale. P5 listo, sin fecha y sin órdenes.
  insert into pedidos (cliente_id, canal, estado, historico) values (v_cli, 'directo', 'en_produccion', true) returning id into p3;
  insert into pedidos (cliente_id, canal, estado) values (v_cli, 'directo', 'entregado') returning id into p4;
  insert into pedidos (cliente_id, canal, estado) values (v_cli, 'directo', 'listo') returning id into p5;
  insert into pedido_lineas (pedido_id, titulo, cantidad, precio_unitario)
    values (p5, 'Colector de polvo de 20 bolsas con ventilador de 10 HP y válvula rotativa para descarga continua', 1, 1);

  -- Cotizaciones: una viva; una vencida; una en borrador; una enviada con folio provisional; una aceptada.
  -- Como postgres (sin sesión) el folio y el estado se respetan.
  insert into cotizaciones (folio, cliente_id, vendedor_id, fecha, vigencia_dias, estado) values
    ('COT-T259-1', v_cli, v_ven, hoy_mx() - 3, 15, 'enviada'),
    ('COT-T259-2', v_cli, v_ven, hoy_mx() - 40, 15, 'autorizada'),
    ('COT-T259-3', v_cli, v_ven, hoy_mx(), 15, 'borrador'),
    ('BORRADOR-T259', v_cli, v_ven, hoy_mx(), 15, 'enviada'),
    ('COT-T259-5', v_cli, v_ven, hoy_mx() - 1, 15, 'aceptada');

  -- =========================================================================
  -- 1. El cliente, con +52 o con 10 dígitos
  -- =========================================================================
  r := telefono_contexto('+523325901000');
  r2 := telefono_contexto('33 2590 1000');
  assert r = r2, format('+52 y 10 dígitos dan distinto: %s / %s', r, r2);
  assert r = telefono_contexto('5213325901000'), 'con 521 también debe ser el mismo';
  assert r->>'ok' = 'true' and r->>'conocido' = 'true', format('conocido: %s', r);
  assert r->'cliente' = '{"nombre": "Agregados 259"}', format('cliente: %s', r->'cliente');
  assert r->'lead' = 'null', 'con cliente no hay lead';
  assert r->'vendedor' = '{"nombre": "Isaac 259", "telefono": "+52 33 2590 0001"}', format('vendedor: %s', r->'vendedor');

  -- Pedidos: P1, P2 y P5; el más próximo a su compromiso primero, sin fecha al final.
  assert jsonb_array_length(r->'pedidos') = 3, format('pedidos: %s', r->'pedidos');
  assert not exists (select 1 from jsonb_array_elements(r->'pedidos') x
                     where x->>'folio' in (select folio from pedidos where id in (p3, p4))), 'salió un histórico o un entregado';
  v_ped := r->'pedidos'->0;
  assert v_ped->>'folio' = (select folio from pedidos where id = p2), format('primero el atrasado: %s', r->'pedidos');
  assert v_ped->>'estado' = 'Confirmado' and v_ped->>'atrasado' = 'true' and v_ped->>'en_espera' = 'true', format('P2: %s', v_ped);
  assert v_ped->>'avance' = '0' and v_ped->'etapa' = 'null', format('P2 sin arrancar: %s', v_ped);
  assert v_ped->>'que_es' = 'Cangilones 259', format('P2 qué es: %s', v_ped);

  -- P1: (100 h terminadas + 100 h × ½) / 200 h = 75 % y la terminada 100: 88 %. La cancelada no cuenta.
  v_ped := r->'pedidos'->1;
  assert v_ped->>'folio' = (select folio from pedidos where id = p1), format('segundo P1: %s', r->'pedidos');
  assert v_ped->>'estado' = 'En producción' and v_ped->>'atrasado' = 'false' and v_ped->>'en_espera' = 'false', format('P1: %s', v_ped);
  assert (v_ped->>'avance')::int = 88, format('avance de P1: %s', v_ped->>'avance');
  assert v_ped->>'etapa' = 'Pintura', format('etapa de P1: %s', v_ped->>'etapa');
  assert v_ped->>'que_es' = 'Thor 36 259' and v_ped->>'fecha_compromiso' = (hoy_planta() + 10)::text, format('P1: %s', v_ped);
  -- El mismo número que ve la planta en Producción → Pedidos.
  perform pg_temp.como(v_dir);
  v_av := (select avance from v_pedidos_produccion where id = p1);
  perform pg_temp.como_postgres();
  assert v_av = 88, format('la planta ve %s %%, el teléfono 88', v_av);

  -- P5: listo y sin fecha no va atrasado; sin órdenes, avance y etapa vacíos; el título largo se recorta.
  v_ped := r->'pedidos'->2;
  assert v_ped->>'estado' = 'Listo para entregar' and v_ped->>'atrasado' = 'false', format('P5: %s', v_ped);
  assert v_ped->'avance' = 'null' and v_ped->'etapa' = 'null' and v_ped->'fecha_compromiso' = 'null', format('P5: %s', v_ped);
  assert length(v_ped->>'que_es') = 80 and v_ped->>'que_es' like 'Colector de polvo%…', format('P5 recortado: %s', v_ped->>'que_es');

  -- Listo con la fecha vencida tampoco va atrasado: ya está hecho.
  update pedidos set fecha_compromiso = hoy_planta() - 5 where id = p5;
  assert (select x->>'atrasado' from jsonb_array_elements(telefono_contexto('3325901000')->'pedidos') x
          where x->>'folio' = (select folio from pedidos where id = p5)) = 'false', 'listo no va atrasado';

  -- Cotizaciones: solo la viva.
  assert r->'cotizaciones' = jsonb_build_array(jsonb_build_object('folio', 'COT-T259-1', 'fecha', hoy_mx() - 3, 'vence', hoy_mx() + 12)),
    format('cotizaciones: %s', r->'cotizaciones');

  -- =========================================================================
  -- 2. Nada de montos, RFC, correos, direcciones ni otros contactos
  -- =========================================================================
  select string_agg(k, ', ') into v_malas from pg_temp.llaves(r) k
  where k ~* '(total|subtotal|importe|precio|costo|margen|monto|iva|rfc|correo|domicilio|direccion|whatsapp)';
  assert v_malas is null, format('la respuesta trae llaves que no debe: %s', v_malas);
  assert (select count(*) from pg_temp.llaves('{"a": [{"precio": 1}], "b": {"c": {"rfc": 2}}}') k where k in ('precio', 'rfc')) = 2,
    'pg_temp.llaves no revisa a fondo';
  assert r::text !~ '(123456|AGR250101|@ejemplo|Calle Falsa|Otra Persona|2590 1999|Juan 259)', format('se coló un dato: %s', r);

  -- =========================================================================
  -- 3. El vendedor: vigente y activo, si no, nadie
  -- =========================================================================
  -- Un cliente importado sin ventas ni seguimiento: su cartera ya venció.
  insert into clientes (nombre, vendedor_id, legacy_ref) values ('Gravas 259', v_ven2, 'T259-viejo') returning id into v_cli2;
  insert into contactos (cliente_id, nombre, whatsapp) values (v_cli2, 'Pedro 259', '+52 1 33 2590 1100');
  assert not (select vigente from vigencia_cliente(v_cli2)) is true, 'el cliente de prueba debería estar vencido';
  r := telefono_contexto('3325901100');
  assert r->'cliente' = '{"nombre": "Gravas 259"}', format('por WhatsApp también: %s', r);
  assert r->'vendedor' = 'null', format('cartera vencida no da vendedor: %s', r->'vendedor');
  assert r->'pedidos' = '[]' and r->'cotizaciones' = '[]', format('sin pedidos ni cotizaciones: %s', r);

  -- Vigente pero ya no trabaja aquí.
  insert into clientes (nombre, vendedor_id) values ('Silos 259', v_ven3) returning id into v_cli3;
  insert into contactos (cliente_id, nombre, telefono) values (v_cli3, 'Ana 259', '3325901200');
  assert telefono_contexto('3325901200')->'vendedor'->>'nombre' is not null, 'vigente y activo debe dar vendedor';
  perform pg_temp.como(v_dir);   -- la baja la da quien puede (proteger_perfil)
  update perfiles set activo = false where id = v_ven3;
  perform pg_temp.como_postgres();
  assert telefono_contexto('3325901200')->'vendedor' = 'null', 'un vendedor inactivo no debe salir';

  -- =========================================================================
  -- 4. Sin cliente: el lead abierto
  -- =========================================================================
  r := telefono_contexto('+52 33 2590 9999');
  assert r = '{"ok": true, "conocido": false, "cliente": null, "lead": null, "vendedor": null, "pedidos": [], "cotizaciones": []}'::jsonb,
    format('número desconocido: %s', r);

  insert into leads (nombre, telefono, interes) values ('Lupita 259', '+52 33 2590 2000', 'Tolva de 5 m3') returning id into v_l1;
  r := telefono_contexto('3325902000');
  assert r->>'conocido' = 'true' and r->'cliente' = 'null' and r->'lead' = '{"nombre": "Lupita 259", "interes": "Tolva de 5 m3"}',
    format('lead por su teléfono: %s', r);
  assert r->'vendedor' = 'null', 'un lead sin asignar no tiene vendedor';
  update leads set estado = 'asignado', vendedor_id = v_ven where id = v_l1;
  assert telefono_contexto('3325902000')->'vendedor'->>'nombre' = 'Isaac 259', 'el lead asignado da su vendedor';
  update leads set estado = 'descartado', motivo_descarte = 'No le interesó' where id = v_l1;
  assert telefono_contexto('3325902000')->>'conocido' = 'false', 'un lead descartado ya no cuenta';

  -- El lead quedó con otro teléfono (o solo correo), pero salió de una llamada de este número.
  insert into leads (nombre, correo, interes) values ('Toño 259', 'tono259@ejemplo.com', 'Elevador de cangilones') returning id into v_l2;
  update leads set estado = 'asignado', vendedor_id = v_ven where id = v_l2;
  insert into llamadas (call_sid, telefono, telefono10, lead_id, nadie_contesto) values ('CA259-1', '+523325903000', '3325903000', v_l2, true);
  r := telefono_contexto('3325903000');
  assert r->'lead'->>'nombre' = 'Toño 259' and r->'vendedor'->>'nombre' = 'Isaac 259', format('lead por su llamada: %s', r);
  assert r::text not like '%tono259%', 'el correo del lead no debe salir';

  -- =========================================================================
  -- 5. Teléfono inválido y quién puede llamarla
  -- =========================================================================
  foreach v_malas in array array['12345', '', 'sin numero'] loop
    v_ok := false;
    begin perform telefono_contexto(v_malas); exception when sqlstate '22023' then v_ok := true; end;
    assert v_ok, format('«%s» debió ser teléfono inválido (22023)', v_malas);
  end loop;
  v_ok := false;
  begin perform telefono_contexto(null); exception when sqlstate '22023' then v_ok := true; end;
  assert v_ok, 'sin teléfono debió ser 22023';

  perform pg_temp.como(v_dir);
  v_ok := false;
  begin perform telefono_contexto('3325901000'); v_ok := true; exception when insufficient_privilege then null; end;
  assert not v_ok, 'una sesión (aunque sea dirección) no debe poder pedir el contexto del teléfono';
  perform pg_temp.como_postgres();
  assert not has_function_privilege('anon', 'public.telefono_contexto(text)', 'execute'), 'anon no debe poder';
  assert not has_function_privilege('authenticated', 'public.telefono_contexto(text)', 'execute'), 'authenticated no debe poder';
  assert has_function_privilege('service_role', 'public.telefono_contexto(text)', 'execute'), 'la función de borde (service_role) sí';
end $$;

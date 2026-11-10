-- Un cliente sin empresa se llama como la persona: al volver el lead oportunidad, al darlo de alta a
-- mano y por cualquier otro camino. En el lead, «Particular» sigue contando como completo; «...» no.
do $$
declare v_rec uuid; v_a uuid; v_dir uuid; v_l uuid; v_l2 uuid; v_cli uuid; v_ok boolean; v_msg text;
begin
  v_rec := pg_temp.usuario('rec268@hegamex.com', '{recepcion}');
  v_a := pg_temp.usuario('vena268@hegamex.com', '{ventas}');
  v_dir := pg_temp.usuario('dir268@hegamex.com', '{direccion}');
  perform pg_temp.como(v_dir);
  perform fijar_config_leads('recepcion', 2, 24, array[v_a]);

  -- 1. Qué es genérico y qué no.
  assert empresa_generica('Particular') and empresa_generica(' particular ') and empresa_generica('Aún no tiene empresa')
     and empresa_generica('....') and empresa_generica('N/A') and empresa_generica('Sin denominación') and empresa_generica('Independiente'),
    'no reconoció una empresa genérica';
  assert not empresa_generica('Granos del Bajío') and not empresa_generica('Público en general') and not empresa_generica('Particular Hnos SA'),
    'tomó por genérica una empresa de verdad (o el público en general de facturación)';

  -- 2. El lead: «Particular» cuenta como completo; «...» no.
  assert not ('empresa' = any (lead_faltan(null, 'Particular', 'León', null, 'Banda de 12 m'))), '«Particular» debía contar como completo';
  assert 'empresa' = any (lead_faltan(null, '....', 'León', null, 'Banda de 12 m')), '«....» debía contar como incompleto';

  -- 3. Al volverlo oportunidad, el cliente se llama como la persona.
  perform pg_temp.como(v_rec);
  insert into leads (nombre, empresa, telefono, interes, vendedor_id) values ('Alberto Marrero 268', 'Particular', '5550002680', 'Banda 268', v_a) returning id into v_l;
  insert into leads (nombre, empresa, telefono, interes, vendedor_id) values ('Rosa 268', 'Granos 268', '5550002681', 'Tolva 268', v_a) returning id into v_l2;
  perform pg_temp.como(v_a);
  perform registrar_intento_lead(v_l, 'llamada', 'contesto', 'Quiere la banda para enero');
  perform convertir_lead(v_l);
  assert (select c.nombre = 'Alberto Marrero 268' and l.cliente_nombre = 'Alberto Marrero 268' from leads l join clientes c on c.id = l.cliente_id where l.id = v_l),
    'el cliente no quedó con el nombre de la persona';
  perform registrar_intento_lead(v_l2, 'llamada', 'contesto', 'Pide precio de la tolva');
  perform convertir_lead(v_l2);
  assert (select c.nombre = 'Granos 268' from leads l join clientes c on c.id = l.cliente_id where l.id = v_l2), 'con empresa de verdad, el cliente es la empresa';

  -- 4. Alta a mano: con nombre genérico usa el del contacto; sin contacto, lo pide.
  v_cli := alta_cliente('{"nombre": "Particular"}', '{"nombre": "Hugo Díaz 268", "telefono": "5550002682"}');
  assert (select nombre = 'Hugo Díaz 268' from clientes where id = v_cli), 'el alta a mano no tomó el nombre del contacto';
  begin perform alta_cliente('{"nombre": "Independiente"}', null); v_ok := true; exception when check_violation then v_ok := false; v_msg := sqlerrm; end;
  assert not v_ok and v_msg like 'Si no tiene empresa%', format('dio de alta «Independiente» sin persona: %s', v_msg);

  -- 5. Por otro camino tampoco (lo que NO debe pasar).
  perform pg_temp.como_postgres();
  begin insert into clientes (nombre) values ('....'); v_ok := true; exception when check_violation then v_ok := false; end;
  assert not v_ok, 'entró un cliente que se llama «....»';
  begin update clientes set nombre = 'Particular' where id = v_cli; v_ok := true; exception when check_violation then v_ok := false; end;
  assert not v_ok, 'se pudo renombrar un cliente a «Particular»';
end $$;

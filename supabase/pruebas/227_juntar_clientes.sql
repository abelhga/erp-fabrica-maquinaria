-- Juntar clientes: todo lo del repetido pasa al bueno (pedidos, cotizaciones, lo de la hoja,
-- pendientes), los contactos no se duplican, el bueno completa lo que le faltaba y el repetido se
-- borra. Un vendedor solo junta clientes suyos o libres; con RFC distinto no se juntan.
do $$
declare
  v_ven uuid; v_otro uuid; v_ger uuid; v_rep uuid; v_bueno uuid; v_ajeno uuid; v_rfc2 uuid; v_ped uuid; v_pend uuid; r jsonb; c record;
begin
  v_ven := pg_temp.usuario('ven227@hegamex.com', '{ventas}');
  v_otro := pg_temp.usuario('otro227@hegamex.com', '{ventas}');
  v_ger := pg_temp.usuario('ger227@hegamex.com', '{gerente_ventas}');

  -- El de la hoja (empresa, RFC, deuda) sin vendedor, y el repetido con el nombre del contacto.
  insert into clientes (nombre, rfc) values ('Granos del Bajío 227', 'GBA170316SU6') returning id into v_bueno;
  insert into clientes (nombre, vendedor_id, ciudad, giro) values ('Ing. Pedro 227', v_ven, 'Celaya', 'Granos') returning id into v_rep;
  insert into contactos (cliente_id, nombre, telefono) values (v_bueno, 'Pedro Ruiz', '(461) 555 0101');
  insert into contactos (cliente_id, nombre, telefono, correo) values (v_rep, 'Contacto', '461-555-0101', 'pedro@granos.mx'),
    (v_rep, 'Contacto', '4615550202', null);
  insert into historial_ventas_hoja (fecha, cliente_nombre, cliente_id, tipo, monto, factura) values ('2016-03-01', 'Granos del Bajío 227', v_bueno, 'Venta', 1160, 'F-227');
  insert into pedidos (cliente_id, vendedor_id, canal) values (v_rep, v_ven, 'directo') returning id into v_ped;
  insert into pendientes (titulo, responsable_id, creado_por, tabla, registro_id, ruta) values ('Llamar a Pedro 227', v_ven, v_ger, 'clientes', v_rep::text, '/ventas/clientes/' || v_rep)
    returning id into v_pend;

  -- 1. Otro vendedor no junta un cliente que no es suyo.
  perform pg_temp.como(v_otro);
  begin
    perform juntar_clientes(v_rep, v_bueno);
    assert false, 'otro vendedor juntó un cliente ajeno';
  exception when insufficient_privilege then null;
  end;

  -- 2. Con RFC distinto no se juntan, ni siquiera la gerencia.
  perform pg_temp.como_postgres();
  insert into clientes (nombre, rfc) values ('Otra empresa 227', 'OEM170316SU7') returning id into v_rfc2;
  perform pg_temp.como(v_ger);
  begin
    perform juntar_clientes(v_rfc2, v_bueno);
    assert false, 'se juntaron dos clientes con RFC distinto';
  exception when check_violation then null;
  end;

  -- 3. El vendedor junta su cliente con uno libre.
  perform pg_temp.como(v_ven);
  r := juntar_clientes_vista(v_rep, v_bueno);
  assert (r->>'pedidos')::int = 1 and (r->>'contactos')::int = 2, format('vista: %s', r);
  r := juntar_clientes(v_rep, v_bueno);
  perform pg_temp.como_postgres();

  assert not exists (select 1 from clientes where id = v_rep), 'el repetido sigue';
  assert (select cliente_id from pedidos where id = v_ped) = v_bueno, 'el pedido no pasó';
  assert (select registro_id from pendientes where id = v_pend) = v_bueno::text, 'el pendiente no pasó';
  assert (select ruta from pendientes where id = v_pend) = '/ventas/clientes/' || v_bueno, 'la liga del pendiente no cambió';
  -- El contacto con el mismo teléfono no se duplica (le completa el correo); el otro pasa con el nombre del repetido.
  assert (select count(*) from contactos where cliente_id = v_bueno) = 2, 'contactos duplicados o perdidos';
  assert (select correo from contactos where cliente_id = v_bueno and nombre = 'Pedro Ruiz') = 'pedro@granos.mx', 'no completó el correo';
  assert exists (select 1 from contactos where cliente_id = v_bueno and nombre = 'Ing. Pedro 227' and telefono = '4615550202'), 'el contacto nuevo no pasó con su nombre';
  -- El bueno conserva su RFC y toma lo que le faltaba, incluido el vendedor.
  select * into c from clientes where id = v_bueno;
  assert (c.rfc, c.ciudad, c.giro, c.vendedor_id) = ('GBA170316SU6', 'Celaya', 'Granos', v_ven), format('datos: %s %s %s %s', c.rfc, c.ciudad, c.giro, c.vendedor_id);
  assert c.notas like '%Se juntó con «Ing. Pedro 227»%', format('nota: %s', c.notas);
  assert (select count(*) from historial_ventas_hoja where cliente_id = v_bueno) = 1, 'lo de la hoja se movió mal';

  -- 4. Ahora el bueno es del vendedor: otro vendedor no le junta encima uno suyo.
  insert into clientes (nombre, vendedor_id) values ('Granos 227 (otro)', v_otro) returning id into v_ajeno;
  perform pg_temp.como(v_otro);
  begin
    perform juntar_clientes(v_ajeno, v_bueno);
    assert false, 'otro vendedor juntó su cliente con uno ajeno';
  exception when insufficient_privilege then null;
  end;
  -- La gerencia sí.
  perform pg_temp.como(v_ger);
  perform juntar_clientes(v_ajeno, v_bueno);
  perform pg_temp.como_postgres();
  assert not exists (select 1 from clientes where id = v_ajeno), 'la gerencia no pudo juntar';
end $$;

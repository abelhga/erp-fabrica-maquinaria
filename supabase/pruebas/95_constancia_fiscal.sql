-- Antes de dar de alta con la constancia: ¿ese RFC ya existe? El vendedor se entera
-- de que el cliente ya es de otro (sin ver sus datos) y compras de sus proveedores.
do $$
declare v_isaac uuid; v_otro uuid; v_com uuid; v_alm uuid; v_cli uuid; v_prov uuid; j jsonb;
begin
  v_isaac := pg_temp.usuario('isaac95@hegamex.com', '{ventas}');
  v_otro := pg_temp.usuario('otro95@hegamex.com', '{ventas}');
  v_com := pg_temp.usuario('com95@hegamex.com', '{compras}');
  v_alm := pg_temp.usuario('alm95@hegamex.com', '{almacen}');
  insert into clientes (nombre, rfc, vendedor_id) values ('T95 Concretos del Bajío', 'CBA160202AB1', v_isaac) returning id into v_cli;
  insert into proveedores (nombre, rfc, regimen_fiscal, cp_fiscal) values ('T95 Aceros', 'ACE-950101-XY9', '601 General de Ley Personas Morales', '44100')
    returning id into v_prov;

  -- Otro vendedor: sabe que existe y de quién es, y que no lo puede editar; no ve proveedores.
  perform pg_temp.como(v_otro);
  j := rfc_registrado(' cba-160202ab1 ');
  assert j #>> '{clientes,0,id}' = v_cli::text and j #>> '{clientes,0,vendedor}' = 'isaac95', format('otro vendedor: %s', j);
  assert (j #>> '{clientes,0,editable}')::boolean = false and (j #>> '{clientes,0,mio}')::boolean = false, format('editable/mío: %s', j);
  assert jsonb_array_length(rfc_registrado('ACE950101XY9') -> 'proveedores') = 0, 'ventas vio proveedores';

  -- El dueño lo ve como suyo.
  perform pg_temp.como(v_isaac);
  j := rfc_registrado('CBA160202AB1');
  assert (j #>> '{clientes,0,mio}')::boolean and (j #>> '{clientes,0,editable}')::boolean, format('dueño: %s', j);

  -- Compras: sus proveedores (aunque el RFC se haya guardado con guiones), no los clientes.
  perform pg_temp.como(v_com);
  j := rfc_registrado('ACE950101XY9');
  assert j #>> '{proveedores,0,id}' = v_prov::text, format('compras: %s', j);
  assert jsonb_array_length(rfc_registrado('CBA160202AB1') -> 'clientes') = 0, 'compras vio clientes';
  assert jsonb_array_length(rfc_registrado('XAXX010101000') -> 'proveedores') = 0, 'un RFC que no existe salió registrado';

  -- Almacén no da de alta ni pregunta.
  perform pg_temp.como(v_alm);
  begin
    perform rfc_registrado('CBA160202AB1');
    assert false, 'almacén consultó un RFC';
  exception when insufficient_privilege then null;
  end;
end $$;

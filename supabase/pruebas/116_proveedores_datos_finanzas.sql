-- Finanzas y Gerencia administrativa cambian datos de pago y fiscales del proveedor (no
-- lo comercial), y cada cambio de cuenta bancaria le avisa a dirección.
do $$
declare v_prov uuid; v_sus uuid; v_fin uuid; v_ven uuid; v_comp uuid; v_dir uuid; p record;
begin
  v_sus := pg_temp.usuario('sus116@hegamex.com', '{ventas,administracion}');
  v_fin := pg_temp.usuario('fin116@hegamex.com', '{finanzas}');
  v_ven := pg_temp.usuario('ven116@hegamex.com', '{ventas}');
  v_comp := pg_temp.usuario('comp116@hegamex.com', '{compras}');
  v_dir := pg_temp.usuario('dir116@hegamex.com', '{direccion}');
  insert into proveedores (nombre, dias_entrega) values ('T116 Aceros', 10) returning id into v_prov;

  perform pg_temp.como(v_sus);
  perform actualizar_proveedor_finanzas(v_prov, jsonb_build_object('rfc', 'aac-010101-ab1', 'datos_bancarios', 'BBVA 012…',
    'dias_credito', 30, 'cp_fiscal', '45000', 'dias_entrega', 99, 'activo', false, 'nombre', 'Otro nombre'));
  perform pg_temp.como_postgres();
  select * into p from proveedores where id = v_prov;
  assert p.rfc = 'AAC010101AB1' and p.datos_bancarios = 'BBVA 012…' and p.dias_credito = 30 and p.cp_fiscal = '45000',
    format('Gerencia administrativa no guardó los datos de pago: %s', row_to_json(p));
  assert p.dias_entrega = 10 and p.activo and p.nombre = 'T116 Aceros', 'finanzas cambió algo comercial';
  assert exists (select 1 from avisos where usuario_id = v_dir and tipo = 'proveedor_banco' and registro_id = v_prov::text),
    'dirección no recibió el aviso del cambio de cuenta';
  assert not exists (select 1 from avisos where tipo = 'proveedor_banco' and registro_id = v_prov::text and cuerpo like '%BBVA%'),
    'el aviso repite la cuenta';

  -- Sin cambio de cuenta, no hay aviso nuevo.
  perform pg_temp.como(v_fin);
  perform actualizar_proveedor_finanzas(v_prov, jsonb_build_object('contacto', 'Laura'));
  perform pg_temp.como_postgres();
  assert (select count(*) from avisos where usuario_id = v_dir and tipo = 'proveedor_banco' and registro_id = v_prov::text) = 1, 'avisó sin cambio de cuenta';
  assert (select contacto from proveedores where id = v_prov) = 'Laura', 'finanzas no guardó el contacto';

  -- Validaciones.
  perform pg_temp.como(v_fin);
  begin
    perform actualizar_proveedor_finanzas(v_prov, '{"rfc": "XYZ"}');
    assert false, 'aceptó un RFC inválido';
  exception when invalid_parameter_value then null;
  end;

  -- Por la tabla, Gerencia administrativa no edita (RLS); compras sí, todo.
  perform pg_temp.como(v_sus);
  update proveedores set dias_entrega = 1 where id = v_prov;
  perform pg_temp.como_postgres();
  assert (select dias_entrega from proveedores where id = v_prov) = 10, 'Gerencia administrativa editó por la tabla';
  perform pg_temp.como(v_comp);
  update proveedores set dias_entrega = 15, datos_bancarios = 'Banorte 072…' where id = v_prov;
  perform pg_temp.como_postgres();
  assert (select dias_entrega from proveedores where id = v_prov) = 15, 'compras ya no edita el proveedor';
  assert (select count(*) from avisos where usuario_id = v_dir and tipo = 'proveedor_banco' and registro_id = v_prov::text) = 2,
    'el cambio de cuenta de compras no avisó';

  -- Un vendedor no cambia nada.
  perform pg_temp.como(v_ven);
  begin
    perform actualizar_proveedor_finanzas(v_prov, '{"contacto": "Intruso"}');
    assert false, 'un vendedor cambió datos del proveedor';
  exception when insufficient_privilege then null;
  end;
end $$;

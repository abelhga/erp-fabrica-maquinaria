-- Nómina e impuestos: no son compras (no cuentan en lo comprado ni salen en el directorio de
-- compras), pero lo que se les debe sigue en Inicio y en la agenda.
do $$
declare v_fin uuid; v_comp uuid; v_nom uuid; v_prov uuid; r jsonb;
begin
  v_fin := pg_temp.usuario('fin132@hegamex.com', '{finanzas}');
  v_comp := pg_temp.usuario('comp132@hegamex.com', '{compras}');
  insert into proveedores (nombre, categoria, tipo_acreedor) values ('T132 Nómina', 'Nómina', 'nomina') returning id into v_nom;
  insert into proveedores (nombre) values ('T132 Aceros') returning id into v_prov;
  insert into historial_compras_hoja (fecha, proveedor_id, proveedor_nombre, proveedor_llave, tipo, monto) values
    (current_date - 20, v_nom, 'T132 Nómina', 't132-nomina', 'Compra', 500000),
    (current_date - 20, v_prov, 'T132 Aceros', 't132-aceros', 'Compra', 8000);

  perform pg_temp.como(v_comp);
  assert not exists (select 1 from compras_proveedores_12m(v_nom)), 'la nómina no es una compra';
  assert (select comprado_12m from compras_proveedores_12m(v_prov)) = 8000, 'el proveedor sí cuenta';
  assert (select tipo_acreedor from v_proveedores where id = v_nom) = 'nomina', 'v_proveedores debe decir que es nómina';

  -- Lo que se le debe a la nómina sigue en lo que hay que pagar.
  perform pg_temp.como(v_fin);
  assert (select saldo from v_saldo_arranque_proveedores where proveedor_llave = 't132-nomina') = 500000, 'el saldo de nómina';
  r := indicadores(array['por_pagar']);
  assert (r->'por_pagar'->>'total')::numeric >= 508000, format('por pagar debe incluir nómina: %s', r);

  -- Un tipo que no existe se rechaza.
  perform pg_temp.como_postgres();
  begin
    update proveedores set tipo_acreedor = 'otro' where id = v_prov;
    raise exception 'aceptó un tipo de acreedor que no existe';
  exception when check_violation then null; end;
end $$;

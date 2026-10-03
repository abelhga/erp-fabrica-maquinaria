-- Cartera: un cliente es del vendedor mientras le venda (12 meses) o le dé
-- seguimiento (90 días). Vencido → libre; libre → del primero que lo cotiza.
do $$
declare v_a uuid; v_b uuid; v_g uuid; v_cli uuid; v_libre uuid; v_viejo uuid; v_n int; v_ped uuid;
begin
  update configuracion set valor = jsonb_set(valor, '{activa}', 'true') where clave = 'propiedad_clientes';
  v_a := pg_temp.usuario('isaac@hegamex.com', '{ventas}');
  v_b := pg_temp.usuario('juan@hegamex.com', '{ventas}');
  v_g := pg_temp.usuario('gerente.ventas@hegamex.com', '{gerente_ventas}');

  -- Cliente de A con venta hace 3 meses: vigente.
  insert into clientes (nombre, vendedor_id, legacy_ref) values ('Cliente vigente de A', v_a, 'T:1') returning id into v_cli;
  insert into pedidos (cliente_id, vendedor_id, fecha) values (v_cli, v_a, current_date - 90) returning id into v_ped;
  assert (select vigente from vigencia_cliente(v_cli)), 'con venta hace 3 meses debe ser vigente';
  -- Cliente de A con última venta hace 2 años y sin seguimiento: vencido.
  insert into clientes (nombre, vendedor_id, legacy_ref) values ('Cliente viejo de A', v_a, 'T:2') returning id into v_viejo;
  insert into pedidos (cliente_id, vendedor_id, fecha) values (v_viejo, v_a, current_date - 730);
  assert not (select vigente from vigencia_cliente(v_viejo)), 'sin venta en 2 años debe estar vencido';
  insert into clientes (nombre, legacy_ref) values ('Cliente libre', 'T:3') returning id into v_libre;

  -- B no puede cotizarle al cliente vigente de A…
  perform pg_temp.como(v_b);
  begin
    insert into cotizaciones (cliente_id) values (v_cli);
    assert false, 'B cotizó a un cliente vigente de A';
  exception when insufficient_privilege then
    if sqlerrm not like '%hasta el%' then raise; end if;
  end;
  -- …pero sí al libre, y se queda con él.
  insert into cotizaciones (cliente_id) values (v_libre);
  perform pg_temp.como_postgres();
  assert (select vendedor_id from clientes where id = v_libre) = v_b, 'el cliente libre pasa a B al cotizarle';

  -- La gerencia sí puede cotizar a cualquiera.
  perform pg_temp.como(v_g);
  insert into cotizaciones (cliente_id, vendedor_id) values (v_cli, v_g);
  perform pg_temp.como_postgres();

  -- Liberación nocturna: el viejo queda libre y con nota; el vigente no.
  perform liberar_clientes_vencidos();
  assert (select vendedor_id from clientes where id = v_viejo) is null, 'el vencido debía liberarse';
  assert (select notas from clientes where id = v_viejo) like '%Liberado el%', 'nota de liberación';
  assert (select vendedor_id from clientes where id = v_cli) = v_a, 'el vigente sigue siendo de A';

  -- Con la regla apagada no se bloquea ni se libera nada.
  update configuracion set valor = jsonb_set(valor, '{activa}', 'false') where clave = 'propiedad_clientes';
  update clientes set vendedor_id = v_a where id = v_viejo;
  assert liberar_clientes_vencidos() = 0, 'apagada no libera';
end $$;

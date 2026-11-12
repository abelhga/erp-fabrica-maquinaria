-- Contactos: con la regla escrita como conjunto, cada quien sigue viendo y editando lo mismo: el
-- vendedor, los contactos de sus clientes; no los de otro vendedor; compras, ninguno; y la política ya
-- no llama una función por renglón.
do $$
declare v_a uuid; v_b uuid; v_com uuid; v_ca uuid; v_cb uuid; v_ok boolean; v_n int;
begin
  v_a := pg_temp.usuario('a288@hegamex.com', '{ventas}');
  v_b := pg_temp.usuario('b288@hegamex.com', '{ventas}');
  v_com := pg_temp.usuario('com288@hegamex.com', '{compras}');
  insert into clientes (nombre, vendedor_id) values ('Cliente A 288', v_a) returning id into v_ca;
  insert into clientes (nombre, vendedor_id) values ('Cliente B 288', v_b) returning id into v_cb;
  insert into contactos (cliente_id, nombre) values (v_cb, 'Contacto de B 288');

  perform pg_temp.como(v_a);
  insert into contactos (cliente_id, nombre) values (v_ca, 'Contacto de A 288');
  update contactos set nombre = 'Contacto de A 288 bis' where cliente_id = v_ca;
  assert (select count(*) from contactos where cliente_id = v_ca and nombre like '%bis') = 1, 'el vendedor no editó su contacto';
  assert not exists (select 1 from contactos where cliente_id = v_cb), 'el vendedor ve contactos de otro vendedor';
  begin insert into contactos (cliente_id, nombre) values (v_cb, 'Intruso 288'); v_ok := true;
  exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'el vendedor agregó un contacto al cliente de otro';

  perform pg_temp.como(v_com);
  select count(*) into v_n from contactos where cliente_id in (v_ca, v_cb);
  assert v_n = 0, 'compras ve contactos';
  begin insert into contactos (cliente_id, nombre) values (v_ca, 'Compras 288'); v_ok := true;
  exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'compras agregó un contacto';
  perform pg_temp.como_postgres();

  assert not exists (select 1 from pg_policies where tablename = 'contactos' and (qual ~ 'cliente_visible\(' or with_check ~ 'cliente_visible\(')),
    'una política de contactos sigue llamando cliente_visible por renglón';
end $$;

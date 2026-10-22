-- Folios de pedido: PED-26-799 corrido (no reinicia con el año); Mercado Libre y la web con su
-- serie por año; el folio anterior se sigue encontrando.
do $$
declare v_cli uuid; v_ven uuid; v_n int; a text; b text; c text; m1 text; m2 text; w text; v_id uuid;
begin
  v_ven := pg_temp.usuario('ven153@hegamex.com', '{ventas}');
  insert into clientes (nombre) values ('Cliente folios 153') returning id into v_cli;
  select ultimo into v_n from folios where serie = 'PED' and anio = 0;
  v_n := coalesce(v_n, 0);

  insert into pedidos (cliente_id, fecha) values (v_cli, '2026-10-22') returning folio into a;
  insert into pedidos (cliente_id, fecha) values (v_cli, '2026-12-31') returning folio into b;
  -- En 2027 el número sigue, no vuelve a 1.
  insert into pedidos (cliente_id, fecha) values (v_cli, '2027-01-02') returning folio into c;
  assert a = format('PED-26-%s', lpad((v_n + 1)::text, 3, '0')), 'primer folio: ' || a;
  assert b = format('PED-26-%s', lpad((v_n + 2)::text, 3, '0')), 'segundo folio: ' || b;
  assert c = format('PED-27-%s', lpad((v_n + 3)::text, 3, '0')), 'el número reinició con el año: ' || c;

  -- Mercado Libre y la web no se comen el número de pedido: su serie empieza cada año.
  insert into pedidos (cliente_id, canal, fecha, id_externo) values (v_cli, 'mercadolibre', '2026-10-22', 'ML153a') returning folio into m1;
  insert into pedidos (cliente_id, canal, fecha, id_externo) values (v_cli, 'mercadolibre', '2027-01-03', 'ML153b') returning folio into m2;
  insert into pedidos (cliente_id, canal, fecha) values (v_cli, 'sitio_web', '2026-10-22') returning folio into w;
  assert m1 like 'ML-26-____' and m2 = 'ML-27-0001', format('serie ML: %s %s', m1, m2);
  assert w like 'WEB-26-____', 'serie web: ' || w;
  insert into pedidos (cliente_id, fecha) values (v_cli, '2026-10-23') returning folio into a;
  assert a = format('PED-26-%s', lpad((v_n + 4)::text, 3, '0')), 'ML se comió un número de pedido: ' || a;

  -- Un pedido renumerado se encuentra por su folio de antes.
  insert into pedidos (cliente_id, folio, folio_anterior, vendedor_id) values (v_cli, 'PED-25-153', 'HIS-XX-0153', v_ven) returning id into v_id;
  perform pg_temp.como(v_ven);
  assert exists (select 1 from buscar_global('HIS-XX-0153') where id = v_id::text), 'el buscador no encontró el folio anterior';
  assert (select folio_anterior from v_pedidos where id = v_id) = 'HIS-XX-0153', 'v_pedidos no trae el folio anterior';
end $$;

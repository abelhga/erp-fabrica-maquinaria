-- Las partidas de cotización se ven y se editan igual que antes: el conjunto dice lo mismo que
-- cotizacion_visible / cotizacion_editable para cada cotización y cada persona; el vendedor no ve ni
-- toca las de otro, y una cotización enviada ya no se edita.
do $$
declare v_isaac uuid; v_juan uuid; v_ger uuid; v_alm uuid; v_cli uuid; v_art uuid;
  c_isaac uuid; c_juan uuid; c_env uuid; v_n int; v_ok boolean; r record;
begin
  v_isaac := pg_temp.usuario('isaac298@hegamex.com', '{ventas}');
  v_juan := pg_temp.usuario('juan298@hegamex.com', '{ventas}');
  v_ger := pg_temp.usuario('ger298@hegamex.com', '{gerente_ventas}');
  v_alm := pg_temp.usuario('alm298@hegamex.com', '{almacen}');
  insert into articulos (clave, tipo, nombre, se_vende) values ('T298-POL', 'componente', 'Polea 298', true) returning id into v_art;
  insert into clientes (nombre) values ('Cliente 298') returning id into v_cli;

  perform pg_temp.como(v_isaac);
  insert into cotizaciones (cliente_id, tiempo_entrega) values (v_cli, '10 días') returning id into c_isaac;
  insert into cotizacion_lineas (cotizacion_id, orden, articulo_id, titulo, cantidad, precio_unitario, precio_lista)
  values (c_isaac, 1, v_art, 'Polea', 2, 1000, 1000), (c_isaac, 2, null, 'Flete', 1, 500, null);
  insert into cotizaciones (cliente_id, tiempo_entrega) values (v_cli, '10 días') returning id into c_env;
  insert into cotizacion_lineas (cotizacion_id, orden, articulo_id, titulo, cantidad, precio_unitario, precio_lista)
  values (c_env, 1, v_art, 'Polea', 1, 1000, 1000);
  perform pg_temp.como(v_juan);
  insert into cotizaciones (cliente_id, tiempo_entrega) values (v_cli, '10 días') returning id into c_juan;
  insert into cotizacion_lineas (cotizacion_id, orden, articulo_id, titulo, cantidad, precio_unitario, precio_lista)
  values (c_juan, 1, v_art, 'Polea', 5, 1000, 1000);
  -- La de Isaac «enviada» ya no es editable (se marca directo: aquí se prueba la política, no el envío).
  perform pg_temp.como_postgres();
  alter table cotizaciones disable trigger user;
  update cotizaciones set estado = 'enviada' where id = c_env;
  alter table cotizaciones enable trigger user;

  -- 1. El conjunto dice lo mismo que la función de antes, para todos y con todas las cotizaciones.
  for r in select * from (values (v_isaac, 'Isaac'), (v_juan, 'Juan'), (v_ger, 'la gerencia de ventas'), (v_alm, 'almacén')) x(u, quien) loop
    perform pg_temp.como(r.u);
    select count(*) into v_n from (values (c_isaac), (c_juan), (c_env)) c(id)
    where cotizacion_visible(c.id) is distinct from (c.id in (select mis_cotizaciones_visibles()))
       or cotizacion_editable(c.id) is distinct from (c.id in (select mis_cotizaciones_editables()));
    assert v_n = 0, format('%s: %s cotizaciones donde el conjunto dice otra cosa que la función', r.quien, v_n);
  end loop;

  -- 2. Isaac: ve las suyas (3 partidas), no la de Juan.
  perform pg_temp.como(v_isaac);
  assert (select count(*) from cotizacion_lineas where cotizacion_id in (c_isaac, c_env)) = 3, 'Isaac no ve sus partidas';
  assert not exists (select 1 from cotizacion_lineas where cotizacion_id = c_juan), 'Isaac ve partidas de Juan';
  assert (select partidas from v_cotizaciones where id = c_isaac) = 2, 'la lista no cuenta las partidas';
  --    Edita la suya en borrador…
  update cotizacion_lineas set cantidad = 3 where cotizacion_id = c_isaac and orden = 1;
  get diagnostics v_n = row_count;
  assert v_n = 1, 'Isaac no pudo editar su partida en borrador';
  --    …pero no la enviada, ni le agrega partidas, ni toca la de Juan.
  update cotizacion_lineas set cantidad = 9 where cotizacion_id = c_env;
  get diagnostics v_n = row_count;
  assert v_n = 0, 'Isaac editó una partida de una cotización enviada';
  begin
    insert into cotizacion_lineas (cotizacion_id, orden, titulo, cantidad, precio_unitario) values (c_env, 2, 'Extra', 1, 10);
    v_ok := true;
  exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'Isaac agregó una partida a una cotización enviada';
  begin
    insert into cotizacion_lineas (cotizacion_id, orden, titulo, cantidad, precio_unitario) values (c_juan, 2, 'Extra', 1, 10);
    v_ok := true;
  exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'Isaac agregó una partida a la cotización de Juan';
  delete from cotizacion_lineas where cotizacion_id = c_juan;
  get diagnostics v_n = row_count;
  assert v_n = 0, 'Isaac borró partidas de Juan';

  -- 3. La gerencia de ventas ve y edita las de todos (las que siguen abiertas).
  perform pg_temp.como(v_ger);
  assert (select count(*) from cotizacion_lineas where cotizacion_id in (c_isaac, c_juan, c_env)) = 4, 'la gerencia no ve todas las partidas';
  update cotizacion_lineas set cantidad = 6 where cotizacion_id = c_juan;
  get diagnostics v_n = row_count;
  assert v_n = 1, 'la gerencia no pudo editar la partida de Juan';
  update cotizacion_lineas set cantidad = 9 where cotizacion_id = c_env;
  get diagnostics v_n = row_count;
  assert v_n = 0, 'la gerencia editó una cotización enviada';

  -- 4. Almacén no ve partidas de cotización.
  perform pg_temp.como(v_alm);
  assert not exists (select 1 from cotizacion_lineas where cotizacion_id in (c_isaac, c_juan, c_env)), 'almacén ve partidas de cotización';
  assert not exists (select 1 from mis_cotizaciones_visibles() x where x in (c_isaac, c_juan, c_env)), 'almacén recibió cotizaciones visibles';

  -- 5. Llegadas de compras: quien no es de compras, almacén, planta, finanzas ni importaciones no ve nada.
  perform pg_temp.como(v_isaac);
  assert not exists (select 1 from v_oc_llegada), 'ventas ve las llegadas de compras';
end $$;

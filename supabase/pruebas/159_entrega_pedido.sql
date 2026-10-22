-- Entregar un pedido: quién puede, que pide quién recibió, deshacer en 15 minutos y
-- reabrir con motivo, la hoja de salida sin precios.
do $$
declare v_alm uuid; v_ven uuid; v_otro uuid; v_gv uuid; v_gp uuid; v_sup uuid; v_comp uuid;
  v_cli uuid; p uuid; l1 uuid; s uuid; h jsonb; v_ok boolean; v_err text;
begin
  v_alm := pg_temp.usuario('alm159@hegamex.com', '{almacen}');
  v_ven := pg_temp.usuario('ven159@hegamex.com', '{ventas}');
  v_otro := pg_temp.usuario('otro159@hegamex.com', '{ventas}');
  v_gv := pg_temp.usuario('gv159@hegamex.com', '{gerente_ventas}');
  v_gp := pg_temp.usuario('gp159@hegamex.com', '{gerente_produccion}');
  v_sup := pg_temp.usuario('sup159@hegamex.com', '{produccion}');
  v_comp := pg_temp.usuario('comp159@hegamex.com', '{compras}');
  insert into clientes (nombre, vendedor_id) values ('Cliente 159', v_ven) returning id into v_cli;
  insert into pedidos (cliente_id, vendedor_id, estado) values (v_cli, v_ven, 'listo') returning id into p;
  insert into pedido_lineas (pedido_id, titulo, cantidad, precio_unitario) values (p, 'Banda 159', 2, 123456) returning id into l1;
  update pedido_lineas set cantidad_entregada = 1 where id = l1;

  -- La planta, la gerencia de producción, compras y otro vendedor no entregan.
  foreach v_err in array array[v_gp::text, v_sup::text, v_comp::text, v_otro::text] loop
    perform pg_temp.como(v_err::uuid);
    begin perform entregar_pedido(p, 'Juan Cliente'); v_ok := true; exception when insufficient_privilege then v_ok := false; end;
    assert not v_ok, 'entregó alguien que no debe: ' || v_err;
  end loop;

  -- Almacén sí, pero diciendo quién recibió.
  perform pg_temp.como(v_alm);
  begin perform entregar_pedido(p, ''); v_ok := true; exception when check_violation then v_ok := false; end;
  assert not v_ok, 'entregó sin decir quién recibió';
  s := entregar_pedido(p, 'Juan Cliente', 'Recogió en planta');
  perform pg_temp.como_postgres();
  assert (select estado from pedidos where id = p) = 'entregado', 'no quedó entregado';
  assert (select cantidad_entregada from pedido_lineas where id = l1) = 2, 'no marcó lo entregado';
  assert (select recibio from pedido_salidas where id = s) = 'Juan Cliente', 'no guardó quién recibió';

  -- La hoja de salida: sin precios, con la entrega; la ve almacén (que no ve montos).
  perform pg_temp.como(v_alm);
  h := hoja_salida(p);
  assert h->'salidas'->0->>'recibio' = 'Juan Cliente', 'la hoja no trae la entrega';
  assert h::text not like '%123456%', 'la hoja trae el precio';
  assert (h->>'puede_entregar')::boolean, 'almacén debería poder entregar';

  -- Otro (que no fue) no la deshace; quien la marcó sí, en sus 15 minutos, y regresa todo.
  perform pg_temp.como(v_ven);
  begin perform deshacer_entrega(p); v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'el vendedor deshizo una entrega que no marcó';
  perform pg_temp.como(v_alm);
  perform deshacer_entrega(p);
  perform pg_temp.como_postgres();
  assert (select estado from pedidos where id = p) = 'listo', 'no regresó a listo';
  assert (select cantidad_entregada from pedido_lineas where id = l1) = 1, 'no regresó lo entregado de la partida';
  assert (select anulada_en from pedido_salidas where id = s) is not null, 'la salida no quedó anulada';

  -- El vendedor entrega lo suyo; pasados 15 minutos ya no la deshace, la gerencia de ventas sí y con motivo.
  perform pg_temp.como(v_ven);
  s := entregar_pedido(p, 'Pedro Cliente');
  perform pg_temp.como_postgres();
  update pedido_salidas set entregado_en = now() - interval '20 minutes' where id = s;
  perform pg_temp.como(v_ven);
  begin perform deshacer_entrega(p); v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'se deshizo pasados los 15 minutos';
  perform pg_temp.como(v_gv);
  begin perform deshacer_entrega(p); v_ok := true; exception when check_violation then v_ok := false; end;
  assert not v_ok, 'la gerencia reabrió sin motivo';
  perform deshacer_entrega(p, 'El cliente no recogió');
  perform pg_temp.como_postgres();
  assert (select estado from pedidos where id = p) = 'listo', 'la gerencia no reabrió';

  -- La hoja firmada solo puede ser de la carpeta del pedido.
  perform pg_temp.como(v_alm);
  s := entregar_pedido(p, 'Juan Cliente');
  begin perform adjuntar_hoja_salida(s, gen_random_uuid() || '/hoja.jpg'); v_ok := true; exception when raise_exception then v_ok := false; end;
  assert not v_ok, 'aceptó una hoja de otro pedido';
  perform adjuntar_hoja_salida(s, p || '/hoja.jpg');
  perform pg_temp.como_postgres();
  assert (select evidencia_ruta from pedido_salidas where id = s) = p || '/hoja.jpg', 'no guardó la hoja';

  -- Otro vendedor no ve la hoja de un pedido ajeno.
  perform pg_temp.como(v_otro);
  begin perform hoja_salida(p); v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'otro vendedor vio la hoja';
  assert (select count(*) from pedido_salidas where pedido_id = p) = 0, 'otro vendedor ve las salidas';
end $$;

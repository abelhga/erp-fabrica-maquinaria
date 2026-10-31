-- Correo desde el ERP: antes de mandar se revisa con las mismas reglas que «Marcar enviada» (y
-- no cambia nada); ya mandado, la cotización queda enviada con su nota en la bitácora y su
-- seguimiento, la OC queda enviada. Los tokens de Gmail no los lee nadie con sesión.
do $$
declare v_ven uuid; v_otro uuid; v_comp uuid; v_cli uuid; v_con uuid; c1 uuid; c2 uuid; v_prov uuid; v_oc uuid; v_op uuid;
  r jsonb; v_ok boolean; v_err text; v_act uuid; i int;
begin
  v_ven := pg_temp.usuario('ven217@hegamex.com', '{ventas}');
  v_otro := pg_temp.usuario('otro217@hegamex.com', '{ventas}');
  v_comp := pg_temp.usuario('comp217@hegamex.com', '{compras}');
  insert into clientes (nombre, vendedor_id) values ('Granos 217', v_ven) returning id into v_cli;
  insert into contactos (cliente_id, nombre, correo) values (v_cli, 'Rosa 217', ' rosa@granos217.mx ') returning id into v_con;
  insert into contactos (cliente_id, nombre, correo) values (v_cli, 'Compras Granos 217', 'compras@granos217.mx');

  -- 1. Preparar dice a quién y no cambia nada.
  perform pg_temp.como(v_ven);
  c1 := nueva_cotizacion(v_cli);
  update cotizaciones set contacto_id = v_con where id = c1;
  insert into cotizacion_lineas (cotizacion_id, titulo, precio_unitario) values (c1, 'Cribadora V3', 100000);
  r := correo_preparar('cotizacion', c1);
  assert r->'para' = '["rosa@granos217.mx"]'::jsonb and jsonb_array_length(r->'sugeridos') = 2 and not (r->>'ya_enviada')::boolean
         and r->>'archivo' like 'Cotizacion %.pdf', 'preparar: ' || r::text;
  assert (select estado = 'borrador' from cotizaciones where id = c1), 'preparar dejó la cotización enviada';

  --    Otro vendedor no la ve; compras no manda cotizaciones; ventas no manda órdenes.
  perform pg_temp.como(v_otro);
  begin perform correo_preparar('cotizacion', c1); v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'otro vendedor preparó la cotización ajena';

  -- 2. Mandada: queda enviada, con su seguimiento y la nota de a quién se mandó.
  perform pg_temp.como(v_ven);
  v_act := correo_marcar_enviado('cotizacion', c1, array['rosa@granos217.mx']);
  select oportunidad_id into v_op from cotizaciones where id = c1;
  assert (select estado = 'enviada' from cotizaciones where id = c1), 'no quedó enviada';
  assert exists (select 1 from seguimientos_cotizacion where oportunidad_id = v_op and estado = 'pendiente'), 'no agendó el seguimiento';
  assert (select tipo = 'correo' and hecha and descripcion like '%rosa@granos217.mx' from actividades where id = v_act), 'no anotó el correo';
  --    Reenviarla se puede y no cambia nada.
  r := correo_preparar('cotizacion', c1);
  assert (r->>'ya_enviada')::boolean, 'reenviar: ' || r::text;

  -- 3. Con el freno puesto no sale el correo (preparar falla antes de mandar).
  perform pg_temp.como_postgres();
  for i in 1..11 loop
    insert into oportunidades (cliente_id, titulo, etapa, vendedor_id) values (v_cli, 'Vieja 217 ' || i, 'cotizado', v_ven) returning id into v_op;
    insert into seguimientos_cotizacion (oportunidad_id, vendedor_id, vence) values (v_op, v_ven, hoy_mx() - 5);
  end loop;
  perform pg_temp.como(v_ven);
  c2 := nueva_cotizacion(v_cli);
  insert into cotizacion_lineas (cotizacion_id, titulo, precio_unitario) values (c2, 'Banda grip', 6000);
  begin perform correo_preparar('cotizacion', c2); v_ok := true;
  exception when others then v_ok := false; v_err := sqlerrm; end;
  assert not v_ok and v_err like '%seguimientos vencidos%', 'preparó con el freno puesto: ' || coalesce(v_err, '');

  -- 4. Orden de compra: sin precio no sale; con precio, preparar no la envía y marcar sí.
  perform pg_temp.como_postgres();
  insert into proveedores (nombre, correo) values ('Aceros 217', 'ventas@aceros217.mx') returning id into v_prov;
  insert into ordenes_compra (proveedor_id) values (v_prov) returning id into v_oc;
  insert into oc_lineas (orden_compra_id, descripcion, cantidad, costo_unitario) values (v_oc, 'PTR 4x4', 10, 0);
  perform pg_temp.como(v_ven);
  begin perform correo_preparar('orden_compra', v_oc); v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'ventas preparó una orden de compra';
  perform pg_temp.como(v_comp);
  begin perform correo_preparar('orden_compra', v_oc); v_ok := true; exception when others then v_ok := false; v_err := sqlerrm; end;
  assert not v_ok and v_err like '%sin costo%', 'preparó una OC sin precio: ' || coalesce(v_err, '');
  perform pg_temp.como_postgres();
  update oc_lineas set costo_unitario = 350 where orden_compra_id = v_oc;
  perform pg_temp.como(v_comp);
  r := correo_preparar('orden_compra', v_oc);
  assert r->'para' = '["ventas@aceros217.mx"]'::jsonb and (select estado = 'borrador' from ordenes_compra where id = v_oc), 'preparar OC: ' || r::text;
  perform correo_marcar_enviado('orden_compra', v_oc, array['ventas@aceros217.mx']);
  assert (select estado = 'enviada' and fecha_entrega is not null from ordenes_compra where id = v_oc), 'la OC no quedó enviada';

  -- 5. Lo enviado lo ve quien ve el documento; nadie lo escribe por fuera; los tokens no se leen.
  perform pg_temp.como_postgres();
  insert into correos_enviados (usuario_id, de, tipo, documento_id, folio, para, asunto, gmail_hilo)
  values (v_ven, 'ven217@hegamex.com', 'cotizacion', c1, 'x', array['rosa@granos217.mx'], 'Cotización', 'hilo217');
  insert into correo_cuentas (usuario_id, correo, refresh_token, alcances)
  values (v_ven, 'ven217@hegamex.com', 'secreto217', array['https://www.googleapis.com/auth/gmail.send', 'https://www.googleapis.com/auth/gmail.readonly']);
  perform pg_temp.como(v_ven);
  assert (select count(*) from correos_enviados where documento_id = c1) = 1, 'el vendedor no ve su correo';
  r := mi_correo();
  assert (r->>'conectado')::boolean and (r->>'lee')::boolean and r::text not like '%secreto217%', 'mi_correo: ' || r::text;
  begin perform 1 from correo_cuentas; v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'alguien con sesión leyó los tokens';
  begin insert into correos_enviados (usuario_id, de, tipo, documento_id, para, asunto) values (v_ven, 'x', 'cotizacion', c1, '{}', 'falso'); v_ok := true;
  exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'se registró un correo por fuera';
  perform pg_temp.como(v_otro);
  assert (select count(*) from correos_enviados where documento_id = c1) = 0, 'otro vendedor ve el correo ajeno';
  assert not (mi_correo()->>'conectado')::boolean, 'otro vendedor salió conectado';
end $$;

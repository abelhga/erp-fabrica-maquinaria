-- «Ya lo corregí» comprueba antes de cerrar. Si la regla mide un estado y lo vuelve a encontrar, no se
-- cierra. Si no se puede medir y el registro no cambió, pide decir qué se corrigió. Vale igual para
-- «Hecho» en Pendientes. Los patrones de dirección no cambian.
do $$
declare v_com uuid; v_dir uuid; v_prov uuid; v_art uuid; v_oc uuid; h1 uuid; h2 uuid; h3 uuid; h4 uuid; v_pend uuid;
  r jsonb; v_ok boolean; v_msg text; v_huella text;
begin
  v_com := pg_temp.usuario('com267@hegamex.com', '{compras}');
  v_dir := pg_temp.usuario('dir267@hegamex.com', '{direccion}');
  insert into proveedores (nombre) values ('Proveedor 267') returning id into v_prov;
  insert into articulos (clave, tipo, nombre) values ('T-267', 'componente', 'Tornillo 267 3/4 x 5') returning id into v_art;
  insert into ordenes_compra (proveedor_id, estado, fecha, fecha_entrega, creado_por)
  values (v_prov, 'enviada', current_date - 20, current_date - 10, v_com) returning id into v_oc;
  insert into oc_lineas (orden_compra_id, articulo_id, cantidad, costo_unitario) values (v_oc, v_art, 5, 10);

  -- La compra atrasada, tal como la saca la regla esta noche.
  select x.huella into v_huella from revision_r_oc_vencida_sin_recibir() x where x.registro_id = v_oc::text;
  assert v_huella is not null, 'la regla no encontró la compra atrasada de la prueba';
  insert into revision_hallazgos (origen, regla, modulo, tabla, registro_id, titulo, detalle, para, responsables, huella)
  values ('regla', 'oc_vencida_sin_recibir', 'compras', 'ordenes_compra', v_oc::text, 'OC 267 atrasada', 'x', 'responsable', array[v_com], v_huella)
  returning id into h1;
  -- Lo que señaló la IA sobre un artículo (no se puede volver a medir).
  insert into revision_hallazgos (origen, modulo, tabla, registro_id, titulo, detalle, para, responsables, huella, creado_en)
  values ('claude', 'compras', 'articulos', v_art::text, 'T-267 dice 3/4 x 5 sin unidad', 'x', 'responsable', array[v_com], 'p267-2', now())
  returning id into h2;
  insert into revision_hallazgos (origen, modulo, tabla, registro_id, titulo, detalle, para, responsables, huella, creado_en)
  values ('claude', 'compras', 'articulos', v_art::text, 'Otra de T-267', 'x', 'responsable', array[v_com], 'p267-3', now())
  returning id into h3;
  -- Un patrón para dirección.
  insert into revision_hallazgos (origen, modulo, titulo, detalle, para, huella)
  values ('claude', 'compras', 'Patrón 267', 'x', 'direccion', 'p267-4') returning id into h4;

  -- 1. La compra sigue sin entradas: «Ya lo corregí» no la cierra y dice qué hacer.
  perform pg_temp.como(v_com);
  r := revision_ya_lo_corregi(h1, null);
  assert r->>'estado' = 'abierto' and r->>'motivo' = 'sigue' and r->>'mensaje' like 'Todavía sale igual%', format('compra atrasada: %s', r);
  assert (select estado from revision_hallazgos where id = h1) = 'abierto', 'se cerró aunque seguía igual';
  begin perform revision_responder(h1, 'corregido', 'Ya llegó todo'); v_ok := true; exception when check_violation then v_ok := false; end;
  assert not v_ok, 'revision_responder directo se saltó la comprobación (ni con nota: la regla manda)';

  -- 2. Ya con la fecha nueva (lo que pide el detalle), sí se cierra.
  perform pg_temp.como_postgres();
  update ordenes_compra set fecha_entrega = current_date + 5 where id = v_oc;
  perform pg_temp.como(v_com);
  r := revision_ya_lo_corregi(h1, null);
  assert r->>'estado' = 'cerrado', format('con la fecha nueva no cerró: %s', r);
  assert (select estado from revision_hallazgos where id = h1) = 'corregido', 'no quedó corregido';

  -- 3. Lo de la IA sin ningún cambio en el artículo: pide la nota; con la nota, cierra.
  r := revision_ya_lo_corregi(h2, null);
  assert r->>'motivo' = 'falta_nota', format('sin cambio y sin nota debía pedir la nota: %s', r);
  r := revision_ya_lo_corregi(h2, 'ok');
  assert r->>'motivo' = 'falta_nota', 'una nota de dos letras no es decir qué se corrigió';
  r := revision_ya_lo_corregi(h2, 'Le puse la unidad en pulgadas al nombre');
  assert r->>'estado' = 'cerrado' and (select respuesta from revision_hallazgos where id = h2) like 'Le puse%', format('con nota: %s', r);

  -- 4. Si el artículo sí cambió desde que salió, no hace falta nota.
  perform pg_temp.como_postgres();
  update articulos set nombre = 'Tornillo 267 3/4" x 5"' where id = v_art;
  -- (en la prueba todo pasa en la misma transacción y now() no avanza: el cambio se fecha después)
  update bitacora set en = now() + interval '1 minute' where tabla = 'articulos' and registro_id = v_art::text and accion = 'cambio';
  perform pg_temp.como(v_com);
  r := revision_ya_lo_corregi(h3, null);
  assert r->>'estado' = 'cerrado', format('con el artículo ya cambiado debía cerrar: %s', r);

  -- 5. «Hecho» en Pendientes pasa por lo mismo.
  perform pg_temp.como_postgres();
  insert into revision_hallazgos (origen, modulo, tabla, registro_id, titulo, detalle, para, responsables, huella, creado_en)
  values ('claude', 'compras', 'proveedores', v_prov::text, 'Proveedor 267 sin RFC', 'x', 'responsable', array[v_com], 'p267-5', now())
  returning id into h2;
  insert into pendientes (titulo, responsable_id, creado_por, tabla, registro_id)
  values ('Proveedor 267 sin RFC', v_com, v_com, 'revision_hallazgos', h2::text) returning id into v_pend;
  perform pg_temp.como(v_com);
  v_ok := true;
  begin update pendientes set estado = 'hecho' where id = v_pend; exception when check_violation then v_ok := false; end;
  assert not v_ok, '«Hecho» en Pendientes cerró sin nota y sin cambio';
  update pendientes set estado = 'hecho', nota_cierre = 'Le pedí el RFC y ya lo capturé' where id = v_pend;
  assert (select estado from revision_hallazgos where id = h2) = 'corregido', '«Hecho» con nota no cerró el hallazgo';

  -- 6. El patrón de dirección («Ya lo revisé») no pide nada.
  perform pg_temp.como(v_dir);
  r := revision_ya_lo_corregi(h4, null);
  assert r->>'estado' = 'cerrado', format('el patrón de dirección: %s', r);

  -- 7. Lo que NO: otro usuario no contesta lo ajeno, ni la comprobación se llama desde la pantalla.
  perform pg_temp.como_postgres();
  insert into revision_hallazgos (origen, modulo, titulo, detalle, para, responsables, huella)
  values ('claude', 'compras', 'Ajeno 267', 'x', 'responsable', array[v_com], 'p267-6') returning id into h2;
  perform pg_temp.como(pg_temp.usuario('alm267@hegamex.com', '{almacen}'));
  begin perform revision_ya_lo_corregi(h2, 'Lo arreglé yo aunque no es mío'); v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'otro usuario contestó un hallazgo ajeno';
  assert not has_function_privilege('authenticated', 'public.revision_comprobar_corregido(public.revision_hallazgos, text)', 'execute'),
    'la comprobación no debe poder llamarse desde la pantalla';
end $$;

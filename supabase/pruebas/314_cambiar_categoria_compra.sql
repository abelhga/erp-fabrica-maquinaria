-- Una compra ya registrada se pasa a «Sin efectos» (u otra categoría) con motivo, y Resultados la
-- deja de contar como gasto aunque esté ligada a una orden de compra con material. Finanzas lo
-- hace; compras y ventas no. Sin motivo no pasa, y queda quién y por qué.
do $$
declare v_fin uuid; v_com uuid; v_prov uuid; v_mat uuid; v_oc uuid; v_m uuid; v_ok boolean; v_msj text; r record;
begin
  v_fin := pg_temp.usuario('fin314@hegamex.com', '{finanzas}');
  v_com := pg_temp.usuario('com314@hegamex.com', '{compras}');
  insert into proveedores (nombre, categoria) values ('Aceros prueba 314', 'Aceros') returning id into v_prov;
  insert into articulos (clave, tipo, nombre) values ('T314-PTR', 'materia_prima', 'PTR 314') returning id into v_mat;
  insert into ordenes_compra (proveedor_id, estado) values (v_prov, 'recibida') returning id into v_oc;
  insert into oc_lineas (orden_compra_id, articulo_id, cantidad, costo_unitario) values (v_oc, v_mat, 1, 1000);

  perform pg_temp.como(v_fin);
  v_m := registrar_movimiento_proveedor(p_proveedor => v_prov, p_tipo => 'compra', p_monto => 1160, p_fecha => hoy_planta() - 2,
    p_factura => 'A 314', p_metodo_pago => 'PPD', p_categoria => 'Aceros');
  perform pg_temp.como_postgres();
  insert into compra_oc (movimiento_id, orden_compra_id, como) values (v_m, v_oc, 'a_mano');
  -- Ligada a la orden con material, cuenta como material.
  assert (select bool_and(tipo_categoria_compra(categoria) = 'material' or categoria = 'Material de inventario')
          from compras_erp(hoy_planta() - 5, hoy_planta()) where movimiento_id = v_m), 'antes del cambio debía contar como material';

  -- Compras no la cambia.
  perform pg_temp.como(v_com);
  begin perform cambiar_categoria_compra(v_m, 'Sin efectos', 'no es de la empresa'); v_ok := true;
  exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'compras cambió la categoría de una compra';

  -- Finanzas sin motivo, no.
  perform pg_temp.como(v_fin);
  begin perform cambiar_categoria_compra(v_m, 'Sin efectos', ''); v_ok := true;
  exception when invalid_parameter_value then v_ok := false; get stacked diagnostics v_msj = message_text; end;
  assert not v_ok and v_msj like '%por qué%', format('cambió sin motivo: %s', v_msj);

  perform cambiar_categoria_compra(v_m, 'sin efectos', 'No es para Hegamex, la pidió otra empresa');
  -- Se guarda con la escritura que ya existe en el catálogo de categorías si alguien ya la usó; si no, como se escribió.
  select * into r from movimiento_categoria_cambios where movimiento_id = v_m;
  assert r.antes = 'Aceros' and lower(r.despues) = 'sin efectos' and r.por = v_fin and r.motivo like 'No es para%', format('constancia incompleta: %s', to_jsonb(r));
  perform pg_temp.como_postgres();
  -- Ya no cuenta como material aunque siga ligada a la orden: queda «fuera».
  assert (select bool_and(tipo_categoria_compra(categoria) = 'fuera') from compras_erp(hoy_planta() - 5, hoy_planta()) where movimiento_id = v_m),
    'ligada a la orden siguió contando como gasto';
  -- Al proveedor se le sigue debiendo igual.
  assert (select count(*) from movimientos_proveedor where id = v_m and monto = 1160) = 1, 'cambió el monto de la compra';

  -- Lo mismo otra vez no es un cambio.
  perform pg_temp.como(v_fin);
  begin perform cambiar_categoria_compra(v_m, 'Sin efectos', 'otra vez lo mismo'); v_ok := true;
  exception when invalid_parameter_value then v_ok := false; end;
  assert not v_ok, 'aceptó un cambio que no cambia nada';
end $$;

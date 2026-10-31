-- El XML afina en qué se gastó, pero no saca de «fuera» lo que la hoja puso fuera a propósito
-- («Sin efectos», activos, retiros): eso no va a la utilidad aunque la factura diga «aceros».
do $$
declare v_h1 bigint; v_h2 bigint; v_cat text;
begin
  insert into compras_hoja_categoria (proveedor_llave, categoria) values ('efectivo 218', 'Sin efectos'), ('fletes 218', 'Fletes (exclusivamente)')
  on conflict (proveedor_llave) do update set categoria = excluded.categoria;
  insert into historial_compras_hoja (fecha, proveedor_nombre, proveedor_llave, tipo, monto, factura)
  values ('2031-02-03', 'Efectivo 218', 'efectivo 218', 'Compra', 116000, 'A 1') returning id into v_h1;
  insert into historial_compras_hoja (fecha, proveedor_nombre, proveedor_llave, tipo, monto, factura)
  values ('2031-02-04', 'Fletes 218', 'fletes 218', 'Compra', 11600, 'B 2') returning id into v_h2;
  insert into cfdi_historico (uuid, rol, tipo, fecha, emisor_rfc, receptor_rfc, total, hoja_compra_id, amarre, categoria, categoria_origen) values
    ('21800000-0000-4000-8000-000000000001', 'recibida', 'I', '2031-02-03', 'EFE150101AA1', 'MHG160202UX1', 116000, v_h1, 'folio', 'Aceros', 'clave_sat'),
    ('21800000-0000-4000-8000-000000000002', 'recibida', 'I', '2031-02-04', 'FLE150101AA1', 'MHG160202UX1', 11600, v_h2, 'folio', 'Fletes y paquetería (ambos)', 'clave_sat');

  -- «Sin efectos» se queda fuera aunque el XML diga aceros.
  select string_agg(distinct categoria, ',') into v_cat from compras_hoja('2031-02-03', '2031-02-03');
  assert v_cat = 'Sin efectos', 'el XML sacó de «Sin efectos» una compra: ' || coalesce(v_cat, 'nada');
  -- Un proveedor que sí es gasto toma la categoría de lo que se compró.
  select string_agg(distinct categoria, ',') into v_cat from compras_hoja('2031-02-04', '2031-02-04');
  assert v_cat = 'Fletes y paquetería (ambos)', 'el XML no afinó la categoría de un gasto: ' || coalesce(v_cat, 'nada');
end $$;

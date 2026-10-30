-- La categoría de una compra se sugiere con la clave del SAT de cada concepto del XML: lo que
-- finanzas ya registró con esa clave manda; si no, el prefijo más largo de la tabla de arranque.
-- Cada concepto pesa lo que vale, la clave genérica no cuenta y solo finanzas la usa.
do $$
declare
  v_fin uuid; v_com uuid; v_ven uuid; v_prov uuid; v_art uuid; v_oc uuid; v_m uuid; r record; v_ok boolean;
begin
  v_fin := pg_temp.usuario('fin204@hegamex.com', '{finanzas}');
  v_com := pg_temp.usuario('com204@hegamex.com', '{compras}');
  v_ven := pg_temp.usuario('ven204@hegamex.com', '{ventas}');
  insert into proveedores (nombre, categoria) values ('T204 Transportes', 'Publicidad') returning id into v_prov;
  insert into articulos (clave, tipo, nombre) values ('T204-PTR', 'materia_prima', 'PTR 204') returning id into v_art;
  insert into ordenes_compra (proveedor_id, estado) values (v_prov, 'enviada') returning id into v_oc;
  insert into oc_lineas (orden_compra_id, articulo_id, cantidad, costo_unitario) values (v_oc, v_art, 1, 100);
  -- Ninguna clave de la prueba puede venir aprendida de otra compra de la base.
  update movimientos_proveedor set claves_sat = null where claves_sat && array['78101802', '27112801', '27111501', '31191501'];

  -- La tabla de arranque solo usa categorías que Resultados sabe contar.
  assert not exists (select 1 from categoria_clave_sat s where not exists (select 1 from compras_categorias k where k.categoria = lower(trim(s.categoria)))),
    'hay una categoría de arranque que Resultados no conoce';

  perform pg_temp.como(v_fin);
  -- 1. De la tabla de arranque, con el nombre que le da el SAT.
  select * into r from sugerir_categoria_sat(array['78101802']);
  assert r.categoria = 'Fletes y paquetería (ambos)' and r.fuente = 'catalogo' and r.descripcion = 'Transporte de correo y carga', format('flete: %s', r);
  -- 2. Gana el prefijo más largo: una broca (271128) no es «herramienta de mano» (2711).
  assert (select categoria from sugerir_categoria_sat(array['27112801'])) = 'Consumibles del taller', 'la clase no ganó a la familia';
  assert (select categoria from sugerir_categoria_sat(array['27111501'])) = 'Ferreteria en general', 'herramienta de mano';
  -- 3. La clave genérica y lo que no es clave no sugieren nada.
  assert not exists (select 1 from sugerir_categoria_sat(array['01010101', 'abc', '123'])), 'sugirió con la clave genérica';
  -- 4. Pesa el importe: $1,000 de flete y $100 de abrasivos es flete.
  assert (select categoria from sugerir_categoria_sat(array['31191501', '78101802'], array[100, 1000])) = 'Fletes y paquetería (ambos)', 'no pesó el importe';
  assert (select categoria from sugerir_categoria_sat(array['31191501', '78101802'], array[1000, 100])) = 'Consumibles del taller', 'no pesó el importe al revés';

  -- 5. Lo que finanzas registra con esa clave manda sobre la tabla de arranque; la compra guarda
  --    sus claves limpias (sin repetir, solo las de 8 dígitos).
  v_m := registrar_movimiento_proveedor(p_proveedor => v_prov, p_tipo => 'compra', p_monto => 116, p_factura => 'T-1',
    p_categoria => 'Fletes (exclusivamente)', p_claves_sat => array['78101802', '78101802', 'x', '01010101']);
  assert (select claves_sat from movimientos_proveedor where id = v_m) = array['01010101', '78101802'], 'no guardó las claves limpias';
  select * into r from sugerir_categoria_sat(array['78101802']);
  assert r.categoria = 'Fletes (exclusivamente)' and r.fuente = 'aprendida', format('no aprendió: %s', r);
  -- 6. Una compra con orden de compra no enseña: su categoría solo cuenta para lo que no tiene artículo.
  perform registrar_movimiento_proveedor(p_proveedor => v_prov, p_tipo => 'compra', p_monto => 116, p_factura => 'T-2',
    p_categoria => 'Aceros', p_ordenes => array[v_oc], p_claves_sat => array['31191501']);
  assert (select categoria from sugerir_categoria_sat(array['31191501'])) = 'Consumibles del taller', 'aprendió de una compra con orden';

  -- 7. Es de finanzas: compras no la usa y ventas no ve la tabla.
  perform pg_temp.como(v_com);
  begin perform sugerir_categoria_sat(array['78101802']); v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'compras usó la sugerencia de finanzas';
  perform pg_temp.como(v_ven);
  assert not exists (select 1 from categoria_clave_sat), 'ventas ve la tabla de claves';
  perform pg_temp.como_postgres();
end $$;

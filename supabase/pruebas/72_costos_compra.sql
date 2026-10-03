-- Las órdenes de compra: almacén y el taller saben qué viene y cuándo, pero no
-- cuánto costó. Antes compras nivel 1 (que tienen almacén, producción y sistemas)
-- bastaba para leer costo_unitario directo de la tabla.
do $$
declare v_folio text; v_comp uuid; v_alm uuid; v_taller uuid; v_fin uuid; v_rh uuid; v_prov uuid; v_art uuid; v_oc uuid; r record;
begin
  v_comp := pg_temp.usuario('compras@hegamex.com', '{compras}');
  v_alm := pg_temp.usuario('almacen@hegamex.com', '{almacen}');
  v_taller := pg_temp.usuario('taller@hegamex.com', '{produccion}');
  v_fin := pg_temp.usuario('finanzas@hegamex.com', '{finanzas}');
  v_rh := pg_temp.usuario('rrhh@hegamex.com', '{rrhh}');
  insert into proveedores (nombre) values ('T Proveedor de prueba') returning id into v_prov;
  insert into articulos (clave, tipo, nombre, unidad) values ('T-OC-1', 'componente', 'T Polea de prueba', 'pieza') returning id into v_art;
  insert into ordenes_compra (proveedor_id, estado, fecha_entrega) values (v_prov, 'enviada', current_date + 10) returning id into v_oc;
  insert into oc_lineas (orden_compra_id, articulo_id, cantidad, costo_unitario) values (v_oc, v_art, 10, 1234.56);
  select folio into v_folio from ordenes_compra where id = v_oc;

  perform pg_temp.como(v_alm);
  assert not exists (select 1 from oc_lineas where orden_compra_id = v_oc), 'almacén leyó la tabla con costos';
  assert not exists (select 1 from ordenes_compra where id = v_oc), 'almacén leyó el total de la orden';
  select * into r from v_oc_lineas where orden_compra_id = v_oc;
  assert r.cantidad = 10 and r.pendiente = 10, 'almacén sí ve qué viene, para recibirlo';
  assert r.costo_unitario is null and r.importe is null, 'almacén vio el costo en la vista';
  assert (select total from v_ordenes_compra where id = v_oc) is null, 'almacén vio el total en la vista';
  assert (select fecha_entrega from v_ordenes_compra where id = v_oc) = current_date + 10, 'almacén ve cuándo llega';

  -- …y lo sigue encontrando como antes de cerrar las tablas (buscador, inicio).
  assert exists (select 1 from buscar_global(v_folio) b where b::text like '%' || v_folio || '%'), 'almacén ya no encuentra la orden por folio';
  assert (indicadores()->'compras'->>'oc_abiertas')::int >= 1, 'almacén ve 0 compras en camino';

  perform pg_temp.como(v_taller);
  assert (select costo_unitario from v_oc_lineas where orden_compra_id = v_oc) is null, 'el taller vio el costo';

  perform pg_temp.como(v_comp);
  assert (select costo_unitario from v_oc_lineas where orden_compra_id = v_oc) = 1234.56, 'compras ve el costo';
  perform pg_temp.como(v_fin);
  assert (select costo_unitario from oc_lineas where orden_compra_id = v_oc) = 1234.56, 'finanzas ve el costo';

  -- Quien no tiene nada que ver con compras ni la orden ve.
  perform pg_temp.como(v_rh);
  assert not exists (select 1 from v_ordenes_compra where id = v_oc), 'RRHH vio una orden de compra';
  perform pg_temp.como_postgres();
end $$;

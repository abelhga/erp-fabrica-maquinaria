-- Folios de OC corridos: OC-26-4400 sigue a la última de la hoja y no reinicia con el año; una
-- orden que llega con su número de la hoja lo conserva.
do $$
declare v_prov uuid; v_n int; a text; b text; c text;
begin
  insert into proveedores (nombre) values ('Proveedor folios 173') returning id into v_prov;
  select ultimo into v_n from folios where serie = 'OC' and anio = 0;
  assert v_n >= 4399, 'la serie no arrancó después de la hoja: ' || coalesce(v_n::text, 'nula');

  insert into ordenes_compra (proveedor_id, fecha) values (v_prov, '2026-10-26') returning folio into a;
  insert into ordenes_compra (proveedor_id, fecha) values (v_prov, '2026-12-31') returning folio into b;
  insert into ordenes_compra (proveedor_id, fecha) values (v_prov, '2027-01-04') returning folio into c;
  assert a = format('OC-26-%s', v_n + 1), 'primer folio: ' || a;
  assert b = format('OC-26-%s', v_n + 2), 'segundo folio: ' || b;
  assert c = format('OC-27-%s', v_n + 3), 'el número reinició con el año: ' || c;

  -- La que viene de la hoja trae su número y no gasta uno de la serie.
  insert into ordenes_compra (proveedor_id, fecha, folio) values (v_prov, '2026-10-12', 'OC-26-1381') returning folio into a;
  assert a = 'OC-26-1381', 'no respetó el folio de la hoja';
  insert into ordenes_compra (proveedor_id, fecha) values (v_prov, '2026-10-27') returning folio into b;
  assert b = format('OC-26-%s', v_n + 4), 'la de la hoja se comió un número: ' || b;
end $$;

-- "Márgenes" aparte de "Costos": compras captura costos, pero no ve la utilidad, la política,
-- la fórmula del precio ni el margen propio de un artículo (ni, desde 149, el precio de lista).
do $$
declare v_comp uuid; v_fin uuid; v_adm uuid; v_ing uuid; v_dir uuid; v_art uuid; v_n int; j jsonb; r record; v_precio numeric;
begin
  v_comp := pg_temp.usuario('comp117@hegamex.com', '{compras}');
  v_fin := pg_temp.usuario('fin117@hegamex.com', '{finanzas}');
  v_adm := pg_temp.usuario('adm117@hegamex.com', '{ventas,administracion}');
  v_ing := pg_temp.usuario('ing117@hegamex.com', '{ingenieria}');
  v_dir := pg_temp.usuario('dir117@hegamex.com', '{direccion}');
  insert into articulos (clave, tipo, nombre) values ('T117', 'componente', 'Polea 117') returning id into v_art;
  insert into costos_articulo (articulo_id, costo, margen) values (v_art, 700, 0.4);
  perform recalcular_costos(array[v_art]);

  -- Compras: captura y ve el costo; ni precio de venta ni márgenes.
  perform pg_temp.como(v_comp);
  perform actualizar_costos(jsonb_build_array(jsonb_build_object('articulo_id', v_art, 'costo', 710, 'moneda', 'MXN')));
  assert (select costo from costos_articulo where articulo_id = v_art) = 710, 'compras ya no captura costos';
  assert (select precio from v_catalogo where id = v_art) is null, 'compras ve el precio de lista';
  select count(*) into v_n from politicas_precio;
  assert v_n = 0, 'compras ve las políticas de precio';
  assert desglose_precio(v_art) is null, 'compras recibió el desglose del precio (utilidad y recargos)';
  begin
    perform margen from costos_articulo where articulo_id = v_art;
    assert false, 'compras leyó el margen propio del artículo';
  exception when insufficient_privilege then null;
  end;
  begin
    update costos_articulo set margen = 0.1 where articulo_id = v_art;
    assert false, 'compras cambió el margen de un artículo';
  exception when insufficient_privilege then null;
  end;
  begin
    perform utilidad from historial_costeo where articulo_id = v_art;
    assert false, 'compras leyó la utilidad del historial de costeo';
  exception when insufficient_privilege then null;
  end;
  select count(*) into v_n from historial_costeo where articulo_id = v_art and costo_total is not null;
  assert v_n > 0, 'compras ya no ve la historia de costo';
  begin
    perform precio_lista from historial_costeo where articulo_id = v_art;
    assert false, 'compras leyó el precio de lista del historial de costeo';
  exception when insufficient_privilege then null;
  end;
  select * into r from serie_costeo(v_art) order by en desc limit 1;
  assert r.costo is not null and r.precio_real is null and r.precio_constante is null and r.utilidad is null,
    format('serie para compras: %s', row_to_json(r));
  -- Contestar una solicitud de precio: compras captura el costo; el precio que sale es de ventas (149).
  v_precio := precio_lista_estimado(v_art, 800);
  assert v_precio is null, format('compras recibió el precio estimado: %s', v_precio);
  begin
    perform fijar_margen_articulo(v_art, 0.2);
    assert false, 'compras fijó un margen';
  exception when insufficient_privilege then null;
  end;
  begin
    perform simular_precios(null, '{}', 0.3);
    assert false, 'compras simuló precios';
  exception when insufficient_privilege then null;
  end;

  -- Finanzas y la gerencia administrativa ven márgenes, no los cambian.
  foreach v_n in array array[1, 2] loop
    perform pg_temp.como(case v_n when 1 then v_fin else v_adm end);
    j := desglose_precio(v_art);
    assert j is not null and (j->>'margen_propio')::numeric = 0.4, format('sin desglose para %s: %s', v_n, j);
    assert (select count(*) from politicas_precio) > 0, 'no ve las políticas';
    begin
      perform fijar_margen_articulo(v_art, 0.2);
      assert false, 'finanzas fijó un margen';
    exception when insufficient_privilege then null;
    end;
  end loop;

  -- Ingeniería ya no ve márgenes (149): sin precio de venta no le sirven, y con ellos lo vería.
  perform pg_temp.como(v_ing);
  assert not exists (select 1 from politicas_precio) and desglose_precio(v_art) is null, 'ingeniería ve márgenes';
  update politicas_precio set utilidad = 0.99 where id = (select min(id) from politicas_precio);
  perform pg_temp.como_postgres();
  assert (select utilidad from politicas_precio where id = (select min(id) from politicas_precio)) <> 0.99, 'ingeniería cambió una política';

  perform pg_temp.como(v_dir);
  perform fijar_margen_articulo(v_art, 0.3);
  perform pg_temp.como_postgres();
  assert (select margen from costos_articulo where articulo_id = v_art) = 0.3, 'dirección no fijó el margen';
end $$;

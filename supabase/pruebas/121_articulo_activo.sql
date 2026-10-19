-- Inhabilitar un equipo o subensamble: sale del buscador y pierde el precio de lista, pero
-- dentro de los equipos que ya lo usan sigue costeando igual; reactivarlo lo regresa con su
-- precio. Solo quien mantiene el catálogo (costeo 2) lo cambia.
do $$
declare
  v_ing uuid; v_comp uuid; v_vend uuid; v_alm uuid;
  v_pieza uuid; v_sub uuid; v_eq uuid; v_costo_eq numeric; j jsonb;
begin
  v_ing := pg_temp.usuario('ing121@hegamex.com', '{ingenieria}');
  v_comp := pg_temp.usuario('comp121@hegamex.com', '{compras}');
  v_vend := pg_temp.usuario('vend121@hegamex.com', '{ventas}');
  v_alm := pg_temp.usuario('alm121@hegamex.com', '{almacen}');

  insert into articulos (clave, tipo, nombre) values ('T121-PZA', 'componente', 'Pieza 121') returning id into v_pieza;
  insert into articulos (clave, tipo, nombre) values ('T121-SUB', 'subensamble', 'Cabezal 121') returning id into v_sub;
  insert into articulos (clave, tipo, nombre) values ('T121-EQ', 'equipo', 'Banda 121') returning id into v_eq;
  insert into costos_articulo (articulo_id, costo) values (v_pieza, 1000);
  insert into bom_lineas (padre_id, hijo_id, cantidad) values (v_sub, v_pieza, 2), (v_eq, v_sub, 1);
  perform recalcular_costos(array[v_pieza]);
  assert (select precio from precios_lista where articulo_id = v_eq) > 0, 'el equipo de prueba no tiene precio';
  v_costo_eq := (select costo_total from costos_calculados where articulo_id = v_eq);

  -- Ventas y almacén no sacan equipos del cotizador (almacén sí puede escribir en articulos).
  perform pg_temp.como(v_vend);
  begin
    perform fijar_articulo_activo(v_eq, false);
    assert false, 'ventas inhabilitó un equipo';
  exception when insufficient_privilege then null;
  end;
  perform pg_temp.como(v_alm);
  begin
    perform fijar_articulo_activo(v_eq, false);
    assert false, 'almacén inhabilitó un equipo';
  exception when insufficient_privilege then null;
  end;

  -- Ingeniería inhabilita el subensamble: avisa que lo usa un equipo activo, sale del
  -- buscador, pero el equipo que ya lo trae sigue costando lo mismo y con precio.
  perform pg_temp.como(v_ing);
  j := fijar_articulo_activo(v_sub, false);
  assert (j->>'equipos_activos')::int = 1 and not (j->>'activo')::boolean, format('aviso al inhabilitar: %s', j);
  assert not exists (select 1 from buscar_articulos('T121-SUB') b where b.id = v_sub), 'el subensamble inhabilitado sigue en el buscador';
  perform pg_temp.como_postgres();
  assert (select costo_total from costos_calculados where articulo_id = v_eq) = v_costo_eq, 'el equipo cambió de costo al inhabilitar su subensamble';
  assert (select precio from precios_lista where articulo_id = v_eq) > 0, 'el equipo perdió su precio por un subensamble inhabilitado';

  -- El equipo: sin precio de lista y fuera del buscador; reactivado, regresa con precio.
  perform pg_temp.como(v_comp);
  perform fijar_articulo_activo(v_eq, false);
  assert not exists (select 1 from buscar_articulos('T121-EQ') b where b.id = v_eq), 'el equipo inhabilitado sigue en el buscador';
  perform pg_temp.como_postgres();
  assert not exists (select 1 from precios_lista where articulo_id = v_eq), 'el equipo inhabilitado conserva precio de lista';
  perform pg_temp.como(v_ing);
  j := fijar_articulo_activo(v_eq, true);
  assert (j->>'activo')::boolean, format('reactivar: %s', j);
  assert exists (select 1 from buscar_articulos('T121-EQ') b where b.id = v_eq), 'el equipo reactivado no regresó al buscador';
  perform pg_temp.como_postgres();
  assert (select precio from precios_lista where articulo_id = v_eq) > 0, 'el equipo reactivado no recuperó su precio';

  -- Los componentes no se inhabilitan desde aquí.
  perform pg_temp.como(v_ing);
  begin
    perform fijar_articulo_activo(v_pieza, false);
    assert false, 'se inhabilitó un componente desde equipos';
  exception when others then if sqlerrm not like '%equipos y subensambles%' then raise; end if;
  end;
  perform pg_temp.como_postgres();
  assert not has_function_privilege('anon', 'fijar_articulo_activo(uuid, boolean)', 'execute'), 'anon inhabilita equipos';
end $$;

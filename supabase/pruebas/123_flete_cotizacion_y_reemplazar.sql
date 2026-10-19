-- Bultos de una cotización (para cotizar el flete antes de la venta) y reemplazar un
-- componente en varias listas a la vez, que solo hace ingeniería (costeo 3).
do $$
declare
  v_dir uuid; v_vend uuid; v_vend2 uuid; v_ing uuid; v_comp uuid;
  v_pol uuid; v_sin uuid; v_srv uuid; v_nuevo uuid; v_eq1 uuid; v_eq2 uuid; v_cli uuid; v_cot uuid; j jsonb; v_n int;
begin
  v_dir := pg_temp.usuario('dir123@hegamex.com', '{direccion}');
  v_vend := pg_temp.usuario('vend123@hegamex.com', '{ventas}');
  v_vend2 := pg_temp.usuario('otro123@hegamex.com', '{ventas}');
  v_ing := pg_temp.usuario('ing123@hegamex.com', '{ingenieria}');
  v_comp := pg_temp.usuario('comp123@hegamex.com', '{compras}');

  insert into articulos (clave, tipo, nombre, paquete_kg, paquete_largo_cm, paquete_ancho_cm, paquete_alto_cm, paquete_piezas)
  values ('T123-POL', 'componente', 'Polea 123', 4, 30, 30, 20, 2) returning id into v_pol;
  insert into articulos (clave, tipo, nombre) values ('T123-SIN', 'componente', 'Pieza sin empaque 123') returning id into v_sin;
  insert into articulos (clave, tipo, nombre) values ('T123-SRV', 'servicio', 'Instalación 123') returning id into v_srv;
  insert into articulos (clave, tipo, nombre) values ('T123-NVO', 'componente', 'Polea nueva 123') returning id into v_nuevo;
  insert into articulos (clave, tipo, nombre) values ('T123-EQ1', 'equipo', 'Banda 123 A') returning id into v_eq1;
  insert into articulos (clave, tipo, nombre) values ('T123-EQ2', 'equipo', 'Banda 123 B') returning id into v_eq2;
  insert into bom_lineas (padre_id, hijo_id, cantidad) values (v_eq1, v_pol, 3), (v_eq2, v_pol, 5);

  -- ===========================================================================
  -- Bultos: 3 poleas de 2 por caja = 2 cajas; la pieza sin empaque, un bulto sin medidas;
  -- el servicio y la partida libre no viajan.
  -- ===========================================================================
  insert into clientes (nombre, vendedor_id) values ('T123 Cliente', v_vend) returning id into v_cli;
  perform pg_temp.como(v_vend);
  insert into cotizaciones (cliente_id) values (v_cli) returning id into v_cot;
  insert into cotizacion_lineas (cotizacion_id, orden, articulo_id, titulo, cantidad, precio_unitario) values
    (v_cot, 1, v_pol, 'Polea 123', 3, 100), (v_cot, 2, v_sin, 'Pieza sin empaque', 1, 50), (v_cot, 3, v_srv, 'Instalación', 1, 500);
  insert into cotizacion_lineas (cotizacion_id, orden, titulo, unidad, cantidad, precio_unitario) values (v_cot, 4, 'Flete a Zapopan', 'servicio', 1, 300);
  j := bultos_cotizacion(v_cot);
  assert jsonb_array_length(j) = 3, format('bultos: %s', j);
  assert (j->0->>'piezas')::numeric = 2 and (j->1->>'piezas')::numeric = 1 and (j->0->>'peso_kg')::numeric = 4, format('cajas de poleas: %s', j);
  assert j->2->>'peso_kg' is null and j->2->>'contenido' = 'Pieza sin empaque', format('sin empaque: %s', j);
  -- Otro vendedor no ve las partidas de esta cotización.
  perform pg_temp.como(v_vend2);
  assert jsonb_array_length(bultos_cotizacion(v_cot)) = 0, 'otro vendedor vio los bultos de una cotización ajena';

  -- ===========================================================================
  -- Reemplazar en varias listas: compras (costeo 2) no; ingeniería sí, solo donde se eligió.
  -- ===========================================================================
  perform pg_temp.como(v_comp);
  begin
    perform reemplazar_componente(v_pol, v_nuevo, array[v_eq1, v_eq2]);
    assert false, 'compras reemplazó en varias listas';
  exception when insufficient_privilege then null;
  end;
  perform pg_temp.como(v_ing);
  v_n := reemplazar_componente(v_pol, v_nuevo, array[v_eq1]);
  assert v_n = 1, format('reemplazadas: %s', v_n);
  perform pg_temp.como_postgres();
  assert (select hijo_id from bom_lineas where padre_id = v_eq1) = v_nuevo and (select cantidad from bom_lineas where padre_id = v_eq1) = 3,
    'el equipo elegido no quedó con la pieza nueva y la misma cantidad';
  assert (select notas from bom_lineas where padre_id = v_eq1) = 'antes T123-POL', 'no quedó nota de qué había antes';
  assert (select hijo_id from bom_lineas where padre_id = v_eq2) = v_pol, 'se cambió un equipo que no se eligió';

  -- Un equipo no puede quedar dentro de sí mismo.
  perform pg_temp.como(v_ing);
  begin
    perform reemplazar_componente(v_nuevo, v_eq1, array[v_eq1]);
    assert false, 'se metió un equipo dentro de sí mismo';
  exception when others then if sqlstate = '42501' then raise; end if;
  end;

  -- La configuración del recargo valida su rango.
  perform pg_temp.como(v_dir);
  begin
    perform fijar_config_skydropx('{"recargo_flete": 5}');
    assert false, 'se aceptó un recargo de 500 %';
  exception when others then if sqlerrm not like '%200 %%' then raise; end if;
  end;
  perform fijar_config_skydropx('{"recargo_flete": 0.2}');
  perform pg_temp.como_postgres();
  assert (select (valor->>'recargo_flete')::numeric from configuracion where clave = 'skydropx') = 0.2, 'no se guardó el recargo';
end $$;

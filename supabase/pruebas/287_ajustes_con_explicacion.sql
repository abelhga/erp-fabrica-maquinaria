-- Ajustes con explicación: lo de valor alto no se aprueba sin explicación; la gerencia la pide (también a
-- alguien fuera de almacén, que contesta desde Pendientes); almacén la escribe; y «están en otro almacén»
-- se resuelve como traspaso. Lo que NO: que almacén pida explicaciones o resuelva, ni que alguien sin
-- pendiente ni permiso escriba una explicación.
do $$
declare v_alm uuid; v_rh uuid; v_ger uuid; v_ven uuid; v_art uuid; v_bar uuid; v_pb int; v_c1 int;
        v_aj uuid; v_aj2 uuid; v_aj3 uuid; v_p uuid; v_ok boolean; v_msg text;
begin
  v_alm := pg_temp.usuario('alm287@hegamex.com', '{almacen}');
  v_rh := pg_temp.usuario('rh287@hegamex.com', '{rrhh}');
  v_ger := pg_temp.usuario('ger287@hegamex.com', '{gerente_produccion}');
  v_ven := pg_temp.usuario('ven287@hegamex.com', '{ventas}');
  v_pb := (select id from almacenes where nombre = 'Planta Baja');
  v_c1 := (select id from almacenes where nombre = 'Contenedor 1');
  insert into articulos (clave, tipo, nombre, unidad) values ('M-287', 'componente', 'Motovibrador 287', 'pieza') returning id into v_art;
  insert into articulos (clave, tipo, nombre, unidad) values ('B-287', 'componente', 'Tornillo 287', 'pieza') returning id into v_bar;
  insert into costos_articulo (articulo_id, costo) values (v_art, 3000), (v_bar, 1);
  insert into movimientos_inventario (tipo, articulo_id, almacen_id, cantidad, motivo)
  values ('inicial', v_art, v_pb, 6, 'Prueba 287'), ('inicial', v_bar, v_pb, 100, 'Prueba 287');

  perform pg_temp.como(v_alm);
  v_aj := solicitar_ajuste(v_art, v_pb, 2, 'Conteo 287: faltan 4');       -- 4 × $3,000 = $12,000
  v_aj2 := solicitar_ajuste(v_bar, v_pb, 95, 'Conteo 287: faltan 5');     -- $5: no pide explicación
  assert (select requiere_explicacion from v_ajustes where id = v_aj), 'el de $12,000 no pide explicación';
  assert not (select requiere_explicacion from v_ajustes where id = v_aj2), 'el de $5 pide explicación';
  -- Almacén no ve costos: la lista dice que necesita explicación, pero no cuánto vale.
  assert (select valor_diferencia from v_ajustes where id = v_aj) is null, 'almacén vio el valor';
  -- Almacén no pide explicaciones (eso es de quien autoriza).
  begin perform pedir_explicacion_ajuste(v_aj); v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'almacén pidió una explicación';

  -- 1. Sin explicación no se aprueba; el chico sí.
  perform pg_temp.como(v_ger);
  begin perform resolver_ajuste(v_aj, true); v_ok := true;
  exception when check_violation then v_ok := false; v_msg := sqlerrm; end;
  assert not v_ok and v_msg like '%nadie la ha explicado%', 'se aprobó sin explicación: ' || coalesce(v_msg, '');
  perform resolver_ajuste(v_aj2, true);
  assert (select cantidad from existencias where articulo_id = v_bar and almacen_id = v_pb) = 95, 'el chico no se aplicó';

  -- 2. La gerencia le pide la explicación a alguien de RH que estuvo en el conteo.
  v_p := pedir_explicacion_ajuste(v_aj, v_rh, '¿Dónde están las 4?');
  begin perform pedir_explicacion_ajuste(v_aj, v_rh); v_ok := true; exception when raise_exception then v_ok := false; end;
  assert not v_ok, 'se le pidió dos veces a la misma persona';
  perform pg_temp.como_postgres();
  assert (select responsable_id = v_rh and estado = 'abierto' and detalle like '%¿Dónde están las 4?%' from pendientes where id = v_p), 'no le llegó el pendiente';
  assert (select detalle not like '%$%' and detalle not like '%3000%' from pendientes where id = v_p), 'el pendiente trae el costo';

  -- Alguien sin pendiente ni permiso no escribe explicaciones.
  perform pg_temp.como(v_ven);
  begin perform explicar_ajuste(v_aj, 'Yo sé dónde están'); v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'ventas explicó un ajuste';

  -- 3. RH contesta desde Pendientes: sin nota no lo deja; con nota, queda la explicación en el ajuste.
  perform pg_temp.como(v_rh);
  begin update pendientes set estado = 'hecho' where id = v_p; v_ok := true; exception when check_violation then v_ok := false; end;
  assert not v_ok, 'cerró el pendiente sin explicar';
  update pendientes set estado = 'hecho', nota_cierre = 'Las 4 están en Contenedor 1, las movieron para la OP' where id = v_p;
  perform pg_temp.como_postgres();
  assert (select count(*) from ajuste_notas where ajuste_id = v_aj and tipo = 'explicacion' and por = v_rh) = 1, 'no quedó la explicación';

  -- 4. La gerencia lo resuelve como traspaso: Planta Baja baja 4, Contenedor 1 sube 4, el ajuste vale $0.
  perform pg_temp.como(v_ger);
  perform resolver_ajuste_como_traspaso(v_aj, v_c1, 'Las movieron para la OP');
  perform pg_temp.como_postgres();
  assert (select cantidad from existencias where articulo_id = v_art and almacen_id = v_pb) = 2, 'Planta Baja no quedó en 2';
  assert (select cantidad from existencias where articulo_id = v_art and almacen_id = v_c1) = 4, 'Contenedor 1 no recibió las 4';
  assert (select estado = 'aprobado' and comentario like 'Traspaso a Contenedor 1%' from ajustes_inventario where id = v_aj), 'no quedó resuelto';
  assert (select coalesce(sum(m.cantidad * m.costo_unitario), 0) from movimientos_inventario m where m.ajuste_id = v_aj) = 0, 'el traspaso valió como pérdida';
  assert (select aplicado from v_ajustes where id = v_aj) = -4, 'no dice que se aplicaron -4';

  -- 5. Almacén explica directo en el ajuste y eso cierra el pendiente; al resolver, los que quedan se cancelan.
  perform pg_temp.como(v_alm);
  v_aj3 := solicitar_ajuste(v_art, v_c1, 1, 'Conteo 287 contenedor');  -- faltan 3 × $3,000
  perform pg_temp.como(v_ger);
  perform pedir_explicacion_ajuste(v_aj3);  -- a quien lo pidió
  perform pedir_explicacion_ajuste(v_aj3, v_rh);
  perform pg_temp.como(v_alm);
  begin perform explicar_ajuste(v_aj3, 'corto'); v_ok := true; exception when raise_exception then v_ok := false; end;
  assert not v_ok, 'aceptó una explicación vacía';
  perform explicar_ajuste(v_aj3, 'Se usaron en la OP de la cribadora sin registrar la salida');
  perform pg_temp.como_postgres();
  assert not exists (select 1 from pendientes where tabla = 'ajustes_inventario' and registro_id = v_aj3::text and estado = 'abierto'), 'quedaron pendientes abiertos';
  assert (select count(*) from ajuste_notas where ajuste_id = v_aj3 and tipo = 'explicacion') = 1, 'se anotó dos veces';
  perform pg_temp.como(v_ger);
  perform resolver_ajuste(v_aj3, true, 'Visto');
  assert (select cantidad from existencias where articulo_id = v_art and almacen_id = v_c1) = 1, 'no se aplicó con explicación';
end $$;

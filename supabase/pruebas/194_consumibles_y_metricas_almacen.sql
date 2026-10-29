-- Consumibles del taller: con el switch, lo de las categorías marcadas sale a nombre de quien lo
-- recibe y no a la orden (ni falta, ni se aparta, ni cuenta contra el bono de almacén). Cada
-- surtido guarda sus partidas. Métricas de almacén: quién las ve y de dónde salen.
do $$
declare v_alm uuid; v_ven uuid; v_com uuid; v_rh uuid; v_dir uuid; v_pb int; v_cat int; v_tubo uuid; v_disco uuid; v_guante uuid; v_polea uuid;
  v_eq uuid; v_op uuid; v_op2 uuid; v_ev bigint; v_ok boolean; v_n int; m jsonb; v_precios bigint;
begin
  v_alm := pg_temp.usuario('alm194@hegamex.com', '{almacen}');
  v_ven := pg_temp.usuario('ven194@hegamex.com', '{ventas}');
  v_com := pg_temp.usuario('com194@hegamex.com', '{compras}');
  v_rh := pg_temp.usuario('rh194@hegamex.com', '{rrhh}');
  v_dir := pg_temp.usuario('dir194@hegamex.com', '{direccion}');
  select id into v_pb from almacenes where nombre = 'Planta Baja';
  insert into categorias (nombre, consumible_taller) values ('P194 Discos y EPP', true) returning id into v_cat;
  insert into articulos (clave, tipo, nombre, unidad) values ('P194-TUBO', 'materia_prima', 'Tubo 194', 'metro') returning id into v_tubo;
  insert into articulos (clave, tipo, nombre, unidad, categoria_id) values ('P194-DISCO', 'componente', 'Disco 194', 'pieza', v_cat) returning id into v_disco;
  insert into articulos (clave, tipo, nombre, unidad, categoria_id) values ('P194-GUANTE', 'componente', 'Guante 194', 'par', v_cat) returning id into v_guante;
  insert into articulos (clave, tipo, nombre, unidad) values ('P194-POLEA', 'componente', 'Polea 194', 'pieza') returning id into v_polea;
  insert into articulos (clave, tipo, nombre) values ('P194-EQ', 'equipo', 'Banda 194') returning id into v_eq;
  insert into movimientos_inventario (tipo, articulo_id, almacen_id, cantidad)
  values ('inicial', v_tubo, v_pb, 30), ('inicial', v_disco, v_pb, 50), ('inicial', v_guante, v_pb, 10), ('inicial', v_polea, v_pb, 4);

  insert into ordenes_produccion (articulo_id, cantidad, estado) values (v_eq, 1, 'liberada') returning id into v_op;
  insert into op_materiales (orden_id, articulo_id, requerido) values (v_op, v_tubo, 12), (v_op, v_disco, 3);
  -- Con el switch apagado el disco se aparta como cualquier material.
  update configuracion set valor = 'false' where clave = 'almacen_consumibles_taller';
  perform pg_temp.como(v_alm);
  perform apartar_material(v_op);
  perform pg_temp.como_postgres();
  assert (select apartado from v_op_material where orden_id = v_op and articulo_id = v_disco) = 3, 'con el switch apagado no apartó el disco';

  -- 1. Encender el switch: solo almacén (administrar) o sistemas. Suelta lo apartado de consumibles.
  select count(*) into v_precios from precios_lista;
  perform pg_temp.como(v_com);
  begin perform fijar_consumibles_taller(true, null); v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'compras cambió el switch de consumibles';
  perform pg_temp.como(v_alm);
  v_n := fijar_consumibles_taller(true, array(select id from categorias where consumible_taller));
  assert v_n = 1, format('al encender debía soltar 1 reserva de consumible, soltó %s', v_n);
  perform pg_temp.como_postgres();
  assert (select count(*) from precios_lista) = v_precios, 'guardar el switch recalculó el costeo';
  select row_to_json(x)::jsonb into m from v_op_material x where orden_id = v_op and articulo_id = v_disco;
  assert (m->>'del_taller')::boolean and (m->>'faltante')::numeric = 0 and (m->>'por_surtir')::numeric = 0 and (m->>'apartado')::numeric = 0,
    format('el disco de la receta todavía cuenta para la orden: %s', m);
  perform pg_temp.como(v_alm);
  assert (select partidas from ordenes_por_surtir() where id = v_op) = 1, 'la cola de almacén cuenta el disco';
  perform pg_temp.como_postgres();

  -- 2. Surtir tubo + disco (de la receta) + guante (no viene): el tubo a la orden; disco y guante al
  --    taller a nombre de quien recibe, sin pedir motivo y sin tocar la lista.
  perform pg_temp.como(v_alm);
  perform surtir_material(v_op, jsonb_build_array(
    jsonb_build_object('articulo_id', v_tubo, 'cantidad', 12, 'almacen_id', v_pb),
    jsonb_build_object('articulo_id', v_disco, 'cantidad', 2, 'almacen_id', v_pb),
    jsonb_build_object('articulo_id', v_guante, 'cantidad', 1, 'almacen_id', v_pb)), 'Leonardo Pérez');
  perform pg_temp.como_postgres();
  select id into v_ev from op_eventos where orden_id = v_op and tipo = 'surtido' order by id desc limit 1;
  assert (select nota from op_eventos where id = v_ev) = '3 partida(s), 2 de consumo del taller', format('nota: %s', (select nota from op_eventos where id = v_ev));
  assert (select count(*) from movimientos_inventario where tipo = 'salida_consumo' and recibio = 'Leonardo Pérez' and orden_produccion_id is null
          and articulo_id in (v_disco, v_guante) and motivo like 'Consumo del taller · %') = 2, 'disco y guante no salieron al taller a su nombre';
  assert (select surtido from op_materiales where orden_id = v_op and articulo_id = v_disco) = 0, 'el disco se contó como surtido a la orden';
  assert not exists (select 1 from op_materiales where orden_id = v_op and articulo_id = v_guante), 'el guante entró a la lista como fuera de lista';
  assert (select cantidad from existencias where articulo_id = v_disco and almacen_id = v_pb) = 48, 'no descontó los discos';

  -- 3. Las partidas del aviso: las ve quien ve la orden (el vendedor también), no RRHH.
  perform pg_temp.como(v_ven);
  assert (select count(*) from partidas_surtido(v_ev)) = 3, 'el vendedor no ve las 3 partidas';
  assert (select count(*) filter (where consumo) from partidas_surtido(v_ev)) = 2, 'no marca lo que fue consumo del taller';
  assert (select nombre from partidas_surtido(v_ev) where not consumo) = 'Tubo 194', 'la partida a la orden no es el tubo';
  perform pg_temp.como(v_rh);
  begin perform partidas_surtido(v_ev); v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'RRHH vio las partidas de un surtido';

  -- 4. Fuera de lista que no es consumible: pide motivo y queda marcado para cuestionarlo.
  perform pg_temp.como(v_alm);
  begin
    perform surtir_material(v_op, jsonb_build_array(jsonb_build_object('articulo_id', v_polea, 'cantidad', 1, 'almacen_id', v_pb)), 'Leonardo Pérez');
    v_ok := true;
  exception when raise_exception then v_ok := sqlerrm not like '%escribe el motivo%'; end;
  assert not v_ok, 'una polea fuera de lista salió sin motivo';
  perform surtir_material(v_op, jsonb_build_array(jsonb_build_object('articulo_id', v_polea, 'cantidad', 1, 'almacen_id', v_pb, 'motivo', 'Se dañó la de la lista')), 'Leonardo Pérez');
  perform pg_temp.como_postgres();
  select id into v_ev from op_eventos where orden_id = v_op and tipo = 'surtido' order by id desc limit 1;
  perform pg_temp.como(v_alm);
  assert (select fuera_de_lista and motivo = 'Se dañó la de la lista' from partidas_surtido(v_ev)), 'la polea no quedó como fuera de lista con su motivo';

  -- 5. Salida a consumo suelta con quién la recibe; el historial lo enseña.
  perform pg_temp.como(v_alm);
  perform registrar_salida(v_disco, v_pb, 5, 'salida_consumo', 'Taller', null, 'Genaro Rodríguez');
  assert (select recibio from v_movimientos where articulo_id = v_disco and tipo = 'salida_consumo' order by id desc limit 1) = 'Genaro Rodríguez',
    'el historial no dice quién recibió';

  -- 6. Métricas: almacén sí (sin montos), ventas no, dirección con montos.
  perform pg_temp.como_postgres();
  update ordenes_produccion set estado = 'terminada', terminada_en = now() where id = v_op;
  perform pg_temp.como(v_alm);
  m := metricas_almacen(current_date - 6, current_date);
  assert not (m->>'con_costos')::boolean and (m->'resumen'->>'fuera_lista_valor') is null, 'almacén vio montos en las métricas';
  assert (m->'resumen'->>'fuera_lista')::int >= 1 and exists (select 1 from jsonb_array_elements(m->'fuera_lista') x where x->>'articulo' = 'Polea 194' and x->>'recibio' = 'Leonardo Pérez'),
    'la polea fuera de lista no está en las métricas';
  assert (select (x->>'cantidad')::numeric from jsonb_array_elements(m->'personas') x where x->>'recibio' = 'Genaro Rodríguez' and x->>'categoria' = 'P194 Discos y EPP') = 5,
    'el consumo de Genaro no está por persona';
  -- La receta preveía 3 discos para la orden terminada; salieron 7 (2 de Leonardo y 5 de Genaro).
  assert (select (x->>'real')::numeric = 7 and (x->>'previsto')::numeric = 3 from jsonb_array_elements(m->'receta') x where x->>'clave' = 'P194-DISCO'),
    format('consumo contra receta del disco: %s', (select x from jsonb_array_elements(m->'receta') x where x->>'clave' = 'P194-DISCO'));
  perform pg_temp.como(v_ven);
  begin perform metricas_almacen(current_date - 6, current_date); v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'ventas vio las métricas de almacén';
  perform pg_temp.como(v_dir);
  assert (metricas_almacen(current_date - 6, current_date)->>'con_costos')::boolean, 'dirección no vio montos';

  -- 7. El objetivo «surtido a producción»: el disco que ya no se surte a la orden no la marca incompleta.
  perform pg_temp.como_postgres();
  m := objetivo_medir('surtido_produccion', null, null, current_date);
  assert not (select (x->>'cuenta')::boolean from jsonb_array_elements(m->'evidencias') x where x->>'referencia' = v_op::text),
    format('la orden terminada contó como incompleta por el disco: %s', m);

  -- 8. Apagar el switch: el disco vuelve a ser material de la orden. Lo entregado antes del ERP de un
  --    consumible, con el switch encendido, no se registra contra la orden.
  insert into ordenes_produccion (articulo_id, cantidad, estado, creado_en) values (v_eq, 1, 'liberada', '2026-10-16') returning id into v_op2;
  insert into op_materiales (orden_id, articulo_id, requerido) values (v_op2, v_disco, 4);
  perform pg_temp.como(v_alm);
  begin perform surtir_material(v_op2, jsonb_build_array(jsonb_build_object('articulo_id', v_disco, 'cantidad', 4)), null, true); v_ok := true;
  exception when raise_exception then v_ok := sqlerrm not like '%consumible del taller%'; end;
  assert not v_ok, 'registró un consumible como entregado antes del ERP a la orden';
  perform fijar_consumibles_taller(false, null);
  perform surtir_material(v_op2, jsonb_build_array(jsonb_build_object('articulo_id', v_disco, 'cantidad', 1, 'almacen_id', v_pb)), 'Pedro');
  perform pg_temp.como_postgres();
  assert (select surtido from op_materiales where orden_id = v_op2 and articulo_id = v_disco) = 1, 'con el switch apagado el disco no se surtió a la orden';
  assert (select por_surtir from v_op_material where orden_id = v_op2 and articulo_id = v_disco) = 3, 'con el switch apagado el disco no está por surtir';
end $$;

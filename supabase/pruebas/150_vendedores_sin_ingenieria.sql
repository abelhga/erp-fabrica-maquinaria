-- Los vendedores siguen el avance de sus equipos (y cuántas partidas faltan), pero no
-- leen cómo se fabrican: lista de materiales, horas del costeo, parámetros, planos ni el
-- material de la orden. Sí ven fichas técnicas y fotos vigentes para el cliente.
do $$
declare v_vend uuid; v_gv uuid; v_rec uuid; v_taller uuid; v_alm uuid; v_ing uuid; v_comp uuid; v_mtto uuid;
  v_eq uuid; v_tubo uuid; v_op uuid; v_plano uuid; v_ficha uuid; r record;
begin
  v_vend := pg_temp.usuario('vend150@hegamex.com', '{ventas}');
  v_gv := pg_temp.usuario('gv150@hegamex.com', '{gerente_ventas}');
  v_rec := pg_temp.usuario('rec150@hegamex.com', '{recepcion}');
  v_taller := pg_temp.usuario('taller150@hegamex.com', '{produccion}');
  v_alm := pg_temp.usuario('alm150@hegamex.com', '{almacen}');
  v_ing := pg_temp.usuario('ing150@hegamex.com', '{ingenieria}');
  v_comp := pg_temp.usuario('comp150@hegamex.com', '{compras}');
  v_mtto := pg_temp.usuario('mtto150@hegamex.com', '{mantenimiento}');

  insert into articulos (clave, tipo, nombre, se_vende) values ('T150-EQ', 'equipo', 'Banda 150', true) returning id into v_eq;
  insert into articulos (clave, tipo, nombre) values ('T150-TUBO', 'materia_prima', 'Tubo 150') returning id into v_tubo;
  insert into bom_lineas (padre_id, hijo_id, cantidad) values (v_eq, v_tubo, 6);
  insert into bom_operaciones (articulo_id, etapa_id, horas) values (v_eq, (select id from etapas where nombre = 'Pailería'), 30);
  insert into documentos_tecnicos (folio, revision, articulo_id, tipo, titulo, drive_url, estado)
  values ('T150-PL', 'A', v_eq, 'plano', 'Plano general', 'https://drive.google.com/plano150', 'vigente') returning id into v_plano;
  insert into documentos_tecnicos (folio, revision, articulo_id, tipo, titulo, drive_url, estado)
  values ('T150-FT', 'A', v_eq, 'ficha', 'Ficha técnica', 'https://drive.google.com/ficha150', 'vigente') returning id into v_ficha;
  insert into ordenes_produccion (articulo_id, cantidad, estado) values (v_eq, 1, 'liberada') returning id into v_op;
  insert into op_materiales (orden_id, articulo_id, requerido) values (v_op, v_tubo, 6);
  insert into op_operaciones (orden_id, etapa_id, horas_estimadas) values (v_op, (select id from etapas where nombre = 'Pailería'), 30);

  -- Ventas, su gerencia y recepción: ni lista, ni horas, ni planos, ni material; sí la ficha.
  for r in select * from (values (v_vend, 'ventas'), (v_gv, 'gerencia de ventas'), (v_rec, 'recepción'), (v_mtto, 'mantenimiento')) x(u, quien) loop
    perform pg_temp.como(r.u);
    assert not puede('costeo', 1), format('%s tiene ingeniería', r.quien);
    assert not exists (select 1 from bom_lineas where padre_id = v_eq), format('%s vio la lista de materiales', r.quien);
    assert not exists (select 1 from bom_operaciones where articulo_id = v_eq), format('%s vio las horas del costeo', r.quien);
    assert not exists (select 1 from op_materiales where orden_id = v_op), format('%s vio el material de la orden', r.quien);
    assert not exists (select 1 from documentos_tecnicos where id = v_plano), format('%s vio el plano', r.quien);
  end loop;
  perform pg_temp.como(v_vend);
  assert (select count(*) from fichas_de_articulos(array[v_eq])) = 1, 'ventas no ve la ficha técnica';
  -- El avance sigue: la orden y cuántas partidas le faltan.
  assert (select materiales_faltantes from v_tablero_produccion where id = v_op) = 1, 'ventas perdió el conteo de faltantes';
  perform pg_temp.como(v_rec);
  assert (select count(*) from fichas_de_articulos(array[v_eq])) = 1, 'recepción no ve la ficha técnica';

  -- Quien trabaja con ello lo sigue viendo.
  for r in select * from (values (v_taller, 'el taller'), (v_alm, 'almacén'), (v_ing, 'ingeniería'), (v_comp, 'compras')) x(u, quien) loop
    perform pg_temp.como(r.u);
    assert exists (select 1 from op_materiales where orden_id = v_op), format('%s ya no ve el material de la orden', r.quien);
    assert (select materiales_faltantes from v_tablero_produccion where id = v_op) = 1, format('%s: faltantes', r.quien);
  end loop;
  perform pg_temp.como(v_taller);
  assert exists (select 1 from bom_lineas where padre_id = v_eq) and exists (select 1 from documentos_tecnicos where id = v_plano),
    'el taller ya no ve la lista o el plano';
end $$;

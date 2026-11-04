-- Material de una orden: agregar un subensamble (fabricado aquí o ya hecho), reemplazar y quitar
-- dejando constancia (tachado, con motivo), volver a poner, y un solo evento por cambio. El taller
-- no lo cambia; una orden cerrada tampoco.
do $$
declare
  v_ing uuid; v_gp uuid; v_taller uuid; v_eq uuid; v_a uuid; v_b uuid; v_c uuid; v_d uuid; v_sub uuid; v_op uuid;
  m_a uuid; m_b uuid; m_d uuid; n int; v_ok boolean; r record; v_eventos int;
begin
  v_ing := pg_temp.usuario('ing238@hegamex.com', '{ingenieria}');
  v_taller := pg_temp.usuario('taller238@hegamex.com', '{produccion}');
  insert into articulos (clave, tipo, nombre) values ('T238-EQ', 'equipo', 'Banda 238') returning id into v_eq;
  insert into articulos (clave, tipo, nombre) values ('T238-A', 'componente', 'Chumacera 238') returning id into v_a;
  insert into articulos (clave, tipo, nombre) values ('T238-B', 'componente', 'Rodillo 238') returning id into v_b;
  insert into articulos (clave, tipo, nombre) values ('T238-C', 'materia_prima', 'Lámina 238') returning id into v_c;
  insert into articulos (clave, tipo, nombre) values ('T238-D', 'componente', 'Chumacera con cuñero 238') returning id into v_d;
  insert into articulos (clave, tipo, nombre) values ('T238-S', 'subensamble', 'Tensor 238') returning id into v_sub;
  insert into bom_lineas (padre_id, hijo_id, cantidad) values (v_eq, v_a, 4), (v_eq, v_b, 10);
  insert into bom_lineas (padre_id, hijo_id, cantidad) values (v_sub, v_b, 2), (v_sub, v_c, 1.5);
  v_gp := pg_temp.usuario('gp238@hegamex.com', '{gerente_produccion}');
  perform pg_temp.como(v_gp);
  v_op := crear_orden_produccion(v_eq, 1);
  perform pg_temp.como_postgres();
  select id into m_a from op_materiales where orden_id = v_op and articulo_id = v_a;
  select id into m_b from op_materiales where orden_id = v_op and articulo_id = v_b;
  select count(*) into v_eventos from op_eventos where orden_id = v_op;

  -- 1. El taller no cambia la lista.
  perform pg_temp.como(v_taller);
  begin perform quitar_material_orden(m_a, 'No va'); v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'el taller quitó material';

  -- 2. Subensamble para fabricarlo aquí ×2: se suman sus componentes (rodillo 10 + 4) y entra la lámina con su ruta.
  perform pg_temp.como(v_ing);
  n := agregar_subensamble_orden(v_op, v_sub, 2, 'El cliente pidió tensor doble');
  assert n = 2, format('partidas del subensamble: %s', n);
  assert (select requerido from op_materiales where id = m_b) = 14, 'no sumó el rodillo del subensamble';
  select * into r from op_materiales where orden_id = v_op and articulo_id = v_c;
  assert r.requerido = 3 and r.ruta = 'Tensor 238' and r.agregado, format('lámina: %s %s', r.requerido, r.ruta);
  assert (select count(*) from op_eventos where orden_id = v_op) = v_eventos + 1, 'un subensamble debía ser un solo evento';
  --    Ya hecho: entra como una pieza.
  perform agregar_subensamble_orden(v_op, v_sub, 1, null, 'pieza');
  assert (select requerido from op_materiales where orden_id = v_op and articulo_id = v_sub) = 1, 'no entró el subensamble como pieza';

  -- 3. Reemplazar: el de antes queda tachado con su cantidad y motivo; el nuevo dice a quién reemplaza.
  begin perform reemplazar_material_orden(m_a, v_d, 4, ''); v_ok := true; exception when others then v_ok := false; end;
  assert not v_ok, 'reemplazó sin motivo';
  m_d := reemplazar_material_orden(m_a, v_d, 4, 'La de la lista no trae cuñero');
  select * into r from v_op_material where id = m_a;
  assert r.requerido = 0 and r.requerido_antes = 4 and r.quitado_en is not null and r.reemplazado_por = 'Chumacera con cuñero 238'
    and r.motivo_quitado = 'La de la lista no trae cuñero', format('el reemplazado: %s', row_to_json(r));
  select * into r from v_op_material where id = m_d;
  assert r.requerido = 4 and r.reemplaza_a = m_a and r.reemplaza_a_nombre = 'Chumacera 238', format('el nuevo: %s', row_to_json(r));
  assert exists (select 1 from op_eventos where orden_id = v_op and nota like 'Se reemplazó Chumacera 238 (4 pieza) por Chumacera con cuñero 238 (4 pieza): La de la lista no trae cuñero%'),
    format('evento: %s', (select string_agg(nota, ' | ') from op_eventos where orden_id = v_op));

  -- 4. Quitar deja constancia y no pide nada a compras; volver a ponerlo regresa la cantidad.
  perform quitar_material_orden(m_b, 'Se usan rodillos de la otra banda');
  select * into r from v_op_material where id = m_b;
  assert r.requerido = 0 and r.requerido_antes = 14 and r.quitado_por is not null and r.faltante = 0 and r.por_surtir = 0, format('quitado: %s', row_to_json(r));
  begin perform quitar_material_orden(m_b, 'Otra vez'); v_ok := true; exception when others then v_ok := false; end;
  assert not v_ok, 'se quitó dos veces';
  perform reponer_material_orden(m_b);
  select * into r from op_materiales where id = m_b;
  assert r.requerido = 14 and r.quitado_en is null and r.requerido_antes is null, 'no regresó la cantidad';
  --    Agregar un material quitado lo vuelve a poner en lugar de chocar.
  perform agregar_material_orden(v_op, v_a, 2, 'Siempre sí, de repuesto');
  select * into r from op_materiales where id = m_a;
  assert r.requerido = 2 and r.quitado_en is null, 'no reactivó el material quitado';
  begin perform agregar_material_orden(v_op, v_a, 1, null); v_ok := true; exception when others then v_ok := false; end;
  assert not v_ok, 'agregó un material que ya estaba';

  -- 5. Orden cerrada: ya no se cambia.
  perform pg_temp.como_postgres();
  update ordenes_produccion set estado = 'terminada' where id = v_op;
  perform pg_temp.como(v_ing);
  begin perform quitar_material_orden(m_d, 'Tarde'); v_ok := true; exception when others then v_ok := false; end;
  assert not v_ok, 'se cambió el material de una orden terminada';
  perform pg_temp.como_postgres();
end $$;

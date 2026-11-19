-- A una orden se le agrega un servicio (vulcanizado) y se reemplaza material por un servicio; un
-- equipo sigue sin poder agregarse, el taller sigue sin cambiar la lista, y el servicio se comporta
-- como cualquier material de la orden (faltante mientras no se pida).
do $$
declare v_ing uuid; v_gp uuid; v_taller uuid; v_eq uuid; v_otro uuid; v_a uuid; v_b uuid; v_s uuid; v_s2 uuid; v_op uuid;
  m_b uuid; v_ok boolean; v_err text; r record;
begin
  v_ing := pg_temp.usuario('ing300@hegamex.com', '{ingenieria}');
  v_gp := pg_temp.usuario('gp300@hegamex.com', '{gerente_produccion}');
  v_taller := pg_temp.usuario('taller300@hegamex.com', '{produccion}');
  insert into articulos (clave, tipo, nombre) values ('T300-EQ', 'equipo', 'Banda 300') returning id into v_eq;
  insert into articulos (clave, tipo, nombre) values ('T300-EQ2', 'equipo', 'Otro equipo 300') returning id into v_otro;
  insert into articulos (clave, tipo, nombre) values ('T300-A', 'componente', 'Rodillo 300') returning id into v_a;
  insert into articulos (clave, tipo, nombre) values ('T300-B', 'componente', 'Chumacera 300') returning id into v_b;
  insert into articulos (clave, tipo, nombre, unidad) values ('T300-S', 'servicio', 'Servicio de vulcanizado de rodillo 300', 'servicio') returning id into v_s;
  insert into articulos (clave, tipo, nombre, unidad) values ('T300-S2', 'servicio', 'Servicio de maquilado 300', 'servicio') returning id into v_s2;
  insert into bom_lineas (padre_id, hijo_id, cantidad) values (v_eq, v_a, 2), (v_eq, v_b, 4);
  insert into bom_operaciones (articulo_id, etapa_id, horas) values (v_eq, (select id from etapas where nombre = 'Pailería'), 5);
  perform pg_temp.como(v_gp);
  v_op := crear_orden_produccion(v_eq, 1);

  -- El buscador de la orden pide estos tipos: el servicio sale por clave y por nombre.
  perform pg_temp.como(v_ing);
  assert exists (select 1 from buscar_articulos('T300-S', array['componente', 'materia_prima', 'servicio']::tipo_articulo[]) x where x.id = v_s),
    'el servicio no sale al buscarlo por clave';
  assert exists (select 1 from buscar_articulos('vulcanizado de rodillo 300', array['componente', 'materia_prima', 'servicio']::tipo_articulo[]) x where x.id = v_s),
    'el servicio no sale al buscarlo por nombre';

  -- Ingeniería agrega el servicio a la orden: queda marcado como agregado y con su evento.
  perform agregar_material_orden(v_op, v_s, 1, 'El rodillo de tracción va vulcanizado');
  select * into r from op_materiales where orden_id = v_op and articulo_id = v_s;
  assert r.requerido = 1 and r.agregado, format('servicio en la orden: %s', r);
  assert exists (select 1 from op_eventos where orden_id = v_op and tipo = 'cambio_material' and nota like 'Se agregó 1 servicio de Servicio de vulcanizado%'),
    'no quedó el evento del servicio agregado';
  -- Se ve en el material de la orden como cualquier otro: faltante hasta que se pida.
  select * into r from v_op_material where orden_id = v_op and articulo_id = v_s;
  assert r.tipo = 'servicio' and r.faltante = 1 and r.pedido_a_compras = 0, format('servicio en v_op_material: %s / %s', r.faltante, r.pedido_a_compras);

  -- Reemplazar un material por un servicio (la chumacera por un maquilado).
  perform pg_temp.como_postgres();
  select id into m_b from op_materiales where orden_id = v_op and articulo_id = v_b;
  perform pg_temp.como(v_ing);
  perform reemplazar_material_orden(m_b, v_s2, 1, 'Se manda a maquilar en vez de comprar la pieza');
  assert (select requerido from op_materiales where orden_id = v_op and articulo_id = v_s2) = 1, 'no entró el servicio de reemplazo';
  assert (select quitado_en is not null from op_materiales where id = m_b), 'el material reemplazado no quedó tachado';

  -- Un equipo sigue sin poder agregarse a una orden.
  begin perform agregar_material_orden(v_op, v_otro, 1, 'no'); v_ok := true;
  exception when others then v_ok := false; get stacked diagnostics v_err = message_text; end;
  assert not v_ok and v_err like '%componentes, materia prima, servicios o subensambles%', format('se agregó un equipo a la orden: %s', v_err);

  -- El taller sigue sin cambiar la lista, tampoco con un servicio.
  perform pg_temp.como(v_taller);
  begin perform agregar_material_orden(v_op, v_s2, 1, 'no'); v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'el taller agregó un servicio a la orden';
end $$;

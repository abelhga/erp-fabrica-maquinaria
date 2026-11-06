-- Apartar material pide la revisión de ingeniería (253): almacén no aparta una orden sin revisar;
-- gerencia sí, con motivo que queda en la orden; ya revisada aparta cualquiera; y la revisión
-- nocturna le avisa a ingeniería de lo que lleva un día hábil sin revisar, hasta que lo revisa.
do $$
declare v_alm uuid; v_gp uuid; v_ing uuid; v_eq uuid; v_pza uuid; v_pb int; v_op uuid; v_op2 uuid; v_ok boolean; v_msg text;
begin
  v_alm := pg_temp.usuario('alm253@hegamex.com', '{almacen}');
  v_gp := pg_temp.usuario('gp253@hegamex.com', '{gerente_produccion}');
  v_ing := pg_temp.usuario('ing253@hegamex.com', '{ingenieria}');
  select id into v_pb from almacenes where nombre = 'Planta Baja';
  insert into articulos (clave, tipo, nombre) values ('T253-EQ', 'equipo', 'T253 Banda') returning id into v_eq;
  insert into articulos (clave, tipo, nombre) values ('T253-P', 'componente', 'T253 Chumacera') returning id into v_pza;
  insert into movimientos_inventario (tipo, articulo_id, almacen_id, cantidad, motivo) values ('inicial', v_pza, v_pb, 10, 'T253');
  insert into ordenes_produccion (articulo_id, cantidad, estado) values (v_eq, 1, 'planeada') returning id into v_op;
  insert into ordenes_produccion (articulo_id, cantidad, estado) values (v_eq, 1, 'planeada') returning id into v_op2;
  insert into op_materiales (orden_id, articulo_id, requerido) values (v_op, v_pza, 4), (v_op2, v_pza, 3);

  -- 1. Almacén no aparta una orden sin revisar; lo dice y no aparta nada.
  perform pg_temp.como(v_alm);
  begin perform apartar_material(v_op); v_ok := true;
  exception when insufficient_privilege then v_ok := false; get stacked diagnostics v_msg = message_text; end;
  assert not v_ok and v_msg like 'Falta la revisión de ingeniería%', format('almacén apartó sin revisión: %s', v_msg);
  assert not exists (select 1 from reservas where orden_produccion_id = v_op), 'quedó algo apartado';

  -- 2. Gerencia sin motivo tampoco; con motivo sí, y queda quién y por qué.
  perform pg_temp.como(v_gp);
  begin perform apartar_material(v_op, '  '); v_ok := true; exception when invalid_parameter_value then v_ok := false; end;
  assert not v_ok, 'gerencia apartó sin revisión y sin motivo';
  perform apartar_material(v_op, 'El cliente recoge el lunes');
  assert (select sum(cantidad) from reservas where orden_produccion_id = v_op and estado = 'activa') = 4, 'no apartó con motivo';
  assert (select apartado_sin_revision_motivo = 'El cliente recoge el lunes' and apartado_sin_revision_por = v_gp
          from ordenes_produccion where id = v_op), 'no guardó el motivo y quién';
  assert exists (select 1 from op_eventos where orden_id = v_op and nota like '%Sin la revisión de ingeniería: El cliente recoge el lunes'),
    'la línea de tiempo no dice que se apartó sin revisión';

  -- 3. La regla nocturna: un día hábil sin revisar le sale a ingeniería; urgente si ya hay apartado.
  perform pg_temp.como_postgres();
  update ordenes_produccion set creado_en = now() - interval '5 days' where id in (v_op, v_op2);
  assert (select gravedad = 'alta' and responsables @> array[v_ing] from revision_r_op_sin_revision_ingenieria() h
          where h.registro_id = v_op::text), 'la orden apartada sin revisión no salió urgente para ingeniería';
  assert (select gravedad from revision_r_op_sin_revision_ingenieria() h where h.registro_id = v_op2::text) = 'media',
    'la orden sin apartar no salió como «revisar»';

  -- 4. Ingeniería la revisa: almacén ya aparta normal y la regla deja de sacarla.
  perform pg_temp.como(v_ing);
  perform revisar_orden(v_op2, 'ingenieria');
  perform pg_temp.como(v_alm);
  perform apartar_material(v_op2);
  assert (select sum(cantidad) from reservas where orden_produccion_id = v_op2 and estado = 'activa') = 3, 'almacén no apartó la orden revisada';
  assert (select apartado_sin_revision_motivo is null from ordenes_produccion where id = v_op2), 'una orden revisada quedó con motivo de sin revisión';
  perform pg_temp.como_postgres();
  assert not exists (select 1 from revision_r_op_sin_revision_ingenieria() h where h.registro_id = v_op2::text), 'la regla siguió sacando la orden ya revisada';
end $$;

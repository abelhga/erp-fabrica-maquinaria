-- Revisión de ingeniería por especialidad: con mecánica y eléctrica configuradas, la orden queda
-- revisada hasta que firman las dos; cada quien firma lo suyo; nadie firma lo de otro sin nombrarlo
-- (y solo la gerencia de producción, como «en lugar de»); sin especialidades configuradas sigue igual.
do $$
declare v_mec uuid; v_ele uuid; v_ing uuid; v_ger uuid; v_eq uuid; v_op uuid; v_op2 uuid; v_ok boolean; v_err text; f jsonb;
begin
  v_mec := pg_temp.usuario('mec286@hegamex.com', '{ingenieria}');
  v_ele := pg_temp.usuario('ele286@hegamex.com', '{ingenieria}');
  v_ing := pg_temp.usuario('ing286@hegamex.com', '{ingenieria}');
  v_ger := pg_temp.usuario('ger286@hegamex.com', '{gerente_produccion}');
  update configuracion set valor = jsonb_build_object('especialidades', jsonb_build_array(
    jsonb_build_object('clave', 'mecanica', 'nombre', 'Mecánica', 'personas', jsonb_build_array(v_mec)),
    jsonb_build_object('clave', 'electrica', 'nombre', 'Eléctrica', 'personas', jsonb_build_array(v_ele))))
  where clave = 'revision_ingenieria';
  insert into articulos (clave, tipo, nombre) values ('P286-EQ', 'equipo', 'Cribadora 286') returning id into v_eq;
  insert into ordenes_produccion (articulo_id, cantidad, estado) values (v_eq, 1, 'planeada') returning id into v_op;
  insert into ordenes_produccion (articulo_id, cantidad, estado) values (v_eq, 1, 'planeada') returning id into v_op2;

  -- Mecánica firma lo suyo: la orden queda a medias y todavía no se puede liberar.
  perform pg_temp.como(v_mec);
  perform revisar_orden(v_op, 'ingenieria');
  perform pg_temp.como_postgres();
  assert (select count(*) from op_firmas_ingenieria where orden_id = v_op) = 1, 'no quedó una firma';
  assert (select revisado_ingenieria_en from ordenes_produccion where id = v_op) is null, 'con una firma ya quedó revisada';
  perform pg_temp.como(v_ger);
  assert (select x->>'estado' from jsonb_array_elements(validacion_orden(v_op)) x where x->>'paso' = 'ingenieria') = 'parcial', 'no dice a medias';
  begin perform liberar_orden(v_op); v_ok := true; exception when others then v_ok := false; end;
  assert not v_ok, 'se liberó con una sola firma';

  -- Otra persona de ingeniería no firma lo eléctrico (tiene responsable) ni sin decir cuál.
  perform pg_temp.como(v_ing);
  begin perform revisar_orden(v_op, 'ingenieria', 'electrica'); v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'firmó lo eléctrico alguien que no le toca';
  begin perform revisar_orden(v_op, 'ingenieria'); v_ok := true;
  exception when raise_exception then v_ok := false; get stacked diagnostics v_err = message_text; end;
  assert not v_ok and v_err like '%Eléctrica la firma%', 'sin especialidad firmó o no dijo quién falta: ' || coalesce(v_err, '');

  -- Eléctrica firma: ahora sí queda revisada y se puede liberar.
  perform pg_temp.como(v_ele);
  f := (select x->'firmas' from jsonb_array_elements(validacion_orden(v_op)) x where x->>'paso' = 'ingenieria');
  assert (select (e->>'puedo')::boolean from jsonb_array_elements(f) e where e->>'clave' = 'electrica'), 'a Fernando no le sale su botón';
  assert not (select (e->>'puedo')::boolean from jsonb_array_elements(f) e where e->>'clave' = 'mecanica'), 'le sale firmar lo ya firmado';
  perform revisar_orden(v_op, 'ingenieria');
  perform pg_temp.como_postgres();
  assert (select revisado_ingenieria_en is not null and revisado_ingenieria_por = v_ele from ordenes_produccion where id = v_op), 'con las dos no quedó revisada';
  assert (select count(*) from op_eventos where orden_id = v_op and nota like 'Ingeniería (%) revisó%') = 2, 'la historia no dice cada firma';

  -- La gerencia de producción firma por quien falta, nombrando la especialidad; queda «en lugar de».
  perform pg_temp.como(v_mec);
  perform revisar_orden(v_op2, 'ingenieria');
  perform pg_temp.como(v_ger);
  perform revisar_orden(v_op2, 'ingenieria', 'electrica');
  perform pg_temp.como_postgres();
  assert (select en_lugar_de from op_firmas_ingenieria where orden_id = v_op2 and especialidad = 'electrica'), 'no quedó «en lugar de»';
  assert (select revisado_ingenieria_en is not null from ordenes_produccion where id = v_op2), 'no quedó revisada con la firma de la gerencia';
  -- Un vendedor (o almacén) no firma nada.
  perform pg_temp.como(pg_temp.usuario('alm286@hegamex.com', '{almacen}'));
  begin perform revisar_orden(v_op2, 'ingenieria', 'mecanica'); v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'almacén firmó ingeniería';
end $$;

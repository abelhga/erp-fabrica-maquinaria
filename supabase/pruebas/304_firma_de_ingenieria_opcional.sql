-- Con la firma eléctrica como opcional: la de mecánica basta para que la orden quede revisada y se
-- pueda liberar; la eléctrica sola NO basta; el eléctrico puede firmar antes o después y queda
-- anotado; el recordatorio no le insiste por lo opcional; y quien no es de ingeniería no firma.
do $$
declare v_mec uuid; v_ele uuid; v_ger uuid; v_taller uuid; v_eq uuid; v_op uuid; v_op2 uuid; v_ok boolean; f jsonb; v_n int;
begin
  v_mec := pg_temp.usuario('mec304@hegamex.com', '{ingenieria}');
  v_ele := pg_temp.usuario('ele304@hegamex.com', '{ingenieria}');
  v_ger := pg_temp.usuario('ger304@hegamex.com', '{gerente_produccion}');
  v_taller := pg_temp.usuario('taller304@hegamex.com', '{produccion}');
  update configuracion set valor = jsonb_build_object('especialidades', jsonb_build_array(
    jsonb_build_object('clave', 'mecanica', 'nombre', 'Mecánica', 'personas', jsonb_build_array(v_mec)),
    jsonb_build_object('clave', 'electrica', 'nombre', 'Eléctrica', 'personas', jsonb_build_array(v_ele), 'obligatoria', false)))
  where clave = 'revision_ingenieria';
  insert into articulos (clave, tipo, nombre) values ('P304-EQ', 'equipo', 'Cribadora 304') returning id into v_eq;
  insert into ordenes_produccion (articulo_id, cantidad, estado, creado_en) values (v_eq, 1, 'planeada', now() - interval '6 hours') returning id into v_op;
  insert into ordenes_produccion (articulo_id, cantidad, estado, creado_en) values (v_eq, 1, 'planeada', now() - interval '6 hours') returning id into v_op2;

  -- La pantalla sabe cuál es obligatoria.
  perform pg_temp.como(v_ger);
  f := (select x->'firmas' from jsonb_array_elements(validacion_orden(v_op)) x where x->>'paso' = 'ingenieria');
  assert (select (e->>'obligatoria')::boolean from jsonb_array_elements(f) e where e->>'clave' = 'mecanica'), 'mecánica no sale como obligatoria';
  assert not (select (e->>'obligatoria')::boolean from jsonb_array_elements(f) e where e->>'clave' = 'electrica'), 'eléctrica no sale como opcional';

  -- La eléctrica sola no basta: sigue sin revisar y no se libera.
  perform pg_temp.como(v_ele);
  perform revisar_orden(v_op, 'ingenieria');
  perform pg_temp.como_postgres();
  assert (select revisado_ingenieria_en from ordenes_produccion where id = v_op) is null, 'quedó revisada solo con la firma opcional';
  perform pg_temp.como(v_ger);
  begin perform liberar_orden(v_op); v_ok := true; exception when others then v_ok := false; end;
  assert not v_ok, 'se liberó sin la firma obligatoria';

  -- Con la de mecánica queda revisada, aunque falte la eléctrica, y se puede liberar.
  perform pg_temp.como(v_mec);
  perform revisar_orden(v_op2, 'ingenieria');
  perform pg_temp.como_postgres();
  assert (select revisado_ingenieria_en is not null and revisado_ingenieria_por = v_mec from ordenes_produccion where id = v_op2), 'con la obligatoria no quedó revisada';
  update ordenes_produccion set revisado_almacen_en = now() where id = v_op2;
  perform pg_temp.como(v_ger);
  assert (select x->>'estado' from jsonb_array_elements(validacion_orden(v_op2)) x where x->>'paso' = 'ingenieria') = 'hecho', 'el paso no sale como hecho';
  perform liberar_orden(v_op2);
  perform pg_temp.como_postgres();
  assert (select estado from ordenes_produccion where id = v_op2) = 'liberada', 'no se liberó con la firma obligatoria';

  -- El eléctrico todavía puede firmar después, y queda en la historia.
  perform pg_temp.como(v_ele);
  f := (select x->'firmas' from jsonb_array_elements(validacion_orden(v_op2)) x where x->>'paso' = 'ingenieria');
  assert (select (e->>'puedo')::boolean from jsonb_array_elements(f) e where e->>'clave' = 'electrica'), 'ya no le sale su botón al eléctrico';
  perform revisar_orden(v_op2, 'ingenieria');
  perform pg_temp.como_postgres();
  assert exists (select 1 from op_firmas_ingenieria where orden_id = v_op2 and especialidad = 'electrica' and por = v_ele), 'no quedó la firma opcional';
  assert (select revisado_ingenieria_por from ordenes_produccion where id = v_op2) = v_mec, 'la firma opcional cambió quién revisó';

  -- El recordatorio: a mecánica sí le avisa de la orden que no ha firmado; al eléctrico no se le insiste por lo opcional.
  insert into ordenes_produccion (articulo_id, cantidad, estado, creado_en) values (v_eq, 1, 'planeada', now() - interval '6 hours');
  perform avisos_periodicos();
  select count(*) into v_n from avisos where usuario_id = v_mec and tipo = 'op_validacion_atorada';
  assert v_n = 1, format('a mecánica no le llegó su recordatorio (%s)', v_n);
  select count(*) into v_n from avisos where usuario_id = v_ele and tipo = 'op_validacion_atorada';
  assert v_n = 0, format('al eléctrico se le recordó una firma opcional (%s)', v_n);

  -- El taller no firma por ingeniería.
  perform pg_temp.como(v_taller);
  begin perform revisar_orden(v_op, 'ingenieria', 'mecanica'); v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'el taller firmó la revisión de ingeniería';
end $$;

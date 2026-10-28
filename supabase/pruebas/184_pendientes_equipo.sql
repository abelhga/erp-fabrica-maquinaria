-- Pendientes: RH y dirección ven los de todos (sin poder cambiarlos); uno para varias personas
-- se cierra con el primero («uno») o hasta que todos («todos»); y cada quien ve su cumplimiento.
do $$
declare v_a uuid; v_b uuid; v_c uuid; v_rh uuid; v_dir uuid; v_p uuid; v_g uuid := gen_random_uuid(); v_g2 uuid := gen_random_uuid();
  v_ok boolean; v_n int; r record;
begin
  v_a := pg_temp.usuario('a184@hegamex.com', '{ventas}');
  v_b := pg_temp.usuario('b184@hegamex.com', '{compras}');
  v_c := pg_temp.usuario('c184@hegamex.com', '{almacen}');
  v_rh := pg_temp.usuario('rh184@hegamex.com', '{rrhh}');
  v_dir := pg_temp.usuario('dir184@hegamex.com', '{direccion}');

  -- A le pide algo a B, vencido hace 3 días.
  perform pg_temp.como(v_a);
  insert into pendientes (titulo, responsable_id, creado_por, vence) values ('Precio del motor 184', v_b, v_a, hoy_mx() - 3) returning id into v_p;

  -- RH y dirección lo ven; C (ni lo pidió ni le toca) no. RH no lo puede cerrar.
  perform pg_temp.como(v_rh);
  assert exists (select 1 from pendientes where id = v_p), 'RH no ve los pendientes de los demás';
  update pendientes set estado = 'hecho' where id = v_p;
  perform pg_temp.como_postgres();
  assert (select estado from pendientes where id = v_p) = 'abierto', 'RH cerró un pendiente que no es suyo';
  perform pg_temp.como(v_dir);
  assert exists (select 1 from pendientes where id = v_p), 'dirección no ve los pendientes de los demás';
  perform pg_temp.como(v_c);
  assert not exists (select 1 from pendientes where id = v_p), 'almacén ve un pendiente ajeno';

  -- Su cumplimiento: B ve el suyo (1 vencido, 3 días, 1 persona esperando); C no ve el de todos.
  perform pg_temp.como(v_b);
  select * into r from mi_cumplimiento_pendientes();
  assert r.persona_id = v_b and r.vencidos = 1 and r.dias_retraso = 3 and r.esperan = 1, format('mi cumplimiento salió mal: %s', row_to_json(r));
  perform pg_temp.como(v_c);
  begin perform * from cumplimiento_pendientes(); v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'almacén vio el cumplimiento de todos';
  perform pg_temp.como(v_rh);
  assert exists (select 1 from cumplimiento_pendientes() where persona_id = v_b and vencidos = 1), 'RH no ve el cumplimiento de B';

  -- «Basta con que uno»: B lo hace y a C se le cierra como cubierto («Lo hizo …»).
  perform pg_temp.como(v_a);
  insert into pendientes (titulo, responsable_id, creado_por, grupo_id, modo) values
    ('Revisar la báscula 184', v_b, v_a, v_g, 'uno'), ('Revisar la báscula 184', v_c, v_a, v_g, 'uno');
  -- C no puede marcarse «cubierto» él solo.
  perform pg_temp.como(v_c);
  begin update pendientes set estado = 'cubierto' where grupo_id = v_g and responsable_id = v_c; v_ok := true;
  exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'alguien se marcó cubierto a mano';
  perform pg_temp.como(v_b);
  update pendientes set estado = 'hecho' where grupo_id = v_g and responsable_id = v_b;
  perform pg_temp.como_postgres();
  select * into r from pendientes where grupo_id = v_g and responsable_id = v_c;
  assert r.estado = 'cubierto' and r.nota_cierre like 'Lo hizo %', format('a C no se le cerró como cubierto: %s', row_to_json(r));
  assert exists (select 1 from avisos where usuario_id = v_c and tipo = 'pendiente_cubierto'), 'a C no le avisaron que ya no le toca';

  -- «Cada quien»: B lo hace y C lo sigue teniendo; a A le llega «1 de 2».
  perform pg_temp.como(v_a);
  insert into pendientes (titulo, responsable_id, creado_por, grupo_id, modo) values
    ('Curso de seguridad 184', v_b, v_a, v_g2, 'todos'), ('Curso de seguridad 184', v_c, v_a, v_g2, 'todos');
  perform pg_temp.como(v_b);
  update pendientes set estado = 'hecho' where grupo_id = v_g2 and responsable_id = v_b;
  perform pg_temp.como_postgres();
  assert (select estado from pendientes where grupo_id = v_g2 and responsable_id = v_c) = 'abierto', 'con «todos», a C se le cerró solo';
  assert exists (select 1 from avisos where usuario_id = v_a and titulo like 'Listo 1 de 2:%'), 'A no recibió el avance «1 de 2»';
  perform pg_temp.como(v_c);
  update pendientes set estado = 'hecho' where grupo_id = v_g2 and responsable_id = v_c;
  perform pg_temp.como_postgres();
  assert exists (select 1 from avisos where usuario_id = v_a and titulo like 'Listo, todos:%'), 'A no recibió «todos»';

  -- El grupo y su modo no se cambian.
  perform pg_temp.como(v_a);
  insert into pendientes (titulo, responsable_id, creado_por, grupo_id, modo) values ('Otro 184', v_b, v_a, gen_random_uuid(), 'uno') returning id into v_p;
  begin update pendientes set modo = 'todos' where id = v_p; v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'se cambió el modo de un grupo';
  perform pg_temp.como_postgres();
end $$;

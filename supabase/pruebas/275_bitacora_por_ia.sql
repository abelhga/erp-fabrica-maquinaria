-- Lo que la IA hace a petición de alguien queda a su nombre en la bitácora, marcado, y no cuenta
-- como su uso del ERP. Lo que hace la persona sí cuenta.
do $$
declare v_dir uuid; v_dir2 uuid; r record; d jsonb; v_hoy date := (now() at time zone 'America/Mexico_City')::date;
begin
  v_dir := pg_temp.usuario('dir275@hegamex.com', '{direccion}');
  v_dir2 := pg_temp.usuario('dir275b@hegamex.com', '{direccion}');

  perform pg_temp.como(v_dir);
  insert into proveedores (nombre) values ('T275 a mano');
  perform set_config('hegamex.por_ia', '1', true);
  insert into proveedores (nombre) values ('T275 por la IA 1'), ('T275 por la IA 2');
  perform set_config('hegamex.por_ia', '', true);

  perform pg_temp.como_postgres();
  assert (select count(*) from bitacora where usuario_id = v_dir and tabla = 'proveedores' and por_ia) = 2, 'no marcó lo de la IA';
  assert (select count(*) from bitacora where usuario_id = v_dir and tabla = 'proveedores' and not por_ia) = 1, 'marcó lo que hizo la persona';

  perform pg_temp.como(v_dir2);
  select * into r from uso_por_usuario(v_hoy - 1, v_hoy) u where u.id = v_dir;
  assert r.cambios = 1, format('uso_por_usuario contó %s cambios', r.cambios);
  d := uso_de_usuario(v_dir, v_hoy - 6, v_hoy);
  assert (d->'por_dia'->6->>'cambios')::int = 1, format('uso_de_usuario: %s', d->'por_dia'->6);
end $$;

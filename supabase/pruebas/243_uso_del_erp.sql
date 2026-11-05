-- Uso del ERP: cada quien registra solo lo suyo (vistas y a lo más un minuto por aviso), ve solo lo
-- suyo, y las métricas de todos son de dirección y sistemas. Junta lo registrado con la bitácora,
-- la IA y los pendientes.
do $$
declare v_ven uuid; v_dir uuid; v_otro uuid; r record; d jsonb; v_ok boolean; v_hoy date := (now() at time zone 'America/Mexico_City')::date;
begin
  v_ven := pg_temp.usuario('ven243@hegamex.com', '{ventas}');
  v_otro := pg_temp.usuario('otro243@hegamex.com', '{almacen}');
  v_dir := pg_temp.usuario('dir243@hegamex.com', '{direccion}');

  -- 1. El vendedor abre cotizaciones dos veces y trabaja 3 minutos; un aviso de 50 minutos cuenta como 1.
  perform pg_temp.como(v_ven);
  perform registrar_uso('/ventas/cotizaciones', true, 0);
  perform registrar_uso('/ventas/cotizaciones/:id', true, 0);
  perform registrar_uso('/ventas/cotizaciones/:id', false, 1);
  perform registrar_uso('/ventas/cotizaciones/:id', false, 1);
  perform registrar_uso('/ventas/cotizaciones/:id', false, 50);
  perform registrar_uso('sin-diagonal', true, 1);   -- no es una ruta: se ignora
  insert into pendientes (titulo, responsable_id, vence) values ('T243 vencido', v_ven, v_hoy - 2);
  select * into r from uso_diario where usuario_id = v_ven and ruta = '/ventas/cotizaciones/:id';
  assert r.vistas = 1 and r.minutos = 3, format('registro: %s vistas, %s min', r.vistas, r.minutos);
  assert (select count(*) from uso_diario where usuario_id = v_ven) = 2, 'registró algo que no era ruta';

  -- 2. Nadie escribe directo ni ve lo de otro; tampoco ve las métricas de todos.
  begin insert into uso_diario (usuario_id, dia, ruta, minutos) values (v_ven, v_hoy, '/x', 500); v_ok := true;
  exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'escribió directo en uso_diario';
  perform pg_temp.como(v_otro);
  perform registrar_uso('/almacen/existencias', true, 1);
  assert (select count(*) from uso_diario) = 1, 'almacén ve el uso de otros';
  begin perform uso_por_usuario(v_hoy - 7, v_hoy); v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'almacén vio las métricas de todos';

  -- 3. Dirección ve el resumen y el detalle.
  perform pg_temp.como(v_dir);
  select * into r from uso_por_usuario(v_hoy - 7, v_hoy) u where u.id = v_ven;
  assert r.minutos = 3 and r.vistas = 2 and r.pantallas = 2 and r.dias_activos = 1 and r.pendientes_vencidos = 1 and r.ultima_actividad is not null,
    format('resumen: %s', row_to_json(r));
  d := uso_de_usuario(v_ven, v_hoy - 6, v_hoy);
  assert jsonb_array_length(d->'por_dia') = 7 and (d->'por_dia'->6->>'minutos')::int = 3, format('por día: %s', d->'por_dia');
  assert d->'pantallas'->0->>'ruta' = '/ventas/cotizaciones/:id', format('pantallas: %s', d->'pantallas');
  perform pg_temp.como_postgres();
end $$;

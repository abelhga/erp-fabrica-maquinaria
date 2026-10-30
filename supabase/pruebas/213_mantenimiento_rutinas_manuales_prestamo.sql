-- Segunda entrega de la junta con Esteban: el encargado edita las rutinas (y los preventivos que
-- nadie ha empezado toman la lista nueva), manuales por máquina o por categoría y modelo, y el
-- préstamo con para qué y foto al recibir.
do $$
declare v_mtto uuid; v_taller uuid; v_vend uuid; v_a uuid; v_b uuid; v_c uuid; v_rut uuid; v_plan uuid; v_ord uuid;
  v_herr uuid; v_res uuid; r jsonb; v_ok boolean; v_msg text; v_n int;
begin
  v_mtto := pg_temp.usuario('mtto213@hegamex.com', '{mantenimiento}');
  v_taller := pg_temp.usuario('taller213@hegamex.com', '{produccion}');
  v_vend := pg_temp.usuario('vend213@hegamex.com', '{ventas}');
  insert into maquinas (numero, nombre, categoria, modelo) values ('T213-A', 'Inversora 213 A', 'inversoras 213', 'AX-252') returning id into v_a;
  insert into maquinas (numero, nombre, categoria, modelo) values ('T213-B', 'Inversora 213 B', 'inversoras 213', 'AX-252') returning id into v_b;
  insert into maquinas (numero, nombre, categoria, modelo) values ('T213-C', 'Inversora 213 C', 'inversoras 213', 'MIG-400') returning id into v_c;

  -- 1. Rutinas: el taller no las edita; sin puntos ni con nombre repetido, no.
  perform pg_temp.como(v_taller);
  begin perform guardar_rutina(null, 'Inversoras 213 · mensual', null, 'mensual', null, '[{"texto":"Soplar"}]'); v_ok := true;
  exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'el taller editó una rutina';
  perform pg_temp.como(v_mtto);
  begin perform guardar_rutina(null, 'Inversoras 213 · mensual', null, 'mensual', null, '[{"texto":"  "}]'); v_ok := true;
  exception when others then v_ok := false; v_msg := sqlerrm; end;
  assert not v_ok and v_msg like '%al menos un punto%', 'rutina sin puntos';
  r := guardar_rutina(null, 'Inversoras 213 · mensual', 'Inversoras 213', 'mensual', 'Con el equipo desenergizado',
    '[{"seccion":"Seguridad","texto":"Desconectar"},{"seccion":" ","texto":" Soplar rejillas "},{"texto":""}]');
  v_rut := (r->>'id')::uuid;
  assert (r->>'puntos')::int = 2 and (select puntos from rutinas_mantenimiento where id = v_rut)
    = '[{"seccion":"Seguridad","texto":"Desconectar"},{"seccion":null,"texto":"Soplar rejillas"}]'::jsonb, 'puntos limpios: ' || r::text;
  assert (select categoria from rutinas_mantenimiento where id = v_rut) = 'inversoras 213', 'categoría en minúsculas';
  begin perform guardar_rutina(null, 'inversoras 213 · MENSUAL', null, null, null, '[{"texto":"x"}]'); v_ok := true;
  exception when others then v_ok := false; v_msg := sqlerrm; end;
  assert not v_ok and v_msg like '%Ya hay una rutina%', 'nombre repetido';

  --    El preventivo sale con 2 puntos; al editar la rutina, la orden que nadie ha tocado toma los 3.
  insert into planes_preventivos (maquina_id, nombre, cada_dias, ultima_fecha, rutina_id) values (v_a, 'Mensual 213', 30, hoy_planta() - 40, v_rut)
  returning id into v_plan;
  perform generar_preventivos(v_a);
  select id into v_ord from ordenes_mantenimiento where plan_id = v_plan and estado = 'pendiente';
  assert (select count(*) from orden_checklist where orden_id = v_ord) = 2, 'el preventivo no trae la rutina';
  r := guardar_rutina(v_rut, 'Inversoras 213 · mensual', 'inversoras 213', 'mensual', null,
    '[{"seccion":"Seguridad","texto":"Desconectar"},{"seccion":"Limpieza","texto":"Soplar rejillas"},{"seccion":"Cables","texto":"Revisar tierra"}]');
  assert (r->>'ordenes_actualizadas')::int = 1 and (select count(*) from orden_checklist where orden_id = v_ord) = 3, 'la orden no tomó la lista nueva: ' || r::text;
  assert (select string_agg(texto, '|' order by orden) from orden_checklist where orden_id = v_ord) = 'Desconectar|Soplar rejillas|Revisar tierra', 'orden de los puntos';
  --    Con un punto ya palomeado, la orden se queda con su lista.
  perform marcar_punto((select id from orden_checklist where orden_id = v_ord and orden = 1), true);
  r := guardar_rutina(v_rut, 'Inversoras 213 · mensual', 'inversoras 213', 'mensual', null, '[{"texto":"Solo uno"}]');
  assert (r->>'ordenes_actualizadas')::int = 0 and (select count(*) from orden_checklist where orden_id = v_ord) = 3, 'se cambió una lista ya empezada';
  --    No se desactiva mientras un plan la use; la lista dice quién la usa.
  begin perform guardar_rutina(v_rut, 'Inversoras 213 · mensual', null, 'mensual', null, '[{"texto":"Solo uno"}]', false); v_ok := true;
  exception when others then v_ok := false; v_msg := sqlerrm; end;
  assert not v_ok and v_msg like '%La usan 1 planes%', 'se desactivó una rutina en uso: ' || coalesce(v_msg, '');
  assert (select planes = 1 and maquinas->0->>'numero' = 'T213-A' from v_rutinas_mantenimiento where id = v_rut), 'la vista no dice quién la usa';

  -- 2. Manuales: uno de la máquina A y uno de todas las inversoras 213 modelo AX-252.
  insert into maquina_documentos (maquina_id, tipo, titulo, url) values (v_a, 'diagrama', 'Diagrama de A', 'https://drive.google.com/x');
  insert into maquina_documentos (categoria, modelo, tipo, titulo, ruta) values ('inversoras 213', 'AX-252', 'manual', 'Manual AX-252', 'maquinas/' || v_a || '/docs/manual.pdf');
  insert into maquina_documentos (categoria, tipo, titulo, url) values ('Inversoras 213', 'ficha_tecnica', 'Ficha de toda la línea', 'https://drive.google.com/y');
  assert (select count(*) from documentos_maquina(v_a)) = 3, 'A ve los suyos y los compartidos';
  assert (select string_agg(titulo, '|' order by titulo) from documentos_maquina(v_b)) = 'Ficha de toda la línea|Manual AX-252', 'B ve solo los compartidos de su modelo';
  assert (select string_agg(titulo, '|' order by titulo) from documentos_maquina(v_c)) = 'Ficha de toda la línea', 'C (otro modelo) no ve el manual de AX-252';
  begin insert into maquina_documentos (maquina_id, titulo, url, ruta) values (v_a, 'Doble', 'https://x', 'maquinas/x/docs/y.pdf'); v_ok := true;
  exception when check_violation then v_ok := false; end;
  assert not v_ok, 'un documento con archivo y liga a la vez';
  --    El taller los ve pero no los agrega; ventas ni los ve.
  perform pg_temp.como(v_taller);
  assert (select count(*) from documentos_maquina(v_a)) = 3, 'el taller no ve los manuales';
  begin insert into maquina_documentos (maquina_id, titulo, url) values (v_a, 'Del taller', 'https://x'); v_ok := true;
  exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'el taller subió un manual';
  perform pg_temp.como(v_vend);
  assert (select count(*) from maquina_documentos) = 0, 'ventas ve manuales de máquinas';

  -- 3. Préstamo: sin para qué no; con servicio o con para qué sí.
  perform pg_temp.como(v_mtto);
  insert into maquinas (numero, nombre, tipo, categoria, prestable) values ('T213-H', 'Esmeril 213', 'herramienta', 'esmeriles', true) returning id into v_herr;
  begin perform prestar_herramienta(v_herr, null, 'Miguel 213'); v_ok := true; exception when others then v_ok := false; v_msg := sqlerrm; end;
  assert not v_ok and v_msg like '%para qué%', 'préstamo sin para qué';
  v_res := prestar_herramienta(v_herr, null, 'Miguel 213', p_para => 'Desbastar la tolva del pedido 810');
  assert (select para from v_resguardos where id = v_res) = 'Desbastar la tolva del pedido 810', 'no quedó para qué';
  --    Al recibirla: la foto tiene que ser de su carpeta y estar subida.
  begin perform devolver_herramienta(v_res, 'bien', null, 'mantenimiento/' || v_a || '/x.jpg'); v_ok := true;
  exception when others then v_ok := false; v_msg := sqlerrm; end;
  assert not v_ok and v_msg like '%carpeta de esta herramienta%', 'foto de otra carpeta';
  begin perform devolver_herramienta(v_res, 'bien', null, 'mantenimiento/' || v_herr || '/no-existe.jpg'); v_ok := true;
  exception when others then v_ok := false; v_msg := sqlerrm; end;
  assert not v_ok and v_msg like '%no se subió completa%', 'foto que no existe';
  perform pg_temp.como_postgres();
  insert into storage.objects (bucket_id, name) values ('servicio', 'mantenimiento/' || v_herr || '/resguardos/regreso.jpg');
  perform pg_temp.como(v_mtto);
  perform devolver_herramienta(v_res, 'con_dano', 'Disco estrellado', 'mantenimiento/' || v_herr || '/resguardos/regreso.jpg');
  assert (select foto_devolucion like '%regreso.jpg' from resguardos where id = v_res), 'no quedó la foto';
  select count(*) into v_n from servicio_evidencias e join ordenes_mantenimiento o on o.id = e.mantenimiento_id
  where o.maquina_id = v_herr and e.ruta like '%regreso.jpg';
  assert v_n = 1, 'la foto no llegó al reporte de falla';
end $$;

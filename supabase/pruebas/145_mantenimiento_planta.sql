-- Mantenimiento de planta con su propio módulo y rol: administra máquinas, rutinas con
-- checklist y cierra órdenes, sin ver los servicios a clientes; ventas ya no ve el taller.
do $$
declare v_mtto uuid; v_taller uuid; v_vend uuid; v_gp uuid; v_maq uuid; v_rut uuid; v_plan uuid; v_ord uuid; v_falla uuid;
  v_ok boolean; v_n int; c record;
begin
  v_mtto := pg_temp.usuario('mtto145@hegamex.com', '{mantenimiento}');
  v_taller := pg_temp.usuario('taller145@hegamex.com', '{produccion}');
  v_vend := pg_temp.usuario('vend145@hegamex.com', '{ventas}');
  v_gp := pg_temp.usuario('gp145@hegamex.com', '{gerente_produccion}');

  -- Mantenimiento da de alta la máquina con los datos del programa.
  perform pg_temp.como(v_mtto);
  assert puede('mantenimiento', 3) and not puede('servicio', 1) and not puede('ventas', 1) and not puede('costos', 1), 'permisos del rol';
  insert into maquinas (numero, nombre, categoria, marca, modelo, criticidad, tipo_mantenimiento, especialidad, tipo_equipo)
  values ('T145-01', 'Inversora de prueba', 'inversora mig', 'AXTECH', 'MIG252', 'muy_alta', 'preventivo', 'tecnico', 'electrico') returning id into v_maq;
  assert (select critica from maquinas where id = v_maq), 'muy alta → crítica';
  update maquinas set criticidad = 'media' where id = v_maq;
  assert not (select critica from maquinas where id = v_maq), 'media → no crítica';

  -- Rutina con 3 puntos y un plan mensual que ya venció: el preventivo sale con su checklist.
  insert into rutinas_mantenimiento (nombre, categoria, frecuencia, puntos)
  values ('Inversoras 145 · mensual', 'inversora mig', 'mensual',
          '[{"seccion":"Seguridad","texto":"Desconectar"},{"seccion":"Limpieza","texto":"Soplar rejillas"},{"seccion":"Cables","texto":"Revisar tierra"}]')
  returning id into v_rut;
  insert into planes_preventivos (maquina_id, nombre, cada_dias, ultima_fecha, rutina_id)
  values (v_maq, 'Rutina mensual', 30, hoy_planta() - 40, v_rut) returning id into v_plan;
  v_n := generar_preventivos(v_maq);
  select id into v_ord from ordenes_mantenimiento where plan_id = v_plan;
  assert v_n = 1 and (select count(*) from orden_checklist where orden_id = v_ord) = 3, 'el preventivo trae los 3 puntos';
  assert (select rutina_puntos from v_planes_preventivos where id = v_plan) = 3, 'el plan dice cuántos puntos';

  -- No se cierra con puntos sin revisar; una falla en un punto pide qué tiene.
  begin perform cerrar_mantenimiento(v_ord, 'Rutina mensual completa'); v_ok := true;
  exception when raise_exception then v_ok := sqlerrm not like 'Faltan 3 puntos%'; end;
  assert not v_ok, 'faltan puntos';
  for c in select id, orden from orden_checklist where orden_id = v_ord order by orden loop
    if c.orden = 3 then
      begin perform marcar_punto(c.id, false); v_ok := true; exception when raise_exception then v_ok := false; end;
      assert not v_ok, 'una falla pide nota';
      perform marcar_punto(c.id, false, 'Tierra floja, se apretó');
    else
      perform marcar_punto(c.id, true);
    end if;
  end loop;
  assert (select puntos_revisados = 3 and puntos_con_falla = 1 from v_ordenes_mantenimiento where id = v_ord), 'la orden cuenta lo revisado';
  -- Mantenimiento cierra (antes solo la gerencia) con sus horas trabajadas.
  perform cerrar_mantenimiento(v_ord, 'Rutina mensual completa', null, 1.5);
  assert (select estado = 'cerrada' and horas_trabajadas = 1.5 from ordenes_mantenimiento where id = v_ord), 'cerrada con horas';
  assert (select ultima_fecha = hoy_planta() from planes_preventivos where id = v_plan), 'el plan se recorre';
  begin perform marcar_punto((select id from orden_checklist where orden_id = v_ord limit 1), null); v_ok := true;
  exception when raise_exception then v_ok := false; end;
  assert not v_ok, 'en una orden cerrada ya no se cambia el checklist';
  -- Captura mano de obra (no material, que sale de almacén).
  insert into costos_servicio (mantenimiento_id, concepto, descripcion, monto, registrado_por) values (v_ord, 'mano_obra', '1.5 h técnico', 88.4, v_mtto);
  assert exists (select 1 from costos_servicio where mantenimiento_id = v_ord), 've el costo que capturó';

  -- El taller reporta fallas (mantenimiento 2) pero no cierra.
  perform pg_temp.como(v_taller);
  v_falla := reportar_falla(v_maq, 'No enciende el ventilador', true, null, 'Rubén');
  begin perform cerrar_mantenimiento(v_falla, 'Se cambió el ventilador'); v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'el taller no cierra';
  assert not exists (select 1 from costos_servicio where mantenimiento_id = v_ord), 'el taller no ve costos';

  -- Ventas ya no ve el taller ni reporta fallas; mantenimiento no ve servicios a clientes.
  perform pg_temp.como(v_vend);
  assert not exists (select 1 from maquinas), 'ventas no ve máquinas';
  begin perform reportar_falla(v_maq, 'Prueba de ventas'); v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'ventas no reporta fallas del taller';
  perform pg_temp.como(v_mtto);
  begin perform solicitar_servicio('mantenimiento', null::uuid); v_ok := true; exception when others then v_ok := false; end;
  assert not v_ok, 'mantenimiento no pide servicios a clientes';
  assert not ve_todos_los_servicios(), 'mantenimiento no ve los servicios de clientes';

  -- La gerencia de producción sigue pudiendo todo en planta.
  perform pg_temp.como(v_gp);
  perform cerrar_mantenimiento(v_falla, 'Se cambió el ventilador', null, 0.5);
  assert (select estado from maquinas where id = v_maq) = 'operando', 'la máquina vuelve a operar';
end $$;

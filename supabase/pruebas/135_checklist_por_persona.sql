-- Checklist diario: cada persona tiene en su ficha qué puntos le aplican. Sin palomear
-- no sale en esa lista ni se le puede marcar; limpieza sigue siendo por área.
do $$
declare v_rh uuid; v_gp uuid; v_ven uuid; e_sold uuid; e_ofi uuid; v_puesto int; v_area int; v_ok boolean; v_n int;
begin
  v_rh := pg_temp.usuario('rh135@hegamex.com', '{rrhh}');
  v_gp := pg_temp.usuario('gp135@hegamex.com', '{gerente_produccion}');
  v_ven := pg_temp.usuario('ven135@hegamex.com', '{ventas}');
  insert into empleados (nombre, fecha_ingreso, checklist) values ('Soldador Prueba135', '2024-01-02', '{epp,celular}') returning id into e_sold;
  insert into empleados (nombre, fecha_ingreso) values ('Oficina Prueba135', '2024-01-02') returning id into e_ofi;

  -- La columna solo acepta los puntos por persona.
  begin update empleados set checklist = '{limpieza}' where id = e_ofi; v_ok := true; exception when check_violation then v_ok := false; end;
  assert not v_ok, 'limpieza es por área, no va en la ficha';
  begin update empleados set checklist = '{casco}' where id = e_ofi; v_ok := true; exception when check_violation then v_ok := false; end;
  assert not v_ok, 'un punto inventado no se acepta';

  -- La lista de EPP trae al soldador y no a la oficina.
  perform pg_temp.como(v_gp);
  assert exists (select 1 from checklist_del_dia('epp', hoy_planta()) where empleado_id = e_sold), 'el soldador sale en EPP';
  assert not exists (select 1 from checklist_del_dia('epp', hoy_planta()) where empleado_id = e_ofi), 'la oficina no sale en EPP';
  assert not exists (select 1 from checklist_del_dia('vehiculo', hoy_planta()) where empleado_id = e_sold), 'el soldador no sale en vehículos';

  -- Marcar: al soldador sí, a la oficina no.
  perform registrar_marca('epp', hoy_planta(), e_sold, null, '', true, null);
  begin perform registrar_marca('epp', hoy_planta(), e_ofi, null, '', true, null); v_ok := true;
  exception when raise_exception then v_ok := false; assert sqlerrm like '%no le aplica el EPP%', sqlerrm; end;
  assert not v_ok, 'a quien no le aplica no se le marca EPP';
  assert (select count(*) from objetivo_marcas where tipo = 'epp' and empleado_id in (e_sold, e_ofi)) = 1, 'solo la marca del soldador';

  -- Limpieza por área sigue igual.
  perform pg_temp.como_postgres();
  insert into objetivo_areas (nombre) values ('Área Prueba135') returning id into v_area;
  perform pg_temp.como(v_gp);
  assert exists (select 1 from checklist_del_dia('limpieza', hoy_planta()) where area_id = v_area), 'las áreas siguen saliendo';
  perform registrar_marca('limpieza', hoy_planta(), null, v_area, '', true, null);

  -- RRHH palomea en la ficha; ventas no.
  perform pg_temp.como(v_rh);
  update empleados set checklist = '{celular}' where id = e_ofi;
  get diagnostics v_n = row_count;
  assert v_n = 1, 'RRHH cambia lo que aplica';
  perform pg_temp.como(v_ven);
  update empleados set checklist = '{epp}' where id = e_ofi;
  perform pg_temp.como_postgres();
  assert (select checklist from empleados where id = e_ofi) = '{celular}', 'ventas no cambia lo que aplica';

  -- Si sus objetivos miden EPP y su ficha no lo tiene, la ficha lo avisa.
  insert into puestos (nombre) values ('Puesto Prueba135') returning id into v_puesto;
  insert into objetivo_plantillas (puesto_id, desde) values (v_puesto, date_trunc('month', current_date)::date - interval '1 month');
  insert into objetivo_plantilla_lineas (plantilla_id, indicador_id, peso, regla)
  select p.id, 58, 10, 'proporcional' from objetivo_plantillas p where p.puesto_id = v_puesto;
  insert into puesto_asignaciones (empleado_id, puesto_id, desde) values (e_ofi, v_puesto, current_date - 30);
  perform pg_temp.como(v_rh);
  assert checklist_sin_palomear(e_ofi) = '{epp}', format('avisa del EPP sin palomear: %s', checklist_sin_palomear(e_ofi));
  perform pg_temp.como_postgres();
  update empleados set checklist = '{celular,epp}' where id = e_ofi;
  perform pg_temp.como(v_rh);
  assert checklist_sin_palomear(e_ofi) = '{}', 'palomeado, ya no avisa';
end $$;

-- Fotos del personal: bucket privado. RRHH sube; la gerencia de producción y la propia
-- persona ven; ventas ni sube ni ve.
do $$
declare v_rh uuid; v_gp uuid; v_ven uuid; v_yo uuid; e_yo uuid; e_otro uuid; v_ok boolean;
begin
  perform pg_temp.como_postgres();
  assert not (select public from storage.buckets where id = 'personal'), 'las fotos del personal no son públicas';
  v_rh := pg_temp.usuario('rh135f@hegamex.com', '{rrhh}');
  v_gp := pg_temp.usuario('gp135f@hegamex.com', '{gerente_produccion}');
  v_ven := pg_temp.usuario('ven135f@hegamex.com', '{ventas}');
  v_yo := pg_temp.usuario('yo135f@hegamex.com', '{almacen}');
  insert into empleados (nombre, fecha_ingreso, usuario_id) values ('Con Cuenta 135', '2024-01-02', v_yo) returning id into e_yo;
  insert into empleados (nombre, fecha_ingreso) values ('Otro 135', '2024-01-02') returning id into e_otro;

  perform pg_temp.como(v_rh);
  insert into storage.objects (bucket_id, name) values ('personal', 'empleados/' || e_yo || '/foto.jpg'), ('personal', 'empleados/' || e_otro || '/foto.jpg');
  perform pg_temp.como(v_ven);
  begin insert into storage.objects (bucket_id, name) values ('personal', 'empleados/' || e_otro || '/ventas.jpg'); v_ok := true;
  exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'ventas no sube fotos del personal';
  assert not exists (select 1 from storage.objects where bucket_id = 'personal'), 'ventas no ve fotos del personal';
  perform pg_temp.como(v_gp);
  assert (select count(*) from storage.objects where bucket_id = 'personal' and name like 'empleados/%' and (name like '%' || e_yo || '%' or name like '%' || e_otro || '%')) = 2, 'la gerencia de producción las ve';
  perform pg_temp.como(v_yo);
  assert (select count(*) from storage.objects where bucket_id = 'personal') = 1, 'cada quien ve solo la suya';
  begin insert into storage.objects (bucket_id, name) values ('personal', 'empleados/' || e_yo || '/selfie.jpg'); v_ok := true;
  exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'la foto la sube RRHH, no la persona';
end $$;

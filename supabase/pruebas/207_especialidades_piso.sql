-- Especialidades dentro de un área: cada una dice qué familias de equipo hace y tiene su gente.
-- El plan reparte la capacidad del área según la gente: lo de una familia con especialidad lo hace
-- su cuadrilla (y quien no tiene especialidad); lo demás, cualquiera. Las acomoda la gerencia.
do $$
declare
  v_ger uuid; v_sup uuid; v_fin uuid; v_ven uuid; v_et int; v_otra int; c1 int; c2 int; c3 int; v_a int; v_b int; v_ok boolean;
  e1 uuid; e2 uuid; e3 uuid; e4 uuid; e5 uuid; q1 uuid; q2 uuid; q3 uuid; o1 uuid; o2 uuid; o3 uuid;
  r record; d_con int; d_sin int; v_msg text;
begin
  v_ger := pg_temp.usuario('gp207@hegamex.com', '{gerente_produccion}');
  v_sup := pg_temp.usuario('sup207@hegamex.com', '{produccion}');
  v_fin := pg_temp.usuario('fin207@hegamex.com', '{finanzas}');
  v_ven := pg_temp.usuario('ven207@hegamex.com', '{ventas}');
  -- Solo estas órdenes en el plan, y un área de prueba con 80 h a la semana puestas a mano.
  update ordenes_produccion set en_espera_motivo = 'prueba 207' where estado in ('planeada', 'liberada', 'en_proceso');
  insert into etapas (nombre, orden, capacidad_horas_semana, capacidad_automatica) values ('P207 Pailería', 998, 80, false) returning id into v_et;
  insert into etapas (nombre, orden, capacidad_horas_semana, capacidad_automatica) values ('P207 Pintura', 999, 40, false) returning id into v_otra;
  insert into categorias (nombre) values ('P207 Cribadora') returning id into c1;
  insert into categorias (nombre) values ('P207 Dosificadora') returning id into c2;
  insert into categorias (nombre) values ('P207 Tolva') returning id into c3;
  insert into empleados (nombre, fecha_ingreso, departamento_id, etapa_id, en_cuadrillas) values
    ('P207 Uno', current_date - 400, departamento_produccion(), v_et, true) returning id into e1;
  insert into empleados (nombre, fecha_ingreso, departamento_id, etapa_id, en_cuadrillas) values
    ('P207 Dos', current_date - 400, departamento_produccion(), v_et, true) returning id into e2;
  insert into empleados (nombre, fecha_ingreso, departamento_id, etapa_id, en_cuadrillas) values
    ('P207 Tres', current_date - 400, departamento_produccion(), v_et, true) returning id into e3;
  insert into empleados (nombre, fecha_ingreso, departamento_id, etapa_id, en_cuadrillas) values
    ('P207 Cuatro', current_date - 400, departamento_produccion(), v_et, true) returning id into e4;
  insert into empleados (nombre, fecha_ingreso, departamento_id, etapa_id, en_cuadrillas) values
    ('P207 Pintor', current_date - 400, departamento_produccion(), v_otra, true) returning id into e5;

  -- 1. Las acomoda la gerencia de producción; el supervisor de piso y ventas no.
  perform pg_temp.como(v_sup);
  begin perform guardar_especialidad(null, v_et, 'Cribadoras', array[c1]); v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'el supervisor de piso creó una especialidad';
  perform pg_temp.como(v_ven);
  begin perform guardar_especialidad(null, v_et, 'Cribadoras', array[c1]); v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'ventas creó una especialidad';
  perform pg_temp.como(v_ger);
  v_a := guardar_especialidad(null, v_et, 'Cribadoras', array[c1]);
  v_b := guardar_especialidad(null, v_et, 'Dosificadoras', array[c2]);
  --    Una familia es de una sola especialidad por área, y no hay dos con el mismo nombre.
  begin perform guardar_especialidad(null, v_et, 'Mixta', array[c1, c3]); v_ok := true;
  exception when others then v_ok := false; v_msg := sqlerrm; end;
  assert not v_ok and v_msg like '%ya los hace «Cribadoras»%', format('una familia quedó en dos especialidades: %s', v_msg);
  begin perform guardar_especialidad(null, v_et, ' cribadoras ', '{}'); v_ok := true; exception when others then v_ok := false; end;
  assert not v_ok, 'se repitió el nombre de una especialidad en la misma área';
  --    En otra área sí puede haber una «Cribadoras» con la misma familia.
  perform borrar_especialidad(guardar_especialidad(null, v_otra, 'Cribadoras', array[c1]));

  -- 2. La gente: una de Cribadoras y tres de Dosificadoras; nadie sin especialidad.
  perform ajustar_especialidad(e1, v_a);
  perform ajustar_especialidad(e2, v_b);
  perform ajustar_especialidad(e3, v_b);
  perform ajustar_especialidad(e4, v_b);
  --    La especialidad es del área de la persona.
  begin perform ajustar_especialidad(e5, v_a); v_ok := true; exception when others then v_ok := false; v_msg := sqlerrm; end;
  assert not v_ok and v_msg like '%es de P207 Pailería%', format('el pintor quedó en Cribadoras: %s', v_msg);
  select * into r from especialidades_taller() where id = v_a;
  assert r.personas = 1 and r.horas_semana = 20 and r.familias = array['P207 Cribadora'], format('Cribadoras: %s', r);
  assert (select personas = 3 and horas_semana = 60 from especialidades_taller() where id = v_b), 'Dosificadoras no tiene 3 personas y 60 h';

  -- 3. El plan: una cribadora, una dosificadora y una tolva (familia sin especialidad).
  perform pg_temp.como_postgres();
  insert into articulos (clave, tipo, nombre, categoria_id) values ('T207-CR', 'equipo', 'Cribadora 207', c1) returning id into q1;
  insert into articulos (clave, tipo, nombre, categoria_id) values ('T207-DO', 'equipo', 'Dosificadora 207', c2) returning id into q2;
  insert into articulos (clave, tipo, nombre, categoria_id) values ('T207-TO', 'equipo', 'Tolva 207', c3) returning id into q3;
  insert into ordenes_produccion (articulo_id, cantidad, estado) values (q1, 1, 'liberada') returning id into o1;
  insert into ordenes_produccion (articulo_id, cantidad, estado) values (q2, 1, 'liberada') returning id into o2;
  insert into ordenes_produccion (articulo_id, cantidad, estado) values (q3, 1, 'liberada') returning id into o3;
  insert into op_operaciones (orden_id, etapa_id, horas_estimadas) values (o1, v_et, 40), (o2, v_et, 40), (o3, v_et, 20);

  perform pg_temp.como(v_ger);
  assert (select especialidad_id from plan_produccion() where orden_id = o1) = v_a, 'la cribadora no salió de Cribadoras';
  assert (select especialidad_id from plan_produccion() where orden_id = o2) = v_b, 'la dosificadora no salió de Dosificadoras';
  assert (select especialidad_id from plan_produccion() where orden_id = o3) is null, 'la tolva salió con especialidad';
  assert (select especialidad from v_piso_operaciones where orden_id = o1) = 'Cribadoras', 'el piso no dice que es de Cribadoras';
  --    La cribadora solo cabe en las 20 h de su cuadrilla (no en las 60 de Dosificadoras): con las
  --    especialidades tarda más que con el área como una sola bolsa.
  select count(*) filter (where horas_jornada(d::date) > 0) into d_con
  from plan_produccion() p, generate_series(p.inicio_plan, p.fin_plan, interval '1 day') d where p.orden_id = o1;
  --    La tolva no es de nadie: aunque no haya gente sin especialidad, se planea con la que se desocupe.
  assert (select fin_plan from plan_produccion() where orden_id = o3) is not null, 'la tolva se quedó sin plan';
  perform borrar_especialidad(v_a);
  perform borrar_especialidad(v_b);
  assert (select count(*) from empleados where id in (e1, e2, e3, e4) and especialidad_id is not null) = 0, 'al borrarlas la gente siguió con especialidad';
  select count(*) filter (where horas_jornada(d::date) > 0) into d_sin
  from plan_produccion() p, generate_series(p.inicio_plan, p.fin_plan, interval '1 day') d where p.orden_id = o1;
  assert d_con > d_sin, format('la especialidad no frenó a la cribadora: con %s días, sin %s', d_con, d_sin);

  -- 4. Cambiar de área a alguien le quita la especialidad (en el área nueva no existe).
  v_a := guardar_especialidad(null, v_et, 'Cribadoras', array[c1]);
  perform ajustar_especialidad(e1, v_a);
  perform ajustar_personal_piso(e1, v_otra, true);
  assert (select especialidad_id from empleados where id = e1) is null, 'se cambió de área y conservó la especialidad';

  -- 5. Lo ve quien ve el taller; finanzas no.
  perform pg_temp.como(v_fin);
  assert not exists (select 1 from especialidades), 'finanzas ve las especialidades';
  begin perform especialidades_taller(); v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'finanzas leyó especialidades_taller';
  perform pg_temp.como_postgres();
end $$;

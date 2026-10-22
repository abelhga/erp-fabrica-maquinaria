-- Plan del taller: una etapa no empieza antes de que termine la anterior; la urgente va
-- primero; la capacidad del área limita; reordenar en el Gantt (o la cola en Cuadrillas)
-- cambia el plan y el renglón; ventas no lo ve.
do $$
declare v_gp uuid; v_sup uuid; v_vend uuid; v_eq uuid; a uuid; b uuid; a1 uuid; a2 uuid; b1 uuid; v_pai int; v_pin int;
  ra record; rb record; ra2 record; v_ok boolean;
begin
  v_gp := pg_temp.usuario('gp158@hegamex.com', '{gerente_produccion}');
  v_sup := pg_temp.usuario('sup158@hegamex.com', '{produccion}');
  v_vend := pg_temp.usuario('ven158@hegamex.com', '{ventas}');
  select id into v_pai from etapas where nombre = 'Pailería';
  select id into v_pin from etapas where nombre = 'Pintura';
  -- Un taller chico para que se note la fila: Pailería da 18 h al día (una cuadrilla de 2).
  -- Las demás órdenes de la base no estorban: se mandan a espera dentro de la prueba.
  update ordenes_produccion set en_espera_motivo = 'prueba 158', en_espera_desde = now() where estado in ('planeada', 'liberada', 'en_proceso');
  update etapas set capacidad_horas_semana = 90 where id = v_pai;
  insert into articulos (clave, tipo, nombre) values ('T158-EQ', 'equipo', 'Banda plan 158') returning id into v_eq;
  insert into ordenes_produccion (articulo_id, cantidad, estado, prioridad, fecha_compromiso) values (v_eq, 1, 'liberada', 2, current_date + 60) returning id into b;
  insert into ordenes_produccion (articulo_id, cantidad, estado, prioridad, fecha_compromiso) values (v_eq, 1, 'liberada', 1, current_date + 30) returning id into a;
  insert into op_operaciones (orden_id, etapa_id, horas_estimadas) values (a, v_pai, 36) returning id into a1;
  insert into op_operaciones (orden_id, etapa_id, horas_estimadas) values (a, v_pin, 9) returning id into a2;
  insert into op_operaciones (orden_id, etapa_id, horas_estimadas) values (b, v_pai, 18) returning id into b1;

  perform pg_temp.como(v_sup);
  select * into ra from plan_produccion() where operacion_id = a1;
  select * into ra2 from plan_produccion() where operacion_id = a2;
  select * into rb from plan_produccion() where operacion_id = b1;
  assert ra.inicio_plan is not null and ra.fin_plan is not null, 'sin plan para la urgente';
  -- 36 h a 18 h por día: dos días hábiles.
  assert (select count(*) from generate_series(ra.inicio_plan, ra.fin_plan, interval '1 day') g where extract(isodow from g) <= 5) = 2,
    format('la pailería de 36 h no tomó 2 días: %s a %s', ra.inicio_plan, ra.fin_plan);
  assert ra2.inicio_plan > ra.fin_plan, format('pintura empezó (%s) antes de que acabara pailería (%s)', ra2.inicio_plan, ra.fin_plan);
  -- La urgente primero: la otra espera a que se libere pailería.
  assert rb.inicio_plan > ra.fin_plan, format('la normal (%s) no esperó a la urgente (%s)', rb.inicio_plan, ra.fin_plan);
  assert (select horas_restantes from plan_produccion() where operacion_id = a1) = 36, 'horas restantes';

  -- El supervisor no reordena; la gerencia sí, y el plan cambia.
  begin perform ordenar_plan(array[b, a]); v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'el supervisor reordenó el plan';
  perform pg_temp.como(v_gp);
  perform ordenar_plan(array[b, a]);
  assert (select turno from op_operaciones where id = b1) = 1 and (select turno from op_operaciones where id = a1) = 2, 'no quedó la cola';
  select * into ra from plan_produccion() where operacion_id = a1;
  select * into rb from plan_produccion() where operacion_id = b1;
  assert rb.fin_plan < ra.inicio_plan, format('después de reordenar la normal (%s) debió ir antes de la urgente (%s)', rb.fin_plan, ra.inicio_plan);
  assert rb.posicion = 1 and ra.posicion = 2, 'el renglón del Gantt no siguió el orden arrastrado';

  -- Acomodar la cola de Pailería en Cuadrillas mueve el renglón y reparte los mismos números
  -- (no vuelve a empezar en 1: eso subía en el Gantt lo que nadie subió).
  perform pg_temp.como_postgres();
  update op_operaciones set turno = case id when a1 then 9 else 4 end where id in (a1, b1);
  perform pg_temp.como(v_gp);
  perform ordenar_cola(array[a1, b1]);
  assert (select turno from op_operaciones where id = a1) = 4 and (select turno from op_operaciones where id = b1) = 9, 'la cola no reutilizó sus números';
  assert (select posicion from plan_produccion() where operacion_id = a2) = 1, 'el renglón no siguió la cola de Cuadrillas';

  -- Lo que ya está en proceso sigue desde hoy, aunque su etapa anterior siga pendiente.
  perform pg_temp.como_postgres();
  update op_operaciones set estado = 'en_proceso', inicio = now() where id = a2;
  perform pg_temp.como(v_gp);
  assert (select inicio_plan from plan_produccion() where operacion_id = a2) = (select min(g)::date from generate_series(hoy_mx(), hoy_mx() + 7, interval '1 day') g where extract(isodow from g) <= 5),
    'la etapa en proceso no siguió desde hoy';

  -- Ventas no ve el plan (trae horas del taller).
  perform pg_temp.como(v_vend);
  begin perform plan_produccion(); v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'ventas vio el plan';
end $$;

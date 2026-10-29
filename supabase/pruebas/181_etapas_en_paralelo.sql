-- Torno va en paralelo: no espera a Pailería (ni en el plan ni en el piso) y Pintura espera a
-- las dos. Con el interruptor apagado, vuelve a ser una fila.
do $$
declare v_gp uuid; v_eq uuid; v_op uuid; v_pai int; v_tor int; v_pin int; r_pai record; r_tor record; r_pin record;
begin
  v_gp := pg_temp.usuario('gp181@hegamex.com', '{gerente_produccion}');
  select id into v_pai from etapas where nombre = 'Pailería';
  select id into v_tor from etapas where nombre = 'Torno';
  select id into v_pin from etapas where nombre = 'Pintura';
  assert (select en_paralelo from etapas where id = v_tor), 'Torno no quedó en paralelo';
  -- Solo esta orden en el plan, y capacidad en las tres áreas.
  update ordenes_produccion set en_espera_motivo = 'prueba 181' where estado in ('planeada', 'liberada', 'en_proceso');
  update etapas set capacidad_automatica = false, capacidad_horas_semana = 200 where id in (v_pai, v_tor, v_pin);
  insert into articulos (clave, tipo, nombre) values ('T181-EQ', 'equipo', 'Equipo 181') returning id into v_eq;
  insert into ordenes_produccion (articulo_id, cantidad, estado) values (v_eq, 1, 'liberada') returning id into v_op;
  insert into op_operaciones (orden_id, etapa_id, horas_estimadas) values (v_op, v_pai, 60), (v_op, v_tor, 20), (v_op, v_pin, 10);

  perform pg_temp.como(v_gp);
  select * into r_pai from plan_produccion() where orden_id = v_op and etapa_id = v_pai;
  select * into r_tor from plan_produccion() where orden_id = v_op and etapa_id = v_tor;
  select * into r_pin from plan_produccion() where orden_id = v_op and etapa_id = v_pin;
  assert r_tor.inicio_plan = r_pai.inicio_plan, format('Torno esperó a Pailería: torno %s, pailería %s', r_tor.inicio_plan, r_pai.inicio_plan);
  assert r_pin.inicio_plan > greatest(r_pai.fin_plan, r_tor.fin_plan), format('Pintura no esperó a las dos: %s', r_pin.inicio_plan);
  -- En el piso: Torno está lista con Pailería pendiente; Pintura espera a las dos.
  assert (select lista from v_piso_operaciones where orden_id = v_op and etapa_id = v_tor), 'Torno no salió lista para empezar';
  assert (select espera_a from v_piso_operaciones where orden_id = v_op and etapa_id = v_pin) = 'Pailería, Torno', 'Pintura no espera a Pailería y Torno';

  -- Apagado, Torno vuelve a esperar a Pailería.
  perform pg_temp.como_postgres();
  update etapas set en_paralelo = false where id = v_tor;
  perform pg_temp.como(v_gp);
  select * into r_pai from plan_produccion() where orden_id = v_op and etapa_id = v_pai;
  select * into r_tor from plan_produccion() where orden_id = v_op and etapa_id = v_tor;
  assert r_tor.inicio_plan > r_pai.fin_plan, 'sin paralelo, Torno no esperó a Pailería';
  assert not (select lista from v_piso_operaciones where orden_id = v_op and etapa_id = v_tor), 'sin paralelo, Torno salió lista';
  perform pg_temp.como_postgres();
end $$;

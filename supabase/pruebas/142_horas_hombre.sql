-- Horas hombre por persona: cada quien su tramo; las personas sin nombre cuentan igual;
-- pausar o terminar la etapa cierra a todos; nadie está en dos etapas a la vez.
do $$
declare v_sup uuid; v_gp uuid; v_vend uuid; v_rh uuid; v_eq uuid; v_op uuid; v_pail int; v_pint int; x1 uuid; x2 uuid;
  e1 uuid; e2 uuid; e3 uuid; v_t uuid; v_ok boolean; r record;
begin
  v_sup := pg_temp.usuario('sup142@hegamex.com', '{produccion}');
  v_vend := pg_temp.usuario('vend142@hegamex.com', '{ventas}');
  v_gp := pg_temp.usuario('gp142@hegamex.com', '{gerente_produccion}');
  v_rh := pg_temp.usuario('rh142@hegamex.com', '{rrhh}');
  perform pg_temp.como(v_rh);
  insert into empleados (nombre, fecha_ingreso, departamento_id, en_cuadrillas) values ('Ana Pailera142', '2023-01-02', departamento_produccion(), true) returning id into e1;
  insert into empleados (nombre, fecha_ingreso, departamento_id, en_cuadrillas) values ('Beto Pailero142', '2023-01-02', departamento_produccion(), true) returning id into e2;
  insert into empleados (nombre, fecha_ingreso, departamento_id, en_cuadrillas) values ('Carla Pintora142', '2023-01-02', departamento_produccion(), true) returning id into e3;

  perform pg_temp.como_postgres();
  select id into v_pail from etapas where nombre = 'Pailería';
  select id into v_pint from etapas where nombre = 'Pintura';
  insert into articulos (clave, tipo, nombre) values ('T142-EQ', 'equipo', 'Banda 142') returning id into v_eq;
  insert into ordenes_produccion (articulo_id, cantidad, estado) values (v_eq, 1, 'liberada') returning id into v_op;
  insert into op_operaciones (orden_id, etapa_id, horas_estimadas) values (v_op, v_pail, 10) returning id into x1;
  insert into op_operaciones (orden_id, etapa_id, horas_estimadas) values (v_op, v_pint, 5) returning id into x2;

  -- Empiezan Ana, Beto y un ayudante sin nombre.
  perform pg_temp.como(v_sup);
  perform avanzar_operacion(x1, 'inicio', p_empleados => array[e1, e2], p_sin_nombre => 1);
  assert (select count(*) from op_tiempos where operacion_id = x1 and fin is null) = 3, 'dos tramos con nombre + uno de 1 sin nombre';
  assert (select sum(personas) from op_tiempos where operacion_id = x1) = 3, 'tres personas';
  assert (select responsable from op_operaciones where id = x1) like 'Ana Pailera142, Beto Pailero142 +1', 'el responsable dice la cuadrilla';

  -- Ana no puede estar en dos etapas a la vez.
  begin perform avanzar_operacion(x2, 'inicio', p_empleados => array[e1]); v_ok := true;
  exception when raise_exception then v_ok := sqlerrm not like '%ya está trabajando en Pailería%'; end;
  assert not v_ok, 'nadie en dos etapas';

  -- Hace 4 h que empezaron; Beto se fue hace 3 h (trabajó 1).
  perform pg_temp.como_postgres();
  update op_tiempos set inicio = now() - interval '4 hours' where operacion_id = x1;
  select id into v_t from op_tiempos where empleado_id = e2;
  perform pg_temp.como(v_sup);
  perform salir_de_etapa(v_t);
  perform pg_temp.como_postgres();
  update op_tiempos set fin = inicio + interval '1 hour' where id = v_t;

  -- Carla se une y al rato se pausa la etapa: se cierra todo.
  perform pg_temp.como(v_sup);
  perform unir_a_etapa(x1, e3);
  begin perform unir_a_etapa(x1, e3); v_ok := true; exception when raise_exception then v_ok := false; end;
  assert not v_ok, 'no se une dos veces';
  perform avanzar_operacion(x1, 'pausa');
  assert not exists (select 1 from op_tiempos where operacion_id = x1 and fin is null), 'la pausa cierra todos los tramos';
  perform pg_temp.como_postgres();
  update op_tiempos set inicio = fin - interval '2 hours' where empleado_id = e3;

  -- 4 (Ana) + 1 (Beto) + 4 (ayudante) + 2 (Carla) = 11 h hombre; 4 sin nombre.
  perform pg_temp.como(v_vend);
  select * into r from horas_hombre_orden(v_op) where operacion_id = x1;
  assert abs(r.horas_reales - 11) < 0.05 and abs(r.horas_sin_nombre - 4) < 0.05 and r.horas_estimadas = 10, format('horas hombre: %s', row_to_json(r));
  assert jsonb_array_length(r.personas) = 4, format('quién trabajó: %s', r.personas);

  -- Al reanudar se elige otra vez quién; al terminar se cierra.
  perform pg_temp.como(v_sup);
  perform avanzar_operacion(x1, 'reanudar', p_empleados => array[e1]);
  assert (select count(*) from cuadrillas_abiertas() where operacion_id = x1) = 1, 'la cuadrilla abierta es Ana';
  assert (select trabajando_en from personal_de_piso() where id = e1) like 'Pailería · %', 'la terminal sabe dónde está';
  perform avanzar_operacion(x1, 'fin');
  assert not exists (select 1 from op_tiempos where operacion_id = x1 and fin is null), 'terminar cierra';
  -- Poner la orden en espera también cierra lo abierto (por el disparador).
  perform avanzar_operacion(x2, 'inicio', p_empleados => array[e3]);
  perform pg_temp.como(v_gp);
  perform poner_en_espera(v_op, 'Cliente ausente prueba');
  assert not exists (select 1 from op_tiempos where operacion_id = x2 and fin is null), 'en espera cierra los tramos';

  -- Ventas ve pero no escribe; la tabla no se toca directo; la lista de personal no es para ventas.
  perform pg_temp.como(v_vend);
  assert exists (select 1 from op_tiempos where orden_id = v_op), 'ventas ve los tiempos';
  begin perform unir_a_etapa(x1, e2); v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'ventas no une gente';
  begin insert into op_tiempos (operacion_id, orden_id) values (x1, v_op); v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'nadie escribe directo';
  begin perform personal_de_piso(); v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'ventas no ve la lista de personal';
  -- Las funciones internas no se llaman desde fuera.
  perform pg_temp.como(v_sup);
  begin perform abrir_tramos(x1, array[e2], 0); v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'abrir_tramos es interna';
end $$;

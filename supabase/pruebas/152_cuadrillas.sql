-- El tablero de cuadrillas y la terminal son lo mismo: lo que marca uno lo ve el otro, y
-- mover a alguien cierra su tiempo donde estaba y lo abre donde llega.
do $$
declare v_gp uuid; v_sup uuid; v_vend uuid; v_eq uuid; v_op uuid; v_op2 uuid; x1 uuid; x2 uuid; y1 uuid; y2 uuid;
  v_pedro uuid; v_ramiro uuid; v_juan uuid; v_ok boolean; v_r text;
begin
  v_gp := pg_temp.usuario('gp152@hegamex.com', '{gerente_produccion}');
  v_sup := pg_temp.usuario('sup152@hegamex.com', '{produccion}');
  v_vend := pg_temp.usuario('vend152@hegamex.com', '{ventas}');
  insert into empleados (nombre, fecha_ingreso, departamento_id, en_cuadrillas) values ('Pedro 152', current_date, departamento_produccion(), true) returning id into v_pedro;
  insert into empleados (nombre, fecha_ingreso, departamento_id, en_cuadrillas) values ('Ramiro 152', current_date, departamento_produccion(), true) returning id into v_ramiro;
  insert into empleados (nombre, fecha_ingreso, departamento_id, en_cuadrillas) values ('Juan 152', current_date, departamento_produccion(), true) returning id into v_juan;
  insert into articulos (clave, tipo, nombre) values ('T152-EQ', 'equipo', 'Tolva 152') returning id into v_eq;
  insert into ordenes_produccion (articulo_id, cantidad, estado) values (v_eq, 1, 'liberada') returning id into v_op;
  insert into ordenes_produccion (articulo_id, cantidad, estado) values (v_eq, 1, 'liberada') returning id into v_op2;
  insert into op_operaciones (orden_id, etapa_id, horas_estimadas) values (v_op, (select id from etapas where nombre = 'Pailería'), 10) returning id into x1;
  insert into op_operaciones (orden_id, etapa_id, horas_estimadas) values (v_op, (select id from etapas where nombre = 'Pintura'), 5) returning id into x2;
  insert into op_operaciones (orden_id, etapa_id, horas_estimadas) values (v_op2, (select id from etapas where nombre = 'Pailería'), 8) returning id into y1;
  insert into op_operaciones (orden_id, etapa_id, horas_estimadas) values (v_op2, (select id from etapas where nombre = 'Pintura'), 4) returning id into y2;

  -- En el tablero la gerencia planea a Pedro y Ramiro en Pailería: no abre tiempo.
  perform pg_temp.como(v_gp);
  v_r := asignar_a_etapa(x1, v_pedro);
  assert v_r = 'planeado', 'no quedó planeado: ' || v_r;
  perform asignar_a_etapa(x1, v_ramiro);
  assert (select count(*) from op_asignaciones where operacion_id = x1) = 2, 'no quedaron los dos planeados';
  assert not exists (select 1 from op_tiempos where operacion_id = x1), 'planear abrió tiempo';
  -- Juan puede estar planeado en dos etapas (es su cola).
  perform asignar_a_etapa(x1, v_juan);
  perform asignar_a_etapa(y1, v_juan);

  -- El supervisor no mueve gente en el tablero, ventas tampoco.
  perform pg_temp.como(v_sup);
  begin perform asignar_a_etapa(x2, v_pedro); v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'el supervisor movió gente en el tablero';
  perform pg_temp.como(v_vend);
  begin perform quitar_de_etapa(x1, v_pedro); v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'ventas quitó a alguien de una etapa';
  begin perform ordenar_cola(array[y1, x1]); v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'ventas ordenó la cola';

  -- La terminal inicia solo con Pedro y Ramiro: Juan deja la cuadrilla planeada de esa etapa
  -- (manda lo que se hizo), pero sigue planeado en la otra.
  perform pg_temp.como(v_sup);
  perform avanzar_operacion(x1, 'inicio', null, null, array[v_pedro, v_ramiro], 0);
  assert (select array_agg(empleado_id order by empleado_id) from op_asignaciones where operacion_id = x1)
       = (select array_agg(e order by e) from unnest(array[v_pedro, v_ramiro]) e), 'la cuadrilla no quedó como arrancó';
  assert exists (select 1 from op_asignaciones where operacion_id = y1 and empleado_id = v_juan), 'Juan perdió su otra etapa';

  -- En la terminal Juan se une: queda en la cuadrilla. Ramiro sale: deja de estarlo.
  perform unir_a_etapa(x1, v_juan);
  assert exists (select 1 from op_asignaciones where operacion_id = x1 and empleado_id = v_juan), 'unirse no lo puso en la cuadrilla';
  perform salir_de_etapa((select id from op_tiempos where operacion_id = x1 and empleado_id = v_ramiro and fin is null));
  assert not exists (select 1 from op_asignaciones where operacion_id = x1 and empleado_id = v_ramiro), 'salir no lo quitó de la cuadrilla';

  -- Pausar cierra los tiempos pero la cuadrilla se queda (es la que reanuda).
  perform avanzar_operacion(x1, 'pausa');
  assert not exists (select 1 from op_tiempos where operacion_id = x1 and fin is null), 'la pausa dejó tiempos abiertos';
  assert (select count(*) from op_asignaciones where operacion_id = x1) = 2, 'la pausa borró la cuadrilla';
  perform avanzar_operacion(x1, 'reanudar', null, null, array[v_pedro, v_juan], 0);

  -- Tablero: mover a Pedro de Pailería (trabajando) a Pintura de la otra orden, que está en
  -- proceso, le cierra su tiempo en Pailería y se lo abre en Pintura.
  perform avanzar_operacion(y2, 'inicio', null, null, null, 1);
  perform pg_temp.como(v_gp);
  begin perform asignar_a_etapa(y2, v_pedro); v_ok := true; exception when raise_exception then v_ok := sqlerrm not like '%está trabajando en%'; end;
  assert not v_ok, 'dejó a Pedro trabajando en dos etapas';
  v_r := asignar_a_etapa(y2, v_pedro, x1);
  assert v_r = 'trabajando', 'Pedro no entró a trabajar: ' || v_r;
  assert (select fin is not null from op_tiempos where operacion_id = x1 and empleado_id = v_pedro order by inicio desc limit 1), 'no se cerró su tiempo en Pailería';
  assert exists (select 1 from op_tiempos where operacion_id = y2 and empleado_id = v_pedro and fin is null), 'no se abrió su tiempo en Pintura';
  assert not exists (select 1 from op_asignaciones where operacion_id = x1 and empleado_id = v_pedro), 'Pedro siguió en la cuadrilla de Pailería';
  assert exists (select 1 from op_asignaciones where operacion_id = y2 and empleado_id = v_pedro), 'Pedro no quedó en la cuadrilla de Pintura';
  assert (select count(*) from op_eventos where operacion_id in (x1, y2) and nota like 'Pedro 152 % (tablero de cuadrillas)') = 2, 'sin eventos del cambio de manos';
  -- Y la terminal ya no deja que nadie lo anote en otro lado.
  perform pg_temp.como(v_sup);
  begin perform unir_a_etapa(x1, v_pedro); v_ok := true; exception when raise_exception then v_ok := false; end;
  assert not v_ok, 'la terminal anotó a Pedro en dos etapas';

  -- Quitar desde el tablero a quien está trabajando cierra su tiempo.
  perform pg_temp.como(v_gp);
  perform quitar_de_etapa(y2, v_pedro);
  assert not exists (select 1 from op_tiempos where empleado_id = v_pedro and fin is null), 'quitar dejó su tiempo abierto';

  -- La cola: la gerencia la ordena dentro de una etapa; no mezcla etapas.
  perform ordenar_cola(array[y1, x1]);
  assert (select turno from op_operaciones where id = y1) = 1 and (select turno from op_operaciones where id = x1) = 2, 'no se ordenó la cola';
  assert (select turno from v_piso_operaciones where id = y1) = 1, 'el piso no trae el turno';
  begin perform ordenar_cola(array[y1, y2]); v_ok := true; exception when raise_exception then v_ok := false; end;
  assert not v_ok, 'ordenó una cola con dos etapas';

  -- Las horas que ya lleva una etapa salen en el piso (para el "faltan").
  assert (select horas_reales from v_piso_operaciones where id = x1) >= 0, 'el piso no trae las horas reales';

  -- Una etapa terminada ya no recibe gente.
  perform pg_temp.como(v_sup);
  perform avanzar_operacion(y2, 'fin');
  perform pg_temp.como(v_gp);
  begin perform asignar_a_etapa(y2, v_ramiro); v_ok := true; exception when raise_exception then v_ok := false; end;
  assert not v_ok, 'asignó gente a una etapa terminada';

  -- Nadie escribe la cuadrilla directo.
  begin insert into op_asignaciones (operacion_id, empleado_id) values (x2, v_ramiro); v_ok := true;
  exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'se escribió la cuadrilla sin pasar por las funciones';
end $$;

-- Tiempos de entrega: el equipo nuevo entra al final de la fila del taller; la fecha
-- propuesta es la más tardía entre su tiempo estándar y lo que tarda la fila.
do $$
declare
  v_vend uuid; v_gp uuid; v_rh uuid; v_mp uuid; v_eq uuid; v_eq2 uuid; v_op uuid; j jsonb; j2 jsonb; v_pail int;
begin
  v_vend := pg_temp.usuario('vend109@hegamex.com', '{ventas}');
  v_gp := pg_temp.usuario('gp109@hegamex.com', '{gerente_produccion}');
  v_rh := pg_temp.usuario('rh109@hegamex.com', '{rrhh}');

  -- Una sola etapa con capacidad para que la cuenta sea a mano: 100 h por semana.
  update etapas set activa = false;
  insert into etapas (nombre, orden, color, capacidad_horas_semana, activa) values ('Pailería prueba', 1, '#888', 100, true) returning id into v_pail;
  delete from op_operaciones;

  insert into articulos (clave, tipo, nombre, unidad) values ('T109-MP', 'materia_prima', 'Lámina', 'pieza') returning id into v_mp;
  insert into articulos (clave, tipo, nombre, dias_fabricacion) values ('T109-EQ', 'equipo', 'Banda de prueba', 20) returning id into v_eq;
  insert into articulos (clave, tipo, nombre) values ('T109-EQ2', 'equipo', 'Equipo sin días') returning id into v_eq2;
  insert into bom_lineas (padre_id, hijo_id, cantidad) values (v_eq, v_mp, 1), (v_eq2, v_mp, 1);
  -- 200 h de pailería por equipo: con el taller vacío son 2 semanas (10 días hábiles), menos que sus 20 de estándar.
  insert into bom_operaciones (articulo_id, etapa_id, horas) values (v_eq, v_pail, 200), (v_eq2, v_pail, 200);

  perform pg_temp.como(v_vend);
  j := estimar_entrega(jsonb_build_array(jsonb_build_object('articulo_id', v_eq, 'cantidad', 1)));
  assert (j->>'equipos')::int = 1 and (j->>'dias_estandar')::int = 20, format('estándar: %s', j);
  assert (j->>'dias_carga')::int = 10 and (j->>'dias_propuestos')::int = 20, format('taller libre: manda el estándar: %s', j);
  assert (j->>'fecha_propuesta')::date = sumar_dias_habiles(hoy_planta(), 20), 'fecha propuesta en días hábiles';
  assert j->>'cuello' = 'Pailería prueba', 'cuello de botella';

  -- Con 1,000 h ya en la fila (10 semanas), el nuevo sale en 12 semanas = 60 días hábiles.
  perform pg_temp.como_postgres();
  insert into ordenes_produccion (articulo_id, cantidad, estado) values (v_eq, 1, 'en_proceso') returning id into v_op;
  insert into op_operaciones (orden_id, etapa_id, horas_estimadas, estado) values (v_op, v_pail, 1000, 'pendiente');
  perform pg_temp.como(v_vend);
  j := estimar_entrega(jsonb_build_array(jsonb_build_object('articulo_id', v_eq, 'cantidad', 1)));
  assert (j->>'semanas_cola')::numeric = 10 and (j->>'dias_carga')::int = 60 and (j->>'dias_propuestos')::int = 60, format('con fila: %s', j);
  -- Dos piezas pesan el doble en la fila.
  j2 := estimar_entrega(jsonb_build_array(jsonb_build_object('articulo_id', v_eq, 'cantidad', 2)));
  assert (j2->>'dias_carga')::int = 70, format('dos piezas: %s', j2);
  -- Lo terminado ya no hace fila.
  perform pg_temp.como_postgres();
  update op_operaciones set estado = 'terminada' where orden_id = v_op;
  perform pg_temp.como(v_vend);
  assert (estimar_entrega(jsonb_build_array(jsonb_build_object('articulo_id', v_eq)))->>'semanas_cola')::numeric = 0, 'lo terminado no cuenta';

  -- Equipo sin días de fabricación: lo dice, y propone con la fila.
  j := estimar_entrega(jsonb_build_array(jsonb_build_object('articulo_id', v_eq2)));
  assert j->'sin_dias' ? 'Equipo sin días' and j->>'dias_estandar' is null and (j->>'dias_propuestos')::int = 10, format('sin días: %s', j);
  -- Sin partidas que se fabriquen: solo la fila, sin fecha.
  j := estimar_entrega(jsonb_build_array(jsonb_build_object('articulo_id', v_mp)));
  assert (j->>'equipos')::int = 0 and j->>'fecha_propuesta' is null, format('solo componentes: %s', j);
  -- Ventas no puede cambiar los días.
  begin
    perform fijar_dias_fabricacion(v_eq, 5);
    assert false, 'ventas cambió los días de fabricación';
  exception when insufficient_privilege then null;
  end;

  -- La gerencia de producción sí.
  perform pg_temp.como(v_gp);
  perform fijar_dias_fabricacion(v_eq, 30);
  assert (estimar_entrega(jsonb_build_array(jsonb_build_object('articulo_id', v_eq)))->>'dias_estandar')::int = 30, 'días ajustados';

  -- Quien no es de ventas ni de producción no ve la fila del taller.
  perform pg_temp.como(v_rh);
  begin
    perform estimar_entrega('[]'::jsonb);
    assert false, 'RRHH vio la fila del taller';
  exception when insufficient_privilege then null;
  end;
end $$;

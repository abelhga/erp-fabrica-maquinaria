-- El ritmo del almacén junta el historial del sistema anterior con lo del ERP sin contar dos veces:
-- el historial vale hasta la carga inicial y el ERP desde ahí. Cuenta por día de la semana y por
-- hora de la planta, deja fuera de las horas lo que no trae hora, y no lo ve quien no ve movimientos.
do $$
declare v_alm uuid; v_vend uuid; v_a uuid; v_almacen int; v_ok boolean; r jsonb;
begin
  v_alm := pg_temp.usuario('alm307@hegamex.com', '{almacen}');
  v_vend := pg_temp.usuario('vend307@hegamex.com', '{ventas}');
  select id into v_almacen from almacenes order by id limit 1;
  insert into articulos (clave, tipo, nombre, unidad) values ('T307-TOR', 'materia_prima', 'Tornillo 307', 'pieza') returning id into v_a;
  -- La carga inicial marca dónde termina el historial (si la base ya tenía una, manda la más vieja).
  insert into movimientos_inventario (tipo, articulo_id, almacen_id, cantidad) values ('inicial', v_a, v_almacen, 100);
  -- Marzo de 2019 no tiene nada más: lunes 4 dos salidas a las 9 y una entrada a las 16; martes 5 un
  -- ajuste; y un renglón del lunes 11 con fecha sin hora.
  insert into historial_movimientos_hoja (fecha, articulo_id, nombre_original, cantidad, tipo, almacen) values
    ('2019-03-04 09:10:00-06', v_a, 'Tornillo 307', 5, 'SALIDA', 'Mallado'),
    ('2019-03-04 09:40:00-06', v_a, 'Tornillo 307', 3, 'SALIDA', 'Mallado'),
    ('2019-03-04 16:05:00-06', v_a, 'Tornillo 307', 50, 'ENTRADA', 'Mallado'),
    ('2019-03-05 11:30:00-06', v_a, 'Tornillo 307', 1, 'AJUSTE SALIDA', 'Mallado'),
    ('2019-03-11 13:00:00-06', v_a, 'Tornillo 307', 2, 'SALIDA', 'Mallado'),
    -- Lo que el sistema anterior registró después de la carga inicial ya lo trae el ERP: no cuenta.
    (now() + interval '1 day', v_a, 'Tornillo 307', 9, 'SALIDA', 'Mallado');

  perform pg_temp.como(v_alm);
  r := almacen_ritmo('2019-03-01', '2019-03-31');
  assert (r->'resumen'->>'movimientos')::int = 5 and (r->'resumen'->>'del_historial')::int = 5 and (r->'resumen'->>'del_erp')::int = 0
     and (r->'resumen'->>'dias_activos')::int = 3 and (r->'resumen'->>'sin_hora')::int = 1, format('resumen: %s', r->'resumen');
  assert (select (x->>'salidas')::int = 3 and (x->>'entradas')::int = 1 and (x->>'dias')::int = 2 from jsonb_array_elements(r->'por_dia_semana') x where (x->>'dia')::int = 1),
    format('lunes: %s', r->'por_dia_semana');
  assert (select (x->>'ajustes')::int = 1 from jsonb_array_elements(r->'por_dia_semana') x where (x->>'dia')::int = 2), 'el ajuste del martes';
  assert (select (x->>'salidas')::int from jsonb_array_elements(r->'por_hora') x where (x->>'hora')::int = 9) = 2, 'las salidas de las 9';
  assert not exists (select 1 from jsonb_array_elements(r->'por_hora') x where (x->>'hora')::int = 13), 'el renglón sin hora entró a las horas';
  assert (select (x->>'entradas')::int from jsonb_array_elements(r->'calor') x where (x->>'dia')::int = 1 and (x->>'hora')::int = 16) = 1, 'el mapa de día y hora';
  assert (r->'por_mes'->0->>'mes') = '2019-03-01' and (r->'por_mes'->0->>'origen') = 'historial', format('por mes: %s', r->'por_mes');
  assert (r->'dias_pico'->0->>'dia') = '2019-03-04' and (r->'dias_pico'->0->>'movimientos')::int = 3, 'día récord';
  assert r::text !~* 'costo', 'el ritmo trae costos';

  -- De mañana en adelante solo cuenta el ERP: el renglón del historial con esa fecha no entra.
  r := almacen_ritmo(hoy_planta() + 1, hoy_planta() + 2);
  assert (r->'resumen'->>'del_historial')::int = 0, 'contó historial posterior a la carga inicial';
  -- La carga inicial no es un movimiento del día.
  r := almacen_ritmo(hoy_planta(), hoy_planta());
  assert (r->'resumen'->>'erp_desde') is not null, 'no dice desde cuándo cuenta el ERP';

  begin perform almacen_ritmo('2019-03-31', '2019-03-01'); v_ok := true; exception when invalid_parameter_value then v_ok := false; end;
  assert not v_ok, 'aceptó un periodo al revés';
  perform pg_temp.como(v_vend);
  begin perform almacen_ritmo(); v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'ventas vio el ritmo del almacén';
end $$;

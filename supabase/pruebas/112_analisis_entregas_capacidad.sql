-- Cumplimiento de entregas y promesas en riesgo: la fila del taller por fecha
-- compromiso, y lo prometido contra lo que cabe.
do $$
declare
  v_dir uuid; v_gp uuid; v_vend uuid; v_pail int; v_eq uuid; v_cli uuid; v_a uuid; v_b uuid; v_c uuid; r record; j jsonb; v_n int;
  v_hoy date := hoy_planta();
begin
  v_dir := pg_temp.usuario('dir112@hegamex.com', '{direccion}');
  v_gp := pg_temp.usuario('gp112@hegamex.com', '{gerente_produccion}');
  v_vend := pg_temp.usuario('ven112@hegamex.com', '{ventas}');

  -- Una sola etapa de 100 h por semana para hacer la cuenta a mano.
  update etapas set activa = false;
  insert into etapas (nombre, orden, color, capacidad_horas_semana, activa) values ('Pailería 112', 1, '#888', 100, true) returning id into v_pail;
  delete from op_operaciones;
  insert into articulos (clave, tipo, nombre) values ('T112-EQ', 'equipo', 'Banda 112') returning id into v_eq;
  insert into clientes (nombre, vendedor_id) values ('T112 Cliente', v_vend) returning id into v_cli;

  -- A: prometida a 30 días con 300 h: sale en 3 semanas (15 días hábiles), a tiempo.
  -- B: prometida a 35 días con 500 h; va detrás de A: 8 semanas = 40 días hábiles, tarde.
  -- C: sin compromiso, va al final y no se juzga.
  insert into ordenes_produccion (articulo_id, cantidad, estado, fecha_compromiso, numero_serie) values (v_eq, 1, 'en_proceso', v_hoy + 30, 'T112A') returning id into v_a;
  insert into ordenes_produccion (articulo_id, cantidad, estado, fecha_compromiso, numero_serie) values (v_eq, 1, 'planeada', v_hoy + 35, 'T112B') returning id into v_b;
  insert into ordenes_produccion (articulo_id, cantidad, estado, numero_serie) values (v_eq, 1, 'planeada', 'T112C') returning id into v_c;
  insert into op_operaciones (orden_id, etapa_id, horas_estimadas) values (v_a, v_pail, 300), (v_b, v_pail, 500), (v_c, v_pail, 100);

  perform pg_temp.como(v_dir);
  select * into r from analisis_promesas() where orden_id = v_a;
  assert r.estimada = sumar_dias_habiles(v_hoy, 15) and r.dias < 0 and r.cuello = 'Pailería 112', format('A: %s', row_to_json(r));
  select * into r from analisis_promesas() where orden_id = v_b;
  assert r.estimada = sumar_dias_habiles(v_hoy, 40) and r.dias > 0, format('B en riesgo: %s', row_to_json(r));
  assert not exists (select 1 from analisis_promesas() where orden_id = v_c), 'sin compromiso no es promesa';

  -- Capacidad: 9 semanas en fila, 1 sin fecha; se pone al día en 45 días hábiles.
  j := analisis_capacidad(3);
  assert j->>'cuello' = 'Pailería 112' and (j->>'semanas_cola')::numeric = 9 and (j->>'sin_fecha')::numeric = 1, format('capacidad: %s', j);
  assert (j->>'al_dia')::date = sumar_dias_habiles(v_hoy, 45), format('al día: %s', j->>'al_dia');
  assert jsonb_array_length(j->'meses') = 3, 'tres meses';

  -- Lo que se cumplió: uno a tiempo, uno tarde 5 días, uno vencido sin entregar (3 días) y uno que aún no se juzga.
  perform pg_temp.como_postgres();
  insert into pedidos (folio, cliente_id, vendedor_id, fecha, fecha_compromiso, estado, entregado_en) values
    ('T112-1', v_cli, v_vend, v_hoy - 40, v_hoy - 10, 'entregado', (v_hoy - 12)::timestamp at time zone 'America/Mexico_City'),
    ('T112-2', v_cli, v_vend, v_hoy - 40, v_hoy - 10, 'entregado', (v_hoy - 5)::timestamp at time zone 'America/Mexico_City'),
    ('T112-3', v_cli, v_vend, v_hoy - 40, v_hoy - 3, 'en_produccion', null),
    ('T112-4', v_cli, v_vend, v_hoy - 40, v_hoy + 10, 'en_produccion', null);
  perform pg_temp.como(v_dir);
  j := analisis_entregas(v_hoy - 60, v_hoy + 60) -> 'pedidos';
  assert (j->>'juzgados')::int >= 3 and (j->>'a_tiempo')::int >= 1, format('entregas: %s', j);
  j := analisis_entregas(v_hoy - 11, v_hoy - 2);
  assert (j #>> '{pedidos,juzgados}')::int = 3 and (j #>> '{pedidos,a_tiempo}')::int = 1 and (j #>> '{pedidos,tarde}')::int = 2
     and (j #>> '{pedidos,vencidos_abiertos}')::int = 1 and (j #>> '{pedidos,dias_atraso}')::numeric = 4, format('cumplimiento: %s', j);
  assert exists (select 1 from jsonb_array_elements(j->'por_vendedor') v where v->>'vendedor' = 'ven112' and (v->>'juzgados')::int = 3),
    format('por vendedor: %s', j->'por_vendedor');

  -- El aviso de "Lo que importa hoy" para dirección y producción.
  assert exists (select 1 from hallazgos_entregas('direccion') h where h.ruta = '/analisis/entregas'), 'falta el aviso de promesas en riesgo';
  perform pg_temp.como(v_gp);
  assert exists (select 1 from analisis_promesas() where orden_id = v_b), 'la gerencia de producción no ve las promesas';
  assert exists (select 1 from hallazgos('produccion') h where h.ruta = '/analisis/entregas'), 'producción no recibe el aviso';

  -- Un vendedor no entra al análisis.
  perform pg_temp.como(v_vend);
  begin
    perform analisis_promesas();
    assert false, 'un vendedor vio las promesas en riesgo';
  exception when insufficient_privilege then null;
  end;
  begin
    perform analisis_entregas(v_hoy - 30, v_hoy);
    assert false, 'un vendedor vio el cumplimiento';
  exception when insufficient_privilege then null;
  end;
  select count(*) into v_n from hallazgos_entregas('ventas');
  assert v_n = 0, 'un vendedor recibió avisos de dirección';
end $$;

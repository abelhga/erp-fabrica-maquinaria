-- La cuenta de la tablet del taller (rol «terminal»): marca el avance de las etapas y reporta
-- fallas, y nada más. No es una persona: no lleva mejoras.
do $$
declare v_term uuid; v_gp uuid; v_eq uuid; v_cli uuid; v_ped uuid; v_op uuid; x1 uuid; v_maq uuid; v_ok boolean;
begin
  v_term := pg_temp.usuario('terminal.prueba176@hegamex.com', '{terminal}');
  v_gp := pg_temp.usuario('gp176@hegamex.com', '{gerente_produccion}');
  insert into articulos (clave, tipo, nombre) values ('T176-EQ', 'equipo', 'Tolva 176') returning id into v_eq;
  insert into clientes (nombre) values ('Cliente 176') returning id into v_cli;
  insert into pedidos (cliente_id, estado) values (v_cli, 'en_produccion') returning id into v_ped;
  insert into ordenes_produccion (articulo_id, cantidad, estado, pedido_id) values (v_eq, 1, 'liberada', v_ped) returning id into v_op;
  insert into op_operaciones (orden_id, etapa_id, horas_estimadas) values (v_op, (select id from etapas where nombre = 'Pailería'), 10) returning id into x1;
  insert into maquinas (numero, nombre, categoria) values ('SOL-176', 'Soldadora 176', 'Soldadoras') returning id into v_maq;

  perform pg_temp.como(v_term);
  assert puede('produccion', 2) and puede('mantenimiento', 2), 'la terminal no puede marcar avance ni reportar fallas';
  assert not (puede('produccion', 3) or puede('servicio', 1) or puede('inventario', 1) or puede('costeo', 1)
              or puede('ventas', 1) or puede('asistente', 1) or puede('rrhh', 1) or puede('finanzas', 1)),
    'la terminal tiene permisos de más';

  -- Marca el avance como el supervisor.
  perform avanzar_operacion(x1, 'inicio');
  assert (select estado from op_operaciones where id = x1) = 'en_proceso', 'la terminal no inició la etapa';
  -- Pero no planea: reabrir o agregar etapas es de la gerencia.
  begin perform agregar_etapa_orden(v_op, (select id from etapas where nombre = 'Pintura'), 5, 'Falta pintura'); v_ok := true;
  exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'la terminal agregó una etapa';
  -- Ve las máquinas para reportar una falla desde la terminal.
  assert exists (select 1 from maquinas where id = v_maq), 'la terminal no ve las máquinas para reportar fallas';
  -- Ni ve los pedidos (ni sus montos).
  assert not exists (select 1 from pedidos where id = v_ped), 'la terminal ve pedidos';

  -- La tablet no aparece entre las personas que llevan mejoras.
  perform pg_temp.como(v_gp);
  assert not exists (select 1 from personas_mejoras() where id = v_term), 'la tablet salió como persona para llevar mejoras';
  assert exists (select 1 from personas_mejoras() where id = v_gp), 'la gerencia no salió para llevar mejoras';
end $$;

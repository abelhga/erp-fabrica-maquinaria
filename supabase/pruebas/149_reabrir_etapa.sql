-- Una etapa terminada por error se reabre: quien la terminó lo deshace en 15 minutos; la
-- gerencia, cuando sea y con motivo. Si era la última, la orden y el pedido regresan.
do $$
declare v_sup uuid; v_sup2 uuid; v_gp uuid; v_vend uuid; v_eq uuid; v_cli uuid; v_ped uuid; v_op uuid; x1 uuid; x2 uuid; v_ok boolean;
begin
  v_sup := pg_temp.usuario('sup149@hegamex.com', '{produccion}');
  v_sup2 := pg_temp.usuario('sup2149@hegamex.com', '{produccion}');
  v_gp := pg_temp.usuario('gp149@hegamex.com', '{gerente_produccion}');
  v_vend := pg_temp.usuario('vend149@hegamex.com', '{ventas}');
  insert into articulos (clave, tipo, nombre) values ('T149-EQ', 'equipo', 'Tolva 149') returning id into v_eq;
  insert into clientes (nombre) values ('Cliente 149') returning id into v_cli;
  insert into pedidos (cliente_id, estado) values (v_cli, 'en_produccion') returning id into v_ped;
  insert into ordenes_produccion (articulo_id, cantidad, estado, pedido_id) values (v_eq, 1, 'liberada', v_ped) returning id into v_op;
  insert into op_operaciones (orden_id, etapa_id, horas_estimadas) values (v_op, (select id from etapas where nombre = 'Pailería'), 10) returning id into x1;
  insert into op_operaciones (orden_id, etapa_id, horas_estimadas) values (v_op, (select id from etapas where nombre = 'Pintura'), 5) returning id into x2;

  -- El supervisor termina Pailería por error y lo deshace enseguida: queda pausada, con su inicio.
  perform pg_temp.como(v_sup);
  perform avanzar_operacion(x1, 'inicio');
  perform avanzar_operacion(x1, 'fin');
  perform reabrir_etapa(x1);
  assert (select estado = 'pausada' and fin is null and inicio is not null from op_operaciones where id = x1), 'no se deshizo el terminar';
  assert (select nota from op_eventos where operacion_id = x1 and tipo = 'reabierta') = 'Se marcó terminada por error', 'sin evento de reabierta';

  -- Pasados 15 minutos, o si la terminó otra persona, el supervisor ya no puede.
  perform avanzar_operacion(x1, 'reanudar');
  perform avanzar_operacion(x1, 'fin');
  perform pg_temp.como(v_sup2);
  begin perform reabrir_etapa(x1); v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'otro supervisor reabrió una etapa que no terminó';
  perform pg_temp.como_postgres();
  update op_eventos set en = now() - interval '16 minutes' where operacion_id = x1 and tipo = 'fin';
  perform pg_temp.como(v_sup);
  begin perform reabrir_etapa(x1); v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'el supervisor reabrió pasados 15 minutos';

  -- Ventas no reabre; la gerencia sí, pero con motivo.
  perform pg_temp.como(v_vend);
  begin perform reabrir_etapa(x1, 'porque sí'); v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'ventas reabrió una etapa';
  perform pg_temp.como(v_gp);
  begin perform reabrir_etapa(x1); v_ok := true; exception when raise_exception then v_ok := sqlerrm not like 'Escribe por qué%'; end;
  assert not v_ok, 'la gerencia reabrió sin motivo';
  perform reabrir_etapa(x1, 'Falta soldar la tolva 3');
  assert (select estado from op_operaciones where id = x1) = 'pausada', 'la gerencia no reabrió';

  -- La última etapa: la orden terminada y el pedido listo regresan.
  perform pg_temp.como(v_sup);
  perform avanzar_operacion(x1, 'reanudar');
  perform avanzar_operacion(x1, 'fin');
  perform avanzar_operacion(x2, 'inicio');
  perform avanzar_operacion(x2, 'fin');
  assert (select estado from ordenes_produccion where id = v_op) = 'terminada', 'la orden no terminó';
  assert (select estado from pedidos_basicos() where id = v_ped) = 'listo', 'el pedido no quedó listo';
  perform reabrir_etapa(x2);
  assert (select estado = 'en_proceso' and terminada_en is null from ordenes_produccion where id = v_op), 'la orden siguió terminada';
  assert (select estado from pedidos_basicos() where id = v_ped) = 'en_produccion', 'el pedido siguió listo';

  -- Una orden entregada ya no se reabre.
  perform avanzar_operacion(x2, 'reanudar');
  perform avanzar_operacion(x2, 'fin');
  perform pg_temp.como_postgres();
  update ordenes_produccion set estado = 'entregada' where id = v_op;
  perform pg_temp.como(v_gp);
  begin perform reabrir_etapa(x2, 'Se regresó'); v_ok := true; exception when raise_exception then v_ok := false; end;
  assert not v_ok, 'se reabrió una etapa de una orden entregada';

  -- Un inicio nunca queda en el futuro.
  perform pg_temp.como_postgres();
  update op_operaciones set estado = 'pendiente', inicio = now() + interval '2 hours', fin = null where id = x1;
  update ordenes_produccion set estado = 'en_proceso' where id = v_op;
  perform pg_temp.como(v_sup);
  perform avanzar_operacion(x1, 'fin');
  assert (select inicio <= fin from op_operaciones where id = x1), 'quedó un inicio después del fin';
end $$;

-- Reabrir un pendiente: solo quien lo cerró y antes de 15 minutos; queda dicho en su conversación.
-- Al cancelar un pedido a varios se reabre completo; al reabrir uno «hecho» a quien lo pidió se le
-- avisa, y a los que se les cerró porque otro lo hizo, les vuelve a tocar.
do $$
declare v_a uuid; v_b uuid; v_c uuid; v_p uuid; v_g uuid := gen_random_uuid(); v_g2 uuid := gen_random_uuid(); v_ok boolean; n int;
begin
  v_a := pg_temp.usuario('a228@hegamex.com', '{ventas}');
  v_b := pg_temp.usuario('b228@hegamex.com', '{compras}');
  v_c := pg_temp.usuario('c228@hegamex.com', '{almacen}');

  -- 1. A cancela por error y lo reabre.
  perform pg_temp.como(v_a);
  insert into pendientes (titulo, responsable_id, creado_por, vence) values ('Conectar Gmail 228', v_b, v_a, hoy_mx() + 1) returning id into v_p;
  update pendientes set estado = 'cancelado', nota_cierre = 'Ya no hace falta' where id = v_p;
  -- B (no lo cerró) no lo reabre.
  perform pg_temp.como(v_b);
  begin perform reabrir_pendiente(v_p); v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'lo reabrió alguien que no lo cerró';
  perform pg_temp.como(v_a);
  n := reabrir_pendiente(v_p, 'Lo cancelé por error');
  perform pg_temp.como_postgres();
  assert n = 1 and (select (estado, cerrado_por, cerrado_en, nota_cierre) is not distinct from ('abierto'::text, null::uuid, null::timestamptz, null::text) from pendientes where id = v_p),
    'no quedó abierto y limpio';
  assert exists (select 1 from pendiente_mensajes where pendiente_id = v_p and autor_id = v_a and texto like '%estaba cancelado%Lo cancelé por error%'),
    'la conversación no dice que se reabrió';

  -- 2. Pasados 15 minutos ya no.
  perform pg_temp.como(v_a);
  update pendientes set estado = 'cancelado' where id = v_p;
  perform pg_temp.como_postgres();
  update pendientes set cerrado_en = now() - interval '16 minutes' where id = v_p;
  perform pg_temp.como(v_a);
  begin perform reabrir_pendiente(v_p); v_ok := true; exception when check_violation then v_ok := false; end;
  assert not v_ok, 'se reabrió después de 15 minutos';
  -- Y a mano tampoco (lo cerrado no se cambia).
  begin update pendientes set estado = 'abierto' where id = v_p; v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'se reabrió a mano sin la función';

  -- 3. Pedido a varios cancelado completo: se reabre completo.
  insert into pendientes (titulo, responsable_id, creado_por, grupo_id, modo) values
    ('Inventario 228', v_b, v_a, v_g, 'todos'), ('Inventario 228', v_c, v_a, v_g, 'todos');
  update pendientes set estado = 'cancelado' where grupo_id = v_g;
  n := reabrir_pendiente((select id from pendientes where grupo_id = v_g and responsable_id = v_b));
  assert n = 2, format('del grupo se reabrieron %s', n);

  -- 4. «Basta con que uno»: B lo marca hecho por error y lo reabre; A y C se enteran, C lo vuelve a tener.
  insert into pendientes (titulo, responsable_id, creado_por, grupo_id, modo) values
    ('Báscula 228', v_b, v_a, v_g2, 'uno'), ('Báscula 228', v_c, v_a, v_g2, 'uno');
  perform pg_temp.como(v_b);
  update pendientes set estado = 'hecho' where grupo_id = v_g2 and responsable_id = v_b;
  n := reabrir_pendiente((select id from pendientes where grupo_id = v_g2 and responsable_id = v_b), 'Todavía no la reviso');
  perform pg_temp.como_postgres();
  assert n = 2 and not exists (select 1 from pendientes where grupo_id = v_g2 and estado <> 'abierto'), 'el grupo «uno» no se reabrió completo';
  assert exists (select 1 from avisos where usuario_id = v_a and tipo = 'pendiente_reabierto'), 'a quien lo pidió no le avisaron';
  assert exists (select 1 from avisos where usuario_id = v_c and tipo = 'pendiente_reabierto'), 'a C no le avisaron que le vuelve a tocar';
end $$;

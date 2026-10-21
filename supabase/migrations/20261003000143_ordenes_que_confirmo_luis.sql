-- Las 4 órdenes cargadas de «fabricación de equipos» que ya no salían en la hoja de Luis
-- (21 oct 2026). Él confirmó qué pasó con cada una; mientras siguieran abiertas, las V7 y
-- la base sumaban horas a la cola del taller y la Zeus esperaba una entrega que ya fue.
-- Es lo mismo que hacen entregar_orden y cancelar_orden (con su evento), sin pedir permiso
-- de usuario porque corre como migración. Ninguna tenía material apartado ni pedidos a
-- compras pendientes. La fecha real de entrega de la Zeus no se registró: queda la de hoy.
do $$
declare v_n int;
begin
  update public.ordenes_produccion set estado = 'entregada', entregada_en = now()
  where folio = 'OP-2026-00003' and numero_serie = '3AAMBACE6TMMJA033' and estado = 'terminada';
  get diagnostics v_n = row_count;
  if v_n = 1 then
    insert into public.op_eventos (orden_id, tipo, nota)
    select id, 'entregada', 'Luis confirmó que ya se entregó (21 oct 2026; la fecha real no se registró)'
    from public.ordenes_produccion where folio = 'OP-2026-00003';
  end if;

  with c(folio, motivo) as (values
    ('OP-2026-00043', 'Cancelada: se fabricó una V7 para un cliente y no dio los resultados esperados, así que se cancelaron las de stock (Luis, 21 oct 2026)'),
    ('OP-2026-00044', 'Cancelada: se fabricó una V7 para un cliente y no dio los resultados esperados, así que se cancelaron las de stock (Luis, 21 oct 2026)'),
    ('OP-2026-00041', 'Cancelada: era para uno de los dos silos de 100 t importados y se vendieron ambos (Luis, 21 oct 2026)')),
  u as (
    update public.ordenes_produccion o set estado = 'cancelada', cancelada_en = now(), motivo_cancelacion = c.motivo
    from c where o.folio = c.folio and o.estado = 'planeada' returning o.id, c.motivo)
  insert into public.op_eventos (orden_id, tipo, nota) select id, 'nota', 'Orden ' || lower(left(motivo, 1)) || substr(motivo, 2) from u;
  get diagnostics v_n = row_count;
  raise notice 'Órdenes canceladas: %', v_n;
end $$;

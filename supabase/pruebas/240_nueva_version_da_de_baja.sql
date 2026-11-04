-- Nueva versión: si la actual ya no vale, la enviada queda rechazada y la que no se envió, cancelada,
-- las dos con «Se reemplazó por la versión …», sin cerrar la oportunidad ni dejar seguimientos vivos.
-- Si sigue vigente, no se toca.
do $$
declare v_ven uuid; v_cli uuid; c1 uuid; c2 uuid; b1 uuid; b2 uuid; s1 uuid; s2 uuid; r record;
begin
  v_ven := pg_temp.usuario('ven240@hegamex.com', '{ventas}');
  insert into clientes (nombre, vendedor_id) values ('Agregados 240', v_ven) returning id into v_cli;
  perform pg_temp.como(v_ven);

  -- 1. Enviada → rechazada, con el folio de la nueva; la oportunidad sigue abierta y sin seguimientos de la vieja.
  c1 := nueva_cotizacion(v_cli);
  insert into cotizacion_lineas (cotizacion_id, titulo, precio_unitario) values (c1, 'Banda 240', 10000);
  update cotizaciones set estado = 'enviada' where id = c1;
  c2 := nueva_version_cotizacion(c1, true);
  select * into r from cotizaciones where id = c1;
  assert r.estado = 'rechazada' and r.motivo_rechazo = 'Se reemplazó por la versión ' || (select folio from cotizaciones where id = c2),
    format('la enviada quedó %s / %s', r.estado, r.motivo_rechazo);
  assert (select etapa from oportunidades where id = r.oportunidad_id) not in ('perdida', 'ganada'), 'cerró la oportunidad';
  assert (select estado from cotizaciones where id = c2) = 'borrador', 'la nueva no quedó en borrador';

  -- 2. Borrador que nunca se envió → cancelada.
  b1 := nueva_cotizacion(v_cli);
  insert into cotizacion_lineas (cotizacion_id, titulo, precio_unitario) values (b1, 'Tolva 240', 5000);
  b2 := nueva_version_cotizacion(b1, true);
  assert (select estado from cotizaciones where id = b1) = 'cancelada', 'el borrador no quedó cancelado';

  -- 3. Sigue vigente: no se toca (la llamada de siempre, sin el segundo dato).
  s1 := nueva_cotizacion(v_cli);
  insert into cotizacion_lineas (cotizacion_id, titulo, precio_unitario) values (s1, 'Polea 240', 3000);
  update cotizaciones set estado = 'enviada' where id = s1;
  s2 := nueva_version_cotizacion(s1);
  assert (select estado from cotizaciones where id = s1) = 'enviada', 'tocó la que seguía vigente';

  -- 4. Una ya rechazada no cambia al sacarle versión.
  perform nueva_version_cotizacion(c1, true);
  assert (select motivo_rechazo from cotizaciones where id = c1) like 'Se reemplazó por la versión %-v2', 'cambió el motivo de la ya rechazada';
  perform pg_temp.como_postgres();
end $$;

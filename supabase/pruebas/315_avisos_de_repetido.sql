-- Los avisos de «repetido» salen cuando de verdad puede ser lo mismo, el folio de un pago se toma
-- de su descripción o de la compra con ese número, y finanzas corrige descripción y folio (nada más).
do $$
declare v_fin uuid; v_com uuid; v_prov uuid; v_c1 uuid; v_c2 uuid; v_p uuid; v_n int; v_ok boolean; r record;
begin
  v_fin := pg_temp.usuario('fin315@hegamex.com', '{finanzas}');
  v_com := pg_temp.usuario('com315@hegamex.com', '{compras}');
  insert into proveedores (nombre, categoria) values ('Aceros prueba 315', 'Aceros') returning id into v_prov;

  perform pg_temp.como(v_fin);
  v_c1 := registrar_movimiento_proveedor(p_proveedor => v_prov, p_tipo => 'compra', p_monto => 154, p_fecha => hoy_planta() - 3,
    p_factura => 'BB 3575087', p_metodo_pago => 'PUE', p_categoria => 'Aceros');
  v_c2 := registrar_movimiento_proveedor(p_proveedor => v_prov, p_tipo => 'compra', p_monto => 5766.30, p_fecha => hoy_planta() - 10,
    p_factura => '08-01UD0501 0174983', p_metodo_pago => 'PPD', p_categoria => 'Aceros');

  -- Otro folio, mismo monto y semana (otra caseta): ya no avisa.
  select count(*) into v_n from compras_parecidas(v_prov, 154, hoy_planta() - 2, 'BB 3510890');
  assert v_n = 0, format('avisó por una compra con otro folio (%s)', v_n);
  -- Sin folio, mismo monto: sí, y dice por qué.
  select * into r from compras_parecidas(v_prov, 154, hoy_planta() - 2, 'S/F');
  assert r.por = 'sin_folio', format('sin folio no avisó: %s', to_jsonb(r));
  -- El mismo número escrito sin la serie: sí, aunque el monto se capture distinto.
  select * into r from compras_parecidas(v_prov, 5766.00, hoy_planta() - 1, '0174983');
  assert r.por = 'mismo_numero' and r.factura = '08-01UD0501 0174983', format('mismo número no avisó: %s', to_jsonb(r));

  -- El pago con el folio en la descripción queda ligado a su compra, escrito como la compra.
  v_p := registrar_movimiento_proveedor(p_proveedor => v_prov, p_tipo => 'pago', p_monto => 5766.30, p_fecha => hoy_planta(),
    p_cuenta => (select clave from cuentas_dinero order by 1 limit 1), p_descripcion => 'Transferencia FAC. 0174983');
  assert (select factura from movimientos_proveedor where id = v_p) = '08-01UD0501 0174983',
    format('el pago no tomó el folio: %s', (select factura from movimientos_proveedor where id = v_p));
  -- El mismo pago otra vez: aparece en los parecidos; uno por otra factura, no.
  select count(*) into v_n from pagos_parecidos(v_prov, 5766.30, hoy_planta(), '08-01UD0501 0174983');
  assert v_n = 1, format('el pago repetido no se vio (%s)', v_n);
  select count(*) into v_n from pagos_parecidos(v_prov, 5766.30, hoy_planta(), 'BB 3575087');
  assert v_n = 0, format('avisó por un pago de otra factura (%s)', v_n);

  -- Finanzas corrige descripción y folio, pero no el monto.
  update movimientos_proveedor set descripcion = 'Caseta Guadalajara–Zapotlanejo' where id = v_c1;
  assert (select descripcion from movimientos_proveedor where id = v_c1) like 'Caseta%', 'finanzas no pudo corregir la descripción';
  begin update movimientos_proveedor set monto = 1 where id = v_c1; v_ok := true;
  exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'finanzas cambió el monto de una compra a mano';
  -- Un folio corregido que ya es de otra compra no pasa.
  begin update movimientos_proveedor set factura = '08-01UD0501 0174983' where id = v_c1; v_ok := true;
  exception when unique_violation then v_ok := false; end;
  assert not v_ok, 'un folio corregido repitió el de otra compra';

  -- Compras no corrige movimientos de proveedor (la RLS no deja: no truena, no cambia).
  perform pg_temp.como(v_com);
  update movimientos_proveedor set descripcion = 'cambiada por compras' where id = v_c1;
  perform pg_temp.como_postgres();
  assert (select descripcion from movimientos_proveedor where id = v_c1) like 'Caseta%', 'compras corrigió un movimiento de finanzas';

  -- «Ayúdame a corregirlo» ya llega a pagos y caja chica.
  assert 'movimientos_proveedor' = any(revision_tablas_corregibles()) and 'caja_chica' = any(revision_tablas_corregibles()),
    'finanzas sigue sin «Ayúdame a corregirlo»';
end $$;

-- Retiros de ahorro y abonos en efectivo a préstamos, también en finanzas.
--
-- RRHH registraba el retiro (y su recibo) pero finanzas no se enteraba: el dinero salía
-- de una cuenta sin dejar rastro en "Pagos hechos", y al conciliar el banco o arquear la
-- caja chica sobraba o faltaba sin explicación. Lo mismo al revés con los abonos que la
-- persona entrega en efectivo. Ahora RRHH dice de qué cuenta salió (o a cuál entró) y el
-- movimiento queda en la cuenta de un acreedor de nómina, como la nómina semanal (133):
--   * retiro de ahorro → "Caja de ahorro del personal": compra + pago (el pago, de la cuenta);
--   * abono a préstamo → "Préstamos al personal": reembolso pendiente + reembolso realizado
--     (entra a la cuenta). En los dos casos la cuenta del acreedor queda en cero.
-- Si la cuenta es la caja chica, también entra a su libro: si no, el arqueo salía descuadrado.
-- No pasa por registrar_movimiento_proveedor porque esa pide finanzas 2 y quien registra es
-- RRHH (nomina 3), que ya está revisado al inicio de cada función.

alter table public.nomina_ahorro_movimientos add column if not exists cuenta text references public.cuentas_dinero(clave);
alter table public.nomina_prestamo_pagos add column if not exists cuenta text references public.cuentas_dinero(clave);

-- El acreedor de nómina con ese nombre (se crea la primera vez) y su llave del libro.
create or replace function public.acreedor_personal(p_nombre text, out acreedor uuid, out llave text)
language plpgsql security definer set search_path = public as $$
begin
  select p.id into acreedor from proveedores p where p.nombre = p_nombre and p.tipo_acreedor = 'nomina' order by p.creado_en limit 1;
  if acreedor is null then
    insert into proveedores (nombre, categoria, tipo_acreedor) values (p_nombre, 'Nómina', 'nomina') returning proveedores.id into acreedor;
  end if;
  llave := coalesce((select m.proveedor_llave from movimientos_proveedor m where m.proveedor_id = acreedor limit 1), 'erp:' || acreedor::text);
end $$;
revoke execute on function public.acreedor_personal(text) from public, anon, authenticated;

-- De qué cuenta salió o a cuál entró: una de verdad (la nota de crédito no es dinero).
create or replace function public.validar_cuenta_personal(p_cuenta text) returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if p_cuenta is null or p_cuenta = 'nota_credito' or not exists (select 1 from cuentas_dinero where clave = p_cuenta and activa) then
    raise exception 'Di de qué cuenta sale o a cuál entra el dinero' using errcode = '22023';
  end if;
end $$;
revoke execute on function public.validar_cuenta_personal(text) from public, anon, authenticated;

drop function if exists public.retirar_ahorro(uuid, numeric, date, date, text);
create or replace function public.retirar_ahorro(p_empleado uuid, p_importe numeric, p_solicitado_el date, p_entrega date,
  p_cuenta text, p_nota text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_saldo numeric; v_dias int := coalesce((select (valor->>'ahorro_dias_anticipacion')::int from configuracion where clave = 'nomina'), 10);
  v uuid; v_folio text; v_nombre text; a record; v_importe numeric := round(p_importe, 2);
begin
  if not puede('nomina', 3) then raise exception 'El retiro de ahorro lo registra RRHH' using errcode = '42501'; end if;
  if exists (select 1 from empleados where id = p_empleado and usuario_id = auth.uid()) then
    raise exception 'Tu propio retiro lo registra otra persona' using errcode = '42501';
  end if;
  select nombre into v_nombre from empleados where id = p_empleado for update;
  v_saldo := ahorro_saldo(p_empleado);
  if coalesce(p_importe, 0) <= 0 then raise exception 'El retiro va arriba de 0'; end if;
  if p_importe > v_saldo then raise exception 'Solo tiene % de ahorro', to_char(v_saldo, 'FM$999,999,990.00'); end if;
  if p_solicitado_el is null or p_solicitado_el > hoy_planta() then raise exception 'La fecha en que lo pidió no puede ser futura'; end if;
  if p_entrega is null or p_entrega - p_solicitado_el < v_dias then
    raise exception 'Se entrega con % días de anticipación: lo pidió el %, se le puede entregar desde el %', v_dias,
      to_char(p_solicitado_el, 'DD/MM/YYYY'), to_char(p_solicitado_el + v_dias, 'DD/MM/YYYY');
  end if;
  -- Finanzas no registra pagos con fecha futura: el retiro se captura el día que se entrega.
  if p_entrega > hoy_planta() then
    raise exception 'Regístralo el día que se le entrega el dinero (el %): así queda en la cuenta de donde salió', to_char(p_entrega, 'DD/MM/YYYY');
  end if;
  perform validar_cuenta_personal(p_cuenta);
  v_folio := 'AH-' || lpad(nextval('nomina_ahorro_folio')::text, 5, '0');
  insert into nomina_ahorro_movimientos (empleado_id, tipo, importe, fecha, solicitado_el, folio, nota, cuenta)
  values (p_empleado, 'retiro', v_importe, p_entrega, p_solicitado_el, v_folio, nullif(trim(p_nota), ''), p_cuenta)
  returning id into v;

  select * into a from acreedor_personal('Caja de ahorro del personal');
  insert into movimientos_proveedor (proveedor_id, proveedor_llave, tipo, fecha, monto, cuenta, categoria, factura, descripcion, vence_el, leido_de)
  values (a.acreedor, a.llave, 'compra', p_entrega, v_importe, null, 'Nómina', v_folio, 'Retiro de ahorro de ' || v_nombre, p_entrega, 'captura'),
         (a.acreedor, a.llave, 'pago', p_entrega, v_importe, p_cuenta, null, v_folio, 'Retiro de ahorro de ' || v_nombre, null, null);
  if p_cuenta = 'caja_chica' then
    insert into caja_chica (fecha, tipo, importe, concepto, en_turno)
    values (p_entrega, 'salida', -v_importe, 'Retiro de ahorro ' || v_folio || ' · ' || v_nombre, (select nombre from perfiles where id = auth.uid()));
  end if;
  perform avisar(array(select usuarios_con_permiso('finanzas', 2)), 'ahorro_retiro',
    'Retiro de ahorro: ' || v_nombre,
    texto_dinero(v_importe) || ' de ' || (select nombre from cuentas_dinero where clave = p_cuenta) || ' (' || v_folio || ')',
    '/finanzas/pagos', 'nomina_ahorro_movimientos', v::text);
  return v;
end $$;
revoke execute on function public.retirar_ahorro(uuid, numeric, date, date, text, text) from public, anon;
grant execute on function public.retirar_ahorro(uuid, numeric, date, date, text, text) to authenticated;

drop function if exists public.abonar_prestamo(uuid, numeric, date, text);
create or replace function public.abonar_prestamo(p_prestamo uuid, p_importe numeric, p_fecha date, p_cuenta text, p_nota text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare p nomina_prestamos; v_saldo numeric; v uuid; v_folio text; v_nombre text; a record; v_importe numeric := round(p_importe, 2);
begin
  if not puede('nomina', 3) then raise exception 'Los abonos a préstamos los registra RRHH' using errcode = '42501'; end if;
  select * into p from nomina_prestamos where id = p_prestamo for update;
  if not found or p.estado <> 'activo' then raise exception 'Ese préstamo no está activo'; end if;
  if exists (select 1 from empleados where id = p.empleado_id and usuario_id = auth.uid()) then
    raise exception 'Tu propio abono lo registra otra persona' using errcode = '42501';
  end if;
  v_saldo := prestamo_saldo(p.id);
  if coalesce(p_importe, 0) <= 0 then raise exception 'El abono va arriba de 0'; end if;
  if p_importe > v_saldo then raise exception 'El saldo es de %: el abono no puede ser mayor', to_char(v_saldo, 'FM$999,999,990.00'); end if;
  if p_fecha is null or p_fecha > hoy_planta() then raise exception 'La fecha del abono no puede ser futura'; end if;
  perform validar_cuenta_personal(p_cuenta);
  insert into nomina_prestamo_pagos (prestamo_id, fecha, importe, nota, cuenta) values (p.id, p_fecha, v_importe, nullif(trim(p_nota), ''), p_cuenta)
  returning id, folio into v, v_folio;

  select nombre into v_nombre from empleados where id = p.empleado_id;
  select * into a from acreedor_personal('Préstamos al personal');
  insert into movimientos_proveedor (proveedor_id, proveedor_llave, tipo, fecha, monto, cuenta, factura, descripcion, leido_de)
  values (a.acreedor, a.llave, 'reembolso_pendiente', p_fecha, v_importe, null, v_folio, 'Abono de ' || v_nombre || ' a su préstamo ' || p.folio, 'captura'),
         (a.acreedor, a.llave, 'reembolso_realizado', p_fecha, v_importe, p_cuenta, v_folio, 'Abono de ' || v_nombre || ' a su préstamo ' || p.folio, null);
  if p_cuenta = 'caja_chica' then
    insert into caja_chica (fecha, tipo, importe, concepto, en_turno)
    values (p_fecha, 'entrada', v_importe, 'Abono a préstamo ' || p.folio || ' (' || v_folio || ') · ' || v_nombre, (select nombre from perfiles where id = auth.uid()));
  end if;
  perform avisar(array(select usuarios_con_permiso('finanzas', 2)), 'prestamo_abono',
    'Abono a préstamo: ' || v_nombre,
    texto_dinero(v_importe) || ' a ' || (select nombre from cuentas_dinero where clave = p_cuenta) || ' (' || v_folio || ')',
    '/finanzas/pagos', 'nomina_prestamo_pagos', v::text);
  return v;
end $$;
revoke execute on function public.abonar_prestamo(uuid, numeric, date, text, text) from public, anon;
grant execute on function public.abonar_prestamo(uuid, numeric, date, text, text) to authenticated;

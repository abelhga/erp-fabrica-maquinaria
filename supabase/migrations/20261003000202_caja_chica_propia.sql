-- =============================================================================
-- La caja chica tiene su propio permiso, aparte de finanzas.
--
-- Susana pidió que, cuando ella no está y alguien toma dinero de la caja, Karen (recepción) o
-- Toño (compras) lo puedan registrar. La caja pedía «finanzas nivel 2», y dárselos les abría
-- cobranza, pagos a proveedores y cuentas. Ahora es el módulo «caja_chica»:
--   1 ver el saldo y los movimientos · 2 registrar entradas y salidas · 3 arqueo, borrar y topes.
-- Arqueo y borrar se quedan con finanzas: quien toma el dinero no es quien cuenta la caja ni
-- quien borra lo capturado. Recepción y compras registran (2); finanzas, la gerencia
-- administrativa y dirección administran (3).
-- =============================================================================

insert into public.permisos_rol (rol, modulo, nivel) values
  ('direccion', 'caja_chica', 3), ('finanzas', 'caja_chica', 3), ('administracion', 'caja_chica', 3),
  ('recepcion', 'caja_chica', 2), ('compras', 'caja_chica', 2)
on conflict (rol, modulo) do update set nivel = excluded.nivel;

drop policy if exists ver on public.caja_chica;
create policy ver on public.caja_chica for select to authenticated using ((select puede('caja_chica', 1)));
drop policy if exists borrar on public.caja_chica;
create policy borrar on public.caja_chica for delete to authenticated using ((select puede('caja_chica', 3)) and origen = 'erp');

-- Igual que en 101; solo cambia el permiso que revisan.
create or replace function public.registrar_caja_chica(p_tipo text, p_monto numeric, p_concepto text,
  p_fecha date default null, p_notas text default null) returns bigint
language plpgsql security definer set search_path = public as $$
declare v_id bigint; v_fecha date := coalesce(p_fecha, hoy_planta());
begin
  if not puede('caja_chica', 2) then raise exception 'No registras movimientos de la caja chica' using errcode = '42501'; end if;
  if p_tipo not in ('entrada', 'salida') then raise exception 'Es entrada o salida' using errcode = '22023'; end if;
  if coalesce(p_monto, 0) <= 0 then raise exception 'El monto tiene que ser mayor a cero' using errcode = '22023'; end if;
  if nullif(trim(p_concepto), '') is null then raise exception 'Escribe el concepto' using errcode = '22023'; end if;
  if v_fecha > hoy_planta() then raise exception 'La fecha no puede ser futura' using errcode = '22023'; end if;
  insert into caja_chica (fecha, tipo, importe, concepto, notas, en_turno)
  values (v_fecha, p_tipo, case when p_tipo = 'entrada' then round(p_monto, 2) else -round(p_monto, 2) end, trim(p_concepto),
          nullif(trim(p_notas), ''), (select nombre from perfiles where id = auth.uid()))
  returning id into v_id;
  return v_id;
end $$;

-- Arqueo: se cuenta el efectivo y la diferencia contra el saldo queda como movimiento.
create or replace function public.arqueo_caja_chica(p_contado numeric, p_nota text default null) returns numeric
language plpgsql security definer set search_path = public as $$
declare v_saldo numeric; v_dif numeric;
begin
  if not puede('caja_chica', 3) then raise exception 'El arqueo lo hace finanzas' using errcode = '42501'; end if;
  if p_contado is null or p_contado < 0 then raise exception 'Escribe cuánto efectivo contaste' using errcode = '22023'; end if;
  perform pg_advisory_xact_lock(hashtext('caja_chica'));
  select coalesce(sum(importe), 0) into v_saldo from caja_chica;
  v_dif := round(p_contado - v_saldo, 2);
  if v_dif <> 0 then
    insert into caja_chica (tipo, importe, concepto, notas, en_turno)
    values ('arqueo', v_dif, case when v_dif > 0 then 'Arqueo: sobrante' else 'Arqueo: faltante' end,
            coalesce(nullif(trim(p_nota), ''), format('Se contaron %s; el sistema decía %s', to_char(p_contado, 'FM$999,999,990.00'), to_char(v_saldo, 'FM$999,999,990.00'))),
            (select nombre from perfiles where id = auth.uid()));
  end if;
  return v_dif;
end $$;

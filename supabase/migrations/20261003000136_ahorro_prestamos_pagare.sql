-- =============================================================================
-- Caja de ahorro del personal, abonos extra a préstamos, pagaré y finiquito.
--
-- 1. Ahorro: el concepto «Caja de ahorro» existía como descuento suelto por semana, sin
--    saldo ni manera de devolverlo. Ahora cada colaborador decide cuánto ahorra por
--    semana (RRHH lo captura, con historial); se descuenta solo en la prenómina y al
--    cerrar la semana pasa a su saldo. El retiro lo registra RRHH cuando la persona lo
--    pide, con la anticipación que fije la regla (p. ej. 10 días), y sale un recibo con
--    folio para firmar. Queda lista la aportación de la empresa (un % que arranca en 0).
-- 2. Préstamos: a veces la persona abona más de su descuento semanal. Antes solo se podía
--    cancelar el préstamo. Ahora un abono en efectivo (con recibo) baja el saldo; o se
--    descuenta más en la nómina de una semana abierta.
-- 3. Al inicio del préstamo firman un pagaré: el ERP lo imprime (sin interés; si algún día
--    se configura un interés moratorio, el pagaré lo dice) y anota cuándo se firmó.
-- 4. Si alguien se da de baja debiendo, el saldo completo se descuenta en su última semana
--    (finiquito), y la prenómina avisa si tiene ahorro por entregarle.
-- =============================================================================

-- Préstamos: folio y pagaré ----------------------------------------------------
create sequence if not exists public.nomina_prestamo_folio;
alter table public.nomina_prestamos add column if not exists folio text unique default 'PR-' || lpad(nextval('public.nomina_prestamo_folio')::text, 4, '0');
alter table public.nomina_prestamos add column if not exists pagare_firmado_el date;
update public.nomina_prestamos set folio = 'PR-' || lpad(nextval('public.nomina_prestamo_folio')::text, 4, '0') where folio is null;
alter table public.nomina_prestamos alter column folio set not null;

-- Abonos fuera de la nómina (la persona paga en efectivo o transferencia). No se editan:
-- un error se corrige con otro movimiento, igual que el resto de la nómina.
create sequence if not exists public.nomina_recibo_folio;
create table if not exists public.nomina_prestamo_pagos (
  id uuid primary key default gen_random_uuid(),
  prestamo_id uuid not null references public.nomina_prestamos(id),
  fecha date not null default hoy_planta(),
  importe numeric(12,2) not null check (importe > 0),
  folio text not null unique default 'RC-' || lpad(nextval('public.nomina_recibo_folio')::text, 5, '0'),
  nota text,
  registrado_por uuid default auth.uid() references public.perfiles(id),
  registrado_en timestamptz not null default now()
);
alter table public.nomina_prestamo_pagos enable row level security;
create policy ver on public.nomina_prestamo_pagos for select to authenticated using ((select puede('nomina', 1)));

-- Ahorro -----------------------------------------------------------------------
-- Cuánto decide ahorrar cada quien por semana, desde qué semana. 0 = deja de ahorrar.
create table if not exists public.nomina_ahorro_aportaciones (
  id uuid primary key default gen_random_uuid(),
  empleado_id uuid not null references public.empleados(id),
  monto_semanal numeric(12,2) not null check (monto_semanal >= 0),
  desde date not null check (extract(isodow from desde) = 5),
  motivo text,
  registrado_por uuid default auth.uid() references public.perfiles(id),
  registrado_en timestamptz not null default now(),
  unique (empleado_id, desde)
);
alter table public.nomina_ahorro_aportaciones enable row level security;
create policy ver on public.nomina_ahorro_aportaciones for select to authenticated using ((select puede('nomina', 1)));

-- El saldo de cada quien sale de aquí: lo que entra por nómina (al cerrar la semana), lo
-- que pone la empresa, el saldo con que arrancó (si ya ahorraba en Excel) y los retiros.
create table if not exists public.nomina_ahorro_movimientos (
  id uuid primary key default gen_random_uuid(),
  empleado_id uuid not null references public.empleados(id),
  tipo text not null check (tipo in ('aportacion', 'aportacion_empresa', 'saldo_inicial', 'retiro')),
  importe numeric(12,2) not null check (importe > 0),
  semana date references public.nomina_semanas(inicio),
  fecha date not null,
  solicitado_el date,
  folio text unique,
  nota text,
  registrado_por uuid default auth.uid() references public.perfiles(id),
  registrado_en timestamptz not null default now(),
  check ((tipo = 'retiro') = (folio is not null and solicitado_el is not null))
);
create index if not exists nomina_ahorro_movimientos_empleado on public.nomina_ahorro_movimientos (empleado_id, fecha);
alter table public.nomina_ahorro_movimientos enable row level security;
create policy ver on public.nomina_ahorro_movimientos for select to authenticated using ((select puede('nomina', 1)));

create or replace function public.nomina_inalterable() returns trigger language plpgsql as $$
begin
  raise exception 'Este registro de nómina no se cambia ni se borra: un error se corrige con otro movimiento' using errcode = '42501';
end $$;
drop trigger if exists inalterable on public.nomina_prestamo_pagos;
create trigger inalterable before update or delete on public.nomina_prestamo_pagos for each row execute function public.nomina_inalterable();
drop trigger if exists inalterable on public.nomina_ahorro_aportaciones;
create trigger inalterable before update or delete on public.nomina_ahorro_aportaciones for each row execute function public.nomina_inalterable();
drop trigger if exists inalterable on public.nomina_ahorro_movimientos;
create trigger inalterable before update or delete on public.nomina_ahorro_movimientos for each row execute function public.nomina_inalterable();

create or replace function public.ahorro_saldo(p_empleado uuid) returns numeric
language sql stable security definer set search_path = public as $$
  select coalesce(sum(case when tipo = 'retiro' then -importe else importe end), 0) from nomina_ahorro_movimientos where empleado_id = p_empleado
$$;
revoke execute on function public.ahorro_saldo(uuid) from public, anon, authenticated;

create or replace function public.prestamo_saldo(p_prestamo uuid) returns numeric
language sql stable security definer set search_path = public as $$
  select p.monto
    - coalesce((select sum(b.importe) from nomina_prestamo_abonos b join nomina_semanas w on w.inicio = b.semana
                where b.prestamo_id = p.id and w.estado = 'cerrada'), 0)
    - coalesce((select sum(g.importe) from nomina_prestamo_pagos g where g.prestamo_id = p.id), 0)
  from nomina_prestamos p where p.id = p_prestamo
$$;
revoke execute on function public.prestamo_saldo(uuid) from public, anon, authenticated;

-- Reglas (en configuracion.nomina, junto a las demás de la nómina) ------------------
create or replace function public.fijar_reglas_ahorro_prestamos(p_dias_anticipacion int, p_aportacion_empresa_pct numeric, p_interes_moratorio_pct numeric)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not puede('nomina', 3) then raise exception 'Las reglas de ahorro y préstamos las fija RRHH o dirección' using errcode = '42501'; end if;
  if coalesce(p_dias_anticipacion, 0) < 0 or coalesce(p_dias_anticipacion, 0) > 120 then raise exception 'Los días de anticipación van de 0 a 120'; end if;
  if coalesce(p_aportacion_empresa_pct, 0) not between 0 and 100 then raise exception 'La aportación de la empresa va de 0 a 100 %%'; end if;
  if coalesce(p_interes_moratorio_pct, 0) not between 0 and 10 then raise exception 'El interés moratorio va de 0 a 10 %% mensual'; end if;
  insert into configuracion (clave, valor) values ('nomina', '{}') on conflict (clave) do nothing;
  update configuracion set valor = valor || jsonb_build_object(
    'ahorro_dias_anticipacion', coalesce(p_dias_anticipacion, 0),
    'ahorro_aportacion_empresa_pct', coalesce(p_aportacion_empresa_pct, 0),
    'prestamo_interes_moratorio_pct', coalesce(p_interes_moratorio_pct, 0))
  where clave = 'nomina';
end $$;
revoke execute on function public.fijar_reglas_ahorro_prestamos(int, numeric, numeric) from public, anon;
grant execute on function public.fijar_reglas_ahorro_prestamos(int, numeric, numeric) to authenticated;

create or replace function public.reglas_ahorro_prestamos() returns jsonb
language sql stable security definer set search_path = public as $$
  select case when puede('nomina', 1) then jsonb_build_object(
    'dias_anticipacion', coalesce((v->>'ahorro_dias_anticipacion')::int, 10),
    'aportacion_empresa_pct', coalesce((v->>'ahorro_aportacion_empresa_pct')::numeric, 0),
    'interes_moratorio_pct', coalesce((v->>'prestamo_interes_moratorio_pct')::numeric, 0)) end
  from (select coalesce((select valor from configuracion where clave = 'nomina'), '{}'::jsonb) v) x
$$;
grant execute on function public.reglas_ahorro_prestamos() to authenticated;

-- Ahorro: capturar, saldo inicial y retiro ------------------------------------------
create or replace function public.fijar_ahorro_semanal(p_empleado uuid, p_monto numeric, p_desde date, p_motivo text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not puede('nomina', 3) then raise exception 'El ahorro lo captura RRHH' using errcode = '42501'; end if;
  if coalesce(p_monto, -1) < 0 then raise exception 'El ahorro semanal va de 0 en adelante (0 = deja de ahorrar)'; end if;
  if extract(isodow from p_desde) <> 5 then raise exception 'El ahorro empieza en una semana de nómina (viernes)'; end if;
  if exists (select 1 from nomina_semanas where inicio = p_desde and estado = 'cerrada') then
    raise exception 'La semana del % ya está cerrada: empieza en la siguiente', to_char(p_desde, 'DD/MM/YYYY');
  end if;
  insert into nomina_ahorro_aportaciones (empleado_id, monto_semanal, desde, motivo)
  values (p_empleado, round(p_monto, 2), p_desde, nullif(trim(p_motivo), ''));
exception when unique_violation then
  raise exception 'Ya hay un cambio de ahorro para esa semana: elige la siguiente';
end $$;
revoke execute on function public.fijar_ahorro_semanal(uuid, numeric, date, text) from public, anon;
grant execute on function public.fijar_ahorro_semanal(uuid, numeric, date, text) to authenticated;

create or replace function public.saldo_inicial_ahorro(p_empleado uuid, p_importe numeric, p_fecha date, p_nota text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not puede('nomina', 3) then raise exception 'El ahorro lo captura RRHH' using errcode = '42501'; end if;
  if coalesce(p_importe, 0) <= 0 then raise exception 'El saldo inicial va arriba de 0'; end if;
  if exists (select 1 from nomina_ahorro_movimientos where empleado_id = p_empleado and tipo = 'saldo_inicial') then
    raise exception 'Esa persona ya tiene su saldo inicial: un ajuste se hace con un retiro o en la nómina';
  end if;
  insert into nomina_ahorro_movimientos (empleado_id, tipo, importe, fecha, nota)
  values (p_empleado, 'saldo_inicial', round(p_importe, 2), coalesce(p_fecha, hoy_planta()), coalesce(nullif(trim(p_nota), ''), 'Saldo con que arrancó'));
end $$;
revoke execute on function public.saldo_inicial_ahorro(uuid, numeric, date, text) from public, anon;
grant execute on function public.saldo_inicial_ahorro(uuid, numeric, date, text) to authenticated;

create sequence if not exists public.nomina_ahorro_folio;
create or replace function public.retirar_ahorro(p_empleado uuid, p_importe numeric, p_solicitado_el date, p_entrega date, p_nota text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_saldo numeric; v_dias int := coalesce((select (valor->>'ahorro_dias_anticipacion')::int from configuracion where clave = 'nomina'), 10); v uuid;
begin
  if not puede('nomina', 3) then raise exception 'El retiro de ahorro lo registra RRHH' using errcode = '42501'; end if;
  if exists (select 1 from empleados where id = p_empleado and usuario_id = auth.uid()) then
    raise exception 'Tu propio retiro lo registra otra persona' using errcode = '42501';
  end if;
  perform 1 from empleados where id = p_empleado for update;
  v_saldo := ahorro_saldo(p_empleado);
  if coalesce(p_importe, 0) <= 0 then raise exception 'El retiro va arriba de 0'; end if;
  if p_importe > v_saldo then raise exception 'Solo tiene % de ahorro', to_char(v_saldo, 'FM$999,999,990.00'); end if;
  if p_solicitado_el is null or p_solicitado_el > hoy_planta() then raise exception 'La fecha en que lo pidió no puede ser futura'; end if;
  if p_entrega is null or p_entrega - p_solicitado_el < v_dias then
    raise exception 'Se entrega con % días de anticipación: lo pidió el %, se le puede entregar desde el %', v_dias,
      to_char(p_solicitado_el, 'DD/MM/YYYY'), to_char(p_solicitado_el + v_dias, 'DD/MM/YYYY');
  end if;
  insert into nomina_ahorro_movimientos (empleado_id, tipo, importe, fecha, solicitado_el, folio, nota)
  values (p_empleado, 'retiro', round(p_importe, 2), p_entrega, p_solicitado_el,
          'AH-' || lpad(nextval('nomina_ahorro_folio')::text, 5, '0'), nullif(trim(p_nota), ''))
  returning id into v;
  return v;
end $$;
revoke execute on function public.retirar_ahorro(uuid, numeric, date, date, text) from public, anon;
grant execute on function public.retirar_ahorro(uuid, numeric, date, date, text) to authenticated;

create or replace function public.ahorro_nomina()
returns table (empleado_id uuid, nombre text, numero text, activo boolean, ahorro_semanal numeric, desde date,
               aportado numeric, empresa numeric, saldo_inicial numeric, retirado numeric, saldo numeric, ultimo_retiro date)
language plpgsql stable security definer set search_path = public as $$
begin
  if not puede('nomina', 1) then raise exception 'Sin permiso de nómina' using errcode = '42501'; end if;
  return query
  select e.id, e.nombre, e.numero, e.activo, coalesce(a.monto_semanal, 0), a.desde,
    coalesce(sum(m.importe) filter (where m.tipo = 'aportacion'), 0),
    coalesce(sum(m.importe) filter (where m.tipo = 'aportacion_empresa'), 0),
    coalesce(sum(m.importe) filter (where m.tipo = 'saldo_inicial'), 0),
    coalesce(sum(m.importe) filter (where m.tipo = 'retiro'), 0),
    coalesce(sum(case when m.tipo = 'retiro' then -m.importe else m.importe end), 0),
    max(m.fecha) filter (where m.tipo = 'retiro')
  from empleados e
  left join lateral (select x.monto_semanal, x.desde from nomina_ahorro_aportaciones x where x.empleado_id = e.id
                     order by x.desde desc limit 1) a on true
  left join nomina_ahorro_movimientos m on m.empleado_id = e.id
  where e.activo or exists (select 1 from nomina_ahorro_movimientos y where y.empleado_id = e.id)
  group by e.id, e.nombre, e.numero, e.activo, a.monto_semanal, a.desde
  order by (coalesce(a.monto_semanal, 0) > 0 or coalesce(sum(m.importe), 0) > 0) desc, e.nombre;
end $$;
grant execute on function public.ahorro_nomina() to authenticated;

-- Préstamos: abono extra y pagaré ---------------------------------------------------
create or replace function public.abonar_prestamo(p_prestamo uuid, p_importe numeric, p_fecha date, p_nota text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare p nomina_prestamos; v_saldo numeric; v uuid;
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
  insert into nomina_prestamo_pagos (prestamo_id, fecha, importe, nota) values (p.id, p_fecha, round(p_importe, 2), nullif(trim(p_nota), ''))
  returning id into v;
  return v;
end $$;
revoke execute on function public.abonar_prestamo(uuid, numeric, date, text) from public, anon;
grant execute on function public.abonar_prestamo(uuid, numeric, date, text) to authenticated;

-- Descontar más (o nada) en la nómina de una semana abierta, sin pasarse del saldo.
create or replace function public.fijar_abono_semana(p_prestamo uuid, p_semana date, p_importe numeric)
returns void language plpgsql security definer set search_path = public as $$
declare v_saldo numeric;
begin
  if not puede('nomina', 3) then raise exception 'Los abonos a préstamos los registra RRHH' using errcode = '42501'; end if;
  if not exists (select 1 from nomina_prestamos where id = p_prestamo and estado = 'activo') then raise exception 'Ese préstamo no está activo'; end if;
  v_saldo := prestamo_saldo(p_prestamo);
  if coalesce(p_importe, -1) < 0 then raise exception 'El descuento va de 0 en adelante'; end if;
  if p_importe > v_saldo then raise exception 'El saldo es de %: no se descuenta más que eso', to_char(v_saldo, 'FM$999,999,990.00'); end if;
  insert into nomina_prestamo_abonos (prestamo_id, semana, importe, nota) values (p_prestamo, p_semana, round(p_importe, 2), 'Fijado por RRHH')
  on conflict (prestamo_id, semana) do update set importe = excluded.importe, nota = excluded.nota, registrado_por = auth.uid(), registrado_en = now();
end $$;
revoke execute on function public.fijar_abono_semana(uuid, date, numeric) from public, anon;
grant execute on function public.fijar_abono_semana(uuid, date, numeric) to authenticated;

create or replace function public.marcar_pagare_firmado(p_prestamo uuid, p_fecha date)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not puede('nomina', 3) then raise exception 'El pagaré lo lleva RRHH' using errcode = '42501'; end if;
  if p_fecha is not null and p_fecha > hoy_planta() then raise exception 'La fecha de firma no puede ser futura'; end if;
  update nomina_prestamos set pagare_firmado_el = p_fecha where id = p_prestamo;
  if not found then raise exception 'No existe ese préstamo'; end if;
end $$;
revoke execute on function public.marcar_pagare_firmado(uuid, date) from public, anon;
grant execute on function public.marcar_pagare_firmado(uuid, date) to authenticated;

-- Lo que lleva cada papel para imprimir: pagaré, recibo de abono o de retiro de ahorro.
create or replace function public.documento_nomina(p_tipo text, p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare r jsonb; v_emp uuid;
begin
  if not puede('nomina', 1) then raise exception 'Sin permiso de nómina' using errcode = '42501'; end if;
  if p_tipo = 'pagare' then
    select jsonb_build_object('folio', p.folio, 'monto', p.monto, 'descuento_semanal', p.descuento_semanal, 'primera_semana', p.primera_semana,
      'primer_pago', p.primera_semana + 7, 'semanas', ceil(p.monto / p.descuento_semanal), 'fecha', (p.autorizado_en at time zone 'America/Mexico_City')::date,
      'motivo', p.motivo, 'firmado_el', p.pagare_firmado_el,
      'interes_moratorio_pct', coalesce((select (valor->>'prestamo_interes_moratorio_pct')::numeric from configuracion where clave = 'nomina'), 0)),
      p.empleado_id into r, v_emp from nomina_prestamos p where p.id = p_id;
  elsif p_tipo = 'abono' then
    select jsonb_build_object('folio', g.folio, 'fecha', g.fecha, 'importe', g.importe, 'nota', g.nota, 'prestamo', p.folio, 'monto', p.monto,
      'saldo_despues', p.monto
        - coalesce((select sum(b.importe) from nomina_prestamo_abonos b join nomina_semanas w on w.inicio = b.semana
                    where b.prestamo_id = p.id and w.estado = 'cerrada' and b.registrado_en <= g.registrado_en), 0)
        - (select sum(x.importe) from nomina_prestamo_pagos x where x.prestamo_id = p.id and x.registrado_en <= g.registrado_en),
      'recibio', (select nombre from perfiles where id = g.registrado_por)),
      p.empleado_id into r, v_emp from nomina_prestamo_pagos g join nomina_prestamos p on p.id = g.prestamo_id where g.id = p_id;
  elsif p_tipo = 'retiro' then
    select jsonb_build_object('folio', m.folio, 'fecha', m.fecha, 'solicitado_el', m.solicitado_el, 'importe', m.importe, 'nota', m.nota,
      'saldo_despues', (select coalesce(sum(case when x.tipo = 'retiro' then -x.importe else x.importe end), 0) from nomina_ahorro_movimientos x
                        where x.empleado_id = m.empleado_id and x.registrado_en <= m.registrado_en),
      'entrego', (select nombre from perfiles where id = m.registrado_por)),
      m.empleado_id into r, v_emp from nomina_ahorro_movimientos m where m.id = p_id and m.tipo = 'retiro';
  else
    raise exception 'Documento desconocido';
  end if;
  if r is null then return null; end if;
  -- El domicilio es dato sensible: solo va en el papel si quien imprime lo puede ver.
  return r || jsonb_build_object('empleado', (select jsonb_build_object('nombre', e.nombre, 'numero', e.numero, 'puesto', e.puesto,
      'domicilio', case when puede('rrhh', 3) then d.domicilio end)
    from empleados e left join empleado_datos d on d.empleado_id = e.id where e.id = v_emp));
end $$;
grant execute on function public.documento_nomina(text, uuid) to authenticated;

-- Los préstamos con folio, pagaré y lo abonado fuera de la nómina.
drop function if exists public.prestamos_nomina();
create or replace function public.prestamos_nomina()
returns table (id uuid, folio text, empleado_id uuid, nombre text, activo_empleado boolean, monto numeric, descuento_semanal numeric, primera_semana date, motivo text,
               autorizado_por text, autorizado_en timestamptz, estado text, cancelado_motivo text, abonado numeric, pagado_aparte numeric,
               saldo numeric, semanas_restantes int, pagare_firmado_el date, pagos jsonb)
language plpgsql stable security definer set search_path = public as $$
begin
  if not puede('nomina', 1) then raise exception 'Sin permiso de nómina' using errcode = '42501'; end if;
  return query
  select p.id, p.folio, p.empleado_id, e.nombre, e.activo, p.monto, p.descuento_semanal, p.primera_semana, p.motivo, a.nombre, p.autorizado_en,
    p.estado, p.cancelado_motivo, x.abonado + y.aparte, y.aparte, p.monto - x.abonado - y.aparte,
    case when p.estado = 'activo' and p.monto > x.abonado + y.aparte then ceil((p.monto - x.abonado - y.aparte) / p.descuento_semanal)::int else 0 end,
    p.pagare_firmado_el, y.pagos
  from nomina_prestamos p
  join empleados e on e.id = p.empleado_id
  left join perfiles a on a.id = p.autorizado_por
  cross join lateral (select coalesce(sum(b.importe), 0) abonado from nomina_prestamo_abonos b join nomina_semanas w on w.inicio = b.semana
                      where b.prestamo_id = p.id and w.estado = 'cerrada') x
  cross join lateral (select coalesce(sum(g.importe), 0) aparte,
                        coalesce(jsonb_agg(jsonb_build_object('id', g.id, 'folio', g.folio, 'fecha', g.fecha, 'importe', g.importe) order by g.fecha), '[]'::jsonb) pagos
                      from nomina_prestamo_pagos g where g.prestamo_id = p.id) y
  order by (p.estado = 'activo' and p.monto > x.abonado + y.aparte) desc, p.autorizado_en desc;
end $$;
grant execute on function public.prestamos_nomina() to authenticated;

-- Los movimientos de ahorro de una persona (para su historial y reimprimir recibos).
create or replace function public.movimientos_ahorro(p_empleado uuid)
returns table (id uuid, tipo text, importe numeric, fecha date, semana date, solicitado_el date, folio text, nota text, registrado_por text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not puede('nomina', 1) then raise exception 'Sin permiso de nómina' using errcode = '42501'; end if;
  return query select m.id, m.tipo, m.importe, m.fecha, m.semana, m.solicitado_el, m.folio, m.nota, pf.nombre
  from nomina_ahorro_movimientos m left join perfiles pf on pf.id = m.registrado_por
  where m.empleado_id = p_empleado order by m.fecha desc, m.registrado_en desc;
end $$;
grant execute on function public.movimientos_ahorro(uuid) to authenticated;
create or replace function public.prenomina(p_semana date) returns setof public.nomina_renglones
language plpgsql stable security definer set search_path = public as $$
declare
  v_ini date := p_semana; v_fin date := p_semana + 6;
  v_cfg jsonb := coalesce((select valor from configuracion where clave = 'nomina'), '{}'::jsonb);
  v_habiles int; v_tope numeric; v_prima numeric; v_proporcional boolean; v_retardo boolean;
begin
  if not puede('nomina', 1) then
    raise exception 'La prenómina solo la ve quien tiene el módulo de nómina' using errcode = '42501';
  end if;
  if extract(isodow from p_semana) <> 5 then
    raise exception 'La semana de nómina empieza en viernes y el % no lo es', to_char(p_semana, 'DD/MM/YYYY');
  end if;
  if exists (select 1 from nomina_semanas where inicio = p_semana and estado = 'cerrada') then
    return query select * from nomina_renglones where semana = p_semana order by nombre;
    return;
  end if;
  v_habiles := greatest(dias_habiles(v_ini, v_fin), 1);
  v_tope := coalesce((v_cfg->>'horas_dobles_semana')::numeric, 9);
  v_prima := coalesce((v_cfg->>'prima_vacacional')::numeric, 0.25);
  v_proporcional := coalesce(v_cfg->>'septimo_dia', 'simple') = 'proporcional';
  v_retardo := coalesce(v_cfg->>'retardos', 'descontar_tiempo') = 'descontar_tiempo';

  return query
  with emp as (
    select e.id, e.numero, e.nombre, e.puesto, e.fecha_ingreso, e.baja_en
    from empleados e
    where e.fecha_ingreso <= v_fin and (e.activo or e.baja_en >= v_ini)
  ), sueldo as (
    select emp.id,
      coalesce(s.sueldo_semanal, round(d.salario_diario * 7, 2)) sueldo,
      case when s.sueldo_semanal is not null then 'historial' when d.salario_diario is not null then 'ficha' end origen
    from emp
    left join lateral (select x.sueldo_semanal from nomina_sueldos x where x.empleado_id = emp.id and x.desde <= v_fin
                       order by x.desde desc limit 1) s on true
    left join empleado_datos d on d.empleado_id = emp.id
  ), inc as (
    select i.empleado_id, i.tipo, coalesce(i.horas, 0) horas,
      case when i.tipo = 'incapacidad' then (least(i.fin, v_fin) - greatest(i.inicio, v_ini) + 1)::numeric
           when i.tipo in ('retardo', 'horas_extra') then 0::numeric
           when i.inicio >= v_ini and i.fin <= v_fin then i.dias
           else dias_habiles(greatest(i.inicio, v_ini), least(i.fin, v_fin))::numeric end dias
    from incidencias i
    where i.estado = 'aprobada' and i.inicio <= v_fin and i.fin >= v_ini
  ), aus as (
    select inc.empleado_id,
      coalesce(sum(dias) filter (where tipo = 'falta'), 0) faltas,
      coalesce(sum(dias) filter (where tipo = 'permiso_sin_goce'), 0) psg,
      coalesce(sum(dias) filter (where tipo = 'permiso_con_goce'), 0) pcg,
      coalesce(sum(dias) filter (where tipo = 'incapacidad'), 0) incap,
      coalesce(sum(dias) filter (where tipo = 'vacaciones'), 0) vac,
      coalesce(sum(horas) filter (where tipo = 'retardo'), 0) retardo,
      coalesce(sum(horas) filter (where tipo = 'horas_extra'), 0) extra
    from inc group by inc.empleado_id
  ), mov as (
    select m.empleado_id,
      coalesce(sum(m.importe) filter (where c.tipo = 'percepcion'), 0) perc,
      coalesce(sum(m.importe) filter (where c.tipo = 'deduccion'), 0) dedu,
      jsonb_agg(jsonb_build_object('clave', c.clave, 'concepto', c.nombre, 'tipo', c.tipo, 'importe', m.importe,
                                   'nota', m.nota, 'referencia', m.referencia, 'id', m.id) order by c.tipo desc, c.nombre) detalle
    from nomina_movimientos m join nomina_conceptos c on c.clave = m.concepto
    where m.semana = v_ini group by m.empleado_id
  ), pres as (
    select p.empleado_id, sum(x.importe) importe, bool_or(x.fin) finiquito,
      jsonb_agg(jsonb_build_object('clave', 'prestamo', 'concepto', 'Préstamo', 'tipo', 'deduccion', 'importe', x.importe,
                                   'nota', p.motivo || case when x.fin then ' · saldo completo al finiquito'
                                                       else ' · queda ' || to_char(x.saldo - x.importe, 'FM$999,999,990.00') end,
                                   'referencia', p.id)) detalle
    from nomina_prestamos p
    join emp on emp.id = p.empleado_id
    cross join lateral (
      -- Si se da de baja esta semana, el saldo completo se descuenta en su finiquito.
      select case when f.fin then s.saldo else coalesce(a.importe, least(p.descuento_semanal, s.saldo)) end importe, s.saldo, f.fin
      from (select p.monto - coalesce((select sum(b.importe) from nomina_prestamo_abonos b join nomina_semanas w on w.inicio = b.semana
                                        where b.prestamo_id = p.id and w.estado = 'cerrada'), 0)
                           - coalesce((select sum(g.importe) from nomina_prestamo_pagos g where g.prestamo_id = p.id), 0) saldo) s
      cross join (select coalesce(emp.baja_en between v_ini and v_fin, false) fin) f
      left join nomina_prestamo_abonos a on a.prestamo_id = p.id and a.semana = v_ini
    ) x
    where p.estado = 'activo' and (p.primera_semana <= v_ini or x.fin) and x.saldo > 0
    group by p.empleado_id
  ), aho as (
    -- La aportación a la caja de ahorro que cada quien eligió. Si esta semana se capturó
    -- a mano el concepto «Caja de ahorro», esa manda y la automática no se suma.
    select emp.id empleado_id, x.monto_semanal importe,
      jsonb_build_array(jsonb_build_object('clave', 'ahorro', 'concepto', 'Caja de ahorro', 'tipo', 'deduccion', 'importe', x.monto_semanal,
                                           'nota', 'Aportación semanal', 'referencia', null)) detalle
    from emp
    join lateral (select a.monto_semanal from nomina_ahorro_aportaciones a where a.empleado_id = emp.id and a.desde <= v_ini
                  order by a.desde desc limit 1) x on x.monto_semanal > 0
    where not exists (select 1 from nomina_movimientos m where m.semana = v_ini and m.empleado_id = emp.id and m.concepto = 'ahorro')
  ), bono as (
    -- Bonos de meses aprobados que no se han pagado. Sin base, se enseña el %
    -- y el aviso, y el mes sigue pendiente hasta que se defina la base.
    select ev.empleado_id,
      (array_agg(b.pct order by ev.mes desc))[1] pct,
      sum(round(b.base * b.pct / 100, 2)) filter (where b.base is not null) monto,
      bool_or(b.base is null) falta_base,
      jsonb_agg(jsonb_build_object('evaluacion', ev.id, 'mes', ev.mes, 'pct', b.pct, 'base', b.base,
                                   'monto', case when b.base is not null then round(b.base * b.pct / 100, 2) end) order by ev.mes) detalle
    from objetivo_evaluaciones ev
    cross join lateral (
      select coalesce((select a.total_corregido from objetivo_ajustes a where a.evaluacion_id = ev.id and a.estado = 'autorizado'
                       order by a.resuelto_en desc limit 1), ev.total) pct,
             bono_base(ev.empleado_id, ev.puesto_id, ev.mes) base
    ) b
    where ev.estado = 'aprobada' and (ev.aprobada_en at time zone 'America/Mexico_City')::date <= v_fin
      and not exists (select 1 from nomina_bonos nb where nb.evaluacion_id = ev.id)
    group by ev.empleado_id
  ), c1 as (
    select emp.*, s.sueldo, s.origen,
      least(7, greatest(0, emp.fecha_ingreso - v_ini)
               + case when emp.baja_en is not null and emp.baja_en < v_fin then v_fin - greatest(emp.baja_en, v_ini - 1) else 0 end)::numeric fuera,
      coalesce(a.faltas, 0) faltas, coalesce(a.psg, 0) psg, coalesce(a.pcg, 0) pcg, coalesce(a.incap, 0) incap,
      coalesce(a.vac, 0) vac, coalesce(a.retardo, 0) retardo, coalesce(a.extra, 0) extra,
      coalesce(m.perc, 0) perc, coalesce(m.dedu, 0) + coalesce(ah.importe, 0) dedu, coalesce(pr.importe, 0) prest,
      coalesce(m.detalle, '[]'::jsonb) || coalesce(ah.detalle, '[]'::jsonb) || coalesce(pr.detalle, '[]'::jsonb) conceptos,
      coalesce(pr.finiquito, false) finiquito,
      case when emp.baja_en between v_ini and v_fin then ahorro_saldo(emp.id) else 0 end ahorro_baja,
      b.pct bono_pct, b.monto bono_monto, coalesce(b.falta_base, false) falta_base, b.detalle bono_detalle
    from emp
    join sueldo s on s.id = emp.id
    left join aus a on a.empleado_id = emp.id
    left join mov m on m.empleado_id = emp.id
    left join pres pr on pr.empleado_id = emp.id
    left join aho ah on ah.empleado_id = emp.id
    left join bono b on b.empleado_id = emp.id
  ), c2 as (
    select c1.*,
      round((c1.faltas + c1.psg) * case when v_proporcional then 7.0 / v_habiles else 1 end
            + case when v_retardo then c1.retardo / 8 else 0 end, 3) descuento,
      least(c1.extra, v_tope) dobles,
      greatest(c1.extra - v_tope, 0) triples
    from c1
  ), c3 as (
    select c2.*,
      greatest(0, round(7 - c2.fuera - c2.incap - c2.descuento, 3)) pagados
    from c2
  ), c4 as (
    select c3.*,
      coalesce(round(c3.sueldo / 7 * c3.pagados, 2), 0) imp_dias,
      coalesce(round(c3.sueldo / 56 * 2 * c3.dobles, 2), 0) imp_dobles,
      coalesce(round(c3.sueldo / 56 * 3 * c3.triples, 2), 0) imp_triples,
      coalesce(round(c3.sueldo / 7 * c3.vac * v_prima, 2), 0) prima
    from c3
  )
  -- return query exige el tipo exacto de cada columna, con su precisión.
  select v_ini, c4.id, c4.numero, c4.nombre, c4.puesto,
    c4.sueldo::numeric(12,2), c4.origen, round(c4.sueldo / 7, 4)::numeric(12,4),
    c4.fuera::numeric(6,3), c4.faltas::numeric(6,3), c4.psg::numeric(6,3), c4.pcg::numeric(6,3), c4.incap::numeric(6,3),
    c4.vac::numeric(6,3), c4.retardo::numeric(6,2), c4.descuento::numeric(6,3), c4.pagados::numeric(6,3),
    c4.imp_dias::numeric(12,2), c4.extra::numeric(6,2), c4.dobles::numeric(6,2), c4.triples::numeric(6,2),
    c4.imp_dobles::numeric(12,2), c4.imp_triples::numeric(12,2), c4.prima::numeric(12,2),
    c4.perc::numeric(12,2), c4.dedu::numeric(12,2), c4.prest::numeric(12,2),
    c4.bono_pct::numeric(5,2), c4.bono_monto::numeric(12,2), case when c4.falta_base then 'Falta definir la base del bono' end, c4.bono_detalle,
    (c4.imp_dias + c4.imp_dobles + c4.imp_triples + c4.prima + c4.perc + coalesce(c4.bono_monto, 0))::numeric(12,2),
    (c4.dedu + c4.prest)::numeric(12,2),
    (c4.imp_dias + c4.imp_dobles + c4.imp_triples + c4.prima + c4.perc + coalesce(c4.bono_monto, 0) - c4.dedu - c4.prest)::numeric(12,2),
    c4.conceptos,
    array_remove(array[
      case when c4.sueldo is null then 'Sin sueldo registrado' end,
      case when c4.origen = 'ficha' then 'Sueldo tomado de la ficha (salario diario × 7)' end,
      case when c4.triples > 0 then format('%s h extra: %s dobles y %s triples (LFT art. 68)', trim_scale(c4.extra), trim_scale(c4.dobles), trim_scale(c4.triples)) end,
      case when c4.falta_base then 'Falta definir la base del bono' end,
      case when c4.finiquito then 'Baja: el saldo de su préstamo se descuenta completo esta semana (finiquito)' end,
      case when c4.ahorro_baja > 0 then format('Baja: tiene %s en la caja de ahorro; entrégaselo con su finiquito y registra el retiro', to_char(c4.ahorro_baja, 'FM$999,999,990.00')) end
    ], null)
  from c4
  order by c4.nombre;
end $$;

create or replace function public.cerrar_semana_nomina(p_semana date) returns int
language plpgsql security definer set search_path = public as $$
declare v_n int; v_pct numeric := coalesce((select (valor->>'ahorro_aportacion_empresa_pct')::numeric from configuracion where clave = 'nomina'), 0);
begin
  if not puede('nomina', 3) then raise exception 'Solo RRHH o dirección cierran la semana de nómina' using errcode = '42501'; end if;
  if extract(isodow from p_semana) <> 5 then raise exception 'La semana de nómina empieza en viernes'; end if;
  if p_semana + 6 > hoy_planta() then
    raise exception 'La semana termina el jueves %: se cierra a partir de ese día', to_char(p_semana + 6, 'DD/MM/YYYY');
  end if;
  insert into nomina_semanas (inicio) values (p_semana) on conflict do nothing;
  perform 1 from nomina_semanas where inicio = p_semana and estado = 'abierta' for update;
  if not found then raise exception 'La semana del % ya está cerrada', to_char(p_semana, 'DD/MM/YYYY'); end if;

  insert into nomina_renglones select * from prenomina(p_semana);
  get diagnostics v_n = row_count;

  insert into nomina_prestamo_abonos (prestamo_id, semana, importe, nota)
  select (c->>'referencia')::uuid, p_semana, (c->>'importe')::numeric, 'Descuento semanal'
  from nomina_renglones r, jsonb_array_elements(r.conceptos) c
  where r.semana = p_semana and c->>'clave' = 'prestamo'
  on conflict (prestamo_id, semana) do nothing;

  -- Lo descontado para la caja de ahorro pasa al saldo de cada quien (y lo que ponga la empresa, si se configuró).
  insert into nomina_ahorro_movimientos (empleado_id, tipo, importe, semana, fecha, nota)
  select r.empleado_id, 'aportacion', sum((c->>'importe')::numeric), p_semana, p_semana + 7, 'Descuento de la nómina'
  from nomina_renglones r, jsonb_array_elements(r.conceptos) c
  where r.semana = p_semana and c->>'clave' = 'ahorro'
  group by r.empleado_id having sum((c->>'importe')::numeric) > 0;
  if v_pct > 0 then
    insert into nomina_ahorro_movimientos (empleado_id, tipo, importe, semana, fecha, nota)
    select empleado_id, 'aportacion_empresa', round(importe * v_pct / 100, 2), p_semana, p_semana + 7, format('La empresa pone el %s %%', trim_scale(v_pct))
    from nomina_ahorro_movimientos where semana = p_semana and tipo = 'aportacion' and round(importe * v_pct / 100, 2) > 0;
  end if;

  insert into nomina_bonos (evaluacion_id, semana, pct, base, monto)
  select (b->>'evaluacion')::uuid, p_semana, (b->>'pct')::numeric, (b->>'base')::numeric, (b->>'monto')::numeric
  from nomina_renglones r, jsonb_array_elements(coalesce(r.bono_detalle, '[]'::jsonb)) b
  where r.semana = p_semana and b->>'monto' is not null;

  update nomina_semanas set estado = 'cerrada', cerrada_por = auth.uid(), cerrada_en = now() where inicio = p_semana;
  return v_n;
end $$;

create or replace function public.nomina_prestamo_guardia() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Un préstamo no se borra: cancélalo con el motivo' using errcode = '42501';
  end if;
  if tg_op = 'INSERT' then
    new.autorizado_por := coalesce(auth.uid(), new.autorizado_por);
    new.autorizado_en := now();
  elsif (new.empleado_id, new.monto, new.primera_semana, new.autorizado_por, new.folio) is distinct from
        (old.empleado_id, old.monto, old.primera_semana, old.autorizado_por, old.folio) then
    raise exception 'De un préstamo solo cambia el descuento semanal o se cancela; si el monto era otro, cancélalo y regístralo de nuevo';
  end if;
  if exists (select 1 from empleados where id = new.empleado_id and usuario_id = new.autorizado_por) then
    raise exception 'Nadie se autoriza un préstamo a sí mismo' using errcode = '42501';
  end if;
  if new.estado = 'cancelado' and coalesce(trim(new.cancelado_motivo), '') = '' then
    raise exception 'Para cancelar un préstamo se necesita el motivo';
  end if;
  return new;
end $$;

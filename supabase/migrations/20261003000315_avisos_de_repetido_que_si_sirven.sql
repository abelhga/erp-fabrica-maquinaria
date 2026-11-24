-- =============================================================================
-- Avisos de «repetido» que sí sirven, y la revisión que ayuda a corregir en finanzas.
--
-- Por qué: Susana se quejaba de que al registrar compras el ERP le decía «hay una compra igual»
-- y casi nunca lo era. Se midió con sus 431 compras de 60 días: el aviso salió en 19 y ninguna
-- era repetida (casetas de $77 y $154, tickets de Oxxo de $48.50, pólizas mensuales del mismo
-- importe, dos fletes del mismo precio): todas con su propio folio. Mientras tanto, lo que sí
-- se le repetía eran PAGOS (cinco en mes y medio, que encontró la revisión de la noche), y esos
-- no tenían aviso al capturar. Y el error más común no era de duplicado sino de dónde va el folio:
-- pagos con «FAC. 0174179» en la descripción y el campo de factura vacío (así no se ligan a su
-- compra), o el folio escrito sin la serie que trae el XML («0174983» contra
-- «08-01UD0501 0174983»).
--
-- Qué cambia:
--   · compras_parecidas avisa solo cuando de verdad puede ser la misma: si una de las dos no
--     trae folio (mismo monto, una semana), o si es el mismo número de factura escrito distinto
--     (con o sin serie). Dos folios distintos ya no avisan. Devuelve el porqué.
--   · pagos_parecidos: al registrar un pago, si ya hay uno al mismo proveedor por el mismo monto
--     en cinco días y por la misma factura (o sin factura), la pantalla lo enseña antes de guardar.
--   · folio_de_pago(): el folio que paga un pago. Si el campo viene vacío pero la descripción
--     dice «FAC. 0174179», o si el folio está escrito sin la serie, se toma el de la compra
--     de ese proveedor con ese número (solo si hay exactamente una). Se aplica al registrar.
--   · La regla nocturna de pagos repetidos ya no señala dos pagos con facturas distintas.
--   · «Ayúdame a corregirlo» llega a finanzas: descripción y folio de compras y pagos, concepto y
--     notas de caja chica. Solo esos campos (nunca monto, fecha ni cuenta), con la RLS de
--     finanzas o caja chica, y un folio corregido pasa por la misma revisión de factura repetida.
--   · La revisión de la noche recuerda medio año de «está bien así» (antes 30 días y 120 en
--     total, que las de ventas llenaban), para no volver a preguntar lo que ya se explicó.
-- =============================================================================

-- El número de una factura sin serie ni ceros a la izquierda: «08-01UD0501 0174983» y «F0174983» → «174983».
-- Es el último grupo de dígitos tal como viene escrito (pegando los separadores, la serie «0501» se
-- juntaría con el folio).
create or replace function public.folio_numero(p text) returns text
language sql immutable parallel safe as $$
  select nullif(ltrim((regexp_match(coalesce(p, ''), '([0-9]{4,})[^0-9]*$'))[1], '0'), '')
$$;
grant execute on function public.folio_numero(text) to authenticated;

-- ¿Este texto es «sin folio»?
create or replace function public.sin_folio(p text) returns boolean
language sql immutable parallel safe as $$
  select llave_factura(p) is null or llave_factura(p) in ('SF', 'SN', 'NA', 'SINFACTURA', 'SINFOLIO')
$$;
grant execute on function public.sin_folio(text) to authenticated;

drop function if exists public.compras_parecidas(uuid, numeric, date, text);
create or replace function public.compras_parecidas(p_proveedor uuid, p_monto numeric, p_fecha date, p_factura text default null)
returns table (origen text, fecha date, monto numeric, factura text, descripcion text, por text)
language sql stable security invoker set search_path = public as $$
  with llave as (
    select coalesce((select proveedor_llave from historial_compras_hoja where proveedor_id = p_proveedor order by fecha desc limit 1),
                    (select proveedor_llave from movimientos_proveedor where proveedor_id = p_proveedor limit 1)) as l
  ), todas as (
    select 'erp' origen, m.fecha, m.monto, m.factura, m.descripcion from movimientos_proveedor m, llave
    where m.tipo = 'compra' and (m.proveedor_id = p_proveedor or m.proveedor_llave = llave.l)
    union all
    select 'hoja', h.fecha, h.monto, h.factura, h.descripcion from historial_compras_hoja h, llave
    where h.tipo = 'Compra' and h.proveedor_llave = llave.l and h.id not in (select i.id from v_compras_hoja_ignoradas i)
  )
  select t.origen, t.fecha, t.monto, t.factura, t.descripcion,
    case when folio_numero(t.factura) = folio_numero(p_factura) then 'mismo_numero' else 'sin_folio' end
  from todas t
  where llave_factura(t.factura) is distinct from llave_factura(p_factura)   -- el mismo folio exacto ya lo rechaza la base
    and (
      -- Sin folio en alguna de las dos: lo único que las distingue es el monto y la fecha.
      ((sin_folio(t.factura) or sin_folio(p_factura)) and abs(t.monto - p_monto) < 0.01 and abs(t.fecha - p_fecha) <= 7)
      -- El mismo número de factura escrito de otra forma (con o sin serie).
      or (folio_numero(t.factura) = folio_numero(p_factura) and abs(t.fecha - p_fecha) <= 400)
    )
  order by 2 desc
  limit 5
$$;
revoke execute on function public.compras_parecidas(uuid, numeric, date, text) from public, anon;
grant execute on function public.compras_parecidas(uuid, numeric, date, text) to authenticated;

-- Pagos que podrían ser el mismo: mismo proveedor y monto, a cinco días, y por la misma factura o sin factura.
create or replace function public.pagos_parecidos(p_proveedor uuid, p_monto numeric, p_fecha date, p_factura text default null)
returns table (fecha date, monto numeric, factura text, descripcion text, cuenta text, capturado text)
language sql stable security invoker set search_path = public as $$
  select m.fecha, m.monto, m.factura, m.descripcion, m.cuenta,
    to_char(m.creado_en at time zone 'America/Mexico_City', 'DD/MM/YYYY') || coalesce(' por ' || p.nombre, '')
  from movimientos_proveedor m left join perfiles p on p.id = m.registrado_por
  where m.tipo = 'pago' and m.proveedor_id = p_proveedor and abs(m.monto - p_monto) < 0.01 and abs(m.fecha - p_fecha) <= 5
    and (sin_folio(m.factura) or sin_folio(p_factura) or llave_factura(m.factura) = llave_factura(p_factura)
         or folio_numero(m.factura) = folio_numero(p_factura))
  order by m.fecha desc
  limit 5
$$;
revoke execute on function public.pagos_parecidos(uuid, numeric, date, text) from public, anon;
grant execute on function public.pagos_parecidos(uuid, numeric, date, text) to authenticated;

-- El folio que paga un pago: el que trae, el que dice su descripción («FAC. 0174179»), y escrito
-- como lo tiene la compra de ese proveedor (con su serie), si hay exactamente una con ese número.
create or replace function public.folio_de_pago(p_proveedor uuid, p_llave text, p_factura text, p_descripcion text) returns text
language plpgsql stable security definer set search_path = public as $$
declare v_txt text := nullif(btrim(p_factura), ''); v_num text; v_folios text[];
begin
  if v_txt is null then
    v_txt := btrim((regexp_match(upper(coalesce(p_descripcion, '')), '(?:FACTURA|FACT|FAC)[\s\.:#-]*([A-Z0-9][A-Z0-9-]*[0-9]{3,})'))[1]);
  end if;
  if v_txt is null or sin_folio(v_txt) then return nullif(btrim(p_factura), ''); end if;
  select array_agg(distinct f) into v_folios from (
    select m.factura f from movimientos_proveedor m
    where m.tipo = 'compra' and (m.proveedor_id = p_proveedor or m.proveedor_llave = p_llave) and llave_factura(m.factura) = llave_factura(v_txt)
    union all
    select h.factura from historial_compras_hoja h where h.tipo = 'Compra' and h.proveedor_llave = p_llave and llave_factura(h.factura) = llave_factura(v_txt)
  ) x;
  if cardinality(v_folios) >= 1 then return coalesce(nullif(btrim(p_factura), ''), v_txt); end if;
  v_num := folio_numero(v_txt);
  if v_num is null then return nullif(btrim(p_factura), ''); end if;
  select array_agg(distinct f) into v_folios from (
    select m.factura f from movimientos_proveedor m
    where m.tipo = 'compra' and (m.proveedor_id = p_proveedor or m.proveedor_llave = p_llave) and folio_numero(m.factura) = v_num
    union all
    select h.factura from historial_compras_hoja h where h.tipo = 'Compra' and h.proveedor_llave = p_llave and folio_numero(h.factura) = v_num
  ) x;
  -- Dos compras con ese número (series distintas): no se adivina.
  if cardinality(v_folios) = 1 then return v_folios[1]; end if;
  return nullif(btrim(p_factura), '');
end $$;
revoke execute on function public.folio_de_pago(uuid, text, text, text) from public, anon, authenticated;

create or replace function public.trg_pago_folio() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.tipo = 'pago' and not coalesce(new.anticipo, false) then
    new.factura := folio_de_pago(new.proveedor_id, new.proveedor_llave, new.factura, new.descripcion);
  end if;
  return new;
end $$;
drop trigger if exists a_pago_folio on public.movimientos_proveedor;
-- Antes de «factura_repetida» y «ya_en_hoja» (van por orden alfabético): así revisan el folio ya acomodado.
create trigger a_pago_folio before insert on public.movimientos_proveedor for each row execute function public.trg_pago_folio();

-- Regla nocturna: dos pagos del mismo monto por facturas distintas no son repetidos.
do $$
declare v_def text := pg_get_functiondef('public.revision_r_pago_duplicado()'::regprocedure);
  v_ancla text := 'and (a.creado_en, a.id) < (b.creado_en, b.id) and abs(b.fecha - a.fecha) <= 5';
begin
  if v_def like '%sin_folio(a.factura)%' then return; end if;
  if position(v_ancla in v_def) = 0 then raise exception 'revision_r_pago_duplicado ya no es la que se conocía'; end if;
  v_def := replace(v_def, v_ancla, v_ancla || E'\n    and (sin_folio(a.factura) or sin_folio(b.factura) or llave_factura(a.factura) = llave_factura(b.factura))');
  execute v_def;
end $$;

-- Un folio corregido después pasa por la misma revisión de factura repetida (sin compararse consigo mismo).
do $$
declare v_def text := pg_get_functiondef('public.trg_factura_repetida()'::regprocedure);
  v_ancla text := 'where m.tipo = ''compra'' and llave_factura(m.factura) = v_llave';
begin
  if v_def like '%m.id is distinct from new.id%' then return; end if;
  if position(v_ancla in v_def) = 0 then raise exception 'trg_factura_repetida ya no es la que se conocía'; end if;
  v_def := replace(v_def, v_ancla, v_ancla || ' and m.id is distinct from new.id');
  execute v_def;
end $$;
drop trigger if exists factura_repetida on public.movimientos_proveedor;
create trigger factura_repetida before insert or update of factura on public.movimientos_proveedor
  for each row execute function public.trg_factura_repetida();

-- «Ayúdame a corregirlo» en finanzas: solo estos campos, y solo quien ya captura ahí.
revoke update on public.movimientos_proveedor from authenticated;
grant update (descripcion, factura) on public.movimientos_proveedor to authenticated;
drop policy if exists corregir on public.movimientos_proveedor;
create policy corregir on public.movimientos_proveedor for update to authenticated
  using ((select puede('finanzas', 2))) with check ((select puede('finanzas', 2)));

revoke update on public.caja_chica from authenticated;
grant update (concepto, notas) on public.caja_chica to authenticated;
drop policy if exists corregir on public.caja_chica;
create policy corregir on public.caja_chica for update to authenticated
  using ((select puede('caja_chica', 2))) with check ((select puede('caja_chica', 2)));

insert into public.revision_campos_corregibles (tabla, campo, etiqueta, padre_tabla, padre_columna, solo_vacio) values
  ('movimientos_proveedor', 'descripcion', 'Descripción', null, null, false),
  ('movimientos_proveedor', 'factura', 'Folio de la factura', null, null, false),
  ('caja_chica', 'concepto', 'Concepto', null, null, false),
  ('caja_chica', 'notas', 'Notas', null, null, false)
on conflict (tabla, campo) do update set etiqueta = excluded.etiqueta;

-- La revisión de la noche: medio año de «está bien así» para no volver a preguntar lo explicado.
do $$
declare v_def text := pg_get_functiondef('public.revision_datos_noche()'::regprocedure);
  v_ancla text := 'where estado = ''abierto'' or cerrado_en > now() - interval ''30 days''';
  v_lim text := 'order by creado_en desc limit 120';
begin
  if v_def like '%interval ''180 days''%' then return; end if;
  if position(v_ancla in v_def) = 0 or position(v_lim in v_def) = 0 then
    raise exception 'revision_datos_noche ya no es la que se conocía';
  end if;
  v_def := replace(v_def, v_ancla, v_ancla || ' or (estado = ''bien_asi'' and cerrado_en > now() - interval ''180 days'')');
  v_def := replace(v_def, v_lim, 'order by creado_en desc limit 400');
  execute v_def;
end $$;

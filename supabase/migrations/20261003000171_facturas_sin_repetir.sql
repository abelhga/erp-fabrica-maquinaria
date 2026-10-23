-- =============================================================================
-- Una factura emitida se registra una vez, y se corrige en su lugar.
--
-- El 23 oct Susana registró la A 3251 del PED-26-784 sin UUID (el ERP no se lo aceptaba por los
-- guiones del PDF, ver 170) y, ya arreglado, la volvió a registrar con UUID: el pedido quedó
-- facturado dos veces ($396,720). No tenía otra forma: la pantalla no dejaba corregir una factura
-- ya registrada, y nada impedía repetir el folio (lo de 131 era solo para facturas de proveedor).
--
-- 1. Se juntan: queda la del 14 jul (la fecha de la factura) con el UUID de la otra, y la del
--    23 oct se borra (queda en la bitácora).
-- 2. validar_factura rechaza un folio o un UUID que ya está en otra factura, y dice en cuál
--    pedido y cómo corregirla. Un índice único sobre el UUID respalda la regla.
-- La edición en pantalla usa la política que ya existía (finanzas nivel 2 escribe facturas).
-- =============================================================================

do $$
declare v_uuid text;
begin
  select uuid_sat into v_uuid from facturas where id = 'cbe496e1-c2ca-4b8f-89c1-e0e9beef43c4';
  if found and exists (select 1 from facturas where id = '06d28afa-69fe-4cb6-8da0-6479a438fc00' and uuid_sat is null) then
    delete from facturas where id = 'cbe496e1-c2ca-4b8f-89c1-e0e9beef43c4';
    update facturas set uuid_sat = v_uuid where id = '06d28afa-69fe-4cb6-8da0-6479a438fc00';
  end if;
end $$;

-- La llave de un folio para compararlo: «A 3251», «A-3251» y «a3251» son el mismo.
create or replace function public.llave_folio_factura(p text) returns text
language sql immutable set search_path = public as $$
  select nullif(upper(regexp_replace(coalesce(p, ''), '[^0-9A-Za-z]', '', 'g')), '')
$$;

create or replace function public.validar_factura() returns trigger
language plpgsql set search_path = public as $$
declare v text; v_raras text; r record;
begin
  new.folio := trim(new.folio);
  -- Guiones tipográficos → guion; fuera todo lo que no sea letra, número o guion (espacios,
  -- caracteres invisibles que trae el PDF, saltos de línea).
  v := upper(regexp_replace(translate(coalesce(new.uuid_sat, ''), '‐‑‒–—―−', '-------'), '[^0-9A-Za-z-]', '', 'g'));
  -- Sin guiones (32 caracteres) también se entiende.
  if v ~ '^[0-9A-F]{32}$' then
    v := substr(v, 1, 8) || '-' || substr(v, 9, 4) || '-' || substr(v, 13, 4) || '-' || substr(v, 17, 4) || '-' || substr(v, 21, 12);
  end if;
  new.uuid_sat := nullif(v, '');
  if new.folio = '' then raise exception 'La factura necesita folio'; end if;
  if new.uuid_sat is not null and new.uuid_sat !~ '^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$' then
    v_raras := (select string_agg(distinct c, ', ') from regexp_split_to_table(regexp_replace(new.uuid_sat, '[0-9A-F-]', '', 'g'), '') c where c <> '');
    if v_raras is not null then
      raise exception 'El UUID del SAT solo lleva números y letras de la A a la F, y este trae %: revisa que no sea un cero escrito como letra O', v_raras;
    end if;
    raise exception 'El UUID del SAT son 36 caracteres en grupos 8-4-4-4-12 y este trae %: cópialo completo del XML o del PDF', length(new.uuid_sat);
  end if;
  if new.total <= 0 then raise exception 'El total de la factura debe ser mayor a cero'; end if;

  -- La misma factura no se registra dos veces: si le falta algo, se corrige la que ya está.
  select f.folio, f.fecha, p.folio as pedido into r from facturas f join pedidos p on p.id = f.pedido_id
  where f.id is distinct from new.id
    and (llave_folio_factura(f.folio) = llave_folio_factura(new.folio) or (new.uuid_sat is not null and f.uuid_sat = new.uuid_sat))
  limit 1;
  if found then
    raise exception 'La factura % ya está registrada en el pedido % (del %). Si le falta el UUID o algo está mal, corrígela ahí con el lápiz en vez de registrarla otra vez.',
      r.folio, r.pedido, to_char(r.fecha, 'DD/MM/YYYY') using errcode = '23505';
  end if;
  return new;
end $$;

create unique index if not exists facturas_uuid_unico on public.facturas (uuid_sat) where uuid_sat is not null;

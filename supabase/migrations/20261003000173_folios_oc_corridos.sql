-- Folios de orden de compra: OC-26-4400.
--
-- En la hoja de compras de Toño cada orden lleva un número corrido (la 4399 fue del 19 oct) y
-- así la conocen los proveedores, almacén y finanzas («¿ya llegó la 4381?»). El ERP numeraba
-- OC-2026-00001 desde cero: el lunes la primera OC del ERP habría sido la «00003», que nadie
-- relaciona con nada. Igual que con los pedidos (153): el año para ubicarla y el número que
-- todos conocen, que no reinicia. La serie corrida vive en folios con año 0.
--
-- Las órdenes abiertas que se pasan de la hoja conservan su número (OC-26-4381); la serie
-- arranca después de la última de la hoja. Las dos OC de prueba que ya había (la cancelada y
-- un borrador de reabasto) se quedan con su folio: no las conoce nadie fuera del ERP.

create or replace function public.folio_oc(p_fecha date) returns text
language plpgsql security definer set search_path = public as $$
declare v_n int;
begin
  insert into folios (serie, anio, ultimo) values ('OC', 0, 1)
  on conflict (serie, anio) do update set ultimo = folios.ultimo + 1
  returning ultimo into v_n;
  return format('OC-%s-%s', to_char(coalesce(p_fecha, hoy_mx()), 'YY'), v_n);
end $$;
revoke execute on function public.folio_oc(date) from public, anon, authenticated;

create or replace function public.trg_folio_oc() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(new.folio, '') = '' then new.folio := folio_oc(new.fecha); end if;
  return new;
end $$;

drop trigger if exists folio on public.ordenes_compra;
create trigger folio before insert on public.ordenes_compra for each row execute function public.trg_folio_oc();

-- La última orden de la hoja al 23 oct es la 4399; la sincronización la sube si hubo más.
insert into public.folios (serie, anio, ultimo) values ('OC', 0, 4399)
on conflict (serie, anio) do update set ultimo = greatest(folios.ultimo, excluded.ultimo);

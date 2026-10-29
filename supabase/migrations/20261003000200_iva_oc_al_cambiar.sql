-- =============================================================================
-- El IVA de una orden de compra se recalcula al cambiarlo.
--
-- Los totales de la OC solo se recalculaban al tocar una partida (totales_oc, 004). Si compras
-- ponía las partidas y después cambiaba el IVA (una importación: «0 % (importación / exento)»),
-- la OC decía «IVA 0 %» pero se quedaba con el IVA del 16 %: la OC-26-4412 iba al proveedor por
-- USD 3,957.92 en vez de USD 3,412.00. Lo vio Toño el 29-oct. Ahora el IVA y el total salen del
-- subtotal y la tasa cada vez que cambia la tasa, y se corrigen las que ya quedaron mal.
-- =============================================================================

create or replace function public.trg_oc_iva() returns trigger
language plpgsql set search_path = public as $$
begin
  new.iva := round(coalesce(new.subtotal, 0) * coalesce(new.tasa_iva, 0), 2);
  new.total := coalesce(new.subtotal, 0) + new.iva;
  return new;
end $$;

drop trigger if exists iva_al_cambiar on public.ordenes_compra;
create trigger iva_al_cambiar before update of tasa_iva on public.ordenes_compra
  for each row when (new.tasa_iva is distinct from old.tasa_iva) execute function public.trg_oc_iva();

-- Las que ya quedaron con el IVA de otra tasa.
update public.ordenes_compra set iva = round(subtotal * tasa_iva, 2), total = subtotal + round(subtotal * tasa_iva, 2)
where iva is distinct from round(subtotal * tasa_iva, 2) or total is distinct from subtotal + round(subtotal * tasa_iva, 2);

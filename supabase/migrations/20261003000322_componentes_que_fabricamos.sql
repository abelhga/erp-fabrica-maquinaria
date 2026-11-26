-- =============================================================================
-- Un componente que fabricamos nosotros le toca a producción, no a compras.
--
-- Por qué: «Por atender» (321) mandaba a compras el helicoidal de descarga de 8" × 8 m del PED-26-807
-- porque no tiene lista de materiales (y está en la categoría «Herramientas»), pero lo fabrica
-- Hegamex. Sin lista de materiales el ERP no tenía cómo saberlo.
--
-- Qué cambia: articulos.lo_fabricamos («Lo fabricamos nosotros», en la ficha del componente; lo
-- cambian ingeniería y la gerencia de producción). Un componente con esa marca o con lista de
-- materiales que falta en un pedido le toca a producción («Fabricar lo que no hay»).
-- =============================================================================

alter table public.articulos add column if not exists lo_fabricamos boolean not null default false;

create or replace function public.fijar_lo_fabricamos(p_articulo uuid, p_valor boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not (puede('costeo', 2) or puede('produccion', 3)) then
    raise exception 'Lo cambian ingeniería y la gerencia de producción' using errcode = '42501';
  end if;
  update articulos set lo_fabricamos = coalesce(p_valor, false), actualizado_en = now()
  where id = p_articulo and tipo in ('componente', 'materia_prima');
  if not found then raise exception 'Solo aplica a componentes y materia prima' using errcode = '22023'; end if;
end $$;
revoke execute on function public.fijar_lo_fabricamos(uuid, boolean) from public, anon;
grant execute on function public.fijar_lo_fabricamos(uuid, boolean) to authenticated;

do $$
declare v_def text := pg_get_functiondef('public._pedidos_por_atender(boolean, uuid)'::regprocedure);
  v_ancla text := 'exists (select 1 from bom_lineas b where b.padre_id = s.articulo_id) fabricado';
begin
  if v_def like '%lo_fabricamos%' then return; end if;
  if position(v_ancla in v_def) = 0 then raise exception '_pedidos_por_atender ya no es la que se conocía'; end if;
  execute replace(v_def, v_ancla,
    '(exists (select 1 from bom_lineas b where b.padre_id = s.articulo_id) or coalesce((select a.lo_fabricamos from articulos a where a.id = s.articulo_id), false)) fabricado');
end $$;

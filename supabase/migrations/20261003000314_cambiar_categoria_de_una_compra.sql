-- =============================================================================
-- Cambiar la categoría de una compra ya registrada, con motivo.
--
-- Por qué: hay compras a Aceros Ocotlán que no son de Hegamex y deben ir en «Sin efectos»
-- (no son gasto: no restan a la utilidad, aunque al proveedor sí se le debe). La categoría
-- existe y finanzas ya la usa al registrar, pero una compra ya registrada no se podía cambiar:
-- solo borrarla y capturarla otra vez. Y aunque se cambiara, si la factura está ligada a una
-- orden de compra con artículos de inventario, Resultados la contaba como «material» de todos
-- modos: la orden mandaba sobre la categoría.
--
-- Qué hay:
--   · cambiar_categoria_compra(movimiento, categoría, motivo): finanzas nivel 2. El motivo es
--     obligatorio y queda en movimiento_categoria_cambios (antes, después, quién, cuándo).
--   · compras_erp: una compra cuya categoría no es gasto («fuera»: sin efectos, retiros,
--     activos…) se queda con su categoría aunque esté ligada a una orden. El material que haya
--     entrado al almacén por esa orden no se toca: eso es otro movimiento.
-- =============================================================================

create table if not exists public.movimiento_categoria_cambios (
  id bigint generated always as identity primary key,
  movimiento_id uuid not null references public.movimientos_proveedor(id) on delete cascade,
  antes text,
  despues text not null,
  motivo text not null check (length(btrim(motivo)) >= 5),
  por uuid default auth.uid(),
  en timestamptz not null default now()
);
create index if not exists movimiento_categoria_cambios_mov on public.movimiento_categoria_cambios (movimiento_id, en);
alter table public.movimiento_categoria_cambios enable row level security;
drop policy if exists ver on public.movimiento_categoria_cambios;
create policy ver on public.movimiento_categoria_cambios for select to authenticated using ((select puede('finanzas', 2)));
grant select on public.movimiento_categoria_cambios to authenticated;

create or replace function public.cambiar_categoria_compra(p_movimiento uuid, p_categoria text, p_motivo text) returns void
language plpgsql security definer set search_path = public as $$
declare v_m movimientos_proveedor; v_cat text := nullif(btrim(p_categoria), '');
begin
  if not puede('finanzas', 2) then
    raise exception 'La categoría de una compra la cambia finanzas' using errcode = '42501';
  end if;
  if v_cat is null then raise exception 'Escribe la categoría' using errcode = '22023'; end if;
  if length(btrim(coalesce(p_motivo, ''))) < 5 then
    raise exception 'Escribe por qué cambia la categoría (queda en la cuenta del proveedor)' using errcode = '22023';
  end if;
  select * into v_m from movimientos_proveedor where id = p_movimiento for update;
  if not found then raise exception 'Esa compra ya no existe' using errcode = 'P0002'; end if;
  if v_m.tipo <> 'compra' then raise exception 'Solo las compras llevan categoría' using errcode = '22023'; end if;
  if lower(coalesce(btrim(v_m.categoria), '')) = lower(v_cat) then
    raise exception 'La compra ya está en «%»', v_cat using errcode = '22023';
  end if;
  -- Con la escritura de la categoría que ya existe, para que no salgan dos («Sin efectos» y «sin efectos»).
  v_cat := coalesce((select m.categoria from movimientos_proveedor m where lower(btrim(m.categoria)) = lower(v_cat)
                     group by m.categoria order by count(*) desc limit 1), v_cat);
  update movimientos_proveedor set categoria = v_cat where id = p_movimiento;
  insert into movimiento_categoria_cambios (movimiento_id, antes, despues, motivo)
  values (p_movimiento, v_m.categoria, v_cat, btrim(p_motivo));
end $$;
revoke execute on function public.cambiar_categoria_compra(uuid, text, text) from public, anon;
grant execute on function public.cambiar_categoria_compra(uuid, text, text) to authenticated;

-- compras_erp: lo que no es gasto no se vuelve «material» por estar ligado a una orden.
do $$
declare v_def text := pg_get_functiondef('public.compras_erp(date, date)'::regprocedure);
  v_ancla text := 'case when p.clase is null then m.categoria';
begin
  if v_def like '%tipo_categoria_compra(m.categoria) = ''fuera'' or p.clase is null%' then return; end if;
  if position(v_ancla in v_def) = 0 then
    raise exception 'compras_erp ya no es la que se conocía: revisar antes de que respete «Sin efectos»';
  end if;
  v_def := replace(v_def, v_ancla, 'case when tipo_categoria_compra(m.categoria) = ''fuera'' or p.clase is null then m.categoria');
  execute v_def;
end $$;

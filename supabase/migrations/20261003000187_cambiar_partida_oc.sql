-- =============================================================================
-- Cambiar una partida de una orden de compra ya enviada, con su historial.
--
-- La OC-26-4399 pedía el motorreductor C-00253. Producción y el proveedor acordaron otro, pero la
-- orden ya estaba en manos del proveedor. Una orden enviada no se podía tocar: solo cancelarse. Y
-- cancelarla y hacer otra deja al proveedor facturando contra un folio cancelado, mientras la
-- recepción espera otro número.
--
-- Ahora compras cambia la partida (artículo, cantidad o costo) en la misma orden, siempre que de
-- esa partida no se haya recibido nada. El motivo es obligatorio. La orden sube de revisión
-- («Rev. 2» en lo impreso, para mandársela otra vez al proveedor) y oc_cambios guarda el antes y
-- el después.
-- =============================================================================

alter table public.ordenes_compra add column if not exists revision int not null default 1;

create table if not exists public.oc_cambios (
  id uuid primary key default gen_random_uuid(),
  orden_compra_id uuid not null references public.ordenes_compra(id) on delete cascade,
  oc_linea_id uuid,                       -- sin FK: la historia no depende de que la partida siga
  revision int not null,                  -- la revisión que resultó del cambio
  antes jsonb not null,
  despues jsonb not null,
  motivo text not null,
  usuario_id uuid default auth.uid() references public.perfiles(id),
  en timestamptz not null default now()
);
create index if not exists oc_cambios_orden on public.oc_cambios (orden_compra_id, en);
alter table public.oc_cambios enable row level security;
-- Trae costos: lo ve quien ve los costos de las compras (069).
drop policy if exists ver on public.oc_cambios;
create policy ver on public.oc_cambios for select to authenticated using ((select ve_costos_compra()));

create or replace function public.cambiar_partida_oc(p_linea uuid, p_articulo uuid, p_cantidad numeric, p_costo numeric, p_motivo text)
returns int language plpgsql security definer set search_path = public as $$
declare l oc_lineas; o ordenes_compra; a articulos; v_antes jsonb; v_despues jsonb; v_pagado numeric; v_rev int;
begin
  if not puede('compras', 2) then raise exception 'Cambiar una orden de compra es de compras' using errcode = '42501'; end if;
  select * into l from oc_lineas where id = p_linea for update;
  if l.id is null then raise exception 'No existe esa partida'; end if;
  select * into o from ordenes_compra where id = l.orden_compra_id for update;
  if o.estado = 'borrador' then raise exception 'La orden % está en borrador: cámbiala ahí mismo', o.folio; end if;
  if o.estado not in ('enviada', 'parcial') then raise exception 'La orden % ya está %', o.folio, o.estado; end if;
  if l.recibido > 0 then
    raise exception 'De esa partida ya se recibió una parte: lo que falta de otro artículo pídelo en otra orden';
  end if;
  if coalesce(trim(p_motivo), '') = '' then raise exception 'Escribe por qué cambia (quién lo acordó y con quién)'; end if;
  if coalesce(p_cantidad, 0) <= 0 then raise exception 'La cantidad tiene que ser más de cero'; end if;
  if coalesce(p_costo, -1) < 0 then raise exception 'El costo no puede ser negativo'; end if;
  if p_articulo is null then raise exception 'Elige el artículo'; end if;
  select * into a from articulos where id = p_articulo;
  if a.id is null or not a.activo then raise exception 'Ese artículo no existe o está apagado'; end if;
  if a.tipo not in ('componente', 'materia_prima', 'servicio') then raise exception 'Una compra es de un componente, materia prima o servicio'; end if;
  if p_articulo is not distinct from l.articulo_id and p_cantidad = l.cantidad and p_costo = l.costo_unitario then
    raise exception 'No cambió nada';
  end if;

  select jsonb_build_object('articulo_id', l.articulo_id, 'clave', x.clave, 'nombre', coalesce(x.nombre, l.descripcion),
                            'cantidad', l.cantidad, 'costo_unitario', l.costo_unitario)
    into v_antes from (select 1) _ left join articulos x on x.id = l.articulo_id;
  v_despues := jsonb_build_object('articulo_id', a.id, 'clave', a.clave, 'nombre', a.nombre, 'cantidad', p_cantidad, 'costo_unitario', p_costo);

  -- Con otro artículo, la descripción vieja (como el proveedor le llamaba al anterior) ya no aplica.
  update oc_lineas set articulo_id = a.id, cantidad = p_cantidad, costo_unitario = p_costo,
    descripcion = case when a.id is distinct from l.articulo_id then null else descripcion end
  where id = l.id;
  -- Los totales los rehace el disparador de oc_lineas; con eso se revisa que lo pagado quepa.
  select coalesce(sum(monto), 0) into v_pagado from pagos_proveedor where orden_compra_id = o.id;
  if v_pagado > (select total from ordenes_compra where id = o.id) + 0.005 then
    raise exception 'A la orden ya se le pagaron %: con el cambio el total quedaría abajo de eso', round(v_pagado, 2);
  end if;
  update ordenes_compra set revision = revision + 1 where id = o.id returning revision into v_rev;
  insert into oc_cambios (orden_compra_id, oc_linea_id, revision, antes, despues, motivo)
  values (o.id, l.id, v_rev, v_antes, v_despues, trim(p_motivo));
  return v_rev;
end $$;
revoke execute on function public.cambiar_partida_oc(uuid, uuid, numeric, numeric, text) from public, anon;
grant execute on function public.cambiar_partida_oc(uuid, uuid, numeric, numeric, text) to authenticated;

-- La vista de 069 con la revisión al final (lo impreso la necesita).
create or replace view public.v_ordenes_compra with (security_invoker = false) as
with permiso as (select ve_costos_compra() dinero,
                        puede('compras', 1) or puede('finanzas', 1) or puede('inventario', 2) or puede('produccion', 2) fila)
select o.id, o.folio, o.proveedor_id, o.estado, o.fecha, o.fecha_entrega, o.moneda,
  case when permiso.dinero then o.tipo_cambio end as tipo_cambio,
  case when permiso.dinero then o.tasa_iva end as tasa_iva,
  o.condiciones, o.notas, o.factura_proveedor,
  case when permiso.dinero then o.subtotal end as subtotal,
  case when permiso.dinero then o.iva end as iva,
  case when permiso.dinero then o.total end as total,
  case when permiso.dinero then o.vence_pago end as vence_pago,
  o.creado_por, o.creado_en, o.actualizado_en,
  p.nombre as proveedor, p.es_importacion, u.nombre as creado_por_nombre,
  (select count(*) from public.oc_lineas l where l.orden_compra_id = o.id) as partidas,
  (select coalesce(sum(least(l.recibido, l.cantidad)) / nullif(sum(l.cantidad), 0), 0) from public.oc_lineas l where l.orden_compra_id = o.id) as avance_recibido,
  o.estado in ('enviada', 'parcial') and o.fecha_entrega < current_date as atrasada,
  case when o.estado in ('enviada', 'parcial') and o.fecha_entrega < current_date then current_date - o.fecha_entrega end as dias_atraso,
  case when permiso.dinero then (select coalesce(sum(x.monto), 0) from public.pagos_proveedor x where x.orden_compra_id = o.id) end as pagado,
  o.revision
from public.ordenes_compra o
cross join permiso
join public.proveedores p on p.id = o.proveedor_id
left join public.perfiles u on u.id = o.creado_por
where permiso.fila;

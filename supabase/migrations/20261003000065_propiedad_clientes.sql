-- =============================================================================
-- ¿De quién es un cliente? Regla de vigencia.
--
-- Hoy cada vendedor tiene sus clientes en su hoja para siempre, aunque no les
-- venda en años, y otro vendedor no sabe si puede atenderlos. El dueño propuso:
-- un cliente es de un vendedor mientras tenga ventas recientes con él.
--
-- Regla (plazos en configuracion.propiedad_clientes, editables sin programar):
--   el cliente es del vendedor hasta la fecha más lejana entre
--     · su última venta (pedido) con ese vendedor + 12 meses
--     · su último seguimiento (cotización, oportunidad o actividad) + 90 días
--     · la fecha en que lo dio de alta + 90 días (protege al prospecto nuevo)
--   Después queda LIBRE: cualquiera puede cotizarle y el primero que lo hace se
--   queda con él. Un cliente vigente de otro vendedor no se le puede cotizar
--   (la gerencia lo reasigna o comparte crédito).
-- =============================================================================

insert into public.configuracion (clave, valor, descripcion) values
  ('propiedad_clientes', '{"meses_venta":12,"dias_seguimiento":90,"activa":false}',
   'Vigencia de la cartera: meses desde la última venta y días desde el último seguimiento. "activa": false = solo se calcula y se muestra; true = además se liberan los vencidos cada noche y se bloquea cotizar a clientes vigentes de otro.')
on conflict (clave) do nothing;

create or replace function public.vigencia_cliente(p_cliente uuid)
returns table (vendedor_id uuid, ultima_venta date, ultimo_seguimiento date, vence_en date, vigente boolean)
language sql stable security definer set search_path = public as $$
  with cfg as (select valor c from configuracion where clave = 'propiedad_clientes'),
  -- La protección de "prospecto nuevo" es para clientes dados de alta en el ERP; a los
  -- importados no (si no, todos amanecerían protegidos 90 días el día del arranque).
  cl as (select id, vendedor_id, case when legacy_ref is null then creado_en::date end alta from clientes where id = p_cliente),
  venta as (
    select greatest(
      (select max(p.fecha) from pedidos p where p.cliente_id = cl.id and p.estado <> 'cancelado'
         and (p.vendedor_id = cl.vendedor_id or exists (select 1 from pedido_vendedores v where v.pedido_id = p.id and v.vendedor_id = cl.vendedor_id))),
      -- El libro de ventas de la hoja no dice quién vendió: cuenta para el dueño que tenía en el directorio.
      (select max(h.fecha) from historial_ventas_hoja h where h.cliente_id = cl.id and h.tipo = 'Venta')) f
    from cl
  ),
  seguimiento as (
    select max(f) f from cl, lateral (
      select max(c.fecha) f from cotizaciones c where c.cliente_id = cl.id and c.vendedor_id = cl.vendedor_id
      union all select max(o.actualizado_en::date) from oportunidades o where o.cliente_id = cl.id and o.vendedor_id = cl.vendedor_id
      union all select max(a.en::date) from actividades a where a.cliente_id = cl.id and a.usuario_id = cl.vendedor_id
    ) x
  )
  select cl.vendedor_id, venta.f, seguimiento.f,
    greatest(venta.f + make_interval(months => (cfg.c->>'meses_venta')::int),
             seguimiento.f + make_interval(days => (cfg.c->>'dias_seguimiento')::int),
             cl.alta + make_interval(days => (cfg.c->>'dias_seguimiento')::int))::date,
    cl.vendedor_id is not null and greatest(venta.f + make_interval(months => (cfg.c->>'meses_venta')::int),
             seguimiento.f + make_interval(days => (cfg.c->>'dias_seguimiento')::int),
             cl.alta + make_interval(days => (cfg.c->>'dias_seguimiento')::int))::date >= current_date
  from cl, venta, seguimiento, cfg
$$;

-- Para la pantalla de clientes y para la vista previa de qué se liberaría.
create or replace view public.v_cartera with (security_invoker = true) as
select c.id cliente_id, c.nombre, c.vendedor_id, p.nombre vendedor, v.ultima_venta, v.ultimo_seguimiento, v.vence_en,
  case when c.vendedor_id is null then 'libre' when v.vigente then 'vigente' else 'vencido' end estado,
  v.vence_en - current_date as dias_restantes
from public.clientes c
left join public.perfiles p on p.id = c.vendedor_id
cross join lateral public.vigencia_cliente(c.id) v
where c.activo;

-- Libera los vencidos (lo corre pg_cron cada noche si la regla está activa).
create or replace function public.liberar_clientes_vencidos(p_forzar boolean default false) returns int
language plpgsql security definer set search_path = public as $$
declare v_n int;
begin
  if not p_forzar and not coalesce((select (valor->>'activa')::boolean from configuracion where clave = 'propiedad_clientes'), false) then
    return 0;
  end if;
  with vencidos as (
    select c.id, c.vendedor_id from clientes c cross join lateral vigencia_cliente(c.id) v
    where c.vendedor_id is not null and not v.vigente
  )
  update clientes c set vendedor_id = null,
    notas = concat_ws(E'\n', c.notas, format('Liberado el %s: sin ventas ni seguimiento de %s dentro del plazo.',
            to_char(current_date, 'DD/MM/YYYY'), (select nombre from perfiles where id = v.vendedor_id)))
  from vencidos v where c.id = v.id;
  get diagnostics v_n = row_count;
  return v_n;
end $$;

-- Cotizar a un cliente: si está libre, el vendedor se queda con él; si es
-- vigente de otro, no se puede (salvo gerencia). Solo con la regla activa.
create or replace function public.reclamar_cliente() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_dueno uuid; v_vig boolean;
begin
  if new.cliente_id is null or not coalesce((select (valor->>'activa')::boolean from configuracion where clave = 'propiedad_clientes'), false) then
    return new;
  end if;
  select vendedor_id, vigente into v_dueno, v_vig from vigencia_cliente(new.cliente_id);
  if v_dueno is null then
    update clientes set vendedor_id = new.vendedor_id where id = new.cliente_id and vendedor_id is null;
  elsif v_dueno <> new.vendedor_id and v_vig and not puede('ventas', 3) then
    raise exception 'Este cliente es de % hasta el %. Pídele a la gerencia que lo reasigne o que compartan el crédito.',
      (select nombre from perfiles where id = v_dueno), to_char((select vence_en from vigencia_cliente(new.cliente_id)), 'DD/MM/YYYY')
      using errcode = '42501';
  end if;
  return new;
end $$;
create trigger reclamar_cliente before insert or update of cliente_id on public.cotizaciones
  for each row execute function public.reclamar_cliente();
create trigger reclamar_cliente before insert or update of cliente_id on public.oportunidades
  for each row execute function public.reclamar_cliente();

-- Cada noche a las 2:10 (hora de México = 8:10 UTC), si pg_cron está disponible.
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('liberar-clientes-vencidos', '10 8 * * *', 'select public.liberar_clientes_vencidos()');
  end if;
exception when others then
  raise notice 'pg_cron no disponible (%): liberar_clientes_vencidos() se puede correr a mano', sqlerrm;
end $$;

select public.optimizar_politicas();

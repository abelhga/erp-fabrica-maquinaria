-- =============================================================================
-- Comisiones como módulo propio y rol de gerencia administrativa.
--
-- Por qué: Susana (gerente administrativa y también vendedora) hace lo mismo que
-- Adriana en finanzas, pero todavía no debe ver las comisiones de Isaac y Juan
-- Manuel (se verá cuando se homologue su comisión). Ver las comisiones de todos
-- colgaba de puede('finanzas', 1), y puede() toma el nivel más alto de todos los
-- roles: con el rol de finanzas, Susana las veía. Además, "A quién llamar hoy"
-- (security invoker) le sugería clientes de los otros vendedores, porque finanzas
-- lee todos los pedidos y el historial para cobrar.
--
-- 1. Módulo "comisiones": 1 = ver las de todos, 2 = marcarlas pagadas. Lo tienen
--    dirección (3), finanzas (2) y la gerencia de ventas (1). Cada vendedor sigue
--    viendo la suya sin el módulo.
-- 2. Rol "administracion" (Gerencia administrativa) = los permisos de finanzas sin
--    comisiones. Susana pasa de finanzas a este rol. Para homologarla después basta
--    darle "Comisiones" al rol en Sistema → Permisos.
-- 3. ventas_vendedor_mes (la venta de cada vendedor por línea) no tenía candado:
--    cualquiera con sesión la leía. Solo la usa comisiones_mes por dentro.
-- 4. "A quién llamar hoy": los clientes propios y los libres; la gerencia, todos.
-- =============================================================================

insert into public.permisos_rol (rol, modulo, nivel) values
  ('direccion', 'comisiones', 3), ('finanzas', 'comisiones', 2), ('gerente_ventas', 'comisiones', 1)
on conflict do nothing;

insert into public.permisos_rol (rol, modulo, nivel)
select 'administracion', modulo, nivel from public.permisos_rol where rol = 'finanzas' and modulo <> 'comisiones'
on conflict do nothing;

-- Susana: vendedora y gerencia administrativa (deja el rol de finanzas).
insert into public.usuario_roles (usuario_id, rol)
select u.id, 'administracion' from auth.users u
where lower(u.email) = 'susana@hegamex.com' and exists (select 1 from public.usuario_roles r where r.usuario_id = u.id and r.rol = 'finanzas')
on conflict do nothing;
delete from public.usuario_roles r using auth.users u
where u.id = r.usuario_id and lower(u.email) = 'susana@hegamex.com' and r.rol = 'finanzas';

revoke execute on function public.ventas_vendedor_mes(date) from public, anon, authenticated;

create or replace function public.comisiones_mes(p_mes date)
returns table (vendedor_id uuid, vendedor text, plan text, venta_maquinaria numeric, venta_refacciones numeric, venta_otros numeric,
               comision numeric, bono_meta numeric, bono_refacciones numeric, ajustes numeric, total numeric,
               siguiente_meta numeric, pagado_en date)
language sql stable security definer set search_path = public as $$
  with m as (select date_trunc('month', p_mes)::date as mes),
  base as (
    select pf.id, pf.nombre, pc.nombre plan, pc.id plan_id, pc.pct_maquinaria,
      coalesce(v.maquinaria, 0) maq, coalesce(v.refacciones, 0) ref, coalesce(v.otros, 0) otr,
      coalesce(v.maquinaria, 0) + case when pc.otros_como_maquinaria then coalesce(v.otros, 0) else 0 end as base_meta
    from vendedor_plan vp
    join perfiles pf on pf.id = vp.vendedor_id
    join planes_comision pc on pc.id = vp.plan_id
    cross join m
    left join ventas_vendedor_mes(m.mes) v on v.vendedor_id = pf.id
    -- Cada vendedor ve solo lo suyo; las de todos, quien tiene el módulo de comisiones o la gerencia de ventas.
    where pf.id = auth.uid() or puede('ventas', 3) or puede('comisiones', 1)
  ),
  calc as (
    select b.*,
      round(b.base_meta * b.pct_maquinaria, 2) com,
      coalesce((select e.bono from plan_escalones e where e.plan_id = b.plan_id and e.tipo = 'meta_maquinaria' and e.desde <= b.base_meta
                order by e.desde desc limit 1), 0) bmeta,
      coalesce((select e.bono from plan_escalones e where e.plan_id = b.plan_id and e.tipo = 'bono_refacciones' and e.desde <= b.ref
                order by e.desde desc limit 1), 0) bref,
      coalesce((select sum(a.monto) from comision_ajustes a cross join m where a.vendedor_id = b.id and a.mes = m.mes), 0) aj
    from base b
  )
  select c.id, c.nombre, c.plan, round(c.maq, 2), round(c.ref, 2), round(c.otr, 2), c.com, c.bmeta, c.bref, c.aj,
    c.com + c.bmeta + c.bref + c.aj,
    (select min(e.desde) from plan_escalones e where e.plan_id = c.plan_id and e.tipo = 'meta_maquinaria' and e.desde > c.base_meta),
    (select cp.pagado_en from comision_pagos cp cross join m where cp.vendedor_id = c.id and cp.mes = m.mes)
  from calc c
  order by c.nombre
$$;

-- El detalle de pedidos de la comisión de otro vendedor: finanzas lee todos los
-- pedidos para cobrar, pero el desglose por vendedor es de comisiones.
create or replace function public.pedidos_comision(p_vendedor uuid, p_mes date)
returns table (pedido_id uuid, folio text, fecha date, cliente text, canal public.canal_venta, parte numeric,
               maquinaria numeric, refacciones numeric, otros numeric)
language sql stable security invoker as $$
  select p.id, p.folio, p.fecha, cl.nombre, p.canal, coalesce(pv.porcentaje, 100) / 100.0,
    round(coalesce(sum(l.importe * p.tipo_cambio) filter (where l.linea = 'maquinaria'), 0) * coalesce(pv.porcentaje, 100) / 100.0, 2),
    round(coalesce(sum(l.importe * p.tipo_cambio) filter (where l.linea = 'refacciones'), 0) * coalesce(pv.porcentaje, 100) / 100.0, 2),
    round(coalesce(sum(l.importe * p.tipo_cambio) filter (where l.linea = 'otros'), 0) * coalesce(pv.porcentaje, 100) / 100.0, 2)
  from pedidos p
  join clientes cl on cl.id = p.cliente_id
  join pedido_lineas l on l.pedido_id = p.id
  left join pedido_vendedores pv on pv.pedido_id = p.id and pv.vendedor_id = p_vendedor
  where (p_vendedor = (select auth.uid()) or (select puede('ventas', 3)) or (select puede('comisiones', 1)))
    and p.estado <> 'cancelado' and date_trunc('month', p.fecha) = date_trunc('month', p_mes)
    and (pv.vendedor_id is not null
         or (p.vendedor_id = p_vendedor and not exists (select 1 from pedido_vendedores x where x.pedido_id = p.id)))
  group by p.id, cl.nombre, pv.porcentaje
  order by p.fecha, p.folio
$$;

create or replace function public.pagar_comision(p_vendedor uuid, p_mes date, p_pagado_en date default null, p_referencia text default null)
returns numeric language plpgsql security invoker as $$
declare r record; v_mes date := date_trunc('month', p_mes)::date;
begin
  if not puede('comisiones', 2) then raise exception 'Solo finanzas marca las comisiones como pagadas' using errcode = '42501'; end if;
  if exists (select 1 from comision_pagos where vendedor_id = p_vendedor and mes = v_mes and pagado_en is not null) then
    raise exception 'Esa comisión ya está marcada como pagada';
  end if;
  select * into r from comisiones_mes(v_mes) c where c.vendedor_id = p_vendedor;
  if r.vendedor_id is null then raise exception 'Ese vendedor no tiene plan de comisión'; end if;
  insert into comision_pagos (vendedor_id, mes, total, detalle, pagado_en, referencia)
  values (p_vendedor, v_mes, r.total, to_jsonb(r), coalesce(p_pagado_en, hoy_mx()), nullif(trim(p_referencia), ''))
  on conflict (vendedor_id, mes) do update set total = excluded.total, detalle = excluded.detalle, pagado_en = excluded.pagado_en,
    referencia = excluded.referencia, registrado_por = auth.uid();
  return r.total;
end $$;

alter policy ver on public.vendedor_plan
  using (vendedor_id = (select auth.uid()) or (select puede('ventas', 3)) or (select puede('comisiones', 1)));
alter policy ver on public.comision_ajustes
  using (vendedor_id = (select auth.uid()) or (select puede('ventas', 3)) or (select puede('comisiones', 1)));
alter policy ver on public.comision_pagos
  using (vendedor_id = (select auth.uid()) or (select puede('ventas', 3)) or (select puede('comisiones', 1)));
-- "for all" también deja leer: el registro de pagos va por partes para no abrir la lectura.
drop policy editar on public.comision_pagos;
create policy alta on public.comision_pagos for insert to authenticated with check ((select puede('comisiones', 2)));
create policy cambio on public.comision_pagos for update to authenticated
  using ((select puede('comisiones', 2))) with check ((select puede('comisiones', 2)));
create policy baja on public.comision_pagos for delete to authenticated using ((select puede('comisiones', 2)));

-- El aviso de saldo bajo de paquetería también le llega a la gerencia administrativa.
create or replace function public.revisar_saldo_paqueteria(p_paqueteria int) returns boolean
language plpgsql security definer set search_path = public as $$
declare s record; v_dest uuid[];
begin
  select * into s from saldos_paqueteria_todas() x where x.paqueteria_id = p_paqueteria;
  if s.paqueteria_id is null or not s.bajo then return false; end if;
  v_dest := array(select usuarios_con_rol('gerente_ventas') union select usuarios_con_rol('finanzas')
                  union select usuarios_con_rol('administracion')
                  union select distinct e.guia_por from envios e where e.paqueteria_id = p_paqueteria and e.guia_en > now() - interval '30 days');
  perform avisar(v_dest, 'saldo_bajo', format('Saldo bajo en %s: %s', s.paqueteria, texto_dinero(s.saldo)),
    format('El mínimo es %s. Recarga antes de la siguiente guía.', texto_dinero(s.saldo_minimo)),
    '/almacen/envios?saldo=1', 'paqueterias', p_paqueteria::text, true);
  return true;
end $$;
revoke execute on function public.revisar_saldo_paqueteria(int) from public, anon, authenticated;

create or replace function public.oportunidades_sugeridas(p_limite int default 40)
returns table (cliente_id uuid, cliente text, vendedor_id uuid, vendedor text, motivo text, detalle text,
               ultima_compra date, ultima_descripcion text, compras int, total_historico numeric,
               ticket_promedio numeric, dias_sin_comprar int, intervalo_tipico int, valor_estimado numeric,
               puntaje numeric, cotizacion_id uuid, contacto text, telefono text, whatsapp text, correo text)
language sql stable security invoker as $$
  with hoy as (select (now() at time zone 'America/Mexico_City')::date d),
  arranque as (select coalesce((select (valor #>> '{}')::date from configuracion where clave = 'fecha_arranque'), current_date) f),
  ventas as (
    select h.cliente_id, h.fecha, h.monto, h.descripcion
    from historial_ventas_hoja h, arranque where h.tipo = 'Venta' and h.cliente_id is not null and h.monto > 0 and h.fecha < arranque.f
    union all
    select p.cliente_id, p.fecha, p.total * p.tipo_cambio,
      (select string_agg(l.titulo, ', ' order by l.orden) from pedido_lineas l where l.pedido_id = p.id)
    from pedidos p, arranque where not p.historico and p.estado <> 'cancelado' and p.fecha >= arranque.f
  ),
  -- Varias facturas el mismo día son una sola compra.
  compras as (
    select v.cliente_id, v.fecha, sum(v.monto) monto, string_agg(distinct v.descripcion, '; ') descripcion,
      v.fecha - lag(v.fecha) over (partition by v.cliente_id order by v.fecha) gap
    from ventas v group by v.cliente_id, v.fecha
  ),
  res as (
    select c.cliente_id, count(*)::int n, sum(c.monto) total, max(c.fecha) ultima,
      (array_agg(c.descripcion order by c.fecha desc))[1] ultima_desc,
      (array_agg(c.monto order by c.fecha desc))[1] ultimo_monto,
      -- Compras a menos de 2 semanas de la anterior son el mismo pedido partido.
      round(percentile_cont(0.5) within group (order by c.gap) filter (where c.gap > 14))::int intervalo
    from compras c group by c.cliente_id
  ),
  cand as (
    select r.*, hoy.d - r.ultima dias, r.total / r.n ticket,
      case
        -- "Ya le toca" solo con un ritmo de compra de hasta un año y sin haberlo pasado
        -- por más del doble; más allá ya no es ritmo, es un cliente que se fue (reactivar).
        when r.n >= 3 and r.intervalo between 30 and 365 and hoy.d - r.ultima >= r.intervalo
             and hoy.d - r.ultima <= r.intervalo * 2 then 'le_toca'
        when r.ultimo_monto >= 40000 and hoy.d - r.ultima between 180 and 1460
             and r.ultima_desc ~* '(banda|elevador|transportador|cribadora|dosificadora|tolva|silo|bazuca|gusano|sin ?fin|helicoidal)' then 'refacciones'
        when r.n >= 2 and hoy.d - r.ultima between 180 and 1095 then 'reactivar'
      end motivo
    from res r, hoy
  ),
  cot as (
    select distinct on (c.cliente_id) c.cliente_id, c.id, c.folio, c.total * c.tipo_cambio total, c.fecha + c.vigencia_dias vence
    from cotizaciones c, hoy
    where c.estado in ('enviada', 'autorizada') and c.cliente_id is not null
      and c.fecha + c.vigencia_dias between hoy.d - 10 and hoy.d + 7
    order by c.cliente_id, c.total desc
  ),
  todo as (
    select coalesce(k.cliente_id, x.cliente_id) cliente_id,
      case when k.cliente_id is not null then 'cotizacion' else x.motivo end motivo,
      x.n, x.total, x.ultima, x.ultima_desc, x.ultimo_monto, x.intervalo, x.dias, x.ticket,
      k.id cot_id, k.folio, k.total cot_total, k.vence
    from (select * from cand where motivo is not null) x
    full join cot k on k.cliente_id = x.cliente_id
  )
  , elegidos as (
  select t.cliente_id, cl.nombre, cl.vendedor_id, pf.nombre vendedor, t.motivo,
    case t.motivo
      when 'cotizacion' then format('La cotización %s por %s %s el %s. Llamar antes de que se enfríe.',
        t.folio, texto_dinero(t.cot_total), case when t.vence < (select d from hoy) then 'venció' else 'vence' end, to_char(t.vence, 'DD/MM'))
      when 'le_toca' then format('Compra cada ~%s días y ya van %s. La última fue %s: %s.',
        t.intervalo, t.dias, texto_dinero(t.ultimo_monto), left(t.ultima_desc, 80))
      when 'refacciones' then format('Hace %s meses compró %s (%s). A estas alturas ya pide rodillos, banda, cangilones o mantenimiento.',
        round(t.dias / 30.0), left(t.ultima_desc, 80), texto_dinero(t.ultimo_monto))
      else format('Compró %s veces (%s en total) y lleva %s meses sin comprar. Lo último: %s.',
        t.n, texto_dinero(t.total), round(t.dias / 30.0), left(t.ultima_desc, 80))
    end detalle,
    t.ultima, t.ultima_desc, t.n, round(t.total) total, round(t.ticket) ticket, t.dias, t.intervalo,
    -- Valor estimado: lo cotizado, o lo que suele comprar; en refacciones, una fracción del equipo.
    -- En refacciones, un 5 % del equipo (con tope de $150 mil): un silo de $2.7 M no
    -- pide $400 mil de refacciones en medio año.
    round(case t.motivo when 'cotizacion' then t.cot_total when 'refacciones' then least(greatest(t.ultimo_monto * 0.05, 10000), 150000) else t.ticket end) valor,
    round(case t.motivo
      when 'cotizacion' then t.cot_total * 1.5
      when 'le_toca' then t.ticket * t.n / (t.n + 2.0) * 1.2
      when 'refacciones' then least(greatest(t.ultimo_monto * 0.05, 10000), 150000) * 1.5 * (1 - t.dias / 1600.0)
      else t.ticket * 0.6 * (1 - t.dias / 1200.0) end) puntaje,
    t.cot_id
  from todo t
  join clientes cl on cl.id = t.cliente_id
  left join perfiles pf on pf.id = cl.vendedor_id
  where cl.activo
    -- Es la lista de un vendedor: sus clientes y los libres. Finanzas lee todos los pedidos
    -- para cobrar, pero eso no le pone en la lista los clientes de otro; la gerencia sí ve todos.
    and (cl.vendedor_id = (select auth.uid()) or cl.vendedor_id is null or (select puede('ventas', 3)))
    -- Público en general, mostrador y Mercado Libre no son a quién llamar.
    and cl.nombre !~* '(p[uú]blico|mostrador|mercado ?libre|^demo )'
    -- Si ya hay una oportunidad abierta, el vendedor ya está en eso.
    and not exists (select 1 from oportunidades o where o.cliente_id = t.cliente_id and o.etapa not in ('ganada', 'perdida'))
    -- Dijo "no por ahora", no contestó 3 intentos o ya no compra: fuera hasta que toque volver.
    and t.cliente_id not in (select clientes_en_pausa())
    and (t.motivo = 'cotizacion' or not exists (
      select 1 from cotizaciones c where c.cliente_id = t.cliente_id and c.estado in ('borrador', 'por_autorizar', 'autorizada', 'enviada')
        and c.fecha >= (select d from hoy) - 45))
  order by 15 desc
  limit p_limite
  )
  -- El contacto se busca solo para los que quedaron, no para los cientos de candidatos.
  select e.*, ct.nombre, ct.telefono, ct.whatsapp, ct.correo
  from elegidos e
  left join lateral (select * from contactos c where c.cliente_id = e.cliente_id
                     order by c.principal desc, (c.whatsapp is not null or c.telefono is not null) desc, c.creado_en limit 1) ct on true
  order by e.puntaje desc
$$;

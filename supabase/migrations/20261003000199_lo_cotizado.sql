-- =============================================================================
-- ¿Qué pasó con lo cotizado? De lo que cada vendedor cotiza, cuánto se gana, cuánto se pierde
-- (y por qué) y cuánto sigue abierto (y si alguien lo está siguiendo).
--
-- Del 13 al 29 de octubre se cotizaron $81.5 M sin IVA en 241 cotizaciones: $3.4 M se volvieron
-- pedido, $3.0 M se perdieron (16 de 20 por «No respondió») y $69.7 M seguían abiertos, $7.7 M
-- con el seguimiento atrasado. En la pantalla de Cotizaciones eso era una lista de folios. El
-- seguimiento (172) y el motivo de rechazo (082) ya guardan qué pasó: esto solo lo junta para
-- que el vendedor vea dónde se le va el dinero.
--
-- Cada cotización cuenta una vez con todas sus versiones (la raíz es origen_id), con el monto de
-- su última versión, sin IVA y en pesos, como el monto de la oportunidad: (total − iva) × tipo de
-- cambio. El periodo es por la fecha de la primera versión. Cómo se clasifica:
--   sin enviar  ninguna versión salió (borrador, por autorizar o cancelada sin mandarse).
--   ganada      una versión se aceptó (se volvió pedido).
--   otra        la oportunidad se ganó con otra cotización: ni se ganó ni se perdió.
--   perdida     rechazada, cancelada o vencida después de enviarse, o la oportunidad perdida;
--               con su motivo (el del rechazo o el de la oportunidad).
--   abierta     lo demás, según qué hace falta: negociando › seguimiento atrasado › no contesta
--               › vigencia vencida › esperando respuesta.
-- Security invoker: cada vendedor ve solo lo suyo (la RLS de cotizaciones) y la gerencia todo.
-- =============================================================================

create or replace function public.lo_cotizado(p_desde date, p_hasta date, p_vendedor uuid default null)
returns jsonb language plpgsql stable security invoker set search_path = public as $$
declare
  v_hoy date := hoy_mx();
  v_res jsonb;
begin
  if not puede('ventas', 2) then
    raise exception 'Lo cotizado es de ventas' using errcode = '42501';
  end if;
  if p_hasta < p_desde then raise exception 'El periodo está al revés'; end if;

  with
  familias as (
    select coalesce(c.origen_id, c.id) raiz, min(c.fecha) fecha, count(*)::int versiones,
      bool_or(c.enviada_en is not null or c.estado in ('enviada', 'aceptada', 'rechazada', 'vencida')) enviada,
      bool_or(c.estado = 'aceptada') ganada
    from cotizaciones c
    group by 1
  ),
  ultima as (
    select distinct on (coalesce(c.origen_id, c.id)) c.*
    from cotizaciones c order by coalesce(c.origen_id, c.id), c.version desc
  ),
  base as (
    select u.id, u.folio, u.version, f.versiones, f.fecha, u.vendedor_id, coalesce(pf.nombre, 'Sin vendedor') vendedor,
      coalesce(cl.nombre, u.empresa, u.atencion, 'Sin cliente') cliente,
      round((coalesce(u.total, 0) - coalesce(u.iva, 0)) * coalesce(u.tipo_cambio, 1), 2) monto,
      u.estado::text estado, f.enviada, f.ganada, o.etapa::text etapa,
      coalesce(nullif(trim(u.motivo_rechazo), ''), nullif(trim(o.motivo_perdida), '')) motivo,
      u.fecha + u.vigencia_dias < v_hoy vigencia_vencida,
      sp.vence seguimiento, sh.resultado ultimo_resultado, sh.que_paso
    from familias f
    join ultima u on coalesce(u.origen_id, u.id) = f.raiz
    left join clientes cl on cl.id = u.cliente_id
    left join perfiles pf on pf.id = u.vendedor_id
    left join oportunidades o on o.id = u.oportunidad_id
    left join lateral (select s.vence from seguimientos_cotizacion s
                       where s.oportunidad_id = u.oportunidad_id and s.estado = 'pendiente' limit 1) sp on true
    left join lateral (select s.resultado, s.que_paso from seguimientos_cotizacion s
                       where s.oportunidad_id = u.oportunidad_id and s.estado = 'hecho'
                       order by s.cerrado_en desc nulls last limit 1) sh on true
    where f.fecha between p_desde and p_hasta
  ),
  -- Lista de vendedores antes de filtrar por uno: la gerencia elige de aquí.
  vendedores as (
    select vendedor_id id, vendedor nombre, count(*)::int cotizaciones, sum(monto) monto from base group by 1, 2
  ),
  clasificadas as (
    select b.*,
      case
        when not b.enviada then 'sin_enviar'
        when b.ganada then 'ganada'
        when b.etapa = 'ganada' then 'otra'
        when b.estado in ('rechazada', 'cancelada', 'vencida') or b.etapa = 'perdida' then 'perdida'
        else 'abierta'
      end grupo
    from base b
    where p_vendedor is null or b.vendedor_id = p_vendedor
  ),
  con_detalle as (
    select k.*,
      case k.grupo
        when 'sin_enviar' then case k.estado when 'por_autorizar' then 'Por autorizar' when 'autorizada' then 'Autorizada, sin enviar'
                                             when 'cancelada' then 'Cancelada sin enviar' else 'Borrador' end
        when 'perdida' then coalesce(k.motivo, 'Sin motivo')
        when 'abierta' then case
          when k.etapa = 'negociacion' or k.ultimo_resultado = 'negociacion' then 'Negociando'
          when k.seguimiento < v_hoy then 'Seguimiento atrasado'
          when k.ultimo_resultado = 'no_contesta' then 'No contesta'
          when k.vigencia_vencida then 'Vigencia vencida'
          else 'Esperando respuesta' end
        when 'otra' then 'Se cerró con otra cotización'
        else 'Se volvió pedido'
      end detalle
    from clasificadas k
  ),
  -- Los motivos de pérdida son texto libre: los 5 que más pesan van solos, el resto junto.
  motivos as (
    select detalle, row_number() over (order by sum(monto) desc, count(*) desc) n
    from con_detalle where grupo = 'perdida' group by detalle
  ),
  final as (
    select d.*, case when d.grupo = 'perdida' and (select m.n from motivos m where m.detalle = d.detalle) > 5
                     then 'Otros motivos' else d.detalle end subgrupo
    from con_detalle d
  )
  select jsonb_build_object(
    'periodo', jsonb_build_object('desde', p_desde, 'hasta', p_hasta),
    'hoy', v_hoy,
    'vendedores', (select coalesce(jsonb_agg(to_jsonb(v) order by v.monto desc), '[]') from vendedores v),
    'totales', (select jsonb_object_agg(g, jsonb_build_object('monto', m, 'cotizaciones', n)) from (
                  select 'cotizado' g, coalesce(sum(monto), 0) m, count(*)::int n from final
                  union all select 'enviada', coalesce(sum(monto), 0), count(*)::int from final where grupo <> 'sin_enviar'
                  union all select x, coalesce(sum(f.monto), 0), count(f.id)::int
                  from unnest(array['sin_enviar', 'ganada', 'perdida', 'abierta', 'otra']) x left join final f on f.grupo = x group by x) t),
    -- Tasa de cierre: de lo que ya se decidió (ganado + perdido), qué parte se ganó.
    'tasa_cierre', (select jsonb_build_object(
                      'monto', round(sum(monto) filter (where grupo = 'ganada') / nullif(sum(monto) filter (where grupo in ('ganada', 'perdida')), 0), 4),
                      'cotizaciones', round(count(*) filter (where grupo = 'ganada')::numeric / nullif(count(*) filter (where grupo in ('ganada', 'perdida')), 0), 4))
                    from final),
    'nodos', (select coalesce(jsonb_agg(jsonb_build_object('grupo', grupo, 'subgrupo', subgrupo, 'monto', m, 'cotizaciones', n) order by grupo, m desc), '[]')
              from (select grupo, subgrupo, sum(monto) m, count(*)::int n from final group by 1, 2) z),
    'cotizaciones', (select coalesce(jsonb_agg(jsonb_build_object(
                       'id', id, 'folio', folio, 'version', version, 'versiones', versiones, 'fecha', fecha, 'cliente', cliente,
                       'vendedor', vendedor, 'monto', monto, 'estado', estado, 'grupo', grupo, 'subgrupo', subgrupo,
                       'motivo', motivo, 'que_paso', que_paso, 'seguimiento', seguimiento) order by monto desc), '[]') from final),
    'desde', (select min(fecha) from cotizaciones)
  ) into v_res;
  return v_res;
end $$;
revoke execute on function public.lo_cotizado(date, date, uuid) from public, anon;
grant execute on function public.lo_cotizado(date, date, uuid) to authenticated;

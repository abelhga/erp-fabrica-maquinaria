-- =============================================================================
-- Teléfono, fase 2: el ERP le dice al conmutador quién llama.
--
-- Por qué: con la fase 1 (258) el ERP ya se entera de cada llamada, pero la IA del teléfono
-- contestaba a ciegas. A un cliente de años le preguntaba su nombre como a cualquiera, lo pasaba
-- a quien tocara en la cola y no a su vendedor, y si preguntaba por su pedido solo podía tomar un
-- recado. Ahora, al empezar la llamada, el conmutador pregunta (GET /contexto en la función de
-- borde «telefono») y esta función le contesta en una sola consulta: quién es, quién es su
-- vendedor, qué pedidos tiene abiertos y cómo van, y qué cotizaciones siguen vivas.
--
-- Lo que sale de aquí lo oye quien llama, y quien llama puede no ser quien dice el número (un
-- teléfono prestado, un número reciclado). Por eso:
--   * nunca montos, precios, costos, RFC, direcciones, correos ni los otros contactos del cliente;
--   * el vendedor solo si su cartera sigue vigente y está activo (el mismo criterio con el que la
--     258 le da el lead al dueño): un vendedor que ya no lo atiende no debe recibir la llamada;
--   * el conmutador confirma nombre o empresa antes de usar nada (eso vive del lado de voz).
--
-- El avance se calcula aquí sobre las tablas, con la fórmula de 161 (horas terminadas más lo que
-- reportó el piso de lo que está en proceso, entre las horas totales; terminada o entregada es 100;
-- cancelada no cuenta) y el promedio por pedido de 197. No se usan v_pedidos_produccion,
-- pedidos_basicos ni pedido_de_orden: dependen de puede(), que sale de auth.uid(), y la función de
-- borde entra con la llave de servicio, sin usuario: con ellas todo saldría vacío.
--
-- Tiene que contestar en menos de 800 ms (si no, la llamada sigue sin contexto): todo va por
-- índice. El lead por teléfono necesitaba el suyo, y cliente_con_contacto revisaba todos los
-- contactos (abajo); con 8,000 contactos y 3,000 pedidos en local pasó de ~100 ms a 2–9 ms.
-- =============================================================================

create index if not exists leads_tel10_abiertos on public.leads (telefono10(telefono))
  where estado in ('nuevo', 'asignado');
create index if not exists contactos_correo_lower on public.contactos (lower(correo)) where correo is not null;

-- cliente_con_contacto de 256, igual por fuera, pero por índice. El «o» entre teléfono, WhatsApp y
-- correo obligaba a revisar todos los contactos (100 ms con 8,000, y crece con la cartera); ahora
-- cada forma va por su índice (contactos_tel10, contactos_wa10 y el del correo) y solo se juntan
-- los que coinciden. Si un contacto coincide por teléfono y otro del mismo cliente por correo,
-- gana «teléfono» (antes salía cualquiera de los dos).
create or replace function public.cliente_con_contacto(p_telefono text, p_correo text)
returns table (cliente_id uuid, nombre text, vendedor text, por text)
language sql stable security definer set search_path = public as $$
  select c.id, c.nombre, p.nombre, m.por
  from (
    select ct.cliente_id, 'teléfono' por from contactos ct
    where telefono10(ct.telefono) = telefono10(p_telefono)
    union all
    select ct.cliente_id, 'teléfono' from contactos ct
    where telefono10(ct.whatsapp) = telefono10(p_telefono)
    union all
    select ct.cliente_id, 'correo' from contactos ct
    where position('@' in lower(trim(coalesce(p_correo, '')))) > 1 and ct.correo is not null
      and lower(ct.correo) = lower(trim(p_correo))
  ) m
  join clientes c on c.id = m.cliente_id and c.activo
  left join perfiles p on p.id = c.vendedor_id
  order by c.creado_en, m.por = 'teléfono' desc
  limit 1
$$;
revoke execute on function public.cliente_con_contacto(text, text) from public, anon, authenticated;

create or replace function public.telefono_contexto(p_tel text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_tel text := telefono10(p_tel);
  v_cli record; v_dueno uuid; v_vig boolean;
  v_lead_nombre text; v_lead_interes text; v_lead_estado text; v_lead_vendedor uuid;
  v_vendedor jsonb; v_pedidos jsonb := '[]'; v_cots jsonb := '[]';
begin
  if v_tel is null then raise exception 'Teléfono inválido' using errcode = '22023'; end if;

  select * into v_cli from cliente_con_contacto(v_tel, null);

  if v_cli.cliente_id is not null then
    -- El dueño solo si lo sigue siendo (258:209-211).
    select v.vendedor_id, v.vigente into v_dueno, v_vig from vigencia_cliente(v_cli.cliente_id) v;
    if v_dueno is not null and v_vig then
      select jsonb_build_object('nombre', p.nombre, 'telefono', p.telefono) into v_vendedor
      from perfiles p where p.id = v_dueno and p.activo;
    end if;

    with ped as (
      select p.id, p.folio, p.estado, p.fecha, p.fecha_compromiso from pedidos p
      where p.cliente_id = v_cli.cliente_id and p.estado in ('confirmado', 'en_produccion', 'listo') and not p.historico
      order by p.fecha_compromiso nulls last, p.fecha, p.folio
      limit 5
    ),
    ords as (
      select o.id, o.pedido_id, o.folio, o.estado, o.en_espera_motivo is not null en_espera,
        case when o.estado in ('terminada', 'entregada') then 100
             when h.totales = 0 then 0
             else round(100 * (h.terminadas + h.avanzadas) / h.totales) end avance
      from ped join ordenes_produccion o on o.pedido_id = ped.id and o.estado <> 'cancelada'
      cross join lateral (
        select coalesce(sum(x.horas_estimadas), 0) totales,
          coalesce(sum(x.horas_estimadas) filter (where x.estado = 'terminada'), 0) terminadas,
          coalesce(sum(x.horas_estimadas * x.avance) filter (where x.estado in ('en_proceso', 'pausada')), 0) avanzadas
        from op_operaciones x where x.orden_id = o.id) h
    )
    select coalesce(jsonb_agg(jsonb_build_object(
        'folio', ped.folio,
        'que_es', case when length(q.que_es) > 80 then left(q.que_es, 79) || '…' else q.que_es end,
        'estado', case ped.estado when 'confirmado' then 'Confirmado' when 'en_produccion' then 'En producción'
                                  else 'Listo para entregar' end,
        'etapa', et.etapa,
        'avance', a.avance,
        'en_espera', coalesce(a.en_espera, false),
        'fecha_compromiso', ped.fecha_compromiso,
        'atrasado', coalesce(ped.fecha_compromiso < hoy_planta() and ped.estado <> 'listo', false))
      order by ped.fecha_compromiso nulls last, ped.fecha, ped.folio), '[]')
    into v_pedidos
    from ped
    -- Qué es, sin precios: los títulos de las partidas; si no hay, los equipos de sus órdenes.
    left join lateral (
      select coalesce(
        (select string_agg(coalesce(nullif(btrim(trim(l.titulo), '"'), ''), ar.nombre), ', ' order by l.orden)
         from pedido_lineas l left join articulos ar on ar.id = l.articulo_id where l.pedido_id = ped.id),
        (select string_agg(ar.nombre, ', ' order by o.folio)
         from ords o join ordenes_produccion op on op.id = o.id join articulos ar on ar.id = op.articulo_id
         where o.pedido_id = ped.id)) que_es) q on true
    left join lateral (
      select round(avg(o.avance))::int avance, bool_or(o.en_espera) en_espera
      from ords o where o.pedido_id = ped.id having count(*) > 0) a on true
    -- La etapa de la orden más atrasada que no ha terminado: la que está trabajando (en proceso o
    -- pausada) y, si ya arrancó pero entre etapas, la que sigue. Planeada aún no está en ninguna.
    left join lateral (
      select coalesce(
        (select e.nombre from op_operaciones x join etapas e on e.id = x.etapa_id
         where x.orden_id = o.id and x.estado in ('en_proceso', 'pausada') order by e.orden limit 1),
        case when o.estado in ('liberada', 'en_proceso') then
          (select e.nombre from op_operaciones x join etapas e on e.id = x.etapa_id
           where x.orden_id = o.id and x.estado = 'pendiente' order by e.orden limit 1) end) etapa
      from ords o where o.pedido_id = ped.id and o.estado not in ('terminada', 'entregada')
      order by o.avance, o.folio limit 1) et on true;

    -- Vivas: autorizadas o enviadas y dentro de su vigencia. Un folio BORRADOR- nunca salió.
    select coalesce(jsonb_agg(jsonb_build_object('folio', c.folio, 'fecha', c.fecha, 'vence', c.vence)
      order by c.fecha desc, c.folio desc), '[]')
    into v_cots
    from (select c.folio, c.fecha, c.fecha + c.vigencia_dias vence from cotizaciones c
          where c.cliente_id = v_cli.cliente_id and c.estado in ('autorizada', 'enviada')
            and c.fecha + c.vigencia_dias >= hoy_mx() and c.folio not like 'BORRADOR-%'
          order by c.fecha desc, c.folio desc limit 5) c;
  else
    -- No es cliente: un lead abierto con ese teléfono, o el de una llamada anterior del mismo
    -- número. El asignado primero (ya tiene quién lo atienda), y el más nuevo.
    select l.nombre, l.interes, l.estado, l.vendedor_id into v_lead_nombre, v_lead_interes, v_lead_estado, v_lead_vendedor
    from leads l
    where l.estado in ('nuevo', 'asignado') and l.id in (
      select x.id from leads x where telefono10(x.telefono) = v_tel and x.estado in ('nuevo', 'asignado')
      union
      select ll.lead_id from llamadas ll where ll.telefono10 = v_tel and ll.lead_id is not null)
    order by l.estado = 'asignado' desc, l.creado_en desc
    limit 1;
    if v_lead_estado = 'asignado' then
      select jsonb_build_object('nombre', p.nombre, 'telefono', p.telefono) into v_vendedor
      from perfiles p where p.id = v_lead_vendedor and p.activo;
    end if;
  end if;

  return jsonb_build_object(
    'ok', true,
    'conocido', v_cli.cliente_id is not null or v_lead_nombre is not null,
    'cliente', case when v_cli.cliente_id is not null then jsonb_build_object('nombre', v_cli.nombre) end,
    'lead', case when v_lead_nombre is not null then jsonb_build_object('nombre', v_lead_nombre, 'interes', v_lead_interes) end,
    'vendedor', v_vendedor,
    'pedidos', v_pedidos,
    'cotizaciones', v_cots);
end $$;
revoke execute on function public.telefono_contexto(text) from public, anon, authenticated;
grant execute on function public.telefono_contexto(text) to service_role;

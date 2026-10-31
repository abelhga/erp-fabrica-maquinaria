-- =============================================================================
-- Facturas anteriores: lo cancelado no cuenta.
--
-- En Drive, finanzas guarda las facturas canceladas en su propia carpeta («…/TRANSBELT/CANCELADAS»),
-- pero 215 las cargó como vigentes. Son 89 (38 recibidas, 51 emitidas). La 6652 de Transbelt, mal
-- timbrada por $20.6 millones (4,217 cajas de grapa), salía como lo más grande «sin amarrar»; y 9
-- canceladas se habían quedado con el renglón de la hoja que era de la factura que las reemplazó.
--
-- Ahora: lo que viene de una carpeta «cancelada(s)/cancelado(s)» queda cancelado al cargarlo;
-- finanzas puede marcar a mano una que el SAT dice cancelada y no estaba en esa carpeta. Lo
-- cancelado no se amarra, no cuenta en el resumen y suelta su renglón para la factura buena.
-- =============================================================================

alter table public.cfdi_historico add column if not exists cancelada boolean not null default false;

-- Por la carpeta: nunca la desmarca (una marcada a mano se queda así).
create or replace function public.cfdi_cancelada_por_carpeta() returns trigger language plpgsql as $$
begin
  if coalesce(new.carpeta, '') ~* '(^|/)cancelad[ao]s?(/|$)' then new.cancelada := true; end if;
  return new;
end $$;
drop trigger if exists cancelada_por_carpeta on public.cfdi_historico;
create trigger cancelada_por_carpeta before insert or update of carpeta on public.cfdi_historico
  for each row execute function public.cfdi_cancelada_por_carpeta();

-- Lo cancelado no tiene renglón ni amarre (se calcula aparte de la carga para poder llamarlo desde
-- aquí y desde la pantalla).
create or replace function public.amarrar_cfdi_interno(p_uuids text[] default null) returns int
language plpgsql security definer set search_path = public, extensions as $$
declare c cfdi_historico; b record; s record; v_n int := 0;
begin
  update cfdi_historico x set proveedor_id = p.id
  from proveedores p
  where x.rol = 'recibida' and x.proveedor_id is null and upper(trim(p.rfc)) = x.emisor_rfc
    and (p_uuids is null or x.uuid = any(p_uuids));
  update cfdi_historico x set cliente_id = cl.id
  from clientes cl
  where x.rol = 'emitida' and x.cliente_id is null and upper(trim(cl.rfc)) = x.receptor_rfc
    and (p_uuids is null or x.uuid = any(p_uuids));

  -- Sin lista: solo lo que falta (sin renglón de la hoja o sin categoría), para no repasar lo amarrado.
  -- Lo cancelado no se amarra: su renglón es de la factura que la reemplazó.
  for c in select * from cfdi_historico x
           where not x.cancelada and ((p_uuids is not null and x.uuid = any(p_uuids))
              or (p_uuids is null and ((x.tipo = 'I' and x.hoja_compra_id is null and x.hoja_compra_2018_id is null and x.hoja_venta_id is null)
                                       or (x.rol = 'recibida' and x.categoria_origen is distinct from 'clave_sat'))))
           order by x.fecha, x.uuid loop
    if c.rol = 'recibida' and c.tipo = 'I' and c.hoja_compra_id is null and c.hoja_compra_2018_id is null then
      select * into b from cfdi_buscar_compra_hoja(c);
      if b.hoja_id is not null then
        update cfdi_historico set amarre = b.como,
          hoja_compra_id = case when not b.de_2018 then b.hoja_id end,
          hoja_compra_2018_id = case when b.de_2018 then b.hoja_id end
        where uuid = c.uuid;
        v_n := v_n + 1;
      end if;
    elsif c.rol = 'emitida' and c.tipo = 'I' and c.hoja_venta_id is null then
      select h.id into b from historial_ventas_hoja h
      where h.tipo = 'Venta' and h.fecha between c.fecha - 60 and c.fecha + 60
        and folio_comparable(h.factura) in (folio_comparable(coalesce(c.serie, '') || coalesce(c.folio, '')), folio_comparable(c.folio))
        and not exists (select 1 from cfdi_historico o where o.hoja_venta_id = h.id)
      order by abs(h.fecha - c.fecha) limit 1;
      if b.id is not null then
        update cfdi_historico set hoja_venta_id = b.id, amarre = 'folio' where uuid = c.uuid;
        v_n := v_n + 1;
      end if;
    end if;

    -- Qué se compró: lo que dicen sus claves del SAT; si no dicen nada, el proveedor.
    if c.rol = 'recibida' and c.tipo in ('I', 'E') and c.categoria_origen is distinct from 'clave_sat' then
      -- Sin persona (esta misma migración) sugerir_categoria_sat no deja: se queda la categoría que ya tenía.
      begin
        select x.categoria into s from sugerir_categoria_sat(c.claves_sat,
          array(select coalesce((e->>'importe')::numeric, 0) from jsonb_array_elements(c.conceptos) e)) x
        order by x.peso desc nulls last limit 1;
      exception when insufficient_privilege then continue;
      end;
      if s.categoria is not null then
        update cfdi_historico set categoria = s.categoria, categoria_origen = 'clave_sat' where uuid = c.uuid;
      else
        update cfdi_historico x set categoria = coalesce(
            (select k.categoria from compras_hoja_categoria k join historial_compras_hoja h on h.proveedor_llave = k.proveedor_llave where h.id = x.hoja_compra_id),
            (select k.categoria from compras_hoja_categoria k join historial_compras_2018_2021 h on h.proveedor_llave = k.proveedor_llave where h.id = x.hoja_compra_2018_id),
            (select nullif(trim(p.categoria), '') from proveedores p where p.id = x.proveedor_id)),
          categoria_origen = 'proveedor'
        where x.uuid = c.uuid and x.categoria_origen is null;
      end if;
    end if;
  end loop;
  return v_n;
end $$;
revoke execute on function public.amarrar_cfdi_interno(text[]) from public, anon, authenticated;

create or replace function public.amarrar_cfdi_historico(p_uuids text[] default null) returns int
language plpgsql security definer set search_path = public as $$
begin
  if not puede('finanzas', 2) then raise exception 'Cargar facturas anteriores es de finanzas' using errcode = '42501'; end if;
  return amarrar_cfdi_interno(p_uuids);
end $$;
revoke execute on function public.amarrar_cfdi_historico(text[]) from public, anon;
grant execute on function public.amarrar_cfdi_historico(text[]) to authenticated;

-- A mano: la que el SAT dice cancelada (o la que se marcó por error). Al cancelarla suelta su
-- renglón y se vuelven a amarrar las de ese proveedor o cliente que siguen sueltas.
create or replace function public.marcar_cfdi_cancelada(p_uuid text, p_cancelada boolean) returns int
language plpgsql security definer set search_path = public as $$
declare c cfdi_historico; v_otras text[];
begin
  if not puede('finanzas', 2) then raise exception 'Esto lo marca finanzas' using errcode = '42501'; end if;
  update cfdi_historico set cancelada = coalesce(p_cancelada, true),
    hoja_compra_id = case when p_cancelada then null else hoja_compra_id end,
    hoja_compra_2018_id = case when p_cancelada then null else hoja_compra_2018_id end,
    hoja_venta_id = case when p_cancelada then null else hoja_venta_id end,
    amarre = case when p_cancelada then null else amarre end
  where uuid = upper(trim(p_uuid)) returning * into c;
  if c.uuid is null then raise exception 'No existe esa factura'; end if;
  select array_agg(uuid) into v_otras from cfdi_historico x
  where not x.cancelada and x.hoja_compra_id is null and x.hoja_compra_2018_id is null and x.hoja_venta_id is null
    and (x.uuid = c.uuid or (c.rol = 'recibida' and x.emisor_rfc = c.emisor_rfc) or (c.rol = 'emitida' and x.receptor_rfc = c.receptor_rfc))
    and x.fecha between c.fecha - 90 and c.fecha + 90;
  return coalesce(amarrar_cfdi_interno(coalesce(v_otras, '{}')), 0);
end $$;
revoke execute on function public.marcar_cfdi_cancelada(text, boolean) from public, anon;
grant execute on function public.marcar_cfdi_cancelada(text, boolean) to authenticated;

create or replace function public.resumen_cfdi_historico() returns jsonb
language sql stable security definer set search_path = public as $$
  select case when not puede('finanzas', 1) then null else jsonb_build_object(
    'total', (select count(*) from cfdi_historico),
    'canceladas', (select count(*) from cfdi_historico where cancelada),
    'por_anio', coalesce((select jsonb_agg(z order by z.anio desc) from (
      select a.anio,
        (select count(*) from cfdi_historico c where not c.cancelada and extract(year from c.fecha) = a.anio and c.rol = 'recibida' and c.tipo = 'I') recibidas,
        (select count(*) from cfdi_historico c where not c.cancelada and extract(year from c.fecha) = a.anio and c.rol = 'recibida' and c.tipo = 'I'
           and (c.hoja_compra_id is not null or c.hoja_compra_2018_id is not null)) recibidas_amarradas,
        (select count(*) from cfdi_historico c where not c.cancelada and extract(year from c.fecha) = a.anio and c.rol = 'recibida' and c.categoria_origen = 'clave_sat') con_clave_sat,
        (select count(*) from cfdi_historico c join historial_compras_hoja h on h.id = c.hoja_compra_id
           where not c.cancelada and extract(year from c.fecha) = a.anio and nullif(trim(h.orden), '') is not null) con_orden,
        (select count(*) from cfdi_historico c where not c.cancelada and extract(year from c.fecha) = a.anio and c.rol = 'emitida' and c.tipo = 'I') emitidas,
        (select count(*) from cfdi_historico c where not c.cancelada and extract(year from c.fecha) = a.anio and c.rol = 'emitida' and c.hoja_venta_id is not null) emitidas_amarradas,
        (select count(*) from cfdi_historico c where not c.cancelada and extract(year from c.fecha) = a.anio and c.tipo = 'N') nomina,
        (select count(*) from cfdi_historico c where not c.cancelada and extract(year from c.fecha) = a.anio and c.tipo in ('P', 'E')) pagos_notas,
        (select count(*) from historial_compras_hoja h where h.tipo = 'Compra' and extract(year from h.fecha) = a.anio)
          + (select count(*) from historial_compras_2018_2021 h where extract(year from h.fecha) = a.anio) hoja_compras,
        (select count(*) from historial_ventas_hoja h where h.tipo = 'Venta' and extract(year from h.fecha) = a.anio) hoja_ventas
      from (select distinct extract(year from fecha)::int anio from cfdi_historico
            union select distinct extract(year from fecha)::int from historial_compras_hoja where tipo = 'Compra') a) z), '[]'),
    'sin_amarrar', coalesce((select jsonb_agg(z) from (
      select c.emisor_nombre proveedor, c.emisor_rfc rfc, count(*) n, round(sum(c.total * c.tipo_cambio)) monto
      from cfdi_historico c where not c.cancelada and c.rol = 'recibida' and c.tipo = 'I' and c.hoja_compra_id is null and c.hoja_compra_2018_id is null
      group by 1, 2 order by 4 desc limit 15) z), '[]')
  ) end
$$;

create or replace view public.v_cfdi_historico with (security_invoker = true) as
select c.uuid, c.rol, c.tipo, c.fecha, c.serie, c.folio, c.emisor_rfc, c.emisor_nombre, c.receptor_rfc, c.receptor_nombre,
  c.moneda, c.total, c.total * c.tipo_cambio as total_mxn, c.conceptos, c.carpeta, c.amarre, c.categoria, c.categoria_origen,
  coalesce(h.orden, h18.orden) as orden_hoja, coalesce(h.factura, h18.factura, v.factura) as factura_hoja,
  coalesce(h.fecha, h18.fecha, v.fecha) as fecha_hoja,
  c.hoja_compra_id is not null or c.hoja_compra_2018_id is not null or c.hoja_venta_id is not null as amarrada,
  c.cancelada
from public.cfdi_historico c
left join public.historial_compras_hoja h on h.id = c.hoja_compra_id
left join public.historial_compras_2018_2021 h18 on h18.id = c.hoja_compra_2018_id
left join public.historial_ventas_hoja v on v.id = c.hoja_venta_id;
grant select on public.v_cfdi_historico to authenticated;

-- Las que ya están cargadas: se marcan por su carpeta, sueltan su renglón y se vuelven a amarrar
-- las de esos mismos proveedores y clientes que quedaron sueltas.
update cfdi_historico set cancelada = true where carpeta ~* '(^|/)cancelad[ao]s?(/|$)';
update cfdi_historico set hoja_compra_id = null, hoja_compra_2018_id = null, hoja_venta_id = null, amarre = null
where cancelada and (hoja_compra_id is not null or hoja_compra_2018_id is not null or hoja_venta_id is not null);
select amarrar_cfdi_interno(coalesce((select array_agg(x.uuid) from cfdi_historico x
  where not x.cancelada and x.tipo = 'I' and x.hoja_compra_id is null and x.hoja_compra_2018_id is null and x.hoja_venta_id is null
    and exists (select 1 from cfdi_historico k where k.cancelada
                and ((k.rol = 'recibida' and x.emisor_rfc = k.emisor_rfc) or (k.rol = 'emitida' and x.receptor_rfc = k.receptor_rfc)))), '{}'));

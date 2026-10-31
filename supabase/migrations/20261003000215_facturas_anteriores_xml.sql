-- =============================================================================
-- Facturas anteriores al ERP: los XML de años pasados se cargan y se amarran a la historia.
--
-- Resultados ya cuenta las compras desde 2018 (las hojas, 201), pero de esas solo sabe a quién
-- se compró y le pone la categoría del proveedor: una compra en la ferretería cuenta como
-- «ferretería» aunque haya sido pintura para un equipo o un anuncio. Los XML que el despacho
-- guarda en Drive (FACTURAS/año/mes/Egresos e Ingresos/proveedor) dicen qué se compró, con la
-- clave del SAT de cada concepto, y de qué factura de venta era cada cobro.
--
-- 1. cfdi_historico guarda cada XML una vez (por su folio fiscal), recibido o emitido por
--    Hegamex (por el RFC de empresa_fiscal); los de otros RFC no se guardan.
-- 2. Se amarra solo:
--    · una factura recibida al renglón «Compra» del libro de la hoja del mismo proveedor (por
--      RFC, o por nombre parecido): primero por folio y monto parecido; si no, por monto exacto
--      y fecha cercana. De ahí sale su número de orden de compra de la hoja.
--    · una factura emitida a su venta del libro de ventas de la hoja, por serie y folio.
-- 3. La categoría de una factura recibida sale de sus claves del SAT (sugerir_categoria_sat,
--    204: lo que finanzas ya registró manda sobre el catálogo); si ninguna clave dice nada, la
--    del proveedor. compras_hoja (Resultados) usa la de la clave del SAT cuando el renglón tiene
--    su XML: así la historia dice en qué se gastó, igual que las compras del ERP con orden.
-- 4. Lo que no casa se queda cargado, sin amarre, para verlo y completar lo que falte (el RFC de
--    un proveedor, por ejemplo) y volver a amarrar.
-- =============================================================================

create table if not exists public.cfdi_historico (
  uuid text primary key check (uuid ~ '^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$'),
  rol text not null check (rol in ('recibida', 'emitida')),
  tipo text not null check (tipo in ('I', 'E', 'P', 'N', 'T')),
  fecha date not null,
  serie text, folio text,
  emisor_rfc text not null, emisor_nombre text,
  receptor_rfc text not null, receptor_nombre text,
  moneda text not null default 'MXN', tipo_cambio numeric(14,6) not null default 1,
  subtotal numeric(16,2), total numeric(16,2) not null,
  metodo_pago text, forma_pago text,
  conceptos jsonb not null default '[]' check (jsonb_typeof(conceptos) = 'array'),  -- [{clave, descripcion, cantidad, unidad, importe, codigo}]
  claves_sat text[] not null default '{}',
  carpeta text,                                   -- dónde venía (para encontrarla en Drive)
  proveedor_id uuid references public.proveedores(id) on delete set null,
  cliente_id uuid references public.clientes(id) on delete set null,
  hoja_compra_id bigint references public.historial_compras_hoja(id) on delete set null,
  hoja_compra_2018_id bigint references public.historial_compras_2018_2021(id) on delete set null,
  hoja_venta_id bigint references public.historial_ventas_hoja(id) on delete set null,
  amarre text check (amarre in ('folio', 'monto')),
  categoria text,
  categoria_origen text check (categoria_origen in ('clave_sat', 'proveedor')),
  cargado_por uuid default auth.uid() references public.perfiles(id),
  cargado_en timestamptz not null default now()
);
create index if not exists cfdi_historico_fecha on public.cfdi_historico (fecha);
create index if not exists cfdi_historico_rol on public.cfdi_historico (rol, tipo, fecha);
-- Un renglón de la hoja es una factura: no se amarra a dos XML.
create unique index if not exists cfdi_historico_hoja_compra on public.cfdi_historico (hoja_compra_id) where hoja_compra_id is not null;
create unique index if not exists cfdi_historico_hoja_2018 on public.cfdi_historico (hoja_compra_2018_id) where hoja_compra_2018_id is not null;
create unique index if not exists cfdi_historico_hoja_venta on public.cfdi_historico (hoja_venta_id) where hoja_venta_id is not null;
create index if not exists hist_compras_fecha on public.historial_compras_hoja (fecha);
create index if not exists hist_ventas_factura on public.historial_ventas_hoja (fecha) where tipo = 'Venta';

alter table public.cfdi_historico enable row level security;
drop policy if exists ver on public.cfdi_historico;
create policy ver on public.cfdi_historico for select to authenticated using ((select puede('finanzas', 1)));
revoke insert, update, delete on public.cfdi_historico from authenticated, anon;
grant select on public.cfdi_historico to authenticated;

-- Folio comparable: sin espacios, guiones ni ceros a la izquierda, en mayúsculas («A-0003355» = «A 3355»).
create or replace function public.folio_comparable(p text) returns text
language sql immutable as $$
  select nullif(regexp_replace(regexp_replace(upper(coalesce(p, '')), '[^A-Z0-9]', '', 'g'), '(^|(?<=[A-Z]))0+(?=[0-9])', '', 'g'), '')
$$;

-- El renglón de la hoja que corresponde a una factura recibida, o ninguno.
-- Candidatos: mismo proveedor (por id o por nombre parecido), ±60 días y libre.
--   folio: el folio (o serie+folio) aparece en la columna factura y el monto se parece (±3 % o $5);
--   monto: sin folio, el monto exacto (±$1) a 15 días o menos.
create or replace function public.cfdi_buscar_compra_hoja(c public.cfdi_historico)
returns table (hoja_id bigint, de_2018 boolean, como text)
language sql stable security definer set search_path = public, extensions as $$
  with x as (
    select folio_comparable(c.folio) f, folio_comparable(coalesce(c.serie, '') || coalesce(c.folio, '')) sf,
      c.total * c.tipo_cambio t, lower(sin_acentos(coalesce(c.emisor_nombre, ''))) nom
  ),
  cand as (
    select h.id, false de_2018, h.factura, h.monto, h.fecha, h.proveedor_id, h.proveedor_llave, nullif(trim(h.orden), '') is not null con_orden
    from historial_compras_hoja h
    where h.tipo = 'Compra' and h.fecha between c.fecha - 60 and c.fecha + 60
      and not exists (select 1 from cfdi_historico o where o.hoja_compra_id = h.id)
      -- Lo que finanzas marcó «no cuenta» (repetida o cancelada, 129/137) no es la compra.
      and not exists (select 1 from compras_hoja_repetidas r where r.tipo = 'Compra' and r.proveedor_llave = h.proveedor_llave
                      and r.fecha = h.fecha and r.monto = h.monto and coalesce(r.factura, '') = coalesce(h.factura, ''))
    union all
    select h.id, true, h.factura, h.monto, h.fecha, null, h.proveedor_llave, nullif(trim(h.orden), '') is not null
    from historial_compras_2018_2021 h
    where c.fecha <= '2022-02-28' and h.fecha between c.fecha - 60 and c.fecha + 60
      and not exists (select 1 from cfdi_historico o where o.hoja_compra_2018_id = h.id)
  ),
  mismo as (
    select k.*, folio_comparable(k.factura) kf from cand k, x
    where (c.proveedor_id is not null and k.proveedor_id = c.proveedor_id)
       or (length(x.nom) >= 4 and (k.proveedor_llave = x.nom or similarity(k.proveedor_llave, x.nom) >= 0.45
                                   or position(k.proveedor_llave in x.nom) = 1))
  )
  -- Si la hoja trae la misma factura dos veces, la que tiene orden de compra y luego la más cercana.
  select z.id, z.de_2018, z.como from (
    select m.id, m.de_2018, 'folio' como, 0 prioridad, not m.con_orden sin_orden, abs(m.fecha - c.fecha) dias from mismo m, x
    where m.kf is not null and (m.kf = x.f or m.kf = x.sf or (length(x.f) >= 3 and position(x.f in m.kf) > 0))
      and abs(m.monto - x.t) <= greatest(5, 0.03 * abs(x.t))
    union all
    select m.id, m.de_2018, 'monto', 1, not m.con_orden, abs(m.fecha - c.fecha) from mismo m, x
    where abs(m.monto - x.t) <= 1 and abs(m.fecha - c.fecha) <= 15
  ) z
  order by z.prioridad, z.sin_orden, z.dias, z.id
  limit 1
$$;
revoke execute on function public.cfdi_buscar_compra_hoja(public.cfdi_historico) from public, anon, authenticated;

-- Amarra los XML dados (o todos los que no tienen amarre): proveedor o cliente por RFC, su
-- renglón de la hoja y la categoría de lo comprado.
create or replace function public.amarrar_cfdi_historico(p_uuids text[] default null) returns int
language plpgsql security definer set search_path = public, extensions as $$
declare c cfdi_historico; b record; s record; v_n int := 0;
begin
  if not puede('finanzas', 2) then raise exception 'Cargar facturas anteriores es de finanzas' using errcode = '42501'; end if;

  update cfdi_historico x set proveedor_id = p.id
  from proveedores p
  where x.rol = 'recibida' and x.proveedor_id is null and upper(trim(p.rfc)) = x.emisor_rfc
    and (p_uuids is null or x.uuid = any(p_uuids));
  update cfdi_historico x set cliente_id = cl.id
  from clientes cl
  where x.rol = 'emitida' and x.cliente_id is null and upper(trim(cl.rfc)) = x.receptor_rfc
    and (p_uuids is null or x.uuid = any(p_uuids));

  -- Sin lista: solo lo que falta (sin renglón de la hoja o sin categoría), para no repasar lo amarrado.
  for c in select * from cfdi_historico x
           where (p_uuids is not null and x.uuid = any(p_uuids))
              or (p_uuids is null and ((x.tipo = 'I' and x.hoja_compra_id is null and x.hoja_compra_2018_id is null and x.hoja_venta_id is null)
                                       or (x.rol = 'recibida' and x.categoria_origen is distinct from 'clave_sat')))
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
      select x.categoria into s from sugerir_categoria_sat(c.claves_sat,
        array(select coalesce((e->>'importe')::numeric, 0) from jsonb_array_elements(c.conceptos) e)) x
      order by x.peso desc nulls last limit 1;
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
revoke execute on function public.amarrar_cfdi_historico(text[]) from public, anon;
grant execute on function public.amarrar_cfdi_historico(text[]) to authenticated;

-- La carga: un lote de XML ya leídos en el navegador (lib/cfdi). Lo repetido no se vuelve a guardar.
create or replace function public.cargar_cfdi_historico(p_cfdis jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_rfc text := upper(trim((select valor->>'rfc' from configuracion where clave = 'empresa_fiscal')));
  e jsonb; v_uuid text; v_rol text; v_nuevas text[] := '{}'; v_rep int := 0; v_ajenas int := 0; v_malas int := 0; v_amarradas int;
begin
  if not puede('finanzas', 2) then raise exception 'Cargar facturas anteriores es de finanzas' using errcode = '42501'; end if;
  if coalesce(v_rfc, '') = '' then raise exception 'Falta el RFC de la empresa en Configuración (datos fiscales)'; end if;
  if jsonb_typeof(p_cfdis) <> 'array' or jsonb_array_length(p_cfdis) > 500 then raise exception 'Hasta 500 facturas por lote'; end if;
  for e in select * from jsonb_array_elements(p_cfdis) loop
    v_uuid := upper(trim(e->>'uuid'));
    if v_uuid !~ '^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$' or e->>'fecha' is null or e->>'total' is null
       or coalesce(e->>'tipo', '') not in ('I', 'E', 'P', 'N', 'T') then
      v_malas := v_malas + 1; continue;
    end if;
    v_rol := case when upper(e->>'emisor_rfc') = v_rfc then 'emitida' when upper(e->>'receptor_rfc') = v_rfc then 'recibida' end;
    if v_rol is null then v_ajenas := v_ajenas + 1; continue; end if;
    insert into cfdi_historico (uuid, rol, tipo, fecha, serie, folio, emisor_rfc, emisor_nombre, receptor_rfc, receptor_nombre,
      moneda, tipo_cambio, subtotal, total, metodo_pago, forma_pago, conceptos, claves_sat, carpeta)
    values (v_uuid, v_rol, e->>'tipo', (e->>'fecha')::date, nullif(trim(e->>'serie'), ''), nullif(trim(e->>'folio'), ''),
      upper(e->>'emisor_rfc'), nullif(trim(e->>'emisor_nombre'), ''), upper(e->>'receptor_rfc'), nullif(trim(e->>'receptor_nombre'), ''),
      coalesce(nullif(upper(e->>'moneda'), ''), 'MXN'), coalesce(nullif((e->>'tipo_cambio')::numeric, 0), 1),
      (e->>'subtotal')::numeric, (e->>'total')::numeric, nullif(e->>'metodo_pago', ''), nullif(e->>'forma_pago', ''),
      case when jsonb_typeof(e->'conceptos') = 'array' then e->'conceptos' else '[]' end,
      case when jsonb_typeof(e->'claves_sat') = 'array' then array(select jsonb_array_elements_text(e->'claves_sat')) else '{}' end,
      left(nullif(trim(e->>'carpeta'), ''), 300))
    on conflict (uuid) do nothing;
    if found then v_nuevas := v_nuevas || v_uuid; else v_rep := v_rep + 1; end if;
  end loop;
  v_amarradas := case when cardinality(v_nuevas) > 0 then amarrar_cfdi_historico(v_nuevas) else 0 end;
  return jsonb_build_object('nuevas', cardinality(v_nuevas), 'repetidas', v_rep, 'ajenas', v_ajenas, 'invalidas', v_malas, 'amarradas', v_amarradas);
end $$;
revoke execute on function public.cargar_cfdi_historico(jsonb) from public, anon;
grant execute on function public.cargar_cfdi_historico(jsonb) to authenticated;

-- Cuánto quedó cubierto, por año: lo que hay en XML, lo que se amarró y lo de la hoja que no tiene XML.
create or replace function public.resumen_cfdi_historico() returns jsonb
language sql stable security definer set search_path = public as $$
  select case when not puede('finanzas', 1) then null else jsonb_build_object(
    'total', (select count(*) from cfdi_historico),
    'por_anio', coalesce((select jsonb_agg(z order by z.anio desc) from (
      select a.anio,
        (select count(*) from cfdi_historico c where extract(year from c.fecha) = a.anio and c.rol = 'recibida' and c.tipo = 'I') recibidas,
        (select count(*) from cfdi_historico c where extract(year from c.fecha) = a.anio and c.rol = 'recibida' and c.tipo = 'I'
           and (c.hoja_compra_id is not null or c.hoja_compra_2018_id is not null)) recibidas_amarradas,
        (select count(*) from cfdi_historico c where extract(year from c.fecha) = a.anio and c.rol = 'recibida' and c.categoria_origen = 'clave_sat') con_clave_sat,
        (select count(*) from cfdi_historico c join historial_compras_hoja h on h.id = c.hoja_compra_id
           where extract(year from c.fecha) = a.anio and nullif(trim(h.orden), '') is not null) con_orden,
        (select count(*) from cfdi_historico c where extract(year from c.fecha) = a.anio and c.rol = 'emitida' and c.tipo = 'I') emitidas,
        (select count(*) from cfdi_historico c where extract(year from c.fecha) = a.anio and c.rol = 'emitida' and c.hoja_venta_id is not null) emitidas_amarradas,
        (select count(*) from cfdi_historico c where extract(year from c.fecha) = a.anio and c.tipo = 'N') nomina,
        (select count(*) from cfdi_historico c where extract(year from c.fecha) = a.anio and c.tipo in ('P', 'E')) pagos_notas,
        (select count(*) from historial_compras_hoja h where h.tipo = 'Compra' and extract(year from h.fecha) = a.anio)
          + (select count(*) from historial_compras_2018_2021 h where extract(year from h.fecha) = a.anio) hoja_compras,
        (select count(*) from historial_ventas_hoja h where h.tipo = 'Venta' and extract(year from h.fecha) = a.anio) hoja_ventas
      from (select distinct extract(year from fecha)::int anio from cfdi_historico
            union select distinct extract(year from fecha)::int from historial_compras_hoja where tipo = 'Compra') a) z), '[]'),
    'sin_amarrar', coalesce((select jsonb_agg(z) from (
      select c.emisor_nombre proveedor, c.emisor_rfc rfc, count(*) n, round(sum(c.total * c.tipo_cambio)) monto
      from cfdi_historico c where c.rol = 'recibida' and c.tipo = 'I' and c.hoja_compra_id is null and c.hoja_compra_2018_id is null
      group by 1, 2 order by 4 desc limit 15) z), '[]')
  ) end
$$;
revoke execute on function public.resumen_cfdi_historico() from public, anon;
grant execute on function public.resumen_cfdi_historico() to authenticated;

-- Resultados: el renglón de la hoja con XML cuenta por lo que se compró (clave del SAT).
create or replace function public.compras_hoja(p_desde date, p_hasta date)
returns table (fecha date, categoria text, importe numeric)
language sql stable security definer set search_path = public as $$
  with iva as (select coalesce((select (valor #>> '{}')::numeric from configuracion where clave = 'iva'), 0.16) t),
  h as (
    select h.fecha, h.proveedor_llave, h.proveedor_id, h.monto, h.factura,
      (select x.categoria from cfdi_historico x where x.hoja_compra_id = h.id and x.categoria_origen = 'clave_sat') cat_xml
    from historial_compras_hoja h
    where h.tipo = 'Compra' and h.fecha between p_desde and p_hasta
    union all
    select h.fecha, h.proveedor_llave, null, h.monto, h.factura,
      (select x.categoria from cfdi_historico x where x.hoja_compra_2018_id = h.id and x.categoria_origen = 'clave_sat')
    from historial_compras_2018_2021 h
    where h.fecha between p_desde and p_hasta
  )
  select h.fecha, coalesce(h.cat_xml, k.categoria, nullif(trim(pr.categoria), ''), 'Sin categoría'),
    case when lower(trim(coalesce(h.factura, ''))) not in ('', '-', 's/f', 'sf', 'n/a') then h.monto / (1 + iva.t) else h.monto end
  from h cross join iva
  left join compras_hoja_categoria k on k.proveedor_llave = h.proveedor_llave
  left join proveedores pr on pr.id = h.proveedor_id
$$;

-- Dónde están los PDF de las órdenes de compra anteriores al ERP (Drive de compras, «número
-- proveedor.pdf»): la pantalla abre la búsqueda de ese número dentro de la carpeta.
insert into public.configuracion (clave, valor, descripcion) values
  ('drive_ordenes_compra', '{"carpeta": "1WSpDOTO-6Y7K1z5eSEw1MfESThYhhe8N"}',
   'Carpeta de Drive con los PDF de las órdenes de compra de antes del ERP («4403 PROVEEDOR.pdf»).')
on conflict (clave) do nothing;

-- La lista de la pantalla, con la orden de compra y la factura que dice la hoja.
create or replace view public.v_cfdi_historico with (security_invoker = true) as
select c.uuid, c.rol, c.tipo, c.fecha, c.serie, c.folio, c.emisor_rfc, c.emisor_nombre, c.receptor_rfc, c.receptor_nombre,
  c.moneda, c.total, c.total * c.tipo_cambio as total_mxn, c.conceptos, c.carpeta, c.amarre, c.categoria, c.categoria_origen,
  coalesce(h.orden, h18.orden) as orden_hoja, coalesce(h.factura, h18.factura, v.factura) as factura_hoja,
  coalesce(h.fecha, h18.fecha, v.fecha) as fecha_hoja,
  c.hoja_compra_id is not null or c.hoja_compra_2018_id is not null or c.hoja_venta_id is not null as amarrada
from public.cfdi_historico c
left join public.historial_compras_hoja h on h.id = c.hoja_compra_id
left join public.historial_compras_2018_2021 h18 on h18.id = c.hoja_compra_2018_id
left join public.historial_ventas_hoja v on v.id = c.hoja_venta_id;
grant select on public.v_cfdi_historico to authenticated;

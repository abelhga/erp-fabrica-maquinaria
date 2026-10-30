-- =============================================================================
-- La categoría de una compra se sugiere con lo que dice la factura: la clave del SAT.
--
-- Cada concepto del XML trae su clave de producto o servicio del SAT (c_ClaveProdServ): 78101802
-- es flete por carretera, 31191500 abrasivos, 83101800 luz. Hasta hoy la categoría venía del
-- proveedor (a quién se compró) y no de lo comprado, y una factura sin orden de compra depende
-- solo de esa categoría para saber en qué se gastó (203). Ahora:
--
-- 1. Cada compra registrada con XML guarda las claves de sus conceptos (claves_sat).
-- 2. sugerir_categoria_sat pesa cada concepto por su importe. Para cada clave usa, en orden:
--    cómo registró finanzas esa misma clave antes (en compras sin orden, que es donde la
--    categoría manda) y, si nunca la ha visto, la tabla de arranque categoria_clave_sat.
--    01010101 («No existe en el catálogo») no dice nada y no cuenta.
-- 3. La tabla de arranque son 51 familias y clases revisadas una por una contra el catálogo
--    c_ClaveProdServ del SAT, cada una con el nombre que le da el SAT; no cubre todo, y lo que
--    finanzas registre manda sobre ella desde la primera vez.
-- =============================================================================

alter table public.movimientos_proveedor add column if not exists claves_sat text[];
comment on column public.movimientos_proveedor.claves_sat is
  'Claves de producto o servicio del SAT de los conceptos de la factura (del XML). Con ellas se sugiere la categoría de las siguientes.';

create table if not exists public.categoria_clave_sat (
  prefijo text primary key check (prefijo ~ '^[0-9]{2,8}$'),
  categoria text not null,
  descripcion text not null
);
comment on table public.categoria_clave_sat is
  'Categoría de compra de arranque por familia (4 dígitos), clase (6) o clave (8) del catálogo c_ClaveProdServ del SAT. Gana el prefijo más largo; lo que finanzas ya registró con esa clave manda sobre esto.';
alter table public.categoria_clave_sat enable row level security;
drop policy if exists ver on public.categoria_clave_sat;
create policy ver on public.categoria_clave_sat for select to authenticated using ((select puede('finanzas', 2)));
revoke insert, update, delete on public.categoria_clave_sat from authenticated, anon;

-- La descripción es la del SAT para ese prefijo (o la de sus claves, si el SAT no nombra la familia).
insert into public.categoria_clave_sat (prefijo, categoria, descripcion) values
  -- Del taller (gastos de fabricación)
  ('232718', 'Gases, soldadura, consumibles, etc.', 'Suministros para soldar, soldadura fuerte y soldadura blanda'),
  ('311915', 'Consumibles del taller', 'Abrasivos y medios de abrasivo'),
  ('311916', 'Consumibles del taller', 'Ruedas abrasivas'),
  ('271128', 'Consumibles del taller', 'Conexiones de herramientas y accesorios (brocas, discos)'),
  ('312119', 'Consumibles del taller', 'Aplicadores de pintura y accesorios para pintar'),
  ('471315', 'Consumibles del taller', 'Trapos y paños de limpieza'),
  ('2711', 'Ferreteria en general', 'Herramientas de mano'),
  ('4618', 'Equipo de seguridad para personal', 'Seguridad y protección personal'),
  ('4619', 'Extintores', 'Protección contra incendios'),
  ('531027', 'Uniformes', 'Uniformes'),
  ('831018', 'Luz (electricidad)', 'Servicios eléctricos'),
  ('731521', 'Reparación de equipos y maquinaria (torno, plasma, etc)', 'Servicios de mantenimiento y reparación de equipo de manufactura'),
  ('72154502', 'Gruas y Servicios de Maniobras', 'Servicio de mantenimiento y reparación de grúas'),
  ('72154503', 'Gruas y Servicios de Maniobras', 'Servicio de alquiler de grúas'),
  -- Vender y administrar (gastos de operación)
  ('7810', 'Fletes y paquetería (ambos)', 'Transporte de correo y carga'),
  ('781216', 'Fletes y paquetería (ambos)', 'Servicios de manejo de materiales (tarifa de los fletes)'),
  ('831015', 'Agua Potable', 'Servicios de acueducto y alcantarillado'),
  ('502023', 'Agua Potable', 'Bebidas no alcohólicas'),
  ('8311', 'Servicios de teléfono', 'Servicios de telecomunicaciones'),
  ('811121', 'Servicios de teléfono', 'Servicios de internet'),
  ('8210', 'Publicidad', 'Publicidad'),
  ('801315', 'Renta', 'Alquiler y arrendamiento de propiedades o edificaciones'),
  ('8411', 'Servicios Profesionales (varios)', 'Servicios contables'),
  ('8012', 'Servicios Profesionales (varios)', 'Servicios legales'),
  ('801015', 'Servicios Profesionales (varios)', 'Servicios de consultoría de negocios y administración corporativa'),
  ('8412', 'Bancos (Servicios Varios)', 'Instituciones bancarias'),
  ('9010', 'Alimentos', 'Restaurantes y catering'),
  ('9011', 'Hospedaje', 'Hoteles y moteles y pensiones'),
  ('95111602', 'Casetas', 'Carretera o autopista o autopista de peaje interestatal'),
  ('95111603', 'Casetas', 'Carretera o autopista o autopista de peaje interestatal'),
  ('861016', 'Servicios de capacitación', 'Servicios de capacitación vocacional científica'),
  ('861017', 'Servicios de capacitación', 'Servicios de capacitación vocacional no científica'),
  ('861320', 'Servicios de capacitación', 'Servicios de educación y capacitación en administración'),
  ('781815', 'Reparación de vehículos', 'Servicios de mantenimiento y reparación de vehículos'),
  ('251725', 'Llantas', 'Neumáticos y cámaras de neumáticos'),
  ('151015', 'Combustible (gasolina)', 'Petróleo y destilados'),
  ('4412', 'Consumibles oficina', 'Suministros de oficina'),
  ('141115', 'Consumibles oficina', 'Papel de imprenta y papel de escribir'),
  -- Material (entra al inventario; ya va en lo vendido)
  ('3010', 'Aceros', 'Componentes estructurales y formas básicas (ángulos, hoja, perfiles)'),
  ('302640', 'Aceros', 'Láminas de acero al carbón'),
  ('3116', 'Tornillería y relacionado', 'Ferretería (tornillos, tuercas, arandelas)'),
  ('311715', 'Rodamientos y chumaceras', 'Rodamientos'),
  ('261118', 'poleas, bujes etc.', 'Componentes de la transmisión'),
  ('261115', 'Motores y componentes afines', 'Transmisión de energía cinética'),
  ('2610', 'Motores y componentes afines', 'Fuentes de energía (motores)'),
  ('2612', 'Cables y accesorios', 'Alambres, cables y arneses'),
  ('3912', 'Material y suministros electricos', 'Equipos, suministros y componentes eléctricos'),
  ('3121', 'Pintura', 'Pinturas y bases y acabados'),
  ('241017', 'Bandas, mangas de hule y accesorios para bandas', 'Transportadores y accesorios'),
  ('271317', 'Cilindros, electrovalvulas, unidades de mant.', 'Cilindros neumáticos y componentes'),
  ('401516', 'Compresores', 'Compresores')
on conflict (prefijo) do update set categoria = excluded.categoria, descripcion = excluded.descripcion;

-- La categoría que sugiere lo que dice la factura. Una clave que finanzas ya registró manda; si
-- no, el prefijo más largo de la tabla de arranque. Cada concepto pesa lo que vale.
create or replace function public.sugerir_categoria_sat(p_claves text[], p_importes numeric[] default null)
returns table (categoria text, fuente text, clave text, descripcion text, peso numeric)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
begin
  if not puede('finanzas', 2) then raise exception 'Registrar compras es de finanzas' using errcode = '42501'; end if;
  return query
  with c as (
    select k clave, greatest(coalesce(i, 0), 0) importe
    from unnest(p_claves, coalesce(p_importes, '{}')) t(k, i)
    where k ~ '^[0-9]{8}$' and k <> '01010101'
  ),
  aprendida as (
    -- Solo compras sin orden de compra: con orden, la categoría es para lo que no tiene artículo.
    select x.clave, m.categoria, count(*) n, max(m.creado_en) ultima
    from movimientos_proveedor m cross join unnest(m.claves_sat) x(clave)
    where m.tipo = 'compra' and nullif(trim(m.categoria), '') is not null
      and x.clave in (select c.clave from c)
      and not exists (select 1 from compra_oc o where o.movimiento_id = m.id)
    group by 1, 2
  ),
  por_clave as (
    select c.clave, c.importe, coalesce(a.categoria, s.categoria) categoria,
      case when a.categoria is not null then 'aprendida' else 'catalogo' end fuente,
      case when a.categoria is null then s.descripcion end descripcion
    from c
    left join lateral (select a.categoria from aprendida a where a.clave = c.clave order by a.n desc, a.ultima desc limit 1) a on true
    left join lateral (select s.categoria, s.descripcion from categoria_clave_sat s where c.clave like s.prefijo || '%'
                       order by length(s.prefijo) desc limit 1) s on true
  )
  -- Si ningún concepto trae importe, cuenta cuántos son.
  select p.categoria, case when bool_or(p.fuente = 'aprendida') then 'aprendida' else 'catalogo' end,
    (array_agg(p.clave order by p.importe desc))[1], (array_agg(p.descripcion order by p.importe desc))[1],
    case when sum(p.importe) > 0 then sum(p.importe) else count(*) end
  from por_clave p where p.categoria is not null
  group by p.categoria
  order by 5 desc, 1
  limit 1;
end $$;
revoke execute on function public.sugerir_categoria_sat(text[], numeric[]) from public, anon;
grant execute on function public.sugerir_categoria_sat(text[], numeric[]) to authenticated;

-- La de 203 con un parámetro más al final: las claves del SAT de la factura (las llamadas por nombre siguen igual).
drop function if exists public.registrar_movimiento_proveedor(uuid, text, numeric, date, text, text, text, date, text, boolean, text, text, text, uuid[]);
create or replace function public.registrar_movimiento_proveedor(
  p_proveedor uuid, p_tipo text, p_monto numeric, p_fecha date default null, p_cuenta text default null,
  p_factura text default null, p_descripcion text default null, p_vence date default null,
  p_categoria text default null, p_anticipo boolean default false,
  p_cfdi_uuid text default null, p_metodo_pago text default null, p_leido_de text default null,
  p_ordenes uuid[] default null, p_claves_sat text[] default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_llave text; v_prov proveedores; v_fecha date := coalesce(p_fecha, hoy_planta()); v_saldo numeric; v_id uuid; v_ocs uuid[];
begin
  if not puede('finanzas', 2) then raise exception 'Solo finanzas registra compras y pagos a proveedores' using errcode = '42501'; end if;
  if coalesce(p_monto, 0) <= 0 then raise exception 'El monto tiene que ser mayor a cero' using errcode = '22023'; end if;
  if v_fecha > hoy_planta() then raise exception 'La fecha no puede ser futura' using errcode = '22023'; end if;
  if p_tipo not in ('compra', 'pago', 'reembolso_pendiente', 'reembolso_realizado') then
    raise exception 'Tipo de movimiento desconocido: %', p_tipo using errcode = '22023';
  end if;
  if p_leido_de is not null and p_leido_de not in ('xml', 'pdf', 'captura') then
    raise exception 'Origen de la factura desconocido: %', p_leido_de using errcode = '22023';
  end if;
  if p_tipo = 'pago' and p_cuenta is null then raise exception 'Di de qué cuenta salió el pago' using errcode = '22023'; end if;
  if p_cfdi_uuid is not null and exists (select 1 from movimientos_proveedor where cfdi_uuid = upper(trim(p_cfdi_uuid))) then
    raise exception 'Esa factura (folio fiscal %) ya está registrada', upper(trim(p_cfdi_uuid)) using errcode = '23505';
  end if;
  select * into v_prov from proveedores where id = p_proveedor;
  if not found then raise exception 'No existe ese proveedor' using errcode = '22023'; end if;
  -- De qué orden es: la que dijo quien registra o, si no dijo, la que casa por folio. Sin orden,
  -- la categoría es lo único que dice en qué se gastó: es obligatoria.
  if p_tipo = 'compra' then
    v_ocs := coalesce(p_ordenes, ordenes_por_folio(p_proveedor, p_factura, v_fecha));
    if cardinality(v_ocs) = 0 and coalesce(nullif(trim(p_categoria), ''), nullif(trim(v_prov.categoria), '')) is null then
      raise exception 'Sin orden de compra, la categoría es lo que dice en qué se gastó: elígela' using errcode = '22023';
    end if;
  end if;
  -- La llave del libro de la hoja, para que hoja y ERP sumen en el mismo renglón.
  v_llave := coalesce(
    (select proveedor_llave from historial_compras_hoja where proveedor_id = p_proveedor order by fecha desc limit 1),
    (select proveedor_llave from movimientos_proveedor where proveedor_id = p_proveedor limit 1),
    case when v_prov.legacy_id like 'PROV:%' then substr(v_prov.legacy_id, 6) end,
    'erp:' || p_proveedor::text);
  perform pg_advisory_xact_lock(hashtext('movimiento_proveedor:' || v_llave));
  if p_tipo = 'pago' and not p_anticipo then
    select saldo into v_saldo from v_saldo_arranque_proveedores where proveedor_llave = v_llave;
    if p_monto > coalesce(v_saldo, 0) + 0.5 then
      raise exception 'El pago (%) es mayor que lo que se le debe (%): si es un anticipo, márcalo como anticipo',
        to_char(p_monto, 'FM$999,999,990.00'), to_char(greatest(coalesce(v_saldo, 0), 0), 'FM$999,999,990.00') using errcode = '22023';
    end if;
  end if;
  insert into movimientos_proveedor (proveedor_id, proveedor_llave, tipo, fecha, monto, cuenta, categoria, factura, descripcion, vence_el,
    cfdi_uuid, metodo_pago, leido_de, claves_sat)
  values (p_proveedor, v_llave, p_tipo, v_fecha, round(p_monto, 2), p_cuenta,
    case when p_tipo = 'compra' then coalesce(nullif(trim(p_categoria), ''), v_prov.categoria) end,
    nullif(trim(p_factura), ''), nullif(trim(p_descripcion), ''),
    case when p_tipo = 'compra' then coalesce(p_vence, v_fecha + coalesce(v_prov.dias_credito, 0)) end,
    upper(nullif(trim(p_cfdi_uuid), '')), case when p_tipo = 'compra' then p_metodo_pago end,
    case when p_tipo in ('compra', 'reembolso_pendiente') then p_leido_de end,
    case when p_tipo in ('compra', 'reembolso_pendiente') then
      (select array_agg(distinct k order by k) from unnest(p_claves_sat) k where k ~ '^[0-9]{8}$') end)
  returning id into v_id;
  if cardinality(v_ocs) > 0 then
    perform poner_ligas_compra(v_id, v_ocs, case when p_ordenes is null then 'folio' else 'a_mano' end);
  end if;
  return v_id;
end $$;
revoke execute on function public.registrar_movimiento_proveedor(uuid, text, numeric, date, text, text, text, date, text, boolean, text, text, text, uuid[], text[]) from public, anon;
grant execute on function public.registrar_movimiento_proveedor(uuid, text, numeric, date, text, text, text, date, text, boolean, text, text, text, uuid[], text[]) to authenticated;

notify pgrst, 'reload schema';

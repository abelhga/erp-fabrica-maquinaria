-- =============================================================================
-- Orden de compra desde la cotización del proveedor.
--
-- Por qué: compras recibe la cotización en PDF y la vuelve a teclear partida por
-- partida en la orden (y otra vez en "Actualizar precios"). Claude lee la cotización
-- (función asistente, documento "cotizacion_proveedor"); aquí se empareja cada
-- partida con su artículo y se crea la orden en borrador con lo que compras revisó.
--
-- La clave con que el proveedor llama a cada artículo se recuerda (claves_proveedor):
-- la descripción de una cotización casi nunca se parece al nombre del catálogo, pero
-- la clave del proveedor es la misma cada vez. La segunda cotización ya llega
-- emparejada. Esa tabla no lleva costos: los costos siguen en su módulo.
-- =============================================================================

create table if not exists public.claves_proveedor (
  proveedor_id uuid not null references public.proveedores(id) on delete cascade,
  clave text not null check (clave = upper(trim(clave)) and clave <> ''),
  articulo_id uuid not null references public.articulos(id) on delete cascade,
  descripcion text,
  actualizado_en timestamptz not null default now(),
  actualizado_por uuid default auth.uid() references public.perfiles(id),
  primary key (proveedor_id, clave)
);
comment on table public.claves_proveedor is
  'Cómo llama cada proveedor a nuestros artículos (su clave o número de parte). Se llena al crear órdenes desde cotizaciones.';
create index if not exists claves_proveedor_articulo on public.claves_proveedor (articulo_id);

alter table public.claves_proveedor enable row level security;
create policy ver on public.claves_proveedor for select to authenticated using ((select puede('compras', 1)));
create policy alta on public.claves_proveedor for insert to authenticated with check ((select puede('compras', 2)));
create policy cambiar on public.claves_proveedor for update to authenticated
  using ((select puede('compras', 2))) with check ((select puede('compras', 2)));
create policy borrar on public.claves_proveedor for delete to authenticated using ((select puede('compras', 2)));

-- Para comparar claves: "AB-12 34" y "ab1234" son la misma.
create or replace function public.clave_normal(t text) returns text
language sql immutable parallel safe as $$
  select nullif(upper(regexp_replace(coalesce(t, ''), '[\s\-_./]', '', 'g')), '')
$$;

-- Lo que leyó Claude → proveedor del catálogo y artículo de cada partida, para que
-- compras lo revise. No guarda nada. Si ya se eligió el proveedor, solo empareja.
--   p_partidas: [{descripcion, clave}]
--   origen de cada artículo: 'recordado' (la clave ya se usó con este proveedor),
--   'clave' (es la clave de nuestro catálogo o viene en el nombre del artículo) o
--   'sugerido' (por parecido del nombre, con los mismos números).
create or replace function public.preparar_cotizacion(p_partidas jsonb, p_proveedor uuid default null,
  p_nombre text default null, p_rfc text default null) returns jsonb
language plpgsql stable security invoker set search_path = public, extensions as $$
declare v_prov uuid := p_proveedor; v_res jsonb := '[]'; x record; v_clave text; v_art jsonb; v_origen text; v_busca text;
begin
  if not puede('compras', 2) then raise exception 'Las órdenes de compra las arma compras' using errcode = '42501'; end if;

  if v_prov is null and clave_normal(p_rfc) is not null then
    select id into v_prov from proveedores where activo and clave_normal(rfc) = clave_normal(p_rfc) order by creado_en limit 1;
  end if;
  if v_prov is null and nullif(trim(p_nombre), '') is not null then
    select p.id into v_prov from proveedores p
    where p.activo and (sin_acentos(p.nombre) % sin_acentos(p_nombre) or sin_acentos(coalesce(p.razon_social, '')) % sin_acentos(p_nombre))
    order by greatest(similarity(sin_acentos(p.nombre), sin_acentos(p_nombre)),
                      similarity(sin_acentos(coalesce(p.razon_social, '')), sin_acentos(p_nombre))) desc
    limit 1;
  end if;

  for x in select e.value as p, e.ordinality - 1 as i from jsonb_array_elements(coalesce(p_partidas, '[]')) with ordinality e loop
    v_clave := clave_normal(x.p->>'clave');
    v_art := null; v_origen := null;
    if v_prov is not null and v_clave is not null then
      select jsonb_build_object('id', a.id, 'clave', a.clave, 'nombre', a.nombre, 'unidad', a.unidad) into v_art
      from claves_proveedor k join articulos a on a.id = k.articulo_id
      where k.proveedor_id = v_prov and k.clave = v_clave and a.activo;
      if v_art is not null then v_origen := 'recordado'; end if;
    end if;
    if v_art is null and v_clave is not null then
      select jsonb_build_object('id', a.id, 'clave', a.clave, 'nombre', a.nombre, 'unidad', a.unidad) into v_art
      from articulos a where a.activo and clave_normal(a.clave) = v_clave limit 1;
      if v_art is not null then v_origen := 'clave'; end if;
    end if;
    -- La clave del proveedor dentro del nombre del artículo ("UCF 205-16" en "Chumacera
    -- 1" 4B pared UCF 205-16"): en este catálogo el modelo va en el nombre.
    -- Solo claves con número: "FLETE" como clave no es un número de parte, y caía en "Flete a Tulum".
    if v_art is null and length(v_clave) >= 4 and v_clave ~ '[0-9]' then
      select jsonb_build_object('id', a.id, 'clave', a.clave, 'nombre', a.nombre, 'unidad', a.unidad) into v_art
      from articulos a where a.activo and a.tipo in ('componente', 'materia_prima', 'servicio')
        and clave_normal(a.nombre) like '%' || v_clave || '%'
      order by length(a.nombre) limit 1;
      if v_art is not null then v_origen := 'clave'; end if;
    end if;
    v_busca := coalesce(nullif(trim(x.p->>'descripcion'), ''), x.p->>'clave');
    -- Sugerir solo si el nombre del catálogo está casi completo en la descripción
    -- del proveedor (que suele ser más larga): con menos, "Flete a planta" salía como
    -- "Flete a Tulum". Mejor sin sugerencia que una equivocada.
    if v_art is null and v_busca is not null then
      select jsonb_build_object('id', a.id, 'clave', a.clave, 'nombre', a.nombre, 'unidad', a.unidad) into v_art
      from articulos a
      where a.activo and a.tipo in ('componente', 'materia_prima', 'servicio')
        and word_similarity(sin_acentos(a.nombre), sin_acentos(v_busca)) >= 0.6
        -- Y que cada número del nombre (medidas, modelos) venga en la cotización: con
        -- palabras parecidas, "Chumacera 1/2" pared 4 barrenos" no es la UCF 205-16 de 1".
        and not exists (select 1 from regexp_matches(a.nombre, '\d+', 'g') n
                        where not n[1] = any(array(select (regexp_matches(v_busca, '\d+', 'g'))[1])))
      order by word_similarity(sin_acentos(a.nombre), sin_acentos(v_busca)) desc, similarity(sin_acentos(a.nombre), sin_acentos(v_busca)) desc
      limit 1;
      if v_art is not null then v_origen := 'sugerido'; end if;
    end if;
    v_res := v_res || jsonb_build_object('i', x.i, 'articulo', v_art, 'origen', v_origen);
  end loop;

  return jsonb_build_object(
    'proveedor', (select jsonb_build_object('id', p.id, 'nombre', p.nombre, 'categoria', p.categoria, 'pais', p.pais,
        'es_importacion', p.es_importacion, 'moneda', p.moneda, 'dias_entrega', p.dias_entrega, 'dias_credito', p.dias_credito)
      from proveedores p where p.id = v_prov),
    'partidas', v_res);
end $$;

-- La orden en borrador con lo que compras revisó. security invoker: la RLS de
-- órdenes y de costos aplica igual que en la pantalla.
--   p_partidas: [{articulo_id?, descripcion, clave?, cantidad, costo_unitario}]
--   p_recordar: guarda la clave del proveedor de cada partida con artículo.
--   p_actualizar_costos: el costo cotizado pasa al artículo (con historial,
--   origen "cotizacion_proveedor"); solo quien administra costos.
create or replace function public.crear_oc_desde_cotizacion(p_proveedor uuid, p_partidas jsonb,
  p_moneda public.moneda default null, p_condiciones text default null, p_dias_entrega int default null,
  p_notas text default null, p_recordar boolean default true, p_actualizar_costos boolean default false) returns uuid
language plpgsql security invoker set search_path = public as $$
declare v_prov proveedores; v_oc ordenes_compra; v_moneda moneda; v_def int; v_costos jsonb;
begin
  if not puede('compras', 2) then raise exception 'Las órdenes de compra las arma compras' using errcode = '42501'; end if;
  if p_actualizar_costos and not puede('costos', 2) then
    raise exception 'Actualizar el costo de los artículos es de quien administra costos' using errcode = '42501';
  end if;
  select * into v_prov from proveedores where id = p_proveedor;
  if v_prov.id is null then raise exception 'Elige al proveedor' using errcode = '22023'; end if;
  if jsonb_typeof(p_partidas) <> 'array' or jsonb_array_length(p_partidas) = 0 then
    raise exception 'La orden necesita al menos una partida' using errcode = '22023';
  end if;
  if exists (select 1 from jsonb_array_elements(p_partidas) x
             where coalesce((x->>'cantidad')::numeric, 0) <= 0 or coalesce((x->>'costo_unitario')::numeric, -1) < 0
                or (nullif(x->>'articulo_id', '') is null and nullif(trim(x->>'descripcion'), '') is null)) then
    raise exception 'Cada partida necesita cantidad, precio y artículo o descripción' using errcode = '22023';
  end if;

  v_moneda := coalesce(p_moneda, v_prov.moneda);
  v_def := coalesce((select (valor->>'dias_entrega_default')::int from configuracion where clave = 'reabasto'), 7);
  insert into ordenes_compra (proveedor_id, moneda, tipo_cambio, fecha_entrega, condiciones, notas)
  values (v_prov.id, v_moneda, tc(v_moneda), sumar_dias_habiles(current_date, coalesce(p_dias_entrega, v_prov.dias_entrega, v_def)),
          coalesce(nullif(trim(p_condiciones), ''),
                   case when v_prov.dias_credito > 0 then 'Crédito a ' || v_prov.dias_credito || ' días' else 'Contado' end),
          nullif(trim(p_notas), ''))
  returning * into v_oc;

  -- Con artículo, la partida lleva su nombre del catálogo (como armar_ordenes_compra);
  -- sin artículo, el texto del proveedor con su clave.
  insert into oc_lineas (orden_compra_id, articulo_id, descripcion, cantidad, costo_unitario)
  select v_oc.id, a.id,
    coalesce(a.nombre, concat_ws(' · ', nullif(trim(x.p->>'clave'), ''), trim(x.p->>'descripcion'))),
    (x.p->>'cantidad')::numeric, round((x.p->>'costo_unitario')::numeric, 4)
  from jsonb_array_elements(p_partidas) with ordinality x(p, n)
  left join articulos a on a.id = nullif(x.p->>'articulo_id', '')::uuid
  order by x.n;

  if p_recordar then
    insert into claves_proveedor (proveedor_id, clave, articulo_id, descripcion)
    select distinct on (clave_normal(x->>'clave')) v_prov.id, clave_normal(x->>'clave'), (x->>'articulo_id')::uuid, nullif(trim(x->>'descripcion'), '')
    from jsonb_array_elements(p_partidas) x
    where clave_normal(x->>'clave') is not null and nullif(x->>'articulo_id', '') is not null
    on conflict (proveedor_id, clave) do update set articulo_id = excluded.articulo_id, descripcion = excluded.descripcion,
      actualizado_en = now(), actualizado_por = auth.uid();
  end if;

  if p_actualizar_costos then
    select jsonb_agg(jsonb_build_object('articulo_id', y.articulo_id, 'costo', y.costo, 'moneda', v_moneda, 'proveedor_id', v_prov.id))
    into v_costos
    from (select distinct on (x->>'articulo_id') x->>'articulo_id' as articulo_id, (x->>'costo_unitario')::numeric as costo
          from jsonb_array_elements(p_partidas) x
          where nullif(x->>'articulo_id', '') is not null and (x->>'costo_unitario')::numeric > 0) y;
    if v_costos is not null then
      perform set_config('erp.origen_costo', 'cotizacion_proveedor', true);
      perform set_config('erp.referencia_costo', v_oc.folio, true);
      perform actualizar_costos(v_costos);
      perform set_config('erp.origen_costo', '', true);
      perform set_config('erp.referencia_costo', '', true);
    end if;
  end if;

  return v_oc.id;
end $$;

revoke execute on function public.preparar_cotizacion(jsonb, uuid, text, text),
  public.crear_oc_desde_cotizacion(uuid, jsonb, public.moneda, text, int, text, boolean, boolean) from public, anon;
grant execute on function public.preparar_cotizacion(jsonb, uuid, text, text),
  public.crear_oc_desde_cotizacion(uuid, jsonb, public.moneda, text, int, text, boolean, boolean) to authenticated;

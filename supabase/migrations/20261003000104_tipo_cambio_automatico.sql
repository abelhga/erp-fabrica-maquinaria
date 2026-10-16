-- =============================================================================
-- Tipo de cambio automático: el del día sale solo, y el costeo se mueve solo
-- cuando el cambio importa.
--
-- Por qué: el dólar se capturaba a mano y nadie lo hacía; en la nube seguía en
-- $18.50 desde el 3 de octubre, así que cobranza, pagos e importaciones convertían
-- con un dólar viejo. Pero el mismo tipo de cambio recalculaba costos y precios de
-- lista: tomarlo diario movería los precios de lo importado todos los días.
--
-- 1. El del día: el dólar del Diario Oficial (el FIX que publica Banxico, sin
--    llave ni registro) y el euro del Banco Central Europeo. pg_cron pide dos
--    veces cada día hábil (pg_net es asíncrono) y otra corrida guarda la respuesta.
--    Lo capturado a mano ese día no se pisa.
-- 2. El del costeo (configuracion.tipo_cambio_costeo): con él se costea lo
--    importado. Sigue al del día solo si se aleja 3% o más (tipo_cambio_umbral),
--    o cuando alguien captura uno a mano (eso es decidirlo). Al cambiar, el
--    disparador de configuracion recalcula costos y precios, como siempre.
-- =============================================================================

insert into public.configuracion (clave, valor, descripcion) values
  ('tipo_cambio_costeo', jsonb_build_object(
      'USD', coalesce((select valor from public.tipos_cambio where moneda = 'USD' order by fecha desc limit 1), 18.5),
      'EUR', coalesce((select valor from public.tipos_cambio where moneda = 'EUR' order by fecha desc limit 1), 20)),
   'Pesos por dólar y por euro con que se costea lo importado. Sigue al del día solo si se aleja más que tipo_cambio_umbral, o al capturar uno a mano.'),
  ('tipo_cambio_umbral', '0.03', 'Cuánto se tiene que mover el tipo de cambio del día (0.03 = 3%) para que el costeo lo siga y se recalculen precios.')
on conflict (clave) do nothing;

create or replace function public.tc_costeo(p_moneda public.moneda) returns numeric
language sql stable as $$
  select case when p_moneda = 'MXN' then 1 else
    coalesce((select (valor ->> p_moneda::text)::numeric from configuracion where clave = 'tipo_cambio_costeo'), tc(p_moneda)) end
$$;

-- recalcular_costos (061) con un solo cambio: los comprados se convierten con el del costeo.
create or replace function public.recalcular_costos(p_ids uuid[] default null) returns int
language plpgsql security definer set search_path = public as $$
declare v_nivel int; v_n int;
begin
  if to_regclass('pg_temp._niveles') is null then
    create temp table _niveles (id uuid primary key, nivel int) on commit drop;
    create temp table _afectados (id uuid primary key) on commit drop;
    create temp table _precios (articulo_id uuid primary key, precio numeric) on commit drop;
  end if;
  truncate _niveles; truncate _afectados; truncate _precios;

  if p_ids is null then
    -- Todo: nivel = camino más largo hacia abajo (los que no contienen fabricados son 0).
    insert into _niveles
    with recursive camino(id, prof) as (
      select a.id, 0 from articulos a where a.tipo in ('subensamble', 'equipo')
        and not exists (select 1 from bom_lineas b join articulos h on h.id = b.hijo_id
                        where b.padre_id = a.id and h.tipo in ('subensamble', 'equipo'))
      union
      select b.padre_id, c.prof + 1 from bom_lineas b join camino c on c.id = b.hijo_id where c.prof < 30
    )
    select id, max(prof) from camino group by id;
    insert into _afectados select id from articulos;
  else
    -- Solo lo afectado: los fabricados de la lista, los padres de los comprados de la
    -- lista, y todos sus ancestros. Nivel = distancia máxima desde el cambio, así un
    -- padre siempre se calcula después de cualquier hijo afectado.
    insert into _niveles
    with recursive arriba(id, d) as (
      select a.id, 0 from articulos a where a.id = any(p_ids) and a.tipo in ('subensamble', 'equipo')
      union
      select b.padre_id, 0 from bom_lineas b join articulos h on h.id = b.hijo_id
      where b.hijo_id = any(p_ids) and h.tipo not in ('subensamble', 'equipo')
      union
      select b.padre_id, arriba.d + 1 from bom_lineas b join arriba on b.hijo_id = arriba.id where arriba.d < 30
    )
    select id, max(d) from arriba group by id;
    insert into _afectados select unnest(p_ids) on conflict do nothing;
    insert into _afectados select id from _niveles on conflict do nothing;
  end if;

  -- Comprados: costo directo convertido a MXN (solo se escribe si cambió).
  insert into costos_calculados (articulo_id, costo_material, costo_mano_obra, costo_total, horas, sin_costo, costo_mas_viejo, calculado_en)
  select a.id, coalesce(c.costo * tc_costeo(c.moneda), 0), 0, coalesce(c.costo * tc_costeo(c.moneda), 0), 0,
         case when c.costo is null or c.costo = 0 then 1 else 0 end, c.actualizado_en, now()
  from articulos a join _afectados x on x.id = a.id left join costos_articulo c on c.articulo_id = a.id
  where a.tipo in ('componente', 'materia_prima', 'servicio')
  on conflict (articulo_id) do update set costo_material = excluded.costo_material, costo_mano_obra = 0,
    costo_total = excluded.costo_total, horas = 0, sin_costo = excluded.sin_costo,
    costo_mas_viejo = excluded.costo_mas_viejo, calculado_en = now()
  where (costos_calculados.costo_total, costos_calculados.sin_costo, costos_calculados.costo_mas_viejo)
    is distinct from (excluded.costo_total, excluded.sin_costo, excluded.costo_mas_viejo);

  -- Fabricados: nivel por nivel, cada uno suma lo de sus hijos ya calculados.
  for v_nivel in 0 .. coalesce((select max(nivel) from _niveles), -1) loop
    insert into costos_calculados (articulo_id, costo_material, costo_mano_obra, costo_total, horas, sin_costo, costo_mas_viejo, calculado_en)
    select n.id,
      coalesce(m.material, 0),
      coalesce(m.mano_obra_hijos, 0) + coalesce(o.costo, 0),
      coalesce(m.material, 0) + coalesce(m.mano_obra_hijos, 0) + coalesce(o.costo, 0),
      coalesce(m.horas_hijos, 0) + coalesce(o.horas, 0),
      coalesce(m.sin_costo, 0),
      m.mas_viejo,
      now()
    from _niveles n
    left join lateral (
      select sum(cantidad_linea(b) * cc.costo_material) material,
             sum(cantidad_linea(b) * cc.costo_mano_obra) mano_obra_hijos,
             sum(cantidad_linea(b) * cc.horas) horas_hijos,
             sum(cc.sin_costo)::int sin_costo,
             min(cc.costo_mas_viejo) mas_viejo
      from bom_lineas b join costos_calculados cc on cc.articulo_id = b.hijo_id
      where b.padre_id = n.id
    ) m on true
    left join lateral (
      select sum(horas_operacion(o)) horas, sum(horas_operacion(o) * coalesce(t.costo_hora, 0)) costo
      from bom_operaciones o left join tarifas_mano_obra t on t.etapa_id = o.etapa_id
      where o.articulo_id = n.id
    ) o on true
    where n.nivel = v_nivel
    on conflict (articulo_id) do update set costo_material = excluded.costo_material,
      costo_mano_obra = excluded.costo_mano_obra, costo_total = excluded.costo_total, horas = excluded.horas,
      sin_costo = excluded.sin_costo, costo_mas_viejo = excluded.costo_mas_viejo, calculado_en = now()
    where (costos_calculados.costo_total, costos_calculados.horas, costos_calculados.sin_costo, costos_calculados.costo_mas_viejo)
      is distinct from (excluded.costo_total, excluded.horas, excluded.sin_costo, excluded.costo_mas_viejo);
  end loop;

  -- Precios de lista de lo afectado: precio fijo si lo hay; si no, la fórmula de su política.
  insert into _precios
  select a.id, coalesce(c.precio_fijo, precio_desde_costo(cc.costo_total, politica_de(a.id), c.margen, a.medida_especial))
  from articulos a
  join _afectados x on x.id = a.id
  join costos_calculados cc on cc.articulo_id = a.id
  left join costos_articulo c on c.articulo_id = a.id
  where a.se_vende and a.activo;
  delete from _precios where precio is null;

  -- Foto de lo que cambió (costo o precio) respecto a la última registrada.
  insert into historial_costeo (articulo_id, costo_material, costo_mano_obra, costo_total, precio_lista, politica_id, utilidad, factor)
  select cc.articulo_id, cc.costo_material, cc.costo_mano_obra, cc.costo_total, n.precio, pol.id,
         coalesce(c.margen, pol.utilidad),
         case when cc.costo_total > 0 then precio_sin_redondeo(cc.costo_total, pol.id, c.margen, a.medida_especial) / cc.costo_total end
  from costos_calculados cc
  join _afectados x on x.id = cc.articulo_id
  join articulos a on a.id = cc.articulo_id
  left join _precios n on n.articulo_id = cc.articulo_id
  left join costos_articulo c on c.articulo_id = cc.articulo_id
  left join politicas_precio pol on pol.id = politica_de(cc.articulo_id)
  left join lateral (select h.costo_total, h.precio_lista from historial_costeo h
                     where h.articulo_id = cc.articulo_id order by h.en desc, h.id desc limit 1) u on true
  where (a.tipo in ('subensamble', 'equipo') or a.se_vende)
    and (u is null or u.costo_total is distinct from round(cc.costo_total, 4) or u.precio_lista is distinct from n.precio);

  insert into precios_lista (articulo_id, precio, moneda, calculado_en)
  select articulo_id, precio, 'MXN', now() from _precios
  on conflict (articulo_id) do update set precio = excluded.precio, calculado_en = now()
  where precios_lista.precio is distinct from excluded.precio;

  delete from precios_lista p using _afectados x
  where p.articulo_id = x.id and not exists (select 1 from _precios n where n.articulo_id = p.articulo_id);

  get diagnostics v_n = row_count;
  return v_n;
end $$;

-- Un tipo de cambio nuevo ya no recalcula por sí mismo: decide si el costeo lo sigue.
drop trigger if exists recalcular on public.tipos_cambio;
create or replace function public.revisar_tc_costeo() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_cfg jsonb := coalesce((select valor from configuracion where clave = 'tipo_cambio_costeo'), '{}');
        v_umbral numeric := coalesce((select (valor #>> '{}')::numeric from configuracion where clave = 'tipo_cambio_umbral'), 0.03);
        v_nuevo jsonb := v_cfg; r record;
begin
  for r in select distinct on (moneda) moneda::text as moneda, valor, fuente from tipos_cambio order by moneda, fecha desc loop
    if (v_cfg ->> r.moneda) is null
       or r.fuente = 'manual'
       or abs(r.valor / nullif((v_cfg ->> r.moneda)::numeric, 0) - 1) >= v_umbral then
      v_nuevo := v_nuevo || jsonb_build_object(r.moneda, r.valor);
    end if;
  end loop;
  if v_nuevo is distinct from v_cfg then
    -- El update dispara el recálculo de costos y precios (disparador de configuracion).
    update configuracion set valor = v_nuevo where clave = 'tipo_cambio_costeo';
  end if;
  return null;
end $$;
create trigger costeo after insert or update on public.tipos_cambio
  for each statement execute function public.revisar_tc_costeo();

-- Fijar a mano el del costeo (Márgenes y precios), sin tocar el del día que usan
-- cobranza y pagos. Los mismos que antes capturaban el tipo de cambio ahí.
create or replace function public.fijar_tc_costeo(p_moneda public.moneda, p_valor numeric) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not (puede('compras', 2) or puede('finanzas', 2)) then
    raise exception 'Solo compras o finanzas cambian el tipo de cambio' using errcode = '42501';
  end if;
  if p_moneda = 'MXN' or coalesce(p_valor, 0) <= 0 then raise exception 'Tipo de cambio inválido' using errcode = '22023'; end if;
  update configuracion set valor = valor || jsonb_build_object(p_moneda::text, round(p_valor, 4)) where clave = 'tipo_cambio_costeo';
end $$;
revoke execute on function public.fijar_tc_costeo(public.moneda, numeric) from public, anon;
grant execute on function public.fijar_tc_costeo(public.moneda, numeric) to authenticated;

-- ---------------------------------------------------------------------------
-- Tomarlo solo
-- ---------------------------------------------------------------------------
create table public.tipos_cambio_peticiones (
  id bigint primary key,            -- el id de la petición de pg_net
  fuente text not null check (fuente in ('DOF', 'BCE')),
  creado_en timestamptz not null default now()
);
alter table public.tipos_cambio_peticiones enable row level security;   -- solo las funciones la tocan

-- Lee la respuesta de una fuente y guarda los valores. Lo capturado a mano el mismo día se respeta.
create or replace function public.aplicar_tipo_cambio(p_fuente text, p_cuerpo jsonb) returns int
language plpgsql security definer set search_path = public as $$
declare v_n int := 0;
begin
  if p_fuente = 'DOF' then
    -- {"ListaIndicadores":[{"codTipoIndicador":158,"fecha":"15-10-2026","valor":"18.4888"}, …]}; 158 = dólar.
    insert into tipos_cambio (fecha, moneda, valor, fuente)
    select to_date(i ->> 'fecha', 'DD-MM-YYYY'), 'USD', (i ->> 'valor')::numeric, 'DOF'
    from jsonb_array_elements(coalesce(p_cuerpo -> 'ListaIndicadores', '[]')) i
    where (i ->> 'codTipoIndicador')::int = 158 and (i ->> 'valor') ~ '^[0-9]+(\.[0-9]+)?$'
    on conflict (fecha, moneda) do update set valor = excluded.valor, fuente = excluded.fuente
      where tipos_cambio.fuente is distinct from 'manual' and tipos_cambio.valor is distinct from excluded.valor;
    get diagnostics v_n = row_count;
  elsif p_fuente = 'BCE' then
    -- {"base":"EUR","date":"2026-10-15","rates":{"MXN":20.7596}}
    if (p_cuerpo #>> '{rates,MXN}') ~ '^[0-9]+(\.[0-9]+)?$' then
      insert into tipos_cambio (fecha, moneda, valor, fuente)
      values ((p_cuerpo ->> 'date')::date, 'EUR', (p_cuerpo #>> '{rates,MXN}')::numeric, 'BCE')
      on conflict (fecha, moneda) do update set valor = excluded.valor, fuente = excluded.fuente
        where tipos_cambio.fuente is distinct from 'manual' and tipos_cambio.valor is distinct from excluded.valor;
      get diagnostics v_n = row_count;
    end if;
  end if;
  return v_n;
end $$;
revoke execute on function public.aplicar_tipo_cambio(text, jsonb) from public, anon, authenticated;

-- Pide los de la última semana (por si una corrida falló) y el euro del día.
create or replace function public.pedir_tipos_cambio() returns void
language plpgsql security definer set search_path = public as $$
declare v_desde text := to_char(hoy_planta() - 7, 'DD-MM-YYYY'); v_hasta text := to_char(hoy_planta(), 'DD-MM-YYYY');
begin
  insert into tipos_cambio_peticiones (id, fuente)
  values (net.http_get('https://sidof.segob.gob.mx/dof/sidof/indicadores/158/' || v_desde || '/' || v_hasta), 'DOF'),
         (net.http_get('https://api.frankfurter.dev/v1/latest?from=EUR&to=MXN'), 'BCE');
exception when others then
  raise notice 'No se pudo pedir el tipo de cambio: %', sqlerrm;
end $$;

-- Guarda lo que ya respondió y olvida lo de hace más de un día (si falló, mañana se vuelve a pedir).
create or replace function public.guardar_tipos_cambio() returns int
language plpgsql security definer set search_path = public as $$
declare r record; v_n int := 0;
begin
  for r in select p.id, p.fuente, h.status_code, h.content from tipos_cambio_peticiones p
           join net._http_response h on h.id = p.id loop
    if r.status_code = 200 then
      begin
        v_n := v_n + aplicar_tipo_cambio(r.fuente, r.content::jsonb);
      exception when others then
        raise notice 'Respuesta de % que no se pudo leer: %', r.fuente, sqlerrm;
      end;
    end if;
    delete from tipos_cambio_peticiones where id = r.id;
  end loop;
  delete from tipos_cambio_peticiones where creado_en < now() - interval '1 day';
  return v_n;
end $$;
revoke execute on function public.pedir_tipos_cambio() from public, anon, authenticated;
revoke execute on function public.guardar_tipos_cambio() from public, anon, authenticated;

-- Días hábiles a las 08:07 y 13:07 de la planta (14:07 y 19:07 UTC, horario sin verano); se
-- guarda 5 minutos después. El DOF publica en la mañana; el BCE, a las 9 de México.
do $$ begin
  perform cron.schedule('tipo-cambio-pedir', '7 14,19 * * 1-5', 'select public.pedir_tipos_cambio()');
  perform cron.schedule('tipo-cambio-guardar', '12 14,19 * * 1-5', 'select public.guardar_tipos_cambio()');
exception when others then
  raise notice 'pg_cron no está disponible: el tipo de cambio se captura a mano (%).', sqlerrm;
end $$;

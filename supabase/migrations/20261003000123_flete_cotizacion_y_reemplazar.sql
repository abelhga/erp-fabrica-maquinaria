-- Tres cosas que pidió dirección al empezar a usar Skydropx y las listas de materiales:
--
-- 1. Cotizar el flete ANTES de que el cliente compre. Hasta ahora Skydropx solo cotizaba
--    un envío, y un envío nace de un pedido: el vendedor no tenía cómo poner el flete en la
--    cotización. Aquí salen los bultos de las partidas (con el empaque del artículo, igual
--    que al pedir el envío) y el recargo que se le suma a lo que cobra Skydropx.
-- 2. Reemplazar un componente en todas las listas donde va directo (se descontinuó, cambió
--    de proveedor), con las mismas cantidades. Es de nivel 3 de costeo: un error aquí mueve
--    el costo y el precio de muchos equipos a la vez.
-- 3. (El nombre de un equipo y el reemplazo en una sola lista ya los permite la RLS de
--    articulos y bom_lineas con costeo 2: no necesitan función.)

-- -----------------------------------------------------------------------------
-- 1. Bultos de una cotización
-- -----------------------------------------------------------------------------
-- La misma regla de prellenar_bultos: con empaque capturado, un bulto por cada paquete
-- (hasta 20); sin empaque, un bulto sin medidas que el vendedor completa. Servicios y
-- partidas libres (el propio flete, instalación) no se mandan.
create or replace function public.bultos_cotizacion(p_cotizacion uuid)
returns jsonb language plpgsql stable security invoker set search_path = public as $$
declare l record; v_n int; v_rest numeric; r jsonb := '[]';
begin
  for l in select cl.articulo_id, cl.titulo, cl.cantidad, a.paquete_kg, a.paquete_largo_cm, a.paquete_ancho_cm,
                  a.paquete_alto_cm, coalesce(a.paquete_piezas, 1) paquete_piezas
           from cotizacion_lineas cl join articulos a on a.id = cl.articulo_id
           where cl.cotizacion_id = p_cotizacion and not cl.opcional and a.tipo <> 'servicio' and cl.cantidad > 0
           order by cl.orden, cl.id loop
    if l.paquete_kg is not null and l.paquete_largo_cm is not null and l.paquete_ancho_cm is not null and l.paquete_alto_cm is not null then
      v_n := ceil(l.cantidad / l.paquete_piezas);
      if v_n <= 20 then
        v_rest := l.cantidad;
        for k in 1 .. v_n loop
          r := r || jsonb_build_object('contenido', l.titulo, 'piezas', least(l.paquete_piezas, v_rest), 'peso_kg', l.paquete_kg,
            'largo_cm', l.paquete_largo_cm, 'ancho_cm', l.paquete_ancho_cm, 'alto_cm', l.paquete_alto_cm);
          v_rest := v_rest - least(l.paquete_piezas, v_rest);
        end loop;
        continue;
      end if;
    end if;
    r := r || jsonb_build_object('contenido', l.titulo, 'piezas', l.cantidad, 'peso_kg', null, 'largo_cm', null, 'ancho_cm', null, 'alto_cm', null);
  end loop;
  return r;
end $$;

-- El recargo sobre lo que cobra Skydropx (sobrepesos, empaque). Lo fija quien administra
-- envíos; por omisión 15 %.
update configuracion set valor = valor || '{"recargo_flete": 0.15}'
where clave = 'skydropx' and not valor ? 'recargo_flete';

create or replace function public.fijar_config_skydropx(p_datos jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare v jsonb; v_cp text := nullif(trim(p_datos->>'carta_porte'), '');
begin
  if not puede('envios', 3) then raise exception 'La configuración de Skydropx es de quien administra envíos' using errcode = '42501'; end if;
  if v_cp is not null and v_cp !~ '^\d{8}$' then raise exception 'La clave de carta porte son 8 números (catálogo del SAT)'; end if;
  if p_datos ? 'formato' and p_datos->>'formato' not in ('standard', 'thermal') then raise exception 'Formato no válido'; end if;
  if p_datos ? 'recargo_flete' and ((p_datos->>'recargo_flete')::numeric < 0 or (p_datos->>'recargo_flete')::numeric > 2) then
    raise exception 'El recargo al flete va de 0 %% a 200 %%';
  end if;
  -- Bloquea antes de leer: cada cambio de configuración recalcula costos (segundos), y dos
  -- clics seguidos (origen, luego carta porte) leían la misma versión y el segundo borraba el primero.
  select valor into v from configuracion where clave = 'skydropx' for update;
  v := coalesce(v, '{}'::jsonb) || jsonb_strip_nulls(jsonb_build_object(
    'origen_plantilla_id', p_datos->'origen_plantilla_id', 'origen', p_datos->'origen',
    'carta_porte', to_jsonb(v_cp), 'tipo_empaque', to_jsonb(nullif(trim(p_datos->>'tipo_empaque'), '')),
    'formato', p_datos->'formato', 'recargo_flete', p_datos->'recargo_flete'));
  insert into configuracion (clave, valor) values ('skydropx', v)
  on conflict (clave) do update set valor = excluded.valor, actualizado_en = now();
end $$;

-- -----------------------------------------------------------------------------
-- 2. Reemplazar un componente en varias listas a la vez
-- -----------------------------------------------------------------------------
create or replace function public.reemplazar_componente(p_viejo uuid, p_nuevo uuid, p_padres uuid[])
returns int language plpgsql security definer set search_path = public as $$
declare v_viejo articulos; v_nuevo articulos; v_n int;
begin
  if not puede('costeo', 3) then
    raise exception 'Reemplazar en varias listas a la vez es de quien administra el catálogo (ingeniería)' using errcode = '42501';
  end if;
  select * into v_viejo from articulos where id = p_viejo;
  select * into v_nuevo from articulos where id = p_nuevo;
  if v_viejo.id is null or v_nuevo.id is null then raise exception 'No existe el artículo'; end if;
  if p_viejo = p_nuevo then raise exception 'Elige un artículo distinto'; end if;
  if not v_nuevo.activo then raise exception '% está inhabilitado', v_nuevo.clave; end if;
  if coalesce(cardinality(p_padres), 0) = 0 then raise exception 'Elige al menos una lista'; end if;
  -- Solo líneas directas: lo de adentro de un subensamble se cambia en el subensamble.
  -- El disparador evitar_ciclos rechaza si el nuevo contiene a alguno de los padres.
  update bom_lineas set hijo_id = p_nuevo, notas = concat_ws(' · ', nullif(notas, ''), 'antes ' || v_viejo.clave)
  where hijo_id = p_viejo and padre_id = any(p_padres);
  get diagnostics v_n = row_count;
  return v_n;
end $$;

revoke execute on function public.bultos_cotizacion(uuid), public.reemplazar_componente(uuid, uuid, uuid[]) from public, anon;
grant execute on function public.bultos_cotizacion(uuid), public.reemplazar_componente(uuid, uuid, uuid[]) to authenticated;

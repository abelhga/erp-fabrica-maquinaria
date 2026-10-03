-- =============================================================================
-- Apoyo a las pantallas de ingeniería y costeo.
--
-- El dueño pidió dos cosas que la hoja no puede hacer:
--  1. "Tiene componentes que a su vez arman subensambles que son exactamente
--     iguales, pero no existe eso de subensambles." Aquí se puede tomar un
--     grupo de líneas de un equipo y volverlo subensamble (extraer_subensamble),
--     o reconocer que esas líneas ya SON un subensamble que existe y
--     sustituirlas por él (subensambles_coincidentes + sustituir_por_subensamble).
--     Las dos operaciones dejan el costo idéntico: es reorganizar, no recostear.
--  2. Ver cómo se movió el costo y el precio a lo largo del tiempo, con y sin
--     los cambios de utilidad. El panel de márgenes simula antes de guardar
--     (simular_precios) y el detalle explica el precio con los números del
--     equipo (desglose_precio).
--
-- Además corrige cosas de migraciones anteriores que salieron al construir las
-- pantallas (cada una dice por qué):
--  * historial_costeo: las operaciones de varios pasos dejaban fotos
--    intermedias (la copia de una banda "costaba $0" un instante).
--  * duplicar_articulo: no copiaba "medida especial" y la copia salía más barata.
--  * reconstruir_historial_costeo: dejaba fuera los servicios (la curva salía
--    baja) y, siendo security definer, no revisaba permisos.
--  * arbol_bom: ordenaba por los uuid del camino, no por el orden de las líneas.
--  * precio_canal: ingeniería y compras no ven la tabla de canales y recibían null.
--  * configuracion: el ISR de compensación solo lo podía cambiar sistemas.
--  * bitácora: categorías, parámetros, horas y altas de tarifas no quedaban.
--  * sugerir_clave: proponía claves que no son el siguiente de ninguna serie.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Fotos intermedias del historial
-- -----------------------------------------------------------------------------
-- El costeo se recalcula al final de cada sentencia y cada recálculo deja su
-- foto en historial_costeo si algo cambió. Una operación de varios pasos
-- (crear el artículo, copiarle parámetros, copiarle líneas…) dejaba una foto
-- por paso: la copia de una banda aparecía en la gráfica costando $0, luego a
-- medias, luego completa; sustituir líneas por un subensamble dejaba un bache.
-- Al terminar, la operación llama esta función: de lo que se fotografió en
-- ESTA transacción (en = now()) se queda solo la última foto por artículo, y
-- ni esa si quedó igual a la que había antes. No depende de cómo se dispare
-- el recálculo (todo de golpe o incremental), solo de que las fotos llevan now().
create or replace function public.limpiar_fotos_intermedias(p_articulos uuid[]) returns void
language plpgsql security definer set search_path = public as $$
begin
  -- Solo toca filas creadas en la transacción de quien llama: no hay nada ajeno que borrar.
  with recursive alcance(id) as (
    select unnest(p_articulos)
    union
    select b.padre_id from bom_lineas b join alcance on b.hijo_id = alcance.id
  )
  delete from historial_costeo h
  using alcance
  where h.articulo_id = alcance.id and h.en = now() and not h.reconstruido
    and h.id < (select max(x.id) from historial_costeo x where x.articulo_id = h.articulo_id and x.en = now());

  with recursive alcance(id) as (
    select unnest(p_articulos)
    union
    select b.padre_id from bom_lineas b join alcance on b.hijo_id = alcance.id
  )
  delete from historial_costeo h
  using alcance
  where h.articulo_id = alcance.id and h.en = now() and not h.reconstruido
    and exists (select 1 from (select x.costo_total, x.precio_lista from historial_costeo x
                               where x.articulo_id = h.articulo_id and x.en < now() and not x.reconstruido
                               order by x.en desc, x.id desc limit 1) previa
                where previa.costo_total is not distinct from h.costo_total
                  and previa.precio_lista is not distinct from h.precio_lista);
end $$;

-- -----------------------------------------------------------------------------
-- Duplicar con otros parámetros (corrige la versión de catalogo_costeo)
-- -----------------------------------------------------------------------------
-- La original no copiaba medida_especial ni kg_por_unidad: "la banda de 20 m
-- pero de 22 m" de una tolva con medida especial salía sin el 10 % de recargo.
create or replace function public.duplicar_articulo(p_origen uuid, p_clave text, p_nombre text, p_parametros jsonb default '{}')
returns uuid language plpgsql security invoker set search_path = public as $$
declare v_nuevo uuid; k text; v text;
begin
  if not puede('costeo', 2) then raise exception 'Sin permiso para editar costeo' using errcode = '42501'; end if;
  if nullif(trim(p_clave), '') is null or nullif(trim(p_nombre), '') is null then
    raise exception 'La copia necesita clave y nombre' using errcode = '22023';
  end if;

  insert into articulos (clave, tipo, nombre, descripcion, unidad, categoria_id, familia, medida_especial, kg_por_unidad,
                         imagen_url, proveedor_id, tiempo_entrega_dias, es_importado, controla_inventario, se_vende)
  select trim(p_clave), tipo, trim(p_nombre), descripcion, unidad, categoria_id, familia, medida_especial, kg_por_unidad,
         imagen_url, proveedor_id, tiempo_entrega_dias, es_importado, controla_inventario, se_vende
  from articulos where id = p_origen
  returning id into v_nuevo;
  if v_nuevo is null then raise exception 'No existe el artículo a duplicar' using errcode = 'P0002'; end if;

  insert into articulo_parametros (articulo_id, nombre, valor, unidad, descripcion)
  select v_nuevo, nombre, coalesce((p_parametros->>nombre)::numeric, valor), unidad, descripcion
  from articulo_parametros where articulo_id = p_origen;
  for k, v in select * from jsonb_each_text(coalesce(p_parametros, '{}')) loop
    insert into articulo_parametros (articulo_id, nombre, valor) values (v_nuevo, k, v::numeric) on conflict do nothing;
  end loop;

  insert into bom_lineas (padre_id, hijo_id, cantidad, parametro, por_parametro, redondear_arriba, merma, grupo, notas, orden)
  select v_nuevo, hijo_id, cantidad, parametro, por_parametro, redondear_arriba, merma, grupo, notas, orden
  from bom_lineas where padre_id = p_origen;

  insert into bom_operaciones (articulo_id, etapa_id, horas, parametro, horas_por_parametro, notas)
  select v_nuevo, etapa_id, horas, parametro, horas_por_parametro, notas from bom_operaciones where articulo_id = p_origen;

  perform limpiar_fotos_intermedias(array[v_nuevo]);
  return v_nuevo;
end $$;

-- -----------------------------------------------------------------------------
-- Historial reconstruido (corrige la versión de catalogo_costeo)
-- -----------------------------------------------------------------------------
-- La original explotaba con explotar_materiales(), que deja fuera los
-- servicios (vulcanizado, calibración, puesta en marcha) porque producción no
-- los surte de almacén. Para el costo sí cuentan: la curva reconstruida salía
-- más baja que el costo real y daba un brinco falso el día del arranque.
-- También le faltaba revisar permisos siendo security definer: cualquiera con
-- sesión podía borrar y regenerar el historial. Sin sesión (importador, psql)
-- sigue funcionando.
create or replace function public.reconstruir_historial_costeo(p_desde date default null) returns int
language plpgsql security definer set search_path = public as $$
declare v_n int;
begin
  if auth.uid() is not null and not puede('costos', 3) then
    raise exception 'Solo quien administra costos reconstruye el historial' using errcode = '42501';
  end if;
  delete from historial_costeo where reconstruido;
  with recursive arbol(raiz, id, cant) as (
    select a.id, a.id, 1::numeric from articulos a where a.tipo in ('subensamble', 'equipo') and a.activo
    union all
    select arbol.raiz, b.hijo_id, arbol.cant * cantidad_linea(b) from arbol join bom_lineas b on b.padre_id = arbol.id
  ),
  hojas as (
    select arbol.raiz fabricado, arbol.id hoja, sum(arbol.cant) cantidad
    from arbol join articulos h on h.id = arbol.id
    where h.tipo in ('componente', 'materia_prima', 'servicio')
    group by 1, 2
  ),
  meses as (
    select (generate_series(date_trunc('month', coalesce(p_desde, (select min(en) from historial_costos)::date)),
                            date_trunc('month', now()) - interval '1 month', interval '1 month'))::date mes
  ),
  costo_mes as (
    select m.mes, h.hoja, hc.costo
    from meses m cross join (select distinct hoja from hojas) h
    cross join lateral (select costo_nuevo * tc(moneda) costo from historial_costos
                        where articulo_id = h.hoja and en < m.mes + interval '1 month'
                        order by en desc limit 1) hc
  )
  insert into historial_costeo (articulo_id, en, costo_material, costo_mano_obra, costo_total, reconstruido)
  select h.fabricado, (cm.mes + interval '1 month' - interval '1 second'),
         sum(h.cantidad * cm.costo), max(cc.costo_mano_obra), sum(h.cantidad * cm.costo) + max(cc.costo_mano_obra), true
  from hojas h join costo_mes cm on cm.hoja = h.hoja
  join costos_calculados cc on cc.articulo_id = h.fabricado
  group by h.fabricado, cm.mes
  having count(*) >= 0.9 * (select count(*) from hojas x where x.fabricado = h.fabricado);
  get diagnostics v_n = row_count;
  return v_n;
end $$;

-- -----------------------------------------------------------------------------
-- Árbol de la lista de materiales
-- -----------------------------------------------------------------------------
-- arbol_bom ordenaba por el arreglo de uuid del camino: las líneas salían en
-- orden aleatorio y el editor no podía respetar el orden que captura ingeniería.
-- Misma firma, ahora ordenado por el orden de cada nivel.
create or replace function public.arbol_bom(p_articulo uuid)
returns table (linea_id uuid, padre_id uuid, articulo_id uuid, clave text, nombre text, tipo public.tipo_articulo,
               unidad text, cantidad numeric, cantidad_total numeric, nivel int, camino uuid[], grupo text, parametro text,
               por_parametro numeric, redondear_arriba boolean, merma numeric, notas text, orden int)
language sql stable security invoker as $$
  with recursive arbol as (
    select b.id, b.padre_id, b.hijo_id, cantidad_linea(b) cant, cantidad_linea(b) tot, 1 nivel, array[b.padre_id, b.hijo_id] camino,
           array[lpad((b.orden + 1000000)::text, 8, '0') || b.id::text] ord,
           b.grupo, b.parametro, b.por_parametro, b.redondear_arriba, b.merma, b.notas, b.orden, b.cantidad
    from bom_lineas b where b.padre_id = p_articulo
    union all
    select b.id, b.padre_id, b.hijo_id, cantidad_linea(b), arbol.tot * cantidad_linea(b), arbol.nivel + 1, arbol.camino || b.hijo_id,
           arbol.ord || (lpad((b.orden + 1000000)::text, 8, '0') || b.id::text),
           b.grupo, b.parametro, b.por_parametro, b.redondear_arriba, b.merma, b.notas, b.orden, b.cantidad
    from arbol join bom_lineas b on b.padre_id = arbol.hijo_id
    where arbol.nivel < 10
  )
  select arbol.id, arbol.padre_id, arbol.hijo_id, a.clave, a.nombre, a.tipo, a.unidad, arbol.cantidad, round(arbol.tot, 4), arbol.nivel,
         arbol.camino, arbol.grupo, arbol.parametro, arbol.por_parametro, arbol.redondear_arriba, arbol.merma, arbol.notas, arbol.orden
  from arbol join articulos a on a.id = arbol.hijo_id
  order by arbol.ord
$$;

-- Para el editor: el camino va por LÍNEAS, no por artículos. Si un equipo lleva
-- dos veces el mismo subensamble (dos líneas), con el camino por artículos sus
-- contenidos se confunden; por líneas cada instancia tiene su propio contenido.
create or replace function public.arbol_lista_materiales(p_articulo uuid)
returns table (linea_id uuid, ruta uuid[], padre_id uuid, articulo_id uuid, clave text, nombre text, tipo public.tipo_articulo,
               unidad text, cantidad numeric, parametro text, por_parametro numeric, redondear_arriba boolean, merma numeric,
               grupo text, notas text, orden int, cantidad_efectiva numeric, cantidad_total numeric, nivel int, lineas_hijo int)
language sql stable security invoker as $$
  with recursive arbol as (
    select b.id, array[b.id] ruta, b.padre_id, b.hijo_id, cantidad_linea(b) efe, cantidad_linea(b) tot, 1 nivel,
           array[lpad((b.orden + 1000000)::text, 8, '0') || b.id::text] ord
    from bom_lineas b where b.padre_id = p_articulo
    union all
    select b.id, arbol.ruta || b.id, b.padre_id, b.hijo_id, cantidad_linea(b), arbol.tot * cantidad_linea(b), arbol.nivel + 1,
           arbol.ord || (lpad((b.orden + 1000000)::text, 8, '0') || b.id::text)
    from arbol join bom_lineas b on b.padre_id = arbol.hijo_id
    where arbol.nivel < 10
  )
  select arbol.id, arbol.ruta, arbol.padre_id, arbol.hijo_id, a.clave, a.nombre, a.tipo, a.unidad,
         b.cantidad, b.parametro, b.por_parametro, b.redondear_arriba, b.merma, b.grupo, b.notas, b.orden,
         round(arbol.efe, 4), round(arbol.tot, 4), arbol.nivel,
         (select count(*) from bom_lineas x where x.padre_id = arbol.hijo_id)::int
  from arbol
  join bom_lineas b on b.id = arbol.id
  join articulos a on a.id = arbol.hijo_id
  order by arbol.ord
$$;

-- Reordenar en una sola sentencia: dos updates sueltos recalculan dos veces.
create or replace function public.reordenar_bom(p_padre uuid, p_lineas uuid[]) returns void
language plpgsql security invoker set search_path = public as $$
begin
  if not puede('costeo', 2) then raise exception 'Sin permiso para editar listas de materiales' using errcode = '42501'; end if;
  update bom_lineas b set orden = x.n * 10
  from unnest(p_lineas) with ordinality x(id, n)
  where b.id = x.id and b.padre_id = p_padre and b.orden is distinct from x.n * 10;
end $$;

-- -----------------------------------------------------------------------------
-- Subensambles a partir de líneas de un equipo
-- -----------------------------------------------------------------------------
-- Valida que las líneas existan y sean de ese padre; devuelve el orden y el
-- grupo que tendrá la línea que las sustituye (el grupo solo si todas lo comparten).
create or replace function public._lineas_de(p_padre uuid, p_lineas uuid[], out o_orden int, out o_grupo text)
language plpgsql stable security invoker set search_path = public as $$
declare v_n int; v_pedidas int := cardinality(array(select distinct unnest(p_lineas)));
begin
  if coalesce(v_pedidas, 0) = 0 then
    raise exception 'Elige al menos una línea' using errcode = '22023';
  end if;
  select count(*), min(orden), case when count(distinct coalesce(grupo, '')) = 1 then min(grupo) end
    into v_n, o_orden, o_grupo
  from bom_lineas where id = any(p_lineas) and padre_id = p_padre;
  if v_n <> v_pedidas then
    raise exception 'Alguna de las líneas elegidas ya no está en esta lista de materiales; recarga la página' using errcode = '22023';
  end if;
end $$;

-- "Convertir en subensamble": crea el subensamble con esas líneas y las
-- sustituye por una sola línea de 1 pieza. Las líneas se MUEVEN (conservan su
-- id, notas, merma y redondeo), y si alguna dependía de un parámetro del padre
-- (largo_m…) el subensamble recibe una copia de ese parámetro con el mismo
-- valor: así la cantidad efectiva, y por tanto el costo, no cambia.
create or replace function public.extraer_subensamble(p_padre uuid, p_lineas uuid[], p_clave text, p_nombre text)
returns uuid language plpgsql security invoker set search_path = public as $$
declare v_sub uuid; v_orden int; v_grupo text; v_tipo tipo_articulo;
begin
  if not puede('costeo', 2) then raise exception 'Sin permiso para editar listas de materiales' using errcode = '42501'; end if;
  if nullif(trim(p_clave), '') is null or nullif(trim(p_nombre), '') is null then
    raise exception 'El subensamble necesita clave y nombre' using errcode = '22023';
  end if;
  select tipo into v_tipo from articulos where id = p_padre;
  if v_tipo is null or v_tipo not in ('equipo', 'subensamble') then
    raise exception 'Solo se extraen subensambles de un equipo o de otro subensamble' using errcode = '22023';
  end if;
  select o_orden, o_grupo into v_orden, v_grupo from _lineas_de(p_padre, p_lineas);

  insert into articulos (clave, tipo, nombre, unidad, se_vende)
  values (trim(p_clave), 'subensamble', trim(p_nombre), 'pieza', true)
  returning id into v_sub;

  insert into articulo_parametros (articulo_id, nombre, valor, unidad, descripcion)
  select v_sub, p.nombre, p.valor, p.unidad, p.descripcion
  from articulo_parametros p
  where p.articulo_id = p_padre
    and p.nombre in (select parametro from bom_lineas where id = any(p_lineas) and parametro is not null);

  -- Primero la línea del subensamble (vacío, cuesta $0: el padre no cambia) y
  -- luego se mueven las líneas: en ningún momento el padre cuesta otra cosa.
  insert into bom_lineas (padre_id, hijo_id, cantidad, grupo, orden, notas)
  values (p_padre, v_sub, 1, v_grupo, coalesce(v_orden, 0), null);

  update bom_lineas set padre_id = v_sub where id = any(p_lineas) and padre_id = p_padre;

  perform limpiar_fotos_intermedias(array[v_sub, p_padre]);
  return v_sub;
end $$;

-- "Estas líneas ya son el cabezal motriz": subensambles cuyo contenido se
-- parece a las líneas elegidas. exacto = mismos artículos con la misma
-- cantidad efectiva, ni uno más ni uno menos. Las horas propias del
-- subensamble se devuelven aparte: en una lista plana de la hoja esas horas
-- suelen venir sumadas en las del equipo y hay que decidir si se restan.
drop function if exists public.subensambles_coincidentes(uuid, uuid[]);
create or replace function public.subensambles_coincidentes(p_padre uuid, p_lineas uuid[])
returns table (subensamble_id uuid, clave text, nombre text, lineas_subensamble int, lineas_elegidas int,
               iguales int, misma_pieza_otra_cantidad int, exacto boolean, horas_propias numeric, horas_detalle text)
language sql stable security invoker as $$
  with elegidas as (
    select b.hijo_id, round(sum(cantidad_linea(b)), 4) cant
    from bom_lineas b where b.id = any(p_lineas) and b.padre_id = p_padre group by b.hijo_id
  ),
  candidatos as (
    select distinct s.padre_id id
    from bom_lineas s join elegidas e on e.hijo_id = s.hijo_id
    join articulos a on a.id = s.padre_id
    where a.tipo = 'subensamble' and a.activo and s.padre_id <> p_padre
  ),
  contenido as (
    select c.id, s.hijo_id, round(sum(cantidad_linea(s)), 4) cant
    from candidatos c join bom_lineas s on s.padre_id = c.id group by c.id, s.hijo_id
  ),
  cmp as (
    select c.id,
      (select count(*) from contenido x where x.id = c.id)::int n_sub,
      (select count(*) from elegidas)::int n_eleg,
      (select count(*) from contenido x join elegidas e on e.hijo_id = x.hijo_id and e.cant = x.cant where x.id = c.id)::int iguales,
      (select count(*) from contenido x join elegidas e on e.hijo_id = x.hijo_id and e.cant <> x.cant where x.id = c.id)::int otra_cant
    from candidatos c
  )
  select cmp.id, a.clave, a.nombre, cmp.n_sub, cmp.n_eleg, cmp.iguales, cmp.otra_cant,
         cmp.iguales = cmp.n_sub and cmp.iguales = cmp.n_eleg,
         (select coalesce(sum(horas_operacion(o)), 0) from bom_operaciones o where o.articulo_id = cmp.id),
         (select string_agg(round(horas_operacion(o), 1)::text || ' h ' || lower(e.nombre), ', ' order by e.orden)
            from bom_operaciones o join etapas e on e.id = o.etapa_id where o.articulo_id = cmp.id and horas_operacion(o) > 0)
  from cmp join articulos a on a.id = cmp.id
  order by (cmp.iguales = cmp.n_sub and cmp.iguales = cmp.n_eleg) desc,
           cmp.iguales::numeric / greatest(cmp.n_sub, cmp.n_eleg) desc, a.nombre
  limit 8
$$;

-- "Usar subensamble existente" sobre líneas elegidas: las quita y pone una
-- línea de 1 pieza del subensamble. Si no eran idénticas el costo SÍ cambia;
-- la pantalla lo advierte antes con subensambles_coincidentes.
-- p_restar_horas: el subensamble trae sus propias horas por etapa; si el
-- equipo ya las contaba (lista plana de la hoja), se restan de las del equipo
-- para no cobrar dos veces la misma mano de obra. Nunca quedan negativas.
drop function if exists public.sustituir_por_subensamble(uuid, uuid[], uuid);
create or replace function public.sustituir_por_subensamble(p_padre uuid, p_lineas uuid[], p_subensamble uuid,
                                                            p_restar_horas boolean default false)
returns uuid language plpgsql security invoker set search_path = public as $$
declare v_linea uuid; v_orden int; v_grupo text;
begin
  if not puede('costeo', 2) then raise exception 'Sin permiso para editar listas de materiales' using errcode = '42501'; end if;
  if (select tipo from articulos where id = p_subensamble) is distinct from 'subensamble' then
    raise exception 'Lo elegido no es un subensamble' using errcode = '22023';
  end if;
  if p_subensamble = p_padre then raise exception 'Un subensamble no puede contenerse a sí mismo' using errcode = '22023'; end if;
  select o_orden, o_grupo into v_orden, v_grupo from _lineas_de(p_padre, p_lineas);

  delete from bom_lineas where id = any(p_lineas) and padre_id = p_padre;
  insert into bom_lineas (padre_id, hijo_id, cantidad, grupo, orden)
  values (p_padre, p_subensamble, 1, v_grupo, coalesce(v_orden, 0))
  returning id into v_linea;
  if p_restar_horas then
    update bom_operaciones o set horas = greatest(o.horas - s.h, 0)
    from (select etapa_id, sum(horas_operacion(x)) h from bom_operaciones x where x.articulo_id = p_subensamble group by etapa_id) s
    where o.articulo_id = p_padre and o.etapa_id = s.etapa_id;
  end if;
  perform limpiar_fotos_intermedias(array[p_padre]);
  return v_linea;
end $$;

-- -----------------------------------------------------------------------------
-- El precio explicado con los números del artículo
-- -----------------------------------------------------------------------------
-- Lo que la hoja tenía regado en EQUIPOS!J..AC, en un solo objeto: costo,
-- cada recargo con su monto, precio sin redondear, redondeo, y la utilidad que
-- de verdad queda con el precio de lista (como EQUIPOS!Z, AB y AC). Quien no
-- tiene "costos" recibe null: no hay forma de pedirle un margen a esta función.
create or replace function public.desglose_precio(p_articulo uuid) returns jsonb
language plpgsql stable security invoker set search_path = public as $$
declare
  a articulos; cc costos_calculados; ca costos_articulo; pp politicas_precio;
  v_isr numeric; v_u numeric; v_ue numeric; v_costo numeric; v_rc jsonb; v_rp jsonb; v_rc_pct numeric; v_rp_pct numeric;
  v_med numeric; v_base numeric; v_v numeric; v_w numeric; v_lista numeric; v_multiplo numeric; v_u_total numeric;
  v_bruta numeric; v_neta numeric;
begin
  if not puede('costos', 1) then return null; end if;
  select * into a from articulos where id = p_articulo;
  if a.id is null then return null; end if;
  select * into cc from costos_calculados where articulo_id = p_articulo;
  select * into ca from costos_articulo where articulo_id = p_articulo;
  select * into pp from politicas_precio where id = politica_de(p_articulo);
  v_isr := (select valor::text::numeric from configuracion where clave = 'isr_compensacion');
  v_costo := coalesce(cc.costo_total, 0);
  v_u := coalesce(ca.margen, pp.utilidad);
  v_ue := case when pp.compensar_isr then v_u / (1 - v_isr) else v_u end;

  select coalesce(sum((e->>'pct')::numeric), 0),
         coalesce(jsonb_agg(jsonb_build_object('nombre', e->>'nombre', 'pct', (e->>'pct')::numeric,
                                               'monto', round(v_costo * (e->>'pct')::numeric, 2))), '[]')
    into v_rc_pct, v_rc from jsonb_array_elements(coalesce(pp.recargos_costo, '[]')) e;
  v_med := case when a.medida_especial then round(v_costo * pp.pct_medida_especial, 2) else 0 end;
  v_base := v_costo * (1 + v_rc_pct) + case when a.medida_especial then v_costo * pp.pct_medida_especial else 0 end;
  v_v := precio_sin_redondeo(v_costo, pp.id, ca.margen, a.medida_especial);

  select coalesce(sum((e->>'pct')::numeric), 0),
         coalesce(jsonb_agg(jsonb_build_object('nombre', e->>'nombre', 'pct', (e->>'pct')::numeric,
                                               'monto', round(coalesce(v_v, 0) * (e->>'pct')::numeric, 2))), '[]')
    into v_rp_pct, v_rp from jsonb_array_elements(coalesce(pp.recargos_precio, '[]')) e;

  v_w := case when v_v is not null then redondear_precio(v_v, pp.redondeo) end;
  select (t->>'multiplo')::numeric into v_multiplo from jsonb_array_elements(pp.redondeo) t
   where v_v is not null and (t->>'hasta' is null or v_v < (t->>'hasta')::numeric)
   order by (t->>'hasta')::numeric nulls last limit 1;
  v_lista := (select precio from precios_lista where articulo_id = p_articulo);

  -- Con el precio de lista real (que puede ser precio fijo): costo total con
  -- recargos (U de la hoja), utilidad bruta (Z) y neta después de ISR (AB).
  v_u_total := v_base + coalesce(v_v, 0) * v_rp_pct;
  v_bruta := v_lista - v_u_total;
  v_neta := case when pp.compensar_isr then v_bruta * (1 - v_isr) else v_bruta end;

  return jsonb_build_object(
    'costo_material', round(coalesce(cc.costo_material, 0), 2),
    'costo_mano_obra', round(coalesce(cc.costo_mano_obra, 0), 2),
    'costo', round(v_costo, 2),
    'horas', cc.horas,
    'sin_costo', coalesce(cc.sin_costo, 0),
    'costo_mas_viejo', cc.costo_mas_viejo,
    'politica', jsonb_build_object('id', pp.id, 'nombre', pp.nombre, 'utilidad', pp.utilidad,
                                   'compensar_isr', pp.compensar_isr, 'pct_medida_especial', pp.pct_medida_especial,
                                   'descuento_maximo', pp.descuento_maximo),
    'isr', v_isr,
    'utilidad', v_u,
    'margen_propio', ca.margen,
    'utilidad_compensada', round(v_ue, 6),
    'medida_especial', a.medida_especial,
    'recargos_costo', v_rc,
    'pct_recargos_costo', v_rc_pct,
    'monto_medida_especial', v_med,
    'base', round(v_base, 2),
    'recargos_precio', v_rp,
    'pct_recargos_precio', v_rp_pct,
    'divisor', round(1 - v_ue - v_rp_pct, 6),
    'precio_sin_redondeo', round(v_v, 2),
    'utilidad_antes_isr', round(coalesce(v_v, 0) * v_ue, 2),
    'isr_monto', round(case when pp.compensar_isr then coalesce(v_v, 0) * v_ue * v_isr else 0 end, 2),
    'multiplo_redondeo', v_multiplo,
    'precio_redondeado', v_w,
    'precio_fijo', ca.precio_fijo,
    'precio_lista', v_lista,
    'factor', case when v_costo > 0 and v_v is not null then round(v_v / v_costo, 6) end,
    'costo_con_recargos', round(v_u_total, 2),
    'utilidad_bruta', round(v_bruta, 2),
    'utilidad_neta', round(v_neta, 2),
    'pct_neto', case when v_lista > 0 then round(v_neta / v_lista, 4) end
  );
end $$;

-- -----------------------------------------------------------------------------
-- Simulador del panel de márgenes
-- -----------------------------------------------------------------------------
-- simular_politica (apoyo_pantallas) solo mueve la utilidad. El panel deja
-- editar también recargos, medida especial, redondeo y el ISR, y el botón
-- Guardar tiene que decir cuántos precios va a mover de verdad. p_valores
-- trae solo lo que cambia: {"utilidad":0.33,"recargos_costo":[…],…}.
-- Con p_politica null y p_isr se simula un cambio de ISR en todas las políticas.
-- Respeta el margen propio de un artículo (costos_articulo.margen) y excluye
-- los de precio fijo, igual que recalcular_costos().
-- La política de cada artículo se resuelve con un join (categoría o la de su
-- tipo) y no con politica_de() por fila: con la RLS de quien pregunta, llamar
-- la función 5,000 veces tardaba 5 segundos y el simulador debe responder
-- mientras se escribe.
create or replace function public.simular_precios(p_politica int, p_valores jsonb default '{}', p_isr numeric default null)
returns table (articulo_id uuid, clave text, nombre text, tipo public.tipo_articulo, politica text, costo numeric,
               precio_actual numeric, precio_simulado numeric)
language sql stable security invoker as $$
  with cfg as (
    select coalesce(p_isr, (select valor::text::numeric from configuracion where clave = 'isr_compensacion')) isr
  ),
  pol0 as (
    select pp.id, pp.nombre, pp.por_defecto_para,
      case when pp.id = p_politica and p_valores ? 'utilidad' then (p_valores->>'utilidad')::numeric else pp.utilidad end utilidad,
      case when pp.id = p_politica and p_valores ? 'compensar_isr' then (p_valores->>'compensar_isr')::boolean else pp.compensar_isr end compensar_isr,
      case when pp.id = p_politica and p_valores ? 'recargos_costo' then p_valores->'recargos_costo' else pp.recargos_costo end rc,
      case when pp.id = p_politica and p_valores ? 'recargos_precio' then p_valores->'recargos_precio' else pp.recargos_precio end rp,
      case when pp.id = p_politica and p_valores ? 'pct_medida_especial' then (p_valores->>'pct_medida_especial')::numeric else pp.pct_medida_especial end med,
      case when pp.id = p_politica and p_valores ? 'redondeo' then p_valores->'redondeo' else pp.redondeo end redondeo
    from politicas_precio pp
  ),
  pol as (
    select pol0.*,
      coalesce((select sum((e->>'pct')::numeric) from jsonb_array_elements(pol0.rc) e), 0) rc_suma,
      coalesce((select sum((e->>'pct')::numeric) from jsonb_array_elements(pol0.rp) e), 0) rp_suma
    from pol0
  ),
  calc as (
    select a.id, a.clave, a.nombre, a.tipo, pol.nombre pol_nombre, cc.costo_total, pl.precio,
      (cc.costo_total * (1 + pol.rc_suma) + case when a.medida_especial then cc.costo_total * pol.med else 0 end) base,
      1 - case when pol.compensar_isr then coalesce(ca.margen, pol.utilidad) / (1 - cfg.isr) else coalesce(ca.margen, pol.utilidad) end
        - pol.rp_suma divisor,
      pol.redondeo
    from articulos a
    join costos_calculados cc on cc.articulo_id = a.id
    left join categorias cat on cat.id = a.categoria_id
    join pol on pol.id = coalesce(cat.politica_id, (select d.id from pol d where d.por_defecto_para = a.tipo))
    cross join cfg
    left join precios_lista pl on pl.articulo_id = a.id
    left join costos_articulo ca on ca.articulo_id = a.id
    where a.activo and a.se_vende and cc.costo_total > 0 and ca.precio_fijo is null
      and (p_politica is null or pol.id = p_politica)
  )
  -- Un divisor ≤ 0 no tiene precio (utilidad compensada + recargos ≥ 100 %): sale null.
  select id, clave, nombre, tipo, pol_nombre, round(costo_total, 2), precio,
         case when divisor > 0 then redondear_precio(base / divisor, redondeo) end
  from calc
$$;

-- El ISR de compensación vive en configuracion, que solo edita sistemas
-- (admin 3). Pero es un parámetro de precios: lo cambia quien administra
-- costos, con su rastro en la bitácora (el disparador de configuracion).
create or replace function public.fijar_isr_compensacion(p_valor numeric) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not puede('costos', 3) then raise exception 'Solo quien administra costos cambia el ISR de compensación' using errcode = '42501'; end if;
  if p_valor is null or p_valor < 0 or p_valor >= 0.6 then
    raise exception 'El ISR de compensación debe estar entre 0 %% y 60 %%' using errcode = '22023';
  end if;
  update configuracion set valor = to_jsonb(p_valor), actualizado_en = now() where clave = 'isr_compensacion';
end $$;

-- -----------------------------------------------------------------------------
-- Precio sugerido por canal para cualquiera que vea el catálogo
-- -----------------------------------------------------------------------------
-- precio_canal() lee la tabla canales, que solo ve ventas: ingeniería y
-- compras recibían null en la ficha del componente. Las comisiones de un canal
-- no son un costo ni un margen, y el precio de lista ya lo ve todo rol; esta
-- envoltura solo deja pasar el resultado.
create or replace function public.precios_por_canal(p_articulo uuid)
returns table (canal public.canal_venta, comision_pct numeric, costo_envio numeric, precio_sugerido numeric, precio_con_envio numeric)
language sql stable security definer set search_path = public as $$
  select c.canal, c.comision_pct, c.costo_envio, precio_canal(p_articulo, c.canal, false), precio_canal(p_articulo, c.canal, true)
  from canales c
  where cardinality(mis_roles()) > 0 and c.canal in ('mercadolibre', 'sitio_web', 'amazon')
  order by case c.canal when 'mercadolibre' then 1 when 'sitio_web' then 2 else 3 end
$$;

-- -----------------------------------------------------------------------------
-- Solicitudes de cambio que manda producción
-- -----------------------------------------------------------------------------
-- Quién y cuándo las resolvió lo pone la base, no la pantalla.
create or replace function public.resolver_solicitud_cambio(p_id uuid, p_estado text) returns void
language plpgsql security invoker set search_path = public as $$
begin
  if not puede('costeo', 2) then raise exception 'Solo ingeniería resuelve solicitudes de cambio' using errcode = '42501'; end if;
  if p_estado not in ('aplicada', 'descartada') then raise exception 'Estado no válido: %', p_estado using errcode = '22023'; end if;
  update solicitudes_cambio_bom set estado = p_estado, resuelto_por = auth.uid(), resuelto_en = now()
  where id = p_id and estado = 'pendiente';
  if not found then raise exception 'La solicitud ya fue resuelta o no existe' using errcode = 'P0002'; end if;
end $$;

-- -----------------------------------------------------------------------------
-- Clave sugerida para un artículo nuevo
-- -----------------------------------------------------------------------------
-- Toma el prefijo más usado en ese tipo (E-, C-N…) y el siguiente número, con
-- el mismo ancho. Evita que dos personas inventen claves con formatos distintos.
-- Un prefijo cuenta solo si es una serie de verdad (3 claves o más): con pocos
-- subensambles, "SUB-CM18" (cabezal de 18") proponía "SUB-CM19", que no es el
-- siguiente de nada. Sin serie se usa el prefijo de siempre del tipo. Nunca
-- propone una clave que ya existe.
create or replace function public.sugerir_clave(p_tipo public.tipo_articulo) returns text
language plpgsql stable security invoker set search_path = public as $$
declare v_pref text; v_max numeric; v_ancho int; v_clave text;
begin
  select prefijo, maximo, ancho into v_pref, v_max, v_ancho from (
    select m[1] prefijo, max(m[2]::numeric) maximo, max(length(m[2])) ancho, count(*) n
    from (select regexp_match(clave, '^(.*?)(\d+)$') m from articulos where tipo = p_tipo) x
    where m is not null group by m[1]
  ) p where n >= 3 order by n desc, prefijo limit 1;

  if v_pref is null then
    v_pref := case p_tipo when 'equipo' then 'E-' when 'subensamble' then 'SUB-' when 'materia_prima' then 'MP-'
                          when 'servicio' then 'SRV-' else 'C-' end;
    select max((regexp_match(clave, '^' || v_pref || '(\d+)$'))[1]::numeric),
           max(length((regexp_match(clave, '^' || v_pref || '(\d+)$'))[1]))
      into v_max, v_ancho
    from articulos where clave like v_pref || '%';
  end if;

  v_max := coalesce(v_max, 0);
  v_ancho := greatest(coalesce(v_ancho, 3), 3);
  loop
    v_max := v_max + 1;
    v_clave := v_pref || lpad(v_max::text, v_ancho, '0');
    exit when not exists (select 1 from articulos where clave = v_clave);
  end loop;
  return v_clave;
end $$;

-- -----------------------------------------------------------------------------
-- Bitácora de lo que mueve precios
-- -----------------------------------------------------------------------------
-- Estas tablas cambian precios y no dejaban rastro: con esto "quién cambió el
-- largo de la banda" o "quién movió las horas de pailería" se contesta desde
-- Bitácora. (Tipos de cambio ya lo deja 20261003000050.)
drop trigger if exists auditar on public.categorias;
create trigger auditar after insert or update or delete on public.categorias for each row execute function public.auditar();
drop trigger if exists auditar on public.articulo_parametros;
create trigger auditar after insert or update or delete on public.articulo_parametros for each row execute function public.auditar();
drop trigger if exists auditar on public.bom_operaciones;
create trigger auditar after insert or update or delete on public.bom_operaciones for each row execute function public.auditar();
drop trigger if exists auditar_alta on public.tarifas_mano_obra;
create trigger auditar_alta after insert or delete on public.tarifas_mano_obra for each row execute function public.auditar();

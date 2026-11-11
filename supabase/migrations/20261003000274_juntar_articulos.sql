-- =============================================================================
-- Juntar dos artículos que son el mismo (un repetido del catálogo).
--
-- Por qué: al revisar los nombres (11 nov) salieron 52 artículos dados de alta dos veces, que solo
-- se distinguían por una comilla, el orden de las medidas o una falta. En muchos, las listas de
-- materiales usaban uno con existencia 0 y la existencia estaba en el otro (la rondana de presión
-- 5/16": las listas en C-N0077 sin nada, las 774 piezas en C-N1739). El reabasto pedía lo que sí
-- había y surtir salía de un artículo vacío. No había forma de juntarlos: el artículo está ligado
-- a 37 tablas y los movimientos de inventario no se modifican.
--
-- Qué hace juntar_articulos(queda, sale, motivo), solo dirección:
--   * Todo lo que apunta al que sale pasa al que se queda: movimientos (con su historial),
--     existencias (se suman por almacén), listas de materiales, órdenes de producción y su
--     material, compras, requisiciones, cotizaciones, pedidos, envíos, apartados, ajustes,
--     conteos, costos, precios, publicaciones, imágenes y demás.
--   * Donde los dos estaban en el mismo lugar se suman: el mismo material en una orden (requerido
--     y surtido), el mismo renglón de un conteo (lo contado y lo que decía el sistema), la misma
--     pieza en una lista de materiales (si las dos son cantidad fija). Costo y precio: se queda el
--     del que se queda, si tiene.
--   * El que sale queda inactivo, con una nota de a cuál se juntó, y el cambio en
--     articulos_juntados con cuántos renglones se movieron de cada tabla.
--
-- Cómo: mover renglones de documentos ya cerrados (envíos, documentos técnicos, movimientos)
-- choca con los disparadores que los protegen, que existen para que la gente no los edite. Aquí
-- no se edita nada: se cambia a qué artículo apuntan. Por eso el traslado corre con los
-- disparadores apagados (session_replication_role = replica) y los efectos que importan se hacen
-- a mano: las existencias se suman y los costos se recalculan al final. Las llaves foráneas
-- tampoco revisan en ese modo; no hace falta, porque solo se escribe el id del que se queda.
-- =============================================================================

create table if not exists public.articulos_juntados (
  id bigserial primary key,
  sale_id uuid not null references public.articulos(id),
  queda_id uuid not null references public.articulos(id),
  motivo text not null,
  movido jsonb not null default '{}',
  por uuid default auth.uid() references public.perfiles(id),
  en timestamptz not null default now()
);
alter table public.articulos_juntados enable row level security;
drop policy if exists ver on public.articulos_juntados;
create policy ver on public.articulos_juntados for select to authenticated
  using ((select puede('inventario', 1)) or (select puede('costeo', 1)));

create or replace function public.juntar_articulos(p_queda uuid, p_sale uuid, p_motivo text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare q articulos; s articulos; v_movido jsonb := '{}'; v_n int; r record;
  v_padres uuid[];
begin
  if not tiene_rol('direccion') then
    raise exception 'Juntar artículos lo hace dirección: cambia existencias, listas de materiales y costos' using errcode = '42501';
  end if;
  if p_queda is null or p_sale is null or p_queda = p_sale then raise exception 'Elige dos artículos distintos' using errcode = '22023'; end if;
  if coalesce(length(trim(p_motivo)), 0) < 3 then raise exception 'Anota por qué se juntan' using errcode = '23514'; end if;
  -- Siempre en el mismo orden, para que dos juntas cruzadas no se bloqueen entre sí.
  perform 1 from articulos where id in (p_queda, p_sale) order by id for update;
  select * into q from articulos where id = p_queda;
  select * into s from articulos where id = p_sale;
  if q.id is null or s.id is null then raise exception 'Uno de los dos artículos no existe' using errcode = '22023'; end if;
  -- Uno ya inactivo sí se junta (puede seguir en listas o compras viejas); uno ya juntado, no.
  if exists (select 1 from articulos_juntados where sale_id = p_sale) then
    raise exception '% ya se juntó con otro artículo', s.clave using errcode = '23514';
  end if;
  if not q.activo then raise exception 'El que se queda (%) está inactivo', q.clave using errcode = '23514'; end if;
  if q.tipo <> s.tipo and not (q.tipo in ('componente', 'materia_prima') and s.tipo in ('componente', 'materia_prima')) then
    raise exception 'No son del mismo tipo: % es %, % es %', q.clave, q.tipo, s.clave, s.tipo using errcode = '23514';
  end if;
  if exists (select 1 from bom_lineas where padre_id = p_sale) and exists (select 1 from bom_lineas where padre_id = p_queda) then
    raise exception 'Los dos tienen su propia lista de materiales: revisa cuál es la buena antes de juntarlos' using errcode = '23514';
  end if;
  select array_agg(distinct padre_id) into v_padres from bom_lineas where hijo_id in (p_queda, p_sale);

  set local session_replication_role = replica;

  -- Existencias: se suman por almacén.
  insert into existencias (articulo_id, almacen_id, cantidad, actualizado_en)
  select p_queda, almacen_id, cantidad, now() from existencias where articulo_id = p_sale
  on conflict (articulo_id, almacen_id) do update set cantidad = existencias.cantidad + excluded.cantidad, actualizado_en = now();
  delete from existencias where articulo_id = p_sale;
  get diagnostics v_n = row_count; v_movido := v_movido || jsonb_build_object('existencias', v_n);

  -- Uno por artículo: si el que se queda ya tiene, se conserva el suyo.
  delete from costos_articulo where articulo_id = p_sale and exists (select 1 from costos_articulo where articulo_id = p_queda);
  delete from precios_lista where articulo_id = p_sale and exists (select 1 from precios_lista where articulo_id = p_queda);
  delete from costos_calculados where articulo_id = p_sale;   -- se recalcula al final
  -- Donde el que se queda ya está, el del que sale sobra.
  delete from articulo_parametros x where x.articulo_id = p_sale
    and exists (select 1 from articulo_parametros y where y.articulo_id = p_queda and y.nombre = x.nombre);
  delete from bom_operaciones x where x.articulo_id = p_sale
    and exists (select 1 from bom_operaciones y where y.articulo_id = p_queda and y.etapa_id = x.etapa_id);
  delete from conteo_articulos x where x.articulo_id = p_sale
    and exists (select 1 from conteo_articulos y where y.articulo_id = p_queda and y.conteo_id = x.conteo_id);
  delete from refacciones_maquina x where x.articulo_id = p_sale
    and exists (select 1 from refacciones_maquina y where y.articulo_id = p_queda
                and y.categoria is not distinct from x.categoria and y.modelo is not distinct from x.modelo);
  -- El mismo renglón en un conteo: se contaron por separado, lo físico es la suma.
  update conteo_lineas y set cantidad_contada = y.cantidad_contada + x.cantidad_contada,
         sistema_al_contar = coalesce(y.sistema_al_contar, 0) + coalesce(x.sistema_al_contar, 0)
  from conteo_lineas x where x.articulo_id = p_sale and y.articulo_id = p_queda and y.conteo_id = x.conteo_id;
  delete from conteo_lineas x where x.articulo_id = p_sale
    and exists (select 1 from conteo_lineas y where y.articulo_id = p_queda and y.conteo_id = x.conteo_id);
  -- El mismo material en una orden: se suma lo requerido y lo surtido.
  for r in select x.id sale_linea, y.id queda_linea from op_materiales x join op_materiales y
           on y.orden_id = x.orden_id and y.articulo_id = p_queda where x.articulo_id = p_sale loop
    update op_materiales y set requerido = y.requerido + x.requerido, surtido = y.surtido + x.surtido,
           requerido_antes = case when y.requerido_antes is null and x.requerido_antes is null then null
                                  else coalesce(y.requerido_antes, y.requerido) + coalesce(x.requerido_antes, x.requerido) end
    from op_materiales x where x.id = r.sale_linea and y.id = r.queda_linea;
    update op_materiales set reemplaza_a = r.queda_linea where reemplaza_a = r.sale_linea;
    delete from op_materiales where id = r.sale_linea;
  end loop;
  -- La misma pieza en una lista de materiales, las dos con cantidad fija: un renglón con la suma.
  for r in select x.id sale_linea, y.id queda_linea from bom_lineas x join bom_lineas y
           on y.padre_id = x.padre_id and y.hijo_id = p_queda
           where x.hijo_id = p_sale and x.parametro is null and y.parametro is null loop
    update bom_lineas y set cantidad = y.cantidad + x.cantidad from bom_lineas x where x.id = r.sale_linea and y.id = r.queda_linea;
    delete from bom_lineas where id = r.sale_linea;
  end loop;

  -- Todo lo demás: cada columna que apunta a articulos.
  for r in select c.conrelid::regclass as tabla, a.attname as columna
           from pg_constraint c join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any (c.conkey)
           where c.contype = 'f' and c.confrelid = 'public.articulos'::regclass
             and c.conrelid not in ('public.articulos_juntados'::regclass, 'public.existencias'::regclass) loop
    execute format('update %s set %I = $1 where %I = $2', r.tabla, r.columna, r.columna) using p_queda, p_sale;
    get diagnostics v_n = row_count;
    if v_n > 0 then v_movido := v_movido || jsonb_build_object(r.tabla::text || '.' || r.columna, v_n); end if;
  end loop;

  set local session_replication_role = origin;

  update articulos set activo = false,
    descripcion = concat_ws(E'\n', nullif(descripcion, ''),
      format('Se juntó con %s (%s) el %s: %s', q.clave, q.nombre, to_char(hoy_planta(), 'DD/MM/YYYY'), trim(p_motivo)))
  where id = p_sale;
  insert into articulos_juntados (sale_id, queda_id, motivo, movido) values (p_sale, p_queda, trim(p_motivo), v_movido);
  perform recalcular_costos(array[p_queda] || coalesce(v_padres, '{}'));
  return jsonb_build_object('ok', true, 'queda', q.clave, 'sale', s.clave, 'movido', v_movido);
end $$;
revoke execute on function public.juntar_articulos(uuid, uuid, text) from public, anon;
grant execute on function public.juntar_articulos(uuid, uuid, text) to authenticated;

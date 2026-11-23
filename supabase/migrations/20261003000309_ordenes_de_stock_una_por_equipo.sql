-- =============================================================================
-- Orden para stock: una orden por equipo, y cancelar una orden recién creada no deja huecos.
--
-- Por qué: el 23 de noviembre la gerencia de producción pidió 4 Cribadoras V3 para stock y salió
-- una sola orden por 4 piezas: el material y las horas multiplicados por 4 en una orden, sin
-- número de serie (una orden de varias piezas no lleva) y sin poder avanzar cada equipo por
-- separado. Desde un pedido siempre ha sido una orden por unidad; para stock se pasaba la
-- cantidad tal cual. La orden hubo que pedirla quitar a dirección, cuando la gerencia ya puede
-- cancelarla: pero cancelar se sentía caro, porque la orden cancelada se quedaba con su número
-- de serie y el consecutivo ya gastado (el 20 de noviembre se regresaron a mano).
--
-- Qué cambia:
--   · crear_ordenes_stock(): un equipo con cantidad N son N órdenes de una pieza, cada una con
--     su serie. Un subensamble sigue siendo una orden por el lote. La regla va en la base para
--     que diga lo mismo desde cualquier pantalla.
--   · cancelar_orden(): si la orden no había arrancado (planeada, sin nada surtido ni etapas
--     iniciadas), su número de serie queda libre; y si era el último consecutivo de su familia,
--     el consecutivo regresa. Una orden que ya arrancó conserva su serie: puede tener placa.
-- =============================================================================

create or replace function public.crear_ordenes_stock(
  p_articulo uuid, p_cantidad integer default 1, p_fecha_compromiso date default null,
  p_prioridad integer default 2, p_numero_serie text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_tipo tipo_articulo; v_id uuid; v_primera uuid; v_folios text[] := '{}'; v_n int;
begin
  if not puede('produccion', 2) then raise exception 'Sin permiso para crear órdenes de producción' using errcode = '42501'; end if;
  if coalesce(p_cantidad, 0) < 1 then raise exception 'La cantidad tiene que ser 1 o más' using errcode = '22023'; end if;
  if p_cantidad > 50 then raise exception 'Son muchas de un jalón (%): crea 50 o menos por vez', p_cantidad using errcode = '22023'; end if;
  select tipo into v_tipo from articulos where id = p_articulo;
  -- Un equipo es una unidad con su serie; un subensamble se fabrica por lote en una sola orden.
  v_n := case when v_tipo = 'equipo' then p_cantidad else 1 end;
  if v_n > 1 and nullif(trim(coalesce(p_numero_serie, '')), '') is not null then
    raise exception 'Un número de serie es de un solo equipo: crea las órdenes y ponlo en la que le toca' using errcode = '22023';
  end if;
  for i in 1 .. v_n loop
    v_id := crear_orden_produccion(p_articulo, case when v_tipo = 'equipo' then 1 else p_cantidad end, null,
                                   p_fecha_compromiso, p_prioridad, nullif(trim(coalesce(p_numero_serie, '')), ''));
    v_primera := coalesce(v_primera, v_id);
    v_folios := v_folios || (select folio from ordenes_produccion where id = v_id);
  end loop;
  return jsonb_build_object('ordenes', v_n, 'primera', v_primera, 'folios', to_jsonb(v_folios));
end $$;
revoke execute on function public.crear_ordenes_stock(uuid, integer, date, integer, text) from public, anon;
grant execute on function public.crear_ordenes_stock(uuid, integer, date, integer, text) to authenticated;

-- cancelar_orden: se parcha la definición viva para no pisar lo que haya cambiado.
do $$
declare v_def text := pg_get_functiondef('public.cancelar_orden(uuid, text)'::regprocedure);
  v_decl text := 'declare o ordenes_produccion; v_surtido boolean;';
  v_ancla text := 'update requisicion_lineas set estado = ''cancelada'' where orden_produccion_id = p_op and estado = ''pendiente'';';
begin
  if v_def like '%v_serie_libre%' then return; end if;
  if position(v_decl in v_def) = 0 or position(v_ancla in v_def) = 0 then
    raise exception 'cancelar_orden ya no es la que se conocía: revisar antes de liberar la serie al cancelar';
  end if;
  v_def := replace(v_def, v_decl, 'declare o ordenes_produccion; v_surtido boolean; v_serie_libre text; v_fam text; v_cod text;');
  v_def := replace(v_def, v_ancla, v_ancla || $parche$
  -- Una orden que no arrancó no tiene placa: su serie queda libre, y el consecutivo regresa si
  -- era el último de su familia (cancelando de la más nueva a la más vieja no queda ningún hueco).
  if o.estado = 'planeada' and not v_surtido and o.numero_serie is not null
     and not exists (select 1 from op_operaciones x where x.orden_id = p_op and x.inicio is not null) then
    v_serie_libre := o.numero_serie;
    select familia_serie, codigo_serie into v_fam, v_cod from articulos where id = o.articulo_id;
    update ordenes_produccion set numero_serie = null where id = p_op;
    if v_cod is not null then
      update familias_serie set ultimo = ultimo - 1
      where clave = v_fam and ultimo > 0 and v_serie_libre = v_cod || lpad(ultimo::text, 3, '0');
    end if;
    insert into op_eventos (orden_id, tipo, nota) values (p_op, 'nota', 'Su número de serie ' || v_serie_libre || ' quedó libre: la orden no había arrancado.');
  end if;$parche$);
  execute v_def;
end $$;

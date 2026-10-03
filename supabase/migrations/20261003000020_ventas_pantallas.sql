-- =============================================================================
-- Pantallas de ventas (CRM y cotizador): lo que les faltaba a la base.
--
-- Al armar el editor de cotizaciones salieron huecos que la pantalla no debe
-- tapar con un `if` de React, porque la regla vive aquí:
--
--  1. Cambiar el descuento general, el tipo de cambio o el IVA de una
--     cotización tronaba ("record new has no field cotizacion_id"): el
--     disparador del encabezado reusaba la función de las partidas.
--  2. ficha_venta() corre como el vendedor, que no ve politicas_precio (es de
--     costos): le mostraba un precio mínimo de −10 % cuando la base marca
--     "bajo el mínimo" a −9.09 % en componentes. El vendedor cotizaba a un
--     precio "permitido" y le salía la insignia roja.
--  3. Un vendedor podía saltarse la autorización de la gerencia: ponerse él
--     mismo en autorizada_por, poner requiere_autorizacion = false en el mismo
--     update que lo envía, mandar la partida con precio_lista nulo (así no hay
--     mínimo contra qué comparar) o bajar el precio después de autorizado.
--  4. comisiones_mes() devolvía total = 0 siempre ("se completa abajo").
--  5. nueva_version_cotizacion() le cambiaba el dueño a la cotización cuando la
--     versión la sacaba la gerente.
--
-- Y lo nuevo que piden las pantallas: alta de cotización con las condiciones
-- por defecto, agregar partida con el precio ya en la moneda de la cotización,
-- cambiar moneda o "IVA incluido" convirtiendo precios, duplicar, pedir
-- autorización con nota, rechazar con motivo, días en la etapa de una
-- oportunidad, entregar pedido, y vistas para las listas.
--
-- Todo es idempotente (create or replace / if not exists) porque la base local
-- es compartida y esta migración se aplica con psql sobre una base viva.
-- =============================================================================

alter table public.cotizaciones add column if not exists autorizacion_pedida_en timestamptz;
alter table public.cotizaciones add column if not exists nota_autorizacion text;
alter table public.cotizaciones add column if not exists autorizada_en timestamptz;
-- "Días en la etapa" del tablero: actualizado_en cambia con cualquier edición
-- (una nota, el monto) y no sirve para saber cuánto lleva atorada.
alter table public.oportunidades add column if not exists etapa_desde timestamptz not null default now();

-- ----------------------------------------------------------------------------
-- 1. Precio mínimo: el que ve el vendedor es el mismo con el que lo juzga la base
-- ----------------------------------------------------------------------------

-- Expone solo el descuento máximo de la política (lo que el BUSCADOR mostraba
-- como "Precio Mínimo Neto"), nunca el costo ni la utilidad. Sin sesión
-- (migraciones, scripts de servicio) también responde, para que el recálculo
-- interno no se quede sin mínimo.
create or replace function public.descuento_maximo_de(p_articulo uuid) returns numeric
language sql stable security definer set search_path = public as $$
  select coalesce((select pp.descuento_maximo from politicas_precio pp where pp.id = politica_de(p_articulo)), 0.10)
  where auth.uid() is null or puede('ventas', 1) or puede('costos', 1)
$$;

-- Lo que el vendedor ve al elegir una partida (el panel del BUSCADOR). Mismas
-- llaves que antes, más lo que el editor necesita para no hacer otra consulta.
create or replace function public.ficha_venta(p_articulo uuid) returns jsonb
language sql stable security invoker as $$
  select jsonb_build_object(
    'clave', a.clave, 'nombre', a.nombre, 'tipo', a.tipo, 'unidad', a.unidad, 'imagen_url', a.imagen_url,
    'es_importado', a.es_importado,
    'precio', pl.precio,
    'precio_minimo', round(pl.precio * (1 - coalesce(descuento_maximo_de(a.id), 0.10)), 2),
    'descuento_maximo', coalesce(descuento_maximo_de(a.id), 0.10),
    'existencia', (select sum(e.cantidad) from existencias e join almacenes al on al.id = e.almacen_id
                   where e.articulo_id = a.id and al.disponible_para_planta),
    'apartado', (select sum(r.cantidad - r.surtido) from reservas r where r.articulo_id = a.id and r.estado = 'activa'),
    'en_mercadolibre', (select sum(e.cantidad) from existencias e join almacenes al on al.id = e.almacen_id
                        where e.articulo_id = a.id and not al.disponible_para_planta),
    'tiempo_entrega_dias', coalesce(a.tiempo_entrega_dias, prov.dias_entrega),
    'envio_gratis', (not x.excluido and pl.precio * 1.16 >= (cfg.valor->>'desde_neto')::numeric),
    -- Desde cuántas piezas aplica (la "cantidad mínima" de la hoja); null = nunca (bandas, cangilones, Tapco).
    'envio_gratis_desde', case when x.excluido or coalesce(pl.precio, 0) = 0 then null
                               else greatest(ceil((cfg.valor->>'desde_neto')::numeric / (pl.precio * 1.16)), 1) end,
    'precio_ml', precio_canal(a.id, 'mercadolibre'),
    'precio_ml_con_envio', precio_canal(a.id, 'mercadolibre', true),
    'publicacion_ml', (select jsonb_build_object('precio', p.precio, 'url', p.url, 'id_externo', p.id_externo, 'con_envio', p.con_envio)
                       from publicaciones p where p.articulo_id = a.id and p.canal = 'mercadolibre' and p.estado = 'activa'
                       order by p.actualizado_en desc limit 1),
    'actualizado', pl.calculado_en
  )
  from articulos a
  left join precios_lista pl on pl.articulo_id = a.id
  left join proveedores prov on prov.id = a.proveedor_id
  cross join (select valor from configuracion where clave = 'envio_gratis') cfg
  cross join lateral (select exists (select 1 from jsonb_array_elements_text(cfg.valor->'excluir_palabras') w
                                     where sin_acentos(a.nombre) like '%' || sin_acentos(w) || '%') as excluido) x
  where a.id = p_articulo
$$;

-- ----------------------------------------------------------------------------
-- 2. Autorización de precios bajo el mínimo, sin puertas traseras
-- ----------------------------------------------------------------------------

-- Una partida está bajo el mínimo si su precio efectivo (MXN, sin IVA, con los
-- dos descuentos) queda abajo de lista × (1 − descuento máximo de su política).
create or replace function public.partida_bajo_minimo(l public.cotizacion_lineas, c public.cotizaciones) returns boolean
language sql stable as $$
  select coalesce(
    l.articulo_id is not null and l.precio_lista is not null and not l.opcional and
    (l.precio_unitario * (1 - l.descuento_pct) * (1 - c.descuento_pct) * c.tipo_cambio
       / case when c.precios_con_iva then 1 + c.tasa_iva else 1 end)
    < l.precio_lista * (1 - coalesce(descuento_maximo_de(l.articulo_id), 0.10)) - 0.005, false)
$$;

-- Se calcula contra los precios de verdad: la bandera guardada (bajo_minimo,
-- requiere_autorizacion) es solo para pintar la pantalla y alguien la puede tocar.
create or replace function public.cotizacion_bajo_minimo(c public.cotizaciones) returns boolean
language sql stable as $$
  select exists (select 1 from cotizacion_lineas l where l.cotizacion_id = c.id and partida_bajo_minimo(l, c))
$$;

-- La foto del precio de lista la toma la base, no la manda la pantalla: con
-- precio_lista nulo o en cero no había mínimo contra qué comparar.
create or replace function public.trg_partida_precio_lista() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' or new.articulo_id is distinct from old.articulo_id then
    new.precio_lista := (select precio from precios_lista where articulo_id = new.articulo_id);
  else
    new.precio_lista := old.precio_lista;
  end if;
  return new;
end $$;
create or replace trigger fijar_precio_lista before insert or update on public.cotizacion_lineas
  for each row execute function public.trg_partida_precio_lista();

create or replace function public.recalcular_cotizacion(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare c cotizaciones; v_sub numeric; v_desc numeric; v_bajo boolean;
begin
  select * into c from cotizaciones where id = p_id;
  if not found then return; end if;

  update cotizacion_lineas l set bajo_minimo = partida_bajo_minimo(l, c)
  where l.cotizacion_id = p_id and l.bajo_minimo is distinct from partida_bajo_minimo(l, c);

  select coalesce(sum(importe), 0), coalesce(bool_or(bajo_minimo), false) into v_sub, v_bajo
  from cotizacion_lineas where cotizacion_id = p_id;
  v_desc := round(v_sub * c.descuento_pct, 2);
  update cotizaciones set
    subtotal = case when c.precios_con_iva then round((v_sub - v_desc) / (1 + c.tasa_iva), 2) + v_desc else v_sub end,
    descuento = v_desc,
    iva = case when c.precios_con_iva then v_sub - v_desc - round((v_sub - v_desc) / (1 + c.tasa_iva), 2)
               else round((v_sub - v_desc) * c.tasa_iva, 2) end,
    total = case when c.precios_con_iva then v_sub - v_desc else round((v_sub - v_desc) * (1 + c.tasa_iva), 2) end,
    requiere_autorizacion = v_bajo,
    estado = case when v_bajo and c.estado in ('borrador', 'autorizada') and c.autorizada_por is null then 'por_autorizar'
                  when not v_bajo and c.estado = 'por_autorizar' then 'borrador'
                  -- Autorizada sin autorización vigente (le cambiaron el descuento y ya no hace falta): vuelve a borrador.
                  when not v_bajo and c.estado = 'autorizada' and c.autorizada_por is null then 'borrador'
                  else c.estado end,
    autorizacion_pedida_en = case when v_bajo then c.autorizacion_pedida_en end
  where id = p_id;
end $$;

-- Partidas: si cambia dinero en una cotización ya autorizada, la gerencia
-- autorizó OTROS precios y la autorización deja de valer.
create or replace function public.trg_lineas_cotizacion() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_cot uuid := case when tg_op = 'DELETE' then old.cotizacion_id else new.cotizacion_id end;
begin
  update cotizaciones set autorizada_por = null, autorizada_en = null, autorizacion_pedida_en = null,
         estado = case when estado = 'autorizada' then 'borrador' else estado end
  where id = v_cot and autorizada_por is not null and estado in ('borrador', 'por_autorizar', 'autorizada');
  perform recalcular_cotizacion(v_cot);
  return null;
end $$;

-- Encabezado: su propia función (antes usaba la de partidas y tronaba).
create or replace function public.trg_encabezado_cotizacion() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform recalcular_cotizacion(new.id);
  return null;
end $$;
create or replace trigger recalcular_encabezado after update of descuento_pct, tipo_cambio, precios_con_iva, tasa_iva
  on public.cotizaciones for each row execute function public.trg_encabezado_cotizacion();

create or replace function public.trg_cotizacion() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  -- Sin sesión = migración o script de servicio.
  v_gerente boolean := auth.uid() is null or puede('ventas', 3);
  v_op uuid;
begin
  if tg_op = 'INSERT' then
    if coalesce(new.folio, '') = '' then new.folio := siguiente_folio('COT'); end if;
    -- Nadie crea una cotización "ya autorizada".
    if not v_gerente then
      new.autorizada_por := null; new.autorizada_en := null;
      if new.estado <> 'borrador' then new.estado := 'borrador'; end if;
    end if;
    return new;
  end if;

  if new.autorizada_por is distinct from old.autorizada_por and new.autorizada_por is not null and not v_gerente then
    raise exception 'Solo la gerencia de ventas autoriza precios bajo el mínimo' using errcode = '42501';
  end if;
  if new.estado = 'autorizada' and old.estado <> 'autorizada' and not v_gerente then
    raise exception 'Solo la gerencia de ventas autoriza precios bajo el mínimo' using errcode = '42501';
  end if;
  -- Cambiar descuento, tipo de cambio o IVA invalida la autorización anterior.
  if (new.descuento_pct, new.tipo_cambio, new.precios_con_iva, new.tasa_iva)
     is distinct from (old.descuento_pct, old.tipo_cambio, old.precios_con_iva, old.tasa_iva) then
    new.autorizada_por := null; new.autorizada_en := null; new.autorizacion_pedida_en := null;
  end if;

  if new.estado in ('enviada', 'aceptada') and old.estado not in ('enviada', 'aceptada')
     and new.autorizada_por is null and cotizacion_bajo_minimo(new) then
    raise exception 'Esta cotización tiene precios abajo del mínimo: necesita autorización de la gerencia antes de enviarse'
      using errcode = '42501';
  end if;

  if new.estado = 'enviada' and old.estado <> 'enviada' then
    new.enviada_en := coalesce(new.enviada_en, now());
    -- El embudo se llena solo: cotizar ES mover la oportunidad a "cotizado", y
    -- si el vendedor no la abrió antes, se abre aquí (nadie captura dos veces).
    if new.oportunidad_id is null and new.cliente_id is not null then
      insert into oportunidades (cliente_id, contacto_id, titulo, etapa, linea, monto_estimado, vendedor_id, fecha_cierre_estimada)
      values (new.cliente_id, new.contacto_id,
              coalesce((select l.titulo from cotizacion_lineas l where l.cotizacion_id = new.id and not l.opcional order by l.orden limit 1),
                       'Cotización ' || new.folio),
              'cotizado',
              coalesce((select linea_de(l.articulo_id) from cotizacion_lineas l where l.cotizacion_id = new.id and not l.opcional
                        order by (linea_de(l.articulo_id) = 'maquinaria') desc, l.orden limit 1), 'maquinaria'),
              round((new.total - new.iva) * new.tipo_cambio, 2), new.vendedor_id, new.fecha + new.vigencia_dias)
      returning id into v_op;
      new.oportunidad_id := v_op;
    elsif new.oportunidad_id is not null then
      update oportunidades set etapa = 'cotizado', monto_estimado = coalesce(monto_estimado, round((new.total - new.iva) * new.tipo_cambio, 2))
      where id = new.oportunidad_id and etapa in ('prospecto', 'contactado');
    end if;
  end if;

  if new.estado in ('aceptada', 'rechazada', 'cancelada') and old.estado <> new.estado then
    new.cerrada_en := now();
  end if;
  return new;
end $$;

create or replace function public.autorizar_cotizacion(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not puede('ventas', 3) then raise exception 'Solo la gerencia de ventas autoriza precios bajo el mínimo' using errcode = '42501'; end if;
  update cotizaciones set autorizada_por = auth.uid(), autorizada_en = now(), estado = 'autorizada'
  where id = p_id and estado = 'por_autorizar';
  if not found then
    raise exception 'Esa cotización ya no está esperando autorización (la autorizaron o le cambiaron precios)';
  end if;
end $$;

-- El vendedor avisa que ya terminó y explica por qué el descuento: la gerente
-- ve primero las que se pidieron, no los borradores a medio capturar.
create or replace function public.pedir_autorizacion(p_id uuid, p_nota text default null) returns void
language plpgsql security invoker as $$
begin
  update cotizaciones set autorizacion_pedida_en = now(), nota_autorizacion = nullif(trim(p_nota), '')
  where id = p_id and estado = 'por_autorizar';
  if not found then raise exception 'Solo se pide autorización cuando hay precios abajo del mínimo'; end if;
end $$;

-- ----------------------------------------------------------------------------
-- 3. Alta, partidas, moneda, versiones
-- ----------------------------------------------------------------------------

-- Cotización nueva con las condiciones por defecto de la gerencia (pago,
-- entrega y notas de textos_comerciales) y el contacto principal del cliente.
create or replace function public.nueva_cotizacion(p_cliente uuid default null, p_oportunidad uuid default null) returns uuid
language plpgsql security invoker as $$
declare v_id uuid; v_cli uuid := p_cliente; v_nombre text; v_razon text; v_contacto uuid; v_atencion text;
begin
  if not puede('ventas', 2) then raise exception 'Tu rol no puede cotizar' using errcode = '42501'; end if;
  if v_cli is null and p_oportunidad is not null then select cliente_id into v_cli from oportunidades where id = p_oportunidad; end if;
  select nombre, razon_social into v_nombre, v_razon from clientes where id = v_cli;
  -- Si el cliente es de otro vendedor, la RLS no da el contacto y queda vacío: correcto.
  select id, nombre into v_contacto, v_atencion from contactos where cliente_id = v_cli order by principal desc, creado_en limit 1;
  insert into cotizaciones (cliente_id, contacto_id, atencion, empresa, oportunidad_id, condiciones_pago, tiempo_entrega, notas)
  values (v_cli, v_contacto, v_atencion, coalesce(v_razon, v_nombre), p_oportunidad,
    (select texto from textos_comerciales where tipo = 'pago' and activo order by por_defecto desc, orden limit 1),
    (select texto from textos_comerciales where tipo = 'entrega' and activo order by por_defecto desc, orden limit 1),
    coalesce((select array_agg(texto order by orden) from textos_comerciales where tipo = 'nota' and activo and por_defecto), '{}'))
  returning id into v_id;
  return v_id;
end $$;

-- Partida desde el catálogo con el precio ya convertido: lista (MXN sin IVA)
-- ÷ tipo de cambio, × (1 + IVA) si la cotización es "IVA incluido". Es la
-- fórmula D11 de la plantilla, pero sin la celda oculta del tipo de cambio.
create or replace function public.agregar_partida(p_cotizacion uuid, p_articulo uuid, p_cantidad numeric default 1)
returns public.cotizacion_lineas language plpgsql security invoker as $$
declare r cotizacion_lineas;
begin
  insert into cotizacion_lineas (cotizacion_id, orden, articulo_id, titulo, descripcion, imagen_url, unidad, cantidad, precio_unitario)
  select c.id, coalesce((select max(orden) from cotizacion_lineas where cotizacion_id = c.id), 0) + 1,
    a.id, a.nombre, a.descripcion, a.imagen_url, a.unidad, coalesce(p_cantidad, 1),
    round(coalesce(pl.precio, 0) / c.tipo_cambio * case when c.precios_con_iva then 1 + c.tasa_iva else 1 end, 2)
  from cotizaciones c cross join articulos a
  left join precios_lista pl on pl.articulo_id = a.id
  where c.id = p_cotizacion and a.id = p_articulo
  returning * into r;
  if r.id is null then raise exception 'No encontré la cotización o el artículo'; end if;
  return r;
end $$;

-- Cambiar moneda, tipo de cambio o "IVA incluido" convierte los precios de las
-- partidas para que el total en pesos no se mueva. En la hoja solo se
-- convertían los precios por fórmula; los pegados a mano se quedaban en pesos.
create or replace function public.ajustar_moneda_cotizacion(p_id uuid, p_moneda public.moneda, p_tipo_cambio numeric default null,
                                                            p_precios_con_iva boolean default null) returns void
language plpgsql security invoker as $$
declare c cotizaciones; v_tc numeric; v_iva boolean; f numeric;
begin
  select * into c from cotizaciones where id = p_id;
  if c.id is null then raise exception 'No existe la cotización'; end if;
  if not cotizacion_editable(p_id) then raise exception 'Esta cotización ya se envió: saca una nueva versión para cambiarla'; end if;
  v_tc := case when p_moneda = 'MXN' then 1 else coalesce(nullif(p_tipo_cambio, 0), tc(p_moneda)) end;
  if v_tc <= 0 then raise exception 'El tipo de cambio tiene que ser mayor a cero'; end if;
  v_iva := coalesce(p_precios_con_iva, c.precios_con_iva);
  f := c.tipo_cambio / v_tc * (case when v_iva then 1 + c.tasa_iva else 1 end) / (case when c.precios_con_iva then 1 + c.tasa_iva else 1 end);
  if f <> 1 then
    update cotizacion_lineas set precio_unitario = round(precio_unitario * f, 2) where cotizacion_id = p_id;
  end if;
  update cotizaciones set moneda = p_moneda, tipo_cambio = v_tc, precios_con_iva = v_iva where id = p_id;
end $$;

-- Duplicar: misma propuesta para otro cliente o para empezar de algo parecido.
-- Folio nuevo, sin historia (para seguir la misma negociación está "nueva versión").
create or replace function public.duplicar_cotizacion(p_id uuid) returns uuid
language plpgsql security invoker as $$
declare v_nueva uuid;
begin
  insert into cotizaciones (cliente_id, contacto_id, atencion, empresa, vigencia_dias, moneda, tipo_cambio, tasa_iva, precios_con_iva,
    descuento_pct, leyenda_promocion, condiciones_pago, tiempo_entrega, notas, plan_meses, logo_comarca_url)
  select cliente_id, contacto_id, atencion, empresa, vigencia_dias, moneda, tipo_cambio, tasa_iva, precios_con_iva,
    descuento_pct, leyenda_promocion, condiciones_pago, tiempo_entrega, notas, plan_meses, logo_comarca_url
  from cotizaciones where id = p_id
  returning id into v_nueva;
  if v_nueva is null then raise exception 'No existe la cotización'; end if;
  insert into cotizacion_lineas (cotizacion_id, orden, articulo_id, titulo, descripcion, imagen_url, unidad, cantidad,
    precio_unitario, descuento_pct, opcional)
  select v_nueva, orden, articulo_id, titulo, descripcion, imagen_url, unidad, cantidad, precio_unitario, descuento_pct, opcional
  from cotizacion_lineas where cotizacion_id = p_id;
  return v_nueva;
end $$;

-- Nueva versión: igual que antes, pero la cotización sigue siendo del vendedor
-- aunque la versión la saque la gerente (antes se la quedaba ella y le movía
-- la comisión y la privacidad).
create or replace function public.nueva_version_cotizacion(p_id uuid) returns uuid
language plpgsql security invoker as $$
declare v_nueva uuid; v_raiz uuid; v_ver int; v_folio text;
begin
  select coalesce(origen_id, id) into v_raiz from cotizaciones where id = p_id;
  if v_raiz is null then raise exception 'No existe la cotización'; end if;
  select max(version) + 1 into v_ver from cotizaciones where id = v_raiz or origen_id = v_raiz;
  select regexp_replace(folio, '-v[0-9]+$', '') || '-v' || v_ver into v_folio from cotizaciones where id = v_raiz;
  insert into cotizaciones (folio, version, origen_id, cliente_id, contacto_id, atencion, empresa, oportunidad_id, vendedor_id,
    vigencia_dias, moneda, tipo_cambio, tasa_iva, precios_con_iva, descuento_pct, leyenda_promocion, condiciones_pago,
    tiempo_entrega, notas, plan_meses, logo_comarca_url)
  select v_folio, v_ver, v_raiz, cliente_id, contacto_id, atencion, empresa, oportunidad_id, vendedor_id,
    vigencia_dias, moneda, tipo_cambio, tasa_iva, precios_con_iva, descuento_pct, leyenda_promocion, condiciones_pago,
    tiempo_entrega, notas, plan_meses, logo_comarca_url
  from cotizaciones where id = p_id returning id into v_nueva;
  insert into cotizacion_lineas (cotizacion_id, orden, articulo_id, titulo, descripcion, imagen_url, unidad, cantidad,
    precio_unitario, descuento_pct, opcional)
  select v_nueva, orden, articulo_id, titulo, descripcion, imagen_url, unidad, cantidad, precio_unitario, descuento_pct, opcional
  from cotizacion_lineas l where cotizacion_id = p_id;
  return v_nueva;
end $$;

-- Rechazo con motivo obligatorio: "por qué se pierden ventas" no existe hoy en
-- ninguna hoja. Por defecto también cierra la oportunidad como perdida.
create or replace function public.rechazar_cotizacion(p_id uuid, p_motivo text, p_cerrar_oportunidad boolean default true) returns void
language plpgsql security invoker as $$
declare v_op uuid; v_ok boolean;
begin
  if coalesce(length(trim(p_motivo)), 0) < 3 then raise exception 'Escribe el motivo del rechazo'; end if;
  update cotizaciones set estado = 'rechazada', motivo_rechazo = trim(p_motivo)
  where id = p_id and estado not in ('aceptada', 'cancelada', 'rechazada')
  returning oportunidad_id, true into v_op, v_ok;
  if v_ok is null then raise exception 'Esa cotización ya está cerrada'; end if;
  if p_cerrar_oportunidad and v_op is not null then
    update oportunidades set etapa = 'perdida', motivo_perdida = trim(p_motivo)
    where id = v_op and etapa not in ('ganada', 'perdida')
      -- Si hay otra cotización viva en la misma oportunidad, la oportunidad sigue.
      and not exists (select 1 from cotizaciones c where c.oportunidad_id = v_op and c.id <> p_id
                      and c.estado in ('borrador', 'por_autorizar', 'autorizada', 'enviada'));
  end if;
end $$;

-- Cotización → pedido: la misma de antes, pero revisa el mínimo contra los
-- precios de verdad y no convierte cotizaciones rechazadas o canceladas.
create or replace function public.convertir_a_pedido(p_cotizacion uuid, p_fecha_compromiso date default null, p_partidas uuid[] default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare c cotizaciones; v_pedido uuid;
begin
  select * into c from cotizaciones where id = p_cotizacion;
  if c.id is null then raise exception 'No existe la cotización'; end if;
  if not ((c.vendedor_id = auth.uid() and puede('ventas', 2)) or puede('ventas', 3)) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  if c.cliente_id is null then raise exception 'Liga la cotización a un cliente antes de convertirla en pedido'; end if;
  if c.estado in ('rechazada', 'cancelada') then raise exception 'La cotización está %: saca una nueva versión', c.estado; end if;
  if c.autorizada_por is null and cotizacion_bajo_minimo(c) then
    raise exception 'La cotización tiene precios abajo del mínimo sin autorizar' using errcode = '42501';
  end if;
  if exists (select 1 from pedidos where cotizacion_id = p_cotizacion and estado <> 'cancelado') then
    raise exception 'Esta cotización ya tiene pedido';
  end if;
  if p_partidas is not null and cardinality(p_partidas) = 0 then raise exception 'Elige al menos una partida'; end if;

  insert into pedidos (cotizacion_id, cliente_id, vendedor_id, fecha_compromiso, moneda, tipo_cambio, tasa_iva, condiciones_pago, notas)
  values (c.id, c.cliente_id, c.vendedor_id, p_fecha_compromiso, c.moneda, c.tipo_cambio, c.tasa_iva, c.condiciones_pago,
          'Desde cotización ' || c.folio)
  returning id into v_pedido;

  -- El descuento general se reparte en cada partida; con IVA incluido se pasa a precio sin IVA.
  insert into pedido_lineas (pedido_id, orden, articulo_id, titulo, descripcion, unidad, cantidad, precio_unitario, descuento_pct, linea)
  select v_pedido, l.orden, l.articulo_id, l.titulo, l.descripcion, l.unidad, l.cantidad,
         round(l.precio_unitario / case when c.precios_con_iva then 1 + c.tasa_iva else 1 end, 2),
         1 - (1 - l.descuento_pct) * (1 - c.descuento_pct), linea_de(l.articulo_id)
  from cotizacion_lineas l
  where l.cotizacion_id = c.id and (case when p_partidas is null then not l.opcional else l.id = any(p_partidas) end);

  update cotizaciones set estado = 'aceptada' where id = c.id;
  update oportunidades set etapa = 'ganada', cerrada_en = now() where id = c.oportunidad_id;
  return v_pedido;
end $$;

-- ----------------------------------------------------------------------------
-- 4. Oportunidades: días en la etapa y motivo de pérdida obligatorio
-- ----------------------------------------------------------------------------
create or replace function public.trg_oportunidad() returns trigger
language plpgsql as $$
begin
  if tg_op = 'UPDATE' and new.etapa is distinct from old.etapa then
    new.etapa_desde := now();
    new.cerrada_en := case when new.etapa in ('ganada', 'perdida') then now() end;
  elsif tg_op = 'INSERT' then
    -- Al importar historia se respeta la fecha que traiga; si no, la de hoy (default).
    new.cerrada_en := case when new.etapa in ('ganada', 'perdida') then coalesce(new.cerrada_en, now()) end;
  end if;
  if new.etapa = 'perdida' and coalesce(length(trim(new.motivo_perdida)), 0) < 3 then
    raise exception 'Anota por qué se perdió: sin eso no sabemos qué corregir' using errcode = '23514';
  end if;
  if new.etapa <> 'perdida' then new.motivo_perdida := null; end if;
  return new;
end $$;
create or replace trigger etapa before insert or update on public.oportunidades for each row execute function public.trg_oportunidad();

-- ----------------------------------------------------------------------------
-- 5. Clientes: RFC en mayúsculas antes de validarlo
-- ----------------------------------------------------------------------------
-- El check de la tabla exige mayúsculas; "mhg160202ux1 " escrito en el celular
-- fallaba con un error de restricción en vez de guardarse bien.
create or replace function public.trg_normalizar_cliente() returns trigger
language plpgsql as $$
begin
  new.rfc := nullif(upper(regexp_replace(coalesce(new.rfc, ''), '[\s-]', '', 'g')), '');
  new.nombre := trim(new.nombre);
  return new;
end $$;
create or replace trigger normalizar before insert or update on public.clientes for each row execute function public.trg_normalizar_cliente();

-- ----------------------------------------------------------------------------
-- 6. Pedidos: cancelar con motivo, entregar, partidas desde catálogo
-- ----------------------------------------------------------------------------
create or replace function public.trg_pedido() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' and coalesce(new.folio, '') = '' then new.folio := siguiente_folio('PED'); end if;
  -- Un pedido de Mercado Libre que captura la vendedora es suyo si no dice otra cosa.
  if tg_op = 'INSERT' and new.vendedor_id is null and auth.uid() is not null and puede('ventas', 2) then
    new.vendedor_id := auth.uid();
  end if;
  if tg_op = 'UPDATE' and new.estado = 'entregado' and old.estado <> 'entregado' then new.entregado_en := now(); end if;
  if tg_op = 'UPDATE' and new.estado = 'cancelado' and old.estado <> 'cancelado'
     and coalesce(length(trim(new.motivo_cancelacion)), 0) < 3 then
    raise exception 'Anota el motivo de la cancelación' using errcode = '23514';
  end if;
  return new;
end $$;

-- Un vendedor no podía capturar un pedido (Mercado Libre, mostrador) con
-- insert … returning: la política de lectura lo buscaba con pedido_visible(id),
-- que todavía no ve la fila que se está insertando. Se revisa la columna directo.
-- Escrita con (select …) para que auth.uid() se evalúe una vez por consulta (ver 063).
alter policy ver on public.pedidos using (vendedor_id = (select auth.uid()) or pedido_visible(id));

create or replace function public.entregar_pedido(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare p pedidos;
begin
  select * into p from pedidos where id = p_id;
  if p.id is null then raise exception 'No existe el pedido'; end if;
  if not ((p.vendedor_id = auth.uid() and puede('ventas', 2)) or puede('ventas', 3) or puede('inventario', 2) or puede('produccion', 2)) then
    raise exception 'Sin permiso para entregar este pedido' using errcode = '42501';
  end if;
  if p.estado in ('entregado', 'cancelado') then raise exception 'El pedido ya está %', p.estado; end if;
  update pedido_lineas set cantidad_entregada = cantidad where pedido_id = p_id and cantidad_entregada <> cantidad;
  update pedidos set estado = 'entregado' where id = p_id;
end $$;

-- Pedidos sin cotización (Mercado Libre, sitio web, mostrador): partida con el
-- precio de lista en la moneda del pedido y su línea de comisión.
create or replace function public.agregar_partida_pedido(p_pedido uuid, p_articulo uuid, p_cantidad numeric default 1)
returns public.pedido_lineas language plpgsql security invoker as $$
declare r pedido_lineas;
begin
  insert into pedido_lineas (pedido_id, orden, articulo_id, titulo, descripcion, unidad, cantidad, precio_unitario, linea)
  select p.id, coalesce((select max(orden) from pedido_lineas where pedido_id = p.id), 0) + 1, a.id, a.nombre, a.descripcion, a.unidad,
    coalesce(p_cantidad, 1), round(coalesce(pl.precio, 0) / p.tipo_cambio, 2), linea_de(a.id)
  from pedidos p cross join articulos a
  left join precios_lista pl on pl.articulo_id = a.id
  where p.id = p_pedido and a.id = p_articulo
  returning * into r;
  if r.id is null then raise exception 'No encontré el pedido o el artículo (¿ya no está confirmado?)'; end if;
  return r;
end $$;

-- ----------------------------------------------------------------------------
-- 7. Comisiones: el total que faltaba y el detalle por pedido
-- ----------------------------------------------------------------------------
create or replace function public.comisiones_mes(p_mes date)
returns table (vendedor_id uuid, vendedor text, plan text, venta_maquinaria numeric, venta_refacciones numeric, venta_otros numeric,
               comision numeric, bono_meta numeric, bono_refacciones numeric, ajustes numeric, total numeric,
               siguiente_meta numeric, pagado_en date)
language sql stable security definer set search_path = public as $$
  with m as (select date_trunc('month', p_mes)::date as mes),
  base as (
    select pf.id, pf.nombre, pc.nombre plan, pc.id plan_id, pc.pct_maquinaria,
      coalesce(v.maquinaria, 0) maq, coalesce(v.refacciones, 0) ref, coalesce(v.otros, 0) otr,
      coalesce(v.maquinaria, 0) + case when pc.otros_como_maquinaria then coalesce(v.otros, 0) else 0 end as base_meta
    from vendedor_plan vp
    join perfiles pf on pf.id = vp.vendedor_id
    join planes_comision pc on pc.id = vp.plan_id
    cross join m
    left join ventas_vendedor_mes(m.mes) v on v.vendedor_id = pf.id
    -- Cada vendedor ve solo lo suyo; la gerencia, dirección y finanzas ven a todos.
    where pf.id = auth.uid() or puede('ventas', 3) or puede('finanzas', 1)
  ),
  calc as (
    select b.*,
      round(b.base_meta * b.pct_maquinaria, 2) com,
      coalesce((select e.bono from plan_escalones e where e.plan_id = b.plan_id and e.tipo = 'meta_maquinaria' and e.desde <= b.base_meta
                order by e.desde desc limit 1), 0) bmeta,
      coalesce((select e.bono from plan_escalones e where e.plan_id = b.plan_id and e.tipo = 'bono_refacciones' and e.desde <= b.ref
                order by e.desde desc limit 1), 0) bref,
      coalesce((select sum(a.monto) from comision_ajustes a cross join m where a.vendedor_id = b.id and a.mes = m.mes), 0) aj
    from base b
  )
  select c.id, c.nombre, c.plan, round(c.maq, 2), round(c.ref, 2), round(c.otr, 2), c.com, c.bmeta, c.bref, c.aj,
    c.com + c.bmeta + c.bref + c.aj,
    (select min(e.desde) from plan_escalones e where e.plan_id = c.plan_id and e.tipo = 'meta_maquinaria' and e.desde > c.base_meta),
    (select cp.pagado_en from comision_pagos cp cross join m where cp.vendedor_id = c.id and cp.mes = m.mes)
  from calc c
  order by c.nombre
$$;

-- Los pedidos que cuentan para la comisión de un vendedor en el mes (base
-- "pedido", la de hoy), ya con su parte del crédito compartido. security
-- invoker: cada quien ve el detalle de los pedidos que la RLS le deja ver.
create or replace function public.pedidos_comision(p_vendedor uuid, p_mes date)
returns table (pedido_id uuid, folio text, fecha date, cliente text, canal public.canal_venta, parte numeric,
               maquinaria numeric, refacciones numeric, otros numeric)
language sql stable security invoker as $$
  select p.id, p.folio, p.fecha, cl.nombre, p.canal, coalesce(pv.porcentaje, 100) / 100.0,
    round(coalesce(sum(l.importe * p.tipo_cambio) filter (where l.linea = 'maquinaria'), 0) * coalesce(pv.porcentaje, 100) / 100.0, 2),
    round(coalesce(sum(l.importe * p.tipo_cambio) filter (where l.linea = 'refacciones'), 0) * coalesce(pv.porcentaje, 100) / 100.0, 2),
    round(coalesce(sum(l.importe * p.tipo_cambio) filter (where l.linea = 'otros'), 0) * coalesce(pv.porcentaje, 100) / 100.0, 2)
  from pedidos p
  join clientes cl on cl.id = p.cliente_id
  join pedido_lineas l on l.pedido_id = p.id
  left join pedido_vendedores pv on pv.pedido_id = p.id and pv.vendedor_id = p_vendedor
  where p.estado <> 'cancelado' and date_trunc('month', p.fecha) = date_trunc('month', p_mes)
    and (pv.vendedor_id is not null
         or (p.vendedor_id = p_vendedor and not exists (select 1 from pedido_vendedores x where x.pedido_id = p.id)))
  group by p.id, cl.nombre, pv.porcentaje
  order by p.fecha, p.folio
$$;

-- Mensualidad a meses con tarjeta: una sola fórmula (la de la plantilla, no la
-- del BUSCADOR, que daba mensualidades más bajas): total ÷ (1 − tasa) ÷ meses.
create or replace function public.mensualidad(p_total numeric, p_meses int) returns numeric
language sql stable as $$
  select round(p_total / (1 - pm.tasa) / pm.meses, 2) from planes_meses pm where pm.meses = p_meses
$$;

-- ----------------------------------------------------------------------------
-- 8. Vistas para las listas (security_invoker: la RLS de cada tabla decide)
-- ----------------------------------------------------------------------------

-- La base corre en UTC: a las 7 de la tarde en Atotonilco current_date ya es
-- "mañana" y una cotización salía vencida un día antes. Las fechas del negocio
-- (folio, emisión) ya se toman en hora de México; las vistas también.
create or replace function public.hoy_mx() returns date
language sql stable as $$ select (now() at time zone 'America/Mexico_City')::date $$;

-- Solo las pantallas de ventas leen estas vistas: se rehacen completas para
-- poder agregar columnas al volver a aplicar la migración.
drop view if exists public.v_cotizaciones, public.v_pedidos, public.v_clientes, public.v_oportunidades;

create or replace view public.v_cotizaciones with (security_invoker = true) as
select c.id, c.folio, c.version, c.origen_id, c.fecha, c.vigencia_dias, c.fecha + c.vigencia_dias as vence, c.estado,
  c.cliente_id, cl.nombre as cliente, c.contacto_id, c.atencion, c.empresa, c.oportunidad_id,
  c.vendedor_id, pf.nombre as vendedor, pf.iniciales,
  c.moneda, c.tipo_cambio, c.precios_con_iva, c.subtotal, c.descuento, c.iva, c.total,
  round((c.total - c.iva) * c.tipo_cambio, 2) as neto_mxn,
  c.requiere_autorizacion, c.autorizada_por, c.autorizada_en, c.autorizacion_pedida_en, c.nota_autorizacion,
  c.enviada_en, c.cerrada_en, c.motivo_rechazo, c.plan_meses,
  (c.estado in ('borrador', 'por_autorizar', 'autorizada', 'enviada') and c.fecha + c.vigencia_dias < hoy_mx()) as vencida,
  (select count(*) from public.cotizacion_lineas l where l.cotizacion_id = c.id) as partidas,
  (select count(*) from public.cotizacion_lineas l where l.cotizacion_id = c.id and l.bajo_minimo) as partidas_bajo_minimo,
  (select l.titulo from public.cotizacion_lineas l where l.cotizacion_id = c.id and not l.opcional order by l.orden limit 1) as primera_partida,
  (select p.id from public.pedidos p where p.cotizacion_id = c.id and p.estado <> 'cancelado' limit 1) as pedido_id,
  c.creado_en, c.actualizado_en
from public.cotizaciones c
left join public.clientes cl on cl.id = c.cliente_id
left join public.perfiles pf on pf.id = c.vendedor_id;

-- Los pedidos "históricos" de los paneles (importación, 060) cuentan para el
-- historial y las comisiones pero no son cuentas por cobrar: saldo 0. La
-- columna llega en una migración posterior a esta, por eso se lee con to_jsonb
-- (si todavía no existe, todos son del ERP).
create or replace view public.v_pedidos with (security_invoker = true) as
select p.id, p.folio, p.fecha, p.fecha_compromiso, p.estado, p.canal, p.id_externo,
  coalesce((to_jsonb(p) ->> 'historico')::boolean, false) as historico,
  p.cliente_id, cl.nombre as cliente, p.vendedor_id, pf.nombre as vendedor,
  p.cotizacion_id, ct.folio as cotizacion_folio, p.moneda, p.tipo_cambio, p.subtotal, p.iva, p.total,
  coalesce(cb.cobrado, 0) as cobrado,
  case when p.estado = 'cancelado' or coalesce((to_jsonb(p) ->> 'historico')::boolean, false) then 0
       else p.total - coalesce(cb.cobrado, 0) end as saldo,
  exists (select 1 from public.facturas f where f.pedido_id = p.id) as facturado,
  op.ordenes, op.terminadas, op.avance,
  (p.fecha_compromiso < hoy_mx() and p.estado not in ('entregado', 'cancelado')) as atrasado,
  (select count(*) from public.pedido_vendedores v where v.pedido_id = p.id) > 1 as credito_compartido,
  p.entregado_en, p.motivo_cancelacion, p.creado_en
from public.pedidos p
join public.clientes cl on cl.id = p.cliente_id
left join public.perfiles pf on pf.id = p.vendedor_id
left join public.cotizaciones ct on ct.id = p.cotizacion_id
left join lateral (select sum(c.monto) cobrado from public.cobros c where c.pedido_id = p.id) cb on true
-- Avance de producción: horas terminadas / horas de todas sus órdenes. Quien no
-- ve producción (finanzas) recibe null aquí, que es lo correcto.
left join lateral (
  select count(*) ordenes,
    count(*) filter (where o.estado in ('terminada', 'entregada')) terminadas,
    round(avg(case when o.estado in ('terminada', 'entregada') then 100
                   when h.total > 0 then 100 * h.hechas / h.total else 0 end)) avance
  from public.ordenes_produccion o
  left join lateral (select sum(x.horas_estimadas) total, coalesce(sum(x.horas_estimadas) filter (where x.estado = 'terminada'), 0) hechas
                     from public.op_operaciones x where x.orden_id = o.id) h on true
  where o.pedido_id = p.id and o.estado <> 'cancelada'
) op on true;

create or replace view public.v_clientes with (security_invoker = true) as
select c.id, c.nombre, c.razon_social, c.rfc, c.giro, c.ciudad, c.estado, c.pais, c.vendedor_id, pf.nombre as vendedor,
  c.es_distribuidor, c.dias_credito, c.activo, c.fuente_id, c.creado_en,
  -- Solo de los pedidos que la RLS deja ver: la historia de un cliente ajeno es privada.
  (select max(p.fecha) from public.pedidos p where p.cliente_id = c.id and p.estado <> 'cancelado') as ultima_compra,
  (select coalesce(sum((p.total - coalesce((select sum(cb.monto) from public.cobros cb where cb.pedido_id = p.id), 0)) * p.tipo_cambio), 0)
   from public.pedidos p where p.cliente_id = c.id and p.estado <> 'cancelado'
     and not coalesce((to_jsonb(p) ->> 'historico')::boolean, false)) as saldo,
  (select coalesce(sum(p.subtotal * p.tipo_cambio), 0) from public.pedidos p
   where p.cliente_id = c.id and p.estado <> 'cancelado' and p.fecha >= current_date - 365) as compras_12m,
  (select count(*) from public.cotizaciones q where q.cliente_id = c.id
   and q.estado in ('borrador', 'por_autorizar', 'autorizada', 'enviada')) as cotizaciones_abiertas
from public.clientes c
left join public.perfiles pf on pf.id = c.vendedor_id;

create or replace view public.v_oportunidades with (security_invoker = true) as
select o.id, o.cliente_id, cl.nombre as cliente, o.contacto_id, o.titulo, o.etapa, o.linea, o.canal, o.monto_estimado,
  o.probabilidad, o.fecha_cierre_estimada, o.vendedor_id, pf.nombre as vendedor, o.fuente_id, fc.nombre as fuente,
  o.motivo_perdida, o.cerrada_en, o.notas, o.orden, o.etapa_desde,
  (hoy_mx() - (o.etapa_desde at time zone 'America/Mexico_City')::date) as dias_en_etapa,
  t.id as tarea_id, t.descripcion as tarea, t.vence_en as tarea_vence,
  (select count(*) from public.cotizaciones c where c.oportunidad_id = o.id) as cotizaciones,
  (select c.total from public.cotizaciones c where c.oportunidad_id = o.id order by c.creado_en desc limit 1) as ultima_cotizacion_total,
  o.creado_en, o.actualizado_en
from public.oportunidades o
join public.clientes cl on cl.id = o.cliente_id
left join public.perfiles pf on pf.id = o.vendedor_id
left join public.fuentes_contacto fc on fc.id = o.fuente_id
left join lateral (select a.id, a.descripcion, a.vence_en from public.actividades a
                   where a.oportunidad_id = o.id and not a.hecha and a.vence_en is not null
                   order by a.vence_en limit 1) t on true;

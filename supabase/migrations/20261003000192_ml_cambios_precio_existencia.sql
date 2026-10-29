-- =============================================================================
-- Mercado Libre, fase 2: el ERP corrige precio y existencia de las publicaciones.
--
-- En la fase 1 el tablero solo marcaba lo que no cuadra («más barato que el sugerido», «publica
-- más de lo que hay») y alguien tenía que entrar a ML a corregirlo publicación por publicación.
-- Ahora se corrige desde el ERP, de dos formas:
--
--   * Con el botón: «Cambios sugeridos» muestra antes y después de cada uno; quien atiende ML
--     palomea los que quiere y se mandan. Antes de mandar, la conexión vuelve a leer la
--     publicación en ML: si alguien la cambió desde la última lectura, no se toca.
--   * Solo, si se prende el interruptor (apagado de entrada; lo prende gerencia de ventas o
--     dirección, por separado para precio y para existencia). Cada hora en horario de planta la
--     conexión trae las publicaciones y aplica nada más lo seguro (ver ml_cambios_propuestos);
--     lo demás se queda para el botón.
--
-- Nunca se manda un valor escrito a mano: solo el sugerido que calcula la base. Cada cambio queda
-- en ml_cambios con quién (o «automático»), antes, después y lo que contestó ML.
-- =============================================================================

-- 1. ---------------------------------------------------------------------------
-- El tablero también lo lee la conexión (sin sesión) para decidir los cambios automáticos.
create or replace function public.ml_tablero()
returns table (item_id text, titulo text, estado text, logistica text, envio_gratis boolean, permalink text, fotos int,
  tipo_publicacion text, categoria text, precio_ml numeric, stock_ml int, vendidas_total int, visitas_30d int,
  articulo_id uuid, clave text, articulo text, imagen_url text, piezas numeric,
  comision_clasica numeric, comision_premium numeric, costo_envio numeric, tarifas_de_ml boolean,
  precio_recibir numeric, sugerido_clasica numeric, sugerido_premium numeric, precio_sugerido numeric,
  libre_planta numeric, stock_sugerido int,
  preguntas_30d int, sin_contestar int, ventas_30d int, unidades_30d numeric, actualizado_en timestamptz)
language plpgsql stable security definer set search_path = public as $$
declare v_sistema boolean := auth.uid() is null; v_precios boolean := auth.uid() is null or ve_precios_venta(); c canales;
begin
  if not v_sistema and not puede('mercadolibre', 1) then raise exception 'El tablero de Mercado Libre es de quien atiende ML' using errcode = '42501'; end if;
  select * into c from canales where canal = 'mercadolibre';
  return query
  with b as (
    select e.*, pub.articulo_id art, pub.piezas_por_paquete pz, a.clave a_clave, a.nombre a_nombre, a.imagen_url a_img,
      coalesce(e.comision_clasica, c.comision_pct * 100) pct_c, coalesce(e.comision_premium, c.comision_premium_pct * 100) pct_p,
      coalesce(e.costo_envio, c.costo_envio) envio,
      (select pl.precio * coalesce(nullif(pub.piezas_por_paquete, 0), 1) * 1.16 from precios_lista pl where pl.articulo_id = pub.articulo_id) base
    from ml_publicaciones_estado e
    left join publicaciones pub on pub.canal = 'mercadolibre' and pub.id_externo = e.item_id
    left join articulos a on a.id = pub.articulo_id
    where e.titulo is not null
  ), s as (
    select b.*,
      -- Abajo de $299, una cuota fija de 0 en lo que ML cobró dice que ese tipo no la lleva.
      precio_ml_para(b.base, b.pct_c, b.envio, not (b.precio < 299 and b.fijo_clasica = 0), coalesce(b.envio_gratis, false) and b.precio < 299) sc,
      precio_ml_para(b.base, b.pct_p, b.envio, not (b.precio < 299 and b.fijo_premium = 0), coalesce(b.envio_gratis, false) and b.precio < 299) sp
    from b
  )
  select s.item_id, s.titulo, s.estado, s.logistica, s.envio_gratis, s.permalink, s.fotos, s.tipo_publicacion, s.categoria,
    case when v_precios then s.precio end, s.stock, s.vendidas, s.visitas_30d,
    s.art, s.a_clave, s.a_nombre, s.a_img, s.pz,
    s.pct_c, s.pct_p, case when v_precios then s.envio end, s.comision_clasica is not null and s.costo_envio is not null,
    case when v_precios then round(s.base, 2) end,
    case when v_precios then s.sc end, case when v_precios then s.sp end,
    case when v_precios then case when s.tipo_publicacion = 'gold_pro' then s.sp else s.sc end end,
    case when s.art is not null then libre_en_planta(s.art) end,
    case when s.art is not null and coalesce(s.logistica, '') <> 'fulfillment'
         then floor(libre_en_planta(s.art) / nullif(s.pz, 0))::int end,
    (select count(*)::int from ml_preguntas q where q.item_id = s.item_id and q.recibida_en > now() - interval '30 days'),
    (select count(*)::int from ml_preguntas q where q.item_id = s.item_id and q.estado = 'pendiente'),
    (select count(distinct pe.id)::int from pedido_lineas pl join pedidos pe on pe.id = pl.pedido_id
      where pe.canal = 'mercadolibre' and pe.estado <> 'cancelado' and pl.referencia_externa = s.item_id and pe.fecha > hoy_mx() - 30),
    (select coalesce(sum(pl.cantidad / coalesce(nullif(s.pz, 0), 1)), 0) from pedido_lineas pl join pedidos pe on pe.id = pl.pedido_id
      where pe.canal = 'mercadolibre' and pe.estado <> 'cancelado' and pl.referencia_externa = s.item_id and pe.fecha > hoy_mx() - 30),
    s.actualizado_en
  from s
  order by s.visitas_30d desc nulls last, s.titulo;
end $$;
revoke execute on function public.ml_tablero() from public, anon;
grant execute on function public.ml_tablero() to authenticated;

-- 2. ---------------------------------------------------------------------------
-- Lo que habría que cambiar en ML para que cuadre con el ERP, y si se puede hacer solo.
--
-- Precio: cuando difiere 2 % o más del sugerido del tipo de la publicación (la misma regla que la
-- señal del tablero). Solo es automático si la comisión y el envío los dio ML (no estimados), la
-- publicación está activa y el cambio es de 15 % o menos: un salto mayor casi siempre es un precio
-- de lista mal capturado o una pieza por venta mal ligada, y eso lo revisa una persona.
--
-- Existencia: cuando ML tiene más de lo que hay libre en planta (se vendería lo que no hay), o
-- cuando en ML está en 0 y en planta sí hay. Las de Full no: esa existencia la maneja ML. Nunca
-- es automático dejarla en 0 (ML pausa la publicación y pierde posición) ni subirla si el artículo
-- está en más de una publicación activa: cada una publicaría lo mismo y se vendería dos veces.
create or replace function public.ml_cambios_propuestos()
returns table (item_id text, titulo text, campo text, actual numeric, propuesto numeric, motivo text, automatico boolean, por_que_no text)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
begin
  if auth.uid() is not null and not puede('mercadolibre', 2) then
    raise exception 'Cambiar publicaciones es de quien atiende Mercado Libre' using errcode = '42501';
  end if;
  return query
  with t as (select * from ml_tablero()),
  pubs as (
    select x.articulo_id, count(*)::int n from t x
    where x.articulo_id is not null and x.estado = 'active' and coalesce(x.logistica, '') <> 'fulfillment' group by 1
  ),
  precio as (
    select x.item_id, x.titulo, 'precio'::text campo, x.precio_ml actual, x.precio_sugerido propuesto,
      case when x.precio_ml < x.precio_sugerido then 'Más barato que el sugerido' else 'Más caro que el sugerido' end motivo,
      case when not x.tarifas_de_ml then 'La comisión o el envío son estimados: Mercado Libre no los dio en la última lectura'
           when x.estado <> 'active' then 'Está pausada'
           when abs(x.precio_sugerido / x.precio_ml - 1) > 0.15 then 'Cambia más de 15 %: revisa el precio de lista y las piezas por venta'
      end por_que_no
    from t x
    where x.precio_ml > 0 and x.precio_sugerido > 0 and abs(x.precio_ml / x.precio_sugerido - 1) >= 0.02
  ),
  existencia as (
    select x.item_id, x.titulo, 'existencia'::text campo, x.stock_ml::numeric actual, x.stock_sugerido::numeric propuesto,
      case when x.stock_ml > x.stock_sugerido then 'Publica más de lo que hay' else 'En Mercado Libre se agotó y en planta sí hay' end motivo,
      case when x.estado <> 'active' then 'Está pausada'
           when x.stock_sugerido = 0 then 'Quedaría en 0 y Mercado Libre la pausa: hazlo con el botón si así lo quieres'
           when x.stock_sugerido > x.stock_ml and coalesce(p.n, 1) > 1 then format('El artículo está en %s publicaciones: si cada una publica todo, se vende dos veces', p.n)
      end por_que_no
    from t x left join pubs p on p.articulo_id = x.articulo_id
    where x.stock_sugerido is not null and x.stock_ml is not null and coalesce(x.logistica, '') <> 'fulfillment'
      and (x.stock_ml > x.stock_sugerido or (x.stock_ml = 0 and x.stock_sugerido > 0))
  )
  select c.item_id, c.titulo, c.campo, c.actual, c.propuesto, c.motivo, c.por_que_no is null, c.por_que_no
  from (select * from precio union all select * from existencia) c
  order by c.titulo, c.campo desc;
end $$;
revoke execute on function public.ml_cambios_propuestos() from public, anon;
grant execute on function public.ml_cambios_propuestos() to authenticated;

-- 3. ---------------------------------------------------------------------------
-- Lo que se mandó a ML (o se intentó). Nadie lo edita: lo escribe la conexión.
create table if not exists public.ml_cambios (
  id bigserial primary key,
  item_id text not null,
  titulo text,
  campo text not null check (campo in ('precio', 'existencia')),
  antes numeric(14,2),
  despues numeric(14,2),
  origen text not null check (origen in ('boton', 'automatico')),
  usuario_id uuid references public.perfiles(id),
  estado text not null check (estado in ('aplicado', 'omitido', 'error')),
  detalle text,                         -- por qué se omitió o lo que contestó ML
  creado_en timestamptz not null default now()
);
create index if not exists ml_cambios_reciente on public.ml_cambios (creado_en desc);
alter table public.ml_cambios enable row level security;
drop policy if exists ver on public.ml_cambios;
create policy ver on public.ml_cambios for select to authenticated
  using ((select puede('mercadolibre', 1)) and (campo <> 'precio' or (select ve_precios_venta())));

-- Solo la conexión (llave de servicio): anota el cambio y, si se aplicó, pone el valor nuevo en
-- el tablero para que no lo vuelva a proponer antes de la siguiente lectura.
create or replace function public.ml_registrar_cambio(p jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into ml_cambios (item_id, titulo, campo, antes, despues, origen, usuario_id, estado, detalle)
  values (p->>'item_id', p->>'titulo', p->>'campo', (p->>'antes')::numeric, (p->>'despues')::numeric, p->>'origen',
    (p->>'usuario_id')::uuid, p->>'estado', left(p->>'detalle', 500));
  if p->>'estado' = 'aplicado' then
    update ml_publicaciones_estado e set
      precio = case when p->>'campo' = 'precio' then (p->>'despues')::numeric else e.precio end,
      stock = case when p->>'campo' = 'existencia' then (p->>'despues')::int else e.stock end
    where e.item_id = p->>'item_id';
  end if;
end $$;
revoke execute on function public.ml_registrar_cambio(jsonb) from public, anon, authenticated;

-- 4. ---------------------------------------------------------------------------
-- El interruptor: apagado de entrada, por separado para precio y existencia.
insert into public.configuracion (clave, valor, descripcion)
values ('mercadolibre_automatico', '{"precio": false, "existencia": false}',
  'Mercado Libre: corregir solo precio y existencia de las publicaciones (cada hora, lo seguro)')
on conflict (clave) do nothing;

create or replace function public.ml_automatico() returns jsonb
language sql stable security definer set search_path = public as $$
  select case when puede('mercadolibre', 1) then
    c.valor || jsonb_build_object('cambiado_por_nombre', (select nombre from perfiles where id = (c.valor->>'cambiado_por')::uuid))
  end
  from configuracion c where c.clave = 'mercadolibre_automatico'
$$;
revoke execute on function public.ml_automatico() from public, anon;
grant execute on function public.ml_automatico() to authenticated;

create or replace function public.fijar_ml_automatico(p_precio boolean, p_existencia boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not puede('mercadolibre', 3) then
    raise exception 'Prender o apagar los cambios automáticos es de gerencia de ventas o dirección' using errcode = '42501';
  end if;
  update configuracion set valor = valor || jsonb_build_object('precio', coalesce(p_precio, false), 'existencia', coalesce(p_existencia, false),
      'cambiado_por', auth.uid(), 'cambiado_en', now()), actualizado_en = now()
  where clave = 'mercadolibre_automatico';
end $$;
revoke execute on function public.fijar_ml_automatico(boolean, boolean) from public, anon;
grant execute on function public.fijar_ml_automatico(boolean, boolean) to authenticated;

-- Cómo salió la última vuelta automática (aunque no haya cambiado nada): así se ve que sí corre.
create or replace function public.ml_registrar_corrida(p jsonb) returns void
language sql security definer set search_path = public as $$
  update configuracion set valor = valor || jsonb_build_object('ultima_corrida', p || jsonb_build_object('en', now()))
  where clave = 'mercadolibre_automatico'
$$;
revoke execute on function public.ml_registrar_corrida(jsonb) from public, anon, authenticated;

-- 5. ---------------------------------------------------------------------------
-- Quién despierta a la conexión: pg_cron cada hora le pega a la función con una llave que solo
-- conocen la base y la función (vive en ml_cuenta, que nadie con sesión puede leer). La dirección
-- de la función la anota la propia conexión cada vez que trae publicaciones, para no depender de
-- que alguien la configure en cada ambiente.
alter table public.ml_cuenta add column if not exists url_funciones text;
alter table public.ml_cuenta add column if not exists llave_automatico text
  default replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
update public.ml_cuenta set llave_automatico = replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')
where llave_automatico is null;

create or replace function public.ml_fijar_url(p text) returns void
language sql security definer set search_path = public as $$
  update ml_cuenta set url_funciones = nullif(trim(p), '') where id = 1
$$;
revoke execute on function public.ml_fijar_url(text) from public, anon, authenticated;

create or replace function public.ml_llave_valida(p text) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(length(p) >= 32 and exists (select 1 from ml_cuenta where id = 1 and llave_automatico = p), false)
$$;
revoke execute on function public.ml_llave_valida(text) from public, anon, authenticated;

create or replace function public.ml_automatico_disparar() returns void
language plpgsql security definer set search_path = public as $$
declare a jsonb; c record;
begin
  select valor into a from configuracion where clave = 'mercadolibre_automatico';
  if not coalesce((a->>'precio')::boolean, false) and not coalesce((a->>'existencia')::boolean, false) then return; end if;
  select url_funciones, llave_automatico into c from ml_cuenta where id = 1;
  if c.url_funciones is null then return; end if;
  -- Asíncrono: la función contesta de inmediato y trabaja en segundo plano.
  perform net.http_post(url := c.url_funciones || '/functions/v1/mercadolibre/automatico', body := '{}'::jsonb,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-llave', c.llave_automatico));
end $$;
revoke execute on function public.ml_automatico_disparar() from public, anon, authenticated;

-- Cada hora de 7:41 a 19:41 de la planta (13–01 UTC; México ya no cambia de horario).
do $$ begin
  perform cron.schedule('ml-automatico', '41 13-23,0,1 * * *', 'select public.ml_automatico_disparar()');
end $$;

-- 6. ---------------------------------------------------------------------------
-- Guardar cualquier configuración recalcula todo el costeo (166 ya se saltaba el horario del
-- taller). Las de Mercado Libre no entran a ningún costo y la vuelta automática anota su corrida
-- cada hora: sin esto, el catálogo entero se recalcularía cada hora (y ya pasaba cada vez que
-- alguien guardaba los «Datos para contestar»).
create or replace function public.disparar_recalculo_config() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from nuevos n join viejos v on v.clave = n.clave
             where n.valor is distinct from v.valor and n.clave <> 'horas_taller' and n.clave not like 'mercadolibre%') then
    perform recalcular_costos();
  end if;
  return null;
end $$;

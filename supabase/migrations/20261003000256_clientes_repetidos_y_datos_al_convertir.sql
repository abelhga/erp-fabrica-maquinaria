-- =============================================================================
-- Clientes repetidos, datos del cliente al convertir y partidas libres caras.
--
-- Medido en la nube (solo lectura), 6 oct – 6 nov:
-- (a) De 285 clientes dados de alta por personas, 20 ya existían (16 por teléfono, 8 por nombre):
--     el diálogo de «Nuevo cliente» no buscaba nada antes de insertar. 4 eran de la cartera
--     vigente de otro vendedor y nadie se enteró; JM cotizó 4 veces a Forrajera Atotonilco, que es
--     de Isaac, sin que Isaac ni la gerencia lo supieran.
-- (b) 28 de 30 pedidos que salieron de cotización llevaban un cliente sin lo necesario para
--     facturar o medir: 24 sin RFC o sin razón social, 14 sin estado reconocido, 28 sin fuente.
--     Al cotizar no se debe pedir nada (frena la venta); al convertir sí, porque ahí se factura.
-- (c) 11 partidas libres (escritas a mano, sin artículo) de $20,000 o más que no son flete ni
--     instalación, en 10 cotizaciones, $2.21 M sin IVA: montacargas, automatización, tolvas,
--     generadores. Como no tienen precio de lista, la regla del mínimo no las veía: un vendedor
--     podía cotizar cualquier cosa a cualquier precio sin que la gerencia lo viera.
--
-- (a) clientes_parecidos() busca por los últimos 10 dígitos del teléfono, correo, RFC y nombre;
--     alta_cliente() se detiene si hay parecido salvo «es otro». Lo que no se puede saltar es el
--     aviso: disparadores en clientes, contactos y cotizaciones avisan al dueño vigente y a la
--     gerencia. No se bloquea a nadie: es para que se pongan de acuerdo.
-- (b) convertir_a_pedido() recibe los datos que falten, los guarda en la ficha (solo lo vacío) y
--     exige RFC y razón social (o «Público en general»), estado y fuente.
-- (c) Una partida libre cara pasa la cotización a «Por autorizar» con la misma autorización que un
--     precio abajo del mínimo; en un pedido sin cotización la captura la gerencia.
-- =============================================================================

-- 1. Teléfono a 10 dígitos -----------------------------------------------------------------------
-- En la nube el mismo número aparece como «998 195 9232», «(998)1959232» y «+52 1 998…»: comparar
-- el texto no encuentra nada. Los últimos 10 dígitos son el número nacional con o sin lada de país.
create or replace function public.telefono10(p text) returns text
language sql immutable parallel safe as $$
  select case when length(d) >= 10 then right(d, 10) end from (select regexp_replace(coalesce(p, ''), '\D', '', 'g') d) x
$$;
revoke execute on function public.telefono10(text) from public, anon;
grant execute on function public.telefono10(text) to authenticated;
create index if not exists contactos_tel10 on public.contactos (public.telefono10(telefono));
create index if not exists contactos_wa10 on public.contactos (public.telefono10(whatsapp));

-- cliente_con_contacto de 214 con telefono10: «length = 10» dejaba fuera un número escrito con +52.
create or replace function public.cliente_con_contacto(p_telefono text, p_correo text)
returns table (cliente_id uuid, nombre text, vendedor text, por text)
language sql stable security definer set search_path = public as $$
  with t as (select telefono10(p_telefono) tel, lower(trim(coalesce(p_correo, ''))) correo)
  select c.id, c.nombre, p.nombre,
    case when t.tel is not null and t.tel in (telefono10(ct.telefono), telefono10(ct.whatsapp)) then 'teléfono' else 'correo' end
  from t, contactos ct join clientes c on c.id = ct.cliente_id and c.activo
  left join perfiles p on p.id = c.vendedor_id
  where (t.tel is not null and t.tel in (telefono10(ct.telefono), telefono10(ct.whatsapp)))
     or (position('@' in t.correo) > 1 and lower(ct.correo) = t.correo)
  order by c.creado_en
  limit 1
$$;

-- 2. Parecidos ----------------------------------------------------------------------------------
-- El nombre solo cuenta con dos palabras o más: en la nube «Particular» y «Alejandro» salían
-- como 6 repetidos falsos. Se normaliza igual que la revisión nocturna (revision_normalizar).
create or replace function public.nombre_cliente_comparable(p text) returns text
language sql stable set search_path = public, extensions as $$
  select case when n like '% %' and length(n) >= 6 and n not in ('publico en general', 'cliente mostrador', 'venta mostrador') then n end
  from (select revision_normalizar(p) n) x
$$;
revoke execute on function public.nombre_cliente_comparable(text) from public, anon;
grant execute on function public.nombre_cliente_comparable(text) to authenticated;

-- security definer porque busca en los contactos de clientes ajenos, que la RLS (068) no deja ver;
-- por eso nunca regresa teléfonos ni correos: solo nombre del cliente y de su vendedor, que ventas
-- ya ve en la lista de clientes.
create or replace function public.clientes_parecidos(p_nombre text, p_telefono text default null, p_correo text default null,
                                                     p_rfc text default null, p_excluir uuid default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_tel text := telefono10(p_telefono); v_correo text := lower(trim(coalesce(p_correo, '')));
  v_rfc text := nullif(upper(regexp_replace(coalesce(p_rfc, ''), '[\s\-]', '', 'g')), '');
  v_nom text := nombre_cliente_comparable(p_nombre);
begin
  if not puede('ventas', 2) then raise exception 'Sin permiso para dar de alta clientes' using errcode = '42501'; end if;
  if position('@' in v_correo) <= 1 then v_correo := null; end if;
  -- El RFC genérico lo comparten todos los de público en general: no dice que sea el mismo.
  if v_rfc in ('XAXX010101000', 'XEXX010101000') or length(v_rfc) < 12 then v_rfc := null; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', x.id, 'nombre', x.nombre, 'vendedor', p.nombre, 'por', x.por,
             'mio', x.vendedor_id = auth.uid(), 'libre', x.vendedor_id is null,
             'de_otro_vigente', x.vendedor_id <> auth.uid() and coalesce((select v.vigente from vigencia_cliente(x.id) v), false),
             'editable', cliente_visible(x.id)) order by x.peso, x.creado_en)
    from (
      select distinct on (c.id) c.id, c.nombre, c.vendedor_id, c.creado_en, m.por, m.peso
      from clientes c
      cross join lateral (
        select 'teléfono' por, 1 peso where v_tel is not null and exists (
          select 1 from contactos ct where ct.cliente_id = c.id and v_tel in (telefono10(ct.telefono), telefono10(ct.whatsapp)))
        union all
        select 'correo', 2 where v_correo is not null and exists (select 1 from contactos ct where ct.cliente_id = c.id and lower(ct.correo) = v_correo)
        union all
        select 'RFC', 3 where v_rfc is not null and c.rfc = v_rfc
        union all
        select 'nombre', 4 where v_nom is not null and nombre_cliente_comparable(c.nombre) = v_nom
      ) m
      where c.activo and c.id is distinct from p_excluir
      order by c.id, m.peso
      limit 5
    ) x left join perfiles p on p.id = x.vendedor_id), '[]'::jsonb);
end $$;
revoke execute on function public.clientes_parecidos(text, text, text, text, uuid) from public, anon;
grant execute on function public.clientes_parecidos(text, text, text, text, uuid) to authenticated;

-- 3. Alta en SQL --------------------------------------------------------------------------------
-- Antes la pantalla hacía dos inserts; ahora la pregunta «¿ya existe?» la hace la base para que
-- diga lo mismo desde cualquier pantalla. El 23505 trae los parecidos en detail.
create or replace function public.alta_cliente(p_cliente jsonb, p_contacto jsonb default null, p_es_otro boolean default false)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_nombre text := nullif(trim(p_cliente->>'nombre'), ''); v_tel text := nullif(trim(p_contacto->>'telefono'), '');
  v_par jsonb; v_primero jsonb;
begin
  if not puede('ventas', 2) then raise exception 'Tu rol no da de alta clientes' using errcode = '42501'; end if;
  if v_nombre is null then raise exception 'Escribe el nombre del cliente' using errcode = '23514'; end if;
  v_par := clientes_parecidos(v_nombre, v_tel, p_contacto->>'correo', p_cliente->>'rfc');
  v_primero := v_par->0;
  if v_primero is not null and not p_es_otro then
    raise exception 'Ya existe «%»%, con el mismo %: elígelo en vez de darlo de alta otra vez', v_primero->>'nombre',
      coalesce(' (de ' || (v_primero->>'vendedor') || ')', ''), v_primero->>'por'
      using errcode = '23505', detail = v_par::text;
  end if;
  insert into clientes (nombre, razon_social, rfc, ciudad, estado, giro, fuente_id, regimen_fiscal, cp_fiscal, vendedor_id, notas, creado_por)
  values (v_nombre, nullif(trim(p_cliente->>'razon_social'), ''), nullif(trim(p_cliente->>'rfc'), ''), nullif(trim(p_cliente->>'ciudad'), ''),
    nullif(trim(p_cliente->>'estado'), ''), nullif(trim(p_cliente->>'giro'), ''), nullif(p_cliente->>'fuente_id', '')::int,
    nullif(trim(p_cliente->>'regimen_fiscal'), ''), nullif(trim(p_cliente->>'cp_fiscal'), ''),
    -- Como el diálogo de antes: el vendedor siempre se lo queda; la gerencia puede dejarlo libre.
    case when coalesce((p_cliente->>'propio')::boolean, true) or not puede('ventas', 3) then auth.uid() end,
    case when v_primero is not null then format('Dado de alta aunque se parece a «%s» (mismo %s).', v_primero->>'nombre', v_primero->>'por') end,
    auth.uid())
  returning id into v_id;
  if nullif(trim(coalesce(p_contacto->>'nombre', '') || coalesce(v_tel, '') || coalesce(p_contacto->>'correo', '')), '') is not null then
    insert into contactos (cliente_id, nombre, telefono, whatsapp, correo, principal)
    values (v_id, coalesce(nullif(trim(p_contacto->>'nombre'), ''), v_nombre), v_tel, v_tel, nullif(trim(p_contacto->>'correo'), ''), true);
  end if;
  return v_id;
end $$;
revoke execute on function public.alta_cliente(jsonb, jsonb, boolean) from public, anon;
grant execute on function public.alta_cliente(jsonb, jsonb, boolean) to authenticated;
-- La política «alta» de clientes (003) se queda: quitarla rompe a quien inserta directo (pruebas,
-- importaciones). Por la API alguien puede saltarse la pregunta, pero no el aviso de abajo.

-- 4. Avisos -------------------------------------------------------------------------------------
-- Sin sesión (cargas, Mercado Libre, scripts) o desde la gerencia no se avisa: la gerencia es la
-- que junta y reasigna, y así juntar_clientes no hace ruido. La llave cliente:otro con p_una_vez
-- hace que el disparador de clientes (nombre) y el de contactos (teléfono) den un solo aviso.
create or replace function public.avisar_cliente_repetido(p_cliente uuid, p_contacto uuid default null) returns int
language plpgsql security definer set search_path = public as $$
declare n record; r record; v_quien text; v_total int := 0; v_dueno uuid; v_alta boolean;
begin
  if auth.uid() is null or puede('ventas', 3) then return 0; end if;
  -- El primer contacto llega justo después del alta (alta_cliente inserta los dos): eso es «dio de
  -- alta», no «agregó un contacto».
  v_alta := p_contacto is null or not exists (select 1 from contactos where cliente_id = p_cliente and id <> p_contacto);
  select c.*, nombre_cliente_comparable(c.nombre) comparable into n from clientes c where c.id = p_cliente;
  v_dueno := coalesce(n.vendedor_id, auth.uid());
  select nombre into v_quien from perfiles where id = auth.uid();
  for r in
    select distinct on (o.id) o.id, o.nombre, o.vendedor_id, pv.nombre vendedor, m.por
    from clientes o
    join perfiles pv on pv.id = o.vendedor_id
    cross join lateral (
      select 'teléfono' por, 1 peso where exists (
        select 1 from contactos a join contactos b on b.cliente_id = o.id
        where a.cliente_id = p_cliente and (p_contacto is null or a.id = p_contacto)
          and coalesce(telefono10(a.telefono), telefono10(a.whatsapp)) is not null
          and (telefono10(a.telefono) in (telefono10(b.telefono), telefono10(b.whatsapp))
               or telefono10(a.whatsapp) in (telefono10(b.telefono), telefono10(b.whatsapp))))
      union all
      select 'correo', 2 where exists (
        select 1 from contactos a join contactos b on b.cliente_id = o.id
        where a.cliente_id = p_cliente and (p_contacto is null or a.id = p_contacto)
          and position('@' in a.correo) > 1 and lower(a.correo) = lower(b.correo))
      union all
      select 'nombre', 3 where p_contacto is null and n.comparable is not null and nombre_cliente_comparable(o.nombre) = n.comparable
    ) m
    -- Solo la cartera vigente de otro: un cliente libre o vencido lo puede tomar cualquiera.
    where o.activo and o.id <> p_cliente and o.vendedor_id <> v_dueno
      and coalesce((select v.vigente from vigencia_cliente(o.id) v), false)
    order by o.id, m.peso
  loop
    v_total := v_total + avisar(array[r.vendedor_id] || array(select usuarios_con_permiso('ventas', 3)), 'cliente_repetido',
      format('«%s» ya es cliente de %s', r.nombre, r.vendedor),
      case when v_alta
        then format('%s dio de alta a «%s» con el mismo %s. Si es el mismo, junten las fichas y, si los dos lo atienden, compartan el crédito.', v_quien, n.nombre, r.por)
        else format('%s agregó a «%s» un contacto con el mismo %s. Si es el mismo cliente, junten las fichas y, si los dos lo atienden, compartan el crédito.', v_quien, n.nombre, r.por) end,
      '/ventas/clientes/' || p_cliente, 'clientes', p_cliente || ':' || r.id, true);
  end loop;
  return v_total;
end $$;
revoke execute on function public.avisar_cliente_repetido(uuid, uuid) from public, anon, authenticated;

create or replace function public.trg_cliente_repetido() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_table_name = 'clientes' then perform avisar_cliente_repetido(new.id);
  else perform avisar_cliente_repetido(new.cliente_id, new.id); end if;
  return null;
end $$;
revoke execute on function public.trg_cliente_repetido() from public, anon, authenticated;
drop trigger if exists avisar_repetido on public.clientes;
create trigger avisar_repetido after insert on public.clientes for each row execute function public.trg_cliente_repetido();
drop trigger if exists avisar_repetido on public.contactos;
create trigger avisar_repetido after insert or update of telefono, whatsapp, correo on public.contactos
  for each row execute function public.trg_cliente_repetido();

-- Cotizarle a un cliente vigente de otro no se bloquea (reclamar_cliente, 065, sigue apagado), pero
-- el dueño y la gerencia se enteran una sola vez por pareja cliente-vendedor, para siempre: JM
-- cotizó 4 veces a Forrajera y con un aviso basta para que se pongan de acuerdo.
create or replace function public.trg_cotizacion_cliente_ajeno() returns trigger
language plpgsql security definer set search_path = public as $$
declare d record; v_llave text;
begin
  if auth.uid() is null or puede('ventas', 3) then return null; end if;
  select c.nombre, c.vendedor_id, p.nombre dueno, v.vigente, v.vence_en into d
  from clientes c join perfiles p on p.id = c.vendedor_id cross join lateral vigencia_cliente(c.id) v where c.id = new.cliente_id;
  if d.vendedor_id is null or d.vendedor_id = new.vendedor_id or not coalesce(d.vigente, false) then return null; end if;
  v_llave := new.cliente_id || ':' || new.vendedor_id;
  if exists (select 1 from avisos where tipo = 'cliente_ajeno' and registro_id = v_llave) then return null; end if;
  perform avisar(array[d.vendedor_id] || array(select usuarios_con_permiso('ventas', 3)), 'cliente_ajeno',
    format('%s le está cotizando a «%s»', (select nombre from perfiles where id = new.vendedor_id), d.nombre),
    format('La cuenta es de %s hasta el %s. Pónganse de acuerdo: la gerencia la reasigna o comparten el crédito del pedido.', d.dueno, to_char(d.vence_en, 'DD/MM/YYYY')),
    '/ventas/clientes/' || new.cliente_id, 'clientes', v_llave);
  return null;
end $$;
revoke execute on function public.trg_cotizacion_cliente_ajeno() from public, anon, authenticated;
drop trigger if exists avisar_cliente_ajeno on public.cotizaciones;
create trigger avisar_cliente_ajeno after insert or update of cliente_id on public.cotizaciones
  for each row when (new.cliente_id is not null) execute function public.trg_cotizacion_cliente_ajeno();

-- 5. Público en general y datos al convertir ----------------------------------------------------
alter table public.clientes add column if not exists publico_general boolean not null default false;
comment on column public.clientes.publico_general is
  'No pide factura a su nombre: se le factura como público en general. Un RFC de verdad lo apaga solo.';

-- trg_normalizar_cliente de 082 más publico_general: el RFC genérico lo prende y uno de verdad lo
-- apaga, para que la casilla nunca contradiga al RFC.
create or replace function public.trg_normalizar_cliente() returns trigger
language plpgsql as $$
begin
  new.rfc := nullif(upper(regexp_replace(coalesce(new.rfc, ''), '[\s-]', '', 'g')), '');
  new.nombre := trim(new.nombre);
  if new.rfc in ('XAXX010101000', 'XEXX010101000') then new.publico_general := true;
  elsif new.rfc is not null then new.publico_general := false; end if;
  return new;
end $$;

-- security invoker: ventas ve todos los clientes, y solo dice qué falta, no el dato.
create or replace function public.cliente_falta_para_pedido(p_cliente uuid) returns text[]
language sql stable set search_path = public as $$
  select array_remove(array[
    case when not c.publico_general and (c.rfc is null or nullif(trim(c.razon_social), '') is null) then 'fiscal' end,
    case when c.cve_ent is null and coalesce(c.ubicacion, '') <> 'extranjero' then 'estado' end,
    case when c.fuente_id is null then 'fuente' end], null)
  from clientes c where c.id = p_cliente
$$;
revoke execute on function public.cliente_falta_para_pedido(uuid) from public, anon;
grant execute on function public.cliente_falta_para_pedido(uuid) to authenticated;

-- 6. Partidas libres caras ----------------------------------------------------------------------
-- «desde» = hoy: 6 cotizaciones ya enviadas con partidas libres caras se habrían atorado al
-- convertir sin poder pedir autorización desde «enviada». Una versión nueva de esas sí cae.
insert into public.configuracion (clave, valor, descripcion) values
  ('partidas_libres', jsonb_build_object('umbral_mxn', 20000, 'desde', now()),
   'Partida sin artículo del catálogo: desde umbral_mxn (pesos, sin IVA, con descuentos) necesita autorización de la gerencia, salvo flete, instalación o puesta en marcha. Solo en cotizaciones creadas desde «desde».')
on conflict (clave) do nothing;

-- Las partidas libres solo se reconocen por el título: el menú las crea como «Flete a »,
-- «Instalación y puesta en marcha», «Servicio de » y «Partida», y Skydropx como «Flete …».
-- «Servicio de automatización» NO se exenta: es equipo de control, de lo más caro que se cotizó así.
create or replace function public.partida_libre_exenta(p_titulo text) returns boolean
language sql immutable parallel safe set search_path = public, extensions as $$
  select sin_acentos(coalesce(p_titulo, '')) ~* '^\s*(servicio\s+(de\s+)?)?(flete|instal|puesta\s+en\s+marcha)'
$$;
revoke execute on function public.partida_libre_exenta(text) from public, anon;
grant execute on function public.partida_libre_exenta(text) to authenticated;

alter table public.cotizacion_lineas add column if not exists libre_cara boolean not null default false;
comment on column public.cotizacion_lineas.libre_cara is
  'Partida libre de umbral_mxn o más que pide autorización (partida_libre_cara). Solo para pintar, como bajo_minimo.';

-- La misma base que partida_bajo_minimo (082): pesos, sin IVA, con los dos descuentos.
create or replace function public.partida_libre_cara(l public.cotizacion_lineas, c public.cotizaciones) returns boolean
language sql stable set search_path = public as $$
  select l.articulo_id is null and not partida_libre_exenta(l.titulo)
    and c.creado_en >= coalesce((select (valor->>'desde')::timestamptz from configuracion where clave = 'partidas_libres'), '-infinity')
    and l.cantidad * l.precio_unitario * (1 - l.descuento_pct) * (1 - c.descuento_pct) * c.tipo_cambio
          / case when c.precios_con_iva then 1 + c.tasa_iva else 1 end
        >= coalesce((select (valor->>'umbral_mxn')::numeric from configuracion where clave = 'partidas_libres'), 20000)
$$;
revoke execute on function public.partida_libre_cara(public.cotizacion_lineas, public.cotizaciones) from public, anon;
grant execute on function public.partida_libre_cara(public.cotizacion_lineas, public.cotizaciones) to authenticated;

-- El nombre se queda a propósito: trg_cotizacion (al enviar) y convertir_a_pedido la usan como
-- «¿necesita autorización?», y así las dos reglas usan una sola autorización.
create or replace function public.cotizacion_bajo_minimo(c public.cotizaciones) returns boolean
language sql stable as $$
  select exists (select 1 from cotizacion_lineas l where l.cotizacion_id = c.id
                 and (partida_bajo_minimo(l, c) or (not l.opcional and partida_libre_cara(l, c))))
$$;

-- recalcular_cotizacion de 082 con libre_cara.
create or replace function public.recalcular_cotizacion(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare c cotizaciones; v_sub numeric; v_desc numeric; v_bajo boolean;
begin
  select * into c from cotizaciones where id = p_id;
  if not found then return; end if;

  update cotizacion_lineas l set bajo_minimo = partida_bajo_minimo(l, c), libre_cara = not l.opcional and partida_libre_cara(l, c)
  where l.cotizacion_id = p_id
    and (l.bajo_minimo is distinct from partida_bajo_minimo(l, c) or l.libre_cara is distinct from (not l.opcional and partida_libre_cara(l, c)));

  select coalesce(sum(importe), 0), coalesce(bool_or(bajo_minimo or libre_cara), false) into v_sub, v_bajo
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
                  when not v_bajo and c.estado = 'autorizada' and c.autorizada_por is null then 'borrador'
                  else c.estado end,
    autorizacion_pedida_en = case when v_bajo then c.autorizacion_pedida_en end
  where id = p_id;
end $$;

-- convertir_a_pedido de 082 con los datos del cliente y las opcionales elegidas. Cambia la firma:
-- la de tres argumentos se quita para que la API no tenga dos con el mismo nombre.
drop function if exists public.convertir_a_pedido(uuid, date, uuid[]);
create or replace function public.convertir_a_pedido(p_cotizacion uuid, p_fecha_compromiso date default null, p_partidas uuid[] default null,
                                                     p_cliente jsonb default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare c cotizaciones; v_pedido uuid; v_falta text[];
begin
  select * into c from cotizaciones where id = p_cotizacion;
  if c.id is null then raise exception 'No existe la cotización'; end if;
  if not ((c.vendedor_id = auth.uid() and puede('ventas', 2)) or puede('ventas', 3)) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  if c.cliente_id is null then raise exception 'Liga la cotización a un cliente antes de convertirla en pedido'; end if;
  if c.estado in ('rechazada', 'cancelada') then raise exception 'La cotización está %: saca una nueva versión', c.estado; end if;
  if c.autorizada_por is null and cotizacion_bajo_minimo(c) then
    raise exception 'La cotización tiene precios abajo del mínimo o partidas libres sin autorizar' using errcode = '42501';
  end if;
  -- Las opcionales no frenan el envío, pero elegirlas al convertir las mete al pedido: ahí sí cuentan.
  if c.autorizada_por is null and p_partidas is not null and exists (
       select 1 from cotizacion_lineas l where l.cotizacion_id = c.id and l.id = any(p_partidas) and l.opcional
         and (partida_libre_cara(l, c) or precio_bajo_minimo(l.articulo_id,
               l.precio_unitario * (1 - l.descuento_pct) * (1 - c.descuento_pct) * c.tipo_cambio
                 / case when c.precios_con_iva then 1 + c.tasa_iva else 1 end, l.precio_lista))) then
    raise exception 'Una opcional que elegiste va abajo del mínimo (o es partida libre de $20,000 o más): pide la autorización primero' using errcode = '42501';
  end if;
  if exists (select 1 from pedidos where cotizacion_id = p_cotizacion and estado <> 'cancelado') then
    raise exception 'Esta cotización ya tiene pedido';
  end if;
  if p_partidas is not null and cardinality(p_partidas) = 0 then raise exception 'Elige al menos una partida'; end if;

  -- Solo se llena lo vacío: el cliente puede ser de otro vendedor (security definer) y lo que ya
  -- tenía su ficha manda. El cambio queda en la bitácora del cliente.
  if p_cliente is not null then
    update clientes set
      rfc = coalesce(rfc, nullif(upper(regexp_replace(coalesce(p_cliente->>'rfc', ''), '[\s-]', '', 'g')), '')),
      razon_social = coalesce(nullif(trim(razon_social), ''), nullif(trim(p_cliente->>'razon_social'), '')),
      publico_general = publico_general or coalesce((p_cliente->>'publico_general')::boolean, false),
      estado = case when cve_ent is null then coalesce(nullif(trim(p_cliente->>'estado'), ''), estado) else estado end,
      -- «Fuera de México»: con el país, ubicar() lo marca extranjero y ya no pide estado.
      pais = case when cve_ent is null then coalesce(nullif(trim(p_cliente->>'pais'), ''), pais) else pais end,
      fuente_id = coalesce(fuente_id, nullif(p_cliente->>'fuente_id', '')::int)
    where id = c.cliente_id;
  end if;
  v_falta := cliente_falta_para_pedido(c.cliente_id);
  if cardinality(v_falta) > 0 then
    raise exception 'Para hacer el pedido falta: %', array_to_string(array(select case x
        when 'fiscal' then 'RFC y razón social (o marca «Público en general»)' when 'estado' then 'el estado'
        else '¿cómo llegó?' end from unnest(v_falta) x), ', ')
      using errcode = '23514', detail = array_to_string(v_falta, ',');
  end if;

  insert into pedidos (cotizacion_id, cliente_id, vendedor_id, fecha_compromiso, moneda, tipo_cambio, tasa_iva, condiciones_pago, notas)
  values (c.id, c.cliente_id, c.vendedor_id, p_fecha_compromiso, c.moneda, c.tipo_cambio, c.tasa_iva, c.condiciones_pago,
          'Desde cotización ' || c.folio)
  returning id into v_pedido;

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
revoke execute on function public.convertir_a_pedido(uuid, date, uuid[], jsonb) from public, anon;
grant execute on function public.convertir_a_pedido(uuid, date, uuid[], jsonb) to authenticated;

-- 7. Pedido sin cotización: trg_pedido_linea_reglas de 082 con la misma regla para quien no es
-- gerencia. Si no, la partida libre cara se brincaba la autorización capturándola directo al pedido.
create or replace function public.trg_pedido_linea_reglas() returns trigger
language plpgsql as $$
declare p pedidos; v_lista numeric;
begin
  if current_user <> 'authenticated' or puede('ventas', 3) then return new; end if;
  if tg_op = 'INSERT' then
    new.linea := linea_de(new.articulo_id);
  elsif new.linea is distinct from old.linea or new.articulo_id is distinct from old.articulo_id then
    raise exception 'La línea de comisión (maquinaria, refacciones, otros) la pone el catálogo; si está mal, que la cambie la gerencia'
      using errcode = '42501';
  end if;
  -- Ahora también mira la cantidad: 1 × $15,000 que se vuelve 10 × $15,000 cruza el umbral.
  if tg_op = 'UPDATE' and (new.precio_unitario, new.descuento_pct, new.cantidad) is not distinct from (old.precio_unitario, old.descuento_pct, old.cantidad) then
    return new;
  end if;
  select * into p from pedidos where id = new.pedido_id;
  if p.cotizacion_id is null and new.articulo_id is null and not partida_libre_exenta(new.titulo)
     and new.cantidad * new.precio_unitario * (1 - new.descuento_pct) * coalesce(p.tipo_cambio, 1)
         >= coalesce((select (valor->>'umbral_mxn')::numeric from configuracion where clave = 'partidas_libres'), 20000) then
    raise exception '"%" no es del catálogo y pasa de $20,000: cotízala y pide autorización, o que la capture la gerencia', new.titulo
      using errcode = '42501';
  end if;
  if tg_op = 'UPDATE' and (new.precio_unitario, new.descuento_pct) is not distinct from (old.precio_unitario, old.descuento_pct) then
    return new;
  end if;
  if tg_op = 'UPDATE' and p.cotizacion_id is not null then
    raise exception 'El precio viene de la cotización %: para cambiarlo saca una nueva versión o pídeselo a la gerencia',
      (select folio from cotizaciones where id = p.cotizacion_id) using errcode = '42501';
  end if;
  select precio into v_lista from precios_lista where articulo_id = new.articulo_id;
  if precio_bajo_minimo(new.articulo_id, new.precio_unitario * (1 - new.descuento_pct) * coalesce(p.tipo_cambio, 1), v_lista) then
    if new.precio_unitario * (1 - new.descuento_pct) <= 0 then
      raise exception '"%" va en $0: escríbele su precio (regalar una pieza lo autoriza la gerencia)', new.titulo using errcode = '42501';
    end if;
    raise exception '"%" queda abajo del precio mínimo: ese precio lo captura la gerencia', new.titulo using errcode = '42501';
  end if;
  return new;
end $$;

-- 8. trg_cotizacion de 254 con el mensaje de envío al día: con una partida libre cara decía
-- «precios abajo del mínimo» y el vendedor buscaba un precio en rojo que no había.
create or replace function public.trg_cotizacion() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  -- Sin sesión = migración o script de servicio.
  v_gerente boolean := auth.uid() is null or puede('ventas', 3);
  v_op uuid;
  v_op_cli uuid; v_op_ven uuid;
  -- Antes de enviarla la oportunidad todavía se puede cambiar; ya enviada es historia.
  v_por_enviar boolean := tg_op = 'INSERT' or old.estado in ('borrador', 'por_autorizar', 'autorizada');
begin
  -- Cambiar el cliente de una que no se ha enviado suelta la oportunidad del anterior (antes lo
  -- hacía la pantalla), salvo que esa oportunidad ya sea del cliente nuevo (juntar clientes mueve
  -- las oportunidades antes que las cotizaciones). Ya enviada no se toca: juntar clientes también
  -- les cambia el cliente a enviadas y aceptadas (el 2 nov a 3 en la nube), y soltarla dejaba la
  -- oportunidad en «Cotizado» sin su cotización y la venta aceptada sin oportunidad.
  if tg_op = 'UPDATE' and new.cliente_id is distinct from old.cliente_id
     and new.oportunidad_id is not distinct from old.oportunidad_id and v_por_enviar
     and (select o.cliente_id from oportunidades o where o.id = new.oportunidad_id) is distinct from new.cliente_id then
    new.oportunidad_id := null; new.oportunidad_nueva := false;
  end if;
  if new.oportunidad_id is not null then
    new.oportunidad_nueva := false;
    -- Se revisa al ligarla, no al cambiar otra cosa. Una versión nueva hereda la oportunidad de su
    -- familia: si después se reasignó la cotización o la oportunidad, la versión no se traba.
    if (tg_op = 'INSERT' or new.oportunidad_id is distinct from old.oportunidad_id)
       and not (tg_op = 'INSERT' and new.origen_id is not null and exists (
         select 1 from cotizaciones x where (x.id = new.origen_id or x.origen_id = new.origen_id)
           and x.oportunidad_id = new.oportunidad_id and x.vendedor_id = new.vendedor_id)) then
      select cliente_id, vendedor_id into v_op_cli, v_op_ven from oportunidades where id = new.oportunidad_id;
      if v_op_ven is distinct from new.vendedor_id and not v_gerente then
        raise exception 'Esa oportunidad es de otro vendedor: cotiza en una tuya o pide a la gerencia de ventas que te la pase'
          using errcode = '42501';
      end if;
      if v_op_cli is distinct from new.cliente_id then
        raise exception 'Esa oportunidad es de otro cliente: elige una de este cliente o «Una nueva al enviar»' using errcode = '23514';
      end if;
    end if;
  elsif new.cliente_id is not null and not new.oportunidad_nueva and v_por_enviar
        and (tg_op = 'INSERT' or new.cliente_id is distinct from old.cliente_id) then
    new.oportunidad_id := oportunidad_para_cotizar(new.cliente_id, new.vendedor_id);
  end if;

  if tg_op = 'INSERT' then
    -- Provisional hasta que se capture algo (ver 099); el id ya viene puesto por el default.
    if coalesce(new.folio, '') = '' then new.folio := 'BORRADOR-' || upper(left(replace(new.id::text, '-', ''), 8)); end if;
    -- Nadie crea una cotización "ya autorizada".
    if not v_gerente then
      new.autorizada_por := null; new.autorizada_en := null;
      if new.estado <> 'borrador' then new.estado := 'borrador'; end if;
    end if;
    return new;
  end if;

  -- Salir de borrador (enviarla, pedir autorización) también le da su folio definitivo.
  if old.estado = 'borrador' and new.estado <> 'borrador' and folio_es_provisional(new.folio) then
    new.folio := siguiente_folio('COT');
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
    raise exception 'Esta cotización tiene precios abajo del mínimo o partidas libres sin autorizar: necesita autorización de la gerencia antes de enviarse'
      using errcode = '42501';
  end if;

  if new.estado = 'enviada' and old.estado <> 'enviada' then
    new.enviada_en := coalesce(new.enviada_en, now());
    -- El embudo se llena solo: cotizar ES mover la oportunidad a "cotizado". Primero la que ya
    -- tenía el cliente (la del lead, casi siempre); solo si no hay, o si el vendedor dijo que es
    -- otro proyecto, se abre una (nadie captura dos veces).
    if new.oportunidad_id is null and new.cliente_id is not null and not new.oportunidad_nueva then
      new.oportunidad_id := oportunidad_para_cotizar(new.cliente_id, new.vendedor_id);
    end if;
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
      new.oportunidad_nueva := false;
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

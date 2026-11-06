-- =============================================================================
-- Ventas: avisos de leads que sí mueven algo, constancia de por dónde salió una
-- cotización y aviso de pedido de maquinaria en producción sin anticipo.
--
-- Por qué:
-- 1. «Lead sin atender» solo veía que el lead siguiera asignado: del 30 oct al 6 nov 33 de 172
--    avisos fueron de leads que ya tenían un intento anotado. Y como nadie activo tiene el rol
--    gerente_ventas, gerencia_leads() viene vacío y el aviso le llegaba solo al vendedor:
--    Juan Manuel recibió 141 en 11 días, leyó 138, y siguió con 20 sin tocar. Nadie con
--    autoridad se enteraba. Ahora un intento basta para que no cuente, y sin gerencia,
--    dirección recibe un resumen por vendedor (9:00 y 15:00 de día hábil) en vez de nada.
-- 2. 324 cotizaciones tienen enviada_en y la base no sabe cuáles le llegaron al cliente:
--    «Enviar por WhatsApp» y «Solo marcar enviada» guardaban lo mismo. cotizacion_envios
--    guarda cada envío o reenvío con su canal y a qué número o correo.
-- 3. Ni el paso a producción ni la orden revisan cobros: PED-26-822 ($120,000 sin IVA,
--    «50 % anticipo») lleva desde el 3 nov en el taller sin un peso registrado. No se frena
--    al taller (los cobros se registran 3.4 días tarde en promedio): se avisa a finanzas y
--    al vendedor, una vez por pedido.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Leads sin atender (avisos_leads de 128)
-- -----------------------------------------------------------------------------

-- El resumen de dirección y la búsqueda de «ya se mandó en esta ventana» van por tipo y fecha.
create index if not exists avisos_tipo_registro on public.avisos (tipo, registro_id, creado_en desc);

create or replace function public.avisos_leads(p_ahora timestamptz default now()) returns int
language plpgsql security definer set search_path = public as $$
declare
  c jsonb := config_leads(); r record; n int := 0;
  v_ger uuid[] := array(select gerencia_leads());
  v_dir uuid[] := array(select usuarios_con_rol('direccion'));
  v_horas interval := make_interval(secs => (c->>'horas_sin_atender')::numeric * 3600);
  v_desde timestamptz := coalesce((c->>'intentos_desde')::timestamptz, '-infinity');
  v_dia date := (p_ahora at time zone 'America/Mexico_City')::date;
  v_hora time := (p_ahora at time zone 'America/Mexico_City')::time;
  v_ventana text;
begin
  -- Sin tomar: como en 128, pero sin gerencia de ventas le llega a dirección. Antes se marcaba
  -- como avisado sin que le llegara a nadie: en la nube 144 leads marcados y 2 avisos, y dos
  -- leads siguen «nuevos» y sin vendedor desde el 22 oct.
  for r in select * from leads where estado = 'nuevo' and avisado_sin_tomar_en is null
             and creado_en < p_ahora - make_interval(secs => (c->>'horas_sin_tomar')::numeric * 3600) loop
    n := n + avisar(case when cardinality(v_ger) = 0 then v_dir else v_ger end, 'lead_sin_tomar', 'Lead sin tomar: ' || r.nombre,
      r.interes || ' · lleva ' || floor(extract(epoch from p_ahora - r.creado_en) / 3600) || ' h esperando', '/ventas/leads?id=' || r.id, 'leads', r.id::text);
    update leads set avisado_sin_tomar_en = p_ahora where id = r.id;
  end loop;

  -- Sin atender = asignado y SIN NINGÚN intento (del lead, como «Sin contactar» y la revisión de
  -- 214). Al reasignarlo, asignar_lead limpia la marca; los intentos del vendedor anterior cuentan.
  for r in select l.*, p.nombre as vendedor from leads l join perfiles p on p.id = l.vendedor_id
           where l.estado = 'asignado' and l.avisado_sin_atender_en is null
             and l.asignado_en < p_ahora - v_horas
             and not exists (select 1 from lead_intentos i where i.lead_id = l.id) loop
    n := n + avisar(v_ger || r.vendedor_id, 'lead_sin_atender',
      'Lead sin atender: ' || r.nombre || ' (' || r.vendedor || ')', r.interes, '/ventas/leads?id=' || r.id, 'leads', r.id::text);
    update leads set avisado_sin_atender_en = p_ahora where id = r.id;
  end loop;

  -- Sin gerencia de ventas: a dirección, un resumen por vendedor en dos ventanas de día hábil.
  -- La llave es vendedor + día + ventana (9:00 o 15:00): el cron corre cada 15 minutos y solo el
  -- primero de cada ventana manda. Va en registro_id y no en la hora del aviso, que es la del reloj.
  -- Cuenta lo mismo que «Sin contactar» (a donde lleva la liga), y sale solo si al menos uno ya
  -- pasó las horas sin atender: si el título dijera 76 y la lista 78, nadie le cree a ninguno.
  if cardinality(v_ger) = 0 and cardinality(v_dir) > 0 and dia_laborable(v_dia) and v_hora >= time '09:00' then
    v_ventana := to_char(v_dia, 'YYYY-MM-DD') || case when v_hora >= time '15:00' then ' 15:00' else ' 09:00' end;
    for r in
      select l.vendedor_id, p.nombre, count(*) n, min(greatest(l.asignado_en, v_desde)) mas_viejo,
             count(*) filter (where l.asignado_en >= p_ahora - v_horas - interval '1 day'
                                and l.asignado_en < p_ahora - v_horas) nuevos
      from leads l join perfiles p on p.id = l.vendedor_id
      where l.estado = 'asignado'
        and not exists (select 1 from lead_intentos i where i.lead_id = l.id)
      group by 1, 2
      having count(*) filter (where greatest(l.asignado_en, v_desde) < p_ahora - v_horas) > 0
         and not exists (select 1 from avisos a where a.tipo = 'leads_sin_atender_resumen'
                           and a.registro_id = l.vendedor_id || ' ' || v_ventana)
    loop
      n := n + avisar(v_dir, 'leads_sin_atender_resumen',
        format('%s: %s %s sin ningún intento', r.nombre, r.n, case when r.n = 1 then 'lead' else 'leads' end),
        format('El más antiguo lleva %s días hábiles asignado%s. No hay gerente de ventas activo: por eso te llega a ti.',
               dias_habiles_desde(r.mas_viejo),
               case when r.nuevos > 0 then format('; %s pasaron las %s h desde ayer', r.nuevos, c->>'horas_sin_atender') else '' end),
        '/ventas/leads?filtro=sin_contactar&vendedor=' || r.vendedor_id, 'perfiles', r.vendedor_id || ' ' || v_ventana);
    end loop;
  end if;
  return n;
end $$;
revoke execute on function public.avisos_leads(timestamptz) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 2. Por dónde salió la cotización
-- -----------------------------------------------------------------------------

create table if not exists public.cotizacion_envios (
  id uuid primary key default gen_random_uuid(),
  cotizacion_id uuid not null references public.cotizaciones(id) on delete cascade,
  canal text not null check (canal in ('whatsapp', 'correo', 'en_persona', 'solo_marcada')),
  -- WhatsApp: el número en dígitos (vacío = eligió el chat en WhatsApp). Correo: a quién.
  destino text check (destino is null or length(destino) between 3 and 1000),
  -- Este envío la dejó «enviada» (los demás son reenvíos o compartir otra vez).
  marco_enviada boolean not null default false,
  usuario_id uuid default auth.uid() references public.perfiles(id),   -- null = carga de servicio
  en timestamptz not null default now(),
  check (canal <> 'correo' or destino is not null),
  check (canal in ('whatsapp', 'correo') or destino is null)
);
create index if not exists cotizacion_envios_cot on public.cotizacion_envios (cotizacion_id, en desc);
alter table public.cotizacion_envios enable row level security;
-- La ve quien ve la cotización. Nadie la escribe directo: es constancia.
drop policy if exists ver on public.cotizacion_envios;
create policy ver on public.cotizacion_envios for select to authenticated
  using (cotizacion_id in (select id from public.cotizaciones));
revoke insert, update, delete on public.cotizacion_envios from anon, authenticated;
grant select on public.cotizacion_envios to authenticated;

-- Enviar (o volver a compartir) diciendo por dónde. security definer porque escribe la constancia;
-- revisa lo mismo que la política «cambio» de cotizaciones y el cambio de estado pasa por todos
-- sus disparadores (freno, precios bajo mínimo, tiempo de entrega, folio, oportunidad, seguimiento).
create or replace function public.marcar_cotizacion_enviada(p_id uuid, p_canal text, p_destino text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare c cotizaciones; v uuid; v_dest text := nullif(trim(p_destino), ''); v_primera boolean;
begin
  if en_vista_previa() then raise exception 'Estás viendo el ERP como otra persona: desde aquí no se envía nada' using errcode = '42501'; end if;
  select * into c from cotizaciones where id = p_id for update;
  if c.id is null or not ((c.vendedor_id = auth.uid() and puede('ventas', 2)) or puede('ventas', 3)) then
    raise exception 'No encontramos la cotización (o es de otro vendedor)' using errcode = '42501';
  end if;
  if p_canal is null or p_canal not in ('whatsapp', 'correo', 'en_persona', 'solo_marcada') then
    raise exception 'Di por dónde la mandaste: WhatsApp, correo, en persona o solo marcarla' using errcode = '23514';
  end if;
  if c.estado not in ('borrador', 'autorizada', 'enviada', 'aceptada') then
    raise exception 'La cotización está %: no se puede enviar', replace(c.estado::text, '_', ' ');
  end if;
  v_primera := c.estado in ('borrador', 'autorizada');
  if not v_primera and p_canal = 'solo_marcada' then raise exception 'Esta cotización ya está enviada'; end if;
  if p_canal = 'whatsapp' and v_dest is not null then
    v_dest := regexp_replace(v_dest, '\D', '', 'g');
    if length(v_dest) < 10 then raise exception 'Revisa el número de WhatsApp: le faltan dígitos' using errcode = '23514'; end if;
  elsif p_canal = 'correo' and (v_dest is null or v_dest !~ '@') then
    raise exception 'Escribe a qué correo la mandaste' using errcode = '23514';
  elsif p_canal in ('en_persona', 'solo_marcada') then
    v_dest := null;
  end if;
  insert into cotizacion_envios (cotizacion_id, canal, destino, marco_enviada) values (p_id, p_canal, v_dest, v_primera)
  returning id into v;
  if v_primera then update cotizaciones set estado = 'enviada' where id = p_id; end if;
  return v;
end $$;
revoke execute on function public.marcar_cotizacion_enviada(uuid, text, text) from public, anon;
grant execute on function public.marcar_cotizacion_enviada(uuid, text, text) to authenticated;

-- Lo que llega a «enviada» por otro camino (la API, una prueba, una carga) también deja constancia,
-- honesta: «solo marcada». Así ninguna enviada queda sin renglón y no se rompe nada de lo que ya
-- cambia el estado directo. Va en su propio disparador para no tocar trg_cotizacion.
create or replace function public.trg_envio_constancia() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.estado = 'enviada' and old.estado not in ('enviada', 'aceptada')
     and not exists (select 1 from cotizacion_envios e where e.cotizacion_id = new.id and e.marco_enviada and e.en = now()) then
    insert into cotizacion_envios (cotizacion_id, canal, marco_enviada) values (new.id, 'solo_marcada', true);
  end if;
  return null;
end $$;
drop trigger if exists envio_constancia on public.cotizaciones;
create trigger envio_constancia after update of estado on public.cotizaciones
  for each row execute function public.trg_envio_constancia();

-- correo_marcar_enviado de 217: la cotización por correo queda con su canal y destinatarios
-- (también al reenviarla). La orden de compra sigue igual.
create or replace function public.correo_marcar_enviado(p_tipo text, p_id uuid, p_para text[]) returns uuid
language plpgsql security invoker set search_path = public as $$
declare v_act uuid; c cotizaciones;
begin
  if p_tipo = 'cotizacion' then
    perform marcar_cotizacion_enviada(p_id, 'correo', array_to_string(p_para, ', '));
  end if;
  perform correo_cambiar_a_enviado(p_tipo, p_id);   -- en la cotización ya no cambia nada; en la OC, sí
  if p_tipo = 'cotizacion' then
    select * into c from cotizaciones where id = p_id;
    if c.cliente_id is not null then
      insert into actividades (cliente_id, oportunidad_id, tipo, descripcion, hecha)
      values (c.cliente_id, c.oportunidad_id, 'correo', 'Se le mandó la cotización ' || c.folio || ' por correo a ' || array_to_string(p_para, ', '), true)
      returning id into v_act;
    end if;
  end if;
  return v_act;
end $$;
revoke execute on function public.correo_marcar_enviado(text, uuid, text[]) from public, anon;
grant execute on function public.correo_marcar_enviado(text, uuid, text[]) to authenticated;

-- -----------------------------------------------------------------------------
-- 3. Pedido de maquinaria en producción sin anticipo
-- -----------------------------------------------------------------------------

-- Una vez por pedido. «Anticipo» es lo que dicen sus condiciones de pago (texto libre que viene
-- de la cotización; «sin anticipo» o «no requiere anticipo» no cuentan); «cobro» es cualquier
-- cobro positivo registrado al pedido.
create or replace function public.avisar_pedido_sin_anticipo(p_pedido uuid) returns int
language plpgsql security definer set search_path = public as $$
declare p pedidos; v_cliente text;
begin
  select * into p from pedidos where id = p_pedido;
  if p.id is null or p.historico or p.estado = 'cancelado'
     or coalesce(p.condiciones_pago, '') !~* 'anticip'
     or p.condiciones_pago ~* '\m(sin|no)\s+((se\s+)?(requiere|pide|necesita)n?\s+)?anticip'
     or not exists (select 1 from pedido_lineas l where l.pedido_id = p.id and l.linea = 'maquinaria')
     or exists (select 1 from cobros c where c.pedido_id = p.id and c.monto > 0)
     or exists (select 1 from avisos a where a.tipo = 'pedido_sin_anticipo' and a.registro_id = p.id::text) then
    return 0;
  end if;
  select nombre into v_cliente from clientes where id = p.cliente_id;
  return avisar(array(select usuarios_con_rol('finanzas') union select p.vendedor_id
                      union select vendedor_id from pedido_vendedores where pedido_id = p.id),
    'pedido_sin_anticipo', format('%s entró a producción sin anticipo registrado', p.folio),
    format('%s · condiciones: «%s» · total %s%s. Si ya pagó, falta registrar el cobro.', coalesce(v_cliente, 'Cliente'),
           p.condiciones_pago, texto_dinero(p.total), case when p.moneda::text <> 'MXN' then ' ' || p.moneda::text else '' end),
    '/ventas/pedidos/' || p.id, 'pedidos', p.id::text);
end $$;
revoke execute on function public.avisar_pedido_sin_anticipo(uuid) from public, anon, authenticated;

create or replace function public.trg_aviso_sin_anticipo() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_table_name = 'pedidos' then
    perform avisar_pedido_sin_anticipo(new.id);
  elsif new.pedido_id is not null and (tg_op = 'INSERT' or new.pedido_id is distinct from old.pedido_id) then
    perform avisar_pedido_sin_anticipo(new.pedido_id);
  end if;
  return null;
end $$;
drop trigger if exists aviso_sin_anticipo on public.pedidos;
create trigger aviso_sin_anticipo after update of estado on public.pedidos
  for each row when (new.estado = 'en_produccion' and old.estado = 'confirmado')
  execute function public.trg_aviso_sin_anticipo();
-- La orden ligada a un pedido (nueva, o un equipo de stock que se le asigna) también cuenta:
-- un pedido que ya nació en producción no pasa por el cambio de estado.
drop trigger if exists aviso_sin_anticipo on public.ordenes_produccion;
create trigger aviso_sin_anticipo after insert or update of pedido_id on public.ordenes_produccion
  for each row execute function public.trg_aviso_sin_anticipo();

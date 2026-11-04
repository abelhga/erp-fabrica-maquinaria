-- =============================================================================
-- Leads: «Le escribí» como intento, y en la lista qué fue lo último que se hizo.
--
-- Por qué: al mandarle un WhatsApp o un correo a un lead, el único botón era «No contestó», que no
-- describe lo que pasó (el mensaje se acaba de mandar; la respuesta llega horas después). Los
-- vendedores no lo anotaban y el ERP no sabía a quién ya se le había escrito. Isaac pidió llevar el
-- control de si ya le escribió o le llamó, conteste o no.
--
-- Ahora un intento por WhatsApp o correo se anota como «enviado» (le escribí); por llamada sigue siendo
-- «no contestó» y por visita «no estaba». Todos cuentan como intento (para «Por revisar» también). La
-- vista dice además por dónde fue el último intento, para que la lista diga «Le escribiste por WhatsApp
-- · hace 2 h» o «Llamaste, no contestó · ayer».
-- =============================================================================

alter table public.lead_intentos drop constraint if exists lead_intentos_resultado_check;
alter table public.lead_intentos add constraint lead_intentos_resultado_check
  check (resultado in ('contesto', 'no_contesto', 'enviado'));
alter table public.lead_intentos drop constraint if exists lead_intentos_enviado_por_escrito;
alter table public.lead_intentos add constraint lead_intentos_enviado_por_escrito
  check (resultado <> 'enviado' or canal in ('whatsapp', 'correo'));

create or replace function public.registrar_intento_lead(p_lead uuid, p_canal text, p_resultado text, p_nota text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare l leads; v uuid;
begin
  select * into l from leads where id = p_lead;
  if l.id is null then raise exception 'Ese lead no existe'; end if;
  if not ((l.vendedor_id = auth.uid() and puede('ventas', 2)) or (puede('leads', 3) and puede('ventas', 2))) then
    raise exception 'Solo el vendedor que lo tiene (o la gerencia) anota sus intentos' using errcode = '42501';
  end if;
  if l.estado <> 'asignado' then raise exception 'Este lead ya está %', case l.estado when 'nuevo' then 'sin vendedor: tómalo primero' else l.estado end; end if;
  if p_resultado = 'contesto' and coalesce(length(trim(p_nota)), 0) < 5 then
    raise exception 'Escribe qué te dijo (qué busca, para cuándo): es lo que hace que ya sea oportunidad';
  end if;
  if p_resultado = 'enviado' and p_canal not in ('whatsapp', 'correo') then
    raise exception '«Le escribí» es para WhatsApp o correo; una llamada o visita sin respuesta es «no contestó»' using errcode = '23514';
  end if;
  insert into lead_intentos (lead_id, canal, resultado, nota) values (p_lead, p_canal, p_resultado, nullif(trim(p_nota), ''))
  returning id into v;
  return v;
end $$;

-- v_leads de 214 con el medio del último intento al final.
create or replace view public.v_leads with (security_invoker = true) as
select l.*, pc.nombre as capturo, pv.nombre as vendedor, f.nombre as fuente,
  coalesce(i.n, 0) as intentos, coalesce(i.contesto, false) as contesto, i.ultimo as ultimo_intento, i.ultimo_resultado,
  i.ultimo_canal
from leads l
left join perfiles pc on pc.id = l.capturado_por
left join perfiles pv on pv.id = l.vendedor_id
left join fuentes_contacto f on f.id = l.fuente_id
left join lateral (select count(*)::int n, bool_or(x.resultado = 'contesto') contesto, max(x.en) ultimo,
                     (array_agg(x.resultado order by x.en desc))[1] ultimo_resultado,
                     (array_agg(x.canal order by x.en desc))[1] ultimo_canal
                   from lead_intentos x where x.lead_id = l.id) i on true;
grant select on public.v_leads to authenticated;

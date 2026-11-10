-- =============================================================================
-- Una llamada de la historia se liga al lead que ya existe de esa persona.
--
-- Por qué: el teléfono va a mandar como «históricas» las llamadas de antes de la conexión, con su
-- coaching y su análisis (llamada.historica, 261). El ERP ya las ligaba al CLIENTE por teléfono, pero
-- no al LEAD: una histórica no crea ni toca leads, y con eso tampoco se ligaba a ninguno. Recepción
-- capturó esos leads a mano cuando entró la llamada, así que en la ficha del lead no aparecía la
-- llamada que lo originó, ni su grabación, aunque estuviera en el ERP.
--
-- Qué hace: si la foto es histórica y la llamada no tiene lead, busca el lead de esa persona (mismo
-- teléfono, el de la llamada o el que trae la foto, o del mismo cliente) y, si hay varios, el más
-- cercano en fecha a la llamada. Sin límite de fechas: los leads del ERP empiezan el 22 de octubre
-- de 2026 y la historia viene de antes, y una llamada de agosto de quien después fue lead sirve en
-- su ficha («ya había llamado»). Solo pone llamadas.lead_id (y el cliente del lead si la llamada no
-- tenía). El lead NO se toca, y una histórica sigue sin crear actividades, avisos ni «Regresar
-- llamada».
--
-- También liga las históricas que ya entraron (41 al aplicarla; con la regla, 1 tiene lead).
-- =============================================================================

create or replace function public._telefono_lead_de_historica(p_llamada uuid, p_tel_lead text) returns uuid
language sql stable security definer set search_path = public as $$
  select x.id
  from llamadas ll
  join leads x on telefono10(x.telefono) in (ll.telefono10, telefono10(p_tel_lead))
               or (ll.cliente_id is not null and x.cliente_id = ll.cliente_id)
  where ll.id = p_llamada
  order by abs(extract(epoch from x.creado_en - coalesce(ll.inicio, ll.creado_en))), x.creado_en
  limit 1
$$;
revoke all on function public._telefono_lead_de_historica(uuid, text) from public, anon, authenticated;
comment on function public._telefono_lead_de_historica(uuid, text) is
  'El lead de la persona de una llamada histórica: mismo teléfono o mismo cliente, el más cercano en fecha (264).';

do $$
declare d text; n text;
begin
  d := pg_get_functiondef('public.telefono_registrar_evento(jsonb)'::regprocedure);
  n := replace(d, $a$
  if not c.historica then
    -- Hubo cliente y una persona la atendió: queda en su actividad (una vez por llamada).$a$,
  $a$
  -- Una llamada de la historia no crea leads, pero sí se liga al que ya existe de esa persona (264):
  -- así su grabación y su coaching salen en la ficha del lead. El lead no se toca.
  if c.historica and c.lead_id is null then
    v_lead := _telefono_lead_de_historica(c.id, ld->>'telefono');
    if v_lead is not null then
      select * into l from leads where id = v_lead;
      update llamadas set lead_id = l.id, lead_nombre = l.nombre || coalesce(' (' || coalesce(l.cliente_nombre, l.empresa) || ')', ''),
        cliente_id = coalesce(cliente_id, l.cliente_id), cliente_nombre = case when cliente_id is null then l.cliente_nombre else cliente_nombre end
      where id = c.id returning * into c;
    end if;
  end if;

  if not c.historica then
    -- Hubo cliente y una persona la atendió: queda en su actividad (una vez por llamada).$a$);
  if n = d then raise exception 'telefono_registrar_evento: no encontré dónde ligar la histórica'; end if;
  execute n;
end $$;

-- Las históricas que ya entraron.
update public.llamadas ll set
  lead_id = x.id,
  lead_nombre = x.nombre || coalesce(' (' || coalesce(x.cliente_nombre, x.empresa) || ')', ''),
  cliente_id = coalesce(ll.cliente_id, x.cliente_id),
  cliente_nombre = case when ll.cliente_id is null then x.cliente_nombre else ll.cliente_nombre end
from public.leads x
where ll.historica and ll.lead_id is null
  and x.id = public._telefono_lead_de_historica(ll.id, ll.datos->'lead'->>'telefono');

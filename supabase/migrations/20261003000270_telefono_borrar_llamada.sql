-- =============================================================================
-- Borrar una llamada de prueba que llegó del conmutador.
--
-- Por qué: el 9 de noviembre se hizo una llamada de prueba («Ana», cribadora de 2 t/h). Dejó una
-- llamada con coaching de 1/10 a nombre de Juan Manuel y un lead asignado a él. En el panel del
-- conmutador, «Borrar análisis» quitaba el coaching, pero el automático lo volvía a hacer y la foto
-- lo traía de regreso. Para quitar una llamada no había ningún camino.
--
-- Qué hay ahora:
--   * telefono_borrar_llamada(call_sid), solo para el conmutador (service_role), por la ruta
--     POST /telefono/borrar. Borra la llamada con su coaching y su análisis (cascada), la actividad
--     que generó y su lead, si nadie lo ha trabajado (sigue nuevo o asignado y sin intentos). Si ya
--     se trabajó, el lead se queda y solo pierde la liga con la llamada.
--   * telefono_borradas: el call_sid queda anotado, y una foto que llegue después de esa llamada
--     (un reintento en la cola) se ignora en vez de volverla a crear.
-- =============================================================================

create table if not exists public.telefono_borradas (
  call_sid text primary key,
  borrada_en timestamptz not null default now(),
  lead_borrado boolean not null default false
);
alter table public.telefono_borradas enable row level security;
-- Solo la usan las funciones de la base: sin políticas, nadie la ve desde la pantalla.

create or replace function public.telefono_borrar_llamada(p_call_sid text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare c llamadas; l leads; v_lead_borrado boolean := false;
begin
  if nullif(trim(p_call_sid), '') is null then raise exception 'Falta call_sid' using errcode = '22023'; end if;
  select * into c from llamadas where call_sid = trim(p_call_sid) for update;
  if c.id is null then
    insert into telefono_borradas (call_sid) values (trim(p_call_sid)) on conflict (call_sid) do nothing;
    return jsonb_build_object('ok', true, 'habia', false);
  end if;
  if c.lead_id is not null then
    select * into l from leads where id = c.lead_id for update;
  end if;
  update leads set llamada_id = null where llamada_id = c.id;
  delete from llamadas where id = c.id;   -- su coaching y su análisis se van en cascada
  if c.actividad_id is not null then delete from actividades where id = c.actividad_id; end if;
  -- El lead solo se borra si nadie lo ha trabajado; si ya hubo intentos, oportunidad o descarte, se queda.
  if l.id is not null and l.estado in ('nuevo', 'asignado') and l.oportunidad_id is null
     and not exists (select 1 from lead_intentos where lead_id = l.id)
     and not exists (select 1 from llamadas where lead_id = l.id) then
    delete from avisos where tabla = 'leads' and registro_id = l.id::text;
    delete from leads where id = l.id;
    v_lead_borrado := true;
  end if;
  insert into telefono_borradas (call_sid, lead_borrado) values (c.call_sid, v_lead_borrado)
  on conflict (call_sid) do update set borrada_en = now(), lead_borrado = excluded.lead_borrado;
  return jsonb_build_object('ok', true, 'habia', true, 'lead_borrado', v_lead_borrado,
                            'lead_se_quedo', l.id is not null and not v_lead_borrado);
end $$;
revoke execute on function public.telefono_borrar_llamada(text) from public, anon, authenticated;
grant execute on function public.telefono_borrar_llamada(text) to service_role;

-- Una foto de una llamada borrada (un reintento que estaba en la cola) no la vuelve a crear.
do $$
declare d text; n text;
begin
  d := pg_get_functiondef('public.telefono_registrar_evento(jsonb)'::regprocedure);
  n := replace(d, $a$  if v_sid is null then raise exception 'Falta call_sid' using errcode = '22023'; end if;$a$,
    $a$  if v_sid is null then raise exception 'Falta call_sid' using errcode = '22023'; end if;
  if exists (select 1 from telefono_borradas where call_sid = v_sid) then
    return jsonb_build_object('ok', true, 'llamada_id', null, 'lead_id', null, 'cliente_id', null, 'borrada', true);
  end if;$a$);
  if n = d then raise exception 'telefono_registrar_evento: no encontré la revisión del call_sid'; end if;
  execute n;
end $$;

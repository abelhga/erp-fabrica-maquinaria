-- =============================================================================
-- Al registrar un lead, avisar si ya hay uno abierto de la misma persona o la misma empresa.
--
-- Por qué: el 10 de noviembre Sandra Patlán (El Surco de San Miguel) llamó a las 3:37; la IA del
-- teléfono dejó su lead y se lo pasó a Susana. Diez minutos después recepción la registró a mano
-- con otro número y se la dio a Abel: dos leads abiertos, dos vendedores. El único aviso que había
-- era por teléfono (llamada_reciente_de), y con un número distinto no saltó. El buscador de
-- clientes tampoco: un lead todavía no es cliente.
--
-- Qué hay ahora: lead_parecido(nombre, empresa, teléfono) devuelve hasta 3 leads abiertos (o vueltos
-- oportunidad en los últimos 30 días) que coinciden por el nombre completo de la persona, por la
-- empresa (sin «S.A. de C.V.» y sin las genéricas como «Particular») o por el teléfono. Igual que
-- llamada_reciente_de: solo nombres, vendedor y estado, sin datos de contacto, y «lo_ves» dice si
-- quien pregunta puede abrir ese lead.
-- =============================================================================

-- «Ing. Sandra Patlán» y «sandra patlan» son la misma persona; un solo nombre («Juan») no basta.
create or replace function public.persona_clave(p text) returns text
language sql stable set search_path = public, extensions as $$
  select case when cardinality(regexp_split_to_array(x, ' ')) >= 2 then x end
  from (select trim(regexp_replace(revision_normalizar(p), '^((ing|lic|arq|dr|dra|sr|sra|srta|don|dona|c p) )+', '')) x) s
  where x <> ''
$$;

-- «El Surco de San Miguel, S.A. de C.V.» y «El Surco de San Miguel» son la misma empresa.
create or replace function public.empresa_clave(p text) returns text
language sql stable set search_path = public, extensions as $$
  select case when not empresa_generica(p) and length(x) >= 4 then x end
  from (select trim(regexp_replace(revision_normalizar(p),
          '( (s a p i|sapi|s a|sa|s de r l|s de rl|s r l|s c|sc|s a s|sas|s p r|spr)( de (r l|rl|c v|cv|r i|ri))*)+$', '')) x) s
$$;

create or replace function public.lead_parecido(p_nombre text, p_empresa text, p_tel text)
returns table (lead_id uuid, lead_nombre text, empresa text, creado_en timestamptz, vendedor text, estado text,
               por_telefono boolean, coincide text, lo_ves boolean)
language plpgsql stable security definer set search_path = public as $$
declare v_yo uuid := auth.uid(); v_ger boolean; v_bandeja boolean;
  v_p text := persona_clave(p_nombre); v_e text := empresa_clave(p_empresa); v_t text := telefono10(p_tel);
begin
  if not puede('leads', 2) then raise exception 'Sin permiso para registrar leads' using errcode = '42501'; end if;
  if v_p is null and v_e is null and v_t is null then return; end if;
  v_ger := puede('leads', 3); v_bandeja := ve_bandeja_leads();
  return query
  select l.id, l.nombre, l.empresa, l.creado_en, pv.nombre, l.estado::text, l.llamada_id is not null,
    -- «el nombre y la empresa», no «el nombre, la empresa».
    regexp_replace(concat_ws(', ', case when v_p is not null and persona_clave(l.nombre) = v_p then 'el nombre' end,
                    case when v_e is not null and empresa_clave(l.empresa) = v_e then 'la empresa' end,
                    case when v_t is not null and telefono10(l.telefono) = v_t then 'el teléfono' end), ', ([^,]*)$', ' y \1'),
    -- Sin coalesce, un lead que capturó la IA (sin capturado_por) daría null en vez de «no lo ves».
    coalesce(v_ger or l.capturado_por = v_yo or l.vendedor_id = v_yo or (l.estado = 'nuevo' and v_bandeja), false)
  from leads l
  left join perfiles pv on pv.id = l.vendedor_id
  where (l.estado in ('nuevo', 'asignado') or (l.estado = 'convertido' and l.creado_en >= now() - interval '30 days'))
    and ((v_p is not null and persona_clave(l.nombre) = v_p)
      or (v_e is not null and empresa_clave(l.empresa) = v_e)
      or (v_t is not null and telefono10(l.telefono) = v_t))
  order by l.creado_en desc
  limit 3;
end $$;
revoke execute on function public.lead_parecido(text, text, text) from public, anon;
grant execute on function public.lead_parecido(text, text, text) to authenticated;

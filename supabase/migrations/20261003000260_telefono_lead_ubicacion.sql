-- =============================================================================
-- Teléfono: el lead que toma la IA llega con dónde está.
--
-- Por qué: los leads del conmutador (258) llegaban sin ciudad ni estado, porque el contrato no los
-- traía, y la lista de leads los marcaba todos con «Le falta dónde está» (y contaban contra el
-- indicador de leads completos). La IA sí lo pregunta; ahora lo manda en `lead.ciudad` y
-- `lead.estado`, ambos opcionales (docs/integracion-telefono.md).
--
-- El estado llega como lo dijo quien llamó y lo escribió la IA («Edo. de México», «CDMX», «nuevo
-- leon»). En el lead se guarda como lo escribe el resto del ERP: el nombre corto del catálogo de
-- estados (geo_estados.nombre_corto: «Estado de México», «Ciudad de México», «Michoacán»), el
-- mismo que ofrece la lista de estados al aceptar una cotización. Así, al convertir el lead, el
-- cliente nace con un estado que ubicar() reconoce y no se lo vuelven a pedir. Lo que no se
-- reconoce queda vacío para que la pantalla lo siga pidiendo: un estado equivocado es peor que
-- ninguno (sale en el mapa de ventas y nadie lo vuelve a revisar). Lo crudo queda en llamadas.datos.
--
-- La regla de siempre: una foto nueva solo llena lo que falta. Si alguien ya escribió la ciudad o
-- el estado del lead, la IA no lo pisa.
-- =============================================================================

-- Un estado de la República como lo escribe el ERP, o null si no se reconoce sin duda.
-- Reusa el catálogo y los alias de 087 (geo_estado_de) en vez de otra lista: si dirección o una
-- migración agrega un alias, sirve aquí también. Por eso es «stable» y no «immutable»: lee tablas.
-- Antes del parecido de geo_estado_de, se descarta lo que ese parecido resolvería mal:
--   * «México» a secas: puede ser el país o la capital; ubicar() lo toma como Estado de México
--     (es el nombre oficial), pero quien llama casi siempre quiso decir otra cosa;
--   * un estado de otro país («Texas», «Nuevo México», «California»): no es de la República;
--   * «Jalisco, México», «Estado de Jalisco», «Edo. Jalisco»: se le quita el país o el «estado de»
--     y se busca exacto (el parecido de «jalisco mexico» daba Estado de México).
create or replace function public.normalizar_estado_mx(p text) returns text
language sql stable parallel safe set search_path = public, extensions as $$
  with n as (select geo_normalizar(p) t),
  exacto as (
    -- Nombre oficial, nombre corto, abreviatura o alias, sin parecidos.
    select v.o, v.t, coalesce(
      (select e.cve_ent from geo_estados e where v.t in (e.nombre_norm, e.corto_norm, geo_normalizar(e.abreviatura)) limit 1),
      (select a.cve_ent from geo_alias_estado a where a.alias_norm = v.t)) cve
    from n, lateral (values
      (1, n.t),
      (2, regexp_replace(n.t, '^(estado|edo|ed)( de)? ', '')),
      (3, regexp_replace(n.t, '( de)? (mexico|mex|mx|republica mexicana)$', '')),
      (4, regexp_replace(regexp_replace(n.t, '( de)? (mexico|mex|mx|republica mexicana)$', ''), '^(estado|edo|ed)( de)? ', ''))
    ) v(o, t)
    where v.t <> ''
  )
  select g.nombre_corto
  from n, geo_estados g
  where n.t is not null
    and n.t not in ('mexico', 'mex', 'mx', 'republica mexicana', 'republica', 'mexico mexico')
    and not exists (select 1 from geo_alias_estado a where a.alias_norm = n.t and a.pais is not null)
    and g.cve_ent = case when n.t in ('mexico city', 'ciudad mexico city') then '09' else coalesce(
      (select x.cve from exacto x where x.cve is not null order by x.o limit 1),
      -- «Nueo León», «Queretero»: el más parecido, si gana con claridad (la regla de geo_estado_de).
      geo_estado_de(p)) end
$$;
grant execute on function public.normalizar_estado_mx(text) to authenticated;

-- Cada foto de una llamada (258), ahora con la ciudad y el estado del lead ---------------------------
-- Idempotente por call_sid: la misma foto dos veces deja lo mismo; un campo vacío no borra lo que
-- ya había (coalesce). Un error de datos (fecha o número mal escrito) sale con código 22xxx, que
-- la función de borde contesta como 400 para que el conmutador no lo reintente igual.
create or replace function public.telefono_registrar_evento(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_sid text := nullif(trim(p->>'call_sid'), '');
  ll jsonb := p->'llamada';
  ld jsonb := case when jsonb_typeof(p->'lead') = 'object' then p->'lead' end;
  at jsonb := case when jsonb_typeof(p->'llamada'->'atendio') = 'object' then p->'llamada'->'atendio' end;
  v_foto timestamptz := (p->>'enviado_en')::timestamptz;
  v_tel text := nullif(trim(ll->>'telefono'), '');
  v_at_nombre text := nullif(trim(at->>'nombre'), '');
  v_at_tel text := nullif(trim(at->>'telefono'), '');
  v_nadie boolean := (ll->>'nadie_contesto')::boolean;
  v_clave text; v_dir telefono_directorio; v_perfil uuid;
  v_prev llamadas; c llamadas; l leads; v_cli record; v_lead uuid; v_desc text; v_duenos uuid[];
  v_nombre text; v_interes text; v_ltel text; v_lcorreo text; v_notas text; v_act uuid;
  v_ciudad text; v_estado text;
begin
  if coalesce(p->>'version', '') <> '1' then raise exception 'Versión del contrato no soportada: %', coalesce(p->>'version', 'ninguna') using errcode = '22023'; end if;
  if coalesce(p->>'tipo', '') <> 'llamada' then raise exception 'Tipo de evento no soportado: %', coalesce(p->>'tipo', 'ninguno') using errcode = '22023'; end if;
  if v_sid is null then raise exception 'Falta call_sid' using errcode = '22023'; end if;
  if jsonb_typeof(ll) is distinct from 'object' then raise exception 'Falta «llamada»' using errcode = '22023'; end if;

  -- Dos fotos de la misma llamada al mismo tiempo (reintento y foto nueva) se forman.
  perform pg_advisory_xact_lock(hashtext('telefono:' || v_sid));
  select * into v_prev from llamadas where call_sid = v_sid;
  if v_prev.id is not null and v_foto is not null and v_prev.foto_en is not null and v_foto < v_prev.foto_en then
    -- Una foto más vieja que la que ya se aplicó: se contesta igual, sin tocar nada.
    return jsonb_build_object('ok', true, 'llamada_id', v_prev.id, 'lead_id', v_prev.lead_id, 'cliente_id', v_prev.cliente_id);
  end if;

  -- Quién la atendió: el directorio (lo llena solo) y, si no está ligado, el teléfono de su perfil.
  v_clave := _telefono_clave(v_at_nombre, v_at_tel);
  if v_clave is not null then
    insert into telefono_directorio (clave, nombre, telefono) values (v_clave, coalesce(v_at_nombre, v_at_tel), v_at_tel)
    on conflict (clave) do update set visto_en = now(),
      nombre = coalesce(excluded.nombre, telefono_directorio.nombre), telefono = coalesce(telefono_directorio.telefono, excluded.telefono)
    returning * into v_dir;
    if v_dir.perfil_id is null and telefono10(v_dir.telefono) is not null then
      select min(pf.id::text)::uuid into v_perfil from perfiles pf
      where pf.activo and telefono10(pf.telefono) = telefono10(v_dir.telefono)
      having count(*) = 1;
      if v_perfil is not null then
        update telefono_directorio set perfil_id = v_perfil, ligado_en = now() where id = v_dir.id returning * into v_dir;
      end if;
    end if;
    v_perfil := v_dir.perfil_id;
  end if;

  insert into llamadas as x (call_sid, telefono, telefono10, inicio, fin, duracion_seg, estado, area, area_nombre,
    atendio_nombre, atendio_telefono, atendio_directorio, atendio_perfil, atendio_ia, nadie_contesto, resumen,
    grabacion_url, grabacion_vence, foto_en, datos)
  values (v_sid, v_tel, telefono10(v_tel), (ll->>'inicio')::timestamptz, (ll->>'fin')::timestamptz, (ll->>'duracion_seg')::int,
    nullif(ll->>'estado', ''), nullif(ll->>'area', ''), nullif(ll->>'area_nombre', ''),
    v_at_nombre, v_at_tel, v_dir.id, v_perfil, nullif(trim(ll->>'atendio_ia'), ''), coalesce(v_nadie, false),
    nullif(trim(ll->>'resumen'), ''), nullif(ll->>'grabacion_url', ''), (ll->>'grabacion_vence')::timestamptz, v_foto,
    -- Lo crudo, sin transcripción aunque algún día venga: es la plática completa de una persona.
    jsonb_strip_nulls(p - 'transcripcion' - 'transcript' || jsonb_build_object('llamada', ll - 'transcripcion' - 'transcript')))
  on conflict (call_sid) do update set
    telefono = coalesce(excluded.telefono, x.telefono),
    telefono10 = coalesce(excluded.telefono10, x.telefono10),
    inicio = coalesce(excluded.inicio, x.inicio),
    fin = coalesce(excluded.fin, x.fin),
    duracion_seg = coalesce(excluded.duracion_seg, x.duracion_seg),
    estado = coalesce(excluded.estado, x.estado),
    area = coalesce(excluded.area, x.area),
    area_nombre = coalesce(excluded.area_nombre, x.area_nombre),
    atendio_nombre = coalesce(excluded.atendio_nombre, x.atendio_nombre),
    atendio_telefono = coalesce(excluded.atendio_telefono, x.atendio_telefono),
    atendio_directorio = coalesce(excluded.atendio_directorio, x.atendio_directorio),
    atendio_perfil = coalesce(excluded.atendio_perfil, x.atendio_perfil),
    atendio_ia = coalesce(excluded.atendio_ia, x.atendio_ia),
    nadie_contesto = case when v_nadie is null then x.nadie_contesto else v_nadie end,
    resumen = coalesce(excluded.resumen, x.resumen),
    grabacion_url = coalesce(excluded.grabacion_url, x.grabacion_url),
    grabacion_vence = coalesce(excluded.grabacion_vence, x.grabacion_vence),
    foto_en = coalesce(excluded.foto_en, x.foto_en),
    datos = x.datos || excluded.datos
  returning * into c;

  -- El cliente, por el teléfono de quien llamó (o el del lead) o su correo.
  if c.cliente_id is null then
    select * into v_cli from cliente_con_contacto(coalesce(c.telefono, ld->>'telefono'), ld->>'correo');
    if v_cli.cliente_id is null and ld is not null and telefono10(ld->>'telefono') is distinct from c.telefono10 then
      select * into v_cli from cliente_con_contacto(ld->>'telefono', null);
    end if;
    if v_cli.cliente_id is not null then
      update llamadas set cliente_id = v_cli.cliente_id, cliente_nombre = v_cli.nombre where id = c.id returning * into c;
    end if;
  end if;

  -- El lead: se crea la primera vez; después solo se llena lo que le falta.
  if ld is not null then
    v_nombre := coalesce(nullif(trim(ld->>'nombre'), ''), nullif(trim(ld->>'empresa'), ''), 'Sin nombre');
    v_interes := coalesce(nullif(trim(ld->>'interes'), ''), left(c.resumen, 300), 'Llamó al teléfono');
    v_ltel := coalesce(nullif(trim(ld->>'telefono'), ''), c.telefono);
    v_lcorreo := nullif(lower(trim(ld->>'correo')), '');
    v_notas := concat_ws(E'\n', 'Entró por el teléfono (IA).', nullif(trim(ld->>'detalle'), ''), nullif(trim(ld->>'notas'), ''));
    -- La ciudad como la dijo quien llamó, sin espacios de más; 80 letras alcanzan para cualquier
    -- municipio («Dolores Hidalgo Cuna de la Independencia Nacional» tiene 49) y frenan un párrafo.
    v_ciudad := nullif(btrim(left(btrim(regexp_replace(coalesce(ld->>'ciudad', ''), '\s+', ' ', 'g')), 80)), '');
    v_estado := normalizar_estado_mx(ld->>'estado');
    if c.lead_id is null then
      if length(v_nombre) >= 2 and length(v_interes) >= 3 and (v_ltel is not null or v_lcorreo is not null or c.cliente_id is not null) then
        perform set_config('hegamex.lead_telefono', 'si', true);
        insert into leads (nombre, empresa, telefono, correo, ciudad, estado_mx, interes, notas, cliente_id, vendedor_id, llamada_id)
        values (v_nombre, nullif(trim(ld->>'empresa'), ''), v_ltel, v_lcorreo, v_ciudad, v_estado, v_interes, v_notas, c.cliente_id, v_perfil, c.id)
        returning id into v_lead;
        perform set_config('hegamex.lead_telefono', '', true);
        update llamadas set lead_id = v_lead, lead_nombre = v_nombre || coalesce(' (' || nullif(trim(ld->>'empresa'), '') || ')', '')
        where id = c.id returning * into c;
      end if;
    else
      select * into l from leads where id = c.lead_id for update;
      if l.id is not null then
        update leads set
          empresa = coalesce(empresa, nullif(trim(ld->>'empresa'), '')),
          telefono = coalesce(telefono, v_ltel),
          correo = coalesce(correo, v_lcorreo),
          -- En blanco cuenta como vacío: la pantalla también lo marca «Le falta dónde está».
          ciudad = coalesce(nullif(trim(ciudad), ''), v_ciudad, ciudad),
          estado_mx = coalesce(nullif(trim(estado_mx), ''), v_estado, estado_mx),
          interes = case when interes = 'Llamó al teléfono' and v_interes <> 'Llamó al teléfono' then v_interes else interes end,
          notas = case when notas is null or notas = 'Entró por el teléfono (IA).' then v_notas else notas end
        where id = l.id;
        -- Se creó antes de saber quién lo atendió y sigue sin vendedor: ahora sí es de quien lo atendió.
        if l.estado = 'nuevo' and l.vendedor_id is null and v_perfil is not null and v_perfil in (select vendedores_leads()) then
          update leads set estado = 'asignado', vendedor_id = v_perfil, como_se_asigno = 'llamada', asignado_en = now()
          where id = l.id;
          perform avisar(array[v_perfil], 'lead', 'Lead para ti: ' || l.nombre, 'Lo atendiste por teléfono. ' || l.interes,
            '/ventas/leads?id=' || l.id, 'leads', l.id::text);
        end if;
        if c.cliente_id is null and l.cliente_id is not null then
          update llamadas set cliente_id = l.cliente_id, cliente_nombre = l.cliente_nombre where id = c.id returning * into c;
        end if;
      end if;
    end if;
  end if;

  -- Hubo cliente y una persona la atendió: queda en su actividad (una vez por llamada).
  v_desc := 'Llamada entrante por el conmutador' || coalesce(' (' || c.area_nombre || ')', '') || coalesce(': ' || c.resumen, '');
  if c.cliente_id is not null and c.atendio_perfil is not null and not c.nadie_contesto then
    if c.actividad_id is null then
      insert into actividades (cliente_id, tipo, descripcion, hecha, usuario_id, en)
      values (c.cliente_id, 'llamada', v_desc, true, c.atendio_perfil, coalesce(c.inicio, now()))
      returning id into v_act;
      update llamadas set actividad_id = v_act where id = c.id;
    else
      -- El resumen llega en una foto posterior: se completa si nadie la ha editado.
      update actividades set descripcion = v_desc
      where id = c.actividad_id and descripcion like 'Llamada entrante por el conmutador%' and descripcion <> v_desc;
    end if;
  end if;

  if c.nadie_contesto then
    -- Llegó tarde y el mismo número ya volvió a llamar y lo atendieron.
    if c.regresada_en is null and c.telefono10 is not null and exists (
         select 1 from llamadas o where o.telefono10 = c.telefono10 and o.id <> c.id and not o.nadie_contesto
           and o.atendio_directorio is not null and o.inicio > coalesce(c.inicio, c.creado_en)) then
      update llamadas set regresada_en = now(), regresada_como = 'volvio_a_llamar' where id = c.id returning * into c;
    end if;
    -- Al dueño (vendedor del cliente o del lead), una vez. Sin dueño la ven recepción y la gerencia.
    if c.avisado_en is null and c.regresada_en is null then
      v_duenos := array_remove(array[(select vendedor_id from clientes where id = c.cliente_id),
                                     (select vendedor_id from leads where id = c.lead_id)], null);
      if cardinality(v_duenos) > 0 then
        perform avisar(v_duenos, 'llamada_perdida',
          'Te llamó ' || coalesce(c.lead_nombre, c.cliente_nombre, c.telefono, 'alguien') || ' y nadie contestó',
          coalesce(c.resumen, 'Regrésale la llamada.'), '/ventas/para-llamar', 'llamadas', c.id::text);
      end if;
      update llamadas set avisado_en = now() where id = c.id;
    end if;
  elsif c.atendio_directorio is not null and c.telefono10 is not null then
    -- La atendió una persona: las perdidas anteriores del mismo número ya no hay que regresarlas.
    update llamadas set regresada_en = coalesce(c.inicio, now()), regresada_por = c.atendio_perfil, regresada_como = 'volvio_a_llamar'
    where telefono10 = c.telefono10 and id <> c.id and nadie_contesto and regresada_en is null
      and coalesce(inicio, creado_en) < coalesce(c.inicio, c.creado_en);
  end if;

  update telefono_cuenta set ultimo_evento_en = now(), ultimo_error = null, ultimo_error_en = null where id = 1;
  return jsonb_build_object('ok', true, 'llamada_id', c.id, 'lead_id', c.lead_id, 'cliente_id', c.cliente_id);
end $$;
revoke execute on function public.telefono_registrar_evento(jsonb) from public, anon, authenticated;
grant execute on function public.telefono_registrar_evento(jsonb) to service_role;

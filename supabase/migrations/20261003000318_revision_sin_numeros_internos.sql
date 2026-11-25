-- =============================================================================
-- «Por revisar»: sin números internos, el aviso abre el registro, y el lead convertido es del vendedor.
--
-- Por qué: a Karen le llegó «Lead 98e6ed2b de La Piedad parece repetido con el 709763c4», con el
-- identificador interno en el título y en la evidencia. Nadie puede buscar ese número, «Abrir» la
-- llevaba a la lista de leads y no al lead, y la IA la estuvo cuestionando hasta mandarlo a
-- dirección porque ella «no lo encontraba». Además no eran repetidos (Heriberto Ramírez y Marco,
-- con teléfonos distintos): la IA no ve nombres ni teléfonos de leads, así que no puede juzgarlo.
-- Y el otro aviso (lead convertido con empresa «pendiente») le tocaba a quien lo convirtió.
--
-- Qué cambia:
--   · Un hallazgo de un lead abre ese lead (/ventas/leads?id=…). El de un lead convertido le toca
--     al vendedor; mientras no se convierte, a quien lo capturó.
--   · La evidencia ya no enseña identificadores internos: solo folios que la gente ve.
--   · Los avisos abiertos se acomodan igual.
-- =============================================================================

do $$
declare v_def text := pg_get_functiondef('public.revision_guardar_claude(bigint, text, text, jsonb)'::regprocedure);
  v_lead text := 'select l.id::text, ''/ventas/leads'', array_remove(array[l.capturado_por], null) into v_id, v_ruta, v_resp';
  v_evid text := 'jsonb_build_object(''tipo'', h->>''tabla'', ''referencia'', v_id, ''folio'', h->>''ref'')';
begin
  if v_def like '%/ventas/leads?id=%' then return; end if;
  if position(v_lead in v_def) = 0 or position(v_evid in v_def) = 0 then
    raise exception 'revision_guardar_claude ya no es la que se conocía';
  end if;
  v_def := replace(v_def, v_lead, 'select l.id::text, ''/ventas/leads?id='' || l.id,
          array_remove(array[case when l.estado::text = ''convertido'' then coalesce(l.vendedor_id, l.capturado_por) else l.capturado_por end], null)
          into v_id, v_ruta, v_resp');
  v_def := replace(v_def, v_evid, 'jsonb_build_object(''tipo'', h->>''tabla'', ''referencia'', v_id,
            ''folio'', case when h->>''ref'' ~* ''^[0-9a-f]{8}-[0-9a-f]{4}-'' or h->>''ref'' ~ ''^[0-9]+$'' then null else h->>''ref'' end)');
  execute v_def;
end $$;

-- Los abiertos: el lead se abre directo, sin números internos en la evidencia, y el convertido va al vendedor.
update revision_hallazgos h set ruta = '/ventas/leads?id=' || h.registro_id
where h.tabla = 'leads' and h.registro_id is not null and h.ruta = '/ventas/leads';

update revision_hallazgos h set evidencia = (
  select coalesce(jsonb_agg(case when e->>'folio' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-' then e - 'folio' else e end), '[]'::jsonb)
  from jsonb_array_elements(h.evidencia) e)
where h.estado = 'abierto' and h.evidencia::text ~* '"folio": "[0-9a-f]{8}-[0-9a-f]{4}-';

update revision_hallazgos h set responsables = array[l.vendedor_id]
from leads l
where h.tabla = 'leads' and h.registro_id = l.id::text and h.estado = 'abierto' and h.origen = 'claude'
  and l.estado::text = 'convertido' and l.vendedor_id is not null and not (l.vendedor_id = any(h.responsables));

-- El lead del teléfono toma el nombre y lo que busca de la última foto de la llamada, mientras nadie
-- los haya cambiado a mano. Lo que NO: pisar lo que una persona escribió.
create or replace function pg_temp.foto277(p_seg int, p_lead jsonb)
returns jsonb language sql as $$
  select public.telefono_registrar_evento(jsonb_build_object('version', 1, 'tipo', 'llamada', 'call_sid', 'CA277-1',
    'enviado_en', now() + make_interval(secs => p_seg), 'lead', p_lead,
    'llamada', jsonb_build_object('telefono', '+522382510277', 'inicio', now() - interval '3 minutes',
      'estado', 'in-progress', 'area', 'ventas', 'area_nombre', 'Ventas', 'nadie_contesto', true)))
$$;

do $$
declare r jsonb; v_l uuid;
begin
  -- 1. A mitad de la llamada todavía no sabe el nombre.
  r := pg_temp.foto277(0, '{"telefono": "+522382510277", "interes": "Cribadora para maíz"}');
  v_l := (r->>'lead_id')::uuid;
  assert (select nombre = 'Sin nombre' from leads where id = v_l), 'el primer lead no salió «Sin nombre»';

  -- 2. Al colgar llega completa: toma el nombre, lo que busca y las notas.
  perform pg_temp.foto277(10, '{"telefono": "+522382510277", "nombre": "Sergio Cruz 277", "interes": "Cribadora ZAR para maíz, 10 t/h", "detalle": "Cotización por WhatsApp"}');
  assert (select nombre = 'Sergio Cruz 277' and interes = 'Cribadora ZAR para maíz, 10 t/h' and notas like '%Cotización por WhatsApp%'
          from leads where id = v_l), format('no tomó la foto final: %s', (select row(nombre, interes, notas) from leads where id = v_l));
  assert (select lead_nombre = 'Sergio Cruz 277' from llamadas where call_sid = 'CA277-1'), 'la llamada sigue diciendo «Sin nombre»';

  -- 3. Lo que NO: si alguien ya lo corrigió a mano, una foto más no lo pisa.
  update leads set nombre = 'Sergio Cruz Méndez 277', interes = 'Zaranda ZAR-6T' where id = v_l;
  perform pg_temp.foto277(20, '{"telefono": "+522382510277", "nombre": "Sergio Cruz 277", "interes": "Cribadora ZAR para maíz"}');
  assert (select nombre = 'Sergio Cruz Méndez 277' and interes = 'Zaranda ZAR-6T' from leads where id = v_l), 'pisó lo que escribió una persona';
end $$;

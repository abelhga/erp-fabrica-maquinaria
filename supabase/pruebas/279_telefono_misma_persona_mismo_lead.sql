-- Si alguien vuelve a llamar desde un número con un lead abierto, la llamada se suma a ese lead y su
-- vendedor se entera. Lo que NO: crear un lead repetido, ni sumarla a un lead ya descartado.
create or replace function pg_temp.foto279(p_sid text, p_lead jsonb)
returns jsonb language sql as $$
  select public.telefono_registrar_evento(jsonb_build_object('version', 1, 'tipo', 'llamada', 'call_sid', p_sid,
    'enviado_en', now(), 'lead', p_lead,
    'llamada', jsonb_build_object('telefono', '+522281084279', 'inicio', now() - interval '3 minutes',
      'estado', 'completed', 'area', 'ventas', 'area_nombre', 'Ventas', 'nadie_contesto', true)))
$$;

do $$
declare v_ven uuid; r1 jsonb; r2 jsonb; r3 jsonb; v_l uuid;
begin
  v_ven := pg_temp.usuario('ven279@hegamex.com', '{ventas}');
  r1 := pg_temp.foto279('CA279-1', '{"nombre": "José María 279", "empresa": "ASA 279", "telefono": "+522281084279", "interes": "Banda para café húmedo 18 t/h"}');
  v_l := (r1->>'lead_id')::uuid;
  update leads set vendedor_id = v_ven, estado = 'asignado' where id = v_l;

  -- 1. Vuelve a llamar: misma persona, mismo lead, nota y aviso a su vendedor.
  r2 := pg_temp.foto279('CA279-2', '{"nombre": "José María 279", "empresa": "Asan 279", "telefono": "+522281084279", "interes": "Seguimiento de su cotización", "detalle": "Pregunta por la cotización de la banda"}');
  assert (r2->>'lead_id')::uuid = v_l, format('creó otro lead: %s', r2);
  assert (select count(*) from leads where telefono = '+522281084279') = 1, 'quedaron dos leads';
  assert (select count(*) from llamadas where lead_id = v_l) = 2, 'la segunda llamada no se ligó';
  assert (select notas like '%Volvió a llamar (teléfono con IA): Pregunta por la cotización de la banda%' from leads where id = v_l), 'no quedó la nota';
  assert (select empresa = 'ASA 279' and interes = 'Banda para café húmedo 18 t/h' from leads where id = v_l), 'la llamada nueva pisó el lead';
  assert exists (select 1 from avisos where usuario_id = v_ven and tipo = 'lead' and titulo like 'Volvió a llamar%' and registro_id = v_l::text),
    'su vendedor no se enteró';

  -- 2. Lo que NO: si ese lead ya se descartó, una llamada nueva sí abre otro.
  update leads set estado = 'descartado', motivo_descarte = 'Prueba 279' where id = v_l;
  r3 := pg_temp.foto279('CA279-3', '{"nombre": "José María 279", "telefono": "+522281084279", "interes": "Otra banda para café"}');
  assert (r3->>'lead_id')::uuid is distinct from v_l and r3->>'lead_id' is not null, format('se sumó a un lead descartado: %s', r3);
end $$;

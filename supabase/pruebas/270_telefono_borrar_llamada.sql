-- Borrar una llamada de prueba del conmutador: se va con su coaching, su análisis, su actividad y
-- su lead si nadie lo trabajó; una foto que llegue después no la vuelve a crear. Lo que NO: una
-- sesión normal no puede borrar llamadas, y un lead ya trabajado se queda.
create or replace function pg_temp.foto(p_sid text, p_tel text, p_lead jsonb)
returns jsonb language sql as $$
  select public.telefono_registrar_evento(jsonb_build_object('version', 1, 'tipo', 'llamada', 'call_sid', p_sid,
    'enviado_en', now(), 'lead', p_lead,
    'llamada', jsonb_build_object('telefono', p_tel, 'inicio', now() - interval '1 hour', 'fin', now() - interval '55 minutes',
      'duracion_seg', 300, 'estado', 'completed', 'area', 'ventas', 'area_nombre', 'Ventas',
      'atendio', jsonb_build_object('nombre', 'Vendedor 270', 'telefono', '+523311112700'), 'nadie_contesto', false,
      'resumen', 'Prueba 270')))
$$;

do $$
declare v_a uuid; r jsonb; v_l1 uuid; v_l2 uuid; v_ok boolean;
begin
  v_a := pg_temp.usuario('vena270@hegamex.com', '{ventas}');
  update perfiles set telefono = '33 1111 2700' where id = v_a;
  update configuracion set valor = valor || '{"modo": "bandeja", "vendedores": []}' where clave = 'leads';

  r := pg_temp.foto('CA270-1', '+528180002701', '{"nombre": "Ana 270", "telefono": "+528180002701", "interes": "Cribadora 2 t/h"}');
  v_l1 := (r->>'lead_id')::uuid;
  assert v_l1 is not null, format('la foto no dejó lead: %s', r);
  insert into llamada_coaching (llamada_id, perfil_id, atendio_tipo, calificacion, rubrica_clave)
  select id, v_a, 'persona', 1, 'ventas' from llamadas where call_sid = 'CA270-1';

  -- 1. Lo que NO: una sesión normal no borra llamadas.
  perform pg_temp.como(v_a);
  v_ok := false;
  begin perform telefono_borrar_llamada('CA270-1'); v_ok := true; exception when insufficient_privilege then null; end;
  assert not v_ok, 'un vendedor no debe poder borrar llamadas';

  -- 2. El conmutador la borra: llamada, coaching y lead sin trabajar.
  perform pg_temp.como_postgres();
  r := telefono_borrar_llamada('CA270-1');
  assert (r->>'habia')::boolean and (r->>'lead_borrado')::boolean, format('borrar: %s', r);
  assert not exists (select 1 from llamadas where call_sid = 'CA270-1'), 'la llamada sigue';
  assert not exists (select 1 from llamada_coaching k where not exists (select 1 from llamadas c where c.id = k.llamada_id)), 'quedó un coaching huérfano';
  assert not exists (select 1 from leads where id = v_l1), 'el lead sin trabajar debía irse';
  assert not exists (select 1 from avisos where tabla = 'leads' and registro_id = v_l1::text), 'quedó el aviso del lead borrado';

  -- 3. Una foto que llega después (un reintento en la cola) no la vuelve a crear.
  r := pg_temp.foto('CA270-1', '+528180002701', '{"nombre": "Ana 270", "telefono": "+528180002701", "interes": "Cribadora 2 t/h"}');
  assert (r->>'borrada')::boolean and r->'llamada_id' = 'null', format('la foto tardía: %s', r);
  assert not exists (select 1 from llamadas where call_sid = 'CA270-1'), 'la foto tardía la volvió a crear';

  -- 4. Un lead que ya se trabajó se queda; solo pierde la liga con la llamada.
  r := pg_temp.foto('CA270-2', '+528180002702', '{"nombre": "Luis 270", "telefono": "+528180002702", "interes": "Banda 270"}');
  v_l2 := (r->>'lead_id')::uuid;
  perform pg_temp.como(v_a);
  perform registrar_intento_lead(v_l2, 'llamada', 'no_contesto');
  perform pg_temp.como_postgres();
  r := telefono_borrar_llamada('CA270-2');
  assert (r->>'lead_se_quedo')::boolean and not (r->>'lead_borrado')::boolean, format('lead trabajado: %s', r);
  assert exists (select 1 from leads where id = v_l2 and llamada_id is null), 'el lead trabajado debía quedarse, sin la llamada';

  -- 5. Borrar una que no existe no truena y deja el call_sid anotado.
  r := telefono_borrar_llamada('CA270-nunca');
  assert not (r->>'habia')::boolean and exists (select 1 from telefono_borradas where call_sid = 'CA270-nunca'), format('inexistente: %s', r);
end $$;

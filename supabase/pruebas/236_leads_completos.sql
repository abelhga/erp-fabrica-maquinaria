-- «Leads capturados completos»: cuenta lo que le falta a cada lead de quien lo registró, no juzga
-- descartados ni listas de expo, deja de contar cuando se completa, y solo lo completan quien lo
-- registró, el vendedor que lo tiene o la gerencia. Marzo de 2025: un mes sin otros datos de prueba.
do $$
declare
  v_rec uuid; v_rec2 uuid; v_ven uuid; e_rec uuid; e_sin uuid; f_form int; f_expo int; v_cli uuid;
  l_ok uuid; l_sin_lugar uuid; l_vago uuid; l_cliente uuid; l_desc uuid; l_expo uuid; m jsonb; v_ok boolean;
  mes constant date := '2025-03-01';
  t0 constant timestamptz := '2025-03-04 10:00-06';
begin
  v_rec := pg_temp.usuario('rec236@hegamex.com', '{recepcion}');
  v_rec2 := pg_temp.usuario('rec2236@hegamex.com', '{recepcion}');
  v_ven := pg_temp.usuario('ven236@hegamex.com', '{ventas}');
  insert into empleados (nombre, fecha_ingreso, usuario_id) values ('P236 Recepción', '2024-01-01', v_rec) returning id into e_rec;
  insert into empleados (nombre, fecha_ingreso) values ('P236 Sin usuario', '2024-01-01') returning id into e_sin;
  insert into fuentes_contacto (nombre) values ('P236 Formulario') returning id into f_form;
  insert into fuentes_contacto (nombre, de_lista) values ('P236 Expo', true) returning id into f_expo;
  insert into clientes (nombre) values ('P236 Cliente') returning id into v_cli;

  -- 1. Qué le falta: un número o tres palabras bastan para «qué busca»; «Informes» no.
  assert lead_faltan(null, 'Agregados', 'León', null, 'Cribadora V3') = '{}', 'un modelo con número debía bastar';
  assert lead_faltan(null, 'Particular', null, 'Jalisco', 'Silo fijo para cemento') = '{}', 'tres palabras debían bastar';
  assert lead_faltan(null, null, null, null, 'Informes') = array['dónde está', 'empresa', 'qué busca (modelo, medida o para qué)'],
    format('faltantes: %s', lead_faltan(null, null, null, null, 'Informes'));
  assert lead_faltan(v_cli, null, null, null, 'Banda de 6 m') = '{}', 'si ya es cliente, su ficha da empresa y lugar';

  -- 2. Los leads de recepción en marzo. El alta pone fechas y quién capturó de hoy; aquí se ponen las del caso.
  perform pg_temp.como(v_rec);
  insert into leads (nombre, telefono, interes, empresa, ciudad, fuente_id) values ('P236 completo', '3300236001', 'Cribadora V3', 'Agregados', 'León', f_form) returning id into l_ok;
  insert into leads (nombre, telefono, interes, empresa, fuente_id) values ('P236 sin lugar', '3300236002', 'Silo de 30 t', 'Concretos', f_form) returning id into l_sin_lugar;
  insert into leads (nombre, telefono, interes, ciudad, fuente_id) values ('P236 vago', '3300236003', 'Informes', 'Tepic', f_form) returning id into l_vago;
  insert into leads (nombre, telefono, interes, cliente_id, fuente_id) values ('P236 cliente', '3300236004', 'Banda de 6 m', v_cli, f_form) returning id into l_cliente;
  insert into leads (nombre, telefono, interes, fuente_id) values ('P236 descartado', '3300236005', 'Informes', f_form) returning id into l_desc;
  insert into leads (nombre, telefono, interes, fuente_id) values ('P236 expo', '3300236006', 'Informes', f_expo) returning id into l_expo;
  perform pg_temp.como_postgres();
  update leads set creado_en = t0, capturado_por = v_rec where id in (l_ok, l_sin_lugar, l_vago, l_cliente, l_desc, l_expo);
  update leads set estado = 'descartado', motivo_descarte = 'Número equivocado' where id = l_desc;
  update leads set estado = 'asignado', vendedor_id = v_ven, asignado_en = t0 where id = l_sin_lugar;

  m := objetivo_medir('leads_completos', null, e_rec, mes);
  assert (m->>'posibles')::int = 4, format('debían ser 4 (sin descartado ni expo): %s', m);
  assert (m->'evidencias') @> jsonb_build_array(jsonb_build_object('referencia', l_sin_lugar::text, 'cuenta', true, 'detalle', 'falta dónde está'))
    and (m->'evidencias') @> jsonb_build_array(jsonb_build_object('referencia', l_vago::text, 'cuenta', true))
    and (m->'evidencias') @> jsonb_build_array(jsonb_build_object('referencia', l_ok::text, 'cuenta', false))
    and (m->'evidencias') @> jsonb_build_array(jsonb_build_object('referencia', l_cliente::text, 'cuenta', false)), format('evidencias: %s', m);
  assert (objetivo_medir('leads_completos', null, e_sin, mes)->>'sin_dato')::boolean, 'sin usuario debía pedir calificarlo a mano';

  -- 3. Otra recepcionista no completa un lead ajeno; el vendedor que lo tiene, sí; quien lo registró, también.
  perform pg_temp.como(v_rec2);
  begin perform completar_lead(l_vago, 'Particular', 'Tepic', 'Nayarit', 'Cribadora para arena, 5 t/h'); v_ok := true;
  exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'otra recepcionista completó un lead ajeno';
  perform pg_temp.como(v_ven);
  perform completar_lead(l_sin_lugar, 'Concretos', 'Celaya', 'Guanajuato', 'Silo de 30 t');
  perform pg_temp.como(v_rec);
  perform completar_lead(l_vago, 'Particular', 'Tepic', 'Nayarit', 'Cribadora para arena, 5 t/h');
  assert (select faltan from v_leads where id = l_vago) = '{}', 'la vista no lo da por completo';
  --    Un lead cerrado ya no se cambia.
  begin perform completar_lead(l_desc, 'X', 'Y', null, 'Banda de 6 m'); v_ok := true; exception when others then v_ok := false; end;
  assert not v_ok, 'se cambió un lead descartado';
  perform pg_temp.como_postgres();

  -- 4. Completados antes de revisar el mes, ya no cuentan.
  m := objetivo_medir('leads_completos', null, e_rec, mes);
  assert not exists (select 1 from jsonb_array_elements(m->'evidencias') e where (e->>'cuenta')::boolean), format('siguen contando: %s', m);
end $$;

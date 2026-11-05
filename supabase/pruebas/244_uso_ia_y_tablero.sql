-- Costo de la IA con los precios de Configuración (lotes a mitad de precio) y el tablero de uso:
-- trae el periodo y el anterior del mismo largo, y solo lo ve dirección o sistemas.
do $$
declare v_ven uuid; v_dir uuid; r jsonb; p jsonb; v_ok boolean; v_hoy date := (now() at time zone 'America/Mexico_City')::date;
begin
  v_ven := pg_temp.usuario('ven244@hegamex.com', '{ventas}');
  v_dir := pg_temp.usuario('dir244@hegamex.com', '{direccion}');
  update configuracion set valor = '{"descuento_lotes": 0.5, "modelos": {"m244": {"entrada": 4, "salida": 20, "cache_lectura": 0.2, "cache_escritura": 5}}}' where clave = 'precios_ia';

  -- 1 M de entrada + 100 k de salida + 1 M de lectura de caché + 200 k de escritura = 4 + 2 + 0.2 + 1 = 7.2 USD; por lotes, 3.6.
  assert costo_ia_usd('m244', 1000000, 100000, 1000000, 200000) = 7.2, format('costo: %s', costo_ia_usd('m244', 1000000, 100000, 1000000, 200000));
  assert costo_ia_usd('m244', 1000000, 100000, 1000000, 200000, true) = 3.6, 'lotes no van a mitad de precio';
  assert costo_ia_usd(null, 1000, 1000, 0, 0) = 0, 'sin modelo (simulado) no cuesta';

  -- El vendedor usó la IA hoy y hace 10 días; con un periodo de 7 días, lo de hace 10 cae en el anterior.
  insert into asistente_uso (usuario_id, modo, modelo, entrada_tokens, salida_tokens, cache_tokens, cache_escritura_tokens, en)
  values (v_ven, 'chat', 'm244', 1000000, 0, 0, 0, now()), (v_ven, 'chat', 'm244', 500000, 0, 0, 0, now() - interval '10 days');

  perform pg_temp.como(v_ven);
  begin perform uso_tablero(v_hoy - 6, v_hoy); v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'un vendedor vio el tablero de uso';

  perform pg_temp.como(v_dir);
  r := uso_tablero(v_hoy - 6, v_hoy);
  assert (r->'periodo'->>'ant_desde')::date = v_hoy - 13 and jsonb_array_length(r->'por_dia') = 7 and jsonb_array_length(r->'por_dia_ant') = 7,
    format('periodos: %s', r->'periodo');
  select x into p from jsonb_array_elements(r->'personas') x where x->>'id' = v_ven::text;
  assert (p->>'costo_ia_usd')::numeric = 4 and (p->'ant'->>'costo_ia_usd')::numeric = 2 and (p->>'consultas_ia')::int = 1,
    format('persona: %s', p);
  perform pg_temp.como_postgres();
end $$;

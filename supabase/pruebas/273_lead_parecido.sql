-- Al registrar un lead se avisa si ya hay uno abierto de la misma persona o empresa, aunque el
-- teléfono sea otro (Sandra Patlán, 10 nov). Lo que NO: un solo nombre o «Particular» no cuentan,
-- un lead descartado no sale, y quien no registra leads no puede preguntar.
do $$
declare v_rec uuid; v_ven uuid; v_prod uuid; v_l uuid; v_l2 uuid; r record; v_n int; v_ok boolean;
begin
  v_rec := pg_temp.usuario('rec273@hegamex.com', '{recepcion}');
  v_ven := pg_temp.usuario('ven273@hegamex.com', '{ventas}');
  v_prod := pg_temp.usuario('prod273@hegamex.com', '{produccion}');
  update configuracion set valor = valor || '{"modo": "recepcion"}' where clave = 'leads';

  -- El lead que dejó la IA, de la vendedora.
  insert into leads (nombre, empresa, telefono, interes, vendedor_id)
  values ('Sandra Patlán 273', 'El Surco 273, S.A. de C.V.', '+524151523273', 'Cribadora V3 para maíz', v_ven) returning id into v_l;
  insert into leads (nombre, empresa, telefono, interes, vendedor_id)
  values ('Rosa Gil 273', 'Molinos 273', '4151112273', 'Tolva 273', v_ven) returning id into v_l2;
  update leads set estado = 'descartado', motivo_descarte = 'Prueba 273' where id = v_l2;

  perform pg_temp.como(v_rec);
  -- 1. Otro teléfono, con título y sin «S.A. de C.V.»: lo encuentra por nombre y por empresa.
  select * into r from lead_parecido('Ing. sandra patlan 273', 'El Surco 273', '415 151 0573');
  assert r.lead_id = v_l and r.coincide = 'el nombre y la empresa' and r.vendedor is not null, format('no encontró a Sandra: %s', r);
  assert not r.lo_ves, 'recepción no abre el lead de otra vendedora';
  -- 2. Solo la empresa, o solo el teléfono, también.
  assert (select coincide from lead_parecido('Pedro Ruiz', 'el surco 273 sa de cv', null)) = 'la empresa', 'por empresa';
  assert (select coincide from lead_parecido('Pedro Ruiz', null, '415 152 3273')) = 'el teléfono', 'por teléfono';

  -- 3. Lo que NO: un solo nombre, una empresa genérica, un lead descartado.
  select count(*) into v_n from lead_parecido('Sandra', 'Particular', null);
  assert v_n = 0, 'un solo nombre o «Particular» no deben coincidir';
  select count(*) into v_n from lead_parecido('Rosa Gil 273', 'Molinos 273', '4151112273');
  assert v_n = 0, 'salió un lead descartado';

  -- 4. La vendedora lo abre; quien no registra leads no pregunta.
  perform pg_temp.como(v_ven);
  assert (select lo_ves from lead_parecido('Sandra Patlán 273', null, null)), 'la vendedora debía poder abrir su lead';
  perform pg_temp.como(v_prod);
  begin perform lead_parecido('Sandra Patlán 273', null, null); v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'producción pudo buscar leads';
end $$;

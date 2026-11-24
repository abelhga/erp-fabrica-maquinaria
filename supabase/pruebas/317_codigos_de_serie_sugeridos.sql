-- La IA propone códigos de serie, ingeniería los acepta, y las órdenes que nacieron sin serie
-- reciben su número al tener código. Una propuesta no numera nada por sí sola. Ventas no propone
-- ni acepta.
do $$
declare v_ing uuid; v_ven uuid; v_eq uuid; v_eq2 uuid; v_eq3 uuid; v_op uuid; v_ok boolean; j jsonb; v_n int; v_ult int;
begin
  v_ing := pg_temp.usuario('ing317@hegamex.com', '{ingenieria}');
  v_ven := pg_temp.usuario('ven317@hegamex.com', '{ventas}');
  insert into articulos (clave, tipo, nombre) values ('T317-B', 'equipo', 'Banda cargadora de 20" x 9.6 metros prueba') returning id into v_eq;
  insert into articulos (clave, tipo, nombre) values ('T317-C', 'equipo', 'Cribadora prueba 317') returning id into v_eq2;
  insert into articulos (clave, tipo, nombre) values ('T317-R', 'equipo', 'Rodillo de 3" prueba 317') returning id into v_eq3;
  -- Una orden del equipo sin código: nace sin serie.
  insert into ordenes_produccion (articulo_id, cantidad, estado) values (v_eq, 1, 'planeada') returning id into v_op;
  assert (select numero_serie from ordenes_produccion where id = v_op) is null, 'una orden sin código nació con serie';

  -- Ventas no ve lo que se le manda a la IA ni guarda propuestas.
  perform pg_temp.como(v_ven);
  begin j := codigos_serie_por_sugerir(10); v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'ventas pidió los datos para proponer códigos';
  begin perform guardar_codigos_sugeridos('[]'); v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'ventas guardó propuestas';

  perform pg_temp.como(v_ing);
  j := codigos_serie_por_sugerir(60);
  assert exists (select 1 from jsonb_array_elements(j->'equipos') e where e->>'id' = v_eq::text), format('el equipo sin código no se manda: %s', left(j::text, 300));
  assert jsonb_array_length(j->'familias') > 0, 'faltan las familias';

  v_n := guardar_codigos_sugeridos(jsonb_build_array(
    jsonb_build_object('id', v_eq, 'familia', 'banda', 'codigo', 'tb-2009 0275e', 'seguro', 'alto', 'por_que', 'del nombre y su motorreductor'),
    jsonb_build_object('id', v_eq2, 'familia', 'cribadora', 'codigo', 'CV0200N', 'seguro', 'medio', 'por_que', 'supuse la turbina'),
    jsonb_build_object('id', v_eq3, 'familia', null, 'codigo', null, 'seguro', 'bajo', 'por_que', 'es una refacción, no lleva serie')));
  assert v_n = 3, format('guardó %s', v_n);
  assert (select codigo_serie_sugerido from articulos where id = v_eq) = 'TB20090275E', 'el código no se limpió a letras y números';
  -- Una propuesta sola no numera.
  assert (select codigo_serie from articulos where id = v_eq) is null and (select numero_serie from ordenes_produccion where id = v_op) is null,
    'la propuesta numeró sin que nadie la aceptara';
  -- Lo ya procesado no se vuelve a mandar.
  j := codigos_serie_por_sugerir(60);
  assert not exists (select 1 from jsonb_array_elements(j->'equipos') e where e->>'id' in (v_eq::text, v_eq2::text, v_eq3::text)), 'se volvió a mandar lo propuesto';

  -- Ventas no acepta.
  perform pg_temp.como(v_ven);
  begin perform aceptar_codigos_sugeridos(null, 'alto'); v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'ventas aceptó códigos';

  -- Aceptar las seguras: solo la de seguridad alta; su orden sin serie recibe número.
  perform pg_temp.como(v_ing);
  select ultimo into v_ult from familias_serie where clave = 'banda';
  v_n := aceptar_codigos_sugeridos(null, 'alto');
  assert v_n >= 1 and (select codigo_serie from articulos where id = v_eq) = 'TB20090275E', 'no se aceptó la segura';
  assert (select codigo_serie from articulos where id = v_eq2) is null, 'se aceptó una que no era segura';
  assert (select numero_serie from ordenes_produccion where id = v_op) like 'TB20090275E%', format('la orden no recibió serie: %s', (select numero_serie from ordenes_produccion where id = v_op));
  assert exists (select 1 from op_eventos where orden_id = v_op and nota like 'Número de serie asignado%'), 'no quedó en la línea de tiempo de la orden';

  -- Capturar a mano (o aceptar corrigiéndola) limpia la propuesta.
  perform fijar_codigo_serie(v_eq2, 'cribadora', 'CV0300N');
  assert (select codigo_serie_sugerido from articulos where id = v_eq2) is null and (select codigo_serie from articulos where id = v_eq2) = 'CV0300N', 'la propuesta siguió ahí';
end $$;

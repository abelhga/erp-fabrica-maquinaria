-- La bitácora de listas de materiales y del material de una orden dice de qué es (equipo u OP,
-- artículo y cantidad), también cuando el renglón ya se borró, y trae el nombre de los ids del cambio.
do $$
declare v_eq uuid; v_a uuid; v_l uuid; r record;
begin
  insert into articulos (clave, tipo, nombre, unidad) values ('T241-EQ', 'equipo', 'Tolva 241', 'pieza') returning id into v_eq;
  insert into articulos (clave, tipo, nombre, unidad) values ('T241-L', 'materia_prima', 'Lámina 241', 'pieza') returning id into v_a;
  insert into bom_lineas (padre_id, hijo_id, cantidad) values (v_eq, v_a, 4.5) returning id into v_l;
  update bom_lineas set redondear_arriba = true where id = v_l;
  select * into r from v_bitacora where tabla = 'bom_lineas' and registro_id = v_l::text and accion = 'cambio';
  assert r.etiqueta = 'Tolva 241 › T241-L Lámina 241 × 4.5 pieza', format('etiqueta del cambio: %s', r.etiqueta);
  select * into r from v_bitacora where tabla = 'bom_lineas' and registro_id = v_l::text and accion = 'alta';
  assert r.nombres ->> v_a::text = 'T241-L · Lámina 241' and r.nombres ->> v_eq::text = 'T241-EQ · Tolva 241', format('nombres: %s', r.nombres);
  -- Borrado el renglón, el cambio de antes se sigue entendiendo (sus ids salen de su alta).
  delete from bom_lineas where id = v_l;
  select * into r from v_bitacora where tabla = 'bom_lineas' and registro_id = v_l::text and accion = 'cambio';
  assert r.etiqueta like 'Tolva 241 › T241-L Lámina 241%', format('etiqueta ya borrado: %s', r.etiqueta);
end $$;

-- Un artículo nuevo o renombrado queda con la convención de nombres, y al capturar se avisa si ya
-- existe uno igual aunque se escriba distinto. Lo que NO: cambiar claves, números de parte o medidas,
-- ni tomar por igual uno de otra medida.
do $$
declare v_ing uuid; a uuid; b uuid; e uuid; r jsonb;
begin
  v_ing := pg_temp.usuario('ing276@hegamex.com', '{ingenieria}');
  perform pg_temp.como_postgres();
  insert into articulos (clave, tipo, nombre) values ('T276-A', 'componente', 'TORNILLO 8X25MM GALVANIZADO T276') returning id into a;
  insert into articulos (clave, tipo, nombre) values ('T276-B', 'materia_prima', 'Angulo 2 x 3/16" x 6.10 mts Inox T276') returning id into b;
  insert into articulos (clave, tipo, nombre) values ('T276-E', 'equipo', 'Banda Cargadora De 20" X 10 MTS T276') returning id into e;

  -- 1. Al dar de alta queda con la convención.
  assert (select nombre from articulos where id = a) = 'Tornillo 8 x 25 mm galvanizado T276', (select nombre from articulos where id = a);
  assert (select nombre from articulos where id = b) = 'Ángulo 2 x 3/16" x 6.10 m inoxidable T276', (select nombre from articulos where id = b);
  assert (select nombre from articulos where id = e) = 'Banda cargadora de 20" x 10 metros T276', (select nombre from articulos where id = e);
  -- Claves, modelos y marcas se respetan.
  assert nombre_convencion('Contactor 3hp 3RT20181AN61 siemens', 'componente') = 'Contactor 3 HP 3RT20181AN61 Siemens', 'tocó el modelo o la marca';
  assert nombre_convencion('BANDA TELESCOPICA 80 CM X 16 METROS BTH-16', 'componente') = 'Banda telescópica 80 cm x 16 m BTH-16', 'tocó la clave con guion';

  -- 2. Al renombrar, también.
  update articulos set nombre = 'tuerca p/capuchon T276' where id = a;
  assert (select nombre from articulos where id = a) = 'Tuerca para capuchón T276', (select nombre from articulos where id = a);
  update articulos set nombre = 'TORNILLO 8X25MM GALVANIZADO T276' where id = a;

  -- 3. Al capturar, avisa del repetido aunque se escriba distinto o en otro orden.
  perform pg_temp.como(v_ing);
  r := revisar_nombre_articulo('tornillo 8 X 25mm galvanizado t276', 'componente');
  assert r->>'nombre' = 'Tornillo 8 x 25 mm galvanizado t276' and r->'parecidos'->0->>'clave' = 'T276-A', format('tornillo: %s', r);
  r := revisar_nombre_articulo('ANGULO 3/16 X 2 X 6.10 MTS INOX T276', 'componente');
  assert r->'parecidos'->0->>'clave' = 'T276-B', format('ángulo en otro orden: %s', r);
  -- Lo que NO: otra medida no es el mismo, y uno no se encuentra a sí mismo.
  r := revisar_nombre_articulo('Tornillo 8 x 30 mm galvanizado T276', 'componente');
  assert jsonb_array_length(r->'parecidos') = 0, format('tomó por igual otra medida: %s', r);
  r := revisar_nombre_articulo('Tornillo 8 x 25 mm galvanizado T276', 'componente', a);
  assert jsonb_array_length(r->'parecidos') = 0, format('se encontró a sí mismo: %s', r);
end $$;

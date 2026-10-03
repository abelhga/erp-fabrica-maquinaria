-- Aplicar un subensamble sugerido no debe mover ni un centavo el costo ni el precio
-- de los equipos que lo usan, y solo ingeniería/dirección pueden hacerlo.
do $$
declare
  v_ing uuid; v_vend uuid; v_llanta uuid; v_rin uuid; v_cat uuid; v_motor uuid;
  v_e1 uuid; v_e2 uuid; v_e3 uuid; v_sug int; v_sub uuid; v_n int;
begin
  v_ing := pg_temp.usuario('ingenieria@hegamex.com', '{ingenieria}');
  v_vend := pg_temp.usuario('isaac@hegamex.com', '{ventas}');
  insert into articulos (clave, tipo, nombre) values ('T-LL', 'componente', 'Llanta 185/70') returning id into v_llanta;
  insert into articulos (clave, tipo, nombre) values ('T-RIN', 'componente', 'Rin 14 con masa') returning id into v_rin;
  insert into articulos (clave, tipo, nombre) values ('T-CAT', 'componente', 'Catarina 60-11') returning id into v_cat;
  insert into articulos (clave, tipo, nombre) values ('T-MOT', 'componente', 'Motor 3 HP') returning id into v_motor;
  insert into costos_articulo (articulo_id, costo) values (v_llanta, 1200), (v_rin, 900), (v_cat, 250.5), (v_motor, 8000);
  insert into articulos (clave, tipo, nombre, categoria_id) select 'T-E' || g, 'equipo', 'Bazuca ' || g,
    (select id from categorias where nombre = 'Bazuca') from generate_series(1, 3) g;
  select id into v_e1 from articulos where clave = 'T-E1';
  select id into v_e2 from articulos where clave = 'T-E2';
  select id into v_e3 from articulos where clave = 'T-E3';
  insert into bom_lineas (padre_id, hijo_id, cantidad, orden)
  select e, h, q, o from unnest(array[v_e1, v_e2, v_e3]) e,
    (values (v_llanta, 2, 1), (v_rin, 2, 2), (v_cat, 1, 3)) x(h, q, o);
  insert into bom_lineas (padre_id, hijo_id, cantidad, orden) values (v_e1, v_motor, 1, 4), (v_e2, v_motor, 2, 4);

  create temp table _antes on commit drop as
    select cc.articulo_id, cc.costo_total, pl.precio from costos_calculados cc join precios_lista pl using (articulo_id)
    where articulo_id in (v_e1, v_e2, v_e3);

  insert into sugerencias_subensamble (componentes, equipos, lineas, ahorro, nombre_sugerido)
  values (jsonb_build_array(jsonb_build_object('articulo_id', v_llanta, 'cantidad', 2), jsonb_build_object('articulo_id', v_rin, 'cantidad', 2),
                            jsonb_build_object('articulo_id', v_cat, 'cantidad', 1)), array[v_e1, v_e2, v_e3], 3, 4, 'Kit de ruedas')
  returning id into v_sug;

  -- Un vendedor no puede.
  perform pg_temp.como(v_vend);
  begin
    perform aplicar_sugerencia_subensamble(v_sug, 'T-SUB-RUEDAS', 'Kit de ruedas 14"');
    assert false, 'un vendedor aplicó un subensamble';
  exception when insufficient_privilege then null;
  end;

  perform pg_temp.como(v_ing);
  v_sub := aplicar_sugerencia_subensamble(v_sug, 'T-SUB-RUEDAS', 'Kit de ruedas 14"');
  perform pg_temp.como_postgres();

  -- Cada equipo pasó de 3 líneas de ruedas a 1 línea de subensamble.
  select count(*) into v_n from bom_lineas where padre_id = v_e1;
  assert v_n = 2, format('E1 debía quedar con motor + subensamble, quedó con %s líneas', v_n);
  select count(*) into v_n from bom_lineas where hijo_id = v_sub;
  assert v_n = 3, 'el subensamble debe usarse en los 3 equipos';
  -- Costo y precio idénticos.
  select count(*) into v_n from _antes a join costos_calculados cc using (articulo_id) join precios_lista pl using (articulo_id)
  where round(a.costo_total, 4) <> round(cc.costo_total, 4) or a.precio <> pl.precio;
  assert v_n = 0, format('%s equipos cambiaron de costo o precio al aplicar el subensamble', v_n);
  -- Ya no se puede aplicar dos veces.
  begin
    perform pg_temp.como(v_ing);
    perform aplicar_sugerencia_subensamble(v_sug, 'T-SUB-2', 'Otra vez');
    assert false, 'se aplicó dos veces la misma sugerencia';
  exception when others then
    if sqlerrm not like '%ya fue%' then raise; end if;
  end;
end $$;

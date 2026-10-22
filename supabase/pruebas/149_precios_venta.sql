-- Los precios de venta los ve quien vende o decide precios (ventas, recepción, finanzas,
-- dirección); ingeniería, el taller, almacén, compras y mantenimiento no. El buscador lleva
-- a cada quien a donde puede entrar.
do $$
declare v_art uuid; v_sub uuid; r record; v_ve boolean; v_ing uuid; v_rec uuid; v_vend uuid; v_mtto uuid;
begin
  insert into articulos (clave, tipo, nombre, se_vende) values ('T149-POL', 'componente', 'Polea precio 149', true) returning id into v_art;
  insert into articulos (clave, tipo, nombre) values ('T149-SUB', 'subensamble', 'Cabezal precio 149') returning id into v_sub;
  insert into precios_lista (articulo_id, precio) values (v_art, 1490);
  v_ing := pg_temp.usuario('ing149b@hegamex.com', '{ingenieria}');
  v_rec := pg_temp.usuario('rec149b@hegamex.com', '{recepcion}');
  v_vend := pg_temp.usuario('vend149b@hegamex.com', '{ventas}');
  v_mtto := pg_temp.usuario('mtto149b@hegamex.com', '{mantenimiento}');
  insert into publicaciones (articulo_id, canal, id_externo, titulo, precio) values (v_art, 'mercadolibre', 'MLM149', 'Polea 149', 1790);

  for r in select * from (values
      ('{ventas}', true), ('{gerente_ventas}', true), ('{recepcion}', true), ('{finanzas}', true), ('{administracion}', true),
      ('{direccion}', true), ('{ingenieria}', false), ('{produccion}', false), ('{gerente_produccion}', false),
      ('{almacen}', false), ('{compras}', false), ('{mantenimiento}', false), ('{importaciones}', false)) x(roles, ve) loop
    perform pg_temp.como(pg_temp.usuario('precio149' || md5(r.roles) || '@hegamex.com', r.roles::app_rol[]));
    v_ve := ve_precios_venta();
    assert v_ve = r.ve, format('%s: ve_precios_venta = %s', r.roles, v_ve);
    assert (exists (select 1 from precios_lista where articulo_id = v_art)) = r.ve, format('%s: precios_lista', r.roles);
    assert ((select precio from v_catalogo where id = v_art) is not null) = r.ve, format('%s: v_catalogo.precio', r.roles);
    assert ((select precio from buscar_articulos('T149-POL') where id = v_art limit 1) is not null) = r.ve, format('%s: buscar_articulos', r.roles);
    assert (exists (select 1 from precios_por_canal(v_art))) = r.ve, format('%s: precios_por_canal', r.roles);
    assert (exists (select 1 from publicaciones where articulo_id = v_art)) = r.ve, format('%s: publicaciones', r.roles);
    perform pg_temp.como_postgres();
  end loop;

  -- El buscador: ingeniería a costeo; ventas y recepción al catálogo (sin subensambles);
  -- quien no tiene ni costeo ni precios (mantenimiento) no recibe artículos.
  perform pg_temp.como(v_ing);
  assert (select ruta from buscar_global('T149-POL') where id = v_art::text) = '/costeo/componentes/' || v_art, 'ingeniería no va a costeo';
  perform pg_temp.como(v_rec);
  assert (select ruta from buscar_global('T149-POL') where id = v_art::text) = '/catalogo?articulo=' || v_art, 'recepción no va al catálogo';
  assert not exists (select 1 from buscar_global('T149-SUB') where id = v_sub::text), 'recepción encontró un subensamble';
  perform pg_temp.como(v_vend);
  assert puede('catalogo', 1), 'ventas no tiene el catálogo';
  -- (En la nube ventas ya no tiene costeo; en la base local sí: cada quien va a donde puede entrar.)
  assert (select ruta from buscar_global('T149-POL') where id = v_art::text)
         = case when puede('costeo', 1) then '/costeo/componentes/' else '/catalogo?articulo=' end || v_art, 'ventas no va a donde puede entrar';
  perform pg_temp.como(v_mtto);
  assert not exists (select 1 from buscar_global('T149-POL') where id = v_art::text), 'mantenimiento recibió un artículo a donde no puede entrar';

  -- Ingeniería: costos sí, márgenes ya no.
  perform pg_temp.como(v_ing);
  assert puede('costos', 2) and not puede('margenes', 1), 'permisos de ingeniería';
end $$;

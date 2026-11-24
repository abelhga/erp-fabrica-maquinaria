-- El catálogo dice cuánto está apartado (también a quien solo ve el catálogo, como marketing), y
-- un componente se inhabilita en vez de borrarse: lo hacen ingeniería o compras, no ventas ni
-- marketing; e inhabilitado ya no sale en el buscador pero conserva su existencia y su historia.
do $$
declare v_mkt uuid; v_comp uuid; v_ven uuid; v_art uuid; v_eq uuid; v_alm int; v_ok boolean; r jsonb;
begin
  v_mkt := pg_temp.usuario('mkt312@hegamex.com', '{marketing}');
  v_comp := pg_temp.usuario('comp312@hegamex.com', '{compras}');
  v_ven := pg_temp.usuario('ven312@hegamex.com', '{ventas}');
  select id into v_alm from almacenes where disponible_para_planta order by id limit 1;
  insert into articulos (clave, tipo, nombre, unidad) values ('T312-POL', 'componente', 'Polea 312', 'pieza') returning id into v_art;
  insert into articulos (clave, tipo, nombre, unidad) values ('T312-EQ', 'equipo', 'Banda 312', 'pieza') returning id into v_eq;
  insert into existencias (articulo_id, almacen_id, cantidad) values (v_art, v_alm, 10);
  insert into reservas (articulo_id, cantidad, surtido, estado, motivo) values (v_art, 4, 1, 'activa', 'Prueba 312');

  -- Marketing ve 10 en existencia y 3 apartados: le quedan 7 para vender.
  perform pg_temp.como(v_mkt);
  assert (select existencia = 10 and apartado = 3 from v_catalogo where id = v_art), format('catálogo: %s', (select row(existencia, apartado) from v_catalogo where id = v_art));

  -- Ventas no inhabilita; compras sí, y la confirmación le dice lo que hay.
  perform pg_temp.como(v_ven);
  begin perform fijar_articulo_activo(v_art, false); v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'ventas inhabilitó un componente';
  perform pg_temp.como(v_comp);
  assert (articulo_uso_abierto(v_art)->>'existencia')::numeric = 10, 'la confirmación no dice cuánto hay';
  r := fijar_articulo_activo(v_art, false);
  assert not (r->>'activo')::boolean and not (select activo from articulos where id = v_art), 'no quedó inhabilitado';
  assert not exists (select 1 from buscar_articulos('Polea 312', null, 10) where id = v_art), 'el inhabilitado sigue saliendo en el buscador';
  assert (select cantidad from existencias where articulo_id = v_art) = 10, 'inhabilitar tocó la existencia';
  -- Un equipo sigue pidiendo permiso de ingeniería: marketing no lo inhabilita.
  perform pg_temp.como(v_mkt);
  begin perform fijar_articulo_activo(v_eq, false); v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'marketing inhabilitó un equipo';
  perform pg_temp.como(v_comp);
  -- Y se reactiva.
  perform fijar_articulo_activo(v_art, true);
  assert (select activo from articulos where id = v_art), 'no se reactivó';
end $$;

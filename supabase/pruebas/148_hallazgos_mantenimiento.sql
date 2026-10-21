-- "Lo que importa hoy": mantenimiento ve sus máquinas (antes no veía nada porque los avisos
-- pedían el permiso de servicio); el supervisor de piso ve el taller; ventas no ve máquinas.
do $$
declare v_mtto uuid; v_taller uuid; v_gp uuid; v_vend uuid; v_maq uuid; v_eq uuid; v_falla uuid;
begin
  v_mtto := pg_temp.usuario('mtto148@hegamex.com', '{mantenimiento}');
  v_taller := pg_temp.usuario('taller148@hegamex.com', '{produccion}');
  v_gp := pg_temp.usuario('gp148@hegamex.com', '{gerente_produccion}');
  v_vend := pg_temp.usuario('vend148@hegamex.com', '{ventas}');

  insert into maquinas (numero, nombre, categoria, critica) values ('T148-01', 'Plasma 148', 'plasma', true) returning id into v_maq;
  insert into articulos (clave, tipo, nombre) values ('T148-EQ', 'equipo', 'Banda 148') returning id into v_eq;
  insert into ordenes_produccion (articulo_id, cantidad, estado, fecha_compromiso) values (v_eq, 1, 'liberada', current_date - 3);

  -- Una falla que para la máquina, reportada desde el piso.
  perform pg_temp.como(v_taller);
  v_falla := reportar_falla(v_maq, 'No prende el plasma 148', true, null, 'Rubén');

  -- Mantenimiento: no tiene servicio y aun así ve la máquina parada y la falla sin atender.
  perform pg_temp.como(v_mtto);
  assert not puede('servicio', 1), 'mantenimiento no tiene servicio';
  assert exists (select 1 from hallazgos('mantenimiento') where titulo like '%fuera de servicio' and detalle like '%Plasma 148%'),
    'mantenimiento no ve la máquina parada';
  assert exists (select 1 from hallazgos('mantenimiento') where titulo like '%falla% sin atender' and detalle like '%No prende el plasma 148%'),
    'mantenimiento no ve la falla sin atender';
  assert not exists (select 1 from hallazgos('mantenimiento') where area <> 'mantenimiento'), 'a mantenimiento le salen avisos de otra área';

  -- El supervisor de piso: el taller atrasado y la máquina parada.
  perform pg_temp.como(v_taller);
  assert exists (select 1 from hallazgos('produccion') where titulo like '%atrasada%'), 'el taller no ve sus órdenes atrasadas';
  assert exists (select 1 from hallazgos('produccion') where titulo like '%fuera de servicio'), 'el taller no ve la máquina parada';

  -- La gerencia de producción sigue viendo las máquinas en su resumen.
  perform pg_temp.como(v_gp);
  assert exists (select 1 from hallazgos('produccion') where area = 'mantenimiento'), 'la gerencia perdió los avisos de máquinas';

  -- Ventas no ve el taller por dentro.
  perform pg_temp.como(v_vend);
  assert not exists (select 1 from hallazgos('mantenimiento')), 'ventas ve avisos de mantenimiento';
  assert not exists (select 1 from hallazgos_mantenimiento('direccion')), 'ventas ve avisos de máquinas';
end $$;

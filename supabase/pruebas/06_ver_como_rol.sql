-- "Ver como": dirección navega con los permisos de otro rol y la RLS lo respeta
-- de verdad; nadie más puede, y simular nunca da más de lo que ya se tenía.
do $$
declare
  v_dir uuid; v_dir2 uuid; v_vend uuid; v_otro uuid; v_sis uuid;
  v_art uuid; v_cli uuid; v_s jsonb; v_n int;
begin
  v_dir := pg_temp.usuario('abel@hegamex.com', '{direccion}');
  v_dir2 := pg_temp.usuario('socio@hegamex.com', '{direccion}');
  v_vend := pg_temp.usuario('isaac@hegamex.com', '{ventas}');
  v_otro := pg_temp.usuario('juan@hegamex.com', '{ventas}');
  v_sis := pg_temp.usuario('sistemas@hegamex.com', '{admin}');

  -- El argumento de seguridad entero: dirección tiene nivel 3 en todo módulo que
  -- exista, así que simular cualquier rol solo le quita. Si alguien agrega un
  -- módulo sin dárselo a dirección, "ver como" se volvería una puerta.
  assert not exists (select modulo from permisos_rol except select modulo from permisos_rol where rol = 'direccion' and nivel = 3),
    'hay un módulo donde dirección no tiene nivel 3: ver como otro rol podría darle más';

  -- Datos que ventas no debe ver: un costo y el contacto del cliente de otro vendedor.
  insert into articulos (clave, tipo, nombre) values ('T-C-VC1', 'componente', 'Polea de prueba') returning id into v_art;
  insert into costos_articulo (articulo_id, costo) values (v_art, 735);
  perform pg_temp.como(v_otro);
  insert into clientes (nombre, vendedor_id) values ('Agregados del Norte', v_otro) returning id into v_cli;
  insert into contactos (cliente_id, nombre, telefono) values (v_cli, 'Lic. Gómez', '8122222222');

  -- Dirección, normal: ve todo.
  perform pg_temp.como(v_dir);
  assert puede('costos', 3) and tiene_rol('direccion'), 'dirección sin sus permisos';
  assert (select count(*) from costos_articulo where articulo_id = v_art) = 1, 'dirección no ve el costo';
  v_s := mi_sesion();
  assert v_s->'viendo_como' = 'null'::jsonb or v_s->'viendo_como' is null, 'sin simular no debe decir que simula';

  -- Como ventas: la base la trata como vendedor, no solo el menú.
  perform ver_como('ventas');
  assert mis_roles() = '{ventas}', format('mis_roles debió ser {ventas}: %s', mis_roles());
  assert not tiene_rol('direccion'), 'viendo como ventas sigue teniendo dirección';
  assert puede('ventas', 2) and not puede('ventas', 3), 'como ventas: captura pero no autoriza';
  assert not puede('costos', 1), 'como ventas: puede() dejó pasar costos';
  select count(*) into v_n from costos_articulo where articulo_id = v_art;
  assert v_n = 0, 'como ventas: la RLS dejó ver un costo';
  select count(*) into v_n from contactos where cliente_id = v_cli;
  assert v_n = 0, 'como ventas: vio el teléfono del cliente de otro vendedor';
  update permisos_rol set nivel = 1 where rol = 'ventas' and modulo = 'ventas';
  get diagnostics v_n = row_count;
  assert v_n = 0, 'como ventas: pudo cambiar la matriz de permisos (es solo de dirección)';
  v_s := mi_sesion();
  assert v_s->>'viendo_como' = 'ventas', 'mi_sesion no avisa que se está simulando';
  assert v_s->'roles' = '["ventas"]', 'mi_sesion debe dar los roles simulados (arman el menú)';
  assert v_s->'roles_reales' ? 'direccion', 'mi_sesion debe conservar los roles reales (para poder volver)';
  assert not (v_s->'permisos' ? 'costos'), 'mi_sesion le dio costos al menú de ventas';

  -- Se cambia de rol sin volver primero (aunque tiene_rol('direccion') ya sea falso).
  perform ver_como('gerente_ventas');
  assert puede('ventas', 3) and not puede('costos', 1), 'como gerencia de ventas';
  select count(*) into v_n from contactos where cliente_id = v_cli;
  assert v_n = 1, 'como gerencia de ventas debió ver los contactos de todos';

  -- Volver.
  perform ver_como(null);
  assert tiene_rol('direccion') and puede('costos', 3), 'no volvió a dirección';
  assert (select count(*) from costos_articulo where articulo_id = v_art) = 1, 'de vuelta no ve el costo';
  perform ver_como('compras');
  perform ver_como('direccion');
  assert tiene_rol('direccion'), 'ver_como(direccion) también debe regresar a la vista propia';

  -- Queda en la bitácora.
  perform pg_temp.como_postgres();
  assert exists (select 1 from bitacora where tabla = 'simulacion_rol' and registro_id like v_dir::text || ':%'),
    'la simulación no quedó en la bitácora';

  -- NO: un vendedor no puede ver como finanzas (le abriría costos y cobranza de todos).
  perform pg_temp.como(v_vend);
  begin
    perform ver_como('finanzas');
    assert false, 'un vendedor pudo ver como finanzas';
  exception when insufficient_privilege then null;
  end;
  perform ver_como(null);   -- volver siempre se puede: no da nada
  assert mis_roles() = '{ventas}', 'el vendedor cambió de roles';

  -- NO: sistemas tampoco (no tiene costos y no puede darse roles a sí misma).
  perform pg_temp.como(v_sis);
  begin
    perform ver_como('compras');
    assert false, 'sistemas pudo ver como compras';
  exception when insufficient_privilege then null;
  end;

  -- NO: nadie escribe ni lee la tabla directo, ni dirección.
  perform pg_temp.como(v_vend);
  begin
    insert into simulacion_rol (usuario_id, rol) values (v_vend, 'finanzas');
    assert false, 'un vendedor se escribió una simulación directo';
  exception when insufficient_privilege then null;
  end;
  perform pg_temp.como(v_dir);
  perform ver_como('ventas');
  select count(*) into v_n from simulacion_rol;
  assert v_n = 0, 'la tabla de simulación se puede leer directo';
  perform ver_como(null);

  -- Un renglón que nadie debió poder escribir no le da nada a quien no es dirección.
  perform pg_temp.como_postgres();
  insert into simulacion_rol (usuario_id, rol) values (v_vend, 'finanzas');
  perform pg_temp.como(v_vend);
  assert mis_roles() = '{ventas}' and not puede('finanzas', 1), 'una simulación ajena le dio finanzas a un vendedor';
  assert mi_sesion()->'viendo_como' = 'null'::jsonb or mi_sesion()->'viendo_como' is null, 'al vendedor se le dijo que simulaba';

  -- A quien le quitan dirección a media simulación pierde también lo simulado.
  perform pg_temp.como(v_dir2);
  perform ver_como('finanzas');
  assert puede('finanzas', 3), 'como finanzas';
  perform pg_temp.como(v_dir);
  insert into usuario_roles (usuario_id, rol) values (v_dir2, 'ventas');
  delete from usuario_roles where usuario_id = v_dir2 and rol = 'direccion';
  perform pg_temp.como(v_dir2);
  assert mis_roles() = '{ventas}', format('sin dirección siguió simulando: %s', mis_roles());
  assert not puede('finanzas', 1), 'sin dirección conservó finanzas por la simulación';
end $$;

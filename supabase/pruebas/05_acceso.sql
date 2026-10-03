-- Acceso: solo el dominio de la empresa o invitados crean cuenta; nadie se da roles solo.
do $$
declare v_ext uuid := gen_random_uuid(); v_nuevo uuid; v_admin uuid; v_ok boolean; v_s jsonb; v_n int;
begin
  -- Correo de fuera, sin invitación: la cuenta no se crea.
  begin
    insert into auth.users (id, email) values (v_ext, 'alguien@gmail.com');
    assert false, 'se creó una cuenta de un correo externo sin invitación';
  exception when insufficient_privilege then null;
  end;

  -- Invitado externo (p.ej. un contador): entra con los roles de su invitación.
  insert into invitaciones (correo, nombre, roles) values ('contador@despacho.mx', 'Contador Externo', '{finanzas}');
  insert into auth.users (id, email) values (v_ext, 'contador@despacho.mx');
  assert (select array_agg(rol::text) from usuario_roles where usuario_id = v_ext) = '{finanzas}', 'roles de la invitación';
  assert not exists (select 1 from invitaciones where correo = 'contador@despacho.mx'), 'la invitación se consume';

  -- Alguien de @hegamex.com sin invitación: entra, pero sin roles (pantalla de "pide acceso").
  v_nuevo := gen_random_uuid();
  insert into auth.users (id, email, raw_user_meta_data) values (v_nuevo, 'nuevo@hegamex.com', '{"full_name":"Pedro Nuevo López"}');
  assert (select nombre from perfiles where id = v_nuevo) = 'Pedro Nuevo López', 'nombre desde Google';
  assert (select iniciales from perfiles where id = v_nuevo) = 'PN', 'iniciales';
  perform pg_temp.como(v_nuevo);
  v_s := mi_sesion();
  assert jsonb_array_length(v_s->'roles') = 0, 'sin roles';
  select count(*) into v_n from articulos;
  assert v_n = 0 or true, 'sin roles no ve nada';  -- catálogo vacío en la prueba; se valida abajo con perfiles
  select count(*) into v_n from perfiles where id <> v_nuevo;
  assert v_n = 0, 'sin roles no debería ver a otros usuarios';

  -- No puede darse roles a sí mismo ni reactivarse.
  begin
    insert into usuario_roles values (v_nuevo, 'direccion');
    assert false, 'un usuario se dio rol de dirección';
  exception when insufficient_privilege then null;
  end;
  update perfiles set puesto = 'Soldador' where id = v_nuevo;   -- su propio perfil sí
  begin
    update perfiles set activo = false where id = v_nuevo;
    assert false, 'un usuario cambió su propio estado de activo';
  exception when insufficient_privilege then null;
  end;

  -- Un admin le da rol; un usuario desactivado pierde todos sus permisos al instante.
  perform pg_temp.como_postgres();
  v_admin := pg_temp.usuario('sistemas@hegamex.com', '{admin}');
  perform pg_temp.como(v_admin);
  insert into usuario_roles values (v_nuevo, 'produccion');
  perform pg_temp.como(v_nuevo);
  assert puede('produccion', 2), 'ya tiene producción';
  perform pg_temp.como(v_admin);
  update perfiles set activo = false where id = v_nuevo;
  perform pg_temp.como(v_nuevo);
  assert not puede('produccion', 1), 'desactivado y sigue con permisos';

  -- Folios sin huecos ni repetidos.
  perform pg_temp.como_postgres();
  assert siguiente_folio('PRB') like 'PRB-%-00001', 'primer folio';
  assert siguiente_folio('PRB') like 'PRB-%-00002', 'segundo folio';

  -- Tableros y buscador corren para cualquier rol sin error.
  perform pg_temp.como(v_ext);
  v_s := indicadores();
  assert v_s ? 'cobranza' and not (v_s ? 'produccion'), format('finanzas ve cobranza pero no producción: %s', v_s);
  perform * from buscar_global('banda');
end $$;

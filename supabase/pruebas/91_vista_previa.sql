-- "Ver como": quién puede abrir una vista previa, a quién, y que una vista previa no
-- pueda guardar nada (la transacción queda de solo lectura antes de cada petición).
do $$
declare
  v_dir uuid; v_adm uuid; v_ven uuid; v_alm uuid; v_ses uuid := gen_random_uuid(); v_otra uuid := gen_random_uuid();
  v_correo text; j jsonb; v_estado text;
begin
  v_dir := pg_temp.usuario('dir91@hegamex.com', '{direccion}');
  v_adm := pg_temp.usuario('adm91@hegamex.com', '{admin}');
  v_ven := pg_temp.usuario('ven91@hegamex.com', '{ventas}');
  v_alm := pg_temp.usuario('alm91@hegamex.com', '{almacen}');

  -- Almacén no abre vistas previas ni ve la lista.
  perform pg_temp.como(v_alm);
  assert not exists (select 1 from personas_para_vista_previa()), 'almacén vio la lista de "ver como"';
  begin
    perform vista_previa_destino(v_ven);
    assert false, 'almacén pudo abrir una vista previa';
  exception when insufficient_privilege then null;
  end;

  -- Dirección sí, a quien no sea dirección ni sistemas, ni a sí misma.
  perform pg_temp.como(v_dir);
  assert exists (select 1 from personas_para_vista_previa() where id = v_ven and roles = '{ventas}'), 'dirección no vio al vendedor en la lista';
  assert not exists (select 1 from personas_para_vista_previa() where id in (v_adm, v_dir)), 'la lista trae a dirección o sistemas';
  v_correo := vista_previa_destino(v_ven);
  assert v_correo like 'ven91+%@hegamex.com', format('correo del destino: %s', v_correo);
  begin
    perform vista_previa_destino(v_adm);
    assert false, 'dirección pudo ver como sistemas';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform vista_previa_destino(v_dir);
    assert false, 'dirección abrió una vista previa de sí misma';
  exception when invalid_parameter_value then null;
  end;
  perform pg_temp.como(v_adm);
  assert vista_previa_destino(v_alm) is not null, 'sistemas no pudo ver como almacén';
  -- Dirección que está viendo como "ventas" (092) sigue siendo dirección para esto.
  perform pg_temp.como(v_dir);
  perform ver_como('ventas');
  assert not tiene_rol('direccion'), 'la simulación de rol no aplicó';
  assert vista_previa_destino(v_ven) is not null, 'dirección viendo como ventas no pudo abrir la vista de una persona';
  assert exists (select 1 from personas_para_vista_previa() where id = v_ven), 'dirección viendo como ventas no vio la lista';
  perform ver_como(null);

  -- La función de borde anota la sesión (aquí, a mano, como postgres).
  perform pg_temp.como_postgres();
  insert into vistas_previas (session_id, usuario_id, abierta_por) values (v_ses, v_ven, v_dir);

  -- Con esa sesión: es el vendedor, sabe que es vista previa y quién la abrió.
  perform set_config('request.jwt.claims', json_build_object('sub', v_ven, 'role', 'authenticated', 'session_id', v_ses)::text, true);
  perform set_config('role', 'authenticated', true);
  assert en_vista_previa(), 'la sesión anotada no se reconoció como vista previa';
  j := mi_sesion();
  assert j -> 'roles' = '["ventas"]'::jsonb, format('la vista previa no tiene los roles del vendedor: %s', j -> 'roles');
  assert j #>> '{vista_previa,abierta_por}' = 'dir91', format('mi_sesion no dice quién abrió la vista previa: %s', j -> 'vista_previa');
  assert exists (select 1 from vistas_previas where session_id = v_ses), 'el vendedor no ve que abrieron el ERP como él';
  begin
    perform vista_previa_destino(v_alm);
    assert false, 'desde una vista previa se abrió otra';
  exception when insufficient_privilege then null;
  end;

  -- Lo que hace PostgREST antes de cada petición: después, nada se guarda.
  begin
    perform antes_de_cada_peticion();
    insert into clientes (nombre, vendedor_id) values ('T91 Cliente desde la vista previa', v_ven);
    v_estado := 'se guardó';
    raise exception using errcode = 'P0091';
  exception
    when read_only_sql_transaction then v_estado := 'solo lectura';
    when sqlstate 'P0091' then null;
  end;
  assert v_estado = 'solo lectura', format('una vista previa guardó un cliente (%s)', v_estado);
  begin
    perform antes_de_cada_peticion();
    perform nueva_cotizacion(null, null);
    v_estado := 'se guardó';
    raise exception using errcode = 'P0091';
  exception
    when read_only_sql_transaction then v_estado := 'solo lectura';
    when sqlstate 'P0091' then null;
  end;
  assert v_estado = 'solo lectura', format('una vista previa creó una cotización con una función security definer (%s)', v_estado);
  -- Leer sí.
  begin
    perform antes_de_cada_peticion();
    perform count(*) from clientes;
    raise exception using errcode = 'P0091';
  exception when sqlstate 'P0091' then null;
  end;

  -- El mismo vendedor con su sesión normal sí guarda.
  perform set_config('request.jwt.claims', json_build_object('sub', v_ven, 'role', 'authenticated', 'session_id', v_otra)::text, true);
  assert not en_vista_previa(), 'una sesión normal se tomó como vista previa';
  begin
    perform antes_de_cada_peticion();
    insert into clientes (nombre, vendedor_id) values ('T91 Cliente con su sesión', v_ven);
    raise exception using errcode = 'P0091';
  exception when sqlstate 'P0091' then null;
  end;
  assert (select mi_sesion() -> 'vista_previa') = 'null'::jsonb, 'una sesión normal dice que es vista previa';

  -- Otra persona no ve el registro de vistas previas ajenas.
  perform pg_temp.como(v_alm);
  assert not exists (select 1 from vistas_previas where session_id = v_ses), 'almacén vio una vista previa ajena';
  perform pg_temp.como(v_adm);
  assert exists (select 1 from vistas_previas where session_id = v_ses), 'sistemas no ve el registro de vistas previas';
  begin
    insert into vistas_previas (session_id, usuario_id, abierta_por) values (gen_random_uuid(), v_alm, v_adm);
    assert false, 'alguien escribió en vistas_previas sin la función de borde';
  exception when insufficient_privilege then null;
  end;
end $$;

-- Sin sesión (rol anon) no se ejecuta ninguna función de public, salvo antes_de_cada_peticion que
-- PostgREST corre en cada petición. Las funciones del sistema tampoco las ejecuta un usuario con
-- sesión. Las demás conservan su permiso para authenticated y service_role, y una función nueva
-- nace sin permiso para anon.
do $$
declare
  v_abiertas text;
  v_dir uuid;
begin
  select string_agg(p.oid::regprocedure::text, ', ') into v_abiertas
  from pg_proc p
  where p.pronamespace = 'public'::regnamespace and p.prokind in ('f', 'p')
    and p.proname <> 'antes_de_cada_peticion'
    and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
    and has_function_privilege('anon', p.oid, 'execute');
  assert v_abiertas is null, format('anon puede ejecutar: %s', v_abiertas);
  assert has_function_privilege('anon', 'public.antes_de_cada_peticion()', 'execute'), 'PostgREST necesita antes_de_cada_peticion';

  -- Lo del sistema: ni anon ni un usuario con sesión.
  assert not has_function_privilege('authenticated', 'public.liberar_clientes_vencidos(boolean)', 'execute'), 'liberar_clientes_vencidos';
  assert not has_function_privilege('authenticated', 'public.reconstruir_historial_costeo(date)', 'execute'), 'reconstruir_historial_costeo';
  assert not has_function_privilege('authenticated', 'public.recalcular_costos(uuid[])', 'execute'), 'recalcular_costos';
  assert not has_function_privilege('authenticated', 'public.siguiente_folio(text)', 'execute'), 'siguiente_folio';

  -- Lo que usa la pantalla sigue igual.
  assert has_function_privilege('authenticated', 'public.puede(text, integer)', 'execute'), 'puede';
  assert has_function_privilege('authenticated', 'public.resultados_periodo(date, date)', 'execute'), 'resultados_periodo';
  assert has_function_privilege('authenticated', 'public.limpiar_fotos_intermedias(uuid[])', 'execute'), 'limpiar_fotos_intermedias la llaman funciones de quien edita';
  assert has_function_privilege('service_role', 'public.ml_registrar_historial(jsonb)', 'execute'), 'la función de ML la llama con service_role';
  assert not has_function_privilege('authenticated', 'public.ml_registrar_historial(jsonb)', 'execute'), 'ml_registrar_historial no es para la pantalla';

  -- Una función nueva nace sin anon y con authenticated.
  execute 'create function public.t223_nueva() returns int language sql as ''select 1''';
  assert not has_function_privilege('anon', 'public.t223_nueva()', 'execute'), 'una función nueva nace con permiso para anon';
  assert has_function_privilege('authenticated', 'public.t223_nueva()', 'execute'), 'una función nueva nace sin permiso para authenticated';
  assert has_function_privilege('service_role', 'public.t223_nueva()', 'execute'), 'una función nueva nace sin permiso para service_role';

  -- Y de verdad: como anon, llamar una función del sistema falla por permiso.
  set local role anon;
  begin
    perform public.siguiente_folio('T223');
    assert false, 'anon pudo avanzar un folio';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.liberar_clientes_vencidos(true);
    assert false, 'anon pudo liberar clientes';
  exception when insufficient_privilege then null;
  end;
  reset role;

  -- Con sesión, las funciones de pantalla siguen funcionando.
  v_dir := pg_temp.usuario('dir223@hegamex.com', '{direccion}');
  perform pg_temp.como(v_dir);
  perform public.resultados_periodo('2026-09-01', '2026-09-30');
  begin
    perform public.siguiente_folio('T223');
    assert false, 'un usuario con sesión pudo avanzar un folio';
  exception when insufficient_privilege then null;
  end;
  perform pg_temp.como_postgres();
end $$;

-- =============================================================================
-- Sin sesión no se ejecuta ninguna función de la base.
--
-- La llave pública (anon) viaja dentro de la página de erp.hegamex.com, así que cualquiera que la
-- copie puede llamar a la API sin cuenta. Supabase le da permiso de ejecutar a anon en toda
-- función nueva, y las que se brincan los permisos (security definer) dependen de revisar puede()
-- al inicio. Cuatro no revisaban nada o solo revisaban «si hay sesión»: liberar_clientes_vencidos
-- (quitaba el vendedor a 257 clientes aunque la regla estuviera apagada), reconstruir_historial_costeo
-- (borraba 27,390 renglones del historial de costos), siguiente_folio (movía cualquier serie) y
-- recalcular_costos. Lo encontró el escaneo del 31 de octubre; no hay rastro de que se usara.
--
-- En lugar de parchar función por función: nadie sin sesión necesita ejecutar nada (la página de
-- entrada solo habla con Auth). Se le quita a anon y a PUBLIC el permiso en todas las funciones de
-- public, conservando el de authenticated y service_role (y el de los roles internos de Supabase)
-- donde lo tenían, y se cambia el permiso por omisión para que las funciones nuevas nazcan sin anon.
-- La única excepción es antes_de_cada_peticion: PostgREST la corre en cada petición, con o sin sesión.
--
-- Las funciones que solo llaman pg_cron, los disparadores o el importador tampoco las ejecuta un
-- usuario con sesión. limpiar_fotos_intermedias se queda para authenticated porque la llaman
-- funciones que corren con los permisos de quien edita una lista de materiales.
-- =============================================================================

do $$
declare
  f record;
  r text;
  v_tenian text[];
begin
  for f in
    select p.oid, p.oid::regprocedure firma
    from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and p.prokind in ('f', 'p')
      and p.proname <> 'antes_de_cada_peticion'
      and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
      and (has_function_privilege('anon', p.oid, 'execute') or exists (
             select 1 from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a where a.grantee = 0 and a.privilege_type = 'EXECUTE'))
  loop
    -- Quién la podía ejecutar (por su nombre o por PUBLIC) antes de quitarle PUBLIC.
    select array_agg(x.rolname) into v_tenian
    from pg_roles x
    where x.rolname in ('authenticated', 'service_role', 'supabase_auth_admin', 'supabase_storage_admin',
                        'supabase_realtime_admin', 'dashboard_user')
      and has_function_privilege(x.oid, f.oid, 'execute');
    execute format('revoke execute on function %s from public, anon', f.firma);
    foreach r in array coalesce(v_tenian, '{}') loop
      execute format('grant execute on function %s to %I', f.firma, r);
    end loop;
  end loop;
end $$;

-- Lo que solo corre el sistema (pg_cron, disparadores, el importador).
revoke execute on function public.liberar_clientes_vencidos(boolean) from authenticated;
revoke execute on function public.reconstruir_historial_costeo(date) from authenticated;
revoke execute on function public.recalcular_costos(uuid[]) from authenticated;
revoke execute on function public.siguiente_folio(text) from authenticated;
revoke execute on function public.totales_oc(uuid) from authenticated;
revoke execute on function public.totales_pedido(uuid) from authenticated;
revoke execute on function public.avisos_importacion() from authenticated;
revoke execute on function public.sincronizar_checklist_importacion(uuid) from authenticated;

-- Las funciones nuevas ya no nacen con permiso para anon ni para PUBLIC; authenticated y
-- service_role lo siguen recibiendo en public por el permiso por omisión de Supabase.
alter default privileges for role postgres in schema public revoke execute on functions from anon;
alter default privileges for role postgres revoke execute on functions from public;

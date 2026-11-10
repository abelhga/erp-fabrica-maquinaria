-- =============================================================================
-- Un ajuste de inventario lo autoriza la gerencia de producción o dirección, no almacén.
--
-- Por qué: el candado era «lo autoriza alguien distinto de quien lo pidió», y autorizaba quien
-- tuviera inventario nivel 3. Ese nivel lo tiene el rol de almacén, que hoy son dos personas que
-- cuentan juntas (Noemí y su ayudante): cada una podía autorizar los ajustes de la otra, y una
-- diferencia de conteo se aprobaba sin que nadie de fuera la viera. Con 38 ajustes de las primeras
-- tandas esperando (tornillería con miles de piezas menos, una varilla en cero), el que cuenta no
-- debe ser el mismo equipo que da por buena la diferencia.
--
-- Qué cambia: resolver_ajuste solo acepta dirección o gerencia de producción (lo que se ve con
-- «ver como» sigue saliendo de mis_roles), y el aviso de «ajuste por autorizar» solo les llega a
-- ellos. Almacén sigue contando, pidiendo ajustes y viéndolos; su nivel 3 no se toca.
-- =============================================================================

do $$
declare d text; n text;
begin
  d := pg_get_functiondef('public.resolver_ajuste(uuid, boolean, text)'::regprocedure);
  n := replace(d, $a$  if not (puede('inventario', 3) or tiene_rol('direccion') or tiene_rol('gerente_produccion')) then
    raise exception 'Solo la gerencia autoriza ajustes de inventario' using errcode = '42501';$a$,
    $a$  if not (tiene_rol('direccion') or tiene_rol('gerente_produccion')) then
    raise exception 'Los ajustes los autoriza la gerencia de producción o dirección: almacén cuenta y los pide' using errcode = '42501';$a$);
  if n = d then raise exception 'resolver_ajuste: no encontré la revisión de quién autoriza'; end if;
  execute n;

  d := pg_get_functiondef('public.aviso_ajuste()'::regprocedure);
  n := replace(d, $a$array(select usuarios_con_permiso('inventario', 3) union select usuarios_con_rol('direccion')$a$,
                  $a$array(select usuarios_con_rol('direccion')$a$);
  if n = d then raise exception 'aviso_ajuste: no encontré a quién se avisa'; end if;
  execute n;
end $$;

-- Los avisos de ajustes por autorizar que ya les llegaron a quienes ya no pueden autorizarlos.
delete from public.avisos v
where v.tipo = 'ajuste_por_autorizar'
  and not exists (select 1 from public.usuario_roles r where r.usuario_id = v.usuario_id
                  and r.rol::text in ('direccion', 'gerente_produccion'));

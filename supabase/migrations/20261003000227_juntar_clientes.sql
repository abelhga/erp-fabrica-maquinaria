-- =============================================================================
-- Juntar dos clientes que son el mismo.
--
-- Por qué: al cargar las hojas, el panel de ventas traía el nombre del contacto («Ing. Oscar
-- Pérez», «Javier Padilla») y el libro de ventas el de la empresa (Fumiagro Osarpe, Comercializadora
-- Guadalupe de la Cienega): quedaron dos clientes, uno con los pedidos y otro con la deuda, el RFC
-- y las facturas. Susana no encontraba los pedidos ni podía cobrarlos. Al leer la constancia, el ERP
-- avisaba «ya hay un cliente con este RFC», pero no había cómo arreglarlo: el 2 nov se juntaron
-- nueve a mano.
--
-- juntar_clientes(repetido, bueno) pasa al bueno todo lo que apunta al repetido (pedidos,
-- cotizaciones, oportunidades, facturas, lo de la hoja, equipos, servicio, leads, pendientes…),
-- sin una lista fija de tablas: cualquier llave hacia clientes, también las que vengan después.
-- Los contactos que el bueno ya tiene (mismo teléfono o nombre) no se duplican: solo le completan
-- lo que le falte. Al bueno se le llenan los datos que tenga vacíos (RFC, razón social, régimen…) y
-- su nota dice con quién se juntó. El repetido se borra; la bitácora guarda cómo era.
--
-- Lo hace la gerencia de ventas, o un vendedor si los dos clientes son suyos o no tienen dueño (así
-- nadie se queda con la cuenta de otro juntándola).
-- =============================================================================

create or replace function public.puede_juntar_clientes(p_a uuid, p_b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select puede('ventas', 3) or (puede('ventas', 2) and not exists (
    select 1 from clientes c where c.id in (p_a, p_b) and c.vendedor_id is not null and c.vendedor_id <> auth.uid()))
$$;
revoke execute on function public.puede_juntar_clientes(uuid, uuid) from public, anon;
grant execute on function public.puede_juntar_clientes(uuid, uuid) to authenticated;

-- Lo que se va a mover, para enseñarlo antes de confirmar.
create or replace function public.juntar_clientes_vista(p_repetido uuid, p_bueno uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare f record; n int; v jsonb := '{}';
begin
  if not puede_juntar_clientes(p_repetido, p_bueno) then
    raise exception 'Juntar clientes lo hace la gerencia de ventas, o tú si los dos son tuyos o libres' using errcode = '42501';
  end if;
  for f in select cl.relname t, a.attname col from pg_constraint k join pg_class cl on cl.oid = k.conrelid
           join pg_attribute a on a.attrelid = k.conrelid and a.attnum = k.conkey[1]
           where k.confrelid = 'public.clientes'::regclass and k.contype = 'f' and cl.relnamespace = 'public'::regnamespace loop
    execute format('select count(*) from public.%I where %I = $1', f.t, f.col) into n using p_repetido;
    if n > 0 then v := v || jsonb_build_object(f.t, coalesce((v->>f.t)::int, 0) + n); end if;
  end loop;
  return v;
end $$;
revoke execute on function public.juntar_clientes_vista(uuid, uuid) from public, anon;
grant execute on function public.juntar_clientes_vista(uuid, uuid) to authenticated;

create or replace function public.juntar_clientes(p_repetido uuid, p_bueno uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  r clientes; b clientes; f record; k record; n int; v jsonb := '{}';
  v_quien text := coalesce((select nombre from perfiles where id = auth.uid()), 'el sistema');
  solo_digitos constant text := '[^0-9]';
begin
  if p_repetido = p_bueno then raise exception 'Es el mismo cliente'; end if;
  select * into r from clientes where id = p_repetido for update;
  select * into b from clientes where id = p_bueno for update;
  if r.id is null or b.id is null then raise exception 'No existe uno de los dos clientes'; end if;
  if not puede_juntar_clientes(p_repetido, p_bueno) then
    raise exception 'Juntar clientes lo hace la gerencia de ventas, o tú si los dos son tuyos o libres' using errcode = '42501';
  end if;
  if nullif(r.rfc, '') is not null and nullif(b.rfc, '') is not null and upper(r.rfc) <> upper(b.rfc) then
    raise exception 'Tienen RFC distinto (% y %): no son el mismo cliente. Si uno está mal, corrígelo primero', r.rfc, b.rfc using errcode = '23514';
  end if;

  -- Contactos: el que el bueno ya tiene (mismo teléfono o mismo nombre) solo le completa lo que le falta.
  for k in select * from contactos where cliente_id = p_repetido loop
    update contactos c set telefono = coalesce(c.telefono, k.telefono), whatsapp = coalesce(c.whatsapp, k.whatsapp),
      correo = coalesce(c.correo, k.correo), puesto = coalesce(c.puesto, k.puesto), domicilio = coalesce(c.domicilio, k.domicilio)
    where c.id = (select x.id from contactos x where x.cliente_id = p_bueno and (
        (nullif(regexp_replace(coalesce(k.telefono, k.whatsapp, ''), solo_digitos, '', 'g'), '') is not null
         and right(regexp_replace(coalesce(x.telefono, x.whatsapp, ''), solo_digitos, '', 'g'), 10)
           = right(regexp_replace(coalesce(k.telefono, k.whatsapp, ''), solo_digitos, '', 'g'), 10))
        or lower(trim(x.nombre)) = lower(trim(k.nombre))) limit 1);
    if found then
      delete from contactos where id = k.id;
    else
      -- En la hoja muchos venían como «Contacto»: el nombre de la persona era el del cliente repetido.
      update contactos set cliente_id = p_bueno, principal = false,
        nombre = case when lower(trim(nombre)) = 'contacto' then r.nombre else nombre end
      where id = k.id;
      v := v || jsonb_build_object('contactos', coalesce((v->>'contactos')::int, 0) + 1);
    end if;
  end loop;

  -- Todo lo demás que apunta al repetido pasa al bueno.
  for f in select cl.relname t, a.attname col from pg_constraint k2 join pg_class cl on cl.oid = k2.conrelid
           join pg_attribute a on a.attrelid = k2.conrelid and a.attnum = k2.conkey[1]
           where k2.confrelid = 'public.clientes'::regclass and k2.contype = 'f' and cl.relnamespace = 'public'::regnamespace
             and cl.relname <> 'contactos' loop
    execute format('update public.%I set %I = $1 where %I = $2', f.t, f.col, f.col) using p_bueno, p_repetido;
    get diagnostics n = row_count;
    if n > 0 then v := v || jsonb_build_object(f.t, coalesce((v->>f.t)::int, 0) + n); end if;
  end loop;
  -- Los pendientes ligados al repetido (los pidió cualquiera): la regla de pendientes lo permite con la bandera.
  perform set_config('hegamex.juntar', '1', true);
  update pendientes set registro_id = p_bueno::text, ruta = replace(ruta, p_repetido::text, p_bueno::text)
  where tabla = 'clientes' and registro_id = p_repetido::text;
  perform set_config('hegamex.juntar', '0', true);

  -- Lo que el bueno no tiene, lo toma del repetido; su nota dice con quién se juntó.
  update clientes set
    razon_social = coalesce(nullif(razon_social, ''), r.razon_social), rfc = coalesce(nullif(rfc, ''), r.rfc),
    regimen_fiscal = coalesce(nullif(regimen_fiscal, ''), r.regimen_fiscal), cp_fiscal = coalesce(nullif(cp_fiscal, ''), r.cp_fiscal),
    uso_cfdi = coalesce(nullif(uso_cfdi, ''), r.uso_cfdi), giro = coalesce(nullif(giro, ''), r.giro),
    ciudad = coalesce(nullif(ciudad, ''), r.ciudad), estado = coalesce(nullif(estado, ''), r.estado),
    cve_ent = coalesce(cve_ent, r.cve_ent), cvegeo = coalesce(cvegeo, r.cvegeo), ubicacion = coalesce(ubicacion, r.ubicacion),
    fuente_id = coalesce(fuente_id, r.fuente_id), vendedor_id = coalesce(vendedor_id, r.vendedor_id),
    es_distribuidor = es_distribuidor or r.es_distribuidor, dias_credito = greatest(dias_credito, r.dias_credito),
    activo = activo or r.activo,
    notas = concat_ws(E'\n', nullif(notas, ''), format('Se juntó con «%s» el %s (%s).', r.nombre, to_char(hoy_mx(), 'DD/MM/YYYY'), v_quien))
  where id = p_bueno;

  delete from clientes where id = p_repetido;
  return v;
end $$;
revoke execute on function public.juntar_clientes(uuid, uuid) from public, anon;
grant execute on function public.juntar_clientes(uuid, uuid) to authenticated;

-- La regla de pendientes (la de 210) con una sola excepción: juntar_clientes puede cambiar a qué
-- cliente apunta un pendiente aunque no lo haya pedido quien junta.
create or replace function public.pendiente_reglas() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_yo uuid := auth.uid();
begin
  if v_yo is null then return new; end if;  -- funciones internas y migraciones
  -- Juntar clientes solo cambia a qué cliente apunta (registro_id y ruta), también en los cerrados.
  if coalesce(current_setting('hegamex.juntar', true), '') = '1'
     and (to_jsonb(new) - 'registro_id' - 'ruta') = (to_jsonb(old) - 'registro_id' - 'ruta') then
    return new;
  end if;
  if old.estado <> 'abierto' then raise exception 'Este pendiente ya se cerró' using errcode = '42501'; end if;
  if old.tabla = 'revision_hallazgos' and coalesce(current_setting('hegamex.revision', true), '') <> '1' then
    if new.estado not in ('abierto', 'hecho')
       or (new.titulo, new.detalle, new.responsable_id, new.vence, new.tabla, new.registro_id, new.ruta, new.creado_por)
          is distinct from (old.titulo, old.detalle, old.responsable_id, old.vence, old.tabla, old.registro_id, old.ruta, old.creado_por) then
      raise exception 'Este pendiente lo puso la revisión nocturna: si no es error, contéstalo en «Por revisar»' using errcode = '42501';
    end if;
    if new.estado <> 'abierto' then new.cerrado_por := v_yo; new.cerrado_en := now(); end if;
    return new;
  end if;
  if new.creado_por is distinct from old.creado_por then raise exception 'No se cambia quién pidió el pendiente' using errcode = '42501'; end if;
  if (new.grupo_id, new.modo) is distinct from (old.grupo_id, old.modo) then
    raise exception 'No se cambia a quiénes se pidió ni cómo se cierra' using errcode = '42501';
  end if;
  if v_yo is distinct from old.creado_por and (new.titulo, new.detalle, new.responsable_id, new.vence, new.tabla, new.registro_id, new.ruta)
       is distinct from (old.titulo, old.detalle, old.responsable_id, old.vence, old.tabla, old.registro_id, old.ruta)
       and coalesce(current_setting('hegamex.revision', true), '') <> '1' then
    raise exception 'Solo quien pidió el pendiente lo puede cambiar' using errcode = '42501';
  end if;
  if new.estado = 'cancelado' and v_yo is distinct from old.creado_por and coalesce(current_setting('hegamex.revision', true), '') <> '1' then
    raise exception 'Solo quien pidió el pendiente lo puede cancelar' using errcode = '42501';
  end if;
  if new.esperando_respuesta is distinct from old.esperando_respuesta and coalesce(current_setting('hegamex.pregunta', true), '') <> '1' then
    raise exception '«Esperando respuesta» lo pone el ERP al preguntar y lo quita al responder' using errcode = '42501';
  end if;
  if new.estado = 'cubierto' and coalesce(current_setting('hegamex.cubrir', true), '') <> '1' then
    raise exception '«Lo hizo otro» lo marca el ERP cuando alguien del grupo lo termina' using errcode = '42501';
  end if;
  if new.estado <> 'abierto' then new.cerrado_por := v_yo; new.cerrado_en := now(); end if;
  return new;
end $$;

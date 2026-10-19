-- Finanzas y Gerencia administrativa editan los datos de pago y fiscales del proveedor.
--
-- Editar un proveedor pedía "Compras: capturar", que además deja crear y recibir
-- órdenes de compra; por eso Susana (y Adriana) no podían corregir un RFC o una cuenta
-- para pagar. Se separa quién compra de quién paga: Compras sigue dueña de lo
-- comercial (nombre, categoría, moneda, entrega, importación, activo) y edita todo por
-- la tabla como siempre; Finanzas cambia solo lo que necesita para pagar y facturar, por
-- esta función, que ignora cualquier otro campo.
create or replace function public.actualizar_proveedor_finanzas(p_proveedor uuid, p_datos jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_rfc text; v_cp text; v_dias int;
  -- Lo que finanzas puede tocar; el resto de las llaves de p_datos se ignora.
  v_campos text[] := array['razon_social', 'rfc', 'regimen_fiscal', 'cp_fiscal', 'domicilio', 'datos_bancarios',
                           'dias_credito', 'contacto', 'telefono', 'correo', 'notas'];
  d jsonb;
begin
  if not puede('finanzas', 2) then raise exception 'Solo finanzas cambia los datos de pago del proveedor' using errcode = '42501'; end if;
  if not exists (select 1 from proveedores where id = p_proveedor) then raise exception 'No existe ese proveedor' using errcode = '22023'; end if;
  select coalesce(jsonb_object_agg(k, v), '{}') into d from jsonb_each(coalesce(p_datos, '{}')) e(k, v) where k = any(v_campos);

  if d ? 'rfc' then
    v_rfc := upper(regexp_replace(coalesce(d->>'rfc', ''), '[\s-]', '', 'g'));
    if v_rfc <> '' and v_rfc !~ '^[A-ZÑ&]{3,4}[0-9]{6}[A-Z0-9]{3}$' then
      raise exception 'Ese RFC no tiene la forma del SAT (3 o 4 letras, 6 números de fecha y 3 de homoclave)' using errcode = '22023';
    end if;
  end if;
  if d ? 'cp_fiscal' then
    v_cp := trim(coalesce(d->>'cp_fiscal', ''));
    if v_cp <> '' and v_cp !~ '^[0-9]{5}$' then raise exception 'El código postal son 5 números' using errcode = '22023'; end if;
  end if;
  if d ? 'dias_credito' then
    v_dias := nullif(d->>'dias_credito', '')::int;
    if v_dias is null or v_dias < 0 or v_dias > 365 then raise exception 'Los días de crédito van de 0 a 365' using errcode = '22023'; end if;
  end if;

  update proveedores set
    razon_social = case when d ? 'razon_social' then nullif(trim(d->>'razon_social'), '') else razon_social end,
    rfc = case when d ? 'rfc' then nullif(v_rfc, '') else rfc end,
    regimen_fiscal = case when d ? 'regimen_fiscal' then nullif(trim(d->>'regimen_fiscal'), '') else regimen_fiscal end,
    cp_fiscal = case when d ? 'cp_fiscal' then nullif(v_cp, '') else cp_fiscal end,
    domicilio = case when d ? 'domicilio' then nullif(trim(d->>'domicilio'), '') else domicilio end,
    datos_bancarios = case when d ? 'datos_bancarios' then nullif(trim(d->>'datos_bancarios'), '') else datos_bancarios end,
    dias_credito = case when d ? 'dias_credito' then v_dias else dias_credito end,
    contacto = case when d ? 'contacto' then nullif(trim(d->>'contacto'), '') else contacto end,
    telefono = case when d ? 'telefono' then nullif(trim(d->>'telefono'), '') else telefono end,
    correo = case when d ? 'correo' then nullif(lower(trim(d->>'correo')), '') else correo end,
    notas = case when d ? 'notas' then nullif(trim(d->>'notas'), '') else notas end
  where id = p_proveedor;
end $$;
revoke execute on function public.actualizar_proveedor_finanzas(uuid, jsonb) from public, anon;
grant execute on function public.actualizar_proveedor_finanzas(uuid, jsonb) to authenticated;

-- "Cambiamos de cuenta" es el fraude más común con proveedores: cada cambio de datos
-- bancarios (lo haga compras o finanzas) avisa a dirección antes del siguiente pago.
-- No bloquea; el aviso no repite la cuenta, solo dice quién la cambió.
create or replace function public.trg_aviso_banco_proveedor() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_quien text;
begin
  if new.datos_bancarios is distinct from old.datos_bancarios then
    select nombre into v_quien from perfiles where id = auth.uid();
    perform avisar(array(select usuarios_con_rol('direccion')), 'proveedor_banco',
      'Cambiaron los datos bancarios de ' || new.nombre,
      coalesce(v_quien, 'Alguien') || ' cambió la cuenta para pagarle. Revísala antes del siguiente pago.',
      '/compras/proveedores/' || new.id, 'proveedores', new.id::text);
  end if;
  return new;
end $$;
drop trigger if exists aviso_banco on public.proveedores;
create trigger aviso_banco after update of datos_bancarios on public.proveedores
  for each row execute function public.trg_aviso_banco_proveedor();

-- Finanzas sube la constancia del proveedor para poner al día sus datos fiscales (lleva lo
-- contable con los contadores): el aviso de "ese RFC ya existe" también es para ella.
create or replace function public.rfc_registrado(p_rfc text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_rfc text := upper(regexp_replace(coalesce(p_rfc, ''), '[\s\-]', '', 'g'));
begin
  if not (puede('ventas', 2) or puede('compras', 2) or puede('finanzas', 2)) then
    raise exception 'Sin permiso para dar de alta clientes ni proveedores' using errcode = '42501';
  end if;
  if v_rfc = '' then return jsonb_build_object('clientes', '[]'::jsonb, 'proveedores', '[]'::jsonb); end if;
  return jsonb_build_object(
    'clientes', case when puede('ventas', 2) then coalesce((
      select jsonb_agg(jsonb_build_object('id', c.id, 'nombre', c.nombre, 'vendedor', p.nombre,
        'mio', c.vendedor_id = auth.uid(), 'editable', cliente_visible(c.id)) order by c.creado_en)
      from clientes c left join perfiles p on p.id = c.vendedor_id
      where c.activo and upper(regexp_replace(coalesce(c.rfc, ''), '[\s\-]', '', 'g')) = v_rfc), '[]'::jsonb)
      else '[]'::jsonb end,
    'proveedores', case when puede('compras', 1) or puede('finanzas', 2) then coalesce((
      select jsonb_agg(jsonb_build_object('id', x.id, 'nombre', x.nombre) order by x.creado_en)
      from proveedores x
      where x.activo and upper(regexp_replace(coalesce(x.rfc, ''), '[\s\-]', '', 'g')) = v_rfc), '[]'::jsonb)
      else '[]'::jsonb end);
end $$;

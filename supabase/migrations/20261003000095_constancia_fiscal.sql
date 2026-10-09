-- =============================================================================
-- Alta de cliente o proveedor desde la constancia de situación fiscal.
--
-- Por qué: los datos fiscales se copian a mano de la constancia (PDF del SAT) y
-- un dígito mal en el RFC o el CP hace que el CFDI 4.0 se rechace. Claude lee la
-- constancia (función asistente, documento "constancia_fiscal"); aquí va lo que
-- faltaba en la base para recibirla.
--
-- * Proveedores: régimen fiscal y CP fiscal, como ya los tienen los clientes.
-- * rfc_registrado(): antes de dar de alta, si ese RFC ya existe. El RFC no es
--   único en la tabla (sucursales, el directorio importado de la hoja) y se guarda
--   con o sin guiones: sin esto, la constancia de un cliente que ya es de Isaac
--   terminaba en un cliente duplicado a nombre de otro vendedor. Dice de quién es
--   y si quien pregunta lo puede editar (cliente_visible).
-- =============================================================================

alter table public.proveedores add column if not exists regimen_fiscal text;
alter table public.proveedores add column if not exists cp_fiscal text;

create or replace function public.rfc_registrado(p_rfc text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_rfc text := upper(regexp_replace(coalesce(p_rfc, ''), '[\s\-]', '', 'g'));
begin
  if not (puede('ventas', 2) or puede('compras', 2)) then
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
    'proveedores', case when puede('compras', 1) then coalesce((
      select jsonb_agg(jsonb_build_object('id', x.id, 'nombre', x.nombre) order by x.creado_en)
      from proveedores x
      where x.activo and upper(regexp_replace(coalesce(x.rfc, ''), '[\s\-]', '', 'g')) = v_rfc), '[]'::jsonb)
      else '[]'::jsonb end);
end $$;
revoke execute on function public.rfc_registrado(text) from public, anon;
grant execute on function public.rfc_registrado(text) to authenticated;

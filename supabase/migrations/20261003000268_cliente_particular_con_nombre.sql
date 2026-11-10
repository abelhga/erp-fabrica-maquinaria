-- =============================================================================
-- Un cliente sin empresa se llama como la persona, no «Particular».
--
-- Por qué: para que un lead contara como completo, recepción pone «Particular» en la empresa (el
-- botón «Es particular»), y la IA del teléfono, «No tiene empresa» o «...». Al volverlo oportunidad,
-- convertir_lead daba de alta el cliente con la empresa, así que la lista de cotizaciones se llenó
-- de «Particular», «Independiente» o «....»: 25 clientes, cada uno con una sola persona y sin
-- pedidos. Para saber de quién era había que abrir cada cotización.
--
-- Qué cambia:
--   * empresa_generica(): «Particular», «Independiente», «No tiene empresa», «Sin denominación»,
--     «N/A», puros signos… En el lead se sigue aceptando (dice que es una persona); en un cliente no.
--   * convertir_lead: con empresa genérica, el cliente se llama como la persona del lead.
--   * alta_cliente: con nombre genérico usa el del contacto; si no hay, pide el nombre de la persona.
--   * Un disparador en clientes cierra la puerta por cualquier otro camino.
--   * Un lead con «...» de empresa cuenta como incompleto: eso no dice nada.
--   * Los clientes que ya se llaman así toman el nombre de su único contacto (y sus cotizaciones en
--     borrador también). Las enviadas se quedan como se mandaron.
-- =============================================================================

create or replace function public.empresa_generica(p text) returns boolean
language sql stable set search_path = public, extensions as $$
  select revision_normalizar(p) ~ ('^(particular(es)?|cliente particular|persona fisica|independiente|sin empresa'
    || '|(aun )?no tiene empresa|no menciona( la)? empresa|no dio empresa|sin denominacion|sin identificar'
    || '|ningun[ao]?|n a|na|no aplica|sin nombre|desconocid[ao]|x+|)$')
$$;
grant execute on function public.empresa_generica(text) to authenticated;

-- 1. convertir_lead: el nombre de la persona cuando la empresa no dice nada.
do $$
declare d text; n text;
begin
  d := pg_get_functiondef('public.convertir_lead(uuid, uuid)'::regprocedure);
  n := replace(d, 'values (coalesce(l.empresa, l.nombre), l.ciudad,',
                  'values (case when empresa_generica(l.empresa) then trim(l.nombre) else trim(l.empresa) end, l.ciudad,');
  if n = d then raise exception 'convertir_lead: no encontré el alta del cliente'; end if;
  execute n;
end $$;

-- 2. alta_cliente: igual desde la pantalla de clientes.
do $$
declare d text; n text;
begin
  d := pg_get_functiondef('public.alta_cliente(jsonb, jsonb, boolean)'::regprocedure);
  n := replace(d, $a$  if v_nombre is null then raise exception 'Escribe el nombre del cliente' using errcode = '23514'; end if;$a$,
    $a$  if v_nombre is null then raise exception 'Escribe el nombre del cliente' using errcode = '23514'; end if;
  if empresa_generica(v_nombre) then
    v_nombre := nullif(trim(p_contacto->>'nombre'), '');
    if v_nombre is null or empresa_generica(v_nombre) then
      raise exception 'Si no tiene empresa, el cliente se llama como la persona: escribe su nombre' using errcode = '23514';
    end if;
  end if;$a$);
  if n = d then raise exception 'alta_cliente: no encontré la revisión del nombre'; end if;
  execute n;
end $$;

-- 3. Por cualquier otro camino (importar, editar la ficha), tampoco.
create or replace function public.cliente_nombre_no_generico() returns trigger
language plpgsql set search_path = public as $$
begin
  if empresa_generica(new.nombre) and (tg_op = 'INSERT' or new.nombre is distinct from old.nombre) then
    raise exception '«%» no dice quién es: si no tiene empresa, el cliente se llama como la persona', new.nombre
      using errcode = '23514';
  end if;
  return new;
end $$;
drop trigger if exists cliente_nombre_no_generico on public.clientes;
create trigger cliente_nombre_no_generico before insert or update of nombre on public.clientes
  for each row execute function public.cliente_nombre_no_generico();

-- 4. Un lead con «...» de empresa no está completo. «Particular» sí (dice que es una persona).
create or replace function public.lead_faltan(p_cliente uuid, p_empresa text, p_ciudad text, p_estado text, p_interes text)
returns text[] language sql immutable set search_path = public as $$
  select array_remove(array[
    case when p_cliente is null and coalesce(trim(p_ciudad), '') = '' and coalesce(trim(p_estado), '') = '' then 'dónde está' end,
    case when p_cliente is null and regexp_replace(coalesce(p_empresa, ''), '[[:punct:][:space:]]', '', 'g') = '' then 'empresa' end,
    case when not (coalesce(p_interes, '') ~ '[0-9]' or cardinality(regexp_split_to_array(trim(coalesce(p_interes, '')), '\s+')) >= 3)
         then 'qué busca (modelo, medida o para qué)' end
  ], null)
$$;

-- 5. Los que ya se llaman así: el nombre de su único contacto. Si tienen más de uno o ninguno, se
--    quedan (alguien tiene que decidir cuál es).
with c as (
  select cl.id, min(k.nombre) persona
  from clientes cl join contactos k on k.cliente_id = cl.id
  where empresa_generica(cl.nombre)
  group by cl.id having count(*) = 1
),
r as (
  update clientes cl set nombre = trim(c.persona) from c
  where cl.id = c.id and nullif(trim(c.persona), '') is not null and not empresa_generica(c.persona)
  returning cl.id, cl.nombre
),
q as (
  update cotizaciones q set empresa = r.nombre from r
  where q.cliente_id = r.id and q.estado = 'borrador' and empresa_generica(q.empresa)
  returning q.id
)
update leads l set cliente_nombre = r.nombre from r where l.cliente_id = r.id;

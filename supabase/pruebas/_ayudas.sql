-- Se carga antes de cada archivo de prueba (dentro de la misma transacción).
-- usuario('ana@hegamex.com', '{ventas}') crea la cuenta como lo haría Google.
-- como(id) / como_postgres() cambian quién ejecuta, para probar la RLS de verdad.
create or replace function pg_temp.usuario(p_correo text, p_roles public.app_rol[]) returns uuid
language plpgsql as $$
declare v uuid := gen_random_uuid();
begin
  -- Sufijo al azar: la base local también tiene los usuarios de scripts/usuarios-locales.mjs
  -- con estos mismos correos, y el correo es único.
  insert into auth.users (id, email, raw_user_meta_data)
  values (v, replace(p_correo, '@', '+' || left(v::text, 8) || '@'), jsonb_build_object('full_name', split_part(p_correo, '@', 1)));
  insert into public.usuario_roles (usuario_id, rol) select v, unnest(p_roles);
  return v;
end $$;

create or replace function pg_temp.como(p_usuario uuid) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_usuario, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

create or replace function pg_temp.como_postgres() returns void
language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end $$;

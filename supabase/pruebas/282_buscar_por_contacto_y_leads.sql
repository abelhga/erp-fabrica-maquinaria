-- El buscador encuentra al cliente por su contacto (nombre, correo o teléfono) y encuentra leads.
-- Lo que NO: que alguien sin permiso de leads vea un lead en el buscador.
do $$
declare v_dir uuid; v_prod uuid; v_cli uuid; v_lead uuid; r record;
begin
  v_dir := pg_temp.usuario('dir282@hegamex.com', '{direccion}');
  v_prod := pg_temp.usuario('prod282@hegamex.com', '{produccion}');
  insert into clientes (nombre) values ('Comercializadora Granos 282') returning id into v_cli;
  insert into contactos (cliente_id, nombre, telefono, correo) values (v_cli, 'Freddy Saradia 282', '228 108 4282', 'freddy282@granos.mx');
  insert into leads (nombre, empresa, telefono, interes) values ('Ismael Zapotitla 282', 'Particular', '+52 228 999 0282', 'Cribadora V3') returning id into v_lead;

  perform pg_temp.como(v_dir);
  -- 1. Por el nombre del contacto, sin acentos ni mayúsculas, y por su teléfono con o sin espacios.
  select * into r from buscar_global('freddy saradia 282') where tipo = 'cliente';
  assert r.id = v_cli::text and r.subtitulo = 'Contacto: Freddy Saradia 282', format('por contacto: %s', row_to_json(r));
  assert exists (select 1 from buscar_global('2281084282') where tipo = 'cliente' and id = v_cli::text), 'por teléfono del contacto';
  assert exists (select 1 from buscar_global('freddy282@granos') where tipo = 'cliente' and id = v_cli::text), 'por correo del contacto';
  -- Al elegir cliente, también.
  assert exists (select 1 from buscar_clientes('Freddy Saradia 282') where id = v_cli), 'elegir cliente no busca por contacto';
  -- 2. Leads, por nombre y por teléfono.
  assert exists (select 1 from buscar_global('zapotitla 282') where tipo = 'lead' and id = v_lead::text), 'no encontró el lead por nombre';
  assert exists (select 1 from buscar_global('228 999 0282') where tipo = 'lead' and id = v_lead::text), 'no encontró el lead por teléfono';

  -- 3. Lo que NO: producción no ve leads en el buscador.
  perform pg_temp.como(v_prod);
  assert not exists (select 1 from buscar_global('zapotitla 282') where tipo = 'lead'), 'producción vio un lead';
end $$;

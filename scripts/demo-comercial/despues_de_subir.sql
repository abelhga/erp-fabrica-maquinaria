-- Después de subir los datos a la nube (subir_datos.py): la IA con cupo corto (el socio pregunta
-- en vivo; no se usa a diario) y el resumen del tablero que se vuelva a escribir con los datos nuevos.
-- La contraseña de las cuentas NO va aquí: la pone quien sube, con
--   update auth.users set encrypted_password = extensions.crypt('<contraseña>', extensions.gen_salt('bf'))
--   where email like '%@fabricaatlas.demo';
update public.configuracion set valor = valor || '{"limite_diario": 25}' where clave = 'asistente';
update public.configuracion set valor = valor || '{"tope_tokens_mes": 3000000}' where clave = 'revision_nocturna';
delete from public.asistente_resumenes;
select (select count(*) from auth.users) cuentas, (select count(*) from public.pedidos) pedidos,
       (select round(public.ventas_entre(make_date(extract(year from current_date)::int, 1, 1), current_date))) ventas_del_anio,
       (select valor->>'nombre' from public.configuracion where clave = 'empresa') empresa;

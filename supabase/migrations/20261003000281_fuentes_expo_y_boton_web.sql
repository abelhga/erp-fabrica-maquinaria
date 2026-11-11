-- =============================================================================
-- «¿Cómo llegó?»: se agregan «Expo o feria» y «Botón de contacto del sitio web».
--
-- Por qué: al registrar un lead o un pedido no había dónde poner que el cliente llegó por una expo
-- (solo existía «Expo CIHAC», que es la lista que se cargó de esa feria) ni por el botón de contacto
-- del sitio web (el formulario sí estaba, el botón no). Se terminaba eligiendo «Otro» y se perdía de
-- dónde vienen los clientes.
-- =============================================================================

insert into public.fuentes_contacto (nombre)
select x from (values ('Expo o feria'), ('Botón de contacto del sitio web')) v(x)
where not exists (select 1 from public.fuentes_contacto f where lower(f.nombre) = lower(v.x));

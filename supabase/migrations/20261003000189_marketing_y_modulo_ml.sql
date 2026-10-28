-- =============================================================================
-- Marketing entra al ERP, y Mercado Libre pasa a ser un módulo propio.
--
-- Adriana Barragán (marketing) no tenía cuenta ni rol que le quedara. Necesita el catálogo con
-- precios de venta, todos los leads (de dónde llegan y qué pasó con ellos) y Mercado Libre
-- (preguntas y publicaciones). No necesita cotizaciones, clientes, pedidos, costos ni márgenes.
--
-- Mercado Libre colgaba del módulo «ventas»: dárselo a marketing le abría también los clientes y
-- las cotizaciones de los vendedores. Ahora es el módulo «mercadolibre» (1 ver, 2 contestar y
-- ligar). Quien tenía ventas lo recibe con el mismo nivel, así que para ellos nada cambia. El
-- dinero de cada venta (ml_ventas, ml_pagos) sigue siendo de ventas y finanzas.
-- =============================================================================

insert into public.permisos_rol (rol, modulo, nivel)
select rol, 'mercadolibre', nivel from public.permisos_rol where modulo = 'ventas'
on conflict (rol, modulo) do nothing;

insert into public.permisos_rol (rol, modulo, nivel) values
  ('marketing', 'catalogo', 1),       -- lo que se vende, con foto y precio de lista
  ('marketing', 'leads', 3),          -- todos los leads y a quién le llegan
  ('marketing', 'mercadolibre', 2),   -- preguntas, publicaciones por ligar
  ('marketing', 'asistente', 1)
on conflict (rol, modulo) do update set nivel = excluded.nivel;

drop policy if exists ver on public.ml_preguntas;
create policy ver on public.ml_preguntas for select to authenticated using ((select puede('mercadolibre', 1)));
drop policy if exists ver on public.ml_publicaciones_sin_ligar;
create policy ver on public.ml_publicaciones_sin_ligar for select to authenticated
  using ((select puede('mercadolibre', 1)) or (select puede('compras', 1)));
drop policy if exists ver on public.ml_publicaciones_ajenas;
create policy ver on public.ml_publicaciones_ajenas for select to authenticated
  using ((select puede('mercadolibre', 1)) or (select puede('compras', 1)));

-- Las funciones de Mercado Libre revisaban puede('ventas', n). Se cambia solo eso, sobre la
-- definición vigente de cada una (la última está en 134, 165 y 186), en vez de copiar aquí cuatro
-- funciones largas: si alguna ya no trae ese permiso, la migración se detiene.
do $$
declare f text; d text; n text;
begin
  foreach f in array array['ml_ligar_publicacion(text, uuid, numeric)', 'ml_corregir_publicacion(text, uuid, numeric)',
                           'ml_marcar_ajena(text)', 'ml_desmarcar_ajena(text)', 'estado_mercadolibre()'] loop
    d := pg_get_functiondef(('public.' || f)::regprocedure);
    n := replace(replace(d, 'puede(''ventas'', 2)', 'puede(''mercadolibre'', 2)'), 'puede(''ventas'', 1)', 'puede(''mercadolibre'', 1)');
    if n = d then raise exception 'No encontré el permiso de ventas en %', f; end if;
    execute n;
  end loop;
end $$;

-- Su cuenta se crea la primera vez que entre con Google, ya con el rol.
insert into public.invitaciones (correo, nombre, roles)
values ('adriana.barragan@hegamex.com', 'Adriana Barragán González', '{marketing}')
on conflict (correo) do update set roles = excluded.roles, nombre = excluded.nombre;

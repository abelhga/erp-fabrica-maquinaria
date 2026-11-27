-- =============================================================================
-- Importaciones ve los pedidos sin montos (Producción → Pedidos), para los manuales y fichas técnicas.
--
-- Por qué: Alondra, además de importaciones, hace y entrega al cliente los manuales y las fichas
-- técnicas de cada equipo, y para eso necesita saber qué se vendió y con qué descripción. Pidió
-- «Pedidos», pero esa pantalla trae precios y saldos. La de la planta trae lo vendido con su
-- descripción y nada de dinero, y es la que se le abre. Solo ver: no entrega, no crea órdenes ni
-- suelta material (cada botón revisa su propio permiso).
-- =============================================================================

create or replace function public.ve_pedidos_sin_montos() returns boolean
language sql stable security definer set search_path = public as $$
  select puede('ventas', 3) or puede('finanzas', 1) or puede('produccion', 2) or puede('inventario', 2)
      or puede('importaciones', 3)
$$;

-- El nombre del cliente lo da ventas nivel 1 (la política de clientes). En la nube importaciones ya lo
-- tiene (se le dio desde Sistema); aquí queda escrito para que una base nueva diga lo mismo.
insert into public.permisos_rol (rol, modulo, nivel) values ('importaciones', 'ventas', 1)
on conflict do nothing;

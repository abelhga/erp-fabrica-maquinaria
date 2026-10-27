-- =============================================================================
-- Cuenta de la terminal de piso: la tablet del taller entra con correo y contraseña,
-- sin cuenta de Google, y solo abre la terminal.
--
-- Hasta hoy la única cuenta sin Google era la de la TV. Para la tablet quedaba darle el rol
-- «Producción», que además deja capturar mantenimiento y servicio, ver el catálogo y el
-- inventario y usar el asistente: demasiado para un aparato que cualquiera del piso toca. El
-- rol «terminal» marca el avance de las etapas (producción 2) y reporta fallas de máquinas
-- con foto (mantenimiento 2, como el botón «Reportar falla» de la terminal). Nada más.
-- La pantalla esconde todo lo demás; la base es la que pone el límite.
-- =============================================================================

insert into public.permisos_rol (rol, modulo, nivel) values
  ('terminal', 'produccion', 2),
  ('terminal', 'mantenimiento', 2)
on conflict (rol, modulo) do update set nivel = excluded.nivel;

-- La tablet no es una persona: no lleva mejoras (igual que la TV).
create or replace function public.personas_mejoras()
returns table (id uuid, nombre text)
language sql stable security definer set search_path = public as $$
  select distinct p.id, p.nombre
  from perfiles p
  join usuario_roles ur on ur.usuario_id = p.id
  join permisos_rol pr on pr.rol = ur.rol
  where (puede('produccion', 2) or puede('procesos', 1))
    and coalesce(p.activo, true)
    and ((pr.modulo = 'produccion' and pr.nivel >= 2) or (pr.modulo = 'procesos' and pr.nivel >= 1))
    and ur.rol not in ('pantalla', 'terminal')
  order by p.nombre
$$;

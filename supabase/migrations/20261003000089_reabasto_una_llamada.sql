-- =============================================================================
-- El reabasto en una sola llamada.
--
-- La API entrega máximo 1,000 filas, así que la pantalla pedía reabasto_detalle()
-- en páginas de mil (todasLasFilas) y cada página volvía a calcular los 5,155
-- artículos para quedarse con mil. En la nube son ~4 s por cálculo para almacén:
-- seis páginas, casi medio minuto viendo la tabla vacía. Un jsonb no cuenta como
-- filas para ese tope: se calcula una vez y llega completo.
--
-- security invoker (lo normal): la RLS de quien llama sigue decidiendo qué ve,
-- igual que reabasto_detalle(). Almacén sigue sin ver costos.
-- =============================================================================

create or replace function public.reabasto_lista()
returns jsonb
language sql
stable
as $$
  select coalesce(jsonb_agg(to_jsonb(r) order by r.articulo_id), '[]'::jsonb) from public.reabasto_detalle() r
$$;

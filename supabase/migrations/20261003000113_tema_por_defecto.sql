-- =============================================================================
-- Tema con el que abre el ERP.
--
-- Por qué: dirección quiere el modo oscuro de entrada para todos. El tema vivía
-- solo en el navegador de cada quien (y se guardaba "claro" aunque nadie lo
-- escogiera). Ahora la empresa tiene uno por omisión, editable en Configuración →
-- Empresa → Apariencia; el botón de la luna o el sol sigue siendo de cada persona y
-- manda sobre este.
-- =============================================================================
insert into public.configuracion (clave, valor, descripcion) values
  ('tema_por_defecto', '"oscuro"'::jsonb,
   'Tema con el que abre el ERP para quien no ha escogido uno con el botón: "oscuro" o "claro".')
on conflict (clave) do nothing;

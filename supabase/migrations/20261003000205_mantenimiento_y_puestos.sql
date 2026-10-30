-- =============================================================================
-- Lo que pidió Margarita (RRHH) el 30-oct-2026, ya dado de alta en la nube ese día; aquí para que
-- una base nueva quede igual.
--
-- * Departamento «Mantenimiento». No es área de piso: el área de piso es la etapa del taller
--   (Corte, Pailería…) con la que se planea la carga y se cuenta la capacidad, y una etapa
--   «Mantenimiento» aparecería en el costeo de horas, el Gantt y «Agregar etapa» de las órdenes.
--   Quien es de Mantenimiento no lleva área de piso (dirección lo decidió así).
-- * Puestos «Auxiliar de Diseño» y «Atención a Clientes»: sin ellos no se podía asignar puesto y
--   jefe a Osvaldo y a Ana Karen, y sin puesto no se arma su evaluación de objetivos.
-- =============================================================================

insert into public.departamentos (nombre) values ('Mantenimiento') on conflict (nombre) do nothing;

insert into public.puestos (nombre, departamento_id, descripcion)
select x.n, d.id, x.de from (values
  ('Auxiliar de Diseño', 'Ingeniería', 'Apoyo a diseño industrial: planos, listas de material y fichas técnicas.'),
  ('Atención a Clientes', 'Ventas', 'Recepción: llamadas y visitas de clientes, prospectos nuevos y su seguimiento.')
) x(n, dep, de) join public.departamentos d on d.nombre = x.dep
on conflict (nombre) do nothing;

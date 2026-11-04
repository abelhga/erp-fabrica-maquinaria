-- =============================================================================
-- Indicador «WhatsApp de la empresa contestado» (recepción).
--
-- Por qué: Karen, además de registrar leads, contesta el WhatsApp de la empresa, y Abel lo quiere
-- en sus objetivos. El ERP no ve esos chats (viven en el celular), así que lo califica su jefe de
-- 0 a 10 revisando el celular; si algún día el WhatsApp de la empresa pasa por el ERP, se mide solo.
-- =============================================================================

insert into public.objetivo_indicadores (id, clave, nombre, area, fuente, checklist, unidad, descripcion, dato_faltante, activo) values
  (74, 'whatsapp_empresa', 'WhatsApp de la empresa contestado', 'ventas', 'manual', null, 'puntos',
   'Que nadie se quede sin respuesta en el WhatsApp de la empresa en horario de trabajo, y que lo que pide un cliente se registre como lead o se le pase a quien le toca. El jefe revisa el celular y califica de 0 a 10.',
   'Los chats del WhatsApp de la empresa no pasan por el ERP', true)
on conflict (id) do update set clave = excluded.clave, nombre = excluded.nombre, area = excluded.area, fuente = excluded.fuente,
  unidad = excluded.unidad, descripcion = excluded.descripcion, dato_faltante = excluded.dato_faltante;

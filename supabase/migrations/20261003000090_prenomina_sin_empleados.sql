-- =============================================================================
-- "La prenómina no se ha cerrado" sin nadie en la nómina.
--
-- Al quitar la demostración el ERP quedó sin empleados (la plantilla real todavía no
-- se captura), y aun así Inicio le decía a dirección cada semana que la prenómina
-- seguía abierta, y el aviso de los viernes iba a salir igual. Una semana sin
-- empleados activos no tiene nada que cerrar: el aviso y el hallazgo esperan a que
-- haya al menos uno. El resto de las dos funciones queda igual que en 072.
-- =============================================================================

create or replace function public.avisos_objetivos_nomina() returns int
language plpgsql security definer set search_path = public as $$
declare
  v_hoy date := hoy_planta();
  v_semana date := hoy_planta() - ((extract(isodow from hoy_planta())::int - 5 + 7) % 7) - 7;   -- la última que ya terminó
  v_mes date := (date_trunc('month', hoy_planta()) - interval '1 month')::date;
  v_n int := 0;
begin
  if objetivo_hay_avisos()
     and exists (select 1 from empleados where activo)
     and not exists (select 1 from nomina_semanas where inicio = v_semana and estado = 'cerrada') then
    v_n := v_n + avisar(array(select usuarios_con_permiso('nomina', 3)), 'nomina_por_cerrar',
      format('Prenómina del %s al %s lista para cerrar', to_char(v_semana, 'DD/MM'), to_char(v_semana + 6, 'DD/MM')),
      'La semana ya terminó. Revisa faltas, horas extra y conceptos, ciérrala y exporta el CSV para el contador.',
      '/rrhh/prenomina?semana=' || v_semana, 'nomina_semanas', v_semana::text, true);
  end if;
  if extract(day from v_hoy) <= 3
     and not exists (select 1 from objetivo_evaluaciones where mes = v_mes)
     and exists (select 1 from puesto_asignaciones where desde < v_mes + interval '1 month' and (hasta is null or hasta >= v_mes)) then
    perform objetivo_armar(v_mes);
  end if;
  return v_n;
end $$;

create or replace function public.hallazgos_objetivos(p_area text)
returns table (area text, tono text, titulo text, detalle text, ruta text, peso int)
language plpgsql stable security invoker set search_path = public as $$
declare
  v_hoy date := hoy_planta();
  v_mes date := date_trunc('month', hoy_planta())::date;
  v_semana date := hoy_planta() - ((extract(isodow from hoy_planta())::int - 5 + 7) % 7) - 7;
  k int; v_m date;
begin
  if puede('objetivos', 1) then
    -- Meses ya terminados que el jefe no ha calificado.
    select count(*), max(e.mes) into k, v_m from objetivo_evaluaciones e
    where e.evaluador_id = auth.uid() and e.estado = 'borrador' and e.mes < v_mes;
    if k > 0 then
      area := p_area; tono := 'atencion'; peso := 20; ruta := '/rrhh/objetivos?mes=' || to_char(v_m, 'YYYY-MM');
      titulo := case when k = 1 then 'Una evaluación de objetivos espera tu calificación' else k || ' evaluaciones de objetivos esperan tu calificación' end;
      detalle := 'Lo automático ya está medido con su evidencia; falta lo que calificas tú. Después la revisa RRHH.';
      return next;
    end if;
  end if;

  if puede('objetivos', 3) then
    select count(*) into k from objetivo_evaluaciones e where e.estado = 'calificada' and e.empleado_id is distinct from mi_empleado();
    if k > 0 then
      area := 'rrhh'; tono := 'atencion'; peso := 22; ruta := '/rrhh/objetivos';
      titulo := case when k = 1 then 'Una evaluación calificada espera revisión' else k || ' evaluaciones calificadas esperan revisión' end;
      detalle := 'El jefe ya calificó; RRHH revisa antes de que dirección apruebe.';
      return next;
    end if;
    select count(*) into k from objetivo_evidencias v where v.impugnacion = 'pendiente' and v.impugnada_por is distinct from auth.uid();
    if k > 0 then
      area := 'rrhh'; tono := 'atencion'; peso := 21; ruta := '/rrhh/objetivos';
      titulo := case when k = 1 then 'Una incidencia impugnada por resolver' else k || ' incidencias impugnadas por resolver' end;
      detalle := 'Un jefe dice que no aplica. Mientras no se resuelva, la evaluación no se puede revisar.';
      return next;
    end if;
    select count(*) into k from objetivo_ajustes a where a.estado = 'pendiente' and a.solicitado_por <> auth.uid();
    if k > 0 then
      area := 'rrhh'; tono := 'atencion'; peso := 23; ruta := '/rrhh/objetivos';
      titulo := case when k = 1 then 'Un ajuste de objetivos por autorizar' else k || ' ajustes de objetivos por autorizar' end;
      detalle := 'Un mes ya aprobado se corrige solo con un ajuste que autoriza otra persona.';
      return next;
    end if;
  end if;

  if tiene_rol('direccion') then
    select count(*) into k from objetivo_evaluaciones e where e.estado = 'revisada' and e.empleado_id is distinct from mi_empleado();
    if k > 0 then
      area := 'direccion'; tono := 'atencion'; peso := 22; ruta := '/rrhh/objetivos';
      titulo := case when k = 1 then 'Una evaluación de objetivos por aprobar' else k || ' evaluaciones de objetivos por aprobar' end;
      detalle := 'RRHH ya las revisó. Al aprobar, el mes se cierra y pasa a la prenómina.';
      return next;
    end if;
  end if;

  if puede('nomina', 3) and exists (select 1 from empleados where activo)
     and not exists (select 1 from nomina_semanas s where s.inicio = v_semana and s.estado = 'cerrada') then
    area := 'rrhh'; peso := 10; ruta := '/rrhh/prenomina?semana=' || v_semana;
    tono := case when v_hoy > v_semana + 9 then 'riesgo' else 'atencion' end;
    titulo := format('La prenómina del %s al %s no se ha cerrado', to_char(v_semana, 'DD/MM'), to_char(v_semana + 6, 'DD/MM'));
    detalle := 'La semana ya terminó. Al cerrarla se congela, se descuentan los préstamos y sale el CSV para el contador.';
    return next;
  end if;

  if puede('nomina', 1) then
    select count(*) into k from objetivo_evaluaciones e
    where e.estado = 'aprobada' and not exists (select 1 from nomina_bonos nb where nb.evaluacion_id = e.id)
      and not exists (select 1 from bono_bases b where b.base_mensual is not null and b.desde <= e.mes
                      and (b.empleado_id = e.empleado_id or (b.empleado_id is null and b.puesto_id = e.puesto_id)));
    if k > 0 then
      area := 'direccion'; tono := 'info'; peso := 60; ruta := '/rrhh/objetivos';
      titulo := case when k = 1 then 'Un bono de objetivos aprobado sin base' else k || ' bonos de objetivos aprobados sin base' end;
      detalle := 'Falta definir cuánto vale el bono por puesto o por persona. Mientras tanto la prenómina enseña el % y no paga nada.';
      return next;
    end if;
  end if;
end $$;

-- =============================================================================
-- Avisos del flujo de objetivos y de la prenómina (con avisar() de la 0071).
--
-- En la hoja nadie sabía cuándo le tocaba: el SCORE se escribía "al cierre"
-- y no quedaba quién calificó. Aquí cada paso le avisa al siguiente:
--   borrador del mes listo → jefe;  calificada → RRHH;  revisada → dirección;
--   aprobada → la persona (si tiene usuario);  devuelta → el jefe;
--   impugnación → RRHH;  ajuste pedido → quien puede autorizarlo, y la
--   respuesta a quien lo pidió;  semana de nómina terminada sin cerrar → RRHH.
-- Ningún aviso lleva montos de nómina: el % de objetivos sí, los pesos no.
--
-- Además, el día 1 (cron) se arma solo el borrador del mes anterior, como
-- pedía la propuesta: el jefe recibe lo automático ya medido. Y lo pendiente
-- sale en "lo que importa hoy" con hallazgos_objetivos() (al final).
--
-- Si avisar() no existe (una base sin la 0071), los disparadores no hacen
-- nada: un aviso nunca detiene el flujo.
-- =============================================================================

create or replace function public.objetivo_hay_avisos() returns boolean
language sql stable as $$
  select to_regprocedure('public.avisar(uuid[],text,text,text,text,text,text,boolean)') is not null
$$;

-- Borrador listo → su jefe (o RRHH y dirección si no tiene jefe). Uno por jefe
-- y mes: se arma persona por persona y con diez personas serían diez avisos.
create or replace function public.aviso_objetivos_armados() returns trigger
language plpgsql security definer set search_path = public as $$
declare r record;
begin
  if not objetivo_hay_avisos() then return null; end if;
  for r in select evaluador_id, mes from nuevas group by evaluador_id, mes loop
    perform avisar(
      case when r.evaluador_id is not null then array[r.evaluador_id] else array(select usuarios_con_permiso('objetivos', 3)) end,
      'objetivos_borrador', format('Objetivos de %s listos para calificar', objetivo_nombre_mes(r.mes)),
      'Lo que mide el sistema ya está medido, con su evidencia. Califica lo demás y envíalo a RRHH.',
      '/rrhh/objetivos?mes=' || to_char(r.mes, 'YYYY-MM'), 'objetivo_evaluaciones',
      'mes:' || r.mes || ':' || coalesce(r.evaluador_id::text, 'rrhh'), true);
  end loop;
  return null;
end $$;
drop trigger if exists aviso_armadas on public.objetivo_evaluaciones;
create trigger aviso_armadas after insert on public.objetivo_evaluaciones
  referencing new table as nuevas for each statement execute function public.aviso_objetivos_armados();

create or replace function public.aviso_objetivo_estado() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_mes text := objetivo_nombre_mes(new.mes);
  v_ruta text := '/rrhh/objetivos?mes=' || to_char(new.mes, 'YYYY-MM') || '&ver=' || new.id;
  v_total text := coalesce(trim_scale(new.total)::text, '0') || ' %' || case when new.llave_activada then ' (llave activada)' else '' end;
  v_usuario uuid;
begin
  if not objetivo_hay_avisos() or new.estado is not distinct from old.estado then return null; end if;
  if new.estado = 'calificada' then
    perform avisar(array(select usuarios_con_rol('rrhh')), 'objetivo_calificada',
      format('%s: objetivos de %s por revisar', new.empleado_nombre, v_mes),
      format('Calificada por %s: %s.', coalesce((select nombre from perfiles where id = new.calificada_por), 'su jefe'), v_total),
      v_ruta, 'objetivo_evaluaciones', new.id::text);
  elsif new.estado = 'revisada' then
    perform avisar(array(select usuarios_con_rol('direccion')), 'objetivo_revisada',
      format('%s: objetivos de %s por aprobar', new.empleado_nombre, v_mes),
      format('RRHH la revisó: %s.', v_total), v_ruta, 'objetivo_evaluaciones', new.id::text);
  elsif new.estado = 'aprobada' then
    select usuario_id into v_usuario from empleados where id = new.empleado_id;
    perform avisar(array[v_usuario], 'objetivo_aprobada',
      format('Tus objetivos de %s quedaron aprobados', v_mes),
      format('Resultado: %s. Puedes ver cada indicador con su evidencia y comentar.', v_total),
      '/rrhh/mi-desempeno?mes=' || to_char(new.mes, 'YYYY-MM'), 'objetivo_evaluaciones', new.id::text);
  elsif new.estado = 'borrador' then
    perform avisar(case when new.evaluador_id is not null then array[new.evaluador_id]
                        else array(select usuarios_con_permiso('objetivos', 3)) end,
      'objetivo_devuelta', format('%s: objetivos de %s devueltos', new.empleado_nombre, v_mes),
      new.devuelta_motivo, v_ruta, 'objetivo_evaluaciones', new.id::text);
  end if;
  return null;
end $$;
drop trigger if exists aviso_estado on public.objetivo_evaluaciones;
create trigger aviso_estado after update of estado on public.objetivo_evaluaciones
  for each row execute function public.aviso_objetivo_estado();

-- Impugnación de una incidencia automática → RRHH la resuelve.
create or replace function public.aviso_objetivo_impugnacion() returns trigger
language plpgsql security definer set search_path = public as $$
declare e objetivo_evaluaciones;
begin
  if not objetivo_hay_avisos() or new.impugnacion is distinct from 'pendiente' or old.impugnacion is not distinct from new.impugnacion then
    return null;
  end if;
  select x.* into e from objetivo_evaluaciones x join objetivo_resultados r on r.evaluacion_id = x.id where r.id = new.resultado_id;
  perform avisar(array(select usuarios_con_rol('rrhh')), 'objetivo_impugnacion',
    format('%s impugnó una incidencia de %s', coalesce((select nombre from perfiles where id = new.impugnada_por), 'El jefe'), e.empleado_nombre),
    coalesce(new.folio || ': ', '') || new.motivo_impugnacion,
    '/rrhh/objetivos?mes=' || to_char(e.mes, 'YYYY-MM') || '&ver=' || e.id, 'objetivo_evidencias', new.id::text);
  return null;
end $$;
drop trigger if exists aviso_impugnacion on public.objetivo_evidencias;
create trigger aviso_impugnacion after update of impugnacion on public.objetivo_evidencias
  for each row execute function public.aviso_objetivo_impugnacion();

-- Ajuste a un mes aprobado: lo autoriza otra persona; la respuesta vuelve a quien lo pidió.
create or replace function public.aviso_objetivo_ajuste() returns trigger
language plpgsql security definer set search_path = public as $$
declare e objetivo_evaluaciones; v_ruta text;
begin
  if not objetivo_hay_avisos() then return null; end if;
  select * into e from objetivo_evaluaciones where id = new.evaluacion_id;
  v_ruta := '/rrhh/objetivos?mes=' || to_char(e.mes, 'YYYY-MM') || '&ver=' || e.id;
  if tg_op = 'INSERT' then
    perform avisar(array(select usuarios_con_permiso('objetivos', 3)), 'objetivo_ajuste_pedido',
      format('Ajuste por autorizar: %s, %s', e.empleado_nombre, objetivo_nombre_mes(e.mes)),
      format('De %s %% a %s %%. %s', trim_scale(new.total_anterior), trim_scale(new.total_corregido), new.motivo),
      v_ruta, 'objetivo_ajustes', new.id::text);
  elsif new.estado <> old.estado then
    perform avisar(array[new.solicitado_por], 'objetivo_ajuste_' || new.estado,
      format('Ajuste %s: %s, %s', new.estado, e.empleado_nombre, objetivo_nombre_mes(e.mes)),
      coalesce(new.comentario, format('Queda en %s %%.', trim_scale(case when new.estado = 'autorizado' then new.total_corregido else new.total_anterior end))),
      v_ruta, 'objetivo_ajustes', new.id::text);
  end if;
  return null;
end $$;
drop trigger if exists aviso_ajuste on public.objetivo_ajustes;
create trigger aviso_ajuste after insert or update of estado on public.objetivo_ajustes
  for each row execute function public.aviso_objetivo_ajuste();

-- Todos los días a las 8:05 de la planta (pg_cron, en UTC; México ya no cambia de horario):
--  * la semana de nómina que ya terminó y nadie ha cerrado → RRHH, una vez al día;
--  * del 1 al 3 de cada mes, si el mes anterior no se ha armado, se arma solo.
create or replace function public.avisos_objetivos_nomina() returns int
language plpgsql security definer set search_path = public as $$
declare
  v_hoy date := hoy_planta();
  v_semana date := hoy_planta() - ((extract(isodow from hoy_planta())::int - 5 + 7) % 7) - 7;   -- la última que ya terminó
  v_mes date := (date_trunc('month', hoy_planta()) - interval '1 month')::date;
  v_n int := 0;
begin
  if objetivo_hay_avisos()
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
revoke execute on function public.avisos_objetivos_nomina() from public, anon, authenticated;

do $$
begin
  perform cron.unschedule('avisos-objetivos-nomina') where exists (select 1 from cron.job where jobname = 'avisos-objetivos-nomina');
  perform cron.schedule('avisos-objetivos-nomina', '5 14 * * *', 'select public.avisos_objetivos_nomina()');
exception when others then
  raise notice 'pg_cron no está disponible: el armado del día 1 y el aviso de la prenómina quedan apagados (%).', sqlerrm;
end $$;

-- -----------------------------------------------------------------------------
-- "Lo que importa hoy": hallazgos() de la 0068 junta esta función sola.
-- security invoker: cada quien cuenta lo que su RLS le deja ver (el jefe, a su
-- gente). Sin montos: el bono sin base se dice como pendiente, no en pesos.
-- El área es la de quien tiene que actuar: el jefe (la que pidió), RRHH o dirección.
-- -----------------------------------------------------------------------------
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

  if puede('nomina', 3) and not exists (select 1 from nomina_semanas s where s.inicio = v_semana and s.estado = 'cerrada') then
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

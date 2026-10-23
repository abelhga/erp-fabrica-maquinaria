-- =============================================================================
-- Servicio cuenta las horas de taller con el horario del taller.
--
-- horas_laborables (080) traía su propia jornada: de lunes a viernes desde las 8:30, 9 horas
-- seguidas (configuracion.servicio). Con eso un servicio de lunes a miércoles le quitaba a la
-- capacidad de Pailería 27 h por persona, cuando el taller de verdad da 8.5 h al día (8:00 a
-- 17:30 menos desayuno y la pausa de la tarde), y un sábado de tiempo extra no contaba. Desde
-- 166 el horario del taller vive en horas_taller y lo edita la gerencia de producción: aquí se
-- usa el mismo, para que lo que se descuenta por salir a servicio sea lo que el taller pierde.
-- =============================================================================

create or replace function public.horas_laborables(p_desde timestamptz, p_hasta timestamptz)
returns table (dia date, horas numeric)
language sql stable set search_path = public as $$
  select x.dia, x.h
  from (
    select g.d::date dia,
           round(horas_en_horario(greatest(p_desde, g.d at time zone 'America/Mexico_City'),
                                  least(p_hasta, (g.d + interval '1 day') at time zone 'America/Mexico_City')), 2) h
    from generate_series((p_desde at time zone 'America/Mexico_City')::date,
                         (p_hasta at time zone 'America/Mexico_City')::date, interval '1 day') g(d)
    where p_hasta > p_desde
  ) x
  where x.h > 0
$$;

-- La jornada de servicio ya no se usa: que nadie la edite creyendo que cambia algo.
update public.configuracion
set valor = valor - 'jornada_inicio' - 'horas_jornada',
    descripcion = 'Servicio y mantenimiento. meses_garantia: cuánto dura la garantía desde la entrega; dias_herramienta: a partir de cuántos días una herramienta prestada se marca como "sin regresar". Las horas de taller que pierde cada persona que sale a servicio se cuentan con el horario del taller (horas_taller).'
where clave = 'servicio' and (valor ? 'jornada_inicio' or valor ? 'horas_jornada');

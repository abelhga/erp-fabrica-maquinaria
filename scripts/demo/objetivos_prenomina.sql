-- Datos de demostración para Objetivos y bonos, Checklist diario, Prenómina y
-- Mi desempeño. Usa los empleados DEMO de scripts/demo/rrhh_finanzas.sql (córrelo
-- antes) y no trae datos personales reales.
--
-- Idempotente: lo que se inserta tiene id fijo (md5 de una etiqueta "demo-op:…")
-- y se salta si ya existe; las evaluaciones solo avanzan si siguen en el estado
-- anterior y las semanas solo se cierran si están abiertas. Las fechas son
-- relativas al día en que se corre: el mes pasado queda armado y en varios
-- estados, el mes actual en borrador; dos semanas de nómina cerradas, la
-- anterior lista para cerrar y la actual en curso.
--
-- Se corre como postgres firmando con los usuarios locales (request.jwt.claims)
-- para que quién calificó, revisó y aprobó salga con nombre, como en la app.
--
-- Uso: psql "$DB_URL" -f scripts/demo/objetivos_prenomina.sql
begin;

create or replace function pg_temp.id(t text) returns uuid language sql immutable as $$ select md5('demo-op:' || t)::uuid $$;
create or replace function pg_temp.emp(n text) returns uuid language sql immutable as $$ select md5('demo-rf:emp:' || n)::uuid $$;
create or replace function pg_temp.perfil(c text) returns uuid language sql stable as $$ select id from public.perfiles where correo = c $$;
create or replace function pg_temp.como(c text) returns void language sql as $$
  select set_config('request.jwt.claims', coalesce(json_build_object('sub', (select id from public.perfiles where correo = c), 'role', 'authenticated')::text, ''), true) $$;
create or replace function pg_temp.como_id(u uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true) $$;
create or replace function pg_temp.mes(n int) returns date language sql stable as $$
  select (date_trunc('month', current_date) + make_interval(months => n))::date $$;
-- Viernes en que empieza la semana de nómina actual (n = 0) o las anteriores (n < 0).
create or replace function pg_temp.viernes(n int) returns date language sql stable as $$
  select current_date - ((extract(isodow from current_date)::int - 5 + 7) % 7) + 7 * n $$;

-- ---------------------------------------------------------------------------
-- El almacenista DEMO entra con almacen@: así es jefe de su gente y tiene "Mi desempeño".
-- ---------------------------------------------------------------------------
update public.empleados set usuario_id = pg_temp.perfil('almacen@hegamex.com')
where id = pg_temp.emp('1017') and usuario_id is null and pg_temp.perfil('almacen@hegamex.com') is not null
  and not exists (select 1 from public.empleados where usuario_id = pg_temp.perfil('almacen@hegamex.com'));

-- ---------------------------------------------------------------------------
-- Persona → puesto y jefe directo (desde hace dos meses)
-- ---------------------------------------------------------------------------
do $$ begin perform pg_temp.como('rrhh@hegamex.com'); end $$;
insert into public.puesto_asignaciones (id, empleado_id, puesto_id, jefe_id, desde, nota)
select pg_temp.id('asig:' || x.num), pg_temp.emp(x.num), p.id, pg_temp.perfil(x.jefe), pg_temp.mes(-2), 'DEMO'
from (values
  ('1001', 'Supervisor de producción', 'gerente.produccion@hegamex.com'),
  ('1006', 'Ayudante de supervisor', 'gerente.produccion@hegamex.com'),
  ('1014', 'Calidad', 'gerente.produccion@hegamex.com'),
  ('1015', 'Ingeniería de control eléctrico', 'gerente.produccion@hegamex.com'),
  ('1017', 'Encargado de almacén', 'gerente.produccion@hegamex.com'),
  ('1018', 'Auxiliar de almacén', 'almacen@hegamex.com'),
  ('1016', 'Chofer, montacarguista y auxiliar de almacén', 'almacen@hegamex.com'),
  ('1023', 'Diseño industrial', 'direccion@hegamex.com'),
  ('1026', 'Compras', 'direccion@hegamex.com')
) x(num, puesto, jefe)
join public.puestos p on p.nombre = x.puesto
where exists (select 1 from public.empleados e where e.id = pg_temp.emp(x.num))
  and not exists (select 1 from public.puesto_asignaciones a where a.id = pg_temp.id('asig:' || x.num) or a.empleado_id = pg_temp.emp(x.num));

-- ---------------------------------------------------------------------------
-- Checklist del mes pasado y de este mes (hasta ayer)
-- ---------------------------------------------------------------------------
create temp table demo_dias on commit drop as
select d::date fecha from generate_series(pg_temp.mes(-1), current_date - 1, interval '1 day') d
where public.dias_habiles(d::date, d::date) = 1;

-- Celular: RRHH los recoge 3 veces al día. Francisco (1006) falló 3 días el mes
-- pasado (la llave), José Luis (1001) uno.
insert into public.objetivo_marcas (id, tipo, fecha, empleado_id, momento, cumplio, nota, marcado_por, marcado_en)
select pg_temp.id('cel:' || n.num || ':' || d.fecha || ':' || m.momento), 'celular', d.fecha, pg_temp.emp(n.num), m.momento,
  not (d.fecha < pg_temp.mes(0) and m.momento = 'entrada' and (
        (n.num = '1006' and extract(day from d.fecha) in (8, 15, 22))
        or (n.num = '1001' and extract(day from d.fecha) = 17))),
  case when d.fecha < pg_temp.mes(0) and m.momento = 'entrada' and n.num = '1006' and extract(day from d.fecha) in (8, 15, 22)
       then 'No lo dejó en el casillero' end,
  pg_temp.perfil('rrhh@hegamex.com'), d.fecha + time '08:10' + (m.n * interval '3 hours')
from demo_dias d
cross join (values ('1001'), ('1006'), ('1015'), ('1016'), ('1017'), ('1018'), ('1023'), ('1026')) n(num)
cross join (values ('entrada', 0), ('break1', 1), ('break2', 2)) m(momento, n)
where exists (select 1 from public.empleados e where e.id = pg_temp.emp(n.num))
on conflict do nothing;

-- EPP: lo marca la gerencia de producción (calidad), también al taller.
insert into public.objetivo_marcas (id, tipo, fecha, empleado_id, cumplio, nota, marcado_por, marcado_en)
select pg_temp.id('epp:' || n.num || ':' || d.fecha), 'epp', d.fecha, pg_temp.emp(n.num),
  (extract(day from d.fecha)::int + n.num::int) % 13 <> 0,
  case when (extract(day from d.fecha)::int + n.num::int) % 13 = 0 then 'Sin guantes en el área de corte' end,
  pg_temp.perfil('gerente.produccion@hegamex.com'), d.fecha + time '09:30'
from demo_dias d
cross join (values ('1002'), ('1003'), ('1006'), ('1013'), ('1015'), ('1016'), ('1018'), ('1023')) n(num)
where exists (select 1 from public.empleados e where e.id = pg_temp.emp(n.num))
on conflict do nothing;

-- Limpieza por área: un solo día de chatarra fuera de su lugar el mes pasado
-- afecta a supervisor, ayudante y calidad (el objetivo compartido de verdad).
insert into public.objetivo_marcas (id, tipo, fecha, area_id, cumplio, nota, marcado_por, marcado_en)
select pg_temp.id('lim:' || a.nombre || ':' || d.fecha), 'limpieza', d.fecha, a.id,
  not (a.nombre = 'Chatarra' and d.fecha = (select min(x.fecha) from demo_dias x where x.fecha >= pg_temp.mes(-1) + 9)),
  case when a.nombre = 'Chatarra' and d.fecha = (select min(x.fecha) from demo_dias x where x.fecha >= pg_temp.mes(-1) + 9)
       then 'Chatarra fuera del contenedor junto a la puerta 2' end,
  pg_temp.perfil('gerente.produccion@hegamex.com'), d.fecha + time '17:40'
from demo_dias d cross join public.objetivo_areas a
where a.nombre in ('Pintura', 'Comedor', 'Plasma', 'Torno', 'Chatarra', 'Mesa de trabajo eléctrica', 'Almacén planta', 'Contenedores')
on conflict do nothing;

-- Vehículos: el encargado de almacén revisa al chofer.
insert into public.objetivo_marcas (id, tipo, fecha, empleado_id, cumplio, nota, marcado_por, marcado_en)
select pg_temp.id('veh:' || d.fecha), 'vehiculo', d.fecha, pg_temp.emp('1016'),
  extract(day from d.fecha)::int % 9 <> 4,
  case when extract(day from d.fecha)::int % 9 = 4 then 'Montacargas sin revisar nivel de aceite' end,
  pg_temp.perfil('almacen@hegamex.com'), d.fecha + time '08:20'
from demo_dias d
where exists (select 1 from public.empleados e where e.id = pg_temp.emp('1016'))
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Mes pasado: armado, calificado por cada jefe y en distintos estados
-- ---------------------------------------------------------------------------
do $$ begin perform pg_temp.como('rrhh@hegamex.com'); perform public.armar_evaluaciones(pg_temp.mes(-1)); end $$;

-- Cada jefe califica lo que no mide el sistema. Eléctrico (1015) y chofer
-- (1016) quedan por calificar; al ayudante (1006) le falta un indicador.
do $$
declare r record; h int; v_rrhh uuid := pg_temp.perfil('rrhh@hegamex.com');
begin
  for r in
    select x.id, x.regla, x.meta, x.sentido, x.escalones, x.parametros, e.evaluador_id, e.empleado_numero num, i.clave
    from public.objetivo_resultados x
    join public.objetivo_evaluaciones e on e.id = x.evaluacion_id
    join public.objetivo_indicadores i on i.id = x.indicador_id
    where e.mes = pg_temp.mes(-1) and e.estado = 'borrador' and x.calificacion is null
      and e.empleado_numero not in ('1015', '1016') and not (e.empleado_numero = '1006' and i.clave = 'cero_accidentes')
      and (x.medido_en is null)
  loop
    h := abs(hashtext(r.num || r.clave)) % 12;
    perform pg_temp.como_id(coalesce(r.evaluador_id, v_rrhh));
    case r.regla
      when 'meta' then
        perform public.capturar_resultado(r.id,
          case when h = 0 then (case when r.sentido = 'menor' then r.meta + 1 else greatest(r.meta - 1, 0) end) else r.meta end,
          null, null, case when h = 0 then 'No se cumplió este mes' end);
      when 'escalon' then
        perform public.capturar_resultado(r.id, (r.escalones->0->>'limite')::numeric, null, null, null);
      when 'descuento' then
        perform public.capturar_resultado(r.id, null, case when h % 3 = 0 then 1 else 0 end, null,
          case when h % 3 = 0 then 'Una incidencia en el mes, anotada en la orden' end);
      when 'una_incidencia' then
        perform public.capturar_resultado(r.id, null, 0, null, null);
      when 'llave' then
        perform public.capturar_resultado(r.id, null, 0, null, null);
      when 'proporcional' then
        perform public.capturar_resultado(r.id, coalesce((r.parametros->>'escala')::numeric, 10) - h % 3, null,
          coalesce((r.parametros->>'escala')::numeric, 10), case when h % 3 = 2 then 'Le falta avanzar en el plan del trimestre' end);
    end case;
  end loop;
end $$;

-- Calidad (1014) impugna el día de chatarra: la dejó el flete, no el taller. RRHH lo resolverá.
do $$
declare v_evid bigint; v_ev uuid;
begin
  select v.id, e.id into v_evid, v_ev
  from public.objetivo_evidencias v join public.objetivo_resultados r on r.id = v.resultado_id
  join public.objetivo_evaluaciones e on e.id = r.evaluacion_id
  where e.empleado_numero = '1014' and e.mes = pg_temp.mes(-1) and v.tipo = 'marca' and v.cuenta and v.impugnacion is null and e.estado = 'borrador'
  limit 1;
  if v_evid is not null then
    perform pg_temp.como('gerente.produccion@hegamex.com');
    perform public.impugnar_evidencia(v_evid, 'La chatarra la dejó el flete del proveedor de lámina, no el taller; está en la bitácora de recepción');
  end if;
end $$;

-- Enviar, revisar y aprobar según el caso.
do $$
declare r record;
begin
  for r in select e.id, e.empleado_numero num, e.evaluador_id from public.objetivo_evaluaciones e
           where e.mes = pg_temp.mes(-1) and e.estado = 'borrador' and e.empleado_numero in ('1001', '1014', '1017', '1018', '1023', '1026') loop
    perform pg_temp.como_id(r.evaluador_id);
    perform public.enviar_evaluacion(r.id);
  end loop;
  perform pg_temp.como('rrhh@hegamex.com');
  for r in select e.id from public.objetivo_evaluaciones e
           where e.mes = pg_temp.mes(-1) and e.estado = 'calificada' and e.empleado_numero in ('1001', '1017', '1023', '1026') loop
    perform public.revisar_evaluacion(r.id);
  end loop;
  perform pg_temp.como('direccion@hegamex.com');
  for r in select e.id from public.objetivo_evaluaciones e
           where e.mes = pg_temp.mes(-1) and e.estado = 'revisada' and e.empleado_numero in ('1001', '1023', '1026') loop
    perform public.aprobar_evaluacion(r.id);
  end loop;
  -- Un ajuste pendiente: RRHH pide corregir al supervisor; lo autoriza dirección.
  perform pg_temp.como('rrhh@hegamex.com');
  for r in select e.id, e.total from public.objetivo_evaluaciones e
           where e.mes = pg_temp.mes(-1) and e.estado = 'aprobada' and e.empleado_numero = '1001'
             and not exists (select 1 from public.objetivo_ajustes a where a.evaluacion_id = e.id) loop
    perform public.solicitar_ajuste_objetivo(r.id, least(100, r.total + 20),
      'Las dos órdenes tarde se movieron por cambio del cliente (correo del 18), no por el taller');
  end loop;
end $$;

-- Mes actual: borradores con lo automático medido a la fecha.
do $$ begin perform pg_temp.como('rrhh@hegamex.com'); perform public.armar_evaluaciones(pg_temp.mes(0)); end $$;

-- ---------------------------------------------------------------------------
-- Prenómina: sueldos, horas extra, conceptos y un préstamo
-- ---------------------------------------------------------------------------
do $$ begin perform pg_temp.como('rrhh@hegamex.com'); end $$;

-- Sueldo inicial de la ficha y algunos aumentos con su fecha (en la hoja vivían dentro de la fórmula).
insert into public.nomina_sueldos (id, empleado_id, sueldo_semanal, desde, motivo, registrado_por)
select pg_temp.id('sueldo-inicial:' || e.numero), e.id, round(d.salario_diario * 7, 2), e.fecha_ingreso,
  'Valor inicial tomado de la ficha (salario diario × 7)', pg_temp.perfil('rrhh@hegamex.com')
from public.empleados e join public.empleado_datos d on d.empleado_id = e.id
where e.numero between '1001' and '1028' and d.salario_diario is not null
  and not exists (select 1 from public.nomina_sueldos s where s.empleado_id = e.id)
on conflict do nothing;
insert into public.nomina_sueldos (id, empleado_id, sueldo_semanal, desde, motivo, registrado_por)
select pg_temp.id('aumento:' || x.num), pg_temp.emp(x.num),
  round(d.salario_diario * 7 * (1 + x.pct), 2), current_date - x.dias, x.motivo, pg_temp.perfil('rrhh@hegamex.com')
from (values ('1001', 0.06, 75, 'Aumento anual'), ('1002', 0.05, 40, 'Ajuste de sueldo por desempeño'),
             ('1017', 0.08, 120, 'Ajuste de sueldo: pasa a encargado de almacén'), ('1013', 0.04, 20, 'Aumento anual')) x(num, pct, dias, motivo)
join public.empleado_datos d on d.empleado_id = pg_temp.emp(x.num)
where not exists (select 1 from public.nomina_sueldos s where s.id = pg_temp.id('aumento:' || x.num))
on conflict do nothing;

-- Horas extra aprobadas en las últimas semanas (Martín pasa de 9: triples).
insert into public.incidencias (id, empleado_id, tipo, inicio, fin, horas, estado, motivo)
select pg_temp.id('hx:' || x.clave), pg_temp.emp(x.num), 'horas_extra', pg_temp.viernes(x.semana) + x.dia, pg_temp.viernes(x.semana) + x.dia,
  x.horas, 'aprobada', x.motivo
from (values
  ('martin-1', '1002', -1, 3, 4, 'Soldar refuerzos de la cribadora'),
  ('martin-2', '1002', -1, 4, 5, 'Soldar refuerzos de la cribadora'),
  ('martin-3', '1002', -1, 5, 3, 'Terminar banda para embarque'),
  ('ricardo-1', '1003', -1, 4, 3, 'Apoyo en pailería'),
  ('daniel-1', '1013', -1, 3, 6, 'Corte de lámina para dos tolvas'),
  ('daniel-2', '1013', -1, 5, 4, 'Corte de lámina para dos tolvas'),
  ('jorge-1', '1010', -2, 4, 5, 'Pintura de silo'),
  ('arturo-1', '1015', -2, 3, 2, 'Pruebas de tablero'),
  ('martin-4', '1002', 0, 3, 2, 'Ajustes de la dosificadora')
) x(clave, num, semana, dia, horas, motivo)
where exists (select 1 from public.empleados e where e.id = pg_temp.emp(x.num))
  and pg_temp.viernes(x.semana) + x.dia <= current_date
  and not exists (select 1 from public.incidencias i where i.id = pg_temp.id('hx:' || x.clave))
on conflict do nothing;

-- Conceptos variables (antes, notas de celda).
insert into public.nomina_movimientos (id, semana, empleado_id, concepto, importe, nota, referencia, registrado_por)
select pg_temp.id('mov:' || x.clave), pg_temp.viernes(x.semana), pg_temp.emp(x.num), x.concepto, x.importe, x.nota, x.ref,
  pg_temp.perfil('rrhh@hegamex.com')
from (values
  ('servicio-arturo', -1, '1015', 'servicio_fuera', 1200.00, 'Puesta en marcha de dosificadora en Lagos de Moreno', 'DEMO Agroindustrias del Bajío'),
  ('apoyo-hector', -1, '1012', 'apoyo', 250.00, 'Apoyo por ayuda en pintura', null),
  ('flete-sergio', -1, '1016', 'gratificacion_entrega', 400.00, 'Entrega de tolva en Tepatitlán', 'DEMO Granos Los Altos'),
  ('carta-juancarlos', -1, '1004', 'bono_carta', 300.00, 'Bono por cumplimiento de carta compromiso', null),
  ('ahorro-martin', -1, '1002', 'ahorro', 500.00, 'Caja de ahorro', null),
  ('ahorro-ricardo', -1, '1003', 'ahorro', 300.00, 'Caja de ahorro', null),
  ('herramienta-eduardo', -1, '1011', 'descuento_herramienta', 180.00, 'Pistola de pintura dañada; autorizó el jefe de taller', null),
  ('servicio-arturo-2', -2, '1015', 'servicio_fuera', 900.00, 'Levantamiento en Toluca', null),
  ('ahorro-martin-2', -2, '1002', 'ahorro', 500.00, 'Caja de ahorro', null),
  ('ahorro-martin-3', -3, '1002', 'ahorro', 500.00, 'Caja de ahorro', null),
  ('servicio-jose-0', 0, '1001', 'servicio_fuera', 800.00, 'Garantía en Veracruz', 'DEMO Fertilizantes del Pacífico')
) x(clave, semana, num, concepto, importe, nota, ref)
where exists (select 1 from public.empleados e where e.id = pg_temp.emp(x.num))
  and not exists (select 1 from public.nomina_movimientos m where m.id = pg_temp.id('mov:' || x.clave))
  and not exists (select 1 from public.nomina_semanas s where s.inicio = pg_temp.viernes(x.semana) and s.estado = 'cerrada')
on conflict do nothing;

-- Un préstamo que se descuenta 500 por semana desde hace tres semanas.
insert into public.nomina_prestamos (id, empleado_id, monto, descuento_semanal, primera_semana, motivo)
select pg_temp.id('prestamo:1008'), pg_temp.emp('1008'), 3000, 500, pg_temp.viernes(-3), 'Préstamo de caja chica para reparar su camioneta'
where exists (select 1 from public.empleados e where e.id = pg_temp.emp('1008'))
  and not exists (select 1 from public.nomina_prestamos p where p.id = pg_temp.id('prestamo:1008'));

-- Las dos semanas más viejas se cierran; la anterior queda lista para cerrar y la actual, en curso.
do $$
declare v date;
begin
  perform pg_temp.como('rrhh@hegamex.com');
  foreach v in array array[pg_temp.viernes(-3), pg_temp.viernes(-2)] loop
    if not exists (select 1 from public.nomina_semanas where inicio = v and estado = 'cerrada') then
      perform public.cerrar_semana_nomina(v);
    end if;
  end loop;
end $$;

commit;

select (select count(*) from public.puesto_asignaciones where nota = 'DEMO') as asignaciones_demo,
       (select count(*) from public.objetivo_marcas where marcado_en >= current_date - 70) as marcas,
       (select string_agg(estado || ' ' || n, ', ') from (select estado, count(*) n from public.objetivo_evaluaciones
          where mes = (date_trunc('month', current_date) - interval '1 month')::date group by estado) x) as mes_pasado,
       (select count(*) from public.nomina_semanas where estado = 'cerrada') as semanas_cerradas;

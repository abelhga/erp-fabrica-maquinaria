-- Objetivos, bonos y prenómina: lo que hacen cumplir la base y la RLS.
-- Cada regla con su caso "este rol NO debe poder". Se usa enero de 2025, un mes
-- sin datos en la base, para que lo medido dependa solo de lo que crea la prueba.
do $$
declare
  v_dir uuid; v_rrhh uuid; v_gp uuid; v_alm uuid; v_ven uuid; v_fin uuid; v_comp uuid;
  v_puesto int; v_plantilla uuid; v_art uuid; v_almacen int;
  e_sup uuid; e_comp uuid; e_aux uuid; e_rh uuid; e_x uuid;
  ev_sup uuid; ev_comp uuid; ev_rh uuid;
  r_manual uuid; r_exact uuid; r_cel uuid; v_evid bigint; v_ajuste uuid;
  v_n int; v_j jsonb; v_num numeric; r record; v_mes date := '2025-01-01'; v_semana date := '2025-01-10';
  v_viernes date := hoy_planta() - ((extract(isodow from hoy_planta())::int - 5 + 7) % 7);
begin
  v_dir := pg_temp.usuario('dir95@hegamex.com', '{direccion}');
  v_rrhh := pg_temp.usuario('rh95@hegamex.com', '{rrhh}');
  v_gp := pg_temp.usuario('gp95@hegamex.com', '{gerente_produccion}');
  v_alm := pg_temp.usuario('alm95@hegamex.com', '{almacen}');
  v_ven := pg_temp.usuario('ven95@hegamex.com', '{ventas}');
  v_fin := pg_temp.usuario('fin95@hegamex.com', '{finanzas}');
  v_comp := pg_temp.usuario('comp95@hegamex.com', '{compras}');
  select id into v_art from articulos order by clave limit 1;
  select id into v_almacen from almacenes order by id limit 1;

  -- Permisos nuevos tal como se pidieron.
  assert (select nivel from permisos_rol where rol = 'gerente_produccion' and modulo = 'objetivos') = 1, 'gerencia de producción: objetivos 1';
  assert (select nivel from permisos_rol where rol = 'finanzas' and modulo = 'nomina') = 1, 'finanzas: nómina 1';
  assert not exists (select 1 from permisos_rol where rol in ('ventas', 'almacen', 'gerente_produccion') and modulo = 'nomina'), 'nadie más tiene nómina';
  assert (select count(*) from objetivo_indicadores) = 61, 'los 61 indicadores de la hoja';
  assert (select count(*) from objetivo_indicadores where fuente = 'automatica') = 17, 'los 17 que ya se miden solos';
  assert not exists (select 1 from objetivo_plantillas t where (select sum(peso) from objetivo_plantilla_lineas l where l.plantilla_id = t.id) <> 100),
    'las plantillas sembradas suman 100';

  -- ---------------------------------------------------------------------------
  -- Plantillas: los pesos suman 100
  -- ---------------------------------------------------------------------------
  perform pg_temp.como(v_rrhh);
  insert into puestos (nombre) values ('Puesto de prueba 95') returning id into v_puesto;
  begin
    perform guardar_plantilla(jsonb_build_object('puesto_id', v_puesto, 'desde', v_mes, 'lineas', jsonb_build_array(
      jsonb_build_object('indicador_id', 61, 'peso', 50, 'regla', 'proporcional', 'parametros', '{"escala": 10}'::jsonb),
      jsonb_build_object('indicador_id', 60, 'peso', 40, 'regla', 'llave', 'llave_limite', 3))));
    assert false, 'guardó una plantilla que suma 90';
  exception when raise_exception then null;
  end;
  -- Aunque alguien escriba directo en las tablas, la base lo detiene al confirmar.
  begin
    insert into objetivo_plantillas (puesto_id, desde) values (v_puesto, v_mes) returning id into v_plantilla;
    insert into objetivo_plantilla_lineas (plantilla_id, indicador_id, peso, regla, llave_limite) values (v_plantilla, 60, 90, 'llave', 3);
    set constraints all immediate;
    assert false, 'la base aceptó pesos que suman 90';
  exception when check_violation then null;
  end;
  set constraints all deferred;
  v_plantilla := guardar_plantilla(jsonb_build_object('puesto_id', v_puesto, 'desde', v_mes, 'lineas', jsonb_build_array(
    jsonb_build_object('indicador_id', 61, 'peso', 50, 'regla', 'proporcional', 'parametros', '{"escala": 10}'::jsonb),
    jsonb_build_object('indicador_id', 45, 'peso', 30, 'regla', 'descuento', 'descuento', 10, 'parametros', jsonb_build_object('almacenes', jsonb_build_array(v_almacen))),
    jsonb_build_object('indicador_id', 60, 'peso', 20, 'regla', 'llave', 'llave_limite', 3))));
  set constraints all immediate;   -- esta sí pasa
  set constraints all deferred;
  perform pg_temp.como(v_gp);
  begin
    perform guardar_plantilla(jsonb_build_object('puesto_id', v_puesto, 'desde', '2025-02-01', 'lineas', '[]'::jsonb));
    assert false, 'un jefe editó plantillas';
  exception when insufficient_privilege then null;
  end;

  -- ---------------------------------------------------------------------------
  -- Personas, puestos y jefes. Nadie es su propio jefe.
  -- ---------------------------------------------------------------------------
  perform pg_temp.como(v_rrhh);
  insert into empleados (nombre, fecha_ingreso) values ('Supervisor Prueba95', '2023-01-02') returning id into e_sup;
  insert into empleados (nombre, fecha_ingreso, usuario_id) values ('Compradora Prueba95', '2023-01-02', v_comp) returning id into e_comp;
  insert into empleados (nombre, fecha_ingreso) values ('Auxiliar Prueba95', '2023-01-02') returning id into e_aux;
  insert into empleados (nombre, fecha_ingreso, usuario_id) values ('Rrhh Prueba95', '2023-01-02', v_rrhh) returning id into e_rh;
  begin
    insert into puesto_asignaciones (empleado_id, puesto_id, jefe_id, desde) values (e_comp, v_puesto, v_comp, '2024-12-01');
    assert false, 'alguien quedó como su propio jefe';
  exception when insufficient_privilege then null;
  end;
  insert into puesto_asignaciones (empleado_id, puesto_id, jefe_id, desde) values
    (e_sup, v_puesto, v_gp, '2024-12-01'), (e_comp, v_puesto, v_dir, '2024-12-01'),
    (e_aux, v_puesto, v_alm, '2024-12-01'), (e_rh, v_puesto, v_gp, '2024-12-01');
  begin
    insert into puesto_asignaciones (empleado_id, puesto_id, jefe_id, desde) values (e_sup, v_puesto, v_gp, '2025-01-15');
    assert false, 'dos puestos a la vez';
  exception when raise_exception then null;
  end;

  -- ---------------------------------------------------------------------------
  -- Checklist: 3 días sin entregar el celular (la llave). Nadie se marca solo.
  -- ---------------------------------------------------------------------------
  perform registrar_marca('celular', '2025-01-06', e_sup, null, 'entrada', false, 'Lo traía en la bolsa');
  perform registrar_marca('celular', '2025-01-07', e_sup, null, 'break1', false, null);
  perform registrar_marca('celular', '2025-01-08', e_sup, null, 'entrada', false, null);
  perform registrar_marca('celular', '2025-01-09', e_sup, null, 'entrada', true, null);
  perform registrar_marca('celular', '2025-01-10', e_sup, null, 'entrada', true, null);
  -- Corregir una marca deja rastro de lo que decía antes.
  perform registrar_marca('celular', '2025-01-10', e_sup, null, 'entrada', true, 'Revisado dos veces');
  assert (select anterior->>'cumplio' from objetivo_marcas where empleado_id = e_sup and fecha = '2025-01-10') = 'true', 'la corrección guarda la marca anterior';
  perform pg_temp.como(v_comp);
  begin
    perform registrar_marca('celular', hoy_planta(), e_comp, null, 'entrada', true, null);
    assert false, 'alguien se marcó a sí mismo';
  exception when insufficient_privilege then null;
  end;
  begin
    perform registrar_marca('celular', '2025-01-06', e_aux, null, 'entrada', true, null);
    assert false, 'un jefe marcó un día de hace meses (solo RRHH)';
  exception when raise_exception then null;
  end;
  perform pg_temp.como(v_ven);
  begin
    perform registrar_marca('celular', hoy_planta(), e_aux, null, 'entrada', true, null);
    assert false, 'ventas marcó el checklist';
  exception when insufficient_privilege then null;
  end;

  -- Dos errores de inventario en enero (medición automática con evidencia).
  perform pg_temp.como_postgres();
  insert into ajustes_inventario (folio, articulo_id, almacen_id, cantidad_sistema, cantidad_fisica, motivo, solicitado_por, solicitado_en) values
    ('AJU-P95-1', v_art, v_almacen, 10, 8, 'Conteo de prueba 95', v_alm, '2025-01-15 12:00-06'),
    ('AJU-P95-2', v_art, v_almacen, 5, 6, 'Conteo de prueba 95', v_alm, '2025-01-20 12:00-06');

  -- ---------------------------------------------------------------------------
  -- Armar el mes: solo RRHH o dirección
  -- ---------------------------------------------------------------------------
  perform pg_temp.como(v_gp);
  begin
    perform armar_evaluaciones(v_mes);
    assert false, 'un jefe armó el mes';
  exception when insufficient_privilege then null;
  end;
  perform pg_temp.como(v_rrhh);
  v_j := armar_evaluaciones(v_mes);
  assert (v_j->>'creadas')::int >= 4, format('armó las 4 evaluaciones: %s', v_j);
  select id into ev_sup from objetivo_evaluaciones where empleado_id = e_sup and mes = v_mes;
  select id into ev_comp from objetivo_evaluaciones where empleado_id = e_comp and mes = v_mes;
  select id into ev_rh from objetivo_evaluaciones where empleado_id = e_rh and mes = v_mes;
  select id into r_manual from objetivo_resultados where evaluacion_id = ev_sup and indicador_id = 61;
  select id into r_exact from objetivo_resultados where evaluacion_id = ev_sup and indicador_id = 45;
  select id into r_cel from objetivo_resultados where evaluacion_id = ev_sup and indicador_id = 60;

  -- Medición automática: 2 ajustes = 2 incidencias, cada una con su evidencia → 30 − 2 × 10.
  select * into r from objetivo_resultados where id = r_exact;
  assert r.incidencias = 2 and r.calificacion = 10, format('exactitud de inventario: %s', row_to_json(r));
  assert (select count(*) from objetivo_evidencias where resultado_id = r_exact and cuenta and folio like 'AJU-P95-%') = 2, 'la evidencia dice qué ajustes';
  -- La llave: 3 días sin entregar el celular → el bono total vale 0 aunque lo demás sume.
  select * into r from objetivo_evaluaciones where id = ev_sup;
  assert r.llave_activada and r.total = 0, format('llave → 0: %s', row_to_json(r));
  assert (select incidencias from objetivo_resultados where id = r_cel) = 3, 'tres días con falla';

  -- ---------------------------------------------------------------------------
  -- Un jefe ve solo a su gente; ventas nada; la persona, lo suyo
  -- ---------------------------------------------------------------------------
  perform pg_temp.como(v_gp);
  select count(*) into v_n from objetivo_evaluaciones where mes = v_mes;
  assert v_n = 2, format('gerencia de producción ve a sus 2 personas, vio %s', v_n);
  assert not exists (select 1 from objetivo_evaluaciones where id in (ev_comp)), 'el jefe vio a alguien que no es suyo';
  perform pg_temp.como(v_alm);
  select count(*) into v_n from objetivo_evaluaciones where mes = v_mes;
  assert v_n = 1, format('almacén ve a su única persona, vio %s', v_n);
  select count(*) into v_n from objetivo_resultados x join objetivo_evaluaciones e on e.id = x.evaluacion_id where e.empleado_id = e_sup;
  assert v_n = 0, 'almacén vio los resultados de alguien que no es suyo';
  perform pg_temp.como(v_ven);
  assert (select count(*) from objetivo_evaluaciones) = 0, 'ventas vio evaluaciones';
  assert (select count(*) from objetivo_marcas) = 0, 'ventas vio el checklist';
  perform pg_temp.como(v_fin);
  assert (select count(*) from objetivo_evaluaciones) = 0, 'finanzas vio evaluaciones';
  perform pg_temp.como(v_comp);
  select count(*) into v_n from v_objetivo_evaluaciones;
  assert v_n = 1 and (select es_mia from v_objetivo_evaluaciones), 'la persona ve solo la suya';
  assert (select count(*) from objetivo_resultados) = 3, 'y sus renglones, no los de otros';

  -- "Lo que importa hoy": el jefe ve lo que le toca; ventas, nada de objetivos.
  perform pg_temp.como(v_alm);
  assert exists (select 1 from hallazgos_objetivos('almacen') where titulo like '%espera tu calificación%'), 'el jefe no vio su pendiente';
  perform pg_temp.como(v_ven);
  assert not exists (select 1 from hallazgos_objetivos('ventas')), 'ventas vio hallazgos de objetivos';

  -- ---------------------------------------------------------------------------
  -- Calificar: el jefe sí; otro jefe no; la persona misma nunca
  -- ---------------------------------------------------------------------------
  perform pg_temp.como(v_alm);
  begin
    perform capturar_resultado(r_manual, 8, null, 10, 'Buen avance');
    assert false, 'almacén calificó a alguien que no es su gente';
  exception when insufficient_privilege then null;
  end;
  perform pg_temp.como(v_comp);
  begin
    perform capturar_resultado((select id from objetivo_resultados where evaluacion_id = ev_comp and indicador_id = 61), 10, null, 10, null);
    assert false, 'alguien se calificó a sí mismo';
  exception when insufficient_privilege then null;
  end;
  perform pg_temp.como(v_gp);
  begin
    perform capturar_resultado(r_exact, null, 0, null, 'No hubo errores');
    assert false, 'el jefe sobreescribió lo que mide el sistema';
  exception when raise_exception then null;
  end;
  -- Escribir directo en la tabla no hace nada: no hay política de escritura.
  update objetivo_resultados set calificacion = peso where id = r_exact;
  perform pg_temp.como_postgres();
  assert (select calificacion from objetivo_resultados where id = r_exact) = 10, 'el jefe cambió una calificación por fuera de las funciones';

  -- Tope: 12 de 10 no da 120 %; el renglón no pasa de su peso ni el total de 100.
  perform pg_temp.como(v_gp);
  perform capturar_resultado(r_manual, 12, null, 10, 'Superó lo pedido');
  assert (select calificacion from objetivo_resultados where id = r_manual) = 50, 'tope del renglón en su peso';
  perform pg_temp.como_postgres();
  begin
    update objetivo_resultados set calificacion = peso + 10 where id = r_manual;
    assert false, 'un renglón quedó arriba de su peso';
  exception when check_violation then null;
  end;
  begin
    update objetivo_evaluaciones set total = 109 where id = ev_sup;
    assert false, 'un total de 109 %';
  exception when check_violation then null;
  end;

  -- ---------------------------------------------------------------------------
  -- Impugnar: el jefe no borra la incidencia; la impugna con motivo y otra
  -- persona (RRHH) la resuelve.
  -- ---------------------------------------------------------------------------
  perform pg_temp.como(v_gp);
  select id into v_evid from objetivo_evidencias where resultado_id = r_cel and cuenta and fecha = '2025-01-07';
  delete from objetivo_evidencias where id = v_evid;
  perform pg_temp.como_postgres();
  assert exists (select 1 from objetivo_evidencias where id = v_evid), 'el jefe borró una incidencia';
  perform pg_temp.como(v_gp);
  begin
    perform impugnar_evidencia(v_evid, 'no');
    assert false, 'impugnó sin explicar';
  exception when raise_exception then null;
  end;
  perform impugnar_evidencia(v_evid, 'Ese día entregó el celular a su jefe en el comedor, hay testigo');
  begin
    perform resolver_impugnacion(v_evid, true, null);
    assert false, 'el jefe resolvió su propia impugnación';
  exception when insufficient_privilege then null;
  end;
  perform pg_temp.como(v_rrhh);
  perform resolver_impugnacion(v_evid, true, 'Confirmado con el registro de la entrada');
  select * into r from objetivo_evaluaciones where id = ev_sup;
  assert not r.llave_activada and r.total = 60, format('sin la llave: 50 + 10 + 0 = 60, quedó %s', row_to_json(r));

  -- ---------------------------------------------------------------------------
  -- Flujo: calificada (jefe) → revisada (RRHH) → aprobada (dirección)
  -- ---------------------------------------------------------------------------
  perform pg_temp.como(v_gp);
  perform enviar_evaluacion(ev_sup);
  begin
    perform revisar_evaluacion(ev_sup);
    assert false, 'el jefe revisó';
  exception when insufficient_privilege then null;
  end;
  perform pg_temp.como(v_rrhh);
  perform revisar_evaluacion(ev_sup);
  begin
    perform aprobar_evaluacion(ev_sup);
    assert false, 'RRHH aprobó (es de dirección)';
  exception when insufficient_privilege then null;
  end;
  perform pg_temp.como(v_dir);
  perform aprobar_evaluacion(ev_sup);
  assert (select estado from objetivo_evaluaciones where id = ev_sup) = 'aprobada', 'quedó aprobada';

  -- Aprobado = cerrado: nadie lo cambia, ni con las funciones ni por fuera.
  perform pg_temp.como(v_gp);
  begin
    perform capturar_resultado(r_manual, 5, null, 10, null);
    assert false, 'se calificó un mes cerrado';
  exception when raise_exception then null;
  end;
  perform pg_temp.como(v_rrhh);
  begin
    perform registrar_marca('celular', '2025-01-13', e_sup, null, 'entrada', false, null);
    assert false, 'se marcó el checklist de un mes ya calificado';
  exception when raise_exception then null;
  end;
  perform pg_temp.como_postgres();
  begin
    update objetivo_resultados set nota = 'cambio' where id = r_manual;
    assert false, 'se modificó un renglón de un mes cerrado';
  exception when insufficient_privilege then null;
  end;
  begin
    update objetivo_evaluaciones set total = 100 where id = ev_sup;
    assert false, 'se modificó un mes cerrado';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from objetivo_evaluaciones where id = ev_sup;
    assert false, 'se borró un mes cerrado';
  exception when insufficient_privilege then null;
  end;
  begin
    update objetivo_evidencias set cuenta = false where id = v_evid;
    assert false, 'se modificó la evidencia de un mes cerrado';
  exception when insufficient_privilege then null;
  end;

  -- Cada paso le avisó al siguiente (avisos de la 0071), sin montos.
  if objetivo_hay_avisos() then
    perform pg_temp.como_postgres();
    assert exists (select 1 from avisos where usuario_id = v_gp and tipo = 'objetivos_borrador'), 'el jefe supo que su borrador estaba listo';
    assert exists (select 1 from avisos where usuario_id = v_rrhh and tipo = 'objetivo_calificada'), 'RRHH supo que había que revisar';
    assert exists (select 1 from avisos where usuario_id = v_dir and tipo = 'objetivo_revisada'), 'dirección supo que había que aprobar';
    assert exists (select 1 from avisos where usuario_id = v_rrhh and tipo = 'objetivo_impugnacion'), 'RRHH supo de la impugnación';
    assert not exists (select 1 from avisos where tipo like 'objetivo%' and (cuerpo like '%$%' or titulo like '%$%')), 'un aviso de objetivos llevó montos';
  end if;

  -- El error se corrige con un ajuste que autoriza otra persona.
  perform pg_temp.como(v_rrhh);
  v_ajuste := solicitar_ajuste_objetivo(ev_sup, 80, 'Faltó contar la capacitación que dio en enero');
  begin
    perform resolver_ajuste_objetivo(v_ajuste, true, null);
    assert false, 'quien pidió el ajuste lo autorizó';
  exception when insufficient_privilege then null;
  end;
  perform pg_temp.como(v_dir);
  perform resolver_ajuste_objetivo(v_ajuste, true, 'De acuerdo');
  assert (select total_final from v_objetivo_evaluaciones where id = ev_sup) = 80, 'el ajuste corrige el total final';
  assert (select total from objetivo_evaluaciones where id = ev_sup) = 60, 'y el original queda como estaba';

  -- Nadie revisa ni aprueba lo suyo: RRHH tiene su propia evaluación.
  perform pg_temp.como(v_gp);
  perform capturar_resultado((select id from objetivo_resultados where evaluacion_id = ev_rh and indicador_id = 61), 9, null, 10, null);
  perform capturar_resultado((select id from objetivo_resultados where evaluacion_id = ev_rh and indicador_id = 60), null, 0, null, 'Nadie marcó el celular');
  perform enviar_evaluacion(ev_rh);
  perform pg_temp.como(v_rrhh);
  begin
    perform revisar_evaluacion(ev_rh);
    assert false, 'RRHH revisó su propia evaluación';
  exception when insufficient_privilege then null;
  end;

  -- ---------------------------------------------------------------------------
  -- Prenómina: horas extra dobles hasta 9, triples de la 10 en adelante
  -- ---------------------------------------------------------------------------
  perform pg_temp.como(v_rrhh);
  insert into empleados (nombre, fecha_ingreso) values ('Soldador Prueba95', '2023-01-02') returning id into e_x;
  insert into nomina_sueldos (empleado_id, sueldo_semanal, desde, motivo) values (e_x, 3500, '2025-01-01', 'Sueldo de prueba');
  insert into incidencias (empleado_id, tipo, inicio, fin, horas, estado, motivo) values
    (e_x, 'horas_extra', '2025-01-13', '2025-01-13', 12, 'aprobada', 'Embarque urgente');
  insert into incidencias (empleado_id, tipo, inicio, fin, estado, motivo) values
    (e_x, 'falta', '2025-01-14', '2025-01-14', 'aprobada', 'No se presentó');
  insert into nomina_prestamos (empleado_id, monto, descuento_semanal, primera_semana, motivo)
    values (e_x, 1000, 300, v_semana, 'Préstamo de prueba');
  select * into r from prenomina(v_semana) where empleado_id = e_x;
  assert r.horas_extra = 12 and r.horas_dobles = 9 and r.horas_triples = 3, format('9 dobles y 3 triples: %s', row_to_json(r));
  assert r.importe_dobles = 1125 and r.importe_triples = 562.5, format('62.50 por hora: 9 × 2 y 3 × 3, %s / %s', r.importe_dobles, r.importe_triples);
  assert r.dias_pagados = 6 and r.importe_dias = 3000, format('una falta: 6 días pagados, %s', row_to_json(r));
  assert r.prestamos = 300 and r.neto = 3000 + 1125 + 562.5 - 300, format('neto con el descuento del préstamo: %s', r.neto);
  assert exists (select 1 from unnest(r.avisos) a where a like '%3 triples (LFT art. 68)%'), format('avisa de las triples: %s', r.avisos);

  -- Nadie se autoriza un préstamo a sí mismo.
  begin
    insert into nomina_prestamos (empleado_id, monto, descuento_semanal, primera_semana, motivo) values (e_rh, 500, 100, v_semana, 'Para mí');
    assert false, 'RRHH se autorizó un préstamo';
  exception when insufficient_privilege then null;
  end;
  -- El historial de sueldos no se reescribe: sin política de cambio para nadie,
  -- y aunque se intente por fuera, el disparador lo detiene.
  update nomina_sueldos set sueldo_semanal = 9000 where empleado_id = e_x;
  perform pg_temp.como_postgres();
  assert (select sueldo_semanal from nomina_sueldos where empleado_id = e_x) = 3500, 'RRHH reescribió un sueldo';
  begin
    update nomina_sueldos set sueldo_semanal = 9000 where empleado_id = e_x;
    assert false, 'se reescribió un sueldo';
  exception when insufficient_privilege then null;
  end;
  perform pg_temp.como(v_rrhh);

  -- Cerrar la semana la congela.
  v_n := cerrar_semana_nomina(v_semana);
  assert v_n > 0, 'cerró con renglones';
  assert (select saldo from prestamos_nomina() where empleado_id = e_x) = 700, 'el préstamo baja su saldo al cerrar';
  begin
    insert into nomina_movimientos (semana, empleado_id, concepto, importe, nota) values (v_semana, e_x, 'apoyo', 100, 'Tarde');
    assert false, 'se agregó un concepto a una semana cerrada';
  exception when insufficient_privilege then null;
  end;
  perform pg_temp.como_postgres();
  begin
    update nomina_renglones set neto = 0 where semana = v_semana and empleado_id = e_x;
    assert false, 'se modificó una semana cerrada';
  exception when insufficient_privilege then null;
  end;
  perform pg_temp.como(v_rrhh);
  begin
    perform cerrar_semana_nomina(v_viernes);
    assert false, 'se cerró una semana que no ha terminado';
  exception when raise_exception then null;
  end;

  -- ---------------------------------------------------------------------------
  -- Montos: solo con nómina
  -- ---------------------------------------------------------------------------
  perform pg_temp.como(v_ven);
  assert (select count(*) from nomina_sueldos) = 0 and (select count(*) from nomina_renglones) = 0
     and (select count(*) from bono_bases) = 0 and (select count(*) from nomina_prestamos) = 0, 'ventas vio montos de nómina';
  begin
    perform * from prenomina(v_semana);
    assert false, 'ventas vio la prenómina';
  exception when insufficient_privilege then null;
  end;
  perform pg_temp.como(v_alm);
  assert (select count(*) from nomina_sueldos) = 0 and (select count(*) from nomina_renglones) = 0, 'almacén vio montos de nómina';
  begin
    perform * from bonos_objetivos(v_mes);
    assert false, 'almacén vio el bono en pesos';
  exception when insufficient_privilege then null;
  end;
  perform pg_temp.como(v_gp);
  begin
    perform * from prenomina(v_semana);
    assert false, 'un jefe con objetivos vio la prenómina';
  exception when insufficient_privilege then null;
  end;
  perform pg_temp.como(v_fin);
  assert (select count(*) from prenomina(v_semana)) > 0, 'finanzas ve la prenómina (nómina 1)';
  begin
    insert into nomina_movimientos (semana, empleado_id, concepto, importe) values (v_viernes, e_x, 'apoyo', 100);
    assert false, 'finanzas capturó en la prenómina';
  exception when insufficient_privilege then null;
  end;

  -- ---------------------------------------------------------------------------
  -- Sin base de bono no sale monto: el % aprobado y el aviso, nunca un monto inventado
  -- ---------------------------------------------------------------------------
  perform pg_temp.como(v_rrhh);
  select * into r from prenomina(v_viernes) where empleado_id = e_sup;
  assert r.bono_pct = 80 and r.bono_monto is null and r.bono_aviso = 'Falta definir la base del bono',
    format('sin base: %s / %s / %s', r.bono_pct, r.bono_monto, r.bono_aviso);
  assert r.total_percepciones = 0, 'sin sueldo ni base, nada se paga';
  assert (select monto from bonos_objetivos(v_mes) where evaluacion_id = ev_sup) is null, 'bonos_objetivos sin monto';
  insert into bono_bases (puesto_id, base_mensual, desde, nota) values (v_puesto, 1000, '2025-01-01', 'Base de prueba');
  select * into r from prenomina(v_viernes) where empleado_id = e_sup;
  assert r.bono_monto = 800 and r.bono_aviso is null, format('con base 1,000 y 80 %%: 800, salió %s', r.bono_monto);
end $$;

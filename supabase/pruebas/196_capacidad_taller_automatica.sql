-- La capacidad de un área automática sale de su gente: personas que entran a cuadrillas × horas de
-- la semana del taller × aprovechamiento, redondeada a 5. Se recalcula sola al mover gente o el
-- aprovechamiento; a mano solo si el área no es automática. Guardarlo no recalcula el costeo.
do $$
declare v_ger uuid; v_ven uuid; v_rh uuid; v_et int; e1 uuid; e2 uuid; e3 uuid; v_sem numeric; v_ok boolean; v_precios bigint;
begin
  v_ger := pg_temp.usuario('gp196@hegamex.com', '{gerente_produccion}');
  v_ven := pg_temp.usuario('ven196@hegamex.com', '{ventas}');
  v_rh := pg_temp.usuario('rh196@hegamex.com', '{rrhh}');
  v_sem := horas_semana_taller();
  insert into etapas (nombre, orden, capacidad_horas_semana, capacidad_automatica) values ('P196 Armado', 999, 40, true) returning id into v_et;
  assert (select capacidad_horas_semana from etapas where id = v_et) = 40, 'un área automática sin gente perdió su número';

  -- 1. Tres personas en el área: la capacidad se calcula sola.
  insert into empleados (nombre, fecha_ingreso, departamento_id, etapa_id, en_cuadrillas) values
    ('P196 Uno', current_date - 400, departamento_produccion(), v_et, true) returning id into e1;
  insert into empleados (nombre, fecha_ingreso, departamento_id, etapa_id, en_cuadrillas) values
    ('P196 Dos', current_date - 400, departamento_produccion(), v_et, true) returning id into e2;
  insert into empleados (nombre, fecha_ingreso, departamento_id, etapa_id, en_cuadrillas) values
    ('P196 Tres', current_date - 400, departamento_produccion(), v_et, true) returning id into e3;
  assert (select capacidad_horas_semana from etapas where id = v_et) = round(3 * v_sem * 0.85 / 5) * 5,
    format('con 3 personas: %s', (select capacidad_horas_semana from etapas where id = v_et));

  -- 2. La gerencia saca a uno de cuadrillas y cambia a otro de área: baja a una persona.
  perform pg_temp.como(v_ger);
  perform ajustar_personal_piso(e1, v_et, false);
  perform ajustar_personal_piso(e2, null, true);
  perform pg_temp.como_postgres();
  assert (select capacidad_horas_semana from etapas where id = v_et) = round(v_sem * 0.85 / 5) * 5, 'no se recalculó al mover gente';
  --    Una baja también cuenta; sin nadie, se queda con su último número.
  update empleados set activo = false, baja_en = current_date, motivo_baja = 'Renuncia' where id = e3;
  assert (select capacidad_horas_semana from etapas where id = v_et) = round(v_sem * 0.85 / 5) * 5, 'un área sin gente se quedó en cero';

  -- 3. El aprovechamiento: lo pone la gerencia (entre 50 y 100 %), ventas no. No recalcula el costeo.
  update empleados set activo = true, baja_en = null, motivo_baja = null where id = e3;
  select count(*) into v_precios from precios_lista;
  perform pg_temp.como(v_ven);
  begin perform fijar_aprovechamiento_taller(0.9); v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'ventas cambió el aprovechamiento';
  perform pg_temp.como(v_ger);
  begin perform fijar_aprovechamiento_taller(0.3); v_ok := true; exception when check_violation then v_ok := false; end;
  assert not v_ok, 'aceptó un aprovechamiento de 30 %';
  perform fijar_aprovechamiento_taller(1);
  perform pg_temp.como_postgres();
  assert (select capacidad_horas_semana from etapas where id = v_et) = round(v_sem / 5) * 5, 'no se recalculó con el aprovechamiento nuevo';
  assert (select count(*) from precios_lista) = v_precios, 'guardar el aprovechamiento recalculó el costeo';

  -- 4. A mano no, mientras sea automática; apagándola, sí; prendiéndola otra vez, vuelve a la cuenta.
  perform pg_temp.como(v_ger);
  begin update etapas set capacidad_horas_semana = 500 where id = v_et; v_ok := true; exception when check_violation then v_ok := false; end;
  assert not v_ok, 'se cambió a mano la capacidad de un área automática';
  perform fijar_capacidad_automatica(v_et, false);
  update etapas set capacidad_horas_semana = 500 where id = v_et;
  assert (select capacidad_horas_semana from etapas where id = v_et) = 500, 'no se pudo poner a mano con la automática apagada';
  perform fijar_capacidad_automatica(v_et, true);
  assert (select capacidad_horas_semana from etapas where id = v_et) = round(v_sem / 5) * 5, 'al prenderla no volvió a la cuenta';

  -- 5. Lo que enseña la pantalla: la ve producción; RRHH no; ventas no la cambia.
  assert (select personas = 1 and automatica and aprovechamiento = 1 from capacidad_taller() where etapa_id = v_et), 'capacidad_taller no cuadra';
  perform pg_temp.como(v_rh);
  begin perform capacidad_taller(); v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'RRHH vio la capacidad del taller';
  perform pg_temp.como(v_ven);
  begin perform fijar_capacidad_automatica(v_et, false); v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'ventas apagó la capacidad automática';
  perform pg_temp.como_postgres();
end $$;

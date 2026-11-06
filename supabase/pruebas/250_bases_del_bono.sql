-- Bases del bono (250): RRHH las captura por puesto o por persona, valen desde un mes, la de la
-- persona gana, y quien no tiene nómina ni las ve en la bitácora.
do $$
declare
  v_rrhh uuid; v_fin uuid; v_gp uuid; v_sis uuid; v_dir uuid;
  v_puesto int; e_a uuid; e_b uuid; v_id uuid; v_id2 uuid; v_n int;
begin
  v_rrhh := pg_temp.usuario('rh250@hegamex.com', '{rrhh}');
  v_fin := pg_temp.usuario('fin250@hegamex.com', '{finanzas}');
  v_gp := pg_temp.usuario('gp250@hegamex.com', '{gerente_produccion}');
  v_sis := pg_temp.usuario('sis250@hegamex.com', '{admin}');
  v_dir := pg_temp.usuario('dir250@hegamex.com', '{direccion}');
  insert into puestos (nombre) values ('Puesto de prueba 250') returning id into v_puesto;
  insert into empleados (nombre, fecha_ingreso) values ('Persona A 250', '2023-01-02') returning id into e_a;
  insert into empleados (nombre, fecha_ingreso) values ('Persona B 250', '2023-01-02') returning id into e_b;

  -- RRHH define la del puesto; una fecha a media mes se guarda como el día 1.
  perform pg_temp.como(v_rrhh);
  v_id := fijar_bono_base(v_puesto, null, 2000, '2025-03-15', 'Junta');
  assert (select desde from bono_bases where id = v_id) = '2025-03-01', 'la base no se guardó desde el día 1';
  -- bono_base() no es pública (la usan prenomina y bonos_objetivos): se revisa como postgres.
  perform pg_temp.como_postgres();
  assert bono_base(e_a, v_puesto, '2025-03-01') = 2000, 'marzo no tomó la base de marzo';
  assert bono_base(e_a, v_puesto, '2025-02-01') is null, 'febrero tomó una base que empieza en marzo';

  perform pg_temp.como(v_rrhh);
  -- Volver a capturar el mismo mes corrige, no duplica; otro mes deja la anterior para los meses de antes.
  v_id2 := fijar_bono_base(v_puesto, null, 2500, '2025-03-01', null);
  assert v_id2 = v_id and (select count(*) from bono_bases where puesto_id = v_puesto) = 1, 'el mismo mes se duplicó';
  perform fijar_bono_base(v_puesto, null, 3000, '2025-06-01', null);
  perform pg_temp.como_postgres();
  assert bono_base(e_a, v_puesto, '2025-05-01') = 2500 and bono_base(e_a, v_puesto, '2025-07-01') = 3000, 'el historial no respeta los meses';

  -- La de la persona gana sobre la de su puesto; a los demás les queda la del puesto.
  perform pg_temp.como(v_rrhh);
  perform fijar_bono_base(null, e_a, 4000, '2025-04-01', 'Encargado');
  perform pg_temp.como_postgres();
  assert bono_base(e_a, v_puesto, '2025-04-01') = 4000, 'no ganó la base de la persona';
  assert bono_base(e_b, v_puesto, '2025-04-01') = 2500, 'la base de una persona alcanzó a otra';
  perform pg_temp.como(v_rrhh);

  begin
    perform fijar_bono_base(v_puesto, e_a, 1000, '2025-04-01', null);
    assert false, 'se guardó una base de puesto y persona a la vez';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform fijar_bono_base(v_puesto, null, -1, '2025-04-01', null);
    assert false, 'se guardó una base negativa';
  exception when invalid_parameter_value then null;
  end;

  -- Queda en la bitácora: la ve dirección, no sistemas (rol admin: ve la bitácora pero no nómina).
  perform pg_temp.como(v_dir);
  assert (select count(*) from bitacora where tabla = 'bono_bases' and registro_id = v_id::text) >= 2, 'el cambio de base no quedó en la bitácora';
  perform pg_temp.como(v_sis);
  assert (select count(*) from bitacora where tabla = 'bono_bases') = 0, 'sistemas vio en la bitácora cuánto vale el bono';

  -- Finanzas ve (nómina 1) pero no captura; un jefe con objetivos ni ve ni captura.
  perform pg_temp.como(v_fin);
  assert (select count(*) from bono_bases where puesto_id = v_puesto) = 2, 'finanzas no ve las bases (nómina 1)';
  begin
    perform fijar_bono_base(v_puesto, null, 9999, '2025-08-01', null);
    assert false, 'finanzas capturó una base del bono';
  exception when insufficient_privilege then null;
  end;
  update bono_bases set base_mensual = 9999 where puesto_id = v_puesto;
  get diagnostics v_n = row_count;
  assert v_n = 0, 'finanzas cambió una base por fuera de la función';

  perform pg_temp.como(v_gp);
  assert (select count(*) from bono_bases) = 0, 'un jefe con objetivos vio cuánto vale el bono';
  begin
    perform fijar_bono_base(v_puesto, null, 1, '2025-08-01', null);
    assert false, 'un jefe con objetivos capturó una base';
  exception when insufficient_privilege then null;
  end;

  -- RRHH puede quitar una base capturada por error.
  perform pg_temp.como(v_rrhh);
  delete from bono_bases where empleado_id = e_a;
  perform pg_temp.como_postgres();
  assert bono_base(e_a, v_puesto, '2025-04-01') = 2500, 'sin su base propia no regresó a la del puesto';
end $$;

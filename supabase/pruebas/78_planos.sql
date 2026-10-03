-- Planos: un folio, revisiones A, B, C…, una sola vigente, y la orden de producción
-- se queda con la revisión con la que ingeniería la revisó.
do $$
declare v_ing uuid; v_ger uuid; v_vend uuid; v_alm uuid; v_eq uuid; v_doc uuid; v_rev uuid; v_op uuid; v_folio text; r record;
begin
  v_ing := pg_temp.usuario('ingenieria@hegamex.com', '{ingenieria}');
  v_ger := pg_temp.usuario('gerente.produccion@hegamex.com', '{gerente_produccion}');
  v_vend := pg_temp.usuario('isaac@hegamex.com', '{ventas}');
  v_alm := pg_temp.usuario('almacen@hegamex.com', '{almacen}');
  insert into articulos (clave, tipo, nombre) values ('T-PL-EQ', 'equipo', 'T Banda de planos 20 m') returning id into v_eq;

  assert siguiente_revision('A') = 'B' and siguiente_revision('Z') = 'AA' and siguiente_revision('AZ') = 'BA', 'letras de revisión';

  -- Solo ingeniería da de alta planos.
  perform pg_temp.como(v_vend);
  begin
    perform nuevo_documento_tecnico(v_eq, null, 'plano', 'Plano general', 'https://drive.google.com/file/d/x/view');
    assert false, 'un vendedor dio de alta un plano';
  exception when insufficient_privilege then null;
  end;

  perform pg_temp.como(v_ing);
  v_doc := nuevo_documento_tecnico(v_eq, null, 'plano', 'Plano general', 'https://drive.google.com/file/d/rev-a/view');
  select folio into v_folio from documentos_tecnicos where id = v_doc;
  assert v_folio ~ '^PL-\d{5}$', format('folio del ERP: %s', v_folio);
  begin
    perform nuevo_documento_tecnico(v_eq, null, 'plano', 'Liga mala', 'https://ejemplo.com/plano.pdf');
    assert false, 'aceptó una liga que no es de Drive';
  exception when check_violation then null;
  end;

  -- Un borrador no lo ve el taller ni ventas.
  perform pg_temp.como(v_alm);
  assert not exists (select 1 from documentos_tecnicos where id = v_doc), 'almacén vio un plano en borrador';

  perform pg_temp.como(v_ing);
  perform aprobar_documento(v_doc);
  perform pg_temp.como(v_alm);
  assert exists (select 1 from documentos_tecnicos where id = v_doc and estado = 'vigente'), 'almacén no ve el plano vigente';
  perform pg_temp.como(v_vend);
  assert exists (select 1 from documentos_tecnicos where id = v_doc), 'ventas no ve el plano vigente (para la ficha)';

  -- Un plano aprobado no se edita ni se borra.
  perform pg_temp.como_postgres();
  begin
    update documentos_tecnicos set drive_url = 'https://drive.google.com/file/d/otro/view' where id = v_doc;
    assert false, 'se editó un plano vigente';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from documentos_tecnicos where id = v_doc;
    assert false, 'se borró un plano vigente';
  exception when insufficient_privilege then null;
  end;

  -- Orden de producción: al revisarla ingeniería, se queda con la revisión A.
  insert into ordenes_produccion (articulo_id, cantidad) values (v_eq, 1) returning id into v_op;
  perform pg_temp.como(v_ger);
  assert exists (select 1 from v_planos_orden where orden_id = v_op and revision = 'A' and registrado_en is null), 'antes de revisar se ve el vigente';
  perform pg_temp.como_postgres();
  perform pg_temp.como(v_ing);
  perform revisar_orden(v_op, 'ingenieria');
  perform pg_temp.como_postgres();
  assert exists (select 1 from op_planos where orden_id = v_op and documento_id = v_doc), 'la orden no guardó su plano';

  -- Revisión B: obligatorio decir qué cambió; al aprobarla, A queda obsoleta y se avisa.
  perform pg_temp.como(v_ing);
  begin
    perform nueva_revision(v_doc, 'https://drive.google.com/file/d/rev-b/view', '  ');
    assert false, 'revisión sin decir qué cambió';
  exception when invalid_parameter_value then null;
  end;
  v_rev := nueva_revision(v_doc, 'https://drive.google.com/file/d/rev-b/view', 'Se alargó la cama 20 cm');
  assert (select revision from documentos_tecnicos where id = v_rev) = 'B', 'la siguiente es B';
  begin
    perform nueva_revision(v_doc, 'https://drive.google.com/file/d/rev-c/view', 'Otra');
    assert false, 'dos borradores del mismo folio';
  exception when raise_exception then null;
  end;
  perform aprobar_documento(v_rev);
  perform pg_temp.como_postgres();
  assert (select estado from documentos_tecnicos where id = v_doc) = 'obsoleto', 'A debió quedar obsoleta';
  assert (select count(*) from documentos_tecnicos where folio = v_folio and estado = 'vigente') = 1, 'una sola vigente por folio';
  -- El taller ve que su orden se revisó con A aunque A ya no sea visible por sí sola.
  perform pg_temp.como(v_alm);
  select * into r from v_planos_orden where orden_id = v_op;
  assert r.revision = 'A' and r.revision_vigente = 'B', 'la orden muestra que se revisó con A y ya va en B';
  perform pg_temp.como_postgres();
  assert exists (select 1 from avisos where usuario_id = v_ger and tipo = 'plano_cambio'), 'a producción no le avisaron que el plano cambió';
  perform pg_temp.como(v_ger);
  assert exists (select 1 from hallazgos('produccion') where titulo like '%plano que ya cambió%'), 'la gerencia no ve el hallazgo del plano que cambió';
  perform pg_temp.como_postgres();

  -- Lo obsoleto ya no lo ve el taller (para que nadie fabrique con él), ingeniería sí.
  perform pg_temp.como(v_alm);
  assert not exists (select 1 from documentos_tecnicos where id = v_doc), 'almacén ve un plano obsoleto';
  perform pg_temp.como(v_ing);
  assert exists (select 1 from documentos_tecnicos where id = v_doc), 'ingeniería no ve la historia';
  perform pg_temp.como_postgres();
end $$;

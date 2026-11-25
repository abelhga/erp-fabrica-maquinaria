-- Un hallazgo de la IA sobre un lead abre ese lead, no enseña el identificador interno, y si el lead
-- ya se convirtió le toca al vendedor (no a quien lo capturó).
do $$
declare v_rec uuid; v_ven uuid; v_l uuid; v_l2 uuid; v_corr bigint; h record;
begin
  v_rec := pg_temp.usuario('rec318@hegamex.com', '{recepcion}');
  v_ven := pg_temp.usuario('ven318@hegamex.com', '{ventas}');
  -- Al darse de alta la base reparte el lead sola; aquí se deja como quedaría después.
  insert into leads (nombre, telefono, interes) values ('Rubén 318', '5550000318', 'Dosificadora') returning id into v_l;
  insert into leads (nombre, telefono, interes) values ('Marco 318', '5550001318', 'Cribado') returning id into v_l2;
  update leads set vendedor_id = v_ven, capturado_por = v_rec, estado = 'convertido' where id = v_l;
  update leads set vendedor_id = null, capturado_por = v_rec where id = v_l2;
  insert into revision_corridas default values returning id into v_corr;
  perform revision_guardar_claude(v_corr, 'ventas', '', jsonb_build_array(
    jsonb_build_object('tabla', 'leads', 'ref', v_l::text, 'titulo', 'Lead convertido con empresa pendiente', 'detalle', 'x', 'para', 'responsable', 'gravedad', 'baja'),
    jsonb_build_object('tabla', 'leads', 'ref', v_l2::text, 'titulo', 'Lead sin ciudad', 'detalle', 'x', 'para', 'responsable', 'gravedad', 'baja')));

  select * into h from revision_hallazgos where registro_id = v_l::text;
  assert h.ruta = '/ventas/leads?id=' || v_l, format('no abre el lead: %s', h.ruta);
  assert h.responsables = array[v_ven], format('el convertido no le tocó al vendedor: %s', h.responsables);
  assert (h.evidencia->0->>'folio') is null, format('la evidencia enseña el número interno: %s', h.evidencia);
  select * into h from revision_hallazgos where registro_id = v_l2::text;
  assert h.responsables = array[v_rec], format('el lead sin convertir no le tocó a quien lo capturó: %s', h.responsables);
end $$;

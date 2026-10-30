-- El material de la orden trae su categoría, y lo urgente de la revisión nocturna también queda
-- como pendiente: contestar en un lado cierra el otro, y una falsa alarma no cuenta para nadie.
do $$
declare
  v_com uuid; v_com2 uuid; v_ven uuid; v_prov uuid; v_corr bigint; h uuid; h2 uuid; p uuid; v_ok boolean; v_msg text;
  c_el int; a_el uuid; a_eq uuid; v_op uuid; v_vence date;
begin
  v_com := pg_temp.usuario('com210@hegamex.com', '{compras}');
  v_com2 := pg_temp.usuario('com2210@hegamex.com', '{compras}');
  v_ven := pg_temp.usuario('ven210@hegamex.com', '{ventas}');

  -- 1. La categoría viaja con el material de la orden.
  insert into categorias (nombre) values ('Eléctricos R210') returning id into c_el;
  insert into articulos (clave, tipo, nombre, unidad, categoria_id) values ('R210-EL', 'componente', 'Contactor R210', 'pieza', c_el) returning id into a_el;
  insert into articulos (clave, tipo, nombre, unidad) values ('R210-EQ', 'equipo', 'Banda R210', 'pieza') returning id into a_eq;
  insert into ordenes_produccion (articulo_id, cantidad, estado) values (a_eq, 1, 'liberada') returning id into v_op;
  insert into op_materiales (orden_id, articulo_id, requerido) values (v_op, a_el, 2);
  assert (select categoria = 'Eléctricos R210' from v_op_material where orden_id = v_op and articulo_id = a_el), 'el material no trae su categoría';

  -- 2. Un pago repetido (urgente) y una compra atrasada (no urgente).
  insert into proveedores (nombre) values ('Aceros R210') returning id into v_prov;
  insert into movimientos_proveedor (proveedor_id, proveedor_llave, tipo, fecha, monto, registrado_por) values
    (v_prov, 'r210', 'pago', current_date - 1, 9100, v_com), (v_prov, 'r210', 'pago', current_date, 9100, v_com2);
  insert into ordenes_compra (folio, proveedor_id, estado, fecha, fecha_entrega, creado_por) values ('OC-R210-1', v_prov, 'enviada', current_date - 20, current_date - 5, v_com);
  insert into revision_corridas default values returning id into v_corr;
  perform revision_correr_reglas(v_corr);
  select id into h from revision_hallazgos where regla = 'pago_duplicado' and evidencia::text like '%9100%';
  select id into h2 from revision_hallazgos where regla = 'oc_vencida_sin_recibir' and titulo like 'OC-R210-1%';
  assert (select gravedad = 'alta' and responsables @> array[v_com, v_com2] from revision_hallazgos where id = h), 'el pago repetido no es urgente o no es de los dos';
  perform revision_terminar(v_corr, 0, 0);

  --    Lo urgente queda como pendiente de cada responsable, para el siguiente día hábil; lo demás no.
  v_vence := sumar_dias_laborables((now() at time zone 'America/Mexico_City')::date, 1);
  assert (select count(*) from pendientes where tabla = 'revision_hallazgos' and registro_id = h::text
            and vence = v_vence and creado_por is null and ruta = '/revision') = 2, 'el pago repetido no quedó como pendiente de los dos';
  assert not exists (select 1 from pendientes where tabla = 'revision_hallazgos' and registro_id = h2::text), 'lo no urgente quedó como pendiente';
  assert exists (select 1 from avisos where usuario_id = v_com and tipo = 'pendiente_nuevo' and cuerpo like 'De la revisión nocturna%'),
    'el aviso del pendiente no dice de dónde viene';
  --    Otra vez la misma corrida no los duplica.
  perform revision_crear_pendientes(v_corr);
  assert (select count(*) from pendientes where tabla = 'revision_hallazgos' and registro_id = h::text) = 2, 'se duplicaron los pendientes';

  -- 3. Desde Pendientes no se cambia ni se cancela: se marca hecho o se contesta en «Por revisar».
  select id into p from pendientes where tabla = 'revision_hallazgos' and registro_id = h::text and responsable_id = v_com;
  perform pg_temp.como(v_com);
  begin update pendientes set estado = 'cancelado' where id = p; v_ok := true; exception when insufficient_privilege then v_ok := false; v_msg := sqlerrm; end;
  assert not v_ok and v_msg like '%contéstalo en «Por revisar»%', format('se canceló desde Pendientes: %s', v_msg);
  begin update pendientes set vence = vence + 10 where id = p; v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'se cambió la fecha de un pendiente de la revisión';
  --    Otro no lo ve.
  perform pg_temp.como(v_ven);
  assert not exists (select 1 from pendientes where id = p), 'un vendedor ve el pendiente de compras';

  --    Marcarlo hecho es «Ya lo corregí»: el hallazgo se cierra y al otro responsable ya no le toca.
  perform pg_temp.como(v_com);
  update pendientes set estado = 'hecho', nota_cierre = 'Era el mismo pago; borré uno' where id = p;
  perform pg_temp.como_postgres();
  assert (select estado = 'corregido' and cerrado_por = v_com and respuesta = 'Era el mismo pago; borré uno' from revision_hallazgos where id = h),
    'marcar hecho el pendiente no cerró el hallazgo';
  assert (select estado = 'cubierto' and nota_cierre like 'Lo corrigió%' from pendientes
          where tabla = 'revision_hallazgos' and registro_id = h::text and responsable_id = v_com2), 'al otro responsable le siguió tocando';

  -- 4. «Está bien así» en «Por revisar» cancela el pendiente: una falsa alarma no cuenta para nadie.
  update revision_hallazgos set gravedad = 'alta' where id = h2;
  perform revision_crear_pendientes(v_corr);
  select id into p from pendientes where tabla = 'revision_hallazgos' and registro_id = h2::text;
  assert p is not null, 'no se creó el pendiente de la compra';
  perform pg_temp.como(v_com);
  perform revision_responder(h2, 'bien_asi', 'El proveedor avisó que llega el lunes');
  perform pg_temp.como_postgres();
  assert (select estado = 'cancelado' and nota_cierre like 'No era error: El proveedor%' from pendientes where id = p),
    '«Está bien así» no canceló el pendiente';

  -- 5. Lo que se corrige solo cierra su pendiente como hecho.
  insert into ordenes_compra (folio, proveedor_id, estado, fecha, fecha_entrega, creado_por) values ('OC-R210-2', v_prov, 'enviada', current_date - 40, current_date - 20, v_com);
  insert into oc_lineas (orden_compra_id, articulo_id, cantidad, costo_unitario) values ((select id from ordenes_compra where folio = 'OC-R210-2'), a_el, 1, 10);
  insert into revision_corridas default values returning id into v_corr;
  perform revision_correr_reglas(v_corr);
  select id into h from revision_hallazgos where regla = 'oc_vencida_sin_recibir' and titulo like 'OC-R210-2%';
  assert (select gravedad = 'alta' from revision_hallazgos where id = h), 'la compra de 20 días no salió urgente';
  perform revision_terminar(v_corr, 0, 0);
  update oc_lineas set recibido = 1 where orden_compra_id = (select id from ordenes_compra where folio = 'OC-R210-2');
  insert into revision_corridas default values returning id into v_corr;
  perform revision_correr_reglas(v_corr);
  assert (select estado = 'hecho' from pendientes where tabla = 'revision_hallazgos' and registro_id = h::text),
    'la compra recibida no cerró su pendiente';
end $$;

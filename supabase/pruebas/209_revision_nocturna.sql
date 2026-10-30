-- Revisión nocturna: las reglas encuentran errores de captura y patrones, cada quien ve solo lo
-- suyo, los patrones solo dirección, «Está bien así» los calla y «Corrígelo» solo hace lo que la
-- persona podría hacer a mano. Lo que Claude regresa se liga al registro con lo que sabe la base.
do $$
declare
  v_dir uuid; v_com uuid; v_ven uuid; v_ven2 uuid; v_alm uuid; v_rrhh uuid; v_gp uuid;
  a_viejo uuid; a_nuevo uuid; a_otro uuid; a_eq1 uuid; a_eq2 uuid; c_viejo uuid; c_nuevo uuid; c_nombre uuid;
  v_prov uuid; v_corr bigint; v_corr2 bigint; h_art uuid; h_cli uuid; h_pago uuid; h_caja uuid; h_t uuid; h uuid;
  v_et int; v_op uuid; v_operacion uuid; v_emp uuid; v_oc uuid; v_ok boolean; v_msg text; v_n int; v_cons uuid;
begin
  v_dir := pg_temp.usuario('dir209@hegamex.com', '{direccion}');
  v_com := pg_temp.usuario('com209@hegamex.com', '{compras}');
  v_ven := pg_temp.usuario('ven209@hegamex.com', '{ventas}');
  v_ven2 := pg_temp.usuario('ven2209@hegamex.com', '{ventas}');
  v_alm := pg_temp.usuario('alm209@hegamex.com', '{almacen}');
  v_rrhh := pg_temp.usuario('rh209@hegamex.com', '{rrhh}');
  v_gp := pg_temp.usuario('gp209@hegamex.com', '{gerente_produccion}');
  update perfiles set nombre = 'Prueba Doscientos Nueve Ventas' where id = v_ven;

  -- Datos: lo que capturó cada quien (la bitácora toma a la persona de la sesión).
  insert into articulos (clave, tipo, nombre, unidad) values ('R209-01', 'componente', 'Chumacera 1 1/2" de 4B pared UCF 208-24 r209', 'pieza')
    returning id into a_viejo;
  update articulos set creado_en = now() - interval '200 days' where id = a_viejo;
  perform set_config('request.jwt.claims', json_build_object('sub', v_com)::text, true);
  insert into articulos (clave, tipo, nombre, unidad) values ('R209-02', 'componente', 'Chumacera 1 1/2" de 4B pared SKF UCF 208-24 r209', 'pieza')
    returning id into a_nuevo;
  --    Mismo nombre salvo la medida: no es el mismo artículo.
  insert into articulos (clave, tipo, nombre, unidad) values ('R209-03', 'componente', 'Chumacera 1 1/4" de 4B pared UCF 208-24 r209', 'pieza')
    returning id into a_otro;
  --    Dos equipos casi iguales: las variantes se copian a propósito.
  insert into articulos (clave, tipo, nombre, unidad) values ('R209-E1', 'equipo', 'Tolva doble r209 de 7 metros cúbicos', 'pieza') returning id into a_eq1;
  insert into articulos (clave, tipo, nombre, unidad) values ('R209-E2', 'equipo', 'Tolva doble r209 de 7 metros cúbicos inoxidable', 'pieza') returning id into a_eq2;
  perform pg_temp.como_postgres();
  --    Sin saber quién lo dio de alta (una importación), le toca a compras.
  insert into articulos (clave, tipo, nombre, unidad) values ('R209-04', 'componente', 'Chumacera 1 1/2" de 4B pared UCF 208-24 r209 bis', 'pieza');

  insert into clientes (nombre, rfc, creado_por, vendedor_id) values ('Granos del Bajío R209', 'GBR090101AB1', v_ven2, v_ven2) returning id into c_viejo;
  update clientes set creado_en = now() - interval '90 days' where id = c_viejo;
  insert into clientes (nombre, rfc, creado_por, vendedor_id) values ('Granos Bajio R-209 SA', 'GBR090101AB1', v_ven, v_ven) returning id into c_nuevo;
  --    Un solo nombre de pila no basta para decir que son el mismo.
  insert into clientes (nombre, creado_por) values ('Rodrigazo', v_ven2);
  update clientes set creado_en = now() - interval '90 days' where nombre = 'Rodrigazo';
  insert into clientes (nombre, creado_por) values ('Rodrigazo', v_ven) returning id into c_nombre;

  insert into proveedores (nombre) values ('Aceros R209') returning id into v_prov;
  insert into movimientos_proveedor (proveedor_id, proveedor_llave, tipo, fecha, monto, registrado_por) values
    (v_prov, 'r209', 'pago', current_date - 2, 18500, v_com),
    (v_prov, 'r209', 'pago', current_date, 18500, v_com);

  insert into caja_chica (fecha, tipo, importe, concepto, registrado_por) values
    (current_date - 9, 'salida', -48.5, 'Hielo R209', v_alm), (current_date - 5, 'salida', -48.5, 'hielo r209', v_alm),
    (current_date - 1, 'salida', -48.5, 'Hielo  R209', v_alm);

  -- Tres etapas que la gerencia marcó terminadas sin pasar por la terminal (una orden cada una).
  insert into etapas (nombre, orden, capacidad_horas_semana, capacidad_automatica) values ('R209 Pailería', 997, 40, false) returning id into v_et;
  for v_n in 1..3 loop
    insert into ordenes_produccion (articulo_id, cantidad, estado) values (a_eq1, 1, 'en_proceso') returning id into v_op;
    insert into op_operaciones (orden_id, etapa_id, horas_estimadas, estado, fin) values (v_op, v_et, 10, 'terminada', now()) returning id into v_operacion;
    insert into op_eventos (orden_id, operacion_id, tipo, usuario_id) values (v_op, v_operacion, 'fin', v_gp);
  end loop;

  -- Una compra que debió llegar hace 10 días y no tiene entradas.
  insert into ordenes_compra (folio, proveedor_id, estado, fecha, fecha_entrega, creado_por) values ('OC-R209-2', v_prov, 'enviada', current_date - 20, current_date - 10, v_com)
    returning id into v_oc;
  insert into oc_lineas (orden_compra_id, articulo_id, cantidad, costo_unitario) values (v_oc, a_viejo, 4, 100);

  -- Una cuenta que captura sin estar ligada a su ficha, y su ficha libre.
  insert into empleados (nombre, fecha_ingreso, departamento_id) values ('Prueba Doscientos Nueve Ventas', current_date - 300, departamento_produccion())
    returning id into v_emp;

  -- 1. La corrida: cada regla saca lo suyo.
  insert into revision_corridas default values returning id into v_corr;
  perform revision_correr_reglas(v_corr);
  select id into h_art from revision_hallazgos where huella = 'articulo_duplicado:' || a_nuevo;
  assert h_art is not null, 'no salió el artículo repetido';
  assert (select responsables = array[v_com] and accion->>'tipo' = 'desactivar_articulo' and (accion->>'queda')::uuid = a_viejo
          from revision_hallazgos where id = h_art), 'el artículo repetido no fue a quien lo dio de alta con su corrección';
  assert not exists (select 1 from revision_hallazgos where huella in ('articulo_duplicado:' || a_otro, 'articulo_duplicado:' || a_eq2)),
    'salió como repetido un artículo de otra medida o una variante de equipo';
  assert not exists (select 1 from revision_hallazgos where array_position(responsables, null) is not null), 'quedó un responsable vacío';
  assert (select responsables @> array[v_com] from revision_hallazgos
          where huella = 'articulo_duplicado:' || (select id from articulos where clave = 'R209-04')), 'el artículo sin quién lo dio de alta no fue a compras';
  select id into h_cli from revision_hallazgos where huella = 'cliente_duplicado:' || c_nuevo;
  assert (select responsables = array[v_ven] from revision_hallazgos where id = h_cli), 'el cliente repetido no fue a su vendedor';
  assert not exists (select 1 from revision_hallazgos where huella = 'cliente_duplicado:' || c_nombre), 'un nombre de pila salió como cliente repetido';
  select id into h_pago from revision_hallazgos where regla = 'pago_duplicado' and evidencia::text like '%18500%' and responsables @> array[v_com];
  assert h_pago is not null, 'no salió el pago repetido';
  select id into h_caja from revision_hallazgos where regla = 'caja_chica_repetida' and titulo ilike '%hielo%r209%';
  assert (select para = 'direccion' and responsables = '{}' from revision_hallazgos where id = h_caja), 'el gasto repetido no quedó solo para dirección';
  assert (select responsables @> array[v_gp] and jsonb_array_length(evidencia) = 3 from revision_hallazgos
          where huella = 'etapas_sin_tiempos:' || to_char(current_date, 'IYYY-IW')), 'no salieron las etapas terminadas sin tiempos';
  select id into h_t from revision_hallazgos where huella = 'oc_vencida_sin_recibir:' || v_oc || ':' || (current_date - 10);
  assert (select responsables = array[v_com] from revision_hallazgos where id = h_t), 'no salió la compra atrasada';

  -- 2. Otra noche igual no repite nada.
  select count(*) into v_n from revision_hallazgos where estado = 'abierto';
  insert into revision_corridas default values returning id into v_corr2;
  perform revision_correr_reglas(v_corr2);
  assert (select count(*) from revision_hallazgos where estado = 'abierto') = v_n, 'la segunda noche repitió hallazgos';

  -- 3. Cada quien ve lo suyo; los patrones, solo dirección.
  perform pg_temp.como(v_ven);
  assert exists (select 1 from revision_hallazgos where id = h_cli), 'el vendedor no ve su cliente repetido';
  assert not exists (select 1 from revision_hallazgos where id in (h_art, h_caja, h_pago)), 'el vendedor ve hallazgos que no son suyos';
  perform pg_temp.como(v_ven2);
  assert not exists (select 1 from revision_hallazgos where id = h_cli), 'otro vendedor ve el cliente repetido de su compañero';
  perform pg_temp.como(v_alm);
  assert not exists (select 1 from revision_hallazgos where id = h_caja), 'almacén ve un patrón de caja chica';
  assert not exists (select 1 from revision_corridas), 'almacén ve las corridas';
  perform pg_temp.como(v_dir);
  assert (select count(*) from revision_hallazgos where id in (h_art, h_cli, h_pago, h_caja, h_t)) = 5, 'dirección no ve todo';

  -- 4. Contestar: solo el responsable (o dirección).
  perform pg_temp.como(v_ven2);
  begin perform revision_responder(h_cli, 'bien_asi'); v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'otro vendedor contestó un hallazgo ajeno';
  perform pg_temp.como(v_ven);
  perform revision_responder(h_cli, 'bien_asi', 'Son dos sucursales');
  begin perform revision_responder(h_cli, 'corregido'); v_ok := true; exception when others then v_ok := false; end;
  assert not v_ok, 'se contestó dos veces';
  --    «Está bien así» lo calla para siempre.
  perform pg_temp.como_postgres();
  insert into revision_corridas default values returning id into v_corr2;
  perform revision_correr_reglas(v_corr2);
  assert (select count(*) from revision_hallazgos where huella = 'cliente_duplicado:' || c_nuevo) = 1, 'volvió a salir lo que estaba bien así';

  -- 5. «Corrígelo» hace lo que la persona podría hacer a mano, nada más.
  --    Con existencias no se inhabilita: hay que pasarlas primero.
  insert into existencias (articulo_id, almacen_id, cantidad) values (a_nuevo, (select min(id) from almacenes), 2);
  perform pg_temp.como(v_com);
  begin perform revision_responder(h_art, 'corregir'); v_ok := true; exception when others then v_ok := false; v_msg := sqlerrm; end;
  assert not v_ok and v_msg like '%tiene existencias%', format('se inhabilitó un artículo con existencias: %s', v_msg);
  perform pg_temp.como_postgres();
  delete from existencias where articulo_id = a_nuevo;
  --    Un vendedor que fuera responsable no puede inhabilitar artículos.
  update revision_hallazgos set responsables = array[v_com, v_ven] where id = h_art;
  perform pg_temp.como(v_ven);
  begin perform revision_responder(h_art, 'corregir'); v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'un vendedor inhabilitó un artículo desde la revisión';
  perform pg_temp.como(v_com);
  v_msg := revision_responder(h_art, 'corregir');
  perform pg_temp.como_postgres();
  assert (select not activo from articulos where id = a_nuevo) and (select activo from articulos where id = a_viejo), 'no se inhabilitó el repetido';
  assert (select estado = 'corregido' and cerrado_por = v_com from revision_hallazgos where id = h_art), 'el hallazgo no quedó corregido';
  --    Sin corrección definida, «Corrígelo» no hace nada.
  perform pg_temp.como(v_com);
  begin perform revision_responder(h_pago, 'corregir'); v_ok := true; exception when others then v_ok := false; end;
  assert not v_ok, 'se «corrigió» un pago sin corrección definida';
  perform pg_temp.como_postgres();

  -- 6. Ligar la cuenta a su ficha es de Recursos Humanos.
  insert into bitacora (tabla, registro_id, accion, usuario_id) values ('clientes', c_nuevo::text, 'cambio', v_ven);
  insert into revision_corridas default values returning id into v_corr2;
  perform revision_correr_reglas(v_corr2);
  select id into h from revision_hallazgos where huella = 'usuario_sin_ficha:' || v_ven;
  assert (select (accion->>'empleado')::uuid = v_emp and responsables @> array[v_rrhh] from revision_hallazgos where id = h),
    'no se propuso ligar la cuenta del vendedor a su ficha';
  perform pg_temp.como(v_dir);
  begin perform revision_aplicar_accion((select accion from revision_hallazgos where id = h)); v_ok := true; exception when others then v_ok := false; end;
  assert not v_ok, 'se pudo llamar la corrección directo';
  perform pg_temp.como(v_rrhh);
  perform revision_responder(h, 'corregir');
  perform pg_temp.como_postgres();
  assert (select usuario_id = v_ven from empleados where id = v_emp), 'no se ligó la cuenta';

  -- 7. Lo que mide un estado se cierra solo cuando se corrige.
  update oc_lineas set recibido = 4 where orden_compra_id = v_oc;
  insert into revision_corridas default values returning id into v_corr2;
  perform revision_correr_reglas(v_corr2);
  assert (select estado = 'resuelto' from revision_hallazgos where id = h_t), 'la compra recibida siguió abierta en la revisión';
  --    Un hecho no: el pago repetido espera respuesta aunque no cambie nada.
  assert (select estado = 'abierto' from revision_hallazgos where id = h_pago), 'el pago repetido se cerró solo';

  -- 8. Lo que regresa Claude se liga con lo que sabe la base, no con lo que Claude escribe.
  insert into ordenes_compra (folio, proveedor_id, estado, fecha, creado_por) values ('OC-R209-1', v_prov, 'enviada', current_date, v_com)
    returning id into v_oc;
  v_n := revision_guardar_claude(v_corr, 'compras', 'Día tranquilo; una compra con notas raras.', jsonb_build_array(
    jsonb_build_object('titulo', 'La OC-R209-1 dice «urgente» pero entrega en 3 meses', 'detalle', 'Revisa la fecha.', 'para', 'responsable',
                       'tabla', 'ordenes_compra', 'ref', 'OC-R209-1', 'gravedad', 'media'),
    jsonb_build_object('titulo', 'Algo sin registro', 'detalle', 'No dice de qué.', 'para', 'responsable', 'tabla', 'pedidos', 'ref', 'NO-EXISTE')));
  assert v_n = 2, format('Claude: se guardaron %s', v_n);
  assert (select responsables = array[v_com] and ruta = '/compras/ordenes/' || v_oc and origen = 'claude'
          from revision_hallazgos where titulo like 'La OC-R209-1%'), 'el hallazgo de Claude no fue a quien hizo la OC';
  assert (select para = 'direccion' and responsables = '{}' from revision_hallazgos where titulo = 'Algo sin registro'),
    'lo que no se encontró no fue a dirección';
  assert (select lecturas->>'compras' like 'Día tranquilo%' from revision_corridas where id = v_corr), 'no se guardó la lectura del módulo';
  --    La noche siguiente no se repite.
  assert revision_guardar_claude(v_corr2, 'compras', '', jsonb_build_array(jsonb_build_object('titulo', 'Otra vez la OC-R209-1', 'detalle', '.',
           'para', 'responsable', 'tabla', 'ordenes_compra', 'ref', 'OC-R209-1'))) = 0, 'Claude repitió un hallazgo abierto';

  -- 9. Al terminar avisa a cada quien una vez, sin el detalle de los patrones.
  perform revision_terminar(v_corr, 0, 0);
  assert exists (select 1 from avisos where usuario_id = v_com and tipo = 'revision' and ruta = '/revision'), 'compras no recibió su aviso';
  assert not exists (select 1 from avisos where usuario_id = v_alm and tipo = 'revision'), 'almacén recibió aviso de un patrón';
  perform revision_terminar(v_corr, 0, 0);
  assert (select count(*) from avisos where usuario_id = v_com and tipo = 'revision') = 1, 'avisó dos veces';

  -- 10. Consejos: cada quien los suyos, y solo opina sobre los suyos.
  perform revision_guardar_consejos(v_corr, v_ven, jsonb_build_array(
    jsonb_build_object('tema', 'experimento', 'titulo', 'Llama a la mitad', 'texto', 'Dos semanas: a la mitad de tus cotizaciones llámales el primer día.',
                       'por_que', 'Solo 2 de 52 tuvieron llamada.', 'experimento', 'Compara cuántas cierran de cada mitad.')));
  select id into v_cons from consejos where usuario_id = v_ven;
  perform pg_temp.como(v_ven2);
  assert not exists (select 1 from consejos where id = v_cons), 'un vendedor ve los consejos de otro';
  begin perform consejo_opinar(v_cons, false); v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'un vendedor opinó sobre el consejo de otro';
  perform pg_temp.como(v_ven);
  perform consejo_opinar(v_cons, true);
  assert (select opinion = 'util' from consejos where id = v_cons), 'no se guardó la opinión';

  -- 11. Lo de la noche no lo corre nadie con sesión (solo pg_cron y la función de Supabase).
  begin perform revision_noche(); v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'un vendedor corrió la revisión';
  begin perform revision_datos_noche(); v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'un vendedor leyó los datos que van a Claude';
  begin perform revision_correr_ahora(); v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'un vendedor corrió la revisión a mano';
  begin perform revision_configurar('{"activa": false}'); v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'un vendedor apagó la revisión';
  perform pg_temp.como(v_dir);
  perform revision_configurar('{"claude": false, "reglas": {"caja_chica_repetida": false}, "modelo": "otro"}');
  perform pg_temp.como_postgres();
  assert (select valor->>'claude' = 'false' and valor->>'modelo' = 'claude-opus-5-5' from configuracion where clave = 'revision_nocturna'),
    'la configuración no quedó como debía (el modelo no se cambia desde la pantalla)';
  assert (select not activa from revision_reglas where clave = 'caja_chica_repetida'), 'no se apagó la regla';
  --    Con Claude apagado la corrida se anota así y no manda nada.
  v_corr2 := revision_noche();
  assert (select claude_estado = 'apagado' and termino_en is null from revision_corridas where id = v_corr2), 'la noche no quedó «apagado»';
  perform revision_recoger_disparar();
  assert (select termino_en is not null from revision_corridas where id = v_corr2), 'la vuelta de la mañana no cerró la corrida';
end $$;

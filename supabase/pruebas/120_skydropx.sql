-- Skydropx: el destino por campos se valida y se le queda al contacto, la guía generada
-- deja el envío igual que la captura a mano (estado, costo en el saldo, PDF), y lo que
-- registra la función de borde solo lo hace quien puede capturar envíos.
do $$
declare
  v_alm uuid; v_vend uuid; v_vend2 uuid; v_comp uuid; v_jefe uuid;
  v_cos uuid; v_cli uuid; v_cto uuid; v_ped uuid; v_env uuid; v_sky int;
  v_antes numeric; r record; j jsonb;
  v_dest jsonb := '{"cp": "45130", "estado": "Jalisco", "municipio": "Zapopan", "colonia": "Centro", "calle": "Av. Prueba 120",
                    "referencia": "Portón negro", "empresa": "T120 Granja", "correo": "Compras@Granja.mx",
                    "destinatario": "T120 Encargado", "telefono": "33 1234 5678"}';
begin
  v_alm := pg_temp.usuario('almacen@hegamex.com', '{almacen}');
  v_vend := pg_temp.usuario('susana@hegamex.com', '{ventas}');
  v_vend2 := pg_temp.usuario('juan@hegamex.com', '{ventas}');
  v_comp := pg_temp.usuario('compras@hegamex.com', '{compras}');
  v_jefe := pg_temp.usuario('gerente.ventas@hegamex.com', '{gerente_ventas}');
  select id into v_sky from paqueterias where nombre = 'Skydropx';
  assert v_sky is not null and (select usa_saldo from paqueterias where id = v_sky), 'Skydropx es paquetería de saldo';

  insert into articulos (clave, tipo, nombre, paquete_kg, paquete_largo_cm, paquete_ancho_cm, paquete_alto_cm, paquete_piezas)
  values ('T120-COS', 'componente', 'T120 Cosedora', 13, 38, 62, 29, 1) returning id into v_cos;
  insert into movimientos_inventario (tipo, articulo_id, almacen_id, cantidad, motivo)
  values ('inicial', v_cos, (select id from almacenes where nombre = 'Planta Baja'), 5, 'T120');
  insert into clientes (nombre, razon_social, estado, ciudad, vendedor_id) values ('T120 Granja', 'T120 Granja SA', 'Jalisco', 'Zapopan', v_vend) returning id into v_cli;
  insert into contactos (cliente_id, nombre, telefono, domicilio, principal)
  values (v_cli, 'T120 Encargado', '3311112222', 'Av. Prueba 120, Zapopan', true) returning id into v_cto;
  insert into pedidos (cliente_id, vendedor_id) values (v_cli, v_vend) returning id into v_ped;
  insert into pedido_lineas (pedido_id, orden, articulo_id, titulo, cantidad, precio_unitario) values (v_ped, 1, v_cos, 'T120 Cosedora', 1, 3500);

  perform pg_temp.como(v_vend);
  v_env := pedir_envio(v_ped, 'paqueteria');

  -- Lo que se prellena: sin dirección por campos todavía, sale lo del cliente.
  j := destino_envio(v_env);
  assert j->>'estado' = 'Jalisco' and j->>'municipio' = 'Zapopan' and j->>'empresa' = 'T120 Granja SA' and not (j->>'capturado')::boolean,
    format('prellenado desde el cliente: %s', j);

  -- ===========================================================================
  -- El destino por campos: se valida y se le queda al contacto.
  -- ===========================================================================
  begin
    perform guardar_destino_envio(v_env, v_dest || '{"cp": "4513"}');
    assert false, 'se aceptó un CP de 4 números';
  exception when others then if sqlerrm not like '%5 números%' then raise; end if;
  end;
  begin
    perform guardar_destino_envio(v_env, v_dest - 'colonia');
    assert false, 'se aceptó sin colonia';
  exception when others then if sqlerrm not like '%colonia%' then raise; end if;
  end;
  begin
    perform guardar_destino_envio(v_env, v_dest || '{"destinatario": "Un nombre larguísimo que no cabe en la guía"}');
    assert false, 'se aceptó un nombre que Skydropx corta';
  exception when others then if sqlerrm not like '%30 letras%' then raise; end if;
  end;
  begin
    perform guardar_destino_envio(v_env, v_dest || '{"telefono": "12345"}');
    assert false, 'se aceptó un teléfono de 5 números';
  exception when others then if sqlerrm not like '%10 números%' then raise; end if;
  end;

  -- Juan (otro vendedor) no ve el envío de Susana; compras no captura envíos.
  perform pg_temp.como(v_vend2);
  begin
    perform guardar_destino_envio(v_env, v_dest);
    assert false, 'Juan cambió el destino de un envío de Susana';
  exception when insufficient_privilege then null;
  end;
  assert destino_envio(v_env) is null, 'Juan vio la dirección de un envío que no es suyo';
  perform pg_temp.como(v_comp);
  begin
    perform guardar_destino_envio(v_env, v_dest);
    assert false, 'compras capturó un destino';
  exception when insufficient_privilege then null;
  end;

  -- Almacén sí (genera guías sin ver la ficha del cliente).
  perform pg_temp.como(v_alm);
  perform guardar_destino_envio(v_env, v_dest);
  perform registrar_cotizacion_skydropx(v_env, 'cot-1');
  select * into r from v_envios where id = v_env;
  assert r.dest_cp = '45130' and r.telefono = '3312345678' and r.dest_correo = 'compras@granja.mx' and r.destinatario = 'T120 Encargado'
     and r.destino like 'Av. Prueba 120%Col. Centro, 45130 Zapopan, Jalisco%Portón negro' and r.skydropx_cotizacion_id = 'cot-1',
    format('destino guardado: %s', row_to_json(r));
  perform pg_temp.como_postgres();
  select * into r from contactos where id = v_cto;
  assert r.domicilio_cp = '45130' and r.domicilio_colonia = 'Centro' and r.domicilio_calle = 'Av. Prueba 120' and r.telefono = '3311112222',
    format('la dirección no se le quedó al contacto (y el teléfono que tenía no se pisa): %s', row_to_json(r));

  -- Otra colonia es otra cotización: la anterior ya no sirve para generar.
  perform pg_temp.como(v_alm);
  perform guardar_destino_envio(v_env, v_dest || '{"colonia": "Las Águilas"}');
  assert (select skydropx_cotizacion_id from envios where id = v_env) is null, 'cambió la dirección y se quedó la cotización vieja';
  -- El siguiente envío al mismo contacto ya sale lleno.
  perform pg_temp.como_postgres();
  update envios set dest_cp = null, dest_colonia = null, dest_calle = null where id = v_env;
  perform pg_temp.como(v_alm);
  j := destino_envio(v_env);
  assert j->>'cp' = '45130' and j->>'colonia' = 'Las Águilas' and j->>'calle' = 'Av. Prueba 120', format('prellenado desde el contacto: %s', j);
  perform guardar_destino_envio(v_env, v_dest);

  -- ===========================================================================
  -- La guía de Skydropx: queda como la de siempre y se descuenta del saldo.
  -- ===========================================================================
  perform pg_temp.como_postgres();
  select saldo into v_antes from saldos_paqueteria_todas() where paqueteria_id = v_sky;
  perform pg_temp.como(v_alm);
  perform registrar_envio_skydropx(v_env, 'sky-1');
  begin
    perform registrar_envio_skydropx(v_env, 'sky-2');
    assert false, 'se pidió otra guía a Skydropx con una pendiente';
  exception when others then if sqlerrm not like '%revísala%' then raise; end if;
  end;
  begin
    perform registrar_guia_skydropx(v_env, 'sky-1', '7701', array['envios/' || v_env || '/no-subida.pdf'], 245.5, 'FedEx · Express');
    assert false, 'se registró una guía cuyo PDF no se subió';
  exception when others then if sqlerrm not like '%no se subió%' then raise; end if;
  end;
  perform pg_temp.como_postgres();
  insert into storage.objects (bucket_id, name) values ('envios', 'envios/' || v_env || '/sky-1.pdf'), ('envios', 'envios/' || v_env || '/sky-1-b.pdf');
  perform pg_temp.como(v_comp);
  begin
    perform registrar_guia_skydropx(v_env, 'sky-1', '7701', array['envios/' || v_env || '/sky-1.pdf'], 245.5, 'FedEx · Express');
    assert false, 'compras registró una guía';
  exception when insufficient_privilege then null;
  end;
  perform pg_temp.como(v_alm);
  perform registrar_guia_skydropx(v_env, 'sky-1', '7701', array['envios/' || v_env || '/sky-1.pdf', 'envios/' || v_env || '/sky-1-b.pdf'],
    245.5, 'FedEx · Express', 'https://fedex.com/t/7701');
  select * into r from v_envios where id = v_env;
  assert r.estado = 'guia_lista' and r.numero_guia = '7701' and r.costo_real = 245.5 and r.paqueteria = 'Skydropx'
     and r.servicio = 'FedEx · Express' and r.rastreo_url = 'https://fedex.com/t/7701' and r.guia_por_nombre is not null,
    format('guía de Skydropx: %s', row_to_json(r));
  assert (select count(*) from evidencias_envio where envio_id = v_env and tipo = 'guia') = 2, 'las dos etiquetas quedaron como guía';
  perform pg_temp.como_postgres();
  assert (select saldo from saldos_paqueteria_todas() where paqueteria_id = v_sky) = coalesce(v_antes, 0) - 245.5, 'la guía no se descontó del saldo';
  perform pg_temp.como(v_alm);
  begin
    perform guardar_destino_envio(v_env, v_dest);
    assert false, 'se cambió el destino con la guía ya impresa';
  exception when others then if sqlerrm not like '%ya tiene guía%' then raise; end if;
  end;

  -- La configuración es de quien administra envíos.
  perform pg_temp.como(v_alm);
  begin
    perform fijar_config_skydropx('{"carta_porte": "24112700"}');
    assert false, 'almacén cambió la configuración de Skydropx';
  exception when insufficient_privilege then null;
  end;
  perform pg_temp.como(v_jefe);
  begin
    perform fijar_config_skydropx('{"carta_porte": "2411"}');
    assert false, 'se aceptó una carta porte de 4 números';
  exception when others then if sqlerrm not like '%8 números%' then raise; end if;
  end;
  perform fijar_config_skydropx('{"carta_porte": "24112700", "origen_plantilla_id": "pl-1", "origen": {"postal_code": "47775"}}');
  j := (select valor from configuracion where clave = 'skydropx');
  assert j->>'carta_porte' = '24112700' and j->>'tipo_empaque' = '4G' and j->'origen'->>'postal_code' = '47775', format('configuración: %s', j);

  -- Sin sesión (anon) nada de esto se puede llamar.
  perform pg_temp.como_postgres();
  assert not has_function_privilege('anon', 'registrar_guia_skydropx(uuid, text, text, text[], numeric, text, text)', 'execute'), 'anon registra guías';
  assert not has_function_privilege('anon', 'destino_envio(uuid)', 'execute'), 'anon lee direcciones';
end $$;

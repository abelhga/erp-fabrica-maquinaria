-- Ventas: privacidad entre vendedores, autorización de precios bajo mínimo,
-- cotización → pedido y comisiones iguales a las de la hoja de Isaac.
do $$
declare
  v_isaac uuid; v_juan uuid; v_gerente uuid; v_prod uuid;
  v_cli_isaac uuid; v_cli_juan uuid; v_banda uuid; v_polea uuid;
  v_cot uuid; v_cot_juan uuid; v_ped uuid; v_n int; v_num numeric; v_txt text; r record;
begin
  v_isaac := pg_temp.usuario('isaac@hegamex.com', '{ventas}');
  v_juan := pg_temp.usuario('juan@hegamex.com', '{ventas}');
  v_gerente := pg_temp.usuario('gerente@hegamex.com', '{gerente_ventas}');
  v_prod := pg_temp.usuario('taller@hegamex.com', '{produccion}');

  -- Catálogo con precio: banda $202,000; polea $1,050 (componente, piso ≈ 9.09 %).
  insert into articulos (clave, tipo, nombre, categoria_id) values ('E-315', 'equipo', 'Banda cargadora 18" x 13 m',
    (select id from categorias where nombre = 'Banda Transportadora')) returning id into v_banda;
  insert into articulos (clave, tipo, nombre) values ('C-POL', 'componente', 'Polea 8"') returning id into v_polea;
  insert into costos_articulo (articulo_id, costo) values (v_polea, 735);
  insert into bom_lineas (padre_id, hijo_id, cantidad) values (v_banda, v_polea, 91345.69 / 735);
  assert (select precio from precios_lista where articulo_id = v_banda) = 202000, 'precio de la banda';

  -- Cada vendedor da de alta su cliente con su contacto.
  perform pg_temp.como(v_isaac);
  insert into clientes (nombre, vendedor_id) values ('Concretos del Bajío', v_isaac) returning id into v_cli_isaac;
  insert into contactos (cliente_id, nombre, telefono, principal) values (v_cli_isaac, 'Ing. Pérez', '3311111111', true);
  perform pg_temp.como(v_juan);
  insert into clientes (nombre, vendedor_id) values ('Agregados del Norte', v_juan) returning id into v_cli_juan;
  insert into contactos (cliente_id, nombre, telefono) values (v_cli_juan, 'Lic. Gómez', '8122222222');

  -- Juan ve que el cliente de Isaac existe (para no duplicarlo) pero NO su teléfono.
  select count(*) into v_n from clientes where id = v_cli_isaac;
  assert v_n = 1, 'Juan debería ver que el cliente de Isaac existe';
  select count(*) into v_n from contactos where cliente_id = v_cli_isaac;
  assert v_n = 0, 'Juan NO debería ver los contactos del cliente de Isaac';
  -- …y no puede cambiarle nada.
  update clientes set notas = 'mío' where id = v_cli_isaac;
  get diagnostics v_n = row_count;
  assert v_n = 0, 'Juan pudo editar el cliente de Isaac';

  -- Cotización de Isaac: folio automático, totales con IVA.
  perform pg_temp.como(v_isaac);
  insert into cotizaciones (cliente_id) values (v_cli_isaac) returning id into v_cot;
  select folio into v_txt from cotizaciones where id = v_cot;
  assert v_txt ~ '^COT-\d{4}-\d{5}$', format('folio con formato inesperado: %s', v_txt);
  insert into cotizacion_lineas (cotizacion_id, orden, articulo_id, titulo, cantidad, precio_unitario, precio_lista)
  values (v_cot, 1, v_banda, 'Banda cargadora', 1, 202000, 202000),
         (v_cot, 2, v_polea, 'Polea 8"', 4, 1050, 1050),
         (v_cot, 3, null, 'Flete a Querétaro', 1, 8500, null),
         (v_cot, 4, v_polea, 'Polea 8" (alternativa)', 10, 1050, 1050);
  update cotizacion_lineas set opcional = true where cotizacion_id = v_cot and orden = 4;
  -- 202,000 + 4,200 + 8,500 = 214,700 (la alternativa no suma) → con IVA 249,052
  select subtotal into v_num from cotizaciones where id = v_cot;
  assert v_num = 214700, format('subtotal esperado 214,700, salió %s', v_num);
  assert (select total from cotizaciones where id = v_cot) = 249052, 'total con IVA';

  -- Juan no ve la cotización de Isaac.
  perform pg_temp.como(v_juan);
  select count(*) into v_n from cotizaciones where id = v_cot;
  assert v_n = 0, 'Juan ve cotizaciones de Isaac';
  select count(*) into v_n from cotizacion_lineas where cotizacion_id = v_cot;
  assert v_n = 0, 'Juan ve partidas de cotizaciones de Isaac';

  -- Precio de la polea a $900 (14 % abajo, el piso es ~9 %): pide autorización.
  perform pg_temp.como(v_isaac);
  update cotizacion_lineas set precio_unitario = 900 where cotizacion_id = v_cot and orden = 2;
  select estado::text into v_txt from cotizaciones where id = v_cot;
  assert v_txt = 'por_autorizar', format('bajo el mínimo debía quedar por_autorizar, quedó %s', v_txt);
  begin
    update cotizaciones set estado = 'enviada' where id = v_cot;
    assert false, 'se envió una cotización bajo el mínimo sin autorización';
  exception when insufficient_privilege then null;
  end;
  -- El vendedor no se puede autorizar solo.
  begin
    perform autorizar_cotizacion(v_cot);
    assert false, 'el vendedor se autorizó a sí mismo';
  exception when insufficient_privilege then null;
  end;
  perform pg_temp.como(v_gerente);
  perform autorizar_cotizacion(v_cot);
  perform pg_temp.como(v_isaac);
  update cotizaciones set estado = 'enviada' where id = v_cot;
  assert (select enviada_en from cotizaciones where id = v_cot) is not null, 'fecha de envío';

  -- Un descuento general del 3 % (dentro del piso de la banda) no pide autorización nueva…
  -- …pero la polea a $900 sigue bajo mínimo y cambiar el descuento invalida la autorización anterior.
  -- Aceptada → pedido con una llamada.
  v_ped := convertir_a_pedido(v_cot, current_date + 45);
  select count(*) into v_n from pedido_lineas where pedido_id = v_ped;
  assert v_n = 3, format('el pedido debía llevar 3 partidas (sin la opcional), lleva %s', v_n);
  select linea::text into v_txt from pedido_lineas where pedido_id = v_ped and articulo_id = v_banda;
  assert v_txt = 'maquinaria', 'la banda cuenta como maquinaria';
  select linea::text into v_txt from pedido_lineas where pedido_id = v_ped and articulo_id is null;
  assert v_txt = 'otros', 'el flete cuenta como otros';
  assert (select estado::text from cotizaciones where id = v_cot) = 'aceptada', 'la cotización quedó aceptada';
  begin
    perform convertir_a_pedido(v_cot);
    assert false, 'se generó un segundo pedido de la misma cotización';
  exception when others then
    if sqlerrm not like '%ya tiene pedido%' then raise; end if;
  end;

  -- Producción ve el pedido (de ahí sale su trabajo), Juan no.
  perform pg_temp.como(v_prod);
  select count(*) into v_n from pedidos where id = v_ped;
  assert v_n = 1, 'producción debería ver el pedido';
  perform pg_temp.como(v_juan);
  select count(*) into v_n from pedidos where id = v_ped;
  assert v_n = 0, 'Juan ve pedidos de Isaac';

  -- ---------------------------------------------------------------------------
  -- Comisiones: septiembre 2026 de Isaac en la hoja = 57,140 + 10,000 + 6,400 = 73,540
  -- (maquinaria $2,857,000 → 2 %; meta ≥ $2M → $10,000; refacciones $160k–$320k → $6,400)
  -- ---------------------------------------------------------------------------
  perform pg_temp.como_postgres();
  insert into vendedor_plan values (v_isaac, (select id from planes_comision where nombre like 'General%'));
  delete from pedidos;
  insert into pedidos (cliente_id, vendedor_id, fecha) values (v_cli_isaac, v_isaac, '2026-09-10') returning id into v_ped;
  insert into pedido_lineas (pedido_id, titulo, cantidad, precio_unitario, linea) values
    (v_ped, 'Equipos del mes', 1, 2857000, 'maquinaria'),
    (v_ped, 'Refacciones del mes', 1, 170000, 'refacciones');
  -- Un pedido de agosto no cuenta en septiembre.
  insert into pedidos (cliente_id, vendedor_id, fecha) values (v_cli_isaac, v_isaac, '2026-08-31') returning id into v_ped;
  insert into pedido_lineas (pedido_id, titulo, cantidad, precio_unitario, linea) values (v_ped, 'Agosto', 1, 999999, 'maquinaria');

  perform pg_temp.como(v_isaac);
  select * into r from comisiones_mes('2026-09-01') where vendedor_id = v_isaac;
  assert r.comision = 57140, format('comisión 2 %%: esperaba 57,140, salió %s', r.comision);
  assert r.bono_meta = 10000, format('bono meta: esperaba 10,000, salió %s', r.bono_meta);
  assert r.bono_refacciones = 6400, format('bono refacciones: esperaba 6,400, salió %s', r.bono_refacciones);
  assert r.siguiente_meta = 5000000, 'siguiente meta';

  -- Crédito compartido 50/50 con Juan: a Isaac le toca la mitad.
  perform pg_temp.como_postgres();
  insert into vendedor_plan values (v_juan, (select id from planes_comision where nombre like 'General%'));
  insert into pedido_vendedores select id, v_isaac, 50 from pedidos where fecha = '2026-09-10';
  insert into pedido_vendedores select id, v_juan, 50 from pedidos where fecha = '2026-09-10';
  perform pg_temp.como(v_isaac);
  select * into r from comisiones_mes('2026-09-01') where vendedor_id = v_isaac;
  assert r.venta_maquinaria = 1428500, format('con crédito 50 %% esperaba 1,428,500, salió %s', r.venta_maquinaria);
  -- Isaac solo ve su propia comisión.
  select count(*) into v_n from comisiones_mes('2026-09-01');
  assert v_n = 1, format('Isaac ve comisiones de %s vendedores', v_n);
end $$;

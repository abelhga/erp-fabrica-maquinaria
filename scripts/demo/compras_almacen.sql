-- =============================================================================
-- Datos de demostración para compras y almacén (base LOCAL, nunca producción).
--
--   psql "$DB_URL" -f scripts/demo/compras_almacen.sql
--
-- Sirve mientras no lleguen los datos reales de las hojas. Todo lleva clave o
-- legacy_id "DEMO-" para distinguirlo y se puede correr varias veces: lo que ya
-- existe no se duplica.
--
-- Los movimientos se hacen con las mismas funciones que usa la app
-- (registrar_salida, traspasar, recibir_orden_compra, solicitar_ajuste,
-- cerrar_conteo…), actuando como el usuario que lo haría (almacen@, compras@,
-- gerente.produccion@, finanzas@). El único insert directo a movimientos es el
-- saldo "inicial", que es lo que hará la importación. Por eso todo queda con
-- fecha de hoy: la historia de consumo para el reabasto la trae la importación.
--
-- Requiere los usuarios de scripts/usuarios-locales.mjs.
-- =============================================================================
-- Fecha "real" de cada precio de la historia DEMO: cada artículo con su propio
-- día para que el historial no se vea en bloque; algunos con más de 6 meses sin
-- actualizar (los que caen en el filtro "costo viejo").
create or replace function pg_temp.fecha_demo(p_clave text, p_anios_atras int) returns timestamptz
language sql immutable as $f$
  select (current_date - (p_anios_atras * 365 + 9 + (ascii(right(p_clave, 1)) * 7 + length(p_clave) * 13) % 150
           + case when p_clave in ('DEMO-CHU-206', 'DEMO-CAN-65', 'DEMO-ROD-RET', 'DEMO-MOT-2', 'DEMO-CAD-40', 'DEMO-GRA-125', 'DEMO-AER-OLI')
                  then 200 else 0 end))::timestamp + interval '10 hours'
$f$;

do $$
declare
  v_comp uuid; v_alm uuid; v_ger uuid; v_fin uuid;
  v_pb int; v_mall int; v_pa int; v_c1 int; v_c2 int; v_rev int; v_ml int;
  v_oc uuid; v_req uuid; v_conteo uuid; v_aj uuid; v_l uuid;
  k int; v_costo numeric;
  -- Proveedores: legacy, nombre, razón social, categoría, país, importación, moneda, crédito, entrega (días hábiles), contacto, teléfono, correo
  provs constant text[][] := array[
    ['DEMO-PROV-ROD', 'Rodamientos y Transmisiones del Bajío', 'Rodamientos y Transmisiones del Bajío S.A. de C.V.', 'Rodamientos y transmisión', 'México', 'f', 'MXN', '30', '3', 'Laura Medina', '33 3811 4520', 'ventas@rodamientosbajio.mx'],
    ['DEMO-PROV-TAP', 'Tapco Inc.', 'Tapco Inc.', 'Cangilones', 'Estados Unidos', 't', 'USD', '0', '45', 'Export desk', '+1 314 739 9191', 'export@tapcoinc.example'],
    ['DEMO-PROV-BAN', 'Bandas y Hules Industriales de Occidente', 'Bandas y Hules Industriales de Occidente S.A. de C.V.', 'Bandas transportadoras', 'México', 'f', 'MXN', '15', '7', 'Ramón Íñiguez', '33 3650 2210', 'ramon@bandasyhules.mx'],
    ['DEMO-PROV-ACE', 'Aceros y Láminas de Jalisco', 'Aceros y Láminas de Jalisco S.A. de C.V.', 'Acero', 'México', 'f', 'MXN', '30', '2', 'Mostrador', '33 3145 9900', 'pedidos@acerosjalisco.mx'],
    ['DEMO-PROV-NGB', 'Ningbo Gearmotor Co.', 'Ningbo Gearmotor Co., Ltd.', 'Motorreductores', 'China', 't', 'USD', '0', '60', 'Kevin Zhang', '+86 574 8790 1234', 'sales@ningbogearmotor.example'],
    ['DEMO-PROV-FER', 'Ferretería Industrial Atotonilco', 'Ferretería Industrial Atotonilco S.A. de C.V.', 'Ferretería y consumibles', 'México', 'f', 'MXN', '0', '1', 'Don Chuy', '391 917 0455', 'ferreteria.atotonilco@example.mx'],
    ['DEMO-PROV-MOT', 'Motores Eléctricos de Guadalajara', 'Motores Eléctricos de Guadalajara S.A. de C.V.', 'Motores', 'México', 'f', 'MXN', '30', '5', 'Sergio Lara', '33 3619 7788', 'slara@motoresgdl.mx'],
    ['DEMO-PROV-RDL', 'Rodillos Transportadores del Norte', 'Rodillos Transportadores del Norte S.A. de C.V.', 'Rodillos', 'México', 'f', 'MXN', '15', '10', 'Ventas', '81 8340 1122', 'ventas@rodillosnorte.mx']
  ];
  -- Artículos: clave, nombre, tipo, unidad, proveedor (legacy), costo, moneda, entrega propia, importado, empaque, seguridad, años de historial, alza anual
  arts constant text[][] := array[
    ['DEMO-CHU-205', 'Chumacera de piso 1" UCP 205-16', 'componente', 'pieza', 'DEMO-PROV-ROD', '185', 'MXN', '', 'f', '1', '', '3', '0.07'],
    ['DEMO-CHU-206', 'Chumacera de pared 1 1/4" UCF 206-20', 'componente', 'pieza', 'DEMO-PROV-ROD', '260', 'MXN', '', 'f', '1', '', '3', '0.06'],
    ['DEMO-CHU-208', 'Chumacera de piso 1 1/2" UCP 208-24', 'componente', 'pieza', 'DEMO-PROV-ROD', '410', 'MXN', '', 'f', '1', '4', '2', '0.08'],
    ['DEMO-CAN-43', 'Cangilón 4x3 azul, marca Tapco', 'componente', 'pieza', 'DEMO-PROV-TAP', '2.10', 'USD', '', 't', '50', '48', '3', '0.05'],
    ['DEMO-CAN-54', 'Cangilón 5x4 azul, marca Tapco', 'componente', 'pieza', 'DEMO-PROV-TAP', '2.85', 'USD', '', 't', '50', '', '3', '0.05'],
    ['DEMO-CAN-65', 'Cangilón 6x5 azul, marca Tapco', 'componente', 'pieza', 'DEMO-PROV-TAP', '3.60', 'USD', '', 't', '50', '', '3', '0.06'],
    ['DEMO-TOR-CAN', 'Tornillo p/cangilón 1/4 x 1 1/4 galv.', 'componente', 'pieza', 'DEMO-PROV-FER', '1.85', 'MXN', '', 'f', '100', '100', '2', '0.10'],
    ['DEMO-ROD-418', 'Rodillo de carga 4" x 18" con balero', 'componente', 'pieza', 'DEMO-PROV-RDL', '420', 'MXN', '', 'f', '1', '', '2', '0.09'],
    ['DEMO-ROD-RET', 'Rodillo de retorno 4" x 24"', 'componente', 'pieza', 'DEMO-PROV-RDL', '465', 'MXN', '', 'f', '1', '', '2', '0.09'],
    ['DEMO-LAM-14', 'Lámina negra cal. 14 de 4x8', 'materia_prima', 'hoja', 'DEMO-PROV-ACE', '1280', 'MXN', '', 'f', '1', '', '3', '0.12'],
    ['DEMO-LAM-12', 'Lámina negra cal. 12 de 4x10', 'materia_prima', 'hoja', 'DEMO-PROV-ACE', '2050', 'MXN', '', 'f', '1', '', '3', '0.11'],
    ['DEMO-ANG-114', 'Ángulo 1/4 x 1 1/2" (tramo de 6 m)', 'materia_prima', 'tramo', 'DEMO-PROV-ACE', '640', 'MXN', '', 'f', '1', '', '3', '0.10'],
    ['DEMO-PTR-2', 'PTR 2x2 cal. 11 (tramo de 6 m)', 'materia_prima', 'tramo', 'DEMO-PROV-ACE', '780', 'MXN', '', 'f', '1', '', '1', '0.10'],
    ['DEMO-BAN-18', 'Banda grip top 2 capas 18" de ancho', 'componente', 'metro', 'DEMO-PROV-BAN', '1150', 'MXN', '', 'f', '1', '', '2', '0.06'],
    ['DEMO-BAN-24', 'Banda lisa 3 capas 24" de ancho', 'componente', 'metro', 'DEMO-PROV-BAN', '1420', 'MXN', '', 'f', '1', '', '2', '0.06'],
    ['DEMO-GRA-125', 'Grapas RS 125 de 24" Flexco (caja)', 'componente', 'caja', 'DEMO-PROV-BAN', '4300', 'MXN', '', 'f', '1', '', '1', '0.04'],
    ['DEMO-MR-15', 'Motorreductor 1.5 HP relación 40:1 (importado)', 'componente', 'pieza', 'DEMO-PROV-NGB', '285', 'USD', '60', 't', '1', '', '2', '0.04'],
    ['DEMO-MR-3', 'Motorreductor 3 HP relación 30:1 (importado)', 'componente', 'pieza', 'DEMO-PROV-NGB', '410', 'USD', '60', 't', '1', '', '2', '0.04'],
    ['DEMO-MOT-2', 'Motor 2 HP 4 polos trifásico Weg', 'componente', 'pieza', 'DEMO-PROV-MOT', '4850', 'MXN', '', 'f', '1', '', '2', '0.05'],
    ['DEMO-CAT-40', 'Catarina 40B18 de 1"', 'componente', 'pieza', 'DEMO-PROV-ROD', '165', 'MXN', '', 'f', '1', '', '2', '0.06'],
    ['DEMO-CAD-40', 'Cadena de rodillos #40 (tramo de 3 m)', 'componente', 'tramo', 'DEMO-PROV-ROD', '310', 'MXN', '', 'f', '1', '', '2', '0.06'],
    ['DEMO-POL-8', 'Polea de 8" 2 canales tipo B', 'componente', 'pieza', 'DEMO-PROV-ROD', '680', 'MXN', '', 'f', '1', '', '1', '0.05'],
    ['DEMO-DIS-412', 'Disco de corte 4 1/2" para metal', 'componente', 'pieza', 'DEMO-PROV-FER', '18.50', 'MXN', '', 'f', '25', '', '3', '0.08'],
    ['DEMO-GUA', 'Guantes de carnaza (par)', 'componente', 'par', 'DEMO-PROV-FER', '45', 'MXN', '', 'f', '12', '40', '2', '0.07'],
    ['DEMO-ACE', 'Aceite soluble PETROL', 'materia_prima', 'litro', 'DEMO-PROV-FER', '68', 'MXN', '', 'f', '1', '2', '2', '0.09'],
    ['DEMO-ELE-6013', 'Soldadura 6013 1/8" (kg)', 'materia_prima', 'kg', 'DEMO-PROV-FER', '92', 'MXN', '', 'f', '1', '', '2', '0.08'],
    ['DEMO-VID-11', 'Vidrio sombra #11 para careta', 'componente', 'pieza', 'DEMO-PROV-FER', '25', 'MXN', '', 'f', '10', '60', '1', '0.05'],
    ['DEMO-COL-14', 'Colector de polvos motorizado de 14 cartuchos', 'componente', 'pieza', 'DEMO-PROV-MOT', '38500', 'MXN', '', 'f', '1', '', '1', '0.05'],
    ['DEMO-AER-OLI', 'Aerovibrador fluidificador OLI', 'componente', 'pieza', 'DEMO-PROV-NGB', '95', 'USD', '', 't', '1', '', '1', '0.03'],
    ['DEMO-TEN-1', 'Tensor de banda 1" (chumacera de tensión)', 'componente', 'pieza', 'DEMO-PROV-ROD', '', '', '', 'f', '1', '', '0', '0'],
    ['DEMO-TUB-2', 'Tubo cédula 40 de 2" (tramo de 6 m)', 'materia_prima', 'tramo', '', '', '', '', 'f', '1', '', '0', '0']
  ];
  -- Saldos iniciales: clave, almacén, cantidad
  saldos constant text[][] := array[
    ['DEMO-CHU-205', 'Planta Baja', '30'], ['DEMO-CHU-205', 'Mallado', '10'], ['DEMO-CHU-206', 'Planta Baja', '6'],
    ['DEMO-CHU-208', 'Mallado', '2'], ['DEMO-CAN-43', 'Contenedor 1', '120'], ['DEMO-CAN-54', 'Contenedor 1', '91'],
    ['DEMO-CAN-65', 'Contenedor 2', '35'], ['DEMO-TOR-CAN', 'Planta Baja', '760'], ['DEMO-ROD-418', 'Mallado', '36'],
    ['DEMO-ROD-RET', 'Mallado', '8'], ['DEMO-LAM-14', 'Mallado', '15'], ['DEMO-LAM-12', 'Mallado', '4'],
    ['DEMO-ANG-114', 'Mallado', '22'], ['DEMO-BAN-18', 'Contenedor 1', '48'], ['DEMO-BAN-24', 'Contenedor 1', '30'],
    ['DEMO-GRA-125', 'Contenedor 1', '2'], ['DEMO-MR-15', 'Contenedor 2', '3'], ['DEMO-MR-3', 'Contenedor 2', '1'],
    ['DEMO-MOT-2', 'Planta Baja', '2'], ['DEMO-CAT-40', 'Revolución', '12'], ['DEMO-CAD-40', 'Planta Baja', '5'],
    ['DEMO-POL-8', 'Revolución', '4'], ['DEMO-DIS-412', 'Planta Baja', '175'], ['DEMO-GUA', 'Planta Baja', '36'],
    ['DEMO-ELE-6013', 'Planta Baja', '20'], ['DEMO-VID-11', 'Planta Baja', '50'], ['DEMO-COL-14', 'Mallado', '5'],
    ['DEMO-AER-OLI', 'Mallado', '15'], ['DEMO-TEN-1', 'Planta Baja', '3'], ['DEMO-ACE', 'Planta Baja', '4']
  ];
  -- Lista de materiales: padre, hijo, cantidad, grupo
  boms constant text[][] := array[
    ['DEMO-SUB-CM18', 'DEMO-CHU-205', '2', 'Motriz'], ['DEMO-SUB-CM18', 'DEMO-MR-15', '1', 'Motriz'],
    ['DEMO-SUB-CM18', 'DEMO-CAT-40', '1', 'Motriz'], ['DEMO-SUB-CM18', 'DEMO-CAD-40', '1', 'Motriz'],
    ['DEMO-SUB-CM18', 'DEMO-LAM-14', '1', 'Estructura'],
    ['DEMO-SUB-TC18', 'DEMO-CHU-205', '2', 'Cola'], ['DEMO-SUB-TC18', 'DEMO-LAM-14', '0.5', 'Estructura'],
    ['DEMO-EQ-BT18-6', 'DEMO-SUB-CM18', '1', 'Subensambles'], ['DEMO-EQ-BT18-6', 'DEMO-SUB-TC18', '1', 'Subensambles'],
    ['DEMO-EQ-BT18-6', 'DEMO-BAN-18', '13', 'Banda'], ['DEMO-EQ-BT18-6', 'DEMO-ROD-418', '8', 'Rodillos'],
    ['DEMO-EQ-BT18-6', 'DEMO-ROD-RET', '3', 'Rodillos'], ['DEMO-EQ-BT18-6', 'DEMO-ANG-114', '4', 'Estructura'],
    ['DEMO-EQ-BT18-10', 'DEMO-SUB-CM18', '1', 'Subensambles'], ['DEMO-EQ-BT18-10', 'DEMO-SUB-TC18', '1', 'Subensambles'],
    ['DEMO-EQ-BT18-10', 'DEMO-BAN-18', '21', 'Banda'], ['DEMO-EQ-BT18-10', 'DEMO-ROD-418', '13', 'Rodillos'],
    ['DEMO-EQ-BT18-10', 'DEMO-ROD-RET', '5', 'Rodillos'], ['DEMO-EQ-BT18-10', 'DEMO-ANG-114', '7', 'Estructura'],
    ['DEMO-EQ-ELV-10', 'DEMO-CAN-54', '70', 'Cangilones'], ['DEMO-EQ-ELV-10', 'DEMO-TOR-CAN', '140', 'Cangilones'],
    ['DEMO-EQ-ELV-10', 'DEMO-BAN-24', '22', 'Banda'], ['DEMO-EQ-ELV-10', 'DEMO-CHU-208', '4', 'Motriz'],
    ['DEMO-EQ-ELV-10', 'DEMO-MR-3', '1', 'Motriz'], ['DEMO-EQ-ELV-10', 'DEMO-LAM-12', '6', 'Estructura']
  ];
  p text[]; x text[];
begin
  select id into v_comp from perfiles where correo = 'compras@hegamex.com';
  select id into v_alm from perfiles where correo = 'almacen@hegamex.com';
  select id into v_ger from perfiles where correo = 'gerente.produccion@hegamex.com';
  select id into v_fin from perfiles where correo = 'finanzas@hegamex.com';
  if v_comp is null or v_alm is null or v_ger is null or v_fin is null then
    raise exception 'Faltan los usuarios locales: corre antes node scripts/usuarios-locales.mjs';
  end if;
  select id into v_pb from almacenes where nombre = 'Planta Baja';
  select id into v_mall from almacenes where nombre = 'Mallado';
  select id into v_pa from almacenes where nombre = 'Planta Alta';
  select id into v_c1 from almacenes where nombre = 'Contenedor 1';
  select id into v_c2 from almacenes where nombre = 'Contenedor 2';
  select id into v_rev from almacenes where nombre = 'Revolución';
  select id into v_ml from almacenes where not disponible_para_planta order by id limit 1;

  -- ---------------------------------------------------------------------------
  -- Catálogo: proveedores y artículos (como compras)
  -- ---------------------------------------------------------------------------
  perform set_config('request.jwt.claims', json_build_object('sub', v_comp, 'role', 'authenticated')::text, true);
  foreach p slice 1 in array provs loop
    insert into proveedores (legacy_id, nombre, razon_social, categoria, pais, es_importacion, moneda, dias_credito, dias_entrega, contacto, telefono, correo)
    values (p[1], p[2], p[3], p[4], p[5], p[6]::boolean, p[7]::moneda, p[8]::int, p[9]::int, p[10], p[11], p[12])
    on conflict (legacy_id) do nothing;
  end loop;

  foreach x slice 1 in array arts loop
    insert into articulos (clave, nombre, tipo, unidad, proveedor_id, tiempo_entrega_dias, es_importado, empaque, stock_minimo_fijo, legacy_id)
    values (x[1], x[2], x[3]::tipo_articulo, x[4], (select id from proveedores where legacy_id = nullif(x[5], '')),
            nullif(x[8], '')::int, x[9]::boolean, x[10]::numeric, nullif(x[11], '')::numeric, x[1])
    on conflict (clave) do nothing;
  end loop;

  -- Equipos que usan esos componentes, para que "¿a cuántos equipos afecta?" tenga respuesta.
  insert into articulos (clave, nombre, tipo, unidad, legacy_id, controla_inventario) values
    ('DEMO-SUB-CM18', 'Cabezal motriz para banda de 18"', 'subensamble', 'pieza', 'DEMO-SUB-CM18', false),
    ('DEMO-SUB-TC18', 'Tambor de cola para banda de 18"', 'subensamble', 'pieza', 'DEMO-SUB-TC18', false),
    ('DEMO-EQ-BT18-6', 'Banda transportadora 18" x 6 m', 'equipo', 'pieza', 'DEMO-EQ-BT18-6', false),
    ('DEMO-EQ-BT18-10', 'Banda transportadora 18" x 10 m', 'equipo', 'pieza', 'DEMO-EQ-BT18-10', false),
    ('DEMO-EQ-ELV-10', 'Elevador de cangilones 10 m', 'equipo', 'pieza', 'DEMO-EQ-ELV-10', false)
  on conflict (clave) do nothing;

  if not exists (select 1 from bom_lineas b join articulos e on e.id = b.padre_id where e.clave = 'DEMO-EQ-BT18-6') then
    k := 0;
    foreach x slice 1 in array boms loop
      k := k + 1;
      insert into bom_lineas (padre_id, hijo_id, cantidad, grupo, orden)
      values ((select id from articulos where clave = x[1]), (select id from articulos where clave = x[2]), x[3]::numeric, x[4], k);
    end loop;
  end if;

  -- ---------------------------------------------------------------------------
  -- Costos con historia (el historial de ACTUALIZACIONES llega a 2019). Se
  -- escribe la historia hacia atrás con su alza anual y al final el costo
  -- vigente. El disparador anota el costo vigente con fecha de hoy; se le pone
  -- la fecha real de ese precio, como hará la importación.
  -- ---------------------------------------------------------------------------
  if not exists (select 1 from costos_articulo c join articulos ar on ar.id = c.articulo_id where ar.clave = 'DEMO-CHU-205') then
    -- Un solo recálculo al final, no uno por artículo (si la base lo permite).
    perform set_config('erp.diferir_recalculo', 'on', true);
    foreach x slice 1 in array arts loop
      continue when x[6] = '';
      for k in reverse x[12]::int .. 1 loop
        insert into historial_costos (articulo_id, costo_anterior, costo_nuevo, moneda, proveedor_id, origen, usuario_id, en)
        values ((select id from articulos where clave = x[1]),
                case when k < x[12]::int then round(x[6]::numeric / power(1 + x[13]::numeric, k + 1), 2) end,
                round(x[6]::numeric / power(1 + x[13]::numeric, k), 2), x[7]::moneda,
                (select id from proveedores where legacy_id = x[5]), 'manual', v_comp, pg_temp.fecha_demo(x[1], k));
      end loop;
      insert into costos_articulo (articulo_id, costo, moneda, proveedor_id, actualizado_en, actualizado_por)
      values ((select id from articulos where clave = x[1]), x[6]::numeric, x[7]::moneda,
              (select id from proveedores where legacy_id = x[5]), pg_temp.fecha_demo(x[1], 0)::date, v_comp);
      update historial_costos set en = pg_temp.fecha_demo(x[1], 0), usuario_id = v_comp,
        costo_anterior = case when x[12]::int > 0 then round(x[6]::numeric / (1 + x[13]::numeric), 2) end,
        origen = case when x[1] in ('DEMO-LAM-14', 'DEMO-ANG-114') then 'orden_compra' else 'manual' end
      where id = (select max(id) from historial_costos where articulo_id = (select id from articulos where clave = x[1]));
    end loop;
    perform set_config('erp.diferir_recalculo', '', true);
    perform recalcular_costos();
  end if;

  -- ---------------------------------------------------------------------------
  -- Operación de almacén y compras: solo si todavía no hay movimientos DEMO.
  -- ---------------------------------------------------------------------------
  if exists (select 1 from movimientos_inventario m join articulos ar on ar.id = m.articulo_id where ar.clave like 'DEMO-%') then
    raise notice 'Los datos DEMO de operación ya estaban; solo se completó el catálogo.';
    return;
  end if;

  -- Saldo inicial (lo único que entra directo: es lo que hará la importación).
  perform set_config('request.jwt.claims', json_build_object('sub', v_alm, 'role', 'authenticated')::text, true);
  foreach x slice 1 in array saldos loop
    insert into movimientos_inventario (tipo, articulo_id, almacen_id, cantidad, motivo)
    values ('inicial', (select id from articulos where clave = x[1]), (select id from almacenes where nombre = x[2]), x[3]::numeric,
            'Saldo inicial (DEMO)');
  end loop;

  -- Salidas del día, como las captura el almacén.
  perform registrar_salida((select id from articulos where clave = 'DEMO-CHU-205'), v_pb, 4, 'salida_consumo', 'Taller · mantenimiento de cribadora');
  perform registrar_salida((select id from articulos where clave = 'DEMO-DIS-412'), v_pb, 35, 'salida_consumo', 'Plasma');
  perform registrar_salida((select id from articulos where clave = 'DEMO-GUA'), v_pb, 6, 'salida_consumo', 'EPP · cuadrilla de pailería');
  perform registrar_salida((select id from articulos where clave = 'DEMO-TOR-CAN'), v_pb, 60, 'salida_venta', 'Venta mostrador');
  perform registrar_salida((select id from articulos where clave = 'DEMO-ACE'), v_pb, 4, 'salida_consumo', 'Torno');
  perform registrar_salida((select id from articulos where clave = 'DEMO-AER-OLI'), v_mall, 2, 'salida_venta', 'Venta ML');
  perform traspasar((select id from articulos where clave = 'DEMO-AER-OLI'), v_mall, v_ml, 10, 'Envío a Mercado Libre Full');
  perform traspasar((select id from articulos where clave = 'DEMO-COL-14'), v_mall, v_ml, 2, 'Envío a Mercado Libre Full');
  perform traspasar((select id from articulos where clave = 'DEMO-CAT-40'), v_rev, v_c2, 8, 'Vaciando Revolución');
  perform traspasar((select id from articulos where clave = 'DEMO-CHU-205'), v_pb, v_mall, 6, 'Cambio de almacén');
  perform registrar_devolucion((select id from articulos where clave = 'DEMO-ROD-418'), v_mall, 2, 'Sobró de la banda del pedido P-786');

  -- Apartados de venta (en la hoja eran el almacén "RESERVADO").
  insert into reservas (articulo_id, cantidad, motivo, creado_por) values
    ((select id from articulos where clave = 'DEMO-COL-14'), 2, 'Venta JM · SPI Ingeniería', v_alm),
    ((select id from articulos where clave = 'DEMO-CAN-65'), 22, 'Pedido Tuxtla (elevador)', v_alm);

  -- ---------------------------------------------------------------------------
  -- Órdenes de compra (como compras) y recepciones (como almacén)
  -- ---------------------------------------------------------------------------
  perform set_config('request.jwt.claims', json_build_object('sub', v_comp, 'role', 'authenticated')::text, true);
  -- 1. Borrador
  insert into ordenes_compra (proveedor_id, condiciones, notas)
  values ((select id from proveedores where legacy_id = 'DEMO-PROV-ROD'), 'Crédito a 30 días', 'DEMO · reposición de chumaceras')
  returning id into v_oc;
  perform agregar_partida_oc(v_oc, (select id from articulos where clave = 'DEMO-CHU-208'), 6);
  perform agregar_partida_oc(v_oc, (select id from articulos where clave = 'DEMO-POL-8'), 2);

  -- 2. Enviada y atrasada
  insert into ordenes_compra (proveedor_id, condiciones, notas, fecha, fecha_entrega)
  values ((select id from proveedores where legacy_id = 'DEMO-PROV-BAN'), 'Crédito a 15 días', 'DEMO · banda para pedidos de octubre',
          current_date - 12, current_date - 4)
  returning id into v_oc;
  perform agregar_partida_oc(v_oc, (select id from articulos where clave = 'DEMO-BAN-18'), 60);
  perform agregar_partida_oc(v_oc, (select id from articulos where clave = 'DEMO-GRA-125'), 2);
  perform enviar_orden_compra(v_oc);

  -- 3. Importación en dólares, en tránsito
  insert into ordenes_compra (proveedor_id, moneda, tipo_cambio, condiciones, notas, fecha)
  values ((select id from proveedores where legacy_id = 'DEMO-PROV-NGB'), 'USD', tc('USD'), 'Pago anticipado 30 %, resto contra embarque',
          'DEMO · contenedor de motorreductores', current_date - 20)
  returning id into v_oc;
  perform agregar_partida_oc(v_oc, (select id from articulos where clave = 'DEMO-MR-15'), 6);
  perform agregar_partida_oc(v_oc, (select id from articulos where clave = 'DEMO-MR-3'), 2);
  perform enviar_orden_compra(v_oc);

  -- 4. Tapco: llegó solo una partida
  insert into ordenes_compra (proveedor_id, moneda, tipo_cambio, notas, fecha, fecha_entrega)
  values ((select id from proveedores where legacy_id = 'DEMO-PROV-TAP'), 'USD', tc('USD'), 'DEMO · cangilones', current_date - 50, current_date + 6)
  returning id into v_oc;
  perform agregar_partida_oc(v_oc, (select id from articulos where clave = 'DEMO-CAN-54'), 500);
  perform agregar_partida_oc(v_oc, (select id from articulos where clave = 'DEMO-CAN-43'), 300);
  perform enviar_orden_compra(v_oc);
  perform set_config('request.jwt.claims', json_build_object('sub', v_alm, 'role', 'authenticated')::text, true);
  perform recibir_orden_compra(v_oc, jsonb_build_array(jsonb_build_object(
    'linea_id', (select l.id from oc_lineas l join articulos ar on ar.id = l.articulo_id where l.orden_compra_id = v_oc and ar.clave = 'DEMO-CAN-43'),
    'cantidad', 300, 'almacen_id', v_c1)), 'INV-88231', false);

  -- 5. Acero: recibida completa y con un pago
  perform set_config('request.jwt.claims', json_build_object('sub', v_comp, 'role', 'authenticated')::text, true);
  insert into ordenes_compra (proveedor_id, condiciones, notas, fecha)
  values ((select id from proveedores where legacy_id = 'DEMO-PROV-ACE'), 'Crédito a 30 días', 'DEMO · lámina y ángulo', current_date - 9)
  returning id into v_oc;
  perform agregar_partida_oc(v_oc, (select id from articulos where clave = 'DEMO-LAM-14'), 20);
  perform agregar_partida_oc(v_oc, (select id from articulos where clave = 'DEMO-ANG-114'), 30);
  perform enviar_orden_compra(v_oc);
  perform set_config('request.jwt.claims', json_build_object('sub', v_alm, 'role', 'authenticated')::text, true);
  perform recibir_orden_compra(v_oc, (select jsonb_agg(jsonb_build_object('linea_id', l.id, 'cantidad', l.cantidad, 'almacen_id', v_mall))
                                      from oc_lineas l where l.orden_compra_id = v_oc), 'F-77412', true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_fin, 'role', 'authenticated')::text, true);
  insert into pagos_proveedor (orden_compra_id, monto, metodo, referencia, registrado_por)
  values (v_oc, round((select total from ordenes_compra where id = v_oc) / 2, 2), 'transferencia', 'SPEI 4471-0925 (anticipo 50 %)', v_fin);

  -- ---------------------------------------------------------------------------
  -- Requisiciones: faltantes de producción (con una partida sin proveedor) y
  -- lo que almacén le pide a compras desde el reabasto.
  -- ---------------------------------------------------------------------------
  perform set_config('request.jwt.claims', json_build_object('sub', v_ger, 'role', 'authenticated')::text, true);
  insert into requisiciones (origen, necesaria_para, notas, solicitante_id)
  values ('produccion', current_date + 10, 'DEMO · faltantes de P-786 Bazuca 10" x 12', v_ger) returning id into v_req;
  insert into requisicion_lineas (requisicion_id, articulo_id, cantidad) values
    (v_req, (select id from articulos where clave = 'DEMO-ROD-418'), 16),
    (v_req, (select id from articulos where clave = 'DEMO-CHU-205'), 8),
    (v_req, (select id from articulos where clave = 'DEMO-TUB-2'), 4);
  perform set_config('request.jwt.claims', json_build_object('sub', v_alm, 'role', 'authenticated')::text, true);
  perform requisicion_desde_reabasto(array(select id from articulos where clave in ('DEMO-ACE', 'DEMO-GUA', 'DEMO-VID-11')), 'DEMO · mínimos de consumibles');

  -- ---------------------------------------------------------------------------
  -- Ajustes y conteos: lo pide almacén, lo autoriza la gerencia.
  -- ---------------------------------------------------------------------------
  v_aj := solicitar_ajuste((select id from articulos where clave = 'DEMO-ELE-6013'), v_pb, 18.5, 'Se pesó el bote: había 18.5 kg, no 20');
  v_l := solicitar_ajuste((select id from articulos where clave = 'DEMO-CHU-206'), v_pb, 7, 'Apareció una chumacera en el estante de devoluciones');
  perform solicitar_ajuste((select id from articulos where clave = 'DEMO-ROD-RET'), v_mall, 6, 'Dos rodillos golpeados, se separan como merma');
  perform solicitar_ajuste((select id from articulos where clave = 'DEMO-VID-11'), v_pb, 47, 'Conteo rápido del lunes');
  perform set_config('request.jwt.claims', json_build_object('sub', v_ger, 'role', 'authenticated')::text, true);
  perform resolver_ajuste(v_aj, true, 'Revisado: el bote estaba abierto');
  perform resolver_ajuste(v_l, false, 'Esa chumacera es de la orden P-790, no es sobrante');

  perform set_config('request.jwt.claims', json_build_object('sub', v_alm, 'role', 'authenticated')::text, true);
  insert into conteos (nombre, almacen_id, creado_por) values ('Contenedor 2 · cierre de septiembre (DEMO)', v_c2, v_alm) returning id into v_conteo;
  insert into conteo_lineas (conteo_id, articulo_id, cantidad_contada) values
    (v_conteo, (select id from articulos where clave = 'DEMO-CAN-65'), 33),
    (v_conteo, (select id from articulos where clave = 'DEMO-MR-15'), 3),
    (v_conteo, (select id from articulos where clave = 'DEMO-CAT-40'), 8);
  perform cerrar_conteo(v_conteo);

  insert into conteos (nombre, almacen_id, creado_por) values ('Contenedor 1 · octubre (DEMO)', v_c1, v_alm) returning id into v_conteo;
  insert into conteo_lineas (conteo_id, articulo_id, cantidad_contada) values
    (v_conteo, (select id from articulos where clave = 'DEMO-CAN-43'), 420),
    (v_conteo, (select id from articulos where clave = 'DEMO-BAN-18'), 46.5),
    (v_conteo, (select id from articulos where clave = 'DEMO-GRA-125'), 2);

  raise notice 'Datos DEMO de compras y almacén listos.';
end $$;

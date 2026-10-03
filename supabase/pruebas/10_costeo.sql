-- Motor de costeo: debe dar los mismos precios que "Nuevo Costeo" y manejar
-- subensambles y parámetros. Casos reales trazados en el análisis de la hoja.
do $$
declare
  v_banda uuid; v_comp uuid; v_tolva uuid; v_dosif uuid;
  v_rodillo uuid; v_banda_m uuid; v_motor uuid; v_cabezal uuid; v_eq20 uuid; v_eq22 uuid;
  v_precio numeric; v_costo numeric; v_horas numeric; v_n int;
begin
  -- Caso E-315: banda (utilidad 32 %), costo directo $91,345.69 → lista $202,000.
  insert into articulos (clave, tipo, nombre, unidad) values ('T-COMP-1', 'componente', 'Componente agregado E-315', 'pieza') returning id into v_comp;
  insert into costos_articulo (articulo_id, costo) values (v_comp, 91345.69);
  insert into articulos (clave, tipo, nombre, categoria_id)
    values ('T-E-315', 'equipo', 'Banda cargadora de 18" x 13 m', (select id from categorias where nombre = 'Banda Transportadora'))
    returning id into v_banda;
  insert into bom_lineas (padre_id, hijo_id, cantidad) values (v_banda, v_comp, 1);
  select precio into v_precio from precios_lista where articulo_id = v_banda;
  assert v_precio = 202000, format('E-315 debía costar $202,000 y salió %s', v_precio);

  -- Caso E-198: dosificadora (34 %), $479,917.31 → $1,121,000 (redondeo a miles arriba de $100k).
  update costos_articulo set costo = 479917.31 where articulo_id = v_comp;
  update articulos set categoria_id = (select id from categorias where nombre = 'Dosificadora') where id = v_banda;
  select precio into v_precio from precios_lista where articulo_id = v_banda;
  assert v_precio = 1121000, format('E-198 debía costar $1,121,000 y salió %s', v_precio);

  -- Caso E-409: tolva con medida especial (+10 % sobre costo), $73,049.83 → $187,000.
  update costos_articulo set costo = 73049.83 where articulo_id = v_comp;
  update articulos set categoria_id = (select id from categorias where nombre = 'Tolva'), medida_especial = true where id = v_banda;
  select precio into v_precio from precios_lista where articulo_id = v_banda;
  assert v_precio = 187000, format('E-409 debía costar $187,000 y salió %s', v_precio);

  -- Componente de reventa: 30 % sobre precio sin compensar ISR ($735 → $1,050).
  update costos_articulo set costo = 735 where articulo_id = v_comp;
  select precio into v_precio from precios_lista where articulo_id = v_comp;
  assert v_precio = 1050, format('Componente de $735 debía venderse en $1,050 y salió %s', v_precio);

  -- Historial: cada cambio de costo quedó registrado (alta + 3 cambios).
  select count(*) into v_n from historial_costos where articulo_id = v_comp;
  assert v_n = 4, format('esperaba 4 registros de historial de costo, hay %s', v_n);
  select count(*) into v_n from historial_costeo where articulo_id = v_banda and not reconstruido;
  assert v_n >= 4, format('cada cambio de costo/precio del equipo debía quedar en historial_costeo (hay %s)', v_n);
  -- El factor guarda la política: E-409 (tolva 34 %% + medida especial) ≈ 2.5584
  select factor into v_costo from historial_costeo where articulo_id = v_banda order by id desc limit 1;
  assert round(v_costo, 3) = round((1.105 + 0.10) / (1 - 0.34/0.75 - 0.0735), 3), format('factor inesperado %s', v_costo);

  -- ---------------------------------------------------------------------------
  -- Subensamble compartido + cantidades por parámetro
  -- ---------------------------------------------------------------------------
  insert into articulos (clave, tipo, nombre, unidad) values ('T-ROD', 'componente', 'Rodillo de carga 4"', 'pieza') returning id into v_rodillo;
  insert into articulos (clave, tipo, nombre, unidad) values ('T-BANDA', 'componente', 'Banda lisa 18"', 'metro') returning id into v_banda_m;
  insert into articulos (clave, tipo, nombre, unidad) values ('T-MOT', 'componente', 'Motorreductor 3 HP', 'pieza') returning id into v_motor;
  insert into costos_articulo (articulo_id, costo) values (v_rodillo, 300), (v_banda_m, 500), (v_motor, 10000);

  insert into articulos (clave, tipo, nombre) values ('T-CAB', 'subensamble', 'Cabezal motriz 18"') returning id into v_cabezal;
  insert into bom_lineas (padre_id, hijo_id, cantidad) values (v_cabezal, v_motor, 1);
  insert into bom_operaciones (articulo_id, etapa_id, horas) values (v_cabezal, (select id from etapas where nombre = 'Pailería'), 10);

  insert into articulos (clave, tipo, nombre, categoria_id) values ('T-B20', 'equipo', 'Banda 18" x 20 m',
    (select id from categorias where nombre = 'Banda Transportadora')) returning id into v_eq20;
  insert into articulo_parametros (articulo_id, nombre, valor, unidad) values (v_eq20, 'largo_m', 20, 'm');
  insert into bom_lineas (padre_id, hijo_id, cantidad, parametro, por_parametro, redondear_arriba) values
    (v_eq20, v_cabezal, 1, null, 0, false),
    (v_eq20, v_banda_m, 1.5, 'largo_m', 2, false),        -- 2 m de banda por metro + 1.5 de empalme
    (v_eq20, v_rodillo, 0, 'largo_m', 0.83, true);        -- un rodillo cada 1.2 m, enteros
  insert into bom_operaciones (articulo_id, etapa_id, horas, parametro, horas_por_parametro)
    values (v_eq20, (select id from etapas where nombre = 'Pailería'), 20, 'largo_m', 1.5);

  -- 20 m: banda 41.5 m × 500 = 20,750; rodillos ceil(16.6)=17 × 300 = 5,100; motor 10,000;
  -- horas: cabezal 10 + equipo 20 + 1.5×20 = 60 h × 87.67 = 5,260.20 → total 41,110.20
  select costo_total, horas into v_costo, v_horas from costos_calculados where articulo_id = v_eq20;
  assert v_costo = 41110.20, format('costo de la banda de 20 m: esperaba 41,110.20 y salió %s', v_costo);
  assert v_horas = 60, format('horas de la banda de 20 m: esperaba 60 y salieron %s', v_horas);

  -- "La de 20 m pero de 22 m": duplicar y cambiar el parámetro.
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000000"}', true);
  insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000a1', 'ingenieria@hegamex.com');
  insert into usuario_roles values ('00000000-0000-0000-0000-0000000000a1', 'ingenieria');
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1"}', true);
  v_eq22 := duplicar_articulo(v_eq20, 'T-B22', 'Banda 18" x 22 m', '{"largo_m": 22}');
  -- 22 m: banda 45.5 × 500 = 22,750; rodillos ceil(18.26)=19 × 300 = 5,700; motor 10,000;
  -- horas 10 + 20 + 33 = 63 × 87.67 = 5,523.21 → 43,973.21
  select costo_total into v_costo from costos_calculados where articulo_id = v_eq22;
  assert v_costo = 43973.21, format('costo de la banda de 22 m: esperaba 43,973.21 y salió %s', v_costo);

  -- El subensamble se comparte: subir el motor mueve a las dos bandas.
  update costos_articulo set costo = 11000 where articulo_id = v_motor;
  select costo_total into v_costo from costos_calculados where articulo_id = v_eq22;
  assert v_costo = 44973.21, format('el cambio del motor no llegó a la banda de 22 m (%s)', v_costo);
  select count(*) into v_n from donde_se_usa(v_motor);
  assert v_n = 3, format('el motor se usa en cabezal + 2 bandas, donde_se_usa dio %s', v_n);

  -- Explosión: hasta lo que se compra, con cantidades multiplicadas.
  select cantidad into v_costo from explotar_materiales(v_eq22, 2) where articulo_id = v_rodillo;
  assert v_costo = 38, format('2 bandas de 22 m llevan 38 rodillos, la explosión dio %s', v_costo);
  select cantidad into v_costo from explotar_materiales(v_eq22, 2) where articulo_id = v_motor;
  assert v_costo = 2, 'el motor del subensamble no salió en la explosión';

  -- Ciclos: el cabezal no puede contener a la banda que lo contiene.
  begin
    insert into bom_lineas (padre_id, hijo_id, cantidad) values (v_cabezal, v_eq20, 1);
    assert false, 'se permitió un ciclo en la lista de materiales';
  exception when check_violation then null;
  end;

  -- Un componente no lleva lista de materiales.
  begin
    insert into bom_lineas (padre_id, hijo_id, cantidad) values (v_motor, v_rodillo, 1);
    assert false, 'se permitió lista de materiales en un componente';
  exception when check_violation then null;
  end;
end $$;

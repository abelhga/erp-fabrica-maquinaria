-- Funciones de las pantallas de costeo: convertir líneas en subensamble sin
-- mover el costo, reconocer subensambles iguales, duplicar con otros
-- parámetros, desglose del precio, simulador de márgenes y quién puede qué.
do $$
declare
  v_ing uuid; v_vend uuid; v_dir uuid; v_prod uuid;
  v_motor uuid; v_polea uuid; v_chum uuid; v_banda_m uuid; v_rod uuid; v_lam uuid; v_vulc uuid;
  v_eq uuid; v_eq2 uuid; v_sub uuid; v_copia uuid; v_tolva uuid;
  v_l_motor uuid; v_l_polea uuid; v_l_chum uuid; v_l_banda uuid; v_l_rod uuid;
  v_costo_antes numeric; v_precio_antes numeric; v_costo numeric; v_precio numeric; v_n int; v_fotos int;
  v_j jsonb; r record; v_sol uuid;
begin
  v_ing := pg_temp.usuario('ingenieria@hegamex.com', '{ingenieria}');
  v_vend := pg_temp.usuario('isaac@hegamex.com', '{ventas}');
  v_dir := pg_temp.usuario('direccion@hegamex.com', '{direccion}');
  v_prod := pg_temp.usuario('taller@hegamex.com', '{produccion}');

  -- Componentes con costo (uno con merma y otro que depende del largo)
  insert into articulos (clave, tipo, nombre, unidad) values ('T50-MOT', 'componente', 'Motorreductor 3 HP', 'pieza') returning id into v_motor;
  insert into articulos (clave, tipo, nombre, unidad) values ('T50-POL', 'componente', 'Polea motriz 10"', 'pieza') returning id into v_polea;
  insert into articulos (clave, tipo, nombre, unidad) values ('T50-CHU', 'componente', 'Chumacera 1 7/16"', 'pieza') returning id into v_chum;
  insert into articulos (clave, tipo, nombre, unidad) values ('T50-BAN', 'componente', 'Banda 18"', 'metro') returning id into v_banda_m;
  insert into articulos (clave, tipo, nombre, unidad) values ('T50-ROD', 'componente', 'Rodillo 4"', 'pieza') returning id into v_rod;
  insert into articulos (clave, tipo, nombre, unidad) values ('T50-LAM', 'materia_prima', 'Lámina cal. 12', 'pieza') returning id into v_lam;
  insert into articulos (clave, tipo, nombre, unidad) values ('T50-VUL', 'servicio', 'Vulcanizado', 'servicio') returning id into v_vulc;
  insert into costos_articulo (articulo_id, costo) values
    (v_motor, 15000), (v_polea, 3200), (v_chum, 385.5), (v_banda_m, 420), (v_rod, 310), (v_lam, 1380), (v_vulc, 8500);

  insert into articulos (clave, tipo, nombre, categoria_id) values ('T50-B20', 'equipo', 'Banda 18" x 20 m',
    (select id from categorias where nombre = 'Banda Transportadora')) returning id into v_eq;
  insert into articulo_parametros (articulo_id, nombre, valor, unidad) values (v_eq, 'largo_m', 20, 'm');
  insert into bom_lineas (padre_id, hijo_id, cantidad, orden) values (v_eq, v_motor, 1, 10) returning id into v_l_motor;
  insert into bom_lineas (padre_id, hijo_id, cantidad, orden) values (v_eq, v_polea, 1, 20) returning id into v_l_polea;
  insert into bom_lineas (padre_id, hijo_id, cantidad, merma, orden) values (v_eq, v_chum, 2, 0.05, 30) returning id into v_l_chum;
  insert into bom_lineas (padre_id, hijo_id, cantidad, parametro, por_parametro, orden) values (v_eq, v_banda_m, 1.5, 'largo_m', 2, 40) returning id into v_l_banda;
  insert into bom_lineas (padre_id, hijo_id, cantidad, parametro, por_parametro, redondear_arriba, orden)
    values (v_eq, v_rod, 0, 'largo_m', 0.83, true, 50) returning id into v_l_rod;
  insert into bom_lineas (padre_id, hijo_id, cantidad, orden) values (v_eq, v_vulc, 1, 60);
  insert into bom_operaciones (articulo_id, etapa_id, horas, parametro, horas_por_parametro)
    values (v_eq, (select id from etapas where nombre = 'Pailería'), 20, 'largo_m', 1.5);

  select costo_total into v_costo_antes from costos_calculados where articulo_id = v_eq;
  select precio into v_precio_antes from precios_lista where articulo_id = v_eq;
  select count(*) into v_fotos from historial_costeo where articulo_id = v_eq;

  -- ---------------------------------------------------------------------------
  -- Un vendedor no puede convertir líneas en subensamble
  -- ---------------------------------------------------------------------------
  perform pg_temp.como(v_vend);
  begin
    perform extraer_subensamble(v_eq, array[v_l_motor, v_l_polea], 'T50-SUB-X', 'No debe crearse');
    assert false, 'un vendedor pudo convertir líneas en subensamble';
  exception when insufficient_privilege then null;
  end;
  -- …ni ver el desglose del precio ni simular márgenes (los costos no le llegan por ningún lado)
  assert desglose_precio(v_eq) is null, 'un vendedor recibió el desglose del precio';
  select count(*) into v_n from simular_precios(null, '{}', 0.25);
  assert v_n = 0, format('un vendedor recibió %s precios simulados (con costo)', v_n);
  select count(*) into v_n from subensambles_coincidentes(v_eq, array[v_l_motor]);
  assert v_n = 0, 'no debía haber candidatos';
  perform pg_temp.como_postgres();
  assert not exists (select 1 from articulos where clave = 'T50-SUB-X'), 'quedó un subensamble del vendedor';

  -- ---------------------------------------------------------------------------
  -- Ingeniería convierte motor + polea + chumaceras + banda (por parámetro) en subensamble
  -- ---------------------------------------------------------------------------
  perform pg_temp.como(v_ing);
  v_sub := extraer_subensamble(v_eq, array[v_l_motor, v_l_polea, v_l_chum, v_l_banda], 'T50-SUB-CM', 'Cabezal motriz de prueba');
  perform pg_temp.como_postgres();

  select costo_total into v_costo from costos_calculados where articulo_id = v_eq;
  select precio into v_precio from precios_lista where articulo_id = v_eq;
  assert round(v_costo, 2) = round(v_costo_antes, 2),
    format('extraer_subensamble cambió el costo: antes %s, después %s', v_costo_antes, v_costo);
  assert v_precio = v_precio_antes, format('extraer_subensamble cambió el precio: antes %s, después %s', v_precio_antes, v_precio);

  select count(*) into v_n from bom_lineas where padre_id = v_eq;
  assert v_n = 3, format('el equipo debía quedar con rodillo, vulcanizado y el subensamble; tiene %s líneas', v_n);
  select count(*) into v_n from bom_lineas where padre_id = v_sub;
  assert v_n = 4, format('el subensamble debía llevar 4 líneas, lleva %s', v_n);
  -- Las líneas se movieron, no se copiaron: conservan id, merma y parámetro.
  assert (select padre_id from bom_lineas where id = v_l_chum) = v_sub, 'la línea de chumaceras no se movió';
  assert (select merma from bom_lineas where id = v_l_chum) = 0.05, 'se perdió la merma';
  -- La banda dependía del largo del equipo: el subensamble lleva su propio largo_m = 20.
  assert (select valor from articulo_parametros where articulo_id = v_sub and nombre = 'largo_m') = 20,
    'el subensamble no recibió el parámetro largo_m';
  -- Una sola línea de 1 pieza en el lugar de la primera.
  select * into r from bom_lineas where padre_id = v_eq and hijo_id = v_sub;
  assert r.cantidad = 1 and r.orden = 10, format('línea del subensamble inesperada: %s × orden %s', r.cantidad, r.orden);
  -- Sin fotos intermedias: el padre no "bajó" de costo a la mitad de la operación.
  assert not exists (select 1 from historial_costeo where articulo_id = v_eq and en = now() and round(costo_total, 2) <> round(v_costo_antes, 2)),
    'quedó una foto intermedia del equipo con otro costo';
  select count(*) into v_n from historial_costeo where articulo_id = v_sub and en = now();
  assert v_n = 1, format('el subensamble nuevo debía tener una sola foto, tiene %s', v_n);

  -- No se aceptan líneas de otra lista.
  perform pg_temp.como(v_ing);
  begin
    perform extraer_subensamble(v_eq, array[v_l_rod, gen_random_uuid()], 'T50-SUB-Y', 'No debe crearse');
    assert false, 'se aceptó una línea que no es del equipo';
  exception when invalid_parameter_value then null;
  end;

  -- ---------------------------------------------------------------------------
  -- Otro equipo con las mismas piezas sueltas: se reconoce el subensamble y se sustituye
  -- ---------------------------------------------------------------------------
  perform pg_temp.como_postgres();
  insert into articulos (clave, tipo, nombre, categoria_id) values ('T50-B20B', 'equipo', 'Banda 18" x 20 m (plana)',
    (select id from categorias where nombre = 'Banda Transportadora')) returning id into v_eq2;
  insert into bom_lineas (padre_id, hijo_id, cantidad, orden) values
    (v_eq2, v_motor, 1, 10), (v_eq2, v_polea, 1, 20), (v_eq2, v_lam, 3, 30);
  insert into bom_lineas (padre_id, hijo_id, cantidad, merma, orden) values (v_eq2, v_chum, 2, 0.05, 40);
  insert into bom_lineas (padre_id, hijo_id, cantidad, orden) values (v_eq2, v_banda_m, 41.5, 50);
  select costo_total into v_costo_antes from costos_calculados where articulo_id = v_eq2;

  perform pg_temp.como(v_ing);
  select * into r from subensambles_coincidentes(v_eq2,
    array(select id from bom_lineas where padre_id = v_eq2 and hijo_id <> v_lam));
  assert r.subensamble_id = v_sub and r.exacto, format('no reconoció el subensamble idéntico (%s)', to_jsonb(r));
  -- Con la lámina incluida ya no es exacto.
  select * into r from subensambles_coincidentes(v_eq2, array(select id from bom_lineas where padre_id = v_eq2));
  assert r.subensamble_id = v_sub and not r.exacto and r.iguales = 4, format('coincidencia parcial inesperada (%s)', to_jsonb(r));

  perform sustituir_por_subensamble(v_eq2, array(select id from bom_lineas where padre_id = v_eq2 and hijo_id <> v_lam), v_sub);
  perform pg_temp.como_postgres();
  select costo_total into v_costo from costos_calculados where articulo_id = v_eq2;
  assert round(v_costo, 2) = round(v_costo_antes, 2),
    format('sustituir por un subensamble idéntico cambió el costo: %s → %s', v_costo_antes, v_costo);
  select count(*) into v_n from bom_lineas where padre_id = v_eq2;
  assert v_n = 2, format('debían quedar lámina + subensamble, quedaron %s líneas', v_n);
  select count(*) into v_n from donde_se_usa(v_sub);
  assert v_n = 2, format('el subensamble debía usarse en 2 equipos, donde_se_usa dio %s', v_n);

  -- Restar horas: si el subensamble trae horas propias y el equipo plano ya las contaba.
  insert into bom_operaciones (articulo_id, etapa_id, horas) values (v_sub, (select id from etapas where nombre = 'Torno'), 4);
  insert into bom_operaciones (articulo_id, etapa_id, horas) values (v_eq2, (select id from etapas where nombre = 'Torno'), 10);
  insert into bom_lineas (padre_id, hijo_id, cantidad, orden) values (v_eq2, v_motor, 1, 90);
  perform pg_temp.como(v_ing);
  perform sustituir_por_subensamble(v_eq2, array(select id from bom_lineas where padre_id = v_eq2 and orden = 90), v_sub, true);
  perform pg_temp.como_postgres();
  assert (select horas from bom_operaciones where articulo_id = v_eq2 and etapa_id = (select id from etapas where nombre = 'Torno')) = 6,
    'no se restaron las 4 h de torno del subensamble';

  -- Un vendedor tampoco sustituye.
  perform pg_temp.como(v_vend);
  begin
    perform sustituir_por_subensamble(v_eq2, array(select id from bom_lineas where padre_id = v_eq2 limit 1), v_sub);
    assert false, 'un vendedor pudo sustituir líneas';
  exception when insufficient_privilege then null;
  end;
  perform pg_temp.como_postgres();

  -- ---------------------------------------------------------------------------
  -- Duplicar con otros parámetros conserva la medida especial
  -- ---------------------------------------------------------------------------
  insert into articulos (clave, tipo, nombre, categoria_id, medida_especial) values ('T50-TOL', 'equipo', 'Tolva especial',
    (select id from categorias where nombre = 'Tolva'), true) returning id into v_tolva;
  insert into bom_lineas (padre_id, hijo_id, cantidad) values (v_tolva, v_lam, 10);
  perform pg_temp.como(v_ing);
  v_copia := duplicar_articulo(v_tolva, 'T50-TOL2', 'Tolva especial (copia)', '{}');
  v_copia := duplicar_articulo(v_eq, 'T50-B22', 'Banda 18" x 22 m', '{"largo_m": 22}');
  perform pg_temp.como_postgres();
  assert (select medida_especial from articulos where clave = 'T50-TOL2'), 'la copia perdió la medida especial';
  assert (select precio from precios_lista where articulo_id = (select id from articulos where clave = 'T50-TOL2'))
       = (select precio from precios_lista where articulo_id = v_tolva), 'la copia idéntica de la tolva no da el mismo precio';
  assert (select costo_total from costos_calculados where articulo_id = v_copia) > (select costo_total from costos_calculados where articulo_id = v_eq),
    'la banda de 22 m debía costar más que la de 20 m';
  select count(*) into v_n from historial_costeo where articulo_id = v_copia;
  assert v_n = 1, format('la copia debía nacer con una sola foto en el historial, tiene %s', v_n);
  assert not exists (select 1 from historial_costeo where articulo_id = v_copia and costo_total = 0), 'quedó una foto de $0 de la copia';

  -- ---------------------------------------------------------------------------
  -- Desglose del precio: el caso E-315 de la hoja (banda 32 %, $91,345.69 → $202,000)
  -- ---------------------------------------------------------------------------
  perform pg_temp.como_postgres();
  update bom_lineas set cantidad = 1 where padre_id = v_tolva;
  update costos_articulo set costo = 9134.569 where articulo_id = v_lam;
  update articulos set categoria_id = (select id from categorias where nombre = 'Banda Transportadora'), medida_especial = false where id = v_tolva;
  perform pg_temp.como(v_ing);
  v_j := desglose_precio(v_tolva);
  assert (v_j->>'costo')::numeric = 9134.57, format('costo del desglose %s', v_j->>'costo');
  -- Ingeniería (costos 2) puede capturar un costo; el desglose sigue al instante.
  update costos_articulo set costo = 91345.69 where articulo_id = v_lam;
  v_j := desglose_precio(v_tolva);
  assert (v_j->>'precio_sin_redondeo')::numeric = 201941.29, format('V de E-315 debía ser 201,941.29 y salió %s', v_j->>'precio_sin_redondeo');
  assert (v_j->>'precio_redondeado')::numeric = 202000, format('W de E-315 debía ser 202,000 y salió %s', v_j->>'precio_redondeado');
  assert (v_j->>'base')::numeric = 100936.99, format('costo con recargos sobre costo: %s', v_j->>'base');
  assert round((v_j->>'pct_neto')::numeric, 4) = 0.3201, format('utilidad neta de E-315 debía ser 32.01 %% y salió %s', v_j->>'pct_neto');
  assert (v_j->>'utilidad_bruta')::numeric = 86220.33, format('utilidad bruta (Z) de E-315: %s', v_j->>'utilidad_bruta');
  assert jsonb_array_length(v_j->'recargos_precio') = 5, 'faltan recargos sobre precio';
  perform pg_temp.como_postgres();

  -- ---------------------------------------------------------------------------
  -- Simulador: subir la utilidad de bandas mueve sus precios y nada más
  -- ---------------------------------------------------------------------------
  perform pg_temp.como(v_ing);
  select count(*) filter (where precio_simulado > precio_actual), count(*) filter (where precio_simulado < precio_actual)
    into v_n, v_fotos
  from simular_precios((select id from politicas_precio where nombre = 'Banda Transportadora'), '{"utilidad": 0.35}');
  assert v_n >= 3 and v_fotos = 0, format('subir la utilidad debía subir precios (%s suben, %s bajan)', v_n, v_fotos);
  -- Sin cambios, el simulador reproduce los precios actuales.
  select count(*) into v_n from simular_precios((select id from politicas_precio where nombre = 'Banda Transportadora'), '{}')
  where precio_simulado is distinct from precio_actual and clave like 'T50-%';
  assert v_n = 0, format('sin cambios el simulador movió %s precios', v_n);
  -- Una utilidad imposible no da precio (no un precio negativo).
  select count(*) into v_n from simular_precios((select id from politicas_precio where nombre = 'Banda Transportadora'), '{"utilidad": 0.9}')
  where precio_simulado is not null;
  assert v_n = 0, 'una utilidad de 90 % compensada por ISR no tiene solución y dio precio';

  -- ISR: solo quien administra costos (dirección), no ingeniería.
  begin
    perform fijar_isr_compensacion(0.30);
    assert false, 'ingeniería pudo cambiar el ISR de compensación';
  exception when insufficient_privilege then null;
  end;
  perform pg_temp.como(v_dir);
  perform fijar_isr_compensacion(0.30);
  perform pg_temp.como_postgres();
  assert (select valor::text::numeric from configuracion where clave = 'isr_compensacion') = 0.30, 'no se guardó el ISR';
  assert exists (select 1 from bitacora where tabla = 'configuracion' and registro_id = 'isr_compensacion' and usuario_id = v_dir),
    'el cambio de ISR no quedó en la bitácora con su usuario';
  assert (select precio from precios_lista where articulo_id = v_tolva) > 202000, 'subir el ISR debía subir el precio';

  -- ---------------------------------------------------------------------------
  -- Precio por canal para ingeniería (antes recibía null porque no ve "canales")
  -- ---------------------------------------------------------------------------
  perform pg_temp.como(v_ing);
  select count(*) filter (where precio_sugerido > 0) into v_n from precios_por_canal(v_rod);
  assert v_n >= 2, format('ingeniería debía ver precio sugerido en ML y sitio web, vio %s', v_n);
  perform pg_temp.como_postgres();

  -- ---------------------------------------------------------------------------
  -- Solicitudes de cambio: producción las manda, ingeniería las resuelve
  -- ---------------------------------------------------------------------------
  perform pg_temp.como(v_prod);
  insert into solicitudes_cambio_bom (articulo_id, descripcion) values (v_eq, 'Los rodillos son de 14"') returning id into v_sol;
  begin
    perform resolver_solicitud_cambio(v_sol, 'aplicada');
    assert false, 'producción pudo resolver su propia solicitud de cambio';
  exception when insufficient_privilege then null;
  end;
  perform pg_temp.como(v_ing);
  perform resolver_solicitud_cambio(v_sol, 'aplicada');
  perform pg_temp.como_postgres();
  select * into r from solicitudes_cambio_bom where id = v_sol;
  assert r.estado = 'aplicada' and r.resuelto_por = v_ing and r.resuelto_en is not null, 'la solicitud no quedó resuelta por ingeniería';

  -- ---------------------------------------------------------------------------
  -- Reordenar en una sola llamada y árbol en el orden capturado
  -- ---------------------------------------------------------------------------
  perform pg_temp.como(v_ing);
  perform reordenar_bom(v_eq, array(select id from bom_lineas where padre_id = v_eq order by orden desc));
  assert (select array_agg(linea_id) from arbol_lista_materiales(v_eq) where nivel = 1)
       = (select array_agg(id order by orden) from bom_lineas where padre_id = v_eq),
    'arbol_lista_materiales no respeta el orden de las líneas';
  -- El contenido del subensamble viene debajo de su línea, con la ruta por líneas.
  select count(*) into v_n from arbol_lista_materiales(v_eq) where nivel = 2;
  assert v_n = 4, format('esperaba 4 líneas del subensamble en el árbol, hay %s', v_n);
  perform pg_temp.como_postgres();

  -- Clave sugerida: siguiente número con el prefijo más usado del tipo.
  assert sugerir_clave('subensamble') is not null, 'sin clave sugerida';
end $$;

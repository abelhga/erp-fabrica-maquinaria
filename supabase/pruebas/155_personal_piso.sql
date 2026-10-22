-- Personal de piso: RH decide el departamento; la gerencia de producción acomoda solo a la
-- gente de Producción, y solo quien entra a cuadrillas se anota en una etapa.
do $$
declare v_gp uuid; v_rh uuid; v_sup uuid; v_prod int; v_vtas int; e_sol uuid; e_coord uuid; e_vend uuid;
  v_eq uuid; v_op uuid; x1 uuid; v_ok boolean;
begin
  v_gp := pg_temp.usuario('gp155@hegamex.com', '{gerente_produccion}');
  v_rh := pg_temp.usuario('rh155@hegamex.com', '{rrhh}');
  v_sup := pg_temp.usuario('sup155@hegamex.com', '{produccion}');
  v_prod := departamento_produccion();
  if v_prod is null then insert into departamentos (nombre) values ('Producción') returning id into v_prod; end if;
  select id into v_vtas from departamentos where nombre = 'Ventas';
  if v_vtas is null then insert into departamentos (nombre) values ('Ventas') returning id into v_vtas; end if;

  -- Alta de RH: el soldador de Producción con área entra solo; el coordinador sin área no;
  -- un vendedor nunca, aunque alguien lo marque.
  insert into empleados (nombre, fecha_ingreso, departamento_id, etapa_id, telefono)
    values ('Soldador 155', current_date, v_prod, (select id from etapas where nombre = 'Pailería'), '3300000155') returning id into e_sol;
  insert into empleados (nombre, fecha_ingreso, departamento_id) values ('Coordinador 155', current_date, v_prod) returning id into e_coord;
  insert into empleados (nombre, fecha_ingreso, departamento_id, en_cuadrillas) values ('Vendedor 155', current_date, v_vtas, true) returning id into e_vend;
  assert (select en_cuadrillas from empleados where id = e_sol), 'el soldador no entró a cuadrillas';
  assert not (select en_cuadrillas from empleados where id = e_coord), 'el coordinador entró a cuadrillas solo';
  assert not (select en_cuadrillas from empleados where id = e_vend), 'un vendedor quedó en cuadrillas';

  -- La gerencia ve la ficha de su gente, no la de ventas.
  perform pg_temp.como(v_gp);
  assert exists (select 1 from empleados where id = e_sol), 'la gerencia no ve a su gente';
  assert not exists (select 1 from empleados where id = e_vend), 'la gerencia ve la ficha de un vendedor';
  assert exists (select 1 from personal_produccion() where id = e_coord), 'personal_produccion no trae al coordinador';
  assert not exists (select 1 from personal_produccion() where id = e_vend), 'personal_produccion trae a un vendedor';

  -- Acomoda a su gente: el coordinador entra a cuadrillas en Pintura.
  perform ajustar_personal_piso(e_coord, (select id from etapas where nombre = 'Pintura'), true);
  assert (select en_cuadrillas and etapa_id = (select id from etapas where nombre = 'Pintura') from empleados where id = e_coord), 'no se acomodó al coordinador';
  -- A un vendedor no lo toca.
  begin perform ajustar_personal_piso(e_vend, null, false); v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'la gerencia de producción acomodó a un vendedor';

  -- El supervisor no acomoda personal.
  perform pg_temp.como(v_sup);
  begin perform ajustar_personal_piso(e_sol, null, false); v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'el supervisor acomodó personal';
  -- La terminal solo ofrece a quien entra a cuadrillas.
  assert exists (select 1 from personal_de_piso() where id = e_sol), 'la terminal no ofrece al soldador';
  assert not exists (select 1 from personal_de_piso() where id = e_vend), 'la terminal ofrece a un vendedor';

  -- RH sí puede con cualquiera, pero un vendedor no entra a cuadrillas sin cambiar de departamento.
  perform pg_temp.como(v_rh);
  begin perform ajustar_personal_piso(e_vend, null, true); v_ok := true; exception when raise_exception then v_ok := false; end;
  assert not v_ok, 'un vendedor entró a cuadrillas';

  -- Y en la base: nadie fuera de cuadrillas se anota en una etapa.
  perform pg_temp.como_postgres();
  insert into articulos (clave, tipo, nombre) values ('T155-EQ', 'equipo', 'Tolva 155') returning id into v_eq;
  insert into ordenes_produccion (articulo_id, cantidad, estado) values (v_eq, 1, 'liberada') returning id into v_op;
  insert into op_operaciones (orden_id, etapa_id, horas_estimadas) values (v_op, (select id from etapas where nombre = 'Pailería'), 4) returning id into x1;
  perform pg_temp.como(v_sup);
  begin perform avanzar_operacion(x1, 'inicio', null, null, array[e_vend], 0); v_ok := true; exception when raise_exception then v_ok := false; end;
  assert not v_ok, 'se anotó en la terminal a alguien fuera de cuadrillas';
  perform avanzar_operacion(x1, 'inicio', null, null, array[e_sol], 0);
  assert exists (select 1 from op_tiempos where operacion_id = x1 and empleado_id = e_sol and fin is null), 'el soldador no se anotó';
end $$;

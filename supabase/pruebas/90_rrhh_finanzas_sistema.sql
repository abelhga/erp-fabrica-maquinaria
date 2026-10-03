-- RRHH, finanzas y sistema: lo que hacen cumplir la base y la RLS para esas pantallas.
-- Cada regla con su caso "este rol NO debe poder".
do $$
declare
  v_dir uuid; v_admin uuid; v_admin2 uuid; v_rrhh uuid; v_ger uuid; v_fin uuid; v_vend uuid; v_trab uuid;
  v_emp uuid; v_emp2 uuid; v_inc uuid; v_n int; v_ini date; v_fin_ date; v_d date; v_j jsonb;
  v_cli uuid; v_ped uuid; v_prov uuid; v_oc uuid; v_oc2 uuid; r record;
begin
  v_dir := pg_temp.usuario('dir90@hegamex.com', '{direccion}');
  v_admin := pg_temp.usuario('sis90@hegamex.com', '{admin}');
  v_admin2 := pg_temp.usuario('sis90b@hegamex.com', '{admin}');
  v_rrhh := pg_temp.usuario('rh90@hegamex.com', '{rrhh}');
  v_ger := pg_temp.usuario('gp90@hegamex.com', '{gerente_produccion}');
  v_fin := pg_temp.usuario('fin90@hegamex.com', '{finanzas}');
  v_vend := pg_temp.usuario('ven90@hegamex.com', '{ventas}');
  v_trab := pg_temp.usuario('sold90@hegamex.com', '{produccion}');

  -- ---------------------------------------------------------------------------
  -- Calendario: feriados de ley (art. 74) y días hábiles con la semana laboral
  -- ---------------------------------------------------------------------------
  assert (select array_agg(d order by d) from festivos_lft(2026) d)
       = '{2026-01-01,2026-02-02,2026-03-16,2026-05-01,2026-09-16,2026-11-16,2026-12-25}'::date[], 'feriados 2026';
  assert exists (select 1 from festivos_lft(2030) d where d = '2030-10-01'), '1 de octubre de 2030 (transmisión del Ejecutivo)';
  assert not exists (select 1 from festivos_lft(2026) d where d = '2026-10-01'), 'el 1 de octubre solo cada seis años';
  assert dias_habiles('2026-09-14', '2026-09-19') = 5, 'lunes a sábado menos el 16 de septiembre';
  assert dias_habiles('2026-12-21', '2027-01-02') = 10, 'dos semanas de diciembre menos Navidad y Año Nuevo';
  -- LFT reformada en 2023: 12, +2 por año hasta 20, luego +2 cada 5 años.
  assert dias_vacaciones(1) = 12 and dias_vacaciones(2) = 14 and dias_vacaciones(5) = 20 and dias_vacaciones(6) = 22
     and dias_vacaciones(10) = 22 and dias_vacaciones(11) = 24 and dias_vacaciones(20) = 26 and dias_vacaciones(21) = 28, 'tabla de vacaciones LFT';

  -- ---------------------------------------------------------------------------
  -- Personal y datos sensibles
  -- ---------------------------------------------------------------------------
  perform pg_temp.como(v_rrhh);
  insert into empleados (nombre, fecha_ingreso, usuario_id) values (' Prueba Soldador ', (current_date - interval '3 years 2 months')::date, v_trab)
    returning id into v_emp;
  insert into empleados (nombre, fecha_ingreso) values ('Prueba Nuevo', current_date - 100) returning id into v_emp2;
  assert (select nombre from empleados where id = v_emp) = 'Prueba Soldador', 'nombre sin espacios de más';
  insert into empleado_datos (empleado_id, curp, rfc, nss, salario_diario)
    values (v_emp, 'pena920127hjcrvc05', 'PENA920127AB1', '123-4567-8901', 520);
  assert (select curp from empleado_datos where empleado_id = v_emp) = 'PENA920127HJCRVC05', 'CURP en mayúsculas';
  assert (select nss from empleado_datos where empleado_id = v_emp) = '12345678901', 'NSS sin guiones';
  begin
    insert into empleado_datos (empleado_id, curp) values (v_emp2, 'XXXX');
    assert false, 'aceptó una CURP mal formada';
  exception when raise_exception then null;
  end;

  -- Baja sin fecha ni motivo: no.
  begin
    update empleados set activo = false where id = v_emp2;
    assert false, 'dio de baja sin fecha ni motivo';
  exception when raise_exception then null;
  end;

  -- Vacaciones: 3 años cumplidos = 16 días; antes del primer año, nada (art. 76).
  select * into r from v_vacaciones where empleado_id = v_emp;
  assert r.anios = 3 and r.dias_periodo = 16 and r.saldo = 16, format('vacaciones a 3 años: %s', row_to_json(r));
  assert r.dias_proximo_periodo = 18, 'al cumplir 4 años le tocan 18';
  assert (select dias_periodo from v_vacaciones where empleado_id = v_emp2) = 0, 'antes del primer año no hay vacaciones';

  -- Solo RRHH nivel 3 (y dirección) ve datos sensibles. El gerente de producción ve a su gente, sin ellos.
  perform pg_temp.como(v_ger);
  select count(*) into v_n from empleados where id = v_emp;
  assert v_n = 1, 'el gerente de producción debe ver a su gente';
  select count(*) into v_n from empleado_datos;
  assert v_n = 0, 'el gerente de producción vio datos sensibles';
  begin
    insert into empleado_datos (empleado_id, salario_diario) values (v_emp2, 999);
    assert false, 'el gerente de producción capturó un salario';
  exception when insufficient_privilege then null;
  end;
  perform pg_temp.como(v_admin);
  select count(*) into v_n from empleado_datos;
  assert v_n = 0, 'sistemas vio datos sensibles';
  perform pg_temp.como(v_fin);
  select count(*) into v_n from empleados;
  assert v_n = 0, 'finanzas vio el personal';
  select count(*) into v_n from empleado_datos;
  assert v_n = 0, 'finanzas vio datos sensibles';
  perform pg_temp.como(v_trab);
  select count(*) into v_n from empleado_datos;
  assert v_n = 0, 'el propio trabajador no ve su expediente sensible desde el ERP';
  perform pg_temp.como(v_rrhh);
  select count(*) into v_n from empleado_datos where empleado_id = v_emp;
  assert v_n = 1, 'RRHH nivel 3 ve datos sensibles';
  perform pg_temp.como(v_dir);
  select count(*) into v_n from empleado_datos where empleado_id = v_emp;
  assert v_n = 1, 'dirección ve datos sensibles';

  -- ---------------------------------------------------------------------------
  -- Incidencias: quien no es RRHH solo pide; la base cuenta los días
  -- ---------------------------------------------------------------------------
  v_ini := date_trunc('week', current_date - 14)::date;   -- un lunes dentro del periodo actual
  v_fin_ := v_ini + 5;
  perform pg_temp.como(v_trab);
  insert into incidencias (empleado_id, tipo, inicio, fin, estado, dias) values (v_emp, 'vacaciones', v_ini, v_fin_, 'aprobada', 1)
    returning id into v_inc;
  perform pg_temp.como_postgres();
  select * into r from incidencias where id = v_inc;
  assert r.estado = 'solicitada', 'el trabajador se aprobó sus propias vacaciones';
  assert r.dias = dias_habiles(v_ini, v_fin_) and r.dias > 0, format('días hábiles calculados por la base: %s', r.dias);
  assert r.solicitada_por = v_trab and r.resuelta_por is null, 'quién la pidió';

  perform pg_temp.como(v_trab);
  update incidencias set estado = 'aprobada' where id = v_inc;
  get diagnostics v_n = row_count;
  assert v_n = 0, 'el trabajador aprobó sus vacaciones con un update';
  perform pg_temp.como(v_ger);
  update incidencias set estado = 'aprobada' where id = v_inc;
  get diagnostics v_n = row_count;
  assert v_n = 0, 'el gerente de producción aprobó (es de RRHH)';

  perform pg_temp.como(v_rrhh);
  update incidencias set estado = 'aprobada' where id = v_inc;
  select * into r from incidencias where id = v_inc;
  assert r.estado = 'aprobada' and r.resuelta_por = v_rrhh, 'RRHH aprueba y queda quién';
  assert (select saldo from v_vacaciones where empleado_id = v_emp) = 16 - r.dias, 'el saldo descuenta lo aprobado';

  begin
    insert into incidencias (empleado_id, tipo, inicio, fin) values (v_emp, 'permiso_con_goce', v_ini, v_fin_);
    assert false, 'aceptó dos ausencias en los mismos días';
  exception when raise_exception then null;
  end;
  insert into incidencias (empleado_id, tipo, inicio, fin, estado) values (v_emp, 'incapacidad', v_ini + 14, v_ini + 20, 'aprobada') returning id into v_inc;
  assert (select dias from incidencias where id = v_inc) = 7, 'la incapacidad cuenta días naturales';
  insert into incidencias (empleado_id, tipo, inicio, fin, horas, estado) values (v_emp2, 'retardo', v_ini, v_ini + 3, 0.5, 'aprobada') returning id into v_inc;
  select * into r from incidencias where id = v_inc;
  assert r.dias = 0 and r.fin = r.inicio, 'un retardo es de un día y no descuenta días';
  begin
    insert into incidencias (empleado_id, tipo, inicio, fin) values (v_emp2, 'horas_extra', v_ini, v_ini);
    assert false, 'horas extra sin horas';
  exception when raise_exception then null;
  end;
  select min(x)::date into v_d from generate_series(v_ini + 28, v_ini + 40, interval '1 day') x where dias_habiles(x::date, x::date) = 1;
  insert into incidencias (empleado_id, tipo, inicio, fin, dias) values (v_emp2, 'permiso_con_goce', v_d, v_d, 0.5) returning id into v_inc;
  assert (select dias from incidencias where id = v_inc) = 0.5, 'medio día de permiso';

  -- ---------------------------------------------------------------------------
  -- Bitácora: guarda el alta completa, pero no enseña sueldos ni costos a sistemas
  -- ---------------------------------------------------------------------------
  perform pg_temp.como_postgres();
  insert into bitacora (tabla, registro_id, accion, cambios) values ('politicas_precio', '1', 'cambio', '{"utilidad":[0.30,0.35]}');
  perform pg_temp.como(v_admin);
  select count(*) into v_n from bitacora where tabla = 'empleado_datos' and registro_id = v_emp::text;
  assert v_n = 0, 'sistemas leyó salarios en la bitácora';
  select count(*) into v_n from bitacora where tabla = 'politicas_precio' and cambios ? 'utilidad';
  assert v_n = 0, 'sistemas leyó utilidades en la bitácora';
  select count(*) into v_n from bitacora where tabla = 'usuario_roles' and registro_id like v_vend::text || ':%';
  assert v_n = 1, 'sistemas sí ve los cambios de roles';
  perform pg_temp.como(v_dir);
  select cambios into v_j from bitacora where tabla = 'empleado_datos' and registro_id = v_emp::text and accion = 'alta';
  assert (v_j->'salario_diario'->>1)::numeric = 520 and v_j->'salario_diario'->0 = 'null'::jsonb, format('el alta guarda los valores: %s', v_j);
  assert exists (select 1 from v_bitacora where tabla = 'empleados' and registro_id = v_emp::text and accion = 'alta'
                 and etiqueta = 'Prueba Soldador' and usuario = (select nombre from perfiles where id = v_rrhh)), 'etiqueta y quién en v_bitacora';
  select count(*) into v_n from bitacora where tabla = 'politicas_precio' and cambios ? 'utilidad';
  assert v_n >= 1, 'dirección ve todo en la bitácora';
  perform pg_temp.como(v_fin);
  select count(*) into v_n from bitacora;
  assert v_n = 0, 'finanzas no ve la bitácora';

  -- ---------------------------------------------------------------------------
  -- Roles, usuarios, invitaciones y matriz de permisos
  -- ---------------------------------------------------------------------------
  perform pg_temp.como(v_fin);
  begin
    insert into usuario_roles values (v_vend, 'compras');
    assert false, 'finanzas dio un rol';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into usuario_roles values (v_fin, 'admin');
    assert false, 'finanzas se dio un rol';
  exception when insufficient_privilege then null;
  end;
  update permisos_rol set nivel = 3 where rol = 'finanzas' and modulo = 'ventas';
  get diagnostics v_n = row_count;
  assert v_n = 0, 'finanzas cambió la matriz de permisos';
  begin
    perform * from lista_usuarios();
    assert false, 'finanzas vio la lista de usuarios con último acceso';
  exception when insufficient_privilege then null;
  end;

  -- Sistemas da y quita roles a otros, pero no se da a sí mismo ni da "dirección".
  perform pg_temp.como(v_admin);
  insert into usuario_roles values (v_vend, 'compras');
  delete from usuario_roles where usuario_id = v_vend and rol = 'compras';
  begin
    insert into usuario_roles values (v_admin, 'finanzas');
    assert false, 'sistemas se dio un rol a sí mismo';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into usuario_roles values (v_vend, 'direccion');
    assert false, 'sistemas dio el rol de dirección (y con él costos)';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from usuario_roles where usuario_id = v_dir and rol = 'direccion';
    assert false, 'sistemas le quitó el rol a dirección';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into invitaciones (correo, roles) values ('socio@gmail.com', '{direccion}');
    assert false, 'sistemas invitó a alguien como dirección';
  exception when insufficient_privilege then null;
  end;
  begin
    update perfiles set activo = false where id = v_admin;
    assert false, 'sistemas se desactivó a sí mismo';
  exception when insufficient_privilege then null;
  end;
  begin
    update perfiles set activo = false where id = v_dir;
    assert false, 'sistemas desactivó a dirección';
  exception when insufficient_privilege then null;
  end;
  update perfiles set activo = false where id = v_admin2;
  assert not (select activo from perfiles where id = v_admin2), 'sistemas desactiva a otro usuario';
  begin
    insert into permisos_rol values ('admin', 'costos', 1);
    assert false, 'sistemas se dio costos en la matriz';
  exception when insufficient_privilege then null;
  end;

  select * into r from lista_usuarios() where id = v_vend;
  assert r.roles = '{ventas}'::app_rol[] and r.activo and r.ultimo_acceso is null, format('lista de usuarios: %s', row_to_json(r));
  assert (select empleado from lista_usuarios() where id = v_trab) = 'Prueba Soldador', 'empleado ligado al usuario';

  insert into invitaciones (correo, nombre, roles) values ('  Contador@Despacho.MX ', 'Contador', '{finanzas}');
  assert exists (select 1 from invitaciones where correo = 'contador@despacho.mx' and invitado_por = v_admin), 'invitación normalizada y con quién';
  begin
    insert into invitaciones (correo, roles) values ((select correo from perfiles where id = v_vend), '{compras}');
    assert false, 'invitó a alguien que ya tiene cuenta';
  exception when raise_exception then null;
  end;

  -- Dirección sí da "dirección" y cambia la matriz, pero no se baja a sí misma.
  perform pg_temp.como(v_dir);
  insert into usuario_roles values (v_vend, 'direccion');
  delete from usuario_roles where usuario_id = v_vend and rol = 'direccion';
  update permisos_rol set nivel = 2 where rol = 'finanzas' and modulo = 'ventas';
  get diagnostics v_n = row_count;
  assert v_n = 1, 'dirección cambia la matriz';
  assert exists (select 1 from bitacora where tabla = 'permisos_rol' and registro_id = 'finanzas:ventas' and accion = 'cambio'),
    'el cambio de la matriz queda en bitácora con llave legible';
  begin
    update permisos_rol set nivel = 1 where rol = 'direccion' and modulo = 'admin';
    assert false, 'dirección se bajó su propio nivel';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from permisos_rol where rol = 'direccion' and modulo = 'costos';
    assert false, 'dirección se quitó costos';
  exception when insufficient_privilege then null;
  end;

  -- ---------------------------------------------------------------------------
  -- Configuración: catálogos de sistema sí; lo que mueve precios, no
  -- ---------------------------------------------------------------------------
  perform pg_temp.como(v_admin);
  insert into almacenes (nombre) values ('Contenedor de prueba 90');
  update etapas set capacidad_horas_semana = capacidad_horas_semana + 0 where nombre = 'Pintura';
  get diagnostics v_n = row_count;
  assert v_n = 1, 'sistemas ajusta etapas del taller';
  update canales set comision_pct = 0.5 where canal = 'mercadolibre';
  get diagnostics v_n = row_count;
  assert v_n = 0, 'sistemas cambió la comisión de un canal (mueve precios publicados)';
  begin
    insert into tipos_cambio (fecha, moneda, valor) values (current_date + 1, 'USD', 30);
    assert false, 'sistemas capturó tipo de cambio';
  exception when insufficient_privilege then null;
  end;
  update textos_comerciales set por_defecto = true where id = (select max(id) from textos_comerciales where tipo = 'pago');
  assert (select count(*) from textos_comerciales where tipo = 'pago' and por_defecto) = 1, 'un solo texto de pago por defecto';
  perform pg_temp.como(v_fin);
  begin
    insert into almacenes (nombre) values ('Almacén de finanzas');
    assert false, 'finanzas dio de alta un almacén';
  exception when insufficient_privilege then null;
  end;
  perform pg_temp.como(v_vend);
  update textos_comerciales set texto = 'x' where tipo = 'pago';
  get diagnostics v_n = row_count;
  assert v_n = 0, 'un vendedor cambió los textos comerciales';

  -- ---------------------------------------------------------------------------
  -- Cobranza: antigüedad desde la factura, sin cobrar de más, UUID con forma
  -- ---------------------------------------------------------------------------
  perform pg_temp.como_postgres();
  insert into clientes (nombre, dias_credito) values ('Cliente de prueba 90', 30) returning id into v_cli;
  insert into pedidos (cliente_id) values (v_cli) returning id into v_ped;
  insert into pedido_lineas (pedido_id, titulo, cantidad, precio_unitario) values (v_ped, 'Banda 18"', 1, 100000);
  assert (select total from pedidos where id = v_ped) = 116000, 'total con IVA';

  perform pg_temp.como(v_fin);
  insert into cobros (pedido_id, monto, referencia) values (v_ped, 58000, 'SPEI 1');
  select * into r from v_cobranza where pedido_id = v_ped;
  assert r.saldo = 58000 and r.rango = '0-30' and not r.facturado and r.saldo_mxn = 58000, format('cobranza: %s', row_to_json(r));
  begin
    insert into cobros (pedido_id, monto) values (v_ped, 60000);
    assert false, 'aceptó un cobro que deja el pedido pagado de más';
  exception when raise_exception then null;
  end;
  insert into facturas (pedido_id, folio, uuid_sat, total, fecha)
    values (v_ped, ' A 9001 ', 'ad2f4b1c-1111-4abc-9def-0123456789ab', 116000, current_date - 45);
  assert (select uuid_sat from facturas where pedido_id = v_ped) = 'AD2F4B1C-1111-4ABC-9DEF-0123456789AB', 'UUID en mayúsculas';
  select * into r from v_cobranza where pedido_id = v_ped;
  assert r.dias = 45 and r.rango = '31-60' and r.vence = current_date - 15 and r.facturas = 'A 9001',
    format('antigüedad desde la factura y vencimiento con el crédito: %s', row_to_json(r));
  begin
    insert into facturas (pedido_id, folio, uuid_sat, total) values (v_ped, 'A 9002', 'no-es-un-uuid', 10);
    assert false, 'aceptó un UUID del SAT mal formado';
  exception when raise_exception then null;
  end;
  assert (select cobrado from cobranza_por_mes(1)) >= 58000, 'la gráfica por mes trae el cobro';
  perform pg_temp.como(v_vend);
  begin
    insert into cobros (pedido_id, monto) values (v_ped, 1);
    assert false, 'un vendedor registró un cobro';
  exception when insufficient_privilege then null;
  end;

  -- ---------------------------------------------------------------------------
  -- Pagos a proveedores: nada a órdenes en borrador ni de más
  -- ---------------------------------------------------------------------------
  perform pg_temp.como_postgres();
  insert into proveedores (nombre, dias_credito) values ('Proveedor de prueba 90', 30) returning id into v_prov;
  insert into ordenes_compra (proveedor_id, estado) values (v_prov, 'borrador') returning id into v_oc2;
  insert into oc_lineas (orden_compra_id, descripcion, cantidad, costo_unitario) values (v_oc2, 'Lámina', 1, 1000);
  insert into ordenes_compra (proveedor_id, estado, vence_pago) values (v_prov, 'recibida', current_date - 5) returning id into v_oc;
  insert into oc_lineas (orden_compra_id, descripcion, cantidad, costo_unitario, recibido) values (v_oc, 'Lámina cal. 10', 10, 1000, 10);
  perform pg_temp.como(v_fin);
  begin
    insert into pagos_proveedor (orden_compra_id, monto) values (v_oc2, 100);
    assert false, 'pagó una orden en borrador';
  exception when raise_exception then null;
  end;
  insert into pagos_proveedor (orden_compra_id, monto) values (v_oc, 5000);
  select * into r from v_por_pagar where orden_compra_id = v_oc;
  assert r.saldo = 6600 and r.dias_para_vencer = -5 and r.ultimo_pago = current_date, format('por pagar: %s', row_to_json(r));
  begin
    insert into pagos_proveedor (orden_compra_id, monto) values (v_oc, 7000);
    assert false, 'pagó de más a un proveedor';
  exception when raise_exception then null;
  end;
  insert into pagos_proveedor (orden_compra_id, monto) values (v_oc, 6600);
  assert not exists (select 1 from v_por_pagar where orden_compra_id = v_oc), 'una orden liquidada sale de cuentas por pagar';
  perform pg_temp.como(v_rrhh);
  select count(*) into v_n from v_por_pagar;
  assert v_n = 0, 'RRHH vio cuentas por pagar';
end $$;

-- Teléfonos y cuentas pegados desde Excel como número ("3312637588.0"): se guardan limpios,
-- y lo que no es un número puro (con nombre, "no tiene") no se toca.
do $$
declare v_e uuid; r record;
begin
  assert formato_telefono(limpiar_numero_hoja('3312637588.0')) = '33 1263 7588', 'lada 33';
  assert formato_telefono(limpiar_numero_hoja('3911033372.0')) = '391 103 3372', 'lada de 3 dígitos';
  assert formato_telefono(limpiar_numero_hoja('33 1708 9348')) = '33 1708 9348', 'el que ya estaba bien cambió';
  assert formato_telefono(limpiar_numero_hoja('no tiene')) = 'no tiene', 'un texto cambió';
  assert formato_telefono(limpiar_numero_hoja('33 1724 8916 Adriana (esposa)')) = '33 1724 8916 Adriana (esposa)', 'un contacto con nombre cambió';
  assert limpiar_numero_hoja('14045445061.0') = '14045445061', 'cuenta con .0';
  assert limpiar_numero_hoja('Calle 15.0 interior') = 'Calle 15.0 interior', 'se tocó un texto que trae .0 adentro';

  -- Por el disparador: entra como lo pega Excel y se guarda limpio.
  insert into empleados (nombre, telefono, contacto_emergencia, fecha_ingreso)
  values ('T122 Prueba', '3312637588.0', '3919172968.0', current_date) returning id into v_e;
  insert into empleado_datos (empleado_id, cuenta_bancaria) values (v_e, '14045445061.0');
  select e.telefono, d.cuenta_bancaria, e.contacto_emergencia into r from empleados e join empleado_datos d on d.empleado_id = e.id where e.id = v_e;
  assert r.telefono = '33 1263 7588' and r.cuenta_bancaria = '14045445061' and r.contacto_emergencia = '391 917 2968', format('al guardar: %s', row_to_json(r));
end $$;

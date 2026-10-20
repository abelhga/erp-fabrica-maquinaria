-- Mercado Libre: los avisos llegan a todos los que lo atienden; solo dirección los elige.
-- Nómina: finanzas registra el pago de una semana cerrada, queda en la cuenta de la nómina
-- y RRHH ve "pagada" sin ver los demás pagos.
do $$
declare v_dir uuid; v_a uuid; v_b uuid; v_ven uuid; v_fin uuid; v_rh uuid; v_ok boolean; v_sem date; r record; v_t text;
begin
  v_dir := pg_temp.usuario('dir133@hegamex.com', '{direccion}');
  v_a := pg_temp.usuario('jc133@hegamex.com', '{ventas}');
  v_b := pg_temp.usuario('su133@hegamex.com', '{ventas,administracion}');
  v_fin := pg_temp.usuario('fin133@hegamex.com', '{finanzas}');
  v_rh := pg_temp.usuario('rh133@hegamex.com', '{rrhh}');

  -- Mercado Libre
  perform pg_temp.como(v_a);
  begin perform fijar_atienden_ml(array[v_a]); v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'un vendedor no elige quién atiende ML';
  perform pg_temp.como(v_dir);
  perform fijar_atienden_ml(array[v_a, v_b]);
  perform fijar_responsable_ml(v_b);
  perform pg_temp.como_postgres();
  assert ml_atienden() @> array[v_a, v_b] and cardinality(ml_atienden()) = 2, format('los avisos deben ir a los dos: %s', ml_atienden());
  assert ml_responsable() = v_b, 'las ventas van a nombre de quien se eligió';
  update configuracion set valor = valor || '{"atienden": [], "responsable_id": null}' where clave = 'mercadolibre';
  assert cardinality(ml_atienden()) = 1 and (select tiene_rol from (select (ml_atienden())[1] as u) x, lateral (select exists (select 1 from usuario_roles where usuario_id = x.u and rol = 'direccion') as tiene_rol) y),
    'sin nadie elegido, los avisos van a dirección';

  -- Nómina: una semana cerrada de hace un mes.
  v_sem := hoy_planta() - 35 - ((extract(isodow from hoy_planta() - 35)::int - 5 + 7) % 7);
  insert into nomina_semanas (inicio, estado, cerrada_en) values (v_sem, 'cerrada', now()) on conflict (inicio) do nothing;
  perform pg_temp.como(v_rh);
  begin perform pagar_semana_nomina(v_sem, hoy_planta(), 'santander_fiscal', 50000); v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'RRHH no registra pagos de finanzas';
  perform pg_temp.como(v_fin);
  perform pagar_semana_nomina(v_sem, hoy_planta() - 1, 'santander_fiscal', 50000);
  begin perform pagar_semana_nomina(v_sem, hoy_planta(), 'santander_fiscal', 50000); v_t := 'otra vez';
  exception when others then v_t := sqlerrm; end;
  assert v_t like 'Esa semana ya está pagada%', format('no debe pagarse dos veces: %s', v_t);
  assert exists (select 1 from v_pagos_hechos where tipo_acreedor = 'nomina' and monto = 50000 and fecha = hoy_planta() - 1), 'el pago no salió en Pagos hechos';
  assert (select saldo from v_saldo_arranque_proveedores s join proveedores p on p.id = s.proveedor_id
          where p.tipo_acreedor = 'nomina' and p.nombre ilike 'nomina%' order by p.activo desc, p.creado_en limit 1) is not null, 'la cuenta de la nómina';

  -- RRHH lo ve en su semana, sin ver los pagos de finanzas.
  perform pg_temp.como(v_rh);
  select * into r from semanas_nomina(16) where inicio = v_sem;
  assert r.pagada_el = hoy_planta() - 1 and r.pagada_monto = 50000 and r.pagada_cuenta is not null and r.pagada_por like 'fin133%',
    format('RRHH no ve la semana pagada: %s', row_to_json(r));
  assert not exists (select 1 from movimientos_proveedor), 'RRHH no debe ver los pagos de finanzas';
  assert exists (select 1 from avisos where usuario_id = v_rh and tipo = 'nomina_pagada'), 'no se avisó a RRHH';

  -- Una semana abierta no se paga, y una cerrada sigue sin poderse cambiar (salvo el pago).
  perform pg_temp.como(v_fin);
  begin perform pagar_semana_nomina(v_sem + 7, hoy_planta(), 'santander_fiscal', 100); v_ok := true; exception when others then v_ok := false; end;
  assert not v_ok, 'una semana sin cerrar no se paga';
  perform pg_temp.como_postgres();
  begin update nomina_semanas set notas = 'cambio' where inicio = v_sem; v_ok := true; exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'la semana cerrada no se modifica';
end $$;

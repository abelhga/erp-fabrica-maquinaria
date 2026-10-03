-- Envíos, saldo de paquetería y devoluciones "vivos" para ver y fotografiar las
-- pantallas en la base LOCAL.
--
--   psql "$DB_URL" -f scripts/demo/envios.sql                 crea lo que falte
--   node scripts/demo/envios-archivos.mjs                     sube fotos y guías, empaca y despacha
--   psql "$DB_URL" -v limpiar=1 -f scripts/demo/envios.sql    cancela los envíos y devoluciones DEMO abiertos
--
-- Necesita los usuarios locales (scripts/usuarios-locales.mjs) y, para la banda con
-- orden de producción, el equipo DEMO-E-102 de scripts/demo/produccion.sql (si no
-- está, esa parte se brinca).
--
-- Todo pasa por las funciones de la base con el usuario que lo haría: almacén mide
-- el empaque, Susana (ventas en línea) captura las ventas de Mercado Libre y pide
-- sus envíos, Isaac y Juan piden los suyos, finanzas registra recargas, la gerencia
-- de producción y el taller terminan la banda. Lo que necesita archivos (fotos de
-- empaque, PDF de la guía, fotos de cómo llegó una devolución) lo hace el script
-- de Node, porque los archivos se suben a Storage con la sesión de quien los toma.
--
-- Se reconoce por los clientes "DEMO ENV …" y las ventas de ML 20000091000xx.
-- Sin datos personales: contactos con puesto y sin teléfono, domicilios genéricos.
-- Los movimientos de inventario no se borran (nadie puede): limpiar cancela.
\set ON_ERROR_STOP on

\if :{?limpiar}
begin;
update public.envios e set estado = 'cancelado', cancelado_en = now(), motivo_cancelacion = 'Limpieza de la demostración'
from public.pedidos p join public.clientes c on c.id = p.cliente_id
where p.id = e.pedido_id and c.nombre like 'DEMO ENV %' and e.estado not in ('enviado', 'entregado', 'cancelado');
update public.envios set estado = 'cancelado', cancelado_en = now(), motivo_cancelacion = 'Limpieza de la demostración'
where tipo = 'a_full' and notas like 'DEMO%' and estado not in ('enviado', 'entregado', 'cancelado');
update public.devoluciones d set estado = 'cancelada', cancelado_en = now(), motivo_cancelacion = 'Limpieza de la demostración'
from public.pedidos p join public.clientes c on c.id = p.cliente_id
where p.id = d.pedido_id and c.nombre like 'DEMO ENV %' and d.estado not in ('resuelta', 'cancelada');
commit;
\echo 'Envíos y devoluciones DEMO cancelados.'
\quit
\endif

begin;

create or replace function pg_temp.soy(p_correo text) returns uuid language plpgsql as $$
declare v uuid;
begin
  perform set_config('role', 'postgres', true);
  select id into v from public.perfiles where correo = p_correo;
  if v is null then raise exception 'Falta el usuario %: corre node scripts/usuarios-locales.mjs', p_correo; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', v, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  return v;
end $$;

create or replace function pg_temp.postgres() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end $$;

-- Artículo real del catálogo por clave; si la base no tiene el catálogo, uno DEMO-ENV
-- con precio y existencia para que la demostración funcione igual.
create or replace function pg_temp.articulo(p_clave text, p_nombre text, p_precio numeric, p_existencia numeric) returns uuid
language plpgsql as $$
declare v uuid; v_pb int;
begin
  select id into v from public.articulos where clave = p_clave and activo;
  if v is not null then return v; end if;
  perform pg_temp.postgres();
  select id into v from public.articulos where clave = 'DEMO-ENV-' || p_clave;
  if v is null then
    insert into public.articulos (clave, tipo, nombre) values ('DEMO-ENV-' || p_clave, 'componente', p_nombre) returning id into v;
    insert into public.costos_articulo (articulo_id, costo, moneda) values (v, round(p_precio * 0.7, 2), 'MXN') on conflict do nothing;
    select id into v_pb from public.almacenes where nombre = 'Planta Baja';
    insert into public.movimientos_inventario (tipo, articulo_id, almacen_id, cantidad, motivo) values ('inicial', v, v_pb, p_existencia, 'DEMO envíos');
  end if;
  return v;
end $$;

do $$
declare
  v_hoy date := (now() at time zone 'America/Mexico_City')::date;
  v_isaac uuid; v_juan uuid; v_susana uuid; v_alm uuid; v_fin uuid; v_gp uuid; v_taller uuid; v_ing uuid;
  v_cos600 uuid; v_cos300 uuid; v_pol4 uuid; v_pol14 uuid; v_cat uuid; v_can uuid; v_torn uuid; v_banda uuid;
  v_estafeta int; v_fedex int; v_mlenv int; v_flete int; v_pb int; v_ml int;
  v_ml_cli uuid; v_granja uuid; v_molino uuid;
  v_p uuid; v_e uuid; v_op uuid; v_op_linea uuid; v_d uuid; r record;
begin
  if exists (select 1 from public.clientes where nombre like 'DEMO ENV %') then
    raise notice 'Ya están los envíos DEMO; no se crea nada. Para ver la parte con archivos: node scripts/demo/envios-archivos.mjs';
    return;
  end if;
  select id into v_pb from public.almacenes where nombre = 'Planta Baja';
  v_ml := public.almacen_ml();
  select id into v_estafeta from public.paqueterias where nombre = 'Estafeta';
  select id into v_fedex from public.paqueterias where nombre = 'FedEx';
  select id into v_mlenv from public.paqueterias where nombre = 'Mercado Envíos';
  select id into v_flete from public.paqueterias where nombre = 'Flete contratado';

  v_cos600 := pg_temp.articulo('C-00394', 'Cosedora manual N600A', 5858.70, 30);
  v_cos300 := pg_temp.articulo('C-00393', 'Cosedora manual F300A', 5523.92, 12);
  v_pol4 := pg_temp.articulo('C-00175', 'Polea 4" 1rb masa fija de fierro', 285.72, 10);
  v_pol14 := pg_temp.articulo('C-00173', 'Polea 14" 2rb masa fija de fierro', 1857.15, 10);
  v_cat := pg_temp.articulo('C-00007', 'Catarina 80-17', 357.15, 100);
  v_can := pg_temp.articulo('C-00382', 'Cangilón 6x5 azul, marca Tapco', 125.72, 200);
  v_torn := pg_temp.articulo('C-N0245', 'Tornillo p/cangilón 1/4 x 1 1/2 con uña galv.', 12.15, 600);
  select id into v_banda from public.articulos where clave = 'DEMO-E-102';

  -- ---------------------------------------------------------------------------
  -- Almacén pesa y mide una vez; desde ahí cada envío sale con estos datos. La
  -- cosedora N600A es la que en el chat se tecleó 20 veces con datos distintos.
  -- El cangilón se queda sin medir a propósito: se ve como "sin medidas".
  -- ---------------------------------------------------------------------------
  v_alm := pg_temp.soy('almacen@hegamex.com');
  perform public.guardar_empaque(v_cos600, 13, 38, 62, 29, 1);
  perform public.guardar_empaque(v_cos300, 8, 40, 40, 30, 1);
  perform public.guardar_empaque(v_pol4, 2.1, 15, 15, 10, 1);
  perform public.guardar_empaque(v_pol14, 9, 38, 38, 15, 1);
  perform public.guardar_empaque(v_cat, 6.5, 30, 30, 12, 10);
  perform public.guardar_empaque(v_torn, 3, 25, 18, 10, 100);

  -- Saldo: Estafeta con una recarga de $3,000; FedEx casi sin saldo (sale en rojo).
  v_fin := pg_temp.soy('finanzas@hegamex.com');
  perform public.registrar_recarga(v_estafeta, 3000, 'DEMO SPEI recarga Estafeta', null, v_hoy - 9);
  perform public.registrar_recarga(v_fedex, 600, 'DEMO SPEI recarga FedEx', null, v_hoy - 20);
  perform public.registrar_recarga(v_fedex, -85, 'DEMO cargo', 'Cargo por sobrepeso de una guía de septiembre', v_hoy - 6);

  -- ---------------------------------------------------------------------------
  -- Clientes (sus vendedores los dan de alta). Sin teléfonos: un número inventado
  -- puede ser de alguien real.
  -- ---------------------------------------------------------------------------
  v_susana := pg_temp.soy('susana@hegamex.com');
  insert into public.clientes (nombre, vendedor_id, ciudad, estado) values ('DEMO ENV Compradores Mercado Libre', v_susana, 'Varias', 'Varios') returning id into v_ml_cli;
  insert into public.contactos (cliente_id, nombre, puesto, domicilio, principal)
  values (v_ml_cli, 'Comprador DEMO de Mercado Libre', 'Comprador en línea', 'La etiqueta la genera Mercado Libre con el domicilio del comprador', true);
  v_isaac := pg_temp.soy('isaac@hegamex.com');
  insert into public.clientes (nombre, vendedor_id, ciudad, estado) values ('DEMO ENV Agrícola Los Altos', v_isaac, 'Tepatitlán', 'Jalisco') returning id into v_granja;
  insert into public.contactos (cliente_id, nombre, puesto, domicilio, principal)
  values (v_granja, 'Encargado de compras DEMO', 'Compras', 'Domicilio de demostración, carretera a Arandas km 5, Tepatitlán, Jal.', true);
  v_juan := pg_temp.soy('juan@hegamex.com');
  insert into public.clientes (nombre, vendedor_id, ciudad, estado) values ('DEMO ENV Molinos del Bajío', v_juan, 'León', 'Guanajuato') returning id into v_molino;
  insert into public.contactos (cliente_id, nombre, puesto, domicilio, principal)
  values (v_molino, 'Jefe de mantenimiento DEMO', 'Mantenimiento', 'Domicilio de demostración, parque industrial, León, Gto.', true);

  -- ---------------------------------------------------------------------------
  -- Ventas de Mercado Libre (las captura Susana).
  -- ---------------------------------------------------------------------------
  perform pg_temp.soy('susana@hegamex.com');
  -- 1. Cosedora N600A: Mercado Envíos; la guía (PDF) y la salida las hace el script de archivos.
  insert into public.pedidos (cliente_id, vendedor_id, canal, id_externo, notas) values (v_ml_cli, v_susana, 'mercadolibre', '2000009100001', 'DEMO envíos')
  returning id into v_p;
  perform public.agregar_partida_pedido(v_p, v_cos600, 1);
  v_e := public.pedir_envio(v_p, 'paqueteria', p_paqueteria => v_mlenv, p_notas => 'Va con su aceite y 2 agujas de regalo');
  perform public.cotizar_envio(v_e, 0, v_mlenv, 'Mercado Envíos', 'Lo paga el comprador');

  -- 2. Cangilones y tornillería: por cotizar (el cangilón no tiene empaque capturado).
  insert into public.pedidos (cliente_id, vendedor_id, canal, id_externo, notas) values (v_ml_cli, v_susana, 'mercadolibre', '2000009100002', 'DEMO envíos')
  returning id into v_p;
  perform public.agregar_partida_pedido(v_p, v_can, 12);
  perform public.agregar_partida_pedido(v_p, v_torn, 100);
  perform public.pedir_envio(v_p, 'paqueteria');

  -- 3. Tornillería que surte Full: sale de Almacén ML, nadie empaca en planta.
  insert into public.pedidos (cliente_id, vendedor_id, canal, id_externo, notas) values (v_ml_cli, v_susana, 'mercadolibre', '2000009100003', 'DEMO envíos')
  returning id into v_p;
  perform public.agregar_partida_pedido(v_p, v_torn, 50);
  if exists (select 1 from public.existencias where articulo_id = v_torn and almacen_id = v_ml and cantidad >= 50) then
    v_e := public.pedir_envio(v_p, 'full');
    perform public.marcar_enviado(v_e);
  else
    perform public.pedir_envio(v_p, 'full');
  end if;

  -- 4. Polea de 14": ya entregada (fotos y guía las pone el script de archivos), y
  --    el comprador reclama que "le llegó incompleta su compra".
  insert into public.pedidos (cliente_id, vendedor_id, canal, id_externo, notas) values (v_ml_cli, v_susana, 'mercadolibre', '2000009100004', 'DEMO envíos')
  returning id into v_p;
  perform public.agregar_partida_pedido(v_p, v_pol14, 1);
  v_e := public.pedir_envio(v_p, 'paqueteria', p_paqueteria => v_estafeta);
  perform public.cotizar_envio(v_e, 389, v_estafeta, 'Terrestre');

  -- 5. Cosedora F300A: entregada; el comprador la devuelve y ya llegó (por decidir).
  insert into public.pedidos (cliente_id, vendedor_id, canal, id_externo, notas) values (v_ml_cli, v_susana, 'mercadolibre', '2000009100005', 'DEMO envíos')
  returning id into v_p;
  perform public.agregar_partida_pedido(v_p, v_cos300, 1);
  v_e := public.pedir_envio(v_p, 'paqueteria', p_paqueteria => v_estafeta);
  perform public.cotizar_envio(v_e, 412, v_estafeta, 'Terrestre');

  -- 6. Dos poleas de 4": entregadas, y el comprador devuelve una (viene en camino).
  insert into public.pedidos (cliente_id, vendedor_id, canal, id_externo, notas) values (v_ml_cli, v_susana, 'mercadolibre', '2000009100006', 'DEMO envíos')
  returning id into v_p;
  perform public.agregar_partida_pedido(v_p, v_pol4, 2);
  v_e := public.pedir_envio(v_p, 'paqueteria', p_paqueteria => v_fedex);
  perform public.cotizar_envio(v_e, 265, v_fedex, 'Día siguiente');

  -- ---------------------------------------------------------------------------
  -- Ventas directas.
  -- ---------------------------------------------------------------------------
  -- 7. Isaac: una cosedora por paquetería, cotizada y sin guía todavía.
  perform pg_temp.soy('isaac@hegamex.com');
  insert into public.pedidos (cliente_id, vendedor_id, notas) values (v_granja, v_isaac, 'DEMO envíos') returning id into v_p;
  perform public.agregar_partida_pedido(v_p, v_cos600, 1);
  perform public.agregar_partida_pedido(v_p, v_pol4, 2);
  v_e := public.pedir_envio(v_p, 'paqueteria', p_paqueteria => v_estafeta);
  perform public.cotizar_envio(v_e, 640, v_estafeta, 'Terrestre', 'Sale de Milpillas');

  -- 8. Juan: catarinas que recoge el cliente hoy (las empaca el script de archivos).
  perform pg_temp.soy('juan@hegamex.com');
  insert into public.pedidos (cliente_id, vendedor_id, notas) values (v_molino, v_juan, 'DEMO envíos') returning id into v_p;
  perform public.agregar_partida_pedido(v_p, v_cat, 4);
  perform public.pedir_envio(v_p, 'recoge', p_fecha_recoleccion => v_hoy, p_notas => 'Pasa su chofer en la tarde');

  -- 9. Isaac: banda de 12 m con su orden de producción (terminada, con serie) y dos
  --    poleas, por flete; recolección hoy. Se queda "por empacar" para ver la serie.
  if v_banda is not null then
    perform pg_temp.soy('isaac@hegamex.com');
    insert into public.pedidos (cliente_id, vendedor_id, notas, direccion_entrega)
    values (v_granja, v_isaac, 'DEMO envíos', 'Domicilio de demostración, rancho El Mezquite, Tepatitlán, Jal. (entrada por la brecha)') returning id into v_p;
    v_op_linea := (public.agregar_partida_pedido(v_p, v_banda, 1)).id;
    perform public.agregar_partida_pedido(v_p, v_pol4, 2);
    perform pg_temp.soy('gerente.produccion@hegamex.com');
    v_op := public.crear_orden_produccion(v_banda, 1, v_op_linea, null, 2, 'DEMO-BT12-0931');
    perform public.editar_orden(v_op, p_notas => 'DEMO envíos · banda para flete');
    perform pg_temp.soy('ingenieria@hegamex.com');
    perform public.revisar_orden(v_op, 'ingenieria');
    perform pg_temp.soy('gerente.produccion@hegamex.com');
    perform public.liberar_orden(v_op);
    perform pg_temp.soy('taller@hegamex.com');
    for r in select id from public.op_operaciones where orden_id = v_op loop
      perform public.avanzar_operacion(r.id, 'inicio', null, 'Taller DEMO');
      perform public.avanzar_operacion(r.id, 'fin');
    end loop;
    perform pg_temp.soy('isaac@hegamex.com');
    v_e := public.pedir_envio(v_p, 'flete', p_paqueteria => v_flete, p_fecha_recoleccion => v_hoy, p_notas => 'Va en tarima; la banda viaja armada');
    perform public.cotizar_envio(v_e, 6800, v_flete, 'Camioneta 3.5 t');
  end if;

  -- 10. Almacén arma un envío a Full: 4 cosedoras F300A (lo empaca el script de archivos).
  perform pg_temp.soy('almacen@hegamex.com');
  perform public.envio_a_full(jsonb_build_array(jsonb_build_object('articulo_id', v_cos300, 'cantidad', 4)), v_estafeta,
    'DEMO cita de Full #DEMO-4471', v_hoy + 2);

  perform pg_temp.postgres();
  -- Las solicitudes de ayer y antier, para que la lista no se vea "de hace un minuto".
  update public.envios e set solicitado_en = now() - interval '1 day 3 hours', cotizado_en = case when cotizado_en is not null then now() - interval '1 day 1 hour' end
  from public.pedidos p where p.id = e.pedido_id and p.id_externo in ('2000009100004', '2000009100005', '2000009100006');
  update public.envios e set solicitado_en = now() - interval '6 hours'
  from public.pedidos p where p.id = e.pedido_id and p.id_externo = '2000009100002';
  raise notice 'Envíos DEMO creados. Ahora: node scripts/demo/envios-archivos.mjs';
end $$;

commit;

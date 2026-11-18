-- =============================================================================
-- Seguimientos de cotizaciones mejor repartidos: tope por día, plazos que se abren y reacomodo.
--
-- Por qué: el 18 nov Isaac tenía 92 seguimientos abiertos, 23 para ese día y 51 para el siguiente;
-- Juan Manuel, 86 con 73 vencidos (frenado). Se amontonan porque cada uno se reagenda a plazo fijo
-- (3 días hábiles; 2 si no contestó): quien anota 30 en una tarde los vuelve a recibir juntos, y el
-- festivo del lunes 16 los juntó más. Y el volumen es alto: Isaac envió 286 cotizaciones en 30 días,
-- cada una con 1 a 3 seguimientos. De 32 cotizaciones ganadas en 75 días, 27 se cerraron antes de que
-- tocara el primer seguimiento: insistir cada dos días no era lo que vendía.
--
-- Qué cambia:
--   A. Tope por día (maximo_por_dia, 15): al agendar, si el vendedor ya tiene ese día lleno, el
--      seguimiento pasa al siguiente día hábil con lugar. Si el que llega es de una cotización más
--      grande que la más chica de ese día, se queda él y la chica es la que se recorre. La fecha que
--      el vendedor escribe a mano se respeta siempre (fecha_fija) y nunca se recorre.
--   B. Plazos que se abren (plazos, [3, 5, 10]): el primero a 3 días hábiles del envío; después del
--      primer seguimiento anotado, a 5; después del segundo, a 10. Igual para «Sigue en pie» y «No
--      contestó» (antes 3 y 2 siempre). Mandar otra versión vuelve a empezar la cuenta.
--   C. repartir_seguimientos(vendedor): la gerencia de ventas reacomoda de una vez lo atrasado y lo
--      de los próximos 3 días hábiles, al tope diario desde hoy, primero las cotizaciones grandes.
--      Le avisa al vendedor. Lo que tiene fecha fija o va más lejos no se toca.
-- No cambian el freno (10 vencidos), cuándo se puede perder por «No respondió» ni la racha que pide
-- decidir.
-- =============================================================================

update public.configuracion
set valor = (valor - 'dias_habiles' - 'dias_no_contesta') || '{"plazos": [3, 5, 10], "maximo_por_dia": 15}'::jsonb,
    descripcion = 'Seguimiento de cotizaciones. plazos: días hábiles para el 1.er, 2.º y siguientes seguimientos. maximo_por_dia: cuántos le pueden tocar a un vendedor el mismo día (lo demás pasa al siguiente día hábil; 0 = sin tope). tope_vencidos: cuántos vencidos frenan el envío de cotizaciones nuevas. no_contesto_para_perder / dias_para_perder: cuándo se acepta «No respondió». racha_para_decidir: al cuántos «Sigue en pie» o «No contestó» seguidos pide decidir.'
where clave = 'seguimiento_cotizaciones' and not (valor ? 'plazos');

create or replace function public._config_seguimiento() returns jsonb
language sql stable set search_path = public as $$
  select '{"plazos": [3, 5, 10], "maximo_por_dia": 15, "tope_vencidos": 10, "por_dia_al_arrancar": 8,
           "no_contesto_para_perder": 2, "dias_para_perder": 10, "racha_para_decidir": 3, "freno_activo": true}'::jsonb
         || coalesce((select valor from configuracion where clave = 'seguimiento_cotizaciones'), '{}'::jsonb)
$$;

alter table public.seguimientos_cotizacion add column if not exists fecha_fija boolean not null default false;
comment on column public.seguimientos_cotizacion.fecha_fija is
  'La fecha la escribió el vendedor (no salió del plazo): el tope diario no la recorre y repartir_seguimientos no la toca.';
-- Lo que ya estaba agendado mucho más lejos que cualquier plazo lo puso alguien a mano.
update public.seguimientos_cotizacion set fecha_fija = true
where estado = 'pendiente' and not fecha_fija and vence > (creado_en at time zone 'America/Mexico_City')::date + 10;

-- Cuántos días hábiles faltan para el siguiente seguimiento de una oportunidad: según cuántos se han
-- anotado desde el último envío de su cotización (0 → el primer plazo, 1 → el segundo…; el último se
-- repite). p_mas = 1 contesta «si anoto uno ahorita, ¿a cuántos días queda el que sigue?» (la pantalla).
create or replace function public._plazo_seguimiento(p_op uuid, p_mas int default 0) returns int
language sql stable security definer set search_path = public as $$
  with cfg as (select case when jsonb_typeof(c->'plazos') = 'array' and jsonb_array_length(c->'plazos') > 0
                           then c->'plazos' else '[3, 5, 10]'::jsonb end p from (select _config_seguimiento() c) x),
  env as (select max(enviada_en) en from cotizaciones where oportunidad_id = p_op),
  n as (select count(*)::int c from seguimientos_cotizacion
        where oportunidad_id = p_op and estado = 'hecho' and cerrado_en >= coalesce((select en from env), '-infinity'))
  select greatest((cfg.p ->> least(n.c + coalesce(p_mas, 0), jsonb_array_length(cfg.p) - 1))::int, 1) from cfg, n
$$;
revoke execute on function public._plazo_seguimiento(uuid, int) from public, anon, authenticated;

-- El primer día hábil desde p_desde en que al vendedor le cabe otro seguimiento.
create or replace function public._dia_con_lugar(p_vendedor uuid, p_desde date, p_excluir uuid default null) returns date
language plpgsql stable security definer set search_path = public as $$
declare d date := p_desde; v_tope int := coalesce((_config_seguimiento()->>'maximo_por_dia')::int, 0); i int := 0;
begin
  if v_tope <= 0 or p_vendedor is null then return d; end if;
  while i < 120 and (select count(*) from seguimientos_cotizacion s
                     where s.vendedor_id = p_vendedor and s.estado = 'pendiente' and s.vence = d and s.id is distinct from p_excluir) >= v_tope loop
    d := sumar_dias_laborables(d, 1);
    i := i + 1;
  end loop;
  return d;
end $$;
revoke execute on function public._dia_con_lugar(uuid, date, uuid) from public, anon, authenticated;

-- Agendar (o recorrer) el seguimiento pendiente de una oportunidad. Con p_fija la fecha se respeta tal
-- cual; sin ella, se acomoda al tope diario del vendedor.
drop function if exists public._programar_seguimiento(uuid, uuid, uuid, date);
create or replace function public._programar_seguimiento(p_op uuid, p_cot uuid, p_vendedor uuid, p_vence date, p_fija boolean default false)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_vend uuid; v_cot uuid; v_dia date := p_vence; v_monto numeric; r record;
  v_tope int := coalesce((_config_seguimiento()->>'maximo_por_dia')::int, 0);
begin
  select s.id, s.vendedor_id, s.cotizacion_id into v_id, v_vend, v_cot
  from seguimientos_cotizacion s where s.oportunidad_id = p_op and s.estado = 'pendiente';
  v_vend := coalesce(p_vendedor, v_vend);
  v_cot := coalesce(p_cot, v_cot);

  if not coalesce(p_fija, false) and v_tope > 0 and v_vend is not null
     and (select count(*) from seguimientos_cotizacion s
          where s.vendedor_id = v_vend and s.estado = 'pendiente' and s.vence = v_dia and s.id is distinct from v_id) >= v_tope then
    -- Día lleno. Si este es de una cotización más grande que la más chica de ese día (sin fecha fija),
    -- la chica se recorre; si no, se recorre este.
    select coalesce(round((c.total - c.iva) * c.tipo_cambio, 2), 0) into v_monto from cotizaciones c where c.id = v_cot;
    select s.id, coalesce(round((c.total - c.iva) * c.tipo_cambio, 2), 0) monto into r
    from seguimientos_cotizacion s left join cotizaciones c on c.id = s.cotizacion_id
    where s.vendedor_id = v_vend and s.estado = 'pendiente' and s.vence = v_dia and not s.fecha_fija and s.id is distinct from v_id
    order by 2, s.creado_en desc, s.id limit 1;
    if r.id is not null and r.monto < coalesce(v_monto, 0) then
      update seguimientos_cotizacion set vence = _dia_con_lugar(v_vend, sumar_dias_laborables(v_dia, 1), r.id) where id = r.id;
    else
      v_dia := _dia_con_lugar(v_vend, sumar_dias_laborables(v_dia, 1), v_id);
    end if;
  end if;

  if v_id is not null then
    update seguimientos_cotizacion set vence = v_dia, cotizacion_id = v_cot, vendedor_id = v_vend, fecha_fija = coalesce(p_fija, false)
    where id = v_id;
  else
    insert into seguimientos_cotizacion (oportunidad_id, cotizacion_id, vendedor_id, vence, fecha_fija)
    values (p_op, p_cot, p_vendedor, v_dia, coalesce(p_fija, false)) returning id into v_id;
  end if;
  return v_id;
end $$;
revoke execute on function public._programar_seguimiento(uuid, uuid, uuid, date, boolean) from public, anon, authenticated;

-- Al enviar la cotización: el primer plazo. (Mismo cuerpo que en 172; solo cambia de dónde sale el plazo.)
create or replace function public.trg_seguimiento_cotizacion() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_etapa text; v_plazos jsonb := _config_seguimiento()->'plazos';
begin
  if new.oportunidad_id is null or new.estado is not distinct from old.estado then return null; end if;
  select etapa into v_etapa from oportunidades where id = new.oportunidad_id;
  if new.estado = 'enviada' and v_etapa not in ('ganada', 'perdida') then
    perform _programar_seguimiento(new.oportunidad_id, new.id,
      coalesce(new.vendedor_id, (select vendedor_id from oportunidades where id = new.oportunidad_id)),
      sumar_dias_laborables(hoy_mx(), greatest(coalesce((v_plazos->>0)::int, 3), 1)));
  elsif new.estado in ('aceptada', 'rechazada', 'cancelada')
        and not exists (select 1 from cotizaciones c where c.oportunidad_id = new.oportunidad_id and c.id <> new.id and c.estado = 'enviada') then
    perform _cerrar_seguimiento(new.oportunidad_id, case when new.estado = 'aceptada' then 'pedido' else 'cerrada' end,
      case new.estado when 'aceptada' then 'Se volvió pedido'
                      when 'rechazada' then 'Cotización rechazada' || coalesce(': ' || new.motivo_rechazo, '')
                      else 'Cotización cancelada' end);
  end if;
  return null;
end $$;

-- registrar_seguimiento y _estado_seguimiento: mismos cuerpos que en 255; se parcha solo el plazo del
-- siguiente seguimiento (y que la fecha escrita a mano quede fija), para no repetir aquí 100 renglones.
do $$
declare s text; v_viejo text; v_nuevo text;
begin
  s := pg_get_functiondef('public.registrar_seguimiento(uuid, text, text, text, date, text)'::regprocedure);
  if position('_plazo_seguimiento' in s) = 0 then
    v_viejo := E'  v_vence := coalesce(p_proxima, case\n'
      || E'    when p_resultado = ''no_contesta'' then sumar_dias_laborables(hoy_mx(), (cfg->>''dias_no_contesta'')::int)\n'
      || E'    when p_resultado in (''sigue'', ''negociacion'') or v_cot is not null then sumar_dias_laborables(hoy_mx(), (cfg->>''dias_habiles'')::int)\n'
      || E'  end);\n';
    v_nuevo := E'  v_vence := coalesce(p_proxima, case\n'
      || E'    when p_resultado in (''no_contesta'', ''sigue'', ''negociacion'') or v_cot is not null\n'
      || E'      then sumar_dias_laborables(hoy_mx(), _plazo_seguimiento(o.id))\n'
      || E'  end);\n';
    if position(v_viejo in s) = 0 or position('_programar_seguimiento(o.id, v_cot, coalesce(o.vendedor_id, auth.uid()), v_vence);' in s) = 0 then
      raise exception 'registrar_seguimiento ya no es la de 255: revisa este parche';
    end if;
    s := replace(s, v_viejo, v_nuevo);
    s := replace(s, '_programar_seguimiento(o.id, v_cot, coalesce(o.vendedor_id, auth.uid()), v_vence);',
                    '_programar_seguimiento(o.id, v_cot, coalesce(o.vendedor_id, auth.uid()), v_vence, p_proxima is not null);');
    execute s;
  end if;

  s := pg_get_functiondef('public._estado_seguimiento(uuid)'::regprocedure);
  if position('_plazo_seguimiento' in s) = 0 then
    v_viejo := E'    ''dias_no_contesta'', (c->>''dias_no_contesta'')::int,\n';
    if position(v_viejo in s) = 0 then raise exception '_estado_seguimiento ya no es la de 255: revisa este parche'; end if;
    -- dias_no_contesta se queda con ese nombre (lo usan los mensajes de 255): ahora es el plazo que
    -- le tocaría al siguiente si se anota uno ahorita.
    s := replace(s, v_viejo, E'    ''dias_no_contesta'', _plazo_seguimiento(p_op, 1), ''dias_siguiente'', _plazo_seguimiento(p_op, 1),\n'
                          || E'    ''maximo_por_dia'', coalesce((c->>''maximo_por_dia'')::int, 0),\n');
    execute s;
  end if;
end $$;

-- Reacomodar de una vez lo atrasado y lo inmediato de un vendedor, al tope diario, desde p_desde (hoy).
create or replace function public.repartir_seguimientos(p_vendedor uuid, p_desde date default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_tope int := coalesce((_config_seguimiento()->>'maximo_por_dia')::int, 0);
  d date; v_lim date; n int; r record; v_total int := 0; v_mov int := 0; v_ini date; v_fin date;
begin
  if not puede('ventas', 3) then
    raise exception 'Repartir los seguimientos de un vendedor es de la gerencia de ventas' using errcode = '42501';
  end if;
  if v_tope <= 0 then raise exception 'No hay tope de seguimientos por día: ponlo en Configuración antes de repartir'; end if;
  if p_vendedor is null then raise exception 'Elige de quién'; end if;
  if p_desde is not null and p_desde < hoy_mx() then raise exception 'Se reparte de hoy en adelante'; end if;
  d := sumar_dias_laborables(coalesce(p_desde, hoy_mx()) - 1, 1);   -- el propio día si es hábil
  v_lim := sumar_dias_laborables(hoy_mx(), 3);
  -- Lo que ya ocupa cada día y no se mueve: fechas fijas y lo que va más allá de lo que se reparte.
  select count(*) into n from seguimientos_cotizacion s
  where s.vendedor_id = p_vendedor and s.estado = 'pendiente' and s.vence = d and (s.fecha_fija or s.vence > v_lim);
  for r in
    select s.id, s.vence from seguimientos_cotizacion s left join cotizaciones c on c.id = s.cotizacion_id
    where s.vendedor_id = p_vendedor and s.estado = 'pendiente' and not s.fecha_fija and s.vence <= v_lim
    order by coalesce((c.total - c.iva) * c.tipo_cambio, 0) desc, s.vence, s.id
    for update of s
  loop
    while n >= v_tope loop
      d := sumar_dias_laborables(d, 1);
      select count(*) into n from seguimientos_cotizacion s
      where s.vendedor_id = p_vendedor and s.estado = 'pendiente' and s.vence = d and (s.fecha_fija or s.vence > v_lim);
    end loop;
    if r.vence is distinct from d then
      update seguimientos_cotizacion set vence = d where id = r.id;
      v_mov := v_mov + 1;
    end if;
    n := n + 1; v_total := v_total + 1;
    v_ini := coalesce(v_ini, d); v_fin := d;
  end loop;
  if v_mov > 0 then
    perform avisar(array[p_vendedor], 'seguimientos_repartidos', 'Tus seguimientos se repartieron',
      format('%s seguimientos, hasta %s por día, del %s al %s. Primero van las cotizaciones más grandes. Los que tenían una fecha que tú pusiste no se movieron.',
             v_total, v_tope, to_char(v_ini, 'DD/MM'), to_char(v_fin, 'DD/MM')),
      '/ventas/cotizaciones?estado=seguimiento', null, null, false);
  end if;
  return jsonb_build_object('repartidos', v_total, 'movidos', v_mov, 'del', v_ini, 'al', v_fin, 'por_dia', v_tope);
end $$;
revoke execute on function public.repartir_seguimientos(uuid, date) from public, anon;
grant execute on function public.repartir_seguimientos(uuid, date) to authenticated;

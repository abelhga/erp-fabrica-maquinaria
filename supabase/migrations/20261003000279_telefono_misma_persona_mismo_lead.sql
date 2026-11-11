-- =============================================================================
-- Si alguien vuelve a llamar desde un número que ya tiene un lead abierto, la llamada se suma a
-- ese lead en vez de crear otro.
--
-- Por qué: el 10 de noviembre José María Saldaña (ASA Maquinaria) llamó a la 1:24 p.m. y su lead
-- quedó con Susana. A las 5:43 p.m. volvió a llamar para dar seguimiento a la misma cotización y el
-- teléfono creó otro lead («Asan Maquinaria», sin vendedor, por tomar). Recepción podía pasárselo a
-- otro vendedor, y Susana no se enteró de que su cliente había vuelto a llamar. La revisión de la
-- noche lo encontró como lead repetido.
--
-- Ahora, antes de crear el lead de una llamada, se busca uno abierto (nuevo o asignado) con el mismo
-- teléfono. Si existe, la llamada se liga a él, se le agrega una nota con lo que pidió esta vez y le
-- llega un aviso a su vendedor («Volvió a llamar»). Un lead ya convertido o descartado no cuenta: ese
-- caso sí abre uno nuevo.
-- =============================================================================

do $$
declare d text; n text;
begin
  d := pg_get_functiondef('public.telefono_registrar_evento(jsonb)'::regprocedure);
  n := replace(d, $a$    if c.lead_id is null then
      if length(v_nombre) >= 2 and length(v_interes) >= 3$a$,
    $a$    if c.lead_id is null then
      -- Ya hay un lead abierto de ese número: la llamada se suma a él y su vendedor se entera (279).
      select * into l from leads x
      where x.estado in ('nuevo', 'asignado')
        and telefono10(x.telefono) is not null
        and telefono10(x.telefono) in (telefono10(v_ltel), c.telefono10)
      order by x.creado_en desc limit 1;
      if l.id is not null then
        update leads set notas = concat_ws(E'\n', notas,
            format('%s · Volvió a llamar (teléfono con IA): %s', to_char(now() at time zone 'America/Mexico_City', 'DD/MM HH24:MI'),
                   coalesce(nullif(trim(ld->>'detalle'), ''), v_interes)))
        where id = l.id;
        update llamadas set lead_id = l.id, lead_nombre = l.nombre || coalesce(' (' || coalesce(l.cliente_nombre, l.empresa) || ')', '')
        where id = c.id returning * into c;
        if l.vendedor_id is not null then
          perform avisar(array[l.vendedor_id], 'lead', 'Volvió a llamar: ' || l.nombre,
            coalesce(nullif(trim(ld->>'interes'), ''), l.interes), '/ventas/leads?id=' || l.id, 'leads', l.id::text);
        end if;
      elsif length(v_nombre) >= 2 and length(v_interes) >= 3$a$);
  if n = d then raise exception 'telefono_registrar_evento: no encontré dónde se crea el lead'; end if;
  execute n;
end $$;

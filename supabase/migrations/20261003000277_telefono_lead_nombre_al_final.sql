-- =============================================================================
-- El lead del teléfono toma el nombre (y lo que busca) de la última foto de la llamada.
--
-- Por qué: el 10 de noviembre a las 7:29 p.m. llamó Sergio Cruz. A mitad de la llamada el teléfono
-- mandó una primera foto sin nombre y el lead se creó «Sin nombre» con «Cribadora para maíz». Al
-- colgar llegó la foto completa: «Sergio Cruz», «Cribadora ZAR para maíz, capacidad 10 toneladas por
-- hora». El ERP solo llenaba lo vacío de un lead que ya existía, y el nombre nunca estaba vacío
-- (decía «Sin nombre»), así que se quedó así, aunque el resumen de su llamada dijera quién era.
--
-- Ahora, igual que ya pasaba con la ciudad: si el nombre, lo que busca o las notas del lead siguen
-- siendo lo que dejó el teléfono en la foto anterior (nadie los tocó a mano), la foto nueva los
-- corrige. «Sin nombre» siempre se reemplaza cuando llega un nombre. Lo que una persona ya escribió
-- no se toca.
-- =============================================================================

do $$
declare d text; n text;
begin
  d := pg_get_functiondef('public.telefono_registrar_evento(jsonb)'::regprocedure);
  n := replace(d, $a$  v_cal numeric; v_tipo text;$a$,
    $a$  v_cal numeric; v_tipo text; v_nombre_antes text; v_interes_antes text; v_notas_antes text;$a$);
  n := replace(n, $a$      select * into l from leads where id = c.lead_id for update;$a$,
    $a$      -- Igual para nombre, interés y notas: lo que dejó la foto anterior, calculado como entonces.
      v_nombre_antes := coalesce(nullif(trim(v_prev.datos->'lead'->>'nombre'), ''), nullif(trim(v_prev.datos->'lead'->>'empresa'), ''), 'Sin nombre');
      v_interes_antes := coalesce(nullif(trim(v_prev.datos->'lead'->>'interes'), ''), left(v_prev.resumen, 300), 'Llamó al teléfono');
      v_notas_antes := concat_ws(E'\n', 'Entró por el teléfono (IA).', nullif(trim(v_prev.datos->'lead'->>'detalle'), ''),
                                 nullif(trim(v_prev.datos->'lead'->>'notas'), ''));
      select * into l from leads where id = c.lead_id for update;$a$);
  n := replace(n, $a$          interes = case when interes = 'Llamó al teléfono' and v_interes <> 'Llamó al teléfono' then v_interes else interes end,
          notas = case when notas is null or notas = 'Entró por el teléfono (IA).' then v_notas else notas end
        where id = l.id;$a$,
    $a$          -- Solo con algo nuevo de verdad: una foto que no trae interés ni detalle no borra lo que había.
          interes = case when nullif(trim(ld->>'interes'), '') is not null and (interes = 'Llamó al teléfono' or interes = v_interes_antes)
                         then v_interes else interes end,
          notas = case when notas is null or notas = 'Entró por el teléfono (IA).'
                         or (notas = v_notas_antes and coalesce(nullif(trim(ld->>'detalle'), ''), nullif(trim(ld->>'notas'), '')) is not null)
                       then v_notas else notas end,
          nombre = case when v_nombre <> 'Sin nombre' and (nombre = 'Sin nombre' or nombre = v_nombre_antes) then v_nombre else nombre end
        where id = l.id;
        select * into l from leads where id = l.id;
        update llamadas set lead_nombre = l.nombre || coalesce(' (' || coalesce(l.cliente_nombre, l.empresa) || ')', '')
        where id = c.id returning * into c;   -- sin otra condición: si no actualizara nada, c quedaría vacío$a$);
  if n = d or n !~ 'v_nombre_antes :=' or n !~ 'nombre = case when v_nombre' then
    raise exception 'telefono_registrar_evento: no encontré dónde corregir el nombre del lead';
  end if;
  execute n;
end $$;

-- Los que ya se quedaron «Sin nombre» aunque la llamada sí lo traía (Sergio Cruz, 10 nov).
with x as (
  select l.id, trim(c.datos->'lead'->>'nombre') nombre, c.id llamada_id
  from leads l join llamadas c on c.id = l.llamada_id
  where l.nombre = 'Sin nombre' and l.estado in ('nuevo', 'asignado')
    and nullif(trim(c.datos->'lead'->>'nombre'), '') is not null
), u as (
  update leads l set nombre = x.nombre from x where l.id = x.id returning l.id, l.nombre, l.empresa, x.llamada_id
)
update llamadas c set lead_nombre = u.nombre || coalesce(' (' || u.empresa || ')', '') from u where c.id = u.llamada_id;

// Pone al día las órdenes de producción con la hoja semanal de Luis Eduardo ("fabricacion de
// equipos", pestaña "Hoja 1") mientras el taller no marque todo en la terminal. Las órdenes
// se cargaron de esa hoja el 16 oct 2026; desde entonces la hoja trae "Área en proceso" y
// el estatus de cada equipo, y el ERP se quedaba con todo en "pendiente".
//
//   npx tsx scripts/sincronizar-fabricacion.ts --hoja hoja1.json [--ensayo] > fabricacion.sql
//
// hoja1.json es { values: [[…]] } de Hoja 1 (encabezado en el renglón 4). Escribe un SQL de
// una sola transacción; con --ensayo termina en "raise exception 'ENSAYO …'" y no cambia nada.
//
// Cómo empata: por número de serie; si el renglón no trae serie (PENDIENTE, -, N/A), por el
// texto del equipo dentro de las notas de la orden cargada de la hoja. Lo que no tiene orden
// (envasadoras, colectores, paquetes de componentes) se lista y no se toca. Las órdenes que
// ya no salen en la hoja tampoco se tocan: se listan para preguntar.
//
// Qué pone: "Listo para entrega" o TERMINADA → terminada con todas sus etapas; PRODUCCION →
// en proceso, con las etapas anteriores al área terminadas y la del área en proceso; EN ESPERA
// con avance → en proceso con la etapa del área pausada; EN ESPERA sin avance → no se mueve;
// "Cliente Ausente" → planeada, etapas pendientes y en espera (fuera de la carga del taller).
// Áreas de Luis → etapas: Plasma = Corte, Paileria = Pailería, Pintura = Pintura,
// Habilitado = Detallado.
import { readFileSync } from "node:fs";

const args = process.argv.slice(2);
const arg = (n: string) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
const ruta = arg("--hoja"); if (!ruta) throw new Error("Falta --hoja");
const valores = (JSON.parse(readFileSync(ruta, "utf8")).values ?? []) as string[][];

const limpio = (s: string | undefined) => (s ?? "").replace(/\s+/g, " ").trim();
const serie = (s: string | undefined) => { const x = (s ?? "").replace(/\s+/g, "").toUpperCase(); return ["", "-", ".", "N/A", "PENDIENTE"].includes(x) ? null : x; };
const fecha = (s: string | undefined) => {
  const m = (s ?? "").match(/^\s*(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (!m) return null;
  const a = Number(m[3]) < 100 ? 2000 + Number(m[3]) : Number(m[3]);
  return `${a}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
};
const enc = valores.findIndex((r) => limpio(r[0]).toLowerCase() === "numero de serie");
if (enc < 0) throw new Error("No encontré el encabezado «Numero de Serie»");
const filas = valores.slice(enc + 1)
  .map((r, i) => ({ fila: enc + 2 + i, serie: serie(r[0]), pedido: limpio(r[1]), equipo: limpio(r[6]), area: limpio(r[7]),
                    estatus: limpio(r[8]).toUpperCase(), avance: limpio(r[9]), actualizada: fecha(r[5]), termino: fecha(r[4]) }))
  .filter((r) => r.equipo && r.estatus);
const lit = (x: unknown) => `$json$${JSON.stringify(x)}$json$::jsonb`;
const hoy = new Date().toISOString().slice(0, 10);

const sql = `-- Órdenes al día con «fabricacion de equipos» (${hoy}): ${filas.length} renglones.
create temp table _h on commit drop as
  select * from jsonb_to_recordset(${lit(filas)}) x(fila int, serie text, pedido text, equipo text, area text, estatus text, avance text,
    actualizada date, termino date);
create temp table _r (fila int, orden_id uuid, folio text, antes text, despues text, como text) on commit drop;

-- Para comparar textos de la hoja con las notas: minúsculas, sin acentos ni signos.
create function pg_temp.norm(t text) returns text language sql immutable as $$
  select trim(regexp_replace(lower(translate(coalesce(t, ''), 'ÁÉÍÓÚÜÑáéíóúüñ', 'AEIOUUNaeiouun')), '[^a-z0-9]+', ' ', 'g')) $$;
create function pg_temp.foto(p uuid) returns text language sql stable as $$
  select o.estado || coalesce(' [' || o.en_espera_motivo || ']', '') || ': ' ||
    coalesce((select string_agg(e.nombre || '=' || x.estado, ', ' order by e.orden) from public.op_operaciones x
              join public.etapas e on e.id = x.etapa_id where x.orden_id = o.id), '')
  from public.ordenes_produccion o where o.id = p $$;

do $s$
declare h record; o public.ordenes_produccion; v_como text; v_area text; v_orden int; v_cuando timestamptz; v_ausente boolean; v_avance int;
begin
  for h in select * from _h order by fila loop
    o := null; v_como := null;
    if h.serie is not null then
      select * into o from public.ordenes_produccion where upper(regexp_replace(numero_serie, '\\s', '', 'g')) = h.serie;
      v_como := 'serie';
    end if;
    if o.id is null then
      select * into o from public.ordenes_produccion
      where notas like 'Cargada de «fabricación de equipos»%' and position(pg_temp.norm(h.equipo) in pg_temp.norm(notas)) > 0
        and id not in (select orden_id from _r where orden_id is not null)
      order by folio limit 1;
      v_como := 'texto';
    end if;
    if o.id is null then insert into _r (fila, como) values (h.fila, 'sin orden'); continue; end if;
    if o.estado in ('entregada', 'cancelada') then insert into _r values (h.fila, o.id, o.folio, o.estado::text, o.estado::text, 'cerrada, no se toca'); continue; end if;
    insert into _r values (h.fila, o.id, o.folio, pg_temp.foto(o.id), null, v_como);

    v_area := pg_temp.norm(h.area);
    v_ausente := v_area = 'cliente ausente';
    v_avance := case when h.avance ~ '^[0-9]+$' then h.avance::int end;
    v_cuando := (coalesce(h.termino, h.actualizada, current_date)::timestamp + time '18:00') at time zone 'America/Mexico_City';
    -- El orden de la etapa donde va el equipo (null = todavía no entra a una etapa del ERP).
    select e.orden into v_orden from public.etapas e where e.nombre = case v_area
      when 'plasma' then 'Corte' when 'paileria' then 'Pailería' when 'pintura' then 'Pintura' when 'habilitado' then 'Detallado' end;

    if v_ausente then
      update public.op_operaciones set estado = 'pendiente', inicio = null, fin = null where orden_id = o.id;
      update public.ordenes_produccion set estado = 'planeada', terminada_en = null,
        en_espera_motivo = 'Cliente ausente: dio anticipo, se fabrica cuando regrese'
          || case when h.equipo ilike '%volvio a vender%' or h.equipo ilike '%volvió a vender%' then ' (el equipo que había se volvió a vender: hay que reponerlo)'
                  when h.equipo ilike '%repon%' then ' (hay que reponerlo)' else '' end,
        en_espera_desde = coalesce(h.actualizada, current_date)
      where id = o.id;
    elsif v_area = 'listo para entrega' or h.estatus = 'TERMINADA' then
      update public.op_operaciones set estado = 'terminada', inicio = coalesce(inicio, v_cuando), fin = coalesce(fin, v_cuando) where orden_id = o.id;
      update public.ordenes_produccion set estado = 'terminada', terminada_en = coalesce(terminada_en, v_cuando) where id = o.id;
    elsif h.estatus = 'PRODUCCION' or (h.estatus = 'EN ESPERA' and coalesce(v_avance, 0) > 0 and v_orden is not null) then
      if v_orden is not null then
        update public.op_operaciones x set
          estado = case when e.orden < v_orden then 'terminada'
                        when e.orden = v_orden then (case when h.estatus = 'EN ESPERA' then 'pausada' else 'en_proceso' end)::public.estado_operacion
                        else 'pendiente' end,
          inicio = case when e.orden <= v_orden then coalesce(x.inicio, v_cuando) end,
          fin = case when e.orden < v_orden then coalesce(x.fin, v_cuando) end
        from public.etapas e where e.id = x.etapa_id and x.orden_id = o.id;
      end if;
      update public.ordenes_produccion set estado = 'en_proceso', terminada_en = null where id = o.id;
    end if;

    update _r set despues = pg_temp.foto(o.id) where orden_id = o.id;
    if (select antes is distinct from despues from _r where orden_id = o.id) then
      insert into public.op_eventos (orden_id, tipo, nota)
      values (o.id, 'nota', format('Actualizada con la hoja de Luis (%s): %s%s, %s.', to_char(h.actualizada, 'DD/MM/YY'),
              coalesce(nullif(h.area, ''), 'sin área'), coalesce(', avance ' || h.avance || ' %', ''), lower(h.estatus)));
    end if;
  end loop;

  -- Un pedido con todas sus órdenes terminadas queda listo para entregar (como en la terminal).
  update public.pedidos p set estado = 'listo'
  where p.estado = 'en_produccion' and p.id in (select op.pedido_id from public.ordenes_produccion op join _r on _r.orden_id = op.id)
    and not exists (select 1 from public.ordenes_produccion op where op.pedido_id = p.id and op.estado not in ('terminada', 'entregada', 'cancelada'));
end $s$;

do $s$
declare r jsonb;
begin
  select jsonb_build_object(
    'renglones', (select count(*) from _h),
    'empatadas', (select count(*) from _r where orden_id is not null),
    'cambiaron', (select coalesce(jsonb_agg(folio || ': ' || antes || '  →  ' || despues order by folio), '[]') from _r where antes is distinct from despues),
    'sin_cambio', (select count(*) from _r where orden_id is not null and antes is not distinct from despues),
    'por_texto', (select coalesce(jsonb_agg(folio order by folio), '[]') from _r where como = 'texto'),
    'sin_orden', (select coalesce(jsonb_agg(h.pedido || ' · ' || left(h.equipo, 50) order by h.fila), '[]') from _r join _h h using (fila) where _r.orden_id is null),
    'ya_no_en_la_hoja', (select coalesce(jsonb_agg(o.folio || ' ' || coalesce(o.numero_serie, '') || ' (' || o.estado || ')' order by o.folio), '[]')
                         from public.ordenes_produccion o
                         where o.notas like 'Cargada de «fabricación de equipos»%' and o.estado not in ('entregada', 'cancelada')
                           and o.id not in (select orden_id from _r where orden_id is not null)),
    'pedidos_listos', (select coalesce(jsonb_agg(distinct p.folio), '[]') from public.pedidos p join public.ordenes_produccion o on o.pedido_id = p.id
                       join _r on _r.orden_id = o.id where p.estado = 'listo'))
  into r;
  ${args.includes("--ensayo") ? "raise exception 'ENSAYO %', jsonb_pretty(r);" : "raise notice 'Fabricación al día: %', jsonb_pretty(r);"}
end $s$;
`;
process.stdout.write(sql);

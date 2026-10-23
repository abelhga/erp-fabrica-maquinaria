// Pone al día el ERP con la hoja de compras de Toño ("Costo y actualizaciones de los
// componentes 2.0") mientras compras siga capturando ahí. Trae tres cosas:
//
//   1. Precios: los renglones de ACTUALIZACIONES que el ERP todavía no tiene (por número de
//      fila). Igual que la hoja, el último precio de cada componente es su costo vigente.
//   2. Componentes: los que se dieron de alta en ListaComponentes después de la última carga.
//   3. Órdenes de compra abiertas («Pedido», «Pendiente» o sin status) desde --desde-fecha,
//      con su número de la hoja (OC-26-4381). «Recibido» y «Enviado» (lo que el proveedor
//      mandó directo al cliente) ya no esperan nada; lo más viejo se lista para revisarlo a mano.
//
//   npx tsx scripts/sincronizar-compras.ts \
//     --actualizaciones act.json --desde-fila-act 15050 \
//     --lista lista.json --desde-fila-lista 4060 \
//     --ordenes ordenes.json --desde-fecha 2026-07-20 [--ensayo] > compras.sql
//
// Los .json son volcados de la API de Sheets ({ values: [[…]] }) que empiezan en la fila que
// se indica: ACTUALIZACIONES A:G, ListaComponentes A:D. ordenes.json trae { filas: [[fila,
// [A…H]], …] } (o { values } con --desde-fila-ord). Escribe un SQL de una sola instrucción; con
// --ensayo termina en "raise exception 'ENSAYO …'" y no cambia nada.
//
// Reglas que no son obvias:
// - Un costo que se mueve más de 5 veces contra el vigente no se aplica (la Catarina 60-30
//   llegó a $3,350 cuando costaba $350): se reporta para que compras lo confirme en el ERP.
// - Si el ERP ya tiene un costo más nuevo que el renglón (alguien lo cambió en el ERP), el
//   renglón entra al historial pero no pisa el vigente. Tampoco se pisa un costo en dólares.
// - Las órdenes que ya existen en el ERP (por folio) no se tocan: correrlo dos veces no duplica.
import { readFileSync } from "node:fs";
import * as T from "../src/importador/transformar";
import { celda, fecha as fechaMx, limpiarNombre, llave, numero, unidad } from "../src/importador/util";

const args = process.argv.slice(2);
const arg = (n: string) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
const requerido = (n: string) => arg(n) ?? (() => { throw new Error(`Falta ${n}`); })();
const leer = (ruta: string) => JSON.parse(readFileSync(ruta, "utf8")) as { values?: string[][]; filas?: [number, string[]][] };
const ensayo = args.includes("--ensayo");
const hoy = new Date().toISOString().slice(0, 10);

// 1. Precios de ACTUALIZACIONES (el parser del importador numera desde su encabezado).
const desdeAct = Number(requerido("--desde-fila-act"));
const filasAct = leer(requerido("--actualizaciones")).values ?? [];
const encabezado = ["FECHA DEL PRECIO", "Componente", "Unidad de medida", "COSTO sin iva", "Proveedor de la referencia", "Tiempo Estimado de Entrega", "Nota"];
const { precios, descartadas } = T.actualizaciones([encabezado, ...filasAct]);
const preciosNuevos = precios.map((p) => {
  const fila = p.fila - 2 + desdeAct;
  const dias = numero(filasAct[fila - desdeAct]?.[5]);
  return { fila, fecha: p.fecha, llave: p.llave, nombre: p.nombre, costo: p.costo,
    prov_llave: p.proveedor ? llave(p.proveedor) : null, proveedor: p.proveedor, dias: dias && dias > 0 ? Math.round(dias) : null };
});

// 2. Componentes de ListaComponentes (A: nombre, B: unidad).
const desdeLista = Number(requerido("--desde-fila-lista"));
const componentes = (leer(requerido("--lista")).values ?? []).map((f, i) => ({ fila: desdeLista + i, nombre: limpiarNombre(f[0]), unidad: unidad(f[1]) }))
  .filter((c) => c.nombre && !/^horas? hombre/.test(llave(c.nombre)))
  .map((c) => ({ llave: llave(c.nombre), nombre: c.nombre, unidad: c.unidad, tipo: T.tipoComponente(c.nombre, c.unidad) }));

// 3. Órdenes abiertas. Columnas: A fecha, B #Ord, C artículo, D cantidad, E unidad, F status,
// G nota (para qué es), H proveedor.
const ord = leer(requerido("--ordenes"));
const desdeOrd = Number(arg("--desde-fila-ord") ?? 0);
const filasOrd: [number, string[]][] = ord.filas ?? (ord.values ?? []).map((f, i) => [desdeOrd + i, f]);
const desdeFecha = requerido("--desde-fecha");
const anio = new Date().getFullYear();
// La hoja trae años imposibles ("07/08/29" entre órdenes de 2026): se toma el año en curso.
const fechaOrden = (v: string) => fechaMx(v) ?? fechaMx(String(v).replace(/\/(\d{2,4})$/, `/${anio}`));
const abierta = (status: string) => ["pedido", "pendiente", ""].includes(llave(status));
interface Orden { numero: number; folio: string; fecha: string; proveedor: string; prov_llave: string; sin_status: boolean;
  para: Set<string>; lineas: { llave: string; nombre: string; cantidad: number }[] }
const ordenes = new Map<number, Orden>();
const viejas = new Map<number, { fecha: string; proveedor: string; lineas: number }>();
for (const [, f] of filasOrd) {
  const num = Number(celda(f, 1));
  const nombre = limpiarNombre(f[2]);
  const status = celda(f, 5);
  const cantidad = numero(f[3]);
  if (!Number.isInteger(num) || num <= 0 || !nombre || !abierta(status) || !(cantidad && cantidad > 0)) continue;
  const fch = fechaOrden(celda(f, 0));
  if (!fch) continue;
  const proveedor = limpiarNombre(f[7]);
  if (fch < desdeFecha) {
    const v = viejas.get(num) ?? { fecha: fch, proveedor, lineas: 0 };
    v.lineas++; viejas.set(num, v);
    continue;
  }
  const o = ordenes.get(num) ?? { numero: num, folio: `OC-${fch.slice(2, 4)}-${num}`, fecha: fch, proveedor, prov_llave: llave(proveedor),
    sin_status: false, para: new Set<string>(), lineas: [] };
  if (!o.proveedor && proveedor) { o.proveedor = proveedor; o.prov_llave = llave(proveedor); }
  if (!status) o.sin_status = true;
  const para = limpiarNombre(f[6]);
  if (para && para !== "-") o.para.add(para);
  o.lineas.push({ llave: llave(nombre), nombre, cantidad });
  ordenes.set(num, o);
}
const ocs = [...ordenes.values()].map((o) => ({
  numero: o.numero, folio: o.folio, fecha: o.fecha, proveedor: o.proveedor, prov_llave: o.prov_llave,
  notas: [`Pasada de la hoja de compras el ${hoy}.`, o.para.size ? `Para: ${[...o.para].join("; ")}.` : null,
    o.sin_status ? "En la hoja no tenía status: confirma si ya llegó." : null].filter(Boolean).join(" "),
  lineas: o.lineas,
}));
const maxNumero = Math.max(0, ...filasOrd.map(([, f]) => Number(celda(f, 1))).filter((n) => Number.isInteger(n) && n < 100000));

const lit = (x: unknown) => `$json$${JSON.stringify(x)}$json$::jsonb`;
const resumenViejas = [...viejas.entries()].sort((a, b) => a[0] - b[0]).map(([n, v]) => `${n} (${v.fecha}, ${v.proveedor || "sin proveedor"}, ${v.lineas} renglón/es)`);

const sql = `-- Sincronización con la hoja de compras (${hoy}): ${preciosNuevos.length} precios (${descartadas} sin costo), ${componentes.length} componentes revisados, ${ocs.length} órdenes abiertas.
-- Órdenes abiertas anteriores a ${desdeFecha} que NO se pasan (revisar a mano): ${resumenViejas.join(", ") || "ninguna"}.
do $s$
declare
  v_comp jsonb := ${lit(componentes)};
  v_precios jsonb := ${lit(preciosNuevos)};
  v_ocs jsonb := ${lit(ocs)};
  r record; l record; c record; a uuid; p uuid; v_oc uuid; v_seq int; v_ref text; v_en timestamptz; v_hay boolean;
  n_comp int := 0; n_prec int := 0; n_vigente int := 0; n_oc int := 0; n_lin int := 0; n_sin_art int := 0;
  raras text[] := '{}'; sin_art text[] := '{}'; sin_prov text[] := '{}'; ya text[] := '{}';
begin
  -- 1. Componentes nuevos, con clave C-N siguiente (como el importador).
  select coalesce(max(substring(clave from '^C-N(\\d+)$')::int), 0) into v_seq from articulos where clave ~ '^C-N\\d+$';
  for r in select * from jsonb_to_recordset(v_comp) x(llave text, nombre text, unidad text, tipo text) loop
    continue when exists (select 1 from articulos where legacy_id = 'LC:' || r.llave);
    v_seq := v_seq + 1;
    insert into articulos (legacy_id, clave, tipo, nombre, unidad)
    values ('LC:' || r.llave, 'C-N' || lpad(v_seq::text, 4, '0'), r.tipo::tipo_articulo, r.nombre, r.unidad);
    n_comp := n_comp + 1;
  end loop;

  -- 2. Precios, en el orden en que se capturaron.
  for r in select * from jsonb_to_recordset(v_precios) x(fila int, fecha date, llave text, nombre text, costo numeric,
                                                      prov_llave text, proveedor text, dias int) order by fila loop
    v_ref := 'ACTUALIZACIONES fila ' || r.fila;
    continue when exists (select 1 from historial_costos where origen = 'importacion' and referencia = v_ref);
    select id into a from articulos where legacy_id = 'LC:' || r.llave;
    if a is null then sin_art := sin_art || (r.fila || ' ' || r.nombre); continue; end if;
    select id into p from proveedores where legacy_id = 'PROV:' || r.prov_llave;
    if p is null and r.proveedor is not null then
      select id into p from proveedores where lower(nombre) = lower(r.proveedor) order by activo desc limit 1;
    end if;
    select * into c from costos_articulo where articulo_id = a;
    v_hay := found;
    if v_hay and c.moneda = 'MXN' and c.costo > 0 and (r.costo > c.costo * 5 or r.costo < c.costo / 5) then
      raras := raras || format('%s (fila %s): $%s en la hoja, $%s en el ERP', r.nombre, r.fila, r.costo, c.costo);
      continue;
    end if;
    v_en := (r.fecha::text || 'T12:00:00-06:00')::timestamptz;
    perform set_config('erp.origen_costo', 'importacion', true);
    perform set_config('erp.referencia_costo', v_ref, true);
    if not v_hay then
      insert into costos_articulo (articulo_id, costo, moneda, proveedor_id, actualizado_en, actualizado_por)
      values (a, r.costo, 'MXN', p, r.fecha, null);
      n_vigente := n_vigente + 1;
    elsif c.moneda <> 'MXN' or c.actualizado_en > r.fecha then
      -- El ERP tiene algo más nuevo (o en dólares): el renglón queda en la historia, nada más.
      insert into historial_costos (articulo_id, costo_anterior, costo_nuevo, moneda, proveedor_id, origen, referencia, en)
      values (a, null, r.costo, 'MXN', p, 'importacion', v_ref, v_en);
    else
      update costos_articulo set costo = r.costo, proveedor_id = coalesce(p, proveedor_id), actualizado_en = r.fecha,
        actualizado_por = null where articulo_id = a;
      -- Mismo costo, nueva fecha: el disparador no lo anota, pero la hoja sí lo tenía.
      if c.costo = r.costo then
        insert into historial_costos (articulo_id, costo_anterior, costo_nuevo, moneda, proveedor_id, origen, referencia, en)
        values (a, c.costo, r.costo, 'MXN', p, 'importacion', v_ref, v_en);
      end if;
      n_vigente := n_vigente + 1;
    end if;
    -- El disparador fecha la historia con la hora de hoy; vale la del renglón.
    update historial_costos set en = v_en where origen = 'importacion' and referencia = v_ref;
    if r.dias is not null then
      update articulos set tiempo_entrega_dias = r.dias where id = a and tiempo_entrega_dias is distinct from r.dias;
    end if;
    n_prec := n_prec + 1;
  end loop;
  perform set_config('erp.origen_costo', '', true);
  perform set_config('erp.referencia_costo', '', true);

  -- 3. Órdenes de compra abiertas, con su número de la hoja.
  for r in select * from jsonb_to_recordset(v_ocs) x(numero int, folio text, fecha date, proveedor text, prov_llave text,
                                                   notas text, lineas jsonb) order by numero loop
    if exists (select 1 from ordenes_compra where folio = r.folio) then ya := ya || r.folio; continue; end if;
    select id into p from proveedores where legacy_id = 'PROV:' || r.prov_llave;
    if p is null then select id into p from proveedores where lower(nombre) = lower(r.proveedor) order by activo desc limit 1; end if;
    if p is null then sin_prov := sin_prov || format('%s (%s)', r.folio, coalesce(nullif(r.proveedor, ''), 'sin proveedor')); continue; end if;
    insert into ordenes_compra (folio, proveedor_id, estado, fecha, notas, moneda)
    values (r.folio, p, 'enviada', r.fecha, r.notas, 'MXN') returning id into v_oc;
    for l in select * from jsonb_to_recordset(r.lineas) x(llave text, nombre text, cantidad numeric) loop
      select id into a from articulos where legacy_id = 'LC:' || l.llave;
      if a is null then n_sin_art := n_sin_art + 1; end if;
      insert into oc_lineas (orden_compra_id, articulo_id, descripcion, cantidad, costo_unitario)
      values (v_oc, a, case when a is null then l.nombre end, l.cantidad,
              coalesce((select k.costo from costos_articulo k where k.articulo_id = a and k.moneda = 'MXN'), 0));
      n_lin := n_lin + 1;
    end loop;
    n_oc := n_oc + 1;
  end loop;
  -- Las OC nuevas del ERP siguen después de la última de la hoja.
  insert into folios (serie, anio, ultimo) values ('OC', 0, ${maxNumero})
  on conflict (serie, anio) do update set ultimo = greatest(folios.ultimo, excluded.ultimo);

  raise ${ensayo ? "exception 'ENSAYO" : "notice 'LISTO"} componentes nuevos: % | precios: % (% cambian el vigente) | precios raros sin aplicar: % | sin componente: % | órdenes: % con % renglones (% sin componente del catálogo) | ya estaban: % | sin proveedor: %',
    n_comp, n_prec, n_vigente, array_to_string(raras, '; '), array_to_string(sin_art, '; '), n_oc, n_lin, n_sin_art,
    array_to_string(ya, ', '), array_to_string(sin_prov, '; ');
end $s$;
`;
process.stdout.write(sql);

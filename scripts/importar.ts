// Migración de las hojas de Google al ERP.
//
//   npx tsx scripts/importar.ts --dir <carpeta con los JSON>     (volcados locales)
//   GOOGLE_ACCESS_TOKEN=… npx tsx scripts/importar.ts --google   (lee las hojas directo)
//
// Base: DATABASE_URL (por defecto el Supabase local). Corre con el usuario
// postgres: es una carga de arranque, no una operación de la app.
//
// Se puede correr varias veces mientras dure la transición (las hojas siguen
// vivas): actualiza por clave en vez de duplicar. Las existencias de arranque
// solo se cargan si el artículo no tiene movimientos; --reiniciar-existencias
// las vuelve a cargar, y se niega si el ERP ya registró movimientos reales.
//
// Al final compara el precio que calcula el ERP contra el de "Nuevo Costeo":
// si no coinciden, algo se importó mal y hay que verlo antes de usarlo.
import { readFileSync, readdirSync, existsSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";
import * as T from "../src/importador/transformar";
import { llave } from "../src/importador/util";

type Filas = string[][];
const args = process.argv.slice(2);
const arg = (n: string) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
const bandera = (n: string) => args.includes(n);
const config = JSON.parse(readFileSync(new URL("./importar.config.json", import.meta.url), "utf8"));
const resumen: Record<string, unknown> = {};
const avisos: string[] = [];

// ---------------------------------------------------------------------------
// Fuentes
// ---------------------------------------------------------------------------
async function leerGoogle(nombre: string): Promise<Filas> {
  const token = process.env.GOOGLE_ACCESS_TOKEN;
  if (!token) throw new Error("Falta GOOGLE_ACCESS_TOKEN");
  const [id, rango, bloque] = config.hojas[nombre] as [string, string, number?];
  const pedir = async (r: string) => {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${id}/values/${encodeURIComponent(r)}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(`Sheets ${nombre}: ${res.status} ${await res.text()}`);
    return ((await res.json()).values ?? []) as Filas;
  };
  if (!bloque) return pedir(rango);
  // Pestañas enormes (Registro): por bloques, hasta que una venga vacía.
  const [hoja, cols] = rango.split("!");
  const [c1, c2] = cols.split(":");
  const todo: Filas = [];
  for (let desde = 1; ; desde += bloque) {
    const parte = await pedir(`${hoja}!${c1}${desde}:${c2}${desde + bloque - 1}`);
    todo.push(...parte);
    if (parte.length < bloque) break;
  }
  return todo;
}

// --dir acepta varias carpetas separadas por coma (los volcados vienen de varios archivos).
function leerArchivo(dirs: string, nombre: string): Filas {
  for (const dir of dirs.split(",")) {
    const partes = readdirSync(dir).filter((f) => f === `${nombre}.json` || f.startsWith(`${nombre}_parte`)).sort();
    if (partes.length) return partes.flatMap((f) => (JSON.parse(readFileSync(join(dir, f), "utf8")).values ?? []) as Filas);
  }
  throw new Error(`No está ${nombre}.json en ${dirs}`);
}

async function fuente(nombre: string): Promise<Filas> {
  if (bandera("--google")) return leerGoogle(nombre);
  const dir = arg("--dir");
  if (!dir) throw new Error("Usa --dir <carpeta> o --google");
  return leerArchivo(dir, nombre);
}

// ---------------------------------------------------------------------------
// Base
// ---------------------------------------------------------------------------
const db = new pg.Client({ connectionString: process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres" });
const json = (x: unknown) => JSON.stringify(x);

async function paso<T>(nombre: string, fn: () => Promise<T>): Promise<T> {
  const t0 = Date.now();
  await db.query("begin");
  try {
    const r = await fn();
    await db.query("commit");
    console.log(`✔ ${nombre} (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
    return r;
  } catch (e) {
    await db.query("rollback");
    console.error(`✘ ${nombre}: ${(e as Error).message}`);
    throw e;
  }
}

// Disparadores pesados apagados durante la carga; al final se recalcula una vez.
// (los "recalcular_*" son los incrementales de 20261003000061_costeo_incremental.sql)
const PESADOS: [string, string][] = [
  ...["costos_articulo", "bom_lineas", "bom_operaciones"].flatMap((t) => [[t, "recalcular_alta"], [t, "recalcular_cambio"], [t, "recalcular_baja"]] as [string, string][]),
  ["costos_articulo", "historial"], ["bom_lineas", "auditar"], ["bom_lineas", "evitar_ciclos"],
  ["articulos", "recalcular_alta"], ["articulos", "recalcular_cambio"], ["articulos", "auditar"],
  ["tarifas_mano_obra", "recalcular"], ["proveedores", "auditar"], ["clientes", "auditar"], ["pedidos", "auditar"],
];
async function disparadores(activos: boolean) {
  for (const [t, d] of PESADOS) await db.query(`alter table public.${t} ${activos ? "enable" : "disable"} trigger ${d}`);
}

async function main() {
  await db.connect();
  console.log(`Importando desde ${bandera("--google") ? "Google Sheets" : arg("--dir")} …\n`);

  // Lectura y transformación (sin tocar la base todavía: si algo falla aquí, no se carga nada).
  const provs = T.proveedores(await fuente("proveedores"));
  const { componentes, duplicados } = T.componentes(await fuente("lista_componentes"));
  const { precios, descartadas: preciosDescartados } = T.actualizaciones(await fuente("actualizaciones"));
  const equipos = T.equipos(await fuente("equipos"));
  const bom = T.baseEquipos(await fuente("base_equipos"));
  const inventario = T.inventario(await fuente("inventario"));
  const demanda = T.demanda(await fuente("demanda_b"));
  const { movimientos, descartados: movDescartados } = T.registro([await fuente("registro_a")]);
  const descripciones = T.descripciones(await fuente("cot_descripciones"));
  const directorio = T.directorioClientes(await fuente("clientes_directorio"));
  const unified = T.clientesUnified(await fuente("clientes_unified"));
  const { movimientos: libro, descartados: libroDescartados } = T.libroVentas(await fuente("ventas"));
  const paneles = await Promise.all(Object.entries(config.vendedores as Record<string, { correo: string; panel: string; nombre: string }>).map(async ([clave, v]) => ({
    clave, ...v, clientes: T.clientesPanel(await fuente(`${v.panel}_clientes`)), ventas: T.ventasPanel(await fuente(`${v.panel}_ventas`)),
  })));
  Object.assign(resumen, {
    leidos: { proveedores: provs.length, componentes: componentes.length, precios_historicos: precios.length, equipos: equipos.length,
      lineas_bom: bom.length, filas_inventario: inventario.length, movimientos_hoja: movimientos.length,
      clientes_paneles: paneles.reduce((s, p) => s + p.clientes.length, 0), ventas_paneles: paneles.reduce((s, p) => s + p.ventas.ventas.length, 0),
      clientes_directorio: directorio.length, clientes_crm: unified.length, libro_ventas: libro.length },
    descartados: { componentes_nombre_repetido: duplicados.length, precios_sin_fecha_o_costo: preciosDescartados, movimientos_incompletos: movDescartados, libro_incompletos: libroDescartados },
  });
  if (duplicados.length) avisos.push(`${duplicados.length} componentes con nombre repetido en ListaComponentes (se tomó el primero): ${duplicados.slice(0, 5).join("; ")}…`);

  await disparadores(false);
  try {
    // 1. Proveedores (los del directorio + los que solo aparecen en componentes o en el historial)
    await paso("Proveedores", async () => {
      const extra = new Map<string, string>();
      for (const n of [...componentes.map((c) => c.proveedor), ...precios.map((p) => p.proveedor)]) {
        if (n && !provs.some((p) => p.llave === llave(n))) extra.set(llave(n), n);
      }
      const todos = [...provs, ...[...extra].map(([k, nombre]) => ({ llave: k, nombre, categoria: null, telefono: null, contacto: null, correo: null,
        rfc: null, domicilio: null, pais: "México", es_importacion: false, dias_credito: 0, notas: "Solo aparece en el historial de precios" }))];
      await db.query(`
        insert into proveedores (legacy_id, nombre, categoria, telefono, contacto, correo, rfc, domicilio, pais, es_importacion, dias_credito, notas)
        select 'PROV:' || llave, nombre, categoria, telefono, contacto, correo, rfc, domicilio, pais, es_importacion, dias_credito, notas
        from jsonb_to_recordset($1) x(llave text, nombre text, categoria text, telefono text, contacto text, correo text, rfc text,
             domicilio text, pais text, es_importacion boolean, dias_credito int, notas text)
        on conflict (legacy_id) do update set nombre = excluded.nombre, categoria = coalesce(excluded.categoria, proveedores.categoria),
          telefono = coalesce(excluded.telefono, proveedores.telefono), contacto = coalesce(excluded.contacto, proveedores.contacto),
          correo = coalesce(excluded.correo, proveedores.correo), rfc = coalesce(excluded.rfc, proveedores.rfc),
          domicilio = coalesce(excluded.domicilio, proveedores.domicilio), pais = excluded.pais, es_importacion = excluded.es_importacion,
          dias_credito = excluded.dias_credito`, [json(todos)]);
      resumen.proveedores = todos.length;
    });

    // 2. Categorías de componentes (el "Concepto" del inventario: Eléctricos, Bandas, Acero…)
    await paso("Categorías", async () => {
      const conceptos = [...new Set(inventario.map((e) => e.concepto).filter(Boolean))] as string[];
      await db.query(`insert into categorias (nombre) select unnest($1::text[]) on conflict (nombre) do nothing`, [conceptos]);
      resumen.categorias_componentes = conceptos.length;
    });

    // 3. Componentes: los del catálogo de compras + los que solo existen en el inventario
    const porLlave = new Map(componentes.filter((c) => !c.es_mano_obra).map((c) => [c.llave, c]));
    const invPorLlave = new Map(inventario.map((e) => [e.llave, e]));
    await paso("Componentes", async () => {
      // Una clave asignada no cambia entre corridas (la gente ya la habrá usado).
      const previas = new Map<string, string>((await db.query(`select legacy_id, clave from articulos where legacy_id is not null`)).rows
        .map((r) => [r.legacy_id, r.clave]));
      const usados = new Set<string>((await db.query(`select clave from articulos`)).rows.map((r) => r.clave));
      const conteo = new Map<string, number>();
      componentes.forEach((c) => c.numero_item && conteo.set(c.numero_item, (conteo.get(c.numero_item) ?? 0) + 1));
      let seq = 0;
      const claveDe = (c: T.Componente | null, llaveNombre: string) => {
        const previa = previas.get("LC:" + llaveNombre);
        if (previa) return previa;
        // El "Número de Ítem" de la hoja sirve de clave si es numérico y no se repite (tiene 911 huecos y duplicados).
        if (c?.numero_item && /^\d+$/.test(c.numero_item) && conteo.get(c.numero_item) === 1) {
          const k = `C-${c.numero_item.padStart(5, "0")}`;
          if (!usados.has(k)) { usados.add(k); return k; }
        }
        let k: string;
        do { k = `C-N${String(++seq).padStart(4, "0")}`; } while (usados.has(k));
        usados.add(k);
        return k;
      };
      const filas = [
        ...[...porLlave.values()].map((c) => ({ c, inv: invPorLlave.get(c.llave) ?? null })),
        ...inventario.filter((e) => !porLlave.has(e.llave) && !/^horas? hombre/.test(e.llave)).map((inv) => ({ c: null as T.Componente | null, inv })),
      ].map(({ c, inv }) => {
        const k = c?.llave ?? inv!.llave;
        const d = demanda.get(k);
        const desc = descripciones.get(k);
        const nombre = c?.nombre ?? inv!.nombre;
        const un = c?.unidad ?? inv!.unidad;
        return {
          llave: k, clave: claveDe(c, k), nombre, tipo: T.tipoComponente(nombre, un), unidad: un,
          descripcion: c?.descripcion ?? desc?.descripcion ?? null, imagen: c?.imagen ?? desc?.imagen ?? null,
          concepto: inv?.concepto ?? null, proveedor: c?.proveedor ? llave(c.proveedor) : null,
          dias: d?.dias ?? c?.dias_entrega ?? null, empaque: d?.empaque && d.empaque > 0 ? d.empaque : c?.empaque ?? 1,
          seguridad: inv?.seguridad ?? null, solo_inventario: !c,
        };
      });
      await db.query(`
        insert into articulos (legacy_id, clave, tipo, nombre, unidad, descripcion, imagen_url, categoria_id, proveedor_id,
                               tiempo_entrega_dias, empaque, stock_minimo_fijo, es_importado)
        select 'LC:' || x.llave, x.clave, x.tipo::tipo_articulo, x.nombre, x.unidad, x.descripcion, x.imagen,
               (select id from categorias where nombre = x.concepto), p.id, x.dias, greatest(x.empaque, 0.001), x.seguridad,
               coalesce(p.es_importacion, false)
        from jsonb_to_recordset($1) x(llave text, clave text, tipo text, nombre text, unidad text, descripcion text, imagen text,
             concepto text, proveedor text, dias int, empaque numeric, seguridad numeric)
        left join proveedores p on p.legacy_id = 'PROV:' || x.proveedor
        on conflict (legacy_id) do update set nombre = excluded.nombre, unidad = excluded.unidad,
          descripcion = coalesce(excluded.descripcion, articulos.descripcion), imagen_url = coalesce(excluded.imagen_url, articulos.imagen_url),
          categoria_id = coalesce(excluded.categoria_id, articulos.categoria_id), proveedor_id = coalesce(excluded.proveedor_id, articulos.proveedor_id),
          tiempo_entrega_dias = coalesce(excluded.tiempo_entrega_dias, articulos.tiempo_entrega_dias), empaque = excluded.empaque,
          stock_minimo_fijo = coalesce(excluded.stock_minimo_fijo, articulos.stock_minimo_fijo)`, [json(filas)]);
      resumen.componentes = filas.length;
      resumen.componentes_solo_en_inventario = filas.filter((f) => f.solo_inventario).length;
    });

    // 4. Costo vigente y su historia (ACTUALIZACIONES desde 2011)
    await paso("Costos e historial", async () => {
      const costos = [...porLlave.values()].filter((c) => c.costo != null && c.costo >= 0)
        .map((c) => ({ llave: c.llave, costo: c.costo, fecha: c.fecha_costo, proveedor: c.proveedor ? llave(c.proveedor) : null, margen: c.utilidad_personalizada }));
      await db.query(`
        insert into costos_articulo (articulo_id, costo, moneda, proveedor_id, actualizado_en, margen, actualizado_por)
        select a.id, x.costo, 'MXN', p.id, coalesce(x.fecha::date, current_date),
               case when x.margen > 0 and x.margen < 1 and abs(x.margen - 0.30) > 0.001 then x.margen end, null
        from jsonb_to_recordset($1) x(llave text, costo numeric, fecha text, proveedor text, margen numeric)
        join articulos a on a.legacy_id = 'LC:' || x.llave
        left join proveedores p on p.legacy_id = 'PROV:' || x.proveedor
        on conflict (articulo_id) do update set costo = excluded.costo, proveedor_id = excluded.proveedor_id,
          actualizado_en = excluded.actualizado_en, margen = excluded.margen`, [json(costos)]);
      await db.query(`delete from historial_costos where origen = 'importacion'`);
      const sinArticulo = new Map<string, number>();
      const hist = precios.filter((p) => {
        const ok = porLlave.has(p.llave);
        if (!ok) sinArticulo.set(p.nombre, (sinArticulo.get(p.nombre) ?? 0) + 1);
        return ok;
      });
      await db.query(`
        insert into historial_costos (articulo_id, costo_anterior, costo_nuevo, moneda, proveedor_id, origen, referencia, usuario_id, en)
        select a.id, lag(x.costo) over (partition by a.id order by x.fecha, x.fila), x.costo, 'MXN', p.id, 'importacion',
               'ACTUALIZACIONES fila ' || x.fila, null, (x.fecha || 'T12:00:00-06:00')::timestamptz
        from jsonb_to_recordset($1) x(llave text, fecha text, costo numeric, proveedor text, fila int)
        join articulos a on a.legacy_id = 'LC:' || x.llave
        left join proveedores p on p.legacy_id = 'PROV:' || x.proveedor`,
        [json(hist.map((p) => ({ ...p, proveedor: p.proveedor ? llave(p.proveedor) : null })))]);
      resumen.costos = costos.length;
      resumen.historial_costos = hist.length;
      resumen.historial_sin_articulo = [...sinArticulo.values()].reduce((a, b) => a + b, 0);
      if (sinArticulo.size) avisos.push(`${sinArticulo.size} nombres del historial de precios ya no existen en el catálogo (renombrados o borrados): ${[...sinArticulo.keys()].slice(0, 5).join("; ")}…`);
    });

    // 5. Tarifas de mano de obra (las "Horas hombre …" de la hoja)
    await paso("Tarifas de mano de obra", async () => {
      const t = componentes.filter((c) => c.es_mano_obra && c.costo).map((c) => ({ etapa: T.etapaDeManoObra(c.nombre), costo: c.costo }));
      await db.query(`
        update tarifas_mano_obra t set costo_hora = x.costo, actualizado_en = now()
        from jsonb_to_recordset($1) x(etapa text, costo numeric) join etapas e on e.nombre = x.etapa
        where t.etapa_id = e.id`, [json(t)]);
      resumen.tarifas = Object.fromEntries(t.map((x) => [x.etapa, x.costo]));
    });

    // 6. Equipos
    await paso("Equipos", async () => {
      const filas = equipos.map((e) => {
        const d = descripciones.get(llave(e.nombre));
        return { ...e, descripcion: e.descripcion ?? d?.descripcion ?? null, imagen: e.imagen ?? d?.imagen ?? null };
      });
      await db.query(`
        insert into articulos (legacy_id, clave, tipo, nombre, unidad, descripcion, imagen_url, categoria_id, medida_especial,
                               familia, controla_inventario)
        select 'EQ:' || x.clave, x.clave, 'equipo', x.nombre, 'pieza', x.descripcion, x.imagen,
               coalesce((select id from categorias where nombre = x.tipo), (select id from categorias where nombre = 'OTRO')),
               x.medida_especial, x.tipo, false
        from jsonb_to_recordset($1) x(clave text, nombre text, tipo text, medida_especial boolean, descripcion text, imagen text)
        on conflict (legacy_id) do update set nombre = excluded.nombre, descripcion = coalesce(excluded.descripcion, articulos.descripcion),
          imagen_url = coalesce(excluded.imagen_url, articulos.imagen_url), categoria_id = excluded.categoria_id,
          medida_especial = excluded.medida_especial, familia = excluded.familia`, [json(filas)]);
      resumen.equipos = filas.length;
    });

    // 7. Listas de materiales
    await paso("Listas de materiales", async () => {
      const comps = new Set(porLlave.keys());
      const faltantes = new Map<string, string>();
      const lineas: { equipo: string; llave: string; cantidad: number; nota: string | null; orden: number }[] = [];
      const horas = new Map<string, number>();
      bom.forEach((l, i) => {
        const etapa = T.etapaDeManoObra(l.material);
        if (etapa) { const k = `${l.equipo}|${etapa}`; horas.set(k, (horas.get(k) ?? 0) + (l.cantidad ?? 0)); return; }
        if (!comps.has(l.llave)) faltantes.set(l.llave, l.material);
        lineas.push({ equipo: l.equipo, llave: l.llave, cantidad: l.cantidad ?? 0, orden: i,
          nota: l.cantidad == null ? `Sin cantidad en la hoja (fila ${l.fila})` : null });
      });
      // Lo que la lista pide y ya no está en el catálogo (renombrado en compras): se crea sin costo para
      // que el equipo lo muestre como faltante en vez de costar $0 en silencio, como pasa hoy.
      await db.query(`
        insert into articulos (legacy_id, clave, tipo, nombre, unidad, descripcion)
        select 'FALTA:' || x.llave, 'C-F' || lpad((row_number() over ())::text, 4, '0') || '-' || substr(md5(x.llave), 1, 4),
               'componente', x.nombre, 'pieza', 'Pedido por una lista de materiales pero no existe en ListaComponentes (¿se renombró?).'
        from jsonb_to_recordset($1) x(llave text, nombre text)
        on conflict (legacy_id) do nothing`, [json([...faltantes].map(([k, nombre]) => ({ llave: k, nombre })))]);
      await db.query(`delete from bom_lineas where padre_id in (select id from articulos where legacy_id like 'EQ:%')`);
      await db.query(`delete from bom_operaciones where articulo_id in (select id from articulos where legacy_id like 'EQ:%')`);
      await db.query(`
        insert into bom_lineas (padre_id, hijo_id, cantidad, notas, orden)
        select e.id, coalesce(a.id, f.id), x.cantidad, x.nota, x.orden
        from jsonb_to_recordset($1) x(equipo text, llave text, cantidad numeric, nota text, orden int)
        join articulos e on e.legacy_id = 'EQ:' || x.equipo
        left join articulos a on a.legacy_id = 'LC:' || x.llave
        left join articulos f on f.legacy_id = 'FALTA:' || x.llave`, [json(lineas)]);
      await db.query(`
        insert into bom_operaciones (articulo_id, etapa_id, horas)
        select e.id, et.id, x.horas from jsonb_to_recordset($1) x(equipo text, etapa text, horas numeric)
        join articulos e on e.legacy_id = 'EQ:' || x.equipo join etapas et on et.nombre = x.etapa`,
        [json([...horas].map(([k, h]) => ({ equipo: k.split("|")[0], etapa: k.split("|")[1], horas: h })))]);
      const sinLista = (await db.query(`select clave from articulos a where legacy_id like 'EQ:%' and not exists (select 1 from bom_lineas b where b.padre_id = a.id)`)).rows.map((r) => r.clave);
      resumen.lineas_bom = lineas.length;
      resumen.operaciones = horas.size;
      resumen.componentes_faltantes_en_catalogo = [...faltantes.values()];
      resumen.lineas_sin_cantidad = lineas.filter((l) => l.nota).length;
      resumen.equipos_sin_lista = sinLista;
      if (faltantes.size) avisos.push(`${faltantes.size} materiales de listas de materiales no existen en el catálogo (se crearon sin costo para que se vean): ${[...faltantes.values()].join("; ")}`);
      if (sinLista.length) avisos.push(`Equipos sin lista de materiales (precio $0 en la hoja): ${sinLista.join(", ")}`);
    });
  } finally {
    await disparadores(true);
  }

  // 8. Costeo y comparación contra la hoja
  await paso("Recalcular costos y comparar con Nuevo Costeo", async () => {
    await db.query(`select recalcular_costos()`);
    const { rows } = await db.query(`
      select x.clave, x.precio_hoja, pl.precio, cc.costo_total, x.costo_hoja
      from jsonb_to_recordset($1) x(clave text, precio_hoja numeric, costo_hoja numeric)
      join articulos a on a.legacy_id = 'EQ:' || x.clave
      left join precios_lista pl on pl.articulo_id = a.id
      left join costos_calculados cc on cc.articulo_id = a.id
      where x.precio_hoja > 0`, [json(equipos)]);
    const iguales = rows.filter((r) => Number(r.precio) === Number(r.precio_hoja));
    const distintos = rows.filter((r) => Number(r.precio) !== Number(r.precio_hoja))
      .map((r) => ({ clave: r.clave, hoja: Number(r.precio_hoja), erp: Number(r.precio), costo_hoja: Number(r.costo_hoja), costo_erp: Number(Number(r.costo_total).toFixed(2)) }));
    resumen.validacion_precios = { comparados: rows.length, iguales: iguales.length, distintos: distintos.length, ejemplos: distintos.slice(0, 15) };
    console.log(`   Precios de equipo iguales a la hoja: ${iguales.length} de ${rows.length}`);
  });

  // 9. Existencias de arranque
  await paso("Existencias", async () => {
    const reales = Number((await db.query(`select count(*) from movimientos_inventario where tipo <> 'inicial'`)).rows[0].count);
    if (bandera("--reiniciar-existencias")) {
      if (reales > 0) throw new Error(`El ERP ya tiene ${reales} movimientos reales: no se reinician existencias (corrige con ajustes).`);
      await db.query(`alter table movimientos_inventario disable trigger inalterable`);
      await db.query(`delete from reservas where motivo = 'Apartado en la hoja (RESERVADO) al importar'`);
      await db.query(`delete from movimientos_inventario where tipo = 'inicial'`);
      await db.query(`delete from existencias`);
      await db.query(`alter table movimientos_inventario enable trigger inalterable`);
    }
    const negativos: string[] = [];
    const filas: { llave: string; almacen: string; cantidad: number }[] = [];
    const reservados: { llave: string; cantidad: number }[] = [];
    for (const e of inventario) {
      for (const [alm, n] of Object.entries(e.por_almacen)) {
        if (n < 0) { negativos.push(`${e.nombre} (${alm}: ${n})`); continue; }
        if (alm === "RESERVADO") { filas.push({ llave: e.llave, almacen: "Planta Baja", cantidad: n }); reservados.push({ llave: e.llave, cantidad: n }); }
        else filas.push({ llave: e.llave, almacen: alm, cantidad: n });
      }
    }
    const r = await db.query(`
      insert into movimientos_inventario (tipo, articulo_id, almacen_id, cantidad, motivo, costo_unitario)
      select 'inicial', a.id, al.id, sum(x.cantidad), 'Existencia de arranque (hoja Inventario)', max(c.costo)
      from jsonb_to_recordset($1) x(llave text, almacen text, cantidad numeric)
      join articulos a on a.legacy_id = 'LC:' || x.llave
      join almacenes al on al.nombre = x.almacen
      left join costos_articulo c on c.articulo_id = a.id
      where not exists (select 1 from movimientos_inventario m where m.articulo_id = a.id)
      group by a.id, al.id having sum(x.cantidad) > 0`, [json(filas)]);
    await db.query(`
      insert into reservas (articulo_id, cantidad, motivo)
      select a.id, x.cantidad, 'Apartado en la hoja (RESERVADO) al importar'
      from jsonb_to_recordset($1) x(llave text, cantidad numeric) join articulos a on a.legacy_id = 'LC:' || x.llave
      where not exists (select 1 from reservas r where r.articulo_id = a.id and r.motivo like 'Apartado en la hoja%')`, [json(reservados)]);
    resumen.existencias_cargadas = r.rowCount;
    resumen.existencias_negativas_omitidas = negativos;
    if (negativos.length) avisos.push(`Existencias negativas en la hoja (no se cargaron, revisar con conteo): ${negativos.join("; ")}`);
  });

  // 10. Archivo de movimientos de la hoja (para la demanda y el kardex histórico)
  await paso("Movimientos históricos de la hoja", async () => {
    await db.query(`truncate historial_movimientos_hoja`);
    for (let i = 0; i < movimientos.length; i += 5000) {
      await db.query(`
        insert into historial_movimientos_hoja (fecha, articulo_id, nombre_original, cantidad, tipo, almacen, personal, motivo, documento, proveedor, notas, merma, fila_origen)
        select x.fecha::timestamptz, a.id, x.nombre, x.cantidad, x.tipo, x.almacen, x.personal, x.motivo, x.documento, x.proveedor, x.notas, x.merma, x.fila
        from jsonb_to_recordset($1) x(fecha text, llave text, nombre text, cantidad numeric, tipo text, almacen text, personal text, motivo text,
             documento text, proveedor text, notas text, merma boolean, fila int)
        left join articulos a on a.legacy_id = 'LC:' || x.llave`, [json(movimientos.slice(i, i + 5000))]);
    }
    const sin = Number((await db.query(`select count(*) from historial_movimientos_hoja where articulo_id is null`)).rows[0].count);
    resumen.movimientos_hoja = movimientos.length;
    resumen.movimientos_hoja_sin_articulo = sin;
  });

  // 11. Clientes y ventas de los paneles
  await paso("Clientes y ventas de los paneles", async () => {
    await db.query(`update clientes set legacy_ref = 'CLI:' || substr(legacy_ref, 7) where legacy_ref like 'PANEL:%'`);
    const vendedores = new Map<string, string>();
    for (const p of paneles) {
      const { rows } = await db.query(`select id from perfiles where correo = $1`, [p.correo]);
      if (!rows[0]) throw new Error(`No existe el usuario ${p.correo} (${p.nombre}). Invítalo o crea su cuenta antes de importar.`);
      vendedores.set(p.clave, rows[0].id);
    }
    const duenio = new Map<string, string>();
    const clientes: (T.ClientePanel & { vendedor: string; otros: string[] })[] = [];
    for (const p of paneles) {
      const nuevos = [...p.clientes, ...p.ventas.ventas.filter((v) => !p.clientes.some((c) => c.llave === v.llave_cliente))
        .map((v) => ({ llave: v.llave_cliente, nombre: v.cliente, contactos: [], estado: null, cp: null, pais: null, domicilio: null, ciudad: null, rfc: null }))];
      for (const c of nuevos) {
        if (duenio.has(c.llave)) { clientes.find((x) => x.llave === c.llave)?.otros.push(p.nombre); continue; }
        duenio.set(c.llave, p.clave);
        clientes.push({ ...c, vendedor: vendedores.get(p.clave)!, otros: [] });
      }
    }
    await db.query(`
      insert into clientes (legacy_ref, nombre, rfc, estado, ciudad, pais, vendedor_id, notas)
      select 'CLI:' || x.llave, x.nombre, x.rfc, x.estado, x.ciudad, coalesce(nullif(x.pais, ''), 'México'), x.vendedor::uuid,
             case when jsonb_array_length(x.otros) > 0 then 'También aparece en el panel de ' || (select string_agg(value, ', ') from jsonb_array_elements_text(x.otros)) end
      from jsonb_to_recordset($1) x(llave text, nombre text, rfc text, estado text, ciudad text, pais text, vendedor text, otros jsonb)
      where not exists (select 1 from clientes c where c.legacy_ref = 'CLI:' || x.llave)`, [json(clientes)]);
    await db.query(`
      insert into contactos (cliente_id, nombre, correo, telefono, whatsapp, domicilio, principal)
      select c.id, k.nombre, k.correo, k.telefono, k.telefono, x.domicilio, k.ord = 1
      from jsonb_to_recordset($1) x(llave text, domicilio text, contactos jsonb)
      join clientes c on c.legacy_ref = 'CLI:' || x.llave
      cross join lateral rows from (jsonb_to_recordset(x.contactos) as (nombre text, correo text, telefono text)) with ordinality k(nombre, correo, telefono, ord)
      where not exists (select 1 from contactos o where o.cliente_id = c.id)`, [json(clientes)]);

    await db.query(`delete from pedidos where historico and folio like 'HIS-%'`);
    let n = 0;
    for (const p of paneles) {
      const ini = p.nombre.split(" ").map((x) => x[0]).join("").slice(0, 2).toUpperCase();
      const ventas = p.ventas.ventas.map((v, i) => ({ ...v, folio: `HIS-${ini}-${String(i + 1).padStart(4, "0")}`,
        canal: /mercado|ml\b/i.test(`${v.fuente} ${v.concepto}`) ? "mercadolibre" : /sitio web/i.test(v.fuente ?? "") ? "sitio_web" : "directo" }));
      await db.query(`
        with p as (
          insert into pedidos (folio, cliente_id, vendedor_id, canal, fecha, estado, historico, notas, entregado_en)
          select x.folio, c.id, $2::uuid, x.canal::canal_venta, x.fecha::date, 'entregado', true,
                 concat_ws(' · ', 'Panel de ventas (fila ' || x.fila || ')', 'Fuente: ' || x.fuente, 'Cotización ' || x.cotizacion,
                           'Factura ' || x.factura, 'Pedido ' || x.pedido, x.notas), x.fecha::timestamptz
          from jsonb_to_recordset($1) x(folio text, llave_cliente text, canal text, fecha text, fila int, fuente text, cotizacion text,
               factura text, pedido text, notas text)
          join clientes c on c.legacy_ref = 'CLI:' || x.llave_cliente
          returning id, folio
        )
        insert into pedido_lineas (pedido_id, titulo, cantidad, precio_unitario, linea)
        select p.id, x.concepto, 1, x.monto, x.linea::linea_venta
        from p join jsonb_to_recordset($1) x(folio text, concepto text, monto numeric, linea text) on x.folio = p.folio`,
        [json(ventas), vendedores.get(p.clave)]);
      n += ventas.length;
    }
    resumen.clientes_paneles = clientes.length;
    resumen.clientes_en_varios_paneles = clientes.filter((c) => c.otros.length).length;
    resumen.ventas_historicas = n;
  });

  // 12. Directorio de clientes y CRM unificado: completa los de los paneles y agrega los demás.
  await paso("Directorio de clientes", async () => {
    const alias = config.alias_vendedores as Record<string, string | null>;
    const correos = [...new Set(Object.values(alias).filter((x): x is string => !!x && x.includes("@")))];
    const ids = new Map<string, string>((await db.query(`select correo, id from perfiles where correo = any($1)`, [correos])).rows.map((r) => [r.correo, r.id]));
    const sinAlias = new Map<string, number>();
    const duenioDe = (agente: string | null) => {
      if (!agente) return null;
      const k = llave(agente);
      if (!(k in alias)) { sinAlias.set(agente, (sinAlias.get(agente) ?? 0) + 1); return null; }
      return alias[k] ? ids.get(alias[k]!) ?? null : null;
    };
    // El directorio manda (tiene RFC); el CRM unificado agrega los que faltan y contactos.
    const porLlave = new Map<string, T.ClienteDirectorio>();
    for (const c of [...directorio, ...unified]) {
      const prev = porLlave.get(c.llave);
      if (!prev) { porLlave.set(c.llave, c); continue; }
      prev.rfc ??= c.rfc; prev.telefono ??= c.telefono; prev.ciudad ??= c.ciudad; prev.estado ??= c.estado; prev.agente ??= c.agente;
      for (const k of c.contactos) if (!prev.contactos.some((x) => llave(x.nombre) === llave(k.nombre))) prev.contactos.push(k);
    }
    const filas = [...porLlave.values()].map((c) => ({ ...c, vendedor: duenioDe(c.agente),
      notas: [c.notas, c.agente ? `Agente en la hoja: ${c.agente}` : null, c.telefono ? `Tel. ${c.telefono}` : null].filter(Boolean).join(" · ") || null }));
    // Nuevos: se crean. Existentes (de los paneles): se completan sin pisar al dueño ni lo capturado.
    await db.query(`
      insert into clientes (legacy_ref, nombre, rfc, estado, ciudad, pais, vendedor_id, notas)
      select 'CLI:' || x.llave, x.nombre, x.rfc, x.estado, x.ciudad, coalesce(nullif(x.pais, ''), 'México'), x.vendedor::uuid, x.notas
      from jsonb_to_recordset($1) x(llave text, nombre text, rfc text, estado text, ciudad text, pais text, vendedor text, notas text)
      on conflict do nothing`, [json(filas)]);
    await db.query(`
      update clientes c set rfc = coalesce(c.rfc, x.rfc), estado = coalesce(c.estado, x.estado), ciudad = coalesce(c.ciudad, x.ciudad),
        vendedor_id = coalesce(c.vendedor_id, x.vendedor::uuid)
      from jsonb_to_recordset($1) x(llave text, rfc text, estado text, ciudad text, vendedor text)
      where c.legacy_ref = 'CLI:' || x.llave`, [json(filas)]);
    await db.query(`
      insert into contactos (cliente_id, nombre, correo, telefono, whatsapp, domicilio, principal)
      select c.id, k.nombre, k.correo, k.telefono, k.telefono, x.domicilio, k.ord = 1
      from jsonb_to_recordset($1) x(llave text, domicilio text, contactos jsonb)
      join clientes c on c.legacy_ref = 'CLI:' || x.llave
      cross join lateral rows from (jsonb_to_recordset(x.contactos) as (nombre text, correo text, telefono text)) with ordinality k(nombre, correo, telefono, ord)
      where not exists (select 1 from contactos o where o.cliente_id = c.id and lower(o.nombre) = lower(k.nombre))`, [json(filas)]);
    resumen.clientes_directorio = filas.length;
    resumen.clientes_sin_duenio = filas.filter((f) => !f.vendedor).length;
    if (sinAlias.size) avisos.push(`Agentes del directorio sin equivalencia en importar.config.json (sus clientes quedan sin dueño): ${[...sinAlias.keys()].join(", ")}`);
  });

  // 13. Libro de ventas y cobros (2022 → hoy): historial y saldo de arranque por cliente.
  await paso("Libro de ventas y cobros", async () => {
    await db.query(`truncate historial_ventas_hoja`);
    // Clientes que solo aparecen en el libro (p.ej. "Público General (Mercadolibre)").
    const nuevos = [...new Map(libro.map((m) => [m.llave_cliente, m.cliente])).entries()].map(([llave_, nombre]) => ({ llave: llave_, nombre }));
    await db.query(`
      insert into clientes (legacy_ref, nombre, notas)
      select 'CLI:' || x.llave, x.nombre, 'Solo aparece en el libro de ventas de la hoja'
      from jsonb_to_recordset($1) x(llave text, nombre text)
      where not exists (select 1 from clientes c where c.legacy_ref = 'CLI:' || x.llave)`, [json(nuevos)]);
    await db.query(`
      insert into historial_ventas_hoja (fecha, cliente_id, cliente_nombre, tipo, monto, cuenta, descripcion, factura, pedido, fila_origen)
      select x.fecha::date, c.id, x.cliente, x.tipo, x.monto, x.cuenta, x.descripcion, x.factura, x.pedido, x.fila
      from jsonb_to_recordset($1) x(fecha text, cliente text, llave_cliente text, tipo text, monto numeric, cuenta text, descripcion text,
           factura text, pedido text, fila int)
      left join clientes c on c.legacy_ref = 'CLI:' || x.llave_cliente`, [json(libro)]);
    const { rows } = await db.query(`select count(*) filter (where saldo > 1) deudores, round(sum(saldo) filter (where saldo > 1)) por_cobrar from v_saldo_arranque_clientes`);
    resumen.libro_ventas = libro.length;
    resumen.saldo_arranque = { clientes_con_saldo: Number(rows[0].deudores), por_cobrar: Number(rows[0].por_cobrar) };
  });

  // 14. Costo mensual hacia atrás de cada equipo (para "Precios vs ventas"). Tarda ~1 min.
  if (!bandera("--sin-historia")) {
    await paso("Reconstruir costo mensual desde 2019", async () => {
      const { rows } = await db.query(`select reconstruir_historial_costeo('2019-01-01') n`);
      resumen.costos_mensuales_reconstruidos = Number(rows[0].n);
    });
  }

  await db.query(`insert into importaciones (fuente, resumen) values ($1, $2)`,
    [bandera("--google") ? "google" : `archivos:${arg("--dir")}`, json({ ...resumen, avisos })]);

  const salida = arg("--informe");
  if (salida) {
    mkdirSync(join(salida, ".."), { recursive: true });
    writeFileSync(salida, JSON.stringify({ ...resumen, avisos }, null, 2));
  }
  console.log("\nResumen:", JSON.stringify(resumen.leidos), "\n");
  if (avisos.length) console.log("Avisos:\n  · " + avisos.map((a) => a.slice(0, 400)).join("\n  · "));
  await db.end();
}

main().catch(async (e) => { console.error(e); try { await disparadores(true); await db.end(); } catch { /* ya cerrada */ } process.exit(1); });

export { existsSync };

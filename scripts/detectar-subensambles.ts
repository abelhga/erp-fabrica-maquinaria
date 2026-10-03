// Busca grupos de piezas que se repiten idénticos (mismo componente y misma
// cantidad) en las listas de materiales de varios equipos, y los guarda como
// sugerencias de subensamble para que ingeniería las revise.
//
//   npx tsx scripts/detectar-subensambles.ts [--min-lineas 5] [--min-equipos 3] [--max 40]
//
// Cómo: se intersecta la lista de cada par de equipos (481 equipos ≈ 115 mil
// pares, cada uno de ~50 líneas: segundos). Cada intersección grande es un
// candidato; su "soporte" es cuántos equipos contienen el grupo completo, que
// se saca con un índice invertido (pieza → equipos). Se eligen los que más
// líneas ahorran sin que dos sugerencias se pisen.
import pg from "pg";

const args = process.argv.slice(2);
const num = (n: string, d: number) => { const i = args.indexOf(n); return i >= 0 ? Number(args[i + 1]) : d; };
const MIN_LINEAS = num("--min-lineas", 5), MIN_EQUIPOS = num("--min-equipos", 3), MAX = num("--max", 40);

const db = new pg.Client({ connectionString: process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres" });
await db.connect();

// Solo líneas fijas (sin parámetro) de equipos: lo paramétrico no es "idéntico".
const { rows } = await db.query(`
  select b.padre_id, b.hijo_id, round(b.cantidad, 4)::text cantidad, h.nombre, coalesce(cc.costo_total, 0) costo
  from bom_lineas b join articulos p on p.id = b.padre_id join articulos h on h.id = b.hijo_id
  left join costos_calculados cc on cc.articulo_id = b.hijo_id
  where p.tipo = 'equipo' and p.activo and b.parametro is null and b.cantidad > 0`);

const equipos = new Map<string, Set<string>>();
const indice = new Map<string, Set<string>>();         // pieza → equipos
const info = new Map<string, { nombre: string; costo: number }>();
for (const r of rows) {
  const t = `${r.hijo_id}@${r.cantidad}`;
  if (!equipos.has(r.padre_id)) equipos.set(r.padre_id, new Set());
  equipos.get(r.padre_id)!.add(t);
  if (!indice.has(t)) indice.set(t, new Set());
  indice.get(t)!.add(r.padre_id);
  info.set(t, { nombre: r.nombre, costo: Number(r.costo) * Number(r.cantidad) });
}
// Piezas en un solo equipo no pueden formar parte de algo compartido.
const compartida = (t: string) => (indice.get(t)?.size ?? 0) >= MIN_EQUIPOS;
const ids = [...equipos.keys()];
const listas = ids.map((id) => [...equipos.get(id)!].filter(compartida).sort());

const candidatos = new Map<string, string[]>();
for (let i = 0; i < ids.length; i++) {
  const a = new Set(listas[i]);
  for (let j = i + 1; j < ids.length; j++) {
    const inter = listas[j].filter((t) => a.has(t));
    if (inter.length >= MIN_LINEAS) candidatos.set(inter.join("|"), inter);
  }
}

function soporte(grupo: string[]): string[] {
  const orden = [...grupo].sort((x, y) => indice.get(x)!.size - indice.get(y)!.size);
  let s = [...indice.get(orden[0])!];
  for (const t of orden.slice(1)) { const e = indice.get(t)!; s = s.filter((x) => e.has(x)); if (s.length < MIN_EQUIPOS) break; }
  return s;
}

const evaluados = [...candidatos.values()].map((g) => {
  const eqs = soporte(g);
  return { grupo: g, equipos: eqs, ahorro: (eqs.length - 1) * (g.length - 1) };
}).filter((c) => c.equipos.length >= MIN_EQUIPOS).sort((a, b) => b.ahorro - a.ahorro);

// Selección voraz: no proponer dos grupos que comparten más de la mitad de sus piezas.
const elegidos: typeof evaluados = [];
for (const c of evaluados) {
  if (elegidos.length >= MAX) break;
  const set = new Set(c.grupo);
  if (elegidos.some((e) => e.grupo.filter((t) => set.has(t)).length > Math.min(e.grupo.length, c.grupo.length) / 2)) continue;
  elegidos.push(c);
}

// Nombre sugerido: las piezas más caras del grupo dicen qué es ("Motorreductor…, Polea…").
const nombre = (g: string[]) => "Grupo: " + [...g].sort((x, y) => info.get(y)!.costo - info.get(x)!.costo).slice(0, 3)
  .map((t) => info.get(t)!.nombre.split(" ").slice(0, 3).join(" ")).join(" + ");

await db.query("begin");
await db.query(`delete from sugerencias_subensamble where estado = 'pendiente'`);
for (const c of elegidos) {
  await db.query(`insert into sugerencias_subensamble (componentes, equipos, lineas, ahorro, nombre_sugerido) values ($1, $2, $3, $4, $5)`, [
    JSON.stringify(c.grupo.map((t) => { const [articulo_id, cantidad] = t.split("@"); return { articulo_id, cantidad: Number(cantidad) }; })),
    c.equipos, c.grupo.length, c.ahorro, nombre(c.grupo),
  ]);
}
await db.query("commit");
const total = elegidos.reduce((s, c) => s + c.ahorro, 0);
console.log(`${rows.length} líneas en ${ids.length} equipos · ${candidatos.size} grupos repetidos · ${elegidos.length} sugerencias guardadas`);
console.log(`Si se aplican todas: ${total.toLocaleString("es-MX")} líneas menos que capturar y mantener.`);
for (const c of elegidos.slice(0, 8)) console.log(`  · ${c.grupo.length} piezas en ${c.equipos.length} equipos (ahorra ${c.ahorro}): ${nombre(c.grupo)}`);
await db.end();
